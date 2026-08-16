import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  describePlatformProvisionerPackageFilesystemContract,
  inspectBundledCoordinatorPackageFilesystemCandidate,
  inspectPlatformProvisionerPackageFilesystemCandidate,
  verifyBundledCoordinatorPackageCandidate,
} from "../src/security/platform-provisioner-package-filesystem.ts";
import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "./test-support.ts";

function frame(payload: Record<string, unknown>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  assertCanonicalCandidate(canonical);
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return Buffer.concat([
    Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii"),
    length,
    canonical.canonicalBytes,
  ]);
}

function signedManifest(packageContentRootSha256: string) {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: 1,
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    packageContentRootSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z",
  };
  return {
    input: {
      manifestEnvelope: {
        contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
        contractRevision: 1,
        payload,
        signatures: [
          {
            keyId: createHash("sha256").update(spki).digest("hex"),
            algorithm: "Ed25519",
            signature: sign(null, frame(payload), signer.privateKey).toString(
              "base64url",
            ),
          },
        ],
      },
      evaluationTime: "2026-08-16T00:00:00.000Z",
      expectedCrddVersion: payload.crddVersion,
      expectedCrddCommit: payload.crddCommit,
      expectedCrddTree: payload.crddTree,
    },
  };
}

test("固定Coordinator packageをPath非公開で一覧化する", () => {
  const result = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(result.status, "candidate");
  assert.equal(result.packageName, "@qual-lab/crdd-coordinator");
  assert.equal(result.runtimeOwnedPackageRoot, true);
  assert.equal(result.stableFilesystemIdentityObserved, true);
  assert.equal(typeof result.permissionPolicyConfirmed, "boolean");
  if (process.platform === "win32") {
    assert.equal(result.permissionPolicyConfirmed, false);
  }
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal("files" in result, false);
  assert.equal("packageRoot" in result, false);
  assert.equal("path" in result, false);
});

test("caller選択Rootは非Authorityのまま内容変更をcontent rootへ反映する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-package-observation-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 1;\n",
    );
    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    assert.equal(first.runtimeOwnedPackageRoot, false);
    assert.equal(first.runtimeCapabilityIssued, false);
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 2;\n",
    );
    const second = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(second.status, "candidate");
    assert.notEqual(
      first.packageContentRootSha256,
      second.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("入れ子directoryの走査中変更を安定inventoryへ流用しない", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-package-directory-race-"),
  );
  const sourceRoot = path.join(root, "src");
  fs.mkdirSync(sourceRoot);
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@qual-lab/crdd-coordinator",
      version: "0.0.0-development",
      private: true,
      type: "module",
      scripts: {},
      engines: {},
      devDependencies: {},
    }),
  );
  fs.writeFileSync(path.join(sourceRoot, "entry.ts"), "export {};");
  const originalRead = fs.readSync;
  let isChanged = false;
  Reflect.set(fs, "readSync", (descriptor: number, ...args: unknown[]) => {
    const byteLength = Reflect.apply(originalRead, fs, [descriptor, ...args]);
    if (!isChanged && byteLength > 0) {
      isChanged = true;
      fs.writeFileSync(path.join(sourceRoot, "late.ts"), "export {};");
    }
    return byteLength;
  });
  try {
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs, "readSync", originalRead);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("同梱manifestは固定Release鍵以外の署名を拒否する", () => {
  const observation = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observation.status, "candidate");
  assert.equal(typeof observation.packageContentRootSha256, "string");
  const fixture = signedManifest(observation.packageContentRootSha256);
  const result = verifyBundledCoordinatorPackageCandidate(fixture.input);
  assert.equal(result.status, "blocked");
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal("files" in result, false);
  assert.equal("signature" in result, false);
  assert.equal("releaseSignerSpkiDer" in result, false);
});

test("不正Root、Release Identity不一致およびpackage metadataをfail closedにする", () => {
  assert.equal(
    inspectPlatformProvisionerPackageFilesystemCandidate(null).status,
    "blocked",
  );
  const observation = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observation.status, "candidate");
  assert.equal(typeof observation.packageContentRootSha256, "string");
  const fixture = signedManifest(observation.packageContentRootSha256);
  fixture.input.expectedCrddCommit = "c".repeat(40);
  assert.equal(
    verifyBundledCoordinatorPackageCandidate(fixture.input).status,
    "blocked",
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-package-invalid-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("package Filesystem contractは観測をTrustおよびEffectから分離する", () => {
  const contract = describePlatformProvisionerPackageFilesystemContract();
  assert.equal(
    contract.runtimeOwnedPackageFilesystemRead,
    "implemented_candidate_without_permission_authority",
  );
  assert.equal(
    contract.runtimeOwnedCrddReleaseIdentitySelection,
    "implemented_fixed_manifest_signature_and_distribution_git_tree_candidate",
  );
  assert.equal(
    contract.runtimeOwnedReleaseTrustSelection,
    "implemented_single_ed25519_anchor_pinned",
  );
  assert.equal(
    contract.ownerAndPermissionPolicyVerification,
    "posix_implemented_candidate_windows_not_implemented",
  );
  assert.equal(
    contract.releaseTrustModel,
    "qual_lab_ed25519_single_active_key_pinned_in_verified_crdd_release",
  );
  assert.equal(
    contract.signedManifestPath,
    "90_Release/coordinator-package-manifest.json",
  );
  assert.equal(
    contract.releaseTrustAnchorConfiguration,
    "configured_immutable_source_literal",
  );
  assert.equal(
    contract.policyIdentityBinding,
    "owned_root_protection_and_key_storage_policy_hashes_required",
  );
  assert.equal(contract.effectController, "not_implemented");
  assert.equal(
    contract.releaseIdentityRollbackFloorPersistence,
    "not_implemented",
  );
  assert.equal(
    contract.releaseIdentityRollbackFloorTransition,
    "implemented_candidate",
  );
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
});
