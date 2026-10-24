/**
 * WorkbenchのRuntime Activity Application Port。
 *
 * @packageDocumentation
 * @responsibility Coordinatorの現在投影を、未接続・状態なし・観測不能と区別して取得する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @boundary Workbench Client ModelとCoordinator状態Query Adapterの境界。
 * @effect Read Model生成はEffect 0。観測は注入されたApplicationへだけ委譲する。
 * @security Recovery Authority、Credential、Host Pathまたは非開示Task内容を入力契約へ含めない。
 */
import {
  queryActivity,
  type RuntimeActivityObservation,
} from "../../../../coordinator/src/index.ts";
import type { RepositoryProjectContext } from "../../../../domain-model/src/index.ts";
import { verifyRepositoryRoot } from "../../../../version-control/src/index.ts";

/**
 * Workbenchが表示するCoordinator現在投影の値契約。
 *
 * @responsibility 実行状況画面に必要なMilestone、Objective／Task、判断、Recoveryおよび次処置を閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000012
 * @shape Coordinator公開投影の表示Propertyだけを表す。
 * @invariant Runtime正本、Authorityまたは状態遷移操作を所有しない。
 * @boundary Coordinator State Query AdapterとWorkbench表示の型境界。
 * @security 非開示Task本文、Credential、Host PathおよびRecovery Authorityを含まない。
 * @compatibility Coordinator公開契約変更時はAdapterと表示試験を再評価する。
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
  singleTasks?: RuntimeActivityObservation["singleTasks"];
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
 * @boundary WorkbenchとRepository／CROS Coordinator Adapterの型境界。
 * @security Project ID以外の任意Path、Credentialまたは内部Runtime引数を受け取らない。
 * @compatibility 書込み操作は本Portへ追加せず、別Authority境界で設計する。
 */
export type WorkbenchActivityReader = Readonly<{
  observe: (
    projectId: string,
    page?: WorkbenchRuntimeActivityPageRequest,
  ) => Promise<WorkbenchRuntimeActivityObservation>;
}>;

const DEFAULT_EVENT_LIMIT = 20;

/**
 * 検査済み活動Ownerの観測を画面専用値へ投影する。
 * @responsibility 出所を画面契約へ暗黙転記せず、表示語彙へ変換する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input Coordinatorの検査済み活動観測。
 * @returns 現行Workbench表示Propertyだけを持つ新Object。
 * @precondition 利用側が既存OwnerのSchemaと要求Projectの一致を確認済み。通信経路の有無を認可証明にしない。
 * @postcondition 現在状態・履歴・Continuationの意味を保持する。
 * @effect N/A: 純粋な値変換だけを行う。
 * @failure N/A: 検査済み入力だけを受ける。
 * @invariant Root・出所Repository・管理情報を画面契約へ追加しない。
 * @boundary 活動Ownerの搬送契約からWorkbench表示契約。
 * @security 非秘密の表示項目だけを明示投影する。
 * @concurrency N/A: 共有状態を持たない。
 */
export function projectRuntimeActivityForWorkbench(
  observation: RuntimeActivityObservation,
): WorkbenchRuntimeActivityObservation {
  return Object.freeze({
    state: observation.state,
    reason: observation.reason,
    projection: observation.projection,
    eventState: observation.eventState,
    eventReason:
      observation.eventState === "observed"
        ? "execution_events_observed"
        : "observation_failed",
    events: Object.freeze(
      observation.events.map((event) =>
        Object.freeze({
          eventId: event.eventId,
          occurredAt: event.occurredAt,
          objectiveId: event.objectiveId,
          taskId: event.taskId,
          attemptId: event.attemptId,
          status: event.status,
          reason: event.reason,
          cleanupConfirmed: event.cleanupConfirmed,
          manualRecoveryRequired: event.manualRecoveryRequired,
        }),
      ),
    ),
    eventContinuation: observation.eventContinuation,
    singleTasks: observation.singleTasks ?? [],
  });
}

/**
 * 起動時のRepository Identityへ固定した活動Readerを構築する。
 *
 * @responsibility 現在状態と履歴の観測・ページングを既存Coordinatorへ委譲する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @trace ARCH-000012
 * @input 検証対象Rootと、Domainが確定したProject／Repository ID。
 * @returns 固定Projectだけを観測する読取り専用Reader。
 * @precondition Identityは起動時に取得したRepository Contextの値である。
 * @postcondition 現在状態・履歴・Continuationを同じOwnerの契約で返す。
 * @effect 現在Revision、Runtime状態と履歴を読む。初期化や保存はしない。
 * @failure RootまたはIdentity不成立はunknown。不正Cursorや上限はOwnerが拒否する。
 * @invariant 要求Projectの自己申告でRootの所属を変更しない。
 * @boundary Workbench表示とCoordinator活動Readerの直接境界。
 * @security 資格・Role・任意Pathを要求へ追加せず、Rootを表示しない。
 * @concurrency Identityの二値をコピーし、共有Cacheを持たない。
 */
export function createRepositoryWorkbenchActivityReader(
  repositoryRoot: string,
  identity: Pick<RepositoryProjectContext, "projectId" | "repositoryId">,
): WorkbenchActivityReader {
  const fixedIdentity = Object.freeze({
    projectId: identity.projectId,
    repositoryId: identity.repositoryId,
  });
  const validIdentity =
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(fixedIdentity.projectId) &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(fixedIdentity.repositoryId);
  const verification = verifyRepositoryRoot(repositoryRoot);
  return Object.freeze({
    observe: async (projectId, page = {}) => {
      if (
        verification.status !== "completed" ||
        !validIdentity ||
        projectId !== fixedIdentity.projectId
      )
        return Object.freeze({
          state: "unknown" as const,
          reason: "repository_activity_identity_unverified",
          projection: null,
          eventState: "unknown" as const,
          eventReason: "observation_failed",
          events: Object.freeze([]),
          eventContinuation: null,
        });
      const observation = await queryActivity({
        projectId: fixedIdentity.projectId,
        repositories: [
          {
            ...fixedIdentity,
            root: verification.capability,
          },
        ],
        limit: page.limit ?? DEFAULT_EVENT_LIMIT,
        ...(page.cursor === undefined ? {} : { cursor: page.cursor }),
      });
      if (observation.projectId !== fixedIdentity.projectId)
        throw new Error("workbench_runtime_activity_project_mismatch");
      return projectRuntimeActivityForWorkbench(observation);
    },
  });
}
