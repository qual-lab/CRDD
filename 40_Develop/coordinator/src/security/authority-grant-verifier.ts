import { createHash } from "node:crypto";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { isProviderHomeMountGrantRef } from "./provider-home-mount-grant.ts";
import {
  PROVIDER_INPUT_LIMITS,
  validateProviderIsolationProfile,
} from "./provider-isolation-profile.ts";

export const AUTHORITY_REGISTRY_CONTRACT =
  "crdd-coordinator/authority-registry";
export const AUTHORITY_REGISTRY_CONTRACT_REVISION = 3;

const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const GRANT_REF = /^AUTH-[0-9]{6,}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get as () => number;
export const AUTHORITY_REGISTRY_INPUT_LIMITS = Object.freeze({
  grantCount: 64,
  rawBytes: 131_072,
  canonicalBytes: 131_072,
});
const TOP_LEVEL_KEYS = new Set([
  "contract",
  "contractRevision",
  "registryId",
  "registryRevision",
  "observedAt",
  "grants",
]);
const GRANT_KEYS = new Set([
  "grantRef",
  "grantRevision",
  "status",
  "validFrom",
  "expiresAt",
  "provider",
  "profileId",
  "origins",
  "providerHomeMountGrant",
  "operationId",
  "scopeId",
  "profileHash",
]);

/**
 * AuthorityGrantが扱う値の構造を表す。
 *
 * @responsibility AuthorityGrantに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape AuthorityGrantが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AuthorityGrantで宣言した値と責務の対応を維持する。
 * @boundary N/A: AuthorityGrantの宣言は外部境界を開かない。
 * @security AuthorityGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility AuthorityGrantの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AuthorityGrant = {
  grantRef: string;
  grantRevision: number;
  status: string;
  validFrom: string;
  expiresAt: string;
  provider: string;
  profileId: string;
  origins: readonly string[];
  providerHomeMountGrant: Readonly<{
    provider: string;
    profileId: string;
    operationId: string;
    issuer: "runtime_owned";
    requiredState: "active";
    verification: "runtime_capability_required";
  }>;
  operationId: string;
  scopeId: string;
  profileHash: string;
};

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
    status: "blocked" as const,
    reason,
    registry: null,
    registryHash: null,
    verification: null,
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
    throw new Error("authority_registry_json_invalid");
  return serialized;
}

/**
 * normalizedUtcの処理を実行する。
 *
 * @responsibility normalizedUtcに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns normalizedUtcの計算結果を返す。
 * @precondition 「value: unknown」がnormalizedUtcの入力契約を満たす。
 * @postcondition normalizedUtcの責務を完了した結果だけを返す。
 * @effect N/A: normalizedUtcは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedUtcは独自の失敗分岐を所有しない。
 * @invariant normalizedUtcは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedUtcはProcess内の同一Subsystemで完結する。
 * @security normalizedUtcはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizedUtcは共有非同期状態を持たない同期処理である。
 */
function normalizedUtc(value: unknown) {
  if (typeof value !== "string" || !CANONICAL_UTC.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const normalized = new Date(milliseconds).toISOString();
  return value === normalized ? normalized : null;
}

/**
 * normalizeNowの処理を実行する。
 *
 * @responsibility normalizeNowに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns normalizeNowの計算結果を返す。
 * @precondition 「value: unknown」がnormalizeNowの入力契約を満たす。
 * @postcondition normalizeNowの責務を完了した結果だけを返す。
 * @effect N/A: normalizeNowは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeNowは独自の失敗分岐を所有しない。
 * @invariant normalizeNowは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeNowはProcess内の同一Subsystemで完結する。
 * @security normalizeNowはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeNowは共有非同期状態を持たない同期処理である。
 */
function normalizeNow(value: unknown) {
  if (value instanceof Date) {
    const milliseconds = Date.prototype.getTime.call(value);
    return Number.isFinite(milliseconds)
      ? new Date(milliseconds).toISOString()
      : null;
  }
  return normalizedUtc(value);
}

/**
 * normalizeOriginsの処理を実行する。
 *
 * @responsibility normalizeOriginsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input origins: unknown
 * @returns normalizeOriginsの計算結果を返す。
 * @precondition 「origins: unknown」がnormalizeOriginsの入力契約を満たす。
 * @postcondition normalizeOriginsの責務を完了した結果だけを返す。
 * @effect N/A: normalizeOriginsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeOriginsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeOriginsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeOriginsはProcess内の同一Subsystemで完結する。
 * @security normalizeOriginsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeOriginsは共有非同期状態を持たない同期処理である。
 */
function normalizeOrigins(origins: unknown) {
  const result = snapshotPlainArray<string>(
    origins,
    PROVIDER_INPUT_LIMITS.originCount,
  );
  if (
    result.status !== "ok" ||
    result.value.length === 0 ||
    result.value.some(
      (origin) =>
        typeof origin !== "string" ||
        origin.length > PROVIDER_INPUT_LIMITS.originLength,
    )
  )
    return null;
  const normalizedOrigins: string[] = [];
  for (const origin of result.value) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      return null;
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      (parsed.port && parsed.port !== "443")
    )
      return null;
    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) ||
      hostname.includes(":")
    ) {
      return null;
    }
    normalizedOrigins.push(`https://${hostname}`);
  }
  const uniqueOrigins = [...new Set(normalizedOrigins)].sort();
  return uniqueOrigins.length === normalizedOrigins.length
    ? uniqueOrigins
    : null;
}

/**
 * normalizeGrantの処理を実行する。
 *
 * @responsibility normalizeGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input grant: unknown
 * @returns Readonly<AuthorityGrant> | nullを返す。
 * @precondition 「grant: unknown」がnormalizeGrantの入力契約を満たす。
 * @postcondition normalizeGrantの責務を完了した結果だけを返す。
 * @effect N/A: normalizeGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeGrantは独自の失敗分岐を所有しない。
 * @invariant normalizeGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeGrantはProcess内の同一Subsystemで完結する。
 * @security normalizeGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeGrantは共有非同期状態を持たない同期処理である。
 */
function normalizeGrant(grant: unknown): Readonly<AuthorityGrant> | null {
  const snapshot = snapshotPlainRecord(grant, GRANT_KEYS);
  if (!snapshot) return null;
  const providerHomeMountGrant = snapshotPlainRecord(
    snapshot.providerHomeMountGrant,
    new Set([
      "provider",
      "profileId",
      "operationId",
      "issuer",
      "requiredState",
      "verification",
    ]),
  );
  if (!providerHomeMountGrant) return null;
  const origins = normalizeOrigins(snapshot.origins);
  if (!origins) return null;
  if (
    typeof snapshot.grantRef !== "string" ||
    snapshot.grantRef.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !GRANT_REF.test(snapshot.grantRef) ||
    typeof snapshot.grantRevision !== "number" ||
    !Number.isSafeInteger(snapshot.grantRevision) ||
    snapshot.grantRevision < 1 ||
    typeof snapshot.status !== "string" ||
    !["active", "revoked", "replaced"].includes(snapshot.status) ||
    typeof snapshot.provider !== "string" ||
    !["codex", "claude"].includes(snapshot.provider) ||
    typeof snapshot.profileId !== "string" ||
    snapshot.profileId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !PROFILE_ID.test(snapshot.profileId) ||
    typeof snapshot.operationId !== "string" ||
    snapshot.operationId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(snapshot.operationId) ||
    typeof snapshot.scopeId !== "string" ||
    snapshot.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !SCOPE_ID.test(snapshot.scopeId) ||
    typeof snapshot.profileHash !== "string" ||
    !HASH.test(snapshot.profileHash)
  )
    return null;
  const validFrom = normalizedUtc(snapshot.validFrom);
  const expiresAt = normalizedUtc(snapshot.expiresAt);
  if (!validFrom || !expiresAt || validFrom >= expiresAt) return null;
  if (
    providerHomeMountGrant.provider !== snapshot.provider ||
    providerHomeMountGrant.profileId !== snapshot.profileId ||
    providerHomeMountGrant.operationId !== snapshot.operationId ||
    providerHomeMountGrant.issuer !== "runtime_owned" ||
    providerHomeMountGrant.requiredState !== "active" ||
    providerHomeMountGrant.verification !== "runtime_capability_required"
  )
    return null;
  return Object.freeze({
    grantRef: snapshot.grantRef,
    grantRevision: snapshot.grantRevision,
    status: snapshot.status,
    validFrom,
    expiresAt,
    provider: snapshot.provider,
    profileId: snapshot.profileId,
    origins: Object.freeze(origins),
    providerHomeMountGrant: Object.freeze({
      provider: providerHomeMountGrant.provider,
      profileId: providerHomeMountGrant.profileId,
      operationId: providerHomeMountGrant.operationId,
      issuer: "runtime_owned",
      requiredState: "active",
      verification: "runtime_capability_required",
    }),
    operationId: snapshot.operationId,
    scopeId: snapshot.scopeId,
    profileHash: snapshot.profileHash,
  });
}

/**
 * validateAuthorityRegistryCandidateInternalの処理を実行する。
 *
 * @responsibility validateAuthorityRegistryCandidateInternalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input candidate: unknown
 * @returns validateAuthorityRegistryCandidateInternalの計算結果を返す。
 * @precondition 「candidate: unknown」がvalidateAuthorityRegistryCandidateInternalの入力契約を満たす。
 * @postcondition validateAuthorityRegistryCandidateInternalの責務を完了した結果だけを返す。
 * @effect N/A: validateAuthorityRegistryCandidateInternalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateAuthorityRegistryCandidateInternalは独自の失敗分岐を所有しない。
 * @invariant validateAuthorityRegistryCandidateInternalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateAuthorityRegistryCandidateInternalはProcess内の同一Subsystemで完結する。
 * @security validateAuthorityRegistryCandidateInternalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateAuthorityRegistryCandidateInternalは共有非同期状態を持たない同期処理である。
 */
function validateAuthorityRegistryCandidateInternal(candidate: unknown) {
  const top = snapshotPlainRecord(candidate, TOP_LEVEL_KEYS);
  if (!top) return blocked("authority_registry_shape_invalid");
  const grantsResult = snapshotPlainArray<unknown>(
    top.grants,
    AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount,
  );
  if (grantsResult.status !== "ok") {
    return blocked(
      grantsResult.reason === "array_length_exceeded"
        ? "authority_registry_grant_count_exceeded"
        : "authority_registry_shape_invalid",
    );
  }
  if (
    top.contract !== AUTHORITY_REGISTRY_CONTRACT ||
    top.contractRevision !== AUTHORITY_REGISTRY_CONTRACT_REVISION
  )
    return blocked("authority_registry_contract_mismatch");
  if (
    typeof top.registryId !== "string" ||
    top.registryId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !REGISTRY_ID.test(top.registryId)
  ) {
    return blocked("authority_registry_id_invalid");
  }
  if (
    typeof top.registryRevision !== "number" ||
    !Number.isSafeInteger(top.registryRevision) ||
    top.registryRevision < 1
  ) {
    return blocked("authority_registry_revision_invalid");
  }
  const observedAt = normalizedUtc(top.observedAt);
  if (!observedAt) return blocked("authority_registry_observed_at_invalid");
  if (grantsResult.value.length === 0) {
    return blocked("authority_registry_grants_required");
  }
  const grants = grantsResult.value.map(normalizeGrant);
  if (grants.some((grant) => grant == null))
    return blocked("authority_registry_grant_invalid");
  const normalizedGrants = grants.filter(
    (grant): grant is Readonly<AuthorityGrant> => grant !== null,
  );
  const identities = normalizedGrants.map((grant) => grant.grantRef);
  if (new Set(identities).size !== identities.length)
    return blocked("authority_registry_grant_duplicate");
  const registry = Object.freeze({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: AUTHORITY_REGISTRY_CONTRACT_REVISION,
    registryId: top.registryId,
    registryRevision: top.registryRevision,
    observedAt,
    grants: Object.freeze(
      [...normalizedGrants].sort(
        (left, right) =>
          left.grantRef.localeCompare(right.grantRef) ||
          left.grantRevision - right.grantRevision,
      ),
    ),
  });
  const canonical = canonicalJson(registry);
  if (
    Buffer.byteLength(canonical, "utf8") >
    AUTHORITY_REGISTRY_INPUT_LIMITS.canonicalBytes
  ) {
    return blocked("authority_registry_canonical_bytes_exceeded");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "authority_registry_trust_anchor_required",
    registry,
    registryHash: createHash("sha256").update(canonical).digest("hex"),
    verification: null,
  });
}

/**
 * validateAuthorityRegistryCandidateの処理を実行する。
 *
 * @responsibility validateAuthorityRegistryCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input candidate: unknown
 * @returns validateAuthorityRegistryCandidateの計算結果を返す。
 * @precondition 「candidate: unknown」がvalidateAuthorityRegistryCandidateの入力契約を満たす。
 * @postcondition validateAuthorityRegistryCandidateの責務を完了した結果だけを返す。
 * @effect N/A: validateAuthorityRegistryCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateAuthorityRegistryCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateAuthorityRegistryCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateAuthorityRegistryCandidateはProcess内の同一Subsystemで完結する。
 * @security validateAuthorityRegistryCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateAuthorityRegistryCandidateは共有非同期状態を持たない同期処理である。
 */
export function validateAuthorityRegistryCandidate(candidate: unknown) {
  try {
    return validateAuthorityRegistryCandidateInternal(candidate);
  } catch {
    return blocked("authority_registry_input_invalid");
  }
}

/**
 * decodeCanonicalAuthorityRegistryBytesの処理を実行する。
 *
 * @responsibility decodeCanonicalAuthorityRegistryBytesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input input: unknown
 * @returns decodeCanonicalAuthorityRegistryBytesの計算結果を返す。
 * @precondition 「input: unknown」がdecodeCanonicalAuthorityRegistryBytesの入力契約を満たす。
 * @postcondition decodeCanonicalAuthorityRegistryBytesの責務を完了した結果だけを返す。
 * @effect N/A: decodeCanonicalAuthorityRegistryBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodeCanonicalAuthorityRegistryBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodeCanonicalAuthorityRegistryBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeCanonicalAuthorityRegistryBytesはProcess内の同一Subsystemで完結する。
 * @security decodeCanonicalAuthorityRegistryBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: decodeCanonicalAuthorityRegistryBytesは共有非同期状態を持たない同期処理である。
 */
export function decodeCanonicalAuthorityRegistryBytes(input: unknown) {
  try {
    if (!Buffer.isBuffer(input))
      return blocked("authority_registry_bytes_required");
    const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
    if (inputLength > AUTHORITY_REGISTRY_INPUT_LIMITS.rawBytes) {
      return blocked("authority_registry_raw_bytes_exceeded");
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (source.charCodeAt(0) === 0xfeff)
      return blocked("authority_registry_bytes_invalid");
    const parsed = JSON.parse(source);
    const result = validateAuthorityRegistryCandidate(parsed);
    if (result.status !== "candidate")
      return blocked("authority_registry_bytes_invalid");
    const canonical = canonicalJson(result.registry);
    if (!Buffer.prototype.equals.call(bytes, Buffer.from(canonical, "utf8"))) {
      return blocked("authority_registry_bytes_noncanonical");
    }
    return result;
  } catch {
    return blocked("authority_registry_bytes_invalid");
  }
}

/**
 * evaluateAuthorityGrantCandidateInternalの処理を実行する。
 *
 * @responsibility evaluateAuthorityGrantCandidateInternalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawProfile: unknown、rawRegistry: unknown、context: unknown
 * @returns evaluateAuthorityGrantCandidateInternalの計算結果を返す。
 * @precondition 「rawProfile: unknown、rawRegistry: unknown、context: unknown」がevaluateAuthorityGrantCandidateInternalの入力契約を満たす。
 * @postcondition evaluateAuthorityGrantCandidateInternalの責務を完了した結果だけを返す。
 * @effect N/A: evaluateAuthorityGrantCandidateInternalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateAuthorityGrantCandidateInternalは独自の失敗分岐を所有しない。
 * @invariant evaluateAuthorityGrantCandidateInternalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateAuthorityGrantCandidateInternalはProcess内の同一Subsystemで完結する。
 * @security evaluateAuthorityGrantCandidateInternalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateAuthorityGrantCandidateInternalは共有非同期状態を持たない同期処理である。
 */
function evaluateAuthorityGrantCandidateInternal(
  rawProfile: unknown,
  rawRegistry: unknown,
  context: unknown = {},
) {
  const profileResult = validateProviderIsolationProfile(rawProfile);
  if (profileResult.status !== "candidate")
    return blocked("authority_profile_invalid");
  const registryResult = validateAuthorityRegistryCandidate(rawRegistry);
  if (registryResult.status !== "candidate")
    return blocked("authority_registry_invalid");
  const contextSnapshot = snapshotPlainRecord(
    context,
    new Set([
      "provider",
      "profileId",
      "operationId",
      "scopeId",
      "providerHomeMountGrantRef",
      "now",
    ]),
  );
  if (
    !contextSnapshot ||
    typeof contextSnapshot.provider !== "string" ||
    !["codex", "claude"].includes(contextSnapshot.provider) ||
    typeof contextSnapshot.profileId !== "string" ||
    contextSnapshot.profileId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !PROFILE_ID.test(contextSnapshot.profileId) ||
    typeof contextSnapshot.operationId !== "string" ||
    contextSnapshot.operationId.length >
      PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(contextSnapshot.operationId) ||
    typeof contextSnapshot.scopeId !== "string" ||
    contextSnapshot.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !SCOPE_ID.test(contextSnapshot.scopeId) ||
    !isProviderHomeMountGrantRef(contextSnapshot.providerHomeMountGrantRef)
  )
    return blocked("authority_context_invalid");
  const now = normalizeNow(contextSnapshot.now);
  if (!now) return blocked("authority_now_invalid");
  if (registryResult.registry.observedAt > now)
    return blocked("authority_registry_observation_in_future");
  if (
    profileResult.profile.authority.registryId !==
    registryResult.registry.registryId
  ) {
    return blocked("authority_registry_mismatch");
  }
  const matchingGrants = registryResult.registry.grants.filter(
    (grant) => grant.grantRef === profileResult.profile.authority.grantRef,
  );
  if (matchingGrants.length !== 1) return blocked("authority_grant_not_unique");
  const grant = matchingGrants[0];
  if (!grant) return blocked("authority_grant_not_unique");
  if (grant.status !== "active") return blocked("authority_grant_inactive");
  if (!(grant.validFrom <= now && now < grant.expiresAt))
    return blocked("authority_grant_outside_validity");
  if (grant.provider !== profileResult.profile.provider)
    return blocked("authority_provider_mismatch");
  if (
    contextSnapshot.provider !== profileResult.profile.provider ||
    contextSnapshot.profileId !== profileResult.profile.profileId ||
    contextSnapshot.operationId !== profileResult.profile.operationId ||
    grant.profileId !== profileResult.profile.profileId ||
    grant.operationId !== profileResult.profile.operationId
  )
    return blocked("authority_provider_profile_operation_mismatch");
  if (
    canonicalJson(grant.origins) !==
    canonicalJson(profileResult.profile.egress.origins)
  ) {
    return blocked("authority_origins_mismatch");
  }
  if (
    canonicalJson(grant.providerHomeMountGrant) !==
    canonicalJson(profileResult.profile.providerHomeMountGrant)
  ) {
    return blocked("authority_provider_home_mount_grant_mismatch");
  }
  if (!isProviderHomeMountGrantRef(contextSnapshot.providerHomeMountGrantRef)) {
    return blocked("authority_provider_home_mount_grant_context_invalid");
  }
  if (
    grant.operationId !== contextSnapshot.operationId ||
    grant.scopeId !== contextSnapshot.scopeId
  ) {
    return blocked("authority_operation_scope_mismatch");
  }
  if (grant.profileHash !== profileResult.profileHash)
    return blocked("authority_profile_hash_mismatch");

  const verification = Object.freeze({
    profileHash: profileResult.profileHash,
    registryId: registryResult.registry.registryId,
    registryRevision: registryResult.registry.registryRevision,
    registryHash: registryResult.registryHash,
    grantRef: grant.grantRef,
    grantRevision: grant.grantRevision,
    provider: contextSnapshot.provider,
    profileId: contextSnapshot.profileId,
    operationId: contextSnapshot.operationId,
    scopeId: contextSnapshot.scopeId,
    providerHomeMountGrantRef: contextSnapshot.providerHomeMountGrantRef,
    providerHomeMountGrantIssued: false,
    providerHomeMountGrantVerification: "runtime_capability_required",
    evaluatedAt: now,
    validUntil: grant.expiresAt,
  });
  return Object.freeze({
    status: /** @type {"candidate"} */ ("candidate"),
    reason:
      "runtime_trust_policy_activation_and_prelaunch_reverification_required",
    registry: registryResult.registry,
    registryHash: registryResult.registryHash,
    verification,
  });
}

/**
 * evaluateAuthorityGrantCandidateの処理を実行する。
 *
 * @responsibility evaluateAuthorityGrantCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawProfile: unknown、rawRegistry: unknown、context: unknown
 * @returns evaluateAuthorityGrantCandidateの計算結果を返す。
 * @precondition 「rawProfile: unknown、rawRegistry: unknown、context: unknown」がevaluateAuthorityGrantCandidateの入力契約を満たす。
 * @postcondition evaluateAuthorityGrantCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateAuthorityGrantCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateAuthorityGrantCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateAuthorityGrantCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateAuthorityGrantCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateAuthorityGrantCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateAuthorityGrantCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateAuthorityGrantCandidate(
  rawProfile: unknown,
  rawRegistry: unknown,
  context: unknown = {},
) {
  try {
    return evaluateAuthorityGrantCandidateInternal(
      rawProfile,
      rawRegistry,
      context,
    );
  } catch {
    return blocked("authority_input_invalid");
  }
}

/**
 * describeAuthorityGrantVerifierContractの処理を実行する。
 *
 * @responsibility describeAuthorityGrantVerifierContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeAuthorityGrantVerifierContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeAuthorityGrantVerifierContractの入力契約を満たす。
 * @postcondition describeAuthorityGrantVerifierContractの責務を完了した結果だけを返す。
 * @effect N/A: describeAuthorityGrantVerifierContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeAuthorityGrantVerifierContractは独自の失敗分岐を所有しない。
 * @invariant describeAuthorityGrantVerifierContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeAuthorityGrantVerifierContractはProcess内の同一Subsystemで完結する。
 * @security describeAuthorityGrantVerifierContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeAuthorityGrantVerifierContractは共有非同期状態を持たない同期処理である。
 */
export function describeAuthorityGrantVerifierContract() {
  return Object.freeze({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: AUTHORITY_REGISTRY_CONTRACT_REVISION,
    coreValidation: "implemented_candidate",
    canonicalRegistryByteLoader: "implemented_candidate",
    runtimeTrustPolicyActivation: "not_implemented",
    prelaunchReverificationCore: "implemented_candidate",
    providerLaunchIntegration: "not_implemented",
    runtimeCapabilityIssued: false,
    selfAssertedRegistryAcceptedAsAuthority: false,
  });
}
