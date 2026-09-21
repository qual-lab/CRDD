/**
 * runtime-data:integration:temporary-operation-lifecycleの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility runtime-data:integration:temporary-operation-lifecycleが所有する検証責務を実行する。
 * @trace RDL-IT-001
 * @level IT
 * @scope runtime-data、temporary、lifecycle、cleanup、recovery
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createTemporaryOperation,
  resolveRepositoryRuntimeDataPaths,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  type TemporaryOperationRecoveryReference,
  verifyTemporaryOperationEvidencePromotion,
} from "../../src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { settleTemporaryOperationWithRemovalForVerification } from "../../src/store/temporary-operation-store.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * resumeWithNextIdentityのTest準備責務を実行する。
 *
 * @responsibility resumeWithNextIdentityがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resumeWithNextIdentityを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
function resumeWithNextIdentity(
  capability: Parameters<typeof resumeTemporaryOperation>[0],
  reference: TemporaryOperationRecoveryReference,
  nextIdentity = randomUUID(),
) {
  return resumeTemporaryOperation(capability, reference, nextIdentity);
}

/**
 * tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認するを検証する。
 *
 * @responsibility tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  for (const outcome of [
    "completed",
    "failed",
    "cancelled",
    "timed_out",
  ] as const) {
    const operationId = `runtime-data-test-${outcome}-${process.pid}`;
    const opened = createTemporaryOperation(root.capability, {
      operationId,
      owner: "runtime-data-test",
      identity: randomUUID(),
      purpose: "temporary lifecycle verification",
      allowedContent: ["fixture"],
      evidencePromotion: "not_required",
    });
    assert.equal(opened.status, "completed");
    if (opened.status !== "completed") continue;
    fs.writeFileSync(
      path.join(opened.workDirectory, "fixture.txt"),
      "fixture\n",
    );
    const settled = settleTemporaryOperation(opened.capability, outcome, null);
    assert.equal(settled.status, "completed");
    assert.equal(settled.cleanupConfirmed, true);
    assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), false);
  }
});

/**
 * 親Process喪失はexact Recovery参照を返し物理残存を削除しないを検証する。
 *
 * @responsibility 親Process喪失はexact Recovery参照を返し物理残存を削除しないの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 親Process喪失はexact Recovery参照を返し物理残存を削除しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("親Process喪失はexact Recovery参照を返し物理残存を削除しない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-parent-lost-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "parent loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.equal(lost.status, "blocked");
  assert.equal(lost.recoveryReference?.operationId, operationId);
  assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), true);
  assert.equal(
    settleTemporaryOperation(opened.capability, "failed", null).reason,
    "temporary_operation_capability_invalid",
  );
  assert.ok(opened.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    opened.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    resumeWithNextIdentity(root.capability, opened.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const cleaned = settleTemporaryOperation(resumed.capability, "failed", null);
  assert.equal(cleaned.status, "completed");
});

/**
 * 再入場はexact Recovery Identity以外をEffect前に拒否するを検証する。
 *
 * @responsibility 再入場はexact Recovery Identity以外をEffect前に拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 再入場はexact Recovery Identity以外をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("再入場はexact Recovery Identity以外をEffect前に拒否する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-identity-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "recovery identity verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  assert.ok(opened.recoveryReference);
  assert.equal(
    resumeWithNextIdentity(root.capability, {
      ...opened.recoveryReference,
      identity: "different-identity",
    }).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  assert.equal(
    settleTemporaryOperation(opened.capability, "failed", null).status,
    "completed",
  );
});

/**
 * Evidence未昇格ではtmpを削除しないを検証する。
 *
 * @responsibility Evidence未昇格ではtmpを削除しないの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Evidence未昇格ではtmpを削除しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("Evidence未昇格ではtmpを削除しない", (t) => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-evidence-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "evidence promotion verification",
    allowedContent: ["fixture"],
    evidencePromotion: "required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const blocked = settleTemporaryOperation(
    opened.capability,
    "completed",
    null,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), true);
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);
  const artifactDirectory = path.join(
    paths.verification,
    operationId,
    "artifacts",
  );
  t.after(() => {
    fs.rmSync(path.join(paths.verification, operationId), {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.join(paths.temporary, operationId), {
      recursive: true,
      force: true,
    });
  });
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const artifact = path.join(artifactDirectory, "fixture");
  fs.writeFileSync(artifact, "promoted\n");
  const unrelated = verifyTemporaryOperationEvidencePromotion(
    root.capability,
    opened.capability,
    {
      recordId: operationId,
      artifactName: "fixture",
      sha256:
        "832d7e61059cd7375f9bec232c07f3d8deeab5687279bd589e3b9bf4ad758055",
    },
  );
  assert.equal(unrelated.status, "blocked");
  fs.writeFileSync(path.join(opened.workDirectory, "fixture"), "promoted\n");
  const promoted = verifyTemporaryOperationEvidencePromotion(
    root.capability,
    opened.capability,
    {
      recordId: operationId,
      artifactName: "fixture",
      sha256:
        "832d7e61059cd7375f9bec232c07f3d8deeab5687279bd589e3b9bf4ad758055",
    },
  );
  assert.equal(promoted.status, "completed");
  if (promoted.status === "completed") {
    fs.writeFileSync(artifact, "changed\n");
    assert.equal(
      settleTemporaryOperation(opened.capability, "completed", promoted.receipt)
        .reason,
      "temporary_operation_evidence_not_promoted",
    );
    fs.writeFileSync(artifact, "promoted\n");
    assert.equal(
      settleTemporaryOperation(opened.capability, "completed", promoted.receipt)
        .status,
      "completed",
    );
  }
});

/**
 * cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できるを検証する。
 *
 * @responsibility cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できるの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-cleanup-recovery-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "cleanup failure recovery verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const failed = settleTemporaryOperationWithRemovalForVerification(
    opened.capability,
    "failed",
    null,
    (directory) => {
      fs.rmSync(path.join(directory, "work"), { recursive: true });
      throw new Error("injected_remove_failure");
    },
  );
  assert.equal(failed.status, "blocked");
  assert.equal(failed.recoveryRequired, true);
  assert.ok(failed.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    failed.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    resumeWithNextIdentity(root.capability, failed.recoveryReference).status,
    "blocked",
  );
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収するを検証する。
 *
 * @responsibility Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-lock-recovery-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "lock cleanup recovery verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const failed = settleTemporaryOperationWithRemovalForVerification(
    opened.capability,
    "failed",
    null,
    (directory) => fs.rmSync(directory, { recursive: true }),
    () => {
      throw new Error("injected_lock_remove_failure");
    },
  );
  assert.equal(failed.status, "blocked");
  assert.equal(failed.reason, "temporary_operation_lock_cleanup_unconfirmed");
  assert.equal(failed.recoveryRequired, true);
  assert.ok(failed.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    failed.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * 初回Capability返却前に終了したpreparing世代は既知参照から回復できるを検証する。
 *
 * @responsibility 初回Capability返却前に終了したpreparing世代は既知参照から回復できるの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 初回Capability返却前に終了したpreparing世代は既知参照から回復できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("初回Capability返却前に終了したpreparing世代は既知参照から回復できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-process-loss-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-control",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  assert.equal(child.stdout, "");
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const resumed = resumeWithNextIdentity(root.capability, reference);
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * Canonical公開前に終了した初回stagingは既知参照から回復できるを検証する。
 *
 * @responsibility Canonical公開前に終了した初回stagingは既知参照から回復できるの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Canonical公開前に終了した初回stagingは既知参照から回復できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("Canonical公開前に終了した初回stagingは既知参照から回復できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-prepublish-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-staging",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const resumed = resumeWithNextIdentity(root.capability, reference);
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収するを検証する。
 *
 * @responsibility Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-linked-staging-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-staging-linked",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);
  if (!paths) return;
  const stagingDocumentPath = path.join(
    paths.temporary,
    ".operations",
    ".staging",
    `${operationId}.${identity}.1.preparing.json`,
  );
  assert.equal(fs.existsSync(stagingDocumentPath), true);
  const resumed = resumeWithNextIdentity(root.capability, reference);
  assert.equal(resumed.status, "completed");
  assert.equal(fs.existsSync(stagingDocumentPath), false);
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 初回staging書込み中のProcess死はexact stagingだけを不存在へ戻すを検証する。
 *
 * @responsibility 初回staging書込み中のProcess死はexact stagingだけを不存在へ戻すの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 初回staging書込み中のProcess死はexact stagingだけを不存在へ戻すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("初回staging書込み中のProcess死はexact stagingだけを不存在へ戻す", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-partial-staging-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-staging-created",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const cleaned = resumeWithNextIdentity(root.capability, reference);
  assert.equal(
    cleaned.reason,
    "temporary_operation_prepublication_cleanup_confirmed",
  );
  assert.equal(cleaned.cleanupConfirmed, true);
  const reopened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "replacement after partial staging cleanup",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(reopened.status, "completed");
  if (reopened.status === "completed")
    assert.equal(
      settleTemporaryOperation(reopened.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Lock公開前のProcess死はcaller-known Identityで再入場できるを検証する。
 *
 * @responsibility Lock公開前のProcess死はcaller-known Identityで再入場できるの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock公開前のProcess死はcaller-known Identityで再入場できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("Lock公開前のProcess死はcaller-known Identityで再入場できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-lock-prepublish-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "lock prepublication process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-lock-staging",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
    nextIdentity,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収するを検証する。
 *
 * @responsibility Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-lock-linked-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "linked lock process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-lock-linked",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
    nextIdentity,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Lock staging書込み中のProcess死も同じ次世代Identityで回収するを検証する。
 *
 * @responsibility Lock staging書込み中のProcess死も同じ次世代Identityで回収するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock staging書込み中のProcess死も同じ次世代Identityで回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("Lock staging書込み中のProcess死も同じ次世代Identityで回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-lock-partial-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "partial lock staging process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-lock-staging-created",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
    nextIdentity,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 返却済み新世代の実Process死後も使用済み旧参照を拒否するを検証する。
 *
 * @responsibility 返却済み新世代の実Process死後も使用済み旧参照を拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 返却済み新世代の実Process死後も使用済み旧参照を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("返却済み新世代の実Process死後も使用済み旧参照を拒否する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-resume-crash-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "resumed process crash verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-return",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 0, child.stderr);
  const nextReference = JSON.parse(
    child.stdout.trim(),
  ) as TemporaryOperationRecoveryReference;
  assert.equal(
    resumeWithNextIdentity(root.capability, lost.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const resumed = resumeWithNextIdentity(root.capability, nextReference);
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できるを検証する。
 *
 * @responsibility 新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できるの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-resume-prereturn-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "resume pre-return process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "before-return",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const nextReference: TemporaryOperationRecoveryReference = Object.freeze({
    ...lost.recoveryReference,
    identity: nextIdentity,
    generation: lost.recoveryReference.generation + 1,
  });
  assert.equal(
    resumeWithNextIdentity(root.capability, lost.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const resumed = resumeWithNextIdentity(root.capability, nextReference);
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 使用済みの旧世代Recovery参照は後続の親喪失後も再利用できないを検証する。
 *
 * @responsibility 使用済みの旧世代Recovery参照は後続の親喪失後も再利用できないの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 使用済みの旧世代Recovery参照は後続の親喪失後も再利用できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("使用済みの旧世代Recovery参照は後続の親喪失後も再利用できない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-old-reference-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "single use recovery reference verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const firstLost = settleTemporaryOperation(
    opened.capability,
    "parent_lost",
    null,
  );
  assert.ok(firstLost.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    firstLost.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  const secondLost = settleTemporaryOperation(
    resumed.capability,
    "parent_lost",
    null,
  );
  assert.ok(secondLost.recoveryReference);
  assert.equal(
    resumeWithNextIdentity(root.capability, firstLost.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const finalResume = resumeWithNextIdentity(
    root.capability,
    secondLost.recoveryReference,
  );
  assert.equal(finalResume.status, "completed");
  if (finalResume.status === "completed")
    assert.equal(
      settleTemporaryOperation(finalResume.capability, "failed", null).status,
      "completed",
    );
});

/**
 * active中の再入場・stale Capability・不正な終端値を拒否するを検証する。
 *
 * @responsibility active中の再入場・stale Capability・不正な終端値を拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus active中の再入場・stale Capability・不正な終端値を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("active中の再入場・stale Capability・不正な終端値を拒否する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-owner-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "single active owner verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  assert.equal(
    resumeWithNextIdentity(root.capability, opened.recoveryReference).reason,
    "temporary_operation_recovery_not_required",
  );
  assert.equal(
    settleTemporaryOperation(opened.capability, "other" as never, null).reason,
    "temporary_operation_outcome_invalid",
  );
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.equal(lost.status, "blocked");
  assert.ok(lost.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(opened.capability, "failed", null).reason,
    "temporary_operation_capability_invalid",
  );
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * 既存Operationとの衝突では既存内容を削除せず内部Pathも返さないを検証する。
 *
 * @responsibility 既存Operationとの衝突では既存内容を削除せず内部Pathも返さないの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既存Operationとの衝突では既存内容を削除せず内部Pathも返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
test("既存Operationとの衝突では既存内容を削除せず内部Pathも返さない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);
  const operationId = `runtime-data-test-collision-${process.pid}`;
  const directory = path.join(paths.temporary, operationId);
  const sentinel = path.join(directory, "sentinel.txt");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(sentinel, "preserve\n");
  try {
    const blocked = createTemporaryOperation(root.capability, {
      operationId,
      owner: "runtime-data-test",
      identity: randomUUID(),
      purpose: "collision verification",
      allowedContent: ["fixture"],
      evidencePromotion: "not_required",
    });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "temporary_operation_creation_failed");
    assert.equal(blocked.cleanupConfirmed, true);
    assert.equal(blocked.recoveryRequired, false);
    assert.equal(blocked.recoveryReference, null);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve\n");
    assert.equal(JSON.stringify(blocked).includes(repositoryRoot), false);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
