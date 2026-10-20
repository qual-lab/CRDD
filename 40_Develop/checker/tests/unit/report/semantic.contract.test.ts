/**
 * Semantic診断の変換と拒否境界を検証する。
 * @packageDocumentation
 * @responsibility 既存診断shape・未知kind・不正Detailの拒否を確認する。
 * @trace PPR-UT-016
 * @level UT
 * @scope report、semantic
 * @boundary PPR-UT-016=N/A: 同期的な値変換。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapSemanticDomainIssueToDiagnostic } from "../../../src/report/semantic.ts";
/**
 * Semantic Domain IssueはChecker境界で明示変換し未知種別を拒否するを検証する。
 *
 * @responsibility Semantic Domain IssueはChecker境界で明示変換し未知種別を拒否するの合否判定を所有する。
 * @trace PPR-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Semantic Domain IssueはChecker境界で明示変換し未知種別を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-016=Direct Boundary: semantic-coverage Test Source→対象契約
 */
test("Semantic Domain IssueはChecker境界で明示変換し未知種別を拒否する", () => {
  assert.deepEqual(
    mapSemanticDomainIssueToDiagnostic({
      kind: "ir.meaning.key-invalid",
      targetIdentity: "sample.invalid",
      location: { path: "06_Architecture/Details/sample.md" },
      reason: "meaning_key_not_in_subsystem_namespace",
      details: { row: 4, subsystem: "sample" },
    }),
    {
      code: "semantic-ir-key-invalid",
      path: "06_Architecture/Details/sample.md",
      message: "row 4 has an invalid pilot Semantic Key",
    },
  );
  assert.throws(
    () =>
      mapSemanticDomainIssueToDiagnostic({
        kind: "future.semantic.issue",
        targetIdentity: "sample",
        location: { path: "sample.md" },
        reason: "future_reason",
        details: {},
      }),
    /unknown_semantic_domain_issue:future\.semantic\.issue/u,
  );
  assert.throws(
    () =>
      mapSemanticDomainIssueToDiagnostic({
        kind: "ir.meaning.key-invalid",
        targetIdentity: "sample.invalid",
        location: { path: "sample.md" },
        reason: "meaning_key_not_in_subsystem_namespace",
        details: {},
      }),
    /invalid_semantic_domain_issue_detail:ir\.meaning\.key-invalid:row/u,
  );
});
