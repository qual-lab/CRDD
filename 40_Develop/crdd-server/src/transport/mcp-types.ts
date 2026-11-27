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

import type { AuthInfo, Server } from "@modelcontextprotocol/server";
import type { Configuration } from "oidc-provider";
import { UUID_V4_SOURCE } from "../service/identity.ts";

/** 起動時に発行側へ与える、非公開のOAuth構成。 */
export interface EmbeddedMcpOAuthOptions {
  readonly clients: readonly Readonly<{
    id: string;
    redirects: readonly string[];
  }>[];
  readonly verifier: Readonly<{ id: string; secret: string }>;
  readonly jwks: NonNullable<Configuration["jwks"]>;
  readonly cookieKeys: readonly string[];
}

/** 資源サーバーが発行側の状態を参照せずに使うトークン照会契約。 */
export type McpTokenVerifier = (
  token: string,
  signal: AbortSignal,
) => Promise<
  | Readonly<{ status: "completed"; subject: string; expiresAt: number }>
  | Readonly<{ status: "rejected" | "unavailable" }>
>;

/** 現在の同意とその連携参照を観測する。発行側の保存型は公開しない。 */
export interface McpGrantAccess {
  hasCurrentToken(token: string, subject: string): boolean;
  readGrantHostReference(
    token: string,
    subject: string,
    host: string,
  ): string | null;
}

const accountSubject = new RegExp(
  `^(${UUID_V4_SOURCE}):(${UUID_V4_SOURCE})$`,
  "u",
);

/** MCP主体の結合を読み取る。発行、トークン照会、認可は行わない。 @trace ARCH-000012 */
export function readMcpAccountSubject(subject: string) {
  const fields = accountSubject.exec(subject);
  return fields?.[1] && fields[2]
    ? {
        userId: fields[1],
        bindingId: fields[2],
      }
    : null;
}

/** SDK登録とstdioの受付順が参照する公開ツール名。 @trace ARCH-000012 */
export const objectiveRunTools = {
  start: "crdd.start_objective",
  resume: "crdd.resume_objective",
  state: "crdd.get_execution_state",
  cancel: "crdd.cancel_objective",
} as const;

/** 通信入口で検査したJSON-RPC要求の外枠。 @trace ARCH-000012 */
export type McpProtocolRequest = Readonly<{
  id: JsonRpcId;
  method: string;
  params: unknown;
}>;

/** CRDDが公開するメソッドとして受付済みの要求。 @trace ARCH-000012 */
export type McpPublicRequest = McpProtocolRequest &
  Readonly<{ method: "server/discover" | "tools/list" | "tools/call" }>;

/** 共通受付を通った要求。Tool引数のスキーマ検査はSDKが行う。 @trace ARCH-000012 */
export type McpAcceptedRequest = Readonly<{ id: JsonRpcId }> &
  (
    | Readonly<{
        method: "server/discover" | "tools/list";
        params: Readonly<Record<string, unknown>>;
      }>
    | Readonly<{
        method: "tools/call";
        params: Readonly<{ name: string; arguments: unknown; _meta: unknown }>;
      }>
  );

/**
 * 要求別SDK Serverを生成する本番接続を定義する。
 * @responsibility 検査済み入力・取消・Owner Promiseの観測を一要求へ閉じる。
 * @trace ARCH-000012
 * @shape createServerだけを持ち、Serverと認可結果を後続要求へ共有しない。
 * @invariant observeは開始済みOwnerのjoin用であり、実行権限を発行しない。
 * @boundary 認証済み構成と公式SDKの要求別Server。
 * @security 資格・保存Rootを公開結果へ含めない。
 * @compatibility HTTPとstdioは同じ要求別Factoryを使う。
 */
export type McpServerFactory = Readonly<{
  createServer(
    request: McpAcceptedRequest,
    signal: AbortSignal,
    observe?: (pending: Promise<McpResponse>, signal: AbortSignal) => void,
    authInfo?: AuthInfo,
  ): Promise<Server>;
}>;

/** 共有HTTPの入場と、SDKが要求ごとに呼ぶ固定の構成を分離する。 */
export type McpOAuthHttpAccess = Readonly<{
  authenticate(
    header: string | undefined,
    signal: AbortSignal,
  ): Promise<AuthInfo>;
  admit(auth: AuthInfo): boolean;
  factory: McpServerFactory;
}>;

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
