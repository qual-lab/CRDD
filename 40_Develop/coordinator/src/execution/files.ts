/**
 * Gitが列挙した実行対象Fileを安定読取りする。
 * @packageDocumentation
 * @responsibility File実体・Path・linkと読取り前後差を検査する。
 * @trace ARCH-000008
 * @trace ARCH-000009
 * @trace ARCH-000013
 * @boundary 上位が確定したGit Worktree。無視された未追跡領域は走査しない。
 * @effect Fileを読取り、Commit・採用・巻戻し・削除を発行しない。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const RESERVED_WINDOWS_SEGMENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_WINDOWS_CHARACTER = /[<>:"|?*\\\x00-\x1f\x7f]/u;
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
 * @returns isExecutionRelativePathの計算結果を返す。
 * @precondition 「relativePath: string」がisExecutionRelativePathの入力契約を満たす。
 * @postcondition isExecutionRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: isExecutionRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isExecutionRelativePathは独自の失敗分岐を所有しない。
 * @invariant isExecutionRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isExecutionRelativePathはProcess内の同一Subsystemで完結する。
 * @security isExecutionRelativePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isExecutionRelativePathは共有非同期状態を持たない同期処理である。
 */
export function isExecutionRelativePath(relativePath: string) {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    !relativePath.includes("\\") &&
    relativePath.split("/").every(validSegment)
  );
}

/**
 * File Contentを安定Identityへ変換する。
 *
 * @responsibility File Contentの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000013
 * @input target: string
 * @returns readExecutionFileの計算結果を返す。
 * @precondition 「target: string」がreadExecutionFileの入力契約を満たす。
 * @postcondition readExecutionFileの責務を完了した結果だけを返す。
 * @effect readExecutionFileは内容と実体を読取り、書込みを発行しない。
 * @failure readExecutionFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readExecutionFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readExecutionFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readExecutionFileは共有非同期状態を持たない同期処理である。
 */
export function readExecutionFile(target: string) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 0n ||
      !Number.isSafeInteger(Number(before.size))
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
