/**
 * docker-recovery-lock-controllerに属する責務をまとめる。
 *
 * @responsibility KernelLockを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "../host-runtime/candidate-store-kernel-lock.ts";

/**
 * docker-recovery-lock-controllerで使用するKernel Lockの値契約を定義する。
 *
 * @responsibility Kernel LockのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape KernelLockが表すProperty、識別子およびRelationを型として固定する。
 * @invariant KernelLockで宣言した値と責務の対応を維持する。
 * @boundary N/A: KernelLockの宣言は外部境界を開かない。
 * @security KernelLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility KernelLockの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type KernelLock = Readonly<{ release: () => boolean }>;

/**
 * 同期排他の世代別解放と、失敗後に成功へ戻らない終了判定を所有する。
 *
 * @responsibility 本番と局所試験を同じ失敗保持処理へ接続する。
 * @trace ARCH-000008
 * @input acquire: 一世代の排他を取得する同期処理。
 * @returns controller、または初回取得不成立時のnull。
 * @precondition acquireは取得済みOwnerまたはnullを返す同期処理。
 * @postcondition 取得済み世代を管理し、取得後の失敗を反復で成功へ変えない。
 * @effect acquireおよび取得済みOwnerのreleaseを呼び出す。
 * @failure 初回取得例外は伝播し、取得後の失敗はcontroller内に保持する。
 * @invariant 各世代のreleaseは一回。解放・再取得の失敗は後続closeで成功へ変わらない。
 * @boundary 同期controllerと下位排他Owner。
 * @security 解放通知を全Native資源回収や清掃Authorityへ昇格しない。
 * @concurrency 同期取得・解放のみ。非同期作業の待機や待機後検証は所有しない。
 */
function createController(acquire: () => KernelLock | null) {
  let lock = acquire();
  if (!lock) return null;
  let closed = false;
  let failure: string | null = null;
  /**
   * 現在世代の解放を一回要求する。
   *
   * @responsibility 未確認のOwnerと最初の失敗を保持する。
   * @trace ARCH-000008
   * @input N/A: controller内の現在世代を使用する。
   * @returns N/A: 成功時は値を返さない。
   * @precondition 現在世代を所有し、失敗が確定していない。
   * @postcondition trueの場合だけ現在世代を解放済みにする。
   * @effect 現在Ownerのreleaseを一回呼び出す。
   * @failure false、非boolean、例外を同じ未確認理由としてthrowする。
   * @invariant 未確認のOwner参照を消去せず、releaseを再発行しない。
   * @boundary 下位排他Ownerの同期返値。
   * @security Promiseやtruthy値を成功へ変換しない。
   * @concurrency 同期処理だけを扱い、thenを呼び出さない。
   */
  const release = () => {
    if (failure) throw new Error(failure);
    if (!lock) {
      failure = "docker_task_runtime_state_lock_controller_invalid";
      throw new Error(failure);
    }
    failure = "docker_task_runtime_state_lock_release_unconfirmed";
    try {
      if (lock.release() !== true) throw new Error(failure);
    } catch {
      throw new Error(failure);
    }
    lock = null;
    failure = null;
  };
  /**
   * 同期作業後に新しい世代の排他を取得する。
   *
   * @responsibility 再取得不成立を終了失敗として保持する。
   * @trace ARCH-000008
   * @input N/A: 同じ取得依存を使用する。
   * @returns N/A: 成功時は値を返さない。
   * @precondition 前世代解放済みで、終了・失敗していない。
   * @postcondition 成功時だけ新世代を所有する。
   * @effect acquireを一回呼び出す。
   * @failure nullまたは例外を同じ再取得未確認理由として保持する。
   * @invariant 再取得失敗後にcloseを成功へ変えない。
   * @boundary 下位排他Ownerの取得境界。
   * @security 新しい回復Authorityを発行しない。
   * @concurrency 同期取得のみ。非同期待機後の世代再検証は提供しない。
   */
  const reacquire = () => {
    if (failure) throw new Error(failure);
    if (closed)
      throw new Error("docker_task_runtime_state_lock_controller_closed");
    failure = "docker_task_runtime_state_generation_active_or_unknown";
    try {
      lock = acquire();
      if (!lock) throw new Error(failure);
    } catch {
      throw new Error(failure);
    }
    failure = null;
  };
  return Object.freeze({
    /**
     * 排他を一時解放し、同期作業後に新世代を取得する。
     *
     * @responsibility 作業前後の排他状態と、作業例外・再取得失敗を保持する。
     * @trace ARCH-000008
     * @input effect: () => T
     * @returns outsideLockの計算結果を返す。
     * @precondition effectは同期処理で、現在世代を所有し、終了・失敗していない。
     * @postcondition 正常復帰時は新世代を所有する。
     * @effect 前世代解放、同期effect、新世代取得の順で呼び出す。
     * @failure 解放失敗時はeffectを実行しない。再取得失敗時は作業済みEffectを取消済みとしない。
     * @invariant 作業例外後も再取得する。共同失敗では作業例外をcauseとして保持する。
     * @boundary 同期作業と排他Owner。
     * @security outsideLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency Promiseの完了待機はしない。非同期移行の保証は提供しない。
     */
    outsideLock<T>(effect: () => T) {
      if (failure) throw new Error(failure);
      if (closed || !lock)
        throw new Error("docker_task_runtime_state_lock_controller_invalid");
      release();
      let result: T;
      try {
        result = effect();
      } catch (error) {
        try {
          reacquire();
        } catch (reacquireError) {
          throw new Error(
            reacquireError instanceof Error
              ? reacquireError.message
              : "docker_task_runtime_state_generation_active_or_unknown",
            { cause: error },
          );
        }
        throw error;
      }
      reacquire();
      return result;
    },
    /**
     * docker-recovery-lock-controllerを終了する。
     *
     * @responsibility docker-recovery-lock-controllerの終了条件、資源解放、終了不能時の境界を所有する。
     * @trace ARCH-000008
     * @input N/A: 実行時引数を受け取らない。
     * @returns 解放確認済みはtrue、失敗保持時はfalse。
     * @precondition N/A: 終了済み・失敗後も同じ結果を取得できる。
     * @postcondition 正常終了後はtrueを保持し、失敗後はfalseを保持する。
     * @effect 初回正常終了だけ現在世代のreleaseを呼び出す。
     * @failure 解放例外・不明・再取得失敗はfalseであり、成功へ戻らない。
     * @invariant 終了反復によってreleaseを再発行しない。
     * @boundary 下位排他Ownerの同期解放結果。全Native資源回収の証明ではない。
     * @security closeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: closeは共有非同期状態を持たない同期処理である。
     */
    close() {
      if (failure) return false;
      if (closed) return true;
      try {
        release();
      } catch {
        return false;
      }
      closed = true;
      return true;
    },
  });
}

/**
 * 固定された本番取得処理で同期controllerを構築する。
 *
 * @responsibility KernelLock取得と共通の失敗保持処理を接続する。
 * @trace ARCH-000008
 * @input runtimeStateBindingHash: 下位取得契約で検証する結合Hash。
 * @returns controller、または初回取得不成立時のnull。
 * @precondition Hashと実行環境は下位取得境界で検証する。
 * @postcondition 解放・再取得失敗を反復で成功へ変えない。
 * @effect 下位のWindows KernelLock／Worker取得を発行する。
 * @failure 初回取得不成立または例外を呼出し元へ返す。
 * @invariant 本番取得依存を外部から差し替えない。
 * @boundary CoordinatorとKernelLock取得部品。
 * @security Hashだけから新しい回復Authorityを発行しない。
 * @concurrency 同期controller。非同期作業の待機は行わない。
 */
export function createDockerRecoveryRuntimeStateLockController(
  runtimeStateBindingHash: unknown,
) {
  return createController(() =>
    acquireRuntimeOwnedDockerRuntimeStateKernelLock(runtimeStateBindingHash),
  );
}

/**
 * 局所試験へ同じcontroller coreを接続する。
 *
 * @responsibility 実OS操作を持たない試験依存で返値と反復を反証する。
 * @trace ARCH-000008
 * @input acquire: 試験が所有する同期取得fixture。
 * @returns productionAuthority:falseと局所controller。
 * @precondition 試験依存は本番資源を操作しない。
 * @postcondition 本番と同じ状態処理を使用する。
 * @effect 渡された試験取得処理を呼び出す。
 * @failure 初回取得不成立・例外は本番と同じ扱い。
 * @invariant 公開indexやCapabilityへ再exportしない。
 * @boundary 内部の試験支援境界。
 * @security 本番取得依存や回復Authorityを公開しない。
 * @concurrency 同期fixtureだけを使用する。
 */
export function createIsolatedDockerRecoveryLockControllerCandidate(
  acquire: () => KernelLock | null,
) {
  return Object.freeze({
    productionAuthority: false as const,
    controller: createController(acquire),
  });
}
