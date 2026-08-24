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
import { materializeGitCommitTreeCandidate } from "../src/security/git-object-reader.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedRepositorySource,
} from "../src/security/repository-operation-runtime.ts";

test("現行CRDDのpacked objectをRuntime-owned隔離workspaceへ再構成する", (t) => {
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
  });
  assert.equal(materialized?.status, "materialized");
  assert.equal(materialized?.baseCommit, repository.revision);
  assert.ok((materialized?.fileCount ?? 0) > 100);
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
});
