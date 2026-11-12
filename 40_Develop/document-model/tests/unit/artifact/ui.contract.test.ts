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
  parseUiIndex,
  inspectUiAnalysis,
  inspectUiDefinition,
  inspectUiDetail,
  inspectUiRelations,
  inspectUiAnalysisCoverage,
  inspectUiIndexCoverage,
} from "../../../src/index.ts";

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
  assert.deepEqual([...index.ids], ["UI-000001"]);
  assert.deepEqual(index.iaPairs, [
    "IA-000001|UI-000001",
    "IA-000001|UI-000001",
  ]);
  assert.equal(inspectUiRelations(source.path, index, [], []).length, 1);
  assert.deepEqual(
    inspectUiIndexCoverage(source.path, index, new Set(["UI-000001"])),
    [],
  );
  assert.equal(inspectUiIndexCoverage(source.path, index, new Set()).length, 1);
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
    const model = inspectUiAnalysis(
      {
        path: id,
        content:
          "## 5. UI処置\n[UI-000001](../../Definitions/UI-000001/ui_definition.md)",
      },
      id,
    );
    assert.deepEqual(id.startsWith("UX") ? model.uxPairs : model.iaPairs, [
      `${id}|UI-000001`,
    ]);
    assert.equal(model.issues.length, 2);
    assert.match(model.issues[0]?.kind ?? "", /analysis-contract-invalid$/u);
    assert.match(model.issues[1]?.kind ?? "", /analysis-checklist-invalid$/u);
  }
  const model = inspectUiDefinition(
    {
      path: "definition.md",
      content:
        "## UX観点の分析結果\n[UX-000001](../../Analysis/UX-000001/ui_analysis.md)\n## IA観点の分析結果\n[IA-000001](../../Analysis/IA-000001/ui_analysis.md)",
    },
    "UI-000001",
  );
  assert.deepEqual(model.uxPairs, ["UX-000001|UI-000001"]);
  assert.deepEqual(model.iaPairs, ["IA-000001|UI-000001"]);
  assert.equal(model.issues.length, 2);
  assert.equal(
    inspectUiAnalysisCoverage(
      "ui.md",
      new Set(["UX-000001"]),
      new Set(["IA-000001"]),
      new Set(),
      new Set(),
    ).length,
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
  assert.deepEqual(inspectUiDetail(source, new Set(["UI-000001"])), []);
  const duplicate = {
    ...source,
    content: `${source.content}\n${createDetailRow("UI-000002", "SCR-000001", "PRT-000001")}`,
  };
  assert.equal(
    inspectUiDetail(duplicate, new Set(["UI-000001", "UI-000002"])).length,
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
    inspectUiDetail(shared, new Set(["UI-000001", "UI-000002"])),
    [],
  );
});
