import fs from "node:fs";

const [
  workingDirectory,
  signalPath,
  mode,
  requestedKind = "canonical-adoption",
  queueId = "queue-a",
] = process.argv.slice(2);
if (
  !workingDirectory ||
  !signalPath ||
  (mode !== "hold" && mode !== "pause-before-publish") ||
  (requestedKind !== "canonical-adoption" &&
    requestedKind !== "project-operation") ||
  !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(queueId)
)
  throw new Error("project_runtime_lease_interleaving_probe_input_invalid");

if (mode === "pause-before-publish") {
  const originalLinkSync = fs.linkSync;
  fs.linkSync = ((source: fs.PathLike, destination: fs.PathLike) => {
    if (String(destination).endsWith(".acquire-pending")) {
      fs.writeFileSync(signalPath, "ready\n", "utf8");
      const deadline = Date.now() + 10_000;
      while (!fs.existsSync(`${signalPath}.go`)) {
        if (Date.now() >= deadline) throw new Error("probe_signal_timeout");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    }
    return originalLinkSync(source, destination);
  }) as typeof fs.linkSync;
}

const { acquireProjectRuntimeLease } = await import(
  "../../src/security/project-runtime-durable-foundation.ts"
);
const result = acquireProjectRuntimeLease(
  workingDirectory,
  "binding-a",
  "project-a",
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
