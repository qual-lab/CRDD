import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import { reverifyAuthorityBeforeProviderLaunch } from "./authority-prelaunch-verifier.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { loadRuntimeOwnedLocalPersonalAuthority } from "./local-personal-authority-runtime.ts";
import { inspectRuntimeOwnedActiveProviderHomeMount } from "./provider-home-mount-grant-runtime.ts";

export const PROVIDER_AUTHORITY_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-authority-runtime";
export const PROVIDER_AUTHORITY_RUNTIME_CONTRACT_REVISION = 2;

const AUTHORITY_LIFETIME_MS = 5_000;
const AUTHORITY_RECORD_ID_BYTES = 12;
const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;

/**
 * OperationBindingが扱う値の構造を表す。
 *
 * @responsibility OperationBindingに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape OperationBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationBindingの宣言は外部境界を開かない。
 * @security OperationBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationBinding = Readonly<{
  operationId: string;
  createdAt: string;
}>;
/**
 * ActiveMountが扱う値の構造を表す。
 *
 * @responsibility ActiveMountに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ActiveMountが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ActiveMountで宣言した値と責務の対応を維持する。
 * @boundary N/A: ActiveMountの宣言は外部境界を開かない。
 * @security ActiveMountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ActiveMountの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ActiveMount = Readonly<{
  status: string;
  grantRef: string | null;
  provider?: string;
  profileId?: string;
  operationId?: string;
  providerHomeMountGrantIssued: boolean;
  providerHomeMounted: boolean;
}>;
/**
 * ActivatedAuthoritySourceが扱う値の構造を表す。
 *
 * @responsibility ActivatedAuthoritySourceに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ActivatedAuthoritySourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ActivatedAuthoritySourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: ActivatedAuthoritySourceの宣言は外部境界を開かない。
 * @security ActivatedAuthoritySourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ActivatedAuthoritySourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ActivatedAuthoritySource = Readonly<{
  profile: unknown;
  bundle: unknown;
  scopeId: string;
}>;
/**
 * Verificationが扱う値の構造を表す。
 *
 * @responsibility Verificationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Verificationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Verificationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Verificationの宣言は外部境界を開かない。
 * @security VerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Verificationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Verification = Readonly<{
  profileHash: string;
  registryId: string;
  registryRevision: number;
  registryHash: string;
  grantRef: string;
  grantRevision: number;
  provider: string;
  profileId: string;
  operationId: string;
  scopeId: string;
  providerHomeMountGrantRef: string;
  bundleId: string;
  bundleRevision: number;
  bundleHash: string;
  trustPolicyId: string;
  trustPolicyRevision: number;
  trustPolicyHash: string;
  validUntil: string;
}>;
/**
 * AuthorityRecordが扱う値の構造を表す。
 *
 * @responsibility AuthorityRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape AuthorityRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AuthorityRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: AuthorityRecordの宣言は外部境界を開かない。
 * @security AuthorityRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility AuthorityRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AuthorityRecord = Readonly<{
  authorityRecordId: string;
  managementCapability: object;
  activeMountCapability: object;
  operation: OperationBinding;
  mount: ActiveMount;
  verification: Verification;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
  controlCapability: object;
  useCapability: object;
}>;
/**
 * RuntimeStateが扱う値の構造を表す。
 *
 * @responsibility RuntimeStateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  records: Map<string, AuthorityRecord>;
  controlCapabilities: WeakMap<object, string>;
  useCapabilities: WeakMap<object, string>;
  verifyOperation: (capability: unknown) => OperationBinding;
  inspectActiveMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => ActiveMount;
  loadActivatedAuthority: (
    binding: Readonly<{
      operationId: string;
      provider: string;
      profileId: string;
    }>,
    managementCapability?: unknown,
  ) => ActivatedAuthoritySource | null;
  reverify: typeof reverifyAuthorityBeforeProviderLaunch;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
}>;

/**
 * createRuntimeStateの処理を実行する。
 *
 * @responsibility createRuntimeStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >
 * @returns RuntimeStateを返す。
 * @precondition 「dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >」がcreateRuntimeStateの入力契約を満たす。
 * @postcondition createRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant createRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security createRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function createRuntimeState(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
): RuntimeState {
  return Object.freeze({
    records: new Map(),
    controlCapabilities: new WeakMap(),
    useCapabilities: new WeakMap(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperation: verifyOwnedOperationManagementCapability,
  inspectActiveMount: inspectRuntimeOwnedActiveProviderHomeMount,
  loadActivatedAuthority: loadRuntimeOwnedLocalPersonalAuthority,
  reverify: reverifyAuthorityBeforeProviderLaunch,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
});

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
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
    authorityRecordId: null,
    controlCapability: null,
    useCapability: null,
    operationId: null,
    provider: null,
    profileId: null,
    scopeId: null,
    providerHomeMountGrantRef: null,
    runtimeAuthorityIssued: false,
    providerEffectAllowed: false,
    rawAuthoritySourceReported: false,
    pathReported: false,
    credentialReported: false,
  });
}

/**
 * performSafelyの処理を実行する。
 *
 * @responsibility performSafelyに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input reason: string、action: () => T
 * @returns performSafelyの計算結果を返す。
 * @precondition 「reason: string、action: () => T」がperformSafelyの入力契約を満たす。
 * @postcondition performSafelyの責務を完了した結果だけを返す。
 * @effect N/A: performSafelyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure performSafelyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant performSafelyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: performSafelyはProcess内の同一Subsystemで完結する。
 * @security performSafelyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: performSafelyは共有非同期状態を持たない同期処理である。
 */
function performSafely<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return blocked(reason);
  }
}

/**
 * removeRecordの処理を実行する。
 *
 * @responsibility removeRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、record: AuthorityRecord
 * @returns N/A: removeRecordは戻り値を返さない。
 * @precondition 「state: RuntimeState、record: AuthorityRecord」がremoveRecordの入力契約を満たす。
 * @postcondition removeRecordの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: removeRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: removeRecordは独自の失敗分岐を所有しない。
 * @invariant removeRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: removeRecordはProcess内の同一Subsystemで完結する。
 * @security removeRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeRecordは共有非同期状態を持たない同期処理である。
 */
function removeRecord(state: RuntimeState, record: AuthorityRecord) {
  state.records.delete(record.authorityRecordId);
  state.controlCapabilities.delete(record.controlCapability);
  state.useCapabilities.delete(record.useCapability);
}

/**
 * isMountValidの処理を実行する。
 *
 * @responsibility isMountValidに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input mount: ActiveMount、operation: OperationBinding
 * @returns isMountValidの計算結果を返す。
 * @precondition 「mount: ActiveMount、operation: OperationBinding」がisMountValidの入力契約を満たす。
 * @postcondition isMountValidの責務を完了した結果だけを返す。
 * @effect N/A: isMountValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isMountValidは独自の失敗分岐を所有しない。
 * @invariant isMountValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isMountValidはProcess内の同一Subsystemで完結する。
 * @security isMountValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isMountValidは共有非同期状態を持たない同期処理である。
 */
function isMountValid(mount: ActiveMount, operation: OperationBinding) {
  return (
    mount.status === "active" &&
    mount.providerHomeMountGrantIssued === true &&
    mount.providerHomeMounted === true &&
    typeof mount.grantRef === "string" &&
    (mount.provider === "codex" || mount.provider === "claude") &&
    typeof mount.profileId === "string" &&
    typeof mount.operationId === "string" &&
    mount.operationId === operation.operationId
  );
}

/**
 * normalizeVerificationの処理を実行する。
 *
 * @responsibility normalizeVerificationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns Verification | nullを返す。
 * @precondition 「candidate: unknown」がnormalizeVerificationの入力契約を満たす。
 * @postcondition normalizeVerificationの責務を完了した結果だけを返す。
 * @effect N/A: normalizeVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeVerificationは独自の失敗分岐を所有しない。
 * @invariant normalizeVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeVerificationはProcess内の同一Subsystemで完結する。
 * @security normalizeVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeVerificationは共有非同期状態を持たない同期処理である。
 */
function normalizeVerification(candidate: unknown): Verification | null {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Record<string, unknown>;
  const stringKeys = [
    "profileHash",
    "registryId",
    "registryHash",
    "grantRef",
    "provider",
    "profileId",
    "operationId",
    "scopeId",
    "providerHomeMountGrantRef",
    "bundleId",
    "bundleHash",
    "trustPolicyId",
    "trustPolicyHash",
    "validUntil",
  ];
  const numberKeys = [
    "registryRevision",
    "grantRevision",
    "bundleRevision",
    "trustPolicyRevision",
  ];
  if (
    stringKeys.some(
      (key) =>
        !Object.hasOwn(value, key) ||
        typeof value[key] !== "string" ||
        (value[key] as string).length === 0,
    ) ||
    numberKeys.some(
      (key) =>
        !Object.hasOwn(value, key) ||
        typeof value[key] !== "number" ||
        !Number.isSafeInteger(value[key]) ||
        (value[key] as number) < 1,
    ) ||
    !SCOPE_ID.test(value.scopeId as string)
  ) {
    return null;
  }
  return Object.freeze(
    Object.fromEntries(
      [...stringKeys, ...numberKeys].map((key) => [key, value[key]]),
    ),
  ) as Verification;
}

/**
 * reverifyCurrentAuthorityの処理を実行する。
 *
 * @responsibility reverifyCurrentAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、operation: OperationBinding、mount: ActiveMount、managementCapability: unknown
 * @returns reverifyCurrentAuthorityの計算結果を返す。
 * @precondition 「state: RuntimeState、operation: OperationBinding、mount: ActiveMount、managementCapability: unknown」がreverifyCurrentAuthorityの入力契約を満たす。
 * @postcondition reverifyCurrentAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: reverifyCurrentAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reverifyCurrentAuthorityは独自の失敗分岐を所有しない。
 * @invariant reverifyCurrentAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reverifyCurrentAuthorityはProcess内の同一Subsystemで完結する。
 * @security reverifyCurrentAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reverifyCurrentAuthorityは共有非同期状態を持たない同期処理である。
 */
function reverifyCurrentAuthority(
  state: RuntimeState,
  operation: OperationBinding,
  mount: ActiveMount,
  managementCapability: unknown,
) {
  if (!isMountValid(mount, operation)) return null;
  const source = state.loadActivatedAuthority(
    {
      operationId: operation.operationId,
      provider: mount.provider as string,
      profileId: mount.profileId as string,
    },
    managementCapability,
  );
  if (!source || !SCOPE_ID.test(source.scopeId)) return null;
  const result = state.reverify(source.profile, source.bundle, {
    provider: mount.provider,
    profileId: mount.profileId,
    operationId: operation.operationId,
    scopeId: source.scopeId,
    providerHomeMountGrantRef: mount.grantRef,
  });
  if (result.status !== "candidate" || !result.verification) return null;
  const verification = normalizeVerification(result.verification);
  if (
    !verification ||
    verification.provider !== mount.provider ||
    verification.profileId !== mount.profileId ||
    verification.operationId !== operation.operationId ||
    verification.scopeId !== source.scopeId ||
    verification.providerHomeMountGrantRef !== mount.grantRef
  ) {
    return null;
  }
  return verification;
}

/**
 * verificationIdentityの処理を実行する。
 *
 * @responsibility verificationIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input verification: Verification
 * @returns verificationIdentityの計算結果を返す。
 * @precondition 「verification: Verification」がverificationIdentityの入力契約を満たす。
 * @postcondition verificationIdentityの責務を完了した結果だけを返す。
 * @effect N/A: verificationIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verificationIdentityは独自の失敗分岐を所有しない。
 * @invariant verificationIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verificationIdentityはProcess内の同一Subsystemで完結する。
 * @security verificationIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verificationIdentityは共有非同期状態を持たない同期処理である。
 */
function verificationIdentity(verification: Verification) {
  return JSON.stringify({
    profileHash: verification.profileHash,
    registryId: verification.registryId,
    registryRevision: verification.registryRevision,
    registryHash: verification.registryHash,
    grantRef: verification.grantRef,
    grantRevision: verification.grantRevision,
    provider: verification.provider,
    profileId: verification.profileId,
    operationId: verification.operationId,
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    bundleId: verification.bundleId,
    bundleRevision: verification.bundleRevision,
    bundleHash: verification.bundleHash,
    trustPolicyId: verification.trustPolicyId,
    trustPolicyRevision: verification.trustPolicyRevision,
    trustPolicyHash: verification.trustPolicyHash,
    validUntil: verification.validUntil,
  });
}

/**
 * isFreshの処理を実行する。
 *
 * @responsibility isFreshに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、record: AuthorityRecord
 * @returns isFreshの計算結果を返す。
 * @precondition 「state: RuntimeState、record: AuthorityRecord」がisFreshの入力契約を満たす。
 * @postcondition isFreshの責務を完了した結果だけを返す。
 * @effect N/A: isFreshは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isFreshは独自の失敗分岐を所有しない。
 * @invariant isFreshは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isFreshはProcess内の同一Subsystemで完結する。
 * @security isFreshはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isFreshは共有非同期状態を持たない同期処理である。
 */
function isFresh(state: RuntimeState, record: AuthorityRecord) {
  const wallAge = state.wallNow() - record.issuedWallClockMs;
  const monotonicAge = state.monotonicNow() - record.issuedMonotonicMs;
  return (
    Number.isFinite(wallAge) &&
    Number.isFinite(monotonicAge) &&
    wallAge >= 0 &&
    monotonicAge >= 0 &&
    wallAge < AUTHORITY_LIFETIME_MS &&
    monotonicAge < AUTHORITY_LIFETIME_MS
  );
}

/**
 * issueAuthorityの処理を実行する。
 *
 * @responsibility issueAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、managementCapability: unknown、activeMountCapability: unknown
 * @returns issueAuthorityの計算結果を返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown、activeMountCapability: unknown」がissueAuthorityの入力契約を満たす。
 * @postcondition issueAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: issueAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueAuthorityは独自の失敗分岐を所有しない。
 * @invariant issueAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueAuthorityはProcess内の同一Subsystemで完結する。
 * @security issueAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueAuthorityは共有非同期状態を持たない同期処理である。
 */
function issueAuthority(
  state: RuntimeState,
  managementCapability: unknown,
  activeMountCapability: unknown,
) {
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !activeMountCapability ||
    typeof activeMountCapability !== "object"
  ) {
    return blocked("provider_authority_binding_invalid");
  }
  const operation = state.verifyOperation(managementCapability);
  const mount = state.inspectActiveMount(
    activeMountCapability,
    managementCapability,
  );
  const verification = reverifyCurrentAuthority(
    state,
    operation,
    mount,
    managementCapability,
  );
  const issuedWallClockMs = state.wallNow();
  const issuedMonotonicMs = state.monotonicNow();
  const identifierBytes = state.randomBytes(AUTHORITY_RECORD_ID_BYTES);
  if (
    !verification ||
    !Number.isFinite(issuedWallClockMs) ||
    !Number.isFinite(issuedMonotonicMs) ||
    issuedWallClockMs < 0 ||
    issuedMonotonicMs < 0 ||
    !Buffer.isBuffer(identifierBytes) ||
    identifierBytes.byteLength !== AUTHORITY_RECORD_ID_BYTES
  ) {
    return blocked("provider_authority_prelaunch_verification_invalid");
  }
  const authorityRecordId = `PROVAUTH-${identifierBytes.toString("hex").toUpperCase()}`;
  if (state.records.has(authorityRecordId))
    return blocked("provider_authority_runtime_state_invalid");
  const controlCapability = Object.freeze({});
  const useCapability = Object.freeze({});
  const record: AuthorityRecord = Object.freeze({
    authorityRecordId,
    managementCapability,
    activeMountCapability,
    operation,
    mount,
    verification,
    issuedWallClockMs,
    issuedMonotonicMs,
    controlCapability,
    useCapability,
  });
  state.records.set(authorityRecordId, record);
  state.controlCapabilities.set(controlCapability, authorityRecordId);
  state.useCapabilities.set(useCapability, authorityRecordId);
  return Object.freeze({
    ...blocked("provider_authority_issued"),
    status: "issued" as const,
    reason: "provider_authority_issued",
    authorityRecordId,
    controlCapability,
    useCapability,
    operationId: verification.operationId,
    provider: verification.provider,
    profileId: verification.profileId,
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    runtimeAuthorityIssued: true,
    expiresInMs: AUTHORITY_LIFETIME_MS,
  });
}

/**
 * findRecordの処理を実行する。
 *
 * @responsibility findRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、capability: unknown、aliases: WeakMap<object, string>、managementCapability: unknown
 * @returns findRecordの計算結果を返す。
 * @precondition 「state: RuntimeState、capability: unknown、aliases: WeakMap<object, string>、managementCapability: unknown」がfindRecordの入力契約を満たす。
 * @postcondition findRecordの責務を完了した結果だけを返す。
 * @effect N/A: findRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: findRecordは独自の失敗分岐を所有しない。
 * @invariant findRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: findRecordはProcess内の同一Subsystemで完結する。
 * @security findRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: findRecordは共有非同期状態を持たない同期処理である。
 */
function findRecord(
  state: RuntimeState,
  capability: unknown,
  aliases: WeakMap<object, string>,
  managementCapability: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const identifier = aliases.get(capability);
  const record = identifier ? state.records.get(identifier) : null;
  return record?.managementCapability === managementCapability ? record : null;
}

/**
 * consumeAuthorityの処理を実行する。
 *
 * @responsibility consumeAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、useCapability: unknown、activeMountCapability: unknown、managementCapability: unknown
 * @returns consumeAuthorityの計算結果を返す。
 * @precondition 「state: RuntimeState、useCapability: unknown、activeMountCapability: unknown、managementCapability: unknown」がconsumeAuthorityの入力契約を満たす。
 * @postcondition consumeAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: consumeAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeAuthorityは独自の失敗分岐を所有しない。
 * @invariant consumeAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeAuthorityはProcess内の同一Subsystemで完結する。
 * @security consumeAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeAuthorityは共有非同期状態を持たない同期処理である。
 */
function consumeAuthority(
  state: RuntimeState,
  useCapability: unknown,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const record = findRecord(
    state,
    useCapability,
    state.useCapabilities,
    managementCapability,
  );
  if (
    !record ||
    record.activeMountCapability !== activeMountCapability ||
    !isFresh(state, record)
  ) {
    if (record) removeRecord(state, record);
    return null;
  }
  const operation = state.verifyOperation(managementCapability);
  const mount = state.inspectActiveMount(
    activeMountCapability,
    managementCapability,
  );
  const verification = reverifyCurrentAuthority(
    state,
    operation,
    mount,
    managementCapability,
  );
  removeRecord(state, record);
  if (
    !verification ||
    verificationIdentity(verification) !==
      verificationIdentity(record.verification)
  ) {
    return null;
  }
  return Object.freeze({
    authorityRecordId: record.authorityRecordId,
    operationId: verification.operationId,
    provider: verification.provider,
    profileId: verification.profileId,
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    runtimeAuthorityIssued: true as const,
    providerEffectAllowed: true as const,
  });
}

/**
 * revokeAuthorityの処理を実行する。
 *
 * @responsibility revokeAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown
 * @returns revokeAuthorityの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown」がrevokeAuthorityの入力契約を満たす。
 * @postcondition revokeAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: revokeAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeAuthorityは独自の失敗分岐を所有しない。
 * @invariant revokeAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeAuthorityはProcess内の同一Subsystemで完結する。
 * @security revokeAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeAuthorityは共有非同期状態を持たない同期処理である。
 */
function revokeAuthority(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const record = findRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!record) return blocked("provider_authority_control_invalid");
  removeRecord(state, record);
  return Object.freeze({
    ...blocked("provider_authority_revoked"),
    status: "revoked" as const,
    reason: "provider_authority_revoked",
    authorityRecordId: record.authorityRecordId,
    operationId: record.operation.operationId,
  });
}

/**
 * issueRuntimeOwnedProviderAuthorityの処理を実行する。
 *
 * @responsibility issueRuntimeOwnedProviderAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input managementCapability: unknown、activeMountCapability: unknown
 * @returns issueRuntimeOwnedProviderAuthorityの計算結果を返す。
 * @precondition 「managementCapability: unknown、activeMountCapability: unknown」がissueRuntimeOwnedProviderAuthorityの入力契約を満たす。
 * @postcondition issueRuntimeOwnedProviderAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: issueRuntimeOwnedProviderAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueRuntimeOwnedProviderAuthorityは独自の失敗分岐を所有しない。
 * @invariant issueRuntimeOwnedProviderAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueRuntimeOwnedProviderAuthorityはProcess内の同一Subsystemで完結する。
 * @security issueRuntimeOwnedProviderAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueRuntimeOwnedProviderAuthorityは共有非同期状態を持たない同期処理である。
 */
export function issueRuntimeOwnedProviderAuthority(
  managementCapability: unknown,
  activeMountCapability: unknown,
) {
  return performSafely("provider_authority_issue_failed_closed", () =>
    issueAuthority(
      productionState,
      managementCapability,
      activeMountCapability,
    ),
  );
}

/**
 * consumeRuntimeOwnedProviderAuthorityの処理を実行する。
 *
 * @responsibility consumeRuntimeOwnedProviderAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input useCapability: unknown、activeMountCapability: unknown、managementCapability: unknown
 * @returns consumeRuntimeOwnedProviderAuthorityの計算結果を返す。
 * @precondition 「useCapability: unknown、activeMountCapability: unknown、managementCapability: unknown」がconsumeRuntimeOwnedProviderAuthorityの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedProviderAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedProviderAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeRuntimeOwnedProviderAuthorityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeRuntimeOwnedProviderAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeRuntimeOwnedProviderAuthorityはProcess内の同一Subsystemで完結する。
 * @security consumeRuntimeOwnedProviderAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedProviderAuthorityは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedProviderAuthority(
  useCapability: unknown,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return consumeAuthority(
      productionState,
      useCapability,
      activeMountCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

/**
 * revokeRuntimeOwnedProviderAuthorityの処理を実行する。
 *
 * @responsibility revokeRuntimeOwnedProviderAuthorityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input controlCapability: unknown、managementCapability: unknown
 * @returns revokeRuntimeOwnedProviderAuthorityの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown」がrevokeRuntimeOwnedProviderAuthorityの入力契約を満たす。
 * @postcondition revokeRuntimeOwnedProviderAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: revokeRuntimeOwnedProviderAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeRuntimeOwnedProviderAuthorityは独自の失敗分岐を所有しない。
 * @invariant revokeRuntimeOwnedProviderAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeRuntimeOwnedProviderAuthorityはProcess内の同一Subsystemで完結する。
 * @security revokeRuntimeOwnedProviderAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeRuntimeOwnedProviderAuthorityは共有非同期状態を持たない同期処理である。
 */
export function revokeRuntimeOwnedProviderAuthority(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return performSafely("provider_authority_revoke_failed_closed", () =>
    revokeAuthority(productionState, controlCapability, managementCapability),
  );
}

/**
 * createIsolatedProviderAuthorityRuntimeCandidateの処理を実行する。
 *
 * @responsibility createIsolatedProviderAuthorityRuntimeCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >
 * @returns createIsolatedProviderAuthorityRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >」がcreateIsolatedProviderAuthorityRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedProviderAuthorityRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedProviderAuthorityRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedProviderAuthorityRuntimeCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedProviderAuthorityRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedProviderAuthorityRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedProviderAuthorityRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedProviderAuthorityRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedProviderAuthorityRuntimeCandidate(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    issue: (managementCapability: unknown, activeMountCapability: unknown) =>
      performSafely("provider_authority_issue_failed_closed", () =>
        issueAuthority(state, managementCapability, activeMountCapability),
      ),
    consume: (
      useCapability: unknown,
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) => {
      try {
        return consumeAuthority(
          state,
          useCapability,
          activeMountCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      performSafely("provider_authority_revoke_failed_closed", () =>
        revokeAuthority(state, controlCapability, managementCapability),
      ),
  });
}

/**
 * describeProviderAuthorityRuntimeContractの処理を実行する。
 *
 * @responsibility describeProviderAuthorityRuntimeContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderAuthorityRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderAuthorityRuntimeContractの入力契約を満たす。
 * @postcondition describeProviderAuthorityRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderAuthorityRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderAuthorityRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderAuthorityRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderAuthorityRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderAuthorityRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderAuthorityRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderAuthorityRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_AUTHORITY_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_AUTHORITY_RUNTIME_CONTRACT_REVISION,
    authorityLifetimeMs: AUTHORITY_LIFETIME_MS,
    aliases: Object.freeze(["control", "use"]),
    maximumUses: 1,
    mountRequirement:
      "signed_static_runtime_owned_active_requirement_bound_to_dynamic_grant_at_prelaunch",
    reverification: "issue_and_consume_immediately_before_provider_effect",
    sourceChange: "invalidates_capability_fail_closed",
    providerEffectAllowedBeforeConsume: false,
    rawAuthoritySourceReported: false,
    pathReported: false,
    credentialReported: false,
    productionActivatedAuthoritySourceLoader:
      "signed_release_bound_local_personal_connected",
  });
}
