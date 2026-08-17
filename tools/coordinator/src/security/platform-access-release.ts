import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PLATFORM_ACCESS_TARGET = "x86_64-pc-windows-msvc";
export const PLATFORM_ACCESS_RUST_TOOLCHAIN = "1.94.1";
export const PLATFORM_ACCESS_PROTOCOL_REVISION = 1;
export const PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES = 16 * 1024 * 1024;
export const PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH =
  "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe";

const ARTIFACT_KEYS = new Set([
  "relativePath",
  "target",
  "protocolRevision",
  "rustToolchain",
  "byteLength",
  "sha256",
]);
const HEX64 = /^[0-9a-f]{64}$/u;

type FileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  mtimeNs: bigint;
  size: bigint;
  mode: bigint;
}>;

type DirectoryIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

export type PlatformAccessExecutableSnapshot = Readonly<{
  executablePath: string;
  identity: FileIdentity;
  sha256: string;
  byteLength: number;
}>;

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

function expectedArtifact(raw: unknown) {
  const artifact = snapshotPlainRecord(raw, ARTIFACT_KEYS);
  if (
    !artifact ||
    artifact.relativePath !== PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH ||
    artifact.target !== PLATFORM_ACCESS_TARGET ||
    artifact.protocolRevision !== PLATFORM_ACCESS_PROTOCOL_REVISION ||
    artifact.rustToolchain !== PLATFORM_ACCESS_RUST_TOOLCHAIN ||
    typeof artifact.byteLength !== "number" ||
    !Number.isSafeInteger(artifact.byteLength) ||
    artifact.byteLength < 1 ||
    artifact.byteLength > PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES ||
    typeof artifact.sha256 !== "string" ||
    !HEX64.test(artifact.sha256)
  ) {
    throw new Error("platform_access_release_artifact_invalid");
  }
  return Object.freeze({
    relativePath: artifact.relativePath,
    target: artifact.target,
    protocolRevision: artifact.protocolRevision,
    rustToolchain: artifact.rustToolchain,
    byteLength: artifact.byteLength,
    sha256: artifact.sha256,
  });
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

export function observePlatformAccessReleaseArtifactCandidate(
  distributionRoot: unknown,
) {
  try {
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
        status: "candidate" as const,
        reason: "platform_access_release_artifact_observed_candidate",
        artifact: Object.freeze({
          relativePath: PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
          target: PLATFORM_ACCESS_TARGET,
          protocolRevision: PLATFORM_ACCESS_PROTOCOL_REVISION,
          rustToolchain: PLATFORM_ACCESS_RUST_TOOLCHAIN,
          byteLength,
          sha256: hash.digest("hex"),
        }),
        absolutePathReported: false,
        filesystemEffectIssued: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      });
    } finally {
      fs.closeSync(descriptor);
    }
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

export function resolvePlatformAccessExecutableForPrivateInvocation(
  distributionRoot: unknown,
  rawExpectedArtifact: unknown,
): PlatformAccessExecutableSnapshot | null {
  try {
    const expected = expectedArtifact(rawExpectedArtifact);
    const observed =
      observePlatformAccessReleaseArtifactCandidate(distributionRoot);
    if (
      observed.status !== "candidate" ||
      !observed.artifact ||
      observed.artifact.byteLength !== expected.byteLength ||
      observed.artifact.sha256 !== expected.sha256
    ) {
      return null;
    }
    const rootSnapshot = distributionRootSnapshot(distributionRoot);
    const root = rootSnapshot.root;
    const executablePath = path.join(
      root,
      ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
    );
    const identity = fileIdentity(
      fs.lstatSync(executablePath, { bigint: true }),
    );
    if (!verifyDistributionRootSnapshot(rootSnapshot)) return null;
    return Object.freeze({
      executablePath,
      identity,
      sha256: observed.artifact.sha256,
      byteLength: observed.artifact.byteLength,
    });
  } catch {
    return null;
  }
}

export function verifyPlatformAccessExecutableSnapshot(
  snapshot: PlatformAccessExecutableSnapshot,
): boolean {
  try {
    const current = fileIdentity(
      fs.lstatSync(snapshot.executablePath, { bigint: true }),
    );
    return (
      sameIdentity(snapshot.identity, current) &&
      fs.realpathSync.native(snapshot.executablePath) ===
        snapshot.executablePath
    );
  } catch {
    return false;
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
