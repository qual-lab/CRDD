import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { describeRootObservationContract } from "./root-observation.ts";

export const ROOT_PROTECTION_POLICY_CONTRACT =
  "crdd-coordinator/root-protection-policy";
export const ROOT_PROTECTION_POLICY_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "rootRole",
  "platformFamily",
  "filesystemClass",
  "observations",
]);
const OBSERVATION_KEYS = new Set([
  "rootExists",
  "stableIdentityObserved",
  "linkOrReparseObserved",
  "runtimeReadAllowed",
  "runtimeWriteAllowed",
  "writeAuthority",
  "untrustedWriteAllowed",
]);
const ROOT_ROLES = new Set(["runtime", "authority"]);
const PLATFORM_FAMILIES = new Set(["windows", "posix"]);
const FILESYSTEM_CLASSES = new Set(["local", "persistent_volume"]);
const WRITE_AUTHORITIES = new Set([
  "runtime_principal_only",
  "provisioner_principal_only",
]);
const INPUT_TOKEN_LENGTH = 32;

function response<const S extends string, T>(
  status: S,
  reason: string,
  policy: T | null = null,
) {
  return Object.freeze({
    status,
    reason,
    policy,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false,
  });
}

function normalizeObservations(rawObservations: unknown) {
  const observations = snapshotPlainRecord(rawObservations, OBSERVATION_KEYS);
  if (
    !observations ||
    [...OBSERVATION_KEYS]
      .filter((key) => key !== "writeAuthority")
      .some((key) => typeof observations[key] !== "boolean") ||
    typeof observations.writeAuthority !== "string" ||
    observations.writeAuthority.length === 0 ||
    observations.writeAuthority.length > INPUT_TOKEN_LENGTH ||
    !WRITE_AUTHORITIES.has(observations.writeAuthority)
  ) {
    return null;
  }
  return Object.freeze({
    rootExists: observations.rootExists as boolean,
    stableIdentityObserved: observations.stableIdentityObserved as boolean,
    linkOrReparseObserved: observations.linkOrReparseObserved as boolean,
    runtimeReadAllowed: observations.runtimeReadAllowed as boolean,
    runtimeWriteAllowed: observations.runtimeWriteAllowed as boolean,
    writeAuthority: observations.writeAuthority,
    untrustedWriteAllowed: observations.untrustedWriteAllowed as boolean,
  });
}

function policySummary(
  rootRole: string,
  platformFamily: string,
  filesystemClass: string,
  requiredWriteAuthority: string,
) {
  return Object.freeze({
    rootRole,
    platformFamily,
    filesystemClass,
    runtimeAccess: rootRole === "runtime" ? "read_write" : "read_only",
    requiredWriteAuthority,
    untrustedWriteAllowed: false,
    absolutePathReported: false,
  });
}

export function evaluateRootProtectionPolicyCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) return response("blocked", "root_protection_input_invalid");
    const rootRole = input.rootRole;
    const platformFamily = input.platformFamily;
    const filesystemClass = input.filesystemClass;
    if (
      typeof rootRole !== "string" ||
      rootRole.length === 0 ||
      rootRole.length > INPUT_TOKEN_LENGTH ||
      typeof platformFamily !== "string" ||
      platformFamily.length === 0 ||
      platformFamily.length > INPUT_TOKEN_LENGTH ||
      typeof filesystemClass !== "string" ||
      filesystemClass.length === 0 ||
      filesystemClass.length > INPUT_TOKEN_LENGTH
    ) {
      return response("blocked", "root_protection_input_invalid");
    }
    if (!ROOT_ROLES.has(rootRole)) {
      return response("blocked", "root_protection_role_invalid");
    }
    if (!PLATFORM_FAMILIES.has(platformFamily)) {
      return response("blocked", "root_protection_platform_unsupported");
    }
    if (!FILESYSTEM_CLASSES.has(filesystemClass)) {
      return response("blocked", "root_protection_filesystem_unsupported");
    }
    const observations = normalizeObservations(input.observations);
    if (!observations)
      return response("blocked", "root_protection_observations_invalid");
    if (!observations.rootExists)
      return response("blocked", "root_protection_root_missing");
    if (!observations.stableIdentityObserved) {
      return response("blocked", "root_protection_stable_identity_required");
    }
    if (observations.linkOrReparseObserved) {
      return response("blocked", "root_protection_link_or_reparse_rejected");
    }
    if (observations.untrustedWriteAllowed) {
      return response("blocked", "root_protection_untrusted_write_rejected");
    }
    if (
      rootRole === "runtime" &&
      (!observations.runtimeReadAllowed ||
        !observations.runtimeWriteAllowed ||
        observations.writeAuthority !== "runtime_principal_only")
    ) {
      return response("blocked", "runtime_root_access_policy_not_satisfied");
    }
    if (
      rootRole === "authority" &&
      (!observations.runtimeReadAllowed ||
        observations.runtimeWriteAllowed ||
        observations.writeAuthority !== "provisioner_principal_only")
    ) {
      return response("blocked", "authority_root_access_policy_not_satisfied");
    }
    return response(
      "candidate",
      "root_protection_platform_adapter_verification_required",
      policySummary(
        rootRole,
        platformFamily,
        filesystemClass,
        observations.writeAuthority,
      ),
    );
  } catch {
    return response("blocked", "root_protection_input_invalid");
  }
}

export function describeRootProtectionPolicyContract() {
  const rootObservation = describeRootObservationContract();
  return Object.freeze({
    contract: ROOT_PROTECTION_POLICY_CONTRACT,
    contractRevision: ROOT_PROTECTION_POLICY_CONTRACT_REVISION,
    supportedRootRoles: Object.freeze(["runtime", "authority"]),
    inputTokenLength: INPUT_TOKEN_LENGTH,
    supportedPlatformFamilies: Object.freeze(["windows", "posix"]),
    supportedFilesystemClasses: Object.freeze(["local", "persistent_volume"]),
    writeAuthorityValues: Object.freeze([
      "runtime_principal_only",
      "provisioner_principal_only",
    ]),
    runtimePrincipalMeaning: "selected_user_or_service_runtime_principal",
    provisionerPrincipalMeaning:
      "approved_admin_or_installer_provisioning_authority_set",
    unsupportedFilesystemClasses: Object.freeze([
      "network",
      "removable",
      "special",
      "unknown",
    ]),
    runtimeRootProtection:
      "runtime_principal_only_read_write_and_no_other_writer",
    authorityRootProtection:
      "provisioner_principal_only_write_runtime_read_only_and_no_other_writer",
    writerExclusivityScope:
      "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
    trustedPlatformAdministratorBoundary: Object.freeze([
      "windows_system_and_machine_administrators",
      "posix_root",
    ]),
    administratorOriginatedChangeDetection:
      "runtime_owned_revalidation_detects_observable_identity_protection_signature_trust_or_activation_change_and_fails_closed",
    administratorOriginatedObservableChangeResponse:
      "blocked_reverification_then_reprovision_only_after_trust_base_confirmed",
    confirmedOrSuspectedPlatformAdministratorCompromiseResponse:
      "blocked_platform_recovery_and_trust_base_reestablishment_required_before_reprovision",
    ambiguousAdministratorChangeClassification:
      "fail_closed_as_suspected_compromise",
    platformRecoveryImplementation: "not_implemented",
    completeOsOrVerifierCompromiseProtection: "not_guaranteed",
    protectionEffectOwner: "official_signed_platform_provisioner_only_target",
    runtimePermissionMutation: "prohibited",
    windowsProtectionTarget: Object.freeze({
      runtimeRoot: "runtime_sid_read_write_target",
      authorityRoot:
        "provisioner_or_approved_admin_write_runtime_sid_read_only_target",
      inheritance: "disabled_target",
      untrustedBroadWriteAces: "rejected_target",
    }),
    posixProtectionTarget: Object.freeze({
      runtimeRoot: "runtime_uid_owner_mode_0700_target",
      authorityRoot:
        "provisioner_or_root_owner_runtime_read_traverse_explicit_acl_target",
      unapprovedGroupOrOtherWrite: "rejected_target",
    }),
    persistentVolumeEligibility:
      "local_equivalent_stable_identity_durable_atomic_replace_and_equivalent_acl_required_target",
    unsupportedVolumeBehavior:
      "network_removable_special_or_unknown_blocked_target",
    rootProvisioning: "external_preprovision_required",
    callerObservationsAreAuthority: false,
    protectionPolicyCore: "implemented_candidate_claim_only",
    windowsDaclAdapter: rootObservation.windowsAdapter,
    posixRuntimeRootPrecheckEntry: "implemented_fail_closed",
    posixRuntimeRootModeObservation: "not_implemented",
    posixOwnerModeAdapter: "not_implemented",
    posixAclVerification: "not_implemented",
    runtimePrincipalBinding: "implemented_candidate_windows_only",
    persistentVolumeAdapter: "not_implemented",
    filesystemClassVerification:
      "implemented_candidate_windows_fixed_drive_only",
    pathBinding: "implemented_candidate_windows_stable_object_only",
    activationIntegration: "not_implemented",
    rootObservation,
    rootCreationIssued: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false,
  });
}
