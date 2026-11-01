/**
 * 一回の技術実行の開始・取消配送・終端を所有する。
 * @responsibility 用途から独立した短命制御だけを保持し、認可・保存・資源操作は所有しない。
 * @trace ARCH-000008
 * @boundary Operation固有の許可確認とProcess取消接続。
 */
import type { CancelResult, LifecycleOperations } from "./types.ts";

/**
 * 三用途が共有する一回限りの実行制御を作る。
 * @responsibility 取消印と終端の正本を一つにし、配送の失敗でも再配送しない。
 * @trace ARCH-000008
 * @input N/A: 外部の権限・資源・保存先を受け取らない。
 * @returns 同じ実行だけの開始・取消・終端操作。
 * @effect cancel時のSignal中断と、登録された元Processへの一回配送。
 * @failure 終端後・重複取消は追加処置せず拒否。配送例外は元呼出しへ返す。
 * @invariant 要求受理はProcess終了やCleanup確認ではない。
 * @concurrency 開始印・取消印はawaitより先に固定する。
 */
export function createLifecycleOperations(): LifecycleOperations {
  const controller = new AbortController();
  let signal = controller.signal;
  let started = false;
  let finished = false;
  let cancelProcess: (() => Promise<boolean>) | null = null;
  let delivery: Promise<boolean> | null = null;
  function deliver(): Promise<boolean> {
    if (!delivery && cancelProcess) {
      const handler = cancelProcess;
      delivery = Promise.resolve().then(handler);
      // 内部停止や遅延接続でも未処理Rejectを残さない。呼出し側のawaitは同じ失敗を受け取る。
      void delivery.catch(() => {});
    }
    return delivery ?? Promise.resolve(false);
  }
  return Object.freeze({
    get signal() {
      return signal;
    },
    get finished() {
      return finished;
    },
    get cancellationRequested() {
      return signal.aborted;
    },
    start(externalSignal?: AbortSignal): boolean {
      if (started || finished) return false;
      started = true;
      if (externalSignal)
        signal = AbortSignal.any([externalSignal, controller.signal]);
      return true;
    },
    async cancel(): Promise<CancelResult> {
      if (finished)
        return Object.freeze({ status: "blocked", reason: "invalid" });
      if (controller.signal.aborted)
        return Object.freeze({ status: "blocked", reason: "duplicate" });
      controller.abort();
      const observed = await deliver();
      return observed
        ? Object.freeze({
            status: "requested",
            reason: "provider_cancellation_requested",
            cancellationRequested: true,
            processTerminationObserved: true,
          })
        : Object.freeze({
            status: "requested",
            reason: cancelProcess
              ? "provider_cancellation_grace_exceeded"
              : "cancellation_requested",
            cancellationRequested: true,
            processTerminationObserved: false,
          });
    },
    bindCancellation(handler: () => Promise<boolean>): void {
      if (finished || cancelProcess) return;
      cancelProcess = handler;
      if (signal.aborted) void deliver();
    },
    finish(): void {
      finished = true;
      cancelProcess = null;
    },
  });
}
