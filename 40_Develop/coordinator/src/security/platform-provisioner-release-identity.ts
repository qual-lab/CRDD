/**
 * platform-provisioner-release-identityに属する責務をまとめる。
 *
 * @responsibility HashAlgorithmを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "../../../runtime-data/src/index.ts";
import { PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH } from "./platform-access-release.ts";
import { PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH } from "./platform-provisioner-manifest-loader.ts";
import { isCanonicalCrddGitObjectId } from "./release-identity-grammar.ts";

const MAXIMUM_DISTRIBUTION_FILES = 2_048;
const MAXIMUM_DISTRIBUTION_BYTES = 64 * 1024 * 1024;
const TRACKED_RUNTIME_SETTING_RELATIVE_PATHS = new Set<string>([
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
]);

/**
 * platform-provisioner-release-identityで使用するHash Algorithmの値契約を定義する。
 *
 * @responsibility Hash AlgorithmのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape HashAlgorithmが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HashAlgorithmで宣言した値と責務の対応を維持する。
 * @boundary N/A: HashAlgorithmの宣言は外部境界を開かない。
 * @security HashAlgorithmはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HashAlgorithmの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HashAlgorithm = "sha1" | "sha256";

/**
 * platform-provisioner-release-identityで使用するStable Identityの値契約を定義する。
 *
 * @responsibility Stable IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape StableIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StableIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: StableIdentityの宣言は外部境界を開かない。
 * @security StableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StableIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StableIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

/**
 * platform-provisioner-release-identityで使用するTree Entryの値契約を定義する。
 *
 * @responsibility Tree EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape TreeEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TreeEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: TreeEntryの宣言は外部境界を開かない。
 * @security TreeEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TreeEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TreeEntry = Readonly<{
  name: string;
  isDirectory: boolean;
  mode: "40000" | "100644" | "100755";
  objectId: Buffer;
}>;

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input metadata: fs.BigIntStats
 * @returns StableIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identityは独自の失敗分岐を所有しない。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security identityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(metadata: fs.BigIntStats): StableIdentity {
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

/**
 * Identityが同一かを判定する。
 *
 * @responsibility Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000014
 * @input left: StableIdentity、right: StableIdentity
 * @returns sameIdentityの計算結果を返す。
 * @precondition 「left: StableIdentity、right: StableIdentity」がsameIdentityの入力契約を満たす。
 * @postcondition sameIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameIdentityは独自の失敗分岐を所有しない。
 * @invariant sameIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameIdentityはProcess内の同一Subsystemで完結する。
 * @security sameIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameIdentityは共有非同期状態を持たない同期処理である。
 */
function sameIdentity(left: StableIdentity, right: StableIdentity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

/**
 * hash Algorithmを決定する。
 *
 * @responsibility hash Algorithmの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input expectedTree: string
 * @returns HashAlgorithm | nullを返す。
 * @precondition 「expectedTree: string」がhashAlgorithmの入力契約を満たす。
 * @postcondition hashAlgorithmの責務を完了した結果だけを返す。
 * @effect N/A: hashAlgorithmは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hashAlgorithmは独自の失敗分岐を所有しない。
 * @invariant hashAlgorithmは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hashAlgorithmはProcess内の同一Subsystemで完結する。
 * @security hashAlgorithmはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hashAlgorithmは共有非同期状態を持たない同期処理である。
 */
function hashAlgorithm(expectedTree: string): HashAlgorithm | null {
  if (!isCanonicalCrddGitObjectId(expectedTree)) return null;
  return expectedTree.length === 40 ? "sha1" : "sha256";
}

/**
 * git Object Idを決定する。
 *
 * @responsibility git Object Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input algorithm: HashAlgorithm、type: "blob" | "tree"、bytes: Buffer
 * @returns gitObjectIdの計算結果を返す。
 * @precondition 「algorithm: HashAlgorithm、type: "blob" | "tree"、bytes: Buffer」がgitObjectIdの入力契約を満たす。
 * @postcondition gitObjectIdの責務を完了した結果だけを返す。
 * @effect N/A: gitObjectIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: gitObjectIdは独自の失敗分岐を所有しない。
 * @invariant gitObjectIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: gitObjectIdはProcess内の同一Subsystemで完結する。
 * @security gitObjectIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: gitObjectIdは共有非同期状態を持たない同期処理である。
 */
function gitObjectId(
  algorithm: HashAlgorithm,
  type: "blob" | "tree",
  bytes: Buffer,
) {
  const header = Buffer.from(`${type} ${bytes.length}\0`, "ascii");
  return createHash(algorithm).update(header).update(bytes).digest();
}

/**
 * Entry Nameが有効か判定する。
 *
 * @responsibility Entry Nameの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000014
 * @input name: string
 * @returns validEntryNameの計算結果を返す。
 * @precondition 「name: string」がvalidEntryNameの入力契約を満たす。
 * @postcondition validEntryNameの責務を完了した結果だけを返す。
 * @effect N/A: validEntryNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validEntryNameは独自の失敗分岐を所有しない。
 * @invariant validEntryNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validEntryNameはProcess内の同一Subsystemで完結する。
 * @security validEntryNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validEntryNameは共有非同期状態を持たない同期処理である。
 */
function validEntryName(name: string) {
  return (
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("\0") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

/**
 * File Bytesを安定Identityへ変換する。
 *
 * @responsibility File Bytesの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input target: string、remainingBytes: number
 * @returns stableFileBytesの計算結果を返す。
 * @precondition 「target: string、remainingBytes: number」がstableFileBytesの入力契約を満たす。
 * @postcondition stableFileBytesの責務を完了した結果だけを返す。
 * @effect stableFileBytesはFilesystemの読取りまたは書込みを実行する。
 * @failure stableFileBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableFileBytesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableFileBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableFileBytesは共有非同期状態を持たない同期処理である。
 */
function stableFileBytes(target: string, remainingBytes: number) {
  const beforeMetadata = fs.lstatSync(target, { bigint: true });
  const before = identity(beforeMetadata);
  if (
    !beforeMetadata.isFile() ||
    beforeMetadata.isSymbolicLink() ||
    before.size < 0n ||
    before.size > BigInt(remainingBytes) ||
    fs.realpathSync.native(target) !== target
  ) {
    throw new Error("platform_provisioner_distribution_file_invalid");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
  try {
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameIdentity(before, opened)) {
      throw new Error("platform_provisioner_distribution_file_changed");
    }
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    const after = identity(fs.fstatSync(descriptor, { bigint: true }));
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }));
    if (
      offset !== bytes.length ||
      !sameIdentity(opened, after) ||
      !sameIdentity(opened, pathAfter) ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("platform_provisioner_distribution_file_changed");
    }
    return Object.freeze({ bytes, mode: opened.mode });
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * canonical Distribution File Bytesを決定する。
 *
 * @responsibility canonical Distribution File Bytesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input relativePath: string、bytes: Buffer
 * @returns canonicalDistributionFileBytesの計算結果を返す。
 * @precondition 「relativePath: string、bytes: Buffer」がcanonicalDistributionFileBytesの入力契約を満たす。
 * @postcondition canonicalDistributionFileBytesの責務を完了した結果だけを返す。
 * @effect N/A: canonicalDistributionFileBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalDistributionFileBytesは独自の失敗分岐を所有しない。
 * @invariant canonicalDistributionFileBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalDistributionFileBytesはProcess内の同一Subsystemで完結する。
 * @security canonicalDistributionFileBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalDistributionFileBytesは共有非同期状態を持たない同期処理である。
 */
function canonicalDistributionFileBytes(relativePath: string, bytes: Buffer) {
  if (relativePath.endsWith(".exe")) return bytes;
  // The repository declares `* text=auto eol=lf`. Match Git's text=auto
  // binary heuristic: a NUL in the first 8 KiB keeps the blob byte-exact.
  if (bytes.subarray(0, 8_000).includes(0x00)) return bytes;
  let crlfCount = 0;
  for (let index = 0; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) crlfCount += 1;
  }
  if (crlfCount === 0) return bytes;
  const canonical = Buffer.allocUnsafe(bytes.length - crlfCount);
  let output = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) continue;
    canonical[output] = bytes[index] as number;
    output += 1;
  }
  return canonical;
}

/**
 * git Sort Nameを決定する。
 *
 * @responsibility git Sort Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input entry: TreeEntry
 * @returns gitSortNameの計算結果を返す。
 * @precondition 「entry: TreeEntry」がgitSortNameの入力契約を満たす。
 * @postcondition gitSortNameの責務を完了した結果だけを返す。
 * @effect N/A: gitSortNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: gitSortNameは独自の失敗分岐を所有しない。
 * @invariant gitSortNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: gitSortNameはProcess内の同一Subsystemで完結する。
 * @security gitSortNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: gitSortNameは共有非同期状態を持たない同期処理である。
 */
function gitSortName(entry: TreeEntry) {
  return Buffer.from(`${entry.name}${entry.isDirectory ? "/" : ""}`, "utf8");
}

/**
 * Treeを固定形式へ符号化する。
 *
 * @responsibility Treeの入力値、符号化規則、出力byte列の境界を所有する。
 * @trace ARCH-000014
 * @input entries: readonly TreeEntry[]
 * @returns encodeTreeの計算結果を返す。
 * @precondition 「entries: readonly TreeEntry[]」がencodeTreeの入力契約を満たす。
 * @postcondition encodeTreeの責務を完了した結果だけを返す。
 * @effect N/A: encodeTreeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: encodeTreeは独自の失敗分岐を所有しない。
 * @invariant encodeTreeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: encodeTreeはProcess内の同一Subsystemで完結する。
 * @security encodeTreeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: encodeTreeは共有非同期状態を持たない同期処理である。
 */
function encodeTree(entries: readonly TreeEntry[]) {
  const orderedEntries = [...entries].sort((left, right) =>
    Buffer.compare(gitSortName(left), gitSortName(right)),
  );
  return Buffer.concat(
    orderedEntries.flatMap((entry) => [
      Buffer.from(`${entry.mode} ${entry.name}\0`, "utf8"),
      entry.objectId,
    ]),
  );
}

/**
 * Excluded Post Checkout Artifactかを判定する。
 *
 * @responsibility Excluded Post Checkout Artifactの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input relativePath: string
 * @returns isExcludedPostCheckoutArtifactの計算結果を返す。
 * @precondition 「relativePath: string」がisExcludedPostCheckoutArtifactの入力契約を満たす。
 * @postcondition isExcludedPostCheckoutArtifactの責務を完了した結果だけを返す。
 * @effect N/A: isExcludedPostCheckoutArtifactは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isExcludedPostCheckoutArtifactは独自の失敗分岐を所有しない。
 * @invariant isExcludedPostCheckoutArtifactは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isExcludedPostCheckoutArtifactはProcess内の同一Subsystemで完結する。
 * @security isExcludedPostCheckoutArtifactはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isExcludedPostCheckoutArtifactは共有非同期状態を持たない同期処理である。
 */
function isExcludedPostCheckoutArtifact(relativePath: string) {
  return relativePath === PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH;
}

/**
 * Repository Metadata Entryを検証する。
 *
 * @responsibility Repository Metadata Entryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input target: string
 * @returns N/A: verifyRepositoryMetadataEntryは戻り値を返さない。
 * @precondition 「target: string」がverifyRepositoryMetadataEntryの入力契約を満たす。
 * @postcondition verifyRepositoryMetadataEntryの責務を完了して呼出し元へ制御を戻す。
 * @effect verifyRepositoryMetadataEntryはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyRepositoryMetadataEntryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRepositoryMetadataEntryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyRepositoryMetadataEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRepositoryMetadataEntryは共有非同期状態を持たない同期処理である。
 */
function verifyRepositoryMetadataEntry(target: string) {
  const metadata = fs.lstatSync(target);
  if (
    metadata.isSymbolicLink() ||
    (!metadata.isFile() && !metadata.isDirectory()) ||
    fs.realpathSync.native(target) !== target
  ) {
    throw new Error("platform_provisioner_distribution_git_metadata_invalid");
  }
}

/**
 * Distribution Treeを観測する。
 *
 * @responsibility Distribution Treeの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: string、expectedTree: string
 * @returns observeDistributionTreeの計算結果を返す。
 * @precondition 「distributionRoot: string、expectedTree: string」がobserveDistributionTreeの入力契約を満たす。
 * @postcondition observeDistributionTreeの責務を完了した結果だけを返す。
 * @effect observeDistributionTreeはFilesystemの読取りまたは書込みを実行する。
 * @failure observeDistributionTreeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDistributionTreeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeDistributionTreeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDistributionTreeは共有非同期状態を持たない同期処理である。
 */
function observeDistributionTree(
  distributionRoot: string,
  expectedTree: string,
) {
  if (
    typeof distributionRoot !== "string" ||
    distributionRoot.length === 0 ||
    !path.isAbsolute(distributionRoot) ||
    distributionRoot.includes("\0")
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  const algorithm = hashAlgorithm(expectedTree);
  if (!algorithm) {
    throw new Error("platform_provisioner_distribution_tree_invalid");
  }
  const root = path.resolve(distributionRoot);
  const rootMetadata = fs.lstatSync(root, { bigint: true });
  const rootIdentity = identity(rootMetadata);
  if (
    !rootMetadata.isDirectory() ||
    rootMetadata.isSymbolicLink() ||
    fs.realpathSync.native(root) !== root
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  let fileCount = 0;
  let byteLength = 0;
  const excludedPostCheckoutArtifacts = new Set<string>();
  const excludedRepositoryMetadata = new Set<string>();
  const excludedRuntimeMetadata = new Set<string>();
  const includedSignedArtifacts = new Set<string>();
  const includedTrackedRuntimeSettings = new Set<string>();
  const walk = (directory: string, relativeDirectory: string) => {
    const beforeMetadata = fs.lstatSync(directory, { bigint: true });
    const before = identity(beforeMetadata);
    if (
      !beforeMetadata.isDirectory() ||
      beforeMetadata.isSymbolicLink() ||
      fs.realpathSync.native(directory) !== directory
    ) {
      throw new Error("platform_provisioner_distribution_directory_invalid");
    }
    const names = fs.readdirSync(directory);
    const entries: TreeEntry[] = [];
    for (const name of names) {
      if (!validEntryName(name)) {
        throw new Error("platform_provisioner_distribution_entry_invalid");
      }
      const relative = relativeDirectory
        ? `${relativeDirectory}/${name}`
        : name;
      if (relative === ".git") {
        if (excludedRepositoryMetadata.has(relative)) {
          throw new Error(
            "platform_provisioner_distribution_git_metadata_invalid",
          );
        }
        verifyRepositoryMetadataEntry(path.join(directory, name));
        excludedRepositoryMetadata.add(relative);
        continue;
      }
      if (relativeDirectory === ".crdd" && relative !== ".crdd/config") {
        excludedRuntimeMetadata.add(relative);
        continue;
      }
      if (
        relativeDirectory === ".crdd/config" &&
        !TRACKED_RUNTIME_SETTING_RELATIVE_PATHS.has(relative)
      ) {
        excludedRuntimeMetadata.add(relative);
        continue;
      }
      if (isExcludedPostCheckoutArtifact(relative)) {
        if (excludedPostCheckoutArtifacts.has(relative)) {
          throw new Error("platform_provisioner_distribution_manifest_invalid");
        }
        excludedPostCheckoutArtifacts.add(relative);
        const manifestPath = path.join(directory, name);
        const manifestMetadata = fs.lstatSync(manifestPath);
        if (
          !manifestMetadata.isFile() ||
          manifestMetadata.isSymbolicLink() ||
          fs.realpathSync.native(manifestPath) !== manifestPath
        ) {
          throw new Error("platform_provisioner_distribution_manifest_invalid");
        }
        continue;
      }
      const target = path.join(directory, name);
      const metadata = fs.lstatSync(target, { bigint: true });
      if (metadata.isSymbolicLink()) {
        throw new Error("platform_provisioner_distribution_link_rejected");
      }
      if (metadata.isDirectory()) {
        const child = walk(target, relative);
        if (child.hasEntries) {
          entries.push(
            Object.freeze({
              name,
              isDirectory: true,
              mode: "40000" as const,
              objectId: child.objectId,
            }),
          );
        }
        continue;
      }
      if (!metadata.isFile()) {
        throw new Error("platform_provisioner_distribution_entry_invalid");
      }
      if (relative === PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH) {
        includedSignedArtifacts.add(relative);
      }
      if (TRACKED_RUNTIME_SETTING_RELATIVE_PATHS.has(relative)) {
        includedTrackedRuntimeSettings.add(relative);
      }
      fileCount += 1;
      if (fileCount > MAXIMUM_DISTRIBUTION_FILES) {
        throw new Error("platform_provisioner_distribution_budget_exceeded");
      }
      const observed = stableFileBytes(
        target,
        MAXIMUM_DISTRIBUTION_BYTES - byteLength,
      );
      byteLength += observed.bytes.length;
      if (byteLength > MAXIMUM_DISTRIBUTION_BYTES) {
        throw new Error("platform_provisioner_distribution_budget_exceeded");
      }
      const isExecutable =
        process.platform !== "win32" && (observed.mode & 0o111n) !== 0n;
      const canonicalBytes = canonicalDistributionFileBytes(
        relative,
        observed.bytes,
      );
      entries.push(
        Object.freeze({
          name,
          isDirectory: false,
          mode: isExecutable ? ("100755" as const) : ("100644" as const),
          objectId: gitObjectId(algorithm, "blob", canonicalBytes),
        }),
      );
    }
    const after = identity(fs.lstatSync(directory, { bigint: true }));
    if (
      !sameIdentity(before, after) ||
      fs.realpathSync.native(directory) !== directory
    ) {
      throw new Error("platform_provisioner_distribution_directory_changed");
    }
    return Object.freeze({
      hasEntries: entries.length > 0,
      objectId: gitObjectId(algorithm, "tree", encodeTree(entries)),
    });
  };
  const tree = walk(root, "").objectId.toString("hex");
  const rootAfter = identity(fs.lstatSync(root, { bigint: true }));
  if (
    !sameIdentity(rootIdentity, rootAfter) ||
    fs.realpathSync.native(root) !== root
  ) {
    throw new Error("platform_provisioner_distribution_root_changed");
  }
  return Object.freeze({
    tree,
    fileCount,
    byteLength,
    manifestExcludedFromTree: excludedPostCheckoutArtifacts.has(
      PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    ),
    platformAccessExecutableIncludedInTree: includedSignedArtifacts.has(
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
    ),
    gitMetadataExcludedFromTree: excludedRepositoryMetadata.has(".git"),
    runtimeMetadataExcludedFromTree: excludedRuntimeMetadata.size > 0,
    trackedRuntimeSettingIncludedInTree: includedTrackedRuntimeSettings.has(
      EXTERNAL_SEND_POLICY_RELATIVE_PATH,
    ),
  });
}

/**
 * Platform Provisioner Release Identity 候補を観測する。
 *
 * @responsibility Platform Provisioner Release Identity 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input distributionRoot: unknown、expectedCrddTree: unknown
 * @returns inspectPlatformProvisionerReleaseIdentityCandidateの計算結果を返す。
 * @precondition 「distributionRoot: unknown、expectedCrddTree: unknown」がinspectPlatformProvisionerReleaseIdentityCandidateの入力契約を満たす。
 * @postcondition inspectPlatformProvisionerReleaseIdentityCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectPlatformProvisionerReleaseIdentityCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectPlatformProvisionerReleaseIdentityCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectPlatformProvisionerReleaseIdentityCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectPlatformProvisionerReleaseIdentityCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectPlatformProvisionerReleaseIdentityCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectPlatformProvisionerReleaseIdentityCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectPlatformProvisionerReleaseIdentityCandidate(
  distributionRoot: unknown,
  expectedCrddTree: unknown,
) {
  try {
    if (
      typeof distributionRoot !== "string" ||
      typeof expectedCrddTree !== "string"
    ) {
      throw new Error("platform_provisioner_release_identity_input_invalid");
    }
    const observed = observeDistributionTree(
      distributionRoot,
      expectedCrddTree,
    );
    if (observed.tree !== expectedCrddTree) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "platform_provisioner_release_tree_mismatch",
        crddTree: observed.tree,
        distributionFileCount: observed.fileCount,
        distributionByteLength: observed.byteLength,
        manifestExcludedFromSignedGitTree: observed.manifestExcludedFromTree,
        platformAccessExecutableIncludedInSignedGitTree:
          observed.platformAccessExecutableIncludedInTree,
        gitMetadataExcludedFromSignedGitTree:
          observed.gitMetadataExcludedFromTree,
        runtimeMetadataExcludedFromSignedGitTree:
          observed.runtimeMetadataExcludedFromTree,
        trackedRuntimeSettingIncludedInSignedGitTree:
          observed.trackedRuntimeSettingIncludedInTree,
        releaseIdentityRuntimeOwned: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
        filesystemEffectIssued: false,
        networkEffectIssued: false,
      });
    }
    return Object.freeze({
      status: "candidate" as const,
      reason:
        "crdd_distribution_tree_matches_signed_release_identity_candidate",
      crddTree: observed.tree,
      distributionFileCount: observed.fileCount,
      distributionByteLength: observed.byteLength,
      manifestExcludedFromSignedGitTree: observed.manifestExcludedFromTree,
      platformAccessExecutableIncludedInSignedGitTree:
        observed.platformAccessExecutableIncludedInTree,
      gitMetadataExcludedFromSignedGitTree:
        observed.gitMetadataExcludedFromTree,
      runtimeMetadataExcludedFromSignedGitTree:
        observed.runtimeMetadataExcludedFromTree,
      trackedRuntimeSettingIncludedInSignedGitTree:
        observed.trackedRuntimeSettingIncludedInTree,
      releaseIdentityRuntimeOwned: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_provisioner_release_identity_invalid",
      crddTree: null,
      distributionFileCount: null,
      distributionByteLength: null,
      manifestExcludedFromSignedGitTree: false,
      platformAccessExecutableIncludedInSignedGitTree: false,
      gitMetadataExcludedFromSignedGitTree: false,
      runtimeMetadataExcludedFromSignedGitTree: false,
      trackedRuntimeSettingIncludedInSignedGitTree: false,
      releaseIdentityRuntimeOwned: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  }
}

/**
 * Platform Provisioner Release Identity 契約の公開契約を記述する。
 *
 * @responsibility Platform Provisioner Release Identity 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformProvisionerReleaseIdentityContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformProvisionerReleaseIdentityContractの入力契約を満たす。
 * @postcondition describePlatformProvisionerReleaseIdentityContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformProvisionerReleaseIdentityContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformProvisionerReleaseIdentityContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformProvisionerReleaseIdentityContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describePlatformProvisionerReleaseIdentityContractはProcess内の同一Subsystemで完結する。
 * @security describePlatformProvisionerReleaseIdentityContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformProvisionerReleaseIdentityContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformProvisionerReleaseIdentityContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-release-identity",
    contractRevision: 3,
    hashAlgorithms: Object.freeze(["SHA-1", "SHA-256"]),
    gitObjectEncoding: "blob_and_recursive_tree_object_identity",
    regularFileModes: Object.freeze(["100644", "100755"]),
    directoryMode: "40000",
    maximumDistributionFiles: MAXIMUM_DISTRIBUTION_FILES,
    maximumDistributionBytes: MAXIMUM_DISTRIBUTION_BYTES,
    manifestExcludedFromSignedGitTree:
      PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    platformAccessExecutableIncludedInSignedGitTree:
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
    gitMetadataInDistribution:
      "exact_root_git_entry_validated_and_excluded_from_signed_tree",
    runtimeMetadataInDistribution:
      "tracked_external_send_policy_included_and_other_exact_root_crdd_children_excluded",
    symbolicLinkOrReparseFallbackAllowed: false,
    stableSameHandleFileRead: "implemented_candidate",
    checkoutLineEndingIdentity:
      "git_text_auto_canonical_lf_and_raw_bytes_for_binary_artifacts",
    stableDirectoryIdentityRevalidation: "implemented_candidate",
    signedCrddTreeComparison: "implemented_candidate_non_authoritative",
    signedCommitAttestationVerification:
      "requires_fixed_manifest_path_and_pinned_release_signature",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
