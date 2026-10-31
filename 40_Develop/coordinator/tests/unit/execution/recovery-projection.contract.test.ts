/**
 * coordinator:unit:task-recovery-projectionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:task-recovery-projectionが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、recovery、public、projection
 * @boundary PRL-UT-006=N/A: 現在入場・回復観測を固定公開理由／DTOへ投影する純粋値境界。外部実行境界・処置Authorityを持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../domain-model/tests/support/source-declaration.ts";

import { projectDockerRecoveryAdmission } from "../../../src/execution/result.ts";
import { resolveRecoveryStartReason } from "../../../src/execution/validation.ts";

/**
 * 試行専用Executorへの取消配送と回復Authorityの区別を反証する。
 * @responsibility 既存記録のControl aliasを元Owner・元試行だけに限定し終端で消去する。
 * @trace PRL-UT-006
 * @precondition メモリ内の記録・Executor代役・有限Promiseだけを使用する。
 * @stimulus 未保存、別Owner、コピーControl、再結合、成功／拒否終端を与える。
 * @observation 元Controlへの配送回数、alias有無、回復検索の拒否、元結果の同一性。
 * @oracle Controlは回復Authorityにならず、終端後の取消は拒否される。
 * @cleanup Promiseをsettleしてalias不存在を確認する。外部資源は作らない。
 */
test("試行専用ExecutorのControlは回復Authorityにならず終端で失効する", async () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  for (const outcome of ["resolved", "held", "rejected"] as const) {
    const records = new WeakMap<object, Record<string, unknown>>();
    const names = [
      "durableRecord",
      "bindRuntimeOwnedExecutorAttempt",
      "cancelRuntimeOwnedExecutorAttempt",
      "abandonRuntimeOwnedExecutorAttempt",
    ];
    const api = runInNewContext(
      names.map((name) => sourceDeclaration(source, name)).join("\n") +
        "\n({lookup:durableRecord,bind:bindRuntimeOwnedExecutorAttempt,cancel:cancelRuntimeOwnedExecutorAttempt,abandon:abandonRuntimeOwnedExecutorAttempt})",
      { durableRecords: records },
    ) as {
      lookup(capability: unknown): unknown;
      bind(...args: unknown[]): boolean;
      cancel(...args: unknown[]): Promise<{ status: string }>;
      abandon(...args: unknown[]): boolean;
    };
    const capability = {},
      management = {},
      control = {};
    const record = {
      capability,
      managementCapability: management,
      initializationReady: true,
      recoveryId: one,
    };
    let cancels = 0,
      abandons = 0;
    const executor = {
      cancel: async (c: unknown, m: unknown) => {
        assert.strictEqual(c, control);
        assert.strictEqual(m, management);
        cancels++;
        return { status: "requested" };
      },
      abandon: (c: unknown, m: unknown) => {
        assert.strictEqual(c, capability);
        assert.strictEqual(m, management);
        abandons++;
        return true;
      },
    };
    assert.equal(api.bind(capability, management, executor), false);
    records.set(capability, record);
    assert.equal(api.bind(capability, {}, executor), false);
    assert.equal(api.bind(capability, management, executor), true);
    assert.equal(records.has(control), false);
    assert.equal((await api.cancel(capability, management)).status, "blocked");
    let resolve!: (result: { homeLeaseReleased: boolean }) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<{ homeLeaseReleased: boolean }>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const pending = { promise, resolve, reject };
    const started = {
      status: "started",
      recoveryId: one,
      controlCapability: control,
      completion: pending.promise,
    };
    assert.equal(api.bind(capability, management, {}, started), false);
    assert.equal(
      api.bind(capability, management, executor, {
        ...started,
        recoveryId: two,
      }),
      false,
    );
    assert.equal(api.bind(capability, management, executor, started), true);
    assert.equal(api.bind(capability, management, executor, started), false);
    assert.equal(records.get(control), record);
    assert.equal(api.lookup(control), null);
    assert.equal(api.abandon(control, management), false);
    assert.equal((await api.cancel({}, management)).status, "blocked");
    assert.equal((await api.cancel(control, {})).status, "blocked");
    assert.equal((await api.cancel(control, management)).status, "requested");
    assert.equal(cancels, 1);
    if (outcome !== "rejected")
      pending.resolve({ homeLeaseReleased: outcome === "resolved" });
    else pending.reject(Error("synthetic_completion_failure"));
    await pending.promise.catch(() => undefined);
    await Promise.resolve();
    assert.equal(records.has(control), false);
    assert.equal(api.lookup(capability), record);
    assert.equal((await api.cancel(control, management)).status, "blocked");
    assert.equal(api.abandon(capability, management), outcome !== "resolved");
    assert.equal(abandons, outcome !== "resolved" ? 1 : 0);
  }
});

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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("Recovery observation unknownと未登録理由は固定公開分類へ閉じる", () => {
  assert.equal(
    resolveRecoveryStartReason(
      "docker_task_runtime_state_lock_release_unconfirmed",
    ),
    "docker_process_controller_recovery_observation_unknown",
  );
  assert.equal(
    resolveRecoveryStartReason("caller-path:C:\\secret"),
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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-006=Direct Boundary: coordinator Test Source→対象契約
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
