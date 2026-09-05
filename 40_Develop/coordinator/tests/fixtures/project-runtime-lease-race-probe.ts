import fs from "node:fs";

import { acquireProjectRuntimeLease } from "../../src/security/project-runtime-durable-foundation.ts";

const [workingDirectory, barrier, projectId, queueId] = process.argv.slice(2);
if (!workingDirectory || !barrier || !projectId || !queueId)
  throw new Error("project_runtime_lease_race_probe_input_invalid");

fs.writeFileSync(`${barrier}.${queueId}.ready`, "ready\n", "utf8");
const deadline = Date.now() + 10_000;
while (!fs.existsSync(barrier)) {
  if (Date.now() >= deadline) throw new Error("barrier_timeout");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
}
const result = acquireProjectRuntimeLease(
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
    `${JSON.stringify({ status: "acquired", released: released.status })}\n`,
  );
} else {
  process.stdout.write(
    `${JSON.stringify({ status: "blocked", reason: result.reason })}\n`,
  );
}
