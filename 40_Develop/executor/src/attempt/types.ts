/**
 * 単段実行の計画・準備に必要な技術値を定義する。
 * @packageDocumentation
 * @responsibility Task進行・保存を持たず、元Capabilityの消費と技術構成だけを扱う。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */
import type {
  AiModelSelection,
  AiReasoningEffort,
} from "../../../ai-adapter/src/index.ts";
import type {
  CommandObservation as CommandExecution,
  DockerExecutionHooks,
  DockerSessionCleanup,
  DockerCommandSession,
  DockerNetworkPolicy,
  DockerIsolationCommand,
  DockerIsolationRuntimeOptions,
  AdviceCommand,
} from "../../../docker-isolation/src/index.ts";
import type {
  RecoveryStartFailureDiagnostic,
  AttemptTerminalObservation,
  CompletionResult,
} from "../result/types.ts";
import type {
  ProcessStartedNotice,
  AttemptDiagnosticNotice as ProviderBoundaryDiagnosticNotice,
} from "./observation.ts";

/**
 * 上位Hostが所有する検査・保存だけを搬送する。
 * @responsibility 元操作の相関・保存と下位実行の注入境界を分ける。
 * @trace ARCH-000008
 * @shape 元の有限Host操作とPath／Receiptの借用。Process primitiveは含めない。
 * @invariant 一試行へ同じ管理参照・回復参照を結合する。
 * @boundary Coordinator等のHostと固定Executor。
 * @security 任意Command実装・生保存Ownerを渡さない。
 * @compatibility 既存Host操作の引数・返却値を維持する。
 */
export type ExecutorHost = Omit<
  RuntimeDependencies,
  | "effectExecutorAvailable"
  | "startCommand"
  | "startExecution"
  | "cleanupOwnedResources"
  | "verifyCleanupOutcome"
> &
  Required<
    Pick<
      RuntimeDependencies,
      | "recordProviderSubmission"
      | "recordResourceNotIssued"
      | "recordTerminalObservation"
    >
  > &
  DockerIsolationRuntimeOptions;

/**
 * 上位の固定操作と通知を一つの構成へまとめる。
 * @responsibility 準備と実行を別Factoryへ分けず保存Ownerの操作だけを受ける。
 * @trace ARCH-000008
 * @shape 準備・実行の固定callbackと任意の終了通知。
 * @invariant Process primitiveや外部Storeは受けない。
 * @boundary 上位Ownerと一試行の構成。
 * @security callbackの存在を認可成立とみなさない。
 * @compatibility 旧二Hostは公開しない。
 */
export type ExecutorOptions = Omit<ExecutorHost, "consumePreparedPlan"> &
  PreparationHost<"claude"> &
  Readonly<{
    onCompleted?: (result: CompletionResult) => void;
  }>;

/**
 * 一回消費される準備候補を管理するOwner。Factory呼出し自体は実行ではない。
 * @responsibility prepare・cancel・consumeの契約を明示する。
 * @trace ARCH-000015
 * @invariant 本番の返却型と公開型を別々に定義しない。
 */
export type AttemptPreparation<
  P extends "codex" | "claude" = "codex" | "claude",
> = Readonly<{
  productionAuthority: false;
  prepare: (input: AttemptInput) => AttemptPreparationResult<P>;
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
export type AttemptPreparationResult<
  P extends "codex" | "claude" = "codex" | "claude",
> = PreparedAttempt<P> | PreparationFailure;

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
  mounts: AttemptPaths;
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
export type PreparedAttemptPlan<P extends "codex" | "claude"> = Readonly<
  Omit<
    ProviderAttemptPlan,
    | "provider"
    | "subscriptionOffering"
    | "taskWorkload"
    | "recoveryCorrelationId"
    | "advicePacketRef"
    | "advicePacketHash"
    | "adviceCommandHash"
    | "adviceAllowedReferences"
    | "commands"
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
    commands: readonly DockerIsolationCommand[];
    authorityControlCapability: object;
    preparedWallClockMs: number;
    preparedMonotonicMs: number;
    selectionNotice: string;
  }
> &
  (P extends "claude"
    ? Readonly<{ taskWorkload: unknown }>
    : Readonly<Record<never, never>>);

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
export type ConsumedTaskPacket<P extends "codex" | "claude"> = Omit<
  TaskPacket,
  "taskWorkload"
> &
  (P extends "claude"
    ? Readonly<{ taskWorkload: unknown }>
    : Readonly<Record<never, never>>);

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
export type PreparationHost<P extends "codex" | "claude"> = Omit<
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
export type PreparedAttempt<P extends "codex" | "claude" = "codex" | "claude"> =
  Readonly<{
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
    (P extends "claude"
      ? Readonly<{ taskWorkload: unknown }>
      : Readonly<Record<never, never>>);

/**
 * 一試行へ搬送する技術選定を表す。
 * @responsibility 実行構成と役割だけを型で保持し、保存元・設定世代を持たない。
 * @trace ARCH-000015
 * @shape 五つの技術値と既存役割。
 * @invariant 完全選定の検査・Hash・Authorityは上位が所有する。
 * @boundary 上位選定Ownerと一試行の準備・開始。
 * @security この値だけで実行を許可しない。
 * @compatibility 保存Schemaではなく同期Host搬送契約である。
 */
export type AttemptSelection = AiModelSelection &
  Readonly<{
    role:
      | "coordinator"
      | "executor"
      | "independent_reviewer"
      | "result_integration"
      | "advice";
  }>;

/**
 * 全用途で共通の準備入力。用途だけでPacketの所有参照を区別する。
 * @responsibility Task・Advice・Probeを同じ準備入口へ渡す。
 * @trace ARCH-000015
 * @invariant 不透明参照をAuthorityへ変換せず、元Ownerの検証を維持する。
 */
export type AttemptInput = Readonly<{
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
 * 単段実行へ借用する固定Path値を表す。
 * @responsibility 元Hostが照合した用途別Pathの形だけを所有する。
 * @trace ARCH-000008
 * @shape 一試行のworkspaceとtmpだけ。
 * @invariant 値の存在だけから所在の真正性や使用許可を推定しない。
 * @boundary Hostの実体照合とExecutorの計画準備。
 * @security 公開Task結果へPathを搬送しない。
 * @compatibility 上位の全Path契約を所有しない。
 */
export type AttemptPaths = Readonly<{
  workspace: string;
  tmp: string;
}>;

/**
 * docker-effect-runtimeで使用するCommandの値契約を定義する。
 *
 * @responsibility CommandのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Commandが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Commandで宣言した値と責務の対応を維持する。
 * @boundary N/A: Commandの宣言は外部境界を開かない。
 * @security CommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Commandの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type Command = Readonly<{ purpose: string; argv: readonly string[] }>;

/**
 * docker-effect-runtimeで使用するPrepared Planの値契約を定義する。
 *
 * @responsibility Prepared PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PreparedPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PreparedPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: PreparedPlanの宣言は外部境界を開かない。
 * @security PreparedPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PreparedPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PreparedPlan = Readonly<{
  networkPolicy: DockerNetworkPolicy | null;
  provider: "codex" | "claude";
  operationId: string;
  grantRef: string;
  executionSelection: AttemptSelection;
  selectionHash: string;
  taskAttempt: 0 | 1;
  activeMountCapability: object;
  authorityUseCapability: object;
  providerHomeSourcePath: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  selectedModel: string;
  selectedEffort: AiReasoningEffort;
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  taskRole: "executor" | "reviewer" | null;
  taskWorkload?: unknown;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  advicePacketRef?: string | null;
  advicePacketHash?: string | null;
  adviceCommandHash?: string | null;
  adviceAllowedReferences?: readonly string[] | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;

/**
 * 単段計画へ上位が結合した利用側と相関を表す。
 * @responsibility 技術計画と配送用途・診断相関だけを結合する。
 * @trace ARCH-000008
 * @shape PreparedPlan、consumer、任意のrecoveryCorrelationId。
 * @invariant Task本体・Queue・再試行方針を含めない。
 * @boundary 上位の入力準備と単段Controller。
 * @security 診断相関を新たな回復Authorityとして使わない。
 * @compatibility 既存Controller計画の同じfieldを維持する。
 */
export type ProviderAttemptPlan = PreparedPlan &
  Readonly<{
    consumer: "coordinator_cli" | "workbench" | "orchestrator";
    recoveryCorrelationId?: string | null;
  }>;

/**
 * 既存Runtimeへ一回搬送する読取り助言Packetを表す。
 *
 * @responsibility PromptとProvider Commandを同じTask・Projection・固定選定・Operationへ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape Identity、Prompt、Command Hashおよび非共有境界からなる読取り専用値である。
 * @invariant Repository／Workspace共有、Tool、SessionおよびFallbackを許可しない。
 * @boundary Provider非依存Executorと既存Runtime Adapterの間。
 * @security Prompt本文以外のRepository情報や任意Pathを含めない。
 * @compatibility 形式名・版番号は要求せず、同じ操作・選定・Hashの結合を維持する。
 */
export type AdvicePacket = Readonly<{
  allowedReferences: readonly string[];
  packetRef: string;
  operationId: string;
  executionSelection: AttemptSelection;
  selectionHash: string;
  provider: "codex" | "claude";
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
 * @shape 選定ID、操作ID、実行Provider、技術六項目、完全選定Hash、Attempt、Model、努力量、速度と通知。
 * @invariant 選定の発行・消費は既存Ownerが行い、この型から権限を導出しない。
 * @boundary 選定OwnerとCoordinatorの実行計画構築の間。
 * @security 不透明Capabilityや認証情報を含めない。
 * @compatibility 既存消費結果の使用fieldだけを構造的に受理する。
 */
export type ModelSelection = Readonly<{
  selectionRecordId: string;
  operationId: string;
  executorProvider: "codex" | "claude";
  executionSelection: AttemptSelection;
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
 * docker-process-controllerで使用するCommand Handleの値契約を定義する。
 *
 * @responsibility Command HandleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CommandHandleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommandHandleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommandHandleの宣言は外部境界を開かない。
 * @security CommandHandleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommandHandleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CommandHandle = Readonly<{
  started: (timeoutMs: number) => Promise<boolean>;
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;

/**
 * docker-process-controllerで使用する回復の値契約を定義する。
 *
 * @responsibility 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Recoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Recoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: Recoveryの宣言は外部境界を開かない。
 * @security RecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Recoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-process-controllerで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RuntimeDependencies = Readonly<{
  effectExecutorAvailable: boolean;
  verifyRevision: (managementCapability: unknown) => unknown;
  consumePreparedPlan: (
    preparedCapability: unknown,
    managementCapability: unknown,
  ) => ProviderAttemptPlan | null;
  beginRecovery: (
    plan: ProviderAttemptPlan,
    managementCapability: unknown,
    observeFailure?: (diagnostic: RecoveryStartFailureDiagnostic) => void,
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
  startCommand?: (
    command: Command,
    plan: ProviderAttemptPlan,
    managementCapability: unknown,
  ) => CommandHandle;
  startExecution?: (
    plan: ProviderAttemptPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionHooks,
  ) => DockerCommandSession;
  cleanupOwnedResources: (
    plan: ProviderAttemptPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Promise<DockerSessionCleanup>;
  verifyCleanupOutcome?: (
    result: unknown,
    plan: ProviderAttemptPlan,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) => DockerSessionCleanup["resourceObservations"];
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeRecovery: (
    recoveryCapability: object,
    managementCapability: unknown,
    completion: Readonly<{
      plan: ProviderAttemptPlan;
      mountCompletion: Readonly<{ status: string }>;
    }>,
  ) => Readonly<{
    status: string;
    recoveryFinalizationCapability?: object;
  }>;
  verifyHomeLeaseRelease?: (
    recoveryCapability: unknown,
    managementCapability: unknown,
    operationId: unknown,
    recoveryId: unknown,
  ) => boolean;
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
    observation: AttemptTerminalObservation,
  ) => void;
  recordDockerAbsence?: (
    recoveryCapability: object,
    observations: DockerSessionCleanup["resourceObservations"],
  ) => boolean;
  recordMountCompletion?: (
    recoveryCapability: object,
    mountCompletion: Readonly<{ status: string }>,
  ) => boolean;
  reportProviderProcessStarted?: (
    notice: ProcessStartedNotice,
  ) => Promise<boolean>;
  reportProviderBoundaryDiagnostic?: (
    notice: ProviderBoundaryDiagnosticNotice,
  ) => Promise<boolean>;
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
}>;
