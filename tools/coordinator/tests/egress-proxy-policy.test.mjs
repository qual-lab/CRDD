import assert from "node:assert/strict";
import test from "node:test";

import { PROVIDER_ISOLATION_CONTRACT, validateProviderIsolationProfile } from "../src/security/provider-isolation-profile.mjs";
import {
  compileEgressProxyPolicyCandidate,
  describeEgressProxyTopology,
  describeSpecialPurposeRegistrySnapshot,
  evaluateProxyConnectForFixture,
  evaluateResolvedAddressesForFixture
} from "../src/security/egress-proxy-policy.mjs";

function rawProfile(overrides = {}) {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 1,
    profileId: "PROFILE-000001",
    provider: "codex",
    authority: { registryId: "AUTHREG-000001", grantRef: "AUTH-000001" },
    credentialGrant: { brokerId: "BROKER-000001", grantRef: "CGRANT-000001" },
    egress: { origins: ["https://api.example.test"] },
    ...overrides
  };
}

test("生Profileを内部検証してAuthority未確認のPolicy候補だけを作る", () => {
  const result = compileEgressProxyPolicyCandidate(rawProfile());
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "authority_verification_required");
  assert.deepEqual(result.policy.allowedHostnames, ["api.example.test"]);
  assert.equal(result.policy.directProviderEgress, false);
});

test("自己構築した検証結果やcaller指定HashをPolicy候補へ昇格しない", () => {
  const validation = validateProviderIsolationProfile(rawProfile());
  for (const forged of [
    validation,
    { ...validation, profileHash: "a".repeat(64) },
    { ...validation, profile: { ...validation.profile, egress: { origins: ["https://other.example.test"] } } },
    { status: "candidate", reason: "authority_verification_required", profileHash: "a".repeat(64), profile: validation.profile }
  ]) assert.equal(compileEgressProxyPolicyCandidate(forged).status, "blocked");
});

test("不正ProfileとOriginは例外を漏らさずblockedへ閉じる", () => {
  for (const candidate of [null, {}, rawProfile({ egress: { origins: ["not a URL"] } }), rawProfile({ extra: true })]) {
    assert.doesNotThrow(() => compileEgressProxyPolicyCandidate(candidate));
    assert.equal(compileEgressProxyPolicyCandidate(candidate).status, "blocked");
  }
});

test("CONNECTはcanonical hostnameと文字列443の完全一致だけを候補にする", () => {
  const policy = compileEgressProxyPolicyCandidate(rawProfile()).policy;
  assert.equal(evaluateProxyConnectForFixture(policy, { method: "CONNECT", authority: "api.example.test:443" }).decision, "candidate");
  for (const authority of [
    "api.example.test:00443", "+api.example.test:443", "api.example.test:+443", "api.example.test:80",
    "other.example.test:443", "api.example.test.:443", "127.0.0.1:443", "[::1]:443",
    "user@api.example.test:443", " api.example.test:443", "api.example.test:443 ",
    "api.example.test:443\r\n", "api.example.test::443"
  ]) assert.equal(evaluateProxyConnectForFixture(policy, { method: "CONNECT", authority }).decision, "deny", authority);
  assert.equal(evaluateProxyConnectForFixture(policy, { method: "GET", authority: "api.example.test:443" }).decision, "deny");
});

test("IANA最長prefixでglobal例外とspecial範囲を区別する", () => {
  for (const address of ["192.0.0.9", "192.0.0.10", "192.31.196.1", "2001:1::1", "2001:3::1"]) {
    assert.equal(evaluateResolvedAddressesForFixture([address]).decision, "candidate", address);
  }
  for (const address of ["192.0.0.8", "192.0.0.11", "192.88.99.1", "192.88.99.2", "2001::1", "2001:2::1", "2001:10::1"]) {
    assert.equal(evaluateResolvedAddressesForFixture([address]).decision, "deny", address);
  }
  for (const [address, expected] of [
    ["100.63.255.255", "candidate"], ["100.64.0.0", "deny"], ["100.127.255.255", "deny"], ["100.128.0.0", "candidate"],
    ["3ffe:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "candidate"], ["3fff::", "deny"],
    ["3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff", "deny"], ["3fff:1000::", "candidate"]
  ]) assert.equal(evaluateResolvedAddressesForFixture([address]).decision, expected, address);
});

test("IPv4とIPv6のspecial、mapped、compatible、zone表記を拒否する", () => {
  for (const address of [
    "10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.0.1", "192.0.2.1",
    "198.51.100.1", "203.0.113.1", "224.0.0.1", "::1", "fc00::1", "fe80::1", "fec0::1",
    "2001:db8::1", "3fff::1", "5f00::1", "100::1", "64:ff9b:1::1",
    "::ffff:127.0.0.1", "0:0:0:0:0:ffff:192.0.2.1", "::8.8.8.8", "fe80::1%eth0"
  ]) assert.equal(evaluateResolvedAddressesForFixture([address]).decision, "deny", address);
  assert.equal(evaluateResolvedAddressesForFixture(["::ffff:8.8.8.8"]).decision, "candidate");
  assert.equal(evaluateResolvedAddressesForFixture(["8.8.8.8", "2606:4700:4700::1111"]).decision, "candidate");
  assert.equal(evaluateResolvedAddressesForFixture(["8.8.8.8", "127.0.0.1"]).decision, "deny");
});

test("IANA snapshot metadataとTopologyは実強制Capabilityではない", () => {
  const registry = describeSpecialPurposeRegistrySnapshot();
  assert.equal(registry.matching, "longest_prefix");
  assert.equal(registry.snapshotSha256, "d363ce76f5cc1cf1da7bb98ecff722ab605e66a232fb8a393ca3d60027132bd8");
  assert.equal(registry.unknownDecision, "deny");
  const topology = describeEgressProxyTopology();
  assert.equal(topology.providerNetworkInternal, true);
  assert.equal(topology.providerDirectExternalNetwork, false);
  assert.equal(topology.dockerSocketMounted, false);
  assert.equal(topology.hostNetworkModeAllowed, false);
  assert.equal(topology.enforcement, "not_implemented");
});
