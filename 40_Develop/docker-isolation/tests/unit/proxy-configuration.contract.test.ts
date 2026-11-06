/**
 * 確定通信条件からのProxy・Client環境構成を純粋な入力検査で反証する。
 * @responsibility 実行前のPolicy相関・変更隔離・上書き拒否を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 通常dataだけ。CLI・Filesystem・Docker・AIを使用しない。
 * @boundary 固定技術RequestとDIの純粋構成。
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { captureIsolationRequest } from "../../src/execution/preparation.ts";
import type {
  IsolationContainer,
  IsolationRequest,
} from "../../src/execution/types.ts";
import {
  describeDockerProviderAssets,
  DIAGNOSTIC_IMAGE,
  resolveDockerImageProfile,
} from "../../src/image/assets.ts";

/**
 * 有限の技術資源と操作列だけを組み立てる。外部資源を作成しない。
 * @responsibility requestで確定通信条件からのProxy・Client環境構成を純粋な入力検査で反証する。
 * @trace ERB-UT-023
 * @precondition 通常dataだけ。CLI・Filesystem・Docker・AIを使用しない。
 * @stimulus requestで確定通信条件からのProxy・Client環境構成を純粋な入力検査で反証する。。
 * @observation 構築した候補、有限応答または検出した例外。
 * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
 * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
 * @boundary 固定技術RequestとDIの純粋構成。
 */
function request(
  additionalHosts: readonly string[] | null = ["registry.npmjs.org"],
): IsolationRequest {
  const assets = describeDockerProviderAssets("codex");
  const container: IsolationContainer = {
    kind: "container",
    key: "client",
    name: "crdd-codex-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    image: assets.fixedImageDigest,
    argv: ["synthetic"],
    environment: { HOME: "/provider-home" },
    mounts: [],
    network: "internal",
    networkAlias: null,
    user: "65534:65534",
    workingDirectory: null,
    entrypoint: null,
    tmpfsBytes: null,
    interactive: false,
    tty: false,
    init: false,
    seccomp: null,
  };
  return {
    managementDirectory: "C:\\fixture\\management",
    proxy: {
      resource: "proxy",
      clients: ["client"],
      profile: "codex",
      token: "a".repeat(64),
      additionalHosts,
      environmentMode: "all",
    },
    resources: [
      {
        kind: "network",
        key: "internal",
        name: "crdd-internal-0123456789abcdef",
        ownershipLabel: container.ownershipLabel,
        internal: true,
      },
      {
        kind: "network",
        key: "egress",
        name: "crdd-egress-0123456789abcdef",
        ownershipLabel: container.ownershipLabel,
        internal: false,
      },
      {
        ...container,
        key: "proxy",
        name: "crdd-proxy-0123456789abcdef",
        image: assets.proxy.imageDigest,
        argv: [],
        environment: {},
        networkAlias: "proxy",
        tmpfsBytes: 16777216,
      },
      container,
    ],
    steps: [
      ...["internal", "egress", "proxy"].map((key) => ({
        key: `create_${key}`,
        action: "create" as const,
        resource: key,
        timeoutMs: 10000,
      })),
      {
        key: "connect",
        action: "connect",
        resource: "proxy",
        network: "egress",
        timeoutMs: 10000,
      },
      {
        key: "create_client",
        action: "create",
        resource: "client",
        timeoutMs: 10000,
      },
    ],
    cleanupOrder: ["client", "proxy", "internal", "egress"],
    setupTimeoutMs: 10000,
    unreceiptedAbsence: "retain",
    verifyLabelAbsence: true,
  };
}

/**
 * 正規Policy・Client環境と入力分離を独立期待値で確認する。
 * @responsibility 構成成功を通信や実行の成功へ昇格しない。
 * @trace ERB-UT-023
 * @precondition 合成Requestだけを使用する。
 * @stimulus 正常、再捕捉、後発変更、追加なしを渡す。
 * @observation Hash・環境・凍結と元入力の不変。
 * @oracle 同じ確定入力からPolicyと接続環境が一致する。
 * @cleanup N/A: 外部Effectなし。
 * @boundary 固定技術RequestとDIの純粋構成。
 */
test("通信構成は同じ入力からPolicyとProxy環境を生成し後発変更を分離する", () => {
  const hosts = ["registry.npmjs.org"];
  const source = request(hosts),
    resolved = captureIsolationRequest(source);
  const proxy = resolved.resources.find(
    (r) => r.key === "proxy",
  ) as IsolationContainer;
  const client = resolved.resources.find(
    (r) => r.key === "client",
  ) as IsolationContainer;
  const policy = JSON.parse(
    proxy.environment.CRDD_PROXY_NETWORK_POLICY ?? "null",
  );
  const allowed = ["auth.openai.com", "chatgpt.com", "registry.npmjs.org"];
  const hash = createHash("sha256")
    .update("crdd-docker-network-policy-v1\0")
    .update(
      JSON.stringify([
        1,
        "repository_ai_execution",
        "codex",
        allowed,
        443,
        "CONNECT",
      ]),
    )
    .digest("hex");
  assert.deepEqual(policy.allowedHosts, allowed);
  assert.equal(policy.policyHash, hash);
  assert.equal(
    client.environment.HTTPS_PROXY,
    `http://crdd:${"a".repeat(64)}@proxy:8080`,
  );
  assert.equal(client.environment.NO_PROXY, "");
  assert.equal(client.environment.https_proxy, client.environment.HTTPS_PROXY);
  assert.equal(Object.isFrozen(client.environment), true);
  assert.deepEqual(captureIsolationRequest(resolved), resolved);
  hosts.push("changed.example");
  assert.deepEqual(resolved.proxy?.additionalHosts, ["registry.npmjs.org"]);
  assert.equal(
    Object.keys((source.resources[2] as IsolationContainer).environment).length,
    0,
  );
  const fixedOnly = captureIsolationRequest(request(null))
    .resources[2] as IsolationContainer;
  assert.equal(
    Object.hasOwn(fixedOnly.environment, "CRDD_PROXY_NETWORK_POLICY"),
    false,
  );
});

/**
 * 不正Host・参照差・直接通信・矛盾環境を構成段階で拒否する。
 * @responsibility 同じ入力と接続環境の相関を省略しない。
 * @trace ERB-UT-023
 * @precondition 合成通常dataだけ。
 * @stimulus 上限境界、上書き、参照欠測、旧環境だけ、Proxy・getterを与える。
 * @observation 構成例外とgetter実行数0。
 * @oracle DockerやFilesystemへ接続せず拒否する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 固定技術RequestとDIの純粋構成。
 */
test("不正通信構成は要求前に拒否し旧Proxy環境へfallbackしない", () => {
  assert.doesNotThrow(() =>
    captureIsolationRequest(
      request(Array.from({ length: 32 }, (_, i) => `host${i}.example`)),
    ),
  );
  assert.throws(() =>
    captureIsolationRequest(
      request(Array.from({ length: 33 }, (_, i) => `host${i}.example`)),
    ),
  );
  for (const hosts of [
    ["127.0.0.1"],
    ["same.example", "same.example"],
    ["0x7f000001"],
  ])
    assert.throws(() => captureIsolationRequest(request(hosts)));
  const base = request();
  for (const change of [
    { ...base, proxy: undefined },
    { ...base, proxy: { ...base.proxy, clients: ["missing"] } },
    {
      ...base,
      resources: base.resources.map((r) =>
        r.key === "client" ? { ...r, network: "egress" } : r,
      ),
    },
    {
      ...base,
      resources: base.resources.map((r) =>
        r.key === "proxy"
          ? { ...r, environment: { CRDD_PROXY_PROFILE: "claude" } }
          : r,
      ),
    },
  ])
    assert.throws(() => captureIsolationRequest(change as IsolationRequest));
  let reads = 0;
  const host = Object.defineProperty([], "0", {
    get() {
      reads++;
      return "wrong.example";
    },
    enumerable: true,
  });
  assert.throws(() => captureIsolationRequest(request(host)));
  assert.equal(reads, 0);
  assert.throws(() => captureIsolationRequest(request(new Proxy([], {}))));
});

/**
 * 固定Imageの技術制約を同じCatalogで検証する。
 * @responsibility User・Entrypoint・外向き接続を用途分岐から分離する。
 * @trace ERB-UT-023
 * @precondition 固定Catalogと純粋な共通入力捕捉だけを使用する。
 * @stimulus 全固定Imageの制約、未知Digest、User／Entrypoint差、直接外向き接続を与える。
 * @observation 制約の不変値と入力の受理・拒否。
 * @oracle 元制約だけ受理し、未知・差分・非Proxyの外向き接続を拒否する。
 * @cleanup N/A: 資源取得なし。
 * @boundary Image Catalogから共通Preparation。
 */
test("固定Image制約はCatalogで一致し未知Imageと条件差を拒否する", () => {
  const codex = describeDockerProviderAssets("codex"),
    claude = describeDockerProviderAssets("claude");
  const rows = [
    {
      image: codex.fixedImageDigest,
      user: "65534:65534" as const,
      entrypoint: null,
    },
    {
      image: codex.alternateIdentity.fixedImageDigest,
      user: "65534:65534" as const,
      entrypoint: null,
    },
    {
      image: claude.fixedImageDigest,
      user: "65534:65534" as const,
      entrypoint: null,
    },
    {
      image: DIAGNOSTIC_IMAGE,
      user: "65532:65532" as const,
      entrypoint: "python" as const,
    },
  ];
  const original = request();
  const client = original.resources.find((r) => r.key === "client");
  assert.ok(client && client.kind === "container");
  for (const row of rows) {
    const profile = resolveDockerImageProfile(row.image);
    assert.ok(profile);
    assert.equal(profile.user, row.user);
    assert.equal(profile.externalNetwork, false);
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.entrypoints), true);
    const input: IsolationRequest = {
      managementDirectory: original.managementDirectory,
      resources: [{ ...client, ...row, network: null }],
      steps: [
        {
          key: "create",
          action: "create",
          resource: "client",
          timeoutMs: 1000,
        },
      ],
      cleanupOrder: ["client"],
      setupTimeoutMs: 1000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: false,
    };
    assert.ok(captureIsolationRequest(input));
    assert.throws(() =>
      captureIsolationRequest({
        ...input,
        resources: [
          {
            ...client,
            ...row,
            network: null,
            user: row.user === "65534:65534" ? "65532:65532" : "65534:65534",
          },
        ],
      }),
    );
    if (row.image !== DIAGNOSTIC_IMAGE)
      assert.throws(() =>
        captureIsolationRequest({
          ...input,
          resources: [
            { ...client, ...row, network: null, entrypoint: "python" },
          ],
        }),
      );
    assert.throws(() =>
      captureIsolationRequest({
        ...input,
        resources: [
          {
            kind: "network",
            key: "egress",
            name: "crdd-utility-network",
            ownershipLabel: client.ownershipLabel,
            internal: false,
          },
          { ...client, ...row, network: "egress" },
        ],
        steps: [
          {
            key: "network",
            action: "create",
            resource: "egress",
            timeoutMs: 1000,
          },
          ...input.steps,
        ],
        cleanupOrder: ["client", "egress"],
      }),
    );
  }
  const proxy = resolveDockerImageProfile(codex.proxy.imageDigest);
  assert.ok(proxy);
  assert.equal(proxy.externalNetwork, true);
  assert.equal(proxy.user, "65534:65534");
  assert.deepEqual(proxy.entrypoints, [null]);
  assert.equal(resolveDockerImageProfile("sha256:" + "f".repeat(64)), null);
});
