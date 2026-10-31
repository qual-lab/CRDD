/**
 * 単発実行の入力・通知・開始結果・完了結果に必要な型を定義する。
 * @packageDocumentation
 * @responsibility 試行の技術構成と型付き結果を定義し、Task進行・検査・状態遷移・保存は行わない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */
import type { ATTEMPT_COMPLETION_REASONS } from "./constants.ts";
import type {
  ProviderTurnCountDiagnostic,
  TaskReviewFinding,
  ProviderResultParseResult,
  TaskResult,
  AdviceResult,
  AiModelSelection,
  AiProvider,
} from "../../../ai-adapter/src/index.ts";
import type {
  DockerResourceCleanupObservation,
  DockerIsolationCommand,
  DockerNetworkPolicy,
  AdviceCommand,
  HomeLease,
  DockerExecutionCallbacks,
  DockerCommandSession,
  DockerSessionCleanup,
  DockerResourceReceipts,
} from "../../../docker-isolation/src/index.ts";

/**
 * 承認前に参照できる助言Commandと、同じ内容の技術Hash。
 * @responsibility 本文・許可・資源を取得せず、既存DIの値契約だけを搬送する。
 * @trace ARCH-000015
 * @invariant 準備成功は実行許可・Image存在・送信成立を意味しない。
 */
export type PreparedAdviceCommand = Readonly<{
  command: AdviceCommand;
  commandHash: string;
}>;

/** 固定隔離実装の内部接続。公開APIや業務操作の差替え口ではない。 */
export interface IsolationRuntime {
  acquireHomeLease(bindingHash: string): HomeLease | null;
  startExecution(
    plan: AttemptPlan,
    recovery: object,
    management: object,
    hooks: DockerExecutionCallbacks,
  ): DockerCommandSession;
  cleanupOwnedResources(
    plan: AttemptPlan,
    recovery: object,
    management: unknown,
  ): Promise<DockerSessionCleanup>;
  verifyCleanupOutcome(
    result: unknown,
    plan: AttemptPlan,
    recovery: unknown,
    management: unknown,
  ): DockerSessionCleanup["resourceObservations"];
}

/**
 * docker-process-controllerで使用するExecution 記録の値契約を定義する。
 *
 * @responsibility Execution 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ExecutionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionRecordの宣言は外部境界を開かない。
 * @security ExecutionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionRecord = {
  homeLease: HomeLease;
  homeLeaseReleased: boolean;
  homeLeaseReleaseAttempted: boolean;
  finished: boolean;
  controlCapability: object;
  recovery: AttemptReference;
  managementCapability: object;
  cancellationRequested: boolean;
  cancelExecution:
    | (() => Promise<
        Readonly<{
          cancellationRequested: true;
          processTerminationObserved: boolean;
        }>
      >)
    | null;
};

/**
 * docker-process-controllerで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RuntimeState = Readonly<{
  isolation: IsolationRuntime;
  callbacks: ExecutorCallbacks;
  controls: WeakMap<object, ExecutionRecord>;
}>;

/**
 * 通常実行と回収で観測した技術資源の事実を上位へ通知する。
 * @responsibility 資源観測と全技術処理終了を区別し、保存方法やACKを所有しない。
 * @trace ARCH-000008
 * @invariant 同期回収APIでは通知のPromise返却を拒否し、保存未完了で削除へ進まない。
 * @boundary 通常実行のonResourcesClosedは全終了確認後。回収APIではunknownを含む観測集合も通知する。
 * @security 通知発行自体は不存在・Home解放・回収成功の保証ではない。最終段階通知も成功保証ではない。
 */
export interface ResourceCleanupCallbacks<
  Observation = AttemptTerminalObservation,
> {
  onResourceInspecting?(purpose: keyof DockerResourceReceipts): void;
  onResourceIdentified?(
    purpose: keyof DockerResourceReceipts,
    dockerId: string,
  ): void;
  onResourcesClosed?(observation: Observation): void | Promise<void>;
  onCleanupCompleted?(observation: Observation): void | Promise<void>;
}

/**
 * 単発実行の通知を共通の資源回収通知へ追加する。
 * @responsibility 同じ試行の開始・診断・結果だけを通知する。
 * @trace ARCH-000008
 * @invariant 必要通知は完了後だけ継続し、任意通知は実行結果を変更しない。
 */
export interface ExecutorCallbacks extends ResourceCleanupCallbacks {
  onCommandSubmitting?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onCommandNotIssued?(
    purpose: DockerIsolationCommand["purpose"],
  ): void | Promise<void>;
  onProviderSubmitting?(): void | Promise<void>;
  onResourceCreated?(
    purpose: DockerIsolationCommand["purpose"],
    dockerId: string,
  ): void | Promise<void>;
  onStarted?(notice: ProcessStartedNotice): void | Promise<void>;
  onCompleted?(
    result: CompletionResult,
    observation: AttemptTerminalObservation,
  ): void | Promise<void>;
  onDiagnostic?(notice: AttemptDiagnosticNotice): void | Promise<void>;
}

/**
 * 上位が選定・検査した一つのAttemptの回収対象。
 * @responsibility 保存Schemaを持たず、既存技術投影と現在Ownerの確認だけを借用する。
 * @trace ARCH-000008
 * @invariant IDだけで処置を許可せず、各要求直前のOwner確認を必須とする。
 */
export type AttemptRecoveryTarget = Readonly<{
  operationId: string;
  recoveryId: string;
  projection: AttemptRecordProjection &
    Readonly<{
      workspaceProtected?: boolean;
      workspaceProtection?: AttemptRequest["target"]["workspaceProtection"];
    }>;
  receipts: DockerResourceReceipts;
  previouslyAbsent?: readonly (keyof DockerResourceReceipts)[];
  managementDirectory: string | null;
  assertOwner: () => boolean;
}>;

/**
 * 診断だけで得た技術資源の観測。
 * @responsibility 存在・不存在・不明とconfig終了を区別する。
 * @trace ARCH-000008
 * @invariant 診断の成功を削除許可・保存確定へ昇格しない。
 */
export type AttemptResourceInspection = Readonly<{
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  configCleanupConfirmed: boolean;
  resources: readonly Readonly<{
    purpose: keyof DockerResourceReceipts;
    plannedResourceName: string;
    dockerId: string | null;
    observation: "not_requested" | "present" | "absent" | "unknown";
    absenceObservations: readonly ("absent" | "unknown")[];
  }>[];
}>;

/**
 * Attempt資源の技術回収結果。
 * @responsibility 資源別観測とconfig終了を元のAttemptへ結合して返す。
 * @trace ARCH-000008
 * @invariant Docker回収とTask完了・Host清掃・履歴確定を混同しない。
 */
export type AttemptCleanupResult = Readonly<{
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  dockerCleanupConfirmed: boolean;
  configCleanupConfirmed: boolean;
  resources: readonly DockerResourceCleanupObservation[];
}>;

/**
 * 上位の保存Ownerが確定した参照を単発実行へ借用する内部契約。
 * @responsibility 記録の作成・回復許可を所有せず、結果と技術資源へ同じ参照を搬送する。
 * @trace ARCH-000008
 */
export type AttemptReference = Readonly<{
  recoveryId: string;
  recoveryCapability: object;
}>;

/**
 * 上位が照合した単発実行の対象・選定・内容をまとめる。
 * @responsibility 技術Path・Home同一性と用途別本文を受け、GrantやTaskを管理しない。
 * @trace ARCH-000015
 */
export type AttemptRequest = Readonly<{
  selection: AiModelSelection;
  target: Readonly<{
    operationId: string;
    grantRef: string;
    provider: string;
    workspaceSourcePath: string;
    temporarySourcePath: string;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
    providerHomeSourcePath: string;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    activeMountCapability: object;
  }>;
}> &
  (
    | Readonly<{ purpose: "probe" }>
    | Readonly<{
        purpose: "task";
        input: string;
        taskRole: "executor" | "reviewer";
        taskWorkload?: unknown;
        networkPolicy: DockerNetworkPolicy;
      }>
    | Readonly<{
        purpose: "advice";
        input: string;
        commandHash: string;
        command: AdviceCommand;
        allowedReferences: readonly string[];
      }>
  );

/**
 * 開始前の耐久記録に必要な隔離資源の投影。
 * @responsibility 資源名・Image・Modeだけを共有し、実行手順や本文を公開しない。
 * @trace ARCH-000008
 * @invariant コピーから実行を開始できず、記録の確定とAuthorityは上位が所有する。
 */
export type AttemptRecordProjection = Readonly<{
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  workspaceMountMode: "read_write" | "read_only" | null;
}>;

/**
 * Factory内部だけが保持する一試行の技術構成。
 * @responsibility AI Adapterの実行指定とDocker Commandを結合し、上位へ往復させない。
 * @trace ARCH-000008
 * @invariant 業務Authorityと記録保存は上位が所有する。
 */
export type AttemptPlan = AttemptRecordProjection &
  Readonly<{
    networkPolicy: DockerNetworkPolicy | null;
    provider: AiProvider;
    operationId: string;
    grantRef: string;
    executionSelection: AiModelSelection;
    activeMountCapability: object;
    providerHomeSourcePath: string;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    taskRole: "executor" | "reviewer" | null;
    taskWorkload?: unknown;
    adviceCommandHash?: string | null;
    adviceAllowedReferences?: readonly string[] | null;
    providerInput: string | null;
    workspaceSourcePath: string | null;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
    commands: readonly DockerIsolationCommand[];
  }>;

/**
 * 一試行の非秘密診断を表す。
 * @responsibility 構成・技術終了観測を相関した閉じた通知へ限定する。
 * @trace ARCH-000008
 * @shape eventを判別子とするProvider・操作・試行と固定診断値。
 * @invariant 一次故障と清掃・終了観測を別fieldで保持する。
 * @boundary Executorから上位の診断Consumer。
 * @security 生出力・Command本文・認証値を含めない。
 * @compatibility 元の通知名・相関field・三値の意味を維持する。
 */
export type AttemptDiagnosticNotice =
  | Readonly<{
      event: "coordinator_provider_boundary_configured";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      approvalModeConfigured:
        | "approve_for_me"
        | "never"
        | "not_applicable"
        | "other";
      sandboxModeConfigured:
        | "read_only"
        | "implicit"
        | "not_applicable"
        | "other";
      workspaceMountModeConfigured: "read_write" | "read_only" | null;
      networkPolicyHash: string | null;
      rootFilesystemReadOnlyConfigured: boolean;
      nonRootUserConfigured: boolean;
      workdirConfigured: boolean;
    }>
  | Readonly<{
      event: "coordinator_provider_boundary_settled";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      recoveryId: string;
      providerContainerCreatedObserved: boolean;
      providerProcessStartedObserved: boolean;
      providerProcessCompletionObserved: boolean;
      providerProcessExitStatusClass:
        | "zero"
        | "one"
        | "one_two_six"
        | "one_two_seven"
        | "other_nonzero"
        | "signal"
        | "not_observed";
      processTreeTerminationObserved: boolean;
      containersAbsentObserved: boolean;
      networksAbsentObserved: boolean;
      cleanupConfirmed: boolean;
      primaryFailure: PrimaryFailureDiagnostic | null;
    }>;

/**
 * docker-process-controllerで使用するProvider Process Started Noticeの値契約を定義する。
 *
 * @responsibility Provider Process Started NoticeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProcessStartedNoticeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProcessStartedNoticeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProcessStartedNoticeの宣言は外部境界を開かない。
 * @security ProcessStartedNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProcessStartedNoticeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProcessStartedNotice = Readonly<{
  event: "coordinator_provider_process_started";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
}>;

/**
 * 用途別内容を同じ試行結果へ載せる。
 * @responsibility Task・Advice・Probeの検査済み内容を型付きで返す。
 * @trace ARCH-000015
 * @shape 用途ごとの既存結果形のunion。
 * @invariant 内容と技術終了・回収状態を同一視しない。
 * @boundary Executorのcompletion結果。
 * @security 生Envelope・所見本文を追加しない。
 * @compatibility 内容fieldを用途間で無理に共通化しない。
 */
export type AttemptContent =
  | TaskResult
  | AdviceResult
  | NonNullable<ProviderResultParseResult<"probe">["normalizedResult"]>;

/**
 * 開始成功・拒否ごとに必要な組立て入力を表す。
 * @responsibility 元Control・Promise又は拒否と回復義務を受け、準備内部状態を受け取らない。
 * @trace ARCH-000008
 * @invariant 選択情報は準備Ownerが確定済みの三値だけを受け取る。
 */
export type StartResultInput = Readonly<
  {
    selection?: Readonly<{
      notice: string | null;
      model: string | null;
      effort: string | null;
    }>;
  } & (
    | {
        status: "started";
        controlCapability: object;
        completion: Promise<CompletionResult>;
        operationId: string;
        recoveryId: string;
        preparationFailed?: false;
      }
    | {
        status: "blocked";
        reason: string;
        cleanupConfirmed?: boolean;
        recoveryId?: string | null;
        manualRecoveryRequired?: boolean;
        preparationFailed?: boolean;
      }
  )
>;

/**
 * 一試行の終端状態と技術観測を受け取る組立て入力。
 * @responsibility 清掃・結果内容・診断を名前で識別できる形で受け取る。
 * @trace ARCH-000008
 * @invariant 各観測の成立は実行Ownerが確認し、Factoryは既存の公開相関を適用する。
 */
export type CompletionResultInput = Readonly<{
  status: "completed" | "blocked" | "cancelled";
  reason: AttemptResultReason;
  operationId: string;
  recoveryId: string;
  providerRequestStarted: boolean;
  cancellationRequested: boolean;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  homeLeaseReleased: boolean;
  resultSha256: string | null;
  resultBytes: number;
  normalizedResult: AttemptContent | null;
  reviewFindings?: readonly TaskReviewFinding[] | null;
  providerExecutionObservation?: CompletionResult["providerExecutionObservation"];
  providerTurnObservation?: CompletionResult["providerTurnObservation"];
  subscriptionAuthConfirmed: boolean;
}>;

/**
 * 同じ固定接続で技術準備・開始・取消・明示終了を提供するExecutor。
 * @responsibility 操作ごとの引数と結果を明示し、Factoryを型検査する。
 * @trace ARCH-000008
 * @invariant 実装由来の型抽出を正本にせず、別の状態管理を追加しない。
 */
export type Executor = Readonly<{
  recordProjection: AttemptRecordProjection;
  abandon(recoveryCapability: unknown, managementCapability: unknown): boolean;
  start(
    managementCapability: unknown,
    reference: AttemptReference,
    callbacks?: ExecutorCallbacks,
  ): StartResult;
  cancel(
    controlCapability: unknown,
    managementCapability: unknown,
  ): Promise<
    Readonly<
      | { status: "blocked"; reason: "invalid" | "duplicate" }
      | {
          status: "requested";
          reason: "provider_cancellation_requested";
          cancellationRequested: true;
          processTerminationObserved: true;
        }
      | {
          status: "requested";
          reason: "provider_cancellation_grace_exceeded";
          cancellationRequested: true;
          processTerminationObserved: false;
        }
    >
  >;
}>;

/**
 * 一試行の開始結果。開始済みと拒否で必要な項目を区別する。
 * @responsibility 利用側がstatusで制御・完了Promiseと回復義務を判断できる契約を定義する。
 * @trace ARCH-000008
 * @invariant 受付・開始とProvider開始・最終結果を混同しない。
 */
export type StartResult = Readonly<
  {
    providerRequestStarted: false;
    normalizedResult: null;
    rawOutputReported: false;
    untrustedProviderTextReported: false;
    credentialAbsenceVerified: false;
    hostPathReported: false;
    proxyCredentialReported: false;
  } & (
    | {
        selectionNotice: string | null;
        selectedModel: string | null;
        selectedEffort: string | null;
      }
    | { selectionNotice?: never; selectedModel?: never; selectedEffort?: never }
  ) &
    (
      | {
          status: "started";
          reason: "docker_process_controller_started";
          controlCapability: object;
          completion: Promise<CompletionResult>;
          operationId: string;
          recoveryId: string;
          dockerEffectStarted: true;
          normalizedResultReportedAfterCleanupOnly: true;
          preparationFailed?: false;
        }
      | {
          status: "blocked";
          reason: string;
          controlCapability: null;
          completion: null;
          operationId: null;
          recoveryId: string | null;
          cleanupConfirmed: boolean;
          manualRecoveryRequired: boolean;
          dockerEffectStarted: false;
          preparationFailed?: boolean;
        }
    )
>;

/**
 * 清掃を含む一試行の明示的な最終結果契約。
 * @responsibility 内容・診断・清掃・回復の観測を区別して利用側へ返す。
 * @trace ARCH-000008
 * @invariant Factoryがこの型を満たし、資源観測の相関条件は既存の組立てで維持する。
 */
export type CompletionResult = Readonly<{
  status: "completed" | "blocked" | "cancelled";
  reason: AttemptResultReason | "docker_process_controller_cleanup_unconfirmed";
  operationId: string;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  dockerEffectStarted: true;
  providerRequestStarted: boolean;
  cancellationRequested: boolean;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  homeLeaseReleased: boolean;
  cleanupConfirmed: boolean;
  resultSha256: string | null;
  resultBytes: number;
  normalizedResult: AttemptContent | null;
  providerExecutionObservation: NonNullable<
    ProviderResultParseResult["providerExecutionObservation"]
  > | null;
  providerTurnObservation: Readonly<Record<string, unknown>> | null;
  reviewFindings: readonly TaskReviewFinding[] | null;
  subscriptionAuthConfirmed: boolean;
  rawOutputReported: false;
  untrustedProviderTextReported: false;
  credentialAbsenceVerified: false;
  hostPathReported: false;
  proxyCredentialReported: false;
}>;

/**
 * 固定コールバックへ直接渡す非秘密の終端観測。
 * @responsibility 実行結果と清掃・回復の観測を元操作へ結合する。
 * @trace ARCH-000008
 * @shape 操作ID、回復参照、資源観測と解放状態。
 * @invariant object原本照会や新しいAuthorityを必要としない。
 * @boundary Executorと信頼したHostの内部callback。
 * @security 外部DTOの受付形式として公開しない。
 * @compatibility 既存終端観測と同じ事実だけを搬送する。
 */
export type AttemptTerminalObservation = Readonly<{
  operationId: string;
  recoveryId: string;
  resources: readonly DockerResourceCleanupObservation[] | null;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  primaryFailure: PrimaryFailureDiagnostic | null;
  homeLeaseReleased: boolean;
}>;

/**
 * Docker Process Controllerの最終理由を表す。
 *
 * @responsibility 公開失敗理由と完了・取消理由の閉じた型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定公開理由へ完了と取消の二状態を加えた文字列unionである。
 * @invariant 未知理由またはProvider生出力を含まない。
 * @boundary Docker Process Controller内部結果から最終公開結果への境界。
 * @security 固定理由だけを公開する。
 * @compatibility 利用側は宣言済みの最終理由だけへ依存する。
 */
export type AttemptResultReason =
  | AttemptFailureReason
  | "provider_operation_completed"
  | "provider_operation_cancelled";

/**
 * 最初の失敗を後続の清掃結果と分けて説明する。
 *
 * @responsibility 固定段階と理由、要求・応答・記録の異なる観測を保持する。
 * @trace ARCH-000008
 * @shape 固定用途、段階、理由、例外分類と三つの観測値。
 * @invariant Handle取得をDocker受理、応答を記録成功と同一視しない。
 * @boundary Controllerから受動診断の利用側への搬送。
 * @security 自由文、Path、argv、Provider出力や秘密値を含めない。
 * @compatibility 診断は実行・清掃・Recoveryの判定を変更しない。
 */
export type PrimaryFailureDiagnostic = Readonly<{
  purpose: string | null;
  stage:
    | "submission_record"
    | "command_restriction"
    | "command_start"
    | "provider_start_observation"
    | "command_wait"
    | "execution_classification"
    | "resource_receipt_record"
    | "subscription_auth_verification"
    | "provider_result_normalization";
  reason: AttemptResultReason;
  exceptionCode: string | null;
  commandHandleObtained: boolean;
  responseObserved: boolean;
  receiptRecorded: boolean;
  /** 診断専用。confirmedでも非0終了を実行許可へ変換しない。 */
  authenticationStatus?: "confirmed" | "unconfirmed" | "unknown";
  /** Claude助言のTurn拒否だけに付く非秘密metadata。 */
  turnCountDiagnostic?: ProviderTurnCountDiagnostic;
  commandObservation: Readonly<{
    exitCode: number | null;
    stdoutBytes: number;
    stderrBytes: number;
  }> | null;
}>;

/**
 * Docker Process Controllerが公開できる完了理由を表す。
 *
 * @responsibility 清掃後に上位へ公開できる固定理由の型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定Registry要素だけからなる文字列unionである。
 * @invariant Provider生出力や未登録理由を含まない。
 * @boundary Docker Process Controller結果から上位Coordinator結果への投影境界。
 * @security 固定語彙だけを許可し、秘密値や自由文を搬送しない。
 * @compatibility 利用側は公開Registryに含まれる理由だけへ依存する。
 */
export type AttemptFailureReason = (typeof ATTEMPT_COMPLETION_REASONS)[number];
