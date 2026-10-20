/**
 * Reality診断の変換境界を検証する。
 * @packageDocumentation
 * @responsibility 既存診断と未知分類・不正詳細の拒否を確認する。
 * @trace PPR-UT-017
 * @level UT
 * @scope report、reality
 * @boundary PPR-UT-017=N/A: 同期的な値変換。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapRealityDomainIssueToCheckerFinding } from "../../../src/report/reality.ts";
import { inspectRealityTestCatalog } from "../../../../domain-model/src/index.ts";
/**
 * Reality Domain IssueはChecker境界で明示変換し未知種別を拒否するを検証する。
 *
 * @responsibility Reality Domain IssueはChecker境界で明示変換し未知種別を拒否するの合否判定を所有する。
 * @trace PPR-UT-017
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Domain IssueはChecker境界で明示変換し未知種別を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-017=Direct Boundary: checker Test Source→対象契約
 */
test("Reality Domain IssueはChecker境界で明示変換し未知種別を拒否する", () => {
  const rootIssues = inspectRealityTestCatalog({}, "catalog.json").issues;
  const entryIssues = inspectRealityTestCatalog(
    {
      tests: [
        null,
        { id: "", owner: "", path: "" },
        { id: "duplicate", owner: "", path: "" },
      ],
    },
    "catalog.json",
  ).issues;
  const findings = [...rootIssues, ...entryIssues].map(
    mapRealityDomainIssueToCheckerFinding,
  );
  assert.deepEqual(
    findings.map((finding) => finding.code),
    [
      "reality-symbol-test-catalog-invalid",
      "reality-symbol-test-catalog-entry-invalid",
      "reality-symbol-test-catalog-path-duplicate",
    ],
  );
  assert.equal(
    findings[2]?.message,
    "Test path  is registered more than once.",
  );
  assert.deepEqual(
    mapRealityDomainIssueToCheckerFinding({
      kind: "graph.symbol.identity-duplicate",
      targetIdentity: "sample.duplicate",
      location: { path: "40_Develop/sample/symbol.json" },
      reason: "declared_identity_is_not_unique",
      details: { symbolId: "sample.duplicate" },
    }),
    {
      code: "reality-symbol-id-duplicate",
      path: "40_Develop/sample/symbol.json",
      message: "Duplicate symbolId: sample.duplicate.",
    },
  );

  assert.throws(
    () =>
      mapRealityDomainIssueToCheckerFinding({
        kind: "future.domain.issue",
        targetIdentity: "sample",
        location: { path: "40_Develop/sample/symbol.json" },
        reason: "future_reason",
        details: {},
      }),
    /unknown_reality_domain_issue:future\.domain\.issue/,
  );
  assert.throws(
    () =>
      mapRealityDomainIssueToCheckerFinding({
        kind: "graph.symbol.identity-duplicate",
        targetIdentity: "sample",
        location: { path: "40_Develop/sample/symbol.json" },
        reason: "symbol_identity_not_unique",
        details: {},
      }),
    /invalid_reality_domain_issue_details:graph\.symbol\.identity-duplicate:symbolId/,
  );
});
