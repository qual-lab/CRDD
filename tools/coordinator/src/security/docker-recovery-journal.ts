import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_RECORD_BYTES = 65_536;
const COMMIT_SUFFIX = ".crdd-commit.json";
const TEMP_PREFIX = ".crdd-pending-";

type FileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

type CommittedJson = Readonly<{
  target: string;
  commit: string;
  serialized: string;
  hash: string;
  identity: FileIdentity;
  identityText: string;
  logicalKey: string;
  value: unknown;
}>;

function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function identityOf(metadata: fs.BigIntStats): FileIdentity {
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

function identityText(identity: FileIdentity) {
  return `${identity.dev}:${identity.ino}:${identity.birthtimeNs}`;
}

function exactKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

function readStableFile(file: string) {
  const before = fs.lstatSync(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.size <= 0n ||
    before.size > BigInt(MAX_RECORD_BYTES)
  )
    throw new Error("docker_task_recovery_record_invalid");
  const serialized = fs.readFileSync(file, "utf8");
  const after = fs.lstatSync(file, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.birthtimeNs !== after.birthtimeNs ||
    before.size !== after.size
  )
    throw new Error("docker_task_recovery_record_changed");
  return Object.freeze({ serialized, identity: identityOf(before) });
}

function writeAtomicFile(
  directory: string,
  target: string,
  serialized: string,
) {
  if (fs.existsSync(target))
    throw new Error("docker_recovery_record_already_exists");
  const temporary = path.join(
    directory,
    `${TEMP_PREFIX}${path.basename(target)}-${randomBytes(16).toString("hex")}.tmp`,
  );
  const handle = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(handle, serialized, "utf8");
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  const temporaryRecord = readStableFile(temporary);
  if (temporaryRecord.serialized !== serialized)
    throw new Error("docker_recovery_record_changed");
  if (fs.existsSync(target))
    throw new Error("docker_recovery_record_already_exists");
  fs.renameSync(temporary, target);
  const finalRecord = readStableFile(target);
  if (
    finalRecord.serialized !== serialized ||
    identityText(finalRecord.identity) !==
      identityText(temporaryRecord.identity)
  )
    throw new Error("docker_recovery_record_changed");
  return finalRecord;
}

export function dockerRecoveryCommitName(name: string) {
  return `${name}${COMMIT_SUFFIX}`;
}

export function isDockerRecoveryJournalTemporaryName(name: string) {
  return (
    name.startsWith(TEMP_PREFIX) && /^[.a-z0-9_-]{1,220}\.tmp$/u.test(name)
  );
}

export function writeCommittedDockerRecoveryJson(
  directory: string,
  name: string,
  logicalKey: string,
  value: unknown,
): CommittedJson {
  const target = path.join(directory, name);
  const commit = path.join(directory, dockerRecoveryCommitName(name));
  if (fs.existsSync(target) || fs.existsSync(commit))
    throw new Error("docker_recovery_record_already_exists");
  const serialized = canonical(value);
  const content = writeAtomicFile(directory, target, serialized);
  const hash = createHash("sha256").update(serialized).digest("hex");
  const commitValue = Object.freeze({
    schema: "crdd-coordinator-durable-json-commit/v1",
    logicalKey,
    contentHash: hash,
    contentIdentity: identityText(content.identity),
    contentBytes: Buffer.byteLength(serialized, "utf8"),
  });
  const commitSerialized = canonical(commitValue);
  writeAtomicFile(directory, commit, commitSerialized);
  return Object.freeze({
    target,
    commit,
    serialized,
    hash,
    identity: content.identity,
    identityText: identityText(content.identity),
    logicalKey,
    value,
  });
}

export function readCommittedDockerRecoveryJson(
  file: string,
  expectedLogicalKey = path.basename(file),
): CommittedJson {
  const content = readStableFile(file);
  const value = JSON.parse(content.serialized);
  if (canonical(value) !== content.serialized)
    throw new Error("docker_task_recovery_record_noncanonical");
  const hash = createHash("sha256").update(content.serialized).digest("hex");
  const commit = `${file}${COMMIT_SUFFIX}`;
  if (!fs.existsSync(commit))
    throw new Error("docker_task_recovery_commit_missing");
  const commitRecord = readStableFile(commit);
  const commitValue = JSON.parse(commitRecord.serialized);
  if (
    canonical(commitValue) !== commitRecord.serialized ||
    !exactKeys(commitValue, [
      "schema",
      "logicalKey",
      "contentHash",
      "contentIdentity",
      "contentBytes",
    ]) ||
    commitValue.schema !== "crdd-coordinator-durable-json-commit/v1" ||
    commitValue.logicalKey !== expectedLogicalKey ||
    commitValue.contentHash !== hash ||
    commitValue.contentIdentity !== identityText(content.identity) ||
    commitValue.contentBytes !== Buffer.byteLength(content.serialized, "utf8")
  )
    throw new Error("docker_task_recovery_commit_invalid");
  return Object.freeze({
    target: file,
    commit,
    serialized: content.serialized,
    hash,
    identity: content.identity,
    identityText: identityText(content.identity),
    logicalKey: expectedLogicalKey,
    value,
  });
}

export function moveCommittedDockerRecoveryJson(
  source: CommittedJson,
  target: string,
) {
  const targetCommit = `${target}${COMMIT_SUFFIX}`;
  if (fs.existsSync(target) || fs.existsSync(targetCommit))
    throw new Error("docker_recovery_record_already_exists");
  fs.renameSync(source.target, target);
  fs.renameSync(source.commit, targetCommit);
  return readCommittedDockerRecoveryJson(target, source.logicalKey);
}

export function removeCommittedDockerRecoveryJson(
  file: string,
  expectedLogicalKey = path.basename(file),
) {
  readCommittedDockerRecoveryJson(file, expectedLogicalKey);
  fs.rmSync(`${file}${COMMIT_SUFFIX}`);
  fs.rmSync(file);
  return !fs.existsSync(file) && !fs.existsSync(`${file}${COMMIT_SUFFIX}`);
}

export function describeDockerRecoveryJournalContract() {
  return Object.freeze({
    commitSchema: "crdd-coordinator-durable-json-commit/v1",
    processCrashBoundary:
      "fsynced_temp_atomic_rename_then_fsynced_commit_atomic_rename",
    uncommittedFinalTreatment: "retain_and_fail_closed",
    orphanTemporaryTreatment: "retain_and_fail_closed",
    powerLossDurabilityClaimed: false,
  });
}
