/** AI実行の開始要求と終了観測を記録する。Processの制御は呼出し側が所有する。 */
import { blockedWrite, snapshot, writeRecord } from "../storage/store.ts";
import type {
  ExecutionCreateInput,
  ExecutionCompleteInput,
  StoreOptions,
  WriteResult,
} from "./types.ts";
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
export function completeExecution(
  store: StoreOptions,
  executionId: string,
  result: ExecutionCompleteInput,
): WriteResult {
  return writeRecord(store, "execution", executionId, "complete", result);
}
