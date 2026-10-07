/**
 * 最小RuntimeとNativeの固定Git出所をRepository-local試験領域で構築する。
 * @packageDocumentation
 * @responsibility 署名と準備の試験前提を共有し、正式署名や全Repository展開を行わない。
 * @trace AIT-IT-008
 * @level IT
 * @scope fixed Runtime signing fixture
 * @boundary AIT-IT-008=Direct Boundary: Test Fixture→Fixed Git Snapshot
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import { PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH } from "../../src/diagnostics/platform-access-release.ts";
import { inspectRuntimeDistributionSigningFilesCandidate } from "../../src/platform-access/platform-provisioner-package-filesystem.ts";
const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
/**
 * 選択RuntimeとNativeのbytes、固定Commit/Tree、未変更署名Toolを用意する。
 * @responsibility Repository-localの所有runと回収責務を試験へ渡す。
 * @trace AIT-IT-008
 * @precondition 現行Repositoryの実行閉包とNativeが読み取れる。
 * @stimulus 同bytesを最小配布とsynthetic Git objectへ符号化する。
 * @observation source、commit、tree、distributionRoot、cleanupを返す。
 * @oracle 本番Readerが選択集合のGit出所を受理する。全Tree archiveは使わない。
 * @cleanup 呼出し側はcleanupをfinallyで実行する。構築失敗も内部で回収する。
 * @boundary AIT-IT-008=Direct Boundary: fixture→Repository-local Filesystem
 */
export function createFixedRuntimeSigningFixture(
  usage: "signing" | "preparation" = "signing",
) {
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  const boundaries = [
    repositoryRoot,
    path.join(repositoryRoot, ".crdd"),
    testsRoot,
  ];
  /**
   * 書込み前に既存Directoryと明示不存在を区別する。
   * @responsibility alias、型不正、観測不能を作成許可へ変換しない。
   * @trace AIT-IT-008
   * @precondition 対象はModule所有Rootとその直下の試験祖先だけである。
   * @stimulus lstatとcanonical Pathを読む。
   * @observation 正常DirectoryかENOENTによる不存在だけを返す。
   * @oracle non-link Directoryとcanonical一致を満たす。ENOENT以外は停止する。
   * @cleanup N/A: 読取りだけで資源を作成しない。
   * @boundary Repository-local試験RootとFilesystem metadata。
   */
  function observeDirectory(target: string): boolean {
    let metadata: fs.Stats;
    try {
      metadata = fs.lstatSync(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
    assert.equal(metadata.isDirectory(), true);
    assert.equal(metadata.isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(target), target);
    return true;
  }
  const observed = boundaries.map(observeDirectory);
  assert.equal(observed[0], true);
  assert.equal(verifyRepositoryRoot(repositoryRoot).status, "completed");
  for (let index = 1; index < boundaries.length; index += 1) {
    if (!observed[index]) {
      for (const ancestor of boundaries.slice(0, index))
        assert.equal(observeDirectory(ancestor), true);
      fs.mkdirSync(boundaries[index] as string);
    }
    assert.equal(observeDirectory(boundaries[index] as string), true);
  }
  for (const boundary of boundaries)
    assert.equal(observeDirectory(boundary), true);
  const parent = fs.mkdtempSync(path.join(testsRoot, "manifest-wrong-key-"));
  const source = path.join(parent, "source");
  const distributionRoot = path.join(
    source,
    ".crdd",
    usage === "signing" ? "tmp" : "tests",
    usage === "signing" ? "signature" : "fixed-runtime",
    "work",
  );
  try {
    const closure =
      inspectRuntimeDistributionSigningFilesCandidate(repositoryRoot);
    assert.equal(closure.status, "candidate");
    if (closure.status !== "candidate")
      throw new Error("fixture_runtime_closure_invalid");
    const contents = new Map<string, Buffer>();
    for (const file of closure.files)
      contents.set(
        file.path,
        fs.readFileSync(path.join(repositoryRoot, ...file.path.split("/"))),
      );
    contents.set(
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
      fs.readFileSync(
        path.join(
          repositoryRoot,
          ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
        ),
      ),
    );
    for (const [relative, bytes] of contents) {
      for (const root of [source, distributionRoot]) {
        const target = path.join(root, ...relative.split("/"));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
    }
    // 署名Toolは未変更の検証実行者。実行閉包に含まれない場合も署名対象を増やさない。
    for (const relative of [
      "40_Develop/coordinator/scripts/sign-release-manifest.ts",
      "40_Develop/coordinator/scripts/release-staging-manifest.ts",
    ]) {
      if (contents.has(relative)) continue;
      const target = path.join(source, ...relative.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(
        path.join(repositoryRoot, ...relative.split("/")),
        target,
      );
    }
    const gitRoot = path.join(source, ".git");
    fs.mkdirSync(path.join(gitRoot, "objects"), { recursive: true });
    fs.mkdirSync(path.join(gitRoot, "refs", "heads"), { recursive: true });
    fs.writeFileSync(
      path.join(gitRoot, "config"),
      "[core]\nrepositoryformatversion = 0\nbare = false\n",
    );
    fs.writeFileSync(path.join(gitRoot, "HEAD"), "ref: refs/heads/fixture\n");
    /**
     * 非秘密の固定Git objectを試験Repositoryだけへ生成する。
     * @responsibility 誤鍵Oracleの前提となるGit出所を構築する。
     * @trace AIT-IT-008
     * @precondition gitRootはexact所有fixture内である。
     * @stimulus typeとbytesをGit形式で符号化する。
     * @observation object IDを返す。
     * @oracle 本番Version Control Readerが読み取れる。
     * @cleanup 外側Testがexact親Rootを回収する。
     * @boundary AIT-IT-008=Direct Boundary: fixture→Fixed Snapshot Reader
     */
    function writeObject(type: "blob" | "tree" | "commit", bytes: Buffer) {
      const encoded = Buffer.concat([
        Buffer.from(`${type} ${bytes.length}\0`, "ascii"),
        bytes,
      ]);
      const oid = createHash("sha1").update(encoded).digest("hex");
      const directory = path.join(gitRoot, "objects", oid.slice(0, 2));
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, oid.slice(2)),
        deflateSync(encoded),
      );
      return oid;
    }
    /**
     * 最小Runtime集合とNativeだけの固定Treeを構築する。
     * @responsibility 全Repositoryや歴史署名を新方式へ読み替えない。
     * @trace AIT-IT-008
     * @precondition contentsは実行閉包とNativeの非秘密bytesだけである。
     * @stimulus 選択PathをGit階層と順序へ符号化する。
     * @observation Tree object IDを返す。
     * @oracle 本番署名前出所検査が同じ最小集合を照合する。
     * @cleanup 外側Testがexact親Rootを回収する。
     * @boundary AIT-IT-008=Direct Boundary: fixture→Fixed Snapshot Reader
     */
    function writeTree(prefix: string): string {
      const entries = new Map<
        string,
        Readonly<{ mode: string; oid: string }>
      >();
      for (const [relative, bytes] of contents) {
        if (!relative.startsWith(prefix)) continue;
        const remaining = relative.slice(prefix.length);
        const slash = remaining.indexOf("/");
        if (slash < 0)
          entries.set(remaining, {
            mode: "100644",
            oid: writeObject("blob", bytes),
          });
        else {
          const name = remaining.slice(0, slash);
          if (!entries.has(name))
            entries.set(name, {
              mode: "40000",
              oid: writeTree(`${prefix}${name}/`),
            });
        }
      }
      const ordered = [...entries].sort(([left, a], [right, b]) =>
        Buffer.compare(
          Buffer.from(`${left}${a.mode === "40000" ? "/" : ""}`),
          Buffer.from(`${right}${b.mode === "40000" ? "/" : ""}`),
        ),
      );
      return writeObject(
        "tree",
        Buffer.concat(
          ordered.flatMap(([name, entry]) => [
            Buffer.from(`${entry.mode} ${name}\0`, "utf8"),
            Buffer.from(entry.oid, "hex"),
          ]),
        ),
      );
    }
    const crddTree = writeTree("");
    const crddCommit = writeObject(
      "commit",
      Buffer.from(
        `tree ${crddTree}\nauthor CRDD Test <test@example.invalid> 0 +0000\ncommitter CRDD Test <test@example.invalid> 0 +0000\n\nfixture\n`,
      ),
    );
    fs.writeFileSync(
      path.join(gitRoot, "refs", "heads", "fixture"),
      `${crddCommit}\n`,
    );
    assert.equal(
      inspectRuntimeDistributionSigningFilesCandidate(distributionRoot).status,
      "candidate",
    );
    assert.equal(fs.existsSync(path.join(distributionRoot, ".git")), false);
    return Object.freeze({
      source,
      commit: crddCommit,
      tree: crddTree,
      distributionRoot,
      /**
       * fixture全体をexact所有Rootから回収する。
       * @responsibility 試験runの回収と不存在確認を所有する。
       * @trace AIT-IT-008
       * @precondition parentはこのfixtureで作成したRepository-local runである。
       * @stimulus canonical親Rootを照合し回収する。
       * @observation 回収後の不存在を確認する。
       * @oracle parentがtestsRoot直下の実体であり、回収後存在しない。
       * @cleanup N/A: cleanup操作自身が回収責務である。
       * @boundary AIT-IT-008=Direct Boundary: fixture→Filesystem
       */
      cleanup() {
        assert.equal(path.dirname(parent), testsRoot);
        assert.equal(fs.realpathSync.native(parent), parent);
        fs.rmSync(parent, { recursive: true, force: true });
        assert.equal(fs.existsSync(parent), false);
      },
    });
  } catch (error) {
    assert.equal(path.dirname(parent), testsRoot);
    assert.equal(fs.realpathSync.native(parent), parent);
    fs.rmSync(parent, { recursive: true, force: true });
    assert.equal(fs.existsSync(parent), false);
    throw error;
  }
}
