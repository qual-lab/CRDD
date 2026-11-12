/**
 * 試験計画と観測済み結果の純粋な集約を確認する。
 * @packageDocumentation
 * @responsibility 実行Callbackなしで順序・条件・結果の区別を検査する。
 * @trace CQS-UT-010
 * @level UT
 * @scope catalog、plan、result
 * @boundary CQS-UT-010=N/A: 固定入力の同期計算のみ。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateRegressionStageResults,
  buildRegressionStagePlan,
  normalizeExplicitChangedPaths,
} from "../../../src/index.ts";

/**
 * 人間確認とWindows専用条件の段階を計画へ保持する。
 * @responsibility 順序を返すことと起動を区別する。
 * @trace CQS-UT-010
 * @precondition 二種類の固定試験情報。
 * @stimulus 段階計画を構築する。
 * @observation 段階順と条件。
 * @oracle Windows専用と手動UATを明示する。
 * @cleanup N/A: 局所計算のみ。
 * @boundary N/A: Process内計算。
 */
test("計画は段階順と人間確認を保ち起動機構を必要としない", () => {
  const plan = buildRegressionStagePlan(
    [
      {
        owner: "checker",
        level: "integration",
        path: "sample.ts",
        executionProfiles: ["windows_process_control"],
      },
      {
        owner: "checker",
        level: "acceptance",
        path: "human.ts",
        humanInput: true,
      },
    ],
    ["sample.ts"],
    true,
  );
  assert.deepEqual(
    plan.map((entry) => entry.stage),
    [
      "static",
      "unit",
      "integration",
      "windows_process_control",
      "system",
      "acceptance",
    ],
  );
  assert.equal(plan.at(-1)?.execution, "human_input_required");
  for (const invalid of ["../x", "C:/x", "/x", "./x", "x\\y", "x//y", "x/../y"])
    assert.throws(() => normalizeExplicitChangedPaths([invalid]));
  assert.deepEqual(normalizeExplicitChangedPaths(["a/b", "a/b"]), ["a/b"]);
});

/**
 * 観測済み失敗と人間待ちを完了へ変換しない。
 * @responsibility 純粋集約と自動実行を混同しない。
 * @trace CQS-UT-010
 * @precondition 同一計画に対応する観測済み結果。
 * @stimulus 結果を集約する。
 * @observation status・理由・終了値。
 * @oracle 失敗を優先、人間待ちはblocked、全完了だけcompleted。
 * @cleanup N/A: 計算のみ。
 * @boundary N/A: Process内計算。
 */
test("結果モデルは失敗と人間待ちを全体完了へ丸めない", () => {
  const common = {
    stage: "unit" as const,
    owners: ["checker"],
    selected: ["sample"],
    selectionReason: "synthetic",
    execution: "automatic" as const,
  };
  assert.equal(
    aggregateRegressionStageResults([
      { ...common, status: "completed", exitCode: 0 },
    ]).status,
    "completed",
  );
  assert.equal(
    aggregateRegressionStageResults([
      { ...common, status: "failed", exitCode: 7 },
      { ...common, status: "not_run_due_to_prior_stage", exitCode: null },
    ]).exitCode,
    7,
  );
  assert.equal(
    aggregateRegressionStageResults([
      { ...common, status: "not_run_due_to_human_input", exitCode: null },
    ]).reason,
    "regression_human_input_required",
  );
});
