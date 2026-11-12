/**
 * 変更文書の構造・ひな型・案内集合を検証する。
 * @packageDocumentation
 * @responsibility 打切り、適用閾値、生本文と指定区画の既存条件を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、change
 * @boundary RCM-UT-002=N/A: 既読合成本文の同期モデル検査。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectChangeDocument,
  isChangeTemplateInvalid,
  isChangeNavigationInvalid,
} from "../../../src/index.ts";

/**
 * 影響見出しとBlock不正の異なる短絡を確認する。
 * @responsibility 見出し不正だけの打切りと番号79／80の閾値を検証する。
 * @trace RCM-UT-002
 * @precondition 不正見出し、空Block、平坦な正常Blockを用意する。
 * @stimulus Canonical文書検査を呼ぶ。
 * @observation Issueの分類と順序を取得する。
 * @oracle 見出し不正は一件、Block不正は旧見出しとPhaseまで続行する。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("変更文書は見出しだけで打ち切りBlock不正では続行する", () => {
  const missingIssues = inspectChangeDocument(
    { path: "change.md", content: "### 主な反映ファイル" },
    "CHG-000080",
  );
  assert.deepEqual(
    missingIssues.map((issue) => issue.kind),
    ["artifact.change.impact-files-section-mismatch"],
  );
  const invalid =
    "### 影響ファイル\n\n<details>\n<summary>全ファイルを表示</summary>\n\n</details>\n### 主な反映ファイル";
  assert.deepEqual(
    inspectChangeDocument(
      { path: "change.md", content: invalid },
      "CHG-000080",
    ).map((issue) => issue.kind),
    [
      "artifact.change.impact-files-contract-invalid",
      "artifact.change.legacy-impact-heading",
      "artifact.change.phase-gate-contract-incomplete",
    ],
  );
  assert.equal(
    inspectChangeDocument({ path: "change.md", content: invalid }, "CHG-000079")
      .length,
    2,
  );
  const valid =
    "### 影響ファイル\n\n<details>\n<summary>全ファイルを表示</summary>\n\n- [source](./source.md)\n\n</details>";
  assert.deepEqual(
    inspectChangeDocument({ path: "change.md", content: valid }, "CHG-000079"),
    [],
  );
  assert.equal(
    inspectChangeDocument({ path: "change.md", content: valid }, "CHG-000080")
      .length,
    1,
  );
  assert.equal(
    inspectChangeDocument(
      { path: "change.md", content: `${valid}\n### 影響ファイル` },
      "CHG-000080",
    ).length,
    1,
  );
  // Raw text remains the inspection source; moving to Domain does not hide comments.
  assert.deepEqual(
    inspectChangeDocument(
      { path: "change.md", content: `<!--\n${valid}\n-->` },
      "CHG-000079",
    ),
    [],
  );
});

/**
 * 変更案内の最初の指定区画と重複を確認する。
 * @responsibility 区画外・二つ目の区画を数えず、同じIDの重複を拒否する。
 * @trace RCM-UT-002
 * @precondition 区画内外と重複したリンクを合成する。
 * @stimulus 案内集合の検査を呼ぶ。
 * @observation 不正判定を取得する。
 * @oracle 最初の指定区画だけの重複なし完全一致を受理する。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("変更案内は最初の指定区画だけを照合する", () => {
  const start = "<!-- crdd-change-aggregate-index:start -->",
    end = "<!-- crdd-change-aggregate-index:end -->";
  const link = "[change](./Changes/CHG-000065/change.md)";
  assert.equal(
    isChangeNavigationInvalid(
      `${start}${link}${end}\n./Changes/CHG-000066/change.md`,
      ["CHG-000065"],
    ),
    false,
  );
  assert.equal(
    isChangeNavigationInvalid(`${start}${link}${link}${end}`, ["CHG-000065"]),
    true,
  );
  assert.equal(
    isChangeNavigationInvalid(`${start}${end}\n${start}${link}${end}`, [
      "CHG-000065",
    ]),
    true,
  );
  assert.equal(
    isChangeNavigationInvalid(`${start}${link}${end}`, [
      "CHG-000065",
      "CHG-000066",
    ]),
    true,
  );
});

/**
 * 変更ひな型の条件をCanonical本文と別に維持する。
 * @responsibility 必須固定語彙を持つひな型と旧任意表現を区別する。
 * @trace RCM-UT-002
 * @precondition 固定構造だけを持つ合成ひな型を使う。
 * @stimulus ひな型の不正判定を呼ぶ。
 * @observation 不正判定を取得する。
 * @oracle 合成固定構造は受理し、旧任意見出しは拒否する。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("変更ひな型は独立した固定構造を照合する", () => {
  const template = [
    "### 影響ファイル",
    "<summary>全ファイルを表示</summary>",
    "| Phase／Gate適用判断 |",
    "## Phase／Gateと途中拡張",
    "### 適用判断",
    "### PhaseとGate",
    "### 途中拡張の記録",
    "### 途中見直しの記録",
    "## 固定前の収束確認",
    "## 変更経路の計画",
    "- 適用判定: `<Applicable／N/A: 理由／OPEN: 理由・確認先・再評価契機>`",
    "| 評価対象 | 判定 | 理由 |",
    "| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |",
    "| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |",
    "| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |",
    "| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |",
  ].join("\n");
  assert.equal(isChangeTemplateInvalid(template), false);
  assert.equal(
    isChangeTemplateInvalid(`${template}\n### 主な反映ファイル`),
    true,
  );
  assert.equal(
    isChangeTemplateInvalid(
      template.replace(
        "## 変更経路の計画",
        "## 変更経路の計画（非自明な変更で該当する場合）",
      ),
    ),
    true,
  );
});
