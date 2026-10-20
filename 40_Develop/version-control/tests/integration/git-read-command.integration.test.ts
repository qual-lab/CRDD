/**
 * 共通Git読取りの外部処理抑止と対象Treeを実Gitで確認する。
 * @packageDocumentation
 * @responsibility 合成Repositoryの発火対照、元index不変、親環境注入とliteral Pathを検証する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @level IT
 * @scope diff／ls-filesを使う二Adapter。Docker・実AI・全Git操作は対象外。
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
import { gitLocalChangeSetAdapter } from "../../src/repository/changes.ts";
import { runGitReadCommand } from "../../src/git/read.ts";
import { gitRepositoryWorktreeViewAdapter } from "../../src/repository/worktree-view.ts";

const repository = path.resolve(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
const testsRoot = path.join(repository, ".crdd", "tests");
const emptyConfig = process.platform === "win32" ? "NUL" : devNull;

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
  const view = gitRepositoryWorktreeViewAdapter(work);
  assert.ok(view.paths.includes("file.txt"));
  const patch = view.readPatch("file.txt");
  assert.match(patch.preparedPatch, /prepared/u);
  assert.match(patch.workingPatch, /working/u);
  const literal = view.readPatch("[ab].txt");
  assert.match(literal.workingPatch, /literal-working/u);
  assert.doesNotMatch(literal.workingPatch, /other-working/u);
  const changes = gitLocalChangeSetAdapter(work, base);
  assert.ok(changes.preparedChanges.includes("file.txt"));
  assert.ok(changes.workingChanges.includes("file.txt"));
  assert.ok(changes.unregisteredPaths.includes("untracked.txt"));
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
  const clean = gitLocalChangeSetAdapter(linked, base);
  assert.deepEqual(clean.workingChanges, []);
  assert.deepEqual(clean.preparedChanges, []);
  fs.writeFileSync(path.join(linked, "file.txt"), "linked-working\n");
  assert.match(
    gitRepositoryWorktreeViewAdapter(linked).readPatch("file.txt").workingPatch,
    /linked-working/u,
  );
  assert.equal(fs.existsSync(marker), false);

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
    git(work, ["config", "core.worktree", other]);
    const rebound = gitRepositoryWorktreeViewAdapter(work);
    assert.match(rebound.readPatch("file.txt").workingPatch, /working/u);
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
    () => gitRepositoryWorktreeViewAdapter(work).readPatch("file.txt"),
    /repository_worktree_observation_failed/u,
  );
  assert.throws(
    () => gitLocalChangeSetAdapter(work, base),
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
    () => gitRepositoryWorktreeViewAdapter(work).readPatch("file.txt"),
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
 * @responsibility 内部集約がAdapterの出力上限や例外契約を変えないことを確認する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @precondition 実子Processは起動せずbuiltin差替えをCase終了時に解除する。
 * @stimulus 起動失敗・期限・出力超過と固定実行optionを観測する。
 * @observation 元error、二Adapterの固定理由、上限、引数と環境。
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
      () => gitRepositoryWorktreeViewAdapter(repository),
      /repository_worktree_observation_failed/u,
    );
    assert.throws(
      () => gitLocalChangeSetAdapter(repository, "HEAD"),
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
