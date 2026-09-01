import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createProjectRuntimeState,
  describeProjectRuntimeStateContract,
  observeProjectTaskStarted,
  reserveProjectTaskStart,
  selectSchedulableProjectTasks,
  settleProjectTask,
  type ProjectRuntimeState,
  type ProjectTaskDefinition,
} from "../src/security/project-runtime-state.ts";

const revision = "a".repeat(40);

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

function stateFor(
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  const result = createProjectRuntimeState({
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: revision,
    maximumConcurrency,
    tasks,
    ownerGeneration: "owner-1",
  });
  assert.equal(result.status, "completed");
  assert.ok(result.state);
  return result.state;
}

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
  );
  assert.equal(reserved.status, "completed");
  assert.ok(reserved.state);
  const observed = observeProjectTaskStarted(
    reserved.state,
    reserved.state.generation,
    taskId,
    attemptId,
    `operation-${taskId}`,
  );
  assert.equal(observed.status, "completed");
  assert.ok(observed.state);
  return observed.state;
}

describe("Project Runtime state contract", () => {
  it("7件の独立Taskから最大5件だけを選ぶ", () => {
    const state = stateFor(
      Array.from({ length: 7 }, (_, index) => task(`task-${index + 1}`)),
    );
    assert.deepEqual(selectSchedulableProjectTasks(state), [
      "task-1",
      "task-2",
      "task-3",
      "task-4",
      "task-5",
    ]);
  });

  it("Dependency完了後だけ後続Taskをreadyへ進める", () => {
    let state = stateFor([task("task-a"), task("task-b", ["task-a"])]);
    assert.deepEqual(selectSchedulableProjectTasks(state), ["task-a"]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryId: null,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), ["task-b"]);
  });

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

  it("cleanup不明のTaskを空き枠へ補正しない", () => {
    let state = stateFor([task("task-a"), task("task-b")], 1);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      outcome: "failed",
      cleanupConfirmed: false,
      recoveryId: null,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), []);
  });

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
      outcome: "recovery_required",
      cleanupConfirmed: true,
      recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), ["task-c"]);
  });

  it("古い世代と別attemptの結果を反映しない", () => {
    const initial = stateFor([task("task-a")]);
    const state = start(initial, "task-a");
    assert.equal(
      settleProjectTask(state, initial.generation, {
        taskId: "task-a",
        attemptId: "wrong-attempt",
        operationId: "operation-task-a",
        outcome: "completed",
        cleanupConfirmed: true,
        recoveryId: null,
      }).reason,
      "project_runtime_task_settlement_mismatch",
    );
  });

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
        tasks,
      });
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "project_runtime_task_graph_invalid");
      assert.equal(result.state, null);
    }
  });

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
    });
  });
});
