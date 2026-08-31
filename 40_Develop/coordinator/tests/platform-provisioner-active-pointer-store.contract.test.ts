import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createPlatformProvisionerActivePointerCandidate,
  encodePlatformProvisionerActivePointerCandidate,
} from "../src/security/platform-provisioner-active-pointer.ts";
import {
  describePlatformProvisionerActivePointerStoreContract,
  loadPlatformProvisionerActivePointerCandidate,
  persistPlatformProvisionerActivePointerForEffect,
  readPlatformProvisionerActivePointerForRuntime,
} from "../src/security/platform-provisioner-active-pointer-store.ts";

function pointer() {
  return createPlatformProvisionerActivePointerCandidate({
    activeId: "0123456789abcdef0123456789abcdef",
    previousActiveHash: null,
    releaseSequence: 1,
    crddVersion: "v0.18.0",
    crddCommit: "1".repeat(40),
    crddTree: "2".repeat(40),
    manifestHash: "a".repeat(64),
    packageContentRootSha256: "b".repeat(64),
    rootIdentityHash: "c".repeat(64),
    rootProtectionHash: "d".repeat(64),
    runtimePrincipalMode: "local_interactive_selected_user",
    runtimePrincipalIdentityHash: "e".repeat(64),
    platformAccessArtifactIdentityHash: "f".repeat(64),
    platformAccessArtifactSha256: "9".repeat(64),
    platformAccessArtifactByteLength: 1024,
  });
}

test("active pointer storeはcanonicalな同一fileだけを安定読取りする", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-pointer-"));
  const stateRoot = path.join(temporaryRoot, "state");
  fs.mkdirSync(stateRoot);
  try {
    const created = pointer();
    assert.equal(created.status, "candidate");
    const encoded = encodePlatformProvisionerActivePointerCandidate(
      created.nextActivePointer,
    );
    assert.equal(encoded.status, "candidate");
    fs.writeFileSync(
      path.join(stateRoot, "active-pointer.json"),
      encoded.canonicalBytes,
    );
    const loaded = loadPlatformProvisionerActivePointerCandidate(stateRoot);
    assert.equal(loaded.status, "candidate");
    assert.equal(loaded.activeHash, created.activeHash);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true });
  }
});

test("active pointer storeは旧名・noncanonical・不存在をfallbackしない", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-pointer-"));
  const stateRoot = path.join(temporaryRoot, "state");
  fs.mkdirSync(stateRoot);
  try {
    fs.writeFileSync(path.join(stateRoot, "active-release.json"), "{}");
    assert.equal(
      loadPlatformProvisionerActivePointerCandidate(stateRoot).status,
      "blocked",
    );
    fs.writeFileSync(path.join(stateRoot, "active-pointer.json"), "{}\n");
    assert.equal(
      loadPlatformProvisionerActivePointerCandidate(stateRoot).status,
      "blocked",
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true });
  }
});

test("native durabilityとRuntime保護結合前はEffectと読取りをblockedにする", () => {
  assert.equal(
    persistPlatformProvisionerActivePointerForEffect({}, {}).reason,
    "active_pointer_native_durable_store_not_implemented",
  );
  assert.equal(
    readPlatformProvisionerActivePointerForRuntime({}).reason,
    "active_pointer_protected_root_and_verified_image_binding_not_implemented",
  );
  const contract = describePlatformProvisionerActivePointerStoreContract();
  assert.equal(contract.directoryFallback, "prohibited");
  assert.equal(contract.compatibilityState, "prohibited");
  assert.equal(contract.filesystemEffectIssued, false);
});
