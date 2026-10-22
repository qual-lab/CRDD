/**
 * MCP要求の閉入力検査と結果の境界を所有する。
 *
 * @responsibility JsonRpcIdを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000012
 */
import {
  snapshotOpenPlainRecord,
  snapshotPlainRecord,
} from "../request/snapshot.ts";

export const MCP_COORDINATOR_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_SERVER_NAME = "crdd-mcp" as const;

/**
 * protocolで使用するJson Rpc Idの値契約を定義する。
 *
 * @responsibility Json Rpc IdのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape JsonRpcIdが表すProperty、識別子およびRelationを型として固定する。
 * @invariant JsonRpcIdで宣言した値と責務の対応を維持する。
 * @boundary N/A: JsonRpcIdの宣言は外部境界を開かない。
 * @security N/A: JsonRpcIdはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility JsonRpcIdの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type JsonRpcId = string | number;
/**
 * protocolで使用するMcp Responseの値契約を定義する。
 *
 * @responsibility Mcp ResponseのProperty、Identity、状態制約を型境界として所有する。
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
export function validJsonRpcId(value: unknown): value is JsonRpcId {
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
      MCP_COORDINATOR_PROTOCOL_VERSION &&
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
