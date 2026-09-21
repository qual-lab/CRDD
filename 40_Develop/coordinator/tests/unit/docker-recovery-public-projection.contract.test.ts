/**
 * coordinator:unit:docker-recovery-public-projectionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-recovery-public-projectionが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、recovery、public、projection
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  projectDockerRecoveryAdmission,
  publicDockerRecoveryStartReason,
} from "../../src/security/docker-recovery-public-projection.ts";

/**
 * observationのTest準備責務を実行する。
 *
 * @responsibility observationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus observationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
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

/**
 * production Recovery inventory形状はcleanだけをTask Admissionへ通すを検証する。
 *
 * @responsibility production Recovery inventory形状はcleanだけをTask Admissionへ通すの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production Recovery inventory形状はcleanだけをTask Admissionへ通すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
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

/**
 * clean、inventory、hashの相関差は値非公開で拒否するを検証する。
 *
 * @responsibility clean、inventory、hashの相関差は値非公開で拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus clean、inventory、hashの相関差は値非公開で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
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

/**
 * Recovery observation unknownと未登録理由は固定公開分類へ閉じるを検証する。
 *
 * @responsibility Recovery observation unknownと未登録理由は固定公開分類へ閉じるの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery observation unknownと未登録理由は固定公開分類へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
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

/**
 * malformed、accessor、Proxyは値を読まずRecovery requiredへ閉じるを検証する。
 *
 * @responsibility malformed、accessor、Proxyは値を読まずRecovery requiredへ閉じるの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus malformed、accessor、Proxyは値を読まずRecovery requiredへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
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

/**
 * RecoveryのHome hash配列不正はID配列が正しくても拒否しgetterを呼ばないを検証する。
 *
 * @responsibility RecoveryのHome hash配列不正はID配列が正しくても拒否しgetterを呼ばないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RecoveryのHome hash配列不正はID配列が正しくても拒否しgetterを呼ばないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
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
