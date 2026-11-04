/**
 * 単発実行の入力・通知・開始結果・完了結果に必要な型を定義する。
 * @packageDocumentation
 * @responsibility 試行の技術構成と型付き結果を定義し、Task進行・検査・状態遷移・保存は行わない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */

import type {
  ModelSelection as AiModelSelection,
  Provider as AiProvider,
  ExecutionResult as ProviderResultParseResult,
  TurnCountDiagnostic as ProviderTurnCountDiagnostic,
  ExecutionPlan,
} from "../../../ai-adapter/src/index.ts";
import type {
  IsolationRequest,
  ResourceTarget as IsolationResourceTarget,
  ResourceSnapshot,
  prepareIsolation,
  executeIsolation,
} from "../../../docker-isolation/src/index.ts";
import type {
  CompletionCallbacks,
  ResourceCleanupCallbacks,
} from "../lifecycle/callbacks.ts";
import type {
  ExecutorLifecycle,
  LifecycleOperations,
} from "../lifecycle/types.ts";
import type { ATTEMPT_COMPLETION_REASONS, PURPOSES } from "./constants.ts";

type TaskResult = NonNullable<
  ProviderResultParseResult<"task">["normalizedResult"]
>;
type AdviceResult = NonNullable<
  ProviderResultParseResult<"advice">["normalizedResult"]
>;
type TaskReviewFinding = NonNullable<
  ProviderResultParseResult<"task">["reviewFindings"]
>[number];

/**
 * 通常Attemptの必須通知と受動完了通知を定義する。
 * @responsibility 用途に実在する通知引数と完了条件だけを所有する。
 * @trace ARCH-000008
 * @shape 共通完了通知と用途固有のイベントハンドラー。
 * @invariant 必須通知の失敗後は後続Effectを停止する。
 * @boundary 技術実行と上位の記録・観測。
 * @security Credential・生出力を通知へ追加しない。
 * @compatibility 必須通知の既存同期性と任意完了通知の非待機を維持する。
 */
export interface AttemptCallbacks
  extends ResourceCleanupCallbacks<AttemptTerminalObservation>,
    CompletionCallbacks<CompletionResult, [AttemptTerminalObservation]> {
  onCommandSubmitting?(purpose: AttemptCommandPurpose): void | Promise<void>;
  onCommandNotIssued?(purpose: AttemptCommandPurpose): void | Promise<void>;
  onProviderSubmitting?(): void | Promise<void>;
  onResourceCreated?(
    purpose: AttemptCommandPurpose,
    dockerId: string,
  ): void | Promise<void>;
  onStarted?(notice: ProcessStartedNotice): void | Promise<void>;
  onDiagnostic?(notice: AttemptDiagnosticNotice): void | Promise<void>;
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
  lifecycle: LifecycleOperations;
  controlCapability: object;
  recovery: AttemptReference;
  managementCapability: object;
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
  acquireHomeLease(bindingHash: string): HomeLease | null;
  prepareIsolation: typeof prepareIsolation;
  executeIsolation: typeof executeIsolation;
  callbacks: AttemptCallbacks;
  controls: WeakMap<object, ExecutionRecord>;
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
  kind: "attempt";
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
        additionalHosts: readonly string[];
      }>
    | Readonly<{
        purpose: "advice";
        input: string;
        additionalHosts: readonly string[] | null;
        allowedReferences: readonly string[];
      }>
  );

/**
 * Factory内部だけが保持する一試行の技術構成。
 * @responsibility AI Adapterの実行指定と固定済みIsolationRequestを結合し、上位へ往復させない。
 * @trace ARCH-000008
 * @invariant 業務Authorityと記録保存は上位が所有する。
 */
export type AttemptPlan = AttemptRecordProjection &
  Readonly<{
    additionalHosts: readonly string[] | null;
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
    adviceAllowedReferences?: readonly string[] | null;
    providerInput: string | null;
    workspaceSourcePath: string | null;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
    isolationRequest: IsolationRequest;
    providerPlan: ExecutionPlan;
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
  resourceSnapshot?: ResourceSnapshot | null;
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
 * Attemptの取消に必要な元Controlと現在の管理参照。
 * @responsibility 共通取消へ進む前の照合入力を定義する。
 * @trace ARCH-000008
 * @shape controlCapabilityとmanagementCapabilityの二参照。
 * @invariant 空入力や別Ownerで正規取消を消費しない。
 * @boundary 利用側と元Control表の照合。
 * @security 対象識別だけで新しい取消権限を発行しない。
 * @compatibility 既存の二参照の照合条件を維持する。
 */
export type AttemptCancelInput = Readonly<{
  controlCapability: unknown;
  managementCapability: unknown;
}>;

/**
 * Attempt固有の記録投影と終了後Home解放を共通制御へ加える。
 * @responsibility 同じ実行への開始・取消・明示解放だけを提供する。
 * @trace ARCH-000008
 * @shape 共通制御と投影、abandon。
 * @invariant 型抽出を正本にせず、実行状態を再定義しない。
 * @boundary 利用側とAttempt固有の技術実行。
 * @security 元Control・management・Home解放条件を維持する。
 * @compatibility 用途固有の必要な操作だけを追加する。
 */
export interface AttemptExecutor extends ExecutorLifecycle<"attempt"> {
  readonly recordProjection: AttemptRecordProjection;
  abandon(
    input: Readonly<{
      recoveryCapability: unknown;
      managementCapability: unknown;
    }>,
  ): boolean;
}

/**
 * 一試行の開始結果。開始済みと拒否で必要な項目を区別する。
 * @responsibility 利用側がstatusで制御・完了Promiseと回復義務を判断できる契約を定義する。
 * @trace ARCH-000008
 * @invariant 受付・開始とProvider開始・最終結果を混同しない。
 */
export type StartResult = Readonly<
  {
    kind: "attempt";
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
  resourceSnapshot: ResourceSnapshot | null;
  kind: "attempt";
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
    ProviderResultParseResult<"task">["providerExecutionObservation"]
  > | null;
  providerTurnObservation: Readonly<Record<string, unknown>> | null;
  reviewFindings: readonly TaskReviewFinding[] | null;
  subscriptionAuthConfirmed: boolean;
  rawOutputReported: false;
  untrustedProviderTextReported: false;
  credentialAbsenceVerified: false;
  hostPathReported: boolean;
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

/**
 * 上位が選定した一つの技術資源集合の回収対象。
 * @responsibility 保存Schemaを持たず、既存技術投影と取消Signalだけを借用する。
 * @trace ARCH-000008
 * @shape resource_set種別、元ID、技術投影、Receipt、config領域と取消Signal。
 * @invariant IDだけで処置を許可せず、明示取消後は新しい処置を開始しない。
 * @boundary 上位で選定済みの対象とExecutor資源API。
 * @security 生の削除Path・権限発行・保存操作を公開しない。
 * @compatibility kindはAPI内の分岐だけで、保存Schemaへ加えない。
 */
export type ResourceTarget = Readonly<{
  kind: "resource_set";
  operationId: string;
  recoveryId: string;
  projection: AttemptRecordProjection &
    Readonly<{
      workspaceProtected?: boolean;
      workspaceProtection?: Readonly<{
        gitSourcePath: string;
        internalSourcePath: string;
      }>;
    }>;
  receipts: DockerResourceReceipts;
  previouslyAbsent?: readonly (keyof DockerResourceReceipts)[];
  managementDirectory: string | null;
  signal?: AbortSignal;
}>;

/**
 * 診断だけで得た技術資源の観測。
 * @responsibility 存在・不存在・不明とconfig終了を区別する。
 * @trace ARCH-000008
 * @shape 元ID、資源別観測、理由とconfig終了確認。
 * @invariant 診断の成功を削除許可・保存確定へ昇格しない。
 * @boundary 同期のAttempt観測結果から上位判断。
 * @security 認証内容・生出力・操作権限を含めない。
 * @compatibility 既存Attempt観測の値と同期返却を維持する。
 */
export type ResourceInspection = Readonly<{
  resourceSnapshot: ResourceSnapshot;
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
 * @shape 元ID、技術回収とconfig終了の個別結果、資源観測。
 * @invariant Docker回収とTask完了・Host清掃・履歴確定を混同しない。
 * @boundary 非同期の資源回収から上位保存・判断。
 * @security 元参照を削除権限へ昇格しない。
 * @compatibility Directory結果のために既存fieldや意味を変更しない。
 */
export type ResourceCleanupResult = Readonly<{
  resourceSnapshot?: ResourceSnapshot;
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  dockerCleanupConfirmed: boolean;
  configCleanupConfirmed: boolean;
  resources: readonly DockerResourceCleanupObservation[];
}>;

/**
 * 元実行から保存へ搬送する非秘密の技術構成。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 五資源名・所有Label・固定Image・実行／Mount方式。
 * @invariant Task状態・保存場所・過去Effectの成否を定義しない。
 * @boundary Executorの元構成、上位保存と再入場。
 * @security この投影は処置権限でなく、実資源との照合が別に必要。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
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
 * 本番隔離Runtimeへ渡す確定済み所在だけを表す。
 * @responsibility 既存依存契約の必要断面を再利用する。
 * @trace ARCH-000008
 * @invariant Process primitiveやCLI構成を上位へ公開しない。
 */
export type DockerIsolationRuntimeOptions = Readonly<{
  paths: Readonly<{ tmp: string; management: string }>;
}>;

/**
 * 同じAttemptのHome技術排他を一回解放するHandle。
 * @responsibility 取得済み排他の同期解放結果だけを搬送する。
 * @trace ARCH-000008
 * @invariant 上位のTask状態や保存方式を所有しない。
 */
export type HomeLease = Readonly<{ release: () => boolean }>;

/**
 * 五資源の作成要求と実IDの検査済み投影。
 *
 * @responsibility 明示未要求と作成結果不明を区別した読取り値を搬送する。
 * @trace ARCH-000008
 * @shape 各作成purposeにsubmittedと実Docker IDまたはnull。
 * @invariant nullを未要求または不存在へ補完しない。
 * @boundary 既存保存Ownerから技術清掃への用途限定投影。
 * @security 記録の読取り・Lock操作・新しいAuthorityは所有しない。
 * @compatibility 固定五purposeのReceiptを受理する。
 */
export type DockerResourceReceipts = Readonly<
  Record<
    | "create_provider"
    | "create_proxy"
    | "create_subscription_auth_probe"
    | "create_internal_network"
    | "create_egress_network",
    Readonly<{ submitted: boolean; dockerId: string | null }>
  >
>;

/**
 * 一資源の終了観測。清掃のboolから再構成しない。
 *
 * @responsibility 明示未要求、不存在、観測不能を別の値として返す。
 * @trace ARCH-000008
 * @shape purpose、予定名、実IDと三値の終了観測。
 * @invariant 不明を成功や未要求へ変換しない。
 * @boundary 技術清掃と上位の結果保存の間。
 * @security Path・本文・Secret・処置許可を含めない。
 * @compatibility 既存資源別終端観測と同じfieldを保持する。
 */
export type DockerResourceCleanupObservation = Readonly<{
  purpose: keyof DockerResourceReceipts;
  plannedResourceName: string;
  dockerId: string | null;
  observation: "not_requested" | "absent" | "unknown";
}>;

/**
 * Container内起動payloadと隔離資源の構築入力。
 *
 * @responsibility Dockerの技術構成だけを保持し、Task・許可・モデルの意味を所有しない。
 * @trace ARCH-000004
 * @shape 三Container、二Network、固定Image、Mount、起動payload、Proxy接続構成。
 * @invariant Docker argv全体や任意Host環境は入力にしない。
 * @boundary 上位の検証済み起動記述から隔離計画への境界。
 * @security 認証値はContainer環境へ搬送するだけで診断へ公開しない。
 * @compatibility 既存九purposeと固定Docker flagの順序を維持する。
 */
export type DockerIsolationCommandInput = Readonly<{
  authenticationContainerName: string;
  executionContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  executionImageDigest: string;
  proxyImageDigest: string;
  homeSourcePath: string;
  temporarySourcePath: string;
  workspace: Readonly<{
    sourcePath: string;
    readOnly: boolean;
    protection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
  }> | null;
  authentication: Readonly<{
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
  }>;
  execution: Readonly<{
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
    interactive: boolean;
    initRequired: boolean;
    seccompProfile: Readonly<{ sha256: string; bytes: number }> | null;
  }>;
  proxy: Readonly<{
    profile: string;
    token: string;
    port: number;
    extendedProxyEnvironment: boolean;
    additionalHosts?: readonly string[] | null;
  }>;
}>;

/**
 * 元技術構成から得た回収順と構成候補。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 五つの作成purposeと同用途の技術期待値列。
 * @invariant 元実IDはReceiptから結合し、期待値だけで資源存在や処置許可を示さない。
 * @boundary 通常Session／再入場とDI共通回収。
 * @security 任意コマンド・保存API・上位Ownerを搬送しない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export type DockerResourceExpectationSet = readonly Readonly<{
  purpose: keyof DockerResourceReceipts;
  expectations: readonly IsolationResourceTarget<"snapshot">["discovery"][number]["configurations"][number][];
}>[];

/** 単一Attemptが発行する固定技術操作の識別子。 */
export type AttemptCommandPurpose = (typeof PURPOSES)[number];
