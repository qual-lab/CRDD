/**
 * Provider試行固有の準備・入力検査・実行と結果解釈を所有する。
 * @packageDocumentation
 * @responsibility Taskの順序・保存を持たず、単段の資源終端と結果を相関する。
 * @trace ARCH-000008
 */

import { createHash, randomBytes } from "node:crypto";
import { types as utilTypes } from "node:util";
import type { DockerResourceProjection } from "../../../docker-isolation/src/index.ts";
import {
  type AiModelSelection,
  describeAdviceResultSchema,
  describeProviderAuthentication,
  evaluateProviderAuthentication,
  parseAdviceReferences,
  planProviderExecution,
  prepareProviderEnvironment,
  resolveAiModelSelection,
  type TaskReviewFinding,
} from "../../../ai-adapter/src/index.ts";
import {
  bindProviderCommand,
  type CommandObservation,
  classifyDockerCommandException,
  createDockerIsolationRandomHex,
  createDockerIsolationResourceNames,
  createDockerIsolationRuntime,
  type DockerExecutionCallbacks,
  type DockerIsolationCommand,
  type DockerIsolationCommandInput,
  type DockerIsolationRuntime,
  type DockerIsolationRuntimeOptions,
  type DockerIsolationRuntimePlan,
  type DockerProcessExitStatusClass,
  type DockerSessionCleanup,
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
  describeDockerProxyTopology,
  dockerIsolationCommandsMatch,
  dockerIsolationResourceIdentityIsValid,
  type HomeLease,
  parseDockerNetworkPolicy,
  parseDockerTaskRecoveryId,
  planDockerIsolationCommands,
} from "../../../docker-isolation/src/index.ts";
import { releaseHomeLease } from "../lifecycle/cleanup.ts";
import { executeLifecycle } from "../lifecycle/execute.ts";
import type {
  Executor,
  StartInput,
  LifecycleOperations,
} from "../lifecycle/types.ts";
import { createLifecycleOperations } from "../lifecycle/operations.ts";
import { ATTEMPT_COMPLETION_REASONS, PURPOSES } from "./constants.ts";
import {
  convertCommandResult,
  createCompletionResult,
  createConfigurationNotice,
  createStartResult,
  parseAttemptOutput,
} from "./result.ts";
import type {
  AttemptCancelInput,
  AttemptContent,
  AttemptFailureReason,
  AttemptPlan,
  AttemptReference,
  AttemptRequest,
  AttemptResultReason,
  CompletionResult,
  ExecutionRecord,
  IsolationRuntime,
  PrimaryFailureDiagnostic,
  RuntimeState,
} from "./types.ts";

const BLOCKED_COMPLETION_REASONS = new Set<string>(ATTEMPT_COMPLETION_REASONS);

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
          await record.lifecycle.cancel();
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

  let homeLeaseReleased = false;
  let completedObservation:
    | import("./types.ts").AttemptTerminalObservation
    | null = null;
  return executeLifecycle(
    {
      async execute() {
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
          record.lifecycle.bindCancellation(
            async () => (await session.cancel()).processTerminationObserved,
          );
          const outcome = await session.completion;
          providerRequestStarted = outcome.executionStarted;
          wasProviderContainerCreationObserved =
            outcome.executionContainerCreated;
          wasProviderProcessCompletionObserved = outcome.executionCompleted;
          providerExitStatusClass = outcome.executionExit;
          cleanup = outcome.cleanup;
          verifiedResourceObservations = outcome.resourceObservations;
          processTreeTerminationConfirmed =
            outcome.processTreeTerminationConfirmed;
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
        }
      },
      async cleanup() {
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
        await startNotification;
        if (
          !primaryFailure &&
          !record.lifecycle.cancellationRequested &&
          providerOutput
        ) {
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
        homeLeaseReleased =
          resourcesClosed && releaseHomeLease(record.homeLease);
        record.homeLeaseReleased = homeLeaseReleased;
        completedObservation = Object.freeze({
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
        if (
          record.lifecycle.cancellationRequested &&
          requestedStatus === "completed"
        ) {
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
              providerContainerCreatedObserved:
                wasProviderContainerCreationObserved,
              providerProcessStartedObserved: providerRequestStarted,
              providerProcessCompletionObserved:
                wasProviderProcessCompletionObserved,
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
      },
      createResult(_context, _failure, failed) {
        if (failed) reject("docker_process_controller_execution_failed_closed");
        const finalResult = createCompletionResult({
          status: requestedStatus,
          reason,
          operationId: plan.operationId,
          recoveryId: recovery.recoveryId,
          providerRequestStarted,
          cancellationRequested: record.lifecycle.cancellationRequested,
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
        return finalResult;
      },
      onCompleted(result) {
        if (completedObservation)
          return state.callbacks.onCompleted?.(result, completedObservation);
      },
    },
    plan,
    record.lifecycle,
  );
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
  lifecycle: LifecycleOperations = createLifecycleOperations(),
) {
  const id = parseDockerTaskRecoveryId(
    readOwnDataProperty(recovery, "recoveryId"),
  );
  if (!lifecycle.start())
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_plan_invalid",
      recoveryId: id?.token ?? null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
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
  ) {
    lifecycle.finish();
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_plan_invalid",
      recoveryId: id?.token ?? null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  }
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
  if (!homeLease) {
    lifecycle.finish();
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_recovery_unavailable",
      recoveryId: id.token,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  }
  const controlCapability = Object.freeze({});
  const record: ExecutionRecord = {
    homeLease,
    homeLeaseReleased: false,
    homeLeaseReleaseAttempted: false,
    lifecycle,
    controlCapability,
    recovery: reference,
    managementCapability,
  };
  state.controls.set(controlCapability, record);
  state.controls.set(capability, record);
  const completion = executeAttempt(state, record, plan, reference).finally(
    () => {
      lifecycle.finish();
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
    record.lifecycle.finished ||
    record.controlCapability !== controlCapability ||
    record.managementCapability !== managementCapability
  )
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  return record.lifecycle.cancel();
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
    !record?.lifecycle.finished ||
    record.recovery.recoveryCapability !== reference ||
    record.managementCapability !== management
  )
    return false;
  if (!record.homeLeaseReleaseAttempted) {
    record.homeLeaseReleaseAttempted = true;
    record.homeLeaseReleased = releaseHomeLease(record.homeLease);
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
export function createAttemptExecutor(
  request: AttemptRequest,
  options: DockerIsolationRuntimeOptions,
  random: Readonly<{ randomBytes: (size: number) => Buffer }> = { randomBytes },
): Executor<"attempt"> | null {
  const runtimeOptions = options as DockerIsolationRuntimeOptions;
  const plan = prepareAttempt(random, request as AttemptRequest);
  if (!plan) return null;
  const runtime = createDockerIsolationRuntime({
    borrowPaths: runtimeOptions.borrowPaths,
    inspectReceipts: runtimeOptions.inspectReceipts,
  });
  const bound = bindIsolationRuntime(runtime, runtimeOptions.borrowPaths);
  const isolation: IsolationRuntime = {
    acquireHomeLease: runtime.acquireHomeLease,
    ...bound,
  };
  const state: Pick<RuntimeState, "controls"> = { controls: new WeakMap() };
  const lifecycle = createLifecycleOperations();
  return Object.freeze({
    kind: "attempt" as const,
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
    }) satisfies DockerResourceProjection,
    start: (input: StartInput<"attempt">) => {
      const {
        managementCapability: management,
        reference,
        callbacks = {},
      } = input;
      try {
        const result = start(
          { ...state, isolation, callbacks },
          plan,
          management,
          reference,
          lifecycle,
        );
        return result;
      } catch {
        lifecycle.finish();
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
    cancel: (input: AttemptCancelInput) =>
      cancel(state, input.controlCapability, input.managementCapability),
    abandon: (
      input: Readonly<{
        recoveryCapability: unknown;
        managementCapability: unknown;
      }>,
    ) => abandon(state, input.recoveryCapability, input.managementCapability),
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
  if (
    advice &&
    (readOwnDataProperty(advice, "networkPolicy") === undefined ||
      Object.hasOwn(advice, "command") ||
      Object.hasOwn(advice, "commandHash"))
  )
    return null;
  const policyInput = task?.networkPolicy ?? advice?.networkPolicy ?? null;
  const networkPolicy =
    policyInput === null ? null : parseDockerNetworkPolicy(policyInput);
  if (
    policyInput !== null &&
    (!networkPolicy || networkPolicy.provider !== provider)
  )
    return null;
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
      (selection.purpose !== "advice" || !adviceAllowedReferences))
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
    advice && provider === "codex"
      ? describeDockerProviderAssets("codex").adviceIdentity.fixedImageDigest
      : assets.fixedImageDigest;
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
    networkPolicy,
    subscriptionOffering: describeProviderAuthentication(provider).offering,
    operationMode: task
      ? ("isolated_task" as const)
      : advice
        ? ("workbench_advice" as const)
        : ("boolean_probe" as const),
    taskRole: task?.taskRole ?? null,
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

const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;

/**
 * 上位の計画投影を同じ下位Runtimeへ結合する。
 *
 * @responsibility 元計画の所属と意味を検証し、技術入力・元結果だけを搬送する。
 * @trace ARCH-000008
 * @input runtime: 固定下位API。borrowPaths: 既存Ownerの所在借用。
 * @returns 元計画の開始・清掃・元結果照合操作。
 * @precondition 同じ下位Runtimeを操作の生涯で保持する。
 * @postcondition raw Process・Filesystem primitiveを上位へ戻さない。
 * @effect N/A: 結合時には外部資源を取得しない。
 * @failure 元計画不一致は開始前拒否し、下位清掃失敗は未確認として返す。
 * @invariant ModelやTaskの意味とDocker技術所有を混在させない。
 * @boundary 上位の意味検証と下位の固定実行API。
 * @security 元Owner・計画Hash・元結果を別Authorityへ読み替えない。
 * @concurrency 下位の終了待機を完了するまで元Runtimeを保持する。
 */
export function bindIsolationRuntime(
  runtime: Pick<
    DockerIsolationRuntime,
    "startExecution" | "cleanupOwnedResources" | "verifyCleanupOutcome"
  >,
  borrowPaths: (managementCapability: object) => Readonly<{ tmp: string }>,
) {
  /**
   * 上位の検証済み計画をDocker技術入力へ投影する。
   *
   * @responsibility Model・Task・許可の相関を上位で検証し、技術値だけを下位へ渡す。
   * @trace ARCH-000008
   * @input plan: 元計画。managementCapability: 元の現在Owner。
   * @returns 同じ計画のHash、固定技術構成、限定stdin。
   * @precondition 既存Ownerの所在借用と元計画の完全照合が成立する。
   * @postcondition 上位のState・Packet・Authorityを下位へ渡さない。
   * @effect 既存Ownerの所在・固定配布物を観測する。Docker要求は発行しない。
   * @failure 所在不明・不正計画・構成不能では例外で停止する。
   * @invariant 元のHashを新しい実行許可へ昇格しない。
   * @boundary Executor内部の試行構成とDocker Isolationの実行入力。
   * @security Secretは限定stdinとContainer内payloadだけへ搬送し、診断しない。
   * @concurrency 同じOwnerを操作直前に観測し、下位も借用所在を再照合する。
   */
  function project(
    plan: AttemptPlan,
    managementCapability: object,
  ): DockerIsolationRuntimePlan {
    const paths = borrowPaths(managementCapability);
    const configuration = resolveValidatedPlan(plan, paths.tmp);
    if (!configuration) throw new Error("docker_effect_plan_invalid");
    return Object.freeze({
      identity: planIdentity(plan),
      configuration,
      stdin: plan.providerInput,
    });
  }

  /**
   * 同じ計画の資源回収を技術Ownerへ委譲する。
   *
   * @responsibility 元の相関とReceipt Ownerを維持し、清掃結果を上書きしない。
   * @trace ARCH-000008
   * @input plan、recoveryCapability、managementCapability: 元の計画とOwner。
   * @returns 技術Ownerの元清掃結果、または明示未確認。
   * @precondition 同じ計画と回復Ownerを用いる。
   * @postcondition 観測不能を不存在や成功へ変換しない。
   * @effect 所有Process・Docker資源の回収を下位へ委譲する。
   * @failure 投影不能・清掃例外は明示未確認として返す。
   * @invariant 名前だけの削除や過去unknownの成功化を追加しない。
   * @boundary 上位相関と下位の資源終端の間。
   * @security 回復Identityや根拠から新しいAuthorityを作らない。
   * @concurrency 下位の終了待機と清掃観測を待つ。
   */
  async function cleanupOwnedResources(
    plan: AttemptPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) {
    try {
      if (!managementCapability || typeof managementCapability !== "object")
        throw new Error("docker_effect_management_required");
      return await runtime.cleanupOwnedResources(
        project(plan, managementCapability),
        recoveryCapability,
        managementCapability,
      );
    } catch {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated: false,
        containersAbsent: false,
        networksAbsent: false,
        resourceObservations: null,
      });
    }
  }

  /**
   * 下位の元清掃結果を上位の元計画へ相関する。
   *
   * @responsibility 完了後の所在再取得を要求せず、元結果と元Hashを照合する。
   * @trace ARCH-000008
   * @input result、plan、recoveryCapability、managementCapability: 元結果と対象相関。
   * @returns 元結果の五資源観測。不一致・不明はnull。
   * @precondition 同じ下位Runtimeが返した結果objectを使う。
   * @postcondition コピー・別操作・別計画を拒否する。
   * @effect N/A: HashとProcess内元結果の照合だけで外部操作を発行しない。
   * @failure 元計画の取込み失敗・相関不一致はnull。
   * @invariant 表示・任意保存・所在清掃後のPathを完了条件にしない。
   * @boundary 技術清掃結果から上位保存Ownerへの境界。
   * @security 成功booleanだけをLease解放や処置許可にしない。
   * @concurrency N/A: 同期照合で追加待機を作らない。
   */
  function verifyCleanupOutcome(
    result: unknown,
    plan: AttemptPlan,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) {
    try {
      return runtime.verifyCleanupOutcome(
        result,
        planIdentity(plan),
        recoveryCapability,
        managementCapability,
      );
    } catch {
      return null;
    }
  }

  /**
   * 上位の元計画を一回の下位Sessionへ接続する。
   * @responsibility Task・許可の投影だけを行い、技術反復を下位へ委譲する。
   * @trace ARCH-000008
   * @input plan、recoveryCapability、managementCapability、hooks: 元相関と有限接続。
   * @returns 下位の元cancel／completion。
   * @precondition 同じOwnerと上位計画を用いる。
   * @postcondition raw HandleやOS手順を返さない。
   * @effect 固定Runtimeへ実行・取消・回収を委譲する。
   * @failure 投影不正は要求前に例外で停止する。
   * @invariant 新Authority・Store・回復管理を作らない。
   * @boundary 上位計画の意味と下位の技術生涯。
   * @security 任意primitiveを本番入口へ公開しない。
   * @concurrency 実行開始前に不透明cancelを受け取る。
   */
  function startExecution(
    plan: AttemptPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionCallbacks,
  ) {
    return runtime.startExecution(
      project(plan, managementCapability),
      recoveryCapability,
      managementCapability,
      hooks,
    );
  }

  return Object.freeze({
    startExecution,
    cleanupOwnedResources,
    verifyCleanupOutcome,
  });
}

/**
 * 同じ有限入力からProvider仕様を一箇所で取得する。
 * @responsibility Task・Advice・Probeの要求結合を共有し、Provider規則はAI Adapterへ委譲する。
 * @trace ARCH-000015
 * @input 用途・Provider・固定Model・推論強度・役割・作業量。
 * @returns 正規Provider計画又はnull。
 * @precondition 操作・選定・Packet相関は呼出しOwnerが確認する。
 * @postcondition AdviceをProbeの副経路にしない。
 * @effect N/A: 純粋な計画要求だけ。
 * @failure 未対応の選定・用途はnull。
 * @invariant 準備時と開始前照合で別の引数生成を持たない。
 * @boundary AI Adapter仕様とExecutorの一試行結合。
 * @security 実行Authority・本文を発行しない。
 * @concurrency N/A: 状態を持たない。
 */
export function resolveProviderExecution(
  plan: Pick<
    AttemptPlan,
    | "provider"
    | "executionSelection"
    | "operationMode"
    | "taskRole"
    | "taskWorkload"
  >,
) {
  const purpose =
    plan.operationMode === "isolated_task"
      ? "task"
      : plan.operationMode === "workbench_advice"
        ? "advice"
        : "probe";
  const selected = resolveAiModelSelection({
    provider: plan.provider,
    modelIdentifier: plan.executionSelection.modelIdentifier,
    reasoningEffort: plan.executionSelection.reasoningEffort,
    purpose: purpose === "probe" ? "task" : purpose,
  });
  if (purpose !== "probe" && selected.status !== "resolved") return null;
  const locations = describeDockerProviderExecutionLocations(
    plan.provider,
    purpose,
  );
  const modelSelection =
    selected.status === "resolved"
      ? {
          provider: selected.value.provider,
          modelIdentifier: selected.value.modelIdentifier,
          identifierKind: selected.value.identifierKind,
          reasoningEffort: selected.value.reasoningEffort,
        }
      : null;
  const result =
    purpose === "advice" && modelSelection
      ? planProviderExecution(
          {
            provider: plan.provider,
            purpose: "advice",
            modelSelection,
            resultSchema: describeAdviceResultSchema(),
          },
          locations,
        )
      : purpose === "task" && modelSelection
        ? planProviderExecution(
            {
              provider: plan.provider,
              purpose: "task",
              modelSelection,
              input: {
                provider: plan.provider,
                mode: "isolated_task",
                taskRole: plan.taskRole,
                effort: plan.executionSelection.reasoningEffort,
                ...(plan.provider === "claude"
                  ? { taskWorkload: plan.taskWorkload }
                  : {}),
              },
            },
            locations,
          )
        : planProviderExecution(
            {
              provider: plan.provider,
              purpose: "probe",
              input: {
                provider: plan.provider,
                mode: "read_only_probe",
                ...(plan.provider === "codex"
                  ? { effort: plan.executionSelection.reasoningEffort }
                  : {}),
              },
            },
            locations,
          );
  return result.status === "ready" ? result.plan : null;
}

/**
 * Provider仕様とDIの正規構築処理を結合する。
 * @responsibility 準備と開始前照合で同じ組立経路を使い、Docker詳細を再定義しない。
 * @trace ARCH-000008
 * @input 元plan、現在のtmp所在、初回のみのproxyToken。
 * @returns 正規技術構成又はnull。
 * @precondition 元操作・Capability・選定の意味は上位が検査する。
 * @postcondition DIへ本文・Authority・Recoveryを渡さない。
 * @effect N/A: 仕様と構成の値組立だけ。
 * @failure Provider仕様又はDI構成の拒否はnull。
 * @invariant Provider規則はAI Adapter、Docker規則はDIが所有する。
 * @boundary 二つの専門OwnerとExecutorの一試行。
 * @security Command一致を実行許可の代わりにしない。
 * @concurrency N/A: 共有状態なし。
 */
export function resolveIsolationCommandInput(
  plan: Omit<AttemptPlan, "authorityUseCapability">,
  tmpSourcePath: string,
  proxyToken?: string,
  execution = resolveProviderExecution(plan),
): DockerIsolationCommandInput | null {
  if (!execution) return null;
  const environment = prepareProviderEnvironment(
    plan.provider,
    execution.environment,
  );
  if (environment.status !== "ready") return null;
  const purpose =
    plan.operationMode === "isolated_task"
      ? "task"
      : plan.operationMode === "workbench_advice"
        ? "advice"
        : "probe";
  const authentication = describeProviderAuthentication(plan.provider);
  return bindProviderCommand({
    provider: plan.provider,
    purpose,
    role: plan.taskRole,
    execution: {
      provider: execution.provider,
      argv: execution.argv,
      environment: Object.fromEntries(environment.entries),
    },
    authentication: {
      argv: authentication.statusArgv,
      homeEnvironmentVariable:
        "homeEnvironmentVariable" in authentication
          ? authentication.homeEnvironmentVariable
          : null,
    },
    resources: {
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    },
    homeSourcePath: plan.providerHomeSourcePath,
    temporarySourcePath: tmpSourcePath,
    workspace:
      purpose === "task" && plan.workspaceSourcePath
        ? {
            sourcePath: plan.workspaceSourcePath,
            readOnly: plan.workspaceMountMode === "read_only",
            ...(plan.workspaceProtection
              ? { protection: plan.workspaceProtection }
              : {}),
          }
        : null,
    networkPolicy: plan.networkPolicy,
    ...(proxyToken === undefined
      ? { mode: "verify" as const, commands: plan.commands }
      : { mode: "create" as const, proxyToken }),
  });
}

/**
 * 元試行の意味を照合し、正規Docker構成を一回で取得する。
 * @responsibility 技術選定・入力・MountとDIの完全Command照合を接続する。Packet相関は上位Ownerが検査する。
 * @trace ARCH-000008
 * @input 元planと現在の借用tmp所在。
 * @returns 全条件が成立した正規構成、又はnull。
 * @precondition 実行時は私有準備Ownerの一回消費を先に確認する。
 * @postcondition 失敗した構成を下位Runtimeへ渡さない。
 * @effect 固定Seccompの実体読取りだけ。Docker・Processは起動しない。
 * @failure 意味相関・固定構成・九Commandの差はnull。
 * @invariant 構築と検査に同じ正規処理を使い、二つのCompilerを持たない。
 * @boundary Executorの元試行とDocker技術構成。
 * @security 構成一致からAuthorityを発行しない。
 * @concurrency 同期照合。追加状態・Lockを持たない。
 */
export function resolveValidatedPlan(
  plan: AttemptPlan,
  tmpSourcePath: string,
): DockerIsolationCommandInput | null {
  if (!isAttemptPlanValid(plan)) return null;
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  const execution = resolveProviderExecution(plan);
  if (!execution) return null;
  const fixedSelection = plan.executionSelection;
  const isProviderBindingValid =
    fixedSelection.purpose === (isAdvicePlan ? "advice" : "task") &&
    (!("identifierKind" in execution) ||
      fixedSelection.identifierKind === execution.identifierKind);
  if (
    !isProviderBindingValid ||
    !["low", "medium", "high"].includes(
      plan.executionSelection.reasoningEffort,
    ) ||
    plan.providerHomeSourcePath.length === 0 ||
    /[\0\r\n,]/u.test(plan.providerHomeSourcePath)
  ) {
    return null;
  }
  const isTaskPlan = plan.operationMode === "isolated_task";
  if (
    ((isTaskPlan || isAdvicePlan) &&
      Buffer.byteLength(plan.providerInput ?? "", "utf8") >
        PROVIDER_INPUT_LIMIT_BYTES) ||
    (isTaskPlan && /[\0\r\n,]/u.test(plan.workspaceSourcePath ?? ""))
  )
    return null;
  const configuration = resolveIsolationCommandInput(
    plan,
    tmpSourcePath,
    undefined,
    execution,
  );
  return configuration !== null &&
    dockerIsolationCommandsMatch(configuration, plan.commands)
    ? configuration
    : null;
}

/**
 * 開始・清掃を同じ試行構成へ相関するHashを計算する。
 * @responsibility 選定・用途・完全Commandと許可参照を同じSessionの識別値へ結合する。
 * @trace ARCH-000008
 * @input 同じFactoryが保持した技術構成。
 * @returns SHA-256の16進文字列。
 * @effect N/A: メモリ内の直列化とHash計算のみ。
 * @invariant 助言専用の上位Command Hashは持たず、同じ実行の完全Command相関を維持する。
 * @boundary 下位Sessionと元の開始・清掃結果の相関。
 * @security Hashの一致を実行許可や清掃完了の証拠にしない。
 */
export function planIdentity(plan: AttemptPlan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operationId: plan.operationId,
        executionSelection: plan.executionSelection,
        operationMode: plan.operationMode,
        taskRole: plan.taskRole,
        taskWorkload: plan.taskWorkload,
        adviceAllowedReferences: plan.adviceAllowedReferences ?? null,
        ownershipLabel: plan.ownershipLabel,
        commands: plan.commands,
      }),
    )
    .digest("hex");
}

/**
 * 用途限定入力のdata propertyだけを一度捕捉する。
 * @responsibility Proxy・accessor・特殊prototype・余剰と欠測を拒否する。
 * @trace ARCH-000008
 * @input 未検査値と内部の固定Key集合。
 * @returns 凍結した浅い値又はnull。
 * @precondition Key集合はこのModule内の用途だけが定める。
 * @postcondition getterを実行せず元Objectから分離する。
 * @effect N/A: 同期の局所検査。
 * @failure reflection不能はnull。
 * @invariant Authorityを生成しない。
 * @boundary 一試行の入力捕捉内部。
 * @security 任意の継承値を実行入力へ昇格しない。
 * @concurrency N/A: 共有状態なし。
 */
function copyPlainDataRecord(value: unknown, keys: readonly string[]) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const actual = Reflect.ownKeys(descriptors);
    if (
      actual.length !== keys.length ||
      actual.some((k) => typeof k !== "string" || !keys.includes(k))
    )
      return null;
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const d = descriptors[key];
      if (
        !d ||
        !Object.hasOwn(d, "value") ||
        d.get !== undefined ||
        d.set !== undefined ||
        d.enumerable !== true
      )
        return null;
      copy[key] = d.value;
    }
    return Object.freeze(copy);
  } catch {
    return null;
  }
}

/**
 * 五項目の入力を固定し、モデルの対応条件はAI Adapterへ照会する。
 * @responsibility Objectの形と五項目投影を所有し、対応モデル・推論強度の規則を複製しない。
 * @trace ARCH-000015
 * @input 上位で完全選定を検査した後の技術投影。
 * @returns 凍結した技術選定又はnull。
 * @precondition 上位が完全選定Hash・設定世代・Authorityを別に検査する。
 * @postcondition 設定・Catalog・保存元情報をExecutorへ持ち込まない。
 * @effect N/A: 値検査のみ。
 * @failure 欠測・余剰・不正な用途相関はnull。
 * @invariant 成立を実行許可へ昇格しない。
 * @boundary 準備と開始で共有する技術入力。
 * @security Hashから完全選定や許可を推定しない。
 * @concurrency 元入力から分離する。
 */
export function parseModelSelection(value: unknown): AiModelSelection | null {
  const v = copyPlainDataRecord(value, [
    "provider",
    "modelIdentifier",
    "identifierKind",
    "reasoningEffort",
    "purpose",
  ]);
  if (!v) return null;
  const resolved = resolveAiModelSelection({
    provider: v.provider,
    modelIdentifier: v.modelIdentifier,
    reasoningEffort: v.reasoningEffort,
    purpose: v.purpose,
  });
  if (
    resolved.status !== "resolved" ||
    resolved.value.provider !== v.provider ||
    resolved.value.modelIdentifier !== v.modelIdentifier ||
    resolved.value.reasoningEffort !== v.reasoningEffort ||
    resolved.value.purpose !== v.purpose ||
    resolved.value.identifierKind !== v.identifierKind
  )
    return null;
  return Object.freeze({
    provider: resolved.value.provider,
    modelIdentifier: resolved.value.modelIdentifier,
    identifierKind: resolved.value.identifierKind,
    reasoningEffort: resolved.value.reasoningEffort,
    purpose: resolved.value.purpose,
  });
}

/**
 * Object自身のdata propertyから値を読み取る。
 * @responsibility 開始参照のfield取得だけを行い、値の意味や保存成立は判断しない。
 * @trace ARCH-000008
 * @input 対象Objectと取得するfield名。
 * @returns 自身の値、又は欠測・accessor・取得不能の場合のundefined。
 * @effect N/A: Property descriptorの局所読取り。getterは呼ばない。
 * @invariant 新しい参照・Authorityを発行しない。
 * @boundary 上位が保存後に渡した参照と単発実行の開始検査。
 */
export function readOwnDataProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 開始前とDocker構成照合で共有する試行入力の基本条件を検査する。
 * @responsibility 選定・用途・Mount・資源Identity・Command外形を一箇所で検査する。
 * @trace ARCH-000008
 * @input Factoryが固定した一試行の技術構成。
 * @returns 全基本条件が成立する場合だけtrue。
 * @effect N/A: メモリ内の照合のみ。Home・Docker・保存を操作しない。
 * @boundary Executor準備済み入力と開始前の技術検査。
 * @invariant 完全Command一致、Authority、清掃成立の代わりにはしない。
 */
export function isAttemptPlanValid(plan: AttemptPlan): boolean {
  const isTaskPlan = plan.operationMode === "isolated_task";
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    parseModelSelection(plan.executionSelection)?.provider === plan.provider &&
    plan.subscriptionOffering ===
      describeProviderAuthentication(plan.provider).offering &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    (plan.operationMode === "boolean_probe" || isTaskPlan || isAdvicePlan) &&
    (isTaskPlan
      ? (plan.taskRole === "executor" || plan.taskRole === "reviewer") &&
        typeof plan.providerInput === "string" &&
        plan.providerInput.length > 0 &&
        typeof plan.workspaceSourcePath === "string" &&
        plan.workspaceSourcePath.length > 0 &&
        plan.workspaceMountMode ===
          (plan.taskRole === "executor" ? "read_write" : "read_only")
      : isAdvicePlan
        ? plan.taskRole === null &&
          typeof plan.providerInput === "string" &&
          plan.providerInput.length > 0 &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null
        : plan.taskRole === null &&
          plan.providerInput === null &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null) &&
    dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    }) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) &&
    /^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) &&
    /^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) &&
    Array.isArray(plan.commands) &&
    plan.commands.length === PURPOSES.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === PURPOSES[index] &&
        Array.isArray(command.argv) &&
        command.argv.length > 0 &&
        command.argv.every(
          (value: unknown) =>
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("\0"),
        ),
    )
  );
}

/**
 * 値がExecutorの固定失敗理由か判定する。
 *
 * @responsibility 下位結果の未知文字列をOwner Registry由来の固定理由から分離する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns 固定Registryにexact一致する場合だけtrueを返す。
 * @precondition N/A: 任意の観測値を受け取る。
 * @postcondition trueの場合、値をAttemptFailureReasonとして扱える。
 * @effect N/A: 不変Registryを参照するだけである。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant prefix、正規表現または部分一致で理由を許可しない。
 * @boundary 下位Provider結果からDocker Process Controller公開結果への診断境界。
 * @security 生出力または自由文を公開理由へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
export function isAttemptFailureReason(
  value: unknown,
): value is AttemptFailureReason {
  return typeof value === "string" && BLOCKED_COMPLETION_REASONS.has(value);
}
