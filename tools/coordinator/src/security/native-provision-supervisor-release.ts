import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  inspectNativeBootstrapPe,
  NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
} from "./native-bootstrap-pe-inspector.ts";
import {
  readStableBoundedFileSnapshot,
  sameStableFileIdentity,
  type StableFileIdentity,
} from "./bounded-file-snapshot.ts";

export const NATIVE_PROVISION_SUPERVISOR_TARGET = "x86_64-pc-windows-msvc";
export const NATIVE_PROVISION_SUPERVISOR_RUST_TOOLCHAIN = "1.94.1";
export const NATIVE_PROVISION_SUPERVISOR_ENTRYPOINT_CONTRACT_REVISION = 2;
export const NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES =
  NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES;
export const NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH =
  "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe";

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
    fileIdentity: StableFileIdentity;
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
  try {
    const snapshot = readStableBoundedFileSnapshot(
      executablePath,
      NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES,
    );
    const executableBytes = snapshot.bytes;
    const byteLength = executableBytes.length;
    const inspection = inspectNativeBootstrapPe(executableBytes);
    if (inspection.status !== "accepted") {
      throw new Error("native_provision_supervisor_release_executable_invalid");
    }
    const currentRoot = directoryIdentity(fs.lstatSync(root, { bigint: true }));
    if (
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
      fileIdentity: snapshot.identity,
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
  } catch {
    throw new Error("native_provision_supervisor_release_executable_invalid");
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
      sameStableFileIdentity(snapshot.fileIdentity, observed.fileIdentity) &&
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
