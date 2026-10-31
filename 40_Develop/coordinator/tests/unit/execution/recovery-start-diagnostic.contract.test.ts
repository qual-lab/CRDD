/**
 * 回復開始の段階診断を外部Effectなしで検証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 本番開始本文と閉じた診断変換。
 * @boundary メモリ代役のみ。Docker・認証・実Writerは使用しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { inspectRecoveryStartFailureDiagnostic } from "../../../src/execution/validation.ts";
import {
  snapshotReadyRecovery,
  snapshotBlockedRecoveryWithExactId,
} from "../../../src/execution/validation.ts";

const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;

/**
 * 任意診断の失敗・遅延が回復開始を待たせず、元の返却と保存・要求を変えないことを確認する。
 * @responsibility 本番関数本文の8停止点とreadyを同じ代役条件で比較する。
 * @trace PRL-UT-006
 * @precondition 本番本文をメモリ内で実行し、Host・保存は同期代役に限定する。
 * @stimulus 未登録、正常、同期例外、即時拒否、後着拒否、未完了の診断先を渡す。
 * @observation 同期返却値、exact回復参照、通知回数、保存回数とHost要求回数。
 * @oracle readyは通知0、停止点は一回だけ。通知完了を待たず元結果・回数を維持する。
 * @cleanup N/A: 外部資源を取得せず、未完了PromiseもI/Oや監視を持たない。
 * @boundary 本番関数本文とメモリ代役。実資源の解放成立は本試験の対象外。
 */
test("回復開始診断は全段階を一回通知し元結果とEffectを変えない", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function beginProductionRecovery(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  for (const stage of [
    "plan_validation",
    "operation_context",
    "provider_home",
    "operation_binding",
    "state_conflict",
    "operation_start_save",
    "settlement_binding",
    "host_submission",
    "ready",
  ]) {
    const run = async (
      sink: "none" | "normal" | "throw" | "reject" | "late_reject" | "pending",
    ) => {
      const observed: unknown[] = [];
      let rejectLate: ((error: Error) => void) | undefined;
      let releases = 0,
        writes = 0,
        submissions = 0;
      const plan = {
        provider: "codex",
        operationId: "op",
        consumer: "workbench",
        providerHomeIdentityHash: "home",
        providerHomeProtectionHash: "protection",
        localUserBindingHash: "user",
        stableLogicalHomeBindingHash: "a".repeat(64),
      };
      const home = { ...plan };
      const invoke = runInNewContext(`${body}; beginProductionRecovery`, {
        Object,
        Error,
        Buffer,
        JSON,
        validProductionPlan: () => stage !== "plan_validation",
        inspectRuntimeOwnedDevelopmentOperationContext: () => ({
          checkNewWork: () => stage !== "operation_context",
        }),
        inspectRuntimeOwnedWindowsProviderHomeCandidate: () => ({
          status: stage === "provider_home" ? "blocked" : "candidate",
          observationCapability: {},
        }),
        consumeRuntimeOwnedProviderHomeObservationCapability: () => home,
        acquireRuntimeOwnedLogicalProviderHomeKernelLock: () => {
          throw Error("upper_must_not_acquire_executor_home");
        },
        verifyOwnedOperationManagementCapability: () => ({
          operationId: stage === "operation_binding" ? "other" : "op",
        }),
        readRuntimeOwnedCoordinatorStateSnapshot: () => ({
          value: {
            snapshot: {
              operations:
                stage === "state_conflict"
                  ? [
                      {
                        kind: "docker_task",
                        identityJson: JSON.stringify(plan),
                        lease: "held",
                      },
                    ]
                  : [],
            },
          },
        }),
        randomBytes: () => Buffer.alloc(32, 1),
        prepareRuntimeOwnedRepositoryDockerOperationIdentity: () => "identity",
        borrowRuntimeOwnedCoordinatorStateRepository: () => ({
          repositoryBinding: "binding",
        }),
        prepareCoordinatorStateOperationSnapshot: () => Buffer.from("state"),
        decodeCoordinatorStateSnapshot: () => ({
          snapshot: { operations: [{ recoveryId: id }] },
        }),
        durableRecords: new WeakMap(),
        releasedLogicalHomeLeases: new WeakSet(),
        saveRuntimeOwnedCoordinatorOperationStart: () => {
          writes++;
          return {
            status: stage === "operation_start_save" ? "blocked" : "completed",
            snapshotConfirmed: true,
            lockReleased: true,
            recoveryId: id,
            reason: "coordinator_state_storage_unconfirmed",
          };
        },
        prepareRuntimeOwnedCoordinatorSettlement: () =>
          stage === "settlement_binding" ? null : {},
        beginRuntimeOwnedCoordinatorHostSubmission: () => {
          submissions++;
          return {
            status: stage === "host_submission" ? "blocked" : "completed",
            hostTransitionConfirmed: stage !== "host_submission",
            reason: "host_recovery_submission_unconfirmed",
          };
        },
        safeRecoveryReason: () =>
          "docker_recovery_initialization_failed_closed",
      });
      let result: unknown;
      try {
        result = invoke(
          plan,
          {},
          sink === "none"
            ? undefined
            : (value: unknown) => {
                assert.equal(Object.isFrozen(value), true);
                observed.push(JSON.parse(JSON.stringify(value)));
                if (sink === "throw") throw new Error("arbitrary private text");
                if (sink === "reject")
                  return Promise.reject(
                    new Error("synthetic_diagnostic_rejection"),
                  );
                if (sink === "late_reject")
                  return new Promise<void>((_resolve, reject) => {
                    rejectLate = reject;
                  });
                if (sink === "pending") return new Promise<void>(() => {});
              },
        );
      } catch (error) {
        result = { thrown: error instanceof Error ? error.message : "unknown" };
      }
      assert.notEqual(
        Object.prototype.toString.call(result),
        "[object Promise]",
        "開始結果は同期返却のまま",
      );
      const beforeLate = JSON.stringify({
        result,
        releases,
        writes,
        submissions,
        observed,
      });
      rejectLate?.(new Error("synthetic_late_diagnostic_rejection"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(
        JSON.stringify({ result, releases, writes, submissions, observed }),
        beforeLate,
        "後着診断から保存・要求・結果を変更しない",
      );
      return {
        result: JSON.stringify(result),
        releases,
        writes,
        submissions,
        observed,
      };
    };
    const baseline = await run("none");
    for (const sink of [
      "normal",
      "throw",
      "reject",
      "late_reject",
      "pending",
    ] as const) {
      const result = await run(sink);
      assert.equal(result.result, baseline.result, stage);
      assert.equal(result.releases, baseline.releases, stage);
      assert.equal(result.writes, baseline.writes, stage);
      assert.equal(result.submissions, baseline.submissions, stage);
      assert.equal(result.observed.length, stage === "ready" ? 0 : 1, stage);
      if (stage !== "ready")
        assert.deepEqual(result.observed[0], {
          stage,
          recoveryId: [
            "operation_start_save",
            "settlement_binding",
            "host_submission",
          ].includes(stage)
            ? id
            : null,
        });
    }
  }
});

/** 固定段階・元参照だけを受理し、未知内容を保存候補へ通さない。 */
test("回復開始診断codecは未知段階・余分field・偽参照を拒否する", () => {
  assert.deepEqual(
    inspectRecoveryStartFailureDiagnostic({
      stage: "home_lock",
      recoveryId: null,
    }),
    { stage: "home_lock", recoveryId: null },
  );
  assert.equal(
    inspectRecoveryStartFailureDiagnostic({
      stage: "home_lock",
      recoveryId: "secret",
    }),
    null,
  );
  assert.equal(
    inspectRecoveryStartFailureDiagnostic({
      stage: "unknown-private-text",
      recoveryId: null,
    }),
    null,
  );
  assert.equal(
    inspectRecoveryStartFailureDiagnostic({
      stage: "home_lock",
      recoveryId: null,
      path: "secret",
    }),
    null,
  );
  assert.equal(
    inspectRecoveryStartFailureDiagnostic({ stage: "home_lock" }),
    null,
  );
});

/**
 * 正常応答と不正な回復値を照合する。
 * @responsibility 原Capabilityとexact参照の結合を維持する。
 * @trace ERB-IT-004
 * @precondition 合成のHome hash・回復参照・不透明Capability。
 * @stimulus Owner有無、別Home、Proxy、accessor、余分・欠測を渡す。
 * @observation 所有Snapshot又はnull、getter未実行。
 * @oracle 同じ条件だけを受理し、観測不能を正常にしない。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-IT-004=Direct Boundary: 回復応答検査。
 */
test("回復Snapshotは閉形式と元Homeを維持し不正な値を受理しない", () => {
  const home = "d".repeat(64);
  const id = `docker-task.${home}.${"e".repeat(64)}.${"f".repeat(64)}`;
  const capability = {};
  const ready = {
    status: "ready",
    recoveryId: id,
    recoveryCapability: capability,
  };
  assert.equal(snapshotReadyRecovery(ready)?.recoveryCapability, capability);
  let getterCalls = 0;
  const accessor = {
    ...ready,
    get recoveryId() {
      getterCalls++;
      return id;
    },
  };
  for (const value of [
    null,
    [],
    { ...ready, extra: true },
    { ...ready, recoveryCapability: null },
    accessor,
  ])
    assert.equal(snapshotReadyRecovery(value), null);
  assert.equal(getterCalls, 0);
  const blocked = { status: "blocked", reason: "synthetic", recoveryId: id };
  assert.equal(
    snapshotBlockedRecoveryWithExactId(blocked, home)?.recoveryCapability,
    null,
  );
  const owned = {
    ...blocked,
    recoveryCapability: capability,
    manualRecoveryRequired: true,
  };
  assert.equal(
    snapshotBlockedRecoveryWithExactId(owned, home)?.recoveryCapability,
    capability,
  );
  assert.equal(snapshotBlockedRecoveryWithExactId(owned, "a".repeat(64)), null);
  for (const value of [
    new Proxy(blocked, {}),
    { ...blocked, extra: true },
    { ...blocked, recoveryId: "bad" },
    { ...owned, manualRecoveryRequired: false },
    { ...owned, recoveryCapability: new Proxy({}, {}) },
    { status: "blocked", recoveryId: id },
    {
      ...blocked,
      get reason() {
        getterCalls++;
        return "synthetic";
      },
    },
  ])
    assert.equal(snapshotBlockedRecoveryWithExactId(value, home), null);
  assert.equal(getterCalls, 0);
});
