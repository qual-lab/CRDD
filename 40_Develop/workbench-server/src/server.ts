/**
 * Workbench Production Shellのlocalhost Server。
 *
 * @packageDocumentation
 * @responsibility Direction AのWorkbench Shellと公式ロゴをloopback限定で配信する。
 * @trace ARCH-000005
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000009
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @trace ARCH-000015
 * @trace ARCH-000017
 * @boundary BrowserとWorkbench Application Adapterのlocalhost HTTP境界。
 * @effect localhost Listenerを開始・終了し、承認済みBrand Assetを読取る。
 * @security 外部Bind、任意Filesystem参照、Force Pushおよび未確認公開を許可せず、Credential管理は検証済み管理Contextの注入時だけ許可する。
 */

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import path from "node:path";
import { setTimeout as yieldToTransport } from "node:timers/promises";
import {
  type RepositoryAccessCollectionResult,
  readCredentialAdministrationState,
  evaluateAiProfileManagementPermission,
  resolveConnectionAuthentication,
  resolveRepositoryAccess,
  resolveRepositoryAccessCollection,
  sameAccessCollection,
} from "../../access-management/src/index.ts";
import {
  type AiModelTier,
  type AiProfileCatalogAdministration,
  type AiProfileCatalogMutation,
  type AiProfileCatalogMutationResult,
  type AiProfileCatalogSnapshot,
  type AiProfileDefinition,
  type AiReasoningEffort,
  type AiSelectionRole,
  createAiProfileCatalogAdministration,
  createRepositoryAiProfileCatalogStore,
  validateAiProfileCatalog,
  validateAiProfileMutationResult,
} from "../../ai-adapter/src/index.ts";
import type {
  FilesystemStoreRoot,
  MeetingOutcomeCommandResult,
  PortfolioProjection,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingWriteResult,
  TopicPromotionCommandResult,
} from "../../domain-model/src/index.ts";
import {
  createFilesystemRepositoryObservationPort,
  createMeetingOperations,
  createTopicOperations,
  inspectRepositoryManifest,
  parseMeetingMarkdown,
  parseTopicMarkdown,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "../../domain-model/src/index.ts";
import {
  executeWorkspaceCommand,
  inspectWorkspaceCommand,
  readAuthorizedRuntimeActivity,
} from "../../orchestrator/src/index.ts";
import {
  type ChangePublicationRequest,
  type ChangePublicationResult,
  executeChangePublication,
  gitChangePublicationAdapter,
  gitChangePublicationTargetObservationAdapter,
  gitRepositoryWorktreeViewAdapter,
  observeChangePublicationTarget,
  observeRepositoryWorktreeFileDiff,
  observeRepositoryWorktreeTree,
  type RepositoryWorktreeFileDiff,
  type RepositoryWorktreeTreePage,
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../version-control/src/index.ts";
import {
  createRepositoryWorkbenchActivityReader,
  projectRuntimeActivityForWorkbench,
  type WorkbenchActivityReader,
  type WorkbenchRuntimeActivityObservation,
} from "./activity/observe.ts";
import {
  createDefaultWorkbenchAiProfileSurface,
  createWorkbenchAiProfileSurface,
  type WorkbenchAiProfileSurface,
} from "./ai-profile/projection.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchAiRequests,
} from "./ai-request/types.ts";
import type {
  WorkbenchClientModel,
  WorkbenchCredentialAdministrationView,
  WorkbenchMainViewModel,
  WorkbenchRecordDocumentView,
  WorkbenchTopicMeetingResultView,
} from "./browser/client-model.ts";
import { inspectWorkbenchPublicOrigin } from "./connection/configuration.ts";
import {
  authenticateWorkbenchConnection,
  type CredentialAdministration,
  executeCredentialAdministrationAction,
} from "./credential/administration.ts";
import type { ManagementView } from "./management/contract.ts";
import {
  executeWorkbenchManagement,
  readWorkbenchManagement,
} from "./management/operations.ts";
import {
  readWorkbenchChangeArtifact,
  readWorkbenchOwnerArtifact,
} from "./owner-artifact/read.ts";
import { readAuthorizedPortfolio } from "./project/access-reader.ts";
import {
  inspectRepositoryActionResult,
  validateRepositoryActionForm,
} from "./project/repository-action.ts";
import {
  readWorkbenchProjectSurface,
  type WorkbenchProjectSurface,
} from "./project/surface.ts";
import { composeAuthorizedTopicMeeting } from "./topic-meeting/access-resolver.ts";
import type { WorkbenchTopicMeetingDocumentReader } from "./topic-meeting/action.ts";
import {
  executeTopicMeetingActionForm,
  validateTopicMeetingActionForm,
} from "./topic-meeting/action.ts";

const HOST = "127.0.0.1";
const CONTRACT = "crdd/workbench/v1";
const HEALTH_PATH = "/.well-known/crdd-workbench-health";
const LOGO_PATH = "/assets/crdd-brand-icon.jpg";
const CLIENT_ASSET_PATH = "/assets/workbench-client.js";

/**
 * Topic／Meetingの表示検索を同じ固定入力へ変換する。
 * @responsibility 単体とCROSで検索・並び順・ページ条件の意味を揃える。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input URL検索値と対象Record種別。
 * @returns 既存Domain一覧へ渡す非Authorityの検索条件。
 * @precondition Repository認可は別途要求ごとに行う。
 * @postcondition 空値を省略し未知sortを既存既定値へ戻す。
 * @effect N/A: 同期入力変換だけ。
 * @failure 不正検索の最終判定はDomain一覧が所有する。
 * @invariant 検索値からRoot・権限・保存操作を生成しない。
 * @boundary HTTP表示入力とDomain一覧。
 * @security 任意Pathや資格を条件へ追加しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function readWorkbenchRecordQuery(
  parameters: URLSearchParams,
  kind: "topic" | "meeting",
): TopicMeetingListQuery {
  const result: Record<string, unknown> = {};
  for (const [field, suffix] of [
    ["query", "Query"],
    ["relation", "Relation"],
    ...(kind === "topic"
      ? [["owner", "Owner"]]
      : [
          ["occurredFrom", "From"],
          ["occurredTo", "To"],
        ]),
  ]) {
    const value = parameters.get(`${kind}${suffix}`)?.trim();
    if (value && field !== undefined) result[field] = value;
  }
  const state = parameters.get(`${kind}State`)?.trim();
  if (state) result.states = [state];
  const sort = parameters.get(`${kind}Sort`)?.trim();
  result.sort =
    kind === "topic"
      ? sort === "title_asc" || sort === "state_asc"
        ? sort
        : "id_asc"
      : sort === "id_asc" || sort === "title_asc"
        ? sort
        : "occurred_desc";
  if (kind === "meeting" && parameters.get("meetingPending") === "true")
    result.pendingOnly = true;
  return Object.freeze(result) as TopicMeetingListQuery;
}

export type WorkbenchStartRequest = Readonly<{
  workingDirectory: string;
  publicOrigin?: string;
  port?: number;
  portfolio?: PortfolioProjection;
  credentialAdministration?: CredentialAdministration;
  localAccessRoot?: FilesystemStoreRoot;
  crosProfileAdministration?: AiProfileCatalogAdministration;
  aiProfiles?: WorkbenchAiProfileSurface;
  aiRequests?: WorkbenchAiRequests;
  sharedAiRequestsFactory?: (
    root: VerifiedRepositoryRoot,
    projectId: string,
    principalId: string,
    authorize: () => boolean,
  ) => WorkbenchAiRequests;
  activityReader?: WorkbenchActivityReader;
}>;

type WorkbenchConnectionState = "repository" | "cros_available";

type TopicMeetingActionResult =
  | TopicMeetingWriteResult
  | ((MeetingOutcomeCommandResult | TopicPromotionCommandResult) & {
      relationPaths: readonly string[];
    });

export type WorkbenchHandle = Readonly<{
  contract: typeof CONTRACT;
  baseUrl: string;
  publicUrl: string;
  healthUrl: string;
  close: () => Promise<void>;
}>;

/**
 * 操作後の再観測失敗を、完了済みEffectの失敗へ書き換えず表示用Snapshotへ反映する。
 *
 * @responsibility 直前SnapshotのProject Contextを保持し、Repository部分だけを観測不能へ落とす。
 * @trace ARCH-000012
 * @input surfaceに操作前の最後の完全なWorkbench Snapshotを受け取る。
 * @returns Repository観測だけをunknownにしたSnapshotを返す。
 * @precondition Change Publication結果は別途確定済みである。
 * @postcondition Project Context、TopicおよびMeetingを変更せず、RepositoryをCleanと表示しない。
 * @effect N/A: 不変View Modelを新しく構築するだけである。
 * @failure N/A: 固定fieldの変換だけを行う。
 * @invariant 完了済みEffectのstatusとreasonを変更しない。
 * @boundary Repository Effect結果と操作後Read Model再観測の境界。
 * @security 失敗したPathまたは内部Errorを表示Modelへ含めない。
 * @concurrency 最後に確定したSnapshotだけを基礎にする。
 */
function withUnknownRepositoryObservation(
  surface: WorkbenchProjectSurface,
): WorkbenchProjectSurface {
  return Object.freeze({
    ...surface,
    repository: Object.freeze({
      state: "unknown",
      changeSet: null,
      publicationTarget: null,
      reason: "observation_failed",
    }),
  });
}

type PortfolioCursor = readonly [string, string, string];

/** 許可済みPortfolioを現在の検索条件と継続位置で最大20件へ閉じる。 */
function createPortfolioPage(
  portfolio: PortfolioProjection | undefined,
  query: Readonly<{ query: string; state: string; cursor: string }>,
): Readonly<{
  portfolio: PortfolioProjection | null;
  nextCursor: string | null;
  cursorInvalid: boolean;
}> {
  if (portfolio === undefined)
    return Object.freeze({
      portfolio: null,
      nextCursor: null,
      cursorInvalid: false,
    });
  const normalizedQuery = query.query.toLocaleLowerCase("ja-JP");
  const filtered = portfolio.projects.filter(
    (project) =>
      (normalizedQuery.length === 0 ||
        project.projectId
          .toLocaleLowerCase("ja-JP")
          .includes(normalizedQuery)) &&
      (query.state.length === 0 || project.state === query.state),
  );
  let cursor: PortfolioCursor | null = null;
  let cursorInvalid = false;
  if (query.cursor.length > 0) {
    try {
      const value: unknown = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8"),
      );
      if (
        !Array.isArray(value) ||
        value.length !== 3 ||
        !value.every((entry) => typeof entry === "string")
      )
        cursorInvalid = true;
      else {
        const decoded = value as string[];
        if (
          decoded[0] !== query.query ||
          decoded[1] !== query.state ||
          decoded[2] === undefined ||
          decoded[2].length === 0
        )
          cursorInvalid = true;
        else cursor = Object.freeze(decoded) as PortfolioCursor;
      }
    } catch {
      cursorInvalid = true;
    }
  }
  const start =
    cursor === null
      ? 0
      : filtered.findIndex((project) => project.projectId === cursor?.[2]) + 1;
  if (cursor !== null && start === 0) cursorInvalid = true;
  const projects = cursorInvalid ? [] : filtered.slice(start, start + 20);
  const last = projects.at(-1);
  const nextCursor =
    !cursorInvalid &&
    last !== undefined &&
    start + projects.length < filtered.length
      ? Buffer.from(
          JSON.stringify([query.query, query.state, last.projectId]),
          "utf8",
        ).toString("base64url")
      : null;
  return Object.freeze({
    portfolio: Object.freeze({
      ...portfolio,
      projects: Object.freeze(projects),
    }),
    nextCursor,
    cursorInvalid,
  });
}

/**
 * 現在管理者の非秘密資格管理投影を画面へ取得する。
 * @responsibility 同Process AMへ委譲し、未構成と現在未取得を区別する。
 * @trace ARCH-000013
 * @input 同Processの検証済みRootとServer memoryの接続資格、または未構成。
 * @returns availabilityと非秘密Snapshot。
 * @precondition 要求専用の認可済みReaderだけを構成する。
 * @postcondition 生鍵・内部保存情報を画面Modelへ入れない。
 * @effect AM既存Readerの排他・現在認証・既知材料処置。
 * @failure 認証・清掃・解放不明はSnapshot nullのunavailable。
 * @invariant 空一覧を取得失敗や操作Authorityの代替にしない。
 * @boundary AM保存OwnerとBrowser通常GET。
 * @security Secret・Root・資格材料を公開しない。
 * @concurrency 各GETで現在認可を再評価し、過去投影をcacheしない。
 */
function readCredentialAdministrationView(
  administration: CredentialAdministration | undefined,
): WorkbenchCredentialAdministrationView {
  if (administration === undefined)
    return Object.freeze({
      state: "not_configured",
      snapshot: null,
    });
  const listed = readCredentialAdministrationState(
    administration.root,
    administration.token,
  );
  if (listed.status !== "completed")
    return Object.freeze({
      state: "unavailable",
      snapshot: null,
    });
  return Object.freeze({
    state: "available",
    snapshot: listed.snapshot,
  });
}

/** 現在Pageに含まれるTopic／Meeting本文を安全なBrowser Viewへ閉じる。 */
function createRecordDocumentViews(
  topicPage: TopicMeetingPage,
  meetingPage: TopicMeetingPage,
  reader: WorkbenchTopicMeetingDocumentReader,
): readonly WorkbenchRecordDocumentView[] {
  const values: WorkbenchRecordDocumentView[] = [];
  for (const [kind, page] of [
    ["topic", topicPage],
    ["meeting", meetingPage],
  ] as const) {
    for (const record of page.records) {
      const id = "topicId" in record ? record.topicId : record.meetingId;
      const document = reader.getDocument(kind, id);
      if (document === null) continue;
      values.push(
        Object.freeze({
          kind,
          id,
          document,
          relations: Object.freeze([...reader.relations(kind, id)]),
        }),
      );
    }
  }
  return Object.freeze(values);
}

/**
 * 本文表示の用途別Queryを本文観測前に閉検査する。
 * @responsibility 種別ごとのID／Pathと今回Repository選択を分離する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input API Queryと共有modeの有無。
 * @returns 本文選択、本文以外のrouteではnull。
 * @precondition URLSearchParamsは同要求の値である。
 * @postcondition 重複・余剰・越境入力をRoot／Readerへ搬送しない。
 * @effect N/A: 同期値検査。
 * @failure 不正Queryは固定例外。
 * @invariant URL入力を認可または物理Rootへ変換しない。
 * @boundary HTTP Queryと用途限定Reader。
 * @security 外部URL・絶対Path・親参照を拒否する。
 * @concurrency N/A: 要求内の同期検査。
 */
function readWorkbenchArtifactSelection(
  parameters: URLSearchParams,
  shared: boolean,
): Readonly<{ kind: "change" | "owner"; identity: string }> | null {
  const routes = parameters.getAll("route");
  if (
    !routes.some((route) => route === "/change" || route === "/owner-artifact")
  )
    return null;
  const change = routes[0] === "/change",
    identityKey = change ? "id" : "path";
  const allowed = new Set(["route", "repositoryId", identityKey]);
  if (
    routes.length !== 1 ||
    parameters.getAll(identityKey).length !== 1 ||
    [...parameters.keys()].some(
      (key) => !allowed.has(key) || parameters.getAll(key).length !== 1,
    )
  )
    throw new Error("workbench_artifact_input_invalid");
  const repositoryId = parameters.get("repositoryId");
  if (
    (shared && !repositoryId) ||
    (repositoryId !== null &&
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId))
  )
    throw new Error("workbench_artifact_input_invalid");
  const identity = parameters.get(identityKey) ?? "";
  if (
    change
      ? !/^CHG-\d{6}$/u.test(identity)
      : identity.length === 0 ||
        identity.length > 512 ||
        !identity.endsWith(".md") ||
        identity.startsWith("/") ||
        identity.includes("\\") ||
        identity.includes("\0") ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(identity) ||
        identity.split("/").some((part) => part === ".." || part === "")
  )
    throw new Error("workbench_artifact_input_invalid");
  return Object.freeze({ kind: change ? "change" : "owner", identity });
}

/** Topic／Meeting操作結果を非秘密の表示値へ縮小する。 */
function createTopicMeetingResultView(
  result: TopicMeetingActionResult | null,
): WorkbenchTopicMeetingResultView | null {
  if (result === null) return null;
  return Object.freeze({
    status: result.status,
    reason: result.reason,
    relationPaths: Object.freeze([...result.relationPaths]),
    recordKind:
      result.record === null
        ? null
        : "topicId" in result.record
          ? "topic"
          : "meeting",
  });
}

/** Workbench Node AuthorityからBrowserへ渡すJSON Read Modelを構築する。 */
function createWorkbenchMainViewModel(
  surface: WorkbenchProjectSurface,
  portfolio: PortfolioProjection | undefined,
  actionToken: string,
  lastResult: ChangePublicationResult | null,
  credentialAdministration: CredentialAdministration | undefined,
  connectionState: WorkbenchConnectionState,
  topicCollection: WorkbenchProjectSurface["topics"],
  meetingCollection: WorkbenchProjectSurface["meetings"],
  topicMeeting: WorkbenchTopicMeetingDocumentReader,
  topicPage: TopicMeetingPage,
  topicQuery: TopicMeetingListQuery,
  meetingPage: TopicMeetingPage,
  meetingQuery: TopicMeetingListQuery,
  topicMeetingResult: TopicMeetingActionResult | null,
  aiProfiles: WorkbenchAiProfileSurface | null,
  aiProfileAdministrationSnapshot: AiProfileCatalogSnapshot | undefined,
  aiProfileAdministrationOwner: "Repository" | "CROS",
  aiProfileAdministrationResult: AiProfileCatalogMutationResult | null,
  aiRequests: WorkbenchAiRequests | undefined,
  aiRequestSnapshot: WorkbenchAiRequestSnapshot | null,
  aiRequestNotice: string | null,
  runtimeActivity: WorkbenchRuntimeActivityObservation | undefined,
  documentQuery: string,
  portfolioQuery: Readonly<{ query: string; state: string; cursor: string }>,
  worktree: Readonly<{
    state: "available" | "unknown";
    tree: RepositoryWorktreeTreePage | null;
    diff: RepositoryWorktreeFileDiff | null;
  }>,
  selectedRepositoryId?: string,
  recordActionsConfigured = connectionState === "repository",
  repositoryActionsConfigured = connectionState === "repository",
): WorkbenchMainViewModel {
  const portfolioPage = createPortfolioPage(portfolio, portfolioQuery);
  return Object.freeze({
    contract: "crdd/workbench/client-model/v1",
    view: "main",
    actionToken,
    logoPath: LOGO_PATH,
    surface,
    portfolio: portfolioPage.portfolio,
    portfolioPage: Object.freeze({
      nextCursor: portfolioPage.nextCursor,
      cursorInvalid: portfolioPage.cursorInvalid,
    }),
    connection: Object.freeze({
      state: connectionState,
    }),
    topic: Object.freeze({
      collection: topicCollection,
      page: topicPage,
      query: topicQuery,
    }),
    meeting: Object.freeze({
      collection: meetingCollection,
      page: meetingPage,
      query: meetingQuery,
    }),
    recordDocuments: createRecordDocumentViews(
      topicPage,
      meetingPage,
      topicMeeting,
    ),
    topicMeetingResult: createTopicMeetingResultView(topicMeetingResult),
    selectedRepositoryId: selectedRepositoryId ?? null,
    recordActionsConfigured,
    repositoryActionsConfigured,
    repositoryResult: lastResult,
    worktree,
    credentials: readCredentialAdministrationView(credentialAdministration),
    aiProfiles,
    aiProfileAdministration: Object.freeze({
      snapshot: aiProfileAdministrationSnapshot ?? null,
      owner: aiProfileAdministrationOwner,
      result: aiProfileAdministrationResult,
    }),
    aiRequest: Object.freeze({
      configured: aiRequests !== undefined,
      snapshot: aiRequestSnapshot,
      notice: aiRequestNotice,
    }),
    runtimeActivity: runtimeActivity ?? null,
    documentQuery,
    portfolioQuery,
  });
}

/** CSR Rootと固定Asset参照だけを持つDocument Shellを返す。 */
function renderClientDocument(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CROS Workbench</title><link rel="stylesheet" href="/workbench.css"></head><body><div data-workbench-react-root="true" aria-live="polite"><p class="empty-state">Workbenchを読み込んでいます。</p></div><script type="module" src="${CLIENT_ASSET_PATH}"></script></body></html>`;
}

const shellCss = `:root{font-family:"Noto Sans CJK JP","Noto Sans JP","Yu Gothic UI",sans-serif;color:#18232d;background:#f2f3ef;font-synthesis:none;--ink:#18232d;--muted:#667078;--line:#d7dad3;--paper:#fbfbf8;--accent:#255c50;--accent-soft:#dfe9e4}*{box-sizing:border-box}body{margin:0;min-width:320px;background:linear-gradient(135deg,#f6f7f3,#ecefe9);font-size:15px}.app-shell{min-height:100vh;display:grid;grid-template-columns:220px minmax(0,1fr);grid-template-rows:68px minmax(0,1fr)}.topbar{grid-column:1/-1;display:flex;align-items:center;gap:28px;padding:0 24px;background:#fcfcf9;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;min-width:196px;color:var(--ink);text-decoration:none}.brand img{border-radius:9px;object-fit:cover}.brand span{display:grid;line-height:1.05}.brand small{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}.project-switcher{display:grid;gap:2px;padding-left:20px;border-left:1px solid var(--line)}.project-switcher span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.connection{margin-left:auto;color:var(--muted);display:flex;align-items:center;gap:8px}.status-dot{width:9px;height:9px;border-radius:50%;background:#5a8e72}.sidebar{padding:22px 14px;border-right:1px solid var(--line);background:#f7f8f4}.sidebar nav{display:grid;gap:6px}.sidebar a{padding:11px 14px;border-radius:8px;color:#4f5960;text-decoration:none;font-weight:600}.sidebar a.active{background:var(--accent-soft);color:var(--accent)}main{min-width:0;padding:36px;overflow:auto}.page-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.page-heading h1{font-size:clamp(28px,3vw,40px);line-height:1.15;margin:3px 0 8px}.page-heading p{margin:0;color:var(--muted);max-width:720px;line-height:1.7}.eyebrow{font-size:12px!important;text-transform:uppercase;letter-spacing:.1em;color:var(--accent)!important;font-weight:700}.page-heading button,.panel button{min-height:40px;padding:0 16px;border:1px solid var(--line);border-radius:8px;background:var(--accent);color:#fff;font-weight:700}.panel button:disabled{background:#b9bfba;color:#f4f5f2}.page-heading button{background:#e8eae5;color:#7c8485}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:30px 0}.summary-grid article,.panel{background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 22px rgba(24,35,45,.045)}.summary-grid article{display:grid;gap:7px;padding:18px}.summary-grid span,.summary-grid small{color:var(--muted)}.summary-grid strong{font-size:22px}.workspace-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{padding:22px}.panel.wide,.context-scene{grid-column:1/-1}.panel header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:14px}.panel h2{margin:2px 0;font-size:20px}.panel header>span{color:var(--muted);font-size:13px}.scene-summary{line-height:1.75;color:#38444c}.table-scroll{overflow:auto;margin-top:16px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;min-width:680px;background:#fff}th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line);line-height:1.55}th{font-size:12px;letter-spacing:.04em;color:var(--muted);background:#f4f6f1}tbody tr:last-child td{border-bottom:0}.panel ul{list-style:none;padding:0;margin:0}.panel li{padding:16px 0;border-bottom:1px solid var(--line)}.panel li:last-child{border-bottom:0}.panel li p{margin:5px 0 0;color:var(--muted);line-height:1.6}.repository-group li{display:flex;justify-content:space-between;align-items:center;gap:16px}.repository-actions{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}.repository-actions form,.credential-issue,.remote-connection-form{display:grid;gap:10px;padding:16px;border:1px solid var(--line);border-radius:9px}.repository-actions label,.credential-issue label,.remote-connection-form label,#credential-administration td form label{display:grid;gap:5px;font-weight:600}.repository-actions input,.credential-issue select,.remote-connection-form input,#credential-administration td input{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}.repository-actions .confirm,#credential-administration .confirm{grid-template-columns:auto 1fr;align-items:center}.repository-actions .confirm input,#credential-administration .confirm input{min-height:0}.operation-result{padding:12px;border-radius:8px;background:var(--accent-soft)}.credential-issue,.remote-connection-form{grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) minmax(180px,2fr) auto;align-items:end;margin-top:18px}.credential-issue p,.remote-connection-form p{margin:0;color:var(--muted);line-height:1.55}.one-time-token{display:grid;gap:8px;margin-top:12px}.one-time-token code{display:block;overflow-wrap:anywhere;padding:12px;background:#fff;border:1px solid var(--line);border-radius:7px;user-select:all}#credential-administration td form{display:grid;gap:7px;min-width:220px}.connection-actions{display:flex;gap:10px;margin-top:16px}.panel dl{margin:0}.panel dl div{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.panel dd{margin:0;font-weight:700}.empty-state{margin:18px 0 0;padding:22px;border:1px dashed #bfc5bc;border-radius:9px;color:var(--muted);line-height:1.7;background:#f7f8f4}.record-editor{margin-top:14px;border:1px solid var(--line);border-radius:9px;padding:12px}.record-editor summary{cursor:pointer;font-weight:700}.record-editor form{display:grid;gap:10px;margin-top:12px}.record-editor label{display:grid;gap:6px}.record-editor textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:7px;font:13px/1.5 ui-monospace,monospace}.record-editor .confirm{grid-template-columns:auto 1fr;align-items:start}.collection-controls{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;margin:16px 0;padding:14px;border:1px solid var(--line);border-radius:9px}.collection-controls label{display:grid;gap:5px;font-weight:600}.collection-controls input,.collection-controls select{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}.collection-controls .confirm{grid-template-columns:auto 1fr;align-items:center}.collection-controls .confirm input{min-height:0}.page-link{display:inline-block;margin-top:14px;color:var(--accent);font-weight:700}@media(max-width:900px){.app-shell{grid-template-columns:1fr;grid-template-rows:68px auto 1fr}.sidebar{border-right:0;border-bottom:1px solid var(--line);padding:10px 18px}.sidebar nav{grid-template-columns:repeat(8,minmax(108px,1fr));overflow:auto}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:28px 22px}.credential-issue,.remote-connection-form,.collection-controls{grid-template-columns:1fr}}@media(max-width:600px){.topbar{padding:0 14px;gap:12px}.brand{min-width:0}.brand small,.project-switcher span{display:none}.project-switcher{padding-left:12px}.connection{font-size:0}.sidebar{padding:8px 12px}.sidebar nav{grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible}.sidebar a{text-align:center;padding:10px 5px;font-size:13px}.summary-grid,.workspace-grid,.repository-actions{grid-template-columns:1fr}.panel.wide,.context-scene{grid-column:auto}.page-heading{display:grid}.page-heading button{width:100%}main{padding:24px 16px}.summary-grid{margin:22px 0}}`;

const recordDetailCss = `.record-detail{max-width:1040px;margin:0 auto}.record-detail>.page-link{margin:0 0 18px}.record-detail .panel{padding:clamp(18px,4vw,34px)}.record-detail h1{margin:2px 0;font-size:clamp(24px,4vw,36px)}.detail-metadata{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:16px 0!important}.canonical-markdown{max-height:52vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;border:1px solid var(--line);border-radius:9px;background:#f7f8f4;font:13px/1.65 ui-monospace,monospace}@media(max-width:600px){.detail-metadata{grid-template-columns:1fr}}`;

const repositoryBrowserCss = `.repository-browser{margin:18px 0;padding:16px;border:1px solid var(--line);border-radius:9px;background:#fff}.repository-browser h3{margin:0 0 12px}.repository-breadcrumb{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:8px}.repository-tree li{display:flex;justify-content:space-between;gap:16px;padding:10px 0}.repository-tree a{display:flex;gap:8px;min-width:0;color:var(--accent);text-decoration:none}.repository-tree small{color:var(--muted)}.repository-diff{margin-top:18px}.repository-diff h4,.repository-diff h5{margin:12px 0 6px}.repository-diff pre{max-height:42vh;overflow:auto;margin:0;padding:14px;border:1px solid var(--line);border-radius:8px;background:#f7f8f4;font:12px/1.55 ui-monospace,monospace;white-space:pre;tab-size:2}`;

const aiRequestCss = `.ai-request-form{display:grid;grid-template-columns:minmax(190px,1fr) minmax(180px,1fr) minmax(320px,3fr) auto;gap:12px;align-items:end;margin-top:18px}.ai-request-form label{display:grid;gap:6px;font-weight:600}.ai-request-form select,.ai-request-form textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:7px;font:inherit}.ai-request-result{display:grid;gap:14px;margin-top:18px}.ai-request-result section{padding:14px;border:1px solid var(--line);border-radius:9px}.ai-request-result h3{margin:0 0 8px;font-size:15px}.candidate-metadata{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0}.candidate-metadata div{display:grid;gap:4px;padding:10px;border:1px solid var(--line);border-radius:7px}.candidate-metadata dd{overflow-wrap:anywhere}.candidate-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.candidate-actions form{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:8px}.candidate-actions .confirm{display:grid;grid-template-columns:auto 1fr;gap:7px;align-items:start}.ai-profile-administration-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.ai-profile-administration-form>label{display:grid;gap:6px;font-weight:600}.ai-profile-administration-form input,.ai-profile-administration-form select{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}.ai-profile-administration-form fieldset{display:grid;gap:6px;border:1px solid var(--line);border-radius:7px}.ai-profile-administration-form .confirm{display:flex;gap:7px;align-items:center}.ai-profile-administration-form button{align-self:end}@media(max-width:1100px){.ai-request-form{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-request-form label:nth-of-type(3){grid-column:1/-1}.candidate-actions{grid-template-columns:1fr}}@media(max-width:900px){.ai-profile-administration-form{grid-template-columns:1fr}}@media(max-width:650px){.ai-request-form,.candidate-metadata{grid-template-columns:1fr}.ai-request-form label:nth-of-type(3){grid-column:auto}}`;

const ownerArtifactCss = `.owner-artifact-link>a,.owner-artifact-list a{display:grid;gap:6px;color:var(--accent);text-decoration:none}.owner-artifact-link,.owner-artifact-list li{padding:14px;border:1px solid var(--line);border-radius:9px;background:#fff}.owner-artifact-link small,.owner-artifact-list small{color:var(--muted);overflow-wrap:anywhere}.project-plan-panel h3{margin:22px 0 8px}.plan-facts,.quality-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.plan-facts div,.quality-facts div{display:grid;gap:6px;padding:14px;border:1px solid var(--line);border-radius:9px;background:#fff}.plan-facts span,.quality-facts span{color:var(--muted);font-size:12px}.plan-links{display:flex;flex-wrap:wrap;gap:18px}.document-search{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px;align-items:end;margin:16px 0}.document-search label{display:grid;gap:6px;font-weight:600}.document-search input{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}@media(max-width:600px){.plan-facts,.quality-facts,.document-search{grid-template-columns:1fr}}`;

const visualAccessibilityCss = `body,.app-shell,.topbar,.sidebar,.sidebar nav{min-width:0}.project-switcher span{font-size:12px}button,input,select,textarea{max-width:100%;min-width:0}label:has(input[type="checkbox"]),label:has(input[type="radio"]){min-height:32px}.panel a,.record-detail a{display:inline-flex;align-items:center;min-width:32px;min-height:32px}@media(max-width:900px){.sidebar nav{min-width:0;max-width:100%}}@media(max-width:600px){.connection{font-size:inherit;max-width:9px;overflow:hidden}.connection-label{display:none}}@media(max-width:320px){.topbar{height:auto;min-height:68px;flex-wrap:wrap;padding:8px}.project-switcher{display:none}.brand{max-width:calc(100% - 24px)}.brand strong{font-size:12px}.sidebar{padding:6px}.sidebar nav{grid-template-columns:1fr}.sidebar a{overflow-wrap:anywhere}.page-heading h1{font-size:24px}main{padding:16px 8px}.panel,.summary-grid article{padding:12px}.panel header,.panel dl div{display:grid}.collection-controls,.credential-issue,.remote-connection-form,.ai-request-form,.ai-profile-administration-form,.candidate-metadata,.candidate-actions{grid-template-columns:1fr}}`;

const visualControlCss = `button,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select,textarea{min-height:40px}label.confirm,#access-management label:has(input[type="checkbox"]){display:flex;align-items:center;gap:7px;min-height:40px}`;

/**
 * Workbench Responseへ共通Security Headerを付ける。
 *
 * @responsibility localhost ResponseのCache、MIME解釈、Frame埋込みおよびReferrerを制約する。
 * @trace ARCH-000012
 * @input responseに未送信のHTTP Responseを受け取る。
 * @returns N/A: Responseを直接更新するため戻り値を持たない。
 * @precondition Headerがまだ送信されていない。
 * @postcondition 共通Security Headerが設定される。
 * @effect HTTP Response Headerを変更する。
 * @failure N/A: Nodeの同期Header設定だけを行う。
 * @invariant Credential、Host Pathおよび内部実装情報を追加しない。
 * @boundary Workbench ServerとBrowserのHTTP境界。
 * @security CSP、nosniff、deny frame、no-referrerおよびno-storeを設定する。
 * @concurrency RequestごとのResponseだけを変更する。
 */
function setCommonHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

/**
 * Workbench操作Formを上限付きで読取る。
 *
 * @responsibility localhost HTTP Bodyを固定上限内のURL encoded Formへ変換し、過大入力を拒否する。
 * @trace ARCH-000012
 * @input incomingに未読のHTTP Requestを受け取る。
 * @returns URLSearchParamsを返すPromiseを返す。
 * @precondition Content-Typeはapplication/x-www-form-urlencodedである。
 * @postcondition Body全体が16KiB以下の場合だけ解析済みFormを返す。
 * @effect Request streamを終端まで消費する。
 * @failure 過大Body、Stream失敗または不正Content-TypeをErrorで拒否する。
 * @invariant 部分BodyからRepository Effectを開始しない。
 * @boundary Browser HTTP RequestとWorkbench Application入力の境界。
 * @security 入力上限を固定し、Multipart、JSONおよび任意Binaryを受け付けない。
 * @concurrency RequestごとのStreamだけを所有する。
 */
async function readActionForm(
  incoming: IncomingMessage,
): Promise<URLSearchParams> {
  if (
    incoming.headers["content-type"]?.split(";", 1)[0] !==
    "application/x-www-form-urlencoded"
  )
    throw new Error("workbench_action_content_type_invalid");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of incoming) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 16 * 1_024) throw new Error("workbench_action_body_too_large");
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

/**
 * Browser FormをCanonical Change Publication要求へ変換する。
 *
 * @responsibility 許可操作と必須fieldだけを選び、Human確認をboolean契約へ変換する。
 * @trace ARCH-000012
 * @input formに上限確認済みURLSearchParamsを受け取る。
 * @returns ChangePublicationRequestを返す。
 * @precondition CSRF相当Tokenは呼出し側で照合済みである。
 * @postcondition prepare、unprepare、create_revision、publish_revisionのいずれかだけを返す。
 * @effect N/A: Form値を構造化するだけである。
 * @failure 未知操作または確認なしpublishをErrorで拒否する。
 * @invariant FormからForce option、任意Commandまたは複数Pathを生成しない。
 * @boundary Workbench Browser FormとVersion Control Portの境界。
 * @security 未定義fieldを無視し、Credentialを扱わない。
 * @concurrency N/A: Request局所値だけを処理する。
 */
function actionRequest(form: URLSearchParams): ChangePublicationRequest {
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
 * Browser FormをAI Profile限定Mutationへ変換する。
 *
 * @responsibility 固定Role、Tier、Reasoningと登録済みAdapter／Modelだけを管理Commandへ採用する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @input form: 上限確認済みForm、snapshot: 操作対象Ownerの現在Catalog Snapshot。
 * @returns 作成、更新または確認付き削除のMutation。
 * @precondition CSRF相当Tokenは呼出し側で照合済みである。
 * @postcondition 作成・更新Profileは現在CatalogのAdapter／Model組だけを参照する。
 * @effect N/A: Form値の検証と構造化だけを行う。
 * @failure 未知操作、未登録値、空のRole／Tierまたは不正RevisionをErrorで拒否する。
 * @invariant FormからAdapter、Credential、Pathまたは任意実行引数を生成しない。
 * @boundary Workbench Browser FormとAI Profile管理Applicationの境界。
 * @security 未定義fieldをCandidateへ含めず、秘密値を扱わない。
 * @concurrency 表示時のexpectedRevisionをMutationへ保持する。
 */
function aiProfileMutation(
  form: URLSearchParams,
  snapshot: AiProfileCatalogSnapshot,
): AiProfileCatalogMutation {
  const operation = form.get("operation");
  const allowed = new Set(
    operation === "delete"
      ? [
          "actionToken",
          "operation",
          "expectedRevision",
          "profileId",
          "confirmed",
        ]
      : [
          "actionToken",
          "operation",
          "expectedRevision",
          "profileId",
          "adapterModel",
          "family",
          "selectionRole",
          "modelTier",
          "defaultReasoningEffort",
          "compatibilityReason",
        ],
  );
  for (const key of form.keys())
    if (
      !allowed.has(key) ||
      (key !== "selectionRole" &&
        key !== "modelTier" &&
        form.getAll(key).length !== 1)
    )
      throw new Error("workbench_ai_profile_field_invalid");
  if (
    form.getAll("operation").length !== 1 ||
    form.getAll("expectedRevision").length !== 1 ||
    !/^(0|[1-9][0-9]*)$/u.test(form.get("expectedRevision") ?? "")
  )
    throw new Error("workbench_ai_profile_revision_invalid");
  const expectedRevision = Number(form.get("expectedRevision"));
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error("workbench_ai_profile_revision_invalid");
  const profileId = form.get("profileId") ?? "";
  if (operation === "delete")
    return Object.freeze({
      operation,
      expectedRevision,
      profileId,
      confirmed: form.get("confirmed") === "true",
    });
  if (operation !== "create" && operation !== "update")
    throw new Error("workbench_ai_profile_operation_invalid");

  const adapterModel = form.get("adapterModel")?.split("|") ?? [];
  if (adapterModel.length !== 2)
    throw new Error("workbench_ai_profile_adapter_model_invalid");
  const adapterId = adapterModel[0];
  const exactModelId = adapterModel[1];
  if (adapterId === undefined || exactModelId === undefined)
    throw new Error("workbench_ai_profile_adapter_model_invalid");
  const adapter = snapshot.catalog.adapters.find(
    (candidate) => candidate.adapterId === adapterId,
  );
  if (adapter === undefined || !adapter.allowedModelIds.includes(exactModelId))
    throw new Error("workbench_ai_profile_adapter_model_invalid");
  const roleValues = form.getAll("selectionRole");
  const tierValues = form.getAll("modelTier");
  const allowedRoles = new Set<AiSelectionRole>([
    "coordinator",
    "executor",
    "independent_reviewer",
    "result_integration",
  ]);
  const allowedTiers = new Set<AiModelTier>(["preferred", "upper_allowed"]);
  const selectionRoles = roleValues.filter((value): value is AiSelectionRole =>
    allowedRoles.has(value as AiSelectionRole),
  );
  const modelTiers = tierValues.filter((value): value is AiModelTier =>
    allowedTiers.has(value as AiModelTier),
  );
  if (
    selectionRoles.length === 0 ||
    selectionRoles.length !== roleValues.length ||
    modelTiers.length === 0 ||
    modelTiers.length !== tierValues.length
  )
    throw new Error("workbench_ai_profile_scope_invalid");
  const effort = form.get("defaultReasoningEffort") ?? "";
  if (!adapter.allowedReasoningEfforts.includes(effort as AiReasoningEffort))
    throw new Error("workbench_ai_profile_reasoning_invalid");
  const compatibilityReason = (form.get("compatibilityReason") ?? "").trim();
  const profile: AiProfileDefinition = Object.freeze({
    profileId,
    adapterId,
    family: form.get("family") ?? "",
    exactModelId,
    selectionRoles: Object.freeze(selectionRoles),
    modelTiers: Object.freeze(modelTiers),
    speedMode: "normal",
    billingMode: "subscription_oauth",
    defaultReasoningEffort: effort as AiReasoningEffort,
    compatibilityReason:
      compatibilityReason.length === 0 ? null : compatibilityReason,
  });
  return Object.freeze({ operation, expectedRevision, profile });
}

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
): Promise<WorkbenchHandle> {
  const configurationFields = new Set([
    "workingDirectory",
    "publicOrigin",
    "port",
    "portfolio",
    "credentialAdministration",
    "localAccessRoot",
    "crosProfileAdministration",
    "aiProfiles",
    "aiRequests",
    "sharedAiRequestsFactory",
    "activityReader",
  ]);
  if (Object.keys(request).some((field) => !configurationFields.has(field)))
    throw new Error("workbench_configuration_invalid");
  const publicOrigin = inspectWorkbenchPublicOrigin(request.publicOrigin);
  if (publicOrigin && request.localAccessRoot === undefined)
    throw new Error("workbench_shared_access_required");
  if (
    request.crosProfileAdministration !== undefined &&
    request.localAccessRoot === undefined
  )
    throw new Error("workbench_profile_owner_conflicting");
  const port = request.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("workbench_port_invalid");
  if (
    request.localAccessRoot !== undefined &&
    (request.credentialAdministration !== undefined ||
      request.portfolio !== undefined ||
      request.aiProfiles !== undefined ||
      request.aiRequests !== undefined ||
      request.activityReader !== undefined)
  )
    throw new Error("workbench_local_cros_sources_conflicting");
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    request.workingDirectory,
  );
  const logoPath = path.join(
    repositoryRoot,
    "04_UI",
    "assets",
    "brand",
    "crdd-brand-icon-512x512.jpg",
  );
  const logo = await readFile(logoPath).catch(() => null);
  if (logo === null) throw new Error("workbench_official_logo_unavailable");
  const clientAsset = await readFile(
    path.join(
      import.meta.dirname,
      "..",
      "dist",
      "client",
      "assets",
      "workbench-client.js",
    ),
  ).catch(() => null);
  if (clientAsset === null)
    throw new Error("workbench_client_asset_unavailable");
  const verification = verifyRepositoryRoot(repositoryRoot);
  if (verification.status !== "completed")
    throw new Error("workbench_repository_root_invalid");
  let projectSurface =
    request.localAccessRoot === undefined
      ? await readWorkbenchProjectSurface(repositoryRoot)
      : undefined;
  const aiProfileStore =
    request.localAccessRoot === undefined
      ? createRepositoryAiProfileCatalogStore(repositoryRoot)
      : undefined;
  const aiProfileAdministration =
    request.aiProfiles === undefined && aiProfileStore?.status === "ready"
      ? createAiProfileCatalogAdministration(aiProfileStore.store)
      : undefined;
  const initialProfileRead =
    request.aiProfiles === undefined && aiProfileStore?.status === "ready"
      ? aiProfileStore.store.snapshot()
      : undefined;
  if (initialProfileRead?.status === "blocked")
    throw new Error(initialProfileRead.error);
  let aiProfiles =
    request.aiProfiles ??
    (initialProfileRead?.status === "read"
      ? createWorkbenchAiProfileSurface(initialProfileRead.value.catalog)
      : createDefaultWorkbenchAiProfileSurface());
  const aiRequests = request.aiRequests;
  const sharedAiSessions = new Map<
    string,
    { owner: WorkbenchAiRequests; currentId: string | null }
  >();
  /**
   * 現在認可した接続主体とRepositoryへ単発Ownerを結合する。
   * @responsibility 共有の表示IDをProcess全体の一変数へ混在させない。
   * @trace ARCH-000015
   * @input 現在の管理接続、Repository IDと新規構成の有無。
   * @returns 当該接続の既存Owner、又は未開示のnull。
   * @precondition TokenはHTTP要求から得た非永続値。
   * @postcondition 待機後もOwnerが現在認可を照合する。
   * @effect 初回明示開始だけ既存Task Ownerを構成する。
   * @failure 認可・Root・容量不明は拒否する。
   * @invariant 新保存先・Registry・MCP依存を追加しない。
   * @boundary AMと共有Workbenchの現在Session。
   * @security 資格・Root・Map Keyを応答へ返さない。
   * @concurrency 異なる資格とRepositoryの要求を分離する。
   */
  const sharedAiSession = (
    connection: CredentialAdministration | undefined,
    repositoryId: string,
    create: boolean,
  ) => {
    if (!connection || !request.sharedAiRequestsFactory) return null;
    const auth = resolveConnectionAuthentication(
      connection.root,
      connection.token,
    );
    const selected = resolveRepositoryAccess(
      connection.root,
      connection.token,
      repositoryId,
      "development",
    );
    if (auth.status !== "normal" || selected.status !== "completed")
      return null;
    const key = `${auth.snapshot.credentialId}:${repositoryId}`;
    const current = sharedAiSessions.get(key);
    if (current) return current;
    if (!create || sharedAiSessions.size >= 100) return null;
    const original = selected.access;
    const root = resolveVerifiedRepositoryRoot(original.root);
    const authorize = () => {
      const now = resolveConnectionAuthentication(
        connection.root,
        connection.token,
      );
      const access = resolveRepositoryAccess(
        connection.root,
        connection.token,
        repositoryId,
        "development",
      );
      return (
        now.status === "normal" &&
        now.snapshot.userId === auth.snapshot.userId &&
        now.snapshot.credentialId === auth.snapshot.credentialId &&
        access.status === "completed" &&
        access.access.bindingId === original.bindingId &&
        access.access.manifest.projectId === original.manifest.projectId &&
        resolveVerifiedRepositoryRoot(access.access.root) === root
      );
    };
    const session = {
      owner: request.sharedAiRequestsFactory(
        original.root,
        original.manifest.projectId,
        auth.snapshot.userId,
        authorize,
      ),
      currentId: null as string | null,
    };
    sharedAiSessions.set(key, session);
    return session;
  };
  const activityReader =
    request.activityReader ??
    (request.localAccessRoot === undefined && projectSurface !== undefined
      ? createRepositoryWorkbenchActivityReader(
          repositoryRoot,
          projectSurface.context,
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
  let lastActionResult: ChangePublicationResult | null = null;
  let topicMeetingResult: TopicMeetingActionResult | null = null;
  let currentAiRequestId: string | null = null;
  let aiRequestSnapshot: WorkbenchAiRequestSnapshot | null = null;
  let aiRequestNotice: string | null = null;
  let runtimeActivityObservation:
    | WorkbenchRuntimeActivityObservation
    | undefined;
  let aiProfileAdministrationResult: AiProfileCatalogMutationResult | null =
    null;
  const actionToken = randomBytes(32).toString("base64url");
  const connections = new Set<Socket>();
  const pendingRequests = new Set<Promise<void>>();
  const server = createServer((incoming, response) => {
    const requestController = new AbortController();
    /**
     * 未完了Requestの切断を同要求の取消へ搬送する。
     * @responsibility 当該要求の待機と公開を所有Signalへ結合する。
     * @trace ARCH-000012
     * @input N/A: 所有IncomingMessageのaborted通知だけ。
     * @returns N/A: Signalを更新する。
     * @precondition 当該Request専用ControllerとListenerを構成済み。
     * @postcondition 次の待機／応答で取消を観測できる。
     * @effect 当該Signalをabortする。
     * @failure N/A: AbortControllerの同期通知だけ。
     * @invariant 通知だけで保存取消や資源不存在を保証しない。
     * @boundary IncomingMessageと当該Workbench要求。
     * @security 他RequestのAuthorityや状態へ触れない。
     * @concurrency 重複通知は冪等、終了後Listenerを解除する。
     */
    const requestAborted = () => requestController.abort();
    /**
     * 応答未完了の接続終了を同要求の取消へ搬送する。
     * @responsibility 完了した応答と途中切断を区別する。
     * @trace ARCH-000012
     * @input N/A: 所有ServerResponseのclose通知だけ。
     * @returns N/A: 必要時にSignalを更新する。
     * @precondition Request専用ControllerとResponseを保持する。
     * @postcondition 未完了closeだけをabortへ接続する。
     * @effect 未完了の場合だけ当該Signalをabortする。
     * @failure N/A: 同期の完了状態確認だけ。
     * @invariant 接続終了から保存rollbackを推定しない。
     * @boundary HTTP Responseと要求待機の所有境界。
     * @security 他Requestへ取消を発行しない。
     * @concurrency Request終了後Listenerを解除する。
     */
    const requestClosed = () => {
      if (!response.writableFinished) requestController.abort();
    };
    incoming.once("aborted", requestAborted);
    response.once("close", requestClosed);
    const requestPending = (async () => {
      const method = incoming.method ?? "";
      if (publicOrigin) {
        const expected = [
          ["host", publicOrigin.host],
          ["x-forwarded-proto", "https"],
          ["x-forwarded-host", publicOrigin.host],
        ];
        const invalid =
          expected.some(
            ([name, value]) =>
              incoming.headers[name as string] !== value ||
              incoming.rawHeaders.filter(
                (field, index) =>
                  index % 2 === 0 && field.toLowerCase() === name,
              ).length !== 1,
          ) ||
          incoming.rawHeaders.filter(
            (field, index) =>
              index % 2 === 0 && field.toLowerCase() === "origin",
          ).length > 1 ||
          (incoming.headers.origin !== undefined &&
            incoming.headers.origin !== publicOrigin.origin) ||
          (method === "POST" &&
            incoming.headers.origin !== publicOrigin.origin);
        if (invalid) {
          setCommonHeaders(response);
          response.statusCode = 421;
          response.end("workbench_tls_boundary_invalid\n");
          return;
        }
      }
      const requestUrl = new URL(incoming.url ?? "/", `http://${HOST}`);
      const requestPath = requestUrl.pathname;
      let artifactSelection: ReturnType<typeof readWorkbenchArtifactSelection> =
        null;
      if (
        requestPath === "/api/workbench-view" &&
        (method === "GET" || method === "HEAD")
      ) {
        try {
          artifactSelection = readWorkbenchArtifactSelection(
            requestUrl.searchParams,
            request.localAccessRoot !== undefined,
          );
        } catch {
          setCommonHeaders(response);
          response.statusCode = 400;
          response.end("artifact_input_invalid\n");
          return;
        }
      }
      if (
        request.localAccessRoot !== undefined &&
        requestPath === "/api/workbench-view" &&
        requestUrl.searchParams.getAll("repositoryId").length > 1
      ) {
        setCommonHeaders(response);
        response.statusCode = 403;
        response.end("local_repository_access_unavailable\n");
        return;
      }
      let credentialAdministration = request.credentialAdministration;
      let localConnectionNotice: string | null = null;
      if (request.localAccessRoot !== undefined) {
        const authorization = incoming.headers.authorization;
        const authorizationCount = incoming.rawHeaders.filter(
          (_, index) =>
            index % 2 === 0 &&
            incoming.rawHeaders[index]?.toLowerCase() === "authorization",
        ).length;
        credentialAdministration =
          authorizationCount === 1 &&
          typeof authorization === "string" &&
          /^Bearer [^\s]{1,4096}$/u.test(authorization)
            ? Object.freeze({
                root: request.localAccessRoot,
                token: authorization.slice(7),
              })
            : undefined;
        if (method === "POST" && requestPath === "/local-connection/action") {
          try {
            const address = server.address();
            const origin =
              publicOrigin?.origin ??
              (address && typeof address !== "string"
                ? `http://${HOST}:${address.port}`
                : null);
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
                requestController.signal.aborted
              )
                throw new Error("workbench_local_connection_input_invalid");
            } else {
              authenticateWorkbenchConnection(
                request.localAccessRoot,
                form,
                actionToken,
                requestController.signal,
              );
            }
            if (requestController.signal.aborted || response.destroyed) return;
            setCommonHeaders(response);
            const body = JSON.stringify({ status: "completed" });
            response.statusCode = 200;
            response.setHeader(
              "Content-Type",
              "application/json; charset=utf-8",
            );
            response.setHeader("Content-Length", Buffer.byteLength(body));
            response.end(body);
          } catch {
            if (!response.destroyed && !requestController.signal.aborted) {
              setCommonHeaders(response);
              response.statusCode = 400;
              response.end("local_connection_rejected\n");
            }
          }
          return;
        }
        if (
          credentialAdministration !== undefined &&
          resolveConnectionAuthentication(
            credentialAdministration.root,
            credentialAdministration.token,
          ).status !== "normal"
        ) {
          credentialAdministration = undefined;
          localConnectionNotice =
            "現在の接続を確認できません。接続用の鍵を確認してください。";
        }
        if (method === "POST" && requestPath === "/ai-request/action") {
          let dispatched = false;
          try {
            const address = server.address();
            const origin =
              publicOrigin?.origin ??
              (address && typeof address !== "string"
                ? `http://${HOST}:${address.port}`
                : null);
            if (
              !origin ||
              incoming.headers.origin !== origin ||
              incoming.headers.host !== new URL(origin).host ||
              requestUrl.search !== ""
            )
              throw new Error("workbench_ai_request_input_invalid");
            const form = await readActionForm(incoming);
            if (
              form.get("actionToken") !== actionToken ||
              !credentialAdministration
            )
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
            if (!session)
              throw new Error("workbench_ai_request_access_unavailable");
            let result:
              | Awaited<ReturnType<WorkbenchAiRequests["start"]>>
              | WorkbenchAiRequestSnapshot;
            if (operation === "start") {
              const mode = form.get("mode");
              if (mode !== "read_only_advice" && mode !== "workspace_edit")
                throw new Error("workbench_ai_request_mode_invalid");
              dispatched = true;
              result = await session.owner.start({
                mode,
                profileId: form.get("profileId") ?? "",
                prompt: form.get("prompt") ?? "",
                contextReferences: ["PROJECT_CONTEXT.md"],
                allowedPaths: (form.get("allowedPaths") ?? "")
                  .split(/\r?\n/u)
                  .map((p) => p.trim())
                  .filter(Boolean),
                externalSendConfirmed:
                  form.get("externalSendConfirmed") === "yes",
                workspaceId: form.get("workspaceId")?.trim() || null,
              });
              if (result.status === "accepted")
                session.currentId = result.requestId;
            } else if (operation === "cancel" || operation === "observe") {
              const requestId = form.get("requestId") ?? "";
              const previous = await session.owner.observe(requestId);
              if (
                previous.mode === null ||
                previous.reason === "orchestrator_task_not_available"
              )
                throw new Error("workbench_ai_request_identity_invalid");
              dispatched = true;
              result =
                operation === "cancel"
                  ? await session.owner.cancel(requestId)
                  : previous;
              if (session.currentId === null) session.currentId = requestId;
            } else throw new Error("workbench_ai_request_operation_invalid");
            if (!sharedAiSession(credentialAdministration, repositoryId, false))
              throw new Error("workbench_ai_request_access_unavailable");
            setCommonHeaders(response);
            response.setHeader(
              "Content-Type",
              "application/json; charset=utf-8",
            );
            response.end(JSON.stringify(result));
          } catch {
            setCommonHeaders(response);
            response.statusCode = dispatched ? 503 : 400;
            response.end(
              dispatched
                ? "ai_request_outcome_unconfirmed\n"
                : "ai_request_rejected\n",
            );
          }
          return;
        }
        if (method === "GET" || method === "HEAD") {
          // 共有CatalogはRepository選択と独立し、現在管理認可でだけ読む。
          if (requestPath === "/api/ai-profiles") {
            try {
              if (
                requestUrl.search !== "" ||
                !credentialAdministration ||
                !request.crosProfileAdministration ||
                evaluateAiProfileManagementPermission(
                  credentialAdministration.root,
                  credentialAdministration.token,
                ) !== "allowed"
              )
                throw new Error("workbench_profile_access_unavailable");
              const read = request.crosProfileAdministration.snapshot();
              if (read.status !== "read") throw new Error(read.error);
              const snapshot = read.value;
              const catalog = validateAiProfileCatalog(snapshot.catalog).value;
              if (
                !catalog ||
                !Number.isSafeInteger(snapshot.revision) ||
                snapshot.revision < 0
              )
                throw new Error("workbench_profile_snapshot_invalid");
              const body = JSON.stringify({
                revision: snapshot.revision,
                catalog,
              });
              await yieldToTransport(0);
              if (requestController.signal.aborted || response.destroyed)
                return;
              if (
                evaluateAiProfileManagementPermission(
                  credentialAdministration.root,
                  credentialAdministration.token,
                ) !== "allowed"
              )
                throw new Error("workbench_profile_access_unavailable");
              setCommonHeaders(response);
              response.statusCode = 200;
              response.setHeader(
                "Content-Type",
                "application/json; charset=utf-8",
              );
              response.setHeader("Content-Length", Buffer.byteLength(body));
              response.end(method === "HEAD" ? undefined : body);
            } catch {
              if (!requestController.signal.aborted && !response.destroyed) {
                setCommonHeaders(response);
                response.statusCode = 403;
                response.end("profile_access_unavailable\n");
              }
            }
            return;
          }
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
            requestPath === "/api/workbench-view"
          ) {
            let currentPortfolio: PortfolioProjection | null = null;
            let currentCollection: RepositoryAccessCollectionResult | null =
              null;
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
                  requestController.signal,
                );
              } catch {
                localConnectionNotice = "現在の内容を確認できません。";
              }
            }
            let model: WorkbenchClientModel = Object.freeze({
              contract: "crdd/workbench/client-model/v1",
              view: "access",
              actionToken,
              logoPath: LOGO_PATH,
              authenticated: credentialAdministration !== undefined,
              notice: localConnectionNotice,
              portfolio: currentPortfolio,
              credentials: readCredentialAdministrationView(
                credentialAdministration,
              ),
            });
            const selectedId = requestUrl.searchParams.get("repositoryId");
            if (
              requestPath === "/api/workbench-view" &&
              selectedId !== null &&
              selectedId !== "" &&
              !(
                artifactSelection !== null &&
                credentialAdministration === undefined
              )
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
                const records = composeAuthorizedTopicMeeting(
                  currentCollection.repositories,
                  selectedId,
                  requestController.signal,
                );
                const root =
                  selected === null
                    ? null
                    : resolveVerifiedRepositoryRoot(selected.root);
                if (!selected || !records || root === null)
                  throw new Error("workbench_selected_content_unavailable");
                const surface = await readWorkbenchProjectSurface(root);
                if (requestController.signal.aborted || response.destroyed)
                  return;
                if (
                  surface.context.repositoryId !== selected.repositoryId ||
                  surface.context.projectId !== selected.manifest.projectId
                )
                  throw new Error("workbench_selected_content_unavailable");
                const topicQuery = readWorkbenchRecordQuery(
                  requestUrl.searchParams,
                  "topic",
                );
                const meetingQuery = readWorkbenchRecordQuery(
                  requestUrl.searchParams,
                  "meeting",
                );
                const topicPage = records.topic.list({
                  limit: 20,
                  query: topicQuery,
                  ...(requestUrl.searchParams.has("topicCursor")
                    ? {
                        cursor:
                          requestUrl.searchParams.get("topicCursor") ?? "",
                      }
                    : {}),
                });
                const meetingPage = records.meeting.list({
                  limit: 20,
                  query: meetingQuery,
                  ...(requestUrl.searchParams.has("meetingCursor")
                    ? {
                        cursor:
                          requestUrl.searchParams.get("meetingCursor") ?? "",
                      }
                    : {}),
                });
                const reader: WorkbenchTopicMeetingDocumentReader = {
                  getDocument: (kind, id) => records[kind].getDocument(id),
                  relations: (kind, id) => records[kind].relations(id),
                };
                let worktree: WorkbenchMainViewModel["worktree"] = {
                  state: "unknown",
                  tree: null,
                  diff: null,
                };
                const changeSet = surface.repository.changeSet;
                if (
                  surface.repository.state === "available" &&
                  changeSet !== null
                ) {
                  try {
                    const tree = observeRepositoryWorktreeTree(
                      selected.root,
                      changeSet,
                      requestUrl.searchParams.get("treeDirectory") ?? "",
                      requestUrl.searchParams.get("treeCursor") ?? undefined,
                      50,
                      gitRepositoryWorktreeViewAdapter,
                    );
                    const diffPath = requestUrl.searchParams.get("diffPath");
                    const diff =
                      diffPath === null
                        ? null
                        : observeRepositoryWorktreeFileDiff(
                            selected.root,
                            changeSet,
                            diffPath,
                            gitRepositoryWorktreeViewAdapter,
                          );
                    worktree = { state: "available", tree, diff };
                  } catch {
                    worktree = { state: "unknown", tree: null, diff: null };
                  }
                }
                let activity: WorkbenchRuntimeActivityObservation;
                await yieldToTransport(0);
                if (requestController.signal.aborted || response.destroyed)
                  return;
                try {
                  const cursor = requestUrl.searchParams.get("runtimeCursor");
                  const observation = await readAuthorizedRuntimeActivity(
                    {
                      projectId: selected.manifest.projectId,
                      repositories: currentCollection.repositories
                        .filter(
                          (entry) =>
                            entry.manifest.projectId ===
                            selected.manifest.projectId,
                        )
                        .map((entry) => ({
                          projectId: entry.manifest.projectId,
                          repositoryId: entry.repositoryId,
                          root: entry.root,
                        })),
                      limit: 20,
                      ...(cursor === null ? {} : { cursor }),
                    },
                    requestController.signal,
                  );
                  if (observation.projectId !== selected.manifest.projectId)
                    throw new Error("workbench_activity_unavailable");
                  activity = projectRuntimeActivityForWorkbench(observation);
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
                await yieldToTransport(0);
                if (requestController.signal.aborted || response.destroyed)
                  return;
                const selectedAi = sharedAiSession(
                  credentialAdministration,
                  selectedId,
                  false,
                );
                const selectedAiSnapshot = selectedAi?.currentId
                  ? await selectedAi.owner.observe(selectedAi.currentId)
                  : null;
                const sharedProfileRead =
                  request.sharedAiRequestsFactory &&
                  request.crosProfileAdministration
                    ? request.crosProfileAdministration.snapshot()
                    : undefined;
                if (sharedProfileRead?.status === "blocked")
                  throw new Error(sharedProfileRead.error);
                const sharedProfiles =
                  sharedProfileRead?.status === "read"
                    ? createWorkbenchAiProfileSurface(
                        sharedProfileRead.value.catalog,
                      )
                    : null;
                model = createWorkbenchMainViewModel(
                  surface,
                  currentPortfolio,
                  actionToken,
                  null,
                  credentialAdministration,
                  "cros_available",
                  surface.topics,
                  surface.meetings,
                  reader,
                  topicPage,
                  topicQuery,
                  meetingPage,
                  meetingQuery,
                  null,
                  null,
                  undefined,
                  "CROS",
                  null,
                  undefined,
                  null,
                  null,
                  activity,
                  requestUrl.searchParams.get("documentQuery") ?? "",
                  {
                    query: requestUrl.searchParams.get("portfolioQuery") ?? "",
                    state: requestUrl.searchParams.get("portfolioState") ?? "",
                    cursor:
                      requestUrl.searchParams.get("portfolioCursor") ?? "",
                  },
                  worktree,
                  selectedId,
                  true,
                  true,
                );
                model = {
                  ...model,
                  aiProfiles: sharedProfiles,
                  aiRequest: {
                    configured:
                      request.sharedAiRequestsFactory !== undefined &&
                      selected.workspaceIds.includes("development"),
                    snapshot: selectedAiSnapshot,
                    notice: null,
                  },
                };
                const route = requestUrl.searchParams.get("route") ?? "/";
                if (route === "/project") {
                  const project = currentPortfolio.projects.find(
                    (entry) =>
                      entry.projectId === requestUrl.searchParams.get("id"),
                  );
                  if (!project)
                    throw new Error("workbench_selected_content_unavailable");
                  model = {
                    contract: "crdd/workbench/client-model/v1",
                    view: "project-detail",
                    logoPath: LOGO_PATH,
                    project,
                  };
                } else if (route === "/topic" || route === "/meeting") {
                  const kind = route === "/topic" ? "topic" : "meeting";
                  const id = requestUrl.searchParams.get("id") ?? "";
                  const document = reader.getDocument(kind, id);
                  if (!document)
                    throw new Error("workbench_selected_content_unavailable");
                  model = {
                    contract: "crdd/workbench/client-model/v1",
                    view: "record-detail",
                    logoPath: LOGO_PATH,
                    actionToken,
                    repositoryId: selectedId,
                    recordActionsConfigured: true,
                    record: {
                      kind,
                      id,
                      document,
                      relations: reader.relations(kind, id),
                    },
                  };
                } else if (artifactSelection !== null) {
                  const markdown =
                    artifactSelection.kind === "change"
                      ? await readWorkbenchChangeArtifact(
                          root,
                          artifactSelection.identity,
                        )
                      : await readWorkbenchOwnerArtifact(
                          root,
                          surface.ownerArtifacts,
                          artifactSelection.identity,
                        );
                  if (markdown === null)
                    throw new Error("workbench_selected_content_unavailable");
                  model = {
                    contract: "crdd/workbench/client-model/v1",
                    view: "artifact",
                    logoPath: LOGO_PATH,
                    repositoryId: selected.manifest.repositoryId,
                    selectedRepositoryId: selectedId,
                    artifact: { ...artifactSelection, markdown },
                  };
                } else if (route !== "/" && route !== "/index.html") {
                  throw new Error("workbench_selected_content_unavailable");
                }
              } catch {
                if (requestController.signal.aborted || response.destroyed)
                  return;
                setCommonHeaders(response);
                response.statusCode = 403;
                response.end("local_repository_access_unavailable\n");
                return;
              }
            }
            localBody =
              requestPath === "/api/workbench-view"
                ? JSON.stringify(model)
                : renderClientDocument();
            if (requestController.signal.aborted || response.destroyed) return;
            if (
              requestPath === "/api/workbench-view" &&
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
              if (requestController.signal.aborted || response.destroyed)
                return;
              setCommonHeaders(response);
              response.statusCode = 403;
              response.end("local_repository_access_unavailable\n");
              return;
            }
            if (requestPath === "/api/workbench-view")
              localContentType = "application/json; charset=utf-8";
          } else if (requestPath === "/workbench.css") {
            localBody =
              shellCss +
              recordDetailCss +
              repositoryBrowserCss +
              aiRequestCss +
              ownerArtifactCss +
              visualAccessibilityCss +
              visualControlCss;
            localContentType = "text/css; charset=utf-8";
          } else if (requestPath === LOGO_PATH) {
            localBody = logo;
            localContentType = "image/jpeg";
          } else if (requestPath === CLIENT_ASSET_PATH) {
            localBody = clientAsset;
            localContentType = "text/javascript; charset=utf-8";
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
            if (requestController.signal.aborted || response.destroyed) return;
            setCommonHeaders(response);
            response.statusCode = 200;
            response.setHeader("Content-Type", localContentType);
            response.setHeader("Content-Length", Buffer.byteLength(localBody));
            response.end(method === "HEAD" ? undefined : localBody);
            return;
          }
        }
        const sharedActionRoute =
          (method === "POST" && requestPath === "/topic-meeting/action") ||
          (method === "POST" && requestPath === "/ai-profiles/action") ||
          (method === "POST" && requestPath === "/repository/action") ||
          (method === "POST" && requestPath === "/workspace/action") ||
          (method === "GET" && requestPath === "/api/access-management") ||
          (method === "POST" &&
            (requestPath === "/access-management/action" ||
              requestPath === "/connection-credentials/action"));
        if (!sharedActionRoute) {
          setCommonHeaders(response);
          response.statusCode = 403;
          response.end("local_repository_access_unavailable\n");
          return;
        }
      }
      if (method === "POST" && requestPath === "/workspace/action") {
        let dispatched = false;
        try {
          const address = server.address();
          const origin =
            publicOrigin?.origin ??
            (address && typeof address !== "string"
              ? `http://${HOST}:${address.port}`
              : null);
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
          const command = inspectWorkspaceCommand(
            JSON.parse(form.get("command") ?? "null"),
          );
          if (!command) throw new Error("workspace_input_invalid");
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
          let ownerRoot = repositoryRoot;
          let projectId: string;
          let authorize: () => boolean;
          if (request.localAccessRoot !== undefined) {
            const administration = credentialAdministration;
            if (!administration)
              throw new Error("workspace_access_unavailable");
            const initial = resolveRepositoryAccess(
              administration.root,
              administration.token,
              repositoryId,
              "development",
            );
            if (initial.status !== "completed")
              throw new Error("workspace_access_unavailable");
            const resolved = resolveVerifiedRepositoryRoot(initial.access.root);
            if (resolved === null)
              throw new Error("workspace_access_unavailable");
            ownerRoot = resolved;
            projectId = initial.access.manifest.projectId;
            authorize = () => {
              const fresh = resolveRepositoryAccess(
                administration.root,
                administration.token,
                repositoryId,
                "development",
              );
              return (
                !requestController.signal.aborted &&
                fresh.status === "completed" &&
                fresh.access.revision === initial.access.revision &&
                fresh.access.bindingId === initial.access.bindingId &&
                JSON.stringify(fresh.access.manifest) ===
                  JSON.stringify(initial.access.manifest) &&
                resolveVerifiedRepositoryRoot(initial.access.root) ===
                  ownerRoot &&
                resolveVerifiedRepositoryRoot(fresh.access.root) === ownerRoot
              );
            };
          } else {
            const verified = verifyRepositoryRoot(ownerRoot);
            if (verified.status !== "completed")
              throw new Error("workspace_access_unavailable");
            const observer = createFilesystemRepositoryObservationPort(
              verified.capability,
              1_048_576,
            );
            const file = observer.observeFile(
              REPOSITORY_MANIFEST_RELATIVE_PATH,
            );
            if (file.status !== "resolved")
              throw new Error("workspace_access_unavailable");
            const source = file.source;
            const manifest = inspectRepositoryManifest(JSON.parse(source));
            if (!manifest || manifest.repositoryId !== repositoryId)
              throw new Error("workspace_access_unavailable");
            projectId = manifest.projectId;
            authorize = () => {
              const fresh = observer.observeFile(
                REPOSITORY_MANIFEST_RELATIVE_PATH,
              );
              return (
                !requestController.signal.aborted &&
                resolveVerifiedRepositoryRoot(verified.capability) ===
                  ownerRoot &&
                fresh.status === "resolved" &&
                fresh.source === source
              );
            };
          }
          dispatched = true;
          const result = executeWorkspaceCommand(
            ownerRoot,
            projectId,
            command,
            authorize,
            requestController.signal,
          );
          const body = JSON.stringify(result);
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
          if (!authorize()) throw new Error("workspace_result_unavailable");
          setCommonHeaders(response);
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Content-Length", Buffer.byteLength(body));
          response.end(body);
        } catch {
          if (!requestController.signal.aborted && !response.destroyed) {
            setCommonHeaders(response);
            response.statusCode = dispatched ? 503 : 400;
            response.end(
              dispatched
                ? "workspace_outcome_unconfirmed\n"
                : "workspace_request_rejected\n",
            );
          }
        }
        return;
      }
      if (
        request.localAccessRoot !== undefined &&
        method === "POST" &&
        requestPath === "/repository/action"
      ) {
        let dispatched = false;
        try {
          const address = server.address();
          const origin =
            publicOrigin?.origin ??
            (address && typeof address !== "string"
              ? `http://${HOST}:${address.port}`
              : null);
          if (
            !origin ||
            requestUrl.search !== "" ||
            incoming.headers.host !== new URL(origin).host ||
            incoming.headers.origin !== origin ||
            incoming.headers["content-type"]?.split(";")[0]?.trim() !==
              "application/x-www-form-urlencoded"
          )
            throw new Error("workbench_repository_input_invalid");
          const form = await readActionForm(incoming);
          const validated = validateRepositoryActionForm(
            form,
            actionToken,
            true,
          );
          if (!credentialAdministration)
            throw new Error("workbench_repository_access_unavailable");
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
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
          if (!selected)
            throw new Error("workbench_repository_access_unavailable");
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
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
          if (validated.request.operation === "publish_revision") {
            const target = observeChangePublicationTarget(
              selected.root,
              gitChangePublicationTargetObservationAdapter,
            );
            if (
              target.status !== "available" ||
              target.destination !== validated.request.destination ||
              target.branch !== validated.request.branch ||
              target.revisionIdentity !== validated.request.revisionIdentity
            )
              throw new Error(
                "workbench_repository_publication_target_changed",
              );
          }
          dispatched = true;
          const result = inspectRepositoryActionResult(
            validated.request,
            executeChangePublication(
              selected.root,
              validated.request,
              gitChangePublicationAdapter,
            ),
          );
          const body = JSON.stringify(result);
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
          if (
            !sameAccessCollection(
              collection,
              resolveRepositoryAccessCollection(
                credentialAdministration.root,
                credentialAdministration.token,
              ),
            )
          )
            throw new Error("workbench_repository_publication_unavailable");
          setCommonHeaders(response);
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Content-Length", Buffer.byteLength(body));
          response.end(body);
        } catch {
          if (!requestController.signal.aborted && !response.destroyed) {
            setCommonHeaders(response);
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
      if (
        request.localAccessRoot !== undefined &&
        method === "POST" &&
        requestPath === "/topic-meeting/action"
      ) {
        let dispatched = false;
        try {
          const address = server.address();
          const origin =
            publicOrigin?.origin ??
            (address && typeof address !== "string"
              ? `http://${HOST}:${address.port}`
              : null);
          if (
            !origin ||
            requestUrl.search !== "" ||
            incoming.headers.host !== new URL(origin).host ||
            incoming.headers.origin !== origin ||
            incoming.headers["content-type"]?.split(";")[0]?.trim() !==
              "application/x-www-form-urlencoded"
          )
            throw new Error("workbench_record_input_invalid");
          const form = await readActionForm(incoming);
          validateTopicMeetingActionForm(form);
          if (
            form.get("actionToken") !== actionToken ||
            !credentialAdministration
          )
            throw new Error("workbench_record_input_invalid");
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
          const collection = resolveRepositoryAccessCollection(
            credentialAdministration.root,
            credentialAdministration.token,
          );
          if (collection.status !== "completed")
            throw new Error("workbench_record_access_unavailable");
          const access = composeAuthorizedTopicMeeting(
            collection.repositories,
            form.get("repositoryId") ?? "",
            requestController.signal,
          );
          if (!access || requestController.signal.aborted)
            throw new Error("workbench_record_access_unavailable");
          dispatched = true;
          const result = executeTopicMeetingActionForm(access, form);
          const body = JSON.stringify({
            ...createTopicMeetingResultView(result),
            filesystemEffectCount: result.filesystemEffectCount,
          });
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
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
          setCommonHeaders(response);
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Content-Length", Buffer.byteLength(body));
          response.end(body);
        } catch {
          if (!requestController.signal.aborted && !response.destroyed) {
            setCommonHeaders(response);
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
      if (
        request.localAccessRoot !== undefined &&
        method === "POST" &&
        requestPath === "/ai-profiles/action"
      ) {
        let dispatched = false;
        try {
          const address = server.address();
          const origin =
            publicOrigin?.origin ??
            (address && typeof address !== "string"
              ? `http://${HOST}:${address.port}`
              : null);
          if (
            !origin ||
            requestUrl.search !== "" ||
            incoming.headers.host !== new URL(origin).host ||
            incoming.headers.origin !== origin ||
            incoming.headers["content-type"]?.split(";")[0]?.trim() !==
              "application/x-www-form-urlencoded"
          )
            throw new Error("workbench_profile_input_invalid");
          const form = await readActionForm(incoming);
          if (
            form.getAll("actionToken").length !== 1 ||
            form.get("actionToken") !== actionToken
          )
            throw new Error("workbench_profile_input_invalid");
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
          if (
            !credentialAdministration ||
            !request.crosProfileAdministration ||
            evaluateAiProfileManagementPermission(
              credentialAdministration.root,
              credentialAdministration.token,
            ) !== "allowed"
          )
            throw new Error("workbench_profile_access_unavailable");
          const read = request.crosProfileAdministration.snapshot();
          if (read.status !== "read") throw new Error(read.error);
          const snapshot = read.value;
          const mutation = aiProfileMutation(form, snapshot);
          dispatched = true;
          const raw = request.crosProfileAdministration.execute(mutation);
          const result = validateAiProfileMutationResult(mutation, raw).value;
          if (!result || result.status === "unknown")
            throw new Error("workbench_profile_result_invalid");
          const body = JSON.stringify(result);
          await yieldToTransport(0);
          if (requestController.signal.aborted || response.destroyed) return;
          if (
            evaluateAiProfileManagementPermission(
              credentialAdministration.root,
              credentialAdministration.token,
            ) !== "allowed"
          )
            throw new Error("workbench_profile_access_unavailable");
          setCommonHeaders(response);
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Content-Length", Buffer.byteLength(body));
          response.end(body);
        } catch {
          if (!requestController.signal.aborted && !response.destroyed) {
            setCommonHeaders(response);
            response.statusCode = dispatched ? 503 : 400;
            response.end(
              dispatched
                ? "ai_profile_action_outcome_unconfirmed\n"
                : "ai_profile_action_rejected\n",
            );
          }
        }
        return;
      }
      if (method === "POST" && requestPath === "/topic-meeting/action") {
        let actionDispatched = false;
        try {
          if (projectSurface === undefined || topicMeeting === undefined)
            throw new Error("workbench_repository_access_unavailable");
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
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
              !new RegExp(
                kind === "topic" ? "^TOPIC-\\d{6}$" : "^MTG-\\d{6}$",
                "u",
              ).test(form.get("id") ?? "") ||
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
          if (operation === "create" || operation === "update") {
            if (kind === "topic")
              parseTopicMarkdown(form.get("markdown") ?? "");
            else parseMeetingMarkdown(form.get("markdown") ?? "");
          }
          if (operation === "create") {
            actionDispatched = true;
            topicMeetingResult = topicMeeting[kind].create(
              form.get("markdown") ?? "",
            );
          } else if (operation === "update") {
            actionDispatched = true;
            topicMeetingResult = topicMeeting[kind].update({
              id: form.get("id") ?? "",
              expectedRevision: Number(form.get("expectedRevision")),
              markdown: form.get("markdown") ?? "",
            });
          } else if (operation === "delete") {
            actionDispatched = true;
            topicMeetingResult = topicMeeting[kind].delete({
              id: form.get("id") ?? "",
              expectedRevision: Number(form.get("expectedRevision")),
              confirmed: form.get("confirmed") === "true",
              reason: "mistaken_registration",
            });
          } else if (operation === "treat-outcome" && kind === "meeting") {
            actionDispatched = true;
            const outcome = topicMeeting.meeting.treatMeetingOutcome({
              meetingId: form.get("id") ?? "",
              expectedRevision: Number(form.get("expectedRevision")),
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
            });
            topicMeetingResult = Object.freeze({
              ...outcome,
              relationPaths: Object.freeze([]),
            });
          } else if (operation === "promote-topic" && kind === "topic") {
            actionDispatched = true;
            const promotion = topicMeeting.topic.promoteTopic({
              topicId: form.get("id") ?? "",
              expectedRevision: Number(form.get("expectedRevision")),
              changeId: form.get("changeId") ?? "",
              reason: form.get("reason") ?? "",
              remainingResponsibility:
                form.get("remainingResponsibility") ?? "",
            });
            topicMeetingResult = Object.freeze({
              ...promotion,
              relationPaths: Object.freeze([]),
            });
          } else {
            throw new Error("workbench_record_operation_invalid");
          }
          projectSurface = await readWorkbenchProjectSurface(repositoryRoot);
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader(
            "Location",
            `/${kind === "topic" ? "#topics" : "#meetings"}`,
          );
          response.end();
        } catch {
          setCommonHeaders(response);
          response.statusCode = actionDispatched ? 500 : 400;
          response.end(
            actionDispatched
              ? "topic_meeting_action_failed\n"
              : "topic_meeting_action_rejected\n",
          );
        }
        return;
      }
      if (method === "POST" && requestPath === "/repository/action") {
        if (projectSurface === undefined)
          throw new Error("workbench_repository_access_unavailable");
        try {
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          lastActionResult = executeChangePublication(
            verification.capability,
            actionRequest(form),
            gitChangePublicationAdapter,
          );
          try {
            projectSurface = await readWorkbenchProjectSurface(repositoryRoot);
          } catch {
            projectSurface = withUnknownRepositoryObservation(projectSurface);
          }
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#repository");
          response.end();
        } catch {
          setCommonHeaders(response);
          response.statusCode = 400;
          response.end("repository_action_rejected\n");
        }
        return;
      }
      if (
        (method === "GET" && requestPath === "/api/access-management") ||
        (method === "POST" && requestPath === "/access-management/action")
      ) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        const responseClosed = () => {
          if (!response.writableFinished) abort();
        };
        incoming.once("aborted", abort);
        response.once("close", responseClosed);
        const pending = (async () => {
          try {
            const address = server.address();
            const origin =
              publicOrigin?.origin ??
              (address && typeof address !== "string"
                ? `http://${HOST}:${address.port}`
                : null);
            if (
              !origin ||
              incoming.headers.host !== new URL(origin).host ||
              (incoming.headers.origin !== undefined &&
                incoming.headers.origin !== origin)
            )
              throw new Error("workbench_management_input_invalid");
            const connection = credentialAdministration;
            setCommonHeaders(response);
            response.setHeader(
              "Content-Type",
              "application/json; charset=utf-8",
            );
            response.setHeader(
              "x-crdd-management-mode",
              connection === undefined ? "none" : "local",
            );
            let result: unknown;
            if (method === "GET") {
              const view = requestUrl.searchParams.get("view");
              if (
                !view ||
                ![
                  "current",
                  "users",
                  "roles",
                  "repositories",
                  "exposure",
                ].includes(view) ||
                [...requestUrl.searchParams.keys()].some(
                  (key) => key !== "view",
                ) ||
                requestUrl.searchParams.getAll("view").length !== 1
              )
                throw new Error("workbench_management_input_invalid");
              if (
                controller.signal.aborted ||
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
                  : await readWorkbenchManagement(
                      connection,
                      view as ManagementView,
                      controller.signal,
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
                controller.signal.aborted ||
                incoming.aborted ||
                response.destroyed
              )
                return;
              result = await executeWorkbenchManagement(
                connection,
                form,
                controller.signal,
              );
            }
            await yieldToTransport(0);
            if (controller.signal.aborted || response.destroyed) return;
            let body = JSON.stringify(result);
            if (Buffer.byteLength(body, "utf8") > 16777216)
              body = JSON.stringify({
                status: "unavailable",
                reason: "management_response_too_large",
              });
            response.end(body);
          } catch (error) {
            if (
              !response.headersSent &&
              !response.destroyed &&
              !controller.signal.aborted
            ) {
              setCommonHeaders(response);
              response.setHeader(
                "Content-Type",
                "application/json; charset=utf-8",
              );
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
        pendingRequests.add(pending);
        try {
          await pending;
        } finally {
          pendingRequests.delete(pending);
          incoming.removeListener("aborted", abort);
          response.removeListener("close", responseClosed);
        }
        return;
      }
      if (
        method === "POST" &&
        requestPath === "/connection-credentials/action"
      ) {
        try {
          if (credentialAdministration === undefined)
            throw new Error("workbench_credential_administration_unavailable");
          const address = server.address();
          const origin =
            publicOrigin?.origin ??
            (address && typeof address !== "string"
              ? `http://${HOST}:${address.port}`
              : null);
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
          setCommonHeaders(response);
          const controller = new AbortController();
          const abort = () => controller.abort();
          incoming.once("aborted", abort);
          const responseClosed = () => {
            if (!response.writableFinished) abort();
          };
          response.once("close", responseClosed);
          const pending = executeCredentialAdministrationAction(
            credentialAdministration,
            form,
            response,
            controller.signal,
          );
          pendingRequests.add(pending);
          try {
            await pending;
          } finally {
            pendingRequests.delete(pending);
            incoming.removeListener("aborted", abort);
            response.removeListener("close", responseClosed);
          }
        } catch {
          if (!response.headersSent && !response.destroyed) {
            setCommonHeaders(response);
            response.statusCode = 400;
            response.end("credential_action_rejected\n");
          }
        }
        return;
      }
      if (method === "POST" && requestPath === "/ai-profiles/action") {
        let profileDispatched = false;
        try {
          const administrationSnapshot =
            aiProfileAdministration?.snapshot().value;
          if (administrationSnapshot == null)
            throw new Error("workbench_ai_profile_administration_unavailable");
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          const mutation = aiProfileMutation(form, administrationSnapshot);
          if (requestController.signal.aborted) return;
          if (aiProfileAdministration === undefined)
            throw new Error("workbench_ai_profile_administration_unavailable");
          profileDispatched = true;
          const result = aiProfileAdministration.execute(mutation);
          if (result.status === "unknown") {
            aiProfileAdministrationResult = null;
            throw new Error(result.reason);
          }
          aiProfileAdministrationResult = result;
          aiProfiles = createWorkbenchAiProfileSurface(
            aiProfileAdministrationResult.snapshot.catalog,
          );
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#ai-profile-administration");
          response.end();
        } catch {
          if (requestController.signal.aborted || response.destroyed) return;
          setCommonHeaders(response);
          response.statusCode = profileDispatched ? 503 : 400;
          response.end(
            profileDispatched
              ? "ai_profile_action_outcome_unconfirmed\n変更結果を確認できません。未保存と判断せず、現在状態を再確認してください。自動再送は行いません。\n"
              : "ai_profile_action_rejected\n",
          );
        }
        return;
      }
      if (method === "POST" && requestPath === "/ai-request/action") {
        try {
          if (aiRequests === undefined)
            throw new Error("workbench_ai_request_application_unavailable");
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          const operation = form.get("operation");
          if (operation === "start") {
            const mode = form.get("mode");
            const profileId = form.get("profileId") ?? "";
            const prompt = (form.get("prompt") ?? "").trim();
            const allowedPaths = (form.get("allowedPaths") ?? "")
              .split(/\r?\n/u)
              .map((value) => value.trim().replaceAll("\\", "/"))
              .filter((value) => value.length > 0);
            const externalSendConfirmed =
              form.get("externalSendConfirmed") === "yes";
            if (mode !== "read_only_advice" && mode !== "workspace_edit")
              throw new Error("workbench_ai_request_mode_invalid");
            if (
              !aiProfiles.catalog.profiles.some(
                (profile) => profile.profileId === profileId,
              )
            )
              throw new Error("workbench_ai_request_profile_invalid");
            if (prompt.length === 0 || prompt.length > 16_000)
              throw new Error("workbench_ai_request_prompt_invalid");
            if (
              allowedPaths.length > 64 ||
              new Set(allowedPaths).size !== allowedPaths.length ||
              allowedPaths.some(
                (value) =>
                  value.length > 512 ||
                  value.startsWith("/") ||
                  /^[A-Za-z]:/u.test(value) ||
                  value.split("/").includes(".."),
              ) ||
              (mode === "read_only_advice" && allowedPaths.length !== 0) ||
              (mode === "workspace_edit" && allowedPaths.length === 0)
            )
              throw new Error("workbench_ai_request_allowed_paths_invalid");
            if (!externalSendConfirmed)
              throw new Error(
                "workbench_ai_external_send_confirmation_required",
              );
            const result = await aiRequests.start(
              Object.freeze({
                mode,
                profileId,
                prompt,
                contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
                allowedPaths: Object.freeze(allowedPaths),
                externalSendConfirmed,
                workspaceId: form.get("workspaceId")?.trim() || null,
              }),
            );
            if (result.status === "accepted" && result.requestId !== null) {
              currentAiRequestId = result.requestId;
              aiRequestSnapshot = Object.freeze({
                requestId: result.requestId,
                mode,
                profileId,
                status: "accepted",
                reason: result.reason,
                facts: Object.freeze([]),
                sharedAnalysis: Object.freeze([]),
                additionalInferences: Object.freeze([]),
                nextOptions: Object.freeze([]),
                candidate: null,
              });
              aiRequestNotice = "AI依頼を受け付けました。";
            } else {
              aiRequestNotice = `AI依頼を開始できませんでした: ${result.reason ?? "blocked"}`;
            }
          } else if (operation === "cancel" || operation === "observe") {
            const requestId = form.get("requestId") ?? "";
            const previous = await aiRequests.observe(requestId);
            if (
              previous.mode === null ||
              previous.reason === "orchestrator_task_not_available"
            )
              throw new Error("workbench_ai_request_identity_invalid");
            aiRequestSnapshot =
              operation === "cancel"
                ? await aiRequests.cancel(requestId)
                : previous;
            if (currentAiRequestId === null) currentAiRequestId = requestId;
            aiRequestNotice =
              operation === "cancel"
                ? "取消結果を取得しました。"
                : "保存済み依頼を確認しました。";
          } else {
            throw new Error("workbench_ai_request_operation_invalid");
          }
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#ai-request");
          response.end();
        } catch {
          setCommonHeaders(response);
          response.statusCode = 400;
          response.end("ai_request_action_rejected\n");
        }
        return;
      }
      if (method === "POST" && requestPath === "/candidate/action") {
        setCommonHeaders(response);
        response.statusCode = 410;
        response.end("legacy_bundle_candidate_route_removed\n");
        return;
      }
      if (method !== "GET" && method !== "HEAD") {
        setCommonHeaders(response);
        response.statusCode = 405;
        response.setHeader("Allow", "GET, HEAD");
        response.end(method === "HEAD" ? undefined : "method_not_allowed\n");
        return;
      }
      let body: string | Buffer;
      let contentType: string;
      if (projectSurface === undefined || topicMeeting === undefined)
        throw new Error("workbench_repository_access_unavailable");
      if (
        requestPath === "/" ||
        requestPath === "/index.html" ||
        requestPath === "/api/workbench-view"
      ) {
        if (aiRequests !== undefined && currentAiRequestId !== null) {
          try {
            aiRequestSnapshot = await aiRequests.observe(currentAiRequestId);
          } catch {
            aiRequestSnapshot = Object.freeze({
              requestId: currentAiRequestId,
              mode: aiRequestSnapshot?.mode ?? "read_only_advice",
              profileId: aiRequestSnapshot?.profileId ?? "unknown",
              status: "unknown",
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
            const runtimeCursor = requestUrl.searchParams.get("runtimeCursor");
            const page = {
              ...(runtimeCursor === null ? {} : { cursor: runtimeCursor }),
              limit: 20,
            };
            runtimeActivityObservation = await activityReader.observe(
              projectSurface.context.projectId,
              page,
            );
          } catch {
            runtimeActivityObservation = Object.freeze({
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
        const topicCursor = requestUrl.searchParams.get("topicCursor");
        const meetingCursor = requestUrl.searchParams.get("meetingCursor");
        const topicQuery = readWorkbenchRecordQuery(
          requestUrl.searchParams,
          "topic",
        );
        const meetingQuery = readWorkbenchRecordQuery(
          requestUrl.searchParams,
          "meeting",
        );
        const selectedRepositoryId = undefined;
        const topicCollection = projectSurface.topics;
        const meetingCollection = projectSurface.meetings;
        const topicPage = topicMeeting.topic.list({
          ...(topicCursor === null ? {} : { cursor: topicCursor }),
          limit: 20,
          query: topicQuery,
        });
        const meetingPage = topicMeeting.meeting.list({
          ...(meetingCursor === null ? {} : { cursor: meetingCursor }),
          limit: 20,
          query: meetingQuery,
        });
        const topicMeetingReader: WorkbenchTopicMeetingDocumentReader = {
          getDocument: (kind, id) => topicMeeting[kind].getDocument(id),
          relations: (kind, id) => topicMeeting[kind].relations(id),
        };
        let worktreeView: Readonly<{
          state: "available" | "unknown";
          tree: RepositoryWorktreeTreePage | null;
          diff: RepositoryWorktreeFileDiff | null;
        }> = Object.freeze({ state: "unknown", tree: null, diff: null });
        if (
          projectSurface.repository.state === "available" &&
          projectSurface.repository.changeSet !== null
        ) {
          try {
            const changeSet = projectSurface.repository.changeSet;
            const tree = observeRepositoryWorktreeTree(
              verification.capability,
              changeSet,
              requestUrl.searchParams.get("treeDirectory") ?? "",
              requestUrl.searchParams.get("treeCursor") ?? undefined,
              50,
              gitRepositoryWorktreeViewAdapter,
            );
            const diffPath = requestUrl.searchParams.get("diffPath");
            const diff =
              diffPath === null
                ? null
                : observeRepositoryWorktreeFileDiff(
                    verification.capability,
                    changeSet,
                    diffPath,
                    gitRepositoryWorktreeViewAdapter,
                  );
            worktreeView = Object.freeze({ state: "available", tree, diff });
          } catch {
            worktreeView = Object.freeze({
              state: "unknown",
              tree: null,
              diff: null,
            });
          }
        }
        const clientModel = createWorkbenchMainViewModel(
          projectSurface,
          portfolio,
          actionToken,
          lastActionResult,
          credentialAdministration,
          connectionState,
          topicCollection,
          meetingCollection,
          topicMeetingReader,
          topicPage,
          topicQuery,
          meetingPage,
          meetingQuery,
          topicMeetingResult,
          aiProfiles,
          aiProfileAdministration?.snapshot().value ?? undefined,
          "Repository",
          aiProfileAdministrationResult,
          aiRequests,
          aiRequestSnapshot,
          aiRequestNotice,
          runtimeActivityObservation,
          requestUrl.searchParams.get("documentQuery") ?? "",
          Object.freeze({
            query: requestUrl.searchParams.get("portfolioQuery") ?? "",
            state: requestUrl.searchParams.get("portfolioState") ?? "",
            cursor: requestUrl.searchParams.get("portfolioCursor") ?? "",
          }),
          worktreeView,
          selectedRepositoryId,
        );
        let responseModel: WorkbenchClientModel = clientModel;
        const clientRoute = requestUrl.searchParams.get("route") ?? "/";
        if (clientRoute === "/project") {
          const projectId = requestUrl.searchParams.get("id") ?? "";
          const project = portfolio?.projects.find(
            (candidate) => candidate.projectId === projectId,
          );
          if (project === undefined) {
            setCommonHeaders(response);
            response.statusCode = 404;
            response.end(method === "HEAD" ? undefined : "not_found\n");
            return;
          }
          responseModel = Object.freeze({
            contract: "crdd/workbench/client-model/v1",
            view: "project-detail",
            logoPath: LOGO_PATH,
            project,
          });
        } else if (artifactSelection !== null) {
          if (
            requestUrl.searchParams.has("repositoryId") &&
            requestUrl.searchParams.get("repositoryId") !==
              projectSurface.context.repositoryId
          ) {
            setCommonHeaders(response);
            response.statusCode = 403;
            response.end("artifact_access_unavailable\n");
            return;
          }
          const markdown =
            artifactSelection.kind === "change"
              ? await readWorkbenchChangeArtifact(
                  repositoryRoot,
                  artifactSelection.identity,
                )
              : await readWorkbenchOwnerArtifact(
                  repositoryRoot,
                  projectSurface.ownerArtifacts,
                  artifactSelection.identity,
                );
          if (markdown === null) {
            setCommonHeaders(response);
            response.statusCode = 404;
            response.end("artifact_unavailable\n");
            return;
          }
          if (requestController.signal.aborted || response.destroyed) return;
          responseModel = {
            contract: "crdd/workbench/client-model/v1",
            view: "artifact",
            logoPath: LOGO_PATH,
            repositoryId: projectSurface.context.repositoryId,
            selectedRepositoryId: null,
            artifact: { ...artifactSelection, markdown },
          };
        } else if (clientRoute === "/topic" || clientRoute === "/meeting") {
          const kind = clientRoute === "/topic" ? "topic" : "meeting";
          const id = requestUrl.searchParams.get("id") ?? "";
          const expectedPattern =
            kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u;
          const repositoryId = requestUrl.searchParams.get("repositoryId");
          let recordView: WorkbenchRecordDocumentView | null = null;
          if (
            expectedPattern.test(id) &&
            (repositoryId === null ||
              repositoryId === projectSurface.context.repositoryId)
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
            setCommonHeaders(response);
            response.statusCode = 404;
            response.end(method === "HEAD" ? undefined : "not_found\n");
            return;
          }
          responseModel = Object.freeze({
            contract: "crdd/workbench/client-model/v1",
            view: "record-detail",
            logoPath: LOGO_PATH,
            actionToken,
            repositoryId,
            recordActionsConfigured: repositoryId === null,
            record: recordView,
          });
        }
        body =
          requestPath === "/api/workbench-view"
            ? JSON.stringify(responseModel)
            : renderClientDocument();
        if (method === "GET" && requestPath === "/api/workbench-view") {
          topicMeetingResult = null;
          aiProfileAdministrationResult = null;
          aiRequestNotice = null;
        }
        contentType =
          requestPath === "/api/workbench-view"
            ? "application/json; charset=utf-8"
            : "text/html; charset=utf-8";
      } else if (
        requestPath === "/project" ||
        requestPath === "/topic" ||
        requestPath === "/meeting"
      ) {
        body = renderClientDocument();
        contentType = "text/html; charset=utf-8";
      } else if (requestPath === "/change") {
        body = renderClientDocument();
        contentType = "text/html; charset=utf-8";
      } else if (requestPath === "/owner-artifact") {
        body = renderClientDocument();
        contentType = "text/html; charset=utf-8";
      } else if (requestPath === "/workbench.css") {
        body =
          shellCss +
          recordDetailCss +
          repositoryBrowserCss +
          aiRequestCss +
          ownerArtifactCss +
          visualAccessibilityCss +
          visualControlCss;
        contentType = "text/css; charset=utf-8";
      } else if (requestPath === LOGO_PATH) {
        body = logo;
        contentType = "image/jpeg";
      } else if (requestPath === CLIENT_ASSET_PATH) {
        body = clientAsset;
        contentType = "text/javascript; charset=utf-8";
      } else if (requestPath === HEALTH_PATH) {
        body = JSON.stringify({
          contract: CONTRACT,
          status: "ready",
          host: HOST,
          mode: request.localAccessRoot === undefined ? "repository" : "cros",
          ...(connectionState === "repository" ? {} : { connectionState }),
          readOnly: false,
        });
        contentType = "application/json; charset=utf-8";
      } else {
        setCommonHeaders(response);
        response.statusCode = 404;
        response.end(method === "HEAD" ? undefined : "not_found\n");
        return;
      }
      setCommonHeaders(response);
      response.statusCode = 200;
      response.setHeader("Content-Type", contentType);
      response.setHeader("Content-Length", Buffer.byteLength(body));
      response.end(method === "HEAD" ? undefined : body);
    })().catch(() => {
      if (!response.destroyed && !requestController.signal.aborted) {
        if (!response.headersSent) setCommonHeaders(response);
        response.statusCode = 500;
        response.end("workbench_request_failed\n");
      }
    });
    pendingRequests.add(requestPending);
    void requestPending.finally(() => {
      pendingRequests.delete(requestPending);
      incoming.removeListener("aborted", requestAborted);
      response.removeListener("close", requestClosed);
    });
  });
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.once("close", () => connections.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
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
          await new Promise<void>((resolve, reject) => {
            server.close((error) =>
              error === undefined ? resolve() : reject(error),
            );
            for (const connection of connections) connection.destroy();
          });
        } catch (error) {
          primaryFailure = error;
        }
        await Promise.allSettled([...pendingRequests]);
        const ownersClosed = await Promise.allSettled([
          aiRequests?.close?.(),
          ...[...sharedAiSessions.values()].map((session) =>
            session.owner.close?.(),
          ),
        ]);
        sharedAiSessions.clear();
        if (primaryFailure !== null) throw primaryFailure;
        if (ownersClosed.some((result) => result.status === "rejected"))
          throw new Error("workbench_ai_close_unconfirmed");
      })();
      return closeOperation;
    },
  });
}
