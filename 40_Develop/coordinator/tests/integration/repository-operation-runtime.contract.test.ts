/**
 * coordinator:integration:repository-operation-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:repository-operation-runtimeが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @level IT
 * @scope repository、operation、runtime
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import test from "node:test";
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../../domain-model/src/storage/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../../domain-model/src/repository/index.ts";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
} from "../../src/host-runtime/execution-environment.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedCoordinatorStateRepository,
  describeRepositoryOperationRuntimeContract,
  inspectRepositoryObjectFormatCandidate,
  verifyRuntimeOwnedRepositoryBindingCapability,
  verifyRuntimeOwnedRepositoryOperation,
} from "../../src/repository-operation/repository-operation-runtime.ts";

const firstRevision = "1".repeat(40);
const secondRevision = "2".repeat(40);

/**
 * Coordinator保存先の内部借用を実Repositoryと操作Ownerへ結合する。
 * @responsibility 保存先の一致、公開Path非開示、Owner終了後の失効を確認する。
 * @trace PRL-IT-012
 * @precondition 現在Repository内の試験一時領域だけを使用する。
 * @stimulus 保存先を借用し、操作Ownerを終了して再検証する。
 * @observation Root、Identity、再検証結果と公開結果を観測する。
 * @oracle 借用は同じRepositoryだけを返し、終了後は拒否される。
 * @cleanup 所有操作の一時領域を終了時に回収する。
 * @boundary PRL-IT-012=Direct Boundary: Repository Operation Owner→Coordinator保存先。
 */
test("Coordinator保存先借用は現在Repositoryと有効Ownerだけに結合する", (t) => {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "coordinator_state_test_root_invalid",
  );
  const owned = createOwnedOperationDirectories(area.directory);
  let cleaned = false;
  t.after(() => {
    if (!cleaned) cleanupOwnedOperationDirectories(owned);
  });
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  const root = path.resolve(import.meta.dirname, "../../../..");
  assert.ok(bindRuntimeOwnedRepositoryOperation(management, root));
  assert.equal(borrowRuntimeOwnedCoordinatorStateRepository({}), null);
  const borrowed = borrowRuntimeOwnedCoordinatorStateRepository(management);
  assert.ok(borrowed);
  assert.equal(borrowed.repositoryRoot, fs.realpathSync.native(root));
  assert.ok(borrowed.logicalRepositoryIdentity);
  assert.ok(borrowed.repositoryInstanceIdentity);
  assert.equal(Object.isFrozen(borrowed), true);
  assert.equal(borrowed.revalidate(), true);
  const publicResult = verifyRuntimeOwnedRepositoryOperation(management);
  assert.ok(publicResult);
  assert.equal("repositoryRoot" in publicResult, false);
  cleanupOwnedOperationDirectories(owned);
  cleaned = true;
  assert.equal(borrowed.revalidate(), false);
  assert.equal(borrowRuntimeOwnedCoordinatorStateRepository(management), null);
});

/**
 * temporaryRepositoryのTest準備責務を実行する。
 *
 * @responsibility temporaryRepositoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus temporaryRepositoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function temporaryRepository(t: TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-operation-repository-"),
  );
  const git = path.join(root, ".git");
  fs.mkdirSync(path.join(git, "info"), { recursive: true });
  fs.mkdirSync(path.join(git, "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(git, "refs", "heads", "main"),
    `${firstRevision}\n`,
    "utf8",
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/**
 * linkedRepositoryのTest準備責務を実行する。
 *
 * @responsibility linkedRepositoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus linkedRepositoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function linkedRepository(t: TestContext) {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-operation-linked-repository-"),
  );
  const root = path.join(parent, "linked");
  const commonGitDirectory = path.join(parent, "main.git");
  const git = path.join(commonGitDirectory, "worktrees", "linked");
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(commonGitDirectory, "refs", "heads"), {
    recursive: true,
  });
  fs.mkdirSync(git, { recursive: true });
  fs.writeFileSync(path.join(root, ".git"), `gitdir: ${git}\n`, "utf8");
  fs.writeFileSync(path.join(git, "commondir"), "../..\n", "utf8");
  fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(
    path.join(commonGitDirectory, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(commonGitDirectory, "refs", "heads", "main"),
    `${firstRevision}\n`,
    "utf8",
  );
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return { root, commonGitDirectory };
}

/**
 * operationのTest準備責務を実行する。
 *
 * @responsibility operationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus operationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function operation(t: TestContext) {
  const owned = createOwnedOperationDirectories();
  t.after(() => cleanupOwnedOperationDirectories(owned));
  const context = createOwnedOperationContextCapability(owned);
  const mount = createOwnedMountCapability(owned);
  return createOwnedOperationManagementCapability(context, mount);
}

/**
 * Repository実体と開始Revisionをopaque capabilityへ固定して再照合するを検証する。
 *
 * @responsibility Repository実体と開始Revisionをopaque capabilityへ固定して再照合するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository実体と開始Revisionをopaque capabilityへ固定して再照合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Repository実体と開始Revisionをopaque capabilityへ固定して再照合する", (t) => {
  const repository = temporaryRepository(t);
  const management = operation(t);
  const bound = bindRuntimeOwnedRepositoryOperation(management, repository);
  assert.ok(bound);
  assert.equal(bound.revision, firstRevision);
  assert.equal(bound.repositoryBound, true);
  assert.equal(bound.pathReported, false);
  assert.deepEqual(verifyRuntimeOwnedRepositoryOperation(management), {
    operationId: bound.operationId,
    revision: firstRevision,
    repositoryBound: true,
    revisionCurrent: true,
  });
  assert.deepEqual(
    verifyRuntimeOwnedRepositoryBindingCapability(
      bound.repositoryBindingCapability,
      management,
    ),
    {
      operationId: bound.operationId,
      revision: firstRevision,
      repositoryBound: true,
      revisionCurrent: true,
    },
  );
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(management, repository),
    null,
  );
  assert.equal(
    verifyRuntimeOwnedRepositoryBindingCapability(
      Object.freeze({}),
      management,
    ),
    null,
  );
});

/**
 * 開始後にHEAD参照先が変わればEffectと結果公開の双方で失効するを検証する。
 *
 * @responsibility 開始後にHEAD参照先が変わればEffectと結果公開の双方で失効するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開始後にHEAD参照先が変わればEffectと結果公開の双方で失効するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("開始後にHEAD参照先が変わればEffectと結果公開の双方で失効する", (t) => {
  const repository = temporaryRepository(t);
  const management = operation(t);
  const bound = bindRuntimeOwnedRepositoryOperation(management, repository);
  assert.ok(bound);
  fs.writeFileSync(
    path.join(repository, ".git", "refs", "heads", "main"),
    `${secondRevision}\n`,
    "utf8",
  );
  assert.equal(verifyRuntimeOwnedRepositoryOperation(management), null);
  assert.equal(
    verifyRuntimeOwnedRepositoryBindingCapability(
      bound.repositoryBindingCapability,
      management,
    ),
    null,
  );
});

/**
 * detached HEADとpacked refを限定形式で解決し不正入力を拒否するを検証する。
 *
 * @responsibility detached HEADとpacked refを限定形式で解決し不正入力を拒否するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus detached HEADとpacked refを限定形式で解決し不正入力を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("detached HEADとpacked refを限定形式で解決し不正入力を拒否する", (t) => {
  const detached = temporaryRepository(t);
  fs.writeFileSync(
    path.join(detached, ".git", "HEAD"),
    `${firstRevision}\n`,
    "utf8",
  );
  const detachedManagement = operation(t);
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(detachedManagement, detached)?.revision,
    firstRevision,
  );

  const packed = temporaryRepository(t);
  fs.rmSync(path.join(packed, ".git", "refs", "heads", "main"));
  fs.writeFileSync(
    path.join(packed, ".git", "packed-refs"),
    `# pack-refs with: peeled fully-peeled sorted\n${secondRevision} refs/heads/main\n`,
    "utf8",
  );
  const packedManagement = operation(t);
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(packedManagement, packed)?.revision,
    secondRevision,
  );

  assert.equal(
    bindRuntimeOwnedRepositoryOperation(Object.freeze({}), packed),
    null,
  );
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(packedManagement, "relative"),
    null,
  );
});

/**
 * SHA-256 RepositoryはOperation capability発行前の専用preflightで拒否するを検証する。
 *
 * @responsibility SHA-256 RepositoryはOperation capability発行前の専用preflightで拒否するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus SHA-256 RepositoryはOperation capability発行前の専用preflightで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("SHA-256 RepositoryはOperation capability発行前の専用preflightで拒否する", (t) => {
  const repository = temporaryRepository(t);
  const revision = "a".repeat(64);
  fs.writeFileSync(
    path.join(repository, ".git", "refs", "heads", "main"),
    `${revision}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(repository, ".git", "config"),
    "[core]\n\trepositoryformatversion = 1\n\tbare = false\n[extensions]\n\tobjectformat = sha256\n",
    "utf8",
  );
  assert.deepEqual(inspectRepositoryObjectFormatCandidate(repository), {
    status: "candidate",
    objectFormat: "sha256",
    runtimeSupported: false,
    revisionReported: false,
    repositoryPathReported: false,
  });
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(operation(t), repository),
    null,
  );
});

/**
 * 宣言Object Formatとdetached／loose／packed Revision幅の不一致をpreflightで拒否するを検証する。
 *
 * @responsibility 宣言Object Formatとdetached／loose／packed Revision幅の不一致をpreflightで拒否するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 宣言Object Formatとdetached／loose／packed Revision幅の不一致をpreflightで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("宣言Object Formatとdetached／loose／packed Revision幅の不一致をpreflightで拒否する", (t) => {
  const detached = temporaryRepository(t);
  fs.writeFileSync(
    path.join(detached, ".git", "HEAD"),
    `${"a".repeat(64)}\n`,
    "utf8",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(detached), null);

  const loose = temporaryRepository(t);
  fs.writeFileSync(
    path.join(loose, ".git", "refs", "heads", "main"),
    `${"b".repeat(64)}\n`,
    "utf8",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(loose), null);

  const packed = temporaryRepository(t);
  fs.rmSync(path.join(packed, ".git", "refs", "heads", "main"));
  fs.writeFileSync(
    path.join(packed, ".git", "packed-refs"),
    `${"c".repeat(64)} refs/heads/main\n`,
    "utf8",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(packed), null);

  const sha256WithSha1Revision = temporaryRepository(t);
  fs.writeFileSync(
    path.join(sha256WithSha1Revision, ".git", "HEAD"),
    `${firstRevision}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(sha256WithSha1Revision, ".git", "config"),
    "[core]\n\trepositoryformatversion = 1\n\tbare = false\n[extensions]\n\tobjectformat = sha256\n",
    "utf8",
  );
  assert.equal(
    inspectRepositoryObjectFormatCandidate(sha256WithSha1Revision),
    null,
  );
});

/**
 * loose refの中間junctionと最終symlinkをRepository境界外としてpreflightで拒否するを検証する。
 *
 * @responsibility loose refの中間junctionと最終symlinkをRepository境界外としてpreflightで拒否するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus loose refの中間junctionと最終symlinkをRepository境界外としてpreflightで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("loose refの中間junctionと最終symlinkをRepository境界外としてpreflightで拒否する", (t) => {
  for (const linkedSegment of ["refs", "refs/heads"] as const) {
    const repository = temporaryRepository(t);
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-operation-external-ref-"),
    );
    t.after(() => fs.rmSync(external, { recursive: true, force: true }));
    const link = path.join(repository, ".git", ...linkedSegment.split("/"));
    fs.rmSync(link, { recursive: true, force: true });
    const destination =
      linkedSegment === "refs"
        ? path.join(external, "refs")
        : path.join(external, "heads");
    fs.mkdirSync(
      linkedSegment === "refs" ? path.join(destination, "heads") : destination,
      { recursive: true },
    );
    fs.writeFileSync(
      linkedSegment === "refs"
        ? path.join(destination, "heads", "main")
        : path.join(destination, "main"),
      `${firstRevision}\n`,
      "utf8",
    );
    fs.symlinkSync(
      destination,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(inspectRepositoryObjectFormatCandidate(repository), null);
  }

  const repository = temporaryRepository(t);
  const externalFile = path.join(repository, "external-main");
  fs.writeFileSync(externalFile, `${firstRevision}\n`, "utf8");
  const ref = path.join(repository, ".git", "refs", "heads", "main");
  fs.rmSync(ref);
  fs.symlinkSync(externalFile, ref, "file");
  assert.equal(inspectRepositoryObjectFormatCandidate(repository), null);
});

/**
 * linked worktreeのCommon Git Directoryでもloose ref junctionをpreflightで拒否するを検証する。
 *
 * @responsibility linked worktreeのCommon Git Directoryでもloose ref junctionをpreflightで拒否するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus linked worktreeのCommon Git Directoryでもloose ref junctionをpreflightで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("linked worktreeのCommon Git Directoryでもloose ref junctionをpreflightで拒否する", (t) => {
  const repository = linkedRepository(t);
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-operation-linked-external-ref-"),
  );
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, "main"), `${firstRevision}\n`, "utf8");
  const heads = path.join(repository.commonGitDirectory, "refs", "heads");
  fs.rmSync(heads, { recursive: true, force: true });
  fs.symlinkSync(
    external,
    heads,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(repository.root), null);
});

/**
 * 公開契約はcaller supplied identityを採用せずPathを返さないを検証する。
 *
 * @responsibility 公開契約はcaller supplied identityを採用せずPathを返さないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はcaller supplied identityを採用せずPathを返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開契約はcaller supplied identityを採用せずPathを返さない", () => {
  const contract = describeRepositoryOperationRuntimeContract();
  assert.equal(contract.contractRevision, 2);
  assert.equal(contract.callerRevisionAccepted, false);
  assert.equal(contract.pathReported, false);
  assert.equal(contract.providerEffectAllowed, false);
  assert.deepEqual(contract.runtimeSupportedObjectFormats, ["sha1"]);
  assert.match(contract.revision, /reobserved_before_effect_and_result/u);
});
