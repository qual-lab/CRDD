import { types as utilTypes } from "node:util";

import {
  isProjectRuntimeRecoveryIdentity,
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
  type ProjectRuntimeSingleTaskAttemptInput,
  type ProjectRuntimeSingleTaskRecoveryObligation,
  type ProjectRuntimeSingleTaskResult,
} from "../../../project-runtime/src/index.ts";

const STABLE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const REPOSITORY_REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * Pre-effect rejections thrown by the v0.18 Single Task Runtime before any
 * provider, container or repository effect starts. Exported so a binding test
 * can reconcile this population against the actual throw sites of
 * coordinator-task-runtime.ts. Any other synchronous throw is treated as
 * effect-unknown and fails closed.
 */
export const PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS = Object.freeze([
  "coordinator_task_process_restart_required",
  "coordinator_task_runtime_cleanup_in_progress",
  "coordinator_task_release_verification_required",
] as const);

const preEffectRejectionSet: ReadonlySet<string> = new Set(
  PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS,
);

/**
 * ProjectRuntimeSingleTaskDependenciesが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeSingleTaskDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeSingleTaskDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeSingleTaskDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeSingleTaskDependenciesの宣言は外部境界を開かない。
 * @security ProjectRuntimeSingleTaskDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeSingleTaskDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeSingleTaskDependencies = Readonly<{
  startTask: (
    taskRequest: unknown,
    repositoryRoot: unknown,
    runtimeExecutionCapability: object,
    recoveryCorrelationId?: string,
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
}>;

/**
 * resultの処理を実行する。
 *
 * @responsibility resultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input input: Readonly<{ attemptId: string | null; operationId: string | null; authorityBindingId: string | null; repositoryRevision: string | null; status: "completed" | "blocked" | "cancelled"; reason: string; effectState: "no_effect" | "settled" | "unknown"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations?: readonly ProjectRuntimeSingleTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }>
 * @returns ProjectRuntimeSingleTaskResultを返す。
 * @precondition 「input: Readonly<{ attemptId: string | null; operationId: string | null; authorityBindingId: string | null; repositoryRevision: string | null; status: "completed" | "blocked" | "cancelled"; reason: string; effectState: "no_effect" | "settled" | "unknown"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations?: readonly ProjectRuntimeSingleTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }>」がresultの入力契約を満たす。
 * @postcondition resultの責務を完了した結果だけを返す。
 * @effect N/A: resultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resultは独自の失敗分岐を所有しない。
 * @invariant resultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security resultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resultは共有非同期状態を持たない同期処理である。
 */
function result(
  input: Readonly<{
    attemptId: string | null;
    operationId: string | null;
    authorityBindingId: string | null;
    repositoryRevision: string | null;
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    candidateId: string | null;
    recoveryIds: readonly string[];
    recoveryObligations?: readonly ProjectRuntimeSingleTaskRecoveryObligation[];
    executorProvider?: "codex" | "claude";
  }>,
): ProjectRuntimeSingleTaskResult {
  return Object.freeze({
    contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    ...input,
    recoveryIds: Object.freeze([...input.recoveryIds]),
    recoveryObligations: Object.freeze([...(input.recoveryObligations ?? [])]),
  });
}

/**
 * rejectedWithoutEffectの処理を実行する。
 *
 * @responsibility rejectedWithoutEffectに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input attemptId: string | null、operationId: string | null、authorityBindingId: string | null、repositoryRevision: string | null、reason: string、processRestartRequired
 * @returns ProjectRuntimeSingleTaskResultを返す。
 * @precondition 「attemptId: string | null、operationId: string | null、authorityBindingId: string | null、repositoryRevision: string | null、reason: string、processRestartRequired」がrejectedWithoutEffectの入力契約を満たす。
 * @postcondition rejectedWithoutEffectの責務を完了した結果だけを返す。
 * @effect N/A: rejectedWithoutEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rejectedWithoutEffectは独自の失敗分岐を所有しない。
 * @invariant rejectedWithoutEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security rejectedWithoutEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rejectedWithoutEffectは共有非同期状態を持たない同期処理である。
 */
function rejectedWithoutEffect(
  attemptId: string | null,
  operationId: string | null,
  authorityBindingId: string | null,
  repositoryRevision: string | null,
  reason: string,
  processRestartRequired = false,
): ProjectRuntimeSingleTaskResult {
  return result({
    attemptId,
    operationId,
    authorityBindingId,
    repositoryRevision,
    status: "blocked",
    reason,
    effectState: "no_effect",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired,
    candidateId: null,
    recoveryIds: [],
  });
}

/**
 * failedClosedUnknownの処理を実行する。
 *
 * @responsibility failedClosedUnknownに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input attemptId: string | null、operationId: string | null、authorityBindingId: string | null、repositoryRevision: string | null、reason: string
 * @returns ProjectRuntimeSingleTaskResultを返す。
 * @precondition 「attemptId: string | null、operationId: string | null、authorityBindingId: string | null、repositoryRevision: string | null、reason: string」がfailedClosedUnknownの入力契約を満たす。
 * @postcondition failedClosedUnknownの責務を完了した結果だけを返す。
 * @effect N/A: failedClosedUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failedClosedUnknownは独自の失敗分岐を所有しない。
 * @invariant failedClosedUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security failedClosedUnknownはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failedClosedUnknownは共有非同期状態を持たない同期処理である。
 */
function failedClosedUnknown(
  attemptId: string | null,
  operationId: string | null,
  authorityBindingId: string | null,
  repositoryRevision: string | null,
  reason: string,
): ProjectRuntimeSingleTaskResult {
  return result({
    attemptId,
    operationId,
    authorityBindingId,
    repositoryRevision,
    status: "blocked",
    reason,
    effectState: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: false,
    candidateId: null,
    recoveryIds: [],
  });
}

/**
 * validTextの処理を実行する。
 *
 * @responsibility validTextに対応する入力処理と結果生成を所有する。
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
 * optionalIdentityの処理を実行する。
 *
 * @responsibility optionalIdentityに対応する入力処理と結果生成を所有する。
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
 * isOpaqueCapabilityの処理を実行する。
 *
 * @responsibility isOpaqueCapabilityに対応する入力処理と結果生成を所有する。
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
  return (
    typeof value === "object" && value !== null && !utilTypes.isProxy(value)
  );
}

/**
 * Read one own data property exactly once. Accessor properties, prototype
 *
 * @responsibility ownDataPropertyに対応する入力処理と結果生成を所有する。
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
 * isPlainContainerの処理を実行する。
 *
 * @responsibility isPlainContainerに対応する入力処理と結果生成を所有する。
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
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * inspectStartedTaskの処理を実行する。
 *
 * @responsibility inspectStartedTaskに対応する入力処理と結果生成を所有する。
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
function inspectStartedTask(value: unknown): Readonly<{
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
 * inspectCompletionRecordの処理を実行する。
 *
 * @responsibility inspectCompletionRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns Readonly<{ status: "completed" | "blocked"; reason: string; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations: readonly ProjectRuntimeSingleTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }> | nullを返す。
 * @precondition 「value: unknown」がinspectCompletionRecordの入力契約を満たす。
 * @postcondition inspectCompletionRecordの責務を完了した結果だけを返す。
 * @effect N/A: inspectCompletionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectCompletionRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectCompletionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectCompletionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectCompletionRecordは共有非同期状態を持たない同期処理である。
 */
function inspectCompletionRecord(value: unknown): Readonly<{
  status: "completed" | "blocked";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations: readonly ProjectRuntimeSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
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
    const executorProvider = ownDataProperty(value, "executorProvider");
    // The v0.18 completion record never carries status "cancelled": effect-era
    // cancellation settles as "blocked" with a runtime-owned cancellation
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
      utilTypes.isProxy(rawDockerRecoveryIds) ||
      rawDockerRecoveryIds.length > 128 ||
      (executorProvider !== undefined &&
        executorProvider !== "codex" &&
        executorProvider !== "claude") ||
      (status === "completed" && cleanupConfirmed !== true)
    )
      return null;
    const dockerRecoveryIds: string[] = [];
    for (let index = 0; index < rawDockerRecoveryIds.length; index += 1) {
      const id = ownDataProperty(rawDockerRecoveryIds, String(index));
      if (!isProjectRuntimeRecoveryIdentity(id)) return null;
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
    if (recoveryIds.some((id) => !isProjectRuntimeRecoveryIdentity(id)))
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
    });
  } catch {
    return null;
  }
}

const SETTLED_RUNTIME_CANCELLATION_REASONS = new Set([
  "coordinator_task_cancelled_before_stage_start",
  "coordinator_task_cancelled_after_provider_cleanup",
  "coordinator_task_cancelled_during_operation_creation",
  "coordinator_task_cancelled_during_external_send_authorization",
  "coordinator_task_cancelled_before_candidate_capture",
  "coordinator_task_cancelled_before_independent_review",
]);

/**
 * IF-SINGLE-TASK adapter: run exactly one task attempt on the existing v0.18
 *
 * @responsibility runProjectRuntimeSingleTaskAttemptに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: ProjectRuntimeSingleTaskDependencies、input: ProjectRuntimeSingleTaskAttemptInput
 * @returns Promise<ProjectRuntimeSingleTaskResult>を返す。
 * @precondition 「dependencies: ProjectRuntimeSingleTaskDependencies、input: ProjectRuntimeSingleTaskAttemptInput」がrunProjectRuntimeSingleTaskAttemptの入力契約を満たす。
 * @postcondition runProjectRuntimeSingleTaskAttemptの責務を完了した結果だけを返す。
 * @effect N/A: runProjectRuntimeSingleTaskAttemptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runProjectRuntimeSingleTaskAttemptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectRuntimeSingleTaskAttemptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runProjectRuntimeSingleTaskAttemptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runProjectRuntimeSingleTaskAttemptは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runProjectRuntimeSingleTaskAttempt(
  dependencies: ProjectRuntimeSingleTaskDependencies,
  input: ProjectRuntimeSingleTaskAttemptInput,
): Promise<ProjectRuntimeSingleTaskResult> {
  if (
    !input ||
    typeof input !== "object" ||
    !validText(input.attemptId, 128) ||
    !STABLE_IDENTITY.test(input.attemptId) ||
    !validText(input.operationId, 128) ||
    !STABLE_IDENTITY.test(input.operationId) ||
    !validText(input.authorityBindingId, 128) ||
    !STABLE_IDENTITY.test(input.authorityBindingId) ||
    typeof input.repositoryRevision !== "string" ||
    !REPOSITORY_REVISION.test(input.repositoryRevision) ||
    !isOpaqueCapability(input.runtimeExecutionCapability) ||
    !(input.cancellationSignal instanceof AbortSignal) ||
    (input.observeStarted !== undefined &&
      typeof input.observeStarted !== "function")
  )
    return rejectedWithoutEffect(
      null,
      null,
      null,
      null,
      "single_task_input_invalid",
    );
  const attemptId = input.attemptId;
  const operationId = input.operationId;
  const authorityBindingId = input.authorityBindingId;
  const repositoryRevision = input.repositoryRevision;
  if (input.cancellationSignal.aborted)
    return result({
      attemptId,
      operationId,
      authorityBindingId,
      repositoryRevision,
      status: "cancelled",
      reason: "single_task_cancelled_before_effect",
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: [],
    });
  let rawStarted: unknown;
  try {
    rawStarted = dependencies.startTask(
      input.taskRequest,
      input.repositoryRoot,
      input.runtimeExecutionCapability,
      input.operationId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (preEffectRejectionSet.has(message))
      return rejectedWithoutEffect(
        attemptId,
        operationId,
        authorityBindingId,
        repositoryRevision,
        message,
        message === "coordinator_task_process_restart_required",
      );
    return failedClosedUnknown(
      attemptId,
      operationId,
      authorityBindingId,
      repositoryRevision,
      "single_task_start_observation_invalid",
    );
  }
  const started = inspectStartedTask(rawStarted);
  if (!started)
    return failedClosedUnknown(
      attemptId,
      operationId,
      authorityBindingId,
      repositoryRevision,
      "single_task_start_observation_invalid",
    );
  if (input.observeStarted) {
    let isObserved = false;
    try {
      isObserved = (await input.observeStarted()) === true;
    } catch {
      isObserved = false;
    }
    if (!isObserved) {
      try {
        const cancellation = dependencies.cancelTask(started.controlCapability);
        if (cancellation instanceof Promise)
          await cancellation.catch(() => null);
      } catch {
        // The completion record below remains the authority for cleanup.
      }
    }
  }
  let cancellationTransferred = false;
  const forwardCancellation = () => {
    if (cancellationTransferred) return;
    cancellationTransferred = true;
    try {
      const settlement = dependencies.cancelTask(started.controlCapability);
      if (settlement instanceof Promise)
        settlement.catch(() => {
          // Cancellation settlement is owned by the runtime's completion
          // record; an asynchronously failing cancel entry must not become an
          // unhandled rejection while the completion is still observed.
        });
    } catch {
      // Cancellation settlement is owned by the runtime's completion record;
      // a throwing cancel entry must not detach the completion observation.
    }
  };
  input.cancellationSignal.addEventListener("abort", forwardCancellation, {
    once: true,
  });
  // A signal aborted synchronously during startTask never fires a listener
  // registered afterwards, so re-check once; {once: true} keeps the total
  // forwarding at one.
  if (input.cancellationSignal.aborted) forwardCancellation();
  let rawCompletion: unknown;
  try {
    rawCompletion = await started.completion;
  } catch {
    return failedClosedUnknown(
      attemptId,
      operationId,
      authorityBindingId,
      repositoryRevision,
      "single_task_completion_observation_invalid",
    );
  } finally {
    input.cancellationSignal.removeEventListener("abort", forwardCancellation);
  }
  const completion = inspectCompletionRecord(rawCompletion);
  if (!completion)
    return failedClosedUnknown(
      attemptId,
      operationId,
      authorityBindingId,
      repositoryRevision,
      "single_task_completion_observation_invalid",
    );
  const isRecoveryOrCleanupUnknown =
    completion.cleanupConfirmed !== true ||
    completion.manualRecoveryRequired === true ||
    completion.recoveryIds.length > 0;
  const isSettledRuntimeCancellation =
    cancellationTransferred &&
    input.cancellationSignal.aborted &&
    completion.status === "blocked" &&
    completion.cleanupConfirmed === true &&
    completion.manualRecoveryRequired === false &&
    completion.processRestartRequired === false &&
    completion.recoveryIds.length === 0 &&
    SETTLED_RUNTIME_CANCELLATION_REASONS.has(completion.reason);
  const completionStatus = isSettledRuntimeCancellation
    ? "cancelled"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "blocked"
      : completion.status;
  const completionReason = isSettledRuntimeCancellation
    ? "single_task_cancelled_after_effect_cleanup"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "single_task_completion_cleanup_unknown"
      : completion.reason;
  return result({
    attemptId,
    operationId,
    authorityBindingId,
    repositoryRevision,
    status: completionStatus,
    reason: completionReason,
    effectState: isRecoveryOrCleanupUnknown ? "unknown" : "settled",
    cleanupConfirmed: completion.cleanupConfirmed,
    manualRecoveryRequired: isRecoveryOrCleanupUnknown
      ? true
      : completion.manualRecoveryRequired,
    processRestartRequired: completion.processRestartRequired,
    candidateId: completion.candidateId,
    recoveryIds: completion.recoveryIds,
    recoveryObligations: completion.recoveryObligations,
    ...(completion.executorProvider === undefined
      ? {}
      : { executorProvider: completion.executorProvider }),
  });
}

/**
 * describeProjectRuntimeSingleTaskAdapterContractの処理を実行する。
 *
 * @responsibility describeProjectRuntimeSingleTaskAdapterContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeSingleTaskAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeSingleTaskAdapterContractの入力契約を満たす。
 * @postcondition describeProjectRuntimeSingleTaskAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeSingleTaskAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeSingleTaskAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeSingleTaskAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeProjectRuntimeSingleTaskAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProjectRuntimeSingleTaskAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeSingleTaskAdapterContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    contractRevision: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
    taskRequestSchemaOwnership: "single_task_runtime",
    projectStateOwnership: "none",
    followUpTaskCreation: "none",
    acceptanceOwnership: "none",
    unknownSettlement: "fail_closed_manual_recovery",
    effectCancellationRepresentation:
      "pre_effect_and_confirmed_post_effect_cleanup_normalized_to_project_cancelled_other_effect_era_results_preserved",
  });
}
