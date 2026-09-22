/**
 * Docker Process Controllerが清掃後に公開できる固定失敗理由を定義する。
 *
 * @responsibility Process Controller Producerと上位公開投影が共有するexact vocabularyを所有する。
 * @trace ARCH-000008
 * @input N/A: 固定語彙だけを定義するModuleである。
 * @returns N/A: 関数を公開せず、読取り専用の固定値だけを公開する。
 * @precondition N/A: 初期化前に満たす外部条件はない。
 * @postcondition 清掃後に公開可能なProvider／Docker失敗理由が単一Registryから参照可能になる。
 * @effect N/A: 外部Effectを発行しない。
 * @failure N/A: Runtime入力を処理しない。
 * @invariant Provider生出力、自由文および秘密値を公開語彙へ含めない。
 * @boundary Docker Process Controller結果から上位Coordinator結果への投影境界。
 * @security exactな固定値だけを公開し、診断本文を公開しない。
 * @concurrency N/A: 不変の固定値だけを公開する。
 */
export const DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS =
  Object.freeze([
    "provider_deadline_exceeded",
    "docker_setup_deadline_exceeded",
    "provider_output_limit_exceeded",
    "provider_process_signalled",
    "provider_process_exit_nonzero",
    "provider_subscription_quota_exhausted",
    "provider_authentication_expired",
    "provider_operation_budget_exceeded",
    "provider_turn_limit_exceeded",
    "provider_structured_output_retry_exhausted",
    "provider_invocation_rejected",
    "provider_network_unavailable",
    "provider_service_unavailable",
    "docker_setup_create_subscription_auth_probe_failed",
    "docker_setup_start_subscription_auth_probe_attached_failed",
    "docker_setup_create_internal_network_failed",
    "docker_setup_create_egress_network_failed",
    "docker_setup_create_proxy_failed",
    "docker_setup_connect_proxy_egress_failed",
    "docker_setup_create_provider_failed",
    "docker_setup_start_proxy_failed",
    "docker_setup_command_failed",
    "docker_resource_submission_record_unavailable",
    "docker_resource_receipt_unavailable",
    "docker_process_controller_execution_restricted",
    "provider_subscription_auth_not_confirmed",
    "provider_result_invalid",
    "provider_task_result_input_invalid",
    "provider_task_result_json_invalid",
    "provider_task_result_envelope_status_invalid",
    "provider_task_result_turn_count_invalid",
    "provider_task_result_turn_limit_mismatch",
    "provider_task_result_cost_metadata_invalid",
    "provider_task_reviewer_result_transport_invalid",
    "provider_task_executor_shape_invalid",
    "provider_task_reviewer_shape_invalid",
    "provider_task_reviewer_keys_invalid",
    "provider_task_reviewer_decision_invalid",
    "provider_task_reviewer_summary_invalid",
    "provider_task_reviewer_findings_invalid",
    "provider_task_reviewer_finding_invalid",
    "provider_task_reviewer_decision_inconsistent",
    "docker_process_controller_execution_failed_closed",
    "docker_process_controller_provider_start_failed",
    "docker_process_controller_provider_start_observation_failed",
    "repository_revision_changed",
  ] as const);

export type DockerProcessControllerPublicCompletionReason =
  (typeof DOCKER_PROCESS_CONTROLLER_PUBLIC_COMPLETION_REASONS)[number];
