/**
 * 追加通信先の純粋構成とHash相関を検証する。
 * @packageDocumentation
 * @responsibility Host入力の拒否・Provider分離・不変Snapshotを反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope Repository内AI実行の通信条件。Proxy強制は別試験。
 * @boundary 外部Effectのない値構成。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareDockerNetworkPolicy,
  parseDockerNetworkPolicy,
} from "../../../src/index.ts";

/**
 * 同じ実効集合のHashとProvider別固定Hostを検証する。
 * @responsibility 設定順序・表記差を不要な許可差へ変換しない。
 * @trace ERB-UT-023
 * @precondition 固定の文字列配列だけを使用する。
 * @stimulus 順序・大小文字・固定Host重複・Providerを変える。
 * @observation 不変PolicyとHashを比較する。
 * @oracle 同じ集合は同じHash、別Providerは別Hash、入力変更は返却値へ反映0。
 * @cleanup N/A: Process・File・Dockerを作成しない。
 * @boundary 純粋な通信条件構成だけ。
 */
test("実効通信条件はProvider固定集合と追加集合へ結合し深く固定する", () => {
  const input = ["PYPI.ORG", "registry.npmjs.org"];
  const first = prepareDockerNetworkPolicy("codex", input);
  const second = prepareDockerNetworkPolicy(
    "codex",
    [...input].reverse().map((host) => host.toLowerCase()),
  );
  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  if (first.status !== "ready" || second.status !== "ready") assert.fail();
  assert.equal(first.policy.policyHash, second.policy.policyHash);
  assert.deepEqual(first.policy.allowedHosts, [
    "auth.openai.com",
    "chatgpt.com",
    "pypi.org",
    "registry.npmjs.org",
  ]);
  assert.equal(first.policy.allowedPort, 443);
  assert.equal(first.policy.allowedMethod, "CONNECT");
  assert.equal(first.policy.purpose, "repository_ai_execution");
  assert.ok(
    Object.isFrozen(first) &&
      Object.isFrozen(first.policy) &&
      Object.isFrozen(first.policy.allowedHosts),
  );
  input.push("other.example");
  assert.equal(first.policy.allowedHosts.includes("other.example"), false);
  const empty = prepareDockerNetworkPolicy("claude", []);
  assert.equal(empty.status, "ready");
  if (empty.status !== "ready") assert.fail();
  assert.deepEqual(empty.policy.allowedHosts, [
    "api.anthropic.com",
    "claude.ai",
    "platform.claude.com",
  ]);
  assert.notEqual(empty.policy.policyHash, first.policy.policyHash);
  assert.deepEqual(
    prepareDockerNetworkPolicy("codex", ["CHATGPT.COM"]),
    prepareDockerNetworkPolicy("codex", []),
  );
});

/**
 * 不正Hostと有限上限を同じ入力母集団で検証する。
 * @responsibility URL・IP・Unicode・wildcardをDNS名へ補正しない。
 * @trace ERB-UT-023
 * @precondition ネットワーク照会を行わない。
 * @stimulus 不正表記・重複・件数・label長境界を与える。
 * @observation ready又は固定blockedを読む。
 * @oracle 許容境界だけ受理し不正は全て拒否する。
 * @cleanup N/A: 値計算だけ。
 * @boundary DNSの実公開IP確認はこの試験の対象外。
 */
test("通信先はASCII DNS名と有限境界だけを受理する", () => {
  for (const host of [
    "",
    "https://npmjs.org",
    "a.example:443",
    "a/b",
    "*.example",
    "a.example.",
    "127.0.0.1",
    "127.1",
    "2130706433",
    "0x7f000001",
    "0x08080808",
    "0177.0.0.1",
    "1.2.3",
    "::1",
    "a..b",
    "-a.example",
    "a-.example",
    " a.example",
    "a.example\n",
    "é.example",
    "K.example",
    `${"a".repeat(64)}.example`,
    "a".repeat(254),
  ]) {
    assert.deepEqual(
      prepareDockerNetworkPolicy("codex", [host]),
      { status: "blocked", reason: "docker_network_policy_invalid" },
      host,
    );
  }
  for (const hosts of [
    ["a.example", "A.example"],
    Array.from({ length: 33 }, (_, index) => `a${index}.example`),
  ])
    assert.equal(prepareDockerNetworkPolicy("codex", hosts).status, "blocked");
  for (const host of [
    `${"a".repeat(63)}.example`,
    "localhost",
    "123.example",
    "1password.example",
    "xn--bcher-kva.example",
    ["a".repeat(63), "b".repeat(63), "c".repeat(63), "d".repeat(61)].join("."),
  ])
    assert.equal(
      prepareDockerNetworkPolicy("codex", [host]).status,
      "ready",
      host,
    );
  assert.equal(
    prepareDockerNetworkPolicy(
      "claude",
      Array.from({ length: 32 }, (_, index) => `a${index}.example`),
    ).status,
    "ready",
  );
});

/**
 * 配列の能動的入力を実行せず拒否する。
 * @responsibility getter・Proxy・疎配列・余分fieldから許可集合を作らない。
 * @trace ERB-UT-023
 * @precondition 副作用を数える局所変数だけを使用する。
 * @stimulus getter・Proxy・hole・別prototypeを渡す。
 * @observation blockedと副作用回数0。
 * @oracle 不正配列の読取りコードを実行しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary JavaScript入力と値Snapshot。
 */
test("不正配列をgetterやProxyの実行なしで拒否する", () => {
  let effects = 0;
  const accessor: string[] = [];
  Object.defineProperty(accessor, "0", {
    get() {
      effects += 1;
      return "a.example";
    },
  });
  const proxy = new Proxy([], {
    get() {
      effects += 1;
      throw new Error("unexpected");
    },
  });
  for (const input of [
    accessor,
    proxy,
    new Array(1),
    Object.assign([], { extra: true }),
    Object.setPrototypeOf([], null),
    null,
    {},
    "a.example",
  ])
    assert.equal(prepareDockerNetworkPolicy("codex", input).status, "blocked");
  assert.equal(effects, 0);
  assert.equal(prepareDockerNetworkPolicy("unknown", []).status, "blocked");
});

/**
 * 搬送された通信設定の閉構造・意味Hash・固定集合を再照合する。
 * @responsibility コピーされた値を認可として信頼せず正規形へ固定する。
 * @trace ERB-UT-023
 * @precondition 合成のHostだけを構成する。
 * @stimulus Provider・Hash・集合・余剰値・getterを変更する。
 * @observation 受理値の深い凍結、nullとgetter呼出し0。
 * @oracle 全項目一致だけを受理し元値を保持しない。
 * @cleanup N/A: 資源なし。
 * @boundary 純粋な値の再検査。
 */
test("搬送設定は正規形とHashを再照合し入力参照を保持しない", () => {
  const ready = prepareDockerNetworkPolicy("codex", ["pypi.org"]);
  if (ready.status !== "ready") assert.fail();
  const value = {
    ...ready.policy,
    allowedHosts: [...ready.policy.allowedHosts],
  };
  const parsed = parseDockerNetworkPolicy(value);
  assert.deepEqual(parsed, value);
  assert.notEqual(parsed, value);
  assert.ok(Object.isFrozen(parsed) && Object.isFrozen(parsed.allowedHosts));
  let effects = 0;
  const getter = { ...value };
  Object.defineProperty(getter, "allowedHosts", {
    get() {
      effects++;
      return [];
    },
  });
  for (const invalid of [
    null,
    {},
    { ...value, extra: true },
    { ...value, provider: "claude" },
    { ...value, policyHash: "a".repeat(64) },
    { ...value, allowedPort: 80 },
    { ...value, allowedHosts: ["pypi.org"] },
    { ...value, allowedHosts: [...value.allowedHosts].reverse() },
    { ...value, allowedHosts: [...value.allowedHosts, "pypi.org"] },
    getter,
    new Proxy(value, {}),
  ])
    assert.equal(parseDockerNetworkPolicy(invalid), null);
  assert.equal(effects, 0);
  value.allowedHosts.push("changed.example");
  assert.equal(parsed.allowedHosts.includes("changed.example"), false);
});
