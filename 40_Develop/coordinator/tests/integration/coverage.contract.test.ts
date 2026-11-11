/**
 * 共有LCOV解析の正常・不正な入力とexact母集団を検証する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:coverageが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @level IT
 * @scope platform、access、ts、coverage
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseExactTsCoverageLcov } from "../../scripts/coverage.ts";
const SOURCES = Object.freeze([
  "40_Develop/coordinator/scripts/coverage.ts",
  "40_Develop/coordinator/src/execution/diagnostics.ts",
  "40_Develop/coordinator/src/execution/authority.ts",
  "40_Develop/domain-model/src/storage/bounded-file-snapshot.ts",
  "40_Develop/executor/scripts/provider-home.ts",
  "40_Develop/executor/src/lifecycle/attempt.ts",
]);
function parseCoverage(raw: unknown) {
  return parseExactTsCoverageLcov(raw, {
    sources: SOURCES,
    obligations: Object.fromEntries(
      SOURCES.map((source) => [
        source,
        {
          status: "Not Verified" as const,
          reason:
            "集計器のmain guard、OS I/O failureおよび全LCOV不正組合せを同一runで到達していない",
          risk: "品質根拠の誤拒否または不正入力の誤受理",
          alternativeVerification:
            "exact source/test母集団、LCOV grammar負例および連続出力一致",
          owner: "Qual-Lab" as const,
          humanDecision: "not_required" as const,
          recheck: "LCOV grammar、Node coverageまたは固定母集団の変更時",
        },
      ]),
    ),
  });
}

/**
 * recordのTest準備責務を実行する。
 *
 * @responsibility recordがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus recordを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
function record(source: string, taken = "1") {
  return [
    "TN:",
    `SF:${source}`,
    "FN:1,fixture",
    "FNDA:1,fixture",
    "FNF:1",
    "FNH:1",
    `BRDA:1,0,0,${taken}`,
    "BRF:1",
    taken === "0" || taken === "-" ? "BRH:0" : "BRH:1",
    "DA:1,1",
    "LF:1",
    "LH:1",
    "end_of_record",
  ].join("\n");
}

/**
 * exactLcovのTest準備責務を実行する。
 *
 * @responsibility exactLcovがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exactLcovを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
function exactLcov() {
  return SOURCES.map((source, index) =>
    record(source, index === 0 ? "-" : "1"),
  ).join("\n");
}

/**
 * LCOV parserは分母分子と未到達branchを割合へ縮約しないを検証する。
 *
 * @responsibility LCOV parserは分母分子と未到達branchを割合へ縮約しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus LCOV parserは分母分子と未到達branchを割合へ縮約しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("LCOV parserは分母分子と未到達branchを割合へ縮約しない", () => {
  const result = parseCoverage(exactLcov());
  assert.deepEqual(result.totals, {
    lines: { covered: 6, total: 6 },
    functions: { covered: 6, total: 6 },
    branches: { covered: 5, total: 6 },
  });
  assert.deepEqual(result.sources[0]?.uncoveredBranches, [
    { line: 1, block: 0, branch: 0, taken: null },
  ]);
  assert.equal(result.uncoveredBranchObligations.length, 1);
  assert.deepEqual(result.uncoveredBranchObligations[0], {
    source: "40_Develop/coordinator/scripts/coverage.ts",
    line: 1,
    block: 0,
    branch: 0,
    obligation: {
      status: "Not Verified",
      reason:
        "集計器のmain guard、OS I/O failureおよび全LCOV不正組合せを同一runで到達していない",
      risk: "品質根拠の誤拒否または不正入力の誤受理",
      alternativeVerification:
        "exact source/test母集団、LCOV grammar負例および連続出力一致",
      owner: "Qual-Lab",
      humanDecision: "not_required",
      recheck: "LCOV grammar、Node coverageまたは固定母集団の変更時",
    },
  });
});

/**
 * LCOV parserはmissing、extra、duplicateおよびsummary不一致を拒否するを検証する。
 *
 * @responsibility LCOV parserはmissing、extra、duplicateおよびsummary不一致を拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus LCOV parserはmissing、extra、duplicateおよびsummary不一致を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("LCOV parserはmissing、extra、duplicateおよびsummary不一致を拒否する", () => {
  const exact = exactLcov();
  const first = SOURCES[0] ?? "";
  assert.throws(
    () => parseCoverage(record(first)),
    /source population mismatch/u,
  );
  assert.throws(
    () =>
      parseCoverage(
        `${exact}\n${record("40_Develop/coordinator/src/security/unknown.ts")}`,
      ),
    /unexpected LCOV source/u,
  );
  assert.throws(
    () => parseCoverage(`${exact}\n${record(first)}`),
    /duplicate SF/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("BRF:1", "BRF:2")),
    /inconsistent branch summary/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("BRH:0", "BRH:2")),
    /invalid LCOV summary/u,
  );
  assert.throws(
    () =>
      parseCoverage(
        exact.replace("BRDA:1,0,0,-", "BRDA:1,0,0,-\nBRDA:1,0,0,-"),
      ),
    /duplicate BRDA/u,
  );
  assert.throws(
    () =>
      parseCoverage(
        exact.replace("FNDA:1,fixture", "FNDA:1,fixture\nFNDA:0,fixture"),
      ),
    /duplicate FNDA/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("DA:1,1", "DA:1,1\nDA:1,0")),
    /duplicate DA/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("LF:1", "LF:-1")),
    /invalid LF:/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("DA:1,1", "DA:1,9007199254740992")),
    /invalid DA executions/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("FNF:1\n", "")),
    /invalid FNF: count/u,
  );
  assert.throws(
    () =>
      parseCoverage(
        exact.replace("SF:40_Develop/", "SF:C:\\outside\\40_Develop/"),
      ),
    /invalid LCOV source/u,
  );
});

/**
 * LCOV parserはrecord grammar、正の行Identityおよびfunction対応をexactにするを検証する。
 *
 * @responsibility LCOV parserはrecord grammar、正の行Identityおよびfunction対応をexactにするの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus LCOV parserはrecord grammar、正の行Identityおよびfunction対応をexactにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("LCOV parserはrecord grammar、正の行Identityおよびfunction対応をexactにする", () => {
  const exact = exactLcov();
  assert.throws(
    () => parseCoverage(exact.replace("DA:1,1", "DA:0,1")),
    /invalid DA line/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("DA:1,1", "DA:not-a-line,1")),
    /invalid DA line/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("FN:1,fixture", "FN:0,fixture")),
    /invalid FN line/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("BRDA:1,0,0,-", "BRDA:0,0,0,-")),
    /invalid BRDA line/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("FNDA:1,fixture", "FNDA:1,other")),
    /inconsistent function records/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("FN:1,fixture\n", "")),
    /inconsistent function records/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("SF:", "UNKNOWN:")),
    /unknown LCOV record/u,
  );
  assert.throws(
    () =>
      parseCoverage(record(SOURCES[0] ?? "").replace("\nend_of_record", "")),
    /missing end_of_record/u,
  );
  assert.throws(
    () =>
      parseCoverage(
        exact.replace("end_of_record", "end_of_record\nend_of_record"),
      ),
    /duplicate end_of_record/u,
  );
  assert.throws(
    () => parseCoverage(`${exact}\nUNKNOWN:after`),
    /unknown LCOV record/u,
  );
  assert.throws(
    () => parseCoverage(exact.replace("TN:", "TN:named")),
    /invalid TN count/u,
  );
});
