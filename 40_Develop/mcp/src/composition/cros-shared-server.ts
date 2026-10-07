/**
 * CROS RESTとMCPを一つのHTTPS Originへ束ねるShared Server Composition。
 *
 * @packageDocumentation
 * @responsibility loopback限定の内部REST／MCP入口を同一Gatewayへ束ね、外部TLS終端との配置契約を固定する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary TLS終端後のloopback HTTP、CROS RESTおよびMCP Transportの合成境界。
 * @effect 三つのloopback Listenerを開始・終了し、Repository内容は変更しない。
 * @security 公開OriginはHTTPSだけを許可し、Bearer値を保存・応答・logへ含めない。
 */
import {
  createServer,
  request as createProxyRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";

import type { AiProfileCatalogAdministration } from "../../../ai-runtime/src/index.ts";
import {
  startCrosRemoteTransport,
  type ConnectionCredentialRegistry,
  type CrosExposureSnapshot,
  type CrosRuntimeActivityReader,
  type CrosRepository,
} from "../../../cros/src/index.ts";
import type { TopicMeetingApplications } from "../../../domain-model/src/topic/index.ts";

import { createCrosProjectContextMcpResolver } from "./cros-project-context-application.ts";
import { startMcpAuthenticatedStreamableHttp } from "../transports/streamable-http-transport.ts";

const HOST = "127.0.0.1";
const MAXIMUM_REQUEST_BYTES = 128 * 1024;
const PUBLIC_HEALTH_PATH = "/.well-known/cros-shared-health";
const MCP_PATH = "/mcp";

/**
 * Shared Serverへ必要な運用設定とApplication依存を定義する。
 *
 * @responsibility 公開Origin、loopback Port、Credential、ExposureおよびRepository Applicationの入力境界を固定する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @shape HTTPS OriginとCROS／MCPの既存Application Portを持つ。
 * @invariant Bearer Secret、TLS秘密鍵または任意Filesystem Pathを設定値に持たない。
 * @boundary Server運用設定とProcess内Compositionの型境界。
 * @security TLS秘密鍵は外部TLS終端が所有し、本型へ渡さない。
 * @compatibility 新しい公開Routeは固定Route判定とQuality検証を同時に更新する。
 */
export type CrosSharedServerInput = Readonly<{
  publicOrigin: string;
  port?: number;
  registry: ConnectionCredentialRegistry;
  readExposureSnapshot(): CrosExposureSnapshot;
  resolveTopicMeetingApplication?(
    repository: CrosRepository,
  ): TopicMeetingApplications | null;
  aiProfileAdministration?: AiProfileCatalogAdministration;
  runtimeActivityReader?: CrosRuntimeActivityReader;
}>;

/**
 * 起動済みShared Serverの公開情報と終了操作を定義する。
 *
 * @responsibility 公開HTTPS Originと、同一Origin上のREST／MCP Pathおよび冪等終了を返す。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @shape 公開URL、内部観測用URL、Pathおよびcloseを持つ。
 * @invariant 外部利用者へ内部REST／MCPの個別Portを配布しない。
 * @boundary Shared Server Processと起動元のLifecycle境界。
 * @security Credential、VerifierまたはTLS秘密情報を含まない。
 * @compatibility publicOriginとPathを結合して同じOriginになることを維持する。
 */
export type CrosSharedServerHandle = Readonly<{
  publicOrigin: string;
  localGatewayUrl: string;
  restPortfolioPath: "/v1/portfolio";
  mcpPath: "/mcp";
  close(): Promise<Readonly<{ status: "completed"; cleanupConfirmed: true }>>;
}>;

/**
 * CROS RESTとMCPを同一Originへ公開するloopback Gatewayを開始する。
 *
 * @responsibility 内部Transportを開始し、固定Routeだけを期待HTTPS Originから同一Gatewayへ中継する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 公開HTTPS Origin、任意loopback Port、Credential Registry、Exposure Snapshotおよび任意Application Adapterを受け取る。
 * @returns 公開Origin、Gateway観測URLおよび全Listenerをjoinするcloseを返す。
 * @precondition TLS終端は同一Host上または保護済みloopback経路からGatewayへ接続し、`x-forwarded-proto`と`x-forwarded-host`を上書きする。
 * @postcondition 成功時はRESTとMCPが同じGateway Originに存在し、close後は所有Listener、SocketおよびProxy Requestが0になる。
 * @effect CROS REST、MCPおよびGatewayのloopback Listenerを開始する。
 * @failure 不正Origin／Port、TLS終端情報不一致、未定義Route、起動失敗またはcleanup不成立を安全に拒否する。
 * @invariant Gatewayは127.0.0.1以外へBindせず、Profile名やsystemAdminからContent Accessを生成しない。
 * @boundary HTTPS TLS終端→loopback Gateway→CROS REST／MCP内部Transport。
 * @security 生Bearer値を保持せず、OriginとForwarded情報を外部入力のまま内部Authorityへ昇格しない。
 * @concurrency Requestごとに独立した内部Requestを所有し、終了時に全要求を取消してjoinする。
 */
export async function startCrosSharedServer(
  input: CrosSharedServerInput,
): Promise<CrosSharedServerHandle> {
  const publicOrigin = inspectPublicOrigin(input.publicOrigin);
  const port = input.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535)
    throw new Error("cros_shared_server_port_invalid");

  const cros = await startCrosRemoteTransport({
    registry: input.registry,
    readExposureSnapshot: input.readExposureSnapshot,
    ...(input.aiProfileAdministration === undefined
      ? {}
      : { aiProfileAdministration: input.aiProfileAdministration }),
    ...(input.runtimeActivityReader === undefined
      ? {}
      : { runtimeActivityReader: input.runtimeActivityReader }),
  });
  let mcp: Awaited<ReturnType<typeof startMcpAuthenticatedStreamableHttp>>;
  try {
    mcp = await startMcpAuthenticatedStreamableHttp(
      createCrosProjectContextMcpResolver({
        registry: input.registry,
        readExposureSnapshot: input.readExposureSnapshot,
        ...(input.resolveTopicMeetingApplication === undefined
          ? {}
          : {
              resolveTopicMeetingApplication:
                input.resolveTopicMeetingApplication,
            }),
      }),
      { port: 0 },
    );
  } catch (error) {
    await cros.close();
    throw error;
  }

  const sockets = new Set<Socket>();
  const proxyRequests = new Set<ReturnType<typeof createProxyRequest>>();
  let isClosing = false;
  const server = createServer((request, response) => {
    if (isClosing) {
      request.destroy();
      return;
    }
    void dispatchSharedRequest(
      request,
      response,
      publicOrigin,
      cros.baseUrl,
      `http://${mcp.host}:${mcp.port}`,
      proxyRequests,
    );
  });
  server.on("connection", (socket) => {
    if (isClosing) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const failed = (error: Error) => reject(error);
      server.once("error", failed);
      server.listen(port, HOST, () => {
        server.removeListener("error", failed);
        resolve();
      });
    });
  } catch (error) {
    await Promise.allSettled([mcp.close(), cros.close()]);
    throw error;
  }
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    await Promise.allSettled([mcp.close(), cros.close()]);
    throw new Error("cros_shared_server_address_invalid");
  }

  let closePromise: Promise<
    Readonly<{ status: "completed"; cleanupConfirmed: true }>
  > | null = null;
  const close = () => {
    if (closePromise !== null) return closePromise;
    isClosing = true;
    closePromise = (async () => {
      const serverClosed = new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      server.closeIdleConnections();
      const proxyClosures = [...proxyRequests].map(
        (proxyRequest) =>
          new Promise<void>((resolve) => {
            if (proxyRequest.closed) resolve();
            else proxyRequest.once("close", resolve);
          }),
      );
      const socketClosures = [...sockets].map(
        (socket) =>
          new Promise<void>((resolve) => {
            if (socket.closed) resolve();
            else socket.once("close", resolve);
          }),
      );
      for (const proxyRequest of proxyRequests) proxyRequest.destroy();
      for (const socket of sockets) socket.destroy();
      const settled = await Promise.allSettled([
        serverClosed,
        mcp.close(),
        cros.close(),
        ...proxyClosures,
        ...socketClosures,
      ]);
      for (const socket of sockets) if (socket.closed) sockets.delete(socket);
      if (settled.some((result) => result.status === "rejected"))
        throw new Error("cros_shared_server_cleanup_unconfirmed");
      if (proxyRequests.size !== 0)
        throw new Error("cros_shared_server_proxy_cleanup_unconfirmed");
      if (sockets.size !== 0)
        throw new Error("cros_shared_server_socket_cleanup_unconfirmed");
      return Object.freeze({
        status: "completed" as const,
        cleanupConfirmed: true as const,
      });
    })();
    return closePromise;
  };

  return Object.freeze({
    publicOrigin: publicOrigin.origin,
    localGatewayUrl: `http://${HOST}:${address.port}`,
    restPortfolioPath: "/v1/portfolio" as const,
    mcpPath: MCP_PATH,
    close,
  });
}

/**
 * 公開Origin設定をHTTPS Originへ正規化する。
 *
 * @responsibility PathやCredentialを含まないHTTPS OriginだけをShared Server設定として受理する。
 * @trace ARCH-000013
 * @input valueに運用設定から得た公開Origin文字列を受け取る。
 * @returns 正規化済みURLを返す。
 * @precondition 入力を信頼済みURLと仮定しない。
 * @postcondition 戻り値はHTTPS、Root Path、認証情報なしのOriginである。
 * @effect N/A: 入力文字列を解析するだけである。
 * @failure 不正URL、非HTTPS、Path、Query、Fragmentまたは認証情報を例外で拒否する。
 * @invariant localhostやIPもHTTPSを省略できない。
 * @boundary 運用設定文字列とShared Server配置契約の境界。
 * @security TLS未使用の公開Endpointを許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectPublicOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("cros_shared_server_public_origin_invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new Error("cros_shared_server_public_origin_invalid");
  return url;
}

/**
 * 一つのGateway要求をTLS配置検証後に固定内部Routeへ中継する。
 *
 * @responsibility Forwarded情報、Origin、RouteおよびBody上限を検証してCROS RESTまたはMCPへ一回だけ送る。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 外部Request／Response、期待公開Origin、内部Targetおよび追跡集合を受け取る。
 * @returns Response完了時に解決するPromiseを返す。
 * @precondition Gateway Listenerはloopbackに限定され、TLS終端がForwarded Headerを上書きする。
 * @postcondition 一要求は高々一つの内部Targetへ中継され、追跡集合から除去される。
 * @effect HTTP Bodyを固定上限内で読み、内部loopback Requestと公開Responseを発行する。
 * @failure TLS情報、Origin、Route、Bodyまたは内部Transport失敗を秘密値なしのHTTP結果へ閉じる。
 * @invariant 任意Proxy Target、Host PathまたはBearer値を応答へ含めない。
 * @boundary loopback Gatewayと二つの内部Transportの要求境界。
 * @security 許可Headerだけを内部へ渡し、外部Origin HeaderはGateway検証後に除去する。
 * @concurrency Request単位のProxy Requestを集合で追跡し、Server終了で取消可能にする。
 */
async function dispatchSharedRequest(
  request: IncomingMessage,
  response: ServerResponse,
  publicOrigin: URL,
  crosTarget: string,
  mcpTarget: string,
  proxyRequests: Set<ReturnType<typeof createProxyRequest>>,
): Promise<void> {
  try {
    const requestPath = request.url?.split("?", 1)[0] ?? "";
    if (!hasExpectedTlsTermination(request.headers, publicOrigin)) {
      sendGatewayJson(response, 421, "cros_shared_server_tls_boundary_invalid");
      request.resume();
      return;
    }
    const origin = request.headers.origin;
    if (typeof origin === "string" && origin !== publicOrigin.origin) {
      sendGatewayJson(response, 403, "cros_shared_server_origin_rejected");
      request.resume();
      return;
    }
    if (requestPath === PUBLIC_HEALTH_PATH) {
      sendGatewayJson(response, 200, "cros_shared_server_ready", {
        publicOrigin: publicOrigin.origin,
        restPortfolioPath: "/v1/portfolio",
        mcpPath: MCP_PATH,
      });
      request.resume();
      return;
    }
    const target =
      requestPath === MCP_PATH
        ? mcpTarget
        : isCrosPath(requestPath)
          ? crosTarget
          : null;
    if (target === null) {
      sendGatewayJson(response, 404, "cros_shared_server_route_not_found");
      request.resume();
      return;
    }
    const declaredLength = Number(request.headers["content-length"] ?? 0);
    if (
      !Number.isFinite(declaredLength) ||
      declaredLength < 0 ||
      declaredLength > MAXIMUM_REQUEST_BYTES
    ) {
      sendGatewayJson(response, 413, "cros_shared_server_request_too_large");
      request.resume();
      return;
    }
    await proxyRequest(request, response, target, proxyRequests);
  } catch {
    if (!response.headersSent)
      sendGatewayJson(response, 503, "cros_shared_server_unavailable");
    else response.destroy();
  }
}

/**
 * Requestが期待する外部TLS終端を経由したことを配置Headerから確認する。
 *
 * @responsibility `x-forwarded-proto`と`x-forwarded-host`を公開Originへ完全一致させる。
 * @trace ARCH-000013
 * @input HTTP Headerと期待公開Originを受け取る。
 * @returns 両Headerが単一値で完全一致した場合だけtrueを返す。
 * @precondition TLS終端がClient由来の同Headerを削除して自身の値へ置換する。
 * @postcondition 不在、複数値、HTTPまたは別Hostをfalseにする。
 * @effect N/A: Headerを観測するだけである。
 * @failure 不正値をfalseへ閉じる。
 * @invariant Forwarded Header自体を認証やContent Grantに使用しない。
 * @boundary TLS終端配置とloopback Gatewayの境界。
 * @security ClientがGatewayへ直接到達できないOS／Network境界を前提とし、HeaderだけをTLS証明にしない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function hasExpectedTlsTermination(
  headers: IncomingHttpHeaders,
  publicOrigin: URL,
): boolean {
  return (
    headers["x-forwarded-proto"] === "https" &&
    headers["x-forwarded-host"] === publicOrigin.host
  );
}

/**
 * 外部公開を許可するCROS REST Pathかを判定する。
 *
 * @responsibility 内部CROS Transportへ渡せるPathを固定Namespaceへ限定する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input queryを除いたRequest Pathを受け取る。
 * @returns `/v1/`またはCROS Health Pathに属する場合だけtrueを返す。
 * @precondition pathはURLのPath部分である。
 * @postcondition 任意Proxy Pathを受理しない。
 * @effect N/A: 文字列を比較するだけである。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant MCP PathをCROS RESTへ渡さない。
 * @boundary Gateway Route TableとCROS REST Transportの境界。
 * @security URLをProxy Targetとして解釈しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function isCrosPath(path: string): boolean {
  return path.startsWith("/v1/") || path === "/.well-known/cros-health";
}

/**
 * 検証済み要求を一つの内部loopback Transportへ中継する。
 *
 * @responsibility Method、Path、限定HeaderおよびBodyを内部へ渡し、許可Response HeaderとBodyを返す。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 外部Request／Response、固定Target URLおよび進行中Request集合を受け取る。
 * @returns 内部Responseまたは失敗Response完了時に解決するPromiseを返す。
 * @precondition targetはCompositionが開始したloopback Transportである。
 * @postcondition Proxy Requestを集合から除去し、Client切断時は内部Requestを取消す。
 * @effect 内部HTTP Requestを一回発行し、Responseを搬送する。
 * @failure 内部Network失敗を503へ閉じる。
 * @invariant Host、Origin、Forwarded Headerおよびhop-by-hop Headerを内部へ透過しない。
 * @boundary Gatewayと内部Transportのloopback HTTP境界。
 * @security Authorizationは処理のためだけに転送し、共有状態またはErrorへ保存しない。
 * @concurrency Client切断と内部完了を同じRequest Lifecycleへ収束させる。
 */
function proxyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  target: string,
  proxyRequests: Set<ReturnType<typeof createProxyRequest>>,
): Promise<void> {
  return new Promise((resolve) => {
    const targetUrl = new URL(request.url ?? "/", target);
    const proxy = createProxyRequest(
      targetUrl,
      {
        method: request.method,
        headers: selectForwardHeaders(request.headers),
      },
      (incoming) => {
        response.statusCode = incoming.statusCode ?? 502;
        copyResponseHeaders(incoming.headers, response);
        incoming.pipe(response);
        incoming.once("end", resolve);
        incoming.once("error", () => {
          response.destroy();
          resolve();
        });
      },
    );
    proxyRequests.add(proxy);
    const settle = () => {
      proxyRequests.delete(proxy);
    };
    proxy.once("close", settle);
    proxy.once("error", () => {
      settle();
      if (!response.headersSent)
        sendGatewayJson(
          response,
          503,
          "cros_shared_server_upstream_unavailable",
        );
      else response.destroy();
      resolve();
    });
    request.once("aborted", () => proxy.destroy());
    request.pipe(proxy);
  });
}

/**
 * 内部Transportへ渡せるRequest Headerだけを選ぶ。
 *
 * @responsibility Protocol、Content Negotiation、Body長およびBearer認証に必要なHeaderを限定コピーする。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 外部Request Headerを受け取る。
 * @returns 固定allowlistのHeader Objectを返す。
 * @precondition Header値を信頼済みと仮定しない。
 * @postcondition Host、Cookie、Origin、ForwardedおよびConnection Headerを含まない。
 * @effect N/A: 新しいObjectを構築するだけである。
 * @failure N/A: 不在Headerは省略する。
 * @invariant Authorization値を変換または記録しない。
 * @boundary 外部HTTP Headerと内部Transport Headerの境界。
 * @security allowlist外Headerを透過しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function selectForwardHeaders(
  headers: IncomingHttpHeaders,
): Record<string, string | string[]> {
  const selected: Record<string, string | string[]> = {};
  for (const name of [
    "authorization",
    "accept",
    "content-type",
    "content-length",
    "mcp-protocol-version",
    "mcp-method",
    "mcp-name",
  ]) {
    const value = headers[name];
    if (typeof value === "string" || Array.isArray(value))
      selected[name] = value;
  }
  return selected;
}

/**
 * 内部Responseから公開可能なHeaderだけをGateway Responseへコピーする。
 *
 * @responsibility Content表現、認証Challenge、許可Methodおよび安全Headerだけを外部へ戻す。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 内部Response Headerと公開Responseを受け取る。
 * @returns N/A: Response Headerへ反映する。
 * @precondition responseは未完了である。
 * @postcondition hop-by-hop HeaderとCookieを公開しない。
 * @effect ServerResponse Headerを設定する。
 * @failure 不正または不在値を省略する。
 * @invariant Credentialまたは内部Hostを新しく追加しない。
 * @boundary 内部Transport Responseと公開Gateway Responseの境界。
 * @security 固定allowlist外Headerを透過しない。
 * @concurrency 一Responseだけを同期更新する。
 */
function copyResponseHeaders(
  headers: IncomingHttpHeaders,
  response: ServerResponse,
): void {
  for (const name of [
    "content-type",
    "content-length",
    "cache-control",
    "www-authenticate",
    "allow",
    "x-content-type-options",
    "referrer-policy",
  ]) {
    const value = headers[name];
    if (typeof value === "string" || Array.isArray(value))
      response.setHeader(name, value);
  }
}

/**
 * Gateway固有の閉じたJSON結果を返す。
 *
 * @responsibility Gateway状態を内部例外や秘密値なしの固定契約へ変換する。
 * @trace ARCH-000013
 * @input Response、HTTP Status、Reasonおよび任意の非秘密追加値を受け取る。
 * @returns N/A: JSON Responseを完了する。
 * @precondition Responseは未完了である。
 * @postcondition no-storeとJSON Content Typeを持つ一応答を返す。
 * @effect HTTP Responseを完了する。
 * @failure N/A: 固定Objectの直列化だけを行う。
 * @invariant Token、内部Port、Host PathまたはCredential Metadataを含めない。
 * @boundary Shared GatewayとExternal Consumerの結果境界。
 * @security Error Detailを閉じたreasonへ限定する。
 * @concurrency 一Responseだけを同期完了する。
 */
function sendGatewayJson(
  response: ServerResponse,
  statusCode: number,
  reason: string,
  values: Readonly<Record<string, string>> = {},
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(
    `${JSON.stringify({
      contract: "cros/shared-server/v1",
      status: statusCode < 400 ? "available" : "blocked",
      reason,
      ...values,
    })}\n`,
  );
}
