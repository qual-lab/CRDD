import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_HOME_MOUNT_GRANT_CONTRACT =
  "crdd-coordinator/provider-home-mount-grant";
export const PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION = 1;
export const PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS = 300_000;

const PROVIDERS = new Set(["codex", "claude"]);
const STATES = new Set(["prepared", "issued", "consumed", "revoked"]);
const GRANT_REF = /^PHMGRANT-[0-9]{6,}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const RECORD_KEYS = new Set([
  "contract",
  "contractRevision",
  "grantRef",
  "provider",
  "profileId",
  "operationId",
  "providerHomeIdentityHash",
  "providerHomeProtectionHash",
  "localUserBindingHash",
  "state",
  "issuedAt",
  "expiresAt",
  "consumedAt",
  "revokedAt",
  "usageLimit",
  "consumptionCount",
]);
const USE_KEYS = new Set([
  "grant",
  "provider",
  "profileId",
  "operationId",
  "observedAt",
]);
const TRANSITION_KEYS = new Set(["previous", "next"]);

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    grant: null,
    mountAuthorizationIssued: false,
    providerHomeMountGrantIssued: false,
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
    credentialReported: false,
  });
}

function identifier(value: unknown, pattern: RegExp) {
  return typeof value === "string" && value.length <= 64 && pattern.test(value);
}

export function isProviderHomeMountGrantRef(value: unknown): value is string {
  return identifier(value, GRANT_REF);
}

function canonicalUtc(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function optionalCanonicalUtc(value: unknown): value is string | null {
  return value === null || canonicalUtc(value);
}

function compileInternal(raw: unknown) {
  const value = snapshotPlainRecord(raw, RECORD_KEYS);
  if (
    !value ||
    value.contract !== PROVIDER_HOME_MOUNT_GRANT_CONTRACT ||
    value.contractRevision !== PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION ||
    !isProviderHomeMountGrantRef(value.grantRef) ||
    typeof value.provider !== "string" ||
    !PROVIDERS.has(value.provider) ||
    !identifier(value.profileId, PROFILE_ID) ||
    !identifier(value.operationId, OPERATION_ID) ||
    typeof value.providerHomeIdentityHash !== "string" ||
    !HEX64.test(value.providerHomeIdentityHash) ||
    typeof value.providerHomeProtectionHash !== "string" ||
    !HEX64.test(value.providerHomeProtectionHash) ||
    typeof value.localUserBindingHash !== "string" ||
    !HEX64.test(value.localUserBindingHash) ||
    typeof value.state !== "string" ||
    !STATES.has(value.state) ||
    !optionalCanonicalUtc(value.issuedAt) ||
    !optionalCanonicalUtc(value.expiresAt) ||
    !optionalCanonicalUtc(value.consumedAt) ||
    !optionalCanonicalUtc(value.revokedAt) ||
    value.usageLimit !== 1 ||
    (value.consumptionCount !== 0 && value.consumptionCount !== 1)
  )
    return null;

  const issuedAt =
    value.issuedAt === null ? null : Date.parse(value.issuedAt as string);
  const expiresAt =
    value.expiresAt === null ? null : Date.parse(value.expiresAt as string);
  const consumedAt =
    value.consumedAt === null ? null : Date.parse(value.consumedAt as string);
  const revokedAt =
    value.revokedAt === null ? null : Date.parse(value.revokedAt as string);
  const isActiveTimeRangeValid =
    issuedAt !== null &&
    expiresAt !== null &&
    expiresAt > issuedAt &&
    expiresAt - issuedAt <= PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS;
  const isValid =
    (value.state === "prepared" &&
      issuedAt === null &&
      expiresAt === null &&
      consumedAt === null &&
      revokedAt === null &&
      value.consumptionCount === 0) ||
    (value.state === "issued" &&
      isActiveTimeRangeValid &&
      consumedAt === null &&
      revokedAt === null &&
      value.consumptionCount === 0) ||
    (value.state === "consumed" &&
      isActiveTimeRangeValid &&
      consumedAt !== null &&
      consumedAt >= (issuedAt as number) &&
      consumedAt <= (expiresAt as number) &&
      revokedAt === null &&
      value.consumptionCount === 1) ||
    (value.state === "revoked" &&
      isActiveTimeRangeValid &&
      revokedAt !== null &&
      revokedAt >= (issuedAt as number) &&
      ((value.consumptionCount === 0 && consumedAt === null) ||
        (value.consumptionCount === 1 &&
          consumedAt !== null &&
          consumedAt >= (issuedAt as number) &&
          consumedAt <= (expiresAt as number) &&
          revokedAt >= consumedAt)));
  if (!isValid) return null;
  return Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    grantRef: value.grantRef as string,
    provider: value.provider as string,
    profileId: value.profileId as string,
    operationId: value.operationId as string,
    providerHomeIdentityHash: value.providerHomeIdentityHash as string,
    providerHomeProtectionHash: value.providerHomeProtectionHash as string,
    localUserBindingHash: value.localUserBindingHash as string,
    state: value.state as string,
    issuedAt: value.issuedAt as string | null,
    expiresAt: value.expiresAt as string | null,
    consumedAt: value.consumedAt as string | null,
    revokedAt: value.revokedAt as string | null,
    usageLimit: 1 as const,
    consumptionCount: value.consumptionCount as 0 | 1,
  });
}

export function compileProviderHomeMountGrantCandidate(raw: unknown) {
  try {
    const grant = compileInternal(raw);
    if (!grant) return blocked("provider_home_mount_grant_record_invalid");
    return Object.freeze({
      ...blocked("provider_home_mount_grant_structural_candidate_only"),
      status: "candidate" as const,
      grant,
    });
  } catch {
    return blocked("provider_home_mount_grant_record_invalid");
  }
}

function sameBinding(
  previous: NonNullable<ReturnType<typeof compileInternal>>,
  next: NonNullable<ReturnType<typeof compileInternal>>,
) {
  return [
    "contract",
    "contractRevision",
    "grantRef",
    "provider",
    "profileId",
    "operationId",
    "providerHomeIdentityHash",
    "providerHomeProtectionHash",
    "localUserBindingHash",
    "usageLimit",
  ].every(
    (key) =>
      previous[key as keyof typeof previous] === next[key as keyof typeof next],
  );
}

export function evaluateProviderHomeMountGrantTransitionCandidate(
  raw: unknown,
) {
  try {
    const input = snapshotPlainRecord(raw, TRANSITION_KEYS);
    if (!input)
      return blocked("provider_home_mount_grant_transition_input_invalid");
    const previous = compileInternal(input.previous);
    const next = compileInternal(input.next);
    if (!previous || !next)
      return blocked("provider_home_mount_grant_transition_record_invalid");
    if (!sameBinding(previous, next))
      return blocked("provider_home_mount_grant_transition_binding_mismatch");
    const isAllowed =
      (previous.state === "prepared" && next.state === "issued") ||
      (previous.state === "issued" &&
        (next.state === "consumed" || next.state === "revoked")) ||
      (previous.state === "consumed" && next.state === "revoked");
    if (!isAllowed)
      return blocked("provider_home_mount_grant_transition_not_allowed");
    if (
      previous.state !== "prepared" &&
      (next.issuedAt !== previous.issuedAt ||
        next.expiresAt !== previous.expiresAt ||
        (previous.state === "consumed" &&
          next.consumedAt !== previous.consumedAt))
    )
      return blocked("provider_home_mount_grant_transition_time_mismatch");
    return Object.freeze({
      ...blocked(
        "provider_home_mount_grant_transition_runtime_store_and_effect_required",
      ),
      status: "candidate" as const,
      grant: next,
    });
  } catch {
    return blocked("provider_home_mount_grant_transition_input_invalid");
  }
}

export function evaluateProviderHomeMountGrantUseCandidate(raw: unknown) {
  try {
    const input = snapshotPlainRecord(raw, USE_KEYS);
    if (!input) return blocked("provider_home_mount_grant_use_input_invalid");
    const grant = compileInternal(input.grant);
    if (!grant) return blocked("provider_home_mount_grant_use_record_invalid");
    if (
      input.provider !== grant.provider ||
      input.profileId !== grant.profileId ||
      input.operationId !== grant.operationId
    )
      return blocked("provider_home_mount_grant_use_binding_mismatch");
    if (!canonicalUtc(input.observedAt))
      return blocked("provider_home_mount_grant_observed_at_invalid");
    if (grant.state !== "issued")
      return blocked("provider_home_mount_grant_not_usable");
    const observedAt = Date.parse(input.observedAt);
    if (
      observedAt < Date.parse(grant.issuedAt as string) ||
      observedAt >= Date.parse(grant.expiresAt as string)
    )
      return blocked("provider_home_mount_grant_expired_or_not_yet_valid");
    return Object.freeze({
      ...blocked(
        "provider_home_mount_grant_runtime_clock_store_and_mount_adapter_required",
      ),
      status: "candidate" as const,
      grant,
    });
  } catch {
    return blocked("provider_home_mount_grant_use_input_invalid");
  }
}

export function describeProviderHomeMountGrantContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    providers: Object.freeze([...PROVIDERS]),
    states: Object.freeze([...STATES]),
    usageLimit: 1,
    maximumLifetimeMs: PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
    providerProfileOperationBindingRequired: true,
    providerHomeIdentityAndProtectionBindingRequired: true,
    selectedLocalUserBindingRequired: true,
    runtimeOwnedClockRequired: true,
    runtimeOwnedAtomicStoreRequired: true,
    runtimeOwnedIssuerRequired: true,
    oneTimeConsumptionRequired: true,
    operationEndRevocationRequired: true,
    tokenCopyOrInjectionAllowed: false,
    pathOrCredentialDisclosureAllowed: false,
    structuralCore: "implemented_candidate_non_authoritative",
    issuanceEffect: "not_implemented",
    mountAdapter: "not_implemented",
    revocationEffect: "not_implemented",
    grantIssued: false,
    mountAuthorizationIssued: false,
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
  });
}
