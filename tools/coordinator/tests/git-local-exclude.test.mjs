import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  compileGitLocalExcludeCandidate,
  describeGitLocalExcludeContract
} from "../src/security/git-local-exclude.mjs";

const repositoryRoot = path.resolve("fixture-repository");

function input(overrides = {}) {
  return {
    repositoryRoot,
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_enable_request",
    ...overrides
  };
}

test("Repository既定Rootの完全一致local exclude候補を作る", () => {
  const result = compileGitLocalExcludeCandidate(input());
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

test("Repository内custom Rootをroot相対かつGit pattern安全なentryにする", () => {
  const customRoot = path.join(repositoryRoot, "runtime [x] #!");
  const result = compileGitLocalExcludeCandidate(input({ cliOverride: customRoot }));
  assert.equal(result.status, "candidate");
  assert.equal(result.plan.excludeEntry, "/runtime\\ \\[x\\]\\ \\#\\!/");
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

test("Repository外overrideにはGit excludeを要求しない", () => {
  const externalRoot = path.resolve(repositoryRoot, "..", "external-runtime");
  const result = compileGitLocalExcludeCandidate(input({ environmentOverride: externalRoot }));
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "repository_external_root_needs_no_git_exclude");
  assert.equal(result.plan.excludeRequired, false);
  assert.equal(result.plan.excludeEntry, null);
});

test("enable候補でない入力とRepository root自体を拒否する", () => {
  assert.equal(compileGitLocalExcludeCandidate(input({ activationIntent: null })).reason,
    "runtime_root_enable_candidate_required");
  assert.equal(compileGitLocalExcludeCandidate(input({ cliOverride: repositoryRoot })).reason,
    "runtime_root_must_not_equal_repository_root");
  assert.equal(compileGitLocalExcludeCandidate(input({
    cliOverride: path.join(repositoryRoot, ".git", "runtime")
  })).reason, "runtime_root_git_metadata_overlap");
});

test("accessorとProxyを実行せずblockedへ閉じる", () => {
  let getterCalls = 0;
  const accessor = input();
  Object.defineProperty(accessor, "repositoryRoot", {
    enumerable: true,
    get() { getterCalls += 1; return repositoryRoot; }
  });
  assert.equal(compileGitLocalExcludeCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const target = input();
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
  assert.equal(contract.metadataWriteIntegration, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});
