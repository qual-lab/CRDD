import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_HOME_MOUNT_GRANT_CONTRACT =
  "crdd-coordinator/provider-home-mount-grant";
export const PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION = 3;
export const PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS = 300_000;

const PROVIDERS = new Set(["codex", "claude"]);
const STATES = new Set(["prepared", "issued", "consumed", "revoked"]);
const GRANT_REF = /^PHMGRANT-[0-9]{6,}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const RECORD_KEYS = new Set([
  "contract",
  "contractRevision",
  "grantRef",
  "provider",
  "profileId",
  "operationId",
  "providerHomeIdentityHash",
  "providerHomeProtectionHash",
  "localUserBindingHash",
  "stableLogicalHomeBindingHash",
  "state",
  "issuedAt",
  "expiresAt",
  "consumedAt",
  "revokedAt",
  "usageLimit",
  "consumptionCount",
]);
const USE_KEYS = new Set([
  "grant",
  "provider",
  "profileId",
  "operationId",
  "providerHomeMountGrantRef",
  "observedProviderHomeIdentityHash",
  "observedProviderHomeProtectionHash",
  "observedLocalUserBindingHash",
  "observedStableLogicalHomeBindingHash",
  "observedAt",
]);
const TRANSITION_KEYS = new Set(["previous", "next"]);

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
    status: "blocked" as const,
    reason,
    grant: null,
    mountAuthorizationIssued: false,
    providerHomeMountGrantIssued: false,
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
    credentialReported: false,
  });
}

/**
 * identifierの処理を実行する。
 *
 * @responsibility identifierに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown、pattern: RegExp
 * @returns identifierの計算結果を返す。
 * @precondition 「value: unknown、pattern: RegExp」がidentifierの入力契約を満たす。
 * @postcondition identifierの責務を完了した結果だけを返す。
 * @effect N/A: identifierは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identifierは独自の失敗分岐を所有しない。
 * @invariant identifierは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identifierはProcess内の同一Subsystemで完結する。
 * @security identifierはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identifierは共有非同期状態を持たない同期処理である。
 */
function identifier(value: unknown, pattern: RegExp) {
  return typeof value === "string" && value.length <= 64 && pattern.test(value);
}

/**
 * isProviderHomeMountGrantRefの処理を実行する。
 *
 * @responsibility isProviderHomeMountGrantRefに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisProviderHomeMountGrantRefの入力契約を満たす。
 * @postcondition isProviderHomeMountGrantRefの責務を完了した結果だけを返す。
 * @effect N/A: isProviderHomeMountGrantRefは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isProviderHomeMountGrantRefは独自の失敗分岐を所有しない。
 * @invariant isProviderHomeMountGrantRefは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isProviderHomeMountGrantRefはProcess内の同一Subsystemで完結する。
 * @security isProviderHomeMountGrantRefはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isProviderHomeMountGrantRefは共有非同期状態を持たない同期処理である。
 */
export function isProviderHomeMountGrantRef(value: unknown): value is string {
  return identifier(value, GRANT_REF);
}

/**
 * canonicalUtcの処理を実行する。
 *
 * @responsibility canonicalUtcに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がcanonicalUtcの入力契約を満たす。
 * @postcondition canonicalUtcの責務を完了した結果だけを返す。
 * @effect N/A: canonicalUtcは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalUtcは独自の失敗分岐を所有しない。
 * @invariant canonicalUtcは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalUtcはProcess内の同一Subsystemで完結する。
 * @security canonicalUtcはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalUtcは共有非同期状態を持たない同期処理である。
 */
function canonicalUtc(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

/**
 * optionalCanonicalUtcの処理を実行する。
 *
 * @responsibility optionalCanonicalUtcに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns value is string | nullを返す。
 * @precondition 「value: unknown」がoptionalCanonicalUtcの入力契約を満たす。
 * @postcondition optionalCanonicalUtcの責務を完了した結果だけを返す。
 * @effect N/A: optionalCanonicalUtcは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: optionalCanonicalUtcは独自の失敗分岐を所有しない。
 * @invariant optionalCanonicalUtcは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: optionalCanonicalUtcはProcess内の同一Subsystemで完結する。
 * @security optionalCanonicalUtcはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: optionalCanonicalUtcは共有非同期状態を持たない同期処理である。
 */
function optionalCanonicalUtc(value: unknown): value is string | null {
  return value === null || canonicalUtc(value);
}

/**
 * compileInternalの処理を実行する。
 *
 * @responsibility compileInternalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input raw: unknown
 * @returns compileInternalの計算結果を返す。
 * @precondition 「raw: unknown」がcompileInternalの入力契約を満たす。
 * @postcondition compileInternalの責務を完了した結果だけを返す。
 * @effect N/A: compileInternalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: compileInternalは独自の失敗分岐を所有しない。
 * @invariant compileInternalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileInternalはProcess内の同一Subsystemで完結する。
 * @security compileInternalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileInternalは共有非同期状態を持たない同期処理である。
 */
function compileInternal(raw: unknown) {
  const value = snapshotPlainRecord(raw, RECORD_KEYS);
  if (
    !value ||
    value.contract !== PROVIDER_HOME_MOUNT_GRANT_CONTRACT ||
    value.contractRevision !== PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION ||
    !isProviderHomeMountGrantRef(value.grantRef) ||
    typeof value.provider !== "string" ||
    !PROVIDERS.has(value.provider) ||
    !identifier(value.profileId, PROFILE_ID) ||
    !identifier(value.operationId, OPERATION_ID) ||
    typeof value.providerHomeIdentityHash !== "string" ||
    !HEX64.test(value.providerHomeIdentityHash) ||
    typeof value.providerHomeProtectionHash !== "string" ||
    !HEX64.test(value.providerHomeProtectionHash) ||
    typeof value.localUserBindingHash !== "string" ||
    !HEX64.test(value.localUserBindingHash) ||
    typeof value.stableLogicalHomeBindingHash !== "string" ||
    !HEX64.test(value.stableLogicalHomeBindingHash) ||
    typeof value.state !== "string" ||
    !STATES.has(value.state) ||
    !optionalCanonicalUtc(value.issuedAt) ||
    !optionalCanonicalUtc(value.expiresAt) ||
    !optionalCanonicalUtc(value.consumedAt) ||
    !optionalCanonicalUtc(value.revokedAt) ||
    value.usageLimit !== 1 ||
    (value.consumptionCount !== 0 && value.consumptionCount !== 1)
  )
    return null;

  const issuedAt =
    value.issuedAt === null ? null : Date.parse(value.issuedAt as string);
  const expiresAt =
    value.expiresAt === null ? null : Date.parse(value.expiresAt as string);
  const consumedAt =
    value.consumedAt === null ? null : Date.parse(value.consumedAt as string);
  const revokedAt =
    value.revokedAt === null ? null : Date.parse(value.revokedAt as string);
  const isActiveTimeRangeValid =
    issuedAt !== null &&
    expiresAt !== null &&
    expiresAt > issuedAt &&
    expiresAt - issuedAt <= PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS;
  const isValid =
    (value.state === "prepared" &&
      issuedAt === null &&
      expiresAt === null &&
      consumedAt === null &&
      revokedAt === null &&
      value.consumptionCount === 0) ||
    (value.state === "issued" &&
      isActiveTimeRangeValid &&
      consumedAt === null &&
      revokedAt === null &&
      value.consumptionCount === 0) ||
    (value.state === "consumed" &&
      isActiveTimeRangeValid &&
      consumedAt !== null &&
      consumedAt >= (issuedAt as number) &&
      consumedAt < (expiresAt as number) &&
      revokedAt === null &&
      value.consumptionCount === 1) ||
    (value.state === "revoked" &&
      isActiveTimeRangeValid &&
      revokedAt !== null &&
      revokedAt >= (issuedAt as number) &&
      ((value.consumptionCount === 0 && consumedAt === null) ||
        (value.consumptionCount === 1 &&
          consumedAt !== null &&
          consumedAt >= (issuedAt as number) &&
          consumedAt < (expiresAt as number) &&
          revokedAt >= consumedAt)));
  if (!isValid) return null;
  return Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    grantRef: value.grantRef as string,
    provider: value.provider as string,
    profileId: value.profileId as string,
    operationId: value.operationId as string,
    providerHomeIdentityHash: value.providerHomeIdentityHash as string,
    providerHomeProtectionHash: value.providerHomeProtectionHash as string,
    localUserBindingHash: value.localUserBindingHash as string,
    stableLogicalHomeBindingHash: value.stableLogicalHomeBindingHash as string,
    state: value.state as string,
    issuedAt: value.issuedAt as string | null,
    expiresAt: value.expiresAt as string | null,
    consumedAt: value.consumedAt as string | null,
    revokedAt: value.revokedAt as string | null,
    usageLimit: 1 as const,
    consumptionCount: value.consumptionCount as 0 | 1,
  });
}

/**
 * compileProviderHomeMountGrantCandidateの処理を実行する。
 *
 * @responsibility compileProviderHomeMountGrantCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input raw: unknown
 * @returns compileProviderHomeMountGrantCandidateの計算結果を返す。
 * @precondition 「raw: unknown」がcompileProviderHomeMountGrantCandidateの入力契約を満たす。
 * @postcondition compileProviderHomeMountGrantCandidateの責務を完了した結果だけを返す。
 * @effect N/A: compileProviderHomeMountGrantCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure compileProviderHomeMountGrantCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant compileProviderHomeMountGrantCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileProviderHomeMountGrantCandidateはProcess内の同一Subsystemで完結する。
 * @security compileProviderHomeMountGrantCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileProviderHomeMountGrantCandidateは共有非同期状態を持たない同期処理である。
 */
export function compileProviderHomeMountGrantCandidate(raw: unknown) {
  try {
    const grant = compileInternal(raw);
    if (!grant) return blocked("provider_home_mount_grant_record_invalid");
    return Object.freeze({
      ...blocked("provider_home_mount_grant_structural_candidate_only"),
      status: "candidate" as const,
      grant,
    });
  } catch {
    return blocked("provider_home_mount_grant_record_invalid");
  }
}

/**
 * sameBindingの処理を実行する。
 *
 * @responsibility sameBindingに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input previous: NonNullable<ReturnType<typeof compileInternal>>、next: NonNullable<ReturnType<typeof compileInternal>>
 * @returns sameBindingの計算結果を返す。
 * @precondition 「previous: NonNullable<ReturnType<typeof compileInternal>>、next: NonNullable<ReturnType<typeof compileInternal>>」がsameBindingの入力契約を満たす。
 * @postcondition sameBindingの責務を完了した結果だけを返す。
 * @effect N/A: sameBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameBindingは独自の失敗分岐を所有しない。
 * @invariant sameBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameBindingはProcess内の同一Subsystemで完結する。
 * @security sameBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameBindingは共有非同期状態を持たない同期処理である。
 */
function sameBinding(
  previous: NonNullable<ReturnType<typeof compileInternal>>,
  next: NonNullable<ReturnType<typeof compileInternal>>,
) {
  return [
    "contract",
    "contractRevision",
    "grantRef",
    "provider",
    "profileId",
    "operationId",
    "providerHomeIdentityHash",
    "providerHomeProtectionHash",
    "localUserBindingHash",
    "stableLogicalHomeBindingHash",
    "usageLimit",
  ].every(
    (key) =>
      previous[key as keyof typeof previous] === next[key as keyof typeof next],
  );
}

/**
 * evaluateProviderHomeMountGrantTransitionCandidateの処理を実行する。
 *
 * @responsibility evaluateProviderHomeMountGrantTransitionCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input raw: unknown
 * @returns evaluateProviderHomeMountGrantTransitionCandidateの計算結果を返す。
 * @precondition 「raw: unknown」がevaluateProviderHomeMountGrantTransitionCandidateの入力契約を満たす。
 * @postcondition evaluateProviderHomeMountGrantTransitionCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateProviderHomeMountGrantTransitionCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateProviderHomeMountGrantTransitionCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateProviderHomeMountGrantTransitionCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateProviderHomeMountGrantTransitionCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateProviderHomeMountGrantTransitionCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateProviderHomeMountGrantTransitionCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateProviderHomeMountGrantTransitionCandidate(
  raw: unknown,
) {
  try {
    const input = snapshotPlainRecord(raw, TRANSITION_KEYS);
    if (!input)
      return blocked("provider_home_mount_grant_transition_input_invalid");
    const previous = compileInternal(input.previous);
    const next = compileInternal(input.next);
    if (!previous || !next)
      return blocked("provider_home_mount_grant_transition_record_invalid");
    if (!sameBinding(previous, next))
      return blocked("provider_home_mount_grant_transition_binding_mismatch");
    const isAllowed =
      (previous.state === "prepared" && next.state === "issued") ||
      (previous.state === "issued" &&
        (next.state === "consumed" || next.state === "revoked")) ||
      (previous.state === "consumed" && next.state === "revoked");
    if (!isAllowed)
      return blocked("provider_home_mount_grant_transition_not_allowed");
    if (
      previous.state !== "prepared" &&
      (next.issuedAt !== previous.issuedAt ||
        next.expiresAt !== previous.expiresAt ||
        (previous.state === "consumed" &&
          next.consumedAt !== previous.consumedAt))
    )
      return blocked("provider_home_mount_grant_transition_time_mismatch");
    return Object.freeze({
      ...blocked(
        "provider_home_mount_grant_transition_runtime_store_and_effect_required",
      ),
      status: "candidate" as const,
      grant: next,
    });
  } catch {
    return blocked("provider_home_mount_grant_transition_input_invalid");
  }
}

/**
 * evaluateProviderHomeMountGrantUseCandidateの処理を実行する。
 *
 * @responsibility evaluateProviderHomeMountGrantUseCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input raw: unknown
 * @returns evaluateProviderHomeMountGrantUseCandidateの計算結果を返す。
 * @precondition 「raw: unknown」がevaluateProviderHomeMountGrantUseCandidateの入力契約を満たす。
 * @postcondition evaluateProviderHomeMountGrantUseCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateProviderHomeMountGrantUseCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateProviderHomeMountGrantUseCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateProviderHomeMountGrantUseCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateProviderHomeMountGrantUseCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateProviderHomeMountGrantUseCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateProviderHomeMountGrantUseCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateProviderHomeMountGrantUseCandidate(raw: unknown) {
  try {
    const input = snapshotPlainRecord(raw, USE_KEYS);
    if (!input) return blocked("provider_home_mount_grant_use_input_invalid");
    const grant = compileInternal(input.grant);
    if (!grant) return blocked("provider_home_mount_grant_use_record_invalid");
    if (
      input.provider !== grant.provider ||
      input.profileId !== grant.profileId ||
      input.operationId !== grant.operationId ||
      !isProviderHomeMountGrantRef(input.providerHomeMountGrantRef) ||
      input.providerHomeMountGrantRef !== grant.grantRef
    )
      return blocked("provider_home_mount_grant_use_binding_mismatch");
    if (
      typeof input.observedProviderHomeIdentityHash !== "string" ||
      !HEX64.test(input.observedProviderHomeIdentityHash) ||
      typeof input.observedProviderHomeProtectionHash !== "string" ||
      !HEX64.test(input.observedProviderHomeProtectionHash) ||
      typeof input.observedLocalUserBindingHash !== "string" ||
      !HEX64.test(input.observedLocalUserBindingHash) ||
      typeof input.observedStableLogicalHomeBindingHash !== "string" ||
      !HEX64.test(input.observedStableLogicalHomeBindingHash)
    )
      return blocked("provider_home_mount_grant_use_observation_invalid");
    if (
      input.observedProviderHomeIdentityHash !==
        grant.providerHomeIdentityHash ||
      input.observedProviderHomeProtectionHash !==
        grant.providerHomeProtectionHash ||
      input.observedLocalUserBindingHash !== grant.localUserBindingHash ||
      input.observedStableLogicalHomeBindingHash !==
        grant.stableLogicalHomeBindingHash
    )
      return blocked("provider_home_mount_grant_use_observation_mismatch");
    if (!canonicalUtc(input.observedAt))
      return blocked("provider_home_mount_grant_observed_at_invalid");
    if (grant.state !== "issued")
      return blocked("provider_home_mount_grant_not_usable");
    const observedAt = Date.parse(input.observedAt);
    if (
      observedAt < Date.parse(grant.issuedAt as string) ||
      observedAt >= Date.parse(grant.expiresAt as string)
    )
      return blocked("provider_home_mount_grant_expired_or_not_yet_valid");
    return Object.freeze({
      ...blocked(
        "provider_home_mount_grant_runtime_clock_store_and_mount_adapter_required",
      ),
      status: "candidate" as const,
      grant,
    });
  } catch {
    return blocked("provider_home_mount_grant_use_input_invalid");
  }
}

/**
 * describeProviderHomeMountGrantContractの処理を実行する。
 *
 * @responsibility describeProviderHomeMountGrantContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderHomeMountGrantContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderHomeMountGrantContractの入力契約を満たす。
 * @postcondition describeProviderHomeMountGrantContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderHomeMountGrantContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderHomeMountGrantContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderHomeMountGrantContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderHomeMountGrantContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderHomeMountGrantContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderHomeMountGrantContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderHomeMountGrantContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    providers: Object.freeze([...PROVIDERS]),
    states: Object.freeze([...STATES]),
    usageLimit: 1,
    maximumLifetimeMs: PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
    providerProfileOperationBindingRequired: true,
    providerHomeIdentityAndProtectionBindingRequired: true,
    selectedLocalUserBindingRequired: true,
    useTimeInterval: "issued_at_inclusive_expires_at_exclusive",
    useCandidateSelectedGrantRefRequired: true,
    useCandidateCurrentObservationHashesRequired: true,
    useCandidateInputsAreNonAuthoritative: true,
    runtimeOwnedClockRequired: true,
    runtimeOwnedAtomicStoreRequired: true,
    runtimeOwnedIssuerRequired: true,
    oneTimeConsumptionRequired: true,
    operationEndRevocationRequired: true,
    tokenCopyOrInjectionAllowed: false,
    pathOrCredentialDisclosureAllowed: false,
    structuralCore: "implemented_candidate_non_authoritative",
    issuanceEffect: "not_implemented",
    mountAdapter: "not_implemented",
    revocationEffect: "not_implemented",
    grantIssued: false,
    mountAuthorizationIssued: false,
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
  });
}
