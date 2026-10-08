/**
 * OrchestratorのSnapshot Lease競合を別Processで試験する。
 *
 * @packageDocumentation
 * @responsibility Barrierと固定入力に結合してLeaseを取得し、競合結果を利用側へ返す。
 * @trace PRL-IT-011
 * @level IT
 * @scope Snapshot Leaseの競合
 * @boundary 固定試験Process→Orchestrator保存・Lease。Provider実行を伴わない。
 */
import fs from "node:fs";

import { acquireOrchestratorSnapshotLease } from "../../../orchestrator/src/storage/current-state.ts";

const [workingDirectory, barrier, projectId, queueId] = process.argv.slice(2);
if (!workingDirectory || !barrier || !projectId || !queueId)
  throw new Error("orchestrator_lease_race_probe_input_invalid");

fs.writeFileSync(`${barrier}.${queueId}.ready`, "ready\n", "utf8");
const deadline = Date.now() + 10_000;
while (!fs.existsSync(barrier)) {
  if (Date.now() >= deadline) throw new Error("barrier_timeout");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
}
const result = acquireOrchestratorSnapshotLease(
  workingDirectory,
  "binding-race",
  projectId,
  queueId,
  "project-operation",
);
if (result.status === "completed") {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  const released = result.value.release();
  process.stdout.write(
    `${JSON.stringify({ status: "acquired", released: released.status, manualRecoveryRequired: released.status === "completed" ? false : released.manualRecoveryRequired === true })}\n`,
  );
} else {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: result.reason, manualRecoveryRequired: result.manualRecoveryRequired })}\n`,
  );
}
