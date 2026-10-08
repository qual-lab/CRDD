/**
 * WorkbenchのRuntime Activity Application Port。
 *
 * @packageDocumentation
 * @responsibility Project Runtimeの現在投影を、未接続・状態なし・観測不能と区別して取得する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @boundary Workbench Client ModelとProject Runtime状態Query Adapterの境界。
 * @effect Read Model生成はEffect 0。観測は注入されたApplicationへだけ委譲する。
 * @security Recovery Authority、Credential、Host Pathまたは非開示Task内容を入力契約へ含めない。
 */
import { runProjectRuntimePublicStateQuery } from "../../orchestrator/src/task/public-adapter.ts";
import {
  readExecutionIntelligence,
  verifyExecutionIntelligenceRepositoryRoot,
  type ExecutionIntelligenceEvent,
  type TaskAttemptExecutionIntelligenceEvent,
} from "../../execution-intelligence/src/index.ts";
import { inspectProjectRuntimeStateQueryResult } from "../../orchestrator/src/index.ts";
import { observeChangePublicationTarget } from "../../version-control/src/change-publication.ts";
import { gitChangePublicationTargetObservationAdapter } from "../../version-control/src/git/change-publication-adapter.ts";
import { verifyRepositoryRoot } from "../../version-control/src/repository-location.ts";

/**
 * Workbenchが表示するProject Runtime現在投影の値契約。
 *
 * @responsibility 実行状況画面に必要なMilestone、Objective／Task、判断、Recoveryおよび次処置を閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @shape Project Runtime公開投影の表示Propertyだけを表す。
 * @invariant Runtime正本、Authorityまたは状態遷移操作を所有しない。
 * @boundary Project Runtime State Query AdapterとWorkbench表示の型境界。
 * @security 非開示Task本文、Credential、Host PathおよびRecovery Authorityを含まない。
 * @compatibility Project Runtime公開契約変更時はAdapterと表示試験を再評価する。
 */
export type WorkbenchRuntimeActivityProjection = Readonly<{
  projectId: string;
  milestoneId: string;
  generation: number;
  milestoneState: string;
  objectiveCounts: Readonly<Record<string, number>>;
  taskCounts: Readonly<Record<string, number>>;
  objectiveTaskSummaries: readonly Readonly<{
    objectiveId: string;
    objectiveState: string;
    taskCounts: Readonly<Record<string, number>>;
  }>[];
  workProgress: string;
  qualityState: string;
  humanDecisionRequired: boolean;
  recoveryRequired: boolean;
  nextAction: string;
}>;

/**
 * Workbenchへ公開する一つの実行Event要約。
 *
 * @responsibility Execution Intelligence Eventから実行履歴画面に必要な非秘密情報だけを固定する。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @shape Event、Objective、Task、Attempt、時刻、結果および回復要否を表す。
 * @invariant Event Storeの正本値を変更せず、Recovery Authorityまたは生Provider出力を含まない。
 * @boundary Execution Intelligence EventとWorkbench表示の型境界。
 * @security Credential、Prompt、Response、Host PathおよびRecovery Authorityを含まない。
 * @compatibility Event契約変更時は投影と継続読込試験を再評価する。
 */
export type WorkbenchRuntimeEventProjection = Readonly<{
  eventId: string;
  occurredAt: string;
  objectiveId: string;
  taskId: string;
  attemptId: string;
  status: "completed" | "blocked" | "cancelled" | "unknown";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;

/**
 * Runtime Eventページ要求。
 *
 * @responsibility Eventの取得上限と継続位置を一回の観測へ結合する。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @shape cursorとlimitを表す。
 * @invariant limitは1件以上50件以下である。
 * @boundary Browser QueryとExecution Event投影の型境界。
 * @security CursorへRepository Pathまたは秘密値を含めない。
 * @compatibility Cursorは同じ並び順の後続取得にだけ使用する。
 */
export type WorkbenchRuntimeActivityPageRequest = Readonly<{
  cursor?: string;
  limit?: number;
}>;

/**
 * Runtime Activity一回分の観測結果を表す値契約。
 *
 * @responsibility observed、absent、unknownと理由・投影の相関をWorkbenchへ搬送する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @shape state、reasonおよびprojectionを表す。
 * @invariant observedだけが非null projectionを持つ想定であり、表示側でも不整合を成功へ畳まない。
 * @boundary Runtime Activity Application PortとBrowser表示の型境界。
 * @security reasonに秘密値、Host Pathまたは非開示Identityを含めない。
 * @compatibility 状態追加時は未接続を含む全表示分岐を再評価する。
 */
export type WorkbenchRuntimeActivityObservation = Readonly<{
  state: "observed" | "absent" | "unknown";
  reason: string;
  projection: WorkbenchRuntimeActivityProjection | null;
  eventState: "observed" | "unknown";
  eventReason: string;
  events: readonly WorkbenchRuntimeEventProjection[];
  eventContinuation: string | null;
}>;

/**
 * Runtime Activityの読取りApplication Port。
 *
 * @responsibility Project IDを現在のRuntime観測結果へ変換するConsumer境界を固定する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @shape observe操作だけを持つ読取り専用Portを表す。
 * @invariant WorkbenchへRuntime書込み、判断返却またはRecovery Authorityを公開しない。
 * @boundary WorkbenchとRepository／CROS Project Runtime Adapterの型境界。
 * @security Project ID以外の任意Path、Credentialまたは内部Runtime引数を受け取らない。
 * @compatibility 書込み操作は本Portへ追加せず、別Authority境界で設計する。
 */
export type WorkbenchRuntimeActivityApplication = Readonly<{
  observe: (
    projectId: string,
    page?: WorkbenchRuntimeActivityPageRequest,
  ) => Promise<WorkbenchRuntimeActivityObservation>;
}>;

const DEFAULT_EVENT_LIMIT = 20;
const MAXIMUM_EVENT_LIMIT = 50;

/**
 * Execution EventをWorkbench用の閉じた要約へ変換する。
 *
 * @responsibility Event StoreのCanonical Eventから表示許可Propertyだけを選択する。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input eventに検証済みExecution Intelligence Eventを受け取る。
 * @returns WorkbenchRuntimeEventProjectionを返す。
 * @precondition eventはExecution Intelligence境界で検証済みである。
 * @postcondition Provider入力、生出力およびAuthorityを含まない不変要約を返す。
 * @effect N/A: 入力から表示用値を構築するだけである。
 * @failure N/A: 検証済みEventの固定Propertyだけを読む。
 * @invariant Event Identityと結果を推測または改変しない。
 * @boundary Execution Intelligence Domain→Workbench Read Model。
 * @security 非秘密のIdentity、時刻および結果だけを公開する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function projectRuntimeEvent(
  event: TaskAttemptExecutionIntelligenceEvent,
): WorkbenchRuntimeEventProjection {
  return Object.freeze({
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    objectiveId: event.identity.objectiveId,
    taskId: event.identity.taskId,
    attemptId: event.identity.attemptId,
    status: event.outcome.status,
    reason: event.outcome.reason,
    cleanupConfirmed: event.outcome.cleanupConfirmed,
    manualRecoveryRequired: event.outcome.manualRecoveryRequired,
  });
}

/**
 * Event継続位置を閉じたCursorへ符号化する。
 *
 * @responsibility 並び順の最後の時刻とEvent IDを不透明Cursorへ変換する。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input eventに現在Pageの最後のEventを受け取る。
 * @returns URL安全なCursorを返す。
 * @precondition eventは現在Pageに含まれる検証済みEventである。
 * @postcondition Cursorは時刻とEvent ID以外を含まない。
 * @effect N/A: 文字列を符号化するだけである。
 * @failure N/A: 固定JSONをbase64urlへ変換する。
 * @invariant CursorからRepository Pathまたは秘密値を復元できない。
 * @boundary Workbench Read Model→Browser Query。
 * @security 公開済みEvent時刻とIdentityだけを含む。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function encodeEventCursor(event: ExecutionIntelligenceEvent): string {
  return Buffer.from(
    JSON.stringify([event.occurredAt, event.eventId]),
    "utf8",
  ).toString("base64url");
}

/**
 * Event Cursorを検証して継続位置へ戻す。
 *
 * @responsibility 未信頼Query Cursorの型、長さおよび値形式をEffect前に検証する。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input cursorにBrowser Query由来の不透明値を受け取る。
 * @returns occurredAtとeventId、またはCursorなしを表すnullを返す。
 * @precondition cursorはundefinedまたは最大512文字の候補である。
 * @postcondition 正規の二要素Cursorだけを返す。
 * @effect N/A: 文字列を解析するだけである。
 * @failure 不正Cursorは例外で拒否する。
 * @invariant 未知Propertyや余剰要素を受理しない。
 * @boundary Browser Query→Workbench Application Adapter。
 * @security CursorをPathや任意Objectとして解釈しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function decodeEventCursor(
  cursor: string | undefined,
): readonly [string, string] | null {
  if (cursor === undefined) return null;
  if (cursor.length === 0 || cursor.length > 512)
    throw new Error("workbench_runtime_event_cursor_invalid");
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("workbench_runtime_event_cursor_invalid");
  }
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "string" ||
    !Number.isFinite(Date.parse(value[0])) ||
    typeof value[1] !== "string" ||
    !/^execution-[0-9a-f]{64}$/u.test(value[1])
  )
    throw new Error("workbench_runtime_event_cursor_invalid");
  return Object.freeze([value[0], value[1]]);
}

/**
 * Repository Event StoreからProject限定の継続読込Pageを観測する。
 *
 * @responsibility Event Storeの観測不能、Project絞込み、安定並び順および取得上限を同じ結果へ閉じる。
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input repositoryRoot、projectIdおよびPage要求を受け取る。
 * @returns Event観測状態、理由、PageおよびContinuationを返す。
 * @precondition repositoryRootは現在Workbenchの検証対象Rootである。
 * @postcondition 対象ProjectのEventだけを新しい順で最大limit件返す。
 * @effect Repository-local Runtime Dataを読取るが変更しない。
 * @failure Root、StoreまたはCursorを観測できなければunknownまたは例外で停止する。
 * @invariant Event不存在をStore観測不能へ、観測不能を空Pageへ畳まない。
 * @boundary Repository Runtime Data→Execution Intelligence→Workbench Read Model。
 * @security Event Storeの許可済み要約だけを返し、Pathを結果へ含めない。
 * @concurrency 追記中のStoreは読取り契約に従い、Cursorより新しい追記を後続Pageへ混入させない。
 */
function observeRepositoryRuntimeEvents(
  repositoryRoot: string,
  projectId: string,
  page: WorkbenchRuntimeActivityPageRequest,
) {
  const limit = page.limit ?? DEFAULT_EVENT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAXIMUM_EVENT_LIMIT)
    throw new Error("workbench_runtime_event_limit_invalid");
  const cursor = decodeEventCursor(page.cursor);
  const root = verifyExecutionIntelligenceRepositoryRoot(repositoryRoot);
  if (root.status !== "completed")
    return Object.freeze({
      state: "unknown" as const,
      reason: "execution_event_repository_root_unverified",
      events: Object.freeze([]) as readonly WorkbenchRuntimeEventProjection[],
      continuation: null,
    });
  const observed = readExecutionIntelligence(root.root);
  if (observed.status !== "completed")
    return Object.freeze({
      state: "unknown" as const,
      reason: observed.reason,
      events: Object.freeze([]) as readonly WorkbenchRuntimeEventProjection[],
      continuation: null,
    });
  const sorted = observed.events
    .filter(
      (event): event is TaskAttemptExecutionIntelligenceEvent =>
        event.eventType === "task_attempt_settled" &&
        event.identity.projectId === projectId,
    )
    .sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        right.eventId.localeCompare(left.eventId),
    );
  const start =
    cursor === null
      ? 0
      : sorted.findIndex(
          (event) =>
            event.occurredAt < cursor[0] ||
            (event.occurredAt === cursor[0] && event.eventId < cursor[1]),
        );
  const pageEvents = start < 0 ? [] : sorted.slice(start, start + limit);
  const hasMore = start >= 0 && start + pageEvents.length < sorted.length;
  const last = pageEvents.at(-1);
  return Object.freeze({
    state: "observed" as const,
    reason: "execution_events_observed",
    events: Object.freeze(pageEvents.map(projectRuntimeEvent)),
    continuation:
      hasMore && last !== undefined ? encodeEventCursor(last) : null,
  });
}

/**
 * 検証済みRepositoryへ結合したRuntime Activity Applicationを構築する。
 *
 * @responsibility 現在のRepository RevisionとProject IDを既存Project Runtime State Queryへ接続する。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @input repositoryRootにWorkbench起動時に検証したRepository Rootを受け取る。
 * @returns 読取り専用のWorkbenchRuntimeActivityApplicationを返す。
 * @precondition repositoryRootはVersion Control境界で再検証可能な絶対Pathである。
 * @postcondition 各観測は現在Revisionを使用し、Runtime結果をobserved／absent／unknownへ閉じる。
 * @effect Repository Revision、Runtime Stateおよび認証済み主体を読取る。Runtime状態を初期化・変更しない。
 * @failure Root、Revision、認証またはRuntime状態を完全に観測できなければunknownを返す。
 * @invariant 観測不能を状態なしへ、Revision不一致を直前値へ畳まない。
 * @boundary Workbench Application PortとCoordinator Project Runtime公開Queryの直接境界。
 * @security Project IDと現在RevisionだけをQueryへ渡し、Credential、Recovery AuthorityまたはHost Pathを表示結果へ含めない。
 * @concurrency 一回ごとに現在RevisionとRuntime状態を同じQueryへ結合し、共有Cacheを持たない。
 */
export function createRepositoryWorkbenchRuntimeActivityApplication(
  repositoryRoot: string,
): WorkbenchRuntimeActivityApplication {
  const verification = verifyRepositoryRoot(repositoryRoot);
  return Object.freeze({
    observe: async (projectId, page = {}) => {
      const eventObservation = observeRepositoryRuntimeEvents(
        repositoryRoot,
        projectId,
        page,
      );
      if (verification.status !== "completed")
        return Object.freeze({
          state: "unknown" as const,
          reason: "repository_root_not_verified",
          projection: null,
          eventState: eventObservation.state,
          eventReason: eventObservation.reason,
          events: eventObservation.events,
          eventContinuation: eventObservation.continuation,
        });
      const target = observeChangePublicationTarget(
        verification.capability,
        gitChangePublicationTargetObservationAdapter,
      );
      if (target.status !== "available" || target.revisionIdentity === null)
        return Object.freeze({
          state: "unknown" as const,
          reason: "repository_revision_unknown",
          projection: null,
          eventState: eventObservation.state,
          eventReason: eventObservation.reason,
          events: eventObservation.events,
          eventContinuation: eventObservation.continuation,
        });
      const result = inspectProjectRuntimeStateQueryResult(
        runProjectRuntimePublicStateQuery(
          Object.freeze({
            requestId: "workbench-runtime-observation",
            projectId,
            repositoryRevision: target.revisionIdentity,
          }),
          repositoryRoot,
        ),
      );
      if (result === null)
        return Object.freeze({
          state: "unknown" as const,
          reason: "project_runtime_state_query_unavailable",
          projection: null,
          eventState: eventObservation.state,
          eventReason: eventObservation.reason,
          events: eventObservation.events,
          eventContinuation: eventObservation.continuation,
        });
      return Object.freeze({
        state: result.observationState,
        reason: result.reason,
        projection: result.projection,
        eventState: eventObservation.state,
        eventReason: eventObservation.reason,
        events: eventObservation.events,
        eventContinuation: eventObservation.continuation,
      });
    },
  });
}
