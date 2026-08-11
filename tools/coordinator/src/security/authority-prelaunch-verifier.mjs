import {
  evaluateAuthorityGrantCandidate
} from "./authority-grant-verifier.mjs";
import {
  loadAuthorityRegistryTrustCandidate
} from "./authority-trust-loader.mjs";
import { PROVIDER_INPUT_LIMITS } from "./provider-isolation-profile.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;
const CONTEXT_KEYS = new Set(["operationId", "scopeId"]);
const INTRINSIC_DATE = Date;
const INTRINSIC_DATE_NOW = Date.now;
const INTRINSIC_DATE_TO_ISO = Date.prototype.toISOString;

function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    verification: null,
    runtimeCapabilityIssued: false
  });
}

function runtimeNow() {
  const milliseconds = Reflect.apply(INTRINSIC_DATE_NOW, INTRINSIC_DATE, []);
  if (!Number.isFinite(milliseconds)) return null;
  const value = new INTRINSIC_DATE(milliseconds);
  return Reflect.apply(INTRINSIC_DATE_TO_ISO, value, []);
}

function normalizeContext(rawContext) {
  const context = snapshotPlainRecord(rawContext, CONTEXT_KEYS);
  if (
    !context ||
    typeof context.operationId !== "string" ||
    context.operationId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(context.operationId) ||
    typeof context.scopeId !== "string" ||
    context.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !SCOPE_ID.test(context.scopeId)
  ) return null;
  return Object.freeze({
    operationId: context.operationId,
    scopeId: context.scopeId
  });
}

export function reverifyAuthorityBeforeProviderLaunch(
  rawProfile,
  registryBytes,
  rawTrustPolicy,
  rawContext
) {
  try {
    const context = normalizeContext(rawContext);
    if (!context) return blocked("prelaunch_authority_context_invalid");

    const trust = loadAuthorityRegistryTrustCandidate(registryBytes, rawTrustPolicy);
    if (trust.status !== "candidate") return blocked("prelaunch_authority_trust_input_invalid");

    const evaluatedAt = runtimeNow();
    if (!evaluatedAt) return blocked("prelaunch_runtime_clock_invalid");
    const authority = evaluateAuthorityGrantCandidate(rawProfile, trust.registry, {
      operationId: context.operationId,
      scopeId: context.scopeId,
      now: evaluatedAt
    });
    if (authority.status !== "candidate") return blocked(authority.reason);
    if (authority.registryHash !== trust.registryHash) {
      return blocked("prelaunch_authority_registry_identity_mismatch");
    }

    return Object.freeze({
      status: "candidate",
      reason: "runtime_owned_trust_policy_activation_required",
      verification: Object.freeze({
        ...authority.verification,
        trustPolicyId: trust.trustPolicy.policyId,
        trustPolicyRevision: trust.trustPolicy.policyRevision,
        trustPolicyHash: trust.trustPolicyHash,
        prelaunchCheckedAt: evaluatedAt
      }),
      runtimeCapabilityIssued: false
    });
  } catch {
    return blocked("prelaunch_authority_input_invalid");
  }
}

export function describeAuthorityPrelaunchVerifierContract() {
  return Object.freeze({
    runtimeClockRead: "implemented_candidate",
    prelaunchReverificationCore: "implemented_candidate",
    providerLaunchIntegration: "not_implemented",
    runtimeTrustPolicyActivation: "not_implemented",
    runtimeCapabilityIssued: false,
    callerSuppliedTimeAccepted: false,
    candidateReusableAsCapability: false
  });
}
