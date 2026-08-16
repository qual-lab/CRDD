import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { evaluatePlatformProvisionerActiveReleaseCandidate } from "../src/security/platform-provisioner-active-release.ts";
import { loadPlatformProvisionerActiveReleaseForEffect } from "../src/security/platform-provisioner-active-release-store.ts";
import { evaluatePlatformProvisionerReleaseFloorCandidate } from "../src/security/platform-provisioner-release-floor.ts";
import { loadPlatformProvisionerReleaseFloorForEffect } from "../src/security/platform-provisioner-release-floor-store.ts";
import {
  describePlatformProvisionerStateTransactionContract,
  persistPlatformProvisionerStateTransactionForEffect,
  recoverPlatformProvisionerStateTransactionForEffect,
} from "../src/security/platform-provisioner-state-transaction.ts";

function stateRoot(t: TestContext) {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-state-transaction-"),
  );
  t.after(() => fs.rmSync(parent, { force: true, recursive: true }));
  const root = path.join(parent, "state");
  fs.mkdirSync(root);
  return fs.realpathSync.native(root);
}

function transition(releaseSequence: number, marker: string) {
  const release = {
    manifestHash: marker.repeat(64),
    releaseSequence,
    crddVersion: `v0.${releaseSequence}.0`,
    crddCommit: marker.repeat(40),
    crddTree: marker.repeat(40),
    packageContentRootSha256: marker.repeat(64),
  };
  const floor = evaluatePlatformProvisionerReleaseFloorCandidate({
    currentFloor: null,
    verifiedRelease: {
      manifestHash: release.manifestHash,
      releaseSequence: release.releaseSequence,
      crddVersion: release.crddVersion,
      crddCommit: release.crddCommit,
      crddTree: release.crddTree,
    },
  });
  if (floor.status !== "candidate") assert.fail(floor.reason);
  const active = evaluatePlatformProvisionerActiveReleaseCandidate({
    verifiedRelease: release,
    confirmedFloor: {
      floorHash: floor.floorHash,
      releaseSequence,
    },
  });
  if (active.status !== "candidate") assert.fail(active.reason);
  return Object.freeze({
    previousFloorHash: null,
    previousActiveHash: null,
    nextFloor: floor.nextFloor,
    nextActiveRelease: active.nextActiveRelease,
  });
}

test("state transaction commits floor and active release as one recoverable intent", (t) => {
  const root = stateRoot(t);
  const result = persistPlatformProvisionerStateTransactionForEffect(
    root,
    transition(18, "a"),
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.persistenceCompleted, true);
  assert.equal(
    fs.existsSync(path.join(root, "provision-transaction.json")),
    false,
  );
  assert.equal(
    loadPlatformProvisionerReleaseFloorForEffect(root).releaseSequence,
    18,
  );
  assert.equal(
    loadPlatformProvisionerActiveReleaseForEffect(root).releaseSequence,
    18,
  );
});

test("state transaction fails closed for invalid roots and mismatched state", (t) => {
  const root = stateRoot(t);
  const input = transition(18, "a");
  assert.equal(
    persistPlatformProvisionerStateTransactionForEffect(
      path.dirname(root),
      input,
    ).status,
    "blocked",
  );
  assert.equal(
    persistPlatformProvisionerStateTransactionForEffect(root, {
      ...input,
      previousFloorHash: "b".repeat(64),
    }).reason,
    "state_transaction_floor_conflict",
  );
});

test("state transaction recovery is explicit and keeps repository state out", (t) => {
  const root = stateRoot(t);
  assert.equal(
    recoverPlatformProvisionerStateTransactionForEffect(root).reason,
    "state_transaction_absent",
  );
  const contract = describePlatformProvisionerStateTransactionContract();
  assert.equal(contract.persistence, "implemented_candidate");
  assert.equal(
    contract.runtimeBehaviorWhilePending,
    "blocked_until_explicit_provision_recovery",
  );
  assert.equal(contract.repositoryRuntimeStateRequired, false);
});
