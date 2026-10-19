#!/usr/bin/env node

/**
 * 配布RepositoryからCROS MCP接続を起動する。
 *
 * @responsibility CLI引数に応じてMCP TransportとOrchestrator公開境界を構成する。
 * @trace ARCH-000012
 */

import {
  closeMcpHttpOnProcessSignal,
  routeMcpRequest,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  runMcpStdio,
  startMcpStreamableHttp,
  startMcpAuthenticatedStreamableHttp,
  readMcpServerConfiguration,
  createAccessMcpResolver,
  type McpRequestRoutingDependencies,
  type McpOrchestratorDependencies,
} from "../../40_Develop/mcp-server/src/index.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createTopicOperations } from "../../40_Develop/domain-model/src/index.ts";
import {
  createFilesystemRepositoryObservationPort,
  inspectRepositoryManifest,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "../../40_Develop/domain-model/src/index.ts";
import {
  verifyRepositoryRoot,
  resolveVerifiedRepositoryRoot,
} from "../../40_Develop/version-control/src/index.ts";
import { createMeetingOperations } from "../../40_Develop/domain-model/src/index.ts";
import { parseRepositoryProjectContextMarkdown } from "../../40_Develop/domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../40_Develop/version-control/src/index.ts";
import {
  observeRuntimeOwnedProjectClientPrincipal,
  runOrchestratorPublicDecision,
  runOrchestratorPublicObjective,
  runOrchestratorPublicStateQuery,
} from "../../40_Develop/orchestrator/src/index.ts";
import { isSupportedCoordinatorNodeRuntime } from "../../40_Develop/coordinator/src/index.ts";
import {
  resolveHostRootInput,
  readExistingHostRoot,
  readHostInitializationState,
} from "../../40_Develop/access-management/src/index.ts";
import {
  createHostAiProfileCatalogStore,
  createAiProfileCatalogAdministration,
} from "../../40_Develop/ai-adapter/src/index.ts";

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
 * @invariant Orchestrator、AuthorityおよびRepository状態を変更しない。
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
      "  crdd-mcp-server --stdio",
      "  crdd-mcp-server --http --port <port>",
      "  crdd-mcp-server --cros --http --port <port>",
      "",
      `MCP Protocol: ${MCP_ORCHESTRATOR_PROTOCOL_VERSION}`,
      "HTTPは127.0.0.1だけで待ち受け、CRDD_MCP_HTTP_BEARER_TOKENが必要です。",
      "--crosでは既存Host設定を使用し、各HTTP要求のユーザー資格を検証します。固定Transport Tokenとの混在とstdioは利用できません。",
      "MCPは外部ClientからOrchestratorへ接続する入口であり、Coordinatorの子機能ではありません。",
      "",
    ].join("\n"),
  );
}

/**
 * MCP TransportからOrchestratorへ渡す依存を構成する。
 *
 * @responsibility 認証、目的受付、判断適用および状態照会を正式な公開入口へだけ接続する。
 * @trace ARCH-000012
 * @input N/A: Processへ固定された公開入口を使用する。
 * @returns MCP Orchestratorが利用する依存集合を返す。
 * @precondition CoordinatorとOrchestratorの公開入口が読込み済みである。
 * @postcondition 各MCP操作が対応する一つの公開入口へ接続される。
 * @effect N/A: 依存関数を構成するだけで操作を実行しない。
 * @failure N/A: 局所Objectの構成に独自の失敗分岐を持たない。
 * @invariant MCP入口から内部実装へ直接接続しない。
 * @boundary MCP TransportとOrchestrator公開契約の境界。
 * @security Client認証を省略せず、認証結果を各操作へ渡す。
 * @concurrency 各要求のSignalと認証Contextを要求単位で保持する。
 */
function orchestratorDependencies(): McpOrchestratorDependencies {
  return {
    authenticateClient: observeRuntimeOwnedProjectClientPrincipal,
    runObjective: (request, signal, authentication) =>
      runOrchestratorPublicObjective(
        request,
        signal,
        process.cwd(),
        authentication,
      ),
    submitDecision: async (request, authentication) =>
      runOrchestratorPublicDecision(request, process.cwd(), authentication),
    getProjectState: async (request, authentication) =>
      runOrchestratorPublicStateQuery(request, process.cwd(), authentication),
  };
}

/**
 * 現在RepositoryのProject ContextをPortfolio Projectionとして読み取る。
 *
 * @responsibility Repository単体利用をCROS Federationと同じMCP結果形へ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input workingDirectoryに現在の作業Directoryを受け取る。
 * @returns 一Repositoryだけを含むPortfolio Projectionを返す。
 * @precondition workingDirectoryからVersion Control Rootを一意に検証できる。
 * @postcondition PROJECT_CONTEXT.mdの五場面を補完せず一Sourceとして返す。
 * @effect PROJECT_CONTEXT.mdを読取るが変更しない。
 * @failure Root不明、File欠落またはFormat不正を呼出し元へ返す。
 * @invariant Git Commit有無を成立条件にしない。
 * @boundary Repository FilesystemとMCP Project Context Adapterの境界。
 * @security Repository Role外のContextを推測しない。
 * @concurrency 一回の呼出しで一つのFile Snapshotを解析する。
 */
async function readRepositoryPortfolio(workingDirectory: string) {
  const repositoryRoot =
    resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  const context = parseRepositoryProjectContextMarkdown(
    await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
  );
  return Object.freeze({
    projects: Object.freeze([
      Object.freeze({
        projectId: context.projectId,
        state: "complete" as const,
        sources: Object.freeze([
          Object.freeze({
            repositoryId: context.repositoryId,
            revision: "repository-current",
            state: "complete" as const,
            repositoryRole: context.repositoryRole,
            context,
          }),
        ]),
      }),
    ]),
    retainedAsSourceOfTruth: false as const,
  });
}

/**
 * MCP Application全体の依存を構成する。
 *
 * @responsibility OrchestratorとRepository Project Contextの依存を分離して合成する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input N/A: Processの現在Repositoryを使用する。
 * @returns 合成MCP Applicationの依存集合を返す。
 * @precondition Orchestrator公開入口とProject Context Readerが読込み済みである。
 * @postcondition Runtime操作とContext読取りが別の専門依存に保持される。
 * @effect N/A: 依存関数を構成するだけで操作を実行しない。
 * @failure N/A: 局所Objectの構成に独自の失敗分岐を持たない。
 * @invariant Project ContextをOrchestrator状態へ変換しない。
 * @boundary MCP CLI Composition Rootと専門Adapter群の境界。
 * @security Repository単体利用ではCredentialを要求せず、現在Repositoryだけを読む。
 * @concurrency 各呼出しが独立したSnapshotを取得する。
 */
function createRequestRoutingDependencies(): McpRequestRoutingDependencies {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  return {
    orchestrator: orchestratorDependencies(),
    workspace: (repositoryId) => {
      const verified = verifyRepositoryRoot(repositoryRoot);
      if (verified.status !== "completed") return null;
      const observer = createFilesystemRepositoryObservationPort(
        verified.capability,
        1_048_576,
      );
      const file = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
      const source = file.status === "resolved" ? file.source : null;
      const manifest =
        source === null ? null : inspectRepositoryManifest(JSON.parse(source));
      if (!manifest || manifest.repositoryId !== repositoryId) return null;
      return {
        ownerRoot: repositoryRoot,
        projectId: manifest.projectId,
        authorize: () => {
          if (
            resolveVerifiedRepositoryRoot(verified.capability) !==
            repositoryRoot
          )
            return false;
          const fresh = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
          return fresh.status === "resolved" && fresh.source === source;
        },
      };
    },
    projectContext: {
      readPortfolio: () => readRepositoryPortfolio(process.cwd()),
    },
    topicMeeting: Object.freeze({
      topic: createTopicOperations(repositoryRoot),
      meeting: createMeetingOperations(repositoryRoot),
    }),
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
 * @boundary CLI Process、stdio、localhost NetworkおよびOrchestratorの境界。
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
    const routing = createRequestRoutingDependencies();
    const result = await runMcpStdio(
      (request, signal) => routeMcpRequest(request, routing, signal),
      process.stdin,
      process.stdout,
    );
    return result.status === "completed" ? 0 : 2;
  }
  const cros = args[0] === "--cros";
  const transportArgs = cros ? args.slice(1) : args;
  if (
    transportArgs.length !== 3 ||
    transportArgs[0] !== "--http" ||
    transportArgs[1] !== "--port"
  ) {
    process.stderr.write(
      "使い方: crdd-mcp-server --stdio | crdd-mcp-server [--cros] --http --port <port>\n",
    );
    return 64;
  }
  const port = Number(transportArgs[2]);
  const bearerToken = process.env.CRDD_MCP_HTTP_BEARER_TOKEN;
  if (
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535 ||
    (cros ? bearerToken !== undefined : !bearerToken)
  ) {
    process.stderr.write(
      "HTTPのportまたは認証構成が不正です。通常HTTPには固定Token、CROS HTTPには既存Host設定だけを使用してください。\n",
    );
    return 64;
  }

  let server: Awaited<ReturnType<typeof startMcpStreamableHttp>>;
  let publicOrigin: string | undefined;
  if (cros) {
    const configuration = await readMcpServerConfiguration(process.cwd());
    publicOrigin = configuration.publicOrigin;
    const input = resolveHostRootInput(process.env);
    const root = input && readExistingHostRoot(input);
    if (!input || !root) {
      process.stderr.write(
        "既存のCROS管理保存先を確認できません。Hostの初回設定を確認してください。\n",
      );
      return 2;
    }
    const initialization = readHostInitializationState(root);
    if (
      initialization.status === "fresh" ||
      initialization.status === "unknown"
    ) {
      process.stderr.write(
        "CROS管理状態を確認できません。明示的なHost設定を確認してください。\n",
      );
      return 2;
    }
    const profiles = createHostAiProfileCatalogStore(input);
    if (profiles.status !== "ready") return 2;
    server = await startMcpAuthenticatedStreamableHttp(
      createAccessMcpResolver(
        root,
        createAiProfileCatalogAdministration(profiles.store),
      ),
      { port, ...configuration },
    );
  } else {
    if (!bearerToken) return 64;
    const routing = createRequestRoutingDependencies();
    server = await startMcpStreamableHttp(
      (request, signal) => routeMcpRequest(request, routing, signal),
      { port, bearerToken },
    );
  }
  process.stderr.write(
    `CRDD MCP is listening on ${publicOrigin ?? `http://${server.host}:${server.port}`}${server.endpoint}\n`,
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
