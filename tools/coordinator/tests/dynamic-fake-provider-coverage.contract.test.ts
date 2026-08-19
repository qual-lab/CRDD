import assert from "node:assert/strict";
import test from "node:test";

import {
  DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES,
  DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS,
  serializeDynamicFakeProviderCoverage,
} from "../scripts/check-dynamic-fake-provider-coverage.ts";

test("動的Fake coverageは生成器と共有LCOV parserを含むexact母集団を所有する", () => {
  assert.deepEqual(DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES, [
    "tools/coordinator/src/security/docker-isolation.ts",
    "tools/coordinator/src/security/provider-lifecycle.ts",
    "tools/coordinator/src/security/execution-environment.ts",
    "tools/coordinator/src/security/host-recovery-record.ts",
    "tools/coordinator/src/security/plain-data-snapshot.ts",
    "tools/coordinator/src/core/doctor.ts",
    "tools/coordinator/scripts/verify-dynamic-fake-provider-failures.ts",
    "tools/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts",
    "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
    "tools/coordinator/scripts/check-dynamic-fake-provider-coverage.ts",
  ]);
  assert.deepEqual(DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS, [
    "tools/coordinator/tests/doctor.contract.test.ts",
    "tools/coordinator/tests/dynamic-fake-provider-failure-verification.contract.test.ts",
    "tools/coordinator/tests/dynamic-fake-provider-cancellation-verification.contract.test.ts",
    "tools/coordinator/tests/provider-lifecycle.contract.test.ts",
    "tools/coordinator/tests/plain-data-snapshot.contract.test.ts",
    "tools/coordinator/tests/platform-access-ts-coverage.contract.test.ts",
    "tools/coordinator/tests/dynamic-fake-provider-coverage.contract.test.ts",
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
