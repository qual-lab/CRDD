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
import { parseProviderResult, planExecution } from "../../../src/index.ts";
import {
  describeAdviceResultContract,
  parseAdviceReferences,
  parseAdviceResult,
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
  const result = parseAdviceResult(raw, [
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
 * 大きい助言内容と許可参照を公開計画から同じ結果解析へ搬送する。
 * @responsibility 件数・本文量の独自拒否を撤去しexact参照と閉Schemaを維持する。
 * @trace ERB-UT-023
 * @precondition 外部Providerを呼ばず固定モデルと合成Envelopeを使う。
 * @stimulus 1025許可参照、65項目、17根拠、長文、4097JSONL通知を与える。
 * @observation 公開結果の全文と許可集合外参照の拒否。
 * @oracle 両Providerで同じ内容が受理され、未知参照と重複は拒否する。
 * @cleanup N/A: 同期値だけ。
 * @boundary 公開Plan→観測済み文字列→公開解析。
 */
test("助言結果は旧容量を超えても公開Planから両Providerへ接続する", () => {
  const references = Array.from(
    { length: 1025 },
    (_, index) => `ref-${index}-${"x".repeat(513)}`,
  );
  const content = {
    status: "completed",
    facts: Array.from({ length: 65 }, (_, index) => ({
      text: `${index}:${"考察".repeat(8193)}`,
      references: references.slice(0, 17),
    })),
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  };
  const json = JSON.stringify(content);
  assert.ok(Buffer.byteLength(json) > 262144);
  assert.equal(parseAdviceResult(json, references).status, "confirmed");
  for (const provider of ["codex", "claude"] as const) {
    const plan = planExecution({
      provider,
      purpose: "advice",
      modelSelection: {
        provider,
        modelIdentifier: provider === "claude" ? "opus" : "gpt-5.6-sol",
        identifierKind: provider === "claude" ? "alias" : "exact",
        reasoningEffort: "medium",
      },
      allowedReferences: references,
    });
    assert.equal(plan.status, "ready");
    if (plan.status !== "ready") throw Error("fixture_plan_blocked");
    assert.equal(
      /"max(?:Items|Length)"/u.test(JSON.stringify(plan.plan.resultContext)),
      false,
    );
    const stdout =
      provider === "claude"
        ? JSON.stringify({
            type: "result",
            subtype: "success",
            is_error: false,
            num_turns: 1,
            total_cost_usd: 0,
            structured_output: content,
          })
        : [
            ...Array.from({ length: 4097 }, () => ({
              type: "thread.started",
              thread_id: "synthetic",
            })),
            {
              type: "item.completed",
              item: { type: "agent_message", text: json },
            },
            { type: "turn.completed" },
          ]
            .map((event) => JSON.stringify(event))
            .join("\n");
    const parsed = parseProviderResult(plan, {
      exitCode: 0,
      stdout,
      stderr: "",
    });
    assert.equal(parsed.status, "confirmed", provider);
    assert.deepEqual(parsed.normalizedResult?.facts, content.facts);
  }
  for (const refs of [["unknown"], [references[0], references[0]], []])
    assert.equal(
      parseAdviceResult(
        JSON.stringify({
          ...content,
          facts: [{ text: "有効本文", references: refs }],
        }),
        references,
      ).status,
      "blocked",
    );
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
      parseAdviceResult(
        JSON.stringify({ ...fixture, ...change }),
        allowedResults,
      ).status,
      "blocked",
    );
  }
  assert.equal(
    parseAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "推測", references: ["SECRET.md#unknown"] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    parseAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "根拠なし", references: [] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    parseAdviceResult(
      `${JSON.stringify(fixture)}${JSON.stringify(fixture)}`,
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    parseAdviceResult(
      '{"contract":"crdd-executor/advice-result","contract":"duplicate"}',
      allowedResults,
    ).status,
    "blocked",
  );
});

/**
 * 読取り助言結果契約は参照境界と生出力非公開を固定する。
 *
 * @responsibility 参照境界と生出力非公開を固定する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言結果契約を取得する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: Executor Test Source→対象契約
 */
test("読取り助言結果契約は参照境界と生出力非公開を固定する", () => {
  const contract = describeAdviceResultContract();
  assert.equal("contractRevision" in contract, false);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.outOfProjectionReferencesAllowed, false);
  assert.equal(contract.rawOutputReported, false);
  for (const key of [
    "maximumRawBytes",
    "maximumItemsPerSection",
    "maximumReferencesPerItem",
  ])
    assert.equal(Object.hasOwn(contract, key), false);
});

/**
 * 許可参照の検査と不変コピーを準備・内容解析の共通条件として確認する。
 * @responsibility 独自のExecutor上限を復活させず、動的入力と変更混入を拒否する。
 * @trace ERB-UT-023
 * @precondition 合成の文字列と配列だけを使う。
 * @stimulus 件数・byte境界、空白・重複・hole・symbol・accessor・Proxy・元値変更。
 * @observation 凍結配列、解析の受理・拒否、getter／Proxy評価零。
 * @oracle 旧1024件を超えて受理し、不正形は拒否して元配列と分離する。
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
      true,
    );
    assert.equal(parseAdviceResult(raw, references).status, "confirmed");
  }
  assert.equal(parseAdviceReferences(["é".repeat(256)]).status, "confirmed");
  assert.equal(parseAdviceReferences(["x".repeat(513)]).status, "confirmed");
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
