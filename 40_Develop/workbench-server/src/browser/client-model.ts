/**
 * Workbench Client-side Reactへ渡す表示専用Read Model。
 *
 * @packageDocumentation
 * @responsibility Server AuthorityとBrowser Presentationの間で、非秘密の通常画面JSON契約を所有する。鍵提示は専用POST応答へ分離する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @boundary Workbench Node ServerとVite Browser ClientのJSON境界。
 * @effect N/A: 型と不変な値契約だけを定義する。
 * @security Credential Token、verifier、Remote接続Bearer、Private Key、Host Path、永続Authority、Application関数およびFilesystem Authorityを含めない。Process限定Action Tokenだけを固定用途で扱う。
 */
import type {
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
} from "../../../domain-model/src/index.ts";

/**
 * 現在画面と同じ選択条件のRead Model URLを作る。
 * @responsibility 管理・内容操作後の再取得で選択Repositoryを失わない。
 * @trace ARCH-000012
 * @input 現在URLとModelの選択Repository ID。
 * @returns 同Origin専用APIの相対URL。
 * @precondition Callerは現在画面のModelを所有する。
 * @postcondition route・queryを維持し、選択差を拒否する。
 * @effect N/A: URL構成のみ。
 * @failure URL選択とModelが不一致なら固定例外。
 * @invariant URLのIDを認可証明にしない。
 * @boundary 現在LocationとRead Model要求。
 * @security Origin・秘密値を返却URLへ追加しない。
 * @concurrency Callerは待機後にも同じ対象を確認する。
 */
export function createSelectedWorkbenchViewUrl(
  current: URL,
  repositoryId: string | null,
): string {
  const parameters = new URLSearchParams(current.search);
  if (
    parameters.getAll("repositoryId").length > 1 ||
    (parameters.get("repositoryId") || null) !== repositoryId
  )
    throw new Error("workbench_view_selection_changed");
  parameters.set("route", current.pathname);
  return `/api/workbench-view?${parameters}`;
}

import type {
  ChangePublicationResult,
  RepositoryWorktreeFileDiff,
  RepositoryWorktreeTreePage,
} from "../../../version-control/src/index.ts";
import type { PortfolioProjection } from "../../../domain-model/src/index.ts";
import {
  isFederatedProject,
  isProjectContext,
} from "../project/portfolio-result.ts";

import type {
  AiProfileCatalogMutationResult,
  AiProfileCatalogSnapshot,
  AiProfileCatalog,
} from "../../../ai-adapter/src/index.ts";
import type { WorkbenchAiProfileSurface } from "../ai-profile/projection.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchCandidateActionResult,
  WorkbenchCandidateReviewResult,
} from "../ai-request/types.ts";
import type { CredentialAdministrationSnapshot } from "../../../access-management/src/index.ts";
import type { WorkbenchProjectSurface } from "../project/surface.ts";
import type { WorkbenchRuntimeActivityObservation } from "../activity/observe.ts";

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
 * @shape contract、view、actionToken、各Surface、Queryおよび一回表示結果で構成する。aiProfilesのnullは今回Ownerからの未取得で、欠測や空Catalogとは区別する。
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
  aiProfiles: WorkbenchAiProfileSurface | null;
  aiProfileAdministration: Readonly<{
    snapshot: AiProfileCatalogSnapshot | null;
    owner: "Repository" | "CROS";
    result: AiProfileCatalogMutationResult | null;
  }>;
  aiRequest: Readonly<{
    configured: boolean;
    candidateConfigured: boolean;
    snapshot: WorkbenchAiRequestSnapshot | null;
    candidateReview: WorkbenchCandidateReviewResult | null;
    candidateAction: WorkbenchCandidateActionResult | null;
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

/**
 * JSON境界の未知値がWorkbench Client Modelの必須外形を満たすか検査する。
 *
 * @responsibility 不正なDiscriminantや必須構造欠落をReact描画前に拒否する。
 * @trace ARCH-000012
 * @input value: JSON.parse後の未知値。
 * @returns 必須外形を満たす場合だけWorkbench Client Modelを返す。
 * @precondition JSON構文解析が成功している。
 * @postcondition contract、viewおよびView別の必須構造を検査済みである。
 * @effect N/A: 入力を変更しない純粋検査である。
 * @failure 契約不一致ではworkbench_client_model_invalidを送出する。
 * @invariant Browser側で業務状態やAuthorityを推測しない。
 * @boundary 未知JSONとBrowser Presentation Modelの境界。
 * @security Prototypeや任意Functionを信頼せず、必要なOwn Propertyだけを確認する。
 * @concurrency N/A: 同期純粋処理である。
 */
export function inspectWorkbenchClientModel(
  value: unknown,
): WorkbenchClientModel {
  if (!isRecord(value) || value.contract !== "crdd/workbench/client-model/v1")
    throw new Error("workbench_client_model_invalid");
  if (value.view === "access") {
    const portfolio = value.portfolio;
    if (
      Object.keys(value).sort().join(",") !==
        "actionToken,authenticated,contract,credentials,logoPath,notice,portfolio,view" ||
      typeof value.actionToken !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/u.test(value.actionToken) ||
      value.logoPath !== "/assets/crdd-brand-icon.jpg" ||
      typeof value.authenticated !== "boolean" ||
      !isNullableString(value.notice) ||
      !isCredentialAdministrationView(value.credentials) ||
      (portfolio !== null &&
        (!isRecord(portfolio) ||
          Object.keys(portfolio).sort().join(",") !==
            "projects,retainedAsSourceOfTruth" ||
          portfolio.retainedAsSourceOfTruth !== false ||
          !Array.isArray(portfolio.projects) ||
          !portfolio.projects.every(isFederatedProject))) ||
      (!value.authenticated &&
        (portfolio !== null ||
          !isRecord(value.credentials) ||
          value.credentials.state !== "not_configured" ||
          value.credentials.snapshot !== null))
    )
      throw new Error("workbench_client_model_invalid");
    return value as WorkbenchAccessViewModel;
  }
  if (value.view === "main") {
    if (
      typeof value.actionToken !== "string" ||
      typeof value.logoPath !== "string" ||
      !isWorkbenchMainViewModel(value)
    )
      throw new Error("workbench_client_model_invalid");
    return value as WorkbenchMainViewModel;
  }
  if (value.view === "project-detail") {
    if (
      typeof value.logoPath !== "string" ||
      !isFederatedProject(value.project)
    )
      throw new Error("workbench_client_model_invalid");
    return value as WorkbenchProjectDetailViewModel;
  }
  if (value.view === "record-detail") {
    if (
      typeof value.logoPath !== "string" ||
      typeof value.actionToken !== "string" ||
      !isNullableString(value.repositoryId) ||
      typeof value.recordActionsConfigured !== "boolean" ||
      !isRecordDocumentView(value.record)
    )
      throw new Error("workbench_client_model_invalid");
    return value as WorkbenchRecordDetailViewModel;
  }
  if (value.view === "artifact") return inspectWorkbenchArtifactModel(value);
  throw new Error("workbench_client_model_invalid");
}

/**
 * 原文表示Modelの出所・種別・容量を閉検査する。
 * @responsibility 任意Objectや欠測を成果物本文として描画しない。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input 未知JSON。
 * @returns 検査済みartifact Model。
 * @precondition HTTP成功をCallerが確認済み。
 * @postcondition 共有選択と出所が一致し、原文を変更しない。
 * @effect N/A: メモリ内検査。
 * @failure 不正外形・種別・Identity・512KiB超過は固定例外。
 * @invariant 表示検査をRoot認可やFile安全性の証明へ使わない。
 * @boundary Reader JSONとReact表示。
 * @security Root・Token等の余剰fieldを拒否する。
 * @concurrency N/A: 一Snapshotの同期検査。
 */
export function inspectWorkbenchArtifactModel(
  value: unknown,
): WorkbenchArtifactViewModel {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !==
      "artifact,contract,logoPath,repositoryId,selectedRepositoryId,view" ||
    value.contract !== "crdd/workbench/client-model/v1" ||
    value.view !== "artifact" ||
    typeof value.logoPath !== "string" ||
    typeof value.repositoryId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value.repositoryId) ||
    !isNullableString(value.selectedRepositoryId) ||
    (value.selectedRepositoryId !== null &&
      value.selectedRepositoryId !== value.repositoryId) ||
    !isRecord(value.artifact) ||
    Object.keys(value.artifact).sort().join(",") !== "identity,kind,markdown" ||
    typeof value.artifact.identity !== "string" ||
    typeof value.artifact.markdown !== "string" ||
    new TextEncoder().encode(value.artifact.markdown).byteLength > 512 * 1024
  )
    throw new Error("workbench_client_model_invalid");
  const artifact = value.artifact;
  if (artifact.kind === "change") {
    if (!/^CHG-\d{6}$/u.test(String(artifact.identity)))
      throw new Error("workbench_client_model_invalid");
  } else if (artifact.kind === "owner") {
    const identity = String(artifact.identity);
    if (
      identity.length === 0 ||
      identity.length > 512 ||
      !identity.endsWith(".md") ||
      identity.startsWith("/") ||
      identity.includes("\\") ||
      identity.includes("\0") ||
      /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(identity) ||
      identity.split("/").some((part) => part === ".." || part === "")
    )
      throw new Error("workbench_client_model_invalid");
  } else throw new Error("workbench_client_model_invalid");
  return value as WorkbenchArtifactViewModel;
}

/**
 * 未知値が文字列またはnullかを判定する。
 * @responsibility JSON境界の任意文字列をnull許容Fieldと区別する。
 * @trace ARCH-000012
 * @input valueに未知値を受け取る。
 * @returns 文字列またはnullならtrueを返す。
 * @precondition N/A: 任意の未知値を受け取る。
 * @postcondition trueの場合だけ文字列またはnullとして参照できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant undefinedをnullとして受理しない。
 * @boundary JSON値とClient Modelの境界。
 * @security 値を評価または実行しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/**
 * 未知値が文字列配列かを判定する。
 * @responsibility Reactが反復する配列にObjectやnullを混入させない。
 * @trace ARCH-000012
 * @input valueに未知値を受け取る。
 * @returns 全要素が文字列の配列ならtrueを返す。
 * @precondition N/A: 任意の未知値を受け取る。
 * @postcondition trueの場合だけ安全に文字列配列を反復できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 配列以外を空配列へ補正しない。
 * @boundary JSON配列とReact反復の境界。
 * @security 値を評価または実行しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * Topic／Meeting Recordの表示必須値を検査する。
 * @responsibility 一覧と詳細が参照する識別子、状態、改訂および表示値を閉じる。
 * @trace ARCH-000012
 * @input valueと期待kindを受け取る。
 * @returns 対応するRecord形状ならtrueを返す。
 * @precondition kindはtopicまたはmeetingである。
 * @postcondition trueでは一覧と詳細の無条件参照が安全である。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 未知状態を既知状態へ畳まない。
 * @boundary Project Operation JSONとReact Record表示の境界。
 * @security 本文やRelationを推測補完しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isOperationRecord(value: unknown, kind?: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.projectId !== "string" ||
    typeof value.revision !== "number" ||
    typeof value.owner !== "string" ||
    typeof value.title !== "string" ||
    typeof value.summary !== "string"
  )
    return false;
  if (kind === "topic")
    return (
      !("meetingId" in value) &&
      typeof value.topicId === "string" &&
      ["open", "waiting", "promoted", "closed"].includes(String(value.state))
    );
  if (kind === "meeting")
    return (
      !("topicId" in value) &&
      typeof value.meetingId === "string" &&
      ["recorded", "closed", "corrected"].includes(String(value.state)) &&
      typeof value.occurredAt === "string" &&
      typeof value.pendingOutcomeCount === "number"
    );
  return false;
}

/**
 * Topic／Meeting詳細Documentを描画可能な形として検査する。
 * @responsibility 本文、Record IdentityおよびRelation閉集合を一緒に検査する。
 * @trace ARCH-000012
 * @input valueに未知の詳細Document候補を受け取る。
 * @returns 全必須値が成立する場合だけtrueを返す。
 * @precondition N/A: JSON由来の未知値を受け取る。
 * @postcondition trueでは詳細画面の無条件参照が安全である。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant Relation状態と種別は閉集合に限る。
 * @boundary Topic／Meeting JSONと詳細画面の境界。
 * @security MarkdownをHTMLとして評価しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isRecordDocumentView(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !["topic", "meeting"].includes(String(value.kind)) ||
    typeof value.id !== "string" ||
    !isRecord(value.document) ||
    typeof value.document.markdown !== "string" ||
    !isOperationRecord(value.document.record, value.kind) ||
    !isRecord(value.document.record)
  )
    return false;
  const recordIdentity =
    value.kind === "topic"
      ? value.document.record.topicId
      : value.document.record.meetingId;
  return (
    recordIdentity === value.id &&
    Array.isArray(value.relations) &&
    value.relations.every(
      (relation) =>
        isRecord(relation) &&
        typeof relation.id === "string" &&
        ["topic", "meeting", "change"].includes(String(relation.kind)) &&
        ["available", "not_found", "unavailable", "conflicting"].includes(
          String(relation.state),
        ) &&
        (relation.ownerRepositoryId === undefined ||
          typeof relation.ownerRepositoryId === "string"),
    )
  );
}

/**
 * Main View Modelの全反復対象と無条件参照値を検査する。
 * @responsibility React Main Screenが利用するネスト構造を外形castなしで確定する。
 * @trace ARCH-000012
 * @input valueにcontractとviewを確認済みのRecordを受け取る。
 * @returns Main Screenが初期描画可能な場合だけtrueを返す。
 * @precondition value.viewはmainである。
 * @postcondition trueでは全map対象、状態分岐および必須表示値を安全に参照できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 未知状態、配列でない値または欠落を成功Modelへ補正しない。
 * @boundary Main JSON Read ModelとReact Applicationの境界。
 * @security Authorityや秘密値を生成せず、受信形状だけを検査する。
 * @concurrency N/A: 同期純粋処理である。
 */
function isWorkbenchMainViewModel(value: Record<string, unknown>): boolean {
  const surface = value.surface;
  const topic = value.topic;
  const meeting = value.meeting;
  const portfolio = value.portfolio;
  const portfolioProjects =
    isRecord(portfolio) && Array.isArray(portfolio.projects)
      ? portfolio.projects
      : null;
  const ownerArtifacts = isRecord(surface) ? surface.ownerArtifacts : null;
  const collectionIsValid = (candidate: unknown): boolean =>
    isRecord(candidate) &&
    ["available", "not_configured", "unknown"].includes(
      String(candidate.state),
    ) &&
    Array.isArray(candidate.items) &&
    isNullableString(candidate.reason) &&
    ((candidate.state === "available" && candidate.reason === null) ||
      (candidate.state === "not_configured" &&
        candidate.items.length === 0 &&
        candidate.reason === null) ||
      (candidate.state === "unknown" &&
        candidate.items.length === 0 &&
        ["record_invalid", "observation_failed"].includes(
          String(candidate.reason),
        )));
  const recordSourceIsValid = (
    candidate: unknown,
    kind: "topic" | "meeting",
  ): boolean =>
    isRecord(candidate) &&
    collectionIsValid(candidate.collection) &&
    isRecord(candidate.collection) &&
    Array.isArray(candidate.collection.items) &&
    candidate.collection.items.every((record) =>
      isOperationRecord(record, kind),
    ) &&
    isRecord(candidate.page) &&
    ["available", "not_configured"].includes(String(candidate.page.status)) &&
    Array.isArray(candidate.page.records) &&
    candidate.page.records.every((record) => isOperationRecord(record, kind)) &&
    isNullableString(candidate.page.nextCursor) &&
    isRecord(candidate.query) &&
    (candidate.query.query === undefined ||
      typeof candidate.query.query === "string") &&
    (candidate.query.states === undefined ||
      isStringArray(candidate.query.states)) &&
    (candidate.query.owner === undefined ||
      typeof candidate.query.owner === "string") &&
    (candidate.query.relation === undefined ||
      typeof candidate.query.relation === "string") &&
    (candidate.query.occurredFrom === undefined ||
      typeof candidate.query.occurredFrom === "string") &&
    (candidate.query.occurredTo === undefined ||
      typeof candidate.query.occurredTo === "string") &&
    (candidate.query.pendingOnly === undefined ||
      typeof candidate.query.pendingOnly === "boolean") &&
    (candidate.query.sort === undefined ||
      ["id_asc", "title_asc", "state_asc", "occurred_desc"].includes(
        String(candidate.query.sort),
      ));
  const catalog = isRecord(value.aiProfiles) ? value.aiProfiles.catalog : null;
  const aiAdministration = value.aiProfileAdministration;
  const snapshot = isRecord(aiAdministration)
    ? aiAdministration.snapshot
    : null;
  const planStateIsValid =
    isRecord(surface) &&
    isRecord(surface.plan) &&
    ((surface.plan.state === "available" &&
      surface.plan.projection !== null &&
      surface.plan.reason === null) ||
      (surface.plan.state === "not_configured" &&
        surface.plan.projection === null &&
        surface.plan.reason === null) ||
      (surface.plan.state === "unknown" &&
        surface.plan.projection === null &&
        ["release_projection_invalid", "observation_failed"].includes(
          String(surface.plan.reason),
        )));
  const qualityStateIsValid =
    isRecord(surface) &&
    isRecord(surface.quality) &&
    ((surface.quality.state === "available" &&
      surface.quality.projection !== null &&
      surface.quality.reason === null) ||
      (surface.quality.state === "not_configured" &&
        surface.quality.projection === null &&
        surface.quality.reason === null) ||
      (surface.quality.state === "unknown" &&
        surface.quality.projection === null &&
        ["quality_projection_invalid", "observation_failed"].includes(
          String(surface.quality.reason),
        )));
  const portfolioIsValid = (() => {
    if (portfolio === null) return true;
    if (
      !isRecord(portfolio) ||
      portfolio.retainedAsSourceOfTruth !== false ||
      portfolioProjects === null ||
      !portfolioProjects.every(isFederatedProject)
    )
      return false;
    const projectIds = portfolioProjects
      .filter(isRecord)
      .map((project) => String(project.projectId));
    const sortedProjectIds = [...projectIds].sort((left, right) =>
      left.localeCompare(right),
    );
    return (
      projectIds.every(
        (projectId, index) => projectId === sortedProjectIds[index],
      ) && new Set(projectIds).size === projectIds.length
    );
  })();
  const aiResultItemsAreValid = (candidate: unknown): boolean =>
    Array.isArray(candidate) &&
    candidate.every(
      (item) =>
        isRecord(item) &&
        typeof item.text === "string" &&
        isStringArray(item.references),
    );
  const aiSnapshotIsValid = (candidate: unknown): boolean =>
    candidate === null ||
    (isRecord(candidate) &&
      typeof candidate.requestId === "string" &&
      (candidate.mode === null ||
        ["read_only_advice", "change_candidate"].includes(
          String(candidate.mode),
        )) &&
      isNullableString(candidate.profileId) &&
      [
        "accepted",
        "running",
        "completed",
        "blocked",
        "cancelled",
        "unknown",
      ].includes(String(candidate.status)) &&
      isNullableString(candidate.reason) &&
      aiResultItemsAreValid(candidate.facts) &&
      aiResultItemsAreValid(candidate.sharedAnalysis) &&
      aiResultItemsAreValid(candidate.additionalInferences) &&
      aiResultItemsAreValid(candidate.nextOptions) &&
      (candidate.candidate === null ||
        (isRecord(candidate.candidate) &&
          typeof candidate.candidate.candidateId === "string" &&
          candidate.candidate.disposition === "untrusted_not_adopted")));
  const candidateReviewIsValid = (candidate: unknown): boolean =>
    candidate === null ||
    (isRecord(candidate) &&
      ["available", "blocked"].includes(String(candidate.status)) &&
      typeof candidate.reason === "string" &&
      (candidate.candidate === null ||
        (isRecord(candidate.candidate) &&
          typeof candidate.candidate.candidateId === "string" &&
          ["public", "internal", "confidential"].includes(
            String(candidate.candidate.informationClassification),
          ) &&
          typeof candidate.candidate.expiresAtMs === "number" &&
          typeof candidate.candidate.baseRevision === "string" &&
          typeof candidate.candidate.candidateHash === "string" &&
          typeof candidate.candidate.patchHash === "string" &&
          isStringArray(candidate.candidate.changedPaths))));
  const candidateActionIsValid = (candidate: unknown): boolean =>
    candidate === null ||
    (isRecord(candidate) &&
      ["adopt", "discard"].includes(String(candidate.operation)) &&
      ["completed", "blocked"].includes(String(candidate.status)) &&
      typeof candidate.reason === "string" &&
      isNullableString(candidate.candidateId) &&
      isNullableString(candidate.receiptId) &&
      typeof candidate.effectIssued === "boolean" &&
      typeof candidate.effectStateUnknown === "boolean" &&
      typeof candidate.cleanupConfirmed === "boolean" &&
      typeof candidate.manualRecoveryRequired === "boolean" &&
      isStringArray(candidate.recoveryIds));
  return (
    isRecord(surface) &&
    isProjectContext(surface.context) &&
    collectionIsValid(surface.topics) &&
    collectionIsValid(surface.meetings) &&
    isRecord(surface.plan) &&
    planStateIsValid &&
    ["available", "not_configured", "unknown"].includes(
      String(surface.plan.state),
    ) &&
    (surface.plan.projection === null ||
      (isRecord(surface.plan.projection) &&
        typeof surface.plan.projection.publishedBaseline === "string" &&
        typeof surface.plan.projection.targetVersion === "string" &&
        isNullableString(surface.plan.projection.targetReleaseDate) &&
        typeof surface.plan.projection.workState === "string" &&
        typeof surface.plan.projection.releaseDecision === "string" &&
        typeof surface.plan.projection.scheduleRisk === "string" &&
        Array.isArray(surface.plan.projection.scope) &&
        surface.plan.projection.scope.every(
          (item) =>
            isRecord(item) &&
            typeof item.stage === "string" &&
            typeof item.scope === "string" &&
            typeof item.state === "string" &&
            typeof item.owner === "string",
        ) &&
        Array.isArray(surface.plan.projection.dependencies) &&
        surface.plan.projection.dependencies.every(
          (item) =>
            isRecord(item) &&
            typeof item.item === "string" &&
            typeof item.state === "string" &&
            typeof item.next === "string",
        ))) &&
    isRecord(surface.quality) &&
    qualityStateIsValid &&
    ["available", "not_configured", "unknown"].includes(
      String(surface.quality.state),
    ) &&
    (surface.quality.projection === null ||
      (isRecord(surface.quality.projection) &&
        typeof surface.quality.projection.overallState === "string" &&
        typeof surface.quality.projection.target === "string" &&
        typeof surface.quality.projection.observed === "string" &&
        typeof surface.quality.projection.unobserved === "string" &&
        typeof surface.quality.projection.knownGap === "string" &&
        typeof surface.quality.projection.nextGate === "string" &&
        typeof surface.quality.projection.humanDecision === "string" &&
        isRecord(surface.quality.projection.rationale) &&
        Object.values(surface.quality.projection.rationale).every(
          (item) => typeof item === "string",
        ))) &&
    isRecord(ownerArtifacts) &&
    ["available", "unknown"].includes(String(ownerArtifacts.state)) &&
    ((ownerArtifacts.state === "available" && ownerArtifacts.reason === null) ||
      (ownerArtifacts.state === "unknown" &&
        ownerArtifacts.reason === "owner_artifact_observation_failed" &&
        Array.isArray(ownerArtifacts.artifacts) &&
        ownerArtifacts.artifacts.length === 0)) &&
    Array.isArray(ownerArtifacts.artifacts) &&
    ownerArtifacts.artifacts.every(
      (artifact) =>
        isRecord(artifact) &&
        typeof artifact.relativePath === "string" &&
        typeof artifact.title === "string" &&
        ["release_projection", "project_plan", "quality", "relation"].includes(
          String(artifact.category),
        ) &&
        ["fixed", "project_context"].includes(String(artifact.origin)) &&
        isNullableString(artifact.sourceSection),
    ) &&
    isRecord(surface.repository) &&
    ["available", "unknown"].includes(String(surface.repository.state)) &&
    ((surface.repository.state === "available" &&
      surface.repository.reason === null &&
      surface.repository.changeSet !== null &&
      surface.repository.publicationTarget !== null) ||
      (surface.repository.state === "unknown" &&
        ["repository_root_invalid", "observation_failed"].includes(
          String(surface.repository.reason),
        ) &&
        surface.repository.changeSet === null &&
        surface.repository.publicationTarget === null)) &&
    (surface.repository.changeSet === null ||
      (isRecord(surface.repository.changeSet) &&
        surface.repository.changeSet.contract ===
          "crdd-version-control/local-change-set/v1" &&
        surface.repository.changeSet.contractRevision === 1 &&
        isStringArray(surface.repository.changeSet.revisionChanges) &&
        isStringArray(surface.repository.changeSet.preparedChanges) &&
        isStringArray(surface.repository.changeSet.workingChanges) &&
        isStringArray(surface.repository.changeSet.unregisteredPaths) &&
        surface.repository.changeSet.observationComplete === true &&
        surface.repository.changeSet.repositoryPathReported === false)) &&
    (surface.repository.publicationTarget === null ||
      (isRecord(surface.repository.publicationTarget) &&
        ["available", "not_configured", "unknown"].includes(
          String(surface.repository.publicationTarget.status),
        ) &&
        typeof surface.repository.publicationTarget.reason === "string" &&
        isNullableString(surface.repository.publicationTarget.destination) &&
        isNullableString(surface.repository.publicationTarget.branch) &&
        isNullableString(
          surface.repository.publicationTarget.revisionIdentity,
        ))) &&
    isNullableString(surface.repository.reason) &&
    recordSourceIsValid(topic, "topic") &&
    recordSourceIsValid(meeting, "meeting") &&
    Array.isArray(value.recordDocuments) &&
    value.recordDocuments.every(isRecordDocumentView) &&
    (value.topicMeetingResult === null ||
      (isRecord(value.topicMeetingResult) &&
        ["completed", "blocked"].includes(
          String(value.topicMeetingResult.status),
        ) &&
        typeof value.topicMeetingResult.reason === "string" &&
        isStringArray(value.topicMeetingResult.relationPaths) &&
        (value.topicMeetingResult.recordKind === null ||
          ["topic", "meeting"].includes(
            String(value.topicMeetingResult.recordKind),
          )))) &&
    isNullableString(value.selectedRepositoryId) &&
    typeof value.recordActionsConfigured === "boolean" &&
    typeof value.repositoryActionsConfigured === "boolean" &&
    (value.repositoryResult === null ||
      (isRecord(value.repositoryResult) &&
        ["completed", "blocked", "unknown"].includes(
          String(value.repositoryResult.status),
        ) &&
        typeof value.repositoryResult.reason === "string" &&
        typeof value.repositoryResult.effectIssued === "boolean" &&
        typeof value.repositoryResult.effectConfirmed === "boolean" &&
        isNullableString(value.repositoryResult.revisionIdentity) &&
        value.repositoryResult.automaticRetryIssued === false &&
        value.repositoryResult.forcePublicationIssued === false)) &&
    portfolioIsValid &&
    isRecord(value.portfolioPage) &&
    isNullableString(value.portfolioPage.nextCursor) &&
    typeof value.portfolioPage.cursorInvalid === "boolean" &&
    isRecord(value.portfolioQuery) &&
    typeof value.portfolioQuery.query === "string" &&
    typeof value.portfolioQuery.state === "string" &&
    typeof value.portfolioQuery.cursor === "string" &&
    isRecord(value.connection) &&
    Object.keys(value.connection).join(",") === "state" &&
    ["repository", "cros_available"].includes(String(value.connection.state)) &&
    isRecord(value.worktree) &&
    ["available", "unknown"].includes(String(value.worktree.state)) &&
    (value.worktree.tree === null ||
      (isRecord(value.worktree.tree) &&
        typeof value.worktree.tree.directory === "string" &&
        isNullableString(value.worktree.tree.nextCursor) &&
        Array.isArray(value.worktree.tree.entries) &&
        value.worktree.tree.entries.every(
          (entry) =>
            isRecord(entry) &&
            typeof entry.path === "string" &&
            typeof entry.name === "string" &&
            ["directory", "file"].includes(String(entry.kind)) &&
            typeof entry.prepared === "boolean" &&
            typeof entry.working === "boolean" &&
            typeof entry.unregistered === "boolean",
        ))) &&
    (value.worktree.diff === null ||
      (isRecord(value.worktree.diff) &&
        typeof value.worktree.diff.path === "string" &&
        typeof value.worktree.diff.preparedPatch === "string" &&
        typeof value.worktree.diff.workingPatch === "string" &&
        typeof value.worktree.diff.preparedTruncated === "boolean" &&
        typeof value.worktree.diff.workingTruncated === "boolean" &&
        typeof value.worktree.diff.unregistered === "boolean")) &&
    isCredentialAdministrationView(value.credentials) &&
    (value.aiProfiles === null ||
      (isRecord(value.aiProfiles) &&
        isWorkbenchCatalog(catalog) &&
        Array.isArray(value.aiProfiles.observations) &&
        value.aiProfiles.observations.every(
          (observation) =>
            isRecord(observation) &&
            typeof observation.profileId === "string" &&
            isRecord(observation.availability) &&
            typeof observation.availability.adapterRegistered === "boolean" &&
            (observation.availability.hostAvailable === null ||
              typeof observation.availability.hostAvailable === "boolean") &&
            (observation.availability.authenticated === null ||
              typeof observation.availability.authenticated === "boolean") &&
            (observation.availability.executionAuthorized === null ||
              typeof observation.availability.executionAuthorized ===
                "boolean"),
        ))) &&
    isRecord(aiAdministration) &&
    ["Repository", "CROS"].includes(String(aiAdministration.owner)) &&
    (snapshot === null ||
      (isRecord(snapshot) &&
        typeof snapshot.revision === "number" &&
        Number.isSafeInteger(snapshot.revision) &&
        snapshot.revision >= 0 &&
        isWorkbenchCatalog(snapshot.catalog))) &&
    (aiAdministration.result === null ||
      (isRecord(aiAdministration.result) &&
        ["completed", "rejected"].includes(
          String(aiAdministration.result.status),
        ) &&
        typeof aiAdministration.result.reason === "string" &&
        isRecord(aiAdministration.result.snapshot) &&
        typeof aiAdministration.result.snapshot.revision === "number" &&
        Number.isSafeInteger(aiAdministration.result.snapshot.revision) &&
        aiAdministration.result.snapshot.revision >= 0 &&
        isWorkbenchCatalog(aiAdministration.result.snapshot.catalog))) &&
    isRecord(value.aiRequest) &&
    typeof value.aiRequest.configured === "boolean" &&
    typeof value.aiRequest.candidateConfigured === "boolean" &&
    aiSnapshotIsValid(value.aiRequest.snapshot) &&
    candidateReviewIsValid(value.aiRequest.candidateReview) &&
    candidateActionIsValid(value.aiRequest.candidateAction) &&
    isNullableString(value.aiRequest.notice) &&
    isRecord(value.portfolioQuery) &&
    typeof value.documentQuery === "string" &&
    (value.runtimeActivity === null ||
      (isRecord(value.runtimeActivity) &&
        ["observed", "absent", "unknown"].includes(
          String(value.runtimeActivity.state),
        ) &&
        typeof value.runtimeActivity.reason === "string" &&
        ["observed", "unknown"].includes(
          String(value.runtimeActivity.eventState),
        ) &&
        typeof value.runtimeActivity.eventReason === "string" &&
        isNullableString(value.runtimeActivity.eventContinuation) &&
        (value.runtimeActivity.projection === null ||
          (isRecord(value.runtimeActivity.projection) &&
            typeof value.runtimeActivity.projection.projectId === "string" &&
            typeof value.runtimeActivity.projection.milestoneId === "string" &&
            typeof value.runtimeActivity.projection.generation === "number" &&
            typeof value.runtimeActivity.projection.milestoneState ===
              "string" &&
            isRecord(value.runtimeActivity.projection.objectiveCounts) &&
            Object.values(
              value.runtimeActivity.projection.objectiveCounts,
            ).every((item) => typeof item === "number") &&
            isRecord(value.runtimeActivity.projection.taskCounts) &&
            Object.values(value.runtimeActivity.projection.taskCounts).every(
              (item) => typeof item === "number",
            ) &&
            Array.isArray(
              value.runtimeActivity.projection.objectiveTaskSummaries,
            ) &&
            value.runtimeActivity.projection.objectiveTaskSummaries.every(
              (summary) =>
                isRecord(summary) &&
                typeof summary.objectiveId === "string" &&
                typeof summary.objectiveState === "string" &&
                isRecord(summary.taskCounts) &&
                Object.values(summary.taskCounts).every(
                  (item) => typeof item === "number",
                ),
            ) &&
            typeof value.runtimeActivity.projection.workProgress === "string" &&
            typeof value.runtimeActivity.projection.qualityState === "string" &&
            typeof value.runtimeActivity.projection.humanDecisionRequired ===
              "boolean" &&
            typeof value.runtimeActivity.projection.recoveryRequired ===
              "boolean" &&
            typeof value.runtimeActivity.projection.nextAction === "string")) &&
        Array.isArray(value.runtimeActivity.events) &&
        value.runtimeActivity.events.every(
          (event) =>
            isRecord(event) &&
            typeof event.eventId === "string" &&
            typeof event.occurredAt === "string" &&
            typeof event.objectiveId === "string" &&
            typeof event.taskId === "string" &&
            typeof event.attemptId === "string" &&
            ["completed", "blocked", "cancelled", "unknown"].includes(
              String(event.status),
            ) &&
            typeof event.reason === "string" &&
            typeof event.cleanupConfirmed === "boolean" &&
            typeof event.manualRecoveryRequired === "boolean",
        ) &&
        ((value.runtimeActivity.state === "observed" &&
          value.runtimeActivity.projection !== null) ||
          (["absent", "unknown"].includes(
            String(value.runtimeActivity.state),
          ) &&
            value.runtimeActivity.projection === null)) &&
        ((value.runtimeActivity.eventState === "observed" &&
          value.runtimeActivity.eventReason === "execution_events_observed") ||
          (value.runtimeActivity.eventState === "unknown" &&
            value.runtimeActivity.events.length === 0 &&
            value.runtimeActivity.eventContinuation === null))))
  );
}

/**
 * 未知値がProperty検査可能なRecordかを判定する。
 *
 * @responsibility Client Model検査でnullと配列をObject Recordへ誤認しない。
 * @trace ARCH-000012
 * @input value: 判定する未知値。
 * @returns Recordならtrueを返す。
 * @precondition N/A: 任意の未知値を受け取る。
 * @postcondition trueの場合だけProperty参照が可能である。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 配列をRecordとして受理しない。
 * @boundary JSON値と構造検査の境界。
 * @security Prototypeの内容をAuthorityとして扱わない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 通常画面の資格投影を閉じた非秘密値として検査する。
 * @responsibility 旧token/resultや資格材料を汎用GETから受理しない。
 * @trace ARCH-000013
 * @input 信頼しないJSON値。
 * @returns 非秘密の表示shapeだけtrue。
 * @precondition HTTP JSON decodeは呼出側が完了する。
 * @postcondition 変換・補完・秘密保持0。
 * @effect N/A: 局所検査だけ。
 * @failure 未知field・状態不整合はfalse。
 * @invariant 表示の正当性を操作認可へ転用しない。
 * @boundary Server JSONとBrowser表示。
 * @security Secret fieldは許可集合に含めない。
 * @concurrency 一応答のSnapshotだけ。
 */
function isCredentialAdministrationView(value: unknown): boolean {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "snapshot,state"
  )
    return false;
  if (value.state === "not_configured" || value.state === "unavailable")
    return value.snapshot === null;
  if (value.state !== "available" || !isRecord(value.snapshot)) return false;
  const snapshot = value.snapshot;
  if (
    Object.keys(snapshot).sort().join(",") !==
      "actorUserId,credentials,exchange,revision,users" ||
    !Number.isSafeInteger(snapshot.revision) ||
    Number(snapshot.revision) < 1 ||
    typeof snapshot.actorUserId !== "string" ||
    !Array.isArray(snapshot.users) ||
    !Array.isArray(snapshot.credentials)
  )
    return false;
  if (
    !snapshot.users.every(
      (user) =>
        isRecord(user) &&
        Object.keys(user).sort().join(",") === "role,userId,username" &&
        typeof user.userId === "string" &&
        typeof user.username === "string" &&
        ["developer", "manager", "administrator"].includes(String(user.role)),
    )
  )
    return false;
  if (
    !snapshot.credentials.every(
      (credential) =>
        isRecord(credential) &&
        Object.keys(credential).sort().join(",") ===
          "credentialId,issuanceOperationId,presentation,revoked,userId" &&
        typeof credential.credentialId === "string" &&
        typeof credential.userId === "string" &&
        typeof credential.issuanceOperationId === "string" &&
        ["not_attempted", "unconfirmed", "confirmed"].includes(
          String(credential.presentation),
        ) &&
        typeof credential.revoked === "boolean",
    )
  )
    return false;
  if (snapshot.exchange === null) return true;
  const exchange = snapshot.exchange;
  if (!isRecord(exchange)) return false;
  const keys =
    exchange.stage === "credential_stored"
      ? "entry,newCredentialId,oldCredentialIds,operationId,presentation,recipientUserId,recoveryId,revision,scope,stage"
      : "entry,oldCredentialIds,operationId,recipientUserId,recoveryId,revision,scope,stage";
  return (
    Object.keys(exchange).sort().join(",") === keys &&
    exchange.revision === snapshot.revision &&
    typeof exchange.recoveryId === "string" &&
    typeof exchange.operationId === "string" &&
    typeof exchange.recipientUserId === "string" &&
    ["host", "workbench"].includes(String(exchange.entry)) &&
    ["targeted", "all"].includes(String(exchange.scope)) &&
    isStringArray(exchange.oldCredentialIds) &&
    ["prepared", "revoked", "credential_stored"].includes(
      String(exchange.stage),
    ) &&
    (exchange.stage !== "credential_stored" ||
      (typeof exchange.newCredentialId === "string" &&
        ["not_attempted", "unconfirmed", "confirmed"].includes(
          String(exchange.presentation),
        )))
  );
}

/**
 * BrowserのCatalog JSONを採用済みSchemaと関係へ照合する。
 * @responsibility 余剰field・重複Identity・未登録Modelと曖昧な選択を表示前に拒否する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @input JSON.parse後のCatalog候補。
 * @returns 完全な表示契約に合う場合だけtrue。
 * @precondition JSON境界の値であり実行可能Objectを受けない。
 * @postcondition Catalogの意味・保存・認可を変更しない。
 * @effect N/A: 値検査のみ。
 * @failure 不正値はfalseで拒否する。
 * @invariant 不足fieldを補完しない。
 * @boundary Catalog OwnerのJSONからBrowser表示。
 * @security Path・資格・任意実行引数の余剰fieldを受理しない。
 * @concurrency N/A: 共有状態なし。
 */
function isWorkbenchCatalog(candidate: unknown): candidate is AiProfileCatalog {
  if (
    !isRecord(candidate) ||
    Object.keys(candidate).sort().join(",") !==
      "adapters,contract,contractRevision,profiles" ||
    candidate.contract !== "crdd/ai-profile-catalog" ||
    candidate.contractRevision !== 1 ||
    !Array.isArray(candidate.adapters) ||
    !candidate.adapters.length ||
    !Array.isArray(candidate.profiles) ||
    !candidate.profiles.length
  )
    return false;
  const identifier = /^[a-z][a-z0-9._-]{1,63}$/u;
  const model = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
  const roles = [
    "coordinator",
    "executor",
    "independent_reviewer",
    "result_integration",
  ];
  const tiers = ["preferred", "upper_allowed"];
  const efforts = ["low", "medium", "high", "xhigh", "max"];
  if (
    !candidate.adapters.every((a) => {
      if (
        !isRecord(a) ||
        Object.keys(a).sort().join(",") !==
          "adapterId,allowedModelIds,allowedReasoningEfforts,authorityOrigin,offering,provider" ||
        typeof a.adapterId !== "string" ||
        !identifier.test(a.adapterId) ||
        !["codex", "claude"].includes(String(a.provider)) ||
        !["chatgpt_subscription_oauth", "claude_max"].includes(
          String(a.offering),
        ) ||
        typeof a.authorityOrigin !== "string" ||
        !isStringArray(a.allowedModelIds) ||
        !a.allowedModelIds.length ||
        new Set(a.allowedModelIds).size !== a.allowedModelIds.length ||
        !a.allowedModelIds.every((m) => model.test(m)) ||
        !isStringArray(a.allowedReasoningEfforts) ||
        !a.allowedReasoningEfforts.length ||
        new Set(a.allowedReasoningEfforts).size !==
          a.allowedReasoningEfforts.length ||
        !a.allowedReasoningEfforts.every((e) => efforts.includes(e))
      )
        return false;
      try {
        const origin = new URL(a.authorityOrigin);
        return (
          origin.protocol === "https:" && origin.origin === a.authorityOrigin
        );
      } catch {
        return false;
      }
    }) ||
    !candidate.profiles.every(
      (p) =>
        isRecord(p) &&
        Object.keys(p).sort().join(",") ===
          "adapterId,billingMode,compatibilityReason,defaultReasoningEffort,exactModelId,family,modelTiers,profileId,selectionRoles,speedMode" &&
        typeof p.profileId === "string" &&
        /^PROFILE-[0-9]{6,}$/u.test(p.profileId) &&
        typeof p.adapterId === "string" &&
        identifier.test(p.adapterId) &&
        typeof p.family === "string" &&
        identifier.test(p.family) &&
        typeof p.exactModelId === "string" &&
        model.test(p.exactModelId) &&
        isStringArray(p.selectionRoles) &&
        p.selectionRoles.length > 0 &&
        new Set(p.selectionRoles).size === p.selectionRoles.length &&
        p.selectionRoles.every((r) => roles.includes(r)) &&
        isStringArray(p.modelTiers) &&
        p.modelTiers.length > 0 &&
        new Set(p.modelTiers).size === p.modelTiers.length &&
        p.modelTiers.every((t) => tiers.includes(t)) &&
        p.speedMode === "normal" &&
        p.billingMode === "subscription_oauth" &&
        efforts.includes(String(p.defaultReasoningEffort)) &&
        isNullableString(p.compatibilityReason),
    )
  )
    return false;
  const catalog = candidate as unknown as AiProfileCatalog;
  if (
    new Set(catalog.adapters.map((a) => a.adapterId)).size !==
      catalog.adapters.length ||
    new Set(catalog.profiles.map((p) => p.profileId)).size !==
      catalog.profiles.length
  )
    return false;
  const adapters = new Map(catalog.adapters.map((a) => [a.adapterId, a]));
  if (
    !catalog.profiles.every(
      (p) =>
        adapters.get(p.adapterId)?.allowedModelIds.includes(p.exactModelId) &&
        adapters
          .get(p.adapterId)
          ?.allowedReasoningEfforts.includes(p.defaultReasoningEffort),
    )
  )
    return false;
  for (const provider of ["codex", "claude"])
    for (const role of roles)
      for (const tier of tiers) {
        const keys = catalog.profiles
          .filter(
            (p) =>
              adapters.get(p.adapterId)?.provider === provider &&
              p.selectionRoles.some((r) => r === role) &&
              p.modelTiers.some((t) => t === tier),
          )
          .map((p) => `${p.family}:${p.speedMode}:${p.billingMode}`);
        if (new Set(keys).size !== keys.length) return false;
      }
  return true;
}

/**
 * 専用APIの現在Catalog Snapshotを閉検査する。
 * @responsibility Mainと共有管理で同じCatalog検査を利用する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @input JSON.parse後の二field Snapshot。
 * @returns 検査済み非秘密Snapshot。
 * @precondition HTTP成功をCallerが確認済み。
 * @postcondition 未取得を既定Catalogへ補完しない。
 * @effect N/A: JSON検査のみ。
 * @failure 不正改訂・Catalog・余剰fieldは固定例外。
 * @invariant 検査から保存完了や認可を生成しない。
 * @boundary 同Origin APIとBrowser状態。
 * @security Root・資格を持つ応答を受理しない。
 * @concurrency N/A: 一応答だけを検査する。
 */
export function inspectWorkbenchProfileSnapshot(
  value: unknown,
): AiProfileCatalogSnapshot {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "catalog,revision" ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 0 ||
    !isWorkbenchCatalog(value.catalog)
  )
    throw new Error("workbench_profile_response_invalid");
  return value as AiProfileCatalogSnapshot;
}

/**
 * 明示送信したProfile操作と結果を照合する。
 * @responsibility 保存・拒否・改訂と対象Profileの相関を表示前に確認する。
 * @trace ARCH-000010
 * @trace ARCH-000012
 * @input 送信済みFormとJSON結果。
 * @returns 検査済みの完了または拒否結果。
 * @precondition Formは明示操作で一回送信済み。
 * @postcondition 不明な結果を成功や未保存へ丸めない。
 * @effect N/A: 値検査だけ。
 * @failure 余剰field・結果相関不正は固定例外。
 * @invariant 再送・認可・巻戻しを行わない。
 * @boundary Profile POST結果とBrowser表示。
 * @security 非秘密のCatalogだけを受理する。
 * @concurrency 同じ送信Formの結果だけを確認する。
 */
export function inspectWorkbenchProfileResult(
  form: URLSearchParams,
  value: unknown,
): AiProfileCatalogMutationResult {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "reason,snapshot,status"
  )
    throw new Error("workbench_profile_response_invalid");
  const snapshot = inspectWorkbenchProfileSnapshot(value.snapshot);
  const operation = form.get("operation"),
    expected = Number(form.get("expectedRevision"));
  const id = form.get("profileId"),
    target = snapshot.catalog.profiles.find((p) => p.profileId === id);
  if (
    !["create", "update", "delete"].includes(operation ?? "") ||
    !Number.isSafeInteger(expected) ||
    expected < 0
  )
    throw new Error("workbench_profile_response_invalid");
  let valid = false;
  if (value.status === "completed") {
    valid =
      snapshot.revision === expected + 1 &&
      value.reason ===
        (operation === "create"
          ? "profile_created"
          : operation === "update"
            ? "profile_updated"
            : "profile_deleted");
    if (operation === "delete")
      valid = valid && form.get("confirmed") === "true" && !target;
    else
      valid =
        valid &&
        !!target &&
        `${target.adapterId}|${target.exactModelId}` ===
          form.get("adapterModel") &&
        target.family === form.get("family") &&
        target.defaultReasoningEffort === form.get("defaultReasoningEffort") &&
        target.compatibilityReason ===
          ((form.get("compatibilityReason") ?? "").trim() || null) &&
        JSON.stringify(target.selectionRoles) ===
          JSON.stringify(form.getAll("selectionRole")) &&
        JSON.stringify(target.modelTiers) ===
          JSON.stringify(form.getAll("modelTier"));
  } else if (value.status === "rejected") {
    if (value.reason === "revision_conflict")
      valid = snapshot.revision !== expected;
    else if (snapshot.revision === expected) {
      if (value.reason === "profile_already_exists")
        valid = operation === "create" && !!target;
      else if (value.reason === "profile_not_found")
        valid = operation !== "create" && !target;
      else if (value.reason === "profile_delete_confirmation_required")
        valid =
          operation === "delete" &&
          form.get("confirmed") !== "true" &&
          !!target;
      else if (value.reason === "catalog_invalid")
        valid =
          (operation === "create" ? !target : !!target) &&
          (operation !== "delete" || form.get("confirmed") === "true");
    }
  }
  if (!valid) throw new Error("workbench_profile_response_invalid");
  return {
    status: value.status,
    reason: value.reason,
    snapshot,
  } as AiProfileCatalogMutationResult;
}
