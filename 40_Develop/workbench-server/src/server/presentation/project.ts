/**
 * Workbenchの本文選択入力と主画面Modelの構築。
 * @packageDocumentation
 * @responsibility 既存Query境界と表示構築を所有し、Readerの呼出し順と例外を維持する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary Serverの要求入力・表示投影と既存Record／資格Reader。
 * @effect 主画面構築時にRecord Reader、資格管理Readerの順で既存観測を行う。
 * @security 非秘密の表示結果だけを構築し、認可Cache・資格保存・任意Rootを追加しない。
 */
import { readCredentialAdministrationState } from "../../../../access-management/src/index.ts";
import type {
  AiProfileCatalogMutationResult,
  AiProfileCatalogSnapshot,
} from "../../../../ai-adapter/src/index.ts";
import type {
  PortfolioProjection,
  TopicMeetingPage,
  TopicMeetingListQuery,
} from "../../../../domain-model/src/index.ts";
import type {
  ChangePublicationResult,
  RepositoryWorktreeTreePage,
  RepositoryWorktreeFileDiff,
} from "../../../../version-control/src/index.ts";
import type { WorkbenchRuntimeActivityObservation } from "../activity/observe.ts";
import type { WorkbenchAiProfileSurface } from "../ai-profile/projection.ts";
import type {
  WorkbenchAiRequests,
  WorkbenchAiRequestSnapshot,
} from "../ai-request/types.ts";
import type {
  WorkbenchMainViewModel,
  WorkbenchCredentialAdministrationView,
} from "../../shared/view/types.ts";
import type { CredentialAdministration } from "../credential/administration.ts";
import type { WorkbenchProjectSurface } from "../project/surface.ts";
import type {
  WorkbenchTopicMeetingDocumentReader,
  TopicMeetingActionResult,
} from "../topic-meeting/action.ts";
import { LOGO_PATH } from "../assets.ts";
import { createPortfolioPage } from "./portfolio.ts";
import {
  createRecordDocumentViews,
  createTopicMeetingResultView,
} from "./record.ts";
import type { WorkbenchConnectionState } from "./types.ts";

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
export function readCredentialAdministrationView(
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
export function readWorkbenchArtifactSelection(
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
export function createWorkbenchMainViewModel(
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
      networkPolicies: null,
      snapshot: aiRequestSnapshot,
      notice: aiRequestNotice,
    }),
    runtimeActivity: runtimeActivity ?? null,
    documentQuery,
    portfolioQuery,
  });
}
