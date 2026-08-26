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
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  consumeRuntimeOwnedVerifiedCoordinatorPackageCapability,
  createIsolatedVerifiedPackageCapabilityStateCandidate,
  verifyBundledCoordinatorPackageCandidate,
} from "../src/security/platform-provisioner-package-filesystem.ts";
import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "./test-support.ts";

test("Task package capabilityは偽造・不正入力・再利用を受理しない", () => {
  const issued = issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
    evaluationTime: "not-a-time",
    callerRoot: "C:\\caller-selected",
  });
  assert.equal(issued.capability, null);
  const forged = Object.freeze({});
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(forged),
    false,
  );
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(forged),
    false,
  );
});

test("Package Capability状態機械はfresh exact Identityを一度だけ受理する", () => {
  const state = createIsolatedVerifiedPackageCapabilityStateCandidate();
  const identity = Object.freeze({
    manifestHash: "1".repeat(64),
    releaseSequence: 19,
    crddCommit: "2".repeat(40),
    crddTree: "3".repeat(40),
    packageContentRootSha256: "4".repeat(64),
    interactiveConsoleReaderArtifactSha256: "5".repeat(64),
  });
  const capability = state.issue(identity, 1_000);
  assert.equal(state.consume(capability, identity, 1_001), true);
  assert.equal(state.consume(capability, identity, 1_002), false);
  const stale = state.issue(identity, 1_000);
  assert.equal(state.consume(stale, identity, 6_000), false);
  for (const key of Object.keys(identity)) {
    const changed = Object.freeze({
      ...identity,
      [key]:
        key === "releaseSequence"
          ? 20
          : "6".repeat(String(identity[key as keyof typeof identity]).length),
    });
    const mismatched = state.issue(identity, 1_000);
    assert.equal(state.consume(mismatched, changed, 1_001), false, key);
  }
  const isolated = state.issue(identity, 1_000);
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(isolated),
    false,
  );
  assert.equal(state.runtimeAuthorityIssued, false);
  assert.equal(state.productionConsumerCompatible, false);
});

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
    contractRevision: 2,
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    packageContentRootSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision: 3,
      rustToolchain: "1.94.1",
      byteLength: 1024,
      sha256: "4".repeat(64),
    },
    nativeProvisionSupervisorArtifact: {
      relativePath:
        "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe",
      target: "x86_64-pc-windows-msvc",
      entrypointContractRevision: 2,
      rustToolchain: "1.94.1",
      byteLength: 2048,
      sha256: "5".repeat(64),
    },
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z",
  };
  return {
    input: {
      manifestEnvelope: {
        contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
        contractRevision: 2,
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

test("Host Operation Supervisor sourceは再帰Package inventoryのexact non-link fileである", () => {
  const entrypoint = path.resolve(
    import.meta.dirname,
    "../src/security/host-operation-lock-supervisor.ts",
  );
  const metadata = fs.lstatSync(entrypoint);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(entrypoint), entrypoint);
  const packageCandidate =
    inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(packageCandidate.status, "candidate");
  assert.equal(typeof packageCandidate.packageContentRootSha256, "string");
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
        exports: { "./cli": "./bin/coordinator.ts" },
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

test("Coordinator packageはexact CLI-only exports境界を必須にする", () => {
  for (const exportsValue of [
    undefined,
    {},
    { "./cli": "./bin/coordinator.ts", "./internal": "./src/internal.ts" },
    { "./cli": "./src/security/docker-recovery-runtime-internal.ts" },
  ]) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-package-exports-boundary-"),
    );
    try {
      const metadata: Record<string, unknown> = {
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        scripts: {},
        engines: {},
        devDependencies: {},
      };
      if (exportsValue !== undefined) metadata.exports = exportsValue;
      fs.writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify(metadata),
      );
      assert.equal(
        inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
        "blocked",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("入れ子directoryの走査中にentryを追加・削除・型変更しても安定inventoryへ流用しない", () => {
  for (const scenario of ["add", "remove", "replace_type"] as const) {
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
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(path.join(sourceRoot, "entry.ts"), "export {};");
    const changedPath = path.join(sourceRoot, "changed.ts");
    if (scenario !== "add") fs.writeFileSync(changedPath, "export {};");
    const originalRead = fs.readSync;
    const originalLstat = fs.lstatSync;
    const sourceRootMetadata = fs.lstatSync(sourceRoot, { bigint: true });
    let isChanged = false;
    Reflect.set(fs, "lstatSync", (target: fs.PathLike, ...args: unknown[]) =>
      target === sourceRoot
        ? sourceRootMetadata
        : Reflect.apply(originalLstat, fs, [target, ...args]),
    );
    Reflect.set(fs, "readSync", (descriptor: number, ...args: unknown[]) => {
      const byteLength = Reflect.apply(originalRead, fs, [descriptor, ...args]);
      if (!isChanged && byteLength > 0) {
        isChanged = true;
        if (scenario === "add") {
          fs.writeFileSync(changedPath, "export {};");
        } else {
          fs.rmSync(changedPath);
          if (scenario === "replace_type") fs.mkdirSync(changedPath);
        }
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
      Reflect.set(fs, "lstatSync", originalLstat);
      fs.rmSync(root, { recursive: true, force: true });
    }
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
  assert.equal(contract.contractRevision, 5);
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
    "posix_implemented_candidate_windows_effective_access_not_implemented",
  );
  assert.equal(
    contract.windowsSystemAndAdministratorsWriteRuntimeReadAclVerification,
    "not_implemented_effective_access_required",
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
  assert.equal(
    contract.effectController,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.taskGateAuthority,
    "held_alone_grants_no_operation_console_filesystem_provider_or_network_authority",
  );
  assert.equal(
    contract.processPoisonGate,
    "before_manifest_package_filesystem_observation",
  );
  assert.equal(
    contract.releaseIdentityRollbackFloorPersistence,
    "implemented_candidate",
  );
  assert.equal(
    contract.releaseIdentityRollbackFloorTransition,
    "implemented_candidate",
  );
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
});
