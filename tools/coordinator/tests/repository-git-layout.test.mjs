import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { describeRepositoryGitLayoutContract, inspectRepositoryGitLayoutCandidate } from "../src/security/repository-git-layout.ts";

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repository-layout-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function makeGitDirectory(target) {
  fs.mkdirSync(path.join(target, "info"), { recursive: true });
  fs.writeFileSync(path.join(target, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(path.join(target, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n", "utf8");
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

test("core.worktreeを使わない限定gitfile worktreeを候補化する", (t) => {
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

test("標準submodule自身のcore.worktree構成は対象候補にしない", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "dependency");
  const gitDirectory = path.join(parent, ".git", "modules", "dependency");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(gitDirectory);
  fs.writeFileSync(path.join(gitDirectory, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tworktree = ../../../../dependency\n", "utf8");
  fs.writeFileSync(path.join(repositoryRoot, ".git"), `gitdir: ${gitDirectory}\n`, "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported");
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

test("限定Repository formatだけをAuthority候補として受理する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  const gitDirectory = path.join(repositoryRoot, ".git");
  makeGitDirectory(gitDirectory);
  const config = path.join(gitDirectory, "config");
  fs.writeFileSync(config, "[core]\n\trepositoryformatversion = 0\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason, "repository_git_config_unsupported");
  for (const value of ["true", "", "yes", "on", "1", "no", "off", "0"]) {
    fs.writeFileSync(config, `[core]\n\trepositoryformatversion = 0\n\tbare = ${value}\n`, "utf8");
    assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason,
      "repository_git_config_unsupported");
  }
  fs.writeFileSync(config,
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tbare = false\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported");
  fs.writeFileSync(config, "[core]\n\trepositoryformatversion = 1\n[extensions]\n\tworktreeConfig = true\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason, "repository_git_config_unsupported");
  fs.writeFileSync(config, "[core]\n\trepositoryformatversion = 0\n\tworktree = ../other\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason, "repository_git_config_unsupported");
  fs.writeFileSync(config, "[core]\n\trepositoryformatversion = 0\n[include]\n\tpath = ../shared\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason, "repository_git_config_unsupported");
  fs.writeFileSync(config, "[core \"not-the-core-section\"]\n\trepositoryformatversion = 0\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).reason, "repository_git_config_unsupported");
  fs.writeFileSync(config, "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tignorecase = true\n", "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "candidate");
});

test("control fileは上限ちょうどを受理し上限+1を拒否する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const head = path.join(repositoryRoot, ".git", "HEAD");
  fs.writeFileSync(head, "a".repeat(4096), "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "candidate");
  fs.writeFileSync(head, "a".repeat(4097), "utf8");
  assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "blocked");
});

test("lstat後にcontrol fileを同名の別実体へ置換しても読まない", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const marker = path.join(repositoryRoot, ".git");
  const originalOpen = fs.openSync;
  let replaced = false;
  fs.openSync = function(target, ...args) {
    if (!replaced && target === path.join(marker, "HEAD")) {
      replaced = true;
      fs.renameSync(target, `${target}.original`);
      fs.writeFileSync(target, "b".repeat(4097), "utf8");
    }
    return originalOpen.call(fs, target, ...args);
  };
  try { assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "blocked"); }
  finally { fs.openSync = originalOpen; }
});

test("同一handleの読取り中にsizeが変わる場合はblockedへ閉じる", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const originalRead = fs.readSync;
  let changed = false;
  fs.readSync = function(descriptor, ...args) {
    if (!changed) {
      changed = true;
      fs.ftruncateSync(descriptor, 1);
    }
    return originalRead.call(fs, descriptor, ...args);
  };
  try { assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "blocked"); }
  finally { fs.readSync = originalRead; }
});

test("realpath解決中にRepository directoryを別実体へ置換しても候補化しない", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "repository");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const originalNative = fs.realpathSync.native;
  let replaced = false;
  fs.realpathSync.native = function(target, ...args) {
    if (!replaced && target === repositoryRoot) {
      replaced = true;
      fs.renameSync(repositoryRoot, `${repositoryRoot}.original`);
      fs.mkdirSync(repositoryRoot);
      makeGitDirectory(path.join(repositoryRoot, ".git"));
    }
    return originalNative.call(fs.realpathSync, target, ...args);
  };
  try { assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "blocked"); }
  finally { fs.realpathSync.native = originalNative; }
});

test("control fileのclose失敗を成功へ流用しない", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const originalClose = fs.closeSync;
  let failed = false;
  fs.closeSync = function(descriptor) {
    originalClose.call(fs, descriptor);
    if (!failed) { failed = true; throw new Error("fixture-close-failure"); }
  };
  try { assert.equal(inspectRepositoryGitLayoutCandidate({ repositoryRoot }).status, "blocked"); }
  finally { fs.closeSync = originalClose; }
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
  assert.deepEqual(contract.supportedWorktreeForms,
    ["normal_worktree", "linked_worktree", "gitfile_worktree_without_core_worktree"]);
  assert.equal(contract.bareRepositorySupported, false);
  assert.equal(contract.referencedSubmodulesModified, false);
  assert.equal(contract.referencedRepositoriesModified, false);
  assert.equal(contract.multiRepositoryWriteOperationSupported, false);
  assert.equal(contract.filesystemResolutionCore, "implemented_candidate");
  assert.equal(contract.supportedRepositoryFormat, "version_0_without_extensions_or_includes");
  assert.equal(contract.gitCliAuthorityRequired, false);
  assert.equal(contract.repositoryIdentityVerification, "not_implemented");
  assert.equal(contract.metadataPlacementLayoutVerification, "implemented_narrow_parser_candidate");
  assert.equal(contract.metadataWriteIntegration, "implemented_candidate");
  assert.equal(contract.metadataWriteActivationIntegration, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});
