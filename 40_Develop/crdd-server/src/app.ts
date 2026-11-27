/**
 * Workbenchの起動構成と本番HTTP接続。
 *
 * @packageDocumentation
 * @responsibility 検証済み起動構成から表示・操作のOwnerとHTTP受付を接続し、終了を所有する。
 * @trace ARCH-000005
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000009
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @trace ARCH-000015
 * @trace ARCH-000017
 * @boundary CLI配下の内部起動とloopback HTTP・既存専門Ownerの構成境界。
 * @effect localhost Listenerを開始・終了し、承認済みBrand Assetを読取る。
 * @security 外部Bind、任意Filesystem参照、Force Pushおよび未確認公開を許可せず、Credential管理は検証済み管理Contextの注入時だけ許可する。
 */

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import {
  acceptInvitation,
  readFilesystemStoreDirectory,
  readAccount,
} from "@qual-lab/crdd-access-management";
import {
  createMeetingOperations,
  createTopicOperations,
} from "@qual-lab/crdd-document-model";
import { acquireLock } from "@qual-lab/crdd-lock";
import {
  getRepository,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "@qual-lab/crdd-version-control";
import type { HostedAccessSession } from "./service/access.ts";
import { createRepositoryScope } from "./service/repository-scope.ts";
import {
  inspectServerPublicOrigin,
  readAiSelectionView,
} from "./service/configuration.ts";
import {
  type AiSessionOperation,
  createHostedAiSessions,
  createObjectiveRuns,
  createRepositoryWorkbenchActivityReader,
} from "./service/execution.ts";
import {
  bindGitHost,
  configuredGitHosts,
  createGitHostLinks,
} from "./service/git-host.ts";
import {
  readArtifactSelection,
  readProjectViewData,
} from "./service/project-context.ts";
import { createApiServer, setResponseHeaders } from "./transport/api-http.ts";
import {
  createApiApplication,
  createExecutionActivityHandler,
  createExecutionDefinitionHandler,
  createManagementSessionHandler,
  createManagementSessionLifecycleHandler,
  createProjectContextHandler,
  createTopicMeetingHandler,
  createWorkspaceResourceHandler,
  handleAiRequestObservation,
  handleAiRequestWrite,
  handleAiSelection,
  handleExecution,
  handleRepositoryAction,
  handleRepositoryView,
  handleSharedView,
  isAiRequestReadPath,
  isAiRequestWritePath,
  isAiSelectionPath,
  isExecutionStatePath,
  isExecutionWritePath,
  isRepositoryWritePath,
} from "./transport/api-server.ts";
import {
  clientLoginPaths,
  createClientSessionHandler,
  gitHostConnectionPaths,
} from "./transport/api-session.ts";
import type {
  CrddServerStartRequest,
  EmbeddedMcpOAuthOptions,
  WorkbenchConnectionState,
  WorkbenchHandle,
  WorkbenchPresentationState,
  WorkbenchStartRequest,
} from "./transport/api-types.ts";
import { createLogin } from "./transport/login.ts";
import { configuredLoginProviders } from "./transport/login-providers.ts";

export type {
  ManagementResult,
  ManagementView,
} from "./service/access.ts";
export {
  type AiSelectionView,
  readAiSelectionView,
  readWorkbenchServerConfiguration,
} from "./service/configuration.ts";
export type {
  AiRequestCommand,
  AiRequestMode,
  AiRequestSnapshot,
  AiRequestStartResult,
  AiRequests,
  AiResultItem,
  WorkbenchExecutionActivityObservation,
  WorkbenchExecutionActivityPageRequest,
  WorkbenchExecutionActivityProjection,
  WorkbenchExecutionEventProjection,
} from "./service/execution.ts";
// 活動Readerは起動時のDomain ContextのProject／Repository IDを第二引数に要求する。
export {
  createRepositoryWorkbenchActivityReader,
  type WorkbenchActivityReader,
} from "./service/execution.ts";
export type {
  ProjectPlanObservation,
  ProjectQualityObservation,
  ProjectViewData,
  RecordCollectionView,
  WorkbenchCapabilityState,
} from "./service/project-context.ts";
export {
  type OwnerArtifact,
  type OwnerArtifactCatalog,
  readOwnerArtifact,
  readOwnerArtifactCatalog,
  readProjectViewData,
} from "./service/project-context.ts";

const HOST = "127.0.0.1";
const CONTRACT: WorkbenchHandle["contract"] = "crdd/workbench/v1";
const HEALTH_PATH = "/.well-known/crdd-workbench-health";

export type {
  CrddServerStartRequest,
  ViewResponse,
  WorkbenchHandle,
  WorkbenchStartRequest,
} from "./transport/api-types.ts";

/**
 * Workbenchのlocalhost Production Shellを開始する。
 *
 * @responsibility 固定表示Route、公式ロゴ、Token付きRepository操作および任意構成のCredential管理だけを127.0.0.1へ公開し、ListenerとConnectionの終了を所有する。
 * @trace ARCH-000012
 * @input requestにRepository内の作業Directoryと任意Portを受け取る。
 * @returns 起動URL、Health URLおよび冪等な終了操作を持つHandleを返す。
 * @precondition workingDirectoryから検証済みRepository Rootを一意に解決できる。
 * @postcondition 成功時はloopback Listenerが一つ存在し、close後は所有Connectionを含めて終了する。
 * @effect localhost Listenerを開始し、公式Logo Assetを読取り、明示操作時だけ当該Repositoryを変更し得る。
 * @failure Root不正、Asset欠落、Bind失敗または観測不能時はErrorとし、未所有資源を残さない。
 * @invariant 任意Path、Directory一覧、Force Push、暗黙再送および未検証ContextからのCredential管理を提供しない。
 * @boundary BrowserとWorkbench Serverの直接境界。
 * @security hostは127.0.0.1固定であり、書込みRouteは起動ごとのTokenと固定Form Schemaを要求する。
 * @concurrency 複数Requestは独立処理し、closeが全所有Connectionを終了する。
 */
export async function startWorkbench(
  request: WorkbenchStartRequest,
  objectiveRuns = createObjectiveRuns(),
): Promise<WorkbenchHandle> {
  return startOwnedHttpServer(request, objectiveRuns);
}

/**
 * HTTPとMCPを一つのloopback Listenerへ明示接続する。
 * @responsibility 同じHostとOriginを確定し、各Protocolの正式受付へ生要求を排他的に渡す。
 * @trace ARCH-000012
 * @boundary Browser HTTP、MCP SDKおよび既存Host認証。
 * @security BearerとWorkbenchの許可を相互代用せず、異なるOrigin設定・Host欠測なら起動しない。
 * @concurrency 共通Listenerの停止・取消・joinは既存のHTTP起動Ownerが所有する。
 */
export async function startCrddServer(
  request: CrddServerStartRequest,
  objectiveRuns = createObjectiveRuns(),
): Promise<WorkbenchHandle> {
  const { mcpPublicOrigin, mcpOAuth, ...http } = request;
  if (!http.localAccessRoot)
    throw new Error("workbench_shared_access_required");
  if (
    inspectServerPublicOrigin(http.publicOrigin, "workbench")?.origin !==
    inspectServerPublicOrigin(mcpPublicOrigin, "mcp")?.origin
  )
    throw new Error("crdd_server_public_origin_mismatch");
  if (mcpOAuth === undefined)
    throw new Error("mcp_oauth_configuration_required");
  if (!mcpOAuth || !http.loginProviders)
    throw new Error("mcp_oauth_configuration_invalid");
  if (
    http.gitHosts === undefined ||
    (Array.isArray(http.gitHosts) && http.gitHosts.length === 0)
  )
    throw new Error("git_hosts_configuration_required");
  return startOwnedHttpServer(http, objectiveRuns, mcpOAuth);
}

class StartupCleanupUnconfirmed extends Error {}

/** 認可状態を共有するServerだけが、保存領域を終了確定まで占有する。 */
async function startOwnedHttpServer(
  request: WorkbenchStartRequest,
  objectiveRuns: ReturnType<typeof createObjectiveRuns>,
  mcpOAuth?: EmbeddedMcpOAuthOptions,
): Promise<WorkbenchHandle> {
  if (request.localAccessRoot === undefined)
    return startHttpServer(request, objectiveRuns, mcpOAuth);
  let acquired: ReturnType<typeof acquireLock>;
  try {
    acquired = acquireLock({
      directory: readFilesystemStoreDirectory(request.localAccessRoot),
      name: "shared-server.lock",
      identity: "access-management:shared-server",
    });
  } catch {
    throw new Error("shared_server_lock_unavailable");
  }
  if (acquired.status !== "acquired")
    throw new Error(
      acquired.reason === "lock_exists"
        ? "shared_server_lock_occupied"
        : "shared_server_lock_unavailable",
    );
  const { lock } = acquired;
  let handle: WorkbenchHandle;
  try {
    handle = await startHttpServer(request, objectiveRuns, mcpOAuth, () => {
      if (!lock.assertLive()) throw new Error("shared_server_lock_unavailable");
    });
  } catch (error) {
    if (!lock.release(error instanceof StartupCleanupUnconfirmed))
      throw new Error("shared_server_lock_cleanup_unconfirmed");
    throw error;
  }
  let closing: Promise<void> | undefined;
  return Object.freeze({
    ...handle,
    close: () => {
      closing ??= (async () => {
        try {
          await handle.close();
        } catch (error) {
          if (!lock.release(true))
            throw new Error("shared_server_lock_cleanup_unconfirmed");
          throw error;
        }
        if (!lock.release())
          throw new Error("shared_server_lock_cleanup_unconfirmed");
      })();
      return closing;
    },
  });
}

/** HTTP起動と、明示構成された場合だけMCPへの分岐を所有する。 @trace ARCH-000012 */
async function startHttpServer(
  request: WorkbenchStartRequest,
  objectiveRuns: ReturnType<typeof createObjectiveRuns>,
  mcpOAuth?: EmbeddedMcpOAuthOptions,
  beforeListen?: () => void,
): Promise<WorkbenchHandle> {
  const allowedStartFields = new Set([
    "workingDirectory",
    "publicOrigin",
    "port",
    "apiDocumentation",
    "portfolio",
    "localAccessRoot",
    "loginProviders",
    "gitHosts",
    "sharedRepositoryRoots",
    "aiRequests",
    "sharedAiRequestsFactory",
    "activityReader",
  ]);
  if (Object.keys(request).some((field) => !allowedStartFields.has(field)))
    throw new Error("workbench_configuration_invalid");
  const publicOrigin = inspectServerPublicOrigin(
    request.publicOrigin,
    "workbench",
  );
  if (
    request.apiDocumentation !== undefined &&
    (request.apiDocumentation !== true ||
      publicOrigin !== null ||
      request.localAccessRoot !== undefined ||
      request.aiRequests !== undefined ||
      request.sharedAiRequestsFactory !== undefined)
  )
    throw new Error("crdd_api_documentation_requires_local_mode");
  if (publicOrigin && request.localAccessRoot === undefined)
    throw new Error("workbench_shared_access_required");
  const port = request.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("workbench_port_invalid");
  if (
    mcpOAuth !== undefined &&
    (!request.loginProviders || request.localAccessRoot === undefined)
  )
    throw new Error("mcp_oauth_configuration_invalid");
  if (
    request.loginProviders !== undefined &&
    (!request.loginProviders ||
      request.localAccessRoot === undefined ||
      (!publicOrigin && port === 0))
  )
    throw new Error("login_configuration_invalid");
  const loginProviders =
    request.loginProviders === undefined
      ? undefined
      : configuredLoginProviders(request.loginProviders);
  const gitHosts =
    request.gitHosts === undefined ? [] : configuredGitHosts(request.gitHosts);
  const gitHostingEnabled = gitHosts.length > 0;
  if (gitHostingEnabled && loginProviders === undefined)
    throw new Error("git_host_connection_requires_client_login");
  const repositoryScope = gitHostingEnabled
    ? createRepositoryScope(request.sharedRepositoryRoots ?? [])
    : () => false;
  const gitRuntimes = gitHosts.map(bindGitHost);
  const gitHostByName = new Map(gitRuntimes.map((host) => [host.host, host]));
  const readGitHost = (host: string) => gitHostByName.get(host);
  if (
    request.localAccessRoot !== undefined &&
    (request.portfolio !== undefined ||
      request.aiRequests !== undefined ||
      request.activityReader !== undefined)
  )
    throw new Error("workbench_local_cros_sources_conflicting");
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    request.workingDirectory,
  );
  const logoPath = new URL(
    "../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg",
    import.meta.url,
  );
  const logo = await readFile(logoPath).catch(() => null);
  if (logo === null) throw new Error("workbench_official_logo_unavailable");
  const clientDistribution = path.join(
    import.meta.dirname,
    "..",
    "..",
    "workbench-ui",
    "dist",
    "client",
  );
  const assets = await Promise.all([
    readFile(path.join(clientDistribution, "index.html")),
    readFile(path.join(clientDistribution, "workbench.css")),
    readFile(path.join(clientDistribution, "assets", "workbench-client.js")),
  ])
    .then(([document, stylesheet, clientScript]) => ({
      document,
      stylesheet,
      clientScript,
      logo,
    }))
    .catch(() => null);
  if (assets === null) throw new Error("workbench_client_asset_unavailable");
  const verification = getRepository(repositoryRoot);
  if (verification.status !== "completed")
    throw new Error("workbench_repository_root_invalid");
  const initialProjectSurface =
    request.localAccessRoot === undefined
      ? await readProjectViewData(repositoryRoot)
      : undefined;
  const presentation: WorkbenchPresentationState = {
    executionActivityObservation: undefined,
    projectSurface: initialProjectSurface,
    aiSelection: readAiSelectionView(repositoryRoot),
    currentAiRequestId: null,
    aiRequestSnapshot: null,
    aiRequestNotice: null,
    aiSelectionManagementResult: null,
  };
  const aiRequests = request.aiRequests;
  const hostedAiSessions =
    request.sharedAiRequestsFactory && gitHostingEnabled
      ? createHostedAiSessions(request.sharedAiRequestsFactory)
      : undefined;
  const openHostedAiSession = (
    session: HostedAccessSession,
    repositoryId: string,
    operation: AiSessionOperation,
    signal: AbortSignal,
  ) =>
    accessRoot && hostedAiSessions
      ? hostedAiSessions.open(
          accessRoot,
          session,
          repositoryId,
          operation,
          signal,
        )
      : Promise.resolve(null);
  const activityReader =
    request.activityReader ??
    (request.aiRequests !== undefined &&
    request.localAccessRoot === undefined &&
    presentation.projectSurface !== undefined
      ? createRepositoryWorkbenchActivityReader(
          repositoryRoot,
          presentation.projectSurface.context,
        )
      : undefined);
  const topicMeeting =
    request.localAccessRoot === undefined
      ? Object.freeze({
          topic: createTopicOperations(repositoryRoot),
          meeting: createMeetingOperations(repositoryRoot),
        })
      : undefined;
  const portfolio = request.portfolio;
  const connectionState: WorkbenchConnectionState =
    portfolio === undefined ? "repository" : "cros_available";
  const actionToken = randomBytes(32).toString("base64url");
  const transport = createApiServer();
  const server = transport.server;
  const browserAuthentication = loginProviders !== undefined;
  const publicLoginProviders = loginProviders?.map(
    ({ profile: { id, displayName } }) => Object.freeze({ id, displayName }),
  );
  const accessRoot = request.localAccessRoot;
  let mcp:
    | ReturnType<
        typeof import("./transport/mcp-server.ts").createMcpHttpRequestHandler
      >
    | undefined;
  let clientSession: ReturnType<typeof transport.handleRequest> | undefined;
  let changeManagementSession:
    | ReturnType<typeof transport.handleRequest>
    | undefined;
  let managementSession: ReturnType<typeof transport.handleRequest> | undefined;
  let gitConnection: ReturnType<typeof transport.handleRequest> | undefined;
  let readHostedSession:
    | ReturnType<typeof createClientSessionHandler>["readHostedAccessSession"]
    | undefined;
  let readManagementSession:
    | ReturnType<typeof createClientSessionHandler>["readManagement"]
    | undefined;
  let oauthEndpoint:
    | ReturnType<
        typeof import("./transport/mcp-oauth.ts").createMcpOAuthEndpoint
      >
    | undefined;
  if (loginProviders && accessRoot) {
    const oauth =
      mcpOAuth === undefined
        ? undefined
        : await import("./transport/mcp-oauth.ts");
    const oauthState = oauth?.createMcpOAuthState();
    const origin = publicOrigin ?? new URL(`http://${HOST}:${port}`);
    const logins = Object.fromEntries(
      await Promise.all(
        loginProviders.map(
          async ({ profile, credentials }) =>
            [
              profile.id,
              await createLogin(profile, {
                ...credentials,
                callback: new URL(
                  clientLoginPaths(profile.id).callback,
                  origin,
                ),
              }),
            ] as const,
        ),
      ),
    );
    const gitConnections = gitRuntimes.map(
      ({ id, host, displayName, connect, observePermission }) => ({
        host,
        id,
        displayName,
        connection: connect(
          new URL(gitHostConnectionPaths(id).callback, origin),
        ),
        links: createGitHostLinks(),
        ...(observePermission && { observePermission }),
      }),
    );
    const gitConnectionByHost = new Map(
      gitConnections.map((connection) => [connection.host, connection]),
    );
    const browser = createClientSessionHandler(
      origin,
      logins,
      (identity, session) => readAccount(accessRoot, identity, session),
      gitConnections,
      (identity, { digest, email, emailVerified }) =>
        acceptInvitation(
          accessRoot,
          { ...identity, email, emailVerified },
          digest,
        ),
      oauthState?.invalidateUser,
      readGitHost,
      repositoryScope,
    );
    clientSession = transport.handleRequest(browser.handle);
    changeManagementSession = transport.handleRequest(
      createManagementSessionLifecycleHandler(origin, browser.changeManagement),
    );
    managementSession = transport.handleRequest(
      createManagementSessionHandler(
        origin,
        accessRoot,
        browser.readManagement,
        gitHostingEnabled,
        (incoming) =>
          browser.readHostedAccessSession(incoming)?.principal ?? null,
        (incoming) => browser.readCurrent(incoming, false),
        repositoryScope,
      ),
    );
    server.once("close", browser.close);
    readHostedSession = browser.readHostedAccessSession;
    readManagementSession = browser.readManagement;
    if (gitHostingEnabled) {
      gitConnection = transport.handleRequest(browser.handleGitConnection);
    }
    if (mcpOAuth !== undefined && oauth && oauthState) {
      const {
        createMcpOAuthProvider,
        createMcpOAuthEndpoint,
        createMcpOAuthInteraction,
        createMcpTokenVerifier,
      } = oauth;
      const { createOAuthMcpResolver, createMcpHttpRequestHandler } =
        await import("./transport/mcp-server.ts");
      const resource = new URL("/mcp", origin);
      const provider = createMcpOAuthProvider(
        {
          ...mcpOAuth,
          issuer: origin,
          resource,
        },
        oauthState,
      );
      oauthEndpoint = createMcpOAuthEndpoint(
        provider,
        resource,
        createMcpOAuthInteraction(
          provider,
          resource,
          browser,
          publicLoginProviders ?? [],
          browser.readMcpReferences,
          oauthState,
        ),
        oauthState,
      );
      // 同じListenerの起動後にDiscoveryする。失敗を旧Bearer認証へは回さない。
      let discovery: ReturnType<typeof createMcpTokenVerifier> | undefined;
      const resolver = createOAuthMcpResolver(
        accessRoot,
        async (token, signal) => {
          if (signal.aborted) return { status: "rejected" };
          discovery ??= createMcpTokenVerifier({
            issuer: origin,
            resource,
            clientId: mcpOAuth.verifier.id,
            clientSecret: mcpOAuth.verifier.secret,
          });
          const pending = discovery;
          try {
            return (await pending)(token, signal);
          } catch {
            if (discovery === pending) discovery = undefined;
            return { status: "unavailable" };
          }
        },
        gitHostingEnabled
          ? {
              hasCurrentToken: oauthState.hasCurrentToken,
              readGrantHostReference: oauthState.readGrantHostReference,
              readGitHost,
              repositoryScope,
              read: (host, reference, binding) =>
                gitConnectionByHost.get(host)?.links.read(reference, binding) ??
                null,
              open: (host, reference, binding) => {
                const connection = gitConnectionByHost.get(host);
                if (!connection?.observePermission) return null;
                const link = connection.links.open(reference, binding);
                return (
                  link && {
                    ...link,
                    observePermission: connection.observePermission,
                  }
                );
              },
            }
          : undefined,
        objectiveRuns,
      );
      mcp = createMcpHttpRequestHandler(resolver, {
        ...(publicOrigin ? { publicOrigin: publicOrigin.origin } : {}),
        resourceMetadataUrl: oauthEndpoint.metadata,
      });
    }
  }
  /**
   * 個別Routeより先に既存の要求前段を実行する。
   * @responsibility Artifact入力・資格抽出・接続確認・通常認証・共有AI／GET・共有操作経路の順序を保持する。
   * @trace ARCH-000012
   * @input 当該要求・応答とHTTP Ownerの要求専用Signal。
   * @returns 個別処理へ継続する局所入力、または処理済みを表すundefined。
   * @precondition Applicationが公開Originと同じURL解釈を確認済みである。
   * @postcondition 処理済み要求を後続へ渡さず、別要求の資格・Rootを再利用しない。
   * @effect 当該要求の接続確認、認可観測、共有GET・明示共有AI操作が発生し得る。
   * @failure 現行の固定拒否または取消を維持し、未確認を成功へ補完しない。
   * @invariant 接続専用操作を通常認証の後ろへ移動しない。
   * @boundary Applicationの要求前段と個別Route。
   * @security Body・Owner操作の前に用途別入力と現在認可を確認する。
   * @concurrency 前段の待機も同じ要求Promiseに含め、共有GET等の結果公開前に取消・現在認可を再確認する。
   */
  const prepareRequest = async (
    incoming: IncomingMessage,
    response: ServerResponse,
    requestSignal: AbortSignal,
  ) => {
    const method = incoming.method ?? "";
    const requestUrl = new URL(incoming.url ?? "/", `http://${HOST}`);
    const requestPath = requestUrl.pathname;
    let artifactSelection: ReturnType<typeof readArtifactSelection> = null;
    if (
      requestPath === "/api/workbench/view" &&
      (method === "GET" || method === "HEAD")
    ) {
      try {
        artifactSelection = readArtifactSelection(
          requestUrl.searchParams,
          request.localAccessRoot !== undefined,
        );
      } catch {
        setResponseHeaders(response);
        response.statusCode = 400;
        response.end("artifact_input_invalid\n");
        return;
      }
    }
    if (
      request.localAccessRoot !== undefined &&
      requestPath === "/api/workbench/view" &&
      requestUrl.searchParams.getAll("repositoryId").length > 1
    ) {
      setResponseHeaders(response);
      response.statusCode = 403;
      response.end("local_repository_access_unavailable\n");
      return;
    }
    if (request.localAccessRoot !== undefined) {
      const repositoryWrite = isRepositoryWritePath(method, requestPath);
      const browserViewSession =
        requestPath === "/api/workbench/view" &&
        (method === "GET" || method === "HEAD")
          ? readHostedSession?.(incoming)
          : undefined;
      const readsExecutionState =
        method === "GET" && isExecutionStatePath(requestPath);
      const readsAiRequest =
        (method === "GET" || method === "HEAD") &&
        isAiRequestReadPath(requestPath);
      if (
        (method === "GET" || method === "HEAD") &&
        !readsExecutionState &&
        !readsAiRequest
      ) {
        if (
          await handleSharedView({
            response,
            requestSignal,
            method,
            requestUrl,
            requestPath,
            artifactSelection,
            shared:
              browserViewSession && accessRoot && gitHostingEnabled
                ? {
                    root: accessRoot,
                    session: browserViewSession,
                    hasManagementSession: () =>
                      Boolean(readManagementSession?.(incoming)),
                  }
                : undefined,
            loginProviders: publicLoginProviders,
            actionToken,
            configuration: request,
            observeHostedAiSelection: hostedAiSessions?.observeSelected,
            assets,
            contract: CONTRACT,
            host: HOST,
            healthPath: HEALTH_PATH,
          })
        )
          return;
      }
      const sharedActionRoute =
        readsExecutionState ||
        readsAiRequest ||
        isAiRequestWritePath(method, requestPath) ||
        (method === "POST" && isExecutionWritePath(requestPath)) ||
        ((method === "GET" || method === "HEAD" || method === "PUT") &&
          isAiSelectionPath(requestPath)) ||
        repositoryWrite;
      if (!sharedActionRoute) {
        setResponseHeaders(response);
        response.statusCode = 403;
        response.end("local_repository_access_unavailable\n");
        return;
      }
    }
    const address = server.address();
    return {
      incoming,
      response,
      requestSignal,
      method,
      requestUrl,
      requestPath,
      artifactSelection,
      actionToken,
      repositoryRoot,
      localAccessRoot: request.localAccessRoot,
      origin:
        publicOrigin?.origin ??
        (address && typeof address !== "string"
          ? `http://${HOST}:${address.port}`
          : null),
    };
  };
  /**
   * 個別操作へ継続する当該要求の入力。
   * @responsibility 前段で処理済みの要求と、個別Routeへ渡す入力を区別する。
   * @trace ARCH-000012
   * @shape 要求・応答・Signal、URLと入力選択、当該要求の資格・検証済みRoot・Action Token。
   * @invariant 要求終了後に保存せず、別要求の認可根拠へ転用しない。
   * @boundary 要求前段と個別HTTP操作。
   * @security Server内の一時値であり、Wire・Browser・Cacheへ公開しない。
   * @compatibility 既存Handler内の局所値をまとめるだけで、通信・保存契約を変更しない。
   */
  type PreparedRequest = NonNullable<
    Awaited<ReturnType<typeof prepareRequest>>
  >;
  /**
   * 既存の起動Ownerと当該要求を単体表示受付へ接続する。
   * @responsibility 起動済みの同じOwner・設定・表示状態を渡し、入力や状態を複製しない。
   * @trace ARCH-000012
   * @input 共通前段を終えた当該要求。
   * @returns 表示受付の終了を待つPromise。
   * @precondition HTTP Ownerが同じ要求の取消と終了を追跡している。
   * @postcondition 受付が既存表示値を同じ参照から読む。
   * @effect 既存表示受付を一回呼ぶ。
   * @failure 既存受付の例外を外側HTTP Ownerへ伝播する。
   * @invariant Owner・Session・設定を新設せず、Root公開APIを増やさない。
   * @boundary 起動Compositionと単体表示受付。
   * @security 資格・認可を新しい共有状態へ保存しない。
   * @concurrency 同じ要求Promiseで表示受付の終了を待つ。
   */
  const handleRepositoryViewRequest = (context: PreparedRequest) =>
    handleRepositoryView({
      ...context,
      capability: verification.capability,
      topicMeeting,
      portfolio,
      connectionState,
      presentation,
      aiRequests,
      activityReader,
      configuration: request,
      assets,
      contract: CONTRACT,
      host: HOST,
      healthPath: HEALTH_PATH,
    });
  /**
   * 表示・観測・通知消費と静的配信、未知入力の固定処置を実行する。
   * @responsibility 移管済み操作を二重実行せず、表示・観測・通知消費と固定拒否を維持する。
   * @trace ARCH-000012
   * @input 当該要求の前段を完了した入力Context。
   * @returns 表示・観測と応答の終了を待つPromise。
   * @precondition 接続専用操作・共有GET等で応答済みの場合は呼ばれない。
   * @postcondition 現行の表示・観測と未知Method／Pathの拒否を保持する。
   * @effect 表示用Readerと既存AI Ownerの観測、GET通知の消費、HTTP応答が発生し得る。
   * @failure 表示・観測の既存拒否を維持し、外側が予期しない例外を固定500へ変換する。
   * @invariant fallbackの存在をRoute移行完了とは表示しない。
   * @boundary Workbench受付と表示GET／HEAD・静的配信・固定拒否。
   * @security 前段の当該要求資格だけを使用し、起動Rootへ暗黙に権限を補完しない。
   * @concurrency 同じ要求SignalとOwner joinを継続し、遅延応答を現在の成功へ変換しない。
   */
  const handleFallback = async (context: PreparedRequest): Promise<void> => {
    const { response, method } = context;
    if (method !== "GET" && method !== "HEAD") {
      setResponseHeaders(response);
      response.statusCode = 405;
      response.setHeader("Allow", "GET, HEAD");
      response.end(method === "HEAD" ? undefined : "method_not_allowed\n");
      return;
    }
    await handleRepositoryViewRequest(context);
  };
  /**
   * 共通前段と個別操作を一つのHTTP lifecycleへ接続する。
   * @responsibility 前段が応答済みなら終了し、継続時だけ選択したHandlerを一回呼ぶ。
   * @trace ARCH-000012
   * @input 当該要求の局所入力を処理する非同期Handler。
   * @returns HTTP Ownerの取消・joinに接続済みの要求Listener。
   * @precondition Handlerは操作処理の終了を同じPromiseで待つ。
   * @postcondition 前段と個別処理の待機を一回だけ追跡し、二重応答・二重配送を起こさない。
   * @effect 当該要求の前段と選択操作を実行するListenerを生成する。
   * @failure 前段・操作の拒否を維持し、予期しない例外はHTTP Ownerへ伝播する。
   * @invariant 前段の資格Contextを次要求や永続状態へ保持しない。
   * @boundary Express RouteとWorkbench要求前段・操作。
   * @security 現在認可を通らない個別操作の接続を作らない。
   * @concurrency 同じ要求Controller・Promiseを使い、取消後のOwner終了を待つ。
   */
  const bindRequest = (handler: (context: PreparedRequest) => Promise<void>) =>
    transport.handleRequest(async (incoming, response, requestSignal) => {
      const prepared = await prepareRequest(incoming, response, requestSignal);
      if (
        prepared !== undefined &&
        !requestSignal.aborted &&
        !response.destroyed
      ) {
        await handler(prepared);
      }
    });
  const getOrigin = () => {
    const address = server.address();
    return (
      publicOrigin ??
      (address && typeof address !== "string"
        ? new URL(`http://${HOST}:${address.port}`)
        : null)
    );
  };
  const app = createApiApplication(
    {
      workspaceResource: transport.handleRequest(
        createWorkspaceResourceHandler({
          getOrigin,
          repositoryRoot,
          accessRoot,
          readHostedSession,
        }),
      ),
      executionDefinition: transport.handleRequest(
        createExecutionDefinitionHandler({
          getOrigin,
          capability: verification.capability,
          accessRoot,
          readHostedSession,
        }),
      ),
      view: bindRequest(handleRepositoryViewRequest),
      aiSelection: bindRequest((context) =>
        handleAiSelection({
          ...context,
          capability: verification.capability,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          readHostedSession,
          readManagementSession,
        }),
      ),
      aiRequestObservation: bindRequest((context) =>
        handleAiRequestObservation({
          ...context,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          openHostedAiSession: readHostedSession
            ? (repositoryId, operation, signal) => {
                const session = readHostedSession?.(context.incoming);
                return session
                  ? openHostedAiSession(
                      session,
                      repositoryId,
                      operation,
                      signal,
                    )
                  : Promise.resolve(null);
              }
            : undefined,
          aiRequests,
          presentation,
        }),
      ),
      aiRequestWrite: bindRequest((context) =>
        handleAiRequestWrite({
          ...context,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          openHostedAiSession: readHostedSession
            ? (repositoryId, operation, signal) => {
                const session = readHostedSession?.(context.incoming);
                return session
                  ? openHostedAiSession(
                      session,
                      repositoryId,
                      operation,
                      signal,
                    )
                  : Promise.resolve(null);
              }
            : undefined,
          aiRequests,
          presentation,
        }),
      ),
      repository: bindRequest((context) =>
        handleRepositoryAction({
          ...context,
          readHostedSession,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          capability: verification.capability,
          presentation,
        }),
      ),
      ...(clientSession === undefined ? {} : { clientSession }),
      ...(changeManagementSession === undefined
        ? {}
        : { changeManagementSession }),
      ...(managementSession === undefined ? {} : { managementSession }),
      ...(gitConnection === undefined ? {} : { gitConnection }),
      topicMeeting: transport.handleRequest(
        createTopicMeetingHandler({
          getOrigin,
          repositoryRoot,
          accessRoot,
          readSession: readHostedSession,
          onLocalWrite: () => {
            presentation.pendingRecordRefresh = {};
          },
        }),
      ),
      projectContext: transport.handleRequest(
        createProjectContextHandler({
          getOrigin,
          repositoryRoot,
          accessRoot,
          readSession: readHostedSession,
        }),
      ),
      execution: bindRequest((context) =>
        handleExecution({ ...context, readHostedSession, objectiveRuns }),
      ),
      executionActivity: transport.handleRequest(
        createExecutionActivityHandler({
          getOrigin,
          repositoryRoot,
          accessRoot,
          readSession: readHostedSession,
        }),
      ),
      fallback: bindRequest(handleFallback),
    },
    publicOrigin,
    browserAuthentication,
  );
  const documentation =
    request.apiDocumentation === true
      ? await (
          await import("./transport/api-document.ts")
        ).createApiDocumentation()
      : undefined;
  if (
    mcp === undefined &&
    documentation === undefined &&
    oauthEndpoint === undefined
  )
    server.on("request", app);
  else {
    const handleMcp =
      mcp === undefined ? undefined : transport.handleRequest(mcp.handle);
    const handleOAuth =
      oauthEndpoint === undefined
        ? undefined
        : transport.handleRequest(oauthEndpoint.handle);
    server.on("request", (incoming, response) => {
      if (mcp !== undefined && handleMcp && incoming.url === mcp.endpoint)
        handleMcp(incoming, response);
      else if (handleOAuth && oauthEndpoint?.matches(incoming.url))
        handleOAuth(incoming, response);
      else if (documentation?.(incoming, response)) return;
      else app(incoming, response);
    });
  }
  beforeListen?.();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    try {
      await transport.close();
    } catch {
      throw new StartupCleanupUnconfirmed(
        "shared_server_startup_cleanup_unconfirmed",
      );
    }
    throw new Error("workbench_address_unavailable");
  }
  const baseUrl = `http://${HOST}:${address.port}`;
  let closeOperation: Promise<void> | null = null;
  return Object.freeze({
    contract: CONTRACT,
    baseUrl,
    publicUrl: publicOrigin?.origin ?? baseUrl,
    healthUrl: `${baseUrl}${HEALTH_PATH}`,
    close: () => {
      if (closeOperation) return closeOperation;
      closeOperation = (async () => {
        let primaryFailure: unknown = null;
        try {
          await transport.close();
        } catch (error) {
          primaryFailure = error;
        }
        const ownersClosed = await Promise.allSettled([
          aiRequests?.close?.(),
          hostedAiSessions?.close(),
        ]);
        if (primaryFailure !== null) throw primaryFailure;
        if (ownersClosed.some((result) => result.status === "rejected"))
          throw new Error("workbench_ai_close_unconfirmed");
      })();
      return closeOperation;
    },
  });
}
