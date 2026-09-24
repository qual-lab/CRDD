/**
 * Coordinator Taskが公開する固定理由を定義する。
 *
 * @responsibility Coordinator Task ProducerとVerification Recordが共有するexact vocabularyを所有する。
 * @trace ARCH-000004
 * @input N/A: 固定語彙だけを定義するModuleである。
 * @returns N/A: 関数を公開せず、読取り専用の固定値だけを公開する。
 * @precondition N/A: 初期化前に満たす外部条件はない。
 * @postcondition Coordinator Taskの公開理由が単一の固定Registryから参照可能になる。
 * @effect N/A: 外部Effectを発行しない。
 * @failure N/A: Runtime入力を処理しない。
 * @invariant 内部Provider理由、自由文およびProvider生出力を公開語彙へ含めない。
 * @boundary 下位Runtime結果からCoordinator Task公開結果への投影境界。
 * @security exactな固定値だけを公開し、prefixまたは正規表現による許可へ拡張しない。
 * @concurrency N/A: 不変の固定値だけを公開する。
 */
import { DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS } from "./docker-process-controller-result-reasons.ts";

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

export const coordinatorTaskPublicReasons = Object.freeze([
  ...Object.values(COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS),
  ...DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS,
  "coordinator_task_cancellation_protocol_failed_cleanup_confirmed",
  "coordinator_task_cancellation_protocol_failed_cleanup_unknown",
  "coordinator_task_cancellation_receipt_invalid",
  "coordinator_task_cancelled_after_provider_cleanup",
  "coordinator_task_cancelled_before_candidate_capture",
  "coordinator_task_cancelled_before_independent_review",
  "coordinator_task_cancelled_before_stage_start",
  "coordinator_task_cancelled_during_external_send_authorization",
  "coordinator_task_cancelled_during_operation_creation",
  "coordinator_task_candidate_approved",
  "coordinator_task_candidate_persistence_failed",
  "coordinator_task_candidate_persistence_not_authorized",
  "coordinator_task_candidate_publish_unconfirmed",
  "coordinator_task_candidate_recognized_secret_rejected",
  "coordinator_task_candidate_revision_invalid",
  "coordinator_task_candidate_store_unavailable",
  "coordinator_task_candidate_verification_failed",
  "coordinator_task_control_invalid",
  "coordinator_task_completed",
  "coordinator_task_development_invocation_not_authorized",
  "coordinator_task_development_invocation_settlement_invalid",
  "coordinator_task_development_permission_expired",
  "coordinator_task_development_permission_required",
  "coordinator_task_docker_finalization_capability_missing",
  "coordinator_task_docker_recovery_finalization_unconfirmed",
  "coordinator_task_docker_recovery_handoff_state_invalid",
  "coordinator_task_docker_recovery_projection_invalid",
  "coordinator_task_execution_slate_unavailable",
  "coordinator_task_external_send_authorization_mode_invalid",
  "coordinator_task_external_send_confirmation_cancelled",
  "coordinator_task_external_send_confirmation_declined_invalid",
  "coordinator_task_external_send_confirmation_reader_failed",
  "coordinator_task_external_send_confirmation_timeout",
  "coordinator_task_external_send_confirmation_unavailable",
  "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_and_operation_recovery_required",
  "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_required",
  "coordinator_task_external_send_not_authorized",
  "coordinator_task_external_send_notice_unavailable",
  "coordinator_task_external_send_policy_unresolved",
  "coordinator_task_failed_closed",
  "coordinator_task_final_projection_failed_closed",
  "coordinator_task_git_object_format_unsupported",
  "coordinator_task_host_cleanup_intent_unconfirmed",
  "coordinator_task_host_cleanup_receipt_unconfirmed",
  "coordinator_task_host_generation_lock_activation_failed",
  "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required",
  "coordinator_task_host_generation_lock_not_ready",
  "coordinator_task_host_generation_lock_not_ready_cleanup_confirmed",
  "coordinator_task_host_generation_lock_protocol_failed_cleanup_confirmed",
  "coordinator_task_host_generation_lock_start_failed_cleanup_confirmed",
  "coordinator_task_host_generation_lock_unavailable",
  "coordinator_task_host_generation_lost_cleanup_confirmed",
  "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
  "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
  "coordinator_task_independent_review_not_approved",
  "coordinator_task_internal_outcome_invalid",
  "coordinator_task_mount_grant_consume_failed",
  "coordinator_task_mount_grant_issue_failed",
  "coordinator_task_operation_cleanup_outcome_invalid",
  "coordinator_task_operation_cleanup_unconfirmed",
  "coordinator_task_operation_creation_failed",
  "coordinator_task_operation_initialization_cleanup_unknown_process_restart_required",
  "coordinator_task_operation_initialization_failed_cleanup_confirmed",
  "coordinator_task_packet_issue_failed",
  "coordinator_task_process_completion_contract_invalid",
  "coordinator_task_process_completion_unconfirmed",
  "coordinator_task_process_restart_required",
  "coordinator_task_process_start_contract_invalid",
  "coordinator_task_process_start_failed",
  "coordinator_task_provider_failed",
  "coordinator_task_provider_home_observation_failed",
  "coordinator_task_provider_home_reobservation_failed",
  "coordinator_task_provider_selection_refresh_failed",
  "coordinator_task_provider_selection_refresh_mismatch",
  "coordinator_task_provider_selection_refresh_revoke_failed",
  "coordinator_task_read_projection_recognized_secret_rejected",
  "coordinator_task_recovery_correlation_invalid",
  "coordinator_task_release_verification_required",
  "coordinator_task_remediated_candidate_invalid",
  "coordinator_task_remediation_recognized_secret_rejected",
  "coordinator_task_repository_binding_failed",
  "coordinator_task_repository_preflight_failed",
  "coordinator_task_request_invalid",
  "coordinator_task_result_observation_invalid",
  "coordinator_task_review_remediation_invalid",
  "coordinator_task_reviewer_read_projection_failed",
  "coordinator_task_runtime_cleanup_in_progress",
  "coordinator_task_scope_recognized_secret_rejected",
  "coordinator_task_selection_failed",
  "coordinator_task_selection_notice_unavailable",
  "coordinator_task_selection_slate_mismatch",
  "coordinator_task_stage_failed_closed",
  "coordinator_task_started",
  "coordinator_task_workload_split_required",
  "coordinator_task_workspace_materialization_failed",
  "docker_process_controller_recovery_conflict",
  "docker_process_controller_recovery_identity_mismatch",
  "docker_process_controller_recovery_observation_unknown",
  "docker_process_controller_recovery_unavailable",
  "provider_cancellation_grace_exceeded",
  "provider_cancellation_requested",
  "provider_operation_cancelled",
] as const);

/**
 * Coordinator Taskが公開できる理由を表す。
 *
 * @responsibility Task結果へ公開できる固定理由の型境界を所有する。
 * @trace ARCH-000004
 * @shape 固定Registry要素だけからなる文字列unionである。
 * @invariant 内部理由、自由文およびProvider生出力を含まない。
 * @boundary 下位Runtime結果からCoordinator Task公開結果への投影境界。
 * @security exactな固定値だけを許可する。
 * @compatibility 利用側は公開Registryに含まれる理由だけへ依存する。
 */
export type CoordinatorTaskPublicReason =
  (typeof coordinatorTaskPublicReasons)[number];

const coordinatorTaskPublicReasonSet = new Set<string>(
  coordinatorTaskPublicReasons,
);

/**
 * 未信頼の下位理由をCoordinator Taskの固定公開理由へ閉じる。
 *
 * @responsibility 公開可能なexact reasonと未知値の代替理由を分離する。
 * @trace ARCH-000004
 * @input value: 未信頼の下位理由、fallback: 呼出し境界が所有する固定代替理由。
 * @returns 登録済み理由または指定された固定代替理由。
 * @precondition fallbackがCoordinatorTaskPublicReasonである。
 * @postcondition 戻り値は常にCoordinator Task公開Registryの要素である。
 * @effect N/A: 入力と不変Registryだけを読み取る。
 * @failure 未知値は例外にせずfallbackへ閉じる。
 * @invariant 自由文、prefix一致だけの値およびProvider生出力を公開しない。
 * @boundary 下位Runtime結果からCoordinator Task公開結果への投影境界。
 * @security exact Registry一致だけを許可する。
 * @concurrency N/A: 不変集合を同期的に参照する。
 */
export function projectCoordinatorTaskPublicReason(
  value: unknown,
  fallback: CoordinatorTaskPublicReason,
): CoordinatorTaskPublicReason {
  return typeof value === "string" && coordinatorTaskPublicReasonSet.has(value)
    ? (value as CoordinatorTaskPublicReason)
    : fallback;
}
