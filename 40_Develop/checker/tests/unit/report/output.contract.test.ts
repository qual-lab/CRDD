/**
 * 文書レポートの表示と出力失敗を検証する。
 *
 * @packageDocumentation
 * @responsibility 四表示組合せ・固定時刻・参照map・発行粒度・例外伝播を固定する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope report、output
 * @boundary RCM-UT-001=N/A: 固定レポートの同期整形。 / RCM-UT-002=N/A: 同期callbackの合成失敗。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { writeDocumentReport } from "../../../src/report/output.ts";
import type { DocumentReport } from "../../../src/report/types.ts";

const report: DocumentReport = {
  check_mode: "full",
  repository_mode: "generic",
  gitlink_detection: "fixed",
  gitlink_boundaries: [],
  change_trace_layout: "hierarchy-tolerant",
  recognized_change_trace_paths: [],
  discovery_source: "filesystem",
  discovery_git_failure: null,
  baseline_submodule: false,
  baseline_submodule_initialized: null,
  baseline_submodule_state: {
    declared: null,
    gitlink_indexed: false,
    gitlink_conflicted: null,
    gitlink_oid: null,
    worktree_present: false,
    gitdir_accessible: null,
    head_readable: null,
    head_oid: null,
    head_matches_gitlink: null,
  },
  discovery_exclusions: [],
  root: "synthetic",
  requested_scope: [],
  expanded_scope: ["."],
  expanded_scope_file_count: 2,
  expanded_scope_truncated: false,
  global_checks: [],
  unchecked: ["未確認"],
  executed_at: "2026-10-19T00:00:00.000Z",
  duration_ms: 123,
  metrics: {
    files_discovered: 2,
    markdown_files_discovered: 2,
    markdown_files_checked: 1,
    local_links_checked: 3,
    anchors_checked: 4,
    related_blocks_checked: 0,
    versioned_documents_checked: 0,
    stable_ids_observed: 5,
    gitlinks_observed: 0,
    explicit_stable_id_definitions: 0,
    numeric_rows_checked: 0,
    remediation_rows_checked: 0,
    errors: 1,
    warnings: 0,
  },
  findings: [{ severity: "error", code: "E", path: "a.md", message: "日本語" }],
  references: {
    target: "a.md",
    inbound: [{ source: "b.md", count: 1, links: ["a.md"] }],
    outbound: [{ target: "c.md", anchor: null, count: 1 }],
  },
};

/**
 * 四表示組合せの文字列発行を検証する。
 *
 * @responsibility JSON対象・人間表示の空白・固定時刻・参照発行を確認する。
 * @trace RCM-UT-001
 * @precondition 固定時刻と件数を持つレポートを使う。
 * @stimulus jsonとsummaryの全組合せで表示する。
 * @observation callbackごとの文字列列を取得する。
 * @oracle 固定期待列と完全一致し入力を変更しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同期整形である。
 */
test("文書表示は四モードの出力粒度・空白・時刻を維持する", () => {
  const before = JSON.stringify(report);
  const humanChunks = [
    `ERROR   E${" ".repeat(28)}a.md: 日本語\n`,
    "CRDD check: 1 error(s), 0 warning(s)\n",
  ];
  const summaryChunks = [
    "Mode=full; Markdown=1/2; local links=3; anchors=4; stable IDs=5; 123 ms\n",
    "Executed=2026-10-19T00:00:00.000Z\n",
    "Repository=generic; discovery=filesystem; git_failure=none\n",
    'Unchecked=["未確認"]\n',
    `${JSON.stringify(report.references, null, 2)}\n`,
  ];
  for (const [shouldOutputJson, shouldIncludeSummary, expectedChunks] of [
    [false, false, humanChunks],
    [false, true, [...humanChunks, ...summaryChunks]],
    [true, false, [`${JSON.stringify(report.findings, null, 2)}\n`]],
    [true, true, [`${JSON.stringify(report, null, 2)}\n`]],
  ] as const) {
    const chunks: string[] = [];
    writeDocumentReport(
      report,
      { json: shouldOutputJson, summary: shouldIncludeSummary },
      (value) => chunks.push(value),
    );
    assert.deepEqual(chunks, expectedChunks);
  }
  assert.equal(JSON.stringify(report), before);
});

/**
 * 空・重複・長いcode・null参照の表示を検証する。
 *
 * @responsibility 表示層が並替え・補完・重複除去を追加しないことを確認する。
 * @trace RCM-UT-001
 * @precondition 空診断、warningのみ、重複診断とnull／空参照を用意する。
 * @stimulus JSONと人間表示へ渡す。
 * @observation callback列とJSON値を取得する。
 * @oracle 元の順序・重複・nullを保持する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同期整形である。
 */
test("文書表示は空・重複・長いcodeと参照なしを補完しない", () => {
  for (const references of [null, { target: ".", inbound: [], outbound: [] }]) {
    const empty = {
      ...report,
      findings: [],
      metrics: { ...report.metrics, errors: 0, warnings: 0 },
      references,
    };
    const chunks: string[] = [];
    writeDocumentReport(empty, { json: false, summary: true }, (value) =>
      chunks.push(value),
    );
    assert.equal(chunks[0], "CRDD check: 0 error(s), 0 warning(s)\n");
    assert.equal(chunks.length, references === null ? 5 : 6);
  }
  const warning = {
    severity: "warning",
    code: "x".repeat(40),
    path: "b.md",
    message: "注意",
  };
  const repeated = {
    ...report,
    findings: [warning, warning],
    metrics: { ...report.metrics, errors: 0, warnings: 2 },
    references: null,
  };
  const chunks: string[] = [];
  writeDocumentReport(repeated, { json: false, summary: false }, (value) =>
    chunks.push(value),
  );
  assert.equal(chunks[0], `WARNING ${"x".repeat(40)} b.md: 注意\n`);
  assert.equal(chunks[1], chunks[0]);
  assert.equal(chunks[2], "CRDD check: 0 error(s), 2 warning(s)\n");
});

/**
 * 最初・途中・最終callbackの失敗伝播を検証する。
 *
 * @responsibility 出力失敗後に後続文字列を発行しないことを確認する。
 * @trace RCM-UT-002
 * @precondition 正常時の固定出力列を取得する。
 * @stimulus 各指定位置のcallbackで同じ例外Objectを投げる。
 * @observation 発行済み列と例外Identityを取得する。
 * @oracle 指定位置までだけを発行し、同じ例外を返す。
 * @cleanup N/A: callbackは配列だけに記録する。
 * @boundary RCM-UT-002=N/A: 同期callback境界である。
 */
test("出力callback失敗は同じ例外を伝播して後続発行を止める", () => {
  const expectedChunks: string[] = [];
  writeDocumentReport(report, { json: false, summary: true }, (value) =>
    expectedChunks.push(value),
  );
  for (const position of [1, 3, expectedChunks.length]) {
    const failure = new Error("synthetic_output_failure");
    const chunks: string[] = [];
    assert.throws(
      () =>
        writeDocumentReport(report, { json: false, summary: true }, (value) => {
          chunks.push(value);
          if (chunks.length === position) throw failure;
        }),
      (error) => error === failure,
    );
    assert.deepEqual(chunks, expectedChunks.slice(0, position));
  }
});
