/**
 * 正規化した結果と技術診断の共有型を定義する。
 * @packageDocumentation
 * @responsibility 成否と用途別の結果内容を区別し、検査・状態遷移・保存は行わない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @boundary Executorの結果Ownerと利用側の型境界。
 */
import type { dockerProcessControllerPublicCompletionReasons } from "../../../domain-model/src/index.ts";
import type { ProviderTurnCountDiagnostic } from "../../../ai-adapter/src/index.ts";
import type { RECOVERY_START_FAILURE_STAGES } from "./validation.ts";

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

/**
 * 検査済み助言の一項目を表す。
 * @responsibility 説明本文と読取り投影の参照を一つの値契約へまとめる。
 * @trace ARCH-000015
 * @shape textとreferencesの読取り専用値。
 * @invariant 型付けだけでProvider内容を信頼済みとしない。
 * @boundary 正規化したProvider結果と上位表示結果。
 * @security Source本文・絶対Path・認証値の許可を拡張しない。
 * @compatibility 元の助言項目と同じ形を維持する。
 */
export type ProviderAdviceResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

/**
 * 読取り助言結果の閉じたSchema検証境界で使用するAdviceResultの構造を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceResult = Readonly<{
  status: "completed";
  reason: null;
  facts: readonly ProviderAdviceResultItem[];
  sharedAnalysis: readonly ProviderAdviceResultItem[];
  additionalInferences: readonly ProviderAdviceResultItem[];
  nextOptions: readonly ProviderAdviceResultItem[];
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
export type DockerProcessControllerFinalReason =
  | DockerProcessControllerPublicCompletionReason
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
  reason: DockerProcessControllerFinalReason;
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
export type DockerProcessControllerPublicCompletionReason =
  (typeof dockerProcessControllerPublicCompletionReasons)[number];
