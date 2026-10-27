/**
 * 実行Lease九用途の固定候補・観測順・証拠全文を検証する。
 * @packageDocumentation
 * @responsibility 技術処置を代用せず、候補と有限観測の短絡順を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 九つの用途固定候補、Root／Lock／不存在の同期投影。
 * @boundary メモリの局所fixtureだけ。実Lock・保存・全体codec・回復完了の根拠ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  projectCoordinatorLeaseAcquisitionOwner as projectOwner,
  prepareCoordinatorLeaseAcquisitionReservation as reserve,
  prepareCoordinatorLeaseAcquisitionConfirmation as acquire,
  prepareCoordinatorLeaseReleaseIntent as releaseIntent,
  prepareCoordinatorLeaseReleaseSettlement as release,
  projectCoordinatorLeaseOwnerLossState as inspectLoss,
  prepareCoordinatorReleasedLeaseReconciliation as reconcileReleased,
  prepareCoordinatorLeaseRecoveryReservation as reserveRecovery,
  prepareCoordinatorLeaseRecoverySettlement as settleRecovery,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  encodeRuntimeStateValue,
  hashRuntimeStateValueText,
  leaseIdentity,
  type CoordinatorSnapshot,
  type ProjectQueueEntry,
  type LeaseEvidenceEnvelope,
} from "../../../src/index.ts";
/**
 * 九用途の局所元版を作る。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

function fixture() {
  const queue: ProjectQueueEntry = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "a".repeat(64),
    originLane: "interactive",
    repositoryRevision: "b".repeat(40),
    scopeHash: "c".repeat(64),
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
    workspaceId: null,
  };
  const current: CoordinatorSnapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [],
    queueEntries: [queue],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  const intent: CoordinatorSnapshot["leaseIntents"][number] = {
    projectId: "project-a",
    queueId: "queue-a",
    kind: "project-operation",
    ownerGeneration: "owner-a",
    ownerProcessId: 7,
    recoveryId: "recovery-a",
    phase: "acquisition_reserved",
    physicalIdentity: null,
  };
  const root = { repositoryRoot: "repository-a", rootIdentity: "a".repeat(64) };
  return {
    current,
    queue,
    intent,
    root,
    physical: "b".repeat(64),
    identity: leaseIdentity(
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
    ),
  };
}
/**
 * 観測列と用途固定の返却を構築する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

function observations() {
  const calls: string[] = [];
  const { root } = fixture();
  return {
    calls,
    ops: {
      resourcesAbsent: () => {
        calls.push("absent");
        return true;
      },
      observeRoot: () => {
        calls.push("root");
        return root;
      },
      markIntentSaveRequested: () => {
        calls.push("mark");
      },
      physicalIdentityMatches: () => {
        calls.push("physical");
        return true;
      },
    },
  };
}
/**
 * 取得候補を局所値へ適用し、元記録は変更しない。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

function acquiredFixture() {
  const f = fixture();
  const reserved = { ...f.current, leaseIntents: [f.intent] };
  const result = acquire(
    reserved,
    "binding-a",
    "project-a",
    "queue-a",
    "project-operation",
    "owner-a",
    f.intent,
    f.physical,
    "recovery-a",
    7,
    observations().ops,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") throw Error("fixture");
  return { ...f, reserved, acquired: result.value.next };
}
/**
 * 証拠の世代・Hash・本文参照を照合する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

function assertEvidence(
  evidence: LeaseEvidenceEnvelope | undefined,
  disposition: string,
  generation: number,
) {
  assert.ok(evidence);
  assert.deepEqual(evidence, {
    schema: "crdd-coordinator/orchestrator-durable-foundation/v1",
    schemaRevision: 1,
    recordKind: "lease-evidence",
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    createdGeneration: 1,
    updatedGeneration: generation,
    contentHash: hashRuntimeStateValueText(
      encodeRuntimeStateValue(evidence.content),
    ),
    content: {
      kind: "project-operation",
      queueId: "queue-a",
      ownerGeneration: "owner-a",
      ownerProcessId: 7,
      disposition,
    },
  });
  assert.ok(Object.isFrozen(evidence));
  assert.equal(Object.isFrozen(evidence.content), false);
}
/**
 * Owner記録照会は純粋投影で、別Owner・Queue差を拒否する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("取得Owner投影は不存在・同じ参照・混在Ownerを分離する", () => {
  const { current, intent } = fixture();
  assert.equal(
    projectOwner(current, "binding-a").reason,
    "orchestrator_lease_acquisition_absent",
  );
  const state = { ...current, leaseIntents: [intent] };
  const before = encodeRuntimeStateValue(state);
  const result = projectOwner(state, "binding-a");
  assert.equal(result.status, "completed");
  if (result.status === "completed")
    assert.equal(result.value.value.acquisition?.recoveryId, "recovery-a");
  const mismatch = projectOwner(
    {
      ...state,
      leaseIntents: [intent, { ...intent, ownerGeneration: "other" }],
    },
    "binding-a",
  );
  assert.equal(
    mismatch.reason,
    "orchestrator_lease_acquisition_owner_mismatch",
  );
  assert.equal(
    mismatch.status === "blocked" && mismatch.recoveryId,
    "recovery-a",
  );
  assert.equal(
    projectOwner({ ...state, queueEntries: [] }, "binding-a").status,
    "blocked",
  );
  assert.equal(encodeRuntimeStateValue(state), before);
});
/**
 * 取得予約の不存在→Root→markを元の順序で確認する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("取得予約は前提拒否・資源不明・Root例外でmarkを発行しない", () => {
  const f = fixture();
  const run = (state: CoordinatorSnapshot, ops = observations().ops) =>
    reserve(
      state,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
      f.identity,
      f.intent,
      ops,
    );
  for (const state of [
    { ...f.current, queueEntries: [] },
    { ...f.current, leaseIntents: [f.intent] },
  ]) {
    const o = observations();
    assert.equal(run(state, o.ops).status, "blocked");
    assert.deepEqual(o.calls, []);
  }
  for (const value of [false, Promise.resolve(true), 1]) {
    const o = observations();
    assert.equal(
      run(f.current, {
        ...o.ops,
        resourcesAbsent: () => {
          o.calls.push("absent");
          return value as never;
        },
      }).status,
      "blocked",
    );
    assert.deepEqual(o.calls, ["absent"]);
  }
  const failed = observations();
  assert.throws(
    () =>
      run(f.current, {
        ...failed.ops,
        observeRoot: () => {
          failed.calls.push("root");
          throw Error("root");
        },
      }),
    /root/,
  );
  assert.deepEqual(failed.calls, ["absent", "root"]);
  let rejectedEffects = 0;
  const thenable = {
    // biome-ignore lint/suspicious/noThenProperty: 同期Root観測のthenable拒否を確認する。
    then() {
      rejectedEffects += 1;
      throw Error("must_not_run");
    },
  };
  const inheritedThen = Object.assign(Object.create(thenable), f.root);
  const accessor = {
    get repositoryRoot() {
      rejectedEffects += 1;
      return f.root.repositoryRoot;
    },
    rootIdentity: f.root.rootIdentity,
  };
  const proxy = new Proxy(f.root, {
    getPrototypeOf() {
      rejectedEffects += 1;
      return Object.prototype;
    },
    ownKeys() {
      rejectedEffects += 1;
      return ["repositoryRoot", "rootIdentity"];
    },
    get() {
      rejectedEffects += 1;
      throw Error("must_not_run");
    },
  });
  for (const value of [
    Promise.resolve(f.root),
    thenable,
    inheritedThen,
    accessor,
    proxy,
    { ...f.root, rootIdentity: "bad" },
    true,
  ]) {
    const o = observations();
    assert.throws(
      () =>
        run(f.current, {
          ...o.ops,
          observeRoot: () => {
            o.calls.push("root");
            return value as never;
          },
        }),
      /observation_unknown/,
    );
    assert.deepEqual(o.calls, ["absent", "root"]);
  }
  assert.equal(rejectedEffects, 0);
  const o = observations();
  const result = run(f.current, o.ops);
  assert.equal(result.status, "completed");
  assert.deepEqual(o.calls, ["absent", "root", "mark"]);
  if (result.status === "completed")
    assert.deepEqual(result.value.next, {
      ...f.current,
      leaseIntents: [f.intent],
    });
});
/**
 * 取得確定の観測短絡と証拠全文を確認する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("取得確定は元intent一致後だけLockを観測し取得証拠を同じHashで生成する", () => {
  const f = acquiredFixture();
  const o = observations();
  const run = (state: CoordinatorSnapshot, ops = o.ops) =>
    acquire(
      state,
      "binding-a",
      "project-a",
      "queue-a",
      "project-operation",
      "owner-a",
      f.intent,
      f.physical,
      "recovery-a",
      7,
      ops,
    );
  assert.equal(run(f.current).status, "blocked");
  assert.deepEqual(o.calls, []);
  assert.equal(run(f.reserved).status, "completed");
  assert.deepEqual(o.calls, ["physical"]);
  for (const value of [false, Promise.resolve(true), "yes"]) {
    const invalid = observations();
    const result = run(f.reserved, {
      ...invalid.ops,
      physicalIdentityMatches: () => {
        invalid.calls.push("physical");
        return value as never;
      },
    });
    assert.equal(result.status, "blocked");
    assert.equal(
      result.status === "blocked" && result.recoveryId,
      "recovery-a",
    );
    assert.deepEqual(invalid.calls, ["physical"]);
  }
  assertEvidence(f.acquired.leaseEvidence[0], "acquired", 1);
  assert.deepEqual(f.acquired, {
    ...f.reserved,
    leaseIntents: [
      f.intent,
      { ...f.intent, phase: "lock_owned", physicalIdentity: f.physical },
    ],
    leaseEvidence: f.acquired.leaseEvidence,
  });
});
/**
 * 解放pendingと終了証拠を元の二段階で生成する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("解放候補は別実体を拒否し同intent除去とreleased証拠を一体にする", () => {
  const f = acquiredFixture();
  assert.equal(
    releaseIntent(f.acquired, f.intent, "c".repeat(64)).status,
    "blocked",
  );
  const pending = releaseIntent(f.acquired, f.intent, f.physical);
  assert.equal(pending.status, "completed");
  if (pending.status !== "completed") throw Error("fixture");
  assert.equal(
    release(f.acquired, "binding-a", f.intent, f.physical, 7).status,
    "blocked",
  );
  const result = release(
    pending.value.next,
    "binding-a",
    f.intent,
    f.physical,
    7,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") throw Error("fixture");
  assert.deepEqual(result.value.next, {
    ...pending.value.next,
    leaseIntents: [],
    leaseEvidence: result.value.next.leaseEvidence,
  });
  assertEvidence(result.value.next.leaseEvidence[1], "released", 2);
});
/**
 * Owner-lossの初回投影とRoot観測位置を確認する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("Owner-loss初回照会は値結合の後だけRootを一回観測する", () => {
  const f = fixture(),
    o = observations();
  assert.equal(
    inspectLoss(
      { ...f.current, queueEntries: [] },
      "project-a",
      "queue-a",
      "project-operation",
      o.ops,
    ).status,
    "blocked",
  );
  assert.deepEqual(o.calls, []);
  const result = inspectLoss(
    { ...f.current, leaseIntents: [f.intent] },
    "project-a",
    "queue-a",
    "project-operation",
    o.ops,
  );
  assert.equal(result.status, "completed");
  assert.deepEqual(o.calls, ["root"]);
  if (result.status === "completed")
    assert.deepEqual(result.value.value, {
      intents: [f.intent],
      queue: f.queue,
      intakeEpoch: f.current.intakeEpoch,
      ...f.root,
    });
});
/**
 * intentなしの旧Lease終了を成功へ補正しない。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("released照合は元Queue・証拠の後に資源不存在を確認し回復待ちを保持する", () => {
  const f = acquiredFixture();
  const pending = releaseIntent(f.acquired, f.intent, f.physical);
  if (pending.status !== "completed") throw Error("fixture");
  const result = release(
    pending.value.next,
    "binding-a",
    f.intent,
    f.physical,
    7,
  );
  if (result.status !== "completed") throw Error("fixture");
  const queue = {
    ...f.queue,
    state: "running" as const,
    ownerGeneration: "owner-a",
  };
  const current = { ...result.value.next, queueEntries: [queue] };
  const o = observations();
  const run = (state: CoordinatorSnapshot, old = queue, ops = o.ops) =>
    reconcileReleased(
      state,
      "project-a",
      "queue-a",
      "project-operation",
      old,
      "recovery-a",
      ops,
    );
  assert.equal(run({ ...current, leaseEvidence: [] }).status, "blocked");
  assert.deepEqual(o.calls, []);
  assert.equal(run(current, { ...queue, generation: 2 }).status, "blocked");
  assert.deepEqual(o.calls, []);
  const settled = run(current);
  assert.equal(settled.status, "completed");
  assert.deepEqual(o.calls, ["absent"]);
  if (settled.status === "completed") {
    assert.equal(settled.value.value.queue.state, "recovery_required");
    assert.equal(settled.value.value.queue.resultReference, "recovery-a");
  }
  assert.equal(
    run(current, queue, {
      ...o.ops,
      resourcesAbsent: () => Promise.resolve(true) as never,
    }).status,
    "blocked",
  );
});
/**
 * 回復予約のRoot先行・元集合比較・同値無書込みを確認する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("回復intent予約はRootと元集合を照合し同じpendingだけ再入場する", () => {
  const f = fixture(),
    o = observations(),
    initial = { ...f.root, queue: f.queue };
  const current = { ...f.current, leaseIntents: [f.intent] };
  const pending = {
    ...f.intent,
    phase: "recovery_pending" as const,
    physicalIdentity: null,
  };
  const run = (state: CoordinatorSnapshot, ops = o.ops, own = [f.intent]) =>
    reserveRecovery(
      state,
      "project-a",
      "queue-a",
      "project-operation",
      initial,
      own,
      pending,
      "recovery-a",
      ops,
    );
  assert.equal(run({ ...current, queueEntries: [] }).status, "blocked");
  assert.deepEqual(o.calls, ["root"]);
  const diff = observations();
  assert.equal(
    run(current, {
      ...diff.ops,
      observeRoot: () => {
        diff.calls.push("root");
        return { ...f.root, rootIdentity: "b".repeat(64) };
      },
    }).status,
    "blocked",
  );
  assert.deepEqual(diff.calls, ["root"]);
  const reserved = run(current);
  assert.equal(reserved.status, "completed");
  if (reserved.status !== "completed") throw Error("fixture");
  assert.deepEqual(reserved.value.next, {
    ...current,
    leaseIntents: [f.intent, pending],
  });
  const repeated = run(reserved.value.next, o.ops, [f.intent, pending]);
  assert.equal(repeated.status, "completed");
  if (repeated.status === "completed") assert.equal(repeated.value.next, null);
  const wrong = { ...pending, physicalIdentity: "c".repeat(64) };
  const mismatched = reserveRecovery(
    { ...current, leaseIntents: [f.intent, wrong] },
    "project-a",
    "queue-a",
    "project-operation",
    initial,
    [f.intent, wrong],
    pending,
    "recovery-a",
    o.ops,
  );
  assert.equal(mismatched.reason, "orchestrator_lease_intent_mismatch");
});
/**
 * 回復確定を取得有無・現在観測と元版相関で反証する。
 * @responsibility 元対象・観測順・証拠全文・対象外不変を反証する。
 * @trace PRL-UT-006
 * @precondition 局所値fixture。完全codec・実Ownerは使用しない。
 * @stimulus 正常値と前提不一致・観測不明・例外を渡す。
 * @observation 返却全文・観測列・元版byte・exact回復参照。
 * @oracle 候補の成立を実回収・保存成功へ拡張しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain候補とCoordinatorからの有限観測。
 */

test("回復確定はunknown取得を成功へ変えず終了証拠と対象Queueだけを更新する", () => {
  for (const hadAcquired of [true, false]) {
    const f = acquiredFixture();
    const own = hadAcquired ? f.acquired.leaseIntents : [f.intent];
    const pending = {
      ...f.intent,
      phase: "recovery_pending" as const,
      physicalIdentity: hadAcquired ? f.physical : null,
    };
    const queue = {
      ...f.queue,
      state: "running" as const,
      ownerGeneration: "owner-a",
    };
    const initial = { ...f.root, queue };
    const current = {
      ...f.current,
      queueEntries: [queue],
      leaseIntents: [...own, pending],
      leaseEvidence: hadAcquired ? f.acquired.leaseEvidence : [],
    };
    const run = (state: CoordinatorSnapshot, ops = observations().ops) =>
      settleRecovery(
        state,
        "binding-a",
        "project-a",
        "queue-a",
        "project-operation",
        initial,
        own,
        pending,
        f.intent,
        "recovery-a",
        ops,
      );
    const o = observations();
    const result = run(current, o.ops);
    assert.equal(result.status, "completed");
    assert.deepEqual(o.calls, ["root", "absent"]);
    if (result.status !== "completed") throw Error("fixture");
    assertEvidence(
      result.value.next.leaseEvidence.at(-1),
      hadAcquired ? "recovered_after_owner_loss" : "acquisition_unknown_closed",
      2,
    );
    assert.deepEqual(result.value.next, {
      ...current,
      leaseIntents: [],
      leaseEvidence: result.value.next.leaseEvidence,
      queueEntries: [
        {
          ...queue,
          generation: 2,
          state: "recovery_required",
          ownerGeneration: null,
          resumeCondition: "owner_loss",
          resultReference: "recovery-a",
        },
      ],
    });
    const stale = observations();
    assert.equal(
      run(
        { ...current, queueEntries: [{ ...queue, generation: 2 }] },
        stale.ops,
      ).status,
      "blocked",
    );
    assert.deepEqual(stale.calls, ["root"]);
    const unavailable = observations();
    assert.equal(
      run(current, {
        ...unavailable.ops,
        resourcesAbsent: () => {
          unavailable.calls.push("absent");
          return Promise.resolve(true) as never;
        },
      }).status,
      "blocked",
    );
    assert.deepEqual(unavailable.calls, ["root", "absent"]);
    assert.equal(
      run({
        ...result.value.next,
        leaseIntents: current.leaseIntents,
        queueEntries: current.queueEntries,
      }).status,
      "blocked",
    );
  }
});
