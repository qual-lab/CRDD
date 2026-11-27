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
  type AuthInfo,
  bearerAuthChallengeResponse,
  createMcpHandler,
  isJsonContentType,
  OAuthError,
  OAuthErrorCode,
  ProtocolError,
} from "@modelcontextprotocol/server";
import { inspectServerPublicOrigin } from "../service/configuration.ts";
import {
  finishMcpSdkRequest,
  acceptMcpRequest,
  inspectProtocolRequest,
  isMcpPublicRequest,
  mcpSdkFailure,
  protocolError,
  createUnsupportedProtocolVersionResponse,
} from "./mcp-protocol.ts";
import type {
  McpAuthenticatedHttpOptions,
  McpOAuthHttpAccess,
  McpResponse,
  McpServerFactory,
} from "./mcp-types.ts";
import { parseUnambiguousJsonDocument } from "./parse-json.ts";

const ENDPOINT = "/mcp";
const MAXIMUM_HTTP_REQUEST_BYTES = 128 * 1024;

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
  handler: McpServerFactory | null,
  signal: AbortSignal,
  authInfo?: AuthInfo,
): Promise<void> {
  const headerOnly = body === undefined;
  const validated = headerOnly ? null : inspectProtocolRequest(body);
  if (!headerOnly && !validated) {
    respondJson(response, 200, protocolError(null, -32600, "Invalid Request"));
    return;
  }
  // SDKはTool呼出し以外で送られたMcp-Nameを検査しない。
  if (
    validated &&
    validated.method !== "tools/call" &&
    request.headers["mcp-name"] !== undefined
  ) {
    respondJson(response, 400, protocolError(null, -32020, "Header mismatch"));
    return;
  }
  if (signal.aborted) return;
  let pending: Promise<McpResponse> | null = null;
  let methodNotFound = false;
  const factoryFailure: { response?: McpResponse } = {};
  const sdk = createMcpHandler(
    async (context) => {
      try {
        if (signal.aborted)
          throw new ProtocolError(-32800, "Request cancelled");
        if (!handler || !validated)
          throw new ProtocolError(-32600, "Invalid Request");
        if (!isMcpPublicRequest(validated))
          throw new ProtocolError(-32601, "Method not found");
        const server = await handler.createServer(
          acceptMcpRequest(validated),
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
          context.authInfo,
        );
        if (signal.aborted) {
          await server.close();
          throw new ProtocolError(-32800, "Request cancelled");
        }
        return server;
      } catch (error) {
        if (validated)
          factoryFailure.response = mcpSdkFailure(validated.id, error);
        throw error;
      }
    },
    {
      legacy: "reject",
      maxRequestBodySize: MAXIMUM_HTTP_REQUEST_BYTES,
    },
  );
  try {
    await toNodeHandler(
      {
        async fetch(incoming, options) {
          const result = await sdk.fetch(incoming, options);
          const failure = factoryFailure.response;
          if (!failure) {
            if (result.status !== 400) return result;
            const payload: McpResponse = await result.clone().json();
            const code = payload.error?.code;
            if (code !== -32020 && code !== -32022 && code !== -32602)
              return result;
            // SDKの前段エラーに含まれる入力値と検査詳細を公開しない。
            await result.body?.cancel();
            return Response.json(
              code === -32602
                ? protocolError(null, -32602, "Invalid params")
                : code === -32022
                  ? createUnsupportedProtocolVersionResponse(payload)
                  : protocolError(null, -32020, "Header mismatch"),
              { status: 400 },
            );
          }
          await result.body?.cancel();
          return Response.json(failure, {
            status: failure.error?.code === -32601 ? 404 : 200,
          });
        },
      },
      {
        maxRequestBodySize: MAXIMUM_HTTP_REQUEST_BYTES,
      },
    )(
      {
        method: request.method ?? "POST",
        url: request.url ?? ENDPOINT,
        headers: request.headers,
        ...(authInfo && { auth: authInfo }),
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
            {
              ...(statusCode === 405 && { allow: "POST" }),
              ...headers,
              "cache-control": "no-store",
            },
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
      // SDKのNode接続が不要な本文を取り込まないよう、HTTP受付だけなら読取り済み値を示す。
      validated ? { jsonrpc: "2.0", ...validated } : null,
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
  access: McpOAuthHttpAccess,
  options: Omit<McpAuthenticatedHttpOptions, "port"> &
    Readonly<{
      resourceMetadataUrl?: URL;
      requiredScopes?: readonly string[];
    }>,
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
          // Fetch Requestではこのメソッドを表現できず、SDKに渡すと405ではなく500になる。
          if (["CONNECT", "TRACE", "TRACK"].includes(request.method ?? "")) {
            response.setHeader("allow", "POST");
            respondJson(
              response,
              405,
              protocolError(null, -32600, "Method not allowed"),
            );
            return;
          }
          await handleSdkHttpRequest(
            request,
            response,
            undefined,
            null,
            signal,
          );
          return;
        }
        const authorization = request.headers.authorization;
        let authInfo: AuthInfo | undefined;
        const rejectBearer = async (error: unknown) => {
          const rejected = bearerAuthChallengeResponse(error, {
            ...(metadata && { resourceMetadataUrl: metadata }),
            ...(options.requiredScopes && {
              requiredScopes: [...options.requiredScopes],
            }),
          });
          const body = await rejected.text();
          if (signal.aborted || response.destroyed) return;
          response.writeHead(rejected.status, {
            ...Object.fromEntries(rejected.headers),
            "cache-control": "no-store",
          });
          response.end(body);
        };
        try {
          if ((request.headersDistinct.authorization?.length ?? 0) > 1)
            throw new OAuthError(
              OAuthErrorCode.InvalidToken,
              "Invalid Authorization header",
            );
          authInfo = await access.authenticate(authorization, signal);
          if (signal.aborted || response.destroyed) return;
          if (!access.admit(authInfo))
            throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid token");
        } catch (error) {
          await rejectBearer(error);
          return;
        }
        if (!isJsonContentType(request.headers["content-type"])) {
          await handleSdkHttpRequest(
            request,
            response,
            undefined,
            null,
            signal,
            authInfo,
          );
          return;
        }
        if (!acceptsRequiredRepresentations(request.headers)) {
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
        await handleSdkHttpRequest(
          request,
          response,
          body,
          access.factory,
          signal,
          authInfo,
        );
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
