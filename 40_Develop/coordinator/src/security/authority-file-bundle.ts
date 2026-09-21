import { createHash } from "node:crypto";

import {
  decodeCanonicalAuthorityTrustPolicyBytes,
  loadAuthorityRegistryTrustCandidate,
} from "./authority-trust-loader.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { PROVIDER_INPUT_LIMITS } from "./provider-isolation-profile.ts";
import { ROOT_PROTECTION_POLICY_CONTRACT } from "./root-protection-policy.ts";

export const AUTHORITY_FILE_BUNDLE_CONTRACT =
  "crdd-coordinator/authority-file-bundle";
export const AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION = 1;
export const AUTHORITY_FILE_BUNDLE_INPUT_LIMITS = Object.freeze({
  manifestBytes: 4_096,
});
export const AUTHORITY_FILE_BUNDLE_FILES = Object.freeze({
  manifest: "bundle.json",
  trustPolicy: "trust-policy.json",
  registry: "authority-registry.json",
});

const BUNDLE_ID = /^AUTHBUNDLE-[0-9]{6,}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const MANIFEST_KEYS = new Set([
  "contract",
  "contractRevision",
  "bundleId",
  "bundleRevision",
  "status",
  "previousBundleHash",
  "trustPolicyHash",
  "registryHash",
]);
const BUNDLE_INPUT_KEYS = new Set([
  "manifestBytes",
  "trustPolicyBytes",
  "registryBytes",
]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    manifest: null,
    bundleHash: null,
    registry: null,
    registryHash: null,
    trustPolicy: null,
    trustPolicyHash: null,
    runtimeCapabilityIssued: false,
  });
}

/**
 * canonicalJsonの処理を実行する。
 *
 * @responsibility canonicalJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns stringを返す。
 * @precondition 「value: unknown」がcanonicalJsonの入力契約を満たす。
 * @postcondition canonicalJsonの責務を完了した結果だけを返す。
 * @effect N/A: canonicalJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure canonicalJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant canonicalJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalJsonはProcess内の同一Subsystemで完結する。
 * @security canonicalJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalJsonは共有非同期状態を持たない同期処理である。
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("authority_file_bundle_json_invalid");
  return serialized;
}

/**
 * decodeManifestの処理を実行する。
 *
 * @responsibility decodeManifestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input input: unknown
 * @returns decodeManifestの計算結果を返す。
 * @precondition 「input: unknown」がdecodeManifestの入力契約を満たす。
 * @postcondition decodeManifestの責務を完了した結果だけを返す。
 * @effect N/A: decodeManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: decodeManifestは独自の失敗分岐を所有しない。
 * @invariant decodeManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeManifestはProcess内の同一Subsystemで完結する。
 * @security decodeManifestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: decodeManifestは共有非同期状態を持たない同期処理である。
 */
function decodeManifest(input: unknown) {
  if (!Buffer.isBuffer(input)) return null;
  const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
  if (inputLength > AUTHORITY_FILE_BUNDLE_INPUT_LIMITS.manifestBytes)
    return null;
  const bytes = Buffer.allocUnsafe(inputLength);
  Uint8Array.prototype.set.call(bytes, input);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (source.charCodeAt(0) === 0xfeff) return null;
  const parsed = JSON.parse(source);
  const snapshot = snapshotPlainRecord(parsed, MANIFEST_KEYS);
  if (!snapshot) return null;
  if (
    snapshot.contract !== AUTHORITY_FILE_BUNDLE_CONTRACT ||
    snapshot.contractRevision !== AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION ||
    typeof snapshot.bundleId !== "string" ||
    snapshot.bundleId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !BUNDLE_ID.test(snapshot.bundleId) ||
    typeof snapshot.bundleRevision !== "number" ||
    !Number.isSafeInteger(snapshot.bundleRevision) ||
    snapshot.bundleRevision < 1 ||
    typeof snapshot.status !== "string" ||
    !["active", "revoked", "replaced"].includes(snapshot.status) ||
    typeof snapshot.trustPolicyHash !== "string" ||
    !HASH.test(snapshot.trustPolicyHash) ||
    typeof snapshot.registryHash !== "string" ||
    !HASH.test(snapshot.registryHash) ||
    (snapshot.bundleRevision === 1
      ? snapshot.previousBundleHash !== null
      : typeof snapshot.previousBundleHash !== "string" ||
        !HASH.test(snapshot.previousBundleHash))
  )
    return null;
  const manifest = Object.freeze({
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION,
    bundleId: snapshot.bundleId,
    bundleRevision: snapshot.bundleRevision,
    status: snapshot.status,
    previousBundleHash: snapshot.previousBundleHash,
    trustPolicyHash: snapshot.trustPolicyHash,
    registryHash: snapshot.registryHash,
  });
  const canonical = canonicalJson(manifest);
  if (!Buffer.prototype.equals.call(bytes, Buffer.from(canonical, "utf8")))
    return null;
  return Object.freeze({
    manifest,
    bundleHash: createHash("sha256").update(canonical).digest("hex"),
  });
}

/**
 * loadAuthorityFileBundleCandidateの処理を実行する。
 *
 * @responsibility loadAuthorityFileBundleCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns loadAuthorityFileBundleCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がloadAuthorityFileBundleCandidateの入力契約を満たす。
 * @postcondition loadAuthorityFileBundleCandidateの責務を完了した結果だけを返す。
 * @effect N/A: loadAuthorityFileBundleCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure loadAuthorityFileBundleCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadAuthorityFileBundleCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadAuthorityFileBundleCandidateはProcess内の同一Subsystemで完結する。
 * @security loadAuthorityFileBundleCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadAuthorityFileBundleCandidateは共有非同期状態を持たない同期処理である。
 */
export function loadAuthorityFileBundleCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, BUNDLE_INPUT_KEYS);
    if (!input) return blocked("authority_file_bundle_input_invalid");
    const decodedManifest = decodeManifest(input.manifestBytes);
    if (!decodedManifest)
      return blocked("authority_file_bundle_manifest_invalid");
    if (decodedManifest.manifest.status !== "active") {
      return blocked("authority_file_bundle_inactive");
    }
    const decodedPolicy = decodeCanonicalAuthorityTrustPolicyBytes(
      input.trustPolicyBytes,
    );
    if (decodedPolicy.status !== "candidate") {
      return blocked("authority_file_bundle_trust_policy_invalid");
    }
    if (decodedPolicy.trustPolicy.status !== "active") {
      return blocked("authority_file_bundle_trust_policy_inactive");
    }
    const trust = loadAuthorityRegistryTrustCandidate(
      input.registryBytes,
      decodedPolicy.trustPolicy,
    );
    if (trust.status !== "candidate")
      return blocked("authority_file_bundle_registry_invalid");
    if (
      decodedManifest.manifest.trustPolicyHash !==
        decodedPolicy.trustPolicyHash ||
      decodedManifest.manifest.registryHash !== trust.registryHash
    )
      return blocked("authority_file_bundle_hash_mismatch");

    return Object.freeze({
      status: "candidate",
      reason: "runtime_file_bundle_path_acl_and_activation_required",
      manifest: decodedManifest.manifest,
      bundleHash: decodedManifest.bundleHash,
      registry: trust.registry,
      registryHash: trust.registryHash,
      trustPolicy: trust.trustPolicy,
      trustPolicyHash: trust.trustPolicyHash,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("authority_file_bundle_input_invalid");
  }
}

/**
 * describeAuthorityFileBundleContractの処理を実行する。
 *
 * @responsibility describeAuthorityFileBundleContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeAuthorityFileBundleContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeAuthorityFileBundleContractの入力契約を満たす。
 * @postcondition describeAuthorityFileBundleContractの責務を完了した結果だけを返す。
 * @effect N/A: describeAuthorityFileBundleContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeAuthorityFileBundleContractは独自の失敗分岐を所有しない。
 * @invariant describeAuthorityFileBundleContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeAuthorityFileBundleContractはProcess内の同一Subsystemで完結する。
 * @security describeAuthorityFileBundleContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeAuthorityFileBundleContractは共有非同期状態を持たない同期処理である。
 */
export function describeAuthorityFileBundleContract() {
  return Object.freeze({
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: AUTHORITY_FILE_BUNDLE_CONTRACT_REVISION,
    fixedFiles: AUTHORITY_FILE_BUNDLE_FILES,
    canonicalBundleCore: "implemented_candidate",
    runtimeManagedPath: "not_implemented",
    rootProtectionPolicyContract: ROOT_PROTECTION_POLICY_CONTRACT,
    rootProtectionPolicyCore: "implemented_candidate_claim_only",
    ownerAclVerification: "not_implemented",
    atomicReplacement: "not_implemented",
    monotonicActivation: "not_implemented",
    runtimeCapabilityIssued: false,
    ipcOrNetworkTransportSupported: false,
  });
}
