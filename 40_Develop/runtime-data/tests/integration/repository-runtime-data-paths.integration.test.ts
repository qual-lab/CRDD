import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveRepositoryRuntimeDataPaths,
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

test("検証済みRepository Rootだけから全Repository-local Pathを解決する", () => {
  const verification = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed") return;
  const paths = resolveRepositoryRuntimeDataPaths(verification.capability);
  assert.equal(paths?.root, path.join(repositoryRoot, ".crdd"));
  assert.equal(
    paths?.externalSendPolicy,
    path.join(repositoryRoot, ".crdd", "config", "external-send-policy.json"),
  );
  assert.deepEqual(paths?.allowedTopLevelAreas, [
    "config",
    "project-runtime",
    "execution",
    "verification",
    "candidates",
    "release",
    "communication",
    "tests",
    "tmp",
  ]);
});

test("Repositoryの子DirectoryはRoot Capabilityとして拒否する", () => {
  assert.deepEqual(verifyRepositoryRoot(import.meta.dirname), {
    status: "blocked",
    reason: "repository_root_invalid",
    capability: null,
  });
});

test("任意Directoryと非公開のraw Root入口からPath能力を取得できない", async (t) => {
  const arbitrary = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-root-"),
  );
  t.after(() => fs.rmSync(arbitrary, { recursive: true, force: true }));
  assert.equal(verifyRepositoryRoot(arbitrary).status, "blocked");
  const publicApi = await import("../../src/index.ts");
  assert.equal(
    "resolveRepositoryRuntimeDataPathsFromValidatedRoot" in publicApi,
    false,
  );
  assert.equal(
    "resolveBundledRepositoryRuntimeDataPathsForProtectedSigning" in publicApi,
    false,
  );
});

test("junction経由のWorking DirectoryはRepository Rootへ正規化せず拒否する", () => {
  const boundaryRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "runtime-data-root-boundary",
  );
  const alias = path.join(boundaryRoot, "repository-alias");
  fs.mkdirSync(boundaryRoot, { recursive: true });
  try {
    fs.symlinkSync(repositoryRoot, alias, "junction");
    assert.deepEqual(
      verifyRepositoryRootFromWorkingDirectory(
        path.join(alias, "40_Develop", "runtime-data"),
      ),
      {
        status: "blocked",
        reason: "repository_root_invalid",
        capability: null,
      },
    );
  } finally {
    if (fs.existsSync(alias)) fs.unlinkSync(alias);
    fs.rmSync(boundaryRoot, { recursive: true });
  }
});
