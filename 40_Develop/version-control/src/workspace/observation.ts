/**
 * 借用中のWorking Treeを変更せず、File内容とinventoryを安定読取りする。
 * @packageDocumentation
 * @responsibility File実体・容量・Path・linkと読取り前後差を検査する。
 * @trace ARCH-000002 ARCH-000013
 * @boundary Repository Filesystemの読取り。
 * @effect Fileを読取り、Commit・採用・巻戻し・削除を発行しない。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const MAXIMUM_FILE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_WORKSPACE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_WORKSPACE_FILES = 20_000;
const MAXIMUM_ALLOWED_PATH_BYTES = 1_024;
const RESERVED_WINDOWS_SEGMENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_WINDOWS_CHARACTER = /[<>:"|?*\\\x00-\x1f\x7f]/u;
/**
 * repository-workspace-runtimeで使用するInventory Entryの値契約を定義する。
 *
 * @responsibility Inventory EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000013
 * @shape InventoryEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InventoryEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: InventoryEntryの宣言は外部境界を開かない。
 * @security InventoryEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InventoryEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type WorkspaceInventoryEntry = Readonly<{
  relativePath: string;
  byteLength: number;
  sha256: string;
}>;
/**
 * Segmentが有効か判定する。
 *
 * @responsibility Segmentの有効条件、拒否条件、判定結果境界を所有する。
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
 * Relative Pathが有効か判定する。
 *
 * @responsibility Relative Pathの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000013
 * @input relativePath: string
 * @returns isWorkspaceRelativePathの計算結果を返す。
 * @precondition 「relativePath: string」がisWorkspaceRelativePathの入力契約を満たす。
 * @postcondition isWorkspaceRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: isWorkspaceRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isWorkspaceRelativePathは独自の失敗分岐を所有しない。
 * @invariant isWorkspaceRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isWorkspaceRelativePathはProcess内の同一Subsystemで完結する。
 * @security isWorkspaceRelativePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isWorkspaceRelativePathは共有非同期状態を持たない同期処理である。
 */
export function isWorkspaceRelativePath(relativePath: string) {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    Buffer.byteLength(relativePath, "utf8") <= MAXIMUM_ALLOWED_PATH_BYTES &&
    !relativePath.includes("\\") &&
    relativePath.split("/").every(validSegment)
  );
}

/**
 * Fileを安定Identityへ変換する。
 *
 * @responsibility Fileの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000013
 * @input target: string、maximumBytes: number
 * @returns stableFileの計算結果を返す。
 * @precondition 「target: string、maximumBytes: number」がstableFileの入力契約を満たす。
 * @postcondition stableFileの責務を完了した結果だけを返す。
 * @effect stableFileはFileを読取り、descriptorとPathの前後Identityを観測する。
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
 * File Contentを安定Identityへ変換する。
 *
 * @responsibility File Contentの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000013
 * @input target: string、maximumBytes: number
 * @returns readWorkspaceFileContentの計算結果を返す。
 * @precondition 「target: string、maximumBytes: number」がreadWorkspaceFileContentの入力契約を満たす。
 * @postcondition readWorkspaceFileContentの責務を完了した結果だけを返す。
 * @effect readWorkspaceFileContentは内容と実体を読取り、書込みを発行しない。
 * @failure readWorkspaceFileContentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readWorkspaceFileContentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readWorkspaceFileContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readWorkspaceFileContentは共有非同期状態を持たない同期処理である。
 */
export function readWorkspaceFileContent(target: string, maximumBytes: number) {
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
 * inventoryを決定する。
 *
 * @responsibility inventoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000013
 * @input workspace: 対象Tree、borrowed: 既定false。true時はRoot直下.git／.crddを除外し、nested Gitとhardlinkを拒否する。
 * @returns inventoryの計算結果を返す。
 * @precondition 「workspace: string」がinventoryの入力契約を満たす。
 * @postcondition inventoryの責務を完了した結果だけを返す。
 * @effect inventoryはDirectoryとFileを走査し、内容のHashだけを取得する。
 * @failure inventoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inventoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inventoryは上位の許可Path・Secret・Capability判定を代替せず、Authorityを発行しない。
 * @concurrency N/A: inventoryは共有非同期状態を持たない同期処理である。
 */
export function inspectWorkspaceInventory(workspace: string, borrowed = false) {
  const root = fs.realpathSync.native(workspace);
  const rootMetadata = fs.lstatSync(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink())
    throw new Error("repository_workspace_root_invalid");
  const entries: WorkspaceInventoryEntry[] = [];
  const comparisonPaths = new Set<string>();
  let totalBytes = 0;

  /**
   * visitを決定する。
   *
   * @responsibility visitの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000013
   * @input directory: string、parentPath: string、depth: number
   * @returns N/A: visitは戻り値を返さない。
   * @precondition 「directory: string、parentPath: string、depth: number」がvisitの入力契約を満たす。
   * @postcondition visitの責務を完了して呼出し元へ制御を戻す。
   * @effect visitはDirectoryとFileの読取りだけを行う。
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
      if (
        borrowed &&
        !parentPath &&
        [".GIT", ".CRDD"].includes(entry.name.toUpperCase())
      )
        continue;
      if (borrowed && entry.name.toUpperCase() === ".GIT")
        throw new Error("repository_workspace_nested_git_rejected");
      if (!validSegment(entry.name))
        throw new Error("repository_workspace_path_invalid");
      const comparisonName = entry.name.toUpperCase();
      if (comparisonNames.has(comparisonName))
        throw new Error("repository_workspace_case_collision");
      comparisonNames.add(comparisonName);
      const relativePath = parentPath
        ? `${parentPath}/${entry.name}`
        : entry.name;
      if (!isWorkspaceRelativePath(relativePath))
        throw new Error("repository_workspace_path_invalid");
      const target = path.join(directory, entry.name);
      const metadata = fs.lstatSync(target);
      if (borrowed && metadata.isFile() && metadata.nlink !== 1)
        throw new Error("repository_workspace_hardlink_rejected");
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
