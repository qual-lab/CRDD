import fs from "node:fs";
import path from "node:path";

import {
  beginPlatformAccessArtifactSigningObservation,
  verifyPlatformAccessArtifactSigningObservation,
} from "../src/security/platform-access-release.ts";
import {
  PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES,
  PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
} from "../src/security/platform-provisioner-manifest-loader.ts";

const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

type DirectoryIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

type ManifestFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

type StagingSnapshot = Readonly<{
  root: string;
  rootIdentity: DirectoryIdentity;
  releaseDirectory: string;
  releaseDirectoryIdentity: DirectoryIdentity;
  artifactToken: object;
}>;

const stagingSnapshots = new WeakMap<object, StagingSnapshot>();

function directoryIdentity(metadata: fs.BigIntStats): DirectoryIdentity {
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("release_manifest_staging_session_invalid");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

function sameDirectoryIdentity(
  left: DirectoryIdentity,
  right: DirectoryIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

function manifestFileIdentity(
  metadata: fs.BigIntStats,
  expectedSize: number,
): ManifestFileIdentity {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size !== BigInt(expectedSize)
  ) {
    throw new Error("release_manifest_staging_changed_after_placement");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    ctimeNs: metadata.ctimeNs,
    mtimeNs: metadata.mtimeNs,
    size: metadata.size,
    mode: metadata.mode,
  });
}

function sameManifestFileIdentity(
  left: ManifestFileIdentity,
  right: ManifestFileIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size &&
    left.mode === right.mode
  );
}

function verifySnapshot(snapshot: StagingSnapshot): boolean {
  try {
    const rootIdentity = directoryIdentity(
      fs.lstatSync(snapshot.root, { bigint: true }),
    );
    const releaseDirectoryIdentity = directoryIdentity(
      fs.lstatSync(snapshot.releaseDirectory, { bigint: true }),
    );
    return (
      sameDirectoryIdentity(snapshot.rootIdentity, rootIdentity) &&
      sameDirectoryIdentity(
        snapshot.releaseDirectoryIdentity,
        releaseDirectoryIdentity,
      ) &&
      fs.realpathSync.native(snapshot.root) === snapshot.root &&
      fs.realpathSync.native(snapshot.releaseDirectory) ===
        snapshot.releaseDirectory &&
      verifyPlatformAccessArtifactSigningObservation(snapshot.artifactToken)
    );
  } catch {
    return false;
  }
}

export class ReleaseStagingManifestError extends Error {
  readonly reason = "release_manifest_staging_changed_after_placement";
  readonly releaseStagingFilesystemEffectIssued: boolean;
  readonly stagingRootMustBeDiscarded: boolean;

  constructor(
    isReleaseStagingFilesystemEffectIssued: boolean,
    shouldDiscardStagingRoot = isReleaseStagingFilesystemEffectIssued,
  ) {
    super("release_manifest_staging_changed_after_placement");
    this.name = "ReleaseStagingManifestError";
    this.releaseStagingFilesystemEffectIssued =
      isReleaseStagingFilesystemEffectIssued;
    this.stagingRootMustBeDiscarded = shouldDiscardStagingRoot;
  }
}

export function beginReleaseStagingManifestSession(distributionRoot: unknown) {
  try {
    if (
      typeof distributionRoot !== "string" ||
      distributionRoot.length === 0 ||
      distributionRoot.includes("\0") ||
      !path.isAbsolute(distributionRoot)
    ) {
      return null;
    }
    const root = path.resolve(distributionRoot);
    const rootIdentity = directoryIdentity(
      fs.lstatSync(root, { bigint: true }),
    );
    const releaseDirectory = path.join(root, "90_Release");
    const releaseDirectoryIdentity = directoryIdentity(
      fs.lstatSync(releaseDirectory, { bigint: true }),
    );
    if (
      fs.realpathSync.native(root) !== root ||
      fs.realpathSync.native(releaseDirectory) !== releaseDirectory
    ) {
      return null;
    }
    const artifactObservation =
      beginPlatformAccessArtifactSigningObservation(root);
    if (!artifactObservation) return null;
    const token = Object.freeze({});
    stagingSnapshots.set(
      token,
      Object.freeze({
        root,
        rootIdentity,
        releaseDirectory,
        releaseDirectoryIdentity,
        artifactToken: artifactObservation.token,
      }),
    );
    return Object.freeze({
      token,
      artifact: artifactObservation.artifact,
    });
  } catch {
    return null;
  }
}

export function verifyReleaseStagingManifestSession(token: object): boolean {
  const snapshot = stagingSnapshots.get(token);
  return snapshot ? verifySnapshot(snapshot) : false;
}

export function placeReleaseStagingManifestCandidate(
  token: object,
  canonicalBytes: unknown,
) {
  let isReleaseStagingFilesystemEffectIssued = false;
  let descriptor: number | null = null;
  try {
    const snapshot = stagingSnapshots.get(token);
    if (
      !snapshot ||
      !Buffer.isBuffer(canonicalBytes) ||
      typeof TYPED_ARRAY_BYTE_LENGTH !== "function"
    ) {
      throw new ReleaseStagingManifestError(false);
    }
    const byteLength = Reflect.apply(
      TYPED_ARRAY_BYTE_LENGTH,
      canonicalBytes,
      [],
    );
    if (
      typeof byteLength !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      byteLength < 1 ||
      byteLength > PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES
    ) {
      throw new ReleaseStagingManifestError(false);
    }
    const ownedCanonicalBytes = Buffer.allocUnsafe(byteLength);
    Uint8Array.prototype.set.call(ownedCanonicalBytes, canonicalBytes);
    if (!verifySnapshot(snapshot)) {
      throw new ReleaseStagingManifestError(false);
    }
    const manifestPath = path.join(
      snapshot.root,
      ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
    );
    const noFollow =
      process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
    try {
      descriptor = fs.openSync(
        manifestPath,
        fs.constants.O_CREAT |
          fs.constants.O_EXCL |
          fs.constants.O_RDWR |
          noFollow,
        0o644,
      );
    } catch {
      throw new ReleaseStagingManifestError(false, true);
    }
    isReleaseStagingFilesystemEffectIssued = true;
    manifestFileIdentity(fs.fstatSync(descriptor, { bigint: true }), 0);
    let written = 0;
    while (written < ownedCanonicalBytes.length) {
      const count = fs.writeSync(
        descriptor,
        ownedCanonicalBytes,
        written,
        ownedCanonicalBytes.length - written,
        written,
      );
      if (count <= 0) throw new ReleaseStagingManifestError(true);
      written += count;
    }
    fs.fsyncSync(descriptor);
    const postWrite = manifestFileIdentity(
      fs.fstatSync(descriptor, { bigint: true }),
      ownedCanonicalBytes.length,
    );
    const observedBytes = Buffer.allocUnsafe(ownedCanonicalBytes.length + 1);
    let observedLength = 0;
    while (observedLength < observedBytes.length) {
      const count = fs.readSync(
        descriptor,
        observedBytes,
        observedLength,
        observedBytes.length - observedLength,
        observedLength,
      );
      if (count === 0) break;
      observedLength += count;
    }
    const afterRead = manifestFileIdentity(
      fs.fstatSync(descriptor, { bigint: true }),
      ownedCanonicalBytes.length,
    );
    const pathAfter = manifestFileIdentity(
      fs.lstatSync(manifestPath, { bigint: true }),
      ownedCanonicalBytes.length,
    );
    if (
      observedLength !== ownedCanonicalBytes.length ||
      !observedBytes.subarray(0, observedLength).equals(ownedCanonicalBytes) ||
      !sameManifestFileIdentity(postWrite, afterRead) ||
      !sameManifestFileIdentity(postWrite, pathAfter) ||
      fs.realpathSync.native(manifestPath) !== manifestPath ||
      !verifySnapshot(snapshot)
    ) {
      throw new ReleaseStagingManifestError(true);
    }
    fs.closeSync(descriptor);
    descriptor = null;
    return Object.freeze({
      status: "placed" as const,
      manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
      releaseStagingFilesystemEffectIssued: true as const,
      stagingRootMustBeDiscarded: false as const,
      runtimeFilesystemEffectIssued: false as const,
      provisioningFilesystemEffectIssued: false as const,
      runtimeAuthorityConferred: false as const,
      runtimeCapabilityIssued: false as const,
    });
  } catch (error) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the first fail-closed placement failure and its Effect metadata.
      }
      descriptor = null;
    }
    if (error instanceof ReleaseStagingManifestError) throw error;
    throw new ReleaseStagingManifestError(
      isReleaseStagingFilesystemEffectIssued,
    );
  }
}

export function describeReleaseStagingManifestContract() {
  return Object.freeze({
    manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    releaseStagingManifestWrite: "implemented_explicit_signing_effect",
    releaseStagingFilesystemEffectIssuedOnSuccess: true,
    failedAfterCreateRequiresStagingRootDiscard: true,
    runtimeFilesystemEffectIssued: false,
    provisioningFilesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    productionRuntimeImportAllowed: false,
  });
}
