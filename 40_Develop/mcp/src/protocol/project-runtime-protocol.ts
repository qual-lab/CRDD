import {
  snapshotOpenPlainRecord,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";

export const MCP_PROJECT_RUNTIME_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_PROJECT_RUNTIME_OBJECTIVE_TOOL = "crdd.run_objective" as const;
export const MCP_PROJECT_RUNTIME_DECISION_TOOL =
  "crdd.submit_decision" as const;
export const MCP_PROJECT_RUNTIME_STATE_TOOL = "crdd.get_project_state" as const;

/**
 * JsonRpcIdが扱う値の構造を表す。
 *
 * @responsibility JsonRpcIdに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000012
 * @shape JsonRpcIdが表すProperty、識別子およびRelationを型として固定する。
 * @invariant JsonRpcIdで宣言した値と責務の対応を維持する。
 * @boundary N/A: JsonRpcIdの宣言は外部境界を開かない。
 * @security N/A: JsonRpcIdはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility JsonRpcIdの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type JsonRpcId = string | number;
/**
 * McpResponseが扱う値の構造を表す。
 *
 * @responsibility McpResponseに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000012
 * @shape McpResponseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpResponseで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpResponseの宣言は外部境界を開かない。
 * @security N/A: McpResponseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpResponseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * validJsonRpcIdの処理を実行する。
 *
 * @responsibility validJsonRpcIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input value: unknown
 * @returns value is JsonRpcIdを返す。
 * @precondition 「value: unknown」がvalidJsonRpcIdの入力契約を満たす。
 * @postcondition validJsonRpcIdの責務を完了した結果だけを返す。
 * @effect N/A: validJsonRpcIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validJsonRpcIdは独自の失敗分岐を所有しない。
 * @invariant validJsonRpcIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validJsonRpcIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validJsonRpcIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validJsonRpcIdは共有非同期状態を持たない同期処理である。
 */
export function validJsonRpcId(value: unknown): value is JsonRpcId {
  return (
    (typeof value === "string" && value.length > 0 && value.length <= 128) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

/**
 * inspectMcpEnvelopeの処理を実行する。
 *
 * @responsibility inspectMcpEnvelopeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input value: unknown
 * @returns inspectMcpEnvelopeの計算結果を返す。
 * @precondition 「value: unknown」がinspectMcpEnvelopeの入力契約を満たす。
 * @postcondition inspectMcpEnvelopeの責務を完了した結果だけを返す。
 * @effect N/A: inspectMcpEnvelopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectMcpEnvelopeは独自の失敗分岐を所有しない。
 * @invariant inspectMcpEnvelopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectMcpEnvelopeはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectMcpEnvelopeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectMcpEnvelopeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * protocolErrorの処理を実行する。
 *
 * @responsibility protocolErrorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input id: JsonRpcId | null、code: number、message: string
 * @returns McpResponseを返す。
 * @precondition 「id: JsonRpcId | null、code: number、message: string」がprotocolErrorの入力契約を満たす。
 * @postcondition protocolErrorの責務を完了した結果だけを返す。
 * @effect N/A: protocolErrorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: protocolErrorは独自の失敗分岐を所有しない。
 * @invariant protocolErrorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: protocolErrorはProcess内の同一Subsystemで完結する。
 * @security N/A: protocolErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: protocolErrorは共有非同期状態を持たない同期処理である。
 */
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

/**
 * protocolCompleteの処理を実行する。
 *
 * @responsibility protocolCompleteに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input id: JsonRpcId、result: Readonly<Record<string, unknown>>
 * @returns protocolCompleteの計算結果を返す。
 * @precondition 「id: JsonRpcId、result: Readonly<Record<string, unknown>>」がprotocolCompleteの入力契約を満たす。
 * @postcondition protocolCompleteの責務を完了した結果だけを返す。
 * @effect N/A: protocolCompleteは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: protocolCompleteは独自の失敗分岐を所有しない。
 * @invariant protocolCompleteは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: protocolCompleteはProcess内の同一Subsystemで完結する。
 * @security N/A: protocolCompleteはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: protocolCompleteは共有非同期状態を持たない同期処理である。
 */
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

/**
 * toolの処理を実行する。
 *
 * @responsibility toolに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input name: string、title: string、description: string、properties: object、requiredItems: readonly string[]
 * @returns toolの計算結果を返す。
 * @precondition 「name: string、title: string、description: string、properties: object、requiredItems: readonly string[]」がtoolの入力契約を満たす。
 * @postcondition toolの責務を完了した結果だけを返す。
 * @effect N/A: toolは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: toolは独自の失敗分岐を所有しない。
 * @invariant toolは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: toolはProcess内の同一Subsystemで完結する。
 * @security N/A: toolはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: toolは共有非同期状態を持たない同期処理である。
 */
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

/**
 * getMcpProjectRuntimeToolDefinitionsの処理を実行する。
 *
 * @responsibility getMcpProjectRuntimeToolDefinitionsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns getMcpProjectRuntimeToolDefinitionsの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がgetMcpProjectRuntimeToolDefinitionsの入力契約を満たす。
 * @postcondition getMcpProjectRuntimeToolDefinitionsの責務を完了した結果だけを返す。
 * @effect N/A: getMcpProjectRuntimeToolDefinitionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getMcpProjectRuntimeToolDefinitionsは独自の失敗分岐を所有しない。
 * @invariant getMcpProjectRuntimeToolDefinitionsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getMcpProjectRuntimeToolDefinitionsはProcess内の同一Subsystemで完結する。
 * @security N/A: getMcpProjectRuntimeToolDefinitionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: getMcpProjectRuntimeToolDefinitionsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * inspectProtocolRequestの処理を実行する。
 *
 * @responsibility inspectProtocolRequestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input value: unknown
 * @returns inspectProtocolRequestの計算結果を返す。
 * @precondition 「value: unknown」がinspectProtocolRequestの入力契約を満たす。
 * @postcondition inspectProtocolRequestの責務を完了した結果だけを返す。
 * @effect N/A: inspectProtocolRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectProtocolRequestは独自の失敗分岐を所有しない。
 * @invariant inspectProtocolRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectProtocolRequestはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectProtocolRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectProtocolRequestは共有非同期状態を持たない同期処理である。
 */
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
