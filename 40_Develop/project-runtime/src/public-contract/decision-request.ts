import { snapshotPlainRecord } from "../boundary/plain-data-snapshot.ts";

export const PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT =
  "crdd-coordinator/project-runtime-human-decision/v1" as const;

/**
 * ProjectRuntimeDecisionRequestが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDecisionRequestに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionRequestの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeDecisionRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeDecisionRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionRequest = Readonly<{
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
 * validIdの処理を実行する。
 *
 * @responsibility validIdに対応する入力処理と結果生成を所有する。
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
 * validRevisionの処理を実行する。
 *
 * @responsibility validRevisionに対応する入力処理と結果生成を所有する。
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
 * validCapabilityの処理を実行する。
 *
 * @responsibility validCapabilityに対応する入力処理と結果生成を所有する。
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
 * validCommentの処理を実行する。
 *
 * @responsibility validCommentに対応する入力処理と結果生成を所有する。
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
 * inspectProjectRuntimeDecisionRequestの処理を実行する。
 *
 * @responsibility inspectProjectRuntimeDecisionRequestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns ProjectRuntimeDecisionRequest | nullを返す。
 * @precondition 「value: unknown」がinspectProjectRuntimeDecisionRequestの入力契約を満たす。
 * @postcondition inspectProjectRuntimeDecisionRequestの責務を完了した結果だけを返す。
 * @effect N/A: inspectProjectRuntimeDecisionRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectProjectRuntimeDecisionRequestは独自の失敗分岐を所有しない。
 * @invariant inspectProjectRuntimeDecisionRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectProjectRuntimeDecisionRequestはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectProjectRuntimeDecisionRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectProjectRuntimeDecisionRequestは共有非同期状態を持たない同期処理である。
 */
export function inspectProjectRuntimeDecisionRequest(
  value: unknown,
): ProjectRuntimeDecisionRequest | null {
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
  return Object.freeze({ ...request }) as ProjectRuntimeDecisionRequest;
}
