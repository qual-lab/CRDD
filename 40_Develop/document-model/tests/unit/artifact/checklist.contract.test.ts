/**
 * 可視Checklistの既存受理境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 全失敗理由・優先順・項目順と非表示本文の扱いを固定する。
 * @trace RCM-UT-001
 * @level UT
 * @scope artifact、checklist
 * @boundary RCM-UT-001=N/A: 本文と期待項目の同期計算だけを扱う。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createPhaseChecklistItems,
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
  type ChecklistFailure,
} from "../../../src/index.ts";

/**
 * 工程別期待項目の所有と呼出し独立性を検証する。
 *
 * @responsibility 全47種類の非空項目・派生列・共有配列不存在を確認する。
 * @trace RCM-UT-001
 * @precondition 同じ固定モデルを独立して二回構築する。
 * @stimulus 一回目だけの項目配列を変更する。
 * @observation 二回目の全項目と派生列を取得する。
 * @oracle 元の項目順と二回目の値は変わらない。
 * @cleanup N/A: 局所配列だけを扱う。
 * @boundary RCM-UT-001=N/A: 文字列配列の局所計算。
 */
test("工程Checklistは全47種類と呼出し間の独立性を維持する", () => {
  const first = createPhaseChecklistItems();
  const second = createPhaseChecklistItems();
  assert.deepEqual(first, second);
  assert.equal(Object.keys(first).length, 47);
  for (const [key, items] of Object.entries(first)) {
    assert.ok(items.length > 0, key);
    assert.ok(
      items.every((item) => typeof item === "string" && item.length > 0),
      key,
    );
    items.push("only-first");
    assert.notDeepEqual(items, second[key as keyof typeof second]);
  }
  assert.deepEqual(
    second.qualityAnalysisDetailTemplateChecklistItemTexts.slice(0, 2),
    second.qualityAnalysisTemplateChecklistItemTexts.slice(0, 2),
  );
  assert.deepEqual(
    second.qualityAnalysisDetailTemplateChecklistItemTexts.slice(3),
    second.qualityAnalysisTemplateChecklistItemTexts.slice(2),
  );
});

/**
 * 評価済みChecklistの失敗理由と優先順を検証する。
 *
 * @responsibility 六理由・隠れたSection・項目完全一致の既存境界を確認する。
 * @trace RCM-UT-001
 * @precondition 期待項目AとBに対する固定本文を使う。
 * @stimulus 評価済み検査を呼び出す。
 * @observation 最初の失敗理由を取得する。
 * @oracle 旧検査と同じ理由・順序になる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋検査である。
 */
test("評価済みChecklistは構造・未評価・結果記法・項目順を区別する", () => {
  const cases: readonly (readonly [string, ChecklistFailure])[] = [
    ["", "missing_or_duplicate"],
    ["<!--\n## Checklist\n- [x] A\n-->", "missing_or_duplicate"],
    ["```md\n## Checklist\n- [x] A\n```", "missing_or_duplicate"],
    ["## Checklist\n## Checklist", "missing_or_duplicate"],
    ["## Checklist", "empty"],
    ["## Checklist\n段落\n- [ ] A", "content_after_or_between_items"],
    ["## Checklist\n- 不正\n- [ ] A", "unevaluated"],
    ["## Checklist\n- [X] A", "invalid_result"],
    ["## Checklist\n- OPEN: 理由 A", "item_set_mismatch"],
    ["## Checklist\n- [x] B\n- [x] A", "item_set_mismatch"],
    ["## Checklist\n- [x] A\n- [x] A", "item_set_mismatch"],
    ["## Checklist\n- [x] A", "item_set_mismatch"],
    ["## Checklist\n- [x] A\n- [x] B\n- [x] C", "item_set_mismatch"],
    ["## Checklist\n- [x] A\n- [x] B\n## 次", "content_after_or_between_items"],
  ];
  for (const [text, expectedItems] of cases)
    assert.equal(
      inspectEvaluatedChecklist(text, ["A", "B"]),
      expectedItems,
      text,
    );
});

/**
 * 評価済みは全項目Passに限定されないことを検証する。
 *
 * @responsibility 理由付きOPEN・FAIL・N/Aとインデント・可視本文除外を確認する。
 * @trace RCM-UT-001
 * @precondition 正しい項目順の本文と固定期待項目を使う。
 * @stimulus 同じ入力へ二回検査を適用する。
 * @observation nullと入力Snapshotを確認する。
 * @oracle 構造成立だけを返し、入力を変更しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋検査である。
 */
test("評価済みChecklistは理由付きOPEN・FAIL・N/Aを受理する", () => {
  const expectedItems = ["A", "B"];
  const before = JSON.stringify(expectedItems);
  for (const result of ["OPEN", "FAIL", "N/A"]) {
    const text = `<!--\n## Checklist\n-->\n## Checklist\n  - ${result}: 理由 — A\n- [x] B\n\n\`\`\`\n無視\n\`\`\``;
    assert.equal(inspectEvaluatedChecklist(text, expectedItems), null);
    assert.equal(inspectEvaluatedChecklist(text, expectedItems), null);
  }
  assert.equal(JSON.stringify(expectedItems), before);
});

/**
 * ひな型Checklistの案内と未評価項目を検証する。
 *
 * @responsibility 残る三理由と共通構造理由・案内位置・項目順を確認する。
 * @trace RCM-UT-001
 * @precondition 結果記法と理由を説明する案内を使う。
 * @stimulus 案内・項目・後続内容を変えて検査する。
 * @observation 最初の理由またはnullを取得する。
 * @oracle 全固定期待値に一致する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋検査である。
 */
test("ひな型Checklistは案内・未評価項目・末尾配置を要求する", () => {
  const guidance = "[x] [ ] OPEN FAIL N/A 理由";
  const items = "- [ ] A\n- [ ] B";
  const cases: readonly (readonly [string, ChecklistFailure | null])[] = [
    ["", "missing_or_duplicate"],
    ["## Checklist\n- [x] A", "unevaluated_item_missing"],
    [`## Checklist\n${items}`, "result_guidance_missing"],
    [
      `## Checklist\n${guidance}\n### 案内\n${items}`,
      "nested_or_following_heading",
    ],
    [`## Checklist\n${guidance}\n---\n${items}`, "nested_or_following_heading"],
    [
      `## Checklist\n${guidance}\n${items}\n本文`,
      "content_after_or_between_items",
    ],
    [`## Checklist\n${guidance}\n- [ ] B\n- [ ] A`, "item_set_mismatch"],
    [
      `## Checklist\n[x] [ ] OPEN FAIL N/A\n${items}`,
      "result_guidance_missing",
    ],
    [`## Checklist\n${guidance}\n${items}`, null],
  ];
  for (const [text, expectedItems] of cases)
    assert.equal(
      inspectTemplateChecklist(text, ["A", "B"]),
      expectedItems,
      text,
    );
});
