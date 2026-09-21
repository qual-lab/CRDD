import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { inspectProvisioningP256SpkiCandidate } from "./provisioning-signature-primitives.ts";

export const PLATFORM_KEY_STORAGE_POLICY_CONTRACT =
  "crdd-coordinator/platform-key-storage-policy";
export const PLATFORM_KEY_STORAGE_POLICY_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "platformFamily",
  "backend",
  "explicitFallbackApproved",
  "publicKeySpkiDer",
]);

const PLATFORM_POLICIES = Object.freeze({
  windows: Object.freeze({
    preferred: "cng_ksp_tpm_p256",
    explicitFallback: "cng_ksp_software_p256",
  }),
  macos: Object.freeze({
    preferred: "secure_enclave_p256",
    explicitFallback: "keychain_software_p256",
  }),
  linux: Object.freeze({
    preferred: "tpm2_p256",
    explicitFallback: "root_owned_software_p256",
  }),
});

/**
 * PlatformFamilyが扱う値の構造を表す。
 *
 * @responsibility PlatformFamilyに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape PlatformFamilyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PlatformFamilyで宣言した値と責務の対応を維持する。
 * @boundary N/A: PlatformFamilyの宣言は外部境界を開かない。
 * @security PlatformFamilyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PlatformFamilyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PlatformFamily = keyof typeof PLATFORM_POLICIES;

/**
 * resultの処理を実行する。
 *
 * @responsibility resultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input status: S、reason: string、details: T
 * @returns resultの計算結果を返す。
 * @precondition 「status: S、reason: string、details: T」がresultの入力契約を満たす。
 * @postcondition resultの責務を完了した結果だけを返す。
 * @effect N/A: resultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resultは独自の失敗分岐を所有しない。
 * @invariant resultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resultはProcess内の同一Subsystemで完結する。
 * @security resultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resultは共有非同期状態を持たない同期処理である。
 */
function result<const S extends string, T extends Record<string, unknown>>(
  status: S,
  reason: string,
  details?: T,
) {
  return Object.freeze({
    status,
    reason,
    ...details,
    nativeAdapterVerificationRequired: true,
    privateKeyMaterialAccepted: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

/**
 * isPlatformFamilyの処理を実行する。
 *
 * @responsibility isPlatformFamilyに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns value is PlatformFamilyを返す。
 * @precondition 「value: string」がisPlatformFamilyの入力契約を満たす。
 * @postcondition isPlatformFamilyの責務を完了した結果だけを返す。
 * @effect N/A: isPlatformFamilyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlatformFamilyは独自の失敗分岐を所有しない。
 * @invariant isPlatformFamilyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlatformFamilyはProcess内の同一Subsystemで完結する。
 * @security isPlatformFamilyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlatformFamilyは共有非同期状態を持たない同期処理である。
 */
function isPlatformFamily(value: string): value is PlatformFamily {
  return Object.hasOwn(PLATFORM_POLICIES, value);
}

/**
 * evaluatePlatformKeyStoragePolicyCandidateの処理を実行する。
 *
 * @responsibility evaluatePlatformKeyStoragePolicyCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns evaluatePlatformKeyStoragePolicyCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がevaluatePlatformKeyStoragePolicyCandidateの入力契約を満たす。
 * @postcondition evaluatePlatformKeyStoragePolicyCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluatePlatformKeyStoragePolicyCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluatePlatformKeyStoragePolicyCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluatePlatformKeyStoragePolicyCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluatePlatformKeyStoragePolicyCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluatePlatformKeyStoragePolicyCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluatePlatformKeyStoragePolicyCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluatePlatformKeyStoragePolicyCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (
      !input ||
      typeof input.platformFamily !== "string" ||
      typeof input.backend !== "string" ||
      typeof input.explicitFallbackApproved !== "boolean" ||
      !Buffer.isBuffer(input.publicKeySpkiDer)
    ) {
      return result("blocked", "platform_key_storage_policy_input_invalid");
    }
    if (!isPlatformFamily(input.platformFamily)) {
      return result("blocked", "platform_key_storage_platform_unsupported");
    }
    const policy = PLATFORM_POLICIES[input.platformFamily];
    const isPreferred = input.backend === policy.preferred;
    const isFallback = input.backend === policy.explicitFallback;
    if (!isPreferred && !isFallback) {
      return result("blocked", "platform_key_storage_backend_unsupported");
    }
    if (
      (isPreferred && input.explicitFallbackApproved) ||
      (isFallback && !input.explicitFallbackApproved)
    ) {
      return result(
        "blocked",
        "platform_key_storage_fallback_approval_invalid",
      );
    }
    const inspected = inspectProvisioningP256SpkiCandidate(
      input.publicKeySpkiDer,
    );
    if (inspected.status !== "candidate") {
      return result("blocked", "platform_key_storage_public_key_invalid");
    }
    return result(
      "candidate",
      "signed_platform_provisioner_native_backend_key_handle_and_protection_verification_required",
      {
        platformFamily: input.platformFamily,
        backendClass: isPreferred ? "preferred" : "explicit_fallback",
        keyAlgorithm: "ECDSA-P256-SHA256",
        publicKeyCanonical: true,
      },
    );
  } catch {
    return result("blocked", "platform_key_storage_policy_input_invalid");
  }
}

/**
 * describePlatformKeyStoragePolicyContractの処理を実行する。
 *
 * @responsibility describePlatformKeyStoragePolicyContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformKeyStoragePolicyContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformKeyStoragePolicyContractの入力契約を満たす。
 * @postcondition describePlatformKeyStoragePolicyContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformKeyStoragePolicyContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformKeyStoragePolicyContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformKeyStoragePolicyContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describePlatformKeyStoragePolicyContractはProcess内の同一Subsystemで完結する。
 * @security describePlatformKeyStoragePolicyContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformKeyStoragePolicyContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformKeyStoragePolicyContract() {
  return Object.freeze({
    contract: PLATFORM_KEY_STORAGE_POLICY_CONTRACT,
    contractRevision: PLATFORM_KEY_STORAGE_POLICY_CONTRACT_REVISION,
    keyAlgorithm: "ECDSA-P256-SHA256",
    publicKeyEncoding: "RFC-5480-exact-P256-SPKI-DER",
    backendPolicies: PLATFORM_POLICIES,
    fallbackSelection: "explicit_only_without_silent_downgrade",
    preferredBackendFailureBehavior:
      "blocked_until_explicit_fallback_or_reprovision",
    privateKeyInputOrOutput: "prohibited",
    policyEvaluation: "implemented_candidate_claim_only",
    nativeWindowsCngAdapter: "not_implemented",
    nativeMacosSecureEnclaveAdapter: "not_implemented",
    nativeLinuxTpm2Adapter: "not_implemented",
    softwareFallbackProtectionVerification: "not_implemented",
    signedPlatformProvisionerBinding: "not_implemented",
    keyHandleProofOfPossession: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
