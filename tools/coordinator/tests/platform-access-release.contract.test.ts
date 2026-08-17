import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  beginPlatformAccessArtifactSigningObservation,
  describePlatformAccessReleaseContract,
  observePlatformAccessReleaseArtifactCandidate,
  verifyPlatformAccessArtifactSigningObservation,
} from "../src/security/platform-access-release.ts";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-platform-release-"));
  const executablePath = path.join(
    root,
    ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  const bytes = Buffer.from("fixed-platform-access-binary", "ascii");
  fs.writeFileSync(executablePath, bytes);
  return { root, executablePath, bytes };
}

test("固定release PathのRust成果物を同一handleでHashへ結合する", () => {
  const value = fixture();
  try {
    const observed = observePlatformAccessReleaseArtifactCandidate(value.root);
    assert.equal(observed.status, "candidate");
    assert.equal(observed.artifact?.byteLength, value.bytes.length);
    assert.equal(
      observed.artifact?.sha256,
      createHash("sha256").update(value.bytes).digest("hex"),
    );
    assert.equal(observed.absolutePathReported, false);
    const signingObservation = beginPlatformAccessArtifactSigningObservation(
      value.root,
    );
    assert.notEqual(signingObservation, null);
    assert.equal(
      signingObservation &&
        verifyPlatformAccessArtifactSigningObservation(
          signingObservation.token,
        ),
      true,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("欠落fileおよび署名観測後のfileとRoot置換を拒否する", () => {
  const value = fixture();
  try {
    const observed = observePlatformAccessReleaseArtifactCandidate(value.root);
    assert.equal(observed.status, "candidate");
    const signingObservation = beginPlatformAccessArtifactSigningObservation(
      value.root,
    );
    assert.notEqual(signingObservation, null);
    fs.writeFileSync(value.executablePath, "changed");
    assert.equal(
      signingObservation &&
        verifyPlatformAccessArtifactSigningObservation(
          signingObservation.token,
        ),
      false,
    );
    fs.rmSync(value.executablePath);
    assert.equal(
      observePlatformAccessReleaseArtifactCandidate(value.root).status,
      "blocked",
    );
    const replacement = `${value.root}-replacement`;
    fs.renameSync(value.root, replacement);
    fs.mkdirSync(value.root);
    assert.equal(
      signingObservation &&
        verifyPlatformAccessArtifactSigningObservation(
          signingObservation.token,
        ),
      false,
    );
    fs.rmSync(value.root, { recursive: true, force: true });
    fs.renameSync(replacement, value.root);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("release contractは固定targetと非公開process境界を示す", () => {
  const contract = describePlatformAccessReleaseContract();
  assert.equal(
    contract.artifactRelativePath,
    PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  );
  assert.equal(contract.target, "x86_64-pc-windows-msvc");
  assert.equal(contract.protocolRevision, 1);
  assert.equal(contract.signedManifestBinding, "implemented_candidate");
  assert.equal(contract.pathEnvironmentLookup, false);
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
