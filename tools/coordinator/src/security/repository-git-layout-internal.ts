import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const MAX_CONTROL_FILE_BYTES = 4096;
const MAX_CONFIG_FILE_BYTES = 1024 * 1024;
const MAX_EXCLUDE_FILE_BYTES = 128 * 1024;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

type EntityType = "file" | "directory";
type LayoutKind = "normal_worktree" | "gitfile_worktree" | "linked_worktree";

type EntityIdentity = Readonly<{
  type: EntityType;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mode: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

type EntitySnapshot = Readonly<{
  realPath: string;
  identity: EntityIdentity;
}>;

export type RepositoryGitLayout = Readonly<{
  kind: LayoutKind;
  root: EntitySnapshot;
  gitDirectory: EntitySnapshot;
  commonDirectory: EntitySnapshot;
  infoDirectory: EntitySnapshot | null;
  excludeSnapshot: EntitySnapshot | null;
  structuralGraph: readonly EntitySnapshot[];
}>;

type StableFileBytes = Readonly<{ value: Buffer; snapshot: EntitySnapshot }>;

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function identity(
  metadata: fs.BigIntStats,
  expectedType: EntityType,
): EntityIdentity {
  const isTypeValid =
    expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isTypeValid ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("repository_git_layout_invalid");
  return Object.freeze({
    type: expectedType,
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    size: metadata.size,
    mode: metadata.mode,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
  });
}

function sameIdentity(left: EntityIdentity, right: EntityIdentity): boolean {
  return (
    left.type === right.type &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function verifySnapshot(snapshot: EntitySnapshot): void {
  const current = identity(
    fs.lstatSync(snapshot.realPath, { bigint: true }),
    snapshot.identity.type,
  );
  if (
    !sameIdentity(snapshot.identity, current) ||
    fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath
  ) {
    throw new Error("repository_git_layout_changed");
  }
}

function verifyEntitySnapshot(snapshot: EntitySnapshot): void {
  const current = identity(
    fs.lstatSync(snapshot.realPath, { bigint: true }),
    snapshot.identity.type,
  );
  if (
    snapshot.identity.type !== current.type ||
    snapshot.identity.dev !== current.dev ||
    snapshot.identity.ino !== current.ino ||
    snapshot.identity.birthtimeNs !== current.birthtimeNs ||
    fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath
  ) {
    throw new Error("repository_git_layout_changed");
  }
}

function verifySnapshots(snapshots: readonly EntitySnapshot[]): void {
  for (const snapshot of snapshots) verifySnapshot(snapshot);
}

function verifyLayoutForWrite(layout: RepositoryGitLayout): void {
  for (const snapshot of layout.structuralGraph) {
    if (snapshot === layout.infoDirectory) verifyEntitySnapshot(snapshot);
    else verifySnapshot(snapshot);
  }
}

function directoryRealpath(target: string): EntitySnapshot {
  const before = identity(fs.lstatSync(target, { bigint: true }), "directory");
  const realPath = fs.realpathSync.native(target);
  const resolved = identity(
    fs.lstatSync(realPath, { bigint: true }),
    "directory",
  );
  const after = identity(fs.lstatSync(target, { bigint: true }), "directory");
  if (!sameIdentity(before, resolved) || !sameIdentity(before, after)) {
    throw new Error("repository_git_layout_changed");
  }
  return Object.freeze({ realPath, identity: before });
}

function readStableFileBytes(
  target: string,
  maximumBytes: number,
  parentSnapshots: readonly EntitySnapshot[] = [],
  shouldAllowEmpty = false,
): StableFileBytes {
  verifySnapshots(parentSnapshots);
  const pathBefore = identity(fs.lstatSync(target, { bigint: true }), "file");
  if (
    (!shouldAllowEmpty && pathBefore.size <= 0n) ||
    pathBefore.size > BigInt(maximumBytes)
  ) {
    throw new Error("repository_git_file_budget_invalid");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  let descriptor: number | null = null;
  let failure: unknown = null;
  let result: StableFileBytes | null = null;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
    const before = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    if (
      !sameIdentity(pathBefore, before) ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("repository_git_file_changed");
    }
    const buffer = Buffer.alloc(maximumBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = fs.readSync(
        descriptor,
        buffer,
        offset,
        buffer.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    if (offset > maximumBytes || BigInt(offset) !== before.size)
      throw new Error("repository_git_file_changed");
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }), "file");
    if (!sameIdentity(before, after) || !sameIdentity(before, pathAfter)) {
      throw new Error("repository_git_file_changed");
    }
    result = Object.freeze({
      value: Buffer.from(buffer.subarray(0, offset)),
      snapshot: Object.freeze({
        realPath: fs.realpathSync.native(target),
        identity: after,
      }),
    });
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch (error) {
        failure ??= error;
      }
    }
  }
  if (failure || !result)
    throw failure ?? new Error("repository_git_file_invalid");
  verifySnapshots(parentSnapshots);
  verifySnapshot(result.snapshot);
  return result;
}

function decodeUtf8(bytes: Uint8Array, reason: string): string {
  const text = utf8Decoder.decode(bytes);
  if (text.charCodeAt(0) === 0xfeff || text.includes("\u0000"))
    throw new Error(reason);
  return text;
}

function readControlFile(
  target: string,
  parentSnapshots: readonly EntitySnapshot[] = [],
): Readonly<{ line: string; snapshot: EntitySnapshot }> {
  const bytes = readStableFileBytes(
    target,
    MAX_CONTROL_FILE_BYTES,
    parentSnapshots,
  );
  const decoded = decodeUtf8(
    bytes.value,
    "repository_git_control_file_invalid",
  );
  const line = decoded.endsWith("\r\n")
    ? decoded.slice(0, -2)
    : decoded.endsWith("\n")
      ? decoded.slice(0, -1)
      : decoded;
  if (line.length === 0 || /[\u0000-\u001f\u007f]/u.test(line)) {
    throw new Error("repository_git_control_file_invalid");
  }
  return Object.freeze({ line, snapshot: bytes.snapshot });
}

function parseNarrowRepositoryConfig(
  target: string,
  commonDirectory: EntitySnapshot,
): Readonly<{
  snapshot: EntitySnapshot;
  objectFormat: "sha1" | "sha256";
}> {
  const bytes = readStableFileBytes(target, MAX_CONFIG_FILE_BYTES, [
    commonDirectory,
  ]);
  const text = decodeUtf8(bytes.value, "repository_git_config_unsupported");
  if (/\r(?!\n)/u.test(text))
    throw new Error("repository_git_config_unsupported");
  let section = null;
  let isSubsection = false;
  let formatVersion = null;
  let bare = null;
  let objectFormat = null;
  let compatibilityObjectFormat = null;
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = /^\[([A-Za-z0-9.-]+)(\s+"[^"\r\n]*")?\]$/u.exec(line);
    if (sectionMatch) {
      const sectionName = sectionMatch[1];
      if (sectionName === undefined)
        throw new Error("repository_git_config_unsupported");
      section = sectionName.toLocaleLowerCase("en-US");
      isSubsection = sectionMatch[2] !== undefined;
      if (section === "include" || section === "includeif") {
        throw new Error("repository_git_config_unsupported");
      }
      continue;
    }
    if (section === null || /\\\s*$/u.test(line))
      throw new Error("repository_git_config_unsupported");
    const assignment = /^([A-Za-z][A-Za-z0-9.-]*)\s*(?:=\s*)?(.*?)$/u.exec(
      line,
    );
    if (!assignment) throw new Error("repository_git_config_unsupported");
    const assignmentKey = assignment[1];
    const assignmentValue = assignment[2];
    if (assignmentKey === undefined || assignmentValue === undefined) {
      throw new Error("repository_git_config_unsupported");
    }
    const key = assignmentKey.toLocaleLowerCase("en-US");
    const value = assignmentValue.trim().toLocaleLowerCase("en-US");
    if (
      section === "core" &&
      !isSubsection &&
      key === "repositoryformatversion"
    ) {
      if (formatVersion !== null)
        throw new Error("repository_git_config_unsupported");
      formatVersion = value;
    }
    if (section === "core" && !isSubsection && key === "bare") {
      if (bare !== null) throw new Error("repository_git_config_unsupported");
      bare = value;
    }
    if (section === "core" && !isSubsection && key === "worktree") {
      throw new Error("repository_git_config_unsupported");
    }
    if (section === "extensions" && !isSubsection && key === "objectformat") {
      if (objectFormat !== null)
        throw new Error("repository_git_config_unsupported");
      objectFormat = value;
    }
    if (
      section === "extensions" &&
      !isSubsection &&
      key === "compatobjectformat"
    ) {
      if (compatibilityObjectFormat !== null)
        throw new Error("repository_git_config_unsupported");
      compatibilityObjectFormat = value;
    }
    if (
      section === "extensions" &&
      (isSubsection || (key !== "objectformat" && key !== "compatobjectformat"))
    ) {
      throw new Error("repository_git_config_unsupported");
    }
  }
  const detectedObjectFormat =
    formatVersion === "0" &&
    bare === "false" &&
    objectFormat === null &&
    compatibilityObjectFormat === null
      ? "sha1"
      : formatVersion === "1" &&
          bare === "false" &&
          objectFormat === "sha256" &&
          (compatibilityObjectFormat === null ||
            compatibilityObjectFormat === "sha1")
        ? "sha256"
        : null;
  if (!detectedObjectFormat) {
    throw new Error("repository_git_config_unsupported");
  }
  return Object.freeze({
    snapshot: bytes.snapshot,
    objectFormat: detectedObjectFormat,
  });
}

export function inspectRepositoryGitObjectFormatCandidate(
  repositoryRoot: unknown,
) {
  try {
    if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0)
      return null;
    const snapshots: EntitySnapshot[] = [];
    const root = directoryRealpath(repositoryRoot);
    snapshots.push(root);
    const marker = path.join(root.realPath, ".git");
    const markerMetadata = fs.lstatSync(marker, { bigint: true });
    if (markerMetadata.isSymbolicLink()) return null;
    let gitDirectory: EntitySnapshot;
    if (markerMetadata.isDirectory()) {
      gitDirectory = directoryRealpath(marker);
    } else if (markerMetadata.isFile()) {
      const control = readControlFile(marker, [root]);
      snapshots.push(control.snapshot);
      if (!control.line.startsWith("gitdir: ")) return null;
      const value = control.line.slice("gitdir: ".length);
      if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return null;
      gitDirectory = directoryRealpath(
        path.isAbsolute(value) ? value : path.resolve(root.realPath, value),
      );
    } else return null;
    snapshots.push(gitDirectory);
    const commonDirectory =
      optionalCommonDirectory(gitDirectory, snapshots) ?? gitDirectory;
    if (commonDirectory !== gitDirectory) snapshots.push(commonDirectory);
    snapshots.push(
      readControlFile(path.join(gitDirectory.realPath, "HEAD"), [gitDirectory])
        .snapshot,
    );
    const config = parseNarrowRepositoryConfig(
      path.join(commonDirectory.realPath, "config"),
      commonDirectory,
    );
    snapshots.push(config.snapshot);
    verifySnapshots(snapshots);
    return Object.freeze({
      status: "candidate" as const,
      objectFormat: config.objectFormat,
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

function optionalCommonDirectory(
  gitDirectory: EntitySnapshot,
  entitySnapshots: EntitySnapshot[],
): EntitySnapshot | null {
  try {
    const control = readControlFile(
      path.join(gitDirectory.realPath, "commondir"),
      [gitDirectory],
    );
    entitySnapshots.push(control.snapshot);
    return directoryRealpath(
      path.isAbsolute(control.line)
        ? control.line
        : path.resolve(gitDirectory.realPath, control.line),
    );
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
}

function resolveExcludeBoundary(
  commonDirectory: EntitySnapshot,
  entitySnapshots: EntitySnapshot[],
): Readonly<{
  infoDirectory: EntitySnapshot | null;
  excludeSnapshot: EntitySnapshot | null;
}> {
  let infoDirectory: EntitySnapshot;
  try {
    infoDirectory = directoryRealpath(
      path.join(commonDirectory.realPath, "info"),
    );
    entitySnapshots.push(infoDirectory);
  } catch (error) {
    if (isEnoent(error))
      return Object.freeze({ infoDirectory: null, excludeSnapshot: null });
    throw error;
  }
  try {
    const bytes = readStableFileBytes(
      path.join(infoDirectory.realPath, "exclude"),
      MAX_EXCLUDE_FILE_BYTES,
      [commonDirectory, infoDirectory],
      true,
    );
    return Object.freeze({ infoDirectory, excludeSnapshot: bytes.snapshot });
  } catch (error) {
    if (isEnoent(error))
      return Object.freeze({ infoDirectory, excludeSnapshot: null });
    throw error;
  }
}

export function resolveRepositoryGitLayout(
  repositoryRoot: unknown,
): RepositoryGitLayout {
  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) {
    throw new Error("repository_git_root_required");
  }
  const entitySnapshots: EntitySnapshot[] = [];
  const root = directoryRealpath(repositoryRoot);
  entitySnapshots.push(root);
  const marker = path.join(root.realPath, ".git");
  const markerMetadata = fs.lstatSync(marker, { bigint: true });
  if (markerMetadata.isSymbolicLink())
    throw new Error("repository_git_marker_link_rejected");
  let gitDirectory: EntitySnapshot;
  let kind: LayoutKind;
  if (markerMetadata.isDirectory()) {
    gitDirectory = directoryRealpath(marker);
    kind = "normal_worktree";
  } else if (markerMetadata.isFile()) {
    const control = readControlFile(marker, [root]);
    entitySnapshots.push(control.snapshot);
    if (!control.line.startsWith("gitdir: "))
      throw new Error("repository_git_file_invalid");
    const value = control.line.slice("gitdir: ".length);
    if (!value || /[\u0000-\u001f\u007f]/u.test(value))
      throw new Error("repository_git_file_invalid");
    gitDirectory = directoryRealpath(
      path.isAbsolute(value) ? value : path.resolve(root.realPath, value),
    );
    kind = "gitfile_worktree";
  } else throw new Error("repository_git_marker_invalid");
  entitySnapshots.push(gitDirectory);
  const commonDirectory =
    optionalCommonDirectory(gitDirectory, entitySnapshots) ?? gitDirectory;
  if (commonDirectory !== gitDirectory) entitySnapshots.push(commonDirectory);
  entitySnapshots.push(
    readControlFile(path.join(gitDirectory.realPath, "HEAD"), [gitDirectory])
      .snapshot,
  );
  const config = parseNarrowRepositoryConfig(
    path.join(commonDirectory.realPath, "config"),
    commonDirectory,
  );
  if (config.objectFormat !== "sha1")
    throw new Error("repository_git_object_format_unsupported");
  entitySnapshots.push(config.snapshot);
  const boundary = resolveExcludeBoundary(commonDirectory, entitySnapshots);
  verifySnapshots(entitySnapshots);
  if (boundary.excludeSnapshot) verifySnapshot(boundary.excludeSnapshot);
  if (kind === "gitfile_worktree" && commonDirectory !== gitDirectory)
    kind = "linked_worktree";
  return Object.freeze({
    kind,
    root,
    gitDirectory,
    commonDirectory,
    infoDirectory: boundary.infoDirectory,
    excludeSnapshot: boundary.excludeSnapshot,
    structuralGraph: Object.freeze([...entitySnapshots]),
  });
}

export function summarizeRepositoryGitLayout(
  layout: RepositoryGitLayout,
): Readonly<{
  kind: LayoutKind;
  commonMetadataResolved: true;
  supportedRepositoryFormat: "version_0_without_extensions_or_includes";
  excludeBackend: "common_git_directory_info_exclude";
  referencedRepositoriesModified: false;
}> {
  return Object.freeze({
    kind: layout.kind,
    commonMetadataResolved: true,
    supportedRepositoryFormat: "version_0_without_extensions_or_includes",
    excludeBackend: "common_git_directory_info_exclude",
    referencedRepositoriesModified: false,
  });
}

function decodeExclude(bytes: Uint8Array): string {
  const text = decodeUtf8(bytes, "repository_git_exclude_invalid");
  if (/\r(?!\n)/u.test(text)) throw new Error("repository_git_exclude_invalid");
  return text;
}

function exactEntryPresent(text: string, entry: string): boolean {
  return text.split(/\r?\n/u).some((line) => line === entry);
}

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

function safeUnlinkOwned(target: string, snapshot: EntitySnapshot): boolean {
  try {
    verifyEntitySnapshot(snapshot);
    fs.unlinkSync(target);
    return true;
  } catch {
    return false;
  }
}

class RepositoryGitExcludeUpdateError extends Error {
  readonly writeIssued: boolean;

  constructor(hasWriteIssued: boolean) {
    super("repository_git_exclude_update_blocked");
    this.writeIssued = hasWriteIssued;
  }
}

export function writeRepositoryLocalExclude(
  layout: RepositoryGitLayout,
  entry: unknown,
): Readonly<{ changed: boolean; verified: true }> {
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
    return Object.freeze({ changed: false, verified: true });
  }
  const lockPath = path.join(
    layout.infoDirectory.realPath,
    ".crdd-runtime-exclude.lock",
  );
  let descriptor: number | null = null;
  let lockSnapshot: EntitySnapshot | null = null;
  let hasRenamed = false;
  let failure: unknown = null;
  try {
    const mode = originalSnapshot
      ? Number(originalSnapshot.identity.mode & 0o777n)
      : 0o600;
    descriptor = fs.openSync(
      lockPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      mode,
    );
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
    fs.fsyncSync(descriptor);
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(
      fs.lstatSync(lockPath, { bigint: true }),
      "file",
    );
    if (
      after.size !== BigInt(desired.bytes.length) ||
      !sameIdentity(after, pathAfter) ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs
    ) {
      throw new Error("repository_git_exclude_write_changed");
    }
    lockSnapshot = Object.freeze({
      realPath: fs.realpathSync.native(lockPath),
      identity: after,
    });
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) {
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
      fs.renameSync(lockPath, excludePath);
      hasRenamed = true;
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
      return Object.freeze({ changed: true, verified: true });
    } catch (error) {
      failure = error;
    }
  }
  if (!hasRenamed && lockSnapshot) safeUnlinkOwned(lockPath, lockSnapshot);
  throw new RepositoryGitExcludeUpdateError(hasRenamed);
}

export const REPOSITORY_GIT_EXCLUDE_MAX_BYTES = MAX_EXCLUDE_FILE_BYTES;
