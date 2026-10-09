/**
 * Workbench Production Shellのlocalhost Server。
 *
 * @packageDocumentation
 * @responsibility Direction AのWorkbench Shellと公式ロゴをloopback限定で配信する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000015
 * @trace ARCH-000017
 * @boundary BrowserとWorkbench Application Adapterのlocalhost HTTP境界。
 * @effect localhost Listenerを開始・終了し、承認済みBrand Assetを読取る。
 * @security 外部Bind、任意Filesystem参照、Force Pushおよび未確認公開を許可せず、Credential管理は検証済み管理Contextの注入時だけ許可する。
 */
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import path from "node:path";

import type {
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicPromotionCommandResult,
  TopicMeetingWriteResult,
} from "../../domain-model/src/index.ts";
import {
  createTopicOperations,
  parseTopicMarkdown,
  parseMeetingMarkdown,
} from "../../domain-model/src/index.ts";
import type { MeetingOutcomeCommandResult } from "../../domain-model/src/index.ts";
import { createMeetingOperations } from "../../domain-model/src/index.ts";
import {
  executeRemoteAiProfileMutation,
  listConnectionCredentials,
  readRemoteAiProfileCatalog,
  readRemotePortfolio,
  readRemoteRuntimeActivity,
  type PortfolioProjection,
} from "../../cros/src/index.ts";
import {
  executeChangePublication,
  gitChangePublicationAdapter,
  gitRepositoryWorktreeViewAdapter,
  observeRepositoryWorktreeFileDiff,
  observeRepositoryWorktreeTree,
  type ChangePublicationRequest,
  type ChangePublicationResult,
  type RepositoryWorktreeFileDiff,
  type RepositoryWorktreeTreePage,
} from "../../version-control/src/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../version-control/src/repository/location.ts";
import {
  readWorkbenchProjectSurface,
  type WorkbenchProjectSurface,
} from "./project/surface.ts";
import {
  type CredentialAdministration,
  type CredentialAdministrationResult,
  executeCredentialAdministrationAction,
} from "./credential/administration.ts";
import {
  createAiProfileCatalogAdministration,
  createRepositoryAiProfileCatalogStore,
  type AiModelTier,
  type AiProfileCatalogMutation,
  type AiProfileCatalogMutationResult,
  type AiProfileCatalogSnapshot,
  type AiProfileDefinition,
  type AiReasoningEffort,
  type AiSelectionRole,
} from "../../ai-adapter/src/index.ts";
import {
  createDefaultWorkbenchAiProfileSurface,
  createWorkbenchAiProfileSurface,
  type WorkbenchAiProfileSurface,
} from "./ai-profile/projection.ts";
import type {
  WorkbenchAiRequests,
  WorkbenchAiRequestSnapshot,
  WorkbenchCandidateActionResult,
  WorkbenchCandidateActions,
  WorkbenchCandidateReviewResult,
} from "./ai-request/types.ts";
import {
  createRepositoryWorkbenchActivityReader,
  type WorkbenchActivityReader,
  type WorkbenchRuntimeActivityObservation,
} from "./activity/observe.ts";
import {
  readWorkbenchChangeArtifact,
  readWorkbenchOwnerArtifact,
} from "./owner-artifact/read.ts";
import {
  executeRemoteTopicMeetingAction,
  readRemoteTopicMeetingDocument,
  readRemoteTopicMeetingPage,
  type RemoteTopicMeetingAction,
  type WorkbenchTopicMeetingDocumentReader,
} from "./topic-meeting/mcp-adapter.ts";
import type {
  WorkbenchClientModel,
  WorkbenchCredentialAdministrationView,
  WorkbenchMainViewModel,
  WorkbenchRecordDocumentView,
  WorkbenchTopicMeetingResultView,
} from "./browser/client-model.ts";

const HOST = "127.0.0.1";
const CONTRACT = "crdd/workbench/v1";
const HEALTH_PATH = "/.well-known/crdd-workbench-health";
const LOGO_PATH = "/assets/crdd-brand-icon.jpg";
const CLIENT_ASSET_PATH = "/assets/workbench-client.js";

export type WorkbenchStartRequest = Readonly<{
  workingDirectory: string;
  port?: number;
  portfolio?: PortfolioProjection;
  credentialAdministration?: CredentialAdministration;
  aiProfiles?: WorkbenchAiProfileSurface;
  aiRequests?: WorkbenchAiRequests;
  candidateActions?: WorkbenchCandidateActions;
  activityReader?: WorkbenchActivityReader;
  remoteConnection?: Readonly<{
    baseUrl: string;
    token: string;
    mcpBaseUrl?: string;
  }>;
}>;

type WorkbenchConnectionState =
  | "repository"
  | "cros_available"
  | "cros_unavailable";

type WorkbenchRemoteConnection = Readonly<{
  baseUrl: string;
  token: string;
  mcpBaseUrl?: string;
}>;

type WorkbenchConnectionNotice = Readonly<{
  status: "completed" | "rejected";
  message: string;
}>;

type TopicMeetingActionResult =
  | TopicMeetingWriteResult
  | ((MeetingOutcomeCommandResult | TopicPromotionCommandResult) & {
      relationPaths: readonly string[];
    });

/**
 * 許可済みPortfolioに明示Repositoryが含まれるか確認する。
 *
 * @responsibility Repository IDの指定だけをRemote操作Authorityとして扱わず、現在取得したPortfolio Sourceとの一致を確認する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input portfolioに現在の許可済みPortfolio、repositoryIdに利用者が明示選択したRepository IDを受け取る。
 * @returns 現在のPortfolio Sourceに完全一致する場合だけtrueを返す。
 * @precondition N/A: 未取得Portfolioと空IDも受け付ける。
 * @postcondition 対象Repositoryの存在やRoleを追加開示しない。
 * @effect N/A: 現在Snapshotを照合するだけである。
 * @failure N/A: 不一致と未取得をfalseへ閉じる。
 * @invariant PortfolioにないRepositoryを許可候補へ昇格しない。
 * @boundary Browser入力とRemote CROS許可済みPortfolioの境界。
 * @security Repository IDを知っていることをContent Access Authorityとして扱わない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isVisiblePortfolioRepository(
  portfolio: PortfolioProjection | undefined,
  repositoryId: string,
): boolean {
  return (
    repositoryId.length > 0 &&
    portfolio?.projects.some((project) =>
      project.sources.some((source) => source.repositoryId === repositoryId),
    ) === true
  );
}

/**
 * Remote MCP書込み結果をWorkbench表示契約へ検証縮約する。
 *
 * @responsibility 未信頼MCP結果の状態・理由・Effect件数・Relation PathだけをWorkbenchが利用できる閉じた結果へ変換する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input valueにRemote MCPから返った未信頼値を受け取る。
 * @returns 検証済みのTopic／Meeting操作結果を返す。
 * @precondition N/A: 任意値を受け付ける。
 * @postcondition 許可していない形の結果を部分成功として返さない。
 * @effect N/A: 値を検証・縮約するだけである。
 * @failure 契約外の値をworkbench_remote_topic_meeting_result_invalidで拒否する。
 * @invariant filesystemEffectCountを0または1に限定する。
 * @boundary Remote MCP結果とWorkbench View Modelの境界。
 * @security Relation Pathを文字列だけに限定し、結果から追加Authorityを生成しない。
 * @concurrency N/A: 同期処理であり入力を変更しない。
 */
function inspectTopicMeetingActionResult(
  value: unknown,
): TopicMeetingActionResult {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("status" in value) ||
    !("reason" in value) ||
    !("record" in value) ||
    !("filesystemEffectCount" in value) ||
    (value.status !== "completed" && value.status !== "blocked") ||
    typeof value.reason !== "string" ||
    (value.filesystemEffectCount !== 0 && value.filesystemEffectCount !== 1)
  )
    throw new Error("workbench_remote_topic_meeting_result_invalid");
  return Object.freeze({
    ...(value as TopicMeetingActionResult),
    relationPaths:
      "relationPaths" in value && Array.isArray(value.relationPaths)
        ? Object.freeze(
            value.relationPaths.filter(
              (entry): entry is string => typeof entry === "string",
            ),
          )
        : Object.freeze([]),
  });
}

export type WorkbenchHandle = Readonly<{
  contract: typeof CONTRACT;
  baseUrl: string;
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

/** Credential RegistryからBrowserへ公開可能なMetadataだけを抽出する。 */
function createCredentialAdministrationView(
  administration: CredentialAdministration | undefined,
  result: CredentialAdministrationResult | null,
): WorkbenchCredentialAdministrationView {
  if (administration === undefined)
    return Object.freeze({
      state: "not_configured",
      credentials: Object.freeze([]),
      result,
    });
  const listed = listConnectionCredentials(
    administration.registry,
    administration.access,
  );
  if (listed.status === "blocked")
    return Object.freeze({
      state: "unavailable",
      credentials: Object.freeze([]),
      result,
    });
  return Object.freeze({
    state: "available",
    credentials: Object.freeze(
      listed.credentials.map((credential) =>
        Object.freeze({
          credentialId: credential.credentialId,
          profile: credential.profile,
          workspaceIds: Object.freeze([...credential.workspaceIds]),
          systemAdmin: credential.systemAdmin,
          revoked: credential.revoked,
        }),
      ),
    ),
    result,
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
  credentialResult: CredentialAdministrationResult | null,
  connectionState: WorkbenchConnectionState,
  remoteConnection: WorkbenchRemoteConnection | undefined,
  connectionNotice: WorkbenchConnectionNotice | null,
  topicCollection: WorkbenchProjectSurface["topics"],
  meetingCollection: WorkbenchProjectSurface["meetings"],
  topicMeeting: WorkbenchTopicMeetingDocumentReader,
  topicPage: TopicMeetingPage,
  topicQuery: TopicMeetingListQuery,
  meetingPage: TopicMeetingPage,
  meetingQuery: TopicMeetingListQuery,
  topicMeetingResult: TopicMeetingActionResult | null,
  aiProfiles: WorkbenchAiProfileSurface,
  aiProfileAdministrationSnapshot: AiProfileCatalogSnapshot | undefined,
  aiProfileAdministrationOwner: "Repository" | "CROS",
  aiProfileAdministrationResult: AiProfileCatalogMutationResult | null,
  aiRequests: WorkbenchAiRequests | undefined,
  aiRequestSnapshot: WorkbenchAiRequestSnapshot | null,
  candidateActions: WorkbenchCandidateActions | undefined,
  candidateReview: WorkbenchCandidateReviewResult | null,
  candidateAction: WorkbenchCandidateActionResult | null,
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
      endpoint: remoteConnection?.baseUrl ?? null,
      notice: connectionNotice,
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
    repositoryResult: lastResult,
    worktree,
    credentials: createCredentialAdministrationView(
      credentialAdministration,
      credentialResult,
    ),
    aiProfiles,
    aiProfileAdministration: Object.freeze({
      snapshot: aiProfileAdministrationSnapshot ?? null,
      owner: aiProfileAdministrationOwner,
      result: aiProfileAdministrationResult,
    }),
    aiRequest: Object.freeze({
      configured: aiRequests !== undefined,
      candidateConfigured: candidateActions !== undefined,
      snapshot: aiRequestSnapshot,
      candidateReview,
      candidateAction,
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

const visualControlCss = `button,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select,textarea{min-height:40px}label.confirm{display:flex;align-items:center;gap:7px;min-height:40px}`;

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
  const expectedRevision = Number(form.get("expectedRevision"));
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
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
 * @effect localhost Listenerを開始し、公式Logo Assetを読取り、明示操作時だけRepositoryまたは確認済みRemoteを変更し得る。
 * @failure Root不正、Asset欠落、Bind失敗または観測不能時はErrorとし、未所有資源を残さない。
 * @invariant 任意Path、Directory一覧、Force Push、暗黙再送および未検証ContextからのCredential管理を提供しない。
 * @boundary BrowserとWorkbench Serverの直接境界。
 * @security hostは127.0.0.1固定であり、書込みRouteは起動ごとのTokenと固定Form Schemaを要求する。
 * @concurrency 複数Requestは独立処理し、closeが全所有Connectionを終了する。
 */
export async function startWorkbench(
  request: WorkbenchStartRequest,
): Promise<WorkbenchHandle> {
  const port = request.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("workbench_port_invalid");
  if (request.portfolio !== undefined && request.remoteConnection !== undefined)
    throw new Error("workbench_portfolio_source_conflicting");
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
  let projectSurface = await readWorkbenchProjectSurface(repositoryRoot);
  const aiProfileStore = createRepositoryAiProfileCatalogStore(repositoryRoot);
  const aiProfileAdministration =
    request.aiProfiles === undefined && aiProfileStore.status === "ready"
      ? createAiProfileCatalogAdministration(aiProfileStore.store)
      : undefined;
  let aiProfiles =
    request.aiProfiles ??
    (aiProfileStore.status === "ready"
      ? createWorkbenchAiProfileSurface(aiProfileStore.store.snapshot().catalog)
      : createDefaultWorkbenchAiProfileSurface());
  const aiRequests = request.aiRequests;
  const candidateActions = request.candidateActions;
  const activityReader =
    request.activityReader ??
    createRepositoryWorkbenchActivityReader(repositoryRoot);
  const topicMeeting = Object.freeze({
    topic: createTopicOperations(repositoryRoot),
    meeting: createMeetingOperations(repositoryRoot),
  });
  let remoteConnection: WorkbenchRemoteConnection | undefined =
    request.remoteConnection;
  const credentialAdministration = request.credentialAdministration;
  let portfolio = request.portfolio;
  let remoteAiProfileAdministrationSnapshot:
    | AiProfileCatalogSnapshot
    | undefined;
  let connectionState: WorkbenchConnectionState =
    portfolio === undefined ? "repository" : "cros_available";
  if (remoteConnection !== undefined) {
    try {
      portfolio = await readRemotePortfolio(
        remoteConnection.baseUrl,
        remoteConnection.token,
      );
      remoteAiProfileAdministrationSnapshot = await readRemoteAiProfileCatalog(
        remoteConnection.baseUrl,
        remoteConnection.token,
      ).catch(() => undefined);
      connectionState = "cros_available";
    } catch {
      portfolio = undefined;
      connectionState = "cros_unavailable";
    }
  }
  let lastActionResult: ChangePublicationResult | null = null;
  let credentialResult: CredentialAdministrationResult | null = null;
  let connectionNotice: WorkbenchConnectionNotice | null = null;
  let topicMeetingResult: TopicMeetingActionResult | null = null;
  let currentAiRequestId: string | null = null;
  let aiRequestSnapshot: WorkbenchAiRequestSnapshot | null = null;
  let aiRequestNotice: string | null = null;
  let candidateReview: WorkbenchCandidateReviewResult | null = null;
  let candidateAction: WorkbenchCandidateActionResult | null = null;
  let runtimeActivityObservation:
    | WorkbenchRuntimeActivityObservation
    | undefined;
  let aiProfileAdministrationResult: AiProfileCatalogMutationResult | null =
    null;
  const actionToken = randomBytes(32).toString("base64url");
  const connections = new Set<Socket>();
  const server = createServer((incoming, response) => {
    void (async () => {
      const method = incoming.method ?? "";
      const requestUrl = new URL(incoming.url ?? "/", `http://${HOST}`);
      const requestPath = requestUrl.pathname;
      if (method === "POST" && requestPath === "/topic-meeting/action") {
        let actionDispatched = false;
        try {
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
          const repositoryId = form.get("repositoryId") ?? "";
          if (remoteConnection !== undefined) {
            if (!isVisiblePortfolioRepository(portfolio, repositoryId))
              throw new Error("workbench_remote_repository_unavailable");
            let action: RemoteTopicMeetingAction;
            if (operation === "create") {
              action = Object.freeze({
                operation,
                kind,
                markdown: form.get("markdown") ?? "",
              });
            } else if (operation === "update") {
              action = Object.freeze({
                operation,
                kind,
                id: form.get("id") ?? "",
                expectedRevision: Number(form.get("expectedRevision")),
                markdown: form.get("markdown") ?? "",
              });
            } else if (operation === "delete") {
              action = Object.freeze({
                operation,
                kind,
                id: form.get("id") ?? "",
                expectedRevision: Number(form.get("expectedRevision")),
                confirmed: form.get("confirmed") === "true",
              });
            } else if (operation === "promote-topic" && kind === "topic") {
              action = Object.freeze({
                operation,
                kind,
                id: form.get("id") ?? "",
                expectedRevision: Number(form.get("expectedRevision")),
                changeId: form.get("changeId") ?? "",
                reason: form.get("reason") ?? "",
                remainingResponsibility:
                  form.get("remainingResponsibility") ?? "",
              });
            } else if (operation === "treat-outcome" && kind === "meeting") {
              action = Object.freeze({
                operation,
                kind,
                id: form.get("id") ?? "",
                expectedRevision: Number(form.get("expectedRevision")),
                outcomeId: form.get("outcomeId") ?? "",
                disposition: form.get("disposition") as
                  | "completed"
                  | "transferred"
                  | "promoted"
                  | "rejected",
                owner: form.get("owner") ?? "",
                reviewTrigger: form.get("reviewTrigger") ?? "",
                targetKind: form.get("targetKind") as
                  | "topic"
                  | "change"
                  | "owner"
                  | "none",
                targetReference: form.get("targetReference") ?? "",
                treatment: form.get("treatment") ?? "",
                completionCondition: form.get("completionCondition") ?? "",
                result: form.get("result") ?? "",
                closeMeeting: form.get("closeMeeting") === "true",
              });
            } else {
              throw new Error("workbench_record_operation_invalid");
            }
            actionDispatched = true;
            topicMeetingResult = inspectTopicMeetingActionResult(
              await executeRemoteTopicMeetingAction(
                remoteConnection.mcpBaseUrl ?? remoteConnection.baseUrl,
                remoteConnection.token,
                repositoryId,
                action,
              ),
            );
          } else if (operation === "create") {
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
            `${repositoryId.length === 0 ? "/" : `/?repositoryId=${encodeURIComponent(repositoryId)}`}${kind === "topic" ? "#topics" : "#meetings"}`,
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
        method === "POST" &&
        requestPath === "/connection-credentials/action"
      ) {
        try {
          if (credentialAdministration === undefined)
            throw new Error("workbench_credential_administration_unavailable");
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          credentialResult = executeCredentialAdministrationAction(
            credentialAdministration,
            form,
          );
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#credential-administration");
          response.end();
        } catch {
          setCommonHeaders(response);
          response.statusCode = 400;
          response.end("credential_action_rejected\n");
        }
        return;
      }
      if (method === "POST" && requestPath === "/connection/action") {
        try {
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          const operation = form.get("operation");
          if (operation === "connect") {
            const candidate = Object.freeze({
              baseUrl: form.get("baseUrl") ?? "",
              token: form.get("token") ?? "",
            });
            if (candidate.baseUrl.length === 0 || candidate.token.length === 0)
              throw new Error("workbench_remote_connection_input_missing");
            const candidatePortfolio = await readRemotePortfolio(
              candidate.baseUrl,
              candidate.token,
            );
            remoteConnection = candidate;
            portfolio = candidatePortfolio;
            remoteAiProfileAdministrationSnapshot =
              await readRemoteAiProfileCatalog(
                candidate.baseUrl,
                candidate.token,
              ).catch(() => undefined);
            connectionState = "cros_available";
            connectionNotice = Object.freeze({
              status: "completed",
              message: "Remote CROSへ接続しました。",
            });
          } else if (operation === "refresh") {
            if (remoteConnection === undefined)
              throw new Error("workbench_remote_connection_unavailable");
            portfolio = await readRemotePortfolio(
              remoteConnection.baseUrl,
              remoteConnection.token,
            );
            remoteAiProfileAdministrationSnapshot =
              await readRemoteAiProfileCatalog(
                remoteConnection.baseUrl,
                remoteConnection.token,
              ).catch(() => undefined);
            connectionState = "cros_available";
            connectionNotice = Object.freeze({
              status: "completed",
              message: "現在のProjectionへ更新しました。",
            });
          } else if (operation === "disconnect") {
            remoteConnection = undefined;
            portfolio = undefined;
            remoteAiProfileAdministrationSnapshot = undefined;
            connectionState = "repository";
            connectionNotice = Object.freeze({
              status: "completed",
              message:
                "Remote CROS接続を切断し、CredentialをProcess memoryから破棄しました。",
            });
          } else {
            throw new Error("workbench_remote_connection_operation_invalid");
          }
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#connection");
          response.end();
        } catch {
          portfolio = undefined;
          remoteAiProfileAdministrationSnapshot = undefined;
          if (remoteConnection !== undefined)
            connectionState = "cros_unavailable";
          connectionNotice = Object.freeze({
            status: "rejected",
            message:
              "Remote CROSへ接続できませんでした。EndpointとCredentialを確認してください。",
          });
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#connection");
          response.end();
        }
        return;
      }
      if (method === "POST" && requestPath === "/ai-profiles/action") {
        try {
          const administrationSnapshot =
            remoteConnection === undefined
              ? aiProfileAdministration?.snapshot()
              : remoteAiProfileAdministrationSnapshot;
          if (administrationSnapshot === undefined)
            throw new Error("workbench_ai_profile_administration_unavailable");
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          const mutation = aiProfileMutation(form, administrationSnapshot);
          if (remoteConnection === undefined) {
            if (aiProfileAdministration === undefined)
              throw new Error(
                "workbench_ai_profile_administration_unavailable",
              );
            aiProfileAdministrationResult =
              aiProfileAdministration.execute(mutation);
            aiProfiles = createWorkbenchAiProfileSurface(
              aiProfileAdministrationResult.snapshot.catalog,
            );
          } else {
            aiProfileAdministrationResult =
              await executeRemoteAiProfileMutation(
                remoteConnection.baseUrl,
                remoteConnection.token,
                mutation,
              );
            remoteAiProfileAdministrationSnapshot =
              aiProfileAdministrationResult.snapshot;
          }
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#ai-profile-administration");
          response.end();
        } catch {
          setCommonHeaders(response);
          response.statusCode = 400;
          response.end("ai_profile_action_rejected\n");
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
            candidateReview = null;
            candidateAction = null;
            const mode = form.get("mode");
            const profileId = form.get("profileId") ?? "";
            const prompt = (form.get("prompt") ?? "").trim();
            const allowedPaths = (form.get("allowedPaths") ?? "")
              .split(/\r?\n/u)
              .map((value) => value.trim().replaceAll("\\", "/"))
              .filter((value) => value.length > 0);
            const externalSendConfirmed =
              form.get("externalSendConfirmed") === "yes";
            if (mode !== "read_only_advice" && mode !== "change_candidate")
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
              (mode === "change_candidate" && allowedPaths.length === 0)
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
              currentAiRequestId = null;
              aiRequestSnapshot = null;
              aiRequestNotice = `AI依頼を開始できませんでした: ${result.reason ?? "blocked"}`;
            }
          } else if (operation === "cancel") {
            const requestId = form.get("requestId") ?? "";
            if (currentAiRequestId === null || requestId !== currentAiRequestId)
              throw new Error("workbench_ai_request_identity_invalid");
            aiRequestSnapshot = await aiRequests.cancel(requestId);
            aiRequestNotice = "取消結果を取得しました。";
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
        try {
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          const operation = form.get("operation");
          const candidateId = form.get("candidateId") ?? "";
          if (
            aiRequestSnapshot?.candidate?.candidateId !== candidateId ||
            (operation !== "adopt" &&
              operation !== "discard" &&
              operation !== "defer")
          )
            throw new Error("workbench_candidate_identity_invalid");
          if (operation === "defer") {
            candidateAction = null;
            aiRequestNotice =
              "変更候補を保留しました。RepositoryへのEffectは発行していません。";
          } else {
            if (candidateActions === undefined)
              throw new Error("workbench_candidate_application_unavailable");
            const confirmed = form.get("confirmed") === "true";
            candidateAction =
              operation === "adopt"
                ? await candidateActions.adopt(candidateId, confirmed)
                : await candidateActions.discard(candidateId, confirmed);
            candidateReview = await candidateActions.review(candidateId);
            aiRequestNotice = `${operation === "adopt" ? "採用" : "破棄"}結果を取得しました。`;
          }
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#ai-request");
          response.end();
        } catch {
          setCommonHeaders(response);
          response.statusCode = 400;
          response.end("candidate_action_rejected\n");
        }
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
        const currentCandidateId = aiRequestSnapshot?.candidate?.candidateId;
        if (
          candidateActions !== undefined &&
          currentCandidateId !== undefined
        ) {
          try {
            candidateReview = await candidateActions.review(currentCandidateId);
          } catch {
            candidateReview = Object.freeze({
              status: "blocked",
              reason: "workbench_candidate_review_failed",
              candidate: null,
            });
          }
        } else {
          candidateReview = null;
        }
        if (activityReader !== undefined) {
          try {
            const runtimeCursor = requestUrl.searchParams.get("runtimeCursor");
            const page = {
              ...(runtimeCursor === null ? {} : { cursor: runtimeCursor }),
              limit: 20,
            };
            runtimeActivityObservation =
              remoteConnection === undefined
                ? await activityReader.observe(
                    projectSurface.context.projectId,
                    page,
                  )
                : await readRemoteRuntimeActivity(
                    remoteConnection.baseUrl,
                    remoteConnection.token,
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
        const parameter = (name: string): string | undefined => {
          const value = requestUrl.searchParams.get(name)?.trim();
          return value === undefined || value.length === 0 ? undefined : value;
        };
        const topicSortParameter = parameter("topicSort");
        const topicSort =
          topicSortParameter === "title_asc" ||
          topicSortParameter === "state_asc"
            ? topicSortParameter
            : "id_asc";
        const meetingSortParameter = parameter("meetingSort");
        const meetingSort =
          meetingSortParameter === "id_asc" ||
          meetingSortParameter === "title_asc"
            ? meetingSortParameter
            : "occurred_desc";
        const topicSearch = parameter("topicQuery");
        const topicState = parameter("topicState");
        const topicOwner = parameter("topicOwner");
        const topicRelation = parameter("topicRelation");
        const meetingSearch = parameter("meetingQuery");
        const meetingState = parameter("meetingState");
        const meetingRelation = parameter("meetingRelation");
        const meetingFrom = parameter("meetingFrom");
        const meetingTo = parameter("meetingTo");
        const topicQuery: TopicMeetingListQuery = Object.freeze({
          ...(topicSearch === undefined ? {} : { query: topicSearch }),
          ...(topicState === undefined ? {} : { states: [topicState] }),
          ...(topicOwner === undefined ? {} : { owner: topicOwner }),
          ...(topicRelation === undefined ? {} : { relation: topicRelation }),
          sort: topicSort,
        });
        const meetingQuery: TopicMeetingListQuery = Object.freeze({
          ...(meetingSearch === undefined ? {} : { query: meetingSearch }),
          ...(meetingState === undefined ? {} : { states: [meetingState] }),
          ...(meetingRelation === undefined
            ? {}
            : { relation: meetingRelation }),
          ...(meetingFrom === undefined ? {} : { occurredFrom: meetingFrom }),
          ...(meetingTo === undefined ? {} : { occurredTo: meetingTo }),
          ...(requestUrl.searchParams.get("meetingPending") === "true"
            ? { pendingOnly: true }
            : {}),
          sort: meetingSort,
        });
        const requestedRepositoryId = parameter("repositoryId");
        const selectedRepositoryId =
          remoteConnection !== undefined &&
          requestedRepositoryId !== undefined &&
          isVisiblePortfolioRepository(portfolio, requestedRepositoryId)
            ? requestedRepositoryId
            : undefined;
        let topicCollection = projectSurface.topics;
        let meetingCollection = projectSurface.meetings;
        let topicPage: TopicMeetingPage;
        let meetingPage: TopicMeetingPage;
        let topicMeetingReader: WorkbenchTopicMeetingDocumentReader =
          Object.freeze({
            getDocument: (kind, id) => topicMeeting[kind].getDocument(id),
            relations: (kind, id) => topicMeeting[kind].relations(id),
          });
        if (remoteConnection === undefined) {
          topicPage = topicMeeting.topic.list({
            ...(topicCursor === null ? {} : { cursor: topicCursor }),
            limit: 20,
            query: topicQuery,
          });
          meetingPage = topicMeeting.meeting.list({
            ...(meetingCursor === null ? {} : { cursor: meetingCursor }),
            limit: 20,
            query: meetingQuery,
          });
        } else if (selectedRepositoryId === undefined) {
          topicCollection = Object.freeze({
            state: "unknown",
            items: Object.freeze([]),
            reason: "observation_failed",
          });
          meetingCollection = Object.freeze({
            state: "unknown",
            items: Object.freeze([]),
            reason: "observation_failed",
          });
          topicPage = Object.freeze({
            status: "not_configured",
            records: Object.freeze([]),
            nextCursor: null,
          });
          meetingPage = topicPage;
          topicMeetingReader = Object.freeze({
            getDocument: () => null,
            relations: () => Object.freeze([]),
          });
        } else {
          try {
            const [topics, meetings] = await Promise.all([
              readRemoteTopicMeetingPage({
                baseUrl:
                  remoteConnection.mcpBaseUrl ?? remoteConnection.baseUrl,
                token: remoteConnection.token,
                repositoryId: selectedRepositoryId,
                kind: "topic",
                ...(topicCursor === null ? {} : { cursor: topicCursor }),
                limit: 20,
                query: topicQuery,
              }),
              readRemoteTopicMeetingPage({
                baseUrl:
                  remoteConnection.mcpBaseUrl ?? remoteConnection.baseUrl,
                token: remoteConnection.token,
                repositoryId: selectedRepositoryId,
                kind: "meeting",
                ...(meetingCursor === null ? {} : { cursor: meetingCursor }),
                limit: 20,
                query: meetingQuery,
              }),
            ]);
            topicPage = topics.page;
            meetingPage = meetings.page;
            topicCollection = Object.freeze({
              state: topics.page.status,
              items: topics.page.records.filter(
                (record) => "topicId" in record,
              ),
              reason: null,
            });
            meetingCollection = Object.freeze({
              state: meetings.page.status,
              items: meetings.page.records.filter(
                (record) => "meetingId" in record,
              ),
              reason: null,
            });
            topicMeetingReader = Object.freeze({
              getDocument: (kind, id) =>
                kind === "topic"
                  ? topics.reader.getDocument(kind, id)
                  : meetings.reader.getDocument(kind, id),
              relations: (kind, id) =>
                kind === "topic"
                  ? topics.reader.relations(kind, id)
                  : meetings.reader.relations(kind, id),
            });
          } catch {
            topicCollection = Object.freeze({
              state: "unknown",
              items: Object.freeze([]),
              reason: "observation_failed",
            });
            meetingCollection = Object.freeze({
              state: "unknown",
              items: Object.freeze([]),
              reason: "observation_failed",
            });
            topicPage = Object.freeze({
              status: "not_configured",
              records: Object.freeze([]),
              nextCursor: null,
            });
            meetingPage = topicPage;
            topicMeetingReader = Object.freeze({
              getDocument: () => null,
              relations: () => Object.freeze([]),
            });
          }
        }
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
          credentialResult,
          connectionState,
          remoteConnection,
          connectionNotice,
          topicCollection,
          meetingCollection,
          topicMeetingReader,
          topicPage,
          topicQuery,
          meetingPage,
          meetingQuery,
          topicMeetingResult,
          aiProfiles,
          remoteConnection === undefined
            ? aiProfileAdministration?.snapshot()
            : remoteAiProfileAdministrationSnapshot,
          remoteConnection === undefined ? "Repository" : "CROS",
          aiProfileAdministrationResult,
          aiRequests,
          aiRequestSnapshot,
          candidateActions,
          candidateReview,
          candidateAction,
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
        } else if (clientRoute === "/topic" || clientRoute === "/meeting") {
          const kind = clientRoute === "/topic" ? "topic" : "meeting";
          const id = requestUrl.searchParams.get("id") ?? "";
          const expectedPattern =
            kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u;
          const repositoryId = requestUrl.searchParams.get("repositoryId");
          let recordView: WorkbenchRecordDocumentView | null = null;
          if (expectedPattern.test(id)) {
            if (remoteConnection === undefined) {
              const document = topicMeeting[kind].getDocument(id);
              if (document !== null)
                recordView = Object.freeze({
                  kind,
                  id,
                  document,
                  relations: Object.freeze([
                    ...topicMeeting[kind].relations(id),
                  ]),
                });
            } else if (
              repositoryId !== null &&
              isVisiblePortfolioRepository(portfolio, repositoryId)
            ) {
              const remote = await readRemoteTopicMeetingDocument(
                remoteConnection.mcpBaseUrl ?? remoteConnection.baseUrl,
                remoteConnection.token,
                repositoryId,
                kind,
                id,
              ).catch(() => null);
              if (remote !== null)
                recordView = Object.freeze({
                  kind,
                  id,
                  document: remote.document,
                  relations: Object.freeze([...remote.relations]),
                });
            }
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
            record: recordView,
          });
        }
        body =
          requestPath === "/api/workbench-view"
            ? JSON.stringify(responseModel)
            : renderClientDocument();
        if (method === "GET" && requestPath === "/api/workbench-view") {
          credentialResult = null;
          connectionNotice = null;
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
        const changeId = requestUrl.searchParams.get("id") ?? "";
        const artifact = await readWorkbenchChangeArtifact(
          repositoryRoot,
          changeId,
        );
        if (artifact === null) {
          setCommonHeaders(response);
          response.statusCode = 404;
          response.end(method === "HEAD" ? undefined : "not_found\n");
          return;
        }
        body = artifact;
        contentType = "text/markdown; charset=utf-8";
      } else if (requestPath === "/owner-artifact") {
        const requestedPath = requestUrl.searchParams.get("path") ?? "";
        const artifact = await readWorkbenchOwnerArtifact(
          repositoryRoot,
          projectSurface.ownerArtifacts,
          requestedPath,
        );
        if (artifact === null) {
          setCommonHeaders(response);
          response.statusCode = 404;
          response.end(method === "HEAD" ? undefined : "not_found\n");
          return;
        }
        body = artifact;
        contentType = "text/markdown; charset=utf-8";
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
          mode: connectionState === "repository" ? "repository" : "remote-cros",
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
      if (!response.headersSent) setCommonHeaders(response);
      response.statusCode = 500;
      response.end("workbench_request_failed\n");
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
  let closed = false;
  return Object.freeze({
    contract: CONTRACT,
    baseUrl,
    healthUrl: `${baseUrl}${HEALTH_PATH}`,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) => {
        server.close((error) =>
          error === undefined ? resolve() : reject(error),
        );
        for (const connection of connections) connection.destroy();
      });
    },
  });
}
