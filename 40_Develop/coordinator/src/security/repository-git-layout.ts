import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  resolveRepositoryGitLayout,
  summarizeRepositoryGitLayout,
} from "./repository-git-layout-internal.ts";

export const REPOSITORY_GIT_LAYOUT_CONTRACT =
  "crdd-coordinator/repository-git-layout";
export const REPOSITORY_GIT_LAYOUT_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set(["repositoryRoot"]);
const MAX_PATH_CHARACTERS = 4096;

/**
 * @template T
 * @param {string} status
 * @param {string} reason
 * @param {T | null} [layout]
 */
function response<const S extends string, T>(
  status: S,
  reason: string,
  layout: T | null = null,
) {
  return Object.freeze({
    status,
    reason,
    layout,
    pathsRecorded: false,
    gitMetadataWriteIssued: false,
    runtimeCapabilityIssued: false,
  });
}

/** @param {unknown} value @returns {value is string} */
function validAbsolutePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PATH_CHARACTERS &&
    path.isAbsolute(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/** @param {unknown} rawInput */
export function inspectRepositoryGitLayoutCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input || !validAbsolutePath(input.repositoryRoot)) {
      return response("blocked", "repository_git_layout_input_invalid");
    }
    const layout = resolveRepositoryGitLayout(input.repositoryRoot);
    return response(
      "candidate",
      "repository_git_layout_resolved_candidate",
      summarizeRepositoryGitLayout(layout),
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    const message = error instanceof Error ? error.message : "";
    if (code === "ENOENT")
      return response("blocked", "repository_worktree_required");
    if (
      [
        "repository_git_marker_link_rejected",
        "repository_git_file_invalid",
        "repository_git_marker_invalid",
        "repository_git_config_unsupported",
      ].includes(message)
    ) {
      return response("blocked", message);
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
      "gitfile_worktree_without_core_worktree",
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
    runtimeCapabilityIssued: false,
  });
}
