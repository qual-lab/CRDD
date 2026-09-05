import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  ProjectRuntimeState,
  ProjectTaskRecoveryObligation,
} from "./project-runtime-state.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "./repository-root-resolution.ts";

export const PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT =
  "crdd-coordinator/project-runtime-durable-foundation/v1" as const;

export type ProjectQueueState =
  | "queued"
  | "leased"
  | "running"
  | "waiting_foreground"
  | "integration_pending"
  | "replan_required"
  | "human_decision_required"
  | "recovery_required"
  | "completed"
  | "cancelled";

export type ProjectQueueEntry = Readonly<{
  queueId: string;
  projectId: string;
  milestoneId: string;
  requestHash: string;
  originLane: "interactive" | "scheduled";
  repositoryRevision: string;
  scopeHash: string;
  state: ProjectQueueState;
  generation: number;
  ownerGeneration: string | null;
  resumeCondition: string | null;
  resultReference: string | null;
}>;

type StoreResult<T> = Readonly<
  | { status: "completed"; reason: string; value: T }
  | {
      status: "blocked";
      reason: string;
      value: null;
      manualRecoveryRequired: boolean;
      recoveryId: string | null;
    }
>;

type LeaseKind = "project-operation" | "canonical-adoption";
export type ProjectRuntimeLease = Readonly<{
  kind: LeaseKind;
  ownerGeneration: string;
  release: () => StoreResult<Readonly<{ released: true }>>;
}>;

type ActiveLease = Readonly<{
  repositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  kind: LeaseKind;
  ownerGeneration: string;
  lock: string;
  recoveryMarker: string;
  acquisitionMarker: string;
  lockOwnershipMarker: string;
  evidenceDirectory: string;
  identity: string;
}>;

const activeLeases = new WeakMap<ProjectRuntimeLease, ActiveLease>();

type Envelope = Readonly<{
  schema: typeof PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT;
  schemaRevision: 1;
  recordKind: "project-state" | "queue-entry" | "lease-evidence";
  repositoryBindingId: string;
  projectId: string;
  createdGeneration: number;
  updatedGeneration: number;
  contentHash: string;
  content: unknown;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const REVISION = /^[0-9a-f]{40,64}$/u;
const MAX_RECORD_BYTES = 16 * 1024 * 1024;
const PROJECT_QUEUE_STATES = new Set<ProjectQueueState>([
  "queued",
  "leased",
  "running",
  "waiting_foreground",
  "integration_pending",
  "replan_required",
  "human_decision_required",
  "recovery_required",
  "completed",
  "cancelled",
]);

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;
}

function exactKeys(value: object, keys: readonly string[]) {
  const actualValues = Object.keys(value).sort();
  const expectedValues = [...keys].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((key, index) => key === expectedValues[index])
  );
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function stringArray(
  value: unknown,
  maximum = 128,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (item) =>
        typeof item === "string" && item.length > 0 && item.length <= 512,
    )
  );
}

function nullableId(value: unknown) {
  return value === null || validId(value);
}

function nullableCandidateId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

function nullableRecoveryId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

function recoveryObligations(
  value: unknown,
): value is readonly ProjectTaskRecoveryObligation[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  const identities = new Set<string>();
  for (const entry of value) {
    const acknowledgementKeys = [
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "runtimeStateBinding",
      "receiptContentHash",
      "receiptContentIdentity",
    ];
    const acknowledgement = entry?.acknowledgement;
    const binding = plainObject(acknowledgement)
      ? acknowledgement.runtimeStateBinding
      : null;
    const isValidAcknowledgement =
      plainObject(acknowledgement) &&
      exactKeys(acknowledgement, acknowledgementKeys) &&
      [
        acknowledgement.repositoryBindingId,
        acknowledgement.projectId,
        acknowledgement.milestoneId,
        acknowledgement.taskId,
        acknowledgement.attemptId,
        acknowledgement.operationId,
      ].every(validId) &&
      nullableRecoveryId(acknowledgement.recoveryId) &&
      acknowledgement.recoveryId !== null &&
      Number.isSafeInteger(acknowledgement.settlementGeneration) &&
      Number(acknowledgement.settlementGeneration) > 0 &&
      plainObject(binding) &&
      exactKeys(binding, [
        "runtimeStateIdentityHash",
        "runtimeStateProtectionHash",
        "localUserBindingHash",
        "runtimeStateBindingHash",
      ]) &&
      Object.values(binding).every(
        (item) => typeof item === "string" && /^[a-f0-9]{64}$/u.test(item),
      ) &&
      typeof acknowledgement.receiptContentHash === "string" &&
      /^[a-f0-9]{64}$/u.test(acknowledgement.receiptContentHash) &&
      typeof acknowledgement.receiptContentIdentity === "string" &&
      acknowledgement.receiptContentIdentity.length > 0 &&
      acknowledgement.receiptContentIdentity.length <= 256;
    if (
      !plainObject(entry) ||
      !exactKeys(
        entry,
        entry.phase === "acknowledged"
          ? ["kind", "recoveryId", "phase", "acknowledgement"]
          : ["kind", "recoveryId", "phase"],
      ) ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "runtime_process",
      ].includes(String(entry.kind)) ||
      !nullableRecoveryId(entry.recoveryId) ||
      entry.recoveryId === null ||
      !["required", "recovering", "settled", "acknowledged"].includes(
        String(entry.phase),
      ) ||
      (entry.phase === "acknowledged" &&
        (entry.kind !== "docker" ||
          !isValidAcknowledgement ||
          acknowledgement.recoveryId !== entry.recoveryId))
    )
      return false;
    const identity = `${entry.kind}\0${entry.recoveryId}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
  }
  return true;
}

// Queue results may carry an exact opaque candidate or recovery reference.
// These references use the same closed character set as stable IDs, but can
// exceed the 128-character limit of ordinary project-local identifiers.
function validResultReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

function nullableResultReference(value: unknown) {
  return value === null || validResultReference(value);
}

function validTaskLifecycleTuple(task: ProjectRuntimeState["tasks"][number]) {
  const isAttempt = task.attemptId !== null;
  const isOperation = task.operationId !== null;
  const isAuthority = task.authorityBindingId !== null;
  if (["planned", "waiting_dependency", "ready"].includes(task.state))
    return (
      task.startPhase === "none" && !isAttempt && !isOperation && !isAuthority
    );
  if (task.state === "starting" && task.startPhase === "reserved")
    return isAttempt && !isOperation && isAuthority;
  if (task.state === "starting" && task.startPhase === "handoff_prepared")
    return isAttempt && isOperation && isAuthority;
  if (task.state === "running")
    return (
      task.startPhase === "running" && isAttempt && isOperation && isAuthority
    );
  if (
    [
      "cleanup_pending",
      "completed",
      "failed",
      "cancelled",
      "recovery_required",
      "superseded",
    ].includes(task.state)
  )
    return (
      task.startPhase === "settled" && isAttempt && isOperation && isAuthority
    );
  return false;
}

function validProjectRuntimeState(
  value: unknown,
): value is ProjectRuntimeState {
  if (
    !plainObject(value) ||
    !exactKeys(value, [
      "contract",
      "projectId",
      "milestoneId",
      "repositoryRevision",
      "generation",
      "ownerGeneration",
      "decisionApplicationId",
      "maximumConcurrency",
      "milestone",
      "objectives",
      "tasks",
    ]) ||
    value.contract !== "crdd-coordinator/project-runtime-state/v1" ||
    !validId(value.projectId) ||
    !validId(value.milestoneId) ||
    typeof value.repositoryRevision !== "string" ||
    !REVISION.test(value.repositoryRevision) ||
    !Number.isSafeInteger(value.generation) ||
    Number(value.generation) < 1 ||
    !validId(value.ownerGeneration) ||
    !nullableId(value.decisionApplicationId) ||
    !Number.isSafeInteger(value.maximumConcurrency) ||
    Number(value.maximumConcurrency) < 1 ||
    Number(value.maximumConcurrency) > 5 ||
    !plainObject(value.milestone) ||
    !exactKeys(value.milestone, [
      "id",
      "acceptanceCriteria",
      "state",
      "criterionEvidenceIds",
    ]) ||
    value.milestone.id !== value.milestoneId ||
    !stringArray(value.milestone.acceptanceCriteria) ||
    !stringArray(value.milestone.criterionEvidenceIds) ||
    !new Set([
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "cancelled",
    ]).has(String(value.milestone.state)) ||
    !Array.isArray(value.objectives) ||
    value.objectives.length < 1 ||
    value.objectives.length > 128 ||
    !Array.isArray(value.tasks) ||
    value.tasks.length < 1 ||
    value.tasks.length > 1024
  )
    return false;

  const objectiveIds = new Set<string>();
  for (const objective of value.objectives) {
    if (
      !plainObject(objective) ||
      !exactKeys(objective, ["definition", "state", "criterionEvidenceIds"]) ||
      !plainObject(objective.definition) ||
      !exactKeys(objective.definition, ["id", "acceptanceCriteria"]) ||
      !validId(objective.definition.id) ||
      objectiveIds.has(objective.definition.id) ||
      !stringArray(objective.definition.acceptanceCriteria) ||
      !stringArray(objective.criterionEvidenceIds) ||
      !new Set([
        "planned",
        "executing",
        "integration_pending",
        "accepted",
        "blocked",
        "cancelled",
      ]).has(String(objective.state))
    )
      return false;
    objectiveIds.add(objective.definition.id);
  }

  const taskIds = new Set<string>();
  const dependencies: Array<readonly string[]> = [];
  for (const task of value.tasks) {
    const definition = plainObject(task) ? task.definition : null;
    const taskDependencies = plainObject(definition)
      ? definition.dependencies
      : null;
    const allowedPaths = plainObject(definition)
      ? definition.allowedPaths
      : null;
    const conflictKeys = plainObject(definition)
      ? definition.conflictKeys
      : null;
    if (
      !plainObject(task) ||
      !exactKeys(task, [
        "definition",
        "state",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "startPhase",
        "cleanupConfirmed",
        "recoveryObligations",
        "recoveryUnresolved",
        "candidateId",
        "retryCount",
        "supersededBy",
      ]) ||
      !plainObject(task.definition) ||
      !exactKeys(task.definition, [
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ]) ||
      !validId(task.definition.id) ||
      taskIds.has(task.definition.id) ||
      !validId(task.definition.objectiveId) ||
      !objectiveIds.has(task.definition.objectiveId) ||
      !stringArray(taskDependencies) ||
      !stringArray(allowedPaths) ||
      allowedPaths.length < 1 ||
      !stringArray(conflictKeys) ||
      !new Set([
        "planned",
        "waiting_dependency",
        "ready",
        "starting",
        "running",
        "cleanup_pending",
        "completed",
        "failed",
        "cancelled",
        "recovery_required",
        "superseded",
      ]).has(String(task.state)) ||
      !nullableId(task.attemptId) ||
      !nullableId(task.operationId) ||
      !nullableId(task.authorityBindingId) ||
      !["none", "reserved", "handoff_prepared", "running", "settled"].includes(
        String(task.startPhase),
      ) ||
      typeof task.cleanupConfirmed !== "boolean" ||
      !recoveryObligations(task.recoveryObligations) ||
      typeof task.recoveryUnresolved !== "boolean" ||
      (task.state === "recovery_required" &&
        task.recoveryObligations.length === 0 &&
        task.recoveryUnresolved !== true) ||
      (task.state !== "recovery_required" &&
        task.recoveryUnresolved === true) ||
      (task.state === "ready" &&
        task.recoveryObligations.some(
          (entry) =>
            entry.phase !==
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        )) ||
      (!["ready", "recovery_required"].includes(String(task.state)) &&
        task.recoveryObligations.length > 0) ||
      !validTaskLifecycleTuple(
        task as unknown as ProjectRuntimeState["tasks"][number],
      ) ||
      !nullableCandidateId(task.candidateId) ||
      !Number.isSafeInteger(task.retryCount) ||
      Number(task.retryCount) < 0 ||
      !nullableId(task.supersededBy)
    )
      return false;
    taskIds.add(task.definition.id);
    dependencies.push(taskDependencies as readonly string[]);
  }
  return dependencies.every((items) => items.every((id) => taskIds.has(id)));
}

function validQueueEntry(value: unknown): value is ProjectQueueEntry {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "queueId",
      "projectId",
      "milestoneId",
      "requestHash",
      "originLane",
      "repositoryRevision",
      "scopeHash",
      "state",
      "generation",
      "ownerGeneration",
      "resumeCondition",
      "resultReference",
    ]) &&
    validId(value.queueId) &&
    validId(value.projectId) &&
    validId(value.milestoneId) &&
    typeof value.requestHash === "string" &&
    HASH.test(value.requestHash) &&
    (value.originLane === "interactive" || value.originLane === "scheduled") &&
    typeof value.repositoryRevision === "string" &&
    REVISION.test(value.repositoryRevision) &&
    typeof value.scopeHash === "string" &&
    HASH.test(value.scopeHash) &&
    PROJECT_QUEUE_STATES.has(value.state as ProjectQueueState) &&
    Number.isSafeInteger(value.generation) &&
    Number(value.generation) >= 1 &&
    nullableId(value.ownerGeneration) &&
    nullableId(value.resumeCondition) &&
    nullableResultReference(value.resultReference)
  );
}

function validLeaseEvidence(value: unknown) {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "disposition",
    ]) &&
    (value.kind === "project-operation" ||
      value.kind === "canonical-adoption") &&
    validId(value.queueId) &&
    validId(value.ownerGeneration) &&
    Number.isSafeInteger(value.ownerProcessId) &&
    Number(value.ownerProcessId) > 0 &&
    (value.disposition === "acquired" ||
      value.disposition === "released" ||
      value.disposition === "recovered_after_owner_loss")
  );
}

function completed<T>(reason: string, value: T): StoreResult<T> {
  return Object.freeze({ status: "completed", reason, value });
}

function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
): StoreResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}

type LeaseAcquisitionMarker = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

function leaseAcquisitionRecoveryId(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  const identityInput =
    kind === "project-operation"
      ? `${repositoryBindingId}\0${kind}`
      : kind === "canonical-adoption"
        ? `${repositoryBindingId}\0${projectId}\0${kind}`
        : `${repositoryBindingId}\0${projectId}\0${queueId}\0${kind}`;
  return `lease-acquisition-${digest(identityInput).slice(0, 40)}`;
}

function leaseIdentity(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  return kind === "project-operation"
    ? `${kind}-${repositoryBindingId}`
    : kind === "canonical-adoption"
      ? `${kind}-${repositoryBindingId}-${projectId}`
      : `${kind}-${projectId}-${queueId}`;
}

function leaseAcquisitionTemporaryPrefix(identity: string) {
  return `.pending-${identity}-acquisition-`;
}

function leaseAcquisitionTemporaryFiles(directory: string, identity: string) {
  assertDirectory(directory);
  const prefix = leaseAcquisitionTemporaryPrefix(identity);
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix));
  if (names.some((name) => !name.endsWith(".tmp")))
    throw new Error("project_runtime_lease_acquisition_inventory_invalid");
  return Object.freeze(names);
}

function pathConfirmedAbsent(candidate: string) {
  try {
    fs.lstatSync(candidate);
    return false;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    throw error;
  }
}

function leaseAcquisitionFootprintAbsent(
  directory: string,
  identity: string,
  paths: readonly string[],
) {
  return (
    paths.every(pathConfirmedAbsent) &&
    leaseAcquisitionTemporaryFiles(directory, identity).length === 0
  );
}

function readLeaseAcquisitionMarker(marker: string): LeaseAcquisitionMarker {
  const parsed: unknown = JSON.parse(fs.readFileSync(marker, "utf8"));
  if (
    !plainObject(parsed) ||
    !exactKeys(parsed, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "recoveryId",
    ]) ||
    (parsed.kind !== "project-operation" &&
      parsed.kind !== "canonical-adoption") ||
    !validId(parsed.queueId) ||
    !validId(parsed.ownerGeneration) ||
    !Number.isSafeInteger(parsed.ownerProcessId) ||
    Number(parsed.ownerProcessId) < 1 ||
    !validId(parsed.recoveryId)
  )
    throw new Error("project_runtime_lease_acquisition_marker_invalid");
  return Object.freeze({
    kind: parsed.kind,
    queueId: parsed.queueId,
    ownerGeneration: parsed.ownerGeneration,
    ownerProcessId: Number(parsed.ownerProcessId),
    recoveryId: parsed.recoveryId,
  });
}

function createLeaseAcquisitionMarker(
  directory: string,
  identity: string,
  value: LeaseAcquisitionMarker,
) {
  const marker = path.join(directory, `${identity}.acquire-pending`);
  const temporary = path.join(
    directory,
    `${leaseAcquisitionTemporaryPrefix(identity)}${process.pid}-${value.ownerGeneration}-${randomUUID()}.tmp`,
  );
  const bytes = `${JSON.stringify(value)}\n`;
  let descriptor: number | null = null;
  let isPublished = false;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    fs.writeFileSync(descriptor, bytes, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    if (fs.readFileSync(temporary, "utf8") !== bytes)
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
    const prepared = readLeaseAcquisitionMarker(temporary);
    if (
      prepared.kind !== value.kind ||
      prepared.queueId !== value.queueId ||
      prepared.ownerGeneration !== value.ownerGeneration ||
      prepared.ownerProcessId !== value.ownerProcessId ||
      prepared.recoveryId !== value.recoveryId
    )
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
    try {
      fs.linkSync(temporary, marker);
    } catch (error) {
      if (errorCode(error) === "EEXIST" || fs.existsSync(marker)) {
        const contention = new Error("project_runtime_lease_unavailable");
        Object.defineProperty(contention, "code", { value: "EEXIST" });
        throw contention;
      }
      throw error;
    }
    isPublished = true;
    if (fs.readFileSync(marker, "utf8") !== bytes)
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (!isPublished) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {}
    }
    throw error;
  }
  fs.rmSync(temporary);
  if (fs.existsSync(temporary))
    throw new Error(
      "project_runtime_lease_acquisition_temporary_release_unknown",
    );
  const observed = readLeaseAcquisitionMarker(marker);
  if (
    observed.kind !== value.kind ||
    observed.queueId !== value.queueId ||
    observed.ownerGeneration !== value.ownerGeneration ||
    observed.ownerProcessId !== value.ownerProcessId ||
    observed.recoveryId !== value.recoveryId
  )
    throw new Error("project_runtime_lease_acquisition_marker_mismatch");
}

function createLeaseLockOwnershipMarker(
  marker: string,
  value: LeaseAcquisitionMarker,
) {
  const descriptor = fs.openSync(
    marker,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
    0o600,
  );
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const observed = readLeaseAcquisitionMarker(marker);
  if (
    observed.kind !== value.kind ||
    observed.queueId !== value.queueId ||
    observed.ownerGeneration !== value.ownerGeneration ||
    observed.ownerProcessId !== value.ownerProcessId ||
    observed.recoveryId !== value.recoveryId
  )
    throw new Error("project_runtime_lease_lock_ownership_marker_mismatch");
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

function assertDirectory(directory: string) {
  const metadata = fs.lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(directory) !== directory
  ) {
    throw new Error("project_runtime_storage_boundary_invalid");
  }
}

function ensureDirectory(parent: string, name: string) {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(name) || name === "." || name === "..")
    throw new Error("project_runtime_storage_identity_invalid");
  const target = path.join(parent, name);
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
      )
    )
      throw error;
  }
  assertDirectory(target);
  if (path.dirname(target) !== parent)
    throw new Error("project_runtime_storage_boundary_invalid");
  return target;
}

function storageRoot(workingDirectory: string) {
  const repositoryRoot =
    resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  assertDirectory(repositoryRoot);
  const crdd = ensureDirectory(repositoryRoot, ".crdd");
  const runtime = ensureDirectory(crdd, "project-runtime");
  return Object.freeze({ repositoryRoot, runtime });
}

function activeLeaseIsObserved(activeLease: ActiveLease) {
  try {
    assertDirectory(activeLease.lock);
    return !fs.existsSync(activeLease.recoveryMarker);
  } catch {
    return false;
  }
}

function envelope(
  recordKind: Envelope["recordKind"],
  repositoryBindingId: string,
  projectId: string,
  createdGeneration: number,
  updatedGeneration: number,
  content: unknown,
): Envelope {
  if (
    (recordKind === "project-state" && !validProjectRuntimeState(content)) ||
    (recordKind === "queue-entry" && !validQueueEntry(content)) ||
    (recordKind === "lease-evidence" && !validLeaseEvidence(content))
  )
    throw new Error("project_runtime_record_content_invalid");
  const serialized = JSON.stringify(content);
  const record = Object.freeze({
    schema: PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT,
    schemaRevision: 1 as const,
    recordKind,
    repositoryBindingId,
    projectId,
    createdGeneration,
    updatedGeneration,
    contentHash: digest(serialized),
    content,
  });
  return record;
}

function storageBytes(value: Envelope) {
  const bytes = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(bytes, "utf8") > MAX_RECORD_BYTES)
    throw new Error("project_runtime_record_too_large");
  return bytes;
}

function atomicCreateAndReadBack(
  directory: string,
  name: string,
  value: Envelope,
) {
  const destination = path.join(directory, name);
  const temporary = path.join(directory, `.pending-${randomUUID()}.tmp`);
  const bytes = storageBytes(value);
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    fs.writeFileSync(descriptor, bytes, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, destination);
    const observed = fs.readFileSync(destination, "utf8");
    if (observed !== bytes)
      throw new Error("project_runtime_record_readback_mismatch");
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
    throw error;
  }
}

function readEnvelopeFile(directory: string, name: string): Envelope {
  const location = path.join(directory, name);
  const metadata = fs.lstatSync(location);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size > MAX_RECORD_BYTES
  )
    throw new Error("project_runtime_record_invalid");
  const candidate: unknown = JSON.parse(fs.readFileSync(location, "utf8"));
  if (
    !plainObject(candidate) ||
    !exactKeys(candidate, [
      "schema",
      "schemaRevision",
      "recordKind",
      "repositoryBindingId",
      "projectId",
      "createdGeneration",
      "updatedGeneration",
      "contentHash",
      "content",
    ]) ||
    !["project-state", "queue-entry", "lease-evidence"].includes(
      String(candidate.recordKind),
    )
  )
    throw new Error("project_runtime_record_envelope_invalid");
  const parsed = candidate as unknown as Envelope;
  if (
    parsed.schema !== PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT ||
    parsed.schemaRevision !== 1 ||
    !validId(parsed.repositoryBindingId) ||
    !validId(parsed.projectId) ||
    !Number.isSafeInteger(parsed.createdGeneration) ||
    !Number.isSafeInteger(parsed.updatedGeneration) ||
    parsed.createdGeneration < 1 ||
    parsed.updatedGeneration < parsed.createdGeneration ||
    parsed.contentHash !== digest(JSON.stringify(parsed.content))
  )
    throw new Error("project_runtime_record_invalid");
  if (
    (parsed.recordKind === "project-state" &&
      !validProjectRuntimeState(parsed.content)) ||
    (parsed.recordKind === "queue-entry" && !validQueueEntry(parsed.content)) ||
    (parsed.recordKind === "lease-evidence" &&
      !validLeaseEvidence(parsed.content))
  )
    throw new Error("project_runtime_record_content_invalid");
  if (
    (parsed.recordKind === "project-state" ||
      parsed.recordKind === "queue-entry") &&
    (parsed.content as { generation: number }).generation !==
      parsed.updatedGeneration
  )
    throw new Error("project_runtime_record_generation_mismatch");
  return parsed;
}

function readEnvelopes(directory: string, prefix: string): readonly Envelope[] {
  if (!fs.existsSync(directory)) return Object.freeze([]);
  assertDirectory(directory);
  const names = fs.readdirSync(directory);
  if (names.length > 4096)
    throw new Error("project_runtime_record_inventory_too_large");
  const generationName = /^generation-([1-9][0-9]*)\.json$/u;
  if (
    prefix === "generation-" &&
    names.some((name) => !generationName.test(name))
  )
    throw new Error("project_runtime_record_inventory_invalid");
  const records: Envelope[] = [];
  for (const name of names.filter((candidate) =>
    candidate.startsWith(prefix),
  )) {
    const parsed = readEnvelopeFile(directory, name);
    if (prefix === "generation-") {
      const match = generationName.exec(name);
      if (!match || Number(match[1]) !== parsed.updatedGeneration)
        throw new Error("project_runtime_record_generation_mismatch");
    }
    records.push(parsed);
  }
  if (prefix === "generation-") {
    const generations = records
      .map((record) => record.updatedGeneration)
      .sort((left, right) => left - right);
    if (
      new Set(generations).size !== generations.length ||
      generations.some((generation, index) => generation !== index + 1)
    )
      throw new Error("project_runtime_record_generation_discontinuous");
  }
  return Object.freeze(records);
}

type LeaseEvidenceContent = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  disposition: "acquired" | "released" | "recovered_after_owner_loss";
}>;

type LeaseEvidenceEnvelope = Envelope &
  Readonly<{ recordKind: "lease-evidence"; content: LeaseEvidenceContent }>;

function readExactLeaseEvidence(
  directory: string,
  expected: Readonly<{
    repositoryBindingId: string;
    projectId: string;
    queueId: string;
    kind: LeaseKind;
    identity: string;
    ownerGeneration: string;
  }>,
): Readonly<{
  acquired: LeaseEvidenceEnvelope;
  released: LeaseEvidenceEnvelope | null;
  recovered: LeaseEvidenceEnvelope | null;
}> {
  assertDirectory(directory);
  const base = `${expected.identity}-${expected.ownerGeneration}`;
  const exactNames: Readonly<
    Record<"acquired" | "released" | "recovered", string>
  > = Object.freeze({
    acquired: `${base}.json`,
    released: `${base}-released.json`,
    recovered: `${base}-recovered.json`,
  });
  const allowed = new Set(Object.values(exactNames));
  const inventoryEntries = fs.readdirSync(directory);
  if (
    inventoryEntries.length > 4096 ||
    inventoryEntries.some((name) => name.startsWith(base) && !allowed.has(name))
  )
    throw new Error("project_runtime_lease_evidence_inventory_mismatch");

  const read = (
    name: string,
    disposition: LeaseEvidenceContent["disposition"],
    isRequired: boolean,
  ): LeaseEvidenceEnvelope | null => {
    if (!fs.existsSync(path.join(directory, name))) {
      if (isRequired) throw new Error("project_runtime_lease_evidence_missing");
      return null;
    }
    const record = readEnvelopeFile(directory, name);
    if (
      record.recordKind !== "lease-evidence" ||
      record.repositoryBindingId !== expected.repositoryBindingId ||
      record.projectId !== expected.projectId ||
      record.createdGeneration !== 1 ||
      record.updatedGeneration !== (disposition === "acquired" ? 1 : 2) ||
      !validLeaseEvidence(record.content)
    )
      throw new Error("project_runtime_lease_evidence_mismatch");
    const content = record.content as LeaseEvidenceContent;
    if (
      content.kind !== expected.kind ||
      content.queueId !== expected.queueId ||
      content.ownerGeneration !== expected.ownerGeneration ||
      content.disposition !== disposition
    )
      throw new Error("project_runtime_lease_evidence_mismatch");
    return record as LeaseEvidenceEnvelope;
  };

  const acquired = read(exactNames.acquired, "acquired", true);
  if (!acquired) throw new Error("project_runtime_lease_evidence_missing");
  const released = read(exactNames.released, "released", false);
  const recovered = read(
    exactNames.recovered,
    "recovered_after_owner_loss",
    false,
  );
  if (released && recovered)
    throw new Error("project_runtime_lease_evidence_disposition_conflict");
  for (const record of [released, recovered]) {
    if (
      record &&
      record.content.ownerProcessId !== acquired.content.ownerProcessId
    )
      throw new Error("project_runtime_lease_evidence_owner_mismatch");
  }
  return Object.freeze({ acquired, released, recovered });
}

type QueueEnvelope = Envelope & Readonly<{ content: ProjectQueueEntry }>;

function validatedQueueHistory(
  records: readonly Envelope[],
  repositoryBindingId: string,
  queueId: string,
  expectedProjectId?: string,
): readonly QueueEnvelope[] | null {
  const orderedItems = [...records].sort(
    (left, right) => left.updatedGeneration - right.updatedGeneration,
  );
  let projectId = expectedProjectId ?? null;
  const resultItems: QueueEnvelope[] = [];
  for (const record of orderedItems) {
    const content = record.content;
    if (
      record.recordKind !== "queue-entry" ||
      record.repositoryBindingId !== repositoryBindingId ||
      !validQueueEntry(content) ||
      content.queueId !== queueId ||
      content.generation !== record.updatedGeneration ||
      record.projectId !== content.projectId ||
      (projectId !== null && content.projectId !== projectId)
    )
      return null;
    projectId = content.projectId;
    resultItems.push(record as QueueEnvelope);
  }
  return Object.freeze(resultItems);
}

function withMutationLock<T>(
  runtime: string,
  identity: string,
  operation: () => StoreResult<T>,
) {
  const locks = ensureDirectory(runtime, "locks");
  const lock = path.join(locks, `${identity}.lock`);
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    return errorCode(error) === "EEXIST"
      ? blocked<T>("project_runtime_lock_unavailable")
      : blocked<T>("project_runtime_mutation_observation_unknown", true);
  }
  let result: StoreResult<T>;
  try {
    assertDirectory(lock);
    result = operation();
  } catch {
    result = blocked<T>("project_runtime_mutation_observation_unknown", true);
  }
  try {
    fs.rmdirSync(lock);
    if (fs.existsSync(lock))
      return blocked<T>("project_runtime_mutation_lock_release_unknown", true);
  } catch {
    return blocked<T>("project_runtime_mutation_lock_release_unknown", true);
  }
  return result;
}

export function writeProjectRuntimeState(
  workingDirectory: string,
  repositoryBindingId: string,
  state: ProjectRuntimeState,
  expectedGeneration: number,
): StoreResult<ProjectRuntimeState> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validProjectRuntimeState(state) ||
      state.generation !== expectedGeneration + 1
    )
      return blocked("project_runtime_state_generation_mismatch");
    const { runtime } = storageRoot(workingDirectory);
    const states = ensureDirectory(runtime, "states");
    const project = ensureDirectory(states, state.projectId);
    return withMutationLock(runtime, `state-${state.projectId}`, () => {
      const existingItems = readEnvelopes(project, "generation-");
      const latest = existingItems.reduce(
        (maximum, item) => Math.max(maximum, item.updatedGeneration),
        0,
      );
      if (latest !== expectedGeneration)
        return blocked("project_runtime_state_generation_conflict");
      const record = envelope(
        "project-state",
        repositoryBindingId,
        state.projectId,
        1,
        state.generation,
        state,
      );
      atomicCreateAndReadBack(
        project,
        `generation-${state.generation}.json`,
        record,
      );
      return completed("project_runtime_state_durable", state);
    });
  } catch {
    return blocked("project_runtime_state_observation_unknown", true);
  }
}

export function readProjectRuntimeState(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
): StoreResult<ProjectRuntimeState | null> {
  try {
    if (!validId(repositoryBindingId) || !validId(projectId))
      return blocked("project_runtime_state_identity_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const project = path.join(runtime, "states", projectId);
    const records = readEnvelopes(project, "generation-");
    if (records.length === 0)
      return completed("project_runtime_state_absent", null);
    if (
      records.some(
        (record) =>
          record.recordKind !== "project-state" ||
          record.repositoryBindingId !== repositoryBindingId ||
          record.projectId !== projectId,
      )
    )
      return blocked("project_runtime_state_record_mismatch", true);
    const orderedRecords = [...records].sort(
      (left, right) => left.updatedGeneration - right.updatedGeneration,
    );
    const latest = orderedRecords.at(-1);
    if (!latest)
      return blocked("project_runtime_state_observation_unknown", true);
    const state = latest.content;
    if (
      !validProjectRuntimeState(state) ||
      state.projectId !== projectId ||
      state.generation !== latest.updatedGeneration
    )
      return blocked("project_runtime_state_record_mismatch", true);
    return completed("project_runtime_state_observed", state);
  } catch {
    return blocked("project_runtime_state_observation_unknown", true);
  }
}

export function enqueueProjectOperation(
  workingDirectory: string,
  repositoryBindingId: string,
  input: Omit<
    ProjectQueueEntry,
    | "state"
    | "generation"
    | "ownerGeneration"
    | "resumeCondition"
    | "resultReference"
  >,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(input.queueId) ||
      !validId(input.projectId) ||
      !validId(input.milestoneId) ||
      !HASH.test(input.requestHash) ||
      !HASH.test(input.scopeHash) ||
      !REVISION.test(input.repositoryRevision)
    )
      return blocked("project_runtime_queue_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const queue = ensureDirectory(runtime, "queue");
    const entryDirectory = ensureDirectory(queue, input.queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const observedItems = readEnvelopes(entryDirectory, "generation-");
      const existingItems = validatedQueueHistory(
        observedItems,
        repositoryBindingId,
        input.queueId,
        input.projectId,
      );
      if (existingItems === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      if (existingItems.length > 0) {
        const currentEnvelope = existingItems.at(-1);
        if (!currentEnvelope)
          return blocked("project_runtime_queue_observation_unknown", true);
        const current = currentEnvelope.content;
        if (
          currentEnvelope.recordKind !== "queue-entry" ||
          !validQueueEntry(current) ||
          current.generation !== currentEnvelope.updatedGeneration ||
          current.queueId !== input.queueId ||
          currentEnvelope.repositoryBindingId !== repositoryBindingId ||
          currentEnvelope.projectId !== input.projectId
        )
          return blocked("project_runtime_queue_record_mismatch", true);
        return current.requestHash === input.requestHash &&
          current.projectId === input.projectId &&
          current.milestoneId === input.milestoneId
          ? completed("project_runtime_queue_request_reused", current)
          : blocked("project_runtime_queue_identity_conflict");
      }
      const value: ProjectQueueEntry = Object.freeze({
        ...input,
        state: "queued",
        generation: 1,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        "generation-1.json",
        envelope(
          "queue-entry",
          repositoryBindingId,
          input.projectId,
          1,
          1,
          value,
        ),
      );
      return completed("project_runtime_queue_entry_durable", value);
    });
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

export function readProjectOperationQueueState(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (!validId(repositoryBindingId) || !validId(queueId))
      return blocked("project_runtime_queue_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queue", queueId);
    const existingItems = validatedQueueHistory(
      readEnvelopes(entryDirectory, "generation-"),
      repositoryBindingId,
      queueId,
    );
    if (existingItems === null)
      return blocked("project_runtime_queue_record_mismatch", true);
    const currentEnvelope = existingItems.at(-1);
    if (!currentEnvelope)
      return blocked("project_runtime_queue_observation_unknown", true);
    const current = currentEnvelope.content;
    if (
      currentEnvelope.recordKind !== "queue-entry" ||
      !validQueueEntry(current) ||
      current.generation !== currentEnvelope.updatedGeneration ||
      current.queueId !== queueId ||
      currentEnvelope.repositoryBindingId !== repositoryBindingId ||
      currentEnvelope.projectId !== current.projectId
    )
      return blocked("project_runtime_queue_record_mismatch", true);
    return completed("project_runtime_queue_observed", current);
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/** Select the next unowned operation without preempting active work. */
export function selectNextProjectOperation(
  workingDirectory: string,
  repositoryBindingId: string,
): StoreResult<ProjectQueueEntry | null> {
  try {
    if (!validId(repositoryBindingId))
      return blocked("project_runtime_queue_selection_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const queueRoot = path.join(runtime, "queue");
    if (!fs.existsSync(queueRoot))
      return completed("project_runtime_queue_empty", null);
    assertDirectory(queueRoot);
    const names = fs.readdirSync(queueRoot).sort();
    if (names.length > 4096 || names.some((name) => !validId(name)))
      return blocked("project_runtime_queue_inventory_invalid", true);
    const entries: ProjectQueueEntry[] = [];
    for (const name of names) {
      const entryDirectory = path.join(queueRoot, name);
      assertDirectory(entryDirectory);
      const records = readEnvelopes(entryDirectory, "generation-");
      const observedBinding = records[0]?.repositoryBindingId;
      if (
        !observedBinding ||
        validatedQueueHistory(records, observedBinding, name) === null
      )
        return blocked("project_runtime_queue_record_mismatch", true);
      // A Project binding owns only its own queue. Another valid binding is
      // isolated rather than reinterpreted as corruption of the caller's
      // queue population.
      if (observedBinding !== repositoryBindingId) continue;
      const observed = readProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        name,
      );
      if (observed.status !== "completed")
        return blocked(observed.reason, observed.manualRecoveryRequired);
      entries.push(observed.value);
    }
    // Queue priority applies only between operations that are not yet owned.
    // Once any operation is leased or running, selecting a second queue would
    // violate the Project concurrency boundary before task scheduling can
    // reject it.  Keep later arrivals effect-free until the active owner has
    // reached a terminal/recoverable state and released its lease.
    const active = entries.find((entry) => entry.ownerGeneration !== null);
    if (active) {
      for (const scheduled of entries.filter(
        (entry) =>
          entry.originLane === "scheduled" &&
          entry.state === "queued" &&
          entry.ownerGeneration === null,
      )) {
        const parked = updateProjectOperationQueueState(
          workingDirectory,
          repositoryBindingId,
          scheduled.queueId,
          scheduled.generation,
          {
            state: "waiting_foreground",
            lease: null,
            resumeCondition: "active_operation_pending",
            resultReference: null,
          },
        );
        if (parked.status !== "completed")
          return blocked(parked.reason, parked.manualRecoveryRequired);
      }
      return completed("project_runtime_active_operation_retained", null);
    }
    const interactive = entries.find(
      (entry) =>
        entry.originLane === "interactive" &&
        entry.state === "queued" &&
        entry.ownerGeneration === null,
    );
    if (interactive) {
      for (const scheduled of entries.filter(
        (entry) =>
          entry.originLane === "scheduled" &&
          entry.state === "queued" &&
          entry.ownerGeneration === null,
      )) {
        const parked = updateProjectOperationQueueState(
          workingDirectory,
          repositoryBindingId,
          scheduled.queueId,
          scheduled.generation,
          {
            state: "waiting_foreground",
            lease: null,
            resumeCondition: "interactive_queue_pending",
            resultReference: null,
          },
        );
        if (parked.status !== "completed")
          return blocked(parked.reason, parked.manualRecoveryRequired);
      }
      return completed(
        "project_runtime_interactive_queue_selected",
        interactive,
      );
    }
    const waiting = entries.find(
      (entry) =>
        entry.originLane === "scheduled" &&
        entry.state === "waiting_foreground" &&
        entry.ownerGeneration === null,
    );
    if (waiting) {
      const woken = updateProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        waiting.queueId,
        waiting.generation,
        {
          state: "queued",
          lease: null,
          resumeCondition: null,
          resultReference: null,
        },
      );
      return woken.status === "completed"
        ? completed("project_runtime_scheduled_queue_selected", woken.value)
        : blocked(woken.reason, woken.manualRecoveryRequired);
    }
    const scheduled = entries.find(
      (entry) =>
        entry.originLane === "scheduled" &&
        entry.state === "queued" &&
        entry.ownerGeneration === null,
    );
    return completed(
      scheduled
        ? "project_runtime_scheduled_queue_selected"
        : "project_runtime_queue_empty",
      scheduled ?? null,
    );
  } catch {
    return blocked("project_runtime_queue_selection_observation_unknown", true);
  }
}

const QUEUE_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["leased", "waiting_foreground", "cancelled"]),
  leased: Object.freeze([
    "running",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  running: Object.freeze([
    "integration_pending",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  waiting_foreground: Object.freeze(["queued", "cancelled"]),
  integration_pending: Object.freeze([
    "completed",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  replan_required: Object.freeze([
    "queued",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  human_decision_required: Object.freeze([
    "replan_required",
    "recovery_required",
    "cancelled",
  ]),
  recovery_required: Object.freeze([
    "queued",
    "recovery_required",
    "cancelled",
  ]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
} satisfies Record<ProjectQueueState, readonly ProjectQueueState[]>);

export function updateProjectOperationQueueState(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  next: Readonly<{
    state: ProjectQueueState;
    lease: ProjectRuntimeLease | null;
    resumeCondition: string | null;
    resultReference: string | null;
  }>,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1
    )
      return blocked("project_runtime_queue_update_invalid");
    if (next.resumeCondition !== null && !validId(next.resumeCondition))
      return blocked("project_runtime_queue_resume_condition_invalid");
    if (
      next.resultReference !== null &&
      !validResultReference(next.resultReference)
    )
      return blocked("project_runtime_queue_result_reference_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queue", queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const existingItems = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      if (existingItems === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      const currentEnvelope = existingItems.at(-1);
      if (
        !currentEnvelope ||
        currentEnvelope.updatedGeneration !== expectedGeneration
      )
        return blocked("project_runtime_queue_generation_conflict");
      const current = currentEnvelope.content;
      if (
        !validQueueEntry(current) ||
        current.generation !== currentEnvelope.updatedGeneration ||
        current.queueId !== queueId ||
        currentEnvelope.projectId !== current.projectId
      )
        return blocked("project_runtime_queue_record_mismatch", true);
      const allowedTransitions: readonly ProjectQueueState[] =
        QUEUE_TRANSITIONS[current.state] ?? [];
      if (!allowedTransitions.includes(next.state))
        return blocked("project_runtime_queue_transition_invalid");
      if (
        current.state === "recovery_required" &&
        next.state === "recovery_required" &&
        !(
          current.ownerGeneration === null &&
          current.resumeCondition === "owner_loss" &&
          next.lease === null &&
          next.resumeCondition === "exact_recovery" &&
          next.resultReference !== null
        )
      )
        return blocked("project_runtime_queue_recovery_binding_invalid");
      if (
        current.state === "recovery_required" &&
        next.state === "queued" &&
        !(
          current.ownerGeneration === null &&
          current.resumeCondition === "owner_loss" &&
          current.resultReference !== null &&
          next.lease === null &&
          next.resumeCondition === null &&
          next.resultReference === null
        )
      )
        return blocked("project_runtime_queue_owner_loss_reset_invalid");
      const activeLease = next.lease ? activeLeases.get(next.lease) : undefined;
      const nextLeaseRequired = ["leased", "running"].includes(next.state);
      const leaseRequired =
        current.ownerGeneration !== null || nextLeaseRequired;
      if (!leaseRequired && next.lease !== null)
        return blocked("project_runtime_queue_lease_invalid");
      if (leaseRequired) {
        if (
          activeLease?.kind !== "project-operation" ||
          activeLease.repositoryRoot !== repositoryRoot ||
          activeLease.repositoryBindingId !== repositoryBindingId ||
          activeLease.projectId !== current.projectId ||
          activeLease.queueId !== queueId ||
          !activeLeaseIsObserved(activeLease)
        )
          return blocked("project_runtime_queue_lease_invalid");
        if (
          current.ownerGeneration !== null &&
          current.ownerGeneration !== activeLease.ownerGeneration
        )
          return blocked("project_runtime_queue_owner_mismatch");
      }
      // A terminal Queue record is first a durable terminal intent. Its owner
      // remains attached until the physical lock and release evidence have been
      // observed by settleProjectOperationQueueLeaseRelease().
      const ownerGeneration = leaseRequired
        ? (activeLease?.ownerGeneration ?? null)
        : null;
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: next.state,
        ownerGeneration,
        resumeCondition: next.resumeCondition,
        resultReference: next.resultReference,
        generation: current.generation + 1,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_state_durable", value);
    });
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/**
 * Resume a Queue only after its exact Runtime-owned recovery reference has
 * been settled. The generic Queue transition API deliberately cannot perform
 * this transition.
 */
export function settleProjectOperationQueueRecovery(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  recoveryId: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1 ||
      !validResultReference(recoveryId)
    )
      return blocked("project_runtime_queue_recovery_settlement_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queue", queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      if (
        !currentEnvelope ||
        currentEnvelope.updatedGeneration !== expectedGeneration ||
        !validQueueEntry(currentEnvelope.content)
      )
        return blocked("project_runtime_queue_recovery_generation_conflict");
      const current = currentEnvelope.content;
      if (
        current.state !== "recovery_required" ||
        current.ownerGeneration !== null ||
        current.resumeCondition !== "exact_recovery" ||
        current.resultReference !== recoveryId
      )
        return blocked("project_runtime_queue_recovery_identity_mismatch");
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: "queued" as const,
        generation: current.generation + 1,
        ownerGeneration: null,
        resumeCondition: "exact_recovery_settled",
        resultReference: recoveryId,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_recovery_settled", value);
    });
  } catch {
    return blocked("project_runtime_queue_recovery_settlement_unknown", true);
  }
}

export function acquireProjectRuntimeLease(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): StoreResult<ProjectRuntimeLease> {
  let acquisitionMarker: string | null = null;
  let isAcquisitionMarkerOwned = false;
  let lockOwnershipMarker: string | null = null;
  let isLockOwnershipMarkerOwned = false;
  let lock: string | null = null;
  let isLockOwned = false;
  let acquiredEvidence: string | null = null;
  let recoveryId: string | null = null;
  try {
    if (![repositoryBindingId, projectId, queueId].every(validId))
      return blocked("project_runtime_lease_identity_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const locks = ensureDirectory(runtime, "locks");
    const identity = leaseIdentity(
      repositoryBindingId,
      projectId,
      queueId,
      kind,
    );
    lock = path.join(locks, `${identity}.lock`);
    const recoveryMarker = path.join(locks, `${identity}.release-unknown`);
    acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
    lockOwnershipMarker = path.join(locks, `${identity}.acquire-lock-owned`);
    recoveryId = leaseAcquisitionRecoveryId(
      repositoryBindingId,
      projectId,
      queueId,
      kind,
    );
    if (fs.existsSync(recoveryMarker))
      return blocked(
        "project_runtime_lease_recovery_required",
        true,
        recoveryId,
      );
    if (leaseAcquisitionTemporaryFiles(locks, identity).length > 0)
      return blocked("project_runtime_lease_unavailable");
    if (fs.existsSync(acquisitionMarker))
      return blocked("project_runtime_lease_unavailable");
    if (fs.existsSync(lockOwnershipMarker))
      return blocked("project_runtime_lease_unavailable");
    const ownerGeneration = randomUUID();
    const evidence = ensureDirectory(runtime, "leases");
    try {
      createLeaseAcquisitionMarker(
        locks,
        identity,
        Object.freeze({
          kind,
          queueId,
          ownerGeneration,
          ownerProcessId: process.pid,
          recoveryId,
        }),
      );
      isAcquisitionMarkerOwned = true;
      fs.mkdirSync(lock, { mode: 0o700 });
      isLockOwned = true;
      createLeaseLockOwnershipMarker(
        lockOwnershipMarker,
        Object.freeze({
          kind,
          queueId,
          ownerGeneration,
          ownerProcessId: process.pid,
          recoveryId,
        }),
      );
      isLockOwnershipMarkerOwned = true;
    } catch (error) {
      if (!isAcquisitionMarkerOwned) {
        if (errorCode(error) === "EEXIST")
          return blocked("project_runtime_lease_unavailable");
        try {
          if (fs.existsSync(acquisitionMarker)) {
            const competing = readLeaseAcquisitionMarker(acquisitionMarker);
            if (
              competing.kind === kind &&
              competing.recoveryId === recoveryId &&
              (competing.ownerProcessId !== process.pid ||
                (kind === "project-operation" && competing.queueId !== queueId))
            )
              return blocked("project_runtime_lease_unavailable");
            if (competing.ownerProcessId === process.pid)
              return blocked(
                "project_runtime_lease_acquisition_recovery_required",
                true,
                recoveryId,
              );
          }
          if (
            leaseAcquisitionFootprintAbsent(locks, identity, [
              lock,
              recoveryMarker,
              acquisitionMarker,
              lockOwnershipMarker,
            ])
          )
            return blocked("project_runtime_lease_acquisition_rolled_back");
        } catch {}
        return blocked(
          "project_runtime_lease_acquisition_recovery_required",
          true,
          recoveryId,
        );
      }
      throw error;
    }
    assertDirectory(lock);
    acquiredEvidence = path.join(
      evidence,
      `${identity}-${ownerGeneration}.json`,
    );
    atomicCreateAndReadBack(
      evidence,
      `${identity}-${ownerGeneration}.json`,
      envelope("lease-evidence", repositoryBindingId, projectId, 1, 1, {
        kind,
        queueId,
        ownerGeneration,
        ownerProcessId: process.pid,
        disposition: "acquired",
      }),
    );
    const acquiredLock = lock;
    const ownedAcquisitionMarker = acquisitionMarker;
    const ownedLockOwnershipMarker = lockOwnershipMarker;
    const exactRecoveryId = recoveryId;
    let released = false;
    let lease!: ProjectRuntimeLease;
    lease = Object.freeze({
      kind,
      ownerGeneration,
      release: () => {
        if (released)
          return blocked<Readonly<{ released: true }>>(
            "project_runtime_lease_already_released",
          );
        try {
          const markerDescriptor = fs.openSync(
            recoveryMarker,
            fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
            0o600,
          );
          try {
            fs.writeFileSync(markerDescriptor, `${ownerGeneration}\n`, "utf8");
            fs.fsyncSync(markerDescriptor);
          } finally {
            fs.closeSync(markerDescriptor);
          }
          if (
            fs.readFileSync(recoveryMarker, "utf8") !== `${ownerGeneration}\n`
          )
            throw new Error("project_runtime_lease_recovery_marker_mismatch");
          assertDirectory(acquiredLock);
          fs.rmdirSync(acquiredLock);
          if (fs.existsSync(acquiredLock))
            throw new Error("project_runtime_lease_lock_release_unknown");
          atomicCreateAndReadBack(
            evidence,
            `${identity}-${ownerGeneration}-released.json`,
            envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
              kind,
              queueId,
              ownerGeneration,
              ownerProcessId: process.pid,
              disposition: "released",
            }),
          );
          fs.rmSync(recoveryMarker);
          if (fs.existsSync(recoveryMarker))
            throw new Error(
              "project_runtime_lease_recovery_marker_release_unknown",
            );
          if (fs.existsSync(ownedLockOwnershipMarker)) {
            const ownership = readLeaseAcquisitionMarker(
              ownedLockOwnershipMarker,
            );
            if (
              ownership.kind !== kind ||
              ownership.queueId !== queueId ||
              ownership.ownerGeneration !== ownerGeneration ||
              ownership.ownerProcessId !== process.pid ||
              ownership.recoveryId !== exactRecoveryId
            )
              throw new Error(
                "project_runtime_lease_lock_ownership_marker_mismatch",
              );
            fs.rmSync(ownedLockOwnershipMarker);
          }
          if (fs.existsSync(ownedLockOwnershipMarker))
            throw new Error(
              "project_runtime_lease_lock_ownership_marker_release_unknown",
            );
          if (fs.existsSync(ownedAcquisitionMarker)) {
            const pending = readLeaseAcquisitionMarker(ownedAcquisitionMarker);
            if (
              pending.kind !== kind ||
              pending.queueId !== queueId ||
              pending.ownerGeneration !== ownerGeneration ||
              pending.ownerProcessId !== process.pid ||
              pending.recoveryId !== exactRecoveryId
            )
              throw new Error(
                "project_runtime_lease_acquisition_marker_mismatch",
              );
            fs.rmSync(ownedAcquisitionMarker);
          }
          if (fs.existsSync(ownedAcquisitionMarker))
            throw new Error(
              "project_runtime_lease_acquisition_marker_release_unknown",
            );
          released = true;
          activeLeases.delete(lease);
          return completed<Readonly<{ released: true }>>(
            "project_runtime_lease_released",
            Object.freeze({ released: true as const }),
          );
        } catch {
          activeLeases.delete(lease);
          return blocked<Readonly<{ released: true }>>(
            "project_runtime_lease_release_unknown",
            true,
          );
        }
      },
    });
    activeLeases.set(
      lease,
      Object.freeze({
        repositoryRoot,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
        ownerGeneration,
        lock: acquiredLock,
        recoveryMarker,
        acquisitionMarker: ownedAcquisitionMarker,
        lockOwnershipMarker: ownedLockOwnershipMarker,
        evidenceDirectory: evidence,
        identity,
      }),
    );
    return completed("project_runtime_lease_acquired", lease);
  } catch {
    let cleanupConfirmed = true;
    try {
      if (isLockOwned && lock !== null && fs.existsSync(lock))
        fs.rmdirSync(lock);
      if (lock !== null && fs.existsSync(lock)) cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        acquiredEvidence !== null &&
        fs.existsSync(acquiredEvidence)
      )
        fs.rmSync(acquiredEvidence);
      if (acquiredEvidence !== null && fs.existsSync(acquiredEvidence))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        isLockOwnershipMarkerOwned &&
        lockOwnershipMarker !== null &&
        fs.existsSync(lockOwnershipMarker)
      )
        fs.rmSync(lockOwnershipMarker);
      if (lockOwnershipMarker !== null && fs.existsSync(lockOwnershipMarker))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        isAcquisitionMarkerOwned &&
        acquisitionMarker !== null &&
        fs.existsSync(acquisitionMarker)
      )
        fs.rmSync(acquisitionMarker);
      if (acquisitionMarker !== null && fs.existsSync(acquisitionMarker))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        lock !== null &&
        leaseAcquisitionTemporaryFiles(
          path.dirname(lock),
          path.basename(lock, ".lock"),
        ).length > 0
      )
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    return cleanupConfirmed
      ? blocked("project_runtime_lease_acquisition_rolled_back")
      : blocked(
          "project_runtime_lease_acquisition_recovery_required",
          true,
          recoveryId,
        );
  }
}

export type ProjectRuntimeLeaseAcquisitionResolution = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

export function inspectProjectRuntimeLeaseAcquisitionOwner(
  workingDirectory: string,
  repositoryBindingId: string,
): StoreResult<
  Readonly<{ acquisition: ProjectRuntimeLeaseAcquisitionResolution | null }>
> {
  const recoveryId = validId(repositoryBindingId)
    ? leaseAcquisitionRecoveryId(
        repositoryBindingId,
        "inspection",
        "inspection",
        "project-operation",
      )
    : null;
  try {
    if (!validId(repositoryBindingId))
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const locks = ensureDirectory(runtime, "locks");
    const identity = leaseIdentity(
      repositoryBindingId,
      "inspection",
      "inspection",
      "project-operation",
    );
    const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
    const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
    const associatedPaths = Object.freeze([
      path.join(locks, `${identity}.lock`),
      path.join(locks, `${identity}.release-unknown`),
      acquisitionMarker,
      path.join(locks, `${identity}.acquire-lock-owned`),
    ]);
    if (leaseAcquisitionFootprintAbsent(locks, identity, associatedPaths))
      return completed(
        "project_runtime_lease_acquisition_resources_absent",
        Object.freeze({ acquisition: null }),
      );
    if (temporaryFiles.length > 1)
      return blocked(
        "project_runtime_lease_acquisition_recovery_cleanup_unknown",
        true,
        recoveryId,
      );
    const candidates = [
      ...(fs.existsSync(acquisitionMarker) ? [acquisitionMarker] : []),
      ...temporaryFiles.map((name) => path.join(locks, name)),
    ];
    if (candidates.length === 0)
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    let markers: readonly LeaseAcquisitionMarker[];
    try {
      markers = Object.freeze(candidates.map(readLeaseAcquisitionMarker));
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    }
    const first = markers[0];
    if (
      first?.kind !== "project-operation" ||
      markers.some(
        (marker) =>
          marker.kind !== first.kind ||
          marker.queueId !== first.queueId ||
          marker.ownerGeneration !== first.ownerGeneration ||
          marker.ownerProcessId !== first.ownerProcessId ||
          marker.recoveryId !== first.recoveryId,
      ) ||
      first.recoveryId !== recoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    const queueDirectory = path.join(runtime, "queue", first.queueId);
    let historyEntries: readonly QueueEnvelope[] | null;
    try {
      historyEntries = validatedQueueHistory(
        readEnvelopes(queueDirectory, "generation-"),
        repositoryBindingId,
        first.queueId,
      );
    } catch {
      historyEntries = null;
    }
    const queue = historyEntries?.at(-1)?.content;
    if (
      !queue ||
      (queue.ownerGeneration === null && queue.state !== "queued") ||
      (queue.ownerGeneration !== null &&
        queue.ownerGeneration !== first.ownerGeneration)
    )
      return blocked(
        "project_runtime_lease_acquisition_queue_identity_mismatch",
        true,
        recoveryId,
      );
    return completed(
      "project_runtime_lease_acquisition_owner_observed",
      Object.freeze({
        acquisition: Object.freeze({
          repositoryBindingId,
          projectId: queue.projectId,
          queueId: queue.queueId,
          ownerGeneration: first.ownerGeneration,
          ownerProcessId: first.ownerProcessId,
          recoveryId: first.recoveryId,
        }),
      }),
    );
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

export function settleProjectOperationQueueLeaseRelease(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  ownerGeneration: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !validId(ownerGeneration) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1
    )
      return blocked("project_runtime_queue_release_settlement_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock(runtime, "queue-mutation", () => {
      const entryDirectory = path.join(runtime, "queue", queueId);
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      const current = currentEnvelope?.content;
      if (
        !currentEnvelope ||
        !current ||
        current.generation !== expectedGeneration ||
        current.ownerGeneration !== ownerGeneration ||
        current.state === "leased" ||
        current.state === "running"
      )
        return blocked(
          "project_runtime_queue_release_settlement_state_mismatch",
          true,
        );
      const identity = leaseIdentity(
        repositoryBindingId,
        current.projectId,
        queueId,
        "project-operation",
      );
      const locks = ensureDirectory(runtime, "locks");
      if (
        fs.existsSync(path.join(locks, `${identity}.lock`)) ||
        fs.existsSync(path.join(locks, `${identity}.release-unknown`)) ||
        fs.existsSync(path.join(locks, `${identity}.acquire-pending`)) ||
        fs.existsSync(path.join(locks, `${identity}.acquire-lock-owned`))
      )
        return blocked(
          "project_runtime_queue_release_settlement_resource_present",
          true,
        );
      const evidence = ensureDirectory(runtime, "leases");
      const leaseEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId: current.projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration,
      });
      if (!leaseEvidence.released || leaseEvidence.recovered)
        return blocked("project_runtime_queue_release_evidence_mismatch", true);
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        generation: current.generation + 1,
        ownerGeneration: null,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_release_settled", value);
    });
  } catch {
    return blocked(
      "project_runtime_queue_release_settlement_observation_unknown",
      true,
    );
  }
}

type LeaseOwnerObserver = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

function reconcileUnboundLeaseAcquisition(
  runtime: string,
  repositoryBindingId: string,
  projectId: string,
  requestedQueueId: string,
  kind: LeaseKind,
  observeOwner: LeaseOwnerObserver,
  shouldRetainAcquisitionMarkerForCaller = false,
): StoreResult<Readonly<{ recoveryId: string }>> {
  const identity = leaseIdentity(
    repositoryBindingId,
    projectId,
    requestedQueueId,
    kind,
  );
  const expectedRecoveryId = leaseAcquisitionRecoveryId(
    repositoryBindingId,
    projectId,
    requestedQueueId,
    kind,
  );
  const locks = ensureDirectory(runtime, "locks");
  const lock = path.join(locks, `${identity}.lock`);
  const releaseMarker = path.join(locks, `${identity}.release-unknown`);
  const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
  const lockOwnershipMarker = path.join(
    locks,
    `${identity}.acquire-lock-owned`,
  );
  const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
  if (temporaryFiles.length > 1)
    return blocked(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
      true,
      expectedRecoveryId,
    );
  const temporaryMarker =
    temporaryFiles.length === 1
      ? path.join(locks, temporaryFiles[0] as string)
      : null;
  if (temporaryMarker !== null) {
    let prepared: LeaseAcquisitionMarker;
    try {
      prepared = readLeaseAcquisitionMarker(temporaryMarker);
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    }
    if (
      prepared.kind !== kind ||
      (kind === "project-operation" && prepared.queueId !== requestedQueueId) ||
      prepared.recoveryId !== expectedRecoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    if (fs.existsSync(acquisitionMarker)) {
      if (
        fs.readFileSync(acquisitionMarker, "utf8") !==
        fs.readFileSync(temporaryMarker, "utf8")
      )
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
          expectedRecoveryId,
        );
    } else {
      let rawPreparedOwnerObservation: unknown;
      try {
        rawPreparedOwnerObservation = observeOwner(
          Object.freeze({
            ownerProcessId: prepared.ownerProcessId,
            ownerGeneration: prepared.ownerGeneration,
          }),
        );
      } catch {
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      }
      if (
        !plainObject(rawPreparedOwnerObservation) ||
        !exactKeys(rawPreparedOwnerObservation, [
          "status",
          "ownerProcessId",
          "ownerGeneration",
        ]) ||
        rawPreparedOwnerObservation.ownerProcessId !==
          prepared.ownerProcessId ||
        rawPreparedOwnerObservation.ownerGeneration !== prepared.ownerGeneration
      )
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      if (rawPreparedOwnerObservation.status === "alive")
        return blocked("project_runtime_lease_owner_still_active");
      if (rawPreparedOwnerObservation.status !== "absent")
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      try {
        fs.linkSync(temporaryMarker, acquisitionMarker);
      } catch (error) {
        if (errorCode(error) !== "EEXIST")
          return blocked(
            "project_runtime_lease_acquisition_recovery_cleanup_unknown",
            true,
            expectedRecoveryId,
          );
      }
      if (
        !fs.existsSync(acquisitionMarker) ||
        fs.readFileSync(acquisitionMarker, "utf8") !==
          fs.readFileSync(temporaryMarker, "utf8")
      )
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
          expectedRecoveryId,
        );
    }
  }
  if (!fs.existsSync(acquisitionMarker))
    return blocked(
      "project_runtime_lease_acquisition_recovery_state_mismatch",
      true,
      expectedRecoveryId,
    );
  let pending: LeaseAcquisitionMarker;
  try {
    pending = readLeaseAcquisitionMarker(acquisitionMarker);
  } catch {
    return blocked(
      "project_runtime_lease_acquisition_recovery_evidence_mismatch",
      true,
      expectedRecoveryId,
    );
  }
  const evidenceQueueId = pending.queueId;
  if (
    pending.kind !== kind ||
    (kind === "project-operation" && evidenceQueueId !== requestedQueueId) ||
    pending.recoveryId !== expectedRecoveryId
  )
    return blocked(
      "project_runtime_lease_acquisition_recovery_evidence_mismatch",
      true,
      expectedRecoveryId,
    );
  if (fs.existsSync(lockOwnershipMarker)) {
    let ownership: LeaseAcquisitionMarker;
    try {
      ownership = readLeaseAcquisitionMarker(lockOwnershipMarker);
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    }
    if (
      ownership.kind !== pending.kind ||
      ownership.queueId !== pending.queueId ||
      ownership.ownerGeneration !== pending.ownerGeneration ||
      ownership.ownerProcessId !== pending.ownerProcessId ||
      ownership.recoveryId !== pending.recoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else if (fs.existsSync(lock)) {
    return blocked(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
      true,
      expectedRecoveryId,
    );
  }
  let rawObservation: unknown;
  try {
    rawObservation = observeOwner(
      Object.freeze({
        ownerProcessId: pending.ownerProcessId,
        ownerGeneration: pending.ownerGeneration,
      }),
    );
  } catch {
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );
  }
  if (
    !plainObject(rawObservation) ||
    !exactKeys(rawObservation, [
      "status",
      "ownerProcessId",
      "ownerGeneration",
    ]) ||
    rawObservation.ownerProcessId !== pending.ownerProcessId ||
    rawObservation.ownerGeneration !== pending.ownerGeneration
  )
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );
  if (rawObservation.status === "alive")
    return blocked("project_runtime_lease_owner_still_active");
  if (rawObservation.status !== "absent")
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );

  if (fs.existsSync(releaseMarker)) {
    if (
      fs.readFileSync(releaseMarker, "utf8") !== `${pending.ownerGeneration}\n`
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else {
    const descriptor = fs.openSync(
      releaseMarker,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    try {
      fs.writeFileSync(descriptor, `${pending.ownerGeneration}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    if (
      fs.readFileSync(releaseMarker, "utf8") !== `${pending.ownerGeneration}\n`
    )
      throw new Error("project_runtime_lease_recovery_marker_mismatch");
  }
  if (fs.existsSync(lock)) {
    assertDirectory(lock);
    fs.rmdirSync(lock);
  }
  if (fs.existsSync(lock))
    throw new Error("project_runtime_lease_lock_release_unknown");

  const evidence = ensureDirectory(runtime, "leases");
  const base = `${identity}-${pending.ownerGeneration}`;
  const acquiredPath = path.join(evidence, `${base}.json`);
  const releasedPath = path.join(evidence, `${base}-released.json`);
  const recoveredPath = path.join(evidence, `${base}-recovered.json`);
  if (!fs.existsSync(acquiredPath)) {
    if (fs.existsSync(releasedPath) || fs.existsSync(recoveredPath))
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else {
    let observed = readExactLeaseEvidence(evidence, {
      repositoryBindingId,
      projectId,
      queueId: evidenceQueueId,
      kind,
      identity,
      ownerGeneration: pending.ownerGeneration,
    });
    if (observed.acquired.content.ownerProcessId !== pending.ownerProcessId)
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    if (!observed.released && !observed.recovered) {
      atomicCreateAndReadBack(
        evidence,
        `${base}-recovered.json`,
        envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
          kind,
          queueId: evidenceQueueId,
          ownerGeneration: pending.ownerGeneration,
          ownerProcessId: pending.ownerProcessId,
          disposition: "recovered_after_owner_loss",
        }),
      );
      observed = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId: evidenceQueueId,
        kind,
        identity,
        ownerGeneration: pending.ownerGeneration,
      });
    }
    if (!observed.released && !observed.recovered)
      throw new Error("project_runtime_lease_recovery_evidence_mismatch");
  }
  fs.rmSync(releaseMarker);
  if (fs.existsSync(lockOwnershipMarker)) fs.rmSync(lockOwnershipMarker);
  if (!shouldRetainAcquisitionMarkerForCaller) fs.rmSync(acquisitionMarker);
  if (temporaryMarker !== null) fs.rmSync(temporaryMarker);
  if (
    fs.existsSync(lock) ||
    fs.existsSync(releaseMarker) ||
    fs.existsSync(lockOwnershipMarker) ||
    (shouldRetainAcquisitionMarkerForCaller
      ? !fs.existsSync(acquisitionMarker)
      : fs.existsSync(acquisitionMarker)) ||
    leaseAcquisitionTemporaryFiles(locks, identity).length > 0
  )
    throw new Error(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
    );
  return completed(
    "project_runtime_lease_acquisition_resources_recovered",
    Object.freeze({ recoveryId: expectedRecoveryId }),
  );
}

export function reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  observeOwner: LeaseOwnerObserver,
): StoreResult<Readonly<{ recoveryId: string | null }>> {
  const recoveryId =
    validId(repositoryBindingId) && validId(projectId)
      ? leaseAcquisitionRecoveryId(
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
        )
      : null;
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(projectId) ||
      typeof observeOwner !== "function"
    )
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock<Readonly<{ recoveryId: string | null }>>(
      runtime,
      "queue-mutation",
      () => {
        const identity = leaseIdentity(
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
        );
        const locks = ensureDirectory(runtime, "locks");
        if (
          leaseAcquisitionFootprintAbsent(
            locks,
            identity,
            Object.freeze([
              path.join(locks, `${identity}.lock`),
              path.join(locks, `${identity}.release-unknown`),
              path.join(locks, `${identity}.acquire-pending`),
              path.join(locks, `${identity}.acquire-lock-owned`),
            ]),
          )
        )
          return completed(
            "project_runtime_lease_acquisition_resources_absent",
            Object.freeze({ recoveryId: null }),
          );
        return reconcileUnboundLeaseAcquisition(
          runtime,
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
          observeOwner,
        );
      },
    );
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

export function reconcileProjectRuntimeLeaseOwnerLoss(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  observeOwner: LeaseOwnerObserver,
): StoreResult<ProjectQueueEntry> {
  const recoveryId = [repositoryBindingId, projectId, queueId].every(validId)
    ? leaseAcquisitionRecoveryId(
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
      )
    : null;
  try {
    if (
      ![repositoryBindingId, projectId, queueId].every(validId) ||
      typeof observeOwner !== "function"
    )
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock(runtime, "queue-mutation", () => {
      const entryDirectory = path.join(runtime, "queue", queueId);
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
        projectId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      const current = currentEnvelope?.content;
      if (!currentEnvelope || !current)
        return blocked("project_runtime_lease_recovery_state_mismatch");
      const identity = leaseIdentity(
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
      );
      const locks = ensureDirectory(runtime, "locks");
      const lock = path.join(locks, `${identity}.lock`);
      const recoveryMarker = path.join(locks, `${identity}.release-unknown`);
      const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
      const lockOwnershipMarker = path.join(
        locks,
        `${identity}.acquire-lock-owned`,
      );
      const acquisitionMarkerPresent = fs.existsSync(acquisitionMarker);
      if (current.ownerGeneration === null) {
        if (current.state !== "queued")
          return blocked("project_runtime_lease_recovery_state_mismatch");
        const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
        const footprintAbsent = leaseAcquisitionFootprintAbsent(
          locks,
          identity,
          Object.freeze([
            lock,
            recoveryMarker,
            acquisitionMarker,
            lockOwnershipMarker,
          ]),
        );
        if (footprintAbsent)
          return completed(
            "project_runtime_lease_acquisition_resources_absent",
            current,
          );
        if (!acquisitionMarkerPresent && temporaryFiles.length === 0)
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
            recoveryId,
          );
        const recovered = reconcileUnboundLeaseAcquisition(
          runtime,
          repositoryBindingId,
          projectId,
          queueId,
          "project-operation",
          observeOwner,
          true,
        );
        if (recovered.status !== "completed") return recovered;
        if (current.resultReference === recovered.value.recoveryId) {
          fs.rmSync(acquisitionMarker);
          if (fs.existsSync(acquisitionMarker))
            throw new Error(
              "project_runtime_lease_acquisition_marker_release_unknown",
            );
          return completed(
            "project_runtime_lease_acquisition_recovered",
            current,
          );
        }
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          generation: current.generation + 1,
          resultReference: recovered.value.recoveryId,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        fs.rmSync(acquisitionMarker);
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        return completed("project_runtime_lease_acquisition_recovered", value);
      }
      const lockPresent = fs.existsSync(lock);
      if (lockPresent) assertDirectory(lock);
      const lockOwnershipMarkerPresent = fs.existsSync(lockOwnershipMarker);
      if (lockPresent && !lockOwnershipMarkerPresent)
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
        );
      const markerPresent = fs.existsSync(recoveryMarker);
      if (acquisitionMarkerPresent) {
        const pending = readLeaseAcquisitionMarker(acquisitionMarker);
        if (
          pending.kind !== "project-operation" ||
          pending.queueId !== queueId ||
          pending.ownerGeneration !== current.ownerGeneration ||
          pending.recoveryId !==
            leaseAcquisitionRecoveryId(
              repositoryBindingId,
              projectId,
              queueId,
              "project-operation",
            )
        )
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (
        markerPresent &&
        fs.readFileSync(recoveryMarker, "utf8") !==
          `${current.ownerGeneration}\n`
      )
        return blocked(
          "project_runtime_lease_recovery_evidence_mismatch",
          true,
        );
      const evidence = ensureDirectory(runtime, "leases");
      const leaseEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration: current.ownerGeneration,
      });
      const acquiredContent = leaseEvidence.acquired.content;
      if (lockOwnershipMarkerPresent) {
        const ownership = readLeaseAcquisitionMarker(lockOwnershipMarker);
        if (
          ownership.kind !== "project-operation" ||
          ownership.queueId !== queueId ||
          ownership.ownerGeneration !== current.ownerGeneration ||
          ownership.ownerProcessId !== acquiredContent.ownerProcessId ||
          ownership.recoveryId !==
            leaseAcquisitionRecoveryId(
              repositoryBindingId,
              projectId,
              queueId,
              "project-operation",
            )
        )
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (acquisitionMarkerPresent) {
        const pending = readLeaseAcquisitionMarker(acquisitionMarker);
        if (pending.ownerProcessId !== acquiredContent.ownerProcessId)
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (leaseEvidence.released) {
        if (lockPresent)
          return blocked(
            "project_runtime_lease_recovery_evidence_mismatch",
            true,
          );
        if (markerPresent) fs.rmSync(recoveryMarker);
        if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
        if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
        if (fs.existsSync(recoveryMarker))
          throw new Error(
            "project_runtime_lease_recovery_marker_release_unknown",
          );
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        if (fs.existsSync(lockOwnershipMarker))
          throw new Error(
            "project_runtime_lease_lock_ownership_marker_release_unknown",
          );
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          state:
            current.state === "leased" || current.state === "running"
              ? "recovery_required"
              : current.state,
          generation: current.generation + 1,
          ownerGeneration: null,
          resumeCondition:
            current.state === "leased" || current.state === "running"
              ? "owner_loss"
              : current.resumeCondition,
          resultReference:
            current.state === "leased" || current.state === "running"
              ? `lease-recovery-${digest(
                  `${projectId}\0${queueId}\0${current.ownerGeneration}`,
                ).slice(0, 40)}`
              : current.resultReference,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        return completed("project_runtime_lease_release_reconciled", value);
      }
      if (leaseEvidence.recovered) {
        if (lockPresent || markerPresent)
          return blocked(
            "project_runtime_lease_recovery_evidence_mismatch",
            true,
          );
        if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
        if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        if (fs.existsSync(lockOwnershipMarker))
          throw new Error(
            "project_runtime_lease_lock_ownership_marker_release_unknown",
          );
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          state: "recovery_required",
          generation: current.generation + 1,
          ownerGeneration: null,
          resumeCondition: "owner_loss",
          resultReference: `lease-recovery-${digest(
            `${projectId}\0${queueId}\0${current.ownerGeneration}`,
          ).slice(0, 40)}`,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        return completed("project_runtime_lease_owner_loss_reconciled", value);
      }
      let rawObservation: unknown;
      try {
        rawObservation = observeOwner(
          Object.freeze({
            ownerProcessId: acquiredContent.ownerProcessId,
            ownerGeneration: current.ownerGeneration,
          }),
        );
      } catch {
        return blocked("project_runtime_lease_owner_observation_unknown", true);
      }
      if (
        !plainObject(rawObservation) ||
        !exactKeys(rawObservation, [
          "status",
          "ownerProcessId",
          "ownerGeneration",
        ]) ||
        rawObservation.ownerProcessId !== acquiredContent.ownerProcessId ||
        rawObservation.ownerGeneration !== current.ownerGeneration
      )
        return blocked("project_runtime_lease_owner_observation_unknown", true);
      if (rawObservation.status === "alive")
        return blocked("project_runtime_lease_owner_still_active");
      if (rawObservation.status !== "absent")
        return blocked("project_runtime_lease_owner_observation_unknown", true);

      if (!lockPresent && !markerPresent)
        return blocked("project_runtime_lease_owner_resource_unknown", true);
      if (!markerPresent) {
        const markerDescriptor = fs.openSync(
          recoveryMarker,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
          0o600,
        );
        try {
          fs.writeFileSync(
            markerDescriptor,
            `${current.ownerGeneration}\n`,
            "utf8",
          );
          fs.fsyncSync(markerDescriptor);
        } finally {
          fs.closeSync(markerDescriptor);
        }
      }
      if (lockPresent) fs.rmdirSync(lock);
      if (fs.existsSync(lock))
        throw new Error("project_runtime_lease_lock_release_unknown");
      const recoveredName = `${identity}-${current.ownerGeneration}-recovered.json`;
      if (!leaseEvidence.recovered)
        atomicCreateAndReadBack(
          evidence,
          recoveredName,
          envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
            kind: "project-operation",
            queueId,
            ownerGeneration: current.ownerGeneration,
            ownerProcessId: acquiredContent.ownerProcessId,
            disposition: "recovered_after_owner_loss",
          }),
        );
      const recoveredEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration: current.ownerGeneration,
      });
      if (!recoveredEvidence.recovered || recoveredEvidence.released)
        throw new Error("project_runtime_lease_recovery_evidence_mismatch");
      fs.rmSync(recoveryMarker);
      if (fs.existsSync(recoveryMarker))
        throw new Error(
          "project_runtime_lease_recovery_marker_release_unknown",
        );
      if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
      if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
      if (fs.existsSync(acquisitionMarker))
        throw new Error(
          "project_runtime_lease_acquisition_marker_release_unknown",
        );
      if (fs.existsSync(lockOwnershipMarker))
        throw new Error(
          "project_runtime_lease_lock_ownership_marker_release_unknown",
        );
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: "recovery_required",
        generation: current.generation + 1,
        ownerGeneration: null,
        resumeCondition: "owner_loss",
        resultReference: `lease-recovery-${digest(
          `${projectId}\0${queueId}\0${current.ownerGeneration}`,
        ).slice(0, 40)}`,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_lease_owner_loss_reconciled", value);
    });
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

export function describeProjectRuntimeDurableFoundation() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT,
    recordStrategy:
      "immutable_generation_records_with_fsynced_create_and_exact_readback",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    adoptionLease: "separate_exclusive_lock_with_no_stale_takeover",
    staleLockDisposition: "blocked_manual_reconciliation_required_before_reuse",
    externalWaitWhileMutationLockHeld: false,
    upperProjectRuntimeCapabilityComplete: false,
  });
}
