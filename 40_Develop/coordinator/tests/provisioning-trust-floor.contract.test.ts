import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeProvisioningTrustFloorBytesCandidate,
  describeProvisioningTrustFloorContract,
  encodeProvisioningTrustFloorCandidate,
  evaluateProvisioningTrustFloorCandidate,
} from "../src/security/provisioning-trust-floor.ts";

const trust = Object.freeze({
  trustEpoch: 1,
  trustAnchorSetHash: "1".repeat(64),
  revocationRevision: 1,
  revocationManifestHash: "2".repeat(64),
});

function initial() {
  const result = evaluateProvisioningTrustFloorCandidate({
    currentFloor: null,
    verifiedTrust: trust,
  });
  assert.equal(result.status, "candidate");
  assert.equal("nextFloor" in result, true);
  if (!("nextFloor" in result)) throw new Error("next floor required");
  return result;
}

test("初回Trust状態をcanonical floorへ固定する", () => {
  const result = initial();
  assert.equal(result.persistenceRequired, true);
  assert.equal(result.rollbackFloorConfirmed, false);
  const encoded = encodeProvisioningTrustFloorCandidate(result.nextFloor);
  assert.equal(encoded.status, "candidate");
  if (!("canonicalBytes" in encoded)) throw new Error("bytes required");
  const decoded = decodeProvisioningTrustFloorBytesCandidate(
    encoded.canonicalBytes,
  );
  assert.equal(decoded.status, "candidate");
  assert.equal(
    evaluateProvisioningTrustFloorCandidate({
      currentFloor: result.nextFloor,
      verifiedTrust: trust,
    }).rollbackFloorConfirmed,
    true,
  );
});

test("epochとrevocation rollbackおよび同revision差替えを拒否する", () => {
  const current = initial().nextFloor;
  const advanced = evaluateProvisioningTrustFloorCandidate({
    currentFloor: current,
    verifiedTrust: {
      ...trust,
      revocationRevision: 2,
      revocationManifestHash: "3".repeat(64),
    },
  });
  assert.equal(advanced.status, "candidate");
  assert.equal(
    evaluateProvisioningTrustFloorCandidate({
      currentFloor: advanced.nextFloor,
      verifiedTrust: trust,
    }).reason,
    "provisioning_trust_floor_revocation_rollback_rejected",
  );
  assert.equal(
    evaluateProvisioningTrustFloorCandidate({
      currentFloor: current,
      verifiedTrust: { ...trust, trustAnchorSetHash: "4".repeat(64) },
    }).reason,
    "provisioning_trust_floor_same_epoch_anchor_mismatch",
  );
  assert.equal(
    evaluateProvisioningTrustFloorCandidate({
      currentFloor: current,
      verifiedTrust: { ...trust, revocationManifestHash: "5".repeat(64) },
    }).reason,
    "provisioning_trust_floor_same_revocation_revision_mismatch",
  );
});

test("新epochは新しいanchorとrevocation系列を開始できる", () => {
  const result = evaluateProvisioningTrustFloorCandidate({
    currentFloor: initial().nextFloor,
    verifiedTrust: {
      trustEpoch: 2,
      trustAnchorSetHash: "6".repeat(64),
      revocationRevision: 1,
      revocationManifestHash: "7".repeat(64),
    },
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.persistenceRequired, true);
  assert.equal(
    describeProvisioningTrustFloorContract().persistence,
    "dedicated_store_implemented_candidate",
  );
  assert.equal(JSON.stringify(result).includes("canonicalBytes"), false);
});
