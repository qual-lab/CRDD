import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  inspectNativeBootstrapPe,
  NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
} from "./native-bootstrap-pe-inspector.ts";

export const NATIVE_PROVISION_SUPERVISOR_TARGET = "x86_64-pc-windows-msvc";
export const NATIVE_PROVISION_SUPERVISOR_RUST_TOOLCHAIN = "1.94.1";
export const NATIVE_PROVISION_SUPERVISOR_ENTRYPOINT_CONTRACT_REVISION = 2;
export const NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES =
  NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES;
export const NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH =
  "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe";

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
      entrypointContractRevision: number;
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
    metadata.size > BigInt(NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES)
  ) {
    throw new Error("native_provision_supervisor_release_executable_invalid");
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

function sameFileIdentity(left: FileIdentity, right: FileIdentity) {
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
    throw new Error("native_provision_supervisor_release_distribution_invalid");
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
) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

function observeArtifactSnapshot(distributionRoot: unknown) {
  if (
    typeof distributionRoot !== "string" ||
    distributionRoot.length === 0 ||
    distributionRoot.includes("\0") ||
    !path.isAbsolute(distributionRoot)
  ) {
    throw new Error("native_provision_supervisor_release_distribution_invalid");
  }
  const root = path.resolve(distributionRoot);
  const rootIdentity = directoryIdentity(fs.lstatSync(root, { bigint: true }));
  if (fs.realpathSync.native(root) !== root) {
    throw new Error("native_provision_supervisor_release_distribution_invalid");
  }
  const executablePath = path.join(
    root,
    ...NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  const before = fileIdentity(fs.lstatSync(executablePath, { bigint: true }));
  if (fs.realpathSync.native(executablePath) !== executablePath) {
    throw new Error("native_provision_supervisor_release_executable_invalid");
  }
  const descriptor = fs.openSync(executablePath, fs.constants.O_RDONLY);
  try {
    const opened = fileIdentity(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameFileIdentity(before, opened)) {
      throw new Error("native_provision_supervisor_release_executable_changed");
    }
    const buffer = Buffer.allocUnsafe(64 * 1024);
    const byteChunks: Buffer[] = [];
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      if (byteLength > NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES) {
        throw new Error(
          "native_provision_supervisor_release_executable_invalid",
        );
      }
      byteChunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const executableBytes = Buffer.concat(byteChunks, byteLength);
    const inspection = inspectNativeBootstrapPe(executableBytes);
    if (inspection.status !== "accepted") {
      throw new Error("native_provision_supervisor_release_executable_invalid");
    }
    const after = fileIdentity(fs.fstatSync(descriptor, { bigint: true }));
    const pathAfter = fileIdentity(
      fs.lstatSync(executablePath, { bigint: true }),
    );
    const currentRoot = directoryIdentity(fs.lstatSync(root, { bigint: true }));
    if (
      BigInt(byteLength) !== opened.size ||
      !sameFileIdentity(opened, after) ||
      !sameFileIdentity(opened, pathAfter) ||
      !sameDirectoryIdentity(rootIdentity, currentRoot) ||
      fs.realpathSync.native(executablePath) !== executablePath ||
      fs.realpathSync.native(root) !== root
    ) {
      throw new Error("native_provision_supervisor_release_executable_changed");
    }
    return Object.freeze({
      root,
      rootIdentity,
      executablePath,
      fileIdentity: opened,
      artifact: Object.freeze({
        relativePath: NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH,
        target: NATIVE_PROVISION_SUPERVISOR_TARGET,
        entrypointContractRevision:
          NATIVE_PROVISION_SUPERVISOR_ENTRYPOINT_CONTRACT_REVISION,
        rustToolchain: NATIVE_PROVISION_SUPERVISOR_RUST_TOOLCHAIN,
        byteLength,
        sha256: createHash("sha256").update(executableBytes).digest("hex"),
      }),
    });
  } finally {
    fs.closeSync(descriptor);
  }
}

export function beginNativeProvisionSupervisorArtifactSigningObservation(
  distributionRoot: unknown,
) {
  try {
    const observed = observeArtifactSnapshot(distributionRoot);
    const token = Object.freeze({});
    signingSnapshots.set(token, observed);
    return Object.freeze({ token, artifact: observed.artifact });
  } catch {
    return null;
  }
}

export function verifyNativeProvisionSupervisorArtifactSigningObservation(
  token: object,
) {
  try {
    const snapshot = signingSnapshots.get(token);
    if (!snapshot) return false;
    const observed = observeArtifactSnapshot(snapshot.root);
    return (
      sameDirectoryIdentity(snapshot.rootIdentity, observed.rootIdentity) &&
      snapshot.executablePath === observed.executablePath &&
      sameFileIdentity(snapshot.fileIdentity, observed.fileIdentity) &&
      snapshot.artifact.byteLength === observed.artifact.byteLength &&
      snapshot.artifact.sha256 === observed.artifact.sha256
    );
  } catch {
    return false;
  }
}

export function describeNativeProvisionSupervisorReleaseContract() {
  return Object.freeze({
    artifactRelativePath: NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH,
    target: NATIVE_PROVISION_SUPERVISOR_TARGET,
    rustToolchain: NATIVE_PROVISION_SUPERVISOR_RUST_TOOLCHAIN,
    entrypointContractRevision:
      NATIVE_PROVISION_SUPERVISOR_ENTRYPOINT_CONTRACT_REVISION,
    maximumExecutableBytes:
      NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES,
    signedManifestBinding: "implemented_candidate",
    stableSameFileHashObservation: "implemented_candidate",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
