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
} from "../../../coordinator/src/index.ts";
import {
  ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
  type OrchestratorSingleTaskAttemptInput,
  type OrchestratorSingleTaskResult,
  type OrchestratorTaskResultDelivery,
} from "./executor.ts";
export const ORCHESTRATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS =
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS;
/**
 * 単一Task実行と結果配送の捕捉に必要な依存契約を定義する。
 *
 * @responsibility Coordinatorへの実行依存とOrchestratorの結果配送捕捉を結合する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskDependenciesに任意のcaptureResultDelivery関数を加える。
 * @invariant 配送捕捉の欠落やnullを耐久受領の成功へ読み替えない。
 * @boundary CoordinatorのTask実行とOrchestratorの結果受領の間。
 * @security controlCapabilityは配送捕捉へ渡し、公開結果へ直接露出しない。
 * @compatibility Coordinatorの依存契約を維持し、配送捕捉を追加の結合点として扱う。
 */
export type OrchestratorSingleTaskDependencies = CoordinatorTaskDependencies &
  Readonly<{
    captureResultDelivery?: (
      controlCapability: unknown,
    ) => OrchestratorTaskResultDelivery | null;
  }>;
/**
 * IF-SINGLE-TASK adapter: run exactly one task attempt on the existing v0.18
 *
 * @responsibility Orchestrator Single Task Attemptの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: OrchestratorSingleTaskDependencies、input: OrchestratorSingleTaskAttemptInput
 * @returns Promise<OrchestratorSingleTaskResult>を返す。
 * @precondition 「dependencies: OrchestratorSingleTaskDependencies、input: OrchestratorSingleTaskAttemptInput」がrunOrchestratorSingleTaskAttemptの入力契約を満たす。
 * @postcondition runOrchestratorSingleTaskAttemptの責務を完了した結果だけを返す。
 * @effect 共通Task処理へ検証済み入力を渡し、許可された実行・取消を委譲する。
 * @failure runOrchestratorSingleTaskAttemptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runOrchestratorSingleTaskAttemptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runOrchestratorSingleTaskAttemptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runOrchestratorSingleTaskAttemptは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runOrchestratorSingleTaskAttempt(
  dependencies: OrchestratorSingleTaskDependencies,
  input: OrchestratorSingleTaskAttemptInput,
): Promise<OrchestratorSingleTaskResult> {
  const ids =
    input && typeof input === "object"
      ? [input.attemptId, input.operationId, input.authorityBindingId]
      : [];
  const isValidInput =
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
  if (!isValidInput)
    return Object.freeze({
      contract: ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT,
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
          let delivery: OrchestratorTaskResultDelivery | null = null;
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
    contract: ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT,
    attemptId,
    authorityBindingId,
    repositoryRevision,
  });
}
/**
 * Orchestrator Single Task Adapter 契約の公開契約を記述する。
 *
 * @responsibility Orchestrator Single Task Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeOrchestratorSingleTaskAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeOrchestratorSingleTaskAdapterContractの入力契約を満たす。
 * @postcondition describeOrchestratorSingleTaskAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeOrchestratorSingleTaskAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeOrchestratorSingleTaskAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeOrchestratorSingleTaskAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeOrchestratorSingleTaskAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeOrchestratorSingleTaskAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeOrchestratorSingleTaskAdapterContract() {
  return Object.freeze({
    contract: ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT,
    contractRevision: ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
    taskRequestSchemaOwnership: "single_task_runtime",
    projectStateOwnership: "none",
    followUpTaskCreation: "none",
    acceptanceOwnership: "none",
    unknownSettlement: "fail_closed_manual_recovery",
    effectCancellationRepresentation:
      "pre_effect_and_confirmed_post_effect_cleanup_normalized_to_project_cancelled_other_effect_era_results_preserved",
  });
}
