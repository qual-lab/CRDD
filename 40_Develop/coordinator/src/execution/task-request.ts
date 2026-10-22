/**
 * 単発Task依頼のfieldと入力範囲を検査し、所有Snapshotへ取り込む。
 * @responsibility 許可されたfield、配列上限、Profile／通信Hashと認識済み秘密情報の拒否を所有する。
 * @trace ARCH-000004
 */
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../../../domain-model/src/index.ts";
import { containsRecognizedSecretScope } from "./secret-validation.ts";

/**
 * Task依頼に許可する二Providerを表す。
 *
 * @responsibility frontProviderをCodex／Claudeの識別子へ限定する。
 * @trace ARCH-000004
 * @shape codexまたはclaudeの文字列union。
 * @invariant 未知Providerを既定値へ補完しない。
 * @boundary Task入力Snapshot内部の型。
 * @security Provider識別子だけでは実行権限を持たない。
 * @compatibility 既存の二Providerを変更しない。
 */
type Provider = "codex" | "claude";

const REQUEST_KEYS = new Set([
  "frontProvider",
  "requestedExecutorProvider",
  "requestedProfileId",
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
const AUTOMATIC_REQUEST_KEYS = new Set([
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
const REQUEST_KEYS_WITH_NETWORK_POLICY = new Set([
  ...REQUEST_KEYS,
  "expectedNetworkPolicyHash",
]);
const AUTOMATIC_REQUEST_KEYS_WITH_NETWORK_POLICY = new Set([
  ...AUTOMATIC_REQUEST_KEYS,
  "expectedNetworkPolicyHash",
]);
/**
 * Coordinator Task Requestを所有Snapshotへ変換する。
 *
 * @responsibility Coordinator Task Requestの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns 正常時はacceptedとSnapshot、認識済み秘密情報はblocked、それ以外の入力不正はnull。
 * @precondition 任意値として受け取り、検査前には信頼しない。
 * @postcondition 明示field・Profileと通信Hashの文法、配列上限を検査し、許可Pathを読取り範囲へ含める。
 * @effect N/A: snapshotCoordinatorTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不正な形・Profile・通信Hash・配列上限はnull、認識済み秘密情報は固定blocked結果で拒否する。
 * @invariant snapshotCoordinatorTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotCoordinatorTaskRequestはProcess内の同一Subsystemで完結する。
 * @security snapshotCoordinatorTaskRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotCoordinatorTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function snapshotCoordinatorTaskRequest(rawRequest: unknown) {
  const request =
    snapshotPlainRecord(rawRequest, REQUEST_KEYS_WITH_NETWORK_POLICY) ??
    snapshotPlainRecord(
      rawRequest,
      AUTOMATIC_REQUEST_KEYS_WITH_NETWORK_POLICY,
    ) ??
    snapshotPlainRecord(rawRequest, REQUEST_KEYS) ??
    snapshotPlainRecord(rawRequest, AUTOMATIC_REQUEST_KEYS);
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
    (request.requestedProfileId !== undefined &&
      (typeof request.requestedProfileId !== "string" ||
        !/^PROFILE-[0-9]{6,}$/u.test(request.requestedProfileId))) ||
    (request.expectedNetworkPolicyHash !== undefined &&
      (typeof request.expectedNetworkPolicyHash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(request.expectedNetworkPolicyHash))) ||
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
    requestedProfileId:
      typeof request.requestedProfileId === "string"
        ? request.requestedProfileId
        : null,
    expectedNetworkPolicyHash:
      typeof request.expectedNetworkPolicyHash === "string"
        ? request.expectedNetworkPolicyHash
        : null,
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
