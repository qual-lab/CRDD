import assert from "node:assert/strict";
import test from "node:test";

import type {
  ProjectRuntimeExecutionObservationPort,
  ProjectRuntimeExecutionObservationPublication,
  ProjectRuntimeTaskAttemptObservation,
} from "../../src/index.ts";

const OBSERVATION: ProjectRuntimeTaskAttemptObservation = Object.freeze({
  occurredAt: "2026-09-05T00:00:01.000Z",
  startedAtMs: 10,
  endedAtMs: 25,
  identity: Object.freeze({
    projectId: "project-a",
    milestoneId: "milestone-a",
    objectiveId: "objective-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
  }),
  outcome: Object.freeze({
    status: "completed",
    reason: "task_completed",
    effectState: "settled",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
  }),
  provider: "codex",
});

test("実行観測PortはProject Runtimeの意味だけをAdapterへ渡す", () => {
  const receivedObservations: ProjectRuntimeTaskAttemptObservation[] = [];
  const publication: ProjectRuntimeExecutionObservationPublication =
    Object.freeze({
      status: "blocked",
      reason: "observation_store_unavailable",
      effectState: "unknown",
      cleanupConfirmed: false,
      retryAllowed: false,
      manualRecoveryRequired: true,
      residualArtifactIds: Object.freeze(["observation-residual"]),
    });
  const port: ProjectRuntimeExecutionObservationPort = Object.freeze({
    recordTaskAttempt: (value) => {
      receivedObservations.push(value);
      return publication;
    },
  });

  assert.equal(port.recordTaskAttempt?.(OBSERVATION), publication);
  assert.deepEqual(receivedObservations, [OBSERVATION]);
});

test("観測未設定と観測不能を成功へ丸めない", () => {
  const observedPublications: ProjectRuntimeExecutionObservationPublication[] =
    [];
  const port: ProjectRuntimeExecutionObservationPort = Object.freeze({
    observePublication: (publication) => observedPublications.push(publication),
  });
  const unavailable = Object.freeze({
    status: "not_configured" as const,
    reason: "execution_observation_not_configured",
    effectState: "no_effect" as const,
    cleanupConfirmed: true,
  });
  port.observePublication?.(unavailable);
  assert.deepEqual(observedPublications, [unavailable]);
});
