import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import tty from "node:tty";
import workerThreads from "node:worker_threads";

import { runSignedGeneralTaskVerification } from "../../scripts/verify-signed-general-task.ts";
import { interactiveConsoleAvailabilityOutcome } from "../../src/core/interactive-console.ts";
import { isRuntimeProcessPoisoned } from "../../src/core/runtime-process-safety-state.ts";
import { startRuntimeOwnedCoordinatorTask } from "../../src/security/coordinator-task-runtime.ts";
import {
  confirmRuntimeOwnedExternalSendUsingConsole,
  requestRuntimeOwnedExternalSendGrant,
} from "../../src/security/external-send-grant-runtime.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../../src/security/platform-provisioner-package-filesystem.ts";

const MODES = new Set([
  "descriptor_close",
  "writer_cleanup",
  "reader_cleanup",
  "lock_acquire_cleanup",
  "lock_release_cleanup",
]);
const mode = process.argv[2];
if (!mode || !MODES.has(mode)) process.exit(64);

const originalOpen = fs.openSync;
const originalClose = fs.closeSync;
const originalIsatty = tty.isatty;
const originalSpawn = childProcess.spawn;
const originalWorker = workerThreads.Worker;
const stdoutTtyDescriptor = Object.getOwnPropertyDescriptor(
  process.stdout,
  "isTTY",
);
const originalStdoutWrite = process.stdout.write;

type Listener = (value: unknown) => void;

class FixtureWorker {
  readonly listeners = new Map<string, Listener>();
  readonly state: Int32Array;

  constructor(
    _filename: URL,
    options: Readonly<{ workerData?: Readonly<{ state?: SharedArrayBuffer }> }>,
  ) {
    this.state = new Int32Array(
      options.workerData?.state ?? new SharedArrayBuffer(4),
    );
    if (mode !== "lock_acquire_cleanup") {
      Atomics.store(this.state, 0, 1);
      Atomics.notify(this.state, 0);
    }
  }

  unref() {}

  once(event: "error" | "exit", listener: Listener) {
    this.listeners.set(event, listener);
    return this;
  }

  postMessage() {
    Atomics.store(this.state, 0, 2);
    Atomics.notify(this.state, 0);
    if (mode !== "lock_release_cleanup")
      setTimeout(() => this.listeners.get("exit")?.(0), 300);
  }

  terminate() {
    return mode === "lock_acquire_cleanup"
      ? new Promise<number>(() => undefined)
      : Promise.resolve(0);
  }
}

function fixtureReaderProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    connected: boolean;
    send: () => boolean;
    kill: () => boolean;
    disconnect: () => void;
  };
  child.stdout = new EventEmitter();
  child.connected = true;
  child.send = () => true;
  child.kill = () => true;
  child.disconnect = () => {
    if (mode === "reader_cleanup")
      throw new Error("fixture_reader_disconnect_cleanup_unknown");
    child.connected = false;
  };
  queueMicrotask(() => {
    if (mode === "lock_release_cleanup") {
      child.stdout.emit(
        "data",
        Buffer.from(
          `${JSON.stringify({
            contract: "crdd-coordinator/interactive-console-reader",
            contractRevision: 2,
            status: "completed",
            line: "123456",
          })}\n`,
          "utf8",
        ),
      );
    }
    child.emit("close", mode === "lock_release_cleanup" ? 0 : 1);
    child.stdout.emit("close");
  });
  return child;
}

try {
  fs.openSync = ((_path: string, flags: string) =>
    flags === "r" ? 101 : 102) as typeof fs.openSync;
  fs.closeSync = ((descriptor: number) => {
    if (mode === "descriptor_close")
      throw new Error(`fixture_descriptor_${descriptor}_close_failed`);
  }) as typeof fs.closeSync;
  tty.isatty = (() => true) as typeof tty.isatty;
  childProcess.spawn = (() =>
    fixtureReaderProcess()) as unknown as typeof childProcess.spawn;
  workerThreads.Worker =
    FixtureWorker as unknown as typeof workerThreads.Worker;
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: true,
  });
  process.stdout.write = ((
    _value: string | Uint8Array,
    callback?: (error?: Error | null) => void,
  ) => {
    if (mode !== "writer_cleanup" && typeof callback === "function")
      queueMicrotask(() => callback(null));
    return true;
  }) as typeof process.stdout.write;
  syncBuiltinESMExports();

  const isInitiallyPoisoned = isRuntimeProcessPoisoned();
  let originStatus = "not_started";
  let isOriginSettled = false;
  let originPromise: Promise<unknown> | null = null;
  if (mode === "descriptor_close") {
    originStatus = interactiveConsoleAvailabilityOutcome().status;
    isOriginSettled = true;
  } else {
    originPromise = confirmRuntimeOwnedExternalSendUsingConsole(
      "fixture notice",
      "123456",
      new AbortController().signal,
    ).then((outcome) => {
      originStatus = outcome.status;
      isOriginSettled = true;
      return outcome;
    });
    const poisonDeadline = performance.now() + 6_000;
    while (!isRuntimeProcessPoisoned() && performance.now() < poisonDeadline)
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }

  const wasOriginPendingAtGate = !isOriginSettled;
  let packageInputReadCount = 0;
  const packageInput = new Proxy(Object.create(null), {
    get: () => {
      packageInputReadCount += 1;
      throw new Error("package_input_must_not_be_read_after_process_poison");
    },
    ownKeys: () => {
      packageInputReadCount += 1;
      throw new Error(
        "package_input_must_not_be_enumerated_after_process_poison",
      );
    },
  });
  const issued =
    issueRuntimeOwnedVerifiedCoordinatorPackageCapability(packageInput);

  let taskReason = "task_did_not_stop";
  try {
    startRuntimeOwnedCoordinatorTask(null, null, null);
  } catch (error) {
    taskReason = error instanceof Error ? error.message : "unknown_task_error";
  }

  let grantInputReadCount = 0;
  const grantInput = new Proxy(Object.create(null), {
    get: () => {
      grantInputReadCount += 1;
      throw new Error("grant_input_must_not_be_read_after_process_poison");
    },
    ownKeys: () => {
      grantInputReadCount += 1;
      throw new Error(
        "grant_input_must_not_be_enumerated_after_process_poison",
      );
    },
  });
  const grant = await requestRuntimeOwnedExternalSendGrant(
    grantInput,
    grantInput,
    grantInput,
    grantInput,
    grantInput,
    grantInput as AbortSignal,
  );
  const runner = await runSignedGeneralTaskVerification(process.cwd());
  if (originPromise) await originPromise;

  fs.openSync = originalOpen;
  fs.closeSync = originalClose;
  tty.isatty = originalIsatty;
  childProcess.spawn = originalSpawn;
  workerThreads.Worker = originalWorker;
  if (stdoutTtyDescriptor)
    Object.defineProperty(process.stdout, "isTTY", stdoutTtyDescriptor);
  else delete (process.stdout as { isTTY?: boolean }).isTTY;
  process.stdout.write = originalStdoutWrite;
  syncBuiltinESMExports();

  process.stdout.write(
    `${JSON.stringify({
      mode,
      initialPoisonState: isInitiallyPoisoned,
      originStatus,
      originPendingAtGate: wasOriginPendingAtGate,
      finalPoisonState: isRuntimeProcessPoisoned(),
      packageReason:
        issued.verification && typeof issued.verification === "object"
          ? (issued.verification as Readonly<Record<string, unknown>>).reason
          : null,
      packageCapabilityIsNull: issued.capability === null,
      packageInputReadCount,
      taskReason,
      grantStatus: grant?.status ?? null,
      grantReason: grant && "reason" in grant ? grant.reason : null,
      grantManualRecoveryRequired:
        grant && "manualRecoveryRequired" in grant
          ? grant.manualRecoveryRequired
          : false,
      grantCapabilityPresent: Boolean(grant && "capability" in grant),
      grantRecoveryFieldCount: grant
        ? Object.keys(grant).filter((key) => /RecoveryIds?$/u.test(key)).length
        : 0,
      grantRawContentReported:
        grant && "rawContentReported" in grant
          ? grant.rawContentReported
          : null,
      grantHostPathReported:
        grant && "hostPathReported" in grant ? grant.hostPathReported : null,
      grantInputReadCount,
      runnerStatus: runner.status,
      runnerReason: runner.reason,
      runnerManualRecoveryRequired: runner.manualRecoveryRequired,
      runnerHostRecoveryId: runner.hostRecoveryId,
    })}\n`,
  );
} finally {
  fs.openSync = originalOpen;
  fs.closeSync = originalClose;
  tty.isatty = originalIsatty;
  childProcess.spawn = originalSpawn;
  workerThreads.Worker = originalWorker;
  if (stdoutTtyDescriptor)
    Object.defineProperty(process.stdout, "isTTY", stdoutTtyDescriptor);
  else delete (process.stdout as { isTTY?: boolean }).isTTY;
  process.stdout.write = originalStdoutWrite;
  syncBuiltinESMExports();
}
