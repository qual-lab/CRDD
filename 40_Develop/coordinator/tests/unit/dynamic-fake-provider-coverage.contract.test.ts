/**
 * coordinator:unit:dynamic-fake-provider-coverageの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:dynamic-fake-provider-coverageが所有する検証責務を実行する。
 * @trace CQS-UT-010
 * @level UT
 * @scope dynamic、fake、provider、coverage
 * @boundary CQS-UT-010=N/A: Test CatalogとOwner／Path／Levelは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES,
  DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS,
  serializeDynamicFakeProviderCoverage,
} from "../../scripts/check-dynamic-fake-provider-coverage.ts";

/**
 * 動的Fake coverageは生成器と共有LCOV parserを含むexact母集団を所有するを検証する。
 *
 * @responsibility 動的Fake coverageは生成器と共有LCOV parserを含むexact母集団を所有するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 動的Fake coverageは生成器と共有LCOV parserを含むexact母集団を所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=N/A: Test CatalogとOwner／Path／Levelは外部実行境界を持たない。
 */
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

/**
 * 動的Fake coverage serializerはcompact JSONと末尾LF exact 1件を固定するを検証する。
 *
 * @responsibility 動的Fake coverage serializerはcompact JSONと末尾LF exact 1件を固定するの合否判定を所有する。
 * @trace CQS-UT-010
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 動的Fake coverage serializerはcompact JSONと末尾LF exact 1件を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CQS-UT-010=N/A: Test CatalogとOwner／Path／Levelは外部実行境界を持たない。
 */
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
