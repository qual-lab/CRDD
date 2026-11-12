/**
 * CoordinatorのAI観測と最終判定をEIの記録へ接続する。
 * @responsibility 保存先・Contextを上位Ownerで確定し、開始・終了捕捉・最終保存と元境界の失敗診断を搬送する。
 * @trace ARCH-000004
 * @trace ARCH-000018
 * @boundary EI保存・診断を必須Recovery通知の失敗へ昇格せず、AIの実行許可・回復判断を持たない。
 */
import {
  ensureRepositoryRuntimeDataArea,
  observeRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
} from "../configuration/runtime-data.ts";
import { readExecutionIntelligenceConfig } from "../../../configuration-model/src/index.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../execution-model/src/index.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  createExecution,
  completeExecution,
  type StoreOptions,
  type ExecutionCompleteInput,
  type WriteResult,
  type Observation,
} from "../../../execution-intelligence/src/index.ts";
import { writeCoordinatorExecutionIntelligenceDiagnostic } from "./diagnostics.ts";

/** 読取りでは保存領域を初期化しない。設定・Root拒否を欠測と区別する。 */
export function getExecutionIntelligenceStore(
  repository: Repository,
  prepare: boolean,
): StoreOptions | null {
  const config = readExecutionIntelligenceConfig(repository);
  if (config.status !== "ready")
    throw Error("execution_intelligence_configuration_unavailable");
  const area = prepare
    ? requireReadyRepositoryRuntimeDataArea(
        ensureRepositoryRuntimeDataArea(repository, "execution-intelligence"),
        "execution_intelligence_directory_unavailable",
      )
    : observeRepositoryRuntimeDataArea(repository, "execution-intelligence");
  if (!area) throw Error("execution_intelligence_directory_unavailable");
  if (area.status === "not_observed") return null;
  if (area.status !== "ready") throw Error(area.reason);
  return {
    directory: area.directory,
    retentionDays: config.config.historyRetentionDays,
  };
}
/** 同じAI実行の開始と終了捕捉を一回の最終保存へ結ぶ短命な値。SessionやAuthorityは保持しない。 */
export type ProviderExecutionRecording = Readonly<{
  store: StoreOptions;
  executionId: string;
  startedMonotonicMs: number;
}> & {
  observation: Readonly<{
    endedAt: string;
    elapsedMs: Observation<number>;
    result: ProviderExecutionOutcome;
  }> | null;
  settlementAttempted: boolean;
};
type ProviderExecutionOutcome = Readonly<{
  status: string;
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired?: boolean;
  effectState?: unknown;
}>;

/** 任意記録の失敗を必須Recovery通知へ投げず、既存の受動診断に閉じる。 */
export function reportExecutionRecording(result: WriteResult) {
  try {
    if (result.status === "completed")
      writeCoordinatorExecutionIntelligenceDiagnostic({
        status: "completed",
        reason: result.reason,
        eventId: result.recordId,
        effectState: "settled",
        cleanupConfirmed: true,
        retryAllowed: false,
        manualRecoveryRequired: false,
        residualArtifactIds: [],
      });
    else
      writeCoordinatorExecutionIntelligenceDiagnostic({
        ...result,
        status: "blocked",
      });
  } catch {
    /* 診断失敗は実行結果を変更しない。 */
  }
}
/** 不明でも同じ記録IDを保持し、再送や実行停止のAuthorityへ変えない。 */
export function reportExecutionRecordingUnavailable(
  recordId: string,
  cause?: unknown,
): void {
  if (cause instanceof RepositoryRuntimeDataAreaBlockedError) {
    const observation = {
      status: "blocked" as const,
      reason: cause.reason,
      recordId,
      effectState: cause.effectStateUnknown
        ? ("unknown" as const)
        : cause.effectIssued
          ? ("settled" as const)
          : ("no_effect" as const),
      effectIssued: cause.effectIssued,
      effectStateUnknown: cause.effectStateUnknown,
      cleanupConfirmed: cause.cleanupConfirmed,
      retryAllowed: cause.retryAllowed,
      manualRecoveryRequired:
        cause.effectStateUnknown ||
        !cause.cleanupConfirmed ||
        cause.recoveryReference !== null,
      residualArtifactIds: [],
      recoveryReference: cause.recoveryReference,
    };
    try {
      writeCoordinatorExecutionIntelligenceDiagnostic(observation);
    } catch {
      /* 任意診断は実行を停止しない。 */
    }
    return;
  }
  reportExecutionRecording({
    status: "blocked",
    reason: "execution_intelligence_recording_unavailable",
    recordId,
    effectState: "unknown",
    effectIssued: false,
    effectStateUnknown: true,
    cleanupConfirmed: false,
    retryAllowed: false,
    manualRecoveryRequired: true,
    residualArtifactIds: [],
    recoveryReference: recordId,
  });
}
export function beginProviderExecutionRecording(
  repository: Repository,
  operationId: string,
  provider: string,
  metadata: Readonly<Record<string, string>> = {},
  selection?: Readonly<{ modelIdentifier: string; reasoningEffort?: string }>,
): ProviderExecutionRecording | null {
  const executionId = `execution-${operationId}`;
  try {
    const store = getExecutionIntelligenceStore(repository, true);
    if (!store) return null;
    const startedMonotonicMs = performance.now();
    const result = createExecution(store, {
      executionId,
      ...(metadata.groupId ? { groupId: metadata.groupId } : {}),
      application: "CRDD",
      operation: metadata.operation ?? "provider_execution",
      ...(metadata.role ? { role: metadata.role } : {}),
      ...(metadata.workType ? { workType: metadata.workType } : {}),
      startedAt: new Date().toISOString(),
      configuration: {
        ...(selection
          ? {
              model: {
                state: "observed" as const,
                value: selection.modelIdentifier,
                source: "executor_request_selection",
              },
            }
          : {}),
        ...(selection?.reasoningEffort
          ? {
              reasoningEffort: {
                state: "observed" as const,
                value: selection.reasoningEffort,
                source: "executor_request_selection",
              },
            }
          : {}),
        provider: {
          state: "observed",
          value: provider,
          source: "executor_request_selection",
        },
      },
      metadata: { ...metadata, operationId },
    });
    reportExecutionRecording(result);
    // 保存不明で自動再送せず、Execution IDは診断に保持する。
    return result.status === "completed"
      ? {
          store,
          executionId,
          startedMonotonicMs,
          observation: null,
          settlementAttempted: false,
        }
      : null;
  } catch (error) {
    reportExecutionRecordingUnavailable(executionId, error);
    return null;
  }
}
/** 下位AIの終了事実だけを固定し、上位清掃後まで保存確定を待つ。 */
export function captureProviderExecutionCompletion(
  recording: ProviderExecutionRecording | null,
  result: ProviderExecutionOutcome,
): void {
  if (
    !recording ||
    recording.observation !== null ||
    recording.settlementAttempted
  )
    return;
  try {
    const elapsed = performance.now() - recording.startedMonotonicMs;
    recording.observation = {
      endedAt: new Date().toISOString(),
      elapsedMs:
        Number.isFinite(elapsed) && elapsed >= 0
          ? {
              state: "observed",
              value: elapsed,
              source: "provider_submission_to_executor_completion",
            }
          : { state: "not_observed", reason: "monotonic_clock_invalid" },
      result: {
        status: result.status,
        reason: result.reason,
        cleanupConfirmed: result.cleanupConfirmed,
        manualRecoveryRequired: result.manualRecoveryRequired,
        ...(result.processRestartRequired !== undefined
          ? { processRestartRequired: result.processRestartRequired }
          : {}),
        ...(["no_effect", "settled", "unknown"].includes(
          result.effectState as string,
        )
          ? { effectState: result.effectState }
          : {}),
      },
    };
  } catch {
    reportExecutionRecordingUnavailable(recording.executionId);
  }
}
/** 一回だけ最終保存する。AI結果と上位Task結果を別の情報として保持する。 */
export function finishProviderExecutionRecording(
  recording: ProviderExecutionRecording | null,
  finalResult?: ProviderExecutionOutcome,
): void {
  if (!recording || recording.settlementAttempted) return;
  recording.settlementAttempted = true;
  const observation = recording.observation;
  if (!observation) {
    reportExecutionRecordingUnavailable(recording.executionId);
    return;
  }
  try {
    const result = observation.result;
    const status: ExecutionCompleteInput["outcome"]["status"] = [
      "completed",
      "failed",
      "blocked",
      "cancelled",
    ].includes(result.status)
      ? (result.status as "completed" | "failed" | "blocked" | "cancelled")
      : "unknown";
    const cleanupConfirmed =
      result.cleanupConfirmed && finalResult?.cleanupConfirmed === true;
    const manualRecoveryRequired =
      result.manualRecoveryRequired ||
      finalResult?.manualRecoveryRequired === true;
    const processRestartRequired =
      result.processRestartRequired === true ||
      finalResult?.processRestartRequired === true
        ? true
        : finalResult?.processRestartRequired === false
          ? false
          : null;
    reportExecutionRecording(
      completeExecution(recording.store, recording.executionId, {
        endedAt: observation.endedAt,
        elapsedMs: observation.elapsedMs,
        providerDurationMs: {
          state: "not_observed",
          reason: "provider_start_end_timing_not_exposed",
        },
        outcome: { status, reason: result.reason },
        diagnostic: {
          cleanupConfirmed,
          manualRecoveryRequired,
          processRestartRequired,
          providerCleanupConfirmed: result.cleanupConfirmed,
          taskCleanupConfirmed: finalResult?.cleanupConfirmed ?? null,
          providerManualRecoveryRequired: result.manualRecoveryRequired,
          taskManualRecoveryRequired:
            finalResult?.manualRecoveryRequired ?? null,
          effectState: ["no_effect", "settled", "unknown"].includes(
            finalResult?.effectState as string,
          )
            ? (finalResult?.effectState as string)
            : ["no_effect", "settled", "unknown"].includes(
                  result.effectState as string,
                )
              ? (result.effectState as string)
              : null,
          taskStatus: finalResult?.status ?? null,
          taskReason: finalResult?.reason ?? null,
        },
        retention:
          !cleanupConfirmed ||
          manualRecoveryRequired ||
          processRestartRequired !== false ||
          status === "unknown" ||
          finalResult?.status === "unknown" ||
          finalResult?.effectState === "unknown" ||
          result.effectState === "unknown"
            ? "unresolved"
            : "standard",
      }),
    );
  } catch {
    reportExecutionRecordingUnavailable(recording.executionId);
  }
}
