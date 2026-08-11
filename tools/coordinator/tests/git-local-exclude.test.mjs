import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
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
  fs.writeFileSync(path.join(target, "config"), "[core]\n\trepositoryformatversion = 0\n", "utf8");
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

test("local exclude CoreはGit metadata書込みやCapabilityを成立させない", () => {
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
  assert.equal(contract.metadataWriteIntegration, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});
