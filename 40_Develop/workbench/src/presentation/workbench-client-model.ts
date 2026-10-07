/**
 * Workbench Client-side Reactへ渡す表示専用Read Model。
 *
 * @packageDocumentation
 * @responsibility Server AuthorityとBrowser Presentationの間で、通常は非秘密値だけを返し、Credential操作直後に限り一回表示Tokenを明示的に運ぶJSON契約を所有する。
 * @trace ARCH-000012
 * @boundary Workbench Node ServerとVite Browser ClientのJSON境界。
 * @effect N/A: 型と不変な値契約だけを定義する。
 * @security Credential verifier、Remote接続Bearer、Private Key、Host Path、永続Authority、Application関数およびFilesystem Authorityを含めない。Process限定Action Tokenと一回表示Credential Tokenは各用途の限定Fieldだけで扱う。
 */
import type {
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
} from "../../../domain-model/src/topic/index.ts";

import type {
  ChangePublicationResult,
  RepositoryWorktreeFileDiff,
  RepositoryWorktreeTreePage,
} from "../../../version-control/src/index.ts";
import type { PortfolioProjection } from "../../../cros/src/index.ts";

import type {
  AiProfileCatalogMutationResult,
  AiProfileCatalogSnapshot,
} from "../../../ai-runtime/src/index.ts";
import type { WorkbenchAiProfileSurface } from "../ai-profile-surface.ts";
import type {
  WorkbenchAiRequestSnapshot,
  WorkbenchCandidateActionResult,
  WorkbenchCandidateReviewResult,
} from "../ai-request.ts";
import type { CredentialAdministrationResult } from "../credential-administration.ts";
import type { WorkbenchProjectSurface } from "../project-surface.ts";
import type { WorkbenchRuntimeActivityObservation } from "../runtime-activity.ts";

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
 * Remote CROS接続の公開表示値。
 * @responsibility 接続状態と非秘密の結果だけを表示する。
 * @trace ARCH-000012
 * @shape state、endpointおよびnoticeで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition endpointはServer側で表示可能と判定済みである。
 * @postcondition Remote接続Bearerを含まない。
 * @effect N/A: 型宣言である。
 * @failure unavailableをavailableへ畳まない。
 * @invariant 接続Authorityを所有しない。
 * @boundary Remote CROSとBrowser表示の境界。
 * @security Remote接続Bearerを含めない。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type WorkbenchConnectionView = Readonly<{
  state: "repository" | "cros_available" | "cros_unavailable";
  endpoint: string | null;
  notice: Readonly<{
    status: "completed" | "rejected";
    message: string;
  }> | null;
}>;

/**
 * Credential管理画面へ公開できるMetadata。
 * @responsibility Credentialの識別値と公開可能な状態を表示する。
 * @trace ARCH-000013
 * @shape credentialId、profile、workspaceIds、systemAdminおよびrevokedで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition Registryから秘密を除外済みである。
 * @postcondition verifier、salt、tokenを含まない。
 * @effect N/A: 型宣言である。
 * @failure N/A: 状態はServerが確定する。
 * @invariant Credential正本を所有しない。
 * @boundary Credential RegistryとBrowser表示の境界。
 * @security 公開可能Metadataだけを含む。
 * @compatibility Credential Contractの現行Profile語彙と一致させる。
 * @concurrency N/A: 不変Snapshotである。
 */
export type WorkbenchCredentialMetadataView = Readonly<{
  credentialId: string;
  profile: "administrator" | "management" | "developer";
  workspaceIds: readonly string[];
  systemAdmin: boolean;
  revoked: boolean;
}>;

/**
 * Credential管理の公開表示Snapshotと一回表示結果。
 * @responsibility 通常Metadataと明示Credential操作直後の一回表示Tokenを分けて運ぶ。
 * @trace ARCH-000013
 * @shape state、credentialsおよび一回消費resultで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition resultは管理操作直後の最初のJSON応答に限る。
 * @postcondition resultは応答後に消費され、再取得できない。
 * @effect N/A: 型宣言である。
 * @failure 一回表示Tokenを通常Snapshotへ昇格しない。
 * @invariant Registryは生Tokenを保持しない。
 * @boundary Credential管理結果とBrowser表示の境界。
 * @security no-store応答と一回消費を必須とする。
 * @compatibility Client Model revision 1のCredential例外契約として使用する。
 * @concurrency 最新の操作結果一件だけを扱う。
 */
export type WorkbenchCredentialAdministrationView = Readonly<{
  state: "not_configured" | "unavailable" | "available";
  credentials: readonly WorkbenchCredentialMetadataView[];
  result: CredentialAdministrationResult | null;
}>;

/**
 * Workbenchの主画面を一回描画できる閉じたBrowser Read Model。
 * @responsibility Main Viewの全表示値、用途限定Tokenおよび操作結果の型境界を所有する。
 * @trace ARCH-000012
 * @shape contract、view、actionToken、各Surface、Queryおよび一回表示結果で構成する。
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
  repositoryResult: ChangePublicationResult | null;
  worktree: Readonly<{
    state: "available" | "unknown";
    tree: RepositoryWorktreeTreePage | null;
    diff: RepositoryWorktreeFileDiff | null;
  }>;
  credentials: WorkbenchCredentialAdministrationView;
  aiProfiles: WorkbenchAiProfileSurface;
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
}>;

/**
 * Workbench Browserが描画できる全View ModelのUnion。
 * @responsibility view discriminantと対応する表示Modelの閉集合を定義する。
 * @trace ARCH-000012
 * @shape main、project-detailおよびrecord-detailの判別可能Unionである。
 * @invariant 全variantが同じcontract revisionを使用する。
 * @boundary JSON Runtime InspectorとWorkbenchAppの判別境界。
 * @security 未知viewをUnionへ受理しない。
 * @compatibility contract `crdd/workbench/client-model/v1`に固定する。
 */
export type WorkbenchClientModel =
  | WorkbenchMainViewModel
  | WorkbenchProjectDetailViewModel
  | WorkbenchRecordDetailViewModel;

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
      !isRecordDocumentView(value.record)
    )
      throw new Error("workbench_client_model_invalid");
    return value as WorkbenchRecordDetailViewModel;
  }
  throw new Error("workbench_client_model_invalid");
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
 * Project Contextの五場面をReactが描画できる構造として検査する。
 * @responsibility 場面、表Headerおよび全Cellの型を描画前に確定する。
 * @trace ARCH-000012
 * @input valueに未知のProject Context候補を受け取る。
 * @returns 描画に必要な全Fieldが成立する場合だけtrueを返す。
 * @precondition N/A: JSON由来の未知値を受け取る。
 * @postcondition trueではscenes、columnsおよびrowsを安全に反復できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 未知の場面Keyを受理しない。
 * @boundary Project Context JSONとReact Sceneの境界。
 * @security 表CellをTextとしてのみ検査する。
 * @concurrency N/A: 同期純粋処理である。
 */
function isProjectContext(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.projectId !== "string" ||
    typeof value.repositoryId !== "string" ||
    typeof value.repositoryRole !== "string" ||
    !Array.isArray(value.scenes)
  )
    return false;
  const expectedKeys = ["current", "risk", "decision", "reason", "next"];
  if (
    value.scenes.length !== expectedKeys.length ||
    value.scenes.some(
      (scene, index) => !isRecord(scene) || scene.key !== expectedKeys[index],
    )
  )
    return false;
  return value.scenes.every((scene) => {
    if (!isRecord(scene) || !isRecord(scene.table)) return false;
    const table = scene.table;
    if (!isStringArray(table.columns) || !Array.isArray(table.rows))
      return false;
    const columnCount = table.columns.length;
    return (
      typeof scene.title === "string" &&
      isNullableString(scene.summary) &&
      table.rows.every(
        (row) => isStringArray(row) && row.length === columnCount,
      )
    );
  });
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
 * Portfolio内のProjectとSourceを描画可能な形として検査する。
 * @responsibility Source配列、状態、Roleおよび任意Contextの相関を確認する。
 * @trace ARCH-000012
 * @input valueに未知のFederated Project候補を受け取る。
 * @returns Project DetailとPortfolio一覧が安全に描画できる場合だけtrueを返す。
 * @precondition N/A: JSON由来の未知値を受け取る。
 * @postcondition trueではsourcesを安全に反復できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 非complete SourceへContextを補完しない。
 * @boundary CROS Portfolio JSONとReact表示の境界。
 * @security 非開示Sourceを生成しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isFederatedProject(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.projectId !== "string" ||
    !["complete", "partial", "conflicting"].includes(String(value.state)) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0
  )
    return false;
  const repositoryIds: string[] = [];
  for (const source of value.sources) {
    if (
      !isRecord(source) ||
      typeof source.repositoryId !== "string" ||
      typeof source.revision !== "string" ||
      !["complete", "missing", "conflicting"].includes(String(source.state)) ||
      !isNullableString(source.repositoryRole)
    )
      return false;
    repositoryIds.push(source.repositoryId);
    if (source.state === "complete") {
      if (
        typeof source.repositoryRole !== "string" ||
        !isProjectContext(source.context) ||
        !isRecord(source.context) ||
        source.context.projectId !== value.projectId ||
        source.context.repositoryId !== source.repositoryId ||
        source.context.repositoryRole !== source.repositoryRole
      )
        return false;
    } else if (source.context !== null || source.repositoryRole !== null) {
      return false;
    }
  }
  if (
    repositoryIds.some((repositoryId, index) => {
      const sortedRepositoryIds = [...repositoryIds].sort((left, right) =>
        left.localeCompare(right),
      );
      return repositoryId !== sortedRepositoryIds[index];
    }) ||
    new Set(repositoryIds).size !== repositoryIds.length
  )
    return false;
  const derivedState = value.sources.some(
    (source) => isRecord(source) && source.state === "conflicting",
  )
    ? "conflicting"
    : value.sources.every(
          (source) => isRecord(source) && source.state === "complete",
        )
      ? "complete"
      : "partial";
  return value.state === derivedState;
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
  const catalogIsValid = (candidate: unknown): boolean =>
    isRecord(candidate) &&
    candidate.contract === "crdd/ai-profile-catalog" &&
    candidate.contractRevision === 1 &&
    Array.isArray(candidate.adapters) &&
    candidate.adapters.every(
      (adapter) =>
        isRecord(adapter) &&
        typeof adapter.adapterId === "string" &&
        ["codex", "claude"].includes(String(adapter.provider)) &&
        ["chatgpt_subscription_oauth", "claude_max"].includes(
          String(adapter.offering),
        ) &&
        typeof adapter.authorityOrigin === "string" &&
        isStringArray(adapter.allowedModelIds) &&
        isStringArray(adapter.allowedReasoningEfforts),
    ) &&
    Array.isArray(candidate.profiles) &&
    candidate.profiles.every(
      (profile) =>
        isRecord(profile) &&
        typeof profile.profileId === "string" &&
        typeof profile.adapterId === "string" &&
        typeof profile.family === "string" &&
        typeof profile.exactModelId === "string" &&
        isStringArray(profile.selectionRoles) &&
        profile.selectionRoles.every((role) =>
          [
            "coordinator",
            "executor",
            "independent_reviewer",
            "result_integration",
          ].includes(role),
        ) &&
        isStringArray(profile.modelTiers) &&
        profile.modelTiers.every((tier) =>
          ["preferred", "upper_allowed"].includes(tier),
        ) &&
        profile.speedMode === "normal" &&
        profile.billingMode === "subscription_oauth" &&
        ["low", "medium", "high", "xhigh", "max"].includes(
          String(profile.defaultReasoningEffort),
        ) &&
        isNullableString(profile.compatibilityReason),
    );
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
    ["repository", "cros_available", "cros_unavailable"].includes(
      String(value.connection.state),
    ) &&
    isNullableString(value.connection.endpoint) &&
    (value.connection.notice === null ||
      (isRecord(value.connection.notice) &&
        ["completed", "rejected"].includes(
          String(value.connection.notice.status),
        ) &&
        typeof value.connection.notice.message === "string")) &&
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
    isRecord(value.credentials) &&
    ["not_configured", "unavailable", "available"].includes(
      String(value.credentials.state),
    ) &&
    Array.isArray(value.credentials.credentials) &&
    value.credentials.credentials.every(
      (credential) =>
        isRecord(credential) &&
        typeof credential.credentialId === "string" &&
        ["administrator", "management", "developer"].includes(
          String(credential.profile),
        ) &&
        isStringArray(credential.workspaceIds) &&
        typeof credential.systemAdmin === "boolean" &&
        typeof credential.revoked === "boolean",
    ) &&
    (value.credentials.result === null ||
      (isRecord(value.credentials.result) &&
        ["completed", "blocked"].includes(
          String(value.credentials.result.status),
        ) &&
        typeof value.credentials.result.reason === "string" &&
        isNullableString(value.credentials.result.token))) &&
    isRecord(value.aiProfiles) &&
    catalogIsValid(catalog) &&
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
          typeof observation.availability.executionAuthorized === "boolean"),
    ) &&
    isRecord(aiAdministration) &&
    ["Repository", "CROS"].includes(String(aiAdministration.owner)) &&
    (snapshot === null ||
      (isRecord(snapshot) &&
        typeof snapshot.revision === "number" &&
        Number.isSafeInteger(snapshot.revision) &&
        snapshot.revision >= 0 &&
        catalogIsValid(snapshot.catalog))) &&
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
        catalogIsValid(aiAdministration.result.snapshot.catalog))) &&
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
