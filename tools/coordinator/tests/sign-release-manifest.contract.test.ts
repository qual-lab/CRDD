import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateReleaseKeyPair } from "../scripts/generate-release-key.ts";
import { signReleaseManifest } from "../scripts/sign-release-manifest.ts";
import {
  beginReleaseStagingManifestSession,
  describeReleaseStagingManifestContract,
  placeReleaseStagingManifestCandidate,
  ReleaseStagingManifestError,
} from "../scripts/release-staging-manifest.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";

const TEST_PASSPHRASE = "test-only-release-signing-passphrase";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");

test("production署名sourceはTrust差替え、検証skipまたはtest hookを持たない", () => {
  const forbiddenNames = [
    "ContractTestTrust",
    "signReleaseManifestForContractTest",
    "skipCommitTreeBinding",
    "skipReleaseIdentityBinding",
    "beforeSignature",
    "afterManifestWrite",
    "expectedSignerSpkiDer",
  ];
  const forbiddenPatterns = [
    /ContractTest/u,
    /ForContractTest/u,
    /skip[A-Z][A-Za-z]+(?:Binding|Validation)/u,
    /(?:before|after)[A-Z][A-Za-z]+(?:Hook|Write|Signature)/u,
  ];
  for (const relativeRoot of ["scripts", "src", "bin"] as const) {
    const files = fs.readdirSync(path.join(coordinatorRoot, relativeRoot), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const source = fs.readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      for (const identifier of forbiddenNames) {
        assert.equal(
          source.includes(identifier),
          false,
          `${relativeRoot}/${entry.name}: ${identifier}`,
        );
      }
      for (const pattern of forbiddenPatterns) {
        assert.equal(
          pattern.test(source),
          false,
          `${relativeRoot}/${entry.name}: ${pattern.source}`,
        );
      }
    }
  }

  const stagingImporters: string[] = [];
  for (const relativeRoot of ["scripts", "src", "bin"] as const) {
    const files = fs.readdirSync(path.join(coordinatorRoot, relativeRoot), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const source = fs.readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      if (source.includes('from "./release-staging-manifest.ts"')) {
        stagingImporters.push(
          path
            .relative(coordinatorRoot, path.join(entry.parentPath, entry.name))
            .replaceAll("\\", "/"),
        );
      }
    }
  }
  assert.deepEqual(stagingImporters.sort(), [
    "scripts/sign-release-manifest.ts",
  ]);
});

function ephemeralEnvelopeBytes() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const payload = Buffer.from("CRDD test-only placement envelope", "utf8");
  const signature = sign(null, payload, privateKey).toString("base64url");
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  const canonical = canonicalizeProvisioningJsonValueCandidate({
    contract: "crdd-test/release-manifest-placement-envelope",
    contractRevision: 1,
    payload: payload.toString("base64url"),
    publicKey: publicKeyDer.toString("base64url"),
    signature,
  });
  assert.equal(canonical.status, "candidate");
  assert.ok("canonicalBytes" in canonical);
  return canonical.canonicalBytes;
}

function placementFixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-placement-flow-"));
  const distributionRoot = path.join(parent, "distribution");
  const executablePath = path.join(
    distributionRoot,
    "90_Release",
    "platform-access",
    "x86_64-pc-windows-msvc",
    "crdd-platform-access.exe",
  );
  const manifestPath = path.join(
    distributionRoot,
    "90_Release",
    "coordinator-package-manifest.json",
  );
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, "fixed-test-platform-access-binary");
  const observation = beginReleaseStagingManifestSession(distributionRoot);
  assert.ok(observation);
  return {
    parent,
    distributionRoot,
    executablePath,
    manifestPath,
    token: observation.token,
    canonicalBytes: ephemeralEnvelopeBytes(),
  };
}

function withFsyncMutation(
  mutation: (descriptor: number) => void,
  operation: () => void,
) {
  const originalFsyncSync = fs.fsyncSync;
  fs.fsyncSync = ((descriptor: number) => {
    originalFsyncSync(descriptor);
    mutation(descriptor);
  }) as typeof fs.fsyncSync;
  try {
    operation();
  } finally {
    fs.fsyncSync = originalFsyncSync;
  }
}

function assertStagingFailure(
  operation: () => void,
  isEffectExpected: boolean,
  shouldExpectDiscard: boolean,
) {
  try {
    operation();
    assert.fail("release staging failure was required");
  } catch (error) {
    assert.ok(error instanceof ReleaseStagingManifestError);
    assert.equal(error.releaseStagingFilesystemEffectIssued, isEffectExpected);
    assert.equal(error.stagingRootMustBeDiscarded, shouldExpectDiscard);
  }
}

test("署名Authorityを持たない配置helperは同一fdのcanonical byteを再確認する", () => {
  const value = placementFixture();
  try {
    const result = placeReleaseStagingManifestCandidate(
      value.token,
      value.canonicalBytes,
    );
    assert.equal(result.status, "placed");
    assert.equal(result.releaseStagingFilesystemEffectIssued, true);
    assert.equal(result.stagingRootMustBeDiscarded, false);
    assert.equal(result.runtimeFilesystemEffectIssued, false);
    assert.equal(result.provisioningFilesystemEffectIssued, false);
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.deepEqual(describeReleaseStagingManifestContract(), {
      manifestRelativePath: "90_Release/coordinator-package-manifest.json",
      releaseStagingManifestWrite: "implemented_explicit_signing_effect",
      releaseStagingFilesystemEffectIssuedOnSuccess: true,
      failedAfterCreateRequiresStagingRootDiscard: true,
      runtimeFilesystemEffectIssued: false,
      provisioningFilesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      productionRuntimeImportAllowed: false,
    });
    assert.deepEqual(fs.readFileSync(value.manifestPath), value.canonicalBytes);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("manifestの同長上書き、短縮および追記をcreatedへ流用しない", {
  concurrency: false,
}, () => {
  const mutations = [
    (descriptor: number, bytes: Buffer) => {
      fs.writeSync(
        descriptor,
        Buffer.alloc(bytes.length, 0x78),
        0,
        bytes.length,
        0,
      );
    },
    (descriptor: number, bytes: Buffer) => {
      fs.ftruncateSync(descriptor, bytes.length - 1);
    },
    (descriptor: number, bytes: Buffer) => {
      fs.writeSync(descriptor, Buffer.from("x"), 0, 1, bytes.length);
    },
  ];
  for (const mutate of mutations) {
    const value = placementFixture();
    try {
      assertStagingFailure(
        () =>
          withFsyncMutation(
            (descriptor) => mutate(descriptor, value.canonicalBytes),
            () =>
              void placeReleaseStagingManifestCandidate(
                value.token,
                value.canonicalBytes,
              ),
          ),
        true,
        true,
      );
      assert.equal(fs.existsSync(value.manifestPath), true);
    } finally {
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

test("manifest Path、Release DirectoryまたはRust成果物の配置後差を拒否して自動削除しない", {
  concurrency: false,
}, () => {
  const cases = [
    (value: ReturnType<typeof placementFixture>) => {
      fs.renameSync(value.manifestPath, `${value.manifestPath}.original`);
      fs.writeFileSync(value.manifestPath, value.canonicalBytes);
    },
    (value: ReturnType<typeof placementFixture>) => {
      const releaseDirectory = path.dirname(value.manifestPath);
      fs.renameSync(releaseDirectory, `${releaseDirectory}-original`);
      fs.mkdirSync(releaseDirectory);
    },
    (value: ReturnType<typeof placementFixture>) => {
      fs.writeFileSync(value.executablePath, "replacement");
    },
  ];
  for (const mutate of cases) {
    const value = placementFixture();
    try {
      assertStagingFailure(
        () =>
          withFsyncMutation(
            () => mutate(value),
            () =>
              void placeReleaseStagingManifestCandidate(
                value.token,
                value.canonicalBytes,
              ),
          ),
        true,
        true,
      );
      assert.equal(
        fs.existsSync(value.manifestPath) ||
          fs.existsSync(`${value.manifestPath}.original`) ||
          fs.existsSync(
            path.join(
              `${path.dirname(value.manifestPath)}-original`,
              path.basename(value.manifestPath),
            ),
          ),
        true,
      );
    } finally {
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

test("偽造tokenと既存manifestをRelease staging成功へ流用しない", () => {
  const canonicalBytes = ephemeralEnvelopeBytes();
  assertStagingFailure(
    () => void placeReleaseStagingManifestCandidate({}, canonicalBytes),
    false,
    false,
  );

  const value = placementFixture();
  try {
    fs.writeFileSync(value.manifestPath, canonicalBytes);
    assertStagingFailure(
      () =>
        void placeReleaseStagingManifestCandidate(value.token, canonicalBytes),
      false,
      true,
    );
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("固定公開鍵に対応しない秘密鍵ではmanifestを生成しない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-manifest-sign-"));
  const distributionRoot = path.join(parent, "distribution");
  const keyDirectory = path.join(parent, "key");
  try {
    fs.mkdirSync(
      path.join(
        distributionRoot,
        "90_Release",
        "platform-access",
        "x86_64-pc-windows-msvc",
      ),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        distributionRoot,
        "90_Release",
        "platform-access",
        "x86_64-pc-windows-msvc",
        "crdd-platform-access.exe",
      ),
      Buffer.from("not-a-real-executable", "ascii"),
    );
    fs.mkdirSync(path.join(distributionRoot, "tools", "coordinator", "src"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(distributionRoot, "tools", "coordinator", "package.json"),
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
      path.join(distributionRoot, "tools", "coordinator", "src", "fixture.ts"),
      "export const FIXTURE = true;\n",
    );
    generateReleaseKeyPair(keyDirectory, TEST_PASSPHRASE);
    assert.throws(
      () =>
        signReleaseManifest({
          distributionRoot,
          privateKeyPath: path.join(
            keyDirectory,
            "crdd-release-v1-private.pem",
          ),
          passphrase: TEST_PASSPHRASE,
          crddVersion: "v0.18.0",
          releaseSequence: 18,
          crddCommit: "0".repeat(40),
          crddTree: "1".repeat(40),
          issuedAt: "2026-08-16T00:00:00.000Z",
          expiresAt: "2027-08-16T00:00:00.000Z",
        }),
      /release_manifest_private_key_not_pinned/u,
    );
    assert.equal(
      fs.existsSync(
        path.join(
          distributionRoot,
          "90_Release",
          "coordinator-package-manifest.json",
        ),
      ),
      false,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
