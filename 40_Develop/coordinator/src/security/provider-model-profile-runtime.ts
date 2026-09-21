import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-model-profile-runtime";
export const PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION = 2;

const REQUEST_KEYS = new Set([
  "provider",
  "family",
  "role",
  "modelTier",
  "speedMode",
  "billingMode",
]);
const MODEL_TIERS = new Set(["preferred", "upper_allowed"]);
const ROLES = new Set([
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
]);

/**
 * Providerが扱う値の構造を表す。
 *
 * @responsibility Providerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";

/**
 * resolveProfileの処理を実行する。
 *
 * @responsibility resolveProfileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input provider: Provider、family: "sol" | "opus"、role: | "coordinator" | "executor" | "independent_reviewer" | "result_integration"、modelTier: "preferred" | "upper_allowed"
 * @returns resolveProfileの計算結果を返す。
 * @precondition 「provider: Provider、family: "sol" | "opus"、role: | "coordinator" | "executor" | "independent_reviewer" | "result_integration"、modelTier: "preferred" | "upper_allowed"」がresolveProfileの入力契約を満たす。
 * @postcondition resolveProfileの責務を完了した結果だけを返す。
 * @effect N/A: resolveProfileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveProfileは独自の失敗分岐を所有しない。
 * @invariant resolveProfileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveProfileはProcess内の同一Subsystemで完結する。
 * @security resolveProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveProfileは共有非同期状態を持たない同期処理である。
 */
function resolveProfile(
  provider: Provider,
  family: "sol" | "opus",
  role:
    | "coordinator"
    | "executor"
    | "independent_reviewer"
    | "result_integration",
  modelTier: "preferred" | "upper_allowed",
) {
  const isUpperModelTier = modelTier === "upper_allowed";
  if (provider === "codex" && family === "sol") {
    const isIsolatedTaskRole =
      role === "executor" || role === "independent_reviewer";
    return Object.freeze({
      provider,
      profileId: isIsolatedTaskRole
        ? isUpperModelTier
          ? "PROFILE-100004"
          : "PROFILE-100003"
        : isUpperModelTier
          ? "PROFILE-100002"
          : "PROFILE-100001",
      exactModelId: isIsolatedTaskRole ? "gpt-5.5" : "gpt-5.6-sol",
      family,
      selectionRole: role,
      modelTier,
      speedMode: "normal" as const,
      billingMode: "subscription_oauth" as const,
      compatibilityReason: isIsolatedTaskRole
        ? ("gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime" as const)
        : null,
    });
  }
  if (provider === "claude" && family === "opus") {
    return Object.freeze({
      provider,
      profileId: isUpperModelTier ? "PROFILE-200002" : "PROFILE-200001",
      exactModelId: "opus",
      family,
      selectionRole: role,
      modelTier,
      speedMode: "normal" as const,
      billingMode: "subscription_oauth" as const,
      compatibilityReason: null,
    });
  }
  return null;
}

/**
 * resolveRuntimeOwnedProviderModelProfileの処理を実行する。
 *
 * @responsibility resolveRuntimeOwnedProviderModelProfileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input rawRequest: unknown
 * @returns resolveRuntimeOwnedProviderModelProfileの計算結果を返す。
 * @precondition 「rawRequest: unknown」がresolveRuntimeOwnedProviderModelProfileの入力契約を満たす。
 * @postcondition resolveRuntimeOwnedProviderModelProfileの責務を完了した結果だけを返す。
 * @effect N/A: resolveRuntimeOwnedProviderModelProfileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRuntimeOwnedProviderModelProfileは独自の失敗分岐を所有しない。
 * @invariant resolveRuntimeOwnedProviderModelProfileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRuntimeOwnedProviderModelProfileはProcess内の同一Subsystemで完結する。
 * @security resolveRuntimeOwnedProviderModelProfileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRuntimeOwnedProviderModelProfileは共有非同期状態を持たない同期処理である。
 */
export function resolveRuntimeOwnedProviderModelProfile(rawRequest: unknown) {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  if (
    !request ||
    (request.provider !== "codex" && request.provider !== "claude") ||
    (request.family !== "sol" && request.family !== "opus") ||
    typeof request.role !== "string" ||
    !ROLES.has(request.role) ||
    !MODEL_TIERS.has(request.modelTier as string) ||
    request.speedMode !== "normal" ||
    request.billingMode !== "subscription_oauth"
  ) {
    return null;
  }
  return resolveProfile(
    request.provider,
    request.family,
    request.role as
      | "coordinator"
      | "executor"
      | "independent_reviewer"
      | "result_integration",
    request.modelTier as "preferred" | "upper_allowed",
  );
}

/**
 * describeProviderModelProfileRuntimeContractの処理を実行する。
 *
 * @responsibility describeProviderModelProfileRuntimeContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderModelProfileRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderModelProfileRuntimeContractの入力契約を満たす。
 * @postcondition describeProviderModelProfileRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderModelProfileRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderModelProfileRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderModelProfileRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderModelProfileRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderModelProfileRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderModelProfileRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderModelProfileRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION,
    profileIds: Object.freeze([
      "PROFILE-100001",
      "PROFILE-100002",
      "PROFILE-100003",
      "PROFILE-100004",
      "PROFILE-200001",
      "PROFILE-200002",
    ]),
    codex: Object.freeze({
      preferredFamily: "sol",
      toolFreeExactModelId: "gpt-5.6-sol",
      isolatedTaskExactModelId: "gpt-5.5",
      compatibilityReason:
        "gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime",
      verifiedEfforts: Object.freeze(["low", "medium", "high"]),
      evidence:
        "official_cli_direct_isolated_task_verified_2026_08_30_and_upstream_issue_41255",
    }),
    claude: Object.freeze({
      family: "opus",
      exactModelId: "opus",
      verifiedEfforts: Object.freeze(["low", "medium", "high"]),
      evidence: "fixed_claude_code_2_1_220_offline_help_verified_2026_08_25",
    }),
    modelTiers: Object.freeze(["preferred", "upper_allowed"]),
    upperTierChangesFamily: false,
    upperTierChangesExactModel: false,
    speedMode: "normal_only",
    billingMode: "subscription_oauth_only",
    automaticFallback: false,
    compatibilityProfileIsFixed: true,
    compatibilityProfileReevaluationTrigger:
      "fixed_codex_release_proves_gpt_5_6_code_mode_host_execution",
    fableActivated: false,
    xhighOrMaxActivated: false,
    availabilityAuthority: "provider_eligibility_runtime_separate",
    providerEffectAllowed: false,
  });
}
