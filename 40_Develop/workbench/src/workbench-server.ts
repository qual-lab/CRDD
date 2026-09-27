/**
 * Workbench Production Shellのlocalhost Server。
 *
 * @packageDocumentation
 * @responsibility Direction AのWorkbench Shellと公式ロゴをloopback限定で配信する。
 * @trace ARCH-000012
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

import type { PortfolioProjection } from "../../cros/src/index.ts";
import {
  executeChangePublication,
  gitChangePublicationAdapter,
  type ChangePublicationRequest,
  type ChangePublicationResult,
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

const HOST = "127.0.0.1";
const CONTRACT = "crdd/workbench/v1";
const HEALTH_PATH = "/.well-known/crdd-workbench-health";
const LOGO_PATH = "/assets/crdd-brand-icon.jpg";

export type WorkbenchStartRequest = Readonly<{
  workingDirectory: string;
  port?: number;
  portfolio?: PortfolioProjection;
  credentialAdministration?: CredentialAdministration;
}>;

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
function renderTopics(collection: WorkbenchProjectSurface["topics"]): string {
  const content =
    collection.state === "not_configured"
      ? '<p class="empty-state">22_Topicsは未構成です。0件として扱いません。</p>'
      : collection.state === "unknown"
        ? '<p class="empty-state">Topic正本を完全に観測できません。部分一覧は表示しません。</p>'
        : collection.items.length === 0
          ? '<p class="empty-state">構成済みです。現在のTopicは0件です。</p>'
          : `<ul>${collection.items
              .map(
                (topic) =>
                  `<li><strong>${escapeHtml(topic.topicId)} — ${escapeHtml(topic.title)}</strong><p>${escapeHtml(topic.summary)}</p><small>${escapeHtml(topic.state)} / ${escapeHtml(topic.owner)}</small></li>`,
              )
              .join("")}</ul>`;
  return `<article class="panel wide" id="topics"><header><div><p class="eyebrow">Topics</p><h2>継続して扱う論点</h2></div><span>${collection.state === "available" ? `${collection.items.length} items` : collection.state === "not_configured" ? "Not configured" : "Unknown"}</span></header>${content}</article>`;
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
): string {
  const content =
    collection.state === "not_configured"
      ? '<p class="empty-state">23_Meetingsは未構成です。0件として扱いません。</p>'
      : collection.state === "unknown"
        ? '<p class="empty-state">Meeting正本を完全に観測できません。部分一覧は表示しません。</p>'
        : collection.items.length === 0
          ? '<p class="empty-state">構成済みです。現在のMeetingは0件です。</p>'
          : `<ul>${collection.items
              .map(
                (meeting) =>
                  `<li><strong>${escapeHtml(meeting.meetingId)} — ${escapeHtml(meeting.title)}</strong><p>${escapeHtml(meeting.summary)}</p><small>${escapeHtml(meeting.state)} / ${escapeHtml(meeting.occurredAt)} / pending ${meeting.pendingOutcomeCount}</small></li>`,
              )
              .join("")}</ul>`;
  return `<article class="panel wide" id="meetings"><header><div><p class="eyebrow">Meetings</p><h2>会議と処置状態</h2></div><span>${collection.state === "available" ? `${collection.items.length} items` : collection.state === "not_configured" ? "Not configured" : "Unknown"}</span></header>${content}</article>`;
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
function renderPortfolio(
  portfolio: PortfolioProjection | undefined,
  context: WorkbenchProjectSurface["context"],
): string {
  if (portfolio === undefined)
    return `<article class="panel wide" id="portfolio"><header><div><p class="eyebrow">Project portfolio</p><h2>Projectを選ぶ</h2></div><span>Repository mode</span></header><ul><li><strong>${escapeHtml(context.projectId)}</strong><p>${escapeHtml(context.repositoryId)} / ${escapeHtml(context.repositoryRole)}</p><small>現在のRepository Contextだけを表示</small></li></ul></article>`;
  const content =
    portfolio.projects.length === 0
      ? '<p class="empty-state">現在の接続資格から表示できるProjectはありません。非開示Projectの存在や件数は表示しません。</p>'
      : `<ul>${portfolio.projects
          .map(
            (project) =>
              `<li><strong>${escapeHtml(project.projectId)}</strong><p>${project.sources.map((source) => `${escapeHtml(source.repositoryId)}: ${escapeHtml(source.state)}`).join(" / ")}</p><small>${escapeHtml(project.state)} / ${project.sources.length} visible sources</small></li>`,
          )
          .join("")}</ul>`;
  return `<article class="panel wide" id="portfolio"><header><div><p class="eyebrow">Project portfolio</p><h2>Projectを選ぶ</h2></div><span>CROS federation</span></header>${content}</article>`;
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
  const content =
    changeCount === 0
      ? '<p class="empty-state">現在の作業ツリーに未反映の変更はありません。</p>'
      : groups
          .map(
            ([label, operation, paths]) =>
              `<section class="repository-group"><h3>${label} <span>${paths.length}</span></h3>${paths.length === 0 ? '<p class="empty-state">0 files</p>' : `<ul>${paths.map((entry) => `<li><code>${escapeHtml(entry)}</code><form method="post" action="/repository/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="${operation}"><input type="hidden" name="path" value="${escapeHtml(entry)}"><button type="submit">${operation === "prepare" ? "Stage" : "Unstage"}</button></form></li>`).join("")}</ul>`}</section>`,
          )
          .join("");
  return `<article class="panel wide" id="repository"><header><div><p class="eyebrow">Repository</p><h2>作業ツリー</h2></div><span>${changeCount} changes</span></header>${resultNotice}${content}<div class="repository-actions"><form method="post" action="/repository/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="create_revision"><label>Commit message<input required maxlength="4096" name="message"></label><button type="submit">Commit staged changes</button></form>${publicationForm}</div></article>`;
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
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CROS Workbench</title>
  <link rel="stylesheet" href="/workbench.css">
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="CROS Workbench home">
        <img src="${LOGO_PATH}" alt="CRDD" width="36" height="36">
        <span><strong>CROS</strong><small>Workbench</small></span>
      </a>
      <div class="project-switcher" aria-label="Current project"><span>Project</span><strong>${escapeHtml(context.projectId)}</strong></div>
      <div class="connection"><span class="status-dot" aria-hidden="true"></span>${credentialAdministration === undefined ? "Repository mode" : "CROS administration"}</div>
    </header>
    <aside class="sidebar" aria-label="Primary navigation">
      <nav>
        <a class="active" href="#overview">Overview</a>
        <a href="#topics">Topics</a>
        <a href="#meetings">Meetings</a>
        <a href="#decision">Decisions</a>
        <a href="#repository">Repository</a>
        <a href="#connection">Connection</a>
        <a href="#ai-request">AI Request</a>
      </nav>
    </aside>
    <main id="overview">
      <section class="page-heading">
        <div><p class="eyebrow">Current project</p><h1>Project Workspace</h1><p>${escapeHtml(context.repositoryId)} / ${escapeHtml(context.repositoryRole)} の固定Project Contextから、今の状況、判断待ち、理由、次に取る一手を確認します。</p></div>
        <button type="button" disabled>Refresh projection</button>
      </section>
      <section class="summary-grid" aria-label="Project summary">
        <article><span>Project</span><strong>${escapeHtml(context.projectId)}</strong><small>${escapeHtml(context.repositoryId)}</small></article>
        <article><span>Repository role</span><strong>${escapeHtml(context.repositoryRole)}</strong><small>Declared coverage</small></article>
        <article><span>Topics</span><strong>${capabilityLabel(surface.topics)}</strong><small>未構成と0件を区別します</small></article>
        <article><span>Meetings</span><strong>${capabilityLabel(surface.meetings)}</strong><small>未構成と0件を区別します</small></article>
      </section>
      <section class="workspace-grid">
        ${renderPortfolio(portfolio, context)}
        ${context.scenes.map(renderScene).join("")}
        ${renderTopics(surface.topics)}
        ${renderMeetings(surface.meetings)}
        ${renderRepository(surface.repository, actionToken, lastResult)}
        ${renderCredentialAdministration(credentialAdministration, actionToken, credentialResult)}
        <article class="panel wide" id="ai-request"><header><div><p class="eyebrow">AI request</p><h2>AIへ依頼</h2></div><span>Not connected</span></header><p class="empty-state">依頼入口はProvider接続後に有効になります。Workbenchは会話履歴の正本を持ちません。</p></article>
      </section>
    </main>
  </div>
</body>
</html>`;
}

const shellCss = `:root{font-family:"Noto Sans CJK JP","Noto Sans JP","Yu Gothic UI",sans-serif;color:#18232d;background:#f2f3ef;font-synthesis:none;--ink:#18232d;--muted:#667078;--line:#d7dad3;--paper:#fbfbf8;--accent:#255c50;--accent-soft:#dfe9e4}*{box-sizing:border-box}body{margin:0;min-width:320px;background:linear-gradient(135deg,#f6f7f3,#ecefe9);font-size:15px}.app-shell{min-height:100vh;display:grid;grid-template-columns:220px minmax(0,1fr);grid-template-rows:68px minmax(0,1fr)}.topbar{grid-column:1/-1;display:flex;align-items:center;gap:28px;padding:0 24px;background:#fcfcf9;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;min-width:196px;color:var(--ink);text-decoration:none}.brand img{border-radius:9px;object-fit:cover}.brand span{display:grid;line-height:1.05}.brand small{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}.project-switcher{display:grid;gap:2px;padding-left:20px;border-left:1px solid var(--line)}.project-switcher span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.connection{margin-left:auto;color:var(--muted);display:flex;align-items:center;gap:8px}.status-dot{width:9px;height:9px;border-radius:50%;background:#5a8e72}.sidebar{padding:22px 14px;border-right:1px solid var(--line);background:#f7f8f4}.sidebar nav{display:grid;gap:6px}.sidebar a{padding:11px 14px;border-radius:8px;color:#4f5960;text-decoration:none;font-weight:600}.sidebar a.active{background:var(--accent-soft);color:var(--accent)}main{min-width:0;padding:36px;overflow:auto}.page-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.page-heading h1{font-size:clamp(28px,3vw,40px);line-height:1.15;margin:3px 0 8px}.page-heading p{margin:0;color:var(--muted);max-width:720px;line-height:1.7}.eyebrow{font-size:12px!important;text-transform:uppercase;letter-spacing:.1em;color:var(--accent)!important;font-weight:700}.page-heading button,.panel button{min-height:40px;padding:0 16px;border:1px solid var(--line);border-radius:8px;background:var(--accent);color:#fff;font-weight:700}.panel button:disabled{background:#b9bfba;color:#f4f5f2}.page-heading button{background:#e8eae5;color:#7c8485}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:30px 0}.summary-grid article,.panel{background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 22px rgba(24,35,45,.045)}.summary-grid article{display:grid;gap:7px;padding:18px}.summary-grid span,.summary-grid small{color:var(--muted)}.summary-grid strong{font-size:22px}.workspace-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{padding:22px}.panel.wide,.context-scene{grid-column:1/-1}.panel header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:14px}.panel h2{margin:2px 0;font-size:20px}.panel header>span{color:var(--muted);font-size:13px}.scene-summary{line-height:1.75;color:#38444c}.table-scroll{overflow:auto;margin-top:16px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;min-width:680px;background:#fff}th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line);line-height:1.55}th{font-size:12px;letter-spacing:.04em;color:var(--muted);background:#f4f6f1}tbody tr:last-child td{border-bottom:0}.panel ul{list-style:none;padding:0;margin:0}.panel li{padding:16px 0;border-bottom:1px solid var(--line)}.panel li:last-child{border-bottom:0}.panel li p{margin:5px 0 0;color:var(--muted);line-height:1.6}.repository-group li{display:flex;justify-content:space-between;align-items:center;gap:16px}.repository-actions{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}.repository-actions form,.credential-issue{display:grid;gap:10px;padding:16px;border:1px solid var(--line);border-radius:9px}.repository-actions label,.credential-issue label,#connection td form label{display:grid;gap:5px;font-weight:600}.repository-actions input,.credential-issue select,#connection td input{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}.repository-actions .confirm,#connection .confirm{grid-template-columns:auto 1fr;align-items:center}.repository-actions .confirm input,#connection .confirm input{min-height:0}.operation-result{padding:12px;border-radius:8px;background:var(--accent-soft)}.credential-issue{grid-template-columns:minmax(180px,260px) 1fr auto;align-items:end;margin-top:18px}.credential-issue p{margin:0;color:var(--muted);line-height:1.55}.one-time-token{display:grid;gap:8px;margin-top:12px}.one-time-token code{display:block;overflow-wrap:anywhere;padding:12px;background:#fff;border:1px solid var(--line);border-radius:7px;user-select:all}#connection td form{display:grid;gap:7px;min-width:220px}.panel dl{margin:0}.panel dl div{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.panel dd{margin:0;font-weight:700}.empty-state{margin:18px 0 0;padding:22px;border:1px dashed #bfc5bc;border-radius:9px;color:var(--muted);line-height:1.7;background:#f7f8f4}@media(max-width:900px){.app-shell{grid-template-columns:1fr;grid-template-rows:68px auto 1fr}.sidebar{border-right:0;border-bottom:1px solid var(--line);padding:10px 18px}.sidebar nav{grid-template-columns:repeat(7,minmax(108px,1fr));overflow:auto}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:28px 22px}.credential-issue{grid-template-columns:1fr}}@media(max-width:600px){.topbar{padding:0 14px;gap:12px}.brand{min-width:0}.brand small,.project-switcher span{display:none}.project-switcher{padding-left:12px}.connection{font-size:0}.sidebar{padding:8px 12px}.sidebar nav{grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible}.sidebar a{text-align:center;padding:10px 5px;font-size:13px}.summary-grid,.workspace-grid,.repository-actions{grid-template-columns:1fr}.panel.wide,.context-scene{grid-column:auto}.page-heading{display:grid}.page-heading button{width:100%}main{padding:24px 16px}.summary-grid{margin:22px 0}}`;

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
    "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'none'; frame-ancestors 'none'",
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
  const verification = verifyRepositoryRoot(repositoryRoot);
  if (verification.status !== "completed")
    throw new Error("workbench_repository_root_invalid");
  let projectSurface = await readWorkbenchProjectSurface(repositoryRoot);
  let lastActionResult: ChangePublicationResult | null = null;
  let credentialResult: CredentialAdministrationResult | null = null;
  const actionToken = randomBytes(32).toString("base64url");
  const connections = new Set<Socket>();
  const server = createServer((incoming, response) => {
    void (async () => {
      const method = incoming.method ?? "";
      const requestPath = incoming.url?.split("?", 1)[0] ?? "";
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
          if (request.credentialAdministration === undefined)
            throw new Error("workbench_credential_administration_unavailable");
          const form = await readActionForm(incoming);
          if (form.get("actionToken") !== actionToken)
            throw new Error("workbench_action_token_invalid");
          credentialResult = executeCredentialAdministrationAction(
            request.credentialAdministration,
            form,
          );
          setCommonHeaders(response);
          response.statusCode = 303;
          response.setHeader("Location", "/#connection");
          response.end();
        } catch {
          setCommonHeaders(response);
          response.statusCode = 400;
          response.end("credential_action_rejected\n");
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
        body = renderShell(
          projectSurface,
          request.portfolio,
          actionToken,
          lastActionResult,
          request.credentialAdministration,
          credentialResult,
        );
        if (method === "GET") credentialResult = null;
        contentType = "text/html; charset=utf-8";
      } else if (requestPath === "/workbench.css") {
        body = shellCss;
        contentType = "text/css; charset=utf-8";
      } else if (requestPath === LOGO_PATH) {
        body = logo;
        contentType = "image/jpeg";
      } else if (requestPath === HEALTH_PATH) {
        body = JSON.stringify({
          contract: CONTRACT,
          status: "ready",
          host: HOST,
          mode: "repository",
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
