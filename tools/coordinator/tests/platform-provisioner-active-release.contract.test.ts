import assert from "node:assert/strict";
import test from "node:test";

import {
  decodePlatformProvisionerActiveReleaseBytesCandidate,
  describePlatformProvisionerActiveReleaseContract,
  encodePlatformProvisionerActiveReleaseCandidate,
  evaluatePlatformProvisionerActiveReleaseCandidate,
} from "../src/security/platform-provisioner-active-release.ts";

function release(releaseSequence = 18) {
  return {
    manifestHash: "a".repeat(64),
    releaseSequence,
    crddVersion: "v0.18.0",
    crddCommit: "b".repeat(40),
    crddTree: "c".repeat(40),
    packageContentRootSha256: "d".repeat(64),
  };
}

function candidate() {
  return evaluatePlatformProvisionerActiveReleaseCandidate({
    verifiedRelease: release(),
    confirmedFloor: {
      floorHash: "e".repeat(64),
      releaseSequence: 18,
    },
  });
}

test("active release binds the verified package to the confirmed rollback floor", () => {
  const result = candidate();
  assert.equal(result.status, "candidate");
  assert.equal(result.releaseSequence, 18);
  assert.equal(result.activationPersistenceRequired, true);
  assert.equal(result.filesystemEffectIssued, false);
  assert.ok(result.nextActiveRelease);
});

test("active release canonical bytes round-trip and reject aliases", () => {
  const result = candidate();
  if (result.status !== "candidate") assert.fail(result.reason);
  const encoded = encodePlatformProvisionerActiveReleaseCandidate(
    result.nextActiveRelease,
  );
  assert.equal(encoded.status, "candidate");
  assert.equal(
    decodePlatformProvisionerActiveReleaseBytesCandidate(encoded.canonicalBytes)
      .status,
    "candidate",
  );
  assert.equal(
    decodePlatformProvisionerActiveReleaseBytesCandidate(
      Buffer.concat([encoded.canonicalBytes, Buffer.from("\n")]),
    ).status,
    "blocked",
  );
});

test("active release rejects a floor from another release sequence", () => {
  const result = evaluatePlatformProvisionerActiveReleaseCandidate({
    verifiedRelease: release(18),
    confirmedFloor: {
      floorHash: "e".repeat(64),
      releaseSequence: 17,
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "active_release_input_invalid");
});

test("active release contract keeps machine state outside the repository", () => {
  const contract = describePlatformProvisionerActiveReleaseContract();
  assert.equal(contract.canonicalByteCodec, "implemented_candidate");
  assert.equal(contract.repositoryRuntimeStateRequired, false);
  assert.equal(contract.compatibilityState, "prohibited");
});
