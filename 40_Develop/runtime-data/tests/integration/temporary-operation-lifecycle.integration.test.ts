import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createTemporaryOperation,
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
    });
    assert.equal(opened.status, "completed");
    if (opened.status !== "completed") continue;
    fs.writeFileSync(
      path.join(opened.workDirectory, "fixture.txt"),
      "fixture\n",
    );
    const settled = settleTemporaryOperation(opened.capability, outcome, true);
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
  const cleaned = settleTemporaryOperation(opened.capability, "failed", true);
  assert.equal(cleaned.status, "completed");
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
