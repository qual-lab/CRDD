import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolvePlatformAccessExecutableForPrivateInvocation,
  verifyPlatformAccessExecutableSnapshot,
} from "./platform-access-release.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";

const responseMagic = Buffer.from("CRDDPR01", "ascii");
const requestMagic = Buffer.from("CRDDPA01", "ascii");
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const REQUEST_HEADER_BYTES = 60;
const MAXIMUM_PATH_BYTES = 4_096;
const PROCESS_TIMEOUT_MILLISECONDS = 5_000;
const PROCESS_MAXIMUM_OUTPUT_BYTES = 4_096;
const RESPONSE_BYTES = 50;
const PROTOCOL_REVISION = 1;
const RESPONSE_STATUS_CANDIDATE = 1;
const OBSERVATION_CANDIDATE_REASON = 100;
const KNOWN_ACCESS_MASK = 0x1ff;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

const ACCESS_FLAGS = Object.freeze({
  readTraverse: 1 << 0,
  addFile: 1 << 1,
  addSubdirectory: 1 << 2,
  writeExtendedAttributes: 1 << 3,
  writeAttributes: 1 << 4,
  deleteChild: 1 << 5,
  deleteOnRootObject: 1 << 6,
  writeDacl: 1 << 7,
  writeOwner: 1 << 8,
});

type RootRole = "runtime" | "authority";

function blocked(
  reason: string,
  isHelperProcessSpawned = false,
  isHelperResponseValidated = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    accessObservation: null,
    helperProcessSpawned: isHelperProcessSpawned,
    helperResponseValidated: isHelperResponseValidated,
    absolutePathReported: false,
    principalReported: false,
    aclReported: false,
    rawErrorReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

function snapshotBuffer(value: unknown, expectedLength: number): Buffer | null {
  try {
    if (
      !Buffer.isBuffer(value) ||
      typeof TYPED_ARRAY_BYTE_LENGTH !== "function"
    ) {
      return null;
    }
    const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []);
    if (length !== expectedLength) return null;
    const owned = Buffer.allocUnsafe(expectedLength);
    Uint8Array.prototype.set.call(owned, value);
    return owned;
  } catch {
    return null;
  }
}

function matchesBytes(
  bytes: Buffer,
  offset: number,
  expected: Buffer,
): boolean {
  for (let index = 0; index < expected.length; index += 1) {
    if (readByte(bytes, offset + index) !== readByte(expected, index)) {
      return false;
    }
  }
  return true;
}

function readByte(bytes: Buffer, offset: number): number {
  return bytes[offset] ?? 0xff;
}

function readUInt16LittleEndian(bytes: Buffer, offset: number): number {
  return readByte(bytes, offset) | (readByte(bytes, offset + 1) << 8);
}

function readUInt32LittleEndian(bytes: Buffer, offset: number): number {
  return (
    (readByte(bytes, offset) |
      (readByte(bytes, offset + 1) << 8) |
      (readByte(bytes, offset + 2) << 16) |
      (readByte(bytes, offset + 3) << 24)) >>>
    0
  );
}

function roleValue(rootRole: RootRole): number {
  return rootRole === "runtime" ? 1 : 2;
}

export function evaluatePlatformAccessResponseCandidate(
  rawResponse: unknown,
  expectedNonce: unknown,
  rootRole: unknown,
) {
  try {
    const responseBytes = snapshotBuffer(rawResponse, RESPONSE_BYTES);
    const nonceBytes = snapshotBuffer(expectedNonce, 32);
    if (
      !responseBytes ||
      !nonceBytes ||
      (rootRole !== "runtime" && rootRole !== "authority") ||
      !matchesBytes(responseBytes, 0, responseMagic) ||
      readUInt16LittleEndian(responseBytes, 8) !== PROTOCOL_REVISION ||
      readByte(responseBytes, 10) !== roleValue(rootRole) ||
      readByte(responseBytes, 11) !== RESPONSE_STATUS_CANDIDATE ||
      !matchesBytes(responseBytes, 12, nonceBytes) ||
      readUInt16LittleEndian(responseBytes, 44) !== OBSERVATION_CANDIDATE_REASON
    ) {
      return blocked("platform_access_helper_response_invalid");
    }
    const accessMask = readUInt32LittleEndian(responseBytes, 46);
    if ((accessMask & ~KNOWN_ACCESS_MASK) !== 0) {
      return blocked("platform_access_helper_response_invalid");
    }
    const accessObservation = Object.freeze(
      Object.fromEntries(
        Object.entries(ACCESS_FLAGS).map(([name, flag]) => [
          name,
          (accessMask & flag) !== 0,
        ]),
      ),
    );
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_current_process_access_observed_candidate",
      accessObservation,
      helperProcessSpawned: false,
      helperResponseValidated: true,
      absolutePathReported: false,
      principalReported: false,
      aclReported: false,
      rawErrorReported: false,
      permissionMutationIssued: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("platform_access_helper_response_invalid");
  }
}

export function inspectWindowsPlatformAccessCandidate(
  rootPath: unknown,
  rootRole: unknown,
) {
  try {
    const verifiedRelease =
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime: new Date().toISOString(),
      });
    if (
      verifiedRelease.status !== "candidate" ||
      !verifiedRelease.platformAccessArtifact
    ) {
      return blocked("platform_access_release_binary_binding_unavailable");
    }
    const executable = resolvePlatformAccessExecutableForPrivateInvocation(
      bundledDistributionRoot,
      verifiedRelease.platformAccessArtifact,
    );
    if (!executable) {
      return blocked("platform_access_release_binary_binding_invalid");
    }
    const request = platformAccessRequest(rootPath, rootRole);
    if (!request) {
      return blocked("platform_access_request_invalid");
    }
    const processResult = spawnSync(executable.executablePath, [], {
      cwd: path.dirname(executable.executablePath),
      env: {},
      input: request.bytes,
      encoding: "buffer",
      windowsHide: true,
      shell: false,
      timeout: PROCESS_TIMEOUT_MILLISECONDS,
      maxBuffer: PROCESS_MAXIMUM_OUTPUT_BYTES,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const isExecutableStable =
      verifyPlatformAccessExecutableSnapshot(executable);
    const isRootStable = verifyRootSnapshot(request.rootSnapshot);
    if (
      processResult.error ||
      processResult.signal !== null ||
      processResult.status !== 0 ||
      !Buffer.isBuffer(processResult.stdout) ||
      !Buffer.isBuffer(processResult.stderr) ||
      processResult.stderr.length !== 0 ||
      !isExecutableStable ||
      !isRootStable
    ) {
      return blocked("platform_access_helper_process_blocked", true, false);
    }
    const evaluated = evaluatePlatformAccessResponseCandidate(
      processResult.stdout,
      request.nonce,
      request.rootRole,
    );
    if (evaluated.status !== "candidate") {
      return blocked("platform_access_helper_process_blocked", true, false);
    }
    return Object.freeze({
      ...evaluated,
      helperProcessSpawned: true,
      helperResponseValidated: true,
    });
  } catch {
    return blocked("platform_access_helper_process_blocked", false, false);
  }
}

type RootSnapshot = Readonly<{
  rootPath: string;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

function rootSnapshot(rawPath: unknown): RootSnapshot | null {
  try {
    if (
      typeof rawPath !== "string" ||
      !/^[A-Z]:\\/u.test(rawPath) ||
      rawPath.includes("\0") ||
      rawPath.includes("/") ||
      Buffer.byteLength(rawPath, "utf8") > MAXIMUM_PATH_BYTES ||
      path.win32.normalize(rawPath) !== rawPath
    ) {
      return null;
    }
    const metadata = fs.lstatSync(rawPath, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.dev <= 0n ||
      metadata.dev > 0xffff_ffffn ||
      metadata.ino <= 0n ||
      metadata.ino > 0xffff_ffff_ffff_ffffn ||
      metadata.birthtimeNs <= 0n ||
      fs.realpathSync.native(rawPath) !== rawPath
    ) {
      return null;
    }
    return Object.freeze({
      rootPath: rawPath,
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeNs: metadata.birthtimeNs,
    });
  } catch {
    return null;
  }
}

function verifyRootSnapshot(snapshot: RootSnapshot): boolean {
  const current = rootSnapshot(snapshot.rootPath);
  return Boolean(
    current &&
      current.dev === snapshot.dev &&
      current.ino === snapshot.ino &&
      current.birthtimeNs === snapshot.birthtimeNs,
  );
}

function platformAccessRequest(rawPath: unknown, rawRole: unknown) {
  const root = rootSnapshot(rawPath);
  if (!root || (rawRole !== "runtime" && rawRole !== "authority")) {
    return null;
  }
  const pathBytes = Buffer.from(root.rootPath, "utf8");
  const bytes = Buffer.alloc(REQUEST_HEADER_BYTES + pathBytes.length);
  requestMagic.copy(bytes, 0);
  bytes.writeUInt16LE(PROTOCOL_REVISION, 8);
  bytes[10] = 1;
  bytes[11] = roleValue(rawRole);
  const nonce = randomBytes(32);
  nonce.copy(bytes, 12);
  bytes.writeUInt32LE(Number(root.dev), 44);
  bytes.writeUInt32LE(Number((root.ino >> 32n) & 0xffff_ffffn), 48);
  bytes.writeUInt32LE(Number(root.ino & 0xffff_ffffn), 52);
  bytes.writeUInt32LE(pathBytes.length, 56);
  pathBytes.copy(bytes, REQUEST_HEADER_BYTES);
  return Object.freeze({
    bytes,
    nonce,
    rootRole: rawRole,
    rootSnapshot: root,
  });
}

export function describePlatformAccessAdapterContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-access-adapter",
    contractRevision: 1,
    implementationLanguage: "rust",
    rustCrate: "crdd-platform-access",
    rustToolchain: "1.94.1",
    target: "x86_64-pc-windows-msvc",
    wireProtocol: "fixed_bounded_binary_revision_1",
    windowsCurrentProcessAccessCore: "implemented_candidate_component_only",
    binaryReleaseIdentityBinding: "implemented_candidate_signed_manifest",
    productionInvocation:
      "implemented_candidate_fixed_absolute_release_path_bounded_process",
    processTimeoutMilliseconds: PROCESS_TIMEOUT_MILLISECONDS,
    processMaximumOutputBytes: PROCESS_MAXIMUM_OUTPUT_BYTES,
    shellInvocation: false,
    pathEnvironmentLookup: false,
    cargoRuntimeInvocation: false,
    windowsPermissionMutation: "not_implemented",
    posixAdapter: "not_implemented",
    absolutePathReported: false,
    principalReported: false,
    aclReported: false,
    rawErrorReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
