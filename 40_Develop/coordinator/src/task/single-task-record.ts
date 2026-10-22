/**
 * 計画Milestoneを持たない単発Taskの現在値を定義する。
 * @responsibility 非秘密の受付同一性と実行終端を既存Queueへ保存する。
 * @trace ARCH-000004
 */
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../input/plain-data-snapshot.ts";
import type { ProjectQueueEntry } from "../queue/types.ts";

/**
 * 単発実行の最小保存契約。
 * @responsibility 本文・回答・Authorityを保存せず元の実行参照を保つ。
 * @trace ARCH-000004
 * @shape 主体、Profile、Task／Attempt／Operation、段階、cleanupと回復参照。
 * @invariant 同じ受付の識別子を途中で付け替えない。
 * @boundary Repository-local Snapshot。
 * @security 資格・Prompt・回答本文は含めない。
 * @compatibility Project計画のTask／Milestoneと区別する。
 */
export type SingleTaskRecord = Readonly<{
  principalId: string;
  mode: "read_only_advice" | "workspace_edit";
  profileId: string;
  catalogRevision: number;
  taskId: string;
  attemptId: string;
  operationId: string;
  phase: "accepted" | "starting" | "running" | "settled";
  status: "pending" | "completed" | "blocked" | "cancelled" | "unknown";
  reason: string | null;
  cleanupConfirmed: boolean;
  recoveryIds: readonly string[];
  adviceOperation?: Readonly<{ operationId: string; hostRecoveryId: string }>;
}>;

const KEYS = new Set([
  "principalId",
  "mode",
  "profileId",
  "catalogRevision",
  "taskId",
  "attemptId",
  "operationId",
  "phase",
  "status",
  "reason",
  "cleanupConfirmed",
  "recoveryIds",
]);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * 保存する単発記録を閉検査し独立Snapshotにする。
 * @responsibility getter／Proxyと本文混入、終端の相関違反を拒否する。
 * @trace ARCH-000004
 * @input 未検証の記録。
 * @returns 検証済み凍結値、又はnull。
 * @precondition Authorityは呼出し元で検証する。
 * @postcondition 元入力の後続変更から分離する。
 * @effect なし。
 * @failure 不足・過剰・相関不一致はnull。
 * @invariant 不明を成功・回復なしへ丸めない。
 * @boundary Snapshot codec。
 * @security 保存fieldを固定し秘密・本文を許可しない。
 * @concurrency 同期の値検査のみ。
 */
export function inspectSingleTaskRecord(raw: unknown): SingleTaskRecord | null {
  const value =
    snapshotPlainRecord(raw, KEYS) ??
    snapshotPlainRecord(raw, new Set([...KEYS, "adviceOperation"]));
  if (
    !value ||
    Object.keys(value).length !==
      KEYS.size + (Object.hasOwn(value, "adviceOperation") ? 1 : 0)
  )
    return null;
  const adviceOperation = Object.hasOwn(value, "adviceOperation")
    ? snapshotPlainRecord(
        value.adviceOperation,
        new Set(["operationId", "hostRecoveryId"]),
      )
    : null;
  if (
    Object.hasOwn(value, "adviceOperation") &&
    (!adviceOperation ||
      Object.keys(adviceOperation).length !== 2 ||
      typeof adviceOperation.operationId !== "string" ||
      !ID.test(adviceOperation.operationId) ||
      typeof adviceOperation.hostRecoveryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(
        adviceOperation.hostRecoveryId,
      ) ||
      value.mode !== "read_only_advice" ||
      value.phase === "accepted")
  )
    return null;
  for (const key of [
    "principalId",
    "profileId",
    "taskId",
    "attemptId",
    "operationId",
  ])
    if (typeof value[key] !== "string" || !ID.test(value[key])) return null;
  if (
    typeof value.mode !== "string" ||
    !["read_only_advice", "workspace_edit"].includes(value.mode) ||
    !Number.isSafeInteger(value.catalogRevision) ||
    Number(value.catalogRevision) < 0 ||
    typeof value.phase !== "string" ||
    !["accepted", "starting", "running", "settled"].includes(value.phase) ||
    typeof value.status !== "string" ||
    !["pending", "completed", "blocked", "cancelled", "unknown"].includes(
      value.status,
    ) ||
    typeof value.cleanupConfirmed !== "boolean" ||
    !(
      value.reason === null ||
      (typeof value.reason === "string" &&
        /^[a-z][a-z0-9_]{0,255}$/u.test(value.reason))
    )
  )
    return null;
  const recoveries = snapshotPlainArray(value.recoveryIds, 64);
  if (recoveries.status !== "ok") return null;
  const recoveryIds: string[] = [];
  for (const recoveryId of recoveries.value) {
    if (
      typeof recoveryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(recoveryId)
    )
      return null;
    recoveryIds.push(recoveryId);
  }
  if (new Set(recoveryIds).size !== recoveryIds.length) return null;
  if (value.phase !== "settled") {
    if (
      value.status !== "pending" ||
      value.reason !== null ||
      value.cleanupConfirmed ||
      recoveryIds.length
    )
      return null;
  } else if (
    value.status === "pending" ||
    (["completed", "cancelled"].includes(value.status) &&
      (!value.cleanupConfirmed || recoveryIds.length))
  )
    return null;
  return Object.freeze({
    ...value,
    ...(adviceOperation
      ? { adviceOperation: Object.freeze(adviceOperation) }
      : {}),
    recoveryIds: Object.freeze(recoveryIds),
  }) as SingleTaskRecord;
}

/**
 * 単発記録とQueueの共同状態を確認する。
 * @responsibility 未回収の完了表示と段階混同をcodecで拒否する。
 * @trace ARCH-000004
 * @input JSONから確認したQueueと単発記録。
 * @returns 共同状態が成立する場合のみtrue。
 * @precondition 単発記録の閉検査が成功している。
 * @postcondition Owner喪失を成功へ変換しない。
 * @effect なし。
 * @failure 不整合はfalse。
 * @invariant Project計画用Queueへ適用しない。
 * @boundary 既存Snapshot codec。
 * @security 状態名から実資源の不存在を推定しない。
 * @concurrency 同期値検査。
 */
export function singleTaskQueueIsConsistent(
  queue: Pick<
    ProjectQueueEntry,
    "state" | "ownerGeneration" | "resumeCondition" | "resultReference"
  >,
  record: SingleTaskRecord,
): boolean {
  if (
    queue.state === "recovery_required" &&
    queue.ownerGeneration === null &&
    ["owner_loss", "exact_recovery"].includes(queue.resumeCondition ?? "") &&
    record.phase !== "settled"
  )
    return true;
  if (record.phase === "accepted")
    return (
      queue.state === "queued" &&
      queue.ownerGeneration === null &&
      queue.resumeCondition === null &&
      queue.resultReference === null
    );
  if (record.phase !== "settled")
    return (
      queue.state === "running" &&
      queue.ownerGeneration !== null &&
      queue.resumeCondition === null
    );
  if (!record.cleanupConfirmed || record.recoveryIds.length > 0)
    return queue.state === "recovery_required";
  return (
    queue.state ===
      (record.status === "cancelled" ? "cancelled" : "completed") &&
    queue.resumeCondition === null
  );
}
