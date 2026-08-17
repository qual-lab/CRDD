import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES,
  PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
} from "./platform-provisioner-manifest-loader.ts";

export const PLATFORM_ACCESS_TARGET = "x86_64-pc-windows-msvc";
export const PLATFORM_ACCESS_RUST_TOOLCHAIN = "1.94.1";
export const PLATFORM_ACCESS_PROTOCOL_REVISION = 1;
export const PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES = 16 * 1024 * 1024;
export const PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH =
  "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe";

const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

type FileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

type DirectoryIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

const signingSnapshots = new WeakMap<
  object,
  Readonly<{
    root: string;
    rootIdentity: DirectoryIdentity;
    executablePath: string;
    fileIdentity: FileIdentity;
    artifact: Readonly<{
      relativePath: string;
      target: string;
      protocolRevision: number;
      rustToolchain: string;
      byteLength: number;
      sha256: string;
    }>;
  }>
>();

function fileIdentity(metadata: fs.BigIntStats): FileIdentity {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n ||
    metadata.size <= 0n ||
    metadata.size > BigInt(PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES)
  ) {
    throw new Error("platform_access_release_executable_invalid");
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

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
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

type ManifestFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  ctimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

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

function directoryIdentity(metadata: fs.BigIntStats): DirectoryIdentity {
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("platform_access_release_distribution_invalid");
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

function distributionRootSnapshot(raw: unknown) {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    raw.includes("\0") ||
    !path.isAbsolute(raw)
  ) {
    throw new Error("platform_access_release_distribution_invalid");
  }
  const root = path.resolve(raw);
  const identity = directoryIdentity(fs.lstatSync(root, { bigint: true }));
  if (fs.realpathSync.native(root) !== root) {
    throw new Error("platform_access_release_distribution_invalid");
  }
  return Object.freeze({ root, identity });
}

function verifyDistributionRootSnapshot(snapshot: {
  root: string;
  identity: DirectoryIdentity;
}) {
  const current = directoryIdentity(
    fs.lstatSync(snapshot.root, { bigint: true }),
  );
  return (
    sameDirectoryIdentity(snapshot.identity, current) &&
    fs.realpathSync.native(snapshot.root) === snapshot.root
  );
}

function observeArtifactSnapshot(distributionRoot: unknown) {
  const rootSnapshot = distributionRootSnapshot(distributionRoot);
  const root = rootSnapshot.root;
  const executablePath = path.join(
    root,
    ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  const before = fileIdentity(fs.lstatSync(executablePath, { bigint: true }));
  if (fs.realpathSync.native(executablePath) !== executablePath) {
    throw new Error("platform_access_release_executable_invalid");
  }
  const descriptor = fs.openSync(executablePath, fs.constants.O_RDONLY);
  try {
    const opened = fileIdentity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameIdentity(before, opened)) {
      throw new Error("platform_access_release_executable_changed");
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      if (byteLength > PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES) {
        throw new Error("platform_access_release_executable_invalid");
      }
      hash.update(buffer.subarray(0, count));
    }
    const after = fileIdentity(fs.fstatSync(descriptor, { bigint: true }));
    const pathAfter = fileIdentity(
      fs.lstatSync(executablePath, { bigint: true }),
    );
    if (
      BigInt(byteLength) !== opened.size ||
      !sameIdentity(opened, after) ||
      !sameIdentity(opened, pathAfter) ||
      fs.realpathSync.native(executablePath) !== executablePath ||
      !verifyDistributionRootSnapshot(rootSnapshot)
    ) {
      throw new Error("platform_access_release_executable_changed");
    }
    return Object.freeze({
      rootSnapshot,
      executablePath,
      fileIdentity: opened,
      artifact: Object.freeze({
        relativePath: PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
        target: PLATFORM_ACCESS_TARGET,
        protocolRevision: PLATFORM_ACCESS_PROTOCOL_REVISION,
        rustToolchain: PLATFORM_ACCESS_RUST_TOOLCHAIN,
        byteLength,
        sha256: hash.digest("hex"),
      }),
    });
  } finally {
    fs.closeSync(descriptor);
  }
}

export function observePlatformAccessReleaseArtifactCandidate(
  distributionRoot: unknown,
) {
  try {
    const snapshot = observeArtifactSnapshot(distributionRoot);
    return Object.freeze({
      status: "candidate" as const,
      reason: "platform_access_release_artifact_observed_candidate",
      artifact: snapshot.artifact,
      absolutePathReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_access_release_artifact_invalid",
      artifact: null,
      absolutePathReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  }
}

export function beginPlatformAccessArtifactSigningObservation(
  distributionRoot: unknown,
) {
  try {
    const observed = observeArtifactSnapshot(distributionRoot);
    const token = Object.freeze({});
    signingSnapshots.set(
      token,
      Object.freeze({
        root: observed.rootSnapshot.root,
        rootIdentity: observed.rootSnapshot.identity,
        executablePath: observed.executablePath,
        fileIdentity: observed.fileIdentity,
        artifact: observed.artifact,
      }),
    );
    return Object.freeze({ token, artifact: observed.artifact });
  } catch {
    return null;
  }
}

export function verifyPlatformAccessArtifactSigningObservation(
  token: object,
): boolean {
  try {
    const snapshot = signingSnapshots.get(token);
    if (!snapshot) return false;
    const rootSnapshot = Object.freeze({
      root: snapshot.root,
      identity: snapshot.rootIdentity,
    });
    const observed = observeArtifactSnapshot(snapshot.root);
    return (
      observed.executablePath === snapshot.executablePath &&
      sameIdentity(snapshot.fileIdentity, observed.fileIdentity) &&
      observed.artifact.byteLength === snapshot.artifact.byteLength &&
      observed.artifact.sha256 === snapshot.artifact.sha256 &&
      verifyDistributionRootSnapshot(rootSnapshot)
    );
  } catch {
    return false;
  }
}

export function placePlatformAccessBoundReleaseManifestCandidate(
  token: object,
  canonicalBytes: unknown,
) {
  try {
    const snapshot = signingSnapshots.get(token);
    if (
      !snapshot ||
      !Buffer.isBuffer(canonicalBytes) ||
      typeof TYPED_ARRAY_BYTE_LENGTH !== "function"
    ) {
      throw new Error("release_manifest_staging_changed_after_placement");
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
      throw new Error("release_manifest_staging_changed_after_placement");
    }
    const ownedCanonicalBytes = Buffer.allocUnsafe(byteLength);
    Uint8Array.prototype.set.call(ownedCanonicalBytes, canonicalBytes);
    if (!verifyPlatformAccessArtifactSigningObservation(token)) {
      throw new Error("release_manifest_staging_changed_after_placement");
    }
    const releaseDirectory = path.join(snapshot.root, "90_Release");
    const releaseDirectorySnapshot = directoryIdentity(
      fs.lstatSync(releaseDirectory, { bigint: true }),
    );
    if (fs.realpathSync.native(releaseDirectory) !== releaseDirectory) {
      throw new Error("release_manifest_staging_changed_after_placement");
    }
    const manifestPath = path.join(
      snapshot.root,
      ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
    );
    const noFollow =
      process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
    const descriptor = fs.openSync(
      manifestPath,
      fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        fs.constants.O_RDWR |
        noFollow,
      0o644,
    );
    try {
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
        if (count <= 0) {
          throw new Error("release_manifest_staging_changed_after_placement");
        }
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
      const releaseDirectoryAfter = directoryIdentity(
        fs.lstatSync(releaseDirectory, { bigint: true }),
      );
      if (
        observedLength !== ownedCanonicalBytes.length ||
        !observedBytes
          .subarray(0, observedLength)
          .equals(ownedCanonicalBytes) ||
        !sameManifestFileIdentity(postWrite, afterRead) ||
        !sameManifestFileIdentity(postWrite, pathAfter) ||
        fs.realpathSync.native(manifestPath) !== manifestPath ||
        !sameDirectoryIdentity(
          releaseDirectorySnapshot,
          releaseDirectoryAfter,
        ) ||
        fs.realpathSync.native(releaseDirectory) !== releaseDirectory ||
        !verifyPlatformAccessArtifactSigningObservation(token)
      ) {
        throw new Error("release_manifest_staging_changed_after_placement");
      }
      return Object.freeze({
        status: "placed" as const,
        manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
      });
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    throw new Error("release_manifest_staging_changed_after_placement");
  }
}

export function describePlatformAccessReleaseContract() {
  return Object.freeze({
    artifactRelativePath: PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
    target: PLATFORM_ACCESS_TARGET,
    rustToolchain: PLATFORM_ACCESS_RUST_TOOLCHAIN,
    protocolRevision: PLATFORM_ACCESS_PROTOCOL_REVISION,
    maximumExecutableBytes: PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES,
    signedManifestBinding: "implemented_candidate",
    stableSameFileHashObservation: "implemented_candidate",
    pathEnvironmentLookup: false,
    absolutePathReported: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
