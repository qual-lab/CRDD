# Project Runtime詳細設計

状態: 現行正本
担当責任者: Qual-Lab
最終更新日: 2026-09-11

## Related

- [Project Runtimeアーキテクチャ](01_Architecture.md)
- [Project Runtime責務分離](../../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)
- [検証設計](../../07_Quality/03_Verification_Design.md)

<a id="historical-design-reference"></a>

### 過去版の参照

本書は現在の設計だけを更新する。v0.19.0時点の詳細設計と当時の件数は、現行文書へ上書きせず、`Git tag v0.19.0:06_Architecture/coordinator/03_Project_Runtime_Design.md`で参照する。現在の件数と契約は本書および機械可読な設計対応から取得し、過去版の件数を現在値として利用しない。

## 1. 目的と所有範囲

本書はProject Runtimeの現在有効なInterface、永続Record、資源、Lock、Authority、Effect、状態遷移、不変条件および失敗注入点を所有する。版ごとの旧設計文書は現行Treeへ累積せず、当時の内容は対応するGit tagで保持する。

[上位アーキテクチャ](01_Architecture.md)は責務、依存方向、公開PortおよびPlatform境界を所有する。[機械可読な設計対応](../../07_Quality/06_Project_Runtime_Design_Traceability.json)は本書を再定義せず、本書とCoordinator実装・試験の対応切れを検出する検証用投影である。

<a id="detailed-design-contract"></a>
## 2. Interface

| ID | 所有者 | 実装状態 | 実装段階 |
|---|---|---|---|
| `IF-PROJECT-CORE` | `project_runtime_core` | `partial` | `durable_foundation_through_integration` |
| `IF-SINGLE-TASK` | `single_task_adapter` | `partial` | `responsibility_separation_and_single_task_flow` |
| `IF-STATE-STORE` | `project_state_store` | `partial` | `durable_foundation` |
| `IF-QUEUE` | `durable_operation_queue` | `partial` | `durable_foundation` |
| `IF-SCHEDULER` | `project_scheduler` | `partial` | `multi_task_execution` |
| `IF-INTEGRATION` | `integration_owner` | `partial` | `integration_and_adoption` |
| `IF-TRANSPORT` | `transport_adapter` | `partial` | `single_task_flow` |
| `IF-DECISION` | `human_decision_controller` | `partial` | `human_decision_flow` |
| `IF-PLATFORM` | `platform_adapter` | `partial` | `responsibility_separation` |

## 3. 永続Record

| ID | 所有Interface | 資源 | 耐久化の意味 | 必須意味 |
|---|---|---|---|---|
| `REC-PROJECT-STATE` | `IF-STATE-STORE` | `RES-PROJECT-STATE` | `generation_state` | — |
| `REC-QUEUE-ENTRY` | `IF-QUEUE` | `RES-PROJECT-QUEUE` | `before_effect_intent` | — |
| `REC-PROJECT-LEASE` | `IF-QUEUE` | `RES-PROJECT-OPERATION-LEASE` | `before_effect_intent` | — |
| `REC-TASK-ATTEMPT` | `IF-PROJECT-CORE` | `RES-SINGLE-TASK-BINDING` | `before_effect_intent` | `attempt_operation_authority_binding`<br>`start_phase_reserved_handoff_prepared_running_or_settled`<br>`typed_recovery_obligations_host_docker_candidate_or_candidate_store`<br>`per_obligation_phase_required_recovering_settled_or_docker_acknowledged`<br>`docker_acknowledgement_exact_project_operation_settlement_runtime_root_and_receipt_pair_binding`<br>`unresolved_recovery_without_synthetic_identity` |
| `REC-INTEGRATION` | `IF-INTEGRATION` | `RES-INTEGRATION-WORKSPACE` | `after_effect_result` | — |
| `REC-ADOPTION` | `IF-INTEGRATION` | `RES-ADOPTION-LEASE` | `after_effect_receipt` | — |
| `REC-HUMAN-DECISION` | `IF-DECISION` | `RES-PENDING-DECISION` | `generation_state` | `decision_project_milestone_generation_revision`<br>`selected_user_principal`<br>`continuation_record_id`<br>`decision_application_generation`<br>`decision_lifecycle_state` |
| `REC-DECISION-CONTINUATION` | `IF-DECISION` | `RES-DECISION-CONTINUATION` | `before_effect_intent` | `continuation_hash`<br>`selected_user_principal`<br>`decision_project_milestone_generation_revision`<br>`continuation_expiry`<br>`continuation_consumed_or_invalidated_state`<br>`replacement_request_identity`<br>`decision_application_id`<br>`expected_project_generation`<br>`new_project_generation`<br>`application_disposition_issued_prepared_finalized_recovery_invalidated_or_expired` |
| `REC-DECISION-RECOVERY-INTENT` | `IF-PLATFORM` | `RES-DECISION-RECOVERY-INTENT` | `before_effect_intent` | `exact_continuation_record_identity`<br>`last_confirmed_disposition`<br>`decision_application_id`<br>`expected_project_generation`<br>`new_project_generation`<br>`unknown_observation_boundary`<br>`recovery_identity`<br>`recovery_disposition_required_or_settled` |
| `REC-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `IF-PLATFORM` | `RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `after_effect_receipt` | `exact_docker_recovery_identity`<br>`fresh_runtime_root_four_hash_binding`<br>`completion_receipt_committed_pair_hash_and_identity`<br>`temporary_acknowledgement_tombstone_not_project_history`<br>`project_acknowledged_readback_precedes_tombstone_gc`<br>`absence_is_not_acknowledgement` |

## 4. 資源と終了条件

| ID | 所有者 | 範囲／保存境界 | 終了条件 |
|---|---|---|---|
| `RES-PROJECT-QUEUE` | `durable_operation_queue` | `—` | `terminal_record_retained_or_policy_deletion_observed` |
| `RES-PROJECT-OPERATION-LEASE` | `parent_coordinator` | `one_operation_per_repository_binding` | `all_child_tasks_reconciled_and_os_exclusion_release_observed` |
| `RES-PROJECT-STATE` | `project_state_store` | `—` | `expected_generation_atomic_replace_observed` |
| `RES-SCHEDULER-SLOT` | `project_scheduler` | `—` | `task_process_absent_and_cleanup_confirmed` |
| `RES-CONFLICT-RESERVATION` | `project_scheduler` | `—` | `effect_candidate_and_recovery_impact_reconciled` |
| `RES-SINGLE-TASK-BINDING` | `project_runtime` | `—` | `exact_operation_settled_to_result_cleanup_or_recovery` |
| `RES-INTEGRATION-WORKSPACE` | `integration_owner` | `—` | `candidate_adopted_or_discarded_and_workspace_cleanup_observed` |
| `RES-ADOPTION-LEASE` | `integration_owner` | `—` | `adoption_receipt_and_repository_revision_observed` |
| `RES-CANCELLATION-CONTROLLER` | `parent_coordinator` | `—` | `all_target_tasks_terminated_cleaned_and_projected` |
| `RES-PROJECT-RECOVERY-EVIDENCE` | `issuing_runtime` | `—` | `exact_recovery_completed_and_resource_absence_observed` |
| `RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `platform_adapter` | `verified_runtime_state_root` | `project_acknowledged_read_back_and_tombstone_absence_observed_old_receipt_replay_rejected` |
| `RES-PENDING-DECISION` | `human_decision_controller` | `—` | `accepted_stale_superseded_or_cancelled_record_durable` |
| `RES-DECISION-CONTINUATION` | `human_decision_controller_via_platform_adapter` | `os_managed_runtime_protected_root_outside_repository` | `hash_finalized_invalidated_expired_or_recovery_obligation_settled_and_raw_capability_absent_from_runtime_owned_surfaces` |
| `RES-DECISION-RECOVERY-INTENT` | `platform_adapter_recovery_store` | `separate_verified_runtime_owned_recovery_store` | `exact_recovery_join_settled_and_intent_settlement_read_back` |

## 5. Lock

| ID | 所有者 | 順序 | 入れ子可能 | 外部待機中の保持 |
|---|---|---:|---|---|
| `LOCK-QUEUE-MUTATION` | `durable_operation_queue` | 1 | — | `false` |
| `LOCK-PROJECT-OPERATION` | `parent_coordinator` | 2 | `LOCK-PROJECT-STATE`<br>`LOCK-ADOPTION` | `true` |
| `LOCK-PROJECT-STATE` | `project_state_store` | 3 | — | `false` |
| `LOCK-ADOPTION` | `integration_owner` | 4 | — | `false` |

## 6. Authority

| ID | 所有者 | 範囲／発行 | 終了条件 |
|---|---|---|---|
| `AUTH-MILESTONE` | `authenticated_human_via_parent_coordinator` | `one_project_one_repository_one_milestone_and_declared_limits` | `milestone_terminal_or_authority_revoked` |
| `AUTH-TASK` | `project_runtime` | `strict_subset_of_milestone_for_one_task_attempt`<br>`binding_derived_from_current_project_milestone_objective_task_attempt_and_repository_revision; execution_authorization_is_separate_and_issued_after_durable_attempt_reservation_immediately_before_effect` | `attempt_settled_or_superseded_or_revoked` |
| `AUTH-SINGLE-TASK-OPERATION` | `single_task_adapter` | `one_exact_single_task_operation_and_candidate_boundary` | `operation_cleanup_or_exact_recovery_obligation_observed` |
| `AUTH-INTEGRATION` | `integration_owner` | `fixed_task_result_set_and_acceptance_criteria_without_canonical_write` | `integration_candidate_fixed_or_discarded` |
| `AUTH-ADOPTION` | `authenticated_human_via_parent_coordinator` | `fixed_candidate_fixed_paths_and_fresh_canonical_revision` | `adoption_receipt_or_no_effect_rejection_observed` |
| `AUTH-RECOVERY` | `issuing_runtime` | `exact_operation_resource_and_recovery_identity_only` | `exact_recovery_completed_or_human_transfer_recorded` |
| `AUTH-HUMAN-DECISION` | `parent_coordinator_verifying_selected_user_and_runtime_owned_continuation` | `exact_pending_decision_project_milestone_generation_revision_allowed_option_and_single_use_continuation` | `protected_finalized_or_exact_recovery_obligation_durable_or_runtime_owned_stale_superseded_cancelled_project_terminal_or_expired; invalid_input_preserves_existing_capability` |

## 7. Effect

| ID | 所有者 | Effect境界 | 成立観測 |
|---|---|---|---|
| `EFFECT-QUEUE-STATE` | `durable_operation_queue` | `repository_local_queue_record_mutation` | `generation_hash_and_atomic_replace_observed` |
| `EFFECT-PROJECT-STATE` | `project_state_store` | `repository_local_project_state_mutation` | `expected_generation_and_atomic_replace_observed` |
| `EFFECT-SINGLE-TASK` | `single_task_adapter` | `provider_process_container_and_candidate_operation` | `exact_operation_result_cleanup_or_recovery_identity` |
| `EFFECT-INTEGRATION-CANDIDATE` | `integration_owner` | `isolated_workspace_and_candidate_generation` | `candidate_hash_conflict_and_workspace_cleanup` |
| `EFFECT-CANONICAL-ADOPTION` | `integration_owner` | `canonical_repository_path_mutation` | `fresh_base_revision_changed_paths_receipt_and_post_revision` |
| `EFFECT-RECOVERY` | `issuing_runtime` | `exact_residual_resource_reconciliation` | `recovery_receipt_and_resource_absence` |
| `EFFECT-DECISION-STATE` | `human_decision_controller` | `one_repository_local_atomic_decision_and_milestone_project_state_generation_application` | `expected_generation atomic_replace and project_state_readback show decision_and_milestone_all_old_or_all_new` |
| `EFFECT-DECISION-CONTINUATION` | `platform_adapter_for_human_decision_controller` | `os_managed_runtime_protected_continuation_record_cas_mutation` | `selected_user_protection application_id expected_and_new_generation disposition and atomic_update_readback` |
| `EFFECT-DECISION-RECOVERY-INTENT` | `platform_adapter_recovery_store` | `separate_runtime_owned_exact_decision_recovery_intent_mutation` | `recovery_identity unknown_boundary last_confirmed_disposition and atomic_update_readback` |

## 8. 状態機械と遷移

状態名だけで完了、cleanup、Authority失効またはEffect不存在を推定しない。各遷移は対応する資源、不変条件および検証項目が成立した場合だけ有効とする。

### `SM-TASK`

- 状態: `planned`<br>`waiting_dependency`<br>`ready`<br>`starting`<br>`running`<br>`cleanup_pending`<br>`completed`<br>`failed`<br>`cancelled`<br>`recovery_required`<br>`superseded`
- 終端状態: `completed`<br>`cancelled`<br>`superseded`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-TASK-PLAN-WAIT` | `planned` | `waiting_dependency` | — | `INV-REVALIDATE-AFTER-WAIT` | `PR-N-03` |
| `TRANS-TASK-PLAN-READY` | `planned`<br>`waiting_dependency` | `ready` | — | `INV-REVALIDATE-AFTER-WAIT`<br>`INV-MAX-FIVE-CLEANUP-AWARE` | `PR-N-02`<br>`PR-N-03`<br>`PR-Q-01`<br>`PR-A-01` |
| `TRANS-TASK-READY-STARTING` | `ready` | `starting` | `RES-SCHEDULER-SLOT`<br>`RES-CONFLICT-RESERVATION`<br>`RES-SINGLE-TASK-BINDING` | `INV-DURABLE-BEFORE-TASK-EFFECT`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-N-02`<br>`PR-A-02`<br>`PR-A-04` |
| `TRANS-TASK-STARTING-RUNNING` | `starting` | `running` | `RES-SINGLE-TASK-BINDING` | `INV-NARROWED-AUTHORITY`<br>`INV-REVALIDATE-AFTER-WAIT`<br>`INV-DURABLE-BEFORE-TASK-EFFECT` | `PR-N-01`<br>`PR-A-03`<br>`PR-A-04` |
| `TRANS-TASK-ACTIVE-CLEANUP` | `starting`<br>`running` | `cleanup_pending` | `RES-SCHEDULER-SLOT`<br>`RES-CONFLICT-RESERVATION`<br>`RES-SINGLE-TASK-BINDING` | `INV-MAX-FIVE-CLEANUP-AWARE`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-Q-04`<br>`PR-A-05` |
| `TRANS-TASK-CLEANUP-COMPLETED` | `cleanup_pending` | `completed` | `RES-SINGLE-TASK-BINDING` | `INV-TASK-COMPLETE-NOT-ACCEPTED`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-N-01`<br>`PR-I-01` |
| `TRANS-TASK-ACTIVE-FAILED` | `starting`<br>`running`<br>`cleanup_pending` | `failed` | `RES-SINGLE-TASK-BINDING` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-Q-02`<br>`PR-A-03` |
| `TRANS-TASK-FAILED-SUPERSEDED` | `failed` | `superseded` | — | `INV-OLD-IDENTITY-IMMUTABLE` | `PR-Q-02` |
| `TRANS-TASK-ACTIVE-CANCELLED` | `planned`<br>`waiting_dependency`<br>`ready`<br>`starting`<br>`running`<br>`cleanup_pending`<br>`failed` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |
| `TRANS-TASK-ACTIVE-RECOVERY` | `starting`<br>`running`<br>`cleanup_pending`<br>`failed` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05` |
| `TRANS-TASK-RECOVERY-SETTLED` | `recovery_required` | `ready` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-A-04`<br>`PR-A-05` |

### `SM-OBJECTIVE`

- 状態: `planned`<br>`executing`<br>`integration_pending`<br>`accepted`<br>`blocked`<br>`cancelled`
- 終端状態: `accepted`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-OBJECTIVE-PLAN-EXECUTE` | `planned`<br>`blocked` | `executing` | — | `INV-NARROWED-AUTHORITY` | `PR-N-03`<br>`PR-Q-02` |
| `TRANS-OBJECTIVE-EXECUTE-INTEGRATE` | `executing` | `integration_pending` | `RES-INTEGRATION-WORKSPACE` | `INV-TASK-COMPLETE-NOT-ACCEPTED` | `PR-I-01` |
| `TRANS-OBJECTIVE-INTEGRATE-ACCEPT` | `integration_pending` | `accepted` | `RES-INTEGRATION-WORKSPACE` | `INV-INTEGRATE-BEFORE-ADOPTION` | `PR-I-02` |
| `TRANS-OBJECTIVE-ACTIVE-BLOCK` | `planned`<br>`executing`<br>`integration_pending` | `blocked` | — | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01`<br>`PR-I-01` |
| `TRANS-OBJECTIVE-ACTIVE-CANCEL` | `planned`<br>`executing`<br>`integration_pending`<br>`blocked` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-MILESTONE`

- 状態: `planned`<br>`executing`<br>`integrating`<br>`human_decision_required`<br>`recovery_required`<br>`accepted`<br>`cancelled`
- 終端状態: `accepted`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-MILESTONE-PLAN-EXECUTE` | `planned` | `executing` | `RES-PROJECT-OPERATION-LEASE` | `INV-NARROWED-AUTHORITY`<br>`INV-EXACT-RESULT-IDENTITY`<br>`INV-PLATFORM-NO-FALLBACK`<br>`INV-TRANSPORT-NO-AUTHORITY` | `PR-N-01`<br>`PR-A-07` |
| `TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `human_decision_required` | `executing` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-RECEIPT-BEFORE-RESUME`<br>`INV-DECISION-ATOMIC-APPLICATION`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `recovery_required` | `executing` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-MILESTONE-EXECUTE-INTEGRATE` | `executing` | `integrating` | `RES-INTEGRATION-WORKSPACE` | `INV-TASK-COMPLETE-NOT-ACCEPTED` | `PR-I-01` |
| `TRANS-MILESTONE-INTEGRATE-ACCEPT` | `integrating` | `accepted` | `RES-INTEGRATION-WORKSPACE`<br>`RES-ADOPTION-LEASE` | `INV-INTEGRATE-BEFORE-ADOPTION`<br>`INV-CANONICAL-EFFECT-SERIALIZED`<br>`INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `PR-I-02`<br>`PR-D-A-01` |
| `TRANS-MILESTONE-ACTIVE-HUMAN` | `executing`<br>`integrating` | `human_decision_required` | — | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01` |
| `TRANS-MILESTONE-ACTIVE-RECOVERY` | `executing`<br>`integrating`<br>`human_decision_required` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05` |
| `TRANS-MILESTONE-ACTIVE-CANCEL` | `planned`<br>`executing`<br>`integrating`<br>`human_decision_required`<br>`recovery_required` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-QUEUE`

- 状態: `queued`<br>`leased`<br>`running`<br>`waiting_foreground`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required`<br>`recovery_required`<br>`completed`<br>`cancelled`
- 終端状態: `completed`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-QUEUE-ENQUEUE-LEASE` | `queued` | `leased` | `RES-PROJECT-QUEUE`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-DURABLE-BEFORE-TASK-EFFECT`<br>`INV-INTERACTIVE-PRIORITY-NO-PREEMPTION`<br>`INV-DURABLE-RECORD-CLOSED`<br>`INV-QUEUE-OWNER-IS-LIVE-LEASE`<br>`INV-LEASE-ACQUISITION-RECOVERABLE` | `PR-D-N-01`<br>`PR-D-Q-01`<br>`PR-Q-03`<br>`PR-Q-05`<br>`PR-A-04`<br>`PR-A-06` |
| `TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `human_decision_required` | `replan_required` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-QUEUE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-RECEIPT-BEFORE-RESUME`<br>`INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-QUEUE-REPLAN-QUEUED` | `replan_required` | `queued` | `RES-PROJECT-QUEUE` | `INV-REVALIDATE-AFTER-WAIT` | `PR-Q-02`<br>`PR-Q-06` |
| `TRANS-QUEUE-WAITING-QUEUED` | `waiting_foreground` | `queued` | `RES-PROJECT-QUEUE` | `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-Q-05` |
| `TRANS-QUEUE-RECOVERY-SETTLED-QUEUED` | `recovery_required` | `queued` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-QUEUE-LEASE-RUN` | `leased` | `running` | `RES-PROJECT-OPERATION-LEASE` | `INV-REVALIDATE-AFTER-WAIT`<br>`INV-NO-LOCK-ACROSS-EXTERNAL-WAIT`<br>`INV-QUEUE-OWNER-IS-LIVE-LEASE`<br>`INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `PR-D-Q-01`<br>`PR-D-A-01`<br>`PR-N-01`<br>`PR-A-06` |
| `TRANS-QUEUE-RUN-INTEGRATE` | `running` | `integration_pending` | `RES-INTEGRATION-WORKSPACE`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-INTEGRATE-BEFORE-ADOPTION`<br>`INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `PR-I-01`<br>`PR-D-A-01` |
| `TRANS-QUEUE-INTEGRATE-COMPLETE` | `integration_pending` | `completed` | `RES-PROJECT-OPERATION-LEASE` | `INV-CANONICAL-EFFECT-SERIALIZED`<br>`INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `PR-I-02`<br>`PR-D-A-01` |
| `TRANS-QUEUE-QUEUED-FOREGROUND` | `queued` | `waiting_foreground` | `RES-PROJECT-QUEUE` | `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION` | `PR-Q-05` |
| `TRANS-QUEUE-ACTIVE-REPLAN` | `leased`<br>`running`<br>`integration_pending` | `replan_required` | `RES-PROJECT-QUEUE` | `INV-NARROWED-AUTHORITY` | `PR-Q-02` |
| `TRANS-QUEUE-ACTIVE-HUMAN` | `leased`<br>`running`<br>`integration_pending`<br>`replan_required` | `human_decision_required` | `RES-PROJECT-QUEUE` | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01` |
| `TRANS-QUEUE-ACTIVE-RECOVERY` | `leased`<br>`running`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-QUEUE-ACTIVE-CANCEL` | `queued`<br>`leased`<br>`running`<br>`waiting_foreground`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required`<br>`recovery_required` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-DECISION`

- 状態: `pending`<br>`accepted`<br>`stale`<br>`superseded`<br>`cancelled`
- 終端状態: `accepted`<br>`stale`<br>`superseded`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-DECISION-PENDING-ACCEPTED` | `pending` | `accepted` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-MCP-NO-HUMAN-AUTHORITY`<br>`INV-DECISION-ATOMIC-APPLICATION` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-DECISION-PENDING-STALE` | `pending` | `stale` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |
| `TRANS-DECISION-PENDING-SUPERSEDED` | `pending` | `superseded` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |
| `TRANS-DECISION-PENDING-CANCELLED` | `pending` | `cancelled` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |

### `SM-DECISION-CONTINUATION`

- 状態: `absent`<br>`issued`<br>`prepared`<br>`finalized`<br>`recovery_required`<br>`invalidated`<br>`expired`
- 終端状態: `finalized`<br>`invalidated`<br>`expired`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-CONTINUATION-ABSENT-ISSUED` | `absent` | `issued` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-ISSUED-PREPARED` | `issued` | `prepared` | `RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PREPARED-FINALIZED` | `prepared` | `finalized` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-ATOMIC-APPLICATION` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `prepared` | `recovery_required` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-UNKNOWN-PRESERVES-RECOVERY`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-ISSUED-INVALIDATED` | `issued` | `invalidated` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `prepared` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-PREPARED-INVALIDATION-READBACK` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-RECOVERY-FINALIZED` | `recovery_required` | `finalized` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-PROJECT-RECOVERY-EVIDENCE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-RECOVERY-INVALIDATED` | `recovery_required` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-PROJECT-RECOVERY-EVIDENCE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `issued` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `prepared` | `recovery_required` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-ISSUED-EXPIRED` | `issued` | `expired` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |

### `SM-DECISION-RECOVERY-INTENT`

- 状態: `absent`<br>`required`<br>`settled`
- 終端状態: `settled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-DECISION-RECOVERY-ABSENT-REQUIRED` | `absent` | `required` | `RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `required` | `settled` | `RES-DECISION-RECOVERY-INTENT`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |

## 9. 遷移と保証の対応

| ID | 遷移 | Lock | Authority | Effect | 順序 | 検証 |
|---|---|---|---|---|---|---|
| `BIND-TASK-PLAN-WAIT` | `TRANS-TASK-PLAN-WAIT` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `expected generation state update` | `PR-N-03` |
| `BIND-TASK-PLAN-READY` | `TRANS-TASK-PLAN-READY` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `dependency conflict and capacity revalidation precede state update` | `PR-N-02`<br>`PR-N-03`<br>`PR-Q-01`<br>`PR-A-01` |
| `BIND-TASK-READY-STARTING` | `TRANS-TASK-READY-STARTING` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `slot conflict reservation and task intent become durable in one generation` | `PR-N-02`<br>`PR-A-02` |
| `BIND-TASK-STARTING-RUNNING` | `TRANS-TASK-STARTING-RUNNING` | `LOCK-PROJECT-OPERATION` | `AUTH-TASK`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `project state lock is released and all identities are revalidated before single task effect` | `PR-N-01`<br>`PR-A-03` |
| `BIND-TASK-ACTIVE-CLEANUP` | `TRANS-TASK-ACTIVE-CLEANUP` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `task settlement observation precedes cleanup pending projection` | `PR-Q-04`<br>`PR-A-05` |
| `BIND-TASK-CLEANUP-COMPLETED` | `TRANS-TASK-CLEANUP-COMPLETED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `exact cleanup observation precedes completed projection` | `PR-N-01`<br>`PR-I-01` |
| `BIND-TASK-ACTIVE-FAILED` | `TRANS-TASK-ACTIVE-FAILED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `known failure and current generation precede failed projection` | `PR-Q-02`<br>`PR-A-03` |
| `BIND-TASK-FAILED-SUPERSEDED` | `TRANS-TASK-FAILED-SUPERSEDED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `old identity remains immutable before successor linkage` | `PR-Q-02` |
| `BIND-TASK-ACTIVE-CANCELLED` | `TRANS-TASK-ACTIVE-CANCELLED` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-TASK`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `cancellation request precedes termination cleanup and final state projection` | `PR-Q-04` |
| `BIND-TASK-ACTIVE-RECOVERY` | `TRANS-TASK-ACTIVE-RECOVERY` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `unknown settlement is durably projected without issuing recovery effect` | `PR-A-04`<br>`PR-A-05` |
| `BIND-TASK-RECOVERY-SETTLED` | `TRANS-TASK-RECOVERY-SETTLED` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `docker completion and absence receipt precedes project settled readback; runtime-state-lock serialized exact tombstone create and receipt removal precede project acknowledged readback; journaled tombstone removal and queue recovery settlement precede fresh retry projection; non-docker obligations require settled` | `PR-A-04`<br>`PR-A-05` |
| `BIND-OBJECTIVE-PLAN-EXECUTE` | `TRANS-OBJECTIVE-PLAN-EXECUTE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `objective authority and current generation precede execution state` | `PR-N-03`<br>`PR-Q-02` |
| `BIND-OBJECTIVE-EXECUTE-INTEGRATE` | `TRANS-OBJECTIVE-EXECUTE-INTEGRATE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-PROJECT-STATE` | `all task cleanup precedes isolated integration and integration pending projection` | `PR-I-01` |
| `BIND-OBJECTIVE-INTEGRATE-ACCEPT` | `TRANS-OBJECTIVE-INTEGRATE-ACCEPT` | `LOCK-PROJECT-STATE` | `AUTH-INTEGRATION` | `EFFECT-PROJECT-STATE` | `acceptance evidence and fixed integration result precede accepted projection` | `PR-I-02` |
| `BIND-OBJECTIVE-ACTIVE-BLOCK` | `TRANS-OBJECTIVE-ACTIVE-BLOCK` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `unknown or conflict remains explicit before blocked projection` | `PR-H-01`<br>`PR-I-01` |
| `BIND-OBJECTIVE-ACTIVE-CANCEL` | `TRANS-OBJECTIVE-ACTIVE-CANCEL` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `all target task cancellation cleanup precedes objective cancellation projection` | `PR-Q-04` |
| `BIND-MILESTONE-PLAN-EXECUTE` | `TRANS-MILESTONE-PLAN-EXECUTE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `platform binding revision and authority validation precede execution state` | `PR-N-01`<br>`PR-A-07` |
| `BIND-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-HUMAN-DECISION` | `EFFECT-DECISION-STATE` | `logical milestone projection in the same project state atomic replace as decision acceptance; standalone issue forbidden` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `every non-docker obligation settled and every docker obligation durably acknowledged with temporary tombstone garbage collected before queue settlement and execution state in the same state generation as the fresh task retry` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-MILESTONE-EXECUTE-INTEGRATE` | `TRANS-MILESTONE-EXECUTE-INTEGRATE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-PROJECT-STATE` | `all objectives accepted before isolated milestone integration` | `PR-I-01` |
| `BIND-MILESTONE-INTEGRATE-ACCEPT` | `TRANS-MILESTONE-INTEGRATE-ACCEPT` | `LOCK-PROJECT-OPERATION`<br>`LOCK-ADOPTION`<br>`LOCK-PROJECT-STATE` | `AUTH-INTEGRATION`<br>`AUTH-ADOPTION`<br>`AUTH-MILESTONE` | `EFFECT-CANONICAL-ADOPTION`<br>`EFFECT-PROJECT-STATE` | `fixed candidate fresh canonical revision and adoption receipt precede accepted projection` | `PR-A-06`<br>`PR-I-02` |
| `BIND-MILESTONE-ACTIVE-HUMAN` | `TRANS-MILESTONE-ACTIVE-HUMAN` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `decision need and impact are durable before human transfer` | `PR-H-01` |
| `BIND-MILESTONE-ACTIVE-RECOVERY` | `TRANS-MILESTONE-ACTIVE-RECOVERY` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `unknown resource evidence is durable without normal resume` | `PR-A-04`<br>`PR-A-05` |
| `BIND-MILESTONE-ACTIVE-CANCEL` | `TRANS-MILESTONE-ACTIVE-CANCEL` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `all task cancellation cleanup and recovery reconciliation precede milestone cancellation` | `PR-Q-04` |
| `BIND-QUEUE-ENQUEUE-LEASE` | `TRANS-QUEUE-ENQUEUE-LEASE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `queue intent is durable before operation lease and locks are not held together` | `PR-D-N-01`<br>`PR-D-Q-01`<br>`PR-Q-03`<br>`PR-Q-05`<br>`PR-A-06` |
| `BIND-QUEUE-DECISION-ACCEPTED-REPLAN` | `TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `fresh read only protected finalized observation and matching project application generation precede the durable replan_required generation; no lease is issued on this transition` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-QUEUE-REPLAN-QUEUED` | `TRANS-QUEUE-REPLAN-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `bounded replanning is durably complete before the queue returns to queued for a fresh selection` | `PR-Q-02`<br>`PR-Q-06` |
| `BIND-QUEUE-WAITING-QUEUED` | `TRANS-QUEUE-WAITING-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `a fresh binding-wide scan confirms no foreground owner before the scheduled queue returns to queued` | `PR-Q-05` |
| `BIND-QUEUE-RECOVERY-SETTLED-QUEUED` | `TRANS-QUEUE-RECOVERY-SETTLED-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-RECOVERY` | `EFFECT-RECOVERY`<br>`EFFECT-QUEUE-STATE` | `runtime uses durable exact recovery identity; docker receipt and absence project settled exact acknowledgement project acknowledged and acknowledgement garbage collection precede queue settlement; a later ordinary selection revalidates before lease` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-QUEUE-LEASE-RUN` | `TRANS-QUEUE-LEASE-RUN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `lease identity is revalidated before running projection` | `PR-N-01`<br>`PR-A-06` |
| `BIND-QUEUE-RUN-INTEGRATE` | `TRANS-QUEUE-RUN-INTEGRATE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-QUEUE-STATE` | `all task cleanup precedes integration and queue projection` | `PR-I-01` |
| `BIND-QUEUE-INTEGRATE-COMPLETE` | `TRANS-QUEUE-INTEGRATE-COMPLETE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `milestone terminal state and all resource release observations precede queue completion` | `PR-I-02` |
| `BIND-QUEUE-QUEUED-FOREGROUND` | `TRANS-QUEUE-QUEUED-FOREGROUND` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `interactive priority delays only unstarted scheduled entry` | `PR-Q-05` |
| `BIND-QUEUE-ACTIVE-REPLAN` | `TRANS-QUEUE-ACTIVE-REPLAN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `settled task impact and bounded replan need precede queue projection` | `PR-Q-02` |
| `BIND-QUEUE-ACTIVE-HUMAN` | `TRANS-QUEUE-ACTIVE-HUMAN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `decision need is durable and operation remains owned` | `PR-H-01` |
| `BIND-QUEUE-ACTIVE-RECOVERY` | `TRANS-QUEUE-ACTIVE-RECOVERY` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-QUEUE-STATE` | `exact recovery evidence is durable without recovery effect or lease release` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-QUEUE-ACTIVE-CANCEL` | `TRANS-QUEUE-ACTIVE-CANCEL` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-QUEUE-STATE` | `all target cancellation cleanup and resource reconciliation precede queue cancellation` | `PR-Q-04` |
| `BIND-DECISION-PENDING-ACCEPTED` | `TRANS-DECISION-PENDING-ACCEPTED` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-HUMAN-DECISION` | `EFFECT-DECISION-STATE` | `protected continuation consume intent precedes one expected generation atomic decision and milestone project state replace then readback; queue lease is a later idempotent transition` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-DECISION-PENDING-STALE` | `TRANS-DECISION-PENDING-STALE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `parent observed project generation change precedes runtime owned stale transition` | `PR-Q-06` |
| `BIND-DECISION-PENDING-SUPERSEDED` | `TRANS-DECISION-PENDING-SUPERSEDED` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `parent issued replacement decision before runtime owned superseded transition` | `PR-Q-06` |
| `BIND-DECISION-PENDING-CANCELLED` | `TRANS-DECISION-PENDING-CANCELLED` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `milestone cancellation precedes runtime owned decision cancellation` | `PR-Q-06` |
| `BIND-CONTINUATION-ABSENT-ISSUED` | `TRANS-CONTINUATION-ABSENT-ISSUED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `unique pending decision or replacement request identity precedes protected create CAS and fresh readback; raw capability is returned to the client only after issued readback and duplicate request reuses the same issued record` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-ISSUED-PREPARED` | `TRANS-CONTINUATION-ISSUED-PREPARED` | `LOCK-PROJECT-OPERATION` | `AUTH-HUMAN-DECISION` | `EFFECT-DECISION-CONTINUATION` | `validated exact submission precedes protected CAS from issued to prepared and protected readback precedes project state effect` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PREPARED-FINALIZED` | `TRANS-CONTINUATION-PREPARED-FINALIZED` | `LOCK-PROJECT-OPERATION` | `AUTH-HUMAN-DECISION` | `EFFECT-DECISION-CONTINUATION` | `fresh project state readback with matching application id and new generation precedes protected CAS from prepared to finalized and protected readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `when project observation alone is unknown a separate recovery intent required readback already exists before protected prepared to recovery_required CAS and readback; protected unknown never claims this transition` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-ISSUED-INVALIDATED` | `TRANS-CONTINUATION-ISSUED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `runtime owned stale superseded cancelled terminal or explicit replacement cause precedes issued record invalidation CAS and readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `fresh project state readback proves expected old generation and application absent before prepared record invalidation CAS and readback; matching new generation must finalize instead` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-RECOVERY-FINALIZED` | `TRANS-CONTINUATION-RECOVERY-FINALIZED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `exact recovery fresh readback proves matching new project generation and application id before protected recovery to finalized CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-RECOVERY-INVALIDATED` | `TRANS-CONTINUATION-RECOVERY-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `exact recovery fresh readback proves expected old project generation and application absent before protected recovery to invalidated CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `independent recovery intent required readback and fresh issued observation with no project application precede protected issued to invalidated CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `independent recovery intent required readback and fresh prepared observation precede protected prepared to recovery_required CAS and readback; exact project reconciliation follows through recovery transitions` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-ISSUED-EXPIRED` | `TRANS-CONTINUATION-ISSUED-EXPIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `runtime observed finite expiry precedes protected expiry CAS and readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-DECISION-RECOVERY-ABSENT-REQUIRED` | `TRANS-DECISION-RECOVERY-ABSENT-REQUIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-RECOVERY-INTENT` | `project-only unknown or protected observation or CAS readback unknown first creates and reads back one exact independent recovery intent; protected unknown then stops without claiming a continuation transition; unavailable recovery store requires manual recovery effect unknown and process reuse forbidden` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-DECISION-RECOVERY-REQUIRED-SETTLED` | `TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-RECOVERY-INTENT` | `independent intent joins fresh protected and project observations; any required continuation transition settles and reads back first and intent settlement CAS and readback completes last` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |

## 10. 不変条件

| ID | 必須意味 |
|---|---|
| `INV-DURABLE-BEFORE-TASK-EFFECT` | `Task attempt and non-secret authority binding become reserved before operation creation; exact operation identity becomes handoff_prepared before Single Task effect; running is recorded only from the adapter start observation` |
| `INV-MAX-FIVE-CLEANUP-AWARE` | `Starting running and cleanup-unknown tasks occupy at most five capacity slots` |
| `INV-REVALIDATE-AFTER-WAIT` | `Generation identity authority cancellation and conflicts are revalidated after every wait` |
| `INV-NO-LOCK-ACROSS-EXTERNAL-WAIT` | `Queue state and adoption mutation locks are not held across provider process transport or human waits` |
| `INV-NARROWED-AUTHORITY` | `Project Runtime derives the task authority binding from the current project milestone revision objective task and retry generation; the coordinator adapter receives only the resulting task-scoped request and cannot supply or widen that binding` |
| `INV-TASK-COMPLETE-NOT-ACCEPTED` | `Task completion never implies objective or milestone acceptance` |
| `INV-EXACT-RESULT-IDENTITY` | `Generation task attempt operation authority revision and storable recovery identities plus status effect cleanup recovery and process restart correlations must match before projection; runtime process recovery identity is issued only by the parent runtime and accepted only for its process instance task attempt and operation; known rejection before delegation replans with no effect, while unknown handoff after delegation or any non-settled result after observed effect start poisons the process, creates the bound runtime process obligation, and remains externally unresolved unless an exact external recovery closure exists` |
| `INV-INTEGRATE-BEFORE-ADOPTION` | `Objective and milestone evidence and cross-task integration precede canonical adoption` |
| `INV-UNKNOWN-PRESERVES-RECOVERY` | `Unknown cleanup or effect state preserves evidence and exact recovery identity` |
| `INV-NO-SUCCESS-FROM-UNKNOWN` | `Missing stale or conflicting evidence is not normalized to success` |
| `INV-CANCEL-AFTER-CLEANUP` | `Cancellation completes only after any freshly issued unused task authority is revoked and every target whose provider command received a successful OS spawn acknowledgement with valid process and stream ownership then emitted one durably accepted lifecycle notice for the exact objective role provider and globally unique operation terminates cleanup completes and project state is projected; handle return provider selection or controller start is not provider process-start evidence and uncertain acknowledgement notice delivery or revocation preserves failure or recovery` |
| `INV-OLD-IDENTITY-IMMUTABLE` | `Superseded task identity remains immutable and links to a new successor` |
| `INV-PLATFORM-NO-FALLBACK` | `Unknown or unsupported platform stops without fallback or effect` |
| `INV-TRANSPORT-NO-AUTHORITY` | `CLI MCP and future transports do not create project authority or success; Integration result fields recovery identities and correlations are validated by the Core-owned canonical contract rather than redefined by MCP; MCP emits only method-specific exact-contract recursively closed descriptor-safe DTOs and rejects nested unknown fields cross-method shapes outer-to-nested project or milestone mismatch status effect cleanup manual-recovery process-restart recovery-obligation correlation failures duplicate or invalid recovery identities unreachable milestone and objective or task count combinations and outer-objective contradictions with acceptance cancellation human-decision or recovery; resolved history is not promoted to current blockage and transport does not guess schedule versus wait without the task graph` |
| `INV-CANONICAL-EFFECT-SERIALIZED` | `Canonical repository adoption is serialized and fresh revision checked` |
| `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION` | `Queue priority applies only to unowned entries; after the repository binding lease is acquired a fresh queue selection must still match before claim; a leased or running owner prevents every second operation lease, parks later scheduled work, and never erases active obligations` |
| `INV-DURABLE-RECORD-CLOSED` | `Durable state and queue records have an exact schema filename bound generation and contiguous immutable generation history` |
| `INV-QUEUE-OWNER-IS-LIVE-LEASE` | `Queue owner generation is derived only from a runtime issued live lease bound to the exact repository binding and queue; one binding has at most one operation owner` |
| `INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `Every post-acquire exit attempts physical release; lease release intent is durable before lock removal and unresolved exact evidence blocks reacquisition` |
| `INV-LEASE-ACQUISITION-RECOVERABLE` | `An atomically published acquisition marker bound to lease kind source queue owner generation process and deterministic recovery identity precedes the physical lock; a second exact marker proves lock ownership; project operation and canonical adoption pre-owner failures reach fresh complete rollback, exact common recovery with all markers and lock absent, or unchanged manual recovery obligation` |
| `INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `Queue owner is cleared only after fresh lock absence exact released evidence and release-marker absence` |
| `INV-RECOVERY-SETTLED-BEFORE-RESUME` | `Recovery resumes only after every typed per-task obligation retains exact identity through required recovering and settled and each Docker obligation additionally reaches acknowledged; Docker ordering is completion receipt and resource absence then project settled readback then runtime-state-lock serialized exact tombstone create and receipt removal then project acknowledged readback bound to repository project milestone task attempt operation settlement generation runtime root four hashes and receipt committed pair then journaled tombstone removal then queue settlement; absence or recovery id alone grants no acknowledgement or deletion authority; interrupted committed-pair creation and removal resume only the exact incomplete effect; temporary tombstones are garbage collected after project acknowledgement without LRU or time deletion so sequential recovery does not exhaust the finite cap; unknown remains manual and recovery precedes fresh generation revision and conflict validation` |
| `INV-DECISION-BINDING-CURRENT` | `Human decision applies only to the exact current decision project milestone generation revision and allowed option` |
| `INV-MCP-NO-HUMAN-AUTHORITY` | `MCP metadata session provider identity and comment never create Human Authority` |
| `INV-DECISION-RECEIPT-BEFORE-RESUME` | `Milestone and queue resume only once from an exact accepted decision receipt and fresh project generation` |
| `INV-DECISION-ATOMIC-APPLICATION` | `Protected continuation record is prepared before one atomic decision and milestone project state replace then reconciled and finalized without claiming cross root atomicity` |
| `INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE` | `Queue lease occurs only after fresh protected continuation finalized observation and matching project state application id and generation readback` |
| `INV-DECISION-CONTINUATION-PROTOCOL` | `Only Platform Adapter owned protected CAS creates issued and transitions issued to prepared and prepared to finalized; invalid input leaves the record unchanged; project-only unknown may enter protected recovery after independent intent readback while protected-root unknown records only independent recovery intent and claims no protected transition` |
| `INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN` | `Raw capability is returned only after unique protected issued record create and fresh readback; duplicate issuance request reuses the same record and replacement first invalidates the old hash` |
| `INV-DECISION-PREPARED-INVALIDATION-READBACK` | `Prepared continuation invalidates only after fresh project state proves the expected old generation and application id absent; matching new generation finalizes and unknown recovers` |
| `INV-DECISION-RECOVERY-SETTLEMENT` | `Recovery settles matching new project generation to continuation finalized and verified old unapplied to continuation invalidated; exact absent with raw not returned or exact expired with project unapplied safely settles no-effect; unknown or conflict preserves the observable continuation state and keeps the independent recovery intent required` |
| `INV-DECISION-SEPARATE-RECOVERY-INTENT` | `Protected observation unknown never claims a protected transition and uses a separate verified recovery store; if that store is unknown manual recovery and process reuse prohibition remain` |

## 11. 失敗注入

| ID | 対象遷移 | 期待結果 | 検証 |
|---|---|---|---|
| `FAIL-QUEUE-WRITE` | `TRANS-QUEUE-ENQUEUE-LEASE` | `no_task_or_provider_effect_and_no_state_reset` | `PR-D-A-01`<br>`PR-A-06` |
| `FAIL-LEASE-ACQUISITION` | `TRANS-QUEUE-ENQUEUE-LEASE` | `marker_write_flush_rename_readback_lock_ownership_evidence_release_intent_and_pre_owner_failures_reach_fresh_total_absence_exact_common_recovery_or_unchanged_manual_recovery_with_deterministic_identity` | `PR-A-04`<br>`PR-D-A-01` |
| `FAIL-LEASE-OWNER-LOSS` | `TRANS-QUEUE-LEASE-RUN`<br>`TRANS-MILESTONE-ACTIVE-RECOVERY` | `reserved task returns ready with effect zero; handoff_prepared task requires exact matched recovery or explicit complete absence; running task requires exact matched recovery; all post-acquire exits attempt physical release and exact queue owner reconciliation or retain every typed recovery obligation` | `PR-A-04`<br>`PR-A-06` |
| `FAIL-STATE-GENERATION` | `TRANS-TASK-ACTIVE-FAILED` | `no_cross_task_projection` | `PR-A-03` |
| `FAIL-DUPLICATE-REQUEST` | `TRANS-QUEUE-ENQUEUE-LEASE` | `same_request_reuses_project_operation_distinct_tasks_may_run_and_same_task_attempt_effect_is_not_reissued` | `PR-D-Q-01`<br>`PR-Q-03` |
| `FAIL-CAPACITY-RACE` | `TRANS-TASK-READY-STARTING` | `sixth_task_effect_zero` | `PR-A-02` |
| `FAIL-TASK-RESULT-IDENTITY` | `TRANS-TASK-ACTIVE-FAILED` | `identity schema correlation unstorable recovery unknown recovery kind or flat-to-typed mismatch is not success; no synthetic recovery identity is minted; unresolved recovery and process restart are preserved in the project result` | `PR-A-03` |
| `FAIL-CANCEL-DURING-START` | `TRANS-TASK-ACTIVE-CANCELLED` | `synchronous_or_asynchronous_spawn_failure_emits_no_start_notice_and_closes_fail_closed_or_post_spawn_acknowledgement_exact_ordered_notice_write_receipt_termination_and_cleanup_are_tracked` | `PR-Q-04` |
| `FAIL-CLEANUP-UNKNOWN` | `TRANS-TASK-ACTIVE-RECOVERY` | `slot_and_conflict_not_released` | `PR-A-05` |
| `FAIL-INTEGRATION-CONFLICT` | `TRANS-OBJECTIVE-ACTIVE-BLOCK`<br>`TRANS-MILESTONE-ACTIVE-HUMAN` | `no_acceptance_and_candidate_isolated` | `PR-I-01` |
| `FAIL-ADOPTION-REVISION` | `TRANS-QUEUE-ACTIVE-REPLAN`<br>`TRANS-QUEUE-ACTIVE-HUMAN` | `canonical_effect_zero` | `PR-A-06` |
| `FAIL-TRANSPORT-DISCONNECT` | `TRANS-TASK-ACTIVE-CANCELLED` | `cancel_request_separate_from_durable_completion` | `PR-Q-04` |
| `FAIL-PLATFORM-UNAVAILABLE` | `TRANS-MILESTONE-PLAN-EXECUTE` | `no_fallback_and_effect_zero` | `PR-A-07` |
| `FAIL-DECISION-STALE` | `TRANS-DECISION-PENDING-ACCEPTED` | `invalid_submit_causes_no_decision_transition_project_change_task_effect_or_authority_generation` | `PR-Q-06`<br>`PR-H-02` |
| `FAIL-DECISION-ATOMIC-APPLICATION` | `TRANS-CONTINUATION-ISSUED-PREPARED`<br>`TRANS-DECISION-PENDING-ACCEPTED`<br>`TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE`<br>`TRANS-CONTINUATION-PREPARED-FINALIZED`<br>`TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY`<br>`TRANS-DECISION-RECOVERY-ABSENT-REQUIRED`<br>`TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `protected issued_to_prepared CAS and readback precede project_write_flush_readback; matching application_id_and_generations precede prepared_to_finalized CAS and readback; project_only_unknown may update protected recovery after independent intent while protected_unknown records only independent recovery intent; decision_and_milestone all_old_or_all_new; queue fresh_observes_finalized and task_effect_at_most_once` | `PR-Q-06`<br>`PR-H-02` |
| `FAIL-DECISION-CONTINUATION` | `TRANS-CONTINUATION-ABSENT-ISSUED`<br>`TRANS-CONTINUATION-ISSUED-PREPARED`<br>`TRANS-CONTINUATION-PREPARED-FINALIZED`<br>`TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY`<br>`TRANS-CONTINUATION-ISSUED-INVALIDATED`<br>`TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED`<br>`TRANS-CONTINUATION-RECOVERY-FINALIZED`<br>`TRANS-CONTINUATION-RECOVERY-INVALIDATED`<br>`TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED`<br>`TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED`<br>`TRANS-CONTINUATION-ISSUED-EXPIRED`<br>`TRANS-DECISION-RECOVERY-ABSENT-REQUIRED`<br>`TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `protected_create_failure returns no raw capability; duplicate pending decision or replacement request reuses one issued record; response_loss does not auto_replace; invalid_submit_preserves_legitimate_capability; initial create unknown settles exact absent without effect or invalidates fresh issued; expiry unknown settles fresh expired or invalidates fresh issued; fresh prepared enters exact protected recovery; project_only_unknown persists independent intent then protected recovery; protected_unknown never claims unobserved transition and persists exact independent intent; recovery joins fresh roots then settles continuation before intent; unavailable intent store returns manual_recovery effect_unknown process_reuse_forbidden; no duplicate authority effect or raw capability persistence` | `PR-Q-06`<br>`PR-H-02` |

## 12. 実装・検証への接続

実装接続と検証接続は機械可読な設計対応で管理する。この表は現在の対応集合を人間が確認するための投影であり、Pathや試験の存在だけをCapability成立の根拠にしない。

### 実装接続

| ID | Interface | 状態 | 段階 | Path |
|---|---|---|---|---|
| `IMPL-PROJECT-STATE-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER`<br>`IF-INTEGRATION` | `partial` | `responsibility_separation` | `40_Develop/project-runtime/src/core/project-runtime-state.ts`<br>`40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts` |
| `IMPL-PUBLIC-OBJECTIVE-INTAKE-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-QUEUE`<br>`IF-TRANSPORT` | `partial` | `public_objective_intake` | `40_Develop/project-runtime/src/public-contract/objective-request.ts`<br>`40_Develop/project-runtime/src/application/project-runtime-objective-intake.ts`<br>`40_Develop/project-runtime/src/application/project-runtime-objective-application.ts`<br>`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/project-runtime/tests/unit/objective-intake.contract.test.ts`<br>`40_Develop/coordinator/bin/coordinator.ts`<br>`40_Develop/coordinator/src/security/project-runtime-objective-intake.ts`<br>`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`<br>`40_Develop/coordinator/src/security/coordinator-task-runtime.ts`<br>`40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts`<br>`40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts` |
| `IMPL-MCP-ADAPTER-CANDIDATE` | `IF-TRANSPORT`<br>`IF-PROJECT-CORE`<br>`IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/project-runtime/src/public-contract/objective-request.ts`<br>`40_Develop/project-runtime/src/public-contract/decision-request.ts`<br>`40_Develop/project-runtime/src/public-contract/integration-result.ts`<br>`40_Develop/project-runtime/src/public-contract/runtime-result.ts`<br>`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/mcp/src/index.ts`<br>`40_Develop/mcp/src/adapters/project-runtime-adapter.ts`<br>`40_Develop/mcp/src/transports/stdio-transport.ts`<br>`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts`<br>`40_Develop/mcp/tests/system/stdio-transport.integration.test.ts` |
| `IMPL-RESPONSIBILITY-SEPARATION-CANDIDATE` | `IF-SINGLE-TASK`<br>`IF-PLATFORM`<br>`IF-INTEGRATION`<br>`IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/project-runtime/src/ports/candidate-port.ts`<br>`40_Develop/project-runtime/src/ports/decision-port.ts`<br>`40_Develop/project-runtime/src/ports/execution-port.ts`<br>`40_Develop/project-runtime/src/ports/execution-observation-port.ts`<br>`40_Develop/project-runtime/src/ports/platform-contract.ts`<br>`40_Develop/project-runtime/tests/unit/execution-observation-port.contract.test.ts`<br>`40_Develop/project-runtime/tests/unit/platform-contract.contract.test.ts`<br>`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts`<br>`40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts`<br>`40_Develop/coordinator/src/security/project-runtime-windows-platform-adapter.ts`<br>`40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts`<br>`40_Develop/coordinator/src/security/execution-intelligence-adapter.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts` |
| `IMPL-DURABLE-FOUNDATION-CANDIDATE` | `IF-STATE-STORE`<br>`IF-QUEUE` | `partial` | `durable_foundation` | `40_Develop/project-runtime/src/core/project-runtime-queue.ts`<br>`40_Develop/project-runtime/src/ports/lease-port.ts`<br>`40_Develop/project-runtime/src/ports/port-result.ts`<br>`40_Develop/project-runtime/src/ports/state-port.ts`<br>`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `IMPL-PROJECT-EXECUTION-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER`<br>`IF-INTEGRATION`<br>`IF-TRANSPORT` | `partial` | `responsibility_separation` | `40_Develop/project-runtime/src/application/project-runtime-execution.ts`<br>`40_Develop/project-runtime/src/ports/clock-identity-port.ts`<br>`40_Develop/project-runtime/src/ports/process-safety-port.ts`<br>`40_Develop/project-runtime/src/ports/execution-authorization-port.ts`<br>`40_Develop/coordinator/src/core/runtime-process-safety-state.ts`<br>`40_Develop/coordinator/src/security/project-runtime-execution-host-adapter.ts`<br>`40_Develop/coordinator/src/security/project-runtime-execution-authorization-adapter.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-execution-host-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-execution-authorization-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts` |
| `IMPL-REPLANNING-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER` | `partial` | `responsibility_separation` | `40_Develop/project-runtime/src/application/project-runtime-replanning.ts`<br>`40_Develop/project-runtime/src/ports/state-port.ts`<br>`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts` |
| `IMPL-HUMAN-DECISION-CANDIDATE` | `IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/project-runtime/src/application/project-runtime-human-decision.ts`<br>`40_Develop/project-runtime/src/public-contract/decision-request.ts`<br>`40_Develop/project-runtime/src/ports/decision-capability-port.ts`<br>`40_Develop/project-runtime/src/ports/decision-port.ts`<br>`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/coordinator/src/security/project-runtime-decision-capability-adapter.ts`<br>`40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts`<br>`40_Develop/coordinator/src/security/project-runtime-decision-recovery-store.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-decision-capability-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts` |
| `IMPL-INTEGRATION-CANDIDATE` | `IF-INTEGRATION`<br>`IF-PROJECT-CORE` | `partial` | `responsibility_separation` | `40_Develop/project-runtime/src/application/project-runtime-integration.ts`<br>`40_Develop/project-runtime/src/ports/integration-record-port.ts`<br>`40_Develop/project-runtime/src/public-contract/integration-result.ts`<br>`40_Develop/project-runtime/tests/unit/integration-application.contract.test.ts`<br>`40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/coordinator/src/security/project-runtime-integration-record-adapter.ts`<br>`40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts`<br>`40_Develop/coordinator/src/composition/project-runtime-composition-root.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |

### 検証接続

| ID | 種別 | 状態 | 試験Path |
|---|---|---|---|
| `PR-D-N-01` | `normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-D-Q-01` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-D-A-01` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-N-01` | `normal` | `partial` | `40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts`<br>`40_Develop/mcp/tests/system/stdio-transport.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-N-02` | `normal` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-N-03` | `normal` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-Q-01` | `quasi_normal` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-Q-02` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |
| `PR-Q-03` | `quasi_normal` | `partial` | `40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-Q-04` | `quasi_normal` | `partial` | `40_Develop/mcp/tests/system/stdio-transport.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts` |
| `PR-Q-05` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts` |
| `PR-Q-06` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts` |
| `PR-H-01` | `human_decision` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts` |
| `PR-H-02` | `human_decision` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |
| `PR-A-01` | `abnormal` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts` |
| `PR-A-02` | `abnormal` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts` |
| `PR-A-03` | `abnormal` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts` |
| `PR-A-04` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts` |
| `PR-A-05` | `abnormal` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts` |
| `PR-A-06` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts` |
| `PR-A-07` | `abnormal` | `partial` | `40_Develop/project-runtime/tests/unit/platform-contract.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts` |
| `PR-I-01` | `integration` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |
| `PR-I-02` | `integration` | `partial` | `40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts`<br>`40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts` |

## 13. 完了条件

- 上位アーキテクチャ、本書、機械対応、実装および試験のIDが相互に解決できる。
- Interface、Record、資源、Lock、Authority、Effect、状態遷移、不変条件および失敗注入点に孤立がない。
- 実装済み、部分接続、未実装を区別し、部分成立を上位Capability完成へ読み替えない。
- 正常・準正常・異常および実境界の検証が、対象CapabilityのLifecycleを閉じる。
- 現行設計の変更時は本書を更新し、旧版の別文書を現行Treeへ追加しない。
