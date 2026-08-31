import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";

type KernelLock = Readonly<{ release: () => boolean }>;

export function createDockerRecoveryRuntimeStateLockController(
  runtimeStateBindingHash: unknown,
) {
  let lock: KernelLock | null = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
    runtimeStateBindingHash,
  );
  if (!lock) return null;
  let closed = false;
  const release = () => {
    if (!lock) return;
    const current = lock;
    lock = null;
    if (!current.release())
      throw new Error("docker_task_runtime_state_lock_release_unconfirmed");
  };
  const reacquire = () => {
    if (closed)
      throw new Error("docker_task_runtime_state_lock_controller_closed");
    if (lock) return;
    lock =
      acquireRuntimeOwnedDockerRuntimeStateKernelLock(
        runtimeStateBindingHash,
      ) ?? null;
    if (!lock)
      throw new Error("docker_task_runtime_state_generation_active_or_unknown");
  };
  return Object.freeze({
    outsideLock<T>(effect: () => T) {
      if (closed || !lock)
        throw new Error("docker_task_runtime_state_lock_controller_invalid");
      release();
      try {
        return effect();
      } finally {
        reacquire();
      }
    },
    close() {
      if (closed) return true;
      release();
      closed = true;
      return true;
    },
  });
}
