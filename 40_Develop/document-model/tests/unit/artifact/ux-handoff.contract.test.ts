/**
 * UXの二種類の引渡し表で、順序とSection境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 欠落・重複・非表示本文と異なる見出し終端を区別する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、ux-handoff
 * @boundary RCM-UT-002=N/A: 読取り済み文字列の同期検査だけを使う。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  isUxHandoffTargetSetExact,
  isUxRootHandoffValid,
} from "../../../src/index.ts";

/**
 * 合成の引渡し表を作る。
 *
 * @responsibility ラベル順を保った固定二列の本文を返す。
 * @trace RCM-UT-002
 * @precondition 比較対象のラベル列を受け取る。
 * @stimulus 同じラベル列を表記へ変換する。
 * @observation 呼出し元が生成本文を検査する。
 * @oracle ラベル数と順序を変えない。
 * @cleanup N/A: 不変入力と局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 試験用の純粋な文字列生成。
 */
function createHandoffTable(items: readonly string[]): string {
  return items.map((value) => `| ${value} | 内容 |`).join("\n");
}

/**
 * 正式な引渡し先の列とSection境界を確認する。
 *
 * @responsibility 四項目の順序・数・可視範囲を固定する。
 * @trace RCM-UT-002
 * @precondition 合成の表と異なる見出し終端を用意する。
 * @stimulus 公開Domain検査へ本文を渡す。
 * @observation boolean結果を取得する。
 * @oracle 正式列だけを受理し、不足・余剰・順序違いを拒否する。
 * @cleanup N/A: 不変の入力だけを使う。
 * @boundary RCM-UT-002=N/A: Process内の純粋な検査。
 */
test("UX成果物の四引渡し先は順序と三段階Section境界を保つ", () => {
  const heading = "## 引渡し";
  const rows = [
    "IA（直後工程への正式な引き渡し）",
    "Quality Analysis / UX（伴走）",
    "UI（後続Contract Relation）",
    "SPEC（後続Contract Relation）",
  ] as const;
  const body = `${heading}\n| 接続先 | 内容 |\n| --- | --- |\n${createHandoffTable(rows)}`;
  assert.equal(isUxHandoffTargetSetExact(body, heading), true);
  for (const items of [rows.slice(1), [...rows, rows[0]], [...rows].reverse()])
    assert.equal(
      isUxHandoffTargetSetExact(
        `${heading}\n${createHandoffTable(items)}`,
        heading,
      ),
      false,
    );
  assert.equal(
    isUxHandoffTargetSetExact(createHandoffTable(rows), heading),
    false,
  );
  assert.equal(
    isUxHandoffTargetSetExact(
      `${heading}\n### 別Section\n${createHandoffTable(rows)}`,
      heading,
    ),
    false,
  );
  assert.equal(
    isUxHandoffTargetSetExact(
      `${body}\n### 別Section\n| 追加 | 内容 |`,
      heading,
    ),
    true,
  );
  for (const hidden of [
    `<!--\n${createHandoffTable(rows)}\n-->`,
    `\x60\x60\x60text\n${createHandoffTable(rows)}\n\x60\x60\x60`,
  ])
    assert.equal(
      isUxHandoffTargetSetExact(`${heading}\n${hidden}`, heading),
      false,
    );
});

/**
 * UX入口だけのラベル選択と二段階Section境界を確認する。
 *
 * @responsibility 通常行と三段階見出しを許容し、関係する余剰行を拒否する。
 * @trace RCM-UT-002
 * @precondition 正式三ラベルと無関係な行を用意する。
 * @stimulus 公開Domain検査へ本文を渡す。
 * @observation boolean結果を取得する。
 * @oracle 成果物用検査と異なる入口用の受理条件を維持する。
 * @cleanup N/A: 不変の入力だけを使う。
 * @boundary RCM-UT-002=N/A: Process内の純粋な検査。
 */
test("UX入口は三ラベルと二段階Section境界を保つ", () => {
  const heading = "## 引渡し";
  const rows = [
    "IAへの正式な引き渡し",
    "Quality Analysis / UXへの伴走入力",
    "UI／SPECが後続で保持するUX Contract",
  ] as const;
  const body = `${heading}\n| 項目 | 内容 |\n| --- | --- |\n| 概要 | 内容 |\n${createHandoffTable(rows)}`;
  assert.equal(isUxRootHandoffValid(body, heading), true);
  assert.equal(
    isUxRootHandoffValid(
      `${heading}\n### 下位\n${createHandoffTable(rows)}`,
      heading,
    ),
    true,
  );
  assert.equal(
    isUxRootHandoffValid(
      `${heading}\n## 次\n${createHandoffTable(rows)}`,
      heading,
    ),
    false,
  );
  assert.equal(isUxRootHandoffValid(createHandoffTable(rows), heading), false);
  for (const items of [
    rows.slice(1),
    [...rows, rows[0]],
    [...rows, "Handoff追加"],
    [...rows].reverse(),
  ])
    assert.equal(
      isUxRootHandoffValid(`${heading}\n${createHandoffTable(items)}`, heading),
      false,
    );
});
