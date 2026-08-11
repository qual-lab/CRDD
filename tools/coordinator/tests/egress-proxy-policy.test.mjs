import assert from "node:assert/strict";
import test from "node:test";

import { PROVIDER_ISOLATION_CONTRACT, validateProviderIsolationProfile } from "../src/security/provider-isolation-profile.mjs";
import {
  compileEgressProxyPolicyCandidate,
  describeEgressProxyTopology,
  evaluateProxyConnectForFixture,
  evaluateResolvedAddressesForFixture
} from "../src/security/egress-proxy-policy.mjs";

function profile() {
  return validateProviderIsolationProfile({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 1,
    profileId: "PROFILE-000001",
    provider: "codex",
    authority: { registryId: "AUTHREG-000001", grantRef: "AUTH-000001" },
    credentialGrant: { brokerId: "BROKER-000001", grantRef: "CGRANT-000001" },
    egress: { origins: ["https://api.example.test"] }
  });
}

test("Profile候補からAuthority未確認のProxy Policy候補だけを作る", () => {
  const result = compileEgressProxyPolicyCandidate(profile());
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "authority_verification_required");
  assert.deepEqual(result.policy.allowedHostnames, ["api.example.test"]);
  assert.equal(result.policy.directProviderEgress, false);
});

test("blockedまたは自己構築したProfileをPolicy候補へ昇格しない", () => {
  assert.equal(compileEgressProxyPolicyCandidate({ status: "candidate" }).status, "blocked");
  assert.equal(compileEgressProxyPolicyCandidate({ status: "accepted", profileHash: "a".repeat(64), profile: {} }).status, "blocked");
});

test("CONNECTの完全一致hostnameと443だけを候補にする", () => {
  const policy = compileEgressProxyPolicyCandidate(profile()).policy;
  assert.equal(evaluateProxyConnectForFixture(policy, { method: "CONNECT", authority: "api.example.test:443" }).decision, "candidate");
  for (const request of [
    { method: "GET", authority: "api.example.test:443" },
    { method: "CONNECT", authority: "api.example.test:80" },
    { method: "CONNECT", authority: "other.example.test:443" },
    { method: "CONNECT", authority: "api.example.test.:443" },
    { method: "CONNECT", authority: "127.0.0.1:443" },
    { method: "CONNECT", authority: "user@api.example.test:443" }
  ]) assert.equal(evaluateProxyConnectForFixture(policy, request).decision, "deny", JSON.stringify(request));
});

test("private、loopback、link-local、documentation addressを拒否する", () => {
  for (const address of ["10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "::1", "fc00::1", "fe80::1", "2001:db8::1"]) {
    assert.equal(evaluateResolvedAddressesForFixture([address]).decision, "deny", address);
  }
  assert.equal(evaluateResolvedAddressesForFixture(["8.8.8.8", "2606:4700:4700::1111"]).decision, "candidate");
});

test("TopologyはProviderの直接外部接続とHost fallbackを許さない", () => {
  const topology = describeEgressProxyTopology();
  assert.equal(topology.providerNetworkInternal, true);
  assert.equal(topology.providerDirectExternalNetwork, false);
  assert.equal(topology.dockerSocketMounted, false);
  assert.equal(topology.hostNetworkModeAllowed, false);
  assert.equal(topology.enforcement, "not_implemented");
});
