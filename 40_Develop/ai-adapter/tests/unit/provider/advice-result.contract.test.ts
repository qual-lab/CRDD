/**
 * 助言内容の閉形式と許可参照を確認する。
 * @packageDocumentation
 * @responsibility Provider Envelopeとは独立に内容Schemaを反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 合成JSONのみ。外部AI・Docker・保存なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseAdviceReferences } from "../../../src/index.ts";

import {
  parseAdviceResult as normalizeAdviceResult,
  describeAdviceResultContract,
} from "../../../src/provider/advice-result.ts";

/**
 * 読取り助言の単一JSONを許可済み根拠参照へ拘束するを検証する。
 *
 * @responsibility 読取り助言の単一JSONを許可済み根拠参照へ拘束するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言の単一JSONを許可済み根拠参照へ拘束するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: Executor Test Source→対象契約
 */
test("読取り助言の単一JSONを許可済み根拠参照へ拘束する", () => {
  const raw = JSON.stringify({
    status: "completed",
    facts: [{ text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] }],
    sharedAnalysis: [],
    additionalInferences: [
      { text: "日程リスク", references: ["99_Roadmap/01_Roadmap.md#risk"] },
    ],
    nextOptions: [
      { text: "次の確認", references: ["PROJECT_CONTEXT.md#next"] },
    ],
  });
  const result = normalizeAdviceResult(raw, [
    "PROJECT_CONTEXT.md#current",
    "99_Roadmap/01_Roadmap.md#risk",
    "PROJECT_CONTEXT.md#next",
  ]);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult?.facts, [
    { text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] },
  ]);
  assert.equal(result.rawOutputReported, false);
});

/**
 * 読取り投影外参照・根拠なし・曖昧JSONを拒否するを検証する。
 *
 * @responsibility 読取り投影外参照・根拠なし・曖昧JSONを拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り投影外参照・根拠なし・曖昧JSONを拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: Executor Test Source→対象契約
 */
test("読取り投影外参照・根拠なし・曖昧JSONを拒否する", () => {
  const fixture = {
    status: "completed",
    facts: [{ text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] }],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  };
  const allowedResults = ["PROJECT_CONTEXT.md#current"];
  for (const change of [
    { contract: "crdd-coordinator/workbench-ai-advice-result" },
    { contract: "unknown/advice-result" },
    { contractRevision: 2 },
    { contract: null },
  ]) {
    assert.equal(
      normalizeAdviceResult(
        JSON.stringify({ ...fixture, ...change }),
        allowedResults,
      ).status,
      "blocked",
    );
  }
  assert.equal(
    normalizeAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "推測", references: ["SECRET.md#unknown"] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "根拠なし", references: [] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      `${JSON.stringify(fixture)}${JSON.stringify(fixture)}`,
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      '{"contract":"crdd-executor/advice-result","contract":"duplicate"}',
      allowedResults,
    ).status,
    "blocked",
  );
});

/**
 * 読取り助言結果契約は上限と生出力非公開を固定するを検証する。
 *
 * @responsibility 読取り助言結果契約は上限と生出力非公開を固定するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言結果契約は上限と生出力非公開を固定するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: Executor Test Source→対象契約
 */
test("読取り助言結果契約は上限と生出力非公開を固定する", () => {
  const contract = describeAdviceResultContract();
  assert.equal("contractRevision" in contract, false);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.outOfProjectionReferencesAllowed, false);
  assert.equal(contract.rawOutputReported, false);
});

/**
 * 許可参照の検査と不変コピーを準備・内容解析の共通条件として確認する。
 * @responsibility 独自のExecutor上限を復活させず、動的入力と変更混入を拒否する。
 * @trace ERB-UT-023
 * @precondition 合成の文字列と配列だけを使う。
 * @stimulus 件数・byte境界、空白・重複・hole・symbol・accessor・Proxy・元値変更。
 * @observation 凍結配列、解析の受理・拒否、getter／Proxy評価零。
 * @oracle 256・257・1024件は受理、1025件と不正形は拒否し、元配列と分離する。
 * @cleanup N/A: 外部資源なし。
 */
test("助言の許可参照は一つの内容規則で検査され元配列から分離される", () => {
  const raw = JSON.stringify({
    status: "completed",
    facts: [{ text: "synthetic", references: ["ref-0"] }],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  });
  for (const count of [256, 257, 1024, 1025]) {
    const references = Array.from(
      { length: count },
      (_, index) => `ref-${index}`,
    );
    assert.equal(
      parseAdviceReferences(references).status === "confirmed",
      count <= 1024,
    );
    assert.equal(
      normalizeAdviceResult(raw, references).status,
      count <= 1024 ? "confirmed" : "blocked",
    );
  }
  assert.equal(parseAdviceReferences(["é".repeat(256)]).status, "confirmed");
  let calls = 0;
  const dynamic = Object.defineProperty(["ref-0"], "0", {
    enumerable: true,
    get() {
      calls++;
      throw Error("must_not_evaluate");
    },
  });
  for (const value of [
    null,
    [],
    new Array(1),
    [""],
    [" ref-0"],
    ["ref-0 "],
    ["x\0"],
    ["x".repeat(513)],
    ["ref-0", "ref-0"],
    dynamic,
    Object.assign(["ref-0"], { extra: true }),
    Object.assign(["ref-0"], { [Symbol("extra")]: true }),
    new Proxy(["ref-0"], {
      getPrototypeOf() {
        calls++;
        throw Error("must_not_evaluate");
      },
      ownKeys() {
        calls++;
        throw Error("must_not_evaluate");
      },
    }),
  ]) {
    assert.equal(parseAdviceReferences(value).status, "blocked");
  }
  assert.equal(calls, 0);
  const original = ["ref-0"];
  const result = parseAdviceReferences(original);
  assert.equal(result.status, "confirmed");
  const parsed = result.references;
  assert.deepEqual(parsed, original);
  assert.notStrictEqual(parsed, original);
  assert.ok(Object.isFrozen(parsed));
  original[0] = "changed";
  assert.deepEqual(parsed, ["ref-0"]);
});
