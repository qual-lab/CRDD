/**
 * Taskの回復状態・元版・排他・受領と終了を管理する。
 *
 * @responsibility 現在状態の保存とHost／Home相関を所有し、技術観測と回収はDIへ委譲する。
 * @trace ARCH-000008
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual, types } from "node:util";
import type {
  IsolationCallbacks,
  IsolationExecution,
} from "../../../docker-isolation/src/index.ts";
import {
  saveRecoveryHistory,
  completeOperation,
  completeRecovery,
  type ExecutionOperationRecord,
  type ExecutionSelection,
  type ExecutionStateSnapshot,
  inspectExecutionSelection,
  type OperationRecord,
  parseDockerTaskRecoveryId,
  parseHostRecoveryToken,
  type RepairCheckpoint,
  type RepairOperationRecord,
  type RepairSaveRequest,
  type RestartCheckpoint,
  readState,
  resumeRepairRecordSave,
  type StateVersion,
  saveRecoveryCheckpoint,
  saveRepairRecord,
} from "../../../execution-model/src/index.ts";
import type {
  CompletionResult,
  Executor,
  StartResult,
} from "../../../executor/src/index.ts";
import {
  type ResourceCleanupResult as AttemptResourceCleanupResult,
  cleanupResources,
  type DockerEnvironmentRestartEvent,
  type DockerEnvironmentResult,
  inspectResources,
  type ResourceInspection,
  type ResourceTarget,
  restartDockerEnvironment,
} from "../../../executor/src/index.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import { observeRepositoryExecutionDataArea } from "../configuration/runtime-data.ts";
import {
  readOperationStateStage,
  saveHostCleanupPreparation,
  saveOperationCheckpoint,
  saveOperationStart,
  saveResourceNotIssuedStage,
} from "../execution/persistence.ts";
import { snapshotJsonValue, snapshotPlainRecord } from "../input/snapshot.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
  providerHomesDirectoryCandidate,
  readExecutionCancellation,
  runtimeStateDirectoryCandidate,
} from "./authority.ts";
import { getIsolationSettings } from "./configuration.ts";
import {
  beginRuntimeOwnedCoordinatorHostSubmission,
  completeRuntimeOwnedCoordinatorHostSubmission,
} from "./controller.ts";
import {
  inspectRuntimeOwnedDevelopmentOperationContext,
  recoverDockerIsolationProbe,
} from "./diagnostics.ts";
import {
  acquireExecutionStateLock,
  acquireHostOperationLock,
  acquireProviderHomeLock,
} from "./kernel-lock.ts";
import {
  acquireHostOperationRecoveryGeneration,
  acquireHostOperationRecoveryGenerationByIdentity,
  borrowHostRecoveryManagementDirectory,
  borrowOwnedHostRecoverySnapshot,
  borrowOwnedOperationExecutionSelection,
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
  confirmOwnedDockerAbsenceForRecovery,
  consumeOwnedHostRecoveryIdForCleanup,
  issueOwnedHostCleanupCapability,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  verifyHostOperationRecoveryGeneration,
  verifyOwnedOperationManagementCapability,
} from "./operation.ts";
import { historyRepositoryInput, withHistoryRetention } from "./persistence.ts";
import { registerTaskRemediation } from "./preparation.ts";
import { poisonRuntimeProcessAfterCleanupUnknown } from "./process-safety-state.ts";
import type {
  AttemptCleanupInput,
  RecordedAttemptObservation,
  RecoveryPlan,
  RecoveryStartFailureDiagnostic,
  ResourceCleanupResult,
} from "./types.ts";
import { coordinatorReleasedTaskCanObserveHostAbsence } from "./validation.ts";
/**
 * docker-cleanup-eligibilityで使用するDocker 清掃 Handoff 候補の値契約を定義する。
 *
 * @responsibility Docker 清掃 Handoff 候補のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerCleanupHandoffCandidateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerCleanupHandoffCandidateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerCleanupHandoffCandidateの宣言は外部境界を開かない。
 * @security N/A: DockerCleanupHandoffCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerCleanupHandoffCandidateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerCleanupHandoffCandidate = Readonly<{
  state: string;
  recoveryId: string;
  capability: object;
}>;

/**
 * docker-cleanup-eligibilityで使用するDocker 清掃 Finalization 候補の値契約を定義する。
 *
 * @responsibility Docker 清掃 Finalization 候補のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerCleanupFinalizationCandidateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerCleanupFinalizationCandidateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerCleanupFinalizationCandidateの宣言は外部境界を開かない。
 * @security N/A: DockerCleanupFinalizationCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerCleanupFinalizationCandidateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerCleanupFinalizationCandidate = Readonly<{
  recoveryId: string;
  capability: object;
}>;

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
export type RawDockerRecoveryProjection = Readonly<{
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
 * exactな回復参照を既存の種類別Ownerで再入場する。
 * @responsibility CLIにあった対象相関と種類別接続を実行Ownerへ戻す。
 * @trace ARCH-000008
 * @input recoveryId: 元参照、rootCapability: 現在Repository、signal: 取消。
 * @returns 元参照に結合した既存回復結果又は固定拒否。
 * @precondition 呼出し元が今回の回復を明示要求する。
 * @postcondition 相関が確認できない対象へ処置せず、内部Rootを返さない。
 * @effect 既存の現在状態観測と、確認済みexact対象の正式回復だけ。
 * @failure 不正Signal・取消・対象不明では処置を開始しない。
 * @invariant 新しい回復ID・Registry・再試行・汎用強制清掃を追加しない。
 * @boundary 正式回復操作と既存Task／Host／診断／修復Owner。
 * @security 種類名だけで所有権を認定せず、元のRoot相関を必要とする。
 * @concurrency Taskの既存非同期取消を伝播する。同期Host処理に存在しない中断保証を作らない。
 */
export async function resumeRuntimeOwnedExecution(
  recoveryId: string,
  rootCapability: unknown,
  signal: AbortSignal,
) {
  const cancellation = readExecutionCancellation(signal);
  if (cancellation !== false) {
    if (recoveryId.startsWith("docker-runtime-repair."))
      return Object.freeze({
        status: "blocked" as const,
        reason:
          cancellation === null
            ? ("runtime_repair_boundary_unavailable" as const)
            : ("runtime_repair_cancelled" as const),
        recoveryId,
        finalCheckpointConfirmed: false,
        outcomeConfirmed: false,
        retentionConfirmed: false,
        retentionReviewAfter: null,
        historyConfirmed: false,
        completionConfirmed: false,
        operationCleanupConfirmed: false,
      });
    return Object.freeze({
      status: "blocked" as const,
      reason:
        cancellation === null
          ? "coordinator_recovery_signal_invalid"
          : "coordinator_recovery_cancelled",
      recoveryId,
      hostCleanupCompleted: false,
    });
  }
  if (recoveryId.startsWith("docker-task."))
    return recoverRuntimeOwnedDockerTaskForCurrentConsumer(
      recoveryId,
      rootCapability,
      signal,
    );
  if (recoveryId.startsWith("docker-runtime-repair."))
    return projectRuntimeRepairObservation(
      await repairRuntimeOwnedDockerRuntime(
        rootCapability,
        signal,
        recoveryId,
        "repair",
      ),
      recoveryId,
    );
  const operationRoot = resolveRuntimeOwnedCurrentRecoveryOperationRoot(
    recoveryId,
    rootCapability,
  );
  if (operationRoot === null)
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_recovery_current_operation_unconfirmed",
      recoveryId,
      hostCleanupCompleted: false,
    });
  return recoveryId.startsWith("host.")
    ? recoverOwnedOperationDirectories(recoveryId, null, operationRoot)
    : recoverDockerIsolationProbe(recoveryId, operationRoot);
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
 * Plain 記録が完全一致するか判定する。
 *
 * @responsibility Plain 記録の比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedKeys: readonly string[]
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedKeys: readonly string[]」がexactPlainRecordの入力契約を満たす。
 * @postcondition exactPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: exactPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactPlainRecordは独自の失敗分岐を所有しない。
 * @invariant exactPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: exactPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactPlainRecordは共有非同期状態を持たない同期処理である。
 */
function exactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
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
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  )
    return null;
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      return null;
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

/**
 * Plain 記録 Arrayが完全一致するか判定する。
 *
 * @responsibility Plain 記録 Arrayの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedRecordKeys: readonly string[]
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
  expectedRecordKeys: readonly string[],
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
    const record = exactPlainRecord(descriptor.value, expectedRecordKeys);
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
 * @returns snapshotInputの計算結果を返す。
 * @precondition 「value: unknown」がsnapshotInputの入力契約を満たす。
 * @postcondition snapshotInputの責務を完了した結果だけを返す。
 * @effect N/A: snapshotInputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotInputは独自の失敗分岐を所有しない。
 * @invariant snapshotInputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotInputはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotInputはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotInputは共有非同期状態を持たない同期処理である。
 */
function snapshotInput(value: unknown) {
  const input = exactPlainRecord(value, ["raw", "handoffs", "finalizations"]);
  if (!input) return null;
  const raw = exactPlainRecord(input.raw, [
    "singularPresent",
    "singular",
    "pluralPresent",
    "plural",
  ]);
  const handoffs = exactPlainRecordArray(input.handoffs, [
    "state",
    "recoveryId",
    "capability",
  ]);
  const finalizations = exactPlainRecordArray(input.finalizations, [
    "recoveryId",
    "capability",
  ]);
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
function evaluate(inputValue: unknown) {
  const input = snapshotInput(inputValue);
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
    return evaluate(input);
  } catch {
    return Object.freeze({ eligible: false, reason: "raw_invalid" });
  }
}

const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";

/**
 * 同じHostのRootとmarkerを、削除後も別々に観測する。
 * @responsibility 正規の親・記録領域とtokenへ対象を固定し、観測不能を不存在へ畳まない。
 * @trace ARCH-000008
 * @input token: exact Host参照、expectedRoot: 現在Identityの絶対Root。
 * @returns 二対象のpresent／absent／unknownと固定marker Path。
 * @precondition 処置Ownerと保持排他は呼出し側が別に照合する。
 * @postcondition ENOENTだけを不存在とし、両不存在だけでAuthorityを発行しない。
 * @effect 同じ親・記録領域・Root・markerの読取りだけ。
 * @failure 不正Path・link・親差・観測例外はunknown。
 * @invariant 別親探索、旧形式探索、作成・削除を行わない。
 * @boundary 現在Host IdentityとFilesystemの三値観測。
 * @security Package内部の所在確認であり公開出力へPathを搬送しない。
 * @concurrency 世代取得後と保存直前にも再観測する。
 */
export function observeHostRecoveryCleanup(
  token: unknown,
  expectedRoot: unknown,
): Readonly<{
  root: "present" | "absent" | "unknown";
  marker: "present" | "absent" | "unknown";
  markerPath: string | null;
}> {
  try {
    const parsed = parseHostRecoveryToken(token);
    if (
      typeof expectedRoot !== "string" ||
      !path.isAbsolute(expectedRoot) ||
      path.resolve(expectedRoot) !== expectedRoot ||
      path.basename(expectedRoot) !== parsed.rootName
    )
      throw new Error("host_recovery_root_mismatch");
    const parent = path.dirname(expectedRoot);
    const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
    for (const location of [parent, directory]) {
      const metadata = fs.lstatSync(location);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync(location) !== location
      )
        throw new Error("host_recovery_directory_untrusted");
    }
    const markerPath = path.join(
      directory,
      `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`,
    );
    const rootMetadata = fs.lstatSync(expectedRoot, { throwIfNoEntry: false });
    const markerMetadata = fs.lstatSync(markerPath, { throwIfNoEntry: false });
    if (
      rootMetadata &&
      (!rootMetadata.isDirectory() ||
        rootMetadata.isSymbolicLink() ||
        fs.realpathSync(expectedRoot) !== expectedRoot)
    )
      throw new Error("host_recovery_root_untrusted");
    if (
      markerMetadata &&
      (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    )
      throw new Error("host_recovery_record_untrusted");
    return Object.freeze({
      root: rootMetadata ? ("present" as const) : ("absent" as const),
      marker: markerMetadata ? ("present" as const) : ("absent" as const),
      markerPath,
    });
  } catch {
    return Object.freeze({
      root: "unknown" as const,
      marker: "unknown" as const,
      markerPath: null,
    });
  }
}

/**
 * Host 回復 記録 By Tokenを読み込む。
 *
 * @responsibility Host 回復 記録 By Tokenの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: exact参照、expectedRoot: 元Ownerまたは現在操作に結合した絶対Root。
 * @returns 同じRoot直下の親に保存されたexact markerと記録。
 * @precondition 親scopeの処置許可は呼出し元が別に確認する。
 * @postcondition 操作Root不存在でも同じ親以外を探索しない。
 * @effect 親・記録Directory・markerの読取りだけ。作成・書込みなし。
 * @failure loadHostRecoveryRecordByTokenは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadHostRecoveryRecordByTokenは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security loadHostRecoveryRecordByTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadHostRecoveryRecordByTokenは共有非同期状態を持たない同期処理である。
 */
export function loadHostRecoveryRecordByToken(
  token: unknown,
  expectedRoot: unknown,
) {
  const parsed = parseHostRecoveryToken(token);
  if (
    typeof expectedRoot !== "string" ||
    !path.isAbsolute(expectedRoot) ||
    path.resolve(expectedRoot) !== expectedRoot ||
    path.basename(expectedRoot) !== parsed.rootName
  )
    throw new Error("host_recovery_root_mismatch");
  const parent = path.dirname(expectedRoot);
  const parentMetadata = fs.lstatSync(parent);
  if (
    !parentMetadata.isDirectory() ||
    parentMetadata.isSymbolicLink() ||
    fs.realpathSync(parent) !== parent
  )
    throw new Error("host_recovery_parent_untrusted");
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  const realDirectory = fs.realpathSync(directory);
  const directoryMetadata = fs.lstatSync(realDirectory);
  if (
    realDirectory !== directory ||
    path.dirname(realDirectory) !== parent ||
    !directoryMetadata.isDirectory() ||
    directoryMetadata.isSymbolicLink()
  )
    throw new Error("host_recovery_directory_untrusted");
  const marker = path.join(
    realDirectory,
    `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`,
  );
  const markerMetadata = fs.lstatSync(marker);
  if (!markerMetadata.isFile() || markerMetadata.isSymbolicLink())
    throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(marker, "utf8");
  if (
    createHash("sha256").update(serialized).digest("hex") !== parsed.recordHash
  )
    throw new Error("host_recovery_record_mismatch");
  const record = JSON.parse(serialized);
  if (
    record.schema !== "crdd-coordinator-host-recovery/v1" ||
    record.rootName !== parsed.rootName
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  const after = fs.lstatSync(marker);
  if (
    !after.isFile() ||
    after.isSymbolicLink() ||
    after.dev !== markerMetadata.dev ||
    after.ino !== markerMetadata.ino ||
    after.birthtimeMs !== markerMetadata.birthtimeMs ||
    after.size !== markerMetadata.size ||
    fs.realpathSync(directory) !== directory ||
    fs.realpathSync(parent) !== parent
  )
    throw new Error("host_recovery_record_replaced");
  return {
    parsed,
    parent,
    directory: realDirectory,
    marker,
    record,
    serialized,
  };
}

/**
 * 保守候補の判定に必要な閉じた根拠集合を定義する。
 *
 * @responsibility 承認、対象、非使用、排他、耐久意図を別の条件として保持する。
 * @trace ARCH-000008
 * @shape Hashで固定した単一対象と、条件ごとの確認結果。
 * @invariant 未記載、未知値および観測不能は確認済みを意味しない。
 * @boundary 信頼された観測実装から内部判定への入力境界。
 * @security 入力自体はAuthorityではなく、判定結果から削除権限を発行しない。
 * @compatibility v1は空のhost_only領域だけに限定し、未知の資源クラスを拒否する。
 */
export type HostOrphanRecoveryEvidence = Readonly<{
  resourceClass: "empty_host_only_v1";
  snapshotSha256: string;
  approval: "fresh_exact" | "missing" | "denied" | "unknown";
  ownerScope: "confirmed" | "mismatch" | "unknown";
  identity: "exact" | "mismatch" | "unknown";
  recordState: "host_only" | "other" | "unknown";
  children: "six_empty_exact" | "different" | "unknown";
  dockerBinding: "absent" | "present" | "unknown";
  nonUse: "confirmed" | "in_use" | "unknown";
  initializationFence: "confirmed" | "missing" | "unknown";
  legacyFence: "confirmed" | "not_needed" | "missing" | "unknown";
  kernelLock: "held" | "busy" | "unknown";
  durableIntent:
    | "exact_non_authority_checkpoint"
    | "missing"
    | "mismatch"
    | "unknown";
}>;

/**
 * 実行権限を持たない候補判定を表す。
 *
 * @responsibility 条件充足と実処置・清掃完了を明示的に分離する。
 * @trace ARCH-000008
 * @shape candidate_readyまたはblocked、理由、対象Hash、非発行の固定field。
 * @invariant 全結果でAuthority非発行、清掃未確認、本番経路未接続を維持する。
 * @boundary 内部設計候補だけに利用し、公開Recovery結果として返さない。
 * @security 回復Token、Host Pathまたは削除Capabilityを含まない。
 * @compatibility 完成済みRecoveryのrecovered／cleanupConfirmed:trueへ変換してはならない。
 */
export type HostOrphanRecoveryPlan = Readonly<{
  status: "candidate_ready" | "blocked";
  reason: string;
  snapshotSha256: string | null;
  authorityConferred: false;
  cleanupConfirmed: false;
  productionConnected: false;
}>;

const REQUIRED_GATES = Object.freeze({
  approval: ["fresh_exact"],
  ownerScope: ["confirmed"],
  identity: ["exact"],
  recordState: ["host_only"],
  children: ["six_empty_exact"],
  dockerBinding: ["absent"],
  nonUse: ["confirmed"],
  initializationFence: ["confirmed"],
  legacyFence: ["confirmed", "not_needed"],
  kernelLock: ["held"],
  durableIntent: ["exact_non_authority_checkpoint"],
} as const);

/**
 * 渡された根拠集合を保守候補の条件と照合する。
 *
 * @responsibility 条件の欠落、差替え、観測不能を拒否し、充足時も候補判定だけを返す。
 * @trace ARCH-000008
 * @input 信頼された観測実装が生成する根拠集合の候補値。
 * @returns Authorityを持たない固定された候補判定。
 * @precondition N/A: 不正な値も受け取り、未知または未確認として拒否する。
 * @postcondition 元のRecovery IDを生成せず、実行や清掃成立を主張しない。
 * @effect N/A: Filesystem、Process、Lock、Providerを操作しない純粋な判定である。
 * @failure Proxy、Accessor、未知field、欠落および条件不成立をblockedとして返す。
 * @invariant inputの値や外部状態を変更せず、観測の実在性を自己証明しない。
 * @boundary 内部Policyの入力／判定境界。本番観測・CLIは未接続。
 * @security Hashや確認値をBearer権限へ変換せず、元TaskのAuthorityを再構成しない。
 * @concurrency N/A: 外部資源を所有せず、同期的に入力のown data fieldだけを照合する。
 */
export function evaluateHostOrphanRecoveryPlan(
  input: unknown,
): HostOrphanRecoveryPlan {
  let snapshotSha256: string | null = null;
  let reason = "host_orphan_evidence_invalid";
  if (
    input !== null &&
    typeof input === "object" &&
    !types.isProxy(input) &&
    !Array.isArray(input)
  ) {
    const prototype = Object.getPrototypeOf(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const allowed = new Set([
      "resourceClass",
      "snapshotSha256",
      ...Object.keys(REQUIRED_GATES),
    ]);
    const keys = Reflect.ownKeys(input);
    if (
      (prototype === Object.prototype || prototype === null) &&
      keys.length === allowed.size &&
      keys.every(
        (key) =>
          typeof key === "string" &&
          allowed.has(key) &&
          Object.hasOwn(descriptors[key] ?? {}, "value"),
      )
    ) {
      const hash: unknown = descriptors.snapshotSha256?.value;
      if (typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash)) {
        snapshotSha256 = hash;
        reason = "host_orphan_resource_class_unsupported";
        if (descriptors.resourceClass?.value === "empty_host_only_v1") {
          reason = "host_orphan_candidate_conditions_satisfied";
          for (const [gate, expected] of Object.entries(REQUIRED_GATES)) {
            const observed: unknown = descriptors[gate]?.value;
            if (
              typeof observed !== "string" ||
              !(expected as readonly string[]).includes(observed)
            ) {
              reason = `host_orphan_${gate}_unconfirmed`;
              break;
            }
          }
        }
      }
    }
  }
  return Object.freeze({
    status:
      reason === "host_orphan_candidate_conditions_satisfied"
        ? "candidate_ready"
        : "blocked",
    reason,
    snapshotSha256,
    authorityConferred: false,
    cleanupConfirmed: false,
    productionConnected: false,
  });
}

/**
 * 検証済みRepositoryの現在記録からHost／Probe回復先を解決する。
 * @responsibility exact参照、単一一致、Readerの排他解放を照合する。
 * @trace ARCH-000008
 * @input recoveryId: 明示回復参照、repositoryRoot: 呼出し元が検証したRoot Capability。
 * @returns 対応する操作Root、またはnull。
 * @precondition 現在Repositoryの検証済みCapabilityを渡す。
 * @postcondition 欠測・複数一致・読取り不明ではRootを返さない。
 * @effect 既存の現在状態Readerと短期排他だけを使用する。
 * @failure 不正参照・Reader拒否・例外・解放不明ではnull。
 * @invariant Pathは処置Authorityではなく、下位が元世代と実体を再照合する。
 * @boundary 現在状態とHost／Probe回復対象の解決。
 * @security cwd再解決・広域探索・新しい回復Authorityを行わない。
 * @concurrency fresh Readerの排他解放後に所在を返す。
 */
export function resolveRuntimeOwnedCurrentRecoveryOperationRoot(
  recoveryId: string,
  repositoryRoot: unknown,
): string | null {
  try {
    const match =
      /^(host|docker)\.(crdd-coordinator-doctor-[A-Za-z0-9_-]+)\./u.exec(
        recoveryId,
      );
    if (!match?.[2]) return null;
    const current = readState(repositoryRoot, { scope: "recovery" });
    if (
      current.status !== "completed" ||
      !current.lockReleased ||
      !current.value
    )
      return null;
    const matches = current.value.snapshot.operations.filter((operation) => {
      if (operation.kind !== "docker_task") return false;
      const identity = JSON.parse(operation.identityJson);
      return (
        typeof identity.hostPaths.root === "string" &&
        path.isAbsolute(identity.hostPaths.root) &&
        path.basename(identity.hostPaths.root) === match[2] &&
        (match[1] === "host"
          ? operation.host.currentToken === recoveryId
          : identity.operationMode === "boolean_probe")
      );
    });
    if (matches.length !== 1 || !matches[0]) return null;
    return JSON.parse(matches[0].identityJson).hostPaths.root;
  } catch {
    return null;
  }
}

/**
 * 現在Repositoryの状態をTask入場前に観測する。
 * @responsibility 安定した読取りと初回不存在だけを入場可へ投影する。
 * @trace ARCH-000008
 * @input repositoryRoot: 同じTaskまたは診断が検査するRoot。
 * @returns 入場可否、固定理由、排他解放の観測だけ。
 * @precondition 操作間の衝突は後続beginが実Homeに対して判定する。
 * @postcondition 未解決や配送を含む安定Snapshotを全域拒否しない。
 * @effect Root検証と現在状態Readerによる読取りだけ。
 * @failure Root不正、部分保存、観測不能、解放不明はblocked。
 * @invariant 入場可能から初期化資格・処置許可・資源不存在を推定しない。
 * @boundary Task／診断入口とRepository-local現在状態。
 * @security Snapshot、内部ID、Home Hash、生Pathを返さない。
 * @concurrency Kernel解放確認後にだけavailableを返す。
 */
export function inspectRuntimeOwnedDockerTaskAdmission(
  repositoryRoot: unknown,
) {
  let lockReleased = false;
  try {
    const root = getRepository(repositoryRoot);
    if (root.status !== "completed")
      return Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_current_admission_unconfirmed" as const,
        lockReleased: true,
      });
    const observed = readState(root.capability, {
      scope: "recovery",
      input: { kind: "admission" },
    });
    lockReleased = observed.lockReleased;
    if (
      lockReleased &&
      ((observed.status === "completed" && observed.value !== null) ||
        (observed.status === "blocked" &&
          observed.reason === "coordinator_state_uninitialized"))
    )
      return Object.freeze({
        status: "available" as const,
        reason: "coordinator_current_admission_available" as const,
        lockReleased: true as const,
      });
  } catch {
    // 未観測は入場可へ変換しない。
  }
  return Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_current_admission_unconfirmed" as const,
    lockReleased,
  });
}

/**
 * canonicalを決定する。
 *
 * @responsibility canonicalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns canonicalの計算結果を返す。
 * @precondition 「value: unknown」がcanonicalの入力契約を満たす。
 * @postcondition canonicalの責務を完了した結果だけを返す。
 * @effect N/A: canonicalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalは独自の失敗分岐を所有しない。
 * @invariant canonicalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalはProcess内の同一Subsystemで完結する。
 * @security canonicalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalは共有非同期状態を持たない同期処理である。
 */
function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

const HEX64 = /^[a-f0-9]{64}$/u;

const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);

/**
 * docker-recovery-runtime-internalで使用するProduction Planの値契約を定義する。
 *
 * @responsibility Production PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProductionPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProductionPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProductionPlanの宣言は外部境界を開かない。
 * @security ProductionPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProductionPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProductionPlan = Readonly<{
  provider: "codex" | "claude";
  consumer: "coordinator_cli" | "workbench" | "orchestrator";
  operationId: string;
  recoveryCorrelationId?: string | null;
  grantRef: string;
  executionSelection: ExecutionSelection;
  taskAttempt: 0 | 1;
  providerHomeIdentityHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  workspaceMountMode: "read_write" | "read_only" | null;
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
}>;

/**
 * docker-recovery-runtime-internalで使用するDurable 記録の値契約を定義する。
 *
 * @responsibility Durable 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DurableRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DurableRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: DurableRecordの宣言は外部境界を開かない。
 * @security DurableRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DurableRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DurableRecord = {
  executor?: Executor<"attempt">;
  executorControl?: object;
  capability: object;
  recoveryId: string;
  managementCapability: object;
  operationId: string;
  operationNonce: string;
  stableLogicalHomeBindingHash: string;
  homeLeaseReleased: boolean;
  settlementContext: object | null;
  initializationReady: boolean;
  initializationIdentityJson: string;
  initializationResult?: ReturnType<typeof saveOperationStart>;
  initializationFailure?: string;
  initializationHostResult?: ReturnType<
    typeof beginRuntimeOwnedCoordinatorHostSubmission
  >;
  initializationLeaseReleaseConfirmed?: boolean;
  consumer: ProductionPlan["consumer"];
  hostCleanupOutcome?: unknown;
  dockerCompletion?: unknown;
  terminalObservation?: RecordedAttemptObservation;
  settlementResult?: ReturnType<typeof completeOperation>;
  mountCompletion?: unknown;
  cleanupCheckpoint?: Readonly<{ revision: number; payloadSha256: string }>;
  normalRestoration?: {
    plan: unknown;
    mountCompletion: unknown;
    identityJson: string;
    result: ReturnType<typeof completeRuntimeOwnedCoordinatorHostSubmission>;
  };
  hostCleanupPreparation?: {
    token: string;
    tokenMatches: boolean;
    before: Buffer;
  };
};

const durableRecords = new WeakMap<object, DurableRecord>();

/**
 * 保存済みの元記録へ試行専用Executorと開始Controlを寿命結合する。
 * @responsibility 取消の配送先だけを保持し、Controlを回復Authorityへ昇格しない。
 * @trace ARCH-000008
 * @effect 既存のdurableRecordsだけへ元Controlのaliasを登録し、終端で削除する。
 * @failure 保存・Owner・元参照の不一致又は再結合はfalse。
 * @invariant 保存前・未開始ではControlを登録せず、元completionと結果を置換しない。
 */
export function bindRuntimeOwnedExecutorAttempt(
  capability: object,
  management: object,
  executor: Executor<"attempt">,
  started?: StartResult<"attempt">,
): boolean {
  const record = durableRecord(capability);
  if (
    !record ||
    record.managementCapability !== management ||
    (record.executor !== undefined && record.executor !== executor)
  )
    return false;
  if (started === undefined) {
    record.executor = executor;
    return true;
  }
  if (
    started.status !== "started" ||
    started.recoveryId !== record.recoveryId ||
    record.executor !== executor ||
    record.executorControl !== undefined ||
    started.controlCapability === capability ||
    durableRecords.has(started.controlCapability)
  )
    return false;
  const control = started.controlCapability;
  record.executorControl = control;
  durableRecords.set(control, record);
  const close = (result?: CompletionResult<"attempt">) => {
    if (record.executorControl !== control) return;
    durableRecords.delete(control);
    delete record.executorControl;
    if (result?.homeLeaseReleased) delete record.executor;
  };
  void started.completion.then(close, () => close());
  return true;
}

/**
 * 元Controlだけを保存時と同じExecutorへ取消配送する。
 * @responsibility 回復検索とは別のexact Control・管理Owner照合を行う。
 * @trace ARCH-000008
 * @effect 成立時だけ同じExecutorのcancelを呼ぶ。
 * @invariant コピーControl・回復Capability・終端aliasを取消に使わない。
 */
export async function cancelRuntimeOwnedExecutorAttempt(
  control: unknown,
  management: unknown,
) {
  const record =
    control && typeof control === "object" ? durableRecords.get(control) : null;
  if (
    !record?.initializationReady ||
    !record.executor ||
    record.executorControl !== control ||
    record.capability === control ||
    record.managementCapability !== management
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "invalid" as const,
    });
  return record.executor.cancel({
    controlCapability: control,
    managementCapability: management,
  });
}

/**
 * 元の回復Capabilityから同じ試行の明示終了だけを照会する。
 * @responsibility Control aliasを拒否し、技術Home解放の判断をExecutorへ残す。
 * @trace ARCH-000008
 * @effect 同じExecutorの既存abandonだけを呼ぶ。解放条件は変えない。
 */
export function abandonRuntimeOwnedExecutorAttempt(
  capability: unknown,
  management: unknown,
): boolean {
  const record = durableRecord(capability, false);
  return (
    !!record &&
    record.managementCapability === management &&
    record.executor?.abandon({
      recoveryCapability: capability,
      managementCapability: management,
    }) === true
  );
}

const dockerHostCleanupCapabilities = new WeakMap<object, object>();

/**
 * docker-recovery-runtime-internalで使用するDocker Restart Preparationの値契約を定義する。
 *
 * @responsibility Docker Restart PreparationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerRestartPreparationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerRestartPreparationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerRestartPreparationの宣言は外部境界を開かない。
 * @security DockerRestartPreparationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerRestartPreparationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerRestartPreparation = Readonly<{
  kind: "restart";
  repository: NonNullable<
    ReturnType<typeof borrowRuntimeOwnedCoordinatorRecoveryRepository>
  > & { operationId: string };
  rootCapability: unknown;
  recoveryId: string;
  requestId: string;
  scopeSha256: string;
  recoveryIds: readonly string[];
  locks: readonly Readonly<{
    assertLive: () => boolean;
    release: () => boolean;
  }>[];
}> & {
  closed: boolean;
  persistenceFailed: boolean;
  cleanupUnknown: boolean;
  releaseAttempted: boolean;
  releaseConfirmed: boolean;
  finalizationAttempted: boolean;
  before: Buffer;
  checkpoint: RestartCheckpoint | null;
};

/**
 * 現在操作の回収だけに限定した短命Owner。
 * @responsibility 元Repository・操作・Host世代・保持排他と元本文を共同保持する。
 * @trace ARCH-000008
 * @shape 回復種別、固定結合、Host marker、取得済み排他と保存失効状態。
 * @invariant 元management、署名Root、旧Journalを復元しない。
 * @boundary 現在状態Readerと既存Host／Home／Runtime排他。
 * @security 保存値だけでOwnerを生成せず、公開Rootへ内部値を出さない。
 * @compatibility 最新Schemaだけを扱う。
 */
type ExecutionOperationState = Extract<
  NonNullable<ReturnType<typeof readState>["value"]>["operationStates"][number],
  { kind: "docker_task" }
>;
type RepairOperationState = Extract<
  NonNullable<ReturnType<typeof readState>["value"]>["operationStates"][number],
  { kind: "runtime_repair" }
>;

type DockerTaskRecoveryPreparation = {
  kind: "recovery";
  repository: DockerRestartPreparation["repository"];
  rootCapability: unknown;
  recoveryId: string;
  hostGeneration: object;
  hostRoot: string;
  hostToken: string;
  hostNonce: string;
  locks: DockerRestartPreparation["locks"];
  before: Buffer;
  /** beforeと同じ版。保存・fresh Readerの相関確認後にだけ一緒に更新する。 */
  snapshot: ExecutionStateSnapshot;
  operationStates: NonNullable<
    ReturnType<typeof readState>["value"]
  >["operationStates"];
  closed: boolean;
  persistenceFailed: boolean;
  cleanupUnknown: boolean;
  releaseAttempted: boolean;
  releaseConfirmed: boolean;
  finalizationAttempted: boolean;
  completionAttempted: boolean;
  completionPending: boolean;
  hostCleanup: "present" | "absent" | "unknown";
  hostCleanupPublication: ReturnType<
    typeof readState
  >["hostCleanupPublication"];
};

const dockerRecoveryPreparations = new WeakMap<
  object,
  DockerRestartPreparation | DockerTaskRecoveryPreparation
>();

/**
 * 回収Ownerの保持状態と同じHost markerを再確認する。
 * @responsibility 私有Mapの真正性、既存排他、RepositoryとHost世代を共同確認する。
 * @trace ARCH-000008
 * @input capability: 私有準備キー、record: 同キーの回復結合。
 * @returns 同じ生存Ownerの場合だけtrue。
 * @precondition 元版照合は呼出し側のReaderとWriterが別に行う。
 * @postcondition markerや排他欠測から書込み可能と推定しない。
 * @effect Repository・Host marker・既存排他の読取りのみ。
 * @failure 不一致、失効、例外はfalse。
 * @invariant 元managementや旧Journalを復元しない。
 * @boundary 同一Processの回収OwnerとHost／Repository観測。
 * @security 私有Mapへの結合なしに任意callbackを受理しない。
 * @concurrency 各Writer直前とWriter内部で再確認する。
 */
function assertCurrentRecoveryOwner(
  capability: object,
  record: DockerTaskRecoveryPreparation,
): boolean {
  try {
    if (
      dockerRecoveryPreparations.get(capability) !== record ||
      record.closed ||
      !record.repository.revalidate()
    )
      return false;
    try {
      for (const lock of record.locks) {
        if (lock.assertLive() !== true) {
          record.cleanupUnknown = true;
          return false;
        }
      }
      verifyHostOperationRecoveryGeneration(
        record.hostGeneration,
        record.hostRoot,
        record.hostNonce,
      );
    } catch {
      record.cleanupUnknown = true;
      return false;
    }
    if (record.hostCleanup === "unknown") return false;
    if (record.hostCleanup === "absent") {
      const observed = observeHostRecoveryCleanup(
        record.hostToken,
        record.hostRoot,
      );
      return observed.root === "absent" && observed.marker === "absent";
    }
    const loaded = loadHostRecoveryRecordByToken(
      record.hostToken,
      record.hostRoot,
    );
    return loaded.parsed.nonce === record.hostNonce;
  } catch {
    return false;
  }
}

/**
 * 保存済みHost遷移の旧tokenまたは予定tokenだけを実markerへ照合する。
 * @responsibility Host処置後の保存不明でも別markerや任意の後続状態を採用しない。
 * @trace ARCH-000008
 * @input operation: 復号済み現在操作、hostRoot: Identityが固定したRoot。
 * @returns 現在実markerと一致する同じ旧tokenまたは保存済み予定token。
 * @precondition Rootと操作Identityの結合は呼出し側が検査する。
 * @postcondition 予定tokenの採用は既存世代排他の取得許可や清掃完了を意味しない。
 * @effect 同じRootのHost marker読取りのみ。遷移・削除は行わない。
 * @failure 不正lineage、未知資源、未失効Owner、別本文、観測不能は例外で停止する。
 * @invariant 作成結果不明を不存在へ変換せず、旧形式や別Rootへfallbackしない。
 * @boundary 現在stateの保存済み意図と実Host記録。
 * @security 保存JSONだけではOwnerを作らず、取得後にも同じ実markerを確認する。
 * @concurrency 操作全元版の取得前後一致と既存三種排他は外側準備が保持する。
 */
function resolveCurrentRecoveryHostToken(
  operation: ExecutionOperationRecord,
  hostRoot: string,
  resourcesSettled: boolean,
  lineage: ExecutionOperationState["hostTransition"],
): string {
  const currentToken = operation.host.currentToken;
  if (operation.host.pendingTransitionJson === null) return currentToken;
  const intent = JSON.parse(operation.host.pendingTransitionJson);
  if (intent.nextState !== "docker_absent_confirmed")
    throw new Error("docker_task_recovery_host_transition_mismatch");
  if (
    !lineage ||
    intent.currentState !== "docker_submission_started" ||
    lineage.currentToken !== currentToken ||
    operation.execution.ownerEffect !== "disabled" ||
    !resourcesSettled
  )
    throw new Error("docker_task_recovery_host_transition_mismatch");
  let loaded: ReturnType<typeof loadHostRecoveryRecordByToken>;
  try {
    loaded = loadHostRecoveryRecordByToken(currentToken, hostRoot);
  } catch {
    loaded = loadHostRecoveryRecordByToken(lineage.expectedToken, hostRoot);
    if (
      loaded.serialized !==
      canonical({ ...intent.recordBefore, state: "docker_absent_confirmed" })
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    return lineage.expectedToken;
  }
  if (loaded.serialized !== canonical(intent.recordBefore))
    throw new Error("docker_task_recovery_host_transition_mismatch");
  return currentToken;
}

/**
 * 現在Repositoryのexact操作に限定したfresh回収Ownerを取得する。
 * @responsibility 現在本文と既存Host世代・Home・Runtime排他を共同保持する。
 * @trace ARCH-000008
 * @input token: 現在Taskのexact回復参照、rootCapability: 検証済みRepository。
 * @returns 短命な回収準備、または元参照・一次拒否と回収確認を持つblocked。
 * @precondition 現在Schemaを使い、旧Ownerの排他が終了している。
 * @postcondition 取得成功をDocker不存在・Host清掃・Lease解放へ昇格しない。
 * @effect 現在state／marker読取りと既存三種排他の取得だけ。
 * @failure 対象欠落、現在値不明、競合、marker差、排他欠測を固定拒否する。
 * @invariant raw Host Lockを二重取得せず、旧AppData・署名・Journalへfallbackしない。
 * @boundary 現在Readerと既存Host／Home／Runtimeの保持境界。
 * @security Root Readerや保存JSONだけから書込みOwnerを生成しない。
 * @concurrency 決定順取得、全元版再照合、部分失敗時の全逆順解放を行う。
 */
export function prepareRuntimeOwnedDockerTaskRecovery(
  token: unknown,
  rootCapability: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const locks: Array<{ assertLive: () => boolean; release: () => boolean }> =
    [];
  let cleanupConfirmed = true;
  let acquisitionPending = false;
  let reason = "docker_task_recovery_preparation_unconfirmed";
  try {
    if (!parsed) {
      reason = "docker_task_recovery_id_invalid";
      throw new Error(reason);
    }
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    let initial = readState(rootCapability, { scope: "recovery" });
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readState(rootCapability, {
        scope: "recovery",
        input: {
          kind: "resource_publication",
          recoveryId: parsed.token,
        },
      });
    const savedTerminal =
      initial.value?.snapshot.operations.some(
        (item) =>
          item.kind === "docker_task" &&
          item.recoveryId === parsed.token &&
          item.lease === "released" &&
          item.outcome?.cleanupConfirmed === true,
      ) === true;
    if (savedTerminal)
      initial = readState(historyRepositoryInput(rootCapability), {
        scope: "recovery",
        input: {
          kind: "execution_history",
          recoveryId: parsed.token,
        },
      });
    if (initial.status === "blocked" && initial.lockReleased)
      initial = readState(rootCapability, {
        scope: "recovery",
        input: {
          kind: "host_cleanup",
          recoveryId: parsed.token,
        },
      });
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readState(historyRepositoryInput(rootCapability), {
        scope: "recovery",
        input: {
          kind: "execution_history",
          recoveryId: parsed.token,
        },
      });
    if (initial.status !== "completed" && initial.lockReleased)
      initial = readState(rootCapability, {
        scope: "recovery",
        input: {
          kind: "execution_completion",
          recoveryId: parsed.token,
        },
      });
    cleanupConfirmed = initial.lockReleased;
    if (
      !repository ||
      initial.status !== "completed" ||
      !initial.value ||
      !initial.lockReleased
    )
      throw new Error(reason);
    const targets = initial.value.snapshot.operations.filter(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === parsed.token,
    );
    const target = targets[0];
    const targetState = initial.value.operationStates.find(
      (state): state is ExecutionOperationState =>
        state.kind === "docker_task" && state.operation === target,
    );
    if (
      targets.length !== 1 ||
      !target ||
      targetState?.kind !== "docker_task"
    ) {
      reason = "docker_task_recovery_current_operation_unconfirmed";
      throw new Error(reason);
    }
    const identity = JSON.parse(target.identityJson);
    const host = parseHostRecoveryToken(target.host.currentToken);
    const initialHost = parseHostRecoveryToken(identity.initialHostRecoveryId);
    if (
      host.rootName !== initialHost.rootName ||
      host.nonce !== initialHost.nonce ||
      typeof identity.hostPaths.root !== "string" ||
      path.basename(identity.hostPaths.root) !== host.rootName
    )
      throw new Error(reason);
    let hostCleanup: DockerTaskRecoveryPreparation["hostCleanup"] = "present";
    if (
      target.host.cleanup !== "not_requested" ||
      coordinatorReleasedTaskCanObserveHostAbsence(target, targetState)
    ) {
      const observed = observeHostRecoveryCleanup(
        target.host.currentToken,
        identity.hostPaths.root,
      );
      if (
        observed.root === "unknown" ||
        observed.marker === "unknown" ||
        (identity.hostPaths.marker !== undefined &&
          identity.hostPaths.marker !== observed.markerPath)
      )
        throw new Error(reason);
      if (observed.root === "absent" && observed.marker === "absent") {
        if (
          target.host.pendingTransitionJson !== null ||
          target.execution.ownerEffect !== "disabled" ||
          !targetState.resourcesSettled
        )
          throw new Error(reason);
        hostCleanup = "absent";
      } else if (
        target.host.cleanup === "confirmed" ||
        observed.marker !== "present"
      )
        throw new Error(reason);
    }
    if (initial.hostCleanupPublication && hostCleanup !== "absent")
      throw new Error(reason);
    const observedHostToken =
      hostCleanup === "absent"
        ? target.host.currentToken
        : resolveCurrentRecoveryHostToken(
            target,
            identity.hostPaths.root,
            targetState.resourcesSettled,
            targetState.hostTransition,
          );
    acquisitionPending = true;
    const generation =
      hostCleanup === "absent"
        ? acquireHostOperationRecoveryGenerationByIdentity(
            identity.hostPaths.root,
            host.nonce,
          )
        : acquireHostOperationRecoveryGeneration(
            observedHostToken,
            identity.hostPaths.root,
          );
    if (!generation) {
      reason = "docker_task_recovery_host_active_or_unknown";
      throw new Error(reason);
    }
    locks.push({
      assertLive: () => {
        verifyHostOperationRecoveryGeneration(
          generation,
          identity.hostPaths.root,
          host.nonce,
        );
        return true;
      },
      release: () => releaseHostOperationRecoveryGeneration(generation),
    });
    acquisitionPending = false;
    verifyHostOperationRecoveryGeneration(
      generation,
      identity.hostPaths.root,
      host.nonce,
    );
    if (hostCleanup === "present")
      loadHostRecoveryRecordByToken(observedHostToken, identity.hostPaths.root);
    else {
      const observed = observeHostRecoveryCleanup(
        observedHostToken,
        identity.hostPaths.root,
      );
      if (observed.root !== "absent" || observed.marker !== "absent")
        throw new Error(reason);
    }
    acquisitionPending = true;
    const home = acquireProviderHomeLock(
      parsed.stableLogicalHomeBindingHash,
      providerHomesDirectoryCandidate(),
    );
    if (home.status !== "acquired") {
      cleanupConfirmed &&= home.cleanupConfirmed;
      if (!home.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
      reason =
        home.reason === "lock_initialization_failed"
          ? "docker_task_recovery_home_lock_initialization_failed"
          : "docker_task_recovery_home_active_or_unknown";
      throw new Error(reason);
    }
    locks.push(home.lock);
    const runtime = acquireExecutionStateLock(runtimeStateDirectoryCandidate());
    if (runtime.status !== "acquired") {
      cleanupConfirmed &&= runtime.cleanupConfirmed;
      if (!runtime.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
      reason =
        runtime.reason === "lock_initialization_failed"
          ? "docker_task_recovery_runtime_lock_initialization_failed"
          : "docker_task_recovery_runtime_active_or_unknown";
      throw new Error(reason);
    }
    locks.push(runtime.lock);
    acquisitionPending = false;
    const publication = initial.hostCleanupPublication ?? null;
    let current = initial.resourcePublication
      ? readState(rootCapability, {
          scope: "recovery",
          input: {
            kind: "resource_publication",
            recoveryId: parsed.token,
          },
        })
      : publication
        ? readState(rootCapability, {
            scope: "recovery",
            input: {
              kind: "host_cleanup",
              recoveryId: parsed.token,
            },
          })
        : initial.currentHistoryPublication
          ? readState(historyRepositoryInput(rootCapability), {
              scope: "recovery",
              input: {
                kind: "execution_history",
                recoveryId: parsed.token,
              },
            })
          : initial.currentCompletionPublication
            ? readState(rootCapability, {
                scope: "recovery",
                input: {
                  kind: "execution_completion",
                  recoveryId: parsed.token,
                },
              })
            : readState(rootCapability, { scope: "recovery" });
    cleanupConfirmed &&= current.lockReleased;
    let before = Buffer.from(initial.value.sourceText, "utf8");
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(before) ||
      (publication &&
        (!current.hostCleanupPublication ||
          current.hostCleanupPublication.mode !== publication.mode ||
          !current.hostCleanupPublication.before.equals(publication.before) ||
          !current.hostCleanupPublication.candidate.equals(
            publication.candidate,
          ))) ||
      (initial.resourcePublication &&
        (!current.resourcePublication?.before.equals(
          initial.resourcePublication.before,
        ) ||
          !current.resourcePublication.candidate.equals(
            initial.resourcePublication.candidate,
          )))
    ) {
      reason = "docker_task_recovery_boundary_changed";
      throw new Error(reason);
    }
    if (initial.resourcePublication) {
      const resumed = saveRecoveryCheckpoint(
        { ...repository, operationId: identity.operationId },
        parsed.token,
        null,
        {
          kind: "resource_publication",
          publication: initial.resourcePublication,
          assertOwner: () => {
            if (
              !repository.revalidate() ||
              locks.some((lock) => lock.assertLive() !== true)
            )
              return false;
            verifyHostOperationRecoveryGeneration(
              generation,
              identity.hostPaths.root,
              host.nonce,
            );
            loadHostRecoveryRecordByToken(
              observedHostToken,
              identity.hostPaths.root,
            );
            return true;
          },
        },
      );
      cleanupConfirmed &&= resumed.lockReleased;
      if (
        resumed.status !== "completed" ||
        !resumed.snapshotConfirmed ||
        !resumed.lockReleased
      ) {
        reason = "docker_task_recovery_resource_publication_unconfirmed";
        throw new Error(reason);
      }
      current = readState(rootCapability, { scope: "recovery" });
      cleanupConfirmed &&= current.lockReleased;
      if (
        current.status !== "completed" ||
        !current.value ||
        !current.lockReleased ||
        !Buffer.from(current.value.sourceText, "utf8").equals(
          initial.resourcePublication.candidate,
        )
      ) {
        reason = "docker_task_recovery_resource_publication_unconfirmed";
        throw new Error(reason);
      }
      before = Buffer.from(initial.resourcePublication.candidate);
    }
    const capability = Object.freeze({});
    const record: DockerTaskRecoveryPreparation = {
      kind: "recovery",
      repository: Object.freeze({
        ...repository,
        operationId: identity.operationId,
      }),
      rootCapability,
      recoveryId: target.recoveryId,
      hostGeneration: generation,
      hostRoot: identity.hostPaths.root,
      hostToken: observedHostToken,
      hostNonce: host.nonce,
      locks: Object.freeze(locks),
      before,
      snapshot: current.value.snapshot,
      operationStates: current.value.operationStates,
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup,
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
      completionAttempted: false,
      completionPending: Boolean(initial.currentCompletionPublication),
      hostCleanupPublication: publication
        ? Object.freeze({
            ...publication,
            before: Buffer.from(publication.before),
            candidate: Buffer.from(publication.candidate),
          })
        : null,
    };
    dockerRecoveryPreparations.set(capability, record);
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.closed = true;
      throw new Error(reason);
    }
    return Object.freeze({
      status: "prepared" as const,
      capability,
      recoveryId: target.recoveryId,
      cleanupConfirmed: true,
    });
  } catch {
    if (acquisitionPending) cleanupConfirmed = false;
    for (const lock of [...locks].reverse()) {
      try {
        if (!lock.release()) cleanupConfirmed = false;
      } catch {
        cleanupConfirmed = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      recoveryId: parsed?.token ?? null,
      reason,
      cleanupConfirmed,
    });
  }
}

/**
 * 保持中の回収Ownerの固定途中評価を現在状態へ確定する。
 * @responsibility 元本文の競合、保存不明と失効後の追加Writerを拒否する。
 * @trace ARCH-000008
 * @input capability: 私有回収準備、kind・value: 固定途中checkpoint。
 * @returns 保存・全読戻し・短命Writer排他の解放・保持中Ownerの再確認が成立した場合だけtrue。
 * @precondition 同じHost markerと三種排他が生存している。
 * @postcondition 確認済み次版本文だけをOwnerの元版へ更新する。
 * @effect 同じ操作の固定state更新と読戻しだけ。
 * @failure 偽造、コピー、種別差、失効・元版差・保存不明は停止する。
 * @invariant 不明後の追加Writerを停止し、旧要求成功やDocker回収成功を推定しない。
 * @boundary 私有回収Ownerと既存Writer／Reader。
 * @security 任意candidate、外部callback、旧実行Capabilityを受け取らない。
 * @concurrency 保存内の再確認と保存後の全版相関を行う。
 */
export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
  capability: unknown,
  kind: "resource" | "cleanup" | "host" | "lifecycle",
  value: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  const absentHostCheckpoint =
    record?.kind === "recovery" &&
    record.hostCleanup === "absent" &&
    kind === "host";
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    (record.hostCleanup !== "present" && !absentHostCheckpoint) ||
    record.hostCleanupPublication !== null
  )
    return false;
  record.persistenceFailed = true;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const checkpointValue =
      kind === "host"
        ? (snapshotJsonValue(value) as Record<string, unknown>)
        : value;
    if (absentHostCheckpoint) {
      const operation = record.snapshot.operations.find(
        (item): item is ExecutionOperationRecord =>
          item.kind === "docker_task" && item.recoveryId === record.recoveryId,
      );
      if (
        !operation ||
        !coordinatorReleasedTaskCanObserveHostAbsence(
          operation,
          record.operationStates.find(
            (state): state is ExecutionOperationState =>
              state.kind === "docker_task" && state.operation === operation,
          ),
        ) ||
        operation.host.cleanup !== "not_requested" ||
        !isDeepStrictEqual(
          snapshotJsonValue(checkpointValue),
          snapshotJsonValue({ ...operation.host, cleanup: "pending" }),
        )
      )
        return false;
    }
    if (
      kind === "host" &&
      (checkpointValue as Record<string, unknown>).currentToken !==
        record.hostToken
    )
      return false;
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind: kind,
        value: checkpointValue,
        assertOwner: () => assertCurrentRecoveryOwner(capability, record),
      },
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const current = readState(record.rootCapability, { scope: "recovery" });
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      current.value.snapshot.revision !== saved.revision ||
      current.value.payloadSha256 !== saved.payloadSha256
    )
      return false;
    record.before = Buffer.from(current.value.sourceText, "utf8");
    record.snapshot = current.value.snapshot;
    record.operationStates = current.value.operationStates;
    const confirmed = assertCurrentRecoveryOwner(capability, record);
    record.persistenceFailed = !confirmed;
    return confirmed;
  } catch {
    return false;
  }
}

/**
 * 現在の三排他を保持する回収Ownerから旧実行Ownerの退役だけを保存する。
 * @responsibility 既存の実行評価を保持し、新規要求不能の確定を資源清掃から分離する。
 * @trace ARCH-000008
 * @input capability: 同じProcessの私有回収準備。
 * @returns 元版照合と必要な保存・読戻しが成立した場合だけtrue。
 * @precondition 同Root・Host世代とHost／Home／Runtime排他を保持する。
 * @postcondition 既にdisabledなら書込み0。新規退役では他の評価と結果を変更しない。
 * @effect 既存stateのphaseとownerEffectだけを更新する。Docker／Host操作なし。
 * @failure 偽造・元版差・排他不明・後期状態・保存不明では後段を拒否する。
 * @invariant disabledは孤立CLI終了・遅延create無害化・資源不存在を意味しない。
 * @boundary 現在回収Ownerと既存lifecycle Writer。
 * @security 任意の候補値や外部の成功申告を受け取らない。
 * @concurrency fresh全文と実効排他を保存前後で照合する。
 */
function retireRuntimeOwnedDockerTaskExecutionOwner(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      return false;
    }
    let current =
      record.completionPending === true
        ? readState(record.rootCapability, {
            scope: "recovery",
            input: {
              kind: "execution_completion",
              recoveryId: record.recoveryId,
            },
          })
        : readState(record.rootCapability, { scope: "recovery" });
    if (
      current.status === "blocked" &&
      current.lockReleased === true &&
      record.completionPending === false &&
      record.hostCleanup === "absent" &&
      record.hostCleanupPublication === null
    )
      current = readState(historyRepositoryInput(record.rootCapability), {
        scope: "recovery",
        input: { kind: "execution_history", recoveryId: record.recoveryId },
      });
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    ) {
      record.persistenceFailed = true;
      return false;
    }
    const operation = current.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (!operation || !assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      return false;
    }
    if (operation.execution.ownerEffect === "disabled") return true;
    if (
      record.completionPending === true ||
      operation.phase === "terminal" ||
      record.hostCleanup !== "present"
    ) {
      record.persistenceFailed = true;
      return false;
    }
    return persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
      capability,
      "lifecycle",
      {
        phase: "settling",
        lease: operation.lease,
        execution: { ...operation.execution, ownerEffect: "disabled" },
        primaryFailure: operation.primaryFailure,
        outcome: operation.outcome,
        summarySha256: operation.summarySha256,
      },
    );
  } catch {
    record.persistenceFailed = true;
    return false;
  }
}

/**
 * 現在回収準備を閉じ、取得済み排他を全逆順で一度解放する。
 * @responsibility false／例外でも残りの解放を省略しない。
 * @trace ARCH-000008
 * @input capability: 私有回収準備。
 * @returns 過去不明なし・全解放確認の場合だけtrue。
 * @precondition 取得済み排他はこのOwnerが所有する。
 * @postcondition 解放後・二度目使用・コピーからWriterを発行しない。
 * @effect 既存排他の解放だけ。Docker・Provider・保存処置なし。
 * @failure 偽造・別種別・再使用・解放不明はfalse。
 * @invariant 過去回収不明を後着の成功で消さない。
 * @boundary 回収Ownerと取得済み実効排他。
 * @security 新しい実行許可や回復先を生成しない。
 * @concurrency 閉鎖を先に固定して全解放を試行する。
 */
export function releaseRuntimeOwnedDockerTaskRecoveryPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "recovery" || record.closed) return false;
  record.closed = true;
  record.releaseAttempted = true;
  let confirmed = !record.cleanupUnknown;
  for (const lock of [...record.locks].reverse()) {
    try {
      if (!lock.release()) confirmed = false;
    } catch {
      confirmed = false;
    }
  }
  record.cleanupUnknown ||= !confirmed;
  record.releaseConfirmed = confirmed;
  return confirmed;
}

/**
 * 全排他解放後に、同じ回収操作の終了保存を一度だけ試行する。
 * @responsibility 解放済みOwnerを新しい処置へ復活させず、固定終端Writerだけへ結合する。
 * @trace ARCH-000008
 * @input capability: 元回収準備Mapのキー。
 * @returns 保存・読戻し・短期Lock解放を区別した固定結果。
 * @precondition Host両不存在と外側排他の全解放が確認済み。
 * @postcondition 成否にかかわらず同Ownerで二度目の終端保存を発行しない。
 * @effect 同じRepository・exact操作の終了保存だけ。Docker／Host処置なし。
 * @failure コピー、別種別、未解放・解放不明、元版競合と保存不明は拒否する。
 * @invariant 一次失敗を保持し、清掃からTask成功を推定しない。
 * @boundary 解放済み私有Ownerと既存現在状態Writer。
 * @security Rootと保存JSONだけで終了保存Ownerを作らない。
 * @concurrency 試行前に一回性を固定し、保存中は元OwnerとRootを同期再確認する。
 */
export function finalizeRuntimeOwnedDockerTaskRecoveryPreparation(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    snapshotConfirmed: false,
    lockReleased: true,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    record.finalizationAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent" ||
    record.hostCleanupPublication !== null
  )
    return refused;
  record.finalizationAttempted = true;
  let writing = true;
  try {
    const operation = record.snapshot.operations.find(
      (item) =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    const repository =
      operation?.kind === "docker_task" &&
      operation.history !== null &&
      !operation.history.confirmed
        ? {
            ...record.repository,
            ...withHistoryRetention(record.repository, record.rootCapability),
          }
        : record.repository;
    const saved = saveRecoveryCheckpoint(
      repository,
      record.recoveryId,
      record.before,
      {
        kind: "terminal",
        assertOwner: () => {
          if (
            !writing ||
            dockerRecoveryPreparations.get(capability) !== record ||
            !record.closed ||
            !record.releaseAttempted ||
            !record.releaseConfirmed ||
            !record.finalizationAttempted ||
            record.persistenceFailed ||
            record.cleanupUnknown ||
            !record.repository.revalidate()
          )
            return false;
          const observed = observeHostRecoveryCleanup(
            record.hostToken,
            record.hostRoot,
          );
          return observed.root === "absent" && observed.marker === "absent";
        },
      },
    );
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    ) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
    }
    return saved;
  } catch {
    record.persistenceFailed = true;
    return refused;
  } finally {
    writing = false;
  }
}

/**
 * 終了保存後の同じ回収Ownerで、履歴の完成保存を依頼する。
 * @responsibility 完成保存の成否と現在Hostの不存在を結合し、失敗後の同Owner再発行を止める。
 * @trace ARCH-000008
 * @input capability: 全排他解放と終了保存試行を終えた私有準備キー。
 * @returns 保存・排他終了と履歴確認を区別した結果。
 * @precondition 現在資源とHostが終了済みで、旧OwnerのEffectが無効。
 * @postcondition 履歴confirmedまでに限定し、配送・ACK・操作除去は行わない。
 * @effect 固定現在状態と履歴の保存だけ。Docker／Host処置なし。
 * @failure 失効、不明、元版差、保存失敗は同IDを保持して停止する。
 * @invariant 旧Controller結果・実行Authorityを合成しない。
 * @boundary 解放済みOwnerと既存履歴Writer。
 * @security 各Writer境界で同じRootとHost両不存在を再確認する。
 * @concurrency 保存段階はEMが所有し、呼出し後は借用Ownerを失効させる。
 */
export function completeRuntimeOwnedDockerTaskRecoveryHistory(
  capability: unknown,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_state_owner_invalid",
    snapshotConfirmed: false,
    lockReleased: true,
    historyConfirmed: false,
    filesystemEffectIssued: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    !record.finalizationAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent" ||
    record.hostCleanupPublication !== null
  )
    return refused;
  let active = true;
  let filesystemEffectIssued: boolean | null = false;
  let writing = false;
  let lockReleased = true;
  try {
    writing = true;
    lockReleased = false;
    const saved = saveRecoveryHistory(
      {
        ...record.repository,
        ...withHistoryRetention(record.repository, record.rootCapability),
      },
      record.recoveryId,
      () => {
        if (
          !active ||
          dockerRecoveryPreparations.get(capability) !== record ||
          record.persistenceFailed ||
          record.cleanupUnknown ||
          !record.repository.revalidate()
        )
          return false;
        const observed = observeHostRecoveryCleanup(
          record.hostToken,
          record.hostRoot,
        );
        return observed.root === "absent" && observed.marker === "absent";
      },
      "docker_task",
    );
    writing = false;
    lockReleased = saved.lockReleased;
    filesystemEffectIssued = saved.filesystemEffectIssued;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased ||
      !saved.historyConfirmed
    ) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
      return Object.freeze({
        ...saved,
        status: "blocked" as const,
        filesystemEffectIssued,
      });
    }
    return Object.freeze({ ...saved, filesystemEffectIssued });
  } catch {
    if (writing && filesystemEffectIssued !== true)
      filesystemEffectIssued = null;
    record.persistenceFailed = true;
    record.cleanupUnknown ||= !lockReleased;
    return Object.freeze({ ...refused, filesystemEffectIssued, lockReleased });
  } finally {
    active = false;
  }
}

/**
 * 現在保存値をAttempt回収の技術入力へ投影する。
 * @responsibility Domainの意味検査と用途結合だけを所有する。
 * @trace ARCH-000008
 * @input operation: 復号・現在Owner確認済みの操作。directory: 用途限定借用所在。
 * @returns 保存Schemaを含まないExecutor入力。
 * @effect N/A: 同期投影だけ。
 * @failure 五用途欠測は停止。
 * @invariant Docker期待値や回収順序を上位で構築しない。
 */
function projectResourceTarget(
  operation: ExecutionOperationRecord,
  directory: string | null,
): ResourceTarget<"snapshot"> {
  const book = operation.resources;
  if (!book || !directory) throw Error("docker_task_recovery_resource_missing");
  return Object.freeze({
    managementDirectory: directory,
    ...book.cleanup,
    resources: Object.freeze({
      resources: Object.freeze(
        book.snapshot.resources.map((resource) => {
          const checkpoint = book.checkpoints.find(
            (item) => item.key === resource.key,
          );
          if (!checkpoint) throw Error("docker_task_recovery_resource_missing");
          return Object.freeze({
            ...resource,
            request:
              checkpoint.submission !== "intent_saved"
                ? ("not_issued" as const)
                : resource.identity.dockerId === null
                  ? ("unknown" as const)
                  : ("issued" as const),
          });
        }),
      ),
    }),
    previouslyAbsent: Object.freeze(
      book.checkpoints
        .filter(
          (item) =>
            item.observation === "absent" && item.receiptSource !== null,
        )
        .map((item) => item.key),
    ),
  });
}

/**
 * 現在Repositoryの上位相関を現在操作の回復参照へ解決する。
 * @responsibility 完全な現在観測だけを要求集合へ重複なく対応付ける。
 * @trace ARCH-000008
 * @input correlationIds: 上位相関の固定集合、rootCapability: 検証済みRepository。
 * @returns exact一致と明示不存在、または全体停止。
 * @precondition 呼出し元が認証済み上位要求と固定Repositoryを所有する。
 * @postcondition 不存在から元Task成功やProvider未発行を主張しない。
 * @effect 現在stateの読取りと既存短期排他だけ。
 * @failure 不正入力・重複・別consumer・読取／解放不明はabsence0で停止する。
 * @invariant 内部Operation IDへのfallbackと旧AppData探索を行わない。
 * @boundary 上位相関集合と現在Repositoryの固定Snapshot。
 * @security Resolver結果は処置Authorityではなく、保存済み上位義務の照合入力である。
 * @concurrency Readerの全数観測・Root再確認・排他解放を共同条件とする。
 */
export function resolveRuntimeOwnedDockerTaskCurrentCorrelations(
  correlationIds: readonly string[],
  rootCapability: unknown,
  consumer: "orchestrator" | "workbench" | "coordinator_cli" = "orchestrator",
) {
  let lockReleased = true;
  /**
   * 相関観測失敗を既知解放事実と空の対応集合へ限定する。
   * @responsibility 未観測の不存在・一致を失敗結果へ混ぜない。
   * @trace ARCH-000008
   * @input reason: 固定停止理由。
   * @returns 値だけの停止診断。
   * @precondition lockReleasedは下位Readerの返却からだけ更新する。
   * @postcondition 停止時のmatched／absenceは共に空集合。
   * @effect N/A: 値構築だけ。
   * @failure N/A: 外部処置を発行しない。
   * @invariant この診断から回復完了や処置Authorityを発行しない。
   * @boundary N/A: 同期の局所値変換。
   * @security 固定理由とboolean以外の内部情報を返さない。
   * @concurrency N/A: 外部共有状態を変更しない。
   */
  const refused = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      lockReleased,
      bindings: Object.freeze([]),
      absentCorrelationIds: Object.freeze([]),
    });
  try {
    if (
      types.isProxy(correlationIds) ||
      !Array.isArray(correlationIds) ||
      Object.getPrototypeOf(correlationIds) !== Array.prototype ||
      correlationIds.length === 0 ||
      correlationIds.length > 5
    )
      return refused("docker_task_recovery_correlation_input_invalid");
    const requested: string[] = [];
    for (let index = 0; index < correlationIds.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(
        correlationIds,
        String(index),
      );
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(descriptor.value) ||
        requested.includes(descriptor.value)
      )
        return refused("docker_task_recovery_correlation_input_invalid");
      requested.push(descriptor.value);
    }
    const observed = readState(rootCapability, { scope: "recovery" });
    lockReleased = observed.lockReleased;
    if (observed.status !== "completed" || !observed.value || !lockReleased)
      return refused("docker_task_recovery_correlation_current_unconfirmed");
    const matches = new Map<string, string>();
    const recoveries = new Set<string>();
    for (const operation of observed.value.snapshot.operations) {
      const identity = JSON.parse(operation.identityJson);
      const correlation = identity.recoveryCorrelationId;
      if (correlation === undefined && identity.consumer !== consumer) continue;
      if (
        typeof correlation !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(correlation) ||
        matches.has(correlation) ||
        recoveries.has(operation.recoveryId) ||
        (requested.includes(correlation) && identity.consumer !== consumer)
      )
        return refused("docker_task_recovery_correlation_ambiguous");
      matches.set(correlation, operation.recoveryId);
      recoveries.add(operation.recoveryId);
    }
    return Object.freeze({
      status: "completed" as const,
      reason: "docker_task_recovery_correlations_observed",
      lockReleased,
      bindings: Object.freeze(
        requested.flatMap((correlationId) => {
          const recoveryId = matches.get(correlationId);
          return recoveryId === undefined
            ? []
            : [Object.freeze({ correlationId, recoveryId })];
        }),
      ),
      absentCorrelationIds: Object.freeze(
        requested.filter((id) => !matches.has(id)),
      ),
    });
  } catch {
    return refused("docker_task_recovery_correlation_current_unconfirmed");
  }
}

/**
 * 現在回復をOperationの終了条件まで接続し、公開診断だけを返す。
 * @responsibility 技術回収の共同成立と実WriterのTask関連有無を公開結果へ対応付ける。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 現在Repository、signal: 入口の取消。
 * @returns 内部準備キー・Path・本文を含まない固定診断。
 * @precondition 入口がRepositoryと取消の所有者を検証している。
 * @postcondition 単独Operationは整理し、Task関連OperationはTask原子保存まで保持する。
 * @effect 既存技術回収と終了Writerだけ。
 * @failure 技術欠測・保存不明は元参照と既知事実を保持して停止する。
 * @invariant Provider再実行・旧形式fallback・表示Receiptを追加しない。
 * @boundary 現在回復OwnerとCLI向け診断。
 * @security 実Writerの結果を使い、準備キーを外へ返さない。
 * @concurrency 同期技術回収完了後の取消で確認済み終了を巻き戻さない。
 */
export async function recoverRuntimeOwnedDockerTaskForCurrentConsumer(
  token: unknown,
  rootCapability: unknown,
  signal?: AbortSignal,
) {
  const technical = await recoverRuntimeOwnedDockerTaskFromCurrentRepository(
    token,
    rootCapability,
    signal,
  );
  const report = {
    contract: "crdd-coordinator/current-task-recovery" as const,
    status: "blocked" as "blocked" | "recovered" | "completed",
    reason: technical.reason,
    recoveryId: technical.recoveryId,
    dockerCleanupConfirmed: technical.dockerCleanupConfirmed,
    hostCleanupConfirmed: technical.hostCleanupConfirmed,
    locksReleased: technical.locksReleased,
    historyConfirmed: technical.historyConfirmed,
    operationRetained:
      technical.status === "completed" ? true : (null as boolean | null),
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
    cleanupReason: technical.cleanupReason,
  };
  if (
    technical.status !== "completed" ||
    !technical.dockerCleanupConfirmed ||
    !technical.hostCleanupConfirmed ||
    !technical.locksReleased ||
    !technical.historyConfirmed ||
    technical.cleanupReason !== null ||
    !technical.preparation
  )
    return Object.freeze(report);
  try {
    const completion = completeRuntimeOwnedDockerTaskRecovery(
      technical.preparation,
    );
    if (
      completion.status === "completed" &&
      "operationRetained" in completion &&
      completion.operationRetained === true
    )
      return Object.freeze({
        ...report,
        status: "completed" as const,
        reason: "docker_task_recovery_terminal_confirmed",
        operationRetained: true,
        operationRemovalConfirmed: false,
        taskRecoveryCompleted: false,
      });
    const completed =
      completion.status === "completed" &&
      completion.snapshotConfirmed &&
      completion.lockReleased &&
      completion.operationRemovalConfirmed &&
      completion.taskRecoveryCompleted;
    return Object.freeze({
      ...report,
      status: completed ? ("recovered" as const) : ("blocked" as const),
      reason: completed ? "docker_task_recovery_completed" : completion.reason,
      locksReleased: report.locksReleased && completion.lockReleased,
      cleanupReason: completion.lockReleased
        ? null
        : "docker_task_recovery_release_unconfirmed",
      operationRetained: completed ? false : null,
      operationRemovalConfirmed: completed,
      taskRecoveryCompleted: completed,
    });
  } catch {
    return Object.freeze({
      ...report,
      reason: "docker_task_recovery_completion_unconfirmed",
      operationRetained: null,
    });
  }
}

/**
 * 現在Repositoryのexact回復を、既存Ownerの順序で結果登録まで接続する。
 * @responsibility 技術回収・全解放・終了保存・履歴を直列化する。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 明示検証済みRoot、signal: 呼出しOwnerの取消。
 * @returns 技術回収の各確認と内部準備キー。操作は保持し、利用者への返却完了は主張しない。
 * @precondition 呼出し元が現在Repositoryと取消の所有者を固定する。
 * @postcondition 成否にかかわらず取得済み排他を一度解放し、失敗後の後続処置を止める。
 * @effect 既存DI資源回収・Host回収と現在状態／履歴の保存だけ。
 * @failure 各段の不明は同じ参照を保持し、元の失敗を解放結果で上書きしない。
 * @invariant Task再実行、Provider要求、Docker再起動、旧AppData探索を行わない。
 * @boundary 現在Rootの回収OwnerからDI／Host／保存Ownerへの固定組立て。
 * @security 内部準備キーを公開reportへ展開せず、署名資格やCallerの成功値を使わない。
 * @concurrency 同期下位要求の終了後に取消を処理し、次段の新Effectを開始しない。
 */
export async function recoverRuntimeOwnedDockerTaskFromCurrentRepository(
  token: unknown,
  rootCapability: unknown,
  signal?: AbortSignal,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const base = Object.freeze({
    status: "blocked" as const,
    reason: "docker_task_recovery_preparation_unconfirmed",
    recoveryId: parsed?.token ?? null,
    dockerCleanupConfirmed: false,
    hostCleanupConfirmed: false,
    locksReleased: true,
    historyConfirmed: false,
    operationRetained: true,
    taskRecoveryCompleted: false,
    cleanupReason: null as string | null,
    preparation: null as object | null,
  });
  if (!parsed)
    return Object.freeze({
      ...base,
      reason: "docker_task_recovery_id_invalid",
    });
  if (
    signal !== undefined &&
    (types.isProxy(signal) || !(signal instanceof AbortSignal))
  )
    return Object.freeze({
      ...base,
      reason: "docker_task_recovery_cancellation_invalid",
    });
  if (signal?.aborted)
    return Object.freeze({ ...base, reason: "docker_task_recovery_cancelled" });
  const prepared = prepareRuntimeOwnedDockerTaskRecovery(
    parsed.token,
    rootCapability,
  );
  if (prepared.status !== "prepared")
    return Object.freeze({
      ...base,
      reason: prepared.reason,
      locksReleased: prepared.cleanupConfirmed,
      cleanupReason: prepared.cleanupConfirmed
        ? null
        : "docker_task_recovery_release_unconfirmed",
    });
  const capability = prepared.capability;
  const record = dockerRecoveryPreparations.get(capability);
  let reason = "docker_task_recovery_owner_unconfirmed";
  let dockerCleanupConfirmed = false,
    hostCleanupConfirmed = false,
    released = false,
    settled = false;
  try {
    if (record?.kind !== "recovery") throw new Error(reason);
    await setImmediate();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    reason = "docker_task_recovery_owner_retirement_unconfirmed";
    if (!retireRuntimeOwnedDockerTaskExecutionOwner(capability))
      throw new Error(reason);
    await setImmediate();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    if (record.hostCleanup === "present") {
      const resources = await executeRuntimeOwnedDockerTaskResourceRecovery(
        capability,
        signal,
      );
      reason = resources.reason;
      if (
        resources.status !== "completed" ||
        !resources.dockerCleanupConfirmed ||
        !resources.configCleanupConfirmed
      )
        throw new Error(reason);
      dockerCleanupConfirmed = true;
      await setImmediate();
      if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
      reason = "docker_task_recovery_host_absence_unconfirmed";
      if (!confirmRuntimeOwnedDockerTaskHostAbsence(capability))
        throw new Error(reason);
    } else if (record.hostCleanup === "absent") {
      // prepareが既知終端の五資源と現在Host両不存在を照合済み。
      dockerCleanupConfirmed = true;
    } else throw new Error(reason);
    await setImmediate();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    const operation = record.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      !(
        record.hostCleanup === "absent" &&
        record.hostCleanupPublication === null &&
        operation?.host.cleanup === "confirmed"
      )
    ) {
      reason = "docker_task_recovery_host_cleanup_unconfirmed";
      if (!cleanupRuntimeOwnedDockerTaskHost(capability))
        throw new Error(reason);
    }
    hostCleanupConfirmed = true;
    settled = true;
  } catch (error) {
    reason = safeRecoveryReason(error, "docker_task_recovery_failed_closed");
  } finally {
    try {
      released = releaseRuntimeOwnedDockerTaskRecoveryPreparation(capability);
    } catch {
      released = false;
    }
  }
  const state = {
    ...base,
    reason,
    dockerCleanupConfirmed,
    hostCleanupConfirmed,
    locksReleased: released,
  };
  if (!settled || !released)
    return Object.freeze({
      ...state,
      reason: settled ? "docker_task_recovery_release_unconfirmed" : reason,
      cleanupReason: released
        ? null
        : "docker_task_recovery_release_unconfirmed",
    });
  if (record?.kind === "recovery" && record.completionPending)
    return Object.freeze({
      ...state,
      status: "completed" as const,
      reason: "docker_task_recovery_runtime_state_settled",
      historyConfirmed: true,
      preparation: capability,
    });
  let historyConfirmed = false;
  let finalizationReason = "docker_task_recovery_terminal_unconfirmed";
  try {
    await setImmediate();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_cancelled",
      });
    const terminal =
      finalizeRuntimeOwnedDockerTaskRecoveryPreparation(capability);
    if (
      terminal.status !== "completed" ||
      !terminal.snapshotConfirmed ||
      !terminal.lockReleased
    )
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_terminal_unconfirmed",
        locksReleased: terminal.lockReleased,
        cleanupReason: terminal.lockReleased
          ? null
          : "docker_task_recovery_release_unconfirmed",
      });
    await setImmediate();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        reason: "docker_task_recovery_cancelled",
      });
    finalizationReason = "docker_task_recovery_history_unconfirmed";
    const history = completeRuntimeOwnedDockerTaskRecoveryHistory(capability);
    historyConfirmed = history.historyConfirmed;
    if (
      history.status !== "completed" ||
      !history.historyConfirmed ||
      !history.lockReleased
    )
      return Object.freeze({
        ...state,
        reason: history.reason,
        locksReleased: history.lockReleased,
        historyConfirmed,
        cleanupReason: history.lockReleased
          ? null
          : "docker_task_recovery_release_unconfirmed",
      });
    await setImmediate();
    if (signal?.aborted)
      return Object.freeze({
        ...state,
        historyConfirmed: true,
        reason: "docker_task_recovery_cancelled",
      });
    return Object.freeze({
      ...state,
      status: "completed" as const,
      reason: "docker_task_recovery_runtime_state_settled",
      historyConfirmed: true,
      preparation: capability,
    });
  } catch {
    if (record?.kind === "recovery") record.persistenceFailed = true;
    return Object.freeze({
      ...state,
      reason: finalizationReason,
      historyConfirmed,
    });
  }
}

/**
 * 真正な技術回収済みOwnerからOperationの終了を保存する。
 * @responsibility 表示受付を回復条件へ加えず、現在の終了Writerへ一回接続する。
 * @trace ARCH-000008
 * @input capability: 現在回収組立てが保持する内部準備キー。
 * @returns 対象操作の整理保存、排他解放と保持状態。
 * @precondition 同Ownerの技術回収・全解放・終端保存が完了している。
 * @postcondition Task関連は原子保存まで保持し、元Task成功や回答の再配送を生成しない。
 * @effect 既存State Writerによる単独Operationの除去又はTask関連Operationの保持。
 * @failure 偽Owner、再試行、不明、保存失敗では同じ参照を保持して停止する。
 * @invariant Provider要求・Docker再起動・新しい表示Receiptを発行しない。
 * @boundary 現在回収Ownerと保存Ownerの終了処理。
 * @security Root＋IDやCaller成功値だけから終了を許可しない。
 * @concurrency 試行前に一回性を固定し、各Writer確認でRoot・Host両不存在を再観測する。
 */
export function completeRuntimeOwnedDockerTaskRecovery(capability: unknown) {
  const refused = Object.freeze({
    status: "blocked" as const,
    reason: "docker_task_recovery_completion_unconfirmed",
    snapshotConfirmed: false,
    lockReleased: true,
    filesystemEffectIssued: false,
    operationRemovalConfirmed: false,
    taskRecoveryCompleted: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    !record.closed ||
    !record.releaseAttempted ||
    !record.releaseConfirmed ||
    (!record.finalizationAttempted && !record.completionPending) ||
    record.completionAttempted ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup !== "absent" ||
    record.hostCleanupPublication !== null
  )
    return refused;
  record.completionAttempted = true;
  let active = true;
  try {
    const saved = completeRecovery(
      record.rootCapability,
      record.recoveryId,
      () => {
        if (
          !active ||
          dockerRecoveryPreparations.get(capability) !== record ||
          record.persistenceFailed ||
          record.cleanupUnknown ||
          !record.repository.revalidate()
        )
          return false;
        const host = observeHostRecoveryCleanup(
          record.hostToken,
          record.hostRoot,
        );
        return host.root === "absent" && host.marker === "absent";
      },
      "docker_task",
    );
    const completed =
      saved.status === "completed" &&
      saved.snapshotConfirmed &&
      saved.lockReleased;
    if (!completed) {
      record.persistenceFailed = true;
      record.cleanupUnknown ||= !saved.lockReleased;
    }
    return Object.freeze({
      ...saved,
      status: completed ? "completed" : "blocked",
      reason:
        completed || saved.status !== "completed"
          ? saved.reason
          : "docker_task_recovery_completion_unconfirmed",
      cleanupReason: saved.lockReleased
        ? null
        : "docker_task_recovery_release_unconfirmed",
      operationRetained:
        "operationRetained" in saved && saved.operationRetained === true,
      operationRemovalConfirmed:
        completed &&
        !("operationRetained" in saved && saved.operationRetained === true),
      taskRecoveryCompleted:
        completed &&
        !("operationRetained" in saved && saved.operationRetained === true),
    });
  } catch {
    record.persistenceFailed = true;
    return refused;
  } finally {
    active = false;
  }
}

/**
 * 現在Ownerの保存とExecutorの技術回収を接続する。
 * @responsibility 資源要求の保存遷移・読戻し・認証不明閉鎖を所有する。
 * @trace ARCH-000008
 * @input capability: genuine回収Owner。cleanup／inspect: 固定Executor API、試験では同契約の代役。
 * @returns 同じ回復参照と技術回収・config終了の結果。
 * @precondition Owner・元版・用途限定Host借用が成立している。
 * @postcondition Host清掃・Lease・Task完了をこの処理では確定しない。
 * @effect Domain保存とExecutor操作だけ。
 * @failure 保存・Owner・技術観測不明は同IDで停止。
 * @invariant 発見ID保存・読戻し前に削除へ進めない。
 * @boundary Coordinator保存OwnerとExecutor公開API。
 * @security Docker argv・期待値・config手順を組み立てない。
 * @concurrency 各通知とQueryで元版・現在Ownerをfresh確認する。
 */
export async function recoverRuntimeOwnedDockerTaskResources(
  capability: unknown,
  cleanup: (
    target: ResourceTarget<"snapshot">,
    callbacks: IsolationCallbacks,
  ) => IsolationExecution = (target, callbacks) =>
    cleanupResources(target, getIsolationSettings(), callbacks),
  inspect: (
    target: ResourceTarget<"snapshot">,
    options?: Readonly<{
      signal?: AbortSignal;
      stopOnUnknownAbsence?: boolean;
    }>,
  ) => ResourceInspection<"snapshot"> = (target, options) =>
    inspectResources(target, getIsolationSettings(), options),
  signal?: AbortSignal,
) {
  const record =
    capability && typeof capability === "object"
      ? dockerRecoveryPreparations.get(capability)
      : null;
  const result = (
    confirmed: boolean,
    reason: string,
    configCleanupConfirmed = !record?.cleanupUnknown,
    dockerCleanupConfirmed = confirmed,
  ) =>
    Object.freeze({
      status: confirmed ? ("completed" as const) : ("blocked" as const),
      recoveryId: record?.kind === "recovery" ? record.recoveryId : null,
      dockerCleanupConfirmed,
      configCleanupConfirmed,
      reason,
    });
  if (
    !capability ||
    typeof capability !== "object" ||
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanupPublication !== null
  )
    return result(false, "docker_task_recovery_owner_unconfirmed");
  const current = () => {
    if (record.persistenceFailed || record.cleanupUnknown)
      throw Error("docker_task_recovery_owner_unconfirmed");
    if (!assertCurrentRecoveryOwner(capability, record)) {
      record.persistenceFailed = true;
      throw Error("docker_task_recovery_owner_unconfirmed");
    }
    const read = readState(record.rootCapability, { scope: "recovery" });
    if (!read.lockReleased) record.cleanupUnknown = true;
    if (
      read.status !== "completed" ||
      !read.value ||
      !read.lockReleased ||
      !Buffer.from(read.value.sourceText, "utf8").equals(record.before)
    ) {
      record.persistenceFailed = true;
      throw Error("docker_task_recovery_boundary_changed");
    }
    const state = read.value.operationStates.find(
      (value) =>
        value.kind === "docker_task" &&
        value.operation.recoveryId === record.recoveryId,
    );
    if (state?.kind !== "docker_task")
      throw Error("docker_task_recovery_resource_missing");
    return state;
  };

  try {
    const initialState = current();
    const initial = initialState.operation;
    const requested =
      initial.resources?.checkpoints.some(
        (value) => value.submission === "intent_saved",
      ) ?? false;
    const borrowed = requested
      ? borrowHostRecoveryManagementDirectory(
          record.hostToken,
          record.hostGeneration,
        )
      : null;
    if (requested && !borrowed) {
      record.persistenceFailed = true;
      return result(false, "docker_task_recovery_host_borrow_unconfirmed");
    }
    const owner = () => {
      current();
      return borrowed ? borrowed.assertCurrent() : true;
    };
    if (!owner()) throw Error("docker_task_recovery_host_borrow_unconfirmed");
    signal?.throwIfAborted();
    if (!requested && initialState.resourcesSettled)
      return result(true, "docker_task_recovery_resources_clean");
    const target = projectResourceTarget(initial, borrowed?.directory ?? null);
    let authenticationClosureConfirmed = false;
    let inspectionConfigConfirmed = true;
    const execution = cleanup(target, {
      onCleanupSubmitting: () => {
        current();
      },
      onResourceIdentified: (key, snapshot) => {
        const book = current().operation.resources;
        if (
          !book ||
          !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
            capability,
            "resource",
            { event: "identified", key, snapshot, cleanup: book.cleanup },
          )
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        current();
      },
      onResourcesClosed: (snapshot, observations) => {
        const operationState = current();
        const requiresAuthenticationClosure =
          operationState.authenticationClosureAllowed;
        if (
          !requiresAuthenticationClosure &&
          !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
            capability,
            "cleanup",
            { snapshot, observations },
          )
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        const closureState = current();
        if (!closureState.authenticationClosureAllowed) return;
        const closureOperation = closureState.operation;
        const inspection = inspect(
          (() => {
            const full = projectResourceTarget(
              closureOperation,
              borrowed?.directory ?? null,
            );
            return {
              ...full,
              resources: {
                resources: full.resources.resources.filter(
                  (r) => r.key === "create_subscription_auth_probe",
                ),
              },
              cleanupOrder: ["create_subscription_auth_probe"],
              previouslyAbsent: [],
            };
          })(),
          { stopOnUnknownAbsence: true, ...(signal ? { signal } : {}) },
        );
        inspectionConfigConfirmed = inspection.configCleanupConfirmed;
        if (!inspectionConfigConfirmed) record.cleanupUnknown = true;
        const authentication = inspection.resources.find(
          (value) => value.key === "create_subscription_auth_probe",
        );
        if (
          inspection.status !== "completed" ||
          !authentication ||
          authentication.absenceObservations.length !== 2 ||
          authentication.absenceObservations.some((value) => value !== "absent")
        )
          throw Error(
            "docker_task_recovery_authentication_absence_unconfirmed",
          );
        current();
        const rounds = authentication.absenceObservations.map(
          (_value, index) => ({
            round: index + 1,
            name: "absent",
            name_label: "absent",
          }),
        );
        record.persistenceFailed = true;
        const saved = saveRecoveryCheckpoint(
          record.repository,
          record.recoveryId,
          record.before,
          {
            kind: "authentication_unknown_closure",
            observations: rounds,
            assertOwner: () =>
              !record.cleanupUnknown &&
              assertCurrentRecoveryOwner(capability, record),
          },
        );
        if (!saved.lockReleased) record.cleanupUnknown = true;
        if (
          saved.status !== "completed" ||
          !saved.snapshotConfirmed ||
          !saved.lockReleased
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        const read = readState(record.rootCapability, { scope: "recovery" });
        if (!read.lockReleased) record.cleanupUnknown = true;
        if (
          read.status !== "completed" ||
          !read.value ||
          !read.lockReleased ||
          read.value.snapshot.revision !== saved.revision ||
          read.value.payloadSha256 !== saved.payloadSha256
        )
          throw Error("docker_task_recovery_checkpoint_unconfirmed");
        record.before = Buffer.from(read.value.sourceText, "utf8");
        record.snapshot = read.value.snapshot;
        record.operationStates = read.value.operationStates;
        record.persistenceFailed = !assertCurrentRecoveryOwner(
          capability,
          record,
        );
        if (record.persistenceFailed)
          throw Error("docker_task_recovery_owner_unconfirmed");
        authenticationClosureConfirmed = true;
      },
    });
    const abort = () => {
      void execution.cancel().catch(() => {});
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    let technical: AttemptResourceCleanupResult<"snapshot">;
    try {
      technical = await execution.completion;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
    const recovered = {
      configCleanupConfirmed: technical.cleanup.configCleanupConfirmed,
      dockerCleanupConfirmed:
        technical.cleanup.confirmed && technical.processTerminationConfirmed,
      status:
        technical.cleanup.confirmed && technical.processTerminationConfirmed
          ? "completed"
          : "blocked",
      reason:
        technical.failure?.reason ??
        (technical.cleanup.confirmed
          ? "docker_task_recovery_resources_clean"
          : "docker_task_recovery_resource_unconfirmed"),
    };
    if (!owner()) throw Error("docker_task_recovery_host_borrow_unconfirmed");
    record.cleanupUnknown ||=
      !recovered.configCleanupConfirmed || !inspectionConfigConfirmed;
    if (
      recovered.status === "blocked" &&
      recovered.reason !== "docker_task_recovery_resource_unconfirmed"
    )
      record.persistenceFailed = true;
    const configConfirmed =
      recovered.configCleanupConfirmed && inspectionConfigConfirmed;
    const confirmed =
      configConfirmed &&
      ((recovered.status === "completed" && recovered.dockerCleanupConfirmed) ||
        (authenticationClosureConfirmed &&
          recovered.reason === "docker_task_recovery_resource_unconfirmed"));
    return result(
      confirmed,
      confirmed ? "docker_task_recovery_resources_clean" : recovered.reason,
      configConfirmed,
      recovered.dockerCleanupConfirmed || authenticationClosureConfirmed,
    );
  } catch {
    record.persistenceFailed = true;
    return result(
      false,
      "docker_task_recovery_execution_unconfirmed",
      !record.cleanupUnknown,
    );
  }
}

/**
 * 同じ回収OwnerをExecutorの公開操作へ接続する。
 * @responsibility 本番は固定の診断・回収APIだけを使用する。
 * @trace ARCH-000008
 * @input capability: genuine現在回収Owner。
 * @returns 元参照と技術回収結果。
 * @effect 下位APIと既存保存だけ。
 * @failure 同Ownerの既存停止結果を返す。
 * @invariant Docker Executor生成・config操作・closeを所有しない。
 */
export function executeRuntimeOwnedDockerTaskResourceRecovery(
  capability: unknown,
  signal?: AbortSignal,
) {
  return recoverRuntimeOwnedDockerTaskResources(
    capability,
    (target, callbacks) =>
      cleanupResources(target, getIsolationSettings(), callbacks),
    (target, options) =>
      inspectResources(target, getIsolationSettings(), options),
    signal,
  );
}

/**
 * 同じ版のモデル事実と実Hostの初期状態を共同確認する。
 * @responsibility モデルの再導出を行わず、実Host状態・exact tokenだけを照合する。
 * @trace ARCH-000008
 * @input operation: 現在操作、initialHostMatches: 同じ版のReader事実、hostToken／hostState: 実観測。
 * @returns 三条件の共同成立だけtrue。
 * @effect N/A: 局所値の比較だけ。
 * @security Reader成功・元版一致を先に確認し、blockedの空一覧を不存在証拠にしない。
 */
function isUnsubmittedInitialTaskHost(
  operation: ExecutionOperationRecord,
  initialHostMatches: boolean,
  hostToken: string,
  hostState: unknown,
): boolean {
  return (
    initialHostMatches === true &&
    hostState === "host_only" &&
    hostToken === operation.host.currentToken
  );
}

/**
 * 回収済み資源に対応するHost不存在遷移を現在stateと共同確定する。
 * @responsibility 遷移前意図の保存と実marker確認を、同じ回収Ownerへ結合する。
 * @trace ARCH-000008
 * @input capability: 既存準備Mapの真正な回収Owner。
 * @returns 遷移後tokenの保存・読戻しまで確認できた場合だけtrue。
 * @precondition 元OwnerはEffect不能で、五資源は既知の終了条件を満たす。
 * @postcondition Host領域やmarkerの削除、Lease解放、Task成功は確定しない。未submissionの初期切断だけは遷移不要とする。
 * @effect 同RootのHost状態遷移と同じ操作の固定host欄だけを保存する。
 * @failure 失効、元版差、保存・処置返却不明は停止し、同Ownerで再処置しない。
 * @invariant 過去Create unknownを消さず、予定token以外を採用しない。
 * @boundary 現在回収Owner・固定Writerと既存Host遷移。
 * @security 旧managementを復元せず、保存意図だけから処置Ownerを生成しない。
 * @concurrency Host／Home／Runtime排他を保持し、処置・保存直前に再確認する。
 */
export function confirmRuntimeOwnedDockerTaskHostAbsence(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanupPublication !== null
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const current = readState(record.rootCapability, {
      scope: "recovery",
      input: {
        kind: "initial_host",
        recoveryId: record.recoveryId,
      },
    });
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    )
      throw new Error("docker_task_recovery_boundary_changed");
    const operation = current.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    const operationState = current.value.operationStates.find(
      (state): state is ExecutionOperationState =>
        state.kind === "docker_task" && state.operation === operation,
    );
    if (
      operation?.execution.ownerEffect !== "disabled" ||
      operationState?.resourcesSettled !== true
    )
      return false;
    const loaded = loadHostRecoveryRecordByToken(
      record.hostToken,
      record.hostRoot,
    );
    if (
      isUnsubmittedInitialTaskHost(
        operation,
        current.unsubmittedHostRecoveryIds.includes(record.recoveryId),
        record.hostToken,
        loaded.record.state,
      )
    )
      return true;
    if (
      operation.host.pendingTransitionJson === null &&
      loaded.record.state === "docker_absent_confirmed"
    )
      return record.hostToken === operation.host.currentToken;
    const intent =
      operation.host.pendingTransitionJson === null
        ? expectedHostSuccessor(
            operation.host.currentToken,
            "docker_absent_confirmed",
            record.hostRoot,
          )
        : JSON.parse(operation.host.pendingTransitionJson);
    if (
      intent.currentState !== "docker_submission_started" ||
      intent.nextState !== "docker_absent_confirmed" ||
      intent.currentToken !== operation.host.currentToken
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    if (operation.host.pendingTransitionJson === null) {
      if (
        !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
          ...operation.host,
          pendingTransitionJson: canonical(intent),
        })
      )
        return false;
    }
    const lineage =
      operation.host.pendingTransitionJson === null
        ? record.operationStates.find(
            (state): state is ExecutionOperationState =>
              state.kind === "docker_task" &&
              state.operation.recoveryId === record.recoveryId,
          )?.hostTransition
        : operationState.hostTransition;
    if (
      !lineage ||
      lineage.currentToken !== intent.currentToken ||
      lineage.expectedToken !== intent.expectedToken
    )
      throw new Error("docker_task_recovery_host_transition_mismatch");
    // 同じ意図の耐久化後だけ、旧markerから一度遷移する。
    if (!assertCurrentRecoveryOwner(capability, record))
      throw new Error("docker_task_recovery_owner_unconfirmed");
    if (record.hostToken === lineage.currentToken) {
      const beforeEffect = readState(record.rootCapability, {
        scope: "recovery",
      });
      if (!beforeEffect.lockReleased) record.cleanupUnknown = true;
      if (
        beforeEffect.status !== "completed" ||
        !beforeEffect.value ||
        !beforeEffect.lockReleased ||
        !Buffer.from(beforeEffect.value.sourceText, "utf8").equals(
          record.before,
        ) ||
        !assertCurrentRecoveryOwner(capability, record)
      )
        throw new Error("docker_task_recovery_boundary_changed");
      const updated = confirmOwnedDockerAbsenceForRecovery(
        record.hostToken,
        record.hostGeneration,
      );
      if (updated !== lineage.expectedToken)
        throw new Error("docker_task_recovery_host_transition_mismatch");
      const observed = loadHostRecoveryRecordByToken(updated, record.hostRoot);
      if (
        observed.serialized !==
        canonical({ ...intent.recordBefore, state: "docker_absent_confirmed" })
      )
        throw new Error("docker_task_recovery_host_transition_mismatch");
      record.hostToken = updated;
    } else if (record.hostToken !== lineage.expectedToken) {
      throw new Error("docker_task_recovery_host_transition_mismatch");
    }
    if (!assertCurrentRecoveryOwner(capability, record))
      throw new Error("docker_task_recovery_owner_unconfirmed");
    return persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
      ...operation.host,
      currentToken: lineage.expectedToken,
      pendingTransitionJson: null,
    });
  } catch {
    record.persistenceFailed = true;
    return false;
  }
}

/**
 * 同じ現在OwnerでHost清掃の意図・処置・確定を閉じる。
 * @responsibility 物理清掃後も世代排他と両不存在を保持し、保存だけの再入場を許可する。
 * @trace ARCH-000008
 * @input capability: genuineな現在回収準備。
 * @returns Host清掃確定、または既確定かつ現在不存在の場合だけtrue。
 * @precondition Owner Effect無効・五資源既知終端・Host遷移確定済みである。
 * @postcondition 清掃予定を保存してから削除し、実不存在後だけHost一欄を確定する。
 * @effect 同じHost Root／markerの回収と固定現在状態保存。
 * @failure 保存・元版・排他・処置・観測不明では同じ参照とpendingを保持する。
 * @invariant Host清掃だけからTask成功・Lease解放・全体回復を推定しない。
 * @boundary 現在回収Owner、Host回収と既存状態Writer。
 * @security 任意Path・対象・callbackを受け取らず、一般checkpointのconfirmed拒否を維持する。
 * @concurrency 処置直前と保存排他下で同じ世代・現在版・不存在を再確認する。
 */
export function cleanupRuntimeOwnedDockerTaskHost(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown
  )
    return false;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const current = record.hostCleanupPublication
      ? readState(record.rootCapability, {
          scope: "recovery",
          input: {
            kind: "host_cleanup",
            recoveryId: record.recoveryId,
          },
        })
      : readState(record.rootCapability, {
          scope: "recovery",
          input: {
            kind: "initial_host",
            recoveryId: record.recoveryId,
          },
        });
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    )
      throw new Error("docker_task_recovery_boundary_changed");
    const operation = current.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      !operation ||
      operation.host.currentToken !== record.hostToken ||
      operation.host.pendingTransitionJson !== null ||
      operation.execution.ownerEffect !== "disabled" ||
      current.value.operationStates.find(
        (state): state is ExecutionOperationState =>
          state.kind === "docker_task" && state.operation === operation,
      )?.resourcesSettled !== true
    )
      return false;
    if (
      operation.host.cleanup === "confirmed" &&
      !record.hostCleanupPublication
    )
      return (
        record.hostCleanup === "absent" &&
        assertCurrentRecoveryOwner(capability, record)
      );
    if (
      record.hostCleanup === "absent" &&
      operation.host.cleanup === "not_requested" &&
      !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
        ...operation.host,
        cleanup: "pending",
      })
    )
      return false;
    if (record.hostCleanup === "present") {
      const loaded = loadHostRecoveryRecordByToken(
        record.hostToken,
        record.hostRoot,
      );
      if (
        loaded.record.state !== "docker_absent_confirmed" &&
        !isUnsubmittedInitialTaskHost(
          operation,
          current.unsubmittedHostRecoveryIds.includes(record.recoveryId),
          record.hostToken,
          loaded.record.state,
        )
      )
        return false;
      if (
        operation.host.cleanup === "not_requested" &&
        !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(capability, "host", {
          ...operation.host,
          cleanup: "pending",
        })
      )
        return false;
      const beforeEffect = readState(record.rootCapability, {
        scope: "recovery",
      });
      if (!beforeEffect.lockReleased) record.cleanupUnknown = true;
      if (
        beforeEffect.status !== "completed" ||
        !beforeEffect.value ||
        !beforeEffect.lockReleased ||
        !Buffer.from(beforeEffect.value.sourceText, "utf8").equals(
          record.before,
        ) ||
        !assertCurrentRecoveryOwner(capability, record)
      )
        throw new Error("docker_task_recovery_boundary_changed");
      const result = recoverOwnedOperationDirectories(
        record.hostToken,
        record.hostGeneration,
        record.hostRoot,
      );
      const observed = observeHostRecoveryCleanup(
        record.hostToken,
        record.hostRoot,
      );
      if (
        result.status !== "recovered" ||
        observed.root !== "absent" ||
        observed.marker !== "absent"
      ) {
        record.hostCleanup = "unknown";
        throw new Error("docker_task_recovery_host_cleanup_unconfirmed");
      }
      record.hostCleanup = "absent";
    }
    if (
      record.hostCleanup !== "absent" ||
      !assertCurrentRecoveryOwner(capability, record)
    )
      return false;
    record.persistenceFailed = true;
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind: "host_cleanup",
        assertAbsentOwner: () =>
          record.hostCleanup === "absent" &&
          assertCurrentRecoveryOwner(capability, record),
        publication: record.hostCleanupPublication,
      },
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const after = readState(record.rootCapability, { scope: "recovery" });
    if (!after.lockReleased) record.cleanupUnknown = true;
    const confirmed = after.value?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      after.status !== "completed" ||
      !after.value ||
      !after.lockReleased ||
      after.value.snapshot.revision !== saved.revision ||
      after.value.payloadSha256 !== saved.payloadSha256 ||
      confirmed?.host.cleanup !== "confirmed" ||
      confirmed.host.currentToken !== record.hostToken ||
      confirmed.host.pendingTransitionJson !== null ||
      !assertCurrentRecoveryOwner(capability, record)
    )
      return false;
    // 正規候補の検査はWriterが所有する。同じ確定版の読戻し本文を次の元版にする。
    record.before = Buffer.from(after.value.sourceText, "utf8");
    record.snapshot = after.value.snapshot;
    record.operationStates = after.value.operationStates;
    record.hostCleanupPublication = null;
    record.persistenceFailed = false;
    return true;
  } catch {
    record.cleanupUnknown = true;
    return false;
  }
}

/**
 * Production Planが有効か判定する。
 *
 * @responsibility Production Planの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input plan: ProductionPlan
 * @returns validProductionPlanの計算結果を返す。
 * @precondition 「plan: ProductionPlan」がvalidProductionPlanの入力契約を満たす。
 * @postcondition validProductionPlanの責務を完了した結果だけを返す。
 * @effect N/A: validProductionPlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validProductionPlanは独自の失敗分岐を所有しない。
 * @invariant validProductionPlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validProductionPlanはProcess内の同一Subsystemで完結する。
 * @security validProductionPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validProductionPlanは共有非同期状態を持たない同期処理である。
 */
function validProductionPlan(plan: ProductionPlan) {
  return (
    plan !== null &&
    typeof plan === "object" &&
    [
      plan.authContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
      plan.proxyContainerName,
      plan.providerContainerName,
      plan.ownershipLabel,
      plan.providerImageDigest,
      plan.proxyImageDigest,
    ].every((value) => typeof value === "string") &&
    ["workbench", "coordinator_cli", "orchestrator"].includes(plan.consumer) &&
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    inspectExecutionSelection(plan.executionSelection)?.provider ===
      plan.provider &&
    (plan.taskAttempt === 0 || plan.taskAttempt === 1) &&
    [plan.providerHomeIdentityHash, plan.stableLogicalHomeBindingHash].every(
      (value) => HEX64.test(value),
    ) &&
    (plan.operationMode === "boolean_probe" ||
      plan.operationMode === "isolated_task" ||
      plan.operationMode === "workbench_advice") &&
    (plan.workspaceMountMode === null ||
      plan.workspaceMountMode === "read_write" ||
      plan.workspaceMountMode === "read_only")
  );
}

/**
 * expected Host Successorを決定する。
 *
 * @responsibility expected Host Successorの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input currentToken: string、nextState: string
 * @returns expectedHostSuccessorの計算結果を返す。
 * @precondition 「currentToken: string、nextState: string」がexpectedHostSuccessorの入力契約を満たす。
 * @postcondition expectedHostSuccessorの責務を完了した結果だけを返す。
 * @effect N/A: expectedHostSuccessorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedHostSuccessorは独自の失敗分岐を所有しない。
 * @invariant expectedHostSuccessorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedHostSuccessorはProcess内の同一Subsystemで完結する。
 * @security expectedHostSuccessorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedHostSuccessorは共有非同期状態を持たない同期処理である。
 */
function expectedHostSuccessor(
  currentToken: string,
  nextState: string,
  expectedRoot: string,
) {
  const loaded = loadHostRecoveryRecordByToken(currentToken, expectedRoot);
  const serialized = canonical({ ...loaded.record, state: nextState });
  const hash = createHash("sha256").update(serialized).digest("hex");
  return Object.freeze({
    currentToken,
    expectedToken: `host.${loaded.parsed.rootName}.${loaded.parsed.nonce}.${hash}`,
    rootName: loaded.parsed.rootName,
    nonce: loaded.parsed.nonce,
    currentState: loaded.record.state,
    nextState,
    recordBefore: loaded.record,
  });
}

/**
 * 実Home排他と単一現在状態を確定してHostのDocker開始へ接続する。
 * @responsibility 実Home排他と単一現在状態を確定してHostのDocker開始へ接続する。
 * @trace ARCH-000008
 * @input plan: 固定計画。managementCapability: 実Host Owner。observeFailure: 任意の受動診断。
 * @returns ready、または同じ回復参照を保持した停止結果。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect Home排他、Repository内state.jsonと所有Hostの開始遷移だけ。
 * @failure 観測・保存・遷移不明では停止し、取得済み参照を保持する。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。診断は同期発行し完了を待たず、例外・返却Promiseの拒否を捕捉する。
 */
function beginProductionRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
  observeFailure?: (
    diagnostic: RecoveryStartFailureDiagnostic,
  ) => void | Promise<void>,
) {
  let stage: RecoveryStartFailureDiagnostic["stage"] = "plan_validation";
  let diagnosticRecoveryId: string | null = null;
  let ready = false;
  try {
    if (!validProductionPlan(plan)) return null;
    stage = "operation_context";
    const development =
      inspectRuntimeOwnedDevelopmentOperationContext(managementCapability);
    if (development && !development.checkNewWork()) return null;
    stage = "plan_validation";
    const nonce = randomBytes(32).toString("hex");
    const identityJson = prepareRuntimeOwnedRepositoryDockerOperationIdentity(
      plan,
      managementCapability,
      nonce,
      plan.consumer,
    );
    if (!identityJson) return null;
    stage = "provider_home";
    const observation = inspectRuntimeOwnedWindowsProviderHomeCandidate(
      plan.provider,
    );
    const home = consumeRuntimeOwnedProviderHomeObservationCapability(
      observation.observationCapability,
    );
    if (
      observation.status !== "candidate" ||
      !home ||
      home.providerHomeIdentityHash !== plan.providerHomeIdentityHash ||
      home.stableLogicalHomeBindingHash !== plan.stableLogicalHomeBindingHash
    )
      return null;
    let recoveryId: string | null = null;
    let capability: object | null = null;
    try {
      stage = "operation_binding";
      const operation =
        verifyOwnedOperationManagementCapability(managementCapability);
      if (operation.operationId !== plan.operationId)
        throw new Error("docker_recovery_operation_binding_invalid");
      stage = "state_conflict";
      const current = readOperationStateStage(managementCapability);
      if (
        current.value?.snapshot.operations.some((item) =>
          item.kind === "runtime_repair"
            ? item.phase !== "terminal"
            : JSON.parse(item.identityJson).stableLogicalHomeBindingHash ===
                plan.stableLogicalHomeBindingHash && item.lease !== "released",
        )
      )
        throw new Error("docker_recovery_runtime_state_conflict");
      stage = "operation_binding";
      const initial = readOperationStateStage(managementCapability, {
        kind: "operation_start",
        identityJson,
      });
      recoveryId =
        initial.kind === "operation_start" && initial.status === "completed"
          ? (initial.operationIdentity?.recoveryId ?? null)
          : null;
      if (!recoveryId)
        throw new Error("docker_recovery_operation_binding_invalid");
      diagnosticRecoveryId = recoveryId;
      capability = Object.freeze({});
      const record: DurableRecord = {
        capability,
        managementCapability: managementCapability as object,
        operationId: operation.operationId,
        operationNonce: nonce,
        recoveryId,
        stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
        homeLeaseReleased: false,
        settlementContext: null,
        initializationReady: false,
        initializationIdentityJson: identityJson,
        consumer: plan.consumer,
      };
      durableRecords.set(capability, record);
      stage = "operation_start_save";
      const saved = saveOperationStart(
        managementCapability,
        identityJson,
        (result, operationId, reference) =>
          record.dockerCompletion === result &&
          record.operationId === operationId &&
          record.recoveryId === reference
            ? (record.terminalObservation ?? null)
            : null,
      );
      record.initializationResult = saved;
      if (saved.startSaved && !saved.completionContext)
        stage = "settlement_binding";
      if (
        saved.status !== "completed" ||
        !saved.snapshotConfirmed ||
        !saved.lockReleased ||
        saved.recoveryId !== recoveryId
      )
        throw new Error(saved.reason);
      stage = "settlement_binding";
      const context = saved.completionContext;
      if (!context)
        throw new Error("docker_recovery_settlement_binding_invalid");
      record.settlementContext = context;
      stage = "host_submission";
      const started = beginRuntimeOwnedCoordinatorHostSubmission(
        managementCapability,
        recoveryId,
      );
      record.initializationHostResult = started;
      if (started.status !== "completed" || !started.hostTransitionConfirmed) {
        record.initializationFailure = started.reason;
        return Object.freeze({
          status: "blocked" as const,
          recoveryId,
          recoveryCapability: capability,
          reason: started.reason,
          manualRecoveryRequired: true,
        });
      }
      record.initializationReady = true;
      ready = true;
      return Object.freeze({
        status: "ready" as const,
        recoveryId,
        recoveryCapability: capability,
      });
    } catch (error) {
      const record = capability ? durableRecords.get(capability) : null;
      const reason = safeRecoveryReason(
        error,
        "docker_recovery_initialization_failed_closed",
      );
      if (record && capability) {
        record.initializationFailure = reason;
        record.initializationLeaseReleaseConfirmed = false;
      }
      return Object.freeze({
        status: "blocked" as const,
        recoveryId,
        ...(capability ? { recoveryCapability: capability } : {}),
        reason,
        manualRecoveryRequired: true,
      });
    }
  } finally {
    if (!ready) {
      try {
        void Promise.resolve(
          observeFailure?.(
            Object.freeze({ stage, recoveryId: diagnosticRecoveryId }),
          ),
        ).catch(() => {});
      } catch {
        /* 受動診断の失敗で元の開始結果を変更しない。 */
      }
    }
  }
}

/**
 * 現在Repositoryと実Hostから最新の開始Identityを組み立てる。
 * @responsibility AppData RuntimeStateを観測せず、検証済み計画・同じ操作Owner・初期Hostを固定本文へ結合する。
 * @trace ARCH-000008
 * @input plan: Runtimeの固定計画、managementCapability: 同じ操作Owner、operationNonce: 新操作世代、consumer: 本番組立てに固定された利用側。
 * @returns 正規Identity本文、または検証不能のnull。
 * @precondition Provider Homeの現在観測・Lease取得は呼出し元の開始Ownerが別途確認する。
 * @postcondition 旧Root結合やCaller supplied Pathを新形式へ持ち込まない。
 * @effect Repositoryと既存Host記録の読取りのみ。保存・Docker要求・Lease取得は行わない。
 * @failure 別操作、不正計画・世代、Root失効、Host観測不能ではnull。
 * @invariant Identityの組立てを保存確定やProvider起動許可と扱わない。
 * @boundary 本番開始OwnerからRepository-local現在状態形式への内部搬送。
 * @security Host Pathは観測値であり、処置許可や公開情報ではない。
 * @concurrency Rootと操作Ownerを組立て後に再確認し、保存直前の検査はWriterが行う。
 */
export function prepareRuntimeOwnedRepositoryDockerOperationIdentity(
  plan: ProductionPlan,
  managementCapability: unknown,
  operationNonce: unknown,
  consumer: unknown,
): string | null {
  try {
    if (
      !validProductionPlan(plan) ||
      typeof consumer !== "string" ||
      !["workbench", "coordinator_cli", "orchestrator"].includes(consumer) ||
      consumer !== plan.consumer ||
      typeof operationNonce !== "string" ||
      !HEX64.test(operationNonce)
    )
      return null;
    const repository =
      borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
    if (!repository || repository.operationId !== plan.operationId) return null;
    const ownedHost = borrowOwnedHostRecoverySnapshot(managementCapability);
    const initialHostRecoveryId = ownedHost.snapshot.token;
    const initialHostRecovery = ownedHost.snapshot;
    const identity = {
      schema: "crdd-coordinator/operation-identity/v4",
      operationNonce,
      provider: plan.provider,
      consumer,
      operationId: plan.operationId,
      grantRef: plan.grantRef,
      executionSelection: plan.executionSelection,
      taskAttempt: plan.taskAttempt,
      stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
      providerHomeIdentityHash: plan.providerHomeIdentityHash,
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: plan.ownershipLabel,
      operationMode: plan.operationMode,
      workspaceMountMode: plan.workspaceMountMode,
      ...(plan.workspaceProtection
        ? {
            workspaceProtected: true,
            workspaceProtection: plan.workspaceProtection,
          }
        : {}),
      ...(plan.recoveryCorrelationId
        ? { recoveryCorrelationId: plan.recoveryCorrelationId }
        : {}),
      initialHostRecoveryId,
      initialHostRecovery,
      hostPaths: ownedHost.hostPaths,
    };
    const identityJson = `${JSON.stringify(identity)}\n`;
    const inspected = readOperationStateStage(managementCapability, {
      kind: "operation_start",
      identityJson,
    });
    return inspected.kind === "operation_start" &&
      inspected.status === "completed" &&
      inspected.operationIdentity &&
      inspected.operationIdentity.operationId === plan.operationId &&
      repository.revalidate()
      ? identityJson
      : null;
  } catch {
    return null;
  }
}

/**
 * durable 記録を決定する。
 *
 * @responsibility durable 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns durableRecordの計算結果を返す。
 * @precondition 「capability: unknown」がdurableRecordの入力契約を満たす。
 * @postcondition durableRecordの責務を完了した結果だけを返す。
 * @effect N/A: durableRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: durableRecordは独自の失敗分岐を所有しない。
 * @invariant durableRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: durableRecordはProcess内の同一Subsystemで完結する。
 * @security durableRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: durableRecordは共有非同期状態を持たない同期処理である。
 */
function durableRecord(capability: unknown, isRequireInitialized = true) {
  const record =
    capability && typeof capability === "object"
      ? (durableRecords.get(capability) ?? null)
      : null;
  return record &&
    record.capability === capability &&
    (!isRequireInitialized || record.initializationReady)
    ? record
    : null;
}

/**
 * 真正な初期化停止を照合し、返却結果の寿命に元Ownerを結合する。
 * @responsibility 元失敗・回復参照を保持し、公開停止結果を処置Capabilityにしない。
 * @trace ARCH-000008
 * @input capability: 元Owner、recoveryId・management・homeHash・reason: 元停止相関、result: 寿命保持結果またはnull。
 * @returns 元の初期化停止と一致する場合だけtrue。
 * @precondition 固定Identityから既存Ownerを作成済みである。
 * @postcondition 停止結果aliasから通常処置やLease解放を許可しない。
 * @effect 既存Process内WeakMapへの同recordの寿命結合だけ。
 * @failure 偽Owner、別参照・管理Owner・Home・理由、開始成功済みはfalse。
 * @invariant unknownや清掃未確認を成功へ変更しない。
 * @boundary 本番開始OwnerからController停止結果への内部搬送。
 * @security 元Capabilityとのobject一致を処置入口で維持する。
 * @concurrency N/A: 同期照合と寿命保持のみ。
 */
export function bindRuntimeOwnedDockerInitializationFailure(
  capability: unknown,
  recoveryId: unknown,
  managementCapability: unknown,
  homeHash: unknown,
  reason: unknown,
  result: object | null,
): boolean {
  const record = durableRecord(capability, false);
  if (
    !record ||
    record.initializationReady ||
    !record.initializationFailure ||
    record.initializationFailure !== reason ||
    record.recoveryId !== recoveryId ||
    record.managementCapability !== managementCapability ||
    record.stableLogicalHomeBindingHash !== homeHash
  )
    return false;
  if (result !== null) durableRecords.set(result, record);
  return true;
}

/**
 * Runtime 所有 Docker 回復 Bindingを検証する。
 *
 * @responsibility Runtime 所有 Docker 回復 Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input recoveryCapability: unknown、recoveryId: unknown、managementCapability: unknown、stableLogicalHomeBindingHash: unknown
 * @returns verifyRuntimeOwnedDockerRecoveryBindingの計算結果を返す。
 * @precondition 「recoveryCapability: unknown、recoveryId: unknown、managementCapability: unknown、stableLogicalHomeBindingHash: unknown」がverifyRuntimeOwnedDockerRecoveryBindingの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedDockerRecoveryBindingの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedDockerRecoveryBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyRuntimeOwnedDockerRecoveryBindingは独自の失敗分岐を所有しない。
 * @invariant verifyRuntimeOwnedDockerRecoveryBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedDockerRecoveryBindingはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedDockerRecoveryBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedDockerRecoveryBindingは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedDockerRecoveryBinding(
  recoveryCapability: unknown,
  recoveryId: unknown,
  managementCapability: unknown,
  stableLogicalHomeBindingHash: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    record !== null &&
    typeof recoveryId === "string" &&
    record.recoveryId === recoveryId &&
    record.managementCapability === managementCapability &&
    typeof stableLogicalHomeBindingHash === "string" &&
    record.stableLogicalHomeBindingHash === stableLogicalHomeBindingHash
  );
}

/**
 * 作成要求前の予定を単一現在状態へ保存する。
 * @responsibility 作成要求前の予定を単一現在状態へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 固定資源用途。
 * @returns 保存確定時だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 不正用途・別操作・既要求・保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function markRuntimeOwnedDockerResourceSubmission(
  recoveryCapability: unknown,
  purpose: unknown,
  resourcesValue: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record || typeof purpose !== "string" || !CREATE_PURPOSES.has(purpose))
    return false;
  try {
    const resources = snapshotJsonValue(resourcesValue) as Record<
      string,
      unknown
    >;
    const saved = saveOperationCheckpoint(
      record.managementCapability,
      record.recoveryId,
      {
        kind: "resource",
        value: { ...resources, event: "submission", key: purpose },
      },
    );
    return (
      saved.status === "completed" &&
      saved.snapshotConfirmed &&
      saved.lockReleased
    );
  } catch {
    return false;
  }
}

/**
 * Provider要求前の観測限界を同じ現在状態へ保存する。
 * @responsibility 固定Host callbackを同じOwnerの実行評価checkpointへ接続する。
 * @trace ARCH-000008
 * @input recoveryCapability: 同じ実行中操作を識別する元Owner。
 * @returns 保存確定と排他解放を確認した場合だけtrue。
 * @precondition 同じ本番操作は実行中で、終了要約をまだ固定していない。
 * @postcondition 初期評価をunknownへ進め、既知評価と他のlifecycle項目を維持する。
 * @effect 既存state.json Writerの六field checkpointだけ。
 * @failure 別操作、Owner不一致、終端、保存不明はfalse。
 * @invariant Docker CLI開始や成功出力をProvider実開始・送信成立へ昇格しない。
 * @boundary Controllerの同期要求前境界とRepository内の現在状態。
 * @security 新しい実行・回復Authorityを発行しない。
 * @concurrency 既存Writerの短期排他と元版照合を使用する。
 */
export function recordRuntimeOwnedUnstartedAttempt(
  capability: object,
  management: object,
  result: StartResult<"attempt"> & Readonly<{ status: "blocked" }>,
): boolean {
  const record = durableRecord(capability);
  if (
    !record ||
    record.managementCapability !== management ||
    result.recoveryId !== record.recoveryId
  )
    return false;
  const current = readOperationStateStage(management);
  const operation = current.value?.snapshot.operations.find(
    (item): item is ExecutionOperationRecord =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    !operation ||
    operation.phase !== "executing" ||
    operation.outcome !== null ||
    operation.summarySha256 !== null ||
    (operation.resources?.checkpoints.some(
      (resource) => resource.submission !== "none",
    ) ??
      false) ||
    operation.execution.providerStart !== "not_started" ||
    operation.execution.externalSend !== "not_issued" ||
    operation.execution.sharedWrite !== "not_issued"
  )
    return false;
  const saved = saveOperationCheckpoint(management, record.recoveryId, {
    kind: "lifecycle",
    value: {
      phase: operation.phase,
      lease: operation.lease,
      execution: { ...operation.execution, ownerEffect: "disabled" },
      primaryFailure: {
        purpose: null,
        stage:
          result.reason === "docker_process_controller_recovery_unavailable"
            ? "home_lock"
            : "plan_validation",
        reason: result.reason,
        exceptionCode: null,
        commandHandleObtained: false,
        responseObserved: false,
        receiptRecorded: false,
      },
      outcome: null,
      summarySha256: null,
    },
  });
  return (
    saved.status === "completed" &&
    saved.snapshotConfirmed &&
    saved.lockReleased
  );
}

/**
 * Provider要求予定を既存の実行記録へ保存する。
 * @responsibility 要求予定と実開始を混同せず、既存Writerだけを使う。
 * @trace ARCH-000008
 */
export function recordRuntimeOwnedDockerProviderSubmission(
  recoveryCapability: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record) return false;
  const current = readOperationStateStage(record.managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (item): item is ExecutionOperationRecord =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    !operation ||
    operation.phase !== "executing" ||
    operation.summarySha256 !== null ||
    operation.outcome !== null ||
    operation.execution.ownerEffect !== "active"
  )
    return false;
  const saved = saveOperationCheckpoint(
    record.managementCapability,
    record.recoveryId,
    {
      kind: "lifecycle",
      value: {
        phase: operation.phase,
        lease: operation.lease,
        execution: {
          ...operation.execution,
          providerStart:
            operation.execution.providerStart === "not_started"
              ? "unknown"
              : operation.execution.providerStart,
          externalSend:
            operation.execution.externalSend === "not_issued"
              ? "unknown"
              : operation.execution.externalSend,
          sharedWrite:
            operation.execution.sharedWrite === "not_issued"
              ? "unknown"
              : operation.execution.sharedWrite,
        },
        primaryFailure: operation.primaryFailure,
        outcome: operation.outcome,
        summarySha256: operation.summarySha256,
      },
    },
  );
  return (
    saved.status === "completed" &&
    saved.snapshotConfirmed &&
    saved.lockReleased
  );
}

/**
 * Dockerが返したexact IDを元作成予定へ保存する。
 * @responsibility Dockerが返したexact IDを元作成予定へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 用途。rawDockerId: 元作成応答。
 * @returns 保存確定時だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 予定欠落・ID不正・別ID・保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedDockerResourceReceipt(
  recoveryCapability: unknown,
  purpose: unknown,
  resourcesValue: unknown,
  source: "receipt" | "identified" = "receipt",
) {
  const record = durableRecord(recoveryCapability);
  if (!record || typeof purpose !== "string" || !CREATE_PURPOSES.has(purpose))
    return false;
  try {
    const resources = snapshotJsonValue(resourcesValue) as Record<
      string,
      unknown
    >;
    const saved = saveOperationCheckpoint(
      record.managementCapability,
      record.recoveryId,
      {
        kind: "resource",
        value: { ...resources, event: source, key: purpose },
      },
    );
    return (
      saved.status === "completed" &&
      saved.snapshotConfirmed &&
      saved.lockReleased
    );
  } catch {
    return false;
  }
}

/**
 * 元Controllerの要求前取消だけを未発行として現在状態へ保存する。
 * @responsibility 予定保存後の取消を、応答欠落や過去unknownから区別する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。purpose: 固定用途。
 * @returns 同じOwnerと用途の専用保存が成立した場合だけtrue。
 * @precondition 本番ControllerがstartCommand前に取消を確認している。
 * @postcondition 元予定を保持し、未発行終端へ進める。
 * @effect 同じRepositoryの資源checkpointのみ。
 * @failure 別Owner・別用途・既要求・保存不明はfalse。
 * @invariant ID欠落や清掃成功から未発行を推定しない。
 * @boundary 固定Host callbackと現在状態Owner。
 * @security 通知から起動・削除Authorityを発行しない。
 * @concurrency 同期callbackの寿命内だけ既存Writerを呼ぶ。
 */
export function recordRuntimeOwnedDockerResourceNotIssued(
  recoveryCapability: unknown,
  purpose: unknown,
) {
  const record = durableRecord(recoveryCapability);
  return (
    !!record &&
    saveResourceNotIssuedStage(
      record.managementCapability,
      record.recoveryId,
      purpose,
    ).status === "completed"
  );
}

/**
 * 元清掃Ownerの五資源観測を現在状態へ保存する。
 * @responsibility 元清掃Ownerの五資源観測を現在状態へ保存する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。observations: 元のexact観測。
 * @returns 保存確定時だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonの資源checkpoint。
 * @failure 用途・名前・ID・根拠欠落または保存不明はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedDockerAbsence(
  recoveryCapability: unknown,
  observations: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record || record.normalRestoration || record.cleanupCheckpoint)
    return false;
  const saved = saveOperationCheckpoint(
    record.managementCapability,
    record.recoveryId,
    { kind: "cleanup", value: observations },
  );
  if (
    saved.status !== "completed" ||
    !saved.snapshotConfirmed ||
    !saved.lockReleased
  )
    return false;
  const current = readOperationStateStage(record.managementCapability);
  if (
    current.status !== "completed" ||
    !current.value ||
    !current.lockReleased ||
    current.value.snapshot.revision !== saved.revision ||
    current.value.payloadSha256 !== saved.payloadSha256
  )
    return false;
  record.cleanupCheckpoint = Object.freeze({
    revision: current.value.snapshot.revision,
    payloadSha256: current.value.payloadSha256,
  });
  return true;
}

/**
 * 元Mount終了結果を同じ操作のHost復帰へ保持する。
 * @responsibility 元Mount終了結果を同じ操作のHost復帰へ保持する。
 * @trace ARCH-000008
 * @input recoveryCapability: 元Owner。mountCompletion: 元Mount結果。
 * @returns 結果保持時true。真正性はHost復帰時に元計画と照合する。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect N/A: 元結果のProcess内保持だけ。
 * @failure 元Owner・結果欠落はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedNormalMountCompletion(
  recoveryCapability: unknown,
  mountCompletion: unknown,
) {
  const record = durableRecord(recoveryCapability);
  if (!record || !mountCompletion || typeof mountCompletion !== "object")
    return false;
  record.mountCompletion = mountCompletion;
  return true;
}

/**
 * 実清掃とMount終了からHost通常復帰と実Lease解放を確定する。
 * @responsibility 実清掃とMount終了からHost通常復帰と実Lease解放を確定する。
 * @trace ARCH-000008
 * @input recoveryCapability、managementCapability: 元Owner。rawCompletion: 元計画・清掃・Mount結果。
 * @returns 元の終了限定Capability、または停止結果。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 現在状態、所有Host遷移と実Lease解放のみ。
 * @failure 元結果不一致・保存・Host・Lease解放不明は停止。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
function completeProductionRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
  rawCompletion: unknown,
) {
  const record = durableRecord(recoveryCapability);
  const completion = snapshotPlainRecord(
    rawCompletion,
    new Set(["plan", "mountCompletion"]),
  );
  if (
    !record ||
    record.managementCapability !== managementCapability ||
    !completion ||
    !record.cleanupCheckpoint ||
    completion.mountCompletion !== record.mountCompletion
  )
    return Object.freeze({ status: "blocked" as const });
  if (record.normalRestoration) {
    if (
      completion.plan !== record.normalRestoration.plan ||
      completion.mountCompletion !== record.normalRestoration.mountCompletion
    )
      return Object.freeze({ status: "blocked" as const });
  }
  if (
    record.normalRestoration?.result.status !== "completed" ||
    !record.normalRestoration.result.hostTransitionConfirmed
  ) {
    const before = readOperationStateStage(managementCapability);
    const priorHost = record.normalRestoration?.result;
    const expected =
      priorHost &&
      "revision" in priorHost &&
      typeof priorHost.revision === "number" &&
      "payloadSha256" in priorHost &&
      typeof priorHost.payloadSha256 === "string"
        ? {
            revision: priorHost.revision,
            payloadSha256: priorHost.payloadSha256,
          }
        : record.cleanupCheckpoint;
    const previous = before.value?.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      before.status !== "completed" ||
      !before.lockReleased ||
      !previous ||
      (record.normalRestoration &&
        previous.identityJson !== record.normalRestoration.identityJson) ||
      before.value?.snapshot.revision !== expected.revision ||
      before.value.payloadSha256 !== expected.payloadSha256
    )
      return Object.freeze({ status: "blocked" as const });
    const restored = completeRuntimeOwnedCoordinatorHostSubmission(
      managementCapability,
      record.recoveryId,
      completion.plan as Parameters<
        typeof completeRuntimeOwnedCoordinatorHostSubmission
      >[2],
      completion.mountCompletion,
    );
    record.normalRestoration = {
      plan: completion.plan,
      mountCompletion: completion.mountCompletion,
      identityJson: previous.identityJson,
      result: restored,
    };
    if (restored.status !== "completed" || !restored.hostTransitionConfirmed)
      return Object.freeze({ ...restored, status: "blocked" as const });
  }
  const current = readOperationStateStage(managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (item): item is ExecutionOperationRecord =>
      item.kind === "docker_task" && item.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !operation ||
    operation.identityJson !== record.normalRestoration.identityJson ||
    operation.phase !== "executing" ||
    operation.host.cleanup !== "not_requested" ||
    operation.host.pendingTransitionJson !== null
  )
    return Object.freeze({ status: "blocked" as const });
  const host = borrowOwnedHostRecoverySnapshot(managementCapability);
  if (
    host.snapshot.record.state !== "host_only" ||
    host.snapshot.token !== operation.host.currentToken
  )
    return Object.freeze({ status: "blocked" as const });
  if (!record.homeLeaseReleased)
    return Object.freeze({
      status: "blocked" as const,
      recoveryId: record.recoveryId,
    });
  const saved = saveOperationCheckpoint(
    managementCapability,
    record.recoveryId,
    {
      kind: "lifecycle",
      value: {
        phase: operation.phase,
        lease: "released",
        execution: { ...operation.execution, ownerEffect: "disabled" },
        primaryFailure: operation.primaryFailure,
        outcome: operation.outcome,
        summarySha256: operation.summarySha256,
      },
    },
  );
  if (
    saved.status !== "completed" ||
    !saved.snapshotConfirmed ||
    !saved.lockReleased
  )
    return Object.freeze({ ...saved, status: "blocked" as const });
  if (!dockerHostCleanupCapabilities.has(recoveryCapability as object))
    dockerHostCleanupCapabilities.set(
      recoveryCapability as object,
      issueOwnedHostCleanupCapability(managementCapability, recoveryCapability),
    );
  return Object.freeze({
    status: "completed" as const,
    recoveryFinalizationCapability: recoveryCapability as object,
  });
}

/**
 * 正常回収Ownerが実際に確認したHomeLease解放を照合する。
 *
 * @responsibility 正常経路の実release成功だけを同じ操作へ非Authorityの事実として保持する。
 * @trace ARCH-000008
 * @input recoveryCapability、managementCapability、operationId、recoveryId: 元の回復参照と操作相関。
 * @returns 同じ実解放を保持する場合だけtrue。
 * @precondition 正常回収Ownerが実releaseを成功確認した元Capabilityを使う。
 * @postcondition abandon、偽Capability、別操作と別参照は根拠にならない。
 * @effect N/A: 私有WeakMapの照合だけを行う。
 * @failure 未登録・相関不一致ではfalse。
 * @invariant 後続処理の失敗で既知の実解放を未解放へ戻さない。
 * @boundary 実HomeLease Ownerから同じ操作の終端保存への事実搬送。
 * @security 解放事実から起動・清掃・回復Authorityを復元しない。
 * @concurrency N/A: 同期照合だけを行いLockや外部待機を追加しない。
 */
export function verifyRuntimeOwnedDockerHomeLeaseRelease(
  recoveryCapability: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  if (!recoveryCapability || typeof recoveryCapability !== "object")
    return false;
  const released = durableRecord(recoveryCapability, false);
  return (
    !!released &&
    released.homeLeaseReleased &&
    released.managementCapability === managementCapability &&
    released.operationId === operationId &&
    released.recoveryId === recoveryId
  );
}

/**
 * 真正終端の用途別配送を確認し、Process内Ownerを必要な間だけ保持する。
 * @responsibility 真正終端の用途別配送を確認し、Process内Ownerを必要な間だけ保持する。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元終了Owner。
 * @returns 配送準備確認時completed。耐久ACK待ちは別結果で保持。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 確定済みの同Owner結果は再利用し、未確定時だけ既存終了driverへ再入場する。
 * @failure 元Host・Controller結果欠落または終了保存不明は停止。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function finalizeRuntimeOwnedDockerRecovery(
  recoveryFinalizationCapability: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  if (!record?.hostCleanupOutcome || !record.dockerCompletion)
    return Object.freeze({ status: "blocked" as const });
  // 受領済みの真正な終了結果を再保存しない。別Stageによる現在版の進行を巻き戻さない。
  const settled =
    record.settlementResult?.status === "completed"
      ? record.settlementResult
      : completeOperation(
          record.settlementContext,
          record.hostCleanupOutcome,
          record.dockerCompletion,
        );
  record.settlementResult = settled;
  if (settled.status !== "completed") return settled;
  durableRecords.delete(recoveryFinalizationCapability as object);
  return Object.freeze({ ...settled, status: "completed" as const });
}

/**
 * 実通常復帰後の終了限定CapabilityをHost清掃へ渡す。
 * @responsibility 実通常復帰後の終了限定CapabilityをHost清掃へ渡す。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元終了Owner。
 * @returns 元Host回復token、またはnull。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 同じstate.jsonへHost清掃予定を保存する。
 * @failure Capability欠落・Host不一致・保存不明ではnull。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function prepareRuntimeOwnedDockerHostCleanup(
  recoveryFinalizationCapability: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  const capability =
    recoveryFinalizationCapability &&
    typeof recoveryFinalizationCapability === "object"
      ? dockerHostCleanupCapabilities.get(recoveryFinalizationCapability)
      : null;
  if (!record) return null;
  if (record.hostCleanupPreparation) {
    if (!record.hostCleanupPreparation.tokenMatches) return null;
    const saved = saveHostCleanupPreparation(
      record.managementCapability,
      record.recoveryId,
      record.hostCleanupPreparation.before,
    );
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return null;
    dockerHostCleanupCapabilities.delete(
      recoveryFinalizationCapability as object,
    );
    return record.hostCleanupPreparation.token;
  }
  if (!capability) return null;
  const current = readOperationStateStage(record.managementCapability, {
    kind: "host_cleanup",
    recoveryId: record.recoveryId,
  });
  const preparation = current.hostCleanupPreparation;
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    !preparation ||
    preparation.recoveryId !== record.recoveryId
  )
    return null;
  const before = preparation.before;
  const token = consumeOwnedHostRecoveryIdForCleanup(
    capability,
    recoveryFinalizationCapability,
  );
  record.hostCleanupPreparation = {
    token,
    tokenMatches: token === preparation.hostToken,
    before,
  };
  if (token !== preparation.hostToken) return null;
  const saved = saveHostCleanupPreparation(
    record.managementCapability,
    record.recoveryId,
    before,
  );
  if (
    saved.status !== "completed" ||
    !saved.snapshotConfirmed ||
    !saved.lockReleased
  )
    return null;
  dockerHostCleanupCapabilities.delete(
    recoveryFinalizationCapability as object,
  );
  return token;
}

/**
 * 受領したレビュー結果から同じTaskの限定是正許可を作る。
 * @responsibility 既存の終端相関と初回レビュー条件を照合する。
 * @trace ARCH-000008
 * @input 同じhandoffのCapabilityとExecutorが返したCompletionResult。
 * @returns 既存の一回使用許可又はnull。
 * @precondition Task Ownerが取消・実行完了を確認して一回だけ呼ぶ。
 * @postcondition 別結果、別操作、清掃不明、二回目レビューへ発行しない。
 * @effect Coordinator既存のProcess内許可への登録だけ。
 * @failure 相関又は所見の不一致では許可を作らない。
 * @invariant 所見の内容を実行・採用判断と同一視しない。
 * @boundary Executorの一時結果とCoordinatorの次試行許可。
 * @security 本文をstate・history・公開DTO・ログへ複製しない。
 * @concurrency awaitを挟まない同じTask Ownerの同期処理。
 */
export function registerRuntimeOwnedReviewFindings(
  capability: object,
  result: CompletionResult<"attempt">,
) {
  const record = durableRecord(capability);
  const plan = record?.normalRestoration?.plan as RecoveryPlan | undefined;
  const terminal = record?.terminalObservation;
  if (
    !record ||
    !plan ||
    record.dockerCompletion !== result ||
    !terminal ||
    terminal.homeLeaseReleased !== true ||
    !terminal.mountLeaseReleased ||
    !terminal.recoveryCompleted ||
    terminal.recoveryId !== record.recoveryId ||
    terminal.operationId !== record.operationId ||
    result.status !== "completed" ||
    !result.cleanupConfirmed ||
    result.cancellationRequested ||
    result.operationId !== record.operationId ||
    !borrowOwnedOperationExecutionSelection(
      record.managementCapability,
      plan.selectionRecordId,
      plan.selectionHash,
      plan.taskAttempt,
      plan.executionSelection,
    ) ||
    record.operationId !== plan.operationId ||
    plan.operationMode !== "isolated_task" ||
    plan.taskRole !== "reviewer" ||
    plan.taskAttempt !== 0 ||
    !result.normalizedResult ||
    !("decision" in result.normalizedResult) ||
    result.normalizedResult.decision !== "changes_requested" ||
    !result.reviewFindings?.length ||
    result.normalizedResult.findingCount !== result.reviewFindings.length
  )
    return null;
  return registerTaskRemediation(
    record.operationId,
    plan.taskAttempt,
    result.reviewFindings,
  );
}

/**
 * Executorの固定callbackから既存操作記録へ終端材料を結合する。
 * @responsibility 結果と観測を既存Ownerだけに保持し、新Mapを作らない。
 * @trace ARCH-000008
 * @input 元回復Capability、結果、閉じた終端観測。
 * @returns N/A: 既存recordの更新のみ。
 * @precondition 固定Host構成の内部callbackである。
 * @postcondition 別操作・別参照・二重差替えを拒否する。
 * @effect Process内の既存操作記録のみ。
 * @failure 不一致は例外。技術清掃結果は変更しない。
 * @invariant 外部の完了申告を受ける入口として公開しない。
 * @boundary Executorの終了とCoordinatorの既存操作Owner。
 * @security 新しい実行Authorityを発行しない。
 * @concurrency 同じ試行の終了時に同期で結合する。
 */
export function recordRuntimeOwnedDockerTerminalObservation(
  capability: object,
  result: object,
  observation: RecordedAttemptObservation,
) {
  const record = durableRecord(capability);
  if (
    !record?.initializationReady ||
    !record.settlementContext ||
    record.operationId !== observation.operationId ||
    record.recoveryId !== observation.recoveryId ||
    (record.dockerCompletion !== undefined &&
      record.dockerCompletion !== result)
  )
    throw Error("executor_terminal_delivery_mismatch");
  if (
    record.dockerCompletion !== undefined ||
    record.terminalObservation !== undefined
  ) {
    if (
      record.dockerCompletion === result &&
      record.terminalObservation === observation
    )
      return;
    throw Error("executor_terminal_delivery_mismatch");
  }
  record.dockerCompletion = result;
  record.terminalObservation = observation;
}

/**
 * 元Host清掃と元Controller結果を終了driverへ接続する。
 * @responsibility 元Host清掃と元Controller結果を終了driverへ接続する。
 * @trace ARCH-000008
 * @input recoveryFinalizationCapability: 元Owner。rawCompletion: 元Host・Controller結果。
 * @returns 終了保存と配送準備を確認した場合だけtrue。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 現在状態と履歴の保存のみ。
 * @failure 偽結果・別操作・実終了または保存未確認はfalse。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function recordRuntimeOwnedDockerHostCleanupReceipt(
  recoveryFinalizationCapability: unknown,
  rawCompletion: unknown,
) {
  const record = durableRecord(recoveryFinalizationCapability);
  const completion = snapshotPlainRecord(
    rawCompletion,
    new Set(["hostCleanupOutcome", "dockerCompletion"]),
  );
  if (
    !record ||
    !completion ||
    record.dockerCompletion !== completion.dockerCompletion ||
    !record.terminalObservation
  )
    return false;
  const settled = completeOperation(
    record.settlementContext,
    completion.hostCleanupOutcome,
    completion.dockerCompletion,
  );
  if (!settled.inputAccepted) return false;
  record.hostCleanupOutcome = completion.hostCleanupOutcome;
  record.dockerCompletion = completion.dockerCompletion;
  record.settlementResult = settled;
  return settled.status === "completed";
}

/**
 * abandon Runtime 所有 Docker 回復を決定する。
 *
 * @responsibility abandon Runtime 所有 Docker 回復の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input recoveryCapability: unknown
 * @returns abandonRuntimeOwnedDockerRecoveryの計算結果を返す。
 * @precondition 「recoveryCapability: unknown」がabandonRuntimeOwnedDockerRecoveryの入力契約を満たす。
 * @postcondition abandonRuntimeOwnedDockerRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: abandonRuntimeOwnedDockerRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: abandonRuntimeOwnedDockerRecoveryは独自の失敗分岐を所有しない。
 * @invariant abandonRuntimeOwnedDockerRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: abandonRuntimeOwnedDockerRecoveryはProcess内の同一Subsystemで完結する。
 * @security abandonRuntimeOwnedDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: abandonRuntimeOwnedDockerRecoveryは共有非同期状態を持たない同期処理である。
 */
export function abandonRuntimeOwnedDockerRecovery(recoveryCapability: unknown) {
  const record = durableRecord(recoveryCapability, false);
  if (!record) return false;
  dockerHostCleanupCapabilities.delete(recoveryCapability as object);
  return record.homeLeaseReleased;
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
function safeRecoveryReason(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return /^(?:docker_task|host_recovery)_[a-z0-9_]{1,120}$/u.test(message)
    ? message
    : fallback;
}

/**

/**
 * Docker再起動境界で使用する文字列集合を決定順へ正規化する。
 *
 * @responsibility Recovery一覧と論理Home一覧を重複のない決定順へ正規化する。
 * @trace ARCH-000008
 * @input values: readonly string[]
 * @returns 重複を除き昇順に整列した文字列配列を返す。
 * @precondition valuesは観測済みの文字列配列である。
 * @postcondition 入力順に依存せず、同じ集合から同じ配列を返す。
 * @effect N/A: 入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: 文字列配列以外の入力は型境界で拒否される。
 * @invariant 入力配列を変更せず、値の追加または推測を行わない。
 * @boundary N/A: Process内の同一Subsystemで完結する。
 * @security Recovery Identityを新設、短縮または外部公開しない。
 * @concurrency N/A: 共有非同期状態を持たない同期処理である。
 */
function normalizeDockerRestartScope(values: readonly string[]) {
  return Object.freeze([...new Set(values)].sort());
}

/**
 * 実行資源の義務が残る操作だけを再起動Scopeへ含める。
 * @responsibility 配送待ちだけの清掃済み操作と実行義務を区別する。
 * @trace ARCH-000008
 * @input operation: 検証済み現在操作。
 * @returns 実行義務が残る場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect N/A: 純粋な現在値評価だけ。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
function restartScopeIncludes(
  operation: OperationRecord,
  resourcesSettled: boolean,
): operation is ExecutionOperationRecord {
  if (operation.kind !== "docker_task") return false;
  return (
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    operation.host.cleanup !== "confirmed" ||
    operation.host.pendingTransitionJson !== null ||
    operation.lease !== "released" ||
    operation.execution.ownerEffect !== "disabled" ||
    operation.execution.providerStart === "unknown" ||
    operation.execution.externalSend === "unknown" ||
    operation.execution.sharedWrite === "unknown" ||
    !resourcesSettled
  );
}

/**
 * 現在のRepository・exact操作・全Scopeを既存排他へ結合する。
 * @responsibility 不透明な準備Mapだけへ現在書込みOwnerを保持する。
 * @trace ARCH-000008
 * @input token: exact回復参照、rootCapability: 検証済みRepository Root。
 * @returns 固定要求IDと不透明な準備、または一次／解放失敗の分離結果。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 既存Host／Home／Runtime排他の取得と現在状態の読取り。Docker要求なし。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function prepareRuntimeOwnedDockerRestart(
  token: unknown,
  rootCapability: unknown,
) {
  const parsed = parseDockerTaskRecoveryId(token);
  const locks: Array<
    Readonly<{ assertLive: () => boolean; release: () => boolean }>
  > = [];
  let observationCleanupConfirmed = true;
  try {
    if (!parsed) throw new Error("docker_restart_id_invalid");
    const repository =
      borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
    const initial = readState(rootCapability, { scope: "recovery" });
    observationCleanupConfirmed = initial.lockReleased;
    if (
      !repository ||
      initial.status !== "completed" ||
      !initial.value ||
      !initial.lockReleased
    )
      throw new Error("docker_restart_root_unverified");
    const scoped = initial.value.snapshot.operations.filter(
      (operation): operation is ExecutionOperationRecord => {
        const state = initial.value?.operationStates.find(
          (value) => value.operation === operation,
        );
        if (!state || state.kind !== operation.kind)
          throw new Error("docker_restart_boundary_changed");
        return (
          state.kind === "docker_task" &&
          restartScopeIncludes(state.operation, state.resourcesSettled)
        );
      },
    );
    const target = scoped.find(
      (operation) => operation.recoveryId === parsed.token,
    );
    if (!target) throw new Error("docker_restart_scope_conflict");
    const recoveryIds = normalizeDockerRestartScope(
      scoped.map((operation) => operation.recoveryId),
    );
    const identities = scoped
      .map((operation) => {
        const recovery = parseDockerTaskRecoveryId(operation.recoveryId);
        if (!recovery) throw new Error("docker_restart_scope_conflict");
        return {
          recoveryId: operation.recoveryId,
          identitySha256: operation.identitySha256,
          home: recovery.stableLogicalHomeBindingHash,
          host: parseHostRecoveryToken(operation.host.currentToken),
        };
      })
      .sort((left, right) => left.recoveryId.localeCompare(right.recoveryId));
    const scopeSha256 = createHash("sha256")
      .update(
        JSON.stringify({
          schema: "crdd-coordinator/docker-restart-scope/v1",
          repositoryBinding: repository.repositoryBinding,
          identities,
        }),
      )
      .digest("hex");
    const hosts = new Map<string, (typeof identities)[number]["host"]>();
    for (const identity of identities)
      hosts.set(
        `${identity.host.rootName}\0${identity.host.nonce}`,
        identity.host,
      );
    for (const [, host] of [...hosts].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const source = scoped.find((operation) => {
        const token = parseHostRecoveryToken(operation.host.currentToken);
        return token.rootName === host.rootName && token.nonce === host.nonce;
      });
      if (!source) throw Error("docker_restart_host_identity_unknown");
      const hostRoot = JSON.parse(source.identityJson).hostPaths.root;
      const acquired = acquireHostOperationLock(hostRoot, host.nonce);
      if (acquired.status !== "acquired") {
        observationCleanupConfirmed &&= acquired.cleanupConfirmed;
        if (!acquired.descriptorClosed)
          poisonRuntimeProcessAfterCleanupUnknown();
        throw Error(
          acquired.reason === "lock_initialization_failed"
            ? "docker_restart_host_lock_initialization_failed"
            : "docker_restart_host_active_or_unknown",
        );
      }
      locks.push(acquired.lock);
    }
    for (const home of normalizeDockerRestartScope(
      identities.map((identity) => identity.home),
    )) {
      const lock = acquireProviderHomeLock(
        home,
        providerHomesDirectoryCandidate(),
      );
      if (lock.status !== "acquired") {
        observationCleanupConfirmed &&= lock.cleanupConfirmed;
        if (!lock.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
        throw Error(
          lock.reason === "lock_initialization_failed"
            ? "docker_restart_home_lock_initialization_failed"
            : "docker_restart_home_active_or_unknown",
        );
      }
      locks.push(lock.lock);
    }
    const state = acquireExecutionStateLock(runtimeStateDirectoryCandidate());
    if (state.status !== "acquired") {
      observationCleanupConfirmed &&= state.cleanupConfirmed;
      if (!state.descriptorClosed) poisonRuntimeProcessAfterCleanupUnknown();
      throw Error(
        state.reason === "lock_initialization_failed"
          ? "docker_restart_state_lock_initialization_failed"
          : "docker_restart_state_active_or_unknown",
      );
    }
    locks.push(state.lock);
    const current = readState(rootCapability, {
      scope: "recovery",
      input: {
        kind: "restart_preparation",
        recoveryId: target.recoveryId,
        scopeSha256,
      },
    });
    observationCleanupConfirmed &&= current.lockReleased;
    const before = Buffer.from(initial.value.sourceText, "utf8");
    if (
      !locks.every((lock) => lock.assertLive()) ||
      !repository.revalidate() ||
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(before)
    )
      throw new Error("docker_restart_boundary_changed");
    if (!("restartPreparation" in current) || !current.restartPreparation)
      throw new Error("docker_restart_scope_conflict");
    const requestId = current.restartPreparation.requestId;
    const capability = Object.freeze({});
    dockerRecoveryPreparations.set(capability, {
      kind: "restart",
      repository: Object.freeze({
        ...repository,
        operationId: JSON.parse(target.identityJson).operationId,
      }),
      rootCapability,
      recoveryId: target.recoveryId,
      requestId,
      scopeSha256,
      recoveryIds,
      locks: Object.freeze(locks),
      before,
      checkpoint: target.dockerRestart,
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      releaseAttempted: false,
      releaseConfirmed: false,
      finalizationAttempted: false,
    });
    return Object.freeze({
      status: "prepared" as const,
      capability,
      recoveryId: target.recoveryId,
      requestId,
      scopeSha256,
      alreadyRequested:
        target.dockerRestart !== null &&
        (target.dockerRestart.request !== "not_issued" ||
          target.dockerRestart.result !== null),
      checkpointInitialized: target.dockerRestart !== null,
      primaryFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: false,
    });
  } catch (error) {
    const fixed = new Set([
      "docker_restart_home_lock_initialization_failed",
      "docker_restart_state_lock_initialization_failed",
      "docker_restart_host_lock_initialization_failed",
      "docker_restart_id_invalid",
      "docker_restart_root_unverified",
      "docker_restart_scope_conflict",
      "docker_restart_host_active_or_unknown",
      "docker_restart_home_active_or_unknown",
      "docker_restart_state_active_or_unknown",
      "docker_restart_boundary_changed",
    ]);
    const primaryFailure =
      error instanceof Error && fixed.has(error.message)
        ? error.message
        : "docker_restart_preparation_unconfirmed";
    let cleanupConfirmed = observationCleanupConfirmed;
    for (const lock of [...locks].reverse()) {
      try {
        if (!lock.release()) cleanupConfirmed = false;
      } catch {
        cleanupConfirmed = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: cleanupConfirmed
        ? primaryFailure
        : "docker_restart_cleanup_unconfirmed",
      primaryFailure,
      cleanupFailure: cleanupConfirmed
        ? null
        : ("docker_restart_cleanup_unconfirmed" as const),
      cleanupConfirmed,
      recoveryId: parsed?.token ?? null,
    });
  }
}

/**
 * 取得済み準備Ownerの排他と現在本文を再確認する。
 * @responsibility 保存値の相関だけで実行許可を推定しない。
 * @trace ARCH-000008
 * @input capability: 既存準備Mapの不透明キー。
 * @returns 同じOwner・Scope・元版の場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 現在状態Readerと既存排他の観測。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function verifyRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "restart" || record.closed || record.persistenceFailed)
    return false;
  try {
    if (
      !record.locks.every((lock) => lock.assertLive()) ||
      !record.repository.revalidate()
    )
      return false;
    const current = readState(record.rootCapability, { scope: "recovery" });
    if (!current.lockReleased) record.cleanupUnknown = true;
    return (
      current.status === "completed" &&
      !!current.value &&
      current.lockReleased &&
      Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    );
  } catch {
    return false;
  }
}

/**
 * 同じ準備Ownerの一要求checkpointを現在状態へ保存する。
 * @responsibility 元版競合と保存不明後の追加要求を止める。
 * @trace ARCH-000008
 * @input capability: 準備Mapキー、checkpoint: 同要求の次値。
 * @returns 保存・読戻し・更新排他解放を確認した場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 対象再起動欄だけの既存Writer更新。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function persistRuntimeOwnedDockerRestartCheckpoint(
  capability: unknown,
  checkpoint: RestartCheckpoint,
): boolean {
  if (!verifyRuntimeOwnedDockerRestartPreparation(capability)) return false;
  const record = dockerRecoveryPreparations.get(capability as object);
  if (
    record?.kind !== "restart" ||
    checkpoint.requestId !== record.requestId ||
    checkpoint.scopeSha256 !== record.scopeSha256
  )
    return false;
  record.persistenceFailed = true;
  try {
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind: "restart",
        value: checkpoint,
        assertOwner: () =>
          !record.closed &&
          record.locks.every((lock) => lock.assertLive()) &&
          record.repository.revalidate(),
      },
    );
    if (!saved.lockReleased) record.cleanupUnknown = true;
    if (
      saved.status !== "completed" ||
      !saved.snapshotConfirmed ||
      !saved.lockReleased
    )
      return false;
    const observed = readState(record.rootCapability, { scope: "recovery" });
    if (!observed.lockReleased) record.cleanupUnknown = true;
    if (
      observed.status !== "completed" ||
      !observed.value ||
      !observed.lockReleased ||
      observed.value.snapshot.revision !== saved.revision ||
      observed.value.payloadSha256 !== saved.payloadSha256
    )
      return false;
    const operation = observed.value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
        item.kind === "docker_task" && item.recoveryId === record.recoveryId,
    );
    if (
      !operation ||
      !isDeepStrictEqual(
        snapshotJsonValue(operation.dockerRestart),
        snapshotJsonValue(checkpoint),
      )
    )
      return false;
    record.before = Buffer.from(observed.value.sourceText, "utf8");
    record.checkpoint = operation.dockerRestart;
    record.persistenceFailed = false;
    return verifyRuntimeOwnedDockerRestartPreparation(capability);
  } catch {
    return false;
  }
}

/**
 * 既存準備Ownerを閉じて全排他を逆順に解放する。
 * @responsibility 一つの解放失敗でも後続解放を省略しない。
 * @trace ARCH-000008
 * @input capability: 準備Mapキー。
 * @returns 全解放が確認できた場合だけtrue。
 * @precondition 現在Repositoryと既存準備Ownerだけを使用する。
 * @postcondition 不明を成功・未発行・新しい処置許可へ変換しない。
 * @effect 取得済み排他の解放だけ。Docker要求なし。
 * @failure 不一致・観測不能・失効では固定拒否する。
 * @invariant 旧AppData・署名・phase記録へfallbackしない。
 * @boundary Repository現在状態と取得済みHost／Home排他。
 * @security 保存値だけから処置Authorityを生成しない。
 * @concurrency 短期状態排他と保持中の実行排他を分ける。
 */
export function releaseRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
): boolean {
  if (!capability || typeof capability !== "object") return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (record?.kind !== "restart" || record.closed) return false;
  record.closed = true;
  record.releaseAttempted = true;
  let confirmed = !record.cleanupUnknown;
  for (const lock of [...record.locks].reverse()) {
    try {
      if (!lock.release()) confirmed = false;
    } catch {
      confirmed = false;
    }
  }
  record.releaseConfirmed = confirmed;
  return confirmed;
}

/**
 * 外側排他の解放結果を同じ要求の終端値へ一度だけ確定する。
 * @responsibility 下位技術結果と全Scope解放を、元Ownerのexact要求へ耐久反映する。
 * @trace ARCH-000008
 * @input capability: 元準備Mapキー、result: 同要求のDI返却結果。
 * @returns 終端保存確認と再起動資源Scopeのcleanup確認を別に返す。
 * @precondition 全Scopeの逆順解放を試行済み。同じMap以外からWriterを発行しない。
 * @postcondition 保存拒否・不明でもNative要求・終端保存を再発行しない。
 * @effect 固定現在状態の対象要求だけの既存Writer更新。Docker処置なし。
 * @failure 別要求、元版競合、再使用、解放不明と保存不明を完成へ畳まない。
 * @invariant 一次結果と過去unknownを消さず、短期Writer排他を再起動cleanupへ循環参入させない。
 * @boundary 解放済み元準備Ownerと同じRepositoryの終端保存。
 * @security closed Ownerは新処置・別対象更新のAuthorityを復活させない。
 * @concurrency 試行前に一回性を固定し、Writer内ではRoot実体だけを再確認する。
 */
export function finalizeRuntimeOwnedDockerRestartPreparation(
  capability: unknown,
  result: DockerEnvironmentResult<"restart">,
) {
  const refused = Object.freeze({
    status: "blocked" as const,
    snapshotConfirmed: false,
    lockReleased: true,
    cleanupConfirmed: false,
  });
  if (!capability || typeof capability !== "object") return refused;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "restart" ||
    !record.closed ||
    !record.releaseAttempted ||
    record.finalizationAttempted ||
    result.requestId !== record.requestId
  )
    return refused;
  record.finalizationAttempted = true;
  const cleanupConfirmed = result.cleanupConfirmed && record.releaseConfirmed;
  if (record.checkpoint === null)
    return Object.freeze({ ...refused, cleanupConfirmed });
  if (record.persistenceFailed)
    return Object.freeze({ ...refused, cleanupConfirmed });
  const completed =
    result.status === "completed" &&
    result.restartCompleted &&
    result.delivery !== "unknown" &&
    result.primaryFailure === null &&
    cleanupConfirmed;
  const checkpoint: RestartCheckpoint = Object.freeze({
    ...record.checkpoint,
    cleanup:
      record.checkpoint.request === "not_issued"
        ? "not_required"
        : cleanupConfirmed
          ? "confirmed"
          : "unknown",
    result: Object.freeze({
      status: completed ? ("completed" as const) : ("blocked" as const),
      request: result.request,
      effectOutcomeUnknown: result.effectOutcomeUnknown,
      reason: !cleanupConfirmed
        ? "docker_restart_cleanup_unconfirmed"
        : result.delivery === "unknown"
          ? "docker_restart_record_unconfirmed"
          : result.reason,
    }),
  });
  let writing = true;
  try {
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind: "restart",
        value: checkpoint,
        assertOwner: () =>
          writing &&
          dockerRecoveryPreparations.get(capability) === record &&
          record.closed &&
          record.releaseAttempted &&
          record.finalizationAttempted &&
          record.repository.revalidate(),
      },
    );
    return Object.freeze({ ...saved, cleanupConfirmed });
  } catch {
    return Object.freeze({ ...refused, cleanupConfirmed });
  } finally {
    writing = false;
  }
}

/**
 * docker-recovery-runtime-internalで使用する回復 記録の値契約を定義する。
 *
 * @responsibility 回復 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RecoveryRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RecoveryRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: RecoveryRecordの宣言は外部境界を開かない。
 * @security RecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RecoveryRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RecoveryRecord = Readonly<{
  managementCapability: object;
  operationId: string;
  recoveryId: string;
}>;

/**
 * docker-recovery-runtime-internalで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  verifyOperation: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string }>;
  beginDurableRecovery: (
    managementCapability: unknown,
    operationId: unknown,
  ) => string;
  completeDurableRecovery: (
    managementCapability: unknown,
    recoveryId: unknown,
  ) => string;
}>;

/**
 * docker-recovery-runtime-internalで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  records: WeakMap<object, RecoveryRecord>;
}>;

/**
 * Runtime 状態を構築する。
 *
 * @responsibility Runtime 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns RuntimeStateを返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateRuntimeStateの入力契約を満たす。
 * @postcondition createRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant createRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security createRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function createRuntimeState(dependencies: RuntimeDependencies): RuntimeState {
  return Object.freeze({
    dependencies: Object.freeze(dependencies),
    records: new WeakMap(),
  });
}

/**
 * 回復を開始する。
 *
 * @responsibility 回復の開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、plan: Readonly<{ operationId: string }>、managementCapability: unknown
 * @returns beginRecoveryの計算結果を返す。
 * @precondition 「state: RuntimeState、plan: Readonly<{ operationId: string }>、managementCapability: unknown」がbeginRecoveryの入力契約を満たす。
 * @postcondition beginRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: beginRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: beginRecoveryは独自の失敗分岐を所有しない。
 * @invariant beginRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginRecoveryはProcess内の同一Subsystemで完結する。
 * @security beginRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginRecoveryは共有非同期状態を持たない同期処理である。
 */
function beginRecovery(
  state: RuntimeState,
  plan: Readonly<{ operationId: string }>,
  managementCapability: unknown,
) {
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !/^OP-[0-9]{6,}$/u.test(plan.operationId)
  ) {
    return null;
  }
  const operation = state.dependencies.verifyOperation(managementCapability);
  if (operation.operationId !== plan.operationId) return null;
  const recoveryId = state.dependencies.beginDurableRecovery(
    managementCapability,
    operation.operationId,
  );
  parseHostRecoveryToken(recoveryId);
  const recoveryCapability = Object.freeze({});
  state.records.set(
    recoveryCapability,
    Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      recoveryId,
    }),
  );
  return Object.freeze({ recoveryId, recoveryCapability });
}

/**
 * 回復を完了状態へ遷移させる。
 *
 * @responsibility 回復の完了条件、終了後状態、未完了境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、recoveryCapability: unknown、managementCapability: unknown
 * @returns completeRecoveryの計算結果を返す。
 * @precondition 「state: RuntimeState、recoveryCapability: unknown、managementCapability: unknown」がcompleteRecoveryの入力契約を満たす。
 * @postcondition completeRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: completeRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completeRecoveryは独自の失敗分岐を所有しない。
 * @invariant completeRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completeRecoveryはProcess内の同一Subsystemで完結する。
 * @security completeRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completeRecoveryは共有非同期状態を持たない同期処理である。
 */
function completeHostRecovery(
  state: RuntimeState,
  recoveryCapability: unknown,
  managementCapability: unknown,
) {
  if (!recoveryCapability || typeof recoveryCapability !== "object") {
    return Object.freeze({ status: "blocked" as const });
  }
  const record = state.records.get(recoveryCapability);
  if (!record || record.managementCapability !== managementCapability) {
    return Object.freeze({ status: "blocked" as const });
  }
  const operation = state.dependencies.verifyOperation(managementCapability);
  if (operation.operationId !== record.operationId) {
    return Object.freeze({ status: "blocked" as const });
  }
  const completedRecoveryId = state.dependencies.completeDurableRecovery(
    managementCapability,
    record.recoveryId,
  );
  parseHostRecoveryToken(completedRecoveryId);
  if (completedRecoveryId === record.recoveryId) {
    return Object.freeze({ status: "blocked" as const });
  }
  state.records.delete(recoveryCapability);
  return Object.freeze({ status: "completed" as const });
}

/**
 * Runtime 所有 Docker 回復を開始する。
 *
 * @responsibility Runtime 所有 Docker 回復の開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input plan: ProductionPlan、managementCapability: unknown、observeFailure: 完了を待たない任意診断
 * @returns beginRuntimeOwnedDockerRecoveryの計算結果を返す。
 * @precondition 「plan: ProductionPlan、managementCapability: unknown」がbeginRuntimeOwnedDockerRecoveryの入力契約を満たす。
 * @postcondition beginRuntimeOwnedDockerRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: beginRuntimeOwnedDockerRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure beginRuntimeOwnedDockerRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant beginRuntimeOwnedDockerRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginRuntimeOwnedDockerRecoveryはProcess内の同一Subsystemで完結する。
 * @security beginRuntimeOwnedDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 同期の開始結果を返す。任意診断の例外・拒否は捕捉し、通知Promiseの完了を待たない。
 */
export function beginRuntimeOwnedDockerRecovery(
  plan: ProductionPlan,
  managementCapability: unknown,
  observeFailure?: (
    diagnostic: RecoveryStartFailureDiagnostic,
  ) => void | Promise<void>,
) {
  try {
    return beginProductionRecovery(plan, managementCapability, observeFailure);
  } catch (error) {
    return Object.freeze({
      status: "blocked" as const,
      reason: safeRecoveryReason(
        error,
        "docker_task_recovery_begin_failed_closed",
      ),
      recoveryId: null,
      manualRecoveryRequired: true,
    });
  }
}

/**
 * 本番Controllerの元清掃結果を実Host復帰へ委譲する。
 * @responsibility 本番Controllerの元清掃結果を実Host復帰へ委譲する。
 * @trace ARCH-000008
 * @input recoveryCapability、managementCapability: 元Owner。completion: 元計画と清掃結果。
 * @returns 実Host復帰・Lease解放の結果。
 * @precondition 同じ本番操作Ownerとexact回復参照を使用する。
 * @postcondition 確認済みの元結果だけを同じ現在状態へ接続する。
 * @effect 通常復帰Ownerへ限定委譲する。
 * @failure 元結果欠落・例外は停止。
 * @invariant 旧形式へのfallbackと新しい共有管理機構を追加しない。
 * @boundary 本番Docker OwnerとRepository内の現在状態。
 * @security 保存値やCaller supplied成功booleanからAuthorityを発行しない。
 * @concurrency 保存は既存Writerの短期排他と元版照合を用いる。
 */
export function completeRuntimeOwnedDockerRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
  completion: unknown,
) {
  try {
    return completeProductionRecovery(
      recoveryCapability,
      managementCapability,
      completion,
    );
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

/**
 * Isolated Docker 回復 Runtime 候補を構築する。
 *
 * @responsibility Isolated Docker 回復 Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedDockerRecoveryRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedDockerRecoveryRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedDockerRecoveryRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDockerRecoveryRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedDockerRecoveryRuntimeCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedDockerRecoveryRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDockerRecoveryRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDockerRecoveryRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDockerRecoveryRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDockerRecoveryRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    begin: (
      plan: Readonly<{ operationId: string }>,
      managementCapability: unknown,
    ) => {
      try {
        return beginRecovery(state, plan, managementCapability);
      } catch {
        return null;
      }
    },
    complete: (recoveryCapability: unknown, managementCapability: unknown) => {
      try {
        return completeHostRecovery(
          state,
          recoveryCapability,
          managementCapability,
        );
      } catch {
        return Object.freeze({ status: "blocked" as const });
      }
    },
  });
}

/**
 * 同じRoot・Revision・修復Identityで技術処置と保存を直列化する。
 * @responsibility 準備保存・各checkpoint・join後の最終保存を既存Writerへ渡す。
 * @trace ARCH-000008
 * @input rootCapability: 検証済みRoot、signal: 取消、requestedRecoveryId: 再入場時のexact参照、purpose: 明示修復または明示保持。
 * @returns 保存確認とNative回収確認を分けた局所結果。
 * @precondition 明示修復を許可したCLI組立てから呼ぶ。Repository-local親領域は既存配置。
 * @postcondition 保存拒否後の新処置と返却後の保存通知を拒否する。
 * @effect 修復用途だけ固定DI修復。共通して既存state／history Writerと短命保存物の限定清掃。
 * @failure 不明・競合・失効は停止し、旧保存内容を成功へ補完しない。
 * @invariant 保存JSONからRoot・実行許可・Native生存を復元しない。
 * @boundary 呼出しOwner、状態保存、下位の技術Session。
 * @security 任意Path・Command・OS種別・署名を入力に持たない。
 * @concurrency 短期保存排他は既存Writer、技術排他はDIが所有する。
 */
export async function repairRuntimeOwnedDockerRuntime(
  rootCapability: unknown,
  signal: AbortSignal,
  requestedRecoveryId: string | null = null,
  purpose: "repair" | "retain" = "repair",
) {
  let recoveryId: string | null = requestedRecoveryId;
  let ownerAlive = true;
  let storageFailed = false;
  let prepared = false;
  let preparedCalls = 0;
  let version: StateVersion | null = null;
  let target: RepairOperationRecord | null = null;
  let checkpointSettled = false;
  let disposalSettled = false;
  let operationCleanupConfirmed = false;
  let finalCheckpointConfirmed = false;
  let outcomeConfirmed = false;
  let retentionConfirmed = false;
  let retentionReviewAfter: string | null = null;
  let historyConfirmed = false;
  let historyEffectIssued: boolean | null = false;
  let historyLockReleased: boolean | null = null;
  let completionConfirmed = false;
  let completionEffectIssued: boolean | null = false;
  let completionLockReleased: boolean | null = null;
  let statePublication: ReturnType<typeof resumeRepairRecordSave> | null = null;
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  /**
   * 保存不成立を技術成功と分けて返す。
   * @responsibility exact参照とNative回収事実を保持する。
   * @trace ARCH-000008
   * @input reason: 閉じた停止理由。
   * @returns 保存未確認のblocked結果。
   * @precondition 呼出し内で観測済みの事実だけを使う。
   * @postcondition 最終保存成功を主張しない。
   * @effect N/A: 値の構築のみ。
   * @failure N/A: 新しいI/Oなし。
   * @invariant Native回収成功と保存成功を同一視しない。
   * @boundary 内部呼出しと後続CLI投影。
   * @security 生Path・秘密・実行許可を返さない。
   * @concurrency N/A: 同期構築。
   */
  const stopped = (
    reason = target?.primaryFailure?.reason ??
      (target?.outcome && target.outcome.status !== "recovered"
        ? target.outcome.reason
        : "runtime_repair_state_unavailable"),
  ) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      recoveryId,
      finalCheckpointConfirmed,
      outcomeConfirmed,
      retentionConfirmed,
      retentionReviewAfter,
      historyConfirmed,
      historyEffectIssued,
      historyLockReleased,
      completionConfirmed,
      completionEffectIssued,
      completionLockReleased,
      operationCleanupConfirmed,
      statePublication,
    });
  /**
   * 同じ私有呼出しと現在Repository結合を確認する。
   * @responsibility 取消と保存Owner失効を区別する。
   * @trace ARCH-000008
   * @input N/A: 捕捉済みRoot・Revision・生存・保存状態。
   * @returns 生存する同じOwnerだけtrue。
   * @precondition 呼出し開始時に既存Root Ownerへ借用済み。
   * @postcondition 保存失敗後やfinally後にはfalse。
   * @effect RootとGitの現在観測だけ。
   * @failure 例外と観測不能はfalse。
   * @invariant signal取消だけでは既発生事実の保存資格を失わない。
   * @boundary 呼出しと既存Root Owner。
   * @security 保存値を現在Ownerの代用にしない。
   * @concurrency 同期確認。
   */
  const currentOwner = () => {
    try {
      return ownerAlive && !storageFailed && repository?.revalidate() === true;
    } catch {
      return false;
    }
  };
  /**
   * 修復の論理更新をモデルへ渡して確定結果を受け取る。
   * @responsibility Snapshotを構築せず、保存確認済みの改訂だけを次のCAS元版へ進める。
   * @trace ARCH-000008
   * @input change: 技術観測または保持・廃棄判断に基づく固定更新。
   * @returns 保存確認と排他解放が共同成立した場合だけtrue。
   * @precondition 同exact回復参照と現在Ownerが確定済み。
   * @postcondition 不明保存後のcallback再利用を拒否する。
   * @effect 既存の状態Writerと短期排他。
   * @failure 拒否・不明・例外はsticky停止。
   * @invariant 元版・対象外操作を推測または復元しない。
   * @boundary 保存候補と物理Writer。
   * @security 新Store・Lock・Pathを作らない。
   * @concurrency 元版全文のCASは既存Writerへ委譲する。
   */
  const save = (change: RepairSaveRequest["change"]) => {
    if (!repository || !recoveryId || !currentOwner()) {
      storageFailed = true;
      return false;
    }
    try {
      const result = saveRepairRecord(
        rootCapability,
        recoveryId,
        { expected: version, change },
        currentOwner,
      );
      if (
        result.status !== "completed" ||
        !result.snapshotConfirmed ||
        !result.lockReleased ||
        !result.value
      ) {
        storageFailed = true;
        return false;
      }
      version = result.value.version;
      target = result.value.operation;
      checkpointSettled = result.value.checkpointSettled;
      disposalSettled = result.value.disposalSettled;
      return true;
    } catch {
      storageFailed = true;
      return false;
    }
  };
  /**
   * 技術checkpointだけを対象修復の次版へ結合する。
   * @responsibility 保持物とdispositionの相関を維持する。
   * @trace ARCH-000008
   * @input checkpoint: 同じDIからの技術値。
   * @returns 同じWriterの確認結果。
   * @precondition 初回Identityと準備checkpointを保存済み。
   * @postcondition 他操作・一次失敗・outcomeを変更しない。
   * @effect 対象修復の単調な状態保存だけ。
   * @failure 未準備・失効・不正遷移はfalse。
   * @invariant 技術観測から人間の保持承認を生成しない。
   * @boundary DI通知と上位保存。
   * @security 保存済みflagは技術準備前の許可条件にしない。
   * @concurrency 同期保存通知。
   */
  const checkpoint = (
    value: RepairCheckpoint,
    primaryFailure: RepairOperationRecord["primaryFailure"] = null,
  ) => {
    if (!prepared || !target || !repository) return false;
    return save({
      kind: "checkpoint",
      update: {
        phase: target.phase,
        checkpoint: value,
        disposition:
          value.stale === "retained"
            ? target.disposition === "retained_by_human_decision"
              ? target.disposition
              : "pending_human_decision"
            : "not_applicable",
        primaryFailure: target.primaryFailure ?? primaryFailure,
        outcome: target.outcome,
      },
    });
  };
  /**
   * 元修復を変えず、固定三用途を意図保存と実回収へ直列接続する。
   * @responsibility 不確かな要求窓を保持し、前用途の不明後に処置を広げない。
   * @trace ARCH-000008
   * @input N/A: 同呼出しのexact操作・現在本文・既存Writer。
   * @returns 三用途の保存済み不存在だけを確認し、履歴・完了は確定しない。
   * @precondition 初回技術終了またはexact IDの専用再入場。
   * @postcondition 元checkpoint・outcome・一次失敗・他操作を保全する。
   * @effect 専用用途の既存Writer／ReaderとDIの固定一用途回収。
   * @failure 保存・読戻し・解放・現在Owner・回収不明はそこで停止。
   * @invariant 新Session・Store・Lockを作らず、過去のissued／unknownを変更しない。
   * @boundary Coordinatorの保存OwnerとDIの物理処置。
   * @security callbackの保存確認をWriterのKernel内へ流用しない。
   * @concurrency 各Effect前は既存Readerで同じ保存本文と現在Ownerを再確認する。
   */
  const settleDisposal = async () => {
    if (
      !repository ||
      !target ||
      !version ||
      !recoveryId ||
      !currentOwner() ||
      signal.aborted
    )
      return false;
    if (
      target.phase === "awaiting_disposition" &&
      target.disposition === "pending_human_decision"
    ) {
      if (
        !save({
          kind: "disposal_decision",
          decidedAt: new Date().toISOString(),
        })
      )
        return false;
    }
    if (
      target.phase !== "settling" ||
      target.disposition !== "discard" ||
      !target.disposal ||
      !target.checkpoint ||
      target.outcome?.status !== "recovered" ||
      target.primaryFailure !== null
    )
      return false;
    const identityJson = target.identityJson;
    const identity = JSON.parse(identityJson) as {
      operationNonce: string;
    };
    for (const purpose of ["primary", "failed", "auxiliary"] as const) {
      if (
        !target?.disposal ||
        !target.checkpoint ||
        signal.aborted ||
        !currentOwner()
      )
        return false;
      let item = target.disposal.checkpoint.directories[purpose];
      if (item.absence === "confirmed_absent") continue;
      const freshIntent = item.intent === "not_saved";
      const intent = {
        ...target.disposal.checkpoint,
        directories: {
          ...target.disposal.checkpoint.directories,
          [purpose]: freshIntent
            ? { intent: "saved", request: "not_issued", absence: "unobserved" }
            : item.request === "not_issued"
              ? { intent: "saved", request: "unknown", absence: "unknown" }
              : item,
        },
      };
      if (
        !save({
          kind: "disposal_progress",
          purpose: purpose,
          checkpoint: intent,
        })
      )
        return false;
      if (!target?.disposal || !target.checkpoint || !version) return false;
      const expectedVersion = version;
      const decidedAt = target.disposal.decidedAt;
      item = target.disposal.checkpoint.directories[purpose];
      /**
       * 保存確認と現在の処置許可を、Writer排他の外で共同確認する。
       * @responsibility 同exact操作・判断・用途意図の変更後に処置しない。
       * @trace ARCH-000008
       * @input N/A: 直前確認した本文と同呼出しOwner。
       * @returns 保存済み本文が現在も一致する場合だけtrue。
       * @precondition 専用Writerの保存・読戻し・解放が成立済み。
       * @postcondition current本文や捕捉値を書き換えない。
       * @effect 既存Readerの同期読取りと短期排他。
       * @failure 欠測・差・解放不明・取消ではfalse。
       * @invariant このcallbackをWriterのassertOwnerへ渡さない。
       * @boundary 保存意図とDI Effect。
       * @security 生Path・保存内容を外部へ返さない。
       * @concurrency DIの待機後にも呼ぶ。
       */
      const canDispose = () => {
        if (signal.aborted || !currentOwner()) return false;
        const read = readState(rootCapability, { scope: "recovery" });
        if (
          read.status !== "completed" ||
          !read.lockReleased ||
          !read.value ||
          !currentOwner() ||
          signal.aborted ||
          read.value.snapshot.revision !== expectedVersion.revision ||
          read.value.payloadSha256 !== expectedVersion.payloadSha256
        )
          return false;
        const matches = read.value.snapshot.operations.filter(
          (operation): operation is RepairOperationRecord =>
            operation.kind === "runtime_repair" &&
            operation.recoveryId === recoveryId,
        );
        return (
          matches.length === 1 &&
          matches[0]?.identityJson === identityJson &&
          matches[0].disposition === "discard" &&
          matches[0].disposal?.decidedAt === decidedAt &&
          isDeepStrictEqual(
            snapshotJsonValue(
              matches[0].disposal.checkpoint.directories[purpose],
            ),
            snapshotJsonValue(item),
          )
        );
      };
      if (!canDispose()) return false;
      const result = await cleanupResources(
        {
          kind: "docker_runtime_directory",
          input: {
            operationNonce: identity.operationNonce,
            checkpoint: target.checkpoint,
            purpose,
            signal,
            canIssueEffect: canDispose,
          },
        },
        getIsolationSettings(),
      );
      if (!currentOwner() || !target.disposal) return false;
      const prior = target.disposal.checkpoint.directories[purpose];
      const progress = {
        ...target.disposal.checkpoint,
        directories: {
          ...target.disposal.checkpoint.directories,
          [purpose]: {
            intent: "saved",
            request:
              prior.request === "not_issued" ? result.request : prior.request,
            absence: result.absence,
          },
        },
      };
      if (
        !save({
          kind: "disposal_progress",
          purpose: purpose,
          checkpoint: progress,
        }) ||
        result.absence !== "confirmed_absent"
      )
        return false;
    }
    return target?.disposal !== null && disposalSettled;
  };
  /**
   * 確定済み技術結果の履歴保存を一回依頼し、前後の業務事実を確認する。
   * @responsibility EMが検査済みの事実を保持し、技術処置と履歴確認を分離する。
   * @trace ARCH-000008
   * @input initial: 同呼出しで取得した専用Reader結果、または未取得。
   * @returns 正常な確認済み履歴と保存後条件が揃う場合だけtrue。
   * @precondition exact操作と現在Root／Revisionの保存Ownerが生存する。
   * @postcondition 失敗後の保存・技術再取得を停止し、既保存結果を消さない。
   * @effect 既存の完成履歴保存と前後のfresh読取り。
   * @failure 別対象、Owner失効、保存・読取り・排他不明はsticky停止。
   * @invariant 保存済みoperationIdをNative資格へ変換しない。
   * @boundary 修復compositionとRepository-local履歴保存。
   * @security Task配送・任意Path・任意候補へfallbackしない。
   * @concurrency 既存Kernel排他を使い、待機後も同じ現在Ownerを照合する。
   */
  const settleHistory = (initial?: ReturnType<typeof readState>) => {
    let writing = false;
    const accept = (read: ReturnType<typeof readState>) => {
      historyLockReleased = read.lockReleased;
      const publication = read.currentHistoryPublication;
      const operation = read.value?.snapshot.operations.find(
        (item): item is RepairOperationRecord =>
          item.kind === "runtime_repair" && item.recoveryId === recoveryId,
      );
      if (
        read.status !== "completed" ||
        !read.lockReleased ||
        read.repairHistoryState !== "publication" ||
        !publication ||
        !read.value ||
        !operation ||
        !currentOwner()
      )
        return false;
      if (
        target &&
        (target.identityJson !== operation.identityJson ||
          target.identitySha256 !== operation.identitySha256)
      )
        return false;
      // 同じ版の履歴Readerが要約・終端条件を確認済み。値検査を再実行しない。
      version = {
        revision: read.value.snapshot.revision,
        payloadSha256: read.value.payloadSha256,
      };
      target = operation;
      disposalSettled =
        read.value.operationStates.find(
          (state): state is RepairOperationState =>
            state.kind === "runtime_repair" && state.operation === operation,
        )?.disposalSettled === true;
      retentionConfirmed =
        operation.disposition === "retained_by_human_decision" &&
        operation.retention !== undefined;
      const recordedDeadline = operation.retention?.reviewAfter ?? null;
      if (
        retentionReviewAfter !== null &&
        retentionReviewAfter !== recordedDeadline
      )
        return false;
      retentionReviewAfter = recordedDeadline;
      outcomeConfirmed = true;
      finalCheckpointConfirmed = operation.checkpoint !== null;
      operationCleanupConfirmed =
        operationCleanupConfirmed ||
        operation.checkpoint?.cleanup === "confirmed";

      historyConfirmed = operation.history?.confirmed === true;
      return true;
    };
    const observe = () => {
      historyLockReleased = null;
      return readState(historyRepositoryInput(rootCapability), {
        scope: "recovery",
        input: { kind: "repair_history", recoveryId },
      });
    };
    try {
      if (!repository || !recoveryId || !currentOwner())
        throw new Error("history_owner");
      if (!accept(initial ?? observe())) throw new Error("history_read");
      if (historyConfirmed) return true;
      if (!target) throw new Error("history_target");
      writing = true;
      const saved = saveRecoveryHistory(
        {
          ...repository,
          ...withHistoryRetention(repository, rootCapability),
          operationId: JSON.parse(target.identityJson).operationId,
        },
        recoveryId,
        currentOwner,
        "runtime_repair",
      );
      writing = false;
      historyLockReleased = saved.lockReleased;
      if (saved.filesystemEffectIssued === true) historyEffectIssued = true;
      else if (
        saved.filesystemEffectIssued === null &&
        historyEffectIssued !== true
      )
        historyEffectIssued = null;
      if (
        saved.status !== "completed" ||
        !saved.snapshotConfirmed ||
        !saved.lockReleased ||
        !saved.historyConfirmed ||
        !currentOwner()
      )
        throw new Error("history_save");
      if (!accept(observe()) || !historyConfirmed)
        throw new Error("history_confirm");
      return true;
    } catch {
      if (writing && historyEffectIssued !== true) historyEffectIssued = null;
      if (writing) historyLockReleased = null;
    }
    storageFailed = true;
    return false;
  };
  /**
   * 履歴確認済みで既存completion契約を満たす修復を現在状態から終了整理する。
   * @responsibility 除去保存・履歴照合・fresh不存在の共同成立を確認する。
   * @trace ARCH-000008
   * @input initial: exact終了前置Readerの任意の確認済み結果。
   * @returns 全終了条件を確認できた場合だけtrue。
   * @precondition 現在保存Ownerが有効で、検証済みreceipt付き保持を含む既存completion契約を満たす。
   * @postcondition 失敗後に技術処置や履歴保存へ戻らない。
   * @effect 既存completion Writerとfresh読取り。
   * @failure Reader・Writer・清掃・解放・Owner不明はsticky停止。
   * @invariant 履歴からNative回収やcheckpoint詳細を復元しない。
   * @boundary 修復compositionと既存現在状態の終了保存。
   * @security 新Store・Lock・任意Path・Docker要求なし。
   * @concurrency 各境界後に同じ現在Ownerを確認する。
   */
  const settleCompletion = (initial?: ReturnType<typeof readState>) => {
    let writing = false;
    try {
      if (!recoveryId || !currentOwner()) throw new Error("completion_owner");
      completionLockReleased = null;
      const observed =
        initial ??
        readState(rootCapability, {
          scope: "recovery",
          input: {
            kind: "repair_completion",
            recoveryId: recoveryId,
          },
        });
      completionLockReleased = observed.lockReleased;
      if (
        observed.status !== "completed" ||
        !observed.lockReleased ||
        (retentionReviewAfter !== null &&
          observed.repairRetentionReviewAfter !== retentionReviewAfter) ||
        (purpose === "retain" &&
          observed.repairRetentionReviewAfter === null) ||
        !currentOwner()
      )
        throw new Error("completion_read");
      retentionReviewAfter = observed.repairRetentionReviewAfter;
      retentionConfirmed = retentionReviewAfter !== null;
      if (!observed.repairCompletionAbsent) {
        const operation = observed.value?.snapshot.operations.find(
          (item): item is RepairOperationRecord =>
            item.kind === "runtime_repair" && item.recoveryId === recoveryId,
        );
        if (
          !observed.currentCompletionPublication ||
          !operation ||
          !(
            operation.disposition === "not_applicable" ||
            (operation.disposition === "discard" &&
              observed.value?.operationStates.find(
                (state): state is RepairOperationState =>
                  state.kind === "runtime_repair" &&
                  state.operation === operation,
              )?.disposalSettled === true) ||
            (operation.disposition === "retained_by_human_decision" &&
              operation.retention?.reviewAfter === retentionReviewAfter)
          ) ||
          (target && target.identityJson !== operation.identityJson)
        )
          throw new Error("completion_target");
        // 現在操作が読める場合だけ、既確定結果の個別事実を投影する。
        outcomeConfirmed = true;
        finalCheckpointConfirmed = true;
        operationCleanupConfirmed = true;
        historyConfirmed = true;
        writing = true;
        completionLockReleased = null;
        const saved = completeRecovery(
          rootCapability,
          recoveryId,
          currentOwner,
          "runtime_repair",
        );
        writing = false;
        completionLockReleased = saved.lockReleased;
        if (saved.filesystemEffectIssued) completionEffectIssued = true;
        if (
          saved.status !== "completed" ||
          !saved.snapshotConfirmed ||
          !saved.lockReleased ||
          !currentOwner()
        )
          throw new Error("completion_save");
      }
      completionLockReleased = null;
      const fresh = readState(rootCapability, {
        scope: "recovery",
        input: {
          kind: "repair_completion",
          recoveryId: recoveryId,
        },
      });
      completionLockReleased = fresh.lockReleased;
      if (
        fresh.status !== "completed" ||
        !fresh.lockReleased ||
        !fresh.repairCompletionAbsent ||
        fresh.repairRetentionReviewAfter !== retentionReviewAfter ||
        !currentOwner()
      )
        throw new Error("completion_fresh");
      historyConfirmed = true;
      completionConfirmed = true;
      return true;
    } catch {
      if (writing && completionEffectIssued !== true)
        completionEffectIssued = null;
      storageFailed = true;
      return false;
    }
  };
  try {
    if (
      (purpose !== "repair" && purpose !== "retain") ||
      (purpose === "retain" && requestedRecoveryId === null)
    )
      return stopped("runtime_repair_boundary_unavailable");
    if (!repository || !currentOwner())
      return stopped("runtime_repair_boundary_unavailable");
    const verified = getRepository(repository.repositoryRoot);
    if (verified.status !== "completed" || !currentOwner())
      return stopped("runtime_repair_boundary_unavailable");
    const area = observeRepositoryExecutionDataArea(
      verified.capability,
      "domain-model",
    );
    if (area.status === "ready") {
      if (!currentOwner()) return stopped();
      if (requestedRecoveryId !== null) {
        {
          const completion = readState(rootCapability, {
            scope: "recovery",
            input: {
              kind: "repair_completion",
              recoveryId: requestedRecoveryId,
            },
          });
          completionLockReleased = completion.lockReleased;
          if (!completion.lockReleased || !currentOwner()) return stopped();
          if (
            completion.status === "completed" &&
            (completion.currentCompletionPublication ||
              completion.repairCompletionAbsent)
          ) {
            if (
              purpose === "retain" &&
              completion.repairRetentionReviewAfter === null
            )
              return stopped();
            if (!settleCompletion(completion)) return stopped();
            return Object.freeze({
              ...stopped(),
              status: "observed" as const,
              reason: "runtime_repair_recovered",
              technicalStatus: null,
            });
          }
          {
            let history = readState(historyRepositoryInput(rootCapability), {
              scope: "recovery",
              input: {
                kind: "repair_history",
                recoveryId: requestedRecoveryId,
              },
            });
            historyLockReleased = history.lockReleased;
            if (!history.lockReleased || !currentOwner()) return stopped();
            if (history.status !== "completed") {
              // 技術fallbackではなく、既存の有限metadata出版だけを一度試す。
              statePublication = resumeRepairRecordSave(
                historyRepositoryInput(rootCapability),
                requestedRecoveryId,
                currentOwner,
              );
              if (
                statePublication.status !== "completed" ||
                !statePublication.snapshotConfirmed ||
                !statePublication.lockReleased ||
                !currentOwner()
              )
                return stopped();
              history = readState(historyRepositoryInput(rootCapability), {
                scope: "recovery",
                input: {
                  kind: "repair_history",
                  recoveryId: requestedRecoveryId,
                },
              });
              historyLockReleased = history.lockReleased;
              if (
                history.status !== "completed" ||
                !history.lockReleased ||
                !currentOwner()
              )
                return stopped();
            }
            if (history.repairHistoryState === "publication") {
              if (purpose === "retain") {
                const retained = history.value?.snapshot.operations.find(
                  (operation) =>
                    operation.kind === "runtime_repair" &&
                    operation.recoveryId === requestedRecoveryId,
                );
                if (
                  retained?.kind !== "runtime_repair" ||
                  retained.retention === undefined
                )
                  return stopped();
                retentionReviewAfter = retained.retention.reviewAfter;
              }
              if (!settleHistory(history)) return stopped();
              const recorded = target as RepairOperationRecord | null;
              if (
                recorded?.outcome?.status === "recovered" &&
                (recorded.disposition === "not_applicable" ||
                  recorded.disposition === "discard" ||
                  recorded.retention !== undefined) &&
                !settleCompletion()
              )
                return stopped();
              return Object.freeze({
                ...stopped(),
                status: "observed" as const,
                reason:
                  recorded?.outcome?.reason ??
                  "runtime_repair_state_unavailable",
                technicalStatus: null,
              });
            }
            if (history.repairHistoryState !== "technical_state")
              return stopped();
          }
        }
        if (statePublication === null)
          statePublication = resumeRepairRecordSave(
            historyRepositoryInput(rootCapability),
            requestedRecoveryId,
            currentOwner,
          );
        if (
          (statePublication.status !== "completed" &&
            statePublication.status !== "no_pending") ||
          !statePublication.lockReleased ||
          (statePublication.status === "completed" &&
            !statePublication.snapshotConfirmed) ||
          !currentOwner()
        )
          return stopped();
      }
      const read = readState(rootCapability, {
        scope: "recovery",
        input: { kind: "history" },
      });
      if (
        read.status !== "completed" ||
        !read.lockReleased ||
        !read.value ||
        !currentOwner()
      )
        return stopped();
      version = {
        revision: read.value.snapshot.revision,
        payloadSha256: read.value.payloadSha256,
      };
      const repairs = read.value.snapshot.operations.filter(
        (item): item is RepairOperationRecord => item.kind === "runtime_repair",
      );
      if (requestedRecoveryId !== null) {
        target =
          repairs.find((item) => item.recoveryId === requestedRecoveryId) ??
          null;
        disposalSettled =
          read.value.operationStates.find(
            (state): state is RepairOperationState =>
              state.kind === "runtime_repair" && state.operation === target,
          )?.disposalSettled === true;
        if (purpose === "retain") {
          if (!target || !currentOwner()) return stopped();
          if (target.retention === undefined) {
            if (
              target.phase !== "awaiting_disposition" ||
              target.disposition !== "pending_human_decision" ||
              !target.checkpoint ||
              signal.aborted
            )
              return stopped();
            const identity = JSON.parse(target.identityJson);
            const targets = inspectResources(
              {
                kind: "docker_runtime_directory",
                input: {
                  operationNonce: identity.operationNonce,
                  checkpoint: target.checkpoint,
                  signal,
                  canObserve: currentOwner,
                },
              },
              getIsolationSettings(),
            );
            if (!targets || signal.aborted || !currentOwner()) return stopped();
            const decidedAt = new Date().toISOString();
            const reviewAfter = new Date(
              Date.parse(decidedAt) + 604800000,
            ).toISOString();
            if (
              !save({
                kind: "retention_handoff",
                receipt: { decidedAt, reviewAfter, targets },
              })
            )
              return stopped();
          }
          if (
            !target.retention ||
            target.disposition !== "retained_by_human_decision"
          )
            return stopped();
          retentionReviewAfter = target.retention.reviewAfter;
          retentionConfirmed = true;
          outcomeConfirmed = true;
          finalCheckpointConfirmed = true;
          operationCleanupConfirmed = true;
          if (!settleHistory() || !settleCompletion()) return stopped();
          return Object.freeze({
            ...stopped(),
            status: "observed" as const,
            reason: "runtime_repair_recovered" as const,
            technicalStatus: null,
          });
        }
        if (
          target?.outcome?.status === "recovered" &&
          (target.disposition === "discard" ||
            target.disposition === "pending_human_decision")
        ) {
          outcomeConfirmed = true;
          finalCheckpointConfirmed = target.checkpoint !== null;
          operationCleanupConfirmed =
            target.checkpoint?.cleanup === "confirmed";
          if (
            !(await settleDisposal()) ||
            !settleHistory() ||
            !settleCompletion()
          )
            return stopped();
          return Object.freeze({
            ...stopped(),
            status: "observed" as const,
            reason: target.outcome.reason,
            technicalStatus: null,
          });
        }
        if (target?.phase !== "repairing" || target.outcome !== null) {
          if (target?.outcome) {
            outcomeConfirmed = true;
            finalCheckpointConfirmed = target.checkpoint !== null;
            operationCleanupConfirmed =
              target.checkpoint?.cleanup === "confirmed";
            if (
              settleHistory() &&
              (target.outcome.status !== "recovered" ||
                (target.disposition !== "not_applicable" &&
                  target.disposition !== "discard" &&
                  target.retention === undefined) ||
                settleCompletion())
            )
              return Object.freeze({
                ...stopped(),
                status: "observed" as const,
                reason: target.outcome.reason,
                technicalStatus: null,
              });
          }
          return stopped();
        }
        if (target.primaryFailure !== null) {
          const savedFailure = target.primaryFailure;
          const savedCheckpoint = target.checkpoint;
          if (
            savedFailure.stage !== "repair" ||
            savedFailure.reason !== "runtime_repair_effect_unknown" ||
            !savedCheckpoint ||
            !["confirmed", "unknown"].includes(savedCheckpoint.cleanup) ||
            repairs.filter((item) => item.recoveryId === requestedRecoveryId)
              .length !== 1 ||
            repairs.some(
              (item) => item !== target && item.phase !== "terminal",
            ) ||
            read.value.snapshot.unresolvedRecoveries.some(
              (item) => item.recoveryId === requestedRecoveryId,
            )
          )
            return stopped();
          // 記録の確定だけであり、新しいNative／Docker処置を開始しない。
          operationCleanupConfirmed = savedCheckpoint.cleanup === "confirmed";
          finalCheckpointConfirmed = true;
          if (
            !save({
              kind: "checkpoint",
              update: {
                phase: "settling",
                checkpoint: savedCheckpoint,
                disposition: target.disposition,
                primaryFailure: savedFailure,
                outcome: {
                  status: "blocked",
                  reason: savedFailure.reason,
                  cleanupConfirmed: operationCleanupConfirmed,
                },
              },
            })
          )
            return stopped();
          outcomeConfirmed = true;
          if (
            target.disposition !== "pending_human_decision" &&
            !settleHistory()
          )
            return stopped();
          return Object.freeze({
            status: "observed" as const,
            reason: savedFailure.reason,
            recoveryId,
            finalCheckpointConfirmed: true,
            outcomeConfirmed: true,
            retentionConfirmed,
            retentionReviewAfter,
            historyConfirmed,
            historyEffectIssued,
            historyLockReleased,
            operationCleanupConfirmed,
            completionConfirmed,
            completionEffectIssued,
            completionLockReleased,
            statePublication,
            technicalStatus: null,
          });
        }
      } else if (repairs.some((item) => item.phase !== "terminal"))
        return stopped();
    } else if (
      area.status !== "not_observed" ||
      requestedRecoveryId !== null ||
      !currentOwner()
    )
      return stopped();
    if (signal.aborted) return stopped("runtime_repair_boundary_unavailable");
    const previousIdentity =
      target === null
        ? null
        : (JSON.parse(target.identityJson) as {
            operationNonce: string;
            operationId: string;
          });
    const nonce =
      previousIdentity?.operationNonce ?? randomBytes(32).toString("hex");
    const operationId =
      previousIdentity?.operationId ??
      `OP-${BigInt(`0x${randomUUID().replaceAll("-", "")}`)
        .toString(10)
        .padStart(6, "0")}`;
    const result = await restartDockerEnvironment(
      {
        mode: "repair",
        input: {
          operationNonce: nonce,
          signal,
          resume: target?.checkpoint ?? null,
          canIssueEffect: () => !signal.aborted && currentOwner(),
          onPrepared: (value) => {
            preparedCalls++;
            if (preparedCalls !== 1 || !currentOwner() || signal.aborted)
              throw new Error("docker_repair_record_unconfirmed");
            if (target === null) {
              const identityJson = `${JSON.stringify({ schema: "crdd-coordinator/runtime-repair-identity/v2", kind: "runtime_repair", operationNonce: nonce, operationId, repositoryBinding: repository.repositoryBinding, consumer: "coordinator_cli" })}\n`;
              recoveryId = `docker-runtime-repair.${nonce}.${createHash("sha256").update(identityJson).digest("hex")}`;
              if (!save({ kind: "create", identityJson: identityJson }))
                throw new Error("docker_repair_record_unconfirmed");
            }
            if (!target) throw new Error("docker_repair_record_unconfirmed");
            if (target.checkpoint !== null) {
              if (!save({ kind: "session_begin", checkpoint: value }))
                throw new Error("docker_repair_record_unconfirmed");
            } else {
              prepared = true;
              if (!checkpoint(value)) {
                prepared = false;
                throw new Error("docker_repair_record_unconfirmed");
              }
            }
            prepared = true;
            return;
          },
          onCheckpoint: (value) => {
            if (!checkpoint(value))
              throw new Error("docker_repair_record_unconfirmed");
          },
        },
      },
      getIsolationSettings(),
    );
    operationCleanupConfirmed = result.lifecycle?.cleanupConfirmed === true;
    const primaryFailure = result.machine?.primaryFailure
      ? { stage: "repair" as const, reason: result.machine.primaryFailure }
      : null;
    if (
      !prepared ||
      !result.checkpoint ||
      !checkpoint(result.checkpoint, primaryFailure) ||
      !target ||
      !currentOwner()
    )
      return stopped();
    finalCheckpointConfirmed = true;
    const technical = result.machine;
    const lifecycle = result.lifecycle;
    const clean =
      result.checkpoint.cleanup === "confirmed" &&
      result.checkpoint.cleanupFailure === null &&
      lifecycle?.cleanupConfirmed === true;
    const complete =
      technical?.status === "recovered" &&
      result.checkpoint.engine === "ready" &&
      result.checkpoint.hostSafety === "safe" &&
      result.checkpoint.stale !== "unknown" &&
      checkpointSettled;
    let outcome: RepairOperationRecord["outcome"] = null;
    if (technical?.status === "recovered") {
      outcome =
        complete &&
        clean &&
        (lifecycle?.failure === null || lifecycle?.failure === "cancelled")
          ? {
              status: "recovered",
              reason: "runtime_repair_recovered",
              cleanupConfirmed: true,
            }
          : {
              status: "blocked",
              reason:
                lifecycle?.failure && lifecycle.failure !== "cancelled"
                  ? "runtime_repair_boundary_unavailable"
                  : !clean
                    ? "runtime_repair_cleanup_unknown"
                    : "runtime_repair_failed_closed",
              cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
            };
    } else if (technical?.primaryFailure) {
      outcome = {
        status: "blocked",
        reason: technical.primaryFailure,
        cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
      };
    } else if (lifecycle?.failure === "cancelled") {
      outcome = {
        status: "cancelled",
        reason: "runtime_repair_cancelled",
        cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
      };
    } else if (lifecycle?.failure) {
      outcome = {
        status: "blocked",
        reason: "runtime_repair_boundary_unavailable",
        cleanupConfirmed: result.checkpoint.cleanup === "confirmed",
      };
    }
    if (
      outcome !== null &&
      !save({
        kind: "checkpoint",
        update: {
          phase:
            outcome.status === "recovered" &&
            target.disposition === "pending_human_decision"
              ? "awaiting_disposition"
              : "settling",
          checkpoint: target.checkpoint,
          disposition: target.disposition,
          primaryFailure: target.primaryFailure,
          outcome,
        },
      })
    )
      return stopped();
    outcomeConfirmed = outcome !== null;
    if (
      outcome?.status === "recovered" &&
      target.disposition === "pending_human_decision"
    ) {
      if (!(await settleDisposal()) || !settleHistory() || !settleCompletion())
        return stopped();
      return Object.freeze({
        ...stopped(),
        status: "observed" as const,
        reason: outcome.reason,
        technicalStatus: result.machine?.status ?? null,
      });
    }
    if (
      outcome !== null &&
      target.disposition !== "pending_human_decision" &&
      !settleHistory()
    )
      return stopped();
    if (
      outcome?.status === "recovered" &&
      (target.disposition === "not_applicable" ||
        target.disposition === "discard") &&
      !settleCompletion()
    )
      return stopped();
    return Object.freeze({
      status: "observed" as const,
      reason:
        outcome?.reason ??
        result.machine?.reason ??
        "runtime_repair_boundary_unavailable",
      recoveryId,
      finalCheckpointConfirmed: true,
      outcomeConfirmed,
      retentionConfirmed,
      retentionReviewAfter,
      historyConfirmed,
      historyEffectIssued,
      historyLockReleased,
      completionConfirmed,
      completionEffectIssued,
      completionLockReleased,
      operationCleanupConfirmed,
      statePublication,
      technicalStatus: result.machine?.status ?? null,
    });
  } catch {
    return stopped();
  } finally {
    ownerAlive = false;
  }
}

/**
 * exact回復対象の一要求だけを下位の公開固定操作へ渡す。
 * @responsibility 要求前の保存と受付・終端保存を、同じ準備Ownerへ結合する。
 * @trace ARCH-000008
 * @input recoveryId: exact参照、signal: 取消、rootCapability: 検証済み現在Repository。
 * @returns 再起動技術結果、保存・配送と外側排他解放の個別評価。
 * @precondition 呼出し元は人間が承認した同じ回復対象とRepositoryを固定する。
 * @postcondition 元Taskの再実行・復旧完了を主張しない。
 * @effect 現在状態保存とDI固定再起動への一回委譲、取得済み排他の解放。
 * @failure 一次失敗・保存不明・下位cleanupと外側排他解放を区別する。
 * @invariant 過去unknownを未発行へ戻さず、旧phase・署名chainから再発行しない。
 * @boundary 現在許可・保存OwnerとDI公開操作。
 * @security 生Session・Machine・argv・OS指定・保存Pathを下位へ渡さない。
 * @concurrency 同期の保存確認と通知だけを渡し、下位終端後に外側排他を解放する。
 */
export async function restartRuntimeOwnedDockerForRecovery(
  recoveryId: unknown,
  signal: AbortSignal,
  rootCapability: unknown,
) {
  if (signal.aborted)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_restart_cancelled",
      primaryFailure: "docker_restart_cancelled",
      stopFailure: null,
      startFailure: null,
      cleanupFailure: null,
      cleanupConfirmed: true,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  const preparation = prepareRuntimeOwnedDockerRestart(
    recoveryId,
    rootCapability,
  );
  if (preparation.status !== "prepared")
    return Object.freeze({
      ...preparation,
      stopFailure: null,
      startFailure: null,
      restartCompleted: false,
      taskRecoveryCompleted: false,
    });
  const context = preparation.capability;
  let lockCleanupConfirmed = false;
  let result: DockerEnvironmentResult<"restart"> | null = null;
  let failure: string | null = null;
  let checkpointInitialized = preparation.checkpointInitialized;
  let checkpoint: RestartCheckpoint = Object.freeze({
    requestId: preparation.requestId,
    scopeSha256: preparation.scopeSha256,
    request: "not_issued",
    cleanup: "not_required",
    result: null,
  });
  /**
   * 同じOwnerから同じ一要求の次値だけを保存する。
   * @responsibility 保存不明後の追加Effectと別要求への書換えを拒否する。
   * @trace ARCH-000008
   * @input value: 同要求の固定checkpoint。
   * @returns 保存・読戻し・排他解放の全確認だけtrue。
   * @precondition 同期callback内の同じ準備Ownerを使用する。
   * @postcondition 成功した元値だけを操作内へ保持する。
   * @effect 現在状態の対象再起動欄だけ。
   * @failure false・throw・Owner失効は固定保存不明。
   * @invariant 下位not_issuedから耐久unknownを巻き戻さない。
   * @boundary 下位通知と上位の現在保存。
   * @security 任意本文・Path・新Authorityを受け取らない。
   * @concurrency callback内で同期確定し、保存Lockを解放して戻る。
   */
  const save = (value: RestartCheckpoint) => {
    if (
      !verifyRuntimeOwnedDockerRestartPreparation(context) ||
      !persistRuntimeOwnedDockerRestartCheckpoint(context, value)
    ) {
      failure = "docker_restart_record_unconfirmed";
      return false;
    }
    checkpoint = value;
    checkpointInitialized = true;
    return true;
  };
  try {
    if (preparation.alreadyRequested) {
      failure = "docker_restart_existing_attempt_requires_recovery";
    } else {
      result = await restartDockerEnvironment(
        {
          mode: "restart",
          input: {
            requestId: preparation.requestId,
            signal,
            verifyBoundary: () =>
              failure === null &&
              verifyRuntimeOwnedDockerRestartPreparation(context),
            onRequesting: () => {
              if (!preparation.checkpointInitialized && !save(checkpoint))
                throw new Error("docker_restart_record_unconfirmed");
              if (
                !save(
                  Object.freeze({
                    ...checkpoint,
                    request: "unknown",
                    cleanup: "pending",
                  }),
                )
              )
                throw new Error("docker_restart_record_unconfirmed");
            },
            onEvent: (event: DockerEnvironmentRestartEvent) => {
              if (event.event === "settled" && !checkpointInitialized) return;
              const saved =
                event.event === "request_accepted"
                  ? save(
                      Object.freeze({
                        ...checkpoint,
                        request: "issued",
                        cleanup: "pending",
                      }),
                    )
                  : save(
                      Object.freeze({
                        ...checkpoint,
                        request:
                          event.observation.request === "not_issued"
                            ? checkpoint.request
                            : event.observation.request,
                        cleanup:
                          checkpoint.request === "not_issued"
                            ? "not_required"
                            : "pending",
                        result: null,
                      }),
                    );
              if (!saved) throw new Error("docker_restart_record_unconfirmed");
            },
          },
        },
        getIsolationSettings(),
      );
    }
  } catch {
    failure ??= "docker_restart_execution_unconfirmed";
  } finally {
    try {
      lockCleanupConfirmed =
        releaseRuntimeOwnedDockerRestartPreparation(context);
    } catch {
      lockCleanupConfirmed = false;
    }
  }
  const finalized =
    result && checkpointInitialized
      ? finalizeRuntimeOwnedDockerRestartPreparation(context, result)
      : null;
  if (
    finalized &&
    (finalized.status !== "completed" ||
      !finalized.snapshotConfirmed ||
      !finalized.lockReleased)
  )
    failure ??= "docker_restart_record_unconfirmed";
  const cleanupConfirmed =
    (result?.cleanupConfirmed ?? true) && lockCleanupConfirmed;
  const primaryFailure = result?.primaryFailure ?? failure;
  const cleanupFailure = cleanupConfirmed
    ? null
    : ("docker_restart_cleanup_unconfirmed" as const);
  const completed =
    result?.status === "completed" &&
    result.restartCompleted &&
    result.primaryFailure === null &&
    result.delivery !== "unknown" &&
    failure === null &&
    cleanupConfirmed;
  return Object.freeze({
    ...(result ?? {}),
    status: completed ? ("completed" as const) : ("blocked" as const),
    reason:
      cleanupFailure ??
      failure ??
      result?.reason ??
      "docker_restart_execution_unconfirmed",
    primaryFailure,
    stopFailure: result?.stopFailure ?? null,
    startFailure: result?.startFailure ?? null,
    cleanupFailure,
    cleanupConfirmed,
    restartCompleted: completed,
    taskRecoveryCompleted: false,
    recoveryRequired: !completed,
    recoveryId: preparation.recoveryId,
  });
}

/**
 * execution-portで使用するCoordinator Single Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Coordinator Single Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

/**
 * 修復Ownerの観測を公開可能な結果だけへ縮約する。
 * @responsibility CLIで行っていた固定field投影を共通操作へ移す。
 * @trace ARCH-000008
 * @input result: 既存修復Ownerの結果、expectedRecoveryId: exact再入場又は新規null。
 * @returns 状態・元参照・保存／回収／保持の確認値だけ。
 * @precondition 入力は同じProcessの既存Ownerが生成した値。
 * @postcondition 内部publication・marker・checkpointを含めない。
 * @effect N/A: 結果の縮約だけ。
 * @failure exact参照不一致は元参照だけを保持し、全確認値falseの固定拒否へ閉じる。
 * @invariant 別操作の成立を要求元の修復成功へ転用しない。
 * @boundary 内部修復結果と正式API／CLI。
 * @security Host Path・内部権限・保存本文を公開しない。
 * @concurrency 同期の値投影。
 */
export function projectRuntimeRepairObservation(
  result: Awaited<ReturnType<typeof repairRuntimeOwnedDockerRuntime>>,
  expectedRecoveryId: string | null,
) {
  if (expectedRecoveryId !== null && result.recoveryId !== expectedRecoveryId)
    return Object.freeze({
      status: "blocked" as const,
      reason: "runtime_repair_boundary_unavailable" as const,
      recoveryId: expectedRecoveryId,
      finalCheckpointConfirmed: false,
      outcomeConfirmed: false,
      retentionConfirmed: false,
      retentionReviewAfter: null,
      historyConfirmed: false,
      completionConfirmed: false,
      operationCleanupConfirmed: false,
    });
  return Object.freeze({
    status: result.status,
    reason: result.reason,
    recoveryId: result.recoveryId,
    finalCheckpointConfirmed: result.finalCheckpointConfirmed,
    outcomeConfirmed: result.outcomeConfirmed,
    retentionConfirmed: result.retentionConfirmed,
    retentionReviewAfter: result.retentionReviewAfter,
    historyConfirmed: result.historyConfirmed,
    completionConfirmed: result.completionConfirmed,
    operationCleanupConfirmed: result.operationCleanupConfirmed,
  });
}

/**
 * Executorが完了した技術的な終了を元Taskの記録へ反映する。
 * @responsibility 実Home解放を再実行せず、結果保存・Host記録・Lifecycle保存だけを行う。
 * @trace ARCH-000008
 * @input 元操作・回復参照、資源観測、Grant借用終了結果とHome実解放結果。
 * @returns 技術的な終了事実と耐久確定を区別した保存結果。
 * @precondition 技術的な解放はExecutorが先に試行している。
 * @postcondition 保存拒否でも受領済みの実解放事実を取り消さない。
 * @effect 既存recordへの観測結合と、Domain／Host記録の保存。
 * @failure 保存拒否ではTaskを成功にせず、exact回復参照を保持する。
 * @invariant Handleのrelease・Docker操作を呼ばない。
 * @boundary Executorの技術生涯とCoordinatorの保存・Task進行。
 */
export function recordRuntimeOwnedAttemptCleanup(
  input: AttemptCleanupInput & Readonly<{ plan: RecoveryPlan }>,
): ResourceCleanupResult {
  const {
    plan,
    recoveryCapability,
    managementCapability,
    recoveryId,
    observations,
    mountCompletion,
    mountLeaseReleased,
    homeLeaseReleased,
  } = input;
  let recoveryCompleted = false;
  let recoveryFinalizationCapability: object | null = null;
  const record = durableRecord(recoveryCapability, false);
  if (
    !record ||
    record.managementCapability !== managementCapability ||
    record.operationId !== plan.operationId ||
    record.recoveryId !== recoveryId
  )
    return Object.freeze({
      mountLeaseReleased,
      homeLeaseReleased,
      recoveryCompleted,
      recoveryFinalizationCapability,
    });
  if (homeLeaseReleased) {
    record.homeLeaseReleased = true;
    if (!record.initializationReady)
      record.initializationLeaseReleaseConfirmed = true;
  }
  try {
    if (
      recordRuntimeOwnedDockerAbsence(recoveryCapability, {
        snapshot: input.resourceSnapshot,
        observations,
      }) !== true
    )
      throw new Error("docker_absence_record_failed");
    if (mountLeaseReleased && mountCompletion) {
      if (
        recordRuntimeOwnedNormalMountCompletion(
          recoveryCapability,
          mountCompletion,
        ) !== true
      )
        throw new Error("mount_completion_record_failed");
      const completion = completeRuntimeOwnedDockerRecovery(
        recoveryCapability,
        managementCapability,
        Object.freeze({ plan, mountCompletion }),
      );
      if (
        homeLeaseReleased &&
        completion.status === "completed" &&
        completion.recoveryFinalizationCapability &&
        typeof completion.recoveryFinalizationCapability === "object"
      ) {
        recoveryCompleted = true;
        recoveryFinalizationCapability =
          completion.recoveryFinalizationCapability;
      }
    }
  } catch {
    recoveryCompleted = false;
    recoveryFinalizationCapability = null;
  }
  return Object.freeze({
    mountLeaseReleased,
    homeLeaseReleased,
    recoveryCompleted,
    recoveryFinalizationCapability,
  });
}
