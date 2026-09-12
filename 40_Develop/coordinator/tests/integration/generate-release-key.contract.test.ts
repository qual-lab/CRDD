import assert from "node:assert/strict";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { generateReleaseKeyPair } from "../../scripts/generate-release-key.ts";
import {
  ensureRepositoryRuntimeDataArea,
  verifyRepositoryRoot,
} from "../../../runtime-data/src/index.ts";

const TEST_PASSPHRASE = "test-only-passphrase-0123456789";
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

async function createReleaseKeyDistributionFixture(t: TestContext) {
  const verifiedRoot = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verifiedRoot.status, "completed");
  if (verifiedRoot.status !== "completed")
    throw new Error("test_repository_root_invalid");
  const testsArea = ensureRepositoryRuntimeDataArea(
    verifiedRoot.capability,
    "tests",
  );
  assert.ok(testsArea);
  if (!testsArea) throw new Error("test_runtime_data_area_invalid");
  const executionUnitRoot = path.join(
    testsArea.directory,
    "generate-release-key",
  );
  fs.mkdirSync(executionUnitRoot, { recursive: true });
  assert.equal(
    fs.realpathSync.native(executionUnitRoot),
    path.resolve(executionUnitRoot),
  );
  const parent = fs.mkdtempSync(path.join(executionUnitRoot, "run-"));
  t.after(() => {
    fs.rmSync(parent, { recursive: true });
    assert.equal(fs.existsSync(parent), false);
    try {
      fs.rmdirSync(executionUnitRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") throw error;
    }
  });
  const distributionRoot = path.join(parent, "distribution");
  const relativePaths = [
    "40_Develop/coordinator/scripts/generate-release-key.ts",
    "40_Develop/coordinator/src/core/node-runtime-version.ts",
  ] as const;
  for (const relativePath of relativePaths) {
    const source = path.join(repositoryRoot, relativePath);
    const target = path.join(distributionRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(source));
  }
  const implementation: typeof import("../../scripts/generate-release-key.ts") =
    await import(
      pathToFileURL(path.join(distributionRoot, relativePaths[0])).href
    );
  return { parent, distributionRoot, implementation };
}

test("配布Root外へ暗号化秘密鍵とSPKI DER公開鍵だけを生成する", async (t) => {
  const { parent, distributionRoot, implementation } =
    await createReleaseKeyDistributionFixture(t);
  const outputDirectory = path.join(parent, "release-key-v1");
  assert.throws(
    () =>
      implementation.generateReleaseKeyPair(
        path.join(distributionRoot, "forbidden-key"),
        TEST_PASSPHRASE,
      ),
    /release_key_output_directory_invalid/u,
  );
  assert.equal(
    fs.existsSync(path.join(distributionRoot, "forbidden-key")),
    false,
  );
  const result = implementation.generateReleaseKeyPair(
    outputDirectory,
    TEST_PASSPHRASE,
  );
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
    () =>
      implementation.generateReleaseKeyPair(outputDirectory, TEST_PASSPHRASE),
    /release_key_output_directory_invalid/u,
  );
});

test("Repository内Path、相対Pathおよび短いpassphraseを拒否する", async (t) => {
  assert.throws(
    () => generateReleaseKeyPair("relative", TEST_PASSPHRASE),
    /release_key_output_directory_invalid/u,
  );
  assert.throws(
    () =>
      generateReleaseKeyPair(
        path.join(repositoryRoot, "40_Develop/coordinator/release-key-v1"),
        TEST_PASSPHRASE,
      ),
    /release_key_output_directory_invalid/u,
  );
  const { parent, implementation } =
    await createReleaseKeyDistributionFixture(t);
  const outputDirectory = path.join(parent, "short-passphrase");
  assert.throws(
    () => implementation.generateReleaseKeyPair(outputDirectory, "too-short"),
    /release_key_passphrase_invalid/u,
  );
  assert.equal(fs.existsSync(outputDirectory), false);
});
