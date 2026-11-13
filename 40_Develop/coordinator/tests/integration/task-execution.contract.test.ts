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

import { canonicalJson } from "../support/contract-assertions.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ProjectTaskDefinition } from "../../../execution-model/src/index.ts";
import { initializeExecutionStore } from "../../../execution-model/src/index.ts";
import { runCoordinatorSingleTaskAttempt } from "../../src/execution/controller.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { createRuntimeProcessRecoveryIdentity } from "../../src/execution/process-safety-state.ts";
import { createCoordinatorState } from "../../src/state/create.ts";
import { createCurrentCoordinatorPersistencePorts } from "../../src/state/transaction.ts";
import {
  createCoordinatorExecutionHostPorts,
  describeCoordinatorExecutionContract,
  runCoordinatorOperation as runCoordinatorOperationWithPorts,
} from "../../src/task/dispatch.ts";
import type { CoordinatorSingleTaskResult } from "../../src/task/types.ts";
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import {
  enqueueProjectOperation,
  readCoordinatorState,
  readProjectOperationQueueState,
  writeCoordinatorState,
} from "../fixtures/task-persistence-fixture.ts";

import { settleSyntheticOperations } from "../fixtures/task-result-fixture.ts";

const revision = "a".repeat(40);

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
    const persistence = createCurrentCoordinatorPersistencePorts(
      root,
      "binding-a",
    );
    let starts = 0;
    const outcome = await runCoordinatorOperationWithPorts(
      {
        ...createCoordinatorExecutionHostPorts({}),
        persistence: {
          ...persistence,
          state: {
            ...persistence.state,
            writeState: (state, generation, facts) => {
              if (
                (mode === "save_failure" || mode === "save_after_effect") &&
                state.tasks.some((item) => item.startPhase === "settled")
              ) {
                if (mode === "save_after_effect")
                  assert.equal(
                    persistence.state.writeState(state, generation, facts)
                      .status,
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
              return persistence.state.writeState(state, generation, facts);
            },
          },
        },
        runSingleTaskAttempt: async (attempt) => {
          starts += 1;
          const result = await completed(attempt);
          if (mode !== "none")
            settleSyntheticOperations(
              root,
              attempt.operationId,
              mode === "many_operations" ? 129 : 2,
            );
          const area = path.join(root, ".crdd", "domain-model");
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
              operation.history.confirmed = false;
            fs.writeFileSync(file, `${canonicalJson(state)}\n`);
          }
          return mode === "cancelled"
            ? { ...result, status: "cancelled", reason: "fixture_cancelled" }
            : result;
        },
      },
      input,
    );
    assert.equal(starts, 1);
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
        path.join(root, ".crdd", "domain-model", "state.json"),
        "utf8",
      ),
    );
    const committed = confirmed || mode === "save_after_effect";
    assert.equal(snapshot.operations.length, committed ? 0 : 2);
    for (const key of ["pendingDeliveries", "resultReceipts"])
      assert.equal(Object.hasOwn(snapshot, key), false);
    const stored = persistence.state.readState("project-a");
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
  Parameters<typeof runCoordinatorOperationWithPorts>[0],
  "persistence" | "clockIdentity" | "processSafety"
> &
  Readonly<{
    persistence?: Parameters<
      typeof runCoordinatorOperationWithPorts
    >[0]["persistence"];
    now?: () => Readonly<{ monotonicMs: number; iso: string }>;
    poisonAfterCleanupUnknown?: () => void;
  }>;
type BoundExecutionInput = Parameters<
  typeof runCoordinatorOperationWithPorts
>[1] &
  Readonly<{ workingDirectory: string; repositoryBindingId: string }>;

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
function runCoordinatorOperation(
  dependencies: BoundExecutionDependencies,
  input: BoundExecutionInput,
) {
  const { workingDirectory, repositoryBindingId, ...applicationInput } = input;
  const {
    now,
    poisonAfterCleanupUnknown,
    persistence,
    ...applicationDependencies
  } = dependencies;
  return runCoordinatorOperationWithPorts(
    {
      ...applicationDependencies,
      ...createCoordinatorExecutionHostPorts({
        ...(now ? { now } : {}),
        ...(poisonAfterCleanupUnknown ? { poisonAfterCleanupUnknown } : {}),
      }),
      persistence:
        persistence ??
        createCurrentCoordinatorPersistencePorts(
          workingDirectory,
          repositoryBindingId,
        ),
    },
    applicationInput,
  );
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
    verifyRuntimePersistenceRepository(root),
    "binding-a",
  );
  assert.equal(initialized.status, "completed", initialized.reason);
  const created = createCoordinatorState({
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
  const saved = writeCoordinatorState(root, "binding-a", created.state, 0);
  assert.equal(saved.status, "completed", saved.reason);
  const queued = enqueueProjectOperation(root, "binding-a", {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: hash("request"),
    originLane: "interactive",
    repositoryRevision: revision,
    scopeHash: hash("scope"),
  });
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
    contract: "crdd-coordinator/orchestrator-single-task-adapter",
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
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed", JSON.stringify(outcome));
  assert.equal(
    outcome.reason,
    "orchestrator_tasks_completed_integration_pending",
  );
  assert.equal(effects, 1);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
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
  assert.equal(replay.reason, "orchestrator_tasks_already_integration_pending");
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
test("interactive Queue wins a fresh binding-wide selection before a scheduled caller can claim", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-scheduled",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("scheduled-request"),
      originLane: "scheduled",
      repositoryRevision: revision,
      scopeHash: hash("scheduled-scope"),
    }).status,
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
  assert.equal(scheduled.reason, "orchestrator_queue_claim_priority_changed");
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
        runCoordinatorSingleTaskAttempt(
          {
            startTask: (
              _request,
              _root,
              _correlation,
              notifyStarted,
              workspaceTarget,
            ) => {
              starts += 1;
              assert.deepEqual(workspaceTarget, {
                workspaceId: null,
                ownerRepositoryRoot: attempt.ownerRepositoryRoot,
                executionTree: attempt.executionTree,
                baseCommit: null,
                head: null,
              });
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
 * @stimulus PR-A-03 rejects a result from another attempt without projecting successの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 rejects a result from another attempt without projecting success", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => ({
        ...(await completed(attempt)),
        attemptId: "another-attempt",
      }),
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "orchestrator_task_recovery_required");
  assert.equal(outcome.manualRecoveryRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "recovery_required",
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
      assert.equal(outcome.reason, "orchestrator_task_recovery_required");
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
      assert.equal(outcome.reason, "orchestrator_task_recovery_required");
      const state = readCoordinatorState(root, "binding-a", "project-a");
      assert.equal(state.status, "completed");
      assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
      assert.equal(
        state.value?.tasks[0]?.recoveryObligations[0]?.kind,
        "runtime_process",
      );
    });
  }
});

/**
 * 下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しないを検証する。
 *
 * @responsibility 下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const forged = `runtime-process.11111111-1111-4111-8111-111111111111.restart-${"a".repeat(40)}`;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) =>
        ({
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
            { kind: "runtime_process" as const, recoveryId: forged },
          ],
        }) as unknown as CoordinatorSingleTaskResult,
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(outcome.processRestartRequired, true);
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  assert.equal(
    state.value?.tasks[0]?.recoveryObligations[0]?.kind,
    "runtime_process",
  );
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
    ["candidate", "runtime_process"],
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
          "runtime_process",
        );
        assert.match(
          state.value.tasks[0]?.recoveryObligations[0]?.recoveryId ?? "",
          /^runtime-process\.[0-9a-f-]{36}\.restart-[0-9a-f]{40}$/u,
        );
      }
    });
  }
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
 * runtime_process義務は同じTask attemptとoperationにだけ結合するを検証する。
 *
 * @responsibility runtime_process義務は同じTask attemptとoperationにだけ結合するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus runtime_process義務は同じTask attemptとoperationにだけ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("runtime_process義務は同じTask attemptとoperationにだけ結合する", async (t) => {
  const { root, input } = fixture(t, [task("task-a"), task("task-b")], 2);
  let firstRecoveryId = "";
  const outcome = await runCoordinatorOperation(
    {
      poisonAfterCleanupUnknown: () => undefined,
      runSingleTaskAttempt: async (attempt) => {
        await attempt.observeStarted?.();
        if ((attempt.taskRequest as { taskId: string }).taskId === "task-a") {
          firstRecoveryId = createRuntimeProcessRecoveryIdentity(
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
            { kind: "runtime_process" as const, recoveryId: firstRecoveryId },
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
      "runtime_process",
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
  const location = path.join(root, ".crdd", "domain-model", "state.json");
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
  const locks = path.join(root, ".crdd", "tmp", "orchestrator-leases");
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
  const reconciled = createCurrentCoordinatorPersistencePorts(
    root,
    "binding-a",
  ).lease.reconcileOperationOwnerLoss("project-a", "queue-a", () => {
    throw new Error("released evidence must avoid owner observation");
  });
  assert.equal(reconciled.status, "completed");
  assert.equal(
    reconciled.status === "completed" && reconciled.value.ownerGeneration,
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
  assert.equal(outcome.reason, "orchestrator_task_recovery_required");
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
  for (const name of ["lstatSync", "fstatSync"] as const) {
    const original = fs[name];
    t.mock.method(fs, name, (...args: unknown[]) => {
      const metadata = Reflect.apply(original, fs, args) as fs.BigIntStats;
      if (typeof metadata.ino === "bigint")
        metadata.ino = BigInt.asIntN(64, metadata.ino | (1n << 63n));
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
  const persistence = createCurrentCoordinatorPersistencePorts(
    root,
    "binding-a",
  );
  const outcome = await runCoordinatorOperation(
    {
      persistence: {
        ...persistence,
        state: {
          ...persistence.state,
          writeState: (...args) => {
            const result = persistence.state.writeState(...args);
            if (
              result.status === "completed" &&
              args[0].tasks.some(
                (entry) =>
                  entry.state === "starting" &&
                  entry.startPhase === "handoff_prepared",
              )
            ) {
              preparedObserved = true;
              controller.abort();
            }
            return result;
          },
        },
      },
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
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
test("contract remains a partial Coordinator task-management capability", () => {
  assert.deepEqual(describeCoordinatorExecutionContract(), {
    contract: "crdd-coordinator/orchestrator-execution/v1",
    maximumConcurrency: 5,
    externalWaitWhileMutationLockHeld: false,
    cleanupUnknownDisposition: "durable_recovery_and_reservation_retained",
    staleOrOwnedQueueDisposition: "effect_zero_manual_reconciliation",
    taskManagementCapabilityComplete: false,
  });
});

// EIの保存・診断失敗は新しいProvider境界の試験で確認する。
