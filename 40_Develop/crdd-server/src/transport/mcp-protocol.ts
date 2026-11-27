/**
 * HTTPとstdioに共通するMCP要求受付、固定応答と要求単位のSDK接続を所有する。
 * @packageDocumentation
 * @trace ARCH-000012
 */
import {
  type CallToolResult,
  type ListToolsResult,
  LOG_LEVEL_META_KEY,
  ProtocolError,
  Server,
} from "@modelcontextprotocol/server";
import type { JsonRpcId, McpRequestSource, McpResponse } from "./mcp-types.ts";

/**
 * 完全なdiscover要求だけを固定応答へ変換する。
 * @responsibility 通信能力を照会する入力と非秘密の応答を固定する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 信頼しないJSON-RPC要求。
 * @returns 固定discover成功または非秘密Protocol error。
 * @precondition HTTP入力境界の検査はTransportが所有する。
 * @postcondition 有効な非null ID・exact method・閉paramsとEnvelopeだけ成功。
 * @effect N/A: メモリ上の形式検査だけ。
 * @failure 不正要求／別method／不正paramsを固定errorへ閉じる。
 * @invariant 初回確認・認証・通常ToolのEffectを発行しない。
 * @boundary MCP意味検査と認証／保存の責務分離。
 * @security 応答に資格・状態相関・Root・Secretを含めない。
 * @concurrency N/A: 共有状態なし。
 */
export function handleMcpDiscoverRequest(rawRequest: unknown): McpResponse {
  const request = inspectProtocolRequest(rawRequest);
  if (!request) return protocolError(null, -32600, "Invalid Request");
  if (request.method !== "server/discover")
    return protocolError(request.id, -32601, "Method not found");
  const params = readRequestRecord(request.params, discoverKeys);
  return !params || !inspectMcpEnvelope(params._meta)
    ? protocolError(request.id, -32602, "Invalid params")
    : protocolComplete(request.id, {
        supportedVersions: Object.freeze([MCP_COORDINATOR_PROTOCOL_VERSION]),
        capabilities: Object.freeze({ tools: Object.freeze({}) }),
        ttlMs: 0,
        cacheScope: "private",
      });
}

export const MCP_COORDINATOR_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_SERVER_NAME = "crdd-mcp" as const;

const requestKeys = new Set(["jsonrpc", "id", "method", "params"] as const);
export const callKeys = new Set(["_meta", "name", "arguments"] as const);
const discoverKeys = new Set(["_meta"] as const);
export const listKeys = new Set(["_meta", "cursor"] as const);
export const listKeysNoCursor = new Set(["_meta"] as const);

/**
 * MCPの入力がオブジェクトであり、指定時は必須キーだけを持つことを確認する。
 * @responsibility 解析済みの入力の形を検査し、所有権の変更やコピーは行わない。
 * @trace ARCH-000012
 * @boundary MCPのJSON入口と、JSON相当の値を渡す同一プロセスの呼び出し。
 */
export function readRequestRecord(
  value: unknown,
  keys?: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (keys) {
    const actual = Object.keys(value);
    if (actual.length !== keys.size || actual.some((key) => !keys.has(key)))
      return null;
  }
  return value as Record<string, unknown>;
}

/** Tool共通のパラメーターとメタデータの形を確認する。 @trace ARCH-000012 */
export function inspectMcpToolParameters(value: unknown) {
  const params = readRequestRecord(value, callKeys);
  return params && inspectMcpEnvelope(params._meta) ? params : null;
}
const requestEnvelopeKeys = new Set<string>([
  "io.modelcontextprotocol/protocolVersion",
  "io.modelcontextprotocol/clientCapabilities",
  "io.modelcontextprotocol/clientInfo",
  LOG_LEVEL_META_KEY,
]);

/**
 * Json Rpc Idが有効か判定する。
 *
 * @responsibility Json Rpc Idの有効条件、拒否条件、判定結果境界を所有する。
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
function validJsonRpcId(value: unknown): value is JsonRpcId {
  return (
    (typeof value === "string" && value.length > 0 && value.length <= 128) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

/**
 * Mcp Envelopeを観測する。
 *
 * @responsibility Mcp Envelopeの観測対象、取得根拠、観測不能結果の境界を所有する。
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
  const envelope = readRequestRecord(value);
  if (
    !envelope ||
    Object.keys(envelope).some((key) => !requestEnvelopeKeys.has(key))
  )
    return false;
  const logLevel = envelope[LOG_LEVEL_META_KEY];
  return (
    envelope["io.modelcontextprotocol/protocolVersion"] ===
      MCP_COORDINATOR_PROTOCOL_VERSION &&
    readRequestRecord(
      envelope["io.modelcontextprotocol/clientCapabilities"],
    ) !== null &&
    (!Object.hasOwn(envelope, "io.modelcontextprotocol/clientInfo") ||
      readRequestRecord(envelope["io.modelcontextprotocol/clientInfo"]) !==
        null) &&
    (!Object.hasOwn(envelope, LOG_LEVEL_META_KEY) ||
      (typeof logLevel === "string" &&
        /^(?:debug|info|notice|warning|error|critical|alert|emergency)$/u.test(
          logLevel,
        )))
  );
}

/**
 * protocol Errorを決定する。
 *
 * @responsibility protocol Errorの導出に必要な入力、判定規則、返却結果の境界を所有する。
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

/** SDK生成時の失敗を両通信方式で同じ非秘密の応答へ変換する。 @trace ARCH-000012 */
export function mcpSdkFailure(id: JsonRpcId, error: unknown): McpResponse {
  return error instanceof ProtocolError
    ? protocolError(id, error.code, error.message)
    : protocolError(id, -32603, "Internal error");
}

/** 開始したOwnerの処理を待ってから、要求ごとのSDK接続を閉じる。 @trace ARCH-000012 */
export async function finishMcpSdkRequest(
  pending: Promise<McpResponse> | null,
  close: () => Promise<void>,
): Promise<void> {
  if (pending !== null) await Promise.allSettled([pending]);
  await close();
}

/**
 * protocol Completeを決定する。
 *
 * @responsibility protocol Completeの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
          name: MCP_SERVER_NAME,
          version: "0.20.0-development",
        }),
      }),
    }),
  });
}

/**
 * Protocol Requestを観測する。
 *
 * @responsibility Protocol Requestの観測対象、取得根拠、観測不能結果の境界を所有する。
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
  const request = readRequestRecord(value, requestKeys);
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

/**
 * 本番Factoryまたは要求Handlerを同じ要求別SDK Serverへ接続する。
 * @responsibility Transportに重複したTool dispatchを持たせない。
 * @trace ARCH-000012
 * @input 現在の接続、元入力、取消、開始済みOwnerの観測。
 * @returns この一要求だけを処理するSDK Server。
 * @precondition raw本文の完全性・容量は入口で検査する。
 * @postcondition SDK自動応答の前にHandlerのdiscover入力検査を行う。
 * @effect Handlerまたは専門Ownerの契約に従う。
 * @failure 内部例外を固定Protocol errorへ閉じる。
 * @invariant Serverと現在認可を後続要求へ再利用しない。
 * @boundary Transportの構成とSDK登録。
 * @security 正規化前の元入力をOwnerへ渡す。
 * @concurrency 開始済みPromiseを呼出し側へ渡してjoin可能にする。
 */
export async function createMcpRequestServer(
  source: McpRequestSource,
  rawRequest: unknown,
  signal: AbortSignal,
  observe: (pending: Promise<McpResponse>, sdkSignal: AbortSignal) => void,
): Promise<Server> {
  if (typeof source !== "function")
    return source.createServer(rawRequest, signal, observe);
  const request = inspectProtocolRequest(rawRequest);
  if (!request) throw new ProtocolError(-32600, "Invalid Request");
  if (request.method === "server/discover") {
    const result = await source(rawRequest, signal);
    if (result.error)
      throw new ProtocolError(result.error.code, result.error.message);
  }
  const server = new Server(
    { name: MCP_SERVER_NAME, version: "0.20.0-development" },
    {
      capabilities: { tools: {} },
      cacheHints: { "server/discover": { ttlMs: 0, cacheScope: "private" } },
    },
  );
  const invoke = async (sdkSignal: AbortSignal) => {
    const pending = Promise.resolve().then(() =>
      source(rawRequest, AbortSignal.any([signal, sdkSignal])),
    );
    observe(pending, sdkSignal);
    let result: McpResponse;
    try {
      result = await pending;
    } catch {
      throw new ProtocolError(-32603, "Internal error");
    }
    if (result.error)
      throw new ProtocolError(result.error.code, result.error.message);
    if (!result.result) throw new ProtocolError(-32603, "Internal error");
    return result.result;
  };
  server.setRequestHandler(
    "tools/list",
    async (_request, context) =>
      (await invoke(context.mcpReq.signal)) as ListToolsResult,
  );
  server.setRequestHandler(
    "tools/call",
    async (_request, context) =>
      (await invoke(context.mcpReq.signal)) as CallToolResult,
  );
  return server;
}
