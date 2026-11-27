/**
 * WorkbenchのExpress構成、HTTP要求受付とListenerの終了を扱う。
 *
 * @packageDocumentation
 * @responsibility 公開Origin検査を先行し、従来と同じURL解釈から明示Routeと未移管の処理へ接続する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary HTTP前段・Express Route・既存Workbench要求処理。
 * @effect 解析済みURLを絶対URLとして保持し、Pathの再解釈を避けて許可されたHandlerへ一回渡す。
 * @security Body解析・認可Cache・Session・静的fallbackを追加せず、未知入力は既存の拒否へ接続する。
 */

import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";
import { setTimeout } from "node:timers/promises";
import {
  type AccessRole,
  type AccountAccessPrincipal,
  type AuthorizedRepository,
  describeManagementPermissions,
  type FilesystemStoreRoot,
  type ManagementOperationOutcome,
  readCurrentAccess,
  readManagementState,
  readManagementUsersForDisplay,
} from "@qual-lab/crdd-access-management";
import { getModelCatalog } from "@qual-lab/crdd-ai-adapter";
import type { AiSelectionSnapshot } from "@qual-lab/crdd-configuration-model";
import {
  type AiSelectionReadResult,
  type AiSelectionSaveResult,
  readRepositoryAiSelection,
} from "@qual-lab/crdd-configuration-model";
import type {
  PortfolioProjection,
  TopicMeetingAccess,
  TopicMeetingListQuery,
  TopicMeetingPage,
} from "@qual-lab/crdd-document-model";
import type { queryPlan } from "@qual-lab/crdd-execution-model";
import {
  getRepository,
  type Repository,
  resolveVerifiedRepositoryRoot,
} from "@qual-lab/crdd-version-control";
import express from "express";
import {
  BrowserPrincipalRejected,
  createAccessViewResponse,
  executeManagementOperation,
  type GitHostLinkedAccessSession,
  type GitHostLinkedRepositoryAccess,
  issueUserInvitation,
  observeAuthorizedManifest,
  registerGitHostLinkedRepository,
  resolveGitHostLinkedDevelopmentAccess,
  resolveGitHostLinkedRepositories,
} from "../service/access.ts";
import type { AiSelectionView } from "../service/configuration.ts";
import {
  canManageAiSelection,
  readAiSelectionView,
  resolveAiSelectionAccess,
  updateAiSelection,
} from "../service/configuration.ts";
import type { AiRequestSnapshot } from "../service/execution.ts";
import {
  type AiRequests,
  type AiSession,
  type AiSessionOperation,
  type CoordinatorExecutionOperation,
  type DefinitionAccess,
  executeCoordinatorOperation,
  executeDefinitionOperation,
  executionDefinitionResources,
  type ObjectiveRuns,
  type ObservedAiSelection,
  prepareAiRequestStart,
  readRepositoryExecutionActivity,
  resolveGitHostLinkedDefinitionAccess,
  resolveLocalDefinitionAccess,
  validateExecutionDefinitionCommand,
} from "../service/execution.ts";
import {
  RESOURCE_ID,
  RESOURCE_ID_SOURCE,
  UUID_V4,
} from "../service/identity.ts";
import type { PublicLoginProvider } from "../service/login-providers.ts";
import {
  createPortfolioPage,
  type ProjectPageResponse,
  type ProjectViewData,
  summarizeProjectPortfolio,
  readArtifactMarkdown,
  readArtifactSelection,
  readAuthorizedOwnerArtifactCatalog,
  readGitHostLinkedProjectPortfolio,
  readLocalProjectPortfolio,
  readProjectViewData,
} from "../service/project-context.ts";
import {
  assertRepositoryActionTarget,
  executeRepositoryAction,
  inspectRepositoryActionResult,
  type LocalRepositoryFilesTarget,
  type RepositoryActionRequest,
  type RepositoryFilesRequest,
  readRepositoryFiles,
  withUnknownRepositoryObservation,
} from "../service/repository.ts";
import { matchesSecret } from "../service/secret.ts";
import { managementSessionLifetimeSeconds } from "../service/session.ts";
import {
  createGitHostLinkedRecords,
  createLocalRecords,
  createRecordDocumentViews,
  type RecordDocumentReader,
  readRecordPages,
  readRecordWrite,
  resolveTopicMeetingAccess,
} from "../service/topic.ts";
import {
  isWorkspaceRead,
  prepareWorkspaceOperation,
} from "../service/workspace-request.ts";
import {
  createJsonReply,
  hasContentType,
  matchesActionToken,
  matchesRequestHost,
  matchesRequestOrigin,
  RequestBodyTooLarge,
  readJsonRequestBody,
  readRouteMethod,
  requestFailureStatus,
  sendResponseBody,
  setResponseHeaders,
  validatePublicOriginRequest,
} from "./api-http.ts";
import {
  type ClientSessionAccess,
  clientLoginRoute,
  clientSessionPaths,
  gitConnectionRoute,
  gitConnectionsRoute,
  managementCookie,
  createSessionCookieHeader,
} from "./api-session.ts";
import type {
  ApiErrorResponse,
  ExecutionHttpFailureCode,
  MainViewResponse,
  WorkbenchConnectionState,
  WorkbenchPresentationState,
} from "./api-types.ts";

function createApiError(error: ApiErrorResponse["error"]): ApiErrorResponse {
  return { error };
}

const CSS_PATH = "/workbench.css";
const LOGO_PATH = "/assets/crdd-brand-icon.jpg";
const CLIENT_ASSET_PATH = "/assets/workbench-client.js";
const workbenchViewResource = {
  method: "get",
  path: "/api/workbench/overview",
} as const;
export const workbenchContextPath = "/api/workbench/context";
export const artifactResources = {
  change: "/api/repositories/:repositoryId/changes/:changeId",
  owner: "/api/repositories/:repositoryId/artifacts",
} as const;

/** 実行系の公開HTTPパス。受付と仕様表示で共用する。 @trace ARCH-000012 */
const executionRepository = "/api/repositories/:repositoryId";
export const repositoryFilesRoutes = {
  tree: `${executionRepository}/worktree/tree`,
  diff: `${executionRepository}/worktree/diff`,
} as const;
const executionMilestone = `${executionRepository}/projects/:projectId/milestones/:milestoneId`;
export const executionStateRoute = `${executionRepository}/runs/:requestId`;
export const executionActivityRoute = `${executionRepository}/activity`;
export const aiSelectionRoute = `${executionRepository}/ai-selection`;
const aiRequestCollection = `${executionRepository}/ai-requests`;
export const aiRequestReadRoutes = {
  current: `${executionRepository}/ai-request`,
  detail: `${aiRequestCollection}/:requestId`,
} as const;
/** AI依頼の書込みは、要求本文で操作を選ばない。 */
export const aiRequestWriteRoutes = [
  { method: "post", path: aiRequestCollection, operation: "start" },
  {
    method: "post",
    path: `${aiRequestReadRoutes.detail}/cancellation`,
    operation: "cancel",
  },
  { method: "put", path: aiRequestReadRoutes.current, operation: "select" },
] as const;
const aiSelectionResources = [
  { method: "get", path: aiSelectionRoute },
  { method: "put", path: aiSelectionRoute },
] as const;
const aiRequestReadResources = Object.values(aiRequestReadRoutes).map(
  (path) => ({ method: "get", path }) as const,
);
const clientSessionResources = [
  { method: "post", path: clientLoginRoute },
  { method: "post", path: `${clientLoginRoute}/invitation` },
  { method: "get", path: clientSessionPaths.session },
  { method: "delete", path: clientSessionPaths.session },
] as const;
const managementSessionLifecycleResources = [
  { method: "post", path: clientSessionPaths.management },
  { method: "delete", path: clientSessionPaths.management },
] as const;
const gitConnectionResources = [
  { method: "get", path: gitConnectionsRoute },
  { method: "get", path: gitConnectionRoute },
  { method: "post", path: gitConnectionRoute },
  { method: "delete", path: gitConnectionRoute },
] as const;

type HttpRoute<Method extends string, Path extends string> = readonly [
  Uppercase<Method>,
  Path,
];
type RegisteredHttpRoute<T> = T extends {
  method: infer Method extends string;
  path: infer Path extends string;
}
  ? HttpRoute<Method, Path>
  : never;

/** Workspace操作と受付のメソッド・パスを対応付けるクライアント向けの型。 */
export type WorkspaceHttpRoutes = {
  readonly [Route in (typeof workspaceResources)[number] as Route["operation"]]: RegisteredHttpRoute<Route>;
};

/** 画面から利用するHTTP経路。値の正本はExpressが参照する登録表。 */
export type WorkbenchHttpRoute =
  | RegisteredHttpRoute<
      | (typeof workspaceResources)[number]
      | (typeof repositoryWriteRoutes)[number]
      | (typeof aiSelectionResources)[number]
      | (typeof aiRequestReadResources)[number]
      | (typeof aiRequestWriteRoutes)[number]
      | (typeof clientSessionResources)[number]
      | (typeof managementSessionLifecycleResources)[number]
      | (typeof managementSessionResources)[number]
      | (typeof topicMeetingResources)[number]
      | (typeof gitConnectionResources)[number]
      | typeof workbenchViewResource
    >
  | HttpRoute<"GET", typeof workbenchContextPath>
  | HttpRoute<"GET", typeof executionActivityRoute>
  | HttpRoute<
      "GET",
      (typeof repositoryFilesRoutes)[keyof typeof repositoryFilesRoutes]
    >
  | HttpRoute<"GET", (typeof artifactResources)[keyof typeof artifactResources]>
  | HttpRoute<
      "GET",
      (typeof projectContextRoutes)[keyof typeof projectContextRoutes]
    >;
const decisionCollection = `${executionMilestone}/decisions`;
const decisionResource = `${decisionCollection}/:decisionId`;
export const executionWriteRoutes = [
  {
    action: "start",
    operation: "objective",
    path: `${executionMilestone}/runs`,
    summary: "Objectiveを開始する",
  },
  {
    action: "resume",
    operation: "objective",
    path: `${executionStateRoute}/resumption`,
    summary: "既存のObjectiveを再開する",
  },
  {
    action: undefined,
    operation: "cancel",
    path: `${executionStateRoute}/cancellation`,
    summary: "現在のObjectiveに取消を要求する",
  },
  {
    action: "request",
    operation: "decision",
    path: decisionCollection,
    summary: "判断を要求する",
  },
  {
    action: "answer",
    operation: "decision",
    path: `${decisionResource}/answers`,
    summary: "判断に回答する",
  },
  {
    action: "apply",
    operation: "decision",
    path: `${decisionResource}/application`,
    summary: "判断を明示的に適用する",
  },
  {
    action: "close",
    operation: "decision",
    path: `${decisionResource}/closure`,
    summary: "判断を閉鎖する",
  },
] as const;

const resourcePathPattern = (path: string) =>
  new RegExp(
    `^${path.replace(/:(\w+)/gu, `(?<$1>${RESOURCE_ID_SOURCE})`)}$`,
    "u",
  );
const executionStatePath = resourcePathPattern(executionStateRoute);
const executionActivityPath = resourcePathPattern(executionActivityRoute);
const repositoryTreePath = resourcePathPattern(repositoryFilesRoutes.tree);
const repositoryDiffPath = resourcePathPattern(repositoryFilesRoutes.diff);
const aiSelectionPath = resourcePathPattern(aiSelectionRoute);
const currentAiRequestPath = resourcePathPattern(aiRequestReadRoutes.current);
const aiRequestDetailPath = resourcePathPattern(aiRequestReadRoutes.detail);
const aiRequestWritePaths = aiRequestWriteRoutes.map((route) => ({
  ...route,
  pattern: resourcePathPattern(route.path),
}));

/** Git操作はHTTPのみ。操作の選択はメソッドとリソースに固定する。 */
export const repositoryWriteRoutes = [
  {
    method: "post",
    path: `${executionRepository}/staging`,
    operation: "prepare",
  },
  {
    method: "delete",
    path: `${executionRepository}/staging`,
    operation: "unprepare",
  },
  {
    method: "post",
    path: `${executionRepository}/revisions`,
    operation: "create_revision",
  },
  {
    method: "post",
    path: `${executionRepository}/revisions/:revision/publication`,
    operation: "publish_revision",
  },
] as const;

const repositoryWritePaths = repositoryWriteRoutes.map((route) => ({
  ...route,
  pattern:
    route.operation === "publish_revision"
      ? resourcePathPattern(
          route.path.replace(
            ":revision",
            "(?<revision>[0-9a-f]{40}|[0-9a-f]{64})",
          ),
        )
      : resourcePathPattern(route.path),
}));

function matchRepositoryWrite(method: string, path: string) {
  for (const route of repositoryWritePaths) {
    if (route.method.toUpperCase() !== method) continue;
    const groups = route.pattern.exec(path)?.groups;
    if (groups?.repositoryId)
      return {
        operation: route.operation,
        repositoryId: groups.repositoryId,
        revision: groups.revision,
      };
  }
  return null;
}

/** 共有認可の前段から通すGit書込み経路。 */
export function isRepositoryWritePath(method: string, path: string): boolean {
  return matchRepositoryWrite(method, path) !== null;
}

/** AI依頼のリソース別書込みだけを既存の認可前段へ通す。 */
export function isAiRequestWritePath(method: string, path: string): boolean {
  return aiRequestWritePaths.some(
    (entry) =>
      entry.method.toUpperCase() === method && entry.pattern.test(path),
  );
}

/** AI依頼の照会用URLだけを表示や書込みの受付と分ける。 */
export function isAiRequestReadPath(path: string): boolean {
  return currentAiRequestPath.test(path) || aiRequestDetailPath.test(path);
}

/** AI選定を、起動先または明示された共有リポジトリの設定へ送る。 */
export function isAiSelectionPath(path: string): boolean {
  return aiSelectionPath.test(path);
}
const executionWritePaths = executionWriteRoutes.map((route) => ({
  ...route,
  pattern: resourcePathPattern(route.path),
}));

export const projectContextRoutes = {
  list: "/api/projects",
  project: "/api/projects/:projectId",
  detail: "/api/repositories/:repositoryId/projects/:projectId/context",
} as const;
const projectDetailPath = resourcePathPattern(projectContextRoutes.detail);
const projectResourcePath = resourcePathPattern(projectContextRoutes.project);
const changeArtifactPath = resourcePathPattern(artifactResources.change);
const ownerArtifactPath = resourcePathPattern(artifactResources.owner);

export const topicMeetingResources = [
  ...(["topic", "meeting"] as const).flatMap((kind) => {
    const collection = `/api/repositories/:repositoryId/${kind}s` as const;
    const item = `${collection}/:${kind}Id` as const;
    return [
      { kind, operation: "list", method: "get", path: collection },
      { kind, operation: "get", method: "get", path: item },
      { kind, operation: "create", method: "post", path: collection },
      { kind, operation: "update", method: "patch", path: item },
      {
        kind,
        operation: "delete",
        method: "delete",
        path: item,
      },
    ] as const;
  }),
  {
    kind: "topic",
    operation: "promote",
    method: "post",
    path: "/api/repositories/:repositoryId/topics/:topicId/promotion",
  },
  {
    kind: "meeting",
    operation: "treat-outcome",
    method: "put",
    path: "/api/repositories/:repositoryId/meetings/:meetingId/outcomes/:outcomeId/treatment",
  },
] as const;
const topicMeetingPaths = topicMeetingResources.map((route) => ({
  ...route,
  match: resourcePathPattern(route.path),
}));

/** 画面要求と実行状態照会を区別する。 @trace ARCH-000012 */
export function isExecutionStatePath(path: string): boolean {
  return executionStatePath.test(path);
}

/** 実行の書込みを通常の画面操作と区別する。 @trace ARCH-000012 */
export function isExecutionWritePath(path: string): boolean {
  return executionWritePaths.some(({ pattern }) => pattern.test(path));
}

/** 起動時に読み終えた固定のWorkbench配信物。 @trace ARCH-000012 */
type WorkbenchAssets = Readonly<{
  document: Buffer;
  stylesheet: Buffer;
  logo: Buffer;
  clientScript: Buffer;
}>;

/**
 * 固定URLから起動時に取得済みの配信物を選ぶ。
 * @trace ARCH-000012
 * @security 要求URLをFilesystemのPathへ変換せず、追加のI/Oを行わない。
 */
function readStaticAsset(
  requestPath: string,
  assets: WorkbenchAssets,
): Readonly<{ body: Buffer; contentType: string }> | null {
  if (requestPath === CSS_PATH)
    return { body: assets.stylesheet, contentType: "text/css; charset=utf-8" };
  if (requestPath === LOGO_PATH)
    return { body: assets.logo, contentType: "image/jpeg" };
  if (requestPath === CLIENT_ASSET_PATH)
    return {
      body: assets.clientScript,
      contentType: "text/javascript; charset=utf-8",
    };
  return null;
}

/**
 * 既存の要求前段を保つ操作別Express Applicationを構成する。
 * @responsibility Routeの選択だけを所有し、管理・Workspace・Repository・Record・AI・鍵操作の意味は専用Handlerへ委譲する。
 * @trace ARCH-000012
 * @input HTTP終了Ownerへ接続済みの操作別Handler、既存処理用fallback、検査済み公開Origin。
 * @returns 生Header・URL前段から固定Express Routeへ接続するHTTP要求Listener。
 * @precondition 各Handlerが同じ要求前段・取消・joinを経由し、Listener開始前に登録する。
 * @postcondition 公開Origin検査の後にURL解釈し、管理HEADをGETへ暗黙変換しない。
 * @effect ExpressのRouteを構成し、要求時は当該URLのpathname・searchを照合に使用する。
 * @failure 公開配置拒否は421、URL解釈失敗は非秘密の固定500、その他は既存fallbackへ委譲する。
 * @invariant 未移管のfallbackを移行完了とは扱わず、処理済み要求を別Handlerへ流さない。
 * @boundary Node HTTPからExpressとWorkbench要求Ownerへの接続。
 * @security 生Header検査をBody・資格観測より先に行い、Express情報・etag・自動Body解析を追加しない。
 * @concurrency 同期前段後に一つのlifecycle付きHandlerだけを呼び、要求Contextを持ち越さない。
 */
export function createApiApplication(
  handlers: Readonly<{
    workspaceResource?: RequestListener;
    executionDefinition?: RequestListener;
    repository: RequestListener;
    aiSelection: RequestListener;
    aiRequestObservation: RequestListener;
    aiRequestWrite: RequestListener;
    execution: RequestListener;
    executionActivity: RequestListener;
    repositoryFiles: RequestListener;
    clientSession?: RequestListener;
    changeManagementSession?: RequestListener;
    managementSession?: RequestListener;
    topicMeeting?: RequestListener;
    projectContext: RequestListener;
    artifact?: RequestListener;
    workbenchContext?: RequestListener;
    gitConnection?: RequestListener;
    view: RequestListener;
    fallback: RequestListener;
  }>,
  publicOrigin: URL | null,
  shared = false,
  clearInvalidSessionCookies?: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => void,
): RequestListener {
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("query parser", false);
  app.set("trust proxy", false);
  app.enable("case sensitive routing");
  app.enable("strict routing");
  type RouteMethod = "get" | "head" | "post" | "put" | "patch" | "delete";
  const routes = new Map<string, Set<RouteMethod>>();
  const methodNotAllowed = (
    response: ServerResponse,
    methods: Iterable<string>,
  ) => {
    setResponseHeaders(response);
    response.statusCode = 405;
    response.setHeader(
      "Allow",
      [...methods].map((method) => method.toUpperCase()).join(", "),
    );
    response.end("method_not_allowed\n");
  };
  const register = (
    method: RouteMethod,
    path: string,
    handler: RequestListener,
    readOnly = true,
  ) => {
    const allowed = routes.get(path) ?? new Set<RouteMethod>();
    routes.set(path, allowed);
    allowed.add(method);
    if (method === "get") {
      if (readOnly) allowed.add("head");
      app.head(
        path,
        readOnly
          ? handler
          : (_incoming, response) => methodNotAllowed(response, allowed),
      );
    }
    app[method](path, handler);
  };
  if (handlers.workspaceResource) {
    for (const { method, path } of workspaceResources) {
      register(method, path, handlers.workspaceResource);
    }
  }
  if (handlers.executionDefinition) {
    for (const { method, path } of Object.values(
      executionDefinitionResources,
    )) {
      register(method, path, handlers.executionDefinition);
    }
  }
  for (const { method, path } of repositoryWriteRoutes)
    register(method, path, handlers.repository);
  for (const { method, path } of aiSelectionResources)
    register(method, path, handlers.aiSelection);
  for (const { method, path } of aiRequestReadResources)
    register(method, path, handlers.aiRequestObservation);
  for (const { method, path } of aiRequestWriteRoutes)
    register(method, path, handlers.aiRequestWrite);
  register("get", executionStateRoute, handlers.execution);
  register("get", executionActivityRoute, handlers.executionActivity);
  for (const route of Object.values(repositoryFilesRoutes))
    register("get", route, handlers.repositoryFiles);
  for (const { path } of executionWriteRoutes)
    register("post", path, handlers.execution);
  if (handlers.clientSession) {
    const clientSession = handlers.clientSession;
    for (const { method, path } of clientSessionResources)
      register(method, path, clientSession);
    register("get", `${clientLoginRoute}/callback`, clientSession, false);
  }
  if (handlers.changeManagementSession) {
    for (const { method, path } of managementSessionLifecycleResources)
      register(method, path, handlers.changeManagementSession);
  }
  if (handlers.managementSession) {
    for (const { method, path } of managementSessionResources) {
      register(method, path, handlers.managementSession);
    }
  }
  for (const route of Object.values(projectContextRoutes)) {
    register("get", route, handlers.projectContext);
  }
  if (handlers.artifact)
    for (const route of Object.values(artifactResources))
      register("get", route, handlers.artifact);
  if (handlers.workbenchContext)
    register("get", workbenchContextPath, handlers.workbenchContext);
  if (handlers.topicMeeting)
    for (const { method, path } of topicMeetingResources) {
      register(method, path, handlers.topicMeeting);
    }
  if (handlers.gitConnection) {
    const gitConnection = handlers.gitConnection;
    for (const { method, path } of gitConnectionResources)
      register(method, path, gitConnection);
    register("get", `${gitConnectionRoute}/callback`, gitConnection, false);
  }
  for (const path of [
    "/",
    "/index.html",
    "/project",
    "/topic",
    "/meeting",
    "/change",
    "/owner-artifact",
    CSS_PATH,
    LOGO_PATH,
    CLIENT_ASSET_PATH,
    "/.well-known/crdd-workbench-health",
  ]) {
    register("get", path, handlers.view);
  }
  register(
    workbenchViewResource.method,
    workbenchViewResource.path,
    handlers.view,
  );
  for (const [path, allowed] of routes)
    app.all(path, (_incoming, response) => methodNotAllowed(response, allowed));
  app.use((incoming, response) => {
    if (incoming.path !== "/api" && !incoming.path.startsWith("/api/")) {
      handlers.fallback(incoming, response);
      return;
    }
    setResponseHeaders(response);
    response.statusCode = 404;
    response.end();
  });
  return (incoming, response) => {
    if (!validatePublicOriginRequest(incoming, publicOrigin)) {
      setResponseHeaders(response);
      response.statusCode = 421;
      response.end("workbench_tls_boundary_invalid\n");
      return;
    }
    try {
      const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
      if (
        shared &&
        url.pathname.startsWith("/api/") &&
        incoming.headersDistinct.authorization !== undefined
      ) {
        setResponseHeaders(response);
        response.statusCode = 403;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(
          incoming.method === "HEAD"
            ? undefined
            : JSON.stringify(createApiError("request_rejected")),
        );
        return;
      }
      if (url.pathname.startsWith("/api/"))
        clearInvalidSessionCookies?.(incoming, response);
      incoming.url = url.href;
    } catch {
      setResponseHeaders(response);
      response.statusCode = 500;
      response.end("workbench_request_failed\n");
      return;
    }
    app(incoming, response);
  };
}

function readTopicMeetingQuery(parameters: URLSearchParams) {
  const allowed = new Set([
    "cursor",
    "limit",
    "query",
    "states",
    "owner",
    "relation",
    "occurredFrom",
    "occurredTo",
    "pendingOnly",
    "sort",
  ]);
  for (const field of new Set(parameters.keys()))
    if (
      !allowed.has(field) ||
      (field !== "states" && parameters.getAll(field).length !== 1)
    )
      return null;
  const cursor = parameters.get("cursor");
  const limit = parameters.get("limit");
  const pendingOnly = parameters.get("pendingOnly");
  const sort = parameters.get("sort");
  if (
    (limit !== null && !/^(?:[1-9][0-9]?|100)$/u.test(limit)) ||
    (pendingOnly !== null && pendingOnly !== "true" && pendingOnly !== "false")
  )
    return null;
  const states = parameters.getAll("states");
  const query = {
    ...(states.length ? { states } : {}),
    ...Object.fromEntries(
      ["query", "owner", "relation", "occurredFrom", "occurredTo"].flatMap(
        (field) =>
          parameters.has(field) ? [[field, parameters.get(field)]] : [],
      ),
    ),
    ...(pendingOnly === null ? {} : { pendingOnly: pendingOnly === "true" }),
    ...(sort === null
      ? {}
      : { sort: sort as NonNullable<TopicMeetingListQuery["sort"]> }),
  };
  return {
    ...(cursor === null ? {} : { cursor }),
    ...(limit === null ? {} : { limit: Number(limit) }),
    ...(Object.keys(query).length ? { query } : {}),
  };
}

const workspaceBase = "/api/repositories/:repositoryId";
const workspaceCollection = `${workspaceBase}/workspaces`;
const workspaceItem = `${workspaceCollection}/:workspaceId`;
export const workspaceResources = [
  { method: "get", path: workspaceCollection, operation: "list" },
  { method: "get", path: workspaceItem, operation: "get" },
  { method: "get", path: `${workspaceItem}/inspection`, operation: "inspect" },
  {
    method: "get",
    path: `${workspaceItem}/candidate/diff`,
    operation: "candidate-diff",
  },
  { method: "post", path: workspaceCollection, operation: "create" },
  {
    method: "put",
    path: `${workspaceBase}/selected-workspace`,
    operation: "select",
  },
  { method: "patch", path: workspaceItem, operation: "rename" },
  { method: "post", path: `${workspaceItem}/hold`, operation: "hold" },
  { method: "post", path: `${workspaceItem}/freeze`, operation: "freeze" },
  { method: "post", path: `${workspaceItem}/adoption`, operation: "adopt" },
  {
    method: "post",
    path: `${workspaceItem}/candidate/closure`,
    operation: "close-candidate",
  },
  { method: "delete", path: workspaceItem, operation: "discard" },
] as const;
const workspaceResourcePatterns = workspaceResources.map(
  ({ method, path, operation }) => ({
    method,
    operation,
    match: new RegExp(
      `^${path.replace(":repositoryId", `(?<repositoryId>${RESOURCE_ID_SOURCE})`).replace(":workspaceId", "(?<workspaceId>[a-f0-9-]{36})")}$`,
      "u",
    ),
  }),
);

/** WorkspaceのHTTP操作をPathとMethodで決め、MCPと同じOwnerへ接続する。 */
export function createWorkspaceResourceHandler({
  getOrigin,
  repositoryRoot,
  accessRoot,
  readGitHostLinkedSession,
}: Readonly<{
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  readGitHostLinkedSession:
    | ((request: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}>) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response);
    if (signal.aborted || response.destroyed) return;
    const origin = getOrigin();
    if (!origin)
      return reply(503, createApiError("workspace_request_unavailable"));
    if (
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    const method = readRouteMethod(incoming.method)?.toLowerCase();
    const route = workspaceResourcePatterns.find(
      (entry) => entry.method === method && entry.match.test(url.pathname),
    );
    const groups = route?.match.exec(url.pathname)?.groups;
    if (!route || !groups?.repositoryId)
      return reply(400, createApiError("invalid_request"));
    const { repositoryId, workspaceId } = groups;
    const { operation } = route;
    const write = !isWorkspaceRead(operation);
    let input: Record<string, unknown>;
    if (write) {
      if (url.search || !matchesRequestOrigin(incoming, origin.origin))
        return reply(403, createApiError("request_rejected"));
      if (!hasContentType(incoming, "application/json"))
        return reply(415, createApiError("invalid_content_type"));
      try {
        const body = await readJsonRequestBody(incoming, 16 * 1_024);
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reply(400, createApiError("invalid_request"));
        input = { ...body };
      } catch (error) {
        if (!signal.aborted && !response.destroyed)
          reply(
            requestFailureStatus(error, response),
            createApiError("invalid_request"),
          );
        return;
      }
    } else {
      if (
        [...new Set(url.searchParams.keys())].some(
          (key) => url.searchParams.getAll(key).length !== 1,
        )
      )
        return reply(400, createApiError("invalid_request"));
      input = Object.fromEntries(url.searchParams);
      if (operation === "list") {
        const limit = url.searchParams.get("limit");
        if (limit !== null && !/^[1-9]\d?$/u.test(limit))
          return reply(400, createApiError("invalid_request"));
        input.limit = limit === null ? 20 : Number(limit);
        input.cursor = url.searchParams.get("cursor");
      }
    }
    if (
      Object.hasOwn(input, "operation") ||
      Object.hasOwn(input, "repositoryId") ||
      (workspaceId && Object.hasOwn(input, "workspaceId"))
    )
      return reply(400, createApiError("invalid_request"));
    try {
      const prepared = await prepareWorkspaceOperation(
        { ...input, ...(workspaceId && { workspaceId }), operation },
        signal,
      );
      if (signal.aborted || response.destroyed) return;
      if (!prepared) return reply(400, createApiError("invalid_request"));
      const gitHostLinkedSession =
        accessRoot && readGitHostLinkedSession?.(incoming);
      const access = accessRoot
        ? gitHostLinkedSession
          ? await resolveGitHostLinkedDevelopmentAccess(
              accessRoot,
              gitHostLinkedSession,
              repositoryId,
              write,
              signal,
            )
          : null
        : prepared.resolveLocalWorkspaceAccess(
            repositoryRoot,
            repositoryId,
            signal,
          );
      if (signal.aborted || response.destroyed) return;
      if (!access || prepared.command.projectId !== access.projectId)
        return reply(404, createApiError("workspace_unavailable"));
      const result = prepared.executeWorkspace(
        access.ownerRoot,
        access.projectId,
        prepared.command,
        access.authorize,
        signal,
      );
      await setTimeout(0);
      if (signal.aborted || response.destroyed) return;
      if (!access.authorize()) throw new Error("workspace_result_unavailable");
      const { data } = result;
      const created =
        operation === "create" &&
        data !== null &&
        typeof data === "object" &&
        "status" in data &&
        data.status === "completed";
      reply(created ? 201 : 200, result);
    } catch {
      if (!signal.aborted && !response.destroyed)
        reply(
          503,
          createApiError(
            write ? "workspace_outcome_unconfirmed" : "workspace_unavailable",
          ),
        );
    }
  };
}

/** 活動の独立したHTTP読取り。画面用投影は組み立てない。 @trace ARCH-000012 */
export function createExecutionActivityHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  readSession?:
    | ((incoming: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response, { signal });
    const origin = input.getOrigin();
    if (signal.aborted) return;
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    const repositoryId = executionActivityPath.exec(url.pathname)?.groups
      ?.repositoryId;
    const limitText = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    if (
      !repositoryId ||
      readRouteMethod(incoming.method) !== "GET" ||
      [...url.searchParams.keys()].some(
        (name) =>
          (name !== "limit" && name !== "cursor") ||
          url.searchParams.getAll(name).length !== 1,
      ) ||
      (limitText !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/u.test(limitText))
    )
      return reply(400, createApiError("invalid_request"));
    try {
      const hosted = input.accessRoot && input.readSession?.(incoming);
      if (input.accessRoot && !hosted)
        return reply(403, createApiError("request_rejected"));
      const observation = await readRepositoryExecutionActivity(
        repositoryId,
        {
          limit: limitText === null ? 20 : Number(limitText),
          ...(cursor === null ? {} : { cursor }),
        },
        input.accessRoot && hosted
          ? {
              scope: "shared",
              credentials: { root: input.accessRoot, hosted },
            }
          : { scope: "local", repositoryRoot: input.repositoryRoot },
        signal,
      );
      if (observation === null)
        return reply(404, createApiError("execution_activity_unavailable"));
      return reply(200, observation);
    } catch {
      return reply(503, createApiError("execution_activity_unavailable"));
    }
  };
}

/** 作業ツリーのツリー又は差分の片方だけを認可済みの対象から取得する。 @trace ARCH-000012 */
export function createRepositoryFilesHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  localTarget: LocalRepositoryFilesTarget | undefined;
  accessRoot: FilesystemStoreRoot | undefined;
  readSession?:
    | ((incoming: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response, {
      signal,
      head: incoming.method === "HEAD",
    });
    const origin = input.getOrigin();
    if (signal.aborted) return;
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    const tree = repositoryTreePath.exec(url.pathname);
    const repositoryId = (tree ?? repositoryDiffPath.exec(url.pathname))?.groups
      ?.repositoryId;
    const allowed = tree ? ["directory", "cursor"] : ["path"];
    const filePath = url.searchParams.get("path");
    if (
      !repositoryId ||
      readRouteMethod(incoming.method) !== "GET" ||
      [...url.searchParams.keys()].some(
        (name) =>
          !allowed.includes(name) || url.searchParams.getAll(name).length !== 1,
      ) ||
      (!tree && !filePath)
    )
      return reply(400, createApiError("invalid_request"));
    const cursor = url.searchParams.get("cursor");
    const request: RepositoryFilesRequest = tree
      ? {
          kind: "tree",
          directory: url.searchParams.get("directory") ?? "",
          ...(cursor !== null && { cursor }),
        }
      : { kind: "diff", path: filePath ?? "" };
    try {
      const session = input.accessRoot && input.readSession?.(incoming);
      if (input.accessRoot && !session)
        return reply(403, createApiError("request_rejected"));
      const result = await readRepositoryFiles(
        repositoryId,
        request,
        input.accessRoot && session
          ? { scope: "shared", root: input.accessRoot, session }
          : {
              scope: "local",
              repositoryRoot: input.repositoryRoot,
              target: input.localTarget,
            },
        signal,
      );
      if (result === null)
        return reply(404, createApiError("repository_files_unavailable"));
      return reply(200, result);
    } catch {
      return reply(503, createApiError("repository_files_unavailable"));
    }
  };
}

/** 概要やGitホストを読まずに単体の起動先と共有のログイン案内を返す。 @trace ARCH-000012 */
export function createWorkbenchContextHandler(input: {
  getOrigin: () => URL | null;
  accessRoot: FilesystemStoreRoot | undefined;
  localRepositoryId: string | undefined;
  actionToken: string;
  loginProviders: readonly PublicLoginProvider[] | undefined;
  readSession:
    | ((request: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response, {
      signal,
      head: incoming.method === "HEAD",
    });
    if (signal.aborted || response.destroyed) return;
    const origin = input.getOrigin();
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    if (url.pathname !== workbenchContextPath || url.search)
      return reply(400, createApiError("invalid_request"));
    const contract = "crdd/workbench/context/v1";
    if (input.accessRoot === undefined) {
      return input.localRepositoryId
        ? reply(200, {
            contract,
            mode: "single",
            repositoryId: input.localRepositoryId,
          })
        : reply(503, createApiError("project_context_unavailable"));
    }
    const signedIn = readBrowserAuthentication(
      input.accessRoot,
      input.readSession?.(incoming),
    );
    if (signedIn === null)
      return reply(503, createApiError("workbench_context_unavailable"));
    return reply(200, {
      contract,
      mode: "shared",
      login: signedIn
        ? null
        : createAccessViewResponse(
            input.actionToken,
            false,
            input.loginProviders,
          ),
    });
  };
}

/** 本人確認の結果だけを返す。Gitホストや登録先の内容は観測しない。 */
function readBrowserAuthentication(
  root: FilesystemStoreRoot,
  session: GitHostLinkedAccessSession | null | undefined,
): boolean | null {
  if (!session || session.isCurrent?.() === false) return false;
  const access = readCurrentAccess(root, session.principal);
  if (session.isCurrent?.() === false) return false;
  if (access.status === "completed") return true;
  return access.reason === "current_access_authentication_rejected"
    ? false
    : null;
}

/** 成果物の選択、認可および本文取得を画面取得から分離する。 @trace ARCH-000016 */
export function createArtifactResourceHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  repository: Repository;
  accessRoot: FilesystemStoreRoot | undefined;
  localSurface: () => ProjectViewData | undefined;
  readSession:
    | ((incoming: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response, {
      signal,
      head: incoming.method === "HEAD",
    });
    const origin = input.getOrigin();
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    const change = changeArtifactPath.exec(url.pathname)?.groups;
    const owner = ownerArtifactPath.exec(url.pathname)?.groups;
    const repositoryId = change?.repositoryId ?? owner?.repositoryId;
    if (
      !repositoryId ||
      readRouteMethod(incoming.method) !== "GET" ||
      (change
        ? url.search !== ""
        : url.searchParams.size !== 1 || !url.searchParams.has("path"))
    )
      return reply(400, createApiError("artifact_input_invalid"));
    let selection: ReturnType<typeof readArtifactSelection>;
    try {
      selection = change
        ? readArtifactSelection("change", change.changeId ?? "")
        : readArtifactSelection("owner", url.searchParams.get("path") ?? "");
    } catch {
      return reply(400, createApiError("artifact_input_invalid"));
    }
    const stillReadable = () => {
      if (signal.aborted || response.destroyed)
        throw new Error("artifact_access_unavailable");
    };
    try {
      stillReadable();
      if (input.accessRoot === undefined) {
        const surface = input.localSurface();
        if (
          surface?.context.repositoryId !== repositoryId ||
          resolveVerifiedRepositoryRoot(input.repository) !==
            input.repositoryRoot
        )
          return reply(403, createApiError("artifact_access_unavailable"));
        const markdown = await readArtifactMarkdown(
          input.repositoryRoot,
          selection,
          surface.ownerArtifacts,
          stillReadable,
        );
        if (
          resolveVerifiedRepositoryRoot(input.repository) !==
          input.repositoryRoot
        )
          return reply(403, createApiError("artifact_access_unavailable"));
        return markdown === null
          ? reply(404, createApiError("artifact_unavailable"))
          : reply(200, {
              repositoryId,
              scope: "single",
              ...selection,
              markdown,
            });
      }
      const session = input.readSession?.(incoming);
      if (!session) return reply(401, createApiError("login_required"));
      const hosted = await resolveGitHostLinkedRepositories(
        input.accessRoot,
        session,
        signal,
        repositoryId,
      );
      const selected = hosted?.repositories[0];
      if (!hosted || !selected || selected.repositoryId !== repositoryId)
        return reply(403, createApiError("artifact_access_unavailable"));
      const assertReadable = () => {
        stillReadable();
        hosted.assertDirectory(selected);
      };
      const assertCurrent = () => {
        assertReadable();
        if (observeAuthorizedManifest(selected) !== "current")
          throw new Error("artifact_access_unavailable");
        hosted.assertCurrent([selected]);
      };
      assertCurrent();
      const catalog =
        selection.kind === "owner"
          ? await readAuthorizedOwnerArtifactCatalog(
              selected.root,
              selected.manifest,
              assertReadable,
            )
          : null;
      if (catalog !== null) assertCurrent();
      const markdown = await readArtifactMarkdown(
        selected.root,
        selection,
        catalog,
        assertReadable,
      );
      assertCurrent();
      return markdown === null
        ? reply(403, createApiError("artifact_access_unavailable"))
        : reply(200, { repositoryId, scope: "shared", ...selection, markdown });
    } catch {
      reply(403, createApiError("artifact_access_unavailable"));
    }
  };
}

/** Projectの汎用読取りをMCPと同じ投影へ接続する。 @trace ARCH-000012 */
export function createProjectContextHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  portfolio?: PortfolioProjection | undefined;
  readSession:
    | ((incoming: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response, { signal });
    const origin = input.getOrigin();
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    const groups =
      projectDetailPath.exec(url.pathname)?.groups ??
      projectResourcePath.exec(url.pathname)?.groups;
    const list = url.pathname === projectContextRoutes.list;
    const query = url.searchParams;
    const selectedRepository = list ? query.get("repositoryId") : null;
    const search = query.get("q") ?? "";
    const state = query.get("state") ?? "";
    const cursor = query.get("cursor") ?? "";
    const requestedLimit = query.get("limit");
    const paged = ["q", "state", "cursor", "limit"].some((key) =>
      query.has(key),
    );
    const target = groups?.projectId
      ? {
          projectId: groups.projectId,
          ...(groups.repositoryId && { repositoryId: groups.repositoryId }),
        }
      : selectedRepository === null
        ? undefined
        : { repositoryId: selectedRepository };
    if (
      readRouteMethod(incoming.method) !== "GET" ||
      (!list && (url.search || groups?.projectId === undefined)) ||
      (list &&
        ([...query.keys()].some(
          (key) =>
            !["repositoryId", "q", "state", "cursor", "limit"].includes(key) ||
            query.getAll(key).length !== 1,
        ) ||
          (selectedRepository !== null &&
            !RESOURCE_ID.test(selectedRepository)) ||
          (state !== "" &&
            !["complete", "partial", "conflicting"].includes(state)) ||
          (requestedLimit !== null &&
            !/^(?:[1-9]|[1-4][0-9]|50)$/u.test(requestedLimit))))
    )
      return reply(400, createApiError("invalid_request"));
    const browserListing = list && selectedRepository === null;
    try {
      let portfolio: PortfolioProjection;
      let session: GitHostLinkedAccessSession | null = null;
      if (!input.accessRoot) {
        portfolio =
          target?.repositoryId === undefined && input.portfolio
            ? input.portfolio
            : await readLocalProjectPortfolio(
                input.repositoryRoot,
                signal,
                target,
              );
      } else {
        session = input.readSession?.(incoming) ?? null;
        if (!session) return reply(401, createApiError("login_required"));
        portfolio = await readGitHostLinkedProjectPortfolio(
          input.accessRoot,
          session,
          signal,
          target,
          browserListing ? { rejectRevokedPrincipal: true } : undefined,
        );
      }
      if (session?.isCurrent?.() === false)
        return browserListing
          ? reply(401, createApiError("login_required"))
          : reply(403, createApiError("request_rejected"));
      if (list) {
        if (!paged) return reply(200, summarizeProjectPortfolio(portfolio));
        const page = createPortfolioPage(
          portfolio,
          {
            query: search,
            state,
            cursor,
            ...(selectedRepository !== null && {
              repositoryId: selectedRepository,
            }),
          },
          requestedLimit === null ? 20 : Number(requestedLimit),
        );
        return reply(200, {
          ...summarizeProjectPortfolio(page.portfolio),
          nextCursor: page.nextCursor,
          cursorInvalid: page.cursorInvalid,
        } satisfies ProjectPageResponse);
      }
      const project = portfolio.projects.find(
        ({ projectId }) => projectId === groups?.projectId,
      );
      return project
        ? reply(200, project)
        : reply(404, createApiError("project_context_unavailable"));
    } catch (error) {
      if (error instanceof BrowserPrincipalRejected)
        return reply(401, createApiError("login_required"));
      return reply(503, createApiError("project_context_unavailable"));
    }
  };
}

/** 共有の文書操作をMCPと同じ外部ホスト認可へ接続する。 */
export function createTopicMeetingHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  localContext?: ProjectViewData["context"] | undefined;
  onLocalWrite?: () => void;
  readSession:
    | ((incoming: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response);
    if (signal.aborted || response.destroyed) return;
    const origin = input.getOrigin();
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    const record = topicMeetingPaths.find(
      ({ method, match }) =>
        method.toUpperCase() === readRouteMethod(incoming.method) &&
        match.test(url.pathname),
    );
    const fields = record?.match.exec(url.pathname)?.groups;
    const repositoryId = fields?.repositoryId;
    const recordId = fields?.topicId ?? fields?.meetingId;
    const outcomeId = fields?.outcomeId;
    if (
      !record ||
      !repositoryId ||
      (recordId !== undefined &&
        (url.search ||
          !(record.kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u).test(
            recordId,
          )))
    )
      return reply(400, createApiError("invalid_request"));
    const { kind, operation } = record;
    const resolve = () => {
      if (!input.accessRoot)
        return createLocalRecords(
          input.repositoryRoot,
          repositoryId,
          signal,
          input.localContext,
        );
      const session = input.readSession?.(incoming);
      if (!session) return null;
      return createGitHostLinkedRecords(
        input.accessRoot,
        session,
        repositoryId,
        signal,
      );
    };
    try {
      if (operation !== "list" && operation !== "get") {
        if (url.search || !matchesRequestOrigin(incoming, origin.origin))
          return reply(403, createApiError("request_rejected"));
        if (!hasContentType(incoming, "application/json"))
          return reply(415, createApiError("invalid_content_type"));
        const pathFields =
          operation === "promote"
            ? { topicId: recordId }
            : operation === "treat-outcome"
              ? { meetingId: recordId, outcomeId }
              : recordId
                ? { id: recordId }
                : {};
        let body: unknown;
        try {
          body = await readJsonRequestBody(incoming, 16 * 1_024);
        } catch (error) {
          if (!signal.aborted && !response.destroyed)
            reply(
              requestFailureStatus(error, response),
              createApiError("invalid_request"),
            );
          return;
        }
        if (signal.aborted || response.destroyed) return;
        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          Object.keys(pathFields).some((key) => Object.hasOwn(body, key))
        )
          return reply(400, createApiError("invalid_request"));
        const action = readRecordWrite(kind, operation, {
          ...body,
          ...pathFields,
        });
        if (!action) return reply(400, createApiError("invalid_request"));
        const records = resolve();
        if (!records) return reply(401, createApiError("login_required"));
        const result = await records.write(action).finally(() => {
          if (!input.accessRoot) input.onLocalWrite?.();
        });
        if (signal.aborted || response.destroyed) return;
        return !result
          ? reply(404, createApiError("record_unavailable"))
          : result.status === "completed"
            ? reply(operation === "create" ? 201 : 200, result)
            : reply(result.status === "blocked" ? 409 : 503, result);
      }
      const reader = resolve();
      if (!reader) return reply(401, createApiError("login_required"));
      {
        if (recordId !== undefined) {
          const result = await reader.get(kind, recordId, true);
          if (signal.aborted || response.destroyed) return;
          return result?.status === "completed"
            ? reply(200, result)
            : reply(404, createApiError("record_unavailable"));
        }
        const input = readTopicMeetingQuery(url.searchParams);
        if (!input) return reply(400, createApiError("invalid_request"));
        const result = await reader.list({ kind, ...input });
        if (signal.aborted || response.destroyed) return;
        return result.status === "complete"
          ? reply(200, result.page)
          : result.status === "invalid"
            ? reply(400, createApiError("invalid_request"))
            : reply(404, createApiError("record_unavailable"));
      }
    } catch {
      if (!signal.aborted && !response.destroyed)
        reply(503, createApiError("record_unavailable"));
    }
  };
}

/** 管理セッションを利用する読み取りと操作を、メソッドと対象リソースで固定する。 */
const managementSessionResources = [
  { method: "get", path: "/api/access/me", view: "current" },
  { method: "get", path: "/api/users", view: "users" },
  { method: "get", path: "/api/repositories", view: "registeredRepositories" },
  {
    method: "post",
    path: "/api/users",
    operation: "invite",
    fields: ["username", "role", "email"],
  },
  {
    method: "post",
    path: "/api/users/:userId/invitations",
    operation: "renew",
    fields: ["email"],
  },
  {
    method: "post",
    path: "/api/repositories",
    operation: "registerRepository",
    fields: ["repositoryId", "directory"],
  },
  {
    method: "patch",
    path: "/api/users/:userId",
    operation: "updateUserName",
    fields: ["username"],
  },
  {
    method: "put",
    path: "/api/users/:userId/role",
    operation: "updateUserRole",
    fields: ["currentRole", "nextRole"],
  },
  {
    method: "delete",
    path: "/api/repositories/:repositoryId",
    operation: "unregisterRepository",
    fields: [],
  },
] as const;
const managementPatterns = managementSessionResources.map((resource) => ({
  resource,
  pattern: new RegExp(
    `^${resource.path.replace(/:(\w+)/gu, `(?<$1>${RESOURCE_ID_SOURCE})`)}$`,
    "u",
  ),
}));

/** 同じ保存結果は、対象リソースによらず同じHTTP失敗分類へ写す。 */
function managementWriteStatus(
  result: ManagementOperationOutcome,
  success: 200 | 201,
) {
  return result.status === "completed"
    ? success
    : result.status === "unavailable"
      ? 503
      : result.reason === "management_revision_conflict"
        ? 409
        : 403;
}

/** HTTPで短命の管理セッションを開始・終了し、ブラウザーにCookieを返す。 @trace ARCH-000012 */
export function createManagementSessionLifecycleHandler(
  origin: URL,
  changeManagement: ClientSessionAccess["changeManagement"],
) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const active = () => !signal.aborted && !response.destroyed;
    if (!active()) return;
    const reject = (status: number) =>
      sendResponseBody(
        response,
        "text/plain; charset=utf-8",
        "session_unavailable\n",
        false,
        status,
      );
    const url = new URL(request.url ?? "/", origin);
    if (
      url.pathname !== clientSessionPaths.management ||
      !matchesRequestHost(request, origin.host) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      return reject(400);
    if (request.method !== "POST" && request.method !== "DELETE")
      return reject(405);
    if (!matchesRequestOrigin(request, origin.origin)) return reject(403);
    const result = changeManagement(
      request,
      request.method === "POST" ? "open" : "close",
      active,
    );
    if (!active() || result.status === "cancelled") return;
    if (result.status === "no_session") return reject(401);
    if (result.status === "rejected") return reject(403);
    if (result.status === "unavailable") return reject(503);
    response.setHeader(
      "Set-Cookie",
      createSessionCookieHeader(
        origin,
        managementCookie,
        result.status === "opened" ? result.id : "",
        "/api",
        result.status === "opened" ? managementSessionLifetimeSeconds : 0,
      ),
    );
    setResponseHeaders(response);
    response.statusCode = 204;
    response.end();
  };
}

/** ブラウザーの短命管理セッションを既存の管理保存へ接続する。 */
export function createManagementSessionHandler(
  origin: URL,
  root: FilesystemStoreRoot,
  readManagement: (request: IncomingMessage) => {
    principal: AccountAccessPrincipal;
    formToken: string;
    readGitHost: import("../service/git-host.ts").ReadGitHost;
    readHostToken: (host: string) => string | null;
  } | null,
  gitHostingEnabled: boolean,
  readPrincipal: (request: IncomingMessage) => AccountAccessPrincipal | null,
  observeSessionBinding: (
    request: IncomingMessage,
  ) =>
    | { status: "completed"; account: { role: AccessRole } }
    | { status: "rejected" | "unavailable" },
  repositoryScope: import("../service/repository-scope.ts").RepositoryScope = () =>
    false,
) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response);
    if (signal.aborted || response.destroyed) return;
    const url = new URL(incoming.url ?? "/", origin);
    const method = readRouteMethod(incoming.method)?.toLowerCase();
    const matched = managementPatterns.find(
      ({ resource, pattern }) =>
        resource.method === method && pattern.test(url.pathname),
    );
    if (!matched || url.search)
      return reply(400, createApiError("invalid_request"));
    const route = matched.resource;
    const targets = matched.pattern.exec(url.pathname)?.groups ?? {};
    const targetId = targets.userId;
    if (targetId && !UUID_V4.test(targetId))
      return reply(400, createApiError("invalid_request"));
    if (!matchesRequestOrigin(incoming, origin.origin, "optional"))
      return reply(403, createApiError("request_rejected"));
    const session = readManagement(incoming);
    if ("view" in route && route.view === "current") {
      const principal = session?.principal ?? readPrincipal(incoming);
      if (!principal) return reply(401, createApiError("login_required"));
      const result = readCurrentAccess(root, principal);
      const status =
        result.status === "completed"
          ? 200
          : result.reason === "current_access_authentication_rejected"
            ? 401
            : 503;
      return reply(
        status,
        result.status === "completed" && session
          ? {
              ...result,
              formToken: session.formToken,
              management: describeManagementPermissions(result.user.role),
            }
          : result,
      );
    }
    if (!session)
      return reply(401, createApiError("management_session_required"));
    const { principal } = session;
    if ("view" in route) {
      const result =
        route.view === "users"
          ? readManagementUsersForDisplay(root, principal)
          : readManagementState(root, principal, route.view);
      return reply(
        result.status === "completed"
          ? 200
          : result.reason === "management_read_rejected"
            ? 403
            : 503,
        result.status === "completed"
          ? { ...result, formToken: session.formToken }
          : result,
      );
    }
    if (!matchesRequestOrigin(incoming, origin.origin))
      return reply(403, createApiError("request_rejected"));
    if (!hasContentType(incoming, "application/json"))
      return reply(415, createApiError("invalid_content_type"));
    let input: unknown;
    try {
      input = await readJsonRequestBody(incoming, 4_096);
    } catch (error) {
      if (!signal.aborted && !response.destroyed)
        reply(
          requestFailureStatus(error, response),
          createApiError("invalid_request"),
        );
      return;
    }
    if (signal.aborted || response.destroyed) return;
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== route.fields.length + 3 ||
      !route.fields.every((field) => Object.hasOwn(input, field)) ||
      !("formToken" in input) ||
      typeof input.formToken !== "string" ||
      !("expectedRevision" in input) ||
      typeof input.expectedRevision !== "number" ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 1 ||
      !("operationId" in input) ||
      typeof input.operationId !== "string" ||
      !UUID_V4.test(input.operationId)
    )
      return reply(400, createApiError("invalid_request"));
    // 本文の待機中に終了したセッションを使って保存しない。
    const current = readManagement(incoming);
    if (
      !current ||
      current.principal.userId !== principal.userId ||
      current.principal.bindingId !== principal.bindingId ||
      !matchesSecret(current.formToken, session.formToken) ||
      !matchesSecret(input.formToken, current.formToken)
    )
      return reply(401, createApiError("login_required"));
    const publishManagementResult = (
      status: ManagementOperationOutcome["status"],
    ) => {
      if (
        !matchesSecret(readManagement(incoming)?.formToken, current.formToken)
      ) {
        reply(401, createApiError("management_session_required"));
        return false;
      }
      if (status !== "rejected") {
        const { status: binding } = observeSessionBinding(incoming);
        if (binding !== "completed") {
          reply(
            binding === "rejected" ? 401 : 503,
            createApiError("management_result_unavailable"),
          );
          return false;
        }
      }
      return true;
    };
    if (route.operation === "registerRepository") {
      if (!gitHostingEnabled)
        return reply(403, createApiError("git_host_connection_required"));
      if (
        !("repositoryId" in input) ||
        typeof input.repositoryId !== "string" ||
        !RESOURCE_ID.test(input.repositoryId) ||
        !("directory" in input) ||
        typeof input.directory !== "string"
      )
        return reply(400, createApiError("invalid_request"));
      const result = await registerGitHostLinkedRepository(
        root,
        current.principal,
        {
          repositoryId: input.repositoryId,
          directory: input.directory,
          expectedRevision: input.expectedRevision,
          operationId: input.operationId,
        },
        current.readGitHost,
        current.readHostToken,
        () => {
          const fresh = readManagement(incoming);
          return matchesSecret(fresh?.formToken, current.formToken);
        },
        signal,
        repositoryScope,
      );
      if (signal.aborted || response.destroyed) return;
      if (!publishManagementResult(result.status)) return;
      return reply(managementWriteStatus(result, 201), result);
    }
    if (route.operation !== "invite" && route.operation !== "renew") {
      const result = executeManagementOperation(
        { root, principal: current.principal },
        route.operation,
        { ...input, ...targets },
        input.expectedRevision,
        input.operationId,
      );
      if (signal.aborted || response.destroyed) return;
      // 自己降格も変更前のRoleで成立する。セッションの喪失と新Roleは別扱い。
      if (!publishManagementResult(result.status)) return;
      return reply(managementWriteStatus(result, 200), result);
    }
    const target = targetId
      ? { userId: targetId }
      : "username" in input &&
          typeof input.username === "string" &&
          "role" in input &&
          typeof input.role === "string"
        ? { username: input.username, role: input.role }
        : null;
    if (!target || !("email" in input) || typeof input.email !== "string")
      return reply(400, createApiError("invalid_request"));
    const { result, invitation } = issueUserInvitation(
      root,
      current.principal,
      {
        ...target,
        email: input.email,
        expectedRevision: input.expectedRevision,
        operationId: input.operationId,
      },
    );
    if (signal.aborted || response.destroyed) return;
    if (!invitation) {
      if (
        result.reason === "management_revision_conflict" &&
        !publishManagementResult(result.status)
      )
        return;
      return reply(managementWriteStatus(result, 201), result);
    }
    const inviteUrl = new URL("/", origin);
    inviteUrl.hash = `invite=${invitation.token}`;
    return reply(201, {
      result,
      invitation: { url: inviteUrl.href, expiresAt: invitation.expiresAt },
    });
  };
}

// HTTP受信上限は内部State容量と分離し、従来の受信量を維持する。
const MAXIMUM_EXECUTION_REQUEST_BYTES = 3 * 16 * 1024 * 1024 + 16384;
const executionDefinitionPatterns = Object.entries(
  executionDefinitionResources,
).map(([operation, { method, path }]) => ({
  operation,
  method,
  pattern: new RegExp(
    `^${path.replace(/:(\w+)/gu, `(?<$1>${RESOURCE_ID_SOURCE})`)}$`,
    "u",
  ),
}));

/**
 * 定義照会又は明示保存を同じDomain操作へ一度だけ配送する。
 * @responsibility 保存不明を無保存へ変換せず、既知結果と現在公開認可を分ける。
 * @trace ARCH-000012
 * @input メソッドとパスで指定された対象、同一オリジンのJSON、現在の接続資格。
 * @returns 当該応答又は開始済み同期保存の終了まで待機する。
 * @precondition 起動時に確定したリポジトリまたは共有の管理領域を使う。
 * @postcondition 定義操作だけを許し、受付・承認・実行は発行しない。
 * @effect 明示した変更操作だけが既存Domain Writerで保存する。
 * @failure 閉入力400、認可やオリジン403、形式415、処置後の結果搬送不能503。再送しない。
 * @invariant Domain自身の検査・CAS・対象Hashを省略しない。
 * @boundary WorkbenchとCore定義のOwner。
 * @security Host Path・Error本文・Credentialを公開しない。
 * @concurrency 要求内認可だけを保持し、待機後に再確認する。
 */
export function createExecutionDefinitionHandler({
  getOrigin,
  capability,
  accessRoot,
  readGitHostLinkedSession,
}: Readonly<{
  getOrigin: () => URL | null;
  capability: Repository;
  accessRoot: FilesystemStoreRoot | undefined;
  readGitHostLinkedSession:
    | ((request: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}>) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = createJsonReply(response);
    const alive = () => !signal.aborted && !response.destroyed;
    if (!alive()) return;
    const origin = getOrigin();
    if (!origin)
      return reply(503, createApiError("execution_definition_unavailable"));
    if (
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, createApiError("request_rejected"));
    const url = new URL(incoming.url ?? "/", origin);
    const route = executionDefinitionPatterns.find(
      ({ method, pattern }) =>
        readRouteMethod(incoming.method)?.toLowerCase() === method &&
        pattern.test(url.pathname),
    );
    const ids = route?.pattern.exec(url.pathname)?.groups;
    if (!route || !ids?.repositoryId || !ids.projectId || !ids.milestoneId)
      return reply(400, createApiError("invalid_request"));
    const { repositoryId, ...target } = ids;
    const write = route.method !== "get";
    const hosted = accessRoot ? readGitHostLinkedSession?.(incoming) : null;
    if (accessRoot && !hosted)
      return reply(403, createApiError("execution_definition_unavailable"));
    let input: Record<string, unknown>;
    if (write) {
      if (url.search || !matchesRequestOrigin(incoming, origin.origin))
        return reply(403, createApiError("request_rejected"));
      if (!hasContentType(incoming, "application/json"))
        return reply(415, createApiError("invalid_content_type"));
      if (
        accessRoot &&
        hosted &&
        readCurrentAccess(accessRoot, hosted.principal).status !== "completed"
      )
        return reply(403, createApiError("execution_definition_unavailable"));
      try {
        const body = await readJsonRequestBody(
          incoming,
          MAXIMUM_EXECUTION_REQUEST_BYTES,
        );
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reply(400, createApiError("invalid_request"));
        input = { ...body };
      } catch (error) {
        if (alive()) {
          if (error instanceof RequestBodyTooLarge) {
            response.setHeader("Connection", "close");
            return reply(413, createApiError("request_body_too_large"));
          }
          reply(400, createApiError("invalid_request"));
        }
        return;
      }
    } else {
      if (
        [...url.searchParams.keys()].some(
          (name) =>
            route.operation !== "tasks" ||
            name !== "queueId" ||
            url.searchParams.getAll(name).length !== 1,
        )
      )
        return reply(400, createApiError("invalid_request"));
      input = Object.fromEntries(url.searchParams);
    }
    if (
      [
        "operation",
        "repositoryId",
        "projectId",
        "milestoneId",
        "objectiveId",
        "taskId",
      ].some((name) => Object.hasOwn(input, name))
    )
      return reply(400, createApiError("invalid_request"));
    const command = validateExecutionDefinitionCommand(
      { ...input, ...target, operation: route.operation },
      write ? "write" : "read",
    );
    if (!command) return reply(400, createApiError("invalid_request"));
    let dispatched = false;
    try {
      let access: DefinitionAccess | null = null;
      if (accessRoot) {
        if (hosted) {
          access = await resolveGitHostLinkedDefinitionAccess(
            accessRoot,
            hosted,
            repositoryId,
            write,
            signal,
          );
        }
      } else {
        access = resolveLocalDefinitionAccess(capability, repositoryId, signal);
      }
      if (!alive()) return;
      if (!access)
        return reply(403, createApiError("execution_definition_unavailable"));
      dispatched = true;
      const result = executeDefinitionOperation(access, command);
      if (!alive()) return;
      if (
        !access.revalidate(
          write ? "definition.write" : "definition.read",
          command.input as Parameters<typeof queryPlan>[1],
        )
      )
        return reply(503, createApiError("execution_definition_unavailable"));
      const created =
        route.operation === "initialize" &&
        typeof result === "object" &&
        result !== null &&
        "status" in result &&
        result.status === "saved";
      return reply(created ? 201 : 200, result);
    } catch {
      if (alive())
        return reply(
          dispatched ? 503 : 403,
          createApiError("execution_definition_unavailable"),
        );
    }
  };
}

/**
 * 実行・判断・状態照会をHTTPから共通操作へ渡す。
 * @responsibility 既存HTTPの受付条件と結果のHTTP変換だけを所有する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary HTTPの同一Origin・操作トークンと共通Coordinator操作。
 * @effect 要求が許可された場合だけ既存操作を一回呼ぶ。再送は行わない。
 * @security 共有では当該要求の資格のみを使い、拒否理由に内部対象を含めない。
 */
export async function handleExecution({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  repositoryRoot,
  localAccessRoot,
  readGitHostLinkedSession,
  objectiveRuns,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  repositoryRoot: string;
  localAccessRoot: FilesystemStoreRoot | undefined;
  objectiveRuns?: ObjectiveRuns;
  readGitHostLinkedSession?:
    | ((request: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
}>): Promise<void> {
  const shared = localAccessRoot !== undefined;
  const write =
    incoming.method === "POST"
      ? executionWritePaths.find(({ pattern }) =>
          pattern.test(requestUrl.pathname),
        )
      : undefined;
  const operation: CoordinatorExecutionOperation = write?.operation ?? "state";
  let repositoryId: string | null;
  let args: Readonly<Record<string, unknown>>;
  const fail = (status: number, reason: ExecutionHttpFailureCode) => {
    if (requestSignal.aborted || response.destroyed) return;
    sendResponseBody(
      response,
      "application/json; charset=utf-8",
      JSON.stringify({ status: "blocked", reason }),
      false,
      status,
    );
  };
  if (
    !origin ||
    !matchesRequestHost(incoming, new URL(origin).host) ||
    !matchesRequestOrigin(
      incoming,
      origin,
      incoming.method === "POST" ? "required" : "optional",
    )
  ) {
    fail(403, "execution_access_unavailable");
    return;
  }
  const hosted = shared ? readGitHostLinkedSession?.(incoming) : undefined;
  if (shared && !hosted) {
    fail(403, "execution_access_unavailable");
    return;
  }
  try {
    if (write) {
      const target = write.pattern.exec(requestUrl.pathname)?.groups;
      if (
        !target?.repositoryId ||
        incoming.method !== "POST" ||
        requestUrl.search
      )
        throw new Error("execution_input_invalid");
      if (!matchesActionToken(incoming, actionToken)) {
        fail(403, "execution_access_unavailable");
        return;
      }
      if (!hasContentType(incoming, "application/json")) {
        fail(415, "execution_input_invalid");
        return;
      }
      if (
        localAccessRoot &&
        hosted &&
        readCurrentAccess(localAccessRoot, hosted.principal).status !==
          "completed"
      ) {
        fail(403, "execution_access_unavailable");
        return;
      }
      const body = await readJsonRequestBody(
        incoming,
        MAXIMUM_EXECUTION_REQUEST_BYTES,
      );
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        ["operation", ...Object.keys(target)].some((key) =>
          Object.hasOwn(body, key),
        )
      )
        throw new Error("execution_input_invalid");
      const { repositoryId: targetRepository, ...fields } = target;
      repositoryId = targetRepository;
      args = { ...body, ...fields };
    } else {
      const query = requestUrl.searchParams;
      const target = executionStatePath.exec(requestUrl.pathname)?.groups;
      const fields = ["projectId", "repositoryRevision"];
      if (
        readRouteMethod(incoming.method) !== "GET" ||
        !target?.repositoryId ||
        !target.requestId ||
        [...query.keys()].some(
          (key) => key !== "queueId" && !fields.includes(key),
        ) ||
        fields.some((key) => query.getAll(key).length !== 1) ||
        query.getAll("queueId").length > 1
      )
        throw new Error("execution_input_invalid");
      repositoryId = target.repositoryId;
      args = {
        requestId: target.requestId,
        ...Object.fromEntries(fields.map((key) => [key, query.get(key)])),
      };
      const queueId = query.get("queueId");
      if (queueId !== null) args = { ...args, queueId };
    }
  } catch (error) {
    if (requestSignal.aborted || response.destroyed) return;
    if (error instanceof RequestBodyTooLarge) {
      response.setHeader("Connection", "close");
      fail(413, "request_body_too_large");
    } else fail(400, "execution_input_invalid");
    return;
  }
  const outcome = await executeCoordinatorOperation(
    operation,
    shared ? { ...args, repositoryId } : args,
    localAccessRoot && hosted
      ? {
          scope: "shared",
          ...(objectiveRuns && { objectiveRuns }),
          credentials: { root: localAccessRoot, hosted },
        }
      : {
          scope: "local",
          ...(objectiveRuns && { objectiveRuns }),
          repositoryRoot,
          ...(repositoryId !== null && { repositoryId }),
        },
    requestSignal,
    write?.action,
  );
  if (
    requestSignal.aborted ||
    response.destroyed ||
    outcome.kind === "cancelled"
  )
    return;
  if (outcome.kind === "cancellation_requested") {
    sendResponseBody(
      response,
      "application/json; charset=utf-8",
      JSON.stringify({ status: "cancellation_requested" }),
      false,
      202,
    );
  } else if (outcome.kind === "result") {
    sendResponseBody(
      response,
      "application/json; charset=utf-8",
      JSON.stringify(outcome.value),
      false,
    );
  } else if (outcome.kind === "invalid") fail(400, "execution_input_invalid");
  else if (outcome.kind === "access_denied")
    fail(403, "execution_access_unavailable");
  else if (outcome.kind === "unavailable")
    fail(503, "execution_owner_unavailable");
  else fail(503, "execution_result_unconfirmed");
}
/**
 * 起動済みのAI依頼一件の観測だけを応答する。
 * @trace ARCH-000015
 * @boundary 当該HTTP要求と既存AI依頼Owner。起動・取消・画面構築は実行しない。
 * @security 対象なしと未許可を区別して公開しない。結果は保存せず、取消後は応答しない。
 */
async function sendAiRequestObservation(
  response: ServerResponse,
  signal: AbortSignal,
  method: string,
  observe: () => Promise<ObservedAiSelection | null>,
): Promise<void> {
  if (signal.aborted || response.destroyed) return;
  setResponseHeaders(response);
  if (readRouteMethod(method) !== "GET") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET");
    response.end();
    return;
  }
  response.setHeader("Cache-Control", "no-store");
  let snapshot: AiRequestSnapshot | null;
  try {
    const result = await observe();
    if (signal.aborted || response.destroyed) return;
    snapshot = result?.canPublish() ? result.snapshot : null;
  } catch {
    if (signal.aborted || response.destroyed) return;
    response.statusCode = 503;
    response.end("ai_request_outcome_unconfirmed\n");
    return;
  }
  if (signal.aborted || response.destroyed) return;
  if (snapshot === null) {
    response.statusCode = 403;
    response.end("ai_request_rejected\n");
    return;
  }
  sendResponseBody(
    response,
    "application/json; charset=utf-8",
    JSON.stringify(snapshot),
    method === "HEAD",
  );
}

/** 固定された対象・資格で現在または指定した依頼を観測する。 @trace ARCH-000015 */
export async function handleAiRequestObservation({
  response,
  requestSignal,
  requestUrl,
  method,
  localAccessRoot,
  localRepositoryId,
  openGitHostLinkedAiSession,
  aiRequests,
  presentation,
}: Readonly<{
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  method: string;
  localAccessRoot: FilesystemStoreRoot | undefined;
  localRepositoryId: string | undefined;
  openGitHostLinkedAiSession?:
    | ((
        repositoryId: string,
        operation: AiSessionOperation,
        signal: AbortSignal,
        observedRequestId?: string,
      ) => Promise<AiSession | null>)
    | undefined;
  aiRequests: AiRequests | undefined;
  presentation: Pick<WorkbenchPresentationState, "currentAiRequestId">;
}>): Promise<void> {
  await sendAiRequestObservation(response, requestSignal, method, async () => {
    if (requestUrl.search !== "") return null;
    const current = currentAiRequestPath.exec(requestUrl.pathname)?.groups;
    const target =
      current ?? aiRequestDetailPath.exec(requestUrl.pathname)?.groups;
    const repositoryId = target?.repositoryId;
    if (!repositoryId) return null;
    const session = openGitHostLinkedAiSession
      ? await openGitHostLinkedAiSession(
          repositoryId,
          current ? "view" : "read",
          requestSignal,
          target?.requestId,
        )
      : null;
    const owner = localAccessRoot
      ? session?.owner
      : repositoryId === localRepositoryId
        ? aiRequests
        : undefined;
    const readCurrentId = () =>
      localAccessRoot ? session?.currentId : presentation.currentAiRequestId;
    const requestId = current ? readCurrentId() : target?.requestId;
    if (!owner || !requestId) return null;
    const snapshot = await owner.observe(requestId, requestSignal);
    if (
      snapshot.requestId !== requestId ||
      (!current &&
        (snapshot.mode === null ||
          snapshot.reason === "coordinator_task_not_available"))
    )
      return null;
    return {
      snapshot,
      canPublish: () =>
        (!current || readCurrentId() === requestId) &&
        (!localAccessRoot || session?.authorize() === true),
    };
  });
}

/** 同じAI依頼Ownerへ、開始・現在表示への選択・取消を一回だけ配送する。 @trace ARCH-000015 */
export async function handleAiRequestWrite({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  localAccessRoot,
  localRepositoryId,
  openGitHostLinkedAiSession,
  aiRequests,
  presentation,
}: Parameters<typeof handleAiRequestObservation>[0] &
  Readonly<{
    incoming: IncomingMessage;
    origin: string | null;
    actionToken: string;
    presentation: Pick<
      WorkbenchPresentationState,
      "currentAiRequestId" | "aiRequestSnapshot"
    >;
  }>): Promise<void> {
  let dispatched = false;
  const reply = createJsonReply(response, { signal: requestSignal });
  try {
    const route = aiRequestWritePaths.find(
      ({ method, pattern }) =>
        method.toUpperCase() === incoming.method &&
        pattern.test(requestUrl.pathname),
    );
    const path = route?.pattern.exec(requestUrl.pathname)?.groups;
    const repositoryId = path?.repositoryId;
    if (
      !route ||
      !repositoryId ||
      requestUrl.search ||
      !origin ||
      !matchesRequestOrigin(incoming, origin) ||
      !matchesRequestHost(incoming, new URL(origin).host) ||
      !hasContentType(incoming, "application/json") ||
      !matchesActionToken(incoming, actionToken)
    )
      return reply(400, createApiError("ai_request_rejected"));
    const value = await readJsonRequestBody(incoming, 16 * 1024);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return reply(400, createApiError("ai_request_rejected"));
    const body = value as Record<string, unknown>;
    const { operation } = route;
    let command: Parameters<AiRequests["start"]>[0] | undefined;
    let requestId = path?.requestId;
    if (operation === "start") {
      if (
        Object.keys(body).some(
          (key) =>
            ![
              "requestId",
              "mode",
              "workType",
              "prompt",
              "allowedPaths",
              "workspaceId",
              "choice",
            ].includes(key),
        ) ||
        typeof body.mode !== "string" ||
        typeof body.prompt !== "string" ||
        (body.workType != null && typeof body.workType !== "string") ||
        (body.workspaceId != null && typeof body.workspaceId !== "string") ||
        (body.allowedPaths != null && typeof body.allowedPaths !== "string")
      )
        return reply(400, createApiError("ai_request_rejected"));
      command = prepareAiRequestStart(
        {
          requestId: typeof body.requestId === "string" ? body.requestId : "",
          mode: body.mode,
          prompt: body.prompt,
          workType: body.workType ?? null,
          workspaceId: body.workspaceId ?? null,
          allowedPaths: body.allowedPaths ?? "",
          explicitChoice: body.choice,
        },
        localAccessRoot ? "shared" : "local",
      );
    } else if (operation === "select") {
      if (Object.keys(body).length !== 1 || typeof body.requestId !== "string")
        return reply(400, createApiError("ai_request_rejected"));
      requestId = body.requestId;
    } else if (Object.keys(body).length !== 0) {
      return reply(400, createApiError("ai_request_rejected"));
    }
    if (!RESOURCE_ID.test(command?.requestId ?? requestId ?? ""))
      return reply(400, createApiError("ai_request_rejected"));
    if (requestSignal.aborted || response.destroyed) return;
    const session = openGitHostLinkedAiSession
      ? await openGitHostLinkedAiSession(
          repositoryId,
          command?.mode ?? (operation === "select" ? "select" : "cancel"),
          requestSignal,
        )
      : null;
    const owner = localAccessRoot
      ? session?.owner
      : repositoryId === localRepositoryId
        ? aiRequests
        : undefined;
    if (!owner) return reply(403, createApiError("ai_request_rejected"));
    const isCurrent = () => !localAccessRoot || session?.authorize() === true;
    const select = (id: string, snapshot: AiRequestSnapshot | null) => {
      if (session) session.currentId = id;
      else {
        presentation.currentAiRequestId = id;
        presentation.aiRequestSnapshot = snapshot;
      }
    };
    if (command) {
      dispatched = true;
      const result = await owner.start(command, requestSignal);
      if (!isCurrent())
        return reply(503, createApiError("ai_request_outcome_unconfirmed"));
      if (
        result.status === "accepted" &&
        result.requestId === command.requestId &&
        result.reason === null
      ) {
        // 切断は結果の公開だけを止め、Ownerが受理した同じ依頼の再照会を妨げない。
        select(result.requestId, null);
        return reply(201, result);
      }
      if (
        result.status !== "blocked" ||
        (result.requestId !== null && result.requestId !== command.requestId) ||
        typeof result.reason !== "string" ||
        !result.reason
      )
        return reply(503, createApiError("ai_request_outcome_unconfirmed"));
      return reply(409, result);
    }
    if (!requestId) return reply(400, createApiError("ai_request_rejected"));
    const previous = await owner.observe(requestId, requestSignal);
    if (
      previous.requestId !== requestId ||
      previous.mode === null ||
      previous.reason === "coordinator_task_not_available" ||
      requestSignal.aborted ||
      response.destroyed ||
      !isCurrent()
    )
      return reply(403, createApiError("ai_request_rejected"));
    if (operation === "select") {
      select(requestId, previous);
      return reply(200, previous);
    }
    if (session && previous.mode === "workspace_edit" && !session.canWrite)
      return reply(403, createApiError("ai_request_rejected"));
    dispatched = true;
    const cancelled = await owner.cancel(requestId, requestSignal);
    if (cancelled.requestId !== requestId || !isCurrent())
      return reply(503, createApiError("ai_request_outcome_unconfirmed"));
    const currentId = session
      ? session.currentId
      : presentation.currentAiRequestId;
    if (currentId === null || currentId === requestId)
      select(requestId, cancelled);
    return reply(200, cancelled);
  } catch (error) {
    if (
      !requestSignal.aborted &&
      !response.destroyed &&
      error instanceof RequestBodyTooLarge
    )
      return reply(
        requestFailureStatus(error, response),
        createApiError("request_body_too_large"),
      );
    return dispatched
      ? reply(503, createApiError("ai_request_outcome_unconfirmed"))
      : reply(400, createApiError("ai_request_rejected"));
  }
}
/**
 * 現在設定の取得又は一回のCAS保存を処理する。
 * @responsibility 入力拒否・既知保存・不明な出版と取消を混同しない。
 * @trace ARCH-000012
 * @input 検査済み前段の要求・応答・Origin・Token・Root・現在資格。
 * @returns 応答又は取消後の保存Owner終了まで待つPromise。
 * @precondition 既存HTTP前段とBody上限を維持する。
 * @postcondition 公開前に現在認可を再確認する。
 * @effect GET／HEADは読取りのみ、PUTは設定Ownerへ一回だけ保存を委譲する。
 * @failure 処置前拒否400、配送後応答不明503。自動再送なし。
 * @invariant 設定欠測を既定Modelで補完しない。
 * @boundary Browser HTTPとRepository設定正本。
 * @security 秘密値・Path・任意CLIを受け取らない。
 * @concurrency 同じSignalと同期保存の終了を維持する。
 */
export async function handleAiSelection({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  capability,
  localAccessRoot,
  localRepositoryId,
  readGitHostLinkedSession,
  readManagementSession,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  capability: Repository;
  localAccessRoot: FilesystemStoreRoot | undefined;
  localRepositoryId: string | undefined;
  readGitHostLinkedSession:
    | ClientSessionAccess["readGitHostLinkedAccessSession"]
    | undefined;
  readManagementSession: ClientSessionAccess["readManagement"] | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    const write = incoming.method === "PUT";
    const repositoryId = aiSelectionPath.exec(requestUrl.pathname)?.groups
      ?.repositoryId;
    if (!repositoryId || requestUrl.search !== "")
      throw new Error("ai_selection_input_invalid");
    const session = readGitHostLinkedSession?.(incoming) ?? null;
    const management = write ? readManagementSession?.(incoming) : undefined;
    if (
      localAccessRoot !== undefined &&
      (!session ||
        (write &&
          (!management ||
            management.principal.userId !== session.principal.userId ||
            management.principal.bindingId !== session.principal.bindingId)))
    )
      throw new Error("ai_selection_access_unavailable");
    let submission: Readonly<{
      expectedIdentity: string | null;
      config: unknown;
    }> | null = null;
    if (write) {
      if (
        !origin ||
        !matchesRequestHost(incoming, new URL(origin).host) ||
        !matchesRequestOrigin(incoming, origin) ||
        !hasContentType(incoming, "application/json") ||
        !matchesActionToken(incoming, actionToken)
      )
        throw new Error("ai_selection_input_invalid");
      const json = await readJsonRequestBody(
        incoming,
        3 * 1_024 * 1_024 + 16 * 1_024,
      );
      if (
        !json ||
        typeof json !== "object" ||
        Array.isArray(json) ||
        Object.keys(json).length !== 2 ||
        !Object.hasOwn(json, "config") ||
        !Object.hasOwn(json, "expectedIdentity")
      )
        throw new Error("ai_selection_input_invalid");
      const { expectedIdentity, config } = json as Record<string, unknown>;
      if (
        config === null ||
        (expectedIdentity !== null &&
          (typeof expectedIdentity !== "string" ||
            !/^[a-f0-9]{64}$/u.test(expectedIdentity)))
      )
        throw new Error("ai_selection_input_invalid");
      submission = { expectedIdentity, config };
    }
    await setTimeout(0);
    if (requestSignal.aborted || response.destroyed) return;
    const access = await resolveAiSelectionAccess(
      capability,
      localAccessRoot,
      repositoryId,
      localRepositoryId,
      requestSignal,
      readGitHostLinkedSession && {
        session,
        confirmManagement: management
          ? () =>
              matchesSecret(
                readManagementSession?.(incoming)?.formToken,
                management.formToken,
              )
          : null,
      },
    );
    if (!access.authorize()) throw new Error("ai_selection_access_unavailable");
    let result: AiSelectionReadResult | AiSelectionSaveResult;
    let writeRepository: Repository | null = null;
    if (submission) {
      const verification = getRepository(access.repositoryRoot);
      if (verification.status !== "completed")
        throw new Error("ai_selection_access_unavailable");
      writeRepository = verification.capability;
      dispatched = true;
      result = updateAiSelection(
        access,
        writeRepository,
        submission,
        getModelCatalog().catalog,
      );
    } else
      result = readRepositoryAiSelection(
        access.repositoryRoot,
        getModelCatalog().catalog,
      );
    const body = JSON.stringify(result);
    await setTimeout(0);
    if (requestSignal.aborted || response.destroyed) return;
    if (!access.authorize(writeRepository ?? undefined))
      throw new Error("ai_selection_access_unavailable");
    sendResponseBody(
      response,
      "application/json; charset=utf-8",
      body,
      incoming.method === "HEAD",
      result.status === "conflict" ? 409 : 200,
    );
  } catch (error) {
    if (requestSignal.aborted || response.destroyed) return;
    if (error instanceof RequestBodyTooLarge) {
      response.setHeader("Connection", "close");
      return sendResponseBody(
        response,
        "application/json; charset=utf-8",
        JSON.stringify(createApiError("request_body_too_large")),
        false,
        413,
      );
    }
    setResponseHeaders(response);
    response.statusCode = dispatched
      ? 503
      : incoming.method === "PUT"
        ? 400
        : 403;
    response.end(
      dispatched
        ? "ai_selection_outcome_unconfirmed\n"
        : "ai_selection_request_rejected\n",
    );
  }
}

/**
 * 単体表示・固定配信を元のGET／HEAD契約で処理する。
 * @responsibility Owner観測・表示構築・応答の順序と現在状態の参照を維持する。
 * @trace ARCH-000012
 * @input 当該要求の応答・Signal・URL、既存の表示値・Owner・設定と読取り済みAsset。
 * @returns 表示処理と当該Ownerの終了を待つPromise。
 * @precondition 共通Origin・Artifact Query・接続形態ごとの前段を元の順序で実行済みである。
 * @postcondition 操作の成否は操作の応答で伝え、表示要求では消費しない。
 * @effect 既存Reader・AI Ownerの観測とHTTP応答。
 * @failure 元の拒否・観測不能・例外を維持し、資格や自由なError本文を公開しない。
 * @invariant 観測不能を正常空へ補完せず、結果不明から再送やrollbackを推定しない。
 * @boundary Workbench HTTPから既存の表示・観測Ownerへの接続。
 * @security 現在認可の読取り時点と公開前照合を維持し、起動Rootへ権限を補完しない。
 * @concurrency 同じ要求Signalと終了Promiseを維持し、await後は現在の設定・状態を同じ参照から読む。
 */
export async function handleRepositoryView({
  response,
  requestSignal,
  method,
  requestUrl,
  requestPath,
  repositoryRoot,
  capability,
  topicMeeting,
  portfolio,
  connectionState,
  presentation: currentPresentation,
  aiRequests,
  actionToken,
  configuration,
  assets,
  contract: CONTRACT,
  host: HOST,
  healthPath: HEALTH_PATH,
}: Readonly<{
  response: ServerResponse;
  requestSignal: AbortSignal;
  method: string;
  requestUrl: URL;
  requestPath: string;
  repositoryRoot: string;
  capability: Repository;
  topicMeeting: TopicMeetingAccess | undefined;
  portfolio: PortfolioProjection | undefined;
  connectionState: WorkbenchConnectionState;
  presentation: WorkbenchPresentationState;
  aiRequests: AiRequests | undefined;
  actionToken: string;
  configuration: Readonly<{ localAccessRoot?: FilesystemStoreRoot }>;
  assets: WorkbenchAssets;
  contract: string;
  host: string;
  healthPath: string;
}>): Promise<void> {
  const staticAsset = readStaticAsset(requestPath, assets);
  const presentation =
    method === "HEAD" ? { ...currentPresentation } : currentPresentation;
  let body: string | Buffer;
  let contentType: string;
  if (presentation.projectSurface === undefined || topicMeeting === undefined)
    throw new Error("workbench_repository_access_unavailable");
  if (
    requestPath === "/" ||
    requestPath === "/index.html" ||
    requestPath === "/api/workbench/overview"
  ) {
    // 更新印はサーバー内の投影キャッシュを更新するためのもの。利用者向け通知ではない。
    // 並行GETは同じ更新を観測でき、後から立った別の印は先行GETで消さない。
    const pendingRecordRefresh = presentation.pendingRecordRefresh;
    let currentProjectSurface = presentation.projectSurface;
    if (pendingRecordRefresh !== undefined) {
      currentProjectSurface = await readProjectViewData(repositoryRoot);
      if (requestSignal.aborted || response.destroyed) return;
      if (presentation.pendingRecordRefresh === pendingRecordRefresh) {
        presentation.projectSurface = currentProjectSurface;
        delete presentation.pendingRecordRefresh;
      }
    }
    if (aiRequests !== undefined && presentation.currentAiRequestId !== null) {
      try {
        presentation.aiRequestSnapshot = await aiRequests.observe(
          presentation.currentAiRequestId,
        );
      } catch {
        presentation.aiRequestSnapshot = Object.freeze({
          requestId: presentation.currentAiRequestId,
          mode: presentation.aiRequestSnapshot?.mode ?? "read_only_advice",
          executionSelection:
            presentation.aiRequestSnapshot?.executionSelection ?? null,
          status: "unknown",
          resultAvailable: false,
          reason: "observation_failed",
          facts: Object.freeze([]),
          sharedAnalysis: Object.freeze([]),
          additionalInferences: Object.freeze([]),
          nextOptions: Object.freeze([]),
          candidate: null,
        });
      }
    }
    const selectedRepositoryId = undefined;
    const { topicPage, topicQuery, meetingPage, meetingQuery, reader } =
      readRecordPages(topicMeeting, requestUrl.searchParams);
    presentation.aiSelection = readAiSelectionView(repositoryRoot);
    const baseModel = readMainViewData(
      currentProjectSurface,
      portfolio !== undefined,
      actionToken,
      connectionState,
      reader,
      topicPage,
      topicQuery,
      meetingPage,
      meetingQuery,
      presentation.aiSelection,
      readRepositoryAiSelection(
        resolveVerifiedRepositoryRoot(capability),
        getModelCatalog().catalog,
      ).snapshot ?? undefined,
      true,
      aiRequests,
      presentation.aiRequestSnapshot,
      selectedRepositoryId,
    );
    let network = null;
    if (aiRequests !== undefined) {
      const owner = await import("@qual-lab/crdd-coordinator");
      if (requestSignal.aborted || response.destroyed) return;
      if (resolveVerifiedRepositoryRoot(capability) !== repositoryRoot)
        throw new Error("workbench_repository_unavailable");
      network = owner.readRepositoryNetworkHosts(capability);
    }
    const clientModel = {
      ...baseModel,
      aiRequest: {
        ...baseModel.aiRequest,
        additionalHosts:
          network?.status === "ready" ? network.additionalHosts : null,
      },
    };
    body =
      requestPath === "/api/workbench/overview"
        ? JSON.stringify(clientModel)
        : assets.document;
    contentType =
      requestPath === "/api/workbench/overview"
        ? "application/json; charset=utf-8"
        : "text/html; charset=utf-8";
  } else if (
    requestPath === "/project" ||
    requestPath === "/topic" ||
    requestPath === "/meeting"
  ) {
    body = assets.document;
    contentType = "text/html; charset=utf-8";
  } else if (requestPath === "/change") {
    body = assets.document;
    contentType = "text/html; charset=utf-8";
  } else if (requestPath === "/owner-artifact") {
    body = assets.document;
    contentType = "text/html; charset=utf-8";
  } else if (staticAsset !== null) {
    body = staticAsset.body;
    contentType = staticAsset.contentType;
  } else if (requestPath === HEALTH_PATH) {
    body = JSON.stringify({
      contract: CONTRACT,
      status: "ready",
      host: HOST,
      mode: configuration.localAccessRoot === undefined ? "repository" : "cros",
      ...(connectionState === "repository" ? {} : { connectionState }),
      readOnly: false,
    });
    contentType = "application/json; charset=utf-8";
  } else {
    setResponseHeaders(response);
    response.statusCode = 404;
    response.end(method === "HEAD" ? undefined : "not_found\n");
    return;
  }
  sendResponseBody(response, contentType, body, method === "HEAD");
}

/**
 * 共有表示を処理し、未処理の場合だけ元の受付へ返す。
 * @responsibility 既存の現在集合・本文・活動・AI観測と公開前認可の順序を維持する。
 * @trace ARCH-000012
 * @input 当該要求の応答・Signal・URL、既存の表示値・Owner・設定と読取り済みAsset。
 * @returns 応答済みまたは取消・切断終了ならtrue、未知Pathで未処理ならfalse。
 * @precondition 共通Origin・Artifact Query・接続形態ごとの前段を元の順序で実行済みである。
 * @postcondition 未知Pathは元の共有Allowlistへ戻し、正常表示や404へ置換しない。
 * @effect 既存Reader・AI Ownerの観測とHTTP応答。単体表示の通知は消費しない。
 * @failure 元の拒否・観測不能・例外を維持し、資格や自由なError本文を公開しない。
 * @invariant 観測不能を正常空へ補完せず、結果不明から再送やrollbackを推定しない。
 * @boundary Workbench HTTPから既存の表示・観測Ownerへの接続。
 * @security 現在認可の読取り時点と公開前照合を維持し、起動Rootへ権限を補完しない。
 * @concurrency 同じ要求Signalと終了Promiseを維持し、await後は現在の設定・状態を同じ参照から読む。
 */
export async function handleSharedView({
  response,
  requestSignal,
  method,
  requestUrl,
  requestPath,
  shared,
  loginProviders,
  actionToken,
  configuration,
  observeGitHostLinkedAiSelection,
  assets,
  contract: CONTRACT,
  host: HOST,
  healthPath: HEALTH_PATH,
}: Readonly<{
  response: ServerResponse;
  requestSignal: AbortSignal;
  method: string;
  requestUrl: URL;
  requestPath: string;
  shared?:
    | Readonly<{
        root: FilesystemStoreRoot;
        session: GitHostLinkedAccessSession;
        hasManagementSession: () => boolean;
      }>
    | undefined;
  loginProviders?: readonly PublicLoginProvider[] | undefined;
  actionToken: string;
  configuration: Readonly<{
    sharedAiRequestsFactory?: unknown;
  }>;
  observeGitHostLinkedAiSelection?:
    | ((
        session: GitHostLinkedAccessSession,
        target: AuthorizedRepository,
        signal: AbortSignal,
      ) => Promise<ObservedAiSelection | null>)
    | undefined;
  assets: WorkbenchAssets;
  contract: string;
  host: string;
  healthPath: string;
}>): Promise<boolean> {
  const staticAsset = readStaticAsset(requestPath, assets);
  let localBody: string | Buffer | undefined;
  let localContentType = "text/html; charset=utf-8";
  if (
    requestPath === "/" ||
    requestPath === "/index.html" ||
    requestPath === "/project" ||
    requestPath === "/topic" ||
    requestPath === "/meeting" ||
    requestPath === "/change" ||
    requestPath === "/owner-artifact" ||
    requestPath === "/api/workbench/overview"
  ) {
    const selectedId =
      requestPath === "/api/workbench/overview"
        ? requestUrl.searchParams.get("repositoryId") || null
        : null;
    const unavailable = () => {
      setResponseHeaders(response);
      response.statusCode = 403;
      response.end(
        method === "HEAD" ? undefined : "local_repository_access_unavailable\n",
      );
    };
    if (selectedId && !RESOURCE_ID.test(selectedId)) {
      unavailable();
      return true;
    }
    let hosted: GitHostLinkedRepositoryAccess | null = null;
    let repositories: readonly AuthorizedRepository[] = [];
    const requireCurrentGitHostLinked = (reuseOriginConfiguration = false) => {
      if (!hosted) return;
      for (const repository of hosted.repositories) {
        hosted.assertDirectory(repository);
        if (observeAuthorizedManifest(repository) !== "current")
          throw new Error("workbench_selected_content_unavailable");
      }
      hosted.assertCurrent(hosted.repositories, reuseOriginConfiguration);
    };
    if (requestPath === "/api/workbench/overview" && selectedId === null) {
      const authenticated = shared
        ? readBrowserAuthentication(shared.root, shared.session)
        : false;
      if (authenticated === null) {
        createJsonReply(response, {
          signal: requestSignal,
          head: method === "HEAD",
        })(503, createApiError("workbench_context_unavailable"));
        return true;
      }
      localBody = JSON.stringify(
        createAccessViewResponse(actionToken, authenticated, loginProviders),
      );
    }
    if (shared && selectedId !== null) {
      try {
        const access = await resolveGitHostLinkedRepositories(
          shared.root,
          shared.session,
          requestSignal,
          selectedId,
          "read",
          { captureOriginConfiguration: true },
        );
        hosted = access;
        if (!access) throw new Error("workbench_selected_content_unavailable");
        repositories = access.repositories;
      } catch {
        if (!requestSignal.aborted && !response.destroyed) unavailable();
        return true;
      }
    }
    let selectedAi: ObservedAiSelection | null = null;
    let model: MainViewResponse | undefined;
    if (
      requestPath === "/api/workbench/overview" &&
      selectedId !== null &&
      selectedId !== ""
    ) {
      try {
        if (!shared || !hosted)
          throw new Error("workbench_selected_content_unavailable");
        const selected =
          repositories.find((entry) => entry.repositoryId === selectedId) ??
          null;
        const records = resolveTopicMeetingAccess(
          repositories,
          selectedId,
          requestSignal,
          "workbench_local_records_unavailable",
        );
        if (!selected || !records)
          throw new Error("workbench_selected_content_unavailable");
        requireCurrentGitHostLinked(true);
        const write = hosted.canWrite(selectedId);
        const root = selected.root;
        const verification = getRepository(root);
        if (verification.status !== "completed")
          throw new Error("workbench_selected_content_unavailable");
        const assertReadable = () => {
          if (requestSignal.aborted || response.destroyed)
            throw new Error("workbench_selected_content_unavailable");
          hosted.assertDirectory(selected);
        };
        const assertCurrentReadAccess = () => {
          if (requestSignal.aborted || response.destroyed)
            throw new Error("workbench_selected_content_unavailable");
          requireCurrentGitHostLinked(true);
        };
        const projectData = await readProjectViewData(
          root,
          assertReadable,
          assertCurrentReadAccess,
        );
        if (requestSignal.aborted || response.destroyed) return true;
        assertReadable();
        if (
          projectData.context.repositoryId !== selected.repositoryId ||
          projectData.context.projectId !== selected.manifest.projectId
        )
          throw new Error("workbench_selected_content_unavailable");
        // 文書群の完了待ちと、記録ページでの新しい読取りは別の境界。
        assertCurrentReadAccess();
        const { topicPage, topicQuery, meetingPage, meetingQuery, reader } =
          readRecordPages(records, requestUrl.searchParams);
        await setTimeout(0);
        if (requestSignal.aborted || response.destroyed) return true;
        assertCurrentReadAccess();
        selectedAi =
          (await observeGitHostLinkedAiSelection?.(
            shared.session,
            selected,
            requestSignal,
          )) ?? null;
        if (requestSignal.aborted || response.destroyed) return true;
        assertCurrentReadAccess();
        const sharedSelection = canManageAiSelection(
          shared.root,
          shared.session,
        )
          ? readAiSelectionView(selected.root)
          : null;
        const canManageSelection =
          sharedSelection !== null && write && shared.hasManagementSession();
        model = readMainViewData(
          projectData,
          true,
          actionToken,
          "cros_available",
          reader,
          topicPage,
          topicQuery,
          meetingPage,
          meetingQuery,
          null,
          undefined,
          false,
          undefined,
          null,
          selectedId,
          write,
          write ? ["prepare", "unprepare"] : [],
        );
        if (requestSignal.aborted || response.destroyed) return true;
        model = {
          ...model,
          workspaceAccess: write ? "write" : "read",
          aiSelection: sharedSelection,
          aiSelectionManagement: {
            snapshot: canManageSelection
              ? (sharedSelection?.selection.snapshot ?? null)
              : null,
            allowed: canManageSelection,
            result: null,
          },
          aiRequest: {
            additionalHosts: null,
            configured: configuration.sharedAiRequestsFactory !== undefined,
            snapshot: null,
            notice: null,
          },
        };
        if (resolveVerifiedRepositoryRoot(verification.capability) !== root)
          throw new Error("workbench_selected_content_unavailable");
      } catch {
        if (requestSignal.aborted || response.destroyed) return true;
        setResponseHeaders(response);
        response.statusCode = 403;
        response.end("local_repository_access_unavailable\n");
        return true;
      }
    }
    if (requestSignal.aborted || response.destroyed) return true;
    if (requestPath === "/api/workbench/overview") {
      try {
        requireCurrentGitHostLinked();
        if (selectedAi?.canPublish() && model)
          model = {
            ...model,
            aiRequest: { ...model.aiRequest, snapshot: selectedAi.snapshot },
          };
      } catch {
        if (!requestSignal.aborted && !response.destroyed) unavailable();
        return true;
      }
      if (model) localBody = JSON.stringify(model);
    } else {
      localBody = assets.document;
    }
    if (requestPath === "/api/workbench/overview")
      localContentType = "application/json; charset=utf-8";
  } else if (staticAsset !== null) {
    localBody = staticAsset.body;
    localContentType = staticAsset.contentType;
  } else if (requestPath === HEALTH_PATH) {
    localBody = JSON.stringify({
      contract: CONTRACT,
      status: "ready",
      host: HOST,
      mode: "shared",
      readOnly: false,
    });
    localContentType = "application/json; charset=utf-8";
  }
  if (localBody !== undefined) {
    if (requestSignal.aborted || response.destroyed) return true;
    sendResponseBody(response, localContentType, localBody, method === "HEAD");
    return true;
  }
  return false;
}

/** JSON本体からは各リソース固有の値だけを取り、URLの操作・IDを上書きさせない。 */
export function readRepositoryWrite(
  method: string,
  path: string,
  value: unknown,
): Readonly<{ repositoryId: string; request: RepositoryActionRequest }> {
  const matched = matchRepositoryWrite(method, path);
  if (!matched || !value || typeof value !== "object" || Array.isArray(value))
    throw new Error("repository_action_input_invalid");
  const { operation, repositoryId, revision } = matched;
  const fields: readonly string[] =
    operation === "prepare" || operation === "unprepare"
      ? ["path"]
      : operation === "create_revision"
        ? ["message"]
        : ["destination", "branch", "humanConfirmed"];
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== fields.length)
    throw new Error("repository_action_input_invalid");
  for (const field of fields) {
    if (!Object.hasOwn(body, field))
      throw new Error("repository_action_input_invalid");
    const fieldValue = body[field];
    if (
      field === "humanConfirmed"
        ? fieldValue !== true
        : typeof fieldValue !== "string"
    )
      throw new Error("repository_action_input_invalid");
  }
  let request: RepositoryActionRequest;
  if (operation === "prepare" || operation === "unprepare") {
    const selectedPath = body.path;
    if (
      typeof selectedPath !== "string" ||
      selectedPath.length === 0 ||
      selectedPath.length > 4096 ||
      selectedPath.startsWith("-") ||
      selectedPath.startsWith("/") ||
      selectedPath.includes("\\") ||
      /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(selectedPath) ||
      /[\u0000-\u001f\u007f]/u.test(selectedPath) ||
      selectedPath
        .split("/")
        .some((part) => part === "" || part === "." || part === "..")
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({
      operation,
      paths: Object.freeze([selectedPath]),
    });
  } else if (operation === "create_revision") {
    const message = body.message;
    if (
      typeof message !== "string" ||
      message.trim().length === 0 ||
      message.length > 4096 ||
      /[\u0000\u007f]/u.test(message)
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({ operation, message });
  } else {
    const { destination, branch } = body;
    if (
      !revision ||
      typeof destination !== "string" ||
      typeof branch !== "string" ||
      [destination, branch].some(
        (value) =>
          value.length === 0 ||
          value.length > 4096 ||
          value.startsWith("-") ||
          /[\u0000-\u0020\u007f]/u.test(value),
      )
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({
      operation,
      destination,
      branch,
      revisionIdentity: revision,
      humanConfirmed: true,
    });
  }
  return { repositoryId, request };
}

/**
 * 当該要求のRepository操作を実行する。
 * @responsibility 共有のfresh認可と単体の現在Tree操作を区別し、公開前再確認と投影更新を維持する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 当該HTTP要求、応答、Signal、検査済みURLとOrigin、既存Ownerと必要な表示状態。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、共有操作の現在認可は本処理で確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect Git処置を既存Version Controlへ一回配送し、必要な表示投影を更新する。
 * @failure 共有は配送前400／配送後503、単体は既存400を維持する。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleRepositoryAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  localAccessRoot,
  readGitHostLinkedSession,
  localRepositoryId,
  repositoryRoot,
  capability,
  presentation,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  localAccessRoot: FilesystemStoreRoot | undefined;
  readGitHostLinkedSession:
    | ((request: IncomingMessage) => GitHostLinkedAccessSession | null)
    | undefined;
  localRepositoryId: string | undefined;
  repositoryRoot: string;
  capability: Repository;
  presentation: Pick<WorkbenchPresentationState, "projectSurface">;
}>): Promise<void> {
  let input: ReturnType<typeof readRepositoryWrite>;
  try {
    if (
      !origin ||
      requestUrl.search ||
      !matchesRequestHost(incoming, new URL(origin).host) ||
      !matchesRequestOrigin(incoming, origin) ||
      !hasContentType(incoming, "application/json") ||
      !matchesActionToken(incoming, actionToken)
    )
      throw new Error("repository_action_input_invalid");
    input = readRepositoryWrite(
      incoming.method ?? "",
      requestUrl.pathname,
      await readJsonRequestBody(incoming, 16 * 1024),
    );
    if (requestSignal.aborted || response.destroyed) return;
  } catch (error) {
    if (!requestSignal.aborted && !response.destroyed) {
      setResponseHeaders(response);
      response.statusCode = requestFailureStatus(error, response);
      response.end("repository_action_rejected\n");
    }
    return;
  }
  if (localAccessRoot !== undefined) {
    let dispatched = false;
    try {
      const session = readGitHostLinkedSession?.(incoming);
      // 共有のインデックス変更はCookieで確認した本人の現在書込み権限に限る。
      if (
        !session ||
        (input.request.operation !== "prepare" &&
          input.request.operation !== "unprepare")
      )
        throw new Error("workbench_repository_access_unavailable");
      const access = await resolveGitHostLinkedDevelopmentAccess(
        localAccessRoot,
        session,
        input.repositoryId,
        true,
        requestSignal,
      );
      if (!access) throw new Error("workbench_repository_access_unavailable");
      await setTimeout(0);
      if (requestSignal.aborted || response.destroyed) return;
      const verification = getRepository(access.ownerRoot);
      if (verification.status !== "completed" || !access.authorize())
        throw new Error("workbench_repository_access_unavailable");
      assertRepositoryActionTarget(verification.capability, input.request);
      if (requestSignal.aborted || response.destroyed) return;
      dispatched = true;
      const result = inspectRepositoryActionResult(
        input.request,
        executeRepositoryAction(verification.capability, input.request),
      );
      const body = JSON.stringify(result);
      await setTimeout(0);
      if (requestSignal.aborted || response.destroyed) return;
      if (
        resolveVerifiedRepositoryRoot(verification.capability) !==
          access.ownerRoot ||
        !access.authorize()
      )
        throw new Error("workbench_repository_publication_unavailable");
      sendResponseBody(response, "application/json; charset=utf-8", body);
    } catch {
      if (!requestSignal.aborted && !response.destroyed) {
        setResponseHeaders(response);
        response.statusCode = dispatched ? 503 : 400;
        response.end(
          dispatched
            ? "repository_action_outcome_unconfirmed\n"
            : "repository_action_rejected\n",
        );
      }
    }
    return;
  }
  if (presentation.projectSurface === undefined)
    throw new Error("workbench_repository_access_unavailable");
  let dispatched = false;
  try {
    if (input.repositoryId !== localRepositoryId)
      throw new Error("workbench_repository_access_unavailable");
    const { request } = input;
    assertRepositoryActionTarget(capability, request);
    if (requestSignal.aborted || response.destroyed) return;
    dispatched = true;
    const rawResult = executeRepositoryAction(capability, request);
    try {
      presentation.projectSurface = await readProjectViewData(repositoryRoot);
    } catch {
      presentation.projectSurface = withUnknownRepositoryObservation(
        presentation.projectSurface,
      );
    }
    if (requestSignal.aborted || response.destroyed) return;
    sendResponseBody(
      response,
      "application/json; charset=utf-8",
      JSON.stringify(inspectRepositoryActionResult(request, rawResult)),
    );
  } catch {
    if (requestSignal.aborted || response.destroyed) return;
    setResponseHeaders(response);
    response.statusCode = dispatched ? 503 : 400;
    response.end(
      dispatched
        ? "repository_action_outcome_unconfirmed\n"
        : "repository_action_rejected\n",
    );
  }
  return;
}

/**
 * 本番Readerを同じ位置で呼び、主画面の非秘密Modelを構築する。
 * @responsibility Record本文・Relationと観測済みの表示状態を結合する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 既存のProject投影、ページ・検索条件、表示用Owner／結果。
 * @returns 現行の固定契約に従う主画面Model。
 * @precondition 呼出し側が対象Repositoryの入力・現在認可を検査する。
 * @effect Record Readerの既存観測を実行する。
 * @failure Reader例外を呼出し側へ伝播する。
 * @invariant Snapshotを認可根拠へ昇格せず、観測結果を別要求へcacheしない。
 * @boundary 本番ReaderとBrowserへの表示Model。
 * @security 資格・内部保存情報・Root AuthorityをModelへ追加しない。
 * @concurrency 同じ引数の読取り順を維持し、先行観測や並列化を追加しない。
 */
function readMainViewData(
  projectData: ProjectViewData,
  portfolioAvailable: boolean,
  actionToken: string,
  connectionState: WorkbenchConnectionState,
  topicMeeting: RecordDocumentReader,
  topicPage: TopicMeetingPage,
  topicQuery: TopicMeetingListQuery,
  meetingPage: TopicMeetingPage,
  meetingQuery: TopicMeetingListQuery,
  aiSelection: AiSelectionView | null,
  aiSelectionManagementSnapshot: AiSelectionSnapshot | undefined,
  aiSelectionManagementAllowed: boolean,
  aiRequests: AiRequests | undefined,
  aiRequestSnapshot: AiRequestSnapshot | null,
  selectedRepositoryId?: string,
  recordActionsConfigured = connectionState === "repository",
  repositoryActions: MainViewResponse["repositoryActions"] = connectionState ===
  "repository"
    ? repositoryWriteRoutes.map(({ operation }) => operation)
    : [],
): MainViewResponse {
  return Object.freeze({
    contract: "crdd/workbench/view/v1",
    view: "main",
    actionToken,
    projectData,
    portfolioAvailable,
    connection: Object.freeze({
      state: connectionState,
    }),
    topicPage,
    topicQuery,
    meetingPage,
    meetingQuery,
    recordDocuments: createRecordDocumentViews(
      topicPage,
      meetingPage,
      topicMeeting,
    ),
    selectedRepositoryId: selectedRepositoryId ?? null,
    recordActionsConfigured,
    repositoryActions,
    aiSelection,
    aiSelectionManagement: Object.freeze({
      snapshot: aiSelectionManagementSnapshot ?? null,
      allowed: aiSelectionManagementAllowed,
      result: null,
    }),
    aiRequest: Object.freeze({
      configured: aiRequests !== undefined,
      additionalHosts: null,
      snapshot: aiRequestSnapshot,
      notice: null,
    }),
  });
}
