/** 任意の分析単位を記録する。子実行の状態を変更しない。 */
import { blockedWrite, snapshot, writeRecord } from "../storage/store.ts";
import type {
  GroupCreateInput,
  GroupCompleteInput,
  StoreOptions,
  WriteResult,
} from "./types.ts";
export function createGroup(
  store: StoreOptions,
  input: GroupCreateInput,
): WriteResult {
  let id = "";
  try {
    const value = snapshot(input);
    id = value.groupId;
    return writeRecord(store, "group", id, "create", value);
  } catch {
    return blockedWrite(id, "group_input_invalid");
  }
}
export function completeGroup(
  store: StoreOptions,
  groupId: string,
  result: GroupCompleteInput,
): WriteResult {
  return writeRecord(store, "group", groupId, "complete", result);
}
