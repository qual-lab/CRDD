/**
 * Task・Queue・単独実行状態の保存値と操作契約を定義する。
 * @responsibility 保存Schemaを変更せず、完成操作と検査が共有する型の正本を持つ。
 * @trace ARCH-000008
 */

import type { ModelSelection } from "../../../ai-adapter/src/index.ts";
import type { RootObservedInput } from "../state/types.ts";

/**
 * stateで使用するProject Task Definitionの値契約を定義する。
 *
 * @responsibility Project Task DefinitionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskDefinitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskDefinitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskDefinitionの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskDefinitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskDefinitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskDefinition = Readonly<{
  id: string;
  objectiveId: string;
  dependencies: readonly string[];
  allowedPaths: readonly string[];
  conflictKeys: readonly string[];
}>;

/** 確定済み実行入力。設定モデルを参照せず、当時の選定と相関値を保持する。 */
export type ExecutionSelection = ModelSelection &
  Readonly<{
    catalogIdentity: string;
    configIdentity: string;
    role:
      | "coordinator"
      | "executor"
      | "independent_reviewer"
      | "result_integration"
      | "advice";
    workType: string | null;
    source: "explicit" | "work_type_override" | "role_default";
  }>;

/** 同一Taskの編集と独立レビューに使う二役割の確定選定。 */
export type TaskExecutionSelections = Readonly<{
  executor: ExecutionSelection;
  reviewer: ExecutionSelection;
}>;

/**
 * 同じ結果に対する上位の耐久受理本文を定義する。
 * @responsibility Repository・仕事・Attempt・結果と初回受理世代の結合を所有する。
 * @trace ARCH-000004
 * @shape 十一項目の固定本文。consumerはorchestratorだけ。
 * @invariant 実行操作IDで上位論理操作IDを代用しない。
 * @boundary Coordinatorの結果投影とCoordinatorの耐久保存。
 * @security Path・秘密値・処置Authorityを含めない。
 * @compatibility 旧Runtime領収書を新本文へ読み替えない。
 */
export type ProjectResultAcceptance = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  taskId: string;
  attemptId: string;
  operationId: string;
  recoveryId: string;
  settlementGeneration: number;
  repositoryBinding: string;
  resultId: string;
  consumer: "orchestrator";
}>;

/**
 * 同じTask試行から保存へ搬送する結果の元事実。
 * @responsibility Task・Attempt・Operationの相関と未解決観測を一つの値契約にする。
 * @trace ARCH-000004、ARCH-000008
 * @shape taskId、attemptId、operationId、recoveryUnresolvedの四項目。
 * @invariant 値だけを真正な実行結果・資源回収・保存許可としない。
 * @boundary Task State Portと保存候補生成。
 * @security 実行時のexact key検査と元Owner照合は各既存境界で維持する。
 * @compatibility 既存の匿名四fieldと同じ形状。保存Schemaは変えない。
 */
export type ProjectTaskResultFact = Readonly<{
  taskId: string;
  attemptId: string;
  operationId: string;
  recoveryUnresolved: boolean;
}>;

/**
 * stateで使用するProject Task 記録の値契約を定義する。
 *
 * @responsibility Project Task 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskRecordの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskRecord = Readonly<{
  definition: ProjectTaskDefinition;
  state: ProjectTaskState;
  attemptId: string | null;
  operationId: string | null;
  authorityBindingId: string | null;
  startPhase: ProjectTaskStartPhase;
  cleanupConfirmed: boolean;
  recoveryObligations: readonly ProjectTaskRecoveryObligation[];
  resultAcceptances: readonly ProjectResultAcceptance[];
  recoveryUnresolved: boolean;
  candidateId: string | null;
  retryCount: number;
  supersededBy: string | null;
}>;

/**
 * stateで使用するProject Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Project Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskRecoveryObligation = Readonly<{
  kind: ProjectTaskRecoveryKind;
  recoveryId: string;
  phase: "required" | "recovering" | "settled" | "acknowledged";
  acknowledgement?: ProjectDockerRecoveryAcknowledgement;
}>;

/**
 * stateで使用するProject Task 状態の値契約を定義する。
 *
 * @responsibility Project Task 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskStateの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskState =
  | "planned"
  | "waiting_dependency"
  | "ready"
  | "starting"
  | "running"
  | "cleanup_pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovery_required"
  | "superseded";

/**
 * stateで使用するProject Task Start Phaseの値契約を定義する。
 *
 * @responsibility Project Task Start PhaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskStartPhaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskStartPhaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskStartPhaseの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskStartPhaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskStartPhaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskStartPhase =
  | "none"
  | "reserved"
  | "handoff_prepared"
  | "running"
  | "settled";

/**
 * stateで使用するProject Task 回復 Kindの値契約を定義する。
 *
 * @responsibility Project Task 回復 KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskRecoveryKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskRecoveryKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskRecoveryKindの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskRecoveryKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskRecoveryKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskRecoveryKind =
  | "host"
  | "docker"
  | "candidate"
  | "candidate_store"
  | "runtime_process";

/**
 * stateで使用するProject Docker 回復 Acknowledgementの値契約を定義する。
 *
 * @responsibility Project Docker 回復 AcknowledgementのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectDockerRecoveryAcknowledgementが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectDockerRecoveryAcknowledgementで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectDockerRecoveryAcknowledgementの宣言は外部境界を開かない。
 * @security N/A: ProjectDockerRecoveryAcknowledgementはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectDockerRecoveryAcknowledgementの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectDockerRecoveryAcknowledgement = ProjectResultAcceptance;

/**
 * state-portで使用するCoordinator Queue Enqueue 入力の値契約を定義する。
 *
 * @responsibility Coordinator Queue Enqueue 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape QueueEnqueueInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant QueueEnqueueInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: QueueEnqueueInputの宣言は外部境界を開かない。
 * @security N/A: QueueEnqueueInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility QueueEnqueueInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type QueueEnqueueInput = Omit<
  ProjectQueueEntry,
  | "state"
  | "generation"
  | "ownerGeneration"
  | "resumeCondition"
  | "resultReference"
  | "singleTask"
  | "milestoneId"
> &
  Readonly<{ milestoneId: string }>;

/**
 * queueで使用するProject Queue Entryの値契約を定義する。
 *
 * @responsibility Project Queue EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectQueueEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectQueueEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectQueueEntryの宣言は外部境界を開かない。
 * @security N/A: ProjectQueueEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectQueueEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */

export type ProjectQueueEntry = Readonly<{
  queueId: string;
  projectId: string;
  milestoneId: string | null;
  requestHash: string;
  originLane: "interactive" | "scheduled";
  repositoryRevision: string;
  scopeHash: string;
  state: ProjectQueueState;
  generation: number;
  ownerGeneration: string | null;
  resumeCondition: string | null;
  resultReference: string | null;
  workspaceId?: string | null;
  singleTask?: SingleTaskRecord;
}>;

/**
 * 単発実行の最小保存契約。
 * @responsibility 本文・回答・Authorityを保存せず元の実行参照を保つ。
 * @trace ARCH-000004
 * @shape 主体、固定選定、Task／Attempt／Operation、段階、cleanupと回復参照。
 * @invariant 同じ受付の識別子を途中で付け替えない。
 * @boundary Repository-local Snapshot。
 * @security 資格・Prompt・回答本文は含めない。
 * @compatibility Project計画のTask／Milestoneと区別する。
 */
export type SingleTaskRecord = Readonly<{
  principalId: string;
  mode: "read_only_advice" | "workspace_edit";
  executionSelection: ExecutionSelection;
  taskId: string;
  attemptId: string;
  operationId: string;
  phase: "accepted" | "starting" | "running" | "settled";
  status: "pending" | "completed" | "blocked" | "cancelled" | "unknown";
  reason: string | null;
  cleanupConfirmed: boolean;
  recoveryIds: readonly string[];
  adviceOperation?: Readonly<{ operationId: string; hostRecoveryId: string }>;
}>;

/**
 * queueで使用するProject Queue 状態の値契約を定義する。
 *
 * @responsibility Project Queue 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectQueueStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectQueueStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectQueueStateの宣言は外部境界を開かない。
 * @security N/A: ProjectQueueStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectQueueStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectQueueState =
  | "queued"
  | "leased"
  | "running"
  | "waiting_foreground"
  | "integration_pending"
  | "replan_required"
  | "human_decision_required"
  | "recovery_required"
  | "completed"
  | "cancelled";

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type QueueUpdateRequest = Readonly<
  | {
      kind: "operation";
      input: Parameters<
        typeof import("./validation.ts").prepareQueueOperationUpdate
      > extends [unknown, string, string, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "single";
      input: Parameters<
        typeof import("./validation.ts").prepareSingleTaskQueueUpdate
      > extends [unknown, string, string, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "close_unstarted";
      input: Parameters<
        typeof import("./validation.ts").prepareUnstartedTaskQueueClosure
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "recovery";
      input: Parameters<
        typeof import("./validation.ts").prepareQueueRecoverySettlement
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "lease_released";
      input: RootObservedInput<
        Parameters<
          typeof import("./validation.ts").prepareQueueLeaseReleaseSettlement
        >
      >;
    }
>;

/** 固定のモデル処置と元の必須入力を対応付ける。物理処置は上位Ownerが行う。 */
export type QueueCreateRequest = Readonly<
  | {
      kind: "scheduled";
      input: Parameters<
        typeof import("./validation.ts").prepareQueueEntryCreation
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
  | {
      kind: "single";
      input: Parameters<
        typeof import("./validation.ts").prepareSingleTaskQueueCreation
      > extends [unknown, ...infer Rest]
        ? Rest
        : never;
    }
>;
