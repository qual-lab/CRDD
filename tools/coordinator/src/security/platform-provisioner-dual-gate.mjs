import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { verifyPlatformProvisionerManifestCandidate } from
  "./platform-provisioner-trust-core.mjs";

const INPUT_KEYS = new Set([
  "manifestVerificationInput", "npmObservation", "expectedSourceRepository"
]);
const OBSERVATION_KEYS = new Set([
  "packageName", "packageVersion", "packageContentRootSha256",
  "registrySignatureVerdict", "provenanceVerdict", "provenanceSourceRepository",
  "installedPackageIdentityStable", "permissionPolicyMatch"
]);
const MANIFEST_INPUT_KEYS = new Set([
  "manifestEnvelope", "releaseSignerSpkiDer", "observedPackageContent", "evaluationTime"
]);
const HEX64 = /^[0-9a-f]{64}$/u;
const HTTPS_REPOSITORY = /^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._/-]+$/u;

function response(status, reason, fields = {}) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    npmObservationRuntimeOwned: false,
    releaseIdentityRuntimeOwned: false,
    packageFilesystemRuntimeOwned: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function repository(value) {
  return typeof value === "string" && value.length <= 2_048 && HTTPS_REPOSITORY.test(value) &&
    !value.includes("..") && !value.endsWith("/");
}

function normalizeObservation(raw) {
  const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (!value || typeof value.packageName !== "string" || typeof value.packageVersion !== "string" ||
      typeof value.packageContentRootSha256 !== "string" ||
      !HEX64.test(value.packageContentRootSha256) ||
      value.registrySignatureVerdict !== "verified" ||
      value.provenanceVerdict !== "verified" || !repository(value.provenanceSourceRepository) ||
      value.installedPackageIdentityStable !== true || value.permissionPolicyMatch !== true) return null;
  return value;
}

export function evaluatePlatformProvisionerPackageGateCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || !repository(input.expectedSourceRepository)) {
      return response("blocked", "platform_provisioner_package_gate_input_invalid");
    }
    const observation = normalizeObservation(input.npmObservation);
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
        observation.provenanceSourceRepository !== input.expectedSourceRepository) {
      return response("blocked", "platform_provisioner_package_gate_binding_mismatch");
    }
    return response("candidate",
      "runtime_owned_npm_attestation_package_filesystem_and_effect_controller_required", {
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
    distributionModel: "mjs_npm_package",
    observationContract: "implemented_candidate_non_authoritative",
    manifestVerificationReuse: "implemented_candidate",
    packageIdentityBinding: "implemented_candidate",
    packageContentRootBinding: "implemented_candidate",
    provenanceSourceBinding: "implemented_candidate",
    runtimeOwnedNpmRegistrySignatureAdapter: "not_implemented",
    runtimeOwnedNpmProvenanceAdapter: "not_implemented",
    runtimeOwnedPackageFilesystemAdapter: "not_implemented",
    runtimeOwnedReleaseIdentitySelection: "not_implemented",
    effectController: "not_implemented",
    callerObservationMayAuthorizeEffect: false,
    sourceCheckoutMayAuthorizeEffect: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false
  });
}
