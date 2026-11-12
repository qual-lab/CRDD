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
import { inspectRealityTestCatalog } from "../../../src/index.ts";

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
  assert.equal(
    inspectRealityTestCatalog({ tests: [] }, "catalog.json").status,
    "complete",
  );
  const accepted = inspectRealityTestCatalog(
    {
      extra: true,
      tests: [
        { id: "", owner: "", path: "", unknown: true },
        { id: "", owner: "", path: "other" },
      ],
    },
    "catalog.json",
  );
  assert.equal(accepted.status, "complete");
  assert.deepEqual(
    [...(accepted.result ?? new Map())],
    [
      ["", { owner: "", testId: "" }],
      ["other", { owner: "", testId: "" }],
    ],
  );
  const rejected = inspectRealityTestCatalog(
    {
      tests: [
        null,
        { id: "", owner: "", path: "" },
        { id: "second", owner: "sample", path: "" },
        { owner: "sample" },
      ],
    },
    "catalog.json",
  );
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
    inspectRealityTestCatalog({}, "catalog.json").issues[0]?.kind,
    "catalog.tests.array-missing",
  );
});
