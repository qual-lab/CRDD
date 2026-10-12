/**
 * 通常接続と初回限定接続が共有するdiscover契約を検査する。
 * @responsibility 完全要求検査と非秘密成功応答を副作用なしの一Ownerへ閉じる。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
import { snapshotPlainRecord } from "./snapshot.ts";
import {
  discoverKeys,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  protocolComplete,
  protocolError,
  type McpResponse,
} from "../orchestrator/protocol.ts";

/**
 * 完全なdiscover要求だけを固定応答へ変換する。
 * @responsibility 通常／初回の入力・ID・Envelope・応答の差を防ぐ。
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
  const params = snapshotPlainRecord(request.params, discoverKeys);
  return !params || !inspectMcpEnvelope(params._meta)
    ? protocolError(request.id, -32602, "Invalid params")
    : protocolComplete(request.id, {
        supportedVersions: Object.freeze([MCP_ORCHESTRATOR_PROTOCOL_VERSION]),
        capabilities: Object.freeze({ tools: Object.freeze({}) }),
        ttlMs: 0,
        cacheScope: "private",
      });
}
