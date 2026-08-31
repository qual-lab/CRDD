import { spawn } from "node:child_process";
import fs from "node:fs";
import tty from "node:tty";

import { readInteractiveConsoleLineOutcomeUsingAdapter } from "../../src/core/interactive-console.ts";
import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "../../src/security/candidate-store-kernel-lock.ts";

const lockOutcome =
  await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
if (lockOutcome.status !== "acquired" || !lockOutcome.lock) process.exit(3);
const lock = lockOutcome.lock;

let descriptor: number | null = null;
try {
  descriptor = fs.openSync("\\\\.\\CONIN$", "r");
  const controller = new AbortController();
  const observedSpawn = ((
    command: string,
    argumentValues: readonly string[],
    options: Parameters<typeof spawn>[2],
  ) => {
    const child = spawn(command, [...argumentValues], options);
    process.stdout.write(`${JSON.stringify({ readerPid: child.pid })}\n`);
    return child;
  }) as typeof spawn;
  const outcome = await readInteractiveConsoleLineOutcomeUsingAdapter(
    descriptor,
    controller.signal,
    Object.freeze({
      isTty: tty.isatty,
      spawn: observedSpawn,
      setTimeout,
      clearTimeout,
    }),
  );
  process.stdout.write(`${JSON.stringify({ outcome: outcome.status })}\n`);
} finally {
  if (descriptor !== null) fs.closeSync(descriptor);
  if ((await lock.release()) !== "released") process.exitCode = 4;
}
