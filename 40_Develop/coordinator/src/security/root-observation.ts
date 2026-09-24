/**
 * root-observationに属する責務をまとめる。
 *
 * @responsibility blockedを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
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

/**
 * root-observationを停止結果として構築する。
 *
 * @responsibility root-observationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rootIdentityHash: null,
    rootProtectionHash: null,
    identityObserved: false,
    protectionObserved: false,
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
    absolutePathReported: false,
    principalReported: false,
    aclReported: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * uint64 Big Endianを決定する。
 *
 * @responsibility uint64 Big Endianの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: number
 * @returns uint64BigEndianの計算結果を返す。
 * @precondition 「value: number」がuint64BigEndianの入力契約を満たす。
 * @postcondition uint64BigEndianの責務を完了した結果だけを返す。
 * @effect N/A: uint64BigEndianは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: uint64BigEndianは独自の失敗分岐を所有しない。
 * @invariant uint64BigEndianは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: uint64BigEndianはProcess内の同一Subsystemで完結する。
 * @security uint64BigEndianはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: uint64BigEndianは共有非同期状態を持たない同期処理である。
 */
function uint64BigEndian(value: number) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
}

/**
 * artifact Hashを決定する。
 *
 * @responsibility artifact Hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input domain: Buffer、value: Readonly<Record<string, unknown>>
 * @returns artifactHashの計算結果を返す。
 * @precondition 「domain: Buffer、value: Readonly<Record<string, unknown>>」がartifactHashの入力契約を満たす。
 * @postcondition artifactHashの責務を完了した結果だけを返す。
 * @effect N/A: artifactHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: artifactHashは独自の失敗分岐を所有しない。
 * @invariant artifactHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: artifactHashはProcess内の同一Subsystemで完結する。
 * @security artifactHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: artifactHashは共有非同期状態を持たない同期処理である。
 */
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

/**
 * integerを決定する。
 *
 * @responsibility integerの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns integerの計算結果を返す。
 * @precondition 「value: unknown」がintegerの入力契約を満たす。
 * @postcondition integerの責務を完了した結果だけを返す。
 * @effect N/A: integerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: integerは独自の失敗分岐を所有しない。
 * @invariant integerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: integerはProcess内の同一Subsystemで完結する。
 * @security integerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: integerは共有非同期状態を持たない同期処理である。
 */
function integer(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAXIMUM_ENTITIES
  );
}

/**
 * Windows Root Observation 候補を機械利用可能な契約へ変換する。
 *
 * @responsibility Windows Root Observation 候補の入力Schema、決定論的変換、変換不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawInput: unknown
 * @returns compileWindowsRootObservationCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がcompileWindowsRootObservationCandidateの入力契約を満たす。
 * @postcondition compileWindowsRootObservationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: compileWindowsRootObservationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure compileWindowsRootObservationCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant compileWindowsRootObservationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileWindowsRootObservationCandidateはProcess内の同一Subsystemで完結する。
 * @security compileWindowsRootObservationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileWindowsRootObservationCandidateは共有非同期状態を持たない同期処理である。
 */
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
        "selected_local_user_binding_caller_claim" ||
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
      selectedUserBindingVerified: false,
      runtimePrincipalBound: false,
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

/**
 * Windows Root Observation 候補を観測する。
 *
 * @responsibility Windows Root Observation 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input rootPath: unknown、rootRole: unknown
 * @returns inspectWindowsRootObservationCandidateの計算結果を返す。
 * @precondition 「rootPath: unknown、rootRole: unknown」がinspectWindowsRootObservationCandidateの入力契約を満たす。
 * @postcondition inspectWindowsRootObservationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectWindowsRootObservationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectWindowsRootObservationCandidateは独自の失敗分岐を所有しない。
 * @invariant inspectWindowsRootObservationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectWindowsRootObservationCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectWindowsRootObservationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectWindowsRootObservationCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectWindowsRootObservationCandidate(
  rootPath: unknown,
  rootRole: unknown,
) {
  void rootPath;
  void rootRole;
  return blocked("windows_root_effective_access_adapter_not_implemented");
}

/**
 * Root Observation 契約の公開契約を記述する。
 *
 * @responsibility Root Observation 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRootObservationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRootObservationContractの入力契約を満たす。
 * @postcondition describeRootObservationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRootObservationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRootObservationContractは独自の失敗分岐を所有しない。
 * @invariant describeRootObservationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRootObservationContractはProcess内の同一Subsystemで完結する。
 * @security describeRootObservationContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRootObservationContractは共有非同期状態を持たない同期処理である。
 */
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
    runtimePrincipalBindingInput:
      "selected_local_user_binding_caller_claim_non_authority",
    selectedUserBinding: "not_implemented_blocked",
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
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
