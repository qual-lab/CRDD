import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createRuntimeLocalTypeScriptWorker,
  spawnRuntimeLocalTypeScriptChild,
} from "../core/runtime-local-typescript-child-entrypoints.ts";
import { createWindowsHostOperationSupervisorEnvironment } from "../core/windows-child-environment.ts";
import {
  prepareInteractiveConsoleKernelLockRequest,
  runHostOperationSupervisorLifecycle,
  runInteractiveConsoleKernelLockLifecycle,
} from "./candidate-store-kernel-lock-lifecycle-internal.ts";

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
  const worker = createRuntimeLocalTypeScriptWorker(
    "candidate_store_lock_worker",
    {
      env: {},
      workerData: Object.freeze({ pipeName, state: sharedState }),
    },
  );
  worker.unref();
  let isWorkerLost = false;
  worker.once("error", () => {
    isWorkerLost = true;
  });
  worker.once("exit", () => {
    isWorkerLost = true;
  });
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
    assertLive: () =>
      !isReleased &&
      !isWorkerLost &&
      worker.threadId > 0 &&
      Atomics.load(state, 0) === 1,
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

export function acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome() {
  const request = prepareInteractiveConsoleKernelLockRequest();
  if (!request)
    return Promise.resolve(
      Object.freeze({
        status: "unavailable",
        lock: null,
      }) as InteractiveConsoleKernelLockOutcome,
    );
  let worker: InteractiveConsoleLockWorker;
  try {
    worker = createRuntimeLocalTypeScriptWorker("candidate_store_lock_worker", {
      env: {},
      workerData: Object.freeze({
        pipeName: request.pipeName,
        state: request.sharedState,
      }),
    });
  } catch {
    return Promise.resolve(
      Object.freeze({
        status: "cleanup_unknown",
        lock: null,
      }) as InteractiveConsoleKernelLockOutcome,
    );
  }
  return runInteractiveConsoleKernelLockLifecycle(worker, request.sharedState);
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

export function prepareHostOperationSupervisorLockRequest(
  rootName: unknown,
  nonce: unknown,
  timing: Readonly<{
    acquireTimeoutMs: number;
    releaseTimeoutMs: number;
  }> = Object.freeze({
    acquireTimeoutMs: HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS,
    releaseTimeoutMs: HOST_SUPERVISOR_RELEASE_TIMEOUT_MS,
  }),
): Readonly<{
  pipeName: string;
  environment: NodeJS.ProcessEnv;
  timing: Readonly<{ acquireTimeoutMs: number; releaseTimeoutMs: number }>;
}> | null {
  if (process.platform !== "win32") return null;
  if (
    !Number.isSafeInteger(timing.acquireTimeoutMs) ||
    timing.acquireTimeoutMs < 1 ||
    timing.acquireTimeoutMs > HOST_SUPERVISOR_ACQUIRE_TIMEOUT_MS ||
    !Number.isSafeInteger(timing.releaseTimeoutMs) ||
    timing.releaseTimeoutMs < 1 ||
    timing.releaseTimeoutMs > LOCK_RELEASE_TIMEOUT_MS
  )
    return null;
  const bindingHash = hostOperationGenerationBindingHash(rootName, nonce);
  const environment = createWindowsHostOperationSupervisorEnvironment();
  if (!bindingHash || !environment) return null;
  const pipeName = `\\\\.\\pipe\\CRDD.Coordinator.HostOperation.${bindingHash.slice(0, 32)}`;
  return Object.freeze({ pipeName, environment, timing });
}

export function acquireRuntimeOwnedHostOperationSupervisorLock(
  rootName: unknown,
  nonce: unknown,
) {
  const request = prepareHostOperationSupervisorLockRequest(rootName, nonce);
  if (!request)
    return Promise.resolve(
      Object.freeze({
        status: "unavailable",
        lock: null,
      }) as HostOperationSupervisorLockOutcome,
    );
  let child: ChildProcess;
  try {
    child = spawnRuntimeLocalTypeScriptChild(
      "host_operation_lock_supervisor",
      [request.pipeName],
      {
        cwd: fileURLToPath(new URL(".", import.meta.url)),
        env: request.environment,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
    );
  } catch {
    return Promise.resolve(
      Object.freeze({
        status: "cleanup_confirmed_failure",
        lock: null,
      }) as HostOperationSupervisorLockOutcome,
    );
  }
  return runHostOperationSupervisorLifecycle(request, child);
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
