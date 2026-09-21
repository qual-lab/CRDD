/**
 * verify-signed-route-matrixに属する責務をまとめる。
 *
 * @responsibility emptyArrayを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../version-control/src/repository-location.ts";
import {
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../src/core/runtime-process-safety-state.ts";
import {
  displayVerificationRecording,
  runRecordedVerification,
} from "../src/core/verification-result-record.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import {
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/security/release-identity-grammar.ts";
import {
  evaluateSignedRunnerSafetyObservation,
  salvageSignedRunnerRecoveryPair,
} from "../src/security/signed-runner-safety-observation.ts";
import {
  runSignedGeneralTaskVerification,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-route-matrix-verification";
export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION = 14;

const MAX_SAFE_ROUTE_ATTEMPTS = 3;
const SAFE_RETRYABLE_ROUTE_REASONS = new Set([
  "signed_general_task_candidate_content_mismatch",
]);

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
  "same-codex",
  "same-claude",
]);
const TARGET_PATH =
  "40_Develop/coordinator/runtime/general-task-verification.txt";
const SHA256 = /^[a-f0-9]{64}$/u;
const ROUTE_SAFETY_SCHEMA = Object.freeze({
  booleanFields: Object.freeze([
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
    "effectStateUnknown",
    "canonicalRepositoryChanged",
    "rawProviderOutputReported",
    "hostPathReported",
    "credentialReported",
  ]),
  nullableRecoveryFields: Object.freeze([]),
  recoveryPairs: Object.freeze([
    Object.freeze({
      singularField: "hostRecoveryId",
      pluralField: "hostRecoveryIds",
      kind: "host" as const,
    }),
    Object.freeze({
      singularField: "dockerRecoveryId",
      pluralField: "dockerRecoveryIds",
      kind: "docker" as const,
    }),
    Object.freeze({
      singularField: "candidateRecoveryId",
      pluralField: "candidateRecoveryIds",
      kind: "candidate" as const,
    }),
    Object.freeze({
      singularField: "candidateStoreRecoveryId",
      pluralField: "candidateStoreRecoveryIds",
      kind: "candidate_store" as const,
    }),
  ]),
  effectUnknownField: "effectStateUnknown",
});

const EXPECTED = Object.freeze({
  forward: Object.freeze({
    route: "front_codex__executor_claude__reviewer_codex",
    front: "codex",
    executor: "claude",
    reviewer: "codex",
  }),
  reverse: Object.freeze({
    route: "front_claude__executor_codex__reviewer_claude",
    front: "claude",
    executor: "codex",
    reviewer: "claude",
  }),
  "same-codex": Object.freeze({
    route: "front_codex__executor_codex__reviewer_claude",
    front: "codex",
    executor: "codex",
    reviewer: "claude",
  }),
  "same-claude": Object.freeze({
    route: "front_claude__executor_claude__reviewer_codex",
    front: "claude",
    executor: "claude",
    reviewer: "codex",
  }),
});

/**
 * empty Arrayを決定する。
 *
 * @responsibility empty Arrayの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns emptyArrayの計算結果を返す。
 * @precondition 「value: unknown」がemptyArrayの入力契約を満たす。
 * @postcondition emptyArrayの責務を完了した結果だけを返す。
 * @effect N/A: emptyArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: emptyArrayは独自の失敗分岐を所有しない。
 * @invariant emptyArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: emptyArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: emptyArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: emptyArrayは共有非同期状態を持たない同期処理である。
 */
function emptyArray(value: unknown) {
  const snapshot = snapshotPlainArray(value, 0);
  return snapshot.status === "ok" && snapshot.value.length === 0;
}

/**
 * Changed Pathが完全一致するか判定する。
 *
 * @responsibility Changed Pathの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns exactChangedPathの計算結果を返す。
 * @precondition 「value: unknown」がexactChangedPathの入力契約を満たす。
 * @postcondition exactChangedPathの責務を完了した結果だけを返す。
 * @effect N/A: exactChangedPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactChangedPathは独自の失敗分岐を所有しない。
 * @invariant exactChangedPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactChangedPathはProcess内の同一Subsystemで完結する。
 * @security N/A: exactChangedPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactChangedPathは共有非同期状態を持たない同期処理である。
 */
function exactChangedPath(value: unknown) {
  const snapshot = snapshotPlainArray<unknown>(value, 1);
  return (
    snapshot.status === "ok" &&
    snapshot.value.length === 1 &&
    snapshot.value[0] === TARGET_PATH
  );
}

/**
 * Route 記録を所有Snapshotへ変換する。
 *
 * @responsibility Route 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns snapshotRouteRecordの計算結果を返す。
 * @precondition 「value: unknown」がsnapshotRouteRecordの入力契約を満たす。
 * @postcondition snapshotRouteRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotRouteRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotRouteRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotRouteRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotRouteRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotRouteRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotRouteRecordは共有非同期状態を持たない同期処理である。
 */
function snapshotRouteRecord(value: unknown) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
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

/**
 * Release Identityが有効か判定する。
 *
 * @responsibility Release Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input result: Readonly<Record<string, unknown>>
 * @returns validReleaseIdentityの計算結果を返す。
 * @precondition 「result: Readonly<Record<string, unknown>>」がvalidReleaseIdentityの入力契約を満たす。
 * @postcondition validReleaseIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validReleaseIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validReleaseIdentityは独自の失敗分岐を所有しない。
 * @invariant validReleaseIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validReleaseIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: validReleaseIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validReleaseIdentityは共有非同期状態を持たない同期処理である。
 */
function validReleaseIdentity(result: Readonly<Record<string, unknown>>) {
  return (
    typeof result.manifestHash === "string" &&
    SHA256.test(result.manifestHash) &&
    typeof result.packageContentRootSha256 === "string" &&
    SHA256.test(result.packageContentRootSha256) &&
    typeof result.runtimeExecutionIdentitySha256 === "string" &&
    SHA256.test(result.runtimeExecutionIdentitySha256) &&
    isCanonicalCrddVersion(result.crddVersion) &&
    Number.isSafeInteger(result.releaseSequence) &&
    Number(result.releaseSequence) >= 1 &&
    isSupportedCrddRuntimeGitObjectId(result.crddCommit) &&
    isSupportedCrddRuntimeGitObjectId(result.crddTree)
  );
}

/**
 * Identityを解放する。
 *
 * @responsibility Identityの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000004
 * @input result: Readonly<Record<string, unknown>>
 * @returns releaseIdentityの計算結果を返す。
 * @precondition 「result: Readonly<Record<string, unknown>>」がreleaseIdentityの入力契約を満たす。
 * @postcondition releaseIdentityの責務を完了した結果だけを返す。
 * @effect N/A: releaseIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: releaseIdentityは独自の失敗分岐を所有しない。
 * @invariant releaseIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: releaseIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: releaseIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: releaseIdentityは共有非同期状態を持たない同期処理である。
 */
function releaseIdentity(result: Readonly<Record<string, unknown>>) {
  return JSON.stringify([
    result.manifestHash,
    result.packageContentRootSha256,
    result.runtimeExecutionIdentitySha256,
    result.crddVersion,
    result.releaseSequence,
    result.crddCommit,
    result.crddTree,
  ]);
}

/**
 * Execution Identityが有効か判定する。
 *
 * @responsibility Execution Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input result: Readonly<Record<string, unknown>>
 * @returns validExecutionIdentityの計算結果を返す。
 * @precondition 「result: Readonly<Record<string, unknown>>」がvalidExecutionIdentityの入力契約を満たす。
 * @postcondition validExecutionIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validExecutionIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validExecutionIdentityは独自の失敗分岐を所有しない。
 * @invariant validExecutionIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validExecutionIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: validExecutionIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validExecutionIdentityは共有非同期状態を持たない同期処理である。
 */
function validExecutionIdentity(result: Readonly<Record<string, unknown>>) {
  return (
    isSupportedCrddRuntimeGitObjectId(result.executionCommit) &&
    isSupportedCrddRuntimeGitObjectId(result.executionTree)
  );
}

/**
 * execution Identityを決定する。
 *
 * @responsibility execution Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input result: Readonly<Record<string, unknown>>
 * @returns executionIdentityの計算結果を返す。
 * @precondition 「result: Readonly<Record<string, unknown>>」がexecutionIdentityの入力契約を満たす。
 * @postcondition executionIdentityの責務を完了した結果だけを返す。
 * @effect N/A: executionIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: executionIdentityは独自の失敗分岐を所有しない。
 * @invariant executionIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executionIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: executionIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executionIdentityは共有非同期状態を持たない同期処理である。
 */
function executionIdentity(result: Readonly<Record<string, unknown>>) {
  return JSON.stringify([result.executionCommit, result.executionTree]);
}

/**
 * Runtime Process Poisonedが成立する状態を確保する。
 *
 * @responsibility Runtime Process Poisonedの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: ensureRuntimeProcessPoisonedは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がensureRuntimeProcessPoisonedの入力契約を満たす。
 * @postcondition ensureRuntimeProcessPoisonedの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: ensureRuntimeProcessPoisonedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ensureRuntimeProcessPoisonedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureRuntimeProcessPoisonedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRuntimeProcessPoisonedはProcess内の同一Subsystemで完結する。
 * @security N/A: ensureRuntimeProcessPoisonedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureRuntimeProcessPoisonedは共有非同期状態を持たない同期処理である。
 */
function ensureRuntimeProcessPoisoned() {
  poisonRuntimeProcessAfterCleanupUnknown();
  if (!isRuntimeProcessPoisoned())
    throw new Error("runtime_process_poison_transition_failed");
}

const RECOVERY_PAIRS = Object.freeze([
  Object.freeze({
    singular: "hostRecoveryId",
    plural: "hostRecoveryIds",
    kind: "host" as const,
  }),
  Object.freeze({
    singular: "dockerRecoveryId",
    plural: "dockerRecoveryIds",
    kind: "docker" as const,
  }),
  Object.freeze({
    singular: "candidateRecoveryId",
    plural: "candidateRecoveryIds",
    kind: "candidate" as const,
  }),
  Object.freeze({
    singular: "candidateStoreRecoveryId",
    plural: "candidateStoreRecoveryIds",
    kind: "candidate_store" as const,
  }),
]);

/**
 * sanitized Route 回復を決定する。
 *
 * @responsibility sanitized Route 回復の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input result: Readonly<Record<string, unknown>>
 * @returns Readonly<Record<string, unknown>>を返す。
 * @precondition 「result: Readonly<Record<string, unknown>>」がsanitizedRouteRecoveryの入力契約を満たす。
 * @postcondition sanitizedRouteRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: sanitizedRouteRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sanitizedRouteRecoveryは独自の失敗分岐を所有しない。
 * @invariant sanitizedRouteRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sanitizedRouteRecoveryはProcess内の同一Subsystemで完結する。
 * @security N/A: sanitizedRouteRecoveryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sanitizedRouteRecoveryは共有非同期状態を持たない同期処理である。
 */
function sanitizedRouteRecovery(
  result: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const projection: Record<string, unknown> = Object.create(null);
  let isAmbiguous = false;
  for (const pair of RECOVERY_PAIRS) {
    const recovered = salvageSignedRunnerRecoveryPair(result, {
      singularField: pair.singular,
      pluralField: pair.plural,
      kind: pair.kind,
    });
    projection[pair.singular] = recovered.singular;
    projection[pair.plural] = recovered.plural;
    if (recovered.ambiguous) isAmbiguous = true;
  }
  return Object.freeze({
    ...projection,
    recoveryIdentityAmbiguous: isAmbiguous,
  });
}

/**
 * empty Route 回復を決定する。
 *
 * @responsibility empty Route 回復の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input isAmbiguous
 * @returns emptyRouteRecoveryの計算結果を返す。
 * @precondition 「isAmbiguous」がemptyRouteRecoveryの入力契約を満たす。
 * @postcondition emptyRouteRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: emptyRouteRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: emptyRouteRecoveryは独自の失敗分岐を所有しない。
 * @invariant emptyRouteRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: emptyRouteRecoveryはProcess内の同一Subsystemで完結する。
 * @security N/A: emptyRouteRecoveryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: emptyRouteRecoveryは共有非同期状態を持たない同期処理である。
 */
function emptyRouteRecovery(isAmbiguous = false) {
  return Object.freeze({
    hostRecoveryId: null,
    hostRecoveryIds: Object.freeze([]),
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateRecoveryIds: Object.freeze([]),
    candidateStoreRecoveryId: null,
    candidateStoreRecoveryIds: Object.freeze([]),
    recoveryIdentityAmbiguous: isAmbiguous,
  });
}

/**
 * failed Route 結果を決定する。
 *
 * @responsibility failed Route 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input route: SignedGeneralTaskRouteProfile、observed: Readonly<Record<string, unknown>> | null
 * @returns failedRouteResultの計算結果を返す。
 * @precondition 「route: SignedGeneralTaskRouteProfile、observed: Readonly<Record<string, unknown>> | null」がfailedRouteResultの入力契約を満たす。
 * @postcondition failedRouteResultの責務を完了した結果だけを返す。
 * @effect N/A: failedRouteResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failedRouteResultは独自の失敗分岐を所有しない。
 * @invariant failedRouteResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: failedRouteResultはProcess内の同一Subsystemで完結する。
 * @security N/A: failedRouteResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: failedRouteResultは共有非同期状態を持たない同期処理である。
 */
function failedRouteResult(
  route: SignedGeneralTaskRouteProfile,
  observed: Readonly<Record<string, unknown>> | null = null,
) {
  const recovery = observed
    ? sanitizedRouteRecovery(observed)
    : emptyRouteRecovery(true);
  return Object.freeze({
    status: "blocked" as const,
    reason: "signed_route_matrix_route_runner_failed_closed",
    requestedRouteProfile: route,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown: true,
    canonicalRepositoryChanged: null,
    rawProviderOutputReported: null,
    hostPathReported: null,
    credentialReported: null,
    ...recovery,
  });
}

/**
 * Route 回復を集約する。
 *
 * @responsibility Route 回復の集約入力、重複処理、集約結果の境界を所有する。
 * @trace ARCH-000004
 * @input results: readonly Readonly<Record<string, unknown>>[]
 * @returns aggregateRouteRecoveryの計算結果を返す。
 * @precondition 「results: readonly Readonly<Record<string, unknown>>[]」がaggregateRouteRecoveryの入力契約を満たす。
 * @postcondition aggregateRouteRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: aggregateRouteRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: aggregateRouteRecoveryは独自の失敗分岐を所有しない。
 * @invariant aggregateRouteRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: aggregateRouteRecoveryはProcess内の同一Subsystemで完結する。
 * @security N/A: aggregateRouteRecoveryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: aggregateRouteRecoveryは共有非同期状態を持たない同期処理である。
 */
function aggregateRouteRecovery(
  results: readonly Readonly<Record<string, unknown>>[],
) {
  const aggregate: Record<string, unknown> = Object.create(null);
  let isAmbiguous = results.some(
    (result) => result.recoveryIdentityAmbiguous === true,
  );
  for (const pair of RECOVERY_PAIRS) {
    const ids: string[] = [];
    for (const result of results) {
      const recovery = sanitizedRouteRecovery(result);
      const values = recovery[pair.plural];
      if (Array.isArray(values)) ids.push(...(values as readonly string[]));
      if (recovery.recoveryIdentityAmbiguous === true) isAmbiguous = true;
    }
    const allUniqueItems = [...new Set(ids)];
    if (allUniqueItems.length > 128) isAmbiguous = true;
    const uniqueItems = Object.freeze(allUniqueItems.slice(0, 128));
    aggregate[pair.singular] = uniqueItems.length === 1 ? uniqueItems[0] : null;
    aggregate[pair.plural] = uniqueItems;
  }
  return Object.freeze({
    ...aggregate,
    recoveryIdentityAmbiguous: isAmbiguous,
  });
}

/**
 * process Restart Required 結果を決定する。
 *
 * @responsibility process Restart Required 結果の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns processRestartRequiredResultの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がprocessRestartRequiredResultの入力契約を満たす。
 * @postcondition processRestartRequiredResultの責務を完了した結果だけを返す。
 * @effect N/A: processRestartRequiredResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: processRestartRequiredResultは独自の失敗分岐を所有しない。
 * @invariant processRestartRequiredResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: processRestartRequiredResultはProcess内の同一Subsystemで完結する。
 * @security N/A: processRestartRequiredResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: processRestartRequiredResultは共有非同期状態を持たない同期処理である。
 */
function processRestartRequiredResult() {
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason: "signed_route_matrix_process_restart_required",
    requestedRoutes: ROUTES,
    attemptedRouteCount: 0,
    completedRouteCount: 0,
    retryableRouteAttemptCount: 0,
    failedRouteProfile: null,
    validationFailure: "process_restart_required" as const,
    results: Object.freeze([]),
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: true,
    effectStateUnknown: false,
    canonicalRepositoryChanged: false,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
    ...emptyRouteRecovery(false),
  });
}

/**
 * Exact Signed Route 結果かを判定する。
 *
 * @responsibility Exact Signed Route 結果の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input route: SignedGeneralTaskRouteProfile、result: Readonly<Record<string, unknown>>、expectedAuthorizationMode: | "interactive_initial_consent" | "reused_initial_consent"
 * @returns isExactSignedRouteResultの計算結果を返す。
 * @precondition 「route: SignedGeneralTaskRouteProfile、result: Readonly<Record<string, unknown>>、expectedAuthorizationMode: | "interactive_initial_consent" | "reused_initial_consent"」がisExactSignedRouteResultの入力契約を満たす。
 * @postcondition isExactSignedRouteResultの責務を完了した結果だけを返す。
 * @effect N/A: isExactSignedRouteResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isExactSignedRouteResultは独自の失敗分岐を所有しない。
 * @invariant isExactSignedRouteResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isExactSignedRouteResultはProcess内の同一Subsystemで完結する。
 * @security N/A: isExactSignedRouteResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isExactSignedRouteResultは共有非同期状態を持たない同期処理である。
 */
export function isExactSignedRouteResult(
  route: SignedGeneralTaskRouteProfile,
  result: Readonly<Record<string, unknown>>,
  expectedAuthorizationMode:
    | "interactive_initial_consent"
    | "reused_initial_consent",
) {
  const expected = EXPECTED[route];
  return (
    result.contract === SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT &&
    result.contractRevision ===
      SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION &&
    result.status === "completed" &&
    result.reason === "signed_general_task_verification_completed" &&
    result.requestedRouteProfile === route &&
    result.route === expected.route &&
    result.requestedFrontProvider === expected.front &&
    result.observedFrontProvider === null &&
    result.frontIdentityVerified === false &&
    result.executorProvider === expected.executor &&
    result.reviewerProvider === expected.reviewer &&
    result.reviewerIndependence === "provider_independent" &&
    result.externalSendAuthorizationMode === expectedAuthorizationMode &&
    validReleaseIdentity(result) &&
    validExecutionIdentity(result) &&
    exactChangedPath(result.changedPaths) &&
    typeof result.remediationPerformed === "boolean" &&
    result.exactCandidateContentVerified === true &&
    result.candidateDiscarded === true &&
    result.candidateDisposition === "discarded" &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.processRestartRequired === false &&
    result.hostRecoveryId === null &&
    emptyArray(result.hostRecoveryIds) &&
    result.dockerRecoveryId === null &&
    emptyArray(result.dockerRecoveryIds) &&
    result.candidateRecoveryId === null &&
    emptyArray(result.candidateRecoveryIds) &&
    result.candidateStoreRecoveryId === null &&
    emptyArray(result.candidateStoreRecoveryIds) &&
    result.recoveryIdentityAmbiguous === false &&
    result.canonicalRepositoryChanged === false &&
    result.rawProviderOutputReported === false &&
    result.hostPathReported === false &&
    result.credentialReported === false
  );
}

/**
 * Safe Retryable Route 結果かを判定する。
 *
 * @responsibility Safe Retryable Route 結果の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input result: Readonly<Record<string, unknown>>
 * @returns isSafeRetryableRouteResultの計算結果を返す。
 * @precondition 「result: Readonly<Record<string, unknown>>」がisSafeRetryableRouteResultの入力契約を満たす。
 * @postcondition isSafeRetryableRouteResultの責務を完了した結果だけを返す。
 * @effect N/A: isSafeRetryableRouteResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSafeRetryableRouteResultは独自の失敗分岐を所有しない。
 * @invariant isSafeRetryableRouteResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSafeRetryableRouteResultはProcess内の同一Subsystemで完結する。
 * @security N/A: isSafeRetryableRouteResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSafeRetryableRouteResultは共有非同期状態を持たない同期処理である。
 */
function isSafeRetryableRouteResult(result: Readonly<Record<string, unknown>>) {
  return (
    result.status === "blocked" &&
    typeof result.reason === "string" &&
    SAFE_RETRYABLE_ROUTE_REASONS.has(result.reason) &&
    (result.externalSendAuthorizationMode === "interactive_initial_consent" ||
      result.externalSendAuthorizationMode === "reused_initial_consent") &&
    result.candidateDisposition === "discarded" &&
    result.candidateDiscarded === true &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.processRestartRequired === false &&
    result.effectStateUnknown === false &&
    result.hostRecoveryId === null &&
    emptyArray(result.hostRecoveryIds) &&
    result.dockerRecoveryId === null &&
    emptyArray(result.dockerRecoveryIds) &&
    result.candidateRecoveryId === null &&
    emptyArray(result.candidateRecoveryIds) &&
    result.candidateStoreRecoveryId === null &&
    emptyArray(result.candidateStoreRecoveryIds) &&
    result.recoveryIdentityAmbiguous === false &&
    result.canonicalRepositoryChanged === false &&
    result.rawProviderOutputReported === false &&
    result.hostPathReported === false &&
    result.credentialReported === false
  );
}

/**
 * Signed Route Matrix Verificationを実行する。
 *
 * @responsibility Signed Route Matrix Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryRoot: string、routeRun: typeof runSignedGeneralTaskVerification
 * @returns runSignedRouteMatrixVerificationの計算結果を返す。
 * @precondition 「repositoryRoot: string、routeRun: typeof runSignedGeneralTaskVerification」がrunSignedRouteMatrixVerificationの入力契約を満たす。
 * @postcondition runSignedRouteMatrixVerificationの責務を完了した結果だけを返す。
 * @effect N/A: runSignedRouteMatrixVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runSignedRouteMatrixVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runSignedRouteMatrixVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runSignedRouteMatrixVerificationはProcess内の同一Subsystemで完結する。
 * @security N/A: runSignedRouteMatrixVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runSignedRouteMatrixVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runSignedRouteMatrixVerification(
  repositoryRoot: string,
  routeRun: typeof runSignedGeneralTaskVerification = runSignedGeneralTaskVerification,
) {
  if (isRuntimeProcessPoisoned()) return processRestartRequiredResult();
  const results: Array<Readonly<Record<string, unknown>>> = [];
  let verifiedRouteCount = 0;
  let retryableRouteAttemptCount = 0;
  let baselineReleaseIdentity: string | null = null;
  let baselineExecutionIdentity: string | null = null;
  let initialConsentAuthorizationMode:
    | "interactive_initial_consent"
    | "reused_initial_consent"
    | null = null;
  let failedRouteProfile: SignedGeneralTaskRouteProfile | null = null;
  let validationFailure:
    | "route_nonconforming"
    | "release_identity_mismatch"
    | "execution_identity_mismatch"
    | "runner_exception"
    | null = null;
  routeLoop: for (const [index, route] of ROUTES.entries()) {
    for (let attempt = 1; attempt <= MAX_SAFE_ROUTE_ATTEMPTS; attempt += 1) {
      let routeSnapshot: Readonly<Record<string, unknown>> | null = null;
      try {
        const outcome = await routeRun(repositoryRoot, undefined, route);
        const result = snapshotRouteRecord(outcome);
        if (!result) throw new Error("route_result_snapshot_unknown");
        routeSnapshot = result;
        const safety = evaluateSignedRunnerSafetyObservation(
          result,
          ROUTE_SAFETY_SCHEMA,
        );
        if (safety.status !== "exact")
          throw new Error("route_safety_observation_unknown");
        if (
          result.processRestartRequired === true &&
          !isRuntimeProcessPoisoned()
        )
          ensureRuntimeProcessPoisoned();
        results.push(result);
        const observedAuthorizationMode = result.externalSendAuthorizationMode;
        if (
          index === 0 &&
          initialConsentAuthorizationMode === null &&
          (observedAuthorizationMode === "interactive_initial_consent" ||
            observedAuthorizationMode === "reused_initial_consent")
        )
          initialConsentAuthorizationMode = observedAuthorizationMode;
        const expectedAuthorizationMode =
          index === 0 && attempt === 1 && initialConsentAuthorizationMode
            ? initialConsentAuthorizationMode
            : "reused_initial_consent";
        if (!validReleaseIdentity(result) || !validExecutionIdentity(result)) {
          failedRouteProfile = route;
          validationFailure = "route_nonconforming";
          break routeLoop;
        }
        const currentReleaseIdentity = releaseIdentity(result);
        if (baselineReleaseIdentity === null)
          baselineReleaseIdentity = currentReleaseIdentity;
        else if (currentReleaseIdentity !== baselineReleaseIdentity) {
          failedRouteProfile = route;
          validationFailure = "release_identity_mismatch";
          break routeLoop;
        }
        const currentExecutionIdentity = executionIdentity(result);
        if (baselineExecutionIdentity === null)
          baselineExecutionIdentity = currentExecutionIdentity;
        else if (currentExecutionIdentity !== baselineExecutionIdentity) {
          failedRouteProfile = route;
          validationFailure = "execution_identity_mismatch";
          break routeLoop;
        }
        const isExact = isExactSignedRouteResult(
          route,
          result,
          expectedAuthorizationMode,
        );
        if (!isExact) {
          if (
            attempt < MAX_SAFE_ROUTE_ATTEMPTS &&
            isSafeRetryableRouteResult(result)
          ) {
            retryableRouteAttemptCount += 1;
            continue;
          }
          failedRouteProfile = route;
          validationFailure = "route_nonconforming";
          break routeLoop;
        }
        verifiedRouteCount += 1;
        continue routeLoop;
      } catch {
        ensureRuntimeProcessPoisoned();
        results.push(failedRouteResult(route, routeSnapshot));
        failedRouteProfile = route;
        validationFailure = "runner_exception";
        break routeLoop;
      }
    }
  }
  const isCompleted = verifiedRouteCount === ROUTES.length;
  const isEffectStateUnknown = results.some(
    (result) => result.effectStateUnknown === true,
  );
  const recovery = aggregateRouteRecovery(results);
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: isCompleted ? ("completed" as const) : ("blocked" as const),
    reason: isCompleted
      ? "signed_route_matrix_completed"
      : "signed_route_matrix_incomplete",
    requestedRoutes: ROUTES,
    attemptedRouteCount: results.length,
    completedRouteCount: verifiedRouteCount,
    retryableRouteAttemptCount,
    initialConsentAuthorizationMode,
    failedRouteProfile,
    validationFailure,
    results: Object.freeze(results),
    cleanupConfirmed:
      results.length > 0 &&
      results.every((result) => result.cleanupConfirmed === true),
    manualRecoveryRequired:
      isEffectStateUnknown ||
      results.some((result) => result.manualRecoveryRequired !== false),
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown: isEffectStateUnknown,
    canonicalRepositoryChanged: isEffectStateUnknown
      ? null
      : results.some((result) => result.canonicalRepositoryChanged !== false),
    rawProviderOutputReported: isEffectStateUnknown
      ? null
      : results.some((result) => result.rawProviderOutputReported !== false),
    hostPathReported: isEffectStateUnknown
      ? null
      : results.some((result) => result.hostPathReported !== false),
    credentialReported: isEffectStateUnknown
      ? null
      : results.some((result) => result.credentialReported !== false),
    ...recovery,
  });
}

/**
 * Signed Route Matrix Verification 契約の公開契約を記述する。
 *
 * @responsibility Signed Route Matrix Verification 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeSignedRouteMatrixVerificationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeSignedRouteMatrixVerificationContractの入力契約を満たす。
 * @postcondition describeSignedRouteMatrixVerificationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeSignedRouteMatrixVerificationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeSignedRouteMatrixVerificationContractは独自の失敗分岐を所有しない。
 * @invariant describeSignedRouteMatrixVerificationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeSignedRouteMatrixVerificationContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeSignedRouteMatrixVerificationContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeSignedRouteMatrixVerificationContractは共有非同期状態を持たない同期処理である。
 */
export function describeSignedRouteMatrixVerificationContract() {
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    routes: ROUTES,
    order: "cross_provider_first_then_same_provider_exceptions",
    stop: "first_nonretryable_nonconforming_route_or_third_safe_nonconforming_attempt",
    safeRetry:
      "maximum_three_attempts_per_route_only_for_exact_candidate_content_mismatch_after_exact_candidate_discard_and_exact_zero_residual_effect_reviewer_rejection_and_candidate_verification_failure_are_not_retried",
    initialConsent:
      "preserve_valid_consent_prompt_only_when_absent_then_require_exact_reuse",
    frontIdentityClaim:
      "requested_profile_only_observed_front_identity_not_attested",
    candidateDisposition: "each_route_exact_verify_then_discard",
    verificationFixture:
      "same_signed_tracked_base_marker_exact_token_replacement_for_every_route",
    boundedRemediation:
      "each_route_accepts_zero_or_one_runtime_owned_remediation_only_after_final_independent_approval",
    releaseIdentity:
      "all_attempts_same_manifest_package_version_sequence_commit_and_tree",
    executionIdentity:
      "all_attempts_same_work_repository_execution_commit_and_tree",
    failureClassification: Object.freeze([
      "arguments_invalid",
      "route_nonconforming",
      "release_identity_mismatch",
      "execution_identity_mismatch",
      "runner_exception",
      "process_restart_required",
    ]),
    unknownEffectProjection:
      "route_started_effect_or_restart_observation_unknown_irreversibly_poisons_shared_process_before_true_projection_without_claiming_observed_change_or_disclosure",
    canonicalRepositoryEffectAllowed: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
  });
}

/**
 * Signed Route Matrix Cli 失敗 結果を構築する。
 *
 * @responsibility Signed Route Matrix Cli 失敗 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input validationFailure: "arguments_invalid" | "runner_exception"
 * @returns createSignedRouteMatrixCliFailureResultの計算結果を返す。
 * @precondition 「validationFailure: "arguments_invalid" | "runner_exception"」がcreateSignedRouteMatrixCliFailureResultの入力契約を満たす。
 * @postcondition createSignedRouteMatrixCliFailureResultの責務を完了した結果だけを返す。
 * @effect N/A: createSignedRouteMatrixCliFailureResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSignedRouteMatrixCliFailureResultは独自の失敗分岐を所有しない。
 * @invariant createSignedRouteMatrixCliFailureResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSignedRouteMatrixCliFailureResultはProcess内の同一Subsystemで完結する。
 * @security N/A: createSignedRouteMatrixCliFailureResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createSignedRouteMatrixCliFailureResultは共有非同期状態を持たない同期処理である。
 */
export function createSignedRouteMatrixCliFailureResult(
  validationFailure: "arguments_invalid" | "runner_exception",
) {
  const isEffectStateUnknown = validationFailure === "runner_exception";
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason:
      validationFailure === "arguments_invalid"
        ? "signed_route_matrix_arguments_invalid"
        : "signed_route_matrix_failed_closed",
    requestedRoutes: ROUTES,
    attemptedRouteCount: 0,
    completedRouteCount: 0,
    retryableRouteAttemptCount: 0,
    failedRouteProfile: null,
    validationFailure,
    results: Object.freeze([]),
    cleanupConfirmed: !isEffectStateUnknown,
    manualRecoveryRequired: isEffectStateUnknown,
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown: isEffectStateUnknown,
    canonicalRepositoryChanged: isEffectStateUnknown ? null : false,
    rawProviderOutputReported: isEffectStateUnknown ? null : false,
    hostPathReported: isEffectStateUnknown ? null : false,
    credentialReported: isEffectStateUnknown ? null : false,
    ...emptyRouteRecovery(isEffectStateUnknown),
  });
}

/**
 * verify-signed-route-matrixのCommand処理を開始する。
 *
 * @responsibility verify-signed-route-matrixの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns mainの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了した結果だけを返す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: mainは独自の失敗分岐を所有しない。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  if (process.argv.length !== 2) {
    process.stdout.write(
      `${JSON.stringify(createSignedRouteMatrixCliFailureResult("arguments_invalid"), null, 2)}\n`,
    );
    process.exitCode = 64;
    return;
  }
  const outcome = await runRecordedVerification(
    "routes",
    process.cwd(),
    () =>
      runSignedRouteMatrixVerification(
        resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
      ),
    () => {
      ensureRuntimeProcessPoisoned();
      return createSignedRouteMatrixCliFailureResult("runner_exception");
    },
  );
  displayVerificationRecording(outcome);
  if (outcome.result !== null)
    process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
  process.exitCode = outcome.exitCode;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch {
    ensureRuntimeProcessPoisoned();
    process.stdout.write(
      `${JSON.stringify(createSignedRouteMatrixCliFailureResult("runner_exception"), null, 2)}\n`,
    );
    process.exitCode = 2;
  }
}
