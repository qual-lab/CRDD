import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const MAX_CONTROL_FILE_BYTES = 4096;
const MAX_CONFIG_FILE_BYTES = 1024 * 1024;
const MAX_EXCLUDE_FILE_BYTES = 128 * 1024;
const UTF8 = new TextDecoder("utf-8", { fatal: true });

function identity(metadata, expectedType) {
  const typeValid = expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (!typeValid || metadata.isSymbolicLink() || metadata.dev <= 0n ||
      metadata.ino <= 0n || metadata.birthtimeNs <= 0n) throw new Error("repository_git_layout_invalid");
  return Object.freeze({ type: expectedType, dev: metadata.dev, ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs, size: metadata.size, mode: metadata.mode,
    mtimeNs: metadata.mtimeNs, ctimeNs: metadata.ctimeNs });
}

function sameIdentity(left, right) {
  return left.type === right.type && left.dev === right.dev && left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs && left.size === right.size && left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function verifySnapshot(snapshot) {
  const current = identity(fs.lstatSync(snapshot.realPath, { bigint: true }), snapshot.identity.type);
  if (!sameIdentity(snapshot.identity, current) || fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath) {
    throw new Error("repository_git_layout_changed");
  }
}

function verifyEntitySnapshot(snapshot) {
  const current = identity(fs.lstatSync(snapshot.realPath, { bigint: true }), snapshot.identity.type);
  if (snapshot.identity.type !== current.type || snapshot.identity.dev !== current.dev ||
      snapshot.identity.ino !== current.ino || snapshot.identity.birthtimeNs !== current.birthtimeNs ||
      fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath) {
    throw new Error("repository_git_layout_changed");
  }
}

function verifySnapshots(snapshots) {
  for (const snapshot of snapshots) verifySnapshot(snapshot);
}

function verifyLayoutForWrite(layout) {
  for (const snapshot of layout.structuralGraph) {
    if (snapshot === layout.infoDirectory) verifyEntitySnapshot(snapshot);
    else verifySnapshot(snapshot);
  }
}

function directoryRealpath(target) {
  const before = identity(fs.lstatSync(target, { bigint: true }), "directory");
  const realPath = fs.realpathSync.native(target);
  const resolved = identity(fs.lstatSync(realPath, { bigint: true }), "directory");
  const after = identity(fs.lstatSync(target, { bigint: true }), "directory");
  if (!sameIdentity(before, resolved) || !sameIdentity(before, after)) {
    throw new Error("repository_git_layout_changed");
  }
  return Object.freeze({ realPath, identity: before });
}

function readStableFileBytes(target, maximumBytes, parentSnapshots = [], allowEmpty = false) {
  verifySnapshots(parentSnapshots);
  const pathBefore = identity(fs.lstatSync(target, { bigint: true }), "file");
  if ((!allowEmpty && pathBefore.size <= 0n) || pathBefore.size > BigInt(maximumBytes)) {
    throw new Error("repository_git_file_budget_invalid");
  }
  const noFollow = process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  let descriptor = null;
  let failure = null;
  let result = null;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
    const before = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    if (!sameIdentity(pathBefore, before) || before.size > BigInt(maximumBytes)) {
      throw new Error("repository_git_file_changed");
    }
    const buffer = Buffer.alloc(maximumBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = fs.readSync(descriptor, buffer, offset, buffer.length - offset, null);
      if (count === 0) break;
      offset += count;
    }
    if (offset > maximumBytes || BigInt(offset) !== before.size) throw new Error("repository_git_file_changed");
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }), "file");
    if (!sameIdentity(before, after) || !sameIdentity(before, pathAfter)) {
      throw new Error("repository_git_file_changed");
    }
    result = Object.freeze({ value: Buffer.from(buffer.subarray(0, offset)),
      snapshot: Object.freeze({ realPath: fs.realpathSync.native(target), identity: after }) });
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); } catch (error) { failure ??= error; }
    }
  }
  if (failure || !result) throw failure ?? new Error("repository_git_file_invalid");
  verifySnapshots(parentSnapshots);
  verifySnapshot(result.snapshot);
  return result;
}

function decodeUtf8(bytes, reason) {
  const text = UTF8.decode(bytes);
  if (text.charCodeAt(0) === 0xfeff || text.includes("\u0000")) throw new Error(reason);
  return text;
}

function readControlFile(target, parentSnapshots = []) {
  const bytes = readStableFileBytes(target, MAX_CONTROL_FILE_BYTES, parentSnapshots);
  const decoded = decodeUtf8(bytes.value, "repository_git_control_file_invalid");
  const line = decoded.endsWith("\r\n") ? decoded.slice(0, -2)
    : decoded.endsWith("\n") ? decoded.slice(0, -1) : decoded;
  if (line.length === 0 || /[\u0000-\u001f\u007f]/u.test(line)) {
    throw new Error("repository_git_control_file_invalid");
  }
  return Object.freeze({ line, snapshot: bytes.snapshot });
}

function parseNarrowRepositoryConfig(target, commonDirectory) {
  const bytes = readStableFileBytes(target, MAX_CONFIG_FILE_BYTES, [commonDirectory]);
  const text = decodeUtf8(bytes.value, "repository_git_config_unsupported");
  if (/\r(?!\n)/u.test(text)) throw new Error("repository_git_config_unsupported");
  let section = null;
  let subsection = false;
  let formatVersion = null;
  let bare = null;
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = /^\[([A-Za-z0-9.-]+)(\s+"[^"\r\n]*")?\]$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].toLocaleLowerCase("en-US");
      subsection = sectionMatch[2] !== undefined;
      if (section === "extensions" || section === "include" || section === "includeif") {
        throw new Error("repository_git_config_unsupported");
      }
      continue;
    }
    if (section === null || /\\\s*$/u.test(line)) throw new Error("repository_git_config_unsupported");
    const assignment = /^([A-Za-z][A-Za-z0-9.-]*)\s*(?:=\s*)?(.*?)$/u.exec(line);
    if (!assignment) throw new Error("repository_git_config_unsupported");
    const key = assignment[1].toLocaleLowerCase("en-US");
    const value = assignment[2].trim().toLocaleLowerCase("en-US");
    if (section === "core" && !subsection && key === "repositoryformatversion") {
      if (formatVersion !== null) throw new Error("repository_git_config_unsupported");
      formatVersion = value;
    }
    if (section === "core" && !subsection && key === "bare") {
      if (bare !== null) throw new Error("repository_git_config_unsupported");
      bare = value;
    }
    if (section === "core" && !subsection && key === "worktree") {
      throw new Error("repository_git_config_unsupported");
    }
  }
  if (formatVersion !== "0" || (bare !== null && !["false", "no", "off", "0"].includes(bare))) {
    throw new Error("repository_git_config_unsupported");
  }
  return bytes.snapshot;
}

function optionalCommonDirectory(gitDirectory, graph) {
  try {
    const control = readControlFile(path.join(gitDirectory.realPath, "commondir"), [gitDirectory]);
    graph.push(control.snapshot);
    return directoryRealpath(path.isAbsolute(control.line)
      ? control.line : path.resolve(gitDirectory.realPath, control.line));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function resolveExcludeBoundary(commonDirectory, graph) {
  let infoDirectory;
  try {
    infoDirectory = directoryRealpath(path.join(commonDirectory.realPath, "info"));
    graph.push(infoDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze({ infoDirectory: null, excludeSnapshot: null });
    throw error;
  }
  try {
    const bytes = readStableFileBytes(path.join(infoDirectory.realPath, "exclude"),
      MAX_EXCLUDE_FILE_BYTES, [commonDirectory, infoDirectory], true);
    return Object.freeze({ infoDirectory, excludeSnapshot: bytes.snapshot });
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze({ infoDirectory, excludeSnapshot: null });
    throw error;
  }
}

export function resolveRepositoryGitLayout(repositoryRoot) {
  const graph = [];
  const root = directoryRealpath(repositoryRoot);
  graph.push(root);
  const marker = path.join(root.realPath, ".git");
  const markerMetadata = fs.lstatSync(marker, { bigint: true });
  if (markerMetadata.isSymbolicLink()) throw new Error("repository_git_marker_link_rejected");
  let gitDirectory;
  let kind;
  if (markerMetadata.isDirectory()) {
    gitDirectory = directoryRealpath(marker);
    kind = "normal_worktree";
  } else if (markerMetadata.isFile()) {
    const control = readControlFile(marker, [root]);
    graph.push(control.snapshot);
    if (!control.line.startsWith("gitdir: ")) throw new Error("repository_git_file_invalid");
    const value = control.line.slice("gitdir: ".length);
    if (!value || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("repository_git_file_invalid");
    gitDirectory = directoryRealpath(path.isAbsolute(value) ? value : path.resolve(root.realPath, value));
    kind = "gitfile_worktree";
  } else throw new Error("repository_git_marker_invalid");
  graph.push(gitDirectory);
  const commonDirectory = optionalCommonDirectory(gitDirectory, graph) ?? gitDirectory;
  if (commonDirectory !== gitDirectory) graph.push(commonDirectory);
  graph.push(readControlFile(path.join(gitDirectory.realPath, "HEAD"), [gitDirectory]).snapshot);
  graph.push(parseNarrowRepositoryConfig(path.join(commonDirectory.realPath, "config"), commonDirectory));
  const boundary = resolveExcludeBoundary(commonDirectory, graph);
  verifySnapshots(graph);
  if (boundary.excludeSnapshot) verifySnapshot(boundary.excludeSnapshot);
  if (kind === "gitfile_worktree" && commonDirectory !== gitDirectory) kind = "linked_worktree";
  return Object.freeze({ kind, root, gitDirectory, commonDirectory,
    infoDirectory: boundary.infoDirectory, excludeSnapshot: boundary.excludeSnapshot,
    structuralGraph: Object.freeze([...graph]) });
}

export function summarizeRepositoryGitLayout(layout) {
  return Object.freeze({ kind: layout.kind, commonMetadataResolved: true,
    supportedRepositoryFormat: "version_0_without_extensions_or_includes",
    excludeBackend: "common_git_directory_info_exclude", referencedRepositoriesModified: false });
}

function decodeExclude(bytes) {
  const text = decodeUtf8(bytes, "repository_git_exclude_invalid");
  if (/\r(?!\n)/u.test(text)) throw new Error("repository_git_exclude_invalid");
  return text;
}

function exactEntryPresent(text, entry) {
  return text.split(/\r?\n/u).some((line) => line === entry);
}

function desiredExcludeBytes(existing, entry) {
  const text = decodeExclude(existing);
  if (exactEntryPresent(text, entry)) return Object.freeze({ changed: false, bytes: Buffer.from(existing) });
  const separator = existing.length === 0 || existing.at(-1) === 0x0a ? "" : "\n";
  const bytes = Buffer.concat([existing, Buffer.from(`${separator}${entry}\n`, "utf8")]);
  if (bytes.length > MAX_EXCLUDE_FILE_BYTES) throw new Error("repository_git_exclude_too_large");
  return Object.freeze({ changed: true, bytes });
}

function safeUnlinkOwned(target, snapshot) {
  try { verifyEntitySnapshot(snapshot); fs.unlinkSync(target); return true; } catch { return false; }
}

export function writeRepositoryLocalExclude(layout, entry) {
  if (!layout.infoDirectory) throw new Error("repository_git_info_directory_required");
  verifyLayoutForWrite(layout);
  const excludePath = path.join(layout.infoDirectory.realPath, "exclude");
  let existing = Buffer.alloc(0);
  let originalSnapshot = null;
  try {
    const read = readStableFileBytes(excludePath, MAX_EXCLUDE_FILE_BYTES,
      [layout.commonDirectory, layout.infoDirectory], true);
    existing = read.value;
    originalSnapshot = read.snapshot;
    if (layout.excludeSnapshot && !sameIdentity(layout.excludeSnapshot.identity, originalSnapshot.identity)) {
      throw new Error("repository_git_exclude_changed");
    }
  } catch (error) {
    if (error?.code !== "ENOENT" || layout.excludeSnapshot) throw error;
  }
  const desired = desiredExcludeBytes(existing, entry);
  if (!desired.changed) {
    verifyLayoutForWrite(layout);
    if (originalSnapshot) verifySnapshot(originalSnapshot);
    return Object.freeze({ changed: false, verified: true });
  }
  const lockPath = path.join(layout.infoDirectory.realPath, ".crdd-runtime-exclude.lock");
  let descriptor = null;
  let lockSnapshot = null;
  let renamed = false;
  let failure = null;
  try {
    const mode = originalSnapshot ? Number(originalSnapshot.identity.mode & 0o777n) : 0o600;
    descriptor = fs.openSync(lockPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, mode);
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const openedPath = identity(fs.lstatSync(lockPath, { bigint: true }), "file");
    if (!sameIdentity(opened, openedPath)) throw new Error("repository_git_exclude_lock_changed");
    lockSnapshot = Object.freeze({ realPath: fs.realpathSync.native(lockPath), identity: opened });
    let offset = 0;
    while (offset < desired.bytes.length) {
      const count = fs.writeSync(descriptor, desired.bytes, offset, desired.bytes.length - offset, null);
      if (count <= 0) throw new Error("repository_git_exclude_write_failed");
      offset += count;
    }
    fs.fsyncSync(descriptor);
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(fs.lstatSync(lockPath, { bigint: true }), "file");
    if (after.size !== BigInt(desired.bytes.length) || !sameIdentity(after, pathAfter) ||
        after.dev !== opened.dev || after.ino !== opened.ino || after.birthtimeNs !== opened.birthtimeNs) {
      throw new Error("repository_git_exclude_write_changed");
    }
    lockSnapshot = Object.freeze({ realPath: fs.realpathSync.native(lockPath), identity: after });
  } catch (error) { failure = error; }
  finally {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); } catch (error) { failure ??= error; }
    }
  }
  if (!failure && lockSnapshot) {
    try {
      verifyLayoutForWrite(layout);
      if (originalSnapshot) verifySnapshot(originalSnapshot);
      else {
        try { fs.lstatSync(excludePath); throw new Error("repository_git_exclude_changed"); }
        catch (error) { if (error?.code !== "ENOENT") throw error; }
      }
      verifySnapshot(lockSnapshot);
      fs.renameSync(lockPath, excludePath);
      renamed = true;
      verifyEntitySnapshot(layout.infoDirectory);
      const verified = readStableFileBytes(excludePath, MAX_EXCLUDE_FILE_BYTES, [layout.commonDirectory], true);
      if (!verified.value.equals(desired.bytes) || !exactEntryPresent(decodeExclude(verified.value), entry)) {
        throw new Error("repository_git_exclude_post_write_verification_failed");
      }
      verifyEntitySnapshot(layout.infoDirectory);
      verifyLayoutForWrite(layout);
      return Object.freeze({ changed: true, verified: true });
    } catch (error) { failure = error; }
  }
  if (!renamed && lockSnapshot) safeUnlinkOwned(lockPath, lockSnapshot);
  const error = new Error("repository_git_exclude_update_blocked");
  error.writeIssued = renamed;
  throw error;
}

export const REPOSITORY_GIT_EXCLUDE_MAX_BYTES = MAX_EXCLUDE_FILE_BYTES;
