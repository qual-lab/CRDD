/**
 * 隔離Profileの入力と実行・回復の局所値契約を検査する。
 * @responsibility 移管元と同じ状態値・相関を扱い、保存・実行Effectを発行しない。
 * @trace ARCH-000004、ARCH-000008、ARCH-000010
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  type ExecutionOperationRecord,
  parseDockerTaskRecoveryId,
} from "../../../execution-model/src/index.ts";
import { snapshotPlainArray, snapshotPlainRecord } from "../input/snapshot.ts";
import type { Recovery, RecoveryStartFailureDiagnostic } from "./types.ts";

export const PROVIDER_ISOLATION_CONTRACT =
  "crdd-coordinator/provider-isolation-profile";

export const PROVIDER_ISOLATION_CONTRACT_REVISION = 4;

const SUPPORTED_PROVIDERS = new Set(["codex", "claude"]);

export const PROVIDER_INPUT_LIMITS = Object.freeze({
  identifierLength: 64,
  originCount: 16,
  originLength: 256,
});

const AUTHORITY_REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;

const AUTHORITY_GRANT_REF = /^AUTH-[0-9]{6,}$/u;

const isolationProfileOPERATION_ID = /^OP-[0-9]{6,}$/u;

const TOP_LEVEL_KEYS = new Set([
  "contract",
  "contractRevision",
  "provider",
  "operationId",
  "authMethod",
  "authority",
  "providerHomeMountGrant",
  "egress",
]);

/**
 * provider-isolation-profileを停止結果として構築する。
 *
 * @responsibility provider-isolation-profileの停止理由、未発行Effect、公開結果境界を所有する。
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
 * matchesを決定する。
 *
 * @responsibility matchesの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Originを固定Schemaへ正規化する。
 *
 * @responsibility Originの入力検証、正規化規則、不正値の拒否境界を所有する。
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
 * canonical Jsonを決定する。
 *
 * @responsibility canonical Jsonの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Provider Isolation Profile Internalの契約を検証する。
 *
 * @responsibility Provider Isolation Profile Internalの必須Property、拒否条件、検証結果の境界を所有する。
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
  if (
    typeof top.provider !== "string" ||
    !SUPPORTED_PROVIDERS.has(top.provider)
  ) {
    return blocked("provider_not_supported");
  }
  if (!matches(top.operationId, isolationProfileOPERATION_ID))
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
    provider: top.provider,
    operationId: top.operationId,
    authMethod: "subscription_oauth",
    authority: Object.freeze({
      registryId: authority.registryId,
      grantRef: authority.grantRef,
    }),
    providerHomeMountGrant: Object.freeze({
      provider: providerHomeMountGrant.provider,
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
 * Provider Isolation Profileの契約を検証する。
 *
 * @responsibility Provider Isolation Profileの必須Property、拒否条件、検証結果の境界を所有する。
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
 * Provider Isolation 契約の公開契約を記述する。
 *
 * @responsibility Provider Isolation 契約の公開field、非公開境界、互換性を所有する。
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

/**
 * 回復開始診断の許容段階を検証Ownerで固定する。
 * @responsibility 未知の開始段階を診断の成功値へ補完しない。
 * @trace ARCH-000008
 */
export const RECOVERY_START_FAILURE_STAGES = Object.freeze([
  "plan_validation",
  "operation_context",
  "provider_home",
  "home_lock",
  "operation_binding",
  "state_conflict",
  "operation_start_save",
  "settlement_binding",
  "host_submission",
  "home_lock_release",
  "unknown",
] as const);

// 現行Hostの開始・在庫投影が返す有限理由だけを受ける。
// 旧保存方式のProducer不在理由を分類契約として保持しない。未知値は従来どおりunavailable。
const RECOVERY_START_REASON_CLASS = new Map<string, string>([
  [
    "docker_task_multiple_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  ...[
    "docker_task_recovery_home_lock_release_unconfirmed",
    "docker_task_recovery_host_lock_release_unconfirmed",
    "docker_task_runtime_state_lock_release_unconfirmed",
    "docker_task_recovery_begin_failed_closed",
    "docker_task_recovery_failed_closed",
  ].map(
    (reason) =>
      [
        reason,
        "docker_process_controller_recovery_observation_unknown",
      ] as const,
  ),
]);

/**
 * 解放済みで五資源が既知終端の操作だけをHost不存在観測へ接続する。
 * @responsibility Host清掃欄が未要求でも観測可能な限定条件を判定する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderが相関を確認したTask操作。
 * @returns 現在Host／markerの観測へ進める場合だけtrue。
 * @precondition 元token／Root結合、fresh排他と実不存在は別途確認する。
 * @postcondition trueをHost清掃・Task成功・履歴確定へ昇格しない。
 * @effect N/A: メモリ内の値判定だけ。
 * @failure 未解放・Owner有効／不明・未終端・遷移／再起動未解決はfalse。
 * @invariant 過去unknownを成功へ変換せずWorkspaceを再利用しない。
 * @boundary 保存済み終端条件と実Host観測。
 * @security 保存値だけでは処置Authorityを作らない。
 * @concurrency N/A: 実体・排他の前後照合は回収Ownerが担当する。
 */
export function coordinatorReleasedTaskCanObserveHostAbsence(
  operation: ExecutionOperationRecord,
  state:
    | Readonly<{
        operation: ExecutionOperationRecord;
        resourcesSettled: boolean;
        restartSettled: boolean;
      }>
    | undefined,
): boolean {
  return (
    state?.operation === operation &&
    operation.lease === "released" &&
    operation.execution.ownerEffect === "disabled" &&
    operation.execution.workspaceReusable === false &&
    operation.host.pendingTransitionJson === null &&
    state.restartSettled &&
    operation.resources !== null &&
    operation.resources.checkpoints.length > 0 &&
    operation.resources.checkpoints.length ===
      operation.resources.snapshot.resources.length &&
    operation.resources.checkpoints.every(
      (resource) =>
        resource.receiptSource !== null && resource.observation === "absent",
    ) &&
    state.resourcesSettled
  );
}

/**
 * own Data Valueを決定する。
 *
 * @responsibility own Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns unknownを返す。
 * @precondition 「value: unknown、key: string」がownDataValueの入力契約を満たす。
 * @postcondition ownDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataValueは共有非同期状態を持たない同期処理である。
 */
export function ownDataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ready 回復を所有Snapshotへ変換する。
 *
 * @responsibility Ready 回復の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns Recovery | nullを返す。
 * @precondition 「value: unknown」がsnapshotReadyRecoveryの入力契約を満たす。
 * @postcondition snapshotReadyRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: snapshotReadyRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotReadyRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotReadyRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotReadyRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotReadyRecoveryは共有非同期状態を持たない同期処理である。
 */
export function snapshotReadyRecovery(value: unknown): Recovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["recoveryCapability", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const recoveryId = ownDataValue(value, "recoveryId");
  const recoveryCapability = ownDataValue(value, "recoveryCapability");
  return status === "ready" &&
    typeof recoveryId === "string" &&
    recoveryCapability !== null &&
    typeof recoveryCapability === "object"
    ? Object.freeze({ status, recoveryId, recoveryCapability })
    : null;
}

/**
 * Blocked 回復 With Exact Idを所有Snapshotへ変換する。
 *
 * @responsibility Blocked 回復 With Exact Idの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedStableLogicalHomeBindingHash: string
 * @returns snapshotBlockedRecoveryWithExactIdの計算結果を返す。
 * @precondition 「value: unknown、expectedStableLogicalHomeBindingHash: string」がsnapshotBlockedRecoveryWithExactIdの入力契約を満たす。
 * @postcondition snapshotBlockedRecoveryWithExactIdの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBlockedRecoveryWithExactIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBlockedRecoveryWithExactIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBlockedRecoveryWithExactIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotBlockedRecoveryWithExactIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotBlockedRecoveryWithExactIdは共有非同期状態を持たない同期処理である。
 */
export function snapshotBlockedRecoveryWithExactId(
  value: unknown,
  expectedStableLogicalHomeBindingHash: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (types.isProxy(value)) return null;
  let hasOwner = false;
  try {
    const keys = Object.keys(value).sort().join("\0");
    hasOwner =
      keys ===
      [
        "reason",
        "recoveryId",
        "status",
        "recoveryCapability",
        "manualRecoveryRequired",
      ]
        .sort()
        .join("\0");
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      (keys !== ["reason", "recoveryId", "status"].sort().join("\0") &&
        !hasOwner)
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const reason = ownDataValue(value, "reason");
  const recoveryId = resolveRecoveryReference(
    ownDataValue(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  const capability = ownDataValue(value, "recoveryCapability");
  if (
    hasOwner &&
    (!capability ||
      typeof capability !== "object" ||
      types.isProxy(capability) ||
      ownDataValue(value, "manualRecoveryRequired") !== true)
  )
    return null;
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({
        status,
        reason,
        recoveryId,
        recoveryCapability: capability ?? null,
      })
    : null;
}

/**
 * 技術結果の固定field集合を動的Propertyなしに捕捉する。
 * @responsibility 既存診断shapeの受理順序を変えず値を局所化する。
 * @trace ARCH-000008
 * @input 未検査値とこのModule内の固定Key集合。
 * @returns 凍結した浅い値又はnull。
 * @precondition 永続化・保存Schemaの判断は行わない。
 * @postcondition getter・Proxy・継承値を評価しない。
 * @effect N/A: 同期の検査のみ。
 * @failure 不正shape・取得不能はnull。
 * @invariant 観測不能を成功へ補完しない。
 * @boundary 結果・診断の内部捕捉。
 * @security 任意のfieldを公開結果へ混入させない。
 * @concurrency N/A: 共有状態なし。
 */
function snapshotRecoveryRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/** 診断の未知値・余分な内容を拒否し、Authorityを伴わない値へ閉じる。 */
export function inspectRecoveryStartFailureDiagnostic(
  raw: unknown,
): RecoveryStartFailureDiagnostic | null {
  const value = snapshotRecoveryRecord(raw, new Set(["stage", "recoveryId"]));
  if (
    !value ||
    !RECOVERY_START_FAILURE_STAGES.includes(
      value.stage as RecoveryStartFailureDiagnostic["stage"],
    ) ||
    (value.recoveryId !== null && !parseDockerTaskRecoveryId(value.recoveryId))
  )
    return null;
  return Object.freeze({
    stage: value.stage as RecoveryStartFailureDiagnostic["stage"],
    recoveryId: value.recoveryId as string | null,
  });
}

/**
 * public Docker 回復 Start Reasonを決定する。
 *
 * @responsibility public Docker 回復 Start Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: unknown
 * @returns resolveRecoveryStartReasonの計算結果を返す。
 * @precondition 「reason: unknown」がresolveRecoveryStartReasonの入力契約を満たす。
 * @postcondition resolveRecoveryStartReasonの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryStartReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryStartReasonは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryStartReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryStartReasonはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryStartReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryStartReasonは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryStartReason(reason: unknown) {
  if (typeof reason === "string") {
    const classified = RECOVERY_START_REASON_CLASS.get(reason);
    if (classified) return classified;
  }
  return "docker_process_controller_recovery_unavailable";
}

/**
 * public Verified Docker 回復 Idを決定する。
 *
 * @responsibility public Verified Docker 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns resolveRecoveryReferenceの計算結果を返す。
 * @precondition 「value: unknown」がresolveRecoveryReferenceの入力契約を満たす。
 * @postcondition resolveRecoveryReferenceの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryReferenceは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryReferenceはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryReferenceは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryReference(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}
