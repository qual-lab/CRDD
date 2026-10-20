/**
 * 公開台帳入口が試験実行・高負荷許可を捏造しないことを確認する。
 * @packageDocumentation
 * @responsibility 計画専用の境界と未充足条件を確認する。
 * @trace CQS-ST-013
 * @trace ERB-ST-015
 * @level ST
 * @scope catalog、resource-intensive、effect-zero
 * @boundary CQS-ST-013=System/E2E: 公開CLI→Domain条件検査。 / ERB-ST-015=System/E2E: 公開CLIの試験未起動結果。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../../../../..");
const cli = path.join(root, "40_Develop/checker/bin/checker.ts");

/**
 * 高負荷要求の未許可と上限充足を公開入口から確認する。
 * @responsibility 全条件があっても計画だけと表示する。
 * @trace CQS-ST-013
 * @trace ERB-ST-015
 * @precondition 現行台帳と固定要求だけを使用。
 * @stimulus 許可条件なし／全条件ありで計画要求。
 * @observation JSON、終了値、未実行表示。
 * @oracle 不足時は2、充足時もplannedとnot_startedだけ。
 * @cleanup 同期CLI子をjoin、試験Processは未起動。
 * @boundary System/E2E: CLI→Domain条件評価。
 */
test("高負荷試験は条件充足後も計画だけで実行済みにならない", () => {
  const args = [cli, "--test-catalog", "--all", "--levels", "performance"];
  const denied = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(denied.error, undefined);
  assert.equal(denied.status, 2);
  assert.equal(JSON.parse(denied.stdout).status, "not_authorized");
  const planned = spawnSync(
    process.execPath,
    [
      ...args,
      "--resource-intensive-authorized",
      "--purpose",
      "synthetic",
      "--environment",
      "synthetic",
      "--max-duration-minutes",
      "1",
      "--max-invocations",
      "1",
      "--max-credits",
      "0",
      "--cleanup",
      "synthetic",
      "--stop-condition",
      "synthetic",
    ],
    { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true },
  );
  assert.equal(planned.status, 0, planned.stderr + planned.stdout);
  const result = JSON.parse(planned.stdout);
  assert.equal(
    result.resourceIntensiveExecution,
    "plan_only_until_runtime_limits_are_enforced",
  );
  assert.equal(result.testExecution, "not_started");
  assert.equal(result.effectIssued, false);
});

/**
 * 検査入口に実行用依存が再導入されていないことを確認する。
 * @responsibility コマンド生成・試験起動Frameworkへの逆戻りを検出する。
 * @trace ERB-ST-015
 * @precondition 現行公開入口のSource。
 * @stimulus 実行依存を検索する。
 * @observation importと実行関数。
 * @oracle 子Process・npm／Cargoコマンド・実行Callbackなし。
 * @cleanup N/A: 読取りだけ。
 * @boundary Direct Boundary: 公開計画実装の依存閉包。
 */
test("計画入口はnpmと試験起動処理へ依存しない", () => {
  const source = fs.readFileSync(
    path.join(root, "40_Develop/checker/src/cli/test-catalog.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /from ["']node:child_process|spawnSync\(|execFileSync\(|executeRegressionStages|createRegressionStageExecutor/u,
  );
  assert.doesNotMatch(source, /["'](?:npm|cargo|npm\.cmd)["']/u);
});
