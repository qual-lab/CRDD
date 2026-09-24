/**
 * coordinator:integration:project-runtime-candidate-integration-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-candidate-integration-adapterが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @level IT
 * @scope project、runtime、candidate、adapter
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCandidateBundleStoreTestingAdapter } from "../../src/security/candidate-bundle-store.ts";
import { createRuntimeOwnedProjectCandidateIntegrationAdapter } from "../../src/security/project-runtime-candidate-integration-adapter.ts";
import { createProjectRuntimeState } from "../../../project-runtime/src/index.ts";
import { gitFixedSnapshotAdapter } from "../../../version-control/src/git/fixed-snapshot-adapter.ts";

/**
 * real candidate bundles are merged and explicitly adopted into the bound repositoryを検証する。
 *
 * @responsibility real candidate bundles are merged and explicitly adopted into the bound repositoryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus real candidate bundles are merged and explicitly adopted into the bound repositoryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Project Runtime Application Port→Core
 */
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
  fs.writeFileSync(path.join(repository, "resultz.txt"), "before-2\n");
  execFileSync("git", ["-C", repository, "add", "result.txt"], {
    windowsHide: true,
  });
  execFileSync("git", ["-C", repository, "add", "resultz.txt"], {
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
  const secondContent = Buffer.from("after-2\n");
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
      changedPaths: ["result.txt", "resultz.txt"],
      entries: [
        {
          relativePath: "result.txt",
          operation: "upsert",
          byteLength: content.byteLength,
          sha256: createHash("sha256").update(content).digest("hex"),
          contentBase64: content.toString("base64"),
        },
        {
          relativePath: "resultz.txt",
          operation: "upsert",
          byteLength: secondContent.byteLength,
          sha256: createHash("sha256").update(secondContent).digest("hex"),
          contentBase64: secondContent.toString("base64"),
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
        allowedPaths: ["result.txt", "resultz.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
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
  const blockedAdapter = createRuntimeOwnedProjectCandidateIntegrationAdapter(
    repository,
    candidateStore,
    {
      ...gitFixedSnapshotAdapter,
    },
    () =>
      Object.freeze({
        status: "blocked" as const,
        reason: "candidate_materialization_cleanup_unconfirmed" as const,
        effectIssued: true,
        effectStateUnknown: true,
        cleanupConfirmed: false,
        repositoryPathReported: false as const,
        workspacePathReported: false as const,
      }),
  );
  const blockedCandidate = (await blockedAdapter.createCandidate({
    state: state.state,
    taskCandidateIds: [published.candidateId],
  })) as Record<string, unknown>;
  assert.equal(blockedCandidate.status, "candidate");
  const blockedObservation =
    blockedAdapter.observeCanonicalRepository() as Record<string, unknown>;
  assert.equal(
    blockedObservation.reason,
    "candidate_materialization_cleanup_unconfirmed",
  );
  assert.equal(blockedObservation.effectStateUnknown, true);
  assert.equal(blockedObservation.cleanupConfirmed, false);
  assert.equal(blockedObservation.recoveryReference, null);
  const cleanupBlockedAdapter =
    createRuntimeOwnedProjectCandidateIntegrationAdapter(
      repository,
      candidateStore,
      { ...gitFixedSnapshotAdapter },
      undefined,
      (workspace) => {
        fs.rmSync(workspace, { recursive: true, force: true });
        return false;
      },
    );
  const cleanupBlockedCandidate = (await cleanupBlockedAdapter.createCandidate({
    state: state.state,
    taskCandidateIds: [published.candidateId],
  })) as Record<string, unknown>;
  assert.equal(cleanupBlockedCandidate.status, "candidate");
  assert.deepEqual(cleanupBlockedAdapter.observeCanonicalRepository(), {
    status: "blocked",
    reason: "project_runtime_candidate_base_cleanup_unconfirmed",
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed: false,
    retryAllowed: false,
    recoveryReference: null,
  });
  assert.deepEqual(
    await cleanupBlockedAdapter.adoptCandidate(
      cleanupBlockedCandidate as never,
    ),
    {
      status: "blocked",
      reason: "project_runtime_candidate_base_cleanup_unconfirmed",
      effectIssued: true,
      effectStateUnknown: false,
      cleanupConfirmed: false,
      retryAllowed: false,
      recoveryReference: null,
    },
  );
  fs.writeFileSync(path.join(repository, "result.txt"), "before\n");
  fs.writeFileSync(path.join(repository, "resultz.txt"), "before-2\n");

  const rollbackRecoveredAdapter =
    createRuntimeOwnedProjectCandidateIntegrationAdapter(
      repository,
      candidateStore,
      { ...gitFixedSnapshotAdapter },
      undefined,
      undefined,
      (phase, relativePath) => {
        if (phase === "before_entry" && relativePath === "resultz.txt")
          throw new Error("injected_second_entry_failure");
      },
    );
  const rollbackRecoveredCandidate =
    (await rollbackRecoveredAdapter.createCandidate({
      state: state.state,
      taskCandidateIds: [published.candidateId],
    })) as Record<string, unknown>;
  assert.equal(
    await rollbackRecoveredAdapter.adoptCandidate(
      rollbackRecoveredCandidate as never,
    ),
    null,
  );
  assert.equal(
    fs.readFileSync(path.join(repository, "result.txt"), "utf8"),
    "before\n",
  );

  const rollbackUnknownAdapter =
    createRuntimeOwnedProjectCandidateIntegrationAdapter(
      repository,
      candidateStore,
      { ...gitFixedSnapshotAdapter },
      undefined,
      undefined,
      (phase, relativePath) => {
        if (phase === "before_entry" && relativePath === "resultz.txt")
          throw new Error("injected_second_entry_failure");
        if (phase === "before_rollback" && relativePath === "result.txt")
          throw new Error("injected_rollback_failure");
      },
    );
  const rollbackUnknownCandidate =
    (await rollbackUnknownAdapter.createCandidate({
      state: state.state,
      taskCandidateIds: [published.candidateId],
    })) as Record<string, unknown>;
  assert.deepEqual(
    await rollbackUnknownAdapter.adoptCandidate(
      rollbackUnknownCandidate as never,
    ),
    {
      status: "blocked",
      reason: "project_runtime_candidate_adoption_rollback_unconfirmed",
      effectIssued: true,
      effectStateUnknown: true,
      cleanupConfirmed: false,
      retryAllowed: false,
      recoveryReference: null,
    },
  );
  fs.writeFileSync(path.join(repository, "result.txt"), "before\n");
  fs.writeFileSync(path.join(repository, "resultz.txt"), "before-2\n");
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
  assert.equal(
    fs.readFileSync(path.join(repository, "resultz.txt"), "utf8"),
    "after-2\n",
  );
});
