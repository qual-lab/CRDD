/**
 * Workbenchの共有表示DTO。
 * @packageDocumentation
 * @responsibility 両側が使う非秘密の表示型だけを定義し、Domainの正本型は参照する。
 * @trace ARCH-000012
 * @boundary Workbenchの非秘密表示契約とBrowser／Serverの境界。
 * @effect N/A: 型宣言だけで実行時処理を持たない。
 * @security 資格・認可Authorityを新設せず、既存の秘密非搬送と受理条件を維持する。
 */
import type {
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
} from "../../../../domain-model/src/index.ts";
import type {
  ChangePublicationResult,
  RepositoryWorktreeFileDiff,
  RepositoryWorktreeTreePage,
} from "../../../../version-control/src/index.ts";
import type { PortfolioProjection } from "../../../../domain-model/src/index.ts";
import type {
  AiSelectionSaveResult,
  AiSelectionSnapshot,
} from "../../../../domain-model/src/index.ts";
import type { WorkbenchAiSelectionSurface } from "../../server/ai-selection/projection.ts";
import type { WorkbenchAiRequestSnapshot } from "../../server/ai-request/types.ts";
import type { CredentialAdministrationSnapshot } from "../../../../access-management/src/index.ts";
import type { WorkbenchProjectSurface } from "../../server/project/surface.ts";
import type { WorkbenchRuntimeActivityObservation } from "../../server/activity/observe.ts";
/**
 * Browserへ公開できる一件のTopic／Meeting本文とRelation。
 * @responsibility 本文とRelationを同一Record Identityで表示する。
 * @trace ARCH-000012
 * @shape kind、id、documentおよびrelationsで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition Serverで公開可能性を確定済みである。
 * @postcondition Browserは読取り表示値だけを受け取る。
 * @effect N/A: 型宣言である。
 * @failure N/A: 失敗はServer応答で表す。
 * @invariant Record正本を所有しない。
 * @boundary Project OperationとBrowser表示の境界。
 * @security Serverが許可した内容だけを含む。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type WorkbenchRecordDocumentView = Readonly<{
  kind: ProjectOperationRecordKind;
  id: string;
  document: TopicMeetingDocument;
  relations: readonly TopicMeetingRelation[];
}>;

/**
 * Topic／Meeting操作の表示結果。
 * @responsibility 直前操作の成否とRelationを一回表示する。
 * @trace ARCH-000012
 * @shape status、reason、relationPathsおよびrecordKindで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition Serverが操作結果を確定済みである。
 * @postcondition Effect Authorityを含まない。
 * @effect N/A: 型宣言である。
 * @failure blockedをcompletedに変換しない。
 * @invariant 表示結果は永続正本ではない。
 * @boundary Server Effect結果とBrowser表示の境界。
 * @security 非秘密の結果値だけを含む。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type WorkbenchTopicMeetingResultView = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  relationPaths: readonly string[];
  recordKind: ProjectOperationRecordKind | null;
}>;

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
 * 資格管理の非秘密表示だけを汎用画面へ渡す。
 * @responsibility 一改訂の対象候補と交換相関を表示し、鍵提示応答を保持しない。
 * @trace ARCH-000013
 * @shape state、snapshot。未構成／未取得はsnapshot null。
 * @invariant snapshotは操作Authorityでも過去完了証明でもない。
 * @boundary AM非秘密投影とBrowser通常GET。
 * @security 生鍵・Verifier・salt・Root・Remote Bearerなし。
 * @compatibility 最新User／Role結合だけ。旧profile/systemAdmin契約は廃止する。
 */
export type WorkbenchCredentialAdministrationView = Readonly<{
  state: "not_configured" | "unavailable" | "available";
  snapshot: CredentialAdministrationSnapshot | null;
}>;

/**
 * Workbenchの主画面を一回描画できる閉じたBrowser Read Model。
 * @responsibility Main Viewの全表示値、用途限定Tokenおよび操作結果の型境界を所有する。
 * @trace ARCH-000012
 * @shape contract、view、actionToken、各Surface、Queryおよび一回表示結果で構成する。aiSelectionのnullは今回Ownerからの未取得で、欠測や空Catalogとは区別する。
 * @invariant viewはmainで、正本やApplication関数を所有しない。
 * @boundary Workbench Node ServerとMain Browser ScreenのJSON境界。
 * @security Remote Bearer、verifier、Private Key、Host Pathおよび永続Authorityを含めない。
 * @compatibility contract `crdd/workbench/client-model/v1`のmain variantである。
 */
export type WorkbenchMainViewModel = Readonly<{
  contract: "crdd/workbench/client-model/v1";
  view: "main";
  actionToken: string;
  logoPath: string;
  surface: WorkbenchProjectSurface;
  portfolio: PortfolioProjection | null;
  portfolioPage: Readonly<{
    nextCursor: string | null;
    cursorInvalid: boolean;
  }>;
  connection: WorkbenchConnectionView;
  topic: Readonly<{
    collection: WorkbenchProjectSurface["topics"];
    page: TopicMeetingPage;
    query: TopicMeetingListQuery;
  }>;
  meeting: Readonly<{
    collection: WorkbenchProjectSurface["meetings"];
    page: TopicMeetingPage;
    query: TopicMeetingListQuery;
  }>;
  recordDocuments: readonly WorkbenchRecordDocumentView[];
  topicMeetingResult: WorkbenchTopicMeetingResultView | null;
  selectedRepositoryId: string | null;
  recordActionsConfigured: boolean;
  repositoryActionsConfigured: boolean;
  repositoryResult: ChangePublicationResult | null;
  worktree: Readonly<{
    state: "available" | "unknown";
    tree: RepositoryWorktreeTreePage | null;
    diff: RepositoryWorktreeFileDiff | null;
  }>;
  credentials: WorkbenchCredentialAdministrationView;
  aiSelection: WorkbenchAiSelectionSurface | null;
  aiSelectionManagement: Readonly<{
    snapshot: AiSelectionSnapshot | null;
    allowed: boolean;
    result: AiSelectionSaveResult | null;
  }>;
  aiRequest: Readonly<{
    configured: boolean;
    networkPolicies:
      | import("../../../../coordinator/src/index.ts").RepositoryNetworkPolicies
      | null;
    snapshot: WorkbenchAiRequestSnapshot | null;
    notice: string | null;
  }>;
  runtimeActivity: WorkbenchRuntimeActivityObservation | null;
  documentQuery: string;
  portfolioQuery: Readonly<{
    query: string;
    state: string;
    cursor: string;
  }>;
}>;

/**
 * 許可済みPortfolioの一ProjectをSource別に表示するRead Model。
 * @responsibility Project Detailの開示済み値だけを運ぶ。
 * @trace ARCH-000012
 * @shape contract、view、logoPathおよびprojectで構成する。
 * @invariant viewはproject-detailである。
 * @boundary Federated PortfolioとProject Detail ScreenのJSON境界。
 * @security Principalに開示されたProject値だけを含む。
 * @compatibility contract `crdd/workbench/client-model/v1`のproject-detail variantである。
 */
export type WorkbenchProjectDetailViewModel = Readonly<{
  contract: "crdd/workbench/client-model/v1";
  view: "project-detail";
  logoPath: string;
  project: PortfolioProjection["projects"][number];
}>;

/**
 * Topic／MeetingのCanonical本文と許可済み処置を表示するRead Model。
 * @responsibility Record Detailと明示POSTに必要な用途限定値を運ぶ。
 * @trace ARCH-000012
 * @shape contract、view、logoPath、actionToken、repositoryIdおよびrecordで構成する。
 * @invariant viewはrecord-detailである。
 * @boundary Project Operation RecordとRecord Detail ScreenのJSON境界。
 * @security actionTokenは同一Originの明示POST検証だけに使用する。
 * @compatibility contract `crdd/workbench/client-model/v1`のrecord-detail variantである。
 */
export type WorkbenchRecordDetailViewModel = Readonly<{
  contract: "crdd/workbench/client-model/v1";
  view: "record-detail";
  logoPath: string;
  actionToken: string;
  repositoryId: string | null;
  record: WorkbenchRecordDocumentView;
  recordActionsConfigured: boolean;
}>;

/**
 * 選択RepositoryのOwner成果物原文を表示する閉Model。
 * @responsibility 正本本文と論理出所、戻り先の選択を搬送する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @shape repositoryIdは出所、selectedRepositoryIdは共有選択または単体のnull、artifactはkind／identity／markdown。
 * @invariant 共有選択は出所IDと一致し、本文は原文のまま。
 * @boundary 既存ReaderとBrowserのtext表示。
 * @security Root・資格・HTML実行情報を含めない。
 * @compatibility Client Model revision 1のartifact variant。
 */
export type WorkbenchArtifactViewModel = Readonly<{
  contract: "crdd/workbench/client-model/v1";
  view: "artifact";
  logoPath: string;
  repositoryId: string;
  selectedRepositoryId: string | null;
  artifact: Readonly<{
    kind: "change" | "owner";
    identity: string;
    markdown: string;
  }>;
}>;

/**
 * Workbench Browserが描画できる全View ModelのUnion。
 * @responsibility view discriminantと対応する表示Modelの閉集合を定義する。
 * @trace ARCH-000012
 * @shape access、main、project-detail、record-detailおよびartifactの判別可能Unionである。
 * @invariant 全variantが同じcontract revisionを使用する。
 * @boundary JSON Runtime InspectorとWorkbenchAppの判別境界。
 * @security 未知viewをUnionへ受理しない。
 * @compatibility contract `crdd/workbench/client-model/v1`に固定する。
 */
export type WorkbenchClientModel =
  | WorkbenchArtifactViewModel
  | WorkbenchAccessViewModel
  | WorkbenchMainViewModel
  | WorkbenchProjectDetailViewModel
  | WorkbenchRecordDetailViewModel;

/**
 * Local CROSの接続と管理だけを表示するModel。
 * @responsibility 未認証や内容未選択を架空のRepository主画面へ変換しない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @shape access判別子、非秘密接続状態、Portfolioと資格管理投影。
 * @invariant 未認証時はPortfolioなし・資格一覧なし。
 * @boundary Workbench接続用JSONとCSR画面。
 * @security 入力済み鍵、Host Root、Verifierを保持しない。
 * @compatibility 現行client-model/v1内の追加variant。
 */
export type WorkbenchAccessViewModel = Readonly<{
  contract: "crdd/workbench/client-model/v1";
  view: "access";
  actionToken: string;
  logoPath: string;
  authenticated: boolean;
  notice: string | null;
  portfolio: PortfolioProjection | null;
  credentials: WorkbenchCredentialAdministrationView;
}>;
