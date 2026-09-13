import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ensureRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
  resolveRepositoryRuntimeDataPaths,
} from "../../src/index.ts";
import { ensureRepositoryRuntimeDataAreaWithAdapter } from "../../src/platform/runtime-data-path-resolver.ts";
import {
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

test("検証済みRepository Rootだけから全Repository-local Pathを解決する", () => {
  const verification = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed") return;
  const paths = resolveRepositoryRuntimeDataPaths(verification.capability);
  assert.equal(Object.hasOwn(paths ?? {}, "root"), false);
  assert.equal(
    path.dirname(paths?.config ?? ""),
    path.join(repositoryRoot, ".crdd"),
  );
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

test("Consumerはraw Rootではなく名前付き領域だけを作成・検証する", (t) => {
  const isolatedRepository = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-data-area-"),
  );
  t.after(() =>
    fs.rmSync(isolatedRepository, { recursive: true, force: true }),
  );
  fs.mkdirSync(path.join(isolatedRepository, ".git", "info"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verification = verifyRepositoryRoot(isolatedRepository);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed") return;
  const area = ensureRepositoryRuntimeDataArea(
    verification.capability,
    "tests",
  );
  assert.deepEqual(area, {
    status: "ready",
    repositoryRoot: isolatedRepository,
    directory: path.join(isolatedRepository, ".crdd", "tests"),
  });
  assert.equal(
    fs.readFileSync(
      path.join(isolatedRepository, ".git", "info", "exclude"),
      "utf8",
    ),
    ".crdd/\n",
  );
});

test("IgnoreのEffect不明をnullへ畳まずRuntime Data領域を作らない", (t) => {
  const isolatedRepository = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-data-ignore-unknown-"),
  );
  t.after(() =>
    fs.rmSync(isolatedRepository, { recursive: true, force: true }),
  );
  fs.mkdirSync(path.join(isolatedRepository, ".git", "info"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verification = verifyRepositoryRoot(isolatedRepository);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed") return;
  const result = ensureRepositoryRuntimeDataAreaWithAdapter(
    verification.capability,
    "tests",
    () =>
      Object.freeze({
        status: "blocked" as const,
        reason: "repository_local_ignore_update_blocked" as const,
        effectIssued: true,
        effectConfirmation: "unknown" as const,
        cleanupConfirmed: true,
      }),
  );
  assert.equal(result?.status, "blocked");
  if (result?.status !== "blocked") return;
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.retryAllowed, false);
  assert.match(result.recoveryReference ?? "", /^repository-local-ignore\./u);
  assert.equal(fs.existsSync(path.join(isolatedRepository, ".crdd")), false);
  assert.throws(
    () =>
      requireReadyRepositoryRuntimeDataArea(
        result,
        "runtime_data_area_invalid",
      ),
    (error) => {
      assert.ok(error instanceof RepositoryRuntimeDataAreaBlockedError);
      assert.equal(error.effectStateUnknown, true);
      assert.equal(error.cleanupConfirmed, true);
      assert.equal(error.retryAllowed, false);
      assert.equal(error.recoveryReference, result.recoveryReference);
      return true;
    },
  );
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
  assert.equal(
    "resolveRepositoryRuntimeDataPathsForInternalUse" in publicApi,
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
