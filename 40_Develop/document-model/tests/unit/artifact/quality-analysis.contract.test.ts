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
  inspectQualityCenterState,
  inspectQualityRealityState,
  inspectQualityAnalysis,
  inspectQualityCrossModelGoals,
  inspectQualityDetailUnits,
  inspectQualityDefinitionRelations,
  inspectQualityLocalItemRelations,
  inspectQualityGoalLocalRelations,
  parseQualityDetailHandoff,
  parseQualityCoverageSections,
  hasQualityOpenChecklist,
  isQualityLocalItemCountInvalid,
  isQualityAnalysisTemplateInvalid,
  isQualityIntegrationTemplateInvalid,
  isQualityVerificationResultTemplateInvalid,
} from "../../../src/index.ts";

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
    const center = inspectQualityCenterState(
      `状態: v0.22.0 ${state}（Released Baseline: v0.21.0）`,
      "center.md",
    );
    assert.equal(center.normalizedQualityState, state);
    assert.equal(center.issues.length, index === 3 ? 1 : 0);
    for (const [realityIndex, reality] of realityStates.entries()) {
      const issues = inspectQualityRealityState(
        reality,
        "reality.md",
        "center.md",
        center,
      ).issues;
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
  const relation =
    "| [REQ-000001](source.md) | `req-000001.qa-000001` | Definition | [Goal](../../Definitions/QA-000001/quality_definition.md) | 条件 A | UT | Direct Boundary | `RCM-UT-001` |";
  const model = inspectQualityAnalysis(
    summary,
    [`## 3. 検証目標への統合\n${relation}\n## 次`],
    new Set(["REQ-000001"]),
    "integration.md",
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
  const duplicate = inspectQualityAnalysis(
    `${summary}\n${summary}`,
    [
      `## 3. 検証目標への統合\n${relation}\n${relation.replace("条件 A", "条件 B")}\n## 次`,
    ],
    new Set(["REQ-000001"]),
    "integration.md",
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
  const incomplete = inspectQualityAnalysis(
    summary,
    [
      `## 3. 検証目標への統合\n${relation.replace("req-000001.qa-000001", "wrong")}\n## 次`,
    ],
    new Set(),
    "integration.md",
    "analysis",
  );
  assert.equal(incomplete.analysisSourceRelations.size, 1);
  assert.ok(
    incomplete.issues.some(
      (issue) => issue.reason === "source-local-relation-incomplete",
    ),
  );
  assert.deepEqual(
    parseQualityCoverageSections([
      "## 2. 全件Coverage Index\nrow\n## 次",
      "missing",
    ]),
    ["\nrow\n", undefined],
  );
});

/**
 * Quality横断モデルとDetail検証単位は行・領域・重複・関係を照合する。
 * @responsibility 行、領域、重複と関係の不一致を区別する。
 * @trace RCM-UT-002
 * @precondition 横断モデルとDetailの行・領域・関係の合成値を用意する。
 * @stimulus 横断モデルと検証単位を検査する。
 * @observation 重複・不足・関係のIssueを取得する。
 * @oracle 行、領域、重複と関係の不一致を区別する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Quality横断モデルとDetail検証単位は行・領域・重複・関係を照合する", () => {
  const labels = new Map([["Goal", "QA-000001"]]);
  assert.equal(
    inspectQualityCrossModelGoals(
      "| Goal | Required | Required | Required | Required | N/A: 理由 |",
      labels,
      "integration.md",
    ).issues.length,
    0,
  );
  const invalid = inspectQualityCrossModelGoals(
    "| Goal | BAD | Required | Required | Required | Required |\n| Goal | Required | Required | Required | Required | Required |\n| Unknown | x |",
    labels,
    "integration.md",
  );
  assert.deepEqual(
    invalid.issues.map((issue) => issue.reason),
    [
      "cross-model-disposition-invalid",
      "cross-model-goal-duplicate",
      "cross-model-row-invalid",
    ],
  );
  const row =
    "| [sample](../06_Architecture/Details/sample/01_Architecture.md) | key | [Goal](Definitions/QA-000001/quality_definition.md) | `RCM-UT-001` | Covered | なし |";
  const model = inspectQualityDetailUnits(
    row,
    new Set(["sample"]),
    new Set(["sample"]),
    "integration.md",
  );
  assert.equal(model.issues.length, 0);
  assert.deepEqual([...model.analysisDetailUnits], ["sample|key"]);
  const duplicate = inspectQualityDetailUnits(
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
  const handoff = parseQualityDetailHandoff(
    "## Qualityへの引渡し\n| key | a | b | c | d | UT／IT | Direct Boundary／System/E2E |\n| key | a | b | c | d | ST | N/A |\n## 次",
    "sample",
  );
  assert.deepEqual([...handoff.physicalDetailUnits], ["sample|key"]);
  assert.deepEqual(
    [...(handoff.physicalDetailUnitLevels.get("sample|key") ?? [])],
    ["ST"],
  );
  assert.equal(
    handoff.physicalDetailUnitBoundaryStages.get("sample|key"),
    "N/A",
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
  assert.equal(inspectQualityDefinitionRelations(base).issues.length, 0);
  assert.equal(
    inspectQualityDefinitionRelations({
      ...base,
      definitionSourceRelationEntries: ["duplicate"],
    }).issues[0]?.reason,
    "definition-source-relation-duplicate",
  );
  const local = inspectQualityLocalItemRelations({
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
    inspectQualityGoalLocalRelations({
      ...local,
      definitionGoalLocalRelations: new Set(["QA-000001|RCM-UT-001"]),
      analysisPath: "integration.md",
    }).issues.length,
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
  assert.equal(hasQualityOpenChecklist("## Checklist\n- OPEN: 確認待ち"), true);
  assert.equal(
    hasQualityOpenChecklist("```md\n## Checklist\n- OPEN: 隠れた項目\n```"),
    false,
  );
  assert.equal(hasQualityOpenChecklist("## Checklist\n- [ ] 未確認"), true);
  assert.equal(
    hasQualityOpenChecklist("## Checklist\n- PASS: 確認済み"),
    false,
  );
  assert.equal(
    isQualityLocalItemCountInvalid("| Local Item数 | 1 |", 1),
    false,
  );
  assert.equal(isQualityLocalItemCountInvalid("", 0), true);
  assert.equal(
    isQualityAnalysisTemplateInvalid(
      "Source Layer Definition／Detail 導出元／Relation",
    ),
    false,
  );
  assert.equal(
    isQualityIntegrationTemplateInvalid(
      "## 3. Definition／Detail入力の統合\nSource Layer Same／New／Merge",
    ),
    false,
  );
  assert.equal(isQualityAnalysisTemplateInvalid(""), true);
  assert.equal(isQualityIntegrationTemplateInvalid(""), true);
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
  assert.equal(isQualityVerificationResultTemplateInvalid(content), false);
  for (const item of items)
    assert.equal(
      isQualityVerificationResultTemplateInvalid(
        content.replace(item, "missing"),
      ),
      true,
    );
});
