/**
 * 判断操作の入力・公開結果を閉形式で検査する。
 * @packageDocumentation
 * @responsibility 要求・回答・適用・閉鎖の値を共通モデルへ対応付ける。
 * @trace ARCH-000004、ARCH-000008
 * @boundary Domain値と認証済み入口。認可・保存は行わない。
 */
import { encodeRuntimeStateValue } from "../state/codec.ts";
import { projectDecisionHistory } from "./operations.ts";
import type { Decision } from "./types.ts";

export const COORDINATOR_HUMAN_DECISION_CONTRACT =
  "crdd-coordinator/orchestrator-human-decision/v2" as const;

/** 認証済み入口が同じ対象へ搬送する判断操作。Bearerや自由入力の主体を含まない。 */
export type CoordinatorDecisionRequest = Readonly<{
  operation: "request" | "answer" | "apply" | "close";
  decisionId: string;
  projectId: string;
  milestoneId: string;
  generation: number;
  repositoryRevision: string;
}> &
  (
    | Readonly<{
        operation: "request";
        blockerId: string;
        queueId: string;
        question: string;
        allowedOptions: readonly ("resume" | "cancel")[];
      }>
    | Readonly<{
        operation: "answer";
        selectedOption: "resume" | "cancel";
        comment?: string;
      }>
    | Readonly<{ operation: "apply" }>
    | Readonly<{
        operation: "close";
        status: "invalidated";
        reason: string;
      }>
  );

/** 状態と履歴の確定を区別する非秘密な公開結果。 */
export type CoordinatorDecisionResult = Readonly<{
  contract: typeof COORDINATOR_HUMAN_DECISION_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  decisionId: string | null;
  recoveryId: string | null;
  decision: Decision | null;
  history:
    | Readonly<{ status: "confirmed" }>
    | Readonly<{ status: "unconfirmed"; reason: string }>
    | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  effectState: "settled" | "no_effect" | "unknown";
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
/** 判断本文の非空・UTF-8容量・制御文字条件だけを確認する。 */
function text(value: unknown, limit: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, "utf8") <= limit &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}
/** getterやProxyを評価せず既存codecで入力をコピーし、失敗時は値を返さない。 */
function capture(value: unknown): Record<string, unknown> | null {
  try {
    const result = JSON.parse(encodeRuntimeStateValue(value));
    return result && typeof result === "object" && !Array.isArray(result)
      ? result
      : null;
  } catch {
    return null;
  }
}
/** fieldの欠測と余分なfieldを同じ閉集合で拒否する。 */
function keys(value: object, names: readonly string[]): boolean {
  return Object.keys(value).sort().join() === [...names].sort().join();
}

/**
 * 認証主体を含まない判断操作だけを閉形式で取得する。
 * @responsibility 旧Bearer・再発行fieldを黙って無視せず拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input value: 未信頼JSON値。
 * @returns 正規化した操作又はnull。
 * @precondition 認証・認可は信頼入口で別途確認する。
 * @postcondition getter等を評価せず、未知fieldを捨てない。
 * @effect N/A: 値検査のみ。
 * @failure 不正形・未知操作・対象不足はnull。
 * @invariant 入力をAuthorityへ変換しない。
 * @boundary Transportと判断値。
 * @security 主体・秘密値を推測又は補完しない。
 * @concurrency 同期の局所計算のみ。
 */
export function inspectCoordinatorDecisionRequest(
  value: unknown,
): CoordinatorDecisionRequest | null {
  const v = capture(value);
  const common = [
    "operation",
    "decisionId",
    "projectId",
    "milestoneId",
    "generation",
    "repositoryRevision",
  ];
  if (
    !v ||
    ![v.decisionId, v.projectId, v.milestoneId].every(
      (x) => typeof x === "string" && ID.test(x),
    ) ||
    !Number.isSafeInteger(v.generation) ||
    Number(v.generation) < 1 ||
    typeof v.repositoryRevision !== "string" ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(v.repositoryRevision)
  )
    return null;
  if (v.operation === "request") {
    if (
      !keys(v, [
        ...common,
        "blockerId",
        "queueId",
        "question",
        "allowedOptions",
      ]) ||
      typeof v.blockerId !== "string" ||
      !ID.test(v.blockerId) ||
      typeof v.queueId !== "string" ||
      !ID.test(v.queueId) ||
      !text(v.question, 8192) ||
      !Array.isArray(v.allowedOptions) ||
      v.allowedOptions.length < 1 ||
      v.allowedOptions.length > 2 ||
      new Set(v.allowedOptions).size !== v.allowedOptions.length ||
      !v.allowedOptions.every((x) => x === "resume" || x === "cancel")
    )
      return null;
  } else if (v.operation === "answer") {
    if (
      !keys(v, [
        ...common,
        "selectedOption",
        ...(Object.hasOwn(v, "comment") ? ["comment"] : []),
      ]) ||
      (v.selectedOption !== "resume" && v.selectedOption !== "cancel") ||
      (Object.hasOwn(v, "comment") &&
        (typeof v.comment !== "string" ||
          Buffer.byteLength(v.comment, "utf8") > 1024 ||
          /[\r\n\u0000-\u001f\u007f]/u.test(v.comment)))
    )
      return null;
  } else if (v.operation === "apply") {
    if (!keys(v, common)) return null;
  } else if (v.operation === "close") {
    if (
      !keys(v, [...common, "status", "reason"]) ||
      v.status !== "invalidated" ||
      !text(v.reason, 1024)
    )
      return null;
  } else return null;
  if (Array.isArray(v.allowedOptions)) Object.freeze(v.allowedOptions);
  return Object.freeze(v) as CoordinatorDecisionRequest;
}

/**
 * 公開判断結果の状態・履歴・回復要否を相関検査する。
 * @responsibility 部分確定を成功へ丸めず、旧秘密値を公開結果へ通さない。
 * @trace ARCH-000004、ARCH-000008
 * @input value: Coordinatorから搬送された未信頼値。
 * @returns 検査済み結果又はnull。
 * @precondition 返却値を認証・認可として使用しない。
 * @postcondition 未知fieldと矛盾した確定表示を拒否する。
 * @effect N/A: 値検査のみ。
 * @failure 不正形・判断と履歴の矛盾はnull。
 * @invariant 適用・履歴確定・実行再開を同一視しない。
 * @boundary Process結果と利用側表示。
 * @security 秘密値・Host Pathを追加しない。
 * @concurrency 同期の局所計算のみ。
 */
export function inspectCoordinatorDecisionResult(
  value: unknown,
): CoordinatorDecisionResult | null {
  const v = capture(value);
  if (
    !v ||
    !keys(v, [
      "contract",
      "status",
      "reason",
      "decisionId",
      "recoveryId",
      "decision",
      "history",
      "cleanupConfirmed",
      "manualRecoveryRequired",
      "effectState",
    ]) ||
    v.contract !== COORDINATOR_HUMAN_DECISION_CONTRACT ||
    (v.status !== "completed" && v.status !== "blocked") ||
    !text(v.reason, 1024) ||
    typeof v.cleanupConfirmed !== "boolean" ||
    typeof v.manualRecoveryRequired !== "boolean" ||
    !["settled", "no_effect", "unknown"].includes(String(v.effectState)) ||
    (v.decisionId !== null &&
      (typeof v.decisionId !== "string" || !ID.test(v.decisionId))) ||
    (v.recoveryId !== null && !text(v.recoveryId, 512))
  )
    return null;
  if (v.decision === null) {
    if (v.history !== null || v.status !== "blocked") return null;
    if (
      v.effectState !== "unknown" &&
      v.manualRecoveryRequired !== !v.cleanupConfirmed
    )
      return null;
    if (
      v.effectState === "unknown" &&
      (v.cleanupConfirmed !== false || v.manualRecoveryRequired !== true)
    )
      return null;
  } else {
    const decision = v.decision as Decision;
    if (
      projectDecisionHistory(decision) === null ||
      decision.decisionId !== v.decisionId ||
      v.effectState !== "settled"
    )
      return null;
    const h = v.history as { status?: unknown; reason?: unknown } | null;
    if (
      !h ||
      (h.status === "confirmed"
        ? !keys(h, ["status"])
        : h.status !== "unconfirmed" ||
          !keys(h, ["status", "reason"]) ||
          !text(h.reason, 1024))
    )
      return null;
    if (
      v.cleanupConfirmed !== (h.status === "confirmed") ||
      v.manualRecoveryRequired !== (h.status === "unconfirmed")
    )
      return null;
  }
  return v as CoordinatorDecisionResult;
}
