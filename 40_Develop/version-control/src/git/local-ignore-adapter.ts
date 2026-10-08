/**
 * 検証済みRepositoryのローカル除外設定を原子的に更新する。
 *
 * @responsibility 除外内容の生成、所有Lock、保存確定、readback、失敗時のEffectと清掃結果を所有する。
 * @trace ARCH-000002
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { RepositoryLocalIgnoreAdapter } from "../repository/local-ignore.ts";
import {
  resolveRepositoryGitLayout,
  type EntitySnapshot,
  type RepositoryGitLayout,
  REPOSITORY_GIT_EXCLUDE_MAX_BYTES as MAX_EXCLUDE_FILE_BYTES,
  decodeUtf8,
  identity,
  isEnoent,
  readStableFileBytes,
  sameIdentity,
  verifyEntitySnapshot,
  verifyLayoutForWrite,
  verifySnapshot,
} from "./layout.ts";

export const gitRepositoryLocalIgnoreAdapter: RepositoryLocalIgnoreAdapter = (
  repositoryRoot,
  entry,
) => {
  try {
    return writeRepositoryLocalExclude(
      resolveRepositoryGitLayout(repositoryRoot),
      entry,
    );
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_local_ignore_update_blocked" as const,
      effectIssued: false,
      effectConfirmation: "not_issued" as const,
      cleanupConfirmed: true,
    });
  }
};

/**
 * Excludeを検証済み値へ復号する。
 *
 * @responsibility Excludeの入力形式、復号結果、不正byte列の拒否境界を所有する。
 * @trace ARCH-000002
 * @input bytes: Uint8Array
 * @returns stringを返す。
 * @precondition 「bytes: Uint8Array」がdecodeExcludeの入力契約を満たす。
 * @postcondition decodeExcludeの責務を完了した結果だけを返す。
 * @effect N/A: decodeExcludeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodeExcludeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodeExcludeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeExcludeはProcess内の同一Subsystemで完結する。
 * @security N/A: decodeExcludeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodeExcludeは共有非同期状態を持たない同期処理である。
 */
function decodeExclude(bytes: Uint8Array): string {
  const text = decodeUtf8(bytes, "repository_git_exclude_invalid");
  if (/\r(?!\n)/u.test(text)) throw new Error("repository_git_exclude_invalid");
  return text;
}

/**
 * Entry Presentが完全一致するか判定する。
 *
 * @responsibility Entry Presentの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000002
 * @input text: string、entry: string
 * @returns booleanを返す。
 * @precondition 「text: string、entry: string」がexactEntryPresentの入力契約を満たす。
 * @postcondition exactEntryPresentの責務を完了した結果だけを返す。
 * @effect N/A: exactEntryPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactEntryPresentは独自の失敗分岐を所有しない。
 * @invariant exactEntryPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactEntryPresentはProcess内の同一Subsystemで完結する。
 * @security N/A: exactEntryPresentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactEntryPresentは共有非同期状態を持たない同期処理である。
 */
function exactEntryPresent(text: string, entry: string): boolean {
  return text.split(/\r?\n/u).some((line) => line === entry);
}

/**
 * desired Exclude Bytesを決定する。
 *
 * @responsibility desired Exclude Bytesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000002
 * @input existing: Buffer、entry: string
 * @returns Readonly<{ changed: boolean; bytes: Buffer }>を返す。
 * @precondition 「existing: Buffer、entry: string」がdesiredExcludeBytesの入力契約を満たす。
 * @postcondition desiredExcludeBytesの責務を完了した結果だけを返す。
 * @effect N/A: desiredExcludeBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure desiredExcludeBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant desiredExcludeBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: desiredExcludeBytesはProcess内の同一Subsystemで完結する。
 * @security N/A: desiredExcludeBytesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: desiredExcludeBytesは共有非同期状態を持たない同期処理である。
 */
function desiredExcludeBytes(
  existing: Buffer,
  entry: string,
): Readonly<{ changed: boolean; bytes: Buffer }> {
  const text = decodeExclude(existing);
  if (exactEntryPresent(text, entry))
    return Object.freeze({ changed: false, bytes: Buffer.from(existing) });
  const separator =
    existing.length === 0 || existing.at(-1) === 0x0a ? "" : "\n";
  const bytes = Buffer.concat([
    existing,
    Buffer.from(`${separator}${entry}\n`, "utf8"),
  ]);
  if (bytes.length > MAX_EXCLUDE_FILE_BYTES)
    throw new Error("repository_git_exclude_too_large");
  return Object.freeze({ changed: true, bytes });
}

/**
 * Unlink 所有を安全条件の下で処理する。
 *
 * @responsibility Unlink 所有の安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000002
 * @input target: string、snapshot: EntitySnapshot
 * @returns booleanを返す。
 * @precondition 「target: string、snapshot: EntitySnapshot」がsafeUnlinkOwnedの入力契約を満たす。
 * @postcondition safeUnlinkOwnedの責務を完了した結果だけを返す。
 * @effect safeUnlinkOwnedはFilesystemの読取りまたは書込みを実行する。
 * @failure safeUnlinkOwnedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant safeUnlinkOwnedは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: safeUnlinkOwnedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: safeUnlinkOwnedは共有非同期状態を持たない同期処理である。
 */
function safeUnlinkOwned(target: string, snapshot: EntitySnapshot): boolean {
  try {
    verifyEntitySnapshot(snapshot);
    fs.unlinkSync(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * RepositoryGitExcludeUpdateErrorが担う状態と操作を提供する。
 *
 * @responsibility RepositoryGitExcludeUpdateErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000002
 * @construction RepositoryGitExcludeUpdateErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle RepositoryGitExcludeUpdateErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: RepositoryGitExcludeUpdateErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: RepositoryGitExcludeUpdateErrorの宣言自体は実行時失敗を所有しない。
 * @invariant RepositoryGitExcludeUpdateErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryGitExcludeUpdateErrorの宣言は外部境界を開かない。
 * @security N/A: RepositoryGitExcludeUpdateErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: RepositoryGitExcludeUpdateErrorは共有非同期状態を持たない同期処理である。
 */
class RepositoryGitExcludeUpdateError extends Error {
  readonly writeIssued: boolean;
  readonly cleanupConfirmed: boolean;

  constructor(hasWriteIssued: boolean, cleanupConfirmed: boolean) {
    super("repository_git_exclude_update_blocked");
    this.writeIssued = hasWriteIssued;
    this.cleanupConfirmed = cleanupConfirmed;
  }
}

/**
 * repository-local-ignore-adapterで使用するRepository Local Exclude Write 結果の値契約を定義する。
 *
 * @responsibility Repository Local Exclude Write 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryLocalExcludeWriteResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryLocalExcludeWriteResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryLocalExcludeWriteResultの宣言は外部境界を開かない。
 * @security N/A: RepositoryLocalExcludeWriteResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryLocalExcludeWriteResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryLocalExcludeWriteResult =
  | Readonly<{
      status: "completed";
      changed: boolean;
      beforeContentIdentity: string;
      afterContentIdentity: string;
      effectIssued: boolean;
      effectConfirmation: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_local_ignore_update_blocked";
      effectIssued: boolean;
      effectConfirmation: "not_issued" | "unknown";
      cleanupConfirmed: boolean;
    }>;

/**
 * repository-local-ignore-adapterで使用するRepository Local Exclude Phaseの値契約を定義する。
 *
 * @responsibility Repository Local Exclude PhaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryLocalExcludePhaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryLocalExcludePhaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryLocalExcludePhaseの宣言は外部境界を開かない。
 * @security N/A: RepositoryLocalExcludePhaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryLocalExcludePhaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RepositoryLocalExcludePhase =
  | "lock_open"
  | "write"
  | "fsync"
  | "close"
  | "rename"
  | "post_rename_readback"
  | "post_readback";

/**
 * content Identityを決定する。
 *
 * @responsibility content Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000002
 * @input bytes: Uint8Array
 * @returns stringを返す。
 * @precondition 「bytes: Uint8Array」がcontentIdentityの入力契約を満たす。
 * @postcondition contentIdentityの責務を完了した結果だけを返す。
 * @effect N/A: contentIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: contentIdentityは独自の失敗分岐を所有しない。
 * @invariant contentIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: contentIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: contentIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: contentIdentityは共有非同期状態を持たない同期処理である。
 */
function contentIdentity(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Repository Local Exclude Internalを書き込む。
 *
 * @responsibility Repository Local Exclude Internalの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000002
 * @input layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null
 * @returns Exclude<RepositoryLocalExcludeWriteResult, { status: "blocked" }>を返す。
 * @precondition 「layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null」がwriteRepositoryLocalExcludeInternalの入力契約を満たす。
 * @postcondition writeRepositoryLocalExcludeInternalの責務を完了した結果だけを返す。
 * @effect writeRepositoryLocalExcludeInternalはFilesystemの読取りまたは書込みを実行する。
 * @failure writeRepositoryLocalExcludeInternalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeRepositoryLocalExcludeInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeRepositoryLocalExcludeInternalはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeRepositoryLocalExcludeInternalは共有非同期状態を持たない同期処理である。
 */
function writeRepositoryLocalExcludeInternal(
  layout: RepositoryGitLayout,
  entry: unknown,
  phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null,
): Exclude<RepositoryLocalExcludeWriteResult, { status: "blocked" }> {
  if (typeof entry !== "string" || entry.length === 0) {
    throw new Error("repository_git_exclude_entry_required");
  }
  if (!layout.infoDirectory)
    throw new Error("repository_git_info_directory_required");
  verifyLayoutForWrite(layout);
  const excludePath = path.join(layout.infoDirectory.realPath, "exclude");
  let existing: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let originalSnapshot: EntitySnapshot | null = null;
  try {
    const read = readStableFileBytes(
      excludePath,
      MAX_EXCLUDE_FILE_BYTES,
      [layout.commonDirectory, layout.infoDirectory],
      true,
    );
    existing = read.value;
    originalSnapshot = read.snapshot;
    if (
      layout.excludeSnapshot &&
      !sameIdentity(layout.excludeSnapshot.identity, originalSnapshot.identity)
    ) {
      throw new Error("repository_git_exclude_changed");
    }
  } catch (error) {
    if (!isEnoent(error) || layout.excludeSnapshot) throw error;
  }
  const desired = desiredExcludeBytes(existing, entry);
  if (!desired.changed) {
    verifyLayoutForWrite(layout);
    if (originalSnapshot) verifySnapshot(originalSnapshot);
    const identity = contentIdentity(existing);
    return Object.freeze({
      status: "completed" as const,
      changed: false,
      beforeContentIdentity: identity,
      afterContentIdentity: identity,
      effectIssued: false,
      effectConfirmation: "confirmed" as const,
      cleanupConfirmed: true as const,
    });
  }
  const lockPath = path.join(
    layout.infoDirectory.realPath,
    ".crdd-runtime-exclude.lock",
  );
  let descriptor: number | null = null;
  let lockCreated = false;
  let lockSnapshot: EntitySnapshot | null = null;
  let hasRenamed = false;
  let failure: unknown = null;
  try {
    const mode = originalSnapshot
      ? Number(originalSnapshot.identity.mode & 0o777n)
      : 0o600;
    phaseHook?.("lock_open");
    descriptor = fs.openSync(
      lockPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      mode,
    );
    lockCreated = true;
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const openedPath = identity(
      fs.lstatSync(lockPath, { bigint: true }),
      "file",
    );
    if (!sameIdentity(opened, openedPath))
      throw new Error("repository_git_exclude_lock_changed");
    lockSnapshot = Object.freeze({
      realPath: fs.realpathSync.native(lockPath),
      identity: opened,
    });
    let offset = 0;
    phaseHook?.("write");
    while (offset < desired.bytes.length) {
      const count = fs.writeSync(
        descriptor,
        desired.bytes,
        offset,
        desired.bytes.length - offset,
        null,
      );
      if (count <= 0) throw new Error("repository_git_exclude_write_failed");
      offset += count;
    }
    phaseHook?.("fsync");
    fs.fsyncSync(descriptor);
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(
      fs.lstatSync(lockPath, { bigint: true }),
      "file",
    );
    // This handle has written the file, so timestamps are not final yet.
    // Both observations must still describe the original object/permissions
    // and exact size; content and final timestamps are checked after close.
    for (const observed of [after, pathAfter]) {
      if (
        observed.type !== opened.type ||
        observed.dev !== opened.dev ||
        observed.ino !== opened.ino ||
        observed.birthtimeNs !== opened.birthtimeNs ||
        observed.mode !== opened.mode ||
        observed.size !== BigInt(desired.bytes.length)
      ) {
        throw new Error("repository_git_exclude_write_changed");
      }
    }
    const writtenPath = fs.realpathSync.native(lockPath);
    if (writtenPath !== lockSnapshot.realPath) {
      throw new Error("repository_git_exclude_write_changed");
    }
    lockSnapshot = Object.freeze({
      realPath: writtenPath,
      identity: after,
    });
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) {
      try {
        phaseHook?.("close");
      } catch (error) {
        failure ??= error;
      }
      try {
        fs.closeSync(descriptor);
      } catch (error) {
        failure ??= error;
      }
    }
  }
  if (!failure && lockSnapshot) {
    try {
      verifyLayoutForWrite(layout);
      // A write handle's final timestamps may become visible only at close.
      // Bind the closed snapshot to this exact owned file and exact bytes;
      // never refresh Repository or original-exclude identities here.
      verifyEntitySnapshot(lockSnapshot);
      const closed = readStableFileBytes(
        lockPath,
        MAX_EXCLUDE_FILE_BYTES,
        [layout.commonDirectory],
        true,
      );
      if (
        closed.snapshot.identity.type !== lockSnapshot.identity.type ||
        closed.snapshot.identity.dev !== lockSnapshot.identity.dev ||
        closed.snapshot.identity.ino !== lockSnapshot.identity.ino ||
        closed.snapshot.identity.birthtimeNs !==
          lockSnapshot.identity.birthtimeNs ||
        closed.snapshot.identity.mode !== lockSnapshot.identity.mode ||
        closed.snapshot.identity.size !== lockSnapshot.identity.size ||
        closed.snapshot.realPath !== lockSnapshot.realPath ||
        !closed.value.equals(desired.bytes)
      ) {
        throw new Error("repository_git_exclude_write_changed");
      }
      verifyEntitySnapshot(lockSnapshot);
      lockSnapshot = closed.snapshot;
      if (originalSnapshot) verifySnapshot(originalSnapshot);
      else {
        try {
          fs.lstatSync(excludePath);
          throw new Error("repository_git_exclude_changed");
        } catch (error) {
          if (!isEnoent(error)) throw error;
        }
      }
      verifySnapshot(lockSnapshot);
      phaseHook?.("rename");
      fs.renameSync(lockPath, excludePath);
      hasRenamed = true;
      phaseHook?.("post_rename_readback");
      verifyEntitySnapshot(layout.infoDirectory);
      const verified = readStableFileBytes(
        excludePath,
        MAX_EXCLUDE_FILE_BYTES,
        [layout.commonDirectory],
        true,
      );
      if (
        !verified.value.equals(desired.bytes) ||
        !exactEntryPresent(decodeExclude(verified.value), entry)
      ) {
        throw new Error(
          "repository_git_exclude_post_write_verification_failed",
        );
      }
      verifyEntitySnapshot(layout.infoDirectory);
      verifyLayoutForWrite(layout);
      phaseHook?.("post_readback");
      return Object.freeze({
        status: "completed" as const,
        changed: true,
        beforeContentIdentity: contentIdentity(existing),
        afterContentIdentity: contentIdentity(verified.value),
        effectIssued: true,
        effectConfirmation: "confirmed" as const,
        cleanupConfirmed: true as const,
      });
    } catch (error) {
      failure = error;
    }
  }
  const cleanupConfirmed =
    hasRenamed ||
    !lockCreated ||
    (lockSnapshot !== null && safeUnlinkOwned(lockPath, lockSnapshot));
  throw new RepositoryGitExcludeUpdateError(hasRenamed, cleanupConfirmed);
}

/**
 * Repository Local Excludeを書き込む。
 *
 * @responsibility Repository Local Excludeの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000002
 * @input layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null
 * @returns RepositoryLocalExcludeWriteResultを返す。
 * @precondition 「layout: RepositoryGitLayout、entry: unknown、phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null」がwriteRepositoryLocalExcludeの入力契約を満たす。
 * @postcondition writeRepositoryLocalExcludeの責務を完了した結果だけを返す。
 * @effect N/A: writeRepositoryLocalExcludeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeRepositoryLocalExcludeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeRepositoryLocalExcludeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeRepositoryLocalExcludeはProcess内の同一Subsystemで完結する。
 * @security N/A: writeRepositoryLocalExcludeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeRepositoryLocalExcludeは共有非同期状態を持たない同期処理である。
 */
export function writeRepositoryLocalExclude(
  layout: RepositoryGitLayout,
  entry: unknown,
  phaseHook: ((phase: RepositoryLocalExcludePhase) => void) | null = null,
): RepositoryLocalExcludeWriteResult {
  try {
    return writeRepositoryLocalExcludeInternal(layout, entry, phaseHook);
  } catch (error) {
    const effectIssued =
      error instanceof RepositoryGitExcludeUpdateError && error.writeIssued;
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_local_ignore_update_blocked" as const,
      effectIssued,
      effectConfirmation: effectIssued
        ? ("unknown" as const)
        : ("not_issued" as const),
      cleanupConfirmed:
        error instanceof RepositoryGitExcludeUpdateError
          ? error.cleanupConfirmed
          : true,
    });
  }
}
