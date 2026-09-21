/**
 * stdio-transportに属する責務をまとめる。
 *
 * @responsibility writeを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000012
 */
import type { Readable, Writable } from "node:stream";

import {
  handleMcpProjectRuntimeRequest,
  type McpProjectRuntimeDependencies,
} from "../adapters/project-runtime-adapter.ts";
import { protocolError } from "../protocol/project-runtime-protocol.ts";
import { parseUnambiguousJsonDocument } from "../protocol/unambiguous-json-document.ts";

export const MCP_PROJECT_RUNTIME_STDIO_CONTRACT =
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
 * @responsibility Mcp Project Runtime Stdioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000012
 * @input dependencies: McpProjectRuntimeDependencies、input: Readable、output: Writable
 * @returns runMcpProjectRuntimeStdioの計算結果を返す。
 * @precondition 「dependencies: McpProjectRuntimeDependencies、input: Readable、output: Writable」がrunMcpProjectRuntimeStdioの入力契約を満たす。
 * @postcondition runMcpProjectRuntimeStdioの責務を完了した結果だけを返す。
 * @effect N/A: runMcpProjectRuntimeStdioは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runMcpProjectRuntimeStdioは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runMcpProjectRuntimeStdioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: runMcpProjectRuntimeStdioはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runMcpProjectRuntimeStdioは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runMcpProjectRuntimeStdio(
  dependencies: McpProjectRuntimeDependencies,
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
        ? await handleMcpProjectRuntimeRequest(
            request,
            dependencies,
            controller.signal,
          )
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
    contract: MCP_PROJECT_RUNTIME_STDIO_CONTRACT,
    status: isFailed ? ("blocked" as const) : ("completed" as const),
    reason: isFailed
      ? "project_runtime_mcp_stdio_failed"
      : "project_runtime_mcp_stdio_closed",
    transportCleanupConfirmed: true,
    semanticResultObserved: isSemanticResultObserved,
    semanticCleanupConfirmed,
    cleanupConfirmed: semanticCleanupConfirmed,
    manualRecoveryRequired: semanticManualRecoveryRequired,
  });
}

/**
 * Mcp Project Runtime Stdio 契約の公開契約を記述する。
 *
 * @responsibility Mcp Project Runtime Stdio 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeMcpProjectRuntimeStdioContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeMcpProjectRuntimeStdioContractの入力契約を満たす。
 * @postcondition describeMcpProjectRuntimeStdioContractの責務を完了した結果だけを返す。
 * @effect N/A: describeMcpProjectRuntimeStdioContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeMcpProjectRuntimeStdioContractは独自の失敗分岐を所有しない。
 * @invariant describeMcpProjectRuntimeStdioContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeMcpProjectRuntimeStdioContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeMcpProjectRuntimeStdioContractは共有非同期状態を持たない同期処理である。
 */
export function describeMcpProjectRuntimeStdioContract() {
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_STDIO_CONTRACT,
    framing: "one_bounded_json_rpc_document_per_line",
    requestConcurrency: 1,
    parentLoss: "stdin_eof_cancels_and_joins_active_request",
    transportAuthority: "none",
  });
}
