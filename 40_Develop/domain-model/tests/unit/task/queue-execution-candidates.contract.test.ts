/**
 * 実行OwnerからのQueue固定候補と観測境界を検証する。
 * @packageDocumentation
 * @responsibility 単発Task・Queue選択適用・exact回復後適用・解放確定の負例を固定する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 七固定用途の値と有限同期観測。
 * @boundary 実Lease・Scheduling方針・実回復・保存の成功は主張しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareCoordinatorSingleTaskQueueCreation as enqueue,
  prepareCoordinatorSingleTaskQueueUpdate as updateSingle,
  prepareCoordinatorUnstartedTaskQueueClosure as closeUnstarted,
  prepareCoordinatorQueueOperationUpdate as updateQueue,
  prepareCoordinatorQueueRecoverySettlement as recoverQueue,
  prepareCoordinatorQueueSelection as applySelection,
  prepareCoordinatorQueueLeaseReleaseSettlement as releaseQueue,
  inspectSingleTaskRecord,
  validQueueEntry,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  encodeRuntimeStateValue,
  type CoordinatorSnapshot,
  type ProjectQueueEntry,
  type SingleTaskRecord,
} from "../../../src/index.ts";
/**
 * 単発Taskと一般Queue用の局所元版を作成する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

function fixture() {
  const record: SingleTaskRecord = {
    principalId: "principal-a",
    mode: "workspace_edit",
    executionSelection: {
      provider: "codex",
      modelIdentifier: "gpt-5.5",
      identifierKind: "exact",
      reasoningEffort: "medium",
      purpose: "task",
      catalogIdentity: "a".repeat(64),
      configIdentity: "b".repeat(64),
      role: "executor",
      workType: null,
      source: "role_default",
    },
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    phase: "accepted",
    status: "pending",
    reason: null,
    cleanupConfirmed: false,
    recoveryIds: [],
  };
  assert.ok(inspectSingleTaskRecord(record));
  const entry: ProjectQueueEntry = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: null,
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
    singleTask: record,
  };
  assert.equal(validQueueEntry(entry), true);
  const current: CoordinatorSnapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [],
    queueEntries: [entry],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  const { singleTask: _singleTask, ...regular } = entry;
  void _singleTask;
  return {
    record,
    entry,
    regular: { ...regular, milestoneId: "milestone-a" },
    current,
  };
}
/**
 * 有限観測の同一借用と短絡評価を記録する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

function observations() {
  const calls: string[] = [];
  const active = {
    kind: "project-operation",
    repositoryRoot: "repository-a",
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    queueId: "queue-a",
    ownerGeneration: "owner-a",
  };
  let nowCalls = 0;
  return {
    calls,
    active,
    ops: {
      borrowActiveLease: () => {
        calls.push("borrow");
        return active;
      },
      isActiveLeaseObserved: () => {
        calls.push("live");
        return true;
      },
      now: () => {
        calls.push("clock");
        return Date.parse("2026-10-27T00:00:00.000Z") + nowCalls++;
      },
    },
  };
}
/**
 * 単発受付は計画を作らず、同じ発行時結合にだけ再入場する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("単発受付候補は反復・旧epoch・元Identityを区別する", () => {
  const { current, entry } = fixture();
  const empty = { ...current, queueEntries: [] };
  const before = encodeRuntimeStateValue(empty);
  const created = enqueue(empty, "epoch-a", entry);
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  assert.strictEqual(created.value.value, entry);
  assert.strictEqual(created.value.next.projects, empty.projects);
  assert.equal(
    enqueue(created.value.next, "epoch-a", entry).reason,
    "orchestrator_single_task_reused",
  );
  assert.equal(
    enqueue(created.value.next, "epoch-a", {
      ...entry,
      requestHash: "d".repeat(64),
    }).reason,
    "orchestrator_queue_identity_conflict",
  );
  assert.equal(
    enqueue(empty, "retired", entry).reason,
    "orchestrator_intake_epoch_retired",
  );
  assert.equal(
    enqueue(empty, "epoch-a", { ...entry, milestoneId: "milestone-a" }).reason,
    "orchestrator_single_task_input_invalid",
  );
  assert.equal(encodeRuntimeStateValue(empty), before);
});
/**
 * 単発更新の借用・相関・生存の元順序を確認する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("単発更新は同じ実体の借用後だけ生存を一回観測する", () => {
  const { current, record } = fixture();
  const starting = { ...record, phase: "starting" as const };
  const before = encodeRuntimeStateValue(current);
  for (const [key, value] of Object.entries({
    kind: "canonical-adoption",
    repositoryRoot: "other",
    repositoryBindingId: "other",
    projectId: "other",
    queueId: "other",
  })) {
    const o = observations();
    const active = { ...o.active, [key]: value };
    const result = updateSingle(
      current,
      "repository-a",
      "binding-a",
      "queue-a",
      1,
      starting,
      {
        ...o.ops,
        borrowActiveLease: () => {
          o.calls.push("borrow");
          return active;
        },
      },
    );
    assert.equal(result.reason, "orchestrator_single_task_owner_mismatch");
    assert.deepEqual(o.calls, ["borrow"]);
  }
  for (const snapshot of [
    { ...current, queueEntries: [] },
    {
      ...current,
      queueEntries: [
        { ...current.queueEntries[0], generation: 2 } as ProjectQueueEntry,
      ],
    },
  ]) {
    const o = observations();
    assert.equal(
      updateSingle(
        snapshot,
        "repository-a",
        "binding-a",
        "queue-a",
        1,
        starting,
        o.ops,
      ).status,
      "blocked",
    );
    assert.deepEqual(o.calls, ["borrow"]);
  }
  const absent = observations();
  assert.equal(
    updateSingle(current, "repository-a", "binding-a", "queue-a", 1, starting, {
      ...absent.ops,
      borrowActiveLease: () => {
        absent.calls.push("borrow");
        return undefined;
      },
    }).status,
    "blocked",
  );
  assert.deepEqual(absent.calls, ["borrow"]);
  // biome-ignore lint/suspicious/noThenProperty: 同期観測がthenableをtrueとして受理しない負例。
  const thenable = { then() {} };
  for (const value of [false, Promise.resolve(true), thenable]) {
    const o = observations();
    const result = updateSingle(
      current,
      "repository-a",
      "binding-a",
      "queue-a",
      1,
      starting,
      {
        ...o.ops,
        isActiveLeaseObserved: () => {
          o.calls.push("live");
          return value as boolean;
        },
      },
    );
    assert.equal(result.status, "blocked");
    assert.deepEqual(o.calls, ["borrow", "live"]);
  }
  const o = observations();
  const started = updateSingle(
    current,
    "repository-a",
    "binding-a",
    "queue-a",
    1,
    starting,
    o.ops,
  );
  assert.equal(started.status, "completed");
  assert.deepEqual(o.calls, ["borrow", "live"]);
  assert.equal(encodeRuntimeStateValue(current), before);
  const wrongOwner = {
    ...current,
    queueEntries: [
      {
        ...current.queueEntries[0],
        ownerGeneration: "other",
      } as ProjectQueueEntry,
    ],
  };
  const owned = observations();
  assert.equal(
    updateSingle(
      wrongOwner,
      "repository-a",
      "binding-a",
      "queue-a",
      1,
      starting,
      owned.ops,
    ).status,
    "blocked",
  );
  assert.deepEqual(owned.calls, ["borrow", "live"]);
});
/**
 * 単発のclean終端・同値再入場と未解決を時計回数で区別する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("単発終端はcleanだけ時計二回、既存unknown参照は保持する", () => {
  const { current, record, entry } = fixture();
  const running = {
    ...current,
    queueEntries: [
      {
        ...entry,
        generation: 2,
        ownerGeneration: "owner-a",
        state: "running" as const,
        singleTask: { ...record, phase: "running" as const },
      },
    ],
  };
  const terminal: SingleTaskRecord = {
    ...record,
    phase: "settled",
    status: "completed",
    reason: "task_completed",
    cleanupConfirmed: true,
  };
  const o = observations();
  const saved = updateSingle(
    running,
    "repository-a",
    "binding-a",
    "queue-a",
    2,
    terminal,
    o.ops,
  );
  assert.equal(saved.status, "completed");
  assert.deepEqual(o.calls, ["borrow", "live", "clock", "clock"]);
  if (saved.status !== "completed" || !saved.value.next) throw Error("fixture");
  assert.equal(saved.value.next.historyPending.length, 1);
  assert.strictEqual(saved.value.next.results, running.results);
  assert.equal(saved.value.value.generation, 3);
  const duplicate = observations();
  assert.equal(
    updateSingle(
      saved.value.next,
      "repository-a",
      "binding-a",
      "queue-a",
      3,
      terminal,
      duplicate.ops,
    ).reason,
    "orchestrator_single_task_already_saved",
  );
  assert.deepEqual(duplicate.calls, ["borrow", "live"]);
  const dirty = observations();
  const unresolved = updateSingle(
    running,
    "repository-a",
    "binding-a",
    "queue-a",
    2,
    { ...terminal, cleanupConfirmed: false, recoveryIds: ["recovery-a"] },
    dirty.ops,
  );
  assert.equal(unresolved.status, "completed");
  assert.deepEqual(dirty.calls, ["borrow", "live"]);
  if (unresolved.status === "completed") {
    assert.equal(unresolved.value.value.state, "recovery_required");
    assert.deepEqual(unresolved.value.value.singleTask?.recoveryIds, [
      "recovery-a",
    ]);
  }
  const conflict = observations();
  assert.equal(
    updateSingle(
      running,
      "repository-a",
      "binding-a",
      "queue-a",
      2,
      { ...terminal, operationId: "other" },
      conflict.ops,
    ).reason,
    "orchestrator_single_task_identity_conflict",
  );
  assert.deepEqual(conflict.calls, ["borrow", "live"]);
  const thrown = observations();
  assert.throws(
    () =>
      updateSingle(
        running,
        "repository-a",
        "binding-a",
        "queue-a",
        2,
        terminal,
        {
          ...thrown.ops,
          now: () => {
            thrown.calls.push("clock");
            throw Error("synthetic");
          },
        },
      ),
    /synthetic/u,
  );
  assert.deepEqual(thrown.calls, ["borrow", "live", "clock"]);
});
/**
 * 未開始終了は取得intentがなくacceptedの同じ元世代にだけ適用する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("未開始終了の拒否は時計零回、成立時だけ二回", () => {
  const { current, entry } = fixture();
  for (const snapshot of [
    { ...current, queueEntries: [] },
    { ...current, queueEntries: [{ ...entry, ownerGeneration: "other" }] },
    {
      ...current,
      leaseIntents: [
        {
          projectId: "project-a",
          queueId: "queue-a",
          kind: "project-operation" as const,
          ownerGeneration: "owner-a",
          ownerProcessId: 7,
          recoveryId: "recovery-a",
          phase: "acquisition_reserved" as const,
        },
      ],
    },
  ]) {
    const o = observations();
    assert.equal(
      closeUnstarted(snapshot, "queue-a", 1, "not_started", o.ops).status,
      "blocked",
    );
    assert.deepEqual(o.calls, []);
  }
  const o = observations();
  const closed = closeUnstarted(current, "queue-a", 1, "not_started", o.ops);
  assert.equal(closed.status, "completed");
  assert.deepEqual(o.calls, ["clock", "clock"]);
  if (closed.status === "completed") {
    assert.equal(closed.value.value.singleTask?.status, "blocked");
    assert.equal(closed.value.value.singleTask?.cleanupConfirmed, true);
    assert.equal(closed.value.next.historyPending.length, 1);
  }
});
/**
 * 一般Queue更新の先行拒否とLease観測の短絡評価を確認する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("一般Queue更新は先行拒否で借用零回、相関後だけ生存一回", () => {
  const { current, regular } = fixture();
  const state = { ...current, queueEntries: [regular] };
  const next = {
    state: "leased" as const,
    resumeCondition: null,
    resultReference: null,
    leasePresent: true,
    leaseIsNull: false,
  };
  const stale = observations();
  assert.equal(
    updateQueue(
      state,
      "repository-a",
      "binding-a",
      "queue-a",
      2,
      next,
      stale.ops,
    ).reason,
    "orchestrator_queue_generation_conflict",
  );
  assert.deepEqual(stale.calls, []);
  for (const key of [
    "kind",
    "repositoryRoot",
    "repositoryBindingId",
    "projectId",
    "queueId",
  ] as const) {
    const o = observations();
    assert.equal(
      updateQueue(state, "repository-a", "binding-a", "queue-a", 1, next, {
        ...o.ops,
        borrowActiveLease: () => {
          o.calls.push("borrow");
          return { ...o.active, [key]: "other" };
        },
      }).reason,
      "orchestrator_queue_lease_invalid",
    );
    assert.deepEqual(o.calls, ["borrow"]);
  }
  const o = observations();
  const updated = updateQueue(
    state,
    "repository-a",
    "binding-a",
    "queue-a",
    1,
    next,
    o.ops,
  );
  assert.equal(updated.status, "completed");
  assert.deepEqual(o.calls, ["borrow", "live"]);
  if (updated.status === "completed") {
    assert.equal(updated.value.value.ownerGeneration, "owner-a");
    assert.equal(updated.value.value.generation, 2);
  }
  const bad = observations();
  assert.equal(
    updateQueue(state, "repository-a", "binding-a", "queue-a", 1, next, {
      ...bad.ops,
      isActiveLeaseObserved: () => {
        bad.calls.push("live");
        return Promise.resolve(true) as never;
      },
    }).status,
    "blocked",
  );
  assert.deepEqual(bad.calls, ["borrow", "live"]);
  const cancelled = observations();
  assert.equal(
    updateQueue(
      state,
      "repository-a",
      "binding-a",
      "queue-a",
      1,
      { ...next, state: "cancelled", leasePresent: false, leaseIsNull: true },
      cancelled.ops,
    ).status,
    "completed",
  );
  assert.deepEqual(cancelled.calls, []);
});
/**
 * exact回復後適用は外部回復判断をせず元IDと元状態にだけ限定する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("exact回復後Queue候補は別ID・世代・Owner・状態を拒否する", () => {
  const { current, regular } = fixture();
  const entry = {
    ...regular,
    state: "recovery_required" as const,
    resumeCondition: "exact_recovery",
    resultReference: "recovery-a",
  };
  const state = { ...current, queueEntries: [entry] };
  const result = recoverQueue(state, "queue-a", 1, "recovery-a");
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.value.value.state, "queued");
    assert.equal(result.value.value.generation, 2);
    assert.equal(result.value.value.resultReference, "recovery-a");
  }
  assert.equal(
    recoverQueue(state, "queue-a", 2, "recovery-a").status,
    "blocked",
  );
  assert.equal(
    recoverQueue(state, "queue-a", 1, "recovery-b").status,
    "blocked",
  );
  for (const changes of [
    { ownerGeneration: "owner-a" },
    { state: "queued" as const },
    { resumeCondition: "owner_loss" },
  ])
    assert.equal(
      recoverQueue(
        { ...state, queueEntries: [{ ...entry, ...changes }] },
        "queue-a",
        1,
        "recovery-a",
      ).status,
      "blocked",
    );
});
/**
 * Scheduling方針を持たず、閉じた選択判断の適用範囲を確認する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("Queue選択適用は旧世代・誤ID・重複・対象外更新を拒否する", () => {
  const { current, regular } = fixture();
  const state = {
    ...current,
    queueEntries: [
      regular,
      {
        ...regular,
        queueId: "queue-scheduled",
        originLane: "scheduled" as const,
      },
    ],
  };
  const decision = {
    reason: "orchestrator_interactive_queue_selected" as const,
    selectedQueueId: "queue-a",
    selectedQueueGeneration: 1,
    updates: [
      {
        queueId: "queue-scheduled",
        expectedGeneration: 1,
        state: "waiting_foreground" as const,
        resumeCondition: "interactive_queue_pending",
      },
    ],
  };
  const before = encodeRuntimeStateValue(state);
  const result = applySelection(state, decision);
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.strictEqual(result.value.value, regular);
    assert.equal(result.value.next?.queueEntries[1]?.generation, 2);
    assert.strictEqual(result.value.next?.results, state.results);
  }
  assert.ok(decision.updates[0]);
  const update = decision.updates[0];
  for (const change of [
    { selectedQueueId: "missing" },
    { selectedQueueGeneration: 2 },
    { updates: [{ ...update, queueId: "missing" }] },
    { updates: [...decision.updates, ...decision.updates] },
    { updates: [{ ...update, expectedGeneration: 2 }] },
    { updates: [{ ...update, queueId: "queue-a" }] },
  ])
    assert.equal(
      applySelection(state, { ...decision, ...change }).reason,
      "orchestrator_queue_selection_invalid",
    );
  assert.equal(
    applySelection(state, {
      ...decision,
      reason: "orchestrator_queue_empty",
      selectedQueueId: null,
      selectedQueueGeneration: null,
    }).status,
    "blocked",
  );
  assert.equal(encodeRuntimeStateValue(state), before);
});
/**
 * 解放確定は元世代を確認してから資源観測し、同じ解放証拠だけに結合する。
 * @responsibility 固定候補と観測順・拒否・対象外保持を反証する。
 * @trace PRL-UT-006
 * @precondition 値操作用の合成Snapshot。実Owner・実資源・全体codecの根拠ではない。
 * @stimulus 成功値と世代・Identity・観測の不一致を渡す。
 * @observation 固定結果、候補全文、元値、観測順と回数。
 * @oracle 認可・資源観測を代用せず、元条件と対象外区画を維持する。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domain候補と有限同期観測。実保存は結合試験が所有する。
 */

test("Queue解放確定は資源不明・intent残存・元証拠差を成功にしない", () => {
  const { current, regular } = fixture();
  const entry = {
    ...regular,
    state: "completed" as const,
    ownerGeneration: "owner-a",
  };
  // この候補が参照する既存証拠fieldだけの局所値。全体Envelope codecの成立は実Store試験で確認する。
  const evidence = {
    projectId: "project-a",
    content: {
      queueId: "queue-a",
      kind: "project-operation",
      ownerGeneration: "owner-a",
      disposition: "released",
    },
  } as unknown as CoordinatorSnapshot["leaseEvidence"][number];
  const state = {
    ...current,
    queueEntries: [entry],
    leaseEvidence: [evidence],
  };
  let calls = 0;
  const ops = {
    resourcesAbsent: () => {
      calls++;
      return true;
    },
  };
  assert.equal(
    releaseQueue(state, "queue-a", 2, "owner-a", ops).status,
    "blocked",
  );
  assert.equal(calls, 0);
  const result = releaseQueue(state, "queue-a", 1, "owner-a", ops);
  assert.equal(result.status, "completed");
  assert.equal(calls, 1);
  if (result.status === "completed") {
    assert.equal(result.value.value.ownerGeneration, null);
    assert.equal(result.value.value.generation, 2);
  }
  for (const value of [false, Promise.resolve(true)])
    assert.equal(
      releaseQueue(state, "queue-a", 1, "owner-a", {
        resourcesAbsent: () => value as boolean,
      }).status,
      "blocked",
    );
  assert.equal(
    releaseQueue({ ...state, leaseEvidence: [] }, "queue-a", 1, "owner-a", ops)
      .reason,
    "orchestrator_queue_release_evidence_mismatch",
  );
  assert.equal(
    releaseQueue(
      {
        ...state,
        leaseIntents: [
          {
            projectId: "project-a",
            queueId: "queue-a",
            kind: "project-operation",
            ownerGeneration: "owner-a",
            ownerProcessId: 7,
            recoveryId: "recovery-a",
            phase: "release_pending",
          },
        ],
      },
      "queue-a",
      1,
      "owner-a",
      ops,
    ).reason,
    "orchestrator_queue_release_intent_unsettled",
  );
});
