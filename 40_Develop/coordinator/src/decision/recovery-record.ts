/**
 * 人間判断の未解決回復義務の値を検査する。
 *
 * @responsibility Identity、世代、判断状態と回復処置の値条件を所有し、保存や資源回復を発行しない。
 * @trace ARCH-000008
 */
import type { OrchestratorDecisionRecoveryIntent } from "./records.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
export { validIntent as validOrchestratorDecisionRecoveryIntent };

/**
 * Intentが有効か判定する。
 *
 * @responsibility Intentの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is OrchestratorDecisionRecoveryIntentを返す。
 * @precondition 「value: unknown」がvalidIntentの入力契約を満たす。
 * @postcondition validIntentの責務を完了した結果だけを返す。
 * @effect N/A: validIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIntentは独自の失敗分岐を所有しない。
 * @invariant validIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIntentは共有非同期状態を持たない同期処理である。
 */
function validIntent(
  value: unknown,
): value is OrchestratorDecisionRecoveryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as OrchestratorDecisionRecoveryIntent;
  return (
    [
      candidate.recoveryId,
      candidate.recordId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.queueId,
    ].every((entry) => typeof entry === "string" && ID.test(entry)) &&
    (candidate.applicationId === null || ID.test(candidate.applicationId)) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    candidate.expectedGeneration >= 1 &&
    (candidate.newGeneration === null ||
      (Number.isSafeInteger(candidate.newGeneration) &&
        candidate.newGeneration >= 2)) &&
    [
      "pending",
      "prepared",
      "finalized",
      "invalidated",
      "expired",
      "recovery_required",
      "unknown",
    ].includes(candidate.observedDisposition) &&
    typeof candidate.unknownBoundary === "string" &&
    ID.test(candidate.unknownBoundary) &&
    (candidate.disposition === "required" ||
      candidate.disposition === "settled")
  );
}
