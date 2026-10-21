/**
 * 単一Native成果物のGit出所を実Repositoryで検証する。
 * @packageDocumentation
 * @responsibility 署名配布全体と独立したNative・Git・Rootの相関を確認する。
 * @trace AIT-IT-002
 * @level IT
 * @scope 単一Nativeの固定Blob、途中差とRoot境界。
 * @boundary AIT-IT-002=Related 2 Blocks: Git改訂／Native実体→出所観測。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { deflateSync } from "node:zlib";
import {
  gitFixedSnapshotAdapter,
  readFixedSnapshotFile,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH } from "../../../platform-access/src/index.ts";
import { inspectPlatformAccessNativeGitProvenanceCandidate } from "../../scripts/native-git-provenance.ts";

/**
 * 単一Nativeの未署名Git試験入力をRepository内へ作成する。
 * @responsibility Nativeと比較用文書のBlob・階層Tree・Commitと現在Checkoutを生成する。
 * @trace AIT-IT-002
 * @precondition tは現在Test、prefixは固定の空値または01_CRDDである。
 * @stimulus 非秘密の固定bytesとGit objectを自己生成領域へ保存する。
 * @observation Root、Native、HEADとmode変更用のfixture関数を返す。
 * @oracle 通常のVersion Control／Platform Access Readerから読める。
 * @cleanup 作成直後のafter hookがexact Rootを削除し不存在を確認する。
 * @boundary AIT-IT-002=Related 2 Blocks: Git Blob→Native同一性観測
 */
function createNativeProvenanceFixture(t: TestContext, prefix: "" | "01_CRDD") {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  const testsRoot = path.join(repository, ".crdd", "tests");
  assert.equal(verifyRepositoryRoot(repository).status, "completed");
  const createdParents: string[] = [];
  let ownedRoot: { path: string; identity: fs.BigIntStats } | null = null;
  t.after(() => {
    if (ownedRoot) {
      const current = fs.lstatSync(ownedRoot.path, { bigint: true });
      assert.equal(current.dev, ownedRoot.identity.dev);
      assert.equal(current.ino, ownedRoot.identity.ino);
      assert.equal(current.birthtimeNs, ownedRoot.identity.birthtimeNs);
      assert.equal(fs.realpathSync.native(ownedRoot.path), ownedRoot.path);
      fs.rmSync(ownedRoot.path, { recursive: true });
      assert.equal(fs.existsSync(ownedRoot.path), false);
    }
    for (const directory of createdParents.toReversed()) {
      assert.equal(fs.realpathSync.native(directory), directory);
      fs.rmdirSync(directory);
      assert.equal(fs.existsSync(directory), false);
    }
  });
  for (const directory of [
    repository,
    path.join(repository, ".crdd"),
    testsRoot,
  ]) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
      createdParents.push(directory);
    }
    assert.ok(fs.lstatSync(directory).isDirectory());
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  const root = fs.mkdtempSync(path.join(testsRoot, "native-provenance-"));
  ownedRoot = { path: root, identity: fs.lstatSync(root, { bigint: true }) };
  const distributionRoot = prefix === "" ? root : path.join(root, prefix);
  const nativePath = path.join(
    distributionRoot,
    ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  const bytes = Buffer.from("fixed-native-provenance-fixture\0", "utf8");
  const documentBytes = Buffer.from("committed documentation\n", "utf8");
  const documentPath = path.join(distributionRoot, "README.md");
  fs.mkdirSync(path.dirname(nativePath), { recursive: true });
  fs.writeFileSync(nativePath, bytes);
  fs.writeFileSync(documentPath, documentBytes);
  fs.mkdirSync(path.join(root, ".git", "objects"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(
    path.join(root, ".git", "HEAD"),
    "ref: refs/heads/fixture\n",
  );
  const refPath = path.join(root, ".git", "refs", "heads", "fixture");
  /**
   * 非秘密Git objectをTest専用Rootへ保存する。
   * @responsibility 通常Readerが検証する実Blob・Tree・Commitを構築する。
   * @trace AIT-IT-002
   * @precondition rootは現在Testが所有する。
   * @stimulus typeとpayloadをGit形式で符号化する。
   * @observation object IDを返す。
   * @oracle SHA-1 object IDと圧縮payloadが一致する。
   * @cleanup 外側hookがRootごと回収する。
   * @boundary AIT-IT-002=Direct Boundary: fixture→Git object Reader
   */
  function writeObject(type: "blob" | "tree" | "commit", payload: Buffer) {
    const encoded = Buffer.concat([
      Buffer.from(`${type} ${payload.length}\0`, "ascii"),
      payload,
    ]);
    const id = createHash("sha1").update(encoded).digest("hex");
    const target = path.join(
      root,
      ".git",
      "objects",
      id.slice(0, 2),
      id.slice(2),
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, deflateSync(encoded));
    return id;
  }
  const blob = writeObject("blob", bytes);
  const documentBlob = writeObject("blob", documentBytes);
  /**
   * Nativeと比較用文書の階層を現在HEADへ固定する。
   * @responsibility 未署名Commitとmode差の反例を生成する。
   * @trace AIT-IT-002
   * @precondition bytesとblobは一致している。
   * @stimulus modeを指定してTreeとCommitを作る。
   * @observation HEADが指すCommit IDを返す。
   * @oracle 文書は追跡されているがNative照合の対象へ混入しない。
   * @cleanup 外側hookがRootごと回収する。
   * @boundary AIT-IT-002=Direct Boundary: HEAD→固定Native Blob
   */
  function commit(mode: "100644" | "100755" = "100644") {
    const segments = [
      ...(prefix === "" ? [] : [prefix]),
      ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
    ];
    let id = blob;
    for (let index = segments.length - 1; index >= 0; index--) {
      const entry = Buffer.concat([
        Buffer.from(
          `${index === segments.length - 1 ? mode : "40000"} ${segments[index]}\0`,
          "utf8",
        ),
        Buffer.from(id, "hex"),
      ]);
      id = writeObject(
        "tree",
        index === (prefix === "" ? 0 : 1)
          ? Buffer.concat([
              Buffer.from("100644 README.md\0", "utf8"),
              Buffer.from(documentBlob, "hex"),
              entry,
            ])
          : entry,
      );
    }
    const revision = writeObject(
      "commit",
      Buffer.from(
        `tree ${id}\nauthor CRDD Test <test@example.invalid> 0 +0000\ncommitter CRDD Test <test@example.invalid> 0 +0000\n\nnative fixture\n`,
      ),
    );
    fs.writeFileSync(refPath, `${revision}\n`);
    return revision;
  }
  const revision = commit();
  return {
    root,
    distributionRoot,
    nativePath,
    bytes,
    refPath,
    blob,
    revision,
    commit,
    documentPath,
    documentBytes,
  };
}

/**
 * Windowsの実junctionをNative出所の正規Rootとして拒否する。
 * @responsibility 文字列上の包含を実Filesystem同一性の代わりにしない。
 * @trace AIT-IT-002
 * @precondition Windowsの自己生成試験Rootだけを使用する。
 * @stimulus 採用Repository内Rootを指すjunctionから出所照合を要求する。
 * @observation linkの存在とnull結果、元Rootの正常結果を観測する。
 * @oracle junctionは拒否され元Rootは利用可能なままである。
 * @cleanup junctionを先に削除し外側hookでexact試験Rootを回収する。
 * @boundary AIT-IT-002=Direct Boundary: Windows junction→Root同一性
 */
test("Host Windows: 単一Nativeの出所Rootは実junctionを拒否する", {
  skip: process.platform !== "win32",
}, (t) => {
  const value = createNativeProvenanceFixture(t, "01_CRDD");
  const alias = path.join(value.root, "alias");
  fs.symlinkSync(value.distributionRoot, alias, "junction");
  try {
    assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
    assert.equal(
      inspectPlatformAccessNativeGitProvenanceCandidate(alias),
      null,
    );
    assert.ok(
      inspectPlatformAccessNativeGitProvenanceCandidate(value.distributionRoot),
    );
  } finally {
    fs.unlinkSync(alias);
    assert.equal(fs.existsSync(alias), false);
  }
});

for (const prefix of ["", "01_CRDD"] as const) {
  /**
   * 未署名Nativeの固定Revision一致と差替え拒否を検証する。
   * @responsibility 署名なし正常、prefix、文書差分とNative／Git不一致を区別する。
   * @trace AIT-IT-002
   * @precondition 自己生成Rootの実Gitと固定Nativeを使用する。
   * @stimulus 文書、Native bytes、mode、Git object、HEAD、境界を変更する。
   * @observation 候補またはnull、Revision相関と非Authority結果を検査する。
   * @oracle Native一致だけを候補とし不明・差替えを拒否する。
   * @cleanup Test hookで自己生成領域を回収し不存在を確認する。
   * @boundary AIT-IT-002=Related 2 Blocks: Git改訂／Native実体→出所確認
   */
  test(`単一Native出所は署名なしで固定Revisionへ一致する: ${prefix || "Root直下"}`, (t) => {
    const value = createNativeProvenanceFixture(t, prefix);
    /**
     * 同じ固定配布RootのNative Git provenanceを再観測する。
     * @responsibility 同じ固定配布RootのNative Git provenanceを再観測する。
     * @trace AIT-IT-002
     * @precondition 自己生成distributionRootと固定Git/Native成果物。
     * @stimulus 実provenance Readerを繰り返し呼ぶ。
     * @observation Commit、Native SHAと拒否結果。
     * @oracle 実体差は拒否し無関係な文書dirtyは結果へ混ぜない。
     * @cleanup 自己生成配布領域をCaseのfinallyで回収する。
     * @boundary Git・Native成果物の読取り。署名やAuthority発行なし。
     */
    const inspect = () =>
      inspectPlatformAccessNativeGitProvenanceCandidate(value.distributionRoot);
    const result = inspect();
    assert.ok(result);
    assert.equal(result.repositoryRevision.revisionIdentity, value.revision);
    assert.equal(
      result.artifact.sha256,
      createHash("sha256").update(value.bytes).digest("hex"),
    );
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(JSON.stringify(result).includes(value.root), false);
    const root = verifyRepositoryRoot(value.root);
    assert.equal(root.status, "completed");
    if (root.status !== "completed") return;
    const document = readFixedSnapshotFile(
      root.capability,
      value.revision,
      `${prefix === "" ? "" : `${prefix}/`}README.md`,
      gitFixedSnapshotAdapter,
    );
    assert.ok(document);
    assert.deepEqual(document.bytes, value.documentBytes);
    fs.writeFileSync(value.documentPath, "dirty tracked documentation\n");
    assert.equal(
      document.bytes.equals(fs.readFileSync(value.documentPath)),
      false,
    );
    const dirty = inspect();
    assert.ok(dirty);
    assert.deepEqual(dirty.repositoryRevision, result.repositoryRevision);
    assert.deepEqual(dirty.artifact, result.artifact);
    fs.writeFileSync(value.documentPath, value.documentBytes);
    fs.writeFileSync(value.nativePath, "changed-native");
    assert.equal(inspect(), null);
    fs.writeFileSync(value.nativePath, value.bytes);
    value.commit("100755");
    assert.equal(inspect(), null);
    value.commit();
    fs.renameSync(value.nativePath, `${value.nativePath}.saved`);
    assert.equal(inspect(), null);
    fs.renameSync(`${value.nativePath}.saved`, value.nativePath);
    assert.ok(inspect());
    const blobPath = path.join(
      value.root,
      ".git",
      "objects",
      value.blob.slice(0, 2),
      value.blob.slice(2),
    );
    const objectBytes = fs.readFileSync(blobPath);
    fs.rmSync(blobPath);
    assert.equal(inspect(), null);
    fs.writeFileSync(blobPath, objectBytes);
    fs.writeFileSync(value.refPath, `${"0".repeat(40)}\n`);
    assert.equal(inspect(), null);
    fs.writeFileSync(value.refPath, `${value.revision}\n`);
    assert.ok(inspect());
    for (const invalid of [
      undefined,
      {},
      "relative",
      `${value.distributionRoot}${path.sep}..`,
      `${value.distributionRoot}${path.sep}missing`,
    ])
      assert.equal(
        inspectPlatformAccessNativeGitProvenanceCandidate(invalid),
        null,
      );
    assert.equal(
      inspectPlatformAccessNativeGitProvenanceCandidate(
        path.dirname(value.root),
      ),
      null,
    );

    const read = fs.readSync;
    let changed = false;
    const mock = t.mock.method(
      fs,
      "readSync",
      (
        fd: number,
        buffer: Buffer,
        offset: number,
        length: number,
        position: number | null,
      ) => {
        const count = read(fd, buffer, offset, length, position);
        if (
          !changed &&
          buffer.subarray(offset, offset + count).equals(value.bytes)
        ) {
          changed = true;
          value.commit("100755");
        }
        return count;
      },
    );
    try {
      assert.equal(inspect(), null);
      assert.equal(changed, true);
    } finally {
      mock.mock.restore();
      fs.writeFileSync(value.refPath, `${value.revision}\n`);
    }
    assert.ok(inspect());

    let nativeChanged = false;
    const mutation = t.mock.method(
      fs,
      "readSync",
      (
        fd: number,
        buffer: Buffer,
        offset: number,
        length: number,
        position: number | null,
      ) => {
        const count = read(fd, buffer, offset, length, position);
        if (
          !nativeChanged &&
          buffer.subarray(offset, offset + count).equals(value.bytes)
        ) {
          nativeChanged = true;
          fs.writeFileSync(
            value.nativePath,
            "different-native-during-observation",
          );
        }
        return count;
      },
    );
    try {
      assert.equal(inspect(), null);
      assert.equal(nativeChanged, true);
    } finally {
      mutation.mock.restore();
      fs.writeFileSync(value.nativePath, value.bytes);
    }
    assert.ok(inspect());
    let lateSwap = false;
    let blobOpens = 0;
    const open = fs.openSync;
    const lateMutation = t.mock.method(
      fs,
      "openSync",
      (target: fs.PathLike, flags: string | number, mode?: fs.Mode) => {
        if (target === blobPath) {
          blobOpens += 1;
          if (!lateSwap) {
            lateSwap = true;
            fs.writeFileSync(value.nativePath, "late-native-replacement");
          }
        }
        return open(target, flags, mode);
      },
    );
    try {
      assert.equal(
        inspect(),
        null,
        "late Native swap must fail final token revalidation",
      );
      assert.equal(lateSwap, true);
      assert.equal(blobOpens, 1);
    } finally {
      lateMutation.mock.restore();
      fs.writeFileSync(value.nativePath, value.bytes);
    }
    assert.ok(inspect());
    const failure = t.mock.method(fs, "readSync", () => {
      throw new Error("intentionally unobservable");
    });
    try {
      assert.equal(inspect(), null);
    } finally {
      failure.mock.restore();
    }
    assert.ok(inspect());
    const gitMarker = path.join(value.distributionRoot, ".git");
    if (prefix !== "") {
      fs.writeFileSync(gitMarker, "gitdir: missing\n");
      assert.equal(inspect(), null);
      fs.rmSync(gitMarker);
      assert.ok(inspect());
    }
  });
}
