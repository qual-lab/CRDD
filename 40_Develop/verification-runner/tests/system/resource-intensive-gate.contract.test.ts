/**
 * verification-runner:system:resource-intensive-gateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 公開Verification入口がPT／LTを人間許可と上限なしに開始しないことを検証する。
 * @trace CQS-ST-013
 * @level ST
 * @scope verification、public-entry、performance、longevity、authority、effect-zero
 * @boundary CQS-ST-013=System/E2E: 公開Verification入口→人間許可Gate→PT／LT Runner
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const verificationRunnerRoot = path.resolve(import.meta.dirname, "../..");
const runner = path.join(verificationRunnerRoot, "bin", "regression-runner.ts");
const CHANGED_PATH =
  "40_Develop/verification-runner/src/catalog/test-catalog.ts";

/**
 * 公開Verification CLIを固定引数で起動する。
 *
 * @responsibility CLI Processの終了Codeと構造化標準出力をTest Caseへ返す。
 * @trace CQS-ST-013
 * @precondition 引数はTest Caseが固定し、PT／LT実行を要求する場合も実行不能またはplan-only条件に限定する。
 * @stimulus Node.jsから公開Verification CLIを起動する。
 * @observation 終了Code、stdout、stderrを取得する。
 * @oracle 呼出し元がAuthority GateとEffect 0を判定できる形で返す。
 * @cleanup 子Processの同期終了後に追加資源を残さない。
 * @boundary CQS-ST-013=System/E2E: Test Process→公開Verification CLI
 */
function invoke(argumentValues: readonly string[]) {
  const result = spawnSync(process.execPath, [runner, ...argumentValues], {
    cwd: verificationRunnerRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  return Object.freeze({
    error: result.error,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

/**
 * 未許可と上限不足のPT／LT要求を公開入口でEffect前に拒否する。
 *
 * @responsibility PT／LT Authorityの欠落を通常回帰または実行済みへ畳まない。
 * @trace CQS-ST-013
 * @precondition performanceを要求し、未許可または必須上限欠落の入力を用意する。
 * @stimulus 公開Verification CLIへ各要求を渡す。
 * @observation Gate状態、拒否理由、欠落項目、Effect発行状態および終了Codeを観測する。
 * @oracle 全反例をnot_authorized、Effect 0、Exit 2で拒否する。
 * @cleanup 同期終了したCLI以外のProcessまたは一時資源を作成しない。
 * @boundary CQS-ST-013=System/E2E: 公開入口→Authority Gate→PT／LT Runner
 */
test("未許可と上限不足のPT／LT要求を公開入口でEffect前に拒否する", () => {
  const cases = [
    ["--changed", CHANGED_PATH, "--levels", "performance"],
    [
      "--changed",
      CHANGED_PATH,
      "--levels",
      "performance",
      "--resource-intensive-authorized",
      "--purpose",
      "bounded observation",
    ],
  ];
  for (const argumentValues of cases) {
    const result = invoke(argumentValues);
    assert.equal(result.error, undefined);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stderr, "");
    const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
    assert.equal(outcome.status, "not_authorized");
    assert.equal(outcome.reason, "resource_intensive_test_authority_required");
    assert.equal(outcome.effectIssued, false);
    assert.ok(Array.isArray(outcome.failures));
  }
});

/**
 * 全Authority条件が揃ってもPT／LTをplan-onlyとして返す。
 *
 * @responsibility 人間許可情報の検証とPT／LT Runner未実行を同じ公開結果で確認する。
 * @trace CQS-ST-013
 * @precondition 許可、目的、環境、時間・回数・Credit上限、cleanup、停止条件を固定する。
 * @stimulus performance要求を公開Verification CLIへ渡す。
 * @observation 計画状態、Authority検証、実行方針、Effect状態および終了Codeを観測する。
 * @oracle planned_not_executable、plan-only、Effect 0を返しPT Runnerを開始しない。
 * @cleanup 同期終了したCLI以外のProcessまたは一時資源を作成しない。
 * @boundary CQS-ST-013=System/E2E: 公開入口→Authority Gate→PT／LT計画
 */
test("全Authority条件が揃ってもPT／LTをplan-onlyとして返す", () => {
  const result = invoke([
    "--changed",
    CHANGED_PATH,
    "--levels",
    "performance",
    "--resource-intensive-authorized",
    "--purpose",
    "bounded observation",
    "--environment",
    "fixed local fixture",
    "--max-duration-minutes",
    "5",
    "--max-invocations",
    "10",
    "--max-credits",
    "0",
    "--cleanup",
    "remove generated fixture data",
    "--stop-condition",
    "stop on first failure",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const outcome = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(outcome.status, "planned_not_executable");
  assert.equal(outcome.resourceIntensiveAuthorityVerified, true);
  assert.equal(
    outcome.resourceIntensiveExecution,
    "plan_only_until_runtime_limits_are_enforced",
  );
  assert.equal(outcome.effectIssued, false);
});
