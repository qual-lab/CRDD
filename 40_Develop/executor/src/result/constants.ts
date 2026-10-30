/**
 * 試行結果と非秘密診断で共有する固定語彙を定義する。
 * @packageDocumentation
 * @responsibility 理由・診断段階・Command用途の固定集合を所有し、検査・状態遷移・保存は行わない。
 * @trace ARCH-000008
 * @boundary Executor内部の結果型・検査・実行間で共有する値の境界。
 */
import { PROVIDER_ADVICE_OUTPUT_REASONS } from "../../../ai-adapter/src/index.ts";

export const ATTEMPT_COMPLETION_REASONS = Object.freeze([
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
  "workbench_ai_advice_result_identity_invalid",
  "workbench_ai_advice_result_input_invalid",
  "workbench_ai_advice_result_items_invalid",
  "workbench_ai_advice_result_schema_invalid",
  ...PROVIDER_ADVICE_OUTPUT_REASONS,
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

export const PURPOSES = Object.freeze([
  "create_subscription_auth_probe",
  "start_subscription_auth_probe_attached",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "connect_proxy_egress",
  "create_provider",
  "start_proxy",
  "start_provider_attached",
] as const);

export const SETUP_COMMAND_FAILURE_REASONS = Object.freeze({
  create_subscription_auth_probe:
    "docker_setup_create_subscription_auth_probe_failed",
  start_subscription_auth_probe_attached:
    "docker_setup_start_subscription_auth_probe_attached_failed",
  create_internal_network: "docker_setup_create_internal_network_failed",
  create_egress_network: "docker_setup_create_egress_network_failed",
  create_proxy: "docker_setup_create_proxy_failed",
  connect_proxy_egress: "docker_setup_connect_proxy_egress_failed",
  create_provider: "docker_setup_create_provider_failed",
  start_proxy: "docker_setup_start_proxy_failed",
} satisfies Readonly<
  Record<
    Exclude<(typeof PURPOSES)[number], "start_provider_attached">,
    (typeof ATTEMPT_COMPLETION_REASONS)[number]
  >
>);

export const RECOVERY_START_FAILURE_STAGES = Object.freeze([
  "plan_validation",
  "operation_context",
  "provider_home",
  "home_lock",
  "operation_binding",
  "state_conflict",
  "operation_start_save",
  "settlement_binding",
  "host_submission",
  "home_lock_release",
  "unknown",
] as const);
