import type { ProjectRuntimePersistencePorts } from "../ports/state-port.ts";
import {
  runProjectRuntimeOperation,
  type ProjectRuntimeExecutionDependencies,
} from "./project-runtime-execution.ts";
import type { ProjectRuntimeClockIdentityPort } from "../ports/clock-identity-port.ts";
import type { ProjectRuntimeProcessSafetyPort } from "../ports/process-safety-port.ts";
import type { ProjectRuntimeTaskRecoveryPort } from "../ports/task-recovery-port.ts";
import {
  createProjectRuntimeState,
  acknowledgeProjectDockerRecoveryObligation,
  markProjectTaskRecoveryObligationRecovering,
  projectProjectRuntimeState,
  recordProjectTaskOwnerLossRecoveries,
  retrySettledProjectTaskRecoveries,
  settleProjectTaskRecoveryObligation,
  type ProjectTaskRecoveryObligation,
  type ProjectDockerRecoveryAcknowledgement,
  type ProjectRuntimeState,
} from "../core/project-runtime-state.ts";
import { snapshotPlainRecord } from "../internal/plain-data-snapshot.ts";
import {
  createProjectRuntimeObjectiveResult,
  createProjectRuntimeTaskExecutionSet,
  PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
  type ProjectRuntimeObjectivePlan,
} from "./project-runtime-objective-intake.ts";
import type { ProjectRuntimeObjectiveRequest } from "../public-contract/objective-request.ts";

export type ProjectRuntimeObjectiveApplicationDependencies = Readonly<{
  authenticatedPrincipalId: string;
  repositoryBindingId: string;
  repositoryRoot: object | string;
  plan: ProjectRuntimeObjectivePlan;
  persistence: ProjectRuntimePersistencePorts;
  clockIdentity: ProjectRuntimeClockIdentityPort;
  processSafety: ProjectRuntimeProcessSafetyPort;
  taskRecovery: ProjectRuntimeTaskRecoveryPort;
  createTaskExecutions: (
    request: ProjectRuntimeObjectiveRequest,
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
}>;

function recoveryApplicationId(
  projectId: string,
  queueId: string,
  state: ProjectRuntimeState,
  clockIdentity: ProjectRuntimeClockIdentityPort,
) {
  const recoveries = state.tasks
    .flatMap((task) =>
      task.recoveryObligations.map(
        (entry) => `${task.definition.id}:${entry.kind}:${entry.recoveryId}`,
      ),
    )
    .sort();
  return recoveries.length === 0
    ? null
    : clockIdentity.createStableId("project-recovery-application", [
        projectId,
        queueId,
        ...recoveries,
      ]);
}

function exactRecoveryCompleted(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    record.status === "recovered" &&
    record.recoveryId === null &&
    record.manualRecoveryRequired !== true
  );
}

function inspectRecoveryCorrelationBindings(
  value: unknown,
  correlationIds: readonly string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (
    record.status !== "completed" ||
    !Array.isArray(record.bindings) ||
    !Array.isArray(record.absentCorrelationIds)
  )
    return null;
  const bindings: Array<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }> = [];
  for (const item of record.bindings) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const binding = item as Readonly<Record<string, unknown>>;
    if (
      typeof binding.correlationId !== "string" ||
      !correlationIds.includes(binding.correlationId) ||
      typeof binding.recoveryId !== "string" ||
      !validId(binding.correlationId)
    )
      return null;
    bindings.push({
      operationId: binding.correlationId,
      status: "matched",
      recoveryId: binding.recoveryId,
    });
  }
  for (const correlationId of record.absentCorrelationIds) {
    if (typeof correlationId !== "string" || !validId(correlationId))
      return null;
    bindings.push({
      operationId: correlationId,
      status: "verified_absent",
      recoveryId: null,
    });
  }
  return bindings.length === correlationIds.length &&
    bindings.every((entry) => correlationIds.includes(entry.operationId)) &&
    new Set(bindings.map((entry) => entry.operationId)).size === bindings.length
    ? Object.freeze(bindings.map((entry) => Object.freeze(entry)))
    : null;
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function blocked(
  request: ProjectRuntimeObjectiveRequest,
  reason: string,
  options: Readonly<{
    queueId?: string | null;
    projection?: ReturnType<typeof projectProjectRuntimeState> | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryObligation["kind"];
      recoveryId: string;
    }>[];
    effectState?: "no_effect" | "settled" | "unknown";
  }> = {},
) {
  return createProjectRuntimeObjectiveResult(request, {
    status: "blocked",
    reason,
    ...options,
  });
}

/** Coordinate one validated Objective through the Project Runtime lifecycle. */
export async function runProjectRuntimeObjectiveApplication(
  dependencies: ProjectRuntimeObjectiveApplicationDependencies,
  request: ProjectRuntimeObjectiveRequest,
  cancellationSignal: AbortSignal,
) {
  if (
    !(cancellationSignal instanceof AbortSignal) ||
    !validId(dependencies.authenticatedPrincipalId)
  )
    return blocked(request, "project_runtime_objective_request_invalid");
  const plan = dependencies.plan;
  const queueId = dependencies.clockIdentity.createStableId("queue", [
    dependencies.repositoryBindingId,
    request.projectId,
    request.milestoneId,
    request.requestId,
    dependencies.authenticatedPrincipalId,
  ]);
  const requestHash = dependencies.clockIdentity.createContentHash(
    JSON.stringify({
      ...request,
      authenticatedPrincipalId: dependencies.authenticatedPrincipalId,
      acceptanceCriteria: [...request.acceptanceCriteria],
      allowedPaths: [...request.allowedPaths],
      readPaths: [...request.readPaths],
    }),
  );
  const scopeHash = dependencies.clockIdentity.createContentHash(
    JSON.stringify({
      allowedPaths: request.allowedPaths,
      readPaths: request.readPaths,
    }),
  );

  const persistence = dependencies.persistence;
  const taskRecovery = dependencies.taskRecovery;
  const acquisitionOwner = persistence.lease.inspectAcquisitionOwner();
  if (acquisitionOwner.status !== "completed")
    return blocked(request, acquisitionOwner.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: acquisitionOwner.manualRecoveryRequired,
      recoveryIds:
        acquisitionOwner.recoveryId === null
          ? Object.freeze([])
          : Object.freeze([acquisitionOwner.recoveryId]),
      effectState: acquisitionOwner.manualRecoveryRequired
        ? "unknown"
        : "no_effect",
    });
  const resolvedAcquisition = acquisitionOwner.value.acquisition;
  if (
    resolvedAcquisition !== null &&
    resolvedAcquisition.projectId !== request.projectId
  )
    return blocked(
      request,
      "project_runtime_lease_acquisition_project_identity_mismatch",
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryIds: Object.freeze([resolvedAcquisition.recoveryId]),
        effectState: "unknown",
      },
    );
  const observedState = persistence.state.readState(request.projectId);
  let state = observedState;
  if (state.status !== "completed")
    return blocked(request, state.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  if (state.value === null) {
    const created = createProjectRuntimeState({
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      repositoryRevision: request.repositoryRevision,
      maximumConcurrency: request.maximumConcurrency,
      milestoneAcceptanceCriteria: plan.milestoneAcceptanceCriteria,
      objectives: plan.objectives,
      tasks: plan.tasks,
      ownerGeneration: dependencies.processSafety.getProcessInstanceIdentity(),
    });
    if (created.status !== "completed") return blocked(request, created.reason);
    const written = persistence.state.writeState(created.state, 0);
    if (written.status !== "completed")
      return blocked(request, written.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: written.manualRecoveryRequired,
        effectState: "unknown",
      });
    state = Object.freeze({
      status: "completed" as const,
      reason: written.reason,
      value: written.value,
    });
  } else if (
    state.value.milestoneId !== request.milestoneId ||
    state.value.repositoryRevision !== request.repositoryRevision
  ) {
    return blocked(request, "project_runtime_existing_state_identity_mismatch");
  }
  const queued = persistence.state.enqueueOperation({
    queueId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    requestHash,
    originLane: request.originLane,
    repositoryRevision: request.repositoryRevision,
    scopeHash,
  });
  if (queued.status !== "completed")
    return blocked(request, queued.reason, {
      cleanupConfirmed: false,
      manualRecoveryRequired: queued.manualRecoveryRequired,
      effectState: queued.manualRecoveryRequired ? "unknown" : "no_effect",
    });
  let queue = queued.value;
  const recoveryQueueId =
    resolvedAcquisition?.queueId ??
    (queue.ownerGeneration === null ? null : queueId);
  if (recoveryQueueId !== null) {
    const reconciled = persistence.lease.reconcileOperationOwnerLoss(
      request.projectId,
      recoveryQueueId,
      dependencies.observeLeaseOwner,
    );
    if (
      reconciled.status !== "completed" &&
      reconciled.reason === "project_runtime_lease_owner_still_active" &&
      recoveryQueueId === queueId &&
      state.value
    )
      return createProjectRuntimeObjectiveResult(request, {
        status: "blocked",
        reason: "project_runtime_objective_already_running",
        queueId,
        projection: projectProjectRuntimeState(state.value),
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        recoveryIds: Object.freeze([]),
        recoveryObligations: Object.freeze([]),
        effectState: "no_effect" as const,
      });
    if (
      reconciled.status !== "completed" &&
      reconciled.reason !== "project_runtime_lease_owner_still_active"
    )
      return blocked(request, reconciled.reason, {
        cleanupConfirmed: !reconciled.manualRecoveryRequired,
        manualRecoveryRequired: reconciled.manualRecoveryRequired,
        recoveryIds:
          reconciled.recoveryId === null
            ? Object.freeze([])
            : Object.freeze([reconciled.recoveryId]),
        effectState: reconciled.manualRecoveryRequired
          ? "unknown"
          : "no_effect",
      });
    const reread = persistence.state.readQueue(queueId);
    if (reread.status !== "completed")
      return blocked(request, reread.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: reread.manualRecoveryRequired,
        effectState: "unknown",
      });
    queue = reread.value;
  }
  if (
    queue.state === "recovery_required" &&
    queue.resumeCondition === "owner_loss" &&
    state.value
  ) {
    const activeTasks = state.value.tasks.filter((task) =>
      ["starting", "running"].includes(task.state),
    );
    const operationIds = activeTasks
      .map((task) => task.operationId)
      .filter((value): value is string => value !== null);
    let applicationId = recoveryApplicationId(
      request.projectId,
      queueId,
      state.value,
      dependencies.clockIdentity,
    );
    if (applicationId === null && activeTasks.length > 0) {
      let bindings: ReturnType<typeof inspectRecoveryCorrelationBindings> =
        Object.freeze([]);
      if (operationIds.length > 0) {
        let rawBindings: unknown;
        try {
          rawBindings = taskRecovery.resolveCorrelations(operationIds);
        } catch {
          rawBindings = null;
        }
        bindings = inspectRecoveryCorrelationBindings(
          rawBindings,
          operationIds,
        );
      }
      if (!bindings)
        return blocked(
          request,
          "project_runtime_owner_loss_recovery_unresolved",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          },
        );
      const bound = recordProjectTaskOwnerLossRecoveries(
        state.value,
        state.value.generation,
        bindings,
      );
      if (bound.status !== "completed" || !bound.state)
        return blocked(request, bound.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      const boundWrite = persistence.state.writeState(
        bound.state,
        state.value.generation,
      );
      if (boundWrite.status !== "completed")
        return blocked(request, boundWrite.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      state = Object.freeze({
        status: "completed" as const,
        reason: boundWrite.reason,
        value: boundWrite.value,
      });
      for (const task of boundWrite.value.tasks) {
        for (const obligation of task.recoveryObligations) {
          await taskRecovery.observeTransition({
            phase: "required",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: task.definition.id,
            operationId: task.operationId,
            recoveryId: obligation.recoveryId,
            stateGeneration: boundWrite.value.generation,
          });
        }
      }
      applicationId = recoveryApplicationId(
        request.projectId,
        queueId,
        boundWrite.value,
        dependencies.clockIdentity,
      );
    }
    if (!applicationId) {
      const remainingActiveTasks = (state.value?.tasks ?? []).filter((task) =>
        ["starting", "running"].includes(task.state),
      );
      if (remainingActiveTasks.length > 0)
        return blocked(
          request,
          "project_runtime_owner_loss_recovery_unresolved",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          },
        );
      const reopenedQueue = persistence.state.updateQueue(
        queueId,
        queue.generation,
        {
          state: "queued",
          lease: null,
          resumeCondition: null,
          resultReference: null,
        },
      );
      if (reopenedQueue.status !== "completed")
        return blocked(request, reopenedQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reopenedQueue.value;
    } else {
      const reboundQueue = persistence.state.updateQueue(
        queueId,
        queue.generation,
        {
          state: "recovery_required",
          lease: null,
          resumeCondition: "exact_recovery",
          resultReference: applicationId,
        },
      );
      if (reboundQueue.status !== "completed")
        return blocked(request, reboundQueue.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = reboundQueue.value;
    }
  }
  if (
    (queue.state === "recovery_required" ||
      (queue.state === "queued" &&
        queue.resumeCondition === "exact_recovery_settled")) &&
    state.value
  ) {
    let recoveryState = state.value;
    const recoveryApplication = recoveryApplicationId(
      request.projectId,
      queueId,
      recoveryState,
      dependencies.clockIdentity,
    );
    const unresolvedTasks = recoveryState.tasks.filter(
      (task) => task.state === "recovery_required" && task.recoveryUnresolved,
    );
    const recoveries = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations.map((entry) =>
        Object.freeze({ taskId: task.definition.id, ...entry }),
      ),
    );
    const publicRecoveryObligations = recoveries.map(({ kind, recoveryId }) =>
      Object.freeze({ kind, recoveryId }),
    );
    if (unresolvedTasks.length > 0)
      return blocked(request, "project_runtime_recovery_result_unresolved", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveries.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    if (!recoveryApplication || queue.resultReference !== recoveryApplication)
      return blocked(request, "project_runtime_recovery_identity_mismatch", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveries.map((entry) => entry.recoveryId),
        recoveryObligations: publicRecoveryObligations,
      });
    if (queue.state === "recovery_required") {
      for (const item of recoveries.filter(
        (entry) =>
          ["docker", "runtime_process"].includes(entry.kind) &&
          entry.phase !== "settled" &&
          entry.phase !== "acknowledged",
      )) {
        if (item.phase === "required") {
          const recovering = markProjectTaskRecoveryObligationRecovering(
            recoveryState,
            recoveryState.generation,
            item.taskId,
            item.kind,
            item.recoveryId,
          );
          if (recovering.status !== "completed" || !recovering.state)
            return blocked(request, recovering.reason, {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
              ],
            });
          const recoveringWrite = persistence.state.writeState(
            recovering.state,
            recoveryState.generation,
          );
          if (recoveringWrite.status !== "completed")
            return blocked(request, recoveringWrite.reason, {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
              ],
            });
          state = Object.freeze({
            status: "completed" as const,
            reason: recoveringWrite.reason,
            value: recoveringWrite.value,
          });
          recoveryState = recoveringWrite.value;
          await taskRecovery.observeTransition({
            phase: "recovering",
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            queueId,
            taskId: item.taskId,
            operationId:
              recoveryState.tasks.find(
                (entry) => entry.definition.id === item.taskId,
              )?.operationId ?? null,
            recoveryId: item.recoveryId,
            stateGeneration: recoveryState.generation,
          });
        }
        let recovery: unknown;
        if (item.kind === "runtime_process") {
          const task = recoveryState.tasks.find(
            (entry) => entry.definition.id === item.taskId,
          );
          const match =
            task?.attemptId && task.operationId
              ? dependencies.processSafety.inspectRecoveryIdentity(
                  item.recoveryId,
                  task.attemptId,
                  task.operationId,
                )
              : null;
          recovery =
            match &&
            match.processIdentity !==
              dependencies.processSafety.getProcessInstanceIdentity()
              ? Object.freeze({
                  status: "recovered" as const,
                  recoveryId: null,
                  manualRecoveryRequired: false,
                })
              : null;
        } else {
          try {
            recovery = taskRecovery.recover(item.recoveryId);
          } catch {
            recovery = null;
          }
        }
        if (!exactRecoveryCompleted(recovery))
          return blocked(request, "project_runtime_task_recovery_not_settled", {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        const settledItem = settleProjectTaskRecoveryObligation(
          recoveryState,
          recoveryState.generation,
          item.taskId,
          item.kind,
          item.recoveryId,
        );
        if (settledItem.status !== "completed" || !settledItem.state)
          return blocked(request, settledItem.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        const settledWrite = persistence.state.writeState(
          settledItem.state,
          recoveryState.generation,
        );
        if (settledWrite.status !== "completed")
          return blocked(request, settledWrite.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          });
        state = Object.freeze({
          status: "completed" as const,
          reason: settledWrite.reason,
          value: settledWrite.value,
        });
        recoveryState = settledWrite.value;
        await taskRecovery.observeTransition({
          phase: "settled",
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId,
          taskId: item.taskId,
          operationId:
            recoveryState.tasks.find(
              (entry) => entry.definition.id === item.taskId,
            )?.operationId ?? null,
          recoveryId: item.recoveryId,
          stateGeneration: recoveryState.generation,
        });
      }
    }
    for (const item of recoveries.filter((entry) => entry.kind === "docker")) {
      const settledTask = recoveryState.tasks.find(
        (entry) => entry.definition.id === item.taskId,
      );
      if (
        !settledTask?.attemptId ||
        !settledTask.operationId ||
        !settledTask.recoveryObligations.some(
          (entry) =>
            entry.kind === "docker" &&
            entry.recoveryId === item.recoveryId &&
            ["settled", "acknowledged"].includes(entry.phase),
        )
      )
        return blocked(
          request,
          "project_runtime_task_recovery_acknowledgement_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          },
        );
      let currentObligation = settledTask.recoveryObligations.find(
        (entry) =>
          entry.kind === "docker" && entry.recoveryId === item.recoveryId,
      );
      if (currentObligation?.phase === "settled") {
        let acknowledgementResult: unknown;
        try {
          acknowledgementResult = taskRecovery.acknowledgeDocker(
            Object.freeze({
              projectId: request.projectId,
              milestoneId: request.milestoneId,
              stateGeneration: recoveryState.generation,
              taskId: item.taskId,
              attemptId: settledTask.attemptId,
              operationId: settledTask.operationId,
              kind: "docker" as const,
              recoveryId: item.recoveryId,
            }),
          );
        } catch {
          acknowledgementResult = null;
        }
        const acknowledged = snapshotPlainRecord(
          acknowledgementResult,
          new Set(["status", "reason", "acknowledgement"]),
        );
        const evidence = snapshotPlainRecord(
          acknowledged?.acknowledgement,
          new Set([
            "runtimeStateBinding",
            "receiptContentHash",
            "receiptContentIdentity",
          ]),
        );
        const runtimeStateBinding = snapshotPlainRecord(
          evidence?.runtimeStateBinding,
          new Set([
            "runtimeStateIdentityHash",
            "runtimeStateProtectionHash",
            "localUserBindingHash",
            "runtimeStateBindingHash",
          ]),
        );
        if (
          acknowledged?.status !== "completed" ||
          typeof acknowledged.reason !== "string" ||
          !evidence ||
          !runtimeStateBinding
        )
          return blocked(
            request,
            "project_runtime_task_recovery_acknowledgement_not_settled",
            {
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
              recoveryIds: [item.recoveryId],
              recoveryObligations: [
                Object.freeze({
                  kind: item.kind,
                  recoveryId: item.recoveryId,
                }),
              ],
            },
          );
        const durableAcknowledgement = Object.freeze({
          repositoryBindingId: dependencies.repositoryBindingId,
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          taskId: item.taskId,
          attemptId: settledTask.attemptId,
          operationId: settledTask.operationId,
          recoveryId: item.recoveryId,
          settlementGeneration: recoveryState.generation,
          runtimeStateBinding,
          receiptContentHash: String(evidence.receiptContentHash),
          receiptContentIdentity: String(evidence.receiptContentIdentity),
        }) as ProjectDockerRecoveryAcknowledgement;
        const marked = acknowledgeProjectDockerRecoveryObligation(
          recoveryState,
          recoveryState.generation,
          durableAcknowledgement,
        );
        if (marked.status !== "completed" || !marked.state)
          return blocked(request, marked.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          });
        const markedWrite = persistence.state.writeState(
          marked.state,
          recoveryState.generation,
        );
        if (markedWrite.status !== "completed")
          return blocked(request, markedWrite.reason, {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          });
        recoveryState = markedWrite.value;
        state = Object.freeze({
          status: "completed" as const,
          reason: markedWrite.reason,
          value: markedWrite.value,
        });
        await taskRecovery.observeTransition({
          phase: "acknowledged",
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          queueId,
          taskId: item.taskId,
          operationId: settledTask.operationId,
          recoveryId: item.recoveryId,
          stateGeneration: recoveryState.generation,
        });
        currentObligation = recoveryState.tasks
          .find((entry) => entry.definition.id === item.taskId)
          ?.recoveryObligations.find(
            (entry) =>
              entry.kind === "docker" && entry.recoveryId === item.recoveryId,
          );
      }
      if (
        currentObligation?.phase !== "acknowledged" ||
        !currentObligation.acknowledgement
      )
        return blocked(
          request,
          "project_runtime_task_recovery_acknowledgement_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
          },
        );
      let finalized: unknown;
      try {
        finalized = taskRecovery.finalizeDockerAcknowledgement(
          Object.freeze({
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            stateGeneration: recoveryState.generation,
            taskId: item.taskId,
            attemptId: settledTask.attemptId,
            operationId: settledTask.operationId,
            kind: "docker" as const,
            recoveryId: item.recoveryId,
          }),
          currentObligation.acknowledgement,
        );
      } catch {
        finalized = null;
      }
      const finalResult = snapshotPlainRecord(
        finalized,
        new Set(["status", "reason"]),
      );
      if (
        finalResult?.status !== "completed" ||
        typeof finalResult.reason !== "string"
      )
        return blocked(
          request,
          "project_runtime_task_recovery_acknowledgement_gc_not_settled",
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            effectState: "unknown",
            recoveryIds: [item.recoveryId],
            recoveryObligations: [
              Object.freeze({ kind: item.kind, recoveryId: item.recoveryId }),
            ],
          },
        );
      await taskRecovery.observeTransition({
        phase: "verification_resources_finalized",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: item.taskId,
        operationId: settledTask.operationId,
        recoveryId: item.recoveryId,
        stateGeneration: recoveryState.generation,
      });
    }
    const externallyOwnedItems = recoveryState.tasks.flatMap((task) =>
      task.recoveryObligations
        .filter(
          (entry) =>
            !["docker", "runtime_process"].includes(entry.kind) &&
            entry.phase !== "settled",
        )
        .map((entry) => ({ taskId: task.definition.id, ...entry })),
    );
    if (externallyOwnedItems.length > 0)
      return blocked(request, "project_runtime_external_recovery_required", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
        recoveryIds: recoveryState.tasks.flatMap((task) =>
          task.recoveryObligations
            .filter(
              (entry) =>
                entry.phase !==
                (entry.kind === "docker" ? "acknowledged" : "settled"),
            )
            .map((entry) => entry.recoveryId),
        ),
        recoveryObligations: recoveryState.tasks.flatMap((task) =>
          task.recoveryObligations
            .filter(
              (entry) =>
                entry.phase !==
                (entry.kind === "docker" ? "acknowledged" : "settled"),
            )
            .map(({ kind, recoveryId }) => Object.freeze({ kind, recoveryId })),
        ),
      });
    if (queue.state === "recovery_required") {
      const queueSettlement = persistence.state.settleQueueRecovery(
        queueId,
        queue.generation,
        recoveryApplication,
      );
      if (queueSettlement.status !== "completed")
        return blocked(request, queueSettlement.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      queue = queueSettlement.value;
      await taskRecovery.observeTransition({
        phase: "queue_settled",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
    const retryTaskIds = recoveryState.tasks
      .filter(
        (task) =>
          task.state === "recovery_required" &&
          !task.recoveryUnresolved &&
          task.recoveryObligations.length > 0 &&
          task.recoveryObligations.every(
            (entry) =>
              entry.phase ===
              (entry.kind === "docker" ? "acknowledged" : "settled"),
          ),
      )
      .map((task) => task.definition.id);
    if (retryTaskIds.length > 0) {
      const retry = retrySettledProjectTaskRecoveries(
        recoveryState,
        recoveryState.generation,
        retryTaskIds,
      );
      if (retry.status !== "completed")
        return blocked(request, retry.reason, {
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        });
      const retryWrite = persistence.state.writeState(
        retry.state,
        recoveryState.generation,
      );
      if (retryWrite.status !== "completed")
        return blocked(request, retryWrite.reason, {
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
      state = Object.freeze({
        status: "completed" as const,
        reason: retryWrite.reason,
        value: retryWrite.value,
      });
      recoveryState = retryWrite.value;
      await taskRecovery.observeTransition({
        phase: "retry_ready",
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId,
        taskId: null,
        operationId: null,
        recoveryId: null,
        stateGeneration: recoveryState.generation,
      });
    }
  }
  if (queue.state === "queued" || queue.state === "waiting_foreground") {
    const currentState = state.value;
    if (!currentState)
      return blocked(request, "project_runtime_state_observation_unknown", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    const selected = persistence.state.selectNextOperation();
    if (selected.status !== "completed")
      return blocked(request, selected.reason, {
        cleanupConfirmed: false,
        manualRecoveryRequired: selected.manualRecoveryRequired,
        effectState: "unknown",
      });
    if (!selected.value || selected.value.queueId !== queueId)
      return createProjectRuntimeObjectiveResult(request, {
        status: "blocked",
        reason: "project_runtime_objective_queued_waiting_foreground",
        queueId,
        projection: projectProjectRuntimeState(currentState),
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        recoveryIds: Object.freeze([]),
        recoveryObligations: Object.freeze([]),
        effectState: "no_effect" as const,
      });
  }
  if (queue.state === "integration_pending" && state.value) {
    return createProjectRuntimeObjectiveResult(request, {
      status: "completed",
      reason: "project_runtime_tasks_already_integration_pending",
      queueId,
      projection: projectProjectRuntimeState(state.value),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  }
  if (queue.state === "completed" && state.value) {
    const projection = projectProjectRuntimeState(state.value);
    if (projection.milestoneState !== "accepted")
      return blocked(request, "project_runtime_terminal_replay_mismatch", {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    return createProjectRuntimeObjectiveResult(request, {
      status: "completed",
      reason: "project_runtime_objective_already_accepted",
      queueId,
      projection,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  }
  if (queue.state === "cancelled" && state.value)
    return createProjectRuntimeObjectiveResult(request, {
      status: "cancelled",
      reason: "project_runtime_objective_already_cancelled",
      queueId,
      projection: projectProjectRuntimeState(state.value),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
      effectState: "no_effect" as const,
    });
  if (queue.state !== "queued" && state.value) {
    const manualRecoveryRequired = queue.state === "recovery_required";
    const outstandingRecoveries = state.value.tasks.flatMap((task) =>
      task.recoveryObligations.filter(
        (entry) =>
          entry.phase !==
          (entry.kind === "docker" ? "acknowledged" : "settled"),
      ),
    );
    return createProjectRuntimeObjectiveResult(request, {
      status: "blocked",
      reason: `project_runtime_objective_${queue.state}`,
      queueId,
      projection: projectProjectRuntimeState(state.value),
      cleanupConfirmed: !manualRecoveryRequired,
      manualRecoveryRequired,
      processRestartRequired: outstandingRecoveries.some(
        (entry) => entry.kind === "runtime_process",
      ),
      recoveryIds: Object.freeze(
        outstandingRecoveries.map((entry) => entry.recoveryId),
      ),
      recoveryObligations: Object.freeze(
        outstandingRecoveries.map(({ kind, recoveryId }) =>
          Object.freeze({ kind, recoveryId }),
        ),
      ),
      effectState: manualRecoveryRequired
        ? ("unknown" as const)
        : ("no_effect" as const),
    });
  }
  const executableState = state.value;
  if (!executableState)
    return blocked(request, "project_runtime_state_observation_unknown", {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  let rawExecutions: unknown;
  try {
    rawExecutions = dependencies.createTaskExecutions(request, executableState);
  } catch {
    rawExecutions = null;
  }
  const taskExecutions = createProjectRuntimeTaskExecutionSet(
    rawExecutions,
    executableState,
    dependencies.clockIdentity,
  );
  if (!taskExecutions)
    return blocked(request, "project_runtime_task_execution_set_invalid");
  const execution = await runProjectRuntimeOperation(
    {
      ...dependencies.execution,
      clockIdentity: dependencies.clockIdentity,
      processSafety: dependencies.processSafety,
      persistence,
    },
    {
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId,
      taskExecutions: taskExecutions.map((entry) =>
        Object.freeze({
          ...entry,
          repositoryRoot: dependencies.repositoryRoot,
        }),
      ),
      cancellationSignal,
    },
  );
  const latest = persistence.state.readState(request.projectId);
  const projection =
    latest.status === "completed" && latest.value
      ? projectProjectRuntimeState(latest.value)
      : null;
  return createProjectRuntimeObjectiveResult(request, {
    status: execution.status,
    reason: execution.reason,
    queueId,
    projection,
    cleanupConfirmed: execution.cleanupConfirmed,
    manualRecoveryRequired: execution.manualRecoveryRequired,
    processRestartRequired: execution.processRestartRequired,
    recoveryIds: execution.recoveryIds,
    recoveryObligations: execution.recoveryObligations,
    effectState: execution.effectState,
  });
}

export function describeProjectRuntimeObjectiveIntakeContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
    transports: Object.freeze(["cli", "mcp"]),
    duplicateRequest: "same_queue_and_latest_state_no_duplicate_effect",
    scopeExpansionByPlanner: false,
    ownerLossObservation: "platform_adapter_only",
  });
}
