/**
 * Objectiveの計画と実行が共有する型契約。
 * @packageDocumentation
 * @responsibility 計画構造と進行処理の依存契約を共有し、実行値・保存・資源を所有しない。
 * @trace ARCH-000004
 * @boundary Coordinator内のObjective型境界。
 */
import type {
  ObjectivePlan,
  ProjectExecutionState,
  ProjectTaskDefinition,
} from "../../../execution-model/src/index.ts";
import type {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../execution/controller.ts";
import type { resolveTaskExecutionSelections } from "../selection/resolve.ts";
import type {
  CoordinatorClockIdentityPort,
  CoordinatorPersistencePorts,
} from "../state/persistence.ts";
import type {
  CoordinatorExecutionDependencies,
  CoordinatorProcessSafetyPort,
  CoordinatorTaskRecoveryHostDependencies,
  CoordinatorTaskRecoveryPort,
} from "../task/types.ts";

/**
 * Objective実行が必要とする依存契約を定義する。
 *
 * @responsibility 同じObjective進行が利用する保存・時計・Process安全性・Task実行／回復の依存型を共有する。
 * @trace ARCH-000004
 * @shape CoordinatorObjectiveExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorObjectiveExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorObjectiveExecutionDependenciesの宣言は外部境界を開かない。
 * @security N/A: CoordinatorObjectiveExecutionDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorObjectiveExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorObjectiveExecutionDependencies = Readonly<{
  resolveTaskSelections: (
    request: CoordinatorObjectiveRequest,
  ) =>
    | ReturnType<typeof resolveTaskExecutionSelections>
    | Readonly<{ status: "blocked"; value: null; reason: string }>;
  authenticatedPrincipalId: string;
  repositoryBindingId: string;
  repositoryRoot: object | string;
  plan: ObjectivePlan;
  persistence: CoordinatorPersistencePorts;
  clockIdentity: CoordinatorClockIdentityPort;
  processSafety: CoordinatorProcessSafetyPort;
  taskRecovery: CoordinatorTaskRecoveryPort;
  createTaskExecutions: (
    request: CoordinatorObjectiveRequest,
    state: ProjectExecutionState,
  ) => unknown;
  observeLeaseOwner: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  execution: Omit<
    CoordinatorExecutionDependencies,
    "persistence" | "clockIdentity" | "processSafety"
  >;
}>;

/**
 * 公開Objective実行が利用する依存契約を定義する。
 *
 * @responsibility Public Execution DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape PublicExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PublicExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: PublicExecutionDependenciesの宣言は外部境界を開かない。
 * @security N/A: PublicExecutionDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PublicExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PublicExecutionDependencies = Readonly<{
  startTask: typeof startRuntimeOwnedCoordinatorTask;
  cancelTask: typeof cancelRuntimeOwnedCoordinatorTask;
  resolveTaskRecoveryCorrelations?: (
    correlationIds: readonly string[],
  ) => unknown;
}>;

/**
 * 開発用Objective構成が差し替える依存契約を定義する。
 *
 * @responsibility Coordinator Public Development DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPublicDevelopmentDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPublicDevelopmentDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPublicDevelopmentDependenciesの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPublicDevelopmentDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPublicDevelopmentDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPublicDevelopmentDependencies =
  PublicExecutionDependencies;

/**
 * objective-intakeで使用するCoordinator Objective Intake Dependenciesの値契約を定義する。
 *
 * @responsibility Coordinator Objective Intake DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorObjectiveIntakeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorObjectiveIntakeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorObjectiveIntakeDependenciesの宣言は外部境界を開かない。
 * @security CoordinatorObjectiveIntakeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorObjectiveIntakeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorObjectiveIntakeDependencies = Readonly<{
  resolveTaskSelections: (
    request: CoordinatorObjectiveRequest,
  ) =>
    | ReturnType<typeof resolveTaskExecutionSelections>
    | Readonly<{ status: "blocked"; value: null; reason: string }>;
  authenticatedPrincipalId: string;
  verifyProjectBinding: (
    input: Readonly<{
      projectId: string;
      milestoneId: string;
      repositoryRevision: string;
    }>,
  ) => unknown;
  planObjective: (
    request: CoordinatorObjectiveRequest,
    bindingCapability: object,
  ) => unknown;
  createTaskExecutions: (
    request: CoordinatorObjectiveRequest,
    bindingCapability: object,
    state: ProjectExecutionState,
  ) => unknown;
  observeLeaseOwner: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  execution: Omit<
    CoordinatorExecutionDependencies,
    "persistence" | "clockIdentity" | "processSafety"
  >;
}> &
  CoordinatorTaskRecoveryHostDependencies;

/**
 * replanningで使用するCoordinator Replan Decisionの値契約を定義する。
 *
 * @responsibility Coordinator Replan DecisionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorReplanDecisionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorReplanDecisionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorReplanDecisionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorReplanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorReplanDecisionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorReplanDecision =
  | Readonly<{
      disposition: "partial_replan";
      failedTaskId: string;
      replacements: readonly ProjectTaskDefinition[];
    }>
  | Readonly<{
      disposition: "human_decision";
      objectiveId: string;
      reason: string;
    }>
  | Readonly<{ disposition: "maintain_plan"; reason: string }>;

/**
 * replanningで使用するCoordinator Replan 入力の値契約を定義する。
 *
 * @responsibility Coordinator Replan 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorReplanInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorReplanInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorReplanInputの宣言は外部境界を開かない。
 * @security N/A: CoordinatorReplanInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorReplanInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorReplanInput = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  maximumReplans: number;
}>;

/**
 * replanningで使用するCoordinator Replan Classifierの値契約を定義する。
 *
 * @responsibility Coordinator Replan ClassifierのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorReplanClassifierが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorReplanClassifierで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorReplanClassifierの宣言は外部境界を開かない。
 * @security N/A: CoordinatorReplanClassifierはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorReplanClassifierの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorReplanClassifier = (
  context: Readonly<{
    failedTaskIds: readonly string[];
    generation: number;
    repositoryRevision: string;
  }>,
) => unknown;

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
  intakeEpoch: string;
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
