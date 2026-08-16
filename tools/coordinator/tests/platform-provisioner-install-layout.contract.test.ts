import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerInstallLayoutContract,
  evaluateWindowsProvisionerInstallLayoutCandidate,
  resolveWindowsProvisionerInstallLayoutForEffect,
} from "../src/security/platform-provisioner-install-layout.ts";

test("Windows install layout keeps source in repository and machine state in ProgramData", () => {
  const result = evaluateWindowsProvisionerInstallLayoutCandidate({
    programDataRoot: "C:\\ProgramData",
    releaseSequence: 18,
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.repositoryStateRequired, false);
  assert.equal(result.externalInstallStateRequired, true);
  assert.equal(result.compatibilityLayoutRequired, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal("installRoot" in result, false);
});

test("effect-only resolver fixes release and state paths without compatibility aliases", () => {
  const layout = resolveWindowsProvisionerInstallLayoutForEffect(
    "C:\\ProgramData",
    18,
  );
  assert.ok(layout);
  assert.equal(
    layout.releaseRoot,
    "C:\\ProgramData\\Qual-Lab\\CRDD\\Coordinator\\releases\\18",
  );
  assert.equal(
    layout.releaseFloorFile,
    "C:\\ProgramData\\Qual-Lab\\CRDD\\Coordinator\\state\\release-floor.json",
  );
  assert.equal(
    layout.activeReleaseFile,
    "C:\\ProgramData\\Qual-Lab\\CRDD\\Coordinator\\state\\active-release.json",
  );
});

test("Windows install layout rejects relative dynamic and invalid sequence inputs", () => {
  for (const input of [
    { programDataRoot: "ProgramData", releaseSequence: 18 },
    { programDataRoot: "C:\\ProgramData", releaseSequence: 0 },
    { programDataRoot: "C:\\ProgramData", releaseSequence: 1.5 },
    { programDataRoot: "C:\\ProgramData", releaseSequence: 18, extra: true },
    new Proxy(
      { programDataRoot: "C:\\ProgramData", releaseSequence: 18 },
      { ownKeys: () => ["programDataRoot", "releaseSequence"] },
    ),
  ]) {
    assert.equal(
      evaluateWindowsProvisionerInstallLayoutCandidate(input).status,
      "blocked",
    );
  }
});

test("install layout contract keeps release authority and effects separate", () => {
  const contract = describePlatformProvisionerInstallLayoutContract();
  assert.equal(
    contract.sourceOwnership,
    "repository_owned_typescript_and_contract_tests",
  );
  assert.equal(contract.repositoryRuntimeStateRequired, false);
  assert.equal(contract.compatibilityLayout, "prohibited");
  assert.equal(
    contract.filesystemEffect,
    "not_implemented_effective_access_required",
  );
});
