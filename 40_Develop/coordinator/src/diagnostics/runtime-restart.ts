/**
 * 回復対象の再起動要求を現在状態へ保存し、下位の固定操作へ委譲する。
 * @packageDocumentation
 * @responsibility 許可・Scope・保存だけを上位で所有し、OS・Desktop実処理を下位へ閉じる。
 * @trace ARCH-000008
 */
import {
  restartDockerRuntime,
  type DockerRuntimeRestartEvent,
} from "../../../docker-isolation/src/index.ts";
import {
  prepareRuntimeOwnedDockerRestart,
  verifyRuntimeOwnedDockerRestartPreparation,
  persistRuntimeOwnedDockerRestartCheckpoint,
  releaseRuntimeOwnedDockerRestartPreparation,
  finalizeRuntimeOwnedDockerRestartPreparation,
} from "../execution/recovery.ts";
import type { DockerRestartCheckpoint } from "../storage/restart-checkpoint.ts";

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
  let result: Awaited<ReturnType<typeof restartDockerRuntime>> | null = null;
  let failure: string | null = null;
  let checkpointInitialized = preparation.checkpointInitialized;
  let checkpoint: DockerRestartCheckpoint = Object.freeze({
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
  const save = (value: DockerRestartCheckpoint) => {
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
      result = await restartDockerRuntime({
        requestId: preparation.requestId,
        signal,
        verifyBoundary: () =>
          failure === null &&
          verifyRuntimeOwnedDockerRestartPreparation(context),
        beforeRequest: () => {
          if (!preparation.checkpointInitialized && !save(checkpoint))
            return false;
          return save(
            Object.freeze({
              ...checkpoint,
              request: "unknown",
              cleanup: "pending",
            }),
          );
        },
        onEvent: (event: DockerRuntimeRestartEvent) => {
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
      });
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
