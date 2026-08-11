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

function directoryRealpath(target) {
  const metadata = fs.lstatSync(target, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
      metadata.dev <= 0n || metadata.ino <= 0n || metadata.birthtimeNs <= 0n) {
    throw new Error("repository_git_layout_invalid");
  }
  return fs.realpathSync.native(target);
}

function readControlFile(target) {
  const metadata = fs.lstatSync(target, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink() ||
      metadata.size <= 0n || metadata.size > BigInt(MAX_CONTROL_FILE_BYTES)) {
    throw new Error("repository_git_control_file_invalid");
  }
  const decoded = UTF8.decode(fs.readFileSync(target));
  if (decoded.charCodeAt(0) === 0xfeff) {
    throw new Error("repository_git_control_file_invalid");
  }
  const line = decoded.endsWith("\r\n") ? decoded.slice(0, -2)
    : decoded.endsWith("\n") ? decoded.slice(0, -1) : decoded;
  if (line.length === 0 || /[\u0000-\u001f\u007f]/u.test(line)) throw new Error("repository_git_control_file_invalid");
  return line;
}

function verifyRegularFile(target, maximumBytes) {
  const metadata = fs.lstatSync(target, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink() ||
      metadata.size <= 0n || metadata.size > BigInt(maximumBytes)) {
    throw new Error("repository_git_layout_invalid");
  }
}

function optionalCommonDirectory(gitDirectory) {
  const marker = path.join(gitDirectory, "commondir");
  try {
    const value = readControlFile(marker);
    return directoryRealpath(path.isAbsolute(value) ? value : path.resolve(gitDirectory, value));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function verifyExistingExcludeBoundary(commonDirectory) {
  const info = path.join(commonDirectory, "info");
  try { directoryRealpath(info); }
  catch (error) { if (error?.code === "ENOENT") return; throw error; }
  try {
    const metadata = fs.lstatSync(path.join(info, "exclude"), { bigint: true });
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("repository_git_exclude_boundary_invalid");
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
    const repositoryRoot = directoryRealpath(input.repositoryRoot);
    const marker = path.join(repositoryRoot, ".git");
    const markerMetadata = fs.lstatSync(marker, { bigint: true });
    if (markerMetadata.isSymbolicLink()) return response("blocked", "repository_git_marker_link_rejected");

    let gitDirectory;
    let kind;
    if (markerMetadata.isDirectory()) {
      gitDirectory = directoryRealpath(marker);
      kind = "normal_worktree";
    } else if (markerMetadata.isFile()) {
      const control = readControlFile(marker);
      if (!control.startsWith("gitdir: ")) return response("blocked", "repository_git_file_invalid");
      const value = control.slice("gitdir: ".length);
      if (value.length === 0 || /[\u0000-\u001f\u007f]/u.test(value)) return response("blocked", "repository_git_file_invalid");
      gitDirectory = directoryRealpath(path.isAbsolute(value) ? value : path.resolve(repositoryRoot, value));
      kind = "gitfile_worktree";
    } else return response("blocked", "repository_git_marker_invalid");

    const commonDirectory = optionalCommonDirectory(gitDirectory) ?? gitDirectory;
    readControlFile(path.join(gitDirectory, "HEAD"));
    verifyRegularFile(path.join(commonDirectory, "config"), 1024 * 1024);
    verifyExistingExcludeBoundary(commonDirectory);
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
