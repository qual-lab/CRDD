import { createHash } from "node:crypto";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { describePlatformAccessAdapterContract } from "./platform-access-adapter.ts";

export const ROOT_IDENTITY_OBSERVATION_CONTRACT =
  "crdd-coordinator/root-identity-observation";
export const ROOT_PROTECTION_OBSERVATION_CONTRACT =
  "crdd-coordinator/root-protection-observation";
export const ROOT_OBSERVATION_CONTRACT_REVISION = 1;
export const ROOT_IDENTITY_OBSERVATION_DOMAIN =
  "CRDD\0ROOT-IDENTITY-OBSERVATION\0V1\0";
export const ROOT_PROTECTION_OBSERVATION_DOMAIN =
  "CRDD\0ROOT-PROTECTION-OBSERVATION\0V1\0";

const rootIdentityDomain = Buffer.from(
  ROOT_IDENTITY_OBSERVATION_DOMAIN,
  "ascii",
);
const rootProtectionDomain = Buffer.from(
  ROOT_PROTECTION_OBSERVATION_DOMAIN,
  "ascii",
);
const ROOT_ROLES = new Set(["runtime", "authority"]);
const OBSERVATION_KEYS = new Set([
  "allOwnersTrusted",
  "entityCount",
  "filesystemClass",
  "objectBirthtimeNanoseconds",
  "objectDeviceId",
  "objectFileId",
  "otherWriteAceCount",
  "reparsePointCount",
  "rootDaclProtected",
  "rootRole",
  "runtimeDenyAceCount",
  "runtimePrincipalIdentityHash",
  "runtimePrincipalBinding",
  "runtimeReadExecuteEntityCount",
  "runtimeRootInheritanceRuleCount",
  "runtimeWriteEntityCount",
]);
const MAXIMUM_ENTITIES = 2_049;
const HEX64 = /^[0-9a-f]{64}$/u;
const DECIMAL_IDENTITY = /^[1-9][0-9]{0,39}$/u;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rootIdentityHash: null,
    rootProtectionHash: null,
    identityObserved: false,
    protectionObserved: false,
    absolutePathReported: false,
    principalReported: false,
    aclReported: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

function uint64BigEndian(value: number) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
}

function artifactHash(
  domain: Buffer,
  value: Readonly<Record<string, unknown>>,
) {
  const canonicalBytes = Buffer.from(JSON.stringify(value), "utf8");
  return createHash("sha256")
    .update(domain)
    .update(uint64BigEndian(canonicalBytes.byteLength))
    .update(canonicalBytes)
    .digest("hex");
}

function integer(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAXIMUM_ENTITIES
  );
}

export function compileWindowsRootObservationCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, OBSERVATION_KEYS);
    if (
      !input ||
      !ROOT_ROLES.has(input.rootRole as string) ||
      input.filesystemClass !== "local" ||
      typeof input.allOwnersTrusted !== "boolean" ||
      typeof input.rootDaclProtected !== "boolean" ||
      !integer(input.entityCount) ||
      input.entityCount === 0 ||
      !integer(input.otherWriteAceCount) ||
      !integer(input.reparsePointCount) ||
      !integer(input.runtimeDenyAceCount) ||
      !integer(input.runtimeReadExecuteEntityCount) ||
      !integer(input.runtimeRootInheritanceRuleCount) ||
      !integer(input.runtimeWriteEntityCount) ||
      typeof input.runtimePrincipalIdentityHash !== "string" ||
      !HEX64.test(input.runtimePrincipalIdentityHash) ||
      input.runtimePrincipalBinding !==
        "selected_local_user_verified_candidate_input" ||
      typeof input.objectDeviceId !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectDeviceId) ||
      typeof input.objectFileId !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectFileId) ||
      typeof input.objectBirthtimeNanoseconds !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectBirthtimeNanoseconds)
    ) {
      return blocked("windows_root_observation_invalid");
    }
    const entityCount = input.entityCount as number;
    const isRuntimeRoot = input.rootRole === "runtime";
    if (
      !input.rootDaclProtected ||
      !input.allOwnersTrusted ||
      input.otherWriteAceCount !== 0 ||
      input.reparsePointCount !== 0 ||
      input.runtimeDenyAceCount !== 0 ||
      input.runtimeReadExecuteEntityCount !== entityCount ||
      input.runtimeRootInheritanceRuleCount !== 1 ||
      (isRuntimeRoot
        ? input.runtimeWriteEntityCount !== entityCount
        : input.runtimeWriteEntityCount !== 0)
    ) {
      return blocked("windows_root_protection_not_satisfied");
    }
    const identityArtifact = Object.freeze({
      contract: ROOT_IDENTITY_OBSERVATION_CONTRACT,
      contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
      filesystemClass: "local",
      objectBirthtimeNanoseconds: input.objectBirthtimeNanoseconds,
      objectDeviceId: input.objectDeviceId,
      objectFileId: input.objectFileId,
      platformFamily: "windows",
    });
    const protectionArtifact = Object.freeze({
      contract: ROOT_PROTECTION_OBSERVATION_CONTRACT,
      contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
      filesystemClass: "local",
      platformFamily: "windows",
      rootRole: input.rootRole,
      runtimeAccess: isRuntimeRoot ? "read_write" : "read_only",
      runtimePrincipalIdentityHash: input.runtimePrincipalIdentityHash,
      runtimePrincipalBinding: input.runtimePrincipalBinding,
      untrustedWriteAllowed: false,
      writeAuthority: isRuntimeRoot
        ? "runtime_principal_only"
        : "provisioner_principal_only",
      writerExclusivity:
        "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
    });
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_root_identity_and_protection_observed_candidate",
      rootIdentityHash: artifactHash(rootIdentityDomain, identityArtifact),
      rootProtectionHash: artifactHash(
        rootProtectionDomain,
        protectionArtifact,
      ),
      identityObserved: true,
      protectionObserved: true,
      absolutePathReported: false,
      principalReported: false,
      aclReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("windows_root_observation_invalid");
  }
}

export function inspectWindowsRootObservationCandidate(
  rootPath: unknown,
  rootRole: unknown,
) {
  void rootPath;
  void rootRole;
  return blocked("windows_root_effective_access_adapter_not_implemented");
}

export function describeRootObservationContract() {
  const platformAccess = describePlatformAccessAdapterContract();
  return Object.freeze({
    identityContract: ROOT_IDENTITY_OBSERVATION_CONTRACT,
    protectionContract: ROOT_PROTECTION_OBSERVATION_CONTRACT,
    contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
    identityDomain: ROOT_IDENTITY_OBSERVATION_DOMAIN,
    protectionDomain: ROOT_PROTECTION_OBSERVATION_DOMAIN,
    domainFraming:
      "implemented_candidate_artifact_specific_prefix_uint64be_length_canonical_payload",
    identityInputs:
      "windows_device_file_and_birthtime_identity_without_path_disclosure",
    protectionInputs:
      "windows_fixed_drive_dacl_role_runtime_principal_and_writer_exclusivity",
    windowsObservationCore: platformAccess.windowsCurrentProcessAccessCore,
    windowsBinaryReleaseIdentityBinding:
      platformAccess.binaryReleaseIdentityBinding,
    windowsProcessInvocation: platformAccess.productionInvocation,
    windowsAdapter: "not_implemented_observation_mapping_required",
    selectedUserBinding: "not_implemented_blocked",
    posixAdapter: "not_implemented",
    rawIdentityReported: false,
    rawProtectionReported: false,
    absolutePathReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
