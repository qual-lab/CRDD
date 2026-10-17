/**
 * 任意配布で用いる固定Runtime textのcheckout表現を確認する。
 * @packageDocumentation
 * @responsibility Nativeの技術試験から分離した固定textのLF・終端条件だけを確認する。
 * @trace ERB-IT-001
 * @level IT
 * @scope 現在のgitattributesと固定Runtime textのbytes。
 * @boundary ERB-IT-001=Direct Boundary: Repository checkout→配布入力。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

/**
 * 署名対象の固定textはWindows checkoutでもLFを維持するを検証する。
 *
 * @responsibility 署名対象の固定textはWindows checkoutでもLFを維持するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名対象の固定textはWindows checkoutでもLFを維持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名対象の固定textはWindows checkoutでもLFを維持する", () => {
  const attributes = fs.readFileSync(
    new URL("../../../../.gitattributes", import.meta.url),
    "utf8",
  );
  const attributeLines = new Set(attributes.trimEnd().split("\n"));
  assert.equal(attributeLines.has("* text=auto eol=lf"), true);
  assert.equal(
    attributeLines.has(
      "40_Develop/coordinator/tests/fixtures/general-task-verification.txt text eol=lf",
    ),
    true,
  );
  const bytes = fs.readFileSync(
    new URL("../fixtures/general-task-verification.txt", import.meta.url),
  );
  assert.equal(bytes.includes(0x0d), false);
  assert.equal(bytes.at(-1), 0x0a);
});
