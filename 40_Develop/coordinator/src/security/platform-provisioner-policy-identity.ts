/**
 * platform-provisioner-policy-identityに属する責務をまとめる。
 *
 * @responsibility canonicalPolicyHashを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { createHash } from "node:crypto";

import { describePlatformKeyStoragePolicyContract } from "./platform-key-storage-policy.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";
import { describeRootProtectionPolicyContract } from "./root-protection-policy.ts";

/**
 * canonical Policy Hashを決定する。
 *
 * @responsibility canonical Policy Hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input policy: unknown
 * @returns canonicalPolicyHashの計算結果を返す。
 * @precondition 「policy: unknown」がcanonicalPolicyHashの入力契約を満たす。
 * @postcondition canonicalPolicyHashの責務を完了した結果だけを返す。
 * @effect N/A: canonicalPolicyHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure canonicalPolicyHashは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant canonicalPolicyHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalPolicyHashはProcess内の同一Subsystemで完結する。
 * @security canonicalPolicyHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalPolicyHashは共有非同期状態を持たない同期処理である。
 */
function canonicalPolicyHash(policy: unknown) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(policy);
  if (canonical.status !== "candidate") {
    throw new Error("platform_provisioner_policy_identity_invalid");
  }
  return createHash("sha256").update(canonical.canonicalBytes).digest("hex");
}

/**
 * Platform Provisioner Policy Identityを取得する。
 *
 * @responsibility Platform Provisioner Policy Identityの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns getPlatformProvisionerPolicyIdentityの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がgetPlatformProvisionerPolicyIdentityの入力契約を満たす。
 * @postcondition getPlatformProvisionerPolicyIdentityの責務を完了した結果だけを返す。
 * @effect N/A: getPlatformProvisionerPolicyIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getPlatformProvisionerPolicyIdentityは独自の失敗分岐を所有しない。
 * @invariant getPlatformProvisionerPolicyIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getPlatformProvisionerPolicyIdentityはProcess内の同一Subsystemで完結する。
 * @security getPlatformProvisionerPolicyIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: getPlatformProvisionerPolicyIdentityは共有非同期状態を持たない同期処理である。
 */
export function getPlatformProvisionerPolicyIdentity() {
  return Object.freeze({
    rootProtectionPolicySha256: canonicalPolicyHash(
      describeRootProtectionPolicyContract(),
    ),
    keyStoragePolicySha256: canonicalPolicyHash(
      describePlatformKeyStoragePolicyContract(),
    ),
  });
}

/**
 * Platform Provisioner Policy Identity 契約の公開契約を記述する。
 *
 * @responsibility Platform Provisioner Policy Identity 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformProvisionerPolicyIdentityContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformProvisionerPolicyIdentityContractの入力契約を満たす。
 * @postcondition describePlatformProvisionerPolicyIdentityContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformProvisionerPolicyIdentityContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformProvisionerPolicyIdentityContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformProvisionerPolicyIdentityContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describePlatformProvisionerPolicyIdentityContractはProcess内の同一Subsystemで完結する。
 * @security describePlatformProvisionerPolicyIdentityContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformProvisionerPolicyIdentityContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformProvisionerPolicyIdentityContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-policy-identity",
    contractRevision: 1,
    hashAlgorithm: "SHA-256",
    hashInput:
      "RFC-8785-canonical-UTF-8-bytes-of-owned-policy-contract-description",
    rootProtectionPolicyOwner:
      "crdd-coordinator/root-protection-policy-contract-description",
    keyStoragePolicyOwner:
      "crdd-coordinator/platform-key-storage-policy-contract-description",
    callerPolicyHashAccepted: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
