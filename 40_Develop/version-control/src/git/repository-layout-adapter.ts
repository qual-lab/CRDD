import path from "node:path";
import { types as utilTypes } from "node:util";

import {
  resolveRepositoryGitLayout,
  summarizeRepositoryGitLayout,
} from "./repository-layout.ts";

export const GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT =
  "crdd-version-control/git-repository-layout-adapter/v1" as const;
export const GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT_REVISION = 1 as const;

const MAX_PATH_CHARACTERS = 4096;

function readExactRepositoryRoot(value: unknown): string | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== 1) return null;
    const descriptor = descriptors.repositoryRoot;
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      return null;
    const candidate = descriptor.value;
    return typeof candidate === "string" &&
      candidate.length > 0 &&
      candidate.length <= MAX_PATH_CHARACTERS &&
      path.isAbsolute(candidate) &&
      !/[\u0000-\u001f\u007f]/u.test(candidate)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

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

export function inspectGitRepositoryLayoutCandidate(rawInput: unknown) {
  const repositoryRoot = readExactRepositoryRoot(rawInput);
  if (repositoryRoot === null)
    return response("blocked", "repository_git_layout_input_invalid");
  try {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
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
    )
      return response("blocked", message);
    return response("blocked", "repository_git_layout_invalid");
  }
}

export function describeGitRepositoryLayoutAdapterContract() {
  return Object.freeze({
    contract: GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT,
    contractRevision: GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT_REVISION,
    supportedWorktreeForms: Object.freeze([
      "normal_worktree",
      "linked_worktree",
      "gitfile_worktree_without_core_worktree",
      "gitfile_worktree_with_matching_core_worktree",
    ]),
    supportedRepositoryFormat: "version_0_without_extensions_or_includes",
    gitCliAuthorityRequired: false,
    bareRepositorySupported: false,
    referencedSubmodulesModified: false,
    referencedRepositoriesModified: false,
    multiRepositoryWriteOperationSupported: false,
    commonGitDirectoryExcludeBackend: true,
    filesystemResolutionCore: "implemented",
    repositoryIdentityVerification: "repository_location_port",
    metadataPlacementLayoutVerification: "implemented_narrow_parser",
    metadataWriteIntegration: "repository_local_ignore_port",
    runtimeCapabilityIssued: false,
  });
}
