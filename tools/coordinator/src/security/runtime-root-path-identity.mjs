import fs from "node:fs";
import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import {
  DEFAULT_REPOSITORY_RUNTIME_DIRECTORY,
  selectRuntimeRootCandidate
} from "./runtime-root-profile.mjs";

export const RUNTIME_ROOT_PATH_IDENTITY_CONTRACT =
  "crdd-coordinator/runtime-root-path-identity";
export const RUNTIME_ROOT_PATH_IDENTITY_CONTRACT_REVISION = 1;

const INPUT_KEYS = new Set([
  "repositoryRoot",
  "cliOverride",
  "environmentOverride",
  "activationIntent"
]);

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

function verifySnapshot(snapshot) {
  const current = directoryIdentity(fs.lstatSync(snapshot.realPath, { bigint: true }));
  if (!sameIdentity(snapshot.identity, current) ||
      fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath) {
    throw new Error("runtime_root_path_object_changed");
  }
}

function selectedPath(input) {
  return input.cliOverride ?? input.environmentOverride ??
    path.join(input.repositoryRoot, DEFAULT_REPOSITORY_RUNTIME_DIRECTORY);
}

function relation(parent, child) {
  const relative = path.relative(parent, child);
  if (relative === "" || relative === ".") return "same";
  if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    return "outside";
  }
  return "inside";
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

export function inspectRuntimeRootPathIdentityCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) return response("blocked", "runtime_root_path_identity_input_invalid");
    const profile = selectRuntimeRootCandidate(input);
    if (profile.status !== "candidate") {
      return response("blocked", "runtime_root_enable_candidate_required");
    }
    const source = safeSource(input, profile);
    const repositoryTarget = path.resolve(input.repositoryRoot);
    const rootTarget = path.resolve(selectedPath(input));
    const parentTarget = path.dirname(rootTarget);

    const repository = directorySnapshot(repositoryTarget);
    const parent = directorySnapshot(parentTarget);
    const root = directorySnapshot(rootTarget);

    if (!samePath(path.dirname(root.realPath), parent.realPath)) {
      throw new Error("runtime_root_parent_mismatch");
    }
    const lexicalRelation = relation(repositoryTarget, rootTarget);
    const realRelation = relation(repository.realPath, root.realPath);
    if (lexicalRelation !== realRelation || realRelation === "same") {
      throw new Error("runtime_root_containment_ambiguous");
    }

    let location;
    if (realRelation === "inside" && sameIdentity(repository.identity, parent.identity) &&
        path.basename(root.realPath) === DEFAULT_REPOSITORY_RUNTIME_DIRECTORY) {
      location = "repository_default_location";
    } else if (realRelation === "inside" &&
        relation(repository.realPath, parent.realPath) !== "outside") {
      location = "repository_internal_custom";
    } else if (realRelation === "outside" &&
        relation(repository.realPath, parent.realPath) === "outside") {
      location = "repository_external_override";
    } else {
      throw new Error("runtime_root_containment_ambiguous");
    }

    if (source === "repository_default" && location !== "repository_default_location") {
      throw new Error("runtime_root_default_location_mismatch");
    }

    verifySnapshot(repository);
    verifySnapshot(parent);
    verifySnapshot(root);
    return response("candidate", "runtime_root_path_object_verified_candidate", Object.freeze({
      source,
      location,
      pathObjectIdentityVerification: "implemented_candidate",
      ownerAclVerification: "not_implemented",
      fullParentChainVerification: "not_implemented"
    }));
  } catch {
    return response("blocked", "runtime_root_path_identity_verification_blocked");
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
    localExcludeIntegration: "not_implemented",
    activationIntegration: "not_implemented",
    absolutePathReported: false,
    filesystemIdentityReported: false,
    runtimeCapabilityIssued: false
  });
}
