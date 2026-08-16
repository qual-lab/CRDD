import { inspectProvisioningP256SpkiCandidate } from "./provisioning-signature-primitives.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

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

type PlatformFamily = keyof typeof PLATFORM_POLICIES;

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

function isPlatformFamily(value: string): value is PlatformFamily {
  return Object.hasOwn(PLATFORM_POLICIES, value);
}

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
