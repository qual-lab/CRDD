import assert from "node:assert/strict";
import test from "node:test";

import {
  DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES,
  DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS,
  serializeDynamicFakeProviderCoverage,
} from "../../scripts/check-dynamic-fake-provider-coverage.ts";

test("動的Fake coverageは生成器と共有LCOV parserを含むexact母集団を所有する", () => {
  assert.deepEqual(DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES, [
    "40_Develop/coordinator/src/security/docker-isolation.ts",
    "40_Develop/coordinator/src/security/provider-lifecycle.ts",
    "40_Develop/coordinator/src/security/execution-environment.ts",
    "40_Develop/coordinator/src/security/host-recovery-record.ts",
    "40_Develop/coordinator/src/security/plain-data-snapshot.ts",
    "40_Develop/coordinator/src/core/doctor.ts",
    "40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts",
    "40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts",
    "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
    "40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts",
  ]);
  assert.deepEqual(DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS, [
    "40_Develop/coordinator/tests/unit/doctor.contract.test.ts",
    "40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts",
    "40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts",
    "40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts",
    "40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts",
    "40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts",
    "40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts",
  ]);
});

test("動的Fake coverage serializerはcompact JSONと末尾LF exact 1件を固定する", () => {
  const serialized = serializeDynamicFakeProviderCoverage({
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
