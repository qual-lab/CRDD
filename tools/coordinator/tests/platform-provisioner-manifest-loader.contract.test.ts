import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectPlatformProvisionerManifestFileCandidate,
  loadPlatformProvisionerManifestEnvelopeForVerification,
} from "../src/security/platform-provisioner-manifest-loader.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";

function fixtureEnvelope() {
  return {
    contract: "crdd-coordinator/platform-provisioner-package-manifest-envelope",
    contractRevision: 2,
    payload: { fixture: true },
    signatures: [
      {
        keyId: "0".repeat(64),
        algorithm: "Ed25519",
        signature: "A".repeat(86),
      },
    ],
  };
}

function withDistribution(
  bytes: Buffer,
  verify: (distributionRoot: string) => void,
) {
  const distributionRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-manifest-loader-"),
  );
  try {
    const releaseDirectory = path.join(distributionRoot, "90_Release");
    fs.mkdirSync(releaseDirectory);
    fs.writeFileSync(
      path.join(releaseDirectory, "coordinator-package-manifest.json"),
      bytes,
    );
    verify(distributionRoot);
  } finally {
    fs.rmSync(distributionRoot, { recursive: true, force: true });
  }
}

test("固定Pathのcanonical manifest bytesだけを安定読込する", () => {
  const canonical = canonicalizeProvisioningJsonValueCandidate(
    fixtureEnvelope(),
  );
  assert.equal(canonical.status, "candidate");
  if (canonical.status !== "candidate") return;
  withDistribution(canonical.canonicalBytes, (distributionRoot) => {
    const inspected =
      inspectPlatformProvisionerManifestFileCandidate(distributionRoot);
    assert.equal(inspected.status, "candidate");
    assert.equal(inspected.canonicalManifestEncodingConfirmed, true);
    const loaded =
      loadPlatformProvisionerManifestEnvelopeForVerification(distributionRoot);
    assert.deepEqual(loaded.envelope, fixtureEnvelope());
    assert.equal("bytes" in loaded, false);
  });
});

test("非canonical JSON、BOM、相対Rootおよび欠落manifestを拒否する", () => {
  withDistribution(
    Buffer.from(`${JSON.stringify(fixtureEnvelope())}\n`),
    (root) => {
      assert.equal(
        inspectPlatformProvisionerManifestFileCandidate(root).status,
        "blocked",
      );
    },
  );
  withDistribution(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("{}")]),
    (root) => {
      assert.equal(
        inspectPlatformProvisionerManifestFileCandidate(root).status,
        "blocked",
      );
    },
  );
  assert.equal(
    inspectPlatformProvisionerManifestFileCandidate("relative").status,
    "blocked",
  );
  const emptyRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-manifest-empty-"),
  );
  try {
    assert.equal(
      inspectPlatformProvisionerManifestFileCandidate(emptyRoot).status,
      "blocked",
    );
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});
