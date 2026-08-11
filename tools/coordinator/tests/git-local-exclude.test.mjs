import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyGitLocalExcludeCandidate,
  compileGitLocalExcludeCandidate,
  describeGitLocalExcludeContract
} from "../src/security/git-local-exclude.mjs";

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-local-exclude-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function makeGitDirectory(target) {
  fs.mkdirSync(path.join(target, "info"), { recursive: true });
  fs.writeFileSync(path.join(target, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(path.join(target, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n", "utf8");
}

function normalRepository(t) {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  return repositoryRoot;
}

function linkedRepository(t) {
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
  return repositoryRoot;
}

function input(repositoryRoot, overrides = {}) {
  return {
    repositoryRoot,
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_enable_request",
    ...overrides
  };
}

test("Repository既定Rootの完全一致local exclude候補を作る", (t) => {
  const repositoryRoot = normalRepository(t);
  const result = compileGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "git_local_exclude_write_and_verification_required");
  assert.deepEqual(result.plan, {
    excludeRequired: true,
    excludeEntry: "/.crdd-runtime/",
    trackedGitignoreModificationAllowed: false
  });
  assert.equal(result.gitMetadataWriteIssued, false);
  assert.equal(result.runtimeCapabilityIssued, false);
});

test("通常Repositoryのcustom Rootをroot相対かつGit pattern安全なentryにする", (t) => {
  const repositoryRoot = normalRepository(t);
  const customRoot = path.join(repositoryRoot, "runtime [x] #!");
  const result = compileGitLocalExcludeCandidate(input(repositoryRoot, { cliOverride: customRoot }));
  assert.equal(result.status, "candidate");
  assert.equal(result.plan.excludeEntry, "/runtime\\ \\[x\\]\\ \\#\\!/");
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("Repository外overrideにはGit excludeを要求しない", (t) => {
  const repositoryRoot = normalRepository(t);
  const externalRoot = path.resolve(repositoryRoot, "..", "external-runtime");
  const result = compileGitLocalExcludeCandidate(input(repositoryRoot, { environmentOverride: externalRoot }));
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "repository_external_root_needs_no_git_exclude");
  assert.equal(result.plan.excludeRequired, false);
  assert.equal(result.plan.excludeEntry, null);
});

test("enable候補でない入力とRepository root自体を拒否する", (t) => {
  const repositoryRoot = normalRepository(t);
  assert.equal(compileGitLocalExcludeCandidate(input(repositoryRoot, { activationIntent: null })).reason,
    "runtime_root_enable_candidate_required");
  assert.equal(compileGitLocalExcludeCandidate(input(repositoryRoot, { cliOverride: repositoryRoot })).reason,
    "runtime_root_must_not_equal_repository_root");
  assert.equal(compileGitLocalExcludeCandidate(input(repositoryRoot, {
    cliOverride: path.join(repositoryRoot, ".git", "runtime")
  })).reason, "runtime_root_git_metadata_overlap");
});

test("linked worktreeは既定Rootだけを共有exclude候補にする", (t) => {
  const repositoryRoot = linkedRepository(t);
  const defaultResult = compileGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(defaultResult.status, "candidate");
  assert.equal(defaultResult.plan.excludeEntry, "/.crdd-runtime/");

  const cliDefaultResult = compileGitLocalExcludeCandidate(input(repositoryRoot, {
    cliOverride: path.join(repositoryRoot, ".crdd-runtime")
  }));
  assert.equal(cliDefaultResult.status, "candidate");
  assert.equal(cliDefaultResult.plan.excludeEntry, "/.crdd-runtime/");
  assert.equal(JSON.stringify(cliDefaultResult).includes(repositoryRoot), false);

  const environmentDefaultResult = compileGitLocalExcludeCandidate(input(repositoryRoot, {
    environmentOverride: path.join(repositoryRoot, ".crdd-runtime")
  }));
  assert.equal(environmentDefaultResult.status, "candidate");
  assert.equal(environmentDefaultResult.plan.excludeEntry, "/.crdd-runtime/");
  assert.equal(JSON.stringify(environmentDefaultResult).includes(repositoryRoot), false);

  const customResult = compileGitLocalExcludeCandidate(input(repositoryRoot, {
    cliOverride: path.join(repositoryRoot, "custom-runtime")
  }));
  assert.equal(customResult.status, "blocked");
  assert.equal(customResult.reason, "linked_worktree_repository_custom_root_rejected");

  const externalResult = compileGitLocalExcludeCandidate(input(repositoryRoot, {
    cliOverride: path.join(path.dirname(repositoryRoot), "external-runtime")
  }));
  assert.equal(externalResult.status, "candidate");
  assert.equal(externalResult.plan.excludeRequired, false);
});

test("Repository内RootはGit layout候補を再確認する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  const result = compileGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "repository_git_layout_candidate_required");
});

test("accessorとProxyを実行せずblockedへ閉じる", (t) => {
  let getterCalls = 0;
  const repositoryRoot = normalRepository(t);
  const accessor = input(repositoryRoot);
  Object.defineProperty(accessor, "repositoryRoot", {
    enumerable: true,
    get() { getterCalls += 1; return repositoryRoot; }
  });
  assert.equal(compileGitLocalExcludeCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const target = input(repositoryRoot);
  const proxy = new Proxy(target, {
    ownKeys() { proxyCalls += 1; return Reflect.ownKeys(target); }
  });
  assert.equal(compileGitLocalExcludeCandidate(proxy).status, "blocked");
  assert.equal(proxyCalls, 0);
});

test("local exclude契約はmetadata書込み候補とactivation未実装を分離する", () => {
  const contract = describeGitLocalExcludeContract();
  assert.equal(contract.repositoryContainedRootBackend, ".git/info/exclude");
  assert.equal(contract.repositoryExternalRootRequiresExclude, false);
  assert.equal(contract.trackedGitignoreModificationAllowed, false);
  assert.equal(contract.exactRootRelativeEntryRequired, true);
  assert.equal(contract.idempotentWriteRequired, true);
  assert.equal(contract.postWriteVerificationRequired, true);
  assert.equal(contract.writeFailureBlocksActivation, true);
  assert.equal(contract.gitIgnoreIsSecurityBoundary, false);
  assert.equal(contract.repositoryGitDirectoryResolution, "implemented_candidate");
  assert.equal(contract.linkedWorktreeDefaultRootAllowed, true);
  assert.equal(contract.linkedWorktreeRepositoryContainedCustomRootAllowed, false);
  assert.equal(contract.linkedWorktreeExternalOverrideAllowed, true);
  assert.equal(contract.metadataWriteIntegration, "implemented_candidate");
  assert.equal(contract.metadataWriteActivationIntegration, "not_implemented");
  assert.equal(contract.maximumExcludeBytes, 131072);
  assert.equal(contract.existingGitInfoDirectoryRequired, true);
  assert.equal(contract.runtimeCapabilityIssued, false);
});

test("Adapter候補は既存内容を保ち完全一致entryを冪等更新する", (t) => {
  const repositoryRoot = normalRepository(t);
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  fs.writeFileSync(exclude, "# local rules\n/build/\n", "utf8");
  const first = applyGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(first.status, "candidate");
  assert.equal(first.gitMetadataWriteIssued, true);
  assert.equal(first.gitMetadataWriteVerified, true);
  assert.equal(fs.readFileSync(exclude, "utf8"), "# local rules\n/build/\n/.crdd-runtime/\n");
  const second = applyGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(second.status, "candidate");
  assert.equal(second.gitMetadataWriteIssued, false);
  assert.equal(second.gitMetadataWriteVerified, true);
  assert.equal(JSON.stringify(first).includes(repositoryRoot), false);
});

test("空または未作成excludeを作成し外部overrideではmetadataを書かない", (t) => {
  const repositoryRoot = normalRepository(t);
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  fs.writeFileSync(exclude, "");
  assert.equal(applyGitLocalExcludeCandidate(input(repositoryRoot)).status, "candidate");
  assert.equal(fs.readFileSync(exclude, "utf8"), "/.crdd-runtime/\n");
  fs.unlinkSync(exclude);
  assert.equal(applyGitLocalExcludeCandidate(input(repositoryRoot)).status, "candidate");
  const before = fs.readdirSync(path.join(repositoryRoot, ".git", "info"));
  const external = applyGitLocalExcludeCandidate(input(repositoryRoot, {
    cliOverride: path.join(path.dirname(repositoryRoot), "external-runtime")
  }));
  assert.equal(external.status, "candidate");
  assert.equal(external.gitMetadataWriteIssued, false);
  assert.deepEqual(fs.readdirSync(path.join(repositoryRoot, ".git", "info")), before);
});

test("既存lock、過大exclude、linkをblockedへ閉じる", (t) => {
  const repositoryRoot = normalRepository(t);
  const info = path.join(repositoryRoot, ".git", "info");
  const exclude = path.join(info, "exclude");
  const lock = path.join(info, ".crdd-runtime-exclude.lock");
  fs.writeFileSync(lock, "unknown", "utf8");
  assert.equal(applyGitLocalExcludeCandidate(input(repositoryRoot)).status, "blocked");
  assert.equal(fs.readFileSync(lock, "utf8"), "unknown");
  fs.unlinkSync(lock);
  fs.writeFileSync(exclude, "x".repeat(131073), "utf8");
  assert.equal(applyGitLocalExcludeCandidate(input(repositoryRoot)).status, "blocked");
  fs.unlinkSync(exclude);
  const target = path.join(info, "target");
  fs.writeFileSync(target, "safe\n", "utf8");
  try { fs.symlinkSync(target, exclude, "file"); }
  catch (error) { if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) return; throw error; }
  assert.equal(applyGitLocalExcludeCandidate(input(repositoryRoot)).status, "blocked");
});

test("書込み中の変化とclose失敗を成功へ流用しない", (t) => {
  const repositoryRoot = normalRepository(t);
  const lock = path.join(repositoryRoot, ".git", "info", ".crdd-runtime-exclude.lock");
  const originalWrite = fs.writeSync;
  let changed = false;
  fs.writeSync = function(descriptor, buffer, offset, length, position) {
    const written = originalWrite.call(fs, descriptor, buffer, offset, length, position);
    if (!changed) { changed = true; fs.ftruncateSync(descriptor, Math.max(0, written - 1)); }
    return written;
  };
  try { assert.equal(applyGitLocalExcludeCandidate(input(repositoryRoot)).status, "blocked"); }
  finally { fs.writeSync = originalWrite; }
  assert.equal(fs.existsSync(lock), false);
  const originalClose = fs.closeSync;
  let failed = false;
  fs.closeSync = function(descriptor) {
    originalClose.call(fs, descriptor);
    if (!failed) { failed = true; throw new Error("fixture-close-failure"); }
  };
  try { assert.equal(applyGitLocalExcludeCandidate(input(repositoryRoot)).status, "blocked"); }
  finally { fs.closeSync = originalClose; }
  assert.equal(failed, true);
  assert.equal(fs.existsSync(lock), false);
});

test("置換後の検証失敗は書込み済みblockedとして返す", (t) => {
  const repositoryRoot = normalRepository(t);
  const exclude = path.join(repositoryRoot, ".git", "info", "exclude");
  const originalRename = fs.renameSync;
  let replaced = false;
  fs.renameSync = function(source, destination) {
    originalRename.call(fs, source, destination);
    if (!replaced) {
      replaced = true;
      fs.writeFileSync(destination, "/different-entry/\n", "utf8");
    }
  };
  let result;
  try { result = applyGitLocalExcludeCandidate(input(repositoryRoot)); }
  finally { fs.renameSync = originalRename; }
  assert.equal(result.status, "blocked");
  assert.equal(result.gitMetadataWriteIssued, true);
  assert.equal(result.gitMetadataWriteVerified, false);
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
  assert.equal(fs.readFileSync(exclude, "utf8"), "/different-entry/\n");
});

test("linked worktreeはcommon excludeだけを更新する", (t) => {
  const repositoryRoot = linkedRepository(t);
  const result = applyGitLocalExcludeCandidate(input(repositoryRoot));
  assert.equal(result.status, "candidate");
  const gitDirectory = fs.readFileSync(path.join(repositoryRoot, ".git"), "utf8")
    .slice("gitdir: ".length).trim();
  const commonDirectory = path.resolve(gitDirectory, "../..");
  assert.equal(fs.readFileSync(path.join(commonDirectory, "info", "exclude"), "utf8"), "/.crdd-runtime/\n");
  assert.equal(fs.existsSync(path.join(gitDirectory, "info", "exclude")), false);
});
