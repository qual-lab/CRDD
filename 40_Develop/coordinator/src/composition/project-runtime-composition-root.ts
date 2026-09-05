import { createHash } from "node:crypto";
import type { Writable } from "node:stream";

import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../security/coordinator-task-runtime.ts";
import {
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
} from "../security/platform-provisioner-package-filesystem.ts";
import {
  collectDockerRecoveryAcknowledgementAfterProjectRecord,
  consumeDockerRecoveryReceiptAfterProjectSettlement,
  recoverRuntimeOwnedDockerTask,
  resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
} from "../security/docker-recovery-runtime.ts";
import {
  createProjectRuntimeObjectiveResult,
  inspectProjectRuntimeDecisionRequest,
  inspectProjectRuntimeObjectiveRequest,
  PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
  integrateProjectRuntimeOperation,
  type ProjectRuntimeObjectiveRequest,
} from "../../../project-runtime/src/index.ts";
import { runProjectRuntimeObjective } from "../security/project-runtime-objective-intake.ts";
import {
  createProjectRuntimePersistencePorts,
  readProjectRuntimeState,
} from "../security/project-runtime-durable-foundation.ts";
import {
  projectProjectRuntimeState,
  type ProjectRuntimeCandidatePort,
} from "../../../project-runtime/src/index.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "../security/project-runtime-candidate-integration-adapter.ts";
import { createProjectRuntimeIntegrationRecordAdapter } from "../security/project-runtime-integration-record-adapter.ts";
import { createProjectRuntimeDecisionRecoveryStore } from "../security/project-runtime-decision-recovery-store.ts";
import {
  issueProjectRuntimeHumanDecision,
  projectRuntimeDecisionRecordId,
  recoverProjectRuntimeHumanDecision,
  replaceProjectRuntimeHumanDecision,
  submitProjectRuntimeHumanDecision,
} from "../security/project-runtime-human-decision.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../security/project-runtime-windows-decision-store.ts";
import { runProjectRuntimeSingleTaskAttempt } from "../security/project-runtime-single-task-adapter.ts";
import { createProjectRuntimeExecutionAuthorizationAdapter } from "../security/project-runtime-execution-authorization-adapter.ts";
import type { ProjectRuntimeExecutionPublicationObservation } from "../../../project-runtime/src/index.ts";
import {
  observeProjectRuntimePlatformFamily,
  createProjectRuntimeWindowsPlatformAdapter,
} from "../security/project-runtime-windows-platform-adapter.ts";
import { inspectRepositoryIdentityCandidate } from "../security/repository-operation-runtime.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../security/repository-root-resolution.ts";
import { recordProjectRuntimeExecutionEvent } from "../security/execution-intelligence-adapter.ts";

export const PROJECT_RUNTIME_RECOVERY_LIFECYCLE_PREFIX =
  "[Project Runtime recovery] " as const;
export const PROJECT_RUNTIME_EXECUTION_INTELLIGENCE_PREFIX =
  "[Project Runtime execution intelligence] " as const;
const PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS = 5_000;

export type ProjectRuntimeRecoveryDiagnosticOutcome =
  | "success"
  | "callback_error"
  | "stream_error"
  | "stream_close"
  | "timeout"
  | "unavailable"
  | "throw";

function createProjectRuntimeInternalDiagnosticReporter(
  stream: Writable,
  input: Readonly<{
    prefix: string;
    event: string;
    timeoutMs: number;
  }>,
) {
  let isUnavailable = !stream.writable || stream.destroyed;
  let isDisposed = false;
  let pending:
    | ((outcome: ProjectRuntimeRecoveryDiagnosticOutcome) => void)
    | null = null;
  let tail = Promise.resolve();
  const onError = () => {
    isUnavailable = true;
    pending?.("stream_error");
  };
  const onClose = () => {
    isUnavailable = true;
    pending?.("stream_close");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  stream.on("error", onError);
  stream.on("close", onClose);

  const writeOne = (event: object) =>
    new Promise<ProjectRuntimeRecoveryDiagnosticOutcome>((resolve) => {
      if (isDisposed || isUnavailable || !stream.writable || stream.destroyed) {
        resolve("unavailable");
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (
        outcome: ProjectRuntimeRecoveryDiagnosticOutcome,
        isDisable = false,
      ) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        if (isDisable) isUnavailable = true;
        resolve(outcome);
      };
      pending = (outcome) => settle(outcome, true);
      timer = setTimeout(() => settle("timeout", true), input.timeoutMs);
      try {
        stream.write(
          `${input.prefix}${JSON.stringify({
            ...event,
            event: input.event,
          })}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle("success");
            else settle("callback_error", true);
          },
        );
      } catch {
        settle("throw", true);
      }
    });

  const report = (event: object) => {
    const result = tail.then(() => writeOne(event));
    tail = result.then(() => undefined);
    return result;
  };
  const dispose = () => {
    if (isDisposed) return;
    isDisposed = true;
    isUnavailable = true;
    pending?.("unavailable");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  return Object.freeze({ report, dispose });
}

export function createProjectRuntimeRecoveryDiagnosticReporter(
  stream: Writable,
  timeoutMs = PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createProjectRuntimeInternalDiagnosticReporter(stream, {
    prefix: PROJECT_RUNTIME_RECOVERY_LIFECYCLE_PREFIX,
    event: "project_runtime_recovery_transition",
    timeoutMs,
  });
}

export function createProjectRuntimeExecutionIntelligenceDiagnosticReporter(
  stream: Writable,
  timeoutMs = PROJECT_RUNTIME_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createProjectRuntimeInternalDiagnosticReporter(stream, {
    prefix: PROJECT_RUNTIME_EXECUTION_INTELLIGENCE_PREFIX,
    event: "project_runtime_execution_intelligence_publication",
    timeoutMs,
  });
}

const productionRecoveryDiagnosticReporter =
  createProjectRuntimeRecoveryDiagnosticReporter(process.stderr);
const productionExecutionIntelligenceDiagnosticReporter =
  createProjectRuntimeExecutionIntelligenceDiagnosticReporter(process.stderr);

async function writeProjectRuntimeRecoveryDiagnostic(event: object) {
  await productionRecoveryDiagnosticReporter.report(event);
}

function writeProjectRuntimeExecutionIntelligenceDiagnostic(
  observation: ProjectRuntimeExecutionPublicationObservation,
) {
  if (observation.status === "completed") return;
  void productionExecutionIntelligenceDiagnosticReporter.report(observation);
}

type PublicExecutionDependencies = Readonly<{
  issueRuntimeExecutionAuthorization: () => object | null;
  revokeRuntimeExecutionAuthorization?: (capability: object) => boolean;
  startTask: typeof startRuntimeOwnedCoordinatorTask;
  cancelTask: typeof cancelRuntimeOwnedCoordinatorTask;
  frontProviderForTask: (
    requestedExecutorProvider: "auto" | "codex" | "claude",
  ) => "codex" | "claude";
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore;
  createIntegrationAdapter: (
    repositoryRoot: string,
  ) => ProjectRuntimeCandidatePort;
  resolveTaskRecoveryCorrelations?: typeof resolveRuntimeOwnedDockerTaskRecoveryCorrelations;
  recordExecutionEvent: typeof recordProjectRuntimeExecutionEvent;
  observeExecutionEventPublication: (
    observation: ProjectRuntimeExecutionPublicationObservation,
  ) => void;
}>;

export type ProjectRuntimePublicDevelopmentDependencies = Omit<
  PublicExecutionDependencies,
  "recordExecutionEvent" | "observeExecutionEventPublication"
> &
  Partial<
    Pick<
      PublicExecutionDependencies,
      "recordExecutionEvent" | "observeExecutionEventPublication"
    >
  >;

const productionExecutionDependencies: PublicExecutionDependencies =
  Object.freeze({
    issueRuntimeExecutionAuthorization: () =>
      issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
        evaluationTime: new Date().toISOString(),
      }).capability,
    revokeRuntimeExecutionAuthorization:
      revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
    startTask: startRuntimeOwnedCoordinatorTask,
    cancelTask: cancelRuntimeOwnedCoordinatorTask,
    frontProviderForTask: () => "codex",
    openDecisionStore: openRuntimeOwnedWindowsProjectDecisionStore,
    createIntegrationAdapter:
      createRuntimeOwnedProjectCandidateIntegrationAdapter,
    resolveTaskRecoveryCorrelations:
      resolveRuntimeOwnedDockerTaskRecoveryCorrelations,
    recordExecutionEvent: recordProjectRuntimeExecutionEvent,
    observeExecutionEventPublication:
      writeProjectRuntimeExecutionIntelligenceDiagnostic,
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
        authorization: createProjectRuntimeExecutionAuthorizationAdapter({
          issueRuntimeCapability:
            runtimeDependencies.issueRuntimeExecutionAuthorization,
          ...(runtimeDependencies.revokeRuntimeExecutionAuthorization
            ? {
                revokeRuntimeCapability:
                  runtimeDependencies.revokeRuntimeExecutionAuthorization,
              }
            : {}),
        }),
        runSingleTaskAttempt: (input) =>
          runProjectRuntimeSingleTaskAttempt(
            {
              startTask: runtimeDependencies.startTask,
              cancelTask: runtimeDependencies.cancelTask,
            },
            input,
          ),
        executionObservation: {
          recordTaskAttempt: (observation) =>
            runtimeDependencies.recordExecutionEvent(
              repositoryRoot,
              observation,
            ),
          observePublication:
            runtimeDependencies.observeExecutionEventPublication,
        },
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
  const repositoryBindingId = stable("binding", repositoryRoot);
  const integration = await integrateProjectRuntimeOperation(
    Object.freeze({
      candidate: Object.freeze({ ...integrationAdapter, observeLeaseOwner }),
      records: createProjectRuntimeIntegrationRecordAdapter({
        workingDirectory: repositoryRoot,
        repositoryBindingId,
        projectId: request.projectId,
        milestoneId: request.milestoneId,
        queueId: execution.queueId,
      }),
      persistence: createProjectRuntimePersistencePorts(
        repositoryRoot,
        repositoryBindingId,
      ),
    }),
    {
      projectId: request.projectId,
      milestoneId: request.milestoneId,
      queueId: execution.queueId,
      allowedPaths: request.allowedPaths,
      adoptionAuthorized: request.adoptResult,
    },
  );
  if (
    integration.status === "completed" &&
    integration.reason === "project_runtime_milestone_accepted"
  ) {
    const latest = readProjectRuntimeState(
      repositoryRoot,
      stable("binding", repositoryRoot),
      request.projectId,
    );
    if (latest.status !== "completed" || latest.value === null)
      return createProjectRuntimeObjectiveResult(request, {
        status: "blocked",
        reason: "project_runtime_state_observation_unknown",
        queueId: execution.queueId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      });
    return createProjectRuntimeObjectiveResult(request, {
      status: "completed",
      reason: integration.reason,
      queueId: execution.queueId,
      projection: projectProjectRuntimeState(latest.value),
      cleanupConfirmed: integration.cleanupConfirmed,
      manualRecoveryRequired: integration.manualRecoveryRequired,
      recoveryIds: integration.recoveryIds,
      effectState: "settled",
    });
  }
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
    recordExecutionEvent:
      dependencies.recordExecutionEvent ?? recordProjectRuntimeExecutionEvent,
    observeExecutionEventPublication:
      dependencies.observeExecutionEventPublication ??
      writeProjectRuntimeExecutionIntelligenceDiagnostic,
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
  const request = inspectProjectRuntimeDecisionRequest(rawRequest);
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
  const commonFields = {
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
    return recoverProjectRuntimeHumanDecision(commonFields, { recordId });
  return submitProjectRuntimeHumanDecision(commonFields, {
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
