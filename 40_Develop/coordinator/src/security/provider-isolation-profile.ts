import { createHash } from "node:crypto";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const PROVIDER_ISOLATION_CONTRACT =
  "crdd-coordinator/provider-isolation-profile";
export const PROVIDER_ISOLATION_CONTRACT_REVISION = 3;

const SUPPORTED_PROVIDERS = new Set(["codex", "claude"]);
export const PROVIDER_INPUT_LIMITS = Object.freeze({
  identifierLength: 64,
  originCount: 16,
  originLength: 256,
});
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const AUTHORITY_REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const AUTHORITY_GRANT_REF = /^AUTH-[0-9]{6,}$/u;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const TOP_LEVEL_KEYS = new Set([
  "contract",
  "contractRevision",
  "profileId",
  "provider",
  "operationId",
  "authMethod",
  "authority",
  "providerHomeMountGrant",
  "egress",
]);

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
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
    profile: null,
    profileHash: null,
  });
}

/**
 * matchesの処理を実行する。
 *
 * @responsibility matchesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown、pattern: RegExp
 * @returns value is stringを返す。
 * @precondition 「value: unknown、pattern: RegExp」がmatchesの入力契約を満たす。
 * @postcondition matchesの責務を完了した結果だけを返す。
 * @effect N/A: matchesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: matchesは独自の失敗分岐を所有しない。
 * @invariant matchesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: matchesはProcess内の同一Subsystemで完結する。
 * @security matchesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: matchesは共有非同期状態を持たない同期処理である。
 */
function matches(value: unknown, pattern: RegExp): value is string {
  return (
    typeof value === "string" &&
    value.length <= PROVIDER_INPUT_LIMITS.identifierLength &&
    pattern.test(value)
  );
}

/**
 * normalizeOriginの処理を実行する。
 *
 * @responsibility normalizeOriginに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns normalizeOriginの計算結果を返す。
 * @precondition 「value: unknown」がnormalizeOriginの入力契約を満たす。
 * @postcondition normalizeOriginの責務を完了した結果だけを返す。
 * @effect N/A: normalizeOriginは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeOriginは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeOriginは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeOriginはProcess内の同一Subsystemで完結する。
 * @security normalizeOriginはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeOriginは共有非同期状態を持たない同期処理である。
 */
function normalizeOrigin(value: unknown) {
  if (typeof value !== "string" || value.includes("*")) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
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
  )
    return null;
  return `https://${hostname}`;
}

/**
 * canonicalJsonの処理を実行する。
 *
 * @responsibility canonicalJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
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
    throw new Error("provider_profile_json_invalid");
  return serialized;
}

/**
 * validateProviderIsolationProfileInternalの処理を実行する。
 *
 * @responsibility validateProviderIsolationProfileInternalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input candidate: unknown
 * @returns validateProviderIsolationProfileInternalの計算結果を返す。
 * @precondition 「candidate: unknown」がvalidateProviderIsolationProfileInternalの入力契約を満たす。
 * @postcondition validateProviderIsolationProfileInternalの責務を完了した結果だけを返す。
 * @effect N/A: validateProviderIsolationProfileInternalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateProviderIsolationProfileInternalは独自の失敗分岐を所有しない。
 * @invariant validateProviderIsolationProfileInternalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateProviderIsolationProfileInternalはProcess内の同一Subsystemで完結する。
 * @security validateProviderIsolationProfileInternalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateProviderIsolationProfileInternalは共有非同期状態を持たない同期処理である。
 */
function validateProviderIsolationProfileInternal(candidate: unknown) {
  const top = snapshotPlainRecord(candidate, TOP_LEVEL_KEYS);
  if (!top) return blocked("profile_shape_invalid");
  const authorityKeys = new Set(["registryId", "grantRef"]);
  const authority = snapshotPlainRecord(top.authority, authorityKeys);
  if (!authority) return blocked("authority_shape_invalid");
  const mountGrantKeys = new Set([
    "provider",
    "profileId",
    "operationId",
    "issuer",
    "requiredState",
    "verification",
  ]);
  const providerHomeMountGrant = snapshotPlainRecord(
    top.providerHomeMountGrant,
    mountGrantKeys,
  );
  if (!providerHomeMountGrant)
    return blocked("provider_home_mount_grant_shape_invalid");
  const egressKeys = new Set(["origins"]);
  const egress = snapshotPlainRecord(top.egress, egressKeys);
  if (!egress) return blocked("egress_shape_invalid");
  const originsResult = snapshotPlainArray<string>(
    egress.origins,
    PROVIDER_INPUT_LIMITS.originCount,
  );
  if (originsResult.status !== "ok") {
    return blocked(
      originsResult.reason === "array_length_exceeded"
        ? "egress_origin_count_exceeded"
        : "egress_shape_invalid",
    );
  }
  const rawOrigins = originsResult.value;
  if (
    top.contract !== PROVIDER_ISOLATION_CONTRACT ||
    top.contractRevision !== PROVIDER_ISOLATION_CONTRACT_REVISION
  )
    return blocked("profile_contract_mismatch");
  if (!matches(top.profileId, PROFILE_ID)) return blocked("profile_id_invalid");
  if (
    typeof top.provider !== "string" ||
    !SUPPORTED_PROVIDERS.has(top.provider)
  ) {
    return blocked("provider_not_supported");
  }
  if (!matches(top.operationId, OPERATION_ID))
    return blocked("profile_operation_id_invalid");
  if (top.authMethod !== "subscription_oauth")
    return blocked("profile_auth_method_not_supported");

  if (
    !matches(authority.registryId, AUTHORITY_REGISTRY_ID) ||
    !matches(authority.grantRef, AUTHORITY_GRANT_REF)
  )
    return blocked("authority_reference_invalid");

  if (
    providerHomeMountGrant.provider !== top.provider ||
    providerHomeMountGrant.profileId !== top.profileId ||
    providerHomeMountGrant.operationId !== top.operationId ||
    providerHomeMountGrant.issuer !== "runtime_owned" ||
    providerHomeMountGrant.requiredState !== "active" ||
    providerHomeMountGrant.verification !== "runtime_capability_required"
  )
    return blocked("provider_home_mount_grant_reference_invalid");

  if (rawOrigins.length === 0) {
    return blocked("egress_origins_required");
  }
  if (
    rawOrigins.some(
      (origin) =>
        typeof origin !== "string" ||
        origin.length > PROVIDER_INPUT_LIMITS.originLength,
    )
  ) {
    return blocked("egress_origin_length_exceeded");
  }
  const origins = rawOrigins.map(normalizeOrigin);
  if (origins.some((origin) => origin == null))
    return blocked("egress_origin_invalid");
  const normalizedOrigins = origins.filter(
    (origin): origin is string => origin !== null,
  );
  const uniqueOrigins = [...new Set(normalizedOrigins)].sort();
  if (uniqueOrigins.length !== origins.length)
    return blocked("egress_origin_duplicate");

  const profile = Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: PROVIDER_ISOLATION_CONTRACT_REVISION,
    profileId: top.profileId,
    provider: top.provider,
    operationId: top.operationId,
    authMethod: "subscription_oauth",
    authority: Object.freeze({
      registryId: authority.registryId,
      grantRef: authority.grantRef,
    }),
    providerHomeMountGrant: Object.freeze({
      provider: providerHomeMountGrant.provider,
      profileId: providerHomeMountGrant.profileId,
      operationId: providerHomeMountGrant.operationId,
      issuer: "runtime_owned",
      requiredState: "active",
      verification: "runtime_capability_required",
    }),
    egress: Object.freeze({ origins: Object.freeze(uniqueOrigins) }),
    requiredCapabilities: Object.freeze([
      "authority_grant_verification",
      "docker_isolation",
      "provider_home_mount_grant_verification",
      "provider_endpoint_proxy",
      "provider_endpoint_egress_enforcement",
    ]),
  });
  const profileHash = createHash("sha256")
    .update(canonicalJson(profile))
    .digest("hex");
  return Object.freeze({
    status: "candidate",
    reason: "authority_verification_required",
    profile,
    profileHash,
  });
}

/**
 * validateProviderIsolationProfileの処理を実行する。
 *
 * @responsibility validateProviderIsolationProfileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input candidate: unknown
 * @returns validateProviderIsolationProfileの計算結果を返す。
 * @precondition 「candidate: unknown」がvalidateProviderIsolationProfileの入力契約を満たす。
 * @postcondition validateProviderIsolationProfileの責務を完了した結果だけを返す。
 * @effect N/A: validateProviderIsolationProfileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateProviderIsolationProfileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateProviderIsolationProfileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateProviderIsolationProfileはProcess内の同一Subsystemで完結する。
 * @security validateProviderIsolationProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateProviderIsolationProfileは共有非同期状態を持たない同期処理である。
 */
export function validateProviderIsolationProfile(candidate: unknown) {
  try {
    return validateProviderIsolationProfileInternal(candidate);
  } catch {
    return blocked("profile_input_invalid");
  }
}

/**
 * describeProviderIsolationContractの処理を実行する。
 *
 * @responsibility describeProviderIsolationContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderIsolationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderIsolationContractの入力契約を満たす。
 * @postcondition describeProviderIsolationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderIsolationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderIsolationContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderIsolationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderIsolationContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderIsolationContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderIsolationContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderIsolationContract() {
  return Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: PROVIDER_ISOLATION_CONTRACT_REVISION,
    crddVersionSpecific: false,
    validationState: "candidate",
    authorityVerification: "runtime_capability_required",
    supportedProviders: Object.freeze([...SUPPORTED_PROVIDERS]),
    supportedWriteBackend: "docker",
    localFallbackAllowed: false,
    rawCredentialAllowed: false,
    authMethod: "subscription_oauth",
    subscriptionOauthProviderHomeMountGrant: Object.freeze({
      contractOwner: "provider_lifecycle",
      implementationState: "runtime_owned_lifecycle_connected",
      tokenCopyOrInjectionAllowed: false,
      dynamicGrantRefInSignedProfile: false,
      requiredIssuer: "runtime_owned",
      requiredState: "active",
      verification: "runtime_capability_required",
    }),
    wildcardEgressAllowed: false,
  });
}
