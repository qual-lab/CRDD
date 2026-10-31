/**
 * 一回のProvider試行の技術準備・開始・取消・終了待ちを所有する。
 * @packageDocumentation
 * @responsibility Taskの順序・保存を持たず、単段の資源終端と結果を相関する。
 * @trace ARCH-000008
 */
import { randomBytes } from "node:crypto";
import {
  parseAdviceReferences,
  describeProviderAuthentication,
  evaluateProviderAuthentication,
  type TaskReviewFinding,
} from "../../../ai-adapter/src/index.ts";
import {
  describeDockerProviderAssets,
  describeDockerProxyTopology,
  createDockerIsolationRandomHex,
  createDockerIsolationResourceNames,
  planDockerIsolationCommands,
  type DockerIsolationCommand,
  createDockerIsolationRuntime,
  type DockerIsolationRuntimeOptions,
  type DockerExecutionCallbacks,
  type CommandObservation,
  classifyDockerCommandException,
  type DockerSessionCleanup,
  type HomeLease,
  type DockerProcessExitStatusClass,
  parseDockerTaskRecoveryId,
} from "../../../docker-isolation/src/index.ts";
import {
  isAttemptFailureReason,
  readOwnDataProperty,
  parseModelSelection,
  isAttemptPlanValid,
} from "./validation.ts";
import {
  createStartResult,
  convertCommandResult,
  parseAttemptOutput,
  createCompletionResult,
  createConfigurationNotice,
} from "./result.ts";
import {
  resolveProviderExecution,
  resolveIsolationCommandInput,
  bindIsolationRuntime,
  releaseAttemptHomeLease,
} from "./isolation.ts";
import type {
  AttemptResultReason,
  Executor,
  CompletionResult,
  PrimaryFailureDiagnostic,
  AttemptContent,
  AttemptRequest,
  AttemptPlan,
  AttemptRecordProjection,
  ExecutorCallbacks,
  AttemptReference,
  RuntimeState,
  IsolationRuntime,
  ExecutionRecord,
} from "./types.ts";

/**
 * 一試行の実行・通知・資源回収を完了まで管理する。
 *
 * @responsibility Planの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: 固定隔離と通知。record: 同じHome・Control。plan: 内部技術構成。recovery: 上位からの借用相関。
 * @returns 通知をjoinし、技術清掃と内容受理を照合した一つのCompletionResult。
 * @precondition 上位の保存確定後に、同じ試行の技術Home排他を取得済み。
 * @postcondition executeAttemptの責務を完了した結果だけを返す。
 * @effect Docker Isolation経由で一試行を実行し、通知と所有資源の回収を行う。
 * @failure executeAttemptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant Taskの計画・保存判断は持たず、取消と回収を同じ試行へ相関する。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security executeAttemptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executeAttemptは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeAttempt(
  state: RuntimeState,
  record: ExecutionRecord,
  plan: AttemptPlan,
  recovery: AttemptReference,
) {
  let reason: AttemptResultReason = "provider_operation_completed";
  let requestedStatus: "completed" | "blocked" | "cancelled" = "completed";
  let providerRequestStarted = false;
  let resultSha256: string | null = null;
  let resultBytes = 0;
  let normalizedResult: AttemptContent | null = null;
  let providerExecutionObservation: CompletionResult["providerExecutionObservation"] =
    null;
  let providerTurnObservation: Readonly<Record<string, unknown>> | null = null;
  let reviewFindings: readonly TaskReviewFinding[] | null = null;
  let isSubscriptionAuthConfirmed = false;
  let wasProviderContainerCreationObserved = false;
  let wasProviderProcessCompletionObserved = false;
  let providerExitStatusClass: DockerProcessExitStatusClass = "not_observed";
  let diagnosticPurpose: string | null = null;
  let diagnosticStage: PrimaryFailureDiagnostic["stage"] = "submission_record";
  let hasCommandHandle = false;
  let hasResponseObservation = false;
  let receiptRecorded = false;
  let commandObservation: PrimaryFailureDiagnostic["commandObservation"] = null;
  let authenticationStatus: PrimaryFailureDiagnostic["authenticationStatus"];
  let turnCountDiagnostic: PrimaryFailureDiagnostic["turnCountDiagnostic"];
  let primaryFailure: PrimaryFailureDiagnostic | null = null;
  let startNotification: Promise<void> | null = null;
  let startNotificationAccepted = false;
  let providerOutput: CommandObservation | null = null;
  let lastStdoutBytes = 0;
  let cleanup: DockerSessionCleanup = Object.freeze({
    confirmed: false,
    processTreeTerminated: false,
    containersAbsent: false,
    networksAbsent: false,
  });
  let verifiedResourceObservations: DockerSessionCleanup["resourceObservations"] =
    null;
  let processTreeTerminationConfirmed = false;
  let sessionStarted = false;

  /**
   * 最初の上位失敗を元段階で固定する。
   * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
   * @trace ARCH-000008
   * @input next: 固定公開理由。
   * @returns N/A: 私有状態だけを更新する。
   * @precondition 同じ操作の検証済み計画とOwnerを使用する。
   * @postcondition raw HandleやOS手順を所有しない。
   * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
   * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
   * @invariant 新Authority・Store・回復管理を作らない。
   * @boundary 上位の意味と下位の技術実行。
   * @security 生出力・秘密値を公開通知へ複製しない。
   * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
   */
  function reject(next: AttemptResultReason) {
    if (requestedStatus !== "blocked") {
      requestedStatus = "blocked";
      reason = next;
    }
    primaryFailure ??= Object.freeze({
      purpose: diagnosticPurpose,
      stage: diagnosticStage,
      reason: next,
      exceptionCode: null,
      commandHandleObtained: hasCommandHandle,
      responseObserved: hasResponseObservation,
      receiptRecorded,
      commandObservation,
      ...(authenticationStatus === undefined ? {} : { authenticationStatus }),
      ...(turnCountDiagnostic === undefined ? {} : { turnCountDiagnostic }),
    });
    return false;
  }

  /** 内容受理は開始通知の成功後だけ行い、技術回収は通知待ちに従属させない。 */
  function acceptProviderOutput(execution: CommandObservation): boolean {
    diagnosticStage = "provider_result_normalization";
    const output = parseAttemptOutput(plan, execution, lastStdoutBytes);
    const providerResult = output.result;
    if (providerResult.status !== "confirmed") {
      if ("turnCountDiagnostic" in providerResult)
        turnCountDiagnostic = providerResult.turnCountDiagnostic;
      return reject(
        "reason" in providerResult &&
          isAttemptFailureReason(providerResult.reason)
          ? providerResult.reason
          : "provider_result_invalid",
      );
    }
    normalizedResult = providerResult.normalizedResult;
    providerExecutionObservation =
      "providerExecutionObservation" in providerResult
        ? (providerResult.providerExecutionObservation ?? null)
        : null;
    providerTurnObservation =
      "providerTurnObservation" in providerResult
        ? (providerResult.providerTurnObservation ?? null)
        : null;
    reviewFindings =
      "reviewFindings" in providerResult &&
      Array.isArray(providerResult.reviewFindings)
        ? (providerResult.reviewFindings as readonly TaskReviewFinding[])
        : null;
    resultBytes = output.resultBytes;
    resultSha256 = output.resultSha256;
    return true;
  }

  const hooks: DockerExecutionCallbacks = {
    /**
     * 次コマンドの診断を初期化する。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns N/A: 通知の完了だけを返す。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onCommandSubmitting: async (purpose) => {
      diagnosticPurpose = purpose;
      diagnosticStage = "command_restriction";
      hasCommandHandle = false;
      hasResponseObservation = false;
      receiptRecorded = false;
      commandObservation = null;
      authenticationStatus = undefined;
      turnCountDiagnostic = undefined;
      diagnosticStage = "submission_record";
      try {
        await state.callbacks.onCommandSubmitting?.(purpose);
      } catch {
        reject("docker_resource_submission_record_unavailable");
        throw new Error("docker_resource_submission_record_unavailable");
      }
    },
    /**
     * 予定保存後の未発行取消を記録する。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns N/A: 通知の完了だけを返す。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onCommandNotIssued: async (purpose) => {
      try {
        await state.callbacks.onCommandNotIssued?.(purpose);
      } catch {
        reject("docker_resource_submission_record_unavailable");
        throw new Error("docker_resource_submission_record_unavailable");
      }
    },
    /**
     * AI本体の要求予定を利用側へ通知する。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input N/A: 元計画を使用する。
     * @returns N/A: 通知の完了だけを返す。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onExecutionSubmitting: async () => {
      diagnosticStage = "submission_record";
      try {
        await state.callbacks.onProviderSubmitting?.();
      } catch {
        reject("docker_resource_submission_record_unavailable");
        throw new Error("docker_resource_submission_record_unavailable");
      }
    },
    /**
     * Docker Isolationが検証・保持した元の資源IDだけを通知する。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input purpose: 固定用途。stdout: 下位の元応答。
     * @returns N/A: 通知の完了だけを返す。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onResourceCreated: async (purpose, dockerId) => {
      diagnosticStage = "resource_receipt_record";
      receiptRecorded = true;
      try {
        await state.callbacks.onResourceCreated?.(purpose, dockerId);
      } catch {
        reject("docker_resource_receipt_unavailable");
        throw new Error("docker_resource_receipt_unavailable");
      }
    },
    /**
     * 技術完了を既存の公開失敗分類へ接続する。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input purpose、execution、classification: 同じ下位観測。
     * @returns N/A: 通知の完了だけを返す。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onCommandObserved: (purpose, execution, classification) => {
      diagnosticStage = "execution_classification";
      hasCommandHandle = true;
      hasResponseObservation = execution !== null;
      commandObservation =
        execution === null
          ? null
          : Object.freeze({
              exitCode: execution.status,
              stdoutBytes: Buffer.byteLength(execution.stdout, "utf8"),
              stderrBytes: Buffer.byteLength(execution.stderr, "utf8"),
            });
      if (
        purpose === "start_subscription_auth_probe_attached" &&
        execution !== null &&
        execution.status !== null &&
        (classification.category === "completed" ||
          classification.category === "nonzero_exit")
      )
        authenticationStatus = evaluateProviderAuthentication(
          plan.provider,
          plan.subscriptionOffering,
          execution.stdout,
          execution.stderr,
        ).status;
      const classified = convertCommandResult(
        execution,
        purpose,
        plan.provider,
        classification,
      );
      lastStdoutBytes =
        "stdoutBytes" in classification ? classification.stdoutBytes : 0;
      if (!classified.ok) {
        reject(classified.reason);
        throw new Error(classified.reason);
      }
    },
    /**
     * 認証とAI結果の意味を上位で受理する。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input purpose: 固定用途。execution: 元の完了観測。
     * @returns N/A: 通知の完了だけを返す。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onCommandCompleted: (purpose, execution) => {
      if (purpose === "start_subscription_auth_probe_attached") {
        diagnosticStage = "subscription_auth_verification";
        if (authenticationStatus !== "confirmed") {
          reject("provider_subscription_auth_not_confirmed");
          throw new Error("provider_subscription_auth_not_confirmed");
        }
        isSubscriptionAuthConfirmed = true;
      }
      if (purpose === "start_provider_attached") {
        if (startNotificationAccepted) {
          if (!acceptProviderOutput(execution)) throw new Error(reason);
        } else providerOutput = execution;
      }
    },
    /**
     * 下位の開始factから上位確認を開始する。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input N/A: 元操作の開始fact。
     * @returns N/A: Promiseを下位へ返さない。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onExecutionStarted: () => {
      providerRequestStarted = true;
      hasCommandHandle = true;
      startNotification = (async () => {
        try {
          await state.callbacks.onStarted?.(
            Object.freeze({
              event: "coordinator_provider_process_started",
              taskRole: plan.taskRole,
              provider: plan.provider,
              operationId: plan.operationId,
            }),
          );
          startNotificationAccepted = true;
        } catch {
          diagnosticStage = "provider_start_observation";
          reject("docker_process_controller_provider_start_observation_failed");
          record.cancellationRequested = true;
          await record.cancelExecution?.();
        }
      })();
    },
    /**
     * 下位の一次停止点を清掃前に受け取る。
     * @responsibility 一試行の技術観測を通知し、上位の保存形式・Task判断を扱わない。
     * @trace ARCH-000008
     * @input failure: 元の固定技術停止点。
     * @returns N/A: 同期の値保存だけ。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 登録済みの通知と同じ試行の技術処理だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 取消を通知待ち中も保持し、技術回収と通知の終了待ちを区別する。
     */
    onFailure: (failure) => {
      if (primaryFailure !== null) return;
      diagnosticPurpose = failure.purpose;
      if (failure.stage !== "gate") diagnosticStage = failure.stage;
      if (failure.gate === "onResourceCreated")
        diagnosticStage = "resource_receipt_record";
      hasCommandHandle = failure.commandHandleObtained;
      hasResponseObservation = failure.responseObserved;
      const next =
        failure.kind === "start_unconfirmed"
          ? "docker_process_controller_provider_start_failed"
          : failure.gate === "onResourceCreated"
            ? "docker_resource_receipt_unavailable"
            : failure.gate === "onExecutionStarted"
              ? "docker_process_controller_provider_start_observation_failed"
              : "docker_process_controller_execution_failed_closed";
      reject(next);
      const latched = primaryFailure as PrimaryFailureDiagnostic | null;
      if (latched)
        primaryFailure = Object.freeze({
          ...latched,
          exceptionCode: failure.exceptionCode,
        });
    },
  };

  try {
    const pending = state.callbacks.onDiagnostic?.(
      createConfigurationNotice(plan),
    );
    if (pending) void pending.catch(() => {});
  } catch {
    // 任意診断の失敗は実行結果・回収条件を変更しない。
  }
  try {
    if (!state.isolation.startExecution)
      throw new Error("docker_process_controller_execution_unavailable");
    const session = state.isolation.startExecution(
      plan,
      recovery.recoveryCapability,
      record.managementCapability,
      hooks,
    );
    sessionStarted = true;
    record.cancelExecution = session.cancel;
    if (record.cancellationRequested) void session.cancel();
    const outcome = await session.completion;
    providerRequestStarted = outcome.executionStarted;
    wasProviderContainerCreationObserved = outcome.executionContainerCreated;
    wasProviderProcessCompletionObserved = outcome.executionCompleted;
    providerExitStatusClass = outcome.executionExit;
    cleanup = outcome.cleanup;
    verifiedResourceObservations = outcome.resourceObservations;
    processTreeTerminationConfirmed = outcome.processTreeTerminationConfirmed;
    if (outcome.failure && primaryFailure === null)
      hooks.onFailure?.(outcome.failure);
  } catch (error) {
    if (primaryFailure === null) {
      reject("docker_process_controller_execution_failed_closed");
      const latched = primaryFailure as PrimaryFailureDiagnostic | null;
      if (latched)
        primaryFailure = Object.freeze({
          ...latched,
          exceptionCode: classifyDockerCommandException(error),
        });
    }
    if (!sessionStarted) {
      try {
        cleanup = await state.isolation.cleanupOwnedResources(
          plan,
          recovery.recoveryCapability,
          record.managementCapability,
        );
      } catch {}
      try {
        verifiedResourceObservations = state.isolation.verifyCleanupOutcome
          ? state.isolation.verifyCleanupOutcome(
              cleanup,
              plan,
              recovery.recoveryCapability,
              record.managementCapability,
            )
          : cleanup.resourceObservations;
      } catch {
        verifiedResourceObservations = null;
      }
      processTreeTerminationConfirmed =
        cleanup.confirmed &&
        cleanup.processTreeTerminated &&
        (!state.isolation.verifyCleanupOutcome ||
          verifiedResourceObservations != null);
    }
  }
  await startNotification;
  if (!primaryFailure && !record.cancellationRequested && providerOutput) {
    acceptProviderOutput(providerOutput);
  }
  providerOutput = null;
  const observation = Object.freeze({
    operationId: plan.operationId,
    recoveryId: recovery.recoveryId,
    resources: verifiedResourceObservations ?? null,
    primaryFailure,
    processTreeTerminationConfirmed,
    containersAbsent: cleanup.containersAbsent,
    networksAbsent: cleanup.networksAbsent,
    homeLeaseReleased: false,
  });
  const resourcesClosed =
    processTreeTerminationConfirmed &&
    cleanup.containersAbsent &&
    cleanup.networksAbsent;
  if (resourcesClosed) {
    try {
      await state.callbacks.onResourcesClosed?.(observation);
    } catch {
      reject("docker_process_controller_execution_failed_closed");
    }
  }
  record.homeLeaseReleaseAttempted = resourcesClosed;
  const homeLeaseReleased =
    resourcesClosed && releaseAttemptHomeLease(record.homeLease);
  record.homeLeaseReleased = homeLeaseReleased;
  const completedObservation = Object.freeze({
    ...observation,
    homeLeaseReleased,
  });
  try {
    await state.callbacks.onCleanupCompleted?.(completedObservation);
  } catch {
    reject("docker_process_controller_execution_failed_closed");
  }
  // Cancellation remains live through cleanup. Re-settle after the final await
  // so a request received during cleanup cannot be published as completed.
  // A failure that already settled as blocked keeps the more specific failure;
  // cancellationRequested remains observable without erasing that diagnosis.
  if (record.cancellationRequested && requestedStatus === "completed") {
    requestedStatus = "cancelled";
    reason = "provider_operation_cancelled";
    resultSha256 = null;
    resultBytes = 0;
    normalizedResult = null;
  }
  try {
    const pending = state.callbacks.onDiagnostic?.(
      Object.freeze({
        event: "coordinator_provider_boundary_settled" as const,
        primaryFailure,
        recoveryId: recovery.recoveryId,
        taskRole: plan.taskRole,
        provider: plan.provider,
        operationId: plan.operationId,
        providerContainerCreatedObserved: wasProviderContainerCreationObserved,
        providerProcessStartedObserved: providerRequestStarted,
        providerProcessCompletionObserved: wasProviderProcessCompletionObserved,
        providerProcessExitStatusClass: providerExitStatusClass,
        processTreeTerminationObserved: processTreeTerminationConfirmed,
        containersAbsentObserved: cleanup.containersAbsent,
        networksAbsentObserved: cleanup.networksAbsent,
        cleanupConfirmed:
          processTreeTerminationConfirmed &&
          cleanup.containersAbsent &&
          cleanup.networksAbsent &&
          homeLeaseReleased,
      }),
    );
    if (pending) void pending.catch(() => {});
  } catch {
    // 任意診断の失敗は確認済みの終了・回収結果を変更しない。
  }
  const finalResult = createCompletionResult({
    status: requestedStatus,
    reason,
    operationId: plan.operationId,
    recoveryId: recovery.recoveryId,
    providerRequestStarted,
    cancellationRequested: record.cancellationRequested,
    processTreeTerminationConfirmed,
    containersAbsent: cleanup.containersAbsent,
    networksAbsent: cleanup.networksAbsent,
    homeLeaseReleased,
    resultSha256,
    resultBytes,
    normalizedResult,
    reviewFindings,
    providerExecutionObservation,
    providerTurnObservation,
    subscriptionAuthConfirmed: isSubscriptionAuthConfirmed,
  });
  try {
    const pending = state.callbacks.onCompleted?.(
      finalResult,
      completedObservation,
    );
    if (pending) void pending.catch(() => {});
  } catch {
    /* 任意の最終通知は確定済みの結果を変更しない。 */
  }

  return finalResult;
}

/**
 * 上位確定済みの参照へ単段実行を結合し、Home技術排他を取得する。
 * @responsibility 技術Plan・Home相関を確認し同じControlへ取消と終了を結合する。
 * @trace ARCH-000008
 * @input 同じ試行の技術Plan、管理参照、確定済み追跡参照と通知接続。
 * @returns 開始済みの同じcompletion、又は元回復IDを保持した未開始結果。
 * @precondition 選定・業務許可・記録確定は呼出し側が実施している。
 * @postcondition Home取得不能を解放済み又はAI開始済みにしない。
 * @effect Home排他取得後、既存のDocker実行へ委譲する。
 * @failure 入力不一致・取得不明は新規Effect前に拒否する。
 * @invariant 保存・Task判断・新しい回復IDを生成しない。
 * @boundary 上位の確定入力と単発実行の技術生涯。
 * @security 業務権限を発行せず、元Controlと管理参照の所属を維持する。
 * @concurrency 同じControlだけが取消とcompletionを共有する。
 */
export function start(
  state: RuntimeState,
  plan: AttemptPlan,
  managementCapability: unknown,
  recovery: AttemptReference,
) {
  const id = parseDockerTaskRecoveryId(
    readOwnDataProperty(recovery, "recoveryId"),
  );
  const capability = readOwnDataProperty(recovery, "recoveryCapability");
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !plan ||
    !isAttemptPlanValid(plan) ||
    !id ||
    id.stableLogicalHomeBindingHash !== plan.stableLogicalHomeBindingHash ||
    !capability ||
    typeof capability !== "object"
  )
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_plan_invalid",
      recoveryId: id?.token ?? null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  const reference = Object.freeze({
    recoveryId: id.token,
    recoveryCapability: capability,
  });
  let homeLease: HomeLease | null = null;
  try {
    homeLease = state.isolation.acquireHomeLease(
      plan.stableLogicalHomeBindingHash,
    );
  } catch {
    /* 取得不能を解放済みへ変換しない。 */
  }
  if (!homeLease)
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_recovery_unavailable",
      recoveryId: id.token,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  const controlCapability = Object.freeze({});
  const record: ExecutionRecord = {
    homeLease,
    homeLeaseReleased: false,
    homeLeaseReleaseAttempted: false,
    finished: false,
    controlCapability,
    recovery: reference,
    managementCapability,
    cancellationRequested: false,
    cancelExecution: null,
  };
  state.controls.set(controlCapability, record);
  state.controls.set(capability, record);
  const completion = executeAttempt(state, record, plan, reference).finally(
    () => {
      record.cancelExecution = null;
      record.finished = true;
      state.controls.delete(controlCapability);
      if (record.homeLeaseReleased) state.controls.delete(capability);
    },
  );
  return createStartResult({
    status: "started",
    controlCapability,
    completion,
    operationId: plan.operationId,
    recoveryId: id.token,
  });
}

/**
 * 同じ実行Ownerの開始済み試行へ、一回だけ取消要求を渡す。
 * @responsibility 元Controlと管理参照を照合し、同じsessionの取消・終了観測を返す。
 * @trace ARCH-000008
 * @input state: 元Control表。controlCapability: 開始結果の参照。managementCapability: 同じ管理参照。
 * @returns 無効・重複の拒否、又は取消要求とProcess終了観測を区別した結果。
 * @precondition 呼出し側が明示的にこの試行の取消を選択している。
 * @postcondition 有効な初回要求だけを元sessionへ渡し、completionによる清掃確認は別途維持する。
 * @effect 同じ試行の取消印を付け、必要なら元sessionのcancelを呼ぶ。
 * @failure 別Owner・未登録・終了済みはinvalid、重複はduplicateとして追加処置しない。
 * @invariant 取消要求の受理やProcess終了だけでContainer・Network・Homeの清掃完了を主張しない。
 * @boundary Executorの元Controlと同じDocker実行session。
 * @security 別の試行へ取消を転用せず、新しい実行許可を発行しない。
 * @concurrency 取消印をawait前に確定し、通常完了と清掃は元completionへjoinする。
 */
export async function cancel(
  state: Pick<RuntimeState, "controls">,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  if (!controlCapability || typeof controlCapability !== "object")
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  const record = state.controls.get(controlCapability);
  if (
    !record ||
    record.finished ||
    record.controlCapability !== controlCapability ||
    record.managementCapability !== managementCapability
  )
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  if (record.cancellationRequested)
    return Object.freeze({ status: "blocked" as const, reason: "duplicate" });
  record.cancellationRequested = true;
  const terminated = record.cancelExecution
    ? (await record.cancelExecution()).processTerminationObserved
    : true;
  if (terminated)
    return Object.freeze({
      status: "requested" as const,
      reason: "provider_cancellation_requested" as const,
      cancellationRequested: true as const,
      processTerminationObserved: terminated,
    });
  return Object.freeze({
    status: "requested" as const,
    reason: "provider_cancellation_grace_exceeded" as const,
    cancellationRequested: true,
    processTerminationObserved: terminated,
  });
}

/**
 * 終了済み試行の元参照を照合し、未試行のHome解放を一回処置する。
 * @responsibility 元Controlの所属・終了状態と既存の一回解放条件を確認する。
 * @trace ARCH-000008
 * @input state: 元Control表。reference: 元回復Capability。management: 同じ管理参照。
 * @returns 元Leaseの解放を確認できた場合だけtrue。それ以外はfalse。
 * @precondition 呼出し元が明示終了対象を決めており、同じ試行の元参照を渡す。
 * @postcondition 解放確認時だけ元参照をControl表から除く。
 * @effect 未処置の場合だけ既存Home Leaseのreleaseを呼び、処置済み印を先に付ける。
 * @failure 別参照・別Owner・未終了は処置せずfalse。解放不成立もfalseとして保持する。
 * @invariant 既存の解放条件を変更せず、終了状態だけからDocker資源不存在を推定しない。
 * @boundary Executorの元Control表と同じHome Leaseの明示終了。
 * @security 別試行へ解放を転用せず、新しいAuthorityや回復IDを発行しない。
 * @concurrency 再入・重複呼出しで同じLeaseへのreleaseを追加発行しない。
 */
export function abandon(
  state: Pick<RuntimeState, "controls">,
  reference: unknown,
  management: unknown,
): boolean {
  if (!reference || typeof reference !== "object") return false;
  const record = state.controls.get(reference);
  if (
    !record?.finished ||
    record.recovery.recoveryCapability !== reference ||
    record.managementCapability !== management
  )
    return false;
  if (!record.homeLeaseReleaseAttempted) {
    record.homeLeaseReleaseAttempted = true;
    record.homeLeaseReleased = releaseAttemptHomeLease(record.homeLease);
  }
  if (record.homeLeaseReleased) state.controls.delete(reference);
  return record.homeLeaseReleased;
}

/**
 * Requestの技術構成を内部に保持し、一試行の開始・取消・終了を提供する。
 * @responsibility 構成の往復をなくし、記録用投影と実行Controlを分ける。
 * @trace ARCH-000008
 * @input request: 解決済み対象・選定・用途。options: 固定隔離接続。random: 省略時は既存の暗号乱数。
 * @returns 記録用投影と開始・取消・明示終了を持つ試行専用Executor。不成立はnull。
 * @precondition 上位がstart前の業務許可と記録保存を所有する。
 * @postcondition 完全Plan・Command・Provider本文を公開しない。
 * @effect 構成時は乱数・固定設定確認だけ。Home取得とDocker要求はstart後だけ。
 * @failure 構成拒否はnull。開始拒否は受領したexact回復参照を保持する。
 * @invariant startは一回だけ。保存・Task進行・新しいAuthorityを所有しない。
 * @boundary 上位の実行要求とAI Adapter／Docker Isolationの単段実行。
 * @security 任意Processの注入を追加せず、技術構成は開始時にも検査する。
 * @concurrency cancelとabandonは同じControl表を閉包し、completionは通知・回収までjoinする。
 */
export function createExecutor(
  request: AttemptRequest,
  options: DockerIsolationRuntimeOptions,
  random: Readonly<{ randomBytes: (size: number) => Buffer }> = { randomBytes },
): Executor | null {
  const plan = prepareAttempt(random, request);
  if (!plan) return null;
  const runtime = createDockerIsolationRuntime({
    borrowPaths: options.borrowPaths,
    inspectReceipts: options.inspectReceipts,
  });
  const bound = bindIsolationRuntime(runtime, options.borrowPaths);
  const isolation: IsolationRuntime = {
    acquireHomeLease: runtime.acquireHomeLease,
    ...bound,
  };
  const state: Pick<RuntimeState, "controls"> = { controls: new WeakMap() };
  let startRequested = false;
  return Object.freeze({
    recordProjection: Object.freeze({
      authContainerName: plan.authContainerName,
      providerContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      providerImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
      subscriptionOffering: plan.subscriptionOffering,
      operationMode: plan.operationMode,
      workspaceMountMode: plan.workspaceMountMode,
    }) satisfies AttemptRecordProjection,
    start: (
      management: unknown,
      reference: AttemptReference,
      callbacks: ExecutorCallbacks = {},
    ) => {
      if (startRequested)
        return createStartResult({
          status: "blocked",
          reason: "docker_process_controller_plan_invalid",
          recoveryId:
            parseDockerTaskRecoveryId(
              readOwnDataProperty(reference, "recoveryId"),
            )?.token ?? null,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        });
      startRequested = true;
      try {
        return start(
          { ...state, isolation, callbacks },
          plan,
          management,
          reference,
        );
      } catch {
        return createStartResult({
          status: "blocked",
          reason: "docker_process_controller_start_failed_closed",
          recoveryId:
            parseDockerTaskRecoveryId(
              readOwnDataProperty(reference, "recoveryId"),
            )?.token ?? null,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        });
      }
    },
    cancel: (control: unknown, management: unknown) =>
      cancel(state, control, management),
    abandon: (reference: unknown, management: unknown) =>
      abandon(state, reference, management),
  });
}

/**
 * 解決済みの選定・実行内容とMountを固定ProviderのDocker計画へ結合する。
 *
 * @responsibility 両Providerの共通相関検査・資源命名・command構築を一箇所で行う。
 * @trace ARCH-000015
 * @input 乱数供給と、実行対象・AI Adapterの選定値・用途別内容を持つ一つのRequest。
 * @returns Providerで識別できる不変計画、または不成立時のnull。
 * @precondition 呼出し側が技術対象・選定・用途別内容を確定している。
 * @postcondition 既存の選定Identity・Mount条件とProvider差を保ち、Docker要求を発行しない。
 * @effect 乱数を取得し、Codex Executor時だけ固定Seccomp Fileを既存確認操作で読む。
 * @failure 相関不一致や固定条件不足はnull、取得操作の例外は準備Ownerへ搬送する。
 * @internal 製品の呼出し元はcreateExecutorだけ。有限検証は同じPackageの内部構成を確認できる。
 * @invariant CLI固有計画はAI Adapterから取得し、Authorityを新設しない。
 * @boundary AI Adapterの固定仕様と、上位が確定した技術対象・Docker構成の接続境界。
 * @security 業務上の許可は上位が扱い、ここでは選定・実行内容・Mountの技術条件を維持する。
 * @concurrency 同期の技術構成だけを作り、Control表への登録・実行・保存を行わない。
 */
export function prepareAttempt(
  random: Readonly<{ randomBytes: (size: number) => Buffer }>,
  request: AttemptRequest,
) {
  const { target, selection: modelSelection } = request;
  const selection = parseModelSelection(modelSelection);
  if (!selection) return null;
  const provider = selection.provider;
  if (
    request.purpose !== "probe" &&
    request.purpose !== "task" &&
    request.purpose !== "advice"
  )
    return null;
  const task = request.purpose === "task" ? request : null;
  const advice = request.purpose === "advice" ? request : null;
  const referencesResult = advice
    ? parseAdviceReferences(advice.allowedReferences)
    : null;
  const adviceAllowedReferences =
    referencesResult?.status === "confirmed"
      ? referencesResult.references
      : null;
  const operationMode = task
    ? ("isolated_task" as const)
    : advice
      ? ("workbench_advice" as const)
      : ("boolean_probe" as const);
  const execution = resolveProviderExecution({
    provider,
    operationMode,
    executionSelection: selection,
    taskRole: task?.taskRole ?? null,
    ...(provider === "claude" ? { taskWorkload: task?.taskWorkload } : {}),
  });
  if (!execution) return null;
  const claude = execution.provider === "claude" ? execution : null;
  const assets = describeDockerProviderAssets(provider);
  const egress = describeDockerProxyTopology(provider);
  if (
    target.provider !== provider ||
    ("status" in execution && execution.status !== "candidate") ||
    ((task !== null || advice !== null) &&
      (!("modelIdentifier" in execution) ||
        selection.modelIdentifier !== execution.modelIdentifier ||
        !("identifierKind" in execution) ||
        selection.identifierKind !== execution.identifierKind)) ||
    execution.provider !== provider ||
    (task !== null && advice !== null) ||
    (task !== null && selection.purpose !== "task") ||
    (advice !== null &&
      (selection.purpose !== "advice" ||
        advice.command.provider !== provider ||
        advice.command.modelIdentifier !== selection.modelIdentifier ||
        advice.command.identifierKind !== selection.identifierKind ||
        advice.command.reasoningEffort !== selection.reasoningEffort ||
        !adviceAllowedReferences))
  ) {
    return null;
  }
  const suffix = createDockerIsolationRandomHex(random, 8);
  const proxyToken = createDockerIsolationRandomHex(random, 32);
  if (!suffix || !proxyToken) return null;
  const resourceNames = createDockerIsolationResourceNames(
    provider,
    target.providerHomeIdentityHash,
    suffix,
  );
  if (!resourceNames) return null;
  const {
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    authContainerName,
    providerContainerName,
    ownershipLabel,
  } = resourceNames;
  const providerImageDigest =
    advice?.command.fixedImageDigest ?? assets.fixedImageDigest;
  const proxyImageDigest = egress.imageDigest;
  const plan = {
    provider,
    operationId: target.operationId,
    grantRef: target.grantRef,
    executionSelection: selection,
    activeMountCapability: target.activeMountCapability,
    providerHomeSourcePath: target.providerHomeSourcePath,
    providerHomeIdentityHash: target.providerHomeIdentityHash,
    providerHomeProtectionHash: target.providerHomeProtectionHash,
    localUserBindingHash: target.localUserBindingHash,
    stableLogicalHomeBindingHash: target.stableLogicalHomeBindingHash,
    authContainerName,
    providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    providerImageDigest,
    proxyImageDigest,
    networkPolicy: task?.networkPolicy ?? advice?.command.networkPolicy ?? null,
    subscriptionOffering: describeProviderAuthentication(provider).offering,
    operationMode: task
      ? ("isolated_task" as const)
      : advice
        ? ("workbench_advice" as const)
        : ("boolean_probe" as const),
    taskRole: task?.taskRole ?? null,
    adviceCommandHash: advice?.commandHash ?? null,
    adviceAllowedReferences,
    providerInput: task?.input ?? advice?.input ?? null,
    workspaceSourcePath: task ? target.workspaceSourcePath : null,
    ...(target.workspaceProtection
      ? { workspaceProtection: target.workspaceProtection }
      : {}),
    workspaceMountMode: task
      ? task.taskRole === "executor"
        ? ("read_write" as const)
        : ("read_only" as const)
      : null,
    commands: [] as readonly DockerIsolationCommand[],
  };
  const configuration = resolveIsolationCommandInput(
    {
      ...plan,
      ...(provider === "claude" && claude && "taskWorkload" in claude
        ? { taskWorkload: claude.taskWorkload }
        : {}),
    },
    target.temporarySourcePath,
    proxyToken,
    execution,
  );
  const commands = configuration
    ? planDockerIsolationCommands(configuration)
    : null;
  if (!commands) return null;
  const completedPlan = { ...plan, commands };
  return provider === "codex"
    ? Object.freeze({
        ...completedPlan,
        provider: "codex" as const,
        subscriptionOffering: describeProviderAuthentication("codex").offering,
      })
    : Object.freeze({
        ...completedPlan,
        provider: "claude" as const,
        subscriptionOffering: describeProviderAuthentication("claude").offering,
        taskWorkload:
          claude && "taskWorkload" in claude ? claude.taskWorkload : null,
      });
}
