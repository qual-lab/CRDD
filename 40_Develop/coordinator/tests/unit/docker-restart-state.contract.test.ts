/**
 * coordinator:unit:docker-restart-stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-restart-stateが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、restart、state
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDockerRestartProgress,
  type DockerRestartObservation,
  type DockerRestartPhase,
} from "../../src/core/docker-restart-state.ts";

const CONFIRMED_OBSERVATION: DockerRestartObservation = Object.freeze({
  boundaryMatches: true,
  cancellationRequested: false,
  intentRecorded: true,
  stopCompleted: true,
  managedProcessesAbsent: true,
  engineStopped: true,
  startCompleted: true,
  engineReady: true,
  helperCleanupConfirmed: true,
  recordConfirmed: true,
  effectOutcomeUnknown: false,
});
const phases: readonly DockerRestartPhase[] = [
  "prepared",
  "stop_intent",
  "stopped",
  "start_intent",
  "ready",
  "settled",
];

/**
 * restart progress requires each ordered stage before completionを検証する。
 *
 * @responsibility restart progress requires each ordered stage before completionの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart progress requires each ordered stage before completionの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("restart progress requires each ordered stage before completion", () => {
  let phase: DockerRestartPhase = "prepared";
  for (const expected of phases.slice(1)) {
    const result = classifyDockerRestartProgress(phase, CONFIRMED_OBSERVATION);
    assert.equal(result.status, "advance");
    assert.equal(result.phase, expected);
    assert.equal(result.recoveryRequired, true);
    phase = result.phase;
  }
  assert.equal(
    classifyDockerRestartProgress(phase, CONFIRMED_OBSERVATION).status,
    "complete",
  );
});

for (const phase of phases) {
  for (const [field, isObserved, reason] of [
    ["boundaryMatches", false, "docker_restart_boundary_unconfirmed"],
    ["cancellationRequested", true, "docker_restart_cancelled"],
    ["recordConfirmed", false, "docker_restart_record_unconfirmed"],
    ["effectOutcomeUnknown", true, "docker_restart_effect_outcome_unknown"],
  ] as const) {
    /**
     * ${phase}: ${field} prevents advancement or effect replayを検証する。
     *
     * @responsibility ${phase}: ${field} prevents advancement or effect replayの合否判定を所有する。
     * @trace PRL-UT-006
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus ${phase}: ${field} prevents advancement or effect replayの対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
     */
    test(`${phase}: ${field} prevents advancement or effect replay`, () => {
      const result = classifyDockerRestartProgress(phase, {
        ...CONFIRMED_OBSERVATION,
        [field]: isObserved,
      });
      assert.equal(result.status, "blocked");
      assert.equal(result.phase, phase);
      assert.equal(result.reason, reason);
      assert.equal(
        result.recoveryRequired,
        phase !== "prepared" || field === "effectOutcomeUnknown",
      );
    });
  }
}

for (const [phase, fields, reason] of [
  ["prepared", ["intentRecorded"], "docker_restart_stop_intent_unconfirmed"],
  [
    "stop_intent",
    ["stopCompleted", "managedProcessesAbsent", "engineStopped"],
    "docker_restart_stop_unconfirmed",
  ],
  ["stopped", ["intentRecorded"], "docker_restart_start_intent_unconfirmed"],
  [
    "start_intent",
    ["startCompleted", "engineReady"],
    "docker_restart_start_unconfirmed",
  ],
  ["ready", ["helperCleanupConfirmed"], "docker_restart_cleanup_unconfirmed"],
] as const) {
  for (const field of fields) {
    /**
     * ${phase}: missing ${field} cannot be replaced by other success flagsを検証する。
     *
     * @responsibility ${phase}: missing ${field} cannot be replaced by other success flagsの合否判定を所有する。
     * @trace PRL-UT-006
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus ${phase}: missing ${field} cannot be replaced by other success flagsの対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
     */
    test(`${phase}: missing ${field} cannot be replaced by other success flags`, () => {
      const result = classifyDockerRestartProgress(phase, {
        ...CONFIRMED_OBSERVATION,
        [field]: false,
      });
      assert.equal(result.status, "blocked");
      assert.equal(result.phase, phase);
      assert.equal(result.reason, reason);
    });
  }
}
