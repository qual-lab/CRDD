import { types as utilTypes } from "node:util";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { inspectProjectRuntimeObjectiveRequest } from "./project-runtime-objective-request.ts";

export const MCP_PROJECT_RUNTIME_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL = "crdd.run_objective" as const;
export const MCP_PROJECT_RUNTIME_DECISION_TOOL =
  "crdd.submit_decision" as const;
export const MCP_PROJECT_RUNTIME_ADAPTER_CONTRACT =
  "crdd-coordinator/mcp-project-runtime-adapter/v2" as const;

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

const REQUEST_KEYS = new Set(["jsonrpc", "id", "method", "params"] as const);
const CALL_KEYS = new Set(["_meta", "name", "arguments"] as const);
const DISCOVER_KEYS = new Set(["_meta"] as const);
const LIST_KEYS = new Set(["_meta", "cursor"] as const);
const LIST_KEYS_NO_CURSOR = new Set(["_meta"] as const);
const OBJECTIVE_KEYS = new Set([
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
const DECISION_KEYS = new Set([
  "decisionId",
  "projectId",
  "milestoneId",
  "generation",
  "repositoryRevision",
  "selectedOption",
  "continuationCapability",
  "comment",
] as const);
const DECISION_KEYS_NO_COMMENT = new Set(
  [...DECISION_KEYS].filter((key) => key !== "comment"),
);

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
function revision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
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
export function inspectMcpProjectRuntimeDecision(value: unknown): Readonly<{
  decisionId: string;
  projectId: string;
  milestoneId: string;
  generation: number;
  repositoryRevision: string;
  selectedOption: "resume" | "cancel";
  continuationCapability: string;
  comment?: string;
}> | null {
  const input =
    snapshotPlainRecord(value, DECISION_KEYS) ??
    snapshotPlainRecord(value, DECISION_KEYS_NO_COMMENT);
  const record: Readonly<Record<string, unknown>> | null = input;
  if (
    !record ||
    !stable(record.decisionId) ||
    !stable(record.projectId) ||
    !stable(record.milestoneId) ||
    !revision(record.repositoryRevision) ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    (record.selectedOption !== "resume" &&
      record.selectedOption !== "cancel") ||
    !text(record.continuationCapability, 512) ||
    (record.comment !== undefined &&
      (typeof record.comment !== "string" ||
        Buffer.byteLength(record.comment, "utf8") > 1024 ||
        /[\r\n\u0000-\u001f\u007f]/u.test(record.comment)))
  )
    return null;
  return Object.freeze({ ...record }) as Readonly<{
    decisionId: string;
    projectId: string;
    milestoneId: string;
    generation: number;
    repositoryRevision: string;
    selectedOption: "resume" | "cancel";
    continuationCapability: string;
    comment?: string;
  }>;
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
  required: readonly string[],
) {
  return Object.freeze({
    name,
    title,
    description,
    inputSchema: Object.freeze({
      type: "object",
      additionalProperties: false,
      required: Object.freeze([...required]),
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
      [...OBJECTIVE_KEYS].filter(
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
      [...DECISION_KEYS_NO_COMMENT],
    ),
  ]);
}
function structured(raw: unknown) {
  return plain(raw) &&
    ["completed", "blocked", "cancelled"].includes(String(raw.status)) &&
    text(raw.reason, 256)
    ? Object.freeze({ ...raw })
    : null;
}

export async function handleMcpProjectRuntimeRequest(
  rawRequest: unknown,
  dependencies: McpProjectRuntimeDependencies,
  signal: AbortSignal = new AbortController().signal,
): Promise<McpResponse> {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  if (
    !request ||
    !validId(request.id) ||
    request.jsonrpc !== "2.0" ||
    typeof request.method !== "string"
  )
    return error(null, -32600, "Invalid Request");
  if (request.method === "server/discover") {
    const params = snapshotPlainRecord(request.params, DISCOVER_KEYS);
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
      snapshotPlainRecord(request.params, LIST_KEYS_NO_CURSOR) ??
      snapshotPlainRecord(request.params, LIST_KEYS);
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
  const params = snapshotPlainRecord(request.params, CALL_KEYS);
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
      : inspectMcpProjectRuntimeDecision(params.arguments);
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
  const result =
    structured(raw) ??
    Object.freeze({
      status: "blocked",
      reason: "project_runtime_adapter_result_invalid",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  const failed = result.status !== "completed";
  return complete(request.id, {
    content: Object.freeze([
      Object.freeze({
        type: "text",
        text: failed
          ? "処理は完了していません。構造化された理由を確認してください。"
          : "処理が完了しました。",
      }),
    ]),
    structuredContent: result,
    isError: failed,
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
    projectModelOwnership: "coordinator_core",
  });
}
