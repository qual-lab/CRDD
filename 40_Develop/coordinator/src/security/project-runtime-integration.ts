import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  acquireProjectRuntimeLease,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "./project-runtime-durable-foundation.ts";
import {
  recordMilestoneIntegration,
  recordObjectiveIntegration,
  requestProjectRuntimeHumanDecision,
  type ProjectRuntimeState,
} from "./project-runtime-state.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "./repository-root-resolution.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const PROJECT_RUNTIME_INTEGRATION_CONTRACT =
  "crdd-coordinator/project-runtime-integration/v1" as const;

type Candidate = Readonly<{
  status: "candidate";
  candidateId: string;
  candidateHash: string;
  baseRevision: string;
  changedPaths: readonly string[];
  objectiveEvidence: Readonly<Record<string, readonly string[]>>;
  milestoneEvidence: readonly string[];
  conflicts: readonly string[];
  cleanupConfirmed: boolean;
}>;

type AdoptionReceipt = Readonly<{
  status: "completed";
  receiptId: string;
  beforeRevision: string;
  afterRevision: string;
  changedPaths: readonly string[];
  cleanupConfirmed: boolean;
}>;

export type ProjectRuntimeIntegrationDependencies = Readonly<{
  createCandidate: (
    input: Readonly<{
      state: ProjectRuntimeState;
      taskCandidateIds: readonly string[];
    }>,
  ) => Promise<unknown>;
  observeCanonicalRepository: () => unknown;
  observeLeaseOwner?: (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => unknown;
  adoptCandidate: (
    input: Readonly<{
      candidateId: string;
      candidateHash: string;
      baseRevision: string;
      changedPaths: readonly string[];
    }>,
  ) => Promise<unknown>;
}>;

type IntegrationInput = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskCandidateIds?: readonly string[];
  allowedPaths: readonly string[];
  adoptionAuthorized: boolean;
}>;

function validId(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function validPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes("\0") &&
    !path.posix.isAbsolute(value.replaceAll("\\", "/")) &&
    !value.replaceAll("\\", "/").split("/").includes("..")
  );
}

function stringArray(value: unknown, validator = validId) {
  const snapshot = snapshotPlainArray(value, 1024);
  return snapshot.status === "ok" &&
    snapshot.value.every((entry) => validator(entry))
    ? Object.freeze([...(snapshot.value as readonly string[])])
    : null;
}

function inspectCandidate(
  raw: unknown,
  state: ProjectRuntimeState,
): Candidate | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "candidateId",
      "candidateHash",
      "baseRevision",
      "changedPaths",
      "objectiveEvidence",
      "milestoneEvidence",
      "conflicts",
      "cleanupConfirmed",
    ] as const),
  );
  if (
    value?.status !== "candidate" ||
    !validId(value.candidateId) ||
    !validHash(value.candidateHash) ||
    value.baseRevision !== state.repositoryRevision ||
    value.cleanupConfirmed !== true
  )
    return null;
  const changedPaths = stringArray(value.changedPaths, validPath);
  const conflicts = stringArray(value.conflicts, validId);
  const milestoneEvidence = stringArray(value.milestoneEvidence, validId);
  const objectiveIds = state.objectives.map(
    (objective) => objective.definition.id,
  );
  const rawObjectiveEvidence = snapshotPlainRecord(
    value.objectiveEvidence,
    new Set(objectiveIds),
  );
  if (
    !changedPaths ||
    !conflicts ||
    !milestoneEvidence ||
    !rawObjectiveEvidence
  )
    return null;
  const objectiveEvidence: Record<string, readonly string[]> = {};
  for (const objective of state.objectives) {
    const evidence = stringArray(
      rawObjectiveEvidence[objective.definition.id],
      validId,
    );
    if (!evidence) return null;
    objectiveEvidence[objective.definition.id] = evidence;
  }
  return Object.freeze({
    status: "candidate",
    candidateId: value.candidateId,
    candidateHash: value.candidateHash,
    baseRevision: value.baseRevision,
    changedPaths,
    objectiveEvidence: Object.freeze(objectiveEvidence),
    milestoneEvidence,
    conflicts,
    cleanupConfirmed: true,
  });
}

function inspectRepository(raw: unknown) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "repositoryRevision",
      "dirty",
      "observedPaths",
    ] as const),
  );
  if (
    value?.status !== "observed" ||
    !validRevision(value.repositoryRevision) ||
    typeof value.dirty !== "boolean"
  )
    return null;
  const observedPaths = stringArray(value.observedPaths, validPath);
  return observedPaths
    ? Object.freeze({
        repositoryRevision: value.repositoryRevision,
        dirty: value.dirty,
        observedPaths,
      })
    : null;
}

function inspectReceipt(raw: unknown): AdoptionReceipt | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "receiptId",
      "beforeRevision",
      "afterRevision",
      "changedPaths",
      "cleanupConfirmed",
    ] as const),
  );
  if (
    value?.status !== "completed" ||
    !validId(value.receiptId) ||
    !validRevision(value.beforeRevision) ||
    !validRevision(value.afterRevision) ||
    value.cleanupConfirmed !== true
  )
    return null;
  const changedPaths = stringArray(value.changedPaths, validPath);
  return changedPaths
    ? Object.freeze({
        status: "completed",
        receiptId: value.receiptId,
        beforeRevision: value.beforeRevision,
        afterRevision: value.afterRevision,
        changedPaths,
        cleanupConfirmed: true,
      })
    : null;
}

function pathWithinAllowed(candidate: string, allowedPaths: readonly string[]) {
  const normalized = candidate.replaceAll("\\", "/").toUpperCase();
  return allowedPaths.some((allowed) => {
    const root = allowed
      .replaceAll("\\", "/")
      .replace(/\/+$/u, "")
      .toUpperCase();
    return normalized === root || normalized.startsWith(`${root}/`);
  });
}

function writeImmutableRecord(
  input: IntegrationInput,
  kind: "integration" | "adoption",
  identity: string,
  value: unknown,
) {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    input.workingDirectory,
  );
  const directory = path.join(
    repositoryRoot,
    ".crdd",
    "project-runtime",
    kind,
    input.projectId,
  );
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const payload = `${JSON.stringify({
    contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
    kind,
    repositoryBindingId: input.repositoryBindingId,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    queueId: input.queueId,
    identity,
    contentHash: createHash("sha256")
      .update(JSON.stringify(value))
      .digest("hex"),
    value,
  })}\n`;
  const target = path.join(directory, `${identity}.json`);
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target, "utf8") !== payload)
      throw new Error("project_runtime_integration_record_conflict");
    return;
  }
  const temporary = path.join(directory, `.pending-${randomUUID()}.tmp`);
  const descriptor = fs.openSync(
    temporary,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
    0o600,
  );
  try {
    fs.writeFileSync(descriptor, payload, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== payload)
      throw error;
  }
  if (fs.readFileSync(target, "utf8") !== payload)
    throw new Error("project_runtime_integration_record_readback_failed");
}

function response(
  input: IntegrationInput,
  status: "completed" | "blocked",
  reason: string,
  state: ProjectRuntimeState | null,
  options: Readonly<{
    candidateId?: string | null;
    receiptId?: string | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    recoveryIds?: readonly string[];
  }> = {},
) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
    status,
    reason,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    queueId: input.queueId,
    stateGeneration: state?.generation ?? null,
    candidateId: options.candidateId ?? null,
    receiptId: options.receiptId ?? null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
  });
}

/**
 * Integrate terminal Task candidates and, when explicitly authorized, adopt
 * the fixed result.  Candidate creation and canonical adoption are separate
 * effects; neither runs while a Project State mutation lock is held.
 */
export async function integrateProjectRuntimeOperation(
  dependencies: ProjectRuntimeIntegrationDependencies,
  input: IntegrationInput,
) {
  const stateRead = readProjectRuntimeState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.projectId,
  );
  const queueRead = readProjectOperationQueueState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.queueId,
  );
  if (
    stateRead.status !== "completed" ||
    stateRead.value === null ||
    queueRead.status !== "completed"
  )
    return response(
      input,
      "blocked",
      "project_runtime_integration_observation_unknown",
      null,
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      },
    );
  let state = stateRead.value;
  const queue = queueRead.value;
  const activeTasks = state.tasks.filter((task) => task.state !== "superseded");
  const persistedCandidateIds = activeTasks.map((task) => task.candidateId);
  const taskCandidateIds = input.taskCandidateIds ?? persistedCandidateIds;
  if (
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.state !== "integration_pending" ||
    queue.ownerGeneration !== null ||
    !activeTasks.every(
      (task) => task.state === "completed" && task.cleanupConfirmed,
    ) ||
    taskCandidateIds.length !== activeTasks.length ||
    new Set(taskCandidateIds).size !== taskCandidateIds.length ||
    !taskCandidateIds.every((id) => validId(id)) ||
    !taskCandidateIds.every(
      (id, index) => id === persistedCandidateIds[index],
    ) ||
    !input.allowedPaths.every(validPath)
  )
    return response(
      input,
      "blocked",
      "project_runtime_integration_precondition_failed",
      state,
    );

  let rawCandidate: unknown;
  try {
    rawCandidate = await dependencies.createCandidate({
      state,
      taskCandidateIds: Object.freeze([
        ...(taskCandidateIds as readonly string[]),
      ]),
    });
  } catch {
    rawCandidate = null;
  }
  const candidate = inspectCandidate(rawCandidate, state);
  if (!candidate)
    return response(
      input,
      "blocked",
      "project_runtime_integration_candidate_invalid",
      state,
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      },
    );
  try {
    writeImmutableRecord(
      input,
      "integration",
      candidate.candidateId,
      candidate,
    );
  } catch {
    return response(
      input,
      "blocked",
      "project_runtime_integration_record_unknown",
      state,
      {
        candidateId: candidate.candidateId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      },
    );
  }
  if (
    candidate.conflicts.length > 0 ||
    candidate.changedPaths.some(
      (changedPath) => !pathWithinAllowed(changedPath, input.allowedPaths),
    )
  ) {
    const objective = state.objectives.find(
      (entry) => entry.state === "integration_pending",
    );
    if (objective) {
      const rejected = recordObjectiveIntegration(
        state,
        state.generation,
        objective.definition.id,
        {
          accepted: false,
          criterionEvidenceIds:
            candidate.objectiveEvidence[objective.definition.id] ?? [],
        },
      );
      if (rejected.status === "completed") {
        const written = writeProjectRuntimeState(
          input.workingDirectory,
          input.repositoryBindingId,
          rejected.state,
          state.generation,
        );
        if (written.status === "completed") state = rejected.state;
      }
      const decision = requestProjectRuntimeHumanDecision(
        state,
        state.generation,
        objective.definition.id,
      );
      if (decision.status === "completed") {
        const written = writeProjectRuntimeState(
          input.workingDirectory,
          input.repositoryBindingId,
          decision.state,
          state.generation,
        );
        if (written.status === "completed") state = decision.state;
      }
    }
    const decisionQueue = updateProjectOperationQueueState(
      input.workingDirectory,
      input.repositoryBindingId,
      input.queueId,
      queue.generation,
      {
        state: "human_decision_required",
        lease: null,
        resumeCondition: "integration_conflict",
        resultReference: candidate.candidateId,
      },
    );
    if (decisionQueue.status !== "completed")
      return response(input, "blocked", decisionQueue.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
    return response(
      input,
      "blocked",
      "project_runtime_integration_conflict",
      state,
      {
        candidateId: candidate.candidateId,
      },
    );
  }

  let receipt: AdoptionReceipt | null = null;
  if (input.adoptionAuthorized) {
    if (typeof dependencies.observeLeaseOwner !== "function")
      return response(
        input,
        "blocked",
        "project_runtime_lease_owner_observation_unavailable",
        state,
        {
          candidateId: candidate.candidateId,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        },
      );
    const prepared = reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
      input.workingDirectory,
      input.repositoryBindingId,
      input.projectId,
      dependencies.observeLeaseOwner,
    );
    if (prepared.status !== "completed")
      return response(input, "blocked", prepared.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: !prepared.manualRecoveryRequired,
        manualRecoveryRequired: prepared.manualRecoveryRequired,
        ...(prepared.recoveryId === null
          ? {}
          : { recoveryIds: Object.freeze([prepared.recoveryId]) }),
      });
    const leaseResult = acquireProjectRuntimeLease(
      input.workingDirectory,
      input.repositoryBindingId,
      input.projectId,
      "canonical",
      "canonical-adoption",
    );
    if (leaseResult.status !== "completed")
      return response(input, "blocked", leaseResult.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: false,
        manualRecoveryRequired: leaseResult.manualRecoveryRequired,
      });
    const lease = leaseResult.value;
    let adoptionFailure: Readonly<{
      reason: string;
      cleanupConfirmed: boolean;
      manualRecoveryRequired: boolean;
    }> | null = null;
    try {
      const observed = inspectRepository(
        dependencies.observeCanonicalRepository(),
      );
      if (
        !observed ||
        observed.repositoryRevision !== candidate.baseRevision ||
        observed.dirty ||
        observed.observedPaths.some(
          (observedPath) =>
            !pathWithinAllowed(observedPath, input.allowedPaths),
        )
      ) {
        adoptionFailure = Object.freeze({
          reason: "project_runtime_adoption_revision_or_scope_mismatch",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
        });
      } else {
        let rawReceipt: unknown;
        try {
          rawReceipt = await dependencies.adoptCandidate(candidate);
        } catch {
          rawReceipt = null;
        }
        receipt = inspectReceipt(rawReceipt);
        if (
          !receipt ||
          receipt.beforeRevision !== candidate.baseRevision ||
          receipt.changedPaths.length !== candidate.changedPaths.length ||
          !receipt.changedPaths.every((value) =>
            candidate.changedPaths.includes(value),
          )
        ) {
          adoptionFailure = Object.freeze({
            reason: "project_runtime_adoption_receipt_invalid",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
          });
          receipt = null;
        } else {
          writeImmutableRecord(input, "adoption", receipt.receiptId, receipt);
        }
      }
    } catch {
      adoptionFailure = Object.freeze({
        reason: "project_runtime_adoption_observation_unknown",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
    } finally {
      const released = lease.release();
      if (released.status !== "completed") {
        adoptionFailure = Object.freeze({
          reason: "project_runtime_adoption_lease_release_unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        });
        receipt = null;
      }
    }
    if (adoptionFailure)
      return response(input, "blocked", adoptionFailure.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: adoptionFailure.cleanupConfirmed,
        manualRecoveryRequired: adoptionFailure.manualRecoveryRequired,
      });
  }

  for (const objective of state.objectives.filter(
    (entry) => entry.state === "integration_pending",
  )) {
    const integrated = recordObjectiveIntegration(
      state,
      state.generation,
      objective.definition.id,
      {
        accepted: true,
        criterionEvidenceIds:
          candidate.objectiveEvidence[objective.definition.id] ?? [],
      },
    );
    if (integrated.status !== "completed")
      return response(input, "blocked", integrated.reason, state, {
        candidateId: candidate.candidateId,
        receiptId: receipt?.receiptId ?? null,
      });
    const written = writeProjectRuntimeState(
      input.workingDirectory,
      input.repositoryBindingId,
      integrated.state,
      state.generation,
    );
    if (written.status !== "completed")
      return response(input, "blocked", written.reason, state, {
        candidateId: candidate.candidateId,
        receiptId: receipt?.receiptId ?? null,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
    state = integrated.state;
  }
  const milestone =
    state.milestone.state === "accepted"
      ? Object.freeze({
          status: "completed" as const,
          reason: "project_runtime_milestone_already_accepted",
          state,
          taskIds: Object.freeze([]),
        })
      : recordMilestoneIntegration(
          state,
          state.generation,
          candidate.milestoneEvidence,
        );
  if (milestone.status !== "completed")
    return response(input, "blocked", milestone.reason, state, {
      candidateId: candidate.candidateId,
      receiptId: receipt?.receiptId ?? null,
    });
  if (milestone.state.generation !== state.generation) {
    const milestoneWrite = writeProjectRuntimeState(
      input.workingDirectory,
      input.repositoryBindingId,
      milestone.state,
      state.generation,
    );
    if (milestoneWrite.status !== "completed")
      return response(input, "blocked", milestoneWrite.reason, state, {
        candidateId: candidate.candidateId,
        receiptId: receipt?.receiptId ?? null,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
  }
  const completedQueue = updateProjectOperationQueueState(
    input.workingDirectory,
    input.repositoryBindingId,
    input.queueId,
    queue.generation,
    {
      state: "completed",
      lease: null,
      resumeCondition: null,
      resultReference: receipt?.receiptId ?? candidate.candidateId,
    },
  );
  if (completedQueue.status !== "completed")
    return response(input, "blocked", completedQueue.reason, milestone.state, {
      candidateId: candidate.candidateId,
      receiptId: receipt?.receiptId ?? null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  return response(
    input,
    "completed",
    "project_runtime_milestone_accepted",
    milestone.state,
    {
      candidateId: candidate.candidateId,
      receiptId: receipt?.receiptId ?? null,
    },
  );
}

export function describeProjectRuntimeIntegrationContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
    taskPassImpliesAcceptance: false,
    candidateAndAdoptionEffectsSeparated: true,
    canonicalAdoptionRequiresFreshRevisionAndScope: true,
    immutableIntegrationAndAdoptionRecords: true,
  });
}
