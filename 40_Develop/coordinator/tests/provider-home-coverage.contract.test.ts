import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedProviderHomeCoverageNodeVersion,
  PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION,
  PROVIDER_HOME_COVERAGE_SOURCES,
  PROVIDER_HOME_COVERAGE_TESTS,
  serializeProviderHomeCoverage,
} from "../scripts/check-provider-home-coverage.ts";

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

test("Provider Home coverageはrunnerと共有parserを含むexact母集団を所有する", () => {
  assert.deepEqual(PROVIDER_HOME_COVERAGE_SOURCES, [
    "40_Develop/coordinator/src/security/authority-root-path-lexical.ts",
    "40_Develop/coordinator/src/security/plain-data-snapshot.ts",
    "40_Develop/coordinator/src/security/provider-home.ts",
    "40_Develop/coordinator/src/security/provider-home-mount-grant.ts",
    "40_Develop/coordinator/src/security/provider-lifecycle.ts",
    "40_Develop/coordinator/src/core/doctor.ts",
    "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
    "40_Develop/coordinator/scripts/check-provider-home-coverage.ts",
  ]);
  assert.deepEqual(PROVIDER_HOME_COVERAGE_TESTS, [
    "40_Develop/coordinator/tests/authority-root-path-lexical.contract.test.ts",
    "40_Develop/coordinator/tests/plain-data-snapshot.contract.test.ts",
    "40_Develop/coordinator/tests/provider-home.contract.test.ts",
    "40_Develop/coordinator/tests/provider-home-mount-grant.contract.test.ts",
    "40_Develop/coordinator/tests/provider-lifecycle.contract.test.ts",
    "40_Develop/coordinator/tests/doctor.contract.test.ts",
    "40_Develop/coordinator/tests/platform-access-ts-coverage.contract.test.ts",
    "40_Develop/coordinator/tests/provider-home-coverage.contract.test.ts",
  ]);
});

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
