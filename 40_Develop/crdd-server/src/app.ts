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
import { readFilesystemStoreDirectory } from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import {
  createMeetingOperations,
  createTopicOperations,
} from "@qual-lab/crdd-document-model";
import { acquireLock, type LockResult } from "@qual-lab/crdd-lock";
import {
  getRepository,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "@qual-lab/crdd-version-control";
import type { GitHostLinkedAccessSession } from "./service/access.ts";
import {
  inspectServerPublicOrigin,
  readAiSelectionView,
} from "./service/configuration.ts";
import {
  type AiSessionOperation,
  createGitHostLinkedAiSessions,
  createObjectiveRuns,
  type ObjectiveRuns,
} from "./service/execution.ts";
import { bindGitHost, configuredGitHosts } from "./service/git-host.ts";
import { configuredLoginProviders } from "./service/login-providers.ts";
import { readProjectViewData } from "./service/project-context.ts";
import { createRepositoryScope } from "./service/repository-scope.ts";
import { createApiServer, setResponseHeaders } from "./transport/api-http.ts";
import {
  createApiApplication,
  createArtifactResourceHandler,
  createExecutionActivityHandler,
  createExecutionDefinitionHandler,
  createProjectContextHandler,
  createRepositoryFilesHandler,
  createTopicMeetingHandler,
  createWorkbenchContextHandler,
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
import type {
  CrddServerStartRequest,
  WorkbenchConnectionState,
  WorkbenchHandle,
  WorkbenchPresentationState,
  WorkbenchStartRequest,
} from "./transport/api-types.ts";
import type { EmbeddedMcpOAuthOptions } from "./transport/mcp-types.ts";

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

/** HTTP前段から個別処理へ渡す、要求内だけの接続情報。 */
interface PreparedRequest {
  readonly incoming: IncomingMessage;
  readonly response: ServerResponse;
  readonly requestSignal: AbortSignal;
  readonly method: string;
  readonly requestUrl: URL;
  readonly requestPath: string;
  readonly actionToken: string;
  readonly repositoryRoot: string;
  readonly localAccessRoot: WorkbenchStartRequest["localAccessRoot"];
  readonly origin: string | null;
}

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
  if (request.localAccessRoot !== undefined)
    throw new Error("mcp_oauth_configuration_required");
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
  objectiveRuns: ObjectiveRuns,
  mcpOAuth?: EmbeddedMcpOAuthOptions,
): Promise<WorkbenchHandle> {
  if (request.localAccessRoot === undefined)
    return startHttpServer(request, objectiveRuns, mcpOAuth);
  let acquired: LockResult;
  try {
    acquired = acquireLock({
      directory: readFilesystemStoreDirectory(request.localAccessRoot),
      name: "shared-server.lock",
      identity: "crdd-server:shared-server",
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

/** リポジトリと明示された公開設定を、待受開始前に確定する。 @trace ARCH-000012 */
function inspectStartup(
  request: WorkbenchStartRequest,
  mcpOAuth?: EmbeddedMcpOAuthOptions,
) {
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
    (request.portfolio !== undefined || request.aiRequests !== undefined)
  )
    throw new Error("server_shared_sources_conflicting");
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    request.workingDirectory,
  );
  return {
    publicOrigin,
    port,
    loginProviders,
    gitHostingEnabled,
    repositoryScope,
    gitRuntimes,
    readGitHost,
    repositoryRoot,
  };
}

/** 固定の配布物を読む。欠落時は待受を開始しない。 @trace ARCH-000012 */
async function readWorkbenchAssets() {
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
  return assets;
}

/** HTTP起動と、明示構成された場合だけMCPへの分岐を所有する。 @trace ARCH-000012 */
async function startHttpServer(
  request: WorkbenchStartRequest,
  objectiveRuns: ObjectiveRuns,
  mcpOAuth?: EmbeddedMcpOAuthOptions,
  beforeListen?: () => void,
): Promise<WorkbenchHandle> {
  const {
    publicOrigin,
    port,
    loginProviders,
    gitHostingEnabled,
    repositoryScope,
    gitRuntimes,
    readGitHost,
    repositoryRoot,
  } = inspectStartup(request, mcpOAuth);
  const assets = await readWorkbenchAssets();
  const verification = getRepository(repositoryRoot);
  if (verification.status !== "completed")
    throw new Error("workbench_repository_root_invalid");
  const initialProjectSurface =
    request.localAccessRoot === undefined
      ? await readProjectViewData(repositoryRoot)
      : undefined;
  const presentation: WorkbenchPresentationState = {
    projectSurface: initialProjectSurface,
    aiSelection: readAiSelectionView(repositoryRoot),
    currentAiRequestId: null,
    aiRequestSnapshot: null,
  };
  const aiRequests = request.aiRequests;
  const gitHostLinkedAiSessions =
    request.sharedAiRequestsFactory && gitHostingEnabled
      ? createGitHostLinkedAiSessions(request.sharedAiRequestsFactory)
      : undefined;
  const openGitHostLinkedAiSession = (
    session: GitHostLinkedAccessSession,
    repositoryId: string,
    operation: AiSessionOperation,
    signal: AbortSignal,
    observedRequestId?: string,
  ) =>
    accessRoot && gitHostLinkedAiSessions
      ? gitHostLinkedAiSessions.open(
          accessRoot,
          session,
          repositoryId,
          operation,
          signal,
          observedRequestId,
        )
      : Promise.resolve(null);
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
  const publicLoginProviders = loginProviders?.map(({ id, displayName }) =>
    Object.freeze({ id, displayName }),
  );
  const accessRoot = request.localAccessRoot;
  const shared =
    loginProviders && publicLoginProviders && accessRoot && mcpOAuth
      ? await (
          await import("./transport/shared-server.ts")
        ).createSharedTransport({
          transport,
          accessRoot,
          origin: publicOrigin ?? new URL(`http://${HOST}:${port}`),
          publicOrigin,
          loginProviders,
          publicLoginProviders,
          gitRuntimes,
          readGitHost,
          repositoryScope,
          mcpOAuth,
          objectiveRuns,
        })
      : undefined;
  const readGitHostLinkedSession =
    shared?.session.readGitHostLinkedAccessSession;
  const readManagementSession = shared?.session.readManagement;
  const clearInvalidSessionCookies = shared?.session.clearInvalidCookies;
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
  ): Promise<PreparedRequest | undefined> => {
    const method = incoming.method ?? "";
    const requestUrl = new URL(incoming.url ?? "/", `http://${HOST}`);
    const requestPath = requestUrl.pathname;
    if (
      request.localAccessRoot !== undefined &&
      requestPath === "/api/workbench/overview" &&
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
        requestPath === "/api/workbench/overview" &&
        (method === "GET" || method === "HEAD")
          ? readGitHostLinkedSession?.(incoming)
          : undefined;
      const readsExecutionState =
        (method === "GET" || method === "HEAD") &&
        isExecutionStatePath(requestPath);
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
            observeGitHostLinkedAiSelection:
              gitHostLinkedAiSessions?.observeSelected,
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
      configuration: request,
      assets,
      contract: CONTRACT,
      host: HOST,
      healthPath: HEALTH_PATH,
    });
  /**
   * 表示・観測と静的配信、未知入力の固定処置を実行する。
   * @responsibility 移管済み操作を二重実行せず、表示・観測と固定拒否を維持する。
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
          readGitHostLinkedSession,
        }),
      ),
      executionDefinition: transport.handleRequest(
        createExecutionDefinitionHandler({
          getOrigin,
          capability: verification.capability,
          accessRoot,
          readGitHostLinkedSession,
        }),
      ),
      view: bindRequest(handleRepositoryViewRequest),
      aiSelection: bindRequest((context) =>
        handleAiSelection({
          ...context,
          capability: verification.capability,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          readGitHostLinkedSession,
          readManagementSession,
        }),
      ),
      aiRequestObservation: bindRequest((context) =>
        handleAiRequestObservation({
          ...context,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          openGitHostLinkedAiSession: readGitHostLinkedSession
            ? (repositoryId, operation, signal, observedRequestId) => {
                const session = readGitHostLinkedSession?.(context.incoming);
                return session
                  ? openGitHostLinkedAiSession(
                      session,
                      repositoryId,
                      operation,
                      signal,
                      observedRequestId,
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
          openGitHostLinkedAiSession: readGitHostLinkedSession
            ? (repositoryId, operation, signal) => {
                const session = readGitHostLinkedSession?.(context.incoming);
                return session
                  ? openGitHostLinkedAiSession(
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
          readGitHostLinkedSession,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          capability: verification.capability,
          presentation,
        }),
      ),
      ...shared?.routes,
      topicMeeting: transport.handleRequest(
        createTopicMeetingHandler({
          getOrigin,
          repositoryRoot,
          accessRoot,
          localContext: initialProjectSurface?.context,
          readSession: readGitHostLinkedSession,
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
          portfolio,
          readSession: readGitHostLinkedSession,
        }),
      ),
      artifact: transport.handleRequest(
        createArtifactResourceHandler({
          getOrigin,
          repositoryRoot,
          repository: verification.capability,
          accessRoot,
          localSurface: () => presentation.projectSurface,
          readSession: readGitHostLinkedSession,
        }),
      ),
      workbenchContext: transport.handleRequest(
        createWorkbenchContextHandler({
          getOrigin,
          accessRoot,
          localRepositoryId: initialProjectSurface?.context.repositoryId,
          actionToken,
          loginProviders: publicLoginProviders,
          readSession: readGitHostLinkedSession,
        }),
      ),
      execution: bindRequest((context) =>
        handleExecution({
          ...context,
          readGitHostLinkedSession,
          objectiveRuns,
        }),
      ),
      executionActivity: transport.handleRequest(
        createExecutionActivityHandler({
          getOrigin,
          repositoryRoot,
          accessRoot,
          readSession: readGitHostLinkedSession,
        }),
      ),
      repositoryFiles: transport.handleRequest(
        createRepositoryFilesHandler({
          getOrigin,
          repositoryRoot,
          localTarget: initialProjectSurface
            ? {
                repositoryId: initialProjectSurface.context.repositoryId,
                projectId: initialProjectSurface.context.projectId,
                allowMissingManifest:
                  readRepositoryManifest(repositoryRoot).status === "missing",
              }
            : undefined,
          accessRoot,
          readSession: readGitHostLinkedSession,
        }),
      ),
      fallback: bindRequest(handleFallback),
    },
    publicOrigin,
    accessRoot !== undefined,
    clearInvalidSessionCookies,
  );
  const documentation =
    request.apiDocumentation === true
      ? await (
          await import("./transport/api-document.ts")
        ).createApiDocumentation()
      : undefined;
  if (shared === undefined && documentation === undefined)
    server.on("request", app);
  else
    server.on("request", (incoming, response) => {
      if (shared?.dispatch(incoming, response)) return;
      if (documentation?.(incoming, response)) return;
      app(incoming, response);
    });
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
        objectiveRuns.stopAll();
        try {
          await transport.close();
        } catch (error) {
          primaryFailure = error;
        }
        const ownersClosed = await Promise.allSettled([
          aiRequests?.close?.(),
          gitHostLinkedAiSessions?.close(),
        ]);
        if (primaryFailure !== null) throw primaryFailure;
        if (ownersClosed.some((result) => result.status === "rejected"))
          throw new Error("workbench_ai_close_unconfirmed");
      })();
      return closeOperation;
    },
  });
}
