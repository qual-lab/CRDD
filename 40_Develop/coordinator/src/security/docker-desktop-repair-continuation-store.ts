import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  DockerDesktopRepairDirectoryIdentity,
  DockerDesktopRepairEffectConfirmation,
  DockerDesktopRepairOperation,
  DockerDesktopRepairRecordBoundary,
} from "./docker-desktop-repair-record-store.ts";

export const DOCKER_DESKTOP_REPAIR_CONTINUATION_DIRECTORY =
  "runtime-continuation";
export const DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-continuation/v1";

export const DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS = Object.freeze([
  "failed_launch_run_directory_rename",
  "secrets_engine_directory_rename",
  "desktop_relaunch",
] as const);
export type DockerDesktopRepairContinuationAction =
  (typeof DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS)[number];

export const DOCKER_DESKTOP_REPAIR_CONTINUATION_STAGES = Object.freeze([
  "prepared",
  "failed_run_rename_intent",
  "failed_run_renamed",
  "secrets_engine_rename_intent",
  "secrets_engine_renamed",
  "relaunch_intent",
  "relaunched",
  "recovered",
] as const);
export type DockerDesktopRepairContinuationStage =
  (typeof DOCKER_DESKTOP_REPAIR_CONTINUATION_STAGES)[number];

export type DockerDesktopRepairContinuationEffect = Readonly<{
  phase: "intent_recorded" | "settled";
  issued: boolean | null;
  confirmation: DockerDesktopRepairEffectConfirmation;
}>;

export type DockerDesktopRepairContinuation = Readonly<{
  repairId: string;
  sequence: number;
  previousRecordSha256: string;
  stage: DockerDesktopRepairContinuationStage;
  operationTipSha256: string;
  operationSequence: number;
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity;
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity;
  failedRunStaleName: string;
  secretsEngineStaleName: string;
  effects: Readonly<
    Record<
      DockerDesktopRepairContinuationAction,
      DockerDesktopRepairContinuationEffect | null
    >
  >;
}>;

type StoredContinuation = Readonly<{
  schema: typeof DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA;
  contractRevision: 1;
  repairId: string;
  sequence: number;
  previousRecordSha256: string;
  stage: DockerDesktopRepairContinuationStage;
  operationTipSha256: string;
  operationSequence: number;
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity;
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity;
  failedRunStaleName: string;
  secretsEngineStaleName: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  dockerPolicySha256: string;
  crddManifestHash: string;
  crddReleaseSequence: number;
  runtimeExecutionIdentitySha256: string;
  effects: DockerDesktopRepairContinuation["effects"];
}>;

const MAXIMUM_CONTINUATION_RECORDS = 8;
const MAXIMUM_CONTINUATION_RECORD_BYTES = 32_768;

function hash64(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function exactKeys(value: object, expected: readonly string[]) {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === expected.length &&
    expected.every((key) => actual.includes(key))
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

function validIdentity(
  value: unknown,
): value is DockerDesktopRepairDirectoryIdentity {
  return (
    plainObject(value) &&
    exactKeys(value, ["dev", "ino", "birthtimeNs"]) &&
    [value.dev, value.ino, value.birthtimeNs].every(
      (item) => typeof item === "string" && /^[1-9][0-9]*$/u.test(item),
    )
  );
}

function validEffect(
  value: unknown,
): value is DockerDesktopRepairContinuationEffect {
  if (
    !plainObject(value) ||
    !exactKeys(value, ["phase", "issued", "confirmation"])
  )
    return false;
  if (value.phase === "intent_recorded")
    return value.issued === null && value.confirmation === "unknown";
  if (value.phase !== "settled") return false;
  return (
    [true, false, null].includes(value.issued as boolean | null) &&
    ["not_issued", "confirmed", "unknown"].includes(
      String(value.confirmation),
    ) &&
    (value.issued === false
      ? value.confirmation === "not_issued"
      : value.issued === true
        ? value.confirmation !== "not_issued"
        : value.confirmation === "unknown")
  );
}

function validEffects(value: unknown): value is StoredContinuation["effects"] {
  return (
    plainObject(value) &&
    exactKeys(value, DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS) &&
    DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.every(
      (action) => value[action] === null || validEffect(value[action]),
    )
  );
}

function expectedNames(operationId: string) {
  return Object.freeze({
    failedRunStaleName: `run.crdd-stale-${operationId}-restart`,
    secretsEngineStaleName: `docker-secrets-engine.crdd-stale-${operationId}`,
  });
}

function validStoredContinuation(
  value: unknown,
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
): value is StoredContinuation {
  if (
    !plainObject(value) ||
    !exactKeys(value, [
      "schema",
      "contractRevision",
      "repairId",
      "sequence",
      "previousRecordSha256",
      "stage",
      "operationTipSha256",
      "operationSequence",
      "failedRunIdentity",
      "secretsEngineIdentity",
      "failedRunStaleName",
      "secretsEngineStaleName",
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
      "dockerPolicySha256",
      "crddManifestHash",
      "crddReleaseSequence",
      "runtimeExecutionIdentitySha256",
      "effects",
    ])
  )
    return false;
  const names = expectedNames(operation.operationId);
  return (
    value.schema === DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA &&
    value.contractRevision === 1 &&
    value.repairId === operation.repairId &&
    Number.isSafeInteger(value.sequence) &&
    Number(value.sequence) >= 0 &&
    Number(value.sequence) < MAXIMUM_CONTINUATION_RECORDS &&
    hash64(value.previousRecordSha256) &&
    DOCKER_DESKTOP_REPAIR_CONTINUATION_STAGES.includes(
      value.stage as DockerDesktopRepairContinuationStage,
    ) &&
    hash64(value.operationTipSha256) &&
    Number.isSafeInteger(value.operationSequence) &&
    Number(value.operationSequence) >= 0 &&
    Number(value.operationSequence) <= operation.sequence &&
    (value.operationSequence !== operation.sequence ||
      value.operationTipSha256 === operation.previousRecordSha256) &&
    validIdentity(value.failedRunIdentity) &&
    validIdentity(value.secretsEngineIdentity) &&
    value.failedRunStaleName === names.failedRunStaleName &&
    value.secretsEngineStaleName === names.secretsEngineStaleName &&
    value.runtimeStateIdentityHash === boundary.runtimeStateIdentityHash &&
    value.runtimeStateProtectionHash === boundary.runtimeStateProtectionHash &&
    value.localUserBindingHash === boundary.localUserBindingHash &&
    value.runtimeStateBindingHash === boundary.runtimeStateBindingHash &&
    value.dockerPolicySha256 === boundary.dockerPolicySha256 &&
    value.crddManifestHash === boundary.crddManifestHash &&
    value.crddReleaseSequence === boundary.crddReleaseSequence &&
    value.runtimeExecutionIdentitySha256 ===
      boundary.runtimeExecutionIdentitySha256 &&
    validEffects(value.effects)
  );
}

function effectEquals(
  left: DockerDesktopRepairContinuationEffect | null,
  right: DockerDesktopRepairContinuationEffect | null,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function legalTransition(
  previous: StoredContinuation | null,
  next: StoredContinuation,
) {
  if (!previous)
    return (
      next.sequence === 0 &&
      next.stage === "prepared" &&
      DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.every(
        (action) => next.effects[action] === null,
      )
    );
  if (
    next.sequence !== previous.sequence + 1 ||
    next.previousRecordSha256.length !== 64 ||
    next.operationTipSha256 !== previous.operationTipSha256 ||
    next.operationSequence !== previous.operationSequence ||
    JSON.stringify(next.failedRunIdentity) !==
      JSON.stringify(previous.failedRunIdentity) ||
    JSON.stringify(next.secretsEngineIdentity) !==
      JSON.stringify(previous.secretsEngineIdentity) ||
    next.failedRunStaleName !== previous.failedRunStaleName ||
    next.secretsEngineStaleName !== previous.secretsEngineStaleName
  )
    return false;
  const order: readonly Readonly<{
    from: DockerDesktopRepairContinuationStage;
    to: DockerDesktopRepairContinuationStage;
    action: DockerDesktopRepairContinuationAction | null;
    phase: "intent_recorded" | "settled" | null;
  }>[] = [
    {
      from: "prepared",
      to: "failed_run_rename_intent",
      action: "failed_launch_run_directory_rename",
      phase: "intent_recorded",
    },
    {
      from: "failed_run_rename_intent",
      to: "failed_run_renamed",
      action: "failed_launch_run_directory_rename",
      phase: "settled",
    },
    {
      from: "failed_run_renamed",
      to: "secrets_engine_rename_intent",
      action: "secrets_engine_directory_rename",
      phase: "intent_recorded",
    },
    {
      from: "secrets_engine_rename_intent",
      to: "secrets_engine_renamed",
      action: "secrets_engine_directory_rename",
      phase: "settled",
    },
    {
      from: "secrets_engine_renamed",
      to: "relaunch_intent",
      action: "desktop_relaunch",
      phase: "intent_recorded",
    },
    {
      from: "relaunch_intent",
      to: "relaunched",
      action: "desktop_relaunch",
      phase: "settled",
    },
    { from: "relaunched", to: "recovered", action: null, phase: null },
  ];
  const expected = order.find(
    (candidate) =>
      candidate.from === previous.stage && candidate.to === next.stage,
  );
  if (!expected) return false;
  const changed = DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.filter(
    (action) => !effectEquals(previous.effects[action], next.effects[action]),
  );
  if (expected.action === null) return changed.length === 0;
  return (
    changed.length === 1 &&
    changed[0] === expected.action &&
    next.effects[expected.action]?.phase === expected.phase
  );
}

function stableBytes(target: string) {
  try {
    const metadata = fs.lstatSync(target, { bigint: true });
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size <= 0n ||
      metadata.size > BigInt(MAXIMUM_CONTINUATION_RECORD_BYTES)
    )
      return null;
    const bytes = fs.readFileSync(target);
    const after = fs.lstatSync(target, { bigint: true });
    return metadata.dev === after.dev &&
      metadata.ino === after.ino &&
      metadata.size === after.size &&
      metadata.mtimeNs === after.mtimeNs
      ? bytes
      : null;
  } catch {
    return null;
  }
}

function toContinuation(
  record: StoredContinuation,
  recordSha256: string,
): DockerDesktopRepairContinuation {
  return Object.freeze({
    repairId: record.repairId,
    sequence: record.sequence,
    previousRecordSha256: recordSha256,
    stage: record.stage,
    operationTipSha256: record.operationTipSha256,
    operationSequence: record.operationSequence,
    failedRunIdentity: record.failedRunIdentity,
    secretsEngineIdentity: record.secretsEngineIdentity,
    failedRunStaleName: record.failedRunStaleName,
    secretsEngineStaleName: record.secretsEngineStaleName,
    effects: record.effects,
  });
}

function continuationDirectory(operation: DockerDesktopRepairOperation) {
  return path.win32.join(
    operation.operationDirectory,
    DOCKER_DESKTOP_REPAIR_CONTINUATION_DIRECTORY,
  );
}

export function readDockerDesktopRepairContinuation(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
): DockerDesktopRepairContinuation | null {
  const directory = continuationDirectory(operation);
  try {
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const names = fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    if (
      names.length < 1 ||
      names.length > MAXIMUM_CONTINUATION_RECORDS ||
      fs
        .readdirSync(directory, { withFileTypes: true })
        .some((entry) => !entry.isFile())
    )
      return null;
    let previous: StoredContinuation | null = null;
    let previousHash = "0".repeat(64);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      const match = /^continuation-([0-9]{2})-([a-z_]+)\.json$/u.exec(
        name ?? "",
      );
      if (!match || Number(match[1]) !== index) return null;
      const bytes = stableBytes(path.win32.join(directory, name ?? ""));
      if (!bytes?.toString("utf8").endsWith("\n")) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(bytes.toString("utf8"));
      } catch {
        return null;
      }
      if (
        !validStoredContinuation(parsed, boundary, operation) ||
        parsed.stage !== match[2] ||
        parsed.previousRecordSha256 !== previousHash ||
        !legalTransition(previous, parsed)
      )
        return null;
      previousHash = createHash("sha256").update(bytes).digest("hex");
      previous = parsed;
    }
    return previous ? toContinuation(previous, previousHash) : null;
  } catch {
    return null;
  }
}

export function inspectDockerDesktopRepairContinuation(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
) {
  const directory = continuationDirectory(operation);
  try {
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      return Object.freeze({ status: "invalid" as const, continuation: null });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    return Object.freeze({
      status: code === "ENOENT" ? ("absent" as const) : ("invalid" as const),
      continuation: null,
    });
  }
  const continuation = readDockerDesktopRepairContinuation(boundary, operation);
  return continuation
    ? Object.freeze({ status: "valid" as const, continuation })
    : Object.freeze({ status: "invalid" as const, continuation: null });
}

export function isDockerDesktopRepairContinuationDirectoryValid(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
) {
  return readDockerDesktopRepairContinuation(boundary, operation) !== null;
}

function persist(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  previous: DockerDesktopRepairContinuation | null,
  stage: DockerDesktopRepairContinuationStage,
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity,
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity,
  effects: DockerDesktopRepairContinuation["effects"],
) {
  const directory = continuationDirectory(operation);
  const sequence = (previous?.sequence ?? -1) + 1;
  const names = expectedNames(operation.operationId);
  const record: StoredContinuation = Object.freeze({
    schema: DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA,
    contractRevision: 1,
    repairId: operation.repairId,
    sequence,
    previousRecordSha256: previous?.previousRecordSha256 ?? "0".repeat(64),
    stage,
    operationTipSha256: operation.previousRecordSha256,
    operationSequence: operation.sequence,
    failedRunIdentity,
    secretsEngineIdentity,
    ...names,
    runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
    runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
    localUserBindingHash: boundary.localUserBindingHash,
    runtimeStateBindingHash: boundary.runtimeStateBindingHash,
    dockerPolicySha256: boundary.dockerPolicySha256,
    crddManifestHash: boundary.crddManifestHash,
    crddReleaseSequence: boundary.crddReleaseSequence,
    runtimeExecutionIdentitySha256: boundary.runtimeExecutionIdentitySha256,
    effects,
  });
  const priorRecord = previous
    ? ({
        ...record,
        sequence: previous.sequence,
        previousRecordSha256: "0".repeat(64),
        stage: previous.stage,
        effects: previous.effects,
      } as StoredContinuation)
    : null;
  if (
    sequence < 0 ||
    sequence >= MAXIMUM_CONTINUATION_RECORDS ||
    !validStoredContinuation(record, boundary, operation) ||
    !legalTransition(priorRecord, record)
  )
    return null;
  try {
    if (sequence === 0) fs.mkdirSync(directory, { recursive: false });
    const serialized = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
    const target = path.win32.join(
      directory,
      `continuation-${String(sequence).padStart(2, "0")}-${stage}.json`,
    );
    const temporary = path.win32.join(
      directory,
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
    return toContinuation(
      record,
      createHash("sha256").update(committed).digest("hex"),
    );
  } catch {
    return null;
  }
}

const emptyEffects = () =>
  Object.freeze({
    failed_launch_run_directory_rename: null,
    secrets_engine_directory_rename: null,
    desktop_relaunch: null,
  });

export function createDockerDesktopRepairContinuation(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity,
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity,
) {
  return persist(
    boundary,
    operation,
    null,
    "prepared",
    failedRunIdentity,
    secretsEngineIdentity,
    emptyEffects(),
  );
}

export function persistDockerDesktopRepairContinuationIntent(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  continuation: DockerDesktopRepairContinuation,
  action: DockerDesktopRepairContinuationAction,
) {
  const mapping = {
    failed_launch_run_directory_rename: "failed_run_rename_intent",
    secrets_engine_directory_rename: "secrets_engine_rename_intent",
    desktop_relaunch: "relaunch_intent",
  } as const;
  return persist(
    boundary,
    operation,
    continuation,
    mapping[action],
    continuation.failedRunIdentity,
    continuation.secretsEngineIdentity,
    Object.freeze({
      ...continuation.effects,
      [action]: Object.freeze({
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    }),
  );
}

export function persistDockerDesktopRepairContinuationSettlement(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  continuation: DockerDesktopRepairContinuation,
  action: DockerDesktopRepairContinuationAction,
  outcome: Readonly<{
    issued: boolean | null;
    confirmation: DockerDesktopRepairEffectConfirmation;
  }>,
) {
  const mapping = {
    failed_launch_run_directory_rename: "failed_run_renamed",
    secrets_engine_directory_rename: "secrets_engine_renamed",
    desktop_relaunch: "relaunched",
  } as const;
  return persist(
    boundary,
    operation,
    continuation,
    mapping[action],
    continuation.failedRunIdentity,
    continuation.secretsEngineIdentity,
    Object.freeze({
      ...continuation.effects,
      [action]: Object.freeze({ phase: "settled" as const, ...outcome }),
    }),
  );
}

export function persistDockerDesktopRepairContinuationRecovered(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  continuation: DockerDesktopRepairContinuation,
) {
  if (
    !DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.every((action) => {
      const effect = continuation.effects[action];
      return (
        effect?.phase === "settled" &&
        effect.issued === true &&
        effect.confirmation === "confirmed"
      );
    })
  )
    return null;
  return persist(
    boundary,
    operation,
    continuation,
    "recovered",
    continuation.failedRunIdentity,
    continuation.secretsEngineIdentity,
    continuation.effects,
  );
}

export function dockerDesktopRepairContinuationPaths(
  boundary: DockerDesktopRepairRecordBoundary,
  continuation: DockerDesktopRepairContinuation,
) {
  return Object.freeze({
    failedRunDirectory: path.win32.join(boundary.localAppData, "Docker", "run"),
    failedRunStaleDirectory: path.win32.join(
      boundary.localAppData,
      "Docker",
      continuation.failedRunStaleName,
    ),
    secretsEngineDirectory: path.win32.join(
      boundary.localAppData,
      "docker-secrets-engine",
    ),
    secretsEngineStaleDirectory: path.win32.join(
      boundary.localAppData,
      continuation.secretsEngineStaleName,
    ),
  });
}
