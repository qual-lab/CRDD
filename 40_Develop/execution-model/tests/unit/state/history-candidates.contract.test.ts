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
import fs from "node:fs";
import test from "node:test";
import { compileFunction } from "node:vm";
import { sourceDeclaration } from "../../support/source-declaration.ts";
import * as stateValidation from "../../../src/state/validation.ts";
import type { HistoryRow } from "../../../src/history/types.ts";
import type { ProjectQueueEntry } from "../../../src/index.ts";
import type {
  LeaseEvidenceEnvelope,
  Snapshot,
  SnapshotObservations,
} from "../../../src/state/types.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "../../../src/state/types.ts";
import { encodeStateValue } from "../../../src/state/operations.ts";
import type { ResultRecord } from "../../../src/workspace/types.ts";
import { EXECUTION_INTEGRATION_CONTRACT } from "../../../src/workspace/validation.ts";

type Candidate<T> =
  | {
      status: "completed";
      reason: string;
      value: { next: Snapshot | null; value: T };
    }
  | {
      status: "blocked";
      reason: string;
      value: null;
      manualRecoveryRequired: boolean;
      recoveryId: null;
    };
type Obligations = { obligations: () => SnapshotObservations };
type Settlement = {
  historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
};

// 完成CRUDに閉じた候補生成の実宣言を使い、試験のための製品公開を追加しない。
const candidateSource = fs.readFileSync(
  new URL("../../../src/history/crud.ts", import.meta.url),
  "utf8",
);
const candidateNames = [
  "historyCandidateCompleted",
  "historyCandidateBlocked",
  "prepareHistoryPending",
  "prepareTerminalRecordRetirement",
  "prepareHistoryTransfer",
];
const candidateDependencies = { ...stateValidation, PROJECT_SNAPSHOT_SCHEMA };
const {
  prepareHistoryPending,
  prepareTerminalRecordRetirement,
  prepareHistoryTransfer,
} = compileFunction(
  candidateNames
    .map((name) => sourceDeclaration(candidateSource, name))
    .join("\n") +
    "\nreturn {prepareHistoryPending,prepareTerminalRecordRetirement,prepareHistoryTransfer};",
  Object.keys(candidateDependencies),
)(...Object.values(candidateDependencies)) as {
  prepareHistoryPending: (
    current: Snapshot,
    now: number,
    observations: Obligations,
  ) => Candidate<number>;
  prepareTerminalRecordRetirement: (
    current: Snapshot,
    observations: Obligations & Settlement & { nextEpoch: () => string },
  ) => Candidate<number>;
  prepareHistoryTransfer: (
    current: Snapshot,
    observations: Settlement,
  ) => Candidate<{ recorded: number; expired: number }>;
};

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
  ] as unknown as Snapshot["projects"];
  const current: Snapshot = {
    schema: PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 7,
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
    decisions: [],
    blockers: [],
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
          schema: PROJECT_SNAPSHOT_SCHEMA,
          processId: 7,
          leaseResourcesAbsent: () => {
            calls.push("lease");
            return true;
          },
          historySettlement: () => {
            calls.push("inner-history");
            return "recorded" as const;
          },
          decisionHistorySettlement: () => null,
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
    before = encodeStateValue(current);
  assert.equal(prepareHistoryPending(current, -1, o.ops).status, "blocked");
  assert.equal(
    prepareHistoryPending(
      { ...current, schema: "wrong" } as unknown as Snapshot,
      1000,
      o.ops,
    ).status,
    "blocked",
  );
  assert.deepEqual(o.calls, []);
  const result = prepareHistoryPending(current, 1000, o.ops);
  assert.equal(result.status, "completed");
  assert.deepEqual(o.calls, ["obligations", "lease", "lease"]);
  if (result.status === "completed")
    assert.deepEqual(result.value.next, { ...current, historyPending: [row] });
  const existing = observations();
  const repeated = prepareHistoryPending(
    { ...current, historyPending: [row] },
    1000,
    existing.ops,
  );
  assert.equal(repeated.status, "completed");
  assert.deepEqual(existing.calls, []);
  if (repeated.status === "completed") assert.equal(repeated.value.next, null);
  assert.equal(encodeStateValue(current), before);
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
  const result = prepareTerminalRecordRetirement(current, o.ops);
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
    before = encodeStateValue(current);
  for (const value of [null, Promise.resolve("recorded"), true]) {
    const o = observations();
    const result = prepareTerminalRecordRetirement(current, {
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
      prepareTerminalRecordRetirement(current, {
        ...o.ops,
        historySettlement: () => {
          throw Error("observation");
        },
      }),
    /observation/,
  );
  assert.equal(o.calls.includes("epoch"), false);
  assert.equal(encodeStateValue(current), before);
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
  const bad = prepareHistoryTransfer(current, {
    historySettlement: (row) => {
      calls.push(row.id);
      return null;
    },
  });
  assert.equal(bad.status, "blocked");
  assert.deepEqual(calls, ["queue-a"]);
  const result = prepareHistoryTransfer(current, {
    historySettlement: (row) => (row.id === "queue-a" ? "recorded" : "expired"),
  });
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.deepEqual(result.value.value, { recorded: 1, expired: 1 });
    assert.deepEqual(result.value.next, { ...current, historyPending: [] });
  }
  const empty = prepareHistoryTransfer(f.current, {
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
  const record: ResultRecord = {
    contract: EXECUTION_INTEGRATION_CONTRACT,
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
    result = prepareTerminalRecordRetirement(current, o.ops);
  assert.equal(result.status, "completed");
  assert.equal(o.calls.includes("epoch"), false);
  if (result.status === "completed") {
    assert.equal(result.value.next?.intakeEpoch, current.intakeEpoch);
    assert.deepEqual(result.value.next?.results, []);
    assert.deepEqual(result.value.next?.queueEntries, current.queueEntries);
  }
  const zero = observations(),
    none = prepareTerminalRecordRetirement(f.current, zero.ops);
  assert.equal(none.status, "completed");
  if (none.status === "completed") assert.equal(none.value.next, null);
  assert.deepEqual(zero.calls, []);
});
