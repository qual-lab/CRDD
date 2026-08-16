import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  describePlatformProvisionerActiveReleaseStoreContract,
  loadPlatformProvisionerActiveReleaseForEffect,
  persistPlatformProvisionerActiveReleaseForEffect,
  recoverPlatformProvisionerActiveReleaseForEffect,
} from "../src/security/platform-provisioner-active-release-store.ts";
import { evaluatePlatformProvisionerActiveReleaseCandidate } from "../src/security/platform-provisioner-active-release.ts";

function stateRoot(t: TestContext) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-active-release-"));
  t.after(() => fs.rmSync(parent, { force: true, recursive: true }));
  const root = path.join(parent, "state");
  fs.mkdirSync(root);
  return fs.realpathSync.native(root);
}

function activeRelease(releaseSequence: number, marker: string) {
  const result = evaluatePlatformProvisionerActiveReleaseCandidate({
    verifiedRelease: {
      manifestHash: marker.repeat(64),
      releaseSequence,
      crddVersion: `v0.${releaseSequence}.0`,
      crddCommit: marker.repeat(40),
      crddTree: marker.repeat(40),
      packageContentRootSha256: marker.repeat(64),
    },
    confirmedFloor: {
      floorHash: "f".repeat(64),
      releaseSequence,
    },
  });
  if (result.status !== "candidate") assert.fail(result.reason);
  return result.nextActiveRelease;
}

test("active release store persists and rereads one canonical pointer", (t) => {
  const root = stateRoot(t);
  assert.equal(
    loadPlatformProvisionerActiveReleaseForEffect(root).reason,
    "active_release_store_empty",
  );
  const persisted = persistPlatformProvisionerActiveReleaseForEffect(
    root,
    activeRelease(18, "a"),
  );
  assert.equal(persisted.status, "candidate");
  assert.equal(persisted.filesystemEffectIssued, true);
  const loaded = loadPlatformProvisionerActiveReleaseForEffect(root);
  assert.equal(loaded.status, "candidate");
  assert.equal(loaded.releaseSequence, 18);
});

test("active release store requires explicit recovery and rejects conflicts", (t) => {
  const root = stateRoot(t);
  assert.equal(
    persistPlatformProvisionerActiveReleaseForEffect(
      root,
      activeRelease(18, "a"),
    ).status,
    "candidate",
  );
  const pending = path.join(root, "active-release.json.pending");
  fs.copyFileSync(path.join(root, "active-release.json"), pending);
  assert.equal(
    persistPlatformProvisionerActiveReleaseForEffect(
      root,
      activeRelease(19, "b"),
    ).reason,
    "active_release_store_recovery_required",
  );
  assert.equal(
    recoverPlatformProvisionerActiveReleaseForEffect(root).status,
    "candidate",
  );
  fs.writeFileSync(pending, "{}", "utf8");
  assert.equal(
    recoverPlatformProvisionerActiveReleaseForEffect(root).reason,
    "active_release_store_pending_invalid",
  );
});

test("active release store exposes no repository or compatibility state", (t) => {
  const root = stateRoot(t);
  assert.equal(
    loadPlatformProvisionerActiveReleaseForEffect(path.dirname(root)).status,
    "blocked",
  );
  const contract = describePlatformProvisionerActiveReleaseStoreContract();
  assert.equal(contract.persistence, "implemented_candidate");
  assert.equal(contract.repositoryRuntimeStateRequired, false);
  assert.equal(contract.compatibilityState, "prohibited");
});
