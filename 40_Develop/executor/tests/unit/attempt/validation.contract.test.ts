/**
 * 単発実行の技術理由集合と一次故障の固定診断を検査する。
 * @packageDocumentation
 * @responsibility 発行理由の一意性・用途対応、未知理由と不正な報告値の拒否を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 固定理由・合成診断だけ。保存・回復処置は行わない。
 * @boundary Executorの技術理由・検証用診断。EMとの列一致はCoの接続試験が所有する。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { classifyDockerCommandExecution } from "../../../../docker-isolation/src/execution/result.ts";
import { isPrimaryFailureDiagnostic } from "../../../scripts/provider-diagnostic.ts";
import {
  ATTEMPT_COMPLETION_REASONS,
  convertCommandResult,
  isAttemptFailureReason,
  PURPOSES,
  SETUP_COMMAND_FAILURE_REASONS,
} from "../../../src/lifecycle/attempt.ts";

/**
 * ターン数の不正報告診断をProvider側の現行条件へ照合する。
 * @responsibility 上限2を再導入せず、正常な報告を不正診断として受け付けない。
 * @trace ERB-UT-023
 * @precondition 非秘密の合成診断だけ。
 * @stimulus safe integer境界、小数、零、非canonical数値文字列。
 * @observation 診断の受理可否。
 * @oracle 不正報告の数値条件はsafe integerかつ1以上の否定と一致する。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-UT-023=N/A: 型・合成値・有限依存の検査。実AI・Docker・保存なし。

 */
test("ターン不正診断は上限比較ではなく報告値の形式条件に一致する", () => {
  const diagnostic = {
    purpose: "start_provider_attached",
    stage: "provider_result_normalization",
    reason: "workbench_ai_claude_turn_count_invalid",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
    commandObservation: { exitCode: 0, stdoutBytes: 1, stderrBytes: 0 },
  };
  for (const [numberText, expected] of [
    ["1", false],
    ["3", false],
    ["100", false],
    ["1.5", true],
    ["0", true],
    ["-1", true],
    ["9007199254740992", true],
    ["01", false],
    ["1.0", false],
    ["NaN", false],
    ["Infinity", false],
  ] as const)
    assert.equal(
      isPrimaryFailureDiagnostic({
        ...diagnostic,
        turnCountDiagnostic: { valueType: "number", numberText },
      }),
      expected,
      numberText,
    );
});
/**
 * 技術理由の一意性・用途対応・未知拒否を純粋値で確認する。
 * @responsibility 発行元の値規則だけを確認し、EMとの対応は上位へ分離する。
 * @trace ERB-UT-023
 * @precondition 固定の発行理由と用途Mapを取得する。
 * @stimulus 全要素と未知・欠測・余剰の診断を照合する。
 * @observation 集合の一致と理由検査の受理結果。
 * @oracle 片側だけの理由や未知値を黙って受理しない。
 * @cleanup N/A: 保存処理・回復処置を呼ばない。
 * @boundary ERB-UT-023=N/A: 型・合成値・有限依存の検査。実AI・Docker・保存なし。
 */
test("技術理由は一意な用途Mapに対応し未知・欠測・余剰を拒否する", () => {
  for (const value of [
    ATTEMPT_COMPLETION_REASONS,
    PURPOSES,
    SETUP_COMMAND_FAILURE_REASONS,
  ])
    assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(
    Object.keys(SETUP_COMMAND_FAILURE_REASONS),
    PURPOSES.filter((purpose) => purpose !== "start_provider_attached"),
  );
  for (const reason of Object.values(SETUP_COMMAND_FAILURE_REASONS))
    assert.equal(isAttemptFailureReason(reason), true);
  assert.equal(
    new Set(ATTEMPT_COMPLETION_REASONS).size,
    ATTEMPT_COMPLETION_REASONS.length,
  );
  for (const reason of ATTEMPT_COMPLETION_REASONS)
    assert.equal(isAttemptFailureReason(reason), true);
  for (const reason of [
    null,
    undefined,
    "",
    "unknown",
    ...ATTEMPT_COMPLETION_REASONS.map((r) => r.toUpperCase()),
  ])
    assert.equal(isAttemptFailureReason(reason), false);
});

/**
 * Setup失敗Mapの未知用途と継承Propertyを固定の一般理由へ閉じる。
 * @responsibility 関数のinline化で用途判定を部分一致やprototype参照へ変えない。
 * @trace ERB-UT-023
 * @precondition 合成の非0終了観測のみ。
 * @stimulus 全Setup用途と未知値・prototype名を渡す。
 * @observation 元の固定理由とfallback。
 * @oracle 所有keyだけを採用し、継承値を理由へ昇格しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-UT-023=N/A: 型・合成値・有限依存の検査。実AI・Docker・保存なし。

 */
test("Setup失敗の変換はMap自身の用途だけを扱い未知・継承名を拒否する", () => {
  const observation = {
    status: 1,
    signal: null,
    stdout: "",
    stderr: "",
    outputExceeded: false,
  };
  const classification = classifyDockerCommandExecution(observation);
  for (const [purpose, reason] of Object.entries(SETUP_COMMAND_FAILURE_REASONS))
    assert.equal(
      convertCommandResult(observation, purpose, "claude", classification)
        .reason,
      reason,
    );
  for (const purpose of [
    "unknown",
    "__proto__",
    "constructor",
    "toString",
    "create_proxy_extra",
  ])
    assert.equal(
      convertCommandResult(observation, purpose, "claude", classification)
        .reason,
      "docker_setup_command_failed",
    );
});
