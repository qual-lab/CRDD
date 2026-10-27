/**
 * 履歴三用途の候補と同期観測順を検証する。
 * @packageDocumentation
 * @responsibility 出版を代用せずpending生成・退役・搬送確認の元版保持を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 局所合成値と有限観測。完全codec・実保存は対象外。
 * @boundary メモリだけ。publisher・実Owner・Fileを操作しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareCoordinatorHistoryPending as prepare,
  prepareCoordinatorTerminalRecordRetirement as retire,
  prepareCoordinatorHistoryTransfer as transfer,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  COORDINATOR_INTEGRATION_CONTRACT,
  encodeRuntimeStateValue,
  type CoordinatorSnapshot,
  type ProjectQueueEntry,
  type HistoryRow,
  type CoordinatorResultRecord,
  type LeaseEvidenceEnvelope,
} from "../../../src/index.ts";
/**
 * 一般Queue終了条件を検査する局所fixtureを作る。
 * @responsibility 有限観測の順序と対象外保持を検証する。
 * @trace PRL-UT-006
 * @precondition 局所合成Snapshotで、完全codecの成立とは区別する。
 * @stimulus 正常・不一致・観測不能・例外を注入する。
 * @observation 元版本文、候補全文、観測順とepoch回数。
 * @oracle 確定前のpendingを除去せず、対象以外を保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary Domain値候補と用途固定同期観測。
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
    state: "cancelled",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
    workspaceId: null,
  };
  // 閉鎖条件が読むProject区画だけの局所fixture。完全codec又はCoreの作成成功ではない。
  const projects = [
    {
      projectId: "project-a",
      milestoneId: "milestone-a",
      milestone: { state: "cancelled", criterionEvidenceIds: [] },
      tasks: [],
      objectives: [],
    },
  ] as unknown as CoordinatorSnapshot["projects"];
  const current: CoordinatorSnapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [{ queueId: "queue-a", epoch: "epoch-a" }],
    projects,
    queueEntries: [queue],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  const row: HistoryRow = {
    id: "queue-a",
    occurredAt: new Date(1000).toISOString(),
    outcome: "cancelled",
    primaryFailure: "cancel",
    cleanup: "confirmed",
  };
  return { current, row, queue };
}
/**
 * 同じOwnerに結合した観測の代役を作る。
 * @responsibility 有限観測の順序と対象外保持を検証する。
 * @trace PRL-UT-006
 * @precondition 局所合成Snapshotで、完全codecの成立とは区別する。
 * @stimulus 正常・不一致・観測不能・例外を注入する。
 * @observation 元版本文、候補全文、観測順とepoch回数。
 * @oracle 確定前のpendingを除去せず、対象以外を保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary Domain値候補と用途固定同期観測。
 */

function observations() {
  const calls: string[] = [];
  return {
    calls,
    ops: {
      obligations: () => {
        calls.push("obligations");
        return {
          schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
          processId: 7,
          leaseResourcesAbsent: () => {
            calls.push("lease");
            return true;
          },
          historySettlement: () => {
            calls.push("inner-history");
            return "recorded" as const;
          },
        };
      },
      historySettlement: (row: HistoryRow) => {
        calls.push(`history:${row.id}`);
        return "recorded" as const;
      },
      nextEpoch: () => {
        calls.push("epoch");
        return "epoch-next";
      },
    },
  };
}
/**
 * 要約生成の前提拒否と元pendingの短絡を確認する。
 * @responsibility 有限観測の順序と対象外保持を検証する。
 * @trace PRL-UT-006
 * @precondition 局所合成Snapshotで、完全codecの成立とは区別する。
 * @stimulus 正常・不一致・観測不能・例外を注入する。
 * @observation 元版本文、候補全文、観測順とepoch回数。
 * @oracle 確定前のpendingを除去せず、対象以外を保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary Domain値候補と用途固定同期観測。
 */

test("pending生成は時刻・Schemaを先に検査し既存対象の観測を省く", () => {
  const { current, row } = fixture(),
    o = observations(),
    before = encodeRuntimeStateValue(current);
  assert.equal(prepare(current, -1, o.ops).status, "blocked");
  assert.equal(
    prepare(
      { ...current, schema: "wrong" } as unknown as CoordinatorSnapshot,
      1000,
      o.ops,
    ).status,
    "blocked",
  );
  assert.deepEqual(o.calls, []);
  const result = prepare(current, 1000, o.ops);
  assert.equal(result.status, "completed");
  assert.deepEqual(o.calls, ["obligations", "lease", "lease"]);
  if (result.status === "completed")
    assert.deepEqual(result.value.next, { ...current, historyPending: [row] });
  const existing = observations();
  const repeated = prepare(
    { ...current, historyPending: [row] },
    1000,
    existing.ops,
  );
  assert.equal(repeated.status, "completed");
  assert.deepEqual(existing.calls, []);
  if (repeated.status === "completed") assert.equal(repeated.value.next, null);
  assert.equal(encodeRuntimeStateValue(current), before);
});
/**
 * Queue退役でのみ世代を作り、対象外区画を全文保持する。
 * @responsibility 有限観測の順序と対象外保持を検証する。
 * @trace PRL-UT-006
 * @precondition 局所合成Snapshotで、完全codecの成立とは区別する。
 * @stimulus 正常・不一致・観測不能・例外を注入する。
 * @observation 元版本文、候補全文、観測順とepoch回数。
 * @oracle 確定前のpendingを除去せず、対象以外を保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary Domain値候補と用途固定同期観測。
 */

test("退役は閉鎖判定と履歴再読の後だけQueue・受付を除きepochを一回更新する", () => {
  const f = fixture(),
    o = observations(),
    other = {
      ...f.queue,
      queueId: "queue-other",
      state: "queued" as const,
    };
  const current = {
    ...f.current,
    queueEntries: [...f.current.queueEntries, other],
    intakeBindings: [
      ...f.current.intakeBindings,
      { queueId: "queue-other", epoch: "epoch-a" },
    ],
    historyPending: [f.row],
  };
  const result = retire(current, o.ops);
  assert.equal(result.status, "completed");
  assert.deepEqual(o.calls, [
    "obligations",
    "lease",
    "lease",
    "history:queue-a",
    "epoch",
  ]);
  if (result.status === "completed")
    assert.deepEqual(result.value.next, {
      ...current,
      intakeEpoch: "epoch-next",
      queueEntries: [other],
      intakeBindings: [{ queueId: "queue-other", epoch: "epoch-a" }],
      historyPending: [],
    });
});
/**
 * 履歴不明・例外ではpendingと元版を保全する。
 * @responsibility 有限観測の順序と対象外保持を検証する。
 * @trace PRL-UT-006
 * @precondition 局所合成Snapshotで、完全codecの成立とは区別する。
 * @stimulus 正常・不一致・観測不能・例外を注入する。
 * @observation 元版本文、候補全文、観測順とepoch回数。
 * @oracle 確定前のpendingを除去せず、対象以外を保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary Domain値候補と用途固定同期観測。
 */

test("退役は観測不能・非同期の履歴を拒否しepochを発行しない", () => {
  const f = fixture(),
    current = { ...f.current, historyPending: [f.row] },
    before = encodeRuntimeStateValue(current);
  for (const value of [null, Promise.resolve("recorded"), true]) {
    const o = observations();
    const result = retire(current, {
      ...o.ops,
      historySettlement: () => {
        o.calls.push("history");
        return value as never;
      },
    });
    assert.equal(result.reason, "orchestrator_history_transfer_unconfirmed");
    assert.deepEqual(o.calls, ["obligations", "lease", "lease", "history"]);
  }
  const o = observations();
  assert.throws(
    () =>
      retire(current, {
        ...o.ops,
        historySettlement: () => {
          throw Error("observation");
        },
      }),
    /observation/,
  );
  assert.equal(o.calls.includes("epoch"), false);
  assert.equal(encodeRuntimeStateValue(current), before);
});
/**
 * pending搬送は全行確認又は最初の未確認で短絡する。
 * @responsibility 有限観測の順序と対象外保持を検証する。
 * @trace PRL-UT-006
 * @precondition 局所合成Snapshotで、完全codecの成立とは区別する。
 * @stimulus 正常・不一致・観測不能・例外を注入する。
 * @observation 元版本文、候補全文、観測順とepoch回数。
 * @oracle 確定前のpendingを除去せず、対象以外を保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary Domain値候補と用途固定同期観測。
 */

test("搬送候補は先頭不明で後続を読まず、全行確認後だけpendingを除去する", () => {
  const f = fixture(),
    other = { ...f.row, id: "queue-b" },
    current = { ...f.current, historyPending: [f.row, other] };
  const calls: string[] = [];
  const bad = transfer(current, {
    historySettlement: (row) => {
      calls.push(row.id);
      return null;
    },
  });
  assert.equal(bad.status, "blocked");
  assert.deepEqual(calls, ["queue-a"]);
  const result = transfer(current, {
    historySettlement: (row) => (row.id === "queue-a" ? "recorded" : "expired"),
  });
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.deepEqual(result.value.value, { recorded: 1, expired: 1 });
    assert.deepEqual(result.value.next, { ...current, historyPending: [] });
  }
  const empty = transfer(f.current, {
    historySettlement: () => {
      throw Error("must_not_run");
    },
  });
  assert.equal(empty.status, "completed");
  if (empty.status === "completed") assert.equal(empty.value.next, null);
});
/**
 * 採用結果だけの退役は受付世代を変更しない。
 * @responsibility 有限観測の順序と対象外保持を検証する。
 * @trace PRL-UT-006
 * @precondition 局所合成Snapshotで、完全codecの成立とは区別する。
 * @stimulus 正常・不一致・観測不能・例外を注入する。
 * @observation 元版本文、候補全文、観測順とepoch回数。
 * @oracle 確定前のpendingを除去せず、対象以外を保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary Domain値候補と用途固定同期観測。
 */

test("adoption-only退役と退役零件はepochを生成しない", () => {
  const f = fixture(),
    id = "adoption-a";
  const record: CoordinatorResultRecord = {
    contract: COORDINATOR_INTEGRATION_CONTRACT,
    kind: "adoption",
    repositoryBindingId: "binding-a",
    projectId: "project-adoption",
    milestoneId: null,
    queueId: "canonical",
    identity: id,
    contentHash: "a".repeat(64),
    value: {
      status: "completed",
      receiptId: id,
      beforeRevision: "a".repeat(40),
      afterRevision: "b".repeat(40),
      changedPaths: ["source.ts"],
      cleanupConfirmed: true,
    },
  };
  const evidence = (
    disposition: "acquired" | "released",
  ): LeaseEvidenceEnvelope => ({
    schema: "crdd-coordinator/orchestrator-durable-foundation/v1",
    schemaRevision: 1,
    recordKind: "lease-evidence",
    repositoryBindingId: "binding-a",
    projectId: "project-adoption",
    createdGeneration: 1,
    updatedGeneration: disposition === "acquired" ? 1 : 2,
    contentHash: "a".repeat(64),
    content: {
      kind: "canonical-adoption",
      queueId: "canonical",
      ownerGeneration: "owner-adoption",
      ownerProcessId: 7,
      disposition,
    },
  });
  const current = {
    ...f.current,
    results: [record],
    leaseEvidence: [evidence("acquired"), evidence("released")],
    historyPending: [{ ...f.row, id }],
  };
  const o = observations(),
    result = retire(current, o.ops);
  assert.equal(result.status, "completed");
  assert.equal(o.calls.includes("epoch"), false);
  if (result.status === "completed") {
    assert.equal(result.value.next?.intakeEpoch, current.intakeEpoch);
    assert.deepEqual(result.value.next?.results, []);
    assert.deepEqual(result.value.next?.queueEntries, current.queueEntries);
  }
  const zero = observations(),
    none = retire(f.current, zero.ops);
  assert.equal(none.status, "completed");
  if (none.status === "completed") assert.equal(none.value.next, null);
  assert.deepEqual(zero.calls, []);
});
