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
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../src/artifact/checklist.ts";
import { iaChecklistItems } from "../../../src/ia/validation.ts";
import {
  inspectIaConsistency,
  parseIaAnalysis,
  parseIaDefinition,
  parseIaIndex,
  parseIaObjectRelation,
  parseIaStateVisibility,
  parseIaStructureNavigation,
} from "../../../src/index.ts";

/**
 * IA文書の内容と六種類のChecklist受付を検証する。
 * @responsibility 種別・方式・出典・部分本文と旧構文の失敗理由を保持する。
 * @trace RCM-UT-002
 * @precondition 六種類・両方式と正常／異常の合成本文。
 * @stimulus 原文と明示した条件を文書受付へ渡す。
 * @observation 原文・表・Checklist節・期待列・失敗理由を取得する。
 * @oracle 旧構文検査と一致し、期待列と原文を別受付と共有しない。
 * @cleanup N/A: 同期的な局所値のみ。
 * @boundary 原文からIA内容モデルとChecklist条件。
 */
test("IA六種類のChecklistは内容・出典と検査結果を保持する", () => {
  for (const kind of [
    "index",
    "object_relation",
    "structure_navigation",
    "state_visibility",
    "analysis",
    "definition",
  ] as const) {
    for (const mode of ["template", "evaluated"] as const) {
      const request = { kind, mode };
      const first = parseDocumentFixture(
        { path: "ia.md", content: "" },
        request,
      );
      const expected = first.checklistContract.expectedItems;
      const inspect =
        mode === "template"
          ? inspectTemplateChecklist
          : inspectEvaluatedChecklist;
      const body = `前文\n| A | B |\n## Checklist\n${mode === "template" ? "[x] [ ] OPEN FAIL N/A 理由\n" : ""}${expected.map((item) => `- [${mode === "template" ? " " : "x"}] ${item}`).join("\n")}`;
      for (const content of [
        "",
        body,
        `<!--\n${body}\n-->`,
        `\x60\x60\x60\n${body}\n\x60\x60\x60`,
        `${body}\n本文`,
        body.replace(expected[0] ?? "", "別項目"),
      ]) {
        const parsed = parseDocumentFixture(
          { path: "ia.md", content },
          request,
        );
        assert.equal(
          parsed.checklistContract.failure,
          inspect(content, expected),
        );
        assert.deepEqual(parsed.checklistContract.expectedItems, expected);
        assert.equal(parsed.source.content, content);
        assert.equal(parsed.checklistContract.kind, kind);
        assert.equal(parsed.checklistContract.mode, mode);
        assert.equal(Object.hasOwn(parsed, "issues"), false);
      }
      const source = { path: "ia.md", content: body };
      const valid = parseDocumentFixture(source, request);
      source.content = "changed";
      assert.equal(valid.source.content, body);
      assert.equal(valid.tableRows[0]?.location.line, 2);
      assert.equal(valid.checklist[0]?.heading.location.line, 3);
      assert.equal(valid.checklistContract.failure, null);
      (first.checklistContract.expectedItems as string[]).push("only-first");
      assert.notDeepEqual(
        first.checklistContract.expectedItems,
        valid.checklistContract.expectedItems,
      );
      assert.equal(
        parseDocumentFixture(
          { path: "ia.md", content: body },
          request,
        ).checklistContract.expectedItems.includes("only-first"),
        false,
      );
    }
  }
  assert.throws(
    () => iaChecklistItems("unknown" as never),
    /unknown_ia_checklist_kind/u,
  );
  assert.throws(
    () =>
      parseDocumentFixture({ path: "ia.md", content: "" }, {
        kind: "index",
        mode: "unknown",
      } as never),
    /unknown_ia_checklist_mode/u,
  );
});

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
  const index = parseIaIndex({
    path: "ia.md",
    content: `${row}\n${row}`,
  }).result;
  assert.deepEqual([...index.ids], ["IA-000001"]);
  assert.deepEqual(index.pairs, ["UX-000001|IA-000001", "UX-000001|IA-000001"]);
  assert.deepEqual(
    inspectIaConsistency({
      kind: "ia_index_coverage",
      index: index,
      actualIds: new Set(["IA-000001"]),
      sourcePath: "ia.md",
    }),
    [],
  );
  const issues = inspectIaConsistency({
    kind: "ia_relations",
    index: index,
    analyses: [
      {
        ...parseIaAnalysis({ path: "analysis.md", content: "" }, "UX-000001")
          .result,
        objects: new Set(),
        objectIdentities: new Map(),
        pairs: ["UX-000001|IA-000001"],
        mappingKeys: [],
      },
    ],
    definitions: [
      {
        ...parseIaDefinition(
          { path: "definition.md", content: "" },
          "IA-000001",
        ).result,
        pairs: ["UX-000001|IA-000001"],
        mappingKeys: [],
      },
    ],
    sourcePath: "ia.md",
  });
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    ["artifact.ia.analysis-definition-closure-mismatch"],
  );
  assert.equal(
    inspectIaConsistency({
      kind: "ia_index_coverage",
      index: index,
      actualIds: new Set(),
      sourcePath: "ia.md",
    }).length,
    1,
  );
  assert.equal(
    inspectIaConsistency({
      kind: "ia_analysis_coverage",
      expectedIds: new Set(["UX-000001"]),
      actualIds: new Set(),
      sourcePath: "ia.md",
    }).length,
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
  const analysis = parseIaAnalysis(
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
  assert.equal(analysis.status, "partial");
  assert.equal(analysis.result.expectedIdentity, "UX-000001");
  assert.equal(analysis.result.disposition.length, 1);
  assert.equal(Object.hasOwn(analysis.result, "issues"), false);
  assert.deepEqual([...analysis.result.objects], ["Project"]);
  assert.equal(analysis.result.objectIdentities.get("Project"), "Project ID");
  assert.deepEqual(analysis.result.pairs, ["UX-000001|IA-000001"]);
  const definition = parseIaDefinition(
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
  );
  assert.equal(definition.issues.length, 1);
  assert.equal(definition.result.expectedIdentity, "IA-000001");
  assert.equal(definition.result.inputs.length, 1);
  assert.equal(Object.hasOwn(definition.result, "issues"), false);
  assert.deepEqual(definition.result.pairs, analysis.result.pairs);
  assert.deepEqual(definition.result.mappingKeys, analysis.result.mappingKeys);
  const index = parseIaIndex({
    path: "ia.md",
    content:
      "| [IA-000001](Definitions/IA-000001/ia_definition.md) | Project | UX-000001 |",
  }).result;
  assert.deepEqual(
    inspectIaConsistency({
      kind: "ia_relations",
      index: index,
      analyses: [analysis.result],
      definitions: [definition.result],
      sourcePath: "ia.md",
    }),
    [],
  );
  assert.deepEqual(
    inspectIaConsistency({
      kind: "ia_relations",
      index: index,
      analyses: [
        {
          ...analysis.result,
          mappingKeys: [
            ...analysis.result.mappingKeys,
            ...analysis.result.mappingKeys,
          ],
        },
      ],
      definitions: [definition.result],
      sourcePath: "ia.md",
    }).map((issue) => issue.kind),
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
    inspectIaConsistency({
      kind: "ia_projection",
      projection: parseIaObjectRelation({
        path: "cross.md",
        content: `## 4. IA定義への適用\n${link}`,
      }).result.projection,
      actualIds: ids,
    }),
    [],
  );
  for (const content of [
    link,
    `## 4. IA定義への適用\n${link}\n${link}`,
    `## 4. IA定義への適用\n${link}\n## 4. IA定義への適用\n${link}`,
  ]) {
    const issues = inspectIaConsistency({
      kind: "ia_projection",
      projection: parseIaObjectRelation({ path: "cross.md", content }).result
        .projection,
      actualIds: ids,
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.location.path, "cross.md");
  }
});

/**
 * IA定義の局所成立と外部Object・Identity照合を分離する。
 * @responsibility 併存不備を一件に統合し、Map後勝ちと対応列の閉包を維持する。
 * @trace RCM-UT-002
 * @precondition 完全な合成定義とObjectを保持する合成分析を使う。
 * @stimulus Parse後に実分析MapとのSemantic比較を行う。
 * @observation 局所状態・Issue件数・details・後勝ちと閉包を確認する。
 * @oracle 未取得Object・異なるIdentityを成立へ数えず局所診断と重複しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期モデル比較。
 */
test("IA定義は外部不成立と局所診断を一件へ統合する", () => {
  const expected = parseIaDefinition(
    { path: "definition.md", content: "" },
    "IA-000001",
    { mode: "template" },
  ).result.checklistContract.expectedItems;
  const content = [
    "成果物種別: IA定義",
    "## 意味と利用者成果",
    "## 対象・識別・関係",
    "### 分析ObjectからCanonical Objectへの対応",
    "### Identity／Relationの変換",
    "## 状態・可視性・時間的な意味",
    "## 情報の優先度・まとまり・見つけ方・責任",
    "### 責任と判断権限",
    "| 入力UX | 情報を作成・更新・提供する責任 | 意味・状態・次の行動を決める権限 |",
    "ここで示す主体は、情報契約上必要な機能責任を表し、特定の人物・組織・Componentへの割当を確定しない。",
    "## 失敗・制約・未確認事項",
    "## 検証意図",
    "| 入力UX | 重要場面 | 避ける失敗 | 品質期待 |",
    "| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |",
    "## 補足分析",
    "IA ID: `IA-000001`",
    "| 対象 | 利用者にとっての意味 | 識別・関係 |",
    "| --- | --- | --- |",
    "| Project | 対象 | Project ID |",
    "| Source Analysis Object | Canonical Object | 処置 | 判断理由 |",
    "| --- | --- | --- | --- |",
    "| UX-000001: Project | Project | Same | 同じ対象 |",
    "| Source Analysis Object | AnalysisのIdentity／Relation | Canonical Object | CanonicalのIdentity／Relation | 処置と理由 |",
    "| --- | --- | --- | --- | --- |",
    "| UX-000001: Project | Project ID | Project | Project ID | 同じ意味 |",
    "[O: Project]",
    "## 情報源",
    "[UX-000001のIA分析](../../Analysis/UX-000001/ia_analysis.md)",
    "## 後続工程との関係",
    "| UI（UX＋IAの正式入力） | 仕様 |",
    "| SPEC（UX＋IAの正式入力） | 仕様 |",
    "| Quality Analysis / IA（伴走） | 仕様 |",
    "## Checklist",
    ...expected.map((item) => `- [x] ${item}`),
  ].join("\n");
  const parsed = parseIaDefinition(
    { path: "definition.md", content },
    "IA-000001",
  );
  assert.equal(parsed.status, "complete");
  const body =
    "| 情報Object | 利用者にとっての意味 | 同一性と関係の基準 |\n| --- | --- | --- |\n| Project | 対象 | Project ID |";
  const analysis = parseIaAnalysis(
    { path: "analysis.md", content: body },
    "UX-000001",
  ).result;
  const altered = parseIaAnalysis(
    { path: "analysis.md", content: body.replace("Project ID", "別Identity") },
    "UX-000001",
  ).result;
  const good = new Map([["UX-000001", analysis]]);
  assert.deepEqual(
    inspectIaConsistency({
      kind: "ia_definition",
      definition: parsed,
      analyses: good,
    }),
    [],
  );
  for (const analyses of [
    new Map<string, typeof analysis>(),
    new Map([["UX-000001", altered]]),
    new Map([
      ["UX-000001", analysis],
      ["UX-000001", altered],
    ]),
  ]) {
    const issues = inspectIaConsistency({
      kind: "ia_definition",
      definition: parsed,
      analyses,
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.reason, "definition-contract-invalid");
    assert.deepEqual(issues[0]?.details, { checklistFailure: null });
    const local = parseIaDefinition(
      { path: "definition.md", content: content.replace("- [x]", "- [ ]") },
      "IA-000001",
    );
    assert.equal(local.issues.length, 1);
    assert.deepEqual(
      inspectIaConsistency({
        kind: "ia_definition",
        definition: local,
        analyses,
      }),
      local.issues,
    );
  }
  assert.deepEqual(
    inspectIaConsistency({
      kind: "ia_definition",
      definition: parsed,
      analyses: new Map([
        ["UX-000001", altered],
        ["UX-000001", analysis],
      ]),
    }),
    [],
  );
  assert.equal(parsed.result.mappingEvidence.length, 1);
  const index = parseIaIndex({
    path: "ia.md",
    content:
      "| [IA-000001](Definitions/IA-000001/ia_definition.md) | Project | UX-000001 |",
  }).result;
  const paired = {
    ...analysis,
    pairs: ["UX-000001|IA-000001"],
    mappingKeys: [parsed.result.mappingKeys[0] as string],
  };
  assert.deepEqual(
    inspectIaConsistency({
      kind: "ia_relations",
      index,
      analyses: [paired],
      definitions: [parsed.result],
      sourcePath: "ia.md",
    }),
    [],
  );
  assert.deepEqual(
    inspectIaConsistency({
      kind: "ia_relations",
      index,
      analyses: [{ ...paired, objects: new Set<string>() }],
      definitions: [parsed.result],
      sourcePath: "ia.md",
    }).map((i) => i.reason),
    ["object-mapping-closure-mismatch"],
  );
});

/**
 * 文書別Parseを共通Checklist反証へ接続する。
 * @responsibility 不変の観点だけを共有し、各呼出しの内容・期待列・状態を独立させる。
 * @trace RCM-UT-002
 * @precondition 固定種別・方式と合成本文。
 * @stimulus 対応する公開Parserを一回呼ぶ。
 * @observation その受付の完成モデルを返す。
 * @oracle 本番に部分受付を復活させず、七／六種類の旧反証を保持する。
 * @cleanup N/A: 同期値処理。
 * @boundary RCM-UT-002=N/A: 同一Process内のParse。
 */
function parseDocumentFixture(
  source: import("../../../src/index.ts").ArtifactSource,
  request: import("../../../src/ia/types.ts").IaChecklistRequest,
) {
  switch (request.kind) {
    case "index":
      return parseIaIndex(source, { mode: request.mode }).result;
    case "object_relation":
      return parseIaObjectRelation(source, { mode: request.mode }).result;
    case "structure_navigation":
      return parseIaStructureNavigation(source, { mode: request.mode }).result;
    case "state_visibility":
      return parseIaStateVisibility(source, { mode: request.mode }).result;
    case "analysis":
      return parseIaAnalysis(source, "UX-XXXXXX", { mode: request.mode })
        .result;
    case "definition":
      return parseIaDefinition(source, "IA-XXXXXX", { mode: request.mode })
        .result;
  }
}

/**
 * 未対応のIA整合種別を正常へ読み替えない。
 * @trace RCM-UT-002
 * @precondition 未定義のkindを用意する。
 * @stimulus 完成した整合比較へ渡す。
 * @observation 拒否理由を確認する。
 * @oracle 固有の例外で拒否する。
 * @cleanup N/A: 同期的な値検査。
 */
test("未対応のIA整合種別は拒否する", () => {
  assert.throws(
    () => inspectIaConsistency({ kind: "unknown" } as never),
    /ia_consistency_kind_invalid/u,
  );
});
