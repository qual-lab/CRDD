/**
 * Qualityの状態・分析・統合・引渡し・書式の意味契約を検証する。
 * @packageDocumentation
 * @responsibility 取得済み本文と関係集合だけで、部分関係、重複、状態相関と境界到達を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、quality-readiness、quality-analysis、quality-relations、quality-templates
 * @boundary RCM-UT-002=N/A: 外部I/Oのない同期的な値検査。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../src/artifact/checklist.ts";
import {
  type DocumentRelationsRequest,
  inspectDocumentRelations,
  inspectQualityAnalysis,
  parseQualityAnalysis,
  parseQualityCenter,
  parseQualityDefinition,
  parseQualityDetailAnalysis,
  parseQualityIntegration,
  parseQualityRealityAudit,
  parseQualityStrategy,
  parseQualityVerificationDesign,
  parseQualityVerificationResult,
} from "../../../src/index.ts";
import { captureQualityDocument } from "../../../src/quality/readiness.ts";
import { captureQualityTemplate } from "../../../src/quality/templates.ts";

/**
 * 九文書の完成Parseが共通断面と局所Issueを返すことを確認する。
 * @responsibility 内部のChecklist行列だけでなく本番公開入口の接続を反証する。
 * @trace RCM-UT-002
 * @precondition 九種類と両方式の合成本文を用意する。
 * @stimulus 文書別Parseへ同じ原文を渡す。
 * @observation 原文、期待列、失敗理由、局所診断と呼出し間の独立性を読む。
 * @oracle 元のChecklist条件を維持し、不備でも内容を失わず、モデル内にIssueを埋めない。
 * @cleanup N/A: 局所値のみ。
 */
test("Quality九文書の公開Parseは内容・Checklist条件と局所診断を分離する", () => {
  const parsers = [
    ["center", parseQualityCenter],
    ["strategy", parseQualityStrategy],
    ["verification_design", parseQualityVerificationDesign],
    ["integration", parseQualityIntegration],
    ["reality_audit", parseQualityRealityAudit],
    ["verification_result", parseQualityVerificationResult],
    ["analysis", parseQualityAnalysis],
    ["analysis_detail", parseQualityDetailAnalysis],
    [
      "definition",
      (
        source: { path: string; content: string },
        options: { mode: "template" | "evaluated" },
      ) => parseQualityDefinition(source, "QA-000001", options),
    ],
  ] as const;
  for (const [kind, parse] of parsers)
    for (const mode of ["template", "evaluated"] as const) {
      const source = {
        path: "quality.md",
        content: "状態: Canonical\n| A | B |",
      };
      const parsed = parse(source, { mode });
      assert.equal(parsed.result.checklistContract.kind, kind);
      assert.equal(parsed.result.checklistContract.mode, mode);
      assert.equal(
        parsed.result.checklistContract.failure,
        "missing_or_duplicate",
      );
      assert.ok(
        parsed.issues.some(
          (issue) => issue.kind === "artifact.quality.checklist-invalid",
        ),
      );
      assert.equal(parsed.result.source.content, source.content);
      assert.equal(Object.hasOwn(parsed.result, "issues"), false);
      source.content = "changed";
      assert.notEqual(parsed.result.source.content, source.content);
    }
  assert.throws(
    () =>
      parseQualityStrategy(
        { path: "q.md", content: "" },
        { mode: null as never },
      ),
    /unknown_quality_checklist_mode/u,
  );
  for (const [kind, parse] of [
    ["center", parseQualityCenter],
    ["reality_audit", parseQualityRealityAudit],
  ] as const) {
    const expected = captureQualityDocument(
      { path: "q.md", content: "" },
      { kind, mode: "template" },
    ).checklistContract.expectedItems;
    const content = `## Checklist\n[x] [ ] OPEN FAIL N/A 理由\n${expected.map((item) => `- [ ] ${item}`).join("\n")}`;
    assert.equal(
      parse({ path: "q.md", content }, { mode: "template" }).status,
      "complete",
    );
  }
});

/**
 * 既存の独立した試験断片を工程本文へ組み立てる。
 * @responsibility 合成入力の検査観点を維持し、モデル受付を経由させる。
 * @trace RCM-UT-002
 * @precondition 断片は各試験が所有する。
 * @stimulus 工程本文と統合モデルを構築して関係評価を呼ぶ。
 * @observation 元のIssue・Mapを返す。
 * @oracle 各試験の固定期待を維持する。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同期的なモデル構築と照合。
 */
function evaluateQualityFixture(
  summary: string,
  sources: readonly string[],
  canonicalIds: ReadonlySet<string>,
  integration: { path: string; content: string },
  analysisRoot: string,
) {
  return inspectQualityAnalysis(
    sources.map(
      (content, index) =>
        parseQualityAnalysis({
          path: `phase-${index}.md`,
          content:
            index === 0
              ? `## 2. 全件Coverage Index\n${summary}\n## fixture-boundary\n${content}`
              : content,
        }).result,
    ),
    canonicalIds,
    parseQualityIntegration(integration).result,
    analysisRoot,
  );
}

/**
 * Quality状態は正規化・未知・許可された状態対を区別する。
 * @responsibility 許可状態対のみを受理し、未知値を合格へ補完しない。
 * @trace RCM-UT-002
 * @precondition 品質状態の正規・未知値と状態対を用意する。
 * @stimulus Center、Realityと未完Checklistを検査する。
 * @observation 正規化値・状態対のIssueを取得する。
 * @oracle 許可状態対のみを受理し、未知値を合格へ補完しない。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Quality状態は正規化・未知・許可された状態対を区別する", () => {
  const source = {
    path: "quality.md",
    content:
      "状態: Quality Ready\n状態: Unknown\n| Local Item数 | 001 |\n| Local Item数 | 9 |\n## Checklist\n- PASS: 確認済み\n## 次節\n- OPEN: EOFまでの旧条件",
  };
  const document = captureQualityDocument(source);
  source.content = "changed";
  assert.notEqual(document.source.content, source.content);
  assert.equal(document.stateDeclarations.length, 2);
  assert.equal(document.stateDeclarations[0]?.location.line, 1);
  assert.equal(document.localItemDeclarations.length, 2);
  assert.equal(document.localItemDeclarations[0]?.text, "001");
  assert.equal(document.localItemCount, 1);
  assert.equal(document.hasOpenChecklist, true);
  assert.equal(
    parseQualityCenter(document.source).result.normalizedQualityState,
    "Quality Ready",
  );
  assert.equal(Object.hasOwn(document, "issues"), false);
  const states = [
    "Quality Design Under Review — Reality Audit Blocked",
    "Quality Design Ready — Reality Audit Pending",
    "Quality Ready",
    "Unknown",
  ];
  const realityStates = [
    "Blocked — Quality Design Review Pending",
    "Pending — Not Started",
    "In Progress",
    "Complete",
    "Unknown",
  ];
  for (const [index, state] of states.entries()) {
    const center = parseQualityCenter({
      path: "center.md",
      content: `状態: v0.22.0 ${state}（Released Baseline: v0.21.0）`,
    });
    assert.equal(center.result.normalizedQualityState, state);
    assert.equal(
      center.issues.filter(
        (issue) => issue.kind !== "artifact.quality.checklist-invalid",
      ).length,
      index === 3 ? 1 : 0,
    );
    for (const [realityIndex, reality] of realityStates.entries()) {
      const issues = inspectDocumentRelations({
        kind: "quality_reality_state",
        center: center.result,
        reality: parseQualityRealityAudit({
          path: "reality.md",
          content: `状態: ${reality}`,
        }),
      });
      const isAllowed =
        index === 0
          ? realityIndex === 0
          : index === 1
            ? realityIndex === 1 || realityIndex === 2
            : index === 2 && realityIndex === 3;
      assert.equal(
        issues.length,
        Number(realityIndex === 4) + Number(index !== 3 && !isAllowed),
      );
      assert.ok(
        issues.every(
          (issue) =>
            issue.location.path ===
            (issue.kind.includes("state-mismatch")
              ? "center.md"
              : "reality.md"),
        ),
      );
    }
  }
});

/**
 * Quality分析は後勝ちの条件・重複出現・部分関係を保持する。
 * @responsibility 後勝ちMapと重複列を維持し、不正本文からも関係を失わない。
 * @trace RCM-UT-002
 * @precondition 重複条件・出現・部分関係を持つ分析本文を用意する。
 * @stimulus 品質分析を解析・検査する。
 * @observation 条件Mapと出現列、部分関係を取得する。
 * @oracle 後勝ちMapと重複列を維持し、不正本文からも関係を失わない。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Quality分析は後勝ちの条件・重複出現・部分関係を保持する", () => {
  const summary =
    "| [REQ-000001](source.md) | x | x | x | UT | [Goal](../../Definitions/QA-000001/quality_definition.md) |";
  const phaseSource = {
    path: "phase.md",
    content: `## 2. 全件Coverage Index\n${summary}\n## 次\n## 2. 全件Coverage Index\npartial\n## 終端`,
  };
  const phaseModel = parseQualityAnalysis(phaseSource).result;
  phaseSource.content = "changed";
  assert.notEqual(phaseModel.source.content, phaseSource.content);
  assert.equal(phaseModel.coverage.length, 2);
  assert.ok(phaseModel.coverage[0]?.text.includes("REQ-000001"));
  assert.equal(phaseModel.coverage[0]?.location.line, 1);
  const relation =
    "| [REQ-000001](source.md) | `req-000001.qa-000001` | Definition | [Goal](../../Definitions/QA-000001/quality_definition.md) | 条件 A | UT | Direct Boundary | `RCM-UT-001` |";
  const model = evaluateQualityFixture(
    summary,
    [`## 3. 検証目標への統合\n${relation}\n## 次`],
    new Set(["REQ-000001"]),
    { path: "integration.md", content: "" },
    "analysis",
  );
  assert.equal(model.issues.length, 0);
  assert.deepEqual(
    [...model.analysisSourceRelations],
    ["REQ-000001|QA-000001|RCM-UT-001"],
  );
  assert.equal(
    model.analysisSourceConditions.get("REQ-000001|QA-000001"),
    "条件 A",
  );
  const duplicate = evaluateQualityFixture(
    `${summary}\n${summary}`,
    [
      `## 3. 検証目標への統合\n${relation}\n${relation.replace("条件 A", "条件 B")}\n## 次`,
    ],
    new Set(["REQ-000001"]),
    { path: "integration.md", content: "" },
    "analysis",
  );
  assert.equal(
    duplicate.analysisSourceConditions.get("REQ-000001|QA-000001"),
    "条件 B",
  );
  assert.deepEqual(
    duplicate.issues.map((issue) => issue.reason),
    [
      "canonical-mapping-duplicate-row",
      "canonical-source-goal-duplicate",
      "source-relation-duplicate",
    ],
  );
  const incomplete = evaluateQualityFixture(
    summary,
    [
      `## 3. 検証目標への統合\n${relation.replace("req-000001.qa-000001", "wrong")}\n## 次`,
    ],
    new Set(),
    { path: "integration.md", content: "" },
    "analysis",
  );
  assert.equal(incomplete.analysisSourceRelations.size, 1);
  assert.ok(
    incomplete.issues.some(
      (issue) => issue.reason === "source-local-relation-incomplete",
    ),
  );
  assert.deepEqual(
    ["## 2. 全件Coverage Index\nrow\n## 次", "missing"].map(
      (content) =>
        parseQualityAnalysis({ path: "phase.md", content }).result.coverage[0]
          ?.text,
    ),
    ["\nrow\n", undefined],
  );
});

/**
 * Quality Detail検証単位は行・領域・重複・関係を照合する。
 * @responsibility 行、領域、重複と関係の不一致を区別する。
 * @trace RCM-UT-002
 * @precondition Detailの行・領域・関係の合成値を用意する。
 * @stimulus Detail検証単位を検査する。
 * @observation 重複・不足・関係のIssueを取得する。
 * @oracle 行、領域、重複と関係の不一致を区別する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Quality Detail検証単位は行・領域・重複・関係を照合する", () => {
  const row =
    "| [sample](../06_Architecture/Details/sample/01_Architecture.md) | key | [Goal](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001` | Covered | なし |";
  const model = observeQualityDetailFixture(
    row,
    new Set(["sample"]),
    new Set(["sample"]),
    "integration.md",
  );
  assert.equal(model.issues.length, 0);
  assert.deepEqual([...model.analysisDetailUnits], ["sample|key"]);
  const duplicate = observeQualityDetailFixture(
    `${row}\n${row}`,
    new Set(),
    new Set(["sample"]),
    "integration.md",
  );
  assert.ok(
    duplicate.issues.some(
      (issue) => issue.reason === "architecture-detail-unit-duplicate",
    ),
  );
  assert.ok(
    duplicate.issues.some(
      (issue) => issue.reason === "architecture-detail-coverage-mismatch",
    ),
  );
});

/**
 * Qualityの関係閉包は集合の一致と段階・境界の不足を別に検出する。
 * @responsibility 完全一致と段階・境界不足を別の理由として検出する。
 * @trace RCM-UT-002
 * @precondition 期待集合と不足する段階・境界の関係を用意する。
 * @stimulus 三種の関係閉包を検査する。
 * @observation 集合差と不足理由を取得する。
 * @oracle 完全一致と段階・境界不足を別の理由として検出する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Qualityの関係閉包は集合の一致と段階・境界の不足を別に検出する", () => {
  const empty = new Set<string>();
  const values = new Map<string, string>();
  const levels = new Map<string, ReadonlySet<string>>();
  const base = {
    definitionSourceRelationEntries: [],
    definitionSourceRelations: empty,
    definitionGoalLocalRelationEntries: [],
    definitionGoalLocalRelations: empty,
    definitionDetailGoalRelationEntries: [],
    definitionDetailGoalRelations: empty,
    analysisDetailGoalRelations: empty,
    analysisSourceRelations: empty,
    definitionObligationKeyEntries: [],
    analysisObligationKeys: values,
    definitionObligationKeys: values,
    analysisSourceGoalLevels: levels,
    localItemLevels: values,
    summarySourceLevels: levels,
    definitionSourceGoalLevels: levels,
    analysisSourceConditions: values,
    definitionSourceConditions: values,
    definitionsRoot: "definitions",
    analysisPath: "integration.md",
  };
  assert.equal(
    inspectDocumentRelations({ kind: "quality_definition_relations", ...base })
      .length,
    0,
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "quality_definition_relations",
      ...{
        ...base,
        definitionSourceRelationEntries: ["duplicate"],
      },
    })[0]?.reason,
    "definition-source-relation-duplicate",
  );
  const local = observeQualityLocalFixture({
    analysis:
      "## 4. 検証項目の閉包\n| [Goal](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001` |\n## 次",
    localItemOwners: new Map([["RCM-UT-001", "definition.md"]]),
    analysisDetailUnitLocalRelations: new Set(["sample|key|RCM-UT-001"]),
    physicalDetailUnits: new Set(["sample|key"]),
    physicalDetailUnitLevels: new Map([["sample|key", new Set(["IT"])]]),
    physicalDetailUnitBoundaryStages: new Map([["sample|key", "System/E2E"]]),
    localItemLevels: new Map([["RCM-UT-001", "UT"]]),
    localItemBoundaryStages: new Map([["RCM-UT-001", "Direct Boundary"]]),
    analysisPath: "integration.md",
  });
  assert.deepEqual(
    local.issues.map((issue) => issue.reason),
    [
      "architecture-detail-unit-level-coverage-mismatch",
      "architecture-detail-unit-boundary-coverage-mismatch",
    ],
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "quality_goal_local_relations",
      ...{
        ...local,
        definitionGoalLocalRelations: new Set(["QA-000001|RCM-UT-001"]),
        analysisPath: "integration.md",
      },
    }).length,
    0,
  );
});

/**
 * Quality書式は可視Checklist・件数・層・必須適用表を限定して判定する。
 * @responsibility 既存の可視性・件数・層・適用条件だけで判定する。
 * @trace RCM-UT-002
 * @precondition 可視・非可視Checklist、件数と必須適用表を用意する。
 * @stimulus 品質Templateと件数条件を検査する。
 * @observation 各限定条件の真偽を取得する。
 * @oracle 既存の可視性・件数・層・適用条件だけで判定する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Quality書式は可視Checklist・件数・層・必須適用表を限定して判定する", () => {
  assert.equal(
    captureQualityDocument({
      path: "quality.md",
      content: "## Checklist\n- OPEN: 確認待ち",
    }).hasOpenChecklist,
    true,
  );
  assert.equal(
    captureQualityDocument({
      path: "quality.md",
      content: "```md\n## Checklist\n- OPEN: 隠れた項目\n```",
    }).hasOpenChecklist,
    false,
  );
  assert.equal(
    captureQualityDocument({
      path: "quality.md",
      content: "## Checklist\n- [ ] 未確認",
    }).hasOpenChecklist,
    true,
  );
  assert.equal(
    captureQualityDocument({
      path: "quality.md",
      content: "## Checklist\n- PASS: 確認済み",
    }).hasOpenChecklist,
    false,
  );
  assert.equal(
    captureQualityDocument({
      path: "quality.md",
      content: "| Local Item数 | 1 |",
    }).localItemCount !== 1,
    false,
  );
  assert.equal(
    captureQualityDocument({ path: "quality.md", content: "" })
      .localItemCount !== 0,
    true,
  );
  assert.equal(
    captureQualityTemplate(
      {
        path: "analysis.md",
        content: "Source Layer Definition／Detail 導出元／Relation",
      },
      "analysis",
    ).valid,
    true,
  );
  assert.equal(
    captureQualityTemplate(
      {
        path: "integration.md",
        content:
          "## 3. Definition／Detail入力の統合\nSource Layer Same／New／Merge",
      },
      "integration",
    ).valid,
    true,
  );
  assert.equal(
    captureQualityTemplate({ path: "analysis.md", content: "" }, "analysis")
      .valid,
    false,
  );
  assert.equal(
    captureQualityTemplate(
      { path: "integration.md", content: "" },
      "integration",
    ).valid,
    false,
  );
  const items = [
    "安全上重要な層間搬送",
    "耐久状態のAuthority分類",
    "発行前失敗／発行後失敗／retry",
    "残存資源／Recovery",
    "根拠の主張軸（入口形態）",
    "根拠の主張軸（観測基盤）",
    "根拠の主張軸（成果物Identity）",
    "根拠の主張軸（lifecycle）",
    "性能試験（PT）",
    "負荷試験（LT）",
    "人間による判断",
  ];
  const content = `### 必須の適用判断\n| 評価対象 | 判定 | 内容／理由 | 根拠／再評価契機 |\n${items.map((item) => `| ${item} | Applicable／N/A／OPEN |`).join("\n")}`;
  assert.equal(
    captureQualityTemplate(
      { path: "result.md", content },
      "verification_result",
    ).valid,
    true,
  );
  for (const item of items)
    assert.equal(
      captureQualityTemplate(
        { path: "result.md", content: content.replace(item, "missing") },
        "verification_result",
      ).valid,
      false,
    );
});

/**
 * Qualityが九種類のChecklist受付を所有することを検証する。
 * @responsibility 種別と方式を明示し、旧構文エンジンの失敗理由を保持する。
 * @trace RCM-UT-002
 * @precondition 九種類・両方式と正常／異常の合成本文。
 * @stimulus 既存の内容受付へChecklist条件も渡す。
 * @observation 選択条件・期待項目・構造の失敗理由・未指定を取得する。
 * @oracle 元の構文検査と一致し、配列・原文を別受付と共有しない。
 * @cleanup N/A: 同期的な局所値のみ。
 * @boundary Quality文書の内容・固定条件とArtifact構文エンジン。
 */
test("Quality九種類のChecklistは内容受付で種別・方式・失敗理由を保持する", () => {
  assert.equal(
    captureQualityDocument({ path: "quality.md", content: "" })
      .checklistContract,
    null,
  );
  for (const kind of [
    "center",
    "strategy",
    "verification_design",
    "integration",
    "reality_audit",
    "verification_result",
    "analysis",
    "analysis_detail",
    "definition",
  ] as const) {
    for (const mode of ["template", "evaluated"] as const) {
      const request = { kind, mode };
      const first = captureQualityDocument(
        { path: "quality.md", content: "" },
        request,
      );
      const expected = first.checklistContract.expectedItems;
      const inspect =
        mode === "template"
          ? inspectTemplateChecklist
          : inspectEvaluatedChecklist;
      const body = `## Checklist\n${mode === "template" ? "[x] [ ] OPEN FAIL N/A 理由\n" : ""}${expected.map((item) => `- [${mode === "template" ? " " : "x"}] ${item}`).join("\n")}`;
      for (const content of [
        "",
        body,
        `<!--\n${body}\n-->`,
        `\x60\x60\x60\n${body}\n\x60\x60\x60`,
        `${body}\n本文`,
        body.replace(expected[0] ?? "", "別の項目"),
      ]) {
        const parsed = captureQualityDocument(
          { path: "quality.md", content },
          request,
        );
        assert.equal(parsed.checklistContract.kind, kind);
        assert.equal(parsed.checklistContract.mode, mode);
        assert.equal(
          parsed.checklistContract.failure,
          inspect(content, expected),
        );
        assert.deepEqual(parsed.checklistContract.expectedItems, expected);
        assert.equal(parsed.source.content, content);
      }
      const valid = captureQualityDocument(
        { path: "quality.md", content: body },
        request,
      );
      assert.equal(valid.checklistContract.failure, null);
      (first.checklistContract.expectedItems as string[]).push("only-first");
      assert.notDeepEqual(
        first.checklistContract.expectedItems,
        valid.checklistContract.expectedItems,
      );
      assert.equal(
        captureQualityDocument(
          { path: "quality.md", content: body },
          request,
        ).checklistContract.expectedItems.includes("only-first"),
        false,
      );
    }
  }
  assert.throws(
    () =>
      captureQualityDocument({ path: "quality.md", content: "" }, {
        kind: "unknown",
        mode: "template",
      } as never),
    /unknown_quality_checklist_kind/u,
  );
  assert.throws(
    () =>
      captureQualityDocument({ path: "quality.md", content: "" }, {
        kind: "center",
        mode: "unknown",
      } as never),
    /unknown_quality_checklist_mode/u,
  );
});

/**
 * Qualityひな型の原文・可視本文の境界と部分解析を確認する。
 * @responsibility 三種類の旧条件を保ち、重複出現と不足を出典付きで保持する。
 * @trace RCM-UT-002
 * @precondition 可視・コメント・Fence・重複と不足を含む合成ひな型。
 * @stimulus 三種類のひな型受付へ原文を渡す。
 * @observation 内容・出典・期待表現・validを取得する。
 * @oracle 既存のsubstring条件だけで充足を判定し、不足でも内容を失わない。
 * @cleanup N/A: 同期的な局所値のみ。
 * @boundary 原文とQualityひな型の内容モデル。
 */
test("Qualityひな型は種類別のraw・可視条件と重複・部分内容を保持する", () => {
  const analysis = "Source Layer Definition／Detail 導出元／Relation";
  const integration =
    "## 3. Definition／Detail入力の統合\nSource Layer Same／New／Merge";
  for (const [kind, content] of [
    ["analysis", analysis],
    ["integration", integration],
  ] as const) {
    for (const hidden of [
      `<!--\n${content}\n-->`,
      `\x60\x60\x60text\n${content}\n\x60\x60\x60`,
    ]) {
      const model = captureQualityTemplate(
        { path: "template.md", content: hidden },
        kind,
      );
      assert.equal(model.valid, false);
      assert.equal(model.source.content, hidden);
      assert.equal(
        model.requirements.every((item) => item.occurrences.length === 0),
        true,
      );
    }
    const model = captureQualityTemplate(
      { path: "template.md", content: `prefix ${content}\n${content}` },
      kind,
    );
    assert.equal(model.valid, true);
    assert.equal(
      model.requirements.every((item) => item.occurrences.length === 2),
      true,
    );
    assert.equal(model.requirements[0]?.occurrences[0]?.location.line, 1);
  }
  const source = {
    path: "template.md",
    content: `${analysis}\n| A | B |\n${analysis}`,
  };
  const captured = captureQualityTemplate(source, "analysis");
  source.content = "changed";
  assert.notEqual(captured.source.content, source.content);
  assert.equal(captured.tableRows.length, 1);
  assert.equal(captured.tableRows[0]?.location.line, 2);
  assert.equal(captured.requirements[0]?.occurrences[1]?.location.line, 3);
  assert.equal(Object.hasOwn(captured, "issues"), false);
  const partial = captureQualityTemplate(
    { path: "partial.md", content: "Source Layer" },
    "analysis",
  );
  assert.equal(partial.valid, false);
  assert.equal(partial.requirements[0]?.occurrences.length, 1);
  assert.equal(partial.requirements[1]?.occurrences.length, 0);
  const verification = captureQualityTemplate(
    { path: "result.md", content: "" },
    "verification_result",
  );
  assert.equal(verification.requirements.length, 13);
  const body = verification.requirements.map((item) => item.text).join("\n");
  for (const content of [
    body,
    `<!--\n${body}\n-->`,
    `\x60\x60\x60\n${body}\n\x60\x60\x60`,
  ])
    assert.equal(
      captureQualityTemplate(
        { path: "result.md", content },
        "verification_result",
      ).valid,
      true,
    );
  for (const requirement of verification.requirements)
    assert.equal(
      captureQualityTemplate(
        {
          path: "result.md",
          content: body.replace(requirement.text, "missing"),
        },
        "verification_result",
      ).valid,
      false,
    );
  assert.throws(
    () =>
      captureQualityTemplate(
        { path: "unknown.md", content: "" },
        "unknown" as never,
      ),
    /unknown_quality_template_kind/u,
  );
});

/**
 * 横断表の部分行・重複・生本文と参照抽出の範囲を確認する。
 * @responsibility 行filterとCell分割をQualityが所有し、比較前の観測を失わない。
 * @trace RCM-UT-002
 * @precondition Header、重複行、不正列数、コメント、Fence、表外参照を含む本文。
 * @stimulus 既存の品質分析入口へ取得済み本文を渡す。
 * @observation 解析済みの行・参照列を取得する。
 * @oracle 順序と重複を保持し、参照はfilter前の節全体から得る。
 * @cleanup N/A: 合成本文だけを扱う。
 * @boundary Qualityの生本文からSemantic用解析モデル。
 */
test("Quality横断表は不正行・重複・非表示本文と表外参照を保持する", () => {
  const row =
    "| Goal | Required | Required | Required | Required | N/A: 理由 |";
  const reference = "../06_Architecture/Model.md";
  const content = [
    "## 2. Architecture横断モデルの処置",
    "| 検証目標 | A |",
    "| --- | --- |",
    row,
    row,
    "| Broken | x |",
    `表外 [A](${reference}) [B](${reference})`,
    "<!--",
    "| Comment | x |",
    "-->",
    "~~~md",
    "| Fenced | y |",
    "~~~",
    "## 3. 次",
  ].join("\r\n");
  const model = evaluateQualityFixture(
    "",
    [],
    new Set(),
    { path: "integration.md", content },
    "analysis",
  );
  const cells = [
    "Goal",
    "Required",
    "Required",
    "Required",
    "Required",
    "N/A: 理由",
  ];
  assert.deepEqual(model.crossModelRows, [
    cells,
    cells,
    ["Broken", "x"],
    ["Comment", "x"],
    ["Fenced", "y"],
  ]);
  assert.deepEqual(model.crossModelReferences, [reference, reference]);
});

/**
 * 最初の横断節と次H2必須の従来契約を確認する。
 * @responsibility 共通Section抽出と異なるEOF・欠測条件を維持する。
 * @trace RCM-UT-002
 * @precondition 同名節、節末EOF、見出し欠測を用意する。
 * @stimulus Quality解析を実行する。
 * @observation 行の出現列を取得する。
 * @oracle 最初の節だけを読み、次H2がなければ欠測として空列を返す。
 * @cleanup N/A: 局所値のみ。
 * @boundary 生本文と解析モデル。
 */
test("Quality横断節は最初の一致と次H2必須を維持する", () => {
  const heading = "## 2. Architecture横断モデルの処置";
  const row = "| First | x |";
  const read = (content: string) =>
    evaluateQualityFixture(
      "",
      [],
      new Set(),
      { path: "integration.md", content },
      "analysis",
    );
  assert.deepEqual(read(`${heading}\n${row}`).crossModelRows, []);
  assert.deepEqual(read(`${row}\n## 3. 次`).crossModelRows, []);
  assert.deepEqual(
    read(
      heading +
        "\n" +
        row +
        "\n## 3. 次\n" +
        heading +
        "\n| Second | y |\n## 4. 次",
    ).crossModelRows,
    [["First", "x"]],
  );
});

/**
 * 担当モデルが原文・出典と旧抽出条件を保持するか確認する。
 * @responsibility 最初の所属、列内の先頭ID、行内と別行の重複を区別する。
 * @trace RCM-UT-002
 * @precondition 明示担当と不正行・重複・非表示IDを含む取得済み本文。
 * @stimulus 工程Ownerの完成構築入口を呼ぶ。
 * @observation モデルの値・出典・原文と後勝ち対応。
 * @oracle 欠測を補完せず、担当宣言を実検証済みにしない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary 同一Processの工程モデル構築。
 */

test("Quality中央担当モデルは全可視IDと採用行を区別する", () => {
  const key = "PRT-000001.spec-000001";
  const row = `| ${key} | BHV-000001 | QA-000001 | Single | Covered |`;
  const content = `${row}\n${row.replace("BHV-000001", "BHV-000002")}\n| SCR-000099 PRT-000099 | BHV-000099 |\n<!-- SCR-999999 -->`;
  const model = parseQualityDetailAnalysis({
    path: "quality-trace.md",
    content,
  }).result.trace;
  assert.equal(model.relationRows, 2);
  assert.equal(model.relations.get(key)?.bhv, "BHV-000002");
  assert.equal(model.hasDuplicateRelations, true);
  assert.deepEqual([...model.screens], ["SCR-000099"]);
  assert.deepEqual([...model.parts], ["PRT-000001", "PRT-000099"]);
  assert.deepEqual(
    [...model.behaviors],
    ["BHV-000001", "BHV-000002", "BHV-000099"],
  );
  assert.equal(model.tableRows.length, 3);
  assert.equal(model.tableRows[2]?.location.line, 3);
  assert.equal(model.source.content, content);
});

/** Detail比較の既存反証を完成した統合モデルへ接続する試験準備。@trace RCM-UT-002 */
function observeQualityDetailFixture(
  detailSection: string | undefined,
  linkedDetailPaths: ReadonlySet<string>,
  physicalDetailPaths: ReadonlySet<string>,
  analysisPath: string,
) {
  const integration = parseQualityIntegration({
    path: analysisPath,
    content:
      detailSection === undefined
        ? ""
        : `## 3. Architecture詳細設計領域の処置\n${detailSection}`,
  });
  return {
    ...integration.result.detailUnitData,
    issues: inspectDocumentRelations({
      kind: "quality_detail_coverage",
      integration,
      linkedDetailPaths,
      physicalDetailPaths,
      analysisPath,
    }),
  };
}

/** Local Item比較の既存反証を完成した統合モデルへ接続する試験準備。@trace RCM-UT-002 */
function observeQualityLocalFixture(
  request: Omit<
    Extract<DocumentRelationsRequest, { kind: "quality_local_item_relations" }>,
    "kind" | "integration"
  > & { analysis: string },
) {
  const { analysis, ...observed } = request;
  const integration = parseQualityIntegration({
    path: request.analysisPath,
    content: analysis,
  }).result;
  return {
    ...integration.localItemData,
    issues: inspectDocumentRelations({
      kind: "quality_local_item_relations",
      integration,
      ...observed,
    }),
  };
}
