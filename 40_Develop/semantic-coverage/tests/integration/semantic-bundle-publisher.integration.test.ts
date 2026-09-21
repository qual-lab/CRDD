/**
 * semantic-coverage:integration:bundle-publisherの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility semantic-coverage:integration:bundle-publisherが所有する検証責務を実行する。
 * @trace PPR-IT-018
 * @level IT
 * @scope semantic-coverage、repository、filesystem、atomic-publish
 * @boundary Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";
import { publishSemanticCoverageBundleWithHooks } from "../../src/infrastructure/filesystem-semantic-bundle-publisher.ts";

/**
 * Semantic Bundle公開前の失敗は既存Snapshotを置換しないを検証する。
 *
 * @responsibility Semantic Bundle公開前の失敗は既存Snapshotを置換しないの合否判定を所有する。
 * @trace PPR-IT-018
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Semantic Bundle公開前の失敗は既存Snapshotを置換しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
 */
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
