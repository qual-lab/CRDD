/**
 * platform-access-coverage-pathに属する責務をまとめる。
 *
 * @responsibility DirectoryIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";

/**
 * platform-access-coverage-pathで使用するDirectory Identityの値契約を定義する。
 *
 * @responsibility Directory IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DirectoryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DirectoryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DirectoryIdentityの宣言は外部境界を開かない。
 * @security N/A: DirectoryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DirectoryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DirectoryIdentity = Readonly<{
  device: bigint;
  inode: bigint;
  realPath: string;
}>;

/**
 * platform-access-coverage-pathで使用するCoverage Run Rootの値契約を定義する。
 *
 * @responsibility Coverage Run RootのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoverageRunRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoverageRunRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoverageRunRootの宣言は外部境界を開かない。
 * @security N/A: CoverageRunRootはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoverageRunRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoverageRunRoot = Readonly<{
  coverageRoot: string;
  coverageIdentity: DirectoryIdentity;
  targetRoot: string;
  targetIdentity: DirectoryIdentity;
  resultsRoot: string;
  resultsIdentity: DirectoryIdentity;
  boundaries: readonly Readonly<{
    path: string;
    identity: DirectoryIdentity;
  }>[];
}>;

/**
 * Real Directoryを観測する。
 *
 * @responsibility Real Directoryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input directoryPath: string
 * @returns DirectoryIdentityを返す。
 * @precondition 「directoryPath: string」がinspectRealDirectoryの入力契約を満たす。
 * @postcondition inspectRealDirectoryの責務を完了した結果だけを返す。
 * @effect inspectRealDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectRealDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRealDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectRealDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRealDirectoryは共有非同期状態を持たない同期処理である。
 */
function inspectRealDirectory(directoryPath: string): DirectoryIdentity {
  const before = fs.lstatSync(directoryPath, { bigint: true });
  if (before.isSymbolicLink() || !before.isDirectory() || before.ino === 0n) {
    throw new Error(
      `coverage boundary is not a real directory: ${directoryPath}`,
    );
  }
  const realPath = fs.realpathSync.native(directoryPath);
  const after = fs.lstatSync(directoryPath, { bigint: true });
  if (
    after.isSymbolicLink() ||
    !after.isDirectory() ||
    after.ino === 0n ||
    before.dev !== after.dev ||
    before.ino !== after.ino
  ) {
    throw new Error(
      `coverage boundary changed during inspection: ${directoryPath}`,
    );
  }
  return Object.freeze({
    device: after.dev,
    inode: after.ino,
    realPath,
  });
}

/**
 * Same Directoryを表明どおりか検査する。
 *
 * @responsibility Same Directoryの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input directoryPath: string、expectedIdentity: DirectoryIdentity
 * @returns N/A: assertSameDirectoryは戻り値を返さない。
 * @precondition 「directoryPath: string、expectedIdentity: DirectoryIdentity」がassertSameDirectoryの入力契約を満たす。
 * @postcondition assertSameDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertSameDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertSameDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertSameDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertSameDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: assertSameDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertSameDirectoryは共有非同期状態を持たない同期処理である。
 */
function assertSameDirectory(
  directoryPath: string,
  expectedIdentity: DirectoryIdentity,
): void {
  const actualIdentity = inspectRealDirectory(directoryPath);
  if (
    actualIdentity.device !== expectedIdentity.device ||
    actualIdentity.inode !== expectedIdentity.inode ||
    actualIdentity.realPath !== expectedIdentity.realPath
  ) {
    throw new Error(`coverage directory identity changed: ${directoryPath}`);
  }
}

/**
 * Coverage Run Rootを構築する。
 *
 * @responsibility Coverage Run Rootの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input platformAccessCrateRoot: string、resultsRoot: 検証済みRepository-local試験領域、repositoryRoot: 検証するRepository境界
 * @returns CoverageRunRootを返す。
 * @precondition crateとresultsRootが呼出し側で検証されたRepository内の通常Directoryである。
 * @postcondition createCoverageRunRootの責務を完了した結果だけを返す。
 * @effect createCoverageRunRootはFilesystemの読取りまたは書込みを実行する。
 * @failure createCoverageRunRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCoverageRunRootは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: createCoverageRunRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createCoverageRunRootは共有非同期状態を持たない同期処理である。
 */
export function createCoverageRunRoot(
  platformAccessCrateRoot: string,
  resultsRoot: string,
  repositoryRoot: string,
): CoverageRunRoot {
  const boundaries = [];
  for (const directory of [platformAccessCrateRoot, resultsRoot]) {
    const relative = path.relative(repositoryRoot, directory);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("coverage directory outside repository");
    let current = directory;
    while (true) {
      const identity = inspectRealDirectory(current);
      if (identity.realPath !== current)
        throw new Error("coverage ancestor alias");
      boundaries.push(Object.freeze({ path: current, identity }));
      if (current === repositoryRoot) break;
      const parent = path.dirname(current);
      if (parent === current)
        throw new Error("coverage repository boundary unreachable");
      current = parent;
    }
  }
  const crateIdentity = inspectRealDirectory(platformAccessCrateRoot);
  const targetRoot = path.join(platformAccessCrateRoot, "target");
  if (path.dirname(targetRoot) !== platformAccessCrateRoot) {
    throw new Error("coverage target is not a direct crate child");
  }
  try {
    fs.mkdirSync(targetRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  assertSameDirectory(platformAccessCrateRoot, crateIdentity);
  const targetIdentity = inspectRealDirectory(targetRoot);
  if (path.dirname(targetIdentity.realPath) !== crateIdentity.realPath) {
    throw new Error("coverage target resolved outside the crate root");
  }
  const resultsIdentity = inspectRealDirectory(resultsRoot);
  const coverageRoot = fs.mkdtempSync(
    path.join(resultsRoot, "native-coverage-"),
  );
  assertSameDirectory(targetRoot, targetIdentity);
  const coverageIdentity = inspectRealDirectory(coverageRoot);
  if (path.dirname(coverageIdentity.realPath) !== resultsIdentity.realPath) {
    throw new Error("coverage run directory resolved outside the results root");
  }
  return Object.freeze({
    coverageRoot,
    coverageIdentity,
    targetRoot,
    targetIdentity,
    resultsRoot,
    resultsIdentity,
    boundaries: Object.freeze(boundaries),
  });
}

/**
 * Coverage Run Rootを表明どおりか検査する。
 *
 * @responsibility Coverage Run Rootの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input runRoot: CoverageRunRoot
 * @returns N/A: assertCoverageRunRootは戻り値を返さない。
 * @precondition 「runRoot: CoverageRunRoot」がassertCoverageRunRootの入力契約を満たす。
 * @postcondition assertCoverageRunRootの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertCoverageRunRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertCoverageRunRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertCoverageRunRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertCoverageRunRootはProcess内の同一Subsystemで完結する。
 * @security N/A: assertCoverageRunRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertCoverageRunRootは共有非同期状態を持たない同期処理である。
 */
export function assertCoverageRunRoot(runRoot: CoverageRunRoot): void {
  for (const boundary of runRoot.boundaries)
    assertSameDirectory(boundary.path, boundary.identity);
  assertSameDirectory(runRoot.targetRoot, runRoot.targetIdentity);
  assertSameDirectory(runRoot.resultsRoot, runRoot.resultsIdentity);
  assertSameDirectory(runRoot.coverageRoot, runRoot.coverageIdentity);
  if (
    path.dirname(runRoot.coverageIdentity.realPath) !==
    runRoot.resultsIdentity.realPath
  ) {
    throw new Error(
      "coverage run directory is no longer a direct results child",
    );
  }
}
