/**
 * runtime-data:system:temporary-operation-cleanupの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 公開Runtime Data APIを利用するTool相当の呼出しから、保持判定、清掃、回復保護および最終不存在を検証する。
 * @trace RDL-ST-002
 * @level ST
 * @scope runtime-data、temporary-operation、cleanup、recovery、public-api
 * @boundary RDL-ST-002=System/E2E: Tool相当Consumer→公開Runtime Data API→Filesystem cleanup→不存在観測
 */
import assert from "node:assert/strict";
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
} from "../../src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * 公開Runtime Data APIで一時Operationを再開する。
 *
 * @responsibility Test Caseが固定した回復参照を新しい所有世代へ一度だけ移す。
 * @trace RDL-ST-002
 * @precondition 参照は同じOperationが返したexact Recovery Identityである。
 * @stimulus 公開resumeTemporaryOperationへ新しいIdentityを渡す。
 * @observation 再開結果と新しいCapabilityを取得する。
 * @oracle 一致する参照だけがcompletedになる。
 * @cleanup 呼出し元Test Caseが再開後のOperationをsettleする。
 * @boundary RDL-ST-002=System/E2E: Tool相当Consumer→公開Runtime Data API
 */
function resume(
  capability: Parameters<typeof resumeTemporaryOperation>[0],
  reference: TemporaryOperationRecoveryReference,
) {
  return resumeTemporaryOperation(capability, reference, randomUUID());
}

/**
 * 終了理由ごとに対象だけを清掃し、回復対象は義務解消まで保持する。
 *
 * @responsibility 一時Operationの正常・取消・Timeout・親Process喪失を公開API経由で処置し、別所有物の非削除と最終不存在を確認する。
 * @trace RDL-ST-002
 * @precondition 検証済みRepository Root直下のRepository-local tmpを使用する。
 * @stimulus 複数Operationを作成し、completed、cancelled、timed_out、parent_lostで終了させ、保持対象だけをexact参照で再開する。
 * @observation 各Operation Directoryの存在、清掃結果、回復参照および最終不存在を観測する。
 * @oracle 清掃可能な対象だけが直ちに不存在となり、回復対象は別Operationの清掃で削除されず、回復完了後に不存在となる。
 * @cleanup after hookが失敗時にも本Test固有Directoryだけを削除する。
 * @boundary RDL-ST-002=System/E2E: Tool相当Consumer→保持判定→Filesystem cleanup→不存在観測
 */
test("終了理由ごとに対象だけを清掃し、回復対象は義務解消まで保持する", (t) => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);

  const prefix = `runtime-data-system-${process.pid}-${randomUUID()}`;
  const operationDirectories: string[] = [];
  t.after(() => {
    for (const directory of operationDirectories)
      fs.rmSync(directory, { recursive: true, force: true });
  });

  const protectedOperation = createTemporaryOperation(root.capability, {
    operationId: `${prefix}-recovery`,
    owner: "runtime-data-system-test",
    identity: randomUUID(),
    purpose: "public cleanup and recovery lifecycle verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(protectedOperation.status, "completed");
  if (protectedOperation.status !== "completed") return;
  const protectedDirectory = path.dirname(protectedOperation.workDirectory);
  operationDirectories.push(protectedDirectory);
  fs.writeFileSync(
    path.join(protectedOperation.workDirectory, "fixture"),
    "protected\n",
  );
  const retained = settleTemporaryOperation(
    protectedOperation.capability,
    "parent_lost",
    null,
  );
  assert.equal(retained.status, "blocked");
  assert.equal(retained.recoveryRequired, true);
  assert.ok(retained.recoveryReference);
  assert.equal(fs.existsSync(protectedDirectory), true);

  for (const outcome of ["completed", "cancelled", "timed_out"] as const) {
    const operation = createTemporaryOperation(root.capability, {
      operationId: `${prefix}-${outcome}`,
      owner: "runtime-data-system-test",
      identity: randomUUID(),
      purpose: `public ${outcome} cleanup verification`,
      allowedContent: ["fixture"],
      evidencePromotion: "not_required",
    });
    assert.equal(operation.status, "completed");
    if (operation.status !== "completed") continue;
    const operationDirectory = path.dirname(operation.workDirectory);
    operationDirectories.push(operationDirectory);
    fs.writeFileSync(
      path.join(operation.workDirectory, "fixture"),
      `${outcome}\n`,
    );
    const settled = settleTemporaryOperation(
      operation.capability,
      outcome,
      null,
    );
    assert.equal(settled.status, "completed");
    assert.equal(settled.cleanupConfirmed, true);
    assert.equal(fs.existsSync(operationDirectory), false);
    assert.equal(fs.existsSync(protectedDirectory), true);
  }

  assert.ok(retained.recoveryReference);
  const resumed = resume(root.capability, retained.recoveryReference);
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  const final = settleTemporaryOperation(resumed.capability, "failed", null);
  assert.equal(final.status, "completed");
  assert.equal(final.cleanupConfirmed, true);
  assert.equal(fs.existsSync(protectedDirectory), false);
  assert.equal(
    fs
      .readdirSync(paths.temporary, { withFileTypes: true })
      .some((entry) => entry.name.startsWith(prefix)),
    false,
  );
});
