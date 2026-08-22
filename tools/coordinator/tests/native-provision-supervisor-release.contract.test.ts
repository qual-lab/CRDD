import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  beginNativeProvisionSupervisorArtifactSigningObservation,
  describeNativeProvisionSupervisorReleaseContract,
  verifyNativeProvisionSupervisorArtifactSigningObservation,
} from "../src/security/native-provision-supervisor-release.ts";

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-native-supervisor-"),
  );
  const executablePath = path.join(
    root,
    "90_Release",
    "coordinator",
    "x86_64-pc-windows-msvc",
    "coordinator.exe",
  );
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, "fixed-native-supervisor");
  return { root, executablePath };
}

test("native supervisor成果物を同一file観測へ固定する", () => {
  const value = fixture();
  try {
    const observation =
      beginNativeProvisionSupervisorArtifactSigningObservation(value.root);
    assert.ok(observation);
    assert.deepEqual(observation.artifact, {
      relativePath:
        "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe",
      target: "x86_64-pc-windows-msvc",
      entrypointContractRevision: 2,
      rustToolchain: "1.94.1",
      byteLength: 23,
      sha256:
        "356315adda5c57be2facba9e75a0e4ecddc57bc2dd1cd6da7786fd568ee3b34a",
    });
    assert.equal(
      verifyNativeProvisionSupervisorArtifactSigningObservation(
        observation.token,
      ),
      true,
    );
    fs.writeFileSync(value.executablePath, "changed-native-supervisor");
    assert.equal(
      verifyNativeProvisionSupervisorArtifactSigningObservation(
        observation.token,
      ),
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("native supervisor Release契約は固定成果物だけを許可する", () => {
  assert.deepEqual(describeNativeProvisionSupervisorReleaseContract(), {
    artifactRelativePath:
      "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe",
    target: "x86_64-pc-windows-msvc",
    rustToolchain: "1.94.1",
    entrypointContractRevision: 2,
    maximumExecutableBytes: 16 * 1024 * 1024,
    signedManifestBinding: "implemented_candidate",
    stableSameFileHashObservation: "implemented_candidate",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.equal(
    beginNativeProvisionSupervisorArtifactSigningObservation("relative"),
    null,
  );
  assert.equal(
    verifyNativeProvisionSupervisorArtifactSigningObservation({}),
    false,
  );
});
