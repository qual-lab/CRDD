/**
 * Markdown参照先の抽出・分解の既存意味を検証する。
 *
 * @packageDocumentation
 * @responsibility 走査順・重複・Label後勝ちとURI Decodeの失敗保持を固定する。
 * @trace RCM-UT-001
 * @level UT
 * @scope artifact、markdown、links
 * @boundary RCM-UT-001=N/A: 文字列入力だけを扱い外部I/Oを行わない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  parseMarkdownLinkReference,
  parseMarkdownLinkTargets,
} from "../../../src/index.ts";

/**
 * 三形式の走査順・重複・Label後勝ちを検証する。
 *
 * @responsibility Fence除外とコメント保持を含む従来の抽出範囲を固定する。
 * @trace RCM-UT-001
 * @precondition Inline、参照形式、短縮参照、重複定義を含む固定本文を使う。
 * @stimulus 参照先抽出APIを二度呼び出す。
 * @observation 返却配列の文字列と順序を取得する。
 * @oracle 固定期待値と一致し、並替え・重複排除・新しい構文対応を行わない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同一Process内の純粋解析である。
 */
test("参照先は三走査順と重複Labelの後勝ちを維持する", () => {
  const input = [
    "[R][ref]",
    "[inline](first.md)",
    "[C][]",
    "[Short]",
    "![pic](image.png)",
    "<!-- [comment](comment.md) -->",
    "[ref]: old.md",
    "[REF]: new.md",
    "[c]: duplicate.md",
    "[short]: shortcut.md",
    "```",
    "[hidden](hidden.md)",
    "```",
  ].join("\n");
  // 参照形式の後ろのLabelが短縮参照として再走査される既存挙動も維持する。
  const expectedLinks = [
    "first.md",
    "comment.md",
    "new.md",
    "duplicate.md",
    "new.md",
    "shortcut.md",
  ];
  assert.deepEqual(parseMarkdownLinkTargets(input), expectedLinks);
  assert.deepEqual(parseMarkdownLinkTargets(input), expectedLinks);
  assert.deepEqual(
    parseMarkdownLinkTargets(
      "[label][ Mixed   Case ]\n[mixed case]: target.md",
    ),
    ["target.md", "target.md"],
  );
  assert.deepEqual(
    parseMarkdownLinkTargets("[unknown]\n![image](image.md)"),
    [],
  );
});

/**
 * 参照分解と一度だけのDecodeを検証する。
 *
 * @responsibility 山括弧・Title・最初の#、空参照と二重Encodingの扱いを確認する。
 * @trace RCM-UT-001
 * @precondition 固定参照文字列を使う。
 * @stimulus 参照分解APIを呼び出す。
 * @observation target、anchor、decodeErrorを取得する。
 * @oracle 既存の順序で分解され、Path正規化・存在判定が追加されない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同一Process内の純粋解析である。
 */
test("参照文字列は分割後に一度だけDecodeする", () => {
  assert.deepEqual(
    parseMarkdownLinkReference(' <a%20b.md#%E6%97%A5> "title" '),
    { target: "a b.md", anchor: "日", decodeError: false },
  );
  assert.deepEqual(parseMarkdownLinkReference('file.md#first#second "title"'), {
    target: "file.md",
    anchor: "first#second",
    decodeError: false,
  });
  assert.deepEqual(parseMarkdownLinkReference("%252e%252e/file%23name.md"), {
    target: "%2e%2e/file#name.md",
    anchor: "",
    decodeError: false,
  });
  assert.deepEqual(parseMarkdownLinkReference("#anchor"), {
    target: "",
    anchor: "anchor",
    decodeError: false,
  });
  assert.deepEqual(parseMarkdownLinkReference(""), {
    target: "",
    anchor: "",
    decodeError: false,
  });
  assert.deepEqual(parseMarkdownLinkReference("../outside.md"), {
    target: "../outside.md",
    anchor: "",
    decodeError: false,
  });
});

/**
 * Decode失敗時に元文字列と他方の成功結果を保持することを検証する。
 *
 * @responsibility 不正Encodingを例外や空値へ丸めない契約を固定する。
 * @trace RCM-UT-001
 * @precondition targetまたはAnchorの一方だけが不正な固定参照を使う。
 * @stimulus 参照分解APIを呼び出す。
 * @observation 部分成功とdecodeErrorを取得する。
 * @oracle 不正な側は元文字列、正しい側はDecodeした文字列を返す。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同一Process内の純粋解析である。
 */
test("不正Encodingでも他方のDecode結果を失わない", () => {
  assert.deepEqual(parseMarkdownLinkReference("bad%ZZ#%E6%97%A5"), {
    target: "bad%ZZ",
    anchor: "日",
    decodeError: true,
  });
  assert.deepEqual(parseMarkdownLinkReference("good%20file.md#bad%"), {
    target: "good file.md",
    anchor: "bad%",
    decodeError: true,
  });
});
