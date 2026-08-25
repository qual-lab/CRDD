import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeRuntimeOwnedCandidateStoreRootCapability,
  describeCandidateStoreWindowsAdapterContract,
  inspectRuntimeOwnedWindowsCandidateStore,
} from "../src/security/candidate-store-windows-adapter.ts";

test("source checkoutは署名済みRelease確認前にCandidate Store Effectを開始しない", () => {
  const result = inspectRuntimeOwnedWindowsCandidateStore(
    true,
    new Date().toISOString(),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.pathReported, false);
  assert.equal(result.principalReported, false);
  assert.equal(result.aclReported, false);
  assert.equal(
    consumeRuntimeOwnedCandidateStoreRootCapability(result.rootCapability),
    null,
  );
});

test("Candidate Store adapterは環境由来の相対Rootをnative照合前に拒否する", () => {
  const original = process.env.LOCALAPPDATA;
  try {
    process.env.LOCALAPPDATA = "relative-root";
    const result = inspectRuntimeOwnedWindowsCandidateStore(
      false,
      new Date().toISOString(),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "candidate_store_windows_adapter_root_invalid");
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
  } finally {
    if (original === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = original;
  }
});

test("Candidate Store adapterは固定Known Folderとexact保護観測だけをAuthority候補にする", () => {
  const contract = describeCandidateStoreWindowsAdapterContract();
  assert.deepEqual(contract.fixedSegments, [
    "Qual-Lab",
    "CRDD",
    "CandidateStore",
  ]);
  assert.match(contract.initialization, /without_repair/u);
  assert.match(contract.observation, /fixed_volume_non_reparse/u);
  assert.equal(contract.callerSuppliedPathAccepted, false);
  assert.equal(contract.inheritedEnvironmentTrustedDirectly, false);
  assert.equal(
    contract.environment,
    "loaded_kernel32_os_observed_windows_directory_and_fixed_neutral_ambient_names",
  );
  assert.equal(contract.rawPathReported, false);
  assert.equal(contract.networkEffectIssued, false);
});
