import { createHash, randomBytes } from "node:crypto";

import {
  readProjectOperationQueueState,
  readProjectRuntimeState,
  updateProjectOperationQueueState,
  writeProjectRuntimeState,
} from "./project-runtime-durable-foundation.ts";
import { applyProjectRuntimeHumanDecision } from "./project-runtime-state.ts";

export const PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT =
  "crdd-coordinator/project-runtime-human-decision/v1" as const;

export type ProjectRuntimeDecisionRecord = Readonly<{
  recordId: string;
  decisionId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  principalId: string;
  allowedOptions: readonly ("resume" | "cancel")[];
  capabilityHash: string;
  expiresAtEpochMs: number;
  disposition:
    | "pending"
    | "prepared"
    | "finalized"
    | "invalidated"
    | "expired"
    | "recovery_required";
  applicationId: string | null;
  selectedOption: "resume" | "cancel" | null;
  newGeneration: number | null;
}>;

export type ProjectRuntimeDecisionStore = Readonly<{
  create: (record: ProjectRuntimeDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecord,
    next: ProjectRuntimeDecisionRecord,
  ) => unknown;
}>;

type Common = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  principalId: string;
  store: ProjectRuntimeDecisionStore;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const REVISION = /^[0-9a-f]{40,64}$/u;
const HASH = /^[0-9a-f]{64}$/u;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function projectRuntimeDecisionRecordId(
  projectId: string,
  milestoneId: string,
  decisionId: string,
) {
  return `decision-${digest([projectId, milestoneId, decisionId].join("\0")).slice(0, 40)}`;
}
function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}
export function isProjectRuntimeDecisionRecord(
  raw: unknown,
): raw is ProjectRuntimeDecisionRecord {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.getPrototypeOf(raw) !== Object.prototype
  )
    return false;
  const value = raw as ProjectRuntimeDecisionRecord;
  return (
    validId(value.recordId) &&
    validId(value.decisionId) &&
    validId(value.projectId) &&
    validId(value.milestoneId) &&
    validId(value.queueId) &&
    REVISION.test(value.repositoryRevision) &&
    Number.isSafeInteger(value.expectedGeneration) &&
    value.expectedGeneration >= 1 &&
    validId(value.principalId) &&
    Array.isArray(value.allowedOptions) &&
    value.allowedOptions.length > 0 &&
    value.allowedOptions.every(
      (option) => option === "resume" || option === "cancel",
    ) &&
    HASH.test(value.capabilityHash) &&
    Number.isSafeInteger(value.expiresAtEpochMs) &&
    [
      "pending",
      "prepared",
      "finalized",
      "invalidated",
      "expired",
      "recovery_required",
    ].includes(value.disposition) &&
    (value.applicationId === null || validId(value.applicationId)) &&
    (value.selectedOption === null ||
      value.selectedOption === "resume" ||
      value.selectedOption === "cancel") &&
    (value.newGeneration === null ||
      (Number.isSafeInteger(value.newGeneration) && value.newGeneration >= 2))
  );
}
function stored(raw: unknown, expected?: ProjectRuntimeDecisionRecord) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  return (
    value.status === "completed" &&
    isProjectRuntimeDecisionRecord(value.value) &&
    (!expected || JSON.stringify(value.value) === JSON.stringify(expected))
  );
}
function blocked(reason: string, recovery = false) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !recovery,
    manualRecoveryRequired: recovery,
    effectState: recovery ? ("unknown" as const) : ("no_effect" as const),
  });
}

/** Issue a one-time continuation capability. Only its hash enters the protected store. */
export function issueProjectRuntimeHumanDecision(
  common: Common,
  input: Readonly<{
    decisionId: string;
    repositoryRevision: string;
    expectedGeneration: number;
    allowedOptions: readonly ("resume" | "cancel")[];
    lifetimeMs: number;
    nowEpochMs?: number;
  }>,
) {
  if (
    ![
      common.repositoryBindingId,
      common.projectId,
      common.milestoneId,
      common.queueId,
      common.principalId,
      input.decisionId,
    ].every(validId) ||
    !REVISION.test(input.repositoryRevision) ||
    !Number.isSafeInteger(input.expectedGeneration) ||
    input.expectedGeneration < 1 ||
    input.allowedOptions.length === 0 ||
    new Set(input.allowedOptions).size !== input.allowedOptions.length ||
    !input.allowedOptions.every(
      (option) => option === "resume" || option === "cancel",
    ) ||
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 1_000 ||
    input.lifetimeMs > 86_400_000
  )
    return blocked("project_runtime_decision_request_invalid");
  const now = input.nowEpochMs ?? Date.now();
  const capability = randomBytes(32).toString("base64url");
  const recordId = projectRuntimeDecisionRecordId(
    common.projectId,
    common.milestoneId,
    input.decisionId,
  );
  const record: ProjectRuntimeDecisionRecord = Object.freeze({
    recordId,
    decisionId: input.decisionId,
    projectId: common.projectId,
    milestoneId: common.milestoneId,
    queueId: common.queueId,
    repositoryRevision: input.repositoryRevision,
    expectedGeneration: input.expectedGeneration,
    principalId: common.principalId,
    allowedOptions: Object.freeze([...input.allowedOptions]),
    capabilityHash: digest(capability),
    expiresAtEpochMs: now + input.lifetimeMs,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
  });
  try {
    if (!stored(common.store.create(record), record))
      return blocked("project_runtime_decision_store_create_unknown", true);
  } catch {
    return blocked("project_runtime_decision_store_create_unknown", true);
  }
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_human_decision_issued",
    decisionId: input.decisionId,
    recordId,
    continuationCapability: capability,
    allowedOptions: record.allowedOptions,
    expiresAtEpochMs: record.expiresAtEpochMs,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/** Apply a decision by protected-store prepare -> repository generation -> protected-store finalize. */
export function submitProjectRuntimeHumanDecision(
  common: Common,
  input: Readonly<{
    decisionId: string;
    recordId: string;
    repositoryRevision: string;
    generation: number;
    selectedOption: "resume" | "cancel";
    continuationCapability: string;
    nowEpochMs?: number;
  }>,
) {
  if (
    ![
      common.repositoryBindingId,
      common.projectId,
      common.milestoneId,
      common.queueId,
      common.principalId,
      input.decisionId,
      input.recordId,
    ].every(validId) ||
    !REVISION.test(input.repositoryRevision) ||
    !Number.isSafeInteger(input.generation) ||
    input.generation < 1 ||
    (input.selectedOption !== "resume" && input.selectedOption !== "cancel") ||
    typeof input.continuationCapability !== "string" ||
    input.continuationCapability.length > 512
  )
    return blocked("project_runtime_decision_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = common.store.read(input.recordId);
    if (
      !observed ||
      typeof observed !== "object" ||
      !isProjectRuntimeDecisionRecord(
        (observed as Record<string, unknown>).value,
      )
    )
      return blocked("project_runtime_decision_not_observed");
    record = (observed as { value: ProjectRuntimeDecisionRecord }).value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  const now = input.nowEpochMs ?? Date.now();
  if (record.disposition === "finalized")
    return blocked("project_runtime_decision_already_consumed");
  if (record.disposition === "pending" && record.expiresAtEpochMs < now) {
    const expired = Object.freeze({
      ...record,
      disposition: "expired" as const,
    });
    try {
      if (!stored(common.store.compareAndSet(record, expired), expired))
        return blocked("project_runtime_decision_expiry_unknown", true);
    } catch {
      return blocked("project_runtime_decision_expiry_unknown", true);
    }
    return blocked("project_runtime_decision_expired");
  }
  if (
    record.disposition !== "pending" ||
    record.decisionId !== input.decisionId ||
    record.projectId !== common.projectId ||
    record.milestoneId !== common.milestoneId ||
    record.queueId !== common.queueId ||
    record.repositoryRevision !== input.repositoryRevision ||
    record.expectedGeneration !== input.generation ||
    record.principalId !== common.principalId ||
    !record.allowedOptions.includes(input.selectedOption) ||
    record.capabilityHash !== digest(input.continuationCapability)
  )
    return blocked("project_runtime_decision_binding_mismatch_or_expired");
  const stateRead = readProjectRuntimeState(
    common.workingDirectory,
    common.repositoryBindingId,
    common.projectId,
  );
  const queueRead = readProjectOperationQueueState(
    common.workingDirectory,
    common.repositoryBindingId,
    common.queueId,
  );
  if (
    stateRead.status !== "completed" ||
    !stateRead.value ||
    queueRead.status !== "completed"
  )
    return blocked(
      "project_runtime_decision_repository_observation_unknown",
      true,
    );
  if (
    stateRead.value.milestoneId !== common.milestoneId ||
    stateRead.value.repositoryRevision !== input.repositoryRevision ||
    stateRead.value.generation !== input.generation ||
    queueRead.value.state !== "human_decision_required" ||
    queueRead.value.ownerGeneration !== null
  )
    return blocked("project_runtime_decision_stale");
  const applicationId = `decision-application-${digest([record.recordId, String(input.generation), input.selectedOption].join("\0")).slice(0, 40)}`;
  const prepared = Object.freeze({
    ...record,
    disposition: "prepared" as const,
    applicationId,
    selectedOption: input.selectedOption,
    newGeneration: input.generation + 1,
  });
  try {
    if (!stored(common.store.compareAndSet(record, prepared), prepared))
      return blocked("project_runtime_decision_prepare_unknown", true);
  } catch {
    return blocked("project_runtime_decision_prepare_unknown", true);
  }
  const transition = applyProjectRuntimeHumanDecision(
    stateRead.value,
    input.generation,
    input.selectedOption,
    applicationId,
  );
  if (transition.status !== "completed" || !transition.state)
    return blocked("project_runtime_decision_state_transition_failed", true);
  const written = writeProjectRuntimeState(
    common.workingDirectory,
    common.repositoryBindingId,
    transition.state,
    input.generation,
  );
  if (written.status !== "completed") return blocked(written.reason, true);
  const readback = readProjectRuntimeState(
    common.workingDirectory,
    common.repositoryBindingId,
    common.projectId,
  );
  if (
    readback.status !== "completed" ||
    !readback.value ||
    readback.value.generation !== input.generation + 1 ||
    readback.value.decisionApplicationId !== applicationId ||
    readback.value.milestone.state !==
      (input.selectedOption === "resume" ? "executing" : "cancelled")
  )
    return blocked("project_runtime_decision_state_readback_unknown", true);
  const finalized = Object.freeze({
    ...prepared,
    disposition: "finalized" as const,
  });
  try {
    if (!stored(common.store.compareAndSet(prepared, finalized), finalized))
      return blocked("project_runtime_decision_finalize_unknown", true);
  } catch {
    return blocked("project_runtime_decision_finalize_unknown", true);
  }
  const queueUpdate = updateProjectOperationQueueState(
    common.workingDirectory,
    common.repositoryBindingId,
    common.queueId,
    queueRead.value.generation,
    {
      state:
        input.selectedOption === "resume" ? "replan_required" : "cancelled",
      lease: null,
      resumeCondition:
        input.selectedOption === "resume" ? "human_decision_applied" : null,
      resultReference: record.recordId,
    },
  );
  if (queueUpdate.status !== "completed")
    return blocked("project_runtime_decision_queue_update_unknown", true);
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason:
      input.selectedOption === "resume"
        ? "project_runtime_decision_applied_resume_pending"
        : "project_runtime_decision_applied_cancelled",
    decisionId: record.decisionId,
    applicationId,
    generation: input.generation + 1,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/** Reconcile a prepared decision after process loss without replaying its authority. */
export function recoverProjectRuntimeHumanDecision(
  common: Common,
  input: Readonly<{ recordId: string }>,
) {
  if (!validId(input.recordId))
    return blocked("project_runtime_decision_recovery_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = common.store.read(input.recordId);
    if (
      !observed ||
      typeof observed !== "object" ||
      !isProjectRuntimeDecisionRecord(
        (observed as Record<string, unknown>).value,
      )
    )
      return blocked("project_runtime_decision_not_observed");
    record = (observed as { value: ProjectRuntimeDecisionRecord }).value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  if (record.disposition === "finalized")
    return Object.freeze({
      contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
      status: "completed" as const,
      reason: "project_runtime_decision_recovery_already_finalized",
      decisionId: record.decisionId,
      applicationId: record.applicationId,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled" as const,
    });
  if (
    record.disposition !== "prepared" ||
    record.projectId !== common.projectId ||
    record.milestoneId !== common.milestoneId ||
    record.queueId !== common.queueId ||
    record.principalId !== common.principalId ||
    record.applicationId === null ||
    record.selectedOption === null ||
    record.newGeneration !== record.expectedGeneration + 1
  )
    return blocked("project_runtime_decision_recovery_not_applicable");
  const state = readProjectRuntimeState(
    common.workingDirectory,
    common.repositoryBindingId,
    common.projectId,
  );
  if (state.status !== "completed" || !state.value)
    return blocked("project_runtime_decision_recovery_state_unknown", true);
  let next: ProjectRuntimeDecisionRecord;
  if (
    state.value.generation === record.newGeneration &&
    state.value.decisionApplicationId === record.applicationId &&
    state.value.milestone.state ===
      (record.selectedOption === "resume" ? "executing" : "cancelled")
  ) {
    next = Object.freeze({ ...record, disposition: "finalized" as const });
  } else if (
    state.value.generation === record.expectedGeneration &&
    state.value.decisionApplicationId === null &&
    state.value.milestone.state === "human_decision_required"
  ) {
    next = Object.freeze({ ...record, disposition: "invalidated" as const });
  } else {
    return blocked("project_runtime_decision_recovery_identity_mismatch", true);
  }
  try {
    if (!stored(common.store.compareAndSet(record, next), next))
      return blocked("project_runtime_decision_recovery_store_unknown", true);
  } catch {
    return blocked("project_runtime_decision_recovery_store_unknown", true);
  }
  if (next.disposition === "invalidated")
    return blocked("project_runtime_decision_recovery_invalidated");
  const queueRead = readProjectOperationQueueState(
    common.workingDirectory,
    common.repositoryBindingId,
    common.queueId,
  );
  if (queueRead.status !== "completed")
    return blocked("project_runtime_decision_recovery_queue_unknown", true);
  if (queueRead.value.state === "human_decision_required") {
    const queueUpdate = updateProjectOperationQueueState(
      common.workingDirectory,
      common.repositoryBindingId,
      common.queueId,
      queueRead.value.generation,
      {
        state:
          record.selectedOption === "resume" ? "replan_required" : "cancelled",
        lease: null,
        resumeCondition:
          record.selectedOption === "resume" ? "human_decision_applied" : null,
        resultReference: record.recordId,
      },
    );
    if (queueUpdate.status !== "completed")
      return blocked("project_runtime_decision_recovery_queue_unknown", true);
  }
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_decision_recovery_finalized",
    decisionId: record.decisionId,
    applicationId: record.applicationId,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}
