import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createTemporaryOperation,
  resolveRepositoryRuntimeDataPaths,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  verifyRepositoryRoot,
} from "../../src/index.ts";

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
    const settled = settleTemporaryOperation(opened.capability, outcome, false);
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
    purpose: "parent loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(
    opened.capability,
    "parent_lost",
    false,
  );
  assert.equal(lost.status, "blocked");
  assert.equal(lost.recoveryReference?.operationId, operationId);
  assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), true);
  assert.equal(
    settleTemporaryOperation(opened.capability, "failed", false).reason,
    "temporary_operation_capability_invalid",
  );
  assert.ok(opened.recoveryReference);
  const resumed = resumeTemporaryOperation(
    root.capability,
    opened.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  const cleaned = settleTemporaryOperation(resumed.capability, "failed", false);
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
    settleTemporaryOperation(opened.capability, "failed", false).status,
    "completed",
  );
});

test("Evidence未昇格ではtmpを削除しない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-evidence-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    purpose: "evidence promotion verification",
    allowedContent: ["fixture"],
    evidencePromotion: "required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const blocked = settleTemporaryOperation(
    opened.capability,
    "completed",
    false,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), true);
  assert.equal(
    settleTemporaryOperation(opened.capability, "completed", true).status,
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
