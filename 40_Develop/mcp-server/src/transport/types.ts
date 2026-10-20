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
import type { McpResponse } from "../request/validation.ts";
import type { Server } from "@modelcontextprotocol/server";

/**
 * 要求別SDK Serverを生成する本番接続を定義する。
 * @responsibility 元入力・取消・Owner Promiseの観測を一要求へ閉じる。
 * @trace ARCH-000012
 * @shape createServerだけを持ち、Serverと認可結果を後続要求へ共有しない。
 * @invariant observeは開始済みOwnerのjoin用であり、実行権限を発行しない。
 * @boundary 認証済み構成と公式SDKの要求別Server。
 * @security 資格・保存Rootを公開結果へ含めない。
 * @compatibility 単純Handler注入はTransportの限定検証用に利用できる。
 */
export type McpServerFactory = Readonly<{
  createServer(
    request: unknown,
    signal: AbortSignal,
    observe?: (pending: Promise<McpResponse>, signal: AbortSignal) => void,
  ): Promise<Server>;
}>;

/**
 * 公式Server構成または限定Handler注入をTransportへ渡す。
 * @responsibility 本番Factoryと局所検証用Handlerを型で区別する。
 * @trace ARCH-000012
 * @shape Factoryか一要求Handler。
 * @invariant 本番のTool dispatchはFactoryだけが所有する。
 * @boundary Transport構成とSDK登録。
 * @security 要求ごとの認証結果を共有しない。
 * @compatibility 外部通信の入出力を変えない。
 */
export type McpRequestSource = McpRequestHandler | McpServerFactory;

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
) => Promise<McpRequestSource | null> | McpRequestSource | null;
