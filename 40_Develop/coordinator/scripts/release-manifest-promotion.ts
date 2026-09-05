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
  nlink: bigint;
}>;

type Snapshot = Readonly<{ path: string; identity: Identity }>;
type SessionMode = "ready" | "linked_pending" | "transferred";
type Session = Readonly<{
  mode: SessionMode;
  sourceRoot: Snapshot;
  sourceParent: Snapshot;
  sourceManifestPath: string;
  sourceManifest: Snapshot | null;
  destinationRoot: Snapshot;
  destinationParent: Snapshot;
  destinationManifestPath: string;
  destinationManifest: Snapshot | null;
  manifestBytes: Buffer;
  manifestSha256: string;
}>;

const sessions = new WeakMap<object, Session>();
const completedSessions = new WeakMap<object, Session>();

function identity(metadata: fs.BigIntStats): Identity {
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
    size: metadata.size,
    mode: metadata.mode,
    nlink: metadata.nlink,
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
    left.mode === right.mode &&
    left.nlink === right.nlink
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

function sameFileObject(left: Identity, right: Identity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
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
    throw new Error("release_manifest_promotion_file_invalid");
  return Object.freeze({ path: resolved, identity: identity(metadata) });
}

function optionalFileSnapshot(target: string) {
  try {
    return fileSnapshot(target);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return null;
    throw error;
  }
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
      throw new Error("release_manifest_promotion_file_changed");
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
        throw new Error("release_manifest_promotion_file_changed");
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(snapshot.path, { bigint: true });
    if (
      !sameIdentity(snapshot.identity, identity(after)) ||
      !sameIdentity(snapshot.identity, identity(pathAfter)) ||
      fs.realpathSync.native(snapshot.path) !== snapshot.path
    )
      throw new Error("release_manifest_promotion_file_changed");
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function manifestPath(root: string) {
  return path.join(
    root,
    ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
  );
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function verifyFile(
  snapshot: Snapshot,
  expectedBytes: Buffer,
  expectedSha256: string,
) {
  const bytes = readStableFile(snapshot);
  if (!bytes.equals(expectedBytes) || sha256(bytes) !== expectedSha256)
    throw new Error("release_manifest_promotion_byte_mismatch");
}

function inspectSession(
  sourceDistributionRoot: string,
  destinationRepositoryRoot: string,
  expectedManifestSha256: string,
): Session {
  const sourceRoot = directorySnapshot(sourceDistributionRoot);
  const destinationRoot = directorySnapshot(destinationRepositoryRoot);
  if (sourceRoot.path === destinationRoot.path)
    throw new Error("release_manifest_promotion_root_conflict");
  const sourceManifestPath = manifestPath(sourceRoot.path);
  const destinationManifestPath = manifestPath(destinationRoot.path);
  const sourceParent = directorySnapshot(path.dirname(sourceManifestPath));
  const destinationParent = directorySnapshot(
    path.dirname(destinationManifestPath),
  );
  const sourceManifest = optionalFileSnapshot(sourceManifestPath);
  const destinationManifest = optionalFileSnapshot(destinationManifestPath);
  if (!sourceManifest && !destinationManifest)
    throw new Error("release_manifest_promotion_manifest_missing");
  const observedManifest = sourceManifest ?? destinationManifest;
  if (!observedManifest)
    throw new Error("release_manifest_promotion_manifest_missing");
  const manifestBytes = readStableFile(observedManifest);
  if (sha256(manifestBytes) !== expectedManifestSha256)
    throw new Error("release_manifest_promotion_hash_mismatch");
  if (sourceManifest)
    verifyFile(sourceManifest, manifestBytes, expectedManifestSha256);
  if (destinationManifest)
    verifyFile(destinationManifest, manifestBytes, expectedManifestSha256);
  if (
    sourceManifest &&
    destinationManifest &&
    !sameFileObject(sourceManifest.identity, destinationManifest.identity)
  )
    throw new Error("release_manifest_promotion_dual_identity");
  return Object.freeze({
    mode: !sourceManifest
      ? "transferred"
      : destinationManifest
        ? "linked_pending"
        : "ready",
    sourceRoot,
    sourceParent,
    sourceManifestPath,
    sourceManifest,
    destinationRoot,
    destinationParent,
    destinationManifestPath,
    destinationManifest,
    manifestBytes,
    manifestSha256: expectedManifestSha256,
  });
}

function verifySession(session: Session) {
  verifyDirectory(session.sourceRoot);
  verifyDirectory(session.sourceParent);
  verifyDirectory(session.destinationRoot);
  verifyDirectory(session.destinationParent);
  const source = optionalFileSnapshot(session.sourceManifestPath);
  const destination = optionalFileSnapshot(session.destinationManifestPath);
  if (session.mode === "ready") {
    if (!source || destination || !session.sourceManifest)
      throw new Error("release_manifest_promotion_state_changed");
    if (!sameIdentity(source.identity, session.sourceManifest.identity))
      throw new Error("release_manifest_promotion_source_changed");
  } else if (session.mode === "linked_pending") {
    if (
      !source ||
      !destination ||
      !session.sourceManifest ||
      !session.destinationManifest ||
      !sameIdentity(source.identity, session.sourceManifest.identity) ||
      !sameIdentity(
        destination.identity,
        session.destinationManifest.identity,
      ) ||
      !sameFileObject(source.identity, destination.identity)
    )
      throw new Error("release_manifest_promotion_state_changed");
  } else if (
    source ||
    !destination ||
    !session.destinationManifest ||
    !sameIdentity(destination.identity, session.destinationManifest.identity)
  ) {
    throw new Error("release_manifest_promotion_state_changed");
  }
  if (source) verifyFile(source, session.manifestBytes, session.manifestSha256);
  if (destination)
    verifyFile(destination, session.manifestBytes, session.manifestSha256);
  return Object.freeze({ source, destination });
}

export class ReleaseManifestPromotionError extends Error {
  readonly repositoryFilesystemEffectIssued: boolean;
  readonly cleanupConfirmed: boolean;
  readonly reentryRequired: boolean;

  constructor(
    effectIssued: boolean,
    cleanupConfirmed: boolean,
    reentryRequired: boolean,
    options?: ErrorOptions,
  ) {
    super("release_manifest_promotion_failed", options);
    this.name = "ReleaseManifestPromotionError";
    this.repositoryFilesystemEffectIssued = effectIssued;
    this.cleanupConfirmed = cleanupConfirmed;
    this.reentryRequired = reentryRequired;
  }
}

export function beginReleaseManifestPromotionSession(
  sourceDistributionRoot: unknown,
  destinationRepositoryRoot: unknown,
  expectedManifestSha256: unknown,
) {
  try {
    if (
      typeof sourceDistributionRoot !== "string" ||
      typeof destinationRepositoryRoot !== "string" ||
      typeof expectedManifestSha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expectedManifestSha256) ||
      !path.isAbsolute(sourceDistributionRoot) ||
      !path.isAbsolute(destinationRepositoryRoot)
    )
      return null;
    const session = inspectSession(
      sourceDistributionRoot,
      destinationRepositoryRoot,
      expectedManifestSha256,
    );
    const token = Object.freeze({});
    sessions.set(token, session);
    return Object.freeze({
      token,
      mode: session.mode,
      sourceSha256: session.manifestSha256,
    });
  } catch {
    return null;
  }
}

export function promoteReleaseManifestBytes(token: unknown) {
  const session =
    token && typeof token === "object" ? sessions.get(token) : undefined;
  let effectIssued = false;
  try {
    if (!session) throw new ReleaseManifestPromotionError(false, true, false);
    let state = verifySession(session);
    if (session.mode === "ready") {
      fs.linkSync(session.sourceManifestPath, session.destinationManifestPath);
      effectIssued = true;
      const source = fileSnapshot(session.sourceManifestPath);
      const destination = fileSnapshot(session.destinationManifestPath);
      if (
        !session.sourceManifest ||
        !sameFileObject(source.identity, session.sourceManifest.identity) ||
        !sameFileObject(source.identity, destination.identity)
      )
        throw new Error("release_manifest_promotion_atomic_install_failed");
      verifyFile(destination, session.manifestBytes, session.manifestSha256);
      verifyDirectory(session.sourceRoot);
      verifyDirectory(session.sourceParent);
      verifyDirectory(session.destinationRoot);
      verifyDirectory(session.destinationParent);
      state = Object.freeze({ source, destination });
    }
    if (session.mode !== "transferred") {
      if (!state.source || !state.destination)
        throw new Error("release_manifest_promotion_link_state_invalid");
    }
    const finalSession = inspectSession(
      session.sourceRoot.path,
      session.destinationRoot.path,
      session.manifestSha256,
    );
    if (
      (finalSession.mode !== "linked_pending" &&
        finalSession.mode !== "transferred") ||
      !finalSession.destinationManifest
    )
      throw new Error("release_manifest_promotion_final_state_invalid");
    sessions.delete(token as object);
    completedSessions.set(token as object, finalSession);
    return Object.freeze({
      status: "promoted" as const,
      resumed: session.mode !== "ready",
      manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
      manifestFileSha256: session.manifestSha256,
      byteLength: session.manifestBytes.length,
      repositoryFilesystemEffectIssued: effectIssued,
      cleanupConfirmed: true as const,
      stagingManifestDisposition:
        finalSession.mode === "linked_pending"
          ? ("retained_for_explicit_staging_discard" as const)
          : ("already_absent" as const),
      reentryRequired: false as const,
      runtimeAuthorityConferred: false as const,
      runtimeCapabilityIssued: false as const,
    });
  } catch (error) {
    if (error instanceof ReleaseManifestPromotionError) throw error;
    throw new ReleaseManifestPromotionError(
      effectIssued,
      !effectIssued,
      effectIssued,
      {
        cause: error,
      },
    );
  }
}

export function verifyPromotedReleaseManifestBytes(token: unknown) {
  try {
    const session =
      token && typeof token === "object"
        ? completedSessions.get(token)
        : undefined;
    if (!session) return false;
    const current = inspectSession(
      session.sourceRoot.path,
      session.destinationRoot.path,
      session.manifestSha256,
    );
    return (
      (current.mode === "linked_pending" || current.mode === "transferred") &&
      current.destinationManifest !== null &&
      session.destinationManifest !== null &&
      sameIdentity(
        current.destinationManifest.identity,
        session.destinationManifest.identity,
      ) &&
      sameDirectoryIdentity(
        current.sourceRoot.identity,
        session.sourceRoot.identity,
      ) &&
      sameDirectoryIdentity(
        current.sourceParent.identity,
        session.sourceParent.identity,
      ) &&
      sameDirectoryIdentity(
        current.destinationRoot.identity,
        session.destinationRoot.identity,
      ) &&
      sameDirectoryIdentity(
        current.destinationParent.identity,
        session.destinationParent.identity,
      )
    );
  } catch {
    return false;
  }
}

export function describeReleaseManifestPromotionContract() {
  return Object.freeze({
    contract: "crdd-coordinator/release-manifest-promotion",
    contractRevision: 3,
    manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    sourceTreatment: "opaque_stable_bytes",
    destinationPublish: "exclusive_same_volume_hard_link",
    partialCanonicalFilePossible: false,
    processLossReentry: "source_only_linked_or_destination_only_exact_identity",
    stagingCleanup: "separate_explicit_owned_staging_discard",
    automaticRollbackAfterPublish: false,
    textParsingOrSerializationDuringPromotion: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
