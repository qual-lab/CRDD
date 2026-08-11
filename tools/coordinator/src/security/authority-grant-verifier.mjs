import { createHash } from "node:crypto";

import { validateProviderIsolationProfile } from "./provider-isolation-profile.mjs";

export const AUTHORITY_REGISTRY_CONTRACT = "crdd-coordinator/authority-registry";
export const AUTHORITY_REGISTRY_CONTRACT_REVISION = 1;

const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const GRANT_REF = /^AUTH-[0-9]{6,}$/u;
const BROKER_ID = /^BROKER-[0-9]{6,}$/u;
const CREDENTIAL_GRANT_REF = /^CGRANT-[0-9]{6,}$/u;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const TOP_LEVEL_KEYS = new Set([
  "contract",
  "contractRevision",
  "registryId",
  "registryRevision",
  "observedAt",
  "grants"
]);
const GRANT_KEYS = new Set([
  "grantRef",
  "grantRevision",
  "status",
  "validFrom",
  "expiresAt",
  "provider",
  "origins",
  "credentialGrant",
  "operationId",
  "scopeId",
  "profileHash"
]);

function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    registry: null,
    registryHash: null,
    verification: null
  });
}

function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === allowed.size &&
    Object.keys(value).every((key) => allowed.has(key));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function normalizedUtc(value) {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const normalized = new Date(milliseconds).toISOString();
  return value === normalized ? normalized : null;
}

function normalizeNow(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function normalizeOrigins(origins) {
  if (!Array.isArray(origins) || origins.length === 0) return null;
  const normalized = [];
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      return null;
    }
    if (
      parsed.protocol !== "https:" || parsed.username || parsed.password ||
      parsed.search || parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      (parsed.port && parsed.port !== "443")
    ) return null;
    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname || hostname === "localhost" || hostname.endsWith(".localhost") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) || hostname.includes(":")
    ) {
      return null;
    }
    normalized.push(`https://${hostname}`);
  }
  const unique = [...new Set(normalized)].sort();
  return unique.length === normalized.length ? unique : null;
}

function normalizeGrant(grant) {
  if (!exactKeys(grant, GRANT_KEYS)) return null;
  if (
    typeof grant.grantRef !== "string" || !GRANT_REF.test(grant.grantRef) ||
    !Number.isSafeInteger(grant.grantRevision) || grant.grantRevision < 1 ||
    !["active", "revoked", "replaced"].includes(grant.status) ||
    !["codex", "claude"].includes(grant.provider) ||
    typeof grant.operationId !== "string" || !OPERATION_ID.test(grant.operationId) ||
    typeof grant.scopeId !== "string" || !SCOPE_ID.test(grant.scopeId) ||
    typeof grant.profileHash !== "string" || !HASH.test(grant.profileHash)
  ) return null;
  const validFrom = normalizedUtc(grant.validFrom);
  const expiresAt = normalizedUtc(grant.expiresAt);
  if (!validFrom || !expiresAt || validFrom >= expiresAt) return null;
  const origins = normalizeOrigins(grant.origins);
  if (!origins) return null;
  if (!exactKeys(grant.credentialGrant, new Set(["brokerId", "grantRef"]))) return null;
  if (
    typeof grant.credentialGrant.brokerId !== "string" ||
    !BROKER_ID.test(grant.credentialGrant.brokerId) ||
    typeof grant.credentialGrant.grantRef !== "string" ||
    !CREDENTIAL_GRANT_REF.test(grant.credentialGrant.grantRef)
  ) return null;
  return Object.freeze({
    grantRef: grant.grantRef,
    grantRevision: grant.grantRevision,
    status: grant.status,
    validFrom,
    expiresAt,
    provider: grant.provider,
    origins: Object.freeze(origins),
    credentialGrant: Object.freeze({ ...grant.credentialGrant }),
    operationId: grant.operationId,
    scopeId: grant.scopeId,
    profileHash: grant.profileHash
  });
}

export function validateAuthorityRegistryCandidate(candidate) {
  if (!exactKeys(candidate, TOP_LEVEL_KEYS)) return blocked("authority_registry_shape_invalid");
  if (
    candidate.contract !== AUTHORITY_REGISTRY_CONTRACT ||
    candidate.contractRevision !== AUTHORITY_REGISTRY_CONTRACT_REVISION
  ) return blocked("authority_registry_contract_mismatch");
  if (typeof candidate.registryId !== "string" || !REGISTRY_ID.test(candidate.registryId)) {
    return blocked("authority_registry_id_invalid");
  }
  if (!Number.isSafeInteger(candidate.registryRevision) || candidate.registryRevision < 1) {
    return blocked("authority_registry_revision_invalid");
  }
  const observedAt = normalizedUtc(candidate.observedAt);
  if (!observedAt) return blocked("authority_registry_observed_at_invalid");
  if (!Array.isArray(candidate.grants) || candidate.grants.length === 0) {
    return blocked("authority_registry_grants_required");
  }
  const grants = candidate.grants.map(normalizeGrant);
  if (grants.some((grant) => grant == null)) return blocked("authority_registry_grant_invalid");
  const identities = grants.map((grant) => grant.grantRef);
  if (new Set(identities).size !== identities.length) return blocked("authority_registry_grant_duplicate");
  const registry = Object.freeze({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: AUTHORITY_REGISTRY_CONTRACT_REVISION,
    registryId: candidate.registryId,
    registryRevision: candidate.registryRevision,
    observedAt,
    grants: Object.freeze([...grants].sort((left, right) =>
      left.grantRef.localeCompare(right.grantRef) || left.grantRevision - right.grantRevision))
  });
  return Object.freeze({
    status: "candidate",
    reason: "authority_registry_trust_anchor_required",
    registry,
    registryHash: sha256(registry),
    verification: null
  });
}

export function evaluateAuthorityGrantCandidate(rawProfile, rawRegistry, context = {}) {
  const profileResult = validateProviderIsolationProfile(rawProfile);
  if (profileResult.status !== "candidate") return blocked("authority_profile_invalid");
  const registryResult = validateAuthorityRegistryCandidate(rawRegistry);
  if (registryResult.status !== "candidate") return blocked("authority_registry_invalid");
  if (
    !context || typeof context !== "object" || Array.isArray(context) ||
    !exactKeys(context, new Set(["operationId", "scopeId", "now"])) ||
    typeof context.operationId !== "string" || !OPERATION_ID.test(context.operationId) ||
    typeof context.scopeId !== "string" || !SCOPE_ID.test(context.scopeId)
  ) return blocked("authority_context_invalid");
  const now = normalizeNow(context.now);
  if (!now) return blocked("authority_now_invalid");
  if (registryResult.registry.observedAt > now) return blocked("authority_registry_observation_in_future");
  if (profileResult.profile.authority.registryId !== registryResult.registry.registryId) {
    return blocked("authority_registry_mismatch");
  }
  const matching = registryResult.registry.grants.filter((grant) =>
    grant.grantRef === profileResult.profile.authority.grantRef);
  if (matching.length !== 1) return blocked("authority_grant_not_unique");
  const grant = matching[0];
  if (grant.status !== "active") return blocked("authority_grant_inactive");
  if (!(grant.validFrom <= now && now < grant.expiresAt)) return blocked("authority_grant_outside_validity");
  if (grant.provider !== profileResult.profile.provider) return blocked("authority_provider_mismatch");
  if (canonicalJson(grant.origins) !== canonicalJson(profileResult.profile.egress.origins)) {
    return blocked("authority_origins_mismatch");
  }
  if (canonicalJson(grant.credentialGrant) !== canonicalJson(profileResult.profile.credentialGrant)) {
    return blocked("authority_credential_grant_mismatch");
  }
  if (grant.operationId !== context.operationId || grant.scopeId !== context.scopeId) {
    return blocked("authority_operation_scope_mismatch");
  }
  if (grant.profileHash !== profileResult.profileHash) return blocked("authority_profile_hash_mismatch");

  const verification = Object.freeze({
    profileHash: profileResult.profileHash,
    registryId: registryResult.registry.registryId,
    registryRevision: registryResult.registry.registryRevision,
    registryHash: registryResult.registryHash,
    grantRef: grant.grantRef,
    grantRevision: grant.grantRevision,
    operationId: context.operationId,
    scopeId: context.scopeId,
    evaluatedAt: now,
    validUntil: grant.expiresAt
  });
  return Object.freeze({
    status: "candidate",
    reason: "trusted_registry_loader_and_prelaunch_reverification_required",
    registry: registryResult.registry,
    registryHash: registryResult.registryHash,
    verification
  });
}

export function describeAuthorityGrantVerifierContract() {
  return Object.freeze({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: AUTHORITY_REGISTRY_CONTRACT_REVISION,
    coreValidation: "implemented_candidate",
    trustedRegistryLoader: "not_implemented",
    prelaunchReverification: "not_implemented",
    runtimeCapabilityIssued: false,
    selfAssertedRegistryAcceptedAsAuthority: false
  });
}
