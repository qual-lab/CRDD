/**
 * Coordinator Taskが公開するProvider準備失敗理由を定義する。
 *
 * @responsibility Provider準備失敗のProducerとVerification Recordが共有するexact vocabularyを所有する。
 * @trace ARCH-000004
 * @input N/A: 固定語彙だけを定義するModuleである。
 * @returns N/A: 関数を公開せず、読取り専用の固定値だけを公開する。
 * @precondition N/A: 初期化前に満たす外部条件はない。
 * @postcondition Provider準備失敗の公開理由が単一の固定Registryから参照可能になる。
 * @effect N/A: 外部Effectを発行しない。
 * @failure N/A: Runtime入力を処理しない。
 * @invariant 内部Provider理由、自由文およびProvider生出力を公開語彙へ含めない。
 * @boundary Provider Preparationの内部結果からCoordinator Task公開結果への投影境界。
 * @security exactな固定値だけを公開し、prefixまたは正規表現による許可へ拡張しない。
 * @concurrency N/A: 不変の固定値だけを公開する。
 */
export const COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS = Object.freeze({
  prepareFailed: "coordinator_task_provider_prepare_failed",
  modelSelectionInvalid: "coordinator_task_provider_model_selection_invalid",
  mountAuthorizationInvalid:
    "coordinator_task_provider_mount_authorization_invalid",
  taskPacketInvalid: "coordinator_task_provider_task_packet_invalid",
  planInvalid: "coordinator_task_provider_plan_invalid",
  authorityInvalid: "coordinator_task_provider_authority_invalid",
  recoveryCorrelationInvalid:
    "coordinator_task_provider_recovery_correlation_invalid",
} as const);
