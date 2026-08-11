import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_ISOLATION_CONTRACT,
  describeProviderIsolationContract,
  validateProviderIsolationProfile
} from "../src/security/provider-isolation-profile.mjs";

const NOW = new Date("2026-08-11T00:00:00.000Z");

function candidate(overrides = {}) {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 1,
    profileId: "provider-isolation.codex.production",
    provider: "codex",
    authority: {
      grantId: "AUTH-000001",
      approvedBy: "Qual-Lab",
      approvedAt: "2026-08-10T00:00:00.000Z",
      expiresAt: "2026-08-12T00:00:00.000Z"
    },
    credentialGrant: {
      brokerId: "credential-broker.local",
      grantRef: "grant:OP-000001"
    },
    egress: {
      approvalId: "EGRESS-000001",
      origins: ["https://api.example.test"]
    },
    ...overrides
  };
}

test("承認済み参照だけを含むProfileを正規化して固定する", () => {
  const result = validateProviderIsolationProfile(candidate(), { now: NOW });
  assert.equal(result.status, "accepted");
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
  const result = validateProviderIsolationProfile(candidate({ apiKey: "secret" }), { now: NOW });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "profile_shape_invalid");
  const nested = candidate();
  nested.credentialGrant.secret = "secret";
  assert.equal(validateProviderIsolationProfile(nested, { now: NOW }).reason, "secret_material_forbidden");
});

test("wildcard、平文HTTP、Path付き送信先を拒否する", () => {
  for (const origin of ["https://*.example.test", "http://api.example.test", "https://api.example.test/v1"]) {
    const value = candidate();
    value.egress.origins = [origin];
    const result = validateProviderIsolationProfile(value, { now: NOW });
    assert.equal(result.status, "blocked", origin);
    assert.equal(result.reason, "egress_origin_invalid", origin);
  }
});

test("期限切れAuthorityと未対応Providerをfail closedにする", () => {
  const expired = candidate();
  expired.authority.expiresAt = "2026-08-10T12:00:00.000Z";
  assert.equal(validateProviderIsolationProfile(expired, { now: NOW }).reason, "authority_expired");
  assert.equal(validateProviderIsolationProfile(candidate({ provider: "other" }), { now: NOW }).reason, "provider_not_supported");
});

test("同じ意味のProfileはorigin順序に依存しないHashを持つ", () => {
  const left = candidate();
  left.egress.origins = ["https://b.example.test", "https://a.example.test"];
  const right = candidate();
  right.egress.origins = ["https://a.example.test", "https://b.example.test"];
  assert.equal(
    validateProviderIsolationProfile(left, { now: NOW }).profileHash,
    validateProviderIsolationProfile(right, { now: NOW }).profileHash
  );
});
