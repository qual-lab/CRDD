/**
 * Coordinatorの保護Mount用Root準備を実Filesystemへ接続する。
 * @packageDocumentation
 * @responsibility モデル分離後も既存内容の保全と観測不能時の作成0を確認する。
 * @trace PRL-IT-013
 * @level IT
 * @scope 自己生成Repository-localの通常Directoryのみ。
 * @boundary Coordinatorの技術Root観測。AI・Docker・過去保持物は使用しない。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
  readRepositoryLocation,
} from "@qual-lab/crdd-version-control";
import {
  checkRepositoryRuntimeDataProtectionDirectory,
  ensureRepositoryExecutionDataArea,
  inspectBorrowedExecutionTarget,
  requireReadyRepositoryExecutionDataArea,
  RepositoryDataBlockedError,
} from "../../src/lifecycle/host.ts";

/**
 * 所在初期化の失敗をEM例外へ変換せずCo所有の情報として搬送する。
 * @responsibility 部分Effectと回復参照の欠落を防ぐ。
 * @trace PRL-IT-013
 * @precondition 合成blocked結果だけを使用する。
 * @stimulus requireReadyに既知Effect・観測不明・回復参照を渡す。
 * @observation 例外型と失敗fieldの一致。
 * @oracle 所有型を区別し元の失敗情報を保持する。
 * @cleanup メモリ内のみ。
 * @boundary 値の例外搬送。Filesystem操作は行わない。
 */
test("所在初期化失敗はCo所有の例外で元のEffectと回復参照を保持する", () => {
  const failure = {
    status: "blocked" as const,
    reason: "repository_runtime_data_ignore_registration_blocked" as const,
    effectIssued: true,
    effectStateUnknown: true,
    effectConfirmation: "unknown" as const,
    cleanupConfirmed: false,
    retryAllowed: false,
    recoveryReference: "repository-local-ignore.fixture" as const,
    repositoryPathReported: false as const,
  };
  assert.throws(
    () => requireReadyRepositoryExecutionDataArea(failure, "invalid"),
    (error: unknown) => {
      assert.ok(error instanceof RepositoryDataBlockedError);
      for (const field of [
        "reason",
        "effectIssued",
        "effectStateUnknown",
        "cleanupConfirmed",
        "retryAllowed",
        "recoveryReference",
        "repositoryPathReported",
      ] as const)
        assert.equal(error[field], failure[field]);
      return true;
    },
  );
});

/**
 * 固定Git構造を持つ新品Rootを用途限定領域へ作る。
 * @responsibility 試験物の所在と終了清掃を同じ実体へ結合する。
 * @trace PRL-IT-013
 * @precondition 現RepositoryをVCで検証できる。
 * @stimulus .crdd/tests下の新Directoryへ固定Git管理情報を作る。
 * @observation 検証済みRootと試験終了時の不存在。
 * @oracle 現Repository外又は過去保持物へ書き込まない。
 * @cleanup 新Rootだけを非Link・所在確認後に回収する。
 * @boundary Repository-local実Filesystem。
 */
function fixture(t: test.TestContext) {
  const current = getRepositoryFromWorkingDirectory(import.meta.dirname);
  assert.equal(current.status, "completed");
  const area = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataArea(current.capability, "tests"),
    "protection_test_area_invalid",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "co-protection-"));
  t.after(() => {
    assert.equal(path.dirname(root), area.directory);
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  return {
    root,
    repository: verified.capability,
    internal: path.join(root, ".crdd"),
  };
}

/**
 * @trace PRL-IT-013
 * @precondition 新Rootには内部保存領域がまだない。
 * @stimulus observe、prepare、既存状態Fileを置いて再prepareする。
 * @observation absent／readyと元File内容。
 * @oracle observeは作成せず、再prepareは既存内容を破壊しない。
 * @cleanup fixtureのexact Root回収。
 * @boundary 保護Rootの実準備。
 */
test("保護Mountのprepareは既存状態を初期化も削除もしない", (t) => {
  const f = fixture(t);
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "observe"),
    "absent",
  );
  assert.equal(fs.existsSync(f.internal), false);
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "prepare"),
    "ready",
  );
  const sentinel = path.join(f.internal, "existing-state.json");
  fs.writeFileSync(sentinel, "preserved");
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "prepare"),
    "ready",
  );
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "observe"),
    "ready",
  );
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved");
});

/**
 * @trace PRL-IT-013
 * @precondition 同じ新品RepositoryからDirectとIsolatedの対象を作る。
 * @stimulus 現在の対象、異なる期待HEAD、linkedのDirect、保護先が通常Fileのケースを照合する。
 * @observation 借用対象の確定またはnullと、保護領域が変わらないこと。
 * @oracle 配置の重複を除いても境界・HEAD・保護条件を緩めない。
 * @cleanup fixtureのexact Root回収。
 * @boundary 実Git配置と保護先の読み取り。
 */
test("借用対象はDirectとIsolatedを受け付け不一致を拒否する", (t) => {
  const { root, internal } = fixture(t);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^GIT_/iu.test(name)),
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: path.join(root, "no-global-config"),
      },
    }).trim();
  git("init", "--quiet", "--template=");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "-c",
    "commit.gpgSign=false",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "fixture",
  );
  const head = git("rev-parse", "HEAD");
  const direct = {
    workspaceId: null,
    ownerRepositoryRoot: root,
    executionTree: root,
    baseCommit: null,
    head: null,
  };
  const configPath = path.join(root, ".git", "config");
  const open = fs.openSync;
  let layouts = 0;
  let failLayoutAt = 0;
  const intercept = t.mock.method(fs, "openSync", ((
    target: fs.PathLike,
    ...args: unknown[]
  ) => {
    if (String(target) === configPath && ++layouts === failLayoutAt)
      throw Object.assign(new Error("synthetic_layout_denied"), {
        code: "EACCES",
      });
    return Reflect.apply(open, fs, [target, ...args]);
  }) as typeof fs.openSync);
  assert.deepEqual(inspectBorrowedExecutionTarget(root, direct), direct);
  assert.equal(layouts, 2);
  assert.equal(fs.existsSync(internal), false);
  const worktree = path.join(root, "workspace");
  git("worktree", "add", "--quiet", "-b", "fixture-workspace", worktree);
  const isolated = {
    ...direct,
    workspaceId: "fixture",
    executionTree: worktree,
    baseCommit: head,
    head,
  };
  layouts = 0;
  assert.deepEqual(inspectBorrowedExecutionTarget(root, isolated), isolated);
  assert.equal(layouts, 4);
  layouts = 0;
  failLayoutAt = 4;
  assert.equal(inspectBorrowedExecutionTarget(root, isolated), null);
  assert.equal(layouts, 4);
  intercept.mock.restore();
  const otherHead = (head.startsWith("1") ? "2" : "1").repeat(40);
  assert.equal(
    inspectBorrowedExecutionTarget(root, { ...isolated, head: otherHead }),
    null,
  );
  const headPath = path.join(
    git("-C", worktree, "rev-parse", "--absolute-git-dir"),
    "HEAD",
  );
  const savedHead = fs.readFileSync(headPath);
  fs.writeFileSync(headPath, `${otherHead}\n`);
  try {
    assert.equal(
      readRepositoryLocation(worktree, "placement_and_head")?.head,
      otherHead,
    );
    assert.equal(
      readRepositoryLocation(worktree, "placement_and_commit"),
      null,
    );
  } finally {
    fs.writeFileSync(headPath, savedHead);
  }
  assert.equal(
    inspectBorrowedExecutionTarget(worktree, {
      ...direct,
      ownerRepositoryRoot: worktree,
      executionTree: worktree,
    }),
    null,
  );
  fs.writeFileSync(internal, "not a directory");
  assert.equal(inspectBorrowedExecutionTarget(root, direct), null);
  assert.equal(fs.readFileSync(internal, "utf8"), "not a directory");
});

/**
 * @trace PRL-IT-013
 * @precondition 通常の保護Rootと既存状態を用意する。
 * @stimulus RootのlstatへEACCESを注入しobserve／prepareする。
 * @observation blocked、mkdir回数0と既存File不変。
 * @oracle 観測不能を不存在へ変換せず作成しない。
 * @cleanup mockを復元しfixtureだけを回収する。
 * @boundary Node.jsの読取り失敗と作成境界。
 */
test("保護Rootの観測不能はprepareでもmkdirを発行しない", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.internal);
  const sentinel = path.join(f.internal, "existing-state.json");
  fs.writeFileSync(sentinel, "preserved");
  const original = fs.lstatSync;
  const lstat = t.mock.method(fs, "lstatSync", ((
    target: fs.PathLike,
    ...args: unknown[]
  ) => {
    if (String(target) === f.internal)
      throw Object.assign(new Error("synthetic_denied"), { code: "EACCES" });
    return Reflect.apply(original, fs, [target, ...args]);
  }) as typeof fs.lstatSync);
  const mkdir = t.mock.method(fs, "mkdirSync");
  try {
    assert.equal(
      checkRepositoryRuntimeDataProtectionDirectory(f.repository, "observe"),
      "blocked",
    );
    assert.equal(
      checkRepositoryRuntimeDataProtectionDirectory(f.repository, "prepare"),
      "blocked",
    );
    assert.equal(mkdir.mock.calls.length, 0);
  } finally {
    lstat.mock.restore();
    mkdir.mock.restore();
  }
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved");
});
