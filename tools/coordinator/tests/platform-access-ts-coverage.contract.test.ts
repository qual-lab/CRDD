import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  parsePlatformAccessTsCoverageLcov,
  PLATFORM_ACCESS_TS_COVERAGE_NODE_OPTIONS,
  PLATFORM_ACCESS_TS_COVERAGE_SOURCES,
  PLATFORM_ACCESS_TS_COVERAGE_TESTS,
} from "../scripts/check-platform-access-ts-coverage.ts";

function record(source: string, taken = "1") {
  return [
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
  assert.equal(PLATFORM_ACCESS_TS_COVERAGE_SOURCES.length, 12);
  assert.equal(PLATFORM_ACCESS_TS_COVERAGE_TESTS.length, 12);
  assert.equal(new Set(PLATFORM_ACCESS_TS_COVERAGE_SOURCES).size, 12);
  assert.equal(new Set(PLATFORM_ACCESS_TS_COVERAGE_TESTS).size, 12);
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
    lines: { covered: 12, total: 12 },
    functions: { covered: 12, total: 12 },
    branches: { covered: 11, total: 12 },
  });
  assert.deepEqual(result.sources[0]?.uncoveredBranches, [
    { line: 1, block: 0, branch: 0, taken: null },
  ]);
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
        `${exact}\n${record("tools/coordinator/src/security/unknown.ts")}`,
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
    /duplicate FNDA:/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("DA:1,1", "DA:1,1\nDA:1,0"),
      ),
    /duplicate DA:/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("LF:1", "LF:-1")),
    /invalid LF:/u,
  );
  assert.throws(
    () => parsePlatformAccessTsCoverageLcov(exact.replace("FNF:1", "")),
    /invalid FNF: count/u,
  );
  assert.throws(
    () =>
      parsePlatformAccessTsCoverageLcov(
        exact.replace("SF:tools/", "SF:C:\\outside\\tools/"),
      ),
    /invalid LCOV source/u,
  );
});
