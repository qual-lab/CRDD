/** AI実行と任意集約の公開契約。Task、Repository、実行Authorityを所有しない。 */
export type Observation<T> =
  | Readonly<{ state: "observed"; value: T; source: string }>
  | Readonly<{ state: "not_observed" | "not_applicable"; reason: string }>;

/** 上位が準備した保存先。EIは親Directoryを作成・探索しない。 */
export type StoreOptions = Readonly<{
  directory: string;
  retentionDays: number;
}>;
type Metadata = Readonly<Record<string, string | number | boolean | null>>;
type Context = Readonly<{
  application?: string;
  operation?: string;
  role?: string;
  workType?: string;
  metadata?: Metadata;
}>;

/** 開始要求直前の観測。EIはAI Processを起動しない。 */
export type ExecutionCreateInput = Context &
  Readonly<{
    executionId: string;
    groupId?: string;
    startedAt: string;
    configuration?: Readonly<{
      provider?: Observation<string>;
      model?: Observation<string>;
      reasoningEffort?: Observation<string>;
      configurationRef?: string;
    }>;
  }>;

/** 終了観測。後処理込みの時間とProvider実測時間を区別する。 */
export type ExecutionCompleteInput = Readonly<{
  endedAt: string;
  elapsedMs: Observation<number>;
  providerDurationMs?: Observation<number>;
  usage?: Readonly<{
    inputTokens?: Observation<number>;
    outputTokens?: Observation<number>;
    cacheReadTokens?: Observation<number>;
    cacheWriteTokens?: Observation<number>;
    cost?: Observation<
      Readonly<{
        amount: number;
        unit: string;
        kind: "currency" | "credit";
        source: "reported" | "estimated";
      }>
    >;
  }>;
  outcome: Readonly<{
    status: "completed" | "failed" | "blocked" | "cancelled" | "unknown";
    failureCategory?: string;
    reason?: string;
  }>;
  diagnostic?: Metadata;
  artifactRef?: string;
  /** 未解決は期限整理しない。Recoveryの許可ではない。 */
  retention: "standard" | "unresolved";
}>;
export type Execution = ExecutionCreateInput &
  Readonly<{
    state: "open" | "closed";
    completion: ExecutionCompleteInput | null;
  }>;
export type GroupCreateInput = Context &
  Readonly<{ groupId: string; startedAt: string }>;
export type GroupCompleteInput = Readonly<{
  endedAt: string;
  status: "completed" | "failed" | "cancelled";
}>;
export type ExecutionGroup = GroupCreateInput &
  Readonly<{
    state: "open" | "closed";
    completion: GroupCompleteInput | null;
  }>;
export type ExecutionQuery = Context &
  Readonly<{
    groupId?: string;
    provider?: string;
    model?: string;
    status?: "open" | ExecutionCompleteInput["outcome"]["status"];
    period?: Readonly<{ fromInclusive: string; toExclusive: string }>;
    limit?: number;
    offset?: number;
  }>;
export type GroupQuery = Context &
  Readonly<{
    status?: "open" | GroupCompleteInput["status"];
    period?: Readonly<{ fromInclusive: string; toExclusive: string }>;
    limit?: number;
    offset?: number;
  }>;
export type ExecutionSummary = Readonly<{
  executionCount: number;
  openCount: number;
  completedCount: number;
  failedCount: number;
  blockedCount: number;
  cancelledCount: number;
  unknownCount: number;
  successDenominator: number;
  successRate: number | null;
  measurements: Readonly<
    Record<
      string,
      Readonly<{
        observedCount: number;
        missingCount: number;
        notApplicableCount: number;
        total: number | null;
      }>
    >
  >;
  costs: readonly Readonly<{
    unit: string;
    kind: "currency" | "credit";
    source: "reported" | "estimated";
    observedCount: number;
    total: number;
  }>[];
  costMissingCount: number;
  costNotApplicableCount: number;
}>;
/** 観測不能を不存在・空結果へ丸めない。 */
export type ReadResult<T> =
  | Readonly<{ status: "completed"; value: T }>
  | Readonly<{ status: "blocked"; reason: string }>;
/** 出版と解放を分離し、保存不明でも同じ記録IDを保持する。 */
export type WriteResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  recordId: string;
  effectState: "no_effect" | "settled" | "unknown";
  effectIssued: boolean;
  effectStateUnknown: boolean;
  cleanupConfirmed: boolean;
  retryAllowed: false;
  manualRecoveryRequired: boolean;
  residualArtifactIds: readonly string[];
  recoveryReference: string | null;
}>;
