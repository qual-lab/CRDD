/**
 * Provider試行固有の準備・入力検査・実行と結果解釈を所有する。
 * @packageDocumentation
 * @responsibility Taskの順序・保存を持たず、単段の資源終端と結果を相関する。
 * @trace ARCH-000008
 */

import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { types as utilTypes } from "node:util";
import {
  type ModelSelection as AiModelSelection,
  getAuthenticationDefinition,
  parseProviderResult,
  planExecution,
  resolveModelSelection,
  type ExecutionResult,
} from "../../../ai-adapter/src/index.ts";
import {
  describeIsolationConfiguration,
  executeIsolation,
  type IsolationExecutionResult,
  type IsolationCallbacks,
  type IsolationRequest,
  prepareIsolation,
  type IsolationCommandResult,
} from "../../../docker-isolation/src/index.ts";
import { acquireNamedPipeKernelLock } from "../../../platform-access/src/index.ts";
import { releaseHomeLease } from "../lifecycle/cleanup.ts";
import { executeLifecycle } from "../lifecycle/execute.ts";
import { createLifecycleOperations } from "../lifecycle/operations.ts";
import type {
  Executor,
  LifecycleOperations,
  StartInput,
} from "../lifecycle/types.ts";
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
  AttemptCommandPurpose,
  AttemptContent,
  AttemptFailureReason,
  AttemptPlan,
  AttemptRecordProjection,
  AttemptReference,
  AttemptRequest,
  AttemptResultReason,
  CompletionResult,
  DockerIsolationCommandInput,
  DockerIsolationRuntimeOptions,
  DockerResourceReceipts,
  DockerResourceCleanupObservation,
  ExecutionRecord,
  HomeLease,
  PrimaryFailureDiagnostic,
  RuntimeState,
} from "./types.ts";

type TaskReviewFinding = NonNullable<
  ExecutionResult<"task">["reviewFindings"]
>[number];

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
  let providerExitStatusClass: IsolationCommandResult["exitClass"] =
    "not_observed";
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
  let providerOutput: NonNullable<
    IsolationCommandResult["observation"]
  > | null = null;
  let lastStdoutBytes = 0;
  let executionInvoked = false;
  let cleanupConfirmed = false;
  let containersAbsent = false;
  let networksAbsent = false;
  let resourceObservations: readonly DockerResourceCleanupObservation[] | null =
    null;
  let processTreeTerminationConfirmed = false;
  let resourceSnapshot: CompletionResult["resourceSnapshot"] = null;

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
  function acceptProviderOutput(
    execution: NonNullable<IsolationCommandResult["observation"]>,
  ): boolean {
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

  const hooks: IsolationCallbacks = {
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
    onSubmitting: async (step) => {
      const purpose = step.key as AttemptCommandPurpose;
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
        if (purpose === "start_provider_attached")
          await state.callbacks.onProviderSubmitting?.();
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
    onNotIssued: async (step) => {
      const purpose = step.key as AttemptCommandPurpose;
      try {
        await state.callbacks.onCommandNotIssued?.(purpose);
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
    onCreated: async (step, snapshot) => {
      const purpose = step.key as AttemptCommandPurpose;
      const dockerId = snapshot.resources.find((r) => r.key === step.resource)
        ?.identity.dockerId;
      if (!dockerId) {
        reject("docker_resource_receipt_unavailable");
        throw Error("docker_resource_receipt_unavailable");
      }
      if (purpose === "create_provider")
        wasProviderContainerCreationObserved = true;
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
    onObserved: (step, observed) => {
      const purpose = step.key as AttemptCommandPurpose;
      const { observation: execution, classification } = observed;
      if (execution === null && observed.errorCode === "PROCESS_FAILURE") {
        recordIsolationFailure({
          stepKey: purpose,
          stage: "wait",
          kind: "threw",
          notification: null,
          reason: "docker_isolation_command_failed",
          exceptionCode: observed.errorCode,
          commandHandleObtained: true,
          responseObserved: false,
        });
        throw Error("docker_isolation_command_failed");
      }
      if (purpose === "start_provider_attached") {
        wasProviderProcessCompletionObserved = execution !== null;
        providerExitStatusClass = observed.exitClass;
      }
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
        authenticationStatus = parseProviderResult(
          getAuthenticationDefinition(plan.provider),
          {
            stdout: execution.stdout,
            stderr: execution.stderr,
            exitCode: execution.status,
          },
        ).status;
      const classified = convertCommandResult(
        execution,
        purpose,
        plan.provider,
        classification,
        plan.providerPlan,
      );
      lastStdoutBytes =
        "stdoutBytes" in classification ? classification.stdoutBytes : 0;
      if (!classified.ok) {
        reject(
          (BLOCKED_COMPLETION_REASONS.has(classified.reason)
            ? classified.reason
            : "provider_process_exit_nonzero") as AttemptResultReason,
        );
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
    onCompleted: (step, observed) => {
      const purpose = step.key as AttemptCommandPurpose;
      const execution = observed.observation;
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
    onStarted: (step) => {
      if (step.key !== "start_provider_attached") return;
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
  };

  /** DIの元停止点を既存のAttempt診断へ一回投影する。 @trace ARCH-000008 */
  function recordIsolationFailure(
    failure: NonNullable<IsolationExecutionResult["failure"]>,
  ): void {
    if (primaryFailure !== null) return;
    diagnosticPurpose = failure.stepKey;
    if (failure.stage !== "notification")
      diagnosticStage =
        failure.kind === "start_unconfirmed"
          ? "provider_start_observation"
          : failure.stage === "start"
            ? "command_start"
            : "command_wait";
    if (failure.notification === "onCreated")
      diagnosticStage = "resource_receipt_record";
    hasCommandHandle = failure.commandHandleObtained;
    hasResponseObservation = failure.responseObserved;
    reject(
      failure.kind === "start_unconfirmed"
        ? "docker_process_controller_provider_start_failed"
        : failure.notification === "onCreated"
          ? "docker_resource_receipt_unavailable"
          : failure.notification === "onStarted"
            ? "docker_process_controller_provider_start_observation_failed"
            : "docker_process_controller_execution_failed_closed",
    );
    const latched = primaryFailure as PrimaryFailureDiagnostic | null;
    if (latched)
      primaryFailure = Object.freeze({
        ...latched,
        exceptionCode: failure.exceptionCode,
      });
  }

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
          const prepared = state.prepareIsolation(plan.isolationRequest);
          if (!prepared) throw Error("docker_effect_plan_invalid");
          executionInvoked = true;
          const execution = state.executeIsolation(prepared, hooks);
          record.lifecycle.bindCancellation(
            async () => (await execution.cancel()).processTerminationObserved,
          );
          const technical = await execution.completion;
          resourceSnapshot = technical.resources;
          wasProviderContainerCreationObserved =
            wasProviderContainerCreationObserved ||
            technical.resources.resources.some(
              (resource) =>
                resource.key === "create_provider" &&
                resource.identity.dockerId !== null,
            );
          processTreeTerminationConfirmed =
            technical.processTerminationConfirmed;
          resourceObservations = Object.freeze(
            technical.resources.resources
              .map((resource) =>
                Object.freeze({
                  purpose: resource.key as keyof DockerResourceReceipts,
                  plannedResourceName: resource.identity.name,
                  dockerId: resource.identity.dockerId,
                  observation:
                    technical.cleanup.observations.find(
                      (o) => o.key === resource.key,
                    )?.observation ??
                    (resource.request === "not_issued"
                      ? ("not_requested" as const)
                      : ("unknown" as const)),
                }),
              )
              .sort((a, b) => a.purpose.localeCompare(b.purpose)),
          );
          cleanupConfirmed =
            technical.cleanup.confirmed &&
            resourceObservations.length ===
              plan.isolationRequest.resources.length;
          containersAbsent = resourceObservations
            .filter((r) => !r.purpose.endsWith("_network"))
            .every((r) => r.observation !== "unknown");
          networksAbsent = resourceObservations
            .filter((r) => r.purpose.endsWith("_network"))
            .every((r) => r.observation !== "unknown");
          if (technical.failure) recordIsolationFailure(technical.failure);
        } catch {
          if (primaryFailure === null) {
            reject("docker_process_controller_execution_failed_closed");
            const latched = primaryFailure as PrimaryFailureDiagnostic | null;
            if (latched)
              primaryFailure = Object.freeze({
                ...latched,
                exceptionCode: "unclassified_exception",
              });
          }
        }
      },
      async finalize() {
        if (!executionInvoked) {
          // DI準備は資源を取得しない。実行要求前の拒否だけ未発行として終端する。
          resourceObservations = Object.freeze(
            plan.isolationRequest.resources
              .map((resource) =>
                Object.freeze({
                  purpose: resource.key as keyof DockerResourceReceipts,
                  plannedResourceName: resource.name,
                  dockerId: null,
                  observation: "not_requested" as const,
                }),
              )
              .sort((a, b) => a.purpose.localeCompare(b.purpose)),
          );
          cleanupConfirmed = true;
          processTreeTerminationConfirmed = true;
          containersAbsent = true;
          networksAbsent = true;
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
          resources: resourceObservations ?? null,
          primaryFailure,
          processTreeTerminationConfirmed,
          containersAbsent: containersAbsent,
          networksAbsent: networksAbsent,
          homeLeaseReleased: false,
        });
        const resourcesClosed =
          cleanupConfirmed &&
          processTreeTerminationConfirmed &&
          containersAbsent &&
          networksAbsent;
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
              containersAbsentObserved: containersAbsent,
              networksAbsentObserved: networksAbsent,
              cleanupConfirmed:
                processTreeTerminationConfirmed &&
                containersAbsent &&
                networksAbsent &&
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
          resourceSnapshot,
          reason,
          operationId: plan.operationId,
          recoveryId: recovery.recoveryId,
          providerRequestStarted,
          cancellationRequested: record.lifecycle.cancellationRequested,
          processTreeTerminationConfirmed,
          containersAbsent: containersAbsent,
          networksAbsent: networksAbsent,
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
  const id = parseAttemptRecoveryReference(
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
    homeLease = state.acquireHomeLease(plan.stableLogicalHomeBindingHash);
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
  const capturedOptions = copyPlainDataRecord(options, ["paths"]);
  const capturedPaths = copyPlainDataRecord(capturedOptions?.paths, [
    "tmp",
    "management",
  ]);
  if (
    !capturedPaths ||
    typeof capturedPaths.tmp !== "string" ||
    typeof capturedPaths.management !== "string" ||
    !capturedPaths.tmp ||
    !capturedPaths.management ||
    /\0/u.test(capturedPaths.tmp + capturedPaths.management)
  )
    return null;
  const paths = Object.freeze({
    tmp: capturedPaths.tmp,
    management: capturedPaths.management,
  });
  if (paths.tmp !== request.target.temporarySourcePath) return null;
  const plan = prepareAttempt(random, request, paths);
  if (!plan) return null;

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
    }) satisfies AttemptRecordProjection,
    start: (input: StartInput<"attempt">) => {
      const {
        managementCapability: management,
        reference,
        callbacks = {},
      } = input;
      try {
        const result = start(
          {
            ...state,
            acquireHomeLease,
            prepareIsolation,
            executeIsolation,
            callbacks,
          },
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
            parseAttemptRecoveryReference(
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
 * @input 乱数供給、確定した実行Requestと管理・一時所在。
 * @returns Providerで識別できる不変計画、または不成立時のnull。
 * @precondition 呼出し側が技術対象・選定・用途別内容を確定している。
 * @postcondition 既存の選定Identity・Mount条件とProvider差を保ち、Docker要求を発行しない。
 * @effect 乱数取得とRequestの不変化だけ。Seccomp・CLI・Directory実体は開始後のDI準備で確認する。
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
  paths: DockerIsolationRuntimeOptions["paths"],
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
  if (selection.purpose !== (advice ? "advice" : "task")) return null;
  if (
    advice &&
    (readOwnDataProperty(advice, "additionalHosts") === undefined ||
      Object.hasOwn(advice, "command") ||
      Object.hasOwn(advice, "commandHash"))
  )
    return null;
  const policyInput = task?.additionalHosts ?? advice?.additionalHosts ?? null;
  const additionalHosts = policyInput;
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
    adviceAllowedReferences: advice?.allowedReferences,
    ...(provider === "claude" ? { taskWorkload: task?.taskWorkload } : {}),
  });
  if (!execution) return null;
  const providerPlan = Object.freeze({
    status: "ready" as const,
    plan: execution,
    error: null,
  });
  const adviceAllowedReferences = execution.allowedReferences;
  const claude = execution.provider === "claude" ? execution : null;
  const capabilities = describeIsolationConfiguration(provider);
  const assets = capabilities.assets;
  const egress = capabilities.proxy;
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
  const suffix = createRandomHex(random, 8);
  const proxyToken = createRandomHex(random, 32);
  if (!suffix || !proxyToken) return null;
  const resourceNames = createResourceNames(
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
      ? describeIsolationConfiguration("codex").assets.alternateIdentity
          .fixedImageDigest
      : assets.fixedImageDigest;
  const proxyImageDigest = egress.imageDigest;
  const plan = {
    providerPlan,
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
    additionalHosts,
    subscriptionOffering: getAuthenticationDefinition(provider).offering,
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
  if (!configuration || paths.tmp !== target.temporarySourcePath) return null;
  const isolationRequest = createIsolationRequest(plan, paths, configuration);
  const completedPlan = {
    ...plan,
    additionalHosts: isolationRequest.proxy?.additionalHosts ?? null,
    isolationRequest,
    providerPlan,
  };
  if (!isAttemptPlanValid(completedPlan)) return null;
  return provider === "codex"
    ? Object.freeze({
        ...completedPlan,
        provider: "codex" as const,
        subscriptionOffering: getAuthenticationDefinition("codex").offering,
      })
    : Object.freeze({
        ...completedPlan,
        provider: "claude" as const,
        subscriptionOffering: getAuthenticationDefinition("claude").offering,
        taskWorkload:
          claude && "taskWorkload" in claude ? claude.taskWorkload : null,
      });
}

const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;

/**
 * Provider metadataの環境名へContainer内の固定Homeを結合する。
 * @responsibility 上位にContainer内Pathを組み立てさせない。
 * @trace ARCH-000004
 * @input name: 認証CLI metadataの追加Home環境名、または不使用のnull。
 * @returns 一項目の追加環境、空環境、または不正名のnull。
 * @precondition Providerの選択とmetadata取得は上位が所有する。
 * @postcondition 任意値を受け取らず固定Homeだけを生成する。
 * @effect N/A: 値構築だけ。
 * @failure 不正・予約済み技術環境名はnull。
 * @invariant nullを未知のProviderや欠測へ補完しない。
 * @boundary Provider metadataとContainer技術構成。
 * @security Proxy・HOME・TMPDIRの既存固定値を上書きしない。
 * @concurrency N/A: 純粋同期処理。
 */
function createAuthenticationEnvironment(
  name: string | null,
): Readonly<Record<string, string>> | null {
  if (name === null) return {};
  if (
    typeof name !== "string" ||
    !/^[A-Z][A-Z0-9_]*$/u.test(name) ||
    [
      "HOME",
      "TMPDIR",
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "ALL_PROXY",
      "NO_PROXY",
    ].includes(name)
  )
    return null;
  return { [name]: "/provider-home" };
}

/**
 * 所定byte数のBufferから内部計画用のhex値を生成する。
 *
 * @responsibility 乱数取得結果の型と長さを確認する。
 * @trace ARCH-000008
 * @input state: 呼出し側の乱数Owner。bytes: 固定取得長。
 * @returns hex値、または型・長さ不一致に対するnull。
 * @precondition bytesは準備Ownerが8または32へ固定する。
 * @postcondition 取得結果を一回だけ検査し、受理時だけhexへ変換する。
 * @effect 呼出し側が所有する乱数生成を一回呼ぶ。Docker・Filesystem要求は発行しない。
 * @failure Buffer以外またはbyte長不一致をnullで拒否する。取得例外は呼出し側へ伝播する。
 * @invariant 不正な取得値を切詰め・補完しない。
 * @boundary 乱数OwnerとDocker準備値の間。
 * @security Proxy Tokenへ利用する値を公開結果やログへ渡さない。
 * @concurrency N/A: 同期取得だけでStoreを所有しない。
 */
function createRandomHex(
  state: Readonly<{ randomBytes: (size: number) => Buffer }>,
  bytes: number,
): string | null {
  const value = state.randomBytes(bytes);
  return Buffer.isBuffer(value) && value.byteLength === bytes
    ? value.toString("hex")
    : null;
}

/**
 * 照合済みIdentityと固定実行namespaceからDocker資源名を生成する。
 *
 * @responsibility 実行Identityの64桁hex検査、既存prefixと63文字上限を所有する。
 * @trace ARCH-000008
 * @input executionNamespace: 固定実行namespace。executionIdentityHash: 上位照合済みIdentity。suffix: 取得済み8byteのhex。
 * @returns 五資源名と所有label、または不正Identity・過大名に対するnull。
 * @precondition suffixは同じ準備Ownerの乱数検査に成功している。
 * @postcondition 実行名はIdentity Hash先頭16桁へ、他の資源とlabelはsuffixへ結合する。
 * @effect N/A: 局所文字列の生成だけを行う。
 * @failure 実行Identity形式不正または63文字を超える資源名をnullで拒否する。
 * @invariant 名前やlabelを実資源所有の証明として扱わない。
 * @boundary 準備IdentityとDocker資源名の間。
 * @security HashとsuffixからAuthorityを生成せず、削除許可にも利用しない。
 * @concurrency N/A: 同期計算であり資源の取得・排他を行わない。
 */
function createResourceNames(
  executionNamespace: string,
  executionIdentityHash: string,
  suffix: string,
): Readonly<{
  internalNetworkName: string;
  egressNetworkName: string;
  proxyContainerName: string;
  authContainerName: string;
  providerContainerName: string;
  ownershipLabel: string;
}> | null {
  if (executionNamespace !== "codex" && executionNamespace !== "claude")
    return null;
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const authContainerName = `crdd-auth-${suffix}`;
  if (!/^[a-f0-9]{64}$/u.test(executionIdentityHash)) return null;
  const providerContainerName = `crdd-${executionNamespace}-${executionIdentityHash.slice(0, 16)}`;
  if (
    [
      internalNetworkName,
      egressNetworkName,
      proxyContainerName,
      authContainerName,
      providerContainerName,
    ].some((value) => value.length > 63)
  )
    return null;
  return {
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    authContainerName,
    providerContainerName,
    ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
  };
}

/**
 * 同じ論理Homeの既存OS排他を取得する。
 * @responsibility 技術LeaseのnamespaceとHash導出・元releaseを維持する。
 * @trace ARCH-000008
 * @input bindingHash: 上位が確定した論理HomeのSHA-256。
 * @returns 保持中Lease又はnull。
 * @effect 既存のWindows Named Pipe排他。
 * @invariant 保存・Task判断・新しいLockを追加しない。
 */
function acquireHomeLease(bindingHash: string): HomeLease | null {
  if (
    process.platform !== "win32" ||
    typeof bindingHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(bindingHash)
  )
    return null;
  const identity = createHash("sha256")
    .update("crdd-logical-provider-home-kernel-lock-v1\0")
    .update(bindingHash)
    .digest("hex")
    .slice(0, 32);
  return acquireNamedPipeKernelLock(
    `\\\\.\\pipe\\CRDD.Coordinator.ProviderHome.${identity}`,
  );
}

/**
 * 単段AI固有の固定構成を、用途を持たない共通DI入力へ投影する。
 * @responsibility 認証確認・Proxy・入力搬送の差を固定し、技術生涯は再実装しない。
 * @trace ARCH-000008
 * @input plan: 同じFactoryの元構成。paths: 上位が確定した二所在。c: 検査済み用途構成。
 * @returns 固定五資源と九操作。構成不成立は例外。
 * @effect N/A: 値構築のみ。
 * @invariant 元の期限・環境・Mount・stdin・seccomp・initを維持する。
 */
function createIsolationRequest(
  plan: Omit<AttemptPlan, "isolationRequest">,
  paths: DockerIsolationRuntimeOptions["paths"],
  c: DockerIsolationCommandInput,
): IsolationRequest {
  if (c.proxy.port !== 8080) throw Error("docker_isolation_proxy_port_invalid");
  const additionalHosts = c.proxy.additionalHosts ?? null;
  const environment: Record<string, string> = {
    HOME: "/provider-home",
    TMPDIR: "/tmp",
  };
  Object.assign(environment, c.execution.environment);
  const auth = {
    kind: "container",
    key: "create_subscription_auth_probe",
    name: c.authenticationContainerName,
    ownershipLabel: c.ownershipLabel,
    image: c.executionImageDigest,
    argv: c.authentication.argv,
    environment: { HOME: "/provider-home", ...c.authentication.environment },
    mounts: [
      { source: c.homeSourcePath, target: "/provider-home", readOnly: true },
    ],
    network: null,
    networkAlias: null,
    user: "65534:65534",
    workingDirectory: null,
    entrypoint: null,
    tmpfsBytes: null,
    interactive: false,
    tty: false,
    init: false,
    seccomp: null,
  } as const satisfies IsolationRequest["resources"][number];
  const resources: IsolationRequest["resources"] = [
    auth,
    {
      ...auth,
      key: "create_provider",
      name: c.executionContainerName,
      argv: c.execution.argv,
      environment,
      network: "create_internal_network",
      workingDirectory: "/work",
      interactive: c.execution.interactive,
      init: c.execution.initRequired,
      seccomp: c.execution.seccompProfile,
      mounts: [
        { source: c.homeSourcePath, target: "/provider-home", readOnly: false },
        { source: c.temporarySourcePath, target: "/tmp", readOnly: false },
        ...(c.workspace
          ? [
              {
                source: c.workspace.sourcePath,
                target: "/work",
                readOnly: c.workspace.readOnly,
              },
            ]
          : []),
        ...(c.workspace?.protection
          ? [
              {
                source: c.workspace.protection.gitSourcePath,
                target: "/work/.git",
                readOnly: true,
              },
              {
                source: c.workspace.protection.internalSourcePath,
                target: "/work/.crdd",
                readOnly: true,
              },
            ]
          : []),
      ],
    },
    {
      ...auth,
      key: "create_proxy",
      name: c.proxyContainerName,
      image: c.proxyImageDigest,
      argv: [],
      environment: {},
      mounts: [],
      network: "create_internal_network",
      networkAlias: "proxy",
      tmpfsBytes: 16_777_216,
    },
    {
      kind: "network",
      key: "create_internal_network",
      name: c.internalNetworkName,
      ownershipLabel: c.ownershipLabel,
      internal: true,
    },
    {
      kind: "network",
      key: "create_egress_network",
      name: c.egressNetworkName,
      ownershipLabel: c.ownershipLabel,
      internal: false,
    },
  ];
  const run = (
    key: string,
    resource: string,
    primary = false,
    detached = false,
  ): IsolationRequest["steps"][number] => ({
    key,
    action: "run",
    resource,
    mode: detached ? "detached" : "captured",
    stdin: primary ? plan.providerInput : null,
    timeoutMs: primary ? 300_000 : 10_000,
    stdoutLimitBytes: 1_048_576,
    stderrLimitBytes: 262_144,
    acceptedExitCodes: [0],
    deadlineOrigin: primary ? "started" : "request",
  });
  return freezeIsolationRequest({
    proxy: {
      resource: "create_proxy",
      clients: ["create_provider"],
      profile: c.proxy.profile as "codex" | "claude",
      token: c.proxy.token,
      additionalHosts,
      environmentMode: additionalHosts
        ? "all"
        : c.proxy.extendedProxyEnvironment
          ? "uppercase"
          : "https",
    },
    managementDirectory: paths.management,
    resources,
    steps: [
      {
        key: "create_subscription_auth_probe",
        action: "create",
        resource: "create_subscription_auth_probe",
        timeoutMs: 10_000,
      },
      run(
        "start_subscription_auth_probe_attached",
        "create_subscription_auth_probe",
      ),
      {
        key: "create_internal_network",
        action: "create",
        resource: "create_internal_network",
        timeoutMs: 10_000,
      },
      {
        key: "create_egress_network",
        action: "create",
        resource: "create_egress_network",
        timeoutMs: 10_000,
      },
      {
        key: "create_proxy",
        action: "create",
        resource: "create_proxy",
        timeoutMs: 10_000,
      },
      {
        key: "connect_proxy_egress",
        action: "connect",
        resource: "create_proxy",
        network: "create_egress_network",
        timeoutMs: 10_000,
      },
      {
        key: "create_provider",
        action: "create",
        resource: "create_provider",
        timeoutMs: 10_000,
      },
      run("start_proxy", "create_proxy", false, true),
      run("start_provider_attached", "create_provider", true),
    ],
    cleanupOrder: [
      "create_provider",
      "create_subscription_auth_probe",
      "create_proxy",
      "create_internal_network",
      "create_egress_network",
    ],
    setupTimeoutMs: 10_000,
    unreceiptedAbsence: "retain",
    verifyLabelAbsence: false,
  });
}

/**
 * 自分で構築した技術Requestを入力の可変参照から分離して固定する。
 * @responsibility 同じ試行の診断・実行・未開始回収へ一つの構成を渡す。
 * @trace ARCH-000008
 * @input Executorが組み立てた通常dataのRequest。
 * @returns 深く固定した一つのRequest。
 * @effect N/A: メモリ内の複製と凍結のみ。
 * @security Token・環境本文を公開結果へ投影しない。
 */
function freezeIsolationRequest(request: IsolationRequest): IsolationRequest {
  const copy = structuredClone(request);
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(copy);
  return copy;
}

/**
 * 同じAttemptの構成・通知をDIの元実行と元Completionへ結合する。
 * @responsibility 技術制御を持たず、既存の単段観測・失敗・未発行事実へ対応付ける。
 * @trace ARCH-000008
 * @input plan: Factory内の元構成。paths: 確定所在。
 * @returns 一回の共通実行と同じ結果だけの終了確認。
 * @effect start後だけ共通DI。開始前拒否では外部資源を取得しない。
 * @invariant 旧Runtime・固定九目的Sessionを起動しない。コピー結果を成功へ再解釈しない。
 */

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
  > &
    Readonly<{ adviceAllowedReferences?: unknown }>,
) {
  const purpose =
    plan.operationMode === "isolated_task"
      ? "task"
      : plan.operationMode === "workbench_advice"
        ? "advice"
        : "probe";
  const selected = resolveModelSelection({
    provider: plan.provider,
    modelIdentifier: plan.executionSelection.modelIdentifier,
    reasoningEffort: plan.executionSelection.reasoningEffort,
    purpose: purpose === "probe" ? "task" : purpose,
  });
  if (purpose !== "probe" && selected.status !== "resolved") return null;
  const capabilities = describeIsolationConfiguration(plan.provider);
  const locations =
    purpose === "advice" && capabilities.provider === "codex"
      ? capabilities.locations.alternate
      : capabilities.locations.primary;
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
      ? planExecution(
          {
            provider: plan.provider,
            purpose: "advice",
            modelSelection,
            allowedReferences: plan.adviceAllowedReferences,
          },
          locations,
        )
      : purpose === "task" && modelSelection
        ? planExecution(
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
        : planExecution(
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
 * Provider仕様と用途固有の隔離条件を結合する。
 * @responsibility 用途・Role・固定ImageとMountの相関をExecutorで決め、Docker argvはDIへ委譲する。
 * @trace ARCH-000008
 * @input 元plan、確定tmp所在、同じ準備で一度生成したproxyToken。
 * @returns 正規技術構成又はnull。
 * @precondition 元操作・Capability・選定の意味は上位が検査する。
 * @postcondition DIへ本文・Authority・Recoveryを渡さない。
 * @effect N/A: 仕様と構成の値組立だけ。
 * @failure Provider仕様・用途相関又は固定構成の拒否はnull。
 * @invariant Provider規則はAI Adapter、用途構成はExecutor、Docker技術規則はDIが所有する。
 * @boundary 二つの専門OwnerとExecutorの一試行。
 * @security 構成検査を実行許可の代わりにしない。
 * @concurrency N/A: 共有状態なし。
 */
export function resolveIsolationCommandInput(
  plan: Omit<AttemptPlan, "isolationRequest">,
  tmpSourcePath: string,
  proxyToken: string,
  execution = resolveProviderExecution(plan),
): DockerIsolationCommandInput | null {
  if (
    !execution ||
    execution.provider !== plan.provider ||
    !["isolated_task", "workbench_advice", "boolean_probe"].includes(
      plan.operationMode,
    )
  )
    return null;
  const purpose =
    plan.operationMode === "isolated_task"
      ? "task"
      : plan.operationMode === "workbench_advice"
        ? "advice"
        : "probe";
  const authentication = getAuthenticationDefinition(plan.provider);
  const { assets, proxy } = describeIsolationConfiguration(plan.provider);
  const expectedImage =
    purpose === "advice" && plan.provider === "codex"
      ? describeIsolationConfiguration("codex").assets.alternateIdentity
          .fixedImageDigest
      : assets.fixedImageDigest;
  if (
    (plan.additionalHosts !== null &&
      (!Array.isArray(plan.additionalHosts) ||
        utilTypes.isProxy(plan.additionalHosts))) ||
    assets.fixedDigestImageRequired !== true ||
    plan.providerImageDigest !== expectedImage ||
    plan.proxyImageDigest !== proxy.imageDigest ||
    (purpose === "task"
      ? (plan.taskRole !== "executor" && plan.taskRole !== "reviewer") ||
        !plan.workspaceSourcePath ||
        plan.workspaceMountMode !==
          (plan.taskRole === "reviewer" ? "read_only" : "read_write")
      : plan.taskRole !== null ||
        plan.workspaceSourcePath !== null ||
        plan.workspaceMountMode !== null)
  )
    return null;
  const token = proxyToken;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/u.test(token)) return null;
  const authenticationEnvironment = createAuthenticationEnvironment(
    "homeEnvironmentVariable" in authentication
      ? authentication.homeEnvironmentVariable
      : null,
  );
  if (!authenticationEnvironment) return null;
  const seccompProfile =
    plan.provider === "codex" &&
    purpose === "task" &&
    plan.taskRole === "executor"
      ? {
          sha256:
            describeIsolationConfiguration("codex").assets.identity
              .executorSeccompProfileSha256,
          bytes:
            describeIsolationConfiguration("codex").assets.identity
              .executorSeccompProfileBytes,
        }
      : null;
  const configuration: DockerIsolationCommandInput = {
    authenticationContainerName: plan.authContainerName,
    executionContainerName: plan.providerContainerName,
    proxyContainerName: plan.proxyContainerName,
    internalNetworkName: plan.internalNetworkName,
    egressNetworkName: plan.egressNetworkName,
    ownershipLabel: plan.ownershipLabel,
    executionImageDigest: plan.providerImageDigest,
    proxyImageDigest: plan.proxyImageDigest,
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
    authentication: {
      argv: authentication.statusArgv,
      environment: authenticationEnvironment,
    },
    execution: {
      argv: execution.argv,
      environment: execution.environment,
      interactive: purpose !== "probe",
      initRequired:
        plan.provider === "codex" && plan.operationMode === "workbench_advice",
      seccompProfile,
    },
    proxy: {
      profile: plan.provider,
      token,
      port: proxy.containerPort,
      extendedProxyEnvironment: plan.provider === "codex",
      additionalHosts: plan.additionalHosts,
    },
  };
  const locations = [
    configuration.homeSourcePath,
    configuration.temporarySourcePath,
    ...(configuration.workspace ? [configuration.workspace.sourcePath] : []),
    ...(configuration.workspace?.protection
      ? [
          configuration.workspace.protection.gitSourcePath,
          configuration.workspace.protection.internalSourcePath,
        ]
      : []),
  ];
  if (
    locations.some(
      (value) =>
        typeof value !== "string" ||
        !path.isAbsolute(value) ||
        /[\0\r\n,]/u.test(value),
    )
  )
    return null;
  for (const payload of [
    configuration.authentication,
    configuration.execution,
  ]) {
    if (
      !Array.isArray(payload.argv) ||
      payload.argv.length > 256 ||
      payload.argv.some(
        (value) => typeof value !== "string" || value.includes("\0"),
      ) ||
      Object.keys(payload.environment).length > 64 ||
      Object.entries(payload.environment).some(
        ([name, value]) =>
          !/^[A-Z][A-Z0-9_]*$/u.test(name) ||
          [
            "HOME",
            "TMPDIR",
            "HTTPS_PROXY",
            "HTTP_PROXY",
            "ALL_PROXY",
            "NO_PROXY",
          ].includes(name) ||
          typeof value !== "string" ||
          value.includes("\0"),
      ) ||
      Buffer.byteLength(JSON.stringify(payload), "utf8") > 128 * 1024
    )
      return null;
  }
  return configuration;
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
  const resolved = resolveModelSelection({
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

/** 元回復参照の文法と非Authorityの相関だけを確認する。 */
function parseAttemptRecoveryReference(token: unknown) {
  if (typeof token !== "string") return null;
  const match =
    /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u.exec(
      token,
    );
  return match
    ? {
        token,
        stableLogicalHomeBindingHash: match[1],
        operationNonce: match[2],
        baseHash: match[3],
      }
    : null;
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
 * @invariant DIの技術Request検査、Authority、清掃成立の代わりにはしない。
 */
export function isAttemptPlanValid(plan: AttemptPlan): boolean {
  const resourceNames = [
    plan.authContainerName,
    plan.providerContainerName,
    plan.proxyContainerName,
    plan.internalNetworkName,
    plan.egressNetworkName,
  ];
  const isTaskPlan = plan.operationMode === "isolated_task";
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    parseModelSelection(plan.executionSelection)?.provider === plan.provider &&
    plan.subscriptionOffering ===
      getAuthenticationDefinition(plan.provider).offering &&
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
    resourceNames.every(
      (name) =>
        typeof name === "string" &&
        /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u.test(
          name,
        ),
    ) &&
    new Set(resourceNames).size === resourceNames.length &&
    typeof plan.ownershipLabel === "string" &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(plan.ownershipLabel) &&
    [plan.providerImageDigest, plan.proxyImageDigest].every(
      (digest) =>
        typeof digest === "string" && /^sha256:[a-f0-9]{64}$/u.test(digest),
    ) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) &&
    /^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) &&
    /^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) &&
    (isTaskPlan || isAdvicePlan
      ? Buffer.byteLength(plan.providerInput ?? "", "utf8") <=
        PROVIDER_INPUT_LIMIT_BYTES
      : true) &&
    !!plan.isolationRequest &&
    Array.isArray(plan.isolationRequest.resources) &&
    plan.isolationRequest.resources.length === 5 &&
    Array.isArray(plan.isolationRequest.steps) &&
    plan.isolationRequest.steps.length === PURPOSES.length &&
    plan.isolationRequest.steps.every(
      (step, index) => step.key === PURPOSES[index],
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
