import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { selectRuntimeRootCandidate } from "./runtime-root-profile.mjs";

export const GIT_LOCAL_EXCLUDE_CONTRACT = "crdd-coordinator/git-local-exclude";
export const GIT_LOCAL_EXCLUDE_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "repositoryRoot",
  "cliOverride",
  "environmentOverride",
  "activationIntent"
]);
const EXPLICIT_ENABLE = "explicit_enable_request";

function response(status, reason, plan = null) {
  return Object.freeze({
    status,
    reason,
    plan,
    gitMetadataWriteIssued: false,
    runtimeCapabilityIssued: false
  });
}

function selectedRoot(input) {
  return input.cliOverride ?? input.environmentOverride ??
    path.join(input.repositoryRoot, ".crdd-runtime");
}

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

function escapeGitIgnoreSegment(segment) {
  return segment.replace(/([\\*?\[\]#! ])/gu, "\\$1");
}

function exactExcludeEntry(relative) {
  const segments = relative.split(path.sep);
  if (segments.some((segment) =>
    segment.length === 0 || segment === "." || segment === ".." || /[\u0000-\u001f\u007f]/u.test(segment))) {
    return null;
  }
  return `/${segments.map(escapeGitIgnoreSegment).join("/")}/`;
}

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

    const firstSegment = location.relative.split(path.sep)[0];
    if (firstSegment.toLocaleLowerCase("en-US") === ".git") {
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
    return response("blocked", "git_local_exclude_input_invalid");
  }
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
    repositoryGitDirectoryResolution: "not_implemented",
    metadataWriteIntegration: "not_implemented",
    runtimeCapabilityIssued: false
  });
}
