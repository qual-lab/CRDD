/**
 * 一試行（Attempt）の開始成功・拒否と清掃後の終端結果を組み立てる。
 * @packageDocumentation
 * @responsibility 状態遷移や保存を行わず、清掃条件と結果公開の共同条件を保持する。
 * @trace ARCH-000008
 * @boundary 一試行の実行Ownerが観測した値と上位へ返す技術結果。
 */
import type {
  StartResultInput,
  StartResult,
  CompletionResultInput,
  CompletionResult,
} from "./types.ts";

/**
 * 一試行の開始成功・拒否を同じ入口で組み立てる。
 * @responsibility 結果の固定fieldと相関条件を所有し、Handle・Promiseを生成しない。
 * @trace ARCH-000008
 * @input 開始Ownerが確定した判別可能な入力と、準備・選択の既存補足値。
 * @returns 入力statusに対応する凍結結果。
 * @precondition 成功時のHandleとPromiseは同じ実行Ownerのものである。
 * @postcondition 拒否時は元回復参照と清掃不明の義務を保持し、成功時は同じPromiseを返す。
 * @effect N/A: 値の組立てと凍結のみ。
 * @failure 検査や起動の失敗判断は呼出しOwnerが確定する。
 * @invariant 開始成功をProvider実Process開始や清掃完了として扱わない。
 * @boundary 実行Ownerから利用側への開始結果。
 * @security 新しい実行許可を発行せず、回復参照を置換しない。
 * @concurrency 非同期処理を開始せず、Ownerが渡したPromiseを保持する。
 */
export function createStartResult(input: StartResultInput): StartResult {
  const result =
    input.status === "started"
      ? {
          ...(input.preparationFailed === undefined
            ? {}
            : { preparationFailed: input.preparationFailed }),
          status: "started" as const,
          reason: "docker_process_controller_started" as const,
          controlCapability: input.controlCapability,
          completion: input.completion,
          operationId: input.operationId,
          recoveryId: input.recoveryId,
          dockerEffectStarted: true as const,
          providerRequestStarted: false as const,
          rawOutputReported: false as const,
          untrustedProviderTextReported: false as const,
          credentialAbsenceVerified: false as const,
          normalizedResult: null,
          normalizedResultReportedAfterCleanupOnly: true as const,
          hostPathReported: false as const,
          proxyCredentialReported: false as const,
        }
      : {
          ...(input.preparationFailed === undefined
            ? {}
            : { preparationFailed: input.preparationFailed }),
          status: "blocked" as const,
          reason: input.reason,
          controlCapability: null,
          completion: null,
          operationId: null,
          recoveryId: input.recoveryId ?? null,
          cleanupConfirmed: input.cleanupConfirmed ?? false,
          manualRecoveryRequired:
            input.manualRecoveryRequired === true ||
            input.cleanupConfirmed !== true ||
            input.recoveryId != null,
          dockerEffectStarted: false as const,
          providerRequestStarted: false as const,
          normalizedResult: null,
          rawOutputReported: false as const,
          untrustedProviderTextReported: false as const,
          credentialAbsenceVerified: false as const,
          hostPathReported: false as const,
          proxyCredentialReported: false as const,
        };
  if (input.selection === undefined) return Object.freeze(result);
  return Object.freeze({
    ...result,
    selectionNotice: input.selection.notice,
    selectedModel: input.selection.model,
    selectedEffort: input.selection.effort,
  });
}

/**
 * 清掃後の一試行結果を組み立てる。
 * @responsibility 内容・観測・所見を公開できる共同条件を保持する。
 * @trace ARCH-000008
 * @input 終端状態、理由、操作IDと選定記録ID、元回復参照、実行Ownerの観測値。
 * @returns 明示されたCompletionResult契約を満たす凍結結果。
 * @precondition 内容と所見はAI Adapterの検査を通っている。
 * @postcondition 清掃不明・取消・失敗時は所見を返さず、是正許可を含めない。
 * @effect N/A: 結果の値だけを構築する。
 * @failure 清掃条件の欠測は既存の回復待ち結果へ閉じる。
 * @invariant 共有状態・保存・次試行の許可発行を所有しない。
 * @boundary 技術実行から信頼した上位への一時的な結果搬送。
 * @security 所見本文の保存・外部公開は上位が別に判断する。
 * @concurrency N/A: 同期の値構築のみ。
 */
export function createCompletionResult(
  input: CompletionResultInput,
): CompletionResult {
  const { status, reason, operationId, selectionRecordId, recoveryId } = input;
  const cleanupConfirmed =
    input.processTreeTerminationConfirmed &&
    input.containersAbsent &&
    input.networksAbsent &&
    input.mountLeaseReleased &&
    input.recoveryCompleted;
  return Object.freeze({
    status: cleanupConfirmed ? status : ("blocked" as const),
    reason: cleanupConfirmed
      ? reason
      : "docker_process_controller_cleanup_unconfirmed",
    operationId: operationId,
    selectionRecordId: selectionRecordId,
    recoveryId: cleanupConfirmed ? null : recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    dockerEffectStarted: true,
    providerRequestStarted: input.providerRequestStarted,
    cancellationRequested: input.cancellationRequested,
    processTreeTerminationConfirmed: input.processTreeTerminationConfirmed,
    containersAbsent: input.containersAbsent,
    networksAbsent: input.networksAbsent,
    mountLeaseReleased: input.mountLeaseReleased,
    recoveryCompleted: input.recoveryCompleted,
    cleanupConfirmed,
    resultSha256:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? input.resultSha256
        : null,
    resultBytes:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? input.resultBytes
        : 0,
    normalizedResult:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? input.normalizedResult
        : null,
    providerExecutionObservation:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? (input.providerExecutionObservation ?? null)
        : null,
    providerTurnObservation:
      cleanupConfirmed &&
      status === "completed" &&
      input.normalizedResult !== null
        ? (input.providerTurnObservation ?? null)
        : null,
    reviewFindings:
      cleanupConfirmed &&
      status === "completed" &&
      !input.cancellationRequested &&
      input.normalizedResult !== null &&
      "decision" in input.normalizedResult &&
      input.normalizedResult.decision === "changes_requested" &&
      input.reviewFindings?.length
        ? input.reviewFindings
        : null,
    subscriptionAuthConfirmed: input.subscriptionAuthConfirmed,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    recoveryFinalizationCapability: cleanupConfirmed
      ? input.recoveryFinalizationCapability
      : null,
  });
}
