/**
 * provider-home-mount-grant-runtimeに属する責務をまとめる。
 *
 * @responsibility Grantを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000010
 */
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  compileProviderHomeMountGrantCandidate,
  evaluateProviderHomeMountGrantTransitionCandidate,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
  PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
} from "./provider-home-mount-grant.ts";
import {
  consumeRuntimeOwnedProviderHomeMountSourceCapability,
  consumeRuntimeOwnedProviderHomeObservationCapability,
  revokeRuntimeOwnedProviderHomeMountSourceCapability,
} from "./provider-home-windows-adapter.ts";

export const PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-home-mount-grant-runtime";
export const PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT_REVISION = 3;

const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const MAXIMUM_IDENTIFIER_LENGTH = 64;
const GRANT_REFERENCE_DIGITS = 18;
const MAXIMUM_REFERENCE_ATTEMPTS = 8;

/**
 * provider-home-mount-grant-runtimeで使用するGrantの値契約を定義する。
 *
 * @responsibility GrantのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape Grantが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Grantで宣言した値と責務の対応を維持する。
 * @boundary N/A: Grantの宣言は外部境界を開かない。
 * @security GrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Grantの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Grant = Readonly<{
  contract: typeof PROVIDER_HOME_MOUNT_GRANT_CONTRACT;
  contractRevision: typeof PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION;
  grantRef: string;
  provider: string;
  profileId: string;
  operationId: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  state: string;
  issuedAt: string | null;
  expiresAt: string | null;
  consumedAt: string | null;
  revokedAt: string | null;
  usageLimit: 1;
  consumptionCount: 0 | 1;
}>;

/**
 * provider-home-mount-grant-runtimeで使用するAlias Roleの値契約を定義する。
 *
 * @responsibility Alias RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape AliasRoleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AliasRoleで宣言した値と責務の対応を維持する。
 * @boundary N/A: AliasRoleの宣言は外部境界を開かない。
 * @security AliasRoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility AliasRoleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AliasRole = "control" | "use" | "mount_authorization" | "active_mount";

/**
 * provider-home-mount-grant-runtimeで使用するRuntime Grantの値契約を定義する。
 *
 * @responsibility Runtime GrantのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape RuntimeGrantが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeGrantで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeGrantの宣言は外部境界を開かない。
 * @security RuntimeGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeGrantの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeGrant = {
  grant: Grant;
  managementCapability: object;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
  aliases: Set<object>;
  mountActive: boolean;
  mountSourceCapability: object | null;
  activeMountSourcePath: string | null;
};

/**
 * provider-home-mount-grant-runtimeで使用するObservationの値契約を定義する。
 *
 * @responsibility ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape Observationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Observationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Observationの宣言は外部境界を開かない。
 * @security ObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Observationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Observation = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedProviderHomeObservationCapability>
>;

/**
 * provider-home-mount-grant-runtimeで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  aliases: WeakMap<
    object,
    Readonly<{ role: AliasRole; runtimeGrant: RuntimeGrant }>
  >;
  activeGrants: Map<string, RuntimeGrant>;
  activeHomeBindings: Map<string, RuntimeGrant>;
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  consumeObservation: (capability: unknown) => Observation | null;
  consumeMountSource: typeof consumeRuntimeOwnedProviderHomeMountSourceCapability;
  revokeMountSource: typeof revokeRuntimeOwnedProviderHomeMountSourceCapability;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
  production: boolean;
}>;

/**
 * Runtime 状態を構築する。
 *
 * @responsibility Runtime 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input dependencies: Pick< RuntimeState, | "verifyOperation" | "consumeObservation" | "consumeMountSource" | "revokeMountSource" | "wallNow" | "monotonicNow" | "randomBytes" | "production" >
 * @returns RuntimeStateを返す。
 * @precondition 「dependencies: Pick< RuntimeState, | "verifyOperation" | "consumeObservation" | "consumeMountSource" | "revokeMountSource" | "wallNow" | "monotonicNow" | "randomBytes" | "production" >」がcreateRuntimeStateの入力契約を満たす。
 * @postcondition createRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant createRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security createRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function createRuntimeState(
  dependencies: Pick<
    RuntimeState,
    | "verifyOperation"
    | "consumeObservation"
    | "consumeMountSource"
    | "revokeMountSource"
    | "wallNow"
    | "monotonicNow"
    | "randomBytes"
    | "production"
  >,
): RuntimeState {
  return Object.freeze({
    aliases: new WeakMap(),
    activeGrants: new Map(),
    activeHomeBindings: new Map(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperation: verifyOwnedOperationManagementCapability,
  consumeObservation: consumeRuntimeOwnedProviderHomeObservationCapability,
  consumeMountSource: consumeRuntimeOwnedProviderHomeMountSourceCapability,
  revokeMountSource: revokeRuntimeOwnedProviderHomeMountSourceCapability,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
  production: true,
});

/**
 * provider-home-mount-grant-runtimeを停止結果として構築する。
 *
 * @responsibility provider-home-mount-grant-runtimeの停止理由、未発行Effect、公開結果境界を所有する。
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
    grantRef: null,
    controlCapability: null,
    useCapability: null,
    mountAuthorizationCapability: null,
    activeMountCapability: null,
    providerHomeMountGrantIssued: false,
    mountAuthorizationIssued: false,
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
    credentialReported: false,
  });
}

/**
 * Closedを失敗として終了させる。
 *
 * @responsibility Closedの失敗条件、診断情報、終了結果境界を所有する。
 * @trace ARCH-000010
 * @input reason: string、action: () => T
 * @returns failClosedの計算結果を返す。
 * @precondition 「reason: string、action: () => T」がfailClosedの入力契約を満たす。
 * @postcondition failClosedの責務を完了した結果だけを返す。
 * @effect N/A: failClosedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure failClosedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant failClosedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: failClosedはProcess内の同一Subsystemで完結する。
 * @security failClosedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failClosedは共有非同期状態を持たない同期処理である。
 */
function failClosed<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return blocked(reason);
  }
}

/**
 * Profile Idが有効か判定する。
 *
 * @responsibility Profile Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidProfileIdの入力契約を満たす。
 * @postcondition validProfileIdの責務を完了した結果だけを返す。
 * @effect N/A: validProfileIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validProfileIdは独自の失敗分岐を所有しない。
 * @invariant validProfileIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validProfileIdはProcess内の同一Subsystemで完結する。
 * @security validProfileIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validProfileIdは共有非同期状態を持たない同期処理である。
 */
function validProfileId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAXIMUM_IDENTIFIER_LENGTH &&
    PROFILE_ID.test(value)
  );
}

/**
 * runtime Grant Refを決定する。
 *
 * @responsibility runtime Grant Refの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState
 * @returns runtimeGrantRefの計算結果を返す。
 * @precondition 「state: RuntimeState」がruntimeGrantRefの入力契約を満たす。
 * @postcondition runtimeGrantRefの責務を完了した結果だけを返す。
 * @effect N/A: runtimeGrantRefは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runtimeGrantRefは独自の失敗分岐を所有しない。
 * @invariant runtimeGrantRefは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runtimeGrantRefはProcess内の同一Subsystemで完結する。
 * @security runtimeGrantRefはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runtimeGrantRefは共有非同期状態を持たない同期処理である。
 */
function runtimeGrantRef(state: RuntimeState) {
  for (let attempt = 0; attempt < MAXIMUM_REFERENCE_ATTEMPTS; attempt += 1) {
    const random = state.randomBytes(8).readBigUInt64BE();
    const digits = (random % 10n ** BigInt(GRANT_REFERENCE_DIGITS))
      .toString(10)
      .padStart(GRANT_REFERENCE_DIGITS, "0");
    const grantRef = `PHMGRANT-${digits}`;
    if (!state.activeGrants.has(grantRef)) return grantRef;
  }
  return null;
}

/**
 * Aliasを構築する。
 *
 * @responsibility Aliasの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、runtimeGrant: RuntimeGrant、role: AliasRole
 * @returns createAliasの計算結果を返す。
 * @precondition 「state: RuntimeState、runtimeGrant: RuntimeGrant、role: AliasRole」がcreateAliasの入力契約を満たす。
 * @postcondition createAliasの責務を完了した結果だけを返す。
 * @effect N/A: createAliasは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createAliasは独自の失敗分岐を所有しない。
 * @invariant createAliasは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createAliasはProcess内の同一Subsystemで完結する。
 * @security createAliasはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createAliasは共有非同期状態を持たない同期処理である。
 */
function createAlias(
  state: RuntimeState,
  runtimeGrant: RuntimeGrant,
  role: AliasRole,
) {
  const capability = Object.freeze({});
  state.aliases.set(capability, Object.freeze({ role, runtimeGrant }));
  runtimeGrant.aliases.add(capability);
  return capability;
}

/**
 * aliasを決定する。
 *
 * @responsibility aliasの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、capability: unknown、expectedRole: AliasRole
 * @returns Readonly<{ role: AliasRole; runtimeGrant: RuntimeGrant }> | nullを返す。
 * @precondition 「state: RuntimeState、capability: unknown、expectedRole: AliasRole」がaliasの入力契約を満たす。
 * @postcondition aliasの責務を完了した結果だけを返す。
 * @effect N/A: aliasは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: aliasは独自の失敗分岐を所有しない。
 * @invariant aliasは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: aliasはProcess内の同一Subsystemで完結する。
 * @security aliasはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: aliasは共有非同期状態を持たない同期処理である。
 */
function alias(
  state: RuntimeState,
  capability: unknown,
  expectedRole: AliasRole,
): Readonly<{ role: AliasRole; runtimeGrant: RuntimeGrant }> | null {
  if (!capability || typeof capability !== "object") return null;
  const value = state.aliases.get(capability);
  return value?.role === expectedRole ? value : null;
}

/**
 * operation Bindingを決定する。
 *
 * @responsibility operation Bindingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、managementCapability: unknown
 * @returns Readonly<{ operationId: string; createdAt: string }> | nullを返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown」がoperationBindingの入力契約を満たす。
 * @postcondition operationBindingの責務を完了した結果だけを返す。
 * @effect N/A: operationBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure operationBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant operationBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: operationBindingはProcess内の同一Subsystemで完結する。
 * @security operationBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationBindingは共有非同期状態を持たない同期処理である。
 */
function operationBinding(
  state: RuntimeState,
  managementCapability: unknown,
): Readonly<{ operationId: string; createdAt: string }> | null {
  try {
    return state.verifyOperation(managementCapability);
  } catch {
    return null;
  }
}

/**
 * grant 記録を決定する。
 *
 * @responsibility grant 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input binding: Readonly<{ operationId: string }>、profileId: string、observation: Observation、grantRef: string、issuedWallClockMs: number
 * @returns Grant | nullを返す。
 * @precondition 「binding: Readonly<{ operationId: string }>、profileId: string、observation: Observation、grantRef: string、issuedWallClockMs: number」がgrantRecordの入力契約を満たす。
 * @postcondition grantRecordの責務を完了した結果だけを返す。
 * @effect N/A: grantRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: grantRecordは独自の失敗分岐を所有しない。
 * @invariant grantRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: grantRecordはProcess内の同一Subsystemで完結する。
 * @security grantRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: grantRecordは共有非同期状態を持たない同期処理である。
 */
function grantRecord(
  binding: Readonly<{ operationId: string }>,
  profileId: string,
  observation: Observation,
  grantRef: string,
  issuedWallClockMs: number,
): Grant | null {
  const prepared: Grant = Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    grantRef,
    provider: observation.provider,
    profileId,
    operationId: binding.operationId,
    providerHomeIdentityHash: observation.providerHomeIdentityHash,
    providerHomeProtectionHash: observation.providerHomeProtectionHash,
    localUserBindingHash: observation.localUserBindingHash,
    stableLogicalHomeBindingHash: observation.stableLogicalHomeBindingHash,
    state: "prepared",
    issuedAt: null,
    expiresAt: null,
    consumedAt: null,
    revokedAt: null,
    usageLimit: 1,
    consumptionCount: 0,
  });
  const issued: Grant = Object.freeze({
    ...prepared,
    state: "issued",
    issuedAt: new Date(issuedWallClockMs).toISOString(),
    expiresAt: new Date(
      issuedWallClockMs + PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
    ).toISOString(),
  });
  const preparedCandidate = compileProviderHomeMountGrantCandidate(prepared);
  const transition = evaluateProviderHomeMountGrantTransitionCandidate({
    previous: prepared,
    next: issued,
  });
  return preparedCandidate.status === "candidate" &&
    transition.status === "candidate"
    ? (transition.grant as Grant)
    : null;
}

/**
 * current Runtime Ageを決定する。
 *
 * @responsibility current Runtime Ageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、runtimeGrant: RuntimeGrant
 * @returns currentRuntimeAgeの計算結果を返す。
 * @precondition 「state: RuntimeState、runtimeGrant: RuntimeGrant」がcurrentRuntimeAgeの入力契約を満たす。
 * @postcondition currentRuntimeAgeの責務を完了した結果だけを返す。
 * @effect N/A: currentRuntimeAgeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: currentRuntimeAgeは独自の失敗分岐を所有しない。
 * @invariant currentRuntimeAgeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: currentRuntimeAgeはProcess内の同一Subsystemで完結する。
 * @security currentRuntimeAgeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentRuntimeAgeは共有非同期状態を持たない同期処理である。
 */
function currentRuntimeAge(state: RuntimeState, runtimeGrant: RuntimeGrant) {
  const now = state.wallNow();
  const wallAge = now - runtimeGrant.issuedWallClockMs;
  const monotonicAge = state.monotonicNow() - runtimeGrant.issuedMonotonicMs;
  if (
    !Number.isFinite(wallAge) ||
    !Number.isFinite(monotonicAge) ||
    wallAge < 0 ||
    monotonicAge < 0 ||
    wallAge >= PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS ||
    monotonicAge >= PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS
  ) {
    return null;
  }
  return Object.freeze({ wallAge, monotonicAge, now });
}

/**
 * Management Capabilityが同一かを判定する。
 *
 * @responsibility Management Capabilityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、runtimeGrant: RuntimeGrant、managementCapability: unknown
 * @returns sameManagementCapabilityの計算結果を返す。
 * @precondition 「state: RuntimeState、runtimeGrant: RuntimeGrant、managementCapability: unknown」がsameManagementCapabilityの入力契約を満たす。
 * @postcondition sameManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: sameManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameManagementCapabilityは独自の失敗分岐を所有しない。
 * @invariant sameManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security sameManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
function sameManagementCapability(
  state: RuntimeState,
  runtimeGrant: RuntimeGrant,
  managementCapability: unknown,
) {
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    runtimeGrant.managementCapability !== managementCapability
  ) {
    return null;
  }
  const binding = operationBinding(state, managementCapability);
  return binding?.operationId === runtimeGrant.grant.operationId
    ? binding
    : null;
}

/**
 * Aliasを除去する。
 *
 * @responsibility Aliasの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、runtimeGrant: RuntimeGrant、capability: object
 * @returns N/A: removeAliasは戻り値を返さない。
 * @precondition 「state: RuntimeState、runtimeGrant: RuntimeGrant、capability: object」がremoveAliasの入力契約を満たす。
 * @postcondition removeAliasの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: removeAliasは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: removeAliasは独自の失敗分岐を所有しない。
 * @invariant removeAliasは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: removeAliasはProcess内の同一Subsystemで完結する。
 * @security removeAliasはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeAliasは共有非同期状態を持たない同期処理である。
 */
function removeAlias(
  state: RuntimeState,
  runtimeGrant: RuntimeGrant,
  capability: object,
) {
  state.aliases.delete(capability);
  runtimeGrant.aliases.delete(capability);
}

/**
 * All Aliasesを失効させる。
 *
 * @responsibility All Aliasesの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、runtimeGrant: RuntimeGrant
 * @returns N/A: revokeAllAliasesは戻り値を返さない。
 * @precondition 「state: RuntimeState、runtimeGrant: RuntimeGrant」がrevokeAllAliasesの入力契約を満たす。
 * @postcondition revokeAllAliasesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: revokeAllAliasesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeAllAliasesは独自の失敗分岐を所有しない。
 * @invariant revokeAllAliasesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeAllAliasesはProcess内の同一Subsystemで完結する。
 * @security revokeAllAliasesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeAllAliasesは共有非同期状態を持たない同期処理である。
 */
function revokeAllAliases(state: RuntimeState, runtimeGrant: RuntimeGrant) {
  for (const capability of runtimeGrant.aliases) {
    state.aliases.delete(capability);
  }
  runtimeGrant.aliases.clear();
}

/**
 * Mount Sourceを失効させる。
 *
 * @responsibility Mount Sourceの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、runtimeGrant: RuntimeGrant
 * @returns N/A: revokeMountSourceは戻り値を返さない。
 * @precondition 「state: RuntimeState、runtimeGrant: RuntimeGrant」がrevokeMountSourceの入力契約を満たす。
 * @postcondition revokeMountSourceの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: revokeMountSourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeMountSourceは独自の失敗分岐を所有しない。
 * @invariant revokeMountSourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeMountSourceはProcess内の同一Subsystemで完結する。
 * @security revokeMountSourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeMountSourceは共有非同期状態を持たない同期処理である。
 */
function revokeMountSource(state: RuntimeState, runtimeGrant: RuntimeGrant) {
  if (runtimeGrant.mountSourceCapability) {
    state.revokeMountSource(runtimeGrant.mountSourceCapability);
    runtimeGrant.mountSourceCapability = null;
  }
}

/**
 * provider-home-mount-grant-runtimeを発行する。
 *
 * @responsibility provider-home-mount-grant-runtimeの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、managementCapability: unknown、observationCapability: unknown、profileId: unknown
 * @returns issueの計算結果を返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown、observationCapability: unknown、profileId: unknown」がissueの入力契約を満たす。
 * @postcondition issueの責務を完了した結果だけを返す。
 * @effect N/A: issueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueは独自の失敗分岐を所有しない。
 * @invariant issueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueはProcess内の同一Subsystemで完結する。
 * @security issueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueは共有非同期状態を持たない同期処理である。
 */
function issue(
  state: RuntimeState,
  managementCapability: unknown,
  observationCapability: unknown,
  profileId: unknown,
) {
  if (!validProfileId(profileId)) {
    return blocked("provider_home_mount_grant_runtime_profile_invalid");
  }
  const binding = operationBinding(state, managementCapability);
  if (
    !binding ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return blocked("provider_home_mount_grant_runtime_operation_invalid");
  }
  const observation = state.consumeObservation(observationCapability);
  if (!observation) {
    return blocked("provider_home_mount_grant_runtime_observation_invalid");
  }
  const grantRef = runtimeGrantRef(state);
  if (!grantRef) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_reference_unavailable");
  }
  const issuedWallClockMs = state.wallNow();
  const issuedMonotonicMs = state.monotonicNow();
  if (
    !Number.isFinite(issuedWallClockMs) ||
    !Number.isFinite(issuedMonotonicMs) ||
    issuedWallClockMs < 0 ||
    issuedMonotonicMs < 0
  ) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_clock_invalid");
  }
  const grant = grantRecord(
    binding,
    profileId,
    observation,
    grantRef,
    issuedWallClockMs,
  );
  if (!grant) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_issuance_invalid");
  }
  const runtimeGrant: RuntimeGrant = {
    grant,
    managementCapability,
    issuedWallClockMs,
    issuedMonotonicMs,
    aliases: new Set<object>(),
    mountActive: false,
    mountSourceCapability: observation.providerHomeMountSourceCapability,
    activeMountSourcePath: null,
  };
  const controlCapability = createAlias(state, runtimeGrant, "control");
  const useCapability = createAlias(state, runtimeGrant, "use");
  state.activeGrants.set(grantRef, runtimeGrant);
  return Object.freeze({
    ...blocked("provider_home_mount_grant_runtime_issued"),
    status: "issued" as const,
    grant,
    grantRef,
    controlCapability,
    useCapability,
    providerHomeMountGrantIssued: true,
  });
}

/**
 * provider-home-mount-grant-runtimeを一回限りで消費する。
 *
 * @responsibility provider-home-mount-grant-runtimeの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、useCapability: unknown、managementCapability: unknown、currentObservationCapability: unknown
 * @returns consumeの計算結果を返す。
 * @precondition 「state: RuntimeState、useCapability: unknown、managementCapability: unknown、currentObservationCapability: unknown」がconsumeの入力契約を満たす。
 * @postcondition consumeの責務を完了した結果だけを返す。
 * @effect N/A: consumeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeは独自の失敗分岐を所有しない。
 * @invariant consumeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeはProcess内の同一Subsystemで完結する。
 * @security consumeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeは共有非同期状態を持たない同期処理である。
 */
function consume(
  state: RuntimeState,
  useCapability: unknown,
  managementCapability: unknown,
  currentObservationCapability: unknown,
) {
  const use = alias(state, useCapability, "use");
  if (
    !use ||
    !useCapability ||
    typeof useCapability !== "object" ||
    !sameManagementCapability(state, use.runtimeGrant, managementCapability)
  ) {
    return blocked("provider_home_mount_grant_runtime_use_invalid");
  }
  const runtimeGrant = use.runtimeGrant;
  if (
    runtimeGrant.grant.state !== "issued" ||
    state.activeGrants.get(runtimeGrant.grant.grantRef) !== runtimeGrant
  ) {
    return blocked("provider_home_mount_grant_runtime_not_usable");
  }
  const observation = state.consumeObservation(currentObservationCapability);
  if (!observation) {
    return blocked("provider_home_mount_grant_runtime_observation_invalid");
  }
  const age = currentRuntimeAge(state, runtimeGrant);
  if (!age) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_expired");
  }
  if (
    observation.provider !== runtimeGrant.grant.provider ||
    observation.providerHomeIdentityHash !==
      runtimeGrant.grant.providerHomeIdentityHash ||
    observation.providerHomeProtectionHash !==
      runtimeGrant.grant.providerHomeProtectionHash ||
    observation.localUserBindingHash !==
      runtimeGrant.grant.localUserBindingHash ||
    observation.stableLogicalHomeBindingHash !==
      runtimeGrant.grant.stableLogicalHomeBindingHash
  ) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_observation_mismatch");
  }
  const next: Grant = Object.freeze({
    ...runtimeGrant.grant,
    state: "consumed",
    consumedAt: new Date(age.now).toISOString(),
    consumptionCount: 1,
  });
  const transition = evaluateProviderHomeMountGrantTransitionCandidate({
    previous: runtimeGrant.grant,
    next,
  });
  if (transition.status !== "candidate") {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_consumption_invalid");
  }
  revokeMountSource(state, runtimeGrant);
  runtimeGrant.mountSourceCapability =
    observation.providerHomeMountSourceCapability;
  runtimeGrant.grant = transition.grant as Grant;
  removeAlias(state, runtimeGrant, useCapability);
  const mountAuthorizationCapability = createAlias(
    state,
    runtimeGrant,
    "mount_authorization",
  );
  return Object.freeze({
    ...blocked("provider_home_mount_grant_runtime_consumed"),
    status: "consumed" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
    mountAuthorizationCapability,
    providerHomeMountGrantIssued: true,
    mountAuthorizationIssued: true,
  });
}

/**
 * Mountを有効化する。
 *
 * @responsibility Mountの有効化条件、状態遷移、失敗時の非発効境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、mountAuthorizationCapability: unknown、managementCapability: unknown
 * @returns activateMountの計算結果を返す。
 * @precondition 「state: RuntimeState、mountAuthorizationCapability: unknown、managementCapability: unknown」がactivateMountの入力契約を満たす。
 * @postcondition activateMountの責務を完了した結果だけを返す。
 * @effect N/A: activateMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: activateMountは独自の失敗分岐を所有しない。
 * @invariant activateMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activateMountはProcess内の同一Subsystemで完結する。
 * @security activateMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activateMountは共有非同期状態を持たない同期処理である。
 */
function activateMount(
  state: RuntimeState,
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  const authorization = alias(
    state,
    mountAuthorizationCapability,
    "mount_authorization",
  );
  if (
    !authorization ||
    !mountAuthorizationCapability ||
    typeof mountAuthorizationCapability !== "object" ||
    !sameManagementCapability(
      state,
      authorization.runtimeGrant,
      managementCapability,
    ) ||
    authorization.runtimeGrant.grant.state !== "consumed" ||
    authorization.runtimeGrant.mountActive ||
    !currentRuntimeAge(state, authorization.runtimeGrant)
  ) {
    return blocked("provider_home_mount_activation_invalid");
  }
  const runtimeGrant = authorization.runtimeGrant;
  const logicalHomeBinding = runtimeGrant.grant.stableLogicalHomeBindingHash;
  const currentHomeBinding = state.activeHomeBindings.get(logicalHomeBinding);
  if (currentHomeBinding && currentHomeBinding !== runtimeGrant) {
    return blocked("provider_home_mount_logical_home_already_active");
  }
  const sourcePath = state.consumeMountSource(
    runtimeGrant.mountSourceCapability,
    runtimeGrant.grant.provider,
  );
  runtimeGrant.mountSourceCapability = null;
  if (!sourcePath) {
    return blocked("provider_home_mount_source_binding_invalid");
  }
  runtimeGrant.mountActive = true;
  runtimeGrant.activeMountSourcePath = sourcePath;
  state.activeHomeBindings.set(logicalHomeBinding, runtimeGrant);
  removeAlias(state, runtimeGrant, mountAuthorizationCapability);
  const activeMountCapability = createAlias(
    state,
    runtimeGrant,
    "active_mount",
  );
  return Object.freeze({
    ...blocked("provider_home_mount_activated"),
    status: "activated" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
    activeMountCapability,
    providerHomeMountGrantIssued: true,
    mountAuthorizationIssued: true,
  });
}

/**
 * Mount Sourceが有効な状態か判定する。
 *
 * @responsibility Mount Sourceの有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、activeMountCapability: unknown、managementCapability: unknown
 * @returns activeMountSourceの計算結果を返す。
 * @precondition 「state: RuntimeState、activeMountCapability: unknown、managementCapability: unknown」がactiveMountSourceの入力契約を満たす。
 * @postcondition activeMountSourceの責務を完了した結果だけを返す。
 * @effect N/A: activeMountSourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: activeMountSourceは独自の失敗分岐を所有しない。
 * @invariant activeMountSourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activeMountSourceはProcess内の同一Subsystemで完結する。
 * @security activeMountSourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeMountSourceは共有非同期状態を持たない同期処理である。
 */
function activeMountSource(
  state: RuntimeState,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const active = alias(state, activeMountCapability, "active_mount");
  if (
    !active ||
    !sameManagementCapability(
      state,
      active.runtimeGrant,
      managementCapability,
    ) ||
    !active.runtimeGrant.mountActive ||
    !active.runtimeGrant.activeMountSourcePath
  ) {
    return null;
  }
  return active.runtimeGrant.activeMountSourcePath;
}

/**
 * Active Mountを観測する。
 *
 * @responsibility Active Mountの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、activeMountCapability: unknown、managementCapability: unknown
 * @returns inspectActiveMountの計算結果を返す。
 * @precondition 「state: RuntimeState、activeMountCapability: unknown、managementCapability: unknown」がinspectActiveMountの入力契約を満たす。
 * @postcondition inspectActiveMountの責務を完了した結果だけを返す。
 * @effect N/A: inspectActiveMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectActiveMountは独自の失敗分岐を所有しない。
 * @invariant inspectActiveMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectActiveMountはProcess内の同一Subsystemで完結する。
 * @security inspectActiveMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectActiveMountは共有非同期状態を持たない同期処理である。
 */
function inspectActiveMount(
  state: RuntimeState,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const active = alias(state, activeMountCapability, "active_mount");
  if (
    !active ||
    !sameManagementCapability(
      state,
      active.runtimeGrant,
      managementCapability,
    ) ||
    !active.runtimeGrant.mountActive ||
    !active.runtimeGrant.activeMountSourcePath ||
    !currentRuntimeAge(state, active.runtimeGrant)
  ) {
    return blocked("provider_home_active_mount_inspection_invalid");
  }
  const grant = active.runtimeGrant.grant;
  return Object.freeze({
    ...blocked("provider_home_active_mount_confirmed"),
    status: "active" as const,
    grant,
    grantRef: grant.grantRef,
    provider: grant.provider,
    profileId: grant.profileId,
    operationId: grant.operationId,
    providerHomeMountGrantIssued: true,
    providerHomeMounted: true,
    runtimeAuthorityIssued: false,
  });
}

/**
 * Mountを完了状態へ遷移させる。
 *
 * @responsibility Mountの完了条件、終了後状態、未完了境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、activeMountCapability: unknown、managementCapability: unknown
 * @returns completeMountの計算結果を返す。
 * @precondition 「state: RuntimeState、activeMountCapability: unknown、managementCapability: unknown」がcompleteMountの入力契約を満たす。
 * @postcondition completeMountの責務を完了した結果だけを返す。
 * @effect N/A: completeMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completeMountは独自の失敗分岐を所有しない。
 * @invariant completeMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completeMountはProcess内の同一Subsystemで完結する。
 * @security completeMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completeMountは共有非同期状態を持たない同期処理である。
 */
function completeMount(
  state: RuntimeState,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const active = alias(state, activeMountCapability, "active_mount");
  if (
    !active ||
    !activeMountCapability ||
    typeof activeMountCapability !== "object" ||
    !sameManagementCapability(
      state,
      active.runtimeGrant,
      managementCapability,
    ) ||
    !active.runtimeGrant.mountActive ||
    !active.runtimeGrant.activeMountSourcePath
  ) {
    return blocked("provider_home_mount_completion_invalid");
  }
  const runtimeGrant = active.runtimeGrant;
  const logicalHomeBinding = runtimeGrant.grant.stableLogicalHomeBindingHash;
  if (state.activeHomeBindings.get(logicalHomeBinding) !== runtimeGrant) {
    return blocked("provider_home_mount_completion_owner_mismatch");
  }
  runtimeGrant.mountActive = false;
  runtimeGrant.activeMountSourcePath = null;
  state.activeHomeBindings.delete(logicalHomeBinding);
  removeAlias(state, runtimeGrant, activeMountCapability);
  return Object.freeze({
    ...blocked("provider_home_mount_completed"),
    status: "completed" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
    providerHomeMountGrantIssued: true,
  });
}

/**
 * Mount Authorizationを観測する。
 *
 * @responsibility Mount Authorizationの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、mountAuthorizationCapability: unknown、managementCapability: unknown
 * @returns inspectMountAuthorizationの計算結果を返す。
 * @precondition 「state: RuntimeState、mountAuthorizationCapability: unknown、managementCapability: unknown」がinspectMountAuthorizationの入力契約を満たす。
 * @postcondition inspectMountAuthorizationの責務を完了した結果だけを返す。
 * @effect N/A: inspectMountAuthorizationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectMountAuthorizationは独自の失敗分岐を所有しない。
 * @invariant inspectMountAuthorizationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectMountAuthorizationはProcess内の同一Subsystemで完結する。
 * @security inspectMountAuthorizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectMountAuthorizationは共有非同期状態を持たない同期処理である。
 */
function inspectMountAuthorization(
  state: RuntimeState,
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  const authorization = alias(
    state,
    mountAuthorizationCapability,
    "mount_authorization",
  );
  if (
    !authorization ||
    !sameManagementCapability(
      state,
      authorization.runtimeGrant,
      managementCapability,
    ) ||
    authorization.runtimeGrant.grant.state !== "consumed" ||
    authorization.runtimeGrant.mountActive ||
    !currentRuntimeAge(state, authorization.runtimeGrant)
  ) {
    return blocked("provider_home_mount_authorization_invalid");
  }
  const grant = authorization.runtimeGrant.grant;
  return Object.freeze({
    ...blocked("provider_home_mount_authorization_ready"),
    status: "authorized" as const,
    grant,
    grantRef: grant.grantRef,
    providerHomeMountGrantIssued: true,
    mountAuthorizationIssued: true,
  });
}

/**
 * provider-home-mount-grant-runtimeを失効させる。
 *
 * @responsibility provider-home-mount-grant-runtimeの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown
 * @returns revokeの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown」がrevokeの入力契約を満たす。
 * @postcondition revokeの責務を完了した結果だけを返す。
 * @effect N/A: revokeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeは独自の失敗分岐を所有しない。
 * @invariant revokeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeはProcess内の同一Subsystemで完結する。
 * @security revokeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeは共有非同期状態を持たない同期処理である。
 */
function revoke(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const control = alias(state, controlCapability, "control");
  if (
    !control ||
    !sameManagementCapability(state, control.runtimeGrant, managementCapability)
  ) {
    return blocked("provider_home_mount_grant_runtime_control_invalid");
  }
  const runtimeGrant = control.runtimeGrant;
  if (runtimeGrant.mountActive) {
    return blocked("provider_home_mount_grant_runtime_unmount_required");
  }
  const now = state.wallNow();
  const next: Grant = Object.freeze({
    ...runtimeGrant.grant,
    state: "revoked",
    revokedAt: new Date(
      Math.max(now, Date.parse(runtimeGrant.grant.issuedAt as string)),
    ).toISOString(),
  });
  const transition = evaluateProviderHomeMountGrantTransitionCandidate({
    previous: runtimeGrant.grant,
    next,
  });
  if (transition.status !== "candidate") {
    return blocked("provider_home_mount_grant_runtime_revocation_invalid");
  }
  runtimeGrant.grant = transition.grant as Grant;
  revokeMountSource(state, runtimeGrant);
  revokeAllAliases(state, runtimeGrant);
  state.activeGrants.delete(runtimeGrant.grant.grantRef);
  const logicalHomeBinding = runtimeGrant.grant.stableLogicalHomeBindingHash;
  if (state.activeHomeBindings.get(logicalHomeBinding) === runtimeGrant)
    state.activeHomeBindings.delete(logicalHomeBinding);
  return Object.freeze({
    ...blocked("provider_home_mount_grant_runtime_revoked"),
    status: "revoked" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
  });
}

/**
 * Runtime 所有 Provider Home Mount Grantを発行する。
 *
 * @responsibility Runtime 所有 Provider Home Mount Grantの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000010
 * @input managementCapability: unknown、observationCapability: unknown、profileId: unknown
 * @returns issueRuntimeOwnedProviderHomeMountGrantの計算結果を返す。
 * @precondition 「managementCapability: unknown、observationCapability: unknown、profileId: unknown」がissueRuntimeOwnedProviderHomeMountGrantの入力契約を満たす。
 * @postcondition issueRuntimeOwnedProviderHomeMountGrantの責務を完了した結果だけを返す。
 * @effect N/A: issueRuntimeOwnedProviderHomeMountGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueRuntimeOwnedProviderHomeMountGrantは独自の失敗分岐を所有しない。
 * @invariant issueRuntimeOwnedProviderHomeMountGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueRuntimeOwnedProviderHomeMountGrantはProcess内の同一Subsystemで完結する。
 * @security issueRuntimeOwnedProviderHomeMountGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueRuntimeOwnedProviderHomeMountGrantは共有非同期状態を持たない同期処理である。
 */
export function issueRuntimeOwnedProviderHomeMountGrant(
  managementCapability: unknown,
  observationCapability: unknown,
  profileId: unknown,
) {
  return failClosed(
    "provider_home_mount_grant_runtime_issuance_failed_closed",
    () =>
      issue(
        productionState,
        managementCapability,
        observationCapability,
        profileId,
      ),
  );
}

/**
 * Runtime 所有 Provider Home Mount Grantを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Provider Home Mount Grantの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000010
 * @input useCapability: unknown、managementCapability: unknown、currentObservationCapability: unknown
 * @returns consumeRuntimeOwnedProviderHomeMountGrantの計算結果を返す。
 * @precondition 「useCapability: unknown、managementCapability: unknown、currentObservationCapability: unknown」がconsumeRuntimeOwnedProviderHomeMountGrantの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedProviderHomeMountGrantの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedProviderHomeMountGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeRuntimeOwnedProviderHomeMountGrantは独自の失敗分岐を所有しない。
 * @invariant consumeRuntimeOwnedProviderHomeMountGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeRuntimeOwnedProviderHomeMountGrantはProcess内の同一Subsystemで完結する。
 * @security consumeRuntimeOwnedProviderHomeMountGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedProviderHomeMountGrantは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedProviderHomeMountGrant(
  useCapability: unknown,
  managementCapability: unknown,
  currentObservationCapability: unknown,
) {
  return failClosed(
    "provider_home_mount_grant_runtime_consumption_failed_closed",
    () =>
      consume(
        productionState,
        useCapability,
        managementCapability,
        currentObservationCapability,
      ),
  );
}

/**
 * Runtime 所有 Provider Home Mount Authorizationを観測する。
 *
 * @responsibility Runtime 所有 Provider Home Mount Authorizationの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input mountAuthorizationCapability: unknown、managementCapability: unknown
 * @returns inspectRuntimeOwnedProviderHomeMountAuthorizationの計算結果を返す。
 * @precondition 「mountAuthorizationCapability: unknown、managementCapability: unknown」がinspectRuntimeOwnedProviderHomeMountAuthorizationの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedProviderHomeMountAuthorizationの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedProviderHomeMountAuthorizationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedProviderHomeMountAuthorizationは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedProviderHomeMountAuthorizationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedProviderHomeMountAuthorizationはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedProviderHomeMountAuthorizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedProviderHomeMountAuthorizationは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedProviderHomeMountAuthorization(
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed(
    "provider_home_mount_authorization_inspection_failed_closed",
    () =>
      inspectMountAuthorization(
        productionState,
        mountAuthorizationCapability,
        managementCapability,
      ),
  );
}

/**
 * Runtime 所有 Provider Home Mount Grantを失効させる。
 *
 * @responsibility Runtime 所有 Provider Home Mount Grantの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000010
 * @input controlCapability: unknown、managementCapability: unknown
 * @returns revokeRuntimeOwnedProviderHomeMountGrantの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown」がrevokeRuntimeOwnedProviderHomeMountGrantの入力契約を満たす。
 * @postcondition revokeRuntimeOwnedProviderHomeMountGrantの責務を完了した結果だけを返す。
 * @effect N/A: revokeRuntimeOwnedProviderHomeMountGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeRuntimeOwnedProviderHomeMountGrantは独自の失敗分岐を所有しない。
 * @invariant revokeRuntimeOwnedProviderHomeMountGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeRuntimeOwnedProviderHomeMountGrantはProcess内の同一Subsystemで完結する。
 * @security revokeRuntimeOwnedProviderHomeMountGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeRuntimeOwnedProviderHomeMountGrantは共有非同期状態を持たない同期処理である。
 */
export function revokeRuntimeOwnedProviderHomeMountGrant(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed(
    "provider_home_mount_grant_runtime_revocation_failed_closed",
    () => revoke(productionState, controlCapability, managementCapability),
  );
}

/**
 * Runtime 所有 Provider Home Mountを有効化する。
 *
 * @responsibility Runtime 所有 Provider Home Mountの有効化条件、状態遷移、失敗時の非発効境界を所有する。
 * @trace ARCH-000010
 * @input mountAuthorizationCapability: unknown、managementCapability: unknown
 * @returns activateRuntimeOwnedProviderHomeMountの計算結果を返す。
 * @precondition 「mountAuthorizationCapability: unknown、managementCapability: unknown」がactivateRuntimeOwnedProviderHomeMountの入力契約を満たす。
 * @postcondition activateRuntimeOwnedProviderHomeMountの責務を完了した結果だけを返す。
 * @effect N/A: activateRuntimeOwnedProviderHomeMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: activateRuntimeOwnedProviderHomeMountは独自の失敗分岐を所有しない。
 * @invariant activateRuntimeOwnedProviderHomeMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activateRuntimeOwnedProviderHomeMountはProcess内の同一Subsystemで完結する。
 * @security activateRuntimeOwnedProviderHomeMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activateRuntimeOwnedProviderHomeMountは共有非同期状態を持たない同期処理である。
 */
export function activateRuntimeOwnedProviderHomeMount(
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed("provider_home_mount_activation_failed_closed", () =>
    activateMount(
      productionState,
      mountAuthorizationCapability,
      managementCapability,
    ),
  );
}

/**
 * Runtime 所有 Active Provider Home Mount Sourceを一時参照として取得する。
 *
 * @responsibility Runtime 所有 Active Provider Home Mount Sourceの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000010
 * @input activeMountCapability: unknown、managementCapability: unknown
 * @returns borrowRuntimeOwnedActiveProviderHomeMountSourceの計算結果を返す。
 * @precondition 「activeMountCapability: unknown、managementCapability: unknown」がborrowRuntimeOwnedActiveProviderHomeMountSourceの入力契約を満たす。
 * @postcondition borrowRuntimeOwnedActiveProviderHomeMountSourceの責務を完了した結果だけを返す。
 * @effect N/A: borrowRuntimeOwnedActiveProviderHomeMountSourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure borrowRuntimeOwnedActiveProviderHomeMountSourceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant borrowRuntimeOwnedActiveProviderHomeMountSourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowRuntimeOwnedActiveProviderHomeMountSourceはProcess内の同一Subsystemで完結する。
 * @security borrowRuntimeOwnedActiveProviderHomeMountSourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowRuntimeOwnedActiveProviderHomeMountSourceは共有非同期状態を持たない同期処理である。
 */
export function borrowRuntimeOwnedActiveProviderHomeMountSource(
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return activeMountSource(
      productionState,
      activeMountCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Active Provider Home Mountを観測する。
 *
 * @responsibility Runtime 所有 Active Provider Home Mountの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input activeMountCapability: unknown、managementCapability: unknown
 * @returns inspectRuntimeOwnedActiveProviderHomeMountの計算結果を返す。
 * @precondition 「activeMountCapability: unknown、managementCapability: unknown」がinspectRuntimeOwnedActiveProviderHomeMountの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedActiveProviderHomeMountの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedActiveProviderHomeMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedActiveProviderHomeMountは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedActiveProviderHomeMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedActiveProviderHomeMountはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedActiveProviderHomeMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedActiveProviderHomeMountは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedActiveProviderHomeMount(
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed("provider_home_active_mount_inspection_failed_closed", () =>
    inspectActiveMount(
      productionState,
      activeMountCapability,
      managementCapability,
    ),
  );
}

/**
 * Runtime 所有 Provider Home Mountを完了状態へ遷移させる。
 *
 * @responsibility Runtime 所有 Provider Home Mountの完了条件、終了後状態、未完了境界を所有する。
 * @trace ARCH-000010
 * @input activeMountCapability: unknown、managementCapability: unknown
 * @returns completeRuntimeOwnedProviderHomeMountの計算結果を返す。
 * @precondition 「activeMountCapability: unknown、managementCapability: unknown」がcompleteRuntimeOwnedProviderHomeMountの入力契約を満たす。
 * @postcondition completeRuntimeOwnedProviderHomeMountの責務を完了した結果だけを返す。
 * @effect N/A: completeRuntimeOwnedProviderHomeMountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completeRuntimeOwnedProviderHomeMountは独自の失敗分岐を所有しない。
 * @invariant completeRuntimeOwnedProviderHomeMountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completeRuntimeOwnedProviderHomeMountはProcess内の同一Subsystemで完結する。
 * @security completeRuntimeOwnedProviderHomeMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completeRuntimeOwnedProviderHomeMountは共有非同期状態を持たない同期処理である。
 */
export function completeRuntimeOwnedProviderHomeMount(
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed("provider_home_mount_completion_failed_closed", () =>
    completeMount(productionState, activeMountCapability, managementCapability),
  );
}

/**
 * Isolated Provider Home Mount Grant Runtime 候補を構築する。
 *
 * @responsibility Isolated Provider Home Mount Grant Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input dependencies: Readonly<{ verifyOperation: RuntimeState["verifyOperation"]; consumeObservation: RuntimeState["consumeObservation"]; consumeMountSource: RuntimeState["consumeMountSource"]; revokeMountSource: RuntimeState["revokeMountSource"]; wallNow: RuntimeState["wallNow"]; monotonicNow: RuntimeState["monotonicNow"]; randomBytes: RuntimeState["randomBytes"]; }>
 * @returns createIsolatedProviderHomeMountGrantRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: Readonly<{ verifyOperation: RuntimeState["verifyOperation"]; consumeObservation: RuntimeState["consumeObservation"]; consumeMountSource: RuntimeState["consumeMountSource"]; revokeMountSource: RuntimeState["revokeMountSource"]; wallNow: RuntimeState["wallNow"]; monotonicNow: RuntimeState["monotonicNow"]; randomBytes: RuntimeState["randomBytes"]; }>」がcreateIsolatedProviderHomeMountGrantRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedProviderHomeMountGrantRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedProviderHomeMountGrantRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedProviderHomeMountGrantRuntimeCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedProviderHomeMountGrantRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedProviderHomeMountGrantRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedProviderHomeMountGrantRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedProviderHomeMountGrantRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedProviderHomeMountGrantRuntimeCandidate(
  dependencies: Readonly<{
    verifyOperation: RuntimeState["verifyOperation"];
    consumeObservation: RuntimeState["consumeObservation"];
    consumeMountSource: RuntimeState["consumeMountSource"];
    revokeMountSource: RuntimeState["revokeMountSource"];
    wallNow: RuntimeState["wallNow"];
    monotonicNow: RuntimeState["monotonicNow"];
    randomBytes: RuntimeState["randomBytes"];
  }>,
) {
  const state = createRuntimeState({ ...dependencies, production: false });
  return Object.freeze({
    productionAuthority: false as const,
    issue: (
      managementCapability: unknown,
      observationCapability: unknown,
      profileId: unknown,
    ) =>
      failClosed(
        "provider_home_mount_grant_runtime_issuance_failed_closed",
        () =>
          issue(state, managementCapability, observationCapability, profileId),
      ),
    consume: (
      useCapability: unknown,
      managementCapability: unknown,
      currentObservationCapability: unknown,
    ) =>
      failClosed(
        "provider_home_mount_grant_runtime_consumption_failed_closed",
        () =>
          consume(
            state,
            useCapability,
            managementCapability,
            currentObservationCapability,
          ),
      ),
    inspectMountAuthorization: (
      mountAuthorizationCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed(
        "provider_home_mount_authorization_inspection_failed_closed",
        () =>
          inspectMountAuthorization(
            state,
            mountAuthorizationCapability,
            managementCapability,
          ),
      ),
    activateMount: (
      mountAuthorizationCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed("provider_home_mount_activation_failed_closed", () =>
        activateMount(
          state,
          mountAuthorizationCapability,
          managementCapability,
        ),
      ),
    borrowActiveMountSource: (
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) => {
      try {
        return activeMountSource(
          state,
          activeMountCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
    inspectActiveMount: (
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed("provider_home_active_mount_inspection_failed_closed", () =>
        inspectActiveMount(state, activeMountCapability, managementCapability),
      ),
    completeMount: (
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed("provider_home_mount_completion_failed_closed", () =>
        completeMount(state, activeMountCapability, managementCapability),
      ),
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      failClosed(
        "provider_home_mount_grant_runtime_revocation_failed_closed",
        () => revoke(state, controlCapability, managementCapability),
      ),
  });
}

/**
 * Provider Home Mount Grant Runtime 契約の公開契約を記述する。
 *
 * @responsibility Provider Home Mount Grant Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderHomeMountGrantRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderHomeMountGrantRuntimeContractの入力契約を満たす。
 * @postcondition describeProviderHomeMountGrantRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderHomeMountGrantRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderHomeMountGrantRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderHomeMountGrantRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderHomeMountGrantRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderHomeMountGrantRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderHomeMountGrantRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderHomeMountGrantRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT_REVISION,
    store: "process_local_atomic_map_plus_durable_runtime_state_lease",
    clock: "runtime_owned_wall_and_monotonic",
    referenceSource: "runtime_owned_cryptographic_random_18_decimal_digits",
    observationInput: "opaque_single_use_runtime_owned_capability",
    operationInput: "opaque_runtime_owned_management_capability",
    aliases: Object.freeze([
      "control",
      "use",
      "mount_authorization",
      "active_mount",
    ]),
    controlAndUseAliasesSeparated: true,
    allAliasesRevokedTogether: true,
    lifetimeMs: PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
    usageLimit: 1,
    processRestartBehavior: "all_grants_lost_fail_closed",
    crashRecovery:
      "mounted_container_and_operation_cleanup_owned_by_docker_recovery_contract",
    callerSuppliedClockAccepted: false,
    callerSuppliedOperationIdAccepted: false,
    callerSuppliedObservationHashAccepted: false,
    pathReported: false,
    credentialReported: false,
    activeMountSourceLease:
      "implemented_opaque_internal_docker_adapter_handoff_candidate",
    activeMountAuthorityInspection:
      "implemented_runtime_owned_metadata_only_no_path_or_credential",
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    isolatedTestRuntimeCapabilitiesAcceptedByProduction: false,
  });
}
