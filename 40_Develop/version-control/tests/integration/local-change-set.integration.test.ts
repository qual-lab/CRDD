import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGitLocalChangeSetAdapter } from "../../src/git/local-change-set-adapter.ts";
import {
  changedPaths,
  gitLocalChangeSetAdapter,
  observeLocalChangeSet,
  verifyRepositoryRoot,
} from "../../src/index.ts";

function git(root: string, commandArguments: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...commandArguments], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

test("実RepositoryのRevision・準備・作業・未登録変更を分離して観測する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-changes-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  for (const name of ["revision.txt", "prepared.txt", "working.txt"])
    fs.writeFileSync(path.join(root, name), "baseline\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "baseline"]);
  const base = git(root, ["rev-parse", "HEAD"]);

  fs.writeFileSync(path.join(root, "revision.txt"), "revision\n", "utf8");
  git(root, ["add", "revision.txt"]);
  git(root, ["commit", "-m", "revision"]);
  fs.writeFileSync(path.join(root, "prepared.txt"), "prepared\n", "utf8");
  git(root, ["add", "prepared.txt"]);
  fs.writeFileSync(path.join(root, "working.txt"), "working\n", "utf8");
  fs.writeFileSync(path.join(root, "unregistered.txt"), "new\n", "utf8");

  const rootResult = verifyRepositoryRoot(root);
  assert.equal(rootResult.status, "completed");
  if (rootResult.status !== "completed") return;
  const observed = observeLocalChangeSet(
    rootResult.capability,
    base,
    gitLocalChangeSetAdapter,
  );
  assert.deepEqual(observed.revisionChanges, ["revision.txt"]);
  assert.deepEqual(observed.preparedChanges, ["prepared.txt"]);
  assert.deepEqual(observed.workingChanges, ["working.txt"]);
  assert.deepEqual(observed.unregisteredPaths, ["unregistered.txt"]);
  assert.deepEqual(changedPaths(observed), [
    "prepared.txt",
    "revision.txt",
    "unregistered.txt",
    "working.txt",
  ]);
  assert.equal(JSON.stringify(observed).includes(root), false);
});

test("四つの観測のどこで失敗しても部分的な変更集合を公開しない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-failure-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "baseline"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const phases = [
    "revision_changes",
    "prepared_changes",
    "working_changes",
    "unregistered_paths",
  ];
  for (const [failureIndex, phase] of phases.entries()) {
    let call = 0;
    const adapter = createGitLocalChangeSetAdapter(() => {
      const current = call;
      call += 1;
      return {
        status: current === failureIndex ? 1 : 0,
        stdout: Buffer.from("observed.ts\0", "utf8"),
      };
    });
    assert.throws(
      () => observeLocalChangeSet(verified.capability, "HEAD", adapter),
      new RegExp(`local_change_set_observation_failed:${phase}`, "u"),
    );
  }
});

test("表現できないbackslashを含む名前を別Pathへ変換せず拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-verbatim-path-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const adapter = createGitLocalChangeSetAdapter(() => ({
    status: 0,
    stdout: Buffer.from("directory\\name.ts\0", "utf8"),
  }));
  assert.throws(
    () => observeLocalChangeSet(verified.capability, "HEAD", adapter),
    /local_change_set_observation_invalid:revision_changes/u,
  );
});
