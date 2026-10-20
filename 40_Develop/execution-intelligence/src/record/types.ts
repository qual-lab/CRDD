/**
 * 実行観測・Event・入力と要約の共有型を定義する。
 * @responsibility 実行観測・Event・入力と要約の共有型を定義する。
 * @trace ARCH-000007
 */

export const EXECUTION_INTELLIGENCE_EVENT_CONTRACT =
  "crdd/execution-intelligence-event/v2" as const;

/**
 * execution-intelligenceで使用するExecution Observationの値契約を定義する。
 *
 * @responsibility Execution ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionObservationの宣言は外部境界を開かない。
 * @security N/A: ExecutionObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionObservation<T> =
  | Readonly<{ state: "observed"; value: T; source: string }>
  | Readonly<{ state: "not_observed"; reason: string }>
  | Readonly<{ state: "not_applicable"; reason: string }>;

/**
 * execution-intelligenceで使用するExecution Usageの値契約を定義する。
 *
 * @responsibility Execution UsageのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionUsageが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionUsageで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionUsageの宣言は外部境界を開かない。
 * @security N/A: ExecutionUsageはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionUsageの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionUsage = Readonly<{
  inputTokens: ExecutionObservation<number>;
  outputTokens: ExecutionObservation<number>;
  cacheReadTokens: ExecutionObservation<number>;
  cacheWriteTokens: ExecutionObservation<number>;
  costOrCredits: ExecutionObservation<
    Readonly<{ amount: number; unit: string }>
  >;
}>;

/**
 * execution-intelligenceで使用するExecution Intelligence Eventの値契約を定義する。
 *
 * @responsibility Execution Intelligence EventのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligenceEventが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligenceEventで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligenceEventの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligenceEventはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligenceEventの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TaskAttemptExecutionIntelligenceEvent = Readonly<{
  contract: typeof EXECUTION_INTELLIGENCE_EVENT_CONTRACT;
  eventId: string;
  eventType: "task_attempt_settled";
  occurredAt: string;
  identity: Readonly<{
    projectId: string;
    milestoneId: string;
    objectiveId: string;
    taskId: string;
    attemptId: string;
    operationId: string;
  }>;
  execution: Readonly<{
    role: string;
    provider: ExecutionObservation<string>;
    model: ExecutionObservation<string>;
    inputStrategyRef: ExecutionObservation<string>;
    durationMs: ExecutionObservation<number>;
    usage: ExecutionUsage;
    humanActiveMs: ExecutionObservation<number>;
    profileId: ExecutionObservation<string>;
    profileRevision: ExecutionObservation<string>;
    reasoningEffort: ExecutionObservation<string>;
    overrideApplied: ExecutionObservation<boolean>;
    parentExecutionId: ExecutionObservation<string>;
    diagnostic: ExecutionObservation<ExecutionDiagnostic>;
  }>;
  outcome: Readonly<{
    status: "completed" | "blocked" | "cancelled" | "unknown";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
  }>;
  quality: ExecutionObservation<
    Readonly<{
      result: "accepted" | "rejected";
      evidenceIds: readonly string[];
    }>
  >;
}>;

/**
 * Taskを持たないOperationの実行記録を定義する。
 * @responsibility 任意Operationへ架空のTask Identityを要求しない。
 * @trace ARCH-000007
 * @shape project、operation、executionのIdentityと共通観測を保持する。
 * @invariant Task専用のIdentityを持たない。
 * @boundary N/A: 値契約だけを定義する。
 * @security Authorityを含まない。
 * @compatibility v2のoperation_settledだけに適用する。
 */
export type OperationExecutionIntelligenceEvent = Omit<
  TaskAttemptExecutionIntelligenceEvent,
  "eventType" | "identity"
> &
  Readonly<{
    eventType: "operation_settled";
    identity: Readonly<{
      projectId: string;
      operationId: string;
      executionId: string;
    }>;
  }>;

/**
 * 実行知の二つのIdentity母集団を明示的に区別する。
 * @responsibility Taskと任意Operationを同じ観測契約へ接続する。
 * @trace ARCH-000007
 * @shape eventTypeで識別する閉じたunion。
 * @invariant Task IdentityをOperationへ補完しない。
 * @boundary N/A: 値契約だけを定義する。
 * @security Authorityを発行しない。
 * @compatibility v1の保存済み記録を受理しない。
 */
export type ExecutionIntelligenceEvent =
  | TaskAttemptExecutionIntelligenceEvent
  | OperationExecutionIntelligenceEvent;

/**
 * 生応答を複製しない診断の許可値を定義する。
 * @responsibility 停止段階と安全な分類だけを共有する。
 * @trace ARCH-000007
 * @shape stage、categoryと任意の閉じた補足値。
 * @invariant 任意本文、Header、Path、messageを持たない。
 * @boundary Producerが安全化した値の受理境界。
 * @security typeとcodeは静的許可値に限定する。
 * @compatibility 未対応値を推定または自由文へ変換しない。
 */
export type ExecutionDiagnostic = Readonly<{
  stage:
    | "transport"
    | "http"
    | "refusal"
    | "output_limit"
    | "json_parse"
    | "schema_validation"
    | "identity_validation"
    | "semantic_validation"
    | "completed";
  category:
    | "rate_limit"
    | "quota"
    | "billing"
    | "authentication"
    | "permission"
    | "unavailable"
    | "invalid_response"
    | "refused"
    | "output_limit"
    | "none";
  httpStatus: number | null;
  type:
    | "rate_limit_error"
    | "insufficient_quota"
    | "billing_error"
    | "authentication_error"
    | "permission_error"
    | "server_error"
    | "invalid_request_error"
    | null;
  code:
    | "rate_limit_exceeded"
    | "insufficient_quota"
    | "billing_hard_limit_reached"
    | "invalid_api_key"
    | "permission_denied"
    | "server_error"
    | "context_length_exceeded"
    | null;
  finishReason:
    | "completed"
    | "stop"
    | "length"
    | "max_output_tokens"
    | "content_filter"
    | "refusal"
    | null;
  refusal: boolean | null;
}>;

/**
 * execution-intelligenceで使用するTask Attempt Settled Event 入力の値契約を定義する。
 *
 * @responsibility Task Attempt Settled Event 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape TaskAttemptSettledEventInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskAttemptSettledEventInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskAttemptSettledEventInputの宣言は外部境界を開かない。
 * @security N/A: TaskAttemptSettledEventInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskAttemptSettledEventInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TaskAttemptSettledEventInput = Readonly<{
  occurredAt: string;
  identity: TaskAttemptExecutionIntelligenceEvent["identity"];
  execution: Omit<
    ExecutionIntelligenceEvent["execution"],
    | "profileId"
    | "profileRevision"
    | "reasoningEffort"
    | "overrideApplied"
    | "parentExecutionId"
    | "diagnostic"
  > &
    Partial<
      Pick<
        ExecutionIntelligenceEvent["execution"],
        | "profileId"
        | "profileRevision"
        | "reasoningEffort"
        | "overrideApplied"
        | "parentExecutionId"
        | "diagnostic"
      >
    >;
  outcome: ExecutionIntelligenceEvent["outcome"];
  quality: ExecutionIntelligenceEvent["quality"];
}>;

/**
 * 任意Operationの構築入力を定義する。
 * @responsibility 実行Identityと共通観測を受け取る。
 * @trace ARCH-000007
 * @shape Task入力と同じ観測、Operation固有Identity。
 * @invariant Taskを偽造しない。
 * @boundary N/A: 型宣言のみ。
 * @security Authorityや生応答を含まない。
 * @compatibility 省略した追加観測は未観測として構築する。
 */
export type OperationSettledEventInput = Omit<
  TaskAttemptSettledEventInput,
  "identity"
> &
  Readonly<{ identity: OperationExecutionIntelligenceEvent["identity"] }>;

/**
 * execution-intelligenceで使用するExecution Intelligence Summaryの値契約を定義する。
 *
 * @responsibility Execution Intelligence SummaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligenceSummaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligenceSummaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligenceSummaryの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligenceSummaryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligenceSummaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionIntelligenceSummary = Readonly<{
  contract: "crdd/execution-intelligence-summary/v1";
  eventCount: number;
  completedCount: number;
  blockedCount: number;
  cancelledCount: number;
  unknownCount: number;
  observedDurationCount: number;
  totalObservedDurationMs: number | null;
  providerObservationCount: number;
  usageObservedEventCount: number;
  usageFullyObservedEventCount: number;
  observedUsageFieldCount: number;
  humanActiveObservationCount: number;
  qualityObservationCount: number;
  diagnosticObservationCount: number;
  assignmentFullyObservedEventCount: number;
  usageCompleteEventCount: number;
  usagePartialEventCount: number;
  usageNotApplicableEventCount: number;
  costObservationCount: number;
  missingnessPreserved: true;
}>;
