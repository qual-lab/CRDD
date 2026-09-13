import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../src/index.ts";

function git(cwd: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function repository(t: test.TestContext): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-root-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  git(root, ["add", "tracked.txt"]);
  git(root, ["commit", "-m", "baseline"]);
  return fs.realpathSync.native(root);
}

test("exact and nested repository locations issue the same scoped capability", (t) => {
  const root = repository(t);
  const nested = path.join(root, "nested", "deeper");
  fs.mkdirSync(nested, { recursive: true });

  const exact = verifyRepositoryRoot(root);
  const enclosing = verifyRepositoryRootFromWorkingDirectory(nested);
  assert.equal(exact.status, "completed");
  assert.equal(enclosing.status, "completed");
  assert.equal(resolveVerifiedRepositoryRoot(exact.capability), root);
  assert.equal(resolveVerifiedRepositoryRoot(enclosing.capability), root);
  assert.equal(resolveVerifiedRepositoryRootFromWorkingDirectory(nested), root);
});

test("an invalid nested boundary is terminal", (t) => {
  const root = repository(t);
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, ".git"), "not a gitdir\n", "utf8");

  assert.deepEqual(verifyRepositoryRootFromWorkingDirectory(nested), {
    status: "blocked",
    reason: "repository_root_invalid",
    capability: null,
  });
  assert.throws(
    () => resolveVerifiedRepositoryRootFromWorkingDirectory(nested),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "repository_boundary_invalid" &&
      !error.message.includes("git"),
  );
});

test("a linked worktree is a valid exact repository root", (t) => {
  const root = repository(t);
  const linked = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-linked-"));
  fs.rmSync(linked, { recursive: true, force: true });
  t.after(() => fs.rmSync(linked, { recursive: true, force: true }));
  git(root, ["worktree", "add", "--detach", linked]);

  const result = verifyRepositoryRoot(fs.realpathSync.native(linked));
  assert.equal(result.status, "completed");
});

test("a standard submodule worktree is a distinct valid repository root", (t) => {
  const root = repository(t);
  const source = repository(t);
  git(root, [
    "-c",
    "protocol.file.allow=always",
    "submodule",
    "add",
    "--quiet",
    source,
    "dependency",
  ]);
  const dependency = fs.realpathSync.native(path.join(root, "dependency"));

  const result = verifyRepositoryRoot(dependency);
  assert.equal(result.status, "completed");
  assert.equal(resolveVerifiedRepositoryRoot(result.capability), dependency);
});

test("repository-local runtime writes do not invalidate repository identity", (t) => {
  const root = repository(t);
  const result = verifyRepositoryRoot(root);
  assert.equal(result.status, "completed");

  fs.mkdirSync(path.join(root, ".crdd"));
  assert.equal(resolveVerifiedRepositoryRoot(result.capability), root);
});

test("a capability fails closed after its repository boundary disappears", (t) => {
  const root = repository(t);
  const result = verifyRepositoryRoot(root);
  assert.equal(result.status, "completed");

  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  assert.equal(resolveVerifiedRepositoryRoot(result.capability), null);
});

test("arbitrary directories and forged capability values fail closed", (t) => {
  const arbitrary = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-none-"));
  t.after(() => fs.rmSync(arbitrary, { recursive: true, force: true }));
  assert.equal(verifyRepositoryRoot(arbitrary).status, "blocked");
  assert.equal(
    resolveVerifiedRepositoryRoot({
      contract: "crdd-version-control/repository-location/v1",
    }),
    null,
  );
});

test("Windows repository identity does not depend on caller path casing", {
  skip: process.platform !== "win32",
}, (t) => {
  const root = repository(t);
  assert.equal(verifyRepositoryRoot(root.toUpperCase()).status, "completed");
});
