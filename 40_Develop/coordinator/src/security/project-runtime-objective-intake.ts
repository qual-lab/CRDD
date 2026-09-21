import {
  createProjectRuntimeObjectiveResult,
  describeProjectRuntimeObjectiveIntakeContract,
  inspectProjectRuntimeObjectivePlan,
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeExecutionDependencies,
  type ProjectRuntimeObjectiveRequest,
  type ProjectRuntimeState,
  runProjectRuntimeObjectiveApplication,
} from "../../../project-runtime/src/index.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { createProjectRuntimePersistencePorts } from "./project-runtime-durable-foundation.ts";
import { createProjectRuntimeExecutionHostPorts } from "./project-runtime-execution-host-adapter.ts";
import {
  createProjectRuntimeTaskRecoveryAdapter,
  type ProjectRuntimeTaskRecoveryHostDependencies,
} from "./project-runtime-task-recovery-adapter.ts";

export {
  describeProjectRuntimeObjectiveIntakeContract,
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeObjectiveRequest,
};

/**
 * ProjectRuntimeObjectiveIntakeDependenciesが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeObjectiveIntakeDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeObjectiveIntakeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeObjectiveIntakeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeObjectiveIntakeDependenciesの宣言は外部境界を開かない。
 * @security ProjectRuntimeObjectiveIntakeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeObjectiveIntakeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeObjectiveIntakeDependencies = Readonly<{
  authenticatedPrincipalId: string;
  verifyProjectBinding: (
    input: Readonly<{
      projectId: string;
      milestoneId: string;
      repositoryRevision: string;
    }>,
  ) => unknown;
  planObjective: (
    request: ProjectRuntimeObjectiveRequest,
    bindingCapability: object,
  ) => unknown;
  createTaskExecutions: (
    request: ProjectRuntimeObjectiveRequest,
    bindingCapability: object,
    state: ProjectRuntimeState,
  ) => unknown;
  observeLeaseOwner: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  execution: Omit<
    ProjectRuntimeExecutionDependencies,
    "persistence" | "clockIdentity" | "processSafety"
  >;
}> &
  ProjectRuntimeTaskRecoveryHostDependencies;

/**
 * validIdの処理を実行する。
 *
 * @responsibility validIdに対応する入力処理と結果生成を所有する。
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
 * inspectBindingの処理を実行する。
 *
 * @responsibility inspectBindingに対応する入力処理と結果生成を所有する。
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
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input request: ProjectRuntimeObjectiveRequest、reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「request: ProjectRuntimeObjectiveRequest、reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(request: ProjectRuntimeObjectiveRequest, reason: string) {
  return createProjectRuntimeObjectiveResult(request, {
    status: "blocked",
    reason,
  });
}

/**
 * Verify Host inputs and compose the transport-independent Project Runtime.
 *
 * @responsibility runProjectRuntimeObjectiveに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: ProjectRuntimeObjectiveIntakeDependencies、rawRequest: unknown、cancellationSignal: AbortSignal
 * @returns runProjectRuntimeObjectiveの計算結果を返す。
 * @precondition 「dependencies: ProjectRuntimeObjectiveIntakeDependencies、rawRequest: unknown、cancellationSignal: AbortSignal」がrunProjectRuntimeObjectiveの入力契約を満たす。
 * @postcondition runProjectRuntimeObjectiveの責務を完了した結果だけを返す。
 * @effect N/A: runProjectRuntimeObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runProjectRuntimeObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runProjectRuntimeObjectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runProjectRuntimeObjectiveはProcess内の同一Subsystemで完結する。
 * @security runProjectRuntimeObjectiveはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runProjectRuntimeObjectiveは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runProjectRuntimeObjective(
  dependencies: ProjectRuntimeObjectiveIntakeDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  const request = inspectProjectRuntimeObjectiveRequest(rawRequest);
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
      }) as ProjectRuntimeObjectiveRequest,
      "project_runtime_objective_request_invalid",
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
  if (!binding) return blocked(request, "project_runtime_binding_not_verified");

  let rawPlan: unknown;
  try {
    rawPlan = dependencies.planObjective(request, binding.bindingCapability);
  } catch {
    rawPlan = null;
  }
  const plan = inspectProjectRuntimeObjectivePlan(rawPlan, request);
  if (!plan)
    return blocked(request, "project_runtime_plan_invalid_or_out_of_scope");

  const hostPorts = createProjectRuntimeExecutionHostPorts();
  return runProjectRuntimeObjectiveApplication(
    {
      authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
      repositoryBindingId: binding.repositoryBindingId,
      repositoryRoot: binding.repositoryRoot,
      plan,
      persistence: createProjectRuntimePersistencePorts(
        binding.workingDirectory,
        binding.repositoryBindingId,
      ),
      clockIdentity: hostPorts.clockIdentity,
      processSafety: hostPorts.processSafety,
      taskRecovery: createProjectRuntimeTaskRecoveryAdapter(
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
}
