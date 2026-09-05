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
  replacementRequestId: string | null;
}>;

export type ProjectRuntimeDecisionStore = Readonly<{
  create: (record: ProjectRuntimeDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecord,
    next: ProjectRuntimeDecisionRecord,
  ) => unknown;
}>;

export type ProjectRuntimeDecisionRecoveryIntent = Readonly<{
  recoveryId: string;
  recordId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  applicationId: string | null;
  expectedGeneration: number;
  newGeneration: number | null;
  observedDisposition: ProjectRuntimeDecisionRecord["disposition"] | "unknown";
  unknownBoundary: string;
  disposition: "required" | "settled";
}>;

export type ProjectRuntimeDecisionRecoveryStore = Readonly<{
  create: (intent: ProjectRuntimeDecisionRecoveryIntent) => unknown;
  read: (recoveryId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecoveryIntent,
    next: ProjectRuntimeDecisionRecoveryIntent,
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
  recoveryStore?: ProjectRuntimeDecisionRecoveryStore;
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
      (Number.isSafeInteger(value.newGeneration) &&
        value.newGeneration >= 2)) &&
    (value.replacementRequestId === null || validId(value.replacementRequestId))
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
function blocked(reason: string, isRecovery = false) {
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !isRecovery,
    manualRecoveryRequired: isRecovery,
    effectState: isRecovery ? ("unknown" as const) : ("no_effect" as const),
  });
}

function recoveryIdentity(record: ProjectRuntimeDecisionRecord) {
  return `decision-recovery-${digest(
    [
      record.recordId,
      record.applicationId ?? "none",
      String(record.expectedGeneration),
      String(record.newGeneration ?? "none"),
    ].join("\0"),
  ).slice(0, 40)}`;
}

function recoveryStored(
  raw: unknown,
  expected?: ProjectRuntimeDecisionRecoveryIntent,
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = (raw as Record<string, unknown>).value;
  return (
    (raw as Record<string, unknown>).status === "completed" &&
    Boolean(value) &&
    (!expected || JSON.stringify(value) === JSON.stringify(expected))
  );
}

function persistRecoveryIntent(
  commonFields: Common,
  record: ProjectRuntimeDecisionRecord,
  unknownBoundary: string,
) {
  const recoveryId = recoveryIdentity(record);
  if (!commonFields.recoveryStore) return null;
  const intent: ProjectRuntimeDecisionRecoveryIntent = Object.freeze({
    recoveryId,
    recordId: record.recordId,
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    queueId: record.queueId,
    applicationId: record.applicationId,
    expectedGeneration: record.expectedGeneration,
    newGeneration: record.newGeneration,
    observedDisposition: record.disposition,
    unknownBoundary,
    disposition: "required",
  });
  try {
    const observed = commonFields.recoveryStore.read(recoveryId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecoveryIntent | null;
    }> | null;
    if (
      observed?.status === "completed" &&
      observed.value?.disposition === "required"
    )
      return observed.value;
    return recoveryStored(commonFields.recoveryStore.create(intent), intent)
      ? intent
      : null;
  } catch {
    return null;
  }
}

function recoveryBlocked(
  commonFields: Common,
  record: ProjectRuntimeDecisionRecord,
  unknownBoundary: string,
) {
  const intent = persistRecoveryIntent(commonFields, record, unknownBoundary);
  return Object.freeze({
    ...blocked("project_runtime_decision_recovery_required", true),
    processRestartRequired: true,
    recoveryId: intent?.recoveryId ?? null,
  });
}

function settleRecoveryIntent(
  commonFields: Common,
  record: ProjectRuntimeDecisionRecord,
) {
  if (!commonFields.recoveryStore) return true;
  const recoveryId = recoveryIdentity(record);
  try {
    const observed = commonFields.recoveryStore.read(recoveryId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecoveryIntent | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value) return true;
    if (observed.value.disposition === "settled") return true;
    const settled = Object.freeze({
      ...observed.value,
      disposition: "settled" as const,
    });
    return recoveryStored(
      commonFields.recoveryStore.compareAndSet(observed.value, settled),
      settled,
    );
  } catch {
    return false;
  }
}

/** Issue a one-time continuation capability. Only its hash enters the protected store. */
export function issueProjectRuntimeHumanDecision(
  commonFields: Common,
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
      commonFields.repositoryBindingId,
      commonFields.projectId,
      commonFields.milestoneId,
      commonFields.queueId,
      commonFields.principalId,
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
    commonFields.projectId,
    commonFields.milestoneId,
    input.decisionId,
  );
  const record: ProjectRuntimeDecisionRecord = Object.freeze({
    recordId,
    decisionId: input.decisionId,
    projectId: commonFields.projectId,
    milestoneId: commonFields.milestoneId,
    queueId: commonFields.queueId,
    repositoryRevision: input.repositoryRevision,
    expectedGeneration: input.expectedGeneration,
    principalId: commonFields.principalId,
    allowedOptions: Object.freeze([...input.allowedOptions]),
    capabilityHash: digest(capability),
    expiresAtEpochMs: now + input.lifetimeMs,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
    replacementRequestId: null,
  });
  try {
    if (!stored(commonFields.store.create(record), record))
      return recoveryBlocked(commonFields, record, "continuation_issue");
  } catch {
    return recoveryBlocked(commonFields, record, "continuation_issue");
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
  commonFields: Common,
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
      commonFields.repositoryBindingId,
      commonFields.projectId,
      commonFields.milestoneId,
      commonFields.queueId,
      commonFields.principalId,
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
    const observed = commonFields.store.read(input.recordId);
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
      if (!stored(commonFields.store.compareAndSet(record, expired), expired))
        return recoveryBlocked(commonFields, record, "continuation_expiry");
    } catch {
      return recoveryBlocked(commonFields, record, "continuation_expiry");
    }
    return blocked("project_runtime_decision_expired");
  }
  if (
    record.disposition !== "pending" ||
    record.decisionId !== input.decisionId ||
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.repositoryRevision !== input.repositoryRevision ||
    record.expectedGeneration !== input.generation ||
    record.principalId !== commonFields.principalId ||
    !record.allowedOptions.includes(input.selectedOption) ||
    record.capabilityHash !== digest(input.continuationCapability)
  )
    return blocked("project_runtime_decision_binding_mismatch_or_expired");
  const stateRead = readProjectRuntimeState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    commonFields.projectId,
  );
  const queueRead = readProjectOperationQueueState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    commonFields.queueId,
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
    stateRead.value.milestoneId !== commonFields.milestoneId ||
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
    if (!stored(commonFields.store.compareAndSet(record, prepared), prepared))
      return recoveryBlocked(commonFields, record, "continuation_prepare");
  } catch {
    return recoveryBlocked(commonFields, record, "continuation_prepare");
  }
  const transition = applyProjectRuntimeHumanDecision(
    stateRead.value,
    input.generation,
    input.selectedOption,
    applicationId,
  );
  if (transition.status !== "completed" || !transition.state)
    return recoveryBlocked(commonFields, prepared, "project_transition");
  const written = writeProjectRuntimeState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    transition.state,
    input.generation,
  );
  if (written.status !== "completed")
    return recoveryBlocked(commonFields, prepared, "project_write");
  const readback = readProjectRuntimeState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    commonFields.projectId,
  );
  if (
    readback.status !== "completed" ||
    !readback.value ||
    readback.value.generation !== input.generation + 1 ||
    readback.value.decisionApplicationId !== applicationId ||
    readback.value.milestone.state !==
      (input.selectedOption === "resume" ? "executing" : "cancelled")
  )
    return recoveryBlocked(commonFields, prepared, "project_readback");
  const finalized = Object.freeze({
    ...prepared,
    disposition: "finalized" as const,
  });
  try {
    if (
      !stored(commonFields.store.compareAndSet(prepared, finalized), finalized)
    )
      return recoveryBlocked(commonFields, prepared, "continuation_finalize");
  } catch {
    return recoveryBlocked(commonFields, prepared, "continuation_finalize");
  }
  const queueUpdate = updateProjectOperationQueueState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    commonFields.queueId,
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
    return recoveryBlocked(commonFields, finalized, "queue_update");
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

/** Replace a capability only after the former hash is durably invalidated. */
export function replaceProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{
    recordId: string;
    replacementRequestId: string;
    lifetimeMs: number;
    nowEpochMs?: number;
  }>,
) {
  if (
    !validId(input.recordId) ||
    !validId(input.replacementRequestId) ||
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 1_000 ||
    input.lifetimeMs > 86_400_000
  )
    return blocked("project_runtime_decision_replacement_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecord | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value)
      return blocked("project_runtime_decision_not_observed");
    record = observed.value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  if (
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.principalId !== commonFields.principalId
  )
    return blocked("project_runtime_decision_replacement_binding_mismatch");
  if (
    record.disposition === "pending" &&
    record.replacementRequestId === input.replacementRequestId
  )
    return blocked("project_runtime_decision_replacement_already_issued");
  if (record.disposition !== "pending")
    return blocked("project_runtime_decision_replacement_not_applicable");
  const invalidated = Object.freeze({
    ...record,
    disposition: "invalidated" as const,
    replacementRequestId: input.replacementRequestId,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(record, invalidated),
        invalidated,
      )
    )
      return recoveryBlocked(commonFields, record, "replacement_invalidation");
  } catch {
    return recoveryBlocked(commonFields, record, "replacement_invalidation");
  }
  const capability = randomBytes(32).toString("base64url");
  const replacement: ProjectRuntimeDecisionRecord = Object.freeze({
    ...invalidated,
    capabilityHash: digest(capability),
    expiresAtEpochMs: (input.nowEpochMs ?? Date.now()) + input.lifetimeMs,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(invalidated, replacement),
        replacement,
      )
    )
      return recoveryBlocked(commonFields, invalidated, "replacement_issue");
  } catch {
    return recoveryBlocked(commonFields, invalidated, "replacement_issue");
  }
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_human_decision_replaced",
    decisionId: replacement.decisionId,
    recordId: replacement.recordId,
    replacementRequestId: input.replacementRequestId,
    continuationCapability: capability,
    allowedOptions: replacement.allowedOptions,
    expiresAtEpochMs: replacement.expiresAtEpochMs,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/** Invalidate an unused capability after a fresh parent lifecycle observation. */
export function invalidateProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{
    recordId: string;
    reason: "project_advanced" | "milestone_accepted" | "milestone_cancelled";
  }>,
) {
  if (!validId(input.recordId))
    return blocked("project_runtime_decision_invalidation_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId) as Readonly<{
      status: string;
      value: ProjectRuntimeDecisionRecord | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value)
      return blocked("project_runtime_decision_not_observed");
    record = observed.value;
  } catch {
    return blocked("project_runtime_decision_store_observation_unknown", true);
  }
  if (record.disposition === "prepared")
    return recoverProjectRuntimeHumanDecision(commonFields, {
      recordId: input.recordId,
    });
  if (["invalidated", "expired", "finalized"].includes(record.disposition))
    return Object.freeze({
      contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
      status: "completed" as const,
      reason: "project_runtime_decision_already_settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled" as const,
    });
  if (record.disposition !== "pending")
    return blocked("project_runtime_decision_invalidation_not_applicable");
  const state = readProjectRuntimeState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    commonFields.projectId,
  );
  if (state.status !== "completed" || !state.value)
    return recoveryBlocked(
      commonFields,
      record,
      "invalidation_project_observation",
    );
  const isParentProvesInvalidation =
    state.value.generation !== record.expectedGeneration ||
    (input.reason === "milestone_accepted" &&
      state.value.milestone.state === "accepted") ||
    (input.reason === "milestone_cancelled" &&
      state.value.milestone.state === "cancelled");
  if (!isParentProvesInvalidation)
    return blocked("project_runtime_decision_invalidation_not_proven");
  const invalidated = Object.freeze({
    ...record,
    disposition: "invalidated" as const,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(record, invalidated),
        invalidated,
      )
    )
      return recoveryBlocked(commonFields, record, "invalidation_update");
  } catch {
    return recoveryBlocked(commonFields, record, "invalidation_update");
  }
  return Object.freeze({
    contract: PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "project_runtime_decision_invalidated",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/** Reconcile a prepared decision after process loss without replaying its authority. */
export function recoverProjectRuntimeHumanDecision(
  commonFields: Common,
  input: Readonly<{ recordId: string }>,
) {
  if (!validId(input.recordId))
    return blocked("project_runtime_decision_recovery_input_invalid");
  let record: ProjectRuntimeDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId);
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
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.principalId !== commonFields.principalId ||
    record.applicationId === null ||
    record.selectedOption === null ||
    record.newGeneration !== record.expectedGeneration + 1
  )
    return blocked("project_runtime_decision_recovery_not_applicable");
  const state = readProjectRuntimeState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    commonFields.projectId,
  );
  if (state.status !== "completed" || !state.value)
    return recoveryBlocked(
      commonFields,
      record,
      "recovery_project_observation",
    );
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
    return recoveryBlocked(commonFields, record, "recovery_identity_mismatch");
  }
  try {
    if (!stored(commonFields.store.compareAndSet(record, next), next))
      return recoveryBlocked(
        commonFields,
        record,
        "recovery_continuation_update",
      );
  } catch {
    return recoveryBlocked(
      commonFields,
      record,
      "recovery_continuation_update",
    );
  }
  if (next.disposition === "invalidated")
    return blocked("project_runtime_decision_recovery_invalidated");
  const queueRead = readProjectOperationQueueState(
    commonFields.workingDirectory,
    commonFields.repositoryBindingId,
    commonFields.queueId,
  );
  if (queueRead.status !== "completed")
    return recoveryBlocked(commonFields, next, "recovery_queue_observation");
  if (queueRead.value.state === "human_decision_required") {
    const queueUpdate = updateProjectOperationQueueState(
      commonFields.workingDirectory,
      commonFields.repositoryBindingId,
      commonFields.queueId,
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
      return recoveryBlocked(commonFields, next, "recovery_queue_update");
  }
  if (!settleRecoveryIntent(commonFields, next))
    return recoveryBlocked(commonFields, next, "recovery_intent_settlement");
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
