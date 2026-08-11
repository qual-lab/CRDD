import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";

export const REPOSITORY_GIT_LAYOUT_CONTRACT = "crdd-coordinator/repository-git-layout";
export const REPOSITORY_GIT_LAYOUT_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set(["repositoryRoot"]);
const MAX_PATH_CHARACTERS = 4096;
const MAX_CONTROL_FILE_BYTES = 4096;
const UTF8 = new TextDecoder("utf-8", { fatal: true });

function response(status, reason, layout = null) {
  return Object.freeze({ status, reason, layout, pathsRecorded: false,
    gitMetadataWriteIssued: false, runtimeCapabilityIssued: false });
}

function validAbsolutePath(value) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAX_PATH_CHARACTERS && path.isAbsolute(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function identity(metadata, expectedType) {
  const typeValid = expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (!typeValid || metadata.isSymbolicLink() || metadata.dev <= 0n ||
      metadata.ino <= 0n || metadata.birthtimeNs <= 0n) {
    throw new Error("repository_git_layout_invalid");
  }
  return Object.freeze({
    type: expectedType,
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    size: metadata.size,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs
  });
}

function sameIdentity(left, right) {
  return left.type === right.type && left.dev === right.dev && left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs && left.size === right.size &&
    left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

function verifySnapshot(snapshot) {
  const current = identity(fs.lstatSync(snapshot.realPath, { bigint: true }), snapshot.identity.type);
  if (!sameIdentity(snapshot.identity, current) || fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath) {
    throw new Error("repository_git_layout_changed");
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

function readControlFile(target, parentSnapshots = []) {
  for (const parent of parentSnapshots) verifySnapshot(parent);
  const pathBefore = identity(fs.lstatSync(target, { bigint: true }), "file");
  if (pathBefore.size <= 0n || pathBefore.size > BigInt(MAX_CONTROL_FILE_BYTES)) {
    throw new Error("repository_git_control_file_invalid");
  }
  const noFollow = process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  let descriptor = null;
  let failure = null;
  let bytes = null;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
    const descriptorBefore = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    if (!sameIdentity(pathBefore, descriptorBefore) || descriptorBefore.size > BigInt(MAX_CONTROL_FILE_BYTES)) {
      throw new Error("repository_git_control_file_changed");
    }
    const buffer = Buffer.alloc(MAX_CONTROL_FILE_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const read = fs.readSync(descriptor, buffer, offset, buffer.length - offset, null);
      if (read === 0) break;
      offset += read;
    }
    if (offset > MAX_CONTROL_FILE_BYTES || BigInt(offset) !== descriptorBefore.size) {
      throw new Error("repository_git_control_file_changed");
    }
    const descriptorAfter = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }), "file");
    if (!sameIdentity(descriptorBefore, descriptorAfter) || !sameIdentity(descriptorBefore, pathAfter)) {
      throw new Error("repository_git_control_file_changed");
    }
    bytes = Object.freeze({ value: Buffer.from(buffer.subarray(0, offset)),
      snapshot: Object.freeze({ realPath: fs.realpathSync.native(target), identity: descriptorAfter }) });
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); }
      catch (error) { failure ??= error; }
    }
  }
  if (failure || bytes === null) throw failure ?? new Error("repository_git_control_file_invalid");
  for (const parent of parentSnapshots) verifySnapshot(parent);
  verifySnapshot(bytes.snapshot);
  const decoded = UTF8.decode(bytes.value);
  if (decoded.charCodeAt(0) === 0xfeff) {
    throw new Error("repository_git_control_file_invalid");
  }
  const line = decoded.endsWith("\r\n") ? decoded.slice(0, -2)
    : decoded.endsWith("\n") ? decoded.slice(0, -1) : decoded;
  if (line.length === 0 || /[\u0000-\u001f\u007f]/u.test(line)) throw new Error("repository_git_control_file_invalid");
  return Object.freeze({ line, snapshot: bytes.snapshot });
}

function regularFileSnapshot(target, maximumBytes, parentSnapshots = []) {
  for (const parent of parentSnapshots) verifySnapshot(parent);
  const metadata = fs.lstatSync(target, { bigint: true });
  const fileIdentity = identity(metadata, "file");
  if (fileIdentity.size <= 0n || fileIdentity.size > BigInt(maximumBytes)) {
    throw new Error("repository_git_layout_invalid");
  }
  const snapshot = Object.freeze({ realPath: fs.realpathSync.native(target), identity: fileIdentity });
  verifySnapshot(snapshot);
  for (const parent of parentSnapshots) verifySnapshot(parent);
  return snapshot;
}

function optionalCommonDirectory(gitDirectorySnapshot, graph) {
  const marker = path.join(gitDirectorySnapshot.realPath, "commondir");
  try {
    const control = readControlFile(marker, [gitDirectorySnapshot]);
    graph.push(control.snapshot);
    const value = control.line;
    return directoryRealpath(path.isAbsolute(value) ? value : path.resolve(gitDirectorySnapshot.realPath, value));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function verifyExistingExcludeBoundary(commonDirectorySnapshot, graph) {
  const info = path.join(commonDirectorySnapshot.realPath, "info");
  let infoSnapshot;
  try { infoSnapshot = directoryRealpath(info); graph.push(infoSnapshot); }
  catch (error) { if (error?.code === "ENOENT") return; throw error; }
  try {
    graph.push(regularFileSnapshot(path.join(infoSnapshot.realPath, "exclude"), Number.MAX_SAFE_INTEGER,
      [commonDirectorySnapshot, infoSnapshot]));
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
}

function summary(kind) {
  return Object.freeze({ kind, commonMetadataResolved: true,
    excludeBackend: "common_git_directory_info_exclude", referencedRepositoriesModified: false });
}

export function inspectRepositoryGitLayoutCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || !validAbsolutePath(input.repositoryRoot)) return response("blocked", "repository_git_layout_input_invalid");
    const graph = [];
    const repositoryRoot = directoryRealpath(input.repositoryRoot);
    graph.push(repositoryRoot);
    const marker = path.join(repositoryRoot.realPath, ".git");
    const markerMetadata = fs.lstatSync(marker, { bigint: true });
    if (markerMetadata.isSymbolicLink()) return response("blocked", "repository_git_marker_link_rejected");

    let gitDirectory;
    let kind;
    if (markerMetadata.isDirectory()) {
      gitDirectory = directoryRealpath(marker);
      kind = "normal_worktree";
    } else if (markerMetadata.isFile()) {
      const control = readControlFile(marker, [repositoryRoot]);
      graph.push(control.snapshot);
      if (!control.line.startsWith("gitdir: ")) return response("blocked", "repository_git_file_invalid");
      const value = control.line.slice("gitdir: ".length);
      if (value.length === 0 || /[\u0000-\u001f\u007f]/u.test(value)) return response("blocked", "repository_git_file_invalid");
      gitDirectory = directoryRealpath(path.isAbsolute(value) ? value : path.resolve(repositoryRoot.realPath, value));
      kind = "gitfile_worktree";
    } else return response("blocked", "repository_git_marker_invalid");

    graph.push(gitDirectory);
    const commonDirectory = optionalCommonDirectory(gitDirectory, graph) ?? gitDirectory;
    if (commonDirectory !== gitDirectory) graph.push(commonDirectory);
    const head = readControlFile(path.join(gitDirectory.realPath, "HEAD"), [gitDirectory]);
    graph.push(head.snapshot);
    graph.push(regularFileSnapshot(path.join(commonDirectory.realPath, "config"), 1024 * 1024, [commonDirectory]));
    verifyExistingExcludeBoundary(commonDirectory, graph);
    for (const snapshot of graph) verifySnapshot(snapshot);
    if (kind === "gitfile_worktree" && commonDirectory !== gitDirectory) kind = "linked_worktree";
    return response("candidate", "repository_git_layout_resolved_candidate", summary(kind));
  } catch (error) {
    if (error?.code === "ENOENT") return response("blocked", "repository_worktree_required");
    return response("blocked", "repository_git_layout_invalid");
  }
}

export function describeRepositoryGitLayoutContract() {
  return Object.freeze({
    contract: REPOSITORY_GIT_LAYOUT_CONTRACT,
    contractRevision: REPOSITORY_GIT_LAYOUT_CONTRACT_REVISION,
    supportedWorktreeForms: Object.freeze(["normal_worktree", "linked_worktree", "gitfile_worktree_including_submodule"]),
    bareRepositorySupported: false,
    referencedSubmodulesModified: false,
    referencedRepositoriesModified: false,
    multiRepositoryWriteOperationSupported: false,
    commonGitDirectoryExcludeBackend: true,
    filesystemResolutionCore: "implemented_candidate",
    repositoryIdentityVerification: "not_implemented",
    metadataWriteIntegration: "not_implemented",
    runtimeCapabilityIssued: false
  });
}
