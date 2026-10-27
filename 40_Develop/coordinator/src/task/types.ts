/**
 * Taskの入力・実行・観測・結果・回復の共有型を定義する。
 * @responsibility Taskの入力・実行・観測・結果・回復の共有型を定義する。
 * @trace ARCH-000004
 */

import type { ProjectTaskRecoveryKind } from "../../../domain-model/src/index.ts";
import type { CoordinatorWorkspaceResult } from "../execution/result.ts";
import type {
  COORDINATOR_EXECUTION_CONTRACT,
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
} from "./dispatch.ts";
import type {
  CoordinatorClockIdentityPort,
  CoordinatorPersistencePorts,
} from "../state/persistence.ts";

/**
 * execution-host-adapterで使用するCoordinator Execution Host Adapter Optionsの値契約を定義する。
 *
 * @responsibility Coordinator Execution Host Adapter OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorExecutionHostAdapterOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionHostAdapterOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorExecutionHostAdapterOptionsの宣言は外部境界を開かない。
 * @security CoordinatorExecutionHostAdapterOptionsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorExecutionHostAdapterOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionHostAdapterOptions = Readonly<{
  now?: CoordinatorClockIdentityPort["now"];
  poisonAfterCleanupUnknown?: CoordinatorProcessSafetyPort["poisonAfterCleanupUnknown"];
}>;

/**
 * task-recovery-adapterで使用するCoordinator Task 回復 Host Dependenciesの値契約を定義する。
 *
 * @responsibility Coordinator Task 回復 Host DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CoordinatorTaskRecoveryHostDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskRecoveryHostDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskRecoveryHostDependenciesの宣言は外部境界を開かない。
 * @security CoordinatorTaskRecoveryHostDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorTaskRecoveryHostDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskRecoveryHostDependencies = Readonly<{
  recoverTaskRecovery?: (recoveryId: string, signal: AbortSignal) => unknown;
  acknowledgeTaskRecovery?: (
    settlement: Readonly<
      CoordinatorDockerRecoveryIdentity & {
        workingDirectory: string;
        repositoryBindingId: string;
      }
    >,
  ) => unknown;
  resolveTaskRecoveryCorrelations?: (
    correlationIds: readonly string[],
  ) => unknown;
  observeRecoveryTransition?: (
    event: CoordinatorRecoveryTransition,
  ) => void | Promise<void>;
}>;

/**
 * task-recovery-portで使用するCoordinator Docker 回復 Identityの値契約を定義する。
 *
 * @responsibility Coordinator Docker 回復 IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDockerRecoveryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDockerRecoveryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDockerRecoveryIdentityの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDockerRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDockerRecoveryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDockerRecoveryIdentity = Readonly<{
  projectId: string;
  milestoneId: string;
  stateGeneration: number;
  taskId: string;
  attemptId: string;
  operationId: string;
  kind: "docker";
  recoveryId: string;
}>;

/**
 * task-recovery-portで使用するCoordinator 回復 Transitionの値契約を定義する。
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
    | "acknowledged"
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
 * Task回復の調停へ、既存Host回復実装を注入するPortを定義する。
 *
 * @responsibility Coordinator Task 回復 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskRecoveryPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskRecoveryPortで宣言した値と責務の対応を維持する。
 * @boundary Task回復調停とHost回復実装の注入境界。
 * @security Portは回復処置と確認を呼び出せる実行Capabilityであり、公開結果・保存値へ含めない。回復ID自体はAuthorityとして扱わない。
 * @compatibility CoordinatorTaskRecoveryPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskRecoveryPort = Readonly<{
  resolveCorrelations: (correlationIds: readonly string[]) => unknown;
  recover: (recoveryId: string, signal: AbortSignal) => unknown;
  acknowledgeDocker: (identity: CoordinatorDockerRecoveryIdentity) => unknown;
  observeTransition: (
    event: CoordinatorRecoveryTransition,
  ) => void | Promise<void>;
}>;

/**
 * 同Processで捕捉した元Taskの結果配送だけを表す。
 * @responsibility 結果読取りと耐久受理後の整理を内部利用側へ型接続する。
 * @trace ARCH-000004
 * @shape 元Task閉包の読取りと終了操作。公開値ではない。
 * @invariant 開始・取消権限や新しいOwnerを追加しない。
 * @boundary Task調停と単発実行の同Process配送境界。
 * @security JSON要求・公開結果・永続Stateに格納しない。
 * @compatibility 現行の同Process配送契約だけを利用する。
 */
export type CoordinatorTaskResultDelivery = Readonly<{
  readResults: () =>
    | Readonly<{ status: "blocked" | "not_required"; results: null }>
    | Readonly<{
        status: "completed";
        results: readonly Readonly<{
          repositoryBinding: string;
          operationId: string;
          recoveryId: string;
          resultId: string;
          consumer: "orchestrator";
        }>[];
      }>;
}>;

/**
 * execution-portで使用するCoordinator Single Task Attempt 入力の値契約を定義する。
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
  workspaceId?: string | null;
  ownerRepositoryRoot?: string;
  executionTree?: string;
  workspaceBaseCommit?: string | null;
  workspaceHead?: string | null;
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
  observeResultDelivery?: (
    delivery: CoordinatorTaskResultDelivery | null,
  ) => void;
}>;

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
  workspaceResult?: CoordinatorWorkspaceResult;
}>;

/**
 * execution-portで使用するCoordinator Execution Portの値契約を定義する。
 *
 * @responsibility Coordinator Execution PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorExecutionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionPortで宣言した値と責務の対応を維持する。
 * @boundary 上位Task調停から単発AI実行を呼び出す注入境界。
 * @security 実行Capabilityを持つ内部Portであり、公開結果・JSON要求・永続Stateへ格納しない。
 * @compatibility CoordinatorExecutionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionPort = Readonly<{
  runSingleTaskAttempt: (
    input: CoordinatorSingleTaskAttemptInput,
  ) => Promise<CoordinatorSingleTaskResult>;
}>;

/**
 * execution-observation-portで使用するCoordinator Task Attempt Observationの値契約を定義する。
 *
 * @responsibility Coordinator Task Attempt ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape CoordinatorTaskAttemptObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskAttemptObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskAttemptObservationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskAttemptObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskAttemptObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskAttemptObservation = Readonly<{
  occurredAt: string;
  startedAtMs: number;
  endedAtMs: number;
  identity: Readonly<{
    projectId: string;
    milestoneId: string;
    objectiveId: string;
    taskId: string;
    attemptId: string;
    operationId: string;
  }>;
  outcome: Readonly<{
    status: "completed" | "blocked" | "cancelled" | "unknown";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
  }>;
  provider?: "codex" | "claude";
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
 * 非Authorityの実行観測を保存先へ渡し、記録失敗を利用側へ保持する。
 *
 * @responsibility Coordinator Execution Observation PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape CoordinatorExecutionObservationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionObservationPortで宣言した値と責務の対応を維持する。
 * @boundary Taskの事実観測と記録・診断の注入境界。
 * @security 観測から実行や受入のAuthorityを発行しない。保存Callbackの結果とTask本体の結果を混同しない。
 * @compatibility CoordinatorExecutionObservationPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionObservationPort = Readonly<{
  recordTaskAttempt?: (
    observation: CoordinatorTaskAttemptObservation,
  ) => CoordinatorExecutionObservationPublication;
  observePublication?: (
    publication: CoordinatorExecutionObservationPublication,
  ) => void;
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
 * @boundary 上位Task調停と保存・時計・Process安全・単発実行の注入境界。
 * @security 保存・実行Capabilityを含む内部依存であり、公開結果・JSON要求・永続Stateへ格納しない。
 * @compatibility CoordinatorExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionDependencies = Readonly<{
  persistence: CoordinatorPersistencePorts;
  clockIdentity: CoordinatorClockIdentityPort;
  processSafety: CoordinatorProcessSafetyPort;
  runSingleTaskAttempt: (
    input: CoordinatorSingleTaskAttemptInput,
  ) => Promise<CoordinatorSingleTaskResult>;
  executionObservation?: CoordinatorExecutionObservationPort;
  resultDelivery?: Readonly<{
    repositoryBindingId: string;
  }>;
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
 * Runtime-process recovery operations supplied by the owning Host Adapter.
 *
 * @responsibility Coordinator Process Safety PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorProcessSafetyPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorProcessSafetyPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorProcessSafetyPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorProcessSafetyPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorProcessSafetyPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorProcessSafetyPort = Readonly<{
  getProcessInstanceIdentity: () => string;
  createRecoveryIdentity: (attemptId: string, operationId: string) => string;
  inspectRecoveryIdentity: (
    value: unknown,
    attemptId: string,
    operationId: string,
  ) => Readonly<{ processIdentity: string; recoveryId: string }> | null;
  poisonAfterCleanupUnknown: () => void;
}>;
