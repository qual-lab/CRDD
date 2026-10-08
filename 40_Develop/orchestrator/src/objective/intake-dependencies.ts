/**
 * OrchestratorのObjective受付を現在状態保存とTask実行へ接続する。
 *
 * @responsibility OrchestratorObjectiveIntakeDependenciesを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import {
  createOrchestratorObjectiveResult,
  inspectOrchestratorObjectivePlan,
} from "./plan.ts";
import {
  describeOrchestratorObjectiveIntakeContract,
  executeOrchestratorObjective,
} from "./execute.ts";
import {
  inspectOrchestratorObjectiveRequest,
  type OrchestratorObjectiveRequest,
} from "./request.ts";
import type { OrchestratorExecutionDependencies } from "../task/dispatch.ts";
import type { OrchestratorState } from "../state/transitions.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import {
  createOrchestratorSnapshotPersistencePorts,
  inspectOrchestratorSnapshotIntake,
  maintainOrchestratorSnapshot,
} from "../storage/current-state.ts";
import { createOrchestratorExecutionHostPorts } from "../task/host-adapter.ts";
import {
  createOrchestratorTaskRecoveryAdapter,
  type OrchestratorTaskRecoveryHostDependencies,
} from "../task/recovery-adapter.ts";

export {
  describeOrchestratorObjectiveIntakeContract,
  inspectOrchestratorObjectiveRequest,
  type OrchestratorObjectiveRequest,
};

/**
 * orchestrator-objective-intakeで使用するOrchestrator Objective Intake Dependenciesの値契約を定義する。
 *
 * @responsibility Orchestrator Objective Intake DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorObjectiveIntakeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorObjectiveIntakeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorObjectiveIntakeDependenciesの宣言は外部境界を開かない。
 * @security OrchestratorObjectiveIntakeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorObjectiveIntakeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorObjectiveIntakeDependencies = Readonly<{
  authenticatedPrincipalId: string;
  verifyProjectBinding: (
    input: Readonly<{
      projectId: string;
      milestoneId: string;
      repositoryRevision: string;
    }>,
  ) => unknown;
  planObjective: (
    request: OrchestratorObjectiveRequest,
    bindingCapability: object,
  ) => unknown;
  createTaskExecutions: (
    request: OrchestratorObjectiveRequest,
    bindingCapability: object,
    state: OrchestratorState,
  ) => unknown;
  observeLeaseOwner: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  execution: Omit<
    OrchestratorExecutionDependencies,
    "persistence" | "clockIdentity" | "processSafety"
  >;
}> &
  OrchestratorTaskRecoveryHostDependencies;

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security validIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Bindingを観測する。
 *
 * @responsibility Bindingの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、revision: string
 * @returns inspectBindingの計算結果を返す。
 * @precondition 「raw: unknown、revision: string」がinspectBindingの入力契約を満たす。
 * @postcondition inspectBindingの責務を完了した結果だけを返す。
 * @effect N/A: inspectBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectBindingは独自の失敗分岐を所有しない。
 * @invariant inspectBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectBindingはProcess内の同一Subsystemで完結する。
 * @security inspectBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectBindingは共有非同期状態を持たない同期処理である。
 */
function inspectBinding(raw: unknown, revision: string) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "repositoryBindingId",
      "repositoryRevision",
      "workingDirectory",
      "repositoryRoot",
      "bindingCapability",
    ] as const),
  );
  if (!value) return null;
  return value.status === "verified" &&
    validId(value.repositoryBindingId) &&
    value.repositoryRevision === revision &&
    typeof value.workingDirectory === "string" &&
    value.workingDirectory.length > 0 &&
    value.repositoryRoot !== null &&
    (typeof value.repositoryRoot === "object" ||
      typeof value.repositoryRoot === "string") &&
    value.bindingCapability !== null &&
    typeof value.bindingCapability === "object"
    ? Object.freeze({
        repositoryBindingId: value.repositoryBindingId,
        repositoryRevision: revision,
        workingDirectory: value.workingDirectory,
        repositoryRoot: value.repositoryRoot,
        bindingCapability: value.bindingCapability,
      })
    : null;
}

/**
 * orchestrator-objective-intakeを停止結果として構築する。
 *
 * @responsibility orchestrator-objective-intakeの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input request: OrchestratorObjectiveRequest、reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「request: OrchestratorObjectiveRequest、reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(request: OrchestratorObjectiveRequest, reason: string) {
  return createOrchestratorObjectiveResult(request, {
    status: "blocked",
    reason,
  });
}

/**
 * Verify Host inputs and compose the transport-independent Orchestrator.
 *
 * @responsibility Orchestrator Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: OrchestratorObjectiveIntakeDependencies、rawRequest: unknown、cancellationSignal: AbortSignal
 * @returns runOrchestratorObjectiveの計算結果を返す。
 * @precondition 「dependencies: OrchestratorObjectiveIntakeDependencies、rawRequest: unknown、cancellationSignal: AbortSignal」がrunOrchestratorObjectiveの入力契約を満たす。
 * @postcondition runOrchestratorObjectiveの責務を完了した結果だけを返す。
 * @effect N/A: runOrchestratorObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runOrchestratorObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runOrchestratorObjectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runOrchestratorObjectiveはProcess内の同一Subsystemで完結する。
 * @security runOrchestratorObjectiveはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runOrchestratorObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runOrchestratorObjective(
  dependencies: OrchestratorObjectiveIntakeDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  const request = inspectOrchestratorObjectiveRequest(rawRequest);
  if (
    !request ||
    !(cancellationSignal instanceof AbortSignal) ||
    !validId(dependencies.authenticatedPrincipalId)
  )
    return blocked(
      Object.freeze({
        requestId: "invalid",
        projectId: "invalid",
        milestoneId: "invalid",
      }) as OrchestratorObjectiveRequest,
      "orchestrator_objective_request_invalid",
    );

  let rawBinding: unknown;
  try {
    rawBinding = dependencies.verifyProjectBinding({
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      repositoryRevision: request.repositoryRevision,
    });
  } catch {
    rawBinding = null;
  }
  const binding = inspectBinding(rawBinding, request.repositoryRevision);
  if (!binding) return blocked(request, "orchestrator_binding_not_verified");

  let rawPlan: unknown;
  try {
    rawPlan = dependencies.planObjective(request, binding.bindingCapability);
  } catch {
    rawPlan = null;
  }
  const plan = inspectOrchestratorObjectivePlan(rawPlan, request);
  if (!plan)
    return blocked(request, "orchestrator_plan_invalid_or_out_of_scope");

  const hostPorts = createOrchestratorExecutionHostPorts();
  const intake = {
    epoch: request.intakeEpoch,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: hostPorts.clockIdentity.createStableId("queue", [
      binding.repositoryBindingId,
      request.projectId,
      request.milestoneId,
      request.requestId,
      dependencies.authenticatedPrincipalId,
    ]),
    requestHash: hostPorts.clockIdentity.createContentHash(
      JSON.stringify({
        ...request,
        authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
        acceptanceCriteria: [...request.acceptanceCriteria],
        allowedPaths: [...request.allowedPaths],
        readPaths: [...request.readPaths],
      }),
    ),
  };
  const admitted = inspectOrchestratorSnapshotIntake(
    binding.workingDirectory,
    binding.repositoryBindingId,
    intake,
  );
  if (admitted.status !== "completed")
    return createOrchestratorObjectiveResult(request, {
      status: "blocked",
      reason: admitted.reason,
      cleanupConfirmed: !admitted.manualRecoveryRequired,
      manualRecoveryRequired: admitted.manualRecoveryRequired,
      recoveryIds: admitted.recoveryId ? [admitted.recoveryId] : [],
      effectState: admitted.manualRecoveryRequired ? "unknown" : "no_effect",
    });
  const result = await executeOrchestratorObjective(
    {
      authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
      repositoryBindingId: binding.repositoryBindingId,
      repositoryRoot: binding.repositoryRoot,
      plan,
      persistence: createOrchestratorSnapshotPersistencePorts(
        binding.workingDirectory,
        binding.repositoryBindingId,
        request.intakeEpoch,
        intake,
      ),
      clockIdentity: hostPorts.clockIdentity,
      processSafety: hostPorts.processSafety,
      taskRecovery: createOrchestratorTaskRecoveryAdapter(
        binding.workingDirectory,
        binding.repositoryBindingId,
        dependencies,
      ),
      createTaskExecutions: (objectiveRequest, state) =>
        dependencies.createTaskExecutions(
          objectiveRequest,
          binding.bindingCapability,
          state,
        ),
      observeLeaseOwner: dependencies.observeLeaseOwner,
      execution: dependencies.execution,
    },
    request,
    cancellationSignal,
  );
  if (result.status === "blocked") return result;
  const maintenance = maintainOrchestratorSnapshot(
    binding.workingDirectory,
    binding.repositoryBindingId,
  );
  if (maintenance.status !== "completed")
    return createOrchestratorObjectiveResult(request, {
      ...result,
      status: "blocked",
      projection:
        result.projection?.milestoneState === "accepted"
          ? null
          : result.projection,
      reason: `${result.status === "cancelled" ? "orchestrator_cancelled_" : ""}${maintenance.reason}`,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  return result;
}
