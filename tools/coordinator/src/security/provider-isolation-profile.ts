import { createHash } from "node:crypto";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const PROVIDER_ISOLATION_CONTRACT =
  "crdd-coordinator/provider-isolation-profile";
export const PROVIDER_ISOLATION_CONTRACT_REVISION = 1;

const SUPPORTED_PROVIDERS = new Set(["codex", "claude"]);
export const PROVIDER_INPUT_LIMITS = Object.freeze({
  identifierLength: 64,
  originCount: 16,
  originLength: 256,
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
  "egress",
]);

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    profile: null,
    profileHash: null,
  });
}

function matches(value: unknown, pattern: RegExp): value is string {
  return (
    typeof value === "string" &&
    value.length <= PROVIDER_INPUT_LIMITS.identifierLength &&
    pattern.test(value)
  );
}

function normalizeOrigin(value: unknown) {
  if (typeof value !== "string" || value.includes("*")) return null;
  let parsed: URL;
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
  )
    return null;
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) ||
    hostname.includes(":")
  )
    return null;
  return `https://${hostname}`;
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
    throw new Error("provider_profile_json_invalid");
  return serialized;
}

function validateProviderIsolationProfileInternal(candidate: unknown) {
  const top = snapshotPlainRecord(candidate, TOP_LEVEL_KEYS);
  if (!top) return blocked("profile_shape_invalid");
  const authorityKeys = new Set(["registryId", "grantRef"]);
  const authority = snapshotPlainRecord(top.authority, authorityKeys);
  if (!authority) return blocked("authority_shape_invalid");
  const credentialKeys = new Set(["brokerId", "grantRef"]);
  const credentialGrant = snapshotPlainRecord(
    top.credentialGrant,
    credentialKeys,
  );
  if (!credentialGrant) return blocked("credential_grant_shape_invalid");
  const egressKeys = new Set(["origins"]);
  const egress = snapshotPlainRecord(top.egress, egressKeys);
  if (!egress) return blocked("egress_shape_invalid");
  const originsResult = snapshotPlainArray<string>(
    egress.origins,
    PROVIDER_INPUT_LIMITS.originCount,
  );
  if (originsResult.status !== "ok") {
    return blocked(
      originsResult.reason === "array_length_exceeded"
        ? "egress_origin_count_exceeded"
        : "egress_shape_invalid",
    );
  }
  const rawOrigins = originsResult.value;
  if (
    top.contract !== PROVIDER_ISOLATION_CONTRACT ||
    top.contractRevision !== PROVIDER_ISOLATION_CONTRACT_REVISION
  )
    return blocked("profile_contract_mismatch");
  if (!matches(top.profileId, PROFILE_ID)) return blocked("profile_id_invalid");
  if (
    typeof top.provider !== "string" ||
    !SUPPORTED_PROVIDERS.has(top.provider)
  ) {
    return blocked("provider_not_supported");
  }

  if (
    !matches(authority.registryId, AUTHORITY_REGISTRY_ID) ||
    !matches(authority.grantRef, AUTHORITY_GRANT_REF)
  )
    return blocked("authority_reference_invalid");

  if (
    !matches(credentialGrant.brokerId, CREDENTIAL_BROKER_ID) ||
    !matches(credentialGrant.grantRef, CREDENTIAL_GRANT_REF)
  ) {
    return blocked("credential_grant_reference_invalid");
  }

  if (rawOrigins.length === 0) {
    return blocked("egress_origins_required");
  }
  if (
    rawOrigins.some(
      (origin) =>
        typeof origin !== "string" ||
        origin.length > PROVIDER_INPUT_LIMITS.originLength,
    )
  ) {
    return blocked("egress_origin_length_exceeded");
  }
  const origins = rawOrigins.map(normalizeOrigin);
  if (origins.some((origin) => origin == null))
    return blocked("egress_origin_invalid");
  const normalizedOrigins = origins.filter(
    (origin): origin is string => origin !== null,
  );
  const uniqueOrigins = [...new Set(normalizedOrigins)].sort();
  if (uniqueOrigins.length !== origins.length)
    return blocked("egress_origin_duplicate");

  const profile = Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: PROVIDER_ISOLATION_CONTRACT_REVISION,
    profileId: top.profileId,
    provider: top.provider,
    authority: Object.freeze({
      registryId: authority.registryId,
      grantRef: authority.grantRef,
    }),
    credentialGrant: Object.freeze({
      brokerId: credentialGrant.brokerId,
      grantRef: credentialGrant.grantRef,
    }),
    egress: Object.freeze({ origins: Object.freeze(uniqueOrigins) }),
    requiredCapabilities: Object.freeze([
      "authority_grant_verification",
      "docker_isolation",
      "credential_broker",
      "provider_endpoint_proxy",
      "provider_endpoint_egress_enforcement",
    ]),
  });
  const profileHash = createHash("sha256")
    .update(canonicalJson(profile))
    .digest("hex");
  return Object.freeze({
    status: "candidate",
    reason: "authority_verification_required",
    profile,
    profileHash,
  });
}

export function validateProviderIsolationProfile(candidate: unknown) {
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
    genericCredentialGrant: Object.freeze({
      semantics: "generic_short_term_credential_reference_candidate",
      subscriptionOauthV1Applicability: "not_applicable",
    }),
    subscriptionOauthProviderHomeMountGrant: Object.freeze({
      contractOwner: "provider_lifecycle",
      implementationState: "not_implemented",
      tokenCopyOrInjectionAllowed: false,
    }),
    wildcardEgressAllowed: false,
  });
}
