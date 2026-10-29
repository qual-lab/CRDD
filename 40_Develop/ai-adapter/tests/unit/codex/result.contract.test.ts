/**
 * ai-adapter:unit:codex-structured-resultの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility ai-adapter:unit:codex-structured-resultが所有する検証責務を実行する。
 * @trace ERB-UT-032
 * @level UT
 * @scope codex、structured、result
 * @boundary ERB-UT-032=N/A: Provider結果の純粋解析・変換であり外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeCodexStructuredResultContract,
  normalizeCodexStructuredResult,
  parseProviderResult,
} from "../../../src/index.ts";

/** 内部エラー、ツール未使用、コマンド失敗を件数だけで区別し、採否は変えない。
 * @trace ERB-UT-032
 * @boundary N/A: メモリ内の合成JSONLだけを解析する。
 */
test("Task内部エラーはツール未使用と区別し本文を返さない", () => {
  for (const kind of ["none", "code_mode", "other", "command"] as const) {
    const events =
      kind === "none"
        ? []
        : kind === "command"
          ? [
              {
                type: "item.completed",
                item: {
                  type: "command_execution",
                  status: "failed",
                  exit_code: 1,
                  aggregated_output: "Permission denied",
                },
              },
            ]
          : [
              {
                type: "item.completed",
                item: {
                  type: "error",
                  message:
                    kind === "code_mode"
                      ? "Synthetic code mode unavailable"
                      : "Synthetic failure",
                },
              },
            ];
    const raw = [
      ...events,
      {
        type: "item.completed",
        item: {
          type: "agent_message",
          text: JSON.stringify({
            status: "completed",
            summary: "synthetic",
            changedPaths: [],
            verification: [],
          }),
        },
      },
      { type: "turn.completed" },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    const result = parseProviderResult({
      provider: "codex",
      purpose: "task",
      taskRole: "executor",
      raw,
    });
    assert.equal(result.status, "confirmed");
    assert.equal(
      result.codexExecutionObservation?.itemErrorCount,
      kind === "code_mode" || kind === "other" ? 1 : 0,
    );
    assert.equal(
      result.codexExecutionObservation?.itemErrorCodeModeCount,
      kind === "code_mode" ? 1 : 0,
    );
    assert.equal(
      result.codexExecutionObservation?.commandExecutionFailedCount,
      kind === "command" ? 1 : 0,
    );
    assert.equal(
      JSON.stringify(result.codexExecutionObservation).includes("Synthetic"),
      false,
    );
    assert.equal(result.rawOutputReported, false);
  }
});

/** 語句観測を区別し、本文・Path・秘密値を診断へ搬送しない。
 * @trace ERB-UT-032
 * @boundary N/A: 合成JSONLの純粋解析だけで外部Effectなし。
 */
test("内部エラーの語句観測は重複・未分類・欠測を区別する", () => {
  const cases: readonly [unknown, readonly string[]][] = [
    [
      "Code Mode host spawn failed: permission denied /secret/DO_NOT_RETAIN",
      ["Host", "Spawn", "Permission"],
    ],
    ["Code Mode handshake protocol mismatch", ["Protocol"]],
    ["Code Mode delegated tool unavailable", ["Tool"]],
    ["Code Mode connection closed: broken pipe EOF", ["Connection"]],
    [
      "Code Mode executable not found: no such file or directory",
      ["MissingPath"],
    ],
    ["Code Mode timed out: deadline exceeded", ["Timeout"]],
    ["Code Mode unavailable", []],
    [null, []],
  ];
  const signatures = new Set<string>();
  for (const [message, mentions] of cases) {
    const raw = [
      { type: "item.completed", item: { type: "error", message } },
      {
        type: "item.completed",
        item: {
          type: "agent_message",
          text: JSON.stringify({
            status: "completed",
            summary: "synthetic",
            changedPaths: [],
            verification: [],
          }),
        },
      },
      { type: "turn.completed" },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");
    const result = parseProviderResult({
      provider: "codex",
      purpose: "task",
      taskRole: "executor",
      raw,
    });
    assert.equal(result.status, "confirmed");
    const observed = result.codexExecutionObservation;
    assert.ok(observed);
    for (const name of [
      "Host",
      "Spawn",
      "Protocol",
      "Connection",
      "Tool",
      "Permission",
      "MissingPath",
      "Timeout",
    ])
      assert.equal(
        observed[`itemError${name}MentionCount`],
        mentions.includes(name) ? 1 : 0,
      );
    assert.equal(
      observed.itemErrorUnclassifiedCount,
      mentions.length === 0 ? 1 : 0,
    );
    assert.equal(observed.itemErrorCount, 1);
    assert.equal(JSON.stringify(observed).includes("DO_NOT_RETAIN"), false);
    assert.equal(JSON.stringify(observed).includes("/secret"), false);
    signatures.add(JSON.stringify(observed));
  }
  assert.equal(signatures.size, cases.length);
});

/** 既知警告文面との一致は元通知種別・非故障を表さず、総数も減算しない。
 * @trace ERB-UT-032
 * @boundary N/A: 同版の公開定型を合成JSONLへ投影する純粋試験。
 */
test("既知Warning文面は補助一致だけを返し未知のerrorを警告へ丸めない", () => {
  const unstable =
    "Under-development features enabled: code_mode, code_mode_only. Under-development features are incomplete and may behave unpredictably. To suppress this warning, set `suppress_unstable_features_warning = true` in /DO_NOT_RETAIN/config.toml.";
  const unsupported =
    "Code Mode is enabled in configuration, but model `synthetic-model` does not advertise Code Mode support. This may degrade model performance. Disable `features.code_mode` and `features.code_mode_only`, or select a model whose metadata enables Code Mode.";
  for (const [message, expected] of [
    [unstable, 1],
    [unsupported, 1],
    [`prefix ${unstable}`, 0],
    [`${unstable} extra`, 0],
    [`${unstable}\n`, 0],
    [unstable.replace("features enabled", "Features enabled"), 0],
    ["Code Mode unavailable", 0],
    [null, 0],
    [unstable.replace("/DO_NOT_RETAIN", `/${"x".repeat(4096)}`), 0],
  ] as const) {
    const observations: string[] = [];
    // CLIのWarning投影と同文の通常ErrorItemはJSONLでは区別できない。
    for (const _origin of ["warning_projection", "ordinary_error_item"]) {
      const raw = [
        { type: "item.completed", item: { type: "error", message } },
        {
          type: "item.completed",
          item: {
            type: "agent_message",
            text: JSON.stringify({
              status: "completed",
              summary: "synthetic",
              changedPaths: [],
              verification: [],
            }),
          },
        },
        { type: "turn.completed" },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n");
      const result = parseProviderResult({
        provider: "codex",
        purpose: "task",
        taskRole: "executor",
        raw,
      });
      assert.equal(result.status, "confirmed");
      const value = result.codexExecutionObservation;
      assert.ok(value);
      assert.equal(value.itemErrorKnownWarningTextCount, expected);
      assert.equal(value.itemErrorCount, 1);
      assert.equal(value.itemErrorUnclassifiedCount, 1);
      assert.equal(JSON.stringify(value).includes("DO_NOT_RETAIN"), false);
      observations.push(JSON.stringify(value));
    }
    assert.equal(observations[0], observations[1]);
  }
});

/**
 * Codexの単一exact Resultだけを正規化するを検証する。
 *
 * @responsibility Codexの単一exact Resultだけを正規化するの合否判定を所有する。
 * @trace ERB-UT-032
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codexの単一exact Resultだけを正規化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
 */
test("Codexの単一exact Resultだけを正規化する", () => {
  const result = normalizeCodexStructuredResult('{"status":true}\n');
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.rawOutputReported, false);
});

/**
 * false・余分なkey・重複key・複数documentを拒否するを検証する。
 *
 * @responsibility false・余分なkey・重複key・複数documentを拒否するの合否判定を所有する。
 * @trace ERB-UT-032
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus false・余分なkey・重複key・複数documentを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
 */
test("false・余分なkey・重複key・複数documentを拒否する", () => {
  for (const raw of [
    '{"status":false}',
    '{"status":true,"extra":true}',
    '{"status":true,"status":false}',
    '{"status":true}{"status":true}',
    "not-json",
  ]) {
    assert.equal(normalizeCodexStructuredResult(raw).status, "blocked");
  }
});

/**
 * 公開契約はraw出力非公開とbyte上限を固定するを検証する。
 *
 * @responsibility 公開契約はraw出力非公開とbyte上限を固定するの合否判定を所有する。
 * @trace ERB-UT-032
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はraw出力非公開とbyte上限を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
 */
test("公開契約はraw出力非公開とbyte上限を固定する", () => {
  const contract = describeCodexStructuredResultContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.maximumBytes, 16_384);
  assert.equal(contract.rawOutputReported, false);
});

/**
 * Codex結果の16KiB境界を実入力で確認する。
 *
 * @responsibility 容量契約値の記述と実際の受理・拒否境界が一致することを検証する。
 * @trace ERB-UT-032
 * @precondition 単一exact結果へJSONとして有効なASCII空白を付加する。
 * @stimulus UTF-8で16,383、16,384、16,385 bytesの入力を渡す。
 * @observation 入力bytes数、status、正規化値と生出力非公開を観測する。
 * @oracle 上限以下は同じexact結果を受理し、上限超過は本文なしで拒否する。
 * @cleanup N/A: 純粋な文字列解析で外部資源を生成しない。
 * @boundary ERB-UT-032=N/A: AI Adapter内の純粋解析・変換。
 */
test("Codex結果は16KiBを含む上限以下だけを受理する", () => {
  const document = '{"status":true}';
  for (const bytes of [16_383, 16_384, 16_385]) {
    const input = document + " ".repeat(bytes - Buffer.byteLength(document));
    assert.equal(Buffer.byteLength(input, "utf8"), bytes);
    const result = normalizeCodexStructuredResult(input);
    assert.deepEqual(result, {
      status: bytes <= 16_384 ? "confirmed" : "blocked",
      normalizedResult: bytes <= 16_384 ? { status: true } : null,
      rawOutputReported: false,
    });
    assert.equal("rawOutput" in result, false);
  }
});
