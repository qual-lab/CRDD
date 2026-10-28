/**
 * 人間判断要求の閉じた入力値を検査する。
 * @packageDocumentation
 * @responsibility 共有値の閉形式と相関を検査し、実行・保存・認可を発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary Domain値と利用側の入力・公開結果。
 */
import { snapshotPlainRecord } from "../state/validation.ts";
export const COORDINATOR_HUMAN_DECISION_CONTRACT =
  "crdd-coordinator/orchestrator-human-decision/v1" as const;

/**
 * decision-requestで使用するCoordinator Decision Requestの値契約を定義する。
 *
 * @responsibility Coordinator Decision RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionRequestの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionRequest = Readonly<{
  decisionId: string;
  projectId: string;
  milestoneId: string;
  generation: number;
  repositoryRevision: string;
  selectedOption: "resume" | "cancel";
  continuationCapability: string;
  comment?: string;
}>;

const requiredDecisionKeys = new Set([
  "decisionId",
  "projectId",
  "milestoneId",
  "generation",
  "repositoryRevision",
  "selectedOption",
  "continuationCapability",
] as const);

const decisionKeysWithComment = new Set([
  ...requiredDecisionKeys,
  "comment",
] as const);

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Capabilityが有効か判定する。
 *
 * @responsibility Capabilityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidCapabilityの入力契約を満たす。
 * @postcondition validCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: validCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validCapabilityは独自の失敗分岐を所有しない。
 * @invariant validCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validCapabilityはProcess内の同一Subsystemで完結する。
 * @security N/A: validCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validCapabilityは共有非同期状態を持たない同期処理である。
 */
function validCapability(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Commentが有効か判定する。
 *
 * @responsibility Commentの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidCommentの入力契約を満たす。
 * @postcondition validCommentの責務を完了した結果だけを返す。
 * @effect N/A: validCommentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validCommentは独自の失敗分岐を所有しない。
 * @invariant validCommentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validCommentはProcess内の同一Subsystemで完結する。
 * @security N/A: validCommentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validCommentは共有非同期状態を持たない同期処理である。
 */
function validComment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    new TextEncoder().encode(value).byteLength <= 1_024 &&
    !/[\r\n\u0000-\u001f\u007f]/u.test(value)
  );
}

/**
 * Coordinator Decision Requestを観測する。
 *
 * @responsibility Coordinator Decision Requestの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorDecisionRequest | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorDecisionRequestの入力契約を満たす。
 * @postcondition inspectCoordinatorDecisionRequestの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorDecisionRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorDecisionRequestは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorDecisionRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorDecisionRequestはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorDecisionRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorDecisionRequestは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorDecisionRequest(
  value: unknown,
): CoordinatorDecisionRequest | null {
  const request =
    snapshotPlainRecord(value, decisionKeysWithComment) ??
    snapshotPlainRecord(value, requiredDecisionKeys);
  const comment = (request as Readonly<Record<string, unknown>> | null)
    ?.comment;
  if (
    !request ||
    !validId(request.decisionId) ||
    !validId(request.projectId) ||
    !validId(request.milestoneId) ||
    !Number.isSafeInteger(request.generation) ||
    Number(request.generation) < 1 ||
    !validRevision(request.repositoryRevision) ||
    (request.selectedOption !== "resume" &&
      request.selectedOption !== "cancel") ||
    !validCapability(request.continuationCapability) ||
    (comment !== undefined && !validComment(comment))
  )
    return null;
  return Object.freeze({ ...request }) as CoordinatorDecisionRequest;
}
