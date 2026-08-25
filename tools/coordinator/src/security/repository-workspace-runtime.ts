import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { persistRuntimeOwnedCandidateBundle } from "./candidate-bundle-store.ts";
import { verifyOwnedOperationManagementMountBinding } from "./execution-environment.ts";
import { materializeGitCommitTreeCandidate } from "./git-object-reader.ts";
import {
  borrowRuntimeOwnedRepositorySource,
  verifyRuntimeOwnedRepositoryBindingCapability,
} from "./repository-operation-runtime.ts";

export const REPOSITORY_WORKSPACE_RUNTIME_CONTRACT =
  "crdd-coordinator/repository-workspace-runtime";
export const REPOSITORY_WORKSPACE_RUNTIME_CONTRACT_REVISION = 4;

const MAXIMUM_FILE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_WORKSPACE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_WORKSPACE_FILES = 20_000;
const MAXIMUM_CHANGED_PATHS = 1_000;
const MAXIMUM_CANDIDATE_CONTENT_BYTES = 16 * 1024 * 1024;
const MAXIMUM_ALLOWED_PATHS = 64;
const MAXIMUM_ALLOWED_PATH_BYTES = 1_024;
const RESERVED_WINDOWS_SEGMENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_WINDOWS_CHARACTER = /[<>:"|?*\\\x00-\x1f\x7f]/u;

type InventoryEntry = Readonly<{
  relativePath: string;
  byteLength: number;
  sha256: string;
}>;
type WorkspaceRecord = Readonly<{
  managementCapability: object;
  mountCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  baseEntries: ReadonlyMap<string, InventoryEntry>;
}>;
type CandidateRecord = Readonly<{
  workspaceRecord: WorkspaceRecord;
  allowedPathsHash: string;
  contentManifestHash: string;
  patchHash: string;
  changedPaths: readonly string[];
}>;

const workspaces = new WeakMap<object, WorkspaceRecord>();
const candidates = new WeakMap<object, CandidateRecord>();

function validSegment(segment: string) {
  return !(
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.toLowerCase() === ".git" ||
    Buffer.byteLength(segment, "utf8") > 255 ||
    INVALID_WINDOWS_CHARACTER.test(segment) ||
    RESERVED_WINDOWS_SEGMENT.test(segment) ||
    segment.endsWith(".") ||
    segment.endsWith(" ")
  );
}

function validRelativePath(relativePath: string) {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    Buffer.byteLength(relativePath, "utf8") <= MAXIMUM_ALLOWED_PATH_BYTES &&
    !relativePath.includes("\\") &&
    relativePath.split("/").every(validSegment)
  );
}

function stableFile(target: string, maximumBytes: number) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("repository_workspace_file_invalid");
    }
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let readBytes = 0;
    while (readBytes < Number(before.size)) {
      const readLength = fs.readSync(
        handle,
        buffer,
        0,
        Math.min(buffer.byteLength, Number(before.size) - readBytes),
        readBytes,
      );
      if (readLength <= 0) throw new Error("repository_workspace_file_changed");
      hash.update(buffer.subarray(0, readLength));
      readBytes += readLength;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      throw new Error("repository_workspace_file_changed");
    }
    const current = fs.lstatSync(target, { bigint: true });
    if (
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs
    ) {
      throw new Error("repository_workspace_file_changed");
    }
    return Object.freeze({
      byteLength: Number(before.size),
      sha256: hash.digest("hex"),
    });
  } finally {
    fs.closeSync(handle);
  }
}

function stableFileContent(target: string, maximumBytes: number) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("repository_workspace_file_invalid");
    }
    const content = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < content.byteLength) {
      const readBytes = fs.readSync(
        handle,
        content,
        offset,
        content.byteLength - offset,
        offset,
      );
      if (readBytes <= 0) throw new Error("repository_workspace_file_changed");
      offset += readBytes;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    const current = fs.lstatSync(target, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs
    ) {
      throw new Error("repository_workspace_file_changed");
    }
    return Object.freeze({
      content,
      byteLength: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  } finally {
    fs.closeSync(handle);
  }
}

function inventory(workspace: string) {
  const root = fs.realpathSync.native(workspace);
  const rootMetadata = fs.lstatSync(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink())
    throw new Error("repository_workspace_root_invalid");
  const entries: InventoryEntry[] = [];
  const comparisonPaths = new Set<string>();
  let totalBytes = 0;

  function visit(directory: string, parentPath: string, depth: number) {
    if (depth > 64) throw new Error("repository_workspace_depth_exceeded");
    const directoryEntries = fs.readdirSync(directory, { withFileTypes: true });
    const comparisonNames = new Set<string>();
    for (const entry of directoryEntries) {
      if (!validSegment(entry.name))
        throw new Error("repository_workspace_path_invalid");
      const comparisonName = entry.name.toUpperCase();
      if (comparisonNames.has(comparisonName))
        throw new Error("repository_workspace_case_collision");
      comparisonNames.add(comparisonName);
      const relativePath = parentPath
        ? `${parentPath}/${entry.name}`
        : entry.name;
      if (!validRelativePath(relativePath))
        throw new Error("repository_workspace_path_invalid");
      const target = path.join(directory, entry.name);
      const metadata = fs.lstatSync(target);
      if (metadata.isSymbolicLink())
        throw new Error("repository_workspace_link_rejected");
      if (entry.isDirectory() && metadata.isDirectory()) {
        visit(target, relativePath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !metadata.isFile())
        throw new Error("repository_workspace_entity_rejected");
      const comparisonPath = relativePath.toUpperCase();
      if (comparisonPaths.has(comparisonPath))
        throw new Error("repository_workspace_case_collision");
      comparisonPaths.add(comparisonPath);
      const observed = stableFile(target, MAXIMUM_FILE_BYTES);
      totalBytes += observed.byteLength;
      if (
        entries.length + 1 > MAXIMUM_WORKSPACE_FILES ||
        totalBytes > MAXIMUM_WORKSPACE_BYTES
      ) {
        throw new Error("repository_workspace_budget_exceeded");
      }
      entries.push(
        Object.freeze({
          relativePath,
          byteLength: observed.byteLength,
          sha256: observed.sha256,
        }),
      );
    }
  }

  visit(root, "", 0);
  entries.sort((left, right) =>
    Buffer.from(left.relativePath).compare(Buffer.from(right.relativePath)),
  );
  return Object.freeze(entries);
}

function manifestHash(entries: readonly InventoryEntry[]) {
  const hash = createHash("sha256").update("crdd-workspace-inventory-v1\0");
  for (const entry of entries) {
    hash
      .update(entry.relativePath)
      .update("\0")
      .update(entry.byteLength.toString())
      .update("\0")
      .update(entry.sha256)
      .update("\0");
  }
  return hash.digest("hex");
}

function entryMap(entries: readonly InventoryEntry[]) {
  return new Map(entries.map((entry) => [entry.relativePath, entry]));
}

function allowedPaths(rawAllowedPaths: unknown) {
  if (
    !Array.isArray(rawAllowedPaths) ||
    rawAllowedPaths.length > MAXIMUM_ALLOWED_PATHS
  )
    return null;
  const normalizedAllowedPaths: string[] = [];
  try {
    const descriptors = Object.getOwnPropertyDescriptors(rawAllowedPaths);
    for (let index = 0; index < rawAllowedPaths.length; index += 1) {
      const descriptor = descriptors[index.toString()];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      )
        return null;
      const isDirectory = descriptor.value.endsWith("/");
      const relativePath = isDirectory
        ? descriptor.value.slice(0, -1)
        : descriptor.value;
      if (!validRelativePath(relativePath)) return null;
      normalizedAllowedPaths.push(
        isDirectory ? `${relativePath}/` : relativePath,
      );
    }
  } catch {
    return null;
  }
  const uniqueAllowedPaths = [...new Set(normalizedAllowedPaths)].sort(
    (left, right) => Buffer.from(left).compare(Buffer.from(right)),
  );
  return uniqueAllowedPaths.length === normalizedAllowedPaths.length &&
    uniqueAllowedPaths.length > 0
    ? Object.freeze(uniqueAllowedPaths)
    : null;
}

function isAllowed(relativePath: string, paths: readonly string[]) {
  return paths.some((allowedPath) =>
    allowedPath.endsWith("/")
      ? relativePath.startsWith(allowedPath)
      : relativePath === allowedPath,
  );
}

function changedPaths(
  baseEntries: ReadonlyMap<string, InventoryEntry>,
  currentEntries: ReadonlyMap<string, InventoryEntry>,
) {
  const paths = new Set([...baseEntries.keys(), ...currentEntries.keys()]);
  return [...paths]
    .filter((relativePath) => {
      const before = baseEntries.get(relativePath);
      const after = currentEntries.get(relativePath);
      return (
        !before ||
        !after ||
        before.byteLength !== after.byteLength ||
        before.sha256 !== after.sha256
      );
    })
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

export function materializeRuntimeOwnedRepositoryWorkspace(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawReadPaths?: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !mountCapability ||
      typeof mountCapability !== "object"
    ) {
      return null;
    }
    const source = borrowRuntimeOwnedRepositorySource(
      repositoryBindingCapability,
      managementCapability,
    );
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    if (!source || source.operationId !== binding.operationId) return null;
    const readPaths =
      rawReadPaths === undefined ? null : allowedPaths(rawReadPaths);
    if (rawReadPaths !== undefined && !readPaths) return null;
    const materialized = materializeGitCommitTreeCandidate({
      commonDirectory: source.commonDirectory,
      revision: source.revision,
      workspace: binding.mounts.workspace,
      ...(readPaths ? { readPaths } : {}),
    });
    if (!materialized) return null;
    const verifiedRepository = verifyRuntimeOwnedRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    if (!verifiedRepository) return null;
    const baseInventory = inventory(binding.mounts.workspace);
    const baseManifestHash = manifestHash(baseInventory);
    const workspaceCapability = Object.freeze({});
    const workspaceRecord = Object.freeze({
      managementCapability,
      mountCapability,
      repositoryBindingCapability,
      operationId: binding.operationId,
      baseCommit: materialized.baseCommit,
      baseTree: materialized.baseTree,
      baseManifestHash,
      baseEntries: entryMap(baseInventory),
    });
    workspaces.set(workspaceCapability, workspaceRecord);
    return Object.freeze({
      status: "materialized" as const,
      operationId: binding.operationId,
      baseCommit: workspaceRecord.baseCommit,
      baseTree: workspaceRecord.baseTree,
      baseManifestHash,
      fileCount: baseInventory.length,
      readProjectionHash: readPaths
        ? createHash("sha256")
            .update("crdd-read-projection-v1\0")
            .update(readPaths.join("\0"))
            .digest("hex")
        : null,
      workspaceCapability,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

function currentWorkspaceRecord(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
) {
  if (
    !workspaceCapability ||
    typeof workspaceCapability !== "object" ||
    !repositoryBindingCapability ||
    typeof repositoryBindingCapability !== "object" ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !mountCapability ||
    typeof mountCapability !== "object"
  ) {
    return null;
  }
  const workspaceRecord = workspaces.get(workspaceCapability);
  if (
    !workspaceRecord ||
    workspaceRecord.managementCapability !== managementCapability ||
    workspaceRecord.mountCapability !== mountCapability ||
    workspaceRecord.repositoryBindingCapability !== repositoryBindingCapability
  ) {
    return null;
  }
  const repository = verifyRuntimeOwnedRepositoryBindingCapability(
    repositoryBindingCapability,
    managementCapability,
  );
  const binding = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  );
  return repository?.revision === workspaceRecord.baseCommit &&
    binding.operationId === workspaceRecord.operationId
    ? Object.freeze({ workspaceRecord, workspace: binding.mounts.workspace })
    : null;
}

export function captureRuntimeOwnedCandidateRevision(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawAllowedPaths: unknown,
) {
  try {
    const current = currentWorkspaceRecord(
      workspaceCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    const normalizedAllowedPaths = allowedPaths(rawAllowedPaths);
    if (!current || !normalizedAllowedPaths) return null;
    const currentInventory = inventory(current.workspace);
    const currentEntries = entryMap(currentInventory);
    const changes = changedPaths(
      current.workspaceRecord.baseEntries,
      currentEntries,
    );
    if (
      changes.length > MAXIMUM_CHANGED_PATHS ||
      changes.some(
        (relativePath) => !isAllowed(relativePath, normalizedAllowedPaths),
      )
    ) {
      return null;
    }
    const contentManifestHash = manifestHash(currentInventory);
    const allowedPathsHash = createHash("sha256")
      .update("crdd-allowed-paths-v1\0")
      .update(normalizedAllowedPaths.join("\0"))
      .digest("hex");
    const patchHash = createHash("sha256")
      .update("crdd-candidate-revision-v1\0")
      .update(current.workspaceRecord.baseCommit)
      .update("\0")
      .update(current.workspaceRecord.baseTree)
      .update("\0")
      .update(current.workspaceRecord.baseManifestHash)
      .update("\0")
      .update(contentManifestHash)
      .update("\0")
      .update(allowedPathsHash)
      .update("\0")
      .update(changes.join("\0"))
      .digest("hex");
    const candidateCapability = Object.freeze({});
    const record = Object.freeze({
      workspaceRecord: current.workspaceRecord,
      allowedPathsHash,
      contentManifestHash,
      patchHash,
      changedPaths: Object.freeze(changes),
    });
    candidates.set(candidateCapability, record);
    return Object.freeze({
      status: "candidate" as const,
      operationId: current.workspaceRecord.operationId,
      baseCommit: current.workspaceRecord.baseCommit,
      baseTree: current.workspaceRecord.baseTree,
      patchHash,
      contentManifestHash,
      allowedPathsHash,
      changedPaths: record.changedPaths,
      candidateCapability,
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

export function verifyRuntimeOwnedCandidateRevision(
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
) {
  try {
    if (!candidateCapability || typeof candidateCapability !== "object")
      return null;
    const record = candidates.get(candidateCapability);
    if (
      !record ||
      record.workspaceRecord.repositoryBindingCapability !==
        repositoryBindingCapability ||
      record.workspaceRecord.managementCapability !== managementCapability ||
      record.workspaceRecord.mountCapability !== mountCapability ||
      !verifyRuntimeOwnedRepositoryBindingCapability(
        repositoryBindingCapability,
        managementCapability,
      )
    ) {
      return null;
    }
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    const currentInventory = inventory(binding.mounts.workspace);
    if (manifestHash(currentInventory) !== record.contentManifestHash)
      return null;
    return Object.freeze({
      status: "verified" as const,
      operationId: record.workspaceRecord.operationId,
      baseCommit: record.workspaceRecord.baseCommit,
      baseTree: record.workspaceRecord.baseTree,
      patchHash: record.patchHash,
      contentManifestHash: record.contentManifestHash,
      allowedPathsHash: record.allowedPathsHash,
      changedPaths: record.changedPaths,
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

export function persistRuntimeOwnedCandidateRevision(
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  persistencePolicy: unknown,
) {
  try {
    if (!candidateCapability || typeof candidateCapability !== "object")
      return null;
    const record = candidates.get(candidateCapability);
    if (
      !record ||
      record.workspaceRecord.repositoryBindingCapability !==
        repositoryBindingCapability ||
      record.workspaceRecord.managementCapability !== managementCapability ||
      record.workspaceRecord.mountCapability !== mountCapability ||
      !verifyRuntimeOwnedRepositoryBindingCapability(
        repositoryBindingCapability,
        managementCapability,
      )
    ) {
      return null;
    }
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    const currentInventory = inventory(binding.mounts.workspace);
    const currentEntries = entryMap(currentInventory);
    if (manifestHash(currentInventory) !== record.contentManifestHash)
      return null;
    let totalBytes = 0;
    const entries = [];
    for (const relativePath of record.changedPaths) {
      const inventoryEntry = currentEntries.get(relativePath);
      if (!inventoryEntry) {
        entries.push(
          Object.freeze({
            relativePath,
            operation: "delete" as const,
            byteLength: 0,
            sha256: null,
            contentBase64: null,
          }),
        );
        continue;
      }
      const remainingBytes = MAXIMUM_CANDIDATE_CONTENT_BYTES - totalBytes;
      if (remainingBytes < 0) return null;
      const observed = stableFileContent(
        path.join(binding.mounts.workspace, ...relativePath.split("/")),
        Math.min(MAXIMUM_FILE_BYTES, remainingBytes),
      );
      if (
        observed.byteLength !== inventoryEntry.byteLength ||
        observed.sha256 !== inventoryEntry.sha256
      ) {
        return null;
      }
      totalBytes += observed.byteLength;
      entries.push(
        Object.freeze({
          relativePath,
          operation: "upsert" as const,
          byteLength: observed.byteLength,
          sha256: observed.sha256,
          contentBase64: observed.content.toString("base64"),
        }),
      );
    }
    const persisted = persistRuntimeOwnedCandidateBundle(
      Object.freeze({
        schema: "crdd-coordinator-candidate-bundle/v1",
        baseCommit: record.workspaceRecord.baseCommit,
        baseTree: record.workspaceRecord.baseTree,
        baseManifestHash: record.workspaceRecord.baseManifestHash,
        patchHash: record.patchHash,
        contentManifestHash: record.contentManifestHash,
        allowedPathsHash: record.allowedPathsHash,
        changedPaths: record.changedPaths,
        entries: Object.freeze(entries),
      }),
      persistencePolicy,
    );
    if (!persisted) return null;
    if (persisted.status !== "staged") return persisted;
    return Object.freeze({
      status: "staged" as const,
      candidateRecoveryId: persisted.candidateRecoveryId,
      bundleHash: persisted.bundleHash,
      byteLength: persisted.byteLength,
      expiresAtMs: persisted.expiresAtMs,
      hostPathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

export function describeRepositoryWorkspaceRuntimeContract() {
  return Object.freeze({
    contract: REPOSITORY_WORKSPACE_RUNTIME_CONTRACT,
    contractRevision: REPOSITORY_WORKSPACE_RUNTIME_CONTRACT_REVISION,
    source: "exact_head_commit_tree_without_external_git_cli",
    providerReadProjection:
      "explicit_file_or_directory_prefix_plus_write_scope",
    providerGitMetadataVisible: false,
    workspaceWrite: "isolated_runtime_owned_only",
    allowedPathGuard: "exact_file_or_directory_prefix_fail_closed",
    candidateRevision: Object.freeze([
      "base_commit",
      "base_tree",
      "patch_hash",
      "content_manifest_hash",
      "allowed_paths_hash",
    ]),
    approvedCandidateTransfer:
      "policy_bounded_staged_bundle_published_only_after_operation_cleanup",
    canonicalRepositoryWriteAllowed: false,
    pathReported: false,
  });
}
