/**
 * AI実行・Groupと、記録・検索・集計の値契約を定義する。
 * @responsibility 用途に依存しないIdentity・欠測・結果・未解決保持を表現する。
 * @trace ARCH-000007
 * @trace ARCH-000018
 * @boundary Task、Repository、実行Authorityを所有せず、メタデータの情報分類は利用側に残す。
 */
/** 取得済み値とその出所、未観測、非該当を区別し、欠測を0へ補完しない。 */
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
/** 一回の論理実行の開始値と終了観測。openではcompletion=nullを要求する。 */
export type Execution = ExecutionCreateInput &
  Readonly<{
    state: "open" | "closed";
    completion: ExecutionCompleteInput | null;
  }>;
/** 呼出し側が定める任意集約単位。Task階層や実行順序を表さない。 */
export type GroupCreateInput = Context &
  Readonly<{ groupId: string; startedAt: string }>;
/** Group自身の終端。子Executionを自動終了させる指示ではない。 */
export type GroupCompleteInput = Readonly<{
  endedAt: string;
  status: "completed" | "failed" | "cancelled";
}>;
/** Group自身の終了観測。closedでも子Executionの完了・成功を保証しない。 */
export type ExecutionGroup = GroupCreateInput &
  Readonly<{
    state: "open" | "closed";
    completion: GroupCompleteInput | null;
  }>;
/** 実行集合の完全一致条件と開始時刻の半開区間。ページ指定は集計母集合を狭めない。 */
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
/** Group自身の属性・状態による検索条件。子の状態からGroup状態を推定しない。 */
export type GroupQuery = Context &
  Readonly<{
    status?: "open" | GroupCompleteInput["status"];
    period?: Readonly<{ fromInclusive: string; toExclusive: string }>;
    limit?: number;
    offset?: number;
  }>;
/** 検索母集合の事実集計。成功率の分母、欠測、非該当、費用単位・出所を分離する。 */
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

/** 保存Ownerが一回の排他区間で専有する記録集合。Root公開しない内部契約。 */
export type Records = { executions: Execution[]; groups: ExecutionGroup[] };
