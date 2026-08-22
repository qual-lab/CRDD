import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { verifyOwnedMountCapability } from "./execution-environment.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  compileProviderHomeMountGrantCandidate,
  evaluateProviderHomeMountGrantTransitionCandidate,
  evaluateProviderHomeMountGrantUseCandidate,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
  PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
} from "./provider-home-mount-grant.ts";

const ISSUE_KEYS = new Set([
  "provider",
  "profileId",
  "operationId",
  "providerHomeIdentityHash",
  "providerHomeProtectionHash",
  "localUserBindingHash",
  "lifetimeMs",
]);
const USE_KEYS = new Set([
  "observedProviderHomeIdentityHash",
  "observedProviderHomeProtectionHash",
  "observedLocalUserBindingHash",
]);
const MAXIMUM_RECORD_BYTES = 8 * 1024;
const PROVIDERS = new Set(["codex", "claude"]);
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;

type StoredGrant = Readonly<{
  mountCapability: object;
  target: string;
  lock: string;
  grantRef: string;
  provider: string;
  profileId: string;
  operationId: string;
}>;

const grantStores = new WeakMap<object, StoredGrant>();

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    grantCapability: null,
    mountAuthorizationCapability: null,
    providerHomeMountGrantIssued: false,
    mountAuthorizationIssued: false,
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
    credentialReported: false,
  });
}

function canonicalNow(): string {
  return new Date().toISOString();
}

function grantReference(): string {
  const value = randomBytes(16).readBigUInt64BE();
  return `PHMGRANT-${value.toString().padStart(20, "0")}`;
}

function storeName(operationId: string, profileId: string): string {
  const digest = createHash("sha256")
    .update(`crdd-provider-home-grant-store-v1\0${operationId}\0${profileId}`)
    .digest("hex");
  return `provider-home-mount-grant-${digest}.json`;
}

function validateIssueInput(raw: unknown) {
  const input = snapshotPlainRecord(raw, ISSUE_KEYS);
  if (
    !input ||
    typeof input.provider !== "string" ||
    !PROVIDERS.has(input.provider) ||
    typeof input.profileId !== "string" ||
    !PROFILE_ID.test(input.profileId) ||
    typeof input.operationId !== "string" ||
    !OPERATION_ID.test(input.operationId) ||
    typeof input.providerHomeIdentityHash !== "string" ||
    !HEX64.test(input.providerHomeIdentityHash) ||
    typeof input.providerHomeProtectionHash !== "string" ||
    !HEX64.test(input.providerHomeProtectionHash) ||
    typeof input.localUserBindingHash !== "string" ||
    !HEX64.test(input.localUserBindingHash) ||
    typeof input.lifetimeMs !== "number" ||
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 1 ||
    input.lifetimeMs > PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS
  ) {
    return null;
  }
  return Object.freeze({
    provider: input.provider,
    profileId: input.profileId,
    operationId: input.operationId,
    providerHomeIdentityHash: input.providerHomeIdentityHash,
    providerHomeProtectionHash: input.providerHomeProtectionHash,
    localUserBindingHash: input.localUserBindingHash,
    lifetimeMs: input.lifetimeMs,
  });
}

function atomicWrite(target: string, value: unknown): void {
  const temporary = `${target}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(serialized) > MAXIMUM_RECORD_BYTES) {
    throw new Error("provider_home_mount_grant_store_record_oversized");
  }
  let descriptor: number | null = null;
  let failure: unknown = null;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, serialized, { encoding: "utf8" });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, target);
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
  try {
    if (fs.existsSync(temporary)) fs.rmSync(temporary);
  } catch (error) {
    if (failure === null) failure = error;
  }
  if (failure !== null) throw failure;
}

function readRecord(target: string) {
  const metadata = fs.lstatSync(target);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < 1 ||
    metadata.size > MAXIMUM_RECORD_BYTES
  ) {
    throw new Error("provider_home_mount_grant_store_record_invalid");
  }
  const raw: unknown = JSON.parse(fs.readFileSync(target, "utf8"));
  const compiled = compileProviderHomeMountGrantCandidate(raw);
  if (compiled.status !== "candidate" || !compiled.grant) {
    throw new Error("provider_home_mount_grant_store_record_invalid");
  }
  return compiled.grant;
}

function requireStore(capability: unknown): StoredGrant {
  if (typeof capability !== "object" || capability === null) {
    throw new Error("provider_home_mount_grant_store_capability_required");
  }
  const stored = grantStores.get(capability);
  if (!stored) {
    throw new Error("provider_home_mount_grant_store_capability_required");
  }
  const management = verifyOwnedMountCapability(
    stored.mountCapability,
  ).management;
  if (
    path.dirname(stored.target) !== management ||
    path.dirname(stored.lock) !== management
  ) {
    throw new Error("provider_home_mount_grant_store_replaced");
  }
  return stored;
}

function withStoreLock<T>(stored: StoredGrant, action: () => T): T {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(stored.lock, "wx", 0o600);
    return action();
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (descriptor !== null) fs.rmSync(stored.lock);
  }
}

export function issueProviderHomeMountGrantForEffect(
  mountCapability: unknown,
  raw: unknown,
) {
  try {
    const input = validateIssueInput(raw);
    if (!input) return blocked("provider_home_mount_grant_issue_input_invalid");
    const management = verifyOwnedMountCapability(mountCapability).management;
    const target = path.join(
      management,
      storeName(input.operationId, input.profileId),
    );
    if (typeof mountCapability !== "object" || mountCapability === null) {
      throw new Error("provider_home_mount_grant_store_capability_required");
    }
    const issuedAt = canonicalNow();
    const expiresAt = new Date(
      Date.parse(issuedAt) + input.lifetimeMs,
    ).toISOString();
    const grantRef = grantReference();
    const grant = Object.freeze({
      contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
      contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
      grantRef,
      provider: input.provider,
      profileId: input.profileId,
      operationId: input.operationId,
      providerHomeIdentityHash: input.providerHomeIdentityHash,
      providerHomeProtectionHash: input.providerHomeProtectionHash,
      localUserBindingHash: input.localUserBindingHash,
      state: "issued",
      issuedAt,
      expiresAt,
      consumedAt: null,
      revokedAt: null,
      usageLimit: 1,
      consumptionCount: 0,
    });
    const stored = Object.freeze({
      mountCapability,
      target,
      lock: `${target}.lock`,
      grantRef,
      provider: input.provider,
      profileId: input.profileId,
      operationId: input.operationId,
    });
    const compiled = compileProviderHomeMountGrantCandidate(grant);
    if (compiled.status !== "candidate") {
      throw new Error("provider_home_mount_grant_issue_record_invalid");
    }
    const writeResult = withStoreLock(stored, () => {
      if (fs.existsSync(target)) return false;
      atomicWrite(target, grant);
      return true;
    });
    if (!writeResult) {
      return blocked("provider_home_mount_grant_store_already_exists");
    }
    const capability = Object.freeze({ kind: "provider_home_mount_grant" });
    grantStores.set(capability, stored);
    return Object.freeze({
      ...blocked("provider_home_mount_grant_issued"),
      status: "issued" as const,
      reason: "provider_home_mount_grant_issued",
      grantCapability: capability,
      providerHomeMountGrantIssued: true,
      filesystemEffectIssued: true,
      runtimeAuthorityIssued: true,
    });
  } catch {
    return blocked("provider_home_mount_grant_issue_failed");
  }
}

export function consumeProviderHomeMountGrantForEffect(
  grantCapability: unknown,
  raw: unknown,
) {
  try {
    const observations = snapshotPlainRecord(raw, USE_KEYS);
    if (!observations) {
      return blocked("provider_home_mount_grant_use_observation_invalid");
    }
    const stored = requireStore(grantCapability);
    return withStoreLock(stored, () => {
      const current = readRecord(stored.target);
      const observedAt = canonicalNow();
      const use = evaluateProviderHomeMountGrantUseCandidate({
        grant: current,
        provider: stored.provider,
        profileId: stored.profileId,
        operationId: stored.operationId,
        providerHomeMountGrantRef: stored.grantRef,
        observedProviderHomeIdentityHash:
          observations.observedProviderHomeIdentityHash,
        observedProviderHomeProtectionHash:
          observations.observedProviderHomeProtectionHash,
        observedLocalUserBindingHash: observations.observedLocalUserBindingHash,
        observedAt,
      });
      if (use.status !== "candidate") return blocked(use.reason);
      const next = Object.freeze({
        ...current,
        state: "consumed",
        consumedAt: observedAt,
        consumptionCount: 1,
      });
      const transition = evaluateProviderHomeMountGrantTransitionCandidate({
        previous: current,
        next,
      });
      if (transition.status !== "candidate") return blocked(transition.reason);
      atomicWrite(stored.target, next);
      const mountAuthorizationCapability = Object.freeze({
        kind: "provider_home_mount_authorization",
      });
      grantStores.set(mountAuthorizationCapability, stored);
      return Object.freeze({
        ...blocked("provider_home_mount_grant_consumed"),
        status: "consumed" as const,
        reason: "provider_home_mount_grant_consumed",
        mountAuthorizationCapability,
        providerHomeMountGrantIssued: true,
        mountAuthorizationIssued: true,
        filesystemEffectIssued: true,
        runtimeAuthorityIssued: true,
        operationCapabilityIssued: true,
      });
    });
  } catch {
    return blocked("provider_home_mount_grant_use_failed");
  }
}

export function revokeProviderHomeMountGrantForEffect(
  grantCapability: unknown,
) {
  try {
    const stored = requireStore(grantCapability);
    return withStoreLock(stored, () => {
      const current = readRecord(stored.target);
      if (current.state === "revoked") {
        return blocked("provider_home_mount_grant_already_revoked");
      }
      if (current.state !== "issued" && current.state !== "consumed") {
        return blocked("provider_home_mount_grant_not_revocable");
      }
      const next = Object.freeze({
        ...current,
        state: "revoked",
        revokedAt: canonicalNow(),
      });
      const transition = evaluateProviderHomeMountGrantTransitionCandidate({
        previous: current,
        next,
      });
      if (transition.status !== "candidate") return blocked(transition.reason);
      atomicWrite(stored.target, next);
      grantStores.delete(grantCapability as object);
      return Object.freeze({
        ...blocked("provider_home_mount_grant_revoked"),
        status: "revoked" as const,
        reason: "provider_home_mount_grant_revoked",
        filesystemEffectIssued: true,
        runtimeAuthorityIssued: true,
      });
    });
  } catch {
    return blocked("provider_home_mount_grant_revoke_failed");
  }
}

export function describeProviderHomeMountGrantStoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/provider-home-mount-grant-store",
    contractRevision: 1,
    runtimeOwnedClock: "implemented",
    runtimeOwnedIssuer: "implemented",
    runtimeOwnedAtomicStore: "implemented_operation_management_scope",
    oneTimeConsumption: "implemented",
    explicitRevocation: "implemented",
    operationEndRevocation: "integration_pending",
    mountAdapter: "not_implemented",
    storePathReported: false,
    grantRecordReported: false,
    credentialReported: false,
  });
}
