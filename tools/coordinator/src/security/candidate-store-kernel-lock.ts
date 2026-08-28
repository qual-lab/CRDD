import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { createWindowsHostOperationSupervisorEnvironment } from "../core/windows-child-environment.ts";

const SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS = 5_000;
const HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS = 1_000;
const LOCK_RELEASE_TIMEOUT_MS = 5_000;
const INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS = 1_000;
const HOST_SUPERVISOR_RELEASE_TIMEOUT_MS = 1_000;

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

type InteractiveConsoleLockWorkerFactory = (
  pipeName: string,
  sharedState: SharedArrayBuffer,
) => InteractiveConsoleLockWorker;

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

function acquireNamedPipeKernelLock(pipeName: string) {
  const sharedState = new SharedArrayBuffer(4);
  const state = new Int32Array(sharedState);
  const worker = new Worker(
    new URL("./candidate-store-lock-worker.ts", import.meta.url),
    {
      env: {},
      workerData: Object.freeze({ pipeName, state: sharedState }),
    },
  );
  worker.unref();
  if (!waitForState(state, 0, SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS)) {
    void worker.terminate();
    return null;
  }
  if (Atomics.load(state, 0) !== 1) {
    void worker.terminate();
    return null;
  }
  let isReleased = false;
  return Object.freeze({
    release: () => {
      if (isReleased) return false;
      isReleased = true;
      worker.postMessage("release");
      if (!waitForState(state, 1, LOCK_RELEASE_TIMEOUT_MS)) {
        void worker.terminate();
        return false;
      }
      return Atomics.load(state, 0) === 2;
    },
  });
}

export function acquireRuntimeOwnedCandidateStoreKernelLock(
  candidateStoreProtectionHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof candidateStoreProtectionHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(candidateStoreProtectionHash)
  ) {
    return null;
  }
  const lockIdentity = createHash("sha256")
    .update("crdd-candidate-store-kernel-lock-v1\0")
    .update(candidateStoreProtectionHash)
    .digest("hex")
    .slice(0, 32);
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.CandidateStore.${lockIdentity}`;
  return acquireNamedPipeKernelLock(pipeName);
}

export function acquireRuntimeOwnedLogicalProviderHomeKernelLock(
  stableLogicalHomeBindingHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof stableLogicalHomeBindingHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(stableLogicalHomeBindingHash)
  ) {
    return null;
  }
  const lockIdentity = createHash("sha256")
    .update("crdd-logical-provider-home-kernel-lock-v1\0")
    .update(stableLogicalHomeBindingHash)
    .digest("hex")
    .slice(0, 32);
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.ProviderHome.${lockIdentity}`;
  return acquireNamedPipeKernelLock(pipeName);
}

export function acquireRuntimeOwnedDockerRuntimeStateKernelLock(
  runtimeStateBindingHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof runtimeStateBindingHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(runtimeStateBindingHash)
  )
    return null;
  const lockIdentity = createHash("sha256")
    .update("crdd-docker-runtime-state-kernel-lock-v1\0")
    .update(runtimeStateBindingHash)
    .digest("hex")
    .slice(0, 32);
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.DockerRuntimeState.${lockIdentity}`;
  return acquireNamedPipeKernelLock(pipeName);
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

export async function acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
  workerFactory: InteractiveConsoleLockWorkerFactory,
): Promise<InteractiveConsoleKernelLockOutcome> {
  if (process.platform !== "win32")
    return Object.freeze({ status: "unavailable", lock: null });
  const lockIdentity = createHash("sha256")
    .update("crdd-interactive-console-kernel-lock-v1\0")
    .digest("hex")
    .slice(0, 32);
  const sharedState = new SharedArrayBuffer(4);
  const state = new Int32Array(sharedState);
  let worker: InteractiveConsoleLockWorker;
  try {
    worker = workerFactory(
      `\\\\.\\pipe\\CRDD.Coordinator.InteractiveConsole.${lockIdentity}`,
      sharedState,
    );
  } catch {
    return Object.freeze({ status: "cleanup_unknown", lock: null });
  }
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

export function acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome() {
  return acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
    (pipeName, sharedState) =>
      new Worker(new URL("./candidate-store-lock-worker.ts", import.meta.url), {
        env: {},
        workerData: Object.freeze({ pipeName, state: sharedState }),
      }),
  );
}

export function hostOperationGenerationBindingHash(
  rootName: unknown,
  nonce: unknown,
) {
  if (
    typeof rootName !== "string" ||
    !/^crdd-coordinator-doctor-[A-Za-z0-9_-]{6,64}$/u.test(rootName) ||
    typeof nonce !== "string" ||
    !/^[a-f0-9-]{32,48}$/u.test(nonce)
  )
    return null;
  return createHash("sha256")
    .update("crdd-host-operation-generation-v1\0")
    .update(rootName)
    .update("\0")
    .update(nonce)
    .digest("hex");
}

export function acquireRuntimeOwnedHostOperationKernelLock(
  rootName: unknown,
  nonce: unknown,
) {
  if (process.platform !== "win32") return null;
  const bindingHash = hostOperationGenerationBindingHash(rootName, nonce);
  if (!bindingHash) return null;
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${bindingHash.slice(0, 32)}`;
  return acquireNamedPipeKernelLock(pipeName);
}

type SupervisorChild = ReturnType<typeof spawn>;
type SupervisorSpawnFactory = (
  executable: string,
  args: readonly string[],
  options: Parameters<typeof spawn>[2],
) => SupervisorChild;
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
  const exited = await exit;
  releaseSupervisorHandles(child);
  return exited;
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

export async function acquireHostOperationSupervisorLockUsingFactory(
  rootName: unknown,
  nonce: unknown,
  spawnFactory: SupervisorSpawnFactory,
  timing: Readonly<{
    acquireTimeoutMs: number;
    releaseTimeoutMs: number;
  }> = Object.freeze({
    acquireTimeoutMs: HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS,
    releaseTimeoutMs: HOST_SUPERVISOR_RELEASE_TIMEOUT_MS,
  }),
): Promise<HostOperationSupervisorLockOutcome> {
  if (process.platform !== "win32")
    return Object.freeze({ status: "unavailable", lock: null });
  if (
    !Number.isSafeInteger(timing.acquireTimeoutMs) ||
    timing.acquireTimeoutMs < 1 ||
    timing.acquireTimeoutMs > HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS ||
    !Number.isSafeInteger(timing.releaseTimeoutMs) ||
    timing.releaseTimeoutMs < 1 ||
    timing.releaseTimeoutMs > LOCK_RELEASE_TIMEOUT_MS
  )
    return Object.freeze({ status: "unavailable", lock: null });
  const bindingHash = hostOperationGenerationBindingHash(rootName, nonce);
  const environment = createWindowsHostOperationSupervisorEnvironment();
  if (!bindingHash || !environment)
    return Object.freeze({ status: "unavailable", lock: null });
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${bindingHash.slice(0, 32)}`;
  let child: SupervisorChild;
  try {
    child = spawnFactory(
      process.execPath,
      [
        fileURLToPath(
          new URL("./host-operation-lock-supervisor.ts", import.meta.url),
        ),
        pipeName,
      ],
      {
        cwd: fileURLToPath(new URL(".", import.meta.url)),
        env: environment,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
    );
  } catch {
    return Object.freeze({
      status: "cleanup_confirmed_failure",
      lock: null,
    });
  }
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
  let expectedClosure = false;
  let resolveLoss!: (
    outcome: Exclude<HostOperationSupervisorCleanup, "released">,
  ) => void;
  const loss = new Promise<Exclude<HostOperationSupervisorCleanup, "released">>(
    (resolve) => {
      resolveLoss = resolve;
    },
  );
  let resolveFailureDetected!: () => void;
  let failureWasDetected = false;
  const failureListeners = new Set<() => void>();
  const failureDetected = new Promise<void>((resolve) => {
    resolveFailureDetected = resolve;
  });
  const detectFailure = () => {
    if (failureWasDetected) return;
    failureWasDetected = true;
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
    expectedClosure = true;
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
    if (!expectedClosure && terminal === null) {
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
    const live =
      terminal === null &&
      finalizer === null &&
      (state === "acquired" || state === "ready") &&
      child.exitCode === null &&
      child.signalCode === null &&
      child.connected;
    if (!live) unexpectedLoss();
    return live;
  };
  const lock: HostOperationLockSupervisor = Object.freeze({
    assertLive,
    onFailureDetected: (listener) => {
      if (failureWasDetected) {
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
      expectedClosure = true;
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

export function acquireRuntimeOwnedHostOperationSupervisorLock(
  rootName: unknown,
  nonce: unknown,
) {
  return acquireHostOperationSupervisorLockUsingFactory(rootName, nonce, spawn);
}

export function describeCandidateStoreKernelLockContract() {
  return Object.freeze({
    implementation: "windows_named_pipe_kernel_object",
    identity:
      "selected_user_sid_store_identity_and_exact_protection_hash_domain_separated",
    abandonedOwnerHandling: "kernel_release_on_process_termination",
    staleFileDeletion: false,
    dockerRuntimeStateInventorySerialized: true,
    arbitraryPathAccepted: false,
    acquireTimeoutMs: SYNCHRONOUS_LOCK_ACQUIRE_TIMEOUT_MS,
    hostSupervisorAcquireTimeoutMs: HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS,
    releaseTimeoutMs: LOCK_RELEASE_TIMEOUT_MS,
    interactiveConsoleCleanupTimeoutMs: INTERACTIVE_LOCK_CLEANUP_TIMEOUT_MS,
    hostSupervisorReleaseTimeoutMs: HOST_SUPERVISOR_RELEASE_TIMEOUT_MS,
    interactiveConsoleLock:
      "dedicated_async_acquire_and_release_with_state_and_worker_exit_confirmation",
    interactiveConsoleWorkerKeepsProcessAliveUntilRelease: true,
    interactiveConsoleOutcomes: Object.freeze([
      "acquired",
      "unavailable",
      "cleanup_unknown_process_restart_required",
    ]),
    commonSynchronousLockMeaningChanged: false,
    hostOperationCrossBoundaryReadiness:
      "dedicated_supervisor_process_round_trip_and_exit_confirmed_release_before_console_or_child_process",
    hostOperationSupervisorEnvironment:
      "runtime_owned_windows_node_child_profile_parent_environment_not_authority",
    hostOperationSupervisorOutcomes: Object.freeze([
      "acquired",
      "unavailable",
      "cleanup_confirmed_failure",
      "cleanup_unknown_process_restart_required",
    ]),
  });
}
