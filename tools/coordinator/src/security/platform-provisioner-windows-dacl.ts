import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { describePlatformAccessAdapterContract } from "./platform-access-adapter.ts";

const OBSERVATION_KEYS = new Set([
  "entityCount",
  "rootDaclProtected",
  "allOwnersTrusted",
  "untrustedWriteAceCount",
  "runtimeReadExecuteEntityCount",
  "runtimeRootInheritanceRuleCount",
  "runtimeWriteAceCount",
  "runtimeDenyAceCount",
  "reparsePointCount",
]);
const MAXIMUM_ENTITIES = 2_049;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    entityCount: null,
    writePolicyConfirmed: false,
    runtimeReadConfirmed: false,
    runtimePrincipalBound: false,
    permissionMutationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

export function evaluateWindowsPackageDaclObservationCandidate(raw: unknown) {
  try {
    const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
    if (
      !value ||
      typeof value.entityCount !== "number" ||
      !Number.isSafeInteger(value.entityCount) ||
      value.entityCount < 1 ||
      value.entityCount > MAXIMUM_ENTITIES ||
      typeof value.rootDaclProtected !== "boolean" ||
      typeof value.allOwnersTrusted !== "boolean" ||
      typeof value.untrustedWriteAceCount !== "number" ||
      !Number.isSafeInteger(value.untrustedWriteAceCount) ||
      value.untrustedWriteAceCount < 0 ||
      typeof value.runtimeReadExecuteEntityCount !== "number" ||
      !Number.isSafeInteger(value.runtimeReadExecuteEntityCount) ||
      value.runtimeReadExecuteEntityCount < 0 ||
      typeof value.runtimeRootInheritanceRuleCount !== "number" ||
      !Number.isSafeInteger(value.runtimeRootInheritanceRuleCount) ||
      value.runtimeRootInheritanceRuleCount < 0 ||
      typeof value.runtimeWriteAceCount !== "number" ||
      !Number.isSafeInteger(value.runtimeWriteAceCount) ||
      value.runtimeWriteAceCount < 0 ||
      typeof value.runtimeDenyAceCount !== "number" ||
      !Number.isSafeInteger(value.runtimeDenyAceCount) ||
      value.runtimeDenyAceCount < 0 ||
      typeof value.reparsePointCount !== "number" ||
      !Number.isSafeInteger(value.reparsePointCount) ||
      value.reparsePointCount < 0
    ) {
      return blocked("windows_package_dacl_observation_invalid");
    }
    if (value.reparsePointCount !== 0) {
      return blocked("windows_package_dacl_reparse_rejected");
    }
    if (!value.rootDaclProtected) {
      return blocked("windows_package_dacl_inheritance_not_protected");
    }
    if (!value.allOwnersTrusted) {
      return blocked("windows_package_dacl_owner_not_trusted");
    }
    if (value.untrustedWriteAceCount !== 0) {
      return blocked("windows_package_dacl_untrusted_write_rejected");
    }
    if (value.runtimeWriteAceCount !== 0) {
      return blocked("windows_package_dacl_runtime_write_rejected");
    }
    if (value.runtimeDenyAceCount !== 0) {
      return blocked("windows_package_dacl_runtime_deny_rejected");
    }
    if (value.runtimeRootInheritanceRuleCount !== 1) {
      return blocked("windows_package_dacl_runtime_root_rule_invalid");
    }
    if (value.runtimeReadExecuteEntityCount !== value.entityCount) {
      return blocked("windows_package_dacl_runtime_read_execute_incomplete");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_package_dacl_structural_claim_candidate",
      entityCount: value.entityCount,
      writePolicyConfirmed: false,
      runtimeReadConfirmed: false,
      runtimePrincipalBound: false,
      permissionMutationIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("windows_package_dacl_observation_invalid");
  }
}

export function inspectWindowsPackageDaclCandidate(
  packageRoot: unknown,
  runtimePrincipalSid?: unknown,
) {
  void packageRoot;
  void runtimePrincipalSid;
  return blocked("windows_package_effective_access_adapter_not_implemented");
}

export function applyWindowsProvisionerInstallDaclForEffect(
  installRoot: unknown,
  runtimePrincipalSid?: unknown,
) {
  void installRoot;
  void runtimePrincipalSid;
  return blocked("windows_package_effective_access_adapter_not_implemented");
}

export function describeWindowsPackageDaclContract() {
  const platformAccess = describePlatformAccessAdapterContract();
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-windows-dacl",
    contractRevision: 1,
    structuralClaimEvaluator: "implemented_candidate_non_authoritative",
    rustObservationCore: platformAccess.windowsCurrentProcessAccessCore,
    binaryReleaseIdentityBinding: platformAccess.binaryReleaseIdentityBinding,
    processInvocation: platformAccess.productionInvocation,
    observer: "not_implemented_observation_mapping_required",
    trustedWriterSids: Object.freeze(["S-1-5-18", "S-1-5-32-544"]),
    rootInheritance: "protected_required",
    untrustedWriteAcePolicy: "rejected",
    ownerPolicy: "system_or_machine_administrators_required",
    recursiveEntityLimit: MAXIMUM_ENTITIES,
    runtimePrincipalSelection: "not_implemented_effective_token_required",
    runtimeReadBinding: "not_implemented_effective_access_required",
    runtimeReadExecuteRule:
      "target_single_explicit_root_inheritable_allow_and_effective_on_every_entity",
    runtimeWritePolicy: "rejected",
    runtimeDenyPolicy: "rejected",
    permissionMutation: "not_implemented_effective_access_required",
    verification: "not_implemented_effective_access_required",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
