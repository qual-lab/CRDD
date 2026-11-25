/**
 * CoordinatorのLeaseと採用の交錯を別Processで試験する。
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
  requestedKind = "project-operation",
  queueId = "queue-a",
  projectId = "project-a",
  claim,
] = process.argv.slice(2);
if (
  !workingDirectory ||
  !signalPath ||
  (mode !== "hold" && mode !== "pause-before-publish") ||
  requestedKind !== "project-operation" ||
  !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(queueId) ||
  !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(projectId) ||
  (claim !== undefined &&
    (!["claim", "cancelled", "integration_pending"].includes(claim) ||
      mode !== "hold"))
)
  throw new Error("coordinator_lease_interleaving_probe_input_invalid");

if (mode === "pause-before-publish") {
  const originalOpenSync = fs.openSync;
  fs.openSync = ((
    target: fs.PathLike,
    flags: string | number,
    mode?: fs.Mode,
  ) => {
    const result = originalOpenSync(target, flags, mode);
    if (
      String(target).includes("coordinator.lease.") &&
      String(target).endsWith(".lock") &&
      flags === "wx+"
    ) {
      fs.writeFileSync(signalPath, "ready\n", "utf8");
      const deadline = Date.now() + 10_000;
      while (!fs.existsSync(`${signalPath}.go`)) {
        if (Date.now() >= deadline) throw new Error("probe_signal_timeout");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    }
    return result;
  }) as typeof fs.openSync;
}

const foundation = await import("../../src/lifecycle/host.ts");
const result = foundation.acquireCoordinatorSnapshotLease(
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
  if (claim !== undefined) {
    const { createTestPersistence } = await import(
      "./task-persistence-fixture.ts"
    );
    const saved = foundation.updateCoordinatorQueue(
      createTestPersistence(workingDirectory, "binding-a"),
      queueId,
      1,
      {
        state: "leased",
        lease: result.value,
        resumeCondition: null,
        resultReference: null,
      },
    );
    if (saved.status !== "completed") throw Error(saved.reason);
    if (claim === "cancelled" || claim === "integration_pending") {
      const persistence = createTestPersistence(workingDirectory, "binding-a");
      const running = foundation.updateCoordinatorQueue(
        persistence,
        queueId,
        saved.value.generation,
        {
          state: "running",
          lease: result.value,
          resumeCondition: null,
          resultReference: null,
        },
      );
      if (running.status !== "completed") throw Error(running.reason);
      const terminal = foundation.updateCoordinatorQueue(
        persistence,
        queueId,
        running.value.generation,
        {
          state: claim,
          lease: result.value,
          resumeCondition:
            claim === "integration_pending" ? "objective_integration" : null,
          resultReference:
            claim === "integration_pending"
              ? "original-integration-reference"
              : null,
        },
      );
      if (terminal.status !== "completed") throw Error(terminal.reason);
    }
  }
  if (mode === "hold") {
    fs.writeFileSync(signalPath, "ready\n", "utf8");
    const deadline = Date.now() + 10_000;
    while (!fs.existsSync(`${signalPath}.go`)) {
      if (Date.now() >= deadline) throw new Error("probe_signal_timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
  }
  const released = result.value.release();
  if (mode === "hold" && process.env.CRDD_LEASE_PROBE_RELEASE_MARKER === "1")
    fs.writeFileSync(
      `${signalPath}.released`,
      `${released.status}:${released.reason}\n`,
      { flag: "wx" },
    );
  process.stdout.write(
    `${JSON.stringify({ acquired: true, released: released.status })}\n`,
  );
}
