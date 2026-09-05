import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export type ProjectRuntimeObjectiveRequest = Readonly<{
  requestId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
  maximumConcurrency: number;
  maximumReplans: number;
  originLane: "interactive" | "scheduled";
  adoptResult: boolean;
  requestedExecutorProvider?: "auto" | "codex" | "claude";
  decisionCapabilityReplacement?: Readonly<{
    decisionId: string;
    replacementRequestId: string;
  }>;
}>;

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

function inspectStrings(
  value: unknown,
  maximumItems: number,
  maximumText: number,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, maximumItems);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    !snapshot.value.every((entry) => validText(entry, maximumText)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

const REQUIRED_REQUEST_KEYS = Object.freeze([
  "requestId",
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "maximumConcurrency",
  "maximumReplans",
  "originLane",
  "adoptResult",
] as const);
const OPTIONAL_REQUEST_KEYS = Object.freeze([
  "decisionCapabilityReplacement",
  "requestedExecutorProvider",
] as const);
const requestKeySets = Object.freeze(
  [0, 1, 2, 3].map(
    (mask) =>
      new Set([
        ...REQUIRED_REQUEST_KEYS,
        ...OPTIONAL_REQUEST_KEYS.filter(
          (_optional, index) => (mask & (1 << index)) !== 0,
        ),
      ]),
  ),
);

export function inspectProjectRuntimeObjectiveRequest(
  value: unknown,
): ProjectRuntimeObjectiveRequest | null {
  const requestSnapshot = requestKeySets.reduce<Readonly<
    Record<string, unknown>
  > | null>(
    (accepted, keys) => accepted ?? snapshotPlainRecord(value, keys),
    null,
  );
  if (!requestSnapshot) return null;
  const request: Readonly<Record<string, unknown>> = requestSnapshot;
  const acceptanceCriteria = inspectStrings(
    request.acceptanceCriteria,
    128,
    2_048,
  );
  const allowedPaths = inspectStrings(request.allowedPaths, 128, 512);
  const readPaths = inspectStrings(request.readPaths, 128, 512);
  const replacement =
    request.decisionCapabilityReplacement === undefined
      ? undefined
      : snapshotPlainRecord(
          request.decisionCapabilityReplacement,
          new Set(["decisionId", "replacementRequestId"] as const),
        );
  if (
    !validId(request.requestId) ||
    !validId(request.projectId) ||
    !validId(request.milestoneId) ||
    !validRevision(request.repositoryRevision) ||
    !validText(request.objective, 16_384) ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths ||
    !Number.isSafeInteger(request.maximumConcurrency) ||
    (request.maximumConcurrency as number) < 1 ||
    (request.maximumConcurrency as number) > 5 ||
    !Number.isSafeInteger(request.maximumReplans) ||
    (request.maximumReplans as number) < 0 ||
    (request.maximumReplans as number) > 32 ||
    (request.originLane !== "interactive" &&
      request.originLane !== "scheduled") ||
    typeof request.adoptResult !== "boolean" ||
    (request.requestedExecutorProvider !== undefined &&
      request.requestedExecutorProvider !== "auto" &&
      request.requestedExecutorProvider !== "codex" &&
      request.requestedExecutorProvider !== "claude") ||
    (request.decisionCapabilityReplacement !== undefined &&
      (!replacement ||
        !validId(replacement.decisionId) ||
        !validId(replacement.replacementRequestId)))
  )
    return null;
  return Object.freeze({
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    objective: request.objective,
    acceptanceCriteria,
    allowedPaths,
    readPaths,
    maximumConcurrency: request.maximumConcurrency as number,
    maximumReplans: request.maximumReplans as number,
    originLane: request.originLane,
    adoptResult: request.adoptResult,
    ...(request.requestedExecutorProvider
      ? {
          requestedExecutorProvider: request.requestedExecutorProvider as
            | "auto"
            | "codex"
            | "claude",
        }
      : {}),
    ...(replacement
      ? {
          decisionCapabilityReplacement: Object.freeze({
            decisionId: replacement.decisionId as string,
            replacementRequestId: replacement.replacementRequestId as string,
          }),
        }
      : {}),
  });
}
