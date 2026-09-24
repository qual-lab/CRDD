/**
 * semantic-coverage:integration:bundle-publisherの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility semantic-coverage:integration:bundle-publisherが所有する検証責務を実行する。
 * @trace PPR-IT-018
 * @trace RDL-IT-007
 * @level IT
 * @scope semantic-coverage、repository、filesystem、atomic-publish
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation / RDL-IT-007=Direct Boundary: Semantic Bundle Publisher→Filesystem
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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
 * @boundary PPR-IT-018=Related 2 Blocks: Semantic IR→Implementation／QA／Test Relation
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

/**
 * Root外とLink出力を拒否し失敗後に一時成果物を残さないことを検証する。
 *
 * @responsibility Semantic Bundle PublisherのRoot、regular file、原子的公開およびcleanup境界を反証する。
 * @trace RDL-IT-007
 * @precondition 検証済みRepository Rootと、Root外Path、既存Linkおよび正常な出力先を用意する。
 * @stimulus 各PathへBundle公開を要求する。
 * @observation 公開結果、既存対象、Root外対象および一時file残存を観測する。
 * @oracle Root内のregular fileだけが完全内容へ置換され、Root外とLinkは変更されず拒否される。
 * @cleanup 作成したRepository-local fixtureとRoot外fixtureを必ず削除する。
 * @boundary RDL-IT-007=Direct Boundary: Semantic Bundle Publisher→Filesystem
 */
test("Root外とLink出力を拒否し失敗後に一時成果物を残さない", () => {
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
    "semantic-coverage",
  );
  fs.mkdirSync(testRoot, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(path.join(testRoot, "bundle-boundary-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-outside-"));
  try {
    const outsideRelativePath = path
      .relative(repositoryRoot, path.join(outsideRoot, "outside.json"))
      .replaceAll("\\", "/");
    assert.throws(() =>
      publishSemanticCoverageBundleWithHooks(verified.capability, {
        outputRelativePath: outsideRelativePath,
        content: "outside\n",
      }),
    );
    assert.equal(fs.existsSync(path.join(outsideRoot, "outside.json")), false);

    const targetPath = path.join(temporaryRoot, "target.json");
    const linkPath = path.join(temporaryRoot, "link.json");
    fs.writeFileSync(targetPath, "original\n", "utf8");
    fs.symlinkSync(targetPath, linkPath, "file");
    const linkRelativePath = path
      .relative(repositoryRoot, linkPath)
      .replaceAll("\\", "/");
    assert.throws(
      () =>
        publishSemanticCoverageBundleWithHooks(verified.capability, {
          outputRelativePath: linkRelativePath,
          content: "replacement\n",
        }),
      /not a regular file/u,
    );
    assert.equal(fs.readFileSync(targetPath, "utf8"), "original\n");
    assert.deepEqual(
      fs
        .readdirSync(temporaryRoot)
        .filter((name) => name.startsWith(".semantic-coverage-pilot.")),
      [],
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});
