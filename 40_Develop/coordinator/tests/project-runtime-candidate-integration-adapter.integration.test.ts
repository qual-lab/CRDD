import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCandidateBundleStoreTestingAdapter } from "../src/security/candidate-bundle-store.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "../src/security/project-runtime-candidate-integration-adapter.ts";
import { createProjectRuntimeState } from "../src/security/project-runtime-state.ts";

test("real candidate bundles are merged and explicitly adopted into the bound repository", async (t) => {
  const repository = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-adoption-repo-"),
  );
  const candidateRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-adoption-store-"),
  );
  t.after(() => {
    fs.rmSync(repository, { recursive: true, force: true });
    fs.rmSync(candidateRoot, { recursive: true, force: true });
  });
  execFileSync("git", ["init", "--quiet", repository], { windowsHide: true });
  execFileSync(
    "git",
    ["-C", repository, "config", "user.email", "test@example.invalid"],
    { windowsHide: true },
  );
  execFileSync("git", ["-C", repository, "config", "user.name", "CRDD Test"], {
    windowsHide: true,
  });
  fs.writeFileSync(path.join(repository, "result.txt"), "before\n");
  execFileSync("git", ["-C", repository, "add", "result.txt"], {
    windowsHide: true,
  });
  execFileSync("git", ["-C", repository, "commit", "--quiet", "-m", "base"], {
    windowsHide: true,
  });
  const revision = execFileSync(
    "git",
    ["-C", repository, "rev-parse", "HEAD"],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  const tree = execFileSync(
    "git",
    ["-C", repository, "rev-parse", "HEAD^{tree}"],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  const content = Buffer.from("after\n");
  const candidateStore = createCandidateBundleStoreTestingAdapter({
    temporaryDirectory: candidateRoot,
  });
  const staged = candidateStore.persist(
    {
      schema: "crdd-coordinator-candidate-bundle/v1",
      baseCommit: revision,
      baseTree: tree,
      baseManifestHash: "a".repeat(64),
      patchHash: "b".repeat(64),
      contentManifestHash: "c".repeat(64),
      allowedPathsHash: "d".repeat(64),
      changedPaths: ["result.txt"],
      entries: [
        {
          relativePath: "result.txt",
          operation: "upsert",
          byteLength: content.byteLength,
          sha256: createHash("sha256").update(content).digest("hex"),
          contentBase64: content.toString("base64"),
        },
      ],
    },
    {
      candidatePersistenceAllowed: true,
      candidateRetentionHours: 24,
      informationClassification: "internal",
    },
  );
  assert.ok(staged && staged.status === "staged");
  const published = candidateStore.publish(staged.candidateRecoveryId);
  assert.ok(published && published.status === "published");
  const state = createProjectRuntimeState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["accepted"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
  });
  assert.equal(state.status, "completed");
  if (state.status !== "completed") return;
  const adapter = createRuntimeOwnedProjectCandidateIntegrationAdapter(
    repository,
    candidateStore,
  );
  const candidate = (await adapter.createCandidate({
    state: state.state,
    taskCandidateIds: [published.candidateId],
  })) as Record<string, unknown>;
  assert.equal(candidate.status, "candidate");
  assert.deepEqual(adapter.observeCanonicalRepository(), {
    status: "observed",
    repositoryRevision: revision,
    dirty: false,
    observedPaths: [],
  });
  const receipt = (await adapter.adoptCandidate(candidate as never)) as Record<
    string,
    unknown
  >;
  assert.equal(receipt.status, "completed");
  assert.equal(
    fs.readFileSync(path.join(repository, "result.txt"), "utf8"),
    "after\n",
  );
});
