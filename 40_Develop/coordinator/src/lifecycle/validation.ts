/**
 * 実行要求と公開状態の値契約を、副作用なしで扱う。
 * @responsibility 入力の捕捉・機密検査と、状態・公開結果の組立て及び整合確認。
 * @trace ARCH-000010
 * @trace ARCH-000014
 * @trace ARCH-000015
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import { inspectAiSelectionChoice } from "../../../configuration-model/src/index.ts";
import type {
  AttemptDiagnosticNotice,
  CompletionResult,
} from "../../../executor/src/index.ts";
import {
  dockerProcessControllerPublicCompletionReasons,
  inspectExecutionPlan,
  OBJECTIVE_STATES,
  type ObjectivePlan,
  parseDockerTaskRecoveryId,
  type ProjectExecutionState,
  type ProjectTaskState,
  TASK_STATES,
  type TaskStartCandidates,
} from "../../../execution-model/src/index.ts";
import type {
  CallerTaskInput,
  CoordinatorObjectiveRequest,
  CoordinatorProjection,
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
  CoordinatorSingleTaskRecoveryObligation,
  Recovery,
  RecoveryStartFailureDiagnostic,
  RecoveryStartFailureNotice,
  SingleTaskCommand,
  SingleTaskOutcome,
  WorkspaceResult,
} from "./types.ts";
import { RECOVERY_START_FAILURE_STAGES } from "./types.ts";

// 開始診断の有限理由だけを受ける。
// 旧保存方式のProducer不在理由を分類契約として保持しない。未知値は従来どおりunavailable。
const RECOVERY_START_REASON_CLASS = new Map<string, string>([
  [
    "docker_task_multiple_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  ...[
    "docker_task_recovery_home_lock_release_unconfirmed",
    "docker_task_recovery_host_lock_release_unconfirmed",
    "docker_task_runtime_state_lock_release_unconfirmed",
    "docker_task_recovery_begin_failed_closed",
    "docker_task_recovery_failed_closed",
  ].map(
    (reason) =>
      [
        reason,
        "docker_process_controller_recovery_observation_unknown",
      ] as const,
  ),
]);

/**
 * own Data Valueを決定する。
 *
 * @responsibility own Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns unknownを返す。
 * @precondition 「value: unknown、key: string」がownDataValueの入力契約を満たす。
 * @postcondition ownDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataValueは共有非同期状態を持たない同期処理である。
 */
export function ownDataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ready 回復を所有Snapshotへ変換する。
 *
 * @responsibility Ready 回復の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns Recovery | nullを返す。
 * @precondition 「value: unknown」がsnapshotReadyRecoveryの入力契約を満たす。
 * @postcondition snapshotReadyRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: snapshotReadyRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotReadyRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotReadyRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotReadyRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotReadyRecoveryは共有非同期状態を持たない同期処理である。
 */
export function snapshotReadyRecovery(value: unknown): Recovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["recoveryCapability", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const recoveryId = ownDataValue(value, "recoveryId");
  const recoveryCapability = ownDataValue(value, "recoveryCapability");
  return status === "ready" &&
    typeof recoveryId === "string" &&
    recoveryCapability !== null &&
    typeof recoveryCapability === "object"
    ? Object.freeze({ status, recoveryId, recoveryCapability })
    : null;
}

/**
 * Blocked 回復 With Exact Idを所有Snapshotへ変換する。
 *
 * @responsibility Blocked 回復 With Exact Idの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedStableLogicalHomeBindingHash: string
 * @returns snapshotBlockedRecoveryWithExactIdの計算結果を返す。
 * @precondition 「value: unknown、expectedStableLogicalHomeBindingHash: string」がsnapshotBlockedRecoveryWithExactIdの入力契約を満たす。
 * @postcondition snapshotBlockedRecoveryWithExactIdの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBlockedRecoveryWithExactIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBlockedRecoveryWithExactIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBlockedRecoveryWithExactIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotBlockedRecoveryWithExactIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotBlockedRecoveryWithExactIdは共有非同期状態を持たない同期処理である。
 */
export function snapshotBlockedRecoveryWithExactId(
  value: unknown,
  expectedStableLogicalHomeBindingHash: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (types.isProxy(value)) return null;
  let hasOwner = false;
  try {
    const keys = Object.keys(value).sort().join("\0");
    hasOwner =
      keys ===
      [
        "reason",
        "recoveryId",
        "status",
        "recoveryCapability",
        "manualRecoveryRequired",
      ]
        .sort()
        .join("\0");
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      (keys !== ["reason", "recoveryId", "status"].sort().join("\0") &&
        !hasOwner)
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const reason = ownDataValue(value, "reason");
  const recoveryId = resolveRecoveryReference(
    ownDataValue(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  const capability = ownDataValue(value, "recoveryCapability");
  if (
    hasOwner &&
    (!capability ||
      typeof capability !== "object" ||
      types.isProxy(capability) ||
      ownDataValue(value, "manualRecoveryRequired") !== true)
  )
    return null;
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({
        status,
        reason,
        recoveryId,
        recoveryCapability: capability ?? null,
      })
    : null;
}

/**
 * 技術結果の固定field集合を動的Propertyなしに捕捉する。
 * @responsibility 既存診断shapeの受理順序を変えず値を局所化する。
 * @trace ARCH-000008
 * @input 未検査値とこのModule内の固定Key集合。
 * @returns 凍結した浅い値又はnull。
 * @precondition 永続化・保存Schemaの判断は行わない。
 * @postcondition getter・Proxy・継承値を評価しない。
 * @effect N/A: 同期の検査のみ。
 * @failure 不正shape・取得不能はnull。
 * @invariant 観測不能を成功へ補完しない。
 * @boundary 結果・診断の内部捕捉。
 * @security 任意のfieldを公開結果へ混入させない。
 * @concurrency N/A: 共有状態なし。
 */
function snapshotRecoveryRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/** 診断の未知値・余分な内容を拒否し、Authorityを伴わない値へ閉じる。 */
export function inspectRecoveryStartFailureDiagnostic(
  raw: unknown,
): RecoveryStartFailureDiagnostic | null {
  const value = snapshotRecoveryRecord(raw, new Set(["stage", "recoveryId"]));
  if (
    !value ||
    !RECOVERY_START_FAILURE_STAGES.includes(
      value.stage as RecoveryStartFailureDiagnostic["stage"],
    ) ||
    (value.recoveryId !== null && !parseDockerTaskRecoveryId(value.recoveryId))
  )
    return null;
  return Object.freeze({
    stage: value.stage as RecoveryStartFailureDiagnostic["stage"],
    recoveryId: value.recoveryId as string | null,
  });
}

/**
 * public Docker 回復 Start Reasonを決定する。
 *
 * @responsibility public Docker 回復 Start Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: unknown
 * @returns resolveRecoveryStartReasonの計算結果を返す。
 * @precondition 「reason: unknown」がresolveRecoveryStartReasonの入力契約を満たす。
 * @postcondition resolveRecoveryStartReasonの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryStartReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryStartReasonは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryStartReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryStartReasonはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryStartReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryStartReasonは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryStartReason(reason: unknown) {
  if (typeof reason === "string") {
    const classified = RECOVERY_START_REASON_CLASS.get(reason);
    if (classified) return classified;
  }
  return "docker_process_controller_recovery_unavailable";
}

/**
 * public Verified Docker 回復 Idを決定する。
 *
 * @responsibility public Verified Docker 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns resolveRecoveryReferenceの計算結果を返す。
 * @precondition 「value: unknown」がresolveRecoveryReferenceの入力契約を満たす。
 * @postcondition resolveRecoveryReferenceの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryReferenceは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryReferenceはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryReferenceは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryReference(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}

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

export const COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS = Object.freeze({
  prepareFailed: "coordinator_task_provider_prepare_failed",
  modelSelectionInvalid: "coordinator_task_provider_model_selection_invalid",
  taskPacketInvalid: "coordinator_task_provider_task_packet_invalid",
  planInvalid: "coordinator_task_provider_plan_invalid",
  recoveryCorrelationInvalid:
    "coordinator_task_provider_recovery_correlation_invalid",
} as const);

export const coordinatorTaskPublicReasons = Object.freeze([
  "docker_environment_start_input_invalid",
  "docker_environment_start_boundary_unconfirmed",
  "docker_environment_start_observation_unknown",
  "docker_environment_start_unavailable",
  "docker_environment_start_request_unconfirmed",
  "docker_environment_start_timeout",
  "docker_environment_start_cancelled",
  "docker_environment_start_cleanup_unconfirmed",
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
  "coordinator_task_reviewer_coverage_incomplete",
  "coordinator_task_candidate_revision_invalid",
  "coordinator_task_candidate_store_unavailable",
  "coordinator_task_candidate_verification_failed",
  "coordinator_task_control_invalid",
  "coordinator_task_completed",
  "coordinator_task_docker_finalization_capability_missing",
  "coordinator_task_docker_recovery_finalization_unconfirmed",
  "coordinator_task_docker_recovery_handoff_state_invalid",
  "coordinator_task_docker_recovery_projection_invalid",
  "coordinator_task_execution_slate_unavailable",
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
 * 実行結果を公開前に閉じた値へ固定する。
 * @responsibility getterやProvider由来の余剰値を結果投影へ流さない。
 * @trace ARCH-000004
 * @input 下位から受領した結果。
 * @returns 独立した許可fieldだけ、又はnull。
 * @precondition 実行の終了・回収は下位Ownerが報告する。
 * @postcondition 入力の後続変更から表示値を分離する。
 * @effect なし。
 * @failure 不正な本文区分・配列・Workspace結果は拒否する。
 * @invariant 空回答を正常な助言として捏造しない。
 * @boundary 実行Adapterと単発Owner。
 * @security 本文を永続化しない。
 * @concurrency 同期Snapshotだけ。
 */
export function snapshotSingleTaskOutcome(
  raw: unknown,
): SingleTaskOutcome | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "mode",
      "status",
      "reason",
      "cleanupConfirmed",
      "recoveryIds",
      "advice",
      "workspaceResult",
    ]),
  );
  if (!value) return null;
  if (
    (value.mode !== "read_only_advice" && value.mode !== "workspace_edit") ||
    (value.status !== "completed" &&
      value.status !== "blocked" &&
      value.status !== "cancelled" &&
      value.status !== "unknown") ||
    typeof value.cleanupConfirmed !== "boolean" ||
    !(
      value.reason === null ||
      (typeof value.reason === "string" &&
        /^[a-z][a-z0-9_]{0,255}$/u.test(value.reason))
    )
  )
    return null;
  const recoveries = snapshotPlainArray<string>(
    value.recoveryIds,
    Number.MAX_SAFE_INTEGER,
  );
  if (
    recoveries.status !== "ok" ||
    recoveries.value.some(
      (id) =>
        typeof id !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u.test(id),
    ) ||
    new Set(recoveries.value).size !== recoveries.value.length ||
    ((value.status === "completed" || value.status === "cancelled") &&
      (!value.cleanupConfirmed || recoveries.value.length > 0))
  )
    return null;
  const workspaceResult =
    value.workspaceResult === null
      ? null
      : inspectWorkspaceResult(value.workspaceResult);
  if (value.workspaceResult !== null && workspaceResult === null) return null;
  let advice: SingleTaskOutcome["advice"] = null;
  if (value.advice !== null) {
    const groups = snapshotPlainRecord(
      value.advice,
      new Set([
        "facts",
        "sharedAnalysis",
        "additionalInferences",
        "nextOptions",
      ]),
    );
    if (!groups) return null;
    const result: Record<
      string,
      readonly Readonly<{ text: string; references: readonly string[] }>[]
    > = {};
    for (const key of [
      "facts",
      "sharedAnalysis",
      "additionalInferences",
      "nextOptions",
    ]) {
      const items = snapshotPlainArray(
        groups[key as keyof typeof groups],
        Number.MAX_SAFE_INTEGER,
      );
      if (items.status !== "ok") return null;
      const rows = [];
      for (const item of items.value) {
        const row = snapshotPlainRecord(item, new Set(["text", "references"]));
        if (!row || typeof row.text !== "string" || row.text.length === 0)
          return null;
        const refs = snapshotPlainArray<string>(
          row.references,
          Number.MAX_SAFE_INTEGER,
        );
        if (
          refs.status !== "ok" ||
          refs.value.length === 0 ||
          refs.value.some(
            (ref) =>
              typeof ref !== "string" ||
              ref.length === 0 ||
              /[\r\n\0]/u.test(ref),
          )
        )
          return null;
        rows.push(Object.freeze({ text: row.text, references: refs.value }));
      }
      result[key] = Object.freeze(rows);
    }
    advice = Object.freeze(result) as NonNullable<SingleTaskOutcome["advice"]>;
  }
  return Object.freeze({
    mode: value.mode,
    status: value.status,
    reason: value.reason,
    cleanupConfirmed: value.cleanupConfirmed,
    recoveryIds: Object.freeze([...recoveries.value]),
    advice,
    workspaceResult,
  });
}

/**
 * Provider境界の設定と終了後の診断を表す。
 *
 * @responsibility 設定、一次失敗と清掃観測を区別して搬送する。
 * @trace ARCH-000008
 * @shape configuredとsettledの固定Event集合。
 * @invariant 設定や診断をEffect成立の根拠へ変換しない。
 * @boundary Runtimeから受動診断の利用側への搬送。
 * @security 秘密値、Pathや生出力を含めない。
 * @compatibility 診断失敗で処理結果を変更しない。
 */
export type ProviderBoundaryDiagnosticNotice =
  | Readonly<{
      event: "coordinator_task_stage_observed";
      taskRole: "executor" | "reviewer";
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
      diagnostic: TaskStageDiagnostic;
    }>
  | Readonly<{
      event: "coordinator_task_candidate_validation_failed";
      taskRole: "executor";
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
      diagnostic: CandidateValidationFailureDiagnostic;
    }>
  | ((AttemptDiagnosticNotice | RecoveryStartFailureNotice) &
      Readonly<{
        taskAttempt: 0 | 1 | null;
        recoveryCorrelationId: string | null;
      }>);

/** 候補拒否の非秘密診断。判定条件・実行許可・保存状態を所有しない。
 * @responsibility 候補取得と申告Path照合の不成立を分離する。
 * @trace ERB-IT-021
 */
export type CandidateValidationFailureDiagnostic = Readonly<{
  captureStatus: "unavailable" | "capability_unavailable" | "captured";
  pathsMatch: boolean | null;
  candidatePathCount: number | null;
  reportedPathCount: number | null;
  providerExecutionObservation: CompletionResult<"attempt">["providerExecutionObservation"];
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
    (reviewer.findingCount as number) < 0
  )
    return null;
  const counts = snapshotPlainArray<unknown>(reviewer.categoryCounts, 4);
  if (
    counts.status !== "ok" ||
    counts.value.length !== 4 ||
    !counts.value.every((n) => Number.isSafeInteger(n) && (n as number) >= 0)
  )
    return null;
  const categoryCounts = counts.value as number[];
  const total = categoryCounts.reduce((a, b) => a + b, 0);
  if (
    !Number.isSafeInteger(total) ||
    total !== reviewer.findingCount ||
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
    providerExecutionObservation: CompletionResult<"attempt">["providerExecutionObservation"];
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
    v === null || (Number.isSafeInteger(v) && (v as number) >= 0);
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
 * 公開Objectiveを既存のSingle Task入力へ変換する。
 *
 * @responsibility Coordinator Coordinator Task Requestの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: 受付済みObjectiveの実行内容と対象Path。
 * @returns 選定を含まないTask本文。
 * @precondition 呼出し元がObjectiveの実行内容と対象Pathを確定済みである。
 * @postcondition 保存済みの選定組は本文へ埋め込まず、Task実行を組み立てる側が別に搬送する。
 * @effect N/A: buildObjectiveTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildObjectiveTaskRequestは独自の失敗分岐を所有しない。
 * @invariant buildObjectiveTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: buildObjectiveTaskRequestはProcess内の同一Subsystemで完結する。
 * @security Task本文を実行許可や送信同意として扱わない。
 * @concurrency N/A: buildObjectiveTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function buildObjectiveTaskRequest(
  request: Pick<
    CoordinatorObjectiveRequest,
    "objective" | "acceptanceCriteria" | "allowedPaths" | "readPaths"
  >,
) {
  return Object.freeze({
    objective: request.objective,
    acceptanceCriteria: Object.freeze([...request.acceptanceCriteria]),
    allowedPaths: Object.freeze([...request.allowedPaths]),
    readPaths: Object.freeze([...request.readPaths]),
    workClass: "bounded_implementation" as const,
    planState: "complete" as const,
    risk: "low" as const,
    difficulty: "low" as const,
    decisionImpact: "limited" as const,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

/**
 * Task別の入力と保存済み選定を元の順序で実行要求へ結合する。
 * @responsibility 廃止Taskを除き、同じTaskの入力と許可Pathだけを搬送する。
 * @trace ARCH-000004
 * @input request: 捕捉済み要求、state: 保存済みState、repositoryRoot: 元Root。
 * @returns 元RootとTaskごとの相関IDを結合した不変の実行要求配列。
 * @precondition 呼出し元が要求とStateをそれぞれの受付で検査している。
 * @postcondition 保存選定を再選定せず同一参照で使用する。
 * @effect N/A: 純粋な値生成だけ。
 * @failure Task別入力の欠測、実行対象の重複、相関IDの失敗を拒否する。
 * @invariant Task列挙順・先頭一致・元の相関ID・独立した配列を維持する。
 * @boundary Objective要求とTask要求。
 * @security Rootや固定選定を新しい実行許可へ変換しない。
 * @concurrency 同期処理内の局所値だけを使う。
 */
export function buildObjectiveTaskExecutions(
  request: CoordinatorObjectiveRequest,
  state: ProjectExecutionState,
  repositoryRoot: object | string,
) {
  const inputs = new Map<string, CallerTaskInput>();
  for (const input of request.taskInputs)
    if (!inputs.has(input.taskId)) inputs.set(input.taskId, input);
  const seen = new Set<string>();
  return Object.freeze(
    state.tasks
      .filter((task) => task.state !== "superseded")
      .map((task) => {
        const taskId = task.definition.id;
        if (seen.has(taskId))
          throw new Error("coordinator_task_execution_duplicate");
        seen.add(taskId);
        const input = inputs.get(taskId);
        if (!input) throw new Error("coordinator_task_input_missing");
        const authorityBindingId = createCoordinatorStableId("authority", [
          state.projectId,
          state.milestoneId,
          state.repositoryRevision,
          task.definition.objectiveId,
          taskId,
          String(task.retryCount),
        ]);
        if (!validIdentity(authorityBindingId))
          throw new Error("coordinator_task_binding_invalid");
        return Object.freeze({
          taskId,
          authorityBindingId,
          repositoryRoot,
          selections: state.taskExecutionSelections,
          taskRequest: buildObjectiveTaskRequest({
            objective: input.objective,
            readPaths: input.readPaths,
            acceptanceCriteria: input.acceptanceCriteria,
            allowedPaths: task.definition.allowedPaths,
          }),
        });
      }),
  );
}

/**
 * 公開要求をgetter／Proxyなしで固定する。
 * @responsibility 旧Bundle入力と暗黙Context読取りを拒否する。
 * @trace ARCH-000004
 * @input 未信頼要求。
 * @returns 検証済み要求又はnull。
 * @precondition 認可は別途現在値で評価する。
 * @postcondition 配列と本文は独立Snapshot。
 * @effect なし。
 * @failure 不正・不足・過剰は拒否。
 * @invariant 送信確認なしでは実行しない。
 * @boundary Surface入力。
 * @security 本文をlogへ出力しない。
 * @concurrency 同期検査。
 */
export function inspectSingleTaskCommand(
  raw: unknown,
): SingleTaskCommand | null {
  const keys = [
    "requestId",
    "mode",
    "workType",
    "prompt",
    "contextReferences",
    "allowedPaths",
    "workspaceId",
  ];
  const r =
    snapshotPlainRecord(raw, new Set([...keys, "choice"])) ??
    snapshotPlainRecord(raw, new Set(keys));
  const refs = snapshotPlainArray<string>(r?.contextReferences, 1);
  const paths = snapshotPlainArray<string>(
    r?.allowedPaths,
    Number.MAX_SAFE_INTEGER,
  );
  const choice =
    r && Object.hasOwn(r, "choice")
      ? inspectAiSelectionChoice(r.choice)
      : undefined;
  if (
    !r ||
    Object.keys(r).length !== 7 + (Object.hasOwn(r, "choice") ? 1 : 0) ||
    !validIdentity(r.requestId) ||
    typeof r.mode !== "string" ||
    !["read_only_advice", "workspace_edit"].includes(r.mode) ||
    !(
      r.workType === null ||
      (typeof r.workType === "string" &&
        /^[a-z0-9][a-z0-9._-]*$/u.test(r.workType))
    ) ||
    (Object.hasOwn(r, "choice") && !choice) ||
    typeof r.prompt !== "string" ||
    r.prompt.trim().length === 0 ||
    refs.status !== "ok" ||
    refs.value.length !== 1 ||
    refs.value[0] !== "PROJECT_CONTEXT.md" ||
    paths.status !== "ok" ||
    paths.value.some(
      (p) => typeof p !== "string" || normalizeRepositoryRelativePath(p) !== p,
    ) ||
    new Set(paths.value).size !== paths.value.length ||
    (r.mode === "read_only_advice"
      ? paths.value.length !== 0
      : paths.value.length === 0) ||
    !(
      r.workspaceId === null ||
      (typeof r.workspaceId === "string" &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(r.workspaceId))
    ) ||
    (r.mode === "read_only_advice" && r.workspaceId !== null)
  )
    return null;
  return Object.freeze({
    requestId: r.requestId,
    mode: r.mode,
    workType: r.workType,
    prompt: r.prompt,
    contextReferences: refs.value,
    allowedPaths: paths.value,
    workspaceId: r.workspaceId,
    ...(choice
      ? {
          choice: Object.freeze({
            provider: choice.provider,
            model: choice.model,
            effort: choice.effort,
          }),
        }
      : {}),
  }) as SingleTaskCommand;
}

/**
 * Taskに結合したWorkspace観測を公開用の閉じた値へ写す。
 * @responsibility 試行相関・対象一致・欠測と観測不能を維持する。
 * @trace ARCH-000004
 * @input raw: 観測配列、expectedWorkspaceId: 要求対象（省略時も配列内の対象一致を検査）。
 * @returns 凍結した観測配列。不正又は重複はnull。
 * @precondition N/A: 外部由来のunknownを受ける。
 * @postcondition 元値の後続変更を公開結果へ搬送しない。
 * @effect N/A: 値検査と複製だけ。
 * @failure getter・Proxy・別対象・不明を空配列へ変換しない。
 * @invariant 変更観測は採用・Commit・Mergeの完了ではない。
 * @boundary Coordinator結果とWorkbench／MCPの公開投影。
 * @security 本文・絶対Path・Authorityを追加しない。
 * @concurrency 同期処理で共有状態を持たない。
 */
export function inspectCoordinatorWorkspaceResults(
  raw: unknown,
  expectedWorkspaceId?: string | null,
):
  | readonly Readonly<{
      taskId: string;
      attemptId: string;
      operationId: string;
      result: WorkspaceResult;
    }>[]
  | null {
  const array = snapshotPlainArray(raw, Number.MAX_SAFE_INTEGER);
  if (array.status !== "ok" || array.value.length === 0) return null;
  const entries: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    result: WorkspaceResult;
  }>[] = [];
  const attempts = new Set<string>();
  const operations = new Set<string>();
  let workspaceId = expectedWorkspaceId;
  for (const value of array.value) {
    const entry = snapshotPlainRecord(
      value,
      new Set(["taskId", "attemptId", "operationId", "result"] as const),
    );
    if (
      !entry ||
      !validIdentity(entry.taskId) ||
      !validIdentity(entry.attemptId) ||
      !validIdentity(entry.operationId) ||
      attempts.has(entry.attemptId) ||
      operations.has(entry.operationId)
    )
      return null;
    const result = inspectWorkspaceResult(entry.result);
    if (
      !result ||
      (workspaceId !== undefined && result.workspaceId !== workspaceId)
    )
      return null;
    workspaceId = result.workspaceId;
    attempts.add(entry.attemptId);
    operations.add(entry.operationId);
    entries.push(
      Object.freeze({
        taskId: entry.taskId,
        attemptId: entry.attemptId,
        operationId: entry.operationId,
        result,
      }),
    );
  }
  return Object.freeze(entries);
}

/**
 * Read one own data property exactly once. Accessor properties, prototype
 *
 * @responsibility task-attempt-runtimeの入力からown Data Propertyを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input container: object、key: string
 * @returns unknownを返す。
 * @precondition 「container: object、key: string」がownDataPropertyの入力契約を満たす。
 * @postcondition ownDataPropertyの責務を完了した結果だけを返す。
 * @effect N/A: ownDataPropertyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownDataPropertyは独自の失敗分岐を所有しない。
 * @invariant ownDataPropertyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataPropertyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataPropertyは共有非同期状態を持たない同期処理である。
 */
function ownDataProperty(container: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (
    !descriptor ||
    !Object.hasOwn(descriptor, "value") ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    return undefined;
  return descriptor.value;
}

/**
 * Plain Containerかを判定する。
 *
 * @responsibility Plain Containerの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainContainerの入力契約を満たす。
 * @postcondition isPlainContainerの責務を完了した結果だけを返す。
 * @effect N/A: isPlainContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainContainerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlainContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlainContainerは共有非同期状態を持たない同期処理である。
 */
function isPlainContainer(value: unknown): value is object {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      types.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Workspace観測の閉じた値をsnapshotする。
 * @responsibility 欠測・null・空配列と方式別の変更相関を維持する。
 * @trace ARCH-000004
 * @input 未検証の観測値。
 * @returns 凍結metadata又はnull。
 * @precondition N/A: unknownを受ける。
 * @postcondition 元値の変更を搬送しない。
 * @effect N/A: 値検査のみ。
 * @failure 不正・不整合・getterはnull。
 * @invariant Pathは相対値であり内容・Host所在を含まない。
 * @boundary Coordinator結果から認可済み上位。
 * @security Authorityを新設しない。
 * @concurrency 純粋同期処理。
 */
export function inspectWorkspaceResult(raw: unknown): WorkspaceResult | null {
  try {
    if (!isPlainContainer(raw)) return null;
    const keys = [
      "workspaceId",
      "changedPaths",
      "canonicalRepositoryChanged",
      "changeAttribution",
      "workspaceDeletionIssued",
    ];
    if (
      Reflect.ownKeys(raw).length !== keys.length ||
      keys.some(
        (key) =>
          !Object.hasOwn(
            Object.getOwnPropertyDescriptor(raw, key) ?? {},
            "value",
          ),
      )
    )
      return null;
    const id = ownDataProperty(raw, "workspaceId");
    const paths = ownDataProperty(raw, "changedPaths");
    const changed = ownDataProperty(raw, "canonicalRepositoryChanged");
    if (
      (id !== null &&
        (typeof id !== "string" ||
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id))) ||
      ownDataProperty(raw, "changeAttribution") !== "unattributed" ||
      ownDataProperty(raw, "workspaceDeletionIssued") !== false ||
      (changed !== null && typeof changed !== "boolean")
    )
      return null;
    let snapshot: readonly string[] | null = null;
    if (paths !== null) {
      if (
        !Array.isArray(paths) ||
        types.isProxy(paths) ||
        Reflect.ownKeys(paths).length !== paths.length + 1
      )
        return null;
      const values: string[] = [];
      for (let index = 0; index < paths.length; index++) {
        const value = ownDataProperty(paths, String(index));
        if (
          typeof value !== "string" ||
          value.length === 0 ||
          /[\\:\0\r\n]/u.test(value) ||
          value
            .split("/")
            .some((part) => part === "" || part === "." || part === "..")
        )
          return null;
        values.push(value);
      }
      if (new Set(values).size !== values.length) return null;
      snapshot = Object.freeze(values);
    }
    if (
      id === null
        ? changed !== (snapshot === null ? null : snapshot.length > 0)
        : changed !== false
    )
      return null;
    return Object.freeze({
      workspaceId: id,
      changedPaths: snapshot,
      canonicalRepositoryChanged: changed,
      changeAttribution: "unattributed",
      workspaceDeletionIssued: false,
    });
  } catch {
    return null;
  }
}

/**
 * 既存の要求相関用IDを同じ区切り・桁数で生成する。
 * @responsibility prefixと入力順、NUL区切り、SHA-256先頭40桁の保存契約を維持する。
 * @trace ARCH-000004
 * @input 既存の用途prefixと順序付き識別値。
 * @returns 既存形式の相関ID。Authorityではない。
 * @effect なし。入力だけをHash化する。
 * @invariant 区切り方式やUnicodeの正規化を変更しない。
 * @boundary Coordinator内部のIdentity値契約。
 */
export function createCoordinatorStableId(
  prefix: string,
  parts: readonly string[],
): string {
  return `${prefix}-${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 40)}`;
}

/**
 * 呼出し側が選んだ既存回復記録から、Queueの回復相関IDを生成する。
 * @responsibility Task・義務種別・元参照の組を順序に依存せず同じ形式へ固定する。
 * @trace ARCH-000008
 * @precondition 呼出し側が対象のProject・Queue・Task集合を選定済み。
 * @returns 義務がなければnull。元記録のphaseはIDに含めない。
 * @effect なし。受付・実行許可・回復確定は行わない。
 */
export function createProjectRecoveryApplicationId(
  projectId: string,
  queueId: string,
  tasks: ProjectExecutionState["tasks"],
): string | null {
  const references = tasks
    .flatMap((task) =>
      task.recoveryObligations.map(
        ({ kind, recoveryId }) => `${task.definition.id}:${kind}:${recoveryId}`,
      ),
    )
    .sort();
  return references.length === 0
    ? null
    : createCoordinatorStableId("project-recovery-application", [
        projectId,
        queueId,
        ...references,
      ]);
}

/**
 * 既存の要求内容をSHA-256の全64桁で照合する。
 * @responsibility 相関IDの切詰めと内容Hashを混同しない。
 * @trace ARCH-000004
 * @input 呼出しOwnerが既存規則で構成した本文。
 * @returns 小文字16進64桁のHash。
 * @effect なし。保存・認可・外部実行は行わない。
 * @boundary Coordinator内部の内容照合。
 */
export function hashCoordinatorContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Identityが有効か判定する。
 *
 * @responsibility Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns 共有Identityの形式が成立した場合だけ文字列へ型を絞る。
 * @precondition 「value: unknown」がvalidIdentityの入力契約を満たす。
 * @postcondition validIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdentityは独自の失敗分岐を所有しない。
 * @invariant validIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdentityは共有非同期状態を持たない同期処理である。
 */
export function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validRevisionの計算結果を返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
export function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Coordinator 回復 Identityかを判定する。
 *
 * @responsibility Coordinator 回復 Identityの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisCoordinatorRecoveryIdentityの入力契約を満たす。
 * @postcondition isCoordinatorRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorRecoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCoordinatorRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant isCoordinatorRecoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorRecoveryIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorRecoveryIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * 検証済みRepository Rootの保存Bindingを得る。
 * @responsibility 従来のstable(binding, root)と同じbyte列・長さを保つ。
 * @trace ARCH-000004
 * @input 検証済みのexact Root文字列。
 * @returns 既存形式のbinding ID。
 * @precondition 呼出側が今回要求の入力範囲を確定している。
 * @postcondition 確認できた値だけを返し、観測不能を成功へ変換しない。
 * @effect N/A: 純粋計算だけ。
 * @failure N/A: 固定文字列をHash化する。
 * @invariant 現在状態と履歴の観測を独立保持する。
 * @boundary Coordinator活動Ownerと内部Consumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一回の要求を同期観測し、共有Cacheを持たない。
 */
export function deriveCoordinatorRepositoryBindingId(root: string): string {
  return `binding-${createHash("sha256").update(root).digest("hex").slice(0, 40)}`;
}

const executionAbortedGetter = Object.getOwnPropertyDescriptor(
  AbortSignal.prototype,
  "aborted",
)?.get;

/**
 * 実行・認証操作の取消値を組込みgetterだけで読む。
 * @responsibility APIと直接呼出しの双方で偽Signal・accessor実行を拒否する。
 * @trace ARCH-000010
 * @input signal: 任意の取消入力又は省略。
 * @returns 取消boolean、不正時null。省略はfalse。
 * @precondition N/A: 利用者定義Propertyを評価する前に呼ぶ。
 * @postcondition 入力のProxy／getterを実行しない。
 * @effect N/A: 局所値の検査だけ。
 * @failure brand・prototype・descriptor不正はnull。
 * @invariant 不正値を未取消へ丸めない。
 * @boundary 公開入力と実行Lifecycleの取消観測。
 * @security 偽のprototypeだけではAbortSignalとして受理しない。
 * @concurrency 待機後も同じ組込みgetterで現在値を読む。
 */
export function readExecutionCancellation(signal: unknown): boolean | null {
  if (signal === undefined) return false;
  if (
    !signal ||
    typeof signal !== "object" ||
    types.isProxy(signal) ||
    Object.getPrototypeOf(signal) !== AbortSignal.prototype ||
    Object.getOwnPropertyDescriptor(signal, "aborted") !== undefined ||
    !executionAbortedGetter
  )
    return null;
  try {
    return executionAbortedGetter.call(signal) as boolean;
  } catch {
    return null;
  }
}

/**
 * 入力JSON値をdata descriptorだけから独立コピーする。
 * @responsibility 保存codecに依存せず、既存入力の型・深度・未知実行Property拒否を維持する。
 * @trace ARCH-000014
 * @input value: 未信頼値、depth: 内部再帰位置。
 * @returns 入力と参照を共有しないJSON値。
 * @effect N/A: 入力観測と局所コピーだけ。
 * @failure Proxy、accessor、symbol、不正数、深度超過は例外。
 * @boundary Coordinatorの入力捕捉。保存SchemaやHashを生成しない。
 * @security getterやtoJSONを実行しない。
 */
export function snapshotJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 32 || types.isProxy(value)) throw new Error("input_json_invalid");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return value;
  if (typeof value === "number" && Number.isSafeInteger(value))
    return Object.is(value, -0) ? 0 : value;
  if (!value || typeof value !== "object")
    throw new Error("input_json_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    Object.values(descriptors).some(
      (descriptor) => !Object.hasOwn(descriptor, "value"),
    )
  )
    throw new Error("input_json_invalid");
  if (Array.isArray(value)) {
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || keys.length !== length + 1)
      throw new Error("input_json_invalid");
    return Array.from({ length }, (_, index) => {
      const item = descriptors[String(index)];
      if (!item) throw new Error("input_json_invalid");
      return snapshotJsonValue(item.value, depth + 1);
    });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("input_json_invalid");
  return Object.fromEntries(
    Object.keys(descriptors)
      .sort()
      .map((key) => [
        key,
        snapshotJsonValue(descriptors[key]?.value, depth + 1),
      ]),
  );
}

/**
 * HostのFilesystemを参照せずRepository相対Pathを正規化する。
 *
 * @responsibility Repository Relative Pathの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns string | nullを返す。
 * @precondition 「value: unknown」がnormalizeRepositoryRelativePathの入力契約を満たす。
 * @postcondition normalizeRepositoryRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: normalizeRepositoryRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeRepositoryRelativePathは独自の失敗分岐を所有しない。
 * @invariant normalizeRepositoryRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeRepositoryRelativePathはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizeRepositoryRelativePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeRepositoryRelativePathは共有非同期状態を持たない同期処理である。
 */
export function normalizeRepositoryRelativePath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    return null;
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:($|\/)/u.test(normalized) ||
    normalized
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  )
    return null;
  return normalized;
}

/**
 * repository Path Withinを決定する。
 *
 * @responsibility repository Path Withinの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string、roots: readonly string[]
 * @returns repositoryPathWithinの計算結果を返す。
 * @precondition 「candidate: string、roots: readonly string[]」がrepositoryPathWithinの入力契約を満たす。
 * @postcondition repositoryPathWithinの責務を完了した結果だけを返す。
 * @effect N/A: repositoryPathWithinは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: repositoryPathWithinは独自の失敗分岐を所有しない。
 * @invariant repositoryPathWithinは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: repositoryPathWithinはProcess内の同一Subsystemで完結する。
 * @security N/A: repositoryPathWithinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: repositoryPathWithinは共有非同期状態を持たない同期処理である。
 */
export function repositoryPathWithin(
  candidate: string,
  roots: readonly string[],
) {
  const normalizedCandidate = normalizeRepositoryRelativePath(candidate);
  if (normalizedCandidate === null) return false;
  const candidateKey = normalizedCandidate.toUpperCase();
  return roots.some((rootValue) => {
    const root = normalizeRepositoryRelativePath(rootValue);
    if (root === null) return false;
    const rootKey = root.toUpperCase();
    return candidateKey === rootKey || candidateKey.startsWith(`${rootKey}/`);
  });
}

/**
 * plain-data-snapshotで使用するData Descriptorの値契約を定義する。
 *
 * @responsibility Data DescriptorのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape DataDescriptorが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DataDescriptorで宣言した値と責務の対応を維持する。
 * @boundary N/A: DataDescriptorの宣言は外部境界を開かない。
 * @security DataDescriptorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DataDescriptorの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DataDescriptor = PropertyDescriptor & { value: unknown };

/**
 * plain-data-snapshotで使用するPlain Array Snapshotの値契約を定義する。
 *
 * @responsibility Plain Array SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape PlainArraySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PlainArraySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: PlainArraySnapshotの宣言は外部境界を開かない。
 * @security PlainArraySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PlainArraySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PlainArraySnapshot<T> =
  | Readonly<{ status: "ok"; reason: null; value: readonly T[] }>
  | Readonly<{
      status: "blocked";
      reason:
        | "not_plain_array"
        | "array_length_invalid"
        | "array_length_exceeded"
        | "array_shape_invalid"
        | "array_input_invalid";
      value: null;
    }>;

/**
 * data Descriptorを決定する。
 *
 * @responsibility data Descriptorの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input descriptor: PropertyDescriptor | undefined、shouldBeEnumerable
 * @returns descriptor is DataDescriptorを返す。
 * @precondition 「descriptor: PropertyDescriptor | undefined、shouldBeEnumerable」がdataDescriptorの入力契約を満たす。
 * @postcondition dataDescriptorの責務を完了した結果だけを返す。
 * @effect N/A: dataDescriptorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dataDescriptorは独自の失敗分岐を所有しない。
 * @invariant dataDescriptorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dataDescriptorはProcess内の同一Subsystemで完結する。
 * @security dataDescriptorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dataDescriptorは共有非同期状態を持たない同期処理である。
 */
function dataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  shouldBeEnumerable = true,
): descriptor is DataDescriptor {
  return Boolean(
    descriptor &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

/**
 * Plain 記録を所有Snapshotへ変換する。
 *
 * @responsibility Plain 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、allowedKeys: ReadonlySet<K>
 * @returns Readonly<Record<K, unknown>> | nullを返す。
 * @precondition 「value: unknown、allowedKeys: ReadonlySet<K>」がsnapshotPlainRecordの入力契約を満たす。
 * @postcondition snapshotPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainRecordはProcess内の同一Subsystemで完結する。
 * @security snapshotPlainRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotPlainRecordは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (!dataDescriptor(descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * Plain Arrayを所有Snapshotへ変換する。
 *
 * @responsibility Plain Arrayの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、maximumLength: number
 * @returns PlainArraySnapshot<T>を返す。
 * @precondition 「value: unknown、maximumLength: number」がsnapshotPlainArrayの入力契約を満たす。
 * @postcondition snapshotPlainArrayの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainArrayは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainArrayはProcess内の同一Subsystemで完結する。
 * @security snapshotPlainArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotPlainArrayは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainArray<T = unknown>(
  value: unknown,
  maximumLength: number,
): PlainArraySnapshot<T> {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return Object.freeze({
        status: "blocked",
        reason: "not_plain_array",
        value: null,
      });
    }
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !dataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) ||
      initialLength.value < 0
    )
      return Object.freeze({
        status: "blocked",
        reason: "array_length_invalid",
        value: null,
      });
    if (initialLength.value > maximumLength) {
      return Object.freeze({
        status: "blocked",
        reason: "array_length_exceeded",
        value: null,
      });
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = (
      descriptors as unknown as Record<string, PropertyDescriptor | undefined>
    ).length;
    if (
      keys.length !== initialLength.value + 1 ||
      !dataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value
    ) {
      return Object.freeze({
        status: "blocked",
        reason: "array_shape_invalid",
        value: null,
      });
    }
    const snapshotItems: T[] = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const key = String(index);
      const descriptor = descriptors[key];
      if (!dataDescriptor(descriptor)) {
        return Object.freeze({
          status: "blocked",
          reason: "array_shape_invalid",
          value: null,
        });
      }
      snapshotItems.push(descriptor.value as T);
    }
    return Object.freeze({
      status: "ok",
      reason: null,
      value: Object.freeze(snapshotItems),
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "array_input_invalid",
      value: null,
    });
  }
}

/**
 * JSON走査の次位置とnested重複keyの検出結果を保持する。
 *
 * @responsibility 再帰した値の走査位置と重複key有無を親走査へ返す。
 * @trace ARCH-000015
 * @shape nextIndexは消費した値の直後、hasDuplicateKeyは子孫を含む重複keyの有無。
 * @invariant 重複検出を上位へ伝播し、構文不正は本型でなくnullで返す。
 * @boundary JSON parser内の再帰走査だけで共有する非公開型。
 * @security 生文字列・key一覧・実行権限を結果へ含めない。
 * @compatibility 公開APIではなく、同じparser内の走査呼出しで利用する。
 */
type ScanResult = Readonly<{
  nextIndex: number;
  hasDuplicateKey: boolean;
}>;

const JSON_WHITESPACE = new Set([" ", "\t", "\r", "\n"]);
const HEX_DIGIT = /^[0-9a-f]$/iu;

/**
 * JSONで許可する空白だけを読み飛ばす。
 *
 * @responsibility 空白集合と走査位置の更新を所有する。
 * @trace ARCH-000015
 * @input rawと走査開始位置。
 * @returns 空白列直後の位置。末尾ならraw.length。
 * @precondition 開始位置は呼出し側のJSON走査位置である。
 * @postcondition 空白以外の最初の文字を消費しない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure N/A: 対象外文字は次の構文走査へ残す。
 * @invariant 空白集合をJSON仕様の4文字から拡張しない。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function skipWhitespace(raw: string, startIndex: number) {
  let nextIndex = startIndex;
  while (nextIndex < raw.length && JSON_WHITESPACE.has(raw[nextIndex] ?? ""))
    nextIndex += 1;
  return nextIndex;
}

/**
 * JSON文字列の終端とescape構文を走査する。
 *
 * @responsibility 引用符、制御文字、escapeとUnicode escapeの境界を検査する。
 * @trace ARCH-000015
 * @input rawと開始引用符の位置。
 * @returns 閉じ引用符の直後の位置、又は不正・未完了のnull。
 * @precondition 開始位置は文字列候補の先頭である。
 * @postcondition 成功時だけ閉じ引用符までを消費する。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 開始引用符なし、制御文字、不正escape、未終端はnull。
 * @invariant 本文を復号・保存せず走査位置だけを返す。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanString(raw: string, startIndex: number) {
  if (raw[startIndex] !== '"') return null;
  let nextIndex = startIndex + 1;
  while (nextIndex < raw.length) {
    const character = raw[nextIndex];
    if (character === '"') return nextIndex + 1;
    if (!character || character.charCodeAt(0) < 0x20) return null;
    if (character !== "\\") {
      nextIndex += 1;
      continue;
    }
    const escapeCharacter = raw[nextIndex + 1];
    if (!escapeCharacter || !'"\\/bfnrtu'.includes(escapeCharacter))
      return null;
    if (escapeCharacter !== "u") {
      nextIndex += 2;
      continue;
    }
    const hexadecimal = raw.slice(nextIndex + 2, nextIndex + 6);
    if (
      hexadecimal.length !== 4 ||
      ![...hexadecimal].every((value) => HEX_DIGIT.test(value))
    )
      return null;
    nextIndex += 6;
  }
  return null;
}

/**
 * JSON数値の構文に一致するprefixを走査する。
 *
 * @responsibility 符号・整数・小数・指数の字句境界を検査する。
 * @trace ARCH-000015
 * @input rawと数値候補の開始位置。
 * @returns 数値prefixの直後の位置、又は不一致のnull。
 * @precondition 親走査が後続の区切り又は文書末尾を検証する。
 * @postcondition 数値の後続文字を受理したとは主張しない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 先頭から数値構文へ一致しない場合はnull。
 * @invariant 値への変換や有限性の業務判断を行わない。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanNumber(raw: string, startIndex: number) {
  const match = raw
    .slice(startIndex)
    .match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
  return match ? startIndex + (match[0]?.length ?? 0) : null;
}

/**
 * JSON配列を再帰走査しnested重複keyを伝播する。
 *
 * @responsibility 要素間の区切り、終端と重複key検出結果の集約を所有する。
 * @trace ARCH-000015
 * @input rawと配列開始位置。
 * @returns 配列の次位置と重複key有無、又は不正のnull。
 * @precondition 呼出し元が開始文字を配列と判定している。
 * @postcondition 成功時は閉じ括弧の直後を返す。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 要素・区切り・終端の不正又は欠落はnull。
 * @invariant nested objectの重複keyを成功結果へ隠さない。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanArray(raw: string, startIndex: number): ScanResult | null {
  let nextIndex = skipWhitespace(raw, startIndex + 1);
  let hasDuplicateKey = false;
  if (raw[nextIndex] === "]")
    return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
  while (nextIndex < raw.length) {
    const scanned = scanValue(raw, nextIndex);
    if (!scanned) return null;
    hasDuplicateKey ||= scanned.hasDuplicateKey;
    nextIndex = skipWhitespace(raw, scanned.nextIndex);
    if (raw[nextIndex] === "]")
      return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
    if (raw[nextIndex] !== ",") return null;
    nextIndex = skipWhitespace(raw, nextIndex + 1);
  }
  return null;
}

/**
 * JSON objectを走査し復号したkeyの重複を検出する。
 *
 * @responsibility keyの復号、key/value区切りとnested重複の伝播を所有する。
 * @trace ARCH-000015
 * @input rawとobject開始位置。
 * @returns objectの次位置と重複key有無、又は不正のnull。
 * @precondition 呼出し元が開始文字をobjectと判定している。
 * @postcondition 同じ復号keyをescape表記の差で別keyとしない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure key復号、colon、値、区切り又は終端の不正はnull。
 * @invariant key集合は一つのobjectだけに閉じる。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanObject(raw: string, startIndex: number): ScanResult | null {
  const keys = new Set<string>();
  let nextIndex = skipWhitespace(raw, startIndex + 1);
  let hasDuplicateKey = false;
  if (raw[nextIndex] === "}")
    return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
  while (nextIndex < raw.length) {
    const keyEnd = scanString(raw, nextIndex);
    if (keyEnd === null) return null;
    let key: string;
    try {
      key = JSON.parse(raw.slice(nextIndex, keyEnd)) as string;
    } catch {
      return null;
    }
    if (keys.has(key)) hasDuplicateKey = true;
    keys.add(key);
    nextIndex = skipWhitespace(raw, keyEnd);
    if (raw[nextIndex] !== ":") return null;
    const scanned = scanValue(raw, skipWhitespace(raw, nextIndex + 1));
    if (!scanned) return null;
    hasDuplicateKey ||= scanned.hasDuplicateKey;
    nextIndex = skipWhitespace(raw, scanned.nextIndex);
    if (raw[nextIndex] === "}")
      return Object.freeze({ nextIndex: nextIndex + 1, hasDuplicateKey });
    if (raw[nextIndex] !== ",") return null;
    nextIndex = skipWhitespace(raw, nextIndex + 1);
  }
  return null;
}

/**
 * JSON値の先頭文字から対応する字句走査へ分岐する。
 *
 * @responsibility object・配列・文字列・literal・数値の走査結果を統一する。
 * @trace ARCH-000015
 * @input rawと値候補の走査開始位置。
 * @returns 値の次位置と重複key有無、又は不正のnull。
 * @precondition 文書全体の末尾判定は公開parserが所有する。
 * @postcondition 先行空白だけを読み飛ばし一つの値を走査する。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 対応しない字句又は下位走査の不正はnull。
 * @invariant 部分値の成功を文書全体の受理に昇格しない。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
function scanValue(raw: string, startIndex: number): ScanResult | null {
  const nextIndex = skipWhitespace(raw, startIndex);
  const character = raw[nextIndex];
  if (character === "{") return scanObject(raw, nextIndex);
  if (character === "[") return scanArray(raw, nextIndex);
  if (character === '"') {
    const stringEnd = scanString(raw, nextIndex);
    return stringEnd === null
      ? null
      : Object.freeze({ nextIndex: stringEnd, hasDuplicateKey: false });
  }
  for (const literal of ["true", "false", "null"]) {
    if (raw.startsWith(literal, nextIndex))
      return Object.freeze({
        nextIndex: nextIndex + literal.length,
        hasDuplicateKey: false,
      });
  }
  const numberEnd = scanNumber(raw, nextIndex);
  return numberEnd === null
    ? null
    : Object.freeze({ nextIndex: numberEnd, hasDuplicateKey: false });
}

/**
 * 重複keyと余剰文字のないJSON文書だけを構造化する。
 *
 * @responsibility 事前走査とJSON.parseを接続し曖昧な文書を拒否する。
 * @trace ARCH-000015
 * @input 未信頼のJSON文字列raw。
 * @returns 構造化値、又は不正のnull。JSON literal nullもnullとなる。
 * @precondition 容量制限は利用側が用途ごとに確認する。
 * @postcondition 重複key、BOM、余剰文字のある文書を返さない。
 * @effect N/A: JSON文字列と呼出し内の走査値だけを扱う。
 * @failure 空文書、構文不正、重複key、BOM、末尾データとJSON.parse失敗はnull。
 * @invariant 純粋な解析結果を実行許可・Provider成功へ読み替えない。
 * @boundary Provider共通のJSON構文解析。CLI完了・Task採否は利用側が判定する。
 * @security 生本文、認証情報やAuthorityを外部へ公開しない。
 * @concurrency N/A: 呼出しごとの同期走査で共有状態と資源を持たない。
 */
export function parseUnambiguousJsonDocument(raw: string) {
  if (raw.length === 0 || raw.charCodeAt(0) === 0xfeff) return null;
  const scanned = scanValue(raw, 0);
  if (
    !scanned ||
    scanned.hasDuplicateKey ||
    skipWhitespace(raw, scanned.nextIndex) !== raw.length
  ) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

const FIXED_FORMAT_SECRET_PATTERN =
  /-----BEGIN (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED) )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{32,}\b|\bgithub_pat_[A-Za-z0-9_]{32,}\b|\bglpat-[A-Za-z0-9_-]{20,}\b|\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u;

const PATH_SEGMENT_ASSIGNMENT_PATTERN =
  /^(?:"([A-Za-z][A-Za-z0-9_-]{0,127})"|'([A-Za-z][A-Za-z0-9_-]{0,127})'|([A-Za-z][A-Za-z0-9_-]{0,127}))\s*[:=]\s*(?:"([^"\r\n]{1,4096})"|'([^'\r\n]{1,4096})'|([^\r\n]{1,4096}))$/u;

const NAMED_SECRET_ASSIGNMENT_PATTERN =
  /(?:^|[\s,{;/"'`>])(?:"([A-Za-z][A-Za-z0-9_-]{0,127})"|'([A-Za-z][A-Za-z0-9_-]{0,127})'|([A-Za-z_$][A-Za-z0-9_$]*(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*|(?:\?\.)?\[\s*(?:"[A-Za-z0-9_-]{1,128}"|'[A-Za-z0-9_-]{1,128}'|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]{1,10})\s*\])*))\s*[:=]\s*(?:"([^"\r\n]{1,4096})"|'([^'\r\n]{1,4096})'|([^\s,;}{]{1,4096}))/gu;

const EMBEDDED_NAMED_SECRET_PATTERN =
  /\/([A-Za-z][A-Za-z0-9_-]{0,127})\s*[:=]\s*(?:"([^"\r\n]{1,4096})"|'([^'\r\n]{1,4096})'|([A-Za-z0-9_!@#$%^&*+=.-]{1,4096}))/gu;

const EXAMPLE_VALUE_PATTERN =
  /^(?:example(?:[-_].*)?|sample(?:[-_].*)?|dummy(?:[-_].*)?|placeholder(?:[-_].*)?|redacted|replace[-_]?me|not[-_]?a[-_]?secret|test[-_]?only|your[-_].*(?:here)?|x{8,}|\*{8,}|<[^>]+>)$/iu;

const SECRET_KEY_SUFFIX =
  /(?:^|_)(?:password|passwd|pwd|client_secret|api_key|apikey|access_token|accesstoken|refresh_token|refreshtoken|session_token|sessiontoken|auth_token|authtoken|private_key|privatekey|secret_access_key|secret_key)$/u;

const SOURCE_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z_$]*$/u;

const STANDARD_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

const MEMBER_EXPRESSION_PATTERN =
  /^[A-Za-z_$][A-Za-z0-9_$]*(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*|(?:\?\.)?\[\s*(?:"[A-Za-z0-9_-]{1,128}"|'[A-Za-z0-9_-]{1,128}'|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]{1,10})\s*\])+$/u;

const CALL_EXPRESSION_PATTERN =
  /^[A-Za-z_$][A-Za-z0-9_$]*(?:(?:\?\.|\.)[A-Za-z_$][A-Za-z0-9_$]*|(?:\?\.)?\[\s*(?:"[A-Za-z0-9_-]{1,128}"|'[A-Za-z0-9_-]{1,128}'|[A-Za-z_$][A-Za-z0-9_$]*|[0-9]{1,10})\s*\])*\([^\r\n]{0,1024}\)$/u;

const SENSITIVE_BASENAMES = new Set([
  ".env",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "credentials.json",
  ".git-credentials",
  "id_ed25519",
  "id_rsa",
  "application_default_credentials.json",
  "secrets.json",
  "secrets.yaml",
  "secrets.yml",
  "service-account.json",
]);

const SENSITIVE_EXTENSIONS = new Set([".key", ".p12", ".pfx"]);

const NON_SECRET_ENV_SUFFIXES = new Set([".example", ".sample", ".template"]);

const SOURCE_CODE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".mjs",
  ".mts",
  ".ts",
]);

/**
 * Fromを表示文字列へ変換する。
 *
 * @responsibility Fromの入力値、文字列表現、機密を含めない結果境界を所有する。
 * @trace ARCH-000014
 * @input value: string | Uint8Array
 * @returns textFromの計算結果を返す。
 * @precondition 「value: string | Uint8Array」がtextFromの入力契約を満たす。
 * @postcondition textFromの責務を完了した結果だけを返す。
 * @effect N/A: textFromは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: textFromは独自の失敗分岐を所有しない。
 * @invariant textFromは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: textFromはProcess内の同一Subsystemで完結する。
 * @security textFromはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: textFromは共有非同期状態を持たない同期処理である。
 */
function textFrom(value: string | Uint8Array) {
  return typeof value === "string"
    ? value
    : Buffer.from(value).toString("utf8");
}

/**
 * secret Key Nameを決定する。
 *
 * @responsibility secret Key Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns secretKeyNameの計算結果を返す。
 * @precondition 「value: string」がsecretKeyNameの入力契約を満たす。
 * @postcondition secretKeyNameの責務を完了した結果だけを返す。
 * @effect N/A: secretKeyNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: secretKeyNameは独自の失敗分岐を所有しない。
 * @invariant secretKeyNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: secretKeyNameはProcess内の同一Subsystemで完結する。
 * @security secretKeyNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: secretKeyNameは共有非同期状態を持たない同期処理である。
 */
function secretKeyName(value: string) {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replaceAll("-", "_")
    .toLowerCase();
  return SECRET_KEY_SUFFIX.test(normalized);
}

/**
 * assignment Keyを決定する。
 *
 * @responsibility assignment Keyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input doubleQuotedKey: string | undefined、singleQuotedKey: string | undefined、target: string | undefined
 * @returns assignmentKeyの計算結果を返す。
 * @precondition 「doubleQuotedKey: string | undefined、singleQuotedKey: string | undefined、target: string | undefined」がassignmentKeyの入力契約を満たす。
 * @postcondition assignmentKeyの責務を完了した結果だけを返す。
 * @effect N/A: assignmentKeyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: assignmentKeyは独自の失敗分岐を所有しない。
 * @invariant assignmentKeyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assignmentKeyはProcess内の同一Subsystemで完結する。
 * @security assignmentKeyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: assignmentKeyは共有非同期状態を持たない同期処理である。
 */
function assignmentKey(
  doubleQuotedKey: string | undefined,
  singleQuotedKey: string | undefined,
  target: string | undefined,
) {
  if (doubleQuotedKey !== undefined) return doubleQuotedKey;
  if (singleQuotedKey !== undefined) return singleQuotedKey;
  if (!target) return "";
  const bracket = target.match(/\[\s*["']([A-Za-z0-9_-]{1,128})["']\s*\]$/u);
  if (bracket?.[1]) return bracket[1];
  const segments = target.replaceAll("?.", ".").split(".");
  return segments.at(-1) ?? "";
}

/**
 * source Indirectionを決定する。
 *
 * @responsibility source Indirectionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: string、isSourceFileContext: boolean
 * @returns sourceIndirectionの計算結果を返す。
 * @precondition 「value: string、isSourceFileContext: boolean」がsourceIndirectionの入力契約を満たす。
 * @postcondition sourceIndirectionの責務を完了した結果だけを返す。
 * @effect N/A: sourceIndirectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sourceIndirectionは独自の失敗分岐を所有しない。
 * @invariant sourceIndirectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sourceIndirectionはProcess内の同一Subsystemで完結する。
 * @security sourceIndirectionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sourceIndirectionは共有非同期状態を持たない同期処理である。
 */
function sourceIndirection(value: string, isSourceFileContext: boolean) {
  const expression = value.replace(/!+(?=(?:\?\.|\.|\[))/gu, "");
  const withoutTerminalAssertion = expression.endsWith("!")
    ? expression.slice(0, -1)
    : null;
  return (
    expression.startsWith("${") ||
    (isSourceFileContext
      ? STANDARD_IDENTIFIER_PATTERN.test(expression)
      : SOURCE_IDENTIFIER_PATTERN.test(expression)) ||
    MEMBER_EXPRESSION_PATTERN.test(expression) ||
    CALL_EXPRESSION_PATTERN.test(expression) ||
    (withoutTerminalAssertion !== null &&
      ((isSourceFileContext &&
        STANDARD_IDENTIFIER_PATTERN.test(withoutTerminalAssertion)) ||
        MEMBER_EXPRESSION_PATTERN.test(withoutTerminalAssertion) ||
        CALL_EXPRESSION_PATTERN.test(withoutTerminalAssertion)))
  );
}

/**
 * Recognized Secret Path Segmentを含むか判定する。
 *
 * @responsibility Recognized Secret Path Segmentの探索範囲、包含条件、判定結果境界を所有する。
 * @trace ARCH-000014
 * @input segment: string
 * @returns containsRecognizedSecretPathSegmentの計算結果を返す。
 * @precondition 「segment: string」がcontainsRecognizedSecretPathSegmentの入力契約を満たす。
 * @postcondition containsRecognizedSecretPathSegmentの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretPathSegmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretPathSegmentは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretPathSegmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretPathSegmentはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretPathSegmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretPathSegmentは共有非同期状態を持たない同期処理である。
 */
export function containsRecognizedSecretPathSegment(segment: string) {
  if (containsRecognizedSecretText(segment)) return true;
  const match = PATH_SEGMENT_ASSIGNMENT_PATTERN.exec(segment);
  if (!match) return false;
  const key = match[1] ?? match[2] ?? match[3] ?? "";
  if (!secretKeyName(key)) return false;
  const assignedValue = (match[4] ?? match[5] ?? match[6] ?? "").trim();
  return (
    assignedValue.length >= 8 &&
    !EXAMPLE_VALUE_PATTERN.test(assignedValue) &&
    !/^(?:null|undefined|true|false)$/iu.test(assignedValue)
  );
}

/**
 * Path Or Nested Suffixかを判定する。
 *
 * @responsibility Path Or Nested Suffixの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input normalized: string、suffix: string
 * @returns isPathOrNestedSuffixの計算結果を返す。
 * @precondition 「normalized: string、suffix: string」がisPathOrNestedSuffixの入力契約を満たす。
 * @postcondition isPathOrNestedSuffixの責務を完了した結果だけを返す。
 * @effect N/A: isPathOrNestedSuffixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPathOrNestedSuffixは独自の失敗分岐を所有しない。
 * @invariant isPathOrNestedSuffixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPathOrNestedSuffixはProcess内の同一Subsystemで完結する。
 * @security isPathOrNestedSuffixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPathOrNestedSuffixは共有非同期状態を持たない同期処理である。
 */
function isPathOrNestedSuffix(normalized: string, suffix: string) {
  return normalized === suffix || normalized.endsWith(`/${suffix}`);
}

/**
 * Java Script Code Positionかを判定する。
 *
 * @responsibility Java Script Code Positionの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input text: string、targetIndex: number
 * @returns isJavaScriptCodePositionの計算結果を返す。
 * @precondition 「text: string、targetIndex: number」がisJavaScriptCodePositionの入力契約を満たす。
 * @postcondition isJavaScriptCodePositionの責務を完了した結果だけを返す。
 * @effect N/A: isJavaScriptCodePositionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isJavaScriptCodePositionは独自の失敗分岐を所有しない。
 * @invariant isJavaScriptCodePositionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isJavaScriptCodePositionはProcess内の同一Subsystemで完結する。
 * @security isJavaScriptCodePositionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isJavaScriptCodePositionは共有非同期状態を持たない同期処理である。
 */
function isJavaScriptCodePosition(text: string, targetIndex: number) {
  let state: "code" | "single" | "double" | "template" | "line" | "block" =
    "code";
  let isEscaped = false;
  for (let index = 0; index < targetIndex; index += 1) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (state === "line") {
      if (current === "\n" || current === "\r") state = "code";
      continue;
    }
    if (state === "block") {
      if (current === "*" && next === "/" && index + 1 < targetIndex) {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state !== "code") {
      if (isEscaped) isEscaped = false;
      else if (current === "\\") isEscaped = true;
      else if (
        (state === "single" && current === "'") ||
        (state === "double" && current === '"') ||
        (state === "template" && current === "`")
      )
        state = "code";
      continue;
    }
    if (current === "/" && next === "/") {
      state = "line";
      index += 1;
    } else if (current === "/" && next === "*") {
      state = "block";
      index += 1;
    } else if (current === "'") state = "single";
    else if (current === '"') state = "double";
    else if (current === "`") state = "template";
  }
  return state === "code";
}

/**
 * Block Comment Payloadを固定Schemaへ正規化する。
 *
 * @responsibility Block Comment Payloadの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns normalizeBlockCommentPayloadの計算結果を返す。
 * @precondition 「value: string」がnormalizeBlockCommentPayloadの入力契約を満たす。
 * @postcondition normalizeBlockCommentPayloadの責務を完了した結果だけを返す。
 * @effect N/A: normalizeBlockCommentPayloadは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeBlockCommentPayloadは独自の失敗分岐を所有しない。
 * @invariant normalizeBlockCommentPayloadは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeBlockCommentPayloadはProcess内の同一Subsystemで完結する。
 * @security normalizeBlockCommentPayloadはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeBlockCommentPayloadは共有非同期状態を持たない同期処理である。
 */
function normalizeBlockCommentPayload(value: string) {
  return value.replace(/(^|[\r\n])[\t ]*[*!]+/gu, "$1");
}

/**
 * javascript Non Code Fragmentsを決定する。
 *
 * @responsibility javascript Non Code Fragmentsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input text: string
 * @returns javascriptNonCodeFragmentsの計算結果を返す。
 * @precondition 「text: string」がjavascriptNonCodeFragmentsの入力契約を満たす。
 * @postcondition javascriptNonCodeFragmentsの責務を完了した結果だけを返す。
 * @effect N/A: javascriptNonCodeFragmentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: javascriptNonCodeFragmentsは独自の失敗分岐を所有しない。
 * @invariant javascriptNonCodeFragmentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: javascriptNonCodeFragmentsはProcess内の同一Subsystemで完結する。
 * @security javascriptNonCodeFragmentsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: javascriptNonCodeFragmentsは共有非同期状態を持たない同期処理である。
 */
function javascriptNonCodeFragments(text: string) {
  const fragments: string[] = [];
  let state: "code" | "single" | "double" | "template" | "line" | "block" =
    "code";
  let start = -1;
  let isEscaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (state === "code") {
      if (current === "/" && next === "/") {
        state = "line";
        start = index + 2;
        index += 1;
      } else if (current === "/" && next === "*") {
        state = "block";
        start = index + 2;
        index += 1;
      } else if (current === "'") {
        state = "single";
        start = index + 1;
      } else if (current === '"') {
        state = "double";
        start = index + 1;
      } else if (current === "`") {
        state = "template";
        start = index + 1;
      }
      continue;
    }
    if (state === "line") {
      if (current === "\n" || current === "\r") {
        fragments.push(text.slice(start, index));
        state = "code";
        start = -1;
      }
      continue;
    }
    if (state === "block") {
      if (current === "*" && next === "/") {
        fragments.push(normalizeBlockCommentPayload(text.slice(start, index)));
        state = "code";
        start = -1;
        index += 1;
      }
      continue;
    }
    if (isEscaped) {
      isEscaped = false;
    } else if (current === "\\") {
      isEscaped = true;
    } else if (
      (state === "single" && current === "'") ||
      (state === "double" && current === '"') ||
      (state === "template" && current === "`")
    ) {
      fragments.push(text.slice(start, index));
      state = "code";
      start = -1;
    }
  }
  if (state !== "code" && start >= 0) {
    const fragment = text.slice(start);
    fragments.push(
      state === "block" ? normalizeBlockCommentPayload(fragment) : fragment,
    );
  }
  return fragments;
}

/**
 * literal Secret Valueを決定する。
 *
 * @responsibility literal Secret Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: string、isQuoted: boolean、isSourceFileContext: boolean
 * @returns literalSecretValueの計算結果を返す。
 * @precondition 「value: string、isQuoted: boolean、isSourceFileContext: boolean」がliteralSecretValueの入力契約を満たす。
 * @postcondition literalSecretValueの責務を完了した結果だけを返す。
 * @effect N/A: literalSecretValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: literalSecretValueは独自の失敗分岐を所有しない。
 * @invariant literalSecretValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: literalSecretValueはProcess内の同一Subsystemで完結する。
 * @security literalSecretValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: literalSecretValueは共有非同期状態を持たない同期処理である。
 */
function literalSecretValue(
  value: string,
  isQuoted: boolean,
  isSourceFileContext: boolean,
) {
  const normalized = value.trim();
  if (
    normalized.length < 8 ||
    EXAMPLE_VALUE_PATTERN.test(normalized) ||
    /^(?:null|undefined|true|false)$/iu.test(normalized)
  ) {
    return false;
  }
  if (isQuoted) return true;
  if (sourceIndirection(normalized, isSourceFileContext)) return false;
  return (
    normalized.length >= 20 ||
    /[0-9_-]/u.test(normalized) ||
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(normalized)
  );
}

/**
 * Recognized Secret Text In Contextを含むか判定する。
 *
 * @responsibility Recognized Secret Text In Contextの探索範囲、包含条件、判定結果境界を所有する。
 * @trace ARCH-000014
 * @input value: string | Uint8Array、isJavascriptSourceContext: boolean
 * @returns containsRecognizedSecretTextInContextの計算結果を返す。
 * @precondition 「value: string | Uint8Array、isJavascriptSourceContext: boolean」がcontainsRecognizedSecretTextInContextの入力契約を満たす。
 * @postcondition containsRecognizedSecretTextInContextの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretTextInContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretTextInContextは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretTextInContextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretTextInContextはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretTextInContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretTextInContextは共有非同期状態を持たない同期処理である。
 */
function containsRecognizedSecretTextInContext(
  value: string | Uint8Array,
  isJavascriptSourceContext: boolean,
) {
  const text = textFrom(value);
  if (FIXED_FORMAT_SECRET_PATTERN.test(text)) return true;
  if (
    isJavascriptSourceContext &&
    javascriptNonCodeFragments(text).some((fragment) =>
      containsRecognizedSecretTextInContext(fragment, false),
    )
  ) {
    return true;
  }
  for (const match of text.matchAll(EMBEDDED_NAMED_SECRET_PATTERN)) {
    if (
      isJavascriptSourceContext &&
      !isJavaScriptCodePosition(text, match.index ?? 0)
    ) {
      continue;
    }
    if (!secretKeyName(match[1] ?? "")) continue;
    const doubleQuoted = match[2];
    const singleQuoted = match[3];
    if (
      literalSecretValue(
        doubleQuoted ?? singleQuoted ?? match[4] ?? "",
        doubleQuoted !== undefined || singleQuoted !== undefined,
        false,
      )
    ) {
      return true;
    }
  }
  for (const match of text.matchAll(NAMED_SECRET_ASSIGNMENT_PATTERN)) {
    const key = assignmentKey(match[1], match[2], match[3]);
    if (!secretKeyName(key)) continue;
    const doubleQuoted = match[4];
    const singleQuoted = match[5];
    const assignedValue = doubleQuoted ?? singleQuoted ?? match[6] ?? "";
    const leadingBoundary = match[0][0] ?? "";
    const keyPosition =
      (match.index ?? 0) + (leadingBoundary.length > 0 ? 1 : 0);
    const isSourceExpressionContext =
      isJavascriptSourceContext && isJavaScriptCodePosition(text, keyPosition);
    if (
      literalSecretValue(
        assignedValue,
        doubleQuoted !== undefined || singleQuoted !== undefined,
        isSourceExpressionContext,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Recognized Secret Textを含むか判定する。
 *
 * @responsibility Recognized Secret Textの探索範囲、包含条件、判定結果境界を所有する。
 * @trace ARCH-000014
 * @input value: string | Uint8Array
 * @returns containsRecognizedSecretTextの計算結果を返す。
 * @precondition 「value: string | Uint8Array」がcontainsRecognizedSecretTextの入力契約を満たす。
 * @postcondition containsRecognizedSecretTextの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretTextは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretTextはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretTextは共有非同期状態を持たない同期処理である。
 */
export function containsRecognizedSecretText(value: string | Uint8Array) {
  return containsRecognizedSecretTextInContext(value, false);
}

/**
 * Recognized Source Code Pathかを判定する。
 *
 * @responsibility Recognized Source Code Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input relativePath: string
 * @returns isRecognizedSourceCodePathの計算結果を返す。
 * @precondition 「relativePath: string」がisRecognizedSourceCodePathの入力契約を満たす。
 * @postcondition isRecognizedSourceCodePathの責務を完了した結果だけを返す。
 * @effect N/A: isRecognizedSourceCodePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecognizedSourceCodePathは独自の失敗分岐を所有しない。
 * @invariant isRecognizedSourceCodePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecognizedSourceCodePathはProcess内の同一Subsystemで完結する。
 * @security isRecognizedSourceCodePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecognizedSourceCodePathは共有非同期状態を持たない同期処理である。
 */
function isRecognizedSourceCodePath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const extensionIndex = basename.lastIndexOf(".");
  return (
    extensionIndex >= 0 &&
    SOURCE_CODE_EXTENSIONS.has(basename.slice(extensionIndex))
  );
}

/**
 * Recognized Secret Bearing Pathかを判定する。
 *
 * @responsibility Recognized Secret Bearing Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input relativePath: string
 * @returns isRecognizedSecretBearingPathの計算結果を返す。
 * @precondition 「relativePath: string」がisRecognizedSecretBearingPathの入力契約を満たす。
 * @postcondition isRecognizedSecretBearingPathの責務を完了した結果だけを返す。
 * @effect N/A: isRecognizedSecretBearingPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecognizedSecretBearingPathは独自の失敗分岐を所有しない。
 * @invariant isRecognizedSecretBearingPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecognizedSecretBearingPathはProcess内の同一Subsystemで完結する。
 * @security isRecognizedSecretBearingPathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecognizedSecretBearingPathは共有非同期状態を持たない同期処理である。
 */
export function isRecognizedSecretBearingPath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (
    basename.startsWith(".env.") &&
    ![...NON_SECRET_ENV_SUFFIXES].some((suffix) => basename.endsWith(suffix))
  ) {
    return true;
  }
  if (
    isPathOrNestedSuffix(normalized, ".aws/credentials") ||
    isPathOrNestedSuffix(normalized, ".docker/config.json") ||
    isPathOrNestedSuffix(
      normalized,
      ".config/gcloud/application_default_credentials.json",
    ) ||
    (/(?:^|\/)\.ssh\/id_[a-z0-9_]+$/u.test(normalized) &&
      !normalized.endsWith(".pub"))
  ) {
    return true;
  }
  const extensionIndex = basename.lastIndexOf(".");
  const extension = extensionIndex >= 0 ? basename.slice(extensionIndex) : "";
  return (
    SENSITIVE_BASENAMES.has(basename) || SENSITIVE_EXTENSIONS.has(extension)
  );
}

/**
 * Recognized Secret Scopeを含むか判定する。
 *
 * @responsibility Recognized Secret Scopeの探索範囲、包含条件、判定結果境界を所有する。
 * @trace ARCH-000014
 * @input objective: string、acceptanceCriteria: readonly string[]、allowedPaths: readonly string[]、readPaths: readonly string[]
 * @returns containsRecognizedSecretScopeの計算結果を返す。
 * @precondition 「objective: string、acceptanceCriteria: readonly string[]、allowedPaths: readonly string[]、readPaths: readonly string[]」がcontainsRecognizedSecretScopeの入力契約を満たす。
 * @postcondition containsRecognizedSecretScopeの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretScopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretScopeは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretScopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretScopeはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretScopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretScopeは共有非同期状態を持たない同期処理である。
 */
export function containsRecognizedSecretScope(
  objective: string,
  acceptanceCriteria: readonly string[],
  allowedPaths: readonly string[],
  readPaths: readonly string[],
) {
  return (
    containsRecognizedSecretText(objective) ||
    acceptanceCriteria.some(containsRecognizedSecretText) ||
    allowedPaths.some((relativePath) =>
      containsRecognizedSecretMaterial(relativePath, ""),
    ) ||
    readPaths.some((relativePath) =>
      containsRecognizedSecretMaterial(relativePath, ""),
    )
  );
}

/**
 * Recognized Secret Materialを含むか判定する。
 *
 * @responsibility Recognized Secret Materialの探索範囲、包含条件、判定結果境界を所有する。
 * @trace ARCH-000014
 * @input relativePath: string | null、value: string | Uint8Array
 * @returns containsRecognizedSecretMaterialの計算結果を返す。
 * @precondition 「relativePath: string | null、value: string | Uint8Array」がcontainsRecognizedSecretMaterialの入力契約を満たす。
 * @postcondition containsRecognizedSecretMaterialの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretMaterialは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretMaterialは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretMaterialは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: containsRecognizedSecretMaterialはProcess内の同一Subsystemで完結する。
 * @security containsRecognizedSecretMaterialはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretMaterialは共有非同期状態を持たない同期処理である。
 */
export function containsRecognizedSecretMaterial(
  relativePath: string | null,
  value: string | Uint8Array,
) {
  return (
    (relativePath !== null &&
      (isRecognizedSecretBearingPath(relativePath) ||
        relativePath
          .replaceAll("\\", "/")
          .split("/")
          .some(containsRecognizedSecretPathSegment))) ||
    containsRecognizedSecretTextInContext(
      value,
      relativePath !== null && isRecognizedSourceCodePath(relativePath),
    )
  );
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidObjectiveTextの入力契約を満たす。
 * @postcondition validObjectiveTextの責務を完了した結果だけを返す。
 * @effect N/A: validObjectiveTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validObjectiveTextは独自の失敗分岐を所有しない。
 * @invariant validObjectiveTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validObjectiveTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validObjectiveTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validObjectiveTextは共有非同期状態を持たない同期処理である。
 */
function validObjectiveText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown」がinspectObjectiveStringsの入力契約を満たす。
 * @postcondition inspectObjectiveStringsの責務を完了した結果だけを返す。
 * @effect N/A: inspectObjectiveStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectObjectiveStringsは独自の失敗分岐を所有しない。
 * @invariant inspectObjectiveStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectObjectiveStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectObjectiveStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectObjectiveStringsは共有非同期状態を持たない同期処理である。
 */
function inspectObjectiveStrings(value: unknown): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, Number.MAX_SAFE_INTEGER);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    !snapshot.value.every((entry) => validObjectiveText(entry)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

function inspectExplicitChoice(
  candidate: unknown,
): NonNullable<CoordinatorObjectiveRequest["choice"]> | null {
  const value = snapshotPlainRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (
    !value ||
    (value.provider !== "codex" && value.provider !== "claude") ||
    typeof value.model !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.model) ||
    typeof value.effort !== "string" ||
    !["low", "medium", "high", "xhigh", "max"].includes(value.effort)
  )
    return null;
  return Object.freeze({
    provider: value.provider,
    model: value.model,
    effort: value.effort as NonNullable<
      CoordinatorObjectiveRequest["choice"]
    >["effort"],
  });
}

const PROVIDER_TURN_OBSERVATION_KEYS = new Set([
  "provider",
  "taskRole",
  "requestedMaximumTurns",
  "providerReportedTurns",
]);

const REVIEWER_FINDING_DIAGNOSTIC_KEYS = new Set([
  "severity",
  "path",
  "category",
  "criterionNumber",
  "messageSha256",
]);

const REVIEWER_PROJECTION_KEYS = new Set([
  "status",
  "candidateSnapshotId",
  "projectionHash",
  "withheldFileCount",
  "totalBytes",
  "files",
  "workspaceReview",
]);

/**
 * own Plain Data Valueを決定する。
 *
 * @responsibility own Plain Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、key: string
 * @returns ownPlainDataValueの計算結果を返す。
 * @precondition 「value: unknown、key: string」がownPlainDataValueの入力契約を満たす。
 * @postcondition ownPlainDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownPlainDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownPlainDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownPlainDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownPlainDataValueはProcess内の同一Subsystemで完結する。
 * @security ownPlainDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownPlainDataValueは共有非同期状態を持たない同期処理である。
 */
function ownPlainDataValue(value: unknown, key: string): unknown {
  if (!isPlainContainer(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return dataDescriptor(descriptor) ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Provider Turn Observationを公開結果へ投影する。
 *
 * @responsibility Provider Turn Observationの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectProviderTurnObservationの計算結果を返す。
 * @precondition 「value: unknown」がprojectProviderTurnObservationの入力契約を満たす。
 * @postcondition projectProviderTurnObservationの責務を完了した結果だけを返す。
 * @effect N/A: projectProviderTurnObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectProviderTurnObservationは独自の失敗分岐を所有しない。
 * @invariant projectProviderTurnObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectProviderTurnObservationはProcess内の同一Subsystemで完結する。
 * @security projectProviderTurnObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectProviderTurnObservationは共有非同期状態を持たない同期処理である。
 */
export function projectProviderTurnObservation(value: unknown) {
  const record = snapshotPlainRecord(value, PROVIDER_TURN_OBSERVATION_KEYS);
  if (!record) return null;
  const provider = record.provider;
  const taskRole = record.taskRole;
  const requestedMaximumTurns = record.requestedMaximumTurns;
  const providerReportedTurns = record.providerReportedTurns;
  if (
    provider !== "claude" ||
    (taskRole !== "executor" && taskRole !== "reviewer") ||
    !Number.isSafeInteger(requestedMaximumTurns) ||
    (requestedMaximumTurns as number) < 1 ||
    !Number.isSafeInteger(providerReportedTurns) ||
    (providerReportedTurns as number) < 1 ||
    (taskRole === "executor"
      ? (requestedMaximumTurns as number) < 8
      : (requestedMaximumTurns as number) < 4) ||
    (requestedMaximumTurns as number) > 16
  )
    return null;
  return Object.freeze({
    provider,
    taskRole,
    requestedMaximumTurns: requestedMaximumTurns as number,
    providerReportedTurns: providerReportedTurns as number,
  });
}

/**
 * sha256 Valueを決定する。
 *
 * @responsibility sha256 Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がsha256Valueの入力契約を満たす。
 * @postcondition sha256Valueの責務を完了した結果だけを返す。
 * @effect N/A: sha256Valueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sha256Valueは独自の失敗分岐を所有しない。
 * @invariant sha256Valueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sha256ValueはProcess内の同一Subsystemで完結する。
 * @security sha256ValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sha256Valueは共有非同期状態を持たない同期処理である。
 */
function sha256Value(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/**
 * Reviewer 結果 Diagnosticsを公開結果へ投影する。
 *
 * @responsibility Reviewer 結果 Diagnosticsの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectReviewerResultDiagnosticsの計算結果を返す。
 * @precondition 「value: unknown」がprojectReviewerResultDiagnosticsの入力契約を満たす。
 * @postcondition projectReviewerResultDiagnosticsの責務を完了した結果だけを返す。
 * @effect N/A: projectReviewerResultDiagnosticsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectReviewerResultDiagnosticsは独自の失敗分岐を所有しない。
 * @invariant projectReviewerResultDiagnosticsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectReviewerResultDiagnosticsはProcess内の同一Subsystemで完結する。
 * @security projectReviewerResultDiagnosticsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectReviewerResultDiagnosticsは共有非同期状態を持たない同期処理である。
 */
export function projectReviewerResultDiagnostics(value: unknown) {
  const decision = ownPlainDataValue(value, "decision");
  const findingCount = ownPlainDataValue(value, "findingCount");
  const diagnostics = snapshotPlainArray<unknown>(
    ownPlainDataValue(value, "findingDiagnostics"),
    Number.MAX_SAFE_INTEGER,
  );
  if (
    (decision !== "approved" && decision !== "changes_requested") ||
    !Number.isSafeInteger(findingCount) ||
    (findingCount as number) < 0 ||
    diagnostics.status !== "ok" ||
    diagnostics.value.length !== findingCount
  )
    return null;
  const projectedDiagnostics = diagnostics.value.map((item) => {
    const record = snapshotPlainRecord(item, REVIEWER_FINDING_DIAGNOSTIC_KEYS);
    if (
      !record ||
      typeof record.severity !== "string" ||
      typeof record.path !== "string" ||
      typeof record.category !== "string" ||
      !Number.isSafeInteger(record.criterionNumber) ||
      !sha256Value(record.messageSha256)
    )
      return null;
    return Object.freeze({
      severity: record.severity,
      path: record.path,
      category: record.category,
      criterionNumber: record.criterionNumber,
      messageSha256: record.messageSha256,
    });
  });
  if (projectedDiagnostics.some((item) => item === null)) return null;
  return Object.freeze({
    decision,
    findingCount: findingCount as number,
    findingDiagnostics: Object.freeze(projectedDiagnostics),
  });
}

/**
 * Executor 結果 Diagnosticsを公開結果へ投影する。
 *
 * @responsibility Executor 結果 Diagnosticsの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectExecutorResultDiagnosticsの計算結果を返す。
 * @precondition 「value: unknown」がprojectExecutorResultDiagnosticsの入力契約を満たす。
 * @postcondition projectExecutorResultDiagnosticsの責務を完了した結果だけを返す。
 * @effect N/A: projectExecutorResultDiagnosticsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectExecutorResultDiagnosticsは独自の失敗分岐を所有しない。
 * @invariant projectExecutorResultDiagnosticsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectExecutorResultDiagnosticsはProcess内の同一Subsystemで完結する。
 * @security projectExecutorResultDiagnosticsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectExecutorResultDiagnosticsは共有非同期状態を持たない同期処理である。
 */
export function projectExecutorResultDiagnostics(
  value: unknown,
  executionObservation: CompletionResult<"attempt">["providerExecutionObservation"] = null,
) {
  const status = ownPlainDataValue(value, "status");
  const changedPaths = snapshotPlainArray<unknown>(
    ownPlainDataValue(value, "changedPaths"),
    Number.MAX_SAFE_INTEGER,
  );
  const verificationCount = ownPlainDataValue(value, "verificationCount");
  if (
    status !== "completed" ||
    changedPaths.status !== "ok" ||
    !changedPaths.value.every((path) => typeof path === "string") ||
    !Number.isSafeInteger(verificationCount) ||
    (verificationCount as number) < 0
  )
    return null;
  return Object.freeze({
    status,
    changedPaths: Object.freeze([...changedPaths.value] as string[]),
    verificationCount: verificationCount as number,
    ...(executionObservation
      ? { providerExecutionObservation: executionObservation }
      : {}),
  });
}

/**
 * Reviewer Projection Evidenceを公開結果へ投影する。
 *
 * @responsibility Reviewer Projection Evidenceの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectReviewerProjectionEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がprojectReviewerProjectionEvidenceの入力契約を満たす。
 * @postcondition projectReviewerProjectionEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: projectReviewerProjectionEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectReviewerProjectionEvidenceは独自の失敗分岐を所有しない。
 * @invariant projectReviewerProjectionEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectReviewerProjectionEvidenceはProcess内の同一Subsystemで完結する。
 * @security projectReviewerProjectionEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectReviewerProjectionEvidenceは共有非同期状態を持たない同期処理である。
 */
export function projectReviewerProjectionEvidence(value: unknown) {
  const record = snapshotPlainRecord(value, REVIEWER_PROJECTION_KEYS);
  const files = record
    ? snapshotPlainArray<unknown>(record.files, Number.MAX_SAFE_INTEGER)
    : null;
  if (
    record?.status !== "projected" ||
    record.workspaceReview !== true ||
    typeof record.candidateSnapshotId !== "string" ||
    !/^[a-f0-9]{64}$/u.test(record.candidateSnapshotId) ||
    !sha256Value(record.projectionHash) ||
    !Number.isSafeInteger(record.withheldFileCount) ||
    (record.withheldFileCount as number) < 0 ||
    record.totalBytes !== 0 ||
    files?.status !== "ok" ||
    files.value.length !== 0
  )
    return null;
  return Object.freeze({
    candidateSnapshotId: record.candidateSnapshotId,
    projectionHash: record.projectionHash,
    withheldFileCount: record.withheldFileCount,
    totalBytes: record.totalBytes,
    files: files.value,
    contentReported: false,
  });
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum: number
 * @returns value is stringを返す。
 * @precondition 「value: unknown、maximum: number」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security validTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !value.includes("\0")
  );
}

/**
 * optional Identityを決定する。
 *
 * @responsibility optional Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is string | nullを返す。
 * @precondition 「value: unknown」がoptionalIdentityの入力契約を満たす。
 * @postcondition optionalIdentityの責務を完了した結果だけを返す。
 * @effect N/A: optionalIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: optionalIdentityは独自の失敗分岐を所有しない。
 * @invariant optionalIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security optionalIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: optionalIdentityは共有非同期状態を持たない同期処理である。
 */
function optionalIdentity(value: unknown): value is string | null {
  return value === null || validText(value, 512);
}

/**
 * Opaque Capabilityかを判定する。
 *
 * @responsibility Opaque Capabilityの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisOpaqueCapabilityの入力契約を満たす。
 * @postcondition isOpaqueCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: isOpaqueCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isOpaqueCapabilityは独自の失敗分岐を所有しない。
 * @invariant isOpaqueCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isOpaqueCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isOpaqueCapabilityは共有非同期状態を持たない同期処理である。
 */
function isOpaqueCapability(value: unknown): value is object {
  return typeof value === "object" && value !== null && !types.isProxy(value);
}

/**
 * Started Taskを観測する。
 *
 * @responsibility Started Taskの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns Readonly<{ controlCapability: object; completion: Promise<unknown>; }> | nullを返す。
 * @precondition 「value: unknown」がinspectStartedTaskの入力契約を満たす。
 * @postcondition inspectStartedTaskの責務を完了した結果だけを返す。
 * @effect N/A: inspectStartedTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectStartedTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectStartedTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectStartedTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency inspectStartedTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function inspectStartedTask(value: unknown): Readonly<{
  controlCapability: object;
  completion: Promise<unknown>;
}> | null {
  try {
    if (!isPlainContainer(value)) return null;
    const controlCapability = ownDataProperty(value, "controlCapability");
    const completion = ownDataProperty(value, "completion");
    if (
      ownDataProperty(value, "status") !== "started" ||
      !isOpaqueCapability(controlCapability) ||
      !(completion instanceof Promise)
    )
      return null;
    return Object.freeze({ controlCapability, completion });
  } catch {
    return null;
  }
}

/**
 * Completion 記録を観測する。
 *
 * @responsibility Completion 記録の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns Readonly<{ status: "completed" | "blocked"; reason: string; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations: readonly CoordinatorSingleTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }> | nullを返す。
 * @precondition 「value: unknown」がinspectCompletionRecordの入力契約を満たす。
 * @postcondition inspectCompletionRecordの責務を完了した結果だけを返す。
 * @effect N/A: inspectCompletionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectCompletionRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectCompletionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectCompletionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectCompletionRecordは共有非同期状態を持たない同期処理である。
 */
export function inspectCompletionRecord(value: unknown): Readonly<{
  status: "completed" | "blocked";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations: readonly CoordinatorSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
  workspaceResult?: WorkspaceResult;
}> | null {
  try {
    if (!isPlainContainer(value)) return null;
    const status = ownDataProperty(value, "status");
    const reason = ownDataProperty(value, "reason");
    const cleanupConfirmed = ownDataProperty(value, "cleanupConfirmed");
    const manualRecoveryRequired = ownDataProperty(
      value,
      "manualRecoveryRequired",
    );
    const processRestartRequired = ownDataProperty(
      value,
      "processRestartRequired",
    );
    const candidateId = ownDataProperty(value, "candidateId");
    const hostRecoveryId = ownDataProperty(value, "hostRecoveryId");
    const candidateRecoveryId = ownDataProperty(value, "candidateRecoveryId");
    const candidateStoreRecoveryId = ownDataProperty(
      value,
      "candidateStoreRecoveryId",
    );
    const rawDockerRecoveryIds = ownDataProperty(value, "dockerRecoveryIds");
    const executorProviderDescriptor = Object.getOwnPropertyDescriptor(
      value,
      "executorProvider",
    );
    if (
      executorProviderDescriptor !== undefined &&
      !Object.hasOwn(executorProviderDescriptor, "value")
    )
      return null;
    const executorProvider = ownDataProperty(value, "executorProvider");
    const hasWorkspaceResult = Object.hasOwn(value, "workspaceResult");
    const workspaceResult = hasWorkspaceResult
      ? inspectWorkspaceResult(ownDataProperty(value, "workspaceResult"))
      : undefined;
    if (
      hasWorkspaceResult &&
      (!workspaceResult ||
        ownDataProperty(value, "canonicalRepositoryChanged") !==
          workspaceResult.canonicalRepositoryChanged)
    )
      return null;
    // The current completion record never carries status "cancelled": effect-era
    // cancellation settles as "blocked" with a Coordinator cancellation
    // reason, and accepting values the producer cannot emit would widen the
    // observation surface beyond the real contract.
    if (
      (status !== "completed" && status !== "blocked") ||
      !validText(reason, 256) ||
      typeof cleanupConfirmed !== "boolean" ||
      typeof manualRecoveryRequired !== "boolean" ||
      typeof processRestartRequired !== "boolean" ||
      !optionalIdentity(candidateId) ||
      !optionalIdentity(hostRecoveryId) ||
      !optionalIdentity(candidateRecoveryId) ||
      !optionalIdentity(candidateStoreRecoveryId) ||
      !Array.isArray(rawDockerRecoveryIds) ||
      types.isProxy(rawDockerRecoveryIds) ||
      (executorProvider !== undefined &&
        executorProvider !== "codex" &&
        executorProvider !== "claude" &&
        !(status === "blocked" && executorProvider === null)) ||
      (status === "completed" && cleanupConfirmed !== true)
    )
      return null;
    const dockerRecoveryIds: string[] = [];
    for (let index = 0; index < rawDockerRecoveryIds.length; index += 1) {
      const id = ownDataProperty(rawDockerRecoveryIds, String(index));
      if (!isCoordinatorRecoveryIdentity(id)) return null;
      dockerRecoveryIds.push(id);
    }
    const recoveryObligations = [
      ...(typeof hostRecoveryId === "string"
        ? [{ kind: "host" as const, recoveryId: hostRecoveryId }]
        : []),
      ...dockerRecoveryIds.map((recoveryId) => ({
        kind: "docker" as const,
        recoveryId,
      })),
      ...(typeof candidateRecoveryId === "string"
        ? [{ kind: "candidate" as const, recoveryId: candidateRecoveryId }]
        : []),
      ...(typeof candidateStoreRecoveryId === "string"
        ? [
            {
              kind: "candidate_store" as const,
              recoveryId: candidateStoreRecoveryId,
            },
          ]
        : []),
    ];
    const identities = recoveryObligations.map(
      (entry) => `${entry.kind}\0${entry.recoveryId}`,
    );
    if (new Set(identities).size !== identities.length) return null;
    const recoveryIds = [
      ...new Set(recoveryObligations.map((entry) => entry.recoveryId)),
    ];
    if (recoveryIds.some((id) => !isCoordinatorRecoveryIdentity(id)))
      return null;
    return Object.freeze({
      status,
      reason,
      cleanupConfirmed,
      manualRecoveryRequired,
      processRestartRequired,
      candidateId,
      recoveryIds: Object.freeze(recoveryIds),
      recoveryObligations: Object.freeze(
        recoveryObligations.map((entry) => Object.freeze(entry)),
      ),
      ...(executorProvider === "codex" || executorProvider === "claude"
        ? { executorProvider }
        : {}),
      ...(workspaceResult ? { workspaceResult } : {}),
    });
  } catch {
    return null;
  }
}

/**
 * docker-cleanup-eligibilityで使用するRaw Docker 回復 Projectionの値契約を定義する。
 *
 * @responsibility Raw Docker 回復 ProjectionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RawDockerRecoveryProjectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RawDockerRecoveryProjectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: RawDockerRecoveryProjectionの宣言は外部境界を開かない。
 * @security N/A: RawDockerRecoveryProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RawDockerRecoveryProjectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RawDockerRecoveryProjection = Readonly<{
  singularPresent: boolean;
  singular: unknown;
  pluralPresent: boolean;
  plural: unknown;
}>;

const MAX_RECOVERY_ID_LENGTH = 512;

/**
 * recovery Idを決定する。
 *
 * @responsibility recovery Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がrecoveryIdの入力契約を満たす。
 * @postcondition recoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: recoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryIdは独自の失敗分岐を所有しない。
 * @invariant recoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryIdはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryIdは共有非同期状態を持たない同期処理である。
 */
function recoveryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_RECOVERY_ID_LENGTH
  );
}

/**
 * Dense String Arrayが完全一致するか判定する。
 *
 * @responsibility Dense String Arrayの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns exactDenseStringArrayの計算結果を返す。
 * @precondition 「value: unknown」がexactDenseStringArrayの入力契約を満たす。
 * @postcondition exactDenseStringArrayの責務を完了した結果だけを返す。
 * @effect N/A: exactDenseStringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactDenseStringArrayは独自の失敗分岐を所有しない。
 * @invariant exactDenseStringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactDenseStringArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: exactDenseStringArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactDenseStringArrayは共有非同期状態を持たない同期処理である。
 */
function exactDenseStringArray(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    types.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return null;
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = new Set<PropertyKey>([
    "length",
    ...Array.from({ length: value.length }, (_value, index) => String(index)),
  ]);
  if (
    ownKeys.length !== expectedKeys.size ||
    ownKeys.some((key) => !expectedKeys.has(key))
  )
    return null;
  const resultItems: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !recoveryId(descriptor.value)
    )
      return null;
    resultItems.push(descriptor.value);
  }
  if (new Set(resultItems).size !== resultItems.length) return null;
  return Object.freeze(resultItems);
}

/**
 * Plain 記録 Arrayが完全一致するか判定する。
 *
 * @responsibility Plain 記録 Arrayの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedRecordKeys: ReadonlySet<string>
 * @returns exactPlainRecordArrayの計算結果を返す。
 * @precondition 「value: unknown、expectedRecordKeys: readonly string[]」がexactPlainRecordArrayの入力契約を満たす。
 * @postcondition exactPlainRecordArrayの責務を完了した結果だけを返す。
 * @effect N/A: exactPlainRecordArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactPlainRecordArrayは独自の失敗分岐を所有しない。
 * @invariant exactPlainRecordArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactPlainRecordArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: exactPlainRecordArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactPlainRecordArrayは共有非同期状態を持たない同期処理である。
 */
function exactPlainRecordArray(
  value: unknown,
  expectedRecordKeys: ReadonlySet<string>,
) {
  if (
    !value ||
    typeof value !== "object" ||
    types.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return null;
  const keys = Reflect.ownKeys(value);
  const expectedKeys = new Set<PropertyKey>([
    "length",
    ...Array.from({ length: value.length }, (_value, index) => String(index)),
  ]);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => !expectedKeys.has(key))
  )
    return null;
  const snapshotItems: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) return null;
    const record = snapshotPlainRecord(descriptor.value, expectedRecordKeys);
    if (!record) return null;
    snapshotItems.push(record);
  }
  return Object.freeze(snapshotItems);
}

/**
 * 入力を所有Snapshotへ変換する。
 *
 * @responsibility 入力の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns captureManagedDockerCleanupInputの計算結果を返す。
 * @precondition 「value: unknown」がcaptureManagedDockerCleanupInputの入力契約を満たす。
 * @postcondition captureManagedDockerCleanupInputの責務を完了した結果だけを返す。
 * @effect N/A: captureManagedDockerCleanupInputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: captureManagedDockerCleanupInputは独自の失敗分岐を所有しない。
 * @invariant captureManagedDockerCleanupInputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: captureManagedDockerCleanupInputはProcess内の同一Subsystemで完結する。
 * @security N/A: captureManagedDockerCleanupInputはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: captureManagedDockerCleanupInputは共有非同期状態を持たない同期処理である。
 */
function captureManagedDockerCleanupInput(value: unknown) {
  const input = snapshotPlainRecord(
    value,
    new Set(["raw", "handoffs", "finalizations"]),
  );
  if (!input) return null;
  const raw = snapshotPlainRecord(
    input.raw,
    new Set(["singularPresent", "singular", "pluralPresent", "plural"]),
  );
  const handoffs = exactPlainRecordArray(
    input.handoffs,
    new Set(["state", "recoveryId", "capability"]),
  );
  const finalizations = exactPlainRecordArray(
    input.finalizations,
    new Set(["recoveryId", "capability"]),
  );
  return raw && handoffs && finalizations
    ? Object.freeze({ raw, handoffs, finalizations })
    : null;
}

/**
 * canonical Raw Idsを決定する。
 *
 * @responsibility canonical Raw Idsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input raw: RawDockerRecoveryProjection
 * @returns canonicalRawIdsの計算結果を返す。
 * @precondition 「raw: RawDockerRecoveryProjection」がcanonicalRawIdsの入力契約を満たす。
 * @postcondition canonicalRawIdsの責務を完了した結果だけを返す。
 * @effect N/A: canonicalRawIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalRawIdsは独自の失敗分岐を所有しない。
 * @invariant canonicalRawIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalRawIdsはProcess内の同一Subsystemで完結する。
 * @security N/A: canonicalRawIdsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: canonicalRawIdsは共有非同期状態を持たない同期処理である。
 */
function canonicalRawIds(raw: RawDockerRecoveryProjection) {
  if (!raw.singularPresent || !raw.pluralPresent) return null;
  const singular =
    raw.singular === null
      ? null
      : recoveryId(raw.singular)
        ? raw.singular
        : undefined;
  if (singular === undefined) return null;
  const pluralItems = exactDenseStringArray(raw.plural);
  if (!pluralItems) return null;
  if (pluralItems.length === 0 && singular !== null) return null;
  if (pluralItems.length === 1 && singular !== pluralItems[0]) return null;
  if (pluralItems.length > 1 && singular !== null) return null;
  return Object.freeze(pluralItems);
}

/**
 * docker-cleanup-eligibilityを評価する。
 *
 * @responsibility docker-cleanup-eligibilityの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input inputValue: unknown
 * @returns evaluateの計算結果を返す。
 * @precondition 「inputValue: unknown」がevaluateの入力契約を満たす。
 * @postcondition evaluateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateは独自の失敗分岐を所有しない。
 * @invariant evaluateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateはProcess内の同一Subsystemで完結する。
 * @security N/A: evaluateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: evaluateは共有非同期状態を持たない同期処理である。
 */
function evaluateManagedDockerCleanup(inputValue: unknown) {
  const input = captureManagedDockerCleanupInput(inputValue);
  if (!input) return Object.freeze({ eligible: false, reason: "raw_invalid" });
  const rawIds = canonicalRawIds(input.raw as RawDockerRecoveryProjection);
  if (!rawIds) return Object.freeze({ eligible: false, reason: "raw_invalid" });
  const pendingItems = input.handoffs.filter(
    (handoff) => handoff.state !== "finalized",
  );
  const pendingIds = new Set<string>();
  const pendingCapabilities = new Set<object>();
  for (const handoff of pendingItems) {
    if (
      handoff.state !== "finalizable" ||
      !recoveryId(handoff.recoveryId) ||
      typeof handoff.capability !== "object" ||
      handoff.capability === null ||
      pendingIds.has(handoff.recoveryId) ||
      pendingCapabilities.has(handoff.capability)
    )
      return Object.freeze({ eligible: false, reason: "handoff_invalid" });
    const exactItems = input.finalizations.filter(
      (candidate) =>
        candidate.recoveryId === handoff.recoveryId &&
        candidate.capability === handoff.capability,
    );
    const isConflicting = input.finalizations.some(
      (candidate) =>
        (candidate.recoveryId === handoff.recoveryId ||
          candidate.capability === handoff.capability) &&
        (candidate.recoveryId !== handoff.recoveryId ||
          candidate.capability !== handoff.capability),
    );
    if (exactItems.length !== 1 || isConflicting)
      return Object.freeze({
        eligible: false,
        reason: "finalization_mismatch",
      });
    pendingIds.add(handoff.recoveryId);
    pendingCapabilities.add(handoff.capability);
  }
  if (
    input.finalizations.length !== pendingItems.length ||
    rawIds.length !== pendingIds.size ||
    rawIds.some((id) => !pendingIds.has(id))
  )
    return Object.freeze({ eligible: false, reason: "set_mismatch" });
  return Object.freeze({ eligible: true, reason: "exact_match" });
}

/**
 * Managed Docker 清掃 Eligibilityを評価する。
 *
 * @responsibility Managed Docker 清掃 Eligibilityの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input input: unknown
 * @returns evaluateManagedDockerCleanupEligibilityの計算結果を返す。
 * @precondition 「input: unknown」がevaluateManagedDockerCleanupEligibilityの入力契約を満たす。
 * @postcondition evaluateManagedDockerCleanupEligibilityの責務を完了した結果だけを返す。
 * @effect N/A: evaluateManagedDockerCleanupEligibilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateManagedDockerCleanupEligibilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateManagedDockerCleanupEligibilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateManagedDockerCleanupEligibilityはProcess内の同一Subsystemで完結する。
 * @security N/A: evaluateManagedDockerCleanupEligibilityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: evaluateManagedDockerCleanupEligibilityは共有非同期状態を持たない同期処理である。
 */
export function evaluateManagedDockerCleanupEligibility(input: unknown) {
  try {
    return evaluateManagedDockerCleanup(input);
  } catch {
    return Object.freeze({ eligible: false, reason: "raw_invalid" });
  }
}

/**
 * 回復 Reasonを安全条件の下で処理する。
 *
 * @responsibility 回復 Reasonの安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、fallback: string
 * @returns safeRecoveryReasonの計算結果を返す。
 * @precondition 「error: unknown、fallback: string」がsafeRecoveryReasonの入力契約を満たす。
 * @postcondition safeRecoveryReasonの責務を完了した結果だけを返す。
 * @effect N/A: safeRecoveryReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: safeRecoveryReasonは独自の失敗分岐を所有しない。
 * @invariant safeRecoveryReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: safeRecoveryReasonはProcess内の同一Subsystemで完結する。
 * @security safeRecoveryReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: safeRecoveryReasonは共有非同期状態を持たない同期処理である。
 */
export function safeRecoveryReason(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return /^(?:docker_task|host_recovery)_[a-z0-9_]{1,120}$/u.test(message)
    ? message
    : fallback;
}

const TASK_STAGE_REQUEST_KEYS = new Set([
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
]);

/**
 * Coordinator Task Requestを所有Snapshotへ変換する。
 *
 * @responsibility Coordinator Task Requestの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns 正常時はacceptedとSnapshot、認識済み秘密情報はblocked、それ以外の入力不正はnull。
 * @precondition 任意値として受け取り、検査前には信頼しない。
 * @postcondition 明示fieldと配列の実体を検査し、許可Pathを読取り範囲へ含める。選定は別の確定済み入力として扱う。
 * @effect N/A: snapshotCoordinatorTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 不正な形はnull、認識済み秘密情報は固定blocked結果で拒否する。
 * @invariant snapshotCoordinatorTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotCoordinatorTaskRequestはProcess内の同一Subsystemで完結する。
 * @security snapshotCoordinatorTaskRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotCoordinatorTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function snapshotCoordinatorTaskRequest(rawRequest: unknown) {
  const request = snapshotPlainRecord(rawRequest, TASK_STAGE_REQUEST_KEYS);
  const acceptance = request
    ? snapshotPlainArray<string>(
        request.acceptanceCriteria,
        Number.MAX_SAFE_INTEGER,
      )
    : null;
  const paths = request
    ? snapshotPlainArray<string>(request.allowedPaths, Number.MAX_SAFE_INTEGER)
    : null;
  const requestedReadPaths =
    request && request.readPaths !== undefined
      ? snapshotPlainArray<string>(request.readPaths, Number.MAX_SAFE_INTEGER)
      : paths;
  if (
    !request ||
    typeof request.objective !== "string" ||
    request.objective.length === 0 ||
    acceptance?.status !== "ok" ||
    paths?.status !== "ok" ||
    requestedReadPaths?.status !== "ok" ||
    acceptance.value.length === 0 ||
    paths.value.length === 0 ||
    !acceptance.value.every((value) => typeof value === "string") ||
    !paths.value.every((value) => typeof value === "string") ||
    !requestedReadPaths.value.every((value) => typeof value === "string")
  ) {
    return null;
  }
  if (paths.value.includes(".") || requestedReadPaths.value.includes("."))
    return null;
  const readPaths = [
    ...new Map(
      [...requestedReadPaths.value, ...paths.value].map((value) => [
        value.toUpperCase(),
        value,
      ]),
    ).values(),
  ];
  const normalized = Object.freeze({
    ...request,
    objective: request.objective,
    acceptanceCriteria: acceptance.value,
    allowedPaths: paths.value,
    readPaths: Object.freeze(readPaths),
    workClass: request.workClass,
    planState: request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: request.isLocalCandidateOnly,
    hasUnresolvedDirection: request.hasUnresolvedDirection,
    requiresCrossContextAlignment: request.requiresCrossContextAlignment,
  });
  return containsRecognizedSecretScope(
    normalized.objective,
    normalized.acceptanceCriteria,
    normalized.allowedPaths,
    normalized.readPaths,
  )
    ? Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_task_scope_recognized_secret_rejected" as const,
      })
    : Object.freeze({ status: "accepted" as const, request: normalized });
}

const REQUIRED_REQUEST_KEYS = Object.freeze([
  "operation",
  "plan",
  "taskInputs",
  "requestId",
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "maximumConcurrency",
  "maximumReplans",
  "originLane",
  "adoptResult",
] as const);

const OPTIONAL_REQUEST_KEYS = Object.freeze([
  "workType",
  "choice",
  "workspaceId",
] as const);

const requestKeySets = Object.freeze(
  Array.from(
    { length: 2 ** OPTIONAL_REQUEST_KEYS.length },
    (_entry, mask) => mask,
  ).map(
    (mask) =>
      new Set([
        ...REQUIRED_REQUEST_KEYS,
        ...OPTIONAL_REQUEST_KEYS.filter(
          (_optional, index) => (mask & (1 << index)) !== 0,
        ),
      ]),
  ),
);

/**
 * Coordinator Objective Requestを観測する。
 *
 * @responsibility 閉じたObjective入力を所有Snapshotへ変換し、分類と明示選択の形式を検査する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorObjectiveRequest | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorObjectiveRequestの入力契約を満たす。
 * @postcondition 受理した三項目を独立Snapshotにし、省略された希望を生成しない。
 * @effect N/A: inspectCoordinatorObjectiveRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorObjectiveRequestは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorObjectiveRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorObjectiveRequestはProcess内の同一Subsystemで完結する。
 * @security 未知field、Accessor、Proxyと不正形式を拒否する。分類参照・技術適合性は選定Resolverが別に検証する。
 * @concurrency N/A: inspectCoordinatorObjectiveRequestは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorObjectiveRequest(
  value: unknown,
): CoordinatorObjectiveRequest | null {
  const requestSnapshot = requestKeySets.reduce<Readonly<
    Record<string, unknown>
  > | null>(
    (accepted, keys) => accepted ?? snapshotPlainRecord(value, keys),
    null,
  );
  if (!requestSnapshot) return null;
  const request: Readonly<Record<string, unknown>> = requestSnapshot;
  const choice = Object.hasOwn(request, "choice")
    ? inspectExplicitChoice(request.choice)
    : undefined;
  const acceptanceCriteria = inspectObjectiveStrings(
    request.acceptanceCriteria,
  );
  const allowedPaths = inspectObjectiveStrings(request.allowedPaths);
  const readPaths = inspectObjectiveStrings(request.readPaths);
  if (
    (request.operation !== "start" && request.operation !== "resume") ||
    !validIdentity(request.requestId) ||
    !validIdentity(request.projectId) ||
    !validIdentity(request.milestoneId) ||
    !validRevision(request.repositoryRevision) ||
    !validObjectiveText(request.objective) ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths ||
    !allowedPaths.every(
      (candidate) => normalizeRepositoryRelativePath(candidate) !== null,
    ) ||
    !readPaths.every(
      (candidate) => normalizeRepositoryRelativePath(candidate) !== null,
    ) ||
    !Number.isSafeInteger(request.maximumConcurrency) ||
    (request.maximumConcurrency as number) < 1 ||
    (request.maximumConcurrency as number) > 5 ||
    !Number.isSafeInteger(request.maximumReplans) ||
    (request.maximumReplans as number) < 0 ||
    (request.maximumReplans as number) > 32 ||
    (request.originLane !== "interactive" &&
      request.originLane !== "scheduled") ||
    typeof request.adoptResult !== "boolean" ||
    (Object.hasOwn(request, "workType") &&
      (typeof request.workType !== "string" ||
        !/^[a-z0-9][a-z0-9._-]*$/u.test(request.workType))) ||
    choice === null ||
    (Object.hasOwn(request, "workspaceId") &&
      (typeof request.workspaceId !== "string" ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
          request.workspaceId,
        )))
  )
    return null;
  const plan = inspectExecutionPlan(request.plan, { allowedPaths });
  if (
    !plan ||
    plan.milestoneAcceptanceCriteria.length !== acceptanceCriteria.length ||
    !plan.milestoneAcceptanceCriteria.every(
      (criterion, index) => criterion === acceptanceCriteria[index],
    )
  )
    return null;
  const taskInputs = inspectCallerTaskInputs(
    plan,
    request.taskInputs,
    readPaths,
  );
  if (!taskInputs) return null;
  return Object.freeze({
    plan,
    taskInputs,
    operation: request.operation,
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    objective: request.objective,
    acceptanceCriteria,
    allowedPaths,
    readPaths,
    maximumConcurrency: request.maximumConcurrency as number,
    maximumReplans: request.maximumReplans as number,
    originLane: request.originLane,
    adoptResult: request.adoptResult,
    ...(typeof request.workType === "string"
      ? { workType: request.workType }
      : {}),
    ...(choice ? { choice } : {}),
    ...(typeof request.workspaceId === "string"
      ? { workspaceId: request.workspaceId }
      : {}),
  });
}

export const COORDINATOR_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/objective-intake/v4" as const;

/**
 * Task定義と実行入力を一対一で固定する。
 * @responsibility 不足・余剰・重複・範囲外を拒否し、指示を自動生成しない。
 * @trace ARCH-000004
 * @input 検査済み計画、未信頼入力、全体の読取り範囲。
 * @returns 同じ宣言順の不変入力、又はnull。
 * @effect 外部Effectなし。
 * @security Getter／Proxyを実行せず、認可や再開権限を発行しない。
 */
function inspectCallerTaskInputs(
  plan: ObjectivePlan,
  candidate: unknown,
  readPaths: readonly string[],
): readonly CallerTaskInput[] | null {
  const entries = snapshotPlainArray(candidate, Number.MAX_SAFE_INTEGER);
  const roots = snapshotPlainArray(readPaths, Number.MAX_SAFE_INTEGER);
  if (
    entries.status !== "ok" ||
    roots.status !== "ok" ||
    entries.value.length !== plan.tasks.length ||
    roots.value.length === 0 ||
    !roots.value.every(
      (root) => typeof root === "string" && repositoryPathWithin(root, [root]),
    )
  )
    return null;
  const ids = new Set(plan.tasks.map((task) => task.id));
  const seen = new Set<string>();
  const inputs: CallerTaskInput[] = [];
  for (const entry of entries.value) {
    const input = snapshotPlainRecord(
      entry,
      new Set(["taskId", "objective", "acceptanceCriteria", "readPaths"]),
    );
    if (
      !input ||
      !validIdentity(input.taskId) ||
      !ids.has(input.taskId) ||
      seen.has(input.taskId) ||
      !validObjectiveText(input.objective)
    )
      return null;
    const acceptanceCriteria = inspectObjectiveStrings(
      input.acceptanceCriteria,
    );
    const paths = inspectObjectiveStrings(input.readPaths);
    if (
      !acceptanceCriteria ||
      !paths?.every((value) =>
        repositoryPathWithin(value, roots.value as readonly string[]),
      )
    )
      return null;
    seen.add(input.taskId);
    inputs.push(
      Object.freeze({
        taskId: input.taskId,
        objective: input.objective,
        acceptanceCriteria,
        readPaths: paths,
      }),
    );
  }
  return Object.freeze(inputs);
}

/**
 * Statesの件数を算出する。
 *
 * @responsibility Statesの計数対象、集計規則、件数結果境界を所有する。
 * @trace ARCH-000004
 * @input values: readonly T[]、states: readonly T[]
 * @returns Readonly<Record<T, number>>を返す。
 * @precondition 「values: readonly T[]、states: readonly T[]」がcountStatesの入力契約を満たす。
 * @postcondition countStatesの責務を完了した結果だけを返す。
 * @effect N/A: countStatesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: countStatesは独自の失敗分岐を所有しない。
 * @invariant countStatesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: countStatesはProcess内の同一Subsystemで完結する。
 * @security N/A: countStatesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: countStatesは共有非同期状態を持たない同期処理である。
 */
function countStates<T extends string>(
  values: readonly T[],
  states: readonly T[],
): Readonly<Record<T, number>> {
  return Object.freeze(
    Object.fromEntries(
      states.map((state) => [
        state,
        values.filter((value) => value === state).length,
      ]),
    ) as Record<T, number>,
  );
}

/**
 * 開始候補の輸送形式と同じProject・世代への所属を捕捉する。
 * @responsibility 密配列・一意なTask ID・同版相関を確認し、モデルの選抜規則は再実装しない。
 * @trace ARCH-000004
 * @input state: 保存確認済みState、input: 受け取った候補metadata。
 * @returns 独立した固定値、又は輸送不正のnull。
 * @precondition State自身は既存Readerで確認済み。
 * @postcondition Getter・Proxyを実行せず、欠測を空候補へ補完しない。
 * @effect なし。
 * @boundary EMの観測とCoordinatorの実行・表示。
 * @security 候補IDをAuthority又は予約済み状態として扱わない。
 */
export function inspectTaskStartCandidates(
  state: ProjectExecutionState,
  input: unknown,
): TaskStartCandidates | null {
  const record = snapshotPlainRecord(
    input,
    new Set(["projectId", "generation", "taskIds"]),
  );
  if (
    !record ||
    record.projectId !== state.projectId ||
    record.generation !== state.generation
  )
    return null;
  const ids = snapshotPlainArray(record.taskIds, Number.MAX_SAFE_INTEGER);
  if (ids.status !== "ok") return null;
  const stateTaskIds = new Set(state.tasks.map((task) => task.definition.id));
  const seen = new Set<string>();
  for (const id of ids.value) {
    if (typeof id !== "string" || seen.has(id) || !stateTaskIds.has(id))
      return null;
    seen.add(id);
  }
  return Object.freeze({
    projectId: state.projectId,
    generation: state.generation,
    taskIds: Object.freeze([...seen]),
  });
}

/**
 * 同版観測から対象Projectの開始候補を一件だけ取得する。
 * @responsibility 再送・回復後検査・実行準備で、同じProject・世代の候補だけを引き継ぐ。
 * @trace ARCH-000004
 * @input state: 同版のProject。input: 同版の候補一覧。
 * @returns 独立捕捉した一件、または欠測・重複時のnull。
 * @effect N/A: 局所値だけを読む。
 * @failure 候補を確認できない場合は新規候補を作らない。
 * @boundary EMの同版読取りとCoordinatorの進行判定。
 */
export function captureTaskStartCandidates(
  state: ProjectExecutionState,
  input: unknown,
): TaskStartCandidates | null {
  const candidates = snapshotPlainArray(input, Number.MAX_SAFE_INTEGER);
  if (candidates.status !== "ok") return null;
  let match: TaskStartCandidates | null = null;
  for (const item of candidates.value) {
    const candidate = inspectTaskStartCandidates(state, item);
    if (!candidate) continue;
    if (match) return null;
    match = candidate;
  }
  return match;
}

/**
 * 同じ保存断面のStateと開始候補から公開状態を構築する。
 * @responsibility 進行・品質・次の操作の投影を作り、候補の欠測を待機へ補完しない。
 * @trace ARCH-000004
 * @input state、candidates: 受付で捕捉済みの同じProject・generationの開始候補。
 * @returns Coordinatorの公開投影。
 * @failure 候補不正又は意味的不整合を例外として呼出し境界へ返す。
 * @effect なし。
 */
export function projectCoordinatorState(
  state: ProjectExecutionState,
  candidates: TaskStartCandidates | null,
): CoordinatorProjection {
  if (
    candidates?.projectId !== state.projectId ||
    candidates.generation !== state.generation
  )
    throw new Error("coordinator_state_observation_unknown");
  const objectiveCounts = countStates(
    state.objectives.map((objective) => objective.state),
    OBJECTIVE_STATES,
  );
  const taskCounts = countStates(
    state.tasks.map((task) => task.state),
    TASK_STATES,
  );
  const objectiveTaskSummaries = Object.freeze(
    state.objectives.map((objective) =>
      Object.freeze({
        objectiveId: objective.definition.id,
        objectiveState: objective.state,
        taskCounts: countStates(
          state.tasks
            .filter(
              (task) => task.definition.objectiveId === objective.definition.id,
            )
            .map((task) => task.state),
          TASK_STATES,
        ),
      }),
    ),
  );
  const {
    recoveryRequired,
    humanDecisionRequired,
    qualityState,
    workProgress,
    expectedAction,
  } = projectionProgress(
    { milestoneState: state.milestone.state, objectiveCounts, taskCounts },
    state.tasks.length,
  );
  const nextAction =
    expectedAction ??
    (candidates.taskIds.length > 0
      ? ("schedule_task" as const)
      : ("wait_for_task" as const));
  const projection = Object.freeze({
    projectId: state.projectId,
    milestoneId: state.milestoneId,
    generation: state.generation,
    milestoneState: state.milestone.state,
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries,
    workProgress,
    qualityState,
    humanDecisionRequired,
    recoveryRequired,
    nextAction,
  });
  if (!isCoordinatorProjectionSemanticallyValid(projection))
    throw new Error("coordinator_projection_semantics_invalid");
  return projection;
}

/**
 * 表示用の進行・品質・優先次操作を同じ集計値から決定する。
 * @responsibility 生成と外部DTO検査で表示規則を二重定義しない。
 * @trace ARCH-000004
 * @boundary 値の計算だけ。入力捕捉・到達可能性・実行候補の検査は呼出し元に残す。
 */
function projectionProgress(
  projection: Pick<
    CoordinatorProjection,
    "milestoneState" | "objectiveCounts" | "taskCounts"
  >,
  taskTotal: number,
) {
  const recoveryRequired = projection.milestoneState === "recovery_required";
  const humanDecisionRequired =
    projection.milestoneState === "human_decision_required" ||
    projection.milestoneState === "returned" ||
    projection.objectiveCounts.returned > 0 ||
    projection.objectiveCounts.blocked > 0;
  const allTasksComplete =
    projection.taskCounts.completed + projection.taskCounts.superseded ===
    taskTotal;
  const anyTaskStarted =
    projection.taskCounts.ready + projection.taskCounts.waiting_dependency <
    taskTotal;
  const workProgress = allTasksComplete
    ? ("tasks_complete" as const)
    : anyTaskStarted
      ? ("in_progress" as const)
      : ("not_started" as const);
  const qualityState =
    projection.milestoneState === "accepted"
      ? ("accepted" as const)
      : humanDecisionRequired || recoveryRequired
        ? ("blocked" as const)
        : projection.objectiveCounts.integration_pending > 0 ||
            projection.milestoneState === "integrating"
          ? ("integration_pending" as const)
          : ("not_evaluated" as const);
  const expectedAction = recoveryRequired
    ? ("recover" as const)
    : humanDecisionRequired
      ? ("human_decision" as const)
      : projection.milestoneState === "accepted"
        ? ("complete" as const)
        : projection.milestoneState === "integrating"
          ? ("verify_milestone_integration" as const)
          : projection.objectiveCounts.integration_pending > 0
            ? ("verify_objective_integration" as const)
            : null;
  return {
    recoveryRequired,
    humanDecisionRequired,
    allTasksComplete,
    workProgress,
    qualityState,
    expectedAction,
  };
}

const resultKeys = new Set([
  "contract",
  "status",
  "reason",
  "requestId",
  "projectId",
  "repositoryRevision",
  "observationState",
  "projection",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
] as const);

const projectionKeys = new Set([
  "projectId",
  "milestoneId",
  "generation",
  "milestoneState",
  "objectiveCounts",
  "taskCounts",
  "objectiveTaskSummaries",
  "workProgress",
  "qualityState",
  "humanDecisionRequired",
  "recoveryRequired",
  "nextAction",
] as const);

/**
 * Reasonが有効か判定する。
 *
 * @responsibility Reasonの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidReasonの入力契約を満たす。
 * @postcondition validReasonの責務を完了した結果だけを返す。
 * @effect N/A: validReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validReasonは独自の失敗分岐を所有しない。
 * @invariant validReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validReasonはProcess内の同一Subsystemで完結する。
 * @security N/A: validReasonはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validReasonは共有非同期状態を持たない同期処理である。
 */
function validReason(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    /^[a-z0-9_]+$/u.test(value)
  );
}

/**
 * Snapshotの件数を算出する。
 *
 * @responsibility Snapshotの計数対象、集計規則、件数結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、states: readonly T[]
 * @returns Readonly<Record<T, number>> | nullを返す。
 * @precondition 「value: unknown、states: readonly T[]」がcountSnapshotの入力契約を満たす。
 * @postcondition countSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: countSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: countSnapshotは独自の失敗分岐を所有しない。
 * @invariant countSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: countSnapshotはProcess内の同一Subsystemで完結する。
 * @security N/A: countSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: countSnapshotは共有非同期状態を持たない同期処理である。
 */
function countSnapshot<T extends string>(
  value: unknown,
  states: readonly T[],
): Readonly<Record<T, number>> | null {
  const record = snapshotPlainRecord(value, new Set(states));
  if (!record) return null;
  let total = 0;
  const entries: [T, number][] = [];
  for (const state of states) {
    const count = record[state];
    if (!Number.isSafeInteger(count) || Number(count) < 0) return null;
    total += Number(count);
    if (!Number.isSafeInteger(total)) return null;
    entries.push([state, Number(count)]);
  }
  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Record<T, number>
  >;
}

/**
 * Snapshot and validate the canonical public projection at trust boundaries.
 *
 * @responsibility Coordinator Projectionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorProjection | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorProjectionの入力契約を満たす。
 * @postcondition inspectCoordinatorProjectionの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorProjectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorProjectionは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorProjectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorProjectionはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorProjectionは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorProjection(
  value: unknown,
): CoordinatorProjection | null {
  const record = snapshotPlainRecord(value, projectionKeys);
  if (!record) return null;
  if (
    typeof record.milestoneState !== "string" ||
    typeof record.workProgress !== "string" ||
    typeof record.qualityState !== "string" ||
    typeof record.nextAction !== "string"
  )
    return null;
  const objectiveCounts = countSnapshot(
    record.objectiveCounts,
    OBJECTIVE_STATES,
  );
  const taskCounts = countSnapshot(record.taskCounts, TASK_STATES);
  const rawSummaries = snapshotPlainArray(
    record.objectiveTaskSummaries,
    Number.MAX_SAFE_INTEGER,
  );
  if (!objectiveCounts || !taskCounts || rawSummaries.status !== "ok")
    return null;
  const summaries: CoordinatorProjection["objectiveTaskSummaries"][number][] =
    [];
  for (const raw of rawSummaries.value) {
    const summary = snapshotPlainRecord(
      raw,
      new Set(["objectiveId", "objectiveState", "taskCounts"]),
    );
    const counts = countSnapshot(summary?.taskCounts, TASK_STATES);
    if (
      !summary ||
      !validIdentity(summary.objectiveId) ||
      !OBJECTIVE_STATES.includes(summary.objectiveState as never) ||
      !counts
    )
      return null;
    summaries.push(
      Object.freeze({
        objectiveId: summary.objectiveId,
        objectiveState:
          summary.objectiveState as (typeof OBJECTIVE_STATES)[number],
        taskCounts: counts,
      }),
    );
  }
  if (
    !validIdentity(record.projectId) ||
    !validIdentity(record.milestoneId) ||
    !Number.isSafeInteger(record.generation) ||
    Number(record.generation) < 1 ||
    ![
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "returned",
      "cancelled",
    ].includes(record.milestoneState) ||
    !["not_started", "in_progress", "tasks_complete"].includes(
      record.workProgress,
    ) ||
    !["not_evaluated", "integration_pending", "accepted", "blocked"].includes(
      record.qualityState,
    ) ||
    typeof record.humanDecisionRequired !== "boolean" ||
    typeof record.recoveryRequired !== "boolean" ||
    ![
      "schedule_task",
      "wait_for_task",
      "verify_objective_integration",
      "verify_milestone_integration",
      "human_decision",
      "recover",
      "complete",
    ].includes(record.nextAction)
  )
    return null;
  const projection = Object.freeze({
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    generation: Number(record.generation),
    milestoneState: record.milestoneState,
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries: Object.freeze(summaries),
    workProgress: record.workProgress,
    qualityState: record.qualityState,
    humanDecisionRequired: record.humanDecisionRequired,
    recoveryRequired: record.recoveryRequired,
    nextAction: record.nextAction,
  }) as CoordinatorProjection;
  return isCoordinatorProjectionSemanticallyValid(projection)
    ? projection
    : null;
}

/**
 * Coordinator 状態 Query 結果を観測する。
 *
 * @responsibility Coordinator 状態 Query 結果の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorStateQueryResult | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorStateQueryResultの入力契約を満たす。
 * @postcondition inspectCoordinatorStateQueryResultの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorStateQueryResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorStateQueryResultは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorStateQueryResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorStateQueryResultはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorStateQueryResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorStateQueryResultは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorStateQueryResult(
  value: unknown,
): CoordinatorStateQueryResult | null {
  const result = snapshotPlainRecord(value, resultKeys);
  if (
    !result ||
    typeof result.status !== "string" ||
    typeof result.observationState !== "string" ||
    result.contract !== COORDINATOR_STATE_QUERY_CONTRACT ||
    !["completed", "blocked"].includes(result.status) ||
    !validReason(result.reason) ||
    !validIdentity(result.requestId) ||
    !validIdentity(result.projectId) ||
    !validRevision(result.repositoryRevision) ||
    !["observed", "absent", "unknown"].includes(result.observationState) ||
    result.cleanupConfirmed !== true ||
    typeof result.manualRecoveryRequired !== "boolean" ||
    result.effectState !== "no_effect"
  )
    return null;
  const projection =
    result.projection === null
      ? null
      : inspectCoordinatorProjection(result.projection);
  if (
    (result.projection !== null && !projection) ||
    (result.observationState === "observed" &&
      (!projection || projection.projectId !== result.projectId)) ||
    (result.observationState !== "observed" && result.projection !== null) ||
    (result.status === "completed" && result.observationState === "unknown") ||
    (result.status === "blocked" && result.observationState !== "unknown") ||
    (result.observationState !== "unknown" && result.manualRecoveryRequired)
  )
    return null;
  return Object.freeze({
    ...result,
    projection,
  }) as CoordinatorStateQueryResult;
}

/**
 * Validate only semantic relations carried by the public projection itself.
 *
 * @responsibility Coordinator Projection Semantically Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input projection: CoordinatorProjection
 * @returns isCoordinatorProjectionSemanticallyValidの計算結果を返す。
 * @precondition 「projection: CoordinatorProjection」がisCoordinatorProjectionSemanticallyValidの入力契約を満たす。
 * @postcondition isCoordinatorProjectionSemanticallyValidの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorProjectionSemanticallyValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCoordinatorProjectionSemanticallyValidは独自の失敗分岐を所有しない。
 * @invariant isCoordinatorProjectionSemanticallyValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorProjectionSemanticallyValidはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorProjectionSemanticallyValidはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorProjectionSemanticallyValidは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorProjectionSemanticallyValid(
  projection: CoordinatorProjection,
) {
  const countTotal = <T extends string>(
    counts: Readonly<Record<T, number>>,
    states: readonly T[],
  ) => {
    let total = 0;
    for (const state of states) {
      const value = counts[state];
      if (!Number.isSafeInteger(value) || value < 0) return null;
      total += value;
      if (!Number.isSafeInteger(total)) return null;
    }
    return total;
  };
  const objectiveTotal = countTotal(
    projection.objectiveCounts,
    OBJECTIVE_STATES,
  );
  const taskTotal = countTotal(projection.taskCounts, TASK_STATES);
  if (objectiveTotal === null || taskTotal === null) return false;
  if (objectiveTotal < 1 || taskTotal < 1) return false;
  if (
    projection.objectiveTaskSummaries.length !== objectiveTotal ||
    new Set(projection.objectiveTaskSummaries.map((entry) => entry.objectiveId))
      .size !== objectiveTotal
  )
    return false;
  const summarizedObjectiveCounts = countStates(
    projection.objectiveTaskSummaries.map((entry) => entry.objectiveState),
    OBJECTIVE_STATES,
  );
  const mutableSummarizedTaskCounts = Object.fromEntries(
    TASK_STATES.map((state) => [state, 0]),
  ) as Record<ProjectTaskState, number>;
  for (const summary of projection.objectiveTaskSummaries) {
    const summaryTotal = countTotal(summary.taskCounts, TASK_STATES);
    if (summaryTotal === null || summaryTotal < 1) return false;
    for (const state of TASK_STATES) {
      const next =
        mutableSummarizedTaskCounts[state] + summary.taskCounts[state];
      if (!Number.isSafeInteger(next)) return false;
      mutableSummarizedTaskCounts[state] = next;
    }
  }
  const summarizedTaskCounts = Object.freeze(mutableSummarizedTaskCounts);
  if (
    JSON.stringify(summarizedObjectiveCounts) !==
      JSON.stringify(projection.objectiveCounts) ||
    JSON.stringify(summarizedTaskCounts) !==
      JSON.stringify(projection.taskCounts)
  )
    return false;
  for (const summary of projection.objectiveTaskSummaries) {
    const count = (states: readonly ProjectTaskState[]) =>
      states.reduce((sum, state) => sum + summary.taskCounts[state], 0);
    const summaryTotal = count(TASK_STATES);
    if (summaryTotal < 1) return false;
    const notStarted = count(["planned", "waiting_dependency", "ready"]);
    const blocked = count(["failed", "cancelled", "recovery_required"]);
    if (summary.objectiveState === "planned" && notStarted !== summaryTotal)
      return false;
    if (
      summary.objectiveState === "executing" &&
      (notStarted === summaryTotal ||
        summary.taskCounts.completed + summary.taskCounts.superseded ===
          summaryTotal ||
        blocked > 0)
    )
      return false;
    if (
      ["integration_pending", "accepted", "returned"].includes(
        summary.objectiveState,
      ) &&
      summary.taskCounts.completed + summary.taskCounts.superseded !==
        summaryTotal
    )
      return false;
    if (summary.objectiveState === "blocked" && blocked === 0) return false;
    if (
      summary.objectiveState === "cancelled" &&
      summary.taskCounts.cancelled === 0
    )
      return false;
  }
  const {
    recoveryRequired,
    humanDecisionRequired,
    allTasksComplete,
    workProgress,
    qualityState,
    expectedAction,
  } = projectionProgress(projection, taskTotal);
  const isAllObjectivesPlanned =
    projection.objectiveCounts.planned === objectiveTotal;
  const isAllObjectivesAccepted =
    projection.objectiveCounts.accepted === objectiveTotal;
  const isAllTasksWaitingToStart =
    projection.taskCounts.ready + projection.taskCounts.waiting_dependency ===
    taskTotal;
  const isAllTasksTerminalForIntegration =
    projection.taskCounts.completed + projection.taskCounts.superseded ===
    taskTotal;
  const isAggregateReachable =
    (!isAllObjectivesPlanned || projection.taskCounts.completed === 0) &&
    (!allTasksComplete ||
      (projection.objectiveCounts.planned === 0 &&
        projection.objectiveCounts.executing === 0)) &&
    (projection.objectiveCounts.integration_pending === 0 ||
      projection.taskCounts.completed > 0);
  const isMilestoneReachable =
    isAggregateReachable &&
    (projection.milestoneState !== "planned" ||
      (isAllObjectivesPlanned && isAllTasksWaitingToStart)) &&
    (projection.milestoneState !== "executing" ||
      (!isAllObjectivesPlanned && !isAllObjectivesAccepted)) &&
    (projection.milestoneState !== "integrating" ||
      (isAllObjectivesAccepted && isAllTasksTerminalForIntegration)) &&
    (projection.milestoneState !== "accepted" ||
      (isAllObjectivesAccepted &&
        projection.objectiveCounts.blocked === 0 &&
        projection.objectiveCounts.cancelled === 0 &&
        isAllTasksTerminalForIntegration &&
        projection.taskCounts.recovery_required === 0)) &&
    (projection.milestoneState !== "returned" ||
      (isAllObjectivesAccepted && isAllTasksTerminalForIntegration)) &&
    (projection.milestoneState !== "recovery_required" ||
      projection.taskCounts.recovery_required > 0) &&
    (projection.milestoneState !== "human_decision_required" ||
      projection.objectiveCounts.blocked > 0) &&
    (projection.milestoneState !== "cancelled" ||
      (projection.taskCounts.starting === 0 &&
        projection.taskCounts.running === 0 &&
        projection.taskCounts.cleanup_pending === 0 &&
        projection.taskCounts.recovery_required === 0));
  return (
    isMilestoneReachable &&
    projection.recoveryRequired === recoveryRequired &&
    projection.humanDecisionRequired === humanDecisionRequired &&
    projection.workProgress === workProgress &&
    projection.qualityState === qualityState &&
    (expectedAction === null
      ? projection.nextAction === "schedule_task" ||
        projection.nextAction === "wait_for_task"
      : projection.nextAction === expectedAction)
  );
}

/**
 * Validate the relation between the public Objective result and its already
 *
 * @responsibility Coordinator Objective Projection Correlation Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input outer: Readonly<{ status: "completed" | "blocked" | "cancelled"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; effectState: "no_effect" | "settled" | "unknown"; recoveryCount: number; }>、projection: CoordinatorProjection | null
 * @returns isCoordinatorObjectiveProjectionCorrelationValidの計算結果を返す。
 * @precondition 「outer: Readonly<{ status: "completed" | "blocked" | "cancelled"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; effectState: "no_effect" | "settled" | "unknown"; recoveryCount: number; }>、projection: CoordinatorProjection | null」がisCoordinatorObjectiveProjectionCorrelationValidの入力契約を満たす。
 * @postcondition isCoordinatorObjectiveProjectionCorrelationValidの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorObjectiveProjectionCorrelationValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCoordinatorObjectiveProjectionCorrelationValidは独自の失敗分岐を所有しない。
 * @invariant isCoordinatorObjectiveProjectionCorrelationValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorObjectiveProjectionCorrelationValidはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorObjectiveProjectionCorrelationValidはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorObjectiveProjectionCorrelationValidは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorObjectiveProjectionCorrelationValid(
  outer: Readonly<{
    status: "completed" | "blocked" | "cancelled";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    effectState: "no_effect" | "settled" | "unknown";
    recoveryCount: number;
  }>,
  projection: CoordinatorProjection | null,
) {
  if (!projection) return true;
  if (outer.status === "completed" && projection.milestoneState !== "accepted")
    return false;
  if (outer.status === "cancelled" && projection.milestoneState !== "cancelled")
    return false;
  if (
    projection.nextAction === "recover" &&
    (outer.status !== "blocked" ||
      outer.cleanupConfirmed ||
      !outer.manualRecoveryRequired ||
      outer.effectState !== "unknown" ||
      outer.recoveryCount < 1)
  )
    return false;
  if (
    projection.milestoneState === "accepted" &&
    (outer.status !== "completed" ||
      outer.cleanupConfirmed !== true ||
      outer.manualRecoveryRequired ||
      outer.processRestartRequired ||
      outer.recoveryCount !== 0 ||
      outer.effectState === "unknown")
  )
    return false;
  return true;
}

export const COORDINATOR_PUBLIC_RUNTIME_CONTRACT =
  "crdd-coordinator/public-runtime/v2" as const;

const OBJECTIVE_RESULT_KEYS = new Set([
  "contract",
  "status",
  "reason",
  "requestId",
  "projectId",
  "milestoneId",
  "queueId",
  "projection",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "processRestartRequired",
  "recoveryIds",
  "recoveryObligations",
  "effectState",
]);
const PUBLIC_BLOCKED_RESULT_KEYS = new Set([
  "contract",
  "status",
  "reason",
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "effectState",
]);

/**
 * Objective結果の公開文字列を検査する。
 * @responsibility 制御文字と既存の項目別境界を維持し、生の外部出力を返さない。
 * @trace ARCH-000004
 * @input 公開結果の候補値と項目別の既存上限。
 * @returns 不正・不明ならnull又はfalse、成立時だけ所有済み値。
 * @effect 外部Effect・認可・保存を行わない。
 * @failure Getter・Proxy・欠測・相関不整合を正常結果へ補完しない。
 * @boundary 未信頼の搬送結果とCoordinatorの公開値契約。
 * @security 元参照の変更を結果へ持ち込まず、未許可fieldを透過しない。
 */
function objectiveResultText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * 回復参照と回復義務を同じ結果へ捕捉する。
 * @responsibility 重複・欠測・集合差を拒否し、元のkindとexact参照を保持する。
 * @trace ARCH-000004
 * @input 回復ID配列と義務配列。
 * @returns 不正・不明ならnull又はfalse、成立時だけ所有済み値。
 * @effect 外部Effect・認可・保存を行わない。
 * @failure Getter・Proxy・欠測・相関不整合を正常結果へ補完しない。
 * @boundary 未信頼の搬送結果とCoordinatorの公開値契約。
 * @security 元参照の変更を結果へ持ち込まず、未許可fieldを透過しない。
 */
function recoverySnapshot(rawIds: unknown, rawObligations: unknown) {
  const ids = snapshotPlainArray(rawIds, Number.MAX_SAFE_INTEGER);
  const obligations = snapshotPlainArray(
    rawObligations,
    Number.MAX_SAFE_INTEGER,
  );
  if (ids.status !== "ok" || obligations.status !== "ok") return null;
  const copiedIds: string[] = [];
  for (const id of ids.value) {
    if (
      !objectiveResultText(id, 512) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id)
    )
      return null;
    copiedIds.push(id);
  }
  const copiedObligations: Readonly<{ kind: string; recoveryId: string }>[] =
    [];
  for (const raw of obligations.value) {
    const entry = snapshotPlainRecord(raw, new Set(["kind", "recoveryId"]));
    if (
      !entry ||
      typeof entry.kind !== "string" ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "execution_process",
      ].includes(entry.kind) ||
      !objectiveResultText(entry.recoveryId, 512) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(entry.recoveryId)
    )
      return null;
    copiedObligations.push(
      Object.freeze({
        kind: entry.kind,
        recoveryId: entry.recoveryId,
      }),
    );
  }
  if (
    new Set(copiedIds).size !== copiedIds.length ||
    new Set(
      copiedObligations.map((entry) => `${entry.kind}\0${entry.recoveryId}`),
    ).size !== copiedObligations.length ||
    copiedIds.length !==
      new Set(copiedObligations.map((entry) => entry.recoveryId)).size ||
    copiedIds.some(
      (id) => !copiedObligations.some((entry) => entry.recoveryId === id),
    )
  )
    return null;
  return Object.freeze({
    recoveryIds: Object.freeze(copiedIds),
    recoveryObligations: Object.freeze(copiedObligations),
  });
}

/**
 * 実行前後のRuntime停止結果を独立捕捉する。
 * @responsibility 不明・cleanup・手動確認とopaque回復参照の相関を維持する。
 * @trace ARCH-000004
 * @input 未信頼の停止結果と許可済み契約。
 * @returns 不正・不明ならnull又はfalse、成立時だけ所有済み値。
 * @effect 外部Effect・認可・保存を行わない。
 * @failure Getter・Proxy・欠測・相関不整合を正常結果へ補完しない。
 * @boundary 未信頼の搬送結果とCoordinatorの公開値契約。
 * @security 元参照の変更を結果へ持ち込まず、未許可fieldを透過しない。
 */
function publicBlockedSnapshot(
  raw: unknown,
  expectedContracts: ReadonlySet<string>,
) {
  const record =
    snapshotPlainRecord(raw, PUBLIC_BLOCKED_RESULT_KEYS) ??
    snapshotPlainRecord(
      raw,
      new Set([...PUBLIC_BLOCKED_RESULT_KEYS, "recoveryIds"]),
    );
  if (
    !record ||
    typeof record.contract !== "string" ||
    typeof record.effectState !== "string" ||
    !expectedContracts.has(record.contract) ||
    record.status !== "blocked" ||
    !objectiveResultText(record.reason, 256) ||
    typeof record.cleanupConfirmed !== "boolean" ||
    typeof record.manualRecoveryRequired !== "boolean" ||
    !["no_effect", "settled", "unknown"].includes(record.effectState) ||
    (record.effectState === "unknown" &&
      (record.cleanupConfirmed !== false ||
        record.manualRecoveryRequired !== true)) ||
    (record.effectState !== "unknown" &&
      (record.cleanupConfirmed !== true ||
        record.manualRecoveryRequired !== false))
  )
    return null;
  if (Object.hasOwn(record, "recoveryIds")) {
    const ids = snapshotPlainArray<string>(
      record.recoveryIds,
      Number.MAX_SAFE_INTEGER,
    );
    if (
      ids.status !== "ok" ||
      ids.value.some(
        (id) =>
          !objectiveResultText(id, 512) ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id),
      ) ||
      new Set(ids.value).size !== ids.value.length ||
      (ids.value.length > 0 && record.effectState !== "unknown")
    )
      return null;
    return Object.freeze({
      ...record,
      recoveryIds: Object.freeze([...ids.value]),
    });
  }
  return Object.freeze({ ...record });
}

/**
 * Objectiveの完成結果を同期で受け付ける。
 * @responsibility 投影・終了・回復義務・Workspaceの相関をOwner内で完結させる。
 * @trace ARCH-000004
 * @input 未信頼結果と要求したWorkspace ID（省略時も結果内の同一性を検査）。
 * @returns 不正・不明ならnull又はfalse、成立時だけ所有済み値。
 * @effect 外部Effect・認可・保存を行わない。
 * @failure Getter・Proxy・欠測・相関不整合を正常結果へ補完しない。
 * @boundary 未信頼の搬送結果とCoordinatorの公開値契約。
 * @security 元参照の変更を結果へ持ち込まず、未許可fieldを透過しない。
 */
export function inspectCoordinatorObjectiveResult(
  raw: unknown,
  expectedWorkspaceId?: string | null,
): Readonly<Record<string, unknown>> | null {
  const simple = publicBlockedSnapshot(
    raw,
    new Set([COORDINATOR_PUBLIC_RUNTIME_CONTRACT]),
  );
  if (simple) return simple;
  const objective =
    snapshotPlainRecord(raw, OBJECTIVE_RESULT_KEYS) ??
    snapshotPlainRecord(
      raw,
      new Set([...OBJECTIVE_RESULT_KEYS, "workspaceResults"]),
    );
  if (objective) {
    if (
      typeof objective.status !== "string" ||
      typeof objective.effectState !== "string"
    )
      return null;
    const workspaceResults = Object.hasOwn(objective, "workspaceResults")
      ? inspectCoordinatorWorkspaceResults(
          objective.workspaceResults,
          expectedWorkspaceId,
        )
      : undefined;
    const recoveries = recoverySnapshot(
      objective.recoveryIds,
      objective.recoveryObligations,
    );
    const projection =
      objective.projection === null
        ? null
        : inspectCoordinatorProjection(objective.projection);
    // Task処理の完了と、Objective全体の採用完了は異なる。
    // 内部進行値は変更せず、公開値だけを既存の採用相関へ合わせる。
    const status =
      objective.status === "completed" &&
      projection !== null &&
      projection.milestoneState !== "accepted"
        ? "blocked"
        : objective.status;
    const hasRecovery = Boolean(recoveries?.recoveryIds.length);
    const hasExecutionProcessRecovery = Boolean(
      recoveries?.recoveryObligations.some(
        (entry) => entry.kind === "execution_process",
      ),
    );
    const isCorrelationValid =
      projection === null ||
      isCoordinatorObjectiveProjectionCorrelationValid(
        {
          status: status as "completed" | "blocked" | "cancelled",
          cleanupConfirmed: Boolean(objective.cleanupConfirmed),
          manualRecoveryRequired: Boolean(objective.manualRecoveryRequired),
          processRestartRequired: Boolean(objective.processRestartRequired),
          effectState: objective.effectState as
            | "no_effect"
            | "settled"
            | "unknown",
          recoveryCount: recoveries?.recoveryIds.length ?? 0,
        },
        projection,
      );
    if (
      objective.contract !== COORDINATOR_OBJECTIVE_INTAKE_CONTRACT ||
      (workspaceResults === null && objective.status === "completed") ||
      !["completed", "blocked", "cancelled"].includes(objective.status) ||
      !objectiveResultText(objective.reason, 256) ||
      !validIdentity(objective.requestId) ||
      !validIdentity(objective.projectId) ||
      !validIdentity(objective.milestoneId) ||
      (objective.queueId !== null && !validIdentity(objective.queueId)) ||
      (objective.projection !== null && !projection) ||
      (projection !== null &&
        (projection.projectId !== objective.projectId ||
          projection.milestoneId !== objective.milestoneId)) ||
      typeof objective.cleanupConfirmed !== "boolean" ||
      typeof objective.manualRecoveryRequired !== "boolean" ||
      typeof objective.processRestartRequired !== "boolean" ||
      !recoveries ||
      !isCorrelationValid ||
      !["no_effect", "settled", "unknown"].includes(objective.effectState) ||
      (objective.status === "completed" &&
        (objective.cleanupConfirmed !== true ||
          objective.manualRecoveryRequired !== false ||
          objective.processRestartRequired !== false ||
          recoveries.recoveryIds.length !== 0 ||
          objective.effectState === "unknown")) ||
      (objective.effectState === "unknown" &&
        (objective.cleanupConfirmed !== false ||
          objective.manualRecoveryRequired !== true)) ||
      (objective.effectState !== "unknown" &&
        (objective.cleanupConfirmed !== true ||
          objective.manualRecoveryRequired !== false)) ||
      (hasRecovery &&
        (objective.status !== "blocked" ||
          objective.effectState !== "unknown" ||
          objective.cleanupConfirmed !== false ||
          objective.manualRecoveryRequired !== true)) ||
      (objective.status === "cancelled" &&
        (objective.cleanupConfirmed !== true ||
          objective.manualRecoveryRequired !== false ||
          objective.processRestartRequired !== false ||
          hasRecovery ||
          !["no_effect", "settled"].includes(objective.effectState))) ||
      objective.processRestartRequired !== hasExecutionProcessRecovery ||
      (objective.processRestartRequired === true &&
        (objective.status !== "blocked" ||
          objective.cleanupConfirmed !== false ||
          objective.manualRecoveryRequired !== true ||
          objective.effectState !== "unknown"))
    )
      return null;
    return Object.freeze({
      ...objective,
      status,
      projection,
      ...recoveries,
      ...(workspaceResults === undefined ? {} : { workspaceResults }),
    });
  }
  return null;
}

export const COORDINATOR_STATE_QUERY_CONTRACT =
  "crdd-coordinator/state-query/v2" as const;

const queryKeys = new Set([
  "requestId",
  "projectId",
  "repositoryRevision",
] as const);

/**
 * Coordinator 状態 Queryを観測する。
 *
 * @responsibility Coordinator 状態 Queryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorStateQuery | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorStateQueryの入力契約を満たす。
 * @postcondition inspectCoordinatorStateQueryの責務を完了した結果だけを返す。
 * @effect N/A: inspectCoordinatorStateQueryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorStateQueryは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorStateQueryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorStateQueryはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCoordinatorStateQueryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCoordinatorStateQueryは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorStateQuery(
  value: unknown,
): CoordinatorStateQuery | null {
  const request = snapshotPlainRecord(value, queryKeys);
  if (
    !request ||
    !validIdentity(request.requestId) ||
    !validIdentity(request.projectId) ||
    !validRevision(request.repositoryRevision)
  )
    return null;
  return Object.freeze({ ...request }) as CoordinatorStateQuery;
}
