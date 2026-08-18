import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  PROVIDER_AUTHORITY_COVERAGE_SOURCES,
  PROVIDER_AUTHORITY_COVERAGE_TESTS,
} from "../scripts/check-provider-authority-coverage.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "..");

test("Provider Authority coverageはexact 4 sourceと7 testを所有する", () => {
  assert.deepEqual(PROVIDER_AUTHORITY_COVERAGE_SOURCES, [
    "tools/coordinator/src/security/provider-isolation-profile.ts",
    "tools/coordinator/src/security/authority-grant-verifier.ts",
    "tools/coordinator/src/security/authority-prelaunch-verifier.ts",
    "tools/coordinator/src/security/plain-data-snapshot.ts",
  ]);
  assert.deepEqual(PROVIDER_AUTHORITY_COVERAGE_TESTS, [
    "tools/coordinator/tests/plain-data-snapshot.contract.test.ts",
    "tools/coordinator/tests/provider-isolation-profile.contract.test.ts",
    "tools/coordinator/tests/authority-grant-verifier.contract.test.ts",
    "tools/coordinator/tests/authority-trust-loader.contract.test.ts",
    "tools/coordinator/tests/authority-file-bundle.contract.test.ts",
    "tools/coordinator/tests/authority-prelaunch-verifier.contract.test.ts",
    "tools/coordinator/tests/egress-proxy-policy.contract.test.ts",
  ]);
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts?.["provider-authority:coverage"],
    "node ./scripts/check-provider-authority-coverage.ts",
  );
});
