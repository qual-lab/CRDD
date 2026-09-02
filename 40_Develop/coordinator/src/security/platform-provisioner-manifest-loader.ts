import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalizeProvisioningJsonValueCandidate } from "./provisioning-signature-primitives.ts";

export const PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH =
  "template/tools/coordinator/coordinator-package-manifest.json";
export const HISTORICAL_V2_PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH =
  "90_Release/coordinator-package-manifest.json";

export const PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES = 128 * 1024;

function stableManifestBytes(target: string) {
  const before = fs.lstatSync(target, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.size <= 0n ||
    before.size > BigInt(PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES)
  ) {
    throw new Error("platform_provisioner_manifest_file_invalid");
  }
  const real = fs.realpathSync.native(target);
  if (real !== target) {
    throw new Error("platform_provisioner_manifest_file_invalid");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs ||
      opened.size !== before.size
    ) {
      throw new Error("platform_provisioner_manifest_file_changed");
    }
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(target, { bigint: true });
    if (
      offset !== bytes.length ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs ||
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs ||
      pathAfter.dev !== opened.dev ||
      pathAfter.ino !== opened.ino ||
      pathAfter.birthtimeNs !== opened.birthtimeNs ||
      pathAfter.size !== opened.size ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("platform_provisioner_manifest_file_changed");
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function manifestPath(distributionRoot: string, relativePath: string) {
  if (
    typeof distributionRoot !== "string" ||
    distributionRoot.length === 0 ||
    !path.isAbsolute(distributionRoot) ||
    distributionRoot.includes("\0")
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  const resolved = path.resolve(distributionRoot);
  const metadata = fs.lstatSync(resolved);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(resolved) !== resolved
  ) {
    throw new Error("platform_provisioner_distribution_root_invalid");
  }
  return path.join(resolved, ...relativePath.split("/"));
}

function loadManifestAtRelativePath(
  distributionRoot: string,
  relativePath: string,
) {
  const bytes = stableManifestBytes(
    manifestPath(distributionRoot, relativePath),
  );
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    throw new Error("platform_provisioner_manifest_encoding_invalid");
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed: unknown = JSON.parse(text);
  const canonical = canonicalizeProvisioningJsonValueCandidate(parsed);
  if (
    canonical.status !== "candidate" ||
    !Buffer.prototype.equals.call(bytes, canonical.canonicalBytes)
  ) {
    throw new Error("platform_provisioner_manifest_encoding_invalid");
  }
  return Object.freeze({
    envelope: parsed,
    manifestFileSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

export function loadPlatformProvisionerManifestEnvelopeForVerification(
  distributionRoot: string,
) {
  return loadManifestAtRelativePath(
    distributionRoot,
    PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
  );
}

export function loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerification(
  distributionRoot: string,
) {
  return loadManifestAtRelativePath(
    distributionRoot,
    HISTORICAL_V2_PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
  );
}

export function inspectPlatformProvisionerManifestFileCandidate(
  distributionRoot: unknown,
) {
  try {
    if (typeof distributionRoot !== "string") {
      throw new Error("platform_provisioner_distribution_root_invalid");
    }
    const loaded =
      loadPlatformProvisionerManifestEnvelopeForVerification(distributionRoot);
    return Object.freeze({
      status: "candidate" as const,
      reason:
        "canonical_manifest_file_observed_signature_and_release_identity_verification_required",
      manifestFileSha256: loaded.manifestFileSha256,
      canonicalManifestEncodingConfirmed: true,
      runtimeOwnedReleaseTrustConfirmed: false,
      crddDistributionConfirmed: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "platform_provisioner_manifest_file_invalid",
      manifestFileSha256: null,
      canonicalManifestEncodingConfirmed: false,
      runtimeOwnedReleaseTrustConfirmed: false,
      crddDistributionConfirmed: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
    });
  }
}

export function describePlatformProvisionerManifestLoaderContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-manifest-loader",
    contractRevision: 1,
    manifestRelativePath: PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
    maximumManifestBytes: PLATFORM_PROVISIONER_MANIFEST_MAXIMUM_BYTES,
    canonicalEncoding: "RFC-8785-exact-UTF-8-without-BOM",
    stableSameFileIdentityRead: "implemented_candidate",
    symbolicLinkOrReparseFallbackAllowed: false,
    manifestPlacement:
      "release_commit_adds_only_manifest_to_signed_parent_git_tree",
    manifestSignatureVerification: "owned_by_platform_provisioner_trust_core",
    releaseIdentityVerification:
      "implemented_by_fixed_distribution_git_tree_verifier_candidate",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
