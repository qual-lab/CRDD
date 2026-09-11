import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";

const HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS = 1_000;
const INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS = 1_000;

type HostOperationSupervisorCleanup =
  | "released"
  | "cleanup_confirmed_failure"
  | "cleanup_unknown";
export type HostOperationLockSupervisor = Readonly<{
  assertLive: () => boolean;
  onFailureDetected: (listener: () => void) => () => void;
  failureDetected: Promise<void>;
  loss: Promise<Exclude<HostOperationSupervisorCleanup, "released">>;
  confirmReady: () => Promise<
    "ready" | "cleanup_confirmed_failure" | "cleanup_unknown"
  >;
  release: () => Promise<HostOperationSupervisorCleanup>;
}>;
export type HostOperationSupervisorLockOutcome = Readonly<{
  status:
    | "acquired"
    | "unavailable"
    | "cleanup_confirmed_failure"
    | "cleanup_unknown";
  lock: HostOperationLockSupervisor | null;
}>;

type InteractiveConsoleLockWorker = Readonly<{
  unref: () => void;
  postMessage: (value: string) => void;
  terminate: () => Promise<number>;
  once: (
    event: "error" | "exit",
    listener: ((error: Error) => void) | ((code: number) => void),
  ) => unknown;
}>;

export type InteractiveConsoleKernelLockOutcome = Readonly<{
  status: "acquired" | "unavailable" | "cleanup_unknown";
  lock: Readonly<{
    release: () => Promise<"released" | "cleanup_unknown">;
  }> | null;
}>;

function waitForState(state: Int32Array, expected: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Atomics.load(state, 0) === expected) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    Atomics.wait(state, 0, expected, remaining);
  }
  return true;
}

function boundedWorkerExit(worker: InteractiveConsoleLockWorker) {
  return new Promise<"exited" | "error">((resolve) => {
    let isSettled = false;
    const settle = (status: "exited" | "error") => {
      if (isSettled) return;
      isSettled = true;
      resolve(status);
    };
    worker.once("error", () => settle("error"));
    worker.once("exit", () => settle("exited"));
  });
}

async function withinTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<Readonly<{ completed: boolean; value: T | null }>>(
    (resolve) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        resolve(Object.freeze({ completed: false, value: null }));
      }, timeoutMs);
      timer.unref();
      promise.then(
        (value) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          resolve(Object.freeze({ completed: true, value }));
        },
        () => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timer);
          resolve(Object.freeze({ completed: false, value: null }));
        },
      );
    },
  );
}

async function terminateAndConfirmInteractiveConsoleLockWorker(
  worker: InteractiveConsoleLockWorker,
  exit: Promise<"exited" | "error">,
) {
  const termination = await withinTimeout(
    worker.terminate(),
    INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
  );
  const exitResult = await withinTimeout(
    exit,
    INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
  );
  return (
    termination.completed &&
    exitResult.completed &&
    exitResult.value === "exited"
  );
}

export function prepareInteractiveConsoleKernelLockRequest() {
  if (process.platform !== "win32") return null;
  const lockIdentity = createHash("sha256")
    .update("crdd-interactive-console-kernel-lock-v1\0")
    .digest("hex")
    .slice(0, 32);
  const sharedState = new SharedArrayBuffer(4);
  return Object.freeze({
    pipeName: `\\\\.\\pipe\\CRDD.Coordinator.InteractiveConsole.${lockIdentity}`,
    sharedState,
  });
}

export async function runInteractiveConsoleKernelLockLifecycle(
  worker: InteractiveConsoleLockWorker,
  sharedState: SharedArrayBuffer,
): Promise<InteractiveConsoleKernelLockOutcome> {
  const state = new Int32Array(sharedState);
  const exit = boundedWorkerExit(worker);
  if (!waitForState(state, 0, HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS)) {
    await terminateAndConfirmInteractiveConsoleLockWorker(worker, exit);
    return Object.freeze({ status: "cleanup_unknown", lock: null });
  }
  if (Atomics.load(state, 0) !== 1) {
    const isTerminated = await terminateAndConfirmInteractiveConsoleLockWorker(
      worker,
      exit,
    );
    return Object.freeze({
      status: isTerminated ? "unavailable" : "cleanup_unknown",
      lock: null,
    });
  }
  let isReleased = false;
  return Object.freeze({
    status: "acquired",
    lock: Object.freeze({
      release: async () => {
        if (isReleased) return "cleanup_unknown" as const;
        isReleased = true;
        try {
          worker.postMessage("release");
        } catch {
          await terminateAndConfirmInteractiveConsoleLockWorker(worker, exit);
          return "cleanup_unknown" as const;
        }
        if (
          !waitForState(state, 1, INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS) ||
          Atomics.load(state, 0) !== 2
        ) {
          await terminateAndConfirmInteractiveConsoleLockWorker(worker, exit);
          return "cleanup_unknown" as const;
        }
        const exitResult = await withinTimeout(
          exit,
          INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
        );
        return exitResult.completed && exitResult.value === "exited"
          ? ("released" as const)
          : ("cleanup_unknown" as const);
      },
    }),
  });
}

type SupervisorChild = ChildProcess;
type SupervisorObservation =
  | "expected"
  | "unavailable"
  | "protocol_failure"
  | "error"
  | "exit"
  | "timeout";

function exactSupervisorStatus(message: unknown) {
  if (
    typeof message !== "object" ||
    message === null ||
    Object.getPrototypeOf(message) !== Object.prototype ||
    Reflect.ownKeys(message).length !== 1
  )
    return null;
  const status = Reflect.get(message, "status");
  return [
    "acquired",
    "ready",
    "release-ready",
    "released",
    "unavailable",
  ].includes(String(status))
    ? String(status)
    : null;
}

function waitForSupervisorStatus(
  child: SupervisorChild,
  expected: "acquired" | "ready" | "release-ready" | "released",
  timeoutMs: number,
) {
  return new Promise<SupervisorObservation>((resolve) => {
    let settled = false;
    const settle = (value: SupervisorObservation) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("message", onMessage);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
      resolve(value);
    };
    const onMessage = (message: unknown) => {
      const status = exactSupervisorStatus(message);
      if (status === expected) settle("expected");
      else if (expected === "acquired" && status === "unavailable")
        settle("unavailable");
      else settle("protocol_failure");
    };
    const onError = () => settle("error");
    const onExit = () => settle("exit");
    const timeout = setTimeout(() => settle("timeout"), timeoutMs);
    timeout.unref();
    child.once("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function releaseSupervisorHandles(child: SupervisorChild) {
  child.removeAllListeners();
  child.unref();
  child.channel?.unref();
}

async function terminateSupervisor(child: SupervisorChild, timeoutMs: number) {
  if (child.exitCode !== null || child.signalCode !== null) {
    releaseSupervisorHandles(child);
    return true;
  }
  const exit = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    timeout.unref();
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
  try {
    child.kill();
  } catch {
    releaseSupervisorHandles(child);
    return false;
  }
  const hasExited = await exit;
  releaseSupervisorHandles(child);
  return hasExited;
}

function unresolvedSupervisorLock(child: SupervisorChild) {
  releaseSupervisorHandles(child);
  return Object.freeze({
    assertLive: () => false,
    onFailureDetected: (listener: () => void) => {
      listener();
      return () => undefined;
    },
    failureDetected: Promise.resolve(),
    loss: Promise.resolve("cleanup_unknown" as const),
    confirmReady: async () => "cleanup_unknown" as const,
    release: async () => "cleanup_unknown" as const,
  });
}

export async function runHostOperationSupervisorLifecycle(
  request: Readonly<{
    pipeName: string;
    environment: NodeJS.ProcessEnv;
    timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number }>;
  }>,
  child: SupervisorChild,
): Promise<HostOperationSupervisorLockOutcome> {
  const { timing } = request;
  const acquired = await waitForSupervisorStatus(
    child,
    "acquired",
    timing.acquireTimeoutMs,
  );
  if (
    acquired !== "expected" ||
    child.exitCode !== null ||
    child.signalCode !== null ||
    !child.connected
  ) {
    const terminated = await terminateSupervisor(
      child,
      timing.releaseTimeoutMs,
    );
    if (!terminated)
      return Object.freeze({
        status: "cleanup_unknown",
        lock: unresolvedSupervisorLock(child),
      });
    return Object.freeze({
      status:
        acquired === "unavailable"
          ? "unavailable"
          : "cleanup_confirmed_failure",
      lock: null,
    });
  }
  let state: "acquired" | "ready" | "closing" | "closed" = "acquired";
  let terminal: HostOperationSupervisorCleanup | null = null;
  let finalizer: Promise<
    Exclude<HostOperationSupervisorCleanup, "released">
  > | null = null;
  let isClosureExpected = false;
  let resolveLoss!: (
    outcome: Exclude<HostOperationSupervisorCleanup, "released">,
  ) => void;
  const loss = new Promise<Exclude<HostOperationSupervisorCleanup, "released">>(
    (resolve) => {
      resolveLoss = resolve;
    },
  );
  let resolveFailureDetected!: () => void;
  let wasFailureDetected = false;
  const failureListeners = new Set<() => void>();
  const failureDetected = new Promise<void>((resolve) => {
    resolveFailureDetected = resolve;
  });
  const detectFailure = () => {
    if (wasFailureDetected) return;
    wasFailureDetected = true;
    for (const listener of failureListeners) {
      try {
        listener();
      } catch {
        // Detection is monotonic; one observer cannot suppress another.
      }
    }
    failureListeners.clear();
    resolveFailureDetected();
  };
  const finalizeFailure = () => {
    if (terminal === "cleanup_unknown")
      return Promise.resolve("cleanup_unknown" as const);
    if (terminal === "cleanup_confirmed_failure")
      return Promise.resolve("cleanup_confirmed_failure" as const);
    if (finalizer) return finalizer;
    detectFailure();
    isClosureExpected = true;
    state = "closing";
    finalizer = (async () => {
      const terminated = await terminateSupervisor(
        child,
        timing.releaseTimeoutMs,
      );
      const outcome = terminated
        ? ("cleanup_confirmed_failure" as const)
        : ("cleanup_unknown" as const);
      terminal = outcome;
      state = terminated ? "closed" : "closing";
      resolveLoss(outcome);
      return outcome;
    })();
    return finalizer;
  };
  const unexpectedLoss = () => {
    if (!isClosureExpected && terminal === null) {
      detectFailure();
      void finalizeFailure();
    }
  };
  const unexpectedMessage = () => unexpectedLoss();
  child.on("error", unexpectedLoss);
  child.on("exit", unexpectedLoss);
  child.on("disconnect", unexpectedLoss);
  child.on("message", unexpectedMessage);
  const assertLive = () => {
    const isLive =
      terminal === null &&
      finalizer === null &&
      (state === "acquired" || state === "ready") &&
      child.exitCode === null &&
      child.signalCode === null &&
      child.connected;
    if (!isLive) unexpectedLoss();
    return isLive;
  };
  const lock: HostOperationLockSupervisor = Object.freeze({
    assertLive,
    onFailureDetected: (listener) => {
      if (wasFailureDetected) {
        listener();
        return () => undefined;
      }
      failureListeners.add(listener);
      return () => failureListeners.delete(listener);
    },
    failureDetected,
    loss,
    confirmReady: async () => {
      if (state !== "acquired" || !assertLive()) return finalizeFailure();
      child.removeListener("message", unexpectedMessage);
      const ready = waitForSupervisorStatus(
        child,
        "ready",
        timing.acquireTimeoutMs,
      );
      try {
        child.send("confirm-ready");
      } catch {
        return finalizeFailure();
      }
      const observed = await ready;
      if (observed === "expected") {
        state = "ready";
        child.on("message", unexpectedMessage);
        if (!assertLive()) return finalizeFailure();
        return "ready" as const;
      }
      return finalizeFailure();
    },
    release: async () => {
      if (terminal) return terminal;
      if (finalizer) return finalizer;
      if (state === "closed") return "cleanup_confirmed_failure" as const;
      if (state === "closing") return finalizeFailure();
      child.removeListener("message", unexpectedMessage);
      isClosureExpected = true;
      state = "closing";
      const releaseReady = waitForSupervisorStatus(
        child,
        "release-ready",
        timing.releaseTimeoutMs,
      );
      try {
        child.send("release");
      } catch {
        return finalizeFailure();
      }
      if ((await releaseReady) !== "expected") return finalizeFailure();
      const releaseStatus = waitForSupervisorStatus(
        child,
        "released",
        timing.releaseTimeoutMs,
      );
      const exit = new Promise<number | null>((resolve) => {
        if (child.exitCode !== null) return resolve(child.exitCode);
        const timeout = setTimeout(
          () => resolve(null),
          timing.releaseTimeoutMs,
        );
        timeout.unref();
        child.once("exit", (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
      });
      try {
        child.send("confirm-release");
      } catch {
        return finalizeFailure();
      }
      const [reported, exitCode] = await Promise.all([releaseStatus, exit]);
      if (reported === "expected" && exitCode === 0) {
        terminal = "released";
        state = "closed";
        releaseSupervisorHandles(child);
        return "released" as const;
      }
      return finalizeFailure();
    },
  });
  return Object.freeze({ status: "acquired", lock });
}
