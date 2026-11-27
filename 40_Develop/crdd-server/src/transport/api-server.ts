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
  type AccountAccessPrincipal,
  type AccessRole,
  type AuthorizedRepository,
  type FilesystemStoreRoot,
  type ManagementOperationOutcome,
  readCurrentAccess,
  readManagementState,
} from "@qual-lab/crdd-access-management";
import { getModelCatalog } from "@qual-lab/crdd-ai-adapter";
import type { AiSelectionSnapshot } from "@qual-lab/crdd-configuration-model";
import {
  type AiSelectionReadResult,
  type AiSelectionSaveResult,
  readRepositoryAiSelection,
  readRepositoryManifest,
} from "@qual-lab/crdd-configuration-model";
import type {
  PortfolioProjection,
  TopicMeetingAccess,
  TopicMeetingListQuery,
  TopicMeetingPage,
} from "@qual-lab/crdd-document-model";
import type { queryPlan } from "@qual-lab/crdd-execution-model";
import type { FileDiff, TreePage } from "@qual-lab/crdd-version-control";
import {
  getRepository,
  type Repository,
  resolveVerifiedRepositoryRoot,
} from "@qual-lab/crdd-version-control";
import express from "express";
import {
  createAccessViewResponse,
  executeManagementOperation,
  type HostedAccessSession,
  issueUserInvitation,
  managementSessionLifetimeSeconds,
  registerHostedRepository,
  resolveHostedDevelopmentAccess,
  resolveHostedRepositories,
} from "../service/access.ts";
import type { AiSelectionView } from "../service/configuration.ts";
import { matchesSecret } from "../secret.ts";
import {
  canManageAiSelection,
  readAiSelectionView,
  resolveAiSelectionAccess,
  updateAiSelection,
} from "../service/configuration.ts";
import {
  type CoordinatorExecutionOperation,
  executeCoordinatorOperation,
  executeDefinitionOperation,
  isWorkspaceRead,
  prepareWorkspaceOperation,
  readAuthorizedExecutionActivity,
  readAuthorizedPortfolio,
  resolveTopicMeetingAccess,
  validateExecutionDefinitionCommand,
} from "../service/entry.ts";
import type {
  AiRequestSnapshot,
  WorkbenchActivityReader,
  WorkbenchExecutionActivityObservation,
} from "../service/execution.ts";
import {
  type AiRequests,
  type AiSession,
  type AiSessionOperation,
  type DefinitionAccess,
  executionDefinitionResources,
  type ObjectiveRuns,
  prepareAiRequestStart,
  projectExecutionActivityForWorkbench,
  readRepositoryExecutionActivity,
  resolveHostedDefinitionAccess,
  resolveLocalDefinitionAccess,
} from "../service/execution.ts";
import {
  createArtifactViewResponse,
  createPortfolioPage,
  type ProjectViewData,
  projectPortfolioList,
  readArtifactMarkdown,
  type readArtifactSelection,
  readHostedProjectPortfolio,
  readLocalProjectPortfolio,
  readProjectDetailResponse,
  readProjectViewData,
} from "../service/project-context.ts";
import {
  assertRepositoryActionTarget,
  executeRepositoryAction,
  inspectRepositoryActionResult,
  type RepositoryActionRequest,
  readWorktreeObservation,
  withUnknownRepositoryObservation,
} from "../service/repository.ts";
import type { RecordDocumentView } from "../service/topic.ts";
import {
  createHostedRecords,
  createLocalRecords,
  createRecordDetailResponse,
  createRecordDocumentViews,
  type RecordDocumentReader,
  readRecordPages,
  readRecordWrite,
} from "../service/topic.ts";
import {
  hasContentType,
  matchesActionToken,
  matchesRequestHost,
  matchesRequestOrigin,
  readRequestBody,
  sendResponseBody,
  setResponseHeaders,
  validatePublicOriginRequest,
} from "./api-http.ts";
import {
  clientLoginRoute,
  clientSessionPaths,
  type createClientSessionHandler,
  gitConnectionRoute,
  gitConnectionsRoute,
  managementCookie,
  sessionCookieHeader,
} from "./api-session.ts";
import type {
  MainViewResponse,
  ViewResponse,
  WorkbenchConnectionState,
  WorkbenchPresentationState,
} from "./api-types.ts";
import type { PublicLoginProvider } from "./login-providers.ts";
import { parseUnambiguousJsonDocument } from "./parse-json.ts";

const CSS_PATH = "/workbench.css";
const LOGO_PATH = "/assets/crdd-brand-icon.jpg";
const CLIENT_ASSET_PATH = "/assets/workbench-client.js";

/** 実行系の公開HTTPパス。受付と仕様表示で共用する。 @trace ARCH-000012 */
const executionRepository = "/api/repositories/:repositoryId";
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
    `^${path.replace(/:(\w+)/gu, "(?<$1>[A-Za-z0-9][A-Za-z0-9._-]{0,127})")}$`,
    "u",
  );
const executionStatePath = resourcePathPattern(executionStateRoute);
const executionActivityPath = resourcePathPattern(executionActivityRoute);
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
  detail: "/api/repositories/:repositoryId/projects/:projectId/context",
} as const;
const projectDetailPath = resourcePathPattern(projectContextRoutes.detail);

export const topicMeetingResources = [
  ...(["topic", "meeting"] as const).flatMap((kind) => {
    const collection = `/api/repositories/:repositoryId/${kind}s`;
    const item = `${collection}/:${kind}Id`;
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
    clientSession?: RequestListener;
    changeManagementSession?: RequestListener;
    managementSession?: RequestListener;
    topicMeeting?: RequestListener;
    projectContext: RequestListener;
    gitConnection?: RequestListener;
    view: RequestListener;
    fallback: RequestListener;
  }>,
  publicOrigin: URL | null,
  browserAuthentication = false,
): RequestListener {
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("query parser", false);
  app.set("trust proxy", false);
  app.enable("case sensitive routing");
  app.enable("strict routing");
  if (handlers.workspaceResource) {
    for (const { method, path } of workspaceResources) {
      if (method === "get") app.head(path, handlers.fallback);
      app[method](path, handlers.workspaceResource);
    }
  }
  if (handlers.executionDefinition) {
    for (const { method, path } of Object.values(
      executionDefinitionResources,
    )) {
      if (method === "get") app.head(path, handlers.fallback);
      app[method](path, handlers.executionDefinition);
    }
  }
  for (const { method, path } of repositoryWriteRoutes)
    app[method](path, handlers.repository);
  app.head(aiSelectionRoute, handlers.aiSelection);
  app.get(aiSelectionRoute, handlers.aiSelection);
  app.put(aiSelectionRoute, handlers.aiSelection);
  for (const path of Object.values(aiRequestReadRoutes)) {
    app.head(path, handlers.aiRequestObservation);
    app.get(path, handlers.aiRequestObservation);
  }
  for (const { method, path } of aiRequestWriteRoutes)
    app[method](path, handlers.aiRequestWrite);
  app.head(executionStateRoute, handlers.fallback);
  app.get(executionStateRoute, handlers.execution);
  app.head(executionActivityRoute, handlers.fallback);
  app.get(executionActivityRoute, handlers.executionActivity);
  for (const { path } of executionWriteRoutes)
    app.post(path, handlers.execution);
  if (handlers.clientSession) {
    const clientSession = handlers.clientSession;
    app.head(`${clientLoginRoute}/callback`, handlers.fallback);
    app.head(clientSessionPaths.session, handlers.fallback);
    app.post(clientLoginRoute, clientSession);
    app.post(`${clientLoginRoute}/invitation`, clientSession);
    app.get(`${clientLoginRoute}/callback`, clientSession);
    app.get(clientSessionPaths.session, clientSession);
    app.delete(clientSessionPaths.session, clientSession);
  }
  if (handlers.changeManagementSession) {
    app.post(clientSessionPaths.management, handlers.changeManagementSession);
    app.delete(clientSessionPaths.management, handlers.changeManagementSession);
  }
  if (handlers.managementSession) {
    for (const { method, path } of managementSessionResources) {
      if (method === "get") app.head(path, handlers.fallback);
      app[method](path, handlers.managementSession);
    }
  }
  for (const route of Object.values(projectContextRoutes)) {
    app.head(route, handlers.fallback);
    app.get(route, handlers.projectContext);
  }
  if (handlers.topicMeeting)
    for (const { method, path } of topicMeetingResources) {
      if (method === "get") app.head(path, handlers.fallback);
      app[method](path, handlers.topicMeeting);
    }
  if (handlers.gitConnection) {
    const gitConnection = handlers.gitConnection;
    app.head(gitConnectionsRoute, handlers.fallback);
    app.get(gitConnectionsRoute, gitConnection);
    app.head(gitConnectionRoute, handlers.fallback);
    app.head(`${gitConnectionRoute}/callback`, handlers.fallback);
    app.get(gitConnectionRoute, gitConnection);
    app.post(gitConnectionRoute, gitConnection);
    app.delete(gitConnectionRoute, gitConnection);
    app.get(`${gitConnectionRoute}/callback`, gitConnection);
  }
  for (const path of [
    "/",
    "/index.html",
    "/project",
    "/topic",
    "/meeting",
    "/change",
    "/owner-artifact",
    "/api/workbench/view",
    CSS_PATH,
    LOGO_PATH,
    CLIENT_ASSET_PATH,
    "/.well-known/crdd-workbench-health",
  ]) {
    app.head(path, handlers.view);
    app.get(path, handlers.view);
  }
  app.use(handlers.fallback);
  return (incoming, response) => {
    if (!validatePublicOriginRequest(incoming, publicOrigin)) {
      setResponseHeaders(response);
      response.statusCode = 421;
      response.end("workbench_tls_boundary_invalid\n");
      return;
    }
    try {
      const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/api/access/connection") {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end();
        return;
      }
      if (
        browserAuthentication &&
        url.pathname.startsWith("/api/") &&
        incoming.headersDistinct.authorization !== undefined
      ) {
        setResponseHeaders(response);
        response.statusCode = 403;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(
          incoming.method === "HEAD"
            ? undefined
            : JSON.stringify({ error: "request_rejected" }),
        );
        return;
      }
      if (
        url.pathname === "/api/access" ||
        url.pathname === "/api/access/credentials"
      ) {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end();
        return;
      }
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
      `^${path.replace(":repositoryId", "(?<repositoryId>[A-Za-z0-9][A-Za-z0-9._-]{0,127})").replace(":workspaceId", "(?<workspaceId>[a-f0-9-]{36})")}$`,
      "u",
    ),
  }),
);

/** WorkspaceのHTTP操作をPathとMethodで決め、MCPと同じOwnerへ接続する。 */
export function createWorkspaceResourceHandler({
  getOrigin,
  repositoryRoot,
  accessRoot,
  readHostedSession,
}: Readonly<{
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  readHostedSession:
    | ((request: IncomingMessage) => HostedAccessSession | null)
    | undefined;
}>) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = (status: number, value: unknown) =>
      sendResponseBody(
        response,
        "application/json; charset=utf-8",
        JSON.stringify(value),
        false,
        status,
      );
    if (signal.aborted || response.destroyed) return;
    const origin = getOrigin();
    if (!origin) return reply(503, { error: "workspace_request_unavailable" });
    if (
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, { error: "request_rejected" });
    const url = new URL(incoming.url ?? "/", origin);
    const method = incoming.method?.toLowerCase();
    const route = workspaceResourcePatterns.find(
      (entry) => entry.method === method && entry.match.test(url.pathname),
    );
    const groups = route?.match.exec(url.pathname)?.groups;
    if (!route || !groups?.repositoryId)
      return reply(400, { error: "invalid_request" });
    const { repositoryId, workspaceId } = groups;
    const { operation } = route;
    const write = !isWorkspaceRead(operation);
    let input: Record<string, unknown>;
    if (write) {
      if (url.search || !matchesRequestOrigin(incoming, origin.origin))
        return reply(403, { error: "request_rejected" });
      if (!hasContentType(incoming, "application/json"))
        return reply(415, { error: "invalid_content_type" });
      try {
        const body = parseUnambiguousJsonDocument(
          new TextDecoder("utf-8", { fatal: true }).decode(
            await readRequestBody(incoming, 16 * 1_024),
          ),
        );
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reply(400, { error: "invalid_request" });
        input = { ...body };
      } catch {
        if (!signal.aborted && !response.destroyed)
          reply(400, { error: "invalid_request" });
        return;
      }
    } else {
      if (
        [...new Set(url.searchParams.keys())].some(
          (key) => url.searchParams.getAll(key).length !== 1,
        )
      )
        return reply(400, { error: "invalid_request" });
      input = Object.fromEntries(url.searchParams);
      if (operation === "list") {
        const limit = url.searchParams.get("limit");
        if (limit !== null && !/^[1-9]\d?$/u.test(limit))
          return reply(400, { error: "invalid_request" });
        input.limit = limit === null ? 20 : Number(limit);
        input.cursor = url.searchParams.get("cursor");
      }
    }
    if (
      Object.hasOwn(input, "operation") ||
      Object.hasOwn(input, "repositoryId") ||
      (workspaceId && Object.hasOwn(input, "workspaceId"))
    )
      return reply(400, { error: "invalid_request" });
    try {
      const prepared = await prepareWorkspaceOperation(
        { ...input, ...(workspaceId && { workspaceId }), operation },
        signal,
      );
      if (signal.aborted || response.destroyed) return;
      if (!prepared) return reply(400, { error: "invalid_request" });
      const hostedSession = accessRoot && readHostedSession?.(incoming);
      if (accessRoot && incoming.headersDistinct.authorization !== undefined)
        return reply(403, { error: "request_rejected" });
      const access = accessRoot
        ? hostedSession
          ? await resolveHostedDevelopmentAccess(
              accessRoot,
              hostedSession,
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
        return reply(404, { error: "workspace_unavailable" });
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
        reply(503, {
          error: write
            ? "workspace_outcome_unconfirmed"
            : "workspace_unavailable",
        });
    }
  };
}

/** 活動の独立したHTTP読取り。画面用投影は組み立てない。 @trace ARCH-000012 */
export function createExecutionActivityHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  readSession?:
    | ((incoming: IncomingMessage) => HostedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = (status: number, value: unknown) => {
      if (!signal.aborted && !response.destroyed)
        sendResponseBody(
          response,
          "application/json; charset=utf-8",
          JSON.stringify(value),
          false,
          status,
        );
    };
    const origin = input.getOrigin();
    if (signal.aborted) return;
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, { error: "request_rejected" });
    const url = new URL(incoming.url ?? "/", origin);
    const repositoryId = executionActivityPath.exec(url.pathname)?.groups
      ?.repositoryId;
    const limitText = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    if (
      !repositoryId ||
      incoming.method !== "GET" ||
      [...url.searchParams.keys()].some(
        (name) =>
          (name !== "limit" && name !== "cursor") ||
          url.searchParams.getAll(name).length !== 1,
      ) ||
      (limitText !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/u.test(limitText))
    )
      return reply(400, { error: "invalid_request" });
    try {
      const authorization = incoming.headersDistinct.authorization;
      const hosted = input.accessRoot && input.readSession?.(incoming);
      if (input.accessRoot && (!hosted || authorization !== undefined))
        return reply(403, { error: "request_rejected" });
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
        return reply(404, { error: "execution_activity_unavailable" });
      return reply(200, observation);
    } catch {
      return reply(503, { error: "execution_activity_unavailable" });
    }
  };
}

/** Projectの汎用読取りをMCPと同じ投影へ接続する。 @trace ARCH-000012 */
export function createProjectContextHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  readSession:
    | ((incoming: IncomingMessage) => HostedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = (status: number, value: unknown) => {
      if (signal.aborted || response.destroyed) return;
      sendResponseBody(
        response,
        "application/json; charset=utf-8",
        JSON.stringify(value),
        false,
        status,
      );
    };
    const origin = input.getOrigin();
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, { error: "request_rejected" });
    const url = new URL(incoming.url ?? "/", origin);
    const groups = projectDetailPath.exec(url.pathname)?.groups;
    const target =
      groups?.repositoryId && groups.projectId
        ? { repositoryId: groups.repositoryId, projectId: groups.projectId }
        : undefined;
    if (
      incoming.method !== "GET" ||
      url.search ||
      (!target && url.pathname !== projectContextRoutes.list)
    )
      return reply(400, { error: "invalid_request" });
    try {
      let portfolio: Awaited<ReturnType<typeof readLocalProjectPortfolio>>;
      let session: HostedAccessSession | null = null;
      if (!input.accessRoot)
        portfolio = await readLocalProjectPortfolio(
          input.repositoryRoot,
          signal,
          target,
        );
      else {
        session = input.readSession?.(incoming) ?? null;
        if (!session || incoming.headersDistinct.authorization !== undefined)
          return reply(401, { error: "login_required" });
        portfolio = await readHostedProjectPortfolio(
          input.accessRoot,
          session,
          signal,
          target,
        );
      }
      if (session?.isCurrent?.() === false)
        return reply(403, { error: "request_rejected" });
      if (!target) return reply(200, projectPortfolioList(portfolio));
      const project = portfolio.projects.find(
        ({ projectId }) => projectId === target.projectId,
      );
      return project
        ? reply(200, project)
        : reply(404, { error: "project_context_unavailable" });
    } catch {
      return reply(503, { error: "project_context_unavailable" });
    }
  };
}

/** 共有の文書操作をMCPと同じ外部ホスト認可へ接続する。 */
export function createTopicMeetingHandler(input: {
  getOrigin: () => URL | null;
  repositoryRoot: string;
  accessRoot: FilesystemStoreRoot | undefined;
  onLocalWrite?: () => void;
  readSession:
    | ((incoming: IncomingMessage) => HostedAccessSession | null)
    | undefined;
}) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = (status: number, value: unknown) =>
      sendResponseBody(
        response,
        "application/json; charset=utf-8",
        JSON.stringify(value),
        false,
        status,
      );
    if (signal.aborted || response.destroyed) return;
    const origin = input.getOrigin();
    if (
      !origin ||
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, { error: "request_rejected" });
    const url = new URL(incoming.url ?? "/", origin);
    const record = topicMeetingPaths.find(
      ({ method, match }) =>
        method.toUpperCase() === incoming.method && match.test(url.pathname),
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
      return reply(400, { error: "invalid_request" });
    const { kind, operation } = record;
    const resolve = () => {
      if (!input.accessRoot)
        return createLocalRecords(input.repositoryRoot, repositoryId, signal);
      const session = input.readSession?.(incoming);
      if (!session || incoming.headersDistinct.authorization !== undefined)
        return null;
      return createHostedRecords(
        input.accessRoot,
        session,
        repositoryId,
        signal,
      );
    };
    try {
      if (operation !== "list" && operation !== "get") {
        if (url.search || !matchesRequestOrigin(incoming, origin.origin))
          return reply(403, { error: "request_rejected" });
        if (!hasContentType(incoming, "application/json"))
          return reply(415, { error: "invalid_content_type" });
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
          body = parseUnambiguousJsonDocument(
            new TextDecoder("utf-8", { fatal: true }).decode(
              await readRequestBody(incoming, 16 * 1_024),
            ),
          );
        } catch {
          if (!signal.aborted && !response.destroyed)
            reply(400, { error: "invalid_request" });
          return;
        }
        if (signal.aborted || response.destroyed) return;
        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          Object.keys(pathFields).some((key) => Object.hasOwn(body, key))
        )
          return reply(400, { error: "invalid_request" });
        const action = readRecordWrite(kind, operation, {
          ...body,
          ...pathFields,
        });
        if (!action) return reply(400, { error: "invalid_request" });
        const records = resolve();
        if (!records) return reply(401, { error: "login_required" });
        const result = await records.write(action).finally(() => {
          if (!input.accessRoot) input.onLocalWrite?.();
        });
        if (signal.aborted || response.destroyed) return;
        return !result
          ? reply(404, { error: "record_unavailable" })
          : result.status === "completed"
            ? reply(operation === "create" ? 201 : 200, result)
            : reply(result.status === "blocked" ? 409 : 503, result);
      }
      const reader = resolve();
      if (!reader) return reply(401, { error: "login_required" });
      {
        if (recordId !== undefined) {
          const result = await reader.get(kind, recordId);
          if (signal.aborted || response.destroyed) return;
          return result?.status === "completed"
            ? reply(200, result)
            : reply(404, { error: "record_unavailable" });
        }
        const input = readTopicMeetingQuery(url.searchParams);
        if (!input) return reply(400, { error: "invalid_request" });
        const result = await reader.list({ kind, ...input });
        if (signal.aborted || response.destroyed) return;
        return result.status === "complete"
          ? reply(200, result.page)
          : result.status === "invalid"
            ? reply(400, { error: "invalid_request" })
            : reply(404, { error: "record_unavailable" });
      }
    } catch {
      if (!signal.aborted && !response.destroyed)
        reply(503, { error: "record_unavailable" });
    }
  };
}

/** 管理セッションを利用する読み取りと操作を、メソッドと対象リソースで固定する。 */
export const managementSessionResources = [
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
    `^${resource.path.replace(/:(\w+)/gu, "(?<$1>[A-Za-z0-9][A-Za-z0-9._-]{0,127})")}$`,
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
  changeManagement: ReturnType<
    typeof createClientSessionHandler
  >["changeManagement"],
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
      sessionCookieHeader(
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
    const reply = (status: number, value: unknown) =>
      sendResponseBody(
        response,
        "application/json; charset=utf-8",
        JSON.stringify(value),
        false,
        status,
      );
    if (signal.aborted || response.destroyed) return;
    const url = new URL(incoming.url ?? "/", origin);
    const method = incoming.method?.toLowerCase();
    const matched = managementPatterns.find(
      ({ resource, pattern }) =>
        resource.method === method && pattern.test(url.pathname),
    );
    if (!matched || url.search) return reply(400, { error: "invalid_request" });
    const route = matched.resource;
    const targets = matched.pattern.exec(url.pathname)?.groups ?? {};
    const targetId = targets.userId;
    if (
      targetId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        targetId,
      )
    )
      return reply(400, { error: "invalid_request" });
    if (!matchesRequestOrigin(incoming, origin.origin, "optional"))
      return reply(403, { error: "request_rejected" });
    const session = readManagement(incoming);
    if ("view" in route && route.view === "current") {
      const principal = session?.principal ?? readPrincipal(incoming);
      if (!principal) return reply(401, { error: "login_required" });
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
          ? { ...result, formToken: session.formToken }
          : result,
      );
    }
    if (!session) return reply(401, { error: "management_session_required" });
    const { principal } = session;
    if ("view" in route) {
      const result = readManagementState(root, principal, route.view);
      if (
        route.view === "users" &&
        gitHostingEnabled &&
        result.status === "completed"
      )
        response.setHeader("x-crdd-hosted-registration", "github.com");
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
      return reply(403, { error: "request_rejected" });
    if (!hasContentType(incoming, "application/json"))
      return reply(415, { error: "invalid_content_type" });
    let input: unknown;
    try {
      input = parseUnambiguousJsonDocument(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await readRequestBody(incoming, 4_096),
        ),
      );
    } catch {
      if (!signal.aborted && !response.destroyed)
        reply(400, { error: "invalid_request" });
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
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        input.operationId,
      )
    )
      return reply(400, { error: "invalid_request" });
    // 本文の待機中に終了したセッションを使って保存しない。
    const current = readManagement(incoming);
    if (
      !current ||
      current.principal.userId !== principal.userId ||
      current.principal.bindingId !== principal.bindingId ||
      !matchesSecret(current.formToken, session.formToken) ||
      !matchesSecret(input.formToken, current.formToken)
    )
      return reply(401, { error: "login_required" });
    const publishManagementResult = (
      status: ManagementOperationOutcome["status"],
    ) => {
      if (
        !matchesSecret(readManagement(incoming)?.formToken, current.formToken)
      ) {
        reply(401, { error: "management_session_required" });
        return false;
      }
      if (status !== "rejected") {
        const { status: binding } = observeSessionBinding(incoming);
        if (binding !== "completed") {
          reply(binding === "rejected" ? 401 : 503, {
            error: "management_result_unavailable",
          });
          return false;
        }
      }
      return true;
    };
    if (route.operation === "registerRepository") {
      if (!gitHostingEnabled)
        return reply(403, { error: "git_host_connection_required" });
      if (
        !("repositoryId" in input) ||
        typeof input.repositoryId !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(input.repositoryId) ||
        !("directory" in input) ||
        typeof input.directory !== "string"
      )
        return reply(400, { error: "invalid_request" });
      const result = await registerHostedRepository(
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
      return reply(400, { error: "invalid_request" });
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
    `^${path.replace(/:(\w+)/gu, "(?<$1>[A-Za-z0-9][A-Za-z0-9._-]{0,127})")}$`,
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
  readHostedSession,
}: Readonly<{
  getOrigin: () => URL | null;
  capability: Repository;
  accessRoot: FilesystemStoreRoot | undefined;
  readHostedSession:
    | ((request: IncomingMessage) => HostedAccessSession | null)
    | undefined;
}>) {
  return async (
    incoming: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const reply = (status: number, value: unknown) =>
      sendResponseBody(
        response,
        "application/json; charset=utf-8",
        JSON.stringify(value),
        false,
        status,
      );
    const alive = () => !signal.aborted && !response.destroyed;
    if (!alive()) return;
    const origin = getOrigin();
    if (!origin)
      return reply(503, { error: "execution_definition_unavailable" });
    if (
      !matchesRequestHost(incoming, origin.host) ||
      !matchesRequestOrigin(incoming, origin.origin, "optional")
    )
      return reply(403, { error: "request_rejected" });
    const url = new URL(incoming.url ?? "/", origin);
    const route = executionDefinitionPatterns.find(
      ({ method, pattern }) =>
        incoming.method?.toLowerCase() === method && pattern.test(url.pathname),
    );
    const ids = route?.pattern.exec(url.pathname)?.groups;
    if (!route || !ids?.repositoryId || !ids.projectId || !ids.milestoneId)
      return reply(400, { error: "invalid_request" });
    const { repositoryId, ...target } = ids;
    const write = route.method !== "get";
    let input: Record<string, unknown>;
    if (write) {
      if (url.search || !matchesRequestOrigin(incoming, origin.origin))
        return reply(403, { error: "request_rejected" });
      if (!hasContentType(incoming, "application/json"))
        return reply(415, { error: "invalid_content_type" });
      if (
        Number(incoming.headers["content-length"]) >
        MAXIMUM_EXECUTION_REQUEST_BYTES
      )
        return reply(403, { error: "request_rejected" });
      try {
        const body = parseUnambiguousJsonDocument(
          new TextDecoder("utf-8", { fatal: true }).decode(
            await readRequestBody(incoming, MAXIMUM_EXECUTION_REQUEST_BYTES),
          ),
        );
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reply(400, { error: "invalid_request" });
        input = { ...body };
      } catch {
        if (alive()) reply(400, { error: "invalid_request" });
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
        return reply(400, { error: "invalid_request" });
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
      return reply(400, { error: "invalid_request" });
    const command = validateExecutionDefinitionCommand(
      { ...input, ...target, operation: route.operation },
      write ? "write" : "read",
    );
    if (!command) return reply(400, { error: "invalid_request" });
    let dispatched = false;
    try {
      let access: DefinitionAccess | null = null;
      if (accessRoot) {
        const hosted = readHostedSession?.(incoming);
        if (incoming.headersDistinct.authorization !== undefined)
          return reply(403, { error: "request_rejected" });
        if (hosted) {
          access = await resolveHostedDefinitionAccess(
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
        return reply(403, { error: "execution_definition_unavailable" });
      dispatched = true;
      const result = executeDefinitionOperation(access, command);
      if (!alive()) return;
      if (
        !access.revalidate(
          write ? "definition.write" : "definition.read",
          command.input as Parameters<typeof queryPlan>[1],
        )
      )
        return reply(503, { error: "execution_definition_unavailable" });
      return reply(200, result);
    } catch {
      if (alive())
        return reply(dispatched ? 503 : 403, {
          error: "execution_definition_unavailable",
        });
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
  readHostedSession,
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
  readHostedSession?:
    | ((request: IncomingMessage) => HostedAccessSession | null)
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
  const fail = (status: number, reason: string) => {
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
  const hosted = shared ? readHostedSession?.(incoming) : undefined;
  if (
    shared &&
    (!hosted || incoming.headersDistinct.authorization !== undefined)
  ) {
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
      const body = parseUnambiguousJsonDocument(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await readRequestBody(incoming, MAXIMUM_EXECUTION_REQUEST_BYTES),
        ),
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
        incoming.method !== "GET" ||
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
  } catch {
    fail(400, "execution_input_invalid");
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
  observe: () => Promise<AiRequestSnapshot | null>,
): Promise<void> {
  if (signal.aborted || response.destroyed) return;
  setResponseHeaders(response);
  if (method !== "GET") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET");
    response.end();
    return;
  }
  response.setHeader("Cache-Control", "no-store");
  let snapshot: AiRequestSnapshot | null;
  try {
    snapshot = await observe();
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
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(snapshot));
}

/** 固定された対象・資格で現在または指定した依頼を観測する。 @trace ARCH-000015 */
export async function handleAiRequestObservation({
  response,
  requestSignal,
  requestUrl,
  method,
  localAccessRoot,
  localRepositoryId,
  openHostedAiSession,
  aiRequests,
  presentation,
}: Readonly<{
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  method: string;
  localAccessRoot: FilesystemStoreRoot | undefined;
  localRepositoryId: string | undefined;
  openHostedAiSession?:
    | ((
        repositoryId: string,
        operation: AiSessionOperation,
        signal: AbortSignal,
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
    const session = openHostedAiSession
      ? await openHostedAiSession(
          repositoryId,
          current ? "view" : "read",
          requestSignal,
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
          snapshot.reason === "coordinator_task_not_available")) ||
      (current && readCurrentId() !== requestId) ||
      (localAccessRoot && !session?.authorize())
    )
      return null;
    return snapshot;
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
  openHostedAiSession,
  aiRequests,
  presentation,
}: Parameters<typeof handleAiRequestObservation>[0] &
  Readonly<{
    incoming: IncomingMessage;
    origin: string | null;
    actionToken: string;
    presentation: Pick<
      WorkbenchPresentationState,
      "currentAiRequestId" | "aiRequestSnapshot" | "aiRequestNotice"
    >;
  }>): Promise<void> {
  let dispatched = false;
  const reply = (status: number, value: unknown) => {
    if (requestSignal.aborted || response.destroyed) return;
    sendResponseBody(
      response,
      "application/json; charset=utf-8",
      JSON.stringify(value),
      false,
      status,
    );
  };
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
      return reply(400, { error: "ai_request_rejected" });
    const value = parseUnambiguousJsonDocument(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readRequestBody(incoming, 16 * 1024),
      ),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      return reply(400, { error: "ai_request_rejected" });
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
        return reply(400, { error: "ai_request_rejected" });
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
        return reply(400, { error: "ai_request_rejected" });
      requestId = body.requestId;
    } else if (Object.keys(body).length !== 0) {
      return reply(400, { error: "ai_request_rejected" });
    }
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
        command?.requestId ?? requestId ?? "",
      )
    )
      return reply(400, { error: "ai_request_rejected" });
    if (requestSignal.aborted || response.destroyed) return;
    const session = openHostedAiSession
      ? await openHostedAiSession(
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
    if (!owner) return reply(403, { error: "ai_request_rejected" });
    const isCurrent = () => !localAccessRoot || session?.authorize() === true;
    const select = (
      id: string,
      snapshot: AiRequestSnapshot | null,
      notice: string,
    ) => {
      if (session) session.currentId = id;
      else {
        presentation.currentAiRequestId = id;
        presentation.aiRequestSnapshot = snapshot;
        presentation.aiRequestNotice = notice;
      }
    };
    if (command) {
      dispatched = true;
      const result = await owner.start(command, requestSignal);
      if (!isCurrent())
        return reply(503, { error: "ai_request_outcome_unconfirmed" });
      if (
        result.status === "accepted" &&
        result.requestId === command.requestId &&
        result.reason === null
      ) {
        // 切断は結果の公開だけを止め、Ownerが受理した同じ依頼の再照会を妨げない。
        select(result.requestId, null, "AI依頼を受け付けました。");
        return reply(201, result);
      }
      if (
        result.status !== "blocked" ||
        (result.requestId !== null && result.requestId !== command.requestId) ||
        typeof result.reason !== "string" ||
        !result.reason
      )
        return reply(503, { error: "ai_request_outcome_unconfirmed" });
      return reply(409, result);
    }
    if (!requestId) return reply(400, { error: "ai_request_rejected" });
    const previous = await owner.observe(requestId, requestSignal);
    if (
      previous.requestId !== requestId ||
      previous.mode === null ||
      previous.reason === "coordinator_task_not_available" ||
      requestSignal.aborted ||
      response.destroyed ||
      !isCurrent()
    )
      return reply(403, { error: "ai_request_rejected" });
    if (operation === "select") {
      select(requestId, previous, "保存済み依頼を確認しました。");
      return reply(200, previous);
    }
    if (session && previous.mode === "workspace_edit" && !session.canWrite)
      return reply(403, { error: "ai_request_rejected" });
    dispatched = true;
    const cancelled = await owner.cancel(requestId, requestSignal);
    if (cancelled.requestId !== requestId || !isCurrent())
      return reply(503, { error: "ai_request_outcome_unconfirmed" });
    const currentId = session
      ? session.currentId
      : presentation.currentAiRequestId;
    if (currentId === null || currentId === requestId)
      select(requestId, cancelled, "取消結果を取得しました。");
    return reply(200, cancelled);
  } catch {
    return dispatched
      ? reply(503, { error: "ai_request_outcome_unconfirmed" })
      : reply(400, { error: "ai_request_rejected" });
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
  readHostedSession,
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
  readHostedSession:
    | ReturnType<typeof createClientSessionHandler>["readHostedAccessSession"]
    | undefined;
  readManagementSession:
    | ReturnType<typeof createClientSessionHandler>["readManagement"]
    | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    const write = incoming.method === "PUT";
    const repositoryId = aiSelectionPath.exec(requestUrl.pathname)?.groups
      ?.repositoryId;
    if (!repositoryId || requestUrl.search !== "")
      throw new Error("ai_selection_input_invalid");
    const session = readHostedSession?.(incoming) ?? null;
    const management = write ? readManagementSession?.(incoming) : undefined;
    if (
      localAccessRoot !== undefined &&
      (incoming.headersDistinct.authorization !== undefined ||
        !session ||
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
      const json = parseUnambiguousJsonDocument(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await readRequestBody(incoming, 3 * 1_024 * 1_024 + 16 * 1_024),
        ),
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
      readHostedSession && {
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
    );
  } catch {
    if (requestSignal.aborted || response.destroyed) return;
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
 * @responsibility Owner観測・表示構築・通知消費・応答の順序と現在状態の参照を維持する。
 * @trace ARCH-000012
 * @input 当該要求の応答・Signal・URL、既存の表示値・Owner・設定と読取り済みAsset。
 * @returns 表示処理と当該Ownerの終了を待つPromise。
 * @precondition 共通Origin・Artifact Query・接続形態ごとの前段を元の順序で実行済みである。
 * @postcondition GETのAPI表示だけ通知を消費し、HEAD・HTML・途中拒否では消費しない。
 * @effect 既存Reader・AI Ownerの観測とHTTP応答。通知消費は従来の単体GET条件だけで行う。
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
  artifactSelection,
  repositoryRoot,
  capability,
  topicMeeting,
  portfolio,
  connectionState,
  presentation,
  aiRequests,
  activityReader,
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
  artifactSelection: ReturnType<typeof readArtifactSelection>;
  repositoryRoot: string;
  capability: Repository;
  topicMeeting: TopicMeetingAccess | undefined;
  portfolio: PortfolioProjection | undefined;
  connectionState: WorkbenchConnectionState;
  presentation: WorkbenchPresentationState;
  aiRequests: AiRequests | undefined;
  activityReader: WorkbenchActivityReader | undefined;
  actionToken: string;
  configuration: Readonly<{ localAccessRoot?: FilesystemStoreRoot }>;
  assets: WorkbenchAssets;
  contract: string;
  host: string;
  healthPath: string;
}>): Promise<void> {
  const staticAsset = readStaticAsset(requestPath, assets);
  let body: string | Buffer;
  let contentType: string;
  if (presentation.projectSurface === undefined || topicMeeting === undefined)
    throw new Error("workbench_repository_access_unavailable");
  if (
    requestPath === "/" ||
    requestPath === "/index.html" ||
    requestPath === "/api/workbench/view"
  ) {
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
    if (activityReader !== undefined) {
      try {
        const activityCursor = requestUrl.searchParams.get("activityCursor");
        const page = {
          ...(activityCursor === null ? {} : { cursor: activityCursor }),
          limit: 20,
        };
        presentation.executionActivityObservation =
          await activityReader.observe(
            currentProjectSurface.context.projectId,
            page,
          );
      } catch {
        presentation.executionActivityObservation = Object.freeze({
          state: "unknown",
          reason: "observation_failed",
          projection: null,
          eventState: "unknown",
          eventReason: "observation_failed",
          events: Object.freeze([]),
          eventContinuation: null,
        });
      }
    }
    const selectedRepositoryId = undefined;
    const { topicPage, topicQuery, meetingPage, meetingQuery, reader } =
      readRecordPages(topicMeeting, requestUrl.searchParams);
    const worktreeView = Object.freeze(
      readWorktreeObservation(
        capability,
        currentProjectSurface.repository,
        requestUrl.searchParams.get("treeDirectory") ?? "",
        requestUrl.searchParams.get("treeCursor") ?? undefined,
        requestUrl.searchParams.get("diffPath"),
      ),
    );
    presentation.aiSelection = readAiSelectionView(repositoryRoot);
    const baseModel = readMainViewData(
      currentProjectSurface,
      portfolio,
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
      presentation.aiSelectionManagementResult,
      aiRequests,
      presentation.aiRequestSnapshot,
      presentation.aiRequestNotice,
      presentation.executionActivityObservation,
      Object.freeze({
        query: requestUrl.searchParams.get("portfolioQuery") ?? "",
        state: requestUrl.searchParams.get("portfolioState") ?? "",
        cursor: requestUrl.searchParams.get("portfolioCursor") ?? "",
      }),
      worktreeView,
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
    let responseModel: ViewResponse = clientModel;
    const clientRoute = requestUrl.searchParams.get("route") ?? "/";
    if (clientRoute === "/project") {
      const projectId = requestUrl.searchParams.get("id") ?? "";
      const projectDetail = readProjectDetailResponse(portfolio, projectId);
      if (projectDetail === null) {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end(method === "HEAD" ? undefined : "not_found\n");
        return;
      }
      responseModel = Object.freeze(projectDetail);
    } else if (artifactSelection !== null) {
      if (
        requestUrl.searchParams.has("repositoryId") &&
        requestUrl.searchParams.get("repositoryId") !==
          presentation.projectSurface.context.repositoryId
      ) {
        setResponseHeaders(response);
        response.statusCode = 403;
        response.end("artifact_access_unavailable\n");
        return;
      }
      const markdown = await readArtifactMarkdown(
        repositoryRoot,
        presentation.projectSurface,
        artifactSelection,
      );
      if (markdown === null) {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end("artifact_unavailable\n");
        return;
      }
      if (requestSignal.aborted || response.destroyed) return;
      responseModel = createArtifactViewResponse(
        artifactSelection,
        markdown,
        presentation.projectSurface.context.repositoryId,
        null,
      );
    } else if (clientRoute === "/topic" || clientRoute === "/meeting") {
      const kind = clientRoute === "/topic" ? "topic" : "meeting";
      const id = requestUrl.searchParams.get("id") ?? "";
      const expectedPattern =
        kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u;
      const repositoryId = requestUrl.searchParams.get("repositoryId");
      let recordView: RecordDocumentView | null = null;
      if (
        expectedPattern.test(id) &&
        (repositoryId === null ||
          repositoryId === presentation.projectSurface.context.repositoryId)
      ) {
        const document = topicMeeting[kind].getDocument(id);
        if (document !== null)
          recordView = Object.freeze({
            kind,
            id,
            document,
            relations: Object.freeze([...topicMeeting[kind].relations(id)]),
          });
      }
      if (recordView === null) {
        setResponseHeaders(response);
        response.statusCode = 404;
        response.end(method === "HEAD" ? undefined : "not_found\n");
        return;
      }
      responseModel = Object.freeze(
        createRecordDetailResponse(
          actionToken,
          repositoryId,
          presentation.projectSurface.context.repositoryId,
          true,
          recordView,
        ),
      );
    }
    body =
      requestPath === "/api/workbench/view"
        ? JSON.stringify(responseModel)
        : assets.document;
    if (method === "GET" && requestPath === "/api/workbench/view") {
      presentation.aiSelectionManagementResult = null;
      presentation.aiRequestNotice = null;
    }
    contentType =
      requestPath === "/api/workbench/view"
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
  artifactSelection,
  shared,
  loginProviders,
  actionToken,
  configuration,
  observeHostedAiSelection,
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
  artifactSelection: ReturnType<typeof readArtifactSelection>;
  shared?:
    | Readonly<{
        root: FilesystemStoreRoot;
        session: HostedAccessSession;
        hasManagementSession: () => boolean;
      }>
    | undefined;
  loginProviders?: readonly PublicLoginProvider[] | undefined;
  actionToken: string;
  configuration: Readonly<{
    sharedAiRequestsFactory?: unknown;
  }>;
  observeHostedAiSelection?:
    | ((
        session: HostedAccessSession,
        target: AuthorizedRepository,
        signal: AbortSignal,
      ) => Promise<AiRequestSnapshot | null>)
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
    requestPath === "/api/workbench/view"
  ) {
    const selectedId =
      requestPath === "/api/workbench/view"
        ? requestUrl.searchParams.get("repositoryId") || null
        : null;
    const unavailable = () => {
      setResponseHeaders(response);
      response.statusCode = 403;
      response.end(
        method === "HEAD" ? undefined : "local_repository_access_unavailable\n",
      );
    };
    if (selectedId && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(selectedId)) {
      unavailable();
      return true;
    }
    let currentPortfolio: PortfolioProjection | null = null;
    let hosted: Awaited<ReturnType<typeof resolveHostedRepositories>> = null;
    let repositories: readonly AuthorizedRepository[] = [];
    let notice: string | null = null;
    const requireCurrentHosted = () => {
      if (!hosted) return;
      for (const repository of hosted.repositories) {
        hosted.assertDirectory(repository);
        const manifest = readRepositoryManifest(repository.root);
        if (
          manifest.status !== "ready" ||
          JSON.stringify(manifest.manifest) !==
            JSON.stringify(repository.manifest)
        )
          throw new Error("workbench_selected_content_unavailable");
      }
      hosted.assertCurrent(hosted.repositories);
    };
    if (shared) {
      try {
        const access = await resolveHostedRepositories(
          shared.root,
          shared.session,
          requestSignal,
          selectedId ?? undefined,
        );
        hosted = access;
        if (selectedId && !access)
          throw new Error("workbench_selected_content_unavailable");
        repositories = access?.repositories ?? [];
        // 内容の認可がない接続では空の投影も返さない。本人のログインと管理権限は別のAPIで確認する。
        if (access !== null)
          currentPortfolio = readAuthorizedPortfolio(
            repositories,
            requestSignal,
            (repository) => access.assertDirectory(repository),
          );
      } catch {
        if (selectedId) {
          if (!requestSignal.aborted && !response.destroyed) unavailable();
          return true;
        }
        notice = "現在の内容を確認できません。";
      }
    }
    let model: ViewResponse = createAccessViewResponse(
      actionToken,
      notice,
      currentPortfolio,
      hosted !== null,
      loginProviders,
    );
    if (
      requestPath === "/api/workbench/view" &&
      selectedId !== null &&
      selectedId !== "" &&
      !(artifactSelection !== null && !shared)
    ) {
      try {
        if (!shared || !hosted || currentPortfolio === null)
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
        requireCurrentHosted();
        const write = hosted.canWrite(selectedId);
        const root = selected.root;
        const verification = getRepository(root);
        if (verification.status !== "completed")
          throw new Error("workbench_selected_content_unavailable");
        const assertReadable = () => {
          if (requestSignal.aborted || response.destroyed)
            throw new Error("workbench_selected_content_unavailable");
          requireCurrentHosted();
        };
        const projectData = await readProjectViewData(root, assertReadable);
        if (requestSignal.aborted || response.destroyed) return true;
        assertReadable();
        if (
          projectData.context.repositoryId !== selected.repositoryId ||
          projectData.context.projectId !== selected.manifest.projectId
        )
          throw new Error("workbench_selected_content_unavailable");
        const { topicPage, topicQuery, meetingPage, meetingQuery, reader } =
          readRecordPages(records, requestUrl.searchParams);
        const worktree = readWorktreeObservation(
          verification.capability,
          projectData.repository,
          requestUrl.searchParams.get("treeDirectory") ?? "",
          requestUrl.searchParams.get("treeCursor") ?? undefined,
          requestUrl.searchParams.get("diffPath"),
        );
        let activity: WorkbenchExecutionActivityObservation;
        await setTimeout(0);
        if (requestSignal.aborted || response.destroyed) return true;
        try {
          const cursor = requestUrl.searchParams.get("activityCursor");
          const observation = await readAuthorizedExecutionActivity(
            {
              projectId: selected.manifest.projectId,
              limit: 20,
              ...(cursor === null ? {} : { cursor }),
            },
            repositories.filter(
              (entry) =>
                entry.manifest.projectId === selected.manifest.projectId,
            ),
            () => {
              try {
                requireCurrentHosted();
                return !response.destroyed;
              } catch {
                return false;
              }
            },
            requestSignal,
          );
          if (observation.projectId !== selected.manifest.projectId)
            throw new Error("workbench_activity_unavailable");
          activity = projectExecutionActivityForWorkbench(observation);
        } catch {
          activity = {
            state: "unknown",
            reason: "observation_failed",
            projection: null,
            eventState: "unknown",
            eventReason: "observation_failed",
            events: [],
            eventContinuation: null,
          };
        }
        await setTimeout(0);
        if (requestSignal.aborted || response.destroyed) return true;
        requireCurrentHosted();
        const selectedAiSnapshot =
          (await observeHostedAiSelection?.(
            shared.session,
            selected,
            requestSignal,
          )) ?? null;
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
          currentPortfolio,
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
          null,
          undefined,
          null,
          null,
          activity,
          {
            query: requestUrl.searchParams.get("portfolioQuery") ?? "",
            state: requestUrl.searchParams.get("portfolioState") ?? "",
            cursor: requestUrl.searchParams.get("portfolioCursor") ?? "",
          },
          worktree,
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
            snapshot: selectedAiSnapshot,
            notice: null,
          },
        };
        const route = requestUrl.searchParams.get("route") ?? "/";
        if (route === "/project") {
          const projectDetail = readProjectDetailResponse(
            currentPortfolio,
            requestUrl.searchParams.get("id"),
          );
          if (projectDetail === null)
            throw new Error("workbench_selected_content_unavailable");
          model = projectDetail;
        } else if (route === "/topic" || route === "/meeting") {
          const kind = route === "/topic" ? "topic" : "meeting";
          const id = requestUrl.searchParams.get("id") ?? "";
          const document = reader.getDocument(kind, id);
          if (!document)
            throw new Error("workbench_selected_content_unavailable");
          model = createRecordDetailResponse(
            actionToken,
            selectedId,
            selectedId,
            write,
            {
              kind,
              id,
              document,
              relations: reader.relations(kind, id),
            },
          );
        } else if (artifactSelection !== null) {
          const markdown = await readArtifactMarkdown(
            root,
            projectData,
            artifactSelection,
            assertReadable,
          );
          if (markdown === null)
            throw new Error("workbench_selected_content_unavailable");
          model = createArtifactViewResponse(
            artifactSelection,
            markdown,
            selected.manifest.repositoryId,
            selectedId,
          );
        } else if (route !== "/" && route !== "/index.html") {
          throw new Error("workbench_selected_content_unavailable");
        }
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
    localBody =
      requestPath === "/api/workbench/view"
        ? JSON.stringify(model)
        : assets.document;
    if (requestSignal.aborted || response.destroyed) return true;
    if (requestPath === "/api/workbench/view") {
      try {
        requireCurrentHosted();
      } catch {
        if (!requestSignal.aborted && !response.destroyed) unavailable();
        return true;
      }
    }
    if (requestPath === "/api/workbench/view")
      localContentType = "application/json; charset=utf-8";
  } else if (staticAsset !== null) {
    localBody = staticAsset.body;
    localContentType = staticAsset.contentType;
  } else if (requestPath === HEALTH_PATH) {
    localBody = JSON.stringify({
      contract: CONTRACT,
      status: "ready",
      host: HOST,
      mode: "local-cros",
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
  readHostedSession,
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
  readHostedSession:
    | ((request: IncomingMessage) => HostedAccessSession | null)
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
      parseUnambiguousJsonDocument(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await readRequestBody(incoming, 16 * 1024),
        ),
      ),
    );
    if (requestSignal.aborted || response.destroyed) return;
  } catch {
    if (!requestSignal.aborted && !response.destroyed) {
      setResponseHeaders(response);
      response.statusCode = 400;
      response.end("repository_action_rejected\n");
    }
    return;
  }
  if (localAccessRoot !== undefined) {
    let dispatched = false;
    try {
      const session = readHostedSession?.(incoming);
      // 共有のインデックス変更はCookieで確認した本人の現在書込み権限に限る。
      if (
        !session ||
        (input.request.operation !== "prepare" &&
          input.request.operation !== "unprepare")
      )
        throw new Error("workbench_repository_access_unavailable");
      const access = await resolveHostedDevelopmentAccess(
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
  portfolio: PortfolioProjection | undefined,
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
  aiSelectionManagementResult: AiSelectionSaveResult | null,
  aiRequests: AiRequests | undefined,
  aiRequestSnapshot: AiRequestSnapshot | null,
  aiRequestNotice: string | null,
  executionActivity: WorkbenchExecutionActivityObservation | undefined,
  portfolioQuery: Readonly<{ query: string; state: string; cursor: string }>,
  worktree: Readonly<{
    state: "available" | "unknown";
    tree: TreePage | null;
    diff: FileDiff | null;
  }>,
  selectedRepositoryId?: string,
  recordActionsConfigured = connectionState === "repository",
  repositoryActions: MainViewResponse["repositoryActions"] = connectionState ===
  "repository"
    ? repositoryWriteRoutes.map(({ operation }) => operation)
    : [],
): MainViewResponse {
  const portfolioPage = createPortfolioPage(portfolio, portfolioQuery);
  return Object.freeze({
    contract: "crdd/workbench/view/v1",
    view: "main",
    actionToken,
    projectData,
    portfolio: portfolioPage.portfolio,
    portfolioPage: Object.freeze({
      nextCursor: portfolioPage.nextCursor,
      cursorInvalid: portfolioPage.cursorInvalid,
    }),
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
    worktree,
    aiSelection,
    aiSelectionManagement: Object.freeze({
      snapshot: aiSelectionManagementSnapshot ?? null,
      allowed: aiSelectionManagementAllowed,
      result: aiSelectionManagementResult,
    }),
    aiRequest: Object.freeze({
      configured: aiRequests !== undefined,
      additionalHosts: null,
      snapshot: aiRequestSnapshot,
      notice: aiRequestNotice,
    }),
    executionActivity: executionActivity ?? null,
  });
}
