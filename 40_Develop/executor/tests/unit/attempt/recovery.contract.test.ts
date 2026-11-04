/**
 * Attempt単独の診断・回収を実DI接続の有限代役で検査する。
 * @packageDocumentation
 * @responsibility 保存前削除・明示取消・config終了・元参照の反例を固定する。
 * @trace ERB-IT-014
 * @level UT
 * @scope 本番API本文とメモリ代役。実Docker・Filesystem書込みは行わない。
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createAttemptRecoveryTestApi } from "../../../scripts/attempt-recovery-test.ts";
import type {
  ResourceCleanupCallbacks,
  ResourceCleanupResult,
  ResourceTarget,
} from "../../../src/index.ts";

const ID = "a".repeat(64);

/** Cleanup欠測を読取り専用の旧操作で成功させない。 */
test("回収試験Adapterは現行Cleanup操作の欠測を拒否し旧操作を呼ばない", async () => {
  let legacy = 0;
  const api = createAttemptRecoveryTestApi(() => ({
    status: "ready",
    executor: {
      inspectIdentity: () => {
        legacy++;
        return true;
      },
      close: () => true,
    },
  }));
  const none = { submitted: false, dockerId: null };
  const result = await api.cleanupResources({
    kind: "resource_set",
    operationId: "operation-a",
    recoveryId: "exact-recovery",
    projection: PROJECTION,
    managementDirectory: path.resolve("borrowed"),
    receipts: {
      create_provider: { submitted: true, dockerId: ID },
      create_subscription_auth_probe: none,
      create_proxy: none,
      create_internal_network: none,
      create_egress_network: none,
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.recoveryId, "exact-recovery");
  assert.equal(legacy, 0);
});
const PROJECTION: ResourceTarget<"attempt">["projection"] = Object.freeze({
  authContainerName: "crdd-auth-0123456789abcdef",
  providerContainerName: "crdd-claude-0123456789abcdef",
  proxyContainerName: "crdd-proxy-0123456789abcdef",
  internalNetworkName: "crdd-internal-0123456789abcdef",
  egressNetworkName: "crdd-egress-0123456789abcdef",
  ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
  providerImageDigest: `sha256:${"b".repeat(64)}`,
  proxyImageDigest: `sha256:${"c".repeat(64)}`,
  subscriptionOffering: "claude_max",
  operationMode: "isolated_task",
  workspaceMountMode: "read_write",
});

/** 最終通知失敗で一次理由を上書きせず、config終了失敗だけを優先する。 */
test("共通回収は最終通知の故障と一次失敗の理由を区別する", async () => {
  for (const outcome of ["clean", "unknown", "config_failed"] as const)
    for (const notification of ["throw", "reject", "value"] as const) {
      let removals = 0,
        closes = 0;
      const api = createAttemptRecoveryTestApi(() => ({
        status: "ready",
        executor: {
          cleanupObserved: async () => {
            removals++;
            return outcome !== "unknown";
          },
          close: () => {
            closes++;
            return outcome !== "config_failed";
          },
        },
      }));
      const none = { submitted: false, dockerId: null };
      const result = await api.cleanupResources(
        {
          kind: "resource_set",
          operationId: "operation-a",
          recoveryId: "exact-recovery",
          projection: PROJECTION,
          managementDirectory: path.resolve("borrowed"),
          receipts: {
            create_subscription_auth_probe: none,
            create_provider: { submitted: true, dockerId: ID },
            create_proxy: none,
            create_internal_network: none,
            create_egress_network: none,
          },
        },
        {
          onCleanupCompleted: (() => {
            if (notification === "throw") throw Error("notification_failed");
            if (notification === "reject")
              return Promise.reject(Error("notification_failed"));
            return true;
          }) as () => void,
        },
      );
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        outcome === "config_failed"
          ? "docker_task_recovery_config_cleanup_unconfirmed"
          : outcome === "unknown"
            ? "docker_task_recovery_resource_unconfirmed"
            : "docker_task_recovery_checkpoint_unconfirmed",
      );
      assert.equal(result.recoveryId, "exact-recovery");
      assert.equal(result.operationId, "operation-a");
      assert.equal(removals, 1);
      assert.equal(closes, 1);
      assert.equal(result.dockerCleanupConfirmed, outcome !== "unknown");
    }
});

/**
 * 単独回収の各失敗窓と共通通知の順序を比較する。
 * @responsibility 発見IDの通知完了前の削除0と元configの必須closeを確認する。
 * @trace ERB-IT-014
 * @precondition 同じ実API本文と有限のDI代役。
 * @stimulus 通常・未要求・保存失敗・誤Promise・明示取消・回収不明・close失敗。
 * @observation 発行順、元実ID、削除数、close数、結果の相関。
 * @oracle 未完了の保存では削除0。不明は成功へ丸めずconfigを必ずcloseする。
 * @cleanup N/A: メモリ内だけ。後着拒否を消費するまで進める。
 */
test("Attempt回収は発見保存と取消確認を削除前に保ちconfigを終了する", async (t) => {
  for (const mode of [
    "normal",
    "known_id",
    "not_requested",
    "missing_notice",
    "throw",
    "promise",
    "late_reject",
    "pending",
    "cancelled",
    "unknown",
    "close_failed",
    "checkpoint_failed",
  ] as const) {
    await t.test(mode, async () => {
      const events: string[] = [];
      const controller = new AbortController();
      let saved = false,
        closes = 0,
        removals = 0;
      let rejectLate: ((error: Error) => void) | undefined;
      const api = createAttemptRecoveryTestApi((input) => ({
        status: "ready",
        reason: "ready",
        cleanupConfirmed: true,
        executor: {
          discoverSubmitted: () => {
            assert.equal(input.signal?.aborted, false);
            events.push("discover");
            return mode === "unknown" ? null : ID;
          },
          cleanupObserved: async (
            value: { dockerId: string },
            signal?: AbortSignal,
          ) => {
            assert.equal(input.signal?.aborted, false);
            if (mode === "cancelled") controller.abort();
            signal?.throwIfAborted();
            assert.equal(value.dockerId, ID);
            assert.equal(mode === "known_id" || saved, true);
            events.push("remove");
            removals++;
            return true;
          },
          observeAbsent: () => true,
          close: () => {
            events.push("close");
            closes++;
            return mode !== "close_failed";
          },
        },
      }));
      const none = Object.freeze({ submitted: false, dockerId: null });
      const target: ResourceTarget<"attempt"> = {
        kind: "resource_set",
        operationId: "operation-a",
        recoveryId: "exact-recovery",
        projection: PROJECTION,
        managementDirectory: path.resolve("borrowed"),
        signal: controller.signal,
        receipts: {
          create_provider:
            mode === "not_requested"
              ? none
              : { submitted: true, dockerId: mode === "known_id" ? ID : null },
          create_subscription_auth_probe: none,
          create_proxy: none,
          create_internal_network: none,
          create_egress_network: none,
        },
      };
      const callbacks: ResourceCleanupCallbacks<
        ResourceCleanupResult<"attempt">["resources"]
      > = {
        onResourceInspecting: () => {
          events.push("inspecting");
        },
        ...(mode === "missing_notice"
          ? {}
          : {
              onResourceIdentified: (_purpose: string, id: string) => {
                assert.equal(id, ID);
                events.push("identified");
                if (mode === "throw") throw Error("synthetic_save_failure");
                if (mode === "promise") return Promise.resolve();
                if (mode === "late_reject")
                  return new Promise<void>((_resolve, reject) => {
                    rejectLate = reject;
                  });
                if (mode === "pending") return new Promise<void>(() => {});
                saved = true;
              },
            }),
        onResourcesClosed: (observations) => {
          events.push("resources");
          assert.equal(observations.length, 5);
          if (mode === "unknown")
            assert.equal(
              observations.find((item) => item.purpose === "create_provider")
                ?.observation,
              "unknown",
            );
          if (mode === "checkpoint_failed")
            throw Error("synthetic_checkpoint_failure");
        },
        onCleanupCompleted: () => {
          assert.equal(mode === "not_requested" || closes === 1, true);
          events.push("completed");
        },
      };
      const result = await api.cleanupResources(target, callbacks);
      assert.equal(result.recoveryId, "exact-recovery");
      assert.equal(result.operationId, "operation-a");
      assert.equal(closes, mode === "not_requested" ? 0 : 1);
      const success = ["normal", "known_id", "not_requested"].includes(mode);
      assert.equal(
        result.status,
        success ? "completed" : "blocked",
        JSON.stringify(result),
      );
      if (
        [
          "missing_notice",
          "throw",
          "promise",
          "late_reject",
          "pending",
          "cancelled",
          "unknown",
        ].includes(mode)
      )
        assert.equal(removals, 0);
      if (mode === "checkpoint_failed")
        assert.equal(result.dockerCleanupConfirmed, true);
      if (mode === "unknown") {
        assert.ok(events.includes("resources"));
        assert.equal(result.dockerCleanupConfirmed, false);
        assert.equal(result.status, "blocked");
      }
      if (mode === "close_failed") {
        assert.equal(result.configCleanupConfirmed, false);
        assert.equal(result.dockerCleanupConfirmed, true);
      }
      const before = [...events];
      rejectLate?.(Error("synthetic_late_save_failure"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(events, before);
    });
  }
});

/**
 * 診断だけのAPIが削除せず二読取りを別々に保持することを確認する。
 * @responsibility 片方不明・明示取消・config不明を不存在成功にしない。
 * @trace ERB-IT-014
 * @precondition 実診断本文と有限の読取り代役。
 * @stimulus 二回不存在、一方不明、明示取消、close失敗。
 * @observation 読取り数、削除0、二値の順序と元参照。
 * @oracle 真に二回不存在を確認した場合だけ二つのabsentが成立する。
 * @cleanup 全条件で自作config代役をcloseする。
 */
test("Attempt診断は削除せず二回の不存在と不明を保持する", () => {
  for (const mode of [
    "absent",
    "second_unknown",
    "cancelled",
    "close_failed",
  ] as const) {
    const controller = new AbortController();
    let reads = 0,
      closes = 0;
    const api = createAttemptRecoveryTestApi(() => ({
      status: "ready",
      executor: {
        observeAbsent: () => {
          reads++;
          if (mode === "cancelled") controller.abort();
          return mode !== "second_unknown" || reads !== 2;
        },
        discoverSubmitted: () => null,
        cleanupObserved: async () => {
          throw Error("diagnostic_must_not_remove");
        },
        close: () => {
          closes++;
          return mode !== "close_failed";
        },
      },
    }));
    const none = { submitted: false, dockerId: null };
    const result = api.inspectResources(
      {
        kind: "resource_set",
        operationId: "operation-a",
        recoveryId: "exact-recovery",
        projection: PROJECTION,
        managementDirectory: path.resolve("borrowed"),
        signal: controller.signal,
        receipts: {
          create_provider: none,
          create_subscription_auth_probe: { submitted: true, dockerId: null },
          create_proxy: none,
          create_internal_network: none,
          create_egress_network: none,
        },
      },
      "create_subscription_auth_probe",
    );
    assert.equal(closes, 1);
    assert.equal(result.status, mode === "absent" ? "completed" : "blocked");
    assert.equal(result.recoveryId, "exact-recovery");
    if (mode === "absent")
      assert.deepEqual(
        Array.from(result.resources[0]?.absenceObservations ?? []),
        ["absent", "absent"],
      );
    if (mode === "second_unknown")
      assert.deepEqual(
        Array.from(result.resources[0]?.absenceObservations ?? []),
        ["absent", "unknown"],
      );
  }
});

/**
 * 既知IDの存在を名前の不存在で上書きせず、照合後のOwnerも確認する。
 * @responsibility 削除なしの実ID照合と不明保持を反証する。
 * @trace ERB-IT-014
 * @precondition 実診断本文と固定した有限の技術代役。
 * @stimulus 改名相当、真の不存在、照合不明、明示取消、正規存在。
 * @observation exact ID、allowAlreadyAbsent、削除禁止、closeと元参照。
 * @oracle 名前不存在だけでは既知IDの不存在や成功を確定しない。
 * @cleanup 各条件のconfig代役を一回closeする。
 */
test("既知IDの診断はexact照合と照合後取消を要求する", () => {
  for (const mode of [
    "renamed",
    "absent",
    "unknown",
    "cancelled",
    "present",
  ] as const) {
    const controller = new AbortController();
    let closes = 0;
    const checks: boolean[] = [];
    const api = createAttemptRecoveryTestApi(() => ({
      status: "ready",
      executor: {
        observeAbsent: () => mode !== "present",
        discoverSubmitted: () => {
          throw Error("known_id_must_not_discover");
        },
        cleanupObserved: async () => {
          throw Error("diagnostic_must_not_remove");
        },
        inspectIdentity: (
          expectation: { dockerId: string },
          _key: string,
          options: {
            allowAlreadyAbsent: boolean;
          },
        ) => {
          assert.equal(expectation.dockerId, ID);
          checks.push(options.allowAlreadyAbsent);
          if (mode === "cancelled") {
            controller.abort();
            return true;
          }
          if (mode === "present") return !options.allowAlreadyAbsent;
          return mode === "absent" && options.allowAlreadyAbsent;
        },
        close: () => {
          closes++;
          return true;
        },
      },
    }));
    const none = { submitted: false, dockerId: null };
    const result = api.inspectResources(
      {
        kind: "resource_set",
        operationId: "operation-a",
        recoveryId: "exact-recovery",
        projection: PROJECTION,
        managementDirectory: path.resolve("borrowed"),
        signal: controller.signal,
        receipts: {
          create_provider: { submitted: true, dockerId: ID },
          create_subscription_auth_probe: none,
          create_proxy: none,
          create_internal_network: none,
          create_egress_network: none,
        },
      },
      "create_provider",
    );
    assert.equal(closes, 1);
    assert.equal(result.recoveryId, "exact-recovery");
    assert.equal(
      result.status,
      ["absent", "present"].includes(mode) ? "completed" : "blocked",
      mode,
    );
    assert.equal(
      result.resources[0]?.observation ?? "unknown",
      mode === "present" ? "present" : mode === "absent" ? "absent" : "unknown",
      mode,
    );
    assert.equal(checks[0], false);
    if (mode === "absent") assert.deepEqual(checks, [false, true]);
    if (mode === "cancelled") assert.equal(checks.length, 1);
  }
});
