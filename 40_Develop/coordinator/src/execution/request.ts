/**
 * 単発AI実行要求を副作用のない値として検査する。
 *
 * @responsibility Task入力の閉集合と上限を検査し、実行や保存を発行しない。
 * @trace ARCH-000008
 */

import { inspectTaskExecutionSelections } from "../selection/validation.ts";
import type { BorrowedExecutionTarget } from "./operation.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
  containsRecognizedSecretScope,
} from "../../../domain-model/src/index.ts";

/**
 * execution-portで使用するCoordinator Single Task Attempt 入力の値契約を定義する。
 *
 * @responsibility Coordinator Single Task Attempt 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskAttemptInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskAttemptInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskAttemptInputの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskAttemptInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskAttemptInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskAttemptInput = Readonly<{
  operationId: string;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
  workspaceTarget?: BorrowedExecutionTarget;
}>;

const REQUEST_KEYS = new Set([
  "taskExecutionSelections",
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

/**
 * Coordinator Task Requestを所有Snapshotへ変換する。
 *
 * @responsibility Coordinator Task Requestの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns 正常時はacceptedとSnapshot、認識済み秘密情報はblocked、それ以外の入力不正はnull。
 * @precondition 任意値として受け取り、検査前には信頼しない。
 * @postcondition 明示field・固定選定と通信Hashの文法、配列上限を検査し、許可Pathを読取り範囲へ含める。
 * @effect N/A: snapshotCoordinatorTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不正な形・固定選定・通信Hash・配列上限はnull、認識済み秘密情報は固定blocked結果で拒否する。
 * @invariant snapshotCoordinatorTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotCoordinatorTaskRequestはProcess内の同一Subsystemで完結する。
 * @security snapshotCoordinatorTaskRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotCoordinatorTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function snapshotCoordinatorTaskRequest(rawRequest: unknown) {
  const request =
    snapshotPlainRecord(rawRequest, REQUEST_KEYS_WITH_NETWORK_POLICY) ??
    snapshotPlainRecord(rawRequest, REQUEST_KEYS);
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
    !inspectTaskExecutionSelections(request.taskExecutionSelections) ||
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
    taskExecutionSelections: inspectTaskExecutionSelections(
      request.taskExecutionSelections,
    ),
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
