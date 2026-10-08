/**
 * Repository内の試験領域を生成・清掃する。
 *
 * @packageDocumentation
 * @responsibility 所有ProcessとGit Pack試験のNamespaceを固定し、自己生成Directoryの境界を検査する。
 * @trace ERB-IT-002
 * @trace RFD-IT-012
 * @level IT
 * @scope Process／Git Fixtureの試験領域
 * @boundary 試験Fixture→Repository内Filesystem。由来不明の領域や本番成果物は清掃しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type RepositoryTestNamespace = "docker-owned-process" | "git-packed-object";

function assertPlainDirectory(target: string) {
  const metadata = fs.lstatSync(target);
  assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink());
  assert.equal(
    fs.realpathSync.native(target).toLowerCase(),
    target.toLowerCase(),
  );
}

export function createRepositoryTestTemporaryDirectory(
  repositoryRoot: string,
  namespace: RepositoryTestNamespace,
  prefix: string,
) {
  const normalizedRepositoryRoot = path.resolve(repositoryRoot);
  const crddRoot = path.join(normalizedRepositoryRoot, ".crdd");
  const testsRoot = path.join(crddRoot, "tests");
  const namespaceRoot = path.join(testsRoot, namespace);
  let testsRootCreated = false;
  let namespaceRootCreated = false;

  assertPlainDirectory(normalizedRepositoryRoot);
  assertPlainDirectory(crddRoot);
  try {
    if (!fs.existsSync(testsRoot)) {
      fs.mkdirSync(testsRoot, { recursive: false });
      testsRootCreated = true;
    }
    assertPlainDirectory(testsRoot);
    if (!fs.existsSync(namespaceRoot)) {
      fs.mkdirSync(namespaceRoot, { recursive: false });
      namespaceRootCreated = true;
    }
    assertPlainDirectory(namespaceRoot);
    const directory = fs.mkdtempSync(path.join(namespaceRoot, prefix));
    return Object.freeze({
      directory,
      releaseNamespace() {
        assert.equal(fs.existsSync(directory), false);
        if (namespaceRootCreated) {
          fs.rmdirSync(namespaceRoot);
          assert.equal(fs.existsSync(namespaceRoot), false);
        }
        if (testsRootCreated) {
          fs.rmdirSync(testsRoot);
          assert.equal(fs.existsSync(testsRoot), false);
        }
      },
    });
  } catch (error) {
    if (namespaceRootCreated && fs.existsSync(namespaceRoot)) {
      fs.rmdirSync(namespaceRoot);
    }
    if (testsRootCreated && fs.existsSync(testsRoot)) {
      fs.rmdirSync(testsRoot);
    }
    throw error;
  }
}
