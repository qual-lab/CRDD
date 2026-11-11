/**
 * 任意の実行Groupの開始・終了を記録する入口。
 * @responsibility Groupの生涯だけを保存し、子Executionの終了・成功を生成しない。
 * @trace ARCH-000018
 */
import { blockedWrite, writeRecord } from "../storage/store.ts";
import { snapshot } from "./validation.ts";
import type {
  GroupCreateInput,
  GroupCompleteInput,
  StoreOptions,
  WriteResult,
} from "./types.ts";
/**
 * 呼出し側が確定したGroup IDと開始観測を記録する。
 * @failure 不正入力・同IDの異内容は拒否し、保存不明と回収不明を結果へ保持する。
 * @effect 履歴を同期保存し、Lockと今回pendingの終了処置を待つ。
 */
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
/**
 * Group自身の終了を一度保存する。未完了の子は終了させない。
 * @failure 開始欠測・異内容再送・保存不明はblocked。同じIDを維持する。
 * @effect 保存確認・後始末まで同期で待つ。子を保持するGroupは期限だけで整理しない。
 */
export function completeGroup(
  store: StoreOptions,
  groupId: string,
  result: GroupCompleteInput,
): WriteResult {
  return writeRecord(store, "group", groupId, "complete", result);
}
