/**
 * MCPのStreamable HTTP受付、Bearer照合、要求取消と接続終了を所有する。
 * @packageDocumentation
 * @trace ARCH-000012
 */
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  isJsonContentType,
} from "@modelcontextprotocol/server";
import { inspectServerPublicOrigin } from "../service/configuration.ts";
import {
  createMcpRequestServer,
  finishMcpSdkRequest,
  inspectProtocolRequest,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  mcpSdkFailure,
  protocolError,
} from "./mcp-protocol.ts";
import type {
  McpAuthenticatedHttpOptions,
  McpAuthenticatedRequestHandlerResolver,
  McpRequestSource,
  McpResponse,
} from "./mcp-types.ts";
import { parseUnambiguousJsonDocument } from "./parse-json.ts";

const ENDPOINT = "/mcp";
const MAXIMUM_HTTP_REQUEST_BYTES = 128 * 1024;

/**
 * streamable-http-transportをPlain Dataとして検証する。
 *
 * @responsibility streamable-http-transportの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000012
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisPlainHttpRecordの入力契約を満たす。
 * @postcondition isPlainHttpRecordの責務を完了した結果だけを返す。
 * @effect N/A: isPlainHttpRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlainHttpRecordは独自の失敗分岐を所有しない。
 * @invariant isPlainHttpRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: isPlainHttpRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isPlainHttpRecordは共有非同期状態を持たない同期処理である。
 */
function isPlainHttpRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
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
  if (!isPlainHttpRecord(value)) return null;
  const params = value.params;
  if (!isPlainHttpRecord(params) || !isPlainHttpRecord(params._meta))
    return null;
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
    metadata.protocol !== MCP_COORDINATOR_PROTOCOL_VERSION ||
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
    if (size > MAXIMUM_HTTP_REQUEST_BYTES) return null;
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
 * 検査済みHTTP要求を公式SDKの要求別Serverへ一回だけ接続する。
 * @responsibility CRDDの入口検査とSDKのProtocol応答を分離する。
 * @trace ARCH-000012
 * @input 同じHTTP要求・応答、検査済みbody、現在認証のHandler、要求取消Signal。
 * @returns SDK応答の送信と要求別資源回収の完了。
 * @precondition 認証、本文byte・重複key、Header一致を既存入口が検査済み。
 * @postcondition 意味操作は高々一回。要求別Serverの生成失敗・開始前取消ではSDK搬送を始めない。
 * @effect 指定HandlerのEffect、SDKの応答搬送と要求別Serverの終了。
 * @failure 旧Tool errorをSDK ProtocolErrorへ変換し、内部例外を固定エラーへ閉じる。
 * @invariant JSON-RPC応答全体をTool結果へ二重格納せず、保存済みを再実行しない。
 * @boundary CRDDの要求認証・意味Handlerと公式SDK Node HTTPの境界。
 * @security 要求closureの資格・Ownerを共有せず、SDKの旧規格・未公開操作を有効化しない。
 * @concurrency HTTP切断・終了Signalを伝播し、開始済み意味操作をjoinしてからSDKを閉じる。
 */
async function handleSdkHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  body: unknown,
  handler: McpRequestSource,
  signal: AbortSignal,
): Promise<void> {
  const validated = inspectProtocolRequest(body);
  if (!validated) {
    respondJson(response, 200, protocolError(null, -32600, "Invalid Request"));
    return;
  }
  if (
    !["server/discover", "tools/list", "tools/call"].includes(validated.method)
  ) {
    respondJson(
      response,
      404,
      protocolError(validated.id, -32601, "Method not found"),
    );
    return;
  }
  if (signal.aborted) return;
  let pending: Promise<McpResponse> | null = null;
  let methodNotFound = false;
  let server: Awaited<ReturnType<typeof createMcpRequestServer>>;
  try {
    server = await createMcpRequestServer(
      handler,
      body,
      signal,
      (operation) => {
        pending = operation;
        void operation.then(
          (result) => {
            methodNotFound = result.error?.code === -32601;
          },
          () => {},
        );
      },
    );
  } catch (error) {
    const failure = mcpSdkFailure(validated.id, error);
    if (!signal.aborted)
      respondJson(
        response,
        failure.error?.code === -32601 ? 404 : 200,
        failure,
      );
    return;
  }
  if (signal.aborted) {
    await server.close();
    return;
  }
  const sdk = createMcpHandler(() => server, {
    legacy: "reject",
    maxRequestBodySize: MAXIMUM_HTTP_REQUEST_BYTES,
  });
  try {
    await toNodeHandler(sdk, {
      maxRequestBodySize: MAXIMUM_HTTP_REQUEST_BYTES,
    })(
      {
        method: request.method ?? "POST",
        url: request.url ?? ENDPOINT,
        headers: request.headers,
        [Symbol.asyncIterator]: () => request[Symbol.asyncIterator](),
      },
      {
        writeHead: (statusCode, headers) => {
          if (signal.aborted) {
            response.destroy();
            return response;
          }
          return response.writeHead(
            statusCode === 200 && methodNotFound ? 404 : statusCode,
            { ...headers, "cache-control": "no-store" },
          );
        },
        write: (chunk) => {
          if (signal.aborted) {
            response.destroy();
            return true;
          }
          return response.write(chunk);
        },
        end: (chunk) => {
          if (signal.aborted) {
            response.destroy();
            return response;
          }
          return response.end(chunk);
        },
        on: (event, listener) => response.on(event, listener),
        get destroyed() {
          return response.destroyed;
        },
      },
      body,
    );
  } finally {
    await finishMcpSdkRequest(pending, () => sdk.close());
  }
}

/**
 * MCPの生HTTP要求を公式SDKへ接続する。
 * @responsibility Origin・Bearer・Protocolを既存順に検査し、RequestをSDKへ搬送する。
 * @trace ARCH-000012
 * @boundary 単独または統合Listenerと要求別MCP Server。
 * @effect 認証済みのSDK要求を実行してHTTP応答を返す。構成時にListenerは作らない。
 * @security 認証失敗や取消済みの認証結果からToolを開始しない。
 * @concurrency Listener Ownerが与える要求専用Signalを使い、処理終了まで待つ。
 */
export function createMcpHttpRequestHandler(
  resolveHandler: McpAuthenticatedRequestHandlerResolver,
  options: Omit<McpAuthenticatedHttpOptions, "port"> &
    Readonly<{ resourceMetadataUrl?: URL }>,
) {
  const publicOrigin = inspectServerPublicOrigin(options.publicOrigin, "mcp");
  const metadata = options.resourceMetadataUrl?.href;
  if (
    (options.allowedOrigins ?? []).some(
      (origin) =>
        typeof origin !== "string" ||
        (publicOrigin
          ? origin !== publicOrigin.origin
          : !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$/u.test(
              origin,
            )),
    )
  )
    throw new Error("mcp_http_configuration_invalid");
  const allowedOrigins = new Set(
    options.allowedOrigins ?? (publicOrigin ? [publicOrigin.origin] : []),
  );
  return Object.freeze({
    endpoint: ENDPOINT,
    handle: async (
      request: IncomingMessage,
      response: ServerResponse,
      signal: AbortSignal,
    ): Promise<void> => {
      try {
        if (publicOrigin) {
          const exactHeaders = [
            ["host", publicOrigin.host],
            ["x-forwarded-proto", "https"],
            ["x-forwarded-host", publicOrigin.host],
          ];
          const invalid =
            exactHeaders.some(
              ([name, expected]) =>
                request.headers[name as string] !== expected ||
                request.rawHeaders.filter(
                  (value, index) =>
                    index % 2 === 0 && value.toLowerCase() === name,
                ).length !== 1,
            ) ||
            request.rawHeaders.filter(
              (value, index) =>
                index % 2 === 0 && value.toLowerCase() === "origin",
            ).length > 1;
          if (invalid) {
            respondJson(
              response,
              421,
              protocolError(null, -32000, "TLS deployment boundary invalid"),
            );
            return;
          }
        }
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
          (metadata === undefined ||
            request.headersDistinct.authorization?.length === 1) &&
          typeof authorization === "string" &&
          authorization.startsWith("Bearer ") &&
          validToken(authorization.slice("Bearer ".length))
            ? authorization.slice("Bearer ".length)
            : null;
        const handler =
          token === null ? null : await resolveHandler(token, signal);
        if (signal.aborted || response.destroyed) return;
        if (handler === null) {
          response.setHeader(
            "www-authenticate",
            metadata === undefined
              ? "Bearer"
              : `Bearer resource_metadata="${metadata}"${authorization === undefined ? "" : ', error="invalid_token"'}`,
          );
          respondJson(
            response,
            401,
            protocolError(null, -32001, "Authentication required"),
          );
          return;
        }
        if (
          !isJsonContentType(request.headers["content-type"]) ||
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
        await handleSdkHttpRequest(request, response, body, handler, signal);
      } catch {
        if (signal.aborted || response.destroyed) response.destroy();
        else if (!response.headersSent)
          respondJson(
            response,
            500,
            protocolError(null, -32603, "Internal error"),
          );
        else response.destroy();
      }
    },
  });
}
