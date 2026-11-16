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
import {
  parseSpecBehavior,
  parseUiArea,
  parseUiComponent,
  parseUiScreen,
  parseUiVisualBaseline,
} from "../../../../document-model/src/index.ts";
import { mapSpecDomainIssueToFinding } from "../../../src/report/convert.ts";

/**
 * 通常Detail四種類の実Parser診断をCheckerの四fieldへ配送する。
 * @responsibility 種類別code・相対Path・失敗理由を保持し本文を診断へ混入させない。
 * @trace RCM-UT-002
 * @precondition Checklist欠測の取得済み本文を用意する。
 * @stimulus 公開ParseのIssueを各表示変換へ渡す。
 * @observation severity・code・path・messageと不正details時の拒否を読む。
 * @oracle 通常文書専用codeで一件を返し、本文と絶対Pathを含めない。
 * @cleanup N/A: 局所値のみ。
 */
test("通常Detail四種類の局所診断は種類別codeと失敗理由を保持する", () => {
  const source = { path: "details/source.md", content: "診断へ複製しない本文" };
  for (const [parse, convert, code] of [
    [parseUiArea, mapUiDomainIssueToFinding, "ui-area-checklist-invalid"],
    [
      parseUiComponent,
      mapUiDomainIssueToFinding,
      "ui-component-checklist-invalid",
    ],
    [
      parseUiVisualBaseline,
      mapUiDomainIssueToFinding,
      "ui-visual-baseline-checklist-invalid",
    ],
    [
      parseSpecBehavior,
      mapSpecDomainIssueToFinding,
      "spec-behavior-checklist-invalid",
    ],
  ] as const) {
    const issue = parse(source, { mode: "evaluated" }).issues[0];
    assert.ok(issue);
    const finding = convert(issue);
    assert.deepEqual(
      Object.keys(finding).sort(),
      ["severity", "code", "path", "message"].sort(),
    );
    assert.equal(finding.code, code);
    assert.equal(finding.path, source.path);
    assert.equal(finding.severity, "error");
    assert.ok(finding.message.includes("missing_or_duplicate"));
    assert.equal(finding.message.includes(source.content), false);
    assert.throws(
      () => convert({ ...issue, details: {} }),
      /invalid_artifact_domain_issue_detail/u,
    );
  }
});

/**
 * Screenの実Parser診断を通常本文専用codeへ配送する。
 * @responsibility 局所理由・相対位置・不正details拒否を検証する。
 * @trace RCM-UT-002
 * @precondition Checklist欠測のScreen本文を用意する。
 * @stimulus 公開ParseのIssueを表示変換へ渡す。
 * @observation code・path・理由と本文非開示を読む。
 * @oracle Screen専用診断一件を返し、必要details欠測は拒否する。
 * @cleanup N/A: 局所値のみ。
 */
test("Screenの局所診断は種類別codeと失敗理由を保持する", () => {
  const source = {
    path: "Areas/area/SCR-000001/screen.md",
    content: "診断へ複製しない本文",
  };
  const parsed = parseUiScreen(source, "SCR-000001");
  assert.equal(parsed.issues.length, 1);
  const issue = parsed.issues[0];
  assert.ok(issue);
  const finding = mapUiDomainIssueToFinding(issue);
  assert.equal(finding.code, "ui-screen-checklist-invalid");
  assert.equal(finding.path, source.path);
  assert.equal(finding.severity, "error");
  assert.ok(finding.message.includes("missing_or_duplicate"));
  assert.equal(finding.message.includes(source.content), false);
  assert.throws(
    () => mapUiDomainIssueToFinding({ ...issue, details: {} }),
    /invalid_artifact_domain_issue_detail/u,
  );
});

import {
  inspectUiConsistency,
  parseUiAnalysis,
  parseUiDefinition,
  parseUiDetailIndex,
  parseUiIndex,
} from "../../../../document-model/src/index.ts";
import { mapUiDomainIssueToFinding } from "../../../src/report/convert.ts";

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
    ...parseUiAnalysis(source, "UX-000001").issues,
    ...parseUiAnalysis(source, "IA-000001").issues,
    ...parseUiDefinition(source, "UI-000001").issues,
    ...inspectUiConsistency({
      kind: "ui_detail_coverage",
      detail: parseUiDetailIndex(source),
      index: index.result,
    }),
    ...inspectUiConsistency({
      kind: "ui_analysis_coverage",
      sourcePath: source.path,
      uxIds: new Set(["UX-000001"]),
      iaIds: new Set(["IA-000001"]),
      analysisUxIds: new Set(),
      analysisIaIds: new Set(),
    }),
    ...inspectUiConsistency({
      kind: "ui_index_coverage",
      sourcePath: source.path,
      index: index.result,
      actualUiIds: new Set(),
    }),
    ...inspectUiConsistency({
      kind: "ui_relations",
      sourcePath: source.path,
      index: index.result,
      analyses: [],
      definitions: [],
    }),
  ];
  assert.equal(
    new Set(actualIssues.map((item) => mapUiDomainIssueToFinding(item).code))
      .size,
    11,
  );
});
