import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  describeRepositoryRootResolutionContract,
  REPOSITORY_ROOT_RESOLUTION_CONTRACT,
  REPOSITORY_ROOT_RESOLUTION_CONTRACT_REVISION,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../src/security/repository-root-resolution.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

test("repository root resolution binds a package working directory to the project root", () => {
  assert.equal(
    resolveVerifiedRepositoryRootFromWorkingDirectory(import.meta.dirname),
    fs.realpathSync.native(repositoryRoot),
  );
  assert.equal(
    resolveVerifiedRepositoryRootFromWorkingDirectory(repositoryRoot),
    fs.realpathSync.native(repositoryRoot),
  );
});

test("repository root resolution does not walk past an invalid nested Git boundary", (t) => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-root-boundary-"));
  const nested = path.join(outer, "nested", "package");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(outer, ".git"), "invalid\n", "utf8");
  t.after(() => fs.rmSync(outer, { recursive: true, force: true }));

  assert.throws(
    () => resolveVerifiedRepositoryRootFromWorkingDirectory(nested),
    /repository_git_boundary_invalid/u,
  );
});

test("repository root resolution fails closed when no Git boundary exists", () => {
  // A temporary directory inside this checkout inherits its Git boundary.
  // Inspect the volume root without creating files outside the repository.
  const target = path.parse(fs.realpathSync.native(repositoryRoot)).root;
  assert.equal(
    fs.existsSync(path.join(target, ".git")),
    false,
    "This integration case requires a volume root without a Git boundary",
  );
  assert.throws(
    () => resolveVerifiedRepositoryRootFromWorkingDirectory(target),
    /verified_repository_root_required/u,
  );
});

test("repository root resolution contract exposes no path", () => {
  const contract = describeRepositoryRootResolutionContract();
  assert.equal(contract.contract, REPOSITORY_ROOT_RESOLUTION_CONTRACT);
  assert.equal(
    contract.contractRevision,
    REPOSITORY_ROOT_RESOLUTION_CONTRACT_REVISION,
  );
  assert.equal(contract.processWorkingDirectoryIsRepositoryAuthority, false);
  assert.equal(contract.invalidNestedGitBoundaryTraversalAllowed, false);
  assert.equal(contract.repositoryPathReported, false);
  assert.equal(JSON.stringify(contract).includes(repositoryRoot), false);
});
