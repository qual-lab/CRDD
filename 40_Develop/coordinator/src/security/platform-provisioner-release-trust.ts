import { createHash, createPublicKey } from "node:crypto";

const PINNED_RELEASE_PUBLIC_KEY_SPKI_BASE64 =
  "MCowBQYDK2VwAyEAMMabNz1eVssNVLZf9pApYI0XwQ7hrcGCfxxt7I+5ywE=";
const PINNED_RELEASE_PUBLIC_KEY_SPKI_SHA256 =
  "6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f";

/**
 * pinnedReleasePublicKeySnapshotの処理を実行する。
 *
 * @responsibility pinnedReleasePublicKeySnapshotに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns pinnedReleasePublicKeySnapshotの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がpinnedReleasePublicKeySnapshotの入力契約を満たす。
 * @postcondition pinnedReleasePublicKeySnapshotの責務を完了した結果だけを返す。
 * @effect N/A: pinnedReleasePublicKeySnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure pinnedReleasePublicKeySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pinnedReleasePublicKeySnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pinnedReleasePublicKeySnapshotはProcess内の同一Subsystemで完結する。
 * @security pinnedReleasePublicKeySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pinnedReleasePublicKeySnapshotは共有非同期状態を持たない同期処理である。
 */
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

/**
 * getPinnedPlatformProvisionerReleaseSignerSpkiDerの処理を実行する。
 *
 * @responsibility getPinnedPlatformProvisionerReleaseSignerSpkiDerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns getPinnedPlatformProvisionerReleaseSignerSpkiDerの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がgetPinnedPlatformProvisionerReleaseSignerSpkiDerの入力契約を満たす。
 * @postcondition getPinnedPlatformProvisionerReleaseSignerSpkiDerの責務を完了した結果だけを返す。
 * @effect N/A: getPinnedPlatformProvisionerReleaseSignerSpkiDerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getPinnedPlatformProvisionerReleaseSignerSpkiDerは独自の失敗分岐を所有しない。
 * @invariant getPinnedPlatformProvisionerReleaseSignerSpkiDerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getPinnedPlatformProvisionerReleaseSignerSpkiDerはProcess内の同一Subsystemで完結する。
 * @security getPinnedPlatformProvisionerReleaseSignerSpkiDerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: getPinnedPlatformProvisionerReleaseSignerSpkiDerは共有非同期状態を持たない同期処理である。
 */
export function getPinnedPlatformProvisionerReleaseSignerSpkiDer() {
  return Buffer.from(pinnedReleasePublicKeySnapshot());
}

/**
 * describePlatformProvisionerReleaseTrustContractの処理を実行する。
 *
 * @responsibility describePlatformProvisionerReleaseTrustContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformProvisionerReleaseTrustContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformProvisionerReleaseTrustContractの入力契約を満たす。
 * @postcondition describePlatformProvisionerReleaseTrustContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformProvisionerReleaseTrustContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformProvisionerReleaseTrustContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformProvisionerReleaseTrustContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describePlatformProvisionerReleaseTrustContractはProcess内の同一Subsystemで完結する。
 * @security describePlatformProvisionerReleaseTrustContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformProvisionerReleaseTrustContractは共有非同期状態を持たない同期処理である。
 */
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
