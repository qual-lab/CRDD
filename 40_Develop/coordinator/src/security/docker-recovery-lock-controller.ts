import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";

/**
 * KernelLockが扱う値の構造を表す。
 *
 * @responsibility KernelLockに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape KernelLockが表すProperty、識別子およびRelationを型として固定する。
 * @invariant KernelLockで宣言した値と責務の対応を維持する。
 * @boundary N/A: KernelLockの宣言は外部境界を開かない。
 * @security KernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility KernelLockの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type KernelLock = Readonly<{ release: () => boolean }>;

/**
 * createDockerRecoveryRuntimeStateLockControllerの処理を実行する。
 *
 * @responsibility createDockerRecoveryRuntimeStateLockControllerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input runtimeStateBindingHash: unknown
 * @returns createDockerRecoveryRuntimeStateLockControllerの計算結果を返す。
 * @precondition 「runtimeStateBindingHash: unknown」がcreateDockerRecoveryRuntimeStateLockControllerの入力契約を満たす。
 * @postcondition createDockerRecoveryRuntimeStateLockControllerの責務を完了した結果だけを返す。
 * @effect N/A: createDockerRecoveryRuntimeStateLockControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDockerRecoveryRuntimeStateLockControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDockerRecoveryRuntimeStateLockControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDockerRecoveryRuntimeStateLockControllerはProcess内の同一Subsystemで完結する。
 * @security createDockerRecoveryRuntimeStateLockControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerRecoveryRuntimeStateLockControllerは共有非同期状態を持たない同期処理である。
 */
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
    /**
     * outsideLockの処理を実行する。
     *
     * @responsibility outsideLockに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000008
     * @input effect: () => T
     * @returns outsideLockの計算結果を返す。
     * @precondition 「effect: () => T」がoutsideLockの入力契約を満たす。
     * @postcondition outsideLockの責務を完了した結果だけを返す。
     * @effect N/A: outsideLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure outsideLockは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant outsideLockは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: outsideLockはProcess内の同一Subsystemで完結する。
     * @security outsideLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: outsideLockは共有非同期状態を持たない同期処理である。
     */
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
    /**
     * closeの処理を実行する。
     *
     * @responsibility closeに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000008
     * @input N/A: 実行時引数を受け取らない。
     * @returns closeの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がcloseの入力契約を満たす。
     * @postcondition closeの責務を完了した結果だけを返す。
     * @effect N/A: closeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: closeは独自の失敗分岐を所有しない。
     * @invariant closeは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: closeはProcess内の同一Subsystemで完結する。
     * @security closeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: closeは共有非同期状態を持たない同期処理である。
     */
    close() {
      if (closed) return true;
      release();
      closed = true;
      return true;
    },
  });
}
