import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectRuntimeState,
  inspectProjectRuntimeStateQuery,
  inspectProjectRuntimeStateQueryResult,
  queryProjectRuntimeState,
  type ProjectRuntimeState,
  type ProjectRuntimeStatePort,
} from "../../src/index.ts";

const revision = "a".repeat(40);
const request = Object.freeze({
  requestId: "query-a",
  projectId: "project-a",
  repositoryRevision: revision,
});

function runtimeState(): ProjectRuntimeState {
  const created = createProjectRuntimeState({
    projectId: request.projectId,
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["Objectiveが受理される"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["Taskが完了する"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  assert.ok(created.state);
  return created.state;
}

function reader(
  result: ReturnType<ProjectRuntimeStatePort["readState"]>,
): Pick<ProjectRuntimeStatePort, "readState"> {
  return Object.freeze({ readState: () => result });
}

test("状態参照は閉じた要求だけを受け入れる", () => {
  assert.deepEqual(inspectProjectRuntimeStateQuery(request), request);
  assert.equal(
    inspectProjectRuntimeStateQuery({ ...request, unexpected: true }),
    null,
  );
});

test("状態参照はProject Runtimeのcanonical投影だけを返す", () => {
  const result = queryProjectRuntimeState(
    reader({ status: "completed", reason: "observed", value: runtimeState() }),
    request,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "observed");
  assert.equal(result.projection?.projectId, request.projectId);
  assert.equal(result.effectState, "no_effect");
  assert.deepEqual(inspectProjectRuntimeStateQueryResult(result), result);
});

test("状態不存在は失敗や成功推定ではなくabsent観測として返す", () => {
  const result = queryProjectRuntimeState(
    reader({ status: "completed", reason: "absent", value: null }),
    request,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "absent");
  assert.equal(result.projection, null);
});

test("異なるRepository改訂版の状態を現在値として返さない", () => {
  const result = queryProjectRuntimeState(
    reader({
      status: "completed",
      reason: "observed",
      value: { ...runtimeState(), repositoryRevision: "b".repeat(40) },
    }),
    request,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "project_runtime_state_revision_mismatch");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.projection, null);
});

test("観測不能と既存Recovery義務をEffect発行と混同しない", () => {
  const result = queryProjectRuntimeState(
    reader({
      status: "blocked",
      reason: "store_unavailable",
      value: null,
      manualRecoveryRequired: true,
      recoveryId: "recovery-a",
    }),
    request,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.effectState, "no_effect");
});
