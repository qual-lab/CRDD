import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  resolveRepositoryGitLayout,
  type RepositoryGitLayout,
} from "./repository-git-layout-internal.ts";

export const REPOSITORY_OPERATION_RUNTIME_CONTRACT =
  "crdd-coordinator/repository-operation-runtime";
export const REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION = 1;

const MAX_HEAD_BYTES = 4_096;
const MAX_PACKED_REFS_BYTES = 4 * 1024 * 1024;
const OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const SAFE_REF = /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]{1,1024}$/u;

type Binding = Readonly<{
  managementCapability: object;
  operationId: string;
  repositoryRoot: string;
  repositoryKind: string;
  logicalRepositoryIdentity: string;
  repositoryInstanceIdentity: string;
  revision: string;
}>;

const bindings = new WeakMap<object, Binding>();
const capabilities = new WeakMap<object, Binding>();

function stableFile(target: string, maximumBytes: number) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(maximumBytes)
    ) {
      throw new Error("repository_revision_file_invalid");
    }
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const read = fs.readSync(
        handle,
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (read <= 0) throw new Error("repository_revision_file_changed");
      offset += read;
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
      throw new Error("repository_revision_file_changed");
    }
    const metadata = fs.lstatSync(target, { bigint: true });
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.dev !== before.dev ||
      metadata.ino !== before.ino ||
      metadata.birthtimeNs !== before.birthtimeNs ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("repository_revision_file_changed");
    }
    return bytes;
  } finally {
    fs.closeSync(handle);
  }
}

function decodeControl(bytes: Buffer) {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/\0|\r(?!\n)/u.test(source))
    throw new Error("repository_revision_file_invalid");
  return source.replace(/\r?\n$/u, "");
}

function validRef(value: string) {
  return (
    SAFE_REF.test(value) &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.endsWith("/")
  );
}

function packedRevision(commonDirectory: string, ref: string) {
  const source = decodeControl(
    stableFile(
      path.join(commonDirectory, "packed-refs"),
      MAX_PACKED_REFS_BYTES,
    ),
  );
  const matches = source
    .split("\n")
    .filter((line) => !line.startsWith("#") && !line.startsWith("^"))
    .map((line) => line.split(" "))
    .filter((parts) => parts.length === 2 && parts[1] === ref);
  if (matches.length !== 1 || !OBJECT_ID.test(matches[0]?.[0] ?? ""))
    throw new Error("repository_revision_ref_invalid");
  return matches[0]?.[0] as string;
}

function readRevision(layout: RepositoryGitLayout) {
  const head = decodeControl(
    stableFile(path.join(layout.gitDirectory.realPath, "HEAD"), MAX_HEAD_BYTES),
  );
  if (OBJECT_ID.test(head)) return head;
  if (!head.startsWith("ref: "))
    throw new Error("repository_revision_head_invalid");
  const ref = head.slice("ref: ".length);
  if (!validRef(ref)) throw new Error("repository_revision_ref_invalid");
  const loose = path.join(layout.commonDirectory.realPath, ...ref.split("/"));
  try {
    const revision = decodeControl(stableFile(loose, MAX_HEAD_BYTES));
    if (!OBJECT_ID.test(revision))
      throw new Error("repository_revision_ref_invalid");
    return revision;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
    return packedRevision(layout.commonDirectory.realPath, ref);
  }
}

function entityIdentity(domain: string, entity: RepositoryGitLayout["root"]) {
  return createHash("sha256")
    .update(domain)
    .update("\0")
    .update(entity.identity.dev.toString())
    .update("\0")
    .update(entity.identity.ino.toString())
    .update("\0")
    .update(entity.identity.birthtimeNs.toString())
    .digest("hex");
}

function observe(repositoryRoot: string) {
  const layout = resolveRepositoryGitLayout(repositoryRoot);
  return Object.freeze({
    repositoryKind: layout.kind,
    logicalRepositoryIdentity: entityIdentity(
      "crdd-logical-repository-v1",
      layout.commonDirectory,
    ),
    repositoryInstanceIdentity: entityIdentity(
      "crdd-repository-instance-v1",
      layout.root,
    ),
    revision: readRevision(layout),
  });
}

export function bindRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
  repositoryRoot: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    if (bindings.has(managementCapability)) return null;
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const observation = observe(repositoryRoot);
    const binding = Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      repositoryRoot: fs.realpathSync.native(repositoryRoot),
      ...observation,
    });
    const capability = Object.freeze({});
    bindings.set(managementCapability, binding);
    capabilities.set(capability, binding);
    return Object.freeze({
      operationId: binding.operationId,
      revision: binding.revision,
      repositoryBindingCapability: capability,
      repositoryBound: true as const,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

function currentBinding(managementCapability: unknown) {
  if (!managementCapability || typeof managementCapability !== "object")
    return null;
  const binding = bindings.get(managementCapability);
  if (!binding) return null;
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  if (operation.operationId !== binding.operationId) return null;
  const current = observe(binding.repositoryRoot);
  return current.repositoryKind === binding.repositoryKind &&
    current.logicalRepositoryIdentity === binding.logicalRepositoryIdentity &&
    current.repositoryInstanceIdentity === binding.repositoryInstanceIdentity &&
    current.revision === binding.revision
    ? binding
    : null;
}

export function verifyRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
) {
  try {
    const binding = currentBinding(managementCapability);
    return binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

export function verifyRuntimeOwnedRepositoryBindingCapability(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    return binding?.managementCapability === managementCapability &&
      currentBinding(managementCapability) === binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

export function borrowRuntimeOwnedRepositorySource(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    if (
      !binding ||
      binding.managementCapability !== managementCapability ||
      currentBinding(managementCapability) !== binding ||
      binding.revision.length !== 40
    ) {
      return null;
    }
    const layout = resolveRepositoryGitLayout(binding.repositoryRoot);
    return Object.freeze({
      operationId: binding.operationId,
      repositoryRoot: binding.repositoryRoot,
      gitDirectory: layout.gitDirectory.realPath,
      commonDirectory: layout.commonDirectory.realPath,
      revision: binding.revision,
    });
  } catch {
    return null;
  }
}

export function describeRepositoryOperationRuntimeContract() {
  return Object.freeze({
    contract: REPOSITORY_OPERATION_RUNTIME_CONTRACT,
    contractRevision: REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION,
    repositoryIdentity:
      "logical_common_git_metadata_plus_worktree_instance_filesystem_identity",
    revision: "exact_head_object_id_reobserved_before_effect_and_result",
    supportedRefs: Object.freeze([
      "loose_heads_tags",
      "packed_heads_tags",
      "detached_head",
    ]),
    pathReported: false,
    callerRevisionAccepted: false,
    internalSourceBorrow:
      "same_runtime_owned_binding_and_current_revision_only",
    providerEffectAllowed: false,
  });
}
