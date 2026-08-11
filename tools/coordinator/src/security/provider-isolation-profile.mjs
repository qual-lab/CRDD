import { createHash } from "node:crypto";

export const PROVIDER_ISOLATION_CONTRACT = "crdd-coordinator/provider-isolation-profile";
export const PROVIDER_ISOLATION_CONTRACT_REVISION = 1;

const SUPPORTED_PROVIDERS = new Set(["codex", "claude"]);
export const PROVIDER_INPUT_LIMITS = Object.freeze({
  identifierLength: 64,
  originCount: 16,
  originLength: 256
});
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const AUTHORITY_REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const AUTHORITY_GRANT_REF = /^AUTH-[0-9]{6,}$/u;
const CREDENTIAL_BROKER_ID = /^BROKER-[0-9]{6,}$/u;
const CREDENTIAL_GRANT_REF = /^CGRANT-[0-9]{6,}$/u;
const TOP_LEVEL_KEYS = new Set([
  "contract",
  "contractRevision",
  "profileId",
  "provider",
  "authority",
  "credentialGrant",
  "egress"
]);

function blocked(reason) {
  return Object.freeze({ status: "blocked", reason, profile: null, profileHash: null });
}

function exactKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const seen = new Set();
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || !allowed.has(key)) return false;
    seen.add(key);
    if (seen.size > allowed.size) return false;
  }
  return seen.size === allowed.size;
}

function matches(value, pattern) {
  return typeof value === "string" &&
    value.length <= PROVIDER_INPUT_LIMITS.identifierLength && pattern.test(value);
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.includes("*")) return null;
  let parsed;
  try {
    parsed = new URL(value);
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
  ) return null;
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) ||
    hostname.includes(":")
  ) return null;
  return `https://${hostname}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateProviderIsolationProfileInternal(candidate) {
  if (!exactKeys(candidate, TOP_LEVEL_KEYS)) return blocked("profile_shape_invalid");
  if (
    candidate.contract !== PROVIDER_ISOLATION_CONTRACT ||
    candidate.contractRevision !== PROVIDER_ISOLATION_CONTRACT_REVISION
  ) return blocked("profile_contract_mismatch");
  if (!matches(candidate.profileId, PROFILE_ID)) return blocked("profile_id_invalid");
  if (!SUPPORTED_PROVIDERS.has(candidate.provider)) return blocked("provider_not_supported");

  const authorityKeys = new Set(["registryId", "grantRef"]);
  if (!exactKeys(candidate.authority, authorityKeys)) return blocked("authority_shape_invalid");
  if (
    !matches(candidate.authority.registryId, AUTHORITY_REGISTRY_ID) ||
    !matches(candidate.authority.grantRef, AUTHORITY_GRANT_REF)
  ) return blocked("authority_reference_invalid");

  const credentialKeys = new Set(["brokerId", "grantRef"]);
  if (!exactKeys(candidate.credentialGrant, credentialKeys)) return blocked("credential_grant_shape_invalid");
  if (
    !matches(candidate.credentialGrant.brokerId, CREDENTIAL_BROKER_ID) ||
    !matches(candidate.credentialGrant.grantRef, CREDENTIAL_GRANT_REF)
  ) {
    return blocked("credential_grant_reference_invalid");
  }

  const egressKeys = new Set(["origins"]);
  if (!exactKeys(candidate.egress, egressKeys)) return blocked("egress_shape_invalid");
  if (!Array.isArray(candidate.egress.origins) || candidate.egress.origins.length === 0) {
    return blocked("egress_origins_required");
  }
  if (candidate.egress.origins.length > PROVIDER_INPUT_LIMITS.originCount) {
    return blocked("egress_origin_count_exceeded");
  }
  if (candidate.egress.origins.some((origin) =>
    typeof origin !== "string" || origin.length > PROVIDER_INPUT_LIMITS.originLength)) {
    return blocked("egress_origin_length_exceeded");
  }
  const origins = candidate.egress.origins.map(normalizeOrigin);
  if (origins.some((origin) => origin == null)) return blocked("egress_origin_invalid");
  const uniqueOrigins = [...new Set(origins)].sort();
  if (uniqueOrigins.length !== origins.length) return blocked("egress_origin_duplicate");

  const profile = Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: PROVIDER_ISOLATION_CONTRACT_REVISION,
    profileId: candidate.profileId,
    provider: candidate.provider,
    authority: Object.freeze({ ...candidate.authority }),
    credentialGrant: Object.freeze({ ...candidate.credentialGrant }),
    egress: Object.freeze({ origins: Object.freeze(uniqueOrigins) }),
    requiredCapabilities: Object.freeze([
      "authority_grant_verification",
      "docker_isolation",
      "credential_broker",
      "provider_endpoint_proxy",
      "provider_endpoint_egress_enforcement"
    ])
  });
  const profileHash = createHash("sha256").update(canonicalJson(profile)).digest("hex");
  return Object.freeze({ status: "candidate", reason: "authority_verification_required", profile, profileHash });
}

export function validateProviderIsolationProfile(candidate) {
  try {
    return validateProviderIsolationProfileInternal(candidate);
  } catch {
    return blocked("profile_input_invalid");
  }
}

export function describeProviderIsolationContract() {
  return Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: PROVIDER_ISOLATION_CONTRACT_REVISION,
    crddVersionSpecific: false,
    validationState: "candidate",
    authorityVerification: "not_implemented",
    supportedProviders: Object.freeze([...SUPPORTED_PROVIDERS]),
    supportedWriteBackend: "docker",
    localFallbackAllowed: false,
    rawCredentialAllowed: false,
    wildcardEgressAllowed: false
  });
}
