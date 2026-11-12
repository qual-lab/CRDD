/**
 * Markdown Anchorの決定論的な本文解析を検証する。
 *
 * @packageDocumentation
 * @responsibility 可視文字、重複、明示Anchor、Fenceの既存解析意味を固定する。
 * @trace RCM-UT-001
 * @level UT
 * @scope artifact、markdown、anchors
 * @boundary RCM-UT-001=N/A: 文字列入力と返却値だけを比較し外部I/Oを行わない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  omitMarkdownFencedCode,
  parseMarkdownAnchors,
} from "../../../src/index.ts";

/**
 * Unicode・可視文字・重複と明示Anchorの解析結果を検証する。
 *
 * @responsibility 既存CheckerのAnchor生成規則を公開Domain APIから照合する。
 * @trace RCM-UT-001
 * @precondition Source内に固定したMarkdown本文を使う。
 * @stimulus 同じ本文を二度解析する。
 * @observation 返却集合の要素と順序を取得する。
 * @oracle 期待するAnchor列と二度の結果が完全一致する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-001=N/A: 同一Process内の純粋計算だけを扱う。
 */
test("Markdown Anchorは可視文字と重複順を維持する", () => {
  const content = [
    '<a id="explicit"></a>',
    "# 日本語、見出し。",
    "# snake_case_value",
    "# _Helpful_ **text** ~~label~~",
    "# [Link label](target.md) ![Image](image.png)",
    "# <span>HTML label</span>",
    "# ``code`inner_value``",
    "# Foo",
    "# Foo-1",
    "# Foo",
    "# 😄",
    "# Alpha  Beta",
    "# 😄 emoji",
    "# emoji 😄",
  ].join("\n");
  const expectedAnchors = [
    "explicit",
    "日本語見出し",
    "snake_case_value",
    "helpful-text-label",
    "link-label-image",
    "html-label",
    "codeinner_value",
    "foo",
    "foo-1",
    "foo-2",
    "alpha--beta",
    "-emoji",
    "emoji-",
  ];
  const first = parseMarkdownAnchors(content);
  assert.deepEqual([...first], expectedAnchors);
  assert.deepEqual([...parseMarkdownAnchors(content)], expectedAnchors);
  first.clear();
  assert.deepEqual([...parseMarkdownAnchors(content)], expectedAnchors);
});

/**
 * Fenceの種類・長さ・未閉鎖と改行の扱いを検証する。
 *
 * @responsibility 非表示見出しをAnchorへ戻さず、行位置を維持する条件を確認する。
 * @trace RCM-UT-001
 * @precondition CRLF、長いFence、短い閉じ候補と未閉鎖Fenceを含む固定本文を使う。
 * @stimulus Fence除外とAnchor解析を実行する。
 * @observation 返却本文、行数とAnchor集合を取得する。
 * @oracle Fence外だけの期待値と完全一致し、入力は変更されない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-001=N/A: 同一Process内の純粋計算だけを扱う。
 */
test("Markdown Fence内と未閉鎖以降の見出しはAnchorにならない", () => {
  const lines = [
    "# Visible",
    "````md",
    "# Hidden",
    "```",
    "# Still hidden",
    "````",
    "~~~",
    "# Hidden too",
    "~~~",
    "# Final",
    "```",
    "# Unclosed",
  ];
  const content = lines.join("\r\n");
  assert.deepEqual([...parseMarkdownAnchors(content)], ["visible", "final"]);
  assert.equal(
    omitMarkdownFencedCode(content),
    ["# Visible", "", "", "", "", "", "", "", "", "# Final", "", ""].join("\n"),
  );
  assert.equal(
    omitMarkdownFencedCode(content).split("\n").length,
    lines.length,
  );
  assert.equal(content, lines.join("\r\n"));
  assert.deepEqual([...parseMarkdownAnchors("")], []);
});
