import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { containsRecognizedSecretScope } from "./secret-material-policy.ts";

/**
 * Providerが扱う値の構造を表す。
 *
 * @responsibility Providerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";

const REQUEST_KEYS = new Set([
  "frontProvider",
  "requestedExecutorProvider",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
]);
/**
 * snapshotCoordinatorTaskRequestの処理を実行する。
 *
 * @responsibility snapshotCoordinatorTaskRequestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns snapshotCoordinatorTaskRequestの計算結果を返す。
 * @precondition 「rawRequest: unknown」がsnapshotCoordinatorTaskRequestの入力契約を満たす。
 * @postcondition snapshotCoordinatorTaskRequestの責務を完了した結果だけを返す。
 * @effect N/A: snapshotCoordinatorTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotCoordinatorTaskRequestは独自の失敗分岐を所有しない。
 * @invariant snapshotCoordinatorTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotCoordinatorTaskRequestはProcess内の同一Subsystemで完結する。
 * @security snapshotCoordinatorTaskRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotCoordinatorTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function snapshotCoordinatorTaskRequest(rawRequest: unknown) {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  const acceptance = request
    ? snapshotPlainArray<string>(request.acceptanceCriteria, 16)
    : null;
  const paths = request
    ? snapshotPlainArray<string>(request.allowedPaths, 64)
    : null;
  const requestedReadPaths =
    request && request.readPaths !== undefined
      ? snapshotPlainArray<string>(request.readPaths, 64)
      : paths;
  if (
    !request ||
    (request.frontProvider !== "codex" && request.frontProvider !== "claude") ||
    (request.requestedExecutorProvider !== undefined &&
      request.requestedExecutorProvider !== "auto" &&
      request.requestedExecutorProvider !== "codex" &&
      request.requestedExecutorProvider !== "claude") ||
    typeof request.objective !== "string" ||
    request.objective.length === 0 ||
    acceptance?.status !== "ok" ||
    paths?.status !== "ok" ||
    requestedReadPaths?.status !== "ok" ||
    acceptance.value.length === 0 ||
    paths.value.length === 0 ||
    !acceptance.value.every((value) => typeof value === "string") ||
    !paths.value.every((value) => typeof value === "string") ||
    !requestedReadPaths.value.every((value) => typeof value === "string")
  ) {
    return null;
  }
  const readPaths = [
    ...new Map(
      [...requestedReadPaths.value, ...paths.value].map((value) => [
        value.toUpperCase(),
        value,
      ]),
    ).values(),
  ];
  if (readPaths.length > 64) return null;
  const normalized = Object.freeze({
    ...request,
    frontProvider: request.frontProvider as Provider,
    requestedExecutorProvider:
      request.requestedExecutorProvider === "codex" ||
      request.requestedExecutorProvider === "claude"
        ? request.requestedExecutorProvider
        : "auto",
    objective: request.objective,
    acceptanceCriteria: acceptance.value,
    allowedPaths: paths.value,
    readPaths: Object.freeze(readPaths),
    workClass: request.workClass,
    planState: request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: request.isLocalCandidateOnly,
    hasUnresolvedDirection: request.hasUnresolvedDirection,
    requiresCrossContextAlignment: request.requiresCrossContextAlignment,
  });
  return containsRecognizedSecretScope(
    normalized.objective,
    normalized.acceptanceCriteria,
    normalized.allowedPaths,
    normalized.readPaths,
  )
    ? Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_task_scope_recognized_secret_rejected" as const,
      })
    : Object.freeze({ status: "accepted" as const, request: normalized });
}
