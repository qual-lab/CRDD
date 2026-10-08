/**
 * MCP Transportが意味処理へ依存する最小Port。
 *
 * @packageDocumentation
 * @responsibility TransportとApplication Adapterを関数境界で分離する。
 * @trace ARCH-000012
 * @boundary MCP TransportとProtocol Applicationの境界。
 * @effect 実装Handlerの契約に従う。
 * @concurrency Requestごとの取消SignalをHandlerへ渡す。
 * @security Transport認証後の要求だけをHandlerへ渡すのはTransportの責務である。
 */
import type { McpResponse } from "../orchestrator/protocol.ts";

/**
 * MCP Request Handlerを定義する。
 *
 * @responsibility Transportから独立した一Requestの意味処理契約を所有する。
 * @trace ARCH-000012
 * @shape rawRequestとAbortSignalからMcpResponseを返す関数を表す。
 * @invariant 一Requestにつき一つの最終応答へ収束する。
 * @boundary TransportとApplication Adapterの型境界。
 * @security 認証前要求を渡さないことは呼出しTransportが保証する。
 * @compatibility Protocol応答型変更時は全Transportを再評価する。
 */
export type McpRequestHandler = (
  rawRequest: unknown,
  signal: AbortSignal,
) => Promise<McpResponse>;

/**
 * Bearer Credentialごとに利用可能なMCP Handlerを解決する。
 *
 * @responsibility Transport認証材料をApplication固有のRequest Handlerへ変換するPortを定義する。
 * @trace ARCH-000012
 * @shape Bearer TokenからHandlerまたは認証拒否のnullを返す関数。
 * @invariant TokenをHandlerの応答、Errorまたは永続状態へ含めない。
 * @boundary HTTP Transport認証とApplication Request Access Contextの境界。
 * @security Requestごとに現在Credentialを再検証する実装を許容する。
 * @compatibility 固定Token入口は同じPortへAdapterできる。
 */
export type McpAuthenticatedRequestHandlerResolver = (
  bearerToken: string,
) => Promise<McpRequestHandler | null> | McpRequestHandler | null;
