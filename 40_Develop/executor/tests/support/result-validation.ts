/**
 * 試行結果の相関不変条件を反証する試験専用の検査を定義する。
 * @packageDocumentation
 * @responsibility 本番結果を再検査する試験Oracleを所有し、実行・保存・回復処置は行わない。
 * @trace ERB-IT-004
 * @level IT
 * @scope 合成結果と本番同等結果の値だけを扱う。
 * @boundary Executorの試験入口。本番Sourceから参照しない。
 */
import { types as utilTypes } from "node:util";
import { readOwnDataProperty } from "../../src/attempt/validation.ts";
import { isAttemptFailureReason } from "../../src/result/validation.ts";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";

function resolveRecoveryReference(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}

const BLOCKED_START_KEYS = Object.freeze([
  "cleanupConfirmed",
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "normalizedResult",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);

const STARTED_KEYS = Object.freeze([
  "completion",
  "controlCapability",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "normalizedResult",
  "normalizedResultReportedAfterCleanupOnly",
  "operationId",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryId",
  "status",
  "untrustedProviderTextReported",
]);

const COMPLETION_KEYS = Object.freeze([
  "providerExecutionObservation",
  "providerTurnObservation",
  "reviewFindings",
  "cancellationRequested",
  "cleanupConfirmed",
  "containersAbsent",
  "credentialAbsenceVerified",
  "dockerEffectStarted",
  "hostPathReported",
  "manualRecoveryRequired",
  "mountLeaseReleased",
  "homeLeaseReleased",
  "networksAbsent",
  "normalizedResult",
  "operationId",
  "processTreeTerminationConfirmed",
  "providerRequestStarted",
  "proxyCredentialReported",
  "rawOutputReported",
  "reason",
  "recoveryCompleted",
  "recoveryFinalizationCapability",
  "recoveryId",
  "resultBytes",
  "resultSha256",
  "status",
  "subscriptionAuthConfirmed",
  "untrustedProviderTextReported",
]);

/**
 * Plain 記録が完全一致するか判定する。
 *
 * @responsibility Plain 記録の比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedKeys: readonly string[]
 * @returns exactPlainRecordの計算結果を返す。
 * @precondition 「value: unknown、expectedKeys: readonly string[]」がexactPlainRecordの入力契約を満たす。
 * @postcondition exactPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: exactPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure exactPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security exactPlainRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactPlainRecordは共有非同期状態を持たない同期処理である。
 */
function exactPlainRecord(value: unknown, expectedKeys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  )
    return null;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== "string") ||
      (keys as string[]).sort().join("\0") !==
        [...expectedKeys].sort().join("\0")
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const entries: [string, unknown][] = [];
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      )
        return null;
      entries.push([key, descriptor.value]);
    }
    return Object.freeze(Object.fromEntries(entries));
  } catch {
    return null;
  }
}

/**
 * Producer-owned exact projection for the controller's synchronous result.
 *
 * @responsibility Docker Process Controller Start 結果の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、handedOffRecoveryId: unknown、expectedOperationId: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、handedOffRecoveryId: unknown、expectedOperationId: unknown」がprojectAttemptStartResultの入力契約を満たす。
 * @postcondition projectAttemptStartResultの責務を完了した結果だけを返す。
 * @effect N/A: projectAttemptStartResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectAttemptStartResultは独自の失敗分岐を所有しない。
 * @invariant projectAttemptStartResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectAttemptStartResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency projectAttemptStartResultは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function projectAttemptStartResult(
  value: unknown,
  handedOffRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const blockedRecord = exactPlainRecord(value, BLOCKED_START_KEYS);
  if (
    blockedRecord &&
    readOwnDataProperty(blockedRecord, "status") === "blocked"
  ) {
    const record = blockedRecord;
    const rawRecoveryId = readOwnDataProperty(record, "recoveryId");
    const recoveryId =
      rawRecoveryId === null ? null : resolveRecoveryReference(rawRecoveryId);
    const cleanupConfirmed = readOwnDataProperty(record, "cleanupConfirmed");
    const manualRecoveryRequired = readOwnDataProperty(
      record,
      "manualRecoveryRequired",
    );
    return record &&
      typeof readOwnDataProperty(record, "reason") === "string" &&
      readOwnDataProperty(record, "controlCapability") === null &&
      readOwnDataProperty(record, "completion") === null &&
      readOwnDataProperty(record, "operationId") === null &&
      typeof cleanupConfirmed === "boolean" &&
      typeof manualRecoveryRequired === "boolean" &&
      (cleanupConfirmed === true || manualRecoveryRequired === true) &&
      (recoveryId === null || manualRecoveryRequired === true) &&
      readOwnDataProperty(record, "dockerEffectStarted") === false &&
      readOwnDataProperty(record, "providerRequestStarted") === false &&
      readOwnDataProperty(record, "normalizedResult") === null &&
      readOwnDataProperty(record, "rawOutputReported") === false &&
      readOwnDataProperty(record, "untrustedProviderTextReported") === false &&
      readOwnDataProperty(record, "credentialAbsenceVerified") === false &&
      readOwnDataProperty(record, "hostPathReported") === false &&
      readOwnDataProperty(record, "proxyCredentialReported") === false &&
      recoveryId === rawRecoveryId
      ? Object.freeze({ ...record, recoveryId })
      : null;
  }
  const record = exactPlainRecord(value, STARTED_KEYS);
  const status = readOwnDataProperty(record, "status");
  const recoveryId = resolveRecoveryReference(
    readOwnDataProperty(record, "recoveryId"),
  );
  return record &&
    status === "started" &&
    typeof readOwnDataProperty(record, "reason") === "string" &&
    typeof readOwnDataProperty(record, "operationId") === "string" &&
    (expectedOperationId === undefined ||
      readOwnDataProperty(record, "operationId") === expectedOperationId) &&
    readOwnDataProperty(record, "controlCapability") !== null &&
    typeof readOwnDataProperty(record, "controlCapability") === "object" &&
    readOwnDataProperty(record, "completion") instanceof Promise &&
    readOwnDataProperty(record, "dockerEffectStarted") === true &&
    readOwnDataProperty(record, "providerRequestStarted") === false &&
    readOwnDataProperty(record, "normalizedResult") === null &&
    readOwnDataProperty(record, "normalizedResultReportedAfterCleanupOnly") ===
      true &&
    readOwnDataProperty(record, "rawOutputReported") === false &&
    readOwnDataProperty(record, "untrustedProviderTextReported") === false &&
    readOwnDataProperty(record, "credentialAbsenceVerified") === false &&
    readOwnDataProperty(record, "hostPathReported") === false &&
    readOwnDataProperty(record, "proxyCredentialReported") === false &&
    recoveryId !== null &&
    recoveryId === handedOffRecoveryId
    ? Object.freeze({ ...record, recoveryId })
    : null;
}

/**
 * Producer-owned exact projection for the controller's asynchronous result.
 *
 * @responsibility Docker Process Controller Completion 結果の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedRecoveryId: unknown、expectedOperationId: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedRecoveryId: unknown、expectedOperationId: unknown」がprojectAttemptResultの入力契約を満たす。
 * @postcondition projectAttemptResultの責務を完了した結果だけを返す。
 * @effect N/A: projectAttemptResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectAttemptResultは独自の失敗分岐を所有しない。
 * @invariant projectAttemptResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security projectAttemptResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectAttemptResultは共有非同期状態を持たない同期処理である。
 */
export function projectAttemptResult(
  value: unknown,
  expectedRecoveryId: unknown,
  expectedOperationId?: unknown,
): Readonly<Record<string, unknown>> | null {
  const record = exactPlainRecord(value, COMPLETION_KEYS);
  if (!record) return null;
  const status = readOwnDataProperty(record, "status");
  const cleanupConfirmed = readOwnDataProperty(record, "cleanupConfirmed");
  const manualRecoveryRequired = readOwnDataProperty(
    record,
    "manualRecoveryRequired",
  );
  const rawRecoveryId = readOwnDataProperty(record, "recoveryId");
  const recoveryId =
    rawRecoveryId === null ? null : resolveRecoveryReference(rawRecoveryId);
  const expected = resolveRecoveryReference(expectedRecoveryId);
  const processTreeTerminated = readOwnDataProperty(
    record,
    "processTreeTerminationConfirmed",
  );
  const containersAbsent = readOwnDataProperty(record, "containersAbsent");
  const networksAbsent = readOwnDataProperty(record, "networksAbsent");
  const mountLeaseReleased = readOwnDataProperty(record, "mountLeaseReleased");
  const homeLeaseReleased = readOwnDataProperty(record, "homeLeaseReleased");
  const recoveryCompleted = readOwnDataProperty(record, "recoveryCompleted");
  const isCleanupFromResources =
    processTreeTerminated === true &&
    containersAbsent === true &&
    networksAbsent === true &&
    mountLeaseReleased === true &&
    homeLeaseReleased === true;
  const providerRequestStarted = readOwnDataProperty(
    record,
    "providerRequestStarted",
  );
  const cancellationRequested = readOwnDataProperty(
    record,
    "cancellationRequested",
  );
  const normalizedResult = readOwnDataProperty(record, "normalizedResult");
  const resultSha256 = readOwnDataProperty(record, "resultSha256");
  const resultBytes = readOwnDataProperty(record, "resultBytes");
  const subscriptionAuthConfirmed = readOwnDataProperty(
    record,
    "subscriptionAuthConfirmed",
  );
  const recoveryFinalizationCapability = readOwnDataProperty(
    record,
    "recoveryFinalizationCapability",
  );
  const reason = readOwnDataProperty(record, "reason");
  if (
    (status !== "completed" &&
      status !== "blocked" &&
      status !== "cancelled") ||
    typeof reason !== "string" ||
    typeof cleanupConfirmed !== "boolean" ||
    typeof manualRecoveryRequired !== "boolean" ||
    typeof readOwnDataProperty(record, "operationId") !== "string" ||
    (expectedOperationId !== undefined &&
      readOwnDataProperty(record, "operationId") !== expectedOperationId) ||
    readOwnDataProperty(record, "dockerEffectStarted") !== true ||
    typeof providerRequestStarted !== "boolean" ||
    typeof cancellationRequested !== "boolean" ||
    typeof processTreeTerminated !== "boolean" ||
    typeof containersAbsent !== "boolean" ||
    typeof networksAbsent !== "boolean" ||
    typeof mountLeaseReleased !== "boolean" ||
    typeof homeLeaseReleased !== "boolean" ||
    typeof recoveryCompleted !== "boolean" ||
    cleanupConfirmed !== isCleanupFromResources ||
    !Number.isSafeInteger(resultBytes) ||
    (resultBytes as number) < 0 ||
    (resultSha256 !== null &&
      (typeof resultSha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(resultSha256))) ||
    (recoveryFinalizationCapability !== null &&
      typeof recoveryFinalizationCapability !== "object") ||
    typeof subscriptionAuthConfirmed !== "boolean" ||
    readOwnDataProperty(record, "rawOutputReported") !== false ||
    readOwnDataProperty(record, "untrustedProviderTextReported") !== false ||
    readOwnDataProperty(record, "credentialAbsenceVerified") !== false ||
    readOwnDataProperty(record, "hostPathReported") !== false ||
    readOwnDataProperty(record, "proxyCredentialReported") !== false ||
    !expected ||
    (cleanupConfirmed === true && recoveryCompleted === true
      ? recoveryId !== null || manualRecoveryRequired !== false
      : recoveryId !== expected || manualRecoveryRequired !== true) ||
    (cleanupConfirmed !== true &&
      (status !== "blocked" ||
        reason !== "docker_process_controller_cleanup_unconfirmed" ||
        normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0 ||
        recoveryFinalizationCapability !== null)) ||
    (cleanupConfirmed === true &&
      recoveryCompleted === true &&
      (recoveryFinalizationCapability === null ||
        typeof recoveryFinalizationCapability !== "object")) ||
    (recoveryCompleted !== true && recoveryFinalizationCapability !== null) ||
    (status === "completed"
      ? reason !== "provider_operation_completed" ||
        providerRequestStarted !== true ||
        cancellationRequested !== false ||
        subscriptionAuthConfirmed !== true ||
        normalizedResult === null ||
        typeof normalizedResult !== "object" ||
        typeof resultSha256 !== "string" ||
        resultBytes === 0
      : normalizedResult !== null ||
        resultSha256 !== null ||
        resultBytes !== 0) ||
    (status === "cancelled" &&
      (reason !== "provider_operation_cancelled" ||
        cancellationRequested !== true)) ||
    (status === "blocked" &&
      cleanupConfirmed === true &&
      !isAttemptFailureReason(reason))
  )
    return null;
  return Object.freeze({ ...record, recoveryId });
}
