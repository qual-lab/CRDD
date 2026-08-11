import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_ISOLATION_CONTRACT,
  describeProviderIsolationContract,
  validateProviderIsolationProfile
} from "../src/security/provider-isolation-profile.mjs";

function candidate(overrides = {}) {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 1,
    profileId: "PROFILE-000001",
    provider: "codex",
    authority: {
      registryId: "AUTHREG-000001",
      grantRef: "AUTH-000001"
    },
    credentialGrant: {
      brokerId: "BROKER-000001",
      grantRef: "CGRANT-000001"
    },
    egress: {
      origins: ["https://api.example.test"]
    },
    ...overrides
  };
}

test("限定参照だけを含むProfileをAuthority確認待ち候補として固定する", () => {
  const result = validateProviderIsolationProfile(candidate());
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "authority_verification_required");
  assert.equal(result.profile.requiredCapabilities.includes("authority_grant_verification"), true);
  assert.match(result.profileHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(result.profile.egress.origins, ["https://api.example.test"]);
  assert.equal(JSON.stringify(result).includes("CRDD-v0.18"), false);
});

test("Profile契約はCRDD版ごとに分岐しない", () => {
  const contract = describeProviderIsolationContract();
  assert.equal(contract.crddVersionSpecific, false);
  assert.equal(contract.supportedWriteBackend, "docker");
  assert.equal(contract.localFallbackAllowed, false);
});

test("秘密値らしいfieldをProfileへ混入できない", () => {
  const result = validateProviderIsolationProfile(candidate({ apiKey: "secret" }));
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "secret_material_forbidden");
  const nested = candidate();
  nested.credentialGrant.secret = "secret";
  assert.equal(validateProviderIsolationProfile(nested).reason, "secret_material_forbidden");
});

test("Provider tokenらしい値を参照fieldへ偽装できない", () => {
  const values = ["sk-proj-example", "sk-ant-example", "ghp_example", "github_pat_example"];
  for (const value of values) {
    const authority = candidate();
    authority.authority.grantRef = value;
    assert.equal(validateProviderIsolationProfile(authority).reason, "authority_reference_invalid", value);
    const credential = candidate();
    credential.credentialGrant.grantRef = value;
    assert.equal(validateProviderIsolationProfile(credential).reason, "credential_grant_reference_invalid", value);
  }
});

test("自己申告の承認内容と旧時刻fieldをProfileへ保持できない", () => {
  const value = candidate();
  value.authority.approvedBy = "Qual-Lab";
  value.authority.approvedAt = "2099-01-01T00:00:00.000Z";
  value.authority.expiresAt = "2100-01-01T00:00:00.000Z";
  assert.equal(validateProviderIsolationProfile(value).reason, "authority_shape_invalid");
});

test("AuthorityとCredentialの参照namespaceを相互利用できない", () => {
  const authority = candidate();
  authority.authority.grantRef = "CGRANT-000001";
  assert.equal(validateProviderIsolationProfile(authority).reason, "authority_reference_invalid");
  const credential = candidate();
  credential.credentialGrant.grantRef = "AUTH-000001";
  assert.equal(validateProviderIsolationProfile(credential).reason, "credential_grant_reference_invalid");
});

test("wildcard、平文HTTP、Path付き送信先を拒否する", () => {
  for (const origin of ["https://*.example.test", "http://api.example.test", "https://api.example.test/v1"]) {
    const value = candidate();
    value.egress.origins = [origin];
    const result = validateProviderIsolationProfile(value);
    assert.equal(result.status, "blocked", origin);
    assert.equal(result.reason, "egress_origin_invalid", origin);
  }
});

test("未知Authority Registryと未対応Providerをfail closedにする", () => {
  const unknown = candidate();
  unknown.authority.registryId = "registry-from-agent";
  assert.equal(validateProviderIsolationProfile(unknown).reason, "authority_reference_invalid");
  assert.equal(validateProviderIsolationProfile(candidate({ provider: "other" })).reason, "provider_not_supported");
});

test("同じ意味のProfileはorigin順序に依存しないHashを持つ", () => {
  const left = candidate();
  left.egress.origins = ["https://b.example.test", "https://a.example.test"];
  const right = candidate();
  right.egress.origins = ["https://a.example.test", "https://b.example.test"];
  assert.equal(
    validateProviderIsolationProfile(left).profileHash,
    validateProviderIsolationProfile(right).profileHash
  );
});
