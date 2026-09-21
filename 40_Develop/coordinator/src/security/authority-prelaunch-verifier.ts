import { loadAuthorityFileBundleCandidate } from "./authority-file-bundle.ts";
import { evaluateAuthorityGrantCandidate } from "./authority-grant-verifier.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { isProviderHomeMountGrantRef } from "./provider-home-mount-grant.ts";
import { PROVIDER_INPUT_LIMITS } from "./provider-isolation-profile.ts";

const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;
const CONTEXT_KEYS = new Set([
  "provider",
  "profileId",
  "operationId",
  "scopeId",
  "providerHomeMountGrantRef",
]);
const INTRINSIC_DATE = Date;
const INTRINSIC_DATE_NOW = Date.now;
const INTRINSIC_DATE_TO_ISO = Date.prototype.toISOString;

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
    verification: null,
    runtimeCapabilityIssued: false,
  });
}

/**
 * runtimeNowの処理を実行する。
 *
 * @responsibility runtimeNowに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns runtimeNowの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がruntimeNowの入力契約を満たす。
 * @postcondition runtimeNowの責務を完了した結果だけを返す。
 * @effect N/A: runtimeNowは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runtimeNowは独自の失敗分岐を所有しない。
 * @invariant runtimeNowは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runtimeNowはProcess内の同一Subsystemで完結する。
 * @security runtimeNowはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runtimeNowは共有非同期状態を持たない同期処理である。
 */
function runtimeNow() {
  const milliseconds = Reflect.apply(INTRINSIC_DATE_NOW, INTRINSIC_DATE, []);
  if (!Number.isFinite(milliseconds)) return null;
  const value = new INTRINSIC_DATE(milliseconds);
  return Reflect.apply(INTRINSIC_DATE_TO_ISO, value, []);
}

/**
 * normalizeContextの処理を実行する。
 *
 * @responsibility normalizeContextに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawContext: unknown
 * @returns normalizeContextの計算結果を返す。
 * @precondition 「rawContext: unknown」がnormalizeContextの入力契約を満たす。
 * @postcondition normalizeContextの責務を完了した結果だけを返す。
 * @effect N/A: normalizeContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeContextは独自の失敗分岐を所有しない。
 * @invariant normalizeContextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeContextはProcess内の同一Subsystemで完結する。
 * @security normalizeContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeContextは共有非同期状態を持たない同期処理である。
 */
function normalizeContext(rawContext: unknown) {
  const context = snapshotPlainRecord(rawContext, CONTEXT_KEYS);
  if (
    !context ||
    typeof context.provider !== "string" ||
    !["codex", "claude"].includes(context.provider) ||
    typeof context.profileId !== "string" ||
    context.profileId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !PROFILE_ID.test(context.profileId) ||
    typeof context.operationId !== "string" ||
    context.operationId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(context.operationId) ||
    typeof context.scopeId !== "string" ||
    context.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !SCOPE_ID.test(context.scopeId) ||
    !isProviderHomeMountGrantRef(context.providerHomeMountGrantRef)
  )
    return null;
  return Object.freeze({
    provider: context.provider,
    profileId: context.profileId,
    operationId: context.operationId,
    scopeId: context.scopeId,
    providerHomeMountGrantRef: context.providerHomeMountGrantRef,
  });
}

/**
 * reverifyAuthorityBeforeProviderLaunchの処理を実行する。
 *
 * @responsibility reverifyAuthorityBeforeProviderLaunchに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawProfile: unknown、rawBundle: unknown、rawContext: unknown
 * @returns reverifyAuthorityBeforeProviderLaunchの計算結果を返す。
 * @precondition 「rawProfile: unknown、rawBundle: unknown、rawContext: unknown」がreverifyAuthorityBeforeProviderLaunchの入力契約を満たす。
 * @postcondition reverifyAuthorityBeforeProviderLaunchの責務を完了した結果だけを返す。
 * @effect N/A: reverifyAuthorityBeforeProviderLaunchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure reverifyAuthorityBeforeProviderLaunchは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reverifyAuthorityBeforeProviderLaunchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reverifyAuthorityBeforeProviderLaunchはProcess内の同一Subsystemで完結する。
 * @security reverifyAuthorityBeforeProviderLaunchはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reverifyAuthorityBeforeProviderLaunchは共有非同期状態を持たない同期処理である。
 */
export function reverifyAuthorityBeforeProviderLaunch(
  rawProfile: unknown,
  rawBundle: unknown,
  rawContext: unknown,
) {
  try {
    const context = normalizeContext(rawContext);
    if (!context) return blocked("prelaunch_authority_context_invalid");

    const bundle = loadAuthorityFileBundleCandidate(rawBundle);
    if (bundle.status !== "candidate")
      return blocked("prelaunch_authority_file_bundle_invalid");

    const evaluatedAt = runtimeNow();
    if (!evaluatedAt) return blocked("prelaunch_runtime_clock_invalid");
    const authority = evaluateAuthorityGrantCandidate(
      rawProfile,
      bundle.registry,
      {
        provider: context.provider,
        profileId: context.profileId,
        operationId: context.operationId,
        scopeId: context.scopeId,
        providerHomeMountGrantRef: context.providerHomeMountGrantRef,
        now: evaluatedAt,
      },
    );
    if (authority.status !== "candidate") return blocked(authority.reason);
    if (authority.registryHash !== bundle.registryHash) {
      return blocked("prelaunch_authority_registry_identity_mismatch");
    }

    return Object.freeze({
      status: "candidate",
      reason: "runtime_file_bundle_path_acl_and_activation_required",
      verification: Object.freeze({
        ...authority.verification,
        bundleId: bundle.manifest.bundleId,
        bundleRevision: bundle.manifest.bundleRevision,
        bundleHash: bundle.bundleHash,
        trustPolicyId: bundle.trustPolicy.policyId,
        trustPolicyRevision: bundle.trustPolicy.policyRevision,
        trustPolicyHash: bundle.trustPolicyHash,
        prelaunchCheckedAt: evaluatedAt,
      }),
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("prelaunch_authority_input_invalid");
  }
}

/**
 * describeAuthorityPrelaunchVerifierContractの処理を実行する。
 *
 * @responsibility describeAuthorityPrelaunchVerifierContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeAuthorityPrelaunchVerifierContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeAuthorityPrelaunchVerifierContractの入力契約を満たす。
 * @postcondition describeAuthorityPrelaunchVerifierContractの責務を完了した結果だけを返す。
 * @effect N/A: describeAuthorityPrelaunchVerifierContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeAuthorityPrelaunchVerifierContractは独自の失敗分岐を所有しない。
 * @invariant describeAuthorityPrelaunchVerifierContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeAuthorityPrelaunchVerifierContractはProcess内の同一Subsystemで完結する。
 * @security describeAuthorityPrelaunchVerifierContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeAuthorityPrelaunchVerifierContractは共有非同期状態を持たない同期処理である。
 */
export function describeAuthorityPrelaunchVerifierContract() {
  return Object.freeze({
    runtimeClockRead: "implemented_candidate",
    prelaunchReverificationCore: "implemented_candidate",
    providerLaunchIntegration: "not_implemented",
    runtimeTrustPolicyActivation: "not_implemented",
    authorityFileBundleCore: "implemented_candidate",
    runtimeCapabilityIssued: false,
    callerSuppliedTimeAccepted: false,
    candidateReusableAsCapability: false,
  });
}
