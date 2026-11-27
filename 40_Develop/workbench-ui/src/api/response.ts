/**
 * Workbench UIが受け取るHTTP応答の純粋検査。
 * @packageDocumentation
 * @responsibility 未知の表示JSONを既存の閉じた受理条件で確認する。
 * @trace ARCH-000012
 * @boundary Workbenchの非秘密表示契約とBrowser／Serverの境界。
 * @effect N/A: 純粋な検査だけで通信・保存を行わない。
 * @security 資格・認可Authorityを新設せず、既存の秘密非搬送と受理条件を維持する。
 */

import type {
  AiSelectionReadResult,
  AiSelectionSnapshot,
} from "@qual-lab/crdd-configuration-model";
import type { FederatedProjectProjection } from "@qual-lab/crdd-document-model";
import type {
  AiRequestSnapshot,
  ExecutionActivityObservation,
  ManagementResult,
  ManagementView,
  ProjectPageResponse,
  ViewResponse,
} from "@qual-lab/crdd-server";
import { RESOURCE_ID, UUID_V4 } from "./path.ts";

export type {
  AiRequestMode,
  AiRequestSnapshot,
  AiResultItem,
  AiSelectionView,
  ManagementResult,
  ManagementView,
  OwnerArtifactCatalog,
  ProjectPlanObservation,
  ProjectQualityObservation,
  ViewResponse,
} from "@qual-lab/crdd-server";

// 各画面の型は公開された応答から取り出し、別の通信仕様を定義しない。
export type AccessViewResponse = Extract<ViewResponse, { view: "access" }>;
export type GitHostConnectionView = Readonly<{
  id: string;
  host: string;
  displayName: string;
  connected: boolean;
}>;

export function validateGitHostConnections(
  value: unknown,
): readonly GitHostConnectionView[] {
  if (
    !isRecord(value) ||
    Object.keys(value).join(",") !== "hosts" ||
    !Array.isArray(value.hosts) ||
    value.hosts.length > 16
  )
    throw new Error("git_hosts_response_invalid");
  const ids = new Set<string>();
  const hosts = new Set<string>();
  return value.hosts.map((item: unknown) => {
    if (
      !isRecord(item) ||
      Object.keys(item).sort().join(",") !== "connected,displayName,host,id" ||
      typeof item.id !== "string" ||
      !/^[a-z0-9][a-z0-9.-]{0,285}$/u.test(item.id) ||
      ids.has(item.id) ||
      typeof item.host !== "string" ||
      item.host.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(
        item.host,
      ) ||
      hosts.has(item.host) ||
      typeof item.displayName !== "string" ||
      !item.displayName ||
      item.displayName.length > 128 ||
      typeof item.connected !== "boolean"
    )
      throw new Error("git_hosts_response_invalid");
    ids.add(item.id);
    hosts.add(item.host);
    return {
      id: item.id,
      host: item.host,
      displayName: item.displayName,
      connected: item.connected,
    };
  });
}
export type ArtifactViewResponse = Extract<ViewResponse, { view: "artifact" }>;
export type MainViewResponse = Extract<ViewResponse, { view: "main" }>;
export type ProjectDetailResponse = Extract<
  ViewResponse,
  { view: "project-detail" }
>;
export type RecordDetailResponse = Extract<
  ViewResponse,
  { view: "record-detail" }
>;
export type RecordDocumentView = RecordDetailResponse["record"];
/** 一件の記録操作を画面に通知する値。Serverの表示応答には含めない。 */
export type RecordActionView = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  relationPaths: readonly string[];
  recordKind: "topic" | "meeting" | null;
}>;

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
      ["read_only_advice", "workspace_edit"].includes(
        String(candidate.mode),
      )) &&
    (candidate.executionSelection === null ||
      (isRecord(candidate.executionSelection) &&
        typeof candidate.executionSelection.modelIdentifier === "string" &&
        ["codex", "claude"].includes(
          String(candidate.executionSelection.provider),
        ))) &&
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
    typeof candidate.resultAvailable === "boolean" &&
    aiResultItemsAreValid(candidate.sharedAnalysis) &&
    aiResultItemsAreValid(candidate.additionalInferences) &&
    aiResultItemsAreValid(candidate.nextOptions) &&
    candidate.candidate === null &&
    (candidate.workspaceResult === undefined ||
      candidate.workspaceResult === null ||
      (isRecord(candidate.workspaceResult) &&
        Object.keys(candidate.workspaceResult).sort().join(",") ===
          "canonicalRepositoryChanged,changeAttribution,changedPaths,workspaceDeletionIssued,workspaceId" &&
        isNullableString(candidate.workspaceResult.workspaceId) &&
        (candidate.workspaceResult.changedPaths === null ||
          isStringArray(candidate.workspaceResult.changedPaths)) &&
        (candidate.workspaceResult.canonicalRepositoryChanged === null ||
          typeof candidate.workspaceResult.canonicalRepositoryChanged ===
            "boolean") &&
        candidate.workspaceResult.changeAttribution === "unattributed" &&
        candidate.workspaceResult.workspaceDeletionIssued === false)) &&
    (candidate.cleanupConfirmed === undefined ||
      typeof candidate.cleanupConfirmed === "boolean") &&
    (candidate.recoveryIds === undefined ||
      isStringArray(candidate.recoveryIds)) &&
    (candidate.secondaryFailures === undefined ||
      isStringArray(candidate.secondaryFailures)));

/**
 * 進行照会のJSONを既存のAI依頼の結果契約で検査する。
 * @trace ARCH-000015
 * @boundary HTTP応答からBrowserの現在依頼表示。
 */
export function validateAiRequestSnapshot(value: unknown): AiRequestSnapshot {
  if (value === null || !aiSnapshotIsValid(value))
    throw new Error("workbench_ai_request_observation_invalid");
  return value as AiRequestSnapshot;
}
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
export function validateViewResponse(value: unknown): ViewResponse {
  if (!isRecord(value) || value.contract !== "crdd/workbench/view/v1")
    throw new Error("workbench_client_model_invalid");
  if (value.view === "access") {
    const loginProviders = value.loginProviders;
    if (
      Object.keys(value).sort().join(",") !==
        (loginProviders !== undefined
          ? "actionToken,authenticated,contract,loginProviders,view"
          : "actionToken,authenticated,contract,view") ||
      typeof value.actionToken !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/u.test(value.actionToken) ||
      typeof value.authenticated !== "boolean" ||
      (loginProviders !== undefined &&
        (!Array.isArray(loginProviders) ||
          loginProviders.length === 0 ||
          !loginProviders.every(
            (provider) =>
              isRecord(provider) &&
              Object.keys(provider).sort().join(",") === "displayName,id" &&
              typeof provider.id === "string" &&
              /^[a-z0-9-]{1,32}$/u.test(provider.id) &&
              typeof provider.displayName === "string" &&
              provider.displayName.length > 0 &&
              provider.displayName.length <= 128,
          ) ||
          new Set(loginProviders.map(({ id }) => id)).size !==
            loginProviders.length))
    )
      throw new Error("workbench_client_model_invalid");
    return value as AccessViewResponse;
  }
  if (value.view === "main") {
    if (typeof value.actionToken !== "string" || !isMainViewResponse(value))
      throw new Error("workbench_client_model_invalid");
    return value as MainViewResponse;
  }
  if (value.view === "project-detail") {
    if (!isFederatedProject(value.project))
      throw new Error("workbench_client_model_invalid");
    return value as ProjectDetailResponse;
  }
  if (value.view === "record-detail") {
    if (
      !isNullableString(value.repositoryId) ||
      typeof value.operationRepositoryId !== "string" ||
      !RESOURCE_ID.test(value.operationRepositoryId) ||
      (value.repositoryId !== null &&
        value.repositoryId !== value.operationRepositoryId) ||
      typeof value.recordActionsConfigured !== "boolean" ||
      !isRecordDocumentView(value.record)
    )
      throw new Error("workbench_client_model_invalid");
    return value as RecordDetailResponse;
  }
  if (value.view === "artifact") return validateArtifactResponse(value);
  throw new Error("workbench_client_model_invalid");
}

/** Project一覧の要約と、明示したRepository範囲の一致を検査する。 */
export function validateProjectPage(
  value: unknown,
  repositoryId: string | null,
): ProjectPageResponse {
  // 順序はServerの正本。Browserの言語設定で並べ替えたり拒否したりしない。
  const unique = (ids: readonly unknown[]) => new Set(ids).size === ids.length;
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !==
      "cursorInvalid,nextCursor,projects,retainedAsSourceOfTruth" ||
    value.retainedAsSourceOfTruth !== false ||
    !isNullableString(value.nextCursor) ||
    typeof value.cursorInvalid !== "boolean" ||
    !Array.isArray(value.projects) ||
    value.projects.length > 20 ||
    !value.projects.every((project: unknown) => {
      if (
        !isRecord(project) ||
        Object.keys(project).sort().join(",") !==
          "projectId,repositoryIds,sourceCount,sources,state" ||
        typeof project.projectId !== "string" ||
        !RESOURCE_ID.test(project.projectId) ||
        typeof project.state !== "string" ||
        !["complete", "partial", "conflicting"].includes(project.state) ||
        !Array.isArray(project.sources) ||
        !Array.isArray(project.repositoryIds) ||
        project.sources.length === 0 ||
        project.sourceCount !== project.sources.length ||
        project.repositoryIds.length !== project.sources.length
      )
        return false;
      const repositoryIds = project.repositoryIds;
      const validSources = project.sources.every(
        (source: unknown, index: number) =>
          isRecord(source) &&
          Object.keys(source).sort().join(",") === "repositoryId,state" &&
          typeof source.repositoryId === "string" &&
          RESOURCE_ID.test(source.repositoryId) &&
          source.repositoryId === repositoryIds[index] &&
          (repositoryId === null || source.repositoryId === repositoryId) &&
          typeof source.state === "string" &&
          ["complete", "missing", "unavailable", "conflicting"].includes(
            source.state,
          ),
      );
      if (!validSources || !unique(repositoryIds)) return false;
      const states = project.sources.map(({ state }) => state);
      return (
        project.state ===
        (states.includes("conflicting")
          ? "conflicting"
          : states.every((state) => state === "complete")
            ? "complete"
            : "partial")
      );
    }) ||
    !unique(value.projects.map((project) => project.projectId)) ||
    (value.cursorInvalid &&
      (value.nextCursor !== null || value.projects.length !== 0))
  )
    throw new Error("workbench_project_page_invalid");
  return value as ProjectPageResponse;
}

/** 記録リソースを要求対象と照合し、Workbench表示へ投影する。 @trace ARCH-000012 */
export function validateRecordResource(
  value: unknown,
  repositoryId: string,
  kind: "topic" | "meeting",
  id: string,
): ViewResponse {
  if (
    !isRecord(value) ||
    value.status !== "completed" ||
    value.repositoryId !== repositoryId ||
    typeof value.writable !== "boolean" ||
    (value.relationScope !== undefined && value.relationScope !== "repository")
  )
    throw new Error("workbench_client_model_unavailable");
  return validateViewResponse({
    contract: "crdd/workbench/view/v1",
    view: "record-detail",
    repositoryId: value.relationScope === "repository" ? repositoryId : null,
    operationRepositoryId: repositoryId,
    recordActionsConfigured: value.writable,
    record: {
      kind,
      id,
      document: { record: value.record, markdown: value.markdown },
      relations: value.relations,
    },
  });
}

/** 共通入口の狭い応答から、起動先または未ログイン案内だけを受け取る。 @trace ARCH-000012 */
export function validateWorkbenchContext(
  value: unknown,
):
  | { mode: "single"; repositoryId: string }
  | { mode: "shared"; login: AccessViewResponse | null } {
  if (!isRecord(value) || value.contract !== "crdd/workbench/context/v1")
    throw new Error("workbench_context_invalid");
  if (
    value.mode === "single" &&
    Object.keys(value).sort().join(",") === "contract,mode,repositoryId" &&
    typeof value.repositoryId === "string" &&
    RESOURCE_ID.test(value.repositoryId)
  )
    return { mode: "single", repositoryId: value.repositoryId };
  if (
    value.mode !== "shared" ||
    Object.keys(value).sort().join(",") !== "contract,login,mode"
  )
    throw new Error("workbench_context_invalid");
  if (value.login === null) return { mode: "shared", login: null };
  const login = validateViewResponse(value.login);
  if (login.view !== "access" || login.authenticated)
    throw new Error("workbench_context_invalid");
  return { mode: "shared", login };
}

/** 成果物リソースの出所と選択を照合し、画面の戻り先を構成する。 @trace ARCH-000016 */
export function validateArtifactResource(
  value: unknown,
  repositoryId: string,
  kind: "change" | "owner",
  identity: string,
): ArtifactViewResponse {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !==
      "identity,kind,markdown,repositoryId,scope" ||
    value.repositoryId !== repositoryId ||
    value.kind !== kind ||
    value.identity !== identity ||
    (value.scope !== "single" && value.scope !== "shared")
  )
    throw new Error("workbench_client_model_unavailable");
  return validateArtifactResponse({
    contract: "crdd/workbench/view/v1",
    view: "artifact",
    repositoryId,
    selectedRepositoryId: value.scope === "shared" ? repositoryId : null,
    artifact: { kind, identity, markdown: value.markdown },
  });
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
 * @failure 不正外形・種別・Identityは固定例外。
 * @invariant 表示検査をRoot認可やFile安全性の証明へ使わない。
 * @boundary Reader JSONとReact表示。
 * @security Root・Token等の余剰fieldを拒否する。
 * @concurrency N/A: 一Snapshotの同期検査。
 */
function validateArtifactResponse(value: unknown): ArtifactViewResponse {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !==
      "artifact,contract,repositoryId,selectedRepositoryId,view" ||
    value.contract !== "crdd/workbench/view/v1" ||
    value.view !== "artifact" ||
    typeof value.repositoryId !== "string" ||
    !RESOURCE_ID.test(value.repositoryId) ||
    !isNullableString(value.selectedRepositoryId) ||
    (value.selectedRepositoryId !== null &&
      value.selectedRepositoryId !== value.repositoryId) ||
    !isRecord(value.artifact) ||
    Object.keys(value.artifact).sort().join(",") !== "identity,kind,markdown" ||
    typeof value.artifact.identity !== "string" ||
    typeof value.artifact.markdown !== "string"
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
      !identity.endsWith(".md") ||
      identity.startsWith("/") ||
      identity.includes("\\") ||
      identity.includes("\0") ||
      /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(identity) ||
      identity.split("/").some((part) => part === ".." || part === "")
    )
      throw new Error("workbench_client_model_invalid");
  } else throw new Error("workbench_client_model_invalid");
  return value as ArtifactViewResponse;
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

/** 表示する実行の識別と、状態が不明な行を区別する。 @trace ARCH-000012 */
function activityGraphsAreValid(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((row: unknown) => {
    if (
      !isRecord(row) ||
      typeof row.repositoryId !== "string" ||
      typeof row.queueId !== "string" ||
      typeof row.milestoneId !== "string" ||
      !isNullableString(row.workspaceId) ||
      ![
        row.repositoryId,
        row.queueId,
        row.milestoneId,
        ...(row.workspaceId === null ? [] : [row.workspaceId]),
      ].every((id) => RESOURCE_ID.test(id)) ||
      (row.progress !== null &&
        (!isRecord(row.progress) ||
          typeof row.progress.milestoneState !== "string" ||
          typeof row.progress.workProgress !== "string" ||
          typeof row.progress.nextAction !== "string"))
    )
      return false;
    const id = `${row.repositoryId}\0${row.queueId}`;
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
}

/** 専用APIの読取り結果を、選択したProjectとRepositoryに照合する。 */
export function validateExecutionActivity(
  value: unknown,
  projectId: string,
  repositoryId: string,
): ExecutionActivityObservation {
  const ownsRows = (items: unknown) =>
    Array.isArray(items) &&
    items.every(
      (row: unknown) => isRecord(row) && row.repositoryId === repositoryId,
    );
  const invalid = () => new Error("workbench_activity_response_invalid");
  if (
    !isRecord(value) ||
    value.projectId !== projectId ||
    (value.state !== "observed" &&
      value.state !== "absent" &&
      value.state !== "unknown") ||
    value.reason !== `runtime_activity_state_${value.state}` ||
    (value.eventState !== "observed" && value.eventState !== "unknown") ||
    value.eventReason !== `runtime_activity_events_${value.eventState}` ||
    !isNullableString(value.eventContinuation) ||
    !ownsRows(value.sources) ||
    !Array.isArray(value.sources) ||
    value.sources.length !== 1 ||
    !Array.isArray(value.events) ||
    !ownsRows(value.events) ||
    value.events.length > 20 ||
    !activityGraphsAreValid(value.graphs) ||
    (value.graphs !== undefined && !ownsRows(value.graphs)) ||
    (value.singleTasks !== undefined && !ownsRows(value.singleTasks))
  )
    throw invalid();
  if (value.state === "observed") {
    const projection = value.projection;
    if (
      value.currentSourceRepositoryId !== repositoryId ||
      !isRecord(projection) ||
      projection.projectId !== projectId ||
      ![
        projection.milestoneId,
        projection.milestoneState,
        projection.workProgress,
        projection.nextAction,
      ].every((item) => typeof item === "string")
    )
      throw invalid();
  } else if (
    value.projection !== null ||
    value.currentSourceRepositoryId !== null
  )
    throw invalid();
  if (
    (value.eventState === "unknown" &&
      (value.events.length > 0 || value.eventContinuation !== null)) ||
    !value.events.every(
      (event) =>
        typeof event.eventId === "string" &&
        typeof event.occurredAt === "string" &&
        typeof event.status === "string" &&
        ["completed", "blocked", "cancelled", "unknown"].includes(
          event.status,
        ) &&
        typeof event.reason === "string" &&
        typeof event.objectiveId === "string" &&
        typeof event.taskId === "string",
    ) ||
    (Array.isArray(value.singleTasks) &&
      !value.singleTasks.every(
        (task) =>
          typeof task.requestId === "string" &&
          (task.mode === "read_only_advice" ||
            task.mode === "workspace_edit") &&
          typeof task.phase === "string" &&
          typeof task.status === "string" &&
          typeof task.cleanupConfirmed === "boolean" &&
          typeof task.recoveryRequired === "boolean",
      ))
  )
    throw invalid();
  return value as ExecutionActivityObservation;
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

const mainViewFields = new Set<string>([
  "contract",
  "view",
  "actionToken",
  "projectData",
  "portfolioAvailable",
  "connection",
  "topicPage",
  "topicQuery",
  "meetingPage",
  "meetingQuery",
  "recordDocuments",
  "selectedRepositoryId",
  "recordActionsConfigured",
  "repositoryActions",
  "workspaceAccess",
  "aiSelection",
  "aiSelectionManagement",
  "aiRequest",
] satisfies readonly (keyof MainViewResponse)[]);

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
function isMainViewResponse(value: Record<string, unknown>): boolean {
  if (Object.keys(value).some((field) => !mainViewFields.has(field)))
    return false;
  const projectData = value.projectData;
  const ownerArtifacts = isRecord(projectData)
    ? projectData.ownerArtifacts
    : null;
  const collectionIsValid = (
    candidate: unknown,
    kind: "topic" | "meeting",
  ): boolean =>
    isRecord(candidate) &&
    ["available", "not_configured", "unknown"].includes(
      String(candidate.state),
    ) &&
    Array.isArray(candidate.items) &&
    candidate.items.every((record) => isOperationRecord(record, kind)) &&
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
  const recordPageIsValid = (
    page: unknown,
    query: unknown,
    kind: "topic" | "meeting",
  ): boolean =>
    isRecord(page) &&
    ["available", "not_configured"].includes(String(page.status)) &&
    Array.isArray(page.records) &&
    page.records.every((record) => isOperationRecord(record, kind)) &&
    isNullableString(page.nextCursor) &&
    isRecord(query) &&
    (query.query === undefined || typeof query.query === "string") &&
    (query.states === undefined || isStringArray(query.states)) &&
    (query.owner === undefined || typeof query.owner === "string") &&
    (query.relation === undefined || typeof query.relation === "string") &&
    (query.occurredFrom === undefined ||
      typeof query.occurredFrom === "string") &&
    (query.occurredTo === undefined || typeof query.occurredTo === "string") &&
    (query.pendingOnly === undefined ||
      typeof query.pendingOnly === "boolean") &&
    (query.sort === undefined ||
      ["id_asc", "title_asc", "state_asc", "occurred_desc"].includes(
        String(query.sort),
      ));
  const aiAdministration = value.aiSelectionManagement;
  const snapshot = isRecord(aiAdministration)
    ? aiAdministration.snapshot
    : null;
  const planStateIsValid =
    isRecord(projectData) &&
    isRecord(projectData.plan) &&
    ((projectData.plan.state === "available" &&
      projectData.plan.projection !== null &&
      projectData.plan.reason === null) ||
      (projectData.plan.state === "not_configured" &&
        projectData.plan.projection === null &&
        projectData.plan.reason === null) ||
      (projectData.plan.state === "unknown" &&
        projectData.plan.projection === null &&
        ["release_projection_invalid", "observation_failed"].includes(
          String(projectData.plan.reason),
        )));
  const qualityStateIsValid =
    isRecord(projectData) &&
    isRecord(projectData.quality) &&
    ((projectData.quality.state === "available" &&
      projectData.quality.projection !== null &&
      projectData.quality.reason === null) ||
      (projectData.quality.state === "not_configured" &&
        projectData.quality.projection === null &&
        projectData.quality.reason === null) ||
      (projectData.quality.state === "unknown" &&
        projectData.quality.projection === null &&
        ["quality_projection_invalid", "observation_failed"].includes(
          String(projectData.quality.reason),
        )));
  return (
    isRecord(projectData) &&
    isProjectContext(projectData.context) &&
    collectionIsValid(projectData.topics, "topic") &&
    collectionIsValid(projectData.meetings, "meeting") &&
    isRecord(projectData.plan) &&
    planStateIsValid &&
    ["available", "not_configured", "unknown"].includes(
      String(projectData.plan.state),
    ) &&
    (projectData.plan.projection === null ||
      (isRecord(projectData.plan.projection) &&
        typeof projectData.plan.projection.publishedBaseline === "string" &&
        typeof projectData.plan.projection.targetVersion === "string" &&
        isNullableString(projectData.plan.projection.targetReleaseDate) &&
        typeof projectData.plan.projection.workState === "string" &&
        typeof projectData.plan.projection.releaseDecision === "string" &&
        typeof projectData.plan.projection.scheduleRisk === "string" &&
        Array.isArray(projectData.plan.projection.scope) &&
        projectData.plan.projection.scope.every(
          (item) =>
            isRecord(item) &&
            typeof item.stage === "string" &&
            typeof item.scope === "string" &&
            typeof item.state === "string" &&
            typeof item.owner === "string",
        ) &&
        Array.isArray(projectData.plan.projection.dependencies) &&
        projectData.plan.projection.dependencies.every(
          (item) =>
            isRecord(item) &&
            typeof item.item === "string" &&
            typeof item.state === "string" &&
            typeof item.next === "string",
        ))) &&
    isRecord(projectData.quality) &&
    qualityStateIsValid &&
    ["available", "not_configured", "unknown"].includes(
      String(projectData.quality.state),
    ) &&
    (projectData.quality.projection === null ||
      (isRecord(projectData.quality.projection) &&
        typeof projectData.quality.projection.overallState === "string" &&
        typeof projectData.quality.projection.target === "string" &&
        typeof projectData.quality.projection.observed === "string" &&
        typeof projectData.quality.projection.unobserved === "string" &&
        typeof projectData.quality.projection.knownGap === "string" &&
        typeof projectData.quality.projection.nextGate === "string" &&
        typeof projectData.quality.projection.humanDecision === "string" &&
        isRecord(projectData.quality.projection.rationale) &&
        Object.values(projectData.quality.projection.rationale).every(
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
    isRecord(projectData.repository) &&
    ["available", "unknown"].includes(String(projectData.repository.state)) &&
    ((projectData.repository.state === "available" &&
      projectData.repository.reason === null &&
      projectData.repository.changeSet !== null &&
      projectData.repository.publicationTarget !== null) ||
      (projectData.repository.state === "unknown" &&
        ["repository_root_invalid", "observation_failed"].includes(
          String(projectData.repository.reason),
        ) &&
        projectData.repository.changeSet === null &&
        projectData.repository.publicationTarget === null)) &&
    (projectData.repository.changeSet === null ||
      (isRecord(projectData.repository.changeSet) &&
        projectData.repository.changeSet.contract ===
          "crdd-version-control/local-change-set/v1" &&
        projectData.repository.changeSet.contractRevision === 1 &&
        isStringArray(projectData.repository.changeSet.revisionChanges) &&
        isStringArray(projectData.repository.changeSet.preparedChanges) &&
        isStringArray(projectData.repository.changeSet.workingChanges) &&
        isStringArray(projectData.repository.changeSet.unregisteredPaths) &&
        projectData.repository.changeSet.observationComplete === true &&
        projectData.repository.changeSet.repositoryPathReported === false)) &&
    (projectData.repository.publicationTarget === null ||
      (isRecord(projectData.repository.publicationTarget) &&
        ["available", "not_configured", "unknown"].includes(
          String(projectData.repository.publicationTarget.status),
        ) &&
        typeof projectData.repository.publicationTarget.reason === "string" &&
        isNullableString(
          projectData.repository.publicationTarget.destination,
        ) &&
        isNullableString(projectData.repository.publicationTarget.branch) &&
        isNullableString(
          projectData.repository.publicationTarget.localBranch,
        ) &&
        isNullableString(
          projectData.repository.publicationTarget.revisionIdentity,
        ))) &&
    isNullableString(projectData.repository.reason) &&
    recordPageIsValid(value.topicPage, value.topicQuery, "topic") &&
    recordPageIsValid(value.meetingPage, value.meetingQuery, "meeting") &&
    Array.isArray(value.recordDocuments) &&
    value.recordDocuments.every(isRecordDocumentView) &&
    isNullableString(value.selectedRepositoryId) &&
    typeof value.recordActionsConfigured === "boolean" &&
    Array.isArray(value.repositoryActions) &&
    value.repositoryActions.every((operation) =>
      ["prepare", "unprepare", "create_revision", "publish_revision"].includes(
        operation,
      ),
    ) &&
    new Set(value.repositoryActions).size === value.repositoryActions.length &&
    (value.workspaceAccess === undefined ||
      ((value.workspaceAccess === "write"
        ? value.repositoryActions.every(
            (operation) => operation === "prepare" || operation === "unprepare",
          )
        : value.repositoryActions.length === 0) &&
        isRecord(value.connection) &&
        value.connection.state === "cros_available" &&
        typeof value.selectedRepositoryId === "string" &&
        isRecord(projectData.context) &&
        value.selectedRepositoryId === projectData.context.repositoryId &&
        (value.workspaceAccess === "read" ||
          value.workspaceAccess === "write" ||
          value.workspaceAccess === "unavailable"))) &&
    typeof value.portfolioAvailable === "boolean" &&
    isRecord(value.connection) &&
    Object.keys(value.connection).join(",") === "state" &&
    ["repository", "cros_available"].includes(String(value.connection.state)) &&
    (value.aiSelection === null ||
      isWorkbenchSelectionSurface(value.aiSelection)) &&
    isRecord(aiAdministration) &&
    typeof aiAdministration.allowed === "boolean" &&
    (snapshot === null || isWorkbenchSelectionSnapshot(snapshot)) &&
    (aiAdministration.result === null ||
      (isRecord(aiAdministration.result) &&
        ["saved", "conflict", "blocked", "unknown"].includes(
          String(aiAdministration.result.status),
        ))) &&
    isRecord(value.aiRequest) &&
    typeof value.aiRequest.configured === "boolean" &&
    (value.aiRequest.additionalHosts === null ||
      (Array.isArray(value.aiRequest.additionalHosts) &&
        value.aiRequest.additionalHosts.length <= 32 &&
        value.aiRequest.additionalHosts.every(
          (host: unknown) => typeof host === "string" && host.length <= 253,
        ))) &&
    aiSnapshotIsValid(value.aiRequest.snapshot) &&
    isNullableString(value.aiRequest.notice)
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
 * 設定Snapshotの表示に必要な閉構造を検査する。
 * @responsibility 意味検証や保存をBrowserで再実装せず、描画対象だけを検査する。
 * @trace ARCH-000012
 * @input JSON由来の未知値。
 * @returns 設定Snapshot又は固定例外。
 * @precondition HTTP成功をCallerが確認済み。
 * @postcondition 五役割・分類辞書の描画が可能。
 * @effect N/A: メモリ値だけ。
 * @failure 不正外形を未設定へ変えない。
 * @invariant Serverの技術Catalog照合・認可を代替しない。
 * @boundary HTTP JSONとBrowser表示。
 * @security 実行・保存・Root解決なし。
 * @concurrency 同期の表示検査。
 */
export function validateAiSelectionSnapshot(
  value: unknown,
): AiSelectionSnapshot {
  const roles = [
    "coordinator",
    "executor",
    "independent_reviewer",
    "result_integration",
    "advice",
  ];
  const choice = (v: unknown) =>
    isRecord(v) &&
    Object.keys(v).sort().join(",") === "effort,model,provider" &&
    ["codex", "claude"].includes(String(v.provider)) &&
    typeof v.model === "string" &&
    ["low", "medium", "high", "xhigh", "max"].includes(String(v.effort));
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "config,identity" ||
    typeof value.identity !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.identity) ||
    !isRecord(value.config)
  )
    throw new Error("workbench_selection_response_invalid");
  const config = value.config;
  if (
    Object.keys(config).sort().join(",") !==
      "contract,overrides,revision,roleDefaults,workTypes" ||
    config.contract !== "crdd/ai-selection" ||
    config.revision !== 1 ||
    !isRecord(config.roleDefaults) ||
    Object.keys(config.roleDefaults).sort().join(",") !==
      roles.toSorted().join(",") ||
    !Object.values(config.roleDefaults).every(choice) ||
    !isRecord(config.workTypes) ||
    !Object.values(config.workTypes).every(
      (v) =>
        isRecord(v) &&
        Object.keys(v).join(",") === "label" &&
        typeof v.label === "string",
    ) ||
    !isRecord(config.overrides) ||
    !Object.entries(config.overrides).every(
      ([role, entries]) =>
        roles.includes(role) &&
        isRecord(entries) &&
        Object.values(entries).every(choice),
    )
  )
    throw new Error("workbench_selection_response_invalid");
  return value as AiSelectionSnapshot;
}

/**
 * 取得結果の不在・拒否・設定値を分けて検査する。
 * @responsibility 未設定と観測不能を混同しない。
 * @trace ARCH-000012
 * @input 未知の取得JSON。
 * @returns 表示用取得結果。
 * @precondition 同Originの専用設定APIから取得する。
 * @postcondition availableだけがSnapshotを持つ。
 * @effect N/A: 値検査のみ。
 * @failure 不正値は固定例外。
 * @invariant fallbackを作らない。
 * @boundary APIと画面。
 * @security 認証・実行許可を生成しない。
 * @concurrency 同期検査。
 */
export function validateAiSelectionResponse(
  value: unknown,
): AiSelectionReadResult {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "reason,snapshot,status"
  )
    throw new Error("workbench_selection_response_invalid");
  if (value.status === "available") {
    if (value.reason !== null)
      throw new Error("workbench_selection_response_invalid");
    validateAiSelectionSnapshot(value.snapshot);
  } else if (
    (value.status !== "missing" && value.status !== "blocked") ||
    value.snapshot !== null ||
    typeof value.reason !== "string" ||
    (value.status === "missing" &&
      value.reason !== "ai_selection_not_configured")
  )
    throw new Error("workbench_selection_response_invalid");
  return value as AiSelectionReadResult;
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
function isProjectionRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
function isProjectionNullableString(value: unknown): value is string | null {
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
function isProjectionStringArray(value: unknown): value is readonly string[] {
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
    !isProjectionRecord(value) ||
    Object.keys(value).sort().join(",") !==
      "projectId,repositoryId,repositoryRole,scenes" ||
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
      (scene, index) =>
        !isProjectionRecord(scene) || scene.key !== expectedKeys[index],
    )
  )
    return false;
  return value.scenes.every((scene) => {
    if (
      !isProjectionRecord(scene) ||
      Object.keys(scene).sort().join(",") !== "key,summary,table,title" ||
      !isProjectionRecord(scene.table)
    )
      return false;
    const table = scene.table;
    if (Object.keys(table).sort().join(",") !== "columns,rows") return false;
    if (!isProjectionStringArray(table.columns) || !Array.isArray(table.rows))
      return false;
    const columnCount = table.columns.length;
    return (
      typeof scene.title === "string" &&
      isProjectionNullableString(scene.summary) &&
      table.rows.every(
        (row) => isProjectionStringArray(row) && row.length === columnCount,
      )
    );
  });
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
 * @boundary Portfolio JSONとServer／Browser表示の境界。
 * @security 非開示Sourceを生成しない。
 * @concurrency N/A: 同期純粋処理である。
 */
export function isFederatedProject(
  value: unknown,
): value is FederatedProjectProjection {
  if (
    !isProjectionRecord(value) ||
    Object.keys(value).sort().join(",") !== "projectId,sources,state" ||
    typeof value.projectId !== "string" ||
    !["complete", "partial", "conflicting"].includes(String(value.state)) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0
  )
    return false;
  const repositoryIds: string[] = [];
  for (const source of value.sources) {
    if (
      !isProjectionRecord(source) ||
      Object.keys(source).sort().join(",") !==
        "context,repositoryId,repositoryRole,revision,state" ||
      typeof source.repositoryId !== "string" ||
      !isProjectionNullableString(source.revision) ||
      !["complete", "missing", "conflicting", "unavailable"].includes(
        String(source.state),
      ) ||
      !isProjectionNullableString(source.repositoryRole)
    )
      return false;
    repositoryIds.push(source.repositoryId);
    if (source.state === "complete") {
      if (
        typeof source.repositoryRole !== "string" ||
        typeof source.revision !== "string" ||
        !isProjectContext(source.context) ||
        !isProjectionRecord(source.context) ||
        source.context.projectId !== value.projectId ||
        source.context.repositoryId !== source.repositoryId ||
        source.context.repositoryRole !== source.repositoryRole
      )
        return false;
    } else if (
      source.context !== null ||
      source.repositoryRole !== null ||
      source.revision !== null
    ) {
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
    (source) => isProjectionRecord(source) && source.state === "conflicting",
  )
    ? "conflicting"
    : value.sources.every(
          (source) => isProjectionRecord(source) && source.state === "complete",
        )
      ? "complete"
      : "partial";
  return value.state === derivedState;
}

/**
 * 設定Snapshotの既存Inspectorを表示Modelの真偽判定へ接続する。
 * @responsibility 拒否を欠測の補完へ読み替えない。
 * @trace ARCH-000012
 * @input 未信頼JSON値。
 * @returns 正式Inspectorが受理した場合だけtrue。
 * @precondition 通信の構文解析済み値。
 * @postcondition 値を変更しない。
 * @effect N/A: 純粋検査。
 * @failure 検査例外はfalse。
 * @invariant 既定設定を生成しない。
 * @boundary JSONと描画受付。
 * @security 認可・実行許可を発行しない。
 * @concurrency N/A: 同期局所値のみ。
 */
function isWorkbenchSelectionSnapshot(value: unknown): boolean {
  try {
    validateAiSelectionSnapshot(value);
    return true;
  } catch {
    return false;
  }
}
/**
 * 技術カタログとRepository設定の表示外形を検査する。
 * @responsibility 技術対応と設定の観測状態を別々に受理する。
 * @trace ARCH-000012
 * @input 未信頼の表示Surface。
 * @returns 必須外形と設定Inspectorが成立した場合だけtrue。
 * @precondition Serverが現在認可後に生成したJSON候補。
 * @postcondition Modelの現在利用可能性を推定しない。
 * @effect N/A: 純粋検査。
 * @failure 欠測・外形不正・設定不正はfalse。
 * @invariant 設定Ownerの技術検査を再実装しない。
 * @boundary Server投影とBrowser描画。
 * @security 資格・Host Pathを扱わない。
 * @concurrency N/A: 同期局所値のみ。
 */
function isWorkbenchSelectionSurface(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isRecord(value.catalog) ||
    typeof value.catalog.identity !== "string" ||
    !isRecord(value.catalog.catalog) ||
    value.catalog.catalog.contract !== "crdd/ai-model-catalog" ||
    !Array.isArray(value.catalog.catalog.models) ||
    !value.catalog.catalog.models.every(
      (model) =>
        isRecord(model) &&
        typeof model.modelIdentifier === "string" &&
        ["codex", "claude"].includes(String(model.provider)) &&
        isStringArray(model.supportedEfforts) &&
        isStringArray(model.supportedPurposes),
    )
  )
    return false;
  try {
    validateAiSelectionResponse(value.selection);
    return true;
  } catch {
    return false;
  }
}

/**
 * JSON由来の平坦Objectを実行可能なPropertyから分離する。
 * @responsibility accessor・未知Prototypeを値として受理しない。
 * @trace ARCH-000013
 * @input 任意値。
 * @returns 平坦なown data Objectまたはnull。
 * @precondition N/A: 不信値を受ける。
 * @postcondition getterを評価しない。
 * @effect N/A: 局所検査だけ。
 * @failure 観測不能はnull。
 * @invariant ArrayをObjectへ補完しない。
 * @boundary 不信値と表示値。
 * @security 任意Methodを呼ばない。
 * @concurrency N/A: 同期検査だけ。
 */
function record(value: unknown): Record<string, unknown> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).some(
        (key) =>
          typeof key !== "string" ||
          !Object.hasOwn(descriptors[key] ?? {}, "value"),
      )
    )
      return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * AM共通結果の閉shapeを搬送先で検査する。
 * @responsibility AM共通結果の不信値を部分成功や未知field付き表示へ受理しない。
 * @trace ARCH-000013
 * @input 不信結果と要求したread種別またはmutation。
 * @returns 検査済みAM共通結果。
 * @precondition JSON構文・容量はTransportが確認する。
 * @postcondition 改訂・null／明示空・既知出版・清掃を変換しない。
 * @effect N/A: 値の検査だけ。
 * @failure 不正結果は固定例外。
 * @invariant Roleの実行許可を判定しない。
 * @boundary AM共通結果とBrowser Consumer。
 * @security Path・秘密・自由文字列理由を受理しない。
 * @concurrency 当該結果だけ。別改訂を合成しない。
 */
export function validateManagementResponse(
  value: unknown,
  view: ManagementView | "mutation",
): ManagementResult {
  const result = record(value);
  if (!result) throw new Error("workbench_management_result_invalid");
  const keys = Object.keys(result).sort().join(",");
  /**
   * 改訂の表示値を検査する。
   * @responsibility safeな正整数だけを受理する。
   * @trace ARCH-000013
   * @input 不信な改訂値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementRevision = (v: unknown) =>
    Number.isSafeInteger(v) && Number(v) > 0;
  /**
   * UUIDの表示値を検査する。
   * @responsibility 小文字UUIDv4だけを受理する。
   * @trace ARCH-000013
   * @input 不信なUUID値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementUserId = (v: unknown) =>
    typeof v === "string" && UUID_V4.test(v);
  /**
   * ロールの表示値を検査する。
   * @responsibility 採用済み三ロールだけを受理する。
   * @trace ARCH-000013
   * @input 不信なロール値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementRole = (v: unknown) =>
    v === "developer" || v === "manager" || v === "administrator";
  /**
   * 表示名の表示値を検査する。
   * @responsibility 正規化不要な既存表示名だけを受理する。
   * @trace ARCH-000013
   * @input 不信な表示名値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementUserName = (v: unknown) =>
    typeof v === "string" &&
    v === v.trim() &&
    v.length <= 256 &&
    [...v].length > 0 &&
    [...v].length <= 128 &&
    !/[\p{Cc}\p{Cs}]/u.test(v);
  /**
   * Repository IDの表示値を検査する。
   * @responsibility 既存128文字以内のIDだけを受理する。
   * @trace ARCH-000013
   * @input 不信なRepository ID値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementRepositoryId = (v: unknown) =>
    typeof v === "string" && RESOURCE_ID.test(v);
  let valid = false;
  if (keys === "reason,status" && result.status === "unavailable") {
    const permitted =
      view === "current"
        ? [
            "current_access_authentication_rejected",
            "current_access_lock_unavailable",
            "current_access_cleanup_pending",
            "current_access_observation_unknown",
            "current_access_release_unknown",
          ]
        : view === "mutation"
          ? []
          : ["management_read_rejected", "management_read_unavailable"];
    valid = [...permitted, "management_not_configured"].includes(
      result.reason as string,
    );
  } else if (view === "mutation") {
    if (result.status === "rejected")
      valid =
        keys === "reason,status" &&
        (result.reason === "management_request_rejected" ||
          result.reason === "management_revision_conflict");
    else if (result.status === "completed")
      valid =
        ((keys ===
          "cleanupConfirmed,expectedRevision,operationId,publication,revision,status,userId" &&
          (result.userId === null || isManagementUserId(result.userId))) ||
          (keys ===
            "cleanupConfirmed,expectedRevision,operationId,publication,repositoryId,revision,status" &&
            isManagementRepositoryId(result.repositoryId))) &&
        isManagementUserId(result.operationId) &&
        isManagementRevision(result.expectedRevision) &&
        isManagementRevision(result.revision) &&
        result.revision === Number(result.expectedRevision) + 1 &&
        result.publication === "confirmed" &&
        result.cleanupConfirmed === true;
    else if (result.status === "unavailable")
      valid =
        keys ===
          "cleanupConfirmed,expectedRevision,observedRevision,operationId,primaryFailure,publication,reason,status" &&
        result.reason === "management_operation_unavailable" &&
        isManagementUserId(result.operationId) &&
        isManagementRevision(result.expectedRevision) &&
        (result.observedRevision === null ||
          isManagementRevision(result.observedRevision)) &&
        ["not_attempted", "unconfirmed", "confirmed"].includes(
          result.publication as string,
        ) &&
        typeof result.cleanupConfirmed === "boolean" &&
        [
          "previous_materials_settled",
          "previous_materials_unavailable",
          "identity_generation_failed",
          "candidate_invalid",
          "repository_validation_failed",
          "prepare_failed",
          "publication_failed",
          "readback_failed",
          "cleanup_failed",
          "release_unknown",
          "storage_unavailable",
        ].includes(result.primaryFailure as string);
  } else if (
    result.status === "completed" &&
    isManagementRevision(result.revision)
  ) {
    if (view === "current") {
      const user = record(result.user);
      valid =
        keys === "revision,status,user" &&
        user !== null &&
        Object.keys(user).sort().join(",") === "role,userId,username" &&
        isManagementUserId(user.userId) &&
        isManagementUserName(user.username) &&
        isManagementRole(user.role);
    } else {
      const field = view === "users" ? "users" : "repositories";
      valid =
        keys === ["status", "revision", field].sort().join(",") &&
        Array.isArray(result[field]) &&
        result[field].every((entry: unknown) => {
          const item = record(entry);
          if (!item) return false;
          const fields = Object.keys(item).sort().join(",");
          return view === "users"
            ? fields === "role,userId,username" &&
                isManagementUserId(item.userId) &&
                isManagementUserName(item.username) &&
                isManagementRole(item.role)
            : fields === "repositoryId" &&
                isManagementRepositoryId(item.repositoryId);
        }) &&
        new Set(
          result[field].map(
            (entry: unknown) =>
              record(entry)?.[view === "users" ? "userId" : "repositoryId"],
          ),
        ).size === result[field].length;
    }
  }
  if (!valid) throw new Error("workbench_management_result_invalid");
  return value as ManagementResult;
}
