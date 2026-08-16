import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { encodePlatformProvisionerActiveReleaseCandidate } from "./platform-provisioner-active-release.ts";
import {
  loadPlatformProvisionerActiveReleaseForEffect,
  persistPlatformProvisionerActiveReleaseForEffect,
  recoverPlatformProvisionerActiveReleaseForEffect,
} from "./platform-provisioner-active-release-store.ts";
import { PLATFORM_PROVISIONER_TRANSACTION_FILE } from "./platform-provisioner-install-layout.ts";
import { encodePlatformProvisionerReleaseFloorCandidate } from "./platform-provisioner-release-floor.ts";
import {
  loadPlatformProvisionerReleaseFloorForEffect,
  persistPlatformProvisionerReleaseFloorForEffect,
  recoverPlatformProvisionerReleaseFloorForEffect,
} from "./platform-provisioner-release-floor-store.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

const CONTRACT = "crdd-coordinator/platform-provisioner-state-transaction";
const REVISION = 1;
const DOMAIN = "CRDD\0PLATFORM-PROVISIONER-STATE-TRANSACTION\0V1\0";
const STATE_DIRECTORY = "state";
const MAXIMUM_BYTES = 24_576;
const TRANSACTION_KEYS = new Set([
  "contract",
  "contractRevision",
  "previousFloorHash",
  "previousActiveHash",
  "nextFloor",
  "nextActiveRelease",
  "transactionHash",
]);
const INPUT_KEYS = new Set([
  "previousFloorHash",
  "previousActiveHash",
  "nextFloor",
  "nextActiveRelease",
]);
const HEX64 = /^[0-9a-f]{64}$/u;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function blocked(reason: string, isRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    transactionHash: null,
    persistenceCompleted: false,
    recoveryRequired: isRecoveryRequired,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

function nullableHash(value: unknown) {
  return value === null || (typeof value === "string" && HEX64.test(value));
}

function valueWithoutHash(
  previousFloorHash: string | null,
  previousActiveHash: string | null,
  nextFloor: Readonly<Record<string, unknown>>,
  nextActiveRelease: Readonly<Record<string, unknown>>,
) {
  return Object.freeze({
    contract: CONTRACT,
    contractRevision: REVISION,
    previousFloorHash,
    previousActiveHash,
    nextFloor,
    nextActiveRelease,
  });
}

function transactionHash(value: ReturnType<typeof valueWithoutHash>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(value);
  if (canonical.status !== "candidate") return null;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return createHash("sha256")
    .update(Buffer.from(DOMAIN, "ascii"))
    .update(length)
    .update(canonical.canonicalBytes)
    .digest("hex");
}

function normalize(raw: unknown) {
  const value = snapshotPlainRecord(raw, TRANSACTION_KEYS);
  if (
    !value ||
    value.contract !== CONTRACT ||
    value.contractRevision !== REVISION ||
    !nullableHash(value.previousFloorHash) ||
    !nullableHash(value.previousActiveHash) ||
    typeof value.transactionHash !== "string" ||
    !HEX64.test(value.transactionHash)
  ) {
    return null;
  }
  const floor = encodePlatformProvisionerReleaseFloorCandidate(value.nextFloor);
  const active = encodePlatformProvisionerActiveReleaseCandidate(
    value.nextActiveRelease,
  );
  if (
    floor.status !== "candidate" ||
    active.status !== "candidate" ||
    floor.floor.releaseSequence !== active.activeRelease.releaseSequence ||
    floor.floor.floorHash !== active.activeRelease.floorHash
  ) {
    return null;
  }
  const core = valueWithoutHash(
    value.previousFloorHash as string | null,
    value.previousActiveHash as string | null,
    floor.floor,
    active.activeRelease,
  );
  const calculatedHash = transactionHash(core);
  return calculatedHash === value.transactionHash
    ? Object.freeze({ ...core, transactionHash: calculatedHash })
    : null;
}

function encode(raw: unknown) {
  const normalized = normalize(raw);
  if (!normalized) return null;
  const canonical = canonicalizeProvisioningJsonValueCandidate(normalized);
  return canonical.status === "candidate" &&
    canonical.canonicalBytes.length <= MAXIMUM_BYTES
    ? Object.freeze({
        transaction: normalized,
        canonicalBytes: Buffer.from(canonical.canonicalBytes),
      })
    : null;
}

function create(raw: unknown) {
  const input = snapshotPlainRecord(raw, INPUT_KEYS);
  if (
    !input ||
    !nullableHash(input.previousFloorHash) ||
    !nullableHash(input.previousActiveHash)
  ) {
    return null;
  }
  const floor = encodePlatformProvisionerReleaseFloorCandidate(input.nextFloor);
  const active = encodePlatformProvisionerActiveReleaseCandidate(
    input.nextActiveRelease,
  );
  if (
    floor.status !== "candidate" ||
    active.status !== "candidate" ||
    floor.floor.floorHash !== active.activeRelease.floorHash
  ) {
    return null;
  }
  const core = valueWithoutHash(
    input.previousFloorHash as string | null,
    input.previousActiveHash as string | null,
    floor.floor,
    active.activeRelease,
  );
  const hash = transactionHash(core);
  return hash ? encode({ ...core, transactionHash: hash }) : null;
}

function paths(stateRoot: unknown) {
  if (
    typeof stateRoot !== "string" ||
    !path.isAbsolute(stateRoot) ||
    path.basename(stateRoot) !== STATE_DIRECTORY ||
    path.resolve(stateRoot) !== stateRoot
  ) {
    return null;
  }
  const metadata = fs.lstatSync(stateRoot);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
  const target = path.join(stateRoot, PLATFORM_PROVISIONER_TRANSACTION_FILE);
  return Object.freeze({ target, pending: `${target}.pending` });
}

function read(target: string) {
  const metadata = fs.lstatSync(target);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < 1 ||
    metadata.size > MAXIMUM_BYTES
  )
    return null;
  const bytes = fs.readFileSync(target);
  if (bytes.length !== metadata.size) return null;
  const parsed = JSON.parse(utf8Decoder.decode(bytes));
  const encoded = encode(parsed);
  return encoded && Buffer.prototype.equals.call(bytes, encoded.canonicalBytes)
    ? encoded.transaction
    : null;
}

function currentHashes(stateRoot: string) {
  const floor = loadPlatformProvisionerReleaseFloorForEffect(stateRoot);
  const active = loadPlatformProvisionerActiveReleaseForEffect(stateRoot);
  return floor.status === "candidate" && active.status === "candidate"
    ? Object.freeze({ floor, active })
    : null;
}

function complete(
  stateRoot: string,
  transaction: NonNullable<ReturnType<typeof normalize>>,
) {
  recoverPlatformProvisionerReleaseFloorForEffect(stateRoot);
  recoverPlatformProvisionerActiveReleaseForEffect(stateRoot);
  const current = currentHashes(stateRoot);
  if (!current) return blocked("state_transaction_state_recovery_failed", true);
  if (
    current.floor.floorHash !== transaction.previousFloorHash &&
    current.floor.floorHash !== transaction.nextFloor.floorHash
  )
    return blocked("state_transaction_floor_conflict", true);
  if (
    current.active.activeHash !== transaction.previousActiveHash &&
    current.active.activeHash !== transaction.nextActiveRelease.activeHash
  )
    return blocked("state_transaction_active_conflict", true);
  if (current.floor.floorHash !== transaction.nextFloor.floorHash) {
    const persisted = persistPlatformProvisionerReleaseFloorForEffect(
      stateRoot,
      transaction.nextFloor,
    );
    if (persisted.status !== "candidate")
      return blocked("state_transaction_floor_persistence_failed", true);
  }
  if (current.active.activeHash !== transaction.nextActiveRelease.activeHash) {
    const persisted = persistPlatformProvisionerActiveReleaseForEffect(
      stateRoot,
      transaction.nextActiveRelease,
    );
    if (persisted.status !== "candidate")
      return blocked("state_transaction_active_persistence_failed", true);
  }
  const confirmed = currentHashes(stateRoot);
  if (
    !confirmed ||
    confirmed.floor.floorHash !== transaction.nextFloor.floorHash ||
    confirmed.active.activeHash !== transaction.nextActiveRelease.activeHash
  )
    return blocked("state_transaction_reread_mismatch", true);
  return Object.freeze({
    status: "candidate" as const,
    reason: "state_transaction_committed_and_reread",
    transactionHash: transaction.transactionHash,
    persistenceCompleted: true,
    recoveryRequired: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: true,
  });
}

export function persistPlatformProvisionerStateTransactionForEffect(
  stateRoot: unknown,
  rawInput: unknown,
) {
  try {
    const statePaths = paths(stateRoot);
    const encoded = create(rawInput);
    if (!statePaths || !encoded)
      return blocked("state_transaction_input_invalid");
    if (fs.existsSync(statePaths.target) || fs.existsSync(statePaths.pending)) {
      return blocked("state_transaction_recovery_required", true);
    }
    const handle = fs.openSync(statePaths.pending, "wx", 0o600);
    try {
      fs.writeFileSync(handle, encoded.canonicalBytes);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    fs.renameSync(statePaths.pending, statePaths.target);
    const result = complete(stateRoot as string, encoded.transaction);
    if (result.status !== "candidate") return result;
    fs.unlinkSync(statePaths.target);
    return result;
  } catch {
    return blocked("state_transaction_persistence_failed", true);
  }
}

export function recoverPlatformProvisionerStateTransactionForEffect(
  stateRoot: unknown,
) {
  try {
    const statePaths = paths(stateRoot);
    if (!statePaths) return blocked("state_transaction_root_invalid");
    if (
      fs.existsSync(statePaths.pending) &&
      !fs.existsSync(statePaths.target)
    ) {
      const pending = read(statePaths.pending);
      if (!pending) return blocked("state_transaction_pending_invalid", true);
      fs.renameSync(statePaths.pending, statePaths.target);
    }
    if (!fs.existsSync(statePaths.target)) {
      return Object.freeze({
        ...blocked("state_transaction_absent"),
        status: "candidate" as const,
      });
    }
    const transaction = read(statePaths.target);
    if (!transaction) return blocked("state_transaction_invalid", true);
    const result = complete(stateRoot as string, transaction);
    if (result.status !== "candidate") return result;
    fs.unlinkSync(statePaths.target);
    return Object.freeze({
      ...result,
      reason: "state_transaction_recovered_and_reread",
    });
  } catch {
    return blocked("state_transaction_recovery_failed", true);
  }
}

export function describePlatformProvisionerStateTransactionContract() {
  return Object.freeze({
    contract: CONTRACT,
    contractRevision: REVISION,
    path: "state/provision-transaction.json",
    persistence: "implemented_candidate",
    recovery: "explicit_provision_recovery_before_new_transition",
    commitOrder: "floor_then_active_with_durable_transaction_intent",
    runtimeBehaviorWhilePending: "blocked_until_explicit_provision_recovery",
    repositoryRuntimeStateRequired: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
