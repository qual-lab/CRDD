import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES,
  PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
} from "../src/security/platform-provisioner-manifest-loader.ts";

type Identity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

type Snapshot = Readonly<{ path: string; identity: Identity }>;
type Session = Readonly<{
  sourceRoot: Snapshot;
  sourceParent: Snapshot;
  sourceManifest: Snapshot;
  destinationRoot: Snapshot;
  destinationParent: Snapshot;
  sourceBytes: Buffer;
  sourceSha256: string;
  destinationManifestPath: string;
}>;

const sessions = new WeakMap<object, Session>();
const promotedSessions = new WeakMap<
  object,
  Readonly<{ path: string; identity: Identity; sha256: string }>
>();

function identity(metadata: fs.BigIntStats): Identity {
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

function sameIdentity(left: Identity, right: Identity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

function sameDirectoryIdentity(left: Identity, right: Identity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.mode === right.mode
  );
}

function directorySnapshot(target: string): Snapshot {
  const resolved = path.resolve(target);
  const metadata = fs.lstatSync(resolved, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(resolved) !== resolved
  )
    throw new Error("release_manifest_promotion_directory_invalid");
  return Object.freeze({ path: resolved, identity: identity(metadata) });
}

function verifyDirectory(snapshot: Snapshot) {
  const metadata = fs.lstatSync(snapshot.path, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    !sameDirectoryIdentity(snapshot.identity, identity(metadata)) ||
    fs.realpathSync.native(snapshot.path) !== snapshot.path
  )
    throw new Error("release_manifest_promotion_boundary_changed");
}

function fileSnapshot(target: string): Snapshot {
  const resolved = path.resolve(target);
  const metadata = fs.lstatSync(resolved, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < 1n ||
    metadata.size > BigInt(PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES) ||
    fs.realpathSync.native(resolved) !== resolved
  )
    throw new Error("release_manifest_promotion_source_invalid");
  return Object.freeze({ path: resolved, identity: identity(metadata) });
}

function readStableFile(snapshot: Snapshot) {
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(
    snapshot.path,
    fs.constants.O_RDONLY | noFollow,
  );
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(snapshot.identity, identity(opened)))
      throw new Error("release_manifest_promotion_source_changed");
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count <= 0)
        throw new Error("release_manifest_promotion_source_changed");
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(snapshot.path, { bigint: true });
    if (
      !sameIdentity(snapshot.identity, identity(after)) ||
      !sameIdentity(snapshot.identity, identity(pathAfter)) ||
      fs.realpathSync.native(snapshot.path) !== snapshot.path
    )
      throw new Error("release_manifest_promotion_source_changed");
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function matchesOwnedPartialBytes(target: string, sourceBytes: Buffer) {
  const current = fileSnapshot(target);
  const bytes = readStableFile(current);
  return (
    bytes.length <= sourceBytes.length &&
    bytes.equals(sourceBytes.subarray(0, bytes.length))
  );
}

function doesNotExist(target: string) {
  try {
    fs.lstatSync(target);
    return false;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return true;
    throw error;
  }
}

function manifestPath(root: string) {
  return path.join(
    root,
    ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
  );
}

export class ReleaseManifestPromotionError extends Error {
  readonly repositoryFilesystemEffectIssued: boolean;
  readonly cleanupConfirmed: boolean;

  constructor(
    effectIssued: boolean,
    cleanupConfirmed: boolean,
    options?: ErrorOptions,
  ) {
    super("release_manifest_promotion_failed", options);
    this.name = "ReleaseManifestPromotionError";
    this.repositoryFilesystemEffectIssued = effectIssued;
    this.cleanupConfirmed = cleanupConfirmed;
  }
}

export function beginReleaseManifestPromotionSession(
  sourceDistributionRoot: unknown,
  destinationRepositoryRoot: unknown,
) {
  try {
    if (
      typeof sourceDistributionRoot !== "string" ||
      typeof destinationRepositoryRoot !== "string" ||
      !path.isAbsolute(sourceDistributionRoot) ||
      !path.isAbsolute(destinationRepositoryRoot)
    )
      return null;
    const sourceRoot = directorySnapshot(sourceDistributionRoot);
    const destinationRoot = directorySnapshot(destinationRepositoryRoot);
    if (sourceRoot.path === destinationRoot.path) return null;
    const sourceManifestPath = manifestPath(sourceRoot.path);
    const destinationManifestPath = manifestPath(destinationRoot.path);
    const sourceParent = directorySnapshot(path.dirname(sourceManifestPath));
    const destinationParent = directorySnapshot(
      path.dirname(destinationManifestPath),
    );
    if (!doesNotExist(destinationManifestPath)) return null;
    const sourceManifest = fileSnapshot(sourceManifestPath);
    const sourceBytes = readStableFile(sourceManifest);
    const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
    const token = Object.freeze({});
    sessions.set(
      token,
      Object.freeze({
        sourceRoot,
        sourceParent,
        sourceManifest,
        destinationRoot,
        destinationParent,
        sourceBytes,
        sourceSha256,
        destinationManifestPath,
      }),
    );
    return Object.freeze({ token, sourceSha256 });
  } catch {
    return null;
  }
}

function verifySession(session: Session) {
  verifyDirectory(session.sourceRoot);
  verifyDirectory(session.sourceParent);
  verifyDirectory(session.destinationRoot);
  verifyDirectory(session.destinationParent);
  const bytes = readStableFile(session.sourceManifest);
  if (!bytes.equals(session.sourceBytes))
    throw new Error("release_manifest_promotion_source_changed");
}

export function promoteReleaseManifestBytes(token: unknown) {
  let descriptor: number | null = null;
  let createdIdentity: Identity | null = null;
  let effectIssued = false;
  const session =
    token && typeof token === "object" ? sessions.get(token) : undefined;
  try {
    if (!session) throw new ReleaseManifestPromotionError(false, true);
    verifySession(session);
    if (!doesNotExist(session.destinationManifestPath))
      throw new ReleaseManifestPromotionError(false, true);
    const noFollow =
      process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
    descriptor = fs.openSync(
      session.destinationManifestPath,
      fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_RDWR |
        noFollow,
      0o644,
    );
    effectIssued = true;
    createdIdentity = identity(fs.fstatSync(descriptor, { bigint: true }));
    let written = 0;
    while (written < session.sourceBytes.length) {
      const count = fs.writeSync(
        descriptor,
        session.sourceBytes,
        written,
        session.sourceBytes.length - written,
        written,
      );
      if (count <= 0)
        throw new Error("release_manifest_promotion_write_failed");
      written += count;
    }
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    const postWrite = fileSnapshot(session.destinationManifestPath);
    const observed = readStableFile(postWrite);
    verifySession(session);
    if (
      !observed.equals(session.sourceBytes) ||
      createHash("sha256").update(observed).digest("hex") !==
        session.sourceSha256
    )
      throw new Error("release_manifest_promotion_byte_mismatch");
    sessions.delete(token as object);
    promotedSessions.set(
      token as object,
      Object.freeze({
        path: postWrite.path,
        identity: postWrite.identity,
        sha256: session.sourceSha256,
      }),
    );
    return Object.freeze({
      status: "promoted" as const,
      manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
      manifestFileSha256: session.sourceSha256,
      byteLength: session.sourceBytes.length,
      repositoryFilesystemEffectIssued: true as const,
      cleanupConfirmed: true as const,
      runtimeAuthorityConferred: false as const,
      runtimeCapabilityIssued: false as const,
    });
  } catch (error) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the first failure and settle the exact owned path below.
      }
      descriptor = null;
    }
    let cleanupConfirmed = !effectIssued;
    if (effectIssued && session && createdIdentity) {
      try {
        const current = fs.lstatSync(session.destinationManifestPath, {
          bigint: true,
        });
        const currentIdentity = identity(current);
        if (
          current.isFile() &&
          !current.isSymbolicLink() &&
          currentIdentity.dev === createdIdentity.dev &&
          currentIdentity.ino === createdIdentity.ino &&
          currentIdentity.birthtimeNs === createdIdentity.birthtimeNs &&
          fs.realpathSync.native(session.destinationManifestPath) ===
            session.destinationManifestPath &&
          matchesOwnedPartialBytes(
            session.destinationManifestPath,
            session.sourceBytes,
          )
        ) {
          fs.unlinkSync(session.destinationManifestPath);
          cleanupConfirmed = doesNotExist(session.destinationManifestPath);
        }
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (error instanceof ReleaseManifestPromotionError) throw error;
    throw new ReleaseManifestPromotionError(effectIssued, cleanupConfirmed, {
      cause: error,
    });
  }
}

export function discardPromotedReleaseManifestBytes(token: unknown) {
  try {
    const promoted =
      token && typeof token === "object"
        ? promotedSessions.get(token)
        : undefined;
    if (!promoted) return false;
    const current = fileSnapshot(promoted.path);
    const bytes = readStableFile(current);
    if (
      !sameIdentity(promoted.identity, current.identity) ||
      createHash("sha256").update(bytes).digest("hex") !== promoted.sha256
    )
      return false;
    fs.unlinkSync(promoted.path);
    const removed = doesNotExist(promoted.path);
    if (removed) promotedSessions.delete(token as object);
    return removed;
  } catch {
    return false;
  }
}

export function describeReleaseManifestPromotionContract() {
  return Object.freeze({
    contract: "crdd-coordinator/release-manifest-promotion",
    contractRevision: 1,
    manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    sourceTreatment: "opaque_stable_bytes",
    destinationWrite: "exclusive_same_bytes_and_hash",
    partialWriteCleanup: "exact_owned_file_only",
    postconditionFailureCleanup: "exact_unchanged_promoted_file_only",
    textParsingOrSerializationDuringPromotion: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
