import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
} from "../../src/security/execution-environment.ts";
import {
  inspectGitCommitTreeCandidate,
  materializeGitCommitTreeCandidate,
  readGitCommitFileCandidate,
} from "../../src/security/git-object-reader.ts";
import { resolveRepositoryGitLayout } from "../../src/security/repository-git-layout-internal.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  borrowRuntimeOwnedRepositorySource,
  inspectRepositoryRevisionCandidate,
} from "../../src/security/repository-operation-runtime.ts";
import {
  createGitPackedObjectFixture,
  mutateGitPackedObjectFixture,
} from "../fixtures/git-packed-object-fixture.ts";

for (const kind of ["base", "ofs", "ref"] as const) {
  test(`Git生成pack-only ${kind}は公開3APIで完全bytesを復元する`, {
    skip: process.platform !== "win32",
  }, (t) => {
    const fixture = createGitPackedObjectFixture(kind);
    t.after(() => fixture.dispose());
    const { commonDirectory, revision, tree } = fixture;
    assert.deepEqual(
      inspectGitCommitTreeCandidate({ commonDirectory, revision }),
      {
        status: "candidate",
        commit: revision,
        tree,
        externalGitCliUsed: false,
        repositoryPathReported: false,
      },
    );
    for (const file of fixture.files) {
      const read = readGitCommitFileCandidate({
        commonDirectory,
        revision,
        relativePath: file.name,
      });
      assert.equal(read?.status, "read");
      assert.equal(read?.relativePath, file.name);
      assert.equal(read?.mode, file.mode);
      assert.deepEqual(read?.bytes, file.bytes);
      assert.equal(
        read?.sha256,
        createHash("sha256").update(file.bytes).digest("hex"),
      );
      assert.equal(
        createHash("sha1")
          .update(`blob ${file.bytes.length}\0`)
          .update(read?.bytes ?? Buffer.alloc(0))
          .digest("hex"),
        file.id,
      );
    }
    const workspace = path.join(fixture.root, "workspace");
    fs.mkdirSync(workspace);
    const result = materializeGitCommitTreeCandidate({
      commonDirectory,
      revision,
      workspace,
      readPaths: [fixture.selected.name],
    });
    assert.equal(result?.status, "materialized");
    if (result?.status !== "materialized")
      assert.fail("pack materialization failed");
    assert.equal(result.baseCommit, revision);
    assert.equal(result.baseTree, tree);
    assert.equal(result.fileCount, 1);
    assert.equal(result.byteLength, fixture.selected.bytes.length);
    assert.deepEqual(fs.readdirSync(workspace), [fixture.selected.name]);
    assert.deepEqual(
      fs.readFileSync(path.join(workspace, fixture.selected.name)),
      fixture.selected.bytes,
    );
  });
}

for (const mutation of [
  "index-checksum",
  "pack-checksum",
  "reference",
  "offset",
  "integer",
  "base-size",
  "copy",
  "result-size",
  "object-id",
] as const) {
  test(`Git pack破損 ${mutation}は公開読取り・投影で拒否する`, {
    skip: process.platform !== "win32",
  }, (t) => {
    const fixture = createGitPackedObjectFixture(
      mutation === "offset" ? "ofs" : "ref",
    );
    t.after(() => fixture.dispose());
    const { commonDirectory, revision } = fixture;
    const request = {
      commonDirectory,
      revision,
      relativePath: fixture.selected.name,
    };
    assert.deepEqual(
      readGitCommitFileCandidate(request)?.bytes,
      fixture.selected.bytes,
    );
    mutateGitPackedObjectFixture(fixture, mutation);
    const inspection = inspectGitCommitTreeCandidate({
      commonDirectory,
      revision,
    });
    if (mutation === "index-checksum" || mutation === "pack-checksum") {
      assert.equal(inspection, null);
    } else {
      assert.equal(inspection?.status, "candidate");
      assert.equal(inspection?.tree, fixture.tree);
    }
    assert.equal(readGitCommitFileCandidate(request), null);
    const workspace = path.join(fixture.root, "workspace");
    fs.mkdirSync(workspace);
    assert.equal(
      materializeGitCommitTreeCandidate({
        commonDirectory,
        revision,
        workspace,
        readPaths: [fixture.selected.name],
      }),
      null,
    );
    assert.deepEqual(fs.readdirSync(workspace), []);
  });
}

test("Repository-owned Git readerは外部Git CLIなしでCommitとTreeを照合する", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
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
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
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
