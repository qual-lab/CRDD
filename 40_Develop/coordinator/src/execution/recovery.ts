/**
 * Taskの回復状態・元版・排他・受領と終了を管理する。
 *
 * @responsibility 現在状態の保存とHost／Home相関を所有し、技術観測と回収はDIへ委譲する。
 * @trace ARCH-000008
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { isDeepStrictEqual, types } from "node:util";
import type {
  IsolationCallbacks,
  IsolationExecution,
} from "../../../docker-isolation/src/index.ts";
import {
  completeOperation,
  completeRecovery,
  type ExecutionOperationRecord,
  type ExecutionSelection,
  type ExecutionStateSnapshot,
  inspectExecutionSelection,
  type OperationRecord,
  parseDockerTaskRecoveryId,
  type RepairCheckpoint,
  type RepairOperationRecord,
  type RepairSaveRequest,
  type RestartCheckpoint,
  readState,
  resumeRepairRecordSave,
  type StateVersion,
  saveRecoveryCheckpoint,
  saveRecoveryHistory,
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
  saveOperationCheckpoint,
  saveOperationStart,
  saveResourceNotIssuedStage,
} from "../execution/persistence.ts";
import { snapshotJsonValue, snapshotPlainRecord } from "../input/snapshot.ts";
import {
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
  providerHomesDirectoryCandidate,
  readExecutionCancellation,
  runtimeStateDirectoryCandidate,
} from "./authority.ts";
import { getIsolationSettings } from "./configuration.ts";
import { recoverDockerIsolationProbe } from "./diagnostics.ts";
import {
  acquireExecutionStateLock,
  acquireHostOperationLock,
  acquireProviderHomeLock,
} from "./kernel-lock.ts";
import {
  acquireHostOperationRecoveryGeneration,
  borrowHostRecoveryManagementDirectory,
  readOwnedHostOperation,
  readHostRecoveryOperation,
  borrowRuntimeOwnedCoordinatorRecoveryRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
  observeHostRecoveryRoot,
  isHostOperationRootAbsent,
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

/**
 * 現在の回復記録を非秘密の保存観測へ投影する。
 * @responsibility 保存時点の状態だけを選び、実資源の現在性を推測しない。
 * @trace ARCH-000008
 * @input 既存Readerが検査した操作記録。
 * @returns Path・Identity本文を含まない保存観測。
 * @effect 外部Effectなし。
 * @security 資源ID、Mount、環境値、内部Hashを公開しない。
 */
function projectRecoveryRecord(
  operation: OperationRecord,
  operations: readonly OperationRecord[],
) {
  if (operation.kind === "host_operation")
    return Object.freeze({
      kind: operation.kind,
      phase: operation.phase,
      hostCleanup: operation.cleanup,
      outcome: null,
      historyConfirmed: null,
      resources:
        operation.resources === null
          ? null
          : Object.freeze(
              operation.resources.checkpoints.map((item) =>
                Object.freeze({
                  key: item.key,
                  submission: item.submission,
                  observation: item.observation,
                }),
              ),
            ),
    });
  const common = {
    phase: operation.phase,
    outcome:
      operation.outcome === null
        ? null
        : Object.freeze({
            status: operation.outcome.status,
            cleanupConfirmed: operation.outcome.cleanupConfirmed,
          }),
    historyConfirmed: operation.history?.confirmed ?? null,
  };
  if (operation.kind === "runtime_repair")
    return Object.freeze({
      ...common,
      kind: operation.kind,
      disposition: operation.disposition,
      resources: null,
    });
  return Object.freeze({
    ...common,
    kind: operation.kind,
    lease: operation.lease,
    hostCleanup:
      operations.find(
        (r): r is Extract<OperationRecord, { kind: "host_operation" }> =>
          r.kind === "host_operation" &&
          r.operationId === JSON.parse(operation.identityJson).operationId,
      )?.cleanup ?? "unknown",
    resources:
      operation.resources === null
        ? null
        : Object.freeze(
            operation.resources.checkpoints.map((item) =>
              Object.freeze({
                key: item.key,
                submission: item.submission,
                observation: item.observation,
              }),
            ),
          ),
  });
}

/**
 * 元の回復参照に一致する現在の保存記録だけを照会する。
 * @responsibility 不一致、観測不能、保存時点の観測を分離する。
 * @trace ARCH-000008
 * @input exact回復ID、現在RepositoryのCapability、取消Signal。
 * @returns recorded／not_recorded／unknown。Docker資源の現在状態は観測しない。
 * @precondition 信頼した入口が現在Repositoryの読取りを許可している。
 * @postcondition 照会から回復・再起動・初期化・清掃を発行しない。
 * @effect 既存Readerの短期Lockと、Probeの元記録の読取りだけ。
 * @failure 不正ID、破損、途中保存、解放不明、取消は固定理由で停止する。
 * @invariant not_recordedを資源不存在又は再実行許可へ読み替えない。
 * @boundary 保存正本と公開照会。
 * @security 記録全体、Path、資格情報、生例外を返さない。
 * @concurrency 同じReader断面で相関し、Lock解放確認後だけ記録を公開する。
 */
export function readRuntimeOwnedRecovery(
  recoveryId: string,
  rootCapability: unknown,
  signal: AbortSignal,
) {
  const result = (
    observationState: "recorded" | "not_recorded" | "unknown",
    reason: string,
    lockReleased: boolean,
    record: ReturnType<typeof projectRecoveryRecord> | null = null,
  ) =>
    Object.freeze({
      contract: "crdd-coordinator/recovery-observation/v1" as const,
      status:
        observationState === "unknown"
          ? ("blocked" as const)
          : ("completed" as const),
      reason,
      recoveryId,
      observationState,
      record,
      dockerResourcesObserved: false as const,
      lockReleased,
    });
  const cancellation = readExecutionCancellation(signal);
  if (cancellation !== false)
    return result(
      "unknown",
      cancellation === true
        ? "coordinator_recovery_observation_cancelled"
        : "coordinator_recovery_signal_invalid",
      true,
    );
  try {
    if (recoveryId.startsWith("docker-task.")) {
      if (!parseDockerTaskRecoveryId(recoveryId)) throw Error();
    } else if (recoveryId.startsWith("docker-runtime-repair.")) {
      if (
        !/^docker-runtime-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(recoveryId)
      )
        throw Error();
    } else if (recoveryId.startsWith("host-operation.")) {
      if (!/^host-operation\.OP-[0-9]{6,}$/u.test(recoveryId)) throw Error();
    } else throw Error();
  } catch {
    return result("unknown", "coordinator_recovery_id_invalid", true);
  }
  let lockReleased = false;
  try {
    const observed = readState(rootCapability, { scope: "recovery" });
    lockReleased = observed.lockReleased;
    if (readExecutionCancellation(signal) !== false)
      return result(
        "unknown",
        "coordinator_recovery_observation_cancelled",
        lockReleased,
      );
    if (
      observed.status !== "completed" ||
      !lockReleased ||
      observed.value === null
    )
      return result(
        "unknown",
        "coordinator_recovery_observation_unknown",
        lockReleased,
      );
    const matches = observed.value.snapshot.operations.filter(
      (operation) => operation.recoveryId === recoveryId,
    );
    if (matches.length === 0)
      return result("not_recorded", "coordinator_recovery_not_recorded", true);
    if (matches.length !== 1 || !matches[0])
      return result(
        "unknown",
        "coordinator_recovery_observation_unknown",
        true,
      );
    const operation = matches[0];
    if (readExecutionCancellation(signal) !== false)
      return result(
        "unknown",
        "coordinator_recovery_observation_cancelled",
        true,
      );
    return result(
      "recorded",
      "coordinator_recovery_recorded",
      true,
      projectRecoveryRecord(operation, observed.value.snapshot.operations),
    );
  } catch {
    return result(
      "unknown",
      "coordinator_recovery_observation_unknown",
      lockReleased,
    );
  }
}
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
  const repository =
    borrowRuntimeOwnedCoordinatorRecoveryRepository(rootCapability);
  if (!repository || !/^host-operation\.OP-[0-9]{6,}$/u.test(recoveryId))
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_recovery_current_operation_unconfirmed",
      recoveryId,
      hostCleanupCompleted: false,
    });
  const current = readState(repository.root, { scope: "recovery" });
  const host =
    current.status === "completed" && current.value && current.lockReleased
      ? current.value.snapshot.operations.find(
          (item) =>
            item.kind === "host_operation" && item.recoveryId === recoveryId,
        )
      : null;
  if (host?.kind !== "host_operation")
    return {
      status: "blocked",
      reason: "coordinator_recovery_current_operation_unconfirmed",
      recoveryId,
      hostCleanupCompleted: false,
    };
  if (host.purpose === "isolation_probe")
    return recoverDockerIsolationProbe(
      recoveryId,
      repository.root,
      repository.revalidate,
      signal,
    );
  const generation = acquireHostOperationRecoveryGeneration(
    repository.root,
    recoveryId,
    repository.revalidate,
  );
  if (!generation)
    return {
      status: "blocked",
      reason: "host_recovery_generation_active",
      recoveryId,
      hostCleanupCompleted: false,
    };
  const result = recoverOwnedOperationDirectories(recoveryId, generation);
  return releaseHostOperationRecoveryGeneration(generation)
    ? { ...result, hostCleanupCompleted: result.status === "recovered" }
    : {
        status: "blocked",
        reason: "host_recovery_generation_release_unconfirmed",
        recoveryId,
        hostCleanupCompleted: false,
      };
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

/** 現在EM記録に一致する元Hostの専用Rootだけを返す。 @trace ARCH-000008 */
export function resolveRuntimeOwnedCurrentRecoveryOperationRoot(
  recoveryId: string,
  root: unknown,
): string | null {
  const repository = borrowRuntimeOwnedCoordinatorRecoveryRepository(root);
  if (!repository) return null;
  const read = readState(root, { scope: "recovery" });
  if (read.status !== "completed" || !read.lockReleased || !read.value)
    return null;
  const host = read.value.snapshot.operations.filter(
    (r): r is Extract<OperationRecord, { kind: "host_operation" }> =>
      r.kind === "host_operation" && r.recoveryId === recoveryId,
  );
  const selected = host[0];
  return host.length === 1 && selected
    ? path.join(
        repository.repositoryRoot,
        ".crdd",
        "operations",
        selected.operationId,
      )
    : null;
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
  initializationLeaseReleaseConfirmed?: boolean;
  consumer: ProductionPlan["consumer"];
  hostCleanupOutcome?: unknown;
  dockerCompletion?: unknown;
  terminalObservation?: RecordedAttemptObservation;
  settlementResult?: ReturnType<typeof completeOperation>;
  cleanupCheckpoint?: Readonly<{ revision: number; payloadSha256: string }>;
  completedPlan?: ProductionPlan;
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
};

const dockerRecoveryPreparations = new WeakMap<
  object,
  DockerRestartPreparation | DockerTaskRecoveryPreparation
>();

/** 私有準備のkeyに使えるObjectだけを受付する。 @trace ARCH-000008 */
function isRecoveryCapability(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

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
        record.repository.operationId,
      );
    } catch {
      record.cleanupUnknown = true;
      return false;
    }
    if (record.hostCleanup === "unknown") return false;
    return (
      observeHostRecoveryRoot(record.hostGeneration) === record.hostCleanup
    );
  } catch {
    return false;
  }
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
    const hosts = initial.value.snapshot.operations.filter(
      (r): r is Extract<OperationRecord, { kind: "host_operation" }> =>
        r.kind === "host_operation" && r.operationId === identity.operationId,
    );
    const host = hosts.length === 1 ? hosts[0] : null;
    if (!host || host.purpose === "isolation_probe")
      throw Error("docker_task_recovery_host_binding_invalid");
    const hostRoot = path.join(
      repository.repositoryRoot,
      ".crdd",
      "operations",
      host.operationId,
    );
    acquisitionPending = true;
    const generation = acquireHostOperationRecoveryGeneration(
      repository.root,
      host.recoveryId,
      repository.revalidate,
      initial.resourcePublication
        ? { kind: "resource_publication", recoveryId: parsed.token }
        : initial.currentHistoryPublication
          ? {
              kind: "execution_history",
              recoveryId: parsed.token,
              history: historyRepositoryInput(repository.root),
            }
          : initial.currentCompletionPublication
            ? { kind: "execution_completion", recoveryId: parsed.token }
            : undefined,
    );
    if (!generation) {
      reason = "docker_task_recovery_host_active_or_unknown";
      throw Error(reason);
    }
    locks.push({
      assertLive: () => {
        verifyHostOperationRecoveryGeneration(
          generation,
          hostRoot,
          host.operationId,
        );
        return true;
      },
      release: () => releaseHostOperationRecoveryGeneration(generation),
    });
    acquisitionPending = false;
    const hostCleanup = observeHostRecoveryRoot(generation);
    if (
      hostCleanup === "unknown" ||
      (host.cleanup === "confirmed" && hostCleanup !== "absent")
    )
      throw Error("docker_task_recovery_host_observation_unknown");
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
    let current = initial.resourcePublication
      ? readState(rootCapability, {
          scope: "recovery",
          input: {
            kind: "resource_publication",
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
              hostRoot,
              host.operationId,
            );
            if (observeHostRecoveryRoot(generation) !== hostCleanup)
              return false;
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
      repository: Object.freeze(
        Object.defineProperty(
          { ...repository, operationId: identity.operationId },
          "root",
          { value: repository.root },
        ),
      ),
      rootCapability,
      recoveryId: target.recoveryId,
      hostGeneration: generation,
      hostRoot,
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

/** 同じ回収Ownerと元版に結び付く技術評価だけを保存する。 @trace ARCH-000008 */
export function persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
  capability: unknown,
  kind: "resource" | "cleanup" | "lifecycle",
  value: unknown,
): boolean {
  if (!isRecoveryCapability(capability)) return false;
  const record = dockerRecoveryPreparations.get(capability);
  if (
    record?.kind !== "recovery" ||
    record.closed ||
    record.persistenceFailed ||
    record.cleanupUnknown ||
    record.hostCleanup === "unknown" ||
    (record.hostCleanup === "absent" && kind !== "lifecycle")
  )
    return false;
  record.persistenceFailed = true;
  try {
    if (!assertCurrentRecoveryOwner(capability, record)) return false;
    const saved = saveRecoveryCheckpoint(
      record.repository,
      record.recoveryId,
      record.before,
      {
        kind,
        value,
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
      record.hostCleanup === "absent"
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
    record.hostCleanup !== "absent"
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
          return isHostOperationRootAbsent(
            record.repository.root,
            record.repository.operationId,
          );
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
    record.hostCleanup !== "absent"
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
        return isHostOperationRootAbsent(
          record.repository.root,
          record.repository.operationId,
        );
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
      if (operation.kind !== "docker_task") continue;
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
    } else if (record.hostCleanup === "absent") {
      // prepareが既知終端の五資源と現在Host両不存在を照合済み。
      dockerCleanupConfirmed = true;
    } else throw new Error(reason);
    await setImmediate();
    if (signal?.aborted) throw new Error("docker_task_recovery_cancelled");
    reason = "docker_task_recovery_host_cleanup_unconfirmed";
    if (!cleanupRuntimeOwnedDockerTaskHost(capability)) throw Error(reason);
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
    record.hostCleanup !== "absent"
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
        return isHostOperationRootAbsent(
          record.repository.root,
          record.repository.operationId,
        );
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
    record.cleanupUnknown
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
          "host-operation." + record.repository.operationId,
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

/** 子の技術終結・元Lease解放を保存し、同じHost Ownerで実体を回収する。 @trace ARCH-000008 */
export function cleanupRuntimeOwnedDockerTaskHost(
  capability: unknown,
): boolean {
  if (!isRecoveryCapability(capability)) return false;
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
    const current = readState(
      record.rootCapability,
      record.completionPending
        ? {
            scope: "recovery",
            input: {
              kind: "execution_completion",
              recoveryId: record.recoveryId,
            },
          }
        : { scope: "recovery" },
    );
    if (!current.lockReleased) record.cleanupUnknown = true;
    if (
      current.status !== "completed" ||
      !current.value ||
      !current.lockReleased ||
      !Buffer.from(current.value.sourceText, "utf8").equals(record.before)
    )
      return false;
    const state = current.value.operationStates.find(
      (r) =>
        r.kind === "docker_task" &&
        r.operation.recoveryId === record.recoveryId,
    );
    if (
      state?.kind !== "docker_task" ||
      !state.resourcesSettled ||
      !state.restartSettled ||
      state.operation.execution.ownerEffect !== "disabled"
    )
      return false;
    const operation = state.operation;
    if (record.completionPending) {
      // Hostは既に終結済み。途中保存の同じ断面を観測するだけで再清掃しない。
      if (
        record.hostCleanup !== "absent" ||
        operation.lease !== "released" ||
        JSON.parse(operation.identityJson).operationId !==
          record.repository.operationId ||
        current.value.snapshot.operations.filter(
          (item) =>
            item.kind === "docker_task" &&
            item.recoveryId === record.recoveryId,
        ).length !== 1
      )
        return false;
      const host = readHostRecoveryOperation(record.hostGeneration);
      const hosts = current.value.snapshot.operations.filter(
        (item) =>
          item.kind === "host_operation" &&
          item.operationId === record.repository.operationId,
      );
      if (
        !host ||
        hosts.length !== 1 ||
        host.record.phase !== "terminal" ||
        host.record.cleanup !== "confirmed" ||
        !isDeepStrictEqual(host.record, hosts[0]) ||
        !isDeepStrictEqual(host.snapshot, current.value.snapshot) ||
        host.payloadSha256 !== current.value.payloadSha256 ||
        observeHostRecoveryRoot(record.hostGeneration) !== "absent"
      )
        return false;
      return assertCurrentRecoveryOwner(capability, record);
    }
    if (
      operation.lease !== "released" &&
      !persistRuntimeOwnedDockerTaskRecoveryCheckpoint(
        capability,
        "lifecycle",
        {
          phase: "settling",
          lease: "released",
          execution: operation.execution,
          primaryFailure: operation.primaryFailure,
          outcome: operation.outcome,
          summarySha256: operation.summarySha256,
        },
      )
    )
      return false;
    const recovered = recoverOwnedOperationDirectories(
      "host-operation." + record.repository.operationId,
      record.hostGeneration,
    );
    if (
      recovered.status !== "recovered" ||
      observeHostRecoveryRoot(record.hostGeneration) !== "absent"
    ) {
      record.hostCleanup = "unknown";
      return false;
    }
    record.hostCleanup = "absent";
    const after = readState(record.rootCapability, { scope: "recovery" });
    if (!after.lockReleased) record.cleanupUnknown = true;
    if (
      after.status !== "completed" ||
      !after.value ||
      !after.lockReleased ||
      !after.value.snapshot.operations.some(
        (r) =>
          r.kind === "host_operation" &&
          r.operationId === record.repository.operationId &&
          r.cleanup === "confirmed" &&
          r.phase === "terminal",
      )
    )
      return false;
    record.before = Buffer.from(after.value.sourceText, "utf8");
    record.snapshot = after.value.snapshot;
    record.operationStates = after.value.operationStates;
    return assertCurrentRecoveryOwner(capability, record);
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
    const home = observation.providerHome;
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
            : item.kind === "docker_task" &&
              JSON.parse(item.identityJson).stableLogicalHomeBindingHash ===
                plan.stableLogicalHomeBindingHash &&
              item.lease !== "released",
        )
      )
        throw new Error("docker_recovery_runtime_state_conflict");
      stage = "operation_binding";
      recoveryId =
        "docker-task." +
        plan.stableLogicalHomeBindingHash +
        "." +
        nonce +
        "." +
        createHash("sha256").update(identityJson, "utf8").digest("hex");
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
      const host = readOwnedHostOperation(managementCapability).record;
      if (host.operationId !== plan.operationId || host.phase !== "active")
        throw Error("docker_recovery_host_binding_invalid");
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
    const host = readOwnedHostOperation(managementCapability).record;
    if (
      host.operationId !== plan.operationId ||
      host.phase !== "active" ||
      host.purpose === "isolation_probe"
    )
      return null;
    const identity = {
      schema: "crdd-coordinator/operation-identity/v6",
      operationNonce,
      provider: plan.provider,
      consumer,
      operationId: plan.operationId,
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
    };
    const identityJson = `${JSON.stringify(identity)}\n`;
    return repository.revalidate() ? identityJson : null;
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
    result.recoveryId !== record.recoveryId ||
    record.executorControl !== undefined ||
    result.status !== "blocked" ||
    result.dockerEffectStarted !== false ||
    result.providerRequestStarted !== false ||
    ![
      "docker_process_controller_plan_invalid",
      "docker_process_controller_recovery_unavailable",
      "docker_process_controller_home_lock_initialization_failed",
      "docker_process_controller_home_lock_descriptor_close_unconfirmed",
    ].includes(result.reason)
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
          result.reason === "docker_process_controller_plan_invalid"
            ? "plan_validation"
            : "home_lock",
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
  if (!record || record.completedPlan || record.cleanupCheckpoint) return false;
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

/** 実資源回収とHome解放を元Docker操作の終了準備へ保存する。 @trace ARCH-000008 */
function completeProductionRecovery(
  recoveryCapability: unknown,
  managementCapability: unknown,
  rawCompletion: unknown,
) {
  const record = durableRecord(recoveryCapability),
    completion = snapshotPlainRecord(rawCompletion, new Set(["plan"]));
  if (
    !record ||
    record.managementCapability !== managementCapability ||
    !completion ||
    !record.cleanupCheckpoint ||
    !record.homeLeaseReleased ||
    !validProductionPlan(completion.plan as ProductionPlan) ||
    (record.completedPlan && record.completedPlan !== completion.plan)
  )
    return Object.freeze({ status: "blocked" as const });
  const plan = completion.plan as ProductionPlan;
  const current = readOperationStateStage(managementCapability);
  const operation = current.value?.snapshot.operations.find(
    (r): r is ExecutionOperationRecord =>
      r.kind === "docker_task" && r.recoveryId === record.recoveryId,
  );
  const host = readOwnedHostOperation(managementCapability).record;
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    !operation ||
    host.operationId !== plan.operationId ||
    host.phase !== "active" ||
    JSON.parse(operation.identityJson).operationId !== plan.operationId ||
    record.operationId !== plan.operationId
  )
    return Object.freeze({ status: "blocked" as const });
  const identity = JSON.parse(operation.identityJson);
  if (
    identity.taskAttempt !== plan.taskAttempt ||
    !isDeepStrictEqual(identity.executionSelection, plan.executionSelection) ||
    [
      "provider",
      "consumer",
      "stableLogicalHomeBindingHash",
      "providerHomeIdentityHash",
      "ownershipLabel",
      "operationMode",
    ].some((k) => identity[k] !== plan[k as keyof typeof plan])
  )
    return Object.freeze({ status: "blocked" as const });
  const expected = new Map([
    ["create_subscription_auth_probe", plan.authContainerName],
    ["create_provider", plan.providerContainerName],
    ["create_proxy", plan.proxyContainerName],
    ["create_internal_network", plan.internalNetworkName],
    ["create_egress_network", plan.egressNetworkName],
  ]);
  if (
    !operation.resources ||
    operation.resources.snapshot.resources.length !== expected.size ||
    new Set(operation.resources.snapshot.resources.map((r) => r.key)).size !==
      expected.size ||
    operation.resources.snapshot.resources.some(
      (r) => expected.get(r.key) !== r.identity.name,
    ) ||
    !current.value?.operationStates.some(
      (r) =>
        r.kind === "docker_task" &&
        r.operation === operation &&
        r.resourcesSettled,
    )
  )
    return Object.freeze({ status: "blocked" as const });
  if (record.completedPlan)
    return Object.freeze({
      status: "completed" as const,
      recoveryFinalizationCapability: recoveryCapability as object,
    });
  if (
    current.value.snapshot.revision !== record.cleanupCheckpoint.revision ||
    current.value.payloadSha256 !== record.cleanupCheckpoint.payloadSha256
  )
    return Object.freeze({ status: "blocked" as const });
  const saved = saveOperationCheckpoint(
    managementCapability,
    record.recoveryId,
    {
      kind: "lifecycle",
      value: {
        phase: "settling",
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
  record.completedPlan = plan;
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

/** 同じDockerの終結と現在Hostを照合して固定参照を返す。 @trace ARCH-000008 */
export function prepareRuntimeOwnedDockerHostCleanup(capability: unknown) {
  const record = durableRecord(capability);
  if (!record?.completedPlan || !record.homeLeaseReleased) return null;
  const current = readOperationStateStage(record.managementCapability);
  const state = current.value?.operationStates.find(
    (r) =>
      r.kind === "docker_task" && r.operation.recoveryId === record.recoveryId,
  );
  if (
    current.status !== "completed" ||
    !current.lockReleased ||
    state?.kind !== "docker_task" ||
    !state.resourcesSettled ||
    !state.restartSettled ||
    state.operation.phase !== "settling" ||
    state.operation.lease !== "released" ||
    state.operation.execution.ownerEffect !== "disabled"
  )
    return null;
  const host = readOwnedHostOperation(record.managementCapability).record;
  return host.operationId === record.operationId && host.phase === "active"
    ? host.recoveryId
    : null;
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
  const plan = record?.completedPlan as RecoveryPlan | undefined;
  const terminal = record?.terminalObservation;
  if (
    !record ||
    !plan ||
    record.dockerCompletion !== result ||
    !terminal ||
    terminal.homeLeaseReleased !== true ||
    !terminal.recoveryCompleted ||
    terminal.recoveryId !== record.recoveryId ||
    terminal.operationId !== record.operationId ||
    result.status !== "completed" ||
    !result.cleanupConfirmed ||
    result.cancellationRequested ||
    result.operationId !== record.operationId ||
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
  operations: readonly OperationRecord[],
): operation is ExecutionOperationRecord {
  if (operation.kind !== "docker_task") return false;
  return (
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    !operations.some(
      (r) =>
        r.kind === "host_operation" &&
        r.operationId === JSON.parse(operation.identityJson).operationId &&
        r.cleanup === "confirmed",
    ) ||
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
    const initialValue = initial.value;
    const scoped = initialValue.snapshot.operations.filter(
      (operation): operation is ExecutionOperationRecord => {
        const state = initialValue.operationStates.find(
          (value) => value.operation === operation,
        );
        if (!state || state.kind !== operation.kind)
          throw new Error("docker_restart_boundary_changed");
        return (
          state.kind === "docker_task" &&
          restartScopeIncludes(
            state.operation,
            state.resourcesSettled,
            initialValue.snapshot.operations,
          )
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
          host: JSON.parse(operation.identityJson).operationId as string,
        };
      })
      .sort((left, right) => left.recoveryId.localeCompare(right.recoveryId));
    const scopeSha256 = createHash("sha256")
      .update(
        JSON.stringify({
          schema: "crdd-coordinator/docker-restart-scope/v2",
          repositoryBinding: repository.repositoryBinding,
          identities,
        }),
      )
      .digest("hex");
    for (const host of [...new Set(identities.map((i) => i.host))].sort()) {
      const acquired = acquireHostOperationLock(
        repository.repositoryRoot,
        host,
      );
      if (acquired.status !== "acquired") {
        observationCleanupConfirmed &&= acquired.cleanupConfirmed;
        if (!acquired.descriptorClosed)
          poisonRuntimeProcessAfterCleanupUnknown();
        throw Error("docker_restart_host_active_or_unknown");
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
    if (homeLeaseReleased) {
      const completion = completeRuntimeOwnedDockerRecovery(
        recoveryCapability,
        managementCapability,
        Object.freeze({ plan }),
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
    homeLeaseReleased,
    recoveryCompleted,
    recoveryFinalizationCapability,
  });
}
