import { createHash } from "node:crypto";

import {
  decodeCanonicalAuthorityRegistryBytes
} from "./authority-grant-verifier.mjs";
import { PROVIDER_INPUT_LIMITS } from "./provider-isolation-profile.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

export const AUTHORITY_TRUST_POLICY_CONTRACT = "crdd-coordinator/authority-trust-policy";
export const AUTHORITY_TRUST_POLICY_CONTRACT_REVISION = 1;

const POLICY_ID = /^AUTHPOL-[0-9]{6,}$/u;
const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const POLICY_KEYS = new Set([
  "contract",
  "contractRevision",
  "policyId",
  "policyRevision",
  "status",
  "registryId",
  "registryRevision",
  "registryHash"
]);

function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    registry: null,
    registryHash: null,
    trustPolicy: null,
    trustPolicyHash: null,
    runtimeCapabilityIssued: false
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateTrustPolicyCandidate(candidate) {
  const snapshot = snapshotPlainRecord(candidate, POLICY_KEYS);
  if (!snapshot) return null;
  if (
    snapshot.contract !== AUTHORITY_TRUST_POLICY_CONTRACT ||
    snapshot.contractRevision !== AUTHORITY_TRUST_POLICY_CONTRACT_REVISION ||
    typeof snapshot.policyId !== "string" ||
    snapshot.policyId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !POLICY_ID.test(snapshot.policyId) ||
    !Number.isSafeInteger(snapshot.policyRevision) || snapshot.policyRevision < 1 ||
    !["active", "revoked", "replaced"].includes(snapshot.status) ||
    typeof snapshot.registryId !== "string" ||
    snapshot.registryId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !REGISTRY_ID.test(snapshot.registryId) ||
    !Number.isSafeInteger(snapshot.registryRevision) || snapshot.registryRevision < 1 ||
    typeof snapshot.registryHash !== "string" || !HASH.test(snapshot.registryHash)
  ) return null;
  return Object.freeze({
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: AUTHORITY_TRUST_POLICY_CONTRACT_REVISION,
    policyId: snapshot.policyId,
    policyRevision: snapshot.policyRevision,
    status: snapshot.status,
    registryId: snapshot.registryId,
    registryRevision: snapshot.registryRevision,
    registryHash: snapshot.registryHash
  });
}

export function loadAuthorityRegistryTrustCandidate(registryBytes, rawTrustPolicy) {
  try {
    const registryResult = decodeCanonicalAuthorityRegistryBytes(registryBytes);
    if (registryResult.status !== "candidate") return blocked(registryResult.reason);
    const trustPolicy = validateTrustPolicyCandidate(rawTrustPolicy);
    if (!trustPolicy) return blocked("authority_trust_policy_invalid");
    if (trustPolicy.status !== "active") return blocked("authority_trust_policy_inactive");
    if (
      trustPolicy.registryId !== registryResult.registry.registryId ||
      trustPolicy.registryRevision !== registryResult.registry.registryRevision ||
      trustPolicy.registryHash !== registryResult.registryHash
    ) return blocked("authority_trust_policy_registry_mismatch");

    return Object.freeze({
      status: "candidate",
      reason: "runtime_owned_trust_policy_activation_required",
      registry: registryResult.registry,
      registryHash: registryResult.registryHash,
      trustPolicy,
      trustPolicyHash: createHash("sha256").update(canonicalJson(trustPolicy)).digest("hex"),
      runtimeCapabilityIssued: false
    });
  } catch {
    return blocked("authority_trust_loader_input_invalid");
  }
}

export function describeAuthorityTrustLoaderContract() {
  return Object.freeze({
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: AUTHORITY_TRUST_POLICY_CONTRACT_REVISION,
    canonicalRegistryByteLoader: "implemented_candidate",
    runtimeTrustPolicyOwnership: "not_implemented",
    runtimeTrustPolicyActivation: "not_implemented",
    prelaunchReverificationCore: "implemented_candidate",
    providerLaunchIntegration: "not_implemented",
    runtimeCapabilityIssued: false,
    callerSuppliedPolicyAcceptedAsAuthority: false
  });
}
