/**
 * coordinator:integration:task-executionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-executionが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @level IT
 * @scope project、runtime、execution
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Coordinator Application Port→Core
 */

import { runTestCoordinatorOperation } from "../fixtures/task-persistence-fixture.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import * as executionModel from "@qual-lab/crdd-execution-model";
import {
  leaseAcquisitionRecoveryId,
  readProjectExecutionState,
} from "@qual-lab/crdd-execution-model";
import type { ProjectTaskDefinition } from "@qual-lab/crdd-execution-model";
import { initializeExecutionStore } from "@qual-lab/crdd-execution-model";
import { acquireLock } from "@qual-lab/crdd-lock";
import {
  projectExecutionFixture,
  initialExecutionInput,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import { parseStoredExecutionFixture } from "../../../execution-model/tests/fixtures/stored-execution.ts";
import { runTestSingleTaskAttempt } from "../support/task-requests.ts";
import * as host from "../../src/lifecycle/host.ts";
import { resolveExecutionStorageDirectory } from "../../src/lifecycle/host.ts";
import { createTestPersistence } from "../fixtures/task-persistence-fixture.ts";
import type { CoordinatorSingleTaskResult } from "../../src/lifecycle/types.ts";
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import {
  enqueueProjectOperation,
  readCoordinatorState,
  readProjectOperationQueueState,
} from "../fixtures/task-persistence-fixture.ts";
import { settleSyntheticOperations } from "../fixtures/task-result-fixture.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

const revision = "a".repeat(40);

/** @trace PRL-IT-012 実EMの競合をTask保存の各段階に入れ、代役Executorの呼出しを証明する。 */
test("Taskの予約・通知・終端は競合した保存だけを待ちExecutorを呼び直さない", async (t) => {
  for (const mode of [
    "all_stages",
    "handoff_revoked",
    "target_revoked",
    "target_unknown",
    "target_transient_unknown",
    "reservation_cancelled",
    "settlement_cancelled",
    "settlement_timeout",
    "next_task_revoked",
    "next_task_cancelled",
  ] as const) {
    const { root, input } = fixture(
      t,
      mode === "next_task_revoked" || mode === "next_task_cancelled"
        ? [task("task-a"), task("task-b", ["task-a"])]
        : [task("task-a")],
      1,
    );
    const controller = new AbortController();
    const stages =
      mode === "all_stages"
        ? new Set(["task_start", "task_handoff", "task_started", "task_settle"])
        : new Set([
            {
              handoff_revoked: "task_handoff",
              target_revoked: "target",
              target_unknown: "target",
              target_transient_unknown: "target",
              reservation_cancelled: "task_start",
              settlement_cancelled: "task_settle",
              settlement_timeout: "task_settle",
              next_task_revoked: "task_settle",
              next_task_cancelled: "task_settle",
            }[mode],
          ]);
    const held = new Map<string, Promise<void>>();
    const applied = new Map<string, number>();
    const revalidated = new Set<string>();
    let blockedStage = "";
    let starts = 0;
    let notices = 0;
    const pending = path.join(
      root,
      ".crdd",
      "execution-model",
      "state.pending.json",
    );
    let fixturePending = false;
    let transientFailures = 0;
    const open = fs.openSync;
    let transientFault: ReturnType<typeof t.mock.method> | undefined;
    let releaseTarget: (() => void) | undefined;
    try {
      const outcome = await withExecutionStateSave(
        (...args) => {
          const stage = args[2].kind;
          if (stages.has(stage) && !held.has(stage)) {
            const acquired = acquireLock({
              directory: path.join(root, ".crdd", "lock"),
              name: "execution-model.state.lock",
              identity: "temporary-task-fixture",
            });
            if (acquired.status !== "acquired") throw Error(acquired.reason);
            held.set(
              stage,
              delay(mode === "settlement_timeout" ? 900 : 40).then(() =>
                assert.equal(acquired.lock.release(), true),
              ),
            );
            if (
              mode === "reservation_cancelled" ||
              mode === "settlement_cancelled" ||
              mode === "next_task_cancelled"
            )
              controller.abort();
          }
          const value = executionModel.saveProjectExecutionState(...args);
          if (stage === "task_handoff" && value.status === "completed") {
            if (mode === "target_revoked") {
              const owner = acquireLock({
                directory: path.join(root, ".crdd", "lock"),
                name: "execution-model.state.lock",
                identity: "temporary-target-fixture",
              });
              if (owner.status !== "acquired") throw Error(owner.reason);
              blockedStage = "target";
              releaseTarget = () => {
                assert.equal(owner.lock.release(), true);
                releaseTarget = undefined;
              };
              held.set("target", Promise.resolve());
            } else if (mode === "target_unknown") {
              fs.writeFileSync(pending, "fixture-unknown-pending", {
                flag: "wx",
              });
              fixturePending = true;
              held.set("target", Promise.resolve());
            } else if (mode === "target_transient_unknown") {
              transientFault = t.mock.method(fs, "openSync", ((
                target,
                flags,
                permissions,
              ) => {
                if (
                  String(target) ===
                    path.join(path.dirname(pending), "state.json") &&
                  transientFailures === 0
                ) {
                  transientFailures++;
                  throw Object.assign(
                    Error("fixture_snapshot_observation_unavailable"),
                    { code: "EACCES" },
                  );
                }
                return Reflect.apply(open, fs, [target, flags, permissions]);
              }) as typeof open);
              held.set("target", Promise.resolve());
            }
          }
          if (value.status === "completed")
            applied.set(stage, 1 + (applied.get(stage) ?? 0));
          else if (value.reason === "coordinator_snapshot_lock_contended")
            blockedStage = stage;
          return value;
        },
        (dispatch) =>
          runCoordinatorOperation(
            {
              leaseWait: {
                revalidate: async () => {
                  revalidated.add(blockedStage);
                  releaseTarget?.();
                  return (
                    mode !== "handoff_revoked" &&
                    mode !== "next_task_revoked" &&
                    mode !== "target_revoked"
                  );
                },
              },
              runSingleTaskAttempt: async (attempt) => {
                starts++;
                notices++;
                await attempt.observeStarted?.();
                const result = completedAfterStart(attempt);
                return mode === "settlement_cancelled"
                  ? {
                      ...result,
                      status: "cancelled",
                      reason: "coordinator_cancelled",
                    }
                  : result;
              },
            },
            { ...input, cancellationSignal: controller.signal },
            dispatch,
          ),
      );
      assert.equal(held.size, stages.size);
      if (mode === "target_unknown" || mode === "target_transient_unknown") {
        assert.equal(outcome.status, "blocked");
        assert.equal(outcome.effectState, "unknown");
        assert.equal(outcome.cleanupConfirmed, false);
        assert.equal(outcome.manualRecoveryRequired, true);
        assert.equal(starts, 0, mode);
        assert.equal(notices, 0);
        assert.deepEqual([...applied.keys()], ["task_start", "task_handoff"]);
        assert.deepEqual([...revalidated], []);
        if (mode === "target_unknown") {
          assert.equal(
            fs.readFileSync(pending, "utf8"),
            "fixture-unknown-pending",
          );
        } else {
          assert.equal(transientFailures, 1);
          const final = parseStoredExecutionFixture(
            fs.readFileSync(
              path.join(path.dirname(pending), "state.json"),
              "utf8",
            ),
          );
          assert.equal(final.queueEntries[0]?.state, "running");
          assert.ok(final.queueEntries[0]?.ownerGeneration);
          assert.equal(final.leaseIntents.length, 0);
          const reconciled = host.reconcileCoordinatorSnapshotLeaseOwnerLoss(
            root,
            "binding-a",
            "project-a",
            input.queueId,
            "project-operation",
            () =>
              assert.fail("解放証拠があるため元Processの不存在を要求しない"),
          );
          assert.equal(reconciled.status, "completed", reconciled.reason);
          assert.equal(reconciled.value?.queue?.resumeCondition, "owner_loss");
        }
        continue;
      }
      const persisted = readCoordinatorState(root, "binding-a", "project-a");
      assert.equal(persisted.status, "completed", persisted.reason);
      const task = persisted.value?.tasks[0];
      if (mode === "target_revoked") {
        assert.equal(outcome.status, "cancelled", outcome.reason);
        assert.equal(
          outcome.reason,
          "coordinator_authenticated_principal_not_verified",
        );
        assert.equal(outcome.effectState, "no_effect");
        assert.equal(outcome.cleanupConfirmed, true);
        assert.equal(outcome.manualRecoveryRequired, false);
        assert.equal(starts, 0);
        assert.equal(notices, 0);
        assert.deepEqual([...revalidated], ["target"]);
        assert.deepEqual(
          [...applied.keys()],
          ["task_start", "task_handoff", "task_settle_before_effect"],
        );
        assert.equal(task?.state, "cancelled");
      } else if (mode === "settlement_timeout") {
        assert.equal(starts, 1);
        assert.equal(notices, 1);
        assert.equal(applied.has("task_settle"), false);
        assert.equal(task?.startPhase, "running");
        assert.equal(outcome.status, "blocked");
        assert.equal(outcome.effectState, "unknown");
        assert.equal(outcome.cleanupConfirmed, false);
        assert.deepEqual([...revalidated], []);
      } else if (
        mode === "next_task_revoked" ||
        mode === "next_task_cancelled"
      ) {
        assert.equal(starts, 1);
        assert.equal(notices, 1);
        assert.deepEqual(
          [...revalidated],
          mode === "next_task_revoked" ? ["task_settle"] : [],
        );
        assert.deepEqual(outcome.completedTaskIds, ["task-a"]);
        assert.equal(
          outcome.reason,
          mode === "next_task_revoked"
            ? "coordinator_authenticated_principal_not_verified"
            : "coordinator_cancelled_before_task_effect",
        );
        assert.equal(outcome.status, "cancelled");
        assert.equal(outcome.effectState, "settled");
        assert.equal(outcome.cleanupConfirmed, true);
        assert.equal(outcome.manualRecoveryRequired, false);
        assert.deepEqual(outcome.recoveryIds, []);
        assert.equal(task?.state, "completed");
        assert.equal(persisted.value?.tasks[1]?.state, "ready");
      } else if (mode === "all_stages" || mode === "settlement_cancelled") {
        assert.equal(starts, 1);
        assert.equal(notices, 1);
        assert.deepEqual(
          [...applied.keys()],
          ["task_start", "task_handoff", "task_started", "task_settle"],
        );
        assert.ok([...applied.values()].every((count) => count === 1));
        assert.equal(
          outcome.status,
          mode === "all_stages" ? "completed" : "cancelled",
          outcome.reason,
        );
        assert.equal(task?.state, outcome.status);
        assert.deepEqual(
          [...revalidated],
          mode === "all_stages" ? ["task_start", "task_handoff"] : [],
        );
      } else {
        assert.equal(starts, 0);
        assert.equal(notices, 0);
        assert.deepEqual(
          [...applied.keys()],
          mode === "handoff_revoked" ? ["task_start"] : [],
        );
        assert.deepEqual(
          [...revalidated],
          mode === "handoff_revoked" ? ["task_handoff"] : [],
        );
        assert.equal(
          outcome.reason,
          mode === "handoff_revoked"
            ? "coordinator_authenticated_principal_not_verified"
            : "coordinator_cancelled_before_task_effect",
        );
        assert.equal(
          task?.startPhase,
          mode === "handoff_revoked" ? "reserved" : "none",
        );
      }
    } finally {
      releaseTarget?.();
      transientFault?.mock.restore();
      await Promise.all(held.values());
      if (fixturePending) fs.unlinkSync(pending);
    }
  }
});

/** @trace PRL-IT-012 Queue選択と開始の短期競合を、実Leaseと新規Effectの間で反証する。 */
test("Queue開始の競合は元Scopeの再認可が通った場合だけTaskへ進む", async (t) => {
  for (const mode of ["select", "running_revoked"] as const) {
    const { root, input } = fixture(t, [task("task-a")], 1);
    const file = path.join(root, ".crdd", "execution-model", "state.json");
    let held: Promise<void> | undefined;
    let checks = 0;
    let delegated = 0;
    const rm = fs.rmSync;
    const hook = t.mock.method(
      fs,
      "rmSync",
      (...args: Parameters<typeof rm>) => {
        rm(...args);
        if (
          held ||
          path.basename(String(args[0])) !== "execution-model.state.lock"
        )
          return;
        const original = parseStoredExecutionFixture(
          fs.readFileSync(file, "utf8"),
        );
        const queue = original.queueEntries.find(
          (value) => value.queueId === input.queueId,
        );
        if (
          !queue ||
          !original.leaseIntents.some(
            (intent) =>
              intent.queueId === input.queueId && intent.phase === "lock_owned",
          ) ||
          queue.state !== (mode === "select" ? "queued" : "leased")
        )
          return;
        const blocker = acquireLock({
          directory: path.join(root, ".crdd", "lock"),
          name: "execution-model.state.lock",
          identity: "temporary-queue-start-fixture",
        });
        if (blocker.status !== "acquired") throw Error(blocker.reason);
        held = delay(45).then(() => assert.equal(blocker.lock.release(), true));
      },
    );
    try {
      const result = await runCoordinatorOperation(
        {
          leaseWait: {
            revalidate: async () => {
              checks++;
              return mode === "select";
            },
          },
          runSingleTaskAttempt: async (attempt) => {
            delegated++;
            await attempt.observeStarted?.();
            return completedAfterStart(attempt);
          },
        },
        input,
      );
      assert.ok(held, mode);
      assert.ok(checks > 0, mode);
      const final = parseStoredExecutionFixture(fs.readFileSync(file, "utf8"));
      if (mode === "select") {
        assert.equal(result.status, "completed", result.reason);
        assert.equal(delegated, 1);
        assert.deepEqual(result.completedTaskIds, ["task-a"]);
      } else {
        assert.equal(
          result.reason,
          "coordinator_authenticated_principal_not_verified",
        );
        assert.equal(delegated, 0);
        const current = readCoordinatorState(
          root,
          "binding-a",
          "project-a",
        ).value;
        assert.equal(current?.tasks[0]?.startPhase, "none");
        assert.equal(result.status, "cancelled");
        assert.equal(result.effectState, "no_effect");
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(result.manualRecoveryRequired, false);
        assert.deepEqual(result.recoveryIds, []);
        assert.equal(final.queueEntries[0]?.state, "cancelled");
        assert.equal(final.operations.length, 0);
      }
      assert.equal(final.leaseIntents.length, 0);
    } finally {
      hook.mock.restore();
      await held;
    }
  }
});

/**
 * 通常Taskの終端と結合Operationの除去を単一CASで保存する。
 * @responsibility 実Snapshot・技術履歴・Task終端の本番Application接続を検証する。
 * @trace PRL-IT-012
 * @precondition 新版Git Root、Queueと模擬下位操作の確認済み履歴を用意する。
 * @stimulus 二Operation・0件・大集合・取消・保存失敗・応答喪失・履歴不正を実行する。
 * @observation Task起動数、Operation除去、Task終端と結果fieldを確認する。
 * @oracle 技術終端と履歴が成立した場合だけ対象を除去し、不明時は保持する。
 * @cleanup 自己所有fixtureを終了hookで回収する。Docker/Providerは使用しない。
 * @boundary PRL-IT-012=Direct Boundary: Application→単一物理Writer→実Snapshot／履歴。
 */
for (const mode of [
  "normal",
  "many_operations",
  "none",
  "cancelled",
  "save_failure",
  "save_after_effect",
  "history_missing",
  "history_duplicate",
  "history_mismatch",
  "history_unconfirmed",
] as const) {
  test(`Task終端保存は確認済みOperationだけを原子的に整理する ${mode}`, async (t) => {
    const { root, input } = fixture(t, [task("task-a")], 1);
    const persistence = createTestPersistence(root, "binding-a");
    let starts = 0;
    let fixtureFailure: unknown = null;
    const outcome = await withExecutionStateSave(
      (...args) => {
        const request = args[2];

        if (
          (mode === "save_failure" || mode === "save_after_effect") &&
          request.kind === "task_settle"
        ) {
          if (mode === "save_after_effect")
            assert.equal(
              executionModel.saveProjectExecutionState(...args).status,
              "completed",
            );
          return {
            status: "blocked",
            reason: "fixture_terminal_save_failure",
            value: null,
            manualRecoveryRequired: true,
            recoveryId: null,
          };
        }
        return executionModel.saveProjectExecutionState(...args);
      },
      (dispatch) =>
        dispatch(
          {
            persistence,
            runSingleTaskAttempt: async (attempt) => {
              starts += 1;
              const result = await completed(attempt);
              if (mode !== "none") {
                try {
                  settleSyntheticOperations(
                    root,
                    attempt.operationId,
                    mode === "many_operations" ? 129 : 2,
                  );
                } catch (error) {
                  fixtureFailure = error;
                  throw error;
                }
              }
              const area = path.join(root, ".crdd", "execution-model");
              const history = path.join(area, "history.jsonl");
              if (mode === "history_missing") fs.unlinkSync(history);
              if (mode === "history_duplicate") {
                const bytes = fs.readFileSync(history);
                fs.writeFileSync(history, Buffer.concat([bytes, bytes]));
              }
              if (mode === "history_mismatch") {
                const rows = fs
                  .readFileSync(history, "utf8")
                  .trim()
                  .split("\n")
                  .map((line) => ({
                    ...JSON.parse(line),
                    occurredAt: "2026-01-01T00:00:00.000Z",
                  }));
                fs.writeFileSync(
                  history,
                  rows.map((row) => `${canonicalJson(row)}\n`).join(""),
                );
              }
              if (mode === "history_unconfirmed") {
                const file = path.join(area, "state.json");
                const state = JSON.parse(fs.readFileSync(file, "utf8"));
                for (const operation of state.operations)
                  if (operation.kind === "docker_task")
                    operation.history.confirmed = false;
                fs.writeFileSync(file, `${canonicalJson(state)}\n`);
              }
              return mode === "cancelled"
                ? {
                    ...result,
                    status: "cancelled",
                    reason: "fixture_cancelled",
                  }
                : result;
            },
          },
          input,
        ),
    );
    assert.equal(starts, 1);
    assert.equal(
      fixtureFailure,
      null,
      fixtureFailure instanceof Error
        ? fixtureFailure.stack
        : String(fixtureFailure),
    );
    const confirmed = [
      "normal",
      "many_operations",
      "none",
      "cancelled",
    ].includes(mode);
    assert.equal(
      outcome.status,
      mode === "cancelled" ? "cancelled" : confirmed ? "completed" : "blocked",
      JSON.stringify(outcome),
    );
    const snapshot = JSON.parse(
      fs.readFileSync(
        path.join(root, ".crdd", "execution-model", "state.json"),
        "utf8",
      ),
    );
    const committed = confirmed || mode === "save_after_effect";
    assert.equal(
      snapshot.operations.filter(
        (item: { kind: string }) => item.kind === "docker_task",
      ).length,
      committed ? 0 : 2,
    );
    const hosts = snapshot.operations.filter(
      (item: { kind: string }) => item.kind === "host_operation",
    );
    assert.equal(
      hosts.length,
      mode === "none" ? 0 : mode === "many_operations" ? 129 : 2,
    );
    assert.ok(
      hosts.every(
        (item: { phase: string; cleanup: string }) =>
          item.phase === "terminal" && item.cleanup === "confirmed",
      ),
    );
    for (const key of ["pendingDeliveries", "resultReceipts"])
      assert.equal(Object.hasOwn(snapshot, key), false);
    const stored = readProjectExecutionState(
      persistence.repository,
      persistence.repositoryBindingId,
      "project-a",
    );
    if (stored.value) {
      assert.equal(
        stored.value.tasks[0]?.startPhase,
        committed ? "settled" : "running",
      );
      assert.equal(
        Object.hasOwn(stored.value.tasks[0] ?? {}, "resultAcceptances"),
        false,
      );
    }
  });
}

type BoundExecutionDependencies = Omit<
  Parameters<typeof runTestCoordinatorOperation>[0],
  "persistence"
> &
  Readonly<{
    persistence?: Parameters<
      typeof runTestCoordinatorOperation
    >[0]["persistence"];
    poisonAfterCleanupUnknown?: () => void;
  }>;
type BoundExecutionInput = Parameters<typeof runTestCoordinatorOperation>[1] &
  Readonly<{ workingDirectory: string; repositoryBindingId: string }>;

/**
 * EM保存境界だけを差し替えた実Dispatchを一回のCaseへ接続する。
 * @responsibility 保存済みEffectと応答故障を区別し、終了後にModule代役を解除する。
 * @trace PRL-IT-012
 * @precondition 同じProcess内のCaseを並列実行しない。
 * @stimulus 正式saveだけを差し替えてから独立したDispatch Moduleを読む。
 * @observation 呼出し元の要求・世代・保存結果と実行結果を得る。
 * @oracle 実保存を呼ぶ故障でも元EM実装への接続を保持する。
 * @cleanup completionと解放を含むDispatch完了後、例外時もModule代役を解除する。
 * @boundary CoordinatorからEMの正式保存入口。AI・Dockerは使わない。
 */
async function withExecutionStateSave(
  save: typeof executionModel.saveProjectExecutionState,
  execute: (
    dispatch: typeof runTestCoordinatorOperation,
  ) => ReturnType<typeof runTestCoordinatorOperation>,
  read?: typeof executionModel.readExecutionState,
) {
  const storage = mock.module(
    import.meta.resolve("@qual-lab/crdd-execution-model"),
    {
      namedExports: {
        ...executionModel,
        saveProjectExecutionState: save,
        ...(read ? { readExecutionState: read } : {}),
      },
    },
  );
  try {
    return await execute(runTestCoordinatorOperation);
  } finally {
    storage.restore();
  }
}

/**
 * runCoordinatorOperationのTest準備責務を実行する。
 *
 * @responsibility runCoordinatorOperationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runCoordinatorOperationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
async function runCoordinatorOperation(
  dependencies: BoundExecutionDependencies,
  input: BoundExecutionInput,
  dispatch = runTestCoordinatorOperation,
) {
  const { workingDirectory, repositoryBindingId, ...applicationInput } = input;
  const { poisonAfterCleanupUnknown, persistence, ...applicationDependencies } =
    dependencies;
  const operationDependencies = {
    ...applicationDependencies,

    persistence:
      persistence ??
      createTestPersistence(workingDirectory, repositoryBindingId),
  };
  if (!poisonAfterCleanupUnknown)
    return dispatch(operationDependencies, applicationInput);
  const replacement = mock.module(
    new URL("../../src/lifecycle/host.ts", import.meta.url).href,
    {
      namedExports: {
        ...host,
        poisonExecutionProcessAfterCleanupUnknown: poisonAfterCleanupUnknown,
      },
    },
  );
  try {
    return await dispatch(operationDependencies, applicationInput);
  } finally {
    replacement.restore();
  }
}

/**
 * hashのTest準備責務を実行する。
 *
 * @responsibility hashがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus hashを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * taskのTest準備責務を実行する。
 *
 * @responsibility taskがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus taskを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function task(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return {
    id,
    objectiveId: "objective-a",
    dependencies,
    allowedPaths,
    conflictKeys,
  };
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(
  t: test.TestContext,
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  const tests = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(tests, { recursive: true });
  const root = fs.mkdtempSync(path.join(tests, "project-execution-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  // 公開回復・Directとも実在する固定HEADを持つRepositoryで検証する。
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "core.hooksPath=NUL",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  const initialized = initializeExecutionStore(
    resolveExecutionStorageDirectory(root),
    "binding-a",
  );
  assert.equal(initialized.status, "completed", initialized.reason);
  const created = projectExecutionFixture({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks,
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture_failed");
  const queued = enqueueProjectOperation(
    root,
    "binding-a",
    {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("request"),
      originLane: "interactive",
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    },
    initialExecutionInput(created.state),
  );
  assert.equal(queued.status, "completed", queued.reason);
  const input = {
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    taskExecutions: tasks.map((entry) => ({
      taskId: entry.id,
      authorityBindingId: `authority-${entry.id}`,
      taskRequest: { taskId: entry.id },
      repositoryRoot: root,
    })),
    cancellationSignal: new AbortController().signal,
  };
  return { root, input };
}

/**
 * completedのTest準備責務を実行する。
 *
 * @responsibility completedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus completedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
async function completed(
  input: Parameters<
    Parameters<typeof runCoordinatorOperation>[0]["runSingleTaskAttempt"]
  >[0],
): Promise<CoordinatorSingleTaskResult> {
  assert.equal(await input.observeStarted?.(), undefined);
  return completedAfterStart(input);
}

/**
 * completedAfterStartのTest準備責務を実行する。
 *
 * @responsibility completedAfterStartがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus completedAfterStartを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function completedAfterStart(
  input: Parameters<
    Parameters<typeof runCoordinatorOperation>[0]["runSingleTaskAttempt"]
  >[0],
): CoordinatorSingleTaskResult {
  return {
    contract: "crdd-coordinator/single-task-adapter",
    attemptId: input.attemptId,
    operationId: input.operationId,
    authorityBindingId: input.authorityBindingId,
    repositoryRevision: input.repositoryRevision,
    status: "completed",
    reason: "task_completed",
    effectState: "settled",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    candidateId: null,
    recoveryIds: [],
  };
}

// 記録の非Authority境界はprovider-intelligence.contract.test.tsへ移管。

/**
 * PR-N-01 connects one durable Project task to the Single Task boundaryを検証する。
 *
 * @responsibility PR-N-01 connects one durable Project task to the Single Task boundaryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-01 connects one durable Project task to the Single Task boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-01 connects one durable Project task to the Single Task boundary", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  let effects = 0;
  const changedPaths = ["src/changed.ts"];
  const order: Array<string> = [];
  let lastSavedGeneration: number | undefined;
  const outcome = await withExecutionStateSave(
    (...args) => {
      const { kind } = args[2];
      order.push(kind);
      if (lastSavedGeneration !== undefined)
        assert.equal(args[3], lastSavedGeneration, kind);
      const written = executionModel.saveProjectExecutionState(...args);
      assert.equal(written.status, "completed", kind);
      lastSavedGeneration = written.value.generation;
      return written;
    },
    () =>
      runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) => {
            effects += 1;
            order.push("delegated");
            const result = await completed(attempt);
            const whileDelegated = readCoordinatorState(
              root,
              "binding-a",
              "project-a",
            );
            assert.equal(whileDelegated.status, "completed");
            assert.ok(whileDelegated.value);
            assert.equal(whileDelegated.value.tasks[0]?.state, "running");
            assert.throws(
              () =>
                fs.lstatSync(
                  path.join(
                    root,
                    ".crdd",
                    "lock",
                    "execution-model.state.lock",
                  ),
                ),
              { code: "ENOENT" },
            );
            order.push("completion");
            return {
              ...result,
              workspaceResult: {
                workspaceId: null,
                changedPaths,
                canonicalRepositoryChanged: true,
                changeAttribution: "unattributed",
                workspaceDeletionIssued: false,
              },
            };
          },
        },
        input,
      ),
  );
  assert.equal(outcome.status, "completed", JSON.stringify(outcome));
  assert.equal(
    outcome.reason,
    "coordinator_tasks_completed_integration_pending",
  );
  assert.equal(outcome.contract, "crdd-coordinator/execution/v1");
  assert.equal(effects, 1);
  changedPaths.push("src/late.ts");
  assert.equal(outcome.workspaceResults?.length, 1);
  assert.deepEqual(outcome.workspaceResults?.[0]?.result.changedPaths, [
    "src/changed.ts",
  ]);
  assert.deepEqual(order, [
    "task_start",
    "task_handoff",
    "delegated",
    "task_started",
    "completion",
    "task_settle",
  ]);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(state.value.generation, lastSavedGeneration);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "completed",
  );
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "integration_pending",
  );
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );

  const replay = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(replay.reason, "coordinator_tasks_already_integration_pending");
  assert.equal(effects, 1);
});

/**
 * interactive Queue wins a fresh binding-wide selection before a scheduled caller can claimを検証する。
 *
 * @responsibility interactive Queue wins a fresh binding-wide selection before a scheduled caller can claimの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus interactive Queue wins a fresh binding-wide selection before a scheduled caller can claimの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("interactive Queue wins a fresh same-scope selection before a scheduled caller can claim", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const state = readProjectExecutionState(
    resolveExecutionStorageDirectory(root),
    "binding-a",
    "project-a",
    input.queueId,
  );
  assert.ok(state.status === "completed" && state.value, state.reason);
  assert.equal(
    enqueueProjectOperation(
      root,
      "binding-a",
      {
        queueId: "queue-scheduled",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: hash("scheduled-request"),
        originLane: "scheduled",
        repositoryRevision: revision,
        scopeHash: hash("scheduled-scope"),
      },
      initialExecutionInput(state.value),
    ).status,
    "completed",
  );
  let effects = 0;
  const dependencies = {
    runSingleTaskAttempt: async (attempt: Parameters<typeof completed>[0]) => {
      effects += 1;
      return completed(attempt);
    },
  };
  const scheduled = await runCoordinatorOperation(dependencies, {
    ...input,
    queueId: "queue-scheduled",
  });
  assert.equal(scheduled.status, "blocked");
  assert.equal(scheduled.reason, "coordinator_queue_claim_priority_changed");
  assert.equal(scheduled.effectState, "no_effect");
  assert.equal(effects, 0);
  const interactive = await runCoordinatorOperation(dependencies, input);
  assert.equal(interactive.status, "completed");
  assert.equal(effects, 1);
});

/**
 * PR-N-01 uses the existing Single Task adapter without widening its authorityを検証する。
 *
 * @responsibility PR-N-01 uses the existing Single Task adapter without widening its authorityの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-01 uses the existing Single Task adapter without widening its authorityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-01 uses the existing Single Task adapter without widening its authority", async (t) => {
  const { input } = fixture(t, [task("task-a")], 1);
  let starts = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: (attempt) =>
        runTestSingleTaskAttempt(
          {
            startTask: (
              _request,
              _root,
              _correlation,
              notifyStarted,
              consumer,
              workspaceTarget,
            ) => {
              starts += 1;
              assert.equal(consumer, "coordinator");
              assert.deepEqual(workspaceTarget, {
                workspaceId: null,
                ownerRepositoryRoot: attempt.repositoryRoot,
                executionTree: attempt.repositoryRoot,
                baseCommit: null,
                head: null,
              });
              assert.notEqual(workspaceTarget, attempt.workspaceTarget);
              return {
                status: "started",
                controlCapability: {},
                completion: Promise.resolve().then(async () => {
                  assert.ok(notifyStarted);
                  assert.equal(
                    await notifyStarted({
                      event: "coordinator_provider_process_started",
                      taskRole: "executor",
                      provider: "claude",
                      operationId: "OP-execution-fixture",
                    }),
                    undefined,
                  );
                  return {
                    status: "completed",
                    reason: "coordinator_task_completed",
                    canonicalRepositoryChanged: false,
                    workspaceResult: {
                      workspaceId: null,
                      changedPaths: [],
                      canonicalRepositoryChanged: false,
                      changeAttribution: "unattributed",
                      workspaceDeletionIssued: false,
                    },
                    cleanupConfirmed: true,
                    manualRecoveryRequired: false,
                    processRestartRequired: false,
                    candidateId: null,
                    hostRecoveryId: null,
                    dockerRecoveryIds: [],
                    candidateRecoveryId: null,
                    candidateStoreRecoveryId: null,
                  };
                }),
              };
            },
            cancelTask: () => undefined,
          },
          attempt,
        ),
    },
    input,
  );
  assert.equal(outcome.status, "completed", outcome.reason);
  assert.equal(starts, 1);
});

/**
 * PR-N-02 runs at most five independent tasks and then drains the remainderを検証する。
 *
 * @responsibility PR-N-02 runs at most five independent tasks and then drains the remainderの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-02 runs at most five independent tasks and then drains the remainderの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-02 同じWorkspaceの独立Taskを並行上限によらず直列に完了する", async (t) => {
  const tasks = Array.from({ length: 7 }, (_unused, index) =>
    task(`task-${index + 1}`),
  );
  const { root, input } = fixture(t, tasks, 5);
  let active = 0;
  let maximumActive = 0;
  let preparedAtFirstEffect: number | null = null;
  const observedOperationIds = new Set<string>();
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        observedOperationIds.add(attempt.operationId);
        if (preparedAtFirstEffect === null) {
          const observed = readCoordinatorState(root, "binding-a", "project-a");
          assert.equal(observed.status, "completed");
          assert.ok(observed.value);
          preparedAtFirstEffect =
            observed.value?.tasks.filter(
              (entry) =>
                entry.state === "starting" &&
                entry.startPhase === "handoff_prepared",
            ).length ?? null;
        }
        assert.equal(await attempt.observeStarted?.(), undefined);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return completedAfterStart(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.equal(preparedAtFirstEffect, 1);
  assert.equal(maximumActive, 1);
  assert.equal(outcome.completedTaskIds.length, 7);
  assert.equal(observedOperationIds.size, 7);
});

/**
 * PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across wavesを検証する。
 *
 * @responsibility PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across wavesの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across wavesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across waves", async (t) => {
  const tasks = [
    task("task-a", [], ["shared"]),
    task("task-b", ["task-a"]),
    task("task-c", [], ["shared/file.txt"]),
    task("task-d", [], ["other.txt"]),
  ];
  const { input } = fixture(t, tasks, 5);
  const startedItems: string[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        const taskId = (attempt.taskRequest as { taskId: string }).taskId;
        startedItems.push(taskId);
        await new Promise((resolve) => setTimeout(resolve, 2));
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.deepEqual(startedItems, ["task-a", "task-b", "task-c", "task-d"]);
  assert.ok(
    outcome.completedTaskIds.indexOf("task-a") <
      outcome.completedTaskIds.indexOf("task-b"),
  );
  assert.ok(
    outcome.completedTaskIds.indexOf("task-a") <
      outcome.completedTaskIds.indexOf("task-c"),
  );
  assert.equal(new Set(outcome.completedTaskIds).size, 4);
});

/**
 * PR-A-03 rejects a result from another attempt without projecting successを検証する。
 *
 * @responsibility PR-A-03 rejects a result from another attempt without projecting successの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 別試行から見かけ上の成功と候補参照を返す。
 * @observation 回復に渡した保存要求、元試行の回復義務と保存後状態を観測する。
 * @oracle 別試行の候補を保存へ渡さず、元試行の回復要求だけが保存される。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 rejects a result from another attempt without projecting success", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const settlements: Array<{ outcome: string; candidateId?: string | null }> =
    [];
  const outcome = await withExecutionStateSave(
    (...args) => {
      const request = args[2];
      if (request.kind === "task_settle") settlements.push(request);
      return executionModel.saveProjectExecutionState(...args);
    },
    () =>
      runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) => ({
            ...(await completed(attempt)),
            attemptId: "another-attempt",
            candidateId: "candidate.foreign-attempt",
          }),
        },
        input,
      ),
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "coordinator_task_recovery_required");
  assert.equal(outcome.manualRecoveryRequired, true);
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0]?.outcome, "recovery_required");
  assert.equal(settlements[0]?.candidateId, null);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "recovery_required",
  );
  assert.equal(state.value.tasks[0]?.candidateId, null);
  assert.equal(
    state.value.tasks[0]?.recoveryObligations[0]?.kind,
    "execution_process",
  );
});

/**
 * PR-A-03 rejects malformed and differently bound Single Task resultsを検証する。
 *
 * @responsibility PR-A-03 rejects malformed and differently bound Single Task resultsの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 rejects malformed and differently bound Single Task resultsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 rejects malformed and differently bound Single Task results", async (t) => {
  const cases = [
    ["contract", { contract: "wrong-contract" }],
    ["operation", { operationId: "other-operation" }],
    ["authority", { authorityBindingId: "other-authority" }],
    ["missing-recovery", { recoveryIds: undefined }],
    ["extra-field", { extra: true }],
    [
      "workspace",
      {
        workspaceResult: {
          workspaceId: "11111111-1111-4111-8111-111111111111",
          changedPaths: ["src/changed.ts"],
          canonicalRepositoryChanged: false,
          changeAttribution: "unattributed",
          workspaceDeletionIssued: false,
        },
      },
    ],
  ] as const;
  for (const [name, override] of cases) {
    await t.test(name, async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) =>
            ({
              ...(await completed(attempt)),
              ...override,
            }) as CoordinatorSingleTaskResult,
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.reason, "coordinator_task_recovery_required");
      assert.equal(outcome.workspaceResults, undefined);
      const state = readCoordinatorState(root, "binding-a", "project-a");
      assert.equal(state.status, "completed");
      assert.ok(state.value);
      assert.ok(state.value);
      assert.equal(
        state.status === "completed" && state.value?.tasks[0]?.state,
        "recovery_required",
      );
    });
  }
});

/**
 * PR-A-03 rejects recovery identifiers that durable Project State cannot storeを検証する。
 *
 * @responsibility PR-A-03 rejects recovery identifiers that durable Project State cannot storeの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 rejects recovery identifiers that durable Project State cannot storeの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 rejects recovery identifiers that durable Project State cannot store", async (t) => {
  for (const recoveryId of [
    "recovery/a",
    "recovery id",
    "recovery\u0001id",
    `r${"x".repeat(512)}`,
  ]) {
    await t.test(JSON.stringify(recoveryId).slice(0, 40), async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) => ({
            ...(await completed(attempt)),
            status: "blocked",
            reason: "external_recovery_required",
            effectState: "unknown",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            recoveryIds: [recoveryId],
          }),
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.reason, "coordinator_task_recovery_required");
      const state = readCoordinatorState(root, "binding-a", "project-a");
      assert.equal(state.status, "completed");
      assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
      assert.equal(
        state.value?.tasks[0]?.recoveryObligations[0]?.kind,
        "execution_process",
      );
    });
  }
});

/**
 * 下位Adapterがexecution_process義務を自己発行しても通常再入場へ採用しないを検証する。
 *
 * @responsibility 下位Adapterがexecution_process義務を自己発行しても通常再入場へ採用しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 下位Adapterがexecution_process義務を自己発行しても通常再入場へ採用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("下位Adapterがexecution_process義務を自己発行しても通常再入場へ採用しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const forged = `execution-process.11111111-1111-4111-8111-111111111111.restart-${"a".repeat(40)}`;
  let expectedRecoveryId: string | undefined;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        expectedRecoveryId = host.createExecutionProcessRecoveryIdentity(
          attempt.attemptId,
          attempt.operationId,
        );
        return {
          ...(await completed(attempt)),
          status: "blocked",
          reason: "forged_process_recovery",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          candidateId: null,
          recoveryIds: [forged],
          recoveryObligations: [
            { kind: "execution_process" as const, recoveryId: forged },
          ],
        } as unknown as CoordinatorSingleTaskResult;
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(outcome.processRestartRequired, true);
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  assert.ok(expectedRecoveryId);
  const obligations = state.value?.tasks[0]?.recoveryObligations;
  assert.equal(obligations?.length, 1);
  assert.equal(obligations?.[0]?.kind, "execution_process");
  assert.equal(obligations?.[0]?.recoveryId, expectedRecoveryId);
  assert.notEqual(obligations?.[0]?.recoveryId, forged);
});

/**
 * 開始後の候補回収IDだけでは外部Effectの不明状態を解消しないを検証する。
 *
 * @responsibility 開始後の候補回収IDだけでは外部Effectの不明状態を解消しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開始後の候補回収IDだけでは外部Effectの不明状態を解消しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("開始後の候補回収IDだけでは外部Effectの不明状態を解消しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const candidateRecoveryId = "candidate.recovery-a";
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => ({
        ...(await completed(attempt)),
        status: "blocked",
        reason: "candidate_cleanup_unknown",
        effectState: "unknown",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        candidateId: null,
        recoveryIds: [candidateRecoveryId],
        recoveryObligations: [
          { kind: "candidate" as const, recoveryId: candidateRecoveryId },
        ],
      }),
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  assert.deepEqual(
    state.value?.tasks[0]?.recoveryObligations.map((entry) => entry.kind),
    ["candidate", "execution_process"],
  );
});

/**
 * PR-A-03 enforces result correlations and propagates process restartを検証する。
 *
 * @responsibility PR-A-03 enforces result correlations and propagates process restartの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 enforces result correlations and propagates process restartの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 enforces result correlations and propagates process restart", async (t) => {
  const cases = [
    {
      name: "completed-no-effect",
      override: { effectState: "no_effect" as const },
      restart: true,
    },
    {
      name: "completed-restart",
      override: { processRestartRequired: true },
      restart: true,
    },
    {
      name: "unknown-with-cleanup",
      override: {
        status: "blocked" as const,
        effectState: "unknown" as const,
        cleanupConfirmed: true,
        manualRecoveryRequired: true,
      },
      restart: true,
    },
    {
      name: "blocked-restart",
      override: {
        status: "blocked" as const,
        reason: "restart_required",
        effectState: "no_effect" as const,
        processRestartRequired: true,
      },
      restart: true,
    },
    {
      name: "cancelled-no-effect-after-start",
      override: {
        status: "cancelled" as const,
        reason: "cancelled_after_effect_start",
        effectState: "no_effect" as const,
      },
      restart: true,
    },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) => ({
            ...(await completed(attempt)),
            ...scenario.override,
          }),
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.manualRecoveryRequired, true);
      assert.equal(outcome.processRestartRequired, scenario.restart);
      const state = readCoordinatorState(root, "binding-a", "project-a");
      assert.ok(state.value);
      assert.equal(
        state.status === "completed" && state.value.tasks[0]?.state,
        "recovery_required",
      );
      if (scenario.restart && state.status === "completed") {
        assert.equal(state.value.tasks[0]?.recoveryUnresolved, true);
        assert.equal(
          state.value.tasks[0]?.recoveryObligations[0]?.kind,
          "execution_process",
        );
        assert.match(
          state.value.tasks[0]?.recoveryObligations[0]?.recoveryId ?? "",
          /^execution-process\.[0-9a-f-]{36}\.restart-[0-9a-f]{40}$/u,
        );
      }
    });
  }
});

/**
 * 開始未確認の成功を保存・公開の双方で回復待ちにする。
 * @responsibility 結果だけから開始・正常終了・候補の成立を補わない。
 * @trace PRL-IT-012
 * @precondition 自己生成Repositoryの実Writerと二件のTaskを使う。
 * @stimulus 開始通知を通さず候補付きの技術成功を返す。
 * @observation 元試行の保存、外部Effect不明、完了一覧・変更観測、後続委譲数。
 * @oracle 元試行の回復だけを保存し候補・完了一覧・変更観測と次のEffectを出さない。
 * @cleanup 試験が作成した領域を既存hookで回収する。
 * @boundary Graphの試行受領から実行モデルの終了Writer。実AI・Dockerなし。
 */
test("開始未確認の成功は回復待ちにし候補や完了一覧を公開しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a"), task("task-b")], 1);
  const dispatched: string[] = [];
  let recoveryId: string | null = null;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        dispatched.push((attempt.taskRequest as { taskId: string }).taskId);
        recoveryId = host.createExecutionProcessRecoveryIdentity(
          attempt.attemptId,
          attempt.operationId,
        );
        return {
          ...completedAfterStart(attempt),
          candidateId: "candidate.unconfirmed-start",
          workspaceResult: {
            workspaceId: null,
            changedPaths: ["src/unconfirmed.ts"],
            canonicalRepositoryChanged: true,
            changeAttribution: "unattributed",
            workspaceDeletionIssued: false,
          },
        };
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "coordinator_task_recovery_required");
  assert.equal(outcome.effectState, "unknown");
  assert.equal(outcome.cleanupConfirmed, false);
  assert.equal(outcome.processRestartRequired, true);
  assert.deepEqual(outcome.completedTaskIds, []);
  assert.equal(outcome.workspaceResults, undefined);
  assert.deepEqual(dispatched, ["task-a"]);
  assert.ok(recoveryId);
  assert.deepEqual(outcome.recoveryIds, [recoveryId]);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  const saved = state.value?.tasks.find(
    ({ definition }) => definition.id === "task-a",
  );
  assert.equal(saved?.state, "recovery_required");
  assert.equal(saved?.candidateId, null);
  assert.equal(saved?.recoveryUnresolved, true);
  assert.deepEqual(saved?.recoveryObligations, [
    { kind: "execution_process", recoveryId, phase: "required" },
  ]);
});

/**
 * PR-A-03 stops later waves when a Task requires process restartを検証する。
 *
 * @responsibility PR-A-03 stops later waves when a Task requires process restartの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 stops later waves when a Task requires process restartの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 stops later waves when a Task requires process restart", async (t) => {
  const { input } = fixture(t, [task("task-a"), task("task-b")], 1);
  const startedItems: string[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        startedItems.push((attempt.taskRequest as { taskId: string }).taskId);
        return {
          ...(await completed(attempt)),
          status: "blocked",
          reason: "restart_required",
          effectState: "no_effect",
          processRestartRequired: true,
        };
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  assert.deepEqual(startedItems, ["task-a"]);
});

/**
 * execution_process義務は同じTask attemptとoperationにだけ結合するを検証する。
 *
 * @responsibility execution_process義務は同じTask attemptとoperationにだけ結合するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus execution_process義務は同じTask attemptとoperationにだけ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("execution_process義務は同じTask attemptとoperationにだけ結合する", async (t) => {
  const { root, input } = fixture(t, [task("task-a"), task("task-b")], 2);
  let firstRecoveryId = "";
  const outcome = await runCoordinatorOperation(
    {
      poisonAfterCleanupUnknown: () => undefined,
      runSingleTaskAttempt: async (attempt) => {
        await attempt.observeStarted?.();
        if ((attempt.taskRequest as { taskId: string }).taskId === "task-a") {
          firstRecoveryId = host.createExecutionProcessRecoveryIdentity(
            attempt.attemptId,
            attempt.operationId,
          );
          return {
            ...completedAfterStart(attempt),
            status: "blocked",
            reason: "restart_required",
            effectState: "unknown",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            processRestartRequired: true,
          };
        }
        return {
          ...completedAfterStart(attempt),
          status: "blocked",
          reason: "cross_task_recovery_replay",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          recoveryIds: [firstRecoveryId],
          recoveryObligations: [
            { kind: "execution_process" as const, recoveryId: firstRecoveryId },
          ],
        } as unknown as CoordinatorSingleTaskResult;
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  const first = state.value?.tasks.find(
    (entry) => entry.definition.id === "task-a",
  );
  const second = state.value?.tasks.find(
    (entry) => entry.definition.id === "task-b",
  );
  assert.equal(first?.recoveryObligations[0]?.recoveryId, firstRecoveryId);
  assert.notEqual(second?.recoveryObligations[0]?.recoveryId, firstRecoveryId);
  assert.deepEqual(second?.recoveryObligations, []);
  assert.equal(second?.attemptId, null);
});

/**
 * 下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しないを検証する。
 *
 * @responsibility 下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しない", async (t) => {
  await t.test("after-start", async (subtest) => {
    const { root, input } = fixture(subtest, [task("task-a")], 1);
    let poisoned = 0;
    const outcome = await runCoordinatorOperation(
      {
        poisonAfterCleanupUnknown: () => {
          poisoned += 1;
        },
        runSingleTaskAttempt: async (attempt) => {
          assert.equal(await attempt.observeStarted?.(), undefined);
          throw new Error("runner_failed_after_effect_start");
        },
      },
      input,
    );
    assert.equal(outcome.processRestartRequired, true);
    assert.equal(poisoned, 1);
    const state = readCoordinatorState(root, "binding-a", "project-a");
    assert.equal(
      state.value?.tasks[0]?.recoveryObligations[0]?.kind,
      "execution_process",
    );
  });
  await t.test("before-start-observation", async (subtest) => {
    const { root, input } = fixture(subtest, [task("task-a")], 1);
    let poisoned = 0;
    const outcome = await runCoordinatorOperation(
      {
        poisonAfterCleanupUnknown: () => {
          poisoned += 1;
        },
        runSingleTaskAttempt: async () => {
          throw new Error("runner_failed_before_effect_start");
        },
      },
      input,
    );
    assert.equal(outcome.processRestartRequired, true);
    assert.equal(poisoned, 1);
    assert.equal(outcome.effectState, "unknown");
    const state = readCoordinatorState(root, "binding-a", "project-a");
    assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  });
});

/**
 * PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservableを検証する。
 *
 * @responsibility PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservableの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservableの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservable", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const location = path.join(root, ".crdd", "execution-model", "state.json");
  const original = fs.openSync;
  let isInjected = false;
  let outcome: Awaited<ReturnType<typeof runCoordinatorOperation>>;
  try {
    outcome = await runCoordinatorOperation(
      {
        runSingleTaskAttempt: async (attempt) => {
          Reflect.set(fs, "openSync", ((
            ...args: Parameters<typeof fs.openSync>
          ) => {
            if (!isInjected && String(args[0]) === location) {
              isInjected = true;
              Reflect.set(fs, "openSync", original);
              throw new Error("snapshot_read_unconfirmed");
            }
            return Reflect.apply(original, fs, args);
          }) as typeof fs.openSync);
          return completed(attempt);
        },
      },
      input,
    );
  } finally {
    Reflect.set(fs, "openSync", original);
  }
  assert.equal(isInjected, true);
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.manualRecoveryRequired, true);
  const locks = path.join(root, ".crdd", "lock");
  assert.deepEqual(
    fs
      .readdirSync(locks)
      .filter((name) => name.startsWith("project-operation-project-a-queue-a")),
    [],
  );
  const before = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(before.status, "completed");
  assert.equal(
    before.status === "completed" && before.value.ownerGeneration,
    null,
  );
  const reconciled = host.reconcileCoordinatorSnapshotLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
    () => {
      throw new Error("released evidence must avoid owner observation");
    },
  );
  assert.equal(reconciled.status, "completed");
  assert.equal(
    reconciled.status === "completed" &&
      reconciled.value.queue?.ownerGeneration,
    null,
  );
});

/**
 * PR-A-03 treats a synchronous failure after delegation as an unknown handoffを検証する。
 *
 * @responsibility PR-A-03 treats a synchronous failure after delegation as an unknown handoffの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 treats a synchronous failure after delegation as an unknown handoffの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 treats a synchronous failure after delegation as an unknown handoff", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: () => {
        throw new Error("synchronous runner failure");
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "coordinator_task_recovery_required");
  assert.equal(outcome.cleanupConfirmed, false);
  assert.equal(outcome.manualRecoveryRequired, true);
  assert.equal(outcome.effectState, "unknown");
  assert.equal(outcome.processRestartRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value?.tasks[0]?.state,
    "recovery_required",
  );
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
});

/**
 * PR-A-05 keeps capacity and conflict reserved when cleanup is unknownを検証する。
 *
 * @responsibility PR-A-05 keeps capacity and conflict reserved when cleanup is unknownの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-05 keeps capacity and conflict reserved when cleanup is unknownの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-05 keeps capacity and conflict reserved when cleanup is unknown", async (t) => {
  const { root, input } = fixture(
    t,
    [task("task-a", [], ["shared"]), task("task-b", [], ["shared/file.txt"])],
    1,
  );
  const startedItems: string[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        startedItems.push((attempt.taskRequest as { taskId: string }).taskId);
        return {
          ...(await completed(attempt)),
          status: "blocked",
          reason: "cleanup_unknown",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        };
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.manualRecoveryRequired, true);
  assert.deepEqual(startedItems, ["task-a"]);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "recovery_required",
  );
  assert.equal(
    state.status === "completed" && state.value.tasks[1]?.state,
    "ready",
  );
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "recovery_required",
  );
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
});

/**
 * PR-Q-04 cancels before Task effect and releases durable ownershipを検証する。
 *
 * @responsibility PR-Q-04 cancels before Task effect and releases durable ownershipの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-Q-04 cancels before Task effect and releases durable ownershipの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-Q-04 cancels before Task effect and releases durable ownership", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  controller.abort();
  let effects = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(outcome.status, "cancelled", JSON.stringify(outcome));
  assert.equal(effects, 0);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "cancelled");
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
});

/**
 * Windowsの符号付きFile IDでも状態保存・再読・開始前取消を維持する。
 * @responsibility 共通保存Readerの補正を実Coordinatorの終了条件へ接続する。
 * @trace PRL-IT-012
 * @precondition 自己生成Repository・既存Snapshot・Queueを使用する。
 * @stimulus lstat／fstatを符号付き64bit表現にし取消済み要求を実行する。
 * @observation 保存・再読結果、Task Effect数、Queue終端・Owner解放を確認する。
 * @oracle 取消済みとなりTask Effect0、Queue cancelled、Ownerなし。
 * @cleanup mockを復元し自己生成Repositoryを回収する。
 * @boundary Coordinator→Domain保存Reader→Filesystem。
 */
test("Windowsの上位bit付きIDでも状態保存・再読と開始前取消が成立する", {
  skip: process.platform !== "win32",
}, async (t) => {
  const observed = { lstatSync: 0, fstatSync: 0 };
  for (const name of ["lstatSync", "fstatSync"] as const) {
    const original = fs[name];
    t.mock.method(fs, name, (...args: unknown[]) => {
      const metadata = Reflect.apply(original, fs, args) as
        | fs.BigIntStats
        | fs.Stats
        | undefined;
      if (metadata && typeof metadata.ino === "bigint") {
        metadata.ino = BigInt.asIntN(64, metadata.ino | (1n << 63n));
        observed[name]++;
      }
      return metadata;
    });
  }
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  controller.abort();
  let effects = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(outcome.status, "cancelled", outcome.reason);
  assert.equal(effects, 0);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed", queue.reason);
  if (queue.status !== "completed") throw new Error("queue_read_failed");
  assert.equal(queue.value.state, "cancelled");
  assert.equal(queue.value.ownerGeneration, null);
  assert.ok(observed.lstatSync > 0 && observed.fstatSync > 0);
});

/**
 * 開始準備の保存後、委譲直前の取消はTask Effectを発行しない。
 *
 * @responsibility 耐久的な開始準備とTask委譲の間の取消を閉じる。
 * @trace PRL-IT-012
 * @precondition 単一Taskを持つ自己生成Repositoryを使用する。
 * @stimulus 実Writerが開始準備を保存して返した直後に取消を通知する。
 * @observation 保存状態、Task呼出し回数、終了結果、回復義務を観測する。
 * @oracle 委譲0回、取消完了、片付け確認済み、合成回復義務なしとなる。
 * @cleanup 登録済みhookが自己生成Repositoryを清掃する。
 * @boundary PRL-IT-012=Related 2 Blocks: 開始準備の保存→Task委譲。
 */
test("開始準備保存後の取消はTaskを委譲せず終了する", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  let effects = 0;
  let preparedObserved = false;
  const persistence = createTestPersistence(root, "binding-a");
  const outcome = await withExecutionStateSave(
    (...args) => {
      const result = executionModel.saveProjectExecutionState(...args);
      if (result.status === "completed" && args[2].kind === "task_handoff") {
        preparedObserved = true;
        controller.abort();
      }
      return result;
    },
    (dispatch) =>
      runCoordinatorOperation(
        {
          persistence,
          runSingleTaskAttempt: async (attempt) => {
            effects += 1;
            return completed(attempt);
          },
        },
        { ...input, cancellationSignal: controller.signal },
        dispatch,
      ),
  );
  assert.equal(preparedObserved, true);
  assert.equal(outcome.status, "cancelled", JSON.stringify(outcome));
  assert.equal(outcome.cleanupConfirmed, true);
  assert.equal(outcome.manualRecoveryRequired, false);
  assert.equal(outcome.processRestartRequired, false);
  assert.equal(effects, 0);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.value?.tasks[0]?.state, "cancelled");
  assert.deepEqual(state.value?.tasks[0]?.recoveryObligations, []);
  assert.equal(outcome.effectState, "no_effect");
  // AI要求前の取消なのでEI実行記録は生成しない。
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "cancelled");
});

/**
 * contract remains a partial Coordinator capabilityを検証する。
 *
 * @responsibility contract remains a partial Coordinator capabilityの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus contract remains a partial Coordinator capabilityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
/**
 * 開始候補の輸送不正からTaskへ引き渡さない。
 * @trace PRL-IT-012
 * @precondition 今回のRepositoryと有限Executorを使い、正常な保存値から候補metadataだけを差し替える。
 * @stimulus 初回読取り・予約・引渡し・開始観測の候補輸送を不正にし、終端・Queue・Lease確定失敗も確認する。
 * @observation Lease取得・Queue進行・Task委譲の回数と停止理由。
 * @oracle 初回不正はLease/Queue進行0、委譲前不正はTask委譲0、委譲後不明は元の回復IDと未確認状態を保持する。
 * @cleanup fixtureの終了hookで今回作成Rootを回収する。
 */
test("開始候補の輸送不正は各保存境界で後続処理を停止する", async (t) => {
  for (const stage of [
    "read",
    "reserve",
    "handoff",
    "terminal",
    "started",
    "started_terminal_failed",
    "started_queue_failed",
    "started_settlement_failed",
  ] as const) {
    const startedCase = stage.startsWith("started");
    const { root, input } = fixture(t, [task("task-a")], 1);
    const persistence = createTestPersistence(root, "binding-a");
    let leases = 0,
      queueWrites = 0,
      effects = 0;
    const original = persistence;
    let expectedRecoveryId: string | null = null;
    let ownerGeneration: string | null = null;
    const leaseBoundary = mock.module(
      new URL("../../src/lifecycle/host.ts", import.meta.url).href,
      {
        namedExports: {
          ...host,
          updateCoordinatorQueue: (
            ...args: Parameters<typeof host.updateCoordinatorQueue>
          ) => {
            queueWrites++;
            assert.strictEqual(args[0].repository, original.repository);
            assert.equal(
              args[0].repositoryBindingId,
              original.repositoryBindingId,
            );
            if (
              stage === "started_queue_failed" &&
              args[3].state === "recovery_required"
            )
              return {
                status: "blocked",
                reason: "fixture_queue_failed",
                value: null,
                manualRecoveryRequired: true,
                recoveryId: null,
              };
            return host.updateCoordinatorQueue(...args);
          },
          acquireCoordinatorSnapshotLease: (
            ...args: Parameters<typeof host.acquireCoordinatorSnapshotLease>
          ) => {
            leases++;
            assert.equal(args[0], original.workingDirectory);
            assert.equal(args[1], original.repositoryBindingId);
            const acquired = host.acquireCoordinatorSnapshotLease(...args);
            if (acquired.status === "completed")
              ownerGeneration = acquired.value.ownerGeneration;
            return acquired;
          },
          settleCoordinatorSnapshotQueueLeaseRelease: (
            ...args: Parameters<
              typeof host.settleCoordinatorSnapshotQueueLeaseRelease
            >
          ) => {
            assert.equal(args[0], original.repository);
            assert.equal(args[1], original.repositoryBindingId);
            assert.equal(args[2], input.queueId);
            assert.equal(args[4], ownerGeneration);
            return stage === "started_settlement_failed"
              ? {
                  status: "blocked",
                  reason: "fixture_lease_settlement_failed",
                  value: null,
                  manualRecoveryRequired: true,
                  recoveryId: null,
                }
              : host.settleCoordinatorSnapshotQueueLeaseRelease(...args);
          },
        },
      },
    );
    let outcome: Awaited<ReturnType<typeof runTestCoordinatorOperation>>;
    try {
      outcome = await withExecutionStateSave(
        (...args) => {
          if (
            stage === "started_terminal_failed" &&
            args[2].kind === "task_settle"
          )
            return {
              status: "blocked",
              reason: "fixture_terminal_failed",
              value: null,
              manualRecoveryRequired: true,
              recoveryId: null,
            };
          const result = executionModel.saveProjectExecutionState(...args);
          return ((stage === "reserve" && args[2].kind === "task_start") ||
            (stage === "handoff" && args[2].kind === "task_handoff") ||
            (stage === "terminal" && args[2].kind === "task_settle") ||
            (startedCase && args[2].kind === "task_started")) &&
            result.status === "completed"
            ? {
                ...result,
                taskStartCandidates: {
                  ...result.taskStartCandidates,
                  taskIds: ["missing"],
                },
              }
            : result;
        },
        (dispatch) =>
          dispatch(
            {
              persistence: original,
              runSingleTaskAttempt: async (attempt) => {
                effects++;
                expectedRecoveryId =
                  host.createExecutionProcessRecoveryIdentity(
                    attempt.attemptId,
                    attempt.operationId,
                  );
                return completed(attempt);
              },
            },
            input,
          ),
        (...args) => {
          assert.strictEqual(args[0], original.repository);
          assert.equal(args[1], original.repositoryBindingId);
          const result = executionModel.readExecutionState(...args);
          return stage === "read" &&
            result.status === "completed" &&
            result.value
            ? {
                ...result,
                value: {
                  ...result.value,
                  taskStartCandidates: result.value.taskStartCandidates.map(
                    (candidate) =>
                      candidate.projectId === input.projectId
                        ? { ...candidate, taskIds: {} as never }
                        : candidate,
                  ),
                },
              }
            : result;
        },
      );
    } finally {
      leaseBoundary.restore();
    }
    assert.equal(outcome.status, "blocked", JSON.stringify(outcome));
    assert.equal(effects, startedCase || stage === "terminal" ? 1 : 0, stage);
    if (stage === "terminal") {
      assert.equal(outcome.effectState, "unknown");
      assert.equal(outcome.cleanupConfirmed, false);
      assert.equal(outcome.manualRecoveryRequired, true);
      assert.equal(outcome.processRestartRequired, false);
      assert.deepEqual(outcome.recoveryIds, []);
      assert.equal(
        readProjectExecutionState(
          original.repository,
          original.repositoryBindingId,
          input.projectId,
        ).value?.tasks[0]?.startPhase,
        "settled",
      );
    } else if (startedCase) {
      assert.equal(outcome.processRestartRequired, true);
      assert.equal(outcome.cleanupConfirmed, false);
      assert.equal(outcome.manualRecoveryRequired, true);
      assert.deepEqual(outcome.recoveryIds, [
        expectedRecoveryId,
        ...(stage === "started_queue_failed"
          ? [
              leaseAcquisitionRecoveryId(
                original.repositoryBindingId,
                input.projectId,
                input.queueId,
                "project-operation",
              ),
            ]
          : []),
      ]);
      assert.deepEqual(outcome.recoveryObligations, [
        { kind: "execution_process", recoveryId: expectedRecoveryId },
      ]);
      if (stage !== "started_terminal_failed") {
        const observed = readProjectExecutionState(
          original.repository,
          original.repositoryBindingId,
          input.projectId,
        );
        assert.equal(observed.status, "completed");
        assert.deepEqual(
          observed.value?.tasks.flatMap((task) =>
            task.recoveryObligations.map((item) => item.recoveryId),
          ),
          [expectedRecoveryId],
        );
        assert.equal(observed.value?.tasks[0]?.recoveryUnresolved, true);
      }
    } else
      assert.equal(outcome.reason, "coordinator_state_observation_unknown");
    if (stage === "read") {
      assert.equal(leases, 0);
      assert.equal(queueWrites, 0);
    }
  }
});

/**
 * 開始前終端の保存又は応答捕捉に失敗しても元の回復参照を保持する。
 * @trace PRL-IT-012
 * @precondition 各差分は今回作成する独立Rootと有限Executorを使う。
 * @stimulus 開始通知前のthrow後、終端保存拒否と保存後metadata不正を注入する。
 * @observation exact回復ID、Task phase、unknown、清掃と手動処置。
 * @oracle 保存前後を同一視せず、後続Taskを実行しない。
 * @cleanup fixtureの終了hookで今回Rootだけを回収する。
 * @boundary Coordinator→EMの既存Writer。実AI・Dockerなし。
 */
test("開始前終端の保存不明は元回復IDを保持する", async (t) => {
  for (const mode of ["save_failed", "metadata_invalid"] as const)
    await t.test(mode, async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const persistence = createTestPersistence(root, "binding-a");
      let calls = 0;
      let recoveryId: string | null = null;
      const outcome = await withExecutionStateSave(
        (...args) => {
          const request = args[2];

          if (request.kind !== "task_settle_before_effect")
            return executionModel.saveProjectExecutionState(...args);
          if (mode === "save_failed")
            return {
              status: "blocked",
              reason: "fixture_pre_effect_save_failed",
              value: null,
              manualRecoveryRequired: true,
              recoveryId: null,
            };
          const saved = executionModel.saveProjectExecutionState(...args);
          return saved.status === "completed"
            ? { ...saved, taskStartCandidates: null as never }
            : saved;
        },
        (dispatch) =>
          dispatch(
            {
              persistence,
              runSingleTaskAttempt: async (attempt) => {
                calls++;
                recoveryId = host.createExecutionProcessRecoveryIdentity(
                  attempt.attemptId,
                  attempt.operationId,
                );
                throw Error("fixture_before_started");
              },
            },
            input,
          ),
      );
      assert.equal(calls, 1);
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.effectState, "unknown");
      assert.equal(outcome.cleanupConfirmed, false);
      assert.equal(outcome.manualRecoveryRequired, true);
      assert.equal(outcome.processRestartRequired, true);
      assert.deepEqual(outcome.recoveryIds, [recoveryId]);
      assert.deepEqual(outcome.recoveryObligations, [
        { kind: "execution_process", recoveryId },
      ]);
      const observed = readProjectExecutionState(
        persistence.repository,
        persistence.repositoryBindingId,
        input.projectId,
      );
      assert.equal(observed.status, "completed");
      assert.equal(
        observed.value?.tasks[0]?.startPhase,
        mode === "save_failed" ? "handoff_prepared" : "settled",
      );
      if (mode === "metadata_invalid")
        assert.deepEqual(
          observed.value?.tasks[0]?.recoveryObligations.map(
            (item) => item.recoveryId,
          ),
          [recoveryId],
        );
    });
});
/**
 * 開始未受理の終端でも関連Operation整理をTaskと同じ実保存で確定する。
 * @trace PRL-IT-012
 * @precondition 今回Rootで既存fixtureが有効な合成Operationと確認済み履歴を一件作る。
 * @stimulus 開始通知を出さず、清掃確認済みの失敗結果を返して有限終端保存する。
 * @observation beforeのexact参照とhandoff、afterの同改訂Task/Operation区画、再送bytes。
 * @oracle Operationが最初から空ではないことを確認し、内部factsによる除去と未解決値を反証する。
 * @cleanup fixtureの終了hookが今回Rootだけを回収する。
 * @boundary 合成の技術完了は実AI・Process・Docker開始の証明ではない。
 */
test("開始前終端は実在する関連OperationをTaskと同一改訂で整理する", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const persistence = createTestPersistence(root, "binding-a");
  const file = path.join(root, ".crdd/execution-model/state.json");
  let exactRecoveryId: string | null = null;
  let settlements = 0;
  const outcome = await withExecutionStateSave(
    (...args) => {
      const request = args[2];

      if (request.kind !== "task_settle_before_effect")
        return executionModel.saveProjectExecutionState(...args);
      settlements++;
      const before = JSON.parse(fs.readFileSync(file, "utf8"));
      const beforeHosts = before.operations.filter(
        (item: { kind: string }) => item.kind === "host_operation",
      );
      const beforeOperations = before.operations.filter(
        (item: { kind: string }) => item.kind === "docker_task",
      );
      assert.equal(beforeOperations.length, 1);
      assert.equal(beforeOperations[0].recoveryId, exactRecoveryId);
      const beforeTask = before.managedExecutions[0].tasks[0];
      assert.equal(beforeTask.state, "starting");
      assert.equal(beforeTask.startPhase, "handoff_prepared");
      assert.equal(beforeTask.settlement.kind, "operations");
      assert.deepEqual(beforeTask.settlement.recoveryIds, [exactRecoveryId]);
      const saved = executionModel.saveProjectExecutionState(...args);
      assert.equal(saved.status, "completed", saved.reason);
      const after = JSON.parse(fs.readFileSync(file, "utf8"));
      assert.equal(after.revision, before.revision + 1);
      assert.deepEqual(after.operations, beforeHosts);
      const afterTask = after.managedExecutions[0].tasks[0];
      assert.equal(afterTask.state, "failed");
      assert.equal(afterTask.startPhase, "settled");
      assert.equal(afterTask.settlement.kind, "executor_result");
      assert.equal(afterTask.settlement.recoveryUnresolved, false);
      const bytes = fs.readFileSync(file);
      const replay = executionModel.saveProjectExecutionState(...args);
      assert.equal(replay.status, "completed", replay.reason);
      assert.deepEqual(fs.readFileSync(file), bytes);
      return saved;
    },
    (dispatch) =>
      dispatch(
        {
          persistence,
          runSingleTaskAttempt: async (attempt) => {
            const operations = settleSyntheticOperations(
              root,
              attempt.operationId,
              1,
            );
            exactRecoveryId = operations[0]?.recoveryId ?? null;
            assert.ok(exactRecoveryId);
            // 値だけを生成する既存fixtureであり、observeStartedは呼び出さない。
            return {
              ...completedAfterStart(attempt),
              status: "blocked",
              reason: "fixture_preparation_failed",
              effectState: "settled",
            };
          },
        },
        input,
      ),
  );
  assert.equal(settlements, 1);
  assert.equal(outcome.reason, "coordinator_replan_required");
  assert.equal(outcome.cleanupConfirmed, true);
  assert.deepEqual(outcome.recoveryIds, []);
});
/**
 * 実Processの単一世代と不可逆の再利用禁止を確認する。
 * @responsibility 別Processへ閉じて、本試験Processの状態を汚染せずsticky停止を反証する。
 * @trace PRL-IT-012
 * @precondition 実Node.jsと同じ本番Process安全状態Moduleを使用する。
 * @stimulus 初期状態、二度の停止通知、通知後の世代を照合する。
 * @observation 停止前後の状態と同じ世代、子Processの正常終了。
 * @oracle 一度停止すると同Processで解除されず、世代を再生成しない。
 * @cleanup 子Processの完了を同期で待つ。File・Docker・AI資源を作らない。
 * @boundary Node.js子Processと本番Moduleの終了状態。
 */
test("Processの再利用禁止は同じ世代でstickyに保持される", () => {
  const script = `import assert from "node:assert/strict";
import {getExecutionProcessInstanceIdentity,isExecutionProcessPoisoned,poisonExecutionProcessAfterCleanupUnknown} from ${JSON.stringify(new URL("../../src/lifecycle/host.ts", import.meta.url).href)};
const generation=getExecutionProcessInstanceIdentity();
assert.equal(isExecutionProcessPoisoned(),false);
poisonExecutionProcessAfterCleanupUnknown();
assert.equal(isExecutionProcessPoisoned(),true);
poisonExecutionProcessAfterCleanupUnknown();
assert.equal(isExecutionProcessPoisoned(),true);
assert.equal(getExecutionProcessInstanceIdentity(),generation);
process.stdout.write("verified");`;
  assert.equal(
    execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    }),
    "verified",
  );
});

// EIの保存・診断失敗は新しいProvider境界の試験で確認する。
