import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_FILE_BUNDLE_CONTRACT,
  AUTHORITY_FILE_BUNDLE_FILES,
  AUTHORITY_FILE_BUNDLE_INPUT_LIMITS,
  describeAuthorityFileBundleContract,
  loadAuthorityFileBundleCandidate,
} from "../../src/security/authority-file-bundle.ts";
import {
  AUTHORITY_REGISTRY_CONTRACT,
  validateAuthorityRegistryCandidate,
} from "../../src/security/authority-grant-verifier.ts";
import {
  AUTHORITY_TRUST_POLICY_CONTRACT,
  AUTHORITY_TRUST_POLICY_INPUT_LIMITS,
  decodeCanonicalAuthorityTrustPolicyBytes,
} from "../../src/security/authority-trust-loader.ts";
import {
  PROVIDER_ISOLATION_CONTRACT,
  validateProviderIsolationProfile,
} from "../../src/security/provider-isolation-profile.ts";
import { canonicalJson } from "../support/test-support.ts";

function profile() {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 3,
    profileId: "PROFILE-000001",
    provider: "codex",
    operationId: "OP-000001",
    authMethod: "subscription_oauth",
    authority: { registryId: "AUTHREG-000001", grantRef: "AUTH-000001" },
    providerHomeMountGrant: {
      provider: "codex",
      profileId: "PROFILE-000001",
      operationId: "OP-000001",
      issuer: "runtime_owned",
      requiredState: "active",
      verification: "runtime_capability_required",
    },
    egress: { origins: ["https://api.example.test"] },
  };
}

function fixture(manifestOverrides = {}, policyOverrides = {}) {
  const rawProfile = profile();
  const registry = {
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: 3,
    registryId: "AUTHREG-000001",
    registryRevision: 3,
    observedAt: "2026-08-11T00:00:00.000Z",
    grants: [
      {
        grantRef: "AUTH-000001",
        grantRevision: 2,
        status: "active",
        validFrom: "2026-08-10T00:00:00.000Z",
        expiresAt: "2026-08-12T00:00:00.000Z",
        provider: "codex",
        profileId: "PROFILE-000001",
        origins: ["https://api.example.test"],
        providerHomeMountGrant: {
          provider: "codex",
          profileId: "PROFILE-000001",
          operationId: "OP-000001",
          issuer: "runtime_owned",
          requiredState: "active",
          verification: "runtime_capability_required",
        },
        operationId: "OP-000001",
        scopeId: "SCOPE-000001",
        profileHash: validateProviderIsolationProfile(rawProfile).profileHash,
      },
    ],
  };
  const validatedRegistry = validateAuthorityRegistryCandidate(registry);
  assert.equal(validatedRegistry.status, "candidate");
  const registryBytes = Buffer.from(
    canonicalJson(validatedRegistry.registry),
    "utf8",
  );
  const trustPolicy = {
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: 1,
    policyId: "AUTHPOL-000001",
    policyRevision: 1,
    status: "active",
    registryId: validatedRegistry.registry.registryId,
    registryRevision: validatedRegistry.registry.registryRevision,
    registryHash: validatedRegistry.registryHash,
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
    registryHash: validatedRegistry.registryHash,
    ...manifestOverrides,
  };
  const manifestBytes = Buffer.from(canonicalJson(manifest), "utf8");
  return { manifestBytes, trustPolicyBytes, registryBytes };
}

test("固定3ファイルのcanonical byteとHashをBundle候補へ結合する", () => {
  const input = fixture();
  const result = loadAuthorityFileBundleCandidate(input);
  assert.equal(result.status, "candidate");
  assert.equal(
    result.reason,
    "runtime_file_bundle_path_acl_and_activation_required",
  );
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.manifest.bundleId, "AUTHBUNDLE-000001");
  assert.match(result.bundleHash, /^[a-f0-9]{64}$/u);
  assert.equal(result.manifest.registryHash, result.registryHash);
  assert.equal(result.manifest.trustPolicyHash, result.trustPolicyHash);
  assert.equal("manifestBytes" in result, false);
  assert.equal("registryBytes" in result, false);
  assert.equal("trustPolicyBytes" in result, false);
});

test("Manifestの非canonical表現、BOM、余分fieldおよび上限超過を拒否する", () => {
  const input = fixture();
  const manifestText = input.manifestBytes.toString("utf8");
  for (const manifestBytes of [
    Buffer.concat([input.manifestBytes, Buffer.from("\n")]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), input.manifestBytes]),
    Buffer.from(manifestText.replace("{", '{"extra":true,'), "utf8"),
    Buffer.alloc(AUTHORITY_FILE_BUNDLE_INPUT_LIMITS.manifestBytes + 1, 0x20),
  ]) {
    assert.equal(
      loadAuthorityFileBundleCandidate({ ...input, manifestBytes }).reason,
      "authority_file_bundle_manifest_invalid",
    );
  }
});

test("Trust Policy byte列もcanonical形式と独立上限を要求する", () => {
  const input = fixture();
  for (const trustPolicyBytes of [
    Buffer.concat([input.trustPolicyBytes, Buffer.from(" ")]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), input.trustPolicyBytes]),
    Buffer.alloc(AUTHORITY_TRUST_POLICY_INPUT_LIMITS.rawBytes + 1, 0x20),
  ]) {
    assert.equal(
      loadAuthorityFileBundleCandidate({ ...input, trustPolicyBytes }).reason,
      "authority_file_bundle_trust_policy_invalid",
    );
  }
});

test("File Bundle経路も旧Authority Registry revision 1をalias変換せず拒否する", () => {
  const input = fixture();
  const legacyRegistry = JSON.parse(input.registryBytes.toString("utf8"));
  legacyRegistry.contractRevision = 1;
  const result = loadAuthorityFileBundleCandidate({
    ...input,
    registryBytes: Buffer.from(canonicalJson(legacyRegistry), "utf8"),
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "authority_file_bundle_registry_invalid");
});

test("Manifest、Policy、RegistryのHash差とinactive状態を拒否する", () => {
  assert.equal(
    loadAuthorityFileBundleCandidate(fixture({ registryHash: "a".repeat(64) }))
      .reason,
    "authority_file_bundle_hash_mismatch",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({ trustPolicyHash: "a".repeat(64) }),
    ).reason,
    "authority_file_bundle_hash_mismatch",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(fixture({ status: "revoked" })).reason,
    "authority_file_bundle_inactive",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(fixture({}, { status: "revoked" })).reason,
    "authority_file_bundle_trust_policy_inactive",
  );
});

test("Bundle revisionは初版nullと後続Hash chainを区別する", () => {
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({ previousBundleHash: "a".repeat(64) }),
    ).reason,
    "authority_file_bundle_manifest_invalid",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({
        bundleRevision: 2,
        previousBundleHash: null,
      }),
    ).reason,
    "authority_file_bundle_manifest_invalid",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({
        bundleRevision: 2,
        previousBundleHash: createHash("sha256")
          .update("previous")
          .digest("hex"),
      }),
    ).status,
    "candidate",
  );
});

test("Bundle入力のaccessorとProxyを実行せずblockedへ閉じる", () => {
  const input = fixture();
  let getterCalls = 0;
  const accessor = { ...input };
  Object.defineProperty(accessor, "manifestBytes", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return input.manifestBytes;
    },
  });
  assert.equal(loadAuthorityFileBundleCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxied = new Proxy(input, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(input);
    },
  });
  assert.equal(loadAuthorityFileBundleCandidate(proxied).status, "blocked");
  assert.equal(proxyCalls, 0);
});

test("File Bundle CoreはPath／ACL／activationまたはCapabilityを成立させない", () => {
  const contract = describeAuthorityFileBundleContract();
  assert.equal(contract.canonicalBundleCore, "implemented_candidate");
  assert.deepEqual(contract.fixedFiles, AUTHORITY_FILE_BUNDLE_FILES);
  assert.equal(
    contract.rootProtectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(contract.runtimeManagedPath, "not_implemented");
  assert.equal(contract.ownerAclVerification, "not_implemented");
  assert.equal(contract.atomicReplacement, "not_implemented");
  assert.equal(contract.monotonicActivation, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.ipcOrNetworkTransportSupported, false);
});
