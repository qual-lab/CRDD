/**
 * coordinator:integration:provider-authority-coverageの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:provider-authority-coverageが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope provider、authority、coverage
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PROVIDER_AUTHORITY_COVERAGE_SOURCES,
  PROVIDER_AUTHORITY_COVERAGE_TESTS,
} from "../../scripts/check-provider-authority-coverage.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

/**
 * Provider Authority coverageはexact 6 sourceと9 testを所有するを検証する。
 *
 * @responsibility Provider Authority coverageはexact 6 sourceと9 testを所有するの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Authority coverageはexact 6 sourceと9 testを所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Authority coverageはexact 6 sourceと9 testを所有する", () => {
  assert.deepEqual(PROVIDER_AUTHORITY_COVERAGE_SOURCES, [
    "40_Develop/coordinator/src/provider/isolation-profile.ts",
    "40_Develop/coordinator/src/authority/grant-verifier.ts",
    "40_Develop/coordinator/src/authority/prelaunch-verifier.ts",
    "40_Develop/coordinator/src/authority/local-personal-grant.ts",
    "40_Develop/coordinator/src/provider/authority-grant.ts",
    "40_Develop/domain-model/src/plain-data/snapshot.ts",
  ]);
  assert.deepEqual(PROVIDER_AUTHORITY_COVERAGE_TESTS, [
    "40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts",
    "40_Develop/coordinator/tests/unit/provider/isolation-profile.contract.test.ts",
    "40_Develop/coordinator/tests/unit/authority/grant-verifier.contract.test.ts",
    "40_Develop/coordinator/tests/unit/authority/trust-loader.contract.test.ts",
    "40_Develop/coordinator/tests/unit/authority/file-bundle.contract.test.ts",
    "40_Develop/coordinator/tests/unit/authority/prelaunch-verifier.contract.test.ts",
    "40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts",
    "40_Develop/coordinator/tests/unit/authority/local-personal-grant.contract.test.ts",
    "40_Develop/coordinator/tests/unit/provider/authority-grant.contract.test.ts",
  ]);
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts?.["provider-authority:coverage"],
    "node ./scripts/check-provider-authority-coverage.ts",
  );
});
