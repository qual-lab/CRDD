/**
 * 実行・Groupの記録遷移と保持対象を決定する。
 * @responsibility 同一IDの再送・競合、Group参照、未解決保持を同じ記録集合へ適用する。
 * @trace ARCH-000018
 * @concurrency 保存OwnerがLock取得後に読んだ専有集合へ同期適用する。自ら排他やI/Oを行わない。
 */
import type { Execution, ExecutionGroup, Records } from "./types.ts";
import {
  recordObject,
  snapshot,
  validateExecution,
  validateGroup,
} from "./validation.ts";

/**
 * 専有集合へ開始・終了を一度適用し、同内容再送と異内容競合を区別する。
 * @precondition 同じLock内のfresh履歴と、snapshotで固定済みの入力だけを受ける。
 * @failure 不正な候補・開始欠測・競合・未知又は終了済みGroupを例外で拒否する。
 * @effect 候補検査後に渡された集合だけを変更する。保存・排他・結果封筒は所有しない。
 */
export function applyRecord(
  records: Records,
  kind: "execution" | "group",
  id: string,
  phase: "create" | "complete",
  data: unknown,
): "record_already_created" | "record_already_completed" | null {
  const list: (Execution | ExecutionGroup)[] =
    kind === "execution" ? records.executions : records.groups;
  const current = list.find(
    (v) => ("executionId" in v ? v.executionId : v.groupId) === id,
  );
  let candidate: Execution | ExecutionGroup;
  if (phase === "create") {
    if (
      Object.hasOwn(recordObject(data), "state") ||
      Object.hasOwn(recordObject(data), "completion")
    )
      throw Error("record_fields_invalid");
    candidate = { ...recordObject(data), state: "open", completion: null } as
      | Execution
      | ExecutionGroup;
    if (
      (kind === "execution" && (candidate as Execution).executionId !== id) ||
      (kind === "group" && (candidate as ExecutionGroup).groupId !== id)
    )
      throw Error("record_identity_invalid");
    if (current) {
      const { state: _state, completion: _completion, ...created } = current;
      if (JSON.stringify(snapshot(created)) !== JSON.stringify(data))
        throw Error("record_identity_conflict");
      return "record_already_created";
    }
  } else {
    if (!current) throw Error("record_not_found");
    if (current.state === "closed") {
      if (JSON.stringify(snapshot(current.completion)) !== JSON.stringify(data))
        throw Error("record_completion_conflict");
      return "record_already_completed";
    }
    candidate = { ...current, state: "closed", completion: data } as
      | Execution
      | ExecutionGroup;
  }
  if (kind === "execution") {
    const execution = candidate as Execution;
    validateExecution(execution);
    if (
      phase === "create" &&
      execution.groupId &&
      !records.groups.some(
        (g) => g.groupId === execution.groupId && g.state === "open",
      )
    )
      throw Error("group_not_open");
    records.executions = records.executions.filter((e) => e.executionId !== id);
    records.executions.push(execution);
  } else {
    validateGroup(candidate as ExecutionGroup);
    records.groups = records.groups.filter((g) => g.groupId !== id);
    records.groups.push(candidate as ExecutionGroup);
  }

  return null;
}

/**
 * 未完了・unknown・未解決と参照Groupを保護し、専有集合の期限整理を行う。
 * @precondition 検査済み集合と保存Ownerが一度確定した期限を受ける。同じLock区間でのみ使う。
 * @effect 渡された集合だけを変更する。File削除やGroupの子の終了確定は行わない。
 */
export function retainRecords(
  records: Records,
  kind: "execution" | "group",
  id: string,
  cutoff: number,
): void {
  records.executions = records.executions.filter(
    (e) =>
      e.completion === null ||
      e.completion?.retention === "unresolved" ||
      e.completion?.outcome.status === "unknown" ||
      Date.parse(e.completion.endedAt) >= cutoff ||
      (kind === "execution" && e.executionId === id),
  );
  const referenced = new Set(records.executions.map((e) => e.groupId));
  records.groups = records.groups.filter(
    (g) =>
      g.completion === null ||
      referenced.has(g.groupId) ||
      Date.parse(g.completion.endedAt) >= cutoff ||
      (kind === "group" && g.groupId === id),
  );
}
