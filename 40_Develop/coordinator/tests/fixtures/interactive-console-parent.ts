import fs from "node:fs";
import path from "node:path";
import tty from "node:tty";
import { fileURLToPath } from "node:url";
import { readInteractiveConsoleLineOutcomeUsingChild } from "../../src/core/interactive-console.ts";
import { spawnRuntimeLocalTypeScriptChild } from "../../src/core/runtime-local-typescript-child-entrypoints.ts";
import { createInteractiveConsoleReaderEnvironment } from "../../src/core/windows-child-environment.ts";
import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "../../src/security/candidate-store-kernel-lock.ts";

const lockOutcome =
  await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
if (lockOutcome.status !== "acquired" || !lockOutcome.lock) process.exit(3);
const lock = lockOutcome.lock;

let descriptor: number | null = null;
try {
  descriptor = fs.openSync("\\\\.\\CONIN$", "r");
  const controller = new AbortController();
  const environment = createInteractiveConsoleReaderEnvironment();
  if (!environment) process.exit(5);
  const child = spawnRuntimeLocalTypeScriptChild(
    "interactive_console_reader",
    [],
    {
      shell: false,
      detached: false,
      windowsHide: false,
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      env: environment,
      stdio: ["ignore", "pipe", "ignore", "ipc"],
    },
  );
  process.stdout.write(`${JSON.stringify({ readerPid: child.pid })}\n`);
  const outcome = await readInteractiveConsoleLineOutcomeUsingChild(
    descriptor,
    controller.signal,
    child,
    Object.freeze({
      isTty: tty.isatty,
      setTimeout,
      clearTimeout,
    }),
  );
  process.stdout.write(`${JSON.stringify({ outcome: outcome.status })}\n`);
} finally {
  if (descriptor !== null) fs.closeSync(descriptor);
  if ((await lock.release()) !== "released") process.exitCode = 4;
}
