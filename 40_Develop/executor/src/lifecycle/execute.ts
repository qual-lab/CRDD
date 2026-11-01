/**
 * 準備済みOperationの実行・終了・清掃待機を共通順序で制御する。
 * @packageDocumentation
 * @responsibility 一次失敗を保持し、清掃と必要通知の完了後に固有結果を返す。
 * @trace ARCH-000008
 * @boundary 固有構成と技術実行。保存・Task順序・Provider結果の意味を所有しない。
 */
import type { LifecycleOperation, LifecycleOperations } from "./types.ts";

/**
 * 同じContextの実行と清掃を一回のPromiseへ収束させる。
 * @responsibility 清掃失敗で一次失敗を上書きせず固有の結果Ownerへ渡す。
 * @trace ARCH-000008
 * @input operation: 固有の通常操作、context: 準備済みの元構成。
 * @returns 清掃後に構築した固有結果。
 * @precondition prepareと実行許可・必要記録は開始Ownerが確定する。
 * @postcondition cleanupのPromiseが終わる前に結果を返さない。
 * @effect 同じ実行・清掃操作のみ。新しい資源や状態を所有しない。
 * @failure 一次例外を固有結果へ渡す。結果構築例外は呼出し元へ伝播する。
 * @invariant 終了不明から清掃成功を推測しない。
 * @boundary 共通の制御順序と用途固有の技術処置。
 * @security 不正な実行を別のOperationや自動再試行へ切り替えない。
 * @concurrency 実行→清掃→結果の順で全Promiseをjoinする。
 */
export async function executeLifecycle<TContext, TResult>(
  operation: LifecycleOperation<TContext, TResult>,
  context: TContext,
  control?: LifecycleOperations,
): Promise<TResult> {
  let failure: unknown = null;
  let failed = false;
  try {
    await operation.execute(context);
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    if (operation.shouldCleanup?.(context) !== false)
      await operation.cleanup(context);
  } catch (error) {
    if (!failed) failure = error;
    failed = true;
  }
  let result: TResult;
  try {
    result = operation.createResult(context, failure, failed);
  } finally {
    control?.finish();
  }
  try {
    const pending = operation.onCompleted?.(result);
    if (pending) void pending.catch(() => {});
  } catch {
    // 任意通知は確定済み結果や技術回収を変更しない。
  }
  return result;
}
