import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectRuntimeObjectiveResult,
  inspectProjectRuntimeObjectivePlan,
  inspectProjectRuntimeObjectiveRequest,
  PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
} from "../../src/index.ts";

const objectiveRequest = Object.freeze({
  requestId: "request-a",
  projectId: "project-a",
  milestoneId: "milestone-a",
  repositoryRevision: "a".repeat(40),
  objective: "限定された成果物を更新する",
  acceptanceCriteria: Object.freeze(["成果物が受入条件を満たす"]),
  allowedPaths: Object.freeze(["40_Develop/project-runtime"]),
  readPaths: Object.freeze(["06_Architecture/project-runtime"]),
  maximumConcurrency: 2,
  maximumReplans: 1,
  originLane: "interactive" as const,
  adoptResult: false,
});

const PROJECT_RUNTIME_OBJECTIVE_PLAN = Object.freeze({
  milestoneAcceptanceCriteria: Object.freeze(["全Taskを統合できる"]),
  objectives: Object.freeze([
    Object.freeze({
      id: "objective-a",
      acceptanceCriteria: Object.freeze(["対象変更を確認できる"]),
    }),
  ]),
  tasks: Object.freeze([
    Object.freeze({
      id: "task-a",
      objectiveId: "objective-a",
      dependencies: Object.freeze([]),
      allowedPaths: Object.freeze(["40_Develop/project-runtime/src"]),
      conflictKeys: Object.freeze(["project-runtime-source"]),
    }),
  ]),
});

test("Objective Planは許可Path内の閉じた値だけを受理する", () => {
  const request = inspectProjectRuntimeObjectiveRequest(objectiveRequest);
  assert.ok(request);
  assert.deepEqual(
    inspectProjectRuntimeObjectivePlan(PROJECT_RUNTIME_OBJECTIVE_PLAN, request),
    PROJECT_RUNTIME_OBJECTIVE_PLAN,
  );
  assert.equal(
    inspectProjectRuntimeObjectivePlan(
      {
        ...PROJECT_RUNTIME_OBJECTIVE_PLAN,
        tasks: [
          {
            ...PROJECT_RUNTIME_OBJECTIVE_PLAN.tasks[0],
            allowedPaths: ["90_Release"],
          },
        ],
      },
      request,
    ),
    null,
  );
});

test("Objective結果は入力Identityと終了条件を同じ公開契約へ固定する", () => {
  const request = inspectProjectRuntimeObjectiveRequest(objectiveRequest);
  assert.ok(request);
  assert.deepEqual(
    createProjectRuntimeObjectiveResult(request, {
      status: "blocked",
      reason: "project_runtime_waiting",
      recoveryIds: ["recovery-a"],
      manualRecoveryRequired: true,
      effectState: "unknown",
    }),
    {
      contract: PROJECT_RUNTIME_OBJECTIVE_INTAKE_CONTRACT,
      status: "blocked",
      reason: "project_runtime_waiting",
      requestId: "request-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: null,
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: true,
      processRestartRequired: false,
      recoveryIds: ["recovery-a"],
      recoveryObligations: [],
      effectState: "unknown",
    },
  );
});
