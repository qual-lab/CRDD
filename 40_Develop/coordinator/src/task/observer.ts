/**
 * execution-observation-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorTaskAttemptObservationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
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
 * Non-authority observation boundary. Publication failure must remain visible,
 *
 * @responsibility Coordinator Execution Observation PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape CoordinatorExecutionObservationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionObservationPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorExecutionObservationPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorExecutionObservationPortはAuthority、秘密値または信頼判断を扱わない。
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
