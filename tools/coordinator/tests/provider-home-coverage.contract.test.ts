import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_HOME_COVERAGE_SOURCES,
  PROVIDER_HOME_COVERAGE_TESTS,
  serializeProviderHomeCoverage,
} from "../scripts/check-provider-home-coverage.ts";

test("Provider Home coverageはrunnerと共有parserを含むexact母集団を所有する", () => {
  assert.deepEqual(PROVIDER_HOME_COVERAGE_SOURCES, [
    "tools/coordinator/src/security/authority-root-path-lexical.ts",
    "tools/coordinator/src/security/plain-data-snapshot.ts",
    "tools/coordinator/src/security/provider-home.ts",
    "tools/coordinator/src/security/provider-lifecycle.ts",
    "tools/coordinator/src/core/doctor.ts",
    "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
    "tools/coordinator/scripts/check-provider-home-coverage.ts",
  ]);
  assert.deepEqual(PROVIDER_HOME_COVERAGE_TESTS, [
    "tools/coordinator/tests/authority-root-path-lexical.contract.test.ts",
    "tools/coordinator/tests/plain-data-snapshot.contract.test.ts",
    "tools/coordinator/tests/provider-home.contract.test.ts",
    "tools/coordinator/tests/provider-lifecycle.contract.test.ts",
    "tools/coordinator/tests/doctor.contract.test.ts",
    "tools/coordinator/tests/platform-access-ts-coverage.contract.test.ts",
    "tools/coordinator/tests/provider-home-coverage.contract.test.ts",
  ]);
});

test("Provider Home coverage serializerはcompact JSONと末尾LF exact 1件を固定する", () => {
  const serialized = serializeProviderHomeCoverage({
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
