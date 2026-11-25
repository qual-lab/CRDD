/**
 * CRDD Serverの公開起動オプションとProcessの寿命を所有する。
 * @packageDocumentation
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 採用Repository、HTTP待受、MCP通信と端末診断。
 * @security 外部Bind、共有から単体への切替、認証省略を行わない。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDefinitionAccess } from "../service/execution.ts";
import {
  readProjectViewData,
  startCrddServer,
  startWorkbench,
  readWorkbenchServerConfiguration,
  type AiRequests,
  type WorkbenchHandle,
} from "../app.ts";
import {
  createMcpServerFactory,
  type McpServerDependencies,
  readMcpServerConfiguration,
  runMcpStdio,
} from "../transport/mcp-server.ts";
import {
  resolveHostRootInput,
  readExistingHostRoot,
  readHostInitializationState,
} from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import {
  createMeetingOperations,
  createTopicOperations,
  parseRepositoryProjectContextMarkdown,
} from "@qual-lab/crdd-document-model";
import {
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  getRepository,
  readGitUser,
} from "@qual-lab/crdd-version-control";
import { createLocalPrincipalId } from "@qual-lab/crdd-execution-model";
import type {
  TaskSession,
  TaskSessionContext,
} from "@qual-lab/crdd-coordinator";

const usage = [
  "使い方: crdd-server [--shared | --mcp-stdio] [--port <0-65535>] [--docs]",
  "        crdd-server --help",
  "HTTP API・Workbench UIは127.0.0.1のみ。ポート省略または0で自動割当て。",
  "単体HTTPのMCPはCRDD_MCP_HTTP_BEARER_TOKENで認証し、未設定なら要求を拒否します。",
  "--shared: 既存Hostの管理状態を使用します。固定Bearer・--docs・--mcp-stdioと併用できません。",
  "--mcp-stdio: MCPを標準入出力へ切替。HTTP APIとUIは引き続き起動します。",
  "--docs: 単体にOpenAPIとSwagger UIを追加します。",
  "",
].join("\n");

type ServerOptions = Readonly<{
  shared: boolean;
  mcpStdio: boolean;
  documentation: boolean;
  port: number;
}>;

/** 重複・未知・排他的な指定を、Repositoryや待受の観測前に拒否する。 @trace ARCH-000012 */
function readOptions(args: readonly string[]): ServerOptions | "help" | null {
  if (args.length === 1 && args[0] === "--help") return "help";
  const seen = new Set<string>();
  let port = 0;
  for (let index = 0; index < args.length; index++) {
    const option = args[index] ?? "";
    if (
      !["--shared", "--mcp-stdio", "--port", "--docs"].includes(option) ||
      seen.has(option)
    )
      return null;
    seen.add(option);
    if (option === "--port") {
      const text = args[++index];
      if (text === undefined || !/^[0-9]{1,5}$/u.test(text)) return null;
      port = Number(text);
      if (port > 65535) return null;
    }
  }
  const shared = seen.has("--shared");
  const mcpStdio = seen.has("--mcp-stdio");
  const documentation = seen.has("--docs");
  if (
    shared &&
    (mcpStdio ||
      documentation ||
      process.env.CRDD_MCP_HTTP_BEARER_TOKEN !== undefined)
  )
    return null;
  return { shared, mcpStdio, documentation, port };
}

/** Nodeの対応版を起動・外部Effectより前に確認する。 @trace ARCH-000012 */
function supportedNode(): boolean {
  const version = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(
    process.versions.node,
  );
  if (version === null) return false;
  const [major, minor, patch] = version.slice(1).map(Number);
  return (
    [major, minor, patch].every(Number.isSafeInteger) &&
    ((major ?? -1) > 24 || (major === 24 && (minor ?? -1) >= 12))
  );
}

/** 起動に伴う保存は行わず、認可されたAI操作でだけ既存Sessionを開く。 @trace ARCH-000012 @trace ARCH-000015 */
function createAiRequests(
  resolveContext: () =>
    | TaskSessionContext
    | null
    | Promise<TaskSessionContext | null>,
): AiRequests {
  let current:
    | { context: TaskSessionContext; session: TaskSession }
    | undefined;
  const readCurrent = () => current;
  let closed = false;
  const blocked = (reason: string) => ({
    status: "blocked" as const,
    requestId: null,
    reason,
  });
  async function resolveSession(signal: AbortSignal | undefined) {
    if (closed || signal?.aborted) return blocked("workbench_ai_closed");
    if (!current) {
      const context = await resolveContext();
      if (closed || signal?.aborted) return blocked("workbench_ai_closed");
      if (context === null) return blocked("local_git_user_unavailable");
      const { openTaskSession } = await import("@qual-lab/crdd-coordinator");
      if (closed || signal?.aborted || !context.authorize())
        return blocked("workbench_ai_access_unavailable");
      // 最初の要求同士が並行しても、同じProject・主体のOwnerにだけ合流する。
      const initialized = readCurrent();
      if (
        initialized &&
        (initialized.context.principalId !== context.principalId ||
          initialized.context.projectId !== context.projectId)
      )
        return blocked("workbench_ai_access_unavailable");
      current ??= { context, session: openTaskSession(context) };
    }
    return { status: "ready" as const, ...current };
  }
  return {
    async start(request, signal) {
      const owner = await resolveSession(signal);
      if (owner.status === "blocked") return owner;
      if (closed || signal?.aborted || !owner.context.authorize())
        return blocked("workbench_ai_access_unavailable");
      if (!request.workspaceId) return owner.session.start(request, signal);
      const { prepareWorkspaceExecutionTarget } = await import(
        "../service/workspace.ts"
      );
      if (closed || signal?.aborted || !owner.context.authorize())
        return blocked("workbench_ai_access_unavailable");
      const root = resolveVerifiedRepositoryRoot(owner.context.rootCapability);
      return owner.session.start(
        request,
        signal,
        root === null
          ? null
          : prepareWorkspaceExecutionTarget(
              root,
              owner.context.projectId,
              request.workspaceId,
            ),
      );
    },
    async observe(requestId, signal) {
      const owner = await resolveSession(signal);
      if (
        owner.status !== "ready" ||
        closed ||
        signal?.aborted ||
        !owner.context.authorize()
      )
        throw new Error("workbench_ai_request_unavailable");
      return owner.session.observe(requestId);
    },
    async cancel(requestId, signal) {
      const owner = await resolveSession(signal);
      if (
        owner.status !== "ready" ||
        closed ||
        signal?.aborted ||
        !owner.context.authorize()
      )
        throw new Error("workbench_ai_request_unavailable");
      return owner.session.cancel(requestId);
    },
    async close() {
      closed = true;
      await current?.session.close();
    },
  };
}

/** Git配下の同じローカル主体と現在Projectだけを既存AI受付に渡す。 @trace ARCH-000015 */
async function resolveLocalAiContext(
  repositoryRoot: string,
): Promise<TaskSessionContext | null> {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed") return null;
  const readPrincipal = () => {
    const user = readGitUser(verified.capability);
    return user.status === "completed"
      ? createLocalPrincipalId(user.email)
      : null;
  };
  const principalId = readPrincipal();
  if (!principalId) return null;
  const project = await readProjectViewData(repositoryRoot);
  return {
    rootCapability: verified.capability,
    projectId: project.context.projectId,
    principalId,
    authorize: () =>
      resolveVerifiedRepositoryRoot(verified.capability) === repositoryRoot &&
      readPrincipal() === principalId,
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
  const contextIntake = parseRepositoryProjectContextMarkdown(
    await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
  );
  const context = contextIntake.result;
  if (context === null)
    throw new Error(
      contextIntake.issues.find(
        (issue) =>
          issue.kind === "artifact.project-context.projection-model-invalid",
      )?.reason ?? "project_context_scene_invalid",
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
 * @input N/A: Rootは現在Repositoryだけ。
 * @returns 合成MCP Applicationの依存集合を返す。
 * @precondition CLI文法・Runtime版・Transport条件を検証済みである。
 * @postcondition Runtime操作とContext読取りが別の専門依存に保持される。
 * @effect 起動時はRootを検証し、Coordinatorは実行系Toolの呼出し時まで読み込まない。
 * @failure Root不明は起動前に、Coordinator不明は当該Toolの呼出しで停止する。
 * @invariant Project ContextをCoordinator状態へ変換しない。
 * @boundary MCP CLI Composition Rootと専門Adapter群の境界。
 * @security Repository単体利用ではCredentialを要求せず、現在Repositoryだけを読む。
 * @concurrency 各呼出しが独立したSnapshotを取得する。
 */
function createLocalMcpDependencies(
  repositoryRoot: string,
): McpServerDependencies {
  const workspace: NonNullable<McpServerDependencies["workspace"]> = (
    repositoryId,
  ) => {
    const verified = getRepository(repositoryRoot);
    if (verified.status !== "completed") return null;
    const initial = readRepositoryManifest(repositoryRoot);
    if (initial.status !== "ready") return null;
    const manifest = initial.manifest;
    if (manifest.repositoryId !== repositoryId) return null;
    return {
      ownerRoot: repositoryRoot,
      projectId: manifest.projectId,
      authorize: () => {
        if (
          resolveVerifiedRepositoryRoot(verified.capability) !== repositoryRoot
        )
          return false;
        const fresh = readRepositoryManifest(repositoryRoot);
        return fresh.status === "ready" && fresh.identity === initial.identity;
      },
    };
  };
  return {
    coordinator: { scope: "local", repositoryRoot },
    workspace,
    runtimeDefinition: (repositoryId, signal) => {
      if (signal.aborted) return null;
      const access = workspace(repositoryId);
      if (!access) return null;
      const verified = getRepository(access.ownerRoot);
      if (verified.status !== "completed") return null;
      const gitUser = readGitUser(verified.capability);
      const principalId =
        gitUser.status === "completed"
          ? createLocalPrincipalId(gitUser.email)
          : null;
      if (!principalId) return null;
      return createDefinitionAccess(
        verified.capability,
        access.ownerRoot,
        principalId,
        (operation, target) =>
          !signal.aborted &&
          ["definition.read", "definition.write"].includes(operation) &&
          target.projectId === access.projectId &&
          resolveVerifiedRepositoryRoot(verified.capability) ===
            repositoryRoot &&
          access.authorize(),
      );
    },
    projectContext: {
      readPortfolio: () => readRepositoryPortfolio(repositoryRoot),
    },
    topicMeeting: Object.freeze({
      topic: createTopicOperations(repositoryRoot),
      meeting: createMeetingOperations(repositoryRoot),
    }),
  };
}

/** 共有Hostの既存認証を両通信へ接続する。単体fallbackは行わない。 @trace ARCH-000012 @trace ARCH-000013 */
async function startShared(
  repositoryRoot: string,
  port: number,
): Promise<WorkbenchHandle> {
  const configuration = await readWorkbenchServerConfiguration(repositoryRoot);
  const { publicOrigin: mcpPublicOrigin } =
    await readMcpServerConfiguration(repositoryRoot);
  const input = resolveHostRootInput(process.env);
  const root = input && readExistingHostRoot(input);
  if (!root) throw new Error("workbench_host_configuration_unavailable");
  const initialization = readHostInitializationState(root);
  if (initialization.status === "fresh" || initialization.status === "unknown")
    throw new Error("workbench_host_initialization_unavailable");
  return startCrddServer({
    workingDirectory: repositoryRoot,
    port,
    localAccessRoot: root,
    ...configuration,
    ...(mcpPublicOrigin === undefined ? {} : { mcpPublicOrigin }),
    sharedAiRequestsFactory: (
      rootCapability,
      projectId,
      principalId,
      authorize,
    ) =>
      createAiRequests(() => ({
        rootCapability,
        projectId,
        principalId,
        authorize,
      })),
  });
}

/**
 * 同じProcessのHTTP待受と、選択されたMCP搬送の終了を所有する。
 * @trace ARCH-000012
 * @boundary stdio EOF・通信故障・Process Signalと既存Server close。
 * @security stdio時の標準出力はMCP専用。起動URLと固定診断は標準エラーへ出す。
 */
export async function runCrddServerCommand(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  if (options === "help") {
    process.stdout.write(usage);
    return;
  }
  if (options === null) {
    process.stderr.write(usage);
    process.exitCode = 64;
    return;
  }
  if (!supportedNode()) {
    process.stderr.write(
      "CRDD Serverには検証済みのNode.js 24.12.0以降が必要です。\n",
    );
    process.exitCode = 2;
    return;
  }
  try {
    const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
      process.cwd(),
    );
    const mcp = options.shared
      ? null
      : createMcpServerFactory(createLocalMcpDependencies(repositoryRoot));
    const local = {
      workingDirectory: repositoryRoot,
      port: options.port,
      ...(options.documentation
        ? { apiDocumentation: true as const }
        : {
            aiRequests: createAiRequests(() =>
              resolveLocalAiContext(repositoryRoot),
            ),
          }),
    };
    const bearerToken = process.env.CRDD_MCP_HTTP_BEARER_TOKEN;
    const handle =
      mcp === null
        ? await startShared(repositoryRoot, options.port)
        : options.mcpStdio
          ? await startWorkbench(local)
          : await startCrddServer({
              ...local,
              localMcp: {
                source: mcp,
                ...(bearerToken === undefined ? {} : { bearerToken }),
              },
            });
    const stop = new AbortController();
    let resolveShutdown!: () => void;
    let rejectShutdown!: (reason: unknown) => void;
    const shutdown = new Promise<void>((resolve, reject) => {
      resolveShutdown = resolve;
      rejectShutdown = reject;
    });
    let shutdownKeepAlive: ReturnType<typeof setInterval> | undefined;
    // Listenerを閉じた後も、既存Ownerの終了を待つ間はProcessを維持する。
    const close = () => {
      if (stop.signal.aborted) return;
      shutdownKeepAlive = setInterval(() => {}, 60_000);
      stop.abort();
      void handle.close().then(resolveShutdown, rejectShutdown);
    };
    // stdioのjoin中にHTTP側だけ先に失敗しても未処理拒否にしない。
    void shutdown.catch(() => {});
    process.on("SIGINT", close);
    process.on("SIGTERM", close);
    const diagnostic = options.mcpStdio ? process.stderr : process.stdout;
    try {
      diagnostic.write(`CRDD Server: ${handle.publicUrl}\n`);
      if (options.mcpStdio && mcp !== null) {
        const inputEvents = ["end", "close", "error"] as const;
        const outputEvents = ["close", "error"] as const;
        for (const event of inputEvents) process.stdin.once(event, close);
        for (const event of outputEvents) process.stdout.once(event, close);
        try {
          const result = await runMcpStdio(
            mcp,
            process.stdin,
            process.stdout,
            stop.signal,
          );
          if (result.status !== "completed" || !result.cleanupConfirmed)
            process.exitCode = 2;
        } finally {
          for (const event of inputEvents)
            process.stdin.removeListener(event, close);
          for (const event of outputEvents)
            process.stdout.removeListener(event, close);
          process.stdin.pause();
        }
      } else {
        await shutdown;
      }
    } finally {
      close();
      try {
        await shutdown;
      } finally {
        clearInterval(shutdownKeepAlive);
        process.removeListener("SIGINT", close);
        process.removeListener("SIGTERM", close);
      }
    }
  } catch (error) {
    const reason =
      error instanceof Error &&
      [
        "workbench_host_configuration_unavailable",
        "workbench_host_initialization_unavailable",
        "workbench_server_configuration_invalid",
        "workbench_public_origin_invalid",
        "mcp_http_configuration_invalid",
        "mcp_server_configuration_invalid",
        "crdd_server_public_origin_mismatch",
        "crdd_api_documentation_requires_local_mode",
        "workbench_shared_access_required",
        "workbench_official_logo_unavailable",
        "workbench_client_asset_unavailable",
        "workbench_repository_root_invalid",
        "repository_working_directory_invalid",
      ].includes(error.message)
        ? error.message
        : "crdd_server_startup_unavailable";
    process.stderr.write(
      `CRDD Serverの起動または終了を確認できません。${options.shared ? "単体へ切り替えず停止しました。" : ""}理由: ${reason}\n`,
    );
    process.exitCode = 2;
  }
}
