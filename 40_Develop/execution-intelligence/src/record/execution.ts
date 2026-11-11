/**
 * 一回のAI実行の開始・終了観測を保存する入口。
 * @responsibility 実行IDと入力を保存Ownerへ渡し、AI Processの制御は呼出し側に残す。
 * @trace ARCH-000018
 */
import { blockedWrite, writeRecord } from "../storage/store.ts";
import { snapshot } from "./validation.ts";
import type {
  ExecutionCreateInput,
  ExecutionCompleteInput,
  StoreOptions,
  WriteResult,
} from "./types.ts";
/**
 * 開始要求直前の観測をopenとして記録する。実際のAI開始を保証しない。
 * @failure 不正入力は保存前に拒否し、保存・解放不明は同じ記録ID付きの結果を返す。
 * @effect 共通Lock内で履歴を更新し、保存確認・後始末まで同期で待つ。
 */
export function createExecution(
  store: StoreOptions,
  input: ExecutionCreateInput,
): WriteResult {
  let id = "";
  try {
    const value = snapshot(input);
    id = value.executionId;
    return writeRecord(store, "execution", id, "create", value);
  } catch {
    return blockedWrite(id, "execution_input_invalid");
  }
}
/**
 * 同じ実行IDの終了を一度確定する。同内容再送は受理し、確定済み結果の変更は拒否する。
 * @failure 開始欠測・競合・観測不能はblocked。保存不明で自動再送しない。
 * @effect 履歴の保存・後始末を待つ。AIや呼出し側の資源は回収しない。
 */
export function completeExecution(
  store: StoreOptions,
  executionId: string,
  result: ExecutionCompleteInput,
): WriteResult {
  return writeRecord(store, "execution", executionId, "complete", result);
}
