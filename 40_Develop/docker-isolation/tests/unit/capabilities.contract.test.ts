/**
 * 静的Catalogと既存の配置・通信正本の一致を確認する。
 * @packageDocumentation
 * @responsibility 構築前の値と同意前Hashを変えず、実観測を追加しないことを反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 固定metadataと純粋Policy。実Docker・AI・Filesystem操作はない。
 * @boundary 実Image・Engine・認証・通信許可の成立は対象外。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "../../src/image/assets.ts";
import {
  describeIsolationCapabilities,
  type IsolationCapabilities,
} from "../../src/index.ts";
import {
  describeDockerProxyTopology,
  prepareDockerNetworkPolicy,
} from "../../src/network/policy.ts";

/**
 * 両配置の実在する差と、取得時のI/O零を確認する。
 * @responsibility 静的情報を稼働観測へ変えず、旧構築値を維持する。
 * @trace ERB-UT-023
 * @precondition import完了後にI/O入口を拒否代役へ置換する。
 * @stimulus 両配置のCatalogを取得し、未知識別子も与える。
 * @observation 各metadata、凍結状態、拒否代役の呼出し数。
 * @oracle 旧値と一致し、未知識別子は拒否、実観測なし。
 * @cleanup 代役を復元する。外部資源は取得しない。
 */
test("Catalogは旧固定値を維持し稼働観測や架空の配置を追加しない", (t) => {
  let io = 0;
  const unexpected = () => {
    io++;
    throw Error("unexpected_io");
  };
  t.mock.method(childProcess, "spawn", unexpected);
  t.mock.method(childProcess, "spawnSync", unexpected);
  t.mock.method(fs, "readFileSync", unexpected);
  t.mock.method(fs, "statSync", unexpected);
  t.mock.method(fs, "lstatSync", unexpected);
  for (const provider of ["codex", "claude"] as const) {
    const value = describeIsolationCapabilities(provider);
    assert.equal(value.assets, describeDockerProviderAssets(provider));
    assert.deepEqual(
      value.locations.primary,
      describeDockerProviderExecutionLocations(provider, "task"),
    );
    assert.deepEqual(
      value.locations.primary,
      describeDockerProviderExecutionLocations(provider, "probe"),
    );
    assert.deepEqual(value.proxy, describeDockerProxyTopology(provider));
    assert.deepEqual(
      value.networkPolicy,
      prepareDockerNetworkPolicy(provider, []),
    );
    assert.ok(Object.isFrozen(value) && Object.isFrozen(value.locations));
    if (value.provider === "codex") {
      assert.deepEqual(
        value.locations.alternate,
        describeDockerProviderExecutionLocations("codex", "advice"),
      );
      assert.equal(
        value.locations.primary.commandPath,
        value.assets.identity.executablePath,
      );
      assert.equal(
        value.locations.alternate.commandPath,
        value.assets.adviceIdentity.executablePath,
      );
      assert.notEqual(
        value.assets.fixedImageDigest,
        value.assets.adviceIdentity.fixedImageDigest,
      );
    } else {
      assert.equal(Object.hasOwn(value.locations, "alternate"), false);
      assert.equal(Object.hasOwn(value.assets, "adviceIdentity"), false);
      assert.deepEqual(
        value.locations.primary,
        describeDockerProviderExecutionLocations("claude", "advice"),
      );
    }
  }
  for (const invalid of [undefined, null, "other", new Proxy({}, {})])
    assert.throws(
      () => describeIsolationCapabilities(invalid as never),
      /docker_isolation_capabilities_invalid/u,
    );
  assert.equal(io, 0);
});

/**
 * 追加集合の正規化・Hash・不変性を確認する。
 * @responsibility 同意用投影が実行側と同じ技術正本を用いることを固定する。
 * @trace ERB-UT-023
 * @precondition 合成Hostだけを用い接続しない。
 * @stimulus 大小文字・順序・入力変更と32件境界を与える。
 * @observation 正規Host、契約式のHash、深い凍結。
 * @oracle 既存値・Hashと一致し、入力変更が返却値へ反映されない。
 * @cleanup N/A: 外部資源なし。
 */
test("Catalogの同意用Policyは同じ正規化とHashを使う", () => {
  for (const provider of ["codex", "claude"] as const) {
    const hosts = ["PYPI.ORG", "registry.npmjs.org"];
    const value = describeIsolationCapabilities(provider, hosts);
    const policy = value.networkPolicy;
    assert.equal(policy.status, "ready");
    if (policy.status !== "ready") assert.fail();
    const expected = [
      ...(provider === "codex"
        ? ["auth.openai.com", "chatgpt.com"]
        : ["api.anthropic.com", "claude.ai", "platform.claude.com"]),
      "pypi.org",
      "registry.npmjs.org",
    ].sort();
    const hash = createHash("sha256")
      .update("crdd-docker-network-policy-v1\0")
      .update(
        JSON.stringify([
          1,
          "repository_ai_execution",
          provider,
          expected,
          443,
          "CONNECT",
        ]),
      )
      .digest("hex");
    assert.deepEqual(policy.policy.allowedHosts, expected);
    assert.equal(policy.policy.policyHash, hash);
    assert.deepEqual(policy, prepareDockerNetworkPolicy(provider, hosts));
    hosts[0] = "changed.example.com";
    assert.deepEqual(policy.policy.allowedHosts, expected);
    assert.ok(Object.isFrozen(policy.policy.allowedHosts));
    const maximum = Array.from(
      { length: 32 },
      (_, i) => `host${i}.example.com`,
    );
    assert.equal(
      describeIsolationCapabilities(provider, maximum).networkPolicy.status,
      "ready",
    );
    assert.equal(
      describeIsolationCapabilities(provider, [...maximum, "extra.example.com"])
        .networkPolicy.status,
      "blocked",
    );
  }
});

/**
 * 不正追加集合をmetadata取得成功で覆い隠さないことを確認する。
 * @responsibility getter・Proxyを評価せず既存拒否条件へ接続する。
 * @trace ERB-UT-023
 * @precondition 合成不正値だけを用いる。
 * @stimulus URL、重複、疎配列、Proxy、getter配列を渡す。
 * @observation blocked、固定理由、getter実行数。
 * @oracle metadataがあっても通信条件不成立のまま保持する。
 * @cleanup N/A: 外部資源なし。
 */
test("Catalogは不正追加Hostをblockedのまま返し型相関も維持する", () => {
  let reads = 0;
  const getter = Object.defineProperty(["example.com"], "0", {
    get() {
      reads++;
      return "example.com";
    },
  });
  for (const input of [
    null,
    {},
    ["https://example.com"],
    ["same.example", "SAME.EXAMPLE"],
    Array(1),
    new Proxy([], {}),
    getter,
  ])
    for (const provider of ["codex", "claude"] as const)
      assert.deepEqual(
        describeIsolationCapabilities(provider, input).networkPolicy,
        {
          status: "blocked",
          reason: "docker_network_policy_invalid",
        },
      );
  const codex: IsolationCapabilities<"codex"> =
    describeIsolationCapabilities("codex");
  const claude: IsolationCapabilities<"claude"> =
    describeIsolationCapabilities("claude");
  // @ts-expect-error 別ProviderのAssetsを同じ配置型として扱わない。
  const mismatch: IsolationCapabilities<"claude"> = codex;
  // @ts-expect-error Claudeには架空の別Image配置を公開しない。
  const missing = claude.locations.alternate;
  void mismatch;
  assert.equal(missing, undefined);
  assert.equal(reads, 0);
});
