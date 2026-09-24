#!/usr/bin/env node

/**
 * 配布RepositoryからCROS MCP接続を起動する。
 *
 * @responsibility CLI引数に応じてMCP TransportとProject Runtime公開境界を構成する。
 * @trace ARCH-000012
 */

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

/**
 * MCP入口の利用方法を標準出力へ表示する。
 *
 * @responsibility 利用可能なTransport、引数およびHTTP認証条件を人間へ案内する。
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: 戻り値を返さない。
 * @precondition 標準出力へ書き込めるProcessで実行する。
 * @postcondition 利用方法だけを標準出力へ一回書き込む。
 * @effect 標準出力へHelp文を出力する。
 * @failure 標準出力の書込み失敗をNode.js Processへ返す。
 * @invariant Project Runtime、AuthorityおよびRepository状態を変更しない。
 * @boundary CLI Processと利用者の端末表示の境界。
 * @security 秘密値やBearer Tokenの実値を表示しない。
 * @concurrency N/A: 同期した単一出力である。
 */
function printHelp(): void {
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

/**
 * MCP TransportからProject Runtimeへ渡す依存を構成する。
 *
 * @responsibility 認証、目的受付、判断適用および状態照会を正式な公開入口へだけ接続する。
 * @trace ARCH-000012
 * @input N/A: Processへ固定された公開入口を使用する。
 * @returns MCP Project Runtimeが利用する依存集合を返す。
 * @precondition CoordinatorとProject Runtimeの公開入口が読込み済みである。
 * @postcondition 各MCP操作が対応する一つの公開入口へ接続される。
 * @effect N/A: 依存関数を構成するだけで操作を実行しない。
 * @failure N/A: 局所Objectの構成に独自の失敗分岐を持たない。
 * @invariant MCP入口から内部実装へ直接接続しない。
 * @boundary MCP TransportとProject Runtime公開契約の境界。
 * @security Client認証を省略せず、認証結果を各操作へ渡す。
 * @concurrency 各要求のSignalと認証Contextを要求単位で保持する。
 */
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

/**
 * MCPのstdioまたはlocalhost HTTP入口を起動する。
 *
 * @responsibility Runtime版、Transport選択、HTTP認証入力および終了時cleanupを一つのCLI Lifecycleで所有する。
 * @trace ARCH-000012
 * @input Process引数、環境変数、標準入出力および終了Signal。
 * @returns CLI終了値を返す。
 * @precondition 固定Node.js RuntimeからRepositoryの標準入口として起動される。
 * @postcondition 成功時は選択したTransportを終了し、cleanup結果を終了値へ反映する。
 * @effect stdio通信またはlocalhost HTTP listenerを開始し、終了時に閉じる。
 * @failure 不正なRuntime、引数、認証入力またはcleanup不成立を非0終了値へ閉じる。
 * @invariant 一回の起動でstdioとHTTPを同時に開始しない。
 * @boundary CLI Process、stdio、localhost NetworkおよびProject Runtimeの境界。
 * @security HTTPはBearer Tokenを必須とし、127.0.0.1以外へ公開しない。
 * @concurrency Signal終了とTransport処理を同じServer Lifecycleへ収束させる。
 */
async function main(): Promise<number> {
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
