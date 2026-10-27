/**
 * 状態照会と実行履歴の投影型を定義する。
 *
 * @responsibility 現在状態・履歴・Cursorの搬送構造を定義し、保存や実行を発行しない。
 * @trace ARCH-000004
 */

import type {
  ProjectTaskState,
  CoordinatorState,
} from "../../../domain-model/src/index.ts";

import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import type { COORDINATOR_STATE_QUERY_CONTRACT } from "./request.ts";
import type {
  ProjectMilestoneState,
  ProjectObjectiveState,
} from "../../../domain-model/src/index.ts";

/**
 * 一Repositoryの読取り入力。
 * @responsibility 呼出側が今回認可したIdentityと技術的Root能力を保持する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type ActivityRepository = Readonly<{
  projectId: string;
  repositoryId: string;
  root: VerifiedRepositoryRoot;
}>;

/**
 * 一Repositoryの観測出所。
 * @responsibility 現在のGit改訂の既知・不明を区別する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type ActivitySource = Readonly<{
  repositoryId: string;
  revision: string | null;
}>;

/**
 * 活動へ投影する一実行Event。
 * @responsibility Execution Intelligenceの非秘密要約とRepository出所を保持する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type RuntimeActivityEvent = Readonly<{
  repositoryId: string;
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
 * 一要求の閉じた活動観測。
 * @responsibility 現在状態と履歴を独立判定し出所を固定する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type RuntimeActivityObservation = Readonly<{
  projectId: string;
  state: "observed" | "absent" | "unknown";
  reason: string;
  projection: CoordinatorProjection | null;
  currentSourceRepositoryId: string | null;
  sources: readonly ActivitySource[];
  eventState: "observed" | "unknown";
  eventReason: string;
  events: readonly RuntimeActivityEvent[];
  eventContinuation: string | null;
  singleTasks?: readonly Readonly<{
    repositoryId: string;
    requestId: string;
    mode: "read_only_advice" | "workspace_edit";
    phase: "accepted" | "starting" | "running" | "settled";
    status: "pending" | "completed" | "blocked" | "cancelled" | "unknown";
    cleanupConfirmed: boolean;
    recoveryRequired: boolean;
  }>[];
}>;

/**
 * 認可済み活動取得の入力。
 * @responsibility 同じProjectの全許可対象とページ要求を一回へ結合する。
 * @trace ARCH-000004
 * @shape 宣言したPropertyだけを表す。
 * @invariant 内容認可や実行Authorityを生成しない。
 * @boundary 活動Ownerと信頼した同Process Consumer。
 * @security 公開観測へRoot・秘密値を含めない。
 * @compatibility 移管後の活動契約のみを扱う。
 */
export type RuntimeActivityRequest = Readonly<{
  projectId: string;
  repositories: readonly ActivityRepository[];
  limit: number;
  cursor?: string;
}>;

/**
 * project-state-queryで使用するCoordinator 状態 Queryの値契約を定義する。
 *
 * @responsibility Coordinator 状態 QueryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorStateQueryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorStateQueryで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorStateQueryの宣言は外部境界を開かない。
 * @security N/A: CoordinatorStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorStateQueryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorStateQuery = Readonly<{
  requestId: string;
  projectId: string;
  repositoryRevision: string;
}>;

/**
 * project-state-queryで使用するCoordinator 状態 Query 結果の値契約を定義する。
 *
 * @responsibility Coordinator 状態 Query 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorStateQueryResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorStateQueryResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorStateQueryResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorStateQueryResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorStateQueryResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorStateQueryResult = Readonly<{
  intakeEpoch: string | null;
  contract: typeof COORDINATOR_STATE_QUERY_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  requestId: string;
  projectId: string;
  repositoryRevision: string;
  observationState: "observed" | "absent" | "unknown";
  projection: CoordinatorProjection | null;
  cleanupConfirmed: true;
  manualRecoveryRequired: boolean;
  effectState: "no_effect";
}>;

/**
 * stateで使用するCoordinator Projectionの値契約を定義する。
 *
 * @responsibility Coordinator ProjectionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorProjectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorProjectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorProjectionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorProjectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorProjection = Readonly<{
  projectId: string;
  milestoneId: string;
  generation: number;
  milestoneState: ProjectMilestoneState;
  objectiveCounts: Readonly<Record<ProjectObjectiveState, number>>;
  taskCounts: Readonly<Record<ProjectTaskState, number>>;
  objectiveTaskSummaries: readonly Readonly<{
    objectiveId: string;
    objectiveState: ProjectObjectiveState;
    taskCounts: Readonly<Record<ProjectTaskState, number>>;
  }>[];
  workProgress: "not_started" | "in_progress" | "tasks_complete";
  qualityState:
    | "not_evaluated"
    | "integration_pending"
    | "accepted"
    | "blocked";
  humanDecisionRequired: boolean;
  recoveryRequired: boolean;
  nextAction:
    | "schedule_task"
    | "wait_for_task"
    | "verify_objective_integration"
    | "verify_milestone_integration"
    | "human_decision"
    | "recover"
    | "complete";
}>;

/**
 * stateで使用する状態 結果の値契約を定義する。
 *
 * @responsibility 状態 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StateResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StateResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StateResultの宣言は外部境界を開かない。
 * @security N/A: StateResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility StateResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StateResult =
  | Readonly<{
      status: "completed";
      reason: string;
      state: CoordinatorState;
      taskIds: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      state: CoordinatorState | null;
      taskIds: readonly string[];
    }>;
