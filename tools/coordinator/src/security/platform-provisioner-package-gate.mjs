import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { verifyPlatformProvisionerManifestCandidate } from
  "./platform-provisioner-trust-core.mjs";

const INPUT_KEYS = new Set([
  "manifestVerificationInput", "crddDistributionObservation", "expectedCrddRevision"
]);
const OBSERVATION_KEYS = new Set([
  "packageName", "packageVersion", "packageContentRootSha256", "crddRevision",
  "distributionVerdict",
  "bundledPackageIdentityStable", "permissionPolicyMatch"
]);
const MANIFEST_INPUT_KEYS = new Set([
  "manifestEnvelope", "releaseSignerSpkiDer", "observedPackageContent", "evaluationTime"
]);
const HEX64 = /^[0-9a-f]{64}$/u;
const CRDD_REVISION = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

function response(status, reason, fields = {}) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    crddDistributionObservationRuntimeOwned: false,
    releaseIdentityRuntimeOwned: false,
    packageFilesystemRuntimeOwned: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function normalizeObservation(raw) {
  const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (!value || typeof value.packageName !== "string" || typeof value.packageVersion !== "string" ||
      typeof value.packageContentRootSha256 !== "string" ||
      !HEX64.test(value.packageContentRootSha256) ||
      typeof value.crddRevision !== "string" || !CRDD_REVISION.test(value.crddRevision) ||
      value.distributionVerdict !== "verified_crdd_bundle" ||
      value.bundledPackageIdentityStable !== true || value.permissionPolicyMatch !== true) return null;
  return value;
}

export function evaluatePlatformProvisionerPackageGateCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || typeof input.expectedCrddRevision !== "string" ||
        !CRDD_REVISION.test(input.expectedCrddRevision)) {
      return response("blocked", "platform_provisioner_package_gate_input_invalid");
    }
    const observation = normalizeObservation(input.crddDistributionObservation);
    const manifestInput = snapshotPlainRecord(input.manifestVerificationInput, MANIFEST_INPUT_KEYS);
    const manifest = manifestInput
      ? verifyPlatformProvisionerManifestCandidate(manifestInput)
      : response("blocked", "platform_provisioner_manifest_input_invalid");
    if (!observation || manifest.status !== "candidate") {
      return response("blocked", "platform_provisioner_package_gate_verification_failed");
    }
    if (observation.packageName !== manifest.packageName ||
        observation.packageVersion !== manifest.packageVersion ||
        observation.packageContentRootSha256 !== manifest.packageContentRootSha256 ||
        observation.crddRevision !== manifest.crddRevision ||
        observation.crddRevision !== input.expectedCrddRevision) {
      return response("blocked", "platform_provisioner_package_gate_binding_mismatch");
    }
    return response("candidate",
      "runtime_owned_crdd_distribution_package_filesystem_and_effect_controller_required", {
        packageName: manifest.packageName,
        packageVersion: manifest.packageVersion,
        manifestHash: manifest.manifestHash,
        packageTrustObservationMatch: true
      });
  } catch {
    return response("blocked", "platform_provisioner_package_gate_input_invalid");
  }
}

export function describePlatformProvisionerPackageGateContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-gate",
    contractRevision: 1,
    distributionModel: "crdd_bundled_private_mjs_package",
    observationContract: "implemented_candidate_non_authoritative",
    manifestVerificationReuse: "implemented_candidate",
    packageIdentityBinding: "implemented_candidate",
    packageContentRootBinding: "implemented_candidate",
    crddRevisionBinding: "implemented_candidate",
    runtimeOwnedCrddDistributionAdapter: "not_implemented",
    runtimeOwnedPackageFilesystemAdapter: "not_implemented",
    runtimeOwnedReleaseIdentitySelection: "not_implemented",
    effectController: "not_implemented",
    callerObservationMayAuthorizeEffect: false,
    standalonePackageMayAuthorizeEffect: false,
    unverifiedSourceCheckoutMayAuthorizeEffect: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false
  });
}
