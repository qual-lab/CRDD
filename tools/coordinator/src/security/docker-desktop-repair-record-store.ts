import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-record/v2";
const OPERATION_PREFIX = "docker-desktop-repair-";
const MAXIMUM_OPERATIONS = 64;
const MAXIMUM_RECORDS = 16;
const MAXIMUM_RECORD_BYTES = 65_536;

export const DOCKER_DESKTOP_REPAIR_STAGES = Object.freeze([
  "prepared",
  "processes_stopped",
  "renamed",
  "recovered_pending_disposition",
  "closed_retained",
  "closed_reconciled_no_stale",
] as const);
export type DockerDesktopRepairStage =
  (typeof DOCKER_DESKTOP_REPAIR_STAGES)[number];
export type DockerDesktopRepairTriState = boolean | null;
export type DockerDesktopRepairStaleState = "absent" | "retained" | "unknown";
export type DockerDesktopRepairHostSafety =
  | "safe"
  | "manual_recovery_required"
  | "unknown";
export type DockerDesktopRepairEvidenceState =
  | "preserved"
  | "not_preserved"
  | "unknown";
export type DockerDesktopRepairDisposition =
  | "not_applicable"
  | "pending_human_decision"
  | "retained_by_human_decision";

export type DockerDesktopRepairDirectoryIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

export type DockerDesktopRepairLedgerSnapshot = Readonly<{
  processEffectIssued: DockerDesktopRepairTriState;
  filesystemEffectIssued: DockerDesktopRepairTriState;
  engineReady: DockerDesktopRepairTriState;
  staleState: DockerDesktopRepairStaleState;
  hostSafety: DockerDesktopRepairHostSafety;
  evidenceState: DockerDesktopRepairEvidenceState;
  disposition: DockerDesktopRepairDisposition;
  nativeHelperCleanupConfirmed: DockerDesktopRepairTriState;
}>;

export type DockerDesktopRepairOperation = Readonly<{
  operationId: string;
  repairId: string;
  operationDirectory: string;
  staleName: string;
  staleDirectory: string;
  runIdentity: DockerDesktopRepairDirectoryIdentity;
  stage: DockerDesktopRepairStage;
  sequence: number;
  previousRecordSha256: string;
  ledger: DockerDesktopRepairLedgerSnapshot;
}>;

export type DockerDesktopRepairRecordBoundary = Readonly<{
  runtimeStateRoot: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  dockerPolicySha256: string;
  localAppData: string;
}>;

type StoredRecord = Readonly<{
  schema: typeof DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA;
  contractRevision: 2;
  operationId: string;
  sequence: number;
  stage: DockerDesktopRepairStage;
  previousRecordSha256: string;
  staleName: string;
  runIdentity: DockerDesktopRepairDirectoryIdentity;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  dockerPolicySha256: string;
  ledger: DockerDesktopRepairLedgerSnapshot;
}>;

function exactKeys(value: object, expected: readonly string[]) {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === expected.length &&
    expected.every((key) => actual.includes(key))
  );
}

function hash64(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function operationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/u.test(value);
}

function safeIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]{0,39})$/u.test(value);
}

function validIdentity(
  value: unknown,
): value is DockerDesktopRepairDirectoryIdentity {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    exactKeys(value, ["dev", "ino", "birthtimeNs"]) &&
    safeIntegerString(Reflect.get(value, "dev")) &&
    safeIntegerString(Reflect.get(value, "ino")) &&
    safeIntegerString(Reflect.get(value, "birthtimeNs")) &&
    Reflect.get(value, "dev") !== "0" &&
    Reflect.get(value, "ino") !== "0" &&
    Reflect.get(value, "birthtimeNs") !== "0"
  );
}

function validTriState(value: unknown): value is DockerDesktopRepairTriState {
  return value === true || value === false || value === null;
}

function validLedger(
  value: unknown,
): value is DockerDesktopRepairLedgerSnapshot {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !exactKeys(value, [
      "processEffectIssued",
      "filesystemEffectIssued",
      "engineReady",
      "staleState",
      "hostSafety",
      "evidenceState",
      "disposition",
      "nativeHelperCleanupConfirmed",
    ])
  )
    return false;
  return (
    validTriState(Reflect.get(value, "processEffectIssued")) &&
    validTriState(Reflect.get(value, "filesystemEffectIssued")) &&
    validTriState(Reflect.get(value, "engineReady")) &&
    ["absent", "retained", "unknown"].includes(
      String(Reflect.get(value, "staleState")),
    ) &&
    ["safe", "manual_recovery_required", "unknown"].includes(
      String(Reflect.get(value, "hostSafety")),
    ) &&
    ["preserved", "not_preserved", "unknown"].includes(
      String(Reflect.get(value, "evidenceState")),
    ) &&
    [
      "not_applicable",
      "pending_human_decision",
      "retained_by_human_decision",
    ].includes(String(Reflect.get(value, "disposition"))) &&
    validTriState(Reflect.get(value, "nativeHelperCleanupConfirmed"))
  );
}

function validStoredRecord(
  value: unknown,
  boundary: DockerDesktopRepairRecordBoundary,
): value is StoredRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !exactKeys(value, [
      "schema",
      "contractRevision",
      "operationId",
      "sequence",
      "stage",
      "previousRecordSha256",
      "staleName",
      "runIdentity",
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
      "dockerPolicySha256",
      "ledger",
    ])
  )
    return false;
  const id = Reflect.get(value, "operationId");
  const sequence = Reflect.get(value, "sequence");
  const stage = Reflect.get(value, "stage");
  return (
    Reflect.get(value, "schema") === DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA &&
    Reflect.get(value, "contractRevision") === 2 &&
    operationId(id) &&
    Number.isSafeInteger(sequence) &&
    Number(sequence) >= 0 &&
    Number(sequence) < MAXIMUM_RECORDS &&
    DOCKER_DESKTOP_REPAIR_STAGES.includes(stage as DockerDesktopRepairStage) &&
    hash64(Reflect.get(value, "previousRecordSha256")) &&
    Reflect.get(value, "staleName") === `run.crdd-stale-${id}` &&
    validIdentity(Reflect.get(value, "runIdentity")) &&
    Reflect.get(value, "runtimeStateIdentityHash") ===
      boundary.runtimeStateIdentityHash &&
    Reflect.get(value, "runtimeStateProtectionHash") ===
      boundary.runtimeStateProtectionHash &&
    Reflect.get(value, "localUserBindingHash") ===
      boundary.localUserBindingHash &&
    Reflect.get(value, "runtimeStateBindingHash") ===
      boundary.runtimeStateBindingHash &&
    Reflect.get(value, "dockerPolicySha256") === boundary.dockerPolicySha256 &&
    validLedger(Reflect.get(value, "ledger"))
  );
}

function stableBytes(target: string) {
  let handle: number | null = null;
  try {
    const before = fs.lstatSync(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(MAXIMUM_RECORD_BYTES)
    )
      return null;
    handle = fs.openSync(target, "r");
    const opened = fs.fstatSync(handle, { bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs ||
      opened.size !== before.size
    )
      return null;
    const bytes = Buffer.alloc(Number(opened.size));
    if (fs.readSync(handle, bytes, 0, bytes.length, 0) !== bytes.length)
      return null;
    const after = fs.fstatSync(handle, { bigint: true });
    const pathAfter = fs.lstatSync(target, { bigint: true });
    return after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.birthtimeNs === opened.birthtimeNs &&
      after.size === opened.size &&
      pathAfter.dev === opened.dev &&
      pathAfter.ino === opened.ino &&
      pathAfter.birthtimeNs === opened.birthtimeNs &&
      pathAfter.size === opened.size
      ? bytes
      : null;
  } catch {
    return null;
  } finally {
    if (handle !== null) fs.closeSync(handle);
  }
}

function legalTransition(
  previous: DockerDesktopRepairStage | null,
  next: DockerDesktopRepairStage,
) {
  if (previous === null) return next === "prepared";
  const allowed = {
    prepared: ["processes_stopped", "renamed", "closed_reconciled_no_stale"],
    processes_stopped: ["renamed", "closed_reconciled_no_stale"],
    renamed: ["recovered_pending_disposition"],
    recovered_pending_disposition: ["closed_retained"],
    closed_retained: [],
    closed_reconciled_no_stale: [],
  } as const satisfies Readonly<
    Record<DockerDesktopRepairStage, readonly DockerDesktopRepairStage[]>
  >;
  return (allowed[previous] as readonly DockerDesktopRepairStage[]).includes(
    next,
  );
}

function toOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  record: StoredRecord,
  recordSha256: string,
): DockerDesktopRepairOperation {
  const operationDirectory = path.win32.join(
    boundary.runtimeStateRoot,
    `${OPERATION_PREFIX}${record.operationId}`,
  );
  return Object.freeze({
    operationId: record.operationId,
    repairId: `docker-desktop-repair.${record.operationId}`,
    operationDirectory,
    staleName: record.staleName,
    staleDirectory: path.win32.join(
      boundary.localAppData,
      "Docker",
      record.staleName,
    ),
    runIdentity: record.runIdentity,
    stage: record.stage,
    sequence: record.sequence,
    previousRecordSha256: recordSha256,
    ledger: record.ledger,
  });
}

function readOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  directoryName: string,
) {
  const matched = /^docker-desktop-repair-([a-f0-9]{32})$/u.exec(directoryName);
  if (!matched?.[1]) return null;
  const directory = path.win32.join(boundary.runtimeStateRoot, directoryName);
  try {
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    if (entries.length < 1 || entries.length > MAXIMUM_RECORDS + 1) return null;
    const records = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    const nonRecords = entries.filter(
      (entry) =>
        !(entry.isDirectory() && entry.name === "docker-config") &&
        !entry.isFile(),
    );
    if (
      nonRecords.length > 0 ||
      records.length < 1 ||
      records.length > MAXIMUM_RECORDS
    )
      return null;
    let previousHash = "0".repeat(64);
    let previousStage: DockerDesktopRepairStage | null = null;
    let last: StoredRecord | null = null;
    for (let index = 0; index < records.length; index += 1) {
      const name = records[index];
      const match = /^repair-([0-9]{2})-([a-z_]+)\.json$/u.exec(name ?? "");
      if (!match || Number(match[1]) !== index) return null;
      const bytes = stableBytes(path.win32.join(directory, name ?? ""));
      if (!bytes?.toString("utf8").endsWith("\n")) return null;
      let value: unknown;
      try {
        value = JSON.parse(bytes.toString("utf8"));
      } catch {
        return null;
      }
      if (
        !validStoredRecord(value, boundary) ||
        value.operationId !== matched[1] ||
        value.sequence !== index ||
        value.stage !== match[2] ||
        value.previousRecordSha256 !== previousHash ||
        !legalTransition(previousStage, value.stage)
      )
        return null;
      previousHash = createHash("sha256").update(bytes).digest("hex");
      previousStage = value.stage;
      last = value;
    }
    return last ? toOperation(boundary, last, previousHash) : null;
  } catch {
    return null;
  }
}

export function inventoryDockerDesktopRepairOperations(
  boundary: DockerDesktopRepairRecordBoundary,
) {
  try {
    const names = fs
      .readdirSync(boundary.runtimeStateRoot, { withFileTypes: true })
      .filter((entry) => entry.name.startsWith(OPERATION_PREFIX));
    if (names.length > MAXIMUM_OPERATIONS)
      return Object.freeze({ status: "unknown" as const, operations: [] });
    const operations: DockerDesktopRepairOperation[] = [];
    for (const entry of names) {
      if (!entry.isDirectory())
        return Object.freeze({ status: "unknown" as const, operations: [] });
      const operation = readOperation(boundary, entry.name);
      if (!operation)
        return Object.freeze({ status: "unknown" as const, operations: [] });
      operations.push(operation);
    }
    return Object.freeze({
      status: "verified" as const,
      operations: Object.freeze(operations),
    });
  } catch {
    return Object.freeze({ status: "unknown" as const, operations: [] });
  }
}

export function createDockerDesktopRepairOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  runIdentity: DockerDesktopRepairDirectoryIdentity,
  ledger: DockerDesktopRepairLedgerSnapshot,
) {
  const id = randomBytes(16).toString("hex");
  return Object.freeze({
    operationId: id,
    repairId: `docker-desktop-repair.${id}`,
    operationDirectory: path.win32.join(
      boundary.runtimeStateRoot,
      `${OPERATION_PREFIX}${id}`,
    ),
    staleName: `run.crdd-stale-${id}`,
    staleDirectory: path.win32.join(
      boundary.localAppData,
      "Docker",
      `run.crdd-stale-${id}`,
    ),
    runIdentity,
    stage: "prepared" as const,
    sequence: -1,
    previousRecordSha256: "0".repeat(64),
    ledger,
  });
}

export function persistDockerDesktopRepairStage(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  stage: DockerDesktopRepairStage,
  ledger: DockerDesktopRepairLedgerSnapshot,
) {
  try {
    const sequence = operation.sequence + 1;
    if (
      sequence < 0 ||
      sequence >= MAXIMUM_RECORDS ||
      !legalTransition(operation.sequence < 0 ? null : operation.stage, stage)
    )
      return null;
    if (sequence === 0) {
      fs.mkdirSync(operation.operationDirectory, { recursive: false });
      fs.mkdirSync(
        path.win32.join(operation.operationDirectory, "docker-config"),
        {
          recursive: false,
        },
      );
    }
    const record: StoredRecord = Object.freeze({
      schema: DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA,
      contractRevision: 2,
      operationId: operation.operationId,
      sequence,
      stage,
      previousRecordSha256: operation.previousRecordSha256,
      staleName: operation.staleName,
      runIdentity: operation.runIdentity,
      runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
      runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
      localUserBindingHash: boundary.localUserBindingHash,
      runtimeStateBindingHash: boundary.runtimeStateBindingHash,
      dockerPolicySha256: boundary.dockerPolicySha256,
      ledger,
    });
    const serialized = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
    const target = path.win32.join(
      operation.operationDirectory,
      `repair-${String(sequence).padStart(2, "0")}-${stage}.json`,
    );
    const temporary = path.win32.join(
      operation.operationDirectory,
      `.crdd-${randomBytes(16).toString("hex")}.tmp`,
    );
    const handle = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(handle, serialized);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    const temporaryBytes = stableBytes(temporary);
    if (!temporaryBytes?.equals(serialized)) return null;
    fs.renameSync(temporary, target);
    const committed = stableBytes(target);
    if (!committed?.equals(serialized)) return null;
    const recordSha256 = createHash("sha256").update(committed).digest("hex");
    return Object.freeze({
      ...operation,
      stage,
      sequence,
      previousRecordSha256: recordSha256,
      ledger,
    });
  } catch {
    return null;
  }
}

export function parseDockerDesktopRepairId(value: unknown) {
  const matched =
    typeof value === "string"
      ? /^docker-desktop-repair\.([a-f0-9]{32})$/u.exec(value)
      : null;
  return matched?.[1] ?? null;
}

export function describeDockerDesktopRepairRecordStoreContract() {
  return Object.freeze({
    schema: DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA,
    operationLimit: MAXIMUM_OPERATIONS,
    recordLimit: MAXIMUM_RECORDS,
    recordBytesLimit: MAXIMUM_RECORD_BYTES,
    exactHashChain: true,
    unfinishedOperationBlocksNewRepair: true,
    staleDirectoryDeletion: false,
    closedRetainedRequiresExplicitHumanCommand: true,
  });
}
