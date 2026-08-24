import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const CANDIDATE_BUNDLE_STORE_CONTRACT =
  "crdd-coordinator/candidate-bundle-store";
export const CANDIDATE_BUNDLE_STORE_CONTRACT_REVISION = 1;

const STORE_DIRECTORY_NAME = "crdd-coordinator-candidates-v1";
const CANDIDATE_ID_PATTERN = /^candidate\.([0-9a-f]{64})\.([0-9a-f]{64})$/u;
const MAXIMUM_BUNDLE_BYTES = 24 * 1024 * 1024;

type CandidateBundle = Readonly<{
  schema: "crdd-coordinator-candidate-bundle/v1";
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  patchHash: string;
  contentManifestHash: string;
  allowedPathsHash: string;
  changedPaths: readonly string[];
  entries: readonly Readonly<{
    relativePath: string;
    operation: "upsert" | "delete";
    byteLength: number;
    sha256: string | null;
    contentBase64: string | null;
  }>[];
}>;

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : null;
}

function storeDirectory() {
  const temporaryParent = fs.realpathSync.native(os.tmpdir());
  const parentMetadata = fs.lstatSync(temporaryParent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink())
    throw new Error("candidate_store_parent_invalid");
  const store = path.join(temporaryParent, STORE_DIRECTORY_NAME);
  try {
    fs.mkdirSync(store, { mode: 0o700 });
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
  }
  const metadata = fs.lstatSync(store);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(store) !== store ||
    path.dirname(store) !== temporaryParent
  ) {
    throw new Error("candidate_store_directory_invalid");
  }
  return store;
}

function candidateLocation(rawCandidateId: unknown) {
  if (typeof rawCandidateId !== "string") return null;
  const match = CANDIDATE_ID_PATTERN.exec(rawCandidateId);
  if (!match?.[1] || !match[2]) return null;
  return Object.freeze({
    candidateId: rawCandidateId,
    storageId: match[1],
    expectedHash: match[2],
    target: path.join(storeDirectory(), `candidate-${match[1]}.json`),
  });
}

function validDigest(value: unknown, bytes: 20 | 32) {
  return (
    typeof value === "string" &&
    new RegExp(`^[0-9a-f]{${bytes * 2}}$`, "u").test(value)
  );
}

function validRelativePath(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= 1_024 &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    value
      .split("/")
      .every((segment) => segment && segment !== "." && segment !== "..")
  );
}

function normalizeBundle(rawBundle: unknown): CandidateBundle | null {
  if (!rawBundle || typeof rawBundle !== "object" || Array.isArray(rawBundle))
    return null;
  const bundle = rawBundle as Record<string, unknown>;
  const keys = Object.keys(bundle).sort();
  const expectedKeys = [
    "allowedPathsHash",
    "baseCommit",
    "baseManifestHash",
    "baseTree",
    "changedPaths",
    "contentManifestHash",
    "entries",
    "patchHash",
    "schema",
  ].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  )
    return null;
  if (
    bundle.schema !== "crdd-coordinator-candidate-bundle/v1" ||
    !validDigest(bundle.baseCommit, 20) ||
    !validDigest(bundle.baseTree, 20) ||
    !validDigest(bundle.baseManifestHash, 32) ||
    !validDigest(bundle.patchHash, 32) ||
    !validDigest(bundle.contentManifestHash, 32) ||
    !validDigest(bundle.allowedPathsHash, 32) ||
    !Array.isArray(bundle.changedPaths) ||
    !Array.isArray(bundle.entries) ||
    bundle.changedPaths.length > 1_000 ||
    bundle.entries.length !== bundle.changedPaths.length
  ) {
    return null;
  }
  const changedPaths: string[] = [];
  const entries: Array<CandidateBundle["entries"][number]> = [];
  for (let index = 0; index < bundle.changedPaths.length; index += 1) {
    const relativePath = bundle.changedPaths[index];
    const rawEntry = bundle.entries[index];
    if (
      !validRelativePath(relativePath) ||
      !rawEntry ||
      typeof rawEntry !== "object" ||
      Array.isArray(rawEntry)
    ) {
      return null;
    }
    const entry = rawEntry as Record<string, unknown>;
    if (
      Object.keys(entry).sort().join("\0") !==
        ["byteLength", "contentBase64", "operation", "relativePath", "sha256"]
          .sort()
          .join("\0") ||
      entry.relativePath !== relativePath ||
      (entry.operation !== "upsert" && entry.operation !== "delete") ||
      !Number.isSafeInteger(entry.byteLength) ||
      (entry.byteLength as number) < 0
    ) {
      return null;
    }
    if (entry.operation === "delete") {
      if (
        entry.byteLength !== 0 ||
        entry.sha256 !== null ||
        entry.contentBase64 !== null
      ) {
        return null;
      }
    } else {
      if (
        !validDigest(entry.sha256, 32) ||
        typeof entry.contentBase64 !== "string"
      ) {
        return null;
      }
      const content = Buffer.from(entry.contentBase64, "base64");
      if (
        content.byteLength !== entry.byteLength ||
        content.toString("base64") !== entry.contentBase64 ||
        createHash("sha256").update(content).digest("hex") !== entry.sha256
      ) {
        return null;
      }
    }
    changedPaths.push(relativePath);
    entries.push(
      Object.freeze({
        relativePath,
        operation: entry.operation,
        byteLength: entry.byteLength as number,
        sha256: entry.sha256 as string | null,
        contentBase64: entry.contentBase64 as string | null,
      }),
    );
  }
  const sortedPaths = [...changedPaths].sort((left, right) =>
    Buffer.from(left).compare(Buffer.from(right)),
  );
  if (
    new Set(changedPaths).size !== changedPaths.length ||
    changedPaths.some((value, index) => value !== sortedPaths[index])
  ) {
    return null;
  }
  return Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit: bundle.baseCommit as string,
    baseTree: bundle.baseTree as string,
    baseManifestHash: bundle.baseManifestHash as string,
    patchHash: bundle.patchHash as string,
    contentManifestHash: bundle.contentManifestHash as string,
    allowedPathsHash: bundle.allowedPathsHash as string,
    changedPaths: Object.freeze(changedPaths),
    entries: Object.freeze(entries),
  });
}

function readStableCandidate(target: string, expectedHash: string) {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size <= 0n ||
      before.size > BigInt(MAXIMUM_BUNDLE_BYTES)
    ) {
      throw new Error("candidate_bundle_file_invalid");
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
      if (readBytes <= 0) throw new Error("candidate_bundle_file_changed");
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
      current.birthtimeNs !== before.birthtimeNs ||
      createHash("sha256").update(content).digest("hex") !== expectedHash
    ) {
      throw new Error("candidate_bundle_file_changed");
    }
    return content;
  } finally {
    fs.closeSync(handle);
  }
}

export function persistRuntimeOwnedCandidateBundle(rawBundle: unknown) {
  try {
    const bundle = normalizeBundle(rawBundle);
    if (!bundle) return null;
    const serialized = Buffer.from(`${JSON.stringify(bundle)}\n`, "utf8");
    if (serialized.byteLength > MAXIMUM_BUNDLE_BYTES) return null;
    const bundleHash = createHash("sha256").update(serialized).digest("hex");
    const storageId = createHash("sha256")
      .update("crdd-candidate-storage-v1\0")
      .update(randomBytes(32))
      .digest("hex");
    const target = path.join(storeDirectory(), `candidate-${storageId}.json`);
    fs.writeFileSync(target, serialized, { flag: "wx", mode: 0o600 });
    return Object.freeze({
      status: "persisted" as const,
      candidateId: `candidate.${storageId}.${bundleHash}`,
      bundleHash,
      byteLength: serialized.byteLength,
      hostPathReported: false,
    });
  } catch {
    return null;
  }
}

export function readRuntimeOwnedCandidateBundle(rawCandidateId: unknown) {
  try {
    const location = candidateLocation(rawCandidateId);
    if (!location) return null;
    const content = readStableCandidate(location.target, location.expectedHash);
    const parsed = parseUnambiguousJsonDocument(
      new TextDecoder("utf-8", { fatal: true }).decode(content),
    );
    const bundle = normalizeBundle(parsed);
    return bundle
      ? Object.freeze({
          status: "exported" as const,
          candidateId: location.candidateId,
          bundle,
          hostPathReported: false,
        })
      : null;
  } catch {
    return null;
  }
}

export function discardRuntimeOwnedCandidateBundle(rawCandidateId: unknown) {
  try {
    const location = candidateLocation(rawCandidateId);
    if (!location) return Object.freeze({ status: "blocked" as const });
    readStableCandidate(location.target, location.expectedHash);
    fs.rmSync(location.target);
    return Object.freeze({ status: "discarded" as const });
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

export function describeCandidateBundleStoreContract() {
  return Object.freeze({
    contract: CANDIDATE_BUNDLE_STORE_CONTRACT,
    contractRevision: CANDIDATE_BUNDLE_STORE_CONTRACT_REVISION,
    persistence: "approved_candidate_only_local_user_transient_store",
    integrity: "candidate_id_bound_sha256_exact_bundle",
    canonicalRepositoryWriteAllowed: false,
    apiKeyFallbackAllowed: false,
    hostPathReported: false,
  });
}
