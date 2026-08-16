import assert from "node:assert/strict";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { generateReleaseKeyPair } from "../scripts/generate-release-key.ts";

const TEST_PASSPHRASE = "test-only-passphrase-0123456789";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("Repository外へ暗号化秘密鍵とSPKI DER公開鍵だけを生成する", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-release-key-test-"),
  );
  const outputDirectory = path.join(parent, "release-key-v1");
  try {
    const result = generateReleaseKeyPair(outputDirectory, TEST_PASSPHRASE);
    const privateBytes = fs.readFileSync(
      path.join(outputDirectory, "crdd-release-v1-private.pem"),
    );
    const publicBytes = fs.readFileSync(
      path.join(outputDirectory, "crdd-release-v1-public.spki.der"),
    );
    assert.match(privateBytes.toString("ascii"), /ENCRYPTED PRIVATE KEY/u);
    const privateKey = createPrivateKey({
      key: privateBytes,
      format: "pem",
      passphrase: TEST_PASSPHRASE,
    });
    const derivedPublic = createPublicKey(privateKey).export({
      type: "spki",
      format: "der",
    });
    assert.deepEqual(publicBytes, derivedPublic);
    assert.equal(
      result.publicKeySpkiSha256,
      createHash("sha256").update(publicBytes).digest("hex"),
    );
    assert.equal("privateKey" in result, false);
    assert.throws(
      () => generateReleaseKeyPair(outputDirectory, TEST_PASSPHRASE),
      /release_key_output_directory_invalid/u,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Repository内Path、相対Pathおよび短いpassphraseを拒否する", () => {
  assert.throws(
    () => generateReleaseKeyPair("relative", TEST_PASSPHRASE),
    /release_key_output_directory_invalid/u,
  );
  assert.throws(
    () =>
      generateReleaseKeyPair(
        path.join(repositoryRoot, "tools/coordinator/release-key-v1"),
        TEST_PASSPHRASE,
      ),
    /release_key_output_directory_invalid/u,
  );
  assert.throws(
    () =>
      generateReleaseKeyPair(
        path.join(os.tmpdir(), "crdd-release-short-passphrase"),
        "too-short",
      ),
    /release_key_passphrase_invalid/u,
  );
});
