/**
 * 署名検証Runnerが公開し得る固定診断理由を定義する。
 *
 * @responsibility Route Matrix／General Task ProducerとVerification Recordが共有するexact vocabularyを所有する。
 * @trace ARCH-000003
 * @input N/A: 固定語彙だけを定義するModuleである。
 * @returns N/A: 関数を公開せず、読取り専用の固定値だけを公開する。
 * @precondition N/A: 初期化前に満たす外部条件はない。
 * @postcondition 署名検証Runnerの公開理由が固定Registryから参照可能になる。
 * @effect N/A: 外部Effectを発行しない。
 * @failure N/A: Runtime入力を処理しない。
 * @invariant 未知値、自由文およびProvider生出力をRegistryへ含めない。
 * @boundary 署名検証Runner ProducerとVerification Record投影の共有境界。
 * @security exactな固定値だけを公開し、prefixまたは正規表現による許可へ拡張しない。
 * @concurrency N/A: 不変の固定値だけを公開する。
 */
export const SIGNED_ROUTE_MATRIX_REASONS = Object.freeze({
  completed: "signed_route_matrix_completed",
  incomplete: "signed_route_matrix_incomplete",
  failedClosed: "signed_route_matrix_failed_closed",
  argumentsInvalid: "signed_route_matrix_arguments_invalid",
  routeRunnerFailedClosed: "signed_route_matrix_route_runner_failed_closed",
  processRestartRequired: "signed_route_matrix_process_restart_required",
} as const);

export const SIGNED_GENERAL_TASK_PUBLIC_REASONS = Object.freeze([
  "signed_general_task_base_content_mismatch",
  "signed_general_task_cancellation_binding_cleanup_unknown",
  "signed_general_task_cancellation_binding_failed",
  "signed_general_task_cancellation_cleanup_unknown",
  "signed_general_task_cancellation_completion_unknown",
  "signed_general_task_cancellation_observation_unknown",
  "signed_general_task_cancellation_unbind_cleanup_unknown",
  "signed_general_task_cancellation_unbind_unknown",
  "signed_general_task_cancelled",
  "signed_general_task_candidate_content_mismatch",
  "signed_general_task_candidate_discard_failed",
  "signed_general_task_candidate_id_missing",
  "signed_general_task_completion_observer_unknown",
  "signed_general_task_completion_rejected",
  "signed_general_task_completion_settlement_unknown",
  "signed_general_task_execution_repository_changed",
  "signed_general_task_execution_repository_observation_unknown",
  "signed_general_task_final_outcome_unknown",
  "signed_general_task_git_object_format_unsupported",
  "signed_general_task_node_version_unsupported",
  "signed_general_task_post_start_observation_unknown",
  "signed_general_task_process_restart_required",
  "signed_general_task_release_verification_failed",
  "signed_general_task_repository_revision_observation_failed",
  "signed_general_task_repository_root_invalid",
  "signed_general_task_result_contract_mismatch",
  "signed_general_task_safety_observation_unknown",
  "signed_general_task_start_failed_closed",
  "signed_general_task_started_task_completion_unknown",
  "signed_general_task_started_task_observation_unknown",
  "signed_general_task_verification_arguments_invalid",
  "signed_general_task_verification_completed",
  "signed_general_task_verification_failed_closed",
] as const);

/**
 * 署名General Task検証が公開できる理由を表す。
 *
 * @responsibility 署名検証結果へ公開できる固定理由の型境界を所有する。
 * @trace ARCH-000003
 * @shape 固定Registry要素だけからなる文字列unionである。
 * @invariant 未知値、自由文およびProvider生出力を含まない。
 * @boundary 署名検証RunnerからVerification Recordへの投影境界。
 * @security exactな固定値だけを許可する。
 * @compatibility 利用側は公開Registryに含まれる理由だけへ依存する。
 */
export type SignedGeneralTaskPublicReason =
  (typeof SIGNED_GENERAL_TASK_PUBLIC_REASONS)[number];
