/**
 * CRDD Serverの公開起動オプションとProcessの寿命を所有する。
 * @packageDocumentation
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 採用Repository、HTTP待受、MCP通信と端末診断。
 * @security 外部Bind、共有から単体への切替、認証省略を行わない。
 */

import {
  readExistingHostRoot,
  readHostInitializationState,
  resolveHostRootInput,
} from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import type {
  TaskSession,
  TaskSessionContext,
} from "@qual-lab/crdd-coordinator";
import { createLocalPrincipalId } from "@qual-lab/crdd-execution-model";
import {
  getRepository,
  readGitUser,
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "@qual-lab/crdd-version-control";
import {
  type AiRequests,
  readProjectViewData,
  readWorkbenchServerConfiguration,
  startCrddServer,
  startWorkbench,
  type WorkbenchHandle,
} from "../app.ts";
import {
  createObjectiveRuns,
  type ObjectiveRuns,
  readRepositoryExecutionActivity,
  resolveLocalDefinitionAccess,
} from "../service/execution.ts";
import { readLocalProjectPortfolio } from "../service/project-context.ts";
import { createLocalRecords } from "../service/topic.ts";
import { configuredLoginProviders } from "../transport/login-providers.ts";
import {
  createMcpServerFactory,
  type McpServerDependencies,
  readMcpServerConfiguration,
  runMcpStdio,
} from "../transport/mcp-server.ts";
import { consumeOAuthEnvironment } from "./environment.ts";

const usage = [
  "使い方: crdd-server [--shared | --mcp-stdio] [--port <0-65535>] [--docs]",
  "        crdd-server --initialize --provider google --port <固定ポート>",
  "        crdd-server --link-admin <管理者UUID> --provider google --port <固定ポート>",
  "        crdd-server --help",
  "HTTP API・Workbench UIは127.0.0.1のみ。ポート省略または0で自動割当て。",
  "--shared: 既存Hostの管理状態と共有OAuth設定を使用します。--docs・--mcp-stdioと併用できません。",
  "--mcp-stdio: 単体でMCPを標準入出力に追加。HTTP APIとUIは引き続き起動します。",
  "--docs: 単体にOpenAPIとSwagger UIを追加します。",
  "--initialize・--link-admin: Hostの対話端末で管理者を初期設定・再紐付けします。通常のServerは起動しません。",
  "",
].join("\n");

type ServerOptions = Readonly<{
  kind: "serve";
  shared: boolean;
  mcpStdio: boolean;
  documentation: boolean;
  port: number;
}>;
type AdminOptions = Readonly<{
  operation: { kind: "initialize" } | { kind: "link"; userId: string };
  provider: "google";
  port: number;
}>;

/** 重複・未知・排他的な指定を、Repositoryや待受の観測前に拒否する。 @trace ARCH-000012 */
function readOptions(
  args: readonly string[],
): ServerOptions | AdminOptions | "help" | null {
  if (args.length === 1 && args[0] === "--help") return "help";
  const seen = new Set<string>();
  let port = 0;
  let provider: string | undefined;
  let userId: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const option = args[index] ?? "";
    if (
      ![
        "--shared",
        "--mcp-stdio",
        "--port",
        "--docs",
        "--initialize",
        "--link-admin",
        "--provider",
      ].includes(option) ||
      seen.has(option)
    )
      return null;
    seen.add(option);
    if (option === "--port") {
      const text = args[++index];
      if (text === undefined || !/^[0-9]{1,5}$/u.test(text)) return null;
      port = Number(text);
      if (port > 65535) return null;
    } else if (option === "--provider") {
      provider = args[++index];
      if (provider !== "google") return null;
    } else if (option === "--link-admin") {
      userId = args[++index];
      if (
        !userId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
          userId,
        )
      )
        return null;
    }
  }
  const shared = seen.has("--shared");
  const mcpStdio = seen.has("--mcp-stdio");
  const documentation = seen.has("--docs");
  const initialize = seen.has("--initialize");
  if (initialize || userId) {
    if (
      (initialize && userId) ||
      shared ||
      mcpStdio ||
      documentation ||
      provider !== "google" ||
      port < 1
    )
      return null;
    return {
      operation: userId ? { kind: "link", userId } : { kind: "initialize" },
      provider,
      port,
    };
  }
  if (provider !== undefined) return null;
  if (shared && (mcpStdio || documentation)) return null;
  return {
    kind: "serve",
    shared,
    mcpStdio,
    documentation,
    port,
  };
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
  async function resolveSession(
    signal: AbortSignal | undefined,
    admissionCurrent?: () => boolean,
  ) {
    if (closed || signal?.aborted || admissionCurrent?.() === false)
      return blocked("workbench_ai_closed");
    if (!current) {
      const context = await resolveContext();
      if (closed || signal?.aborted || admissionCurrent?.() === false)
        return blocked("workbench_ai_closed");
      if (context === null) return blocked("local_git_user_unavailable");
      const { openTaskSession } = await import("@qual-lab/crdd-coordinator");
      if (
        closed ||
        signal?.aborted ||
        !context.authorize() ||
        admissionCurrent?.() === false
      )
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
    async start(request, signal, admissionCurrent) {
      const owner = await resolveSession(signal, admissionCurrent);
      if (owner.status === "blocked") return owner;
      if (
        closed ||
        signal?.aborted ||
        !owner.context.authorize() ||
        admissionCurrent?.() === false
      )
        return blocked("workbench_ai_access_unavailable");
      if (!request.workspaceId)
        return owner.session.start(
          request,
          signal,
          undefined,
          admissionCurrent,
        );
      const { prepareWorkspaceExecutionTarget } = await import(
        "../service/workspace.ts"
      );
      if (
        closed ||
        signal?.aborted ||
        !owner.context.authorize() ||
        admissionCurrent?.() === false
      )
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
        admissionCurrent,
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
    async join(requestId) {
      if (!current) throw new Error("workbench_ai_request_unavailable");
      await current.session.join(requestId);
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
  objectiveRuns: ObjectiveRuns,
): McpServerDependencies {
  const workspace = (repositoryId: string) => {
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
    coordinator: { scope: "local", repositoryRoot, objectiveRuns },
    executionActivity: {
      read: ({ repositoryId, ...query }, signal) => {
        if (repositoryId !== undefined)
          return readRepositoryExecutionActivity(
            repositoryId,
            query,
            { scope: "local", repositoryRoot },
            signal,
            query.projectId,
          );
        if (signal.aborted) return Promise.resolve(null);
        const manifest = readRepositoryManifest(repositoryRoot);
        return manifest.status === "ready"
          ? readRepositoryExecutionActivity(
              manifest.manifest.repositoryId,
              query,
              { scope: "local", repositoryRoot },
              signal,
              query.projectId,
            )
          : Promise.resolve(null);
      },
    },
    workspace,
    runtimeDefinition: (repositoryId, signal) => {
      if (signal.aborted) return null;
      const verified = getRepository(repositoryRoot, "placement");
      if (
        verified.status !== "completed" ||
        verified.placement.directory !== repositoryRoot
      )
        return null;
      return resolveLocalDefinitionAccess(
        verified.capability,
        repositoryId,
        signal,
      );
    },
    projectContext: {
      readPortfolio: (target, signal) =>
        readLocalProjectPortfolio(
          repositoryRoot,
          signal ?? new AbortController().signal,
          target,
        ),
    },
    topicMeeting: (signal) =>
      createLocalRecords(repositoryRoot, undefined, signal),
  };
}

/** 共有Hostの既存認証を両通信へ接続する。単体fallbackは行わない。 @trace ARCH-000012 @trace ARCH-000013 */
async function startShared(
  repositoryRoot: string,
  port: number,
  oauth: ReturnType<typeof consumeOAuthEnvironment>,
): Promise<WorkbenchHandle> {
  const configuration = await readWorkbenchServerConfiguration(repositoryRoot);
  const { publicOrigin: mcpPublicOrigin } =
    await readMcpServerConfiguration(repositoryRoot);
  const input = resolveHostRootInput(process.env);
  const root = input && readExistingHostRoot(input);
  if (!root) throw new Error("workbench_host_configuration_unavailable");
  if (!oauth) throw new Error("mcp_oauth_configuration_required");
  const loginProviders = configuredLoginProviders(oauth.loginProviders);
  const initialization = readHostInitializationState(root, {
    acceptsAdministratorIssuer: (issuer) =>
      loginProviders.some(({ profile }) => profile.acceptsIssuer(issuer)),
  });
  if (initialization.status === "fresh" || initialization.status === "unknown")
    throw new Error("workbench_host_initialization_unavailable");
  if (
    initialization.status !== "existing" ||
    initialization.administratorLinked !== true
  )
    throw new Error("host_google_administrator_unavailable");
  return startCrddServer({
    workingDirectory: repositoryRoot,
    port,
    localAccessRoot: root,
    ...configuration,
    ...oauth,
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
  if ("operation" in options) {
    const stop = new AbortController();
    const cancel = () => stop.abort();
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    try {
      const { runHostAdministratorCommand } = await import("./admin.ts");
      process.exitCode = await runHostAdministratorCommand(
        options.operation,
        options.provider,
        options.port,
        process.env,
        process.stdin,
        process.stdout,
        stop.signal,
      );
    } catch {
      process.stderr.write("管理者設定を確認できませんでした。\n");
      process.exitCode = 2;
    } finally {
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    }
    return;
  }
  try {
    const oauth = consumeOAuthEnvironment(process.env, options.shared);
    const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
      process.cwd(),
    );
    const objectiveRuns = createObjectiveRuns();
    const mcp = options.mcpStdio
      ? createMcpServerFactory(
          createLocalMcpDependencies(repositoryRoot, objectiveRuns),
        )
      : null;
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
    const handle = options.shared
      ? await startShared(repositoryRoot, options.port, oauth)
      : await startWorkbench(local, objectiveRuns);
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
      if (mcp !== null) {
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
        "mcp_oauth_configuration_invalid",
        "mcp_oauth_configuration_required",
        "git_hosts_configuration_required",
        "google_login_configuration_invalid",
        "git_hosts_configuration_invalid",
        "git_host_connection_configuration_invalid",
        "git_host_connection_requires_client_login",
        "github_connection_configuration_invalid",
        "git_host_monitor_configuration_invalid",
        "google_login_unavailable",
        "host_google_administrator_unavailable",
        "host_google_initialization_unavailable",
        "crdd_server_public_origin_mismatch",
        "crdd_api_documentation_requires_local_mode",
        "workbench_shared_access_required",
        "shared_server_lock_occupied",
        "shared_server_lock_unavailable",
        "shared_server_lock_cleanup_unconfirmed",
        "shared_server_startup_cleanup_unconfirmed",
        "shared_repository_roots_invalid",
        "workbench_official_logo_unavailable",
        "workbench_client_asset_unavailable",
        "workbench_repository_root_invalid",
        "repository_working_directory_invalid",
      ].includes(error.message)
        ? error.message
        : "crdd_server_startup_unavailable";
    process.stderr.write(
      `CRDD Serverの起動または終了を確認できません。${options.shared ? "単体へ切り替えず停止しました。" : ""}理由: ${reason}${reason === "shared_repository_roots_invalid" ? " (CRDD_SHARED_REPOSITORY_ROOTS)" : ""}\n`,
    );
    process.exitCode = 2;
  }
}
