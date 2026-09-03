import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { createDevelopmentMeasurementConstraints } from "../src/security/development-measurement-constraints.ts";
import {
  consumeRuntimeOwnedVerifiedCoordinatorPackageCapability,
  createIsolatedVerifiedPackageCapabilityStateCandidate,
  describePlatformProvisionerPackageFilesystemContract,
  inspectBundledCoordinatorPackageFilesystemCandidate,
  inspectFixedDevelopmentCoordinatorPackageCandidate,
  inspectPlatformProvisionerPackageFilesystemCandidate,
  inspectVerifiedNativeDistributionCandidate,
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  verifyBundledCoordinatorPackageCandidate,
} from "../src/security/platform-provisioner-package-filesystem.ts";
import {
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_REVISION,
  calculateRuntimeExecutionIdentityCandidate,
} from "../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "./test-support.ts";

const developmentFixtureRoots = new Set<string>();

function removeDevelopmentFixture(root: string) {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.equal(fs.realpathSync.native(root), root);
  fs.rmSync(root, { recursive: true, force: true });
  developmentFixtureRoots.delete(root);
}

after(() => {
  for (const root of developmentFixtureRoots) removeDevelopmentFixture(root);
});

function developmentFixture(omittedEntrypoint: string | null = null) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-development-package-"),
  );
  developmentFixtureRoots.add(root);
  const distributionRoot = path.join(root, "distribution");
  const packageRoot = path.join(distributionRoot, "40_Develop", "coordinator");
  const entrypoints = [
    "bin/coordinator.ts",
    "src/core/interactive-console-reader.ts",
    "src/security/candidate-store-lock-worker.ts",
    "src/security/host-operation-lock-supervisor.ts",
  ];
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "package.json"),
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
  for (const entrypoint of entrypoints) {
    if (entrypoint === omittedEntrypoint) continue;
    const target = path.join(packageRoot, entrypoint);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "export const fixture = true;\n");
  }
  fs.writeFileSync(
    path.join(distributionRoot, "README.md"),
    "# Fixed fixture\n",
  );
  const oracleRoot = path.join(root, "oracle");
  fs.cpSync(distributionRoot, oracleRoot, { recursive: true });
  function git(...args: string[]) {
    const result = spawnSync("git", ["-C", oracleRoot, ...args], {
      encoding: "utf8",
      shell: false,
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git("init", "--quiet");
  git("-c", "core.autocrlf=false", "add", "--force", "--", ".");
  const expectedCrddTree = git("write-tree");
  const observed =
    inspectPlatformProvisionerPackageFilesystemCandidate(packageRoot);
  assert.equal(observed.status, "candidate");
  return {
    root,
    distributionRoot,
    packageRoot,
    input: {
      distributionRoot,
      expectedPackageContentRootSha256: observed.packageContentRootSha256,
    },
    expectedCrddTree,
    cleanup() {
      removeDevelopmentFixture(root);
    },
  };
}

test("開発版はRuntime依存閉包を実体照合し、署名・実行Authorityを発行しない", () => {
  const fixture = developmentFixture();
  try {
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "candidate");
    assert.equal(result.executionSourceKind, "fixed_development_candidate");
    assert.equal(result.entrypoints.length, 4);
    assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
    assert.equal(result.releaseIdentityRuntimeOwned, false);
    assert.equal(result.crddDistributionConfirmed, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.networkEffectIssued, false);
    assert.equal(JSON.stringify(result).includes(fixture.root), false);
    const repeated = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(repeated.status, "candidate");
    assert.equal(repeated.sourceIdentitySha256, result.sourceIdentitySha256);
    const previousRoot = path.join(fixture.root, "previous");
    fs.renameSync(fixture.distributionRoot, previousRoot);
    fs.cpSync(previousRoot, fixture.distributionRoot, { recursive: true });
    const replaced = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(replaced.status, "candidate");
    assert.notEqual(replaced.sourceIdentitySha256, result.sourceIdentitySha256);
  } finally {
    fixture.cleanup();
  }
});

test("Tree一致だけで起動entrypointの不足を受理しない", () => {
  const fixture = developmentFixture("src/core/interactive-console-reader.ts");
  try {
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "development_package_entrypoint_missing");
  } finally {
    fixture.cleanup();
  }
});

for (const target of ["package", "expected_package"] as const) {
  test(`開発版の${target}差替えを拒否する`, () => {
    const fixture = developmentFixture();
    try {
      const input = { ...fixture.input };
      if (target === "package")
        fs.appendFileSync(
          path.join(fixture.packageRoot, "bin", "coordinator.ts"),
          "// changed\n",
        );
      if (target === "expected_package")
        input.expectedPackageContentRootSha256 = "d".repeat(64);
      const result = inspectFixedDevelopmentCoordinatorPackageCandidate(input);
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "development_package_identity_mismatch");
      assert.equal(result.runtimeAuthorityConferred, false);
    } finally {
      fixture.cleanup();
    }
  });
}

test("Runtime依存外の文書変更は開発Source Identityを失効させない", () => {
  const fixture = developmentFixture();
  try {
    const initial = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(initial.status, "candidate");
    fs.appendFileSync(
      path.join(fixture.distributionRoot, "README.md"),
      "changed\n",
    );
    const changed = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(changed.status, "candidate");
    assert.equal(changed.sourceIdentitySha256, initial.sourceIdentitySha256);
  } finally {
    fixture.cleanup();
  }
});

test("開発版へ混入した署名manifestをReleaseへ昇格しない", () => {
  const fixture = developmentFixture();
  try {
    const target = path.join(
      fixture.distributionRoot,
      "template/tools/coordinator/coordinator-package-manifest.json",
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "not a trusted artifact");
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "development_package_release_artifact_present");
  } finally {
    fixture.cleanup();
  }
});

for (const relativePath of [
  "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
]) {
  test(`開発Sourceと別に検証する${relativePath}をSource Identityへ混在させない`, () => {
    const fixture = developmentFixture();
    try {
      const target = path.join(fixture.distributionRoot, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "not a trusted artifact");
      const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
        fixture.input,
      );
      assert.equal(result.status, "candidate");
    } finally {
      fixture.cleanup();
    }
  });
}

test("開発版のRoot alias、入力getterと追加keyを拒否し、Git metadataだけをTreeから除外する", () => {
  const fixture = developmentFixture();
  try {
    let getterCalls = 0;
    const accessor = Object.defineProperty(
      { ...fixture.input },
      "expectedCrddTree",
      {
        get() {
          getterCalls += 1;
          return fixture.expectedCrddTree;
        },
      },
    );
    for (const input of [
      accessor,
      { ...fixture.input, extra: true },
      { ...fixture.input, distributionRoot: "relative" },
    ]) {
      assert.equal(
        inspectFixedDevelopmentCoordinatorPackageCandidate(input).status,
        "blocked",
      );
    }
    assert.equal(getterCalls, 0);
    const alias = path.join(fixture.root, "alias");
    fs.symlinkSync(
      fixture.distributionRoot,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate({
        ...fixture.input,
        distributionRoot: alias,
      }).status,
      "blocked",
    );
    fs.mkdirSync(path.join(fixture.distributionRoot, ".git"));
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate(fixture.input).status,
      "candidate",
    );
  } finally {
    fixture.cleanup();
  }
});

test("実体観測と開始枠を結合し、準備待機後のRoot差替えで消費を拒否する", async () => {
  const fixture = developmentFixture();
  try {
    const initial = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(initial.status, "candidate");
    // Identity component only: this test does not supply human approval or
    // exercise the not-yet-connected production execution boundary.
    const observe = () => {
      const current = inspectFixedDevelopmentCoordinatorPackageCandidate(
        fixture.input,
      );
      return current.status === "candidate"
        ? {
            bindingSha256: current.sourceIdentitySha256,
            wallTimeMs: 100,
            monotonicTimeMs: 100,
          }
        : null;
    };
    const scopeSha256 = "1".repeat(64);
    const constraints = createDevelopmentMeasurementConstraints(
      {
        bindingSha256: initial.sourceIdentitySha256,
        expiresAtMs: 1_100,
        tasks: [
          { scopeSha256, executor: "codex", reviewer: "claude" },
          {
            scopeSha256: "2".repeat(64),
            executor: "claude",
            reviewer: "codex",
          },
        ],
      },
      observe(),
    );
    assert.ok(constraints);
    const task = constraints.reserveTask(scopeSha256, observe());
    assert.equal(task.status, "recorded");
    const invocation = constraints.reserveInvocation(
      task.value,
      "codex",
      "executor",
      observe(),
    );
    assert.equal(invocation.status, "recorded");
    await Promise.resolve().then(() => {
      const previousRoot = path.join(fixture.root, "previous");
      fs.renameSync(fixture.distributionRoot, previousRoot);
      fs.cpSync(previousRoot, fixture.distributionRoot, { recursive: true });
    });
    const result = constraints.consumeInvocation(
      invocation.value,
      task.value,
      "codex",
      "executor",
      observe(),
    );
    assert.deepEqual(result, {
      status: "blocked",
      reason: "identity_mismatch",
    });
    assert.equal(
      constraints.settleInvocation(invocation.value).status,
      "recorded",
    );
    assert.equal(
      constraints.settleTask(task.value, "finished").status,
      "recorded",
    );
    assert.equal(constraints.inspect().productionAuthorityConferred, false);
  } finally {
    fixture.cleanup();
  }
});

test("署名済みPlatform Access観測は開発版Rootや自己申告の署名状態を拒否する", () => {
  const fixture = developmentFixture();
  try {
    const request = {
      distributionRoot: fixture.distributionRoot,
      evaluationTime: "2026-08-30T00:00:00.000Z",
      expectedRelease: {
        manifestHash: "1".repeat(64),
        releaseSequence: 1,
        crddVersion: "v0.18.0",
        crddCommit: "2".repeat(40),
        crddTree: fixture.expectedCrddTree,
        packageContentRootSha256:
          fixture.input.expectedPackageContentRootSha256,
      },
    };
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(request).status,
      "blocked",
    );
    assert.equal(
      inspectVerifiedNativeDistributionCandidate({
        ...request,
        nativeReleaseSignatureVerified: true,
      }).status,
      "blocked",
    );
    let getterCalls = 0;
    const invalid = Object.defineProperty({ ...request }, "expectedRelease", {
      get() {
        getterCalls += 1;
        return request.expectedRelease;
      },
    });
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(invalid).status,
      "blocked",
    );
    assert.equal(getterCalls, 0);
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(null).status,
      "blocked",
    );
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate(fixture.input).status,
      "candidate",
    );
  } finally {
    fixture.cleanup();
  }
});

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
    runtimeExecutionIdentitySha256: "4".repeat(64),
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

function signedManifest(
  packageContentRootSha256: string,
  revision = PLATFORM_PROVISIONER_MANIFEST_REVISION,
  expiresAt: string | null = "2027-08-15T00:00:00.000Z",
) {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  const executionFields = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    packageContentRootSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision: 3,
      rustToolchain: "1.94.1",
      byteLength: 1024,
      sha256: "4".repeat(64),
    },
  };
  const runtimeIdentity =
    calculateRuntimeExecutionIdentityCandidate(executionFields);
  assert.equal(runtimeIdentity.status, "candidate");
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: revision,
    ...executionFields,
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    runtimeExecutionIdentitySha256:
      runtimeIdentity.runtimeExecutionIdentitySha256,
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt,
  };
  return {
    input: {
      manifestEnvelope: {
        contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
        contractRevision: revision,
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

test("文書・試験はRuntime Execution Identityへ入らず、実行sourceは必ず入る", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-execution-set-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.mkdirSync(path.join(root, "tests"));
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
    fs.writeFileSync(path.join(root, "README.md"), "first\n");
    fs.writeFileSync(path.join(root, "tests", "fixture.ts"), "first\n");
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 1;\n",
    );
    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    fs.writeFileSync(path.join(root, "README.md"), "second\n");
    fs.writeFileSync(path.join(root, "tests", "fixture.ts"), "second\n");
    const documentationOnly =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(documentationOnly.status, "candidate");
    assert.equal(
      documentationOnly.packageContentRootSha256,
      first.packageContentRootSha256,
    );
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 2;\n",
    );
    const runtimeChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(runtimeChanged.status, "candidate");
    assert.notEqual(
      runtimeChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("非正規表記または実行集合外へのrelative importを署名候補へ含めず拒否する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-dependency-boundary-"),
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
      path.join(root, "outside.ts"),
      "export const value = 1;\n",
    );
    for (const specifier of [
      "../../outside.ts",
      "..\\..\\outside.ts",
      ".%2e/.%2e/outside.ts",
      "../../outside.ts?candidate=1",
      "../../outside.ts#candidate",
    ]) {
      fs.writeFileSync(
        path.join(root, "src", "entry.ts"),
        `export { value } from ${JSON.stringify(specifier)};\n`,
      );
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", specifier);
      assert.equal(result.runtimeAuthorityConferred, false, specifier);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("共通Launcherの署名・4経路・Recovery入口と静的依存だけを実行Identityへ含める", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-launch-closure-"));
  try {
    for (const directory of ["bin", "src", "scripts"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
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
      path.join(root, "bin", "launch.ts"),
      [
        'import "../src/entry.ts";',
        'await import("./coordinator.ts");',
        'await import("../scripts/verify-signed-route-matrix.ts");',
        'await import("../scripts/verify-signed-recovery-matrix.ts");',
        'await import("../scripts/sign-release-manifest.ts");',
        'await import("../scripts/promote-release-manifest.ts");',
        "",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(root, "bin", "coordinator.ts"), "export {};\n");
    fs.writeFileSync(path.join(root, "src", "entry.ts"), "export {};\n");
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-route-matrix.ts"),
      'import "./verify-signed-general-task.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-general-task.ts"),
      "export const route = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-recovery-matrix.ts"),
      'import "./recovery-helper.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      "export const recovery = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "sign-release-manifest.ts"),
      'import "./signing-helper.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "signing-helper.ts"),
      "export const signing = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "promote-release-manifest.ts"),
      'import "./release-manifest-promotion.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "release-manifest-promotion.ts"),
      "export const promotion = 1;\n",
    );
    const unrelated = path.join(root, "scripts", "unrelated.ts");
    fs.writeFileSync(unrelated, "export const unrelated = 1;\n");

    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    fs.writeFileSync(unrelated, "export const unrelated = 2;\n");
    const unrelatedChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(unrelatedChanged.status, "candidate");
    assert.equal(
      unrelatedChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      "export const recovery = 2;\n",
    );
    const dependencyChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(dependencyChanged.status, "candidate");
    assert.notEqual(
      dependencyChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      'const target = "./late-bound.ts";\nawait import(target);\n',
    );
    const unboundDynamic =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(unboundDynamic.status, "blocked");
    assert.equal(unboundDynamic.runtimeAuthorityConferred, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("実行Identityのmodule構文を字句解析し、コメント・非relative・未束縛dynamicによる閉包回避を拒否する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-module-lexer-"));
  try {
    for (const directory of ["bin", "src", "scripts"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
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
      path.join(root, "bin", "launch.ts"),
      [
        'await import("./coordinator.ts");',
        'await import("../scripts/verify-signed-route-matrix.ts");',
        'await import("../scripts/verify-signed-recovery-matrix.ts");',
        'await import("../scripts/sign-release-manifest.ts");',
        'await import("../scripts/promote-release-manifest.ts");',
        "",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(root, "bin", "coordinator.ts"), "export {};\n");
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-route-matrix.ts"),
      'import "./verify-signed-general-task.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-general-task.ts"),
      "export const task = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-recovery-matrix.ts"),
      "export const recovery = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "sign-release-manifest.ts"),
      "export const sign = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "promote-release-manifest.ts"),
      "export const promote = true;\n",
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    const launcher = path.join(root, "bin", "launch.ts");
    const canonicalLauncher = fs.readFileSync(launcher, "utf8");
    fs.writeFileSync(
      launcher,
      `${canonicalLauncher}await import("../scripts/unlisted.ts");\n`,
    );
    fs.writeFileSync(path.join(root, "scripts", "unlisted.ts"), "export {};\n");
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(
      launcher,
      canonicalLauncher.replace(
        'await import("../scripts/sign-release-manifest.ts");\n',
        "",
      ),
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(launcher, canonicalLauncher);

    const target = path.join(root, "scripts", "verify-signed-general-task.ts");
    for (const source of [
      'import/*comment*/("../../tests/helper.ts");\n',
      'import value from "external-package";\n',
      'import value from "C:/outside.ts";\n',
      'import value from "file:///outside.ts";\n',
      'import value from "fs";\n',
      'import value from "node:not-a-builtin";\n',
      'const target = new URL("./late.ts", import.meta.url);\nawait import(target.href);\n',
    ]) {
      fs.writeFileSync(target, source);
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", source);
      assert.equal(result.runtimeAuthorityConferred, false, source);
    }

    fs.writeFileSync(
      target,
      'import/*comment*/ value from/*comment*/ "node:path";\nexport { value as task };\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    for (const source of [
      'import { spawn } from "node:child_process";\nspawn(process.execPath, ["./late-child.ts"]);\n',
      'import * as childProcess from "node:child_process";\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'import childProcess from "node:child_process";\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'const childProcess = await import("node:child_process");\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'import { fork } from "node:child_process";\nfork("./late-child.ts");\n',
      'import { Worker } from "node:worker_threads";\nnew Worker(new URL("./late-child.ts", import.meta.url));\n',
      'import { fork } from "node:child_process";\nconst target = "./late-child.ts";\nfork(target);\n',
      'import { fork as launchChild } from "node:child_process";\nconst target = "./late-child.ts";\nlaunchChild(target);\n',
      'import { spawn } from "node:child_process";\nconst argv = [fileURLToPath(import.meta.url)];\nspawn(process.execPath, argv);\n',
      'import { spawn } from "node:child_process";\nconst launch = spawn;\nlaunch(process.execPath, [fileURLToPath(import.meta.url)]);\n',
      'import { spawn } from "node:child_process";\n(spawn)(process.execPath, [fileURLToPath(import.meta.url)]);\n',
      'import { spawnSync } from "node:child_process";\nspawnSync(process.execPath, ["./late-child.ts"]);\n',
      'import { execFile } from "node:child_process";\nexecFile(process.execPath, ["./late-child.ts"]);\n',
      'import { execFileSync } from "node:child_process";\nexecFileSync(process.execPath, ["./late-child.ts"]);\n',
    ]) {
      fs.writeFileSync(target, source);
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", source);
      assert.equal(result.runtimeAuthorityConferred, false, source);
    }

    fs.writeFileSync(
      target,
      'import { spawn as launchSelf } from "node:child_process";\nimport { fileURLToPath } from "node:url";\nlaunchSelf(process.execPath, [fileURLToPath(import.meta.url)]);\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    const childTarget = path.join(root, "scripts", "late-child.ts");
    fs.writeFileSync(childTarget, "export const child = true;\n");
    fs.writeFileSync(
      target,
      'import { fork as launchChild } from "node:child_process";\nlaunchChild("./late-child.ts");\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    fs.writeFileSync(
      target,
      'import path from "node:path";\nimport { spawnSync } from "node:child_process";\nspawnSync(path.join(process.env.SystemRoot ?? "C:\\\\Windows", "System32", "taskkill.exe",), ["/PID", "1", "/T", "/F"]);\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Repository textのLFとCRLFは同じ正本内容として検証し、意味差分は拒否する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-package-line-ending-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    const metadata = JSON.stringify({
      name: "@qual-lab/crdd-coordinator",
      version: "0.0.0-development",
      private: true,
      type: "module",
      exports: { "./cli": "./bin/coordinator.ts" },
      scripts: {},
      engines: {},
      devDependencies: {},
    });
    fs.writeFileSync(path.join(root, "package.json"), `${metadata}\n`);
    const entrypoint = path.join(root, "src", "entry.ts");
    fs.writeFileSync(entrypoint, "export const value = 1;\nexport {};\n");
    const lf = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(lf.status, "candidate");
    fs.writeFileSync(entrypoint, "export const value = 1;\r\nexport {};\r\n");
    const crlf = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(crlf.status, "candidate");
    assert.equal(crlf.packageContentRootSha256, lf.packageContentRootSha256);
    fs.writeFileSync(entrypoint, "export const value = 2;\r\nexport {};\r\n");
    const changed = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(changed.status, "candidate");
    assert.notEqual(
      changed.packageContentRootSha256,
      lf.packageContentRootSha256,
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

test("期限なしmanifestも固定Release鍵と配布結合を迂回できない", () => {
  const observed = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observed.status, "candidate");
  const value = signedManifest(
    observed.packageContentRootSha256,
    PLATFORM_PROVISIONER_MANIFEST_REVISION,
    null,
  );
  for (const evaluationTime of [
    "2026-08-16T00:00:00.000Z",
    "2099-01-01T00:00:00.000Z",
  ]) {
    const result = verifyBundledCoordinatorPackageCandidate({
      ...value.input,
      evaluationTime,
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
    assert.equal(result.crddDistributionConfirmed, false);
    assert.equal(result.effectAuthorizationIssued, false);
  }
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
  assert.equal(contract.contractRevision, 6);
  assert.equal(
    contract.runtimeOwnedPackageFilesystemRead,
    "implemented_candidate_without_permission_authority",
  );
  assert.equal(
    contract.runtimeOwnedCrddReleaseIdentitySelection,
    "implemented_fixed_manifest_signature_and_runtime_execution_identity_candidate",
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
    "template/tools/coordinator/coordinator-package-manifest.json",
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
  assert.equal(
    contract.unsignedOrModifiedCheckoutCanAuthorizeProvisioningEffect,
    false,
  );
  assert.equal(
    contract.repositoryContainedOfficialReleaseCanAuthorizeProvisioningEffect,
    true,
  );
  assert.equal(contract.nativeArtifactsInSignedGitTree, true);
  assert.equal(contract.exactRootGitMetadataExcludedFromSignedGitTree, true);
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
});
