import {
  snapshotOpenPlainRecord,
  snapshotPlainRecord,
} from "../internal/plain-data-snapshot.ts";

export const MCP_PROJECT_RUNTIME_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL = "crdd.run_objective" as const;
export const MCP_PROJECT_RUNTIME_DECISION_TOOL =
  "crdd.submit_decision" as const;
export const MCP_PROJECT_RUNTIME_STATE_TOOL = "crdd.get_project_state" as const;

export type JsonRpcId = string | number;
export type McpResponse = Readonly<{
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: Readonly<{ code: number; message: string }>;
}>;

export const requestKeys = new Set([
  "jsonrpc",
  "id",
  "method",
  "params",
] as const);
export const callKeys = new Set(["_meta", "name", "arguments"] as const);
export const discoverKeys = new Set(["_meta"] as const);
export const listKeys = new Set(["_meta", "cursor"] as const);
export const listKeysNoCursor = new Set(["_meta"] as const);
export const objectiveKeys = new Set([
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
export const decisionKeys = new Set([
  "decisionId",
  "projectId",
  "milestoneId",
  "generation",
  "repositoryRevision",
  "selectedOption",
  "continuationCapability",
  "comment",
] as const);
export const decisionKeysNoComment = new Set(
  [...decisionKeys].filter((key) => key !== "comment"),
);
export const stateQueryKeys = new Set([
  "requestId",
  "projectId",
  "repositoryRevision",
] as const);

export function validJsonRpcId(value: unknown): value is JsonRpcId {
  return (
    (typeof value === "string" && value.length > 0 && value.length <= 128) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

export function inspectMcpEnvelope(value: unknown) {
  const required = new Set([
    "io.modelcontextprotocol/protocolVersion",
    "io.modelcontextprotocol/clientCapabilities",
  ] as const);
  const withClientInfo = new Set([
    ...required,
    "io.modelcontextprotocol/clientInfo",
  ] as const);
  const envelope =
    snapshotPlainRecord(value, required) ??
    snapshotPlainRecord(value, withClientInfo);
  if (!envelope) return false;
  const envelopeRecord: Readonly<Record<string, unknown>> = envelope;
  return (
    envelope["io.modelcontextprotocol/protocolVersion"] ===
      MCP_PROJECT_RUNTIME_PROTOCOL_VERSION &&
    snapshotOpenPlainRecord(
      envelope["io.modelcontextprotocol/clientCapabilities"],
    ) !== null &&
    (!Object.hasOwn(envelopeRecord, "io.modelcontextprotocol/clientInfo") ||
      snapshotOpenPlainRecord(
        envelopeRecord["io.modelcontextprotocol/clientInfo"],
      ) !== null)
  );
}

export function protocolError(
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

export function protocolComplete(
  id: JsonRpcId,
  result: Readonly<Record<string, unknown>>,
) {
  return Object.freeze({
    jsonrpc: "2.0" as const,
    id,
    result: Object.freeze({
      resultType: "complete",
      ...result,
      _meta: Object.freeze({
        "io.modelcontextprotocol/serverInfo": Object.freeze({
          name: "crdd-coordinator",
          version: "0.20.0-development",
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

export function getMcpProjectRuntimeToolDefinitions() {
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
    tool(
      MCP_PROJECT_RUNTIME_STATE_TOOL,
      "CRDD Projectの現在状態を取得",
      "Project Runtimeの現在状態を、書込み権限を持たない投影として取得します。",
      {
        requestId: id,
        projectId: id,
        repositoryRevision: rev,
      },
      [...stateQueryKeys],
    ),
  ]);
}

export function inspectProtocolRequest(value: unknown) {
  const request = snapshotPlainRecord(value, requestKeys);
  return request &&
    validJsonRpcId(request.id) &&
    request.jsonrpc === "2.0" &&
    typeof request.method === "string"
    ? Object.freeze({
        id: request.id,
        method: request.method,
        params: request.params,
      })
    : null;
}
