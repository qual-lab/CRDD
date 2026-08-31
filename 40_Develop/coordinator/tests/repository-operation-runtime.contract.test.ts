import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import test from "node:test";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
} from "../src/security/execution-environment.ts";
import {
  bindRuntimeOwnedRepositoryOperation,
  describeRepositoryOperationRuntimeContract,
  inspectRepositoryObjectFormatCandidate,
  verifyRuntimeOwnedRepositoryBindingCapability,
  verifyRuntimeOwnedRepositoryOperation,
} from "../src/security/repository-operation-runtime.ts";

const firstRevision = "1".repeat(40);
const secondRevision = "2".repeat(40);

function temporaryRepository(t: TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-operation-repository-"),
  );
  const git = path.join(root, ".git");
  fs.mkdirSync(path.join(git, "info"), { recursive: true });
  fs.mkdirSync(path.join(git, "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(git, "refs", "heads", "main"),
    `${firstRevision}\n`,
    "utf8",
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function linkedRepository(t: TestContext) {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-operation-linked-repository-"),
  );
  const root = path.join(parent, "linked");
  const commonGitDirectory = path.join(parent, "main.git");
  const git = path.join(commonGitDirectory, "worktrees", "linked");
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(commonGitDirectory, "refs", "heads"), {
    recursive: true,
  });
  fs.mkdirSync(git, { recursive: true });
  fs.writeFileSync(path.join(root, ".git"), `gitdir: ${git}\n`, "utf8");
  fs.writeFileSync(path.join(git, "commondir"), "../..\n", "utf8");
  fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(
    path.join(commonGitDirectory, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(commonGitDirectory, "refs", "heads", "main"),
    `${firstRevision}\n`,
    "utf8",
  );
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  return { root, commonGitDirectory };
}

function operation(t: TestContext) {
  const owned = createOwnedOperationDirectories();
  t.after(() => cleanupOwnedOperationDirectories(owned));
  const context = createOwnedOperationContextCapability(owned);
  const mount = createOwnedMountCapability(owned);
  return createOwnedOperationManagementCapability(context, mount);
}

test("Repository実体と開始Revisionをopaque capabilityへ固定して再照合する", (t) => {
  const repository = temporaryRepository(t);
  const management = operation(t);
  const bound = bindRuntimeOwnedRepositoryOperation(management, repository);
  assert.ok(bound);
  assert.equal(bound.revision, firstRevision);
  assert.equal(bound.repositoryBound, true);
  assert.equal(bound.pathReported, false);
  assert.deepEqual(verifyRuntimeOwnedRepositoryOperation(management), {
    operationId: bound.operationId,
    revision: firstRevision,
    repositoryBound: true,
    revisionCurrent: true,
  });
  assert.deepEqual(
    verifyRuntimeOwnedRepositoryBindingCapability(
      bound.repositoryBindingCapability,
      management,
    ),
    {
      operationId: bound.operationId,
      revision: firstRevision,
      repositoryBound: true,
      revisionCurrent: true,
    },
  );
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(management, repository),
    null,
  );
  assert.equal(
    verifyRuntimeOwnedRepositoryBindingCapability(
      Object.freeze({}),
      management,
    ),
    null,
  );
});

test("開始後にHEAD参照先が変わればEffectと結果公開の双方で失効する", (t) => {
  const repository = temporaryRepository(t);
  const management = operation(t);
  const bound = bindRuntimeOwnedRepositoryOperation(management, repository);
  assert.ok(bound);
  fs.writeFileSync(
    path.join(repository, ".git", "refs", "heads", "main"),
    `${secondRevision}\n`,
    "utf8",
  );
  assert.equal(verifyRuntimeOwnedRepositoryOperation(management), null);
  assert.equal(
    verifyRuntimeOwnedRepositoryBindingCapability(
      bound.repositoryBindingCapability,
      management,
    ),
    null,
  );
});

test("detached HEADとpacked refを限定形式で解決し不正入力を拒否する", (t) => {
  const detached = temporaryRepository(t);
  fs.writeFileSync(
    path.join(detached, ".git", "HEAD"),
    `${firstRevision}\n`,
    "utf8",
  );
  const detachedManagement = operation(t);
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(detachedManagement, detached)?.revision,
    firstRevision,
  );

  const packed = temporaryRepository(t);
  fs.rmSync(path.join(packed, ".git", "refs", "heads", "main"));
  fs.writeFileSync(
    path.join(packed, ".git", "packed-refs"),
    `# pack-refs with: peeled fully-peeled sorted\n${secondRevision} refs/heads/main\n`,
    "utf8",
  );
  const packedManagement = operation(t);
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(packedManagement, packed)?.revision,
    secondRevision,
  );

  assert.equal(
    bindRuntimeOwnedRepositoryOperation(Object.freeze({}), packed),
    null,
  );
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(packedManagement, "relative"),
    null,
  );
});

test("SHA-256 RepositoryはOperation capability発行前の専用preflightで拒否する", (t) => {
  const repository = temporaryRepository(t);
  const revision = "a".repeat(64);
  fs.writeFileSync(
    path.join(repository, ".git", "refs", "heads", "main"),
    `${revision}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(repository, ".git", "config"),
    "[core]\n\trepositoryformatversion = 1\n\tbare = false\n[extensions]\n\tobjectformat = sha256\n",
    "utf8",
  );
  assert.deepEqual(inspectRepositoryObjectFormatCandidate(repository), {
    status: "candidate",
    objectFormat: "sha256",
    runtimeSupported: false,
    revisionReported: false,
    repositoryPathReported: false,
  });
  assert.equal(
    bindRuntimeOwnedRepositoryOperation(operation(t), repository),
    null,
  );
});

test("宣言Object Formatとdetached／loose／packed Revision幅の不一致をpreflightで拒否する", (t) => {
  const detached = temporaryRepository(t);
  fs.writeFileSync(
    path.join(detached, ".git", "HEAD"),
    `${"a".repeat(64)}\n`,
    "utf8",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(detached), null);

  const loose = temporaryRepository(t);
  fs.writeFileSync(
    path.join(loose, ".git", "refs", "heads", "main"),
    `${"b".repeat(64)}\n`,
    "utf8",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(loose), null);

  const packed = temporaryRepository(t);
  fs.rmSync(path.join(packed, ".git", "refs", "heads", "main"));
  fs.writeFileSync(
    path.join(packed, ".git", "packed-refs"),
    `${"c".repeat(64)} refs/heads/main\n`,
    "utf8",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(packed), null);

  const sha256WithSha1Revision = temporaryRepository(t);
  fs.writeFileSync(
    path.join(sha256WithSha1Revision, ".git", "HEAD"),
    `${firstRevision}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(sha256WithSha1Revision, ".git", "config"),
    "[core]\n\trepositoryformatversion = 1\n\tbare = false\n[extensions]\n\tobjectformat = sha256\n",
    "utf8",
  );
  assert.equal(
    inspectRepositoryObjectFormatCandidate(sha256WithSha1Revision),
    null,
  );
});

test("loose refの中間junctionと最終symlinkをRepository境界外としてpreflightで拒否する", (t) => {
  for (const linkedSegment of ["refs", "refs/heads"] as const) {
    const repository = temporaryRepository(t);
    const external = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-operation-external-ref-"),
    );
    t.after(() => fs.rmSync(external, { recursive: true, force: true }));
    const link = path.join(repository, ".git", ...linkedSegment.split("/"));
    fs.rmSync(link, { recursive: true, force: true });
    const destination =
      linkedSegment === "refs"
        ? path.join(external, "refs")
        : path.join(external, "heads");
    fs.mkdirSync(
      linkedSegment === "refs" ? path.join(destination, "heads") : destination,
      { recursive: true },
    );
    fs.writeFileSync(
      linkedSegment === "refs"
        ? path.join(destination, "heads", "main")
        : path.join(destination, "main"),
      `${firstRevision}\n`,
      "utf8",
    );
    fs.symlinkSync(
      destination,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(inspectRepositoryObjectFormatCandidate(repository), null);
  }

  const repository = temporaryRepository(t);
  const externalFile = path.join(repository, "external-main");
  fs.writeFileSync(externalFile, `${firstRevision}\n`, "utf8");
  const ref = path.join(repository, ".git", "refs", "heads", "main");
  fs.rmSync(ref);
  fs.symlinkSync(externalFile, ref, "file");
  assert.equal(inspectRepositoryObjectFormatCandidate(repository), null);
});

test("linked worktreeのCommon Git Directoryでもloose ref junctionをpreflightで拒否する", (t) => {
  const repository = linkedRepository(t);
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-operation-linked-external-ref-"),
  );
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, "main"), `${firstRevision}\n`, "utf8");
  const heads = path.join(repository.commonGitDirectory, "refs", "heads");
  fs.rmSync(heads, { recursive: true, force: true });
  fs.symlinkSync(
    external,
    heads,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(inspectRepositoryObjectFormatCandidate(repository.root), null);
});

test("公開契約はcaller supplied identityを採用せずPathを返さない", () => {
  const contract = describeRepositoryOperationRuntimeContract();
  assert.equal(contract.contractRevision, 2);
  assert.equal(contract.callerRevisionAccepted, false);
  assert.equal(contract.pathReported, false);
  assert.equal(contract.providerEffectAllowed, false);
  assert.deepEqual(contract.runtimeSupportedObjectFormats, ["sha1"]);
  assert.match(contract.revision, /reobserved_before_effect_and_result/u);
});
