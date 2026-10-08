/**
 * task-attempt-runtimeに属する責務をまとめる。
 *
 * @responsibility CoordinatorTaskDependenciesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { types as utilTypes } from "node:util";
import type { ProviderProcessStartedNotice } from "../docker-runtime/docker-process-controller.ts";

import type {
  CoordinatorTaskAttemptInput,
  CoordinatorTaskAttemptResult,
  CoordinatorTaskRecoveryObligation,
} from "./types.ts";
import { observeCoordinatorTaskCompletion } from "./task-completion-observation.ts";

const STABLE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

/**
 * Pre-effect rejections thrown by the v0.18 Single Task Runtime before any
 * provider, container or repository effect starts. Exported so a binding test
 * can reconcile this population against the actual throw sites of
 * coordinator-task-runtime.ts. Any other synchronous throw is treated as
 * effect-unknown and fails closed.
 */
export const COORDINATOR_TASK_PRE_EFFECT_REJECTIONS = Object.freeze([
  "coordinator_task_process_restart_required",
  "coordinator_task_runtime_cleanup_in_progress",
  "coordinator_task_release_verification_required",
] as const);

const preEffectRejectionSet: ReadonlySet<string> = new Set(
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
);

/**
 * task-attempt-runtimeで使用するProject Runtime Single Task Dependenciesの値契約を定義する。
 *
 * @responsibility Project Runtime Single Task DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskDependenciesの宣言は外部境界を開かない。
 * @security CoordinatorTaskDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorTaskDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskDependencies = Readonly<{
  startTask: (
    taskRequest: unknown,
    repositoryRoot: unknown,
    runtimeExecutionCapability: object,
    recoveryCorrelationId?: string,
    observeProviderStarted?: (
      notice: ProviderProcessStartedNotice,
    ) => boolean | Promise<boolean>,
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
}>;

/**
 * resultを決定する。
 *
 * @responsibility resultの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input input: Readonly<{ operationId: string | null; status: "completed" | "blocked" | "cancelled"; reason: string; effectState: "no_effect" | "settled" | "unknown"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }>
 * @returns CoordinatorTaskAttemptResultを返す。
 * @precondition 「input: Readonly<{ operationId: string | null; status: "completed" | "blocked" | "cancelled"; reason: string; effectState: "no_effect" | "settled" | "unknown"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }>」がresultの入力契約を満たす。
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
  }>,
): CoordinatorTaskAttemptResult {
  return Object.freeze({
    contract: "crdd-coordinator/task-attempt",
    ...input,
    recoveryIds: Object.freeze([...input.recoveryIds]),
    recoveryObligations: Object.freeze([...(input.recoveryObligations ?? [])]),
  });
}

/**
 * rejected Without Effectを決定する。
 *
 * @responsibility rejected Without Effectの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input operationId: string | null、reason: string、processRestartRequired
 * @returns CoordinatorTaskAttemptResultを返す。
 * @precondition 「operationId: string | null、reason: string、processRestartRequired」がrejectedWithoutEffectの入力契約を満たす。
 * @postcondition rejectedWithoutEffectの責務を完了した結果だけを返す。
 * @effect N/A: rejectedWithoutEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rejectedWithoutEffectは独自の失敗分岐を所有しない。
 * @invariant rejectedWithoutEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security rejectedWithoutEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rejectedWithoutEffectは共有非同期状態を持たない同期処理である。
 */
function rejectedWithoutEffect(
  operationId: string | null,
  reason: string,
  processRestartRequired = false,
): CoordinatorTaskAttemptResult {
  return result({
    operationId,
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
 * failed Closed Unknownを決定する。
 *
 * @responsibility failed Closed Unknownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input operationId: string | null、reason: string
 * @returns CoordinatorTaskAttemptResultを返す。
 * @precondition 「operationId: string | null、reason: string」がfailedClosedUnknownの入力契約を満たす。
 * @postcondition failedClosedUnknownの責務を完了した結果だけを返す。
 * @effect N/A: failedClosedUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failedClosedUnknownは独自の失敗分岐を所有しない。
 * @invariant failedClosedUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security failedClosedUnknownはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failedClosedUnknownは共有非同期状態を持たない同期処理である。
 */
function failedClosedUnknown(
  operationId: string | null,
  reason: string,
): CoordinatorTaskAttemptResult {
  return result({
    operationId,
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
  return (
    typeof value === "object" && value !== null && !utilTypes.isProxy(value)
  );
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
 * Completion 記録を観測する。
 *
 * @responsibility Completion 記録の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns Readonly<{ status: "completed" | "blocked"; reason: string; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations: readonly CoordinatorTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }> | nullを返す。
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
  recoveryObligations: readonly CoordinatorTaskRecoveryObligation[];
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
        executorProvider !== "claude" &&
        !(status === "blocked" && executorProvider === null)) ||
      (status === "completed" && cleanupConfirmed !== true)
    )
      return null;
    const dockerRecoveryIds: string[] = [];
    for (let index = 0; index < rawDockerRecoveryIds.length; index += 1) {
      const id = ownDataProperty(rawDockerRecoveryIds, String(index));
      if (!isTaskRecoveryIdentity(id)) return null;
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
    if (recoveryIds.some((id) => !isTaskRecoveryIdentity(id))) return null;
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
 * @responsibility Project Runtime Single Task Attemptの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorTaskDependencies、input: CoordinatorTaskAttemptInput
 * @returns Promise<CoordinatorTaskAttemptResult>を返す。
 * @precondition 「dependencies: CoordinatorTaskDependencies、input: CoordinatorTaskAttemptInput」がrunCoordinatorTaskAttemptの入力契約を満たす。
 * @postcondition runCoordinatorTaskAttemptの責務を完了した結果だけを返す。
 * @effect 検証済みCapabilityで単一Taskを開始し、同じ制御参照へ取消要求を渡し得る。
 * @failure runCoordinatorTaskAttemptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorTaskAttemptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runCoordinatorTaskAttemptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskAttemptは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runCoordinatorTaskAttempt(
  dependencies: CoordinatorTaskDependencies,
  input: CoordinatorTaskAttemptInput,
): Promise<CoordinatorTaskAttemptResult> {
  if (
    !input ||
    typeof input !== "object" ||
    !validText(input.operationId, 128) ||
    !STABLE_IDENTITY.test(input.operationId) ||
    !isOpaqueCapability(input.runtimeExecutionCapability) ||
    !(input.cancellationSignal instanceof AbortSignal) ||
    (input.observeStarted !== undefined &&
      typeof input.observeStarted !== "function")
  )
    return rejectedWithoutEffect(null, "single_task_input_invalid");
  const operationId = input.operationId;
  if (input.cancellationSignal.aborted)
    return result({
      operationId,
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
  let notificationClosed = false;
  let firstStartObservation: Promise<boolean> | null = null;
  let notificationFailed = false;
  const observeStarted = input.observeStarted;
  /**
   * 同じTaskの初回Executor開始だけを上位保存へ搬送する。
   *
   * @responsibility 呼出し登録による相関、初回通知の直列化と終端後拒否を所有する。
   * @trace ARCH-000004
   * @input Controllerが観測したProvider接続用Host Processの開始通知。
   * @returns 上位保存が成立した場合だけtrue。
   * @precondition 通知は同じTask開始時に登録したController経路から届く。
   * @postcondition Reviewerや是正Executorで上位状態を二重更新しない。
   * @effect 登録済みの上位開始確認を一回呼び出す。
   * @failure 不正通知、終端後通知、上位拒否・例外はfalse。
   * @invariant 下位OP識別子を上位Operation IDと同一視しない。
   * @boundary CoordinatorのProcess開始通知と利用側の状態保存。
   * @security 通知はAuthorityやAI要求受理の証明ではない。
   * @concurrency 同時・重複通知は同じ保存Promiseへ結合する。
   */
  const forwardStarted = (
    notice: ProviderProcessStartedNotice,
  ): Promise<boolean> => {
    if (notificationClosed || input.cancellationSignal.aborted)
      return Promise.resolve(false);
    if (
      !notice ||
      notice.event !== "coordinator_provider_process_started" ||
      !validText(notice.operationId, 128) ||
      !STABLE_IDENTITY.test(notice.operationId) ||
      (notice.provider !== "codex" && notice.provider !== "claude") ||
      (notice.taskRole !== "executor" && notice.taskRole !== "reviewer")
    ) {
      notificationFailed = true;
      return Promise.resolve(false);
    }
    if (notice.taskRole === "reviewer")
      return firstStartObservation ?? Promise.resolve(false);
    firstStartObservation ??= Promise.resolve().then(async () => {
      try {
        const observed = (await observeStarted?.()) === true;
        notificationFailed ||= !observed;
        return observed;
      } catch {
        notificationFailed = true;
        return false;
      }
    });
    return firstStartObservation;
  };
  try {
    rawStarted = dependencies.startTask(
      input.taskRequest,
      input.repositoryRoot,
      input.runtimeExecutionCapability,
      input.operationId,
      observeStarted === undefined ? undefined : forwardStarted,
    );
  } catch (error) {
    notificationClosed = true;
    const message = error instanceof Error ? error.message : "";
    if (preEffectRejectionSet.has(message))
      return rejectedWithoutEffect(
        operationId,
        message,
        message === "coordinator_task_process_restart_required",
      );
    return failedClosedUnknown(
      operationId,
      "single_task_start_observation_invalid",
    );
  }
  const started = inspectStartedTask(rawStarted);
  if (!started) {
    notificationClosed = true;
    return failedClosedUnknown(
      operationId,
      "single_task_start_observation_invalid",
    );
  }
  const observation = await observeCoordinatorTaskCompletion(
    started,
    dependencies.cancelTask,
    input.cancellationSignal,
  );
  notificationClosed = true;
  if (firstStartObservation !== null) await firstStartObservation;
  if (observation.status === "unknown")
    return failedClosedUnknown(
      operationId,
      "single_task_completion_observation_invalid",
    );
  const { rawCompletion, cancellationTransferred } = observation;
  const completion = inspectCompletionRecord(rawCompletion);
  if (!completion)
    return failedClosedUnknown(
      operationId,
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
  const missingRequiredStart =
    observeStarted !== undefined && firstStartObservation === null;
  const invalidCompletedNotification =
    completionStatus === "completed" &&
    (notificationFailed || missingRequiredStart);
  return result({
    operationId,
    status: invalidCompletedNotification ? "blocked" : completionStatus,
    reason: invalidCompletedNotification
      ? notificationFailed
        ? "single_task_start_notification_failed"
        : "single_task_start_notification_missing"
      : completionReason,
    effectState: isRecoveryOrCleanupUnknown ? "unknown" : "settled",
    cleanupConfirmed: completion.cleanupConfirmed,
    manualRecoveryRequired: isRecoveryOrCleanupUnknown
      ? true
      : completion.manualRecoveryRequired,
    processRestartRequired: completion.processRestartRequired,
    candidateId: invalidCompletedNotification ? null : completion.candidateId,
    recoveryIds: completion.recoveryIds,
    recoveryObligations: completion.recoveryObligations,
    ...(completion.executorProvider === undefined
      ? {}
      : { executorProvider: completion.executorProvider }),
  });
}

/**
 * 回復参照の保存可能な文字列範囲を確認する。
 * @responsibility Task結果に含む回復参照の長さと文字集合を固定する。
 * @trace ARCH-000004
 * @input value: 未検証の回復参照。
 * @returns 保存可能な文字列ならtrue。
 * @precondition N/A: unknownを受け取る。
 * @postcondition 値を変更せず真偽を返す。
 * @effect N/A: 純粋な値検査。
 * @failure 不正値はfalse。
 * @invariant 回復参照の形式を実資源不存在の根拠にしない。
 * @boundary 完了結果と保存可能な回復参照。
 * @security Authorityや回復許可を発行しない。
 * @concurrency N/A: 同期処理。
 */
function isTaskRecoveryIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}
