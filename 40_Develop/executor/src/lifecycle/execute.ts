/**
 * 一回の技術実行の開始・取消配送・終端を所有する。
 * @responsibility 用途から独立した短命制御だけを保持し、認可・保存・資源操作は所有しない。
 * @trace ARCH-000008
 * @boundary Operation固有の許可確認とProcess取消接続。
 */
import type { IsolationExecution } from "../../../docker-isolation/src/index.ts";
import type { CancelResult, LifecycleControl } from "./types.ts";

/**
 * 三用途が共有する一回限りの実行制御を作る。
 * @responsibility 外部Signalと明示・内部停止を同じ取消印と一回配送へ接続する。
 * @trace ARCH-000008
 * @input N/A: 外部の権限・資源・保存先を受け取らない。
 * @returns 同じ実行だけの開始・取消・終端操作。
 * @effect 取消Signal、元Processへの一回配送、外部Signalの有界購読。
 * @failure 事前取消は開始拒否・終端化。配送失敗でも再配送しない。
 * @invariant 要求受理はProcess終了やCleanup確認ではない。
 * @concurrency 取消印は同期確定し、finishで外部購読を解除する。
 */
export function createLifecycleControl(): LifecycleControl {
  const controller = new AbortController();
  let started = false;
  let finished = false;
  let session: IsolationExecution | null = null;
  let delivery: Promise<boolean> | null = null;
  let removeExternalListener: (() => void) | null = null;

  /** 元Handlerへ一回だけ配送し、後着Rejectも捕捉する。 @trace ARCH-000008 */
  function deliver(): Promise<boolean> {
    if (!delivery && session) {
      const current = session;
      delivery = Promise.resolve().then(
        async () => (await current.cancel()).processTerminationObserved,
      );
      void delivery.catch(() => {});
    }
    return delivery ?? Promise.resolve(false);
  }
  /** 外部・明示・内部の取消を同じSignalへ固定する。 @trace ARCH-000008 */
  function requestCancellation(): Promise<boolean> {
    controller.abort();
    return deliver();
  }
  /** 終端後の取消を拒否し、外部購読と技術Handler参照を解放する。 @trace ARCH-000008 */
  function finish(): void {
    finished = true;
    removeExternalListener?.();
    removeExternalListener = null;
    session = null;
  }
  return Object.freeze({
    get signal() {
      return controller.signal;
    },
    get finished() {
      return finished;
    },
    get cancellationRequested() {
      return controller.signal.aborted;
    },
    start(externalSignal?: AbortSignal): boolean {
      if (started || finished) return false;
      if (controller.signal.aborted || externalSignal?.aborted) {
        controller.abort();
        finish();
        return false;
      }
      started = true;
      if (externalSignal) {
        const onAbort = () => {
          if (!finished) void requestCancellation();
        };
        removeExternalListener = () =>
          externalSignal.removeEventListener("abort", onAbort);
        try {
          externalSignal.addEventListener("abort", onAbort, { once: true });
          // 確認と登録の間に発生した取消も取りこぼさない。
          if (externalSignal.aborted) {
            onAbort();
            finish();
            return false;
          }
        } catch (error) {
          finish();
          throw error;
        }
      }
      return true;
    },
    async cancel(): Promise<CancelResult> {
      if (finished)
        return Object.freeze({ status: "blocked", reason: "invalid" });
      if (controller.signal.aborted)
        return Object.freeze({ status: "blocked", reason: "duplicate" });
      const handlerRegistered = session !== null;
      const observed = await requestCancellation();
      return observed
        ? Object.freeze({
            status: "requested",
            reason: "provider_cancellation_requested",
            cancellationRequested: true,
            processTerminationObserved: true,
          })
        : Object.freeze({
            status: "requested",
            reason: handlerRegistered
              ? "provider_cancellation_grace_exceeded"
              : "cancellation_requested",
            cancellationRequested: true,
            processTerminationObserved: false,
          });
    },
    bind(value: IsolationExecution): void {
      if (finished || session) return;
      session = value;
      if (controller.signal.aborted) void deliver();
    },
    finish,
  });
}
