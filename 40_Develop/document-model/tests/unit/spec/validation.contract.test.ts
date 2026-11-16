/**
 * SPEC分析・登録表・定義の本文モデルを検証する。
 * @packageDocumentation
 * @responsibility 不正本文の部分関係・出現重複・Issue順と観点別条件を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、spec
 * @boundary RCM-UT-002=N/A: 合成本文の同期解析。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../src/artifact/checklist.ts";
import {
  inspectSpecConsistency,
  parseSpecBehavior,
  parseSpecDetailCorrespondence,
} from "../../../src/index.ts";
import { specChecklistItems } from "../../../src/spec/validation.ts";

/**
 * SPEC文書の内容と7種類のChecklist受付を検証する。
 * @responsibility 種別・方式・出典・部分本文と旧構文の失敗理由を保持する。
 * @trace RCM-UT-002
 * @precondition 7種類・両方式と正常／異常の合成本文。
 * @stimulus 原文と明示した条件を文書受付へ渡す。
 * @observation 原文・表・Checklist節・期待列・失敗理由を取得する。
 * @oracle 旧構文検査と一致し、期待列と原文を別受付と共有しない。
 * @cleanup N/A: 同期的な局所値のみ。
 * @boundary 原文からSPEC内容モデルとChecklist条件。
 */
test("SPEC7種類のChecklistは内容・出典と検査結果を保持する", () => {
  for (const kind of [
    "analysis_ux",
    "analysis_ia",
    "definition",
    "detail_index",
    "behavior",
    "detail_correspondence",
    "correspondence",
  ] as const) {
    for (const mode of ["template", "evaluated"] as const) {
      const request = { kind, mode };
      const first = parseSpecChecklistFixture(
        { path: "spec.md", content: "" },
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
        const parsed = parseSpecChecklistFixture(
          { path: "spec.md", content },
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
      const source = { path: "spec.md", content: body };
      const valid = parseSpecChecklistFixture(source, request);
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
        parseSpecChecklistFixture(
          { path: "spec.md", content: body },
          request,
        ).checklistContract.expectedItems.includes("only-first"),
        false,
      );
    }
  }
  assert.throws(
    () => specChecklistItems("unknown" as never),
    /unknown_spec_checklist_kind/u,
  );
  assert.throws(
    () =>
      parseSpecBehavior(
        { path: "invalid.md", content: "" },
        { mode: "unknown" as never },
      ),
    /unknown_spec_checklist_mode/u,
  );
});

/**
 * SPEC台帳の件数宣言を数値へ補完せず保持する。
 * @responsibility 最初のHeaderと直後Separator・連続行の旧境界を維持する。
 * @trace RCM-UT-002
 * @precondition 不正列数で途切れる件数表と、後続の別件数表を与える。
 * @stimulus SPEC台帳を構築する。
 * @observation 名前・対応・件数文字列・出典と全表行を取得する。
 * @oracle 最初の表の連続有効行だけを採り、数値不明を0へ変えない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な台帳モデル構築。
 */
test("SPEC台帳モデルは件数表の先頭と途中終了を保持する", () => {
  const header = "| 入力／成果 | 件数 | 現在の処置 |\n|---|---|---|";
  const row =
    "| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | 意味を保存 | UX-000001 | IA-000001 | UI-000001 |";
  const content = `${row}\n${header}\n| UX | unknown | 確認待ち |\n| short | row |\n| IA | 9 | 対象外 |\n${header}\n| UI | 8 | 後続表 |`;
  const parsed = parseSpecIndex({ path: "spec.md", content });
  assert.equal(parsed.status, "complete");
  assert.equal(parsed.result.entries[0]?.name, "意味を保存");
  assert.deepEqual(parsed.result.entries[0]?.uiIds, ["UI-000001"]);
  assert.equal(parsed.result.counts.length, 1);
  assert.equal(parsed.result.counts[0]?.count, "unknown");
  assert.equal(parsed.result.counts[0]?.location.line, 4);
  assert.equal(parsed.result.tableRows.length, 9);
  const noSeparator = parseSpecIndex({
    path: "a.md",
    content:
      "| 入力／成果 | 件数 | 現在の処置 |\nnot a separator\n| UX | 1 | current |",
  });
  assert.deepEqual(noSeparator.result.counts, []);
});

/**
 * SPEC Detailの不正な後続行で既知BHVを消さない。
 * @responsibility 行不正のcombined Issueと、抽出成立した対応の保持を分離する。
 * @trace RCM-UT-002
 * @precondition 複数BHV、後続BHV欠測、列数不足を持つ同一SPEC行。
 * @stimulus 台帳構築後に被覆検査する。
 * @observation 全entries・理由・出典・対応Map・診断を確認する。
 * @oracle 各cellの最初のBHVを採用し、欠測行では前値を保持する。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な台帳モデルと集合検査。
 */
test("SPEC Detailモデルは短い不正行でも抽出済み対応を保持する", () => {
  const content =
    "状態: Canonical\r\n| SPEC-000001 | 意味 | Applicable／Covered | BHV-000001 BHV-000002 | 理由 |\r\n| SPEC-000001 | later | wrong | BHV-000003 |\r\n| SPEC-000001 | missing | x | none |\r\n| SPEC-000001 |";
  const model = parseSpecDetailIndex({ path: "detail.md", content });
  assert.equal(model.result.entries[0]?.behaviorId, "BHV-000001");
  assert.equal(model.result.entries[0]?.reason, "理由");
  assert.equal(model.result.entries[1]?.reason, null);
  assert.equal(model.result.entries[3]?.location.line, 5);
  assert.deepEqual(
    [...model.result.behaviors],
    [["SPEC-000001", "BHV-000003"]],
  );
  assert.equal(
    inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail: model,
      actualIds: new Set(["SPEC-000001"]),
    }).length,
    1,
  );
  const empty = parseSpecDetailIndex({
    path: "a.md",
    content: "文中 状態: Canonical",
  });
  assert.deepEqual(
    inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail: empty,
      actualIds: new Set(),
    }),
    [],
  );
});

/**
 * SPECの両観点を意味のある内容と原文へ構築する。
 * @responsibility UXの成果・受入とIAの意味・責任を区別し、旧Path文字列の受理を維持する。
 * @trace RCM-UT-002
 * @precondition 正式入力をMarkdown Linkでなく期待Path文字列で記載する。
 * @stimulus 完成Parserを通し、処置の重複も与える。
 * @observation モデル内容、参照、出典、Issueを確認する。
 * @oracle 通常入力を受理し、重複は関係を消さず局所で拒否する。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同一Processの文書構築。
 */
test("SPEC分析モデルは両観点と旧Path受理を保持する", () => {
  for (const view of ["ux", "ia"] as const) {
    const id = view === "ux" ? "UX-000001" : "IA-000001";
    const headings =
      view === "ux"
        ? [
            "2. 振る舞いへ引き継ぐ利用者成果",
            "3. 観測可能にする契機・結果・失敗",
            "4. 受入条件と適用範囲",
            "5. SPEC処置",
            "6. IA観点との統合時に確認すること",
          ]
        : [
            "2. 利用場面ごとに保持する意味",
            "3. 対象・識別・関係",
            "4. 状態・可視性・時間的意味",
            "5. 導線・責任・失敗時の保持",
            "6. SPEC処置",
            "7. UX観点との統合時に確認すること",
          ];
    const link =
      "[SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md)";
    const content = [
      `成果物種別: SPEC分析（${view === "ux" ? "UX" : "IA"}観点）`,
      `分析単位: \`${id}\``,
      "## 1. 正式入力",
      `../../../${view === "ux" ? "02_UX" : "03_IA"}/Definitions/${id}/${view}_definition.md`,
      ...headings.flatMap((heading) => [
        `## ${heading}`,
        heading.includes("SPEC処置")
          ? link
          : "| 判断 | 内容 |\n|---|---|\n| 不明 | 人間へ戻す |",
      ]),
      "## 検証意図",
      "```text",
      "[不明] → [確認]",
      "```",
      "## Checklist",
      ...(view === "ux"
        ? parseSpecAnalysis(
            { path: "fixture.md", content: "## Checklist" },
            "UX-XXXXXX",
            { mode: "evaluated" },
          ).result.checklistContract.expectedItems
        : parseSpecAnalysis(
            { path: "fixture.md", content: "## Checklist" },
            "IA-XXXXXX",
            { mode: "evaluated" },
          ).result.checklistContract.expectedItems
      ).map((item) => `- [x] ${item}`),
    ].join("\n");
    const parsed = parseSpecAnalysis({ path: `${id}.md`, content }, id);
    assert.equal(parsed.status, "complete");
    assert.ok(parsed.result);
    const model = parsed.result;
    assert.equal(model.source.content, content);
    assert.equal(model.view, view);
    assert.deepEqual(
      model.targets.map(({ identity }) => identity),
      ["SPEC-000001"],
    );
    if (model.view === "ux")
      assert.deepEqual(model.acceptance[0]?.tableRows[2]?.cells, [
        "不明",
        "人間へ戻す",
      ]);
    else
      assert.match(
        model.responsibilitiesAndFailure[0]?.body.text ?? "",
        /人間へ戻す/u,
      );
    const duplicate = parseSpecAnalysis(
      {
        path: model.source.path,
        content: content.replace(link, `${link} ${link}`),
      },
      id,
    );
    assert.equal(duplicate.status, "partial");
    assert.equal(duplicate.result?.targets.length, 2);
    assert.equal(
      duplicate.issues[0]?.kind,
      `artifact.spec.${view}-analysis-contract-invalid`,
    );
  }
});

/**
 * 正式入力と処置の異なる節終端契約を維持する。
 * @responsibility EOFの入力本文を失わず、局所検査への採用条件だけを区別する。
 * @trace RCM-UT-002
 * @precondition EOFで終わる正式入力、EOFで終わる処置を用意する。
 * @stimulus 公開Parserで解析する。
 * @observation 原文節、終端種別とtargetsを確認する。
 * @oracle 正式入力本文は保持し、処置はEOFでも参照を取得する。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同一Processの文書構築。
 */
test("SPEC分析は正式入力の次H2必須と処置のEOF許可を区別する", () => {
  const input = parseSpecAnalysis(
    {
      path: "a.md",
      content:
        "## 1. 正式入力\n../../../02_UX/Definitions/UX-000001/ux_definition.md",
    },
    "UX-000001",
  );
  assert.equal(input.result?.formalInputs[0]?.boundary, "end_of_document");
  assert.match(input.result?.formalInputs[0]?.body.text ?? "", /UX-000001/u);
  assert.equal(
    input.issues[0]?.kind,
    "artifact.spec.ux-analysis-contract-invalid",
  );
  const disposition = parseSpecAnalysis(
    {
      path: "a.md",
      content:
        "## 5. SPEC処置\n[SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md)",
    },
    "UX-000001",
  );
  assert.equal(
    disposition.result?.dispositions[0]?.boundary,
    "end_of_document",
  );
  assert.deepEqual(
    disposition.result?.targets.map(({ identity }) => identity),
    ["SPEC-000001"],
  );
});

/**
 * 条件、振る舞い、回復、受入条件を原文と位置で保持する。
 * @responsibility 自由記述を状態機械へ推定せず、重複と欠測を保持する。
 * @trace RCM-UT-002
 * @precondition 条件表、重複節、Not Applicableと未確認事項を持つ定義。
 * @stimulus 完成Parserでモデルを取得する。
 * @observation 名前付き節、表行、対応処置、位置を確認する。
 * @oracle 最初の対応処置を維持し、後続節も原文として残す。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同一Processの純粋なモデル構築。
 */
test("SPEC定義モデルは条件と受入内容を位置付きで保持する", () => {
  const parsed = parseSpecDefinition(
    {
      path: "spec.md",
      content: [
        "SPEC ID: `SPEC-999999`",
        "## 振る舞いの目的",
        "変更を保存する",
        "## 契機・事前条件・Authority",
        "| 契機 | 事前条件 | Authority |",
        "|---|---|---|",
        "| 保存要求 | 編集済み | 利用者判断 |",
        "## 振る舞い・状態・結果",
        "未観測なら結果不明",
        "## 失敗・回復・副作用",
        "再実行は人間が判断する",
        "## 受入条件と検証義務",
        "| 条件 | 結果 |",
        "|---|---|",
        "| 保存失敗 | 成功を表示しない |",
        "## 対応するUI",
        "- pairs_with: Not Applicable",
        "- 理由: CLIのみ",
        "- 運用Feedback: 状態表示",
        "- 人間確認: 未確認",
        "## 対応するUI",
        "- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)",
        "## 未確認事項・人間判断・戻り条件",
        "取消時の条件は未確定",
        "## 検証意図",
        "結果不明を成功にしない",
      ].join("\n"),
    },
    "SPEC-000001",
  );
  assert.equal(parsed.status, "partial");
  assert.ok(parsed.result);
  const model = parsed.result;
  assert.equal(model.expectedIdentity, "SPEC-000001");
  assert.equal(model.conditions[0]?.body.location.line, 4);
  assert.equal(model.conditions[0]?.body.text.startsWith("\n"), true);
  assert.deepEqual(model.conditions[0]?.tableRows[2]?.cells, [
    "保存要求",
    "編集済み",
    "利用者判断",
  ]);
  assert.equal(model.conditions[0]?.tableRows[2]?.location.line, 7);
  assert.match(model.behavior[0]?.body.text ?? "", /結果不明/u);
  assert.match(model.recovery[0]?.body.text ?? "", /人間/u);
  assert.equal(model.interfaces.length, 2);
  assert.equal(model.interfaceDisposition?.text, "Not Applicable");
  assert.deepEqual(model.pairedInterfaces, []);
  assert.match(model.unresolved[0]?.body.text ?? "", /未確定/u);
  assert.deepEqual(model.constraints, []);
});

import {
  parseSpecAnalysis,
  parseSpecDefinition,
  parseSpecDefinitionCorrespondence,
  parseSpecDetailIndex,
  parseSpecIndex,
} from "../../../src/index.ts";

/**
 * Detailの表解析が後勝ち・最初の一致・重複出現を維持するか確認する。
 * @responsibility UI・BHV・Screen・対応表の部分関係を検証する。
 * @trace RCM-UT-002
 * @precondition 有効行・不正行・重複行を含む合成本文を用意する。
 * @stimulus 各Detail解析APIを呼ぶ。
 * @observation 対応Map・関係列・Issueを取得する。
 * @oracle 後勝ちMapと出現順を保持し、不正本文の抽出可能な関係を失わない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文解析。
 */
test("SPEC Detail解析は部分関係と後勝ちMap・出現重複を保持する", () => {
  const row = "| SPEC-000001 | a | Applicable／Covered | BHV-000001 | reason |";
  const valid = parseSpecDetailIndex({
    path: "detail.md",
    content: `状態: Canonical\n${row}`,
  });
  assert.equal(
    inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail: valid,
      actualIds: new Set(["SPEC-000001"]),
    }).length,
    0,
  );
  const invalid = parseSpecDetailIndex({
    path: "detail.md",
    content: `${row}\n${row.replace("BHV-000001", "BHV-000002")}`,
  });
  assert.deepEqual(
    [...invalid.result.behaviors],
    [["SPEC-000001", "BHV-000002"]],
  );
  assert.equal(
    inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail: invalid,
      actualIds: new Set(["SPEC-000001"]),
    })[0]?.kind,
    "artifact.spec.detail-current-coverage-invalid",
  );
});

/**
 * 観点別の分析診断と不正本文の関係保持を確認する。
 * @responsibility 重複関係の出現列をSetへ畳まず後続へ渡す。
 * @trace RCM-UT-002
 * @precondition 構造不足だがSPEC処置関係を持つ合成本文を用意する。
 * @stimulus UX／IA分析を検査する。
 * @observation Issue順と関係出現列を取得する。
 * @oracle 観点別構造→Checklistの順で返し、重複関係を二件保持する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("SPEC分析は観点別Issueと不正本文の重複関係を保持する", () => {
  for (const identity of ["UX-000001", "IA-000001"]) {
    const row =
      "[SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md)";
    const content = `## ${identity.startsWith("UX") ? "5" : "6"}. SPEC処置\n${row}\n${row}\n## Next`;
    const model = parseSpecAnalysis({ path: "analysis.md", content }, identity);
    assert.equal(model.status, "partial");
    assert.ok(model.result);
    assert.deepEqual(
      model.result.targets.map(
        (ref) => `${model.result?.expectedIdentity}|${ref.identity}`,
      ),
      [`${identity}|SPEC-000001`, `${identity}|SPEC-000001`],
    );
    assert.deepEqual(
      model.issues.map((issue) => issue.kind),
      [
        `artifact.spec.${identity.startsWith("UX") ? "ux" : "ia"}-analysis-contract-invalid`,
        "artifact.spec.analysis-checklist-invalid",
      ],
    );
    assert.equal(
      model.issues[1]?.details.checklistFailure,
      "missing_or_duplicate",
    );
  }
});

/**
 * 分析と定義の網羅性・重複診断の順を確認する。
 * @responsibility 不足IDと関係重複を独立に検査し、空集合一致を新たに拒否しない。
 * @trace RCM-UT-002
 * @precondition 空集合と不足・重複のある入力を用意する。
 * @stimulus 観測境界ごとの網羅性検査を実行する。
 * @observation 順序付きIssueを取得する。
 * @oracle 分析はUX→重複→IA、定義は重複→登録網羅性で返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な集合検査。
 */
test("SPEC網羅性は観測境界ごとのIssue順と空集合条件を維持する", () => {
  const empty = new Set<string>();
  assert.deepEqual(
    inspectSpecConsistency({
      kind: "spec_analysis_coverage",
      ...{
        specIndexPath: "spec.md",
        specAnalysisRoot: "analysis",
        uxIds: empty,
        iaIds: empty,
        analyzedUx: empty,
        analyzedIa: empty,
        analysisRelationOccurrences: [],
      },
    }),
    [],
  );
  const analysis = inspectSpecConsistency({
    kind: "spec_analysis_coverage",
    ...{
      specIndexPath: "spec.md",
      specAnalysisRoot: "analysis",
      uxIds: new Set(["UX-000001"]),
      iaIds: new Set(["IA-000001"]),
      analyzedUx: empty,
      analyzedIa: empty,
      analysisRelationOccurrences: ["a", "a"],
    },
  });
  assert.deepEqual(
    analysis.map((issue) => issue.kind),
    [
      "artifact.spec.ux-analysis-coverage-mismatch",
      "artifact.spec.analysis-relation-duplicate",
      "artifact.spec.ia-analysis-coverage-mismatch",
    ],
  );
  const definitionEntries = inspectSpecConsistency({
    kind: "spec_definition_coverage",
    ...{
      specDefinitionsRoot: "definitions",
      specIndexPath: "spec.md",
      definitionRelationOccurrences: ["a", "a"],
      definitionUiPairOccurrences: [],
      registryIds: new Set(["SPEC-000001"]),
      actualIds: empty,
    },
  });
  assert.deepEqual(
    definitionEntries.map((issue) => issue.kind),
    [
      "artifact.spec.definition-relation-duplicate",
      "artifact.spec.definition-index-coverage-mismatch",
    ],
  );
});

/**
 * 件数と三者関係閉包を確認する。
 * @responsibility 件数の整数解析と同数の誤差し替えを検出する。
 * @trace RCM-UT-002
 * @precondition 一致する件数と関係集合を用意する。
 * @stimulus 件数と集合を変えて検査する。
 * @observation Issue順を取得する。
 * @oracle 正常を受理し、件数不一致→閉包不一致の順で返す。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期的な集合検査。
 */
test("SPEC件数と三者閉包は同数の誤差し替えを拒否する", () => {
  const relations = new Set(["UX-000001|SPEC-000001"]);
  const request = {
    specIndexPath: "spec.md",
    indexCountRows: [["UX定義", "1", "current"]],
    expectedIndexCounts: new Map([["UX定義", 1]]),
    registryRelations: relations,
    analysisRelations: relations,
    definitionRelations: relations,
  };
  assert.deepEqual(
    inspectSpecConsistency({ kind: "spec_coverage", ...request }),
    [],
  );
  assert.deepEqual(
    inspectSpecConsistency({
      kind: "spec_coverage",
      ...{
        ...request,
        indexCountRows: [["UX定義", "0", "current"]],
        definitionRelations: new Set(["UX-000002|SPEC-000001"]),
      },
    }).map((issue) => issue.kind),
    [
      "artifact.spec.root-coverage-count-mismatch",
      "artifact.spec.analysis-definition-closure-mismatch",
    ],
  );
});

/**
 * 登録表の重複と件数表を解析する。
 * @responsibility 集合化後も行重複をIssueとして保持する。
 * @trace RCM-UT-002
 * @precondition 同じ登録行二件と三列件数表を用意する。
 * @stimulus 登録表を解析する。
 * @observation 集合・件数表・Issueを取得する。
 * @oracle IDと関係をSet化し、重複を消さず一Issueで返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期解析。
 */
test("SPEC登録表は重複違反と件数表を保持する", () => {
  const row =
    "| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | name | UX-000001 | IA-000001 | UI-000001 |";
  const content = `${row}\n${row}\n| 入力／成果 | 件数 | 現在の処置 |\n| --- | --- | --- |\n| UX | 1 | current |`;
  const model = parseSpecIndex({ path: "spec.md", content });
  assert.deepEqual(
    [...new Set(model.result.entries.map((entry) => entry.identity))],
    ["SPEC-000001"],
  );
  assert.deepEqual(
    [
      ...new Set(
        model.result.entries.flatMap((entry) =>
          [...entry.uxIds, ...entry.iaIds].map(
            (id) => `${id}|${entry.identity}`,
          ),
        ),
      ),
    ],
    ["UX-000001|SPEC-000001", "IA-000001|SPEC-000001"],
  );
  assert.deepEqual(
    [
      ...new Set(
        model.result.entries.flatMap((entry) =>
          entry.uiIds.map((id) => `${id}|${entry.identity}`),
        ),
      ),
    ],
    ["UI-000001|SPEC-000001"],
  );
  assert.deepEqual(
    model.result.counts.map((entry) => entry.cells),
    [["UX", "1", "current"]],
  );
  assert.deepEqual(
    model.issues.map((issue) => issue.kind),
    ["artifact.spec.registry-relation-duplicate"],
  );
});

/**
 * 不正定義でもUX／IA・UI関係を保持する。
 * @responsibility 本文構造とChecklistを独立に検査し部分結果を後続へ返す。
 * @trace RCM-UT-002
 * @precondition 必須構造が不足する関係付き定義を用意する。
 * @stimulus SPEC定義を検査する。
 * @observation 出現列とIssue順を取得する。
 * @oracle 各関係を保持し、構造→Checklistの順で返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("SPEC定義は本文不正でも解析済み関係を保持する", () => {
  const content =
    "## UX観点の分析結果\n[UX-000001](../../Analysis/UX-000001/spec_analysis.md)\n## IA観点の分析結果\n[IA-000001](../../Analysis/IA-000001/spec_analysis.md)\n## 対応するUI\n- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)\n## Next";
  const model = parseSpecDefinition(
    { path: "definition.md", content },
    "SPEC-000001",
  );
  assert.equal(model.status, "partial");
  assert.ok(model.result);
  assert.deepEqual(
    model.result.analysisInputs.map(
      (ref) => `${ref.identity}|${model.result?.expectedIdentity}`,
    ),
    ["UX-000001|SPEC-000001", "IA-000001|SPEC-000001"],
  );
  assert.deepEqual(
    model.result.pairedInterfaces.map(
      (ref) => `${ref.identity}|${model.result?.expectedIdentity}`,
    ),
    ["UI-000001|SPEC-000001"],
  );
  assert.deepEqual(
    model.issues.map((issue) => issue.kind),
    [
      "artifact.spec.definition-contract-invalid",
      "artifact.spec.definition-checklist-invalid",
    ],
  );
});

/**
 * 定義対応の解析が原文・正規行・改訂と根拠の出典を保持するか確認する。
 * @responsibility 一般表へ受理を広げず、短Cellも比較まで保持する。
 * @trace RCM-UT-002
 * @precondition 正規行、短行、改訂表、重複根拠節を含む合成文書。
 * @stimulus 完成した対応モデル構築を呼ぶ。
 * @observation 原文・行位置・改訂・先頭根拠表を取得する。
 * @oracle 先頭Header／Separator／連続幅とH2境界を維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 同期モデル構築。
 */

test("SPEC定義対応モデルは正規行・改訂・根拠出典を保持する", () => {
  const row =
    "| [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | UX-000001 | Shared | 8観点 | 作成者確認済み | なし | Evidence |";
  const hash = "a".repeat(64);
  const revision = `| 項目 | 対象 |\n|---|---|\n| 対象改訂版 | UI／SPEC Definition集合 SHA-256: ${hash} |`;
  const evidence =
    "### UI-000001／SPEC-000001\n| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |\n|---|---|---|---|---|\n| State | UI側 | SPEC側 | 一致 | first |\n| short | row |\n| Trigger | 後続 | 後続 | 一致 | ignored |";
  const content = `${revision}\n${row}\n${evidence}`;
  const source = { path: "correspondence.md", content };
  const model = parseSpecDefinitionCorrespondence(source).result;
  assert.equal(model.recordedFingerprint, hash);
  assert.equal(model.pairs.length, 1);
  assert.equal(model.pairs[0]?.location.line, 4);
  assert.equal(model.pairs[0]?.evidenceRows.length, 1);
  assert.equal(model.pairs[0]?.evidenceRows[0]?.location.line, 8);
  assert.equal(model.pairs[0]?.evidenceRows[0]?.cells[4], "first");
  source.content = "changed";
  assert.equal(model.source.content, content);
  assert.equal(
    parseSpecDefinitionCorrespondence({
      path: "x",
      content: row.replace("../04_UI/", "04_UI/"),
    }).result.pairs.length,
    0,
  );
  assert.equal(
    parseSpecDefinitionCorrespondence({
      path: "x",
      content: revision.replace(hash, hash.toUpperCase()),
    }).result.recordedFingerprint,
    undefined,
  );
  const short = `${row.split(" | ").slice(0, 2).join(" | ")} |`;
  assert.equal(
    parseSpecDefinitionCorrespondence({ path: "x", content: short }).result
      .pairs.length,
    1,
  );
  const repeated = parseSpecDefinitionCorrespondence({
    path: "x",
    content: `${row}\n${evidence}\n${evidence.replace("first", "later")}`,
  }).result;
  assert.equal(repeated.pairs[0]?.evidenceRows[0]?.cells[4], "first");
});

/** 既存Checklist行列を完成Parserへ接続する試験専用選択。@trace RCM-UT-002 */
function parseSpecChecklistFixture(
  source: { path: string; content: string },
  request: { kind: string; mode: string },
) {
  const options = { mode: request.mode as "template" | "evaluated" };
  switch (request.kind) {
    case "analysis_ux":
      return parseSpecAnalysis(source, "UX-XXXXXX", options).result;
    case "analysis_ia":
      return parseSpecAnalysis(source, "IA-XXXXXX", options).result;
    case "definition":
      return parseSpecDefinition(source, "SPEC-XXXXXX", options).result;
    case "detail_index":
      return parseSpecDetailIndex(source, options).result;
    case "behavior":
      return parseSpecBehavior(source, options).result;
    case "detail_correspondence":
      return parseSpecDetailCorrespondence(source, options).result;
    case "correspondence":
      return parseSpecDefinitionCorrespondence(source, options).result;
    default:
      throw Error("unknown_spec_checklist_kind");
  }
}

/**
 * BHVの部分内容とDetail局所／横断診断の境界を確認する。
 * @responsibility 本文を捨てず、被覆比較の診断数と元の順序を維持する。
 * @trace RCM-UT-002
 * @precondition Checklist欠測のBHVと局所成立／不成立のDetail台帳を用意する。
 * @stimulus 完成ParseとSemanticの被覆比較を呼ぶ。
 * @observation 節・原文・局所Issue・combined診断を読む。
 * @oracle 局所と被覆の併存は一件であり、Checklistだけの不備は被覆へ追加しない。
 * @cleanup N/A: 局所値だけを扱う。
 */
test("SPECの完成ParseはBHV内容を保持し被覆診断を重複させない", () => {
  const source = {
    path: "behavior.md",
    content: "## 2. Detailed Behavior\n取得した振る舞い\n| A | B |",
  };
  const parsed = parseSpecBehavior(source);
  assert.equal(parsed.status, "partial");
  assert.equal(
    parsed.result.sections[0]?.heading.text,
    "## 2. Detailed Behavior",
  );
  assert.equal(parsed.result.tableRows.length, 1);
  assert.equal(parsed.issues.length, 1);
  source.content = "changed";
  assert.notEqual(parsed.result.source.content, source.content);
  const detailSource = {
    path: "detail.md",
    content:
      "状態: Canonical\n| SPEC-000001 | name | Applicable／Covered | BHV-000001 | reason |",
  };
  const detail = parseSpecDetailIndex(detailSource);
  assert.ok(detail.issues.length);
  assert.deepEqual(
    inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail,
      actualIds: new Set(["SPEC-000001"]),
    }),
    [],
  );
  assert.equal(
    inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail,
      actualIds: new Set(["SPEC-000002"]),
    }).length,
    1,
  );
  const invalid = parseSpecDetailIndex({
    ...detailSource,
    content: detailSource.content.replace("BHV-000001", ""),
  });
  assert.ok(
    invalid.issues.some(
      (issue) => issue.kind === "artifact.spec.detail-current-coverage-invalid",
    ),
  );
  assert.equal(
    inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail: invalid,
      actualIds: new Set(["SPEC-000002"]),
    }).length,
    1,
  );
});

/**
 * 未対応のSPEC整合種別を正常へ読み替えない。
 * @trace RCM-UT-002
 * @precondition 契約に存在しないkindを用意する。
 * @stimulus 完成した整合比較へ渡す。
 * @observation 例外の拒否理由を読む。
 * @oracle 未対応kindは固有の理由で拒否する。
 * @cleanup N/A: 同期的な値検査。
 */
test("未対応のSPEC整合種別は拒否する", () => {
  assert.throws(
    () => inspectSpecConsistency({ kind: "unknown" } as never),
    /spec_consistency_kind_invalid/u,
  );
});
