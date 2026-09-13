import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { FixedRevisionIdentityAdapter } from "../fixed-revision.ts";
import type {
  RepositoryFormatAdapter,
  RepositoryRevisionAdapter,
} from "../repository-revision.ts";
import { inspectGitCommitTreeCandidate } from "./object-reader.ts";
import {
  inspectRepositoryGitObjectFormatCandidate,
  type RepositoryGitLayout,
  resolveRepositoryGitLayout,
} from "./repository-layout.ts";

const MAX_HEAD_BYTES = 4_096;
const MAX_PACKED_REFS_BYTES = 4 * 1024 * 1024;
const OBJECT_ID = /^[a-f0-9]{40}$/u;
const SAFE_REF = /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]{1,1024}$/u;

function stableFile(target: string, maximumBytes: number): Buffer {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(maximumBytes)
    )
      throw new Error("fixed_revision_file_invalid");
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
      if (read <= 0) throw new Error("fixed_revision_file_changed");
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
    )
      throw new Error("fixed_revision_file_changed");
    return bytes;
  } finally {
    fs.closeSync(handle);
  }
}

function decodeControl(bytes: Buffer): string {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/\0|\r(?!\n)/u.test(source))
    throw new Error("fixed_revision_file_invalid");
  return source.replace(/\r?\n$/u, "");
}

function readPacked(commonDirectory: string, ref: string): string {
  const matches = decodeControl(
    stableFile(
      path.join(commonDirectory, "packed-refs"),
      MAX_PACKED_REFS_BYTES,
    ),
  )
    .split("\n")
    .filter((line) => !line.startsWith("#") && !line.startsWith("^"))
    .map((line) => line.split(" "))
    .filter((parts) => parts.length === 2 && parts[1] === ref);
  if (matches.length !== 1 || !OBJECT_ID.test(matches[0]?.[0] ?? ""))
    throw new Error("fixed_revision_ref_invalid");
  return matches[0]?.[0] as string;
}

function readRevision(layout: RepositoryGitLayout): string {
  const head = decodeControl(
    stableFile(path.join(layout.gitDirectory.realPath, "HEAD"), MAX_HEAD_BYTES),
  );
  if (OBJECT_ID.test(head)) return head;
  if (!head.startsWith("ref: ")) throw new Error("fixed_revision_head_invalid");
  const ref = head.slice(5);
  if (
    !SAFE_REF.test(ref) ||
    ref.includes("..") ||
    ref.includes("//") ||
    ref.endsWith("/")
  )
    throw new Error("fixed_revision_ref_invalid");
  try {
    const revision = decodeControl(
      stableFile(
        path.join(layout.commonDirectory.realPath, ...ref.split("/")),
        MAX_HEAD_BYTES,
      ),
    );
    if (!OBJECT_ID.test(revision))
      throw new Error("fixed_revision_ref_invalid");
    return revision;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
    return readPacked(layout.commonDirectory.realPath, ref);
  }
}

function identity(domain: string, entity: RepositoryGitLayout["root"]): string {
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

export const gitRepositoryRevisionAdapter: RepositoryRevisionAdapter = (
  repositoryRoot,
) => {
  try {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const revision = readRevision(layout);
    const repositoryForm =
      layout.kind === "normal_worktree"
        ? ("primary" as const)
        : layout.kind === "linked_worktree"
          ? ("linked" as const)
          : ("embedded" as const);
    return Object.freeze({
      repositoryIdentity: identity(
        "crdd-logical-repository-v1",
        layout.commonDirectory,
      ),
      repositoryInstanceIdentity: identity(
        "crdd-repository-instance-v1",
        layout.root,
      ),
      repositoryForm,
      revisionIdentity: revision,
      objectFormat: "sha1" as const,
      observationComplete: true as const,
      repositoryPathReported: false as const,
    });
  } catch {
    return null;
  }
};

export const gitRepositoryFormatAdapter: RepositoryFormatAdapter = (
  repositoryRoot,
) => {
  const result = inspectRepositoryGitObjectFormatCandidate(repositoryRoot);
  return result?.status === "candidate"
    ? Object.freeze({ objectFormat: result.objectFormat })
    : null;
};

export const gitFixedRevisionIdentityAdapter: FixedRevisionIdentityAdapter = (
  repositoryRoot,
) => {
  const current = gitRepositoryRevisionAdapter(repositoryRoot);
  if (!current) return null;
  const layout = resolveRepositoryGitLayout(repositoryRoot);
  const snapshot = inspectGitCommitTreeCandidate({
    commonDirectory: layout.commonDirectory.realPath,
    revision: current.revisionIdentity,
  });
  return snapshot?.status === "candidate" &&
    snapshot.commit === current.revisionIdentity
    ? Object.freeze({
        contract: "crdd-version-control/fixed-revision-identity/v1" as const,
        contractRevision: 1 as const,
        status: "observed" as const,
        ...current,
        snapshotIdentity: snapshot.tree,
      })
    : null;
};
