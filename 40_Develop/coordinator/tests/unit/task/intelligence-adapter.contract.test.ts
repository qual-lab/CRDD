/**
 * orchestrator:unit:execution-observation-portの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:execution-observation-portが所有する検証責務を実行する。
 * @trace PPR-UT-011
 * @level UT
 * @scope project、runtime、execution、observation、port
 * @boundary PPR-UT-011=N/A: 実行記録Readerは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createOrchestratorTaskAttemptEvent } from "../../../src/task/intelligence-adapter.ts";

import type {
  OrchestratorExecutionObservationPort,
  OrchestratorExecutionObservationPublication,
  OrchestratorTaskAttemptObservation,
} from "../../../src/task/observer.ts";

const OBSERVATION: OrchestratorTaskAttemptObservation = Object.freeze({
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
 * 実行観測PortはOrchestratorの意味だけをAdapterへ渡すを検証する。
 *
 * @responsibility 実行観測PortはOrchestratorの意味だけをAdapterへ渡すの合否判定を所有する。
 * @trace PPR-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行観測PortはOrchestratorの意味だけをAdapterへ渡すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-011=Direct Boundary: orchestrator Test Source→対象契約
 */
test("実行観測PortはOrchestratorの意味だけをAdapterへ渡す", () => {
  const receivedObservations: OrchestratorTaskAttemptObservation[] = [];
  const publication: OrchestratorExecutionObservationPublication =
    Object.freeze({
      status: "blocked",
      reason: "observation_store_unavailable",
      effectState: "unknown",
      cleanupConfirmed: false,
      retryAllowed: false,
      manualRecoveryRequired: true,
      residualArtifactIds: Object.freeze(["observation-residual"]),
    });
  const port: OrchestratorExecutionObservationPort = Object.freeze({
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
 * @boundary PPR-UT-011=Direct Boundary: orchestrator Test Source→対象契約
 */
test("観測未設定と観測不能を成功へ丸めない", () => {
  const observedPublications: OrchestratorExecutionObservationPublication[] =
    [];
  const port: OrchestratorExecutionObservationPort = Object.freeze({
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

/**
 * 公開入口のAttempt変換が実測と欠測を区別することを検証する。
 *
 * @responsibility 上位観測のIdentity、時間、Providerと未観測値の保存を確認する。
 * @trace PPR-UT-011
 * @precondition 固定された正常Attempt観測を使用する。
 * @stimulus Orchestrator公開入口から共通Eventを構築する。
 * @observation EventのIdentity、実行時間、Provider、Model、Usageと入力不変性を読む。
 * @oracle 実測時間15msだけを観測済みとし、未取得ModelとUsageを補完しない。
 * @cleanup N/A: 値変換だけで外部資源を取得しない。
 * @boundary N/A: 共通Eventへの同期値変換だけを扱う。
 */
test("公開Attempt変換は実測時間とProviderだけを観測済みとして保持する", () => {
  const before = structuredClone(OBSERVATION);
  const event = createOrchestratorTaskAttemptEvent(OBSERVATION);
  assert.deepEqual(event.identity, OBSERVATION.identity);
  assert.deepEqual(event.outcome, OBSERVATION.outcome);
  assert.deepEqual(event.execution.durationMs, {
    state: "observed",
    value: 15,
    source: "orchestrator_monotonic_clock",
  });
  assert.deepEqual(event.execution.provider, {
    state: "observed",
    value: "codex",
    source: "single_task_verified_completion",
  });
  assert.equal(event.execution.model.state, "not_observed");
  assert.equal(event.quality.state, "not_applicable");
  assert.deepEqual(OBSERVATION, before);
  assert.equal(Object.isFrozen(event), true);
});

/**
 * Provider欠測と不正な時間観測を成功値へ補完しないことを検証する。
 *
 * @responsibility 時間の逆転・非有限値とProvider未取得の分類を固定する。
 * @trace PPR-UT-011
 * @precondition Providerを持たず不正なClockを持つ観測を使用する。
 * @stimulus 逆転、NaN、Infinityの時間を公開Attempt変換へ渡す。
 * @observation EventのProviderとdurationMsの状態・理由を読む。
 * @oracle いずれもnot_observedを返し、0msや既定Providerへ丸めない。
 * @cleanup N/A: 同期値変換だけで保存Effectを発行しない。
 * @boundary N/A: Clock値と欠測の純粋な判定だけを扱う。
 */
test("公開Attempt変換はProvider欠測と不正Clockを補完しない", () => {
  const { provider: omittedProvider, ...withoutProvider } = OBSERVATION;
  for (const [startedAtMs, endedAtMs] of [
    [25, 10],
    [Number.NaN, 25],
    [10, Number.POSITIVE_INFINITY],
  ] as const) {
    const event = createOrchestratorTaskAttemptEvent({
      ...withoutProvider,
      startedAtMs,
      endedAtMs,
    });
    assert.deepEqual(event.execution.provider, {
      state: "not_observed",
      reason: "provider_selection_not_exposed_by_single_task_result",
    });
    assert.deepEqual(event.execution.durationMs, {
      state: "not_observed",
      reason: "orchestrator_monotonic_clock_invalid",
    });
  }
});
