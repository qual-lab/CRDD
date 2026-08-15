// @ts-check

import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import {
  resolveRepositoryGitLayout,
  summarizeRepositoryGitLayout
} from "./repository-git-layout-internal.mjs";
import {
  DEFAULT_REPOSITORY_RUNTIME_DIRECTORY,
  selectRuntimeRootCandidate
} from "./runtime-root-profile.ts";
import { applyGitLocalExcludeWithInitialRootSnapshotCandidate } from "./runtime-root-path-identity.mjs";

export const GIT_LOCAL_EXCLUDE_CONTRACT = "crdd-coordinator/git-local-exclude";
export const GIT_LOCAL_EXCLUDE_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "repositoryRoot",
  "cliOverride",
  "environmentOverride",
  "activationIntent"
]);
const EXPLICIT_ENABLE = "explicit_enable_request";

/**
 * @template T
 * @param {string} status
 * @param {string} reason
 * @param {T | null} [plan]
 * @param {{gitMetadataWriteIssued?: boolean, gitMetadataWriteVerified?: boolean}} [write]
 */
function response(status, reason, plan = null, write = {}) {
  return Object.freeze({
    status,
    reason,
    plan,
    gitMetadataWriteIssued: write.gitMetadataWriteIssued === true,
    gitMetadataWriteVerified: write.gitMetadataWriteVerified === true,
    runtimeCapabilityIssued: false
  });
}

/** @param {Record<string, any>} input */
function selectedRoot(input) {
  return input.cliOverride ?? input.environmentOverride ??
    path.join(input.repositoryRoot, ".crdd-runtime");
}

/**
 * @param {string} repositoryRoot
 * @param {string} runtimeRoot
 * @returns {{kind: "repository_root"} | {kind: "outside"} | {kind: "inside", relative: string}}
 */
function repositoryRelativePath(repositoryRoot, runtimeRoot) {
  const relative = path.relative(repositoryRoot, runtimeRoot);
  if (relative === "" || relative === ".") {
    return { kind: "repository_root" };
  }
  if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    return { kind: "outside" };
  }
  return { kind: "inside", relative };
}

/** @param {string} segment */
function escapeGitIgnoreSegment(segment) {
  return segment.replace(/([\\*?\[\]#! ])/gu, "\\$1");
}

/** @param {string} relative */
function exactExcludeEntry(relative) {
  const segments = relative.split(path.sep);
  if (segments.some((segment) =>
    segment.length === 0 || segment === "." || segment === ".." || /[\u0000-\u001f\u007f]/u.test(segment))) {
    return null;
  }
  return `/${segments.map(escapeGitIgnoreSegment).join("/")}/`;
}

/** @param {unknown} rawInput */
export function compileGitLocalExcludeCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) {
      return response("blocked", "git_local_exclude_input_invalid");
    }
    const rootCandidate = selectRuntimeRootCandidate(input);
    if (rootCandidate.status !== "candidate" || input.activationIntent !== EXPLICIT_ENABLE) {
      return response("blocked", "runtime_root_enable_candidate_required");
    }

    const location = repositoryRelativePath(input.repositoryRoot, selectedRoot(input));
    if (location.kind === "repository_root") {
      return response("blocked", "runtime_root_must_not_equal_repository_root");
    }
    if (location.kind === "outside") {
      return response("candidate", "repository_external_root_needs_no_git_exclude", Object.freeze({
        excludeRequired: false,
        excludeEntry: null,
        trackedGitignoreModificationAllowed: false
      }));
    }

    const layout = resolveRepositoryGitLayout(input.repositoryRoot);
    const layoutSummary = summarizeRepositoryGitLayout(layout);
    if (layoutSummary.kind === "linked_worktree" &&
        location.relative !== DEFAULT_REPOSITORY_RUNTIME_DIRECTORY) {
      return response("blocked", "linked_worktree_repository_custom_root_rejected");
    }

    const firstSegment = location.relative.split(path.sep)[0];
    if (firstSegment?.toLocaleLowerCase("en-US") === ".git") {
      return response("blocked", "runtime_root_git_metadata_overlap");
    }

    const excludeEntry = exactExcludeEntry(location.relative);
    if (excludeEntry === null) {
      return response("blocked", "git_local_exclude_entry_invalid");
    }
    return response("candidate", "git_local_exclude_write_and_verification_required", Object.freeze({
      excludeRequired: true,
      excludeEntry,
      trackedGitignoreModificationAllowed: false
    }));
  } catch {
    return response("blocked", "repository_git_layout_candidate_required");
  }
}

/** @param {unknown} rawInput */
export function applyGitLocalExcludeCandidate(rawInput) {
  return applyGitLocalExcludeWithInitialRootSnapshotCandidate(rawInput);
}

export function describeGitLocalExcludeContract() {
  return Object.freeze({
    contract: GIT_LOCAL_EXCLUDE_CONTRACT,
    contractRevision: GIT_LOCAL_EXCLUDE_CONTRACT_REVISION,
    repositoryContainedRootBackend: ".git/info/exclude",
    repositoryExternalRootRequiresExclude: false,
    trackedGitignoreModificationAllowed: false,
    exactRootRelativeEntryRequired: true,
    idempotentWriteRequired: true,
    postWriteVerificationRequired: true,
    writeFailureBlocksActivation: true,
    gitIgnoreIsSecurityBoundary: false,
    repositoryGitDirectoryResolution: "implemented_candidate",
    linkedWorktreeDefaultRootAllowed: true,
    linkedWorktreeRepositoryContainedCustomRootAllowed: false,
    linkedWorktreeExternalOverrideAllowed: true,
    metadataWriteIntegration: "implemented_candidate",
    runtimeRootPathIdentityPrePostVerification: "implemented_candidate_initial_snapshot_binding",
    runtimeRootIdentityDescriptorTransfer: false,
    metadataWriteActivationIntegration: "not_implemented",
    maximumExcludeBytes: 131072,
    existingGitInfoDirectoryRequired: true,
    runtimeCapabilityIssued: false
  });
}
