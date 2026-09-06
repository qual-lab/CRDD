#!/usr/bin/env node

import {
  closeMcpHttpOnProcessSignal,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  runMcpProjectRuntimeStdio,
  startMcpProjectRuntimeStreamableHttp,
  type McpProjectRuntimeDependencies,
} from "../../40_Develop/mcp/src/index.ts";
import {
  isSupportedCoordinatorNodeRuntime,
  observeRuntimeOwnedProjectClientPrincipal,
  runProjectRuntimePublicDecision,
  runProjectRuntimePublicObjective,
  runProjectRuntimePublicStateQuery,
} from "../../40_Develop/coordinator/src/index.ts";

function printHelp() {
  process.stdout.write(
    [
      "CRDD MCP起動入口",
      "",
      "使い方:",
      "  crdd-mcp --stdio",
      "  crdd-mcp --http --port <port>",
      "",
      `MCP Protocol: ${MCP_PROJECT_RUNTIME_PROTOCOL_VERSION}`,
      "HTTPは127.0.0.1だけで待ち受け、CRDD_MCP_HTTP_BEARER_TOKENが必要です。",
      "MCPは外部ClientからProject Runtimeへ接続する入口であり、Coordinatorの子機能ではありません。",
      "",
    ].join("\n"),
  );
}

function dependencies(): McpProjectRuntimeDependencies {
  return {
    authenticateClient: observeRuntimeOwnedProjectClientPrincipal,
    runObjective: (request, signal, authentication) =>
      runProjectRuntimePublicObjective(
        request,
        signal,
        process.cwd(),
        authentication,
      ),
    submitDecision: async (request, authentication) =>
      runProjectRuntimePublicDecision(request, process.cwd(), authentication),
    getProjectState: async (request, authentication) =>
      runProjectRuntimePublicStateQuery(request, process.cwd(), authentication),
  };
}

async function main() {
  if (!isSupportedCoordinatorNodeRuntime(process.versions.node)) {
    process.stderr.write(
      "CRDD MCP requires a preverified Node.js 24.12.0 or newer executable.\n",
    );
    return 2;
  }
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0] ?? "")) {
    printHelp();
    return 0;
  }
  if (args.length === 1 && args[0] === "--stdio") {
    const result = await runMcpProjectRuntimeStdio(
      dependencies(),
      process.stdin,
      process.stdout,
    );
    return result.status === "completed" ? 0 : 2;
  }
  if (args.length !== 3 || args[0] !== "--http" || args[1] !== "--port") {
    process.stderr.write(
      "使い方: crdd-mcp --stdio | crdd-mcp --http --port <port>\n",
    );
    return 64;
  }
  const port = Number(args[2]);
  const bearerToken = process.env.CRDD_MCP_HTTP_BEARER_TOKEN;
  if (!Number.isInteger(port) || !bearerToken) {
    process.stderr.write(
      "HTTPには整数のportとCRDD_MCP_HTTP_BEARER_TOKENが必要です。\n",
    );
    return 64;
  }

  const server = await startMcpProjectRuntimeStreamableHttp(dependencies(), {
    port,
    bearerToken,
  });
  process.stderr.write(
    `CRDD MCP is listening on http://${server.host}:${server.port}${server.endpoint}\n`,
  );
  const closed = await closeMcpHttpOnProcessSignal(server);
  return closed.cleanupConfirmed ? 0 : 2;
}

try {
  process.exitCode = await main();
} catch {
  process.stderr.write(
    "CRDD MCPの起動または終了を確認できませんでした。自動再試行せず、Runtime状態を確認してください。\n",
  );
  process.exitCode = 2;
}
