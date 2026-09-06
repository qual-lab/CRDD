import {
  createProjectRuntimeObjectiveResult,
  describeProjectRuntimeObjectiveIntakeContract,
  inspectProjectRuntimeObjectivePlan,
  inspectProjectRuntimeObjectiveRequest,
  runProjectRuntimeObjectiveApplication,
  type ProjectRuntimeExecutionDependencies,
  type ProjectRuntimeObjectiveRequest,
  type ProjectRuntimeState,
} from "../../../project-runtime/src/index.ts";
import { createProjectRuntimePersistencePorts } from "./project-runtime-durable-foundation.ts";
import { createProjectRuntimeExecutionHostPorts } from "./project-runtime-execution-host-adapter.ts";
import {
  createProjectRuntimeTaskRecoveryAdapter,
  type ProjectRuntimeTaskRecoveryHostDependencies,
} from "./project-runtime-task-recovery-adapter.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export {
  describeProjectRuntimeObjectiveIntakeContract,
  inspectProjectRuntimeObjectiveRequest,
  type ProjectRuntimeObjectiveRequest,
};

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

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

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

function blocked(request: ProjectRuntimeObjectiveRequest, reason: string) {
  return createProjectRuntimeObjectiveResult(request, {
    status: "blocked",
    reason,
  });
}

/** Verify Host inputs and compose the transport-independent Project Runtime. */
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
