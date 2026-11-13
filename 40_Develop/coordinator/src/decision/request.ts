/**
 * decision-requestに属する責務をまとめる。
 *
 * @responsibility CoordinatorDecisionRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */

import {
  type Decision,
  inspectDecision,
} from "../../../execution-model/src/index.ts";
import { snapshotJsonValue } from "../input/snapshot.ts";
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

export const COORDINATOR_HUMAN_DECISION_CONTRACT =
  "crdd-coordinator/orchestrator-human-decision/v2" as const;

const DECISION_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/** 判断本文の非空・制御文字条件だけを確認する。 */
function validDecisionRequestText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/** getterやProxyを評価せず既存codecで入力をコピーし、失敗時は値を返さない。 */
function captureDecisionRequestRecord(
  value: unknown,
): Record<string, unknown> | null {
  try {
    const result = snapshotJsonValue(value);
    return result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
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
  const v = captureDecisionRequestRecord(value);
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
      (x) => typeof x === "string" && DECISION_REQUEST_ID.test(x),
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
      !DECISION_REQUEST_ID.test(v.blockerId) ||
      typeof v.queueId !== "string" ||
      !DECISION_REQUEST_ID.test(v.queueId) ||
      !validDecisionRequestText(v.question) ||
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
          /[\r\n\u0000-\u001f\u007f]/u.test(v.comment)))
    )
      return null;
  } else if (v.operation === "apply") {
    if (!keys(v, common)) return null;
  } else if (v.operation === "close") {
    if (
      !keys(v, [...common, "status", "reason"]) ||
      v.status !== "invalidated" ||
      !validDecisionRequestText(v.reason)
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
  const v = captureDecisionRequestRecord(value);
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
    !validDecisionRequestText(v.reason) ||
    typeof v.cleanupConfirmed !== "boolean" ||
    typeof v.manualRecoveryRequired !== "boolean" ||
    !["settled", "no_effect", "unknown"].includes(String(v.effectState)) ||
    (v.decisionId !== null &&
      (typeof v.decisionId !== "string" ||
        !DECISION_REQUEST_ID.test(v.decisionId))) ||
    (v.recoveryId !== null &&
      (!validDecisionRequestText(v.recoveryId) ||
        Buffer.byteLength(v.recoveryId, "utf8") > 512))
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
      inspectDecision(decision) === null ||
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
          !validDecisionRequestText(h.reason))
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

import {
  type AcceptanceDecision,
  type AcceptanceTarget,
  isPrincipalId,
} from "../../../execution-model/src/index.ts";

export const COORDINATOR_ACCEPTANCE_DECISION_CONTRACT =
  "crdd-coordinator/orchestrator-acceptance-decision/v1" as const;

const recordAcceptanceID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * 受入判断Applicationの入力を定義する。
 *
 * @responsibility Source、対象、世代、判断、根拠および認証済みPrincipalを一つの要求へ結合する。
 * @trace ARCH-000005
 * @shape 受入判断に必要な入力Propertyを表す。
 * @invariant `SPEC-000002`だけをSourceとして許可し、Projection由来Sourceを受理しない。
 * @boundary Public Application入力とCoordinator Coreの境界。
 * @security 秘密値を入力として受けず、認証済みPrincipalのIdentityだけをAuthority検証へ渡す。
 * @compatibility 利用側はContract Revision 1の宣言済みPropertyだけへ依存する。
 */
export type CoordinatorAcceptanceDecisionRequest = Readonly<{
  contract: typeof COORDINATOR_ACCEPTANCE_DECISION_CONTRACT;
  decisionId: string;
  blockerId: string;
  sourceSpecId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: AcceptanceTarget;
  targetId: string;
  decision: AcceptanceDecision;
  criterionEvidenceIds: readonly string[];
  principalId: string;
}>;

/**
 * 受入判断要求の構造と固定語彙を検証する。
 *
 * @responsibility 不正Source、Identity、世代、判断、根拠およびPrincipalをEffect前に拒否する。
 * @trace ARCH-000005
 * @input input: CoordinatorAcceptanceDecisionRequest
 * @returns 有効な要求なら`true`、それ以外は`false`を返す。
 * @precondition 未信頼のTransport入力を型境界の内側で再検証する。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検証する。
 * @failure 不正入力は例外へ変えず`false`へ閉じる。
 * @invariant Projection用SPEC-000006／000007を受入判断Sourceへ昇格しない。
 * @boundary Transport入力とCoordinator Applicationの境界。
 * @security 認証済みPrincipalのIdentity以外のAuthority情報を出力または記録しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function validRequest(
  input: unknown,
): input is CoordinatorAcceptanceDecisionRequest {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return false;
  const candidate = input as Partial<CoordinatorAcceptanceDecisionRequest>;
  return (
    isPrincipalId(candidate.principalId) &&
    candidate.contract === COORDINATOR_ACCEPTANCE_DECISION_CONTRACT &&
    candidate.sourceSpecId === "SPEC-000002" &&
    [
      candidate.decisionId,
      candidate.blockerId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.targetId,
    ].every(
      (value) => typeof value === "string" && recordAcceptanceID.test(value),
    ) &&
    typeof candidate.repositoryRevision === "string" &&
    REVISION.test(candidate.repositoryRevision) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    Number(candidate.expectedGeneration) >= 1 &&
    (candidate.target === "objective" || candidate.target === "milestone") &&
    (candidate.decision === "accept" ||
      candidate.decision === "return" ||
      candidate.decision === "wait") &&
    Array.isArray(candidate.criterionEvidenceIds) &&
    candidate.criterionEvidenceIds.every(
      (value) => typeof value === "string" && recordAcceptanceID.test(value),
    ) &&
    new Set(candidate.criterionEvidenceIds).size ===
      candidate.criterionEvidenceIds.length
  );
}
