/**
 * 正規化した結果と技術診断の共有型を定義する。
 * @packageDocumentation
 * @responsibility 成否と用途別の結果内容を区別し、検査・状態遷移・保存は行わない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @boundary Executorの結果Ownerと利用側の型境界。
 */
import type { ATTEMPT_COMPLETION_REASONS } from "./validation.ts";
import type { ProviderTurnCountDiagnostic } from "../../../ai-adapter/src/index.ts";
import type { RECOVERY_START_FAILURE_STAGES } from "./validation.ts";
import type { DockerResourceCleanupObservation } from "../../../docker-isolation/src/index.ts";
import type { createExecutor } from "../attempt/preparation.ts";
import type { createFinalResult } from "./attempt.ts";
import type { normalizeTaskResult } from "./task.ts";
import type { AdviceResult } from "../../../ai-adapter/src/index.ts";
import type {
  normalizeCodexStructuredResult,
  normalizeClaudeStructuredResult,
} from "../../../ai-adapter/src/index.ts";

/**
 * 純粋なTask検査の成功内容を導出する。
 * @responsibility normalizerと公開内容型の構造重複を避ける。
 * @trace ARCH-000015
 * @shape 正規化結果からnullを除いた用途別union。
 * @invariant Authorityを追加しない。
 * @boundary Executor内部の結果型。
 * @security 所見本文は通常結果へ含めない。
 * @compatibility normalizerの実返却型へ追従する。
 */
type NormalizedTaskContent = NonNullable<
  ReturnType<typeof normalizeTaskResult>["normalizedResult"]
>;
/**
 * Task内容からレビューの判断部分だけを選ぶ。
 * @responsibility 許可を付加できる用途を編集結果から分離する。
 * @trace ARCH-000015
 * @shape decisionを持つ正規化済みレビュー内容。
 * @invariant 内容の判断を実行許可へ読み替えない。
 * @boundary Executor内部の型合成。
 * @security 本文や新しいAuthorityを追加しない。
 * @compatibility normalizerのレビュー形へ追従する。
 */
type ReviewContent = Extract<
  NormalizedTaskContent,
  { decision: "approved" | "changes_requested" }
>;
/**
 * 所見の内容とHostが別途発行した次試行許可を区別する。
 * @responsibility 編集・承認・是正要求を型で区別する。
 * @trace ARCH-000015
 * @shape 是正要求だけがoptional remediationCapabilityを持つunion。
 * @invariant 内容完了だけでは許可の存在を保証しない。
 * @boundary Executorの清掃後結果とCoordinatorの次試行判断。
 * @security 生所見を公開せず、許可を自己発行しない。
 * @compatibility Taskの既存内容を保ちHost許可の型を明示する。
 */
export type TaskResult =
  | Exclude<NormalizedTaskContent, ReviewContent>
  | (Omit<ReviewContent, "decision"> & Readonly<{ decision: "approved" }>)
  | (Omit<ReviewContent, "decision"> &
      Readonly<{
        decision: "changes_requested";
        remediationCapability?: object;
      }>);

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
  | NonNullable<
      ReturnType<typeof normalizeCodexStructuredResult>["normalizedResult"]
    >
  | NonNullable<
      ReturnType<typeof normalizeClaudeStructuredResult>["normalizedResult"]
    >;

export type { TaskReviewFinding as ReviewFinding } from "../../../ai-adapter/src/index.ts";

/**
 * 同じ実行Ownerの開始・取消・下位清掃確認を持つExecutor。
 * @responsibility 本番Factoryの実際の返却型を単一正本から導出する。
 * @trace ARCH-000008
 * @invariant 独自の構造型や別の状態管理を追加しない。
 */
export type Executor = ReturnType<typeof createExecutor>;

/**
 * 一試行の開始結果。blockedと、completionを持つ開始済み結果を区別する。
 * @responsibility 受付・開始と最終結果を混同しない。
 * @trace ARCH-000008
 * @invariant 実際のstartの返却値から導出し、成功条件を追加しない。
 */
export type AttemptStartResult = ReturnType<Executor["start"]>;

/**
 * 清掃を含む一試行の最終結果。
 * @responsibility 正常・拒否・取消と未解決回復を既存結果のまま表す。
 * @trace ARCH-000008
 * @invariant 実装の結果構築型を参照し、結果fieldを二重定義しない。
 */
export type AttemptResult = ReturnType<typeof createFinalResult>;

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
 * 結果正規化の共通の成功・拒否形を表す。
 * @responsibility 共通の成否と用途固有の内容を型で区別する。
 * @trace ARCH-000015
 * @shape confirmedは内容、blockedは固定理由とnullを持つ。
 * @invariant 正規化成功を実行・清掃・採用の成功へ昇格しない。
 * @boundary Task／Adviceの内容検査。Root公開型は増やさない。
 * @security 理由へ生出力を含めず、付随診断は用途側の検査に従う。
 * @compatibility 既存の返却fieldを追加・削除せず型照合だけに利用する。
 */
export type NormalizedProviderResult<T> =
  | Readonly<{ status: "confirmed"; normalizedResult: T }>
  | Readonly<{ status: "blocked"; reason: string; normalizedResult: null }>;

export type { AdviceResult } from "../../../ai-adapter/src/index.ts";

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
