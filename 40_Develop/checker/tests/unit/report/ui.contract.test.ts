/**
 * UIモデルIssueの診断変換を検証する。
 * @packageDocumentation
 * @responsibility 中立Issueを既存四項目診断へ変換し未知の分類を拒否する。
 * @trace RCM-UT-002
 * @level UT
 * @scope report、ui
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapUiDomainIssueToFinding } from "../../../src/report/convert.ts";
import {
  inspectUiAnalysis,
  inspectUiDefinition,
  parseUiIndex,
  inspectUiDetail,
  inspectUiAnalysisCoverage,
  inspectUiIndexCoverage,
  inspectUiRelations,
} from "../../../../domain-model/src/index.ts";

/**
 * UI診断の四項目と拒否境界を確認する。
 * @responsibility 既存codeと文言を維持し不足詳細を補完しないことを確認する。
 * @trace RCM-UT-002
 * @precondition 現行Issueと未知Issueを合成する。
 * @stimulus UI診断変換を実行する。
 * @observation 四項目診断または例外を取得する。
 * @oracle 既存文言を返し未知分類・詳細不足を拒否する。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期変換。
 */
test("UI診断は既存四項目を維持し未知分類を拒否する", () => {
  const issue = {
    kind: "artifact.ui.registry-row-invalid",
    reason: "registry-row-invalid",
    targetIdentity: "ui.md",
    location: { path: "ui.md" },
    details: {},
  };
  assert.deepEqual(mapUiDomainIssueToFinding(issue), {
    severity: "error",
    code: "ui-registry-row-invalid",
    path: "ui.md",
    message:
      "Each UI registry row must identify at least one UX-view and IA-view input.",
  });
  assert.throws(
    () => mapUiDomainIssueToFinding({ ...issue, kind: "artifact.ui.unknown" }),
    /unknown_ui_domain_issue/u,
  );
  assert.throws(
    () =>
      mapUiDomainIssueToFinding({
        ...issue,
        kind: "artifact.ui.analysis-checklist-invalid",
      }),
    /invalid_artifact_domain_issue_detail/u,
  );
  const finding = mapUiDomainIssueToFinding({
    ...issue,
    kind: "artifact.ui.analysis-checklist-invalid",
    details: { checklistFailure: "missing" },
  });
  assert.match(finding.message, /\(missing\)/u);
  const source = { path: "ui.md", content: "" };
  const index = parseUiIndex({
    ...source,
    content:
      "| [UI-000001](Definitions/UI-000001/ui_definition.md) | name | — | IA-000001 |",
  });
  const actualIssues = [
    ...index.issues,
    ...inspectUiAnalysis(source, "UX-000001").issues,
    ...inspectUiAnalysis(source, "IA-000001").issues,
    ...inspectUiDefinition(source, "UI-000001").issues,
    ...inspectUiDetail(source, index.ids),
    ...inspectUiAnalysisCoverage(
      source.path,
      new Set(["UX-000001"]),
      new Set(["IA-000001"]),
      new Set(),
      new Set(),
    ),
    ...inspectUiIndexCoverage(source.path, index, new Set()),
    ...inspectUiRelations(source.path, index, [], []),
  ];
  assert.equal(
    new Set(actualIssues.map((item) => mapUiDomainIssueToFinding(item).code))
      .size,
    11,
  );
});
