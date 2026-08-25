import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

const LOCK_ACQUIRE_TIMEOUT_MS = 1_000;
const LOCK_RELEASE_TIMEOUT_MS = 1_000;

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

export function acquireRuntimeOwnedInteractiveConsoleKernelLock() {
  if (process.platform !== "win32") return null;
  const lockIdentity = createHash("sha256")
    .update("crdd-interactive-console-kernel-lock-v1\0")
    .digest("hex")
    .slice(0, 32);
  return acquireNamedPipeKernelLock(
    `\\\\.\\pipe\\CRDD.Coordinator.InteractiveConsole.${lockIdentity}`,
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
  });
}
