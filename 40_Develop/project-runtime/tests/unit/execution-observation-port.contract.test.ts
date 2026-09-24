/**
 * project-runtime:unit:execution-observation-portの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility project-runtime:unit:execution-observation-portが所有する検証責務を実行する。
 * @trace PPR-UT-011
 * @level UT
 * @scope project、runtime、execution、observation、port
 * @boundary PPR-UT-011=N/A: 実行記録Readerは外部実行境界を持たない。
 */
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

/**
 * 実行観測PortはProject Runtimeの意味だけをAdapterへ渡すを検証する。
 *
 * @responsibility 実行観測PortはProject Runtimeの意味だけをAdapterへ渡すの合否判定を所有する。
 * @trace PPR-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行観測PortはProject Runtimeの意味だけをAdapterへ渡すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-011=N/A: 実行記録Readerは外部実行境界を持たない。
 */
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

/**
 * 観測未設定と観測不能を成功へ丸めないを検証する。
 *
 * @responsibility 観測未設定と観測不能を成功へ丸めないの合否判定を所有する。
 * @trace PPR-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 観測未設定と観測不能を成功へ丸めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-011=N/A: 実行記録Readerは外部実行境界を持たない。
 */
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
