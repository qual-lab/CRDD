/**
 * OrchestratorのLeaseと採用の交錯を別Processで試験する。
 *
 * @packageDocumentation
 * @responsibility 指定Mode・Signal・Queueの操作順序を制御し、古い所有者の変更拒否を観測する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @trace PRL-IT-013
 * @level IT
 * @scope Lease・受付・採用の交錯
 * @boundary 固定試験Process→試験用保存状態。実Provider・公開Repositoryの採用は行わない。
 */
import fs from "node:fs";

const [
  workingDirectory,
  signalPath,
  mode,
  requestedKind = "canonical-adoption",
  queueId = "queue-a",
  projectId = "project-a",
] = process.argv.slice(2);
if (
  !workingDirectory ||
  !signalPath ||
  (mode !== "hold" && mode !== "pause-before-publish") ||
  (requestedKind !== "canonical-adoption" &&
    requestedKind !== "project-operation") ||
  !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(queueId) ||
  !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(projectId)
)
  throw new Error("orchestrator_lease_interleaving_probe_input_invalid");

if (mode === "pause-before-publish") {
  const originalMkdirSync = fs.mkdirSync;
  fs.mkdirSync = ((
    target: fs.PathLike,
    options?: fs.MakeDirectoryOptions & { recursive?: boolean },
  ) => {
    const result = originalMkdirSync(target, options);
    if (
      String(target).includes("orchestrator-leases") &&
      String(target).endsWith(".lock")
    ) {
      fs.writeFileSync(signalPath, "ready\n", "utf8");
      const deadline = Date.now() + 10_000;
      while (!fs.existsSync(`${signalPath}.go`)) {
        if (Date.now() >= deadline) throw new Error("probe_signal_timeout");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    }
    return result;
  }) as typeof fs.mkdirSync;
}

const foundation = await import(
  "../../../orchestrator/src/storage/current-state.ts"
);
const result = foundation.acquireOrchestratorSnapshotLease(
  workingDirectory,
  "binding-a",
  projectId,
  queueId,
  requestedKind,
);
if (result.status !== "completed") {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = 20;
} else {
  if (mode === "hold") {
    fs.writeFileSync(signalPath, "ready\n", "utf8");
    const deadline = Date.now() + 10_000;
    while (!fs.existsSync(`${signalPath}.go`)) {
      if (Date.now() >= deadline) throw new Error("probe_signal_timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
  const released = result.value.release();
  process.stdout.write(
    `${JSON.stringify({ acquired: true, released: released.status })}\n`,
  );
}
