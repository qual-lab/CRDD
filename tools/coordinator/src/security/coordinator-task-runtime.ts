import { prepareRuntimeOwnedClaudeDockerTaskCandidate } from "./claude-docker-runtime-adapter.ts";
import { prepareRuntimeOwnedCodexDockerTaskCandidate } from "./codex-docker-runtime-adapter.ts";
import { discardRuntimeOwnedCandidateBundle } from "./candidate-bundle-store.ts";
import {
  issueRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "./delegation-selection-grant-runtime.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  startRuntimeOwnedDockerProcessController,
} from "./docker-process-controller.ts";
import { requestRuntimeOwnedExternalSendGrant } from "./external-send-grant-runtime.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";
import {
  consumeRuntimeOwnedProviderHomeMountGrant,
  issueRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "./provider-home-mount-grant-runtime.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "./provider-home-windows-adapter.ts";
import {
  issueRuntimeOwnedProviderTaskPacket,
  revokeRuntimeOwnedProviderTaskPacket,
} from "./provider-task-packet-runtime.ts";
import { bindRuntimeOwnedRepositoryOperation } from "./repository-operation-runtime.ts";
import {
  captureRuntimeOwnedCandidateRevision,
  materializeRuntimeOwnedRepositoryWorkspace,
  persistRuntimeOwnedCandidateRevision,
  verifyRuntimeOwnedCandidateRevision,
} from "./repository-workspace-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const COORDINATOR_TASK_RUNTIME_CONTRACT =
  "crdd-coordinator/task-runtime";
export const COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION = 2;

const REQUEST_KEYS = new Set([
  "frontProvider",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
]);

type Provider = "codex" | "claude";
type TaskRole = "executor" | "reviewer";
type RuntimeRecord = Readonly<Record<string, unknown>>;
type Operation = Readonly<{
  owned: object;
  mountCapability: object;
  managementCapability: object;
  operationId: string;
  hostRecoveryId: string;
}>;
type RuntimeDependencies = Readonly<{
  createOperation: () => Operation;
  cleanupOperation: (owned: object) => void;
  bindRepository: (
    managementCapability: object,
    repositoryRoot: string,
  ) => RuntimeRecord | null;
  materializeWorkspace: (
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
  ) => RuntimeRecord | null;
  issueSelection: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  revokeSelection: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  observeProviderHome: (
    provider: Provider,
    evaluationTime: unknown,
  ) => RuntimeRecord;
  issueMountGrant: (
    managementCapability: object,
    observationCapability: object,
    profileId: string,
  ) => RuntimeRecord;
  consumeMountGrant: (
    useCapability: object,
    managementCapability: object,
    observationCapability: object,
  ) => RuntimeRecord;
  revokeMountGrant: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  authorizeExternalSend: (
    managementCapability: object,
    repositoryBindingCapability: object,
    scope: RuntimeRecord,
    providers: readonly Provider[],
  ) => RuntimeRecord | null;
  issueTaskPacket: (
    managementCapability: object,
    repositoryBindingCapability: object,
    provider: Provider,
    taskRole: TaskRole,
    externalSendGrantCapability: object,
    packet: RuntimeRecord,
  ) => RuntimeRecord | null;
  revokeTaskPacket: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  prepareProvider: (
    provider: Provider,
    managementCapability: object,
    mountCapability: object,
    mountAuthorizationCapability: object,
    selectionUseCapability: object,
    taskPacketUseCapability: object,
  ) => RuntimeRecord;
  startProcess: (
    preparedCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  cancelProcess: (
    controlCapability: object,
    managementCapability: object,
  ) => Promise<unknown>;
  captureCandidate: (
    workspaceCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    allowedPaths: readonly string[],
  ) => RuntimeRecord | null;
  verifyCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
  ) => RuntimeRecord | null;
  persistCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
  ) => RuntimeRecord | null;
  discardCandidate: (candidateId: string) => RuntimeRecord;
}>;
type ControlRecord = {
  managementCapability: object;
  currentProcessControl: object | null;
  cancellationRequested: boolean;
  ownedOperation: object | null;
  retainOperationRoot: boolean;
  hostRecoveryId: string | null;
};
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ControlRecord>;
}>;

function blocked(
  reason: string,
  manualRecoveryRequired = false,
  hostRecoveryId: string | null = null,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !manualRecoveryRequired,
    manualRecoveryRequired,
    hostRecoveryId: manualRecoveryRequired ? hostRecoveryId : null,
    executorProvider: null,
    reviewerProvider: null,
    executorSelectionNotice: null,
    reviewerSelectionNotice: null,
    candidateRevision: null,
    candidateId: null,
    executorResult: null,
    reviewerResult: null,
    canonicalRepositoryChanged: false,
    rawOutputReported: false,
    hostPathReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
  });
}

function objectCapability(value: unknown) {
  return value && typeof value === "object" ? (value as object) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function snapshotRequest(rawRequest: unknown) {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  const acceptance = request
    ? snapshotPlainArray<string>(request.acceptanceCriteria, 16)
    : null;
  const paths = request
    ? snapshotPlainArray<string>(request.allowedPaths, 64)
    : null;
  const requestedReadPaths =
    request && request.readPaths !== undefined
      ? snapshotPlainArray<string>(request.readPaths, 64)
      : paths;
  if (
    !request ||
    (request.frontProvider !== "codex" && request.frontProvider !== "claude") ||
    typeof request.objective !== "string" ||
    request.objective.length === 0 ||
    acceptance?.status !== "ok" ||
    paths?.status !== "ok" ||
    requestedReadPaths?.status !== "ok" ||
    acceptance.value.length === 0 ||
    paths.value.length === 0
  ) {
    return null;
  }
  const readPaths = [
    ...new Map(
      [...requestedReadPaths.value, ...paths.value].map((value) => [
        value.toUpperCase(),
        value,
      ]),
    ).values(),
  ];
  if (readPaths.length > 64) return null;
  return Object.freeze({
    ...request,
    frontProvider: request.frontProvider as Provider,
    objective: request.objective,
    acceptanceCriteria: acceptance.value,
    allowedPaths: paths.value,
    readPaths: Object.freeze(readPaths),
  });
}

function selectionRequest(
  request: RuntimeRecord,
  operationId: string,
  role: "executor" | "independent_reviewer",
  subjectProvider: Provider | null,
) {
  const independent = role === "independent_reviewer";
  return Object.freeze({
    frontProvider: request.frontProvider,
    delegationNeed: independent ? "required" : "beneficial",
    delegationReason: independent
      ? "independent_review_required"
      : "specialized_executor_benefit",
    requestedExecutorProvider: "auto",
    subjectProvider,
    requiresIndependentProvider: independent,
    role,
    workClass: independent ? "bounded_verification" : request.workClass,
    planState: independent ? "complete" : request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: independent
      ? false
      : request.hasUnresolvedDirection,
    requiresCrossContextAlignment: independent
      ? false
      : request.requiresCrossContextAlignment,
    operationId,
    parentOperationId: null,
    ancestorOperationIds: Object.freeze([]),
    delegationDepth: 0,
  });
}

function packetRequest(request: RuntimeRecord) {
  return Object.freeze({
    objective: request.objective,
    acceptanceCriteria: request.acceptanceCriteria,
    allowedPaths: request.allowedPaths,
    readPaths: request.readPaths,
  });
}

function samePaths(left: unknown, right: unknown) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const normalize = (values: unknown[]) =>
    values.every((value) => typeof value === "string")
      ? [...(values as string[])].sort((a, b) =>
          Buffer.from(a).compare(Buffer.from(b)),
        )
      : null;
  const a = normalize(left);
  const b = normalize(right);
  return (
    a !== null &&
    b !== null &&
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

async function executeStage(
  state: RuntimeState,
  operation: Operation,
  request: RuntimeRecord,
  repositoryBindingCapability: object,
  externalSendGrantCapability: object,
  evaluationTime: unknown,
  role: TaskRole,
  subjectProvider: Provider | null,
  control: ControlRecord,
) {
  if (control.cancellationRequested) {
    return blocked("coordinator_task_cancelled_before_stage_start");
  }
  const selection = state.dependencies.issueSelection(
    operation.managementCapability,
    selectionRequest(
      request,
      operation.operationId,
      role === "executor" ? "executor" : "independent_reviewer",
      subjectProvider,
    ),
  );
  const provider =
    selection.executorProvider === "codex" ||
    selection.executorProvider === "claude"
      ? selection.executorProvider
      : null;
  const profileId = stringValue(selection.profileId);
  let selectionControl = objectCapability(selection.controlCapability);
  let startedProcessControl: object | null = null;
  if (
    selection.status !== "issued" ||
    !provider ||
    !profileId ||
    !selectionControl ||
    !objectCapability(selection.useCapability)
  ) {
    return blocked("coordinator_task_selection_failed");
  }
  let mountControl: object | null = null;
  let taskControl: object | null = null;
  const revokeUnconsumed = () => {
    if (taskControl) {
      state.dependencies.revokeTaskPacket(
        taskControl,
        operation.managementCapability,
      );
    }
    if (mountControl) {
      state.dependencies.revokeMountGrant(
        mountControl,
        operation.managementCapability,
      );
    }
    if (selectionControl) {
      state.dependencies.revokeSelection(
        selectionControl,
        operation.managementCapability,
      );
    }
  };
  try {
    const first = state.dependencies.observeProviderHome(
      provider,
      evaluationTime,
    );
    const firstObservation = objectCapability(first.observationCapability);
    if (first.status !== "candidate" || !firstObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_observation_failed");
    }
    const mount = state.dependencies.issueMountGrant(
      operation.managementCapability,
      firstObservation,
      profileId,
    );
    mountControl = objectCapability(mount.controlCapability);
    const mountUse = objectCapability(mount.useCapability);
    if (mount.status !== "issued" || !mountControl || !mountUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_issue_failed");
    }
    const second = state.dependencies.observeProviderHome(
      provider,
      evaluationTime,
    );
    const secondObservation = objectCapability(second.observationCapability);
    if (second.status !== "candidate" || !secondObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_reobservation_failed");
    }
    const consumedMount = state.dependencies.consumeMountGrant(
      mountUse,
      operation.managementCapability,
      secondObservation,
    );
    const mountAuthorization = objectCapability(
      consumedMount.mountAuthorizationCapability,
    );
    if (consumedMount.status !== "consumed" || !mountAuthorization) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_consume_failed");
    }
    mountControl = null;
    const packet = state.dependencies.issueTaskPacket(
      operation.managementCapability,
      repositoryBindingCapability,
      provider,
      role,
      externalSendGrantCapability,
      packetRequest(request),
    );
    taskControl = objectCapability(packet?.controlCapability);
    const taskUse = objectCapability(packet?.useCapability);
    if (packet?.status !== "issued" || !taskControl || !taskUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_packet_issue_failed");
    }
    const prepared = state.dependencies.prepareProvider(
      provider,
      operation.managementCapability,
      operation.mountCapability,
      mountAuthorization,
      selection.useCapability as object,
      taskUse,
    );
    selectionControl = null;
    taskControl = null;
    const preparedCapability = objectCapability(prepared.preparedCapability);
    if (prepared.status !== "prepared" || !preparedCapability) {
      return blocked("coordinator_task_provider_prepare_failed");
    }
    const process = state.dependencies.startProcess(
      preparedCapability,
      operation.managementCapability,
    );
    const processControl = objectCapability(process.controlCapability);
    const completion = process.completion;
    if (
      process.status !== "started" ||
      !processControl ||
      !(completion instanceof Promise)
    ) {
      return blocked(
        stringValue(process.reason) ?? "coordinator_task_process_start_failed",
        process.cleanupConfirmed !== true,
      );
    }
    control.currentProcessControl = processControl;
    startedProcessControl = processControl;
    if (control.cancellationRequested) {
      await state.dependencies.cancelProcess(
        processControl,
        operation.managementCapability,
      );
    }
    const result = (await completion) as RuntimeRecord;
    control.currentProcessControl = null;
    startedProcessControl = null;
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_after_provider_cleanup");
    }
    if (result.status !== "completed" || result.cleanupConfirmed !== true) {
      return Object.freeze({
        ...blocked(
          stringValue(result.reason) ?? "coordinator_task_provider_failed",
          result.cleanupConfirmed !== true,
        ),
        processResult: result,
      });
    }
    return Object.freeze({
      status: "completed" as const,
      provider,
      selectionNotice:
        stringValue(prepared.selectionNotice) ??
        stringValue(selection.selectionNotice),
      normalizedResult: result.normalizedResult,
    });
  } catch {
    if (startedProcessControl) {
      try {
        await state.dependencies.cancelProcess(
          startedProcessControl,
          operation.managementCapability,
        );
      } catch {
        // The process state is already unknowable. The result below retains the
        // operation root and requires explicit recovery regardless.
      }
      control.currentProcessControl = null;
      return blocked(
        "coordinator_task_process_completion_unconfirmed",
        true,
        operation.hostRecoveryId,
      );
    }
    revokeUnconsumed();
    return blocked("coordinator_task_stage_failed_closed");
  }
}

async function run(
  state: RuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  evaluationTime: unknown,
  controlCapability: object,
  control: ControlRecord,
) {
  const request = snapshotRequest(rawRequest);
  if (!request || typeof repositoryRoot !== "string" || !repositoryRoot) {
    return blocked("coordinator_task_request_invalid");
  }
  let operation: Operation | null = null;
  let retainOperationRoot = false;
  try {
    operation = state.dependencies.createOperation();
    control.ownedOperation = operation.owned;
    control.managementCapability = operation.managementCapability;
    control.hostRecoveryId = operation.hostRecoveryId;
    const repository = state.dependencies.bindRepository(
      operation.managementCapability,
      repositoryRoot,
    );
    const repositoryBinding = objectCapability(
      repository?.repositoryBindingCapability,
    );
    if (repository?.repositoryBound !== true || !repositoryBinding) {
      return blocked("coordinator_task_repository_binding_failed");
    }
    const externalSendGrant = state.dependencies.authorizeExternalSend(
      operation.managementCapability,
      repositoryBinding,
      packetRequest(request),
      Object.freeze(["codex", "claude"]),
    );
    const externalSendGrantCapability = objectCapability(
      externalSendGrant?.capability,
    );
    if (
      externalSendGrant?.status !== "issued" ||
      !externalSendGrantCapability
    ) {
      return blocked("coordinator_task_external_send_not_authorized");
    }
    const workspace = state.dependencies.materializeWorkspace(
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.readPaths as readonly string[],
    );
    const workspaceCapability = objectCapability(
      workspace?.workspaceCapability,
    );
    if (workspace?.status !== "materialized" || !workspaceCapability) {
      return blocked("coordinator_task_workspace_materialization_failed");
    }
    const executor = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      evaluationTime,
      "executor",
      null,
      control,
    );
    if (executor.status !== "completed") {
      retainOperationRoot = executor.manualRecoveryRequired === true;
      return executor;
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_before_candidate_capture");
    }
    const executorResult = executor.normalizedResult as RuntimeRecord;
    const candidate = state.dependencies.captureCandidate(
      workspaceCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.allowedPaths as readonly string[],
    );
    const candidateCapability = objectCapability(
      candidate?.candidateCapability,
    );
    if (
      candidate?.status !== "candidate" ||
      !candidateCapability ||
      executorResult?.status !== "completed" ||
      !samePaths(executorResult.changedPaths, candidate.changedPaths)
    ) {
      return blocked("coordinator_task_candidate_revision_invalid");
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_before_independent_review");
    }
    const reviewer = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      evaluationTime,
      "reviewer",
      executor.provider as Provider,
      control,
    );
    if (reviewer.status !== "completed") {
      retainOperationRoot = reviewer.manualRecoveryRequired === true;
      return reviewer;
    }
    const verified = state.dependencies.verifyCandidate(
      candidateCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
    );
    const reviewerResult = reviewer.normalizedResult as RuntimeRecord;
    if (
      verified?.status !== "verified" ||
      reviewerResult?.decision !== "approved" ||
      reviewerResult.findingCount !== 0
    ) {
      return blocked("coordinator_task_independent_review_not_approved");
    }
    const persisted = state.dependencies.persistCandidate(
      candidateCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
    );
    const candidateId = stringValue(persisted?.candidateId);
    if (persisted?.status !== "persisted" || !candidateId) {
      return blocked("coordinator_task_candidate_persistence_failed");
    }
    return Object.freeze({
      status: "completed" as const,
      reason: "coordinator_task_candidate_approved",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      executorProvider: executor.provider,
      reviewerProvider: reviewer.provider,
      executorSelectionNotice: executor.selectionNotice,
      reviewerSelectionNotice: reviewer.selectionNotice,
      candidateRevision: Object.freeze({
        baseCommit: verified.baseCommit,
        baseTree: verified.baseTree,
        patchHash: verified.patchHash,
        contentManifestHash: verified.contentManifestHash,
        allowedPathsHash: verified.allowedPathsHash,
        changedPaths: verified.changedPaths,
      }),
      candidateId,
      executorResult: Object.freeze({
        status: executorResult.status,
        changedPaths: Object.freeze([
          ...((executorResult.changedPaths as readonly string[]) ?? []),
        ]),
        verificationCount:
          typeof executorResult.verificationCount === "number"
            ? executorResult.verificationCount
            : 0,
      }),
      reviewerResult: Object.freeze({
        decision: reviewerResult.decision,
        findingCount:
          typeof reviewerResult.findingCount === "number"
            ? reviewerResult.findingCount
            : 0,
      }),
      canonicalRepositoryChanged: false,
      rawOutputReported: false,
      hostPathReported: false,
      untrustedProviderTextReported: false,
      credentialAbsenceVerified: false,
    });
  } catch {
    retainOperationRoot = true;
    return blocked(
      "coordinator_task_failed_closed",
      true,
      operation?.hostRecoveryId ?? null,
    );
  } finally {
    state.controls.delete(controlCapability);
    control.retainOperationRoot = retainOperationRoot;
  }
}

function createProductionOperation() {
  const owned = createOwnedOperationDirectories();
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  return Object.freeze({
    owned,
    mountCapability,
    managementCapability,
    operationId: operation.operationId,
    hostRecoveryId: getOwnedHostRecoveryId(owned),
  });
}

const productionDependencies: RuntimeDependencies = Object.freeze({
  createOperation: createProductionOperation,
  cleanupOperation: cleanupOwnedOperationDirectories,
  bindRepository: bindRuntimeOwnedRepositoryOperation,
  materializeWorkspace: materializeRuntimeOwnedRepositoryWorkspace,
  issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
  revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
  observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
  issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
  consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
  revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
  authorizeExternalSend: requestRuntimeOwnedExternalSendGrant,
  issueTaskPacket: issueRuntimeOwnedProviderTaskPacket,
  revokeTaskPacket: revokeRuntimeOwnedProviderTaskPacket,
  prepareProvider: (
    provider,
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    taskPacketUseCapability,
  ) =>
    provider === "codex"
      ? prepareRuntimeOwnedCodexDockerTaskCandidate(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          taskPacketUseCapability,
        )
      : prepareRuntimeOwnedClaudeDockerTaskCandidate(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          taskPacketUseCapability,
        ),
  startProcess: startRuntimeOwnedDockerProcessController,
  cancelProcess: cancelRuntimeOwnedDockerProcessController,
  captureCandidate: captureRuntimeOwnedCandidateRevision,
  verifyCandidate: verifyRuntimeOwnedCandidateRevision,
  persistCandidate: persistRuntimeOwnedCandidateRevision,
  discardCandidate: discardRuntimeOwnedCandidateBundle,
});

function createRuntime(dependencies: RuntimeDependencies) {
  const state: RuntimeState = Object.freeze({
    dependencies: Object.freeze(dependencies),
    controls: new WeakMap(),
  });
  return Object.freeze({
    start: (
      rawRequest: unknown,
      repositoryRoot: unknown,
      evaluationTime: unknown,
    ) => {
      const controlCapability = Object.freeze({});
      const control: ControlRecord = {
        managementCapability: Object.freeze({}),
        currentProcessControl: null,
        cancellationRequested: false,
        ownedOperation: null,
        retainOperationRoot: false,
        hostRecoveryId: null,
      };
      state.controls.set(controlCapability, control);
      const completion = run(
        state,
        rawRequest,
        repositoryRoot,
        evaluationTime,
        controlCapability,
        control,
      )
        .then((result) => {
          try {
            if (control.ownedOperation && !control.retainOperationRoot) {
              state.dependencies.cleanupOperation(control.ownedOperation);
            }
            return result;
          } catch {
            const candidateId = stringValue(result.candidateId);
            if (candidateId) state.dependencies.discardCandidate(candidateId);
            return blocked(
              "coordinator_task_operation_cleanup_unconfirmed",
              true,
              control.hostRecoveryId,
            );
          }
        })
        .catch(() =>
          blocked(
            "coordinator_task_operation_cleanup_unconfirmed",
            true,
            control.hostRecoveryId,
          ),
        )
        .finally(() => state.controls.delete(controlCapability));
      return Object.freeze({
        status: "started" as const,
        reason: "coordinator_task_started",
        controlCapability,
        completion,
        rawOutputReported: false,
        hostPathReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      });
    },
    cancel: async (controlCapability: unknown) => {
      if (!controlCapability || typeof controlCapability !== "object") {
        return Object.freeze({ status: "blocked" as const });
      }
      const control = state.controls.get(controlCapability);
      if (!control || control.cancellationRequested) {
        return Object.freeze({ status: "blocked" as const });
      }
      control.cancellationRequested = true;
      return control.currentProcessControl
        ? state.dependencies.cancelProcess(
            control.currentProcessControl,
            control.managementCapability,
          )
        : Object.freeze({ status: "requested" as const });
    },
  });
}

const productionRuntime = createRuntime(productionDependencies);

export function startRuntimeOwnedCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
) {
  return productionRuntime.start(
    rawRequest,
    repositoryRoot,
    new Date().toISOString(),
  );
}

export function cancelRuntimeOwnedCoordinatorTask(controlCapability: unknown) {
  return productionRuntime.cancel(controlCapability);
}

export function createIsolatedCoordinatorTaskRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    ...createRuntime(dependencies),
  });
}

export function describeCoordinatorTaskRuntimeContract() {
  return Object.freeze({
    contract: COORDINATOR_TASK_RUNTIME_CONTRACT,
    contractRevision: COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION,
    flow: "front_to_coordinator_to_executor_to_candidate_revision_to_independent_reviewer_to_result_integration",
    routes: Object.freeze([
      "front_codex__executor_codex",
      "front_codex__executor_claude",
      "front_claude__executor_codex",
      "front_claude__executor_claude",
    ]),
    providerSelection: "explainable_cross_provider_preferred_cost_bounded",
    executorWorkspace: "runtime_owned_exact_commit_read_write",
    reviewerWorkspace: "same_exact_candidate_read_only",
    taskTransport: "opaque_single_use_provider_stdin_only",
    approvedCandidateTransfer:
      "opaque_id_local_transient_bundle_explicit_export_and_discard",
    independentReview: "subject_provider_excluded",
    resultPublication: "cleanup_and_candidate_reverification_required",
    canonicalRepositoryEffectAllowed: false,
    directProviderToProviderSpawnAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    rawOutputReported: false,
  });
}
