import { createHash } from "node:crypto";

export const PROVIDER_ISOLATION_CONTRACT = "crdd-coordinator/provider-isolation-profile";
export const PROVIDER_ISOLATION_CONTRACT_REVISION = 1;

const SUPPORTED_PROVIDERS = new Set(["codex", "claude"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SECRET_KEY = /(secret|token|password|api[_-]?key|credential[_-]?value|private[_-]?key)/iu;
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
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function containsSecretMaterial(value, key = "") {
  if (SECRET_KEY.test(key)) return true;
  if (Array.isArray(value)) return value.some((item) => containsSecretMaterial(item));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([childKey, child]) => containsSecretMaterial(child, childKey));
  }
  return false;
}

function validIdentifier(value) {
  return typeof value === "string" && IDENTIFIER.test(value);
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

export function validateProviderIsolationProfile(candidate, options = {}) {
  if (!exactKeys(candidate, TOP_LEVEL_KEYS)) return blocked("profile_shape_invalid");
  if (containsSecretMaterial(candidate)) return blocked("secret_material_forbidden");
  if (
    candidate.contract !== PROVIDER_ISOLATION_CONTRACT ||
    candidate.contractRevision !== PROVIDER_ISOLATION_CONTRACT_REVISION
  ) return blocked("profile_contract_mismatch");
  if (!validIdentifier(candidate.profileId)) return blocked("profile_id_invalid");
  if (!SUPPORTED_PROVIDERS.has(candidate.provider)) return blocked("provider_not_supported");

  const authorityKeys = new Set(["grantId", "approvedBy", "approvedAt", "expiresAt"]);
  if (!exactKeys(candidate.authority, authorityKeys)) return blocked("authority_shape_invalid");
  if (!validIdentifier(candidate.authority.grantId) || !validIdentifier(candidate.authority.approvedBy)) {
    return blocked("authority_identity_invalid");
  }
  const approvedAt = Date.parse(candidate.authority.approvedAt);
  const expiresAt = Date.parse(candidate.authority.expiresAt);
  const now = options.now instanceof Date ? options.now.getTime() : Date.now();
  if (!Number.isFinite(approvedAt) || !Number.isFinite(expiresAt) || approvedAt >= expiresAt) {
    return blocked("authority_time_invalid");
  }
  if (expiresAt <= now) return blocked("authority_expired");

  const credentialKeys = new Set(["brokerId", "grantRef"]);
  if (!exactKeys(candidate.credentialGrant, credentialKeys)) return blocked("credential_grant_shape_invalid");
  if (!validIdentifier(candidate.credentialGrant.brokerId) || !validIdentifier(candidate.credentialGrant.grantRef)) {
    return blocked("credential_grant_reference_invalid");
  }

  const egressKeys = new Set(["approvalId", "origins"]);
  if (!exactKeys(candidate.egress, egressKeys) || !validIdentifier(candidate.egress.approvalId)) {
    return blocked("egress_authority_invalid");
  }
  if (!Array.isArray(candidate.egress.origins) || candidate.egress.origins.length === 0) {
    return blocked("egress_origins_required");
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
    egress: Object.freeze({ approvalId: candidate.egress.approvalId, origins: Object.freeze(uniqueOrigins) }),
    requiredCapabilities: Object.freeze([
      "docker_isolation",
      "credential_broker",
      "provider_endpoint_proxy",
      "provider_endpoint_egress_enforcement"
    ])
  });
  const profileHash = createHash("sha256").update(canonicalJson(profile)).digest("hex");
  return Object.freeze({ status: "accepted", reason: null, profile, profileHash });
}

export function describeProviderIsolationContract() {
  return Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: PROVIDER_ISOLATION_CONTRACT_REVISION,
    crddVersionSpecific: false,
    supportedProviders: Object.freeze([...SUPPORTED_PROVIDERS]),
    supportedWriteBackend: "docker",
    localFallbackAllowed: false,
    rawCredentialAllowed: false,
    wildcardEgressAllowed: false
  });
}
