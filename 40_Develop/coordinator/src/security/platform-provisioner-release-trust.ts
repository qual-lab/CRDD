import { createHash, createPublicKey } from "node:crypto";

const PINNED_RELEASE_PUBLIC_KEY_SPKI_BASE64 =
  "MCowBQYDK2VwAyEAMMabNz1eVssNVLZf9pApYI0XwQ7hrcGCfxxt7I+5ywE=";
const PINNED_RELEASE_PUBLIC_KEY_SPKI_SHA256 =
  "6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f";

function pinnedReleasePublicKeySnapshot() {
  const bytes = Buffer.from(PINNED_RELEASE_PUBLIC_KEY_SPKI_BASE64, "base64");
  const publicKey = createPublicKey({
    key: bytes,
    format: "der",
    type: "spki",
  });
  const canonical = publicKey.export({ format: "der", type: "spki" });
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (
    publicKey.asymmetricKeyType !== "ed25519" ||
    bytes.length !== 44 ||
    !bytes.equals(canonical) ||
    digest !== PINNED_RELEASE_PUBLIC_KEY_SPKI_SHA256
  ) {
    throw new Error("platform_provisioner_release_trust_anchor_invalid");
  }
  return bytes;
}

export function getPinnedPlatformProvisionerReleaseSignerSpkiDer() {
  return Buffer.from(pinnedReleasePublicKeySnapshot());
}

export function describePlatformProvisionerReleaseTrustContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-release-trust",
    contractRevision: 1,
    owner: "Qual-Lab",
    algorithm: "Ed25519",
    activeKeyCount: 1,
    publicKeyEncoding: "RFC-8410-exact-SPKI-DER",
    publicKeySpkiSha256: PINNED_RELEASE_PUBLIC_KEY_SPKI_SHA256,
    trustAnchorSource: "crdd_owned_immutable_source_literal",
    unknownKeyFallbackAllowed: false,
    callerKeyMayReplaceTrustAnchor: false,
    privateKeyStoredInRepository: false,
    rotationRequiresHumanApprovedCrddChange: true,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
