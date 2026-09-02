import { createHash } from "node:crypto";

import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "./coordinator-task-runtime.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "./platform-provisioner-package-filesystem.ts";
import {
  inspectProjectRuntimeObjectiveRequest,
  runProjectRuntimeObjective,
  type ProjectRuntimeObjectiveRequest,
} from "./project-runtime-objective-intake.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "./project-runtime-candidate-integration-adapter.ts";
import { inspectMcpProjectRuntimeDecision } from "./mcp-project-runtime-adapter.ts";
import { integrateProjectRuntimeOperation } from "./project-runtime-integration.ts";
import {
  issueProjectRuntimeHumanDecision,
  projectRuntimeDecisionRecordId,
  recoverProjectRuntimeHumanDecision,
  submitProjectRuntimeHumanDecision,
} from "./project-runtime-human-decision.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "./project-runtime-windows-decision-store.ts";
import { runProjectRuntimeSingleTaskAttempt } from "./project-runtime-single-task-adapter.ts";
import {
  observeProjectRuntimePlatformFamily,
  createProjectRuntimeWindowsPlatformAdapter,
} from "./project-runtime-windows-platform-adapter.ts";
import { inspectRepositoryIdentityCandidate } from "./repository-operation-runtime.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "./repository-root-resolution.ts";

export const PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT =
  "crdd-coordinator/project-runtime-public-runtime/v1" as const;

function stable(prefix: string, ...parts: readonly string[]) {
  return `${prefix}-${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 40)}`;
}

/** Production composition shared by the CLI and MCP transports. */
export async function runProjectRuntimePublicObjective(
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
) {
  const request = inspectProjectRuntimeObjectiveRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_objective_request_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
  const observedPlatform = observeProjectRuntimePlatformFamily();
  const platform =
    observedPlatform.status === "observed" &&
    observedPlatform.platformFamily === "windows"
      ? createProjectRuntimeWindowsPlatformAdapter()
      : null;
  const execution = await runProjectRuntimeObjective(
    {
      verifyProjectBinding(input) {
        if (
          identity?.status !== "candidate" ||
          identity.commit !== input.repositoryRevision
        )
          return Object.freeze({
            status: "blocked",
            reason: "project_runtime_repository_revision_mismatch",
          });
        return Object.freeze({
          status: "verified",
          repositoryBindingId: stable(
            "binding",
            repositoryRoot,
            input.projectId,
          ),
          repositoryRevision: identity.commit,
          workingDirectory: repositoryRoot,
          repositoryRoot,
          bindingCapability: Object.freeze({}),
        });
      },
      planObjective(request: ProjectRuntimeObjectiveRequest) {
        const objectiveId = stable(
          "objective",
          request.projectId,
          request.milestoneId,
          request.requestId,
        );
        const taskId = stable("task", objectiveId);
        return Object.freeze({
          milestoneAcceptanceCriteria: Object.freeze([
            ...request.acceptanceCriteria,
          ]),
          objectives: Object.freeze([
            {
              id: objectiveId,
              acceptanceCriteria: Object.freeze([
                ...request.acceptanceCriteria,
              ]),
            },
          ]),
          tasks: Object.freeze([
            {
              id: taskId,
              objectiveId,
              dependencies: Object.freeze([]),
              allowedPaths: Object.freeze([...request.allowedPaths]),
              conflictKeys: Object.freeze([...request.allowedPaths]),
            },
          ]),
        });
      },
      createTaskExecutions(request, _bindingCapability, state) {
        return state.tasks
          .filter((task) => task.state !== "superseded")
          .map((task) => {
            const packageResult =
              issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
                evaluationTime: new Date().toISOString(),
              });
            if (!packageResult.capability)
              throw new Error("project_runtime_package_not_verified");
            return Object.freeze({
              taskId: task.definition.id,
              authorityBindingId: stable(
                "authority",
                task.definition.id,
                request.repositoryRevision,
                String(task.retryCount),
              ),
              taskAuthorityCapability: packageResult.capability,
              repositoryRoot,
              taskRequest: Object.freeze({
                frontProvider: "codex",
                requestedExecutorProvider: "auto",
                objective: request.objective,
                acceptanceCriteria: Object.freeze([
                  ...request.acceptanceCriteria,
                ]),
                allowedPaths: Object.freeze([...request.allowedPaths]),
                readPaths: Object.freeze([...request.readPaths]),
                workClass: "bounded_implementation",
                planState: "complete",
                risk: "low",
                difficulty: "low",
                decisionImpact: "limited",
                isLocalCandidateOnly: true,
                hasUnresolvedDirection: false,
                requiresCrossContextAlignment: false,
              }),
            });
          });
      },
      observeLeaseOwner(owner) {
        const lockLease = platform?.operations.lock_lease as
          | Readonly<{ observeLeaseOwner: (value: typeof owner) => unknown }>
          | undefined;
        return (
          lockLease?.observeLeaseOwner(owner) ??
          Object.freeze({
            status: "unknown",
            ownerProcessId: owner.ownerProcessId,
            ownerGeneration: owner.ownerGeneration,
          })
        );
      },
      execution: {
        runSingleTaskAttempt: (input) =>
          runProjectRuntimeSingleTaskAttempt(
            {
              startTask: startRuntimeOwnedCoordinatorTask,
              cancelTask: cancelRuntimeOwnedCoordinatorTask,
            },
            input,
          ),
      },
    },
    request,
    cancellationSignal,
  );
  if (
    execution.status !== "completed" ||
    execution.reason !==
      "project_runtime_tasks_completed_integration_pending" ||
    typeof execution.queueId !== "string"
  )
    return execution;
  const integration = await integrateProjectRuntimeOperation(
    createRuntimeOwnedProjectCandidateIntegrationAdapter(repositoryRoot),
    {
      workingDirectory: repositoryRoot,
      repositoryBindingId: stable("binding", repositoryRoot, request.projectId),
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId: execution.queueId,
      allowedPaths: request.allowedPaths,
      adoptionAuthorized: request.adoptResult,
    },
  );
  if (
    integration.status !== "blocked" ||
    integration.reason !== "project_runtime_integration_conflict" ||
    typeof integration.candidateId !== "string" ||
    typeof integration.stateGeneration !== "number"
  )
    return integration;
  const protectedStore = openRuntimeOwnedWindowsProjectDecisionStore();
  if (protectedStore.status !== "completed")
    return Object.freeze({
      ...integration,
      reason: "project_runtime_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  const decisionId = stable(
    "decision",
    request.projectId,
    request.milestoneId,
    execution.queueId,
    integration.candidateId,
  );
  const decision = issueProjectRuntimeHumanDecision(
    {
      workingDirectory: repositoryRoot,
      repositoryBindingId: stable("binding", repositoryRoot, request.projectId),
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId: execution.queueId,
      principalId: protectedStore.principalId,
      store: protectedStore.store,
    },
    {
      decisionId,
      repositoryRevision: request.repositoryRevision,
      expectedGeneration: integration.stateGeneration,
      allowedOptions: Object.freeze(["resume", "cancel"]),
      lifetimeMs: 24 * 60 * 60 * 1_000,
    },
  );
  return Object.freeze({ ...integration, decision });
}

/** Production decision entry shared by the CLI and MCP process. */
export function runProjectRuntimePublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
) {
  const request = inspectMcpProjectRuntimeDecision(rawRequest);
  if (!request)
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_decision_input_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const { decisionId, projectId, milestoneId } = request;
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const protectedStore = openRuntimeOwnedWindowsProjectDecisionStore();
  if (protectedStore.status !== "completed")
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  const recordId = projectRuntimeDecisionRecordId(
    projectId,
    milestoneId,
    decisionId,
  );
  const observed = protectedStore.store.read(recordId) as Readonly<{
    status: "completed";
    value: Readonly<Record<string, unknown>> | null;
  }> | null;
  const record = observed?.status === "completed" ? observed.value : null;
  if (
    !record ||
    typeof record.queueId !== "string" ||
    typeof record.repositoryRevision !== "string"
  )
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_decision_not_observed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const common = {
    workingDirectory: repositoryRoot,
    repositoryBindingId: stable("binding", repositoryRoot, projectId),
    projectId,
    milestoneId,
    queueId: record.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
  } as const;
  if (record.disposition === "prepared")
    return recoverProjectRuntimeHumanDecision(common, { recordId });
  return submitProjectRuntimeHumanDecision(common, {
    decisionId,
    recordId,
    repositoryRevision: request.repositoryRevision,
    generation: request.generation,
    selectedOption: request.selectedOption,
    continuationCapability: request.continuationCapability,
  });
}
