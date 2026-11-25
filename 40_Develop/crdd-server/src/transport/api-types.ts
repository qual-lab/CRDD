/**
 * HTTPサーバーの起動・終了契約。
 * @responsibility 共有する構成と起動ハンドルの型だけを所有する。
 * @trace ARCH-000012
 */
import type { AiSelectionSnapshot } from "@qual-lab/crdd-configuration-model";
import type {
  TopicMeetingPage,
  TopicMeetingListQuery,
} from "@qual-lab/crdd-document-model";
import type { TreePage, FileDiff } from "@qual-lab/crdd-version-control";
import type {
  CredentialAdministrationView,
  AccessViewResponse,
} from "../service/access.ts";
import type {
  ProjectDetailResponse,
  ArtifactViewResponse,
} from "../service/project-context.ts";
import type {
  RecordDocumentView,
  RecordDetailResponse,
  RecordActionView,
} from "../service/topic.ts";
import type { AiSelectionSaveResult } from "@qual-lab/crdd-configuration-model";
import type { ChangesResult } from "@qual-lab/crdd-version-control";
import type { AiSelectionView } from "../service/configuration.ts";
import type {
  AiRequestSnapshot,
  WorkbenchExecutionActivityObservation,
} from "../service/execution.ts";
import type { ProjectViewData } from "../service/project-context.ts";
import type { TopicMeetingActionResult } from "../service/topic.ts";
import type { FilesystemStoreRoot } from "@qual-lab/crdd-access-management";
import type { PortfolioProjection } from "@qual-lab/crdd-document-model";
import type { Repository } from "@qual-lab/crdd-version-control";
import type { WorkbenchActivityReader } from "../service/execution.ts";
import type { AiRequests } from "../service/execution.ts";
import type { CredentialAdministration } from "../service/access.ts";
import type { McpRequestSource } from "./mcp-types.ts";

/** Workbenchの公開先とRepository接続・任意の利用側機能の構成。 */
export type WorkbenchStartRequest = Readonly<{
  workingDirectory: string;
  publicOrigin?: string;
  port?: number;
  apiDocumentation?: true;
  portfolio?: PortfolioProjection;
  credentialAdministration?: CredentialAdministration;
  localAccessRoot?: FilesystemStoreRoot;
  aiRequests?: AiRequests;
  sharedAiRequestsFactory?: (
    root: Repository,
    projectId: string,
    principalId: string,
    authorize: () => boolean,
  ) => AiRequests;
  activityReader?: WorkbenchActivityReader;
}>;

/** 単体・共有それぞれの認証でHTTPとMCPを同じ待受へ接続する構成。 @trace ARCH-000012 */
export type CrddServerStartRequest = WorkbenchStartRequest &
  (
    | Readonly<{
        localAccessRoot: FilesystemStoreRoot;
        mcpPublicOrigin?: string;
        localMcp?: never;
      }>
    | Readonly<{
        localAccessRoot?: never;
        publicOrigin?: never;
        mcpPublicOrigin?: never;
        localMcp: Readonly<{ source: McpRequestSource; bearerToken?: string }>;
      }>
  );

/** 起動済みWorkbenchのURLと所有Listenerを閉じる操作。 */
export type WorkbenchHandle = Readonly<{
  contract: "crdd/workbench/v1";
  baseUrl: string;
  publicUrl: string;
  healthUrl: string;
  close: () => Promise<void>;
}>;

/**
 * 主画面と起動が共有する接続形態の表示値。
 * @responsibility 単体と横断表示の既存区別だけを保持する。
 * @trace ARCH-000012
 * @shape repositoryまたはcros_available。
 * @invariant 認証・認可結果または内容公開のAuthorityとして使わない。
 * @boundary 起動Compositionと主画面投影。
 * @security 資格・Rootを含まない。
 * @compatibility 既存の表示値と同一である。
 */
export type WorkbenchConnectionState = "repository" | "cros_available";

/**
 * 一つの起動中だけ共有する表示値と直前結果。
 * @responsibility 既存変数の読取り・更新時点を変えず、操作受付と表示の間で保持する。
 * @trace ARCH-000012
 * @shape 現在投影、Repository別AI選択表示、単体操作結果、単体AI表示ID・Snapshot・Notice、既存の活動観測。
 * @invariant 保存・clone・汎用更新APIを追加せず、共有AI Sessionと混在しない。
 * @boundary Server内の実Consumerだけで共有する型。
 * @security 認証資格や許可済みRootを表示状態のAuthorityとして保持しない。
 * @compatibility 既存のメモリ内変数だけをまとめ、通信・永続Schemaを変更しない。
 */
export type WorkbenchPresentationState = {
  executionActivityObservation:
    | WorkbenchExecutionActivityObservation
    | undefined;
  projectSurface: ProjectViewData | undefined;
  aiSelection: AiSelectionView;
  lastActionResult: ChangesResult | null;
  recordActionResult: TopicMeetingActionResult | null;
  currentAiRequestId: string | null;
  aiRequestSnapshot: AiRequestSnapshot | null;
  aiRequestNotice: string | null;
  aiSelectionManagementResult: AiSelectionSaveResult | null;
};

/**
 * Repository単体または同Host共有接続の公開表示値。
 * @responsibility 接続状態と非秘密の結果だけを表示する。
 * @trace ARCH-000012
 * @shape stateだけで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition 同Hostの直接接続をServerが構成している。
 * @postcondition 接続先URLや資格を含まない。
 * @effect N/A: 型宣言である。
 * @failure unavailableをavailableへ畳まない。
 * @invariant 接続Authorityを所有しない。
 * @boundary Workbench ServerとBrowser表示の境界。
 * @security 接続資格を含めない。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type WorkbenchConnectionView = Readonly<{
  state: "repository" | "cros_available";
}>;

/**
 * Workbenchの主画面を一回描画できる閉じたBrowser Read Model。
 * @responsibility Main Viewの全表示値、用途限定Tokenおよび操作結果の型境界を所有する。
 * @trace ARCH-000012
 * @shape contract、view、actionToken、各Surface、Queryおよび一回表示結果で構成する。aiSelectionのnullは今回Ownerからの未取得で、欠測や空Catalogとは区別する。
 * @invariant viewはmainで、正本やApplication関数を所有しない。
 * @boundary Workbench Node ServerとMain Browser ScreenのJSON境界。
 * @security Remote Bearer、verifier、Private Key、Host Pathおよび永続Authorityを含めない。
 * @compatibility contract `crdd/workbench/view/v1`のmain variantである。
 */
export type MainViewResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "main";
  actionToken: string;
  projectData: ProjectViewData;
  portfolio: PortfolioProjection | null;
  portfolioPage: Readonly<{
    nextCursor: string | null;
    cursorInvalid: boolean;
  }>;
  connection: WorkbenchConnectionView;
  topicPage: TopicMeetingPage;
  topicQuery: TopicMeetingListQuery;
  meetingPage: TopicMeetingPage;
  meetingQuery: TopicMeetingListQuery;
  recordDocuments: readonly RecordDocumentView[];
  recordActionResult: RecordActionView | null;
  selectedRepositoryId: string | null;
  recordActionsConfigured: boolean;
  repositoryActionsConfigured: boolean;
  repositoryResult: ChangesResult | null;
  worktree: Readonly<{
    state: "available" | "unknown";
    tree: TreePage | null;
    diff: FileDiff | null;
  }>;
  credentials: CredentialAdministrationView;
  aiSelection: AiSelectionView | null;
  aiSelectionManagement: Readonly<{
    snapshot: AiSelectionSnapshot | null;
    allowed: boolean;
    result: AiSelectionSaveResult | null;
  }>;
  aiRequest: Readonly<{
    configured: boolean;
    additionalHosts: readonly string[] | null;
    snapshot: AiRequestSnapshot | null;
    notice: string | null;
  }>;
  executionActivity: WorkbenchExecutionActivityObservation | null;
}>;

/**
 * Workbench Browserが描画できる全View ModelのUnion。
 * @responsibility view discriminantと対応する表示Modelの閉集合を定義する。
 * @trace ARCH-000012
 * @shape access、main、project-detail、record-detailおよびartifactの判別可能Unionである。
 * @invariant 全variantが同じcontract revisionを使用する。
 * @boundary JSON Runtime InspectorとWorkbenchAppの判別境界。
 * @security 未知viewをUnionへ受理しない。
 * @compatibility contract `crdd/workbench/view/v1`に固定する。
 */
export type ViewResponse =
  | ArtifactViewResponse
  | AccessViewResponse
  | MainViewResponse
  | ProjectDetailResponse
  | RecordDetailResponse;
