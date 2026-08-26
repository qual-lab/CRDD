import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  verifyOwnedOperationManagementMountBinding,
} from "../src/security/execution-environment.ts";
import {
  inspectGitCommitTreeCandidate,
  materializeGitCommitTreeCandidate,
} from "../src/security/git-object-reader.ts";
import { resolveRepositoryGitLayout } from "../src/security/repository-git-layout-internal.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedRepositorySource,
  inspectRepositoryRevisionCandidate,
} from "../src/security/repository-operation-runtime.ts";

test("Repository-owned Git readerは外部Git CLIなしでCommitとTreeを照合する", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const layout = resolveRepositoryGitLayout(repositoryRoot);
  const repository = inspectRepositoryRevisionCandidate(repositoryRoot);
  assert.equal(repository?.status, "candidate");
  assert.equal(repository?.externalGitCliUsed, false);
  assert.equal(repository?.repositoryPathReported, false);
  assert.equal(repository?.repositoryKind, layout.kind);
  const exact = inspectGitCommitTreeCandidate({
    commonDirectory: layout.commonDirectory.realPath,
    revision: repository?.commit,
  });
  assert.equal(exact?.status, "candidate");
  assert.equal(exact?.commit, repository?.commit);
  assert.equal(exact?.tree, repository?.tree);
  assert.equal(exact?.externalGitCliUsed, false);
  assert.equal(exact?.repositoryPathReported, false);
});

test("現行CRDDのpacked objectから明示Read Projectionだけを隔離workspaceへ再構成する", (t) => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  const owned = createOwnedOperationDirectories();
  t.after(() => cleanupOwnedOperationDirectories(owned));
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const repository = bindRuntimeOwnedRepositoryOperation(
    managementCapability,
    repositoryRoot,
  );
  assert.ok(repository);
  const source = borrowRuntimeOwnedRepositorySource(
    repository.repositoryBindingCapability,
    managementCapability,
  );
  assert.ok(source);
  const binding = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  );
  const materialized = materializeGitCommitTreeCandidate({
    commonDirectory: source.commonDirectory,
    revision: source.revision,
    workspace: binding.mounts.workspace,
    readPaths: ["README.md"],
  });
  assert.equal(materialized?.status, "materialized");
  assert.equal(materialized?.baseCommit, repository.revision);
  assert.equal(materialized?.fileCount, 1);
  assert.equal(
    fs
      .readFileSync(path.join(binding.mounts.workspace, "README.md"), "utf8")
      .startsWith("# CRDD"),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(binding.mounts.workspace, ".git")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(binding.mounts.workspace, "01_Principles.md")),
    false,
  );
});
