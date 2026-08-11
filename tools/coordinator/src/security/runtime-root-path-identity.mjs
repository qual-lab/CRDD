import fs from "node:fs";
import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import {
  DEFAULT_REPOSITORY_RUNTIME_DIRECTORY,
  selectRuntimeRootCandidate
} from "./runtime-root-profile.mjs";
import {
  resolveRepositoryGitLayout,
  writeRepositoryLocalExclude
} from "./repository-git-layout-internal.mjs";

export const RUNTIME_ROOT_PATH_IDENTITY_CONTRACT =
  "crdd-coordinator/runtime-root-path-identity";
export const RUNTIME_ROOT_PATH_IDENTITY_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "repositoryRoot",
  "cliOverride",
  "environmentOverride",
  "activationIntent"
]);
const EXPLICIT_ENABLE = "explicit_enable_request";

function response(status, reason, summary = null) {
  return Object.freeze({
    status,
    reason,
    summary,
    absolutePathReported: false,
    filesystemIdentityReported: false,
    runtimeCapabilityIssued: false
  });
}

function directoryIdentity(metadata) {
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.dev <= 0n ||
      metadata.ino <= 0n || metadata.birthtimeNs <= 0n) {
    throw new Error("runtime_root_path_object_unsupported");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs;
}

function directorySnapshot(target) {
  const before = directoryIdentity(fs.lstatSync(target, { bigint: true }));
  const realPath = fs.realpathSync.native(target);
  const resolved = directoryIdentity(fs.lstatSync(realPath, { bigint: true }));
  const after = directoryIdentity(fs.lstatSync(target, { bigint: true }));
  if (!sameIdentity(before, resolved) || !sameIdentity(before, after)) {
    throw new Error("runtime_root_path_object_changed");
  }
  return Object.freeze({ realPath, identity: before });
}

function verifySnapshot(target, snapshot) {
  const current = directorySnapshot(target);
  if (!sameIdentity(snapshot.identity, current.identity) || current.realPath !== snapshot.realPath) {
    throw new Error("runtime_root_path_object_changed");
  }
}

function selectedPath(input) {
  return input.cliOverride ?? input.environmentOverride ??
    path.join(input.repositoryRoot, DEFAULT_REPOSITORY_RUNTIME_DIRECTORY);
}

function isStrictlyInside(relative) {
  return relative !== "" && relative !== "." && !path.isAbsolute(relative) &&
    relative !== ".." && !relative.startsWith(`..${path.sep}`);
}

function classifyContainment(repository, root) {
  const repositoryToRoot = path.relative(repository, root);
  if (repositoryToRoot === "" || repositoryToRoot === ".") return "same";
  if (isStrictlyInside(repositoryToRoot)) return "root_inside_repository";
  const rootToRepository = path.relative(root, repository);
  if (isStrictlyInside(rootToRepository)) return "root_contains_repository";
  return "disjoint";
}

function samePath(left, right) {
  return path.relative(left, right) === "";
}

function safeSource(input, profile) {
  const source = input.cliOverride !== null
    ? "cli_override"
    : input.environmentOverride !== null
      ? "environment_override"
      : "repository_default";
  if (profile.selection?.source !== source) throw new Error("runtime_root_selection_changed");
  return source;
}

function createIdentitySession(rawInput) {
  const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
  if (!input) throw new Error("runtime_root_path_identity_input_invalid");
  const profile = selectRuntimeRootCandidate(input);
  if (profile.status !== "candidate" || input.activationIntent !== EXPLICIT_ENABLE) {
    throw new Error("runtime_root_enable_candidate_required");
  }
  const source = safeSource(input, profile);
  const targets = Object.freeze({
    repository: path.resolve(input.repositoryRoot),
    root: path.resolve(selectedPath(input))
  });
  const completeTargets = Object.freeze({ ...targets, parent: path.dirname(targets.root) });
  const snapshots = Object.freeze({
    repository: directorySnapshot(completeTargets.repository),
    parent: directorySnapshot(completeTargets.parent),
    root: directorySnapshot(completeTargets.root)
  });
  if (!samePath(path.dirname(snapshots.root.realPath), snapshots.parent.realPath)) {
    throw new Error("runtime_root_parent_mismatch");
  }
  const lexicalRelation = classifyContainment(completeTargets.repository, completeTargets.root);
  const realRelation = classifyContainment(snapshots.repository.realPath, snapshots.root.realPath);
  if (lexicalRelation !== realRelation || realRelation === "same" ||
      realRelation === "root_contains_repository") {
    throw new Error("runtime_root_containment_ambiguous");
  }

  let location;
  if (realRelation === "root_inside_repository" &&
      sameIdentity(snapshots.repository.identity, snapshots.parent.identity) &&
      path.basename(snapshots.root.realPath) === DEFAULT_REPOSITORY_RUNTIME_DIRECTORY) {
    location = "repository_default_location";
  } else if (realRelation === "root_inside_repository") {
    location = "repository_internal_custom";
  } else if (realRelation === "disjoint") {
    location = "repository_external_override";
  } else {
    throw new Error("runtime_root_containment_ambiguous");
  }
  if (source === "repository_default" && location !== "repository_default_location") {
    throw new Error("runtime_root_default_location_mismatch");
  }
  const session = Object.freeze({
    input,
    source,
    location,
    lexicalRelation,
    realRelation,
    targets: completeTargets,
    snapshots
  });
  verifyIdentitySession(session);
  return session;
}

function verifyIdentitySession(session) {
  verifySnapshot(session.targets.repository, session.snapshots.repository);
  verifySnapshot(session.targets.parent, session.snapshots.parent);
  verifySnapshot(session.targets.root, session.snapshots.root);
  if (!samePath(path.dirname(session.snapshots.root.realPath), session.snapshots.parent.realPath) ||
      classifyContainment(session.targets.repository, session.targets.root) !== session.lexicalRelation ||
      classifyContainment(session.snapshots.repository.realPath, session.snapshots.root.realPath) !== session.realRelation) {
    throw new Error("runtime_root_path_object_changed");
  }
}

function repositoryRelativePath(repositoryRoot, runtimeRoot) {
  const relative = path.relative(repositoryRoot, runtimeRoot);
  if (relative === "" || relative === ".") return Object.freeze({ kind: "repository_root" });
  if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    return Object.freeze({ kind: "outside" });
  }
  return Object.freeze({ kind: "inside", relative });
}

function escapeGitIgnoreSegment(segment) {
  return segment.replace(/([\\*?\[\]#! ])/gu, "\\$1");
}

function exactExcludeEntry(relative) {
  const segments = relative.split(path.sep);
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === ".." ||
      /[\u0000-\u001f\u007f]/u.test(segment))) return null;
  return `/${segments.map(escapeGitIgnoreSegment).join("/")}/`;
}

function localExcludeResponse(status, reason, plan = null, write = {}) {
  return Object.freeze({
    status,
    reason,
    plan,
    gitMetadataWriteIssued: write.gitMetadataWriteIssued === true,
    gitMetadataWriteVerified: write.gitMetadataWriteVerified === true,
    runtimeCapabilityIssued: false
  });
}

export function inspectRuntimeRootPathIdentityCandidate(rawInput) {
  try {
    const session = createIdentitySession(rawInput);
    return response("candidate", "runtime_root_path_object_verified_candidate", Object.freeze({
      source: session.source,
      location: session.location,
      pathObjectIdentityVerification: "implemented_candidate",
      ownerAclVerification: "not_implemented",
      fullParentChainVerification: "not_implemented"
    }));
  } catch {
    return response("blocked", "runtime_root_path_identity_verification_blocked");
  }
}

export function applyGitLocalExcludeWithInitialRootSnapshotCandidate(rawInput) {
  let writeIssued = false;
  try {
    const session = createIdentitySession(rawInput);
    const location = repositoryRelativePath(session.targets.repository, session.targets.root);
    if (location.kind === "repository_root") {
      return localExcludeResponse("blocked", "runtime_root_must_not_equal_repository_root");
    }
    if (location.kind === "outside") {
      verifyIdentitySession(session);
      return localExcludeResponse("candidate", "repository_external_root_needs_no_git_exclude", Object.freeze({
        excludeRequired: false,
        excludeEntry: null,
        trackedGitignoreModificationAllowed: false
      }), { gitMetadataWriteVerified: true });
    }
    const firstSegment = location.relative.split(path.sep)[0];
    if (firstSegment.toLocaleLowerCase("en-US") === ".git") {
      return localExcludeResponse("blocked", "runtime_root_git_metadata_overlap");
    }
    const excludeEntry = exactExcludeEntry(location.relative);
    if (excludeEntry === null) return localExcludeResponse("blocked", "git_local_exclude_entry_invalid");
    const layout = resolveRepositoryGitLayout(session.targets.repository);
    if (layout.kind === "linked_worktree" && location.relative !== DEFAULT_REPOSITORY_RUNTIME_DIRECTORY) {
      return localExcludeResponse("blocked", "linked_worktree_repository_custom_root_rejected");
    }
    verifyIdentitySession(session);
    verifyIdentitySession(session);
    const result = writeRepositoryLocalExclude(layout, excludeEntry);
    writeIssued = result.changed;
    try {
      verifyIdentitySession(session);
    } catch {
      return localExcludeResponse("blocked", "runtime_root_path_identity_reverification_failed", null,
        { gitMetadataWriteIssued: writeIssued, gitMetadataWriteVerified: false });
    }
    return localExcludeResponse("candidate", "git_local_exclude_write_verified_candidate", Object.freeze({
      excludeRequired: true,
      excludeEntry,
      trackedGitignoreModificationAllowed: false
    }), { gitMetadataWriteIssued: result.changed, gitMetadataWriteVerified: result.verified });
  } catch (error) {
    writeIssued ||= error?.writeIssued === true;
    return localExcludeResponse("blocked", writeIssued
      ? "git_local_exclude_update_blocked"
      : "runtime_root_path_identity_candidate_required", null,
    { gitMetadataWriteIssued: writeIssued, gitMetadataWriteVerified: false });
  }
}

export function describeRuntimeRootPathIdentityContract() {
  return Object.freeze({
    contract: RUNTIME_ROOT_PATH_IDENTITY_CONTRACT,
    contractRevision: RUNTIME_ROOT_PATH_IDENTITY_CONTRACT_REVISION,
    existingRootRequired: true,
    rootCreationIssued: false,
    rootDeletionIssued: false,
    pathObjectIdentityVerification: "implemented_candidate",
    realpathContainmentVerification: "implemented_candidate",
    ownerAclVerification: "not_implemented",
    fullParentChainVerification: "not_implemented",
    localExcludeIntegration: "implemented_candidate_initial_snapshot_binding",
    activationIntegration: "not_implemented",
    absolutePathReported: false,
    filesystemIdentityReported: false,
    runtimeCapabilityIssued: false
  });
}
