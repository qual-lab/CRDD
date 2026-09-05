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
} from "../../src/security/execution-environment.ts";
import { bindRuntimeOwnedRepositoryOperation } from "../../src/security/repository-operation-runtime.ts";
import {
  captureRuntimeOwnedCandidateRevision,
  describeRepositoryWorkspaceRuntimeContract,
  materializeRuntimeOwnedRepositoryWorkspace,
  persistRuntimeOwnedCandidateRevision,
  verifyRuntimeOwnedCandidateRevision,
} from "../../src/security/repository-workspace-runtime.ts";

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
  const rootIdentity = fs.lstatSync(root, { bigint: true });
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
  t.after(() => {
    const currentIdentity = fs.lstatSync(root, { bigint: true });
    assert.equal(currentIdentity.isDirectory(), true);
    assert.equal(currentIdentity.isSymbolicLink(), false);
    assert.equal(currentIdentity.dev, rootIdentity.dev);
    assert.equal(currentIdentity.ino, rootIdentity.ino);
    assert.equal(currentIdentity.birthtimeNs, rootIdentity.birthtimeNs);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return Object.freeze({ root, commonDirectory, commitId });
}

function snapshotRepositoryFiles(root: string) {
  return fs
    .readdirSync(root, { recursive: true, encoding: "utf8" })
    .sort()
    .filter((relativePath) =>
      fs.lstatSync(path.join(root, relativePath)).isFile(),
    )
    .map((relativePath) => ({
      relativePath,
      sha256: createHash("sha256")
        .update(fs.readFileSync(path.join(root, relativePath)))
        .digest("hex"),
    }));
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

// Only inventory observations inside this owned workspace are virtualized.
// Real descriptors retain bounded ownership; bytes, size and identity agree.
function virtualInventory(
  t: TestContext,
  workspace: string,
  fileSizes: readonly number[],
) {
  const backingPath = path.join(workspace, "inventory-backing.bin");
  fs.writeFileSync(backingPath, "a");
  const originals = {
    readdir: fs.readdirSync,
    lstat: fs.lstatSync,
    open: fs.openSync,
    fstat: fs.fstatSync,
    read: fs.readSync,
    close: fs.closeSync,
  };
  const dirent = originals
    .readdir(workspace, { withFileTypes: true })
    .find((entry) => entry.name === "inventory-backing.bin");
  assert.ok(dirent);
  const metadata = originals.lstat(backingPath, { bigint: true });
  const virtualFiles = new Map(
    fileSizes.map((byteLength, index) => [
      path.join(workspace, `file-${index}.bin`),
      { byteLength, index },
    ]),
  );
  const descriptors = new Map<number, { byteLength: number; index: number }>();
  const openedIndices: number[] = [];
  let readByteCount = 0;
  const fileMetadata = (file: { byteLength: number; index: number }) =>
    Object.assign(Object.create(Object.getPrototypeOf(metadata)), metadata, {
      size: BigInt(file.byteLength),
      ino: metadata.ino + BigInt(file.index + 1),
    });
  t.mock.method(fs, "readdirSync", ((target, options) => {
    if (target === workspace) {
      assert.deepEqual(options, { withFileTypes: true });
      return fileSizes.map((_byteLength, index) =>
        Object.assign(Object.create(Object.getPrototypeOf(dirent)), dirent, {
          name: `file-${index}.bin`,
        }),
      );
    }
    return Reflect.apply(originals.readdir, fs, [target, options]);
  }) as typeof fs.readdirSync);
  t.mock.method(fs, "lstatSync", ((target, options) => {
    const file =
      typeof target === "string" ? virtualFiles.get(target) : undefined;
    return file ? fileMetadata(file) : originals.lstat(target, options);
  }) as typeof fs.lstatSync);
  t.mock.method(fs, "openSync", ((target, flags, mode) => {
    const file =
      typeof target === "string" ? virtualFiles.get(target) : undefined;
    if (!file) return originals.open(target, flags, mode);
    assert.equal(flags, "r");
    const descriptor = originals.open(backingPath, flags, mode);
    descriptors.set(descriptor, file);
    openedIndices.push(file.index);
    return descriptor;
  }) as typeof fs.openSync);
  t.mock.method(fs, "fstatSync", ((descriptor, options) => {
    const file = descriptors.get(descriptor);
    return file ? fileMetadata(file) : originals.fstat(descriptor, options);
  }) as typeof fs.fstatSync);
  t.mock.method(fs, "readSync", ((
    descriptor,
    buffer,
    offset,
    length,
    position,
  ) => {
    const file = descriptors.get(descriptor);
    if (!file)
      return originals.read(descriptor, buffer, offset, length, position);
    assert.equal(typeof position, "number");
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(typeof offset, "number");
    assert.equal(typeof length, "number");
    const count = Math.min(length, file.byteLength - Number(position));
    buffer.fill(0x61, offset, offset + count);
    readByteCount += count;
    return count;
  }) as typeof fs.readSync);
  t.mock.method(fs, "closeSync", (descriptor: number) => {
    descriptors.delete(descriptor);
    originals.close(descriptor);
  });
  return {
    openedIndices,
    descriptors,
    readByteCount: () => readByteCount,
  };
}

test("変更path上限1000件を受理し1001件は候補を発行しない", (t) => {
  const source = repository(t);
  const beforeFiles = snapshotRepositoryFiles(source.root);
  const runtime = operation(t, source.root);
  const materialized = materializeRuntimeOwnedRepositoryWorkspace(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(materialized?.status, "materialized");
  for (let index = 0; index < 1000; index += 1) {
    fs.writeFileSync(
      path.join(runtime.workspace, "src", `added-${index}.txt`),
      "a",
    );
  }
  const capture = () =>
    captureRuntimeOwnedCandidateRevision(
      materialized?.workspaceCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      ["src/"],
    );
  const boundary = capture();
  assert.equal(boundary?.status, "candidate");
  assert.equal(
    boundary?.status === "candidate" ? boundary.changedPaths.length : null,
    1000,
  );
  fs.writeFileSync(path.join(runtime.workspace, "src", "overflow.txt"), "a");
  assert.equal(capture(), null);
  assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
});

for (const scenario of ["file_count", "total_bytes"] as const) {
  test(`workspace ${scenario}の境界到達と超過停止を後段guardから区別する`, (t) => {
    const source = repository(t);
    const beforeFiles = snapshotRepositoryFiles(source.root);
    const runtime = operation(t, source.root);
    const materialized = materializeRuntimeOwnedRepositoryWorkspace(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(materialized?.status, "materialized");
    for (const isOverflow of [false, true]) {
      const fileSizes =
        scenario === "file_count"
          ? Array.from({ length: isOverflow ? 20_002 : 20_000 }, () => 1)
          : [
              64 * 1024 * 1024,
              64 * 1024 * 1024,
              64 * 1024 * 1024,
              64 * 1024 * 1024,
              isOverflow ? 1 : 0,
              0,
            ];
      const observed = virtualInventory(t, runtime.workspace, fileSizes);
      try {
        const candidate = captureRuntimeOwnedCandidateRevision(
          materialized?.workspaceCapability,
          runtime.bound.repositoryBindingCapability,
          runtime.managementCapability,
          runtime.mountCapability,
          ["src/"],
        );
        // Boundary control completes inventory, then fails changed-path count
        // or allowed-path scope. Overflow must stop before its final sentinel.
        assert.equal(candidate, null);
        const expectedCount =
          scenario === "file_count"
            ? isOverflow
              ? 20_001
              : 20_000
            : isOverflow
              ? 5
              : 6;
        assert.deepEqual(
          observed.openedIndices,
          Array.from({ length: expectedCount }, (_value, index) => index),
        );
        assert.equal(observed.descriptors.size, 0);
        assert.equal(
          observed.readByteCount(),
          scenario === "file_count"
            ? expectedCount
            : 256 * 1024 * 1024 + (isOverflow ? 1 : 0),
        );
      } finally {
        t.mock.restoreAll();
      }
    }
    assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
  });
}

test("候補内容16MiBだけがStore方針検証へ到達し1byte超過は保存前に拒否する", (t) => {
  const source = repository(t);
  const beforeFiles = snapshotRepositoryFiles(source.root);
  const runtime = operation(t, source.root);
  const materialized = materializeRuntimeOwnedRepositoryWorkspace(
    runtime.bound.repositoryBindingCapability,
    runtime.managementCapability,
    runtime.mountCapability,
  );
  assert.equal(materialized?.status, "materialized");
  const content = Buffer.alloc(8 * 1024 * 1024, 0x61);
  const firstPath = path.join(runtime.workspace, "src", "first.txt");
  const secondPath = path.join(runtime.workspace, "src", "second.txt");
  fs.writeFileSync(firstPath, content);
  fs.writeFileSync(secondPath, content);
  let policyReadCount = 0;
  const persistencePolicy = {
    get candidatePersistenceAllowed() {
      policyReadCount += 1;
      // Store normalizes the complete bundle and checks recognized secrets
      // before this read. Stop before native Store-root or filesystem access.
      throw new Error("test_store_handoff_observed");
    },
    candidateRetentionHours: 1,
    informationClassification: "public",
  };
  for (const isOverflow of [false, true]) {
    if (isOverflow) fs.appendFileSync(secondPath, "a");
    policyReadCount = 0;
    const candidate = captureRuntimeOwnedCandidateRevision(
      materialized?.workspaceCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      ["src/"],
    );
    assert.equal(candidate?.status, "candidate");
    assert.ok(candidate?.status === "candidate");
    assert.deepEqual(candidate.changedPaths, [
      "src/first.txt",
      "src/second.txt",
    ]);
    assert.equal(
      persistRuntimeOwnedCandidateRevision(
        candidate.candidateCapability,
        runtime.bound.repositoryBindingCapability,
        runtime.managementCapability,
        runtime.mountCapability,
        persistencePolicy,
      ),
      null,
    );
    assert.equal(policyReadCount, isOverflow ? 0 : 1);
  }
  assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
});

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
  if (firstWorkspace?.status !== "materialized") {
    assert.fail("first workspace must materialize");
  }
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
  if (secondWorkspace?.status !== "materialized") {
    assert.fail("second workspace must materialize");
  }
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
  if (thirdWorkspace?.status !== "materialized") {
    assert.fail("third workspace must materialize");
  }
  fs.writeFileSync(path.join(third.workspace, "README.md"), "changed\n");
  const candidate = captureRuntimeOwnedCandidateRevision(
    thirdWorkspace.workspaceCapability,
    third.bound.repositoryBindingCapability,
    third.managementCapability,
    third.mountCapability,
    ["README.md"],
  );
  if (candidate?.status !== "candidate") {
    assert.fail("candidate must be captured");
  }
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

for (const [scenario, label] of [
  ["depth", "深さ上限超過"],
  ["file_size", "単一file容量超過"],
  ["junction", "junction entry"],
] as const) {
  test(`実行後workspaceの${label}をCandidateへ昇格せず元Repositoryを保持する`, (t) => {
    if (scenario === "junction" && process.platform !== "win32") {
      t.skip("Windows junction boundary only");
      return;
    }
    const source = repository(t);
    const beforeFiles = snapshotRepositoryFiles(source.root);
    const runtime = operation(t, source.root);
    const materialized = materializeRuntimeOwnedRepositoryWorkspace(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(materialized?.status, "materialized");
    const workspaceIdentity = fs.lstatSync(runtime.workspace, { bigint: true });
    const linkPath = path.join(runtime.workspace, "src", "linked");
    let linkCreated = false;
    try {
      if (scenario === "depth") {
        let directory = runtime.workspace;
        for (let depth = 0; depth < 65; depth += 1) {
          directory = path.join(directory, "d");
          fs.mkdirSync(directory);
        }
      } else if (scenario === "file_size") {
        const oversizedFile = path.join(runtime.workspace, "src", "large.bin");
        const descriptor = fs.openSync(oversizedFile, "wx");
        try {
          fs.ftruncateSync(descriptor, 64 * 1024 * 1024 + 1);
        } finally {
          fs.closeSync(descriptor);
        }
        assert.equal(fs.statSync(oversizedFile).size, 64 * 1024 * 1024 + 1);
      } else {
        const target = path.join(runtime.workspace, "src");
        fs.symlinkSync(target, linkPath, "junction");
        linkCreated = true;
        assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
      }
      assert.equal(
        captureRuntimeOwnedCandidateRevision(
          materialized?.workspaceCapability,
          runtime.bound.repositoryBindingCapability,
          runtime.managementCapability,
          runtime.mountCapability,
          ["src/", "d/"],
        ),
        null,
      );
      assert.deepEqual(snapshotRepositoryFiles(source.root), beforeFiles);
      const currentIdentity = fs.lstatSync(runtime.workspace, { bigint: true });
      assert.equal(currentIdentity.dev, workspaceIdentity.dev);
      assert.equal(currentIdentity.ino, workspaceIdentity.ino);
      assert.equal(currentIdentity.birthtimeNs, workspaceIdentity.birthtimeNs);
    } finally {
      if (linkCreated) {
        assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
        fs.unlinkSync(linkPath);
      }
    }
  });
}

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
  if (materialized?.status !== "materialized") {
    assert.fail("workspace must materialize");
  }
  const dynamicAllowedPaths = new Proxy([], {
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
      dynamicAllowedPaths,
    ),
    null,
  );
});

test("Executorが生成した認識済みSecretをCandidate Capabilityへ昇格しない", (t) => {
  for (const scenario of ["path", "nested-path", "content"] as const) {
    const source = repository(t);
    const runtime = operation(t, source.root);
    const materialized = materializeRuntimeOwnedRepositoryWorkspace(
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
    );
    assert.equal(materialized?.status, "materialized");
    if (scenario === "path") {
      fs.writeFileSync(path.join(runtime.workspace, ".env"), "ordinary\n");
    } else if (scenario === "nested-path") {
      fs.writeFileSync(
        path.join(
          runtime.workspace,
          "src",
          "session_token=abcdefghijklmnopqrstuvwx",
        ),
        "ordinary\n",
      );
    } else {
      fs.writeFileSync(
        path.join(runtime.workspace, "src", "index.ts"),
        `const token = "sk-${"A".repeat(24)}";\n`,
      );
    }
    const captured = captureRuntimeOwnedCandidateRevision(
      materialized?.workspaceCapability,
      runtime.bound.repositoryBindingCapability,
      runtime.managementCapability,
      runtime.mountCapability,
      [
        scenario === "path"
          ? ".env"
          : scenario === "nested-path"
            ? "src/session_token=abcdefghijklmnopqrstuvwx"
            : "src/index.ts",
      ],
    );
    assert.equal(captured?.status, "blocked");
    assert.equal(
      captured?.status === "blocked" ? captured.reason : null,
      "candidate_recognized_secret_rejected",
    );
    assert.equal(Reflect.has(captured ?? {}, "candidateCapability"), false);
  }
});

test("公開契約は隔離workspaceと5要素Candidate Revisionを固定する", () => {
  const contract = describeRepositoryWorkspaceRuntimeContract();
  assert.equal(contract.contractRevision, 5);
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
  assert.match(contract.recognizedSecretMaterial, /rejected/u);
  assert.equal(contract.completeSecretAbsenceVerified, false);
});
