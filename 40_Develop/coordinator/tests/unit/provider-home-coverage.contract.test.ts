/**
 * coordinator:unit:provider-home-coverageの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-home-coverageが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope provider、home、coverage
 * @boundary AIT-UT-005=N/A: 既存Ownerの局所的な入力・権限・隔離規則を検証し、総合Trustの評価器は扱わない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedProviderHomeCoverageNodeVersion,
  PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION,
  PROVIDER_HOME_COVERAGE_SOURCES,
  PROVIDER_HOME_COVERAGE_TESTS,
  requireProviderHomeCoverageOutput,
  serializeProviderHomeCoverage,
} from "../../scripts/check-provider-home-coverage.ts";

/**
 * Provider Home coverageはRepository基準Node以上だけを受理するを検証する。
 *
 * @responsibility Provider Home coverageはRepository基準Node以上だけを受理するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home coverageはRepository基準Node以上だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Home coverageはRepository基準Node以上だけを受理する", () => {
  assert.equal(PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION, "24.12.0");
  for (const version of ["24.12.0", "24.19.0", "25.0.0"]) {
    assert.equal(isSupportedProviderHomeCoverageNodeVersion(version), true);
  }
  for (const version of [
    "22.18.0",
    "24.11.99",
    "24.12",
    "v24.19.0",
    "24.12.0.0",
    "x.12.0",
    null,
  ]) {
    assert.equal(isSupportedProviderHomeCoverageNodeVersion(version), false);
  }
});

/**
 * 計測子の既知警告を失敗・未知の出力と区別する。
 * @responsibility 既知警告が非0や余分なstderrを隠さないことを検証する。
 * @trace AIT-UT-005
 * @precondition 子Processは起動せず固定の終了結果だけを使用する。
 * @stimulus 警告なし、正規警告、余剰や不完全な警告、非0、Signal、起動失敗を渡す。
 * @observation LCOV本文の搬送又は拒否。
 * @oracle 正常終了と空又は正規警告一件だけを許容する。
 * @cleanup N/A: メモリ内の値だけ。
 * @boundary AIT-UT-005=Direct Boundary: 計測子の終了結果受付。
 */
test("Provider Home coverageは正常終了と既知警告一件だけを受け付ける", () => {
  const child = {
    status: 0,
    signal: null,
    stdout: "lcov",
    stderr: "",
  } as const;
  const known =
    "(node:24) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time\n" +
    "(Use `node --trace-warnings ...` to show where the warning was created)\n";
  for (const stderr of ["", known, known.replaceAll("\n", "\r\n")])
    assert.equal(
      requireProviderHomeCoverageOutput({ ...child, stderr }),
      "lcov",
    );
  for (const stderr of [
    known.repeat(2),
    known.slice(0, -1),
    known + "\n",
    "\n" + known,
    known + "unexpected",
    known.replace("stripTypeScriptTypes", "otherOperation"),
    known.replace("node:24", "node:0"),
  ])
    assert.throws(() =>
      requireProviderHomeCoverageOutput({ ...child, stderr }),
    );
  for (const result of [
    { ...child, status: 1, stderr: known },
    { ...child, status: null, signal: "SIGTERM" as const, stderr: known },
    { ...child, error: new Error("spawn"), stderr: known },
  ])
    assert.throws(() => requireProviderHomeCoverageOutput(result));
});

/**
 * Provider Home coverageはrunnerと共有parserを含むexact母集団を所有するを検証する。
 *
 * @responsibility Provider Home coverageはrunnerと共有parserを含むexact母集団を所有するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home coverageはrunnerと共有parserを含むexact母集団を所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Home coverageはrunnerと共有parserを含むexact母集団を所有する", () => {
  assert.deepEqual(PROVIDER_HOME_COVERAGE_SOURCES, [
    "40_Develop/coordinator/src/lifecycle/authentication.ts",
    "40_Develop/coordinator/src/lifecycle/validation.ts",
    "40_Develop/coordinator/src/lifecycle/environment.ts",
    "40_Develop/coordinator/scripts/coverage.ts",
    "40_Develop/coordinator/scripts/check-provider-home-coverage.ts",
  ]);
  assert.deepEqual(PROVIDER_HOME_COVERAGE_TESTS, [
    "40_Develop/coordinator/tests/unit/execution/root-path.contract.test.ts",
    "40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts",
    "40_Develop/coordinator/tests/unit/execution/provider-home.contract.test.ts",
    "40_Develop/coordinator/tests/unit/execution/provider-lifecycle.contract.test.ts",
    "40_Develop/coordinator/tests/unit/execution/diagnostics.contract.test.ts",
    "40_Develop/coordinator/tests/integration/coverage.contract.test.ts",
    "40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts",
  ]);
});

/**
 * Provider Home coverage serializerはcompact JSONと末尾LF exact 1件を固定するを検証する。
 *
 * @responsibility Provider Home coverage serializerはcompact JSONと末尾LF exact 1件を固定するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home coverage serializerはcompact JSONと末尾LF exact 1件を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Home coverage serializerはcompact JSONと末尾LF exact 1件を固定する", () => {
  const serialized = serializeProviderHomeCoverage({
    runtime: Object.freeze({
      nodeVersion: "v24.19.0",
      minimumNodeVersion: PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION,
    }),
    sourcePopulation: Object.freeze([]),
    testPopulation: Object.freeze([]),
    coverage: Object.freeze({}),
    reproducibility: Object.freeze({
      consecutiveRuns: 2,
      payloadSha256: "0".repeat(64),
    }),
  } as never);
  assert.equal(serialized, `${JSON.stringify(JSON.parse(serialized))}\n`);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.endsWith("\n\n"), false);
});
