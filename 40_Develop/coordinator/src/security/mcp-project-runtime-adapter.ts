import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { types as utilTypes } from "node:util";

export const MCP_PROJECT_RUNTIME_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_PROJECT_RUNTIME_TOOL_NAME = "crdd.run_objective" as const;
export const MCP_PROJECT_RUNTIME_ADAPTER_CONTRACT =
  "crdd-coordinator/mcp-project-runtime-adapter/v1" as const;

const requestKeys = new Set(["jsonrpc", "id", "method", "params"] as const);
const envelopeRequiredKeys = new Set([
  "io.modelcontextprotocol/protocolVersion",
  "io.modelcontextprotocol/clientCapabilities",
] as const);
const envelopeWithClientKeys = new Set([
  ...envelopeRequiredKeys,
  "io.modelcontextprotocol/clientInfo",
] as const);
const implementationKeys = new Set(["name", "version"] as const);
const discoverParamsKeys = new Set(["_meta"] as const);
const listParamsKeys = new Set(["_meta", "cursor"] as const);
const listParamsWithoutCursorKeys = new Set(["_meta"] as const);
const callParamsKeys = new Set(["_meta", "name", "arguments"] as const);
const objectiveKeys = new Set([
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "frontProvider",
  "requestedExecutorProvider",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
] as const);
const taskResultKeys = new Set([
  "status",
  "reason",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "processRestartRequired",
  "candidateId",
  "recoveryIds",
] as const);

type JsonRpcId = string | number;
type McpResponse = Readonly<{
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: Readonly<{ code: number; message: string }>;
}>;

export type McpProjectRuntimeBindingResult =
  | Readonly<{
      status: "verified";
      bindingCapability: object;
      repositoryRevision: string;
    }>
  | Readonly<{ status: "blocked"; reason: string }>;

export type McpProjectRuntimeTaskResult = Readonly<{
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
}>;

export type McpProjectRuntimeDependencies = Readonly<{
  verifyProjectBinding: (
    input: Readonly<{
      projectId: string;
      milestoneId: string;
      repositoryRevision: string;
    }>,
  ) => McpProjectRuntimeBindingResult;
  runSingleTask: (
    taskRequest: Readonly<Record<string, unknown>>,
    bindingCapability: object,
    signal: AbortSignal,
  ) => Promise<unknown>;
}>;

function responseMeta() {
  return Object.freeze({
    "io.modelcontextprotocol/serverInfo": Object.freeze({
      name: "crdd-coordinator",
      version: "0.19.0-development",
    }),
  });
}

function complete(id: JsonRpcId, result: Readonly<Record<string, unknown>>) {
  return Object.freeze({
    jsonrpc: "2.0" as const,
    id,
    result: Object.freeze({
      resultType: "complete",
      ...result,
      _meta: responseMeta(),
    }),
  });
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

function validId(value: unknown): value is JsonRpcId {
  return (
    (typeof value === "string" && value.length > 0 && value.length <= 128) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

function validStableIdentity(value: unknown): value is string {
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
    !value.includes("\0")
  );
}

function inspectUnusedMetadataRecord(value: unknown, maximumKeys: number) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    )
      return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    return (
      keys.length <= maximumKeys &&
      keys.every((key) => {
        if (typeof key !== "string" || key.length === 0 || key.length > 128)
          return false;
        const descriptor = descriptors[key];
        return Boolean(
          descriptor &&
            Object.hasOwn(descriptor, "value") &&
            descriptor.get === undefined &&
            descriptor.set === undefined &&
            descriptor.enumerable === true,
        );
      })
    );
  } catch {
    return false;
  }
}

function inspectEnvelope(value: unknown) {
  const envelope =
    snapshotPlainRecord(value, envelopeRequiredKeys) ??
    snapshotPlainRecord(value, envelopeWithClientKeys);
  if (!envelope) return false;
  const envelopeRecord: Readonly<Record<string, unknown>> = envelope;
  if (
    envelope["io.modelcontextprotocol/protocolVersion"] !==
      MCP_PROJECT_RUNTIME_PROTOCOL_VERSION ||
    !inspectUnusedMetadataRecord(
      envelope["io.modelcontextprotocol/clientCapabilities"],
      32,
    )
  )
    return false;
  const clientInfo = envelopeRecord["io.modelcontextprotocol/clientInfo"];
  if (clientInfo === undefined) return true;
  const implementation = snapshotPlainRecord(clientInfo, implementationKeys);
  return Boolean(
    implementation &&
      validText(implementation.name, 128) &&
      validText(implementation.version, 64),
  );
}

function inspectTaskResult(value: unknown): McpProjectRuntimeTaskResult | null {
  const result = snapshotPlainRecord(value, taskResultKeys);
  const recoveryIds = result
    ? snapshotPlainArray<string>(result.recoveryIds, 128)
    : null;
  if (
    !result ||
    (result.status !== "completed" &&
      result.status !== "blocked" &&
      result.status !== "cancelled") ||
    !validText(result.reason, 256) ||
    typeof result.cleanupConfirmed !== "boolean" ||
    typeof result.manualRecoveryRequired !== "boolean" ||
    typeof result.processRestartRequired !== "boolean" ||
    (result.candidateId !== null && !validText(result.candidateId, 512)) ||
    recoveryIds?.status !== "ok" ||
    recoveryIds.value.some((id) => !validText(id, 512)) ||
    new Set(recoveryIds.value).size !== recoveryIds.value.length ||
    (result.status === "completed" && !result.cleanupConfirmed)
  )
    return null;
  return Object.freeze({
    status: result.status,
    reason: result.reason,
    cleanupConfirmed: result.cleanupConfirmed,
    manualRecoveryRequired: result.manualRecoveryRequired,
    processRestartRequired: result.processRestartRequired,
    candidateId: result.candidateId,
    recoveryIds: Object.freeze([...recoveryIds.value]),
  });
}

function inspectStringArray(
  value: unknown,
  maximumItems: number,
  maximumText: number,
) {
  const snapshot = snapshotPlainArray<string>(value, maximumItems);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    !snapshot.value.every((item) => validText(item, maximumText))
  )
    return null;
  return snapshot.value;
}

function inspectObjectiveArguments(value: unknown) {
  const input = snapshotPlainRecord(value, objectiveKeys);
  if (!input) return null;
  const acceptanceCriteria = inspectStringArray(
    input.acceptanceCriteria,
    16,
    2048,
  );
  const allowedPaths = inspectStringArray(input.allowedPaths, 64, 512);
  const readPaths = inspectStringArray(input.readPaths, 64, 512);
  if (
    !validStableIdentity(input.projectId) ||
    !validStableIdentity(input.milestoneId) ||
    !validRevision(input.repositoryRevision) ||
    (input.frontProvider !== "codex" && input.frontProvider !== "claude") ||
    (input.requestedExecutorProvider !== "auto" &&
      input.requestedExecutorProvider !== "codex" &&
      input.requestedExecutorProvider !== "claude") ||
    !validText(input.objective, 16_384) ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths
  )
    return null;
  return Object.freeze({
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    taskRequest: Object.freeze({
      frontProvider: input.frontProvider,
      requestedExecutorProvider: input.requestedExecutorProvider,
      objective: input.objective,
      acceptanceCriteria,
      allowedPaths,
      readPaths,
      workClass: "bounded_implementation",
      planState: "complete_bounded_local_plan",
      risk: "low",
      difficulty: "low",
      decisionImpact: "bounded",
      isLocalCandidateOnly: true,
      hasUnresolvedDirection: false,
      requiresCrossContextAlignment: false,
    }),
  });
}

function toolDefinition() {
  return Object.freeze({
    name: MCP_PROJECT_RUNTIME_TOOL_NAME,
    title: "CRDD Objectiveを実行",
    description:
      "明示的にBindingされた単一Projectで、Objectiveを既存Single Task Runtimeへ渡します。",
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze([...objectiveKeys]),
      properties: Object.freeze({
        projectId: Object.freeze({ type: "string", maxLength: 128 }),
        milestoneId: Object.freeze({ type: "string", maxLength: 128 }),
        repositoryRevision: Object.freeze({
          type: "string",
          pattern: "^[0-9a-f]{40,64}$",
        }),
        frontProvider: Object.freeze({
          enum: Object.freeze(["codex", "claude"]),
        }),
        requestedExecutorProvider: Object.freeze({
          enum: Object.freeze(["auto", "codex", "claude"]),
        }),
        objective: Object.freeze({ type: "string", maxLength: 16_384 }),
        acceptanceCriteria: Object.freeze({
          type: "array",
          minItems: 1,
          maxItems: 16,
          items: Object.freeze({ type: "string", maxLength: 2048 }),
        }),
        allowedPaths: Object.freeze({
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: Object.freeze({ type: "string", maxLength: 512 }),
        }),
        readPaths: Object.freeze({
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: Object.freeze({ type: "string", maxLength: 512 }),
        }),
      }),
    }),
    outputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze([
        "status",
        "reason",
        "cleanupConfirmed",
        "manualRecoveryRequired",
        "processRestartRequired",
        "candidateId",
        "recoveryIds",
      ]),
      properties: Object.freeze({
        status: Object.freeze({
          enum: Object.freeze(["completed", "blocked", "cancelled"]),
        }),
        reason: Object.freeze({ type: "string" }),
        cleanupConfirmed: Object.freeze({ type: "boolean" }),
        manualRecoveryRequired: Object.freeze({ type: "boolean" }),
        processRestartRequired: Object.freeze({ type: "boolean" }),
        candidateId: Object.freeze({ type: Object.freeze(["string", "null"]) }),
        recoveryIds: Object.freeze({
          type: "array",
          items: Object.freeze({ type: "string" }),
        }),
      }),
    }),
  });
}

export async function handleMcpProjectRuntimeRequest(
  rawRequest: unknown,
  dependencies: McpProjectRuntimeDependencies,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const request = snapshotPlainRecord(rawRequest, requestKeys);
  if (!request || !validId(request.id) || request.jsonrpc !== "2.0")
    return error(null, -32600, "Invalid Request");
  if (typeof request.method !== "string")
    return error(request.id, -32600, "Invalid Request");

  if (request.method === "server/discover") {
    const params = snapshotPlainRecord(request.params, discoverParamsKeys);
    if (!params || !inspectEnvelope(params._meta))
      return error(request.id, -32602, "Invalid params");
    return complete(
      request.id,
      Object.freeze({
        supportedVersions: Object.freeze([
          MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
        ]),
        capabilities: Object.freeze({ tools: Object.freeze({}) }),
        ttlMs: 0,
        cacheScope: "private",
      }),
    );
  }

  if (request.method === "tools/list") {
    const params =
      snapshotPlainRecord(request.params, listParamsWithoutCursorKeys) ??
      snapshotPlainRecord(request.params, listParamsKeys);
    const paramsRecord: Readonly<Record<string, unknown>> | null = params;
    if (
      !params ||
      !inspectEnvelope(params._meta) ||
      (Object.hasOwn(params, "cursor") && paramsRecord?.cursor !== null)
    )
      return error(request.id, -32602, "Invalid params");
    return complete(
      request.id,
      Object.freeze({
        tools: Object.freeze([toolDefinition()]),
        ttlMs: 0,
        cacheScope: "private",
      }),
    );
  }

  if (request.method !== "tools/call")
    return error(request.id, -32601, "Method not found");
  const params = snapshotPlainRecord(request.params, callParamsKeys);
  if (
    !params ||
    !inspectEnvelope(params._meta) ||
    params.name !== MCP_PROJECT_RUNTIME_TOOL_NAME
  )
    return error(request.id, -32602, "Invalid params");
  const objective = inspectObjectiveArguments(params.arguments);
  if (!objective) return error(request.id, -32602, "Invalid params");
  const binding = dependencies.verifyProjectBinding({
    projectId: objective.projectId,
    milestoneId: objective.milestoneId,
    repositoryRevision: objective.repositoryRevision,
  });
  if (
    binding.status !== "verified" ||
    binding.repositoryRevision !== objective.repositoryRevision
  ) {
    const structuredContent = Object.freeze({
      status: "blocked",
      reason:
        binding.status === "blocked"
          ? binding.reason
          : "project_runtime_repository_revision_mismatch",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: Object.freeze([]),
    });
    return complete(
      request.id,
      Object.freeze({
        content: Object.freeze([
          Object.freeze({
            type: "text",
            text: "Project Bindingを確認できないため、Objectiveを開始しませんでした。",
          }),
        ]),
        structuredContent,
        isError: true,
      }),
    );
  }
  let rawTaskResult: unknown;
  try {
    rawTaskResult = await dependencies.runSingleTask(
      objective.taskRequest,
      binding.bindingCapability,
      signal,
    );
  } catch {
    rawTaskResult = null;
  }
  const taskResult = inspectTaskResult(rawTaskResult);
  if (!taskResult) {
    const structuredContent = Object.freeze({
      status: "blocked",
      reason: "project_runtime_single_task_result_invalid",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: Object.freeze([]),
    });
    return complete(
      request.id,
      Object.freeze({
        content: Object.freeze([
          Object.freeze({
            type: "text",
            text: "Objectiveの実行結果を安全に確認できませんでした。",
          }),
        ]),
        structuredContent,
        isError: true,
      }),
    );
  }
  const structuredContent = Object.freeze({
    ...taskResult,
    recoveryIds: Object.freeze([...taskResult.recoveryIds]),
  });
  return complete(
    request.id,
    Object.freeze({
      content: Object.freeze([
        Object.freeze({
          type: "text",
          text:
            taskResult.status === "completed"
              ? "Objectiveの実行結果を取得しました。"
              : "Objectiveは完了していません。構造化された理由を確認してください。",
        }),
      ]),
      structuredContent,
      isError: taskResult.status !== "completed",
    }),
  );
}

export function describeMcpProjectRuntimeAdapterContract() {
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_ADAPTER_CONTRACT,
    protocolVersion: MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
    toolName: MCP_PROJECT_RUNTIME_TOOL_NAME,
    transportState: "stateless_per_request",
    clientMetadataAuthority: "none",
    projectModelOwnership: "coordinator_core",
    repositoryBinding: "runtime_verified_explicit_binding_only",
  });
}
