import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { describeRepositoryGitLayoutContract, inspectRepositoryGitLayoutCandidate } from "../src/security/repository-git-layout.mjs";

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repository-layout-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function makeGitDirectory(target) {
  fs.mkdirSync(path.join(target, "info"), { recursive: true });
  fs.writeFileSync(path.join(target, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(path.join(target, "config"), "[core]\n\trepositoryformatversion = 0\n", "utf8");
}

test("通常worktreeのcommon metadata候補をPath非保持で識別する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const result = inspectRepositoryGitLayoutCandidate({ repositoryRoot });
  assert.equal(result.status, "candidate");
  assert.equal(result.layout.kind, "normal_worktree");
  assert.equal(result.layout.excludeBackend, "common_git_directory_info_exclude");
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("linked worktreeはcommondirを解決する", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "linked");
  const common = path.join(parent, "main.git");
  const gitDirectory = path.join(common, "worktrees", "linked");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(common);
  fs.mkdirSync(gitDirectory, { recursive: true });
  fs.writeFileSync(path.join(gitDirectory, "HEAD"), "ref: refs/heads/linked\n", "utf8");
  fs.writeFileSync(path.join(repositoryRoot, ".git"), `gitdir: ${gitDirectory}\n`, "utf8");
  fs.writeFileSync(path.join(gitDirectory, "commondir"), "../..\n", "utf8");
  const result = inspectRepositoryGitLayoutCandidate({ repositoryRoot });
  assert.equal(result.status, "candidate");
  assert.equal(result.layout.kind, "linked_worktree");
});

test("対象自身がsubmodule等のgitfile worktreeでも候補化する", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "dependency");
  const gitDirectory = path.join(parent, ".git", "modules", "dependency");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(gitDirectory);
  fs.writeFileSync(path.join(repositoryRoot, ".git"), `gitdir: ${gitDirectory}\n`, "utf8");
  const result = inspectRepositoryGitLayoutCandidate({ repositoryRoot });
  assert.equal(result.status, "candidate");
  assert.equal(result.layout.kind, "gitfile_worktree");
  assert.equal(result.layout.referencedRepositoriesModified, false);
});

test("bare Repositoryと不正gitfileを拒否する", (t) => {
  const bare = temporaryRoot(t);
  fs.writeFileSync(path.join(bare, "HEAD"), "ref: refs/heads/main\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot: bare }).reason, "repository_worktree_required");
  const invalid = path.join(bare, "worktree");
  fs.mkdirSync(invalid);
  fs.writeFileSync(path.join(invalid, ".git"), "not-a-gitdir\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot: invalid }).reason, "repository_git_file_invalid");
});

test("Git directoryのHEADまたは共通configが欠落する候補を拒否する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  fs.mkdirSync(path.join(repositoryRoot, ".git"));
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "blocked");
});

test("Git markerのlinkを拒否する", (t) => {
  const parent = temporaryRoot(t);
  const target = path.join(parent, "target.git");
  const repositoryRoot = path.join(parent, "repository");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(target);
  try { fs.symlinkSync(target, path.join(repositoryRoot, ".git"), process.platform === "win32" ? "junction" : "dir"); }
  catch (error) { if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) { t.skip(`link unavailable: ${error.code}`); return; } throw error; }
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason, "repository_git_marker_link_rejected");
});

test("accessorとProxyを実行せずblockedへ閉じる", () => {
  let calls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "repositoryRoot", { enumerable: true, get() { calls += 1; return path.resolve("fixture"); } });
  assert.equal(inspectRepositoryGitLayoutCandidate(accessor).status, "blocked");
  assert.equal(calls, 0);
  const target = { repositoryRoot: path.resolve("fixture") };
  const proxy = new Proxy(target, { ownKeys() { calls += 1; return ["repositoryRoot"]; } });
  assert.equal(inspectRepositoryGitLayoutCandidate(proxy).status, "blocked");
  assert.equal(calls, 0);
});

test("Repository形態contractは参照Repository非変更と未実装境界を保つ", () => {
  const contract = describeRepositoryGitLayoutContract();
  assert.deepEqual(contract.supportedWorktreeForms, ["normal_worktree", "linked_worktree", "gitfile_worktree_including_submodule"]);
  assert.equal(contract.bareRepositorySupported, false);
  assert.equal(contract.referencedSubmodulesModified, false);
  assert.equal(contract.referencedRepositoriesModified, false);
  assert.equal(contract.multiRepositoryWriteOperationSupported, false);
  assert.equal(contract.filesystemResolutionCore, "implemented_candidate");
  assert.equal(contract.repositoryIdentityVerification, "not_implemented");
  assert.equal(contract.metadataWriteIntegration, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});
