/**
 * project-runtime:unit:stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility project-runtime:unit:stateが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope project、runtime、state
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acknowledgeProjectDockerRecoveryObligation,
  applyProjectRuntimePartialReplan,
  createProjectRuntimeState,
  describeProjectRuntimeStateContract,
  markProjectTaskRecoveryObligationRecovering,
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  projectProjectRuntimeState,
  recordMilestoneIntegration,
  recordObjectiveIntegration,
  recordProjectTaskOwnerLossRecoveries,
  retrySettledProjectTaskRecoveries,
  reserveProjectTaskStart,
  selectSchedulableProjectTasks,
  settleProjectTask,
  settleProjectTaskRecoveryObligation,
  type ProjectRuntimeState,
  type ProjectTaskDefinition,
} from "../../src/index.ts";

const revision = "a".repeat(40);

/**
 * taskのTest準備責務を実行する。
 *
 * @responsibility taskがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus taskを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function task(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return Object.freeze({
    id,
    objectiveId: "objective-1",
    dependencies,
    allowedPaths,
    conflictKeys,
  });
}

/**
 * stateForのTest準備責務を実行する。
 *
 * @responsibility stateForがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus stateForを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function stateFor(
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  const result = createProjectRuntimeState({
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: revision,
    maximumConcurrency,
    milestoneAcceptanceCriteria: ["全Objectiveの統合結果が整合する"],
    objectives: [
      {
        id: "objective-1",
        acceptanceCriteria: ["必要Taskの結果が統合される"],
      },
    ],
    tasks,
    ownerGeneration: "owner-1",
  });
  assert.equal(result.status, "completed");
  assert.ok(result.state);
  return result.state;
}

/**
 * startのTest準備責務を実行する。
 *
 * @responsibility startがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus startを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function start(
  state: ProjectRuntimeState,
  taskId: string,
  attemptId = `attempt-${taskId}`,
) {
  const reserved = reserveProjectTaskStart(
    state,
    state.generation,
    taskId,
    attemptId,
    `authority-${taskId}`,
  );
  assert.equal(reserved.status, "completed");
  assert.ok(reserved.state);
  const prepared = prepareProjectTaskHandoff(
    reserved.state,
    reserved.state.generation,
    taskId,
    attemptId,
    `operation-${taskId}`,
  );
  assert.equal(prepared.status, "completed");
  assert.ok(prepared.state);
  const observed = observeProjectTaskStarted(
    prepared.state,
    prepared.state.generation,
    taskId,
    attemptId,
    `operation-${taskId}`,
  );
  assert.equal(observed.status, "completed");
  assert.ok(observed.state);
  return observed.state;
}

describe("Project Runtime state contract", () => {
  /**
   * Hostが有効なowner generationを供給しない場合は状態を作らないを検証する。
   *
   * @responsibility Hostが有効なowner generationを供給しない場合は状態を作らないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Hostが有効なowner generationを供給しない場合は状態を作らないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Hostが有効なowner generationを供給しない場合は状態を作らない", () => {
    const state = createProjectRuntimeState({
      projectId: "crdd",
      milestoneId: "v0.20",
      repositoryRevision: revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["全Taskが完了する"],
      objectives: [
        { id: "objective-1", acceptanceCriteria: ["結果が受理される"] },
      ],
      tasks: [task("task-1")],
      ownerGeneration: "",
    });

    assert.equal(state.status, "blocked");
    assert.equal(state.reason, "project_runtime_input_invalid");
    assert.equal(state.state, null);
  });

  /**
   * 受入条件の説明文をPathとして正規化しないを検証する。
   *
   * @responsibility 受入条件の説明文をPathとして正規化しないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 受入条件の説明文をPathとして正規化しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("受入条件の説明文をPathとして正規化しない", () => {
    const state = createProjectRuntimeState({
      projectId: "crdd",
      milestoneId: "v0.19",
      repositoryRevision: revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["末尾は\\nである"],
      objectives: [
        { id: "objective-1", acceptanceCriteria: ["値はC:\\workである"] },
      ],
      tasks: [task("task-1", [], ["src\\file.ts"])],
      ownerGeneration: "owner-1",
    });
    assert.equal(state.status, "completed");
    assert.equal(
      state.state?.milestone.acceptanceCriteria[0],
      "末尾は\\nである",
    );
    assert.equal(
      state.state?.objectives[0]?.definition.acceptanceCriteria[0],
      "値はC:\\workである",
    );
    assert.equal(
      state.state?.tasks[0]?.definition.allowedPaths[0],
      "src/file.ts",
    );
  });

  /**
   * Task定義のRepository外Pathを状態へ取り込まないを検証する。
   *
   * @responsibility Task定義のRepository外Pathを状態へ取り込まないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Task定義のRepository外Pathを状態へ取り込まないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Task定義のRepository外Pathを状態へ取り込まない", () => {
    for (const pathValue of ["C:\\outside", "/outside", "../outside"]) {
      const state = createProjectRuntimeState({
        projectId: "crdd",
        milestoneId: "v0.20",
        repositoryRevision: revision,
        maximumConcurrency: 1,
        milestoneAcceptanceCriteria: ["全Taskが完了する"],
        objectives: [
          { id: "objective-1", acceptanceCriteria: ["結果が受理される"] },
        ],
        tasks: [task("task-1", [], [pathValue])],
        ownerGeneration: "owner-1",
      });
      assert.equal(state.status, "blocked");
      assert.equal(state.reason, "project_runtime_task_definition_invalid");
      assert.equal(state.state, null);
    }
  });

  /**
   * 7件の独立Taskから最大5件だけを選ぶを検証する。
   *
   * @responsibility 7件の独立Taskから最大5件だけを選ぶの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 7件の独立Taskから最大5件だけを選ぶの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("7件の独立Taskから最大5件だけを選ぶ", () => {
    const state = stateFor(
      Array.from({ length: 7 }, (_unused, index) => task(`task-${index + 1}`)),
    );
    assert.deepEqual(selectSchedulableProjectTasks(state), [
      "task-1",
      "task-2",
      "task-3",
      "task-4",
      "task-5",
    ]);
  });

  /**
   * Dependency完了後だけ後続Taskをreadyへ進めるを検証する。
   *
   * @responsibility Dependency完了後だけ後続Taskをreadyへ進めるの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Dependency完了後だけ後続Taskをreadyへ進めるの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Dependency完了後だけ後続Taskをreadyへ進める", () => {
    let state = stateFor([task("task-a"), task("task-b", ["task-a"])]);
    assert.deepEqual(selectSchedulableProjectTasks(state), ["task-a"]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), ["task-b"]);
  });

  /**
   * 同じPathまたはConflict keyのTaskを同時に選ばないを検証する。
   *
   * @responsibility 同じPathまたはConflict keyのTaskを同時に選ばないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 同じPathまたはConflict keyのTaskを同時に選ばないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("同じPathまたはConflict keyのTaskを同時に選ばない", () => {
    const state = stateFor([
      task("task-a", [], ["shared/file.txt"]),
      task("task-b", [], ["shared/file.txt"]),
      task("task-c", [], ["other.txt"], ["schema-x"]),
      task("task-d", [], ["more.txt"], ["schema-x"]),
    ]);
    assert.deepEqual(selectSchedulableProjectTasks(state), [
      "task-a",
      "task-c",
    ]);
  });

  /**
   * 親Directoryと子Pathを競合として扱うを検証する。
   *
   * @responsibility 親Directoryと子Pathを競合として扱うの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 親Directoryと子Pathを競合として扱うの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("親Directoryと子Pathを競合として扱う", () => {
    const state = stateFor([
      task("task-a", [], ["src"]),
      task("task-b", [], ["src/runtime/file.ts"]),
      task("task-c", [], ["docs/file.md"]),
    ]);
    assert.deepEqual(selectSchedulableProjectTasks(state), [
      "task-a",
      "task-c",
    ]);
  });

  /**
   * cleanup不明のTaskを空き枠へ補正しないを検証する。
   *
   * @responsibility cleanup不明のTaskを空き枠へ補正しないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus cleanup不明のTaskを空き枠へ補正しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("cleanup不明のTaskを空き枠へ補正しない", () => {
    let state = stateFor([task("task-a"), task("task-b")], 1);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "failed",
      cleanupConfirmed: false,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), []);
  });

  /**
   * 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するを検証する。
   *
   * @responsibility 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影する", () => {
    let state = stateFor([task("task-a")], 1);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "cancelled",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    const projection = projectProjectRuntimeState(settled.state);
    assert.equal(projection.milestoneState, "cancelled");
    assert.equal(projection.objectiveCounts.cancelled, 1);
    assert.equal(projection.taskCounts.cancelled, 1);
    assert.equal(projection.nextAction, "wait_for_task");
  });

  /**
   * Recovery中はcleanup後も競合予約を維持するを検証する。
   *
   * @responsibility Recovery中はcleanup後も競合予約を維持するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Recovery中はcleanup後も競合予約を維持するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Recovery中はcleanup後も競合予約を維持する", () => {
    let state = stateFor([
      task("task-a", [], ["shared/file.txt"]),
      task("task-b", [], ["shared/file.txt"]),
      task("task-c"),
    ]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "recovery_required",
      cleanupConfirmed: true,
      recoveryObligations: [
        {
          kind: "docker",
          recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
          phase: "required",
        },
      ],
      recoveryUnresolved: false,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), ["task-c"]);
  });

  /**
   * 古い世代と別attemptの結果を反映しないを検証する。
   *
   * @responsibility 古い世代と別attemptの結果を反映しないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 古い世代と別attemptの結果を反映しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("古い世代と別attemptの結果を反映しない", () => {
    const initial = stateFor([task("task-a")]);
    const state = start(initial, "task-a");
    assert.equal(
      settleProjectTask(state, initial.generation, {
        taskId: "task-a",
        attemptId: "wrong-attempt",
        operationId: "operation-task-a",
        authorityBindingId: "authority-task-a",
        outcome: "completed",
        cleanupConfirmed: true,
        recoveryObligations: [],
        recoveryUnresolved: false,
      }).reason,
      "project_runtime_task_settlement_mismatch",
    );
  });

  /**
   * cycleと欠落DependencyをEffect前に拒否するを検証する。
   *
   * @responsibility cycleと欠落DependencyをEffect前に拒否するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus cycleと欠落DependencyをEffect前に拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("cycleと欠落DependencyをEffect前に拒否する", () => {
    for (const tasks of [
      [task("task-a", ["task-b"]), task("task-b", ["task-a"])],
      [task("task-a", ["missing"])],
    ]) {
      const result = createProjectRuntimeState({
        projectId: "crdd",
        milestoneId: "v0.19",
        repositoryRevision: revision,
        maximumConcurrency: 5,
        milestoneAcceptanceCriteria: ["全体が整合する"],
        objectives: [
          {
            id: "objective-1",
            acceptanceCriteria: ["必要Taskが統合される"],
          },
        ],
        tasks,
        ownerGeneration: "owner-1",
      });
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "project_runtime_task_graph_invalid");
      assert.equal(result.state, null);
    }
  });

  /**
   * Task完了だけではObjectiveまたはMilestoneを受け入れないを検証する。
   *
   * @responsibility Task完了だけではObjectiveまたはMilestoneを受け入れないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Task完了だけではObjectiveまたはMilestoneを受け入れないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Task完了だけではObjectiveまたはMilestoneを受け入れない", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.equal(settled.state.objectives[0]?.state, "integration_pending");
    assert.equal(settled.state.milestone.state, "executing");
    assert.deepEqual(projectProjectRuntimeState(settled.state), {
      projectId: "crdd",
      milestoneId: "v0.19",
      generation: 5,
      milestoneState: "executing",
      objectiveCounts: {
        planned: 0,
        executing: 0,
        integration_pending: 1,
        accepted: 0,
        blocked: 0,
        cancelled: 0,
      },
      taskCounts: {
        planned: 0,
        waiting_dependency: 0,
        ready: 0,
        starting: 0,
        running: 0,
        cleanup_pending: 0,
        completed: 1,
        failed: 0,
        cancelled: 0,
        recovery_required: 0,
        superseded: 0,
      },
      objectiveTaskSummaries: [
        {
          objectiveId: "objective-1",
          objectiveState: "integration_pending",
          taskCounts: {
            planned: 0,
            waiting_dependency: 0,
            ready: 0,
            starting: 0,
            running: 0,
            cleanup_pending: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            recovery_required: 0,
            superseded: 0,
          },
        },
      ],
      workProgress: "tasks_complete",
      qualityState: "integration_pending",
      humanDecisionRequired: false,
      recoveryRequired: false,
      nextAction: "verify_objective_integration",
    });
  });

  /**
   * ObjectiveとMilestoneを別々の統合Evidenceで受け入れるを検証する。
   *
   * @responsibility ObjectiveとMilestoneを別々の統合Evidenceで受け入れるの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus ObjectiveとMilestoneを別々の統合Evidenceで受け入れるの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("ObjectiveとMilestoneを別々の統合Evidenceで受け入れる", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    const objective = recordObjectiveIntegration(
      settled.state,
      settled.state.generation,
      "objective-1",
      { accepted: true, criterionEvidenceIds: ["evidence-objective-1"] },
    );
    assert.equal(objective.status, "completed");
    assert.ok(objective.state);
    assert.equal(objective.state.objectives[0]?.state, "accepted");
    assert.equal(objective.state.milestone.state, "integrating");
    assert.equal(
      projectProjectRuntimeState(objective.state).nextAction,
      "verify_milestone_integration",
    );
    const milestone = recordMilestoneIntegration(
      objective.state,
      objective.state.generation,
      ["evidence-milestone-1"],
    );
    assert.equal(milestone.status, "completed");
    assert.ok(milestone.state);
    assert.equal(milestone.state.milestone.state, "accepted");
    assert.equal(
      projectProjectRuntimeState(milestone.state).qualityState,
      "accepted",
    );
  });

  /**
   * 依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達するを検証する。
   *
   * @responsibility 依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達する", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const failed = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "failed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(failed.state);
    const replanned = applyProjectRuntimePartialReplan(
      failed.state,
      failed.state.generation,
      {
        failedTaskId: "task-a",
        replacements: [task("task-b")],
        maximumReplans: 1,
      },
    );
    assert.equal(replanned.status, "completed");
    assert.ok(replanned.state);
    state = start(replanned.state, "task-b");
    const completed = settleProjectTask(state, state.generation, {
      taskId: "task-b",
      attemptId: "attempt-task-b",
      operationId: "operation-task-b",
      authorityBindingId: "authority-task-b",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(completed.state);
    assert.deepEqual(
      completed.state.tasks.map((entry) => [entry.definition.id, entry.state]),
      [
        ["task-a", "superseded"],
        ["task-b", "completed"],
      ],
    );
    assert.equal(completed.state.objectives[0]?.state, "integration_pending");
    assert.equal(
      projectProjectRuntimeState(completed.state).workProgress,
      "tasks_complete",
    );
    const objective = recordObjectiveIntegration(
      completed.state,
      completed.state.generation,
      "objective-1",
      { accepted: true, criterionEvidenceIds: ["evidence-objective-replan"] },
    );
    assert.ok(objective.state);
    const milestone = recordMilestoneIntegration(
      objective.state,
      objective.state.generation,
      ["evidence-milestone-replan"],
    );
    assert.ok(milestone.state);
    const projection = projectProjectRuntimeState(milestone.state);
    assert.equal(projection.milestoneState, "accepted");
    assert.equal(projection.workProgress, "tasks_complete");
    assert.equal(projection.qualityState, "accepted");
  });

  /**
   * 生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えないを検証する。
   *
   * @responsibility 生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えない", () => {
    let state = stateFor([task("task-a"), task("task-b", ["task-a"])]);
    state = start(state, "task-a");
    const failed = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "failed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(failed.state);
    const before = JSON.stringify(failed.state);
    const rejected = applyProjectRuntimePartialReplan(
      failed.state,
      failed.state.generation,
      {
        failedTaskId: "task-a",
        replacements: [task("task-c")],
        maximumReplans: 1,
      },
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(
      rejected.reason,
      "project_runtime_replan_invalid_or_out_of_scope",
    );
    assert.equal(JSON.stringify(rejected.state), before);
    assert.deepEqual(rejected.taskIds, []);
  });

  /**
   * 古い世代と統合待ち前の受入を拒否するを検証する。
   *
   * @responsibility 古い世代と統合待ち前の受入を拒否するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 古い世代と統合待ち前の受入を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("古い世代と統合待ち前の受入を拒否する", () => {
    const state = stateFor([task("task-a")]);
    assert.equal(
      recordObjectiveIntegration(state, state.generation, "objective-1", {
        accepted: true,
        criterionEvidenceIds: ["evidence-objective-1"],
      }).reason,
      "project_runtime_objective_integration_mismatch",
    );
    assert.equal(
      recordMilestoneIntegration(state, state.generation - 1, [
        "evidence-milestone-1",
      ]).reason,
      "project_runtime_milestone_integration_mismatch",
    );
  });

  /**
   * 受入条件ごとのEvidenceが不足する場合は受入を拒否するを検証する。
   *
   * @responsibility 受入条件ごとのEvidenceが不足する場合は受入を拒否するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 受入条件ごとのEvidenceが不足する場合は受入を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("受入条件ごとのEvidenceが不足する場合は受入を拒否する", () => {
    const created = createProjectRuntimeState({
      projectId: "crdd",
      milestoneId: "v0.19",
      repositoryRevision: revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["条件A", "条件B"],
      objectives: [
        {
          id: "objective-1",
          acceptanceCriteria: ["条件1", "条件2"],
        },
      ],
      tasks: [task("task-a")],
      ownerGeneration: "owner-1",
    });
    assert.ok(created.state);
    const state = start(created.state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    assert.equal(
      recordObjectiveIntegration(
        settled.state,
        settled.state.generation,
        "objective-1",
        { accepted: true, criterionEvidenceIds: ["evidence-only-one"] },
      ).reason,
      "project_runtime_objective_integration_mismatch",
    );
  });

  /**
   * Recoveryを進捗や品質の成功へ補正しないを検証する。
   *
   * @responsibility Recoveryを進捗や品質の成功へ補正しないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Recoveryを進捗や品質の成功へ補正しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Recoveryを進捗や品質の成功へ補正しない", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "recovery_required",
      cleanupConfirmed: false,
      recoveryObligations: [
        {
          kind: "docker",
          recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
          phase: "required",
        },
      ],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    const projection = projectProjectRuntimeState(settled.state);
    assert.equal(projection.workProgress, "in_progress");
    assert.equal(projection.qualityState, "blocked");
    assert.equal(projection.recoveryRequired, true);
    assert.equal(projection.nextAction, "recover");
  });

  /**
   * owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻すを検証する。
   *
   * @responsibility owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻すの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻すの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻す", () => {
    const state = stateFor([task("task-a")]);
    const reserved = reserveProjectTaskStart(
      state,
      state.generation,
      "task-a",
      "attempt-task-a",
      "authority-task-a",
    );
    assert.ok(reserved.state);
    const recovered = recordProjectTaskOwnerLossRecoveries(
      reserved.state,
      reserved.state.generation,
      [],
    );
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.state?.tasks[0]?.state, "ready");
    assert.equal(recovered.state?.tasks[0]?.operationId, null);
    assert.deepEqual(recovered.state?.tasks[0]?.recoveryObligations, []);
    assert.equal(recovered.state?.milestone.state, "executing");
  });

  /**
   * owner lossは開始済みTaskをexact Runtime Recoveryへ結合するを検証する。
   *
   * @responsibility owner lossは開始済みTaskをexact Runtime Recoveryへ結合するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus owner lossは開始済みTaskをexact Runtime Recoveryへ結合するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("owner lossは開始済みTaskをexact Runtime Recoveryへ結合する", () => {
    const running = start(stateFor([task("task-a")]), "task-a");
    const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
    const recovered = recordProjectTaskOwnerLossRecoveries(
      running,
      running.generation,
      [
        {
          operationId: "operation-task-a",
          status: "matched",
          recoveryId,
        },
      ],
    );
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.state?.tasks[0]?.state, "recovery_required");
    assert.deepEqual(recovered.state?.tasks[0]?.recoveryObligations, [
      { kind: "docker", recoveryId, phase: "required" },
    ]);
    assert.equal(recovered.state?.milestone.state, "recovery_required");
  });

  /**
   * handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻すを検証する。
   *
   * @responsibility handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻すの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻すの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻す", () => {
    const initial = stateFor([task("task-a")]);
    const reserved = reserveProjectTaskStart(
      initial,
      initial.generation,
      "task-a",
      "attempt-task-a",
      "authority-task-a",
    );
    assert.ok(reserved.state);
    const prepared = prepareProjectTaskHandoff(
      reserved.state,
      reserved.state.generation,
      "task-a",
      "attempt-task-a",
      "operation-task-a",
    );
    assert.ok(prepared.state);
    const recovered = recordProjectTaskOwnerLossRecoveries(
      prepared.state,
      prepared.state.generation,
      [
        {
          operationId: "operation-task-a",
          status: "verified_absent",
          recoveryId: null,
        },
      ],
    );
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.state?.tasks[0]?.state, "ready");
    assert.deepEqual(recovered.state?.tasks[0]?.recoveryObligations, []);
  });

  /**
   * running Taskを不存在観測だけでreadyへ戻さないを検証する。
   *
   * @responsibility running Taskを不存在観測だけでreadyへ戻さないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus running Taskを不存在観測だけでreadyへ戻さないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("running Taskを不存在観測だけでreadyへ戻さない", () => {
    const running = start(stateFor([task("task-a")]), "task-a");
    const recovered = recordProjectTaskOwnerLossRecoveries(
      running,
      running.generation,
      [
        {
          operationId: "operation-task-a",
          status: "verified_absent",
          recoveryId: null,
        },
      ],
    );
    assert.equal(recovered.status, "blocked");
    assert.equal(recovered.state?.tasks[0]?.state, "running");
  });

  /**
   * 複数種のRecoveryを項目ごとの受領状態で保持するを検証する。
   *
   * @responsibility 複数種のRecoveryを項目ごとの受領状態で保持するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 複数種のRecoveryを項目ごとの受領状態で保持するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("複数種のRecoveryを項目ごとの受領状態で保持する", () => {
    let state = start(stateFor([task("task-a")]), "task-a");
    const dockerId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
    const hostId = `host-task.${"d".repeat(64)}`;
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "recovery_required",
      cleanupConfirmed: false,
      recoveryObligations: [
        { kind: "docker", recoveryId: dockerId, phase: "required" },
        { kind: "host", recoveryId: hostId, phase: "required" },
      ],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    state = settled.state;
    const recovering = markProjectTaskRecoveryObligationRecovering(
      state,
      state.generation,
      "task-a",
      "docker",
      dockerId,
    );
    assert.ok(recovering.state);
    const itemSettled = settleProjectTaskRecoveryObligation(
      recovering.state,
      recovering.state.generation,
      "task-a",
      "docker",
      dockerId,
    );
    assert.ok(itemSettled.state);
    assert.deepEqual(itemSettled.state.tasks[0]?.recoveryObligations, [
      { kind: "docker", recoveryId: dockerId, phase: "settled" },
      { kind: "host", recoveryId: hostId, phase: "required" },
    ]);
    const acknowledged = acknowledgeProjectDockerRecoveryObligation(
      itemSettled.state,
      itemSettled.state.generation,
      {
        repositoryBindingId: "binding-a",
        projectId: "crdd",
        milestoneId: "v0.19",
        taskId: "task-a",
        attemptId: "attempt-task-a",
        operationId: "operation-task-a",
        recoveryId: dockerId,
        settlementGeneration: itemSettled.state.generation,
        runtimeStateBinding: {
          runtimeStateIdentityHash: "1".repeat(64),
          runtimeStateProtectionHash: "2".repeat(64),
          localUserBindingHash: "3".repeat(64),
          runtimeStateBindingHash: "4".repeat(64),
        },
        receiptContentHash: "5".repeat(64),
        receiptContentIdentity: "1:2:3",
      },
    );
    assert.equal(acknowledged.status, "completed");
    assert.equal(
      acknowledged.state?.tasks[0]?.recoveryObligations[0]?.phase,
      "acknowledged",
    );
    assert.equal(
      acknowledged.state?.tasks[0]?.recoveryObligations[0]?.acknowledgement
        ?.operationId,
      "operation-task-a",
    );
    assert.equal(
      retrySettledProjectTaskRecoveries(
        acknowledged.state ?? itemSettled.state,
        acknowledged.state?.generation ?? itemSettled.state.generation,
        ["task-a"],
      ).status,
      "blocked",
    );
  });

  /**
   * Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さないを検証する。
   *
   * @responsibility Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さない", () => {
    let state = start(stateFor([task("task-a")]), "task-a");
    const runtimeProcessId = `runtime-process.11111111-1111-4111-8111-111111111111.restart-${"a".repeat(40)}`;
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "recovery_required",
      cleanupConfirmed: false,
      recoveryObligations: [
        {
          kind: "runtime_process",
          recoveryId: runtimeProcessId,
          phase: "required",
        },
      ],
      recoveryUnresolved: true,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    state = settled.state;
    const retry = retrySettledProjectTaskRecoveries(state, state.generation, [
      "task-a",
    ]);
    assert.equal(retry.status, "blocked");
    assert.equal(retry.state?.tasks[0]?.state, "recovery_required");
  });

  /**
   * Lockとstale resultの保持条件を説明するを検証する。
   *
   * @responsibility Lockとstale resultの保持条件を説明するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Lockとstale resultの保持条件を説明するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
   */
  it("Lockとstale resultの保持条件を説明する", () => {
    assert.deepEqual(describeProjectRuntimeStateContract(), {
      contract: "crdd-coordinator/project-runtime-state/v1",
      maximumConcurrency: 5,
      capacityStates: [
        "starting",
        "running",
        "cleanup_pending",
        "recovery_required_without_cleanup",
      ],
      lockContract:
        "project_operation_then_short_project_state_transaction_never_held_across_single_task_runtime",
      staleResult:
        "generation_attempt_and_operation_identity_mismatch_blocks_without_projection",
      acceptanceContract:
        "task_completion_then_objective_integration_then_milestone_integration",
    });
  });
});
