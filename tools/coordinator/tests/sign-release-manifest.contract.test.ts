import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateReleaseKeyPair } from "../scripts/generate-release-key.ts";
import { signReleaseManifest } from "../scripts/sign-release-manifest.ts";

const TEST_PASSPHRASE = "test-only-release-signing-passphrase";

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
