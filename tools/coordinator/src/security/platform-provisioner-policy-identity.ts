import { createHash } from "node:crypto";

import { describePlatformKeyStoragePolicyContract } from "./platform-key-storage-policy.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";
import { describeRootProtectionPolicyContract } from "./root-protection-policy.ts";

function canonicalPolicyHash(policy: unknown) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(policy);
  if (canonical.status !== "candidate") {
    throw new Error("platform_provisioner_policy_identity_invalid");
  }
  return createHash("sha256").update(canonical.canonicalBytes).digest("hex");
}

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
