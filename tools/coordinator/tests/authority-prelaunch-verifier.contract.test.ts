import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_REGISTRY_CONTRACT,
  validateAuthorityRegistryCandidate,
} from "../src/security/authority-grant-verifier.ts";
import { AUTHORITY_FILE_BUNDLE_CONTRACT } from "../src/security/authority-file-bundle.ts";
import {
  describeAuthorityPrelaunchVerifierContract,
  reverifyAuthorityBeforeProviderLaunch,
} from "../src/security/authority-prelaunch-verifier.ts";
import {
  AUTHORITY_TRUST_POLICY_CONTRACT,
  decodeCanonicalAuthorityTrustPolicyBytes,
} from "../src/security/authority-trust-loader.ts";
import {
  PROVIDER_ISOLATION_CONTRACT,
  validateProviderIsolationProfile,
} from "../src/security/provider-isolation-profile.ts";
import { canonicalJson } from "./test-support.ts";

function profile() {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 1,
    profileId: "PROFILE-000001",
    provider: "codex",
    authority: { registryId: "AUTHREG-000001", grantRef: "AUTH-000001" },
    credentialGrant: { brokerId: "BROKER-000001", grantRef: "CGRANT-000001" },
    egress: { origins: ["https://api.example.test"] },
  };
}

function fixture(grantOverrides = {}, policyOverrides = {}) {
  const rawProfile = profile();
  const now = Date.now();
  const registry = {
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: 1,
    registryId: "AUTHREG-000001",
    registryRevision: 3,
    observedAt: new Date(now - 60_000).toISOString(),
    grants: [
      {
        grantRef: "AUTH-000001",
        grantRevision: 2,
        status: "active",
        validFrom: new Date(now - 86_400_000).toISOString(),
        expiresAt: new Date(now + 86_400_000).toISOString(),
        provider: "codex",
        origins: ["https://api.example.test"],
        credentialGrant: {
          brokerId: "BROKER-000001",
          grantRef: "CGRANT-000001",
        },
        operationId: "OP-000001",
        scopeId: "SCOPE-000001",
        profileHash: validateProviderIsolationProfile(rawProfile).profileHash,
        ...grantOverrides,
      },
    ],
  };
  const validated = validateAuthorityRegistryCandidate(registry);
  assert.equal(validated.status, "candidate");
  const registryBytes = Buffer.from(canonicalJson(validated.registry), "utf8");
  const trustPolicy = {
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: 1,
    policyId: "AUTHPOL-000001",
    policyRevision: 1,
    status: "active",
    registryId: validated.registry.registryId,
    registryRevision: validated.registry.registryRevision,
    registryHash: validated.registryHash,
    ...policyOverrides,
  };
  const trustPolicyBytes = Buffer.from(canonicalJson(trustPolicy), "utf8");
  const decodedPolicy =
    decodeCanonicalAuthorityTrustPolicyBytes(trustPolicyBytes);
  assert.equal(decodedPolicy.status, "candidate");
  const manifest = {
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: 1,
    bundleId: "AUTHBUNDLE-000001",
    bundleRevision: 1,
    status: "active",
    previousBundleHash: null,
    trustPolicyHash: decodedPolicy.trustPolicyHash,
    registryHash: validated.registryHash,
  };
  const bundle = {
    manifestBytes: Buffer.from(canonicalJson(manifest), "utf8"),
    trustPolicyBytes,
    registryBytes,
  };
  return { rawProfile, bundle, trustPolicy };
}

const CONTEXT = Object.freeze({
  operationId: "OP-000001",
  scopeId: "SCOPE-000001",
});

test("Runtime時計でGrantを起動直前に再確認する候補を作る", () => {
  const before = Date.now();
  const { rawProfile, bundle, trustPolicy } = fixture();
  const result = reverifyAuthorityBeforeProviderLaunch(
    rawProfile,
    bundle,
    CONTEXT,
  );
  const after = Date.now();
  assert.equal(result.status, "candidate");
  assert.equal(
    result.reason,
    "runtime_file_bundle_path_acl_and_activation_required",
  );
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.verification.operationId, CONTEXT.operationId);
  assert.equal(result.verification.scopeId, CONTEXT.scopeId);
  assert.equal(result.verification.trustPolicyId, trustPolicy.policyId);
  assert.equal(
    result.verification.trustPolicyRevision,
    trustPolicy.policyRevision,
  );
  assert.match(result.verification.trustPolicyHash, /^[a-f0-9]{64}$/u);
  assert.equal(result.verification.bundleId, "AUTHBUNDLE-000001");
  assert.equal(result.verification.bundleRevision, 1);
  assert.match(result.verification.bundleHash, /^[a-f0-9]{64}$/u);
  const checkedAt = Date.parse(result.verification.prelaunchCheckedAt);
  assert.ok(before <= checkedAt && checkedAt <= after);
});

test("呼出側時刻を受理せず固定Contextだけを使う", () => {
  const { rawProfile, bundle } = fixture();
  assert.equal(
    reverifyAuthorityBeforeProviderLaunch(rawProfile, bundle, {
      ...CONTEXT,
      now: "2099-01-01T00:00:00.000Z",
    }).reason,
    "prelaunch_authority_context_invalid",
  );

  let getterCalls = 0;
  const accessor = { ...CONTEXT };
  Object.defineProperty(accessor, "operationId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return CONTEXT.operationId;
    },
  });
  assert.equal(
    reverifyAuthorityBeforeProviderLaunch(rawProfile, bundle, accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
});

test("失効GrantとTrust Policy不一致をCapabilityへ昇格させない", () => {
  const expired = fixture({
    validFrom: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-01-02T00:00:00.000Z",
  });
  const expiredResult = reverifyAuthorityBeforeProviderLaunch(
    expired.rawProfile,
    expired.bundle,
    CONTEXT,
  );
  assert.equal(expiredResult.status, "blocked");
  assert.equal(expiredResult.reason, "authority_grant_outside_validity");
  assert.equal(expiredResult.runtimeCapabilityIssued, false);

  const mismatch = fixture();
  const mismatchedBundle = {
    ...mismatch.bundle,
    manifestBytes: Buffer.from(
      mismatch.bundle.manifestBytes
        .toString("utf8")
        .replace(
          /"registryHash":"[a-f0-9]{64}"/u,
          `"registryHash":"${"a".repeat(64)}"`,
        ),
      "utf8",
    ),
  };
  const mismatchResult = reverifyAuthorityBeforeProviderLaunch(
    mismatch.rawProfile,
    mismatchedBundle,
    CONTEXT,
  );
  assert.equal(mismatchResult.status, "blocked");
  assert.equal(
    mismatchResult.reason,
    "prelaunch_authority_file_bundle_invalid",
  );
  assert.equal(mismatchResult.runtimeCapabilityIssued, false);
});

test("Core候補はProvider起動やAuthority Capabilityを成立させない", () => {
  const contract = describeAuthorityPrelaunchVerifierContract();
  assert.equal(contract.runtimeClockRead, "implemented_candidate");
  assert.equal(contract.prelaunchReverificationCore, "implemented_candidate");
  assert.equal(contract.providerLaunchIntegration, "not_implemented");
  assert.equal(contract.runtimeTrustPolicyActivation, "not_implemented");
  assert.equal(contract.authorityFileBundleCore, "implemented_candidate");
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.callerSuppliedTimeAccepted, false);
  assert.equal(contract.candidateReusableAsCapability, false);
});
