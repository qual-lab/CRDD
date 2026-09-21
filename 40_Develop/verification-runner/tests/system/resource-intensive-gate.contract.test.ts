/**
 * verification-runner:system:resource-intensive-gateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 公開Verification入口がPT／LTを人間許可と上限なしに開始しないことを検証する。
 * @trace CQS-ST-012
 * @trace CQS-ST-013
 * @trace ERB-ST-015
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
const HUMAN_ACCEPTANCE_PATH =
  "40_Develop/verification-runner/tests/acceptance/regression-plan-understanding.acceptance.test.ts";

/**
 * 公開Verification CLIを固定引数で起動する。
 *
 * @responsibility CLI Processの終了Codeと構造化標準出力をTest Caseへ返す。
 * @trace CQS-ST-012
 * @trace CQS-ST-013
 * @trace ERB-ST-015
 * @precondition 引数はTest Caseが固定し、PT／LT実行を要求する場合も実行不能またはplan-only条件に限定する。
 * @stimulus Node.jsから公開Verification CLIを起動する。
 * @observation 終了Code、stdout、stderrを取得する。
 * @oracle 呼出し元がAuthority GateとEffect 0を判定できる形で返す。
 * @cleanup 子Processの同期終了後に追加資源を残さない。
 * @boundary CQS-ST-012／CQS-ST-013=System/E2E: Test Process→公開Verification CLI
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
 * 公開CLIが順に出力した構造化結果を解析する。
 *
 * @responsibility 計画と統合結果を別のTop-level JSONとして保持し、部分出力を一つの結果へ誤結合しない。
 * @trace CQS-ST-012
 * @trace ERB-ST-015
 * @precondition CLIは各Top-level JSONを改行で区切り、Top-level開始波括弧を行頭へ出力する。
 * @stimulus CLIの標準出力を渡す。
 * @observation Top-level JSONごとの構造化値を取得する。
 * @oracle 計画と統合結果を順序どおり別要素として返す。
 * @cleanup N/A: 入力文字列以外の資源を作成しない。
 * @boundary CQS-ST-012=System/E2E: 公開Verification CLI出力→Test Oracle
 */
function parsePublicResults(stdout: string): Record<string, unknown>[] {
  return stdout
    .trim()
    .split(/\r?\n(?=\{)/u)
    .map((value) => JSON.parse(value) as Record<string, unknown>);
}

/**
 * 公開Verification入口は自動段階と人間入力待ちを同じ固定計画で返す。
 *
 * @responsibility 公開入口がUATを自動Passへ畳まず、全段階結果と未実行理由を統合結果へ保持することを検証する。
 * @trace CQS-ST-012
 * @trace ERB-ST-015
 * @precondition 人間入力を必要とする登録済みUATだけを直接変更対象として選ぶ。
 * @stimulus Static、UT、IT、ST、UATを指定して公開Verification CLIを起動する。
 * @observation 計画、段階順、開始・終了結果、未開始理由、公開状態、終了Codeおよびstderrを観測する。
 * @oracle 自動段階は完了し、UATはnot_run_due_to_human_input、全体はblocked、Exit 2となる。
 * @cleanup 子Processは同期終了し、一時資源、PT／LTおよび外部Effectを残さない。
 * @boundary CQS-ST-012／ERB-ST-015=System/E2E: 公開Verification入口→全段階Runner→統合結果
 */
test("公開入口はUATを自動Passにせず全段階結果と人間入力待ちを返す", () => {
  const result = invoke([
    "--changed",
    HUMAN_ACCEPTANCE_PATH,
    "--levels",
    "unit,integration,system,acceptance",
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.exitCode, 2);
  assert.equal(result.stderr, "");
  const [plan, outcome] = parsePublicResults(result.stdout);
  assert.equal(plan?.status, "planned");
  assert.deepEqual(plan?.requiredExecutionProfiles, [
    "restricted_process",
    "human_input",
  ]);
  const stages = outcome?.stages as Array<Record<string, unknown>> | undefined;
  assert.deepEqual(
    stages?.map((stage) => [
      stage.stage,
      stage.status,
      stage.execution,
      stage.exitCode,
    ]),
    [
      ["static", "completed", "automatic", 0],
      ["unit", "completed", "automatic", 0],
      ["integration", "completed", "automatic", 0],
      ["system", "completed", "automatic", 0],
      [
        "acceptance",
        "not_run_due_to_human_input",
        "human_input_required",
        null,
      ],
    ],
  );
  assert.equal(outcome?.status, "blocked");
  assert.equal(outcome?.reason, "regression_human_input_required");
});

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
