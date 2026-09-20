import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { publishSemanticCoverageBundleWithHooks } from "../../src/repository/internal/filesystem-semantic-bundle-publisher.ts";

test("Semantic Bundle公開前の失敗は既存Snapshotを置換しない", () => {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const verified = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const testRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "crdd-domain-library",
  );
  fs.mkdirSync(testRoot, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(path.join(testRoot, "semantic-bundle-"));
  try {
    const targetPath = path.join(temporaryRoot, "semantic-coverage.json");
    const outputRelativePath = path
      .relative(repositoryRoot, targetPath)
      .replaceAll("\\", "/");
    fs.writeFileSync(targetPath, "old\n", "utf8");
    assert.throws(() =>
      publishSemanticCoverageBundleWithHooks(
        verified.capability,
        { outputRelativePath, content: "new\n" },
        {
          beforePublish: () => {
            throw new Error("injected-before-publish");
          },
        },
      ),
    );
    assert.equal(fs.readFileSync(targetPath, "utf8"), "old\n");
    assert.deepEqual(
      fs
        .readdirSync(temporaryRoot)
        .filter((name) => name.startsWith(".semantic-coverage-pilot.")),
      [],
    );
    const receipt = publishSemanticCoverageBundleWithHooks(
      verified.capability,
      { outputRelativePath, content: "new\n" },
    );
    assert.equal(receipt.outputRelativePath, outputRelativePath);
    assert.equal(receipt.byteLength, 4);
    assert.equal(fs.readFileSync(targetPath, "utf8"), "new\n");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
