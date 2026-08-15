import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { verifyPlatformProvisionerManifestCandidate } from
  "./platform-provisioner-trust-core.mjs";

const INPUT_KEYS = new Set([
  "manifestVerificationInput", "nativeObservation", "expectedNativeSignerIdentitySha256"
]);
const OBSERVATION_KEYS = new Set([
  "platform", "verifier", "verdict", "signerIdentitySha256", "executableSha256",
  "fileIdentityStable", "permissionPolicyMatch"
]);
const MANIFEST_INPUT_KEYS = new Set([
  "manifestEnvelope", "releaseSignerSpkiDer", "observedExecutableSha256", "evaluationTime"
]);
const HEX64 = /^[0-9a-f]{64}$/u;
const VERIFIERS = Object.freeze({
  windows: "winverifytrust",
  macos: "secstaticcodecheckvalidity",
  linux: "distribution_package_signature"
});

function response(status, reason, fields = {}) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    nativeObservationRuntimeOwned: false,
    releaseIdentityRuntimeOwned: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function normalizeObservation(raw) {
  const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (!value || !Object.hasOwn(VERIFIERS, value.platform) ||
      value.verifier !== VERIFIERS[value.platform] || value.verdict !== "valid" ||
      !HEX64.test(value.signerIdentitySha256) || !HEX64.test(value.executableSha256) ||
      value.fileIdentityStable !== true || value.permissionPolicyMatch !== true) return null;
  return value;
}

export function evaluatePlatformProvisionerDualGateCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || !HEX64.test(input.expectedNativeSignerIdentitySha256)) {
      return response("blocked", "platform_provisioner_dual_gate_input_invalid");
    }
    const observation = normalizeObservation(input.nativeObservation);
    const manifestInput = snapshotPlainRecord(input.manifestVerificationInput, MANIFEST_INPUT_KEYS);
    const manifest = manifestInput
      ? verifyPlatformProvisionerManifestCandidate(manifestInput)
      : response("blocked", "platform_provisioner_manifest_input_invalid");
    if (!observation || manifest.status !== "candidate") {
      return response("blocked", "platform_provisioner_dual_gate_verification_failed");
    }
    if (observation.platform !== manifest.platform ||
        observation.executableSha256 !== manifestInput.observedExecutableSha256 ||
        observation.signerIdentitySha256 !== input.expectedNativeSignerIdentitySha256) {
      return response("blocked", "platform_provisioner_dual_gate_binding_mismatch");
    }
    return response("candidate",
      "runtime_owned_native_adapter_release_identity_and_effect_controller_required", {
        platform: manifest.platform,
        architecture: manifest.architecture,
        provisionerVersion: manifest.provisionerVersion,
        manifestHash: manifest.manifestHash,
        dualVerificationObservationMatch: true
      });
  } catch {
    return response("blocked", "platform_provisioner_dual_gate_input_invalid");
  }
}

export function describePlatformProvisionerDualGateContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-dual-gate",
    contractRevision: 1,
    supportedVerifierKinds: Object.freeze({ ...VERIFIERS }),
    observationContract: "implemented_candidate_non_authoritative",
    manifestVerificationReuse: "implemented_candidate",
    executableDigestBinding: "implemented_candidate",
    nativeSignerIdentityBinding: "implemented_candidate",
    fileIdentityAndPermissionBinding: "implemented_candidate",
    runtimeOwnedNativeAdapters: "not_implemented",
    runtimeOwnedReleaseIdentitySelection: "not_implemented",
    effectController: "not_implemented",
    callerObservationMayAuthorizeEffect: false,
    localDevelopmentMayAuthorizeEffect: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false
  });
}
