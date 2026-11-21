/**
 * 回復開始の段階診断を外部Effectなしで検証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 本番開始本文と閉じた診断変換。
 * @boundary メモリ代役のみ。Docker・認証・実Writerは使用しない。
 * @packageDocumentation
 * @responsibility 回復開始の段階診断を外部Effectなしで検証する。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  inspectRecoveryStartFailureDiagnostic,
  snapshotBlockedRecoveryWithExactId,
  snapshotReadyRecovery,
} from "../../../src/lifecycle/validation.ts";

/**
 * 任意診断の失敗・遅延が回復開始を待たせず、元の返却と保存・要求を変えないことを確認する。
 * @responsibility 本番の開始・Identity組立て本文の各停止点とreadyを同じ代役条件で比較する。
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
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function beginRuntimeOwnedDockerRecovery(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  const identityStart = source.indexOf(
    "export function prepareRuntimeOwnedRepositoryDockerOperationIdentity(",
  );
  const identityEnd = source.indexOf("\n/**", identityStart);
  assert.ok(identityStart > 0 && identityEnd > identityStart);
  const identityBody = stripTypeScriptTypes(
    source
      .slice(identityStart, identityEnd)
      .replace("export function", "function"),
  );
  for (const stage of [
    "plan_validation",
    "identity_unavailable",
    "identity_purpose",
    "identity_phase",
    "provider_home",
    "operation_binding",
    "state_conflict",
    "operation_start_save",
    "settlement_binding",
    "host_read",
    "host_throw",
    "host_operation",
    "host_phase",
    "ready",
  ]) {
    const run = async (
      sink: "none" | "normal" | "throw" | "reject" | "late_reject" | "pending",
    ) => {
      const observed: unknown[] = [];
      let rejectLate: ((error: Error) => void) | undefined;
      let writes = 0,
        homeObservations = 0;
      const plan = {
        provider: "codex",
        operationId: "op",
        consumer: "workbench",
        providerHomeIdentityHash: "home",
        stableLogicalHomeBindingHash: "a".repeat(64),
      };
      const home = { ...plan };
      let expectedRecoveryId: string | null = null;
      let hostReads = 0;
      const invoke = runInNewContext(
        `${identityBody}\n${body}; beginRuntimeOwnedDockerRecovery`,
        {
          Object,
          Error,
          Buffer,
          JSON,
          createHash,
          validProductionPlan: () => stage !== "plan_validation",
          inspectRuntimeOwnedWindowsProviderHomeCandidate: () => {
            homeObservations++;
            return {
              status: stage === "provider_home" ? "blocked" : "candidate",
              providerHome: home,
            };
          },
          acquireProviderHomeLock: () => {
            throw Error("upper_must_not_acquire_executor_home");
          },
          verifyOwnedOperationManagementCapability: () => ({
            operationId: stage === "operation_binding" ? "other" : "op",
          }),
          operationStateInput: (identity: unknown) => ({ identity }),
          readState: (_input: unknown, request: { scope: string }) => {
            assert.equal(request.scope, "operation");
            return {
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
            };
          },
          randomBytes: () => Buffer.alloc(32, 1),
          HEX64: /^[a-f0-9]{64}$/,
          readOwnedHostOperation: () => {
            hostReads++;
            if (
              stage === "identity_unavailable" ||
              (hostReads > 1 && stage === "host_throw")
            )
              throw Error("fixture_host_unavailable");
            if (hostReads > 1 && stage === "host_read") return null;
            return {
              record: {
                operationId:
                  hostReads > 1 && stage === "host_operation" ? "other" : "op",
                purpose:
                  stage === "identity_purpose" ? "isolation_probe" : "task",
                phase:
                  stage === "identity_phase" ||
                  (hostReads > 1 && stage === "host_phase")
                    ? "terminal"
                    : "active",
              },
            };
          },
          borrowRuntimeOwnedCoordinatorStateRepository: () => ({
            repositoryBinding: "binding",
            operationId: "op",
            revalidate: () => true,
          }),
          durableRecords: new WeakMap(),
          releasedLogicalHomeLeases: new WeakSet(),
          operationStartInput: (
            identity: unknown,
            observeTerminal: unknown,
          ) => ({
            identity,
            observeTerminal,
          }),
          saveOperationStart: (
            input: { identity: unknown; observeTerminal: unknown },
            identityJson: string,
          ) => {
            assert.ok(input.identity);
            assert.equal(typeof input.observeTerminal, "function");
            writes++;
            expectedRecoveryId = `docker-task.${plan.stableLogicalHomeBindingHash}.${"01".repeat(32)}.${createHash("sha256").update(identityJson).digest("hex")}`;
            return {
              status:
                stage === "operation_start_save" ? "blocked" : "completed",
              snapshotConfirmed: true,
              lockReleased: true,
              startSaved: stage !== "operation_start_save",
              completionContext: stage === "settlement_binding" ? null : {},
              recoveryId: expectedRecoveryId,
              reason: "coordinator_state_storage_unconfirmed",
            };
          },
          safeRecoveryReason: () =>
            "docker_recovery_initialization_failed_closed",
        },
      );
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
      if (stage.startsWith("identity_")) {
        assert.equal(homeObservations, 0);
        assert.equal(writes, 0);
      }
      const beforeLate = JSON.stringify({
        result,
        writes,
        observed,
        expectedRecoveryId,
      });
      rejectLate?.(new Error("synthetic_late_diagnostic_rejection"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(
        JSON.stringify({
          result,
          writes,
          observed,
          expectedRecoveryId,
        }),
        beforeLate,
        "後着診断から保存・要求・結果を変更しない",
      );
      return {
        result: JSON.stringify(result),
        writes,
        observed,
        expectedRecoveryId,
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
      assert.equal(result.writes, baseline.writes, stage);
      assert.equal(result.observed.length, stage === "ready" ? 0 : 1, stage);
      if (stage !== "ready")
        assert.deepEqual(result.observed[0], {
          stage: stage.startsWith("identity_")
            ? "plan_validation"
            : stage.startsWith("host_")
              ? "settlement_binding"
              : stage,
          recoveryId: [
            "operation_start_save",
            "settlement_binding",
            "host_read",
            "host_throw",
            "host_operation",
            "host_phase",
          ].includes(stage)
            ? result.expectedRecoveryId
            : null,
        });
    }
  }
});

/**
 * 固定段階・元参照だけを受理し、未知内容を保存候補へ通さない。
 * @responsibility 回復開始診断codecは未知段階・余分field・偽参照を拒否する
 * @trace PRL-UT-006
 * @precondition 本番開始本文と閉じた診断変換。
 * @stimulus 回復開始診断codecは未知段階・余分field・偽参照を拒否するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 回復開始診断codecは未知段階・余分field・偽参照を拒否するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary メモリ代役のみ。Docker・認証・実Writerは使用しない。
 */
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
 * @trace PRL-UT-006
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
