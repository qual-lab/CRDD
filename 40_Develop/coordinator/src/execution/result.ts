/**
 * 実行結果の型・理由と構造検査を所有する。
 *
 * @responsibility 生出力を公開せず、固定理由と相関した結果だけを上位へ搬送する。
 * @trace ARCH-000008
 */

import { dockerProcessControllerPublicCompletionReasons } from "../../../domain-model/src/index.ts";
import type { CompletionResult } from "../../../executor/src/index.ts";

import type {
  TaskCompletionRecord,
  RuntimeLifecycleState,
} from "./controller.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import type { CoordinatorTaskRecoveryObligation } from "./recovery.ts";
import {
  resolveRecoveryReference,
  resolveRecoveryStartReason,
} from "../../../executor/src/index.ts";

/** 候補拒否の非秘密診断。判定条件・実行許可・保存状態を所有しない。
 * @responsibility 候補取得と申告Path照合の不成立を分離する。
 * @trace ERB-IT-021
 */
export type CandidateValidationFailureDiagnostic = Readonly<{
  captureStatus: "unavailable" | "capability_unavailable" | "captured";
  pathsMatch: boolean | null;
  candidatePathCount: number | null;
  reportedPathCount: number | null;
  providerExecutionObservation: CompletionResult["providerExecutionObservation"];
}>;

/** 各試行の編集照合又はレビュー分類だけを表す受動診断。
 * @responsibility 本文・Pathを複製せず、初回と限定是正の観測を分離する。
 * @trace ERB-IT-021
 */
export type TaskStageDiagnostic =
  | Readonly<{
      taskRole: "executor";
      result: CandidateValidationFailureDiagnostic;
    }>
  | Readonly<{
      taskRole: "reviewer";
      decision: "approved" | "changes_requested";
      findingCount: number;
      categoryCounts: readonly number[];
    }>;

/** 段階診断の閉じたfieldと件数相関を検査する。採否・Authorityは変更しない。
 * @responsibility 自由文、余分field、欠測を成功観測へ変換しない。
 * @trace ERB-IT-021
 */
export function createTaskStageDiagnostic(
  raw:
    | Readonly<{
        taskRole: "executor";
        result: Parameters<
          typeof createCandidateValidationFailureDiagnostic
        >[0];
      }>
    | Readonly<{
        taskRole: "reviewer";
        decision: unknown;
        findingCount: unknown;
        categoryCounts: unknown;
      }>,
): TaskStageDiagnostic | null {
  const executor = snapshotPlainRecord(raw, new Set(["taskRole", "result"]));
  if (executor?.taskRole === "executor" && raw.taskRole === "executor") {
    const result = createCandidateValidationFailureDiagnostic(raw.result);
    return result ? Object.freeze({ taskRole: "executor", result }) : null;
  }
  const reviewer = snapshotPlainRecord(
    raw,
    new Set(["taskRole", "decision", "findingCount", "categoryCounts"]),
  );
  if (
    reviewer?.taskRole !== "reviewer" ||
    !["approved", "changes_requested"].includes(reviewer.decision as string) ||
    !Number.isSafeInteger(reviewer.findingCount) ||
    (reviewer.findingCount as number) < 0 ||
    (reviewer.findingCount as number) > 64
  )
    return null;
  const counts = snapshotPlainArray<unknown>(reviewer.categoryCounts, 4);
  if (
    counts.status !== "ok" ||
    counts.value.length !== 4 ||
    !counts.value.every(
      (n) =>
        Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 64,
    )
  )
    return null;
  const categoryCounts = counts.value as number[];
  if (
    categoryCounts.reduce((a, b) => a + b, 0) !== reviewer.findingCount ||
    (reviewer.decision === "approved") !== (reviewer.findingCount === 0)
  )
    return null;
  return Object.freeze({
    taskRole: "reviewer",
    decision: reviewer.decision as "approved" | "changes_requested",
    findingCount: reviewer.findingCount as number,
    categoryCounts: Object.freeze([...categoryCounts]),
  });
}

/** 固定分類と件数だけを受理し、本文・Path・余分fieldを診断へ搬送しない。
 * @responsibility 候補拒否診断の相関した値境界を検査する。
 * @trace ERB-IT-021
 */
export function createCandidateValidationFailureDiagnostic(
  raw: Readonly<{
    captureStatus: unknown;
    pathsMatch: unknown;
    candidatePathCount: unknown;
    reportedPathCount: unknown;
    providerExecutionObservation: CompletionResult["providerExecutionObservation"];
  }>,
): CandidateValidationFailureDiagnostic | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "captureStatus",
      "pathsMatch",
      "candidatePathCount",
      "reportedPathCount",
      "providerExecutionObservation",
    ]),
  );
  const count = (v: unknown) =>
    v === null ||
    (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 1000);
  if (
    !value ||
    !["unavailable", "capability_unavailable", "captured"].includes(
      value.captureStatus as string,
    ) ||
    (value.pathsMatch !== null && typeof value.pathsMatch !== "boolean") ||
    !count(value.candidatePathCount) ||
    !count(value.reportedPathCount)
  )
    return null;
  const captured = value.captureStatus === "captured";
  const comparable =
    captured &&
    value.candidatePathCount !== null &&
    value.reportedPathCount !== null;
  if (
    (!captured && value.candidatePathCount !== null) ||
    comparable !== (value.pathsMatch !== null) ||
    (value.pathsMatch === true &&
      value.candidatePathCount !== value.reportedPathCount)
  )
    return null;
  const observation = raw.providerExecutionObservation;
  return Object.freeze({
    captureStatus:
      value.captureStatus as CandidateValidationFailureDiagnostic["captureStatus"],
    pathsMatch: value.pathsMatch as boolean | null,
    candidatePathCount: value.candidatePathCount as number | null,
    reportedPathCount: value.reportedPathCount as number | null,
    providerExecutionObservation: observation,
  });
}

/**
 * Coordinator Task Terminal Lifecycle 状態を分類する。
 *
 * @responsibility Coordinator Task Terminal Lifecycle 状態の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000004
 * @input result: TaskCompletionRecord
 * @returns RuntimeLifecycleStateを返す。
 * @precondition 「result: TaskCompletionRecord」がclassifyCoordinatorTaskTerminalLifecycleStateの入力契約を満たす。
 * @postcondition classifyCoordinatorTaskTerminalLifecycleStateの責務を完了した結果だけを返す。
 * @effect N/A: classifyCoordinatorTaskTerminalLifecycleStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCoordinatorTaskTerminalLifecycleStateは独自の失敗分岐を所有しない。
 * @invariant classifyCoordinatorTaskTerminalLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyCoordinatorTaskTerminalLifecycleStateはProcess内の同一Subsystemで完結する。
 * @security classifyCoordinatorTaskTerminalLifecycleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCoordinatorTaskTerminalLifecycleStateは共有非同期状態を持たない同期処理である。
 */
export function classifyCoordinatorTaskTerminalLifecycleState(
  result: TaskCompletionRecord,
): RuntimeLifecycleState {
  const exactRecoveryAvailable =
    result.hostRecoveryId !== null ||
    result.dockerRecoveryIds.length > 0 ||
    result.candidateRecoveryId !== null ||
    result.candidateStoreRecoveryId !== null;
  if (
    result.manualRecoveryRequired === true ||
    result.cleanupConfirmed !== true ||
    exactRecoveryAvailable
  )
    return exactRecoveryAvailable
      ? ("STATE-RECOVERY-REQUIRED" as const)
      : ("STATE-OPERATOR-TRANSFER-REQUIRED" as const);
  if (result.processRestartRequired === true)
    return "STATE-PROCESS-RESTART-REQUIRED" as const;
  if (result.status === "completed") return "STATE-RESULT-PUBLISHED" as const;
  return "STATE-BLOCKED-CLEAN" as const;
}

/**
 * Testable projection used only after the outer development cleanup settles.
 *
 * @responsibility Development Task 結果 After Outer 清掃の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input taskResult: Readonly<Record<string, unknown>>、cleanupConfirmed: boolean
 * @returns projectDevelopmentTaskResultAfterOuterCleanupの計算結果を返す。
 * @precondition 「taskResult: Readonly<Record<string, unknown>>、cleanupConfirmed: boolean」がprojectDevelopmentTaskResultAfterOuterCleanupの入力契約を満たす。
 * @postcondition projectDevelopmentTaskResultAfterOuterCleanupの責務を完了した結果だけを返す。
 * @effect N/A: projectDevelopmentTaskResultAfterOuterCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectDevelopmentTaskResultAfterOuterCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectDevelopmentTaskResultAfterOuterCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDevelopmentTaskResultAfterOuterCleanupはProcess内の同一Subsystemで完結する。
 * @security projectDevelopmentTaskResultAfterOuterCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDevelopmentTaskResultAfterOuterCleanupは共有非同期状態を持たない同期処理である。
 */
export function projectDevelopmentTaskResultAfterOuterCleanup(
  taskResult: Readonly<Record<string, unknown>>,
  cleanupConfirmed: boolean,
) {
  if (cleanupConfirmed) return taskResult;
  const snapshot: Record<string, unknown> = Object.create(null);
  const descriptors = Object.getOwnPropertyDescriptors(taskResult);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string")
      throw new Error("development_task_result_projection_invalid");
    if (key === "providerTurnObservations") continue;
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      throw new Error("development_task_result_projection_invalid");
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

const recoveryObservationKeys = new Set([
  "status",
  "reason",
  "manualRecoveryRequired",
  "dockerRecoveryId",
  "dockerRecoveryIds",
  "activeStableLogicalHomeBindingHashes",
] as const);

/**
 * 現在状態の入場観測だけをTaskの固定判定へ変換する。
 * @responsibility 可否と排他解放の相関を確認し、旧在庫形式を受理しない。
 * @trace ARCH-000008
 * @input rawObservation: 現在入場Inspectorの結果。
 * @returns completedまたは非秘密の固定blocked理由。
 * @precondition 入場投影は後続beginの衝突判定を省略しない。
 * @postcondition availableでも解放未確認なら拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure Proxy・Accessor・未知key・不正相関は拒否する。
 * @invariant 内部ID・任意理由・旧在庫を公開へ搬送しない。
 * @boundary 現在入場DTOとTaskの失敗診断。
 * @security 固定理由以外を結果へ含めない。
 * @concurrency N/A: 同期の値変換だけ。
 */
export function projectCurrentDockerAdmission(rawObservation: unknown) {
  const value = snapshotPlainRecord(
    rawObservation,
    new Set(["status", "reason", "lockReleased"]),
  );
  if (
    value?.status === "available" &&
    value.reason === "coordinator_current_admission_available" &&
    value.lockReleased === true
  )
    return Object.freeze({ status: "completed" as const });
  return Object.freeze({
    status: "blocked" as const,
    reason:
      value?.status === "blocked" &&
      value.reason === "coordinator_current_admission_unconfirmed" &&
      value.lockReleased === false
        ? "docker_process_controller_recovery_observation_unknown"
        : "docker_process_controller_recovery_unavailable",
  });
}

const INVENTORY_REASONS = new Set([
  "docker_task_recovery_inventory_available",
  "docker_task_multiple_recovery_inventory_available",
]);

const BLOCKED_REASONS_WITH_INVENTORY = new Set([
  "docker_task_recovery_home_lock_release_unconfirmed",
  "docker_task_recovery_host_lock_release_unconfirmed",
  "docker_task_runtime_state_lock_release_unconfirmed",
]);

/**
 * Docker 回復 Admissionを公開結果へ投影する。
 *
 * @responsibility Docker 回復 Admissionの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input rawObservation: unknown
 * @returns projectDockerRecoveryAdmissionの計算結果を返す。
 * @precondition 「rawObservation: unknown」がprojectDockerRecoveryAdmissionの入力契約を満たす。
 * @postcondition projectDockerRecoveryAdmissionの責務を完了した結果だけを返す。
 * @effect N/A: projectDockerRecoveryAdmissionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDockerRecoveryAdmissionは独自の失敗分岐を所有しない。
 * @invariant projectDockerRecoveryAdmissionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDockerRecoveryAdmissionはProcess内の同一Subsystemで完結する。
 * @security projectDockerRecoveryAdmissionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectDockerRecoveryAdmissionは共有非同期状態を持たない同期処理である。
 */
export function projectDockerRecoveryAdmission(rawObservation: unknown) {
  const observation = snapshotPlainRecord(
    rawObservation,
    recoveryObservationKeys,
  );
  if (!observation)
    return Object.freeze({
      status: "blocked" as const,
      reason: resolveRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const idsSnapshot = snapshotPlainArray(observation.dockerRecoveryIds, 256);
  const parsedIds =
    idsSnapshot.status === "ok"
      ? idsSnapshot.value.map(parseDockerTaskRecoveryId)
      : [];
  const ids =
    idsSnapshot.status === "ok" && parsedIds.every((value) => value !== null)
      ? parsedIds.map((value) => value?.token as string)
      : null;
  const singleId =
    observation.dockerRecoveryId === null ||
    resolveRecoveryReference(observation.dockerRecoveryId) !== null
      ? resolveRecoveryReference(observation.dockerRecoveryId)
      : undefined;
  const hashes = snapshotPlainArray(
    observation.activeStableLogicalHomeBindingHashes,
    256,
  );
  const hashValues =
    hashes.status === "ok" && hashes.value.every(isSha256Hex)
      ? (hashes.value as readonly string[])
      : null;
  const isIdsUnique = ids !== null && new Set(ids).size === ids.length;
  const isHashesUnique =
    hashValues !== null && new Set(hashValues).size === hashValues.length;
  const stableHashes = new Set(
    parsedIds.flatMap((value) =>
      value ? [value.stableLogicalHomeBindingHash] : [],
    ),
  );
  const isShapeValid =
    ids !== null &&
    hashValues !== null &&
    isIdsUnique &&
    isHashesUnique &&
    hashValues.every((value) => stableHashes.has(value)) &&
    (observation.status === "completed" || observation.status === "blocked") &&
    typeof observation.reason === "string" &&
    typeof observation.manualRecoveryRequired === "boolean" &&
    singleId !== undefined &&
    (ids.length === 1 ? singleId === ids[0] : singleId === null);
  if (!isShapeValid)
    return Object.freeze({
      status: "blocked" as const,
      reason: resolveRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const isClean =
    observation.status === "completed" &&
    observation.reason === "docker_task_runtime_state_clean" &&
    observation.manualRecoveryRequired === false &&
    singleId === null &&
    ids.length === 0 &&
    hashValues.length === 0;
  if (isClean)
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  const inventoryReason =
    ids.length === 1
      ? "docker_task_recovery_inventory_available"
      : "docker_task_multiple_recovery_inventory_available";
  const isBlockedShape =
    observation.status === "blocked" &&
    observation.manualRecoveryRequired === true &&
    resolveRecoveryStartReason(observation.reason) !==
      "docker_process_controller_recovery_unavailable" &&
    (ids.length === 0
      ? !INVENTORY_REASONS.has(observation.reason)
      : BLOCKED_REASONS_WITH_INVENTORY.has(observation.reason));
  const isInventoryShape =
    observation.status === "completed" &&
    observation.manualRecoveryRequired === true &&
    ids.length > 0 &&
    observation.reason === inventoryReason;
  if (!isBlockedShape && !isInventoryShape)
    return Object.freeze({
      status: "blocked" as const,
      reason: resolveRecoveryStartReason(null),
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: Object.freeze([] as string[]),
    });
  return Object.freeze({
    status: "blocked" as const,
    reason: resolveRecoveryStartReason(observation.reason),
    manualRecoveryRequired: true,
    dockerRecoveryId: ids.length === 1 ? (ids[0] ?? null) : null,
    dockerRecoveryIds: Object.freeze(ids),
  });
}

/**
 * 回復投影のHash候補が小文字64桁であるか確認する。
 * @responsibility 投影値の文法だけを確認し、回復資格を発行しない。
 * @trace ARCH-000008
 * @input value: 未信頼の投影候補。
 * @returns 小文字64桁hexだけtrue。
 * @precondition 任意の値を受け取り、ObjectのPropertyを読まない。
 * @postcondition trueの場合だけ元の値を文字列として扱える。
 * @effect N/A: 共有状態と外部資源を変更しない。
 * @failure 不正文法・非文字列はfalse。強制変換や例外を使わない。
 * @invariant 大小文字・空白・桁数を補正しない。
 * @boundary N/A: 同一回復投影の値検査だけ。
 * @security 文法一致を実資源の存在・回復資格へ昇格しない。
 * @concurrency N/A: 同期局所処理で共有状態を持たない。
 */
function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

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
  "coordinator_task_workspace_review_completed",
  "coordinator_task_workspace_borrowing_unavailable",
  "coordinator_task_workspace_unexpected_changes",
  ...Object.values(COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS),
  ...dockerProcessControllerPublicCompletionReasons,
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
  "coordinator_task_network_policy_changed",
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

/**
 * execution-portで使用するCoordinator Single Task 結果の値契約を定義する。
 *
 * @responsibility Coordinator Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskAttemptResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskAttemptResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskAttemptResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskAttemptResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskAttemptResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskAttemptResult = Readonly<{
  contract: "crdd-coordinator/task-attempt";
  operationId: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
  workspaceResult?: CoordinatorWorkspaceResult;
}>;

/**
 * Host 回復 Tokenを表示形式へ整形する。
 *
 * @responsibility Host 回復 Tokenの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000008
 * @input rootName: string、nonce: string、recordHash: string
 * @returns formatHostRecoveryTokenの計算結果を返す。
 * @precondition 「rootName: string、nonce: string、recordHash: string」がformatHostRecoveryTokenの入力契約を満たす。
 * @postcondition formatHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: formatHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: formatHostRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant formatHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: formatHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security formatHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: formatHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
export function formatHostRecoveryToken(
  rootName: string,
  nonce: string,
  recordHash: string,
) {
  return `host.${rootName}.${nonce}.${recordHash}`;
}

import type { CoordinatorWorkspaceResult } from "../../../domain-model/src/index.ts";
