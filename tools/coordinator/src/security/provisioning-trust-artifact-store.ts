import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  PROVISIONING_RECORD_PURE_CORE_LIMITS,
  decodeProvisioningRevocationManifestCandidate,
  decodeProvisioningTrustAnchorSetCandidate,
} from "./provisioning-record-pure-core.ts";
import { PROVISIONING_RECORD_STORAGE_DIRECTORY } from "./provisioning-record-store.ts";
import { encodeProvisioningTrustFloorCandidate } from "./provisioning-trust-floor.ts";

export const PROVISIONING_TRUST_ANCHORS_DIRECTORY = "trust-anchors";
export const PROVISIONING_REVOCATION_MANIFESTS_DIRECTORY =
  "revocation-manifests";
const HASH = /^[a-f0-9]{64}$/u;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    trustEpoch: null,
    revocationRevision: null,
    trustAnchorSetHash: null,
    revocationManifestHash: null,
    persistenceCompleted: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

function exactDirectory(directory: string) {
  const metadata = fs.lstatSync(directory);
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    fs.realpathSync.native(directory) === directory
  );
}

function storePaths(storageRoot: unknown) {
  if (
    typeof storageRoot !== "string" ||
    !path.isAbsolute(storageRoot) ||
    path.resolve(storageRoot) !== storageRoot ||
    path.basename(storageRoot) !== PROVISIONING_RECORD_STORAGE_DIRECTORY ||
    !exactDirectory(storageRoot)
  ) {
    return null;
  }
  const anchors = path.join(storageRoot, PROVISIONING_TRUST_ANCHORS_DIRECTORY);
  const revocations = path.join(
    storageRoot,
    PROVISIONING_REVOCATION_MANIFESTS_DIRECTORY,
  );
  return exactDirectory(anchors) && exactDirectory(revocations)
    ? Object.freeze({ anchors, revocations })
    : null;
}

function readStableBytes(target: string) {
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink()) return null;
  const handle = fs.openSync(target, "r");
  try {
    const opened = fs.fstatSync(handle);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size < 1 ||
      opened.size > PROVISIONING_RECORD_PURE_CORE_LIMITS.artifactBytes
    ) {
      return null;
    }
    const bytes = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        handle,
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (count < 1) return null;
      offset += count;
    }
    const after = fs.fstatSync(handle);
    return after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.size === opened.size
      ? bytes
      : null;
  } finally {
    fs.closeSync(handle);
  }
}

function syncDirectory(directory: string) {
  try {
    const handle = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(handle);
      return true;
    } finally {
      fs.closeSync(handle);
    }
  } catch (error) {
    if (
      process.platform === "win32" &&
      error instanceof Error &&
      "code" in error &&
      ["EBADF", "EINVAL", "EPERM"].includes(String(error.code))
    ) {
      return false;
    }
    throw error;
  }
}

function immutableTarget(directory: string, hash: string) {
  return HASH.test(hash) ? path.join(directory, `${hash}.json`) : null;
}

function persistImmutable(
  directory: string,
  hash: string,
  canonicalBytes: Buffer,
) {
  const target = immutableTarget(directory, hash);
  if (!target) return null;
  if (fs.existsSync(target)) {
    const current = readStableBytes(target);
    return current && Buffer.prototype.equals.call(current, canonicalBytes)
      ? Object.freeze({ isCreated: false, isDirectorySynced: null })
      : null;
  }
  const handle = fs.openSync(target, "wx", 0o600);
  try {
    fs.writeFileSync(handle, canonicalBytes);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  const isDirectorySynced = syncDirectory(directory);
  const confirmed = readStableBytes(target);
  if (!confirmed || !Buffer.prototype.equals.call(confirmed, canonicalBytes)) {
    return null;
  }
  return Object.freeze({
    isCreated: true,
    isDirectorySynced,
  });
}

function metadata(canonicalBytes: Buffer) {
  const value = JSON.parse(canonicalBytes.toString("utf8")) as Record<
    string,
    unknown
  >;
  return Object.freeze({
    trustEpoch: value.trustEpoch,
    revocationRevision: value.revocationRevision,
  });
}

function artifactCandidate(
  raw: unknown,
  decode: typeof decodeProvisioningTrustAnchorSetCandidate,
) {
  const decoded = decode(raw);
  if (
    decoded.status !== "candidate" ||
    !decoded.canonicalBytes ||
    !decoded.canonicalHash
  ) {
    return null;
  }
  const canonicalBytes = Buffer.from(decoded.canonicalBytes);
  return Object.freeze({
    canonicalBytes,
    canonicalHash: decoded.canonicalHash,
    metadata: metadata(canonicalBytes),
  });
}

export function persistProvisioningTrustArtifactsForEffect(
  storageRoot: unknown,
  trustAnchorSetBytes: unknown,
  revocationManifestBytes: unknown,
) {
  try {
    const paths = storePaths(storageRoot);
    const anchors = artifactCandidate(
      trustAnchorSetBytes,
      decodeProvisioningTrustAnchorSetCandidate,
    );
    const revocations = artifactCandidate(
      revocationManifestBytes,
      decodeProvisioningRevocationManifestCandidate,
    );
    if (
      !paths ||
      !anchors ||
      !revocations ||
      typeof anchors.metadata.trustEpoch !== "number" ||
      typeof revocations.metadata.trustEpoch !== "number" ||
      typeof revocations.metadata.revocationRevision !== "number" ||
      anchors.metadata.trustEpoch !== revocations.metadata.trustEpoch
    ) {
      return blocked("provisioning_trust_artifact_store_input_invalid");
    }
    const anchorWrite = persistImmutable(
      paths.anchors,
      anchors.canonicalHash,
      anchors.canonicalBytes,
    );
    const revocationWrite = persistImmutable(
      paths.revocations,
      revocations.canonicalHash,
      revocations.canonicalBytes,
    );
    if (!anchorWrite || !revocationWrite) {
      return blocked("provisioning_trust_artifact_store_persistence_failed");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "provisioning_trust_artifacts_persisted_and_reread",
      trustEpoch: anchors.metadata.trustEpoch,
      revocationRevision: revocations.metadata.revocationRevision,
      trustAnchorSetHash: anchors.canonicalHash,
      revocationManifestHash: revocations.canonicalHash,
      persistenceCompleted: true,
      parentDirectorySyncCompleted:
        anchorWrite.isDirectorySynced !== false &&
        revocationWrite.isDirectorySynced !== false,
      filesystemEffectIssued:
        anchorWrite.isCreated || revocationWrite.isCreated,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("provisioning_trust_artifact_store_persistence_failed");
  }
}

export function verifyStoredProvisioningTrustArtifactsCandidate(
  storageRoot: unknown,
  floor: unknown,
) {
  try {
    const paths = storePaths(storageRoot);
    const encodedFloor = encodeProvisioningTrustFloorCandidate(floor);
    if (!paths || encodedFloor.status !== "candidate") {
      return blocked("provisioning_trust_artifact_store_floor_invalid");
    }
    const anchorTarget = immutableTarget(
      paths.anchors,
      encodedFloor.floor.trustAnchorSetHash,
    );
    const revocationTarget = immutableTarget(
      paths.revocations,
      encodedFloor.floor.revocationManifestHash,
    );
    if (
      !anchorTarget ||
      !revocationTarget ||
      !fs.existsSync(anchorTarget) ||
      !fs.existsSync(revocationTarget)
    ) {
      return blocked("provisioning_trust_artifact_store_artifact_missing");
    }
    const anchors = artifactCandidate(
      readStableBytes(anchorTarget),
      decodeProvisioningTrustAnchorSetCandidate,
    );
    const revocations = artifactCandidate(
      readStableBytes(revocationTarget),
      decodeProvisioningRevocationManifestCandidate,
    );
    if (
      !anchors ||
      !revocations ||
      createHash("sha256").update(anchors.canonicalBytes).digest("hex") !==
        encodedFloor.floor.trustAnchorSetHash ||
      createHash("sha256").update(revocations.canonicalBytes).digest("hex") !==
        encodedFloor.floor.revocationManifestHash ||
      anchors.metadata.trustEpoch !== encodedFloor.floor.trustEpoch ||
      revocations.metadata.trustEpoch !== encodedFloor.floor.trustEpoch ||
      revocations.metadata.revocationRevision !==
        encodedFloor.floor.revocationRevision
    ) {
      return blocked("provisioning_trust_artifact_store_binding_mismatch");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "stored_provisioning_trust_artifacts_match_floor",
      trustEpoch: encodedFloor.floor.trustEpoch,
      revocationRevision: encodedFloor.floor.revocationRevision,
      trustAnchorSetHash: encodedFloor.floor.trustAnchorSetHash,
      revocationManifestHash: encodedFloor.floor.revocationManifestHash,
      persistenceCompleted: true,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("provisioning_trust_artifact_store_read_failed");
  }
}

export function describeProvisioningTrustArtifactStoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/provisioning-trust-artifact-store",
    contractRevision: 1,
    trustAnchorLayout: `${PROVISIONING_RECORD_STORAGE_DIRECTORY}/${PROVISIONING_TRUST_ANCHORS_DIRECTORY}/<sha256>.json`,
    revocationLayout: `${PROVISIONING_RECORD_STORAGE_DIRECTORY}/${PROVISIONING_REVOCATION_MANIFESTS_DIRECTORY}/<sha256>.json`,
    storage: "immutable_content_addressed_canonical_artifacts",
    floorBinding: "implemented_candidate",
    persistence: "implemented_candidate",
    repositoryCanonicalTrustStored: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
