/**
 * Reality用登録対応の限定検査を確認する。
 * @packageDocumentation
 * @responsibility 現行受理集合、全走査順と部分Map非公開を検証する。
 * @trace PPR-UT-017
 * @level UT
 * @scope reality、catalog
 * @boundary PPR-UT-017=N/A: JSON解析済み合成値の同期検査。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseRealityTestCatalog } from "../../../src/index.ts";
import { extractRealitySymbolAnnotations } from "../../../src/reality-traceability/annotations.ts";

test("注釈は言語別の構文に依存せず、行全体の宣言だけを読む", () => {
  const lines = [
    "  // @crdd ARCH-000001",
    "# @crdd ARCH-000002",
    "-- @crdd ARCH-000003",
    "/* @crdd QA-000004 */",
    "<!-- @crdd QA-000005 -->",
    "; @crdd QA-000006",
    'const text = "// @crdd QA-000091";',
    '"// @crdd QA-000092',
    "'# @crdd QA-000093",
    "\x60# @crdd QA-000094",
    "value // @crdd QA-000095",
    "///// @crdd QA-000096",
    "// @crdd QA-000097 trailing text",
    " @crdd QA-000098",
  ];
  const result = extractRealitySymbolAnnotations(lines.join("\r\n"));
  assert.deepEqual(
    [...result.archIds],
    ["ARCH-000001", "ARCH-000002", "ARCH-000003"],
  );
  assert.deepEqual([...result.qaIds], ["QA-000004", "QA-000005", "QA-000006"]);
});

/**
 * 限定検査の受理集合と全走査の拒否順を確認する。
 * @responsibility 通常Catalogの厳密条件を追加せず部分Mapを公開しないことを確認する。
 * @trace PPR-UT-017
 * @precondition 空配列・空文字・未知fieldと複数不正を含む合成値を使う。
 * @stimulus Reality用の登録対応検査を呼ぶ。
 * @observation OutcomeとIssue順、登録Mapを取得する。
 * @oracle 正常値は受理し、全不正を順に返して結果Mapをnullとする。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary PPR-UT-017=N/A: 同期モデル検査。
 */
test("Reality登録は限定条件を保ち不正時に部分Mapを返さない", () => {
  const invalidJson = parseRealityTestCatalog({
    path: "catalog.json",
    content: "{",
  });
  assert.equal(invalidJson.status, "invalid");
  assert.equal(invalidJson.result, null);
  assert.deepEqual(
    invalidJson.issues.map((issue) => issue.kind),
    ["catalog.json.invalid"],
  );
  assert.equal(
    parseRealityTestCatalog({
      path: "catalog.json",
      content: JSON.stringify({ tests: [] }),
    }).status,
    "complete",
  );
  const accepted = parseRealityTestCatalog({
    path: "catalog.json",
    content: JSON.stringify({
      extra: true,
      tests: [
        { id: "", owner: "", path: "", unknown: true },
        { id: "", owner: "", path: "other" },
      ],
    }),
  });
  assert.equal(accepted.status, "complete");
  assert.deepEqual(
    [...(accepted.result ?? new Map())],
    [
      ["", { owner: "", testId: "" }],
      ["other", { owner: "", testId: "" }],
    ],
  );
  const rejected = parseRealityTestCatalog({
    path: "catalog.json",
    content: JSON.stringify({
      tests: [
        null,
        { id: "", owner: "", path: "" },
        { id: "second", owner: "sample", path: "" },
        { owner: "sample" },
      ],
    }),
  });
  assert.equal(rejected.result, null);
  assert.deepEqual(
    rejected.issues.map((i) => i.kind),
    [
      "catalog.entry.fields-invalid",
      "catalog.path.duplicate",
      "catalog.entry.fields-invalid",
    ],
  );
  assert.equal(rejected.issues[1]?.details.testPath, "");
  assert.equal(
    parseRealityTestCatalog({
      path: "catalog.json",
      content: JSON.stringify({}),
    }).issues[0]?.kind,
    "catalog.tests.array-missing",
  );
});
