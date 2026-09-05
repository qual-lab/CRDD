import { types as utilTypes } from "node:util";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";
import {
  inspectProjectRuntimeIntegrationResult,
  inspectProjectRuntimeDecisionRequest,
  inspectProjectRuntimeObjectiveRequest,
  isProjectRuntimeObjectiveProjectionCorrelationValid,
  isProjectRuntimeProjectionSemanticallyValid,
  PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
  PROJECT_RUNTIME_INTEGRATION_RESULT_FIELDS,
  PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  PROJECT_RUNTIME_MAXIMUM_TASKS,
  PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
  type ProjectRuntimeProjection,
} from "../../../project-runtime/src/index.ts";

export const MCP_PROJECT_RUNTIME_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL = "crdd.run_objective" as const;
export const MCP_PROJECT_RUNTIME_DECISION_TOOL =
  "crdd.submit_decision" as const;
export const MCP_PROJECT_RUNTIME_ADAPTER_CONTRACT =
  "crdd-mcp/project-runtime-adapter/v1" as const;
const PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT =
  "crdd-coordinator/project-runtime-public-runtime/v1" as const;

type JsonRpcId = string | number;
type McpResponse = Readonly<{
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: Readonly<{ code: number; message: string }>;
}>;
export type McpProjectRuntimeDependencies = Readonly<{
  authenticateClient: () => unknown;
  runObjective: (
    request: Readonly<Record<string, unknown>>,
    signal: AbortSignal,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
  submitDecision: (
    request: Readonly<Record<string, unknown>>,
    authentication: Readonly<{ principalId: string }>,
  ) => Promise<unknown>;
}>;

const requestKeys = new Set(["jsonrpc", "id", "method", "params"] as const);
const callKeys = new Set(["_meta", "name", "arguments"] as const);
const discoverKeys = new Set(["_meta"] as const);
const listKeys = new Set(["_meta", "cursor"] as const);
const listKeysNoCursor = new Set(["_meta"] as const);
const objectiveKeys = new Set([
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
  "decisionCapabilityReplacement",
  "requestedExecutorProvider",
] as const);
const decisionKeys = new Set([
  "decisionId",
  "projectId",
  "milestoneId",
  "generation",
  "repositoryRevision",
  "selectedOption",
  "continuationCapability",
  "comment",
] as const);
const decisionKeysNoComment = new Set(
  [...decisionKeys].filter((key) => key !== "comment"),
);
const OBJECTIVE_RESULT_KEYS = new Set([
  "contract",
  "status",
  "reason",
  "requestId",
  "projectId",
  "milestoneId",
  "queueId",
  "projection",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "processRestartRequired",
  "recoveryIds",
  "recoveryObligations",
  "effectState",
]);
const integrationResultWithDecisionKeys = new Set([
  ...PROJECT_RUNTIME_INTEGRATION_RESULT_FIELDS,
  "decision",
]);
const PUBLIC_BLOCKED_RESULT_KEYS = new Set([
  "contract",
  "status",
  "reason",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
]);
const decisionBlockedRestartKeys = new Set([
  ...PUBLIC_BLOCKED_RESULT_KEYS,
  "processRestartRequired",
  "recoveryId",
]);
const decisionAppliedResultKeys = new Set([
  "contract",
  "status",
  "reason",
  "decisionId",
  "applicationId",
  "generation",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
] as const);
const decisionIssuedResultKeys = new Set([
  "contract",
  "status",
  "reason",
  "decisionId",
  "recordId",
  "continuationCapability",
  "allowedOptions",
  "expiresAtEpochMs",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
] as const);
const decisionReplacedResultKeys = new Set([
  ...decisionIssuedResultKeys,
  "replacementRequestId",
]);
const decisionRecoveredResultKeys = new Set([
  "contract",
  "status",
  "reason",
  "decisionId",
  "applicationId",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
] as const);

function plain(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !utilTypes.isProxy(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
}
function validId(value: unknown): value is JsonRpcId {
  return (
    (typeof value === "string" && value.length > 0 && value.length <= 128) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}
function stable(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}
function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}
function envelope(value: unknown) {
  if (!plain(value)) return false;
  const allowed = new Set([
    "io.modelcontextprotocol/protocolVersion",
    "io.modelcontextprotocol/clientCapabilities",
    "io.modelcontextprotocol/clientInfo",
  ]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    value["io.modelcontextprotocol/protocolVersion"] ===
      MCP_PROJECT_RUNTIME_PROTOCOL_VERSION &&
    plain(value["io.modelcontextprotocol/clientCapabilities"])
  );
}
function objective(value: unknown): Readonly<Record<string, unknown>> | null {
  return inspectProjectRuntimeObjectiveRequest(value);
}
function error(
  id: JsonRpcId | null,
  code: number,
  message: string,
): McpResponse {
  return Object.freeze({
    jsonrpc: "2.0",
    id,
    error: Object.freeze({ code, message }),
  });
}
function complete(id: JsonRpcId, result: Readonly<Record<string, unknown>>) {
  return Object.freeze({
    jsonrpc: "2.0" as const,
    id,
    result: Object.freeze({
      resultType: "complete",
      ...result,
      _meta: Object.freeze({
        "io.modelcontextprotocol/serverInfo": Object.freeze({
          name: "crdd-coordinator",
          version: "0.19.0-development",
        }),
      }),
    }),
  });
}
function tool(
  name: string,
  title: string,
  description: string,
  properties: object,
  requiredItems: readonly string[],
) {
  return Object.freeze({
    name,
    title,
    description,
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze([...requiredItems]),
      properties: Object.freeze(properties),
    }),
  });
}
function definitions() {
  const id = Object.freeze({
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  });
  const rev = Object.freeze({ type: "string", pattern: "^[0-9a-f]{40,64}$" });
  const list = (maximum: number) =>
    Object.freeze({
      type: "array",
      minItems: 1,
      maxItems: maximum,
      items: Object.freeze({ type: "string" }),
    });
  return Object.freeze([
    tool(
      MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
      "CRDD Objectiveを実行",
      "検証済みProjectへObjectiveを登録し、Project Runtimeで実行します。",
      {
        requestId: id,
        projectId: id,
        milestoneId: id,
        repositoryRevision: rev,
        objective: Object.freeze({ type: "string", maxLength: 16_384 }),
        acceptanceCriteria: list(128),
        allowedPaths: list(128),
        readPaths: list(128),
        maximumConcurrency: Object.freeze({
          type: "integer",
          minimum: 1,
          maximum: 5,
        }),
        maximumReplans: Object.freeze({
          type: "integer",
          minimum: 0,
          maximum: 32,
        }),
        originLane: Object.freeze({
          enum: Object.freeze(["interactive", "scheduled"]),
        }),
        adoptResult: Object.freeze({ type: "boolean" }),
        decisionCapabilityReplacement: Object.freeze({
          type: "object",
          additionalProperties: false,
          required: Object.freeze(["decisionId", "replacementRequestId"]),
          properties: Object.freeze({
            decisionId: id,
            replacementRequestId: id,
          }),
        }),
        requestedExecutorProvider: Object.freeze({
          enum: Object.freeze(["auto", "codex", "claude"]),
        }),
      },
      [...objectiveKeys].filter(
        (key) =>
          key !== "decisionCapabilityReplacement" &&
          key !== "requestedExecutorProvider",
      ),
    ),
    tool(
      MCP_PROJECT_RUNTIME_DECISION_TOOL,
      "CRDDの判断を送信",
      "現在の判断要求へ、一回限りの継続権限を使って選択を返します。",
      {
        decisionId: id,
        projectId: id,
        milestoneId: id,
        generation: Object.freeze({ type: "integer", minimum: 1 }),
        repositoryRevision: rev,
        selectedOption: id,
        continuationCapability: Object.freeze({
          type: "string",
          maxLength: 512,
        }),
        comment: Object.freeze({ type: "string", maxLength: 1024 }),
      },
      [...decisionKeysNoComment],
    ),
  ]);
}
const objectiveCountKeys = new Set([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "blocked",
  "cancelled",
] as const);
const taskCountKeys = new Set([
  "planned",
  "waiting_dependency",
  "ready",
  "starting",
  "running",
  "cleanup_pending",
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "superseded",
] as const);
const projectionKeys = new Set([
  "projectId",
  "milestoneId",
  "generation",
  "milestoneState",
  "objectiveCounts",
  "taskCounts",
  "objectiveTaskSummaries",
  "workProgress",
  "qualityState",
  "humanDecisionRequired",
  "recoveryRequired",
  "nextAction",
] as const);

function countSnapshot(
  value: unknown,
  keys: ReadonlySet<string>,
  maximumTotal: number,
) {
  const record = snapshotPlainRecord(value, keys);
  if (
    !record ||
    [...keys].some(
      (key) => !Number.isSafeInteger(record[key]) || Number(record[key]) < 0,
    )
  )
    return null;
  let total = 0;
  for (const key of keys) {
    total += Number(record[key]);
    if (!Number.isSafeInteger(total) || total > maximumTotal) return null;
  }
  return Object.freeze(
    Object.fromEntries([...keys].map((key) => [key, Number(record[key])])),
  );
}

function projectionSnapshot(value: unknown) {
  const record = snapshotPlainRecord(value, projectionKeys);
  if (!record) return null;
  const objectiveCounts = countSnapshot(
    record.objectiveCounts,
    objectiveCountKeys,
    PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  );
  const taskCounts = countSnapshot(
    record.taskCounts,
    taskCountKeys,
    PROJECT_RUNTIME_MAXIMUM_TASKS,
  );
  const rawSummaries = snapshotPlainArray(
    record.objectiveTaskSummaries,
    PROJECT_RUNTIME_MAXIMUM_OBJECTIVES,
  );
  const objectiveTaskSummaries: Array<
    ProjectRuntimeProjection["objectiveTaskSummaries"][number]
  > = [];
  if (rawSummaries.status !== "ok") return null;
  for (const rawSummary of rawSummaries.value) {
    const summary = snapshotPlainRecord(
      rawSummary,
      new Set(["objectiveId", "objectiveState", "taskCounts"]),
    );
    const summaryTaskCounts = countSnapshot(
      summary?.taskCounts,
      taskCountKeys,
      PROJECT_RUNTIME_MAXIMUM_TASKS,
    );
    if (
      !summary ||
      !stable(summary.objectiveId) ||
      !objectiveCountKeys.has(summary.objectiveState as never) ||
      !summaryTaskCounts
    )
      return null;
    objectiveTaskSummaries.push(
      Object.freeze({
        objectiveId: String(summary.objectiveId),
        objectiveState: summary.objectiveState as never,
        taskCounts: summaryTaskCounts as never,
      }),
    );
  }
  if (
    !stable(record.projectId) ||
    !stable(record.milestoneId) ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    ![
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "cancelled",
    ].includes(String(record.milestoneState)) ||
    !objectiveCounts ||
    !taskCounts ||
    !["not_started", "in_progress", "tasks_complete"].includes(
      String(record.workProgress),
    ) ||
    !["not_evaluated", "integration_pending", "accepted", "blocked"].includes(
      String(record.qualityState),
    ) ||
    typeof record.humanDecisionRequired !== "boolean" ||
    typeof record.recoveryRequired !== "boolean" ||
    ![
      "schedule_task",
      "wait_for_task",
      "verify_objective_integration",
      "verify_milestone_integration",
      "human_decision",
      "recover",
      "complete",
    ].includes(String(record.nextAction))
  )
    return null;
  const projection = Object.freeze({
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    generation: record.generation,
    milestoneState: record.milestoneState,
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries: Object.freeze(objectiveTaskSummaries),
    workProgress: record.workProgress,
    qualityState: record.qualityState,
    humanDecisionRequired: record.humanDecisionRequired,
    recoveryRequired: record.recoveryRequired,
    nextAction: record.nextAction,
  }) as ProjectRuntimeProjection;
  return isProjectRuntimeProjectionSemanticallyValid(projection)
    ? projection
    : null;
}

function recoverySnapshot(rawIds: unknown, rawObligations: unknown) {
  const ids = snapshotPlainArray(rawIds, 128);
  const obligations = snapshotPlainArray(rawObligations, 128);
  if (ids.status !== "ok" || obligations.status !== "ok") return null;
  const copiedIds: string[] = [];
  for (const id of ids.value) {
    if (!text(id, 512) || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id))
      return null;
    copiedIds.push(id);
  }
  const copiedObligations: Readonly<{ kind: string; recoveryId: string }>[] =
    [];
  for (const raw of obligations.value) {
    const entry = snapshotPlainRecord(raw, new Set(["kind", "recoveryId"]));
    if (
      !entry ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "runtime_process",
      ].includes(String(entry.kind)) ||
      !text(entry.recoveryId, 512) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(String(entry.recoveryId))
    )
      return null;
    copiedObligations.push(
      Object.freeze({
        kind: String(entry.kind),
        recoveryId: String(entry.recoveryId),
      }),
    );
  }
  if (
    new Set(copiedIds).size !== copiedIds.length ||
    new Set(
      copiedObligations.map((entry) => `${entry.kind}\0${entry.recoveryId}`),
    ).size !== copiedObligations.length ||
    copiedIds.length !==
      new Set(copiedObligations.map((entry) => entry.recoveryId)).size ||
    copiedIds.some(
      (id) => !copiedObligations.some((entry) => entry.recoveryId === id),
    )
  )
    return null;
  return Object.freeze({
    recoveryIds: Object.freeze(copiedIds),
    recoveryObligations: Object.freeze(copiedObligations),
  });
}

function publicBlockedSnapshot(
  raw: unknown,
  expectedContracts: ReadonlySet<string>,
) {
  const record = snapshotPlainRecord(raw, PUBLIC_BLOCKED_RESULT_KEYS);
  if (
    !record ||
    !expectedContracts.has(String(record.contract)) ||
    record.status !== "blocked" ||
    !text(record.reason, 256) ||
    typeof record.cleanupConfirmed !== "boolean" ||
    typeof record.manualRecoveryRequired !== "boolean" ||
    !["no_effect", "settled", "unknown"].includes(String(record.effectState)) ||
    (record.effectState === "unknown" &&
      (record.cleanupConfirmed !== false ||
        record.manualRecoveryRequired !== true)) ||
    (record.effectState !== "unknown" &&
      (record.cleanupConfirmed !== true ||
        record.manualRecoveryRequired !== false))
  )
    return null;
  return Object.freeze({ ...record });
}

function decisionSnapshot(
  raw: unknown,
): Readonly<Record<string, unknown>> | null {
  const simple = publicBlockedSnapshot(
    raw,
    new Set([
      PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    ]),
  );
  if (simple) return simple;
  const restart = snapshotPlainRecord(raw, decisionBlockedRestartKeys);
  if (
    restart &&
    restart.status === "blocked" &&
    restart.contract === PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT &&
    text(restart.reason, 256) &&
    restart.cleanupConfirmed === false &&
    restart.manualRecoveryRequired === true &&
    restart.effectState === "unknown" &&
    restart.processRestartRequired === true &&
    (restart.recoveryId === null || stable(restart.recoveryId))
  )
    return Object.freeze({ ...restart });
  const applied = snapshotPlainRecord(raw, decisionAppliedResultKeys);
  if (
    applied &&
    applied.contract === PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT &&
    applied.status === "completed" &&
    text(applied.reason, 256) &&
    stable(applied.decisionId) &&
    stable(applied.applicationId) &&
    Number.isSafeInteger(applied.generation) &&
    Number(applied.generation) > 0 &&
    applied.cleanupConfirmed === true &&
    applied.manualRecoveryRequired === false &&
    applied.effectState === "settled"
  )
    return Object.freeze({ ...applied });
  const issued =
    snapshotPlainRecord(raw, decisionIssuedResultKeys) ??
    snapshotPlainRecord(raw, decisionReplacedResultKeys);
  if (issued) {
    const allowed = snapshotPlainArray(issued.allowedOptions, 2);
    if (
      issued.contract !== PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT ||
      issued.status !== "completed" ||
      !text(issued.reason, 256) ||
      !stable(issued.decisionId) ||
      !stable(issued.recordId) ||
      !text(issued.continuationCapability, 512) ||
      allowed.status !== "ok" ||
      allowed.value.length === 0 ||
      new Set(allowed.value).size !== allowed.value.length ||
      !allowed.value.every(
        (value) => value === "resume" || value === "cancel",
      ) ||
      !Number.isSafeInteger(issued.expiresAtEpochMs) ||
      Number(issued.expiresAtEpochMs) < 1 ||
      issued.cleanupConfirmed !== true ||
      issued.manualRecoveryRequired !== false ||
      issued.effectState !== "settled" ||
      (Object.hasOwn(issued, "replacementRequestId") &&
        !stable((issued as Record<string, unknown>).replacementRequestId))
    )
      return null;
    return Object.freeze({
      ...issued,
      allowedOptions: Object.freeze([...allowed.value]),
    });
  }
  const recovered = snapshotPlainRecord(raw, decisionRecoveredResultKeys);
  if (
    recovered &&
    recovered.contract === PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT &&
    recovered.status === "completed" &&
    text(recovered.reason, 256) &&
    stable(recovered.decisionId) &&
    (recovered.applicationId === null || stable(recovered.applicationId)) &&
    recovered.cleanupConfirmed === true &&
    recovered.manualRecoveryRequired === false &&
    recovered.effectState === "settled"
  )
    return Object.freeze({ ...recovered });
  return null;
}

function objectiveSnapshot(
  raw: unknown,
): Readonly<Record<string, unknown>> | null {
  const simple = publicBlockedSnapshot(
    raw,
    new Set([PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT]),
  );
  if (simple) return simple;
  const objective = snapshotPlainRecord(raw, OBJECTIVE_RESULT_KEYS);
  if (objective) {
    const recoveries = recoverySnapshot(
      objective.recoveryIds,
      objective.recoveryObligations,
    );
    const projection =
      objective.projection === null
        ? null
        : projectionSnapshot(objective.projection);
    const hasRecovery = Boolean(recoveries?.recoveryIds.length);
    const hasRuntimeProcessRecovery = Boolean(
      recoveries?.recoveryObligations.some(
        (entry) => entry.kind === "runtime_process",
      ),
    );
    const isCorrelationValid =
      projection === null ||
      isProjectRuntimeObjectiveProjectionCorrelationValid(
        {
          status: objective.status as "completed" | "blocked" | "cancelled",
          cleanupConfirmed: Boolean(objective.cleanupConfirmed),
          manualRecoveryRequired: Boolean(objective.manualRecoveryRequired),
          processRestartRequired: Boolean(objective.processRestartRequired),
          effectState: objective.effectState as
            | "no_effect"
            | "settled"
            | "unknown",
          recoveryCount: recoveries?.recoveryIds.length ?? 0,
        },
        projection,
      );
    if (
      objective.contract !== PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT ||
      !["completed", "blocked", "cancelled"].includes(
        String(objective.status),
      ) ||
      !text(objective.reason, 256) ||
      !stable(objective.requestId) ||
      !stable(objective.projectId) ||
      !stable(objective.milestoneId) ||
      (objective.queueId !== null && !stable(objective.queueId)) ||
      (objective.projection !== null && !projection) ||
      (projection !== null &&
        (projection.projectId !== objective.projectId ||
          projection.milestoneId !== objective.milestoneId)) ||
      typeof objective.cleanupConfirmed !== "boolean" ||
      typeof objective.manualRecoveryRequired !== "boolean" ||
      typeof objective.processRestartRequired !== "boolean" ||
      !recoveries ||
      !isCorrelationValid ||
      !["no_effect", "settled", "unknown"].includes(
        String(objective.effectState),
      ) ||
      (objective.status === "completed" &&
        (objective.cleanupConfirmed !== true ||
          objective.manualRecoveryRequired !== false ||
          objective.processRestartRequired !== false ||
          recoveries.recoveryIds.length !== 0 ||
          objective.effectState === "unknown")) ||
      (objective.effectState === "unknown" &&
        (objective.cleanupConfirmed !== false ||
          objective.manualRecoveryRequired !== true)) ||
      (objective.effectState !== "unknown" &&
        (objective.cleanupConfirmed !== true ||
          objective.manualRecoveryRequired !== false)) ||
      (hasRecovery &&
        (objective.status !== "blocked" ||
          objective.effectState !== "unknown" ||
          objective.cleanupConfirmed !== false ||
          objective.manualRecoveryRequired !== true)) ||
      (objective.status === "cancelled" &&
        (objective.cleanupConfirmed !== true ||
          objective.manualRecoveryRequired !== false ||
          objective.processRestartRequired !== false ||
          hasRecovery ||
          !["no_effect", "settled"].includes(String(objective.effectState)))) ||
      objective.processRestartRequired !== hasRuntimeProcessRecovery ||
      (objective.processRestartRequired === true &&
        (objective.status !== "blocked" ||
          objective.cleanupConfirmed !== false ||
          objective.manualRecoveryRequired !== true ||
          objective.effectState !== "unknown"))
    )
      return null;
    return Object.freeze({
      ...objective,
      projection,
      ...recoveries,
    });
  }
  const directIntegration = inspectProjectRuntimeIntegrationResult(raw);
  if (directIntegration) return directIntegration;
  const integratedWithDecision = snapshotPlainRecord(
    raw,
    integrationResultWithDecisionKeys,
  );
  if (!integratedWithDecision) return null;
  const decision = decisionSnapshot(integratedWithDecision.decision);
  if (!decision) return null;
  const integrationInput = Object.fromEntries(
    PROJECT_RUNTIME_INTEGRATION_RESULT_FIELDS.map((field) => [
      field,
      integratedWithDecision[field],
    ]),
  );
  const integration = inspectProjectRuntimeIntegrationResult(integrationInput);
  if (!integration) return null;
  return Object.freeze({
    ...integration,
    decision,
  });
}

/** Closed public result validator shared with release E2E verification. */
export function inspectMcpProjectRuntimeObjectiveResult(raw: unknown) {
  return objectiveSnapshot(raw);
}

export async function handleMcpProjectRuntimeRequest(
  rawRequest: unknown,
  dependencies: McpProjectRuntimeDependencies,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const request = snapshotPlainRecord(rawRequest, requestKeys);
  if (
    !request ||
    !validId(request.id) ||
    request.jsonrpc !== "2.0" ||
    typeof request.method !== "string"
  )
    return error(null, -32600, "Invalid Request");
  if (request.method === "server/discover") {
    const params = snapshotPlainRecord(request.params, discoverKeys);
    return !params || !envelope(params._meta)
      ? error(request.id, -32602, "Invalid params")
      : complete(request.id, {
          supportedVersions: Object.freeze([
            MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
          ]),
          capabilities: Object.freeze({ tools: Object.freeze({}) }),
          ttlMs: 0,
          cacheScope: "private",
        });
  }
  if (request.method === "tools/list") {
    const params =
      snapshotPlainRecord(request.params, listKeysNoCursor) ??
      snapshotPlainRecord(request.params, listKeys);
    const paramsRecord: Readonly<Record<string, unknown>> | null = params;
    return !params ||
      !envelope(params._meta) ||
      (Object.hasOwn(params, "cursor") && paramsRecord?.cursor !== null)
      ? error(request.id, -32602, "Invalid params")
      : complete(request.id, {
          tools: definitions(),
          ttlMs: 0,
          cacheScope: "private",
        });
  }
  if (request.method !== "tools/call")
    return error(request.id, -32601, "Method not found");
  const params = snapshotPlainRecord(request.params, callKeys);
  if (
    !params ||
    !envelope(params._meta) ||
    (params.name !== MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL &&
      params.name !== MCP_PROJECT_RUNTIME_DECISION_TOOL)
  )
    return error(request.id, -32602, "Invalid params");
  const args =
    params.name === MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL
      ? objective(params.arguments)
      : inspectProjectRuntimeDecisionRequest(params.arguments);
  if (!args) return error(request.id, -32602, "Invalid params");
  let authentication: unknown;
  try {
    authentication = dependencies.authenticateClient();
  } catch {
    authentication = null;
  }
  if (
    !plain(authentication) ||
    authentication.status !== "verified" ||
    !stable(authentication.principalId) ||
    Object.keys(authentication).some(
      (key) => key !== "status" && key !== "principalId",
    )
  )
    return complete(request.id, {
      content: Object.freeze([
        Object.freeze({
          type: "text",
          text: "利用者を確認できないため、処理を開始していません。",
        }),
      ]),
      structuredContent: Object.freeze({
        status: "blocked",
        reason: "project_runtime_mcp_client_not_authenticated",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect",
      }),
      isError: true,
    });
  let raw: unknown;
  const authenticatedContext = Object.freeze({
    principalId: String(authentication.principalId),
  });
  try {
    raw =
      params.name === MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL
        ? await dependencies.runObjective(args, signal, authenticatedContext)
        : await dependencies.submitDecision(args, authenticatedContext);
  } catch {
    raw = null;
  }
  let snapshot: ReturnType<typeof objectiveSnapshot> | null = null;
  try {
    snapshot =
      params.name === MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL
        ? objectiveSnapshot(raw)
        : decisionSnapshot(raw);
  } catch {
    snapshot = null;
  }
  const result =
    snapshot ??
    Object.freeze({
      status: "blocked",
      reason: "project_runtime_adapter_result_invalid",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  const isFailed = result.status !== "completed";
  return complete(request.id, {
    content: Object.freeze([
      Object.freeze({
        type: "text",
        text: isFailed
          ? "処理は完了していません。構造化された理由を確認してください。"
          : "処理が完了しました。",
      }),
    ]),
    structuredContent: result,
    isError: isFailed,
  });
}

export function describeMcpProjectRuntimeAdapterContract() {
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_ADAPTER_CONTRACT,
    protocolVersion: MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
    tools: Object.freeze([
      MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL,
      MCP_PROJECT_RUNTIME_DECISION_TOOL,
    ]),
    transportState: "stateless_per_request",
    clientMetadataAuthority: "none",
    projectModelOwnership: "project_runtime",
  });
}
