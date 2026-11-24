/**
 * 検証ツールが読み戻すTask診断JSONを検査する。
 * @packageDocumentation
 * @responsibility 未信頼の診断だけを捕捉し、既存の診断組立てへ渡す。
 * @trace ERB-IT-021
 * @boundary 検証用のJSON受入。本番Sourceからは参照しない。
 */
import { inspectCodexExecutionObservation } from "../../../ai-adapter/tests/support/ai-adapter-test.ts";
import { isPrimaryFailureDiagnostic } from "../../../executor/tests/support/provider-diagnostic.ts";
import {
  createCandidateValidationFailureDiagnostic,
  createTaskStageDiagnostic,
  snapshotPlainRecord,
} from "../../src/lifecycle/validation.ts";

// 回復開始診断の検査は、生成するCoordinatorの正本を利用する。
export { inspectRecoveryStartFailureDiagnostic } from "../../src/lifecycle/validation.ts";

/**
 * Coordinatorが発行する境界終了通知の一次失敗投影を検査する。
 * @trace ERB-IT-021
 * @precondition 利用側がJSONと通知の外形を確認済みである。
 * @boundary 境界終了通知と下位の固定診断。通知内の既存診断を変換しない。
 */
export function hasValidSettlementFailure(event: Record<string, unknown>) {
  return (
    event.event === "coordinator_provider_boundary_settled" &&
    (!Object.hasOwn(event, "primaryFailure") ||
      isPrimaryFailureDiagnostic(event.primaryFailure))
  );
}

/**
 * 候補診断の未検査fieldを捕捉する。
 * @responsibility Provider観測の検査を型付き本番結果から分離する。
 * @trace ERB-IT-021
 * @input JSON由来の未知値。
 * @returns 組立て用の入力又はnull。
 * @precondition 実行許可やTask状態を変更しない。
 * @postcondition 未知fieldと動的値を受け付けない。
 * @effect N/A: 値検査だけ。
 * @failure 欠測・不正観測はnull。
 * @invariant 旧観測の欠測を補完しない。
 * @boundary 検証JSONと診断組立ての間。
 * @security 本文・Pathを診断に追加しない。
 * @concurrency N/A: 同期処理。
 */
function captureCandidateDiagnostic(raw: unknown) {
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
  if (!value) return null;
  const observation =
    value.providerExecutionObservation === null
      ? null
      : inspectCodexExecutionObservation(value.providerExecutionObservation);
  if (value.providerExecutionObservation !== null && !observation) return null;
  return {
    captureStatus: value.captureStatus,
    pathsMatch: value.pathsMatch,
    candidatePathCount: value.candidatePathCount,
    reportedPathCount: value.reportedPathCount,
    providerExecutionObservation: observation,
  };
}

/** 候補診断JSONのshape・観測・意味条件を順に確認する。
 * @responsibility 同Processの本番結果を再検査する入口にはしない。
 * @trace ERB-IT-021
 */
export function inspectCandidateValidationFailureDiagnostic(raw: unknown) {
  const value = captureCandidateDiagnostic(raw);
  return value ? createCandidateValidationFailureDiagnostic(value) : null;
}

/** Task段階の診断JSONを捕捉し、件数と判断の相関を既存Ownerへ委ねる。
 * @responsibility 不正JSONを型付き本番診断として扱わない。
 * @trace ERB-IT-021
 */
export function inspectTaskStageDiagnostic(raw: unknown) {
  const executor = snapshotPlainRecord(raw, new Set(["taskRole", "result"]));
  if (executor?.taskRole === "executor") {
    const value = captureCandidateDiagnostic(executor.result);
    return value
      ? createTaskStageDiagnostic({ taskRole: "executor", result: value })
      : null;
  }
  const reviewer = snapshotPlainRecord(
    raw,
    new Set(["taskRole", "decision", "findingCount", "categoryCounts"]),
  );
  return reviewer?.taskRole === "reviewer"
    ? createTaskStageDiagnostic({
        taskRole: "reviewer",
        decision: reviewer.decision,
        findingCount: reviewer.findingCount,
        categoryCounts: reviewer.categoryCounts,
      })
    : null;
}
