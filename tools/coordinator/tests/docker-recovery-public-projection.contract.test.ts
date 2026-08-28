import assert from "node:assert/strict";
import test from "node:test";

import {
  projectDockerRecoveryAdmission,
  publicDockerRecoveryStartReason,
} from "../src/security/docker-recovery-public-projection.ts";

function observation(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    status: "completed",
    reason: "docker_task_runtime_state_clean",
    manualRecoveryRequired: false,
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    activeStableLogicalHomeBindingHashes: Object.freeze([]),
    ...overrides,
  });
}

test("production Recovery inventory形状はcleanだけをTask Admissionへ通す", () => {
  assert.deepEqual(projectDockerRecoveryAdmission(observation()), {
    status: "completed",
    reason: "docker_task_runtime_state_clean",
    manualRecoveryRequired: false,
    dockerRecoveryId: null,
    dockerRecoveryIds: [],
  });
  const one = "docker.recovery.one";
  assert.deepEqual(
    projectDockerRecoveryAdmission(
      observation({
        reason: "docker_task_recovery_inventory_available",
        manualRecoveryRequired: true,
        dockerRecoveryId: one,
        dockerRecoveryIds: Object.freeze([one]),
      }),
    ),
    {
      status: "blocked",
      reason: "docker_process_controller_recovery_conflict",
      manualRecoveryRequired: true,
      dockerRecoveryId: one,
      dockerRecoveryIds: [one],
    },
  );
  const two = ["docker.recovery.one", "docker.recovery.two"];
  assert.deepEqual(
    projectDockerRecoveryAdmission(
      observation({
        reason: "docker_task_multiple_recovery_inventory_available",
        manualRecoveryRequired: true,
        dockerRecoveryIds: Object.freeze(two),
      }),
    ).dockerRecoveryIds,
    two,
  );
});

test("Recovery observation unknownと未登録理由は固定公開分類へ閉じる", () => {
  assert.equal(
    publicDockerRecoveryStartReason(
      "docker_task_runtime_state_lock_release_unconfirmed",
    ),
    "docker_process_controller_recovery_observation_unknown",
  );
  assert.equal(
    publicDockerRecoveryStartReason("caller-path:C:\\secret"),
    "docker_process_controller_recovery_unavailable",
  );
});

test("malformed、accessor、Proxyは値を読まずRecovery requiredへ閉じる", () => {
  const malformed = observation({ dockerRecoveryIds: ["one", "two"] });
  Object.defineProperty(malformed.dockerRecoveryIds, "0", {
    get: () => {
      throw new Error("must_not_run");
    },
  });
  for (const candidate of [
    { status: "completed" },
    malformed,
    new Proxy(observation(), {
      ownKeys: () => {
        throw new Error("must_not_run");
      },
    }),
  ]) {
    assert.deepEqual(projectDockerRecoveryAdmission(candidate), {
      status: "blocked",
      reason: "docker_process_controller_recovery_unavailable",
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: [],
    });
  }
});
