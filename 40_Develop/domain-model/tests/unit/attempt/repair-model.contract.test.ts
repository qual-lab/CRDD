/**
 * Domainが所有するTaskと実行環境修復の値契約を反証する。
 * @packageDocumentation
 * @responsibility 修復へ偽Task情報を持たせず、対象外操作の保全を反証する。
 * @trace ERB-UT-036
 * @level UT
 * @scope v2-only、variant Identity、修復checkpoint、対象外全文。
 * @boundary N/A: メモリ値だけ。Writer・実修復は対象外。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import {
  COORDINATOR_STATE_SCHEMA,
  type CoordinatorStateRepairOperation,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  RUNTIME_STATE_MAXIMUM_BYTES,
} from "../../../src/index.ts";

type DockerRuntimeRepairDisposalCheckpoint = NonNullable<
  CoordinatorStateRepairOperation["disposal"]
>["checkpoint"];

import {
  classifyCoordinatorRepairPublication,
  coordinatorRepairCanComplete,
  decodeCoordinatorHistoryRows,
  prepareCoordinatorHistoryRetention,
  prepareCoordinatorRepairHistoryLine,
  prepareCoordinatorRepairHistoryPublication,
  prepareCoordinatorRepairHistorySnapshot,
  prepareCoordinatorRepairHistorySummary,
  prepareCoordinatorStateHistoryLine,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateRepairCheckpointSnapshot,
  prepareCoordinatorStateRepairCompletionSnapshot,
  prepareCoordinatorStateRepairDisposalDecisionSnapshot,
  prepareCoordinatorStateRepairDisposalProgressSnapshot,
  prepareCoordinatorStateRepairRetentionHandoffSnapshot,
  prepareCoordinatorStateRepairSessionSnapshot,
  prepareCoordinatorStateRepairSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  validateCoordinatorStateRepairDisposalTransition,
  validateCoordinatorStateRepairRetentionHandoffTransition,
  validateCoordinatorStateRepairSessionTransition,
  validateCoordinatorStateTransition,
  validateCoordinatorUnifiedTransition,
} from "../../../src/index.ts";

const binding = "a".repeat(64);
const identity = {
  schema: "crdd-coordinator/runtime-repair-identity/v2",
  kind: "runtime_repair",
  operationNonce: "e".repeat(64),
  operationId: "OP-123456",
  repositoryBinding: binding,
  consumer: "coordinator_cli",
};
const text = `${JSON.stringify(identity)}\n`;
const names = [
  "stop_runtime",
  "stop_backend",
  "retain_runtime",
  "start_runtime",
  "stop_failed_runtime",
  "retain_failed_runtime",
  "retain_auxiliary_runtime",
  "restart_runtime",
] as const;
const initial = {
  actions: Object.fromEntries(
    names.map((key) => [
      key,
      { intent: "not_saved", request: "not_issued", result: "unobserved" },
    ]),
  ) as Record<
    (typeof names)[number],
    { intent: string; request: string; result: string }
  >,
  directories: Object.fromEntries(
    ["primary", "failed", "auxiliary"].map((key) => [
      key,
      {
        expected: null as {
          dev: string;
          ino: string;
          birthtimeNs: string;
        } | null,
        source: { state: "unobserved", identity: null },
        retained: {
          state: "unobserved",
          identity: null as {
            dev: string;
            ino: string;
            birthtimeNs: string;
          } | null,
        },
      },
    ]),
  ),
  engine: "unobserved",
  stale: "unknown",
  hostSafety: "unknown",
  cleanup: "not_requested",
  cleanupFailure: null,
};

/**
 * fixed初期修復を実codecから取り出す。
 * @responsibility 試験前提を架空の型castで作らない。
 * @trace ERB-UT-036
 * @precondition 純粋な固定Identity。
 * @stimulus 初回Snapshotを生成・復号する。
 * @observation 最新Schemaとruntime_repair判別。
 * @oracle 実codecが初期値を受理する。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 値生成のみ。
 */
function fixture() {
  const bytes = prepareCoordinatorStateRepairSnapshot(null, text, binding);
  assert.ok(bytes);
  const observed = decodeRuntimeDomainSnapshot(bytes, binding);
  assert.ok(observed);
  const operation = observed.snapshot.operations[0];
  assert.ok(operation?.kind === "runtime_repair");
  return { bytes, observed, operation };
}

/**
 * 可変五fieldだけを技術checkpointへ接続する。
 * @responsibility 不変情報を更新入力へ混ぜない。
 * @trace ERB-UT-036
 * @precondition 復号済みの修復variant。
 * @stimulus 呼出し側の差分を五fieldに限定して構成する。
 * @observation 実更新関数の戻り値。
 * @oracle 更新候補は不変Identityを保持する。
 * @cleanup N/A: メモリだけ。
 * @boundary N/A: 純粋fixture。
 */
function update(
  operation: CoordinatorStateRepairOperation,
  changes: Record<string, unknown> = {},
) {
  return {
    phase: operation.phase,
    checkpoint: operation.checkpoint,
    disposition: operation.disposition,
    primaryFailure: operation.primaryFailure,
    outcome: operation.outcome,
    ...changes,
  };
}

/**
 * 全技術終端の修復を各phaseの反証入力として作る。
 * @responsibility phaseの拒否とcodec不正の拒否を分離する。
 * @trace ERB-UT-036
 * @precondition 正規の固定Identityと八処置。
 * @stimulus 比較対象のphase。
 * @observation 実decode成功と正規本文。
 * @oracle 各phaseの独立した合法Snapshotを返す。
 * @cleanup N/A: メモリのみ。
 * @boundary 純粋fixtureと実状態codec。
 */
function retentionFixture(phase: CoordinatorStateRepairOperation["phase"]) {
  const f = fixture();
  const technical = structuredClone(initial);
  technical.engine = "ready";
  technical.hostSafety = "safe";
  technical.cleanup = "confirmed";
  technical.stale = "retained";
  for (const name of names)
    technical.actions[name] = {
      intent: "saved",
      request: "issued",
      result: "confirmed",
    };
  for (const [purpose, index] of [
    ["primary", 3],
    ["failed", 6],
    ["auxiliary", 7],
  ] as const) {
    const id = { dev: "1", ino: String(index), birthtimeNs: "3" };
    technical.directories[purpose] = {
      expected: id,
      source: { state: "absent", identity: null },
      retained: { state: "present", identity: id },
    };
  }
  const bytes = Buffer.from(
    `${encodeRuntimeStateValue({
      ...f.observed.snapshot,
      operations: [
        {
          ...f.operation,
          phase,
          checkpoint: technical,
          disposition: ["repairing", "awaiting_disposition"].includes(phase)
            ? "pending_human_decision"
            : "retained_by_human_decision",
          outcome:
            phase === "repairing"
              ? null
              : {
                  status: "recovered",
                  reason: "runtime_repair_recovered",
                  cleanupConfirmed: true,
                },
        },
      ],
    })}\n`,
  );
  const current = decodeRuntimeDomainSnapshot(bytes, binding);
  assert.ok(current, phase);
  const operation = current.snapshot.operations[0];
  assert.ok(operation?.kind === "runtime_repair");
  return { bytes, current, operation };
}

/**
 * 明示保持の期限・対象と一行要約を専用候補へ固定する。
 * @responsibility 純粋候補を実引渡しや一般保存の許可へ昇格しない。
 * @trace ERB-UT-036
 * @precondition 実codec合法な未出版の判断待ち。
 * @stimulus 正規7日、用途差、日付差、元値変更、履歴時刻差。
 * @observation 専用再導出、一般遷移拒否、要約全fieldと履歴行。
 * @oracle 専用形だけ一改訂、旧bytes維持、履歴確認後の専用終了候補だけ対象除去。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 純粋値。Writer／fresh読取り／CLI／期限整理は対象外。
 */
test("保持引渡し候補: exact7日と三用途を一度だけ固定する", () => {
  const f = retentionFixture("awaiting_disposition");
  const id = f.operation.recoveryId;
  const receipt = {
    decidedAt: "2026-10-17T00:00:00.000Z",
    reviewAfter: "2026-10-24T00:00:00.000Z",
    targets: {
      primary: { dev: "1", ino: "3", birthtimeNs: "3" },
      failed: { dev: "1", ino: "6", birthtimeNs: "3" },
      auxiliary: { dev: "1", ino: "7", birthtimeNs: "3" },
    },
  };
  const before = Buffer.from(f.bytes);
  const candidate = prepareCoordinatorStateRepairRetentionHandoffSnapshot(
    f.bytes,
    id,
    receipt,
    binding,
  );
  assert.ok(candidate);
  assert.equal(
    validateCoordinatorStateRepairRetentionHandoffTransition(
      f.bytes,
      candidate,
      id,
      binding,
    ),
    true,
  );
  assert.equal(
    classifyCoordinatorRepairPublication(f.bytes, candidate, id, binding)?.mode,
    "retention_handoff",
  );
  assert.equal(
    classifyCoordinatorRepairPublication(candidate, candidate, id, binding)
      ?.mode,
    "remove_pending",
  );
  assert.equal(
    classifyCoordinatorRepairPublication(
      f.bytes,
      candidate,
      "different-id",
      binding,
    ),
    null,
  );
  assert.equal(
    classifyCoordinatorRepairPublication(
      Buffer.from(` ${f.bytes.toString()}`),
      candidate,
      id,
      binding,
    ),
    null,
  );
  assert.equal(
    validateCoordinatorStateTransition(f.bytes, candidate, binding),
    false,
  );
  const next = decodeRuntimeDomainSnapshot(candidate, binding);
  assert.ok(next);
  const operation = next.snapshot.operations[0];
  assert.ok(operation?.kind === "runtime_repair");
  assert.deepEqual(operation, {
    ...f.operation,
    phase: "settling",
    disposition: "retained_by_human_decision",
    retention: receipt,
  });
  assert.equal(next.snapshot.revision, f.current.snapshot.revision + 1);
  assert.deepEqual(next.snapshot.previous, {
    revision: f.current.snapshot.revision,
    payloadSha256: f.current.payloadSha256,
  });
  assert.equal(
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      candidate,
      id,
      receipt,
      binding,
    ),
    null,
  );
  for (const invalid of [
    null,
    { ...receipt, extra: true },
    { decidedAt: receipt.decidedAt, targets: receipt.targets },
    { ...receipt, decidedAt: "2026-10-17T00:00:00Z" },
    {
      ...receipt,
      decidedAt: "+275760-09-13T00:00:00.000Z",
      reviewAfter: "+275760-09-20T00:00:00.000Z",
    },
    { ...receipt, reviewAfter: "2026-10-24T00:00:00.001Z" },
    { ...receipt, targets: { ...receipt.targets, primary: null } },
    {
      ...receipt,
      targets: {
        ...receipt.targets,
        primary: receipt.targets.failed,
        failed: receipt.targets.primary,
      },
    },
    {
      ...receipt,
      targets: {
        ...receipt.targets,
        auxiliary: { ...receipt.targets.auxiliary, ino: "8" },
      },
    },
    { ...receipt, targets: { primary: null, failed: null, auxiliary: null } },
  ])
    assert.equal(
      prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        f.bytes,
        id,
        invalid,
        binding,
      ),
      null,
    );
  assert.equal(
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      retentionFixture("settling").bytes,
      id,
      receipt,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      Buffer.from(` ${f.bytes.toString()}`),
      id,
      receipt,
      binding,
    ),
    null,
  );
  const summary = prepareCoordinatorRepairHistorySummary(
    candidate,
    id,
    binding,
  );
  assert.ok(summary && f.operation.checkpoint);
  const expected = {
    schema: "crdd-coordinator/repair-summary/v1",
    operationId: identity.operationId,
    operationNonce: identity.operationNonce,
    recoveryId: id,
    identitySha256: f.operation.identitySha256,
    primaryFailure: null,
    outcome: {
      status: "recovered",
      reason: "runtime_repair_recovered",
      cleanupConfirmed: true,
    },
    disposition: "retained_by_human_decision",
    technical: {
      actions: f.operation.checkpoint.actions,
      engine: "ready",
      stale: "retained",
      hostSafety: "safe",
      cleanup: "confirmed",
      cleanupFailure: null,
    },
  };
  assert.ok(
    summary.summaryBytes.equals(
      Buffer.from(
        `${encodeRuntimeStateValue({ ...expected, retention: receipt })}\n`,
      ),
    ),
  );
  const old = prepareCoordinatorRepairHistorySummary(
    retentionFixture("settling").bytes,
    id,
    binding,
  );
  assert.ok(
    old?.summaryBytes.equals(
      Buffer.from(`${encodeRuntimeStateValue(expected)}\n`),
    ),
    "non_handoff_bytes_unchanged",
  );
  assert.equal(
    prepareCoordinatorRepairHistorySnapshot(
      candidate,
      id,
      "2026-10-17T00:00:00.001Z",
      false,
      binding,
    ),
    null,
  );
  const pending = prepareCoordinatorRepairHistorySnapshot(
    candidate,
    id,
    receipt.decidedAt,
    false,
    binding,
  );
  assert.ok(pending);
  const published = prepareCoordinatorRepairHistorySnapshot(
    pending,
    id,
    receipt.decidedAt,
    true,
    binding,
  );
  assert.ok(published);
  assert.ok(
    prepareCoordinatorRepairHistoryLine(pending, id, binding)?.equals(
      prepareCoordinatorRepairHistoryLine(published, id, binding) as Buffer,
    ),
  );
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(pending, id, binding),
    null,
  );
  const completed = prepareCoordinatorStateRepairCompletionSnapshot(
    published,
    id,
    binding,
  );
  assert.ok(completed);
  const beforeCompletion = decodeRuntimeDomainSnapshot(published, binding);
  const afterCompletion = decodeRuntimeDomainSnapshot(completed, binding);
  assert.ok(beforeCompletion && afterCompletion);
  assert.deepEqual(afterCompletion.snapshot, {
    ...beforeCompletion.snapshot,
    revision: beforeCompletion.snapshot.revision + 1,
    previous: {
      revision: beforeCompletion.snapshot.revision,
      payloadSha256: beforeCompletion.payloadSha256,
    },
    operations: [],
  });
  assert.equal(
    validateCoordinatorStateTransition(published, completed, binding),
    false,
  );
  const originalNow = Date.now;
  try {
    for (const now of [
      "2026-10-23T23:59:59.999Z",
      receipt.reviewAfter,
      "2026-10-24T00:00:00.001Z",
    ]) {
      Date.now = () => Date.parse(now);
      assert.ok(
        prepareCoordinatorStateRepairCompletionSnapshot(
          published,
          id,
          binding,
        )?.equals(completed),
        "completion_is_not_expiry_gated",
      );
    }
  } finally {
    Date.now = originalNow;
  }
  assert.equal(
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      published,
      id,
      receipt,
      binding,
    ),
    null,
  );
  const row = prepareCoordinatorRepairHistoryLine(published, id, binding);
  assert.ok(row && decodeCoordinatorHistoryRows(row));
  const rows = decodeCoordinatorHistoryRows(row);
  assert.equal(
    rows?.[0] && "reviewAfter" in rows[0] ? rows[0].reviewAfter : null,
    receipt.reviewAfter,
  );
  const publishedValue = decodeRuntimeDomainSnapshot(published, binding);
  assert.ok(publishedValue);
  const withoutOperation = Buffer.from(
    `${encodeRuntimeStateValue({ ...publishedValue.snapshot, operations: [] })}\n`,
  );
  assert.ok(decodeRuntimeDomainSnapshot(withoutOperation, binding));
  const activeStates: readonly Buffer[] = [pending, published];
  for (const now of [
    "2026-10-23T23:59:59.999Z",
    receipt.reviewAfter,
    "2026-10-24T00:00:00.001Z",
  ]) {
    const expectedRow =
      now === "2026-10-23T23:59:59.999Z" ? row : Buffer.alloc(0);
    assert.ok(
      prepareCoordinatorHistoryRetention(
        withoutOperation,
        row,
        now,
        1,
        binding,
      )?.equals(expectedRow),
      `deadline_${now}`,
    );
    for (const active of activeStates) {
      assert.ok(
        prepareCoordinatorHistoryRetention(
          active,
          row,
          now,
          1,
          binding,
        )?.equals(row),
        "active_reference_independent_of_deadline",
      );
      assert.equal(
        prepareCoordinatorHistoryRetention(
          active,
          Buffer.alloc(0),
          now,
          1,
          binding,
        ),
        null,
        "active_receipt_missing_row",
      );
    }
  }
  assert.ok(
    prepareCoordinatorHistoryRetention(
      withoutOperation,
      row,
      "2026-10-24T00:00:00.001Z",
      30,
      binding,
    )?.equals(row),
    "normal_retention_still_applies_after_deadline",
  );
  const oldState = retentionFixture("settling").bytes;
  const oldPending = prepareCoordinatorRepairHistorySnapshot(
    oldState,
    id,
    receipt.decidedAt,
    false,
    binding,
  );
  assert.ok(oldPending);
  const oldPublished = prepareCoordinatorRepairHistorySnapshot(
    oldPending,
    id,
    receipt.decidedAt,
    true,
    binding,
  );
  assert.ok(oldPublished);
  const oldRow = prepareCoordinatorRepairHistoryLine(oldPublished, id, binding);
  assert.ok(oldRow);
  const decodedOldRows = decodeCoordinatorHistoryRows(oldRow);
  assert.ok(decodedOldRows?.[0]);
  assert.equal(
    Object.hasOwn(decodedOldRows[0], "reviewAfter"),
    false,
    "legacy_metadata_shape_unchanged",
  );
  assert.equal(
    prepareCoordinatorHistoryRetention(
      withoutOperation,
      oldRow,
      "2026-10-23T23:59:59.999Z",
      1,
      binding,
    )?.length,
    0,
    "non_handoff_uses_normal_period",
  );
  const corruptDeadline = JSON.parse(row.toString());
  corruptDeadline.summary.retention.reviewAfter = "2026-10-24T00:00:00.001Z";
  assert.equal(
    prepareCoordinatorHistoryRetention(
      withoutOperation,
      Buffer.from(`${encodeRuntimeStateValue(corruptDeadline)}\n`),
      receipt.reviewAfter,
      1,
      binding,
    ),
    null,
  );
  const wrongRow = JSON.parse(row.toString());
  wrongRow.occurredAt = "2026-10-17T00:00:00.001Z";
  assert.equal(
    decodeCoordinatorHistoryRows(
      Buffer.from(`${encodeRuntimeStateValue(wrongRow)}\n`),
    ),
    null,
  );
  const forged = decodeRuntimeDomainSnapshot(candidate, binding);
  assert.ok(forged);
  const mutated = Buffer.from(
    `${encodeRuntimeStateValue({ ...forged.snapshot, operations: [{ ...operation, primaryFailure: null, identitySha256: "1".repeat(64) }] })}\n`,
  );
  assert.equal(
    validateCoordinatorStateRepairRetentionHandoffTransition(
      f.bytes,
      mutated,
      id,
      binding,
    ),
    false,
  );
  const legalChangedCheckpoint = {
    ...operation.checkpoint,
    actions: {
      ...operation.checkpoint?.actions,
      stop_runtime: {
        intent: "not_saved",
        request: "not_issued",
        result: "not_required",
      },
    },
  };
  const legalChanged = Buffer.from(
    `${encodeRuntimeStateValue({ ...forged.snapshot, operations: [{ ...operation, checkpoint: legalChangedCheckpoint }] })}\n`,
  );
  assert.ok(
    decodeRuntimeDomainSnapshot(legalChanged, binding),
    "legal_source_change_before_oracle",
  );
  assert.equal(
    validateCoordinatorStateRepairRetentionHandoffTransition(
      f.bytes,
      legalChanged,
      id,
      binding,
    ),
    false,
  );
  for (const hasExpected of [false, true]) {
    const original = structuredClone(f.current.snapshot);
    const mixedOperation = original.operations[0];
    assert.ok(
      mixedOperation?.kind === "runtime_repair" && mixedOperation.checkpoint,
    );
    const mixedCheckpoint = {
      ...mixedOperation.checkpoint,
      actions: {
        ...mixedOperation.checkpoint.actions,
        retain_failed_runtime: {
          intent: hasExpected ? "saved" : "not_saved",
          request: "not_issued",
          result: "not_required",
        },
      },
      directories: {
        ...mixedOperation.checkpoint.directories,
        failed: {
          expected: hasExpected ? receipt.targets.failed : null,
          source: hasExpected
            ? { state: "present", identity: receipt.targets.failed }
            : { state: "absent", identity: null },
          retained: { state: "absent", identity: null },
        },
      },
    };
    const mixedBytes = Buffer.from(
      `${encodeRuntimeStateValue({ ...original, operations: [{ ...mixedOperation, checkpoint: mixedCheckpoint }] })}\n`,
    );
    assert.ok(
      decodeRuntimeDomainSnapshot(mixedBytes, binding),
      "legal_mixed_absent",
    );
    const mixedReceipt = {
      ...receipt,
      targets: { ...receipt.targets, failed: null },
    };
    const mixedCandidate =
      prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        mixedBytes,
        id,
        mixedReceipt,
        binding,
      );
    assert.ok(mixedCandidate);
    assert.equal(
      validateCoordinatorStateRepairRetentionHandoffTransition(
        mixedBytes,
        mixedCandidate,
        id,
        binding,
      ),
      true,
    );
    assert.equal(
      validateCoordinatorStateTransition(mixedBytes, mixedCandidate, binding),
      false,
    );
    const mixedSummary = prepareCoordinatorRepairHistorySummary(
      mixedCandidate,
      id,
      binding,
    );
    assert.ok(mixedSummary);
    assert.ok(
      mixedSummary.summaryBytes.equals(
        Buffer.from(
          `${encodeRuntimeStateValue({ ...expected, technical: { ...expected.technical, actions: mixedCheckpoint.actions }, retention: mixedReceipt })}\n`,
        ),
      ),
    );
    const mixedHistory = prepareCoordinatorRepairHistorySnapshot(
      mixedCandidate,
      id,
      receipt.decidedAt,
      false,
      binding,
    );
    assert.ok(mixedHistory);
    assert.equal(
      prepareCoordinatorRepairHistorySnapshot(
        mixedCandidate,
        id,
        "2026-10-17T00:00:00.001Z",
        false,
        binding,
      ),
      null,
    );
    assert.equal(
      prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        mixedBytes,
        id,
        receipt,
        binding,
      ),
      null,
      "absent_target_nonnull",
    );
    assert.equal(
      prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        mixedBytes,
        id,
        {
          ...mixedReceipt,
          targets: {
            ...mixedReceipt.targets,
            primary: receipt.targets.auxiliary,
            auxiliary: receipt.targets.primary,
          },
        },
        binding,
      ),
      null,
      "purpose_swap",
    );
  }
  assert.ok(f.bytes.equals(before));
});

/**
 * 未出版の回収判断と一用途進捗を正規元版へ結合する。
 * @responsibility 元結果・兄弟操作を保全し、同値更新で改訂を増やさない。
 * @trace ERB-UT-036
 * @precondition 技術終端・保持判断待ちの正規値と別の修復操作。
 * @stimulus decision、各用途の意図保存、同値、別用途・一般遷移。
 * @observation 前後全文・Hash相関・専用validator・通常validator。
 * @oracle 専用再導出だけ成立し、元修復と対象外は不変。
 * @cleanup N/A: メモリのみ。
 * @boundary 物理Writer・実体・削除・保存Effectは対象外。
 */
test("修復回収: 専用判断と一用途進捗だけを結合する", () => {
  const f = retentionFixture("awaiting_disposition");
  const sibling = retentionFixture("awaiting_delivery").operation;
  const siblingIdentity = {
    ...identity,
    operationNonce: "f".repeat(64),
    operationId: "OP-654321",
  };
  const siblingJson = `${JSON.stringify(siblingIdentity)}\n`;
  const siblingHash = createHash("sha256").update(siblingJson).digest("hex");
  const before = Buffer.from(
    `${encodeRuntimeStateValue({
      ...f.current.snapshot,
      operations: [
        f.operation,
        {
          ...sibling,
          identityJson: siblingJson,
          identitySha256: siblingHash,
          recoveryId: `docker-runtime-repair.${siblingIdentity.operationNonce}.${siblingHash}`,
        },
      ],
    })}\n`,
  );
  assert.ok(decodeRuntimeDomainSnapshot(before, binding));
  const id = f.operation.recoveryId;
  const time = "2026-10-17T00:00:00.000Z";
  const candidate = prepareCoordinatorStateRepairDisposalDecisionSnapshot(
    before,
    id,
    time,
    binding,
  );
  assert.ok(candidate);
  const actual = decodeRuntimeDomainSnapshot(candidate, binding);
  assert.ok(actual);
  const operation = actual.snapshot.operations[0];
  assert.ok(operation?.kind === "runtime_repair" && operation.disposal);
  assert.equal(operation.disposition, "discard");
  assert.equal(operation.disposal.decidedAt, time);
  assert.deepEqual(
    {
      ...operation,
      phase: f.operation.phase,
      disposition: f.operation.disposition,
      disposal: null,
    },
    f.operation,
  );
  assert.deepEqual(
    actual.snapshot.operations[1],
    decodeRuntimeDomainSnapshot(before, binding)?.snapshot.operations[1],
  );
  assert.deepEqual(
    actual.snapshot.unresolvedRecoveries,
    f.current.snapshot.unresolvedRecoveries,
  );
  assert.deepEqual(
    actual.snapshot.pendingDeliveries,
    f.current.snapshot.pendingDeliveries,
  );
  assert.equal(actual.snapshot.revision, f.current.snapshot.revision + 1);
  assert.deepEqual(actual.snapshot.previous, {
    revision: f.current.snapshot.revision,
    payloadSha256: decodeRuntimeDomainSnapshot(before, binding)?.payloadSha256,
  });
  assert.equal(
    validateCoordinatorStateRepairDisposalTransition(
      before,
      candidate,
      id,
      "decision",
      binding,
    ),
    true,
  );
  assert.equal(
    classifyCoordinatorRepairPublication(before, candidate, id, binding)?.mode,
    "disposal_decision",
  );
  assert.equal(
    validateCoordinatorStateTransition(before, candidate, binding),
    false,
  );
  assert.equal(
    prepareCoordinatorStateRepairDisposalDecisionSnapshot(
      candidate,
      id,
      time,
      binding,
    ),
    null,
  );
  const same = prepareCoordinatorStateRepairDisposalProgressSnapshot(
    candidate,
    id,
    "primary",
    operation.disposal.checkpoint,
    binding,
  );
  assert.ok(same?.equals(candidate));
  assert.equal(
    validateCoordinatorStateRepairDisposalTransition(
      candidate,
      same,
      id,
      "primary",
      binding,
    ),
    true,
  );
  for (const purpose of ["primary", "failed", "auxiliary"] as const) {
    const nextCheckpoint: DockerRuntimeRepairDisposalCheckpoint =
      structuredClone(operation.disposal.checkpoint);
    const changed: unknown = {
      ...nextCheckpoint,
      directories: {
        ...nextCheckpoint.directories,
        [purpose]: {
          intent: "saved",
          request: "not_issued",
          absence: "unobserved",
        },
      },
    };
    const next = prepareCoordinatorStateRepairDisposalProgressSnapshot(
      candidate,
      id,
      purpose,
      changed,
      binding,
    );
    assert.ok(next);
    assert.equal(
      validateCoordinatorStateRepairDisposalTransition(
        candidate,
        next,
        id,
        purpose,
        binding,
      ),
      true,
    );
    assert.equal(
      classifyCoordinatorRepairPublication(candidate, next, id, binding)?.mode,
      `disposal_${purpose}`,
    );
    assert.equal(
      classifyCoordinatorRepairPublication(next, next, id, binding)?.mode,
      "remove_pending",
    );
    assert.equal(
      validateCoordinatorStateRepairDisposalTransition(
        candidate,
        next,
        id,
        purpose === "primary" ? "failed" : "primary",
        binding,
      ),
      false,
    );
    assert.equal(
      validateCoordinatorStateTransition(candidate, next, binding),
      false,
    );
    const observed = decodeRuntimeDomainSnapshot(next, binding);
    assert.ok(observed);
    const target = observed.snapshot.operations[0];
    assert.ok(target?.kind === "runtime_repair" && target.disposal);
    assert.deepEqual({ ...target, disposal: operation.disposal }, operation);
    assert.deepEqual(
      observed.snapshot.operations.slice(1),
      actual.snapshot.operations.slice(1),
    );
    assert.equal(observed.snapshot.revision, actual.snapshot.revision + 1);
    assert.deepEqual(observed.snapshot.previous, {
      revision: actual.snapshot.revision,
      payloadSha256: actual.payloadSha256,
    });
    assert.ok(
      prepareCoordinatorStateRepairDisposalProgressSnapshot(
        next,
        id,
        purpose,
        changed,
        binding,
      )?.equals(next),
    );
    assert.equal(
      prepareCoordinatorStateRepairCompletionSnapshot(next, id, binding),
      null,
    );
  }
  assert.equal(
    prepareCoordinatorStateRepairDisposalProgressSnapshot(
      before,
      id,
      "primary",
      operation.disposal.checkpoint,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairDisposalProgressSnapshot(
      candidate,
      `${id}0`,
      "primary",
      operation.disposal.checkpoint,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairDisposalProgressSnapshot(
      candidate,
      id,
      "unknown",
      operation.disposal.checkpoint,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairDisposalDecisionSnapshot(
      Buffer.from(` ${before.toString()}`),
      id,
      time,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairDisposalProgressSnapshot(
      Buffer.from(` ${candidate.toString()}`),
      id,
      "primary",
      operation.disposal.checkpoint,
      binding,
    ),
    null,
  );
});

/**
 * 回収判断・進捗へ他の状態変更や出版偽装を混入させない。
 * @responsibility codec相関と専用再導出を別々に反証する。
 * @trace ERB-UT-036
 * @precondition decision候補と明示保持済みの正規値。
 * @stimulus 時刻・用途外・元結果・後続出版・通常更新の改竄。
 * @observation 実codec、専用validator、一般validator。
 * @oracle 不正相関・別対象・余剰更新を拒否し、保持との交差を許可しない。
 * @cleanup N/A: メモリのみ。
 * @boundary 保存Ownerと物理処置の実証ではない。
 */
test("修復回収: 元結果と判断を凍結し後続出版の先行偽装を拒否する", () => {
  const f = retentionFixture("awaiting_disposition");
  const id = f.operation.recoveryId;
  const candidate = prepareCoordinatorStateRepairDisposalDecisionSnapshot(
    f.bytes,
    id,
    "2026-10-17T00:00:00.000Z",
    binding,
  );
  assert.ok(candidate);
  const actual = decodeRuntimeDomainSnapshot(candidate, binding);
  assert.ok(actual);
  const target = actual.snapshot.operations[0];
  assert.ok(target?.kind === "runtime_repair" && target.disposal);
  for (const time of [
    null,
    "bad",
    "2026-10-17T09:00:00+09:00",
    "2026-10-17T00:00:00Z",
  ])
    assert.equal(
      prepareCoordinatorStateRepairDisposalDecisionSnapshot(
        f.bytes,
        id,
        time,
        binding,
      ),
      null,
    );
  assert.equal(
    prepareCoordinatorStateRepairDisposalDecisionSnapshot(
      retentionFixture("settling").bytes,
      id,
      "2026-10-17T00:00:00.000Z",
      binding,
    ),
    null,
  );
  for (const change of [
    { disposal: null },
    { disposition: "retained_by_human_decision" },
    { phase: "awaiting_disposition" },
    { disposal: { ...target.disposal, summarySha256: "1".repeat(64) } },
    { disposal: { ...target.disposal, history: { confirmed: false } } },
    { disposal: { ...target.disposal, decidedAt: "bad" } },
    {
      outcome: {
        status: "blocked",
        reason: "runtime_repair_failed_closed",
        cleanupConfirmed: true,
      },
    },
    {
      primaryFailure: {
        stage: "repair",
        reason: "runtime_repair_effect_unknown",
      },
    },
  ]) {
    const bytes: Buffer = Buffer.from(
      `${encodeRuntimeStateValue({ ...actual.snapshot, operations: [{ ...target, ...change }] })}\n`,
    );
    assert.equal(decodeRuntimeDomainSnapshot(bytes, binding), null);
  }
  const progressValue = {
    ...target.disposal.checkpoint,
    directories: {
      ...target.disposal.checkpoint.directories,
      primary: {
        intent: "saved",
        request: "not_issued",
        absence: "unobserved",
      },
    },
  };
  const next = prepareCoordinatorStateRepairDisposalProgressSnapshot(
    candidate,
    id,
    "primary",
    progressValue,
    binding,
  );
  assert.ok(next);
  const nextState = decodeRuntimeDomainSnapshot(next, binding);
  assert.ok(nextState);
  assert.ok(target.checkpoint);
  const replacedIdentity = { dev: "91", ino: "92", birthtimeNs: "93" };
  const replacedCheckpoint = {
    ...target.checkpoint,
    directories: {
      ...target.checkpoint.directories,
      primary: {
        ...target.checkpoint.directories.primary,
        expected: replacedIdentity,
        retained: { state: "present", identity: replacedIdentity },
      },
    },
  };
  for (const change of [
    {
      disposal: {
        ...target.disposal,
        checkpoint: progressValue,
        decidedAt: "2026-10-18T00:00:00.000Z",
      },
    },
    { checkpoint: replacedCheckpoint },
  ]) {
    const forged: Buffer = Buffer.from(
      `${encodeRuntimeStateValue({ ...nextState.snapshot, operations: [{ ...nextState.snapshot.operations[0], ...change }] })}\n`,
    );
    assert.ok(
      decodeRuntimeDomainSnapshot(forged, binding),
      "codec_legal_forbidden_change",
    );
    assert.equal(
      validateCoordinatorStateRepairDisposalTransition(
        candidate,
        forged,
        id,
        "primary",
        binding,
      ),
      false,
    );
    assert.equal(
      validateCoordinatorStateTransition(candidate, forged, binding),
      false,
    );
  }
  const inconsistentCleanup = Buffer.from(
    `${encodeRuntimeStateValue({
      ...nextState.snapshot,
      operations: [
        {
          ...nextState.snapshot.operations[0],
          checkpoint: { ...target.checkpoint, cleanup: "unknown" },
        },
      ],
    })}\n`,
  );
  assert.equal(decodeRuntimeDomainSnapshot(inconsistentCleanup, binding), null);
  assert.equal(
    validateCoordinatorStateRepairDisposalTransition(
      candidate,
      inconsistentCleanup,
      id,
      "primary",
      binding,
    ),
    false,
  );
  const summary = prepareCoordinatorRepairHistorySummary(
    candidate,
    id,
    binding,
  );
  assert.equal(summary, null, "partial_disposal_has_no_summary");
  const missing = JSON.parse(candidate.toString());
  delete missing.operations[0].disposal;
  assert.equal(
    decodeRuntimeDomainSnapshot(
      Buffer.from(`${encodeRuntimeStateValue(missing)}\n`),
      binding,
    ),
    null,
  );
  assert.equal(prepareCoordinatorRepairHistorySummary(next, id, binding), null);
  assert.equal(
    prepareCoordinatorRepairHistorySnapshot(
      candidate,
      id,
      "2026-10-17T00:01:00.000Z",
      false,
      binding,
    ),
    null,
  );
  let settled = candidate;
  for (const purpose of ["primary", "failed", "auxiliary"] as const) {
    const current = decodeRuntimeDomainSnapshot(settled, binding)?.snapshot
      .operations[0];
    assert.ok(current?.kind === "runtime_repair" && current.disposal);
    const intent = {
      ...current.disposal.checkpoint,
      directories: {
        ...current.disposal.checkpoint.directories,
        [purpose]: {
          intent: "saved",
          request: "not_issued",
          absence: "unobserved",
        },
      },
    };
    const saved = prepareCoordinatorStateRepairDisposalProgressSnapshot(
      settled,
      id,
      purpose,
      intent,
      binding,
    );
    assert.ok(saved);
    const completed = prepareCoordinatorStateRepairDisposalProgressSnapshot(
      saved,
      id,
      purpose,
      {
        ...intent,
        directories: {
          ...intent.directories,
          [purpose]: {
            intent: "saved",
            request: "unknown",
            absence: "confirmed_absent",
          },
        },
      },
      binding,
    );
    assert.ok(completed);
    settled = completed;
  }
  const settledSummary = prepareCoordinatorRepairHistorySummary(
    settled,
    id,
    binding,
  );
  assert.ok(settledSummary);
  const projected = JSON.parse(settledSummary.summaryBytes.toString());
  const originalIdentity = JSON.parse(target.identityJson);
  const expected = {
    schema: "crdd-coordinator/repair-summary/v1",
    operationId: originalIdentity.operationId,
    operationNonce: originalIdentity.operationNonce,
    recoveryId: id,
    identitySha256: target.identitySha256,
    primaryFailure: null,
    outcome: {
      status: "recovered",
      reason: "runtime_repair_recovered",
      cleanupConfirmed: true,
    },
    disposition: "discard",
    disposal: {
      decidedAt: "2026-10-17T00:00:00.000Z",
      checkpoint: {
        directories: {
          primary: {
            intent: "saved",
            request: "unknown",
            absence: "confirmed_absent",
          },
          failed: {
            intent: "saved",
            request: "unknown",
            absence: "confirmed_absent",
          },
          auxiliary: {
            intent: "saved",
            request: "unknown",
            absence: "confirmed_absent",
          },
        },
      },
    },
    technical: {
      actions: target.checkpoint.actions,
      engine: "ready",
      stale: "retained",
      hostSafety: "safe",
      cleanup: "confirmed",
      cleanupFailure: null,
    },
  };
  assert.deepEqual(projected, expected);
  assert.ok(
    settledSummary.summaryBytes.equals(
      Buffer.from(`${encodeRuntimeStateValue(expected)}\n`),
    ),
  );
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(settled, id, binding),
    null,
  );
  const unpublished = prepareCoordinatorRepairHistorySnapshot(
    settled,
    id,
    "2026-10-17T00:01:00.000Z",
    false,
    binding,
  );
  assert.ok(unpublished);
  const published = prepareCoordinatorRepairHistorySnapshot(
    unpublished,
    id,
    "2026-10-17T00:01:00.000Z",
    true,
    binding,
  );
  assert.ok(published);
  for (const version of [unpublished, published]) {
    assert.equal(
      prepareCoordinatorStateRepairDisposalDecisionSnapshot(
        version,
        id,
        "2026-10-17T00:00:00.000Z",
        binding,
      ),
      null,
    );
    assert.equal(
      prepareCoordinatorStateRepairDisposalProgressSnapshot(
        version,
        id,
        "primary",
        progressValue,
        binding,
      ),
      null,
    );
    const operation = decodeRuntimeDomainSnapshot(version, binding)?.snapshot
      .operations[0];
    assert.ok(operation?.kind === "runtime_repair" && operation.disposal);
    assert.equal(
      prepareCoordinatorStateRepairDisposalProgressSnapshot(
        version,
        id,
        "primary",
        operation.disposal.checkpoint,
        binding,
      ),
      null,
    );
    assert.ok(
      prepareCoordinatorRepairHistorySummary(
        version,
        id,
        binding,
      )?.summaryBytes.equals(settledSummary.summaryBytes),
    );
  }
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(unpublished, id, binding),
    null,
  );
  assert.ok(
    prepareCoordinatorStateRepairCompletionSnapshot(published, id, binding),
  );
  const line = prepareCoordinatorRepairHistoryLine(published, id, binding);
  assert.ok(line);
  assert.ok(decodeCoordinatorHistoryRows(line));
  for (const purpose of ["failed", "auxiliary"] as const) {
    const altered = structuredClone(projected);
    altered.disposal.checkpoint.directories[purpose].request = "issued";
    const row = JSON.parse(line.toString());
    row.summary = altered;
    assert.ok(
      decodeCoordinatorHistoryRows(
        Buffer.from(`${encodeRuntimeStateValue(row)}\n`),
      ),
      "legal_negative_control",
    );
    assert.throws(() => assert.deepEqual(altered, expected));
  }
  for (const change of [
    { ...projected, disposal: { checkpoint: projected.disposal.checkpoint } },
    { ...projected, disposal: { ...projected.disposal, decidedAt: "bad" } },
    {
      ...projected,
      disposal: {
        ...projected.disposal,
        checkpoint: target.disposal.checkpoint,
      },
    },
  ]) {
    const row = JSON.parse(line.toString());
    row.summary = change;
    assert.equal(
      decodeCoordinatorHistoryRows(
        Buffer.from(`${encodeRuntimeStateValue(row)}\n`),
      ),
      null,
    );
  }
  const legacy = decodeRuntimeDomainSnapshot(unpublished, binding);
  assert.ok(legacy);
  const legacyPartial = Buffer.from(
    `${encodeRuntimeStateValue({ ...legacy.snapshot, operations: [{ ...legacy.snapshot.operations[0], disposal: target.disposal }] })}\n`,
  );
  assert.equal(decodeRuntimeDomainSnapshot(legacyPartial, binding), null);
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(candidate, id, binding),
    null,
  );
});

/**
 * 退避物がない修復だけを履歴確認後に終了候補へ変換する。
 * @responsibility 値候補と実資源回収・物理保存を区別する。
 * @trace ERB-UT-036
 * @precondition 正規codecで検証した修復fixture。
 * @stimulus 保持物不存在、未確認履歴、別ID、保持済みの境界。
 * @observation 次版の操作・参照・配送と通常遷移判定。
 * @oracle 専用候補だけが対象を除去し、通常更新では除去を拒否する。
 * @cleanup N/A: メモリのみ。
 * @boundary 純粋値契約。物理WriterとDockerは対象外。
 */
test("修復終了: 退避物不存在と履歴確認後だけ対象を除去する", () => {
  const f = retentionFixture("settling");
  assert.ok(f.operation.checkpoint);
  const technical = structuredClone(initial);
  technical.engine = "ready";
  technical.hostSafety = "safe";
  technical.cleanup = "confirmed";
  technical.stale = "absent";
  for (const name of names)
    technical.actions[name] = { ...f.operation.checkpoint.actions[name] };
  for (const name of [
    "retain_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
  ] as const) {
    technical.actions[name] = {
      intent: "not_saved",
      request: "not_issued",
      result: "not_required",
    };
  }
  for (const purpose of ["primary", "failed", "auxiliary"] as const) {
    technical.directories[purpose] = {
      expected: null,
      source: { state: "absent", identity: null },
      retained: { state: "absent", identity: null },
    };
  }
  const before = Buffer.from(
    `${encodeRuntimeStateValue({
      ...f.current.snapshot,
      operations: [
        {
          ...f.operation,
          checkpoint: technical,
          disposition: "not_applicable",
        },
      ],
    })}\n`,
  );
  assert.ok(decodeRuntimeDomainSnapshot(before, binding));
  const id = f.operation.recoveryId;
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(before, id, binding),
    null,
  );
  const at = "2026-10-16T00:00:00.000Z";
  const pending = prepareCoordinatorRepairHistorySnapshot(
    before,
    id,
    at,
    false,
    binding,
  );
  assert.ok(pending);
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(pending, id, binding),
    null,
  );
  const confirmed = prepareCoordinatorRepairHistorySnapshot(
    pending,
    id,
    at,
    true,
    binding,
  );
  assert.ok(confirmed);
  const removed = prepareCoordinatorStateRepairCompletionSnapshot(
    confirmed,
    id,
    binding,
  );
  assert.ok(removed);
  const previous = decodeRuntimeDomainSnapshot(confirmed, binding);
  const next = decodeRuntimeDomainSnapshot(removed, binding);
  assert.ok(previous && next);
  assert.equal(next.snapshot.operations.length, 0);
  assert.equal(next.snapshot.revision, previous.snapshot.revision + 1);
  assert.equal(next.snapshot.previous?.payloadSha256, previous.payloadSha256);
  assert.deepEqual(
    next.snapshot.unresolvedRecoveries,
    previous.snapshot.unresolvedRecoveries,
  );
  assert.deepEqual(
    next.snapshot.pendingDeliveries,
    previous.snapshot.pendingDeliveries,
  );
  assert.equal(
    validateCoordinatorStateTransition(confirmed, removed, binding),
    false,
  );
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(
      confirmed,
      "wrong",
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(removed, id, binding),
    null,
  );
  const retainedPending = prepareCoordinatorRepairHistorySnapshot(
    f.bytes,
    id,
    at,
    false,
    binding,
  );
  assert.ok(retainedPending);
  const retainedConfirmed = prepareCoordinatorRepairHistorySnapshot(
    retainedPending,
    id,
    at,
    true,
    binding,
  );
  assert.ok(retainedConfirmed);
  assert.equal(
    prepareCoordinatorStateRepairCompletionSnapshot(
      retainedConfirmed,
      id,
      binding,
    ),
    null,
  );
  /**
   * 修復記録を現行単一状態の合成区画へ接続する。
   * @responsibility 元の修復相関値を保持し未初期化のTask区画だけを付加する。
   * @trace ERB-UT-036
   * @precondition 呼出し側の固定合成値又は既存Sourceを使用する。
   * @stimulus 引数を同じ正規codec又は固定Rootへ接続する。
   * @observation 呼出し元が照合する値と相関。
   * @oracle 元値・拒否条件を補完又は緩和しない。
   * @cleanup 局所値のみ。物理試験物は呼出しCaseが回収する。
   * @boundary 既存契約の試験内接続。実AI・Dockerを実行しない。
   */
  const unifiedFixture = (bytes: Buffer) => {
    const source = decodeRuntimeDomainSnapshot(bytes, binding);
    assert.ok(source);
    return {
      ...source.snapshot,
      schema: "crdd-domain/runtime-state/v3",
      repositoryBindingId: null,
      intakeEpoch: null,
      intakeBindings: [],
      projects: [],
      queueEntries: [],
      workspaces: [],
      leaseEvidence: [],
      leaseIntents: [],
      results: [],
      historyPending: [],
      decisions: [],
      blockers: [],
      resultReceipts: [],
    };
  };
  for (const [bytes, expected] of [
    [confirmed, true],
    [pending, false],
    [retainedConfirmed, false],
  ] as const) {
    const snapshot = unifiedFixture(bytes);
    const currentBytes = Buffer.from(`${encodeRuntimeStateValue(snapshot)}\n`);
    assert.ok(decodeRuntimeDomainSnapshot(currentBytes, binding));
    const candidate = Buffer.from(
      `${encodeRuntimeStateValue({
        ...snapshot,
        revision: snapshot.revision + 1,
        previous: {
          revision: snapshot.revision,
          payloadSha256: createHash("sha256")
            .update(currentBytes)
            .digest("hex"),
        },
        operations: [],
      })}\n`,
    );
    assert.equal(
      validateCoordinatorUnifiedTransition(currentBytes, candidate, binding),
      expected,
    );
  }

  // 履歴受理が将来拡張されても、終了判定自体が成功条件を保持する。
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../../src/state/crud.ts", import.meta.url),
      "utf8",
    ),
  );
  const begin = source.indexOf(
    "function prepareCoordinatorStateRepairCompletionSnapshot(",
  );
  const end = source.indexOf("/**", begin);
  assert.ok(begin >= 0 && end > begin);
  const compile = runInThisContext(
    `(function(deps){const {decodeRuntimeDomainSnapshot,encodeRuntimeStateValue,prepareCoordinatorRepairHistorySummary,coordinatorRepairCanComplete}=deps; ${source.slice(begin, end)}; return prepareCoordinatorStateRepairCompletionSnapshot;})`,
  );
  const baseline = decodeRuntimeDomainSnapshot(confirmed, binding);
  assert.ok(baseline);
  const faults = [
    {
      outcome: {
        status: "blocked",
        reason: "runtime_repair_effect_unknown",
        cleanupConfirmed: true,
      },
    },
    {
      outcome: {
        status: "cancelled",
        reason: "runtime_repair_cancelled",
        cleanupConfirmed: true,
      },
    },
    {
      outcome: {
        status: "recovered",
        reason: "runtime_repair_effect_unknown",
        cleanupConfirmed: true,
      },
    },
    {
      outcome: {
        status: "recovered",
        reason: "runtime_repair_recovered",
        cleanupConfirmed: false,
      },
    },
    {
      primaryFailure: {
        stage: "repair",
        reason: "runtime_repair_effect_unknown",
      },
    },
    { checkpoint: { ...technical, engine: "unknown" } },
    { checkpoint: { ...technical, hostSafety: "unknown" } },
    { checkpoint: { ...technical, cleanup: "unknown" } },
    {
      checkpoint: { ...technical, cleanupFailure: "operation_cleanup_unknown" },
    },
    ...names.map((name) => ({
      checkpoint: {
        ...technical,
        actions: {
          ...technical.actions,
          [name]: { intent: "saved", request: "unknown", result: "unknown" },
        },
      },
    })),
  ];
  for (const fault of faults) {
    const value: NonNullable<ReturnType<typeof decodeRuntimeDomainSnapshot>> = {
      ...structuredClone(baseline),
      snapshot: {
        ...structuredClone(baseline.snapshot),
        operations: [
          {
            ...baseline.snapshot.operations[0],
            ...fault,
          } as CoordinatorStateRepairOperation,
        ],
      },
    };
    const unchanged: NonNullable<
      ReturnType<typeof decodeRuntimeDomainSnapshot>
    > = structuredClone(value);
    // codecと要約を意図的に受理させ、終了関数自身の拒否を観測する。
    const guarded = compile({
      decodeRuntimeDomainSnapshot: () => value,
      encodeRuntimeStateValue: encodeRuntimeStateValue,
      prepareCoordinatorRepairHistorySummary: () => ({}),
      coordinatorRepairCanComplete,
    }) as typeof prepareCoordinatorStateRepairCompletionSnapshot;
    assert.equal(guarded(confirmed, id, binding), null);
    assert.deepEqual(value, unchanged);
  }
});

/**
 * 修復専用の時刻・内容Hash・行Hashを初回に固定する。
 * @responsibility Taskの配送・要約へ修復を混入させない。
 * @trace ERB-UT-036
 * @precondition 共同終端と保持判断済みの正規修復。
 * @stimulus 初回false、確認true、再入力、時刻差・Hash差・巻戻し。
 * @observation 要約byte、行byte、版相関、入力不変。
 * @oracle 時刻とconfirmedから独立した要約、固定時刻付きの同一行を要求する。
 * @cleanup N/A: メモリのみ。
 * @boundary 純粋値契約。物理出版は未確認。
 */
test("修復履歴: 専用要約と初回時刻を固定し確認だけを進める", () => {
  const f = retentionFixture("settling");
  const id = f.operation.recoveryId;
  const at = "2026-10-16T00:00:00.000Z";
  const before = Buffer.from(f.bytes);
  const summary = prepareCoordinatorRepairHistorySummary(f.bytes, id, binding);
  assert.ok(summary);
  const value = JSON.parse(summary.summaryBytes.toString("utf8"));
  assert.equal(value.schema, "crdd-coordinator/repair-summary/v1");
  assert.equal(value.recoveryId, id);
  assert.deepEqual(value.technical.actions, f.operation.checkpoint?.actions);
  for (const key of [
    "directories",
    "identityJson",
    "execution",
    "lease",
    "hostPaths",
  ])
    assert.equal(key in value || key in value.technical, false, key);
  assert.equal(
    prepareCoordinatorRepairHistorySnapshot(f.bytes, id, at, true, binding),
    null,
  );
  const initialHistory = prepareCoordinatorRepairHistorySnapshot(
    f.bytes,
    id,
    at,
    false,
    binding,
  );
  assert.ok(initialHistory);
  const pending = decodeRuntimeDomainSnapshot(initialHistory, binding);
  assert.ok(pending);
  const operation = pending.snapshot.operations[0];
  assert.ok(operation?.kind === "runtime_repair" && operation.history);
  assert.equal(operation.summarySha256, summary.summarySha256);
  assert.equal(operation.history.confirmed, false);
  const line = prepareCoordinatorRepairHistoryLine(initialHistory, id, binding);
  assert.ok(line);
  assert.equal(
    operation.history.lineSha256,
    createHash("sha256").update(line).digest("hex"),
  );
  assert.equal(
    decodeCoordinatorHistoryRows(line)?.[0]?.summarySha256,
    summary.summarySha256,
  );
  assert.ok(
    prepareCoordinatorRepairHistorySnapshot(
      initialHistory,
      id,
      at,
      false,
      binding,
    )?.equals(initialHistory),
  );
  const confirmed = prepareCoordinatorRepairHistorySnapshot(
    initialHistory,
    id,
    at,
    true,
    binding,
  );
  assert.ok(confirmed);
  assert.ok(
    prepareCoordinatorRepairHistoryLine(confirmed, id, binding)?.equals(line),
  );
  assert.ok(
    prepareCoordinatorRepairHistorySummary(
      confirmed,
      id,
      binding,
    )?.summaryBytes.equals(summary.summaryBytes),
  );
  assert.ok(
    prepareCoordinatorRepairHistorySnapshot(
      confirmed,
      id,
      at,
      true,
      binding,
    )?.equals(confirmed),
  );
  assert.equal(
    prepareCoordinatorRepairHistorySnapshot(confirmed, id, at, false, binding),
    null,
  );
  assert.equal(
    prepareCoordinatorRepairHistorySnapshot(
      initialHistory,
      id,
      "2026-10-17T00:00:00.000Z",
      true,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorRepairHistorySnapshot(
      f.bytes,
      id,
      "2026-10-16",
      false,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorRepairHistorySnapshot(
      f.bytes,
      `${id}0`,
      at,
      false,
      binding,
    ),
    null,
  );
  assert.equal(prepareCoordinatorRepairHistoryLine(f.bytes, id, binding), null);
  for (const phase of [
    "repairing",
    "awaiting_disposition",
    "awaiting_delivery",
  ] as const) {
    const invalid = retentionFixture(phase);
    assert.equal(
      prepareCoordinatorRepairHistorySummary(
        invalid.bytes,
        invalid.operation.recoveryId,
        binding,
      ),
      null,
    );
  }
  for (const change of [
    { summarySha256: "0".repeat(64) },
    { history: { ...operation.history, lineSha256: "0".repeat(64) } },
    { history: null },
  ]) {
    const invalid: Buffer = Buffer.from(
      `${encodeRuntimeStateValue({ ...pending.snapshot, operations: [{ ...operation, ...change }] })}\n`,
    );
    assert.equal(decodeRuntimeDomainSnapshot(invalid, binding), null);
  }
  const jump = Buffer.from(
    `${encodeRuntimeStateValue({ ...decodeRuntimeDomainSnapshot(confirmed, binding)?.snapshot, revision: 99 })}\n`,
  );
  assert.equal(
    validateCoordinatorStateTransition(initialHistory, jump, binding),
    false,
  );
  assert.ok(f.bytes.equals(before));
});

/**
 * 失敗と取消の履歴を成功・現在状態除去から分離する。
 * @responsibility 不明な処置・回収と一次失敗を固定したまま記録する。
 * @trace ERB-UT-036
 * @precondition 実codecで確認した失敗Snapshot。
 * @stimulus 全失敗理由、回収不明、八処置の各不明、判断待ちと要約破損。
 * @observation canonical履歴の復号、Hash固定、現在操作の保全。
 * @oracle 履歴確認後も失敗操作を除去せず、不正相関と未決判断は出版しない。
 * @cleanup N/A: メモリのみ。
 * @boundary 値契約。物理Writer・Nativeは対象外。
 */
test("修復失敗履歴: 未知値を保持し成功と終了へ昇格しない", () => {
  const f = fixture();
  const at = "2026-10-16T00:00:00.000Z";
  for (const reason of [
    "runtime_repair_failed_closed",
    "runtime_repair_boundary_unavailable",
    "runtime_repair_state_unavailable",
    "runtime_repair_observation_unknown",
    "runtime_repair_effect_unknown",
    "runtime_repair_cleanup_unknown",
    "runtime_repair_cancelled",
  ])
    for (const cleanup of ["confirmed", "unknown"] as const)
      for (const failedSlot of names) {
        const technical = {
          ...structuredClone(initial),
          cleanupFailure:
            cleanup === "unknown" ? "observation_cleanup_unknown" : null,
        };
        technical.cleanup = cleanup;
        for (const name of names) {
          if (name === failedSlot) break;
          technical.actions[name] = {
            intent: "not_saved",
            request: "not_issued",
            result: "not_required",
          };
        }
        technical.actions[failedSlot] = {
          intent: "saved",
          request: "unknown",
          result: "unknown",
        };
        const cancelled = reason === "runtime_repair_cancelled";
        const operation = {
          ...f.operation,
          phase: "settling",
          checkpoint: technical,
          primaryFailure: cancelled ? null : { stage: "repair", reason },
          outcome: {
            status: cancelled ? "cancelled" : "blocked",
            reason,
            cleanupConfirmed: cleanup === "confirmed",
          },
        };
        const before = Buffer.from(
          `${encodeRuntimeStateValue({ ...f.observed.snapshot, operations: [operation] })}\n`,
        );
        assert.ok(decodeRuntimeDomainSnapshot(before, binding));
        const pending = prepareCoordinatorRepairHistorySnapshot(
          before,
          f.operation.recoveryId,
          at,
          false,
          binding,
        );
        assert.ok(pending);
        const confirmed = prepareCoordinatorRepairHistorySnapshot(
          pending,
          f.operation.recoveryId,
          at,
          true,
          binding,
        );
        assert.ok(confirmed);
        const line = prepareCoordinatorRepairHistoryLine(
          confirmed,
          f.operation.recoveryId,
          binding,
        );
        assert.ok(line && decodeCoordinatorHistoryRows(line));
        const row = JSON.parse(line.toString("utf8"));
        assert.deepEqual(row.summary.outcome, operation.outcome);
        assert.deepEqual(row.summary.primaryFailure, operation.primaryFailure);
        assert.deepEqual(row.summary.technical.actions, technical.actions);
        assert.equal(row.summary.technical.cleanup, cleanup);
        assert.equal(
          prepareCoordinatorStateRepairCompletionSnapshot(
            confirmed,
            f.operation.recoveryId,
            binding,
          ),
          null,
        );
        assert.equal(
          prepareCoordinatorRepairHistorySnapshot(
            confirmed,
            f.operation.recoveryId,
            at,
            false,
            binding,
          ),
          null,
        );
        for (const changes of [
          {
            outcome: {
              ...row.summary.outcome,
              reason: "runtime_repair_recovered",
            },
          },
          {
            outcome: {
              ...row.summary.outcome,
              cleanupConfirmed: cleanup !== "confirmed",
            },
          },
          { primaryFailure: { stage: "unknown", reason } },
          { technical: { ...row.summary.technical, cleanup: "pending" } },
          { technical: { ...row.summary.technical, cleanup: "not_requested" } },
          {
            technical: {
              ...row.summary.technical,
              actions: {
                ...technical.actions,
                [failedSlot]: {
                  intent: "not_saved",
                  request: "issued",
                  result: "unknown",
                },
              },
            },
          },
        ])
          assert.equal(
            decodeCoordinatorHistoryRows(
              Buffer.from(
                `${encodeRuntimeStateValue({ ...row, summary: { ...row.summary, ...changes } })}\n`,
              ),
            ),
            null,
          );
      }
  const retained = retentionFixture("settling");
  const failed = {
    ...retained.operation,
    outcome: {
      status: "blocked",
      reason: "runtime_repair_boundary_unavailable",
      cleanupConfirmed: true,
    },
  };
  for (const disposition of [
    "pending_human_decision",
    "retained_by_human_decision",
  ] as const) {
    const bytes = Buffer.from(
      `${encodeRuntimeStateValue({ ...retained.current.snapshot, operations: [{ ...failed, disposition }] })}\n`,
    );
    assert.ok(decodeRuntimeDomainSnapshot(bytes, binding));
    assert.equal(
      prepareCoordinatorRepairHistorySummary(
        bytes,
        failed.recoveryId,
        binding,
      ) !== null,
      disposition === "retained_by_human_decision",
    );
  }
});

/**
 * 修復履歴の自己完結するschema・結果・八処置を厳格に検査する。
 * @responsibility 未確認slotと機密／Authority情報の混入を拒否する。
 * @trace ERB-UT-036
 * @precondition 実encoderのcanonical履歴行。
 * @stimulus 全field単独差、八slotの各不正組合せ、未知／交差schema、余剰field。
 * @observation 行全体の拒否、元本文不変。
 * @oracle 一行破損でも混在全文を拒否する。
 * @cleanup N/A: メモリだけ。
 * @boundary 履歴値。実保存の検証ではない。
 */
test("修復履歴: schemaと八処置の不正を単独で拒否する", () => {
  const f = retentionFixture("settling");
  const bytes = prepareCoordinatorRepairHistorySnapshot(
    f.bytes,
    f.operation.recoveryId,
    "2026-10-16T00:00:00.000Z",
    false,
    binding,
  );
  assert.ok(bytes);
  const line = prepareCoordinatorRepairHistoryLine(
    bytes,
    f.operation.recoveryId,
    binding,
  );
  assert.ok(line);
  const row = JSON.parse(line.toString("utf8"));
  const changes = [
    { schema: "unknown" },
    { operationId: "OP-x" },
    { operationNonce: "0".repeat(64) },
    { identitySha256: "0".repeat(64) },
    {
      recoveryId: `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`,
    },
    {
      primaryFailure: {
        stage: "repair",
        reason: "runtime_repair_effect_unknown",
      },
    },
    { outcome: { ...row.summary.outcome, status: "blocked" } },
    {
      outcome: {
        ...row.summary.outcome,
        reason: "runtime_repair_failed_closed",
      },
    },
    { outcome: { ...row.summary.outcome, cleanupConfirmed: false } },
    { disposition: "pending_human_decision" },
    { technical: { ...row.summary.technical, engine: "unknown" } },
    { technical: { ...row.summary.technical, hostSafety: "unknown" } },
    { technical: { ...row.summary.technical, cleanup: "unknown" } },
    {
      technical: {
        ...row.summary.technical,
        cleanupFailure: "operation_cleanup_unknown",
      },
    },
    { technical: { ...row.summary.technical, stale: "absent" } },
    ...["directories", "path", "execution"].map((key) => ({
      [key]: "forbidden",
    })),
  ];
  for (const change of changes) {
    const bad = Buffer.from(
      `${encodeRuntimeStateValue({ ...row, summary: { ...row.summary, ...change } })}\n`,
    );
    assert.equal(
      decodeCoordinatorHistoryRows(bad),
      null,
      encodeRuntimeStateValue(change),
    );
    assert.equal(
      decodeCoordinatorHistoryRows(Buffer.concat([line, bad])),
      null,
    );
  }
  for (const name of names) {
    for (const intent of ["not_saved", "saved"]) {
      const notRequired = structuredClone(row);
      notRequired.summary.technical.actions[name] = {
        intent,
        request: "not_issued",
        result: "not_required",
      };
      assert.ok(
        decodeCoordinatorHistoryRows(
          Buffer.from(`${encodeRuntimeStateValue(notRequired)}\n`),
        ),
        `${name}:${intent}:not_required`,
      );
    }
    for (const action of [
      { intent: "saved", request: "issued", result: "unknown" },
      { intent: "saved", request: "not_issued", result: "confirmed" },
      { intent: "not_saved", request: "issued", result: "confirmed" },
      { intent: "saved", request: "issued", result: "not_required" },
      { intent: "unknown", request: "not_issued", result: "not_required" },
      { intent: "not_saved", request: "not_issued", result: "unobserved" },
    ]) {
      const bad = Buffer.from(
        `${encodeRuntimeStateValue({ ...row, summary: { ...row.summary, technical: { ...row.summary.technical, actions: { ...row.summary.technical.actions, [name]: action } } } })}\n`,
      );
      assert.equal(
        decodeCoordinatorHistoryRows(bad),
        null,
        `${name}:${encodeRuntimeStateValue(action)}`,
      );
    }
    const missing = structuredClone(row);
    delete missing.summary.technical.actions[name];
    assert.equal(
      decodeCoordinatorHistoryRows(
        Buffer.from(`${encodeRuntimeStateValue(missing)}\n`),
      ),
      null,
      name,
    );
  }
  const noRetained = structuredClone(row);
  noRetained.summary.technical.stale = "absent";
  noRetained.summary.disposition = "not_applicable";
  assert.equal(
    decodeCoordinatorHistoryRows(
      Buffer.from(`${encodeRuntimeStateValue(noRetained)}\n`),
    ),
    null,
  );
  for (const name of [
    "retain_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
  ])
    noRetained.summary.technical.actions[name] = {
      intent: "not_saved",
      request: "not_issued",
      result: "not_required",
    };
  assert.ok(
    decodeCoordinatorHistoryRows(
      Buffer.from(`${encodeRuntimeStateValue(noRetained)}\n`),
    ),
  );
  for (const key of ["directories", "path", "execution"])
    assert.equal(
      decodeCoordinatorHistoryRows(
        Buffer.from(
          `${encodeRuntimeStateValue({ ...row, summary: { ...row.summary, technical: { ...row.summary.technical, [key]: "forbidden" } } })}\n`,
        ),
      ),
      null,
      key,
    );
  for (const candidate of [
    { ...row, schema: "crdd-coordinator/history-row/v1" },
    { ...row, occurredAt: "2026-10-16" },
    { ...row, extra: "invalid" },
    {
      ...row,
      summary: {
        ...row.summary,
        schema: "crdd-coordinator/operation-summary/v2",
      },
    },
    {
      ...row,
      summary: {
        ...row.summary,
        technical: {
          ...row.summary.technical,
          actions: { ...row.summary.technical.actions, extra: {} },
        },
      },
    },
  ])
    assert.equal(
      decodeCoordinatorHistoryRows(
        Buffer.from(`${encodeRuntimeStateValue(candidate)}\n`),
      ),
      null,
    );
  assert.equal(decodeCoordinatorHistoryRows(Buffer.concat([line, line])), null);
  assert.equal(decodeCoordinatorHistoryRows(line.subarray(0, -1)), null);
  assert.ok(decodeCoordinatorHistoryRows(line));
});

/**
 * 修復の履歴出版候補と期間整理を同じ元版へ固定する。
 * @responsibility 未確認行を保護し、同ID異内容・偽Buffer比較を拒否する。
 * @trace ERB-UT-036
 * @precondition 正規の未確認修復履歴。
 * @stimulus 初出版・既存同値・異内容・pending差・期間境界・hostile Buffer。
 * @observation 候補全文、時刻、Hash、入力byteとgetter評価0。
 * @oracle 既存Taskと同じ保持意味を修復でも維持する。
 * @cleanup N/A: メモリだけ。
 * @boundary 純粋な出版候補。実読戻しは対象外。
 */
test("修復履歴: 有限出版と30日整理を再導出する", () => {
  const f = retentionFixture("settling");
  const id = f.operation.recoveryId;
  const at = "2026-10-16T00:00:00.000Z";
  const initialHistory = prepareCoordinatorRepairHistorySnapshot(
    f.bytes,
    id,
    at,
    false,
    binding,
  );
  assert.ok(initialHistory);
  const line = prepareCoordinatorRepairHistoryLine(initialHistory, id, binding);
  assert.ok(line);
  const publication = prepareCoordinatorRepairHistoryPublication(
    initialHistory,
    id,
    Buffer.alloc(0),
    null,
    30,
    binding,
  );
  assert.ok(publication);
  assert.ok(publication.historyBytes.equals(line));
  assert.equal(publication.historyChanged, true);
  assert.equal(
    decodeRuntimeDomainSnapshot(publication.snapshotBytes, binding)?.snapshot
      .operations[0]?.history?.confirmed,
    true,
  );
  const duplicate = prepareCoordinatorRepairHistoryPublication(
    initialHistory,
    id,
    line,
    line,
    30,
    binding,
  );
  assert.ok(duplicate);
  assert.equal(duplicate.historyChanged, false);
  assert.ok(duplicate.snapshotBytes.equals(publication.snapshotBytes));
  assert.equal(
    prepareCoordinatorRepairHistoryPublication(
      publication.snapshotBytes,
      id,
      Buffer.alloc(0),
      null,
      30,
      binding,
    ),
    null,
  );
  for (const days of [0, -1, 1.5, "30", null, Number.MAX_SAFE_INTEGER])
    assert.equal(
      prepareCoordinatorRepairHistoryPublication(
        initialHistory,
        id,
        line,
        null,
        days,
        binding,
      ),
      null,
    );
  for (const [canonical, pending] of [
    [Buffer.concat([line, line]), null],
    [Buffer.from("broken\n"), null],
    [Buffer.alloc(0), Buffer.from("wrong\n")],
    [Buffer.alloc(0), Buffer.alloc(0)],
  ] as const)
    assert.equal(
      prepareCoordinatorRepairHistoryPublication(
        initialHistory,
        id,
        canonical,
        pending,
        30,
        binding,
      ),
      null,
    );
  const different = JSON.parse(line.toString("utf8"));
  different.occurredAt = "2026-10-15T00:00:00.000Z";
  assert.equal(
    prepareCoordinatorRepairHistoryPublication(
      initialHistory,
      id,
      Buffer.from(`${encodeRuntimeStateValue(different)}\n`),
      null,
      30,
      binding,
    ),
    null,
  );
  const future = "2026-11-16T00:00:00.000Z";
  assert.ok(
    prepareCoordinatorHistoryRetention(
      initialHistory,
      line,
      future,
      30,
      binding,
    )?.equals(line),
  );
  assert.equal(
    prepareCoordinatorHistoryRetention(
      initialHistory,
      Buffer.alloc(0),
      future,
      30,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorHistoryRetention(
      publication.snapshotBytes,
      line,
      future,
      30,
      binding,
    )?.length,
    0,
  );
  assert.equal(
    prepareCoordinatorHistoryRetention(
      publication.snapshotBytes,
      Buffer.alloc(0),
      future,
      30,
      binding,
    )?.length,
    0,
  );
  assert.ok(
    prepareCoordinatorHistoryRetention(
      publication.snapshotBytes,
      line,
      "2026-11-15T00:00:00.000Z",
      30,
      binding,
    )?.equals(line),
  );
  let evaluated = 0;
  const hostile = Buffer.from(line);
  for (const key of ["equals", "length", "buffer", "byteLength", "byteOffset"])
    Object.defineProperty(hostile, key, {
      get() {
        evaluated++;
        throw new Error("unexpected_getter");
      },
    });
  assert.ok(
    prepareCoordinatorRepairHistoryPublication(
      initialHistory,
      id,
      hostile,
      null,
      30,
      binding,
    )?.historyBytes.equals(line),
  );
  const wrong = Buffer.from("wrong\n");
  Object.defineProperty(wrong, "equals", {
    value: () => {
      evaluated++;
      return true;
    },
  });
  assert.equal(
    prepareCoordinatorRepairHistoryPublication(
      initialHistory,
      id,
      Buffer.alloc(0),
      wrong,
      30,
      binding,
    ),
    null,
  );
  const proxy = new Proxy(Buffer.from(line), {
    get() {
      evaluated++;
      throw new Error("unexpected_proxy");
    },
    getPrototypeOf() {
      evaluated++;
      throw new Error("unexpected_proxy");
    },
  });
  assert.equal(
    prepareCoordinatorRepairHistoryPublication(
      initialHistory,
      id,
      proxy,
      null,
      30,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorRepairHistoryPublication(
      initialHistory,
      id,
      Buffer.alloc(RUNTIME_STATE_MAXIMUM_BYTES + 1),
      null,
      30,
      binding,
    ),
    null,
  );
  assert.equal(evaluated, 0);
});

/**
 * 旧保持判断だけの候補を新規保存へ入れない。
 * @responsibility codec互換と新規生成許可を分離する。
 * @trace ERB-UT-036
 * @precondition 全技術終端・保持待ちの実decode成功入力。
 * @stimulus receiptを持たないcodec合法な旧判断候補。
 * @observation 通常遷移・checkpoint候補・publication・専用候補の拒否。
 * @oracle 旧値は読めるが新規保存や自動昇格は許可しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary 純粋モデル。物理Writer・人間承認は対象外。
 */
test("修復保持: codec合法な旧判断候補の新規生成を拒否する", () => {
  const f = retentionFixture("awaiting_disposition");
  const before = Buffer.from(f.bytes);
  const candidate = Buffer.from(
    `${encodeRuntimeStateValue({ ...f.current.snapshot, revision: f.current.snapshot.revision + 1, previous: { revision: f.current.snapshot.revision, payloadSha256: f.current.payloadSha256 }, operations: [{ ...f.operation, phase: "settling", disposition: "retained_by_human_decision" }] })}\n`,
  );
  const actual = decodeRuntimeDomainSnapshot(candidate, binding);
  assert.ok(actual);
  assert.deepEqual(actual.snapshot.operations, [
    {
      ...f.operation,
      phase: "settling",
      disposition: "retained_by_human_decision",
    },
  ]);
  assert.deepEqual(
    actual.snapshot.unresolvedRecoveries,
    f.current.snapshot.unresolvedRecoveries,
  );
  assert.deepEqual(
    actual.snapshot.pendingDeliveries,
    f.current.snapshot.pendingDeliveries,
  );
  assert.equal(actual.snapshot.revision, f.current.snapshot.revision + 1);
  assert.deepEqual(actual.snapshot.previous, {
    revision: f.current.snapshot.revision,
    payloadSha256: f.current.payloadSha256,
  });
  assert.ok(f.bytes.equals(before));
  assert.equal(
    validateCoordinatorStateTransition(f.bytes, candidate, binding),
    false,
  );
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      f.bytes,
      f.operation.recoveryId,
      update(f.operation, {
        phase: "settling",
        disposition: "retained_by_human_decision",
      }),
      binding,
    ),
    null,
  );
  assert.equal(
    classifyCoordinatorRepairPublication(
      f.bytes,
      candidate,
      f.operation.recoveryId,
      binding,
    ),
    null,
  );
  assert.equal(
    validateCoordinatorStateRepairRetentionHandoffTransition(
      f.bytes,
      candidate,
      f.operation.recoveryId,
      binding,
    ),
    false,
  );
  assert.ok(f.operation.checkpoint);
  const receipt = {
    decidedAt: "2026-10-17T00:00:00.000Z",
    reviewAfter: "2026-10-24T00:00:00.000Z",
    targets: {
      primary: f.operation.checkpoint.directories.primary.retained.identity,
      failed: f.operation.checkpoint.directories.failed.retained.identity,
      auxiliary: f.operation.checkpoint.directories.auxiliary.retained.identity,
    },
  };
  assert.equal(
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      candidate,
      f.operation.recoveryId,
      receipt,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      f.bytes,
      `${f.operation.recoveryId}0`,
      receipt,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      f.bytes,
      f.operation.recoveryId,
      receipt,
      "0".repeat(64),
    ),
    null,
  );
  for (const phase of ["repairing", "settling", "awaiting_delivery"] as const) {
    const other = retentionFixture(phase);
    assert.equal(
      prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        other.bytes,
        other.operation.recoveryId,
        receipt,
        binding,
      ),
      null,
    );
  }
  for (const changes of [
    { checkpoint: { ...f.operation.checkpoint, cleanup: "unknown" } },
    { checkpoint: { ...f.operation.checkpoint, hostSafety: "unknown" } },
    {
      primaryFailure: {
        stage: "repair",
        reason: "runtime_repair_effect_unknown",
      },
    },
    {
      outcome: {
        status: "blocked",
        reason: "runtime_repair_failed_closed",
        cleanupConfirmed: true,
      },
    },
    {
      outcome: {
        status: "cancelled",
        reason: "runtime_repair_cancelled",
        cleanupConfirmed: true,
      },
    },
  ]) {
    const invalid = Buffer.from(
      `${encodeRuntimeStateValue({ ...f.current.snapshot, operations: [{ ...f.operation, ...changes }] })}\n`,
    );
    assert.equal(
      decodeRuntimeDomainSnapshot(invalid, binding),
      null,
      "technical_failure_is_rejected_by_codec",
    );
    assert.equal(
      prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        invalid,
        f.operation.recoveryId,
        receipt,
        binding,
      ),
      null,
    );
  }
});

/**
 * Repairの四phaseを全組合せで確認する。
 * @responsibility 全順序が作る保持待ち飛越しを防ぐ。
 * @trace ERB-UT-036
 * @precondition 各元版と次版が実codecを通る。
 * @stimulus 四phaseの16辺と保持判断欠測。
 * @observation 実遷移validatorの真偽。
 * @oracle 明示許可辺だけtrue。Taskのphase契約は変更しない。
 * @cleanup N/A: メモリだけ。
 * @boundary 純粋な状態遷移。
 */
test("修復phase: 保持判断を含む許可辺を16組合せで固定する", () => {
  const phases = [
    "repairing",
    "settling",
    "awaiting_disposition",
    "awaiting_delivery",
  ] as const;
  const allowed = new Set([
    "repairing:repairing",
    "repairing:settling",
    "repairing:awaiting_disposition",
    "settling:settling",
    "settling:awaiting_delivery",
    "awaiting_disposition:awaiting_disposition",
    "awaiting_delivery:awaiting_delivery",
  ]);
  for (const from of phases) {
    const f = retentionFixture(from);
    for (const to of phases) {
      const next = retentionFixture(to);
      const nextOperation = {
        ...next.operation,
        disposition:
          to === "awaiting_disposition"
            ? "pending_human_decision"
            : to === "awaiting_delivery" ||
                (from === "awaiting_disposition" && to === "settling")
              ? "retained_by_human_decision"
              : f.operation.disposition,
      };
      const bytes = Buffer.from(
        `${encodeRuntimeStateValue({
          ...next.current.snapshot,
          operations: [nextOperation],
          revision: f.current.snapshot.revision + 1,
          previous: {
            revision: f.current.snapshot.revision,
            payloadSha256: f.current.payloadSha256,
          },
        })}\n`,
      );
      assert.ok(
        decodeRuntimeDomainSnapshot(bytes, binding),
        `${from}:${to}:codec`,
      );
      assert.equal(
        validateCoordinatorStateTransition(f.bytes, bytes, binding),
        allowed.has(`${from}:${to}`),
        `${from}:${to}`,
      );
    }
  }
  const f = retentionFixture("awaiting_disposition");
  const before = Buffer.from(f.bytes);
  const withoutDecision = Buffer.from(
    `${encodeRuntimeStateValue({
      ...f.current.snapshot,
      revision: f.current.snapshot.revision + 1,
      previous: {
        revision: f.current.snapshot.revision,
        payloadSha256: f.current.payloadSha256,
      },
      operations: [{ ...f.operation, phase: "settling" }],
    })}\n`,
  );
  assert.ok(decodeRuntimeDomainSnapshot(withoutDecision, binding));
  assert.equal(
    validateCoordinatorStateTransition(f.bytes, withoutDecision, binding),
    false,
    "retention_handoff_required",
  );
  assert.ok(f.bytes.equals(before));
  for (const phase of ["repairing", "settling"] as const) {
    const prior = retentionFixture("repairing");
    const forged = prepareCoordinatorStateRepairCheckpointSnapshot(
      prior.bytes,
      prior.operation.recoveryId,
      update(prior.operation, {
        phase,
        disposition: "retained_by_human_decision",
        outcome: phase === "repairing" ? null : f.operation.outcome,
      }),
      binding,
    );
    assert.equal(forged, null, `ordinary_checkpoint:${phase}`);
  }
});

/**
 * 保存途中の有限形を純粋候補から一意に再導出する。
 * @responsibility 初回・通常・新Session・既出版同値を区別する。
 * @trace ERB-UT-036
 * @precondition 実codecが受理する固定修復とcheckpoint。
 * @stimulus 正規五形と別ID・非canonical・版差・初回へのcheckpoint混入。
 * @observation 種別、候補byte一致、元版不変。
 * @oracle 正規一形だけ許可し、値の書換えで初期化／技術許可を作らない。
 * @cleanup N/A: メモリだけ。
 * @boundary 値分類のみ。実出版・Native確認ではない。
 */
test("修復出版: 初回・次版・同値と不正候補を区別する", () => {
  const f = fixture();
  const id = f.operation.recoveryId;
  assert.equal(
    classifyCoordinatorRepairPublication(null, f.bytes, id, binding)?.mode,
    "initial_publication",
  );
  assert.equal(
    classifyCoordinatorRepairPublication(f.bytes, f.bytes, id, binding)?.mode,
    "remove_pending",
  );
  assert.equal(
    classifyCoordinatorRepairPublication(f.bytes, f.bytes, `${id}0`, binding),
    null,
  );
  const next = prepareCoordinatorStateRepairCheckpointSnapshot(
    f.bytes,
    id,
    update(f.operation, { checkpoint: { ...initial, cleanup: "pending" } }),
    binding,
  );
  assert.ok(next);
  assert.equal(
    classifyCoordinatorRepairPublication(f.bytes, next, id, binding)?.mode,
    "checkpoint",
  );
  assert.equal(
    classifyCoordinatorRepairPublication(null, next, id, binding),
    null,
  );
  const clean = prepareCoordinatorStateRepairCheckpointSnapshot(
    next,
    id,
    update(f.operation, { checkpoint: { ...initial, cleanup: "confirmed" } }),
    binding,
  );
  assert.ok(clean);
  const session = prepareCoordinatorStateRepairSessionSnapshot(
    clean,
    id,
    binding,
  );
  assert.ok(session);
  assert.equal(
    classifyCoordinatorRepairPublication(clean, session, id, binding)?.mode,
    "session_begin",
  );
  const empty = Buffer.from(
    `${encodeRuntimeStateValue({ ...f.observed.snapshot, revision: 1, previous: null, operations: [], unresolvedRecoveries: [], pendingDeliveries: [] })}\n`,
  );
  const added = prepareCoordinatorStateRepairSnapshot(empty, text, binding);
  assert.ok(added);
  assert.equal(
    classifyCoordinatorRepairPublication(empty, added, id, binding)?.mode,
    "identity",
  );
  for (const candidate of [
    Buffer.from(` ${f.bytes.toString("utf8")}`),
    Buffer.from(`${f.bytes.toString("utf8")}\n`),
    Buffer.from(
      encodeRuntimeStateValue({ ...f.observed.snapshot, revision: 3 }),
    ),
  ]) {
    assert.equal(
      classifyCoordinatorRepairPublication(null, candidate, id, binding),
      null,
    );
  }
  const different = Buffer.from(
    `${encodeRuntimeStateValue({ ...f.observed.snapshot, operations: [{ ...f.operation, identityJson: f.operation.identityJson.replace("OP-123456", "OP-999999") }] })}\n`,
  );
  assert.equal(
    classifyCoordinatorRepairPublication(f.bytes, different, id, binding),
    null,
  );
  assert.ok(
    classifyCoordinatorRepairPublication(
      null,
      f.bytes,
      id,
      binding,
    )?.candidate.equals(f.bytes),
  );
});

/**
 * 復号可能な禁止遷移を再導出全文一致で拒否する。
 * @responsibility codec拒否を出版分類器の反証へ流用しない。
 * @trace ERB-UT-036
 * @precondition 元版と全反例が実decode・canonical照合に成功する。
 * @stimulus previous差、非対象変更／除去、初回へのcheckpoint／primary／別操作混入。
 * @observation 分類null、入力全文不変、全文一致省略変異への同じOracle。
 * @oracle 合法な値でも禁止遷移は拒否し、比較省略変異を検出する。
 * @cleanup Production不変更、メモリ内のSource変異だけ。
 * @boundary 型除去した実分類関数と実モデルhelper。
 */
test("修復出版: codec合法の禁止遷移と全文一致省略を区別する", () => {
  const f = fixture();
  const id = f.operation.recoveryId;
  /**
   * 反例本文を実モデルのcanonical bytesへ符号化する。
   * @responsibility 形式不正と意味上の禁止を分離する。
   * @trace ERB-UT-036
   * @precondition 実codecへ渡す固定fixture値。
   * @stimulus Snapshot候補。
   * @observation 正規JSONと末尾改行。
   * @oracle 後続decodeと再符号化一致を確認する。
   * @cleanup N/A: メモリだけ。
   * @boundary fixture値とbyte列。
   */
  const serialize = (value: unknown) =>
    Buffer.from(`${encodeRuntimeStateValue(value)}\n`);
  const next = prepareCoordinatorStateRepairCheckpointSnapshot(
    f.bytes,
    id,
    update(f.operation, { checkpoint: { ...initial, cleanup: "pending" } }),
    binding,
  );
  assert.ok(next);
  const nextValue = decodeRuntimeDomainSnapshot(next, binding);
  assert.ok(nextValue);
  const otherText = `${JSON.stringify({ ...identity, operationNonce: "f".repeat(64), operationId: "OP-999999" })}\n`;
  const otherInitial = prepareCoordinatorStateRepairSnapshot(
    null,
    otherText,
    binding,
  );
  assert.ok(otherInitial);
  const otherValue = decodeRuntimeDomainSnapshot(otherInitial, binding)
    ?.snapshot.operations[0];
  assert.ok(otherValue?.kind === "runtime_repair");
  const other = {
    ...otherValue,
    phase: "awaiting_delivery",
    outcome: {
      status: "blocked",
      reason: "runtime_repair_failed_closed",
      cleanupConfirmed: true,
    },
  };
  const withOther = serialize({
    ...f.observed.snapshot,
    operations: [f.operation, other],
  });
  assert.ok(decodeRuntimeDomainSnapshot(withOther, binding));
  const validNext = prepareCoordinatorStateRepairCheckpointSnapshot(
    withOther,
    id,
    update(f.operation, { checkpoint: { ...initial, cleanup: "pending" } }),
    binding,
  );
  assert.ok(validNext);
  const validValue = decodeRuntimeDomainSnapshot(validNext, binding);
  assert.ok(validValue);
  const cases: readonly [Buffer | null, Buffer][] = [
    [
      f.bytes,
      serialize({
        ...nextValue.snapshot,
        previous: { revision: 1, payloadSha256: "0".repeat(64) },
      }),
    ],
    [
      f.bytes,
      serialize({
        ...nextValue.snapshot,
        revision: 3,
        previous: { revision: 2, payloadSha256: "0".repeat(64) },
      }),
    ],
    [
      withOther,
      serialize({
        ...validValue.snapshot,
        operations: [
          validValue.snapshot.operations[0],
          {
            ...other,
            outcome: {
              ...other.outcome,
              reason: "runtime_repair_boundary_unavailable",
            },
          },
        ],
      }),
    ],
    [
      withOther,
      serialize({
        ...validValue.snapshot,
        operations: [validValue.snapshot.operations[0]],
      }),
    ],
    [
      null,
      serialize({
        ...f.observed.snapshot,
        operations: [{ ...f.operation, checkpoint: initial }],
      }),
    ],
    [
      null,
      serialize({
        ...f.observed.snapshot,
        operations: [
          {
            ...f.operation,
            primaryFailure: {
              stage: "preparation",
              reason: "runtime_repair_boundary_unavailable",
            },
          },
        ],
      }),
    ],
    [null, withOther],
  ];
  /**
   * 同じ禁止集合へ復号・canonical・全文保全を共同適用する。
   * @responsibility 正常Sourceと変異SourceでOracleを共用する。
   * @trace ERB-UT-036
   * @precondition 固定した反例集合。
   * @stimulus 実分類器または一条件のメモリ変異。
   * @observation codec成功、分類値、前後byte列。
   * @oracle 全例nullかつ入力不変。
   * @cleanup N/A: メモリのみ。
   * @boundary 値分類とOracle。
   */
  const reject = (classify: typeof classifyCoordinatorRepairPublication) => {
    for (const [before, candidate] of cases) {
      const value = decodeRuntimeDomainSnapshot(candidate, binding);
      assert.ok(value, "counterexample_must_decode");
      assert.ok(serialize(value.snapshot).equals(candidate));
      if (before) assert.ok(decodeRuntimeDomainSnapshot(before, binding));
      const original = Buffer.from(candidate),
        originalBefore = before && Buffer.from(before);
      assert.equal(
        classify(before, candidate, id, binding),
        null,
        "forbidden_publication",
      );
      assert.ok(candidate.equals(original));
      if (before && originalBefore) assert.ok(before.equals(originalBefore));
    }
  };
  reject(classifyCoordinatorRepairPublication);
  const source = fs.readFileSync(
    new URL("../../../src/state/crud.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "export function classifyCoordinatorRepairPublication(",
  );
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(source.slice(begin, end)).replace(
    "export function",
    "function",
  );
  assert.equal(body.split("expected?.equals(pendingBytes)").length - 1, 2);
  const changed = body.replaceAll(
    "expected?.equals(pendingBytes)",
    "expected !== null",
  );
  const mutant = runInThisContext(
    `(function(decodeRuntimeDomainSnapshot,encodeRuntimeStateValue,prepareCoordinatorStateRepairSnapshot,prepareCoordinatorStateRepairCheckpointSnapshot,prepareCoordinatorStateRepairSessionSnapshot,validateCoordinatorStateRepairDisposalTransition,validateCoordinatorStateRepairRetentionHandoffTransition){${changed};return classifyCoordinatorRepairPublication;})`,
  )(
    decodeRuntimeDomainSnapshot,
    encodeRuntimeStateValue,
    prepareCoordinatorStateRepairSnapshot,
    prepareCoordinatorStateRepairCheckpointSnapshot,
    prepareCoordinatorStateRepairSessionSnapshot,
    validateCoordinatorStateRepairDisposalTransition,
    validateCoordinatorStateRepairRetentionHandoffTransition,
  ) as typeof classifyCoordinatorRepairPublication;
  assert.throws(() => reject(mutant), /forbidden_publication/u);
});

/**
 * DIの観測cleanup不明を上位variantで保全する。
 * @responsibility Native回収だけの成功から上位成功を作らない。
 * @trace ERB-UT-036
 * @precondition 同じ初回修復と元版。
 * @stimulus pending後の観測cleanup不明と不正なcleanup成功主張。
 * @observation 実codec・遷移・fresh準備の結果。
 * @oracle 既存fieldへ保存でき、fresh拒否・成功誤認拒否。
 * @cleanup N/A: メモリだけ。
 * @boundary DI checkpoint→Coordinator現在状態。
 */
test("修復variant: 観測回収不明を保持しfreshと成功主張を拒否する", () => {
  const { bytes, operation } = fixture();
  const begun = prepareCoordinatorStateRepairCheckpointSnapshot(
    bytes,
    operation.recoveryId,
    update(operation, { checkpoint: initial }),
    binding,
  );
  assert.ok(begun);
  const failedCheckpoint = {
    ...initial,
    cleanup: "unknown",
    cleanupFailure: "observation_cleanup_unknown",
  };
  const failed = prepareCoordinatorStateRepairCheckpointSnapshot(
    begun,
    operation.recoveryId,
    update(operation, { checkpoint: failedCheckpoint }),
    binding,
  );
  assert.ok(failed);
  const decoded = decodeRuntimeDomainSnapshot(failed, binding);
  assert.ok(decoded);
  const repaired = decoded.snapshot.operations[0];
  assert.ok(repaired?.kind === "runtime_repair");
  assert.equal(
    repaired.checkpoint?.cleanupFailure,
    "observation_cleanup_unknown",
  );
  assert.equal(
    prepareCoordinatorStateRepairSessionSnapshot(
      failed,
      operation.recoveryId,
      binding,
    ),
    null,
  );
  for (const cleanupConfirmed of [false, true]) {
    const settled = prepareCoordinatorStateRepairCheckpointSnapshot(
      failed,
      operation.recoveryId,
      update(repaired, {
        phase: "settling",
        outcome: {
          status: "blocked",
          reason: "runtime_repair_cleanup_unknown",
          cleanupConfirmed,
        },
      }),
      binding,
    );
    assert.equal(settled !== null, !cleanupConfirmed);
  }
});

/**
 * 最新Schemaと修復Identityの閉集合を確認する。
 * @responsibility 旧Schema・Task key・kindだけの差替えを拒否する。
 * @trace ERB-UT-036
 * @precondition fixed初期修復。
 * @stimulus Schema、Identity、Hash、回復ID、余剰fieldを変更する。
 * @observation 元値受理と全反証拒否。
 * @oracle 固定Identityとexact回復IDが共同成立する場合だけ受理。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 保存モデルだけ。
 */
test("修復variant: v2-onlyとIdentity／IDの相関", () => {
  const { bytes, observed, operation } = fixture();
  assert.equal(observed.snapshot.schema, COORDINATOR_STATE_SCHEMA);
  assert.equal("resources" in operation, false);
  assert.equal("host" in operation, false);
  assert.ok(validateCoordinatorStateTransition(null, bytes, binding));
  for (const extra of [
    { provider: "claude" },
    { profileId: "PROFILE-123456" },
    { host: {} },
    { resources: [] },
    { kind: "docker_task" },
    { identitySha256: "f".repeat(64) },
    { recoveryId: operation.recoveryId.replace("e", "f") },
  ]) {
    const changed = {
      ...observed.snapshot,
      operations: [{ ...operation, ...extra }],
    };
    assert.equal(
      decodeRuntimeDomainSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(changed)}\n`),
        binding,
      ),
      null,
    );
  }
  const old = {
    ...observed.snapshot,
    schema: "crdd-coordinator/current-state/v1",
  };
  assert.equal(
    decodeRuntimeDomainSnapshot(
      Buffer.from(`${encodeRuntimeStateValue(old)}\n`),
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairSnapshot(
      bytes,
      `${JSON.stringify({ ...identity, operationNonce: "f".repeat(64) })}\n`,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairSnapshot(bytes, text, binding),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairSnapshot(
      null,
      `${JSON.stringify({ ...identity, ownerBindingSha256: "a".repeat(64) })}\n`,
      binding,
    ),
    null,
  );
  const mixedRecovery = {
    ...observed.snapshot,
    unresolvedRecoveries: [
      {
        operationNonce: identity.operationNonce,
        recoveryId: operation.recoveryId,
        reason: "provider_operation_completed",
        obligations: ["docker_resources"],
      },
    ],
  };
  const mixedBytes = Buffer.from(`${encodeRuntimeStateValue(mixedRecovery)}\n`);
  assert.equal(decodeRuntimeDomainSnapshot(mixedBytes, binding), null);
  assert.equal(
    validateCoordinatorStateTransition(null, mixedBytes, binding),
    false,
  );
  assert.equal(
    prepareCoordinatorStateRepairSnapshot(
      null,
      `${JSON.stringify({ ...identity, provider: "claude" })}\n`,
      binding,
    ),
    null,
  );
});

/**
 * cleanな未終端修復の再入場候補だけを独立遷移で受理する。
 * @responsibility 通常更新、未回収、一次失敗と終端後の再開を拒否する。
 * @trace ERB-UT-036
 * @precondition 実codecと通常遷移で作成した回収済みの未終端状態。
 * @stimulus 同ID、別ID、回収状態、一次失敗と候補の技術値を変更する。
 * @observation 専用候補、専用検査と通常検査の結果。
 * @oracle cleanupだけpendingへ変更し、元版・他情報の不一致を拒否する。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 値契約のみ。新Native取得や実Writer成立は主張しない。
 */
test("修復variant: fresh Sessionは専用候補だけでcleanupを再開する", () => {
  const { bytes, operation } = fixture();
  const begun = prepareCoordinatorStateRepairCheckpointSnapshot(
    bytes,
    operation.recoveryId,
    update(operation, { checkpoint: initial }),
    binding,
  );
  assert.ok(begun);
  const clean = prepareCoordinatorStateRepairCheckpointSnapshot(
    begun,
    operation.recoveryId,
    update(operation, { checkpoint: { ...initial, cleanup: "confirmed" } }),
    binding,
  );
  assert.ok(clean);
  const next = prepareCoordinatorStateRepairSessionSnapshot(
    clean,
    operation.recoveryId,
    binding,
  );
  assert.ok(next);
  assert.equal(validateCoordinatorStateTransition(clean, next, binding), false);
  assert.equal(
    validateCoordinatorStateRepairSessionTransition(
      clean,
      next,
      operation.recoveryId,
      binding,
    ),
    true,
  );
  const before = decodeRuntimeDomainSnapshot(clean, binding);
  const after = decodeRuntimeDomainSnapshot(next, binding);
  assert.ok(before && after);
  const actual = after.snapshot.operations[0];
  assert.ok(actual?.kind === "runtime_repair");
  assert.deepEqual(actual, {
    ...before.snapshot.operations[0],
    checkpoint: { ...initial, cleanup: "pending" },
  });
  assert.equal(after.snapshot.previous?.payloadSha256, before.payloadSha256);
  for (const source of [null, bytes, begun, next])
    assert.equal(
      prepareCoordinatorStateRepairSessionSnapshot(
        source,
        operation.recoveryId,
        binding,
      ),
      null,
    );
  for (const id of [
    null,
    "wrong-id",
    operation.recoveryId.replace("repair", "task"),
  ])
    assert.equal(
      prepareCoordinatorStateRepairSessionSnapshot(clean, id, binding),
      null,
    );
  for (const changes of [
    { checkpoint: { ...initial, cleanup: "unknown" } },
    {
      checkpoint: {
        ...initial,
        cleanup: "confirmed",
        cleanupFailure: "operation_cleanup_unknown",
      },
    },
    {
      primaryFailure: {
        stage: "repair",
        reason: "runtime_repair_effect_unknown",
      },
    },
    {
      phase: "settling",
      outcome: {
        status: "blocked",
        reason: "runtime_repair_observation_unknown",
        cleanupConfirmed: true,
      },
    },
  ]) {
    const source: Buffer = Buffer.from(
      `${encodeRuntimeStateValue({
        ...before.snapshot,
        operations: [{ ...before.snapshot.operations[0], ...changes }],
      })}\n`,
    );
    assert.ok(decodeRuntimeDomainSnapshot(source, binding));
    assert.equal(
      prepareCoordinatorStateRepairSessionSnapshot(
        source,
        operation.recoveryId,
        binding,
      ),
      null,
    );
  }
  for (const changed of [
    { ...after.snapshot, revision: after.snapshot.revision + 1 },
    {
      ...after.snapshot,
      operations: [
        { ...actual, checkpoint: { ...actual.checkpoint, engine: "ready" } },
      ],
    },
    { ...after.snapshot, unresolvedRecoveries: [{}] },
    { ...after.snapshot, pendingDeliveries: [{}] },
  ])
    assert.equal(
      validateCoordinatorStateRepairSessionTransition(
        clean,
        Buffer.from(`${encodeRuntimeStateValue(changed)}\n`),
        operation.recoveryId,
        binding,
      ),
      false,
    );
  assert.equal(
    validateCoordinatorStateRepairSessionTransition(
      begun,
      next,
      operation.recoveryId,
      binding,
    ),
    false,
  );
});

/**
 * 全八処置と周辺観測の共同成立を回復結果へ要求する。
 * @responsibility 未実施、正常修復、自然回復、継続修復を区別する。
 * @trace ERB-UT-036
 * @precondition 外部資源を持たない修復Snapshot。
 * @stimulus 正常五処置・全不要・八処置の肯定と各slot未観測を構成する。
 * @observation 総合回復結果の厳格復号。
 * @oracle ready・安全・清掃だけでは回復済みにならない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary N/A: 実修復やWriter接続ではない。
 */
test("修復variant: 回復結果は全八処置の確認または明示不要を要求する", () => {
  const { observed, operation } = fixture();
  for (const confirmedCount of [0, 5, 9]) {
    const technical = structuredClone(initial);
    technical.engine = "ready";
    technical.hostSafety = "safe";
    technical.cleanup = "confirmed";
    technical.stale = confirmedCount === 0 ? "absent" : "retained";
    for (const [index, key] of names.entries())
      technical.actions[key] =
        index < confirmedCount
          ? { intent: "saved", request: "issued", result: "confirmed" }
          : {
              intent: "not_saved",
              request: "not_issued",
              result: "not_required",
            };
    for (const [purpose, index] of [
      ["primary", 3],
      ["failed", 6],
      ["auxiliary", 7],
    ] as const) {
      const id = { dev: "1", ino: String(index), birthtimeNs: "3" };
      technical.directories[purpose] = {
        expected: index < confirmedCount ? id : null,
        source: { state: "absent", identity: null },
        retained: {
          state: index < confirmedCount ? "present" : "absent",
          identity: index < confirmedCount ? id : null,
        },
      };
    }
    const candidate = {
      ...observed.snapshot,
      operations: [
        {
          ...operation,
          phase:
            confirmedCount === 0 ? "awaiting_delivery" : "awaiting_disposition",
          disposition:
            confirmedCount === 0 ? "not_applicable" : "pending_human_decision",
          checkpoint: technical,
          outcome: {
            status: "recovered",
            reason: "runtime_repair_recovered",
            cleanupConfirmed: true,
          },
        },
      ],
    };
    assert.ok(
      decodeRuntimeDomainSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(candidate)}\n`),
        binding,
      ),
      String(confirmedCount),
    );
    for (const key of names) {
      const incomplete = structuredClone(candidate);
      const target = incomplete.operations[0];
      assert.ok(target);
      target.checkpoint.actions[key] = {
        intent: "not_saved",
        request: "not_issued",
        result: "unobserved",
      };
      assert.equal(
        decodeRuntimeDomainSnapshot(
          Buffer.from(`${encodeRuntimeStateValue(incomplete)}\n`),
          binding,
        ),
        null,
        `${confirmedCount}:${key}`,
      );
    }
  }
});

/**
 * 技術初期値と意図保存の前後を現在改訂へ結合する。
 * @responsibility 意図前発行とunknown後の再発行を拒否する。
 * @trace ERB-UT-036
 * @precondition fixed初期修復。
 * @stimulus 初期値・意図・不明を順次記録する候補を作る。
 * @observation 元版Hash、Identity不変、拒否と既知不明の保持。
 * @oracle 必ず一段前の保存状態から合法な遷移だけを受理する。
 * @cleanup N/A: Writerを使わない。
 * @boundary N/A: 純粋な次版候補。
 */
test("修復variant: checkpointの意図前発行とunknown巻戻しを拒否する", () => {
  const { bytes, operation } = fixture();
  const begun = prepareCoordinatorStateRepairCheckpointSnapshot(
    bytes,
    operation.recoveryId,
    update(operation, { checkpoint: initial }),
    binding,
  );
  assert.ok(begun);
  const saved = structuredClone(initial);
  saved.actions.stop_runtime = {
    intent: "saved",
    request: "not_issued",
    result: "unobserved",
  };
  const intent = prepareCoordinatorStateRepairCheckpointSnapshot(
    begun,
    operation.recoveryId,
    update(operation, { checkpoint: saved }),
    binding,
  );
  assert.ok(intent);
  const issued = structuredClone(saved);
  issued.actions.stop_runtime.request = "issued";
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      begun,
      operation.recoveryId,
      update(operation, { checkpoint: issued }),
      binding,
    ),
    null,
  );
  const unknown = structuredClone(saved);
  unknown.actions.stop_runtime = {
    intent: "saved",
    request: "unknown",
    result: "unknown",
  };
  const uncertain = prepareCoordinatorStateRepairCheckpointSnapshot(
    intent,
    operation.recoveryId,
    update(operation, { checkpoint: unknown }),
    binding,
  );
  assert.ok(uncertain);
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      uncertain,
      operation.recoveryId,
      update(operation, { checkpoint: issued }),
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      uncertain,
      operation.recoveryId,
      update(operation, { checkpoint: initial }),
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      intent,
      operation.recoveryId,
      { ...update(operation), identityJson: text },
      binding,
    ),
    null,
  );
  const parsed = decodeRuntimeDomainSnapshot(intent, binding);
  assert.ok(parsed);
  assert.equal(
    parsed.snapshot.previous?.payloadSha256,
    createHash("sha256").update(begun).digest("hex"),
  );
  assert.equal(parsed.snapshot.operations[0]?.identityJson, text);
});

/**
 * ready単独と保持未判断を終端へ昇格しない。
 * @responsibility 結果・清掃・安全性・保持判断を共同評価する。
 * @trace ERB-UT-036
 * @precondition fixed初期修復。
 * @stimulus readyだけ、失敗field混用、保持物なしの人間判断を与える。
 * @observation 更新拒否と一次失敗の保持。
 * @oracle 部分成立をrecovered／配送可能にしない。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 値相関だけ。
 */
test("修復variant: ready単独・清掃不明・保持判断の捏造を拒否する", () => {
  const { bytes, operation } = fixture();
  const ready = { ...initial, engine: "ready" };
  for (const changes of [
    {
      phase: "settling",
      checkpoint: ready,
      outcome: {
        status: "recovered",
        reason: "runtime_repair_recovered",
        cleanupConfirmed: true,
      },
    },
    { disposition: "retained_by_human_decision" },
    {
      primaryFailure: {
        purpose: "create_provider",
        reason: "runtime_repair_failed_closed",
      },
    },
  ])
    assert.equal(
      prepareCoordinatorStateRepairCheckpointSnapshot(
        bytes,
        operation.recoveryId,
        update(operation, changes),
        binding,
      ),
      null,
    );
  const failure = {
    stage: "preparation",
    reason: "runtime_repair_failed_closed",
  };
  const failed = prepareCoordinatorStateRepairCheckpointSnapshot(
    bytes,
    operation.recoveryId,
    update(operation, {
      phase: "settling",
      primaryFailure: failure,
      outcome: {
        status: "blocked",
        reason: "runtime_repair_failed_closed",
        cleanupConfirmed: true,
      },
    }),
    binding,
  );
  assert.ok(failed);
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      failed,
      operation.recoveryId,
      update(operation, {
        phase: "settling",
        primaryFailure: null,
        outcome: {
          status: "blocked",
          reason: "runtime_repair_failed_closed",
          cleanupConfirmed: true,
        },
      }),
      binding,
    ),
    null,
  );
});

/**
 * 一次結果を変えずに後続の清掃観測だけを確定する。
 * @responsibility 清掃結果の追記と過去失敗の改変を区別する。
 * @trace ERB-UT-036
 * @precondition 技術初期値を保存した修復variant。
 * @stimulus 清掃不明で停止後、同じ操作の清掃と現在安全性を観測する。
 * @observation 一次結果の不変、清掃の一方向確定、配送の安全条件。
 * @oracle 不明時は配送不可。清掃確定後も失敗を成功へ変更しない。
 * @cleanup N/A: 値だけ。
 * @boundary N/A: WriterやOS観測は別試験。
 */
test("修復variant: 後続清掃の確定は一次結果を上書きしない", () => {
  const { bytes, operation } = fixture();
  const begun = prepareCoordinatorStateRepairCheckpointSnapshot(
    bytes,
    operation.recoveryId,
    update(operation, { checkpoint: initial }),
    binding,
  );
  assert.ok(begun);
  const failedCheckpoint = {
    ...initial,
    cleanup: "unknown",
    cleanupFailure: "operation_cleanup_unknown",
  };
  const primaryFailure = {
    stage: "repair",
    reason: "runtime_repair_cleanup_unknown",
  };
  const outcome = {
    status: "blocked",
    reason: "runtime_repair_cleanup_unknown",
    cleanupConfirmed: false,
  };
  const failed = prepareCoordinatorStateRepairCheckpointSnapshot(
    begun,
    operation.recoveryId,
    update(operation, {
      phase: "settling",
      checkpoint: failedCheckpoint,
      primaryFailure,
      outcome,
    }),
    binding,
  );
  assert.ok(failed);
  const confirmed = { ...failedCheckpoint, cleanup: "confirmed" };
  const lateIntent = structuredClone(failedCheckpoint);
  lateIntent.actions.stop_runtime.intent = "saved";
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      failed,
      operation.recoveryId,
      update(operation, {
        phase: "settling",
        checkpoint: lateIntent,
        primaryFailure,
        outcome,
      }),
      binding,
    ),
    null,
  );
  const withoutPrimary = prepareCoordinatorStateRepairCheckpointSnapshot(
    begun,
    operation.recoveryId,
    update(operation, {
      phase: "settling",
      checkpoint: failedCheckpoint,
      primaryFailure: null,
      outcome,
    }),
    binding,
  );
  assert.ok(withoutPrimary);
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      withoutPrimary,
      operation.recoveryId,
      update(operation, {
        phase: "settling",
        checkpoint: failedCheckpoint,
        primaryFailure,
        outcome,
      }),
      binding,
    ),
    null,
  );
  const next = {
    phase: "settling",
    checkpoint: confirmed,
    primaryFailure,
    outcome: { ...outcome, cleanupConfirmed: true },
  };
  const settled = prepareCoordinatorStateRepairCheckpointSnapshot(
    failed,
    operation.recoveryId,
    update(operation, next),
    binding,
  );
  assert.ok(settled);
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      settled,
      operation.recoveryId,
      update(operation, { ...next, phase: "awaiting_delivery" }),
      binding,
    ),
    null,
  );
  const deliverable = prepareCoordinatorStateRepairCheckpointSnapshot(
    settled,
    operation.recoveryId,
    update(operation, {
      ...next,
      phase: "awaiting_delivery",
      checkpoint: { ...confirmed, hostSafety: "safe" },
    }),
    binding,
  );
  assert.ok(deliverable);
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      settled,
      operation.recoveryId,
      update(operation, {
        ...next,
        checkpoint: failedCheckpoint,
        outcome,
      }),
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      settled,
      operation.recoveryId,
      update(operation, {
        ...next,
        outcome: { ...next.outcome, reason: "runtime_repair_failed_closed" },
      }),
      binding,
    ),
    null,
  );
});

/**
 * Task／修復を同居させ、どちらの更新でも他方の全文を保全する。
 * @responsibility variant追加がTask専用値の改変や対象外消去にならないことを確認する。
 * @trace ERB-UT-036
 * @precondition 値だけのTask Identityと修復Identity。実Hostは作らない。
 * @stimulus Task追加→修復追加→修復checkpoint→Task資源意図を構成する。
 * @observation 両variant、改訂、相手操作の正規全文と入力の不変性。
 * @oracle 両方向の更新が固定対象だけへ作用する。
 * @cleanup N/A: メモリ内の値だけ。
 * @boundary N/A: unionの純粋検査。
 */
test("修復variant: Taskと同居し双方向の更新で対象外全文を保持する", () => {
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${hostHash}`;
  const taskIdentity = {
    schema: "crdd-coordinator/operation-identity/v4",
    operationNonce: "b".repeat(64),
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-234567",
    grantRef: "PHMGRANT-FIXTURE",
    // 保存codec用の閉じた合成値。Catalog解決やAI実行の成立を表さない。
    executionSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "low",
      purpose: "task",
      catalogIdentity:
        "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
      configIdentity:
        "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
      role: "executor",
      workType: null,
      source: "explicit",
    },
    taskAttempt: 0,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const taskBytes = prepareCoordinatorStateOperationSnapshot(
    null,
    `${JSON.stringify(taskIdentity)}\n`,
    binding,
  );
  assert.ok(taskBytes);
  const task = decodeRuntimeDomainSnapshot(taskBytes, binding)?.snapshot
    .operations[0];
  assert.ok(task?.kind === "docker_task");
  const both = prepareCoordinatorStateRepairSnapshot(taskBytes, text, binding);
  assert.ok(both);
  const parsed = decodeRuntimeDomainSnapshot(both, binding);
  assert.ok(parsed);
  assert.equal(parsed.snapshot.operations.length, 2);
  const repair = parsed.snapshot.operations.find(
    (item) => item.kind === "runtime_repair",
  );
  assert.ok(repair);
  assert.equal(
    encodeRuntimeStateValue(
      parsed.snapshot.operations.find((item) => item.kind === "docker_task"),
    ),
    encodeRuntimeStateValue(task),
  );
  const repaired = prepareCoordinatorStateRepairCheckpointSnapshot(
    both,
    repair.recoveryId,
    update(repair, { checkpoint: initial }),
    binding,
  );
  assert.ok(repaired);
  const withRepair = decodeRuntimeDomainSnapshot(repaired, binding);
  assert.ok(withRepair);
  assert.equal(
    encodeRuntimeStateValue(
      withRepair.snapshot.operations.find(
        (item) => item.kind === "docker_task",
      ),
    ),
    encodeRuntimeStateValue(task),
  );
  const repairBefore = withRepair.snapshot.operations.find(
    (item) => item.kind === "runtime_repair",
  );
  assert.ok(repairBefore);
  const resource = {
    event: "submission",
    key: "resource",
    snapshot: {
      resources: [
        {
          key: "resource",
          request: "not_issued",
          identity: {
            kind: "container",
            name: "crdd-fixture",
            dockerId: null,
            ownershipLabel: taskIdentity.ownershipLabel,
          },
          configuration: {
            image: null,
            command: null,
            environmentNames: null,
            mounts: null,
            networks: null,
            internal: null,
          },
        },
      ],
    },
    cleanup: {
      cleanupOrder: ["resource"],
      setupTimeoutMs: 10000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: false,
    },
  };
  const taskProgress = prepareCoordinatorStateResourceSnapshot(
    repaired,
    task.recoveryId,
    resource,
    binding,
  );
  assert.ok(taskProgress);
  const last = decodeRuntimeDomainSnapshot(taskProgress, binding);
  assert.ok(last);
  assert.equal(
    encodeRuntimeStateValue(
      last.snapshot.operations.find((item) => item.kind === "runtime_repair"),
    ),
    encodeRuntimeStateValue(repairBefore),
  );
  assert.equal(
    prepareCoordinatorStateRepairCheckpointSnapshot(
      taskProgress,
      task.recoveryId,
      update(repair),
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      taskProgress,
      repair.recoveryId,
      resource,
      binding,
    ),
    null,
  );
  const ready = retentionFixture("settling");
  const otherStart = prepareCoordinatorStateRepairSnapshot(
    null,
    `${JSON.stringify({ ...identity, operationNonce: "f".repeat(64), operationId: "OP-999999" })}\n`,
    binding,
  );
  assert.ok(otherStart);
  const otherValue = decodeRuntimeDomainSnapshot(otherStart, binding)?.snapshot
    .operations[0];
  assert.ok(otherValue?.kind === "runtime_repair");
  const other = {
    ...otherValue,
    phase: "awaiting_delivery",
    outcome: {
      status: "blocked",
      reason: "runtime_repair_failed_closed",
      cleanupConfirmed: true,
    },
  };
  const finishedTask = {
    ...task,
    resources: {
      snapshot: resource.snapshot,
      cleanup: resource.cleanup,
      checkpoints: [
        {
          key: "resource",
          submission: "not_issued",
          receiptSource: null,
          observation: "unobserved",
          absenceEvidenceSha256: null,
        },
      ],
    },
    phase: "settling",
    lease: "released",
    host: { ...task.host, cleanup: "confirmed" },
    execution: { ...task.execution, ownerEffect: "disabled" },
    outcome: {
      status: "cancelled",
      reason: "provider_operation_cancelled",
      cleanupConfirmed: true,
    },
  };
  const nonempty = {
    ...ready.current.snapshot,
    operations: [finishedTask, ready.operation, other],
    unresolvedRecoveries: [
      {
        operationNonce: taskIdentity.operationNonce,
        recoveryId: task.recoveryId,
        reason: "provider_operation_cancelled",
        obligations: ["host_cleanup"],
      },
    ],
    pendingDeliveries: [
      {
        operationNonce: taskIdentity.operationNonce,
        recoveryId: task.recoveryId,
        resultId: "4".repeat(64),
        consumer: "orchestrator",
      },
    ],
  };
  const mixed = Buffer.from(`${encodeRuntimeStateValue(nonempty)}\n`);
  assert.ok(decodeRuntimeDomainSnapshot(mixed, binding));
  const at = "2026-10-16T00:00:00.000Z";
  /**
   * 非空のTask・他Repair・回復参照・配送を同じOracleで保全する。
   * @responsibility 空配列の肯定だけで非対象保全を主張しない。
   * @trace ERB-UT-036
   * @precondition すべてcodec合法な非空fixture。
   * @stimulus 実履歴候補生成または配送消去のメモリ変異。
   * @observation 対象外操作と二参照集合の全文。
   * @oracle 候補成立と非対象全文一致の両方を要求する。
   * @cleanup Source不変更、メモリ内だけ。
   * @boundary 実値モデルと一条件変異。
   */
  const preserve = (
    prepare: typeof prepareCoordinatorRepairHistorySnapshot,
  ) => {
    const candidate = prepare(
      mixed,
      ready.operation.recoveryId,
      at,
      false,
      binding,
    );
    assert.ok(candidate, "repair_history_candidate_required");
    const changed = decodeRuntimeDomainSnapshot(candidate, binding);
    assert.ok(changed);
    assert.deepEqual(
      changed.snapshot.operations.filter(
        (item) => item.recoveryId !== ready.operation.recoveryId,
      ),
      nonempty.operations.filter(
        (item) => item.recoveryId !== ready.operation.recoveryId,
      ),
    );
    assert.deepEqual(
      changed.snapshot.unresolvedRecoveries,
      nonempty.unresolvedRecoveries,
    );
    assert.deepEqual(
      changed.snapshot.pendingDeliveries,
      nonempty.pendingDeliveries,
    );
    return candidate;
  };
  const repairPending = preserve(prepareCoordinatorRepairHistorySnapshot);
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../../src/state/crud.ts", import.meta.url),
      "utf8",
    ),
  );
  /**
   * 実Sourceの関数本文だけを型除去後に取り出す。
   * @responsibility 値モデルの代替実装を試験へ作らない。
   * @trace ERB-UT-036
   * @precondition 固定Source内に一意な関数名。
   * @stimulus 対象関数名。
   * @observation 実本文の開始と次Headerの境界。
   * @oracle 存在しない関数を推測しない。
   * @cleanup 読取りのみ。
   * @boundary 型除去したSourceとメモリVM。
   */
  const body = (name: string) => {
    const actualSource = [
      "coordinatorRepairSummaryBytes",
      "coordinatorRepairHistoryLineBytes",
    ].includes(name)
      ? stripTypeScriptTypes(
          fs.readFileSync(
            new URL("../../../src/attempt/validation.ts", import.meta.url),
            "utf8",
          ),
        )
      : source;
    const begin = actualSource.indexOf(`function ${name}(`);
    assert.ok(begin >= 0);
    const nextHeader = actualSource.indexOf("/**", begin);
    const end = nextHeader < 0 ? actualSource.length : nextHeader;
    assert.ok(end > begin);
    return actualSource.slice(begin, end);
  };
  const absentTechnical = structuredClone(initial);
  absentTechnical.engine = "ready";
  absentTechnical.hostSafety = "safe";
  absentTechnical.cleanup = "confirmed";
  absentTechnical.stale = "absent";
  for (const name of names)
    absentTechnical.actions[name] = {
      intent: "saved",
      request: "not_issued",
      result: "not_required",
    };
  for (const purpose of ["primary", "failed", "auxiliary"] as const) {
    absentTechnical.directories[purpose] = {
      expected: null,
      source: { state: "absent", identity: null },
      retained: { state: "absent", identity: null },
    };
  }
  const absentMixed = Buffer.from(
    `${encodeRuntimeStateValue({
      ...nonempty,
      operations: [
        finishedTask,
        {
          ...ready.operation,
          checkpoint: absentTechnical,
          disposition: "not_applicable",
        },
        other,
      ],
    })}\n`,
  );
  assert.ok(decodeRuntimeDomainSnapshot(absentMixed, binding));
  const absentPending = prepareCoordinatorRepairHistorySnapshot(
    absentMixed,
    ready.operation.recoveryId,
    at,
    false,
    binding,
  );
  assert.ok(absentPending);
  const absentConfirmed = prepareCoordinatorRepairHistorySnapshot(
    absentPending,
    ready.operation.recoveryId,
    at,
    true,
    binding,
  );
  assert.ok(absentConfirmed);
  /**
   * 終了候補の非対象全文保全を非空集合で確認する。
   * @responsibility 全操作消去の変異を成功としない。
   * @trace ERB-UT-036
   * @precondition 履歴確認済みの対象と非空の他操作・参照・配送。
   * @stimulus 正規終了候補または全操作消去変異。
   * @observation 対象の不存在と対象外全文、版相関。
   * @oracle 変更は対象一件の除去と版相関だけ。
   * @cleanup N/A: メモリのみ。
   * @boundary 値契約だけ、物理保存なし。
   */
  const preserveCompletion = (
    prepare: typeof prepareCoordinatorStateRepairCompletionSnapshot,
  ) => {
    const candidate = prepare(
      absentConfirmed,
      ready.operation.recoveryId,
      binding,
    );
    assert.ok(candidate, "repair_completion_candidate_required");
    const value = decodeRuntimeDomainSnapshot(candidate, binding);
    const before = decodeRuntimeDomainSnapshot(absentConfirmed, binding);
    assert.ok(value && before);
    assert.deepEqual(
      value.snapshot.operations,
      before.snapshot.operations.filter(
        (item) => item.recoveryId !== ready.operation.recoveryId,
      ),
    );
    assert.deepEqual(
      value.snapshot.unresolvedRecoveries,
      before.snapshot.unresolvedRecoveries,
    );
    assert.deepEqual(
      value.snapshot.pendingDeliveries,
      before.snapshot.pendingDeliveries,
    );
    assert.equal(value.snapshot.revision, before.snapshot.revision + 1);
    assert.equal(value.snapshot.previous?.payloadSha256, before.payloadSha256);
  };
  preserveCompletion(prepareCoordinatorStateRepairCompletionSnapshot);
  const completionBody = body(
    "prepareCoordinatorStateRepairCompletionSnapshot",
  );
  const completionNeedle = "item.recoveryId !== recoveryId";
  assert.equal(completionBody.split(completionNeedle).length, 2);
  const completionMutant = runInThisContext(
    `(function(deps){const {decodeRuntimeDomainSnapshot,encodeRuntimeStateValue,prepareCoordinatorRepairHistorySummary,coordinatorRepairCanComplete}=deps; ${completionBody.replace(completionNeedle, "false")}; return prepareCoordinatorStateRepairCompletionSnapshot;})`,
  )({
    decodeRuntimeDomainSnapshot: decodeRuntimeDomainSnapshot,
    encodeRuntimeStateValue: encodeRuntimeStateValue,
    prepareCoordinatorRepairHistorySummary:
      prepareCoordinatorRepairHistorySummary,
    coordinatorRepairCanComplete,
  }) as typeof prepareCoordinatorStateRepairCompletionSnapshot;
  assert.throws(() => preserveCompletion(completionMutant));
  const original = body("prepareCoordinatorRepairHistorySnapshot");
  assert.equal(original.split("...current.snapshot,").length, 2);
  const mutant = runInThisContext(
    `(function(deps){const {createHash,decodeRuntimeDomainSnapshot,encodeRuntimeStateValue,prepareCoordinatorRepairHistorySummary,validateCoordinatorStateTransition}=deps; ${body("coordinatorRepairSummaryBytes")} ${body("coordinatorRepairHistoryLineBytes")} ${original.replace("...current.snapshot,", "...current.snapshot, pendingDeliveries: [],")}; return prepareCoordinatorRepairHistorySnapshot;})`,
  )({
    createHash,
    decodeRuntimeDomainSnapshot: decodeRuntimeDomainSnapshot,
    encodeRuntimeStateValue: encodeRuntimeStateValue,
    prepareCoordinatorRepairHistorySummary:
      prepareCoordinatorRepairHistorySummary,
    validateCoordinatorStateTransition,
  }) as typeof prepareCoordinatorRepairHistorySnapshot;
  assert.throws(() => preserve(mutant), /repair_history_candidate_required/u);
  const repairConfirmed = prepareCoordinatorRepairHistorySnapshot(
    repairPending,
    ready.operation.recoveryId,
    at,
    true,
    binding,
  );
  assert.ok(repairConfirmed);
  const taskAt = "2026-09-15T00:00:00.000Z";
  const taskPending = prepareCoordinatorStateHistorySnapshot(
    repairConfirmed,
    task.recoveryId,
    taskAt,
    false,
    binding,
  );
  assert.ok(taskPending);
  const taskConfirmed = prepareCoordinatorStateHistorySnapshot(
    taskPending,
    task.recoveryId,
    taskAt,
    true,
    binding,
  );
  assert.ok(taskConfirmed);
  const oldTaskLine = prepareCoordinatorStateHistoryLine(
    taskPending,
    task.recoveryId,
    binding,
  );
  const currentRepairLine = prepareCoordinatorRepairHistoryLine(
    taskPending,
    ready.operation.recoveryId,
    binding,
  );
  assert.ok(oldTaskLine && currentRepairLine);
  const historyMix = Buffer.concat([oldTaskLine, currentRepairLine]);
  assert.equal(decodeCoordinatorHistoryRows(historyMix)?.length, 2);
  assert.ok(
    prepareCoordinatorHistoryRetention(
      taskPending,
      historyMix,
      at,
      30,
      binding,
    )?.equals(historyMix),
  );
  assert.ok(
    prepareCoordinatorHistoryRetention(
      taskConfirmed,
      historyMix,
      at,
      30,
      binding,
    )?.equals(historyMix),
  );
  assert.equal(
    decodeCoordinatorHistoryRows(
      Buffer.concat([
        currentRepairLine,
        Buffer.from(
          oldTaskLine
            .toString("utf8")
            .replace("operation-summary/v2", "repair-summary/v1"),
        ),
      ]),
    ),
    null,
  );
  const removed = {
    ...last.snapshot,
    revision: last.snapshot.revision + 1,
    previous: {
      revision: last.snapshot.revision,
      payloadSha256: last.payloadSha256,
    },
    operations: last.snapshot.operations.filter(
      (item) => item.kind !== "runtime_repair",
    ),
  };
  assert.equal(
    validateCoordinatorStateTransition(
      taskProgress,
      Buffer.from(`${encodeRuntimeStateValue(removed)}\n`),
      binding,
    ),
    false,
  );
});
