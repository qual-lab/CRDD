/**
 * Docker準備候補のLifecycleで共有する最小値契約を定義する。
 *
 * @responsibility Provider固有計画を再定義せず、短期準備状態と回収操作の型を保持する。
 * @trace ARCH-000015
 */
import type { OwnedMountPaths } from "../host-execution/operation-workspace-lifecycle.ts";
import type { WorkbenchAiAdviceRuntimePacket } from "../workbench-ai/advice-packet.ts";

/**
 * 実清掃が確認した一資源の終端観測を搬送する。
 *
 * @responsibility 明示未要求、exact不存在と観測不能を区別する。
 * @trace ARCH-000008
 * @shape 固定purpose、予定資源名、作成IDと三値の終了観測。
 * @invariant 欠測を未要求または不存在へ補完しない。
 * @boundary Docker Effectの回収とCoordinator保存Ownerの間。
 * @security Authority、認証情報、Host PathまたはProvider本文を含めない。
 * @compatibility 最新Snapshotの資源別相関へ接続し、集約boolから再構成しない。
 */
export type ProviderDockerResourceCleanupObservation = Readonly<{
  purpose:
    | "create_egress_network"
    | "create_internal_network"
    | "create_provider"
    | "create_proxy"
    | "create_subscription_auth_probe";
  plannedResourceName: string;
  dockerId: string | null;
  observation: "not_requested" | "absent" | "unknown";
}>;

/**
 * 共通実行計画が照合する消費済みModel選定の値契約。
 *
 * @responsibility 操作・Profile・Providerと選定結果の相関を保持する。
 * @trace ARCH-000015
 * @shape 選定ID、操作ID、実行Provider、Profile、Model、根拠、努力量、速度と通知。
 * @invariant 選定の発行・消費は既存Ownerが行い、この型から権限を導出しない。
 * @boundary 選定OwnerとCoordinatorの実行計画構築の間。
 * @security 不透明Capabilityや認証情報を含めない。
 * @compatibility 既存消費結果の使用fieldだけを構造的に受理する。
 */
export type ProviderDockerModelSelection = Readonly<{
  selectionRecordId: string;
  operationId: string;
  executorProvider: "codex" | "claude";
  profileId: string;
  model: string;
  basis: unknown;
  effort: "low" | "medium" | "high";
  modelTier: string;
  speedMode: "normal";
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
export type ProviderDockerTaskPacket = Readonly<{
  operationId: string;
  taskPacketRef: string;
  taskRole: "executor" | "reviewer";
  taskWorkload?: unknown;
  taskPacketHash: string;
  prompt: string;
  promptTransport: "provider_stdin_only";
}>;

/**
 * 準備候補の取消・期限・消費へ必要な値契約。
 *
 * @responsibility 操作Identity、Home Lease、権限失効と二時計の時刻を保持する。
 * @trace ARCH-000015
 * @shape 計画が既に持つIdentity、Capabilityおよび準備時刻の部分集合。
 * @invariant CLI、Model、Provider選定や外部送信権限を新設しない。
 * @boundary Provider準備計画とCoordinatorの共通Lifecycleの型境界。
 * @security Capabilityを公開結果やログへ複製しない。
 * @compatibility 既存両Providerの計画を構造的に受理し、その具体型を消費結果へ保持する。
 */
export type ProviderPreparedPlanLifecycle = Readonly<{
  operationId: string;
  grantRef: string;
  activeMountCapability: object;
  authorityControlCapability: object;
  preparedWallClockMs: number;
  preparedMonotonicMs: number;
}>;

/**
 * Provider準備候補を保持する既存状態のLifecycle接続契約。
 *
 * @responsibility 呼出し側所有の二WeakMapと時計・失効・Mount解放を共通処理へ接続する。
 * @trace ARCH-000015
 * @shape 具体計画のStore、管理Capability対応、二時計と既存回収関数。
 * @invariant Storeを生成・コピーせず、元のProvider状態だけを操作する。
 * @boundary Coordinator内の準備Ownerと共通Lifecycleの型境界。
 * @security 管理Capabilityの参照一致を省略しない。
 * @compatibility Provider固有RuntimeStateの既存fieldから接続する。
 */
export type ProviderPreparationLifecycleState<
  T extends ProviderPreparedPlanLifecycle,
> = Readonly<{
  prepared: WeakMap<object, T>;
  managementCapabilities: WeakMap<object, object>;
  wallNow: () => number;
  monotonicNow: () => number;
  revokeProviderAuthority: (
    controlCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
}>;

/**
 * 実行前のDockerコマンド値契約。
 *
 * @responsibility 固定目的と引数配列の対応を保持する。
 * @trace ARCH-000015
 * @shape purposeと読み取り専用argv。
 * @invariant 引数をshell文字列へ変換しない。
 * @boundary 準備OwnerとDocker実行Ownerの間。
 * @security Promptを含めず、秘密を含み得る内部引数を公開しない。
 * @compatibility 既存両ProviderのCommandと同じ値構造を維持する。
 */
export type ProviderDockerCommand = Readonly<{
  purpose: string;
  argv: readonly string[];
}>;

/**
 * 照合済みDocker資源とProvider記述の組立て入力。
 *
 * @responsibility 共通Docker引数とProvider固有の固定CLI条件を接続する。
 * @trace ARCH-000015
 * @shape 資源名、Mount、配布物、環境、CLI、対話・起動・Workspace条件。
 * @invariant Model選定やAuthorityを再定義せず、照合済み値だけを受け取る。
 * @boundary Coordinator内の準備Ownerと共通コマンド組立ての間。
 * @security Proxy Tokenと認証Homeは内部計画に限定し、公開結果へ搬送しない。
 * @compatibility 既存二Providerの九コマンドと順序を維持する。
 */
export type ProviderDockerCommandPlanInput = Readonly<{
  provider: "codex" | "claude";
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  providerHomeMount: string;
  tmpMount: string;
  workspaceMount: string | null;
  proxyToken: string;
  providerEnvironmentEntries: readonly string[];
  authenticationEnvironmentArguments: readonly string[];
  authenticationArgv: readonly string[];
  providerArgv: readonly string[];
  interactive: boolean;
  taskRole: "executor" | "reviewer" | null;
  initRequired: boolean;
  executorSeccompProfile: string | null;
}>;

/**
 * Docker準備値へ乱数を供給する型契約。
 *
 * @responsibility 呼出し側所有の乱数関数だけを共通値生成へ接続する。
 * @trace ARCH-000015
 * @shape byte数を受けBufferを返すrandomBytes。
 * @invariant 新しい乱数OwnerやStoreを生成しない。
 * @boundary Provider準備状態と共通値生成の間。
 * @security 取得した秘密値は内部準備計画に限定する。
 * @compatibility 既存RuntimeStateの同じ関数をそのまま利用する。
 */
export type ProviderDockerRandomSource = Readonly<{
  randomBytes: (size: number) => Buffer;
}>;

/**
 * Docker準備候補の固定資源名の型契約。
 *
 * @responsibility 認証・Provider・Proxyと二Networkの名前対応を保持する。
 * @trace ARCH-000015
 * @shape 五資源名とownershipLabel。
 * @invariant 各値は準備名であり実資源の存在・所有を証明しない。
 * @boundary 計画生成とDocker実行Ownerの間。
 * @security 名前からcleanup Authorityを発行しない。
 * @compatibility 既存両Providerのprefixと命名規則を維持する。
 */
export type ProviderDockerResourceNames = Readonly<{
  internalNetworkName: string;
  egressNetworkName: string;
  proxyContainerName: string;
  authContainerName: string;
  providerContainerName: string;
  ownershipLabel: string;
}>;

/**
 * 準備Ownerが照合した操作とMountの値契約。
 *
 * @responsibility 操作Identityと固定Mount対応を保持する。
 * @trace ARCH-000015
 * @shape operationId、createdAt、OwnedMountPaths。
 * @invariant 同じ操作へ結合した値だけを後続へ渡す。
 * @boundary Mount照合Ownerと共通準備の間。
 * @security Pathを公開結果へ含めない。
 * @compatibility 既存OperationBindingの形を維持する。
 */
export type ProviderDockerOperationBinding = Readonly<{
  operationId: string;
  createdAt: string;
  mounts: OwnedMountPaths;
}>;

/**
 * 有効化したProvider Home Grantの値契約。
 *
 * @responsibility 操作・Profile・Homeとローカル主体の固定対応を保持する。
 * @trace ARCH-000015
 * @shape Grant参照、Provider・Profile・操作Identityと四Hash。
 * @invariant 取得済みGrantを再発行・補完しない。
 * @boundary Home Mount Ownerと共通準備の間。
 * @security ローカル主体とHomeの結合を省略しない。
 * @compatibility 既存activateMount結果のGrantをそのまま使用する。
 */
export type ProviderDockerMountGrant = Readonly<{
  grantRef: string;
  provider: string;
  profileId: string;
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
export type ProviderDockerPreparedAuthority = Readonly<{
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
  prepared: WeakMap<object, NoInfer<P> & ProviderDockerPreparedAuthority>;
  managementCapabilities: WeakMap<object, object>;
  verifyOperationMount: (
    managementCapability: unknown,
    mountCapability: unknown,
  ) => ProviderDockerOperationBinding;
  activateMount: (
    mountAuthorizationCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    status: string;
    grant: ProviderDockerMountGrant | null;
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
    profileId: string | null;
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
export type ProviderDockerPreparedPlan<P extends "codex" | "claude"> =
  Readonly<{
    provider: P;
    operationId: string;
    recoveryCorrelationId: string | null;
    consumer: "coordinator_cli" | "workbench" | "orchestrator";
    grantRef: string;
    profileId: string;
    activeMountCapability: object;
    authorityUseCapability: object;
    authorityControlCapability: object;
    providerHomeSourcePath: string;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    preparedWallClockMs: number;
    preparedMonotonicMs: number;
    authContainerName: string;
    providerContainerName: string;
    proxyContainerName: string;
    internalNetworkName: string;
    egressNetworkName: string;
    ownershipLabel: string;
    providerImageDigest: string;
    proxyImageDigest: string;
    selectionRecordId: string;
    subscriptionOffering: P extends "codex"
      ? "chatgpt_subscription_oauth"
      : "claude_max";
    selectedModel: string;
    selectedEffort: "low" | "medium" | "high";
    selectedModelTier: string;
    selectionNotice: string;
    operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
    taskRole: "executor" | "reviewer" | null;
    taskPacketRef: string | null;
    taskPacketHash: string | null;
    advicePacketRef: string | null;
    advicePacketHash: string | null;
    adviceCommandHash: string | null;
    providerInput: string | null;
    workspaceSourcePath: string | null;
    workspaceMountMode: "read_write" | "read_only" | null;
    commands: readonly ProviderDockerCommand[];
  }> &
    (P extends "claude"
      ? Readonly<{ taskWorkload: unknown }>
      : Readonly<Record<never, never>>);

/**
 * 準備Ownerが消費したModel選定の完全な値契約を定義する。
 *
 * @responsibility 共通計画の使用fieldと既存の委譲相関fieldを保持する。
 * @trace ARCH-000015
 * @shape 選定値、Front Provider、routeと委譲深度。
 * @invariant 選定の消費・再選定判断を型宣言から発行しない。
 * @boundary CoordinatorのDocker準備・計画・Lifecycleの型境界。
 * @security Capability、PathとProvider入力を公開・永続化する権限を持たない。
 * @compatibility 既存Provider別のfield有無と具体型を保持する。
 */
export type ProviderDockerConsumedModelSelection =
  ProviderDockerModelSelection &
    Readonly<{
      frontProvider: "codex" | "claude";
      route: string;
      delegationDepth: number;
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
export type ProviderDockerConsumedTaskPacket<P extends "codex" | "claude"> =
  Omit<ProviderDockerTaskPacket, "taskWorkload"> &
    (P extends "claude"
      ? Readonly<{ taskWorkload: unknown }>
      : Readonly<Record<never, never>>);

/**
 * 共通Docker準備のProvider別状態を定義する。
 *
 * @responsibility 同じ準備操作群に独立した候補Storeと具体計画型を接続する。
 * @trace ARCH-000015
 * @shape 共通準備状態、乱数と任意の固定Seccomp検証。
 * @invariant ProviderごとのStoreと管理対応を共有せず、取消後に再利用しない。
 * @boundary CoordinatorのDocker準備・計画・Lifecycleの型境界。
 * @security Capability、PathとProvider入力を公開・永続化する権限を持たない。
 * @compatibility 既存Provider別のfield有無と具体型を保持する。
 */
export type ProviderDockerRuntimeStateBase<P extends "codex" | "claude"> =
  ProviderDockerPreparationState<
    ProviderDockerConsumedModelSelection,
    ProviderDockerConsumedTaskPacket<P>,
    WorkbenchAiAdviceRuntimePacket,
    Omit<
      ProviderDockerPreparedPlan<P>,
      "authorityUseCapability" | "authorityControlCapability"
    >
  > &
    ProviderDockerRandomSource;

/**
 * 共通状態に固定Providerの計画検証依存を加える。
 *
 * @responsibility 共通Store契約とProvider固有依存の型境界を保持する。
 * @trace ARCH-000015
 * @shape 共通状態とCodexだけの固定Seccomp検証。
 * @invariant Storeと公開結果のProvider相関を維持する。
 * @boundary 共通準備とProvider固有計画の間。
 * @security 検証依存からAuthorityを生成しない。
 * @compatibility 既存Providerの依存fieldを保持する。
 */
export type ProviderDockerRuntimeState<P extends "codex" | "claude"> =
  ProviderDockerRuntimeStateBase<P> &
    (P extends "codex"
      ? Readonly<{
          verifyExecutorSeccompProfile?: (
            expectedSha256: string,
            expectedBytes: number,
          ) => string | null;
        }>
      : Readonly<Record<never, never>>);

/**
 * 共通準備Runtimeへ渡す固定Provider依存を定義する。
 *
 * @responsibility 状態Storeを外から渡さず既存操作だけを受け取る。
 * @trace ARCH-000015
 * @shape Provider別RuntimeStateから二Storeを除いた依存。
 * @invariant 候補Storeの共有や持込みを型の入力契約にしない。
 * @boundary 共通準備Runtimeと本番・局所試験の組立て境界。
 * @security Capabilityをこの型から生成・永続化しない。
 * @compatibility 既存二ProviderのFactory依存を維持する。
 */
export type ProviderDockerRuntimeDependencies<P extends "codex" | "claude"> =
  Omit<
    ProviderDockerRuntimeStateBase<P>,
    "prepared" | "managementCapabilities"
  > &
    Pick<
      ProviderDockerRuntimeState<P>,
      Exclude<
        keyof ProviderDockerRuntimeState<P>,
        keyof ProviderDockerRuntimeStateBase<P>
      >
    >;

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
export type ProviderDockerPreparedResult<P extends "codex" | "claude"> =
  Readonly<{
    status: "prepared";
    reason: string;
    preparedCapability: object;
    operationId: string;
    grantRef: string;
    selectionRecordId: string;
    selectedModel: string;
    selectedEffort: "low" | "medium" | "high";
    selectedModelTier: string;
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
 * 二Providerの具体計画・局所検査・公開値生成を接続する型契約。
 *
 * @responsibility 共通準備の順序を変えず、具体値型と既存結果を保持する。
 * @trace ARCH-000015
 * @shape 固定Ownerが渡す計画生成、Task検査、blocked生成とprepared生成。
 * @invariant registry、動的Plugin、別Packageからの逆依存を作らない。
 * @boundary Coordinator内の二つの既存準備実装だけに使用する。
 * @security callbackを外部入力から選択せず、Capabilityを新設しない。
 * @compatibility Provider別結果のfield有無と既存理由値を維持する。
 */
export type ProviderDockerPreparationCallbacks<
  M,
  T,
  A,
  P extends object,
  B,
  R,
> = Readonly<{
  blockedResult: (reason: string) => B;
  validateTask?: (task: T) => string | null;
  buildPlan: (
    binding: ProviderDockerOperationBinding,
    activation: Readonly<{
      grant: ProviderDockerMountGrant;
      activeMountCapability: object;
    }>,
    selection: M,
    providerHomeSourcePath: string,
    wallClockMs: number,
    monotonicMs: number,
    task: T | null,
    advice: A | null,
    recoveryCorrelationId: string | null,
    consumer: "coordinator_cli" | "workbench" | "orchestrator",
  ) => P | null;
  preparedResult: (
    plan: P & ProviderDockerPreparedAuthority,
    capability: object,
    binding: ProviderDockerOperationBinding,
    activation: Readonly<{
      grant: ProviderDockerMountGrant;
      activeMountCapability: object;
    }>,
  ) => R;
}>;
