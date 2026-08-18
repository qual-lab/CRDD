import { evaluateAuthorityGrantCandidate } from "./authority-grant-verifier.ts";
import { loadAuthorityFileBundleCandidate } from "./authority-file-bundle.ts";
import {
  isProviderHomeMountGrantRef,
  PROVIDER_INPUT_LIMITS,
} from "./provider-isolation-profile.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;
const CONTEXT_KEYS = new Set([
  "provider",
  "profileId",
  "operationId",
  "scopeId",
  "providerHomeMountGrantRef",
]);
const INTRINSIC_DATE = Date;
const INTRINSIC_DATE_NOW = Date.now;
const INTRINSIC_DATE_TO_ISO = Date.prototype.toISOString;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    verification: null,
    runtimeCapabilityIssued: false,
  });
}

function runtimeNow() {
  const milliseconds = Reflect.apply(INTRINSIC_DATE_NOW, INTRINSIC_DATE, []);
  if (!Number.isFinite(milliseconds)) return null;
  const value = new INTRINSIC_DATE(milliseconds);
  return Reflect.apply(INTRINSIC_DATE_TO_ISO, value, []);
}

function normalizeContext(rawContext: unknown) {
  const context = snapshotPlainRecord(rawContext, CONTEXT_KEYS);
  if (
    !context ||
    typeof context.provider !== "string" ||
    !["codex", "claude"].includes(context.provider) ||
    typeof context.profileId !== "string" ||
    context.profileId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !PROFILE_ID.test(context.profileId) ||
    typeof context.operationId !== "string" ||
    context.operationId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(context.operationId) ||
    typeof context.scopeId !== "string" ||
    context.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !SCOPE_ID.test(context.scopeId) ||
    !isProviderHomeMountGrantRef(context.providerHomeMountGrantRef)
  )
    return null;
  return Object.freeze({
    provider: context.provider,
    profileId: context.profileId,
    operationId: context.operationId,
    scopeId: context.scopeId,
    providerHomeMountGrantRef: context.providerHomeMountGrantRef,
  });
}

export function reverifyAuthorityBeforeProviderLaunch(
  rawProfile: unknown,
  rawBundle: unknown,
  rawContext: unknown,
) {
  try {
    const context = normalizeContext(rawContext);
    if (!context) return blocked("prelaunch_authority_context_invalid");

    const bundle = loadAuthorityFileBundleCandidate(rawBundle);
    if (bundle.status !== "candidate")
      return blocked("prelaunch_authority_file_bundle_invalid");

    const evaluatedAt = runtimeNow();
    if (!evaluatedAt) return blocked("prelaunch_runtime_clock_invalid");
    const authority = evaluateAuthorityGrantCandidate(
      rawProfile,
      bundle.registry,
      {
        provider: context.provider,
        profileId: context.profileId,
        operationId: context.operationId,
        scopeId: context.scopeId,
        providerHomeMountGrantRef: context.providerHomeMountGrantRef,
        now: evaluatedAt,
      },
    );
    if (authority.status !== "candidate") return blocked(authority.reason);
    if (authority.registryHash !== bundle.registryHash) {
      return blocked("prelaunch_authority_registry_identity_mismatch");
    }

    return Object.freeze({
      status: "candidate",
      reason: "runtime_file_bundle_path_acl_and_activation_required",
      verification: Object.freeze({
        ...authority.verification,
        bundleId: bundle.manifest.bundleId,
        bundleRevision: bundle.manifest.bundleRevision,
        bundleHash: bundle.bundleHash,
        trustPolicyId: bundle.trustPolicy.policyId,
        trustPolicyRevision: bundle.trustPolicy.policyRevision,
        trustPolicyHash: bundle.trustPolicyHash,
        prelaunchCheckedAt: evaluatedAt,
      }),
      runtimeCapabilityIssued: false,
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
    authorityFileBundleCore: "implemented_candidate",
    runtimeCapabilityIssued: false,
    callerSuppliedTimeAccepted: false,
    candidateReusableAsCapability: false,
  });
}
