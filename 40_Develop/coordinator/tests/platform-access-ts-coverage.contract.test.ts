import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  parsePlatformAccessTsCoverageLcov,
  PLATFORM_ACCESS_TS_COVERAGE_NODE_OPTIONS,
  PLATFORM_ACCESS_TS_COVERAGE_SOURCES,
  PLATFORM_ACCESS_TS_COVERAGE_TESTS,
  serializePlatformAccessTsCoverage,
} from "../scripts/check-platform-access-ts-coverage.ts";

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

function exactLcov() {
  return PLATFORM_ACCESS_TS_COVERAGE_SOURCES.map((source, index) =>
    record(source, index === 0 ? "-" : "1"),
  ).join("\n");
}

test("TypeScript coverageは固定sourceとtest母集団を所有する", () => {
  assert.equal(PLATFORM_ACCESS_TS_COVERAGE_SOURCES.length, 15);
  assert.equal(PLATFORM_ACCESS_TS_COVERAGE_TESTS.length, 13);
  assert.equal(new Set(PLATFORM_ACCESS_TS_COVERAGE_SOURCES).size, 15);
  assert.equal(new Set(PLATFORM_ACCESS_TS_COVERAGE_TESTS).size, 13);
  assert.equal(
    PLATFORM_ACCESS_TS_COVERAGE_SOURCES.includes(
      "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
    ),
    true,
  );
  assert.equal(
    PLATFORM_ACCESS_TS_COVERAGE_SOURCES.includes(
      "40_Develop/coordinator/scripts/release-staging-manifest.ts",
    ),
    true,
  );
  assert.equal(
    PLATFORM_ACCESS_TS_COVERAGE_SOURCES.includes(
      "40_Develop/coordinator/scripts/promote-release-manifest.ts",
    ),
    true,
  );
  assert.equal(
    PLATFORM_ACCESS_TS_COVERAGE_TESTS.includes(
      "40_Develop/coordinator/tests/release-manifest-promotion.contract.test.ts",
    ),
    true,
  );
  assert.equal(
    PLATFORM_ACCESS_TS_COVERAGE_TESTS.includes(
      "40_Develop/coordinator/tests/platform-access-ts-coverage.contract.test.ts",
    ),
    true,
  );
  assert.deepEqual(PLATFORM_ACCESS_TS_COVERAGE_NODE_OPTIONS, [
    "--experimental-test-coverage",
    "--test",
    "--test-concurrency=1",
    "--experimental-test-isolation=none",
    "--test-reporter=lcov",
  ]);
  for (const candidate of [
    ...PLATFORM_ACCESS_TS_COVERAGE_SOURCES,
    ...PLATFORM_ACCESS_TS_COVERAGE_TESTS,
  ]) {
    assert.equal(path.isAbsolute(candidate), false);
    assert.equal(
      fs.existsSync(path.resolve(import.meta.dirname, "../../..", candidate)),
      true,
    );
  }
  const packageJson = JSON.parse(
    fs.readFileSync(
      path.resolve(import.meta.dirname, "../package.json"),
      "utf8",
    ),
  ) as { scripts?: Record<string, unknown> };
  assert.equal(
    packageJson.scripts?.["platform-access:ts-coverage"],
    "node ./scripts/check-platform-access-ts-coverage.ts",
  );
});

test("LCOV parserは分母分子と未到達branchを割合へ縮約しない", () => {
  const result = parsePlatformAccessTsCoverageLcov(exactLcov());
  assert.deepEqual(result.totals, {
    lines: { covered: 15, total: 15 },
    functions: { covered: 15, total: 15 },
    branches: { covered: 14, total: 15 },
  });
  assert.deepEqual(result.sources[0]?.uncoveredBranches, [
    { line: 1, block: 0, branch: 0, taken: null },
  ]);
  assert.equal(result.uncoveredBranchObligations.length, 1);
  assert.deepEqual(result.uncoveredBranchObligations[0], {
    source:
      "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
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

test("coverage CLI serializerはcompact JSONと末尾LF exact 1件を固定する", () => {
  const value = parsePlatformAccessTsCoverageLcov(exactLcov());
  const serialized = serializePlatformAccessTsCoverage(value);
  assert.equal(serialized, `${JSON.stringify(value)}\n`);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.endsWith("\n\n"), false);
  assert.equal(serialized.includes("\r"), false);
  assert.equal(serialized.includes('\n  "'), false);
  assert.deepEqual(JSON.parse(serialized), value);
});

test("LCOV parserはmissing、extra、duplicateおよびsummary不一致を拒否する", () => {
  const exact = exactLcov();
  const first = PLATFORM_ACCESS_TS_COVERAGE_SOURCES[0] ?? "";
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(record(first)),
    /source population mismatch/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        `${exact}\n${record("40_Develop/coordinator/src/security/unknown.ts")}`,
      ),
    /unexpected LCOV source/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(`${exact}\n${record(first)}`),
    /duplicate SF/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("BRF:1", "BRF:2")),
    /inconsistent branch summary/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("BRH:0", "BRH:2")),
    /invalid LCOV summary/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("BRDA:1,0,0,-", "BRDA:1,0,0,-\nBRDA:1,0,0,-"),
      ),
    /duplicate BRDA/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("FNDA:1,fixture", "FNDA:1,fixture\nFNDA:0,fixture"),
      ),
    /duplicate FNDA/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("DA:1,1", "DA:1,1\nDA:1,0"),
      ),
    /duplicate DA/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("LF:1", "LF:-1")),
    /invalid LF:/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("DA:1,1", "DA:1,9007199254740992"),
      ),
    /invalid DA executions/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("FNF:1\n", "")),
    /invalid FNF: count/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("SF:40_Develop/", "SF:C:\\outside\\40_Develop/"),
      ),
    /invalid LCOV source/u,
  );
});

test("LCOV parserはrecord grammar、正の行Identityおよびfunction対応をexactにする", () => {
  const exact = exactLcov();
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("DA:1,1", "DA:0,1")),
    /invalid DA line/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("DA:1,1", "DA:not-a-line,1"),
      ),
    /invalid DA line/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("FN:1,fixture", "FN:0,fixture"),
      ),
    /invalid FN line/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("BRDA:1,0,0,-", "BRDA:0,0,0,-"),
      ),
    /invalid BRDA line/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("FNDA:1,fixture", "FNDA:1,other"),
      ),
    /inconsistent function records/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(exact.replace("FN:1,fixture\n", "")),
    /inconsistent function records/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("SF:", "UNKNOWN:")),
    /unknown LCOV record/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        record(PLATFORM_ACCESS_TS_COVERAGE_SOURCES[0] ?? "").replace(
          "\nend_of_record",
          "",
        ),
      ),
    /missing end_of_record/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("end_of_record", "end_of_record\nend_of_record"),
      ),
    /duplicate end_of_record/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(`${exact}\nUNKNOWN:after`),
    /unknown LCOV record/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("TN:", "TN:named")),
    /invalid TN count/u,
  );
});
