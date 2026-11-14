/**
 * 履歴の保持・出版条件を保存やState復号なしで反証する。
 * @packageDocumentation
 * @responsibility 行のexact相関・参照保護・期限境界・byte捕捉を検査する。
 * @trace HST-UT-001
 * @level UT
 * @scope 正規化済みの合成履歴値とメモリ内Buffer。
 * @boundary 実保存・子Process・AI・Dockerは使用しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  copyHistoryBytes,
  prepareHistoryPublication,
  retainHistoryRows,
  taskHistoryLine,
} from "../../../src/history/operations.ts";
import type {
  HistoryEntry,
  HistoryRetentionReferences,
} from "../../../src/history/types.ts";

const NOW = "2026-11-14T00:00:00.000Z";

/**
 * 独立した一つの終了履歴値を作る。
 * @responsibility 可変Stateや保存資格を持たない合成行を各試験へ渡す。
 * @trace HST-UT-001
 * @precondition 有限のIDと正規時刻。
 * @stimulus Taskの終了行を構築する。
 * @observation 本文・回復参照・両Hash。
 * @oracle 行の生成とは別にSHA-256を算出する。
 * @cleanup メモリ値だけ。
 * @boundary 合成履歴と純粋規則。
 */
function row(id: string, occurredAt: string): HistoryEntry {
  const record = {
    id,
    occurredAt,
    outcome: "completed" as const,
    primaryFailure: null,
    cleanup: "confirmed" as const,
  };
  const bytes = taskHistoryLine(record);
  const summary = JSON.parse(bytes.toString("utf8")).summary;
  const expectedSummary = `{"record":{"cleanup":"confirmed","id":"${id}","occurredAt":"${occurredAt}","outcome":"completed","primaryFailure":null},"schema":"crdd-coordinator/task-summary/v1"}\n`;
  assert.deepEqual(summary, JSON.parse(expectedSummary));
  return {
    line: bytes.toString("utf8"),
    occurredAt,
    recoveryId: `task-history.${id}`,
    lineSha256: createHash("sha256").update(bytes).digest("hex"),
    summarySha256: createHash("sha256").update(expectedSummary).digest("hex"),
  };
}

/**
 * 保護参照と必須行Hashを同じ合成元値へ結合する。
 * @responsibility 行不存在と保護参照だけの存在を区別する。
 * @trace HST-UT-001
 * @precondition 呼出側が必要な合成行を明示する。
 * @stimulus exact参照を投影する。
 * @observation 参照集合と必須行条件。
 * @oracle 入力行の三相関値をそのまま保持する。
 * @cleanup メモリ値だけ。
 * @boundary State投影の代役。保存の証明ではない。
 */
function references(rows: readonly HistoryEntry[]): HistoryRetentionReferences {
  return {
    protectedRecoveries: new Set(rows.map((item) => item.recoveryId)),
    requiredRows: rows.map((item) => ({
      recoveryId: item.recoveryId,
      lineSha256: item.lineSha256,
      summarySha256: item.summarySha256,
    })),
  };
}

/** @trace HST-UT-001 必須行を期間整理より先に全件照合する。 */
test("履歴保持は期限外の必須行も欠測・両Hash差を拒否する", () => {
  const old = row("OLD", "2026-01-01T00:00:00.000Z");
  const required = references([old]);
  const requiredRow = required.requiredRows[0];
  assert.ok(requiredRow);
  assert.equal(
    retainHistoryRows([old], required, NOW, 30)?.toString(),
    old.line,
  );
  assert.equal(retainHistoryRows([], required, NOW, 30), null);
  for (const field of ["lineSha256", "summarySha256"] as const) {
    const changed = { ...old, [field]: "f".repeat(64) };
    assert.equal(retainHistoryRows([changed], required, NOW, 30), null);
  }
  assert.equal(
    retainHistoryRows(
      [old],
      {
        ...required,
        requiredRows: [{ ...requiredRow, summarySha256: null }],
      },
      NOW,
      30,
    ),
    null,
  );
});

/** @trace HST-UT-001 保持日数と保持期限の境界を元の不等号で確認する。 */
test("履歴保持は期間境界を含みreviewAfterのexact時刻から期限整理する", () => {
  const before = row("BEFORE", "2026-10-14T23:59:59.999Z");
  const boundary = row("BOUNDARY", "2026-10-15T00:00:00.000Z");
  const after = row("AFTER", "2026-10-15T00:00:00.001Z");
  assert.equal(
    retainHistoryRows(
      [before, boundary, after],
      references([]),
      NOW,
      30,
    )?.toString(),
    boundary.line + after.line,
  );
  for (const [reviewAfter, retained] of [
    ["2026-11-13T23:59:59.999Z", false],
    [NOW, false],
    ["2026-11-14T00:00:00.001Z", true],
  ] as const) {
    assert.equal(
      retainHistoryRows(
        [{ ...before, reviewAfter }],
        references([]),
        NOW,
        30,
      )?.toString(),
      retained ? before.line : "",
    );
  }
});

/** @trace HST-UT-001 不正条件を空本文への成功に畳まない。 */
test("履歴保持は不正な時刻・日数を拒否し保護参照を黙って捨てない", () => {
  const item = row("ONE", NOW);
  for (const time of [null, 0, "invalid", "2026-11-14T00:00:00Z"]) {
    assert.equal(retainHistoryRows([item], references([]), time, 30), null);
  }
  for (const days of [null, 0, -1, 1.5, 104249992, Number.POSITIVE_INFINITY]) {
    assert.equal(retainHistoryRows([item], references([]), NOW, days), null);
  }
  const old = row("OLD", "2026-01-01T00:00:00.000Z");
  assert.equal(
    retainHistoryRows(
      [old],
      {
        protectedRecoveries: new Set([old.recoveryId]),
        requiredRows: [],
      },
      NOW,
      30,
    )?.toString(),
    old.line,
  );
});

/** @trace HST-UT-001 初回・再入場・同ID異本文の三つを分離する。 */
test("履歴出版は同じ行を再追記せず同ID異本文とpending差を拒否する", () => {
  const item = row("ONE", NOW);
  const input = {
    canonical: Buffer.alloc(0),
    pending: null,
    rows: [],
    line: item,
    recoveryId: item.recoveryId,
    references: references([item]),
    occurredAt: NOW,
    retentionDays: 30,
  };
  const first = prepareHistoryPublication(input);
  assert.ok(first);
  assert.equal(first.historyBytes.toString(), item.line);
  assert.equal(first.historyChanged, true);
  const again = prepareHistoryPublication({
    ...input,
    canonical: first.historyBytes,
    rows: [item],
  });
  assert.ok(again);
  assert.equal(again.historyBytes.toString(), item.line);
  assert.equal(again.historyChanged, false);
  assert.equal(
    prepareHistoryPublication({
      ...input,
      rows: [{ ...item, line: item.line.replace("completed", "failed") }],
    }),
    null,
  );
  assert.equal(
    prepareHistoryPublication({
      ...input,
      pending: Buffer.from("different\n"),
    }),
    null,
  );
  assert.equal(
    prepareHistoryPublication({
      ...input,
      pending: first.historyBytes,
    })?.historyBytes.toString(),
    item.line,
  );
});

/** @trace HST-UT-001 Bufferのown methodやProxyを照合の根拠にしない。 */
test("履歴byte捕捉は独立コピーしown equalsを評価せずProxyを拒否する", () => {
  const original = Buffer.from("history\n");
  let calls = 0;
  Object.defineProperty(original, "equals", {
    get() {
      calls++;
      throw Error("getter");
    },
  });
  const copied = copyHistoryBytes(original);
  assert.ok(copied);
  assert.equal(copied.toString(), "history\n");
  assert.equal(calls, 0);
  copied[0] = 0;
  assert.equal(original.toString(), "history\n");
  assert.equal(copyHistoryBytes(new Proxy(original, {})), null);
  for (const invalid of [null, "history\n", new Uint8Array([1])])
    assert.equal(copyHistoryBytes(invalid), null);
});
