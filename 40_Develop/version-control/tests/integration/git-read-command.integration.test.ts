/**
 * 共通Git読取りとStageの外部処理抑止を実Gitで確認する。
 * @packageDocumentation
 * @responsibility 合成Repositoryの発火対照、元index不変、親環境注入とliteral Pathを検証する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @level IT
 * @scope diff／ls-files読取りと通常Stage。Docker・実AI・全Git操作は対象外。
 * @boundary Repository-local合成物→実Git子Process。
 */
import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import fs from "node:fs";
import { devNull } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  readWorkingChanges,
  stagePaths,
} from "../../src/repository/working-directory.ts";
import { readFileDiff } from "../../src/repository/changes.ts";
import {
  readTree,
  readFile,
  commitChanges,
  unstagePaths,
  type FileReadRequest,
  type WorkingFile,
  type PathsRequest,
  type ChangesCommitRequest,
  type ChangesResult,
} from "../../src/index.ts";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
} from "../../src/repository/location.ts";
import { runGitReadCommand } from "../../src/git/read.ts";
import { readRepositoryEntries } from "../../src/repository/discovery.ts";

const repository = path.resolve(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
const testsRoot = path.join(repository, ".crdd", "tests");
const emptyConfig = process.platform === "win32" ? "NUL" : devNull;

/**
 * 省略BaseでもHEAD・Object形式・安定読取りの拒否条件を維持する。
 * @responsibility HEADなし、不正OID幅、読取り中の内容差替えを拒否する。
 * @trace RFD-IT-005 RFD-IT-008
 * @precondition 試験専用の新規Repositoryを使う。
 * @stimulus SHA-1の内容差替えと、未対応SHA-256の入口拒否を対照する。
 * @observation 公開読取り結果・拒否理由・故障注入到達。
 * @oracle 誤形式や差替えを成功へ変換しない。
 * @cleanup 生成fixtureと試験内の関数差替えを回収する。
 * @boundary ローカル実Gitと試験内FS故障だけを使う。
 */
test("省略Baseの安定読取りと未対応Object形式の入口拒否を維持する", (t) => {
  fs.mkdirSync(testsRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(testsRoot, "vc-file-base-"));
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  for (const format of ["sha1", "sha256"] as const) {
    const root = path.join(fixture, format);
    fs.mkdirSync(root);
    git(root, [
      "init",
      `--object-format=${format}`,
      "--initial-branch=main",
      "--template=",
    ]);
    git(root, ["config", "user.name", "CRDD Test"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    fs.writeFileSync(path.join(root, "file.txt"), "base\n");
    const unborn = getRepository(root);
    if (unborn.status === "completed") {
      assert.throws(
        () => readFile(unborn.capability, { path: "file.txt" }),
        /repository_file_worktree_mismatch/u,
      );
    } else {
      assert.equal(unborn.capability, null);
    }
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "base"]);
    if (format === "sha256") {
      assert.equal(getRepository(root).status, "blocked");
      continue;
    }
    const capability = repositoryTarget(root);
    const head = git(root, ["rev-parse", "HEAD"]);
    assert.equal(readFile(capability, { path: "file.txt" }).baseCommit, head);
    const wrong = "a".repeat(64);
    assert.throws(
      () => readFile(capability, { path: "file.txt", baseCommit: wrong }),
      /repository_file_input_invalid/u,
    );
    let injected = false;
    childProcess.spawnSync = ((
      ...args: Parameters<typeof childProcess.spawnSync>
    ) => {
      const result = original(...args);
      if (!injected && Array.isArray(args[1]) && args[1].includes("diff")) {
        injected = true;
        fs.writeFileSync(path.join(root, "file.txt"), "changed\n");
      }
      return result;
    }) as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    assert.throws(
      () => readFile(capability, { path: "file.txt" }),
      /repository_file_content_changed/u,
    );
    assert.equal(injected, true);
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  }
});

/**
 * 公開型で現在内容を読み、Main／LinkedのHEAD・Index・File分離を実Gitで対照する。
 * @responsibility 省略Baseと明示Base、各Worktreeの読取り・Stage・Commit対象を確認する。
 * @trace RFD-IT-005 RFD-IT-008 RFD-IT-014
 * @precondition 自己生成Repositoryだけを使用する。
 * @stimulus 異なるHEAD、Index、作業内容を両側へ設定して公開操作を発行する。
 * @observation 実GitのHEAD・Index Tree・作業Fileと公開結果。
 * @oracle 反対側は不変、比較基準は対象HEADまたは明示Baseと一致する。
 * @cleanup この試験が生成したfixtureのみafterで回収する。
 * @boundary 外部AI・Docker・既存保持物を使わないローカル実Git。
 */
test("公開File読取りとIndex操作はMain／Linkedで同じ契約を守る", (t) => {
  fs.mkdirSync(testsRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(testsRoot, "vc-main-linked-"));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const main = path.join(fixture, "main");
  const linked = path.join(fixture, "linked");
  fs.mkdirSync(main);
  git(main, ["init", "--initial-branch=main", "--template="]);
  git(main, ["config", "user.name", "CRDD Test"]);
  git(main, ["config", "user.email", "test@example.invalid"]);
  git(main, ["config", "commit.gpgSign", "false"]);
  git(main, ["config", "core.hooksPath", emptyConfig]);
  fs.writeFileSync(path.join(main, "same.txt"), "base\n");
  git(main, ["add", "."]);
  git(main, ["commit", "-qm", "base"]);
  const base = git(main, ["rev-parse", "HEAD"]);
  git(main, ["worktree", "add", "-b", "linked", linked]);
  fs.writeFileSync(path.join(linked, "same.txt"), "linked head\n");
  git(linked, ["add", "."]);
  git(linked, ["commit", "-qm", "linked head"]);
  for (const [root, label] of [
    [main, "main"],
    [linked, "linked"],
  ] as const) {
    fs.writeFileSync(path.join(root, "same.txt"), `${label} index\n`);
    git(root, ["add", "."]);
    fs.writeFileSync(path.join(root, "same.txt"), `${label} working\n`);
  }
  for (const [root, other, label] of [
    [main, linked, "main"],
    [linked, main, "linked"],
  ] as const) {
    const capability = repositoryTarget(root);
    const otherBefore = [
      git(other, ["rev-parse", "HEAD"]),
      git(other, ["write-tree"]),
      fs.readFileSync(path.join(other, "same.txt"), "utf8"),
    ];
    const head = git(root, ["rev-parse", "HEAD"]);
    const request: FileReadRequest = { path: "same.txt" };
    const current: WorkingFile = readFile(capability, request);
    assert.equal(current.baseCommit, head);
    assert.equal(current.head, head);
    assert.equal(current.content, `${label} working\n`);
    assert.deepEqual(
      readFile(capability, { ...request, baseCommit: undefined }),
      current,
    );
    const explicit = readFile(capability, { ...request, baseCommit: base });
    assert.equal(explicit.baseCommit, base);
    assert.match(explicit.patch, /-base/u);
    const changes = readWorkingChanges(capability, head);
    assert.ok(changes.changedPaths.includes("same.txt"));
    assert.match(
      JSON.stringify(readTree(capability, changes, "", null, 100)),
      /same.txt/u,
    );
    assert.match(
      JSON.stringify(
        readFileDiff(capability, { unregisteredPaths: [] }, "same.txt"),
      ),
      new RegExp(`${label} working`, "u"),
    );
    assert.throws(
      () => readFile(capability, { path: "same.txt", baseCommit: "bad" }),
      /repository_file_input_invalid/u,
    );
    assert.throws(
      () => readFile(capability, { path: "../same.txt" }),
      /repository_file_input_invalid/u,
    );
    const paths: PathsRequest = { paths: ["same.txt"] };
    const unstaged: ChangesResult = unstagePaths(capability, paths);
    assert.equal(unstaged.status, "completed");
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
    assert.equal(stagePaths(capability, paths).status, "completed");
    assert.equal(git(root, ["show", ":same.txt"]), `${label} working`);
    const commit: ChangesCommitRequest = { message: `${label} local` };
    assert.equal(commitChanges(capability, commit).status, "completed");
    assert.notEqual(git(root, ["rev-parse", "HEAD"]), head);
    assert.deepEqual(
      [
        git(other, ["rev-parse", "HEAD"]),
        git(other, ["write-tree"]),
        fs.readFileSync(path.join(other, "same.txt"), "utf8"),
      ],
      otherBefore,
    );
    fs.writeFileSync(path.join(root, "same.txt"), Buffer.from([0, 1, 2]));
    assert.equal(readFile(capability, request).binary, true);
    fs.unlinkSync(path.join(root, "same.txt"));
    const deleted = readFile(capability, request);
    assert.equal(deleted.content, null);
    assert.equal(deleted.selection.blobId, null);
    fs.writeFileSync(path.join(root, "same.txt"), `${label} working\n`);
  }
});

/** Root不成立ではGitを発行せず、正常な子Directoryは同じRootで読む。 */
test("DiscoveryはRoot拒否後に生Pathへfallbackしない", (t) => {
  fs.mkdirSync(testsRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(testsRoot, "discovery-boundary-"));
  fs.writeFileSync(path.join(fixture, ".git"), "gitdir: missing\n");
  const originalSpawn = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = originalSpawn;
    syncBuiltinESMExports();
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  let calls = 0;
  childProcess.spawnSync = (() => {
    calls++;
    throw Error("rejected Root must not invoke Git");
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  assert.equal(getRepositoryFromWorkingDirectory(fixture).status, "blocked");
  assert.equal(readRepositoryEntries(fixture).status, "unavailable");
  assert.equal(calls, 0);
  childProcess.spawnSync = originalSpawn;
  syncBuiltinESMExports();
  fs.unlinkSync(path.join(fixture, ".git"));
  git(fixture, ["init"]);
  fs.mkdirSync(path.join(fixture, "child"));
  fs.writeFileSync(path.join(fixture, "child", "inside.txt"), "inside\n");
  fs.writeFileSync(path.join(fixture, "outside.txt"), "outside\n");
  const observed = readRepositoryEntries(path.join(fixture, "child"));
  assert.equal(observed.status, "completed");
  assert.deepEqual(
    observed.entries.map((entry) => entry.relativePath),
    ["inside.txt"],
  );
});

/** 合成Rootを公開取得入口で確認し、試験用の読取り対象を得る。 */
function repositoryTarget(root: string) {
  const result = getRepository(root);
  if (result.status !== "completed") throw Error("fixture_repository_invalid");
  return result.capability;
}

/**
 * 自己生成Git fixtureだけへ準備commandを発行する。
 * @responsibility 親Git環境・hook・署名・外部templateを準備Effectから除く。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @precondition rootは本試験内で作成したRepository-local Directory。
 * @stimulus 固定準備command。
 * @observation Gitの正常stdout。
 * @oracle 非zero・起動失敗は試験失敗。
 * @cleanup 呼出し元のafterでfixtureを回収する。
 * @boundary 合成RepositoryのGitのみ。
 */
function git(root: string, args: string[]) {
  return execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      `core.hooksPath=${emptyConfig}`,
      "-c",
      "commit.gpgSign=false",
      ...args,
    ],
    {
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
        ),
        GIT_CONFIG_GLOBAL: emptyConfig,
        GIT_CONFIG_SYSTEM: emptyConfig,
      },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    },
  ).trim();
}

/**
 * 外部設定の発火対照と共通読取りの非発火を同じfixtureで確認する。
 * @responsibility 無害なmarkerだけを使い、抑止された処理と実読取り成功を分ける。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @precondition GitとNodeが利用可能。実Repository・資格を使わない。
 * @stimulus 外部diff／textconv／fsmonitor、親GIT_*、core.worktree、特殊Path。
 * @observation marker、元Treeの差分、index bytes、各読取り結果。
 * @oracle 対照はmarkerを作り、本番Adapterは作らず元indexを変更しない。
 * @cleanup 合成Repositoryとmarkerをafterで削除する。
 * @boundary ローカル実Gitのみ。外部送信・本体Git更新はない。
 */
test("Git読取りは外部処理・親対象注入を避けliteral Pathとindexを保つ", (t) => {
  assert.equal(fs.lstatSync(testsRoot).isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(testsRoot), testsRoot);
  const root = fs.mkdtempSync(path.join(testsRoot, "git-read-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const work = path.join(root, "work");
  const other = path.join(root, "other");
  fs.mkdirSync(work);
  fs.mkdirSync(other);
  git(work, ["init", "--initial-branch=main", "--template="]);
  git(work, ["config", "user.name", "CRDD synthetic"]);
  git(work, ["config", "user.email", "synthetic@example.invalid"]);
  git(work, ["config", "core.autocrlf", "false"]);
  fs.writeFileSync(path.join(work, "file.txt"), "base\n");
  fs.writeFileSync(path.join(work, "[ab].txt"), "literal-base\n");
  fs.writeFileSync(path.join(work, "a.txt"), "other-base\n");
  git(work, ["add", "."]);
  git(work, ["commit", "-m", "synthetic base"]);
  const base = git(work, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(work, "file.txt"), "prepared\n");
  git(work, ["add", "file.txt"]);
  fs.writeFileSync(path.join(work, "file.txt"), "working\n");
  fs.writeFileSync(path.join(work, "[ab].txt"), "literal-working\n");
  fs.writeFileSync(path.join(work, "a.txt"), "other-working\n");
  fs.writeFileSync(path.join(work, "untracked.txt"), "untracked\n");
  const marker = path.join(root, "external-called");
  const probe = path.join(root, "external-probe.ts");
  fs.writeFileSync(
    probe,
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'called'); process.stdout.write('converted\\n');`,
  );
  const command = `"${process.execPath.replaceAll("\\", "/")}" "${probe.replaceAll("\\", "/")}"`;
  git(work, ["config", "diff.external", command]);
  git(work, ["diff", "--ext-diff", "--no-textconv", "--", "file.txt"]);
  assert.equal(fs.readFileSync(marker, "utf8"), "called");
  fs.unlinkSync(marker);
  git(work, ["config", "--unset", "diff.external"]);
  fs.writeFileSync(
    path.join(work, ".gitattributes"),
    "file.txt diff=synthetic\n",
  );
  git(work, ["config", "diff.synthetic.textconv", command]);
  git(work, ["diff", "--textconv", "--", "file.txt"]);
  assert.equal(fs.readFileSync(marker, "utf8"), "called");
  fs.unlinkSync(marker);
  git(work, ["config", "core.fsmonitor", command]);
  git(work, ["status", "--porcelain"]);
  assert.equal(fs.readFileSync(marker, "utf8"), "called");
  fs.unlinkSync(marker);
  git(work, ["config", "diff.external", command]);
  const index = fs.readFileSync(path.join(work, ".git", "index"));
  const target = repositoryTarget(work);
  const changes = {
    preparedChanges: [],
    workingChanges: [],
    unregisteredPaths: [],
  };
  assert.ok(
    readTree(target, changes, "", undefined, 100).entries.some(
      (e) => e.path === "file.txt",
    ),
  );
  const patch = readFileDiff(target, changes, "file.txt");
  assert.match(patch.preparedPatch, /prepared/u);
  assert.match(patch.workingPatch, /working/u);
  const literal = readFileDiff(target, changes, "[ab].txt");
  assert.match(literal.workingPatch, /literal-working/u);
  assert.doesNotMatch(literal.workingPatch, /other-working/u);
  const changesObserved = readWorkingChanges(repositoryTarget(work), base);
  assert.ok(changesObserved.preparedChanges.includes("file.txt"));
  assert.ok(changesObserved.workingChanges.includes("file.txt"));
  assert.ok(changesObserved.unregisteredPaths.includes("untracked.txt"));
  assert.equal(fs.existsSync(marker), false);
  assert.deepEqual(fs.readFileSync(path.join(work, ".git", "index")), index);

  const linked = path.join(root, "linked");
  git(work, [
    "-c",
    "core.fsmonitor=false",
    "worktree",
    "add",
    "--detach",
    linked,
    base,
  ]);
  assert.equal(fs.lstatSync(path.join(linked, ".git")).isFile(), true);
  const linkedIndexPath = git(linked, ["rev-parse", "--git-path", "index"]);
  const linkedIndex = fs.readFileSync(path.resolve(linked, linkedIndexPath));
  const clean = readWorkingChanges(repositoryTarget(linked), base);
  assert.deepEqual(clean.workingChanges, []);
  assert.deepEqual(clean.preparedChanges, []);
  fs.writeFileSync(path.join(linked, "file.txt"), "linked-working\n");
  assert.match(
    readFileDiff(repositoryTarget(linked), changes, "file.txt").workingPatch,
    /linked-working/u,
  );
  assert.equal(fs.existsSync(marker), false);

  assert.deepEqual(fs.readFileSync(path.join(work, ".git", "index")), index);
  assert.deepEqual(
    fs.readFileSync(path.resolve(linked, linkedIndexPath)),
    linkedIndex,
  );
  assert.equal(git(linked, ["rev-parse", "HEAD"]), base);

  const keys = [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_CONFIG_COUNT",
    "GIT_CONFIG_KEY_0",
    "GIT_CONFIG_VALUE_0",
    "GIT_EXTERNAL_DIFF",
  ];
  const previous = keys.map((key) => process.env[key]);
  try {
    process.env.GIT_DIR = path.join(other, ".git");
    process.env.GIT_WORK_TREE = other;
    process.env.GIT_CONFIG_COUNT = "1";
    process.env.GIT_CONFIG_KEY_0 = "core.fsmonitor";
    process.env.GIT_CONFIG_VALUE_0 = command;
    process.env.GIT_EXTERNAL_DIFF = command;
    assert.match(
      readFileDiff(target, changes, "file.txt").workingPatch,
      /working/u,
    );
    git(work, ["config", "core.worktree", other]);
    assert.equal(getRepository(work).status, "blocked");
    assert.throws(
      () => readFileDiff(target, changes, "file.txt"),
      /verified_repository_root_required/u,
    );
    assert.equal(fs.existsSync(marker), false);
    assert.deepEqual(fs.readFileSync(path.join(work, ".git", "index")), index);
  } finally {
    keys.forEach((key, position) => {
      const value = previous[position];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
  git(work, ["config", "--unset", "core.worktree"]);
  git(work, ["config", "core.fsmonitor", "false"]);
  fs.writeFileSync(
    path.join(work, ".gitattributes"),
    "file.txt filter=synthetic\n",
  );
  git(work, ["config", "filter.synthetic.clean", command]);
  git(work, ["diff", "--no-ext-diff", "--no-textconv", "--", "file.txt"]);
  assert.equal(fs.readFileSync(marker, "utf8"), "called");
  fs.unlinkSync(marker);
  const filterIndex = fs.readFileSync(path.join(work, ".git", "index"));
  assert.throws(
    () => readFileDiff(target, changes, "file.txt"),
    /repository_worktree_observation_failed/u,
  );
  assert.throws(
    () => readWorkingChanges(repositoryTarget(work), base),
    /local_change_set_observation_failed/u,
  );
  assert.equal(fs.existsSync(marker), false);
  assert.deepEqual(
    fs.readFileSync(path.join(work, ".git", "index")),
    filterIndex,
  );
  git(work, ["config", "--unset", "filter.synthetic.clean"]);
  git(work, ["config", "filter.synthetic.process", command]);
  assert.throws(() =>
    git(work, ["diff", "--no-ext-diff", "--no-textconv", "--", "file.txt"]),
  );
  assert.equal(fs.readFileSync(marker, "utf8"), "called");
  fs.unlinkSync(marker);
  assert.throws(
    () => readFileDiff(target, changes, "file.txt"),
    /repository_worktree_observation_failed/u,
  );
  assert.equal(fs.existsSync(marker), false);
  const failed = runGitReadCommand(other, ["ls-files", "-z"], 1024);
  assert.notEqual(failed.status, 0);
  assert.throws(
    () => runGitReadCommand(work, ["commit"], 1024),
    /unsupported/u,
  );
  const overflow = runGitReadCommand(work, ["ls-files", "-z"], 1);
  assert.ok(overflow.error);
  assert.equal(fs.existsSync(marker), false);
});

/**
 * 既存のProcess失敗分類・上限・注入Runnerを維持する。
 * @responsibility 内部集約が読取り操作の出力上限や例外契約を変えないことを確認する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @precondition 実子Processは起動せずbuiltin差替えをCase終了時に解除する。
 * @stimulus 起動失敗・期限・出力超過と固定実行optionを観測する。
 * @observation 元error、二つの読取り操作の固定理由、上限、引数と環境。
 * @oracle 元失敗を保持し、2MiB／16MiB・30秒・shellなしを維持する。
 * @cleanup mock解除後にbuiltin exportを同期する。
 * @boundary 試験Process内の起動境界。実Gitの証明とは分ける。
 */
test("Git読取り集約は起動失敗・期限・上限の既存分類を維持する", (t) => {
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  for (const code of ["ENOENT", "ETIMEDOUT", "ENOBUFS"]) {
    const error = Object.assign(new Error("synthetic"), { code });
    childProcess.spawnSync = ((
      _command: unknown,
      args: unknown,
      options: unknown,
    ) => {
      const argv = args as string[];
      const config = options as {
        shell: boolean;
        timeout: number;
        maxBuffer: number;
        env: Record<string, string>;
      };
      assert.ok(argv.includes("--no-optional-locks"));
      assert.ok(argv.includes("--literal-pathspecs"));
      assert.ok(argv.includes("core.fsmonitor=false"));
      assert.equal(config.shell, false);
      assert.ok(config.timeout > 0 && config.timeout <= 30_000);
      assert.ok([2 * 1024 * 1024, 16 * 1024 * 1024].includes(config.maxBuffer));
      assert.equal(config.env.GIT_TERMINAL_PROMPT, "0");
      assert.equal(config.env.GIT_NO_LAZY_FETCH, "1");
      return {
        error,
        status: null,
        signal: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        output: [],
        pid: 0,
      };
    }) as unknown as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    assert.throws(
      () =>
        readTree(
          repositoryTarget(repository),
          { preparedChanges: [], workingChanges: [], unregisteredPaths: [] },
          "",
          undefined,
          50,
        ),
      /repository_worktree_observation_failed/u,
    );
    assert.throws(
      () => readWorkingChanges(repositoryTarget(repository), "HEAD"),
      /local_change_set_observation_failed:revision_changes/u,
    );
  }
});

/**
 * 外部filter設定の不存在と観測不能を区別する。
 * @responsibility 正規の設定なしだけをdiffへ接続し、拒否時の後続要求0を確認する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @precondition 実子Processを起動しない。
 * @stimulus clean／process設定あり、設定読取り不正／異常、正規の設定なし。
 * @observation configとdiffの発行順・回数と元失敗。
 * @oracle exit1かつ空stdoutかつerrorなしだけが次のdiffへ進む。
 * @cleanup builtin差替えを解除する。
 * @boundary Process注入の局所確認。実Git対照とは区別する。
 */
test("外部filterの設定あり・観測不能ではdiffを発行しない", (t) => {
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  for (const variant of [
    "clean",
    "process",
    "unknown",
    "malformed",
    "absent",
  ]) {
    const calls: string[] = [];
    childProcess.spawnSync = ((_command: unknown, args: unknown) => {
      const argv = args as string[];
      const config = argv.includes("config");
      calls.push(config ? "config" : "diff");
      const stdout =
        config && variant !== "absent" && variant !== "unknown"
          ? Buffer.from(`filter.synthetic.${variant}\0`)
          : Buffer.alloc(0);
      return {
        status: config
          ? variant === "clean" || variant === "process"
            ? 0
            : variant === "unknown"
              ? 128
              : 1
          : 0,
        stdout,
        stderr: Buffer.alloc(0),
        signal: null,
        output: [],
        pid: 0,
      };
    }) as unknown as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    const result = runGitReadCommand(
      repository,
      ["diff", "--no-ext-diff", "--no-textconv"],
      2 * 1024 * 1024,
    );
    assert.deepEqual(
      calls,
      variant === "absent" ? ["config", "diff"] : ["config"],
    );
    assert.equal(result.status, variant === "absent" ? 0 : null);
  }
});

/**
 * Stageの設定範囲と発行前停止を実Gitで確認する。
 * @responsibility ローカルclean／process・Global Filterを拒否し、Indexと選択内容を保つ。
 * @trace RFD-IT-014
 * @precondition 今回作成したRepository・Home・無害なFilterだけを使用する。
 * @stimulus Filterなし、実発火対照、設定あり、Global設定。
 * @observation Filter marker、Index bytes、add要求数、公開結果。
 * @oracle 拒否時はFilter未実行・Index不変・add要求0。設定なしでは選択内容をStageする。
 * @cleanup builtinと環境を復元し今回のFixtureを回収する。
 * @boundary ローカル実Git。実AI・Docker・外部Remoteなし。
 */
test("Stageは同じ設定範囲の外部FilterをEffect前に拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(testsRoot, "git-stage-filter-"));
  const work = path.join(root, "work");
  const home = path.join(root, "home");
  fs.mkdirSync(work);
  fs.mkdirSync(home);
  const environment = new Map(
    ["HOME", "USERPROFILE", "XDG_CONFIG_HOME"].map((key) => [
      key,
      process.env[key],
    ]),
  );
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
    for (const [key, value] of environment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.XDG_CONFIG_HOME = home;
  git(work, ["init", "--initial-branch=main", "--template="]);
  git(work, ["config", "user.name", "CRDD synthetic"]);
  git(work, ["config", "user.email", "synthetic@example.invalid"]);
  git(work, ["config", "core.autocrlf", "false"]);
  fs.writeFileSync(path.join(work, ".gitattributes"), "*.txt filter=stage\n");
  fs.writeFileSync(path.join(work, "source.txt"), "base\n");
  git(work, ["add", "."]);
  git(work, ["commit", "-m", "base"]);
  fs.writeFileSync(path.join(work, "source.txt"), "selected\n");
  const marker = path.join(root, "filter-called");
  const probe = path.join(root, "filter.cjs");
  fs.writeFileSync(
    probe,
    `require("node:fs").writeFileSync(${JSON.stringify(marker)},"called");process.stdout.write("converted\\n");`,
  );
  const command = `"${process.execPath.replaceAll("\\", "/")}" "${probe.replaceAll("\\", "/")}"`;
  git(work, ["config", "filter.stage.clean", command]);
  git(work, ["add", "--", "source.txt"]);
  assert.equal(fs.existsSync(marker), true);
  assert.equal(git(work, ["show", ":source.txt"]), "converted");
  git(work, ["reset", "--quiet", "HEAD", "--", "source.txt"]);
  git(work, ["config", "--unset", "filter.stage.clean"]);
  fs.unlinkSync(marker);
  const capability = repositoryTarget(work);
  const before = fs.readFileSync(path.join(work, ".git", "index"));
  let addCalls = 0;
  childProcess.spawnSync = ((file, args, options) => {
    if ((args as readonly string[]).includes("add")) addCalls++;
    return Reflect.apply(original, childProcess, [file, args, options]);
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  fs.mkdirSync(path.join(work, "sub"));
  fs.writeFileSync(path.join(work, "sub", "nested.txt"), "nested\n");
  for (const scope of [
    "clean",
    "process",
    "global",
    "unset",
    "unspecified",
    "directory",
    "mixed",
  ]) {
    const driver =
      scope === "unset" || scope === "unspecified" ? scope : "stage";
    fs.writeFileSync(
      path.join(work, ".gitattributes"),
      `*.txt filter=${driver}\n`,
    );
    const key =
      scope === "process" ? "filter.stage.process" : `filter.${driver}.clean`;
    if (scope === "global")
      fs.writeFileSync(
        path.join(home, ".gitconfig"),
        `[filter "stage"]\n clean = ${JSON.stringify(command)}\n`,
      );
    else git(work, ["config", key, command]);
    const rejected = stagePaths(capability, {
      paths:
        scope === "directory"
          ? ["sub"]
          : scope === "mixed"
            ? ["source.txt", ".gitattributes"]
            : ["source.txt"],
    });
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.reason, "prepare_external_filter_unavailable");
    assert.equal(rejected.effectIssued, false);
    assert.equal(rejected.effectConfirmed, false);
    assert.equal(fs.existsSync(marker), false);
    assert.deepEqual(fs.readFileSync(path.join(work, ".git", "index")), before);
    assert.equal(addCalls, 0);
    if (scope === "global") fs.unlinkSync(path.join(home, ".gitconfig"));
    else git(work, ["config", "--unset", key]);
  }
  fs.writeFileSync(path.join(work, ".gitattributes"), "*.txt filter=stage\n");
  git(work, ["config", "filter.lfs.clean", command]);
  const completed = stagePaths(capability, { paths: ["source.txt"] });
  assert.equal(completed.status, "completed");
  assert.equal(addCalls, 1);
  assert.equal(git(work, ["show", ":source.txt"]), "selected");
});

/**
 * Stage照会の異常・期限とSystem設定の継承を有限代役で確認する。
 * @responsibility 未設定と観測不能を分け、照会とaddで同じ設定範囲・合計期限を使う。
 * @trace RFD-IT-014
 * @stimulus 設定あり、非0、error、Signal、不正stdout、期限消費、正常。
 * @observation 要求順、渡した環境、期限、Effect field。
 * @oracle 正規exit1空出力だけがaddへ進み、失敗はEffect0。
 * @cleanup builtinと時計を復元する。実System設定は変更しない。
 * @boundary 子Process代役。実Gitの発火対照は別Case。
 */

test("Stageの観測不能と期限切れはaddを発行しない", (t) => {
  const original = childProcess.spawnSync;
  const descriptor = Object.getOwnPropertyDescriptor(performance, "now");
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
    if (descriptor) Object.defineProperty(performance, "now", descriptor);
    else Reflect.deleteProperty(performance, "now");
  });
  const capability = repositoryTarget(repository);
  for (const variant of [
    "configured",
    "failed",
    "error",
    "signal",
    "malformed",
    "expired",
    "absent",
    "not_applied",
    "attr_path",
    "attr_duplicate",
    "attr_missing",
    "attr_extra",
    "attr_utf8",
    "attr_failed",
    "attr_signal",
    "attr_expired",
    "files_failed",
  ]) {
    let now = 0;
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: () => now,
    });
    const calls: string[] = [];
    childProcess.spawnSync = ((
      _file: unknown,
      args: unknown,
      options: unknown,
    ) => {
      const argv = args as readonly string[];
      const operation = argv.includes("config")
        ? "config"
        : argv.includes("ls-files")
          ? "files"
          : argv.includes("check-attr")
            ? "attributes"
            : "add";
      calls.push(operation);
      const opts = options as {
        env: Record<string, string>;
        timeout: number;
        maxBuffer: number;
        input?: Buffer;
      };
      assert.equal(opts.env.GIT_CONFIG_GLOBAL, undefined);
      assert.equal(opts.env.GIT_CONFIG_SYSTEM, undefined);
      assert.equal(opts.maxBuffer, 4 * 1024 * 1024);
      assert.equal(opts.timeout, operation === "config" ? 30_000 : 29_000);
      now =
        variant === "expired" ||
        (variant === "attr_expired" && operation === "attributes")
          ? 30_001
          : 1000;
      let stdout = Buffer.alloc(0),
        status = 0;
      if (operation === "config") {
        status = ["failed", "error", "signal"].includes(variant)
          ? 128
          : ["absent", "malformed", "expired"].includes(variant)
            ? 1
            : 0;
        if (status === 0 || variant === "malformed")
          stdout = Buffer.from("filter.test.process\0");
      } else if (operation === "files") {
        status = variant === "files_failed" ? 128 : 0;
        stdout = Buffer.from("synthetic.txt\0");
      } else if (operation === "attributes") {
        assert.deepEqual(opts.input, Buffer.from("synthetic.txt\0"));
        stdout = Buffer.from(
          "synthetic.txt\0filter\0" +
            (variant === "not_applied" ? "unspecified" : "test") +
            "\0",
        );
        if (variant === "attr_path")
          stdout = Buffer.from("different.txt\0filter\0unspecified\0");
        if (variant === "attr_duplicate" || variant === "attr_extra")
          stdout = Buffer.concat([stdout, stdout]);
        if (variant === "attr_missing") stdout = Buffer.alloc(0);
        if (variant === "attr_utf8") stdout = Buffer.from([255, 0]);
        if (variant === "attr_failed") status = 128;
      }
      return {
        status,
        error: variant === "error" ? Error("synthetic") : undefined,
        signal:
          variant === "signal" ||
          (variant === "attr_signal" && operation === "attributes")
            ? "SIGTERM"
            : null,
        stdout,
        stderr: Buffer.alloc(0),
        output: [],
        pid: 0,
      };
    }) as unknown as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    const result = stagePaths(capability, { paths: ["synthetic.txt"] });
    const accepted = variant === "absent" || variant === "not_applied";
    assert.equal(
      calls.filter((value) => value === "add").length,
      accepted ? 1 : 0,
      variant,
    );
    assert.equal(result.effectIssued, accepted, variant);
    assert.equal(result.status, accepted ? "completed" : "blocked", variant);
  }
});
