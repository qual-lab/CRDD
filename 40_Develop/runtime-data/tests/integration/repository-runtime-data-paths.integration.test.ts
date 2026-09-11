import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  resolveRepositoryRuntimeDataPaths,
  verifyRepositoryRoot,
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
