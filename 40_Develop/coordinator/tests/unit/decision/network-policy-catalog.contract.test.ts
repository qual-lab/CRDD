/**
 * Repository追加通信先の開始時捕捉とTask内固定を確認する。
 * @responsibility Domain読取りと技術Policy構成を分離し、上位にDI正本を複製しない。
 * @trace ERB-UT-023
 * @level UT
 * @scope Domain Readerだけ有限化。実AI・Docker・保存操作なし。
 * @boundary この試験は通信強制やHost名の技術検査を主張しない。
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as domain from "../../../../configuration-model/src/index.ts";
import type { Repository } from "../../../../version-control/src/index.ts";

/**
 * 開始時に追加Hostを一回捕捉し、変更は次Taskから適用する。
 * @responsibility Domain由来の設定を再利用や旧値fallbackへ変換しない。
 * @trace ERB-UT-023
 * @precondition Readerは合成Rootだけを受け付ける。
 * @stimulus 元配列の後発変更、次の読取り、読取り失敗。
 * @observation Reader回数、元Snapshotと更新後Snapshot。
 * @oracle 不変配列・次回更新・読取り失敗の明示拒否。
 * @cleanup Module代役を試験終了時に解除する。
 * @boundary Process内の値搬送。通信制限はDI試験が所有する。
 */
test("Taskの追加Hostは開始時に捕捉し次Taskだけが変更を採用する", async (t) => {
  const root = Object.freeze({
    fixture: "selected_repository",
  }) as unknown as Repository;
  const hosts = ["pypi.org", "registry.npmjs.org"];
  let unavailable = false,
    reads = 0;
  t.mock.module("../../../../configuration-model/src/index.ts", {
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
  const { readRepositoryNetworkHosts } = await import(
    "../../../src/decision/external-send-policy.ts"
  );
  const first = readRepositoryNetworkHosts(root);
  assert.equal(first.status, "ready");
  if (first.status !== "ready") assert.fail();
  assert.deepEqual(first.additionalHosts, hosts);
  assert.equal(Object.isFrozen(first.additionalHosts), true);
  hosts[0] = "changed.example.com";
  assert.equal(first.additionalHosts.includes("changed.example.com"), false);
  const next = readRepositoryNetworkHosts(root);
  assert.equal(next.status, "ready");
  if (next.status !== "ready") assert.fail();
  assert.deepEqual(next.additionalHosts, hosts);
  assert.notEqual(next.additionalHosts, hosts);
  unavailable = true;
  assert.deepEqual(readRepositoryNetworkHosts(root), {
    status: "blocked",
    reason: "synthetic_read_unavailable",
  });
  assert.equal(reads, 3);
  assert.doesNotMatch(
    fs.readFileSync(
      new URL("../../../src/decision/external-send-policy.ts", import.meta.url),
      "utf8",
    ),
    /docker-isolation/u,
  );
});
