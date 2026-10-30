/**
 * 検証ツールが読み戻すTask診断JSONを検査する。
 * @packageDocumentation
 * @responsibility 未信頼の診断だけを捕捉し、既存の診断組立てへ渡す。
 * @trace ERB-IT-021
 * @boundary 検証用のJSON受入。本番Sourceからは参照しない。
 */
import { snapshotPlainRecord } from "../../domain-model/src/index.ts";
import { inspectCodexExecutionObservation } from "../../ai-adapter/scripts/ai-adapter-test.ts";
import {
  createCandidateValidationFailureDiagnostic,
  createTaskStageDiagnostic,
} from "../src/execution/result.ts";

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
