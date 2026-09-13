import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  gitFixedRevisionIdentityAdapter,
  gitRepositoryLocalIgnoreAdapter,
  observeFixedRevisionIdentity,
  registerRepositoryLocalIgnore,
  verifyRepositoryRoot,
} from "../../src/index.ts";
import {
  resolveRepositoryGitLayout,
  writeRepositoryLocalExclude,
} from "../../src/git/repository-layout.ts";

function git(root: string, arguments_: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...arguments_], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

function repository(t: test.TestContext): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-revision-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  return root;
}

test("現在の固定Revision Identityは未Commit変更に依存しない", (t) => {
  const root = repository(t);
  const revision = git(root, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "working\n", "utf8");
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const identity = observeFixedRevisionIdentity(
    verified.capability,
    gitFixedRevisionIdentityAdapter,
  );
  assert.equal(identity?.revisionIdentity, revision);
  assert.equal(identity?.repositoryForm, "primary");
  assert.equal(JSON.stringify(identity).includes(root), false);
});

test("Repository-local ignore登録は原子的・冪等でreadbackされる", (t) => {
  const root = repository(t);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const first = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  const second = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  assert.equal(first.status, "registered");
  assert.equal(second.status, "registered");
  if (first.status !== "registered" || second.status !== "registered") return;
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(first.effectIssued, true);
  assert.equal(first.effectConfirmation, "confirmed");
  assert.notEqual(first.beforeContentIdentity, first.afterContentIdentity);
  assert.equal(second.beforeContentIdentity, second.afterContentIdentity);
  assert.match(
    fs.readFileSync(path.join(root, ".git", "info", "exclude"), "utf8"),
    /^\.crdd\/$/mu,
  );
});

test("Repository-local ignoreは失敗段階ごとにEffectと後始末を区別する", async (t) => {
  const phases = [
    "lock_open",
    "write",
    "fsync",
    "close",
    "rename",
    "post_rename_readback",
    "post_readback",
  ] as const;
  for (const phase of phases) {
    await t.test(phase, () => {
      const root = repository(t);
      const verified = verifyRepositoryRoot(root);
      assert.equal(verified.status, "completed");
      if (verified.status !== "completed") return;
      const result = registerRepositoryLocalIgnore(
        verified.capability,
        ".crdd/",
        (repositoryRoot, entry) =>
          writeRepositoryLocalExclude(
            resolveRepositoryGitLayout(repositoryRoot),
            entry,
            (current) => {
              if (current === phase) throw new Error(`injected_${phase}`);
            },
          ),
      );
      assert.equal(result.status, "blocked");
      if (result.status !== "blocked") return;
      const afterRename =
        phase === "post_rename_readback" || phase === "post_readback";
      assert.equal(result.effectIssued, afterRename);
      assert.equal(
        result.effectConfirmation,
        afterRename ? "unknown" : "not_issued",
      );
      assert.equal(result.effectStateUnknown, afterRename);
      assert.equal(result.cleanupConfirmed, true);
    });
  }
});

test("Repository-local ignoreは競合Writerを未変更として扱わない", (t) => {
  const root = repository(t);
  const lockPath = path.join(
    root,
    ".git",
    "info",
    ".crdd-runtime-exclude.lock",
  );
  fs.writeFileSync(lockPath, "other-writer\n", "utf8");
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const result = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  assert.equal(result.status, "blocked");
  if (result.status !== "blocked") return;
  assert.equal(result.effectIssued, false);
  assert.equal(result.effectConfirmation, "not_issued");
  assert.equal(result.retryAllowed, true);
  assert.equal(fs.readFileSync(lockPath, "utf8"), "other-writer\n");
});

test("Repository-local ignoreは二つの実Process競合後も内容と再入場を保つ", async (t) => {
  const root = repository(t);
  const exchange = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-writers-"));
  t.after(() => fs.rmSync(exchange, { recursive: true, force: true }));
  const startPath = path.join(exchange, "start");
  const fixture = path.resolve(
    import.meta.dirname,
    "../fixtures/repository-ignore-writer.ts",
  );
  const children = [".crdd/", ".cros/"].map((entry, index) => {
    const readyPath = path.join(exchange, `ready-${index}`);
    const resultPath = path.join(exchange, `result-${index}.json`);
    return Object.freeze({
      entry,
      readyPath,
      resultPath,
      child: spawn(
        process.execPath,
        [fixture, root, entry, readyPath, startPath, resultPath],
        { stdio: "ignore", windowsHide: true },
      ),
    });
  });
  const deadline = Date.now() + 10_000;
  while (!children.every(({ readyPath }) => fs.existsSync(readyPath))) {
    if (Date.now() >= deadline) throw new Error("writer_ready_timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  fs.writeFileSync(startPath, "start\n", { flag: "wx" });
  await Promise.all(
    children.map(
      ({ child }) =>
        new Promise<void>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`writer_exit_${String(code)}`)),
          );
        }),
    ),
  );
  const results = children.map(({ resultPath }) =>
    JSON.parse(fs.readFileSync(resultPath, "utf8")),
  );
  assert.equal(
    results.filter((result) => result.status === "completed").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "blocked").length,
    1,
  );
  const blockedIndex = results.findIndex(
    (result) => result.status === "blocked",
  );
  assert.notEqual(blockedIndex, -1);
  const blockedWriter = children[blockedIndex];
  if (!blockedWriter) return;
  const retry = writeRepositoryLocalExclude(
    resolveRepositoryGitLayout(root),
    blockedWriter.entry,
  );
  assert.equal(retry.status, "completed");
  const content = fs.readFileSync(
    path.join(root, ".git", "info", "exclude"),
    "utf8",
  );
  assert.match(content, /^\.crdd\/$/mu);
  assert.match(content, /^\.cros\/$/mu);
  assert.equal(
    fs.existsSync(
      path.join(root, ".git", "info", ".crdd-runtime-exclude.lock"),
    ),
    false,
  );
});

test("linked worktreeからのRepository-local ignoreは共有common directoryへ一度だけ登録する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-linked-main-"));
  const linked = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-linked-"));
  fs.rmSync(linked, { recursive: true });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  t.after(() => {
    try {
      git(root, ["worktree", "remove", "--force", linked]);
    } catch {
      // The outer temporary repository cleanup is the final fallback.
    }
    fs.rmSync(linked, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });
  git(root, ["worktree", "add", "-b", "linked-ignore", linked]);
  const verified = verifyRepositoryRoot(linked);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const result = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  assert.equal(result.status, "registered");
  assert.match(
    fs.readFileSync(path.join(root, ".git", "info", "exclude"), "utf8"),
    /^\.crdd\/$/mu,
  );
});
