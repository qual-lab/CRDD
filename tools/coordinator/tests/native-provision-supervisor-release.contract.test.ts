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
import { createNativeBootstrapPeFixture } from "./native-bootstrap-pe-fixture.ts";

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
  fs.writeFileSync(executablePath, createNativeBootstrapPeFixture());
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
      byteLength: 6144,
      sha256:
        "31ec4f5db562529c41cb7a3cb03714beac9be9f7a95ea93ee0c26d58ce8f3e5a",
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

test("PE policy不一致を署名観測とstaging開始前に拒否する", () => {
  const value = fixture();
  try {
    const bytes = fs.readFileSync(value.executablePath);
    bytes[0x800] = 0xcb;
    fs.writeFileSync(value.executablePath, bytes);
    assert.equal(
      beginNativeProvisionSupervisorArtifactSigningObservation(value.root),
      null,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});
