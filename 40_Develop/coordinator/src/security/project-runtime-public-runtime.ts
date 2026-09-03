import { createHash } from "node:crypto";

import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "./coordinator-task-runtime.ts";
import {
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
} from "./platform-provisioner-package-filesystem.ts";
import {
  collectDockerRecoveryAcknowledgementAfterProjectRecord,
  consumeDockerRecoveryReceiptAfterProjectSettlement,
  recoverRuntimeOwnedDockerTask,
  resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
} from "./docker-recovery-runtime.ts";
import {
  inspectProjectRuntimeObjectiveRequest,
  runProjectRuntimeObjective,
  type ProjectRuntimeObjectiveRequest,
} from "./project-runtime-objective-intake.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "./project-runtime-candidate-integration-adapter.ts";
import { inspectMcpProjectRuntimeDecision } from "./mcp-project-runtime-adapter.ts";
import { integrateProjectRuntimeOperation } from "./project-runtime-integration.ts";
import type { ProjectRuntimeIntegrationDependencies } from "./project-runtime-integration.ts";
import { createProjectRuntimeDecisionRecoveryStore } from "./project-runtime-decision-recovery-store.ts";
import {
  issueProjectRuntimeHumanDecision,
  projectRuntimeDecisionRecordId,
  recoverProjectRuntimeHumanDecision,
  replaceProjectRuntimeHumanDecision,
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
export const PROJECT_RUNTIME_RECOVERY_LIFECYCLE_PREFIX =
  "[Project Runtime recovery] " as const;
const PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS = 5_000;

async function writeProjectRuntimeRecoveryDiagnostic(event: object) {
  const stream = process.stderr;
  if (!stream.writable || stream.destroyed) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream.off("error", settle);
      stream.off("close", settle);
      resolve();
    };
    const timer = setTimeout(
      settle,
      PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
    );
    stream.once("error", settle);
    stream.once("close", settle);
    try {
      stream.write(
        `${PROJECT_RUNTIME_RECOVERY_LIFECYCLE_PREFIX}${JSON.stringify({
          event: "project_runtime_recovery_transition",
          ...event,
        })}\n`,
        "utf8",
        settle,
      );
    } catch {
      settle();
    }
  });
}

type PublicExecutionDependencies = Readonly<{
  issueTaskAuthority: () => object | null;
  revokeTaskAuthority?: (capability: object) => boolean;
  startTask: typeof startRuntimeOwnedCoordinatorTask;
  cancelTask: typeof cancelRuntimeOwnedCoordinatorTask;
  frontProviderForTask: (
    requestedExecutorProvider: "auto" | "codex" | "claude",
  ) => "codex" | "claude";
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore;
  createIntegrationAdapter: (
    repositoryRoot: string,
  ) => ProjectRuntimeIntegrationDependencies;
  resolveTaskRecoveryCorrelations?: typeof resolveRuntimeOwnedDockerTaskRecoveryCorrelations;
}>;

export type ProjectRuntimePublicDevelopmentDependencies =
  PublicExecutionDependencies;

const productionExecutionDependencies: PublicExecutionDependencies =
  Object.freeze({
    issueTaskAuthority: () =>
      issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
        evaluationTime: new Date().toISOString(),
      }).capability,
    revokeTaskAuthority: revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
    startTask: startRuntimeOwnedCoordinatorTask,
    cancelTask: cancelRuntimeOwnedCoordinatorTask,
    frontProviderForTask: () => "codex",
    openDecisionStore: openRuntimeOwnedWindowsProjectDecisionStore,
    createIntegrationAdapter:
      createRuntimeOwnedProjectCandidateIntegrationAdapter,
    resolveTaskRecoveryCorrelations:
      resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
  });

function stable(prefix: string, ...parts: readonly string[]) {
  return `${prefix}-${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 40)}`;
}

/** Canonical Single Task request used by both execution and bounded E2E admission. */
export function buildProjectRuntimeCoordinatorTaskRequest(
  request: ProjectRuntimeObjectiveRequest,
  frontProvider: "codex" | "claude",
) {
  return Object.freeze({
    frontProvider,
    requestedExecutorProvider: request.requestedExecutorProvider ?? "auto",
    objective: request.objective,
    acceptanceCriteria: Object.freeze([...request.acceptanceCriteria]),
    allowedPaths: Object.freeze([...request.allowedPaths]),
    readPaths: Object.freeze([...request.readPaths]),
    workClass: "bounded_implementation" as const,
    planState: "complete" as const,
    risk: "low" as const,
    difficulty: "low" as const,
    decisionImpact: "limited" as const,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

/** Production composition shared by the CLI and MCP transports. */
async function executeProjectRuntimePublicObjective(
  runtimeDependencies: PublicExecutionDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
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
  const authenticated = runtimeDependencies.openDecisionStore();
  if (
    authenticated.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== authenticated.principalId)
  )
    return Object.freeze({
      contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "project_runtime_authenticated_principal_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const observedPlatform = observeProjectRuntimePlatformFamily();
  const platform =
    observedPlatform.status === "observed" &&
    observedPlatform.platformFamily === "windows"
      ? createProjectRuntimeWindowsPlatformAdapter()
      : null;
  const observeLeaseOwner = (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => {
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
  };
  const execution = await runProjectRuntimeObjective(
    {
      authenticatedPrincipalId: authenticated.principalId,
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
          repositoryBindingId: stable("binding", repositoryRoot),
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
          .map((task) =>
            Object.freeze({
              taskId: task.definition.id,
              authorityBindingId: stable(
                "authority",
                task.definition.id,
                request.repositoryRevision,
                String(task.retryCount),
              ),
              // This is a non-authority placeholder. The verified, single-use
              // capability is issued just before the reserved Task attempt.
              taskAuthorityCapability: Object.freeze({}),
              repositoryRoot,
              taskRequest: buildProjectRuntimeCoordinatorTaskRequest(
                request,
                runtimeDependencies.frontProviderForTask(
                  request.requestedExecutorProvider ?? "auto",
                ),
              ),
            }),
          );
      },
      observeLeaseOwner,
      recoverTaskRecovery: recoverRuntimeOwnedDockerTask,
      acknowledgeTaskRecovery:
        consumeDockerRecoveryReceiptAfterProjectSettlement,
      finalizeTaskRecoveryAcknowledgement:
        collectDockerRecoveryAcknowledgementAfterProjectRecord,
      ...(runtimeDependencies.resolveTaskRecoveryCorrelations
        ? {
            resolveTaskRecoveryCorrelations:
              runtimeDependencies.resolveTaskRecoveryCorrelations,
          }
        : {}),
      observeRecoveryTransition: writeProjectRuntimeRecoveryDiagnostic,
      execution: {
        issueTaskAuthority: runtimeDependencies.issueTaskAuthority,
        ...(runtimeDependencies.revokeTaskAuthority
          ? { revokeTaskAuthority: runtimeDependencies.revokeTaskAuthority }
          : {}),
        runSingleTaskAttempt: (input) =>
          runProjectRuntimeSingleTaskAttempt(
            {
              startTask: runtimeDependencies.startTask,
              cancelTask: runtimeDependencies.cancelTask,
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
  const integrationAdapter =
    runtimeDependencies.createIntegrationAdapter(repositoryRoot);
  const integration = await integrateProjectRuntimeOperation(
    Object.freeze({ ...integrationAdapter, observeLeaseOwner }),
    {
      workingDirectory: repositoryRoot,
      repositoryBindingId: stable("binding", repositoryRoot),
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
  const protectedStore = runtimeDependencies.openDecisionStore();
  if (protectedStore.status !== "completed")
    return Object.freeze({
      ...integration,
      reason: "project_runtime_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  const decisionId = stable(
    "decision",
    request.projectId,
    request.milestoneId,
    execution.queueId,
    integration.candidateId,
  );
  const decisionCommon = {
    workingDirectory: repositoryRoot,
    repositoryBindingId: stable("binding", repositoryRoot),
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    queueId: execution.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
    recoveryStore: createProjectRuntimeDecisionRecoveryStore(repositoryRoot),
  } as const;
  const decision = request.decisionCapabilityReplacement
    ? request.decisionCapabilityReplacement.decisionId !== decisionId
      ? Object.freeze({
          contract: PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
          status: "blocked" as const,
          reason: "project_runtime_decision_replacement_binding_mismatch",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect" as const,
        })
      : replaceProjectRuntimeHumanDecision(decisionCommon, {
          recordId: projectRuntimeDecisionRecordId(
            request.projectId,
            request.milestoneId,
            decisionId,
          ),
          replacementRequestId:
            request.decisionCapabilityReplacement.replacementRequestId,
          lifetimeMs: 24 * 60 * 60 * 1_000,
        })
    : issueProjectRuntimeHumanDecision(decisionCommon, {
        decisionId,
        repositoryRevision: request.repositoryRevision,
        expectedGeneration: integration.stateGeneration,
        allowedOptions: Object.freeze(["resume", "cancel"]),
        lifetimeMs: 24 * 60 * 60 * 1_000,
      });
  return Object.freeze({ ...integration, decision });
}

export function runProjectRuntimePublicObjective(
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  return executeProjectRuntimePublicObjective(
    productionExecutionDependencies,
    rawRequest,
    cancellationSignal,
    workingDirectory,
    authenticationContext,
  );
}

/** Development-only composition. The supplied starter still needs its own admitted capability. */
export function createDevelopmentProjectRuntimePublicObjectiveCandidate(
  dependencies: Omit<
    ProjectRuntimePublicDevelopmentDependencies,
    "createIntegrationAdapter"
  > &
    Readonly<{
      createIntegrationAdapter?: PublicExecutionDependencies["createIntegrationAdapter"];
    }>,
) {
  const fixed = Object.freeze({
    ...dependencies,
    createIntegrationAdapter:
      dependencies.createIntegrationAdapter ??
      createRuntimeOwnedProjectCandidateIntegrationAdapter,
  });
  return Object.freeze({
    productionAuthority: false,
    run: (
      rawRequest: unknown,
      cancellationSignal: AbortSignal,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeProjectRuntimePublicObjective(
        fixed,
        rawRequest,
        cancellationSignal,
        workingDirectory,
        authenticationContext,
      ),
    runDecision: (
      rawRequest: unknown,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeProjectRuntimePublicDecision(
        fixed.openDecisionStore,
        rawRequest,
        workingDirectory,
        authenticationContext,
      ),
  });
}

function executeProjectRuntimePublicDecision(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
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
  const protectedStore = openDecisionStore();
  if (
    protectedStore.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== protectedStore.principalId)
  )
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
    repositoryBindingId: stable("binding", repositoryRoot),
    projectId,
    milestoneId,
    queueId: record.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
    recoveryStore: createProjectRuntimeDecisionRecoveryStore(repositoryRoot),
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

/** Production decision entry shared by the CLI and MCP process. */
export function runProjectRuntimePublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  return executeProjectRuntimePublicDecision(
    openRuntimeOwnedWindowsProjectDecisionStore,
    rawRequest,
    workingDirectory,
    authenticationContext,
  );
}
