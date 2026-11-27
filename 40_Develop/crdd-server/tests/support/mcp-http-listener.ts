/** 合成資格を使う統合試験専用のローカルListener。製品の起動入口ではない。 */
import http, { type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { createMcpHttpRequestHandler } from "../../src/transport/mcp-http.ts";
import type {
  McpAuthenticatedHttpOptions,
  McpAuthenticatedRequestHandlerResolver,
} from "../../src/transport/mcp-types.ts";

const ENDPOINT = "/mcp";
const MCP_COORDINATOR_STREAMABLE_HTTP_CONTRACT =
  "crdd-mcp/streamable-http-transport/v1" as const;

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
type McpHttpServerCloseBoundary = Readonly<{
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
type McpProcessSignalSource = Readonly<{
  on(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  removeListener(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
}>;

/**
 * 既存の単独MCP起動でListenerとSocketを所有する。
 * @responsibility 共通のMCP要求処理を単独loopback Listenerで運用し、全要求をjoinする。
 * @trace ARCH-000012
 * @boundary MCP単独のHTTP接続とProcess内要求処理。
 */
async function startMcpStreamableHttpWithHandler(
  resolveHandler: McpAuthenticatedRequestHandlerResolver,
  options: McpAuthenticatedHttpOptions,
) {
  const { handle } = createMcpHttpRequestHandler(resolveHandler, options);
  if (
    !Number.isInteger(options.port) ||
    options.port < 0 ||
    options.port > 65_535
  )
    throw new Error("mcp_http_configuration_invalid");
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
    const abortOnDisconnect = () => {
      if (!response.writableFinished) controller.abort();
    };
    response.once("close", abortOnDisconnect);
    const operation = handle(request, response, controller.signal).finally(
      () => {
        response.removeListener("close", abortOnDisconnect);
        requests.delete(request);
        controllers.delete(controller);
      },
    );
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
    throw new Error("mcp_http_address_unavailable");
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
        throw new Error("mcp_http_cleanup_unconfirmed");
      return Object.freeze({
        status: "completed" as const,
        cleanupConfirmed: true as const,
      });
    })();
    return closePromise;
  };
  return Object.freeze({
    contract: MCP_COORDINATOR_STREAMABLE_HTTP_CONTRACT,
    host: "127.0.0.1" as const,
    port: address.port,
    endpoint: ENDPOINT,
    close,
  });
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
 * 単独MCP HTTPの起動側で、終了が確定するまで二つのProcess Signalを保持する。
 * @responsibility 最初の通知でHTTPのcloseを一回だけ実行し、確定後に登録を解除する。
 * @trace ARCH-000012
 * @input server: McpHttpServerCloseBoundary、signalSource: McpProcessSignalSource
 * @returns closeMcpHttpOnProcessSignalの計算結果を返す。
 * @precondition 「server: McpHttpServerCloseBoundary、signalSource: McpProcessSignalSource」がcloseMcpHttpOnProcessSignalの入力契約を満たす。
 * @postcondition closeMcpHttpOnProcessSignalの責務を完了した結果だけを返す。
 * @effect Signal listenerを一時登録し、通知でListenerのcloseを発行する。
 * @failure close失敗を呼出し元へ渡し、登録済みSignalは成功・失敗とも解除する。
 * @invariant 再通知を終了成功に読み替えず、closeを再発行しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: closeMcpHttpOnProcessSignalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency closeMcpHttpOnProcessSignalは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function closeMcpHttpOnProcessSignal(
  server: McpHttpServerCloseBoundary,
  signalSource: McpProcessSignalSource = process,
) {
  let requestStop: (() => void) | null = null;
  let isStopRequested = false;
  const stopRequested = new Promise<void>((resolve) => {
    requestStop = () => {
      if (isStopRequested) return;
      isStopRequested = true;
      resolve();
    };
  });
  const stop = () => requestStop?.();
  let isSigintOwned = false;
  let isSigtermOwned = false;
  try {
    signalSource.on("SIGINT", stop);
    isSigintOwned = true;
    signalSource.on("SIGTERM", stop);
    isSigtermOwned = true;
    await stopRequested;
    return await server.close();
  } finally {
    if (isSigintOwned) signalSource.removeListener("SIGINT", stop);
    if (isSigtermOwned) signalSource.removeListener("SIGTERM", stop);
  }
}
