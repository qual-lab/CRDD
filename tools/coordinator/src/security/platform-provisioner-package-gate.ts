import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { verifyPlatformProvisionerManifestCandidate } from "./platform-provisioner-trust-core.ts";

const INPUT_KEYS = new Set([
  "manifestVerificationInput",
  "crddDistributionObservation",
  "expectedCrddVersion",
  "expectedCrddCommit",
  "expectedCrddTree",
]);
const OBSERVATION_KEYS = new Set([
  "packageName",
  "packageVersion",
  "packageContentRootSha256",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "distributionVerdict",
  "bundledPackageIdentityStable",
  "permissionPolicyMatch",
]);
const MANIFEST_INPUT_KEYS = new Set([
  "manifestEnvelope",
  "releaseSignerSpkiDer",
  "observedPackageContent",
  "evaluationTime",
]);
const HEX64 = /^[0-9a-f]{64}$/u;
const CRDD_GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;

function response<
  S extends "candidate" | "blocked",
  T extends Record<string, unknown>,
>(status: S, reason: string, fields: T) {
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
    networkEffectIssued: false,
  });
}

function normalizeObservation(raw: unknown) {
  const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (
    !value ||
    typeof value.packageName !== "string" ||
    typeof value.packageVersion !== "string" ||
    typeof value.packageContentRootSha256 !== "string" ||
    !HEX64.test(value.packageContentRootSha256) ||
    typeof value.crddVersion !== "string" ||
    !CRDD_VERSION.test(value.crddVersion) ||
    typeof value.crddCommit !== "string" ||
    !CRDD_GIT_OBJECT_ID.test(value.crddCommit) ||
    typeof value.crddTree !== "string" ||
    !CRDD_GIT_OBJECT_ID.test(value.crddTree) ||
    value.distributionVerdict !== "verified_crdd_bundle" ||
    value.bundledPackageIdentityStable !== true ||
    value.permissionPolicyMatch !== true
  )
    return null;
  return value;
}

export function evaluatePlatformProvisionerPackageGateCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (
      !input ||
      typeof input.expectedCrddVersion !== "string" ||
      !CRDD_VERSION.test(input.expectedCrddVersion) ||
      typeof input.expectedCrddCommit !== "string" ||
      !CRDD_GIT_OBJECT_ID.test(input.expectedCrddCommit) ||
      typeof input.expectedCrddTree !== "string" ||
      !CRDD_GIT_OBJECT_ID.test(input.expectedCrddTree)
    ) {
      return response(
        "blocked",
        "platform_provisioner_package_gate_input_invalid",
        {},
      );
    }
    const observation = normalizeObservation(input.crddDistributionObservation);
    const manifestInput = snapshotPlainRecord(
      input.manifestVerificationInput,
      MANIFEST_INPUT_KEYS,
    );
    const manifest = manifestInput
      ? verifyPlatformProvisionerManifestCandidate(manifestInput)
      : response("blocked", "platform_provisioner_manifest_input_invalid", {});
    if (!observation || manifest.status !== "candidate") {
      return response(
        "blocked",
        "platform_provisioner_package_gate_verification_failed",
        {},
      );
    }
    if (
      observation.packageName !== manifest.packageName ||
      observation.packageVersion !== manifest.packageVersion ||
      observation.packageContentRootSha256 !==
        manifest.packageContentRootSha256 ||
      observation.crddVersion !== manifest.crddVersion ||
      observation.crddVersion !== input.expectedCrddVersion ||
      observation.crddCommit !== manifest.crddCommit ||
      observation.crddCommit !== input.expectedCrddCommit ||
      observation.crddTree !== manifest.crddTree ||
      observation.crddTree !== input.expectedCrddTree
    ) {
      return response(
        "blocked",
        "platform_provisioner_package_gate_binding_mismatch",
        {},
      );
    }
    return response(
      "candidate",
      "runtime_owned_crdd_distribution_package_filesystem_and_effect_controller_required",
      {
        packageName: manifest.packageName,
        packageVersion: manifest.packageVersion,
        manifestHash: manifest.manifestHash,
        packageTrustObservationMatch: true,
      },
    );
  } catch {
    return response(
      "blocked",
      "platform_provisioner_package_gate_input_invalid",
      {},
    );
  }
}

export function describePlatformProvisionerPackageGateContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-gate",
    contractRevision: 1,
    distributionModel: "crdd_bundled_private_typescript_package",
    observationContract: "implemented_candidate_non_authoritative",
    manifestVerificationReuse: "implemented_candidate",
    packageIdentityBinding: "implemented_candidate",
    packageContentRootBinding: "implemented_candidate",
    crddVersionCommitAndTreeBinding: "implemented_candidate",
    runtimeOwnedCrddDistributionAdapter: "not_implemented",
    runtimeOwnedPackageFilesystemAdapter: "not_implemented",
    runtimeOwnedReleaseIdentitySelection: "not_implemented",
    effectController: "implemented_fixed_distribution_candidate",
    callerObservationMayAuthorizeEffect: false,
    standalonePackageMayAuthorizeEffect: false,
    unverifiedSourceCheckoutMayAuthorizeEffect: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
