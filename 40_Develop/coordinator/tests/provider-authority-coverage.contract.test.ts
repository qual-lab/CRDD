import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PROVIDER_AUTHORITY_COVERAGE_SOURCES,
  PROVIDER_AUTHORITY_COVERAGE_TESTS,
} from "../scripts/check-provider-authority-coverage.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "..");

test("Provider Authority coverageはexact 6 sourceと9 testを所有する", () => {
  assert.deepEqual(PROVIDER_AUTHORITY_COVERAGE_SOURCES, [
    "40_Develop/coordinator/src/security/provider-isolation-profile.ts",
    "40_Develop/coordinator/src/security/authority-grant-verifier.ts",
    "40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts",
    "40_Develop/coordinator/src/security/local-personal-authority-runtime.ts",
    "40_Develop/coordinator/src/security/provider-authority-runtime.ts",
    "40_Develop/coordinator/src/security/plain-data-snapshot.ts",
  ]);
  assert.deepEqual(PROVIDER_AUTHORITY_COVERAGE_TESTS, [
    "40_Develop/coordinator/tests/plain-data-snapshot.contract.test.ts",
    "40_Develop/coordinator/tests/provider-isolation-profile.contract.test.ts",
    "40_Develop/coordinator/tests/authority-grant-verifier.contract.test.ts",
    "40_Develop/coordinator/tests/authority-trust-loader.contract.test.ts",
    "40_Develop/coordinator/tests/authority-file-bundle.contract.test.ts",
    "40_Develop/coordinator/tests/authority-prelaunch-verifier.contract.test.ts",
    "40_Develop/coordinator/tests/egress-proxy-policy.contract.test.ts",
    "40_Develop/coordinator/tests/local-personal-authority-runtime.contract.test.ts",
    "40_Develop/coordinator/tests/provider-authority-runtime.contract.test.ts",
  ]);
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts?.["provider-authority:coverage"],
    "node ./scripts/check-provider-authority-coverage.ts",
  );
});
