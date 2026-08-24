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
  const sharedState = new SharedArrayBuffer(4);
  const state = new Int32Array(sharedState);
  const worker = new Worker(
    new URL("./candidate-store-lock-worker.ts", import.meta.url),
    {
      env: {},
      workerData: Object.freeze({ pipeName, state: sharedState }),
    },
  );
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
  const sharedState = new SharedArrayBuffer(4);
  const state = new Int32Array(sharedState);
  const worker = new Worker(
    new URL("./candidate-store-lock-worker.ts", import.meta.url),
    {
      env: {},
      workerData: Object.freeze({ pipeName, state: sharedState }),
    },
  );
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

export function describeCandidateStoreKernelLockContract() {
  return Object.freeze({
    implementation: "windows_named_pipe_kernel_object",
    identity:
      "selected_user_sid_store_identity_and_exact_protection_hash_domain_separated",
    abandonedOwnerHandling: "kernel_release_on_process_termination",
    staleFileDeletion: false,
    arbitraryPathAccepted: false,
    acquireTimeoutMs: LOCK_ACQUIRE_TIMEOUT_MS,
    releaseTimeoutMs: LOCK_RELEASE_TIMEOUT_MS,
  });
}
