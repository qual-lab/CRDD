import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  classifyCommittedPairDeleteState,
  classifyCommittedPairMoveState,
  classifyCleanupDirectoryState,
} from "./docker-recovery-state-machine.ts";

const MAX_RECORD_BYTES = 262_144;
const COMMIT_SUFFIX = ".crdd-commit.json";
const TEMP_PREFIX = ".crdd-pending-";
const DELETE_PREFIX = ".crdd-delete-";
const MOVE_PREFIX = ".crdd-move-";
const CLEANUP_PREFIX = ".crdd-cleanup-";
const INTENT_PENDING_SUFFIX = ".pending";

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

type DiscoveredJournalJson = Readonly<{
  serialized: string;
  hash: string;
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

function stableDirectoryIdentity(directory: string) {
  const metadata = fs.lstatSync(directory, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("docker_recovery_directory_invalid");
  return identityText(identityOf(metadata));
}

function hashText(serialized: string) {
  return createHash("sha256").update(serialized).digest("hex");
}

function observePath(target: string) {
  try {
    return fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw new Error("docker_recovery_path_observation_unknown");
  }
}

function regularFilePresent(target: string) {
  const metadata = observePath(target);
  if (metadata === null) return false;
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("docker_recovery_path_observation_unknown");
  return true;
}

function exactFile(file: string, serialized: string, identity: string) {
  if (!regularFilePresent(file)) return false;
  const observed = readStableFile(file);
  if (
    observed.serialized !== serialized ||
    identityText(observed.identity) !== identity
  )
    throw new Error("docker_recovery_intent_third_state");
  return true;
}

function writeIntentAnchor(anchor: string, value: unknown) {
  const serialized = canonical(value);
  const pending = `${anchor}${INTENT_PENDING_SUFFIX}`;
  if (fs.existsSync(anchor)) return;
  if (fs.existsSync(pending)) {
    const observed = readStableFile(pending);
    if (observed.serialized !== serialized)
      throw new Error("docker_recovery_intent_third_state");
  } else {
    const handle = fs.openSync(pending, "wx", 0o600);
    try {
      fs.writeFileSync(handle, serialized, "utf8");
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    if (readStableFile(pending).serialized !== serialized)
      throw new Error("docker_recovery_record_changed");
  }
  if (fs.existsSync(anchor))
    throw new Error("docker_recovery_intent_third_state");
  fs.renameSync(pending, anchor);
  if (readStableFile(anchor).serialized !== serialized)
    throw new Error("docker_recovery_record_changed");
}

function readIntentAnchor(anchor: string) {
  const record = readStableFile(anchor);
  const value = JSON.parse(record.serialized);
  if (canonical(value) !== record.serialized)
    throw new Error("docker_recovery_intent_noncanonical");
  return value as Record<string, unknown>;
}

function committedPairEvidence(source: CommittedJson) {
  const commit = readStableFile(source.commit);
  return Object.freeze({
    logicalKey: source.logicalKey,
    contentName: path.basename(source.target),
    contentSerialized: source.serialized,
    contentHash: source.hash,
    contentIdentity: source.identityText,
    contentBytes: Buffer.byteLength(source.serialized, "utf8"),
    commitName: path.basename(source.commit),
    commitSerialized: commit.serialized,
    commitHash: hashText(commit.serialized),
    commitIdentity: identityText(commit.identity),
    commitBytes: Buffer.byteLength(commit.serialized, "utf8"),
  });
}

function validPairEvidence(value: unknown) {
  if (
    !exactKeys(value, [
      "logicalKey",
      "contentName",
      "contentSerialized",
      "contentHash",
      "contentIdentity",
      "contentBytes",
      "commitName",
      "commitSerialized",
      "commitHash",
      "commitIdentity",
      "commitBytes",
    ])
  )
    return false;
  const evidence = value as Record<string, unknown>;
  if (
    !(
      typeof evidence.logicalKey === "string" &&
      typeof evidence.contentName === "string" &&
      path.basename(evidence.contentName) === evidence.contentName &&
      typeof evidence.commitName === "string" &&
      evidence.commitName === `${evidence.contentName}${COMMIT_SUFFIX}` &&
      typeof evidence.contentSerialized === "string" &&
      typeof evidence.commitSerialized === "string" &&
      evidence.contentHash === hashText(evidence.contentSerialized) &&
      evidence.commitHash === hashText(evidence.commitSerialized) &&
      typeof evidence.contentIdentity === "string" &&
      typeof evidence.commitIdentity === "string" &&
      evidence.contentBytes ===
        Buffer.byteLength(evidence.contentSerialized, "utf8") &&
      evidence.commitBytes ===
        Buffer.byteLength(evidence.commitSerialized, "utf8")
    )
  )
    return false;
  try {
    const contentValue = JSON.parse(evidence.contentSerialized);
    const commitValue = JSON.parse(evidence.commitSerialized);
    return (
      canonical(contentValue) === evidence.contentSerialized &&
      canonical(commitValue) === evidence.commitSerialized &&
      exactKeys(commitValue, [
        "schema",
        "logicalKey",
        "contentHash",
        "contentIdentity",
        "contentBytes",
      ]) &&
      commitValue.schema === "crdd-coordinator-durable-json-commit/v1" &&
      commitValue.logicalKey === evidence.logicalKey &&
      commitValue.contentHash === evidence.contentHash &&
      commitValue.contentIdentity === evidence.contentIdentity &&
      commitValue.contentBytes === evidence.contentBytes
    );
  } catch {
    return false;
  }
}

function finalIntentName(anchor: string) {
  const name = path.basename(anchor);
  return name.endsWith(INTENT_PENDING_SUFFIX)
    ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
    : name;
}

function validateIntentAnchorName(
  anchor: string,
  value: Record<string, unknown>,
) {
  const directory = path.dirname(anchor);
  let digest: string;
  if (value.schema === "crdd-coordinator-durable-json-delete/v1") {
    const pair = value.pair as Record<string, unknown>;
    digest = hashText(
      `${String(pair.contentName)}\0${String(pair.contentHash)}\0${String(pair.contentIdentity)}`,
    );
    if (finalIntentName(anchor) !== `${DELETE_PREFIX}${digest}.json`)
      throw new Error("docker_recovery_delete_intent_invalid");
    return;
  }
  if (value.schema === "crdd-coordinator-durable-json-move/v1") {
    const pair = value.pair as Record<string, unknown>;
    const source = path.join(directory, String(pair.contentName));
    const target = path.join(
      String(value.targetDirectory),
      String(value.targetContentName),
    );
    digest = hashText(
      `${source}\0${target}\0${String(pair.contentHash)}\0${String(pair.contentIdentity)}`,
    );
    if (finalIntentName(anchor) !== `${MOVE_PREFIX}${digest}.json`)
      throw new Error("docker_recovery_move_intent_invalid");
    return;
  }
  digest = hashText(
    `${String(value.cleanupName)}\0${String(value.cleanupIdentity)}\0${String(value.recoveryId)}`,
  );
  if (finalIntentName(anchor) !== `${CLEANUP_PREFIX}${digest}.json`)
    throw new Error("docker_recovery_cleanup_intent_invalid");
}

function recoveryIdFromIntent(value: Record<string, unknown>) {
  if (
    value.schema === "crdd-coordinator-recovery-cleanup-delete/v1" &&
    typeof value.recoveryId === "string"
  )
    return value.recoveryId;
  if (
    value.schema !== "crdd-coordinator-durable-json-delete/v1" &&
    value.schema !== "crdd-coordinator-durable-json-move/v1"
  )
    return null;
  const pair = value.pair as Record<string, unknown>;
  try {
    const content = JSON.parse(String(pair.contentSerialized)) as Record<
      string,
      unknown
    >;
    if (
      typeof content.recoveryId === "string" &&
      /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
        content.recoveryId,
      )
    )
      return content.recoveryId;
    if (
      content.schema === "crdd-coordinator-task-docker-recovery/v1" &&
      typeof content.operationNonce === "string" &&
      typeof content.stableLogicalHomeBindingHash === "string"
    ) {
      const token = `docker-task.${content.stableLogicalHomeBindingHash}.${content.operationNonce}.${String(pair.contentHash)}`;
      if (
        /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(token)
      )
        return token;
    }
  } catch {
    return null;
  }
  return null;
}

function validRuntimeStateBindingEvidence(value: unknown) {
  return (
    exactKeys(value, [
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
    ]) &&
    Object.values(value as Record<string, unknown>).every(
      (item) => typeof item === "string" && /^[a-f0-9]{64}$/u.test(item),
    )
  );
}

function sameRuntimeStateBindingEvidence(left: unknown, right: unknown) {
  if (
    !validRuntimeStateBindingEvidence(left) ||
    !validRuntimeStateBindingEvidence(right)
  )
    return false;
  const leftBinding = left as Record<string, unknown>;
  const rightBinding = right as Record<string, unknown>;
  return (
    leftBinding.runtimeStateIdentityHash ===
      rightBinding.runtimeStateIdentityHash &&
    leftBinding.runtimeStateProtectionHash ===
      rightBinding.runtimeStateProtectionHash &&
    leftBinding.localUserBindingHash === rightBinding.localUserBindingHash &&
    leftBinding.runtimeStateBindingHash === rightBinding.runtimeStateBindingHash
  );
}

function runtimeStateBindingFromIntent(value: Record<string, unknown>) {
  if (
    value.schema === "crdd-coordinator-recovery-cleanup-delete/v1" &&
    validRuntimeStateBindingEvidence(value.runtimeStateBinding)
  )
    return value.runtimeStateBinding as Readonly<Record<string, unknown>>;
  if (
    (value.schema === "crdd-coordinator-durable-json-delete/v1" ||
      value.schema === "crdd-coordinator-durable-json-move/v1") &&
    validPairEvidence(value.pair)
  ) {
    const pair = value.pair as Record<string, unknown>;
    const content = JSON.parse(String(pair.contentSerialized)) as Record<
      string,
      unknown
    >;
    if (validRuntimeStateBindingEvidence(content.runtimeStateBinding))
      return content.runtimeStateBinding as Readonly<Record<string, unknown>>;
  }
  return null;
}

function resolveRuntimeStateBindingForRecovery(
  directory: string,
  recoveryId: string,
  intents: readonly Record<string, unknown>[],
) {
  const candidates: Readonly<Record<string, unknown>>[] = [];
  for (const intent of intents) {
    if (recoveryIdFromIntent(intent) !== recoveryId) continue;
    const binding = runtimeStateBindingFromIntent(intent);
    if (binding) candidates.push(binding);
  }
  const match =
    /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u.exec(
      recoveryId,
    );
  if (!match?.[2] || !match[3])
    throw new Error("docker_recovery_target_invalid");
  for (const file of [
    path.join(directory, `docker-task-${match[2]}`, "base.json"),
    path.join(directory, `pending-docker-task-${match[2]}.json`),
  ]) {
    if (!fs.existsSync(file)) continue;
    try {
      const base = readCommittedDockerRecoveryJson(file, "base.json");
      const value = base.value as Record<string, unknown>;
      if (
        base.hash === match[3] &&
        value.operationNonce === match[2] &&
        value.stableLogicalHomeBindingHash === match[1] &&
        validRuntimeStateBindingEvidence(value.runtimeStateBinding)
      )
        candidates.push(
          value.runtimeStateBinding as Readonly<Record<string, unknown>>,
        );
    } catch {
      // A split committed pair is represented by its validated move/delete
      // intent and must not be guessed from a partial filesystem state.
    }
  }
  const baseCommitIntentPresent = intents.some((intent) => {
    if (recoveryIdFromIntent(intent) !== recoveryId) return false;
    const pair = intent.pair as Record<string, unknown>;
    return validPairEvidence(pair) && pair.logicalKey === "base-commit.json";
  });
  const splitBase = path.join(
    directory,
    `docker-task-${match[2]}`,
    "base.json",
  );
  if (baseCommitIntentPresent && fs.existsSync(splitBase)) {
    const stable = readStableFile(splitBase);
    const value = JSON.parse(stable.serialized) as Record<string, unknown>;
    if (
      canonical(value) !== stable.serialized ||
      hashText(stable.serialized) !== match[3] ||
      value.operationNonce !== match[2] ||
      value.stableLogicalHomeBindingHash !== match[1] ||
      !validRuntimeStateBindingEvidence(value.runtimeStateBinding)
    )
      throw new Error("docker_recovery_target_binding_mismatch");
    candidates.push(
      value.runtimeStateBinding as Readonly<Record<string, unknown>>,
    );
  }
  if (candidates.length === 0)
    throw new Error("docker_recovery_target_binding_missing");
  const first = candidates[0];
  if (
    !first ||
    candidates.some(
      (candidate) => !sameRuntimeStateBindingEvidence(candidate, first),
    )
  )
    throw new Error("docker_recovery_target_binding_mismatch");
  return first;
}

function resumeDeleteAnchor(anchor: string) {
  const intent = readIntentAnchor(anchor);
  if (
    !exactKeys(intent, ["schema", "parentIdentity", "pair"]) ||
    intent.schema !== "crdd-coordinator-durable-json-delete/v1" ||
    stableDirectoryIdentity(path.dirname(anchor)) !== intent.parentIdentity ||
    !validPairEvidence(intent.pair)
  )
    throw new Error("docker_recovery_delete_intent_invalid");
  const pair = intent.pair as Record<string, unknown>;
  const target = path.join(path.dirname(anchor), String(pair.contentName));
  const commit = path.join(path.dirname(anchor), String(pair.commitName));
  const targetPresent = exactFile(
    target,
    String(pair.contentSerialized),
    String(pair.contentIdentity),
  );
  const commitPresent = exactFile(
    commit,
    String(pair.commitSerialized),
    String(pair.commitIdentity),
  );
  const state = classifyCommittedPairDeleteState(targetPresent, commitPresent);
  if (state === "third_state")
    throw new Error("docker_recovery_delete_intent_third_state");
  if (state === "remove_content") fs.rmSync(target);
  if (state !== "complete") {
    if (regularFilePresent(target))
      throw new Error("docker_recovery_delete_incomplete");
    if (regularFilePresent(commit)) fs.rmSync(commit);
  }
  if (regularFilePresent(target) || regularFilePresent(commit))
    throw new Error("docker_recovery_delete_incomplete");
  fs.rmSync(anchor);
  if (regularFilePresent(anchor))
    throw new Error("docker_recovery_delete_incomplete");
  return true;
}

function inspectMoveAnchorState(anchor: string) {
  const intent = validateIntentSnapshot(anchor);
  if (intent.schema !== "crdd-coordinator-durable-json-move/v1")
    throw new Error("docker_recovery_move_intent_invalid");
  const pair = intent.pair as Record<string, unknown>;
  const sourceDirectory = path.dirname(anchor);
  const targetDirectory = String(intent.targetDirectory);
  const sourceTarget = path.join(sourceDirectory, String(pair.contentName));
  const sourceCommit = path.join(sourceDirectory, String(pair.commitName));
  const target = path.join(targetDirectory, String(intent.targetContentName));
  const targetCommit = path.join(
    targetDirectory,
    String(intent.targetCommitName),
  );
  const sourceTargetPresent = exactFile(
    sourceTarget,
    String(pair.contentSerialized),
    String(pair.contentIdentity),
  );
  const sourceCommitPresent = exactFile(
    sourceCommit,
    String(pair.commitSerialized),
    String(pair.commitIdentity),
  );
  const targetPresent = exactFile(
    target,
    String(pair.contentSerialized),
    String(pair.contentIdentity),
  );
  const targetCommitPresent = exactFile(
    targetCommit,
    String(pair.commitSerialized),
    String(pair.commitIdentity),
  );
  const state = classifyCommittedPairMoveState(
    sourceTargetPresent,
    sourceCommitPresent,
    targetPresent,
    targetCommitPresent,
  );
  if (state === "third_state")
    throw new Error("docker_recovery_move_intent_third_state");
  return Object.freeze({
    intent,
    pair,
    state,
    sourceDirectory,
    targetDirectory,
    sourceTarget,
    sourceCommit,
    target,
    targetCommit,
    record: Object.freeze({
      serialized: String(pair.contentSerialized),
      hash: String(pair.contentHash),
      identityText: String(pair.contentIdentity),
      logicalKey: String(pair.logicalKey),
      value: JSON.parse(String(pair.contentSerialized)),
    }),
  });
}

function resumeMoveAnchor(anchor: string) {
  const inspected = inspectMoveAnchorState(anchor);
  const { pair, sourceTarget, sourceCommit, target, targetCommit, state } =
    inspected;
  if (state === "move_content") fs.renameSync(sourceTarget, target);
  if (state !== "complete") {
    if (!fs.existsSync(target) || fs.existsSync(sourceTarget))
      throw new Error("docker_recovery_move_incomplete");
    if (fs.existsSync(sourceCommit)) fs.renameSync(sourceCommit, targetCommit);
  }
  exactFile(
    target,
    String(pair.contentSerialized),
    String(pair.contentIdentity),
  );
  exactFile(
    targetCommit,
    String(pair.commitSerialized),
    String(pair.commitIdentity),
  );
  fs.rmSync(anchor);
  return readCommittedDockerRecoveryJson(target, String(pair.logicalKey));
}

function validCleanupEntry(value: unknown) {
  if (!exactKeys(value, ["name", "type", "hash", "identity", "bytes"]))
    return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === "string" &&
    path.basename(entry.name) === entry.name &&
    (entry.type === "file" || entry.type === "empty_directory") &&
    typeof entry.hash === "string" &&
    /^[a-f0-9]{64}$/u.test(entry.hash) &&
    typeof entry.identity === "string" &&
    Number.isSafeInteger(entry.bytes) &&
    Number(entry.bytes) >= 0
  );
}

function validateIntentSnapshot(anchor: string) {
  const value = readIntentAnchor(anchor);
  if (value.schema === "crdd-coordinator-durable-json-delete/v1") {
    if (
      !exactKeys(value, ["schema", "parentIdentity", "pair"]) ||
      stableDirectoryIdentity(path.dirname(anchor)) !== value.parentIdentity ||
      !validPairEvidence(value.pair)
    )
      throw new Error("docker_recovery_delete_intent_invalid");
    validateIntentAnchorName(anchor, value);
    return value;
  }
  if (value.schema === "crdd-coordinator-durable-json-move/v1") {
    if (
      !exactKeys(value, [
        "schema",
        "sourceParentIdentity",
        "targetParentIdentity",
        "targetDirectory",
        "pair",
        "targetContentName",
        "targetCommitName",
      ]) ||
      stableDirectoryIdentity(path.dirname(anchor)) !==
        value.sourceParentIdentity ||
      typeof value.targetDirectory !== "string" ||
      !path.isAbsolute(value.targetDirectory) ||
      stableDirectoryIdentity(value.targetDirectory) !==
        value.targetParentIdentity ||
      !validPairEvidence(value.pair) ||
      typeof value.targetContentName !== "string" ||
      path.basename(value.targetContentName) !== value.targetContentName ||
      value.targetCommitName !== `${value.targetContentName}${COMMIT_SUFFIX}`
    )
      throw new Error("docker_recovery_move_intent_invalid");
    validateIntentAnchorName(anchor, value);
    return value;
  }
  if (
    value.schema !== "crdd-coordinator-recovery-cleanup-delete/v1" ||
    !exactKeys(value, [
      "schema",
      "rootIdentity",
      "cleanupName",
      "cleanupIdentity",
      "recoveryId",
      "runtimeStateBinding",
      "entries",
    ]) ||
    stableDirectoryIdentity(path.dirname(anchor)) !== value.rootIdentity ||
    typeof value.cleanupName !== "string" ||
    path.basename(value.cleanupName) !== value.cleanupName ||
    typeof value.cleanupIdentity !== "string" ||
    typeof value.recoveryId !== "string" ||
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      value.recoveryId,
    ) ||
    !validRuntimeStateBindingEvidence(value.runtimeStateBinding) ||
    !Array.isArray(value.entries) ||
    value.entries.length > 100 ||
    !value.entries.every(validCleanupEntry)
  )
    throw new Error("docker_recovery_cleanup_intent_invalid");
  validateIntentAnchorName(anchor, value);
  const cleanupDirectory = path.join(path.dirname(anchor), value.cleanupName);
  if (fs.existsSync(cleanupDirectory)) {
    if (stableDirectoryIdentity(cleanupDirectory) !== value.cleanupIdentity)
      throw new Error("docker_recovery_cleanup_intent_third_state");
    const expected = new Map(
      (value.entries as Array<Record<string, unknown>>).map((entry) => [
        String(entry.name),
        entry,
      ]),
    );
    for (const name of fs.readdirSync(cleanupDirectory)) {
      const entry = expected.get(name);
      if (!entry) throw new Error("docker_recovery_cleanup_intent_third_state");
      const target = path.join(cleanupDirectory, name);
      const metadata = fs.lstatSync(target, { bigint: true });
      if (identityText(identityOf(metadata)) !== entry.identity)
        throw new Error("docker_recovery_cleanup_intent_third_state");
      if (entry.type === "file") {
        const observed = readStableFile(target);
        if (
          hashText(observed.serialized) !== entry.hash ||
          Buffer.byteLength(observed.serialized, "utf8") !== entry.bytes
        )
          throw new Error("docker_recovery_cleanup_intent_third_state");
      } else if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0
      )
        throw new Error("docker_recovery_cleanup_intent_third_state");
    }
  }
  return value;
}

function resumeCleanupAnchor(anchor: string) {
  const intent = readIntentAnchor(anchor);
  if (
    !exactKeys(intent, [
      "schema",
      "rootIdentity",
      "cleanupName",
      "cleanupIdentity",
      "recoveryId",
      "runtimeStateBinding",
      "entries",
    ]) ||
    intent.schema !== "crdd-coordinator-recovery-cleanup-delete/v1" ||
    stableDirectoryIdentity(path.dirname(anchor)) !== intent.rootIdentity ||
    typeof intent.cleanupName !== "string" ||
    path.basename(intent.cleanupName) !== intent.cleanupName ||
    typeof intent.cleanupIdentity !== "string" ||
    typeof intent.recoveryId !== "string" ||
    !validRuntimeStateBindingEvidence(intent.runtimeStateBinding) ||
    !Array.isArray(intent.entries) ||
    intent.entries.length > 100 ||
    !intent.entries.every(validCleanupEntry)
  )
    throw new Error("docker_recovery_cleanup_intent_invalid");
  const cleanupDirectory = path.join(
    path.dirname(anchor),
    String(intent.cleanupName),
  );
  if (!fs.existsSync(cleanupDirectory)) {
    if (classifyCleanupDirectoryState(false, false, false, 0) !== "complete")
      throw new Error("docker_recovery_cleanup_intent_third_state");
    fs.rmSync(anchor);
    return true;
  }
  if (stableDirectoryIdentity(cleanupDirectory) !== intent.cleanupIdentity)
    throw new Error("docker_recovery_cleanup_intent_third_state");
  const expected = new Map(
    (intent.entries as Array<Record<string, unknown>>).map((entry) => [
      String(entry.name),
      entry,
    ]),
  );
  for (const observedName of fs.readdirSync(cleanupDirectory)) {
    if (!expected.has(observedName))
      throw new Error("docker_recovery_cleanup_intent_third_state");
  }
  if (
    classifyCleanupDirectoryState(
      true,
      false,
      false,
      fs.readdirSync(cleanupDirectory).length,
    ) === "third_state"
  )
    throw new Error("docker_recovery_cleanup_intent_third_state");
  for (const entry of expected.values()) {
    const target = path.join(cleanupDirectory, String(entry.name));
    if (!fs.existsSync(target)) continue;
    const metadata = fs.lstatSync(target, { bigint: true });
    if (identityText(identityOf(metadata)) !== entry.identity)
      throw new Error("docker_recovery_cleanup_intent_third_state");
    if (entry.type === "empty_directory") {
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0 ||
        entry.bytes !== 0
      )
        throw new Error("docker_recovery_cleanup_intent_third_state");
      fs.rmdirSync(target);
      continue;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new Error("docker_recovery_cleanup_intent_third_state");
    const observed = readStableFile(target);
    if (
      hashText(observed.serialized) !== entry.hash ||
      Buffer.byteLength(observed.serialized, "utf8") !== entry.bytes
    )
      throw new Error("docker_recovery_cleanup_intent_third_state");
    fs.rmSync(target);
  }
  if (fs.readdirSync(cleanupDirectory).length !== 0)
    throw new Error("docker_recovery_cleanup_incomplete");
  fs.rmdirSync(cleanupDirectory);
  fs.rmSync(anchor);
  return true;
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
  const sourceDirectory = path.dirname(source.target);
  const targetDirectory = path.dirname(target);
  const pair = committedPairEvidence(source);
  const digest = hashText(
    `${source.target}\0${target}\0${source.hash}\0${source.identityText}`,
  );
  const anchor = path.join(sourceDirectory, `${MOVE_PREFIX}${digest}.json`);
  if (
    !fs.existsSync(anchor) &&
    !fs.existsSync(`${anchor}${INTENT_PENDING_SUFFIX}`) &&
    (fs.existsSync(target) || fs.existsSync(targetCommit))
  )
    throw new Error("docker_recovery_record_already_exists");
  writeIntentAnchor(
    anchor,
    Object.freeze({
      schema: "crdd-coordinator-durable-json-move/v1",
      sourceParentIdentity: stableDirectoryIdentity(sourceDirectory),
      targetParentIdentity: stableDirectoryIdentity(targetDirectory),
      targetDirectory,
      pair,
      targetContentName: path.basename(target),
      targetCommitName: path.basename(targetCommit),
    }),
  );
  return resumeMoveAnchor(anchor);
}

export function removeCommittedDockerRecoveryJson(
  file: string,
  expectedLogicalKey = path.basename(file),
) {
  const source = readCommittedDockerRecoveryJson(file, expectedLogicalKey);
  const directory = path.dirname(file);
  const digest = hashText(
    `${path.basename(file)}\0${source.hash}\0${source.identityText}`,
  );
  const anchor = path.join(directory, `${DELETE_PREFIX}${digest}.json`);
  writeIntentAnchor(
    anchor,
    Object.freeze({
      schema: "crdd-coordinator-durable-json-delete/v1",
      parentIdentity: stableDirectoryIdentity(directory),
      pair: committedPairEvidence(source),
    }),
  );
  return resumeDeleteAnchor(anchor);
}

export function removeExactUncommittedDockerRecoveryJson(
  file: string,
  expectedValue: unknown,
) {
  const commit = `${file}${COMMIT_SUFFIX}`;
  const observe = (target: string) => {
    try {
      return fs.lstatSync(target, { bigint: true });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw new Error("docker_recovery_uncommitted_record_observation_unknown");
    }
  };
  if (observe(file) === null || observe(commit) !== null)
    throw new Error("docker_recovery_uncommitted_record_state_invalid");
  const parentIdentity = stableDirectoryIdentity(path.dirname(file));
  const expectedSerialized = canonical(expectedValue);
  const before = readStableFile(file);
  if (before.serialized !== expectedSerialized)
    throw new Error("docker_recovery_uncommitted_record_mismatch");
  const beforeIdentity = identityText(before.identity);
  const immediatelyBeforeRemoval = readStableFile(file);
  if (
    immediatelyBeforeRemoval.serialized !== expectedSerialized ||
    identityText(immediatelyBeforeRemoval.identity) !== beforeIdentity ||
    observe(commit) !== null ||
    stableDirectoryIdentity(path.dirname(file)) !== parentIdentity
  )
    throw new Error("docker_recovery_uncommitted_record_changed");
  fs.unlinkSync(file);
  if (
    observe(file) !== null ||
    observe(commit) !== null ||
    stableDirectoryIdentity(path.dirname(file)) !== parentIdentity
  )
    throw new Error("docker_recovery_uncommitted_record_removal_unknown");
  return true;
}

export function isDockerRecoveryJournalIntentName(name: string) {
  return /^(?:\.crdd-delete-|\.crdd-move-|\.crdd-cleanup-)[a-f0-9]{64}\.json(?:\.pending)?$/u.test(
    name,
  );
}

export function removeDockerRecoveryCleanupDirectory(
  rootDirectory: string,
  cleanupDirectory: string,
  recoveryId: string,
  runtimeStateBinding: Readonly<{
    runtimeStateIdentityHash: string;
    runtimeStateProtectionHash: string;
    localUserBindingHash: string;
    runtimeStateBindingHash: string;
  }>,
) {
  if (
    path.dirname(cleanupDirectory) !== rootDirectory ||
    path.basename(cleanupDirectory) === cleanupDirectory ||
    typeof recoveryId !== "string" ||
    recoveryId.length > 240 ||
    !validRuntimeStateBindingEvidence(runtimeStateBinding)
  )
    throw new Error("docker_recovery_cleanup_intent_invalid");
  const cleanupIdentity = stableDirectoryIdentity(cleanupDirectory);
  const entries = fs.readdirSync(cleanupDirectory, { withFileTypes: true });
  if (entries.length > 100)
    throw new Error("docker_recovery_cleanup_entry_limit_exceeded");
  const evidence = entries
    .map((entry) => {
      const target = path.join(cleanupDirectory, entry.name);
      const metadata = fs.lstatSync(target, { bigint: true });
      const identity = identityText(identityOf(metadata));
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (fs.readdirSync(target).length !== 0)
          throw new Error("docker_recovery_cleanup_intent_invalid");
        return Object.freeze({
          name: entry.name,
          type: "empty_directory" as const,
          hash: hashText(""),
          identity,
          bytes: 0,
        });
      }
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new Error("docker_recovery_cleanup_intent_invalid");
      const observed = readStableFile(target);
      return Object.freeze({
        name: entry.name,
        type: "file" as const,
        hash: hashText(observed.serialized),
        identity,
        bytes: Buffer.byteLength(observed.serialized, "utf8"),
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const digest = hashText(
    `${path.basename(cleanupDirectory)}\0${cleanupIdentity}\0${recoveryId}`,
  );
  const anchor = path.join(rootDirectory, `${CLEANUP_PREFIX}${digest}.json`);
  writeIntentAnchor(
    anchor,
    Object.freeze({
      schema: "crdd-coordinator-recovery-cleanup-delete/v1",
      rootIdentity: stableDirectoryIdentity(rootDirectory),
      cleanupName: path.basename(cleanupDirectory),
      cleanupIdentity,
      recoveryId,
      runtimeStateBinding,
      entries: Object.freeze(evidence),
    }),
  );
  return resumeCleanupAnchor(anchor);
}

export function resumeDockerRecoveryJournalDirectory(directory: string) {
  stableDirectoryIdentity(directory);
  const names = fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort();
  for (const name of names) {
    if (name.endsWith(INTENT_PENDING_SUFFIX)) {
      const anchor = path.join(
        directory,
        name.slice(0, -INTENT_PENDING_SUFFIX.length),
      );
      if (fs.existsSync(anchor))
        throw new Error("docker_recovery_intent_third_state");
      fs.renameSync(path.join(directory, name), anchor);
    }
  }
  const anchors = fs
    .readdirSync(directory)
    .filter(
      (name) =>
        isDockerRecoveryJournalIntentName(name) &&
        !name.endsWith(INTENT_PENDING_SUFFIX),
    )
    .sort();
  for (const name of anchors) {
    const anchor = path.join(directory, name);
    const value = readIntentAnchor(anchor);
    if (value.schema === "crdd-coordinator-durable-json-delete/v1")
      resumeDeleteAnchor(anchor);
    else if (value.schema === "crdd-coordinator-durable-json-move/v1")
      resumeMoveAnchor(anchor);
    else if (value.schema === "crdd-coordinator-recovery-cleanup-delete/v1")
      resumeCleanupAnchor(anchor);
    else throw new Error("docker_recovery_intent_invalid");
  }
  return true;
}

/**
 * RuntimeState recovery is authorized for one exact recovery generation.  The
 * root lock serializes inventory changes, but it does not authorize one task
 * to advance another task's journal.  Validate the entire bounded inventory
 * before the first mutation, then resume only anchors bound to the requested
 * recovery ID.  Non-target anchors are checked again byte-for-byte and by
 * filesystem identity before returning.
 */
export function resumeDockerRecoveryJournalDirectoryForRecovery(
  directory: string,
  recoveryId: string,
  runtimeStateBinding: Readonly<{
    runtimeStateIdentityHash: string;
    runtimeStateProtectionHash: string;
    localUserBindingHash: string;
    runtimeStateBindingHash: string;
  }>,
) {
  stableDirectoryIdentity(directory);
  if (
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      recoveryId,
    ) ||
    !validRuntimeStateBindingEvidence(runtimeStateBinding)
  )
    throw new Error("docker_recovery_target_invalid");
  const snapshots = fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()
    .map((name) => {
      const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
        ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
        : name;
      if (
        name.endsWith(INTENT_PENDING_SUFFIX) &&
        fs.existsSync(path.join(directory, anchorName))
      )
        throw new Error("docker_recovery_intent_third_state");
      const anchor = path.join(directory, name);
      const stable = readStableFile(anchor);
      const value = validateIntentSnapshot(anchor);
      const intentRecoveryId = recoveryIdFromIntent(value);
      if (!intentRecoveryId)
        throw new Error("docker_recovery_intent_recovery_id_missing");
      return Object.freeze({
        name,
        anchorName,
        serialized: stable.serialized,
        identity: identityText(stable.identity),
        value,
        target: intentRecoveryId === recoveryId,
      });
    });
  const targetBinding = resolveRuntimeStateBindingForRecovery(
    directory,
    recoveryId,
    snapshots.map((snapshot) => snapshot.value),
  );
  if (!sameRuntimeStateBindingEvidence(targetBinding, runtimeStateBinding))
    throw new Error("docker_recovery_target_binding_mismatch");
  for (const snapshot of snapshots) {
    if (!snapshot.target) continue;
    let anchor = path.join(directory, snapshot.name);
    if (snapshot.name.endsWith(INTENT_PENDING_SUFFIX)) {
      const finalAnchor = path.join(directory, snapshot.anchorName);
      if (fs.existsSync(finalAnchor))
        throw new Error("docker_recovery_intent_third_state");
      fs.renameSync(anchor, finalAnchor);
      anchor = finalAnchor;
    }
    const value = readIntentAnchor(anchor);
    if (recoveryIdFromIntent(value) !== recoveryId)
      throw new Error("docker_recovery_target_changed");
    if (value.schema === "crdd-coordinator-durable-json-delete/v1")
      resumeDeleteAnchor(anchor);
    else if (value.schema === "crdd-coordinator-durable-json-move/v1")
      resumeMoveAnchor(anchor);
    else if (value.schema === "crdd-coordinator-recovery-cleanup-delete/v1")
      resumeCleanupAnchor(anchor);
    else throw new Error("docker_recovery_intent_invalid");
  }
  for (const snapshot of snapshots) {
    if (snapshot.target) continue;
    const anchor = path.join(directory, snapshot.name);
    const current = readStableFile(anchor);
    if (
      current.serialized !== snapshot.serialized ||
      identityText(current.identity) !== snapshot.identity
    )
      throw new Error("docker_recovery_non_target_intent_changed");
  }
  return true;
}

export function inspectDockerRecoveryMoveJournalForRecovery(
  directory: string,
  recoveryId: string,
  logicalKey: string,
  targetDirectory: string,
  targetContentName: string,
) {
  stableDirectoryIdentity(directory);
  stableDirectoryIdentity(targetDirectory);
  if (
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      recoveryId,
    ) ||
    path.basename(targetContentName) !== targetContentName
  )
    throw new Error("docker_recovery_target_invalid");
  const matches = fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()
    .flatMap((name) => {
      const anchor = path.join(directory, name);
      const value = validateIntentSnapshot(anchor);
      if (value.schema !== "crdd-coordinator-durable-json-move/v1") return [];
      const inspected = inspectMoveAnchorState(anchor);
      if (
        recoveryIdFromIntent(value) !== recoveryId ||
        inspected.record.logicalKey !== logicalKey ||
        inspected.targetDirectory !== targetDirectory ||
        value.targetContentName !== targetContentName ||
        value.targetCommitName !== dockerRecoveryCommitName(targetContentName)
      )
        return [];
      return [
        Object.freeze({
          ...inspected.record,
          moveState: inspected.state,
        }),
      ];
    });
  const match = matches[0];
  if (matches.length !== 1 || !match)
    throw new Error("docker_recovery_move_target_unverified");
  return match;
}

export function inspectDockerRecoveryJournalDirectory(directory: string) {
  stableDirectoryIdentity(directory);
  const values: Array<
    Readonly<{
      schema: string;
      recoveryId: string | null;
      name: string;
      runtimeStateBinding: Readonly<Record<string, unknown>> | null;
      pairLogicalKey: string | null;
      pairContentName: string | null;
      pairCommitName: string | null;
      targetContentName: string | null;
      targetCommitName: string | null;
      moveState: "move_content" | "move_commit" | "complete" | null;
    }>
  > = [];
  for (const name of fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()) {
    const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
      ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
      : name;
    if (
      name.endsWith(INTENT_PENDING_SUFFIX) &&
      fs.existsSync(path.join(directory, anchorName))
    )
      throw new Error("docker_recovery_intent_third_state");
    const value = validateIntentSnapshot(path.join(directory, name));
    const schema = typeof value.schema === "string" ? value.schema : "";
    if (
      schema !== "crdd-coordinator-durable-json-delete/v1" &&
      schema !== "crdd-coordinator-durable-json-move/v1" &&
      schema !== "crdd-coordinator-recovery-cleanup-delete/v1"
    )
      throw new Error("docker_recovery_intent_invalid");
    const moveInspection =
      schema === "crdd-coordinator-durable-json-move/v1"
        ? inspectMoveAnchorState(path.join(directory, name))
        : null;
    values.push(
      Object.freeze({
        schema,
        recoveryId: recoveryIdFromIntent(value),
        name,
        runtimeStateBinding:
          schema === "crdd-coordinator-recovery-cleanup-delete/v1"
            ? (value.runtimeStateBinding as Readonly<Record<string, unknown>>)
            : null,
        pairLogicalKey:
          schema === "crdd-coordinator-durable-json-delete/v1" ||
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String((value.pair as Record<string, unknown>).logicalKey)
            : null,
        pairContentName:
          schema === "crdd-coordinator-durable-json-delete/v1" ||
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String((value.pair as Record<string, unknown>).contentName)
            : null,
        pairCommitName:
          schema === "crdd-coordinator-durable-json-delete/v1" ||
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String((value.pair as Record<string, unknown>).commitName)
            : null,
        targetContentName:
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String(value.targetContentName)
            : null,
        targetCommitName:
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String(value.targetCommitName)
            : null,
        moveState: moveInspection?.state ?? null,
      }),
    );
  }
  return Object.freeze(values);
}

export function discoverDockerRecoveryJournalJson(
  directory: string,
  logicalKey: string,
) {
  stableDirectoryIdentity(directory);
  const matches: DiscoveredJournalJson[] = [];
  for (const name of fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()) {
    const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
      ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
      : name;
    if (
      name.endsWith(INTENT_PENDING_SUFFIX) &&
      fs.existsSync(path.join(directory, anchorName))
    )
      throw new Error("docker_recovery_intent_third_state");
    const value = validateIntentSnapshot(path.join(directory, name));
    if (
      (value.schema !== "crdd-coordinator-durable-json-move/v1" &&
        value.schema !== "crdd-coordinator-durable-json-delete/v1") ||
      !validPairEvidence(value.pair)
    )
      continue;
    const pair = value.pair as Record<string, unknown>;
    if (pair.logicalKey !== logicalKey) continue;
    const serialized = String(pair.contentSerialized);
    const parsed = JSON.parse(serialized);
    if (canonical(parsed) !== serialized)
      throw new Error("docker_recovery_intent_noncanonical");
    matches.push(
      Object.freeze({
        serialized,
        hash: String(pair.contentHash),
        identityText: String(pair.contentIdentity),
        logicalKey,
        value: parsed,
      }),
    );
  }
  if (matches.length > 1) throw new Error("docker_recovery_intent_third_state");
  return matches[0] ?? null;
}

export function discoverDockerRecoveryJournalJsonForRecovery(
  directory: string,
  logicalKey: string,
  recoveryId: string,
) {
  stableDirectoryIdentity(directory);
  if (
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(recoveryId)
  )
    throw new Error("docker_recovery_target_invalid");
  const matches: DiscoveredJournalJson[] = [];
  for (const name of fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()) {
    const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
      ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
      : name;
    if (
      name.endsWith(INTENT_PENDING_SUFFIX) &&
      fs.existsSync(path.join(directory, anchorName))
    )
      throw new Error("docker_recovery_intent_third_state");
    const value = validateIntentSnapshot(path.join(directory, name));
    if (
      (value.schema !== "crdd-coordinator-durable-json-move/v1" &&
        value.schema !== "crdd-coordinator-durable-json-delete/v1") ||
      !validPairEvidence(value.pair)
    )
      continue;
    const pair = value.pair as Record<string, unknown>;
    if (
      pair.logicalKey !== logicalKey ||
      recoveryIdFromIntent(value) !== recoveryId
    )
      continue;
    const serialized = String(pair.contentSerialized);
    const parsed = JSON.parse(serialized);
    if (canonical(parsed) !== serialized)
      throw new Error("docker_recovery_intent_noncanonical");
    matches.push(
      Object.freeze({
        serialized,
        hash: String(pair.contentHash),
        identityText: String(pair.contentIdentity),
        logicalKey,
        value: parsed,
      }),
    );
  }
  if (matches.length > 1) throw new Error("docker_recovery_intent_third_state");
  return matches[0] ?? null;
}

export function describeDockerRecoveryJournalContract() {
  return Object.freeze({
    commitSchema: "crdd-coordinator-durable-json-commit/v1",
    processCrashBoundary:
      "fsynced_temp_atomic_rename_then_fsynced_commit_atomic_rename",
    uncommittedFinalTreatment: "retain_and_fail_closed",
    orphanTemporaryTreatment: "retain_and_fail_closed",
    deleteBoundary: "single_atomic_anchor_then_target_commit_anchor",
    moveBoundary: "single_atomic_anchor_then_content_commit_anchor",
    runtimeStateResumeAuthority:
      "exact_recovery_id_and_creation_binding_non_target_unchanged",
    powerLossDurabilityClaimed: false,
  });
}
