/**
 * ProjectRuntimeTaskAttemptObservationが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeTaskAttemptObservationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000007
 * @shape ProjectRuntimeTaskAttemptObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeTaskAttemptObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeTaskAttemptObservationの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeTaskAttemptObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeTaskAttemptObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeTaskAttemptObservation = Readonly<{
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
 * ProjectRuntimeExecutionObservationPublicationが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeExecutionObservationPublicationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000007
 * @shape ProjectRuntimeExecutionObservationPublicationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeExecutionObservationPublicationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeExecutionObservationPublicationの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeExecutionObservationPublicationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeExecutionObservationPublicationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeExecutionObservationPublication =
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
 * @responsibility ProjectRuntimeExecutionObservationPortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000007
 * @shape ProjectRuntimeExecutionObservationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeExecutionObservationPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeExecutionObservationPortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeExecutionObservationPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeExecutionObservationPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeExecutionObservationPort = Readonly<{
  recordTaskAttempt?: (
    observation: ProjectRuntimeTaskAttemptObservation,
  ) => ProjectRuntimeExecutionObservationPublication;
  observePublication?: (
    publication: ProjectRuntimeExecutionObservationPublication,
  ) => void;
}>;
