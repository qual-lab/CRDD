/**
 * stdio-transportに属する責務をまとめる。
 *
 * @responsibility writeを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000012
 */
import { PassThrough, Writable, type Readable } from "node:stream";
import {
  serveStdio,
  StdioServerTransport,
} from "@modelcontextprotocol/server/stdio";
import { ProtocolError } from "@modelcontextprotocol/server";
import {
  createMcpRequestServer,
  createMcpServerFactory,
} from "../request/server.ts";

import type { McpCoordinatorDependencies } from "../tools/task.ts";
import {
  protocolError,
  inspectProtocolRequest,
  inspectMcpEnvelope,
  type McpResponse,
} from "../request/validation.ts";
import { parseUnambiguousJsonDocument } from "../request/parse-json.ts";
import type { McpRequestSource } from "./types.ts";

export const MCP_COORDINATOR_STDIO_CONTRACT =
  "crdd-mcp/stdio-transport/v1" as const;
const MAXIMUM_REQUEST_BYTES = 128 * 1024;

/**
 * SDKが生成した応答byteを外部Writableへ書き込む。
 *
 * @responsibility stdio-transportの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000012
 * @input output: Writable、value: SDKの応答文字列。
 * @returns 外部出力callbackが成功した場合だけtrue。
 * @precondition valueは送信する一つのJSON-lines frameである。
 * @postcondition 外部出力callbackの完了まで待つ。
 * @effect 指定した外部Writableへbyteを書き込む。
 * @failure 出力callbackのerrorはfalse、同期例外は呼出し側へ伝播する。
 * @invariant 外部Streamをend・destroyしない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: writeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function write(output: Writable, value: string) {
  return new Promise<boolean>((resolve) => {
    output.write(value, "utf8", (error) =>
      resolve(error === null || error === undefined),
    );
  });
}

/**
 * 検査済みの一要求を公式stdioへ接続し、SDKの応答byteを受け取る。
 * @responsibility SDKの規格選択・dispatch・framingを既存の有界逐次入口へ接続する。
 * @trace ARCH-000012
 * @input 元要求、意味Handler、親取消、意味結果の観測、取消通知の受付接続。
 * @returns SDKが生成した応答byte。Protocol取消で応答しない場合はnull。
 * @precondition raw本文のbyte上限と重複keyは外側で検査済み。
 * @postcondition 開始済みHandlerをjoinし、内部StreamとSDKを回収する。
 * @effect Handlerとメモリ内SDK Streamだけを使用する。
 * @failure 同期例外は非開示Internal error、SDK入出力失敗は呼出し側へ返す。
 * @invariant 外部EOFをSDKへ即転送せず、従来の取消結果と出力完了を維持する。
 * @boundary 外部stdio入口とSDK所有の内部Transport。
 * @security 初回discoverの確認保存はSDK自動応答より先に実行する。
 * @concurrency 一要求だけを搬送し、取消通知だけを待機列から分離する。
 */
async function dispatchMcpStdioRequest(
  rawRequest: unknown,
  handler: McpRequestSource,
  signal: AbortSignal,
  observe: (result: McpResponse) => void,
  connectCancellation: (
    cancel: ((notification: unknown) => void) | null,
  ) => void,
): Promise<string | null> {
  const request = inspectProtocolRequest(rawRequest);
  if (!request)
    return `${JSON.stringify(protocolError(null, -32600, "Invalid Request"))}\n`;
  if (!["server/discover", "tools/list", "tools/call"].includes(request.method))
    return `${JSON.stringify(protocolError(request.id, -32601, "Method not found"))}\n`;
  const input = new PassThrough();
  let settle!: (bytes: string | null) => void;
  let fail!: (error: Error) => void;
  const response = new Promise<string | null>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  let pending: Promise<McpResponse> | null = null;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      callback();
      settle(String(chunk));
    },
  });
  let server: Awaited<ReturnType<typeof createMcpRequestServer>>;
  try {
    server = await createMcpRequestServer(
      handler,
      rawRequest,
      signal,
      (operation, sdkSignal) => {
        pending = operation;
        void operation.then(
          (result) => {
            observe(result);
            if (sdkSignal.aborted) settle(null);
          },
          () => {
            if (sdkSignal.aborted) settle(null);
          },
        );
      },
    );
  } catch (error) {
    input.destroy();
    output.destroy();
    const failure =
      error instanceof ProtocolError
        ? protocolError(request.id, error.code, error.message)
        : protocolError(request.id, -32603, "Internal error");
    return `${JSON.stringify(failure)}\n`;
  }
  const sdk = serveStdio(() => server, {
    legacy: "reject",
    transport: new StdioServerTransport(input, output, {
      maxBufferSize: MAXIMUM_REQUEST_BYTES,
    }),
    onerror: () => fail(new Error("mcp_stdio_sdk_failed")),
  });
  try {
    input.write(`${JSON.stringify(rawRequest)}\n`);
    connectCancellation((notification) =>
      input.write(`${JSON.stringify(notification)}\n`),
    );
    return await response;
  } finally {
    connectCancellation(null);
    if (pending !== null) await Promise.allSettled([pending]);
    await sdk.close();
    input.destroy();
    output.destroy();
    output.removeAllListeners();
  }
}

/**
 * 有界な外部stdioを逐次処理し、要求別SDKとOwner終了を収束させる。
 *
 * @responsibility 入力待機量、要求順序、取消・出力完了・意味cleanup結果を所有する。
 * @trace ARCH-000012
 * @input handler: McpRequestSource、input: Readable、output: Writable。
 * @returns Transport終了と観測した意味cleanup・回復要求の結果。
 * @precondition 指定Sourceが認証済みの専門Ownerへ接続されている。
 * @postcondition 開始済みOwnerをjoinし、自分のStream Listenerと内部SDKを回収する。
 * @effect 外部stdio読取り・出力、要求別SDK接続とOwnerの既存Effect。
 * @failure 容量超過・不完全末尾・入出力故障はblocked。意味cleanup不明は保持する。
 * @invariant 待機入力は128KiB以内で逐次処理し、外部Stream自体を破棄しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security 元入力の閉検査とSourceの認可を維持し、取消を別IDへ流用しない。
 * @concurrency EOF・出力故障・通知取消を開始済みOwnerへ伝播し、出力callback完了後に次要求へ進む。
 */
async function runMcpStdioWithHandler(
  handler: McpRequestSource,
  input: Readable,
  output: Writable,
) {
  const controller = new AbortController();
  let pending = "";
  const lines: string[] = [];
  let queuedBytes = 0;
  let isInputClosed = false;
  let didInputError = false;
  let didOutputError = false;
  let isFailed = false;
  let isSemanticResultObserved = false;
  let semanticCleanupConfirmed = true;
  let semanticManualRecoveryRequired = false;
  let activeId: string | number | null = null;
  let cancelActive: ((notification: unknown) => void) | null = null;
  let pendingCancellation: unknown | null = null;
  let wake: (() => void) | null = null;
  const notify = () => {
    wake?.();
    wake = null;
  };
  const closeForParentLoss = () => {
    if (isInputClosed) return;
    isInputClosed = true;
    controller.abort();
    notify();
  };
  const failInput = () => {
    didInputError = true;
    closeForParentLoss();
  };
  const failOutput = () => {
    didOutputError = true;
    isFailed = true;
    controller.abort();
    notify();
  };
  const receive = (rawChunk: string | Buffer) => {
    if (isInputClosed || isFailed) return;
    pending += String(rawChunk);
    for (;;) {
      const newline = pending.indexOf("\n");
      if (newline < 0) break;
      const line = pending.slice(0, newline).replace(/\r$/u, "");
      pending = pending.slice(newline + 1);
      if (line.length === 0) continue;
      if (Buffer.byteLength(line, "utf8") > MAXIMUM_REQUEST_BYTES) {
        isFailed = true;
        controller.abort();
        input.pause();
        notify();
        return;
      }
      const notification = parseUnambiguousJsonDocument(line);
      if (
        notification &&
        typeof notification === "object" &&
        "method" in notification &&
        notification.method === "notifications/cancelled" &&
        "jsonrpc" in notification &&
        notification.jsonrpc === "2.0" &&
        !Object.hasOwn(notification, "id") &&
        "params" in notification &&
        notification.params &&
        typeof notification.params === "object" &&
        "requestId" in notification.params &&
        Object.keys(notification).every((key) =>
          ["jsonrpc", "method", "params"].includes(key),
        ) &&
        Object.keys(notification.params).every((key) =>
          ["requestId", "reason", "_meta"].includes(key),
        ) &&
        (!Object.hasOwn(notification.params, "_meta") ||
          ("_meta" in notification.params &&
            inspectMcpEnvelope(notification.params._meta))) &&
        (!Object.hasOwn(notification.params, "reason") ||
          ("reason" in notification.params &&
            typeof notification.params.reason === "string"))
      ) {
        if (activeId !== null && notification.params.requestId === activeId) {
          if (cancelActive) cancelActive(notification);
          else pendingCancellation = notification;
        }
        continue;
      }
      queuedBytes += Buffer.byteLength(line, "utf8");
      lines.push(line);
    }
    if (
      Buffer.byteLength(pending, "utf8") + queuedBytes >
      MAXIMUM_REQUEST_BYTES
    ) {
      isFailed = true;
      controller.abort();
      input.pause();
    }
    notify();
  };
  const waitForInput = () =>
    new Promise<void>((resolve) => {
      wake = resolve;
      if (lines.length > 0 || isInputClosed || isFailed) notify();
    });
  try {
    input.setEncoding("utf8");
    input.on("data", receive);
    input.once("end", closeForParentLoss);
    input.once("error", failInput);
    input.once("close", closeForParentLoss);
    input.resume();
    output.on("error", failOutput);
    output.once("close", failOutput);
    while (!isFailed && (lines.length > 0 || !isInputClosed)) {
      if (lines.length === 0) {
        await waitForInput();
        continue;
      }
      const line = lines.shift();
      if (line === undefined) continue;
      queuedBytes -= Buffer.byteLength(line, "utf8");
      const request = parseUnambiguousJsonDocument(line);
      const observe = (response: McpResponse) => {
        if ("result" in response && response.result) {
          const result = response.result as Readonly<{
            structuredContent?: Readonly<{
              cleanupConfirmed?: unknown;
              manualRecoveryRequired?: unknown;
            }>;
          }>;
          const semantic = result.structuredContent;
          if (
            semantic &&
            typeof semantic.cleanupConfirmed === "boolean" &&
            typeof semantic.manualRecoveryRequired === "boolean"
          ) {
            isSemanticResultObserved = true;
            semanticCleanupConfirmed &&= semantic.cleanupConfirmed;
            semanticManualRecoveryRequired ||= semantic.manualRecoveryRequired;
          }
        }
      };
      activeId = inspectProtocolRequest(request)?.id ?? null;
      const bytes = request
        ? await dispatchMcpStdioRequest(
            request,
            handler,
            controller.signal,
            observe,
            (cancel) => {
              cancelActive = cancel;
              if (cancel && pendingCancellation !== null) {
                cancel(pendingCancellation);
                pendingCancellation = null;
              }
            },
          )
        : `${JSON.stringify(protocolError(null, -32700, "Parse error"))}\n`;
      activeId = null;
      pendingCancellation = null;
      if (bytes !== null && (didOutputError || !(await write(output, bytes))))
        isFailed = true;
    }
    if (pending.trim().length > 0 || didInputError) isFailed = true;
  } catch {
    isFailed = true;
  } finally {
    controller.abort();
    if (isFailed) await new Promise<void>((resolve) => setImmediate(resolve));
    input.removeListener("data", receive);
    input.removeListener("end", closeForParentLoss);
    input.removeListener("error", failInput);
    input.removeListener("close", closeForParentLoss);
    output.removeListener("error", failOutput);
    output.removeListener("close", failOutput);
  }
  return Object.freeze({
    contract: MCP_COORDINATOR_STDIO_CONTRACT,
    status: isFailed ? ("blocked" as const) : ("completed" as const),
    reason: isFailed
      ? "orchestrator_mcp_stdio_failed"
      : "orchestrator_mcp_stdio_closed",
    transportCleanupConfirmed: true,
    semanticResultObserved: isSemanticResultObserved,
    semanticCleanupConfirmed,
    cleanupConfirmed: semanticCleanupConfirmed,
    manualRecoveryRequired: semanticManualRecoveryRequired,
  });
}

/**
 * Application Handlerを使用してMCP stdioを実行する。
 *
 * @responsibility stdio Lifecycleを特定のMCP Capabilityから分離して実行する。
 * @trace ARCH-000012
 * @input handler、inputおよびoutputを受け取る。
 * @returns Transportの終了結果を返す。
 * @precondition handlerは一Requestを一応答へ収束させる。
 * @postcondition EOFまたは失敗時に進行中Requestを取消してListenerを除去する。
 * @effect stdioを読取り、応答を書き込む。
 * @failure Parse、入出力またはHandler失敗をblockedへ閉じる。
 * @invariant TransportはTool固有の意味処理を持たない。
 * @boundary stdioとMCP Application Handlerの境界。
 * @security stdioのProcess所有者が接続Authorityを所有する。
 * @concurrency 一つの入力Queueを順序保持して処理する。
 */
export async function runMcpStdio(
  handler: McpRequestSource,
  input: Readable,
  output: Writable,
) {
  return runMcpStdioWithHandler(handler, input, output);
}

/**
 * Coordinator互換入口でMCP stdioを実行する。
 *
 * @responsibility 既存利用側をCoordinator Adapterへ接続する互換入口を維持する。
 * @trace ARCH-000012
 * @input dependencies、inputおよびoutputを受け取る。
 * @returns Transportの終了結果を返す。
 * @precondition dependenciesはCoordinator公開契約を満たす。
 * @postcondition 全RequestをCoordinator Adapterへだけ渡す。
 * @effect stdioを読取り、応答を書き込む。
 * @failure TransportまたはAdapter失敗をblockedへ閉じる。
 * @invariant 既存公開関数の意味を変更しない。
 * @boundary stdioとCoordinator Adapterの互換境界。
 * @security Coordinator Adapterの認証契約を維持する。
 * @concurrency 一つの入力Queueを順序保持して処理する。
 */
export async function runMcpCoordinatorStdio(
  dependencies: McpCoordinatorDependencies,
  input: Readable,
  output: Writable,
) {
  return runMcpStdioWithHandler(
    createMcpServerFactory({ orchestrator: dependencies }),
    input,
    output,
  );
}

/**
 * Mcp Coordinator Stdio 契約の公開契約を記述する。
 *
 * @responsibility Mcp Coordinator Stdio 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeMcpCoordinatorStdioContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeMcpCoordinatorStdioContractの入力契約を満たす。
 * @postcondition describeMcpCoordinatorStdioContractの責務を完了した結果だけを返す。
 * @effect N/A: describeMcpCoordinatorStdioContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeMcpCoordinatorStdioContractは独自の失敗分岐を所有しない。
 * @invariant describeMcpCoordinatorStdioContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeMcpCoordinatorStdioContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeMcpCoordinatorStdioContractは共有非同期状態を持たない同期処理である。
 */
export function describeMcpCoordinatorStdioContract() {
  return Object.freeze({
    contract: MCP_COORDINATOR_STDIO_CONTRACT,
    framing: "one_bounded_json_rpc_document_per_line",
    requestConcurrency: 1,
    parentLoss: "stdin_eof_cancels_and_joins_active_request",
    transportAuthority: "none",
  });
}
