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
import { renderToString } from "react-dom/server";

import {
  createTopicMeetingApplication,
  createTopicMeetingRepository,
  type ProjectOperationRecordKind,
  type MeetingOutcomeCommandResult,
  type TopicMeetingListQuery,
  type TopicMeetingPage,
  type TopicPromotionCommandResult,
  type TopicMeetingWriteResult,
} from "../../project-operation/src/index.ts";
import {
  executeRemoteAiProfileMutation,
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
} from "../../version-control/src/repository-location.ts";
import {
  readWorkbenchProjectSurface,
  type WorkbenchProjectSurface,
} from "./project-surface.ts";
import {
  type CredentialAdministration,
  type CredentialAdministrationResult,
  executeCredentialAdministrationAction,
  renderCredentialAdministration,
} from "./credential-administration.ts";
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
} from "../../ai-runtime/src/index.ts";
import {
  createDefaultWorkbenchAiProfileSurface,
  createWorkbenchAiProfileSurface,
  renderWorkbenchAiProfileAdministration,
  renderWorkbenchAiProfiles,
  type WorkbenchAiProfileSurface,
} from "./ai-profile-surface.ts";
import {
  renderWorkbenchAiRequest,
  type WorkbenchAiRequestApplication,
  type WorkbenchAiRequestSnapshot,
  type WorkbenchCandidateActionResult,
  type WorkbenchCandidateApplication,
  type WorkbenchCandidateReviewResult,
} from "./ai-request.ts";
import {
  createRepositoryWorkbenchRuntimeActivityApplication,
  renderWorkbenchRuntimeActivity,
  type WorkbenchRuntimeActivityApplication,
  type WorkbenchRuntimeActivityObservation,
} from "./runtime-activity.ts";
import {
  readWorkbenchChangeArtifact,
  readWorkbenchOwnerArtifact,
  renderWorkbenchOwnerArtifacts,
} from "./owner-artifact-surface.ts";
import { renderWorkbenchProjectPlan } from "./project-plan-surface.ts";
import { renderWorkbenchQuality } from "./quality-surface.ts";
import {
  executeRemoteTopicMeetingAction,
  readRemoteTopicMeetingDocument,
  readRemoteTopicMeetingPage,
  type RemoteTopicMeetingAction,
  type WorkbenchTopicMeetingDocumentReader,
} from "./remote-topic-meeting.ts";
import { WorkbenchShell } from "./presentation/workbench-shell.ts";

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
  aiRequestApplication?: WorkbenchAiRequestApplication;
  candidateApplication?: WorkbenchCandidateApplication;
  runtimeActivityApplication?: WorkbenchRuntimeActivityApplication;
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
 * Workbenchへ表示するTextをHTMLとして安全に符号化する。
 *
 * @responsibility Project Context由来TextをMarkupやScriptとして解釈させない。
 * @trace ARCH-000012
 * @input valueにProject Context由来の表示Textを受け取る。
 * @returns HTML特殊文字をEntityへ変換したTextを返す。
 * @precondition valueは実行可能Markupとして扱わない文字列である。
 * @postcondition ampersand、angle bracket、quoteを生で残さない。
 * @effect N/A: 文字列を変換するだけである。
 * @failure N/A: 全文字列を決定論的に変換する。
 * @invariant 表示文字の意味順序を変えない。
 * @boundary Project Context Read ModelとBrowser HTMLの境界。
 * @security Script、ElementまたはAttributeの注入を防ぐ。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Project Contextの一場面をWorkbench Panelへ投影する。
 *
 * @responsibility 要約と構造化表を同じ場面内に保ち、表の欠測を別の値で補完しない。
 * @trace ARCH-000012
 * @input sceneにProject Operation Readerが返した一場面を受け取る。
 * @returns Workbench Panelの安全なHTML断片を返す。
 * @precondition sceneは固定Project Context Readerで検証済みである。
 * @postcondition Headerと全行を入力順で表示する。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: 空行集合は空のtbodyとして表示する。
 * @invariant 独自のProject Context IDや判断を追加しない。
 * @boundary Project Operation SceneとWorkbench Browser表示の境界。
 * @security 全ての表示TextをescapeHtmlへ通す。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function renderScene(
  scene: WorkbenchProjectSurface["context"]["scenes"][number],
): string {
  const header = scene.table.columns
    .map((column) => `<th scope="col">${escapeHtml(column)}</th>`)
    .join("");
  const rows = scene.table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<article class="panel context-scene" id="${scene.key}"><header><div><p class="eyebrow">Project context</p><h2>${escapeHtml(scene.title)}</h2></div><span>${scene.table.rows.length} items</span></header>${scene.summary === null ? "" : `<p class="scene-summary">${escapeHtml(scene.summary)}</p>`}<div class="table-scroll"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

/**
 * Topic一覧をWorkbench Panelへ投影する。
 *
 * @responsibility Topicの構成状態と検証済み一覧を区別して表示する。
 * @trace ARCH-000012
 * @input collectionにProject Operation Readerを通過したTopic集合を受け取る。
 * @returns Topic Panelの安全なHTML断片を返す。
 * @precondition unknownではitemsが空である。
 * @postcondition 未構成、観測不能、構成済み0件および実Recordを異なる表示にする。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: 観測失敗はcollection状態として表示する。
 * @invariant Topicの状態や要約を推測しない。
 * @boundary Topic Read ModelとWorkbench Browser表示の境界。
 * @security 全ての表示TextをescapeHtmlへ通す。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function renderTopicMeetingResult(
  result: TopicMeetingActionResult | null,
  kind: ProjectOperationRecordKind,
): string {
  if (
    result === null ||
    (result.record !== null &&
      ("topicId" in result.record ? "topic" : "meeting") !== kind)
  )
    return "";
  const relations =
    result.relationPaths.length === 0
      ? ""
      : `<ul>${result.relationPaths.map((entry) => `<li><code>${escapeHtml(entry)}</code></li>`).join("")}</ul>`;
  return `<div class="operation-result" data-status="${result.status}"><strong>${escapeHtml(result.reason)}</strong>${relations}</div>`;
}

function renderCreateRecord(
  kind: ProjectOperationRecordKind,
  actionToken: string,
  repositoryId?: string,
): string {
  return `<details class="record-editor"><summary>${kind === "topic" ? "Topic" : "Meeting"}を登録</summary><form method="post" action="/topic-meeting/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}">${repositoryId === undefined ? "" : `<input type="hidden" name="repositoryId" value="${escapeHtml(repositoryId)}">`}<input type="hidden" name="kind" value="${kind}"><input type="hidden" name="operation" value="create"><label>Canonical Markdown<textarea required name="markdown" rows="14"></textarea></label><button type="submit">登録</button></form></details>`;
}

function renderRecordActions(
  kind: ProjectOperationRecordKind,
  id: string,
  revision: number,
  markdown: string,
  actionToken: string,
  repositoryId?: string,
): string {
  const target =
    repositoryId === undefined
      ? ""
      : `<input type="hidden" name="repositoryId" value="${escapeHtml(repositoryId)}">`;
  const outcome =
    kind === "meeting"
      ? `<form method="post" action="/topic-meeting/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}">${target}<input type="hidden" name="kind" value="meeting"><input type="hidden" name="operation" value="treat-outcome"><input type="hidden" name="id" value="${escapeHtml(id)}"><input type="hidden" name="expectedRevision" value="${revision}"><h4>Outcomeを処置</h4><label>Outcome ID<input required name="outcomeId" pattern="OUT-[0-9]{3,}"></label><label>処置<select required name="disposition"><option value="completed">完了</option><option value="transferred">移管</option><option value="promoted">昇格</option><option value="rejected">理由付き不採用</option></select></label><label>Owner<input required name="owner"></label><label>期限／再評価契機<input required name="reviewTrigger"></label><label>追跡先の種別<select required name="targetKind"><option value="none">なし</option><option value="topic">Topic</option><option value="change">CHG</option><option value="owner">責任主体／所有正本</option></select></label><label>追跡先<input required name="targetReference" value="N/A: 完了"></label><label>処置<input required name="treatment"></label><label>完了条件<input required name="completionCondition"></label><label>結果<input required name="result"></label><label class="confirm"><input type="checkbox" name="closeMeeting" value="true">この処置後にpending Outcomeが0件ならMeetingを閉じる</label><button type="submit">Outcomeを処置</button></form>`
      : "";
  const promotion =
    kind === "topic"
      ? `<form method="post" action="/topic-meeting/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}">${target}<input type="hidden" name="kind" value="topic"><input type="hidden" name="operation" value="promote-topic"><input type="hidden" name="id" value="${escapeHtml(id)}"><input type="hidden" name="expectedRevision" value="${revision}"><h4>採用済み変更へ接続</h4><label>既存CHG ID<input required name="changeId" pattern="CHG-[0-9]{6}"></label><label>採用理由<input required name="reason"></label><label>Topicに残る責務<input required name="remainingResponsibility"></label><button type="submit">実在CHGを確認して昇格</button></form>`
      : "";
  return `<details class="record-editor"><summary>処置・編集・削除</summary>${outcome}${promotion}<form method="post" action="/topic-meeting/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}">${target}<input type="hidden" name="kind" value="${kind}"><input type="hidden" name="operation" value="update"><input type="hidden" name="id" value="${escapeHtml(id)}"><input type="hidden" name="expectedRevision" value="${revision}"><label>Canonical Markdown<textarea required name="markdown" rows="14">${escapeHtml(markdown)}</textarea></label><button type="submit">更新</button></form><form method="post" action="/topic-meeting/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}">${target}<input type="hidden" name="kind" value="${kind}"><input type="hidden" name="operation" value="delete"><input type="hidden" name="id" value="${escapeHtml(id)}"><input type="hidden" name="expectedRevision" value="${revision}"><label class="confirm"><input required type="checkbox" name="confirmed" value="true">Relation影響を確認し、誤登録Recordだけを削除します</label><button type="submit">削除影響を確認して実行</button></form></details>`;
}

function renderTopics(
  collection: WorkbenchProjectSurface["topics"],
  page: TopicMeetingPage,
  application: WorkbenchTopicMeetingDocumentReader,
  actionToken: string,
  result: TopicMeetingActionResult | null,
  query: TopicMeetingListQuery,
  repositoryId?: string,
): string {
  const nextParameters = new URLSearchParams();
  if (query.query !== undefined) nextParameters.set("topicQuery", query.query);
  if (query.states?.[0] !== undefined)
    nextParameters.set("topicState", query.states[0]);
  if (query.owner !== undefined) nextParameters.set("topicOwner", query.owner);
  if (query.relation !== undefined)
    nextParameters.set("topicRelation", query.relation);
  if (query.sort !== undefined) nextParameters.set("topicSort", query.sort);
  if (page.nextCursor !== null)
    nextParameters.set("topicCursor", page.nextCursor);
  if (repositoryId !== undefined)
    nextParameters.set("repositoryId", repositoryId);
  const controls = `<form class="collection-controls" method="get" action="/">${repositoryId === undefined ? "" : `<input type="hidden" name="repositoryId" value="${escapeHtml(repositoryId)}">`}<label>検索<input name="topicQuery" value="${escapeHtml(query.query ?? "")}" placeholder="ID・名称・要約"></label><label>状態<select name="topicState"><option value="">すべて</option>${["open", "waiting", "promoted", "closed"].map((state) => `<option value="${state}"${query.states?.includes(state) ? " selected" : ""}>${state}</option>`).join("")}</select></label><label>Owner<input name="topicOwner" value="${escapeHtml(query.owner ?? "")}"></label><label>Relation<input name="topicRelation" value="${escapeHtml(query.relation ?? "")}" placeholder="CHG-000001"></label><label>並び順<select name="topicSort"><option value="id_asc"${query.sort === "id_asc" ? " selected" : ""}>ID順</option><option value="title_asc"${query.sort === "title_asc" ? " selected" : ""}>名称順</option><option value="state_asc"${query.sort === "state_asc" ? " selected" : ""}>状態順</option></select></label><button type="submit">絞り込む</button></form>`;
  const content =
    collection.state === "not_configured"
      ? '<p class="empty-state">22_Topicsは未構成です。0件として扱いません。</p>'
      : collection.state === "unknown"
        ? '<p class="empty-state">Topic正本を完全に観測できません。部分一覧は表示しません。</p>'
        : page.records.length === 0
          ? '<p class="empty-state">構成済みです。現在のTopicは0件です。</p>'
          : `<ul>${page.records
              .map((record) => {
                if (!("topicId" in record)) return "";
                const document = application.getDocument(
                  "topic",
                  record.topicId,
                );
                const target =
                  repositoryId === undefined
                    ? ""
                    : `&repositoryId=${encodeURIComponent(repositoryId)}`;
                return `<li><strong><a href="/topic?id=${encodeURIComponent(record.topicId)}${target}">${escapeHtml(record.topicId)} — ${escapeHtml(record.title)}</a></strong><p>${escapeHtml(record.summary)}</p><small>${escapeHtml(record.state)} / ${escapeHtml(record.owner)}</small>${document === null ? "" : renderRecordActions("topic", record.topicId, record.revision, document.markdown, actionToken, repositoryId)}</li>`;
              })
              .join(
                "",
              )}</ul>${page.nextCursor === null ? "" : `<a class="page-link" href="/?${nextParameters.toString()}#topics">次のTopic</a>`}`;
  return `<article class="panel wide" id="topics"><header><div><p class="eyebrow">Topics</p><h2>継続して扱う論点</h2></div><span>${collection.state === "available" ? `${page.records.length} items` : collection.state === "not_configured" ? "Not configured" : "Unknown"}</span></header>${controls}${renderTopicMeetingResult(result, "topic")}${content}${renderCreateRecord("topic", actionToken, repositoryId)}</article>`;
}

/**
 * Meeting一覧をWorkbench Panelへ投影する。
 *
 * @responsibility Meetingの構成状態と検証済み一覧を区別して表示する。
 * @trace ARCH-000012
 * @input collectionにProject Operation Readerを通過したMeeting集合を受け取る。
 * @returns Meeting Panelの安全なHTML断片を返す。
 * @precondition unknownではitemsが空である。
 * @postcondition 未構成、観測不能、構成済み0件および実Recordを異なる表示にする。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: 観測失敗はcollection状態として表示する。
 * @invariant MeetingのOutcomeや現在状態を後から推測しない。
 * @boundary Meeting Read ModelとWorkbench Browser表示の境界。
 * @security 全ての表示TextをescapeHtmlへ通す。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function renderMeetings(
  collection: WorkbenchProjectSurface["meetings"],
  page: TopicMeetingPage,
  application: WorkbenchTopicMeetingDocumentReader,
  actionToken: string,
  result: TopicMeetingActionResult | null,
  query: TopicMeetingListQuery,
  repositoryId?: string,
): string {
  const nextParameters = new URLSearchParams();
  if (query.query !== undefined)
    nextParameters.set("meetingQuery", query.query);
  if (query.states?.[0] !== undefined)
    nextParameters.set("meetingState", query.states[0]);
  if (query.relation !== undefined)
    nextParameters.set("meetingRelation", query.relation);
  if (query.occurredFrom !== undefined)
    nextParameters.set("meetingFrom", query.occurredFrom);
  if (query.occurredTo !== undefined)
    nextParameters.set("meetingTo", query.occurredTo);
  if (query.pendingOnly === true) nextParameters.set("meetingPending", "true");
  if (query.sort !== undefined) nextParameters.set("meetingSort", query.sort);
  if (page.nextCursor !== null)
    nextParameters.set("meetingCursor", page.nextCursor);
  if (repositoryId !== undefined)
    nextParameters.set("repositoryId", repositoryId);
  const controls = `<form class="collection-controls" method="get" action="/">${repositoryId === undefined ? "" : `<input type="hidden" name="repositoryId" value="${escapeHtml(repositoryId)}">`}<label>検索<input name="meetingQuery" value="${escapeHtml(query.query ?? "")}" placeholder="ID・名称・要約"></label><label>状態<select name="meetingState"><option value="">すべて</option>${["recorded", "closed", "corrected"].map((state) => `<option value="${state}"${query.states?.includes(state) ? " selected" : ""}>${state}</option>`).join("")}</select></label><label>開始日<input type="date" name="meetingFrom" value="${escapeHtml(query.occurredFrom ?? "")}"></label><label>終了日<input type="date" name="meetingTo" value="${escapeHtml(query.occurredTo ?? "")}"></label><label>Relation<input name="meetingRelation" value="${escapeHtml(query.relation ?? "")}" placeholder="TOPIC-000001"></label><label class="confirm"><input type="checkbox" name="meetingPending" value="true"${query.pendingOnly === true ? " checked" : ""}>未処置Outcomeあり</label><label>並び順<select name="meetingSort"><option value="occurred_desc"${query.sort === "occurred_desc" ? " selected" : ""}>新しい順</option><option value="id_asc"${query.sort === "id_asc" ? " selected" : ""}>ID順</option><option value="title_asc"${query.sort === "title_asc" ? " selected" : ""}>名称順</option></select></label><button type="submit">絞り込む</button></form>`;
  const content =
    collection.state === "not_configured"
      ? '<p class="empty-state">23_Meetingsは未構成です。0件として扱いません。</p>'
      : collection.state === "unknown"
        ? '<p class="empty-state">Meeting正本を完全に観測できません。部分一覧は表示しません。</p>'
        : page.records.length === 0
          ? '<p class="empty-state">構成済みです。現在のMeetingは0件です。</p>'
          : `<ul>${page.records
              .map((record) => {
                if (!("meetingId" in record)) return "";
                const document = application.getDocument(
                  "meeting",
                  record.meetingId,
                );
                const target =
                  repositoryId === undefined
                    ? ""
                    : `&repositoryId=${encodeURIComponent(repositoryId)}`;
                return `<li><strong><a href="/meeting?id=${encodeURIComponent(record.meetingId)}${target}">${escapeHtml(record.meetingId)} — ${escapeHtml(record.title)}</a></strong><p>${escapeHtml(record.summary)}</p><small>${escapeHtml(record.state)} / ${escapeHtml(record.occurredAt)} / pending ${record.pendingOutcomeCount}</small>${document === null ? "" : renderRecordActions("meeting", record.meetingId, record.revision, document.markdown, actionToken, repositoryId)}</li>`;
              })
              .join(
                "",
              )}</ul>${page.nextCursor === null ? "" : `<a class="page-link" href="/?${nextParameters.toString()}#meetings">次のMeeting</a>`}`;
  return `<article class="panel wide" id="meetings"><header><div><p class="eyebrow">Meetings</p><h2>会議と処置状態</h2></div><span>${collection.state === "available" ? `${page.records.length} items` : collection.state === "not_configured" ? "Not configured" : "Unknown"}</span></header>${controls}${renderTopicMeetingResult(result, "meeting")}${content}${renderCreateRecord("meeting", actionToken, repositoryId)}</article>`;
}

/**
 * TopicまたはMeetingのCanonical Detailを独立画面へ投影する。
 *
 * @responsibility 一覧で省略したMetadata、現在要約、Canonical Markdownおよび許可済み処置を一つの詳細境界へ閉じる。
 * @trace ARCH-000012
 * @input kindに固定Record種別、applicationに検証済みProject Operation入口、idに安定ID、actionTokenにlocalhost操作Tokenを受け取る。
 * @returns Recordが存在する場合は安全な完全HTML、存在しない場合はnullを返す。
 * @precondition idはProject Operation RepositoryのKind固有ID検証を通過する。
 * @postcondition DetailはCanonical Recordと同じRevisionのMarkdownだけを表示する。
 * @effect N/A: 検証済みRead ModelをHTMLへ変換するだけである。
 * @failure Recordが存在しない場合はnullを返し、別Projectや別Kindを推測しない。
 * @invariant Detail画面を新しい正本にせず、編集操作は既存Project Operation Applicationへ戻す。
 * @boundary Topic／Meeting Canonical MarkdownとWorkbench Browser Detailの境界。
 * @security 表示値とMarkdownをescapeし、任意Pathを解決しない。
 * @concurrency Detail取得時点のRevisionを更新・削除の期待Revisionとして固定する。
 */
function renderTopicMeetingDetail(
  kind: ProjectOperationRecordKind,
  application: WorkbenchTopicMeetingDocumentReader,
  id: string,
  actionToken: string,
  repositoryId?: string,
): string | null {
  const document = application.getDocument(kind, id);
  if (document === null) return null;
  const { record, markdown } = document;
  const identity = "topicId" in record ? record.topicId : record.meetingId;
  const occurredAt = "occurredAt" in record ? record.occurredAt : null;
  const pendingOutcomeCount =
    "pendingOutcomeCount" in record ? record.pendingOutcomeCount : null;
  const relations = application.relations(kind, id);
  const relationList =
    relations.length === 0
      ? '<p class="empty-state">明示Relationはありません。</p>'
      : `<ul class="relation-list">${relations
          .map((relation) => {
            if (relation.state !== "available")
              return `<li><code>${escapeHtml(relation.id)}</code><span>${relation.state === "conflicting" ? "参照先が競合" : relation.state === "unavailable" ? "参照可否を確認できません" : "参照先なし"}</span></li>`;
            const owner = relation.ownerRepositoryId ?? repositoryId;
            const target =
              owner === undefined
                ? ""
                : `&repositoryId=${encodeURIComponent(owner)}`;
            const href =
              relation.kind === "topic"
                ? `/topic?id=${encodeURIComponent(relation.id)}${target}`
                : relation.kind === "meeting"
                  ? `/meeting?id=${encodeURIComponent(relation.id)}${target}`
                  : `/change?id=${encodeURIComponent(relation.id)}`;
            return `<li><a href="${href}"><code>${escapeHtml(relation.id)}</code></a><span>${escapeHtml(relation.kind)}</span></li>`;
          })
          .join("")}</ul>`;
  const back = `${repositoryId === undefined ? "/" : `/?repositoryId=${encodeURIComponent(repositoryId)}`}${kind === "topic" ? "#topics" : "#meetings"}`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(identity)} — CROS Workbench</title><link rel="stylesheet" href="/workbench.css"></head><body><main class="record-detail" id="${kind}-detail"><a class="page-link" href="${back}">← ${kind === "topic" ? "Topics" : "Meetings"}へ戻る</a><article class="panel"><header><div><p class="eyebrow">${kind === "topic" ? "Topic detail" : "Meeting detail"}</p><h1>${escapeHtml(record.title)}</h1></div><span>${escapeHtml(record.state)}</span></header><dl class="detail-metadata"><div><dt>ID</dt><dd><code>${escapeHtml(identity)}</code></dd></div><div><dt>Project</dt><dd>${escapeHtml(record.projectId)}</dd></div>${repositoryId === undefined ? "" : `<div><dt>Repository</dt><dd>${escapeHtml(repositoryId)}</dd></div>`}<div><dt>Owner</dt><dd>${escapeHtml(record.owner)}</dd></div><div><dt>Revision</dt><dd>${record.revision}</dd></div>${occurredAt === null ? "" : `<div><dt>開催日時</dt><dd>${escapeHtml(occurredAt)}</dd></div>`}${pendingOutcomeCount === null ? "" : `<div><dt>未処置Outcome</dt><dd>${pendingOutcomeCount}</dd></div>`}</dl><section><h2>現在要約</h2><p>${escapeHtml(record.summary)}</p></section><section><h2>Relation</h2>${relationList}</section><section><h2>Canonical Markdown</h2><pre class="canonical-markdown">${escapeHtml(markdown)}</pre></section>${renderRecordActions(kind, identity, record.revision, markdown, actionToken, repositoryId)}</article></main></body></html>`;
}

/**
 * CROS PortfolioまたはRepository単体のProject入口を描画する。
 *
 * @responsibility Repository単体利用と許可済みFederation結果を同じ入口で区別して表示する。
 * @trace ARCH-000005
 * @input portfolioにCROSの許可済みProjection、contextに現在RepositoryのProject Contextを受け取る。
 * @returns Project選択Panelの安全なHTML断片を返す。
 * @precondition portfolioがある場合はCROS Federation公開契約を通過している。
 * @postcondition Repository単体では現在Projectだけ、FederationではProjection内Projectだけを表示する。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: CROS未接続はRepository modeとして明示する。
 * @invariant 非開示Project、期待Repositoryまたは単一Health Scoreを生成しない。
 * @boundary CROS Portfolio Projection／Repository Project ContextとWorkbench Browser表示の境界。
 * @security 全ての表示TextをescapeHtmlへ通し、Projection外Identityを補完しない。
 * @concurrency N/A: 起動時に固定したSnapshotを同期描画する。
 */
type PortfolioCursor = readonly [string, string, string];

/**
 * Portfolio一覧の継続位置を現在の検索条件へ結合する。
 *
 * @responsibility 検索語、状態Filterおよび最後のProject IDを不透明Cursorへ結合する。
 * @trace ARCH-000012
 * @input query、stateおよびlastProjectIdに検証済み一覧条件と最後のProject IDを受け取る。
 * @returns URL安全なPortfolio Cursorを返す。
 * @precondition lastProjectIdは現在Pageの最後に表示した許可済みProjectである。
 * @postcondition 別の検索条件では再利用できないCursorを返す。
 * @effect N/A: 固定JSONを符号化するだけである。
 * @failure N/A: 検証済み値だけを入力とする。
 * @invariant Repository Path、Credentialまたは非開示ProjectをCursorへ含めない。
 * @boundary 許可済みPortfolio ProjectionとBrowser Queryの境界。
 * @security 公開済みProject IDと現在の検索条件だけを含む。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function encodePortfolioCursor(
  query: string,
  state: string,
  lastProjectId: string,
): string {
  return Buffer.from(
    JSON.stringify([query, state, lastProjectId]),
    "utf8",
  ).toString("base64url");
}

/**
 * Portfolio Cursorを現在の検索条件に対して検証する。
 *
 * @responsibility 未信頼Cursorの構造、長さおよび検索条件一致をEffect前に検証する。
 * @trace ARCH-000012
 * @input cursorにBrowser由来文字列、queryとstateに現在の正規化済み検索条件を受け取る。
 * @returns 検証済みCursor、Cursorなしを表すnull、または不正を表すundefinedを返す。
 * @precondition cursorは未信頼Query Parameterである。
 * @postcondition 現在の検索条件へだけ利用できる三要素Cursorを返す。
 * @effect N/A: 文字列を解析するだけである。
 * @failure 不正または別条件のCursorをundefinedとして拒否する。
 * @invariant Cursor変更から条件またはProjectを推測・補完しない。
 * @boundary Browser Queryと許可済みPortfolio Projectionの境界。
 * @security CursorをPathまたは任意Objectとして解釈しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function decodePortfolioCursor(
  cursor: string,
  query: string,
  state: string,
): PortfolioCursor | null | undefined {
  if (cursor.length === 0) return null;
  if (cursor.length > 1_024) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((entry) => typeof entry === "string")
  )
    return undefined;
  const decoded = value as string[];
  if (
    decoded[0] !== query ||
    decoded[1] !== state ||
    decoded[2] === undefined ||
    decoded[2].length === 0
  )
    return undefined;
  return Object.freeze(decoded) as PortfolioCursor;
}

function renderPortfolio(
  portfolio: PortfolioProjection | undefined,
  context: WorkbenchProjectSurface["context"],
  connectionState: WorkbenchConnectionState,
  query: string,
  state: string,
  cursor: string,
): string {
  if (connectionState === "cros_unavailable")
    return '<article class="panel wide" id="portfolio"><header><div><p class="eyebrow">Project portfolio</p><h2>Projectを選ぶ</h2></div><span>Remote unavailable</span></header><p class="empty-state">Remote CROSの現在Projectionを取得できません。直前のPortfolioをCurrentとして表示せず、接続を確認して明示Refreshしてください。</p></article>';
  if (portfolio === undefined)
    return `<article class="panel wide" id="portfolio"><header><div><p class="eyebrow">Project portfolio</p><h2>Projectを選ぶ</h2></div><span>Repository mode</span></header><ul><li><strong>${escapeHtml(context.projectId)}</strong><p>${escapeHtml(context.repositoryId)} / ${escapeHtml(context.repositoryRole)}</p><small>現在のRepository Contextだけを表示</small></li></ul></article>`;
  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
  const normalizedState = ["complete", "partial", "conflicting"].includes(state)
    ? state
    : "";
  const filtered = portfolio.projects
    .filter(
      (project) =>
        (normalizedQuery.length === 0 ||
          project.projectId
            .toLocaleLowerCase("ja-JP")
            .includes(normalizedQuery)) &&
        (normalizedState.length === 0 || project.state === normalizedState),
    )
    .toSorted((left, right) => left.projectId.localeCompare(right.projectId));
  const decodedCursor = decodePortfolioCursor(
    cursor,
    normalizedQuery,
    normalizedState,
  );
  if (decodedCursor === undefined)
    return `<article class="panel wide" id="portfolio"><header><div><p class="eyebrow">Project portfolio</p><h2>Projectを選ぶ</h2></div><span>CROS federation</span></header><p class="empty-state">検索条件と継続位置が一致しません。Project一覧から検索し直してください。</p><p><a class="page-link" href="/#portfolio">Project一覧へ戻る</a></p></article>`;
  const lastProjectId = decodedCursor?.[2];
  const remaining =
    lastProjectId === undefined
      ? filtered
      : filtered.filter((project) => project.projectId > lastProjectId);
  const projects = remaining.slice(0, 20);
  const next =
    remaining.length > projects.length ? projects.at(-1)?.projectId : undefined;
  const nextParameters = new URLSearchParams();
  if (query.length > 0) nextParameters.set("portfolioQuery", query);
  if (normalizedState.length > 0)
    nextParameters.set("portfolioState", normalizedState);
  if (next !== undefined)
    nextParameters.set(
      "portfolioCursor",
      encodePortfolioCursor(normalizedQuery, normalizedState, next),
    );
  const controls = `<form class="collection-controls" method="get" action="/"><label>Project検索<input name="portfolioQuery" value="${escapeHtml(query)}"></label><label>状態<select name="portfolioState"><option value="">すべて</option>${["complete", "partial", "conflicting"].map((candidate) => `<option value="${candidate}"${normalizedState === candidate ? " selected" : ""}>${candidate}</option>`).join("")}</select></label><button type="submit">絞り込む</button></form>`;
  const content =
    projects.length === 0
      ? '<p class="empty-state">現在の接続資格から表示できるProjectはありません。非開示Projectの存在や件数は表示しません。</p>'
      : `<ul>${projects
          .map(
            (project) =>
              `<li><strong><a href="/project?id=${encodeURIComponent(project.projectId)}">${escapeHtml(project.projectId)}</a></strong><p>${project.sources.map((source) => `${escapeHtml(source.repositoryId)}: ${escapeHtml(source.state)}`).join(" / ")}</p><small>${escapeHtml(project.state)} / ${project.sources.length} visible sources</small></li>`,
          )
          .join(
            "",
          )}</ul>${next === undefined ? "" : `<a class="page-link" href="/?${nextParameters.toString()}#portfolio">次のProject</a>`}`;
  return `<article class="panel wide" id="portfolio"><header><div><p class="eyebrow">Project portfolio</p><h2>Projectを選ぶ</h2></div><span>CROS federation</span></header>${controls}${content}</article>`;
}

/** 許可済みPortfolioの一ProjectをSource別の五場面へ投影する。 */
function renderFederatedProjectDetail(
  portfolio: PortfolioProjection,
  projectId: string,
): string | null {
  const project = portfolio.projects.find(
    (candidate) => candidate.projectId === projectId,
  );
  if (project === undefined) return null;
  const sources = project.sources
    .map((source) => {
      const context = source.context;
      const detail =
        context === null
          ? '<p class="empty-state">このSourceのProject Contextは利用できません。</p>'
          : context.scenes.map(renderScene).join("");
      return `<section class="portfolio-source"><header><div><p class="eyebrow">Repository source</p><h2>${escapeHtml(source.repositoryId)}</h2></div><span>${escapeHtml(source.state)}</span></header><p>${source.repositoryRole === null ? "Role unavailable" : escapeHtml(source.repositoryRole)} / revision ${escapeHtml(source.revision)}</p><p><a class="page-link" href="/?repositoryId=${encodeURIComponent(source.repositoryId)}#topics">このRepositoryのTopic／Meetingを開く</a></p>${detail}</section>`;
    })
    .join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(project.projectId)} — CROS Workbench</title><link rel="stylesheet" href="/workbench.css"></head><body><main class="record-detail"><a class="page-link" href="/#portfolio">← Project Portfolioへ戻る</a><article class="panel"><header><div><p class="eyebrow">Federated project</p><h1>${escapeHtml(project.projectId)}</h1></div><span>${escapeHtml(project.state)}</span></header><p>許可済みRepository Sourceごとの五場面を表示します。Source間の欠測・競合を一つの完全状態へ統合しません。</p></article>${sources}</main></body></html>`;
}

/**
 * Remote CROS接続の入力と現在状態をWorkbenchへ描画する。
 *
 * @responsibility Repository単体利用を維持しながら、明示操作でだけRemote CROSへ接続・更新・切断できる入口を提供する。
 * @trace ARCH-000012
 * @input connectionStateに現在状態、remoteConnectionにProcess内接続、noticeに直前操作結果、actionTokenにlocalhost操作Tokenを受け取る。
 * @returns Credentialを再表示しないRemote Connection PanelのHTML断片を返す。
 * @precondition remoteConnectionのtokenはWorkbench Process外へ投影してはならない。
 * @postcondition Token fieldは常に空で描画し、接続済みの場合だけEndpointと更新・切断操作を表示する。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: 未接続および失敗状態も明示表示へ変換する。
 * @invariant Credential、Bearer Headerおよび以前入力したTokenをHTMLへ含めない。
 * @boundary Browser FormとWorkbench Remote Connection状態の境界。
 * @security Tokenはpassword fieldからPOSTされる一回入力であり、Responseへ反射しない。
 * @concurrency N/A: 現在のProcess内Snapshotを同期描画する。
 */
function renderRemoteConnection(
  connectionState: WorkbenchConnectionState,
  remoteConnection: WorkbenchRemoteConnection | undefined,
  notice: WorkbenchConnectionNotice | null,
  actionToken: string,
): string {
  const stateLabel =
    connectionState === "repository"
      ? "Repository mode"
      : connectionState === "cros_available"
        ? "Connected"
        : "Unavailable";
  const noticeHtml =
    notice === null
      ? ""
      : `<p class="operation-result" data-status="${notice.status}">${escapeHtml(notice.message)}</p>`;
  const current =
    remoteConnection === undefined
      ? '<p class="empty-state">CredentialなしでRepository単体利用を継続できます。Remote CROSを使う場合だけ、管理者から受け取ったEndpointとCredentialを入力してください。</p>'
      : `<dl><div><dt>Endpoint</dt><dd><code>${escapeHtml(remoteConnection.baseUrl)}</code></dd></div><div><dt>Credential</dt><dd>Process memory only</dd></div></dl><div class="connection-actions"><form method="post" action="/connection/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><button name="operation" value="refresh" type="submit">Refresh projection</button></form><form method="post" action="/connection/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><button name="operation" value="disconnect" type="submit">Disconnect</button></form></div>`;
  return `<article class="panel wide" id="connection"><header><div><p class="eyebrow">Remote CROS</p><h2>接続</h2></div><span>${stateLabel}</span></header>${noticeHtml}${current}<form class="remote-connection-form" method="post" action="/connection/action" autocomplete="off"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="connect"><label>Endpoint<input required type="url" name="baseUrl" placeholder="https://cros.example" autocomplete="off"></label><label>Credential<input required type="password" name="token" autocomplete="off" spellcheck="false"></label><p>Credentialは接続中のWorkbench Process内だけで保持し、Repository、HTML、URL、logへ保存しません。</p><button type="submit">Connect</button></form></article>`;
}

/**
 * Local Change SetをWorkbench Repository Panelへ投影する。
 *
 * @responsibility Staged、WorkingおよびUntrackedの区別を保持し、観測不能をCleanと表示しない。
 * @trace ARCH-000002
 * @input repositoryにVersion Control公開契約から得た作業ツリーSnapshotを受け取る。
 * @returns Repository Panelの安全なHTML断片を返す。
 * @precondition availableではchangeSetが存在する。
 * @postcondition 各変更区分を別々に表示し、PathをHTMLとして解釈しない。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: 観測失敗はunknown表示へ閉じる。
 * @invariant 変更0件と観測不能を区別する。
 * @boundary Version Control Read ModelとWorkbench Browser表示の境界。
 * @security 全PathをescapeHtmlへ通し、Repository Rootを表示しない。
 * @concurrency N/A: 起動時Snapshotを同期描画する。
 */
function renderRepository(
  repository: WorkbenchProjectSurface["repository"],
  actionToken: string,
  lastResult: ChangePublicationResult | null,
  worktreeView: Readonly<{
    state: "available" | "unknown";
    tree: RepositoryWorktreeTreePage | null;
    diff: RepositoryWorktreeFileDiff | null;
  }>,
): string {
  const resultNotice =
    lastResult === null
      ? ""
      : `<p class="operation-result" data-status="${escapeHtml(lastResult.status)}"><strong>${escapeHtml(lastResult.status)}</strong> ${escapeHtml(lastResult.reason)}</p>`;
  if (repository.state === "unknown" || repository.changeSet === null)
    return `<article class="panel wide" id="repository"><header><div><p class="eyebrow">Repository</p><h2>作業ツリー</h2></div><span>Unknown</span></header>${resultNotice}<p class="empty-state">Gitの現在状態を完全に観測できません。Cleanとして扱いません。直前の操作結果と現在状態を同一視せず、再観測してから次の操作を判断してください。</p></article>`;
  const groups = [
    ["Staged", "unprepare", repository.changeSet.preparedChanges],
    ["Working", "prepare", repository.changeSet.workingChanges],
    ["Untracked", "prepare", repository.changeSet.unregisteredPaths],
  ] as const;
  const changeCount = groups.reduce(
    (total, [, , paths]) => total + paths.length,
    0,
  );
  const target = repository.publicationTarget;
  const publicationForm =
    target?.status === "available" &&
    target.destination !== null &&
    target.branch !== null &&
    target.revisionIdentity !== null
      ? `<form method="post" action="/repository/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="publish_revision"><input type="hidden" name="destination" value="${escapeHtml(target.destination)}"><input type="hidden" name="branch" value="${escapeHtml(target.branch)}"><input type="hidden" name="revisionIdentity" value="${escapeHtml(target.revisionIdentity)}"><dl class="publication-target"><div><dt>Remote</dt><dd>${escapeHtml(target.destination)}</dd></div><div><dt>Branch</dt><dd>${escapeHtml(target.branch)}</dd></div><div><dt>Commit</dt><dd><code>${escapeHtml(target.revisionIdentity)}</code></dd></div></dl><label class="confirm"><input required type="checkbox" name="humanConfirmed" value="true">表示したRemote・Branch・Commitを確認しました</label><button type="submit">Normal push</button></form>`
      : `<section class="publication-unavailable"><h3>Normal push</h3><p class="empty-state">公開先を確認できません（${escapeHtml(target?.reason ?? "publication_target_observation_failed")}）。RemoteやBranchを推測して公開しません。</p></section>`;
  const treeView =
    worktreeView.state === "unknown" || worktreeView.tree === null
      ? '<section class="repository-browser"><h3>Repository Tree／Diff</h3><p class="empty-state">TreeまたはDiffを完全に観測できません。空Repositoryとして扱いません。</p></section>'
      : (() => {
          const tree = worktreeView.tree;
          const parent = tree.directory.includes("/")
            ? tree.directory.slice(0, tree.directory.lastIndexOf("/"))
            : "";
          const navigation =
            tree.directory.length === 0
              ? "<strong>Repository root</strong>"
              : `<a href="/?treeDirectory=${encodeURIComponent(parent)}#repository">← ${parent.length === 0 ? "Repository root" : escapeHtml(parent)}</a><strong>${escapeHtml(tree.directory)}</strong>`;
          const entries =
            tree.entries.length === 0
              ? '<p class="empty-state">このDirectoryの表示対象は0件です。</p>'
              : `<ul class="repository-tree">${tree.entries
                  .map((entry) => {
                    const flags = [
                      entry.prepared ? "staged" : "",
                      entry.working ? "working" : "",
                      entry.unregistered ? "untracked" : "",
                    ].filter(Boolean);
                    const href =
                      entry.kind === "directory"
                        ? `/?treeDirectory=${encodeURIComponent(entry.path)}#repository`
                        : `/?treeDirectory=${encodeURIComponent(tree.directory)}&diffPath=${encodeURIComponent(entry.path)}#repository`;
                    return `<li><a href="${href}"><span aria-hidden="true">${entry.kind === "directory" ? "▸" : "·"}</span><code>${escapeHtml(entry.name)}</code></a><small>${flags.length === 0 ? "unchanged" : flags.join(" / ")}</small></li>`;
                  })
                  .join("")}</ul>`;
          const continuation =
            tree.nextCursor === null
              ? ""
              : `<a class="page-link" href="/?treeDirectory=${encodeURIComponent(tree.directory)}&treeCursor=${encodeURIComponent(tree.nextCursor)}#repository">次のEntry</a>`;
          const diff = worktreeView.diff;
          const diffView =
            diff === null
              ? '<p class="empty-state">Fileを選択するとPrepared／Working差分を表示します。</p>'
              : `<section class="repository-diff"><h4><code>${escapeHtml(diff.path)}</code></h4>${diff.unregistered ? '<p class="empty-state">未追跡Fileの内容は自動読取りしません。Stage後にPrepared差分として確認してください。</p>' : ""}<h5>Prepared</h5><pre>${escapeHtml(diff.preparedPatch || "差分なし")}</pre>${diff.preparedTruncated ? "<small>表示上限で切り詰めました。</small>" : ""}<h5>Working</h5><pre>${escapeHtml(diff.workingPatch || "差分なし")}</pre>${diff.workingTruncated ? "<small>表示上限で切り詰めました。</small>" : ""}</section>`;
          return `<section class="repository-browser"><h3>Repository Tree／Diff</h3><nav class="repository-breadcrumb">${navigation}</nav>${entries}${continuation}${diffView}</section>`;
        })();
  const content =
    changeCount === 0
      ? '<p class="empty-state">現在の作業ツリーに未反映の変更はありません。</p>'
      : groups
          .map(
            ([label, operation, paths]) =>
              `<section class="repository-group"><h3>${label} <span>${paths.length}</span></h3>${paths.length === 0 ? '<p class="empty-state">0 files</p>' : `<ul>${paths.map((entry) => `<li><code>${escapeHtml(entry)}</code><form method="post" action="/repository/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="${operation}"><input type="hidden" name="path" value="${escapeHtml(entry)}"><button type="submit">${operation === "prepare" ? "Stage" : "Unstage"}</button></form></li>`).join("")}</ul>`}</section>`,
          )
          .join("");
  return `<article class="panel wide" id="repository"><header><div><p class="eyebrow">Repository</p><h2>作業ツリー</h2></div><span>${changeCount} changes</span></header>${resultNotice}${treeView}${content}<div class="repository-actions"><form method="post" action="/repository/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="create_revision"><label>Commit message<input required maxlength="4096" name="message"></label><button type="submit">Commit staged changes</button></form>${publicationForm}</div></article>`;
}

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

/**
 * Workbench Production Shellを現在のProject Surfaceから描画する。
 *
 * @responsibility 公式ShellへRepository Identity、五場面およびCapability未構成状態を投影する。
 * @trace ARCH-000012
 * @input surfaceに同じRepository Snapshotから構築したRead Modelを受け取る。
 * @returns Browserへ配信する完全HTMLを返す。
 * @precondition surfaceはProject Operation Readerと固定Capability観測を通過している。
 * @postcondition 五場面を全て表示し、Topic／Meeting未構成を0件と表示しない。
 * @effect N/A: HTML文字列を構築するだけである。
 * @failure N/A: Reader失敗時は本関数へ到達しない。
 * @invariant Project Contextの事実・共有分析・Owner Relationを独自値へ置換しない。
 * @boundary Workbench Read Modelとlocalhost Browser Surfaceの境界。
 * @security 表示Textをescapeし、Role外Contextを生成しない。
 * @concurrency N/A: 起動時に固定したSnapshotを同期描画する。
 */
function renderShell(
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
  aiRequestApplication: WorkbenchAiRequestApplication | undefined,
  aiRequestSnapshot: WorkbenchAiRequestSnapshot | null,
  candidateApplication: WorkbenchCandidateApplication | undefined,
  candidateReview: WorkbenchCandidateReviewResult | null,
  candidateAction: WorkbenchCandidateActionResult | null,
  aiRequestNotice: string | null,
  runtimeActivity: WorkbenchRuntimeActivityObservation | undefined,
  documentQuery: string,
  portfolioQuery: Readonly<{ query: string; state: string; cursor: string }>,
  worktreeView: Readonly<{
    state: "available" | "unknown";
    tree: RepositoryWorktreeTreePage | null;
    diff: RepositoryWorktreeFileDiff | null;
  }>,
  selectedRepositoryId?: string,
): string {
  const { context } = surface;
  const capabilityLabel = (
    collection:
      | WorkbenchProjectSurface["topics"]
      | WorkbenchProjectSurface["meetings"],
  ): string =>
    collection.state === "available"
      ? `${collection.items.length} items`
      : collection.state === "not_configured"
        ? "Not configured"
        : "Unknown";
  const connectionLabel =
    connectionState === "repository"
      ? credentialAdministration === undefined
        ? "Repository mode"
        : "CROS administration"
      : connectionState === "cros_available"
        ? "Remote CROS connected"
        : "Remote CROS unavailable";
  const topicsDetail =
    selectedRepositoryId === undefined
      ? "未構成と0件を区別します"
      : selectedRepositoryId;
  const meetingsDetail = topicsDetail;
  const refreshHtml =
    remoteConnection !== undefined
      ? `<form method="post" action="/connection/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><button name="operation" value="refresh" type="submit">Refresh projection</button></form>`
      : '<button type="button" disabled>Refresh projection</button>';
  const contentHtml = `${renderPortfolio(portfolio, context, connectionState, portfolioQuery.query, portfolioQuery.state, portfolioQuery.cursor)}
        ${context.scenes.map(renderScene).join("")}
        ${renderTopics(topicCollection, topicPage, topicMeeting, actionToken, topicMeetingResult, topicQuery, selectedRepositoryId)}
        ${renderMeetings(meetingCollection, meetingPage, topicMeeting, actionToken, topicMeetingResult, meetingQuery, selectedRepositoryId)}
        ${renderWorkbenchProjectPlan(surface.plan, surface.ownerArtifacts)}
        ${renderWorkbenchQuality(surface.quality, surface.ownerArtifacts)}
        ${renderWorkbenchOwnerArtifacts(surface.ownerArtifacts, documentQuery)}
        ${renderWorkbenchRuntimeActivity(runtimeActivity)}
        ${renderRepository(surface.repository, actionToken, lastResult, worktreeView)}
        ${renderRemoteConnection(connectionState, remoteConnection, connectionNotice, actionToken)}
        ${renderCredentialAdministration(credentialAdministration, actionToken, credentialResult)}
        ${renderWorkbenchAiProfiles(aiProfiles)}
        ${renderWorkbenchAiProfileAdministration(aiProfileAdministrationSnapshot, aiProfileAdministrationOwner, actionToken, aiProfileAdministrationResult)}
        ${renderWorkbenchAiRequest(actionToken, aiProfiles, aiRequestApplication, aiRequestSnapshot, candidateApplication, candidateReview, candidateAction, aiRequestNotice)}`;
  const shell = renderToString(
    WorkbenchShell({
      projectId: context.projectId,
      repositoryId: context.repositoryId,
      repositoryRole: context.repositoryRole,
      connectionLabel,
      topicsLabel: capabilityLabel(topicCollection),
      topicsDetail,
      meetingsLabel: capabilityLabel(meetingCollection),
      meetingsDetail,
      logoPath: LOGO_PATH,
      refreshHtml,
      contentHtml,
    }),
  );
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CROS Workbench</title>
  <link rel="stylesheet" href="/workbench.css">
</head>
<body>
  <div data-workbench-react-root>${shell}</div>
  <script type="module" src="${CLIENT_ASSET_PATH}"></script>
</body>
</html>`;
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
  const aiRequestApplication = request.aiRequestApplication;
  const candidateApplication = request.candidateApplication;
  const runtimeActivityApplication =
    request.runtimeActivityApplication ??
    createRepositoryWorkbenchRuntimeActivityApplication(repositoryRoot);
  const topicMeeting = createTopicMeetingApplication(
    createTopicMeetingRepository(repositoryRoot),
  );
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
        try {
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          const kind = form.get("kind");
          const operation = form.get("operation");
          if (kind !== "topic" && kind !== "meeting")
            throw new Error("workbench_record_kind_invalid");
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
            topicMeetingResult = inspectTopicMeetingActionResult(
              await executeRemoteTopicMeetingAction(
                remoteConnection.mcpBaseUrl ?? remoteConnection.baseUrl,
                remoteConnection.token,
                repositoryId,
                action,
              ),
            );
          } else if (operation === "create") {
            topicMeetingResult = topicMeeting.create(
              kind,
              form.get("markdown") ?? "",
            );
          } else if (operation === "update") {
            topicMeetingResult = topicMeeting.update({
              kind,
              id: form.get("id") ?? "",
              expectedRevision: Number(form.get("expectedRevision")),
              markdown: form.get("markdown") ?? "",
            });
          } else if (operation === "delete") {
            topicMeetingResult = topicMeeting.delete({
              kind,
              id: form.get("id") ?? "",
              expectedRevision: Number(form.get("expectedRevision")),
              confirmed: form.get("confirmed") === "true",
              reason: "mistaken_registration",
            });
          } else if (operation === "treat-outcome" && kind === "meeting") {
            const outcome = topicMeeting.treatMeetingOutcome({
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
            const promotion = topicMeeting.promoteTopic({
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
          response.statusCode = 400;
          response.end("topic_meeting_action_rejected\n");
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
          if (aiRequestApplication === undefined)
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
            const result = await aiRequestApplication.start(
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
            aiRequestSnapshot = await aiRequestApplication.cancel(requestId);
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
            if (candidateApplication === undefined)
              throw new Error("workbench_candidate_application_unavailable");
            const confirmed = form.get("confirmed") === "true";
            candidateAction =
              operation === "adopt"
                ? await candidateApplication.adopt(candidateId, confirmed)
                : await candidateApplication.discard(candidateId, confirmed);
            candidateReview = await candidateApplication.review(candidateId);
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
      if (requestPath === "/" || requestPath === "/index.html") {
        if (aiRequestApplication !== undefined && currentAiRequestId !== null) {
          try {
            aiRequestSnapshot =
              await aiRequestApplication.observe(currentAiRequestId);
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
          candidateApplication !== undefined &&
          currentCandidateId !== undefined
        ) {
          try {
            candidateReview =
              await candidateApplication.review(currentCandidateId);
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
        if (runtimeActivityApplication !== undefined) {
          try {
            const runtimeCursor = requestUrl.searchParams.get("runtimeCursor");
            const page = {
              ...(runtimeCursor === null ? {} : { cursor: runtimeCursor }),
              limit: 20,
            };
            runtimeActivityObservation =
              remoteConnection === undefined
                ? await runtimeActivityApplication.observe(
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
          topicMeeting;
        if (remoteConnection === undefined) {
          topicPage = topicMeeting.list({
            kind: "topic",
            ...(topicCursor === null ? {} : { cursor: topicCursor }),
            limit: 20,
            query: topicQuery,
          });
          meetingPage = topicMeeting.list({
            kind: "meeting",
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
        body = renderShell(
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
          aiRequestApplication,
          aiRequestSnapshot,
          candidateApplication,
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
        if (method === "GET") {
          credentialResult = null;
          connectionNotice = null;
          topicMeetingResult = null;
          aiProfileAdministrationResult = null;
          aiRequestNotice = null;
        }
        contentType = "text/html; charset=utf-8";
      } else if (requestPath === "/project") {
        const projectId = requestUrl.searchParams.get("id") ?? "";
        const detail =
          portfolio === undefined
            ? null
            : renderFederatedProjectDetail(portfolio, projectId);
        if (detail === null) {
          setCommonHeaders(response);
          response.statusCode = 404;
          response.end(method === "HEAD" ? undefined : "not_found\n");
          return;
        }
        body = detail;
        contentType = "text/html; charset=utf-8";
      } else if (requestPath === "/topic" || requestPath === "/meeting") {
        const kind = requestPath === "/topic" ? "topic" : "meeting";
        const id = requestUrl.searchParams.get("id") ?? "";
        const repositoryId = requestUrl.searchParams.get("repositoryId") ?? "";
        const expectedPattern =
          kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u;
        let detail: string | null = null;
        if (expectedPattern.test(id)) {
          if (remoteConnection === undefined) {
            detail = renderTopicMeetingDetail(
              kind,
              topicMeeting,
              id,
              actionToken,
            );
          } else if (isVisiblePortfolioRepository(portfolio, repositoryId)) {
            const remote = await readRemoteTopicMeetingDocument(
              remoteConnection.mcpBaseUrl ?? remoteConnection.baseUrl,
              remoteConnection.token,
              repositoryId,
              kind,
              id,
            ).catch(() => null);
            if (remote !== null) {
              const reader: WorkbenchTopicMeetingDocumentReader = Object.freeze(
                {
                  getDocument: () => remote.document,
                  relations: () => remote.relations,
                },
              );
              detail = renderTopicMeetingDetail(
                kind,
                reader,
                id,
                actionToken,
                repositoryId,
              );
            }
          }
        }
        if (detail === null) {
          setCommonHeaders(response);
          response.statusCode = 404;
          response.end(method === "HEAD" ? undefined : "not_found\n");
          return;
        }
        body = detail;
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
