/**
 * UX分析の正式入力参照候補を検証する。
 *
 * @packageDocumentation
 * @responsibility 走査順・Root文字列結合・Entity異常flagとescapeの既存意味を固定する。
 * @trace RCM-UT-001
 * @level UT
 * @scope artifact、ux、formal-input
 * @boundary RCM-UT-001=N/A: 合成文字列だけを扱いFilesystem観測を行わない。
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { parseUxFormalInputTargets } from "../../../src/index.ts";

/**
 * 異なる形式からの候補とRoot結合順を検証する。
 *
 * @responsibility Markdown・HTML・裸Path・Entity候補の順序と同一候補の統合を確認する。
 * @trace RCM-UT-001
 * @precondition 固定本文と、Directoryを作らないRoot文字列を使う。
 * @stimulus UX参照解析を呼び出す。
 * @observation 候補配列の文字列・順序・flagを取得する。
 * @oracle Hostのpath.joinに基づく期待値と旧抽出順が一致する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の文字列計算である。
 */
test("UX参照候補は形式別の走査順とRoot文字列結合を維持する", () => {
  const root = path.join("synthetic", "repository");
  const input =
    '[A](../one.md)\n<a href="../../../01_Discovery/Analysis/EXP-000001/exploration&#46;md">ref</a>\n01_Discovery/Definitions/REQ-000001/requirement.md';
  assert.deepEqual(parseUxFormalInputTargets(input, root), [
    { target: "../one.md", invalidEntity: false },
    {
      target: "../../../01_Discovery/Analysis/EXP-000001/exploration.md",
      invalidEntity: false,
    },
    {
      target: path.join(
        root,
        "01_Discovery/Definitions/REQ-000001/requirement.md",
      ),
      invalidEntity: false,
    },
    {
      target: "01_Discovery/Analysis/EXP-000001/exploration.md",
      invalidEntity: false,
    },
  ]);
  assert.deepEqual(
    parseUxFormalInputTargets("[A](../one.md)\n[B](../one.md)", root),
    [{ target: "../one.md", invalidEntity: false }],
  );
});

/**
 * Entity異常をDiscovery候補へ限定して保持することを検証する。
 *
 * @responsibility 未知Entityを候補削除や全候補一律拒否へ変えない。
 * @trace RCM-UT-001
 * @precondition Discovery参照と通常参照に同じ未知Entityを含める。
 * @stimulus UX参照解析を呼び出す。
 * @observation 元文字列とinvalidEntityを取得する。
 * @oracle Discovery形状の候補だけに既存条件のflagを立てる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の文字列計算である。
 */
test("Entity異常は候補を失わず既存の形状条件で返す", () => {
  const input =
    "[a](../../../01_Discovery/Analysis/EXP-000001/exploration&bogus;.md)\n[b](../unknown&bogus;.md)";
  assert.deepEqual(parseUxFormalInputTargets(input, "synthetic"), [
    {
      target: "../../../01_Discovery/Analysis/EXP-000001/exploration&bogus;.md",
      invalidEntity: true,
    },
    { target: "../unknown&bogus;.md", invalidEntity: false },
    {
      target: "01_Discovery/Analysis/EXP-000001/exploration&bogus;.md",
      invalidEntity: true,
    },
  ]);
});

/**
 * Escape・コメント・Fenceを候補根拠へ戻さないことを検証する。
 *
 * @responsibility 非表示・escape済みの参照を正式入力と誤認しない既存前処理を固定する。
 * @trace RCM-UT-001
 * @precondition 固定した三つの除外形式を含む本文を使う。
 * @stimulus UX参照解析を呼び出す。
 * @observation 返却候補の全体を取得する。
 * @oracle 空配列であり、空のRootにも外部観測を行わない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の文字列計算である。
 */
test("Escapeと非表示領域の参照は候補へ戻さない", () => {
  const input =
    "\\[ignore](../one.md)\n<!-- [ignore](../two.md) -->\n```\n[ignore](../three.md)\n```";
  assert.deepEqual(parseUxFormalInputTargets(input, ""), []);
  assert.deepEqual(parseUxFormalInputTargets("", "synthetic"), []);
});
