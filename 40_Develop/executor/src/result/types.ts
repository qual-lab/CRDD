/**
 * 正規化した結果と技術診断の共有型を定義する。
 * @packageDocumentation
 * @responsibility 成否と用途別の結果内容を区別し、検査・状態遷移・保存は行わない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @boundary Executorの結果Ownerと利用側の型境界。
 */
import type {
  ATTEMPT_COMPLETION_REASONS,
  RECOVERY_START_FAILURE_STAGES,
} from "./constants.ts";
import type {
  ProviderTurnCountDiagnostic,
  TaskReviewFinding,
  ProviderResultParseResult,
  AiProvider,
  TaskResult,
  AdviceResult,
} from "../../../ai-adapter/src/index.ts";
import type { DockerResourceCleanupObservation } from "../../../docker-isolation/src/index.ts";
import type { AttemptInput } from "../attempt/types.ts";
import type { ProcessStartedNotice } from "../attempt/observation.ts";

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
  selectionRecordId: string;
  recoveryId: string;
  providerRequestStarted: boolean;
  cancellationRequested: boolean;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  mountLeaseReleased: boolean;
  recoveryCompleted: boolean;
  resultSha256: string | null;
  resultBytes: number;
  normalizedResult: AttemptContent | null;
  reviewFindings?: readonly TaskReviewFinding[] | null;
  providerExecutionObservation?: CompletionResult["providerExecutionObservation"];
  providerTurnObservation?: CompletionResult["providerTurnObservation"];
  subscriptionAuthConfirmed: boolean;
  recoveryFinalizationCapability: object | null;
}>;

/**
 * 同じ実行Ownerの開始・取消・下位清掃確認を持つExecutor。
 * @responsibility 開始・取消の引数と結果を読める形で定義し、Factoryを型検査する。
 * @trace ARCH-000008
 * @invariant 実装由来の型抽出を正本にせず、別の状態管理を追加しない。
 */
export type Executor = Readonly<{
  start(
    provider: AiProvider,
    input: AttemptInput,
    registerRecoveryHandoff: (
      recoveryCapability: object,
      recoveryId: string,
    ) => boolean,
    commandRestriction?: (purpose: string) => boolean,
    observeProviderStarted?: (
      notice: ProcessStartedNotice,
    ) => boolean | Promise<boolean>,
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
  selectionRecordId: string;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  dockerEffectStarted: true;
  providerRequestStarted: boolean;
  cancellationRequested: boolean;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  mountLeaseReleased: boolean;
  recoveryCompleted: boolean;
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
  recoveryFinalizationCapability: object | null;
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
  resources: readonly DockerResourceCleanupObservation[];
  primaryFailure: PrimaryFailureDiagnostic | null;
  mountLeaseReleased: boolean;
  recoveryCompleted: boolean;
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

/** 開始Ownerから受動診断へ渡す固定段階と、取得済みの場合だけの元参照。 */
export type RecoveryStartFailureDiagnostic = Readonly<{
  stage: (typeof RECOVERY_START_FAILURE_STAGES)[number];
  recoveryId: string | null;
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
