import { timingSafeEqual } from "node:crypto";
import http, {
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import { types as utilTypes } from "node:util";

import {
  handleMcpProjectRuntimeRequest,
  type McpProjectRuntimeDependencies,
} from "../adapters/project-runtime-adapter.ts";
import {
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  protocolError,
} from "../protocol/project-runtime-protocol.ts";
import { parseUnambiguousJsonDocument } from "../protocol/unambiguous-json-document.ts";

export const MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT =
  "crdd-mcp/streamable-http-transport/v1" as const;
const ENDPOINT = "/mcp";
const MAXIMUM_REQUEST_BYTES = 128 * 1024;

/**
 * McpProjectRuntimeHttpOptionsが扱う値の構造を表す。
 *
 * @responsibility McpProjectRuntimeHttpOptionsに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000012
 * @shape McpProjectRuntimeHttpOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant McpProjectRuntimeHttpOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: McpProjectRuntimeHttpOptionsの宣言は外部境界を開かない。
 * @security N/A: McpProjectRuntimeHttpOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility McpProjectRuntimeHttpOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type McpProjectRuntimeHttpOptions = Readonly<{
  port: number;
  bearerToken: string;
  allowedOrigins?: readonly string[];
}>;

/**
 * plainの処理を実行する。
 *
 * @responsibility plainに対応する入力処理と結果生成を所有する。
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
 * validTokenの処理を実行する。
 *
 * @responsibility validTokenに対応する入力処理と結果生成を所有する。
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
 * authorizedの処理を実行する。
 *
 * @responsibility authorizedに対応する入力処理と結果生成を所有する。
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
 * respondJsonの処理を実行する。
 *
 * @responsibility respondJsonに対応する入力処理と結果生成を所有する。
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
 * acceptsRequiredRepresentationsの処理を実行する。
 *
 * @responsibility acceptsRequiredRepresentationsに対応する入力処理と結果生成を所有する。
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
 * requestMetadataの処理を実行する。
 *
 * @responsibility requestMetadataに対応する入力処理と結果生成を所有する。
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
 * headersMatchの処理を実行する。
 *
 * @responsibility headersMatchに対応する入力処理と結果生成を所有する。
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
    metadata.protocol !== MCP_PROJECT_RUNTIME_PROTOCOL_VERSION ||
    headers["mcp-method"] !== metadata.method
  )
    return false;
  const headerName = headers["mcp-name"];
  return metadata.method === "tools/call"
    ? typeof headerName === "string" && headerName === metadata.name
    : headerName === undefined;
}

/**
 * readBodyの処理を実行する。
 *
 * @responsibility readBodyに対応する入力処理と結果生成を所有する。
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
 * @responsibility startMcpProjectRuntimeStreamableHttpに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input dependencies: McpProjectRuntimeDependencies、options: McpProjectRuntimeHttpOptions
 * @returns startMcpProjectRuntimeStreamableHttpの計算結果を返す。
 * @precondition 「dependencies: McpProjectRuntimeDependencies、options: McpProjectRuntimeHttpOptions」がstartMcpProjectRuntimeStreamableHttpの入力契約を満たす。
 * @postcondition startMcpProjectRuntimeStreamableHttpの責務を完了した結果だけを返す。
 * @effect N/A: startMcpProjectRuntimeStreamableHttpは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure startMcpProjectRuntimeStreamableHttpは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startMcpProjectRuntimeStreamableHttpは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: startMcpProjectRuntimeStreamableHttpはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency startMcpProjectRuntimeStreamableHttpは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function startMcpProjectRuntimeStreamableHttp(
  dependencies: McpProjectRuntimeDependencies,
  options: McpProjectRuntimeHttpOptions,
) {
  if (
    !Number.isInteger(options.port) ||
    options.port < 0 ||
    options.port > 65_535 ||
    !validToken(options.bearerToken) ||
    (options.allowedOrigins ?? []).some(
      (origin) =>
        typeof origin !== "string" ||
        !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$/u.test(
          origin,
        ),
    )
  )
    throw new Error("project_runtime_mcp_http_configuration_invalid");
  const expectedToken = Buffer.from(options.bearerToken, "utf8");
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
        if (!authorized(request.headers, expectedToken)) {
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
        const result = await handleMcpProjectRuntimeRequest(
          body,
          dependencies,
          controller.signal,
        );
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
    throw new Error("project_runtime_mcp_http_address_unavailable");
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
        throw new Error("project_runtime_mcp_http_cleanup_unconfirmed");
      return Object.freeze({
        status: "completed" as const,
        cleanupConfirmed: true as const,
      });
    })();
    return closePromise;
  };
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT,
    host: "127.0.0.1" as const,
    port: address.port,
    endpoint: ENDPOINT,
    close,
  });
}

/**
 * describeMcpProjectRuntimeStreamableHttpContractの処理を実行する。
 *
 * @responsibility describeMcpProjectRuntimeStreamableHttpContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeMcpProjectRuntimeStreamableHttpContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeMcpProjectRuntimeStreamableHttpContractの入力契約を満たす。
 * @postcondition describeMcpProjectRuntimeStreamableHttpContractの責務を完了した結果だけを返す。
 * @effect N/A: describeMcpProjectRuntimeStreamableHttpContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeMcpProjectRuntimeStreamableHttpContractは独自の失敗分岐を所有しない。
 * @invariant describeMcpProjectRuntimeStreamableHttpContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeMcpProjectRuntimeStreamableHttpContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeMcpProjectRuntimeStreamableHttpContractは共有非同期状態を持たない同期処理である。
 */
export function describeMcpProjectRuntimeStreamableHttpContract() {
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_STREAMABLE_HTTP_CONTRACT,
    protocolVersion: MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
    endpoint: ENDPOINT,
    binding: "127.0.0.1_only",
    authentication: "mandatory_bearer",
    origin: "absent_or_explicit_local_allowlist",
    session: "none_2026_07_28",
    cancellation: "response_disconnect_aborts_request",
    transportAuthority: "none",
  });
}
