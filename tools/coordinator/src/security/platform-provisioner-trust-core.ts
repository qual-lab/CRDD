import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  canonicalizeProvisioningJsonValueCandidate,
  inspectProvisioningEd25519SpkiCandidate,
  PROVISIONING_SIGNATURE_INPUT_LIMITS,
  verifyProvisioningEd25519Base64urlCandidate,
} from "./provisioning-signature-primitives.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import {
  PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  PLATFORM_ACCESS_PROTOCOL_REVISION,
  PLATFORM_ACCESS_RUST_TOOLCHAIN,
  PLATFORM_ACCESS_TARGET,
} from "./platform-access-release.ts";
import {
  NATIVE_PROVISION_SUPERVISOR_ENTRYPOINT_CONTRACT_REVISION,
  NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES,
  NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH,
  NATIVE_PROVISION_SUPERVISOR_RUST_TOOLCHAIN,
  NATIVE_PROVISION_SUPERVISOR_TARGET,
} from "./native-provision-supervisor-release.ts";

export const PLATFORM_PROVISIONER_MANIFEST_REVISION = 2;
export const PLATFORM_PROVISIONER_MANIFEST_CONTRACT =
  "crdd-coordinator/platform-provisioner-package-manifest";
export const PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT =
  "crdd-coordinator/platform-provisioner-package-manifest-envelope";
export const PLATFORM_PROVISIONER_MANIFEST_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-PACKAGE-MANIFEST\0V2\0";
export const PLATFORM_PROVISIONER_PACKAGE_CONTENT_DOMAIN =
  "CRDD\0PLATFORM-PROVISIONER-PACKAGE-CONTENT\0V1\0";

const MANIFEST_KEYS = new Set([
  "contract",
  "contractRevision",
  "packageName",
  "packageVersion",
  "crddVersion",
  "releaseSequence",
  "crddCommit",
  "crddTree",
  "packageContentRootSha256",
  "rootProtectionPolicySha256",
  "keyStoragePolicySha256",
  "platformAccessArtifact",
  "nativeProvisionSupervisorArtifact",
  "issuedAt",
  "expiresAt",
]);
const PLATFORM_ACCESS_ARTIFACT_KEYS = new Set([
  "relativePath",
  "target",
  "protocolRevision",
  "rustToolchain",
  "byteLength",
  "sha256",
]);
const NATIVE_PROVISION_SUPERVISOR_ARTIFACT_KEYS = new Set([
  "relativePath",
  "target",
  "entrypointContractRevision",
  "rustToolchain",
  "byteLength",
  "sha256",
]);
const OBSERVED_PACKAGE_KEYS = new Set([
  "packageName",
  "packageVersion",
  "files",
]);
const FILE_KEYS = new Set(["path", "byteLength", "sha256"]);
const ENVELOPE_KEYS = new Set([
  "contract",
  "contractRevision",
  "payload",
  "signatures",
]);
const SIGNATURE_KEYS = new Set(["keyId", "algorithm", "signature"]);
const VERIFY_KEYS = new Set([
  "manifestEnvelope",
  "releaseSignerSpkiDer",
  "observedPackageContent",
  "evaluationTime",
]);
const COMPILE_KEYS = new Set(["manifestPayload"]);
const HEX64 = /^[0-9a-f]{64}$/u;
const CRDD_GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;
const PACKAGE_NAME = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/u;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const PACKAGE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u;
const MAXIMUM_FILES = 2_048;
const MAXIMUM_PATH_BYTES = 512;
const MAXIMUM_FILE_BYTES = 512 * 1024 * 1024;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;

function response<
  S extends "candidate" | "blocked",
  T extends Record<string, unknown>,
>(status: S, reason: string, fields: T) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    runtimeOwnedReleaseTrustConfirmed: false,
    crddDistributionConfirmed: false,
    runtimeOwnedPackageFilesystemConfirmed: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

function utc(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UTC.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

function packageIdentity(name: string, version: string) {
  return (
    typeof name === "string" &&
    name.length <= 214 &&
    PACKAGE_NAME.test(name) &&
    typeof version === "string" &&
    version.length <= 96 &&
    VERSION.test(version)
  );
}

function normalizeFile(raw: unknown) {
  const value = snapshotPlainRecord(raw, FILE_KEYS);
  if (
    !value ||
    typeof value.path !== "string" ||
    !PACKAGE_PATH.test(value.path) ||
    Buffer.byteLength(value.path, "utf8") > MAXIMUM_PATH_BYTES ||
    value.path.includes("\\") ||
    value.path.startsWith("/") ||
    value.path.endsWith("/") ||
    value.path
      .split("/")
      .some(
        (/** @type {string} */ segment) => segment === "." || segment === "..",
      ) ||
    typeof value.byteLength !== "number" ||
    !Number.isSafeInteger(value.byteLength) ||
    value.byteLength < 0 ||
    value.byteLength > MAXIMUM_FILE_BYTES ||
    typeof value.sha256 !== "string" ||
    !HEX64.test(value.sha256)
  )
    return null;
  return Object.freeze({
    path: value.path,
    byteLength: value.byteLength,
    sha256: value.sha256,
  });
}

function normalizeFiles(raw: unknown) {
  const snapshot = snapshotPlainArray<unknown>(raw, MAXIMUM_FILES);
  if (snapshot.status !== "ok" || snapshot.value.length === 0) return null;
  const files: Array<
    Readonly<{ path: string; byteLength: number; sha256: string }>
  > = [];
  let previous: string | null = null;
  for (const rawFile of snapshot.value) {
    const file = normalizeFile(rawFile);
    if (!file || (previous !== null && previous >= file.path)) return null;
    files.push(file);
    previous = file.path;
  }
  return Object.freeze(files);
}

function normalizeObservedPackage(raw: unknown) {
  const value = snapshotPlainRecord(raw, OBSERVED_PACKAGE_KEYS);
  if (
    !value ||
    typeof value.packageName !== "string" ||
    typeof value.packageVersion !== "string" ||
    !packageIdentity(value.packageName, value.packageVersion)
  )
    return null;
  const files = normalizeFiles(value.files);
  return files
    ? Object.freeze({
        packageName: value.packageName,
        packageVersion: value.packageVersion,
        files,
      })
    : null;
}

function normalizeManifest(raw: unknown) {
  const value = snapshotPlainRecord(raw, MANIFEST_KEYS);
  const platformAccessArtifact =
    value &&
    snapshotPlainRecord(
      value.platformAccessArtifact,
      PLATFORM_ACCESS_ARTIFACT_KEYS,
    );
  const nativeProvisionSupervisorArtifact =
    value &&
    snapshotPlainRecord(
      value.nativeProvisionSupervisorArtifact,
      NATIVE_PROVISION_SUPERVISOR_ARTIFACT_KEYS,
    );
  if (
    !value ||
    value.contract !== PLATFORM_PROVISIONER_MANIFEST_CONTRACT ||
    value.contractRevision !== PLATFORM_PROVISIONER_MANIFEST_REVISION ||
    typeof value.packageName !== "string" ||
    typeof value.packageVersion !== "string" ||
    !packageIdentity(value.packageName, value.packageVersion) ||
    typeof value.crddVersion !== "string" ||
    !CRDD_VERSION.test(value.crddVersion) ||
    typeof value.releaseSequence !== "number" ||
    !Number.isSafeInteger(value.releaseSequence) ||
    value.releaseSequence < 1 ||
    typeof value.crddCommit !== "string" ||
    !CRDD_GIT_OBJECT_ID.test(value.crddCommit) ||
    typeof value.crddTree !== "string" ||
    !CRDD_GIT_OBJECT_ID.test(value.crddTree) ||
    typeof value.packageContentRootSha256 !== "string" ||
    !HEX64.test(value.packageContentRootSha256) ||
    typeof value.rootProtectionPolicySha256 !== "string" ||
    !HEX64.test(value.rootProtectionPolicySha256) ||
    typeof value.keyStoragePolicySha256 !== "string" ||
    !HEX64.test(value.keyStoragePolicySha256) ||
    !platformAccessArtifact ||
    platformAccessArtifact.relativePath !==
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH ||
    platformAccessArtifact.target !== PLATFORM_ACCESS_TARGET ||
    platformAccessArtifact.protocolRevision !==
      PLATFORM_ACCESS_PROTOCOL_REVISION ||
    platformAccessArtifact.rustToolchain !== PLATFORM_ACCESS_RUST_TOOLCHAIN ||
    typeof platformAccessArtifact.byteLength !== "number" ||
    !Number.isSafeInteger(platformAccessArtifact.byteLength) ||
    platformAccessArtifact.byteLength < 1 ||
    platformAccessArtifact.byteLength >
      PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES ||
    typeof platformAccessArtifact.sha256 !== "string" ||
    !HEX64.test(platformAccessArtifact.sha256) ||
    !nativeProvisionSupervisorArtifact ||
    nativeProvisionSupervisorArtifact.relativePath !==
      NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_RELATIVE_PATH ||
    nativeProvisionSupervisorArtifact.target !==
      NATIVE_PROVISION_SUPERVISOR_TARGET ||
    nativeProvisionSupervisorArtifact.entrypointContractRevision !==
      NATIVE_PROVISION_SUPERVISOR_ENTRYPOINT_CONTRACT_REVISION ||
    nativeProvisionSupervisorArtifact.rustToolchain !==
      NATIVE_PROVISION_SUPERVISOR_RUST_TOOLCHAIN ||
    typeof nativeProvisionSupervisorArtifact.byteLength !== "number" ||
    !Number.isSafeInteger(nativeProvisionSupervisorArtifact.byteLength) ||
    nativeProvisionSupervisorArtifact.byteLength < 1 ||
    nativeProvisionSupervisorArtifact.byteLength >
      NATIVE_PROVISION_SUPERVISOR_EXECUTABLE_MAXIMUM_BYTES ||
    typeof nativeProvisionSupervisorArtifact.sha256 !== "string" ||
    !HEX64.test(nativeProvisionSupervisorArtifact.sha256) ||
    !utc(value.issuedAt) ||
    !utc(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.issuedAt)
  )
    return null;
  return Object.freeze({
    ...value,
    packageName: value.packageName,
    packageVersion: value.packageVersion,
    crddVersion: value.crddVersion,
    releaseSequence: value.releaseSequence,
    crddCommit: value.crddCommit,
    crddTree: value.crddTree,
    packageContentRootSha256: value.packageContentRootSha256,
    rootProtectionPolicySha256: value.rootProtectionPolicySha256,
    keyStoragePolicySha256: value.keyStoragePolicySha256,
    platformAccessArtifact: Object.freeze({
      relativePath: platformAccessArtifact.relativePath,
      target: platformAccessArtifact.target,
      protocolRevision: platformAccessArtifact.protocolRevision,
      rustToolchain: platformAccessArtifact.rustToolchain,
      byteLength: platformAccessArtifact.byteLength,
      sha256: platformAccessArtifact.sha256,
    }),
    nativeProvisionSupervisorArtifact: Object.freeze({
      relativePath: nativeProvisionSupervisorArtifact.relativePath,
      target: nativeProvisionSupervisorArtifact.target,
      entrypointContractRevision:
        nativeProvisionSupervisorArtifact.entrypointContractRevision,
      rustToolchain: nativeProvisionSupervisorArtifact.rustToolchain,
      byteLength: nativeProvisionSupervisorArtifact.byteLength,
      sha256: nativeProvisionSupervisorArtifact.sha256,
    }),
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  });
}

function normalizeSignature(raw: unknown) {
  const value = snapshotPlainRecord(raw, SIGNATURE_KEYS);
  if (
    !value ||
    typeof value.keyId !== "string" ||
    !HEX64.test(value.keyId) ||
    value.algorithm !== "Ed25519" ||
    typeof value.signature !== "string" ||
    value.signature.length !== 86 ||
    !BASE64URL.test(value.signature)
  )
    return null;
  const bytes = Buffer.from(value.signature, "base64url");
  return bytes.length === 64 && bytes.toString("base64url") === value.signature
    ? Object.freeze({ keyId: value.keyId, signature: value.signature })
    : null;
}

function normalizeEnvelope(raw: unknown) {
  const value = snapshotPlainRecord(raw, ENVELOPE_KEYS);
  if (
    !value ||
    value.contract !== PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT ||
    value.contractRevision !== PLATFORM_PROVISIONER_MANIFEST_REVISION ||
    !Array.isArray(value.signatures) ||
    utilTypes.isProxy(value.signatures) ||
    Object.getPrototypeOf(value.signatures) !== Array.prototype
  )
    return null;
  const length = Object.getOwnPropertyDescriptor(value.signatures, "length");
  const entry = Object.getOwnPropertyDescriptor(value.signatures, "0");
  if (
    length?.value !== 1 ||
    length.enumerable ||
    length.configurable ||
    Reflect.ownKeys(value.signatures).length !== 2 ||
    !entry?.enumerable ||
    !("value" in entry) ||
    entry.get ||
    entry.set
  )
    return null;
  const payload = normalizeManifest(value.payload);
  const signature = normalizeSignature(entry.value);
  return payload && signature ? Object.freeze({ payload, signature }) : null;
}

export function compilePlatformProvisionerManifestPayloadCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, COMPILE_KEYS);
    const payload = input && normalizeManifest(input.manifestPayload);
    const framed =
      payload && frame(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, payload);
    return payload && framed
      ? Object.freeze({
          status: "candidate" as const,
          reason: "platform_provisioner_manifest_payload_compiled_candidate",
          payload,
          message: Buffer.from(framed.message),
          manifestHash: framed.hash,
          runtimeAuthorityConferred: false,
          runtimeCapabilityIssued: false,
          filesystemEffectIssued: false,
          networkEffectIssued: false,
        })
      : Object.freeze({
          status: "blocked" as const,
          reason: "platform_provisioner_manifest_payload_invalid",
          runtimeAuthorityConferred: false,
          runtimeCapabilityIssued: false,
          filesystemEffectIssued: false,
          networkEffectIssued: false,
        });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_provisioner_manifest_payload_invalid",
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  }
}

function frame(domain: string, payload: unknown) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  if (canonical.status !== "candidate") return null;
  const prefix = Buffer.from(domain, "ascii");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  const message = Buffer.concat([prefix, length, canonical.canonicalBytes]);
  return Object.freeze({
    message,
    hash: createHash("sha256").update(message).digest("hex"),
  });
}

function snapshotSignerSpki(raw: unknown) {
  if (!Buffer.isBuffer(raw)) return null;
  const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, raw, []);
  if (length > PROVISIONING_SIGNATURE_INPUT_LIMITS.spkiDerBytes) return null;
  const owned = Buffer.allocUnsafe(length);
  Uint8Array.prototype.set.call(owned, raw);
  return owned;
}

export function calculatePlatformProvisionerPackageContentRootCandidate(
  rawPackage: unknown,
) {
  try {
    const observed = normalizeObservedPackage(rawPackage);
    const framed =
      observed && frame(PLATFORM_PROVISIONER_PACKAGE_CONTENT_DOMAIN, observed);
    return framed
      ? response("candidate", "package_content_root_candidate_only", {
          packageName: observed.packageName,
          packageVersion: observed.packageVersion,
          packageContentRootSha256: framed.hash,
        })
      : response("blocked", "platform_provisioner_package_content_invalid", {});
  } catch {
    return response(
      "blocked",
      "platform_provisioner_package_content_invalid",
      {},
    );
  }
}

export function verifyPlatformProvisionerManifestCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_KEYS);
    if (!input || !utc(input.evaluationTime)) {
      return response(
        "blocked",
        "platform_provisioner_manifest_input_invalid",
        {},
      );
    }
    const ownedSigner = snapshotSignerSpki(input.releaseSignerSpkiDer);
    const envelope = normalizeEnvelope(input.manifestEnvelope);
    const observed = normalizeObservedPackage(input.observedPackageContent);
    const signer =
      envelope &&
      ownedSigner &&
      inspectProvisioningEd25519SpkiCandidate(ownedSigner);
    const manifestFrame =
      envelope && frame(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, envelope.payload);
    const contentFrame =
      observed && frame(PLATFORM_PROVISIONER_PACKAGE_CONTENT_DOMAIN, observed);
    if (
      !envelope ||
      !observed ||
      !signer ||
      signer.status !== "candidate" ||
      !manifestFrame ||
      !contentFrame ||
      envelope.signature.keyId !== signer.spkiSha256Digest.toString("hex") ||
      envelope.payload.packageName !== observed.packageName ||
      envelope.payload.packageVersion !== observed.packageVersion ||
      envelope.payload.packageContentRootSha256 !== contentFrame.hash
    ) {
      return response(
        "blocked",
        "platform_provisioner_manifest_or_package_content_mismatch",
        {},
      );
    }
    if (
      Date.parse(input.evaluationTime) <
        Date.parse(envelope.payload.issuedAt) ||
      Date.parse(input.evaluationTime) >= Date.parse(envelope.payload.expiresAt)
    ) {
      return response(
        "blocked",
        "platform_provisioner_manifest_not_current",
        {},
      );
    }
    const verified = verifyProvisioningEd25519Base64urlCandidate({
      spkiDer: ownedSigner,
      message: manifestFrame.message,
      signatureBase64url: envelope.signature.signature,
    });
    if (verified.status !== "candidate") {
      return response(
        "blocked",
        "platform_provisioner_manifest_signature_mismatch",
        {},
      );
    }
    return response(
      "candidate",
      "runtime_owned_crdd_distribution_release_trust_and_package_filesystem_required",
      {
        manifestHash: manifestFrame.hash,
        packageName: observed.packageName,
        packageVersion: observed.packageVersion,
        crddVersion: envelope.payload.crddVersion,
        releaseSequence: envelope.payload.releaseSequence,
        crddCommit: envelope.payload.crddCommit,
        crddTree: envelope.payload.crddTree,
        packageContentRootSha256: contentFrame.hash,
        rootProtectionPolicySha256: envelope.payload.rootProtectionPolicySha256,
        keyStoragePolicySha256: envelope.payload.keyStoragePolicySha256,
        platformAccessArtifact: envelope.payload.platformAccessArtifact,
        nativeProvisionSupervisorArtifact:
          envelope.payload.nativeProvisionSupervisorArtifact,
        qualLabManifestCryptographicMatch: true,
      },
    );
  } catch {
    return response(
      "blocked",
      "platform_provisioner_manifest_input_invalid",
      {},
    );
  }
}

export function describePlatformProvisionerTrustCoreContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-trust-core",
    contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
    distributionModel: "crdd_bundled_private_typescript_package",
    manifestContract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    envelopeContract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    manifestDomain: PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
    packageContentDomain: PLATFORM_PROVISIONER_PACKAGE_CONTENT_DOMAIN,
    manifestSignatureAlgorithm: "Ed25519",
    manifestSignatureCount: 1,
    maximumFiles: MAXIMUM_FILES,
    manifestCryptographicVerification: "implemented_candidate",
    releaseIdentityBinding:
      "release_sequence_crdd_version_commit_tree_package_content_root_platform_access_and_native_supervisor_artifacts_implemented_candidate",
    packageContentRootCalculation:
      "implemented_candidate_from_owned_snapshot_of_caller_file_metadata",
    runtimeOwnedPackageFilesystemRead: "not_implemented",
    standalonePackagePublicationAllowed: false,
    standalonePackageInstallationAllowed: false,
    runtimeOwnedCrddDistributionVerification:
      "not_implemented_crdd_release_identity_target",
    runtimeOwnedReleaseTrustSelection: "not_implemented",
    dedicatedNativeExecutableRequiredForV1: true,
    osNativeCodeSignatureDecision:
      "deferred_until_production_verified_image_binding",
    packagedBuildAcceptance:
      "verified_crdd_distribution_qual_lab_manifest_and_package_filesystem_all_required_before_effect_target",
    localDevelopmentBehavior:
      "source_checkout_and_test_only_without_trust_gate_or_filesystem_effect_target",
    explicitProvisionCommandRequired: true,
    unknownTamperedOrPermissionMismatchBehavior:
      "blocked_before_effect_without_fallback",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
