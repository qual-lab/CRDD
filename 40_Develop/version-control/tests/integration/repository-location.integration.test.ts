/**
 * version-control:integration:repository-locationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility version-control:integration:repository-locationが所有する検証責務を実行する。
 * @trace RFD-IT-001
 * @trace RFD-IT-002
 * @level IT
 * @scope version-control、repository-root、worktree、submodule
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest / RFD-IT-002=Related 2 Blocks: Path Observer→Version Control Adapter→Effect Gate
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  gitRepositoryRevisionAdapter,
  observeRepositoryStorageIdentity,
} from "../../src/repository/revision.ts";

import {
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../src/repository/location.ts";

/**
 * gitのTest準備責務を実行する。
 *
 * @responsibility gitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus gitを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
function git(cwd: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * repositoryのTest準備責務を実行する。
 *
 * @responsibility repositoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus repositoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
function repository(t: test.TestContext): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-root-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  git(root, ["add", "tracked.txt"]);
  git(root, ["commit", "-m", "baseline"]);
  return fs.realpathSync.native(root);
}

/**
 * 保存先Identityと実行Commit観測を未Commitの実Gitで分離する。
 * @responsibility 保存用APIがHEADを捏造せず、偽Capabilityと失効Rootを拒否することを確認する。
 * @trace RFD-IT-001
 * @precondition Repository内の自己生成試験領域とGitだけを使用する。
 * @stimulus HEAD未作成、空Commit後、Git管理領域の退避後に同じCapabilityを観測する。
 * @observation 論理・実体Identity、Revision観測の不存在、Root失効を確認する。
 * @oracle 保存IdentityはCommit前後で同じだが、Commitなしを実行Revision成功へ変換しない。
 * @cleanup 自己生成Rootを実体確認後に削除し、不存在を確認する。
 * @boundary RFD-IT-001=Direct Boundary: 保存Identity観測→Git配置とFilesystem。
 */
test("保存Identityは未CommitのGitでも成立し実行Revisionを捏造しない", (t) => {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "storage-identity-"));
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  git(root, ["init", "--quiet"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("fixture");
  const before = observeRepositoryStorageIdentity(verified.capability);
  assert.ok(before);
  assert.equal(Object.isFrozen(before), true);
  assert.equal(Object.hasOwn(before, "revisionIdentity"), false);
  assert.equal(gitRepositoryRevisionAdapter(root), null);
  assert.equal(
    observeRepositoryStorageIdentity({ ...verified.capability }),
    null,
  );
  git(root, [
    "-c",
    "user.name=CRDD Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--allow-empty",
    "-m",
    "synthetic",
  ]);
  assert.deepEqual(
    observeRepositoryStorageIdentity(verified.capability),
    before,
  );
  assert.ok(gitRepositoryRevisionAdapter(root));
  fs.renameSync(path.join(root, ".git"), path.join(root, "retired-git"));
  assert.equal(observeRepositoryStorageIdentity(verified.capability), null);
});

/**
 * exact and nested repository locations issue the same scoped capabilityを検証する。
 *
 * @responsibility exact and nested repository locations issue the same scoped capabilityの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact and nested repository locations issue the same scoped capabilityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
test("exact and nested repository locations issue the same scoped capability", (t) => {
  const root = repository(t);
  const nested = path.join(root, "nested", "deeper");
  fs.mkdirSync(nested, { recursive: true });

  const exact = verifyRepositoryRoot(root);
  const enclosing = verifyRepositoryRootFromWorkingDirectory(nested);
  assert.equal(exact.status, "completed");
  assert.equal(enclosing.status, "completed");
  assert.equal(resolveVerifiedRepositoryRoot(exact.capability), root);
  assert.equal(resolveVerifiedRepositoryRoot(enclosing.capability), root);
  assert.equal(resolveVerifiedRepositoryRootFromWorkingDirectory(nested), root);
});

/**
 * an invalid nested boundary is terminalを検証する。
 *
 * @responsibility an invalid nested boundary is terminalの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus an invalid nested boundary is terminalの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
test("an invalid nested boundary is terminal", (t) => {
  const root = repository(t);
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, ".git"), "not a gitdir\n", "utf8");

  assert.deepEqual(verifyRepositoryRootFromWorkingDirectory(nested), {
    status: "blocked",
    reason: "repository_root_invalid",
    capability: null,
  });
  assert.throws(
    () => resolveVerifiedRepositoryRootFromWorkingDirectory(nested),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "repository_boundary_invalid" &&
      !error.message.includes("git"),
  );
});

/**
 * a linked worktree is a valid exact repository rootを検証する。
 *
 * @responsibility a linked worktree is a valid exact repository rootの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus a linked worktree is a valid exact repository rootの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
test("a linked worktree is a valid exact repository root", (t) => {
  const root = repository(t);
  const linked = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-linked-"));
  fs.rmSync(linked, { recursive: true, force: true });
  t.after(() => fs.rmSync(linked, { recursive: true, force: true }));
  git(root, ["worktree", "add", "--detach", linked]);

  const result = verifyRepositoryRoot(fs.realpathSync.native(linked));
  assert.equal(result.status, "completed");
});

/**
 * a standard submodule worktree is a distinct valid repository rootを検証する。
 *
 * @responsibility a standard submodule worktree is a distinct valid repository rootの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus a standard submodule worktree is a distinct valid repository rootの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
test("a standard submodule worktree is a distinct valid repository root", (t) => {
  const root = repository(t);
  const source = repository(t);
  git(root, [
    "-c",
    "protocol.file.allow=always",
    "submodule",
    "add",
    "--quiet",
    source,
    "dependency",
  ]);
  const dependency = fs.realpathSync.native(path.join(root, "dependency"));

  const result = verifyRepositoryRoot(dependency);
  assert.equal(result.status, "completed");
  assert.equal(resolveVerifiedRepositoryRoot(result.capability), dependency);
});

/**
 * repository-local runtime writes do not invalidate repository identityを検証する。
 *
 * @responsibility repository-local runtime writes do not invalidate repository identityの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus repository-local runtime writes do not invalidate repository identityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
test("repository-local runtime writes do not invalidate repository identity", (t) => {
  const root = repository(t);
  const result = verifyRepositoryRoot(root);
  assert.equal(result.status, "completed");

  fs.mkdirSync(path.join(root, ".crdd"));
  assert.equal(resolveVerifiedRepositoryRoot(result.capability), root);
});

/**
 * a capability fails closed after its repository boundary disappearsを検証する。
 *
 * @responsibility a capability fails closed after its repository boundary disappearsの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus a capability fails closed after its repository boundary disappearsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
test("a capability fails closed after its repository boundary disappears", (t) => {
  const root = repository(t);
  const result = verifyRepositoryRoot(root);
  assert.equal(result.status, "completed");

  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  assert.equal(resolveVerifiedRepositoryRoot(result.capability), null);
});

/**
 * arbitrary directories and forged capability values fail closedを検証する。
 *
 * @responsibility arbitrary directories and forged capability values fail closedの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus arbitrary directories and forged capability values fail closedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Direct Boundary: version-control Test Source→対象契約
 */
test("arbitrary directories and forged capability values fail closed", (t) => {
  const arbitrary = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-none-"));
  t.after(() => fs.rmSync(arbitrary, { recursive: true, force: true }));
  assert.equal(verifyRepositoryRoot(arbitrary).status, "blocked");
  assert.equal(
    resolveVerifiedRepositoryRoot({
      contract: "crdd-version-control/repository-location/v1",
    }),
    null,
  );
});

/**
 * Windows repository identity does not depend on caller path casingを検証する。
 *
 * @responsibility Windows repository identity does not depend on caller path casingの合否判定を所有する。
 * @trace RFD-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows repository identity does not depend on caller path casingの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-002=Direct Boundary: version-control Test Source→対象契約
 */
test("Windows repository identity does not depend on caller path casing", {
  skip: process.platform !== "win32",
}, (t) => {
  const root = repository(t);
  assert.equal(verifyRepositoryRoot(root.toUpperCase()).status, "completed");
});
