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

const one = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
const two = `docker-task.${"4".repeat(64)}.${"5".repeat(64)}.${"6".repeat(64)}`;

test("production Recovery inventory形状はcleanだけをTask Admissionへ通す", () => {
  assert.deepEqual(projectDockerRecoveryAdmission(observation()), {
    status: "completed",
    reason: "docker_task_runtime_state_clean",
    manualRecoveryRequired: false,
    dockerRecoveryId: null,
    dockerRecoveryIds: [],
  });
  assert.deepEqual(
    projectDockerRecoveryAdmission(
      observation({
        reason: "docker_task_recovery_inventory_available",
        manualRecoveryRequired: true,
        dockerRecoveryId: one,
        dockerRecoveryIds: Object.freeze([one]),
        activeStableLogicalHomeBindingHashes: Object.freeze(["1".repeat(64)]),
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
  const ids = [one, two];
  assert.deepEqual(
    projectDockerRecoveryAdmission(
      observation({
        reason: "docker_task_multiple_recovery_inventory_available",
        manualRecoveryRequired: true,
        dockerRecoveryIds: Object.freeze(ids),
        activeStableLogicalHomeBindingHashes: Object.freeze([
          "1".repeat(64),
          "4".repeat(64),
        ]),
      }),
    ).dockerRecoveryIds,
    ids,
  );
  assert.deepEqual(
    projectDockerRecoveryAdmission(
      observation({
        reason: "docker_task_multiple_recovery_inventory_available",
        manualRecoveryRequired: true,
        dockerRecoveryIds: Object.freeze(ids),
        activeStableLogicalHomeBindingHashes: Object.freeze(["1".repeat(64)]),
      }),
    ).dockerRecoveryIds,
    ids,
  );
  assert.deepEqual(
    projectDockerRecoveryAdmission(
      observation({
        reason: "docker_task_multiple_recovery_inventory_available",
        manualRecoveryRequired: true,
        dockerRecoveryIds: Object.freeze(ids),
        activeStableLogicalHomeBindingHashes: Object.freeze([]),
      }),
    ).dockerRecoveryIds,
    ids,
  );
});

test("clean、inventory、hashの相関差は値非公開で拒否する", () => {
  for (const candidate of [
    observation({ reason: "docker_task_runtime_state_audit_failed" }),
    observation({ activeStableLogicalHomeBindingHashes: ["1".repeat(64)] }),
    observation({
      reason: "docker_task_recovery_inventory_available",
      manualRecoveryRequired: true,
      dockerRecoveryId: "C:\\secret",
      dockerRecoveryIds: ["C:\\secret"],
    }),
    observation({
      reason: "docker_task_multiple_recovery_inventory_available",
      manualRecoveryRequired: true,
      dockerRecoveryId: null,
      dockerRecoveryIds: [one, one],
    }),
    observation({
      reason: "docker_task_recovery_inventory_available",
      manualRecoveryRequired: true,
      dockerRecoveryId: one,
      dockerRecoveryIds: [one],
      activeStableLogicalHomeBindingHashes: ["f".repeat(64)],
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
  assert.deepEqual(
    projectDockerRecoveryAdmission(
      observation({
        status: "blocked",
        reason: "docker_task_runtime_state_lock_release_unconfirmed",
        manualRecoveryRequired: true,
        dockerRecoveryId: one,
        dockerRecoveryIds: [one],
        activeStableLogicalHomeBindingHashes: ["1".repeat(64)],
      }),
    ),
    {
      status: "blocked",
      reason: "docker_process_controller_recovery_observation_unknown",
      manualRecoveryRequired: true,
      dockerRecoveryId: one,
      dockerRecoveryIds: [one],
    },
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

test("RecoveryのHome hash配列不正はID配列が正しくても拒否しgetterを呼ばない", () => {
  let getterCalls = 0;
  const accessorHashes = ["1".repeat(64)];
  Object.defineProperty(accessorHashes, "0", {
    get: () => {
      getterCalls += 1;
      return "1".repeat(64);
    },
  });
  for (const hashes of [
    null,
    {},
    "1".repeat(64),
    ["not-hex"],
    accessorHashes,
  ]) {
    assert.deepEqual(
      projectDockerRecoveryAdmission(
        observation({
          reason: "docker_task_recovery_inventory_available",
          manualRecoveryRequired: true,
          dockerRecoveryId: one,
          dockerRecoveryIds: [one],
          activeStableLogicalHomeBindingHashes: hashes,
        }),
      ),
      {
        status: "blocked",
        reason: "docker_process_controller_recovery_unavailable",
        manualRecoveryRequired: true,
        dockerRecoveryId: null,
        dockerRecoveryIds: [],
      },
    );
  }
  assert.equal(getterCalls, 0);
});
