/**
 * Markdown本文の可視範囲・表・先頭Headerの解析を検証する。
 *
 * @packageDocumentation
 * @responsibility Checkerから移した純粋解析の受理範囲と返却値を固定する。
 * @trace RCM-UT-001
 * @level UT
 * @scope artifact、markdown、structure
 * @boundary RCM-UT-001=N/A: 固定文字列の純粋計算だけを比較し外部I/Oを行わない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isMarkdownTableSeparator,
  omitMarkdownCommentsAndFencedCode,
  omitMarkdownCommentsOutsideFencedCode,
  parseMarkdownTableRow,
  parseMarkdownFences,
  readCanonicalDocumentHeader,
} from "../../../src/index.ts";

/**
 * 可視本文二方式のコメント・Fence境界を検証する。
 *
 * @responsibility コメント幅、行位置、Fence内原文と未閉鎖を固定する。
 * @trace RCM-UT-001
 * @precondition CRLF、同一行・複数行コメントとFenceを含む固定本文を使う。
 * @stimulus 二つの可視本文APIを呼び出す。
 * @observation 返却文字列の全体を取得する。
 * @oracle 固定期待値と文字位置・行数が一致する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋計算である。
 */
test("可視本文はコメント幅とFence保持方針を区別する", () => {
  const input = "A<!--x-->B\r\n```\r\n<!-- keep -->\r\n```\r\nC";
  assert.equal(
    omitMarkdownCommentsAndFencedCode(input),
    `A${" ".repeat(8)}B\n\n\n\nC`,
  );
  assert.equal(
    omitMarkdownCommentsOutsideFencedCode(input),
    `A${" ".repeat(8)}B\n\x60\x60\x60\n<!-- keep -->\n\x60\x60\x60\nC`,
  );
  const comment = "x<!--\nhidden\n-->y";
  assert.equal(
    omitMarkdownCommentsAndFencedCode(comment),
    "x    \n      \n   y",
  );
  assert.equal(
    omitMarkdownCommentsOutsideFencedCode(comment),
    "x    \n      \n   y",
  );
  assert.equal(
    omitMarkdownCommentsAndFencedCode("x<!-- open\nend"),
    "x         \n   ",
  );
  assert.equal(
    omitMarkdownCommentsAndFencedCode("````\n```\n# hidden"),
    "\n\n",
  );
  assert.equal(
    omitMarkdownCommentsOutsideFencedCode("~~~\n<!-- raw"),
    "~~~\n<!-- raw",
  );
  assert.equal(
    omitMarkdownCommentsAndFencedCode("    ```\n# visible"),
    "    ```\n# visible",
  );
  assert.equal(
    omitMarkdownCommentsAndFencedCode("<!--x-->```\n# visible"),
    `${" ".repeat(8)}\x60\x60\x60\n# visible`,
  );
});

/**
 * 表行のEscape・Code Spanと区切り行を検証する。
 *
 * @responsibility 任意外Pipe、空Cell、Code内Pipe、nullと空配列の区別を確認する。
 * @trace RCM-UT-001
 * @precondition 固定した表行と期待するCell配列を使う。
 * @stimulus 表行解析と区切り行判定を呼び出す。
 * @observation 配列またはnullと判定booleanを取得する。
 * @oracle 既存の受理集合を維持し、独自の厳格化を行わない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋計算である。
 */
test("表行はEscapeとCode内Pipeを区切らない", () => {
  assert.deepEqual(parseMarkdownTableRow("| a | b |"), ["a", "b"]);
  assert.deepEqual(parseMarkdownTableRow(" a | b "), ["a", "b"]);
  assert.deepEqual(parseMarkdownTableRow("| a\\|b | `c|d` |"), ["a|b", "c|d"]);
  assert.deepEqual(parseMarkdownTableRow("| ``a`|b`` | |"), ["a|b", ""]);
  assert.deepEqual(parseMarkdownTableRow("| a \\|"), ["a |"]);
  assert.deepEqual(parseMarkdownTableRow("`a|b"), ["a|b"]);
  assert.equal(parseMarkdownTableRow("no table"), null);
  assert.deepEqual(parseMarkdownTableRow("|"), []);
  assert.equal(isMarkdownTableSeparator("| :--- | ---: |", 2), true);
  assert.equal(isMarkdownTableSeparator("| :--- | ---: |", 3), false);
  assert.equal(isMarkdownTableSeparator("| a |", 1), false);
  assert.equal(isMarkdownTableSeparator("|", 0), true);
});

/**
 * 先頭Headerの停止位置・順序・重複保持を検証する。
 *
 * @responsibility 値の検証ではなく本文抽出だけを行う公開契約を確認する。
 * @trace RCM-UT-001
 * @precondition BOM、Anchor、H1、空行、未知Key、重複Keyと本文を含む固定入力を使う。
 * @stimulus 先頭Headerの抽出APIを呼び出す。
 * @observation 返却Header文字列を取得する。
 * @oracle 最初の非Header行で停止し、値を補完せず順序・重複を保つ。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋計算である。
 */
test("先頭Headerは値を検証せず順序と重複を保つ", () => {
  const input =
    '\uFEFF<a id="top"></a>\r\n\r\n# Title\r\nVersion: v0.22\r\nVersion: bad\r\n\r\nUnknown Key: value\r\n## Body\r\nStatus: hidden';
  assert.equal(
    readCanonicalDocumentHeader(input),
    "Version: v0.22\nVersion: bad\nUnknown Key: value",
  );
  assert.equal(
    readCanonicalDocumentHeader("# Title\n本文\nVersion: hidden"),
    "",
  );
  assert.equal(
    readCanonicalDocumentHeader("# Title\n# Other\nVersion: hidden"),
    "",
  );
  assert.equal(
    readCanonicalDocumentHeader("Version:\nStatus: arbitrary"),
    "Version:\nStatus: arbitrary",
  );
  assert.equal(readCanonicalDocumentHeader(""), "");
  assert.equal(readCanonicalDocumentHeader(" Version: indented"), "");
});

/**
 * Fenceの行所属・終端・共有参照を検証する。
 * @responsibility 開始・終了行の分類と内容行のObject共有、呼出し間独立性を固定する。
 * @trace RCM-UT-001
 * @precondition 通常行、長いbacktick、大文字言語、短い閉じ候補を含む行列。
 * @stimulus RootのFence解析を二回呼ぶ。
 * @observation 全field、行位置、内容行参照と入力不変を取得する。
 * @oracle 短い候補は内容行、十分な同markerだけが閉じ、入力を変更しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 純粋な局所解析。
 */
test("Fence解析は行所属・閉鎖状態・内容行参照を維持する", () => {
  const lines = ["head", " ````YAML extra", "value", "```", "````\t", "tail"];
  const result = parseMarkdownFences(lines);
  assert.deepEqual(result.entries, [
    { index: 0, text: "head", outside: true, fenceId: null },
    { index: 1, text: " ````YAML extra", outside: false, fenceId: 0 },
    { index: 2, text: "value", outside: false, fenceId: 0 },
    { index: 3, text: "```", outside: false, fenceId: 0 },
    { index: 4, text: "````\t", outside: false, fenceId: 0 },
    { index: 5, text: "tail", outside: true, fenceId: null },
  ]);
  assert.deepEqual(result.fences, [
    {
      id: 0,
      marker: "`",
      length: 4,
      language: "yaml",
      start: 1,
      end: 4,
      closed: true,
      contents: result.entries.slice(2, 4),
    },
  ]);
  assert.equal(result.fences[0]?.contents[0], result.entries[2]);
  assert.notEqual(parseMarkdownFences(lines).entries[2], result.entries[2]);
  assert.deepEqual(lines, [
    "head",
    " ````YAML extra",
    "value",
    "```",
    "````\t",
    "tail",
  ]);
});

/**
 * 不成立開始行と未閉鎖Fenceを検証する。
 * @responsibility ASCII空白・info・異種marker・末尾文字の境界を固定する。
 * @trace RCM-UT-001
 * @precondition 四空白、tab、backtick入りinfo、空言語と未閉鎖の固定行列。
 * @stimulus RootのFence解析へ渡す。
 * @observation 行内外と未閉鎖の全fieldを取得する。
 * @oracle 不成立開始行を拒否せず通常行とし、異種・末尾文字では閉じない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 純粋な局所解析。
 */
test("Fence解析は不成立開始を通常行とし未閉鎖を保持する", () => {
  const result = parseMarkdownFences([
    "    ```",
    "\t```",
    "```bad`info",
    "~~~",
    "```",
    "~~~text",
  ]);
  assert.deepEqual(
    result.entries.map(({ outside: isOutside }) => isOutside),
    [true, true, true, false, false, false],
  );
  assert.deepEqual(result.fences, [
    {
      id: 0,
      marker: "~",
      length: 3,
      language: "",
      start: 3,
      end: null,
      closed: false,
      contents: result.entries.slice(4),
    },
  ]);
  assert.deepEqual(parseMarkdownFences([]), { entries: [], fences: [] });
});
