import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerActiveReleaseReaderContract,
  readPlatformProvisionerActiveReleaseCandidate,
} from "../src/security/platform-provisioner-active-release-reader.ts";
import { describeWindowsCommonApplicationDataContract } from "../src/security/windows-common-application-data.ts";

test("active release reader is read-only and fails closed outside supported state", () => {
  const result = readPlatformProvisionerActiveReleaseCandidate();
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "active_release_reader_effective_access_adapter_not_implemented",
  );
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(
    JSON.stringify(result).toLowerCase().includes("programdata\\"),
    false,
  );
});

test("active release reader remains disconnected from component candidates", () => {
  const contract = describePlatformProvisionerActiveReleaseReaderContract();
  assert.equal(
    contract.runtimeRead,
    "not_implemented_effective_access_required",
  );
  assert.equal(contract.automaticRecovery, "prohibited");
  assert.equal(
    contract.installedReleaseReverification,
    "not_implemented_effective_access_required",
  );
  const rootContract = describeWindowsCommonApplicationDataContract();
  assert.equal(rootContract.environmentOverride, "prohibited");
  assert.equal(rootContract.pathDisclosure, "prohibited");
});
