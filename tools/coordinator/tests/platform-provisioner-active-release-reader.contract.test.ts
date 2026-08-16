import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerActiveReleaseReaderContract,
  readPlatformProvisionerActiveReleaseCandidate,
} from "../src/security/platform-provisioner-active-release-reader.ts";
import { describeWindowsCommonApplicationDataContract } from "../src/security/windows-common-application-data.ts";

test("active release reader is read-only and fails closed outside supported state", () => {
  const result = readPlatformProvisionerActiveReleaseCandidate();
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(
    JSON.stringify(result).toLowerCase().includes("programdata\\"),
    false,
  );
});

test("active release reader requires transaction floor active package and DACL binding", () => {
  const contract = describePlatformProvisionerActiveReleaseReaderContract();
  assert.equal(contract.runtimeRead, "implemented_candidate");
  assert.equal(contract.automaticRecovery, "prohibited");
  assert.equal(
    contract.installedReleaseReverification,
    "signed_manifest_tree_package_and_dacl_required",
  );
  const rootContract = describeWindowsCommonApplicationDataContract();
  assert.equal(rootContract.environmentOverride, "prohibited");
  assert.equal(rootContract.pathDisclosure, "prohibited");
});
