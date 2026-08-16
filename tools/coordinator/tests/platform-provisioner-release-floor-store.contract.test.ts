import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  describePlatformProvisionerReleaseFloorStoreContract,
  loadPlatformProvisionerReleaseFloorForEffect,
  persistPlatformProvisionerReleaseFloorForEffect,
  recoverPlatformProvisionerReleaseFloorForEffect,
} from "../src/security/platform-provisioner-release-floor-store.ts";
import { evaluatePlatformProvisionerReleaseFloorCandidate } from "../src/security/platform-provisioner-release-floor.ts";

function stateRoot(t: TestContext) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-release-floor-"));
  t.after(() => fs.rmSync(parent, { force: true, recursive: true }));
  const root = path.join(parent, "state");
  fs.mkdirSync(root);
  return fs.realpathSync.native(root);
}

function release(releaseSequence: number, marker: string) {
  return {
    manifestHash: marker.repeat(64),
    releaseSequence,
    crddVersion: `v0.${releaseSequence}.0`,
    crddCommit: marker.repeat(40),
    crddTree: marker.repeat(40),
  };
}

function nextFloor(releaseSequence: number, marker: string) {
  const result = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: null,
    verifiedRelease: release(releaseSequence, marker),
  });
  assert.equal(result.status, "candidate");
  assert.ok(result.nextFloor);
  return result.nextFloor;
}

test("release floor store persists and rereads one canonical state", (t) => {
  const root = stateRoot(t);
  assert.equal(
    loadPlatformProvisionerReleaseFloorForEffect(root).reason,
    "release_floor_store_empty",
  );
  const persisted = persistPlatformProvisionerReleaseFloorForEffect(
    root,
    nextFloor(18, "a"),
  );
  assert.equal(persisted.status, "candidate");
  assert.equal(persisted.persistenceCompleted, true);
  assert.equal(persisted.filesystemEffectIssued, true);
  const loaded = loadPlatformProvisionerReleaseFloorForEffect(root);
  assert.equal(loaded.status, "candidate");
  assert.equal(loaded.releaseSequence, 18);
  assert.equal(loaded.filesystemEffectIssued, false);
});

test("release floor store advances monotonically and rejects pending overwrite", (t) => {
  const root = stateRoot(t);
  assert.equal(
    persistPlatformProvisionerReleaseFloorForEffect(root, nextFloor(18, "a"))
      .status,
    "candidate",
  );
  assert.equal(
    persistPlatformProvisionerReleaseFloorForEffect(root, nextFloor(19, "b"))
      .status,
    "candidate",
  );
  const pending = path.join(root, "release-floor.json.pending");
  fs.copyFileSync(path.join(root, "release-floor.json"), pending);
  assert.equal(
    persistPlatformProvisionerReleaseFloorForEffect(root, nextFloor(20, "c"))
      .reason,
    "release_floor_store_recovery_required",
  );
  assert.equal(
    recoverPlatformProvisionerReleaseFloorForEffect(root).status,
    "candidate",
  );
  assert.equal(fs.existsSync(pending), false);
});

test("release floor recovery rejects rollback and malformed pending state", (t) => {
  const root = stateRoot(t);
  const floor18 = nextFloor(18, "a");
  const floor19 = nextFloor(19, "b");
  assert.equal(
    persistPlatformProvisionerReleaseFloorForEffect(root, floor19).status,
    "candidate",
  );
  const otherRoot = stateRoot(t);
  assert.equal(
    persistPlatformProvisionerReleaseFloorForEffect(otherRoot, floor18).status,
    "candidate",
  );
  fs.copyFileSync(
    path.join(otherRoot, "release-floor.json"),
    path.join(root, "release-floor.json.pending"),
  );
  assert.equal(
    recoverPlatformProvisionerReleaseFloorForEffect(root).reason,
    "release_floor_store_recovery_transition_rejected",
  );
  fs.writeFileSync(path.join(root, "release-floor.json.pending"), "{}", "utf8");
  assert.equal(
    recoverPlatformProvisionerReleaseFloorForEffect(root).reason,
    "release_floor_store_pending_invalid",
  );
});

test("release floor store rejects non-state roots and exposes no generic compatibility path", (t) => {
  const root = stateRoot(t);
  assert.equal(
    loadPlatformProvisionerReleaseFloorForEffect(path.dirname(root)).status,
    "blocked",
  );
  const contract = describePlatformProvisionerReleaseFloorStoreContract();
  assert.equal(contract.persistence, "implemented_candidate");
  assert.equal(contract.compatibilityState, "prohibited");
  assert.equal(contract.runtimeAuthorityConferred, false);
});
