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

/**
 * streamable-http-transportで使用するMcp Coordinator Http Optionsの値契約を定義する。
 *
 * @responsibility Mcp Coordinator Http OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpCoordinatorHttpOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpCoordinatorHttpOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpCoordinatorHttpOptionsの宣言は外部境界を開かない。
 * @security N/A: McpCoordinatorHttpOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpCoordinatorHttpOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpCoordinatorHttpOptions = Readonly<{
  port: number;
  bearerToken: string;
  allowedOrigins?: readonly string[];
}>;

/**
 * Request単位認証を行うStreamable HTTPの非秘密構成を定義する。
 *
 * @responsibility Listener Port・許可Origin・明示したTLS終端公開OriginをTransport構成として保持する。
 * @trace ARCH-000012
 * @shape port、任意のallowedOrigins、共有配置時だけのpublicOrigin。
 * @invariant Bearer TokenやCredentialを構成へ保持しない。
 * @boundary MCP自身の起動構成と認証済みHTTP Transportの型境界。
 * @security 秘密値を許可せず、公開Bindを導出しない。配置OwnerがTLS終端の上書きHeaderと内部到達範囲を管理する。
 * @compatibility Consumerは宣言済みPropertyだけを指定する。
 */
export type McpAuthenticatedHttpOptions = Readonly<{
  port: number;
  allowedOrigins?: readonly string[];
  publicOrigin?: string;
}>;

/**
 * process-signal-shutdownで使用するMcp Http Server Close Boundaryの値契約を定義する。
 *
 * @responsibility Mcp Http Server Close BoundaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpHttpServerCloseBoundaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpHttpServerCloseBoundaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpHttpServerCloseBoundaryの宣言は外部境界を開かない。
 * @security N/A: McpHttpServerCloseBoundaryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpHttpServerCloseBoundaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpHttpServerCloseBoundary = Readonly<{
  close(): Promise<Readonly<{ status: "completed"; cleanupConfirmed: true }>>;
}>;

/**
 * process-signal-shutdownで使用するMcp Process Signal Sourceの値契約を定義する。
 *
 * @responsibility Mcp Process Signal SourceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpProcessSignalSourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpProcessSignalSourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpProcessSignalSourceの宣言は外部境界を開かない。
 * @security N/A: McpProcessSignalSourceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpProcessSignalSourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpProcessSignalSource = Readonly<{
  on(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  removeListener(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
}>;
