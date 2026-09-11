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
