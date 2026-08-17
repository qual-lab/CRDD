import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateReleaseKeyPair } from "../scripts/generate-release-key.ts";
import {
  signReleaseManifest,
  signReleaseManifestForContractTest,
} from "../scripts/sign-release-manifest.ts";

const TEST_PASSPHRASE = "test-only-release-signing-passphrase";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");

test("test専用署名Trust境界はproduction sourceから到達不能である", () => {
  for (const relativeRoot of ["src", "bin"] as const) {
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
      assert.equal(
        source.includes("signReleaseManifestForContractTest"),
        false,
      );
    }
  }
});

function signingFixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-signing-flow-"));
  const distributionRoot = path.join(parent, "distribution");
  const keyDirectory = path.join(parent, "key");
  const executablePath = path.join(
    distributionRoot,
    "90_Release",
    "platform-access",
    "x86_64-pc-windows-msvc",
    "crdd-platform-access.exe",
  );
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, "fixed-test-platform-access-binary");
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
  const privateKeyPath = path.join(keyDirectory, "crdd-release-v1-private.pem");
  const privateKey = createPrivateKey({
    key: fs.readFileSync(privateKeyPath),
    format: "pem",
    passphrase: TEST_PASSPHRASE,
  });
  const expectedSignerSpkiDer = createPublicKey(privateKey).export({
    type: "spki",
    format: "der",
  });
  const options = Object.freeze({
    distributionRoot,
    privateKeyPath,
    passphrase: TEST_PASSPHRASE,
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "0".repeat(40),
    crddTree: "1".repeat(40),
    issuedAt: "2026-08-16T00:00:00.000Z",
    expiresAt: "2027-08-16T00:00:00.000Z",
  });
  return {
    parent,
    distributionRoot,
    executablePath,
    expectedSignerSpkiDer,
    options,
  };
}

function testTrust(
  expectedSignerSpkiDer: Buffer,
  hooks: Readonly<{
    beforeSignature?: () => void;
    afterManifestWrite?: () => void;
  }> = {},
) {
  return Object.freeze({
    expectedSignerSpkiDer,
    skipCommitTreeBinding: true as const,
    skipReleaseIdentityBinding: true as const,
    ...hooks,
  });
}

test("test専用Trust境界で署名観測区間の正常経路を検証する", () => {
  const value = signingFixture();
  try {
    const result = signReleaseManifestForContractTest(
      value.options,
      testTrust(value.expectedSignerSpkiDer),
    );
    assert.equal(result.status, "created");
    assert.equal(
      fs.existsSync(
        path.join(
          value.distributionRoot,
          "90_Release",
          "coordinator-package-manifest.json",
        ),
      ),
      true,
    );
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("署名前の成果物差替えではmanifestを生成しない", () => {
  const value = signingFixture();
  try {
    assert.throws(
      () =>
        signReleaseManifestForContractTest(
          value.options,
          testTrust(value.expectedSignerSpkiDer, {
            beforeSignature() {
              fs.writeFileSync(value.executablePath, "replacement");
            },
          }),
        ),
      /release_manifest_artifact_changed_before_signing/u,
    );
    assert.equal(
      fs.existsSync(
        path.join(
          value.distributionRoot,
          "90_Release",
          "coordinator-package-manifest.json",
        ),
      ),
      false,
    );
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("署名前の配布Root差替えでは別実体を再基準化しない", () => {
  const value = signingFixture();
  try {
    assert.throws(
      () =>
        signReleaseManifestForContractTest(
          value.options,
          testTrust(value.expectedSignerSpkiDer, {
            beforeSignature() {
              fs.renameSync(
                value.distributionRoot,
                `${value.distributionRoot}-original`,
              );
              fs.mkdirSync(value.distributionRoot);
            },
          }),
        ),
      /release_manifest_artifact_changed_before_signing/u,
    );
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("manifest配置後の成果物差替えでは失敗成果物を自動削除しない", () => {
  const value = signingFixture();
  const manifestPath = path.join(
    value.distributionRoot,
    "90_Release",
    "coordinator-package-manifest.json",
  );
  try {
    assert.throws(
      () =>
        signReleaseManifestForContractTest(
          value.options,
          testTrust(value.expectedSignerSpkiDer, {
            afterManifestWrite() {
              fs.writeFileSync(value.executablePath, "replacement");
            },
          }),
        ),
      /release_manifest_staging_changed_after_placement/u,
    );
    assert.equal(fs.existsSync(manifestPath), true);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("固定公開鍵に対応しない秘密鍵ではmanifestを生成しない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-manifest-sign-"));
  const distributionRoot = path.join(parent, "distribution");
  const keyDirectory = path.join(parent, "key");
  try {
    fs.mkdirSync(path.join(distributionRoot, "90_Release"), {
      recursive: true,
    });
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
