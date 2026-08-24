import {
  prepareRuntimeOwnedClaudeDockerTaskCandidate,
} from "./claude-docker-runtime-adapter.ts";
import {
  prepareRuntimeOwnedCodexDockerTaskCandidate,
} from "./codex-docker-runtime-adapter.ts";
import {
  issueRuntimeOwnedDelegationSelectionGrant,
  revokeRuntimeOwnedDelegationSelectionGrant,
} from "./delegation-selection-grant-runtime.ts";
import {
  cancelRuntimeOwnedDockerProcessController,
  startRuntimeOwnedDockerProcessController,
} from "./docker-process-controller.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
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
import {
  bindRuntimeOwnedRepositoryOperation,
} from "./repository-operation-runtime.ts";
import {
  captureRuntimeOwnedCandidateRevision,
  materializeRuntimeOwnedRepositoryWorkspace,
  verifyRuntimeOwnedCandidateRevision,
} from "./repository-workspace-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const COORDINATOR_TASK_RUNTIME_CONTRACT =
  "crdd-coordinator/task-runtime";
export const COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION = 1;

const REQUEST_KEYS = new Set([
  "frontProvider",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "contentPolicy",
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
  issueTaskPacket: (
    managementCapability: object,
    taskRole: TaskRole,
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
}>;
type ControlRecord = {
  managementCapability: object;
  currentProcessControl: object | null;
  cancellationRequested: boolean;
  ownedOperation: object | null;
  retainOperationRoot: boolean;
};
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ControlRecord>;
}>;

function blocked(reason: string, manualRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !manualRecoveryRequired,
    manualRecoveryRequired,
    executorProvider: null,
    reviewerProvider: null,
    executorSelectionNotice: null,
    reviewerSelectionNotice: null,
    candidateRevision: null,
    executorResult: null,
    reviewerResult: null,
    canonicalRepositoryChanged: false,
    rawOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
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
  if (
    !request ||
    (request.frontProvider !== "codex" &&
      request.frontProvider !== "claude") ||
    typeof request.objective !== "string" ||
    request.objective.length === 0 ||
    request.contentPolicy !== "authenticated_local_user_approved" ||
    acceptance?.status !== "ok" ||
    paths?.status !== "ok" ||
    acceptance.value.length === 0 ||
    paths.value.length === 0
  ) {
    return null;
  }
  return Object.freeze({
    ...request,
    frontProvider: request.frontProvider as Provider,
    objective: request.objective,
    acceptanceCriteria: acceptance.value,
    allowedPaths: paths.value,
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

function packetRequest(request: RuntimeRecord, role: TaskRole) {
  return Object.freeze({
    objective:
      role === "executor"
        ? request.objective
        : `Independently review the exact isolated candidate for: ${request.objective as string}`,
    acceptanceCriteria: request.acceptanceCriteria,
    allowedPaths: request.allowedPaths,
    contentPolicy: request.contentPolicy,
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
      role,
      packetRequest(request, role),
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
    if (control.cancellationRequested) {
      await state.dependencies.cancelProcess(
        processControl,
        operation.managementCapability,
      );
    }
    const result = (await completion) as RuntimeRecord;
    control.currentProcessControl = null;
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
    const workspace = state.dependencies.materializeWorkspace(
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
    );
    const workspaceCapability = objectCapability(workspace?.workspaceCapability);
    if (workspace?.status !== "materialized" || !workspaceCapability) {
      return blocked("coordinator_task_workspace_materialization_failed");
    }
    const executor = await executeStage(
      state,
      operation,
      request,
      evaluationTime,
      "executor",
      null,
      control,
    );
    if (executor.status !== "completed") {
      retainOperationRoot = executor.manualRecoveryRequired === true;
      return executor;
    }
    const executorResult = executor.normalizedResult as RuntimeRecord;
    const candidate = state.dependencies.captureCandidate(
      workspaceCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.allowedPaths as readonly string[],
    );
    const candidateCapability = objectCapability(candidate?.candidateCapability);
    if (
      candidate?.status !== "candidate" ||
      !candidateCapability ||
      executorResult?.status !== "completed" ||
      !samePaths(executorResult.changedPaths, candidate.changedPaths)
    ) {
      return blocked("coordinator_task_candidate_revision_invalid");
    }
    const reviewer = await executeStage(
      state,
      operation,
      request,
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
      !Array.isArray(reviewerResult.findings) ||
      reviewerResult.findings.length !== 0
    ) {
      return blocked("coordinator_task_independent_review_not_approved");
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
      executorResult,
      reviewerResult,
      canonicalRepositoryChanged: false,
      rawOutputReported: false,
      hostPathReported: false,
      credentialReported: false,
    });
  } catch {
    retainOperationRoot = true;
    return blocked("coordinator_task_failed_closed", true);
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
  const operation = verifyOwnedOperationManagementCapability(
    managementCapability,
  );
  return Object.freeze({
    owned,
    mountCapability,
    managementCapability,
    operationId: operation.operationId,
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
          if (control.ownedOperation && !control.retainOperationRoot) {
            state.dependencies.cleanupOperation(control.ownedOperation);
          }
          return result;
        })
        .catch(() =>
          blocked("coordinator_task_operation_cleanup_unconfirmed", true),
        )
        .finally(() => state.controls.delete(controlCapability));
      return Object.freeze({
        status: "started" as const,
        reason: "coordinator_task_started",
        controlCapability,
        completion,
        rawOutputReported: false,
        hostPathReported: false,
        credentialReported: false,
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
  evaluationTime: unknown,
) {
  return productionRuntime.start(rawRequest, repositoryRoot, evaluationTime);
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
    flow:
      "front_to_coordinator_to_executor_to_candidate_revision_to_independent_reviewer_to_result_integration",
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
    independentReview: "subject_provider_excluded",
    resultPublication: "cleanup_and_candidate_reverification_required",
    canonicalRepositoryEffectAllowed: false,
    directProviderToProviderSpawnAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    rawOutputReported: false,
  });
}
