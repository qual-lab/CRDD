import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ProjectRuntimeState } from "./project-runtime-state.ts";
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
  evidenceDirectory: string;
  identity: string;
}>;

const ACTIVE_LEASES = new WeakMap<ProjectRuntimeLease, ActiveLease>();

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
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
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

function nullableRecoveryId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
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
        "cleanupConfirmed",
        "recoveryId",
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
      typeof task.cleanupConfirmed !== "boolean" ||
      !nullableRecoveryId(task.recoveryId) ||
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
    nullableId(value.resultReference)
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
    (value.disposition === "acquired" || value.disposition === "released")
  );
}

function completed<T>(reason: string, value: T): StoreResult<T> {
  return Object.freeze({ status: "completed", reason, value });
}

function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
): StoreResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
  });
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
    if (prefix === "generation-") {
      const match = generationName.exec(name);
      if (!match || Number(match[1]) !== parsed.updatedGeneration)
        throw new Error("project_runtime_record_generation_mismatch");
    }
    if (
      (parsed.recordKind === "project-state" &&
        !validProjectRuntimeState(parsed.content)) ||
      (parsed.recordKind === "queue-entry" &&
        !validQueueEntry(parsed.content)) ||
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

type QueueEnvelope = Envelope & Readonly<{ content: ProjectQueueEntry }>;

function validatedQueueHistory(
  records: readonly Envelope[],
  repositoryBindingId: string,
  queueId: string,
  expectedProjectId?: string,
): readonly QueueEnvelope[] | null {
  const ordered = [...records].sort(
    (left, right) => left.updatedGeneration - right.updatedGeneration,
  );
  let projectId = expectedProjectId ?? null;
  const result: QueueEnvelope[] = [];
  for (const record of ordered) {
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
    result.push(record as QueueEnvelope);
  }
  return Object.freeze(result);
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
      const existing = readEnvelopes(project, "generation-");
      const latest = existing.reduce(
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
      const observed = readEnvelopes(entryDirectory, "generation-");
      const existing = validatedQueueHistory(
        observed,
        repositoryBindingId,
        input.queueId,
        input.projectId,
      );
      if (existing === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      if (existing.length > 0) {
        const currentEnvelope = existing.at(-1);
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
  waiting_foreground: Object.freeze(["leased", "cancelled"]),
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
  human_decision_required: Object.freeze(["recovery_required", "cancelled"]),
  recovery_required: Object.freeze(["cancelled"]),
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
    if (next.resultReference !== null && !validId(next.resultReference))
      return blocked("project_runtime_queue_result_reference_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queue", queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const existing = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      if (existing === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      const currentEnvelope = existing.at(-1);
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
      const activeLease = next.lease
        ? ACTIVE_LEASES.get(next.lease)
        : undefined;
      const leaseRequired =
        current.ownerGeneration !== null ||
        ["leased", "running", "integration_pending"].includes(next.state);
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
      const ownerGeneration = leaseRequired
        ? (activeLease?.ownerGeneration ?? null)
        : current.ownerGeneration;
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

export function acquireProjectRuntimeLease(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): StoreResult<ProjectRuntimeLease> {
  try {
    if (![repositoryBindingId, projectId, queueId].every(validId))
      return blocked("project_runtime_lease_identity_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const locks = ensureDirectory(runtime, "locks");
    const identity =
      kind === "canonical-adoption"
        ? `${kind}-${repositoryBindingId}-${projectId}`
        : `${kind}-${projectId}-${queueId}`;
    const lock = path.join(locks, `${identity}.lock`);
    const recoveryMarker = path.join(locks, `${identity}.release-unknown`);
    if (fs.existsSync(recoveryMarker))
      return blocked("project_runtime_lease_recovery_required", true);
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
    } catch (error) {
      return errorCode(error) === "EEXIST"
        ? blocked("project_runtime_lease_unavailable")
        : blocked("project_runtime_lease_observation_unknown", true);
    }
    assertDirectory(lock);
    const ownerGeneration = randomUUID();
    const evidence = ensureDirectory(runtime, "leases");
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
          assertDirectory(lock);
          fs.rmdirSync(lock);
          if (fs.existsSync(lock))
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
          released = true;
          ACTIVE_LEASES.delete(lease);
          return completed<Readonly<{ released: true }>>(
            "project_runtime_lease_released",
            Object.freeze({ released: true as const }),
          );
        } catch {
          ACTIVE_LEASES.delete(lease);
          return blocked<Readonly<{ released: true }>>(
            "project_runtime_lease_release_unknown",
            true,
          );
        }
      },
    });
    ACTIVE_LEASES.set(
      lease,
      Object.freeze({
        repositoryRoot,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
        ownerGeneration,
        lock,
        recoveryMarker,
        evidenceDirectory: evidence,
        identity,
      }),
    );
    return completed("project_runtime_lease_acquired", lease);
  } catch {
    return blocked("project_runtime_lease_observation_unknown", true);
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
