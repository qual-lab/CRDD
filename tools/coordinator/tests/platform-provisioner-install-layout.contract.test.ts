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
    activeId: "0123456789abcdef0123456789abcdef",
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.activeId, "0123456789abcdef0123456789abcdef");
  assert.equal(result.repositoryStateRequired, false);
  assert.equal(result.externalInstallStateRequired, true);
  assert.equal(result.compatibilityLayoutRequired, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal("installRoot" in result, false);
});

test("effect-only resolver fixes release and state paths without compatibility aliases", () => {
  const layout = resolveWindowsProvisionerInstallLayoutForEffect(
    "C:\\ProgramData",
    "0123456789abcdef0123456789abcdef",
  );
  assert.ok(layout);
  assert.equal(
    layout.stagingRoot,
    "C:\\ProgramData\\Qual-Lab\\CRDD\\Coordinator\\staging\\0123456789abcdef0123456789abcdef",
  );
  assert.equal(
    layout.activeImageRoot,
    "C:\\ProgramData\\Qual-Lab\\CRDD\\Coordinator\\images\\0123456789abcdef0123456789abcdef",
  );
  assert.equal(
    layout.activePointerFile,
    "C:\\ProgramData\\Qual-Lab\\CRDD\\Coordinator\\state\\active-pointer.json",
  );
});

test("Windows install layout rejects relative dynamic and invalid active ID inputs", () => {
  for (const input of [
    { programDataRoot: "ProgramData", activeId: "0".repeat(32) },
    { programDataRoot: "C:\\ProgramData", activeId: "latest" },
    { programDataRoot: "C:\\ProgramData", activeId: "0".repeat(31) },
    {
      programDataRoot: "C:\\ProgramData",
      activeId: "0".repeat(32),
      extra: true,
    },
    new Proxy(
      { programDataRoot: "C:\\ProgramData", activeId: "0".repeat(32) },
      { ownKeys: () => ["activeId", "programDataRoot"] },
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
  assert.equal(contract.multipleActiveImages, "prohibited");
  assert.equal(contract.automaticRollback, "prohibited");
  assert.equal(
    contract.filesystemEffect,
    "not_implemented_effective_access_required",
  );
});
