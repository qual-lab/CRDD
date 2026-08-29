import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  resolveRepositoryGitLayout,
  summarizeRepositoryGitLayout,
} from "./repository-git-layout-internal.ts";
import {
  DEFAULT_REPOSITORY_RUNTIME_DIRECTORY,
  selectRuntimeRootCandidate,
} from "./runtime-root-profile.ts";
import { applyGitLocalExcludeWithInitialRootSnapshotCandidate } from "./runtime-root-path-identity.ts";

export const GIT_LOCAL_EXCLUDE_CONTRACT = "crdd-coordinator/git-local-exclude";
export const GIT_LOCAL_EXCLUDE_CONTRACT_REVISION = 2;

const INPUT_KEYS = new Set([
  "repositoryRoot",
  "cliOverride",
  "environmentOverride",
  "activationIntent",
]);
const EXPLICIT_ENABLE = "explicit_enable_request";

type RootSelectionInput = Readonly<{
  repositoryRoot: string;
  cliOverride: string | null;
  environmentOverride: string | null;
  activationIntent: unknown;
}>;

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function response<const S extends string, T>(
  status: S,
  reason: string,
  plan: T | null = null,
  write: Readonly<{
    gitMetadataWriteIssued?: boolean;
    gitMetadataWriteVerified?: boolean;
  }> = {},
) {
  return Object.freeze({
    status,
    reason,
    plan,
    gitMetadataWriteIssued: write.gitMetadataWriteIssued === true,
    gitMetadataWriteVerified: write.gitMetadataWriteVerified === true,
    runtimeCapabilityIssued: false,
  });
}

function selectedRoot(input: RootSelectionInput) {
  return (
    input.cliOverride ??
    input.environmentOverride ??
    path.join(input.repositoryRoot, ".crdd-runtime")
  );
}

/**
 */
function repositoryRelativePath(
  repositoryRoot: string,
  runtimeRoot: string,
):
  | { kind: "repository_root" }
  | { kind: "outside" }
  | { kind: "inside"; relative: string } {
  const relative = path.relative(repositoryRoot, runtimeRoot);
  if (relative === "" || relative === ".") {
    return { kind: "repository_root" };
  }
  if (
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    return { kind: "outside" };
  }
  return { kind: "inside", relative };
}

function escapeGitIgnoreSegment(segment: string) {
  return segment.replace(/([\\*?[\]#! ])/gu, "\\$1");
}

function exactExcludeEntry(relative: string) {
  const segments = relative.split(path.sep);
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        /[\u0000-\u001f\u007f]/u.test(segment),
    )
  ) {
    return null;
  }
  return `/${segments.map(escapeGitIgnoreSegment).join("/")}/`;
}

export function compileGitLocalExcludeCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) {
      return response("blocked", "git_local_exclude_input_invalid");
    }
    if (
      typeof input.repositoryRoot !== "string" ||
      !nullableString(input.cliOverride) ||
      !nullableString(input.environmentOverride)
    ) {
      return response("blocked", "git_local_exclude_input_invalid");
    }
    const cliOverride = input.cliOverride;
    const environmentOverride = input.environmentOverride;
    const normalizedInput: RootSelectionInput = {
      repositoryRoot: input.repositoryRoot,
      cliOverride,
      environmentOverride,
      activationIntent: input.activationIntent,
    };
    const rootCandidate = selectRuntimeRootCandidate(normalizedInput);
    if (
      rootCandidate.status !== "candidate" ||
      input.activationIntent !== EXPLICIT_ENABLE
    ) {
      return response("blocked", "runtime_root_enable_candidate_required");
    }

    const location = repositoryRelativePath(
      normalizedInput.repositoryRoot,
      selectedRoot(normalizedInput),
    );
    if (location.kind === "repository_root") {
      return response("blocked", "runtime_root_must_not_equal_repository_root");
    }
    if (location.kind === "outside") {
      return response(
        "blocked",
        "runtime_root_external_write_authorization_required",
      );
    }

    const layout = resolveRepositoryGitLayout(normalizedInput.repositoryRoot);
    const layoutSummary = summarizeRepositoryGitLayout(layout);
    if (
      layoutSummary.kind === "linked_worktree" &&
      location.relative !== DEFAULT_REPOSITORY_RUNTIME_DIRECTORY
    ) {
      return response(
        "blocked",
        "linked_worktree_repository_custom_root_rejected",
      );
    }

    const firstSegment = location.relative.split(path.sep)[0];
    if (firstSegment?.toLocaleLowerCase("en-US") === ".git") {
      return response("blocked", "runtime_root_git_metadata_overlap");
    }

    const excludeEntry = exactExcludeEntry(location.relative);
    if (excludeEntry === null) {
      return response("blocked", "git_local_exclude_entry_invalid");
    }
    return response(
      "candidate",
      "git_local_exclude_write_and_verification_required",
      Object.freeze({
        excludeRequired: true,
        excludeEntry,
        trackedGitignoreModificationAllowed: false,
      }),
    );
  } catch {
    return response("blocked", "repository_git_layout_candidate_required");
  }
}

export function applyGitLocalExcludeCandidate(rawInput: unknown) {
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
    linkedWorktreeExternalOverrideAllowed: false,
    repositoryExternalOverride:
      "blocked_until_runtime_owned_human_authorization_is_implemented",
    metadataWriteIntegration: "implemented_candidate",
    runtimeRootPathIdentityPrePostVerification:
      "implemented_candidate_initial_snapshot_binding",
    runtimeRootIdentityDescriptorTransfer: false,
    metadataWriteActivationIntegration: "not_implemented",
    maximumExcludeBytes: 131072,
    existingGitInfoDirectoryRequired: true,
    runtimeCapabilityIssued: false,
  });
}
