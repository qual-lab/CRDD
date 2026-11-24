/**
 * coordinator:unit:task-recovery-projectionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:task-recovery-projectionが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 試行専用Control、現在入場、単発実行結果の回復参照
 * @boundary PRL-UT-006=N/A: 合成値・代役・有限Promiseだけ。実資源の観測・回復処置は対象外。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";

import {
  projectCurrentDockerAdmission,
  resolveRecoveryStartReason,
  snapshotSingleTaskOutcome,
} from "../../../src/lifecycle/validation.ts";

/**
 * 試行専用Executorへの取消配送と回復Authorityの区別を反証する。
 * @responsibility 既存記録のControl aliasを元Owner・元試行だけに限定し終端で消去する。
 * @trace PRL-UT-006
 * @precondition メモリ内の記録・Executor代役・有限Promiseだけを使用する。
 * @stimulus 未保存、別Owner、コピーControl、再結合、成功／拒否終端を与える。
 * @observation 元Controlへの配送回数、alias有無、回復検索の拒否、元結果の同一性。
 * @oracle 終端後の取消は拒否し、試行を終了できない場合は元の回復参照のHome解放事実だけを返す。
 * @cleanup Promiseをsettleしてalias不存在を確認する。外部資源は作らない。
 */
test("試行専用ExecutorのControlは回復Authorityにならず終端で失効する", async () => {
  const one = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
  const two = `docker-task.${"4".repeat(64)}.${"5".repeat(64)}.${"6".repeat(64)}`;
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  for (const outcome of ["resolved", "held", "rejected"] as const) {
    const records = new WeakMap<object, Record<string, unknown>>();
    const names = [
      "durableRecord",
      "bindExecutorAttempt",
      "cancelExecutorAttempt",
      "abandonAttemptRecovery",
      "abandonDockerRecovery",
    ];
    const api = runInNewContext(
      names.map((name) => sourceDeclaration(source, name)).join("\n") +
        "\n({lookup:durableRecord,bind:bindExecutorAttempt,cancel:cancelExecutorAttempt,abandon:abandonAttemptRecovery})",
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
      homeLeaseReleased: false,
    };
    let cancels = 0,
      abandons = 0;
    let abandonResult = true;
    let abandonError: Error | undefined;
    const executor = {
      cancel: async (input: {
        controlCapability: unknown;
        managementCapability: unknown;
      }) => {
        assert.strictEqual(input.controlCapability, control);
        assert.strictEqual(input.managementCapability, management);
        cancels++;
        return { status: "requested" };
      },
      abandon: (input: {
        recoveryCapability: unknown;
        managementCapability: unknown;
      }) => {
        assert.strictEqual(input.recoveryCapability, capability);
        assert.strictEqual(input.managementCapability, management);
        abandons++;
        if (abandonError) throw abandonError;
        return abandonResult;
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
    assert.equal(api.abandon(capability, {}), false);
    abandonResult = false;
    assert.equal(api.abandon(capability, management), false);
    record.homeLeaseReleased = true;
    assert.equal(api.abandon(control, management), false);
    assert.equal(api.abandon({ ...capability }, management), false);
    assert.equal(api.abandon(capability, management), true);
    const previousAbandons = abandons;
    // 別の管理参照では元Executorに処置を依頼せず、解放観測の読取りだけを行う。
    assert.equal(api.abandon(capability, {}), true);
    assert.equal(abandons, previousAbandons);
    if (outcome !== "resolved") {
      abandonError = Error("synthetic_abandon_failure");
      assert.throws(
        () => api.abandon(capability, management),
        (error) => error === abandonError,
      );
    }
  }
});

/**
 * 現在入場はロック解放を確認した場合だけ通し、旧一覧を搬送しない。
 * @responsibility 本番のTask開始前に使う結果投影の拒否境界を検証する。
 * @trace PRL-UT-006
 * @precondition 合成値のみ。保存・実資源は対象外。
 * @stimulus 正常、解放不明、未知理由、余分field、AccessorとProxyを投入する。
 * @observation 状態、固定理由、Getter・Proxy trapの呼出回数。
 * @oracle 正常だけ許可し、不明時に任意情報を公開しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 現在入場の結果投影。回復は発行しない。
 */
test("現在入場はロック解放と固定理由を照合し旧一覧を搬送しない", () => {
  const available = {
    status: "available",
    reason: "coordinator_current_admission_available",
    lockReleased: true,
  };
  const unconfirmed = {
    status: "blocked",
    reason: "coordinator_current_admission_unconfirmed",
    lockReleased: false,
  };
  const unavailable = {
    status: "blocked",
    reason: "docker_process_controller_recovery_unavailable",
  };
  let observed = 0;
  const accessor = {
    ...available,
    get reason() {
      observed++;
      return available.reason;
    },
  };
  const proxy = new Proxy(available, {
    ownKeys() {
      observed++;
      return [];
    },
  });
  assert.deepEqual(projectCurrentDockerAdmission(available), {
    status: "completed",
  });
  assert.deepEqual(projectCurrentDockerAdmission(unconfirmed), {
    status: "blocked",
    reason: "docker_process_controller_recovery_observation_unknown",
  });
  for (const invalid of [
    null,
    { ...available, lockReleased: false },
    { ...unconfirmed, lockReleased: true },
    { ...unconfirmed, reason: "caller-path:C:\\secret" },
    { ...available, dockerRecoveryIds: ["unknown-id"] },
    { status: "completed", reason: "docker_task_runtime_state_clean" },
    accessor,
    proxy,
  ])
    assert.deepEqual(projectCurrentDockerAdmission(invalid), unavailable);
  assert.equal(observed, 0);
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
});

/**
 * 単発実行結果は回復参照を全量保持し、重複・不正値・未解決の成功扱いを拒否する。
 * @responsibility 現役の結果捕捉境界で容量と非成功の保証を反証する。
 * @trace PRL-UT-006
 * @precondition 一意な257件の正規Docker回復IDを用いる。
 * @stimulus 全量、末尾重複、不正文法、Accessorと成功状態を与える。
 * @observation 返却IDの全件と順序、不正時の値非公開。
 * @oracle 全量を保持し、不正または未解決の成功化は拒否する。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 単発Taskの結果捕捉。実回復は発行しない。
 */
test("単発の実行結果は257件の回復参照を保持し不正な終端を拒否する", () => {
  const ids = Array.from(
    { length: 257 },
    (_, index) =>
      `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${index.toString(16).padStart(64, "0")}`,
  );
  const blocked = {
    mode: "read_only_advice",
    status: "blocked",
    reason: "synthetic_recovery_required",
    cleanupConfirmed: false,
    recoveryIds: ids,
    advice: null,
    workspaceResult: null,
  };
  const result = snapshotSingleTaskOutcome(blocked);
  assert.deepEqual(result?.recoveryIds, ids);
  assert.notEqual(result?.recoveryIds, ids);
  let observed = 0;
  const accessor = [...ids];
  Object.defineProperty(accessor, 256, {
    get() {
      observed++;
      return ids[256];
    },
  });
  for (const invalid of [
    { ...blocked, recoveryIds: [...ids, ids[0]] },
    { ...blocked, recoveryIds: [...ids.slice(0, -1), "broken/ref"] },
    { ...blocked, recoveryIds: accessor },
    { ...blocked, status: "completed", cleanupConfirmed: true },
    { ...blocked, status: "cancelled", cleanupConfirmed: true },
  ])
    assert.equal(snapshotSingleTaskOutcome(invalid), null);
  assert.equal(observed, 0);
});
