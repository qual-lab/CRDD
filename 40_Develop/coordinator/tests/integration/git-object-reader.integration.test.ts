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
  inspectGitCommitTree,
  copyGitCommitTree,
  readGitCommitFile,
} from "../../../version-control/src/git/objects.ts";
import {
  copyCommitFiles,
  readRepositorySnapshot,
} from "../../../version-control/src/index.ts";
import { resolveRepositoryGitLayout } from "../../../version-control/src/repository/layout.ts";
import { getRepository } from "../../../version-control/src/repository/location.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  verifyOwnedOperationManagementMountBinding,
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedRepositorySource,
} from "../../src/execution/operation.ts";
import { containsRecognizedSecretMaterial } from "../../src/input/secret-validation.ts";
import {
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
} from "../../src/configuration/runtime-data.ts";
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
 * 現行CRDDのpacked objectから明示Read Projectionだけを隔離workspaceへ再構成するを検証する。
 *
 * @responsibility 現行CRDDのpacked objectから明示Read Projectionだけを隔離workspaceへ再構成するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 現行CRDDのpacked objectから明示Read Projectionだけを隔離workspaceへ再構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("現行CRDDのpacked objectから明示Read Projectionだけを隔離workspaceへ再構成する", (t) => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  const owner = getRepository(repositoryRoot);
  assert.equal(owner.status, "completed");
  if (owner.status !== "completed") return;
  const tests = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(owner.capability, "tests"),
    "projection_test_root_invalid",
  );
  const parent = fs.mkdtempSync(path.join(tests.directory, "object-current-"));
  const parentIdentity = fs.lstatSync(parent, { bigint: true });
  let owned: unknown = null;
  let recoveryIdentity: fs.BigIntStats | null = null;
  t.after(() => {
    if (owned !== null) cleanupOwnedOperationDirectories(owned);
    const current = fs.lstatSync(parent, { bigint: true });
    assert.equal(current.isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(parent), parent);
    assert.equal(current.dev, parentIdentity.dev);
    assert.equal(current.ino, parentIdentity.ino);
    assert.equal(current.birthtimeNs, parentIdentity.birthtimeNs);
    for (const entry of fs.readdirSync(parent)) {
      assert.equal(entry, "crdd-coordinator-recovery-v1");
      const recovery = path.join(parent, entry);
      const metadata = fs.lstatSync(recovery, { bigint: true });
      assert.ok(recoveryIdentity);
      assert.equal(metadata.isSymbolicLink(), false);
      assert.equal(metadata.dev, recoveryIdentity.dev);
      assert.equal(metadata.ino, recoveryIdentity.ino);
      assert.equal(metadata.birthtimeNs, recoveryIdentity.birthtimeNs);
      assert.equal(fs.realpathSync.native(recovery), recovery);
      assert.deepEqual(fs.readdirSync(recovery), []);
      fs.rmdirSync(recovery);
    }
    fs.rmdirSync(parent);
    assert.equal(fs.existsSync(parent), false);
  });
  owned = createOwnedOperationDirectories(parent);
  recoveryIdentity = fs.lstatSync(
    path.join(parent, "crdd-coordinator-recovery-v1"),
    { bigint: true },
  );
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const repository = bindRuntimeOwnedRepositoryOperation(
    managementCapability,
    repositoryRoot,
  );
  assert.ok(repository);
  const source = borrowRuntimeOwnedRepositorySource(
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
  const materialized = copyCommitFiles(verified.capability, {
    commit: source.revision,
    outputRepository: verified.capability,
    relativeDirectory: path
      .relative(repositoryRoot, binding.mounts.workspace)
      .split(path.sep)
      .join("/"),
    paths: ["README.md"],
    inspectContent: containsRecognizedSecretMaterial,
  });
  assert.equal(materialized?.status, "materialized");
  assert.equal(materialized?.baseRevisionIdentity, repository.revision);
  assert.equal(materialized?.fileCount, 1);
  assert.equal(
    fs
      .readFileSync(path.join(binding.mounts.workspace, "README.md"), "utf8")
      .startsWith("# CRDD"),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(binding.mounts.workspace, ".git")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(binding.mounts.workspace, "01_Principles.md")),
    false,
  );
});
