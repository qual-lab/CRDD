/**
 * 一試行（Attempt）の開始拒否と終端結果を組み立てる。
 * @packageDocumentation
 * @responsibility 状態遷移や保存を行わず、清掃条件と結果公開の共同条件を保持する。
 * @trace ARCH-000008
 * @boundary 一試行の実行Ownerが観測した値と上位へ返す技術結果。
 */
import type { ProviderAttemptPlan as PreparedPlan } from "../attempt/types.ts";
import type { AttemptResultReason } from "./types.ts";
import type { AttemptContent } from "./types.ts";

/**
 * Blocked Startを構築する。
 *
 * @responsibility Blocked Startの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、preEffectCleanupConfirmed、recoveryId: string | null、lowerManualRecoveryRequired
 * @returns createBlockedStartの計算結果を返す。
 * @precondition 「reason: string、preEffectCleanupConfirmed、recoveryId: string | null、lowerManualRecoveryRequired」がcreateBlockedStartの入力契約を満たす。
 * @postcondition createBlockedStartの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedStartは独自の失敗分岐を所有しない。
 * @invariant createBlockedStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createBlockedStartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedStartは共有非同期状態を持たない同期処理である。
 */
export function createBlockedStart(
  reason: string,
  preEffectCleanupConfirmed = false,
  recoveryId: string | null = null,
  lowerManualRecoveryRequired = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId,
    cleanupConfirmed: preEffectCleanupConfirmed,
    manualRecoveryRequired:
      lowerManualRecoveryRequired ||
      !preEffectCleanupConfirmed ||
      recoveryId !== null,
    dockerEffectStarted: false,
    providerRequestStarted: false,
    normalizedResult: null,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * Final 結果を構築する。
 *
 * @responsibility Final 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input status: "completed" | "blocked" | "cancelled"、reason: AttemptResultReason、plan: PreparedPlan、recoveryId: string、details: Readonly<{ providerRequestStarted: boolean; cancellationRequested: boolean; processTreeTerminationConfirmed: boolean; containersAbsent: boolean; networksAbsent: boolean; mountLeaseReleased: boolean; recoveryCompleted: boolean; resultSha256: string | null; resultBytes: number; normalizedResult: unknown | null; subscriptionAuthConfirmed: boolean; recoveryFinalizationCapability: object | null; }>
 * @returns createFinalResultの計算結果を返す。
 * @precondition 「status: "completed" | "blocked" | "cancelled"、reason: AttemptResultReason、plan: PreparedPlan、recoveryId: string、details: Readonly<{ providerRequestStarted: boolean; cancellationRequested: boolean; processTreeTerminationConfirmed: boolean; containersAbsent: boolean; networksAbsent: boolean; mountLeaseReleased: boolean; recoveryCompleted: boolean; resultSha256: string | null; resultBytes: number; normalizedResult: unknown | null; subscriptionAuthConfirmed: boolean; recoveryFinalizationCapability: object | null; }>」がcreateFinalResultの入力契約を満たす。
 * @postcondition createFinalResultの責務を完了した結果だけを返す。
 * @effect N/A: createFinalResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createFinalResultは独自の失敗分岐を所有しない。
 * @invariant createFinalResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createFinalResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createFinalResultは共有非同期状態を持たない同期処理である。
 */
export function createFinalResult(
  status: "completed" | "blocked" | "cancelled",
  reason: AttemptResultReason,
  plan: PreparedPlan,
  recoveryId: string,
  details: Readonly<{
    providerRequestStarted: boolean;
    cancellationRequested: boolean;
    processTreeTerminationConfirmed: boolean;
    containersAbsent: boolean;
    networksAbsent: boolean;
    mountLeaseReleased: boolean;
    recoveryCompleted: boolean;
    resultSha256: string | null;
    resultBytes: number;
    normalizedResult: AttemptContent | null;
    subscriptionAuthConfirmed: boolean;
    recoveryFinalizationCapability: object | null;
  }>,
) {
  const cleanupConfirmed =
    details.processTreeTerminationConfirmed &&
    details.containersAbsent &&
    details.networksAbsent &&
    details.mountLeaseReleased &&
    details.recoveryCompleted;
  return Object.freeze({
    status: cleanupConfirmed ? status : ("blocked" as const),
    reason: cleanupConfirmed
      ? reason
      : "docker_process_controller_cleanup_unconfirmed",
    operationId: plan.operationId,
    selectionRecordId: plan.selectionRecordId,
    recoveryId: cleanupConfirmed ? null : recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    dockerEffectStarted: true,
    providerRequestStarted: details.providerRequestStarted,
    cancellationRequested: details.cancellationRequested,
    processTreeTerminationConfirmed: details.processTreeTerminationConfirmed,
    containersAbsent: details.containersAbsent,
    networksAbsent: details.networksAbsent,
    mountLeaseReleased: details.mountLeaseReleased,
    recoveryCompleted: details.recoveryCompleted,
    cleanupConfirmed,
    resultSha256:
      cleanupConfirmed && status === "completed" ? details.resultSha256 : null,
    resultBytes:
      cleanupConfirmed && status === "completed" ? details.resultBytes : 0,
    normalizedResult:
      cleanupConfirmed && status === "completed"
        ? details.normalizedResult
        : null,
    subscriptionAuthConfirmed: details.subscriptionAuthConfirmed,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    recoveryFinalizationCapability: cleanupConfirmed
      ? details.recoveryFinalizationCapability
      : null,
  });
}
