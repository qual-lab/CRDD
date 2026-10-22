/**
 * execution-observation-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorTaskAttemptObservationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
/**
 * execution-observation-portで使用するOrchestrator Task Attempt Observationの値契約を定義する。
 *
 * @responsibility Orchestrator Task Attempt ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape OrchestratorTaskAttemptObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorTaskAttemptObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorTaskAttemptObservationの宣言は外部境界を開かない。
 * @security N/A: OrchestratorTaskAttemptObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorTaskAttemptObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorTaskAttemptObservation = Readonly<{
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
 * execution-observation-portで使用するOrchestrator Execution Observation Publicationの値契約を定義する。
 *
 * @responsibility Orchestrator Execution Observation PublicationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape OrchestratorExecutionObservationPublicationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionObservationPublicationで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionObservationPublicationの宣言は外部境界を開かない。
 * @security N/A: OrchestratorExecutionObservationPublicationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorExecutionObservationPublicationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionObservationPublication =
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
 * Non-authority observation boundary. Publication failure must remain visible,
 *
 * @responsibility Orchestrator Execution Observation PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape OrchestratorExecutionObservationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionObservationPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionObservationPortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorExecutionObservationPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorExecutionObservationPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionObservationPort = Readonly<{
  recordTaskAttempt?: (
    observation: OrchestratorTaskAttemptObservation,
  ) => OrchestratorExecutionObservationPublication;
  observePublication?: (
    publication: OrchestratorExecutionObservationPublication,
  ) => void;
}>;
