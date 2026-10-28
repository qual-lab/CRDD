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
import { inspectRecoveryStartFailureDiagnostic } from "../../../../executor/src/index.ts";

const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;

/** 各失敗点を注入し、診断の有無・例外が元結果と解放を変えないことを確認する。 */
test("回復開始診断は全段階を一回通知し元結果とEffectを変えない", () => {
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
    "home_lock",
    "operation_binding",
    "state_conflict",
    "operation_start_save",
    "settlement_binding",
    "host_submission",
    "home_lock_release",
    "ready",
  ]) {
    const run = (sink: "none" | "normal" | "throw") => {
      const observed: unknown[] = [];
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
        acquireRuntimeOwnedLogicalProviderHomeKernelLock: () =>
          stage === "home_lock"
            ? null
            : {
                release: () => {
                  releases++;
                  return stage !== "home_lock_release";
                },
              },
        verifyOwnedOperationManagementCapability: () => ({
          operationId: ["operation_binding", "home_lock_release"].includes(
            stage,
          )
            ? "other"
            : "op",
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
                observed.push(JSON.parse(JSON.stringify(value)));
                if (sink === "throw") throw new Error("arbitrary private text");
              },
        );
      } catch (error) {
        result = { thrown: error instanceof Error ? error.message : "unknown" };
      }
      return {
        result: JSON.stringify(result),
        releases,
        writes,
        submissions,
        observed,
      };
    };
    const baseline = run("none");
    for (const sink of ["normal", "throw"] as const) {
      const result = run(sink);
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
