import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

export const ROOT_PROTECTION_POLICY_CONTRACT = "crdd-coordinator/root-protection-policy";
export const ROOT_PROTECTION_POLICY_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "rootRole",
  "platformFamily",
  "filesystemClass",
  "observations"
]);
const OBSERVATION_KEYS = new Set([
  "rootExists",
  "stableIdentityObserved",
  "linkOrReparseObserved",
  "runtimeReadAllowed",
  "runtimeWriteAllowed",
  "writeAuthority",
  "untrustedWriteAllowed"
]);
const ROOT_ROLES = new Set(["runtime", "authority"]);
const PLATFORM_FAMILIES = new Set(["windows", "posix"]);
const FILESYSTEM_CLASSES = new Set(["local", "persistent_volume"]);
const WRITE_AUTHORITIES = new Set(["runtime_principal_only", "provisioner_principal_only"]);
const INPUT_TOKEN_LENGTH = 32;

function response(status, reason, policy = null) {
  return Object.freeze({
    status,
    reason,
    policy,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false
  });
}

function normalizeObservations(rawObservations) {
  const observations = snapshotPlainRecord(rawObservations, OBSERVATION_KEYS);
  if (!observations || [...OBSERVATION_KEYS].filter((key) => key !== "writeAuthority")
    .some((key) => typeof observations[key] !== "boolean") ||
    typeof observations.writeAuthority !== "string" ||
    observations.writeAuthority.length === 0 ||
    observations.writeAuthority.length > INPUT_TOKEN_LENGTH ||
    !WRITE_AUTHORITIES.has(observations.writeAuthority)) {
    return null;
  }
  return observations;
}

function policySummary(rootRole, platformFamily, filesystemClass, requiredWriteAuthority) {
  return Object.freeze({
    rootRole,
    platformFamily,
    filesystemClass,
    runtimeAccess: rootRole === "runtime" ? "read_write" : "read_only",
    requiredWriteAuthority,
    untrustedWriteAllowed: false,
    absolutePathReported: false
  });
}

export function evaluateRootProtectionPolicyCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) return response("blocked", "root_protection_input_invalid");
    if ([input.rootRole, input.platformFamily, input.filesystemClass].some((value) =>
      typeof value !== "string" || value.length === 0 || value.length > INPUT_TOKEN_LENGTH)) {
      return response("blocked", "root_protection_input_invalid");
    }
    if (!ROOT_ROLES.has(input.rootRole)) {
      return response("blocked", "root_protection_role_invalid");
    }
    if (!PLATFORM_FAMILIES.has(input.platformFamily)) {
      return response("blocked", "root_protection_platform_unsupported");
    }
    if (!FILESYSTEM_CLASSES.has(input.filesystemClass)) {
      return response("blocked", "root_protection_filesystem_unsupported");
    }
    const observations = normalizeObservations(input.observations);
    if (!observations) return response("blocked", "root_protection_observations_invalid");
    if (!observations.rootExists) return response("blocked", "root_protection_root_missing");
    if (!observations.stableIdentityObserved) {
      return response("blocked", "root_protection_stable_identity_required");
    }
    if (observations.linkOrReparseObserved) {
      return response("blocked", "root_protection_link_or_reparse_rejected");
    }
    if (observations.untrustedWriteAllowed) {
      return response("blocked", "root_protection_untrusted_write_rejected");
    }
    if (input.rootRole === "runtime" &&
        (!observations.runtimeReadAllowed || !observations.runtimeWriteAllowed ||
         observations.writeAuthority !== "runtime_principal_only")) {
      return response("blocked", "runtime_root_access_policy_not_satisfied");
    }
    if (input.rootRole === "authority" &&
        (!observations.runtimeReadAllowed || observations.runtimeWriteAllowed ||
         observations.writeAuthority !== "provisioner_principal_only")) {
      return response("blocked", "authority_root_access_policy_not_satisfied");
    }
    return response(
      "candidate",
      "root_protection_platform_adapter_verification_required",
      policySummary(input.rootRole, input.platformFamily, input.filesystemClass,
        observations.writeAuthority)
    );
  } catch {
    return response("blocked", "root_protection_input_invalid");
  }
}

export function describeRootProtectionPolicyContract() {
  return Object.freeze({
    contract: ROOT_PROTECTION_POLICY_CONTRACT,
    contractRevision: ROOT_PROTECTION_POLICY_CONTRACT_REVISION,
    supportedRootRoles: Object.freeze(["runtime", "authority"]),
    inputTokenLength: INPUT_TOKEN_LENGTH,
    supportedPlatformFamilies: Object.freeze(["windows", "posix"]),
    supportedFilesystemClasses: Object.freeze(["local", "persistent_volume"]),
    writeAuthorityValues: Object.freeze(["runtime_principal_only", "provisioner_principal_only"]),
    runtimePrincipalMeaning: "selected_user_or_service_runtime_principal",
    provisionerPrincipalMeaning: "approved_admin_or_installer_provisioning_authority_set",
    unsupportedFilesystemClasses: Object.freeze(["network", "removable", "special", "unknown"]),
    runtimeRootProtection: "runtime_read_write_and_no_untrusted_write",
    authorityRootProtection: "provisioner_write_runtime_read_only_and_no_untrusted_write",
    rootProvisioning: "external_preprovision_required",
    callerObservationsAreAuthority: false,
    protectionPolicyCore: "implemented_candidate_claim_only",
    windowsDaclAdapter: "not_implemented",
    posixOwnerModeAdapter: "not_implemented",
    persistentVolumeAdapter: "not_implemented",
    pathBinding: "not_implemented",
    activationIntegration: "not_implemented",
    rootCreationIssued: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false
  });
}
