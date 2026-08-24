import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import { reverifyAuthorityBeforeProviderLaunch } from "./authority-prelaunch-verifier.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { inspectRuntimeOwnedActiveProviderHomeMount } from "./provider-home-mount-grant-runtime.ts";
import { loadRuntimeOwnedLocalPersonalAuthority } from "./local-personal-authority-runtime.ts";

export const PROVIDER_AUTHORITY_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-authority-runtime";
export const PROVIDER_AUTHORITY_RUNTIME_CONTRACT_REVISION = 2;

const AUTHORITY_LIFETIME_MS = 5_000;
const AUTHORITY_RECORD_ID_BYTES = 12;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;

type OperationBinding = Readonly<{
  operationId: string;
  createdAt: string;
}>;
type ActiveMount = Readonly<{
  status: string;
  grantRef: string | null;
  provider?: string;
  profileId?: string;
  operationId?: string;
  providerHomeMountGrantIssued: boolean;
  providerHomeMounted: boolean;
}>;
type ActivatedAuthoritySource = Readonly<{
  profile: unknown;
  bundle: unknown;
  scopeId: string;
}>;
type Verification = Readonly<{
  profileHash: string;
  registryId: string;
  registryRevision: number;
  registryHash: string;
  grantRef: string;
  grantRevision: number;
  provider: string;
  profileId: string;
  operationId: string;
  scopeId: string;
  providerHomeMountGrantRef: string;
  bundleId: string;
  bundleRevision: number;
  bundleHash: string;
  trustPolicyId: string;
  trustPolicyRevision: number;
  trustPolicyHash: string;
  validUntil: string;
}>;
type AuthorityRecord = Readonly<{
  authorityRecordId: string;
  managementCapability: object;
  activeMountCapability: object;
  operation: OperationBinding;
  mount: ActiveMount;
  verification: Verification;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
  controlCapability: object;
  useCapability: object;
}>;
type RuntimeState = Readonly<{
  records: Map<string, AuthorityRecord>;
  controlCapabilities: WeakMap<object, string>;
  useCapabilities: WeakMap<object, string>;
  verifyOperation: (capability: unknown) => OperationBinding;
  inspectActiveMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => ActiveMount;
  loadActivatedAuthority: (
    binding: Readonly<{
      operationId: string;
      provider: string;
      profileId: string;
    }>,
  ) => ActivatedAuthoritySource | null;
  reverify: typeof reverifyAuthorityBeforeProviderLaunch;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
}>;

function createRuntimeState(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
): RuntimeState {
  return Object.freeze({
    records: new Map(),
    controlCapabilities: new WeakMap(),
    useCapabilities: new WeakMap(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperation: verifyOwnedOperationManagementCapability,
  inspectActiveMount: inspectRuntimeOwnedActiveProviderHomeMount,
  loadActivatedAuthority: loadRuntimeOwnedLocalPersonalAuthority,
  reverify: reverifyAuthorityBeforeProviderLaunch,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
});

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    authorityRecordId: null,
    controlCapability: null,
    useCapability: null,
    operationId: null,
    provider: null,
    profileId: null,
    scopeId: null,
    providerHomeMountGrantRef: null,
    runtimeAuthorityIssued: false,
    providerEffectAllowed: false,
    rawAuthoritySourceReported: false,
    pathReported: false,
    credentialReported: false,
  });
}

function performSafely<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return blocked(reason);
  }
}

function removeRecord(state: RuntimeState, record: AuthorityRecord) {
  state.records.delete(record.authorityRecordId);
  state.controlCapabilities.delete(record.controlCapability);
  state.useCapabilities.delete(record.useCapability);
}

function isMountValid(mount: ActiveMount, operation: OperationBinding) {
  return (
    mount.status === "active" &&
    mount.providerHomeMountGrantIssued === true &&
    mount.providerHomeMounted === true &&
    typeof mount.grantRef === "string" &&
    (mount.provider === "codex" || mount.provider === "claude") &&
    typeof mount.profileId === "string" &&
    typeof mount.operationId === "string" &&
    mount.operationId === operation.operationId
  );
}

function normalizeVerification(candidate: unknown): Verification | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Record<string, unknown>;
  const stringKeys = [
    "profileHash",
    "registryId",
    "registryHash",
    "grantRef",
    "provider",
    "profileId",
    "operationId",
    "scopeId",
    "providerHomeMountGrantRef",
    "bundleId",
    "bundleHash",
    "trustPolicyId",
    "trustPolicyHash",
    "validUntil",
  ];
  const numberKeys = [
    "registryRevision",
    "grantRevision",
    "bundleRevision",
    "trustPolicyRevision",
  ];
  if (
    stringKeys.some(
      (key) =>
        !Object.hasOwn(value, key) ||
        typeof value[key] !== "string" ||
        (value[key] as string).length === 0,
    ) ||
    numberKeys.some(
      (key) =>
        !Object.hasOwn(value, key) ||
        typeof value[key] !== "number" ||
        !Number.isSafeInteger(value[key]) ||
        (value[key] as number) < 1,
    ) ||
    !SCOPE_ID.test(value.scopeId as string)
  ) {
    return null;
  }
  return Object.freeze(
    Object.fromEntries(
      [...stringKeys, ...numberKeys].map((key) => [key, value[key]]),
    ),
  ) as Verification;
}

function reverifyCurrentAuthority(
  state: RuntimeState,
  operation: OperationBinding,
  mount: ActiveMount,
) {
  if (!isMountValid(mount, operation)) return null;
  const source = state.loadActivatedAuthority({
    operationId: operation.operationId,
    provider: mount.provider as string,
    profileId: mount.profileId as string,
  });
  if (!source || !SCOPE_ID.test(source.scopeId)) return null;
  const result = state.reverify(source.profile, source.bundle, {
    provider: mount.provider,
    profileId: mount.profileId,
    operationId: operation.operationId,
    scopeId: source.scopeId,
    providerHomeMountGrantRef: mount.grantRef,
  });
  if (result.status !== "candidate" || !result.verification) return null;
  const verification = normalizeVerification(result.verification);
  if (
    !verification ||
    verification.provider !== mount.provider ||
    verification.profileId !== mount.profileId ||
    verification.operationId !== operation.operationId ||
    verification.scopeId !== source.scopeId ||
    verification.providerHomeMountGrantRef !== mount.grantRef
  ) {
    return null;
  }
  return verification;
}

function verificationIdentity(verification: Verification) {
  return JSON.stringify({
    profileHash: verification.profileHash,
    registryId: verification.registryId,
    registryRevision: verification.registryRevision,
    registryHash: verification.registryHash,
    grantRef: verification.grantRef,
    grantRevision: verification.grantRevision,
    provider: verification.provider,
    profileId: verification.profileId,
    operationId: verification.operationId,
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    bundleId: verification.bundleId,
    bundleRevision: verification.bundleRevision,
    bundleHash: verification.bundleHash,
    trustPolicyId: verification.trustPolicyId,
    trustPolicyRevision: verification.trustPolicyRevision,
    trustPolicyHash: verification.trustPolicyHash,
    validUntil: verification.validUntil,
  });
}

function isFresh(state: RuntimeState, record: AuthorityRecord) {
  const wallAge = state.wallNow() - record.issuedWallClockMs;
  const monotonicAge = state.monotonicNow() - record.issuedMonotonicMs;
  return (
    Number.isFinite(wallAge) &&
    Number.isFinite(monotonicAge) &&
    wallAge >= 0 &&
    monotonicAge >= 0 &&
    wallAge < AUTHORITY_LIFETIME_MS &&
    monotonicAge < AUTHORITY_LIFETIME_MS
  );
}

function issueAuthority(
  state: RuntimeState,
  managementCapability: unknown,
  activeMountCapability: unknown,
) {
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !activeMountCapability ||
    typeof activeMountCapability !== "object"
  ) {
    return blocked("provider_authority_binding_invalid");
  }
  const operation = state.verifyOperation(managementCapability);
  const mount = state.inspectActiveMount(
    activeMountCapability,
    managementCapability,
  );
  const verification = reverifyCurrentAuthority(state, operation, mount);
  const issuedWallClockMs = state.wallNow();
  const issuedMonotonicMs = state.monotonicNow();
  const identifierBytes = state.randomBytes(AUTHORITY_RECORD_ID_BYTES);
  if (
    !verification ||
    !Number.isFinite(issuedWallClockMs) ||
    !Number.isFinite(issuedMonotonicMs) ||
    issuedWallClockMs < 0 ||
    issuedMonotonicMs < 0 ||
    !Buffer.isBuffer(identifierBytes) ||
    identifierBytes.byteLength !== AUTHORITY_RECORD_ID_BYTES
  ) {
    return blocked("provider_authority_prelaunch_verification_invalid");
  }
  const authorityRecordId = `PROVAUTH-${identifierBytes.toString("hex").toUpperCase()}`;
  if (state.records.has(authorityRecordId))
    return blocked("provider_authority_runtime_state_invalid");
  const controlCapability = Object.freeze({});
  const useCapability = Object.freeze({});
  const record: AuthorityRecord = Object.freeze({
    authorityRecordId,
    managementCapability,
    activeMountCapability,
    operation,
    mount,
    verification,
    issuedWallClockMs,
    issuedMonotonicMs,
    controlCapability,
    useCapability,
  });
  state.records.set(authorityRecordId, record);
  state.controlCapabilities.set(controlCapability, authorityRecordId);
  state.useCapabilities.set(useCapability, authorityRecordId);
  return Object.freeze({
    ...blocked("provider_authority_issued"),
    status: "issued" as const,
    reason: "provider_authority_issued",
    authorityRecordId,
    controlCapability,
    useCapability,
    operationId: verification.operationId,
    provider: verification.provider,
    profileId: verification.profileId,
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    runtimeAuthorityIssued: true,
    expiresInMs: AUTHORITY_LIFETIME_MS,
  });
}

function findRecord(
  state: RuntimeState,
  capability: unknown,
  aliases: WeakMap<object, string>,
  managementCapability: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const identifier = aliases.get(capability);
  const record = identifier ? state.records.get(identifier) : null;
  return record?.managementCapability === managementCapability ? record : null;
}

function consumeAuthority(
  state: RuntimeState,
  useCapability: unknown,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const record = findRecord(
    state,
    useCapability,
    state.useCapabilities,
    managementCapability,
  );
  if (
    !record ||
    record.activeMountCapability !== activeMountCapability ||
    !isFresh(state, record)
  ) {
    if (record) removeRecord(state, record);
    return null;
  }
  const operation = state.verifyOperation(managementCapability);
  const mount = state.inspectActiveMount(
    activeMountCapability,
    managementCapability,
  );
  const verification = reverifyCurrentAuthority(state, operation, mount);
  removeRecord(state, record);
  if (
    !verification ||
    verificationIdentity(verification) !==
      verificationIdentity(record.verification)
  ) {
    return null;
  }
  return Object.freeze({
    authorityRecordId: record.authorityRecordId,
    operationId: verification.operationId,
    provider: verification.provider,
    profileId: verification.profileId,
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    runtimeAuthorityIssued: true as const,
    providerEffectAllowed: true as const,
  });
}

function revokeAuthority(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const record = findRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!record) return blocked("provider_authority_control_invalid");
  removeRecord(state, record);
  return Object.freeze({
    ...blocked("provider_authority_revoked"),
    status: "revoked" as const,
    reason: "provider_authority_revoked",
    authorityRecordId: record.authorityRecordId,
    operationId: record.operation.operationId,
  });
}

export function issueRuntimeOwnedProviderAuthority(
  managementCapability: unknown,
  activeMountCapability: unknown,
) {
  return performSafely("provider_authority_issue_failed_closed", () =>
    issueAuthority(
      productionState,
      managementCapability,
      activeMountCapability,
    ),
  );
}

export function consumeRuntimeOwnedProviderAuthority(
  useCapability: unknown,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return consumeAuthority(
      productionState,
      useCapability,
      activeMountCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

export function revokeRuntimeOwnedProviderAuthority(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return performSafely("provider_authority_revoke_failed_closed", () =>
    revokeAuthority(productionState, controlCapability, managementCapability),
  );
}

export function createIsolatedProviderAuthorityRuntimeCandidate(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    issue: (managementCapability: unknown, activeMountCapability: unknown) =>
      performSafely("provider_authority_issue_failed_closed", () =>
        issueAuthority(state, managementCapability, activeMountCapability),
      ),
    consume: (
      useCapability: unknown,
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) => {
      try {
        return consumeAuthority(
          state,
          useCapability,
          activeMountCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      performSafely("provider_authority_revoke_failed_closed", () =>
        revokeAuthority(state, controlCapability, managementCapability),
      ),
  });
}

export function describeProviderAuthorityRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_AUTHORITY_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_AUTHORITY_RUNTIME_CONTRACT_REVISION,
    authorityLifetimeMs: AUTHORITY_LIFETIME_MS,
    aliases: Object.freeze(["control", "use"]),
    maximumUses: 1,
    mountRequirement:
      "signed_static_runtime_owned_active_requirement_bound_to_dynamic_grant_at_prelaunch",
    reverification: "issue_and_consume_immediately_before_provider_effect",
    sourceChange: "invalidates_capability_fail_closed",
    providerEffectAllowedBeforeConsume: false,
    rawAuthoritySourceReported: false,
    pathReported: false,
    credentialReported: false,
    productionActivatedAuthoritySourceLoader:
      "signed_release_bound_local_personal_connected",
  });
}
