import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { containsRecognizedSecretScope } from "./secret-material-policy.ts";

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
