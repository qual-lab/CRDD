/**
 * HTTPとstdioに共通するMCP要求受付、固定応答と要求単位のSDK接続を所有する。
 * @packageDocumentation
 * @trace ARCH-000012
 */
import {
  PROTOCOL_VERSION_META_KEY,
  ProtocolError,
} from "@modelcontextprotocol/server";
import type {
  JsonRpcId,
  McpAcceptedRequest,
  McpProtocolRequest,
  McpPublicRequest,
  McpResponse,
} from "./mcp-types.ts";

export const MCP_COORDINATOR_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_SERVER_NAME = "crdd-mcp" as const;
export const MCP_SERVER_VERSION = "0.22.0-development" as const;

const callKeys = new Set(["_meta", "name", "arguments"] as const);

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
function inspectMcpToolParameters(value: unknown) {
  const params = readRequestRecord(value, callKeys);
  return params && inspectMcpEnvelope(params._meta) ? params : null;
}

/** SDKの版判定後、CRDD固有の要求外枠だけを確定する。 @trace ARCH-000012 */
export function acceptMcpRequest(
  request: McpPublicRequest,
): McpAcceptedRequest {
  const { id, method } = request;
  if (method === "tools/call") {
    const params = inspectMcpToolParameters(request.params);
    const args = params?.arguments;
    if (typeof params?.name !== "string") {
      throw new ProtocolError(-32602, "Invalid params");
    }
    return {
      id,
      method,
      params: { name: params.name, arguments: args, _meta: params._meta },
    };
  }
  const params = readRequestRecord(request.params);
  if (
    !params ||
    !Object.hasOwn(params, "_meta") ||
    Object.keys(params).some(
      (key) =>
        key !== "_meta" && !(method === "tools/list" && key === "cursor"),
    ) ||
    !inspectMcpEnvelope(params._meta)
  )
    throw new ProtocolError(-32602, "Invalid params");
  return { id, method, params };
}
const requestEnvelopeKeys = new Set<string>([
  PROTOCOL_VERSION_META_KEY,
  "io.modelcontextprotocol/clientCapabilities",
  "io.modelcontextprotocol/clientInfo",
  // 標準の進捗要求は受け取るが、CRDDは進捗通知を送らない。
  "progressToken",
  // 旧クライアントが送るログ水準は受け流す。CRDDはログ通知を提供しない。
  "io.modelcontextprotocol/logLevel",
]);

/** バージョンの宣言を取り出す。対応版の判定はSDKが行う。 */
export function readMcpProtocolVersion(params: unknown): string | undefined {
  const revision = readRequestRecord(readRequestRecord(params)?._meta)?.[
    PROTOCOL_VERSION_META_KEY
  ];
  return typeof revision === "string" ? revision : undefined;
}

/** SDKの対応版案内を保ち、版名に見せた任意文字列は反射しない。 */
export function createUnsupportedProtocolVersionResponse(value: unknown) {
  const response = readRequestRecord(value);
  const error = readRequestRecord(response?.error);
  if (error?.code !== -32022) return null;
  const data = readRequestRecord(error.data);
  const isRevision = (revision: unknown): revision is string =>
    typeof revision === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(revision);
  const requested = isRevision(data?.requested) ? data.requested : "unknown";
  const supported = Array.isArray(data?.supported)
    ? data.supported.filter(isRevision)
    : [];
  const id = response?.id;
  return {
    jsonrpc: "2.0",
    id: validJsonRpcId(id) ? id : null,
    error: {
      code: -32022,
      message: `Unsupported protocol version: ${requested}`,
      data: { supported, requested },
    },
  };
}

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
export function inspectMcpEnvelope(
  value: unknown,
  kind: "request" | "cancellation" = "request",
) {
  const envelope = readRequestRecord(value);
  if (
    !envelope ||
    (kind === "cancellation" &&
      Object.keys(envelope).some((key) => !requestEnvelopeKeys.has(key)))
  )
    return false;
  const progressToken = envelope.progressToken;
  return (
    typeof envelope[PROTOCOL_VERSION_META_KEY] === "string" &&
    readRequestRecord(
      envelope["io.modelcontextprotocol/clientCapabilities"],
    ) !== null &&
    (!Object.hasOwn(envelope, "progressToken") ||
      (kind === "request" &&
        (typeof progressToken === "string" ||
          (typeof progressToken === "number" &&
            Number.isFinite(progressToken))))) &&
    (!Object.hasOwn(envelope, "io.modelcontextprotocol/clientInfo") ||
      readRequestRecord(envelope["io.modelcontextprotocol/clientInfo"]) !==
        null)
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
          version: MCP_SERVER_VERSION,
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
export function inspectProtocolRequest(
  value: unknown,
): McpProtocolRequest | null {
  const request = readRequestRecord(value);
  return request &&
    Object.hasOwn(request, "params") &&
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

/** CRDDが公開するmethodだけをSDKへの配送対象にする。 */
export function isMcpPublicRequest(
  request: McpProtocolRequest,
): request is McpPublicRequest {
  return (
    request.method === "server/discover" ||
    request.method === "tools/list" ||
    request.method === "tools/call"
  );
}
