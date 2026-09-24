/**
 * authority-trust-loaderに属する責務をまとめる。
 *
 * @responsibility blockedを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { createHash } from "node:crypto";

import { decodeCanonicalAuthorityRegistryBytes } from "./authority-grant-verifier.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { PROVIDER_INPUT_LIMITS } from "./provider-isolation-profile.ts";

export const AUTHORITY_TRUST_POLICY_CONTRACT =
  "crdd-coordinator/authority-trust-policy";
export const AUTHORITY_TRUST_POLICY_CONTRACT_REVISION = 1;
export const AUTHORITY_TRUST_POLICY_INPUT_LIMITS = Object.freeze({
  rawBytes: 4_096,
});

const POLICY_ID = /^AUTHPOL-[0-9]{6,}$/u;
const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const POLICY_KEYS = new Set([
  "contract",
  "contractRevision",
  "policyId",
  "policyRevision",
  "status",
  "registryId",
  "registryRevision",
  "registryHash",
]);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;

/**
 * authority-trust-loaderを停止結果として構築する。
 *
 * @responsibility authority-trust-loaderの停止理由、未発行Effect、公開結果境界を所有する。
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
    registry: null,
    registryHash: null,
    trustPolicy: null,
    trustPolicyHash: null,
    runtimeCapabilityIssued: false,
  });
}

/**
 * canonical Jsonを決定する。
 *
 * @responsibility canonical Jsonの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
    throw new Error("authority_trust_policy_json_invalid");
  return serialized;
}

/**
 * Canonical Authority Trust Policy Bytesを検証済み値へ復号する。
 *
 * @responsibility Canonical Authority Trust Policy Bytesの入力形式、復号結果、不正byte列の拒否境界を所有する。
 * @trace ARCH-000014
 * @input input: unknown
 * @returns decodeCanonicalAuthorityTrustPolicyBytesの計算結果を返す。
 * @precondition 「input: unknown」がdecodeCanonicalAuthorityTrustPolicyBytesの入力契約を満たす。
 * @postcondition decodeCanonicalAuthorityTrustPolicyBytesの責務を完了した結果だけを返す。
 * @effect N/A: decodeCanonicalAuthorityTrustPolicyBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodeCanonicalAuthorityTrustPolicyBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodeCanonicalAuthorityTrustPolicyBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeCanonicalAuthorityTrustPolicyBytesはProcess内の同一Subsystemで完結する。
 * @security decodeCanonicalAuthorityTrustPolicyBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: decodeCanonicalAuthorityTrustPolicyBytesは共有非同期状態を持たない同期処理である。
 */
export function decodeCanonicalAuthorityTrustPolicyBytes(input: unknown) {
  try {
    if (!Buffer.isBuffer(input))
      return blocked("authority_trust_policy_bytes_required");
    const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
    if (inputLength > AUTHORITY_TRUST_POLICY_INPUT_LIMITS.rawBytes) {
      return blocked("authority_trust_policy_raw_bytes_exceeded");
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (source.charCodeAt(0) === 0xfeff)
      return blocked("authority_trust_policy_bytes_invalid");
    const parsed = JSON.parse(source);
    const trustPolicy = validateTrustPolicyCandidate(parsed);
    if (!trustPolicy) return blocked("authority_trust_policy_bytes_invalid");
    const canonical = canonicalJson(trustPolicy);
    if (!Buffer.prototype.equals.call(bytes, Buffer.from(canonical, "utf8"))) {
      return blocked("authority_trust_policy_bytes_noncanonical");
    }
    return Object.freeze({
      status: "candidate",
      reason: "runtime_owned_trust_policy_activation_required",
      registry: null,
      registryHash: trustPolicy.registryHash,
      trustPolicy,
      trustPolicyHash: createHash("sha256").update(canonical).digest("hex"),
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("authority_trust_policy_bytes_invalid");
  }
}

/**
 * Trust Policy 候補の契約を検証する。
 *
 * @responsibility Trust Policy 候補の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000014
 * @input candidate: unknown
 * @returns validateTrustPolicyCandidateの計算結果を返す。
 * @precondition 「candidate: unknown」がvalidateTrustPolicyCandidateの入力契約を満たす。
 * @postcondition validateTrustPolicyCandidateの責務を完了した結果だけを返す。
 * @effect N/A: validateTrustPolicyCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateTrustPolicyCandidateは独自の失敗分岐を所有しない。
 * @invariant validateTrustPolicyCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateTrustPolicyCandidateはProcess内の同一Subsystemで完結する。
 * @security validateTrustPolicyCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateTrustPolicyCandidateは共有非同期状態を持たない同期処理である。
 */
function validateTrustPolicyCandidate(candidate: unknown) {
  const snapshot = snapshotPlainRecord(candidate, POLICY_KEYS);
  if (!snapshot) return null;
  if (
    snapshot.contract !== AUTHORITY_TRUST_POLICY_CONTRACT ||
    snapshot.contractRevision !== AUTHORITY_TRUST_POLICY_CONTRACT_REVISION ||
    typeof snapshot.policyId !== "string" ||
    snapshot.policyId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !POLICY_ID.test(snapshot.policyId) ||
    typeof snapshot.policyRevision !== "number" ||
    !Number.isSafeInteger(snapshot.policyRevision) ||
    snapshot.policyRevision < 1 ||
    typeof snapshot.status !== "string" ||
    !["active", "revoked", "replaced"].includes(snapshot.status) ||
    typeof snapshot.registryId !== "string" ||
    snapshot.registryId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !REGISTRY_ID.test(snapshot.registryId) ||
    typeof snapshot.registryRevision !== "number" ||
    !Number.isSafeInteger(snapshot.registryRevision) ||
    snapshot.registryRevision < 1 ||
    typeof snapshot.registryHash !== "string" ||
    !HASH.test(snapshot.registryHash)
  )
    return null;
  return Object.freeze({
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: AUTHORITY_TRUST_POLICY_CONTRACT_REVISION,
    policyId: snapshot.policyId,
    policyRevision: snapshot.policyRevision,
    status: snapshot.status,
    registryId: snapshot.registryId,
    registryRevision: snapshot.registryRevision,
    registryHash: snapshot.registryHash,
  });
}

/**
 * Authority Registry Trust 候補を読み込む。
 *
 * @responsibility Authority Registry Trust 候補の読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input registryBytes: unknown、rawTrustPolicy: unknown
 * @returns loadAuthorityRegistryTrustCandidateの計算結果を返す。
 * @precondition 「registryBytes: unknown、rawTrustPolicy: unknown」がloadAuthorityRegistryTrustCandidateの入力契約を満たす。
 * @postcondition loadAuthorityRegistryTrustCandidateの責務を完了した結果だけを返す。
 * @effect N/A: loadAuthorityRegistryTrustCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure loadAuthorityRegistryTrustCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant loadAuthorityRegistryTrustCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadAuthorityRegistryTrustCandidateはProcess内の同一Subsystemで完結する。
 * @security loadAuthorityRegistryTrustCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadAuthorityRegistryTrustCandidateは共有非同期状態を持たない同期処理である。
 */
export function loadAuthorityRegistryTrustCandidate(
  registryBytes: unknown,
  rawTrustPolicy: unknown,
) {
  try {
    const registryResult = decodeCanonicalAuthorityRegistryBytes(registryBytes);
    if (registryResult.status !== "candidate")
      return blocked(registryResult.reason);
    const trustPolicy = validateTrustPolicyCandidate(rawTrustPolicy);
    if (!trustPolicy) return blocked("authority_trust_policy_invalid");
    if (trustPolicy.status !== "active")
      return blocked("authority_trust_policy_inactive");
    if (
      trustPolicy.registryId !== registryResult.registry.registryId ||
      trustPolicy.registryRevision !==
        registryResult.registry.registryRevision ||
      trustPolicy.registryHash !== registryResult.registryHash
    )
      return blocked("authority_trust_policy_registry_mismatch");

    return Object.freeze({
      status: "candidate",
      reason: "runtime_owned_trust_policy_activation_required",
      registry: registryResult.registry,
      registryHash: registryResult.registryHash,
      trustPolicy,
      trustPolicyHash: createHash("sha256")
        .update(canonicalJson(trustPolicy))
        .digest("hex"),
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("authority_trust_loader_input_invalid");
  }
}

/**
 * Authority Trust Loader 契約の公開契約を記述する。
 *
 * @responsibility Authority Trust Loader 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeAuthorityTrustLoaderContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeAuthorityTrustLoaderContractの入力契約を満たす。
 * @postcondition describeAuthorityTrustLoaderContractの責務を完了した結果だけを返す。
 * @effect N/A: describeAuthorityTrustLoaderContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeAuthorityTrustLoaderContractは独自の失敗分岐を所有しない。
 * @invariant describeAuthorityTrustLoaderContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeAuthorityTrustLoaderContractはProcess内の同一Subsystemで完結する。
 * @security describeAuthorityTrustLoaderContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeAuthorityTrustLoaderContractは共有非同期状態を持たない同期処理である。
 */
export function describeAuthorityTrustLoaderContract() {
  return Object.freeze({
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: AUTHORITY_TRUST_POLICY_CONTRACT_REVISION,
    canonicalRegistryByteLoader: "implemented_candidate",
    canonicalTrustPolicyByteLoader: "implemented_candidate",
    runtimeTrustPolicyOwnership: "not_implemented",
    runtimeTrustPolicyActivation: "not_implemented",
    prelaunchReverificationCore: "implemented_candidate",
    providerLaunchIntegration: "not_implemented",
    runtimeCapabilityIssued: false,
    callerSuppliedPolicyAcceptedAsAuthority: false,
  });
}
