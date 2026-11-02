/**
 * Repository通信設定から同意用Hashへの本番接続を確認する。
 * @responsibility Domain読取り後・送信同意前に同じDI正本へ接続することを反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope Domain読取りを有限化しCatalog実本文を使う。実AI・Docker・保存操作なし。
 * @boundary 同意や通信強制の成立は別契約。ここでは実効値の搬送を確認する。
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as isolation from "../../../../docker-isolation/src/index.ts";
import { prepareDockerNetworkPolicy } from "../../../../docker-isolation/src/network/policy.ts";
import * as domain from "../../../../domain-model/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../../version-control/src/index.ts";

/**
 * 両Providerへ同じ追加集合を渡し、blockedを上位へ保持する。
 * @responsibility 純粋Catalogへの移管で同意対象Hashや読取り範囲を変えない。
 * @trace ERB-UT-023
 * @precondition 選定済みRootは有限Readerだけへ渡す。
 * @stimulus 正常・不正追加Host・Domain読取り不能を与える。
 * @observation Root参照、各Providerの元配列、Policyと要求回数。
 * @oracle 同じ正本のHash、不正時blocked、読取り不能時Catalog呼出し0。
 * @cleanup Module代役を解除する。Fileや外部資源を取得しない。
 */
test("同意前の通信条件はCatalog正本から確定し不正入力を許可へ変えない", async (t) => {
  const root = Object.freeze({
    fixture: "selected_repository",
  }) as unknown as VerifiedRepositoryRoot;
  let hosts = ["PYPI.ORG", "registry.npmjs.org"];
  let unavailable = false,
    reads = 0;
  const supplied: unknown[][] = [];
  t.mock.module("../../../../domain-model/src/index.ts", {
    namedExports: {
      ...domain,
      readNetworkPolicy(current: unknown) {
        reads++;
        assert.equal(current, root);
        return unavailable
          ? { status: "blocked", reason: "synthetic_read_unavailable" }
          : { status: "ready", policy: { version: 1, allowedHosts: hosts } };
      },
    },
  });
  t.mock.module("../../../../docker-isolation/src/index.ts", {
    namedExports: {
      ...isolation,
      describeIsolationCapabilities(
        provider: "codex" | "claude",
        additions: unknown,
      ) {
        supplied.push([provider, additions]);
        return isolation.describeIsolationCapabilities(provider, additions);
      },
    },
  });
  const { readRepositoryNetworkPolicies } = await import(
    "../../../src/decision/external-send-policy.ts"
  );
  const result = readRepositoryNetworkPolicies(root);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") assert.fail();
  for (const provider of ["codex", "claude"] as const) {
    const expected = prepareDockerNetworkPolicy(provider, hosts);
    assert.equal(expected.status, "ready");
    if (expected.status !== "ready") assert.fail();
    assert.deepEqual(result.policies[provider], expected.policy);
  }
  assert.deepEqual(
    supplied.map(([provider]) => provider),
    ["codex", "claude"],
  );
  assert.ok(supplied.every(([, additions]) => additions === hosts));
  const fixedHash = result.policies.codex.policyHash;
  hosts[0] = "changed.example.com";
  assert.equal(result.policies.codex.policyHash, fixedHash);
  assert.equal(
    result.policies.codex.allowedHosts.includes("changed.example.com"),
    false,
  );
  hosts = ["https://not-a-host"];
  assert.deepEqual(readRepositoryNetworkPolicies(root), {
    status: "blocked",
    reason: "network_policy_invalid",
  });
  const before = supplied.length;
  unavailable = true;
  assert.deepEqual(readRepositoryNetworkPolicies(root), {
    status: "blocked",
    reason: "synthetic_read_unavailable",
  });
  assert.equal(supplied.length, before);
  assert.equal(reads, 3);
});
