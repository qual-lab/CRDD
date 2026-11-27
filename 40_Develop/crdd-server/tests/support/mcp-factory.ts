/**
 * 通信の故障注入を行う統合試験だけで、合成の要求処理をSDKへ接続する。
 * @responsibility 合成の例外・取消・遅延完了を、要求別のFactoryから既存Transportへ搬送する。
 * @trace ARCH-000012
 */
import {
  type CallToolResult,
  type ListToolsResult,
  ProtocolError,
  Server,
} from "@modelcontextprotocol/server";
import type { Readable, Writable } from "node:stream";
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
} from "../../src/transport/mcp-protocol.ts";
import { runMcpStdio } from "../../src/transport/mcp-stdio.ts";
import type {
  McpResponse,
  McpServerFactory,
} from "../../src/transport/mcp-types.ts";

type SyntheticMcpHandler = (
  raw: unknown,
  signal: AbortSignal,
) => Promise<McpResponse>;
export type McpFixtureSource = McpServerFactory | SyntheticMcpHandler;

/** 合成ハンドラーを、本番にも渡される要求別Factoryの形にする。 */
export function asMcpFixtureFactory(
  source: McpFixtureSource,
): McpServerFactory {
  if (typeof source !== "function") return source;
  return {
    async createServer(request, signal, observe) {
      const rawRequest = { jsonrpc: "2.0", ...request };
      if (request.method === "server/discover") {
        const result = await source(rawRequest, signal);
        if (result.error)
          throw new ProtocolError(result.error.code, result.error.message);
      }
      const server = new Server(
        { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        {
          capabilities: { tools: {} },
          cacheHints: {
            "server/discover": { ttlMs: 0, cacheScope: "private" },
          },
        },
      );
      const invoke = async (sdkSignal: AbortSignal) => {
        const pending = Promise.resolve().then(() =>
          source(rawRequest, AbortSignal.any([signal, sdkSignal])),
        );
        observe?.(pending, sdkSignal);
        let result: McpResponse;
        try {
          result = await pending;
        } catch {
          throw new ProtocolError(-32603, "Internal error");
        }
        if (result.error)
          throw new ProtocolError(result.error.code, result.error.message);
        if (!result.result) throw new ProtocolError(-32603, "Internal error");
        return result.result;
      };
      server.setRequestHandler(
        "tools/list",
        async (_request, context) =>
          (await invoke(context.mcpReq.signal)) as ListToolsResult,
      );
      server.setRequestHandler(
        "tools/call",
        async (_request, context) =>
          (await invoke(context.mcpReq.signal)) as CallToolResult,
      );
      return server;
    },
  };
}

/** 合成ハンドラーだけを試験境界で補い、stdio本体を実行する。 */
export function runMcpStdioFixture(
  source: McpFixtureSource,
  input: Readable,
  output: Writable,
  signal?: AbortSignal,
) {
  return runMcpStdio(asMcpFixtureFactory(source), input, output, signal);
}
