/**
 * 通常・単独回収の共通処置と認証Receipt捕捉を検証する。
 * @responsibility 不正入力・通知失敗・明示取消を実操作なしで反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope メモリ内の固定資源と有限代役だけを使用する。
 * @boundary DI共通回収。実Docker・AI・既存保持物は操作しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { DockerResourceReceipts } from "../support/cleanup.ts";
import { captureAuthenticationResources } from "../support/authentication/cleanup.ts";
import { cleanupDockerResource } from "../../src/cleanup/operations.ts";
import type { DockerResourceExpectation } from "../../src/cleanup/types.ts";
import { discoverSubmittedDockerResource } from "../../src/cleanup/resource.ts";
import { cleanupResourceSet } from "../support/cleanup.ts";

/** 入力読取りでaccessorを実行せず、元計画の順序・種類・実IDだけを採用する。 */
test("認証Receiptは元構成と一致した通常データだけを固定する", () => {
  const expected = [
    {
      kind: "container" as const,
      name: "crdd-auth-0123456789abcdef",
      dockerId: null,
    },
  ];
  const source = [{ ...expected[0], dockerId: "a".repeat(64) }];
  const result = captureAuthenticationResources(expected, source);
  assert.ok(result);
  const item = source[0];
  assert.ok(item);
  item.dockerId = "b".repeat(64);
  assert.equal(result[0]?.dockerId, "a".repeat(64));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result[0]));
  let reads = 0;
  const accessor = {
    kind: "container",
    name: expected[0]?.name,
    get dockerId() {
      reads++;
      return null;
    },
  };
  for (const bad of [
    null,
    [],
    [{ ...source[0], name: "foreign" }],
    [{ ...source[0], kind: "network" }],
    [{ ...source[0], dockerId: "short" }],
    [accessor],
    [new Proxy(item, {})],
    new Proxy(source, {}),
  ])
    assert.equal(captureAuthenticationResources(expected, bad), null);
  assert.equal(reads, 0);
});

/** 発見通知後の構成変化でも、ID欠測由来の削除直前完全構成検査を維持する。 */
test("共通回収は元Receiptと発見IDの照合条件を通知後も混同しない", async () => {
  for (const mode of ["receipt", "discovery", "discovery_changed"] as const) {
    const id = "a".repeat(64);
    let exists = true,
      internal = mode !== "receipt",
      removed = 0;
    const receipt = {
      submitted: true,
      dockerId: mode === "receipt" ? id : null,
    };
    const none = { submitted: false, dockerId: null };
    const receipts: DockerResourceReceipts = {
      create_subscription_auth_probe: none,
      create_provider: none,
      create_proxy: none,
      create_internal_network: receipt,
      create_egress_network: none,
    };
    const expected: DockerResourceExpectation = {
      kind: "network",
      dockerId: id,
      expectedName: "crdd-internal-0123456789abcdef",
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      expectedImage: null,
      shouldBeInternal: true,
      expectedNetworks: [],
      initRequired: false,
      key: "create_internal_network",
      expectedUser: null,
      tmpfsBytes: null,
      expectedMounts: [],
    };
    const run = (argv: readonly string[]) => {
      let stdout = "";
      if (argv.includes("inspect"))
        stdout = JSON.stringify([
          {
            Id: id,
            Name: expected.expectedName,
            Labels: { "crdd.coordinator.runtime": "0123456789abcdef" },
            Internal: internal,
            Driver: "bridge",
            Scope: "local",
          },
        ]);
      else if (argv.includes("rm")) {
        removed++;
        exists = false;
      } else if (argv.includes("ls")) stdout = exists ? id : "";
      else assert.fail("unexpected_command");
      return { status: 0, signal: null, stdout, stderr: "", error: null };
    };
    const result = await cleanupResourceSet(
      {
        expectations: [
          { purpose: "create_internal_network", expectations: [expected] },
        ],
        receipts,
      },
      {
        discoverSubmitted: (candidate) =>
          discoverSubmittedDockerResource(run, candidate),
        cleanupObserved: (
          candidate,
          signal,
          absent,
          requireConfigurationMatch,
        ) =>
          cleanupDockerResource(
            run,
            candidate,
            signal,
            absent,
            requireConfigurationMatch,
          ),
      },
      {
        onResourceIdentified: () => {
          if (mode === "discovery_changed") {
            internal = false;
            receipt.dockerId = id;
          }
        },
      },
    );
    assert.equal(
      result.status,
      mode === "discovery_changed" ? "blocked" : "completed",
    );
    assert.equal(removed, mode === "discovery_changed" ? 0 : 1);
  }
});

/** 同じ回収coreへ渡したReceipt列を、通常と再入場で同じ条件で処置する。 */
test("共通回収は全Receipt検査・通知完了・明示取消を処置前に要求する", async () => {
  const none = { submitted: false, dockerId: null };
  const receipts: DockerResourceReceipts = {
    create_subscription_auth_probe: none,
    create_provider: none,
    create_proxy: none,
    create_internal_network: { submitted: true, dockerId: "a".repeat(64) },
    create_egress_network: none,
  };
  const expected: DockerResourceExpectation = {
    kind: "network",
    dockerId: "a".repeat(64),
    expectedName: "crdd-internal-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    expectedImage: null,
    shouldBeInternal: true,
    expectedNetworks: [],
    initRequired: false,
    key: "create_internal_network",
    expectedUser: null,
    tmpfsBytes: null,
    expectedMounts: [],
  };
  const expectations = [
    { purpose: "create_internal_network" as const, expectations: [expected] },
  ];
  for (const mode of [
    "normal",
    "notification_failure",
    "cancelled",
    "invalid_receipt",
  ] as const) {
    let calls = 0;
    const signal = new AbortController();
    if (mode === "cancelled") signal.abort();
    const result = await cleanupResourceSet(
      {
        expectations,
        receipts:
          mode === "invalid_receipt"
            ? {
                ...receipts,
                create_internal_network: {
                  submitted: false,
                  dockerId: "a".repeat(64),
                },
              }
            : receipts,
        signal: signal.signal,
      },
      {
        cleanupObserved: async () => {
          calls++;
          return true;
        },
      },
      {
        onResourceInspecting: () => {
          if (mode === "notification_failure") throw Error("save_failed");
        },
      },
    );
    assert.equal(result.status, mode === "normal" ? "completed" : "blocked");
    assert.equal(calls, mode === "normal" ? 1 : 0);
  }
});
