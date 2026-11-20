/**
 * Coordinatorが所有する同期準備・完全選定・実行記録の型を定義する。
 * @packageDocumentation
 * @responsibility 同期準備の入力と実行計画・回復記録の相関を所有し、Docker操作を実装しない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */
import type {
  Provider,
  ReasoningEffort,
} from "../../../ai-adapter/src/index.ts";
import type { ExecutionSelection } from "../../../execution-model/src/index.ts";
import type {
  AttemptDiagnosticNotice,
  AttemptTerminalObservation,
  CompletionResult,
  Executor,
  ExecutorRequest,
  ProcessStartedNotice,
  RecordProjection,
  StartResult,
} from "../../../executor/src/index.ts";
import type { RecoveryStartFailureNotice } from "./observation.ts";
import type { RECOVERY_START_FAILURE_STAGES } from "./validation.ts";

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
 * 固定Providerの同期準備Owner。Factory呼出し自体は実行ではない。
 * @responsibility prepareが返す計画と拒否の契約を明示する。
 * @trace ARCH-000015
 * @invariant 本番の返却型と公開型を別々に定義しない。
 */
export type AttemptPreparation<P extends Provider = Provider> = Readonly<{
  productionAuthority: false;
  prepare: (input: PreparationInput) => PreparationResult<P>;
}>;

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
  selectedModel: null;
  selectedEffort: null;
  selectionNotice: null;
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
 * 二Providerの現在Operation確認とPacket受付を接続する型契約。
 *
 * @responsibility 現在Operationの確認とPacket消費の既存関数を保持する。
 * @trace ARCH-000015
 * @shape 現在Operation・作業領域の確認とPacket消費。
 * @invariant Storeを生成せず、呼出し側の具体値型を維持する。
 * @boundary Coordinator内の既存準備Ownerと共通準備処理の間。
 * @security PacketとCapabilityを公開結果に複製しない。
 * @compatibility 実際に呼び出す準備依存だけを接続する。
 */
export type ProviderPreparationDependencies<T, A> = Readonly<{
  verifyOperationMount: (
    managementCapability: unknown,
    mountCapability: unknown,
  ) => AttemptBinding;
  consumeTaskPacket?: (
    useCapability: unknown,
    managementCapability: unknown,
  ) => T | null;
  consumeAdvicePacket?: (
    useCapability: unknown,
    ownerCapability: unknown,
  ) => A | null;
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
    selectionNotice: string;
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
 * 共通準備Runtimeへ渡す固定Provider依存を定義する。
 *
 * @responsibility 状態Storeを外から渡さず既存操作だけを受け取る。
 * @trace ARCH-000015
 * @shape 現在Operation確認・Packet消費と乱数供給。
 * @invariant 候補Storeの共有や持込みを型の入力契約にしない。
 * @boundary 共通準備Runtimeと本番・局所試験の組立て境界。
 * @security Capabilityをこの型から生成・永続化しない。
 * @compatibility 既存二ProviderのFactory依存を維持する。
 */
export type PreparationHost<P extends Provider> =
  ProviderPreparationDependencies<ConsumedTaskPacket<P>, AdvicePacket> &
    Readonly<{ randomBytes: (size: number) => Buffer }>;

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
  selectedModel: string;
  selectedEffort: ReasoningEffort;
  selectionNotice: string;
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

/**
 * Provider段階から受ける任意の表示・診断通知。
 * @responsibility 保存操作と受動表示を分け、通知から許可や保存結果を返さない。
 * @trace ARCH-000008
 * @shape 任意の開始表示・境界診断をvoid又はPromise<void>で受ける。
 * @invariant 表示・診断失敗は実行結果と元回復参照を変更しない。
 * @boundary Coordinator内の単段接続Ownerと表示利用側。
 * @security 通知からAuthority・保存成功を取得しない。
 * @compatibility 既存Event本文・相関・秘密非搬送を維持する。
 */
export interface ProviderExecutionCallbacks {
  reportProviderProcessStarted?(
    notice: ProcessStartedNotice,
  ): void | Promise<void>;
  reportProviderBoundaryDiagnostic?(
    notice: AttemptDiagnosticNotice | RecoveryStartFailureNotice,
  ): void | Promise<void>;
}

/** 上位Ownerが扱う記録操作。下位の通知契約ではない。 */
export type ExecutionRecordOperations = Readonly<{
  recordUnstarted?: (
    recovery: object,
    management: object,
    result: Extract<StartResult<"attempt">, { status: "blocked" }>,
  ) => boolean;
  verifyRevision: (
    managementCapability: unknown,
    plan: RecoveryPlan,
  ) => unknown;
  beginRecovery: (
    plan: RecoveryPlan,
    managementCapability: unknown,
    observeFailure?: (
      diagnostic: RecoveryStartFailureDiagnostic,
    ) => void | Promise<void>,
  ) => Recovery | BlockedRecovery | null;
  abandonRecovery?: (recoveryCapability: object) => boolean;
  bindInitializationFailure?: (
    capability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    homeHash: unknown,
    reason: unknown,
    result: object | null,
  ) => boolean;
  verifyRecoveryBinding: (
    recoveryCapability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    stableLogicalHomeBindingHash: unknown,
  ) => boolean;
  completeCleanup: (input: AttemptCleanupInput) => ResourceCleanupResult;
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
    resources: unknown,
  ) => boolean;
  recordProviderSubmission?: (recoveryCapability: object) => boolean;
  recordResourceNotIssued?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    resources: unknown,
    source?: "receipt" | "identified",
  ) => boolean;
  recordTerminalObservation?: (
    recoveryCapability: object,
    result: object,
    observation: RecordedAttemptObservation,
  ) => void;
}> &
  ProviderExecutionCallbacks;

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
/** 開始結果を保持し、完了Promiseを上位記録済み結果へ接続する。 */
export type RecordedStartResult =
  | Exclude<StartResult<"attempt">, { status: "started" }>
  | (Omit<
      Extract<StartResult<"attempt">, { status: "started" }>,
      "completion"
    > &
      Readonly<{ completion: Promise<RecordedAttemptResult> }>);
