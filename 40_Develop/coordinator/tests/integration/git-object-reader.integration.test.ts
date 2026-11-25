/**
 * coordinator:integration:git-object-reader-integrationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:git-object-reader-integrationが所有する検証責務を実行する。
 * @trace RFD-IT-012
 * @level IT
 * @scope git、object、reader
 * @boundary RFD-IT-012=Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  copyGitCommitTree,
  inspectGitCommitTree,
  readGitCommitFile,
} from "../../../version-control/src/git/objects.ts";
import {
  readCommitFile,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRoot,
} from "@qual-lab/crdd-version-control";
import { resolveRepositoryGitLayout } from "../../../version-control/src/repository/layout.ts";
import { getRepository } from "../../../version-control/src/repository/location.ts";
import {
  ensureRepositoryExecutionDataArea,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/lifecycle/host.ts";
import {
  bindRepositoryOperation,
  borrowRepositorySource,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  verifyOwnedOperationManagementMountBinding,
} from "../../src/lifecycle/host.ts";
import { containsRecognizedSecretMaterial } from "../../src/lifecycle/validation.ts";
import {
  createGitPackedObjectFixture,
  mutateGitPackedObjectFixture,
} from "../fixtures/git-packed-object-fixture.ts";

/**
 * materializeProtectedGitCommitTreeCandidateのTest準備責務を実行する。
 *
 * @responsibility materializeProtectedGitCommitTreeCandidateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus materializeProtectedGitCommitTreeCandidateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function materializeProtectedGitCommitTreeCandidate(candidate: unknown) {
  return copyGitCommitTree(candidate, containsRecognizedSecretMaterial);
}

for (const kind of ["base", "ofs", "ref"] as const) {
  /**
   * Git生成pack-only ${kind}は公開3APIで完全bytesを復元するを検証する。
   *
   * @responsibility Git生成pack-only ${kind}は公開3APIで完全bytesを復元するの合否判定を所有する。
   * @trace RFD-IT-012
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Git生成pack-only ${kind}は公開3APIで完全bytesを復元するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`Git生成pack-only ${kind}は公開3APIで完全bytesを復元する`, {
    skip: process.platform !== "win32",
  }, (t) => {
    const fixture = createGitPackedObjectFixture(kind);
    t.after(() => fixture.dispose());
    const { commonDirectory, revision, tree } = fixture;
    assert.deepEqual(inspectGitCommitTree({ commonDirectory, revision }), {
      status: "candidate",
      commit: revision,
      tree,
      externalGitCliUsed: false,
      repositoryPathReported: false,
    });
    for (const file of fixture.files) {
      const read = readGitCommitFile({
        commonDirectory,
        revision,
        relativePath: file.name,
      });
      assert.equal(read?.status, "read");
      assert.equal(read?.relativePath, file.name);
      assert.equal(read?.mode, file.mode);
      assert.deepEqual(read?.bytes, file.bytes);
      assert.equal(
        read?.sha256,
        createHash("sha256").update(file.bytes).digest("hex"),
      );
      assert.equal(
        createHash("sha1")
          .update(`blob ${file.bytes.length}\0`)
          .update(read?.bytes ?? Buffer.alloc(0))
          .digest("hex"),
        file.id,
      );
    }
    const workspace = path.join(fixture.root, "workspace");
    fs.mkdirSync(workspace);
    const result = materializeProtectedGitCommitTreeCandidate({
      commonDirectory,
      revision,
      workspace,
      readPaths: [fixture.selected.name],
    });
    assert.equal(result?.status, "materialized");
    if (result?.status !== "materialized")
      assert.fail("pack materialization failed");
    assert.equal(result.baseCommit, revision);
    assert.equal(result.baseTree, tree);
    assert.equal(result.fileCount, 1);
    assert.equal(result.byteLength, fixture.selected.bytes.length);
    assert.deepEqual(fs.readdirSync(workspace), [fixture.selected.name]);
    assert.deepEqual(
      fs.readFileSync(path.join(workspace, fixture.selected.name)),
      fixture.selected.bytes,
    );
  });
}

for (const mutation of [
  "index-checksum",
  "pack-checksum",
  "reference",
  "offset",
  "integer",
  "base-size",
  "copy",
  "result-size",
  "object-id",
] as const) {
  /**
   * Git pack破損 ${mutation}は公開読取り・投影で拒否するを検証する。
   *
   * @responsibility Git pack破損 ${mutation}は公開読取り・投影で拒否するの合否判定を所有する。
   * @trace RFD-IT-012
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Git pack破損 ${mutation}は公開読取り・投影で拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`Git pack破損 ${mutation}は公開読取り・投影で拒否する`, {
    skip: process.platform !== "win32",
  }, (t) => {
    const fixture = createGitPackedObjectFixture(
      mutation === "offset" ? "ofs" : "ref",
    );
    t.after(() => fixture.dispose());
    const { commonDirectory, revision } = fixture;
    const request = {
      commonDirectory,
      revision,
      relativePath: fixture.selected.name,
    };
    assert.deepEqual(readGitCommitFile(request)?.bytes, fixture.selected.bytes);
    mutateGitPackedObjectFixture(fixture, mutation);
    const inspection = inspectGitCommitTree({
      commonDirectory,
      revision,
    });
    if (mutation === "index-checksum" || mutation === "pack-checksum") {
      assert.equal(inspection, null);
    } else {
      assert.equal(inspection?.status, "candidate");
      assert.equal(inspection?.tree, fixture.tree);
    }
    assert.equal(readGitCommitFile(request), null);
    const workspace = path.join(fixture.root, "workspace");
    fs.mkdirSync(workspace);
    assert.equal(
      materializeProtectedGitCommitTreeCandidate({
        commonDirectory,
        revision,
        workspace,
        readPaths: [fixture.selected.name],
      }),
      null,
    );
    assert.deepEqual(fs.readdirSync(workspace), []);
  });
}

/**
 * Repository-owned Git readerは外部Git CLIなしでCommitとTreeを照合するを検証する。
 *
 * @responsibility Repository-owned Git readerは外部Git CLIなしでCommitとTreeを照合するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository-owned Git readerは外部Git CLIなしでCommitとTreeを照合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Repository-owned Git readerは外部Git CLIなしでCommitとTreeを照合する", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  const layout = resolveRepositoryGitLayout(repositoryRoot);
  const repository = readRepositorySnapshot(
    getRepository(repositoryRoot).capability,
  );
  assert.equal(repository?.status, "observed");
  assert.equal(repository?.repositoryPathReported, false);
  assert.equal(repository?.repositoryForm, "primary");
  const exact = inspectGitCommitTree({
    commonDirectory: layout.commonDirectory.realPath,
    revision: repository?.revisionIdentity,
  });
  assert.equal(exact?.status, "candidate");
  assert.equal(exact?.commit, repository?.revisionIdentity);
  assert.equal(exact?.tree, repository?.snapshotIdentity);
  assert.equal(exact?.externalGitCliUsed, false);
  assert.equal(exact?.repositoryPathReported, false);
});

/**
 * 元操作の借用から固定Commitの本文へ接続し、借用が配置への書込みではないことを確認する。
 *
 * @responsibility 元操作・現在改訂・固定本文の相関と借用先へのEffect 0を確認する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 元操作へRepositoryを結合し、借用した改訂のREADMEを読む。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("元操作の借用から固定本文を読み隔離workspaceは変更しない", (t) => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  const owner = getRepository(repositoryRoot);
  assert.equal(owner.status, "completed");
  if (owner.status !== "completed") return;
  const tests = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataArea(owner.capability, "tests"),
    "projection_test_root_invalid",
  );
  const parent = fs.mkdtempSync(path.join(tests.directory, "object-current-"));
  const parentIdentity = fs.lstatSync(parent, { bigint: true });
  fs.mkdirSync(path.join(parent, ".git", "refs", "heads"), { recursive: true });
  fs.mkdirSync(path.join(parent, ".git", "info"));
  fs.writeFileSync(path.join(parent, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(parent, ".git", "refs", "heads", "main"),
    `${"1".repeat(40)}\n`,
  );
  fs.writeFileSync(
    path.join(parent, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(path.join(parent, ".git", "info", "exclude"), ".crdd/\n");
  const hostRepository = getRepository(parent);
  assert.equal(hostRepository.status, "completed");
  const owned = createOwnedOperationDirectories({
    root: hostRepository.capability,
    purpose: "task",
    recordingCurrent: () =>
      resolveVerifiedRepositoryRoot(hostRepository.capability) === parent,
  });
  t.after(() => {
    cleanupOwnedOperationDirectories(owned);
    const current = fs.lstatSync(parent, { bigint: true });
    assert.equal(current.isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(parent), parent);
    assert.equal(current.dev, parentIdentity.dev);
    assert.equal(current.ino, parentIdentity.ino);
    assert.equal(current.birthtimeNs, parentIdentity.birthtimeNs);
    assert.ok(owned.directories);
    assert.equal(fs.existsSync(owned.directories.root), false);
    fs.rmSync(parent, { recursive: true });
    assert.equal(fs.existsSync(parent), false);
  });
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const repository = bindRepositoryOperation(
    managementCapability,
    repositoryRoot,
  );
  assert.ok(repository);
  const source = borrowRepositorySource(
    repository.repositoryBindingCapability,
    managementCapability,
  );
  assert.ok(source);
  const binding = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  );
  const verified = getRepository(source.repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const before = fs.readdirSync(binding.mounts.workspace).sort();
  const read = readCommitFile(verified.capability, {
    commit: source.revision,
    path: "README.md",
  });
  assert.ok(read);
  assert.equal(read.revisionIdentity, repository.revision);
  assert.equal(read.bytes.toString("utf8").startsWith("# CRDD"), true);
  assert.equal(
    containsRecognizedSecretMaterial("README.md", read.bytes),
    false,
  );
  assert.deepEqual(fs.readdirSync(binding.mounts.workspace).sort(), before);
  assert.equal(
    fs.existsSync(path.join(binding.mounts.workspace, ".git")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(binding.mounts.workspace, "01_Principles.md")),
    false,
  );
});
