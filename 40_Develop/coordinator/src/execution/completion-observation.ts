/**
 * 開始済みTaskの取消搬送と元の完了待機を所有する。
 *
 * @responsibility 上位Attemptの状態を持たず、同じTaskの完了を観測する。
 * @trace ARCH-000004
 */
import type { TaskCompletionObservation } from "./types.ts";

/**
 * 開始済みTaskへ取消を搬送し、元の完了結果を待つ。
 *
 * @responsibility 取消搬送、完了待機と監視解除を一つの呼出しへ収束させる。
 * @trace ARCH-000004
 * @input 検証済みのTask制御参照、完了Promise、固定取消操作と取消Signal。
 * @returns 完了の観測結果。Promise拒否はunknownとして返す。
 * @precondition 呼出し側が開始結果と各入力の形を検証済みである。
 * @postcondition 元の完了待機が終端し、登録したabort監視を解除する。
 * @effect 同じTaskへ取消要求を渡す。新しいTaskやProvider要求は作らない。
 * @failure 取消の失敗で完了待機を切り離さず、完了拒否は未観測として保持する。
 * @invariant Signalによる取消搬送は一度だけで、取消の応答をcleanupの根拠にしない。
 * @boundary 開始済みTaskの制御参照と完了通知のProcess内境界。
 * @security 制御参照や未検証の完了値を公開結果・ログへ出さない。
 * @concurrency 登録前の同期取消も確認し、元のPromiseを必ず待つ。
 */
export async function observeCoordinatorTaskCompletion(
  started: Readonly<{
    controlCapability: object;
    completion: Promise<unknown>;
  }>,
  cancelTask: (controlCapability: object) => unknown,
  cancellationSignal: AbortSignal,
): Promise<TaskCompletionObservation> {
  let cancellationTransferred = false;
  /**
   * 同じTaskへSignal取消を一度だけ転送する。
   *
   * @responsibility 取消搬送の重複と未処理rejectionを防ぎ、元の完了待機を維持する。
   * @trace ARCH-000004
   * @input N/A: 閉包内の制御参照と搬送状態を使用する。
   * @returns N/A: 完了結果を返さない。
   * @precondition 開始結果の制御参照が検証済みである。
   * @postcondition 取消搬送済みの事実を保持し、再呼出しで重複搬送しない。
   * @effect 同じTaskの固定取消操作へ要求を渡す。
   * @failure 同期例外とPromise拒否を処置し、完了待機へ委ねる。
   * @invariant 取消搬送をcleanup成立として扱わない。
   * @boundary Process内の取消SignalとTask制御操作。
   * @security 新しいAuthorityやTaskを作らない。
   * @concurrency 搬送済みフラグを取消呼出し前に確定する。
   */
  const forwardCancellation = () => {
    if (cancellationTransferred) return;
    cancellationTransferred = true;
    try {
      const settlement = cancelTask(started.controlCapability);
      if (settlement instanceof Promise) settlement.catch(() => {});
    } catch {
      // 取消入口の失敗で元の完了待機を切り離さない。
    }
  };
  cancellationSignal.addEventListener("abort", forwardCancellation, {
    once: true,
  });
  if (cancellationSignal.aborted) forwardCancellation();
  try {
    const rawCompletion: unknown = await started.completion;
    return { status: "observed", rawCompletion, cancellationTransferred };
  } catch {
    return { status: "unknown" };
  } finally {
    cancellationSignal.removeEventListener("abort", forwardCancellation);
  }
}
