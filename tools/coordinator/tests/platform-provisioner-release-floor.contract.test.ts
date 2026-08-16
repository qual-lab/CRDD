import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformProvisionerReleaseFloorContract,
  evaluatePlatformProvisionerReleaseFloorCandidate,
} from "../src/security/platform-provisioner-release-floor.ts";

function release(releaseSequence: number, marker = "a") {
  return {
    manifestHash: marker.repeat(64),
    releaseSequence,
    crddVersion: `v0.${releaseSequence}.0`,
    crddCommit: marker.repeat(40),
    crddTree: marker.repeat(40),
  };
}

test("release floor requires persistence for the first verified release", () => {
  const result = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: null,
    verifiedRelease: release(18),
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.persistenceRequired, true);
  assert.equal(result.rollbackFloorConfirmed, false);
  assert.equal(result.releaseSequence, 18);
  assert.equal(result.nextFloor?.floorHash, result.floorHash);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.filesystemEffectIssued, false);
});

test("release floor accepts the exact persisted identity without a write", () => {
  const initial = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: null,
    verifiedRelease: release(18),
  });
  assert.equal(initial.status, "candidate");
  const result = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: initial.nextFloor,
    verifiedRelease: release(18),
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.persistenceRequired, false);
  assert.equal(result.rollbackFloorConfirmed, true);
});

test("release floor advances monotonically and rejects rollback or equivocation", () => {
  const initial = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: null,
    verifiedRelease: release(18),
  });
  assert.equal(initial.status, "candidate");
  const advance = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: initial.nextFloor,
    verifiedRelease: release(19, "b"),
  });
  assert.equal(advance.status, "candidate");
  assert.equal(advance.persistenceRequired, true);
  assert.equal(
    evaluatePlatformProvisionerReleaseFloorCandidate({
      currentFloor: advance.nextFloor,
      verifiedRelease: release(18),
    }).reason,
    "release_floor_rollback_rejected",
  );
  assert.equal(
    evaluatePlatformProvisionerReleaseFloorCandidate({
      currentFloor: initial.nextFloor,
      verifiedRelease: release(18, "b"),
    }).reason,
    "release_floor_same_sequence_identity_mismatch",
  );
});

test("release floor rejects malformed and tampered state", () => {
  const initial = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: null,
    verifiedRelease: release(18),
  });
  assert.equal(initial.status, "candidate");
  assert.equal(
    evaluatePlatformProvisionerReleaseFloorCandidate({
      currentFloor: { ...initial.nextFloor, floorHash: "0".repeat(64) },
      verifiedRelease: release(19, "b"),
    }).reason,
    "release_floor_current_state_invalid",
  );
  for (const releaseSequence of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      evaluatePlatformProvisionerReleaseFloorCandidate({
        currentFloor: null,
        verifiedRelease: release(releaseSequence),
      }).status,
      "blocked",
    );
  }
});

test("release floor contract keeps persistence and authority separate", () => {
  const contract = describePlatformProvisionerReleaseFloorContract();
  assert.equal(contract.transitionEvaluation, "implemented_candidate");
  assert.equal(contract.persistence, "not_implemented");
  assert.equal(contract.callerStateMayConferAuthority, false);
  assert.equal(contract.runtimeAuthorityConferred, false);
});
