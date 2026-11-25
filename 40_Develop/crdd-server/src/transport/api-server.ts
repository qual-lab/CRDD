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
  TopicMeetingPage,
  TopicMeetingListQuery,
} from "@qual-lab/crdd-document-model";
import type { AiSelectionSnapshot } from "@qual-lab/crdd-configuration-model";
import type {
  ChangesResult,
  TreePage,
  FileDiff,
} from "@qual-lab/crdd-version-control";
import {
  confirmLocalCredentialConnection,
  createAccessViewResponse,
  executeCredentialAction,
  readCredentialAdministrationView,
  type CredentialActionCommand,
  type CredentialActionResult,
} from "../service/access.ts";
import {
  createArtifactViewResponse,
  readProjectDetailResponse,
  createPortfolioPage,
  type ProjectViewData,
} from "../service/project-context.ts";
import type { AiSelectionView } from "../service/configuration.ts";
import {
  createRecordDetailResponse,
  createRecordDocumentViews,
  type RecordDocumentReader,
  type TopicMeetingActionResult,
} from "../service/topic.ts";
import type { ViewResponse, MainViewResponse } from "./api-types.ts";
import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";
import { setTimeout } from "node:timers/promises";
import express from "express";
import {
  observeConnectionCancellation,
  validatePublicOriginRequest,
  sendResponseBody,
  readActionForm,
  setResponseHeaders,
} from "./api-http.ts";
import {
  type FilesystemStoreRoot,
  type RepositoryAccessCollectionResult,
  resolveRepositoryAccessCollection,
  sameAccessCollection,
  evaluateAiProfileManagementPermission,
  readCurrentAccess,
  readManagementState,
} from "@qual-lab/crdd-access-management";
import {
  createLocalPrincipalId,
  type queryPlan,
} from "@qual-lab/crdd-execution-model";
import {
  getRepository,
  readGitUser,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "@qual-lab/crdd-version-control";
import {
  validateExecutionDefinitionCommand,
  resolveTopicMeetingAccess,
  executeDefinitionOperation,
  executeCoordinatorOperation,
  prepareWorkspaceOperation,
  type CoordinatorExecutionOperation,
  readAuthorizedPortfolio,
  readAuthorizedExecutionActivity,
} from "../service/entry.ts";
import {
  createDefinitionAccess,
  type DefinitionAccess,
  resolveSharedDefinitionAccess,
} from "../service/execution.ts";
import { resolveSharedDevelopmentAccess } from "../service/access.ts";
import {
  resolveAiSelectionAccess,
  updateAiSelection,
} from "../service/configuration.ts";
import type { CredentialAdministration } from "../service/access.ts";
import { executeManagementOperation } from "../service/access.ts";
import type { ManagementView, ManagementResult } from "../service/access.ts";
import { parseUnambiguousJsonDocument } from "./parse-json.ts";
import {
  readRepositoryAiSelection,
  type AiSelectionReadResult,
  type AiSelectionSaveResult,
} from "@qual-lab/crdd-configuration-model";
import {
  prepareAiRequestStart,
  requireAiRequestForAction,
  type AiRequests,
} from "../service/execution.ts";
import type {
  WorkbenchPresentationState,
  WorkbenchConnectionState,
} from "./api-types.ts";
import { getModelCatalog } from "@qual-lab/crdd-ai-adapter";
import type { RecordDocumentView } from "../service/topic.ts";
import {
  createTopicMeetingResultView,
  readRecordPages,
} from "../service/topic.ts";
import { readAiSelectionView } from "../service/configuration.ts";
import type {
  PortfolioProjection,
  TopicMeetingAccess,
} from "@qual-lab/crdd-document-model";
import type { WorkbenchActivityReader } from "../service/execution.ts";
import type {
  AiRequestSnapshot,
  WorkbenchExecutionActivityObservation,
} from "../service/execution.ts";
import { projectExecutionActivityForWorkbench } from "../service/execution.ts";
import {
  readProjectViewData,
  readArtifactMarkdown,
  type readArtifactSelection,
} from "../service/project-context.ts";
import {
  assertRepositoryActionTarget,
  withUnknownRepositoryObservation,
  readWorktreeObservation,
  executeRepositoryAction,
  inspectRepositoryActionResult,
  type RepositoryActionRequest,
} from "../service/repository.ts";

import {
  parseMeetingMarkdown,
  parseTopicMarkdown,
  type ProjectOperationRecordKind,
} from "@qual-lab/crdd-document-model";
import { executeMeetingAction } from "../service/meeting.ts";
import {
  executeTopicAction,
  type RecordWriteCommand,
} from "../service/topic.ts";

const CSS_PATH = "/workbench.css";
const LOGO_PATH = "/assets/crdd-brand-icon.jpg";
const CLIENT_ASSET_PATH = "/assets/workbench-client.js";

/** 実行系の公開HTTPパス。受付と仕様表示で共用する。 @trace ARCH-000012 */
export const executionHttpPaths = {
  state: "/api/execution/state",
  objective: "/api/execution/objectives/run",
  decision: "/api/execution/decisions/submit",
  definition: "/api/execution/definition",
} as const;

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
    workspace: RequestListener;
    repository: RequestListener;
    record: RequestListener;
    aiSelection: RequestListener;
    aiRequest: RequestListener;
    execution: RequestListener;
    management: RequestListener;
    credentials: RequestListener;
    view: RequestListener;
    fallback: RequestListener;
  }>,
  publicOrigin: URL | null,
): RequestListener {
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("query parser", false);
  app.set("trust proxy", false);
  app.enable("case sensitive routing");
  app.enable("strict routing");
  app.post("/api/workspace", handlers.workspace);
  app.post("/api/repository", handlers.repository);
  app.post("/api/records", handlers.record);
  app.post("/api/ai-selection", handlers.aiSelection);
  app.post("/api/ai-request", handlers.aiRequest);
  app.head(executionHttpPaths.state, handlers.fallback);
  app.get(executionHttpPaths.state, handlers.execution);
  app.post(executionHttpPaths.objective, handlers.execution);
  app.post(executionHttpPaths.decision, handlers.execution);
  app.head("/api/access", handlers.fallback);
  app.get("/api/access", handlers.management);
  app.post("/api/access", handlers.management);
  app.post("/api/access/credentials", handlers.credentials);
  app.post("/api/access/connection", handlers.fallback);
  app.post("/candidate/action", handlers.fallback);
  for (const path of [
    "/",
    "/index.html",
    "/project",
    "/topic",
    "/meeting",
    "/change",
    "/owner-artifact",
    "/api/workbench/view",
    "/api/ai-request",
    "/api/ai-selection",
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

// HTTP受信上限は内部State容量と分離し、従来の受信量を維持する。
const MAXIMUM_EXECUTION_REQUEST_BYTES = 3 * 16 * 1024 * 1024 + 16384;

/**
 * 定義照会又は明示保存を同じDomain操作へ一度だけ配送する。
 * @responsibility 保存不明を無保存へ変換せず、既知結果と現在公開認可を分ける。
 * @trace ARCH-000012
 * @input 既存HTTP前段の要求・Signal・Origin・Token・検証済みRoot。
 * @returns 当該応答又は開始済み同期保存の終了まで待機する。
 * @precondition 接続資格は共通前段で要求別に抽出する。
 * @postcondition 定義操作だけを許し、受付・承認・実行は発行しない。
 * @effect 明示POSTだけが既存Domain Writerで保存する。
 * @failure 閉入力拒否400、認可又はBody搬送拒否403、処置後の結果搬送不能503。再送しない。
 * @invariant Domain自身の検査・CAS・対象Hashを省略しない。
 * @boundary WorkbenchとCore定義のOwner。
 * @security Host Path・Error本文・Credentialを公開しない。
 * @concurrency 要求内認可だけを保持し、待機後に再確認する。
 */
export async function handleExecutionDefinition({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  capability,
  localAccessRoot,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  capability: Repository;
  localAccessRoot: FilesystemStoreRoot | undefined;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    const write = incoming.method === "POST";
    let repositoryId: string | null;
    let raw: unknown;
    if (write) {
      if (
        !origin ||
        incoming.headers.host !== new URL(origin).host ||
        incoming.headers.origin !== origin ||
        requestUrl.search !== "" ||
        incoming.headers["content-type"]?.split(";")[0]?.trim() !==
          "application/x-www-form-urlencoded"
      )
        throw new Error("runtime_input_invalid");
      const form = await readActionForm(
        incoming,
        MAXIMUM_EXECUTION_REQUEST_BYTES,
      );
      if (
        [...form.keys()].some(
          (key) => !["actionToken", "repositoryId", "command"].includes(key),
        ) ||
        form.getAll("actionToken").length !== 1 ||
        form.getAll("command").length !== 1 ||
        form.getAll("repositoryId").length > 1 ||
        form.get("actionToken") !== actionToken
      )
        throw new Error("runtime_input_invalid");
      repositoryId = form.get("repositoryId");
      raw = parseUnambiguousJsonDocument(form.get("command") ?? "");
    } else {
      if (
        incoming.method !== "GET" ||
        [...requestUrl.searchParams.keys()].some(
          (key) =>
            ![
              "repositoryId",
              "operation",
              "projectId",
              "milestoneId",
              "queueId",
            ].includes(key),
        ) ||
        ["operation", "projectId", "milestoneId"].some(
          (key) => requestUrl.searchParams.getAll(key).length !== 1,
        ) ||
        requestUrl.searchParams.getAll("repositoryId").length > 1 ||
        requestUrl.searchParams.getAll("queueId").length > 1
      )
        throw new Error("runtime_input_invalid");
      repositoryId = requestUrl.searchParams.get("repositoryId");
      raw = {
        operation: requestUrl.searchParams.get("operation"),
        projectId: requestUrl.searchParams.get("projectId"),
        milestoneId: requestUrl.searchParams.get("milestoneId"),
        ...(requestUrl.searchParams.has("queueId")
          ? { queueId: requestUrl.searchParams.get("queueId") }
          : {}),
      };
    }
    const command = validateExecutionDefinitionCommand(
      raw,
      write ? "write" : "read",
    );
    if (!command) throw new Error("runtime_input_invalid");
    if (requestSignal.aborted) throw new Error("runtime_access_unavailable");
    let access: DefinitionAccess | null = null;
    if (localAccessRoot) {
      if (repositoryId && credentialAdministration)
        access = resolveSharedDefinitionAccess(
          credentialAdministration.root,
          credentialAdministration.token,
          repositoryId,
          requestSignal,
        );
    } else {
      const root = resolveVerifiedRepositoryRoot(capability);
      if (repositoryId !== null || root === null)
        throw new Error("runtime_access_unavailable");
      const gitUser = readGitUser(capability);
      const principalId =
        gitUser.status === "completed"
          ? createLocalPrincipalId(gitUser.email)
          : null;
      if (!principalId) throw new Error("runtime_access_unavailable");
      access = createDefinitionAccess(
        capability,
        root,
        principalId,
        (operation) =>
          !requestSignal.aborted &&
          ["definition.read", "definition.write"].includes(operation) &&
          resolveVerifiedRepositoryRoot(capability) === root,
      );
    }
    if (!access) throw new Error("runtime_access_unavailable");
    dispatched = true;
    const result = executeDefinitionOperation(access, command);
    if (
      !access.revalidate(
        write ? "definition.write" : "definition.read",
        command.input as Parameters<typeof queryPlan>[1],
      )
    )
      throw new Error("runtime_access_unavailable");
    setResponseHeaders(response);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(result));
  } catch (error) {
    setResponseHeaders(response);
    response.statusCode = dispatched
      ? 503
      : error instanceof Error && error.message === "runtime_input_invalid"
        ? 400
        : 403;
    response.end("runtime_definition_unavailable\n");
  }
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
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  repositoryRoot: string;
  localAccessRoot: FilesystemStoreRoot | undefined;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  const shared = localAccessRoot !== undefined;
  const operation: CoordinatorExecutionOperation =
    requestUrl.pathname === executionHttpPaths.objective
      ? "objective"
      : requestUrl.pathname === executionHttpPaths.decision
        ? "decision"
        : "state";
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
    incoming.headers.host !== new URL(origin).host ||
    (incoming.headers.origin !== undefined &&
      incoming.headers.origin !== origin) ||
    (incoming.method === "POST" && incoming.headers.origin !== origin)
  ) {
    fail(403, "execution_access_unavailable");
    return;
  }
  if (shared && !credentialAdministration) {
    fail(403, "execution_access_unavailable");
    return;
  }
  try {
    if (operation !== "state") {
      if (
        incoming.method !== "POST" ||
        requestUrl.search !== "" ||
        incoming.headers["content-type"]?.split(";")[0]?.trim() !==
          "application/x-www-form-urlencoded"
      )
        throw new Error("execution_input_invalid");
      const form = await readActionForm(
        incoming,
        MAXIMUM_EXECUTION_REQUEST_BYTES,
      );
      if (
        [...form.keys()].some(
          (key) => !["actionToken", "repositoryId", "command"].includes(key),
        ) ||
        ["actionToken", "command"].some(
          (key) => form.getAll(key).length !== 1,
        ) ||
        form.getAll("repositoryId").length > 1
      )
        throw new Error("execution_input_invalid");
      if (form.get("actionToken") !== actionToken) {
        fail(403, "execution_access_unavailable");
        return;
      }
      repositoryId = form.get("repositoryId");
      const command = parseUnambiguousJsonDocument(form.get("command") ?? "");
      if (
        !command ||
        typeof command !== "object" ||
        Array.isArray(command) ||
        Object.hasOwn(command, "repositoryId")
      )
        throw new Error("execution_input_invalid");
      args = command as Readonly<Record<string, unknown>>;
    } else {
      const query = requestUrl.searchParams;
      const fields = ["requestId", "projectId", "repositoryRevision"];
      if (
        incoming.method !== "GET" ||
        [...query.keys()].some(
          (key) =>
            key !== "repositoryId" &&
            key !== "queueId" &&
            !fields.includes(key),
        ) ||
        fields.some((key) => query.getAll(key).length !== 1) ||
        query.getAll("repositoryId").length > 1 ||
        query.getAll("queueId").length > 1
      )
        throw new Error("execution_input_invalid");
      repositoryId = query.get("repositoryId");
      args = Object.fromEntries(fields.map((key) => [key, query.get(key)]));
      const queueId = query.get("queueId");
      if (queueId !== null) args = { ...args, queueId };
    }
    if (!shared && repositoryId !== null)
      throw new Error("execution_input_invalid");
  } catch {
    fail(400, "execution_input_invalid");
    return;
  }
  const outcome = await executeCoordinatorOperation(
    operation,
    shared ? { ...args, repositoryId } : args,
    shared
      ? { scope: "shared", credentials: credentialAdministration }
      : { scope: "local", repositoryRoot },
    requestSignal,
  );
  if (
    requestSignal.aborted ||
    response.destroyed ||
    outcome.kind === "cancelled"
  )
    return;
  if (outcome.kind === "result") {
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
 * 検査済み前段からWorkspaceの明示操作を処理する。
 * @responsibility Form検査、fresh認可、配送、公開前再確認を同じ要求へ結合する。
 * @trace ARCH-000012
 * @trace ARCH-000017
 * @input 当該要求・応答・Signal、URL、期待Origin・Action Token、検証済みRepository Root、当該要求の管理資格。
 * @returns 応答または取消後の既存Owner終了まで待つPromise。
 * @precondition 公開Origin・Header資格・共有操作経路の前段検査を完了している。
 * @postcondition 許可された一操作だけを配送し、現在認可と取消を確認した結果だけを公開する。
 * @effect 既存Coordinatorを通してWorkspace・Candidate・Git処置が発生し得る。
 * @failure 配送前拒否は400、配送後の結果未確認は503。取消・切断済み応答は公開しない。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、同じ操作を再送しない。
 * @boundary HTTP受付から既存Workspace Ownerと現在Repository認可へ接続する。
 * @security 当該Repositoryの現在development認可、Root同一性、manifestを処置前と公開前に確認する。
 * @concurrency 要求専用Signalを使用し、同期処理後にも通信通知を処理して取消を再確認する。
 */
export async function handleWorkspaceAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  repositoryRoot,
  localAccessRoot,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  repositoryRoot: string;
  localAccessRoot: FilesystemStoreRoot | undefined;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    if (
      !origin ||
      requestUrl.search !== "" ||
      incoming.headers.host !== new URL(origin).host ||
      incoming.headers.origin !== origin
    )
      throw new Error("workspace_input_invalid");
    const form = await readActionForm(incoming);
    const keys = ["actionToken", "repositoryId", "command"];
    if (
      [...form.keys()].some((key) => !keys.includes(key)) ||
      keys.some((key) => form.getAll(key).length !== 1) ||
      form.get("actionToken") !== actionToken
    )
      throw new Error("workspace_input_invalid");
    const repositoryId = form.get("repositoryId");
    if (
      !repositoryId ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId)
    )
      throw new Error("workspace_input_invalid");
    const rawCommand: unknown = JSON.parse(form.get("command") ?? "null");
    if (requestSignal.aborted || response.destroyed) return;
    const prepared = await prepareWorkspaceOperation(rawCommand, requestSignal);
    if (requestSignal.aborted || response.destroyed) return;
    if (!prepared) throw new Error("workspace_input_invalid");
    const { command, executeWorkspace, resolveLocalWorkspaceAccess } = prepared;
    await setTimeout(0);
    if (requestSignal.aborted || response.destroyed) return;
    const access =
      localAccessRoot === undefined
        ? resolveLocalWorkspaceAccess(
            repositoryRoot,
            repositoryId,
            requestSignal,
          )
        : credentialAdministration === undefined
          ? null
          : resolveSharedDevelopmentAccess(
              credentialAdministration.root,
              credentialAdministration.token,
              repositoryId,
              requestSignal,
            );
    if (!access) throw new Error("workspace_access_unavailable");
    const { ownerRoot, projectId, authorize } = access;
    dispatched = true;
    if (requestSignal.aborted || response.destroyed) return;
    const result = executeWorkspace(
      ownerRoot,
      projectId,
      command,
      authorize,
      requestSignal,
    );
    const body = JSON.stringify(result);
    await setTimeout(0);
    if (requestSignal.aborted || response.destroyed) return;
    if (!authorize()) throw new Error("workspace_result_unavailable");
    setResponseHeaders(response);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Length", Buffer.byteLength(body));
    response.end(body);
  } catch {
    if (!requestSignal.aborted && !response.destroyed) {
      setResponseHeaders(response);
      response.statusCode = dispatched ? 503 : 400;
      response.end(
        dispatched
          ? "workspace_outcome_unconfirmed\n"
          : "workspace_request_rejected\n",
      );
    }
  }
}

/**
 * 単体・共有のAI開始Formから実行受付に必要な入力だけを取り出す。
 * @responsibility 旧Profileを拒否し、明示選定のJSON構文と未指定を区別する。
 * @trace ARCH-000015
 * @boundary HTTP Formの同期検査。起動・認可・送信は行わない。
 */
function readAiRequestStartFields(form: URLSearchParams) {
  if (form.has("profileId"))
    throw new Error("workbench_ai_request_input_invalid");
  const explicit = form.get("choice");
  return {
    mode: form.get("mode"),
    explicitChoice: explicit
      ? parseUnambiguousJsonDocument(explicit)
      : undefined,
    requestId: form.get("requestId") ?? "",
    workType: form.get("workType"),
    prompt: form.get("prompt") ?? "",
    allowedPaths: form.get("allowedPaths") ?? "",
    workspaceId: form.get("workspaceId"),
  };
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

/**
 * 共有接続のAI依頼・観測・取消を処理する。
 * @responsibility 現在認可した資格とRepositoryへ結合した既存Sessionへ一回だけ配送する。
 * @trace ARCH-000015
 * @trace ARCH-000012
 * @input 当該HTTP要求・応答、URL・Origin・Action Token、当該資格、既存Session解決関数。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、既存Sessionの解決で共有操作の現在認可を確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存AI Ownerへ明示操作を渡し、既存Sessionの表示IDを更新する。
 * @failure 配送前400／配送後503を維持し、結果不明を再送しない。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleSharedAiRequest({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
  sharedAiSession,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
  sharedAiSession: (
    connection: CredentialAdministration | undefined,
    repositoryId: string,
    create: boolean,
  ) => { owner: AiRequests; currentId: string | null } | null;
}>): Promise<void> {
  let dispatched = false;
  try {
    if (
      !origin ||
      incoming.headers.origin !== origin ||
      incoming.headers.host !== new URL(origin).host ||
      requestUrl.search !== ""
    )
      throw new Error("workbench_ai_request_input_invalid");
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken || !credentialAdministration)
      throw new Error("workbench_ai_request_access_unavailable");
    const operation = form.get("operation");
    const repositoryId = form.get("repositoryId") ?? "";
    const session = sharedAiSession(
      credentialAdministration,
      repositoryId,
      operation === "start" ||
        operation === "observe" ||
        operation === "cancel",
    );
    if (!session) throw new Error("workbench_ai_request_access_unavailable");
    let result: Awaited<ReturnType<AiRequests["start"]>> | AiRequestSnapshot;
    if (operation === "start") {
      const request = prepareAiRequestStart(
        readAiRequestStartFields(form),
        "shared",
      );
      dispatched = true;
      result = await session.owner.start(request, requestSignal);
      if (result.status === "accepted") session.currentId = result.requestId;
    } else if (operation === "cancel" || operation === "observe") {
      const requestId = form.get("requestId") ?? "";
      const previous = requireAiRequestForAction(
        await session.owner.observe(requestId, requestSignal),
      );
      dispatched = true;
      result =
        operation === "cancel"
          ? await session.owner.cancel(requestId, requestSignal)
          : previous;
      if (session.currentId === null) session.currentId = requestId;
    } else throw new Error("workbench_ai_request_operation_invalid");
    if (!sharedAiSession(credentialAdministration, repositoryId, false))
      throw new Error("workbench_ai_request_access_unavailable");
    setResponseHeaders(response);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(result));
  } catch {
    setResponseHeaders(response);
    response.statusCode = dispatched ? 503 : 400;
    response.end(
      dispatched ? "ai_request_outcome_unconfirmed\n" : "ai_request_rejected\n",
    );
  }
  return;
}

/**
 * 単体接続のAI依頼・観測・取消を処理する。
 * @responsibility 既存入力検査と依頼ID照合、単体表示の更新順を維持する。
 * @trace ARCH-000015
 * @trace ARCH-000012
 * @input 当該HTTP要求・応答、Action Token、単体AI Ownerと単体表示状態。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みである。単体依頼の入力とOwner照合は本処理が行う。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存AI Ownerへ明示操作を一回渡し、非永続の表示値を更新する。
 * @failure 既存400固定拒否を維持し、Owner例外からrollbackを推定しない。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleAiRequestAction({
  incoming,
  response,
  requestSignal,
  actionToken,
  aiRequests,
  presentation,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  actionToken: string;
  aiRequests: AiRequests | undefined;
  presentation: Pick<
    WorkbenchPresentationState,
    "currentAiRequestId" | "aiRequestSnapshot" | "aiRequestNotice"
  >;
}>): Promise<void> {
  try {
    if (aiRequests === undefined)
      throw new Error("workbench_ai_request_application_unavailable");
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    const operation = form.get("operation");
    if (operation === "start") {
      const request = prepareAiRequestStart(
        readAiRequestStartFields(form),
        "local",
      );
      const result = await aiRequests.start(request, requestSignal);
      if (result.status === "accepted" && result.requestId !== null) {
        presentation.currentAiRequestId = result.requestId;
        presentation.aiRequestSnapshot = await aiRequests.observe(
          result.requestId,
        );
        presentation.aiRequestNotice = "AI依頼を受け付けました。";
      } else {
        presentation.aiRequestNotice = `AI依頼を開始できませんでした: ${result.reason ?? "blocked"}`;
      }
    } else if (operation === "cancel" || operation === "observe") {
      const requestId = form.get("requestId") ?? "";
      const previous = requireAiRequestForAction(
        await aiRequests.observe(requestId, requestSignal),
      );
      presentation.aiRequestSnapshot =
        operation === "cancel"
          ? await aiRequests.cancel(requestId, requestSignal)
          : previous;
      if (presentation.currentAiRequestId === null)
        presentation.currentAiRequestId = requestId;
      presentation.aiRequestNotice =
        operation === "cancel"
          ? "取消結果を取得しました。"
          : "保存済み依頼を確認しました。";
    } else {
      throw new Error("workbench_ai_request_operation_invalid");
    }
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader("Location", "/#ai-request");
    response.end();
  } catch {
    setResponseHeaders(response);
    response.statusCode = 400;
    response.end("ai_request_action_rejected\n");
  }
  return;
}

/**
 * 現在設定の取得又は一回のCAS保存を処理する。
 * @responsibility 入力拒否・既知保存・不明な出版と取消を混同しない。
 * @trace ARCH-000012
 * @input 検査済み前段の要求・応答・Origin・Token・Root・現在資格。
 * @returns 応答又は取消後の保存Owner終了まで待つPromise。
 * @precondition 既存HTTP前段とBody上限を維持する。
 * @postcondition 公開前に現在認可を再確認する。
 * @effect GETは読取りのみ、POSTは設定Ownerへ一回だけ保存を委譲する。
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
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  capability: Repository;
  localAccessRoot: FilesystemStoreRoot | undefined;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  let dispatched = false;
  try {
    const write = incoming.method === "POST";
    let form: URLSearchParams | null = null;
    if (write) {
      if (
        !origin ||
        incoming.headers.host !== new URL(origin).host ||
        incoming.headers.origin !== origin ||
        requestUrl.search !== "" ||
        incoming.headers["content-type"]?.split(";")[0]?.trim() !==
          "application/x-www-form-urlencoded"
      )
        throw new Error("ai_selection_input_invalid");
      // 1MiBのUTF-8 JSONとpercent encoding（最大3倍）・固定Form項目を収容する。
      form = await readActionForm(incoming, 3 * 1_024 * 1_024 + 16 * 1_024);
      const fields = [
        "actionToken",
        "repositoryId",
        "expectedIdentity",
        "config",
      ];
      if (
        [...form.keys()].some((key) => !fields.includes(key)) ||
        ["actionToken", "expectedIdentity", "config"].some(
          (key) => form?.getAll(key).length !== 1,
        ) ||
        form.getAll("repositoryId").length > 1 ||
        form.get("actionToken") !== actionToken
      )
        throw new Error("ai_selection_input_invalid");
    } else if (
      [...requestUrl.searchParams.keys()].some(
        (key) => key !== "repositoryId",
      ) ||
      requestUrl.searchParams.getAll("repositoryId").length > 1
    )
      throw new Error("ai_selection_input_invalid");
    await setTimeout(0);
    if (requestSignal.aborted || response.destroyed) return;
    const access = resolveAiSelectionAccess(
      capability,
      localAccessRoot,
      credentialAdministration,
      form?.get("repositoryId") ?? requestUrl.searchParams.get("repositoryId"),
      requestSignal,
    );
    if (!access.authorize()) throw new Error("ai_selection_access_unavailable");
    let result: AiSelectionReadResult | AiSelectionSaveResult;
    let writeRepository: Repository | null = null;
    if (form) {
      const expectedIdentity = form.get("expectedIdentity") || null;
      if (
        expectedIdentity !== null &&
        !/^[a-f0-9]{64}$/u.test(expectedIdentity)
      )
        throw new Error("ai_selection_input_invalid");
      const config = parseUnambiguousJsonDocument(form.get("config") ?? "");
      if (config === null) throw new Error("ai_selection_input_invalid");
      const verification = getRepository(access.repositoryRoot);
      if (verification.status !== "completed")
        throw new Error("ai_selection_access_unavailable");
      writeRepository = verification.capability;
      dispatched = true;
      result = updateAiSelection(
        access,
        writeRepository,
        { expectedIdentity, config },
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
      : incoming.method === "POST"
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
  credentialAdministration,
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
  credentialAdministration: CredentialAdministration | undefined;
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
  if (requestPath === "/api/ai-request") {
    await sendAiRequestObservation(
      response,
      requestSignal,
      method,
      async () => {
        const owner = aiRequests;
        const requestId = presentation.currentAiRequestId;
        if (
          requestUrl.search !== "" ||
          !owner ||
          !requestId ||
          !presentation.projectSurface ||
          !topicMeeting
        )
          return null;
        const snapshot = await owner.observe(requestId);
        return presentation.currentAiRequestId === requestId &&
          snapshot.requestId === requestId
          ? snapshot
          : null;
      },
    );
    return;
  }
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
            presentation.projectSurface.context.projectId,
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
        presentation.projectSurface.repository,
        requestUrl.searchParams.get("treeDirectory") ?? "",
        requestUrl.searchParams.get("treeCursor") ?? undefined,
        requestUrl.searchParams.get("diffPath"),
      ),
    );
    presentation.aiSelection = readAiSelectionView(repositoryRoot);
    const baseModel = readMainViewData(
      presentation.projectSurface,
      portfolio,
      actionToken,
      presentation.lastActionResult,
      credentialAdministration,
      connectionState,
      reader,
      topicPage,
      topicQuery,
      meetingPage,
      meetingQuery,
      presentation.recordActionResult,
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
          repositoryId === null,
          recordView,
        ),
      );
    }
    body =
      requestPath === "/api/workbench/view"
        ? JSON.stringify(responseModel)
        : assets.document;
    if (method === "GET" && requestPath === "/api/workbench/view") {
      presentation.recordActionResult = null;
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
  credentialAdministration,
  localConnectionNotice,
  actionToken,
  configuration,
  sharedAiSession,
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
  credentialAdministration: CredentialAdministration | undefined;
  localConnectionNotice: string | null;
  actionToken: string;
  configuration: Readonly<{
    sharedAiRequestsFactory?: unknown;
  }>;
  sharedAiSession: (
    connection: CredentialAdministration | undefined,
    repositoryId: string,
    create: boolean,
  ) => { owner: AiRequests; currentId: string | null } | null;
  assets: WorkbenchAssets;
  contract: string;
  host: string;
  healthPath: string;
}>): Promise<boolean> {
  if (requestPath === "/api/ai-request") {
    await sendAiRequestObservation(
      response,
      requestSignal,
      method,
      async () => {
        const ids = requestUrl.searchParams.getAll("repositoryId");
        const repositoryId = ids[0];
        if (
          ids.length !== 1 ||
          [...requestUrl.searchParams.keys()].length !== 1 ||
          !repositoryId ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId)
        )
          return null;
        const session = sharedAiSession(
          credentialAdministration,
          repositoryId,
          false,
        );
        const requestId = session?.currentId;
        if (!session || !requestId) return null;
        const snapshot = await session.owner.observe(requestId);
        return session.currentId === requestId &&
          snapshot.requestId === requestId &&
          sharedAiSession(credentialAdministration, repositoryId, false) ===
            session
          ? snapshot
          : null;
      },
    );
    return true;
  }
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
    let currentPortfolio: PortfolioProjection | null = null;
    let currentCollection: RepositoryAccessCollectionResult | null = null;
    if (credentialAdministration !== undefined) {
      try {
        currentCollection = resolveRepositoryAccessCollection(
          credentialAdministration.root,
          credentialAdministration.token,
        );
        if (currentCollection.status !== "completed")
          throw new Error("workbench_selected_content_unavailable");
        currentPortfolio = readAuthorizedPortfolio(
          currentCollection.repositories,
          requestSignal,
        );
      } catch {
        localConnectionNotice = "現在の内容を確認できません。";
      }
    }
    let model: ViewResponse = createAccessViewResponse(
      actionToken,
      localConnectionNotice,
      currentPortfolio,
      credentialAdministration,
    );
    const selectedId = requestUrl.searchParams.get("repositoryId");
    if (
      requestPath === "/api/workbench/view" &&
      selectedId !== null &&
      selectedId !== "" &&
      !(artifactSelection !== null && credentialAdministration === undefined)
    ) {
      try {
        if (
          !credentialAdministration ||
          currentPortfolio === null ||
          currentCollection?.status !== "completed" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(selectedId)
        )
          throw new Error("workbench_selected_content_unavailable");
        const selected =
          currentCollection.repositories.find(
            (entry) => entry.repositoryId === selectedId,
          ) ?? null;
        const records = resolveTopicMeetingAccess(
          currentCollection.repositories,
          selectedId,
          requestSignal,
          "workbench_local_records_unavailable",
        );
        if (!selected || !records)
          throw new Error("workbench_selected_content_unavailable");
        const root = selected.root;
        const verification = getRepository(root);
        if (verification.status !== "completed")
          throw new Error("workbench_selected_content_unavailable");
        const projectData = await readProjectViewData(root);
        if (requestSignal.aborted || response.destroyed) return true;
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
            currentCollection.repositories.filter(
              (entry) =>
                entry.manifest.projectId === selected.manifest.projectId,
            ),
            () =>
              !response.destroyed &&
              sameAccessCollection(
                currentCollection,
                resolveRepositoryAccessCollection(
                  credentialAdministration.root,
                  credentialAdministration.token,
                ),
              ),
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
        const selectedAi = sharedAiSession(
          credentialAdministration,
          selectedId,
          false,
        );
        const selectedAiSnapshot = selectedAi?.currentId
          ? await selectedAi.owner.observe(selectedAi.currentId)
          : null;
        const sharedSelection = readAiSelectionView(selected.root);
        const canManageSelection =
          credentialAdministration !== undefined &&
          evaluateAiProfileManagementPermission(
            credentialAdministration.root,
            credentialAdministration.token,
          ) === "allowed";
        model = readMainViewData(
          projectData,
          currentPortfolio,
          actionToken,
          null,
          credentialAdministration,
          "cros_available",
          reader,
          topicPage,
          topicQuery,
          meetingPage,
          meetingQuery,
          null,
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
          true,
          true,
        );
        if (requestSignal.aborted || response.destroyed) return true;
        if (
          !currentCollection ||
          !credentialAdministration ||
          !sameAccessCollection(
            currentCollection,
            resolveRepositoryAccessCollection(
              credentialAdministration.root,
              credentialAdministration.token,
            ),
          )
        )
          throw new Error("workbench_selected_content_unavailable");
        let network = null;
        if (selected.workspaceIds.includes("development")) {
          const owner = await import("@qual-lab/crdd-coordinator");
          if (requestSignal.aborted || response.destroyed) return true;
          if (
            !sameAccessCollection(
              currentCollection,
              resolveRepositoryAccessCollection(
                credentialAdministration.root,
                credentialAdministration.token,
              ),
            )
          )
            throw new Error("workbench_selected_content_unavailable");
          network = owner.readRepositoryNetworkHosts(verification.capability);
        }
        model = {
          ...model,
          aiSelection: sharedSelection,
          aiSelectionManagement: {
            snapshot: canManageSelection
              ? sharedSelection.selection.snapshot
              : null,
            allowed: canManageSelection,
            result: null,
          },
          aiRequest: {
            additionalHosts:
              network?.status === "ready" ? network.additionalHosts : null,
            configured:
              configuration.sharedAiRequestsFactory !== undefined &&
              selected.workspaceIds.includes("development"),
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
          model = createRecordDetailResponse(actionToken, selectedId, true, {
            kind,
            id,
            document,
            relations: reader.relations(kind, id),
          });
        } else if (artifactSelection !== null) {
          const markdown = await readArtifactMarkdown(
            root,
            projectData,
            artifactSelection,
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
    if (
      requestPath === "/api/workbench/view" &&
      currentCollection?.status === "completed" &&
      credentialAdministration !== undefined &&
      !sameAccessCollection(
        currentCollection,
        resolveRepositoryAccessCollection(
          credentialAdministration.root,
          credentialAdministration.token,
        ),
      )
    ) {
      if (requestSignal.aborted || response.destroyed) return true;
      setResponseHeaders(response);
      response.statusCode = 403;
      response.end("local_repository_access_unavailable\n");
      return true;
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

/**
 * 共有接続のRepository内容操作Formが現在のHTTP入口に対応するか確認する。
 * @responsibility Origin・Host・Query・Content-Typeだけを照合する。
 * @trace ARCH-000012
 * @boundary 対象の認可、Action Tokenと操作入力は各ハンドラーが確認する。
 */
function acceptsSharedRepositoryForm(
  incoming: IncomingMessage,
  requestUrl: URL,
  origin: string | null,
): boolean {
  if (!origin) return false;
  return (
    requestUrl.search === "" &&
    incoming.headers.host === new URL(origin).host &&
    incoming.headers.origin === origin &&
    incoming.headers["content-type"]?.split(";")[0]?.trim() ===
      "application/x-www-form-urlencoded"
  );
}

/**
 * Browser FormをCanonical Change Publication要求へ変換する。
 *
 * @responsibility 許可操作と必須fieldだけを選び、Human確認をboolean契約へ変換する。
 * @trace ARCH-000012
 * @input formに上限確認済みURLSearchParamsを受け取る。
 * @returns RepositoryActionRequestを返す。
 * @precondition CSRF相当Tokenは呼出し側で照合済みである。
 * @postcondition prepare、unprepare、create_revision、publish_revisionのいずれかだけを返す。
 * @effect N/A: Form値を構造化するだけである。
 * @failure 未知操作または確認なしpublishをErrorで拒否する。
 * @invariant FormからForce option、任意Commandまたは複数Pathを生成しない。
 * @boundary Workbench Browser FormとVersion Control Portの境界。
 * @security 未定義fieldを無視し、Credentialを扱わない。
 * @concurrency N/A: Request局所値だけを処理する。
 */
function createStandaloneRepositoryActionRequest(
  form: URLSearchParams,
): RepositoryActionRequest {
  const operation = form.get("operation");
  if (operation === "prepare" || operation === "unprepare")
    return Object.freeze({
      operation,
      paths: Object.freeze([form.get("path") ?? ""]),
    });
  if (operation === "create_revision")
    return Object.freeze({
      operation,
      message: form.get("message") ?? "",
    });
  if (operation === "publish_revision" && form.get("humanConfirmed") === "true")
    return Object.freeze({
      operation,
      destination: form.get("destination") ?? "",
      branch: form.get("branch") ?? "",
      revisionIdentity: form.get("revisionIdentity") ?? "",
      humanConfirmed: true,
    });
  throw new Error("workbench_repository_operation_invalid");
}

/**
 * Repository操作Formを配送前に閉検査する。
 * @responsibility 操作・対象・Token・scalar入力を一件ずつ確定する。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @input 上限確認済みForm、期待Token、共有接続かどうか。
 * @returns 選択Repository IDと既存Version Control要求。
 * @precondition Form搬送を終了し、HTTP Originを確認済みである。
 * @postcondition 任意field・重複・未確認公開を要求へ含めない。
 * @effect N/A: 入力だけを検査する。
 * @failure 不正入力を固定理由で拒否する。
 * @invariant 単体Rootを共有対象の代替にしない。
 * @boundary HTTP Formと現在認可前の要求境界。
 * @security Force・任意command・秘密・絶対Pathを受理しない。
 * @concurrency 要求局所値だけを返す。
 */
export function readRepositoryActionForm(
  form: URLSearchParams,
  expectedToken: string,
  shared: boolean,
): Readonly<{
  repositoryId: string | null;
  request: RepositoryActionRequest;
}> {
  const operation = form.get("operation");
  const operationFields =
    operation === "prepare" || operation === "unprepare"
      ? ["path"]
      : operation === "create_revision"
        ? ["message"]
        : operation === "publish_revision"
          ? ["destination", "branch", "revisionIdentity", "humanConfirmed"]
          : null;
  if (operationFields === null)
    throw new Error("repository_action_input_invalid");
  const requiredFields = [
    "operation",
    "actionToken",
    ...operationFields,
    ...(shared ? ["repositoryId"] : []),
  ];
  if (
    [...form.keys()].some((key) => !requiredFields.includes(key)) ||
    requiredFields.some((key) => form.getAll(key).length !== 1) ||
    form.get("actionToken") !== expectedToken
  )
    throw new Error("repository_action_input_invalid");
  const repositoryId = shared ? form.get("repositoryId") : null;
  if (
    shared &&
    (repositoryId === null ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId))
  )
    throw new Error("repository_action_input_invalid");
  let request: RepositoryActionRequest;
  if (operation === "prepare" || operation === "unprepare") {
    const selectedPath = form.get("path") ?? "";
    if (
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
    const message = form.get("message") ?? "";
    if (
      message.trim().length === 0 ||
      message.length > 4096 ||
      /[\u0000\u007f]/u.test(message)
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({ operation, message });
  } else {
    const destination = form.get("destination") ?? "";
    const branch = form.get("branch") ?? "";
    const revisionIdentity = form.get("revisionIdentity") ?? "";
    if (
      form.get("humanConfirmed") !== "true" ||
      [destination, branch, revisionIdentity].some(
        (value) =>
          value.length === 0 ||
          value.length > 4096 ||
          value.startsWith("-") ||
          /[\u0000-\u0020\u007f]/u.test(value),
      )
    )
      throw new Error("repository_action_input_invalid");
    request = Object.freeze({
      operation: "publish_revision",
      destination,
      branch,
      revisionIdentity,
      humanConfirmed: true,
    });
  }
  return Object.freeze({ repositoryId, request });
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
  credentialAdministration,
  localAccessRoot,
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
  credentialAdministration: CredentialAdministration | undefined;
  localAccessRoot: FilesystemStoreRoot | undefined;
  repositoryRoot: string;
  capability: Repository;
  presentation: Pick<
    WorkbenchPresentationState,
    "projectSurface" | "lastActionResult"
  >;
}>): Promise<void> {
  if (localAccessRoot !== undefined) {
    let dispatched = false;
    try {
      if (!acceptsSharedRepositoryForm(incoming, requestUrl, origin))
        throw new Error("workbench_repository_input_invalid");
      const form = await readActionForm(incoming);
      const validated = readRepositoryActionForm(form, actionToken, true);
      if (!credentialAdministration)
        throw new Error("workbench_repository_access_unavailable");
      await setTimeout(0);
      if (requestSignal.aborted || response.destroyed) return;
      const collection = resolveRepositoryAccessCollection(
        credentialAdministration.root,
        credentialAdministration.token,
      );
      if (collection.status !== "completed")
        throw new Error("workbench_repository_access_unavailable");
      const matches = collection.repositories.filter(
        (entry) => entry.repositoryId === validated.repositoryId,
      );
      if (matches.length !== 1)
        throw new Error("workbench_repository_access_unavailable");
      const selected = matches[0];
      if (!selected) throw new Error("workbench_repository_access_unavailable");
      await setTimeout(0);
      if (requestSignal.aborted || response.destroyed) return;
      if (
        !sameAccessCollection(
          collection,
          resolveRepositoryAccessCollection(
            credentialAdministration.root,
            credentialAdministration.token,
          ),
        )
      )
        throw new Error("workbench_repository_access_unavailable");
      const verification = getRepository(selected.root);
      if (verification.status !== "completed")
        throw new Error("workbench_repository_access_unavailable");
      assertRepositoryActionTarget(verification.capability, validated.request);
      dispatched = true;
      const result = inspectRepositoryActionResult(
        validated.request,
        executeRepositoryAction(verification.capability, validated.request),
      );
      const body = JSON.stringify(result);
      await setTimeout(0);
      if (requestSignal.aborted || response.destroyed) return;
      if (
        !sameAccessCollection(
          collection,
          resolveRepositoryAccessCollection(
            credentialAdministration.root,
            credentialAdministration.token,
          ),
        ) ||
        resolveVerifiedRepositoryRoot(verification.capability) !== selected.root
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
  try {
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    presentation.lastActionResult = executeRepositoryAction(
      capability,
      createStandaloneRepositoryActionRequest(form),
    );
    try {
      presentation.projectSurface = await readProjectViewData(repositoryRoot);
    } catch {
      presentation.projectSurface = withUnknownRepositoryObservation(
        presentation.projectSurface,
      );
    }
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader("Location", "/#repository");
    response.end();
  } catch {
    setResponseHeaders(response);
    response.statusCode = 400;
    response.end("repository_action_rejected\n");
  }
  return;
}

/**
 * 当該要求のTopic・Meeting操作を実行する。
 * @responsibility 単体と共有の入力・Domain処置・投影更新・公開前照合を同じ順序で維持する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 当該HTTP要求、応答、Signal、検査済みURLとOrigin、既存Ownerと必要な表示状態。
 * @returns 応答と当該Owner処理の終了を待つPromise。
 * @precondition 公開Originと接続形態ごとの共通前段を実行済みであり、共有操作の現在認可は本処理で確認する。
 * @postcondition 既存の処置・表示更新・結果公開の順序と固定結果を維持する。
 * @effect 既存Domainの保存・削除・昇格・Outcome処置と表示再取得を行う。
 * @failure 共有は配送前400／配送後503、単体は処置前400／処置後500を維持する。
 * @invariant 通信失敗を未処置やrollbackへ変換せず、自動再送しない。
 * @boundary Browser HTTPから既存専門Ownerへの直接接続。
 * @security 現在認可を省略せず、内部例外・資格・Rootを応答へ追加しない。
 * @concurrency 同じ要求の取消と終了待機を維持し、表示状態は読取り時点に同じ参照から取得する。
 */
export async function handleRecordAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
  localAccessRoot,
  repositoryRoot,
  topicMeeting,
  presentation,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
  localAccessRoot: FilesystemStoreRoot | undefined;
  repositoryRoot: string;
  topicMeeting: TopicMeetingAccess | undefined;
  presentation: Pick<
    WorkbenchPresentationState,
    "projectSurface" | "recordActionResult"
  >;
}>): Promise<void> {
  if (localAccessRoot !== undefined) {
    let dispatched = false;
    try {
      if (!acceptsSharedRepositoryForm(incoming, requestUrl, origin))
        throw new Error("workbench_record_input_invalid");
      const form = await readActionForm(incoming);
      validateTopicMeetingActionForm(form);
      if (form.get("actionToken") !== actionToken || !credentialAdministration)
        throw new Error("workbench_record_input_invalid");
      await setTimeout(0);
      if (requestSignal.aborted || response.destroyed) return;
      const collection = resolveRepositoryAccessCollection(
        credentialAdministration.root,
        credentialAdministration.token,
      );
      if (collection.status !== "completed")
        throw new Error("workbench_record_access_unavailable");
      const access = resolveTopicMeetingAccess(
        collection.repositories,
        form.get("repositoryId") ?? "",
        requestSignal,
        "workbench_local_records_unavailable",
      );
      if (!access || requestSignal.aborted)
        throw new Error("workbench_record_access_unavailable");
      dispatched = true;
      const result = executeTopicMeetingActionForm(access, form);
      const body = JSON.stringify({
        ...createTopicMeetingResultView(result),
        filesystemEffectCount: result.filesystemEffectCount,
      });
      await setTimeout(0);
      if (requestSignal.aborted || response.destroyed) return;
      if (
        !sameAccessCollection(
          collection,
          resolveRepositoryAccessCollection(
            credentialAdministration.root,
            credentialAdministration.token,
          ),
        )
      )
        throw new Error("workbench_record_publication_unavailable");
      sendResponseBody(response, "application/json; charset=utf-8", body);
    } catch {
      if (!requestSignal.aborted && !response.destroyed) {
        setResponseHeaders(response);
        response.statusCode = dispatched ? 503 : 400;
        response.end(
          dispatched
            ? "topic_meeting_action_outcome_unconfirmed\n"
            : "topic_meeting_action_rejected\n",
        );
      }
    }
    return;
  }
  let actionDispatched = false;
  try {
    if (presentation.projectSurface === undefined || topicMeeting === undefined)
      throw new Error("workbench_repository_access_unavailable");
    const form = await readActionForm(incoming);
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    const { kind, operation } = inspectStandaloneTopicMeetingAction(form);
    actionDispatched = true;
    const result = executeTopicMeetingActionForm(topicMeeting, form);
    presentation.recordActionResult =
      operation === "promote-topic" || operation === "treat-outcome"
        ? Object.freeze({ ...result, relationPaths: Object.freeze([]) })
        : result;
    presentation.projectSurface = await readProjectViewData(repositoryRoot);
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader(
      "Location",
      `/${kind === "topic" ? "#topics" : "#meetings"}`,
    );
    response.end();
  } catch {
    setResponseHeaders(response);
    response.statusCode = actionDispatched ? 500 : 400;
    response.end(
      actionDispatched
        ? "topic_meeting_action_failed\n"
        : "topic_meeting_action_rejected\n",
    );
  }
  return;
}

/**
 * 通常認証より先に接続専用Formを検証する。
 * @responsibility 初回限定資格と通常接続の確認を既存AMへ渡し、非秘密の接続結果だけを返す。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 当該HTTP要求・応答・SignalとURL、期待Origin・Action Token、明示的に構成した管理Root。
 * @returns 接続確認処理または取消後に終了するPromise。
 * @precondition 公開Origin境界とHeaderの前段検査を完了し、通常認証へ進めていない。
 * @postcondition 成功応答は固定completedだけで、生鍵・本人・内容を含めない。
 * @effect 接続確認が必要な場合に既存AMの確認保存が発生する。
 * @failure 入力・認証・保存不成立を固定400で拒否し、取消・切断済み要求へ応答しない。
 * @invariant 切断は他Browserの資格失効ではなく、保存済み確認をrollbackしない。
 * @boundary Browser接続要求と既存AM認証・確認保存Owner。
 * @security 同Origin・閉Form・Action Tokenを検証し、資格を応答や永続Sessionへコピーしない。
 * @concurrency 当該要求のSignalで待機後の公開を拒否し、次要求はfresh認証する。
 */
export async function handleLocalConnectionAction({
  incoming,
  response,
  requestSignal,
  requestUrl,
  origin,
  actionToken,
  localAccessRoot,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestSignal: AbortSignal;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  localAccessRoot: FilesystemStoreRoot;
}>): Promise<void> {
  try {
    if (
      !origin ||
      requestUrl.search !== "" ||
      incoming.headers.host !== new URL(origin).host ||
      incoming.headers.origin !== origin ||
      incoming.headers["content-type"]?.split(";")[0]?.trim() !==
        "application/x-www-form-urlencoded"
    )
      throw new Error("workbench_local_connection_input_invalid");
    const form = await readActionForm(incoming);
    if (form.get("operation") === "disconnect") {
      if (
        [...form.keys()].some(
          (key) => key !== "operation" && key !== "actionToken",
        ) ||
        form.getAll("operation").length !== 1 ||
        form.getAll("actionToken").length !== 1 ||
        form.get("actionToken") !== actionToken ||
        requestSignal.aborted
      )
        throw new Error("workbench_local_connection_input_invalid");
    } else {
      authenticateLocalConnectionForm(
        localAccessRoot,
        form,
        actionToken,
        requestSignal,
      );
    }
    if (requestSignal.aborted || response.destroyed) return;
    setResponseHeaders(response);
    const body = JSON.stringify({ status: "completed" });
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Length", Buffer.byteLength(body));
    response.end(body);
  } catch {
    if (!response.destroyed && !requestSignal.aborted) {
      setResponseHeaders(response);
      response.statusCode = 400;
      response.end("local_connection_rejected\n");
    }
  }
}

/**
 * 完全なWorkbench接続Formだけを現在の同Process認証へ渡す。
 * @responsibility 初回限定候補を既存確認保存へ接続し、通常認証を取り直してから接続資格を返す。
 * @trace ARCH-000013
 * @input 検証済み管理Root、容量とOrigin確認済みForm、起動専用Action Token、要求Signal。
 * @returns Server memory専用の接続資格を返す。認可結果ではなく、Browserへserializeしない。
 * @precondition Callerが同Origin・Host・Content-Type・Body上限を検査済みである。
 * @postcondition 初回相関から直接Roleや内容権限を生成せず、通常操作は次HTTP要求のfresh認証へ残す。
 * @effect AM既存認証、初回候補だけ既存確認保存とfresh再認証。
 * @failure 不正・重複・未知入力、認証不成立、確認不明、取消は固定例外で拒否する。
 * @invariant 管理RootはFormから取得せず、新Session・資格発行・自動再送を追加しない。
 * @boundary Browserの用途限定POSTとAM保存Owner。
 * @security 鍵・入力本文・内部Rootを例外へ含めず、永続化・log・応答へ渡さない。
 * @concurrency 保存前後に取消を確認する。保存後取消をrollbackと表示しない。
 */
export function authenticateLocalConnectionForm(
  root: FilesystemStoreRoot,
  form: URLSearchParams,
  expectedActionToken: string,
  signal: AbortSignal,
): CredentialAdministration {
  const fields = ["actionToken", "operation", "token"];
  const token = form.get("token");
  if (
    [...form.keys()].some((key) => !fields.includes(key)) ||
    fields.some((key) => form.getAll(key).length !== 1) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(expectedActionToken) ||
    form.get("actionToken") !== expectedActionToken ||
    form.get("operation") !== "connect" ||
    !token ||
    token.length > 4096 ||
    token.trim() !== token
  )
    throw new Error("workbench_local_connection_input_invalid");
  return confirmLocalCredentialConnection(root, token, signal);
}

/**
 * 用途限定の鍵管理HTTP応答を表す。
 * @responsibility 既存の管理POST契約を資格管理結果へ付与する。
 * @trace ARCH-000013
 * @shape 契約名と契約版、資格管理結果。
 * @invariant presentingは本人の受領を示さない。
 * @boundary Workbenchの鍵管理POSTだけ。
 * @security 秘密は成功時の一応答だけ。汎用GETやMCPへ流用しない。
 * @compatibility crdd/workbench/credential-action revision 1。
 */
export type CredentialAdministrationResult = Readonly<{
  contract: "crdd/workbench/credential-action";
  contractRevision: 1;
}> &
  CredentialActionResult;

/**
 * 閉じた管理Formを保存開始前に検査する。
 * @responsibility 旧権限field・重複・未知値をAM観測より先に拒否する。
 * @trace ARCH-000013
 * @input 上限確認済みURLSearchParams。
 * @returns 許可した操作と期待改訂。
 * @precondition Origin・Action TokenはHost入口が別途確認する。
 * @postcondition UUID生成・Root観測・保存0。
 * @effect N/A: Request局所値の検査だけ。
 * @failure 不正入力を固定例外で拒否する。
 * @invariant Browserから任意Root・Bearer・Role設定を受け取らない。
 * @boundary Browser Formと内部AM操作。
 * @security 例外へ入力本文や秘密を含めない。
 * @concurrency 同じFormを再更新・自動再送しない。
 */
function readCredentialAction(form: URLSearchParams): CredentialActionCommand {
  const operation = form.get("operation");
  if (
    operation !== "issue" &&
    operation !== "revoke" &&
    operation !== "exchange-user" &&
    operation !== "exchange-all"
  )
    throw new Error("workbench_credential_input_rejected");
  const allowed = ["actionToken", "operation", "expectedRevision", "userId"];
  if (operation === "revoke") allowed.push("credentialId");
  if (operation.startsWith("exchange-"))
    allowed.push(
      "displayedOldCredentialIds",
      "confirmed",
      "previousRecoveryId",
    );
  for (const key of form.keys())
    if (!allowed.includes(key) || form.getAll(key).length !== 1)
      throw new Error("workbench_credential_input_rejected");
  const revisionText = form.get("expectedRevision") ?? "";
  const expectedRevision = Number(revisionText);
  const userId = form.get("userId") ?? "";
  if (
    !/^[1-9]\d*$/.test(revisionText) ||
    !Number.isSafeInteger(expectedRevision) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      userId,
    )
  )
    throw new Error("workbench_credential_input_rejected");
  if (
    operation === "revoke" &&
    !/^[0-9a-f]{24}$/.test(form.get("credentialId") ?? "")
  )
    throw new Error("workbench_credential_input_rejected");
  let oldIds: string[] = [];
  if (operation.startsWith("exchange-")) {
    const parsed: unknown = JSON.parse(
      form.get("displayedOldCredentialIds") ?? "",
    );
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (id) => typeof id === "string" && /^[0-9a-f]{24}$/.test(id),
      ) ||
      new Set(parsed).size !== parsed.length
    )
      throw new Error("workbench_credential_input_rejected");
    oldIds = parsed;
    if (form.has("confirmed") && form.get("confirmed") !== "true")
      throw new Error("workbench_credential_input_rejected");
    if (
      form.has("previousRecoveryId") &&
      !/^access-management\.key-exchange\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        form.get("previousRecoveryId") ?? "",
      )
    )
      throw new Error("workbench_credential_input_rejected");
  }
  return {
    operation,
    expectedRevision,
    userId,
    oldIds,
    confirmed: form.get("confirmed") === "true",
    credentialId: form.get("credentialId") ?? "",
    previousRecoveryId: form.get("previousRecoveryId") ?? undefined,
  };
}

/**
 * 一回の管理JSON応答をfinishと先行故障から観測する。
 * @responsibility finishをClient受領へ強めず、自分のListenerと短命byteを回収する。
 * @trace ARCH-000013
 * @input Host所有Response、短命応答、取消Signal。
 * @returns 全byteのfinishと通知tickまで故障なしの場合だけtrue。
 * @precondition 既存Security HeaderをHostが設定済み。
 * @postcondition 応答一回、秘密Buffer消去、自分のListenerだけ回収。
 * @effect Node Responseへのend一回。失敗時の再送0。
 * @failure error・finish前close・abortはfalse。開始済みResponseの終了を待つ。
 * @invariant finishはブラウザ描画・本人閲覧の証明ではない。
 * @boundary 管理POSTとHTTP socket。
 * @security no-store、URL／Location／汎用GET保存0。
 * @concurrency 同Responseに追加出力せず、開始後取消は所有Responseを破棄してcloseを待つ。
 */
async function presentCredentialResponse(
  response: ServerResponse,
  value: CredentialActionResult,
  signal: AbortSignal,
): Promise<boolean> {
  const payload: CredentialAdministrationResult = {
    contract: "crdd/workbench/credential-action",
    contractRevision: 1,
    ...value,
  };
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  if (signal.aborted || response.destroyed) {
    bytes.fill(0);
    return false;
  }
  return new Promise((resolve) => {
    let failed = false,
      joined = false;
    const finish = () => settle(true);
    const error = () => {
      failed = true;
      if (!response.destroyed) response.destroy();
    };
    const close = () => {
      if (!response.writableFinished) failed = true;
      settle(response.writableFinished);
    };
    const abort = () => {
      failed = true;
      response.destroy();
    };
    const settle = (finished: boolean) => {
      if (joined) return;
      joined = true;
      bytes.fill(0);
      setImmediate(() => {
        response.removeListener("finish", finish);
        response.removeListener("error", error);
        response.removeListener("close", close);
        signal.removeEventListener("abort", abort);
        resolve(finished && !failed && !signal.aborted);
      });
    };
    response.on("finish", finish);
    response.on("error", error);
    response.on("close", close);
    signal.addEventListener("abort", abort, { once: true });
    try {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Content-Length", bytes.length);
      response.statusCode = value.status === "blocked" ? 409 : 200;
      response.end(bytes);
    } catch {
      failed = true;
      response.destroy();
      if (response.destroyed) settle(false);
    }
  });
}

/**
 * 生鍵を返す管理操作を専用HTTP応答へ接続する。
 * @responsibility 鍵Formの入力検査と一度だけの応答搬送を既存資格Ownerへ委譲する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input HTTP要求・応答、期待OriginとAction Token、当該要求の管理資格。
 * @returns 鍵操作の終了と要求監視解除を待つPromise。
 * @precondition 公開Origin・通常認証・共有操作経路の前段検査を完了している。
 * @postcondition 操作結果の応答と提示の確認を既存Ownerが相関し、秘密を通常画面へ保存しない。
 * @effect 既存Ownerを通して鍵の発行・失効・交換と専用応答が発生し得る。
 * @failure 応答前の入力・接続不成立は固定400。応答開始後の失敗を新たな鍵発行で補わない。
 * @invariant 再表示・自動再送・暗黙再発行・独自の資格保存を行わない。
 * @boundary Browser専用鍵応答と既存Credential Administration。
 * @security Host・Origin・形式・Action Tokenを確認し、生鍵はこの専用応答だけに渡す。
 * @concurrency 当該操作の取消と実処理終了を分け、Owner Promiseをjoinしてから監視を解除する。
 */
export async function handleCredentialManagement({
  incoming,
  response,
  origin,
  actionToken,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  try {
    if (credentialAdministration === undefined)
      throw new Error("workbench_credential_administration_unavailable");
    if (
      !origin ||
      incoming.headers.host !== new URL(origin).host ||
      (incoming.headers.origin !== undefined &&
        incoming.headers.origin !== origin) ||
      incoming.headers["content-type"]?.split(";")[0]?.trim() !==
        "application/x-www-form-urlencoded"
    )
      throw new Error("workbench_credential_origin_rejected");
    const form = await readActionForm(incoming);
    if (incoming.aborted || response.destroyed) return;
    if (form.get("actionToken") !== actionToken)
      throw new Error("workbench_action_token_invalid");
    setResponseHeaders(response);
    const cancellation = observeConnectionCancellation(incoming, response);
    try {
      const command = readCredentialAction(form);
      if (response.destroyed) return;
      await executeCredentialAction(
        credentialAdministration,
        command,
        cancellation.signal,
        (value) =>
          presentCredentialResponse(response, value, cancellation.signal),
      );
    } finally {
      cancellation.dispose();
    }
  } catch {
    if (!response.headersSent && !response.destroyed) {
      setResponseHeaders(response);
      response.statusCode = 400;
      response.end("credential_action_rejected\n");
    }
  }
}

const FIELDS = {
  registerUser: ["username", "plannedRole"],
  updateUserName: ["userId", "username"],
  updateUserRole: ["userId", "currentRole", "nextRole"],
  updateRoleContentAccess: ["targetRole", "workspaceIds"],
  registerRepository: ["repositoryId", "repositoryRoot"],
  unregisterRepository: ["repositoryId"],
  updateExposure: ["repositoryId", "workspaceIds"],
} as const;

/**
 * 閉じたFormを操作固有引数へ固定する。
 * @responsibility 未知・重複fieldをAM／Network前に拒否する。
 * @trace ARCH-000013
 * @input Origin・Token・容量確認済みForm。
 * @returns 操作名と現在変更入力。
 * @precondition Callerが要求の取消を処置する。
 * @postcondition 資格や管理Rootを入力から生成しない。
 * @effect N/A: Form値検査だけ。
 * @failure 不正入力は固定例外。
 * @invariant 表示可否はAM実行認可を代替しない。
 * @boundary Browser Formと既存操作API。
 * @security 任意MethodやMCP Tool指定を受けない。
 * @concurrency 受付IDと表示改訂を一回の操作へ保持する。
 */
function command(form: URLSearchParams) {
  const operation = form.get("operation");
  if (!operation || !Object.hasOwn(FIELDS, operation))
    throw new Error("workbench_management_input_invalid");
  const fields = FIELDS[operation as keyof typeof FIELDS];
  const allowed = new Set<string>([
    "operation",
    "actionToken",
    "operationId",
    "expectedRevision",
    ...fields,
  ]);
  for (const key of form.keys())
    if (
      !allowed.has(key) ||
      (key !== "workspaceIds" && form.getAll(key).length !== 1)
    )
      throw new Error("workbench_management_input_invalid");
  const operationId = form.get("operationId"),
    expectedRevision = Number(form.get("expectedRevision"));
  if (
    !operationId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      operationId,
    ) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    form.getAll("actionToken").length !== 1
  )
    throw new Error("workbench_management_input_invalid");
  const args: Record<string, unknown> = { operationId, expectedRevision };
  for (const field of fields) {
    if (field === "workspaceIds") {
      const values = form.getAll(field);
      if (
        values.length > 2 ||
        new Set(values).size !== values.length ||
        values.some((x) => x !== "development" && x !== "management")
      )
        throw new Error("workbench_management_input_invalid");
      args[field] = values;
    } else {
      if (form.getAll(field).length !== 1)
        throw new Error("workbench_management_input_invalid");
      args[field] = form.get(field);
    }
  }
  return {
    operation: operation as keyof typeof FIELDS,
    args,
    expectedRevision,
    operationId,
  };
}

/**
 * 現在本人または管理対象を一回だけ読み取る。
 * @responsibility 各readの改訂と拒否／不明を分離する。
 * @trace ARCH-000013
 * @input 構成接続、固定view、所有Signal。
 * @returns 同じAM共通投影。
 * @precondition viewは閉GETで検査済み。
 * @postcondition 別改訂を同一Snapshotへ合成しない。
 * @effect 現在AM read一回。
 * @failure 拒否・不明は固定共通結果、搬送故障は固定例外。
 * @invariant 他ユーザー管理から本人を推定しない。
 * @boundary Workbenchの同Process入口。
 * @security Path・資格・Binding非公開。
 * @concurrency 開始前取消は呼出し0。終了後にCallerが公開を処置する。
 */
function readManagementResponse(
  context: CredentialAdministration,
  view: ManagementView,
  signal: AbortSignal,
): ManagementResult {
  if (signal.aborted) throw new Error("workbench_management_cancelled");
  const { root, token } = context;
  return view === "current"
    ? readCurrentAccess(root, token)
    : readManagementState(
        root,
        token,
        view === "roles"
          ? "roleContentAccess"
          : view === "repositories"
            ? "registeredRepositories"
            : view,
      );
}

/**
 * 明示Formの通常管理を既存Ownerへ一回委譲する。
 * @responsibility Repository登録と共通六保存の同型結果を保持する。
 * @trace ARCH-000013
 * @input 構成接続、検査済みTransportのForm、所有Signal。
 * @returns AMの非秘密保存結果。
 * @precondition CallerがOrigin／Action Token／容量を確認する。
 * @postcondition 再送・保存取消・新Storeを作らない。
 * @effect AM明示保存一回。
 * @failure 入力拒否と保存後の不明を別に扱う。
 * @invariant 新登録だけでは公開しない。解除は本体削除ではない。
 * @boundary Browser明示操作から同じ保存Owner。
 * @security Root入力は明示登録の対象だけ、管理Rootは内部構成、Bearerは当該要求内だけ。
 * @concurrency 期待改訂と受付IDを保持し、開始前取消はEffect0。
 */
function executeManagementRequest(
  context: CredentialAdministration,
  form: URLSearchParams,
  signal: AbortSignal,
): ManagementResult {
  const { operation, args, expectedRevision, operationId } = command(form);
  if (signal.aborted) throw new Error("workbench_management_cancelled");
  return executeManagementOperation(
    context,
    operation,
    args,
    expectedRevision,
    operationId,
  );
}

/**
 * 当該要求の管理一覧または保存を処理する。
 * @responsibility Origin・Query・Formを確認し、Owner結果の搬送と切断時の終了待機を行う。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input HTTP要求・応答、既に解釈済みのURLと期待Origin、Action Token、当該要求の資格Context。
 * @returns 管理処理と監視解除を終えるPromise。
 * @precondition 公開Origin・Header資格・共有操作経路の前段検査を完了している。
 * @postcondition 許可された管理操作の非秘密結果だけを返し、取消・切断済み要求へ結果を公開しない。
 * @effect 既存管理Ownerへの読取りまたは明示保存を一回発行する。
 * @failure 入力拒否400と内部接続失敗503を固定結果へ変換し、容量超過を通常結果へ丸めない。
 * @invariant 管理Roleを内容アクセスや資格発行のAuthorityへ転用しない。
 * @boundary Browser HTTPから既存管理操作とAM公開APIへの直接接続。
 * @security Host・Origin・閉じたview・Action Tokenを確認し、自由な例外本文・Root・生鍵を公開しない。
 * @concurrency 要求専用取消をOwnerへ渡し、そのPromise終了を待ってから監視を解除する。
 */
export async function handleAccessManagement({
  incoming,
  response,
  requestUrl,
  origin,
  actionToken,
  credentialAdministration,
}: Readonly<{
  incoming: IncomingMessage;
  response: ServerResponse;
  requestUrl: URL;
  origin: string | null;
  actionToken: string;
  credentialAdministration: CredentialAdministration | undefined;
}>): Promise<void> {
  const method = incoming.method ?? "";
  const cancellation = observeConnectionCancellation(incoming, response);
  const pending = (async () => {
    try {
      if (
        !origin ||
        incoming.headers.host !== new URL(origin).host ||
        (incoming.headers.origin !== undefined &&
          incoming.headers.origin !== origin)
      )
        throw new Error("workbench_management_input_invalid");
      const connection = credentialAdministration;
      setResponseHeaders(response);
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader(
        "x-crdd-management-mode",
        connection === undefined ? "none" : "local",
      );
      // 切断の観測機会を現在認可より前に置く。Ownerの認可・結果と公開の間に待機を置かない。
      await setTimeout(0);
      let result: unknown;
      if (method === "GET") {
        const view = requestUrl.searchParams.get("view");
        if (
          !view ||
          !["current", "users", "roles", "repositories", "exposure"].includes(
            view,
          ) ||
          [...requestUrl.searchParams.keys()].some((key) => key !== "view") ||
          requestUrl.searchParams.getAll("view").length !== 1
        )
          throw new Error("workbench_management_input_invalid");
        if (
          cancellation.signal.aborted ||
          incoming.aborted ||
          response.destroyed
        )
          return;
        result =
          connection === undefined
            ? {
                status: "unavailable",
                reason: "management_not_configured",
              }
            : readManagementResponse(
                connection,
                view as ManagementView,
                cancellation.signal,
              );
      } else {
        if (
          !connection ||
          incoming.headers["content-type"]?.split(";")[0]?.trim() !==
            "application/x-www-form-urlencoded"
        )
          throw new Error("workbench_management_input_invalid");
        const form = await readActionForm(incoming);
        if (form.get("actionToken") !== actionToken)
          throw new Error("workbench_management_input_invalid");
        if (
          cancellation.signal.aborted ||
          incoming.aborted ||
          response.destroyed
        )
          return;
        result = executeManagementRequest(
          connection,
          form,
          cancellation.signal,
        );
      }
      if (cancellation.signal.aborted || response.destroyed) return;
      const body = JSON.stringify(result);
      response.end(body);
    } catch (error) {
      if (
        !response.headersSent &&
        !response.destroyed &&
        !cancellation.signal.aborted
      ) {
        setResponseHeaders(response);
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.statusCode =
          error instanceof Error &&
          error.message === "workbench_management_input_invalid"
            ? 400
            : 503;
        response.end(
          JSON.stringify({
            status: "unavailable",
            reason: "management_transport_unavailable",
          }),
        );
      }
    }
  })();
  try {
    await pending;
  } finally {
    cancellation.dispose();
  }
}

/**
 * 本番Readerを同じ位置で呼び、主画面の非秘密Modelを構築する。
 * @responsibility Record本文・Relationと資格管理の現在観測を表示へ結合する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 既存のProject投影、ページ・検索条件、要求ごとの接続資格と表示用Owner／結果。
 * @returns 現行の固定契約に従う主画面Model。
 * @precondition 呼出し側が対象Repositoryの入力・現在認可を検査する。
 * @postcondition Record Readerの後に資格管理Readerを呼び、失敗の意味と例外を変えない。
 * @effect Record Readerおよび資格管理Readerの既存観測を実行する。純粋変換ではない。
 * @failure Reader例外を呼出し側へ伝播し、資格観測不能は既存unavailableを維持する。
 * @invariant Snapshotを認可根拠へ昇格せず、観測結果を別要求へcacheしない。
 * @boundary 本番ReaderとBrowserへの表示Model。
 * @security 資格・内部保存情報・Root AuthorityをModelへ追加しない。
 * @concurrency 同じ引数の読取り順を維持し、先行観測や並列化を追加しない。
 */
function readMainViewData(
  projectData: ProjectViewData,
  portfolio: PortfolioProjection | undefined,
  actionToken: string,
  lastResult: ChangesResult | null,
  credentialAdministration: CredentialAdministration | undefined,
  connectionState: WorkbenchConnectionState,
  topicMeeting: RecordDocumentReader,
  topicPage: TopicMeetingPage,
  topicQuery: TopicMeetingListQuery,
  meetingPage: TopicMeetingPage,
  meetingQuery: TopicMeetingListQuery,
  recordActionResult: TopicMeetingActionResult | null,
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
  repositoryActionsConfigured = connectionState === "repository",
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
    recordActionResult: createTopicMeetingResultView(recordActionResult),
    selectedRepositoryId: selectedRepositoryId ?? null,
    recordActionsConfigured,
    repositoryActionsConfigured,
    repositoryResult: lastResult,
    worktree,
    credentials: readCredentialAdministrationView(credentialAdministration),
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

function matchesRecordId(
  kind: ProjectOperationRecordKind,
  id: string,
): boolean {
  return (kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u).test(id);
}

function inspectWriteMarkdown(
  kind: ProjectOperationRecordKind,
  operation: string | null,
  markdown: string,
): void {
  if (operation !== "create" && operation !== "update") return;
  if (kind === "topic") parseTopicMarkdown(markdown);
  else parseMeetingMarkdown(markdown);
}

/**
 * 内容操作Formを操作別の閉集合として検査する。
 * @responsibility scalar重複と未知fieldを認可・配送前に拒否する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 搬送済みForm。
 * @returns N/A: 不正入力は固定例外。
 * @precondition Originと容量はHTTP入口で確認済み。
 * @postcondition createへIDや改訂を要求せず既存操作条件を保持する。
 * @effect N/A: 入力解析だけ。
 * @failure 契約外Formを拒否する。
 * @invariant 認可・保存・公開成立を生成しない。
 * @boundary HTTP Formと既存Domain操作。
 * @security 任意Root・Path・commandを受理しない。
 * @concurrency N/A: 同期検査。
 */
export function validateTopicMeetingActionForm(form: URLSearchParams): void {
  const kind = form.get("kind");
  const operation = form.get("operation");
  const specific =
    operation === "create"
      ? ["markdown"]
      : operation === "update"
        ? ["id", "expectedRevision", "markdown"]
        : operation === "delete"
          ? ["id", "expectedRevision", "confirmed"]
          : operation === "promote-topic" && kind === "topic"
            ? [
                "id",
                "expectedRevision",
                "changeId",
                "reason",
                "remainingResponsibility",
              ]
            : operation === "treat-outcome" && kind === "meeting"
              ? [
                  "id",
                  "expectedRevision",
                  "outcomeId",
                  "disposition",
                  "owner",
                  "reviewTrigger",
                  "targetKind",
                  "targetReference",
                  "treatment",
                  "completionCondition",
                  "result",
                  "closeMeeting",
                ]
              : null;
  const allowed = new Set([
    "kind",
    "operation",
    "repositoryId",
    "actionToken",
    ...(specific ?? []),
  ]);
  if (
    (kind !== "topic" && kind !== "meeting") ||
    specific === null ||
    [...allowed].some((key) => form.getAll(key).length !== 1) ||
    [...form.keys()].some(
      (key) => !allowed.has(key) || form.getAll(key).length !== 1,
    ) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
      form.get("repositoryId") ?? "",
    ) ||
    form.getAll("actionToken").length !== 1
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation === "delete" &&
    !["true", "false"].includes(form.get("confirmed") ?? "")
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation === "promote-topic" &&
    !/^CHG-\d{6}$/u.test(form.get("changeId") ?? "")
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation === "treat-outcome" &&
    (!/^OUT-\d{3,}$/u.test(form.get("outcomeId") ?? "") ||
      !["true", "false"].includes(form.get("closeMeeting") ?? "") ||
      !["completed", "transferred", "promoted", "rejected"].includes(
        form.get("disposition") ?? "",
      ) ||
      !["topic", "change", "owner", "none"].includes(
        form.get("targetKind") ?? "",
      ) ||
      (form.get("targetKind") === "topic" &&
        !/^TOPIC-\d{6}$/u.test(form.get("targetReference") ?? "")) ||
      (form.get("targetKind") === "change" &&
        !/^CHG-\d{6}$/u.test(form.get("targetReference") ?? "")))
  )
    throw new Error("workbench_record_input_invalid");
  if (
    operation !== "create" &&
    (!matchesRecordId(kind, form.get("id") ?? "") ||
      !/^[1-9]\d*$/u.test(form.get("expectedRevision") ?? "") ||
      !Number.isSafeInteger(Number(form.get("expectedRevision"))))
  )
    throw new Error("workbench_record_input_invalid");
  inspectWriteMarkdown(kind, operation, form.get("markdown") ?? "");
}

/**
 * 検査済み操作を今回のDomain Ownerへ一回配送する。
 * @responsibility Transport入力だけを既存操作へ変換し結果意味を変更しない。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input 今回認可済み操作と検査済みForm。
 * @returns 既存Domainの操作結果。
 * @precondition Form、AM集合、対象Identity、取消をCallerが確認済み。
 * @postcondition 別Rootへのfallbackや自動再送はない。
 * @effect 選択RepositoryのDomain操作一回。
 * @failure Owner例外はCallerへ伝播し未保存へ畳まない。
 * @invariant Domainの改訂・Relation・Close条件を再定義しない。
 * @boundary 要求専用Domain操作とHTTP Caller。
 * @security 資格をDomainへ渡さない。
 * @concurrency 同期Ownerの終了を待ち保存後取消でrollbackしない。
 */
function executeTopicMeetingActionForm(
  access: TopicMeetingAccess,
  form: URLSearchParams,
) {
  const kind = form.get("kind") === "topic" ? "topic" : "meeting";
  const operation = form.get("operation");
  const id = form.get("id") ?? "";
  const expectedRevision = Number(form.get("expectedRevision"));
  let write: RecordWriteCommand | undefined;
  if (operation === "create")
    write = { operation, input: form.get("markdown") ?? "" };
  else if (operation === "update")
    write = {
      operation,
      input: { id, expectedRevision, markdown: form.get("markdown") ?? "" },
    };
  else if (operation === "delete")
    write = {
      operation,
      input: {
        id,
        expectedRevision,
        confirmed: form.get("confirmed") === "true",
        reason: "mistaken_registration",
      },
    };
  if (write)
    return kind === "topic"
      ? executeTopicAction(access.topic, write)
      : executeMeetingAction(access.meeting, write);
  if (operation === "promote-topic")
    return {
      ...executeTopicAction(access.topic, {
        operation: "promote",
        input: {
          topicId: id,
          expectedRevision,
          changeId: form.get("changeId") ?? "",
          reason: form.get("reason") ?? "",
          remainingResponsibility: form.get("remainingResponsibility") ?? "",
        },
      }),
      relationPaths: [],
    };
  if (operation === "treat-outcome")
    return {
      ...executeMeetingAction(access.meeting, {
        operation: "treat-outcome",
        input: {
          meetingId: id,
          expectedRevision,
          outcomeId: form.get("outcomeId") ?? "",
          disposition: form.get("disposition") as
            | "completed"
            | "transferred"
            | "promoted"
            | "rejected",
          owner: form.get("owner") ?? "",
          reviewTrigger: form.get("reviewTrigger") ?? "",
          target: {
            kind: form.get("targetKind") as
              | "topic"
              | "change"
              | "owner"
              | "none",
            reference: form.get("targetReference") ?? "",
          },
          treatment: form.get("treatment") ?? "",
          completionCondition: form.get("completionCondition") ?? "",
          result: form.get("result") ?? "",
          closeMeeting: form.get("closeMeeting") === "true",
        },
      }),
      relationPaths: [],
    };
  throw new Error("workbench_record_operation_invalid");
}

/**
 * 単体WorkbenchのTopic・Meeting操作の判定を所有する。
 * @responsibility 種別、操作、対象参照、改訂とMarkdownを確認する。共有Formの受理条件とは混ぜない。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary HTTPのForm解析・Action Token確認後、保存操作を発行する前に呼ぶ。
 */
function inspectStandaloneTopicMeetingAction(form: URLSearchParams) {
  const kind = form.get("kind");
  const operation = form.get("operation");
  if (kind !== "topic" && kind !== "meeting")
    throw new Error("workbench_record_kind_invalid");
  if (
    !["create", "update", "delete"].includes(operation ?? "") &&
    !(operation === "promote-topic" && kind === "topic") &&
    !(operation === "treat-outcome" && kind === "meeting")
  )
    throw new Error("workbench_record_operation_invalid");
  if (operation !== "create") {
    const revision = Number(form.get("expectedRevision"));
    if (
      !matchesRecordId(kind, form.get("id") ?? "") ||
      !Number.isSafeInteger(revision) ||
      revision < 1
    )
      throw new Error("workbench_record_input_invalid");
  }
  if (
    (operation === "promote-topic" &&
      !/^CHG-\d{6}$/u.test(form.get("changeId") ?? "")) ||
    (operation === "treat-outcome" &&
      ((form.get("targetKind") === "topic" &&
        !/^TOPIC-\d{6}$/u.test(form.get("targetReference") ?? "")) ||
        (form.get("targetKind") === "change" &&
          !/^CHG-\d{6}$/u.test(form.get("targetReference") ?? ""))))
  )
    throw new Error("workbench_record_reference_invalid");
  inspectWriteMarkdown(kind, operation, form.get("markdown") ?? "");
  return { kind, operation };
}
