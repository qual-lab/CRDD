import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PROVISIONING_RECORD_STORAGE_DIRECTORY } from "../src/security/provisioning-record-store.ts";
import {
  describeProvisioningTrustFloorStoreContract,
  loadProvisioningTrustFloorForEffect,
  persistProvisioningTrustFloorForEffect,
  recoverProvisioningTrustFloorForEffect,
} from "../src/security/provisioning-trust-floor-store.ts";
import { evaluateProvisioningTrustFloorCandidate } from "../src/security/provisioning-trust-floor.ts";

const trust = Object.freeze({
  trustEpoch: 1,
  trustAnchorSetHash: "1".repeat(64),
  revocationRevision: 1,
  revocationManifestHash: "2".repeat(64),
});

function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-trust-floor-"));
  const root = path.join(parent, PROVISIONING_RECORD_STORAGE_DIRECTORY);
  fs.mkdirSync(root);
  return { parent, root };
}

function floor(verifiedTrust: unknown = trust, currentFloor: unknown = null) {
  const result = evaluateProvisioningTrustFloorCandidate({
    currentFloor,
    verifiedTrust,
  });
  assert.equal(result.status, "candidate");
  if (!("nextFloor" in result)) throw new Error("next floor required");
  return result.nextFloor;
}

test("Trust floorを保存し単調に更新する", () => {
  const target = fixture();
  try {
    const initial = floor();
    const persisted = persistProvisioningTrustFloorForEffect(
      target.root,
      initial,
    );
    assert.equal(persisted.status, "candidate");
    assert.equal(persisted.filesystemEffectIssued, true);
    const loaded = loadProvisioningTrustFloorForEffect(target.root);
    assert.equal(loaded.status, "candidate");
    assert.equal(loaded.floorHash, persisted.floorHash);
    const next = floor(
      {
        ...trust,
        revocationRevision: 2,
        revocationManifestHash: "3".repeat(64),
      },
      initial,
    );
    assert.equal(
      persistProvisioningTrustFloorForEffect(target.root, next).status,
      "candidate",
    );
    assert.equal(
      persistProvisioningTrustFloorForEffect(target.root, initial).reason,
      "provisioning_trust_floor_store_transition_rejected",
    );
  } finally {
    fs.rmSync(target.parent, { recursive: true, force: true });
  }
});

test("pending Trust floorを明示復旧し不正状態を保持する", () => {
  const target = fixture();
  try {
    assert.equal(
      persistProvisioningTrustFloorForEffect(target.root, floor()).status,
      "candidate",
    );
    const contract = describeProvisioningTrustFloorStoreContract();
    const current = path.join(target.root, "trust-floor.json");
    const pending = `${current}.pending`;
    fs.renameSync(current, pending);
    assert.equal(
      loadProvisioningTrustFloorForEffect(target.root).status,
      "blocked",
    );
    assert.equal(
      recoverProvisioningTrustFloorForEffect(target.root).status,
      "candidate",
    );
    fs.writeFileSync(pending, "{}", { flag: "wx" });
    assert.equal(
      recoverProvisioningTrustFloorForEffect(target.root).recoveryRequired,
      true,
    );
    assert.equal(contract.repositoryCanonicalStateStored, false);
  } finally {
    fs.rmSync(target.parent, { recursive: true, force: true });
  }
});
