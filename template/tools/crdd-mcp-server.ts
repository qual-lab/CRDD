#!/usr/bin/env node

/**
 * 配布RepositoryからCROS MCP接続を起動する。
 *
 * @responsibility Coreを既定とし、明示した単体AutomationだけCoordinator公開境界へ接続する。
 * @trace ARCH-000012
 */

import {
  closeMcpHttpOnProcessSignal,
  createMcpServerFactory,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  runMcpStdio,
  startMcpStreamableHttp,
  startMcpAuthenticatedStreamableHttp,
  readMcpServerConfiguration,
  createAccessMcpResolver,
  type McpServerDependencies,
  type McpCoordinatorDependencies,
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
  resolveHostRootInput,
  readExistingHostRoot,
  readHostInitializationState,
} from "../../40_Develop/access-management/src/index.ts";

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
 * @invariant Coordinator、AuthorityおよびRepository状態を変更しない。
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
      "  crdd-mcp-server [--automation] --stdio",
      "  crdd-mcp-server [--automation] --http --port <port>",
      "  crdd-mcp-server --cros --http --port <port>",
      "",
      `MCP Protocol: ${MCP_COORDINATOR_PROTOCOL_VERSION}`,
      "HTTPは127.0.0.1だけで待ち受け、CRDD_MCP_HTTP_BEARER_TOKENが必要です。",
      "--crosでは既存Host設定を使用し、各HTTP要求のユーザー資格を検証します。固定Transport Tokenとの混在とstdioは利用できません。",
      "既定はCoreです。--automationで単体RepositoryのCoordinator実行を追加します。",
      "",
    ].join("\n"),
  );
}

/**
 * MCP TransportからCoordinatorへ渡す依存を構成する。
 *
 * @responsibility 認証、目的受付、判断適用および状態照会を正式な公開入口へだけ接続する。
 * @trace ARCH-000012
 * @input N/A: Processへ固定された公開入口を使用する。
 * @returns MCP Coordinatorが利用する依存集合を返す。
 * @precondition 単体Automationの引数・Runtime版が検証済みである。
 * @postcondition 各MCP操作が対応する一つの公開入口へ接続される。
 * @effect 固定Coordinator Moduleを読み込む。Provider処理は発行しない。
 * @failure Module又は必須操作が欠測なら起動前停止し、Coreだけへfallbackしない。
 * @invariant MCP入口から内部実装へ直接接続しない。
 * @boundary MCP TransportとCoordinator公開契約の境界。
 * @security Client認証を省略せず、認証結果を各操作へ渡す。
 * @concurrency 各要求のSignalと認証Contextを要求単位で保持する。
 */
async function coordinatorDependencies(): Promise<McpCoordinatorDependencies> {
  const { observeClientPrincipal, runObjective, submitDecision, queryState } =
    await import("../../40_Develop/coordinator/src/index.ts");
  if (
    ![observeClientPrincipal, runObjective, submitDecision, queryState].every(
      (value) => typeof value === "function",
    )
  )
    throw new Error("mcp_automation_unavailable");
  return {
    authenticateClient: observeClientPrincipal,
    runObjective: (request, signal, authentication) =>
      runObjective(request, signal, process.cwd(), authentication),
    submitDecision: async (request, authentication) =>
      submitDecision(request, process.cwd(), authentication),
    getProjectState: async (request, authentication) =>
      queryState(request, process.cwd(), authentication),
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
 * @responsibility CoordinatorとRepository Project Contextの依存を分離して合成する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input automation: 明示した単体実行の有効化。Rootは現在Repositoryだけ。
 * @returns 合成MCP Applicationの依存集合を返す。
 * @precondition CLI文法・Runtime版・Transport条件を検証済みである。
 * @postcondition Runtime操作とContext読取りが別の専門依存に保持される。
 * @effect Rootを検証し、Automation明示時だけ固定Coordinator Moduleを読み込む。
 * @failure Root又は明示Owner不明は起動前停止する。
 * @invariant Project ContextをCoordinator状態へ変換しない。
 * @boundary MCP CLI Composition Rootと専門Adapter群の境界。
 * @security Repository単体利用ではCredentialを要求せず、現在Repositoryだけを読む。
 * @concurrency 各呼出しが独立したSnapshotを取得する。
 */
async function createRequestRoutingDependencies(
  automation: boolean,
): Promise<McpServerDependencies> {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  const workspace: NonNullable<McpServerDependencies["workspace"]> = (
    repositoryId,
  ) => {
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
          resolveVerifiedRepositoryRoot(verified.capability) !== repositoryRoot
        )
          return false;
        const fresh = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
        return fresh.status === "resolved" && fresh.source === source;
      },
    };
  };
  return {
    ...(automation ? { coordinator: await coordinatorDependencies() } : {}),
    workspace,
    runtimeDefinition: (repositoryId, signal) => {
      if (signal.aborted) return null;
      const access = workspace(repositoryId);
      if (!access) return null;
      const verified = verifyRepositoryRoot(access.ownerRoot);
      if (verified.status !== "completed") return null;
      return {
        root: verified.capability,
        principalId: "local-mcp-user",
        revalidate: (operation, target) =>
          !signal.aborted &&
          ["definition.read", "definition.write"].includes(operation) &&
          target.projectId === access.projectId &&
          resolveVerifiedRepositoryRoot(verified.capability) ===
            repositoryRoot &&
          access.authorize(),
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
 * @boundary CLI Process、stdio、localhost NetworkおよびCoordinatorの境界。
 * @security HTTPはBearer Tokenを必須とし、127.0.0.1以外へ公開しない。
 * @concurrency Signal終了とTransport処理を同じServer Lifecycleへ収束させる。
 */
async function main(): Promise<number> {
  // 信頼した現在Processの版だけを確認する。任意文字列の公開検査APIではない。
  const version = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(
    process.versions.node,
  );
  const [major, minor, patch] = version?.slice(1).map(Number) ?? [];
  if (
    ![major, minor, patch].every(Number.isSafeInteger) ||
    (major ?? -1) < 24 ||
    (major === 24 && (minor ?? -1) < 12)
  ) {
    process.stderr.write(
      "CRDD MCP requires a preverified Node.js 24.12.0 or newer executable.\n",
    );
    return 2;
  }
  const originalArgs = process.argv.slice(2);
  const automation = originalArgs[0] === "--automation";
  const args = automation ? originalArgs.slice(1) : originalArgs;
  if (args.includes("--automation")) return 64;
  if (automation && args.includes("--cros")) return 64;
  if (args.length === 1 && ["--help", "-h"].includes(args[0] ?? "")) {
    printHelp();
    return 0;
  }
  if (args.length === 1 && args[0] === "--stdio") {
    const routing = await createRequestRoutingDependencies(automation);
    const result = await runMcpStdio(
      createMcpServerFactory(routing),
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
      "使い方: crdd-mcp-server [--automation] --stdio | crdd-mcp-server [--automation] --http --port <port> | crdd-mcp-server --cros --http --port <port>\n",
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
    server = await startMcpAuthenticatedStreamableHttp(
      createAccessMcpResolver(root),
      { port, ...configuration },
    );
  } else {
    if (!bearerToken) return 64;
    const routing = await createRequestRoutingDependencies(automation);
    server = await startMcpStreamableHttp(createMcpServerFactory(routing), {
      port,
      bearerToken,
    });
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
