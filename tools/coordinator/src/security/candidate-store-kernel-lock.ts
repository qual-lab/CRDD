import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const LOCK_ACQUIRE_TIMEOUT_MS = 1_000;
const LOCK_RELEASE_TIMEOUT_MS = 1_000;

type HostOperationLockSupervisor = Readonly<{
  confirmReady: () => Promise<boolean>;
  release: () => Promise<boolean>;
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
  if (!waitForState(state, 0, LOCK_ACQUIRE_TIMEOUT_MS)) {
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
    LOCK_RELEASE_TIMEOUT_MS,
  );
  const exitResult = await withinTimeout(exit, LOCK_RELEASE_TIMEOUT_MS);
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
  if (!waitForState(state, 0, LOCK_ACQUIRE_TIMEOUT_MS)) {
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
          !waitForState(state, 1, LOCK_RELEASE_TIMEOUT_MS) ||
          Atomics.load(state, 0) !== 2
        ) {
          await terminateAndConfirmInteractiveConsoleLockWorker(worker, exit);
          return "cleanup_unknown" as const;
        }
        const exitResult = await withinTimeout(exit, LOCK_RELEASE_TIMEOUT_MS);
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

function waitForSupervisorStatus(
  child: ReturnType<typeof spawn>,
  expected: "acquired" | "ready" | "released",
) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("message", onMessage);
      child.removeListener("error", onFailure);
      child.removeListener("exit", onFailure);
      resolve(value);
    };
    const onMessage = (message: unknown) =>
      settle(
        typeof message === "object" &&
          message !== null &&
          Object.getPrototypeOf(message) === Object.prototype &&
          Reflect.ownKeys(message).length === 1 &&
          Reflect.get(message, "status") === expected,
      );
    const onFailure = () => settle(false);
    const timeout = setTimeout(() => settle(false), LOCK_ACQUIRE_TIMEOUT_MS);
    child.once("message", onMessage);
    child.once("error", onFailure);
    child.once("exit", onFailure);
  });
}

async function terminateSupervisor(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null) return true;
  const exit = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), LOCK_RELEASE_TIMEOUT_MS);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
  try {
    child.kill();
  } catch {
    return false;
  }
  return exit;
}

export async function acquireRuntimeOwnedHostOperationSupervisorLock(
  rootName: unknown,
  nonce: unknown,
): Promise<HostOperationLockSupervisor | null> {
  if (process.platform !== "win32") return null;
  const bindingHash = hostOperationGenerationBindingHash(rootName, nonce);
  if (!bindingHash) return null;
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${bindingHash.slice(0, 32)}`;
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("./host-operation-lock-supervisor.ts", import.meta.url),
      ),
      pipeName,
    ],
    {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      env: {},
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    },
  );
  let released = false;
  let failed = false;
  child.once("error", () => {
    failed = true;
  });
  child.once("exit", (code) => {
    if (!released || code !== 0) failed = true;
  });
  if (
    !(await waitForSupervisorStatus(child, "acquired")) ||
    failed ||
    child.exitCode !== null ||
    !child.connected
  ) {
    await terminateSupervisor(child);
    return null;
  }
  return Object.freeze({
    confirmReady: async () => {
      if (released || failed || !child.connected) return false;
      const ready = waitForSupervisorStatus(child, "ready");
      try {
        child.send("confirm-ready");
      } catch {
        return false;
      }
      return ready;
    },
    release: async () => {
      if (released || failed || !child.connected) return false;
      released = true;
      const releaseStatus = waitForSupervisorStatus(child, "released");
      const exit = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(
          () => resolve(false),
          LOCK_RELEASE_TIMEOUT_MS,
        );
        child.once("exit", (code) => {
          clearTimeout(timeout);
          resolve(code === 0);
        });
      });
      try {
        child.send("release");
      } catch {
        await terminateSupervisor(child);
        return false;
      }
      const [reported, exited] = await Promise.all([releaseStatus, exit]);
      if (!reported || !exited) await terminateSupervisor(child);
      return reported && exited;
    },
  });
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
    acquireTimeoutMs: LOCK_ACQUIRE_TIMEOUT_MS,
    releaseTimeoutMs: LOCK_RELEASE_TIMEOUT_MS,
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
  });
}
