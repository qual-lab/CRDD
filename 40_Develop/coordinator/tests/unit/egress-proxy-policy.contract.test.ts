/**
 * coordinator:unit:egress-proxy-policyの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:egress-proxy-policyが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope egress、proxy、policy
 * @boundary AIT-UT-005=N/A: 既存Ownerの局所的な入力・権限・隔離規則を検証し、総合Trustの評価器は扱わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { describeDockerProviderAssets } from "../../../docker-isolation/src/image/assets.ts";
import { describeDockerProxyTopology } from "../../../docker-isolation/src/network/policy.ts";

import {
  describeSpecialPurposeRegistrySnapshot,
  evaluateProxyConnectForFixture,
  evaluateResolvedAddressesForFixture,
} from "../support/egress-proxy-policy.ts";

/**
 * CONNECTはcanonical hostnameと文字列443の完全一致だけを候補にするを検証する。
 *
 * @responsibility CONNECTはcanonical hostnameと文字列443の完全一致だけを候補にするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CONNECTはcanonical hostnameと文字列443の完全一致だけを候補にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("CONNECTはcanonical hostnameと文字列443の完全一致だけを候補にする", () => {
  const policy = Object.freeze({
    allowedHostnames: ["api.example.test"],
    allowedPort: 443,
  });
  assert.equal(
    evaluateProxyConnectForFixture(policy, {
      method: "CONNECT",
      authority: "api.example.test:443",
    }).decision,
    "candidate",
  );
  for (const authority of [
    "api.example.test:00443",
    "+api.example.test:443",
    "api.example.test:+443",
    "api.example.test:80",
    "other.example.test:443",
    "api.example.test.:443",
    "127.0.0.1:443",
    "[::1]:443",
    "user@api.example.test:443",
    " api.example.test:443",
    "api.example.test:443 ",
    "api.example.test:443\r\n",
    "api.example.test::443",
  ])
    assert.equal(
      evaluateProxyConnectForFixture(policy, { method: "CONNECT", authority })
        .decision,
      "deny",
      authority,
    );
  assert.equal(
    evaluateProxyConnectForFixture(policy, {
      method: "GET",
      authority: "api.example.test:443",
    }).decision,
    "deny",
  );
});

/**
 * IANA最長prefixでglobal例外とspecial範囲を区別するを検証する。
 *
 * @responsibility IANA最長prefixでglobal例外とspecial範囲を区別するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus IANA最長prefixでglobal例外とspecial範囲を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("IANA最長prefixでglobal例外とspecial範囲を区別する", () => {
  for (const address of [
    "192.0.0.9",
    "192.0.0.10",
    "192.31.196.1",
    "2001:1::1",
    "2001:3::1",
  ]) {
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      "candidate",
      address,
    );
  }
  for (const address of [
    "192.0.0.8",
    "192.0.0.11",
    "192.88.99.1",
    "192.88.99.2",
    "2001::1",
    "2001:2::1",
    "2001:10::1",
  ]) {
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      "deny",
      address,
    );
  }
  for (const [address, expected] of [
    ["100.63.255.255", "candidate"],
    ["100.64.0.0", "deny"],
    ["100.127.255.255", "deny"],
    ["100.128.0.0", "candidate"],
    ["3ffe:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "deny"],
    ["3fff::", "deny"],
    ["3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff", "deny"],
    ["3fff:1000::", "deny"],
  ])
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      expected,
      address,
    );
});

/**
 * IPv6はGlobal Unicast RegistryのALLOCATED範囲だけを候補にするを検証する。
 *
 * @responsibility IPv6はGlobal Unicast RegistryのALLOCATED範囲だけを候補にするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus IPv6はGlobal Unicast RegistryのALLOCATED範囲だけを候補にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("IPv6はGlobal Unicast RegistryのALLOCATED範囲だけを候補にする", () => {
  for (const address of [
    "2001:200::",
    "2001:3ff:ffff:ffff:ffff:ffff:ffff:ffff",
    "2003::",
    "2003:3fff:ffff:ffff:ffff:ffff:ffff:ffff",
    "2400::1",
    "2606:4700:4700::1111",
  ])
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      "candidate",
      address,
    );
  for (const address of [
    "2000::1",
    "2001:1000::",
    "2003:4000::",
    "3ffe::1",
    "4000::1",
    "6000::1",
    "8000::1",
  ])
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      "deny",
      address,
    );
});

/**
 * NAT64は圧縮・展開表記とも埋込みIPv4を再評価するを検証する。
 *
 * @responsibility NAT64は圧縮・展開表記とも埋込みIPv4を再評価するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus NAT64は圧縮・展開表記とも埋込みIPv4を再評価するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("NAT64は圧縮・展開表記とも埋込みIPv4を再評価する", () => {
  for (const address of ["64:ff9b::8.8.8.8", "64:ff9b::808:808"]) {
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      "candidate",
      address,
    );
  }
  for (const address of [
    "64:ff9b::127.0.0.1",
    "64:ff9b::7f00:1",
    "64:ff9b::10.0.0.1",
    "64:ff9b::192.0.2.1",
    "64:ff9b::c000:201",
    "64:ff9b::100.64.0.1",
  ])
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      "deny",
      address,
    );
});

/**
 * IPv4とIPv6のspecial、mapped、compatible、zone表記を拒否するを検証する。
 *
 * @responsibility IPv4とIPv6のspecial、mapped、compatible、zone表記を拒否するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus IPv4とIPv6のspecial、mapped、compatible、zone表記を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("IPv4とIPv6のspecial、mapped、compatible、zone表記を拒否する", () => {
  for (const address of [
    "10.0.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.168.0.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "2001:db8::1",
    "3fff::1",
    "5f00::1",
    "100::1",
    "64:ff9b:1::1",
    "::ffff:127.0.0.1",
    "0:0:0:0:0:ffff:192.0.2.1",
    "::8.8.8.8",
    "fe80::1%eth0",
  ])
    assert.equal(
      evaluateResolvedAddressesForFixture([address]).decision,
      "deny",
      address,
    );
  assert.equal(
    evaluateResolvedAddressesForFixture(["::ffff:8.8.8.8"]).decision,
    "candidate",
  );
  assert.equal(
    evaluateResolvedAddressesForFixture(["8.8.8.8", "2606:4700:4700::1111"])
      .decision,
    "candidate",
  );
  assert.equal(
    evaluateResolvedAddressesForFixture(["8.8.8.8", "127.0.0.1"]).decision,
    "deny",
  );
});

/**
 * IANA snapshot metadataと検証済みTopologyをRuntime未接続として区別するを検証する。
 *
 * @responsibility IANA snapshot metadataと検証済みTopologyをRuntime未接続として区別するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus IANA snapshot metadataと検証済みTopologyをRuntime未接続として区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("IANA snapshot metadataと検証済みTopologyをRuntime未接続として区別する", () => {
  const registry = describeSpecialPurposeRegistrySnapshot();
  assert.equal(registry.matching, "longest_prefix");
  assert.equal(
    registry.snapshotSha256,
    "a0c9de6e6f84a76c75cbdb85b3d3f01e76c965691211b469374a117fab351f2f",
  );
  assert.equal(registry.specialPurposeEntryCount, 55);
  assert.equal(registry.ipv6AllocatedEntryCount, 36);
  assert.equal(registry.ipv4NoSpecialPurposeMatchDecision, "candidate");
  assert.equal(registry.ipv6NoAllocatedGlobalUnicastMatchDecision, "deny");
  assert.equal(registry.matchedUnknownValueDecision, "deny");
  const topology = describeDockerProxyTopology("claude");
  assert.equal(topology.containerPort, 8080);
  assert.equal(topology.providerNetworkInternal, true);
  assert.equal(topology.providerDirectExternalNetwork, false);
  assert.equal(topology.dockerSocketMounted, false);
  assert.equal(topology.hostNetworkModeAllowed, false);
  assert.equal(
    topology.enforcement,
    "fixed_digest_proxy_runtime_validation_required",
  );
  assert.equal(
    topology.imageDigest,
    describeDockerProviderAssets("claude").proxy.imageDigest,
  );
  const codexTopology = describeDockerProxyTopology("codex");
  assert.equal(codexTopology.proxyProfile, "codex");
  assert.deepEqual(codexTopology.allowedHostnames, [
    "auth.openai.com",
    "chatgpt.com",
  ]);
  assert.equal(
    codexTopology.imageDigest,
    describeDockerProviderAssets("codex").proxy.imageDigest,
  );
});
