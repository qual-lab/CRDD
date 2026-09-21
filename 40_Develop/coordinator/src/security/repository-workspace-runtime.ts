import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  materializeFixedSnapshotCandidate,
  verifyCandidateOutputDirectory,
} from "../../../version-control/src/fixed-snapshot.ts";
import { gitFixedSnapshotAdapter } from "../../../version-control/src/git/fixed-snapshot-adapter.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";

import { persistRuntimeOwnedCandidateBundle } from "./candidate-bundle-store.ts";
import { verifyOwnedOperationManagementMountBinding } from "./execution-environment.ts";
import {
  borrowRuntimeOwnedRepositorySource,
  verifyRuntimeOwnedRepositoryBindingCapability,
} from "./repository-operation-runtime.ts";
import { containsRecognizedSecretMaterial } from "./secret-material-policy.ts";

export const REPOSITORY_WORKSPACE_RUNTIME_CONTRACT =
  "crdd-coordinator/repository-workspace-runtime";
export const REPOSITORY_WORKSPACE_RUNTIME_CONTRACT_REVISION = 6;

const MAXIMUM_FILE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_WORKSPACE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_WORKSPACE_FILES = 20_000;
const MAXIMUM_CHANGED_PATHS = 1_000;
const MAXIMUM_CANDIDATE_CONTENT_BYTES = 16 * 1024 * 1024;
const MAXIMUM_ALLOWED_PATHS = 64;
const MAXIMUM_ALLOWED_PATH_BYTES = 1_024;
const MAXIMUM_REVIEW_PROJECTION_BYTES = 1024 * 1024;
const MAXIMUM_REVIEW_PROJECTION_FILES = 256;
const RESERVED_WINDOWS_SEGMENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_WINDOWS_CHARACTER = /[<>:"|?*\\\x00-\x1f\x7f]/u;

/**
 * InventoryEntryが扱う値の構造を表す。
 *
 * @responsibility InventoryEntryに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000013
 * @shape InventoryEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InventoryEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: InventoryEntryの宣言は外部境界を開かない。
 * @security InventoryEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InventoryEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InventoryEntry = Readonly<{
  relativePath: string;
  byteLength: number;
  sha256: string;
}>;
/**
 * WorkspaceRecordが扱う値の構造を表す。
 *
 * @responsibility WorkspaceRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000013
 * @shape WorkspaceRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant WorkspaceRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: WorkspaceRecordの宣言は外部境界を開かない。
 * @security WorkspaceRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility WorkspaceRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type WorkspaceRecord = Readonly<{
  managementCapability: object;
  mountCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  baseEntries: ReadonlyMap<string, InventoryEntry>;
}>;
/**
 * CandidateRecordが扱う値の構造を表す。
 *
 * @responsibility CandidateRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000013
 * @shape CandidateRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateRecordの宣言は外部境界を開かない。
 * @security CandidateRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateRecord = Readonly<{
  workspaceRecord: WorkspaceRecord;
  allowedPathsHash: string;
  contentManifestHash: string;
  patchHash: string;
  changedPaths: readonly string[];
}>;

const workspaces = new WeakMap<object, WorkspaceRecord>();
const candidates = new WeakMap<object, CandidateRecord>();

/**
 * validSegmentの処理を実行する。
 *
 * @responsibility validSegmentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input segment: string
 * @returns validSegmentの計算結果を返す。
 * @precondition 「segment: string」がvalidSegmentの入力契約を満たす。
 * @postcondition validSegmentの責務を完了した結果だけを返す。
 * @effect N/A: validSegmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validSegmentは独自の失敗分岐を所有しない。
 * @invariant validSegmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validSegmentはProcess内の同一Subsystemで完結する。
 * @security validSegmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validSegmentは共有非同期状態を持たない同期処理である。
 */
function validSegment(segment: string) {
  return !(
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.toLowerCase() === ".git" ||
    Buffer.byteLength(segment, "utf8") > 255 ||
    INVALID_WINDOWS_CHARACTER.test(segment) ||
    RESERVED_WINDOWS_SEGMENT.test(segment) ||
    segment.endsWith(".") ||
    segment.endsWith(" ")
  );
}

/**
 * validRelativePathの処理を実行する。
 *
 * @responsibility validRelativePathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input relativePath: string
 * @returns validRelativePathの計算結果を返す。
 * @precondition 「relativePath: string」がvalidRelativePathの入力契約を満たす。
 * @postcondition validRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: validRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRelativePathは独自の失敗分岐を所有しない。
 * @invariant validRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRelativePathはProcess内の同一Subsystemで完結する。
 * @security validRelativePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRelativePathは共有非同期状態を持たない同期処理である。
 */
function validRelativePath(relativePath: string) {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    Buffer.byteLength(relativePath, "utf8") <= MAXIMUM_ALLOWED_PATH_BYTES &&
    !relativePath.includes("\\") &&
    relativePath.split("/").every(validSegment)
  );
}

/**
 * stableFileの処理を実行する。
 *
 * @responsibility stableFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input target: string、maximumBytes: number
 * @returns stableFileの計算結果を返す。
 * @precondition 「target: string、maximumBytes: number」がstableFileの入力契約を満たす。
 * @postcondition stableFileの責務を完了した結果だけを返す。
 * @effect stableFileはFilesystemの読取りまたは書込みを実行する。
 * @failure stableFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableFileは共有非同期状態を持たない同期処理である。
 */
function stableFile(target: string, maximumBytes: number) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("repository_workspace_file_invalid");
    }
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let readBytes = 0;
    while (readBytes < Number(before.size)) {
      const readLength = fs.readSync(
        handle,
        buffer,
        0,
        Math.min(buffer.byteLength, Number(before.size) - readBytes),
        readBytes,
      );
      if (readLength <= 0) throw new Error("repository_workspace_file_changed");
      hash.update(buffer.subarray(0, readLength));
      readBytes += readLength;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      throw new Error("repository_workspace_file_changed");
    }
    const current = fs.lstatSync(target, { bigint: true });
    if (
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs
    ) {
      throw new Error("repository_workspace_file_changed");
    }
    return Object.freeze({
      byteLength: Number(before.size),
      sha256: hash.digest("hex"),
    });
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * stableFileContentの処理を実行する。
 *
 * @responsibility stableFileContentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input target: string、maximumBytes: number
 * @returns stableFileContentの計算結果を返す。
 * @precondition 「target: string、maximumBytes: number」がstableFileContentの入力契約を満たす。
 * @postcondition stableFileContentの責務を完了した結果だけを返す。
 * @effect stableFileContentはFilesystemの読取りまたは書込みを実行する。
 * @failure stableFileContentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableFileContentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableFileContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableFileContentは共有非同期状態を持たない同期処理である。
 */
function stableFileContent(target: string, maximumBytes: number) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("repository_workspace_file_invalid");
    }
    const content = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < content.byteLength) {
      const readBytes = fs.readSync(
        handle,
        content,
        offset,
        content.byteLength - offset,
        offset,
      );
      if (readBytes <= 0) throw new Error("repository_workspace_file_changed");
      offset += readBytes;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    const current = fs.lstatSync(target, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs
    ) {
      throw new Error("repository_workspace_file_changed");
    }
    return Object.freeze({
      content,
      byteLength: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * inventoryの処理を実行する。
 *
 * @responsibility inventoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input workspace: string
 * @returns inventoryの計算結果を返す。
 * @precondition 「workspace: string」がinventoryの入力契約を満たす。
 * @postcondition inventoryの責務を完了した結果だけを返す。
 * @effect inventoryはFilesystemの読取りまたは書込みを実行する。
 * @failure inventoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inventoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inventoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inventoryは共有非同期状態を持たない同期処理である。
 */
function inventory(workspace: string) {
  const root = fs.realpathSync.native(workspace);
  const rootMetadata = fs.lstatSync(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink())
    throw new Error("repository_workspace_root_invalid");
  const entries: InventoryEntry[] = [];
  const comparisonPaths = new Set<string>();
  let totalBytes = 0;

  /**
   * visitの処理を実行する。
   *
   * @responsibility visitに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000013
   * @input directory: string、parentPath: string、depth: number
   * @returns N/A: visitは戻り値を返さない。
   * @precondition 「directory: string、parentPath: string、depth: number」がvisitの入力契約を満たす。
   * @postcondition visitの責務を完了して呼出し元へ制御を戻す。
   * @effect visitはFilesystemの読取りまたは書込みを実行する。
   * @failure visitは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant visitは宣言した境界以外へEffectを拡張しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security visitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: visitは共有非同期状態を持たない同期処理である。
   */
  function visit(directory: string, parentPath: string, depth: number) {
    if (depth > 64) throw new Error("repository_workspace_depth_exceeded");
    const directoryEntries = fs.readdirSync(directory, { withFileTypes: true });
    const comparisonNames = new Set<string>();
    for (const entry of directoryEntries) {
      if (!validSegment(entry.name))
        throw new Error("repository_workspace_path_invalid");
      const comparisonName = entry.name.toUpperCase();
      if (comparisonNames.has(comparisonName))
        throw new Error("repository_workspace_case_collision");
      comparisonNames.add(comparisonName);
      const relativePath = parentPath
        ? `${parentPath}/${entry.name}`
        : entry.name;
      if (!validRelativePath(relativePath))
        throw new Error("repository_workspace_path_invalid");
      const target = path.join(directory, entry.name);
      const metadata = fs.lstatSync(target);
      if (metadata.isSymbolicLink())
        throw new Error("repository_workspace_link_rejected");
      if (entry.isDirectory() && metadata.isDirectory()) {
        visit(target, relativePath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !metadata.isFile())
        throw new Error("repository_workspace_entity_rejected");
      const comparisonPath = relativePath.toUpperCase();
      if (comparisonPaths.has(comparisonPath))
        throw new Error("repository_workspace_case_collision");
      comparisonPaths.add(comparisonPath);
      const observed = stableFile(target, MAXIMUM_FILE_BYTES);
      totalBytes += observed.byteLength;
      if (
        entries.length + 1 > MAXIMUM_WORKSPACE_FILES ||
        totalBytes > MAXIMUM_WORKSPACE_BYTES
      ) {
        throw new Error("repository_workspace_budget_exceeded");
      }
      entries.push(
        Object.freeze({
          relativePath,
          byteLength: observed.byteLength,
          sha256: observed.sha256,
        }),
      );
    }
  }

  visit(root, "", 0);
  entries.sort((left, right) =>
    Buffer.from(left.relativePath).compare(Buffer.from(right.relativePath)),
  );
  return Object.freeze(entries);
}

/**
 * manifestHashの処理を実行する。
 *
 * @responsibility manifestHashに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input entries: readonly InventoryEntry[]
 * @returns manifestHashの計算結果を返す。
 * @precondition 「entries: readonly InventoryEntry[]」がmanifestHashの入力契約を満たす。
 * @postcondition manifestHashの責務を完了した結果だけを返す。
 * @effect N/A: manifestHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: manifestHashは独自の失敗分岐を所有しない。
 * @invariant manifestHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: manifestHashはProcess内の同一Subsystemで完結する。
 * @security manifestHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: manifestHashは共有非同期状態を持たない同期処理である。
 */
function manifestHash(entries: readonly InventoryEntry[]) {
  const hash = createHash("sha256").update("crdd-workspace-inventory-v1\0");
  for (const entry of entries) {
    hash
      .update(entry.relativePath)
      .update("\0")
      .update(entry.byteLength.toString())
      .update("\0")
      .update(entry.sha256)
      .update("\0");
  }
  return hash.digest("hex");
}

/**
 * entryMapの処理を実行する。
 *
 * @responsibility entryMapに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input entries: readonly InventoryEntry[]
 * @returns entryMapの計算結果を返す。
 * @precondition 「entries: readonly InventoryEntry[]」がentryMapの入力契約を満たす。
 * @postcondition entryMapの責務を完了した結果だけを返す。
 * @effect N/A: entryMapは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: entryMapは独自の失敗分岐を所有しない。
 * @invariant entryMapは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: entryMapはProcess内の同一Subsystemで完結する。
 * @security entryMapはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: entryMapは共有非同期状態を持たない同期処理である。
 */
function entryMap(entries: readonly InventoryEntry[]) {
  return new Map(entries.map((entry) => [entry.relativePath, entry]));
}

/**
 * allowedPathsの処理を実行する。
 *
 * @responsibility allowedPathsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input rawAllowedPaths: unknown
 * @returns allowedPathsの計算結果を返す。
 * @precondition 「rawAllowedPaths: unknown」がallowedPathsの入力契約を満たす。
 * @postcondition allowedPathsの責務を完了した結果だけを返す。
 * @effect N/A: allowedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure allowedPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant allowedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: allowedPathsはProcess内の同一Subsystemで完結する。
 * @security allowedPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: allowedPathsは共有非同期状態を持たない同期処理である。
 */
function allowedPaths(rawAllowedPaths: unknown) {
  if (
    !Array.isArray(rawAllowedPaths) ||
    rawAllowedPaths.length > MAXIMUM_ALLOWED_PATHS
  )
    return null;
  const normalizedAllowedPaths: string[] = [];
  try {
    const descriptors = Object.getOwnPropertyDescriptors(rawAllowedPaths);
    for (let index = 0; index < rawAllowedPaths.length; index += 1) {
      const descriptor = descriptors[index.toString()];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      )
        return null;
      const isDirectory = descriptor.value.endsWith("/");
      const relativePath = isDirectory
        ? descriptor.value.slice(0, -1)
        : descriptor.value;
      if (!validRelativePath(relativePath)) return null;
      normalizedAllowedPaths.push(
        isDirectory ? `${relativePath}/` : relativePath,
      );
    }
  } catch {
    return null;
  }
  const uniqueAllowedPaths = [...new Set(normalizedAllowedPaths)].sort(
    (left, right) => Buffer.from(left).compare(Buffer.from(right)),
  );
  return uniqueAllowedPaths.length === normalizedAllowedPaths.length &&
    uniqueAllowedPaths.length > 0
    ? Object.freeze(uniqueAllowedPaths)
    : null;
}

/**
 * isAllowedの処理を実行する。
 *
 * @responsibility isAllowedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input relativePath: string、paths: readonly string[]
 * @returns isAllowedの計算結果を返す。
 * @precondition 「relativePath: string、paths: readonly string[]」がisAllowedの入力契約を満たす。
 * @postcondition isAllowedの責務を完了した結果だけを返す。
 * @effect N/A: isAllowedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isAllowedは独自の失敗分岐を所有しない。
 * @invariant isAllowedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isAllowedはProcess内の同一Subsystemで完結する。
 * @security isAllowedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isAllowedは共有非同期状態を持たない同期処理である。
 */
function isAllowed(relativePath: string, paths: readonly string[]) {
  return paths.some((allowedPath) =>
    allowedPath.endsWith("/")
      ? relativePath.startsWith(allowedPath)
      : relativePath === allowedPath,
  );
}

/**
 * changedPathsの処理を実行する。
 *
 * @responsibility changedPathsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input baseEntries: ReadonlyMap<string, InventoryEntry>、currentEntries: ReadonlyMap<string, InventoryEntry>
 * @returns changedPathsの計算結果を返す。
 * @precondition 「baseEntries: ReadonlyMap<string, InventoryEntry>、currentEntries: ReadonlyMap<string, InventoryEntry>」がchangedPathsの入力契約を満たす。
 * @postcondition changedPathsの責務を完了した結果だけを返す。
 * @effect N/A: changedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: changedPathsは独自の失敗分岐を所有しない。
 * @invariant changedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: changedPathsはProcess内の同一Subsystemで完結する。
 * @security changedPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: changedPathsは共有非同期状態を持たない同期処理である。
 */
function changedPaths(
  baseEntries: ReadonlyMap<string, InventoryEntry>,
  currentEntries: ReadonlyMap<string, InventoryEntry>,
) {
  const paths = new Set([...baseEntries.keys(), ...currentEntries.keys()]);
  return [...paths]
    .filter((relativePath) => {
      const before = baseEntries.get(relativePath);
      const after = currentEntries.get(relativePath);
      return (
        !before ||
        !after ||
        before.byteLength !== after.byteLength ||
        before.sha256 !== after.sha256
      );
    })
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

/**
 * materializeRuntimeOwnedRepositoryWorkspaceの処理を実行する。
 *
 * @responsibility materializeRuntimeOwnedRepositoryWorkspaceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown
 * @returns materializeRuntimeOwnedRepositoryWorkspaceの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown」がmaterializeRuntimeOwnedRepositoryWorkspaceの入力契約を満たす。
 * @postcondition materializeRuntimeOwnedRepositoryWorkspaceの責務を完了した結果だけを返す。
 * @effect N/A: materializeRuntimeOwnedRepositoryWorkspaceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure materializeRuntimeOwnedRepositoryWorkspaceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant materializeRuntimeOwnedRepositoryWorkspaceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: materializeRuntimeOwnedRepositoryWorkspaceはProcess内の同一Subsystemで完結する。
 * @security materializeRuntimeOwnedRepositoryWorkspaceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: materializeRuntimeOwnedRepositoryWorkspaceは共有非同期状態を持たない同期処理である。
 */
export function materializeRuntimeOwnedRepositoryWorkspace(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawReadPaths?: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !mountCapability ||
      typeof mountCapability !== "object"
    ) {
      return null;
    }
    const source = borrowRuntimeOwnedRepositorySource(
      repositoryBindingCapability,
      managementCapability,
    );
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    if (!source || source.operationId !== binding.operationId) return null;
    const readPaths =
      rawReadPaths === undefined ? null : allowedPaths(rawReadPaths);
    if (rawReadPaths !== undefined && !readPaths) return null;
    const verified = verifyRepositoryRoot(source.repositoryRoot);
    if (verified.status !== "completed") return null;
    const output = verifyCandidateOutputDirectory(
      binding.mounts.workspace,
      mountCapability,
      binding.mounts.workspace,
    );
    if (output.status !== "completed")
      return Object.freeze({
        status: "blocked" as const,
        reason: "repository_workspace_candidate_output_invalid" as const,
        effectIssued: false,
        effectStateUnknown: false,
        cleanupConfirmed: true,
        recoveryReference: null,
        pathReported: false,
      });
    const materialized = materializeFixedSnapshotCandidate(
      verified.capability,
      source.revision,
      mountCapability,
      output.capability,
      readPaths,
      containsRecognizedSecretMaterial,
      gitFixedSnapshotAdapter,
    );
    if (!materialized) return null;
    if (materialized.status === "blocked") {
      return Object.freeze({
        status: "blocked" as const,
        reason:
          materialized.reason === "fixed_snapshot_content_policy_rejected"
            ? ("repository_read_projection_recognized_secret_rejected" as const)
            : materialized.reason,
        effectIssued: materialized.effectIssued,
        effectStateUnknown: materialized.effectStateUnknown,
        cleanupConfirmed: materialized.cleanupConfirmed,
        recoveryReference:
          materialized.effectStateUnknown || !materialized.cleanupConfirmed
            ? `repository-workspace.${binding.operationId}`
            : null,
        pathReported: false,
      });
    }
    const verifiedRepository = verifyRuntimeOwnedRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    if (!verifiedRepository) return null;
    const baseInventory = inventory(binding.mounts.workspace);
    const baseManifestHash = manifestHash(baseInventory);
    const workspaceCapability = Object.freeze({});
    const workspaceRecord = Object.freeze({
      managementCapability,
      mountCapability,
      repositoryBindingCapability,
      operationId: binding.operationId,
      baseCommit: materialized.baseRevisionIdentity,
      baseTree: materialized.baseSnapshotIdentity,
      baseManifestHash,
      baseEntries: entryMap(baseInventory),
    });
    workspaces.set(workspaceCapability, workspaceRecord);
    return Object.freeze({
      status: "materialized" as const,
      operationId: binding.operationId,
      baseCommit: workspaceRecord.baseCommit,
      baseTree: workspaceRecord.baseTree,
      baseManifestHash,
      fileCount: baseInventory.length,
      readProjectionHash: readPaths
        ? createHash("sha256")
            .update("crdd-read-projection-v1\0")
            .update(readPaths.join("\0"))
            .digest("hex")
        : null,
      workspaceCapability,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * currentWorkspaceRecordの処理を実行する。
 *
 * @responsibility currentWorkspaceRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown
 * @returns currentWorkspaceRecordの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown」がcurrentWorkspaceRecordの入力契約を満たす。
 * @postcondition currentWorkspaceRecordの責務を完了した結果だけを返す。
 * @effect N/A: currentWorkspaceRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: currentWorkspaceRecordは独自の失敗分岐を所有しない。
 * @invariant currentWorkspaceRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: currentWorkspaceRecordはProcess内の同一Subsystemで完結する。
 * @security currentWorkspaceRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentWorkspaceRecordは共有非同期状態を持たない同期処理である。
 */
function currentWorkspaceRecord(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
) {
  if (
    !workspaceCapability ||
    typeof workspaceCapability !== "object" ||
    !repositoryBindingCapability ||
    typeof repositoryBindingCapability !== "object" ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !mountCapability ||
    typeof mountCapability !== "object"
  ) {
    return null;
  }
  const workspaceRecord = workspaces.get(workspaceCapability);
  if (
    !workspaceRecord ||
    workspaceRecord.managementCapability !== managementCapability ||
    workspaceRecord.mountCapability !== mountCapability ||
    workspaceRecord.repositoryBindingCapability !== repositoryBindingCapability
  ) {
    return null;
  }
  const repository = verifyRuntimeOwnedRepositoryBindingCapability(
    repositoryBindingCapability,
    managementCapability,
  );
  const binding = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  );
  return repository?.revision === workspaceRecord.baseCommit &&
    binding.operationId === workspaceRecord.operationId
    ? Object.freeze({ workspaceRecord, workspace: binding.mounts.workspace })
    : null;
}

/**
 * captureRuntimeOwnedCandidateRevisionの処理を実行する。
 *
 * @responsibility captureRuntimeOwnedCandidateRevisionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawAllowedPaths: unknown
 * @returns captureRuntimeOwnedCandidateRevisionの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawAllowedPaths: unknown」がcaptureRuntimeOwnedCandidateRevisionの入力契約を満たす。
 * @postcondition captureRuntimeOwnedCandidateRevisionの責務を完了した結果だけを返す。
 * @effect N/A: captureRuntimeOwnedCandidateRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure captureRuntimeOwnedCandidateRevisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant captureRuntimeOwnedCandidateRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: captureRuntimeOwnedCandidateRevisionはProcess内の同一Subsystemで完結する。
 * @security captureRuntimeOwnedCandidateRevisionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: captureRuntimeOwnedCandidateRevisionは共有非同期状態を持たない同期処理である。
 */
export function captureRuntimeOwnedCandidateRevision(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawAllowedPaths: unknown,
) {
  try {
    const current = currentWorkspaceRecord(
      workspaceCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    const normalizedAllowedPaths = allowedPaths(rawAllowedPaths);
    if (!current || !normalizedAllowedPaths) return null;
    const currentInventory = inventory(current.workspace);
    const currentEntries = entryMap(currentInventory);
    const changes = changedPaths(
      current.workspaceRecord.baseEntries,
      currentEntries,
    );
    if (
      changes.length > MAXIMUM_CHANGED_PATHS ||
      changes.some(
        (relativePath) => !isAllowed(relativePath, normalizedAllowedPaths),
      )
    ) {
      return null;
    }
    for (const relativePath of changes) {
      const inventoryEntry = currentEntries.get(relativePath);
      if (!inventoryEntry) {
        if (containsRecognizedSecretMaterial(relativePath, "")) {
          return Object.freeze({
            status: "blocked" as const,
            reason: "candidate_recognized_secret_rejected" as const,
            pathReported: false,
            canonicalRepositoryChanged: false,
          });
        }
        continue;
      }
      const observed = stableFileContent(
        path.join(current.workspace, ...relativePath.split("/")),
        MAXIMUM_FILE_BYTES,
      );
      if (
        observed.byteLength !== inventoryEntry.byteLength ||
        observed.sha256 !== inventoryEntry.sha256
      ) {
        return null;
      }
      if (containsRecognizedSecretMaterial(relativePath, observed.content)) {
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_recognized_secret_rejected" as const,
          pathReported: false,
          canonicalRepositoryChanged: false,
        });
      }
    }
    const contentManifestHash = manifestHash(currentInventory);
    const allowedPathsHash = createHash("sha256")
      .update("crdd-allowed-paths-v1\0")
      .update(normalizedAllowedPaths.join("\0"))
      .digest("hex");
    const patchHash = createHash("sha256")
      .update("crdd-candidate-revision-v1\0")
      .update(current.workspaceRecord.baseCommit)
      .update("\0")
      .update(current.workspaceRecord.baseTree)
      .update("\0")
      .update(current.workspaceRecord.baseManifestHash)
      .update("\0")
      .update(contentManifestHash)
      .update("\0")
      .update(allowedPathsHash)
      .update("\0")
      .update(changes.join("\0"))
      .digest("hex");
    const candidateCapability = Object.freeze({});
    const record = Object.freeze({
      workspaceRecord: current.workspaceRecord,
      allowedPathsHash,
      contentManifestHash,
      patchHash,
      changedPaths: Object.freeze(changes),
    });
    candidates.set(candidateCapability, record);
    return Object.freeze({
      status: "candidate" as const,
      operationId: current.workspaceRecord.operationId,
      baseCommit: current.workspaceRecord.baseCommit,
      baseTree: current.workspaceRecord.baseTree,
      patchHash,
      contentManifestHash,
      allowedPathsHash,
      changedPaths: record.changedPaths,
      candidateCapability,
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

/**
 * projectRuntimeOwnedCandidateReadContentの処理を実行する。
 *
 * @responsibility projectRuntimeOwnedCandidateReadContentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input workspaceCapability: unknown、candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown
 * @returns projectRuntimeOwnedCandidateReadContentの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown」がprojectRuntimeOwnedCandidateReadContentの入力契約を満たす。
 * @postcondition projectRuntimeOwnedCandidateReadContentの責務を完了した結果だけを返す。
 * @effect N/A: projectRuntimeOwnedCandidateReadContentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectRuntimeOwnedCandidateReadContentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectRuntimeOwnedCandidateReadContentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectRuntimeOwnedCandidateReadContentはProcess内の同一Subsystemで完結する。
 * @security projectRuntimeOwnedCandidateReadContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectRuntimeOwnedCandidateReadContentは共有非同期状態を持たない同期処理である。
 */
export function projectRuntimeOwnedCandidateReadContent(
  workspaceCapability: unknown,
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawReadPaths: unknown,
) {
  try {
    if (!candidateCapability || typeof candidateCapability !== "object")
      return null;
    const current = currentWorkspaceRecord(
      workspaceCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    const candidate = candidates.get(candidateCapability);
    const readPaths = allowedPaths(rawReadPaths);
    if (!current || !candidate || !readPaths) return null;
    if (candidate.workspaceRecord !== current.workspaceRecord) return null;

    const currentInventory = inventory(current.workspace);
    if (manifestHash(currentInventory) !== candidate.contentManifestHash)
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_read_projection_identity_mismatch" as const,
      });

    const selectedEntries = currentInventory.filter((entry) =>
      isAllowed(entry.relativePath, readPaths),
    );
    if (selectedEntries.length > MAXIMUM_REVIEW_PROJECTION_FILES)
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_read_projection_budget_exceeded" as const,
      });

    let totalBytes = 0;
    const files: Readonly<Record<string, unknown>>[] = [];
    for (const entry of selectedEntries) {
      totalBytes += entry.byteLength;
      if (totalBytes > MAXIMUM_REVIEW_PROJECTION_BYTES)
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_read_projection_budget_exceeded" as const,
        });
      const observed = stableFileContent(
        path.join(current.workspace, ...entry.relativePath.split("/")),
        MAXIMUM_REVIEW_PROJECTION_BYTES,
      );
      if (
        observed.byteLength !== entry.byteLength ||
        observed.sha256 !== entry.sha256
      ) {
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_read_projection_identity_mismatch" as const,
        });
      }
      const content = new TextDecoder("utf-8", { fatal: true }).decode(
        observed.content,
      );
      if (containsRecognizedSecretMaterial(entry.relativePath, content))
        return Object.freeze({
          status: "blocked" as const,
          reason:
            "candidate_read_projection_recognized_secret_rejected" as const,
        });
      files.push(
        Object.freeze({
          path: entry.relativePath,
          state: "present",
          byteLength: entry.byteLength,
          sha256: entry.sha256,
          encoding: "utf-8",
          content,
        }),
      );
    }
    for (const readPath of readPaths) {
      if (
        !readPath.endsWith("/") &&
        !selectedEntries.some((entry) => entry.relativePath === readPath)
      ) {
        files.push(Object.freeze({ path: readPath, state: "absent" }));
      }
    }
    files.sort((left, right) =>
      Buffer.from(String(left.path)).compare(Buffer.from(String(right.path))),
    );
    const projectionHash = createHash("sha256")
      .update("crdd-candidate-read-projection-v1\0")
      .update(candidate.patchHash)
      .update("\0")
      .update(JSON.stringify(files))
      .digest("hex");
    return Object.freeze({
      status: "projected" as const,
      candidatePatchHash: candidate.patchHash,
      candidateContentManifestHash: candidate.contentManifestHash,
      projectionHash,
      totalBytes,
      files: Object.freeze(files),
    });
  } catch {
    return null;
  }
}

/**
 * verifyRuntimeOwnedCandidateRevisionの処理を実行する。
 *
 * @responsibility verifyRuntimeOwnedCandidateRevisionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown
 * @returns verifyRuntimeOwnedCandidateRevisionの計算結果を返す。
 * @precondition 「candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown」がverifyRuntimeOwnedCandidateRevisionの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedCandidateRevisionの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedCandidateRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedCandidateRevisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedCandidateRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedCandidateRevisionはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedCandidateRevisionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedCandidateRevisionは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedCandidateRevision(
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
) {
  try {
    if (!candidateCapability || typeof candidateCapability !== "object")
      return null;
    const record = candidates.get(candidateCapability);
    if (
      !record ||
      record.workspaceRecord.repositoryBindingCapability !==
        repositoryBindingCapability ||
      record.workspaceRecord.managementCapability !== managementCapability ||
      record.workspaceRecord.mountCapability !== mountCapability ||
      !verifyRuntimeOwnedRepositoryBindingCapability(
        repositoryBindingCapability,
        managementCapability,
      )
    ) {
      return null;
    }
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    const currentInventory = inventory(binding.mounts.workspace);
    if (manifestHash(currentInventory) !== record.contentManifestHash)
      return null;
    return Object.freeze({
      status: "verified" as const,
      operationId: record.workspaceRecord.operationId,
      baseCommit: record.workspaceRecord.baseCommit,
      baseTree: record.workspaceRecord.baseTree,
      patchHash: record.patchHash,
      contentManifestHash: record.contentManifestHash,
      allowedPathsHash: record.allowedPathsHash,
      changedPaths: record.changedPaths,
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

/**
 * persistRuntimeOwnedCandidateRevisionの処理を実行する。
 *
 * @responsibility persistRuntimeOwnedCandidateRevisionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、persistencePolicy: unknown
 * @returns persistRuntimeOwnedCandidateRevisionの計算結果を返す。
 * @precondition 「candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、persistencePolicy: unknown」がpersistRuntimeOwnedCandidateRevisionの入力契約を満たす。
 * @postcondition persistRuntimeOwnedCandidateRevisionの責務を完了した結果だけを返す。
 * @effect N/A: persistRuntimeOwnedCandidateRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistRuntimeOwnedCandidateRevisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistRuntimeOwnedCandidateRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistRuntimeOwnedCandidateRevisionはProcess内の同一Subsystemで完結する。
 * @security persistRuntimeOwnedCandidateRevisionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistRuntimeOwnedCandidateRevisionは共有非同期状態を持たない同期処理である。
 */
export function persistRuntimeOwnedCandidateRevision(
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  persistencePolicy: unknown,
) {
  try {
    if (!candidateCapability || typeof candidateCapability !== "object")
      return null;
    const record = candidates.get(candidateCapability);
    if (
      !record ||
      record.workspaceRecord.repositoryBindingCapability !==
        repositoryBindingCapability ||
      record.workspaceRecord.managementCapability !== managementCapability ||
      record.workspaceRecord.mountCapability !== mountCapability ||
      !verifyRuntimeOwnedRepositoryBindingCapability(
        repositoryBindingCapability,
        managementCapability,
      )
    ) {
      return null;
    }
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    const currentInventory = inventory(binding.mounts.workspace);
    const currentEntries = entryMap(currentInventory);
    if (manifestHash(currentInventory) !== record.contentManifestHash)
      return null;
    let totalBytes = 0;
    const entries = [];
    for (const relativePath of record.changedPaths) {
      const inventoryEntry = currentEntries.get(relativePath);
      if (!inventoryEntry) {
        entries.push(
          Object.freeze({
            relativePath,
            operation: "delete" as const,
            byteLength: 0,
            sha256: null,
            contentBase64: null,
          }),
        );
        continue;
      }
      const remainingBytes = MAXIMUM_CANDIDATE_CONTENT_BYTES - totalBytes;
      if (remainingBytes < 0) return null;
      const observed = stableFileContent(
        path.join(binding.mounts.workspace, ...relativePath.split("/")),
        Math.min(MAXIMUM_FILE_BYTES, remainingBytes),
      );
      if (
        observed.byteLength !== inventoryEntry.byteLength ||
        observed.sha256 !== inventoryEntry.sha256
      ) {
        return null;
      }
      totalBytes += observed.byteLength;
      entries.push(
        Object.freeze({
          relativePath,
          operation: "upsert" as const,
          byteLength: observed.byteLength,
          sha256: observed.sha256,
          contentBase64: observed.content.toString("base64"),
        }),
      );
    }
    const persisted = persistRuntimeOwnedCandidateBundle(
      Object.freeze({
        schema: "crdd-coordinator-candidate-bundle/v1",
        baseCommit: record.workspaceRecord.baseCommit,
        baseTree: record.workspaceRecord.baseTree,
        baseManifestHash: record.workspaceRecord.baseManifestHash,
        patchHash: record.patchHash,
        contentManifestHash: record.contentManifestHash,
        allowedPathsHash: record.allowedPathsHash,
        changedPaths: record.changedPaths,
        entries: Object.freeze(entries),
      }),
      persistencePolicy,
      managementCapability,
    );
    if (!persisted) return null;
    if (persisted.status !== "staged") return persisted;
    return Object.freeze({
      status: "staged" as const,
      candidateRecoveryId: persisted.candidateRecoveryId,
      bundleHash: persisted.bundleHash,
      byteLength: persisted.byteLength,
      expiresAtMs: persisted.expiresAtMs,
      hostPathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

/**
 * describeRepositoryWorkspaceRuntimeContractの処理を実行する。
 *
 * @responsibility describeRepositoryWorkspaceRuntimeContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000013
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRepositoryWorkspaceRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRepositoryWorkspaceRuntimeContractの入力契約を満たす。
 * @postcondition describeRepositoryWorkspaceRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRepositoryWorkspaceRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRepositoryWorkspaceRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeRepositoryWorkspaceRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRepositoryWorkspaceRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeRepositoryWorkspaceRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRepositoryWorkspaceRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeRepositoryWorkspaceRuntimeContract() {
  return Object.freeze({
    contract: REPOSITORY_WORKSPACE_RUNTIME_CONTRACT,
    contractRevision: REPOSITORY_WORKSPACE_RUNTIME_CONTRACT_REVISION,
    source: "exact_head_commit_tree_without_external_git_cli",
    providerReadProjection:
      "explicit_file_or_directory_prefix_plus_write_scope",
    reviewerReadProjection:
      "candidate_identity_bound_explicit_utf8_content_maximum_1_mib_without_provider_filesystem_tool",
    reviewerContentProjection:
      "candidate_identity_bound_utf8_content_for_explicit_read_paths_with_secret_and_size_guards",
    recognizedSecretMaterial:
      "rejected_before_provider_visible_workspace_materialization",
    completeSecretAbsenceVerified: false,
    providerGitMetadataVisible: false,
    workspaceWrite: "isolated_runtime_owned_only",
    allowedPathGuard: "exact_file_or_directory_prefix_fail_closed",
    candidateRevision: Object.freeze([
      "base_commit",
      "base_tree",
      "patch_hash",
      "content_manifest_hash",
      "allowed_paths_hash",
    ]),
    approvedCandidateTransfer:
      "policy_bounded_staged_bundle_published_only_after_operation_cleanup",
    canonicalRepositoryWriteAllowed: false,
    pathReported: false,
  });
}
