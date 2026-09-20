import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  type CandidateOutputCapability,
  gitFixedSnapshotAdapter,
  inspectFixedSnapshot,
  materializeFixedSnapshotCandidate,
  readFixedSnapshotFile,
  verifyCandidateOutputDirectory,
  verifyRepositoryRoot,
} from "../../src/index.ts";

function git(root: string, commandArguments: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...commandArguments], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

test("固定RevisionのIdentity・本文・候補を同じSnapshotから復元する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-snapshot-"));
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-candidate-"),
  );
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "docs", "fixed.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const revision = git(root, ["rev-parse", "HEAD"]);
  const expectedSnapshot = git(root, ["rev-parse", "HEAD^{tree}"]);
  fs.writeFileSync(path.join(root, "docs", "fixed.txt"), "working\n", "utf8");

  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const identity = inspectFixedSnapshot(
    verified.capability,
    revision,
    gitFixedSnapshotAdapter,
  );
  assert.equal(identity?.revisionIdentity, revision);
  assert.equal(identity?.snapshotIdentity, expectedSnapshot);
  assert.equal(JSON.stringify(identity).includes(root), false);

  const file = readFixedSnapshotFile(
    verified.capability,
    revision,
    "docs/fixed.txt",
    gitFixedSnapshotAdapter,
  );
  assert.equal(file?.bytes.toString("utf8"), "fixed\n");
  assert.equal(file?.revisionIdentity, revision);

  const outputOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(
    workspace,
    outputOwner,
    workspace,
  );
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const materialized = materializeFixedSnapshotCandidate(
    verified.capability,
    revision,
    outputOwner,
    output.capability,
    ["docs/fixed.txt"],
    null,
    gitFixedSnapshotAdapter,
  );
  assert.equal(materialized?.status, "materialized");
  assert.equal(
    fs.readFileSync(path.join(workspace, "docs", "fixed.txt"), "utf8"),
    "fixed\n",
  );
});

test("不明Revision・Path逸脱・内容Policy拒否をEffect前に閉じる", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-snapshot-reject-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "fixed.txt"), "reject\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const revision = git(root, ["rev-parse", "HEAD"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  assert.equal(
    inspectFixedSnapshot(
      verified.capability,
      "0".repeat(40),
      gitFixedSnapshotAdapter,
    ),
    null,
  );
  assert.equal(
    readFixedSnapshotFile(
      verified.capability,
      revision,
      "../escape.txt",
      gitFixedSnapshotAdapter,
    ),
    null,
  );
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-policy-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const outputOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(
    workspace,
    outputOwner,
    workspace,
  );
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const rejected = materializeFixedSnapshotCandidate(
    verified.capability,
    revision,
    outputOwner,
    output.capability,
    null,
    () => true,
    gitFixedSnapshotAdapter,
  );
  assert.equal(rejected?.status, "blocked");
  assert.equal(fs.existsSync(workspace), false);
});

test("Candidate出力はopaque Capabilityを要求し、部分生成を後始末する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-output-"));
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-work-"),
  );
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "fixed.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const forged = materializeFixedSnapshotCandidate(
    verified.capability,
    git(root, ["rev-parse", "HEAD"]),
    Object.freeze({}),
    Object.freeze({
      contract: "crdd-version-control/candidate-output/v1",
    }) as unknown as CandidateOutputCapability,
    null,
    null,
    gitFixedSnapshotAdapter,
  );
  assert.equal(forged?.status, "blocked");
  assert.equal(forged?.reason, "candidate_output_invalid");

  const outputOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(
    workspace,
    outputOwner,
    workspace,
  );
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const partial = materializeFixedSnapshotCandidate(
    verified.capability,
    git(root, ["rev-parse", "HEAD"]),
    outputOwner,
    output.capability,
    null,
    null,
    {
      ...gitFixedSnapshotAdapter,
      materialize(_repositoryRoot, _revision, target) {
        fs.writeFileSync(path.join(target, "partial.txt"), "partial\n", "utf8");
        return null;
      },
    },
  );
  assert.equal(partial?.status, "blocked");
  assert.equal(partial?.reason, "candidate_materialization_failed");
  assert.equal(partial?.effectIssued, true);
  assert.equal(partial?.cleanupConfirmed, true);
  assert.equal(fs.existsSync(workspace), false);
});

test("Candidate出力Capabilityは発行元Owner以外へ流用できない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-owner-root-"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-owner-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "fixed.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const owner = Object.freeze({});
  const otherOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(workspace, owner, workspace);
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const result = materializeFixedSnapshotCandidate(
    verified.capability,
    git(root, ["rev-parse", "HEAD"]),
    otherOwner,
    output.capability,
    null,
    null,
    gitFixedSnapshotAdapter,
  );
  assert.equal(result?.status, "blocked");
  assert.equal(result?.reason, "candidate_output_invalid");
});

test("Candidate出力Capabilityは空で安定したDirectoryだけに発行する", (t) => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-nonempty-"),
  );
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.writeFileSync(path.join(workspace, "existing.txt"), "existing\n", "utf8");
  assert.equal(
    verifyCandidateOutputDirectory(workspace, Object.freeze({}), workspace)
      .status,
    "blocked",
  );
  const ownedRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-owner-"),
  );
  const outside = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-outside-"),
  );
  t.after(() => fs.rmSync(ownedRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  assert.equal(
    verifyCandidateOutputDirectory(outside, Object.freeze({}), ownedRoot)
      .status,
    "blocked",
  );
});
