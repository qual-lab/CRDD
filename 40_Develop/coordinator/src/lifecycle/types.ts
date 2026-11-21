/**
 * 実行依頼・技術準備・回復・保存Context・状態照会の共有型と固定語彙を定義する。
 * @packageDocumentation
 * @responsibility 共有型と副作用のない固定語彙を所有し、保存、資源、技術実行を発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @boundary Coordinator内の実行ライフサイクル。
 */

import type {
  ExecutionResult,
  Provider,
} from "../../../ai-adapter/src/index.ts";
import type { AiSelectionChoice } from "../../../configuration-model/src/index.ts";
import type {
  ExecutionSelection,
  LeaseKind,
  ObjectivePlan,
  ProjectExecutionState,
  ProjectMilestoneState,
  ProjectQueueState,
  ProjectTaskRecoveryKind,
  ProjectTaskState,
  SingleTaskRecord,
  TaskExecutionSelections,
  saveProjectExecutionState,
} from "../../../execution-model/src/index.ts";
import type {
  AttemptTerminalObservation,
  CompletionResult,
  Executor,
  ExecutorRequest,
  RecordProjection,
  StartResult,
} from "../../../executor/src/index.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import type { COORDINATOR_STATE_QUERY_CONTRACT } from "./validation.ts";
import type {
  Observation,
  StoreOptions,
} from "../../../execution-intelligence/src/index.ts";

/**
 * 回復開始診断の許容段階を検証Ownerで固定する。
 * @responsibility 未知の開始段階を診断の成功値へ補完しない。
 * @trace ARCH-000008
 */
export const RECOVERY_START_FAILURE_STAGES = Object.freeze([
  "plan_validation",
  "operation_context",
  "provider_home",
  "home_lock",
  "operation_binding",
  "state_conflict",
  "operation_start_save",
  "settlement_binding",
  "host_submission",
  "home_lock_release",
  "unknown",
] as const);

export const COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT =
  "crdd-coordinator/orchestrator-single-task-adapter" as const;

export const COORDINATOR_EXECUTION_CONTRACT =
  "crdd-coordinator/orchestrator-execution/v1" as const;

/**
 * 単発操作の非永続入力。
 * @responsibility 明示mode、固定選定、対象と本文を一要求に固定する。
 * @trace ARCH-000004
 * @shape 固定Context参照、作業指示、対象Workspace、送信確認。
 * @invariant 同意を固定選定選択や保存成功から推定しない。
 * @boundary 公開Surfaceから単発Owner。
 * @security Promptは保存しない。
 * @compatibility 旧change_candidate／Bundle入力は受理しない。
 */
export type SingleTaskCommand = Readonly<{
  requestId: string;
  mode: SingleTaskRecord["mode"];
  workType: string | null;
  choice?: AiSelectionChoice;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  workspaceId: string | null;
}>;

/**
 * 下位実行から返す用途別結果。
 * @responsibility 助言と編集の結果を混合せずcleanupを独立保持する。
 * @trace ARCH-000004
 * @shape mode、終端、回復参照、四分類又はWorkspace観測。
 * @invariant Task成功から採用・Commitを推定しない。
 * @boundary 同Processの実行Adapter。
 * @security 回答はSnapshotへ保存しない。
 * @compatibility 下位Runtimeの失敗・回復を維持する。
 */
export type SingleTaskOutcome = Readonly<{
  mode: SingleTaskRecord["mode"];
  status: "completed" | "blocked" | "cancelled" | "unknown";
  reason: string | null;
  cleanupConfirmed: boolean;
  recoveryIds: readonly string[];
  advice: Readonly<
    Record<
      "facts" | "sharedAnalysis" | "additionalInferences" | "nextOptions",
      readonly Readonly<{ text: string; references: readonly string[] }>[]
    >
  > | null;
  workspaceResult: WorkspaceResult | null;
}>;

/**
 * 検証済み入力と同じ実行IdentityをAdapterへ渡す。
 * @responsibility 実行先を永続Owner側で確定する。
 * @trace ARCH-000004
 * @shape Task参照、Revision、読戻したWorkspace対象。
 * @invariant 任意絶対Pathを公開入力から受けない。
 * @boundary Coordinatorから下位実行。
 * @security 認可関数や資格を保存しない。
 * @compatibility 既存Single Task Adapterへの最小結合。
 */
export type SingleTaskExecution = Readonly<{
  record: SingleTaskRecord;
  taskExecutionSelections: TaskExecutionSelections | null;
  repositoryRevision: string;
  target: BorrowedExecutionTarget;
}>;

/**
 * 借用Treeの開始後変更について観測できた範囲を返す。
 * @responsibility 欠測と変更なし、採用と観測を混同しない。
 * @trace ARCH-000004
 * @shape Workspace ID、変更Path又はnull、所属Tree変更、帰属未確定、削除非発行。
 * @invariant 内容・Host Path・新しいAuthorityを含めない。
 * @boundary Task完了から上位Attempt。
 * @security 相対Pathだけを認可済み利用側へ渡す。
 * @compatibility 非借用の旧結果では省略する。
 */
export type WorkspaceResult = Readonly<{
  workspaceId: string | null;
  changedPaths: readonly string[] | null;
  canonicalRepositoryChanged: boolean | null;
  changeAttribution: "unattributed";
  workspaceDeletionIssued: false;
}>;

/**
 * Task開始の必要処置を一度だけ完了して戻る通知契約。
 * @responsibility 上位の保存方式を実行側へ公開せず、処置失敗を例外で伝える。
 * @trace ARCH-000004
 * @shape 任意のobserveStartedと処置完了Promise。
 * @invariant 必要な登録は上位の組立てが保証する。
 * @boundary Task実行開始の観測と保存Owner。
 * @security return値でAuthorityや保存成功を発行しない。
 * @compatibility 受付・実開始・保存確定を同一視しない。
 */
export interface TaskStartCallbacks {
  observeStarted?(): void | Promise<void>;
}

/**
 * 回復の任意診断へ渡す遷移の値契約を定義する。
 *
 * @responsibility Coordinator 回復 TransitionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorRecoveryTransitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorRecoveryTransitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorRecoveryTransitionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorRecoveryTransitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorRecoveryTransitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorRecoveryTransition = Readonly<{
  phase:
    | "required"
    | "recovering"
    | "settled"
    | "verification_resources_finalized"
    | "queue_settled"
    | "retry_ready";
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskId: string | null;
  operationId: string | null;
  recoveryId: string | null;
  stateGeneration: number;
}>;

/**
 * Task Attemptが借用する対象の値を表す。
 * @responsibility 所属Root、実行先、期待改訂を同じ入力として扱う。
 * @trace ARCH-000004
 * @shape Workspace IDは非Authorityの相関値。TreeとGitの同一性は技術入口で検査する。
 * @invariant PathやIDだけでは実行許可にならない。
 * @boundary Coordinator内部のAttempt受付。
 * @security 外部へHost Pathを返さない。
 * @compatibility 旧複製入口とは区別する。
 */
export type BorrowedExecutionTarget = Readonly<{
  workspaceId: string | null;
  ownerRepositoryRoot: string;
  executionTree: string;
  baseCommit: string | null;
  head: string | null;
}>;

/**
 * 単発TaskとObjectiveが共有するTask Attemptの入力を定義する。
 *
 * @responsibility Coordinator Single Task Attempt 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorSingleTaskAttemptInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorSingleTaskAttemptInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorSingleTaskAttemptInputの宣言は外部境界を開かない。
 * @security N/A: CoordinatorSingleTaskAttemptInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorSingleTaskAttemptInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorSingleTaskAttemptInput = Readonly<{
  executionMetadata?: Readonly<Record<string, string>>;
  workspaceTarget?: BorrowedExecutionTarget;
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
}> &
  TaskStartCallbacks;

/**
 * execution-portで使用するCoordinator Single Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Coordinator Single Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorSingleTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorSingleTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorSingleTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorSingleTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorSingleTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorSingleTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

/**
 * execution-portで使用するCoordinator Single Task 結果の値契約を定義する。
 *
 * @responsibility Coordinator Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorSingleTaskResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorSingleTaskResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorSingleTaskResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorSingleTaskResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorSingleTaskResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorSingleTaskResult = Readonly<{
  contract: typeof COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT;
  attemptId: string | null;
  operationId: string | null;
  authorityBindingId: string | null;
  repositoryRevision: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations?: readonly CoordinatorSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
  workspaceResult?: WorkspaceResult;
}>;

/**
 * execution-observation-portで使用するCoordinator Execution Observation Publicationの値契約を定義する。
 *
 * @responsibility Coordinator Execution Observation PublicationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape CoordinatorExecutionObservationPublicationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionObservationPublicationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorExecutionObservationPublicationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorExecutionObservationPublicationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorExecutionObservationPublicationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionObservationPublication =
  | Readonly<{
      status: "completed";
      reason: string;
      eventId: string;
      effectState: "settled";
      cleanupConfirmed: true;
      retryAllowed: false;
      manualRecoveryRequired: false;
      residualArtifactIds: readonly [];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      effectState: "no_effect" | "settled" | "unknown";
      cleanupConfirmed: boolean;
      retryAllowed: boolean;
      manualRecoveryRequired: boolean;
      residualArtifactIds: readonly string[];
    }>
  | Readonly<{
      status: "not_configured" | "unknown";
      reason: string;
      effectState: "no_effect" | "unknown";
      cleanupConfirmed: boolean;
    }>;

/**
 * executionで使用するCoordinator Task Executionの値契約を定義する。
 *
 * @responsibility Coordinator Task ExecutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskExecutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskExecutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskExecutionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskExecutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskExecutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskExecution = Readonly<{
  taskId: string;
  authorityBindingId: string;
  taskRequest: unknown;
  repositoryRoot: unknown;
}>;

/**
 * executionで使用するCoordinator Execution Publication Observationの値契約を定義する。
 *
 * @responsibility Coordinator Execution Publication ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorExecutionPublicationObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionPublicationObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorExecutionPublicationObservationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorExecutionPublicationObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorExecutionPublicationObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionPublicationObservation =
  CoordinatorExecutionObservationPublication;

/**
 * executionで使用するCoordinator Execution Dependenciesの値契約を定義する。
 *
 * @responsibility Coordinator Execution DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary 上位Task調停と保存・任意記録Contextの境界。
 * @security 保存Capabilityを含む内部Contextであり、公開結果・JSON要求・永続Stateへ格納しない。
 * @compatibility CoordinatorExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionDependencies = Readonly<{
  persistence: CoordinatorStateContext;

  recording?: ObjectiveExecutionRecording;
}>;

/**
 * executionで使用するCoordinator Execution 結果の値契約を定義する。
 *
 * @responsibility Coordinator Execution 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorExecutionResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorExecutionResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorExecutionResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorExecutionResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionResult = Readonly<{
  contract: typeof COORDINATOR_EXECUTION_CONTRACT;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  projectId: string;
  queueId: string;
  stateGeneration: number | null;
  completedTaskIds: readonly string[];
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  recoveryIds: readonly string[];
  recoveryObligations: readonly Readonly<{
    kind: ProjectTaskRecoveryKind;
    recoveryId: string;
  }>[];
  effectState: "no_effect" | "settled" | "unknown";
  workspaceResults?: readonly Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    result: NonNullable<CoordinatorSingleTaskResult["workspaceResult"]>;
  }>[];
}>;

/**
 * executionで使用するExecution 入力の値契約を定義する。
 *
 * @responsibility Execution 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ExecutionInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionInputの宣言は外部境界を開かない。
 * @security N/A: ExecutionInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionInput = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskExecutions: readonly CoordinatorTaskExecution[];
  cancellationSignal: AbortSignal;
}>;

/**
 * Objective実行が必要とする依存契約を定義する。
 *
 * @responsibility 同じObjective進行が利用する保存・主体・Repositoryと実行記録の型を共有する。
 * @trace ARCH-000004
 * @shape CoordinatorObjectiveExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorObjectiveExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorObjectiveExecutionDependenciesの宣言は外部境界を開かない。
 * @security N/A: CoordinatorObjectiveExecutionDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorObjectiveExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorObjectiveExecutionDependencies = Readonly<{
  authenticatedPrincipalId: string;
  repositoryRoot: object | string;
  persistence: CoordinatorStateContext & {
    readonly intake: NonNullable<CoordinatorStateContext["intake"]>;
  };

  execution: Omit<CoordinatorExecutionDependencies, "persistence">;
}>;

/**
 * 呼出し元が各Taskへ明示する非永続の実行内容。
 * @responsibility Task固有の指示・検証条件・読取り範囲を定義から分離する。
 * @trace ARCH-000004
 * @shape Task IDと三つの入力値。
 * @invariant Taskの不足を全体指示や別Taskで補完しない。
 * @boundary 呼出し元と実行受付。
 * @security 本文は通常の耐久状態へ保存しない。実行認可を含めない。
 * @compatibility 分解済み計画の新入力形式専用。
 */
export type CallerTaskInput = Readonly<{
  taskId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  readPaths: readonly string[];
}>;

/**
 * objective-requestで使用するCoordinator Objective Requestの値契約を定義する。
 *
 * @responsibility Coordinator Objective RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorObjectiveRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorObjectiveRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorObjectiveRequestの宣言は外部境界を開かない。
 * @security 明示選択は編集担当の希望であり、実行Authorityまたは利用可能性を付与しない。
 * @compatibility 新形式だけを受け、旧Profile ID／Provider自動選択入力を拒否する。
 */
export type CoordinatorObjectiveRequest = Readonly<{
  operation: "start" | "resume";
  requestId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  objective: string;
  plan: ObjectivePlan;
  taskInputs: readonly CallerTaskInput[];
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
  maximumConcurrency: number;
  maximumReplans: number;
  originLane: "interactive" | "scheduled";
  adoptResult: boolean;
  workType?: string;
  choice?: Readonly<{
    provider: "codex" | "claude";
    model: string;
    effort: "low" | "medium" | "high" | "xhigh" | "max";
  }>;
  workspaceId?: string;
}>;

/**
 * 実Lease照合付きQueue保存へ渡す更新要求を定義する。
 *
 * @responsibility Coordinator Queue UpdateのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorQueueUpdateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorQueueUpdateで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorQueueUpdateの宣言は外部境界を開かない。
 * @security N/A: CoordinatorQueueUpdateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorQueueUpdateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorQueueUpdate = Readonly<{
  state: ProjectQueueState;
  lease: CoordinatorLease | null;
  resumeCondition: string | null;
  resultReference: string | null;
}>;

/**
 * 検証済みRepositoryと元の受付情報を保持する値Context。
 *
 * @responsibility 保存対象のRepository参照・元Directory・binding・受付情報を再構成せず搬送する。
 * @trace ARCH-000004
 * @shape CoordinatorStateContextが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorStateContextで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorStateContextの宣言は外部境界を開かない。
 * @security N/A: CoordinatorStateContextはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorStateContextの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorStateContext = Readonly<{
  workingDirectory: string;
  repository: Repository;
  repositoryBindingId: string;
  intake?: Parameters<typeof saveProjectExecutionState>[4];
}>;

/** Coordinatorが所有する実行Leaseの取得・解放・回復結果。 @trace ARCH-000004 */
export type CoordinatorLeaseResult<T> = Readonly<
  | { status: "completed"; reason: string; value: T }
  | {
      status: "blocked";
      reason: string;
      value: null;
      manualRecoveryRequired: boolean;
      recoveryId: string | null;
    }
>;

/**
 * 実行中の排他に使うCoordinator Leaseの値契約を定義する。
 *
 * @responsibility Coordinator LeaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLease = Readonly<{
  kind: LeaseKind;
  ownerGeneration: string;
  release: () => CoordinatorLeaseResult<Readonly<{ released: true }>>;
}>;

/**
 * 実行中の排他に使うCoordinator Lease Acquisition Resolutionの値契約を定義する。
 *
 * @responsibility Coordinator Lease Acquisition ResolutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseAcquisitionResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseAcquisitionResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseAcquisitionResolutionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseAcquisitionResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseAcquisitionResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLeaseAcquisitionResolution = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

/**
 * 実行中の排他に使うCoordinator Lease 所有者 Observationの値契約を定義する。
 *
 * @responsibility Coordinator Lease 所有者 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorLeaseOwnerObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorLeaseOwnerObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorLeaseOwnerObservationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorLeaseOwnerObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorLeaseOwnerObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorLeaseOwnerObservation = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

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
  root: Repository;
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

type ProjectObjectiveState =
  ProjectExecutionState["objectives"][number]["state"];
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
      state: ProjectExecutionState;
      taskIds: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      state: ProjectExecutionState | null;
      taskIds: readonly string[];
    }>;

/** 開始Ownerから受動診断へ渡す固定段階と、取得済みの場合だけの元参照。 */
export type RecoveryStartFailureDiagnostic = Readonly<{
  stage: (typeof RECOVERY_START_FAILURE_STAGES)[number];
  recoveryId: string | null;
}>;

/**
 * 準備Ownerが照合した操作とMountの値契約。
 *
 * @responsibility 操作Identityと固定Mount対応を保持する。
 * @trace ARCH-000015
 * @shape operationId、workspaceとtmpの借用Path。
 * @invariant 同じ操作へ結合した値だけを後続へ渡す。
 * @boundary Mount照合Ownerと共通準備の間。
 * @security Pathを公開結果へ含めない。
 * @compatibility 既存OperationBindingの形を維持する。
 */
export type AttemptBinding = Readonly<{
  operationId: string;
  mounts: Readonly<{ workspace: string; tmp: string }>;
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
}>;

/** 上位のNode観測で確定した非秘密のHome実体。許可tokenではない。 */
export type ProviderHome = Readonly<{
  provider: Provider;
  providerHomeSourcePath: string;
  providerHomeIdentityHash: string;
  stableLogicalHomeBindingHash: string;
}>;

/**
 * 全用途で共通の準備入力。用途だけでPacketの所有参照を区別する。
 * @responsibility Task・Advice・Probeを同じ準備入口へ渡す。
 * @trace ARCH-000015
 * @invariant 不透明参照をAuthorityへ変換せず、元Ownerの検証を維持する。
 */
export type PreparationInput = Readonly<{
  managementCapability: unknown;
  mountCapability: unknown;
  providerHome: ProviderHome;
  executionSelection: ExecutionSelection;
  taskAttempt: 0 | 1;
  recoveryCorrelationId: unknown;
  consumer: unknown;
}> &
  (
    | Readonly<{ purpose: "probe" }>
    | Readonly<{ purpose: "task"; packetCapability: unknown }>
    | Readonly<{
        purpose: "advice";
        packetCapability: unknown;
        packetOwnerCapability: unknown;
      }>
  );

/**
 * 準備の成功又は拒否を表す。PreparedAttemptは成功部分だけを表す。
 * @responsibility 既存の準備成功型と拒否型を判別可能なunionで再利用する。
 * @trace ARCH-000015
 * @invariant preparedを実行完了へ昇格しない。
 */
export type PreparationResult<P extends Provider = Provider> =
  | PreparedAttempt<P>
  | PreparationFailure;

/**
 * 実行前の準備拒否を表す。
 * @responsibility 未発行の参照とEffectをnull／falseで明示する。
 * @trace ARCH-000015
 * @invariant 拒否結果を実行済みや回収済みの証拠へ変換しない。
 */
export type PreparationFailure = Readonly<{
  status: "blocked";
  reason: string;
  plan: null;
  operationId: null;
  dockerEffectIssued: false;
  filesystemEffectIssued: false;
  networkEffectIssued: false;
  processEffectIssued: false;
  providerRequestIssued: false;
  operationCapabilityIssued: false;
  hostPathReported: false;
  proxyCredentialReported: false;
}>;

/**
 * Providerで識別する準備済みDocker計画を定義する。
 *
 * @responsibility 操作・Home・Packet・Modelと実行コマンドの相関を一つの型Ownerへまとめる。
 * @trace ARCH-000015
 * @shape 共通計画fieldとProvider別購読種別、Claudeだけの作業量。
 * @invariant CodexへClaude作業量を追加せず、準備成立と実行成功を区別する。
 * @boundary CoordinatorのDocker準備・計画・Lifecycleの型境界。
 * @security Capability、PathとProvider入力を公開・永続化する権限を持たない。
 * @compatibility 既存Provider別のfield有無と具体型を保持する。
 */
export type RecoveryPlan = RecordProjection<"attempt"> &
  ExecutorRequest<"attempt">["target"] &
  Readonly<{
    provider: Provider;
    executionSelection: ExecutionSelection;
    executor: Executor<"attempt">;
    additionalHosts: readonly string[] | null;
    taskRole: "executor" | "reviewer" | null;
    taskWorkload?: unknown;
    adviceAllowedReferences?: readonly string[] | null;
    taskAttempt: 0 | 1;
    taskPacketRef: string | null;
    taskPacketHash: string | null;
    advicePacketRef?: string | null;
    advicePacketHash?: string | null;
    consumer: "coordinator_cli" | "workbench" | "orchestrator";
    recoveryCorrelationId?: string | null;
  }>;

/** Mount相関を付加したProvider別の準備済み計画。 */
export type PreparedAttemptPlan<P extends Provider> = Readonly<
  Omit<
    RecoveryPlan,
    | "provider"
    | "subscriptionOffering"
    | "taskWorkload"
    | "recoveryCorrelationId"
    | "advicePacketRef"
    | "advicePacketHash"
    | "adviceAllowedReferences"
  > & {
    provider: P;
    subscriptionOffering: P extends "codex"
      ? "chatgpt_subscription_oauth"
      : "claude_max";
    recoveryCorrelationId: string | null;
    advicePacketRef: string | null;
    advicePacketHash: string | null;
    adviceAllowedReferences: readonly string[] | null;
  }
> &
  (P extends "claude" ? Readonly<{ taskWorkload: unknown }> : unknown);

/**
 * 既存Runtimeへ一回搬送する読取り助言Packetを表す。
 *
 * @responsibility Prompt・参照・通信条件を同じTask・Projection・固定選定・Operationへ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape Identity、Prompt、参照、Network Policy、意味的Packet Hashおよび非共有境界からなる読取り専用値である。
 * @invariant Repository／Workspace共有、Tool、SessionおよびFallbackを許可しない。
 * @boundary Coordinatorの助言Packet OwnerとExecutor向け実行入力投影。
 * @security Prompt本文以外のRepository情報や任意Pathを含めない。
 * @compatibility 形式名・版番号は要求せず、同じ操作・選定・Hashの結合を維持する。
 */
export type AdvicePacket = Readonly<{
  allowedReferences: readonly string[];
  packetRef: string;
  operationId: string;
  executionSelection: ExecutionSelection;
  provider: Provider;
  packetHash: string;
  additionalHosts: readonly string[];
  providerPrompt: string;
  repositoryMounted: false;
  workspaceMounted: false;
  toolsAllowed: false;
  sessionPersistenceAllowed: false;
}>;

/**
 * 共通実行計画へ渡す消費済みTaskの値契約。
 *
 * @responsibility 操作・役割・Packet参照とstdin専用入力を保持する。
 * @trace ARCH-000015
 * @shape 操作ID、Packet参照・Hash、実行役割、Promptと任意のClaude仕事量。
 * @invariant Taskと助言を同時に実行する計画へ変換しない。
 * @boundary Task Packet OwnerとCoordinatorの実行計画構築の間。
 * @security Promptをcommand引数や公開結果へ移さない。
 * @compatibility 既存両Providerの消費済みTaskから使用fieldを受け取る。
 */
export type TaskPacket = Readonly<{
  additionalHosts: readonly string[];
  operationId: string;
  taskPacketRef: string;
  taskRole: "executor" | "reviewer";
  reviewerReadProjection?: Readonly<{ candidateCommitId: string }> | null;
  taskAttempt: 0 | 1;
  executionSelection: ExecutionSelection;
  taskWorkload?: unknown;
  taskPacketHash: string;
  prompt: string;
  promptTransport: "provider_stdin_only";
}>;

/**
 * Providerごとの消費済みTask Packetを定義する。
 *
 * @responsibility stdin専用本文とProvider固有作業量の既存field有無を保持する。
 * @trace ARCH-000015
 * @shape 共通PacketとClaudeだけに必要なtaskWorkload。
 * @invariant 同じ操作・役割のPacket以外へ付け替えない。
 * @boundary CoordinatorのDocker準備・計画・Lifecycleの型境界。
 * @security Capability、PathとProvider入力を公開・永続化する権限を持たない。
 * @compatibility 既存Provider別のfield有無と具体型を保持する。
 */
export type ConsumedTaskPacket<P extends Provider> = Omit<
  TaskPacket,
  "taskWorkload"
> &
  (P extends "claude" ? Readonly<{ taskWorkload: unknown }> : unknown);

/**
 * 同じCoordinator内の開始Ownerへ渡す準備結果を定義する。
 *
 * @responsibility 準備成立と実行開始・終了を区別する。
 * @trace ARCH-000015
 * @shape 同じ操作・Home・完全選定の計画とEffect前の表示値。Claudeだけに作業量を持つ。
 * @invariant preparedをProvider実行完了へ読み替えない。
 * @boundary 同期準備と既存利用側の結果境界。
 * @security 内部計画を外部の応答や保存診断へ複製しない。
 * @compatibility Provider別結果のfield有無と値を維持する。
 */
export type PreparedAttempt<P extends Provider = Provider> = Readonly<{
  status: "prepared";
  reason: string;
  plan: PreparedAttemptPlan<P>;
  operationId: string;
  dockerEffectIssued: false;
  filesystemEffectIssued: false;
  networkEffectIssued: false;
  processEffectIssued: false;
  providerRequestIssued: false;
  operationCapabilityIssued: false;
  hostPathReported: false;
  proxyCredentialReported: false;
}> &
  (P extends "claude" ? Readonly<{ taskWorkload: unknown }> : unknown);

/** 実資源・Home解放と記録の結果を上位で保持する。 */
export type AttemptCleanupInput = Readonly<{
  plan: RecoveryPlan;
  recoveryCapability: object;
  managementCapability: unknown;
  recoveryId: string;
  observations: AttemptTerminalObservation["resources"];
  resourceSnapshot: AttemptTerminalObservation["resourceSnapshot"];
  homeLeaseReleased: boolean;
}>;

/** 上位の排他解放・回復記録の確定状態。Dockerの不存在とは区別する。 */
export type ResourceCleanupResult = Readonly<{
  homeLeaseReleased: boolean;
  recoveryCompleted: boolean;
  recoveryFinalizationCapability: object | null;
}>;
/** 確保済みの同一回復IDと、その記録操作に用いるCapability。 */
export type Recovery = Readonly<{
  status: "ready";
  recoveryId: string;
  recoveryCapability: object;
}>;

/**
 * docker-process-controllerで使用するBlocked 回復の値契約を定義する。
 *
 * @responsibility Blocked 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape BlockedRecoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant BlockedRecoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: BlockedRecoveryの宣言は外部境界を開かない。
 * @security BlockedRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility BlockedRecoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */

export type BlockedRecovery = Readonly<{
  status: "blocked";
  reason?: string;
  recoveryId: string | null;
  manualRecoveryRequired?: boolean;
}>;
/** 元完了結果に上位所有の解放・記録状態を付加する。 */
export type RecordedAttemptResult = CompletionResult<"attempt"> &
  ResourceCleanupResult;
/** 元の終端観測に回復記録の確定状態を付加する。 */
export type RecordedAttemptObservation = AttemptTerminalObservation &
  Readonly<{
    recoveryCompleted: boolean;
  }>;

/**
 * 同じHostの引渡しと清掃進捗を一正本で保持する。
 * @responsibility 取消・終結・未解決参照の投影が同じ既存recordを読む。
 * @trace ARCH-000008
 * @shape 元Host、管理Owner、清掃確認、元completionを持つhandoff。
 * @invariant このrecord自体は処置Authorityではなく、実Ownerと現在保存値を別に照合する。
 */
export type HostCompletionTarget = {
  ownedOperation: object | null;
  managementCapability: object;
  hostRecoveryId: string | null;
  hostCleanupCompleted: boolean;
  dockerHandoffs: Array<{
    capability: object;
    recoveryId: string;
    state: "active" | "finalizable" | "finalized" | "abandoned";
    dockerCompletion?: unknown;
  }>;
};
/** 開始結果を保持し、完了Promiseを上位記録済み結果へ接続する。 */
export type RecordedStartResult =
  | Exclude<StartResult<"attempt">, { status: "started" }>
  | (Omit<
      Extract<StartResult<"attempt">, { status: "started" }>,
      "completion"
    > &
      Readonly<{ completion: Promise<RecordedAttemptResult> }>);

/**
 * Coordinatorの回復記録準備が停止したことを知らせる。
 * @responsibility 上位の受付・保存段階と取得済みの元回復参照を相関する。
 * @trace ARCH-000008
 * @shape 既存の回復開始失敗イベントと非秘密診断。Executorの技術診断とは区別する。
 * @invariant 実行開始・Effect成立・資源回収済みを意味しない。
 * @boundary Coordinatorの回復開始Ownerから診断利用側。
 * @security 生出力・Path・Authorityを含めない。
 * @compatibility 通知名・field・段階・回復参照の意味を維持する。
 */
export type RecoveryStartFailureNotice = Readonly<{
  event: "coordinator_provider_recovery_start_failed";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
  diagnostic: RecoveryStartFailureDiagnostic;
}>;

/** Objective呼出し内だけの記録進捗。別Store・実行許可・再試行のAuthorityではない。 */
export type ObjectiveExecutionRecording = Readonly<{
  repositoryRoot: string;
  projectId: string;
  requestId: string;
  groupId: string;
  workType: string | null;
}> & {
  attempted: boolean;
  group: { store: StoreOptions; groupId: string } | null;
};

/** AI Adapterが解釈済みの助言内容とその項目を再利用する。 */
type AdviceResult = NonNullable<ExecutionResult<"advice">["normalizedResult"]>;
type AdviceResultItem = AdviceResult["facts"][number];

/**
 * 読取り助言Provider ExecutorのRuntime接続境界で使用するProviderAdviceRuntimeResultの構造を固定する。
 *
 * @responsibility 読取り助言Provider ExecutorのRuntime接続境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdviceRuntimeResult = Readonly<
  | {
      status: "completed";
      reason: null;
      advice: AdviceResult;
      providerEffectIssued: true;
      cleanupConfirmed: true;
    }
  | {
      status: "blocked";
      reason: string;
      advice: null;
      providerEffectIssued: boolean;
      cleanupConfirmed: boolean;
    }
>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestModeの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestMode = "read_only_advice";

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestInputの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestInput = Readonly<{
  mode: CoordinatorAiRequestMode;
  executionSelection: ExecutionSelection;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
}>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestResultの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestResult = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string | null;
  facts: readonly AdviceResultItem[];
  sharedAnalysis: readonly AdviceResultItem[];
  additionalInferences: readonly AdviceResultItem[];
  nextOptions: readonly AdviceResultItem[];
  candidate: null;
}>;

/** 同じAI実行の開始と終了捕捉を一回の最終保存へ結ぶ短命な値。SessionやAuthorityは保持しない。 */
export type ProviderExecutionRecording = Readonly<{
  store: StoreOptions;
  executionId: string;
  startedMonotonicMs: number;
}> & {
  observation: Readonly<{
    endedAt: string;
    elapsedMs: Observation<number>;
    result: ProviderExecutionOutcome;
  }> | null;
  settlementAttempted: boolean;
};
export type ProviderExecutionOutcome = Readonly<{
  status: string;
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired?: boolean;
  effectState?: unknown;
}>;

/**
 * 読取り助言Runtime Packetの発行入力を表す。
 *
 * @responsibility 上位で検証済みのIdentity、Prompt、参照と通信条件を発行境界へ渡す。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape Operation、固定選定、Task、Projection、Prompt、参照およびNetwork Policyからなる読取り専用値である。
 * @invariant 完全選定とNetwork PolicyのProviderは同じであり、技術Commandを入力しない。
 * @boundary 読取り助言計画と一回消費Packet発行の間。
 * @security Repository Path、Workspace PathおよびCredentialを入力へ含めない。
 * @compatibility revision 2のPacket発行だけで使用する。
 */
export type ProviderAdvicePacketInput = Readonly<{
  allowedReferences: readonly string[];
  operationId: string;
  executionSelection: ExecutionSelection;
  provider: "codex" | "claude";
  taskHash: string;
  projectionHash: string;
  providerPrompt: string;
  additionalHosts: readonly string[];
}>;

/**
 * 読取り助言をProviderへ接続するための入力を表す。
 *
 * @responsibility 助言本文、通信先、参照および固定選定を保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdviceExecutionInput = Readonly<{
  allowedReferences: readonly string[];
  additionalHosts: readonly string[];
  providerPrompt: string;
  taskHash: string;
  projectionHash: string;
  executionSelection: ExecutionSelection;
}>;
