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
  verifyRepositoryRoot,
} from "../../src/index.ts";
import { settleTemporaryOperationWithRemovalForVerification } from "../../src/store/temporary-operation-store.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

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
  const resumed = resumeTemporaryOperation(
    root.capability,
    opened.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    resumeTemporaryOperation(root.capability, opened.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const cleaned = settleTemporaryOperation(resumed.capability, "failed", null);
  assert.equal(cleaned.status, "completed");
});

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
    resumeTemporaryOperation(root.capability, {
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
  const resumed = resumeTemporaryOperation(
    root.capability,
    failed.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    resumeTemporaryOperation(root.capability, failed.recoveryReference).status,
    "blocked",
  );
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

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
  const resumed = resumeTemporaryOperation(
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
  const resumed = resumeTemporaryOperation(root.capability, reference);
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

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
  const resumed = resumeTemporaryOperation(
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
    resumeTemporaryOperation(root.capability, firstLost.recoveryReference)
      .reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const finalResume = resumeTemporaryOperation(
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
    resumeTemporaryOperation(root.capability, opened.recoveryReference).reason,
    "temporary_operation_recovery_not_required",
  );
  assert.equal(
    settleTemporaryOperation(opened.capability, "other" as never, null).reason,
    "temporary_operation_outcome_invalid",
  );
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.equal(lost.status, "blocked");
  assert.ok(lost.recoveryReference);
  const resumed = resumeTemporaryOperation(
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
