/**
 * 上位Attemptの入力とCoordinator単一Task結果を対応付ける。
 * @responsibility Attempt、判断権限、Revisionを検証し、共通Task結果へ結合する。
 * @trace ARCH-000004
 */
import { types as utilTypes } from "node:util";
import {
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
  type CoordinatorTaskDependencies,
  runCoordinatorTaskAttempt,
} from "../../../coordinator/src/task/index.ts";
import {
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
  type ProjectRuntimeSingleTaskAttemptInput,
  type ProjectRuntimeSingleTaskResult,
  type ProjectRuntimeTaskResultDelivery,
} from "../ports/execution-port.ts";
export const PROJECT_RUNTIME_SINGLE_TASK_PRE_EFFECT_REJECTIONS =
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS;
export type ProjectRuntimeSingleTaskDependencies = CoordinatorTaskDependencies &
  Readonly<{
    captureResultDelivery?: (
      controlCapability: unknown,
    ) => ProjectRuntimeTaskResultDelivery | null;
  }>;
/**
 * IF-SINGLE-TASK adapter: run exactly one task attempt on the existing v0.18
 *
 * @responsibility Project Runtime Single Task Attemptの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: ProjectRuntimeSingleTaskDependencies、input: ProjectRuntimeSingleTaskAttemptInput
 * @returns Promise<ProjectRuntimeSingleTaskResult>を返す。
 * @precondition 「dependencies: ProjectRuntimeSingleTaskDependencies、input: ProjectRuntimeSingleTaskAttemptInput」がrunProjectRuntimeSingleTaskAttemptの入力契約を満たす。
 * @postcondition runProjectRuntimeSingleTaskAttemptの責務を完了した結果だけを返す。
 * @effect 共通Task処理へ検証済み入力を渡し、許可された実行・取消を委譲する。
 * @failure runProjectRuntimeSingleTaskAttemptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectRuntimeSingleTaskAttemptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runProjectRuntimeSingleTaskAttemptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runProjectRuntimeSingleTaskAttemptは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runProjectRuntimeSingleTaskAttempt(
  dependencies: ProjectRuntimeSingleTaskDependencies,
  input: ProjectRuntimeSingleTaskAttemptInput,
): Promise<ProjectRuntimeSingleTaskResult> {
  const ids =
    input && typeof input === "object"
      ? [input.attemptId, input.operationId, input.authorityBindingId]
      : [];
  const valid =
    ids.length === 3 &&
    ids.every(
      (id) =>
        typeof id === "string" &&
        id.length > 0 &&
        id.length <= 128 &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id),
    ) &&
    typeof input.repositoryRevision === "string" &&
    /^[0-9a-f]{40,64}$/u.test(input.repositoryRevision) &&
    typeof input.runtimeExecutionCapability === "object" &&
    input.runtimeExecutionCapability !== null &&
    !utilTypes.isProxy(input.runtimeExecutionCapability) &&
    input.cancellationSignal instanceof AbortSignal &&
    (input.observeStarted === undefined ||
      typeof input.observeStarted === "function") &&
    (input.observeResultDelivery === undefined ||
      typeof input.observeResultDelivery === "function");
  if (!valid)
    return Object.freeze({
      contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      repositoryRevision: null,
      status: "blocked",
      reason: "single_task_input_invalid",
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
    });
  const attemptId = input.attemptId;
  const authorityBindingId = input.authorityBindingId;
  const repositoryRevision = input.repositoryRevision;
  const completed = await runCoordinatorTaskAttempt(
    {
      ...dependencies,
      startTask: (...args) => {
        const started = dependencies.startTask(...args);
        if (input.observeResultDelivery) {
          let delivery: ProjectRuntimeTaskResultDelivery | null = null;
          try {
            const descriptor =
              started &&
              typeof started === "object" &&
              !utilTypes.isProxy(started)
                ? Object.getOwnPropertyDescriptor(started, "controlCapability")
                : undefined;
            if (descriptor && "value" in descriptor)
              delivery =
                dependencies.captureResultDelivery?.(descriptor.value) ?? null;
          } catch {
            // 捕捉失敗は元TaskのEffectなしを意味しない。通常完了観測を維持する。
          }
          try {
            input.observeResultDelivery(delivery);
          } catch {
            // 上位通知失敗でも開始済みTaskの完了・取消・清掃を待つ。
          }
        }
        return started;
      },
    },
    input,
  );
  return Object.freeze({
    ...completed,
    contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    attemptId,
    authorityBindingId,
    repositoryRevision,
  });
}
/**
 * Project Runtime Single Task Adapter 契約の公開契約を記述する。
 *
 * @responsibility Project Runtime Single Task Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeSingleTaskAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeSingleTaskAdapterContractの入力契約を満たす。
 * @postcondition describeProjectRuntimeSingleTaskAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeSingleTaskAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeSingleTaskAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeSingleTaskAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeProjectRuntimeSingleTaskAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProjectRuntimeSingleTaskAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeSingleTaskAdapterContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    contractRevision: PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
    taskRequestSchemaOwnership: "single_task_runtime",
    projectStateOwnership: "none",
    followUpTaskCreation: "none",
    acceptanceOwnership: "none",
    unknownSettlement: "fail_closed_manual_recovery",
    effectCancellationRepresentation:
      "pre_effect_and_confirmed_post_effect_cleanup_normalized_to_project_cancelled_other_effect_era_results_preserved",
  });
}
