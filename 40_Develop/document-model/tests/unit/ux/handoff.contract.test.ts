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
import { parseUxHandoff } from "../../../src/ux/handoff.ts";

/**
 * 合成表のPathと文書種別を付けて既存Boolean観点へ投影する。
 * @responsibility 試験断片を完成Parserへ渡し、旧表条件を比較する。
 * @trace RCM-UT-002
 * @precondition 各試験が合成した本文と見出しを使う。
 * @stimulus contractまたはrootの内容モデルを構築する。
 * @observation validを取得する。
 * @oracle 既存の真偽期待を維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 同期的なモデル構築。
 */
const evaluateContractFixture = (content: string, heading: string) =>
  parseUxHandoff({ path: "handoff.md", content }, heading, "contract").valid;
/**
 * 入口用の合成表にPathと文書種別を付ける。
 * @responsibility 非対象labelを含む入口表の旧Boolean観点を維持する。
 * @trace RCM-UT-002
 * @precondition 各試験が合成した本文と見出しを使う。
 * @stimulus rootの内容モデルを構築する。
 * @observation validを取得する。
 * @oracle 既存の真偽期待を維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 同期的なモデル構築。
 */
const evaluateRootFixture = (content: string, heading: string) =>
  parseUxHandoff({ path: "handoff.md", content }, heading, "root").valid;

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
  const source = { path: "handoff.md", content: body };
  const model = parseUxHandoff(source, heading, "contract");
  source.content = "changed";
  assert.notEqual(model.source.content, source.content);
  assert.equal(model.kind, "contract");
  assert.equal(model.entries.length, 6);
  assert.equal(model.comparisonLabels.length, 4);
  assert.equal(model.entries[2]?.source.location.line, 4);
  assert.equal(
    parseUxHandoff({ path: "handoff.md", content: "" }, heading, "contract")
      .section,
    null,
  );
  assert.equal(
    parseUxHandoff(
      { path: "handoff.md", content: heading },
      heading,
      "contract",
    ).section?.text,
    "",
  );
  assert.throws(
    () =>
      parseUxHandoff(
        { path: "handoff.md", content: body },
        heading,
        "other" as never,
      ),
    /unknown_ux_handoff_kind/u,
  );
  assert.equal(evaluateContractFixture(body, heading), true);
  for (const items of [rows.slice(1), [...rows, rows[0]], [...rows].reverse()])
    assert.equal(
      evaluateContractFixture(
        `${heading}\n${createHandoffTable(items)}`,
        heading,
      ),
      false,
    );
  assert.equal(
    evaluateContractFixture(createHandoffTable(rows), heading),
    false,
  );
  assert.equal(
    evaluateContractFixture(
      `${heading}\n### 別Section\n${createHandoffTable(rows)}`,
      heading,
    ),
    false,
  );
  assert.equal(
    evaluateContractFixture(`${body}\n### 別Section\n| 追加 | 内容 |`, heading),
    true,
  );
  for (const hidden of [
    `<!--\n${createHandoffTable(rows)}\n-->`,
    `\x60\x60\x60text\n${createHandoffTable(rows)}\n\x60\x60\x60`,
  ])
    assert.equal(
      evaluateContractFixture(`${heading}\n${hidden}`, heading),
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
  const model = parseUxHandoff(
    { path: "root.md", content: body },
    heading,
    "root",
  );
  assert.equal(
    model.entries.some((entry) => entry.label === "概要"),
    true,
  );
  assert.equal(model.comparisonLabels.includes("概要"), false);
  assert.equal(model.comparisonLabels.length, 3);
  assert.equal(evaluateRootFixture(body, heading), true);
  assert.equal(
    evaluateRootFixture(
      `${heading}\n### 下位\n${createHandoffTable(rows)}`,
      heading,
    ),
    true,
  );
  assert.equal(
    evaluateRootFixture(
      `${heading}\n## 次\n${createHandoffTable(rows)}`,
      heading,
    ),
    false,
  );
  assert.equal(evaluateRootFixture(createHandoffTable(rows), heading), false);
  for (const items of [
    rows.slice(1),
    [...rows, rows[0]],
    [...rows, "Handoff追加"],
    [...rows].reverse(),
  ])
    assert.equal(
      evaluateRootFixture(`${heading}\n${createHandoffTable(items)}`, heading),
      false,
    );
});
