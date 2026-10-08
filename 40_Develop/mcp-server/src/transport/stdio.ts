/**
 * stdio-transportに属する責務をまとめる。
 *
 * @responsibility writeを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000012
 */
import type { Readable, Writable } from "node:stream";

import {
  handleMcpOrchestratorRequest,
  type McpOrchestratorDependencies,
} from "../orchestrator/adapter.ts";
import { protocolError } from "../orchestrator/protocol.ts";
import { parseUnambiguousJsonDocument } from "../request/parse-json.ts";
import type { McpRequestHandler } from "./types.ts";

export const MCP_ORCHESTRATOR_STDIO_CONTRACT =
  "crdd-mcp/stdio-transport/v1" as const;
const MAXIMUM_REQUEST_BYTES = 128 * 1024;

/**
 * stdio-transportを書き込む。
 *
 * @responsibility stdio-transportの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000012
 * @input output: Writable、value: unknown
 * @returns writeの計算結果を返す。
 * @precondition 「output: Writable、value: unknown」がwriteの入力契約を満たす。
 * @postcondition writeの責務を完了した結果だけを返す。
 * @effect N/A: writeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeは独自の失敗分岐を所有しない。
 * @invariant writeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: writeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency writeは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function write(output: Writable, value: unknown) {
  return new Promise<boolean>((resolve) => {
    const bytes = `${JSON.stringify(value)}\n`;
    output.write(bytes, "utf8", (error) =>
      resolve(error === null || error === undefined),
    );
  });
}

/**
 * Bounded JSON-lines MCP transport. EOF means parent loss: the active request
 *
 * @responsibility Mcp Orchestrator Stdioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000012
 * @input dependencies: McpOrchestratorDependencies、input: Readable、output: Writable
 * @returns runMcpOrchestratorStdioの計算結果を返す。
 * @precondition 「dependencies: McpOrchestratorDependencies、input: Readable、output: Writable」がrunMcpOrchestratorStdioの入力契約を満たす。
 * @postcondition runMcpOrchestratorStdioの責務を完了した結果だけを返す。
 * @effect N/A: runMcpOrchestratorStdioは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runMcpOrchestratorStdioは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runMcpOrchestratorStdioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runMcpOrchestratorStdioはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runMcpOrchestratorStdioは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runMcpStdioWithHandler(
  handler: McpRequestHandler,
  input: Readable,
  output: Writable,
) {
  const controller = new AbortController();
  let pending = "";
  const lines: string[] = [];
  let queuedBytes = 0;
  let isInputClosed = false;
  let didInputError = false;
  let isFailed = false;
  let isSemanticResultObserved = false;
  let semanticCleanupConfirmed = true;
  let semanticManualRecoveryRequired = false;
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
  const receive = (rawChunk: string | Buffer) => {
    if (isInputClosed || isFailed) return;
    pending += String(rawChunk);
    for (;;) {
      const newline = pending.indexOf("\n");
      if (newline < 0) break;
      const line = pending.slice(0, newline).replace(/\r$/u, "");
      pending = pending.slice(newline + 1);
      if (line.length === 0) continue;
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
    while (!isFailed && (lines.length > 0 || !isInputClosed)) {
      if (lines.length === 0) {
        await waitForInput();
        continue;
      }
      const line = lines.shift();
      if (line === undefined) continue;
      queuedBytes -= Buffer.byteLength(line, "utf8");
      const request = parseUnambiguousJsonDocument(line);
      const response = request
        ? await handler(request, controller.signal)
        : protocolError(null, -32700, "Parse error");
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
      if (!(await write(output, response))) isFailed = true;
    }
    if (pending.trim().length > 0 || didInputError) isFailed = true;
  } catch {
    isFailed = true;
  } finally {
    controller.abort();
    input.removeListener("data", receive);
    input.removeListener("end", closeForParentLoss);
    input.removeListener("error", failInput);
    input.removeListener("close", closeForParentLoss);
  }
  return Object.freeze({
    contract: MCP_ORCHESTRATOR_STDIO_CONTRACT,
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
  handler: McpRequestHandler,
  input: Readable,
  output: Writable,
) {
  return runMcpStdioWithHandler(handler, input, output);
}

/**
 * Orchestrator互換入口でMCP stdioを実行する。
 *
 * @responsibility 既存利用側をOrchestrator Adapterへ接続する互換入口を維持する。
 * @trace ARCH-000012
 * @input dependencies、inputおよびoutputを受け取る。
 * @returns Transportの終了結果を返す。
 * @precondition dependenciesはOrchestrator公開契約を満たす。
 * @postcondition 全RequestをOrchestrator Adapterへだけ渡す。
 * @effect stdioを読取り、応答を書き込む。
 * @failure TransportまたはAdapter失敗をblockedへ閉じる。
 * @invariant 既存公開関数の意味を変更しない。
 * @boundary stdioとOrchestrator Adapterの互換境界。
 * @security Orchestrator Adapterの認証契約を維持する。
 * @concurrency 一つの入力Queueを順序保持して処理する。
 */
export async function runMcpOrchestratorStdio(
  dependencies: McpOrchestratorDependencies,
  input: Readable,
  output: Writable,
) {
  return runMcpStdioWithHandler(
    (request, signal) =>
      handleMcpOrchestratorRequest(request, dependencies, signal),
    input,
    output,
  );
}

/**
 * Mcp Orchestrator Stdio 契約の公開契約を記述する。
 *
 * @responsibility Mcp Orchestrator Stdio 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeMcpOrchestratorStdioContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeMcpOrchestratorStdioContractの入力契約を満たす。
 * @postcondition describeMcpOrchestratorStdioContractの責務を完了した結果だけを返す。
 * @effect N/A: describeMcpOrchestratorStdioContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeMcpOrchestratorStdioContractは独自の失敗分岐を所有しない。
 * @invariant describeMcpOrchestratorStdioContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeMcpOrchestratorStdioContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeMcpOrchestratorStdioContractは共有非同期状態を持たない同期処理である。
 */
export function describeMcpOrchestratorStdioContract() {
  return Object.freeze({
    contract: MCP_ORCHESTRATOR_STDIO_CONTRACT,
    framing: "one_bounded_json_rpc_document_per_line",
    requestConcurrency: 1,
    parentLoss: "stdin_eof_cancels_and_joins_active_request",
    transportAuthority: "none",
  });
}
