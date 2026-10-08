/**
 * streamable-http-transportに属する責務をまとめる。
 *
 * @responsibility McpOrchestratorHttpOptionsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000012
 */
import { timingSafeEqual } from "node:crypto";
import http, {
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import { types as utilTypes } from "node:util";

import {
  handleMcpOrchestratorRequest,
  type McpOrchestratorDependencies,
} from "../orchestrator/adapter.ts";
import {
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  protocolError,
} from "../orchestrator/protocol.ts";
import { parseUnambiguousJsonDocument } from "../request/parse-json.ts";
import type {
  McpAuthenticatedRequestHandlerResolver,
  McpRequestHandler,
} from "./types.ts";

export const MCP_ORCHESTRATOR_STREAMABLE_HTTP_CONTRACT =
  "crdd-mcp/streamable-http-transport/v1" as const;
const ENDPOINT = "/mcp";
const MAXIMUM_REQUEST_BYTES = 128 * 1024;

/**
 * streamable-http-transportで使用するMcp Orchestrator Http Optionsの値契約を定義する。
 *
 * @responsibility Mcp Orchestrator Http OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000012
 * @shape McpOrchestratorHttpOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpOrchestratorHttpOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpOrchestratorHttpOptionsの宣言は外部境界を開かない。
 * @security N/A: McpOrchestratorHttpOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpOrchestratorHttpOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpOrchestratorHttpOptions = Readonly<{
  port: number;
  bearerToken: string;
  allowedOrigins?: readonly string[];
}>;

/**
 * Request単位認証を行うStreamable HTTPの非秘密構成を定義する。
 *
 * @responsibility Listener Portと許可OriginだけをTransport構成として保持する。
 * @trace ARCH-000012
 * @shape portと任意のallowedOriginsを持つ閉じた構成型である。
 * @invariant Bearer TokenやCredentialを構成へ保持しない。
 * @boundary Shared Server Compositionと認証済みMCP HTTP Transportの型境界。
 * @security 秘密値をPropertyとして許可しない。
 * @compatibility Consumerは宣言済みPropertyだけを指定する。
 */
export type McpAuthenticatedHttpOptions = Readonly<{
  port: number;
  allowedOrigins?: readonly string[];
}>;

/**
 * streamable-http-transportをPlain Dataとして検証する。
 *
 * @responsibility streamable-http-transportの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000012
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がplainの入力契約を満たす。
 * @postcondition plainの責務を完了した結果だけを返す。
 * @effect N/A: plainは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainは独自の失敗分岐を所有しない。
 * @invariant plainは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: plainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainは共有非同期状態を持たない同期処理である。
 */
function plain(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !utilTypes.isProxy(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
}

/**
 * Tokenが有効か判定する。
 *
 * @responsibility Tokenの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000012
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTokenの入力契約を満たす。
 * @postcondition validTokenの責務を完了した結果だけを返す。
 * @effect N/A: validTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTokenは独自の失敗分岐を所有しない。
 * @invariant validTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: validTokenはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTokenは共有非同期状態を持たない同期処理である。
 */
function validToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 512 &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

/**
 * authorizedを決定する。
 *
 * @responsibility authorizedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000012
 * @input headers: IncomingHttpHeaders、expected: Buffer
 * @returns authorizedの計算結果を返す。
 * @precondition 「headers: IncomingHttpHeaders、expected: Buffer」がauthorizedの入力契約を満たす。
 * @postcondition authorizedの責務を完了した結果だけを返す。
 * @effect N/A: authorizedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: authorizedは独自の失敗分岐を所有しない。
 * @invariant authorizedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: authorizedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: authorizedは共有非同期状態を持たない同期処理である。
 */
function authorized(headers: IncomingHttpHeaders, expected: Buffer) {
  const header = headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const candidate = header.slice("Bearer ".length);
  if (!validToken(candidate)) return false;
  const bytes = Buffer.from(candidate, "utf8");
  return (
    bytes.byteLength === expected.byteLength && timingSafeEqual(bytes, expected)
  );
}

/**
 * JsonをProtocol応答として返す。
 *
 * @responsibility Jsonの応答Schema、状態Code、公開結果境界を所有する。
 * @trace ARCH-000012
 * @input response: ServerResponse、statusCode: number、body: unknown
 * @returns N/A: respondJsonは戻り値を返さない。
 * @precondition 「response: ServerResponse、statusCode: number、body: unknown」がrespondJsonの入力契約を満たす。
 * @postcondition respondJsonの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: respondJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: respondJsonは独自の失敗分岐を所有しない。
 * @invariant respondJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: respondJsonはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: respondJsonは共有非同期状態を持たない同期処理である。
 */
function respondJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
) {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(bytes.byteLength),
    "cache-control": "no-store",
  });
  response.end(bytes);
}

/**
 * Required Representationsを受入れ可能か判定する。
 *
 * @responsibility Required Representationsの受入条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000012
 * @input headers: IncomingHttpHeaders
 * @returns acceptsRequiredRepresentationsの計算結果を返す。
 * @precondition 「headers: IncomingHttpHeaders」がacceptsRequiredRepresentationsの入力契約を満たす。
 * @postcondition acceptsRequiredRepresentationsの責務を完了した結果だけを返す。
 * @effect N/A: acceptsRequiredRepresentationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: acceptsRequiredRepresentationsは独自の失敗分岐を所有しない。
 * @invariant acceptsRequiredRepresentationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: acceptsRequiredRepresentationsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: acceptsRequiredRepresentationsは共有非同期状態を持たない同期処理である。
 */
function acceptsRequiredRepresentations(headers: IncomingHttpHeaders) {
  const accept = headers.accept;
  if (typeof accept !== "string") return false;
  const values = accept
    .split(",")
    .map((value) => value.split(";", 1)[0]?.trim().toLowerCase());
  return (
    values.includes("application/json") && values.includes("text/event-stream")
  );
}

/**
 * Metadataを要求する。
 *
 * @responsibility Metadataの要求条件、受理結果、Effect未成立との分離境界を所有する。
 * @trace ARCH-000012
 * @input value: unknown
 * @returns requestMetadataの計算結果を返す。
 * @precondition 「value: unknown」がrequestMetadataの入力契約を満たす。
 * @postcondition requestMetadataの責務を完了した結果だけを返す。
 * @effect N/A: requestMetadataは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: requestMetadataは独自の失敗分岐を所有しない。
 * @invariant requestMetadataは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: requestMetadataはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requestMetadataは共有非同期状態を持たない同期処理である。
 */
function requestMetadata(value: unknown) {
  if (!plain(value)) return null;
  const params = value.params;
  if (!plain(params) || !plain(params._meta)) return null;
  const protocol = params._meta["io.modelcontextprotocol/protocolVersion"];
  const name = typeof params.name === "string" ? params.name : null;
  return typeof value.method === "string" && typeof protocol === "string"
    ? Object.freeze({ method: value.method, protocol, name })
    : null;
}

/**
 * MatchのHeader条件が一致するか判定する。
 *
 * @responsibility Matchの比較対象、必須Header、一致結果境界を所有する。
 * @trace ARCH-000012
 * @input headers: IncomingHttpHeaders、body: unknown
 * @returns headersMatchの計算結果を返す。
 * @precondition 「headers: IncomingHttpHeaders、body: unknown」がheadersMatchの入力契約を満たす。
 * @postcondition headersMatchの責務を完了した結果だけを返す。
 * @effect N/A: headersMatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: headersMatchは独自の失敗分岐を所有しない。
 * @invariant headersMatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: headersMatchはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: headersMatchは共有非同期状態を持たない同期処理である。
 */
function headersMatch(headers: IncomingHttpHeaders, body: unknown) {
  const metadata = requestMetadata(body);
  if (!metadata) return false;
  if (
    headers["mcp-protocol-version"] !== metadata.protocol ||
    metadata.protocol !== MCP_ORCHESTRATOR_PROTOCOL_VERSION ||
    headers["mcp-method"] !== metadata.method
  )
    return false;
  const headerName = headers["mcp-name"];
  return metadata.method === "tools/call"
    ? typeof headerName === "string" && headerName === metadata.name
    : headerName === undefined;
}

/**
 * Bodyを読み取る。
 *
 * @responsibility Bodyの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000012
 * @input request: IncomingMessage
 * @returns readBodyの計算結果を返す。
 * @precondition 「request: IncomingMessage」がreadBodyの入力契約を満たす。
 * @postcondition readBodyの責務を完了した結果だけを返す。
 * @effect N/A: readBodyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readBodyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readBodyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: readBodyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency readBodyは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAXIMUM_REQUEST_BYTES) return null;
    chunks.push(bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
  } catch {
    return null;
  }
}

/**
 * Start the stateless 2026-07-28 Streamable HTTP binding. Authentication is
 *
 * @responsibility Mcp Orchestrator Streamable Httpの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000012
 * @input dependencies: McpOrchestratorDependencies、options: McpOrchestratorHttpOptions
 * @returns startMcpOrchestratorStreamableHttpの計算結果を返す。
 * @precondition 「dependencies: McpOrchestratorDependencies、options: McpOrchestratorHttpOptions」がstartMcpOrchestratorStreamableHttpの入力契約を満たす。
 * @postcondition startMcpOrchestratorStreamableHttpの責務を完了した結果だけを返す。
 * @effect N/A: startMcpOrchestratorStreamableHttpは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure startMcpOrchestratorStreamableHttpは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startMcpOrchestratorStreamableHttpは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: startMcpOrchestratorStreamableHttpはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency startMcpOrchestratorStreamableHttpは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function startMcpStreamableHttpWithHandler(
  resolveHandler: McpAuthenticatedRequestHandlerResolver,
  options: McpAuthenticatedHttpOptions,
) {
  if (
    !Number.isInteger(options.port) ||
    options.port < 0 ||
    options.port > 65_535 ||
    (options.allowedOrigins ?? []).some(
      (origin) =>
        typeof origin !== "string" ||
        !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$/u.test(
          origin,
        ),
    )
  )
    throw new Error("orchestrator_mcp_http_configuration_invalid");
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const active = new Set<Promise<void>>();
  const controllers = new Set<AbortController>();
  const requests = new Set<IncomingMessage>();
  const sockets = new Set<Socket>();
  let isClosing = false;
  const server = http.createServer((request, response) => {
    if (isClosing) {
      request.destroy();
      return;
    }
    requests.add(request);
    const controller = new AbortController();
    controllers.add(controller);
    const operation = (async () => {
      const abortOnDisconnect = () => {
        if (!response.writableFinished) controller.abort();
      };
      response.once("close", abortOnDisconnect);
      try {
        const origin = request.headers.origin;
        if (typeof origin === "string" && !allowedOrigins.has(origin)) {
          respondJson(
            response,
            403,
            protocolError(null, -32000, "Origin not allowed"),
          );
          return;
        }
        if (request.url !== ENDPOINT) {
          respondJson(
            response,
            404,
            protocolError(null, -32601, "Method not found"),
          );
          return;
        }
        if (request.method !== "POST") {
          response.setHeader("allow", "POST");
          respondJson(
            response,
            405,
            protocolError(null, -32600, "POST required"),
          );
          return;
        }
        const authorization = request.headers.authorization;
        const token =
          typeof authorization === "string" &&
          authorization.startsWith("Bearer ") &&
          validToken(authorization.slice("Bearer ".length))
            ? authorization.slice("Bearer ".length)
            : null;
        const handler = token === null ? null : await resolveHandler(token);
        if (handler === null) {
          response.setHeader("www-authenticate", "Bearer");
          respondJson(
            response,
            401,
            protocolError(null, -32001, "Authentication required"),
          );
          return;
        }
        if (
          request.headers["content-type"]
            ?.split(";", 1)[0]
            ?.trim()
            .toLowerCase() !== "application/json" ||
          !acceptsRequiredRepresentations(request.headers)
        ) {
          respondJson(
            response,
            400,
            protocolError(null, -32600, "Invalid HTTP headers"),
          );
          return;
        }
        const source = await readBody(request);
        const body =
          source === null ? null : parseUnambiguousJsonDocument(source);
        if (!body) {
          respondJson(
            response,
            400,
            protocolError(null, -32700, "Parse error"),
          );
          return;
        }
        if (!headersMatch(request.headers, body)) {
          respondJson(
            response,
            400,
            protocolError(null, -32020, "Header mismatch"),
          );
          return;
        }
        const result = await handler(body, controller.signal);
        if (!controller.signal.aborted)
          respondJson(
            response,
            result.error?.code === -32601 ? 404 : 200,
            result,
          );
      } catch {
        if (isClosing || controller.signal.aborted) response.destroy();
        else if (!response.headersSent)
          respondJson(
            response,
            500,
            protocolError(null, -32603, "Internal error"),
          );
        else response.destroy();
      } finally {
        response.removeListener("close", abortOnDisconnect);
        requests.delete(request);
        controllers.delete(controller);
      }
    })();
    active.add(operation);
    operation.finally(() => active.delete(operation)).catch(() => undefined);
  });
  server.on("connection", (socket) => {
    if (isClosing) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    const failed = (error: Error) => reject(error);
    server.once("error", failed);
    server.listen(options.port, "127.0.0.1", () => {
      server.removeListener("error", failed);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("orchestrator_mcp_http_address_unavailable");
  }
  let closePromise: Promise<
    Readonly<{ status: "completed"; cleanupConfirmed: true }>
  > | null = null;
  const close = () => {
    if (closePromise) return closePromise;
    isClosing = true;
    closePromise = (async () => {
      const serverClosed = new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      server.closeIdleConnections();
      for (const request of requests) request.destroy();
      for (const controller of controllers) controller.abort();
      await Promise.allSettled([...active]);
      const socketClosures = [...sockets].map(
        (socket) =>
          new Promise<void>((resolve) => {
            if (socket.closed) {
              sockets.delete(socket);
              resolve();
            } else socket.once("close", () => resolve());
          }),
      );
      for (const socket of sockets) if (!socket.destroyed) socket.destroy();
      await Promise.all(socketClosures);
      await serverClosed;
      if (
        active.size !== 0 ||
        controllers.size !== 0 ||
        requests.size !== 0 ||
        sockets.size !== 0
      )
        throw new Error("orchestrator_mcp_http_cleanup_unconfirmed");
      return Object.freeze({
        status: "completed" as const,
        cleanupConfirmed: true as const,
      });
    })();
    return closePromise;
  };
  return Object.freeze({
    contract: MCP_ORCHESTRATOR_STREAMABLE_HTTP_CONTRACT,
    host: "127.0.0.1" as const,
    port: address.port,
    endpoint: ENDPOINT,
    close,
  });
}

/**
 * Application Handlerを使用してStreamable HTTPを開始する。
 *
 * @responsibility HTTP認証・Lifecycleを特定MCP Capabilityから分離する。
 * @trace ARCH-000012
 * @input handlerとHTTP optionsを受け取る。
 * @returns 待受情報と終了操作を持つServer Handleを返す。
 * @precondition handlerは一Requestを一応答へ収束させる。
 * @postcondition 127.0.0.1だけで待受け、close時にRequestとSocketを回収する。
 * @effect localhost listenerを開始し、HTTP応答を返す。
 * @failure 構成、認証、ProtocolまたはLifecycle失敗を安全に拒否する。
 * @invariant TransportはTool固有の意味処理を持たない。
 * @boundary localhost HTTPとMCP Application Handlerの境界。
 * @security Bearer認証成功後の要求だけをHandlerへ渡す。
 * @concurrency Requestごとの取消とServer全体のjoinを管理する。
 */
export async function startMcpStreamableHttp(
  handler: McpRequestHandler,
  options: McpOrchestratorHttpOptions,
) {
  if (!validToken(options.bearerToken))
    throw new Error("orchestrator_mcp_http_configuration_invalid");
  const expectedToken = Buffer.from(options.bearerToken, "utf8");
  return startMcpStreamableHttpWithHandler(
    (token) =>
      authorized({ authorization: `Bearer ${token}` }, expectedToken)
        ? handler
        : null,
    options,
  );
}

/**
 * RequestごとにBearer Credentialを検証するStreamable HTTPを開始する。
 *
 * @responsibility 固定Transport TokenではなくApplication CredentialからRequest Handlerを解決する。
 * @trace ARCH-000012
 * @input resolverとloopback HTTP構成を受け取る。
 * @returns 待受情報と終了操作を持つServer Handleを返す。
 * @precondition resolverは認証失敗をnullで返し、Tokenを保存しない。
 * @postcondition 認証成功Requestだけが解決済みHandlerへ渡る。
 * @effect localhost listenerを開始し、HTTP応答を返す。
 * @failure 不正構成、認証失敗またはProtocol失敗を安全なHTTP結果へ閉じる。
 * @invariant TransportはWorkspace GrantまたはProject Contextを解釈しない。
 * @boundary Bearer HTTPとApplication Credential Resolverの境界。
 * @security 生Tokenを応答、Errorまたは共有状態へ保存しない。
 * @concurrency Requestごとに独立してresolverを呼び出す。
 */
export async function startMcpAuthenticatedStreamableHttp(
  resolver: McpAuthenticatedRequestHandlerResolver,
  options: McpAuthenticatedHttpOptions,
) {
  return startMcpStreamableHttpWithHandler(resolver, options);
}

/**
 * Orchestrator互換入口でStreamable HTTPを開始する。
 *
 * @responsibility 既存利用側をOrchestrator Adapterへ接続する互換入口を維持する。
 * @trace ARCH-000012
 * @input dependenciesとHTTP optionsを受け取る。
 * @returns 待受情報と終了操作を持つServer Handleを返す。
 * @precondition dependenciesはOrchestrator公開契約を満たす。
 * @postcondition 全RequestをOrchestrator Adapterへだけ渡す。
 * @effect localhost listenerを開始し、HTTP応答を返す。
 * @failure TransportまたはAdapter失敗を安全に拒否する。
 * @invariant 既存公開関数の意味を変更しない。
 * @boundary localhost HTTPとOrchestrator Adapterの互換境界。
 * @security HTTP認証とOrchestrator Client認証を両方維持する。
 * @concurrency Requestごとの取消とServer全体のjoinを管理する。
 */
export async function startMcpOrchestratorStreamableHttp(
  dependencies: McpOrchestratorDependencies,
  options: McpOrchestratorHttpOptions,
) {
  if (!validToken(options.bearerToken))
    throw new Error("orchestrator_mcp_http_configuration_invalid");
  const expected = Buffer.from(options.bearerToken, "utf8");
  return startMcpStreamableHttpWithHandler((token) => {
    return authorized({ authorization: `Bearer ${token}` }, expected)
      ? (request, signal) =>
          handleMcpOrchestratorRequest(request, dependencies, signal)
      : null;
  }, options);
}

/**
 * Mcp Orchestrator Streamable Http 契約の公開契約を記述する。
 *
 * @responsibility Mcp Orchestrator Streamable Http 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeMcpOrchestratorStreamableHttpContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeMcpOrchestratorStreamableHttpContractの入力契約を満たす。
 * @postcondition describeMcpOrchestratorStreamableHttpContractの責務を完了した結果だけを返す。
 * @effect N/A: describeMcpOrchestratorStreamableHttpContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeMcpOrchestratorStreamableHttpContractは独自の失敗分岐を所有しない。
 * @invariant describeMcpOrchestratorStreamableHttpContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeMcpOrchestratorStreamableHttpContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeMcpOrchestratorStreamableHttpContractは共有非同期状態を持たない同期処理である。
 */
export function describeMcpOrchestratorStreamableHttpContract() {
  return Object.freeze({
    contract: MCP_ORCHESTRATOR_STREAMABLE_HTTP_CONTRACT,
    protocolVersion: MCP_ORCHESTRATOR_PROTOCOL_VERSION,
    endpoint: ENDPOINT,
    binding: "127.0.0.1_only",
    authentication: "mandatory_bearer",
    origin: "absent_or_explicit_local_allowlist",
    session: "none_2026_07_28",
    cancellation: "response_disconnect_aborts_request",
    transportAuthority: "none",
  });
}
