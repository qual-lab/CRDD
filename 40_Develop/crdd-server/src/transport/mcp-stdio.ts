/**
 * MCPの標準入出力フレーム、通常要求順と限定した実行制御、親終了時の取消・回収を所有する。
 * @packageDocumentation
 * @trace ARCH-000012
 */
import { PassThrough, type Readable, Writable } from "node:stream";
import { UnsupportedProtocolVersionError } from "@modelcontextprotocol/server";
import {
  StdioServerTransport,
  serveStdio,
} from "@modelcontextprotocol/server/stdio";
import {
  finishMcpSdkRequest,
  acceptMcpRequest,
  inspectMcpEnvelope,
  inspectProtocolRequest,
  isMcpPublicRequest,
  mcpSdkFailure,
  protocolError,
  readMcpProtocolVersion,
  readRequestRecord,
  createUnsupportedProtocolVersionResponse,
} from "./mcp-protocol.ts";
import {
  type McpProtocolRequest,
  type McpResponse,
  type McpServerFactory,
  objectiveRunTools,
} from "./mcp-types.ts";
import { parseUnambiguousJsonDocument } from "./parse-json.ts";

const MCP_COORDINATOR_STDIO_CONTRACT = "crdd-mcp/stdio-transport/v1" as const;
const MAXIMUM_STDIO_REQUEST_BYTES = 128 * 1024;

type StdioFrame = Readonly<{
  raw: ReturnType<typeof parseUnambiguousJsonDocument>;
  request: McpProtocolRequest | null;
  size: number;
  id: string | number | null;
  protocolVersion: string | undefined;
  runsObjective: boolean;
  controlsObjective: boolean;
}>;

type ActiveFrame = {
  frame: StdioFrame;
  cancel: ((notification: unknown) => void) | null;
  pendingCancellation: unknown;
};

function inspectStdioFrame(raw: StdioFrame["raw"], size: number): StdioFrame {
  const request = inspectProtocolRequest(raw);
  const params = request?.params;
  const tool =
    request?.method === "tools/call" &&
    params &&
    typeof params === "object" &&
    "name" in params
      ? params.name
      : undefined;
  return {
    raw,
    request,
    size,
    id: request?.id ?? null,
    protocolVersion: readMcpProtocolVersion(params),
    runsObjective:
      tool === objectiveRunTools.start || tool === objectiveRunTools.resume,
    controlsObjective:
      tool === objectiveRunTools.state || tool === objectiveRunTools.cancel,
  };
}

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
function writeStdioFrame(output: Writable, value: string) {
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
 * @security SDK自動応答より前に入力と許可されたメソッドを確認する。
 * @concurrency 一要求だけを搬送し、取消通知だけを待機列から分離する。
 */
async function dispatchMcpStdioRequest(
  frame: StdioFrame,
  handler: McpServerFactory,
  signal: AbortSignal,
  observe: (result: McpResponse) => void,
  connectCancellation: (
    cancel: ((notification: unknown) => void) | null,
  ) => void,
): Promise<string | null> {
  const { request } = frame;
  if (!request)
    return `${JSON.stringify(protocolError(null, -32600, "Invalid Request"))}\n`;
  if (!isMcpPublicRequest(request))
    return `${JSON.stringify(protocolError(request.id, -32601, "Method not found"))}\n`;
  if (frame.protocolVersion === undefined)
    return `${JSON.stringify(protocolError(request.id, -32602, "Invalid params"))}\n`;
  const input = new PassThrough();
  let settle!: (bytes: string | null) => void;
  let fail!: (error: Error) => void;
  const response = new Promise<string | null>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  let pending: Promise<McpResponse> | null = null;
  let didCreateServer = false;
  let factoryFailure: McpResponse | undefined;
  let versionRejection: ReturnType<
    typeof createUnsupportedProtocolVersionResponse
  > = null;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      callback();
      const bytes = String(chunk);
      let response = factoryFailure ?? versionRejection;
      if (!response && !didCreateServer) {
        const rejected = readRequestRecord(parseUnambiguousJsonDocument(bytes));
        if (readRequestRecord(rejected?.error)?.code === -32602)
          response = protocolError(request.id, -32602, "Invalid params");
      }
      settle(response ? `${JSON.stringify(response)}\n` : bytes);
    },
  });
  const sdk = serveStdio(
    async () => {
      didCreateServer = true;
      try {
        return await handler.createServer(
          acceptMcpRequest(request),
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
        factoryFailure = mcpSdkFailure(request.id, error);
        throw error;
      }
    },
    {
      legacy: "reject",
      transport: new StdioServerTransport(input, output, {
        maxBufferSize: MAXIMUM_STDIO_REQUEST_BYTES,
      }),
      onerror: (error) => {
        // この診断の直後にSDKが正式な版違い応答を書く。通信の故障として扱わない。
        if (error instanceof UnsupportedProtocolVersionError) {
          versionRejection = createUnsupportedProtocolVersionResponse({
            id: request.id,
            error,
          });
        } else fail(new Error("mcp_stdio_sdk_failed"));
      },
    },
  );
  try {
    input.write(`${JSON.stringify({ jsonrpc: "2.0", ...request })}\n`);
    connectCancellation((notification) =>
      input.write(`${JSON.stringify(notification)}\n`),
    );
    return await response;
  } finally {
    connectCancellation(null);
    await finishMcpSdkRequest(pending, () => sdk.close());
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
 * @input handler: McpServerFactory、input: Readable、output: Writable。
 * @returns Transport終了と観測した意味cleanup・回復要求の結果。
 * @precondition 指定Sourceが認証済みの専門Ownerへ接続されている。
 * @postcondition 開始済みOwnerをjoinし、自分のStream Listenerと内部SDKを回収する。
 * @effect 外部stdio読取り・出力、要求別SDK接続とOwnerの既存Effect。
 * @failure 容量超過・不完全末尾・入出力故障はblocked。意味cleanup不明は保持する。
 * @invariant 待機入力128KiB、通常要求1件、Objectiveの照会／取消1件。外部Streamは破棄しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security 元入力の閉検査とSourceの認可を維持し、取消を別IDへ流用しない。
 * @concurrency EOF・出力故障・通知取消を開始済みOwnerへ伝播し、出力callback完了後に次要求へ進む。
 */
async function runMcpStdioWithHandler(
  handler: McpServerFactory,
  input: Readable,
  output: Writable,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  let pending = "";
  const lines: StdioFrame[] = [];
  const outstanding = new Set<string | number>();
  let queuedBytes = 0;
  let isInputClosed = false;
  let didInputError = false;
  let didOutputError = false;
  let isFailed = false;
  let isSemanticResultObserved = false;
  let semanticCleanupConfirmed = true;
  let semanticManualRecoveryRequired = false;
  let primary: ActiveFrame | null = null;
  let allowControl = false;
  let control: ActiveFrame | null = null;
  let controlCompletion: Promise<void> | null = null;
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
  const dispatch = (active: ActiveFrame) =>
    active.frame.raw
      ? dispatchMcpStdioRequest(
          active.frame,
          handler,
          controller.signal,
          observe,
          (cancel) => {
            active.cancel = cancel;
            if (cancel && active.pendingCancellation !== null) {
              cancel(active.pendingCancellation);
              active.pendingCancellation = null;
            }
          },
        )
      : Promise.resolve(
          `${JSON.stringify(protocolError(null, -32700, "Parse error"))}\n`,
        );
  const send = async (bytes: string | null) => {
    if (
      bytes !== null &&
      (didOutputError || !(await writeStdioFrame(output, bytes)))
    )
      failOutput();
  };
  const pumpControl = () => {
    if (!allowControl || control || isFailed || controller.signal.aborted)
      return;
    const next = lines.findIndex(({ controlsObjective }) => controlsObjective);
    if (next < 0) return;
    const [frame] = lines.splice(next, 1);
    if (!frame) return;
    queuedBytes -= frame.size;
    const active: ActiveFrame = {
      frame,
      cancel: null,
      pendingCancellation: null,
    };
    control = active;
    controlCompletion = dispatch(active)
      .then(send)
      .catch(failOutput)
      .finally(() => {
        if (frame.id !== null) outstanding.delete(frame.id);
        control = null;
        controlCompletion = null;
        pumpControl();
      });
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
      const size = Buffer.byteLength(line, "utf8");
      if (size > MAXIMUM_STDIO_REQUEST_BYTES) {
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
            inspectMcpEnvelope(notification.params._meta, "cancellation"))) &&
        (!Object.hasOwn(notification.params, "reason") ||
          ("reason" in notification.params &&
            typeof notification.params.reason === "string"))
      ) {
        const id = notification.params.requestId;
        if (typeof id === "string" || typeof id === "number") {
          const target =
            primary?.frame.id === id
              ? primary
              : control?.frame.id === id
                ? control
                : null;
          // 新しい版の可否をここで判定せず、通知を同じ要求の宣言と照合する。
          if (
            Object.hasOwn(notification.params, "_meta") &&
            target?.frame.protocolVersion !==
              readMcpProtocolVersion(notification.params)
          )
            continue;
          if (target?.cancel) target.cancel(notification);
          else if (target) target.pendingCancellation = notification;
        }
        continue;
      }
      const frame = inspectStdioFrame(notification, size);
      queuedBytes += size;
      if (
        queuedBytes > MAXIMUM_STDIO_REQUEST_BYTES ||
        (frame.id !== null && outstanding.has(frame.id))
      ) {
        // 応答の書込みが終わる前に同じIDを再割当てしない。
        isFailed = true;
        controller.abort();
        input.pause();
        notify();
        return;
      }
      if (frame.id !== null) outstanding.add(frame.id);
      lines.push(frame);
    }
    if (
      Buffer.byteLength(pending, "utf8") + queuedBytes >
      MAXIMUM_STDIO_REQUEST_BYTES
    ) {
      isFailed = true;
      controller.abort();
      input.pause();
    } else pumpControl();
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
    signal?.addEventListener("abort", closeForParentLoss, { once: true });
    if (signal?.aborted) closeForParentLoss();
    input.resume();
    output.on("error", failOutput);
    output.once("close", failOutput);
    while (!isFailed && (lines.length > 0 || !isInputClosed)) {
      if (lines.length === 0) {
        await waitForInput();
        continue;
      }
      const frame = lines.shift();
      if (!frame) continue;
      queuedBytes -= frame.size;
      primary = { frame, cancel: null, pendingCancellation: null };
      allowControl = frame.runsObjective;
      const operation = dispatch(primary);
      pumpControl();
      const bytes = await operation;
      allowControl = false;
      await controlCompletion;
      await send(bytes);
      if (frame.id !== null) outstanding.delete(frame.id);
      primary = null;
    }
    if (pending.trim().length > 0 || didInputError) isFailed = true;
  } catch {
    isFailed = true;
  } finally {
    controller.abort();
    allowControl = false;
    primary = null;
    await controlCompletion;
    if (isFailed) await new Promise<void>((resolve) => setImmediate(resolve));
    input.removeListener("data", receive);
    input.removeListener("end", closeForParentLoss);
    input.removeListener("error", failInput);
    input.removeListener("close", closeForParentLoss);
    signal?.removeEventListener("abort", closeForParentLoss);
    output.removeListener("error", failOutput);
    output.removeListener("close", failOutput);
  }
  return Object.freeze({
    contract: MCP_COORDINATOR_STDIO_CONTRACT,
    status: isFailed ? ("blocked" as const) : ("completed" as const),
    reason: isFailed ? "mcp_stdio_failed" : "mcp_stdio_closed",
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
  handler: McpServerFactory,
  input: Readable,
  output: Writable,
  signal?: AbortSignal,
) {
  return runMcpStdioWithHandler(handler, input, output, signal);
}
