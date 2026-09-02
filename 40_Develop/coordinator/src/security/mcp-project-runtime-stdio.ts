import type { Readable, Writable } from "node:stream";

import {
  handleMcpProjectRuntimeRequest,
  type McpProjectRuntimeDependencies,
} from "./mcp-project-runtime-adapter.ts";
import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const MCP_PROJECT_RUNTIME_STDIO_CONTRACT =
  "crdd-coordinator/mcp-project-runtime-stdio/v1" as const;
const MAXIMUM_REQUEST_BYTES = 128 * 1024;

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
 * is cancelled and joined before the process reports a clean shutdown.
 */
export async function runMcpProjectRuntimeStdio(
  dependencies: McpProjectRuntimeDependencies,
  input: Readable,
  output: Writable,
) {
  const controller = new AbortController();
  const abortForParentLoss = () => controller.abort();
  input.once("end", abortForParentLoss);
  input.once("error", abortForParentLoss);
  input.once("close", abortForParentLoss);
  let pending = "";
  let failed = false;
  try {
    input.setEncoding("utf8");
    for await (const rawChunk of input) {
      const chunk = String(rawChunk);
      pending += chunk;
      if (Buffer.byteLength(pending, "utf8") > MAXIMUM_REQUEST_BYTES) {
        failed = true;
        break;
      }
      for (;;) {
        const newline = pending.indexOf("\n");
        if (newline < 0) break;
        const line = pending.slice(0, newline).replace(/\r$/u, "");
        pending = pending.slice(newline + 1);
        if (line.length === 0) continue;
        const request = parseUnambiguousJsonDocument(line);
        const response = request
          ? await handleMcpProjectRuntimeRequest(
              request,
              dependencies,
              controller.signal,
            )
          : Object.freeze({
              jsonrpc: "2.0",
              id: null,
              error: Object.freeze({ code: -32700, message: "Parse error" }),
            });
        if (!(await write(output, response))) {
          failed = true;
          break;
        }
      }
      if (failed) break;
    }
    if (pending.trim().length > 0) failed = true;
  } catch {
    failed = true;
  } finally {
    controller.abort();
    input.removeListener("end", abortForParentLoss);
    input.removeListener("error", abortForParentLoss);
    input.removeListener("close", abortForParentLoss);
  }
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_STDIO_CONTRACT,
    status: failed ? ("blocked" as const) : ("completed" as const),
    reason: failed
      ? "project_runtime_mcp_stdio_failed"
      : "project_runtime_mcp_stdio_closed",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
}

export function describeMcpProjectRuntimeStdioContract() {
  return Object.freeze({
    contract: MCP_PROJECT_RUNTIME_STDIO_CONTRACT,
    framing: "one_bounded_json_rpc_document_per_line",
    requestConcurrency: 1,
    parentLoss: "stdin_eof_cancels_and_joins_active_request",
    transportAuthority: "none",
  });
}
