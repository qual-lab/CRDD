import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import {
  resolveRepositoryGitLayout,
  summarizeRepositoryGitLayout
} from "./repository-git-layout-internal.mjs";

export const REPOSITORY_GIT_LAYOUT_CONTRACT = "crdd-coordinator/repository-git-layout";
export const REPOSITORY_GIT_LAYOUT_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set(["repositoryRoot"]);
const MAX_PATH_CHARACTERS = 4096;

function response(status, reason, layout = null) {
  return Object.freeze({ status, reason, layout, pathsRecorded: false,
    gitMetadataWriteIssued: false, runtimeCapabilityIssued: false });
}

function validAbsolutePath(value) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAX_PATH_CHARACTERS && path.isAbsolute(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

export function inspectRepositoryGitLayoutCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || !validAbsolutePath(input.repositoryRoot)) {
      return response("blocked", "repository_git_layout_input_invalid");
    }
    const layout = resolveRepositoryGitLayout(input.repositoryRoot);
    return response("candidate", "repository_git_layout_resolved_candidate",
      summarizeRepositoryGitLayout(layout));
  } catch (error) {
    if (error?.code === "ENOENT") return response("blocked", "repository_worktree_required");
    if (["repository_git_marker_link_rejected", "repository_git_file_invalid",
      "repository_git_marker_invalid", "repository_git_config_unsupported"].includes(error?.message)) {
      return response("blocked", error.message);
    }
    return response("blocked", "repository_git_layout_invalid");
  }
}

export function describeRepositoryGitLayoutContract() {
  return Object.freeze({
    contract: REPOSITORY_GIT_LAYOUT_CONTRACT,
    contractRevision: REPOSITORY_GIT_LAYOUT_CONTRACT_REVISION,
    supportedWorktreeForms: Object.freeze([
      "normal_worktree",
      "linked_worktree",
      "gitfile_worktree_without_core_worktree"
    ]),
    supportedRepositoryFormat: "version_0_without_extensions_or_includes",
    gitCliAuthorityRequired: false,
    bareRepositorySupported: false,
    referencedSubmodulesModified: false,
    referencedRepositoriesModified: false,
    multiRepositoryWriteOperationSupported: false,
    commonGitDirectoryExcludeBackend: true,
    filesystemResolutionCore: "implemented_candidate",
    repositoryIdentityVerification: "not_implemented",
    metadataPlacementLayoutVerification: "implemented_narrow_parser_candidate",
    metadataWriteIntegration: "implemented_candidate",
    metadataWriteActivationIntegration: "not_implemented",
    runtimeCapabilityIssued: false
  });
}
