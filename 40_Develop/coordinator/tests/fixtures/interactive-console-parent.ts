/**
 * 対話Readerの所有・取消を観測する親Processを実行する。
 *
 * @packageDocumentation
 * @responsibility Reader子Process・Lock・入力のLifecycleを試験用構成で接続する。
 * @trace EST-ST-003
 * @level ST
 * @scope 対話Readerの親子Process
 * @boundary 固定試験親Process→Reader・Native Lock。利用側が入力終了と子Process終端を確認する。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInteractiveConsoleReaderLifecycle } from "../../src/cli/interactive-console-reader-lifecycle.ts";
import { spawnRuntimeLocalTypeScriptChild } from "../../src/host-execution/typescript-child-entrypoints.ts";
import { createInteractiveConsoleReaderEnvironment } from "../../src/host-execution/windows-child-environment.ts";
import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "../../src/host-execution/kernel-lock.ts";

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
  const outcome = await runInteractiveConsoleReaderLifecycle(
    Object.freeze({ inputDescriptor: descriptor }),
    controller.signal,
    child,
    Object.freeze({
      setTimeout,
      clearTimeout,
    }),
  );
  process.stdout.write(`${JSON.stringify({ outcome: outcome.status })}\n`);
} finally {
  if (descriptor !== null) fs.closeSync(descriptor);
  if ((await lock.release()) !== "released") process.exitCode = 4;
}
