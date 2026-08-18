import { createHash } from "node:crypto";

import {
  PROVIDER_INPUT_LIMITS,
  validateProviderIsolationProfile,
} from "./provider-isolation-profile.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const AUTHORITY_REGISTRY_CONTRACT =
  "crdd-coordinator/authority-registry";
export const AUTHORITY_REGISTRY_CONTRACT_REVISION = 2;

const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const GRANT_REF = /^AUTH-[0-9]{6,}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const PROVIDER_HOME_MOUNT_GRANT_REF = /^PHMGRANT-[0-9]{6,}$/u;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;
export const AUTHORITY_REGISTRY_INPUT_LIMITS = Object.freeze({
  grantCount: 64,
  rawBytes: 131_072,
  canonicalBytes: 131_072,
});
const TOP_LEVEL_KEYS = new Set([
  "contract",
  "contractRevision",
  "registryId",
  "registryRevision",
  "observedAt",
  "grants",
]);
const GRANT_KEYS = new Set([
  "grantRef",
  "grantRevision",
  "status",
  "validFrom",
  "expiresAt",
  "provider",
  "profileId",
  "origins",
  "providerHomeMountGrant",
  "operationId",
  "scopeId",
  "profileHash",
]);

type AuthorityGrant = {
  grantRef: string;
  grantRevision: number;
  status: string;
  validFrom: string;
  expiresAt: string;
  provider: string;
  profileId: string;
  origins: readonly string[];
  providerHomeMountGrant: Readonly<{
    grantRef: string;
    provider: string;
    profileId: string;
    operationId: string;
    grantIssued: false;
    verification: "not_implemented";
  }>;
  operationId: string;
  scopeId: string;
  profileHash: string;
};

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    registry: null,
    registryHash: null,
    verification: null,
  });
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("authority_registry_json_invalid");
  return serialized;
}

function normalizedUtc(value: unknown) {
  if (typeof value !== "string" || !CANONICAL_UTC.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const normalized = new Date(milliseconds).toISOString();
  return value === normalized ? normalized : null;
}

function normalizeNow(value: unknown) {
  if (value instanceof Date) {
    const milliseconds = Date.prototype.getTime.call(value);
    return Number.isFinite(milliseconds)
      ? new Date(milliseconds).toISOString()
      : null;
  }
  return normalizedUtc(value);
}

function normalizeOrigins(origins: unknown) {
  const result = snapshotPlainArray<string>(
    origins,
    PROVIDER_INPUT_LIMITS.originCount,
  );
  if (
    result.status !== "ok" ||
    result.value.length === 0 ||
    result.value.some(
      (origin) =>
        typeof origin !== "string" ||
        origin.length > PROVIDER_INPUT_LIMITS.originLength,
    )
  )
    return null;
  const normalizedOrigins: string[] = [];
  for (const origin of result.value) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      return null;
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      (parsed.port && parsed.port !== "443")
    )
      return null;
    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) ||
      hostname.includes(":")
    ) {
      return null;
    }
    normalizedOrigins.push(`https://${hostname}`);
  }
  const uniqueOrigins = [...new Set(normalizedOrigins)].sort();
  return uniqueOrigins.length === normalizedOrigins.length
    ? uniqueOrigins
    : null;
}

function normalizeGrant(grant: unknown): Readonly<AuthorityGrant> | null {
  const snapshot = snapshotPlainRecord(grant, GRANT_KEYS);
  if (!snapshot) return null;
  const providerHomeMountGrant = snapshotPlainRecord(
    snapshot.providerHomeMountGrant,
    new Set([
      "grantRef",
      "provider",
      "profileId",
      "operationId",
      "grantIssued",
      "verification",
    ]),
  );
  if (!providerHomeMountGrant) return null;
  const origins = normalizeOrigins(snapshot.origins);
  if (!origins) return null;
  if (
    typeof snapshot.grantRef !== "string" ||
    snapshot.grantRef.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !GRANT_REF.test(snapshot.grantRef) ||
    typeof snapshot.grantRevision !== "number" ||
    !Number.isSafeInteger(snapshot.grantRevision) ||
    snapshot.grantRevision < 1 ||
    typeof snapshot.status !== "string" ||
    !["active", "revoked", "replaced"].includes(snapshot.status) ||
    typeof snapshot.provider !== "string" ||
    !["codex", "claude"].includes(snapshot.provider) ||
    typeof snapshot.profileId !== "string" ||
    snapshot.profileId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !PROFILE_ID.test(snapshot.profileId) ||
    typeof snapshot.operationId !== "string" ||
    snapshot.operationId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(snapshot.operationId) ||
    typeof snapshot.scopeId !== "string" ||
    snapshot.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !SCOPE_ID.test(snapshot.scopeId) ||
    typeof snapshot.profileHash !== "string" ||
    !HASH.test(snapshot.profileHash)
  )
    return null;
  const validFrom = normalizedUtc(snapshot.validFrom);
  const expiresAt = normalizedUtc(snapshot.expiresAt);
  if (!validFrom || !expiresAt || validFrom >= expiresAt) return null;
  if (
    typeof providerHomeMountGrant.grantRef !== "string" ||
    providerHomeMountGrant.grantRef.length >
      PROVIDER_INPUT_LIMITS.identifierLength ||
    !PROVIDER_HOME_MOUNT_GRANT_REF.test(providerHomeMountGrant.grantRef) ||
    providerHomeMountGrant.provider !== snapshot.provider ||
    providerHomeMountGrant.profileId !== snapshot.profileId ||
    providerHomeMountGrant.operationId !== snapshot.operationId ||
    providerHomeMountGrant.grantIssued !== false ||
    providerHomeMountGrant.verification !== "not_implemented"
  )
    return null;
  return Object.freeze({
    grantRef: snapshot.grantRef,
    grantRevision: snapshot.grantRevision,
    status: snapshot.status,
    validFrom,
    expiresAt,
    provider: snapshot.provider,
    profileId: snapshot.profileId,
    origins: Object.freeze(origins),
    providerHomeMountGrant: Object.freeze({
      grantRef: providerHomeMountGrant.grantRef,
      provider: providerHomeMountGrant.provider,
      profileId: providerHomeMountGrant.profileId,
      operationId: providerHomeMountGrant.operationId,
      grantIssued: false,
      verification: "not_implemented",
    }),
    operationId: snapshot.operationId,
    scopeId: snapshot.scopeId,
    profileHash: snapshot.profileHash,
  });
}

function validateAuthorityRegistryCandidateInternal(candidate: unknown) {
  const top = snapshotPlainRecord(candidate, TOP_LEVEL_KEYS);
  if (!top) return blocked("authority_registry_shape_invalid");
  const grantsResult = snapshotPlainArray<unknown>(
    top.grants,
    AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount,
  );
  if (grantsResult.status !== "ok") {
    return blocked(
      grantsResult.reason === "array_length_exceeded"
        ? "authority_registry_grant_count_exceeded"
        : "authority_registry_shape_invalid",
    );
  }
  if (
    top.contract !== AUTHORITY_REGISTRY_CONTRACT ||
    top.contractRevision !== AUTHORITY_REGISTRY_CONTRACT_REVISION
  )
    return blocked("authority_registry_contract_mismatch");
  if (
    typeof top.registryId !== "string" ||
    top.registryId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !REGISTRY_ID.test(top.registryId)
  ) {
    return blocked("authority_registry_id_invalid");
  }
  if (
    typeof top.registryRevision !== "number" ||
    !Number.isSafeInteger(top.registryRevision) ||
    top.registryRevision < 1
  ) {
    return blocked("authority_registry_revision_invalid");
  }
  const observedAt = normalizedUtc(top.observedAt);
  if (!observedAt) return blocked("authority_registry_observed_at_invalid");
  if (grantsResult.value.length === 0) {
    return blocked("authority_registry_grants_required");
  }
  const grants = grantsResult.value.map(normalizeGrant);
  if (grants.some((grant) => grant == null))
    return blocked("authority_registry_grant_invalid");
  const normalizedGrants = grants.filter(
    (grant): grant is Readonly<AuthorityGrant> => grant !== null,
  );
  const identities = normalizedGrants.map((grant) => grant.grantRef);
  if (new Set(identities).size !== identities.length)
    return blocked("authority_registry_grant_duplicate");
  const mountGrantRefs = normalizedGrants.map(
    (grant) => grant.providerHomeMountGrant.grantRef,
  );
  if (new Set(mountGrantRefs).size !== mountGrantRefs.length)
    return blocked("authority_provider_home_mount_grant_duplicate");
  const registry = Object.freeze({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: AUTHORITY_REGISTRY_CONTRACT_REVISION,
    registryId: top.registryId,
    registryRevision: top.registryRevision,
    observedAt,
    grants: Object.freeze(
      [...normalizedGrants].sort(
        (left, right) =>
          left.grantRef.localeCompare(right.grantRef) ||
          left.grantRevision - right.grantRevision,
      ),
    ),
  });
  const canonical = canonicalJson(registry);
  if (
    Buffer.byteLength(canonical, "utf8") >
    AUTHORITY_REGISTRY_INPUT_LIMITS.canonicalBytes
  ) {
    return blocked("authority_registry_canonical_bytes_exceeded");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "authority_registry_trust_anchor_required",
    registry,
    registryHash: createHash("sha256").update(canonical).digest("hex"),
    verification: null,
  });
}

export function validateAuthorityRegistryCandidate(candidate: unknown) {
  try {
    return validateAuthorityRegistryCandidateInternal(candidate);
  } catch {
    return blocked("authority_registry_input_invalid");
  }
}

export function decodeCanonicalAuthorityRegistryBytes(input: unknown) {
  try {
    if (!Buffer.isBuffer(input))
      return blocked("authority_registry_bytes_required");
    const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
    if (inputLength > AUTHORITY_REGISTRY_INPUT_LIMITS.rawBytes) {
      return blocked("authority_registry_raw_bytes_exceeded");
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (source.charCodeAt(0) === 0xfeff)
      return blocked("authority_registry_bytes_invalid");
    const parsed = JSON.parse(source);
    const result = validateAuthorityRegistryCandidate(parsed);
    if (result.status !== "candidate")
      return blocked("authority_registry_bytes_invalid");
    const canonical = canonicalJson(result.registry);
    if (!Buffer.prototype.equals.call(bytes, Buffer.from(canonical, "utf8"))) {
      return blocked("authority_registry_bytes_noncanonical");
    }
    return result;
  } catch {
    return blocked("authority_registry_bytes_invalid");
  }
}

function evaluateAuthorityGrantCandidateInternal(
  rawProfile: unknown,
  rawRegistry: unknown,
  context: unknown = {},
) {
  const profileResult = validateProviderIsolationProfile(rawProfile);
  if (profileResult.status !== "candidate")
    return blocked("authority_profile_invalid");
  const registryResult = validateAuthorityRegistryCandidate(rawRegistry);
  if (registryResult.status !== "candidate")
    return blocked("authority_registry_invalid");
  const contextSnapshot = snapshotPlainRecord(
    context,
    new Set(["provider", "profileId", "operationId", "scopeId", "now"]),
  );
  if (
    !contextSnapshot ||
    typeof contextSnapshot.provider !== "string" ||
    !["codex", "claude"].includes(contextSnapshot.provider) ||
    typeof contextSnapshot.profileId !== "string" ||
    contextSnapshot.profileId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !PROFILE_ID.test(contextSnapshot.profileId) ||
    typeof contextSnapshot.operationId !== "string" ||
    contextSnapshot.operationId.length >
      PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(contextSnapshot.operationId) ||
    typeof contextSnapshot.scopeId !== "string" ||
    contextSnapshot.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !SCOPE_ID.test(contextSnapshot.scopeId)
  )
    return blocked("authority_context_invalid");
  const now = normalizeNow(contextSnapshot.now);
  if (!now) return blocked("authority_now_invalid");
  if (registryResult.registry.observedAt > now)
    return blocked("authority_registry_observation_in_future");
  if (
    profileResult.profile.authority.registryId !==
    registryResult.registry.registryId
  ) {
    return blocked("authority_registry_mismatch");
  }
  const matchingGrants = registryResult.registry.grants.filter(
    (grant) => grant.grantRef === profileResult.profile.authority.grantRef,
  );
  if (matchingGrants.length !== 1) return blocked("authority_grant_not_unique");
  const grant = matchingGrants[0];
  if (!grant) return blocked("authority_grant_not_unique");
  if (grant.status !== "active") return blocked("authority_grant_inactive");
  if (!(grant.validFrom <= now && now < grant.expiresAt))
    return blocked("authority_grant_outside_validity");
  if (grant.provider !== profileResult.profile.provider)
    return blocked("authority_provider_mismatch");
  if (
    contextSnapshot.provider !== profileResult.profile.provider ||
    contextSnapshot.profileId !== profileResult.profile.profileId ||
    contextSnapshot.operationId !== profileResult.profile.operationId ||
    grant.profileId !== profileResult.profile.profileId ||
    grant.operationId !== profileResult.profile.operationId
  )
    return blocked("authority_provider_profile_operation_mismatch");
  if (
    canonicalJson(grant.origins) !==
    canonicalJson(profileResult.profile.egress.origins)
  ) {
    return blocked("authority_origins_mismatch");
  }
  if (
    canonicalJson(grant.providerHomeMountGrant) !==
    canonicalJson(profileResult.profile.providerHomeMountGrant)
  ) {
    return blocked("authority_provider_home_mount_grant_mismatch");
  }
  if (
    grant.operationId !== contextSnapshot.operationId ||
    grant.scopeId !== contextSnapshot.scopeId
  ) {
    return blocked("authority_operation_scope_mismatch");
  }
  if (grant.profileHash !== profileResult.profileHash)
    return blocked("authority_profile_hash_mismatch");

  const verification = Object.freeze({
    profileHash: profileResult.profileHash,
    registryId: registryResult.registry.registryId,
    registryRevision: registryResult.registry.registryRevision,
    registryHash: registryResult.registryHash,
    grantRef: grant.grantRef,
    grantRevision: grant.grantRevision,
    provider: contextSnapshot.provider,
    profileId: contextSnapshot.profileId,
    operationId: contextSnapshot.operationId,
    scopeId: contextSnapshot.scopeId,
    providerHomeMountGrantRef: grant.providerHomeMountGrant.grantRef,
    providerHomeMountGrantIssued: false,
    providerHomeMountGrantVerification: "not_implemented",
    evaluatedAt: now,
    validUntil: grant.expiresAt,
  });
  return Object.freeze({
    status: /** @type {"candidate"} */ ("candidate"),
    reason:
      "runtime_trust_policy_activation_and_prelaunch_reverification_required",
    registry: registryResult.registry,
    registryHash: registryResult.registryHash,
    verification,
  });
}

export function evaluateAuthorityGrantCandidate(
  rawProfile: unknown,
  rawRegistry: unknown,
  context: unknown = {},
) {
  try {
    return evaluateAuthorityGrantCandidateInternal(
      rawProfile,
      rawRegistry,
      context,
    );
  } catch {
    return blocked("authority_input_invalid");
  }
}

export function describeAuthorityGrantVerifierContract() {
  return Object.freeze({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: AUTHORITY_REGISTRY_CONTRACT_REVISION,
    coreValidation: "implemented_candidate",
    canonicalRegistryByteLoader: "implemented_candidate",
    runtimeTrustPolicyActivation: "not_implemented",
    prelaunchReverificationCore: "implemented_candidate",
    providerLaunchIntegration: "not_implemented",
    runtimeCapabilityIssued: false,
    selfAssertedRegistryAcceptedAsAuthority: false,
  });
}
