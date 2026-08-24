import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";

import {
  describeGitObjectReaderContract,
  materializeGitCommitTreeCandidate,
  readGitCommitFileCandidate,
} from "../src/security/git-object-reader.ts";

function temporaryFixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-git-reader-"));
  const commonDirectory = path.join(root, ".git");
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(path.join(commonDirectory, "objects", "pack"), {
    recursive: true,
  });
  fs.mkdirSync(workspace);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return Object.freeze({ commonDirectory, workspace });
}

function writeObject(commonDirectory: string, type: string, bytes: Buffer) {
  const framed = Buffer.concat([
    Buffer.from(`${type} ${bytes.byteLength}\0`),
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

test("loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成する", (t) => {
  const fixture = temporaryFixture(t);
  const readmeId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("hello\n"),
  );
  const sourceId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("export const value = 1;\n"),
  );
  const sourceTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("100644", "index.ts", sourceId),
  );
  const rootTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "README.md", readmeId),
      treeEntry("40000", "src", sourceTreeId),
    ]),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(
      `tree ${rootTreeId}\nauthor A <a@example.test> 0 +0000\ncommitter A <a@example.test> 0 +0000\n\nfixture\n`,
    ),
  );

  const result = materializeGitCommitTreeCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
  });
  assert.equal(result?.status, "materialized");
  assert.equal(result?.baseCommit, commitId);
  assert.equal(result?.baseTree, rootTreeId);
  assert.equal(result?.fileCount, 2);
  assert.equal(result?.byteLength, 30);
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "README.md"), "utf8"),
    "hello\n",
  );
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "src", "index.ts"), "utf8"),
    "export const value = 1;\n",
  );
  assert.equal(result?.repositoryPathReported, false);
  assert.equal(result?.workspacePathReported, false);
  const fixedFile = readGitCommitFileCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    relativePath: "README.md",
  });
  assert.equal(fixedFile?.status, "read");
  assert.equal(fixedFile?.bytes.toString("utf8"), "hello\n");
  assert.equal(
    readGitCommitFileCandidate({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      relativePath: "missing.md",
    }),
    null,
  );
});

test("明示Read Projectionだけを隔離workspaceへ再構成する", (t) => {
  const fixture = temporaryFixture(t);
  const visibleId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("visible\n"),
  );
  const hiddenId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("hidden\n"),
  );
  const sourceTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "visible.ts", visibleId),
      treeEntry("100644", "hidden.ts", hiddenId),
    ]),
  );
  const rootTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("40000", "src", sourceTreeId),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(`tree ${rootTreeId}\n\nfixture\n`),
  );

  const result = materializeGitCommitTreeCandidate({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
    readPaths: ["src/visible.ts"],
  });
  assert.equal(result?.status, "materialized");
  assert.equal(result?.fileCount, 1);
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "src", "visible.ts"), "utf8"),
    "visible\n",
  );
  assert.equal(
    fs.existsSync(path.join(fixture.workspace, "src", "hidden.ts")),
    false,
  );
});

test("symlink、submodule、Windows case衝突と非empty workspaceを拒否する", (t) => {
  for (const scenario of [
    "symlink",
    "submodule",
    "case",
    "nonempty",
  ] as const) {
    const fixture = temporaryFixture(t);
    const blobId = writeObject(
      fixture.commonDirectory,
      "blob",
      Buffer.from("value"),
    );
    const treeBytes =
      scenario === "case"
        ? Buffer.concat([
            treeEntry("100644", "File.txt", blobId),
            treeEntry("100644", "file.txt", blobId),
          ])
        : treeEntry(
            scenario === "symlink"
              ? "120000"
              : scenario === "submodule"
                ? "160000"
                : "100644",
            "file.txt",
            blobId,
          );
    const treeId = writeObject(fixture.commonDirectory, "tree", treeBytes);
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${treeId}\n\nfixture\n`),
    );
    if (scenario === "nonempty") {
      fs.writeFileSync(path.join(fixture.workspace, "existing.txt"), "keep");
    }
    assert.equal(
      materializeGitCommitTreeCandidate({
        commonDirectory: fixture.commonDirectory,
        revision: commitId,
        workspace: fixture.workspace,
      }),
      null,
    );
  }
});

test("object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにする", (t) => {
  const fixture = temporaryFixture(t);
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("value"),
  );
  const blobPath = path.join(
    fixture.commonDirectory,
    "objects",
    blobId.slice(0, 2),
    blobId.slice(2),
  );
  fs.appendFileSync(blobPath, "x");
  for (const candidate of [
    {
      commonDirectory: fixture.commonDirectory,
      revision: "a".repeat(64),
      workspace: fixture.workspace,
    },
    {
      commonDirectory: fixture.commonDirectory,
      revision: "a".repeat(40),
      workspace: fixture.workspace,
      extra: true,
    },
    new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("must not execute");
        },
      },
    ),
  ]) {
    assert.equal(materializeGitCommitTreeCandidate(candidate), null);
  }
});

test("公開契約は限定Git object readerと非Authority境界を固定する", () => {
  const contract = describeGitObjectReaderContract();
  assert.equal(contract.contractRevision, 2);
  assert.equal(contract.objectFormat, "sha1_only");
  assert.equal(contract.externalGitCliUsed, false);
  assert.deepEqual(contract.rejectedTreeModes, ["120000", "160000", "unknown"]);
  assert.equal(contract.windowsNameCollision, "fail_closed");
  assert.equal(contract.authorityEstablished, false);
});
