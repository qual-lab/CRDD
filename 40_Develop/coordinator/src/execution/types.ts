/**
 * Coordinatorが所有する準備候補・一回消費・権限相関の型を定義する。
 * @packageDocumentation
 * @responsibility 準備のStore・期限・取消と実行へ渡す候補を所有し、Docker操作を実装しない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */
import type {
  AiProvider,
  AiReasoningEffort,
  AiModelSelection,
} from "../../../ai-adapter/src/index.ts";
import type {
  DockerNetworkPolicy,
  AdviceCommand,
} from "../../../docker-isolation/src/index.ts";
import type {
  AttemptRecordProjection,
  AttemptRequest,
  Executor,
} from "../../../executor/src/index.ts";
import type {
  CompletionResult,
  StartResult,
  AttemptTerminalObservation,
} from "../../../executor/src/index.ts";
import type { DockerSessionCleanup } from "../../../docker-isolation/src/index.ts";
import type {
  ProcessStartedNotice,
  AttemptDiagnosticNotice,
} from "../../../executor/src/index.ts";
import type { RecoveryStartFailureNotice } from "./observation.ts";
import type { ExecutionSelection } from "../../../domain-model/src/index.ts";

export const RECOVERY_START_FAILURE_STAGES = Object.freeze([
  "plan_validation",
  "operation_context",
  "provider_home",
  "home_lock",
  "operation_binding",
  "state_conflict",
  "operation_start_save",
  "settlement_binding",
  "host_submission",
  "home_lock_release",
  "unknown",
] as const);

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

/**
 * 有効化したProvider Home Grantの値契約。
 *
 * @responsibility 操作・Provider・Homeとローカル主体の固定対応を保持する。
 * @trace ARCH-000015
 * @shape Grant参照、Provider・操作Identityと四Hash。
 * @invariant 取得済みGrantを再発行・補完しない。
 * @boundary Home Mount Ownerと共通準備の間。
 * @security ローカル主体とHomeの結合を省略しない。
 * @compatibility 既存activateMount結果のGrantをそのまま使用する。
 */
export type MountGrant = Readonly<{
  grantRef: string;
  provider: string;
  operationId: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
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
  mountAuthorizationCapability: unknown;
  selectionUseCapability: unknown;
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
 * 一回消費される準備候補を管理するOwner。Factory呼出し自体は実行ではない。
 * @responsibility prepare・cancel・consumeの契約を明示する。
 * @trace ARCH-000015
 * @invariant 本番の返却型と公開型を別々に定義しない。
 */
export type AttemptPreparation<P extends AiProvider = AiProvider> = Readonly<{
  productionAuthority: false;
  prepare: (input: PreparationInput) => PreparationResult<P>;
  cancel: (
    prepared: unknown,
    management: unknown,
  ) => PreparationCancellationResult;
  consume: (
    prepared: unknown,
    management: unknown,
  ) => PreparedAttemptPlan<P> | null;
}>;

/**
 * 準備の成功又は拒否を表す。PreparedAttemptは成功部分だけを表す。
 * @responsibility 既存の準備成功型と拒否型を判別可能なunionで再利用する。
 * @trace ARCH-000015
 * @invariant preparedを実行完了へ昇格しない。
 */
export type PreparationResult<P extends AiProvider = AiProvider> =
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
  preparedCapability: null;
  operationId: null;
  grantRef: null;
  selectionRecordId: null;
  selectedModel: null;
  selectedEffort: null;
  selectionNotice: null;
  providerHomeMountLeaseActive: false;
  dockerEffectIssued: false;
  filesystemEffectIssued: false;
  networkEffectIssued: false;
  processEffectIssued: false;
  providerRequestIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  hostPathReported: false;
  proxyCredentialReported: false;
}>;

/**
 * 準備候補の取消・失効と拒否を区別する。
 * @responsibility 元操作の参照が返る終了結果だけを拒否結果から区別する。
 * @trace ARCH-000015
 * @invariant blockedでは操作参照を補完しない。
 */
export type PreparationCancellationResult =
  | PreparationFailure
  | Readonly<
      Omit<PreparationFailure, "status" | "operationId" | "grantRef"> & {
        status: "cancelled" | "expired";
        operationId: string;
        grantRef: string;
      }
    >;

/**
 * 準備計画へ結合する発行済みAuthority参照の型契約。
 *
 * @responsibility 利用と失効の不透明参照を区別する。
 * @trace ARCH-000015
 * @shape authorityUseCapabilityとauthorityControlCapability。
 * @invariant 参照の内容や名前から権限を再構成しない。
 * @boundary 準備StoreとAuthority Ownerの間。
 * @security 公開・永続化しないProcess内の参照である。
 * @compatibility 既存PreparedPlanが持つ二参照を維持する。
 */
export type PreparedAuthority = Readonly<{
  authorityUseCapability: object;
  authorityControlCapability: object;
}>;

/**
 * 二Providerの既存準備状態を共通処理へ接続する型契約。
 *
 * @responsibility Mount・Packet・Authorityと候補Storeの既存関数を保持する。
 * @trace ARCH-000015
 * @shape 二WeakMap、二時計、Mount操作、Packet消費とAuthority発行・失効。
 * @invariant Store・Authority Ownerを生成せず、呼出し側の具体値型を維持する。
 * @boundary Coordinator内の既存準備Ownerと共通準備処理の間。
 * @security PacketとCapabilityを公開結果に複製しない。
 * @compatibility 既存RuntimeStateの使用fieldだけへ構造的に接続する。
 */
export type ProviderDockerPreparationState<
  M,
  T,
  A,
  P extends object,
> = Readonly<{
  prepared: WeakMap<object, NoInfer<P> & PreparedAuthority>;
  managementCapabilities: WeakMap<object, object>;
  verifyOperationMount: (
    managementCapability: unknown,
    mountCapability: unknown,
  ) => AttemptBinding;
  activateMount: (
    mountAuthorizationCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    status: string;
    grant: MountGrant | null;
    activeMountCapability: object | null;
  }>;
  borrowMountSource: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => string | null;
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  wallNow: () => number;
  monotonicNow: () => number;
  consumeModelSelection: (
    useCapability: unknown,
    managementCapability: unknown,
  ) => M | null;
  consumeTaskPacket?: (
    useCapability: unknown,
    managementCapability: unknown,
  ) => T | null;
  consumeAdvicePacket?: (
    useCapability: unknown,
    ownerCapability: unknown,
  ) => A | null;
  issueProviderAuthority: (
    managementCapability: unknown,
    activeMountCapability: unknown,
  ) => Readonly<{
    status: string;
    useCapability: object | null;
    controlCapability: object | null;
    operationId: string | null;
    provider: string | null;
    providerHomeMountGrantRef: string | null;
    runtimeAuthorityIssued: boolean;
  }>;
  revokeProviderAuthority: (
    controlCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
}>;

/**
 * Providerで識別する準備済みDocker計画を定義する。
 *
 * @responsibility 操作・Home・Packet・Modelと実行コマンドの相関を一つの型Ownerへまとめる。
 * @trace ARCH-000015
 * @shape 共通計画fieldとProvider別購読種別、Claudeだけの作業量。
 * @invariant CodexへClaude作業量を追加せず、発行済みAuthorityと実行成功を区別する。
 * @boundary CoordinatorのDocker準備・計画・Lifecycleの型境界。
 * @security Capability、PathとProvider入力を公開・永続化する権限を持たない。
 * @compatibility 既存Provider別のfield有無と具体型を保持する。
 */
export type RecoveryPlan = AttemptRecordProjection &
  AttemptRequest["target"] &
  Readonly<{
    provider: AiProvider;
    executionSelection: AiModelSelection;
    executor: Executor;
    authorityUseCapability: object;
    networkPolicy: DockerNetworkPolicy | null;
    taskRole: "executor" | "reviewer" | null;
    taskWorkload?: unknown;
    adviceCommandHash?: string | null;
    adviceAllowedReferences?: readonly string[] | null;
    selectionRecordId: string;
    selectionHash: string;
    taskAttempt: 0 | 1;
    taskPacketRef: string | null;
    taskPacketHash: string | null;
    advicePacketRef?: string | null;
    advicePacketHash?: string | null;
    consumer: "coordinator_cli" | "workbench" | "orchestrator";
    recoveryCorrelationId?: string | null;
  }>;

export type PreparedAttemptPlan<P extends AiProvider> = Readonly<
  Omit<
    RecoveryPlan,
    | "provider"
    | "subscriptionOffering"
    | "taskWorkload"
    | "recoveryCorrelationId"
    | "advicePacketRef"
    | "advicePacketHash"
    | "adviceCommandHash"
    | "adviceAllowedReferences"
  > & {
    provider: P;
    subscriptionOffering: P extends "codex"
      ? "chatgpt_subscription_oauth"
      : "claude_max";
    recoveryCorrelationId: string | null;
    advicePacketRef: string | null;
    advicePacketHash: string | null;
    adviceCommandHash: string | null;
    adviceAllowedReferences: readonly string[] | null;
    authorityControlCapability: object;
    preparedWallClockMs: number;
    preparedMonotonicMs: number;
    selectionNotice: string;
  }
> &
  (P extends "claude" ? Readonly<{ taskWorkload: unknown }> : unknown);

/**
 * 既存Runtimeへ一回搬送する読取り助言Packetを表す。
 *
 * @responsibility PromptとProvider Commandを同じTask・Projection・固定選定・Operationへ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape Identity、Prompt、Command Hashおよび非共有境界からなる読取り専用値である。
 * @invariant Repository／Workspace共有、Tool、SessionおよびFallbackを許可しない。
 * @boundary Coordinatorの助言Packet OwnerとExecutor向け実行入力投影。
 * @security Prompt本文以外のRepository情報や任意Pathを含めない。
 * @compatibility 形式名・版番号は要求せず、同じ操作・選定・Hashの結合を維持する。
 */
export type AdvicePacket = Readonly<{
  allowedReferences: readonly string[];
  packetRef: string;
  operationId: string;
  executionSelection: AiModelSelection &
    Readonly<{ role: ExecutionSelection["role"] }>;
  selectionHash: string;
  provider: AiProvider;
  commandHash: string;
  packetHash: string;
  providerCommand: AdviceCommand;
  providerPrompt: string;
  repositoryMounted: false;
  workspaceMounted: false;
  toolsAllowed: false;
  sessionPersistenceAllowed: false;
}>;

/**
 * 共通実行計画が照合する消費済みModel選定の値契約。
 *
 * @responsibility 操作・Providerと上位で固定した技術選定の相関を保持する。
 * @trace ARCH-000015
 * @shape 選定ID、操作ID、実行Provider、技術五項目、完全選定Hash、Attempt、Model、努力量と通知。
 * @invariant 選定の発行・消費は既存Ownerが行い、この型から権限を導出しない。
 * @boundary 選定OwnerとCoordinatorの実行計画構築の間。
 * @security 不透明Capabilityや認証情報を含めない。
 * @compatibility 既存消費結果の使用fieldだけを構造的に受理する。
 */
export type ModelSelection = Readonly<{
  selectionRecordId: string;
  operationId: string;
  executorProvider: AiProvider;
  executionSelection: AiModelSelection &
    Readonly<{ role: ExecutionSelection["role"] }>;
  selectionHash: string;
  taskAttempt: 0 | 1;
  model: string;
  effort: AiReasoningEffort;
  selectionNotice: string;
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
  networkPolicy: DockerNetworkPolicy;
  operationId: string;
  taskPacketRef: string;
  taskRole: "executor" | "reviewer";
  taskAttempt: 0 | 1;
  selectionHash: string;
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
export type ConsumedTaskPacket<P extends AiProvider> = Omit<
  TaskPacket,
  "taskWorkload"
> &
  (P extends "claude" ? Readonly<{ taskWorkload: unknown }> : unknown);

/**
 * 共通準備Runtimeへ渡す固定Provider依存を定義する。
 *
 * @responsibility 状態Storeを外から渡さず既存操作だけを受け取る。
 * @trace ARCH-000015
 * @shape 共通準備操作から二Storeを除き、乱数供給を加えた依存。
 * @invariant 候補Storeの共有や持込みを型の入力契約にしない。
 * @boundary 共通準備Runtimeと本番・局所試験の組立て境界。
 * @security Capabilityをこの型から生成・永続化しない。
 * @compatibility 既存二ProviderのFactory依存を維持する。
 */
export type PreparationHost<P extends AiProvider> = Omit<
  ProviderDockerPreparationState<
    ModelSelection,
    ConsumedTaskPacket<P>,
    AdvicePacket,
    Omit<
      PreparedAttemptPlan<P>,
      "authorityUseCapability" | "authorityControlCapability"
    >
  >,
  "prepared" | "managementCapabilities"
> &
  Readonly<{ randomBytes: (size: number) => Buffer }>;

/**
 * 照合済みDocker準備候補の公開結果を定義する。
 *
 * @responsibility 内部計画と公開可能な準備結果の境界を固定する。
 * @trace ARCH-000015
 * @shape 準備参照、操作・選定値、Lease状態とEffect前の固定値。Claudeだけに作業量を持つ。
 * @invariant preparedをProvider実行完了へ読み替えない。
 * @boundary 準備Storeと既存利用側の結果境界。
 * @security Path、秘密、commandと内部Authorityを公開しない。
 * @compatibility Provider別結果のfield有無と値を維持する。
 */
export type PreparedAttempt<P extends AiProvider = AiProvider> = Readonly<{
  status: "prepared";
  reason: string;
  preparedCapability: object;
  operationId: string;
  grantRef: string;
  selectionRecordId: string;
  selectedModel: string;
  selectedEffort: AiReasoningEffort;
  selectionNotice: string;
  providerHomeMountLeaseActive: true;
  dockerEffectIssued: false;
  filesystemEffectIssued: false;
  networkEffectIssued: false;
  processEffectIssued: false;
  providerRequestIssued: false;
  runtimeAuthorityIssued: false;
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
    result: Extract<StartResult, { status: "blocked" }>,
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
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeCleanup: (input: AttemptCleanupInput) => AttemptCleanupResult;
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordProviderSubmission?: (recoveryCapability: object) => boolean;
  recordResourceNotIssued?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    dockerId: string,
  ) => boolean;
  recordTerminalObservation?: (
    recoveryCapability: object,
    result: object,
    observation: RecordedAttemptObservation,
  ) => void;
  consumeProviderAuthority: (
    useCapability: unknown,
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    operationId: string;
    provider: string;
    providerHomeMountGrantRef: string;
    runtimeAuthorityIssued: true;
    providerEffectAllowed: true;
  }> | null;
}> &
  ProviderExecutionCallbacks;

/** 記録・Grant終了の結果を上位で保持する。 */
export type AttemptCleanupInput = Readonly<{
  plan: RecoveryPlan;
  recoveryCapability: object;
  managementCapability: unknown;
  recoveryId: string;
  observations: DockerSessionCleanup["resourceObservations"];
  mountCompletion: Readonly<{ status: string }> | null;
  mountLeaseReleased: boolean;
  homeLeaseReleased: boolean;
}>;

export type AttemptCleanupResult = Readonly<{
  mountLeaseReleased: boolean;
  homeLeaseReleased: boolean;
  recoveryCompleted: boolean;
  recoveryFinalizationCapability: object | null;
}>;
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
export type RecordedAttemptResult = CompletionResult & AttemptCleanupResult;
export type RecordedAttemptObservation = AttemptTerminalObservation &
  Readonly<{
    mountLeaseReleased: boolean;
    recoveryCompleted: boolean;
  }>;
export type RecordedStartResult =
  | Exclude<StartResult, { status: "started" }>
  | (Omit<Extract<StartResult, { status: "started" }>, "completion"> &
      Readonly<{ completion: Promise<RecordedAttemptResult> }>);
