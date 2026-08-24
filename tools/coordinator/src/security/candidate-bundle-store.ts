import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";

export const CANDIDATE_BUNDLE_STORE_CONTRACT =
  "crdd-coordinator/candidate-bundle-store";
export const CANDIDATE_BUNDLE_STORE_CONTRACT_REVISION = 2;

const STORE_DIRECTORY_NAME = "crdd-coordinator-candidates-v2";
const CANDIDATE_ID_PATTERN = /^candidate\.([0-9a-f]{64})\.([0-9a-f]{64})$/u;
const RECOVERY_ID_PATTERN =
  /^candidate-recovery\.([0-9a-f]{64})\.([0-9a-f]{64})$/u;
const MAXIMUM_BUNDLE_BYTES = 24 * 1024 * 1024;
const MAXIMUM_STORE_ENTRIES = 128;
const MAXIMUM_STORE_BYTES = 256 * 1024 * 1024;
const SECRET_PATTERN =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{32,}\b|\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/u;

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
type StoredCandidate = Readonly<{
  schema: "crdd-coordinator/stored-candidate/v2";
  createdAtMs: number;
  expiresAtMs: number;
  informationClassification: "public" | "internal" | "confidential";
  bundle: CandidateBundle;
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
  const published = CANDIDATE_ID_PATTERN.exec(rawCandidateId);
  const recovery = RECOVERY_ID_PATTERN.exec(rawCandidateId);
  const match = published ?? recovery;
  if (!match?.[1] || !match[2]) return null;
  return Object.freeze({
    candidateId: rawCandidateId,
    storageId: match[1],
    expectedHash: match[2],
    kind: published ? ("published" as const) : ("staged" as const),
    target: path.join(
      storeDirectory(),
      `${published ? "candidate" : "staged"}-${match[1]}.json`,
    ),
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

function normalizeStoredCandidate(raw: unknown): StoredCandidate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).sort().join("\0") !==
      [
        "bundle",
        "createdAtMs",
        "expiresAtMs",
        "informationClassification",
        "schema",
      ]
        .sort()
        .join("\0") ||
    value.schema !== "crdd-coordinator/stored-candidate/v2" ||
    !Number.isSafeInteger(value.createdAtMs) ||
    !Number.isSafeInteger(value.expiresAtMs) ||
    (value.createdAtMs as number) < 0 ||
    (value.expiresAtMs as number) <= (value.createdAtMs as number) ||
    !["public", "internal", "confidential"].includes(
      value.informationClassification as string,
    )
  ) {
    return null;
  }
  const bundle = normalizeBundle(value.bundle);
  return bundle
    ? Object.freeze({
        schema: "crdd-coordinator/stored-candidate/v2" as const,
        createdAtMs: value.createdAtMs as number,
        expiresAtMs: value.expiresAtMs as number,
        informationClassification: value.informationClassification as
          | "public"
          | "internal"
          | "confidential",
        bundle,
      })
    : null;
}

function containsRecognizedSecret(bundle: CandidateBundle) {
  return bundle.entries.some((entry) => {
    if (entry.operation !== "upsert" || entry.contentBase64 === null)
      return false;
    return SECRET_PATTERN.test(
      Buffer.from(entry.contentBase64, "base64").toString("utf8"),
    );
  });
}

function storeInventory(store: string, nowMs: number) {
  const directory = fs.opendirSync(store);
  let count = 0;
  let totalBytes = 0;
  try {
    while (true) {
      const entry = directory.readSync();
      if (!entry) break;
      count += 1;
      if (count > MAXIMUM_STORE_ENTRIES)
        throw new Error("candidate_store_entry_budget_exceeded");
      if (
        !entry.isFile() ||
        !/^(?:(?:candidate|staged)-[0-9a-f]{64}\.json|pending-[0-9a-f]{64}\.tmp)$/u.test(
          entry.name,
        )
      ) {
        throw new Error("candidate_store_unknown_entry");
      }
      const target = path.join(store, entry.name);
      const metadata = fs.lstatSync(target);
      if (!metadata.isFile() || metadata.isSymbolicLink())
        throw new Error("candidate_store_entry_invalid");
      totalBytes += metadata.size;
      if (totalBytes > MAXIMUM_STORE_BYTES)
        throw new Error("candidate_store_byte_budget_exceeded");
      if (entry.name.startsWith("pending-")) {
        if (metadata.mtimeMs + 60 * 60 * 1_000 <= nowMs) {
          fs.rmSync(target);
          count -= 1;
          totalBytes -= metadata.size;
        }
        continue;
      }
      try {
        const match = /-([0-9a-f]{64})\.json$/u.exec(entry.name);
        if (!match?.[1]) throw new Error("candidate_store_entry_invalid");
        const raw = fs.readFileSync(target);
        if (raw.byteLength > MAXIMUM_BUNDLE_BYTES)
          throw new Error("candidate_store_entry_invalid");
        const parsed = parseUnambiguousJsonDocument(
          new TextDecoder("utf-8", { fatal: true }).decode(raw),
        );
        const stored = normalizeStoredCandidate(parsed);
        if (stored && stored.expiresAtMs <= nowMs) {
          const current = fs.lstatSync(target);
          if (
            current.isFile() &&
            !current.isSymbolicLink() &&
            current.dev === metadata.dev &&
            current.ino === metadata.ino &&
            current.birthtimeMs === metadata.birthtimeMs
          ) {
            fs.rmSync(target);
            count -= 1;
            totalBytes -= metadata.size;
          }
        }
      } catch {
        // Unknown or damaged entries remain fail-closed and make a future write
        // fail through the fixed capacity budget rather than being guessed away.
      }
    }
    return Object.freeze({ count, totalBytes });
  } finally {
    directory.closeSync();
  }
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

export function persistRuntimeOwnedCandidateBundle(
  rawBundle: unknown,
  rawPolicy: unknown,
) {
  try {
    const bundle = normalizeBundle(rawBundle);
    if (!rawPolicy || typeof rawPolicy !== "object" || Array.isArray(rawPolicy))
      return null;
    const policy = rawPolicy as Record<string, unknown>;
    if (
      !bundle ||
      containsRecognizedSecret(bundle) ||
      policy.candidatePersistenceAllowed !== true ||
      !Number.isSafeInteger(policy.candidateRetentionHours) ||
      (policy.candidateRetentionHours as number) < 1 ||
      (policy.candidateRetentionHours as number) > 168 ||
      !["public", "internal", "confidential"].includes(
        policy.informationClassification as string,
      )
    ) {
      return null;
    }
    const nowMs = Date.now();
    const stored = Object.freeze({
      schema: "crdd-coordinator/stored-candidate/v2" as const,
      createdAtMs: nowMs,
      expiresAtMs:
        nowMs + (policy.candidateRetentionHours as number) * 60 * 60 * 1_000,
      informationClassification: policy.informationClassification as
        | "public"
        | "internal"
        | "confidential",
      bundle,
    });
    const serialized = Buffer.from(`${JSON.stringify(stored)}\n`, "utf8");
    if (serialized.byteLength > MAXIMUM_BUNDLE_BYTES) return null;
    const bundleHash = createHash("sha256").update(serialized).digest("hex");
    const storageId = createHash("sha256")
      .update("crdd-candidate-storage-v1\0")
      .update(randomBytes(32))
      .digest("hex");
    const store = storeDirectory();
    const inventory = storeInventory(store, nowMs);
    if (
      inventory.count >= MAXIMUM_STORE_ENTRIES ||
      inventory.totalBytes + serialized.byteLength > MAXIMUM_STORE_BYTES
    ) {
      return null;
    }
    const pending = path.join(store, `pending-${storageId}.tmp`);
    const target = path.join(store, `staged-${storageId}.json`);
    const handle = fs.openSync(pending, "wx", 0o600);
    try {
      fs.writeFileSync(handle, serialized);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    fs.renameSync(pending, target);
    readStableCandidate(target, bundleHash);
    return Object.freeze({
      status: "staged" as const,
      candidateRecoveryId: `candidate-recovery.${storageId}.${bundleHash}`,
      bundleHash,
      byteLength: serialized.byteLength,
      expiresAtMs: stored.expiresAtMs,
      hostPathReported: false,
      secretScanHeuristic: true,
      credentialAbsenceVerified: false,
    });
  } catch {
    return null;
  }
}

export function readRuntimeOwnedCandidateBundle(rawCandidateId: unknown) {
  try {
    const location = candidateLocation(rawCandidateId);
    if (location?.kind !== "published") return null;
    const content = readStableCandidate(location.target, location.expectedHash);
    const parsed = parseUnambiguousJsonDocument(
      new TextDecoder("utf-8", { fatal: true }).decode(content),
    );
    const stored = normalizeStoredCandidate(parsed);
    return stored && stored.expiresAtMs > Date.now()
      ? Object.freeze({
          status: "exported" as const,
          candidateId: location.candidateId,
          informationClassification: stored.informationClassification,
          expiresAtMs: stored.expiresAtMs,
          bundle: stored.bundle,
          hostPathReported: false,
          secretScanHeuristic: true,
          credentialAbsenceVerified: false,
        })
      : null;
  } catch {
    return null;
  }
}

export function publishRuntimeOwnedCandidateBundle(rawRecoveryId: unknown) {
  try {
    const location = candidateLocation(rawRecoveryId);
    if (location?.kind !== "staged") return null;
    const content = readStableCandidate(location.target, location.expectedHash);
    const parsed = parseUnambiguousJsonDocument(
      new TextDecoder("utf-8", { fatal: true }).decode(content),
    );
    const stored = normalizeStoredCandidate(parsed);
    if (!stored || stored.expiresAtMs <= Date.now()) return null;
    const publishedTarget = path.join(
      storeDirectory(),
      `candidate-${location.storageId}.json`,
    );
    fs.renameSync(location.target, publishedTarget);
    readStableCandidate(publishedTarget, location.expectedHash);
    return Object.freeze({
      status: "published" as const,
      candidateId: `candidate.${location.storageId}.${location.expectedHash}`,
      expiresAtMs: stored.expiresAtMs,
      hostPathReported: false,
    });
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
    lifecycle: "staged_then_published_after_operation_cleanup",
    retention: "repository_policy_bounded_1_to_168_hours_with_startup_gc",
    capacity: Object.freeze({
      maximumEntries: MAXIMUM_STORE_ENTRIES,
      maximumBytes: MAXIMUM_STORE_BYTES,
    }),
    integrity: "candidate_id_bound_sha256_exact_bundle",
    canonicalRepositoryWriteAllowed: false,
    apiKeyFallbackAllowed: false,
    recognizedSecretPersistenceAllowed: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
  });
}
