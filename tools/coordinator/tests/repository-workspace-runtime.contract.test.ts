import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { deflateSync } from "node:zlib";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  verifyOwnedOperationManagementMountBinding,
} from "../src/security/execution-environment.ts";
import { bindRuntimeOwnedRepositoryOperation } from "../src/security/repository-operation-runtime.ts";
import {
  captureRuntimeOwnedCandidateRevision,
  describeRepositoryWorkspaceRuntimeContract,
  materializeRuntimeOwnedRepositoryWorkspace,
  verifyRuntimeOwnedCandidateRevision,
} from "../src/security/repository-workspace-runtime.ts";

function writeObject(
  commonDirectory: string,
  objectType: string,
  bytes: Buffer,
) {
  const framed = Buffer.concat([
    Buffer.from(`${objectType} ${bytes.byteLength}\0`),
    bytes,
  ]);
  const objectId = createHash("sha1").update(framed).digest("hex");
  const target = path.join(
    commonDirectory,
    "objects",
    objectId.slice(0, 2),
    objectId.slice(2),
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, deflateSync(framed));
  return objectId;
}

function treeEntry(mode: string, name: string, objectId: string) {
  return Buffer.concat([
    Buffer.from(`${mode} ${name}\0`),
    Buffer.from(objectId, "hex"),
  ]);
}

function repository(t: TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-workspace-repository-"),
  );
  const commonDirectory = path.join(root, ".git");
  fs.mkdirSync(path.join(commonDirectory, "info"), { recursive: true });
  fs.mkdirSync(path.join(commonDirectory, "refs", "heads"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(commonDirectory, "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(commonDirectory, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const readmeId = writeObject(commonDirectory, "blob", Buffer.from("base\n"));
  const sourceId = writeObject(
    commonDirectory,
    "blob",
    Buffer.from("export const value = 1;\n"),
  );
  const sourceTreeId = writeObject(
    commonDirectory,
    "tree",
    treeEntry("100644", "index.ts", sourceId),
  );
  const rootTreeId = writeObject(
    commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "README.md", readmeId),
      treeEntry("40000", "src", sourceTreeId),
    ]),
  );
  const commitId = writeObject(
    commonDirectory,
    "commit",
    Buffer.from(`tree ${rootTreeId}\n\nfixture\n`),
  );
  fs.writeFileSync(
    path.join(commonDirectory, "refs", "heads", "main"),
    `${commitId}\n`,
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return Object.freeze({ root, commonDirectory, commitId });
}

function operation(t: TestContext, repositoryRoot: string) {
  const owned = createOwnedOperationDirectories();
  t.after(() => cleanupOwnedOperationDirectories(owned));
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  const bound = bindRuntimeOwnedRepositoryOperation(
    managementCapability,
    repositoryRoot,
  );
  assert.ok(bound);
  return Object.freeze({
    owned,
    mountCapability,
    managementCapability,
    bound,
    workspace: verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    ).mounts.workspace,
  });
}

test("HEAD Treeから隔離workspaceを作り許可pathだけをCandidate Revisionへ固定する", (t) => {
  const source = repository(t);
  const runtime = operation(t, source.root);
  const materialized = materializeRuntimeOwnedRepositoryWorkspace(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(materialized?.status, "materialized");
  assert.equal(materialized?.baseCommit, source.commitId);
  assert.equal(materialized?.fileCount, 2);
  assert.equal(fs.existsSync(path.join(runtime.workspace, ".git")), false);

  fs.writeFileSync(
    path.join(runtime.workspace, "src", "index.ts"),
    "export const value = 2;\n",
  );
  const candidate = captureRuntimeOwnedCandidateRevision(
    materialized?.workspaceCapability,
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
    ["src/"],
  );
  assert.equal(candidate?.status, "candidate");
  assert.deepEqual(candidate?.changedPaths, ["src/index.ts"]);
  assert.equal(candidate?.baseCommit, source.commitId);
  assert.equal(candidate?.canonicalRepositoryChanged, false);
  assert.equal(fs.existsSync(path.join(source.root, "src", "index.ts")), false);
  const verified = verifyRuntimeOwnedCandidateRevision(
    candidate?.candidateCapability,
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(verified?.status, "verified");
  assert.equal(verified?.patchHash, candidate?.patchHash);
});

test("許可外変更、重複allowed path、Revision変化とCandidate後差替えを拒否する", (t) => {
  const source = repository(t);
  const first = operation(t, source.root);
  const firstWorkspace = materializeRuntimeOwnedRepositoryWorkspace(
    first.bound.repositoryBindingCapability,
    first.managementCapability,
    first.mountCapability,
  );
  assert.ok(firstWorkspace);
  fs.writeFileSync(path.join(first.workspace, "README.md"), "changed\n");
  assert.equal(
    captureRuntimeOwnedCandidateRevision(
      firstWorkspace.workspaceCapability,
      first.bound.repositoryBindingCapability,
      first.managementCapability,
      first.mountCapability,
      ["src/"],
    ),
    null,
  );
  assert.equal(
    captureRuntimeOwnedCandidateRevision(
      firstWorkspace.workspaceCapability,
      first.bound.repositoryBindingCapability,
      first.managementCapability,
      first.mountCapability,
      ["README.md", "README.md"],
    ),
    null,
  );

  const secondSource = repository(t);
  const second = operation(t, secondSource.root);
  const secondWorkspace = materializeRuntimeOwnedRepositoryWorkspace(
    second.bound.repositoryBindingCapability,
    second.managementCapability,
    second.mountCapability,
  );
  assert.ok(secondWorkspace);
  fs.writeFileSync(path.join(second.workspace, "README.md"), "changed\n");
  fs.writeFileSync(
    path.join(secondSource.commonDirectory, "refs", "heads", "main"),
    `${"f".repeat(40)}\n`,
  );
  assert.equal(
    captureRuntimeOwnedCandidateRevision(
      secondWorkspace.workspaceCapability,
      second.bound.repositoryBindingCapability,
      second.managementCapability,
      second.mountCapability,
      ["README.md"],
    ),
    null,
  );

  const thirdSource = repository(t);
  const third = operation(t, thirdSource.root);
  const thirdWorkspace = materializeRuntimeOwnedRepositoryWorkspace(
    third.bound.repositoryBindingCapability,
    third.managementCapability,
    third.mountCapability,
  );
  assert.ok(thirdWorkspace);
  fs.writeFileSync(path.join(third.workspace, "README.md"), "changed\n");
  const candidate = captureRuntimeOwnedCandidateRevision(
    thirdWorkspace.workspaceCapability,
    third.bound.repositoryBindingCapability,
    third.managementCapability,
    third.mountCapability,
    ["README.md"],
  );
  assert.ok(candidate);
  fs.writeFileSync(path.join(third.workspace, "README.md"), "replaced\n");
  assert.equal(
    verifyRuntimeOwnedCandidateRevision(
      candidate.candidateCapability,
      third.bound.repositoryBindingCapability,
      third.managementCapability,
      third.mountCapability,
    ),
    null,
  );
});

test("偽Capabilityと動的allowed pathをFilesystem Effectへ昇格しない", (t) => {
  const source = repository(t);
  const runtime = operation(t, source.root);
  assert.equal(
    materializeRuntimeOwnedRepositoryWorkspace(
      {},
      runtime.managementCapability,
      runtime.mountCapability,
    ),
    null,
  );
  const materialized = materializeRuntimeOwnedRepositoryWorkspace(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.ok(materialized);
  const dynamic = new Proxy([], {
    getOwnPropertyDescriptor() {
      throw new Error("must not execute");
    },
  });
  assert.equal(
    captureRuntimeOwnedCandidateRevision(
      materialized.workspaceCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      dynamic,
    ),
    null,
  );
});

test("公開契約は隔離workspaceと5要素Candidate Revisionを固定する", () => {
  const contract = describeRepositoryWorkspaceRuntimeContract();
  assert.equal(contract.contractRevision, 3);
  assert.equal(contract.providerGitMetadataVisible, false);
  assert.equal(contract.workspaceWrite, "isolated_runtime_owned_only");
  assert.deepEqual(contract.candidateRevision, [
    "base_commit",
    "base_tree",
    "patch_hash",
    "content_manifest_hash",
    "allowed_paths_hash",
  ]);
  assert.equal(contract.canonicalRepositoryWriteAllowed, false);
});
