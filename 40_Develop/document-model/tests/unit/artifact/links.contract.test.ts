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
import { buildArtifactGraph } from "../../../src/artifact/graph.ts";

import {
  parseArtifact,
  parseMarkdownLinkReference,
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
  assert.deepEqual(
    parseArtifact({ path: "fixture.md", content: input }).result.links.map(
      (link) => link.target,
    ),
    expectedLinks,
  );
  assert.deepEqual(
    parseArtifact({ path: "fixture.md", content: input }).result.links.map(
      (link) => link.target,
    ),
    expectedLinks,
  );
  assert.deepEqual(
    parseArtifact({
      path: "fixture.md",
      content: "[label][ Mixed   Case ]\n[mixed case]: target.md",
    }).result.links.map((link) => link.target),
    ["target.md", "target.md"],
  );
  assert.deepEqual(
    parseArtifact({
      path: "fixture.md",
      content: "[unknown]\n![image](image.md)",
    }).result.links.map((link) => link.target),
    [],
  );
});

/**
 * 旧参照注記の出現単位と非発火表記を検証する。
 * @responsibility 通常参照・Related・参照定義との混在で除外範囲が広がらないことを固定する。
 * @trace RCM-UT-001
 * @precondition 同一target、参照形式、コード、コメント、エスケープを含む本文を使う。
 * @stimulus Artifact完成Parseを呼ぶ。
 * @observation linksのtarget・historical・relatedを比較する。
 * @oracle 注記したInline出現だけhistoricalであり、通常参照と既存順序を保持する。
 * @cleanup N/A: 純粋値のみ。
 */
test("旧参照注記は可視Inline出現だけを分類し参照定義へ二重解決しない", () => {
  const source = [
    "Related:",
    "- [旧参照][related](related.md)",
    "",
    "[旧参照][label](same.md)",
    "[current](same.md)",
    "[旧参照] [space](space.md)",
    "\\[旧参照][escaped](escaped.md)",
    "`[旧参照][code](code.md)`",
    "<!-- [旧参照][comment](comment.md) -->",
    "[旧参照][referenced][ref]",
    "[label]: accidental.md",
    "[ref]: reference.md",
    "```md",
    "[旧参照][hidden](hidden.md)",
    "```",
  ].join("\n");
  const links = parseArtifact({ path: "Evidence/result.md", content: source })
    .result.links;
  assert.deepEqual(
    links.filter((link) => link.historical),
    [
      { target: "related.md", historical: "invalid", related: true },
      { target: "same.md", historical: "declared", related: false },
    ],
  );
  assert.equal(links.filter((link) => link.target === "same.md").length, 2);
  assert.equal(
    links.some((link) => link.target === "accidental.md"),
    false,
  );
  assert.equal(
    links.some((link) => link.target === "hidden.md"),
    false,
  );
  for (const target of [
    "space.md",
    "escaped.md",
    "code.md",
    "comment.md",
    "reference.md",
  ])
    assert.ok(
      links.some((link) => link.target === target && !link.historical),
      target,
    );
});

/**
 * 旧参照と現行関係の区別を単独ParseとGraphで検証する。
 * @responsibility 注記した同一出現だけを除き、不適用注記の関係を保持する。
 * @trace RCM-UT-001
 * @precondition 同一targetの通常／旧参照、行内コメントとRelatedを含む本文を使う。
 * @stimulus 完成Parseのモデルを既存Graphへ渡す。
 * @observation 関係数・位置・局所Issue・incoming集合を取得する。
 * @oracle 履歴本文の旧参照だけ非activeとし、不適用はpartialと通常関係を保持する。
 * @cleanup N/A: 純粋値のみ。
 */
test("旧参照は同じ出現の現在関係だけを除き誤用は局所Issueと通常関係を保持する", () => {
  const content =
    "# History\n<!-- comment --> [旧参照][UX-000001](target.md) [UX-000001](target.md)\n";
  const historical = parseArtifact({ path: "Evidence/result.md", content });
  assert.equal(historical.result.relations.length, 1);
  assert.equal(historical.result.relations[0]?.location.line, 2);
  const target = parseArtifact({ path: "target.md", content: "# UX-000001\n" });
  const graph = buildArtifactGraph({
    artifacts: [historical.result, target.result],
  });
  assert.ok(graph.result);
  assert.deepEqual(graph.result.incoming.get("UX-000001"), [historical.result]);
  for (const source of [
    { path: "current.md", content: "[旧参照][UX-000001](target.md)" },
    {
      path: "Evidence/related.md",
      content: "Related:\n- [旧参照][UX-000001](target.md)",
    },
  ]) {
    const outcome = parseArtifact(source);
    assert.equal(outcome.status, "partial");
    assert.ok(
      outcome.issues.some(
        (issue) =>
          issue.kind === "artifact.link.historical-reference-not-allowed",
      ),
    );
    assert.equal(outcome.result.relations.length, 1);
  }
  const ordinary = parseArtifact({
    path: "current.md",
    content:
      "    ```\n[REQ-000002](hidden.md)\n    ```\n[REQ-<!-- comment -->000001](target.md)\n",
  });
  assert.deepEqual(
    ordinary.result.relations.map((relation) => relation.target),
    ["REQ-000001"],
  );
  const synthetic = parseArtifact({
    path: "Evidence/result.md",
    content: "[旧<!-- comment -->参照][REQ-000001](target.md)",
  });
  assert.equal(synthetic.result.relations.length, 1);
  const unicode = parseArtifact({
    path: "Evidence/result.md",
    content:
      "# History\r\n😀<!-- comment --> [旧参照][REQ-000001](target.md) [REQ-000001](target.md)\r\n",
  });
  assert.equal(unicode.result.relations.length, 1);
  const codeLabel = parseArtifact({
    path: "Evidence/result.md",
    content:
      "[旧参照][`source.ts`](source.ts) [normal](source.ts)\n`[旧参照][label](code.md)`\n<!-- [旧参照][label](comment.md) -->\n[旧参照]<!-- gap -->[label](gap.md)",
  });
  assert.deepEqual(
    codeLabel.result.links
      .filter((link) => link.historical === "declared")
      .map((link) => link.target),
    ["source.ts"],
  );
  assert.equal(
    codeLabel.result.links.filter((link) => link.target === "source.ts").length,
    2,
  );
  for (const target of [
    "<https://example.invalid>",
    'https://example.invalid "title"',
    "%68ttps://example.invalid",
  ]) {
    const external = parseArtifact({
      path: "Evidence/result.md",
      content: `[旧参照][external](${target})`,
    });
    assert.equal(external.result.links[0]?.historical, "invalid", target);
    assert.ok(
      external.issues.some(
        (issue) =>
          issue.kind === "artifact.link.historical-reference-not-allowed",
      ),
    );
  }
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
