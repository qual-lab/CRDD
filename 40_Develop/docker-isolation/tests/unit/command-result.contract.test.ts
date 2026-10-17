/**
 * Docker Processの終了分類と有界出力判定を検証する。
 * @packageDocumentation
 * @responsibility 期限、終了値、Signal、UTF-8出力上限の純粋判定を反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope Processの共通観測値。実起動、実資源清掃、AI結果解釈は含まない。
 * @boundary N/A: 同Process内の固定値だけを扱う。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDockerCommandExecution,
  classifyDockerProcessExit,
  STDOUT_LIMIT_BYTES,
  STDERR_LIMIT_BYTES,
} from "../../src/index.ts";

/**
 * 技術結果の分類はAIの意味を含めず元の優先順と出力境界を保持する。
 * @responsibility 期限・出力超過・Signal・非0終了の混同を反証する。
 * @trace ERB-UT-023
 * @precondition 実Processではなく固定の観測値を使う。
 * @stimulus 期限、UTF-8上限、超過とSignalの共同発生を与える。
 * @observation 技術分類、byte数、不変性と本文の非複製を読む。
 * @oracle nullは期限、上限値は受理、超過はSignalより先、null終了は非0扱い。
 * @cleanup N/A: 入力文字列と純粋判定だけを扱う。
 * @boundary N/A: 同Process内の技術観測値の判定。
 */
test("コマンド結果は期限・UTF-8出力境界・Signal・終了値を分離する", () => {
  const base = Object.freeze({
    status: 0,
    signal: null,
    stdout: "",
    stderr: "",
    outputExceeded: false,
  });
  assert.deepEqual(classifyDockerCommandExecution(null), {
    category: "deadline_exceeded",
  });
  for (const [execution, expected] of [
    [base, "completed"],
    [{ ...base, status: null }, "nonzero_exit"],
    [{ ...base, status: 1 }, "nonzero_exit"],
    [{ ...base, signal: "SIGTERM" }, "signalled"],
    [
      { ...base, outputExceeded: true, signal: "SIGTERM" },
      "output_limit_exceeded",
    ],
    [{ ...base, stdout: "x".repeat(STDOUT_LIMIT_BYTES) }, "completed"],
    [{ ...base, stderr: "x".repeat(STDERR_LIMIT_BYTES) }, "completed"],
    [
      { ...base, stdout: `${"x".repeat(STDOUT_LIMIT_BYTES)}あ` },
      "output_limit_exceeded",
    ],
    [
      { ...base, stderr: `${"x".repeat(STDERR_LIMIT_BYTES)}あ` },
      "output_limit_exceeded",
    ],
  ] as const) {
    const result = classifyDockerCommandExecution(execution);
    assert.equal(result.category, expected);
    assert.equal(
      result.stdoutBytes,
      Buffer.byteLength(execution.stdout, "utf8"),
    );
    assert.equal(
      result.stderrBytes,
      Buffer.byteLength(execution.stderr, "utf8"),
    );
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.hasOwn(result, "stdout"), false);
    assert.equal(Object.hasOwn(result, "stderr"), false);
  }
  assert.deepEqual(base, {
    status: 0,
    signal: null,
    stdout: "",
    stderr: "",
    outputExceeded: false,
  });
});

/**
 * 終了値の機密を含まない分類を既存語彙へ固定する。
 * @responsibility Signal・未観測・代表終了値の投影を検証する。
 * @trace ERB-UT-023
 * @precondition 実Processではなく固定結果を使う。
 * @stimulus nullと代表終了値、終了0とSignalの共同値を与える。
 * @observation 分類文字列を読む。
 * @oracle Signalを優先し、未観測をzeroへ変換しない。
 * @cleanup N/A: 固定値の判定だけ。
 * @boundary N/A: 同Process内の純粋投影。
 */
test("終了値分類は未観測とSignalを成功へ丸めない", () => {
  assert.equal(classifyDockerProcessExit(null), "not_observed");
  for (const [status, expected] of [
    [null, "not_observed"],
    [0, "zero"],
    [1, "one"],
    [126, "one_two_six"],
    [127, "one_two_seven"],
    [2, "other_nonzero"],
  ] as const) {
    const execution = {
      status,
      signal: null,
      stdout: "",
      stderr: "",
      outputExceeded: false,
    };
    assert.equal(classifyDockerProcessExit(execution), expected);
    assert.equal(
      classifyDockerProcessExit({ ...execution, signal: "SIGTERM" }),
      "signal",
    );
  }
});
