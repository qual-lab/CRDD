/**
 * UI本文の抽出と関係の不変条件を検証する。
 * @packageDocumentation
 * @responsibility 行別Issue、両観点、不正本文の関係保持、Detail集合境界を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、ui、relations
 * @boundary RCM-UT-002=N/A: 合成本文の純粋な同期検査。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../src/artifact/checklist.ts";
import {
  inspectDocumentRelations,
  parseUiArea,
  parseUiComponent,
  parseUiHandoff,
  parseUiVisualBaseline,
} from "../../../src/index.ts";
import { uiChecklistItems } from "../../../src/ui/validation.ts";

/**
 * UI文書の内容と9種類のChecklist受付を検証する。
 * @responsibility 種別・方式・出典・部分本文と旧構文の失敗理由を保持する。
 * @trace RCM-UT-002
 * @precondition 9種類・両方式と正常／異常の合成本文。
 * @stimulus 原文と明示した条件を文書受付へ渡す。
 * @observation 原文・表・Checklist節・期待列・失敗理由を取得する。
 * @oracle 旧構文検査と一致し、期待列と原文を別受付と共有しない。
 * @cleanup N/A: 同期的な局所値のみ。
 * @boundary 原文からUI内容モデルとChecklist条件。
 */
test("UI9種類のChecklistは内容・出典と検査結果を保持する", () => {
  for (const kind of [
    "analysis_ux",
    "analysis_ia",
    "definition",
    "detail_index",
    "area",
    "screen",
    "component",
    "visual_baseline",
    "handoff",
  ] as const) {
    for (const mode of ["template", "evaluated"] as const) {
      const request = { kind, mode };
      const first = parseUiChecklistFixture(
        { path: "ui.md", content: "" },
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
        const parsed = parseUiChecklistFixture(
          { path: "ui.md", content },
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
      const source = { path: "ui.md", content: body };
      const valid = parseUiChecklistFixture(source, request);
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
        parseUiChecklistFixture(
          { path: "ui.md", content: body },
          request,
        ).checklistContract.expectedItems.includes("only-first"),
        false,
      );
    }
  }
  assert.throws(
    () => uiChecklistItems("unknown" as never),
    /unknown_ui_checklist_kind/u,
  );
  assert.throws(
    () =>
      parseUiArea(
        { path: "invalid.md", content: "" },
        { mode: "unknown" as never },
      ),
    /unknown_ui_checklist_mode/u,
  );
});

/**
 * UI Detailの抽出成立行だけを後勝ちで採用する。
 * @responsibility 旧Spec側の純粋UI抽出試験をUIへ移し、不正行による前値消失も反証する。
 * @trace RCM-UT-002
 * @precondition 有効行、同UIの後続有効行、片方欠測行と短い行を与える。
 * @stimulus 完成したDetail台帳Parserを呼ぶ。
 * @observation 全entries、名前付き値、位置、対応Mapと被覆Issueを取得する。
 * @oracle 最後の抽出成立行だけを採用し、行不正でも既知対応は失わない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な台帳モデル構築。
 */
test("UI Detailモデルは出典と最後の抽出成立行を保持する", () => {
  const bindingRow = "| UI-000001 | a | b | c | SCR-000001 PRT-000001 |";
  const content = `${bindingRow}\r\n${bindingRow.replaceAll("000001", "000002").replace("UI-000002", "UI-000001")}\r\n| UI-000001 | missing | b | c | SCR-000003 |\r\n| UI-000001 |`;
  const model = parseUiDetailIndex({ path: "ui-detail.md", content });
  assert.deepEqual(
    [...model.result.bindings],
    [["UI-000001", { scr: "SCR-000002", prt: "PRT-000002" }]],
  );
  assert.equal(
    parseUiDetailIndex({
      path: "ui-detail.md",
      content: `<!-- ${bindingRow} -->`,
    }).result.bindings.size,
    0,
  );
  assert.equal(model.result.entries.length, 4);
  assert.equal(model.result.entries[1]?.location.line, 2);
  assert.equal(model.result.entries[2]?.partId, null);
  assert.equal(model.result.entries[3]?.reason, null);
  assert.equal(model.result.source.content, content);
  assert.equal(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail: model,
      actualIds: new Set(["UI-000001"]),
    }).length,
    1,
  );
  const firstIds = parseUiDetailIndex({
    path: "a.md",
    content:
      "状態: Canonical\n| UI-000001 | name | Applicable／Covered | Area | SCR-000001 SCR-000002 PRT-000001 PRT-000002 | reason |",
  });
  assert.deepEqual(
    [...firstIds.result.bindings],
    [["UI-000001", { scr: "SCR-000001", prt: "PRT-000001" }]],
  );
  assert.deepEqual(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail: firstIds,
      actualIds: new Set(["UI-000001"]),
    }),
    [],
  );
});

/**
 * 登録認識の厳密な空白条件と、全表行の保存を区別する。
 * @responsibility 未認識行を登録へ追加せず、認識行の内容・重複・出典を保持する。
 * @trace RCM-UT-002
 * @precondition 旧構文に合う行、余分な先頭空白、入力欠測行を用意する。
 * @stimulus UI台帳を構築する。
 * @observation 名前、入力、原文、全表行と局所診断を取得する。
 * @oracle 厳密構文の二行だけがentriesとなり、不正行を部分結果に残す。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な台帳モデル構築。
 */
test("UI台帳モデルは登録行の内容と未認識行を区別する", () => {
  const row =
    "| [UI-000001](Definitions/UI-000001/ui_definition.md) | 利用者の判断 | UX-000001 | IA-000001 |";
  const content = `${row}\n ${row}\n${row.replace("UX-000001", "—")}`;
  const parsed = parseUiIndex({ path: "ui.md", content });
  assert.equal(parsed.status, "partial");
  assert.equal(parsed.result.entries.length, 2);
  assert.equal(parsed.result.tableRows.length, 3);
  assert.equal(parsed.result.entries[0]?.name, "利用者の判断");
  assert.equal(
    parsed.result.entries[0]?.definitionTarget,
    "Definitions/UI-000001/ui_definition.md",
  );
  assert.equal(parsed.result.entries[1]?.location.line, 3);
  assert.deepEqual(parsed.result.entries[1]?.uxIds, []);
  assert.equal(parsed.result.source.content, content);
  assert.equal(parsed.issues.length, 1);
});

/**
 * 二観点の分析内容と原文を関係投影だけに縮めず保持する。
 * @responsibility 観点別内容・表・原文独立性と、Fence内参照の非混入を確認する。
 * @trace RCM-UT-002
 * @precondition 両観点の正式入力と評価済みChecklistを持つ本文。
 * @stimulus 観点ごとにモデルを構築し、呼出し元のsourceを書き換える。
 * @observation 名前付き内容、出典、原文、参照、Outcomeを確認する。
 * @oracle 重複targetsを保持して局所受理し、図は原文に残すが参照へ加えない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同一Processの文書構築。
 */
test("UI分析モデルは観点別の内容と取得時の原文を保持する", () => {
  for (const view of ["ux", "ia"] as const) {
    const id = view === "ux" ? "UX-000001" : "IA-000001";
    const headings =
      view === "ux"
        ? [
            "2. UIへ引き継ぐ利用者成果",
            "3. 必要な認識・操作・Feedback",
            "4. 状況による体験差",
            "6. IA観点との統合時に確認すること",
          ]
        : [
            "2. UIへ引き継ぐ情報構造",
            "3. 表示の優先順位とNavigation",
            "4. 表示差と開示境界",
            "6. UX観点との統合時に確認すること",
          ];
    const link = "[UI-000001](../../Definitions/UI-000001/ui_definition.md)";
    const content = [
      `成果物種別: UI分析（${view === "ux" ? "UX" : "IA"}観点）`,
      `分析単位: \`${id}\``,
      "## 1. 正式入力",
      `${view === "ux" ? "UX" : "IA"}定義: [${id}](../../../${view === "ux" ? "02_UX" : "03_IA"}/Definitions/${id}/${view}_definition.md)`,
      `## ${headings[0]}`,
      "| 意味 | 内容 |",
      "|---|---|",
      "| 利用者成果 | 状態が分かる |",
      `## ${headings[1]}`,
      "```text",
      "[開始] → [結果]",
      "```",
      `## ${headings[2]}`,
      "不明なら判断を保留する",
      "## 5. UI処置",
      `${link} ${link}`,
      "```md",
      "[UI-999999](../../Definitions/UI-999999/ui_definition.md)",
      "```",
      `## ${headings[3]}`,
      "相手観点の結論を先取りしない",
      "<!-- 原文には保持する -->",
      "## Checklist",
      ...(view === "ux"
        ? parseUiAnalysis(
            { path: "fixture.md", content: "## Checklist" },
            "UX-XXXXXX",
            { mode: "evaluated" },
          ).result.checklistContract.expectedItems
        : parseUiAnalysis(
            { path: "fixture.md", content: "## Checklist" },
            "IA-XXXXXX",
            { mode: "evaluated" },
          ).result.checklistContract.expectedItems
      ).map((item) => `- [x] ${item}`),
    ].join("\r\n");
    const source = { path: `${id}.md`, content };
    const parsed = parseUiAnalysis(source, id);
    source.content = "changed";
    assert.equal(parsed.status, "complete");
    assert.ok(parsed.result);
    const model = parsed.result;
    assert.equal(model.source.content, content);
    assert.equal(model.view, view);
    assert.deepEqual(
      model.targets.map(({ identity }) => identity),
      ["UI-000001", "UI-000001"],
    );
    assert.equal(model.dispositions[0]?.boundary, "heading");
    assert.match(
      model.integrationQuestions[0]?.body.text ?? "",
      /先取りしない/u,
    );
    if (model.view === "ux")
      assert.deepEqual(model.outcomes[0]?.tableRows[2]?.cells, [
        "利用者成果",
        "状態が分かる",
      ]);
    else assert.match(model.visibility[0]?.body.text ?? "", /判断を保留/u);
    const duplicate = parseUiAnalysis(
      { path: source.path, content: `${content}\r\n## 5. UI処置\r\n${link}` },
      id,
    );
    assert.equal(duplicate.status, "partial");
    assert.equal(duplicate.result?.dispositions.length, 2);
    assert.deepEqual(duplicate.result?.targets, []);
  }
});

/**
 * UI正式入力の表示IDとリンク先IDの不一致を残す。
 * @responsibility 不正入力を正しい単一参照に正規化しない。
 * @trace RCM-UT-002
 * @precondition 表示IDだけが一致する正式入力節。
 * @stimulus 期待IDを指定してモデル化する。
 * @observation 正式入力本文と先頭診断を取得する。
 * @oracle 不一致本文を保持し、契約違反を返す。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同一Processの文書構築。
 */
test("UI分析は正式入力の不一致と欠測を消さない", () => {
  const content =
    "## 1. 正式入力\nUX定義: [UX-000001](../../../02_UX/Definitions/UX-999999/ux_definition.md)\n## 5. UI処置\n[UI-000001](../../Definitions/UI-000001/ui_definition.md)";
  const parsed = parseUiAnalysis({ path: "analysis.md", content }, "UX-000001");
  assert.equal(parsed.status, "partial");
  assert.match(parsed.result?.formalInputs[0]?.body.text ?? "", /UX-999999/u);
  assert.equal(
    parsed.issues[0]?.kind,
    "artifact.ui.ux-analysis-contract-invalid",
  );
  assert.deepEqual(parsed.result?.unresolved, []);
});

import {
  parseUiAnalysis,
  parseUiDefinition,
  parseUiDetailIndex,
  parseUiIndex,
  parseUiScreen,
} from "../../../src/index.ts";

/**
 * 旧Screen抽出試験をUIモデルへ移し、対象UI欠測でも行の情報を残す。
 * @responsibility 最初のBHV・順序・重複・期待Screen IDの相関を維持する。
 * @trace RCM-UT-002
 * @precondition 対象UIなし、および重複行と異なる本文Screen IDを用意する。
 * @stimulus Screenの完成Parserを呼ぶ。
 * @observation 対象UI、関係行、宣言と期待IDを取得する。
 * @oracle 対象UI不明でも行を保持し、最初のBHVと重複を消さない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な工程モデル構築。
 */
test("Screenモデルは対象UI欠測と関係出現を区別する", () => {
  const row = "| PRT-000001.spec-000001 | a | b | c | BHV-000001 BHV-000002 |";
  const missing = parseUiScreen(
    { path: "screen.md", content: row },
    "SCR-000007",
  ).result;
  assert.equal(missing.targetUi, null);
  assert.equal(missing.relationRows.length, 1);
  const model = parseUiScreen(
    {
      path: "screen.md",
      content: `Screen ID: SCR-999999\n対象UI Definition: [UI-000001]\n${row}\n${row}`,
    },
    "SCR-000007",
  ).result;
  assert.equal(model.targetUi?.identity, "UI-000001");
  assert.equal(model.expectedIdentity, "SCR-000007");
  assert.deepEqual(
    model.relationRows.map((item) => [item.interactionKey, item.behaviorId]),
    [
      ["PRT-000001.spec-000001", "BHV-000001"],
      ["PRT-000001.spec-000001", "BHV-000001"],
    ],
  );
  assert.match(model.declarations[0]?.text ?? "", /SCR-999999/u);
});

/**
 * PartをScreen内の構成内容として捕捉し、別文書や状態機械を創作しない。
 * @responsibility 名前付き内容・原文・位置と、節外にもある旧関係行を保持する。
 * @trace RCM-UT-002
 * @precondition backtick付きPart、Interaction Key、改行付き対象UI、隠れた行を与える。
 * @stimulus Screenを構築する。
 * @observation Part内容、関係、出典、原文を取得する。
 * @oracle PartとInteractionを区別し、可視の節外行を残しFence内参照は加えない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な工程モデル構築。
 */
test("ScreenモデルはPartの意味と出典を保持する", () => {
  const content = [
    "対象UI Definition:",
    "  [UI-000001]",
    "対象UI Definition: UI-000002",
    "## 2. Screen Composition",
    "| PRT | 意味 | 情報 | 操作 | 状態 |",
    "|---|---|---|---|---|",
    "| `PRT-000001` | 状態を伝える | 根拠 | 保存 | pending |",
    "| PRT-000001.spec-000001 | a | b | c | BHV-000001 |",
    "## 別の節",
    "| PRT-000002.spec-000001 | a | b | c | BHV-000002 |",
    "```md",
    "| PRT-999999.spec-999999 | a | b | c | BHV-999999 |",
    "```",
  ].join("\r\n");
  const model = parseUiScreen(
    { path: "screen.md", content },
    "SCR-000001",
  ).result;
  assert.equal(model.targetUi?.identity, "UI-000001");
  assert.equal(model.targetUi?.location.line, 2);
  assert.equal(model.parts.length, 1);
  assert.equal(model.parts[0]?.identity, "PRT-000001");
  assert.equal(model.parts[0]?.responsibility, "状態を伝える");
  assert.equal(model.parts[0]?.operation, "保存");
  assert.equal(model.parts[0]?.location.line, 7);
  assert.match(model.source.content.split(/\r?\n/u)[6] ?? "", /`PRT-000001`/u);
  assert.deepEqual(
    model.relationRows.map((row) => row.behaviorId),
    ["BHV-000001", "BHV-000002"],
  );
  assert.deepEqual(model.states, []);
  assert.equal(model.source.content, content);
});

/**
 * 定義の意味、出典、欠測と重複をモデルに残す。
 * @responsibility 本文の状態宣言と実検証を混同せず、部分モデルからも関係を利用する。
 * @trace RCM-UT-002
 * @precondition 同名節、空節、異なる宣言IDと隠れた本文を含む定義。
 * @stimulus 完成Parserへ期待IDと本文を渡す。
 * @observation 名前付き内容、参照、位置、局所診断を取得する。
 * @oracle 重複は消えず、欠測と空本文が異なり、関係は期待IDと分離される。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な文書モデル構築。
 */
test("UI定義モデルは意味と出典を保持し欠測を補完しない", () => {
  const parsed = parseUiDefinition(
    {
      path: "ui.md",
      content: [
        "成果物種別: UI定義",
        "UI ID: `UI-999999`",
        "UI ID: `UI-888888`",
        "状態: Ready",
        "## 利用者成果",
        "利用者が状態を理解する",
        "## 操作とFeedback",
        "| 操作 | Feedback |",
        "|---|---|",
        "| 保存 | 完了表示 |",
        "## 状態と表示差",
        "## 状態と表示差",
        "取消は未定",
        "## UX観点の分析結果",
        "[UX-000001](../../Analysis/UX-000001/ui_analysis.md)",
        "## UX観点の分析結果",
        "[UX-000002](../../Analysis/UX-000002/ui_analysis.md)",
        "## 対応するSPEC",
        "- pairs_with: [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)",
        "<!-- ## 視覚表現とアクセシビリティ -->",
      ].join("\n"),
    },
    "UI-000001",
  );
  assert.equal(parsed.status, "partial");
  assert.ok(parsed.result);
  const model = parsed.result;
  assert.equal(model.expectedIdentity, "UI-000001");
  assert.equal(model.declarations.length, 2);
  assert.equal(model.artifact.status, "Ready");
  assert.equal(model.outcome[0]?.body.text.trim(), "利用者が状態を理解する");
  assert.equal(model.outcome[0]?.body.location.line, 5);
  assert.equal(model.outcome[0]?.body.text.startsWith("\n"), true);
  assert.deepEqual(model.interaction[0]?.tableRows[2]?.cells, [
    "保存",
    "完了表示",
  ]);
  assert.equal(model.interaction[0]?.tableRows[2]?.location.line, 10);
  assert.equal(model.states.length, 2);
  assert.equal(model.states[0]?.body.text.trim(), "");
  assert.deepEqual(model.accessibility, []);
  assert.deepEqual(model.analysisInputs.ux, []);
  assert.equal(model.uxAnalysis.length, 2);
  assert.equal(model.pairedSpecifications[0]?.identity, "SPEC-000001");
  assert.equal(model.pairedSpecifications[0]?.location.line, 19);
});

/**
 * 既存の局所契約を満たす定義だけをcompleteとして返す。
 * @responsibility 構文tokenの存在と実際の節の存在を区別する。
 * @trace RCM-UT-002
 * @precondition 必須token、正式入力、二観点と評価済みChecklistを持つ本文。
 * @stimulus 一つの必須見出しを行中tokenとして渡す。
 * @observation Outcomeと対応する節の欠測を取得する。
 * @oracle 旧includes契約は維持し、存在しない節本文は捏造しない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同一Processのモデル構築と局所検査。
 */
test("UIの旧構文受理と意味の欠測を区別する", () => {
  const content = [
    "成果物種別: UI定義",
    "UI ID: `UI-000001`",
    "文中 ## 利用者成果",
    "## UX観点の分析結果",
    "[UX-000001](../../Analysis/UX-000001/ui_analysis.md)",
    "## IA観点の分析結果",
    "[IA-000001](../../Analysis/IA-000001/ui_analysis.md)",
    "## 正式入力と変換根拠",
    "正式入力そのものではない",
    "正式入力: [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md)",
    "正式入力: [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md)",
    ...[
      "両観点の統合判断",
      "表示面と情報の優先順位",
      "操作とFeedback",
      "状態と表示差",
      "視覚表現とアクセシビリティ",
      "制約",
      "UI／SPEC対応レビューへ渡す項目",
    ].map((heading) => `## ${heading}`),
    "## Checklist",
    ...parseUiDefinition(
      { path: "fixture.md", content: "## Checklist" },
      "UI-XXXXXX",
      { mode: "evaluated" },
    ).result.checklistContract.expectedItems.map((item) => `- [x] ${item}`),
  ].join("\n");
  const parsed = parseUiDefinition({ path: "ui.md", content }, "UI-000001");
  assert.equal(parsed.status, "complete");
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.result?.outcome, []);
});

/**
 * 不正行の件数と重複した関係を保持する。
 * @responsibility Setで消える関係重複と行Issueの順序を検査する。
 * @trace RCM-UT-002
 * @precondition UX入力を欠く同じUI行を二行使う。
 * @stimulus 入口解析と関係閉包を実行する。
 * @observation Issue列、ID集合と関係列を取得する。
 * @oracle 行Issue二件と重複関係二件を保持し、閉包は不正となる。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("UI入口は不正行と重複関係をまとめない", () => {
  const row =
    "| [UI-000001](Definitions/UI-000001/ui_definition.md) | name | — | IA-000001 |";
  const source = { path: "ui.md", content: `${row}\n${row}` };
  const index = parseUiIndex(source);
  assert.equal(index.issues.length, 2);
  assert.deepEqual(
    [...new Set(index.result.entries.map((entry) => entry.identity))],
    ["UI-000001"],
  );
  assert.deepEqual(
    index.result.entries.flatMap((entry) =>
      entry.iaIds.map((id) => `${id}|${entry.identity}`),
    ),
    ["IA-000001|UI-000001", "IA-000001|UI-000001"],
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "ui_relations",
      sourcePath: source.path,
      index: index.result,
      analyses: [],
      definitions: [],
    }).length,
    1,
  );
  assert.deepEqual(
    inspectDocumentRelations({
      kind: "ui_index_coverage",
      sourcePath: source.path,
      index: index.result,
      actualUiIds: new Set(["UI-000001"]),
    }),
    [],
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "ui_index_coverage",
      sourcePath: source.path,
      index: index.result,
      actualUiIds: new Set(),
    }).length,
    1,
  );
});

/**
 * 不正な分析・定義でも抽出関係を次の検査へ渡す。
 * @responsibility 二観点の分離と本文／Checklistの別Issueを確認する。
 * @trace RCM-UT-002
 * @precondition 各処置の参照だけを持つ不完全本文を使う。
 * @stimulus 両観点分析と定義を検査する。
 * @observation 関係列とIssue順を取得する。
 * @oracle 関係を保持し、本文とChecklistの二Issueを順に返す。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("UI両観点と定義は不正本文でも関係を保持する", () => {
  for (const id of ["UX-000001", "IA-000001"]) {
    const model = parseUiAnalysis(
      {
        path: id,
        content:
          "## 5. UI処置\n[UI-000001](../../Definitions/UI-000001/ui_definition.md)",
      },
      id,
    );
    assert.equal(model.status, "partial");
    assert.ok(model.result);
    assert.deepEqual(
      model.result.targets.map(
        (ref) => `${model.result?.expectedIdentity}|${ref.identity}`,
      ),
      [`${id}|UI-000001`],
    );
    assert.equal(model.issues.length, 2);
    assert.match(model.issues[0]?.kind ?? "", /analysis-contract-invalid$/u);
    assert.match(model.issues[1]?.kind ?? "", /analysis-checklist-invalid$/u);
  }
  const model = parseUiDefinition(
    {
      path: "definition.md",
      content:
        "## UX観点の分析結果\n[UX-000001](../../Analysis/UX-000001/ui_analysis.md)\n## IA観点の分析結果\n[IA-000001](../../Analysis/IA-000001/ui_analysis.md)",
    },
    "UI-000001",
  );
  assert.equal(model.status, "partial");
  assert.ok(model.result);
  assert.deepEqual(
    model.result.analysisInputs.ux.map(
      (ref) => `${ref.identity}|${model.result?.expectedIdentity}`,
    ),
    ["UX-000001|UI-000001"],
  );
  assert.deepEqual(
    model.result.analysisInputs.ia.map(
      (ref) => `${ref.identity}|${model.result?.expectedIdentity}`,
    ),
    ["IA-000001|UI-000001"],
  );
  assert.equal(model.issues.length, 2);
  assert.equal(
    inspectDocumentRelations({
      kind: "ui_analysis_coverage",
      sourcePath: "ui.md",
      uxIds: new Set(["UX-000001"]),
      iaIds: new Set(["IA-000001"]),
      analysisUxIds: new Set(),
      analysisIaIds: new Set(),
    }).length,
    2,
  );
});

/**
 * Detailの現在の集合数判定を維持する。
 * @responsibility 一行一IDの新しい強化条件を追加しないことを確認する。
 * @trace RCM-UT-002
 * @precondition 二UI行に同じSCR／PRTを記載した本文を使う。
 * @stimulus 登録UI集合とDetailを照合する。
 * @observation Issue列を取得する。
 * @oracle 集合数不足は拒否し、既存条件を満たす本文は受理する。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("UI Detailは現在の集合数境界を維持する", () => {
  /**
   * 六列のDetail行を組み立てる。
   * @responsibility 指定したIDとSCR／PRTを合成表へ埋め込む。
   * @trace RCM-UT-002
   * @input id: UI ID。screen: SCR記載。part: PRT記載。
   * @returns 合成したMarkdown一行。
   * @stimulus 呼出し元のIDとSCR／PRTを一行へ埋め込む。
   * @observation 返却された文字列をDetail検査へ渡す。
   * @oracle 指定したIDとSCR／PRTが順序どおり含まれる。
   * @cleanup N/A: 局所文字列だけを使う。
   * @precondition 呼出し元が反例のIDを指定する。
   * @postcondition 引数をそのまま各列へ保持する。
   * @effect N/A: 局所文字列だけを返す。
   * @failure N/A: 外部処理を行わない。
   * @invariant 指定した反例を補完・検査しない。
   * @boundary RCM-UT-002=N/A: 同期的な試験データ組立て。
   * @security N/A: 秘密値・認可を扱わない。
   * @concurrency N/A: 共有状態を変更しない。
   */
  const createDetailRow = (id: string, screen: string, part: string) =>
    `| ${id} | name | Applicable／Covered | Area | ${screen} ${part} | reason |`;
  const source = {
    path: "detail.md",
    content: `状態: Canonical\n${createDetailRow("UI-000001", "SCR-000001", "PRT-000001")}`,
  };
  assert.deepEqual(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail: parseUiDetailIndex(source),
      actualIds: new Set(["UI-000001"]),
    }),
    [],
  );
  const duplicate = {
    ...source,
    content: `${source.content}\n${createDetailRow("UI-000002", "SCR-000001", "PRT-000001")}`,
  };
  assert.equal(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail: parseUiDetailIndex(duplicate),
      actualIds: new Set(["UI-000001", "UI-000002"]),
    }).length,
    1,
  );
  // Current code counts distinct IDs across rows; it does not enforce a new per-row bijection.
  const shared = {
    ...source,
    content:
      "状態: Canonical\n" +
      createDetailRow(
        "UI-000001",
        "SCR-000001 SCR-000002",
        "PRT-000001 PRT-000002",
      ) +
      "\n" +
      createDetailRow("UI-000002", "SCR-000002", "PRT-000002"),
  };
  assert.deepEqual(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail: parseUiDetailIndex(shared),
      actualIds: new Set(["UI-000001", "UI-000002"]),
    }),
    [],
  );
});

/**
 * UI対応表の最初の見出し・次のH2・非表示領域を区別する。
 * @responsibility ParserのOwner移管でSectionの受理範囲を変えないことを確認する。
 * @trace RCM-UT-002
 * @precondition 同名の二つのSectionと非表示の対応Linkを用意する。
 * @stimulus 公開UI Parserで対応出現を読む。
 * @observation 出現列と欠測時の空列を取得する。
 * @oracle 最初のSectionだけを読み、同じLinkの重複は保持する。
 * @cleanup N/A: 局所値のみ。
 * @boundary 同一ProcessのMarkdownとUIモデル。
 */
test("UI対応Parserは最初のSectionと非表示領域の境界を維持する", () => {
  const pairs = (content: string, identity: string) =>
    parseUiDefinition(
      { path: "ui.md", content },
      identity,
    ).result?.pairedSpecifications.map((ref) => `${identity}|${ref.identity}`);
  const first =
    "[SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)";
  const second =
    "[SPEC-000002](../../../05_SPEC/Definitions/SPEC-000002/spec_definition.md)";
  assert.deepEqual(
    pairs(
      "## 対応するSPEC\n- pairs_with: " +
        first +
        " " +
        first +
        "\n## 対応するSPEC\n- pairs_with: " +
        second,
      "UI-000001",
    ),
    ["UI-000001|SPEC-000001", "UI-000001|SPEC-000001"],
  );
  assert.deepEqual(
    pairs(
      "<!-- ## 対応するSPEC\n- pairs_with: " +
        first +
        "\n-->\n" +
        "~~~md\n## 対応するSPEC\n- pairs_with: " +
        second +
        "\n~~~",
      "UI-000001",
    ),
    [],
  );
  assert.deepEqual(
    pairs(`## 別のSection\n- pairs_with: ${first}`, "UI-000001"),
    [],
  );
});

/** 既存Checklist行列を完成Parserへ接続する試験専用選択。@trace RCM-UT-002 */
function parseUiChecklistFixture(
  source: { path: string; content: string },
  request: { kind: string; mode: string },
) {
  const options = { mode: request.mode as "template" | "evaluated" };
  switch (request.kind) {
    case "analysis_ux":
      return parseUiAnalysis(source, "UX-XXXXXX", options).result;
    case "analysis_ia":
      return parseUiAnalysis(source, "IA-XXXXXX", options).result;
    case "definition":
      return parseUiDefinition(source, "UI-XXXXXX", options).result;
    case "detail_index":
      return parseUiDetailIndex(source, options).result;
    case "area":
      return parseUiArea(source, options).result;
    case "screen":
      return parseUiScreen(source, "SCR-XXXXXX", options).result;
    case "component":
      return parseUiComponent(source, options).result;
    case "visual_baseline":
      return parseUiVisualBaseline(source, options).result;
    case "handoff":
      return parseUiHandoff(source, options).result;
    default:
      throw Error("unknown_ui_checklist_kind");
  }
}

/**
 * UIの文書別受付とDetail局所／横断診断の境界を確認する。
 * @responsibility 部分内容を保持し、局所と被覆の併存を二重診断にしない。
 * @trace RCM-UT-002
 * @precondition 四文書の本文と、局所成立／不成立のDetail台帳を用意する。
 * @stimulus 完成ParseとSemanticの被覆比較を呼ぶ。
 * @observation 原文・節・局所Issue・combined診断を読む。
 * @oracle 内容は保持され、被覆診断は最大一件、Checklistだけの不備は別経路に残る。
 * @cleanup N/A: 局所値だけを扱う。
 */
test("UIの完成Parseは内容と局所診断を分離し被覆診断を重複させない", () => {
  for (const [parse, heading] of [
    [parseUiArea, "1. Areaの目的と利用者成果"],
    [parseUiComponent, "1. 昇格理由"],
    [parseUiVisualBaseline, "1. Productの表現意図"],
    [parseUiHandoff, "1. 共通の正式入力"],
  ] as const) {
    const source = {
      path: "ui.md",
      content: `## ${heading}\n取得した本文\n| A | B |`,
    };
    const parsed = parse(source);
    assert.equal(parsed.status, "partial");
    assert.equal(parsed.result.source.content, source.content);
    assert.equal(parsed.result.tableRows.length, 1);
    assert.equal(parsed.result.sections[0]?.heading.text, `## ${heading}`);
    assert.equal(parsed.issues.length, 1);
    assert.equal(Object.hasOwn(parsed.result, "issues"), false);
    source.content = "changed";
    assert.notEqual(parsed.result.source.content, source.content);
  }
  const source = {
    path: "detail.md",
    content:
      "状態: Canonical\n| UI-000001 | name | Applicable／Covered | Area | SCR-000001 PRT-000001 | reason |",
  };
  const detail = parseUiDetailIndex(source);
  assert.ok(detail.issues.length);
  assert.deepEqual(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail,
      actualIds: new Set(["UI-000001"]),
    }),
    [],
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail,
      actualIds: new Set(["UI-000002"]),
    }).length,
    1,
  );
  const invalid = parseUiDetailIndex({
    ...source,
    content: source.content.replace("Area", ""),
  });
  assert.ok(
    invalid.issues.some(
      (issue) => issue.kind === "artifact.ui.detail-current-coverage-invalid",
    ),
  );
  assert.equal(
    inspectDocumentRelations({
      kind: "ui_detail_coverage",
      detail: invalid,
      actualIds: new Set(["UI-000002"]),
    }).length,
    1,
  );
});
