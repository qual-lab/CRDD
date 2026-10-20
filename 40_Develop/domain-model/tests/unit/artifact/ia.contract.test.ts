/**
 * IA本文の抽出結果と関係の不変条件を検証する。
 * @packageDocumentation
 * @responsibility 不正本文からの抽出保持、順序付き関係、重複・不足・余剰を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、ia、relations
 * @boundary RCM-UT-002=N/A: 取得済み合成本文の純粋な検査。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseIaIndex,
  inspectIaAnalysis,
  inspectIaDefinition,
  inspectIaAnalysisCoverage,
  inspectIaIndexCoverage,
  inspectIaCrossProjection,
  inspectIaRelations,
} from "../../../src/index.ts";

/**
 * IA入口の重複を列に保持して、関係閉包で拒否する。
 * @responsibility 入口の登録集合だけで重複が消えたと扱わないことを確認する。
 * @trace RCM-UT-002
 * @precondition 同じ関係を二行持つ合成入口を使う。
 * @stimulus 入口解析と関係照合を呼ぶ。
 * @observation ID集合、関係列と中立Issueを取得する。
 * @oracle 登録集合は一IDでも関係列は二件を保持し、重複関係を拒否する。
 * @cleanup N/A: 局所モデルだけを使う。
 * @boundary RCM-UT-002=N/A: 同期的なモデル検査。
 */
test("IA入口は重複関係を保持し、現在の段階で閉包を判定する", () => {
  const row =
    "| [IA-000001](Definitions/IA-000001/ia_definition.md) | Project | UX-000001 |";
  const index = parseIaIndex({ path: "ia.md", content: `${row}\n${row}` });
  assert.deepEqual([...index.ids], ["IA-000001"]);
  assert.deepEqual(index.pairs, ["UX-000001|IA-000001", "UX-000001|IA-000001"]);
  assert.deepEqual(
    inspectIaIndexCoverage(index, new Set(["IA-000001"]), "ia.md"),
    [],
  );
  const issues = inspectIaRelations(
    index,
    [
      {
        objects: new Set(),
        objectIdentities: new Map(),
        pairs: ["UX-000001|IA-000001"],
        mappingKeys: [],
        issues: [],
      },
    ],
    [{ pairs: ["UX-000001|IA-000001"], mappingKeys: [], issues: [] }],
    "ia.md",
  );
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    ["artifact.ia.analysis-definition-closure-mismatch"],
  );
  assert.equal(inspectIaIndexCoverage(index, new Set(), "ia.md").length, 1);
  assert.equal(
    inspectIaAnalysisCoverage(new Set(["UX-000001"]), new Set(), "ia.md")
      .length,
    1,
  );
});

/**
 * 不正なIA本文でも抽出できたObjectと対応関係を後続へ渡す。
 * @responsibility 不正をnullへ畳まず、現在の解析・定義対応列を保持する。
 * @trace RCM-UT-002
 * @precondition 必須節が不足するが、Object・対応表・情報源を持つ本文を使う。
 * @stimulus 分析検査、定義検査、関係照合を順に呼ぶ。
 * @observation 各本文のIssueとObject・Identity・対応列を取得する。
 * @oracle 本文不正のIssueを返す一方で、取得可能な対応関係は維持する。
 * @cleanup N/A: 局所モデルだけを使う。
 * @boundary RCM-UT-002=N/A: 同期的なモデル検査。
 */
test("IA本文不正でもObjectとIdentity／Relationを後続へ保持する", () => {
  const analysis = inspectIaAnalysis(
    {
      path: "analysis.md",
      content: `
| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |
| --- | --- | --- |
| Project | 対象 | Project ID |
| 接続先 | 分析Object | Canonical Object | 処置 | 判断理由 |
| --- | --- | --- | --- | --- |
| IA-000001 | Project | Project | Same | 同じ対象 |
## 5. IA処置
[IA-000001](../../Definitions/IA-000001/ia_definition.md)
`,
    },
    "UX-000001",
  );
  assert.equal(analysis.issues.length, 1);
  assert.deepEqual([...analysis.objects], ["Project"]);
  assert.equal(analysis.objectIdentities.get("Project"), "Project ID");
  assert.deepEqual(analysis.pairs, ["UX-000001|IA-000001"]);
  const definition = inspectIaDefinition(
    {
      path: "definition.md",
      content: `
| 対象 | 利用者にとっての意味 | 識別・関係 |
| --- | --- | --- |
| Project（補足） | 対象 | Project ID |
| Source Analysis Object | Canonical Object | 処置 | 判断理由 |
| --- | --- | --- | --- |
| UX-000001: Project | Project | Same | 同じ対象 |
## 情報源
[UX-000001のIA分析](../../Analysis/UX-000001/ia_analysis.md)
`,
    },
    "IA-000001",
    new Map([["UX-000001", analysis]]),
  );
  assert.equal(definition.issues.length, 1);
  assert.deepEqual(definition.pairs, analysis.pairs);
  assert.deepEqual(definition.mappingKeys, analysis.mappingKeys);
  const index = parseIaIndex({
    path: "ia.md",
    content:
      "| [IA-000001](Definitions/IA-000001/ia_definition.md) | Project | UX-000001 |",
  });
  assert.deepEqual(
    inspectIaRelations(index, [analysis], [definition], "ia.md"),
    [],
  );
  assert.deepEqual(
    inspectIaRelations(
      index,
      [
        {
          ...analysis,
          mappingKeys: [...analysis.mappingKeys, ...analysis.mappingKeys],
        },
      ],
      [definition],
      "ia.md",
    ).map((issue) => issue.kind),
    ["artifact.ia.object-mapping-closure-mismatch"],
  );
});

/**
 * 横断投影は専用節内のIA関係だけを数える。
 * @responsibility 重複節・重複行・節外の関係を成立根拠にしないことを確認する。
 * @trace RCM-UT-002
 * @precondition 一ID集合と正負の投影本文を用意する。
 * @stimulus 横断投影検査を呼ぶ。
 * @observation 中立Issueの数と位置を取得する。
 * @oracle 正しい専用節の一回投影だけを受理する。
 * @cleanup N/A: 文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期的な本文検査。
 */
test("IA横断投影は専用節・順序・重複の既存条件を保つ", () => {
  const link = "[IA-000001](Definitions/IA-000001/ia_definition.md)";
  const ids = new Set(["IA-000001"]);
  assert.deepEqual(
    inspectIaCrossProjection(
      { path: "cross.md", content: `## 4. IA定義への適用\n${link}` },
      ids,
    ),
    [],
  );
  for (const content of [
    link,
    `## 4. IA定義への適用\n${link}\n${link}`,
    `## 4. IA定義への適用\n${link}\n## 4. IA定義への適用\n${link}`,
  ]) {
    const issues = inspectIaCrossProjection({ path: "cross.md", content }, ids);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.location.path, "cross.md");
  }
});
