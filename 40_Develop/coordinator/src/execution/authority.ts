/**
 * 実行許可とRepository・Provider Homeの保護境界を検査する。
 *
 * @responsibility 元のGrant発行・消費・失効とRoot・Home相関を維持する。
 * @trace ARCH-000008
 */

import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
import {
  PROVIDER_INPUT_LIMITS,
  validateProviderIsolationProfile,
  PROVIDER_ISOLATION_CONTRACT,
  PROVIDER_ISOLATION_CONTRACT_REVISION,
} from "./preparation.ts";
import { createHash, randomBytes } from "node:crypto";
import { types as utilTypes } from "node:util";
import {
  verifyOwnedOperationManagementCapability,
  verifyRuntimeOwnedRepositoryOperation,
} from "./operation.ts";
import { performance } from "node:perf_hooks";
import { observeRuntimeOwnedProviderEligibility } from "./observation.ts";
import {
  resolveAiModelSelection,
  describeProviderAuthentication,
  evaluateProviderAuthentication,
} from "../../../ai-adapter/src/index.ts";
import {
  inspectRuntimeOwnedDevelopmentOperationContext,
  borrowRuntimeOwnedDevelopmentNativeObservation,
} from "./diagnostics.ts";
import path from "node:path";
import {
  observeWindowsRuntimeState,
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  type ProviderHomeObservationProvider,
  observeWindowsProviderHome,
  describeProviderHomeObservationContract,
} from "../../../platform-access/src/index.ts";
import {
  type DockerAuthenticationPlan,
  createDockerAuthenticationRuntimeFactory,
  planDockerAuthenticationResourceRecovery,
  describeDockerProxyTopology,
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
  planDockerAuthenticationCommands,
} from "../../../docker-isolation/src/index.ts";
import {
  inspectExecutionSelection,
  inspectTaskExecutionSelections,
  hashExecutionSelection,
  type ExecutionSelection,
} from "../selection/model.ts";
import fs from "node:fs";
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "./kernel-lock.ts";

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
 * authority-file-bundleを停止結果として構築する。
 *
 * @responsibility authority-file-bundleの停止理由、未発行Effect、公開結果境界を所有する。
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
    throw new Error("authority_file_bundle_json_invalid");
  return serialized;
}

/**
 * Manifestを検証済み値へ復号する。
 *
 * @responsibility Manifestの入力形式、復号結果、不正byte列の拒否境界を所有する。
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
 * Authority File Bundle 候補を読み込む。
 *
 * @responsibility Authority File Bundle 候補の読取り元、Schema検証、読取不能時の拒否境界を所有する。
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
 * Authority File Bundle 契約の公開契約を記述する。
 *
 * @responsibility Authority File Bundle 契約の公開field、非公開境界、互換性を所有する。
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

export const PROVIDER_AUTHORITY_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-authority-runtime";

export const PROVIDER_AUTHORITY_RUNTIME_CONTRACT_REVISION = 3;

const AUTHORITY_LIFETIME_MS = 5_000;

const AUTHORITY_RECORD_ID_BYTES = 12;

const SCOPE_ID = /^SCOPE-[0-9]{6,}$/u;

/**
 * provider-authority-runtimeで使用するOperation Bindingの値契約を定義する。
 *
 * @responsibility Operation BindingのProperty、Identity、状態制約を型境界として所有する。
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
 * provider-authority-runtimeで使用するActive Mountの値契約を定義する。
 *
 * @responsibility Active MountのProperty、Identity、状態制約を型境界として所有する。
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
  operationId?: string;
  providerHomeMountGrantIssued: boolean;
  providerHomeMounted: boolean;
}>;

/**
 * provider-authority-runtimeで使用するActivated Authority Sourceの値契約を定義する。
 *
 * @responsibility Activated Authority SourceのProperty、Identity、状態制約を型境界として所有する。
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
 * provider-authority-runtimeで使用するVerificationの値契約を定義する。
 *
 * @responsibility VerificationのProperty、Identity、状態制約を型境界として所有する。
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
 * provider-authority-runtimeで使用するAuthority 記録の値契約を定義する。
 *
 * @responsibility Authority 記録のProperty、Identity、状態制約を型境界として所有する。
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
 * provider-authority-runtimeで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
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
    }>,
    managementCapability: unknown,
  ) => ActivatedAuthoritySource | null;
  reverify: typeof reverifyAuthorityBeforeProviderLaunch;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
}>;

/**
 * Runtime 状態を構築する。
 *
 * @responsibility Runtime 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
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
 * provider-authority-runtimeを停止結果として構築する。
 *
 * @responsibility provider-authority-runtimeの停止理由、未発行Effect、公開結果境界を所有する。
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
function authorityGrantBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    authorityRecordId: null,
    controlCapability: null,
    useCapability: null,
    operationId: null,
    provider: null,
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
 * Safelyを安全に実行する。
 *
 * @responsibility Safelyの実行条件、Effect範囲、失敗時の終了境界を所有する。
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
    return authorityGrantBlocked(reason);
  }
}

/**
 * 記録を除去する。
 *
 * @responsibility 記録の対象Identity、除去条件、終了後状態の境界を所有する。
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
 * Mount Validかを判定する。
 *
 * @responsibility Mount Validの判定条件とtrue／false境界を所有する。
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
    typeof mount.operationId === "string" &&
    mount.operationId === operation.operationId
  );
}

/**
 * Verificationを固定Schemaへ正規化する。
 *
 * @responsibility Verificationの入力検証、正規化規則、不正値の拒否境界を所有する。
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
  if (Object.hasOwn(value, "profileId")) return null;
  const stringKeys = [
    "profileHash",
    "registryId",
    "registryHash",
    "grantRef",
    "provider",
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
 * reverify Current Authorityを決定する。
 *
 * @responsibility reverify Current Authorityの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
    },
    managementCapability,
  );
  if (!source || !SCOPE_ID.test(source.scopeId)) return null;
  const result = state.reverify(source.profile, source.bundle, {
    provider: mount.provider,
    operationId: operation.operationId,
    scopeId: source.scopeId,
    providerHomeMountGrantRef: mount.grantRef,
  });
  if (result.status !== "candidate" || !result.verification) return null;
  const verification = normalizeVerification(result.verification);
  if (
    !verification ||
    verification.provider !== mount.provider ||
    verification.operationId !== operation.operationId ||
    verification.scopeId !== source.scopeId ||
    verification.providerHomeMountGrantRef !== mount.grantRef
  ) {
    return null;
  }
  return verification;
}

/**
 * verification Identityを決定する。
 *
 * @responsibility verification Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Freshかを判定する。
 *
 * @responsibility Freshの判定条件とtrue／false境界を所有する。
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
 * Authorityを発行する。
 *
 * @responsibility Authorityの発行条件、Identity、非発行時のEffect 0境界を所有する。
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
    return authorityGrantBlocked("provider_authority_binding_invalid");
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
    return authorityGrantBlocked(
      "provider_authority_prelaunch_verification_invalid",
    );
  }
  const authorityRecordId = `PROVAUTH-${identifierBytes.toString("hex").toUpperCase()}`;
  if (state.records.has(authorityRecordId))
    return authorityGrantBlocked("provider_authority_runtime_state_invalid");
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
    ...authorityGrantBlocked("provider_authority_issued"),
    status: "issued" as const,
    reason: "provider_authority_issued",
    authorityRecordId,
    controlCapability,
    useCapability,
    operationId: verification.operationId,
    provider: verification.provider,
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    runtimeAuthorityIssued: true,
    expiresInMs: AUTHORITY_LIFETIME_MS,
  });
}

/**
 * 記録を検索する。
 *
 * @responsibility 記録の検索範囲、一致条件、未検出結果の境界を所有する。
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
 * Authorityを一回限りで消費する。
 *
 * @responsibility Authorityの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
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
    scopeId: verification.scopeId,
    providerHomeMountGrantRef: verification.providerHomeMountGrantRef,
    runtimeAuthorityIssued: true as const,
    providerEffectAllowed: true as const,
  });
}

/**
 * Authorityを失効させる。
 *
 * @responsibility Authorityの失効Authority、対象Identity、再利用防止境界を所有する。
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
  if (!record)
    return authorityGrantBlocked("provider_authority_control_invalid");
  removeRecord(state, record);
  return Object.freeze({
    ...authorityGrantBlocked("provider_authority_revoked"),
    status: "revoked" as const,
    reason: "provider_authority_revoked",
    authorityRecordId: record.authorityRecordId,
    operationId: record.operation.operationId,
  });
}

/**
 * Runtime 所有 Provider Authorityを発行する。
 *
 * @responsibility Runtime 所有 Provider Authorityの発行条件、Identity、非発行時のEffect 0境界を所有する。
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
 * Runtime 所有 Provider Authorityを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Provider Authorityの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
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
 * Runtime 所有 Provider Authorityを失効させる。
 *
 * @responsibility Runtime 所有 Provider Authorityの失効Authority、対象Identity、再利用防止境界を所有する。
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
 * Isolated Provider Authority Runtime 候補を構築する。
 *
 * @responsibility Isolated Provider Authority Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
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
 * Provider Authority Runtime 契約の公開契約を記述する。
 *
 * @responsibility Provider Authority Runtime 契約の公開field、非公開境界、互換性を所有する。
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

export const AUTHORITY_TRUST_POLICY_CONTRACT =
  "crdd-coordinator/authority-trust-policy";

export const AUTHORITY_TRUST_POLICY_CONTRACT_REVISION = 1;

export const AUTHORITY_TRUST_POLICY_INPUT_LIMITS = Object.freeze({
  rawBytes: 4_096,
});

const POLICY_ID = /^AUTHPOL-[0-9]{6,}$/u;

const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;

const authorityPolicyHASH = /^[a-f0-9]{64}$/u;

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

const authorityPolicyTYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
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
function authorityPolicyBlocked(reason: string) {
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
function authorityPolicyCanonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(authorityPolicyCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${authorityPolicyCanonicalJson(record[key])}`,
      )
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
      return authorityPolicyBlocked("authority_trust_policy_bytes_required");
    const inputLength = Reflect.apply(
      authorityPolicyTYPED_ARRAY_BYTE_LENGTH,
      input,
      [],
    );
    if (inputLength > AUTHORITY_TRUST_POLICY_INPUT_LIMITS.rawBytes) {
      return authorityPolicyBlocked(
        "authority_trust_policy_raw_bytes_exceeded",
      );
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (source.charCodeAt(0) === 0xfeff)
      return authorityPolicyBlocked("authority_trust_policy_bytes_invalid");
    const parsed = JSON.parse(source);
    const trustPolicy = validateTrustPolicyCandidate(parsed);
    if (!trustPolicy)
      return authorityPolicyBlocked("authority_trust_policy_bytes_invalid");
    const canonical = authorityPolicyCanonicalJson(trustPolicy);
    if (!Buffer.prototype.equals.call(bytes, Buffer.from(canonical, "utf8"))) {
      return authorityPolicyBlocked(
        "authority_trust_policy_bytes_noncanonical",
      );
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
    return authorityPolicyBlocked("authority_trust_policy_bytes_invalid");
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
    !authorityPolicyHASH.test(snapshot.registryHash)
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
      return authorityPolicyBlocked(registryResult.reason);
    const trustPolicy = validateTrustPolicyCandidate(rawTrustPolicy);
    if (!trustPolicy)
      return authorityPolicyBlocked("authority_trust_policy_invalid");
    if (trustPolicy.status !== "active")
      return authorityPolicyBlocked("authority_trust_policy_inactive");
    if (
      trustPolicy.registryId !== registryResult.registry.registryId ||
      trustPolicy.registryRevision !==
        registryResult.registry.registryRevision ||
      trustPolicy.registryHash !== registryResult.registryHash
    )
      return authorityPolicyBlocked("authority_trust_policy_registry_mismatch");

    return Object.freeze({
      status: "candidate",
      reason: "runtime_owned_trust_policy_activation_required",
      registry: registryResult.registry,
      registryHash: registryResult.registryHash,
      trustPolicy,
      trustPolicyHash: createHash("sha256")
        .update(authorityPolicyCanonicalJson(trustPolicy))
        .digest("hex"),
      runtimeCapabilityIssued: false,
    });
  } catch {
    return authorityPolicyBlocked("authority_trust_loader_input_invalid");
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

export const AUTHORITY_REGISTRY_CONTRACT =
  "crdd-coordinator/authority-registry";

export const AUTHORITY_REGISTRY_CONTRACT_REVISION = 4;

const authorityValidationREGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;

const GRANT_REF = /^AUTH-[0-9]{6,}$/u;

const OPERATION_ID = /^OP-[0-9]{6,}$/u;

const authorityValidationSCOPE_ID = /^SCOPE-[0-9]{6,}$/u;

const authorityValidationHASH = /^[a-f0-9]{64}$/u;

const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const authorityValidationTYPED_ARRAY_BYTE_LENGTH =
  Object.getOwnPropertyDescriptor(
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
  "origins",
  "providerHomeMountGrant",
  "operationId",
  "scopeId",
  "profileHash",
]);

/**
 * authority-grant-verifierで使用するAuthority Grantの値契約を定義する。
 *
 * @responsibility Authority GrantのProperty、Identity、状態制約を型境界として所有する。
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
  origins: readonly string[];
  providerHomeMountGrant: Readonly<{
    provider: string;
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
 * authority-grant-verifierを停止結果として構築する。
 *
 * @responsibility authority-grant-verifierの停止理由、未発行Effect、公開結果境界を所有する。
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
function authorityValidationBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    registry: null,
    registryHash: null,
    verification: null,
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
function authorityValidationCanonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(authorityValidationCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${authorityValidationCanonicalJson(record[key])}`,
      )
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("authority_registry_json_invalid");
  return serialized;
}

/**
 * Utcを固定Schemaへ正規化する。
 *
 * @responsibility Utcの入力検証、正規化規則、不正値の拒否境界を所有する。
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
 * Nowを固定Schemaへ正規化する。
 *
 * @responsibility Nowの入力検証、正規化規則、不正値の拒否境界を所有する。
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
 * Originsを固定Schemaへ正規化する。
 *
 * @responsibility Originsの入力検証、正規化規則、不正値の拒否境界を所有する。
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
 * Grantを固定Schemaへ正規化する。
 *
 * @responsibility Grantの入力検証、正規化規則、不正値の拒否境界を所有する。
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
    typeof snapshot.operationId !== "string" ||
    snapshot.operationId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(snapshot.operationId) ||
    typeof snapshot.scopeId !== "string" ||
    snapshot.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !authorityValidationSCOPE_ID.test(snapshot.scopeId) ||
    typeof snapshot.profileHash !== "string" ||
    !authorityValidationHASH.test(snapshot.profileHash)
  )
    return null;
  const validFrom = normalizedUtc(snapshot.validFrom);
  const expiresAt = normalizedUtc(snapshot.expiresAt);
  if (!validFrom || !expiresAt || validFrom >= expiresAt) return null;
  if (
    providerHomeMountGrant.provider !== snapshot.provider ||
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
    origins: Object.freeze(origins),
    providerHomeMountGrant: Object.freeze({
      provider: providerHomeMountGrant.provider,
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
 * Authority Registry 候補 Internalの契約を検証する。
 *
 * @responsibility Authority Registry 候補 Internalの必須Property、拒否条件、検証結果の境界を所有する。
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
  if (!top)
    return authorityValidationBlocked("authority_registry_shape_invalid");
  const grantsResult = snapshotPlainArray<unknown>(
    top.grants,
    AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount,
  );
  if (grantsResult.status !== "ok") {
    return authorityValidationBlocked(
      grantsResult.reason === "array_length_exceeded"
        ? "authority_registry_grant_count_exceeded"
        : "authority_registry_shape_invalid",
    );
  }
  if (
    top.contract !== AUTHORITY_REGISTRY_CONTRACT ||
    top.contractRevision !== AUTHORITY_REGISTRY_CONTRACT_REVISION
  )
    return authorityValidationBlocked("authority_registry_contract_mismatch");
  if (
    typeof top.registryId !== "string" ||
    top.registryId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !authorityValidationREGISTRY_ID.test(top.registryId)
  ) {
    return authorityValidationBlocked("authority_registry_id_invalid");
  }
  if (
    typeof top.registryRevision !== "number" ||
    !Number.isSafeInteger(top.registryRevision) ||
    top.registryRevision < 1
  ) {
    return authorityValidationBlocked("authority_registry_revision_invalid");
  }
  const observedAt = normalizedUtc(top.observedAt);
  if (!observedAt)
    return authorityValidationBlocked("authority_registry_observed_at_invalid");
  if (grantsResult.value.length === 0) {
    return authorityValidationBlocked("authority_registry_grants_required");
  }
  const grants = grantsResult.value.map(normalizeGrant);
  if (grants.some((grant) => grant == null))
    return authorityValidationBlocked("authority_registry_grant_invalid");
  const normalizedGrants = grants.filter(
    (grant): grant is Readonly<AuthorityGrant> => grant !== null,
  );
  const identities = normalizedGrants.map((grant) => grant.grantRef);
  if (new Set(identities).size !== identities.length)
    return authorityValidationBlocked("authority_registry_grant_duplicate");
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
  const canonical = authorityValidationCanonicalJson(registry);
  if (
    Buffer.byteLength(canonical, "utf8") >
    AUTHORITY_REGISTRY_INPUT_LIMITS.canonicalBytes
  ) {
    return authorityValidationBlocked(
      "authority_registry_canonical_bytes_exceeded",
    );
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
 * Authority Registry 候補の契約を検証する。
 *
 * @responsibility Authority Registry 候補の必須Property、拒否条件、検証結果の境界を所有する。
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
    return authorityValidationBlocked("authority_registry_input_invalid");
  }
}

/**
 * Canonical Authority Registry Bytesを検証済み値へ復号する。
 *
 * @responsibility Canonical Authority Registry Bytesの入力形式、復号結果、不正byte列の拒否境界を所有する。
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
      return authorityValidationBlocked("authority_registry_bytes_required");
    const inputLength = Reflect.apply(
      authorityValidationTYPED_ARRAY_BYTE_LENGTH,
      input,
      [],
    );
    if (inputLength > AUTHORITY_REGISTRY_INPUT_LIMITS.rawBytes) {
      return authorityValidationBlocked(
        "authority_registry_raw_bytes_exceeded",
      );
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (source.charCodeAt(0) === 0xfeff)
      return authorityValidationBlocked("authority_registry_bytes_invalid");
    const parsed = JSON.parse(source);
    const result = validateAuthorityRegistryCandidate(parsed);
    if (result.status !== "candidate")
      return authorityValidationBlocked("authority_registry_bytes_invalid");
    const canonical = authorityValidationCanonicalJson(result.registry);
    if (!Buffer.prototype.equals.call(bytes, Buffer.from(canonical, "utf8"))) {
      return authorityValidationBlocked(
        "authority_registry_bytes_noncanonical",
      );
    }
    return result;
  } catch {
    return authorityValidationBlocked("authority_registry_bytes_invalid");
  }
}

/**
 * Authority Grant 候補 Internalを評価する。
 *
 * @responsibility Authority Grant 候補 Internalの評価入力、判定規則、判断不能結果の境界を所有する。
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
    return authorityValidationBlocked("authority_profile_invalid");
  const registryResult = validateAuthorityRegistryCandidate(rawRegistry);
  if (registryResult.status !== "candidate")
    return authorityValidationBlocked("authority_registry_invalid");
  const contextSnapshot = snapshotPlainRecord(
    context,
    new Set([
      "provider",
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
    typeof contextSnapshot.operationId !== "string" ||
    contextSnapshot.operationId.length >
      PROVIDER_INPUT_LIMITS.identifierLength ||
    !OPERATION_ID.test(contextSnapshot.operationId) ||
    typeof contextSnapshot.scopeId !== "string" ||
    contextSnapshot.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !authorityValidationSCOPE_ID.test(contextSnapshot.scopeId) ||
    !isProviderHomeMountGrantRef(contextSnapshot.providerHomeMountGrantRef)
  )
    return authorityValidationBlocked("authority_context_invalid");
  const now = normalizeNow(contextSnapshot.now);
  if (!now) return authorityValidationBlocked("authority_now_invalid");
  if (registryResult.registry.observedAt > now)
    return authorityValidationBlocked(
      "authority_registry_observation_in_future",
    );
  if (
    profileResult.profile.authority.registryId !==
    registryResult.registry.registryId
  ) {
    return authorityValidationBlocked("authority_registry_mismatch");
  }
  const matchingGrants = registryResult.registry.grants.filter(
    (grant) => grant.grantRef === profileResult.profile.authority.grantRef,
  );
  if (matchingGrants.length !== 1)
    return authorityValidationBlocked("authority_grant_not_unique");
  const grant = matchingGrants[0];
  if (!grant) return authorityValidationBlocked("authority_grant_not_unique");
  if (grant.status !== "active")
    return authorityValidationBlocked("authority_grant_inactive");
  if (!(grant.validFrom <= now && now < grant.expiresAt))
    return authorityValidationBlocked("authority_grant_outside_validity");
  if (grant.provider !== profileResult.profile.provider)
    return authorityValidationBlocked("authority_provider_mismatch");
  if (
    contextSnapshot.provider !== profileResult.profile.provider ||
    contextSnapshot.operationId !== profileResult.profile.operationId ||
    grant.operationId !== profileResult.profile.operationId
  )
    return authorityValidationBlocked("authority_provider_operation_mismatch");
  if (
    authorityValidationCanonicalJson(grant.origins) !==
    authorityValidationCanonicalJson(profileResult.profile.egress.origins)
  ) {
    return authorityValidationBlocked("authority_origins_mismatch");
  }
  if (
    authorityValidationCanonicalJson(grant.providerHomeMountGrant) !==
    authorityValidationCanonicalJson(
      profileResult.profile.providerHomeMountGrant,
    )
  ) {
    return authorityValidationBlocked(
      "authority_provider_home_mount_grant_mismatch",
    );
  }
  if (!isProviderHomeMountGrantRef(contextSnapshot.providerHomeMountGrantRef)) {
    return authorityValidationBlocked(
      "authority_provider_home_mount_grant_context_invalid",
    );
  }
  if (
    grant.operationId !== contextSnapshot.operationId ||
    grant.scopeId !== contextSnapshot.scopeId
  ) {
    return authorityValidationBlocked("authority_operation_scope_mismatch");
  }
  if (grant.profileHash !== profileResult.profileHash)
    return authorityValidationBlocked("authority_profile_hash_mismatch");

  const verification = Object.freeze({
    profileHash: profileResult.profileHash,
    registryId: registryResult.registry.registryId,
    registryRevision: registryResult.registry.registryRevision,
    registryHash: registryResult.registryHash,
    grantRef: grant.grantRef,
    grantRevision: grant.grantRevision,
    provider: contextSnapshot.provider,
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
 * Authority Grant 候補を評価する。
 *
 * @responsibility Authority Grant 候補の評価入力、判定規則、判断不能結果の境界を所有する。
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
    return authorityValidationBlocked("authority_input_invalid");
  }
}

/**
 * Authority Grant Verifier 契約の公開契約を記述する。
 *
 * @responsibility Authority Grant Verifier 契約の公開field、非公開境界、互換性を所有する。
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

const DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/delegation-selection-grant-runtime";

const DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT_REVISION = 5;

const SELECTION_LIFETIME_MS = 30_000;

/**
 * delegation-selection-grant-runtimeで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";

/**
 * delegation-selection-grant-runtimeで使用するSelection 記録の値契約を定義する。
 *
 * @responsibility Selection 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape SelectionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SelectionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: SelectionRecordの宣言は外部境界を開かない。
 * @security SelectionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SelectionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SelectionRecord = {
  selectionRecordId: string;
  operationId: string;
  managementCapability: object;
  selection: ExecutionSelection;
  taskAttempt: 0 | 1;
  selectionHash: string;
  selectionNotice: string;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
  controlCapability: object;
  useCapability: object;
};

/**
 * delegation-selection-grant-runtimeで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000010
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type delegationSelectionGrantRuntimeState = Readonly<{
  records: Map<string, SelectionRecord>;
  controlCapabilities: WeakMap<object, string>;
  useCapabilities: WeakMap<object, string>;
  verifyOperation: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string; createdAt: string }>;
  observeProviderEligibility: () => unknown;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
}>;

/**
 * Runtime 状態を構築する。
 *
 * @responsibility Runtime 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
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
function delegationSelectionGrantCreateRuntimeState(
  dependencies: Omit<
    delegationSelectionGrantRuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
): delegationSelectionGrantRuntimeState {
  return Object.freeze({
    records: new Map(),
    controlCapabilities: new WeakMap(),
    useCapabilities: new WeakMap(),
    ...dependencies,
  });
}

const delegationSelectionGrantProductionState =
  delegationSelectionGrantCreateRuntimeState({
    verifyOperation: (managementCapability) => {
      const operation =
        verifyOwnedOperationManagementCapability(managementCapability);
      const repository =
        verifyRuntimeOwnedRepositoryOperation(managementCapability);
      if (!repository || repository.operationId !== operation.operationId)
        throw new Error("repository_operation_binding_required");
      return operation;
    },
    observeProviderEligibility: observeRuntimeOwnedProviderEligibility,
    wallNow: Date.now,
    monotonicNow: performance.now.bind(performance),
    randomBytes,
  });

/**
 * Blocked 結果を構築する。
 *
 * @responsibility Blocked 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input reason: string
 * @returns createBlockedResultの計算結果を返す。
 * @precondition 「reason: string」がcreateBlockedResultの入力契約を満たす。
 * @postcondition createBlockedResultの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedResultは独自の失敗分岐を所有しない。
 * @invariant createBlockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBlockedResultはProcess内の同一Subsystemで完結する。
 * @security createBlockedResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedResultは共有非同期状態を持たない同期処理である。
 */
function createBlockedResult(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    selectionRecordId: null,
    controlCapability: null,
    useCapability: null,
    operationId: null,
    executorProvider: null,
    executionSelection: null,
    selectionHash: null,
    taskAttempt: null,
    selectedModel: null,
    selectedEffort: null,
    speedMode: null,
    selectionNotice: null,
    expiresInMs: null,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}

/**
 * Safelyを安全に実行する。
 *
 * @responsibility Safelyの実行条件、Effect範囲、失敗時の終了境界を所有する。
 * @trace ARCH-000010
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
function delegationSelectionGrantPerformSafely<T>(
  reason: string,
  action: () => T,
) {
  try {
    return action();
  } catch {
    return createBlockedResult(reason);
  }
}

/**
 * Selection 記録 Idを構築する。
 *
 * @responsibility Selection 記録 Idの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState
 * @returns createSelectionRecordIdの計算結果を返す。
 * @precondition 「state: RuntimeState」がcreateSelectionRecordIdの入力契約を満たす。
 * @postcondition createSelectionRecordIdの責務を完了した結果だけを返す。
 * @effect N/A: createSelectionRecordIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSelectionRecordIdは独自の失敗分岐を所有しない。
 * @invariant createSelectionRecordIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSelectionRecordIdはProcess内の同一Subsystemで完結する。
 * @security createSelectionRecordIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSelectionRecordIdは共有非同期状態を持たない同期処理である。
 */
function createSelectionRecordId(state: delegationSelectionGrantRuntimeState) {
  const value = state.randomBytes(12);
  return Buffer.isBuffer(value) && value.byteLength === 12
    ? `MODELSEL-${value.toString("hex").toUpperCase()}`
    : null;
}

/**
 * Selection Freshかを判定する。
 *
 * @responsibility Selection Freshの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、record: SelectionRecord
 * @returns isSelectionFreshの計算結果を返す。
 * @precondition 「state: RuntimeState、record: SelectionRecord」がisSelectionFreshの入力契約を満たす。
 * @postcondition isSelectionFreshの責務を完了した結果だけを返す。
 * @effect N/A: isSelectionFreshは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSelectionFreshは独自の失敗分岐を所有しない。
 * @invariant isSelectionFreshは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSelectionFreshはProcess内の同一Subsystemで完結する。
 * @security isSelectionFreshはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSelectionFreshは共有非同期状態を持たない同期処理である。
 */
function isSelectionFresh(
  state: delegationSelectionGrantRuntimeState,
  record: SelectionRecord,
) {
  const wallAge = state.wallNow() - record.issuedWallClockMs;
  const monotonicAge = state.monotonicNow() - record.issuedMonotonicMs;
  return (
    Number.isFinite(wallAge) &&
    Number.isFinite(monotonicAge) &&
    wallAge >= 0 &&
    monotonicAge >= 0 &&
    wallAge < SELECTION_LIFETIME_MS &&
    monotonicAge < SELECTION_LIFETIME_MS
  );
}

/**
 * Selection 記録を除去する。
 *
 * @responsibility Selection 記録の対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、record: SelectionRecord
 * @returns N/A: removeSelectionRecordは戻り値を返さない。
 * @precondition 「state: RuntimeState、record: SelectionRecord」がremoveSelectionRecordの入力契約を満たす。
 * @postcondition removeSelectionRecordの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: removeSelectionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: removeSelectionRecordは独自の失敗分岐を所有しない。
 * @invariant removeSelectionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: removeSelectionRecordはProcess内の同一Subsystemで完結する。
 * @security removeSelectionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeSelectionRecordは共有非同期状態を持たない同期処理である。
 */
function removeSelectionRecord(
  state: delegationSelectionGrantRuntimeState,
  record: SelectionRecord,
) {
  state.records.delete(record.selectionRecordId);
  state.controlCapabilities.delete(record.controlCapability);
  state.useCapabilities.delete(record.useCapability);
}

/**
 * Selection Grantを発行する。
 *
 * @responsibility Selection Grantの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、managementCapability: unknown、rawRequest: unknown
 * @returns issueSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown、rawRequest: unknown」がissueSelectionGrantの入力契約を満たす。
 * @postcondition issueSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: issueSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant issueSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security issueSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function issueSelectionGrant(
  state: delegationSelectionGrantRuntimeState,
  managementCapability: unknown,
  rawRequest: unknown,
) {
  if (!managementCapability || typeof managementCapability !== "object")
    return createBlockedResult(
      "delegation_selection_management_capability_invalid",
    );
  const operation = state.verifyOperation(managementCapability);
  const request = snapshotPlainRecord(
    rawRequest,
    new Set(["operationId", "executionSelection", "taskAttempt"]),
  );
  const selection = inspectExecutionSelection(request?.executionSelection);
  if (
    !request ||
    !selection ||
    request.operationId !== operation.operationId ||
    (request.taskAttempt !== 0 && request.taskAttempt !== 1)
  )
    return createBlockedResult("delegation_selection_request_invalid");
  const availability = snapshotPlainArray<unknown>(
    state.observeProviderEligibility(),
    2,
  );
  if (availability.status !== "ok")
    return createBlockedResult(
      "delegation_selection_provider_observation_unavailable",
    );
  const eligible = availability.value
    .map((item) =>
      snapshotPlainRecord(item, new Set(["provider", "status", "reason"])),
    )
    .filter((item) => item?.provider === selection.provider);
  if (eligible.length !== 1 || eligible[0]?.status !== "eligible")
    return createBlockedResult("delegation_selection_provider_unavailable");
  const technical = resolveAiModelSelection({
    provider: selection.provider,
    modelIdentifier: selection.modelIdentifier,
    reasoningEffort: selection.reasoningEffort,
    purpose: selection.purpose,
  });
  if (
    technical.status !== "resolved" ||
    technical.value.identifierKind !== selection.identifierKind ||
    technical.value.modelIdentifier !== selection.modelIdentifier ||
    technical.value.reasoningEffort !== selection.reasoningEffort
  )
    return createBlockedResult("delegation_selection_model_unsupported");
  const selectionHash = hashExecutionSelection(selection);
  if (!selectionHash)
    return createBlockedResult("delegation_selection_request_invalid");
  const issuedWallClockMs = state.wallNow();
  const issuedMonotonicMs = state.monotonicNow();
  const selectionRecordId = createSelectionRecordId(state);
  if (
    !Number.isFinite(issuedWallClockMs) ||
    !Number.isFinite(issuedMonotonicMs) ||
    issuedWallClockMs < 0 ||
    issuedMonotonicMs < 0 ||
    !selectionRecordId ||
    state.records.has(selectionRecordId)
  )
    return createBlockedResult("delegation_selection_runtime_state_invalid");
  const controlCapability = Object.freeze({});
  const useCapability = Object.freeze({});
  const record: SelectionRecord = {
    selectionRecordId,
    operationId: operation.operationId,
    managementCapability,
    selection,
    selectionHash,
    taskAttempt: request.taskAttempt,
    selectionNotice: [
      selection.provider,
      selection.modelIdentifier,
      selection.reasoningEffort,
      selection.role,
      selection.source,
    ].join(" / "),
    issuedWallClockMs,
    issuedMonotonicMs,
    controlCapability,
    useCapability,
  };
  state.records.set(selectionRecordId, record);
  state.controlCapabilities.set(controlCapability, selectionRecordId);
  state.useCapabilities.set(useCapability, selectionRecordId);
  return Object.freeze({
    status: "issued" as const,
    reason: "delegation_selection_grant_issued",
    selectionRecordId,
    controlCapability,
    useCapability,
    operationId: operation.operationId,
    executorProvider: selection.provider,
    executionSelection: selection,
    selectionHash,
    taskAttempt: record.taskAttempt,
    selectedModel: selection.modelIdentifier,
    selectedEffort: selection.reasoningEffort,
    speedMode: "normal" as const,
    selectionNotice: record.selectionNotice,
    expiresInMs: SELECTION_LIFETIME_MS,
    selectionCapabilityIssued: true,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}

/**
 * Selection 記録を検索する。
 *
 * @responsibility Selection 記録の検索範囲、一致条件、未検出結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、capability: unknown、aliases: WeakMap<object, string>、managementCapability: unknown
 * @returns findSelectionRecordの計算結果を返す。
 * @precondition 「state: RuntimeState、capability: unknown、aliases: WeakMap<object, string>、managementCapability: unknown」がfindSelectionRecordの入力契約を満たす。
 * @postcondition findSelectionRecordの責務を完了した結果だけを返す。
 * @effect N/A: findSelectionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: findSelectionRecordは独自の失敗分岐を所有しない。
 * @invariant findSelectionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: findSelectionRecordはProcess内の同一Subsystemで完結する。
 * @security findSelectionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: findSelectionRecordは共有非同期状態を持たない同期処理である。
 */
function findSelectionRecord(
  state: delegationSelectionGrantRuntimeState,
  capability: unknown,
  aliases: WeakMap<object, string>,
  managementCapability: unknown,
) {
  if (
    !capability ||
    typeof capability !== "object" ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return null;
  }
  const recordId = aliases.get(capability);
  const record = recordId ? state.records.get(recordId) : null;
  return record?.managementCapability === managementCapability ? record : null;
}

/**
 * Selection Grantを一回限りで消費する。
 *
 * @responsibility Selection Grantの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、useCapability: unknown、managementCapability: unknown
 * @returns consumeSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、useCapability: unknown、managementCapability: unknown」がconsumeSelectionGrantの入力契約を満たす。
 * @postcondition consumeSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: consumeSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant consumeSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security consumeSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function consumeSelectionGrant(
  state: delegationSelectionGrantRuntimeState,
  useCapability: unknown,
  managementCapability: unknown,
) {
  const record = findSelectionRecord(
    state,
    useCapability,
    state.useCapabilities,
    managementCapability,
  );
  if (!record || !isSelectionFresh(state, record)) {
    if (record) removeSelectionRecord(state, record);
    return null;
  }
  removeSelectionRecord(state, record);
  return Object.freeze({
    selectionRecordId: record.selectionRecordId,
    operationId: record.operationId,
    executorProvider: record.selection.provider,
    executionSelection: record.selection,
    selectionHash: record.selectionHash,
    taskAttempt: record.taskAttempt,
    model: record.selection.modelIdentifier,
    effort: record.selection.reasoningEffort,
    speedMode: "normal" as const,
    selectionNotice: record.selectionNotice,
  });
}

/**
 * Selection Grantを失効させる。
 *
 * @responsibility Selection Grantの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown
 * @returns revokeSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown」がrevokeSelectionGrantの入力契約を満たす。
 * @postcondition revokeSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: revokeSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant revokeSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security revokeSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function revokeSelectionGrant(
  state: delegationSelectionGrantRuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const record = findSelectionRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!record) {
    return createBlockedResult("delegation_selection_control_invalid");
  }
  removeSelectionRecord(state, record);
  return Object.freeze({
    ...createBlockedResult("delegation_selection_grant_revoked"),
    status: "revoked" as const,
    reason: "delegation_selection_grant_revoked",
    selectionRecordId: record.selectionRecordId,
    operationId: record.operationId,
  });
}

/**
 * supersede Selection Grantを決定する。
 *
 * @responsibility supersede Selection Grantの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown
 * @returns supersedeSelectionGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown」がsupersedeSelectionGrantの入力契約を満たす。
 * @postcondition supersedeSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: supersedeSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: supersedeSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant supersedeSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: supersedeSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security supersedeSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: supersedeSelectionGrantは共有非同期状態を持たない同期処理である。
 */
function supersedeSelectionGrant(
  state: delegationSelectionGrantRuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
  rawReplacementRequest: unknown,
) {
  const previousRecord = findSelectionRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!previousRecord || !isSelectionFresh(state, previousRecord)) {
    if (previousRecord) removeSelectionRecord(state, previousRecord);
    return createBlockedResult("delegation_selection_control_invalid");
  }

  const requested = snapshotPlainRecord(
    rawReplacementRequest,
    new Set(["operationId", "executionSelection", "taskAttempt"]),
  );
  const selection = inspectExecutionSelection(requested?.executionSelection);
  if (
    !selection ||
    hashExecutionSelection(selection) !== previousRecord.selectionHash ||
    requested?.taskAttempt !== previousRecord.taskAttempt
  )
    return createBlockedResult("delegation_selection_replacement_mismatch");
  const replacement = issueSelectionGrant(
    state,
    managementCapability,
    rawReplacementRequest,
  );
  if (replacement.status !== "issued") {
    return replacement;
  }

  removeSelectionRecord(state, previousRecord);
  return Object.freeze({
    ...replacement,
    reason: "delegation_selection_grant_superseded",
    supersededSelectionRecordId: previousRecord.selectionRecordId,
  });
}

/**
 * Runtime 所有 Delegation Selection Grantを発行する。
 *
 * @responsibility Runtime 所有 Delegation Selection Grantの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000010
 * @input managementCapability: unknown、rawRequest: unknown
 * @returns issueRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「managementCapability: unknown、rawRequest: unknown」がissueRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition issueRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: issueRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueRuntimeOwnedDelegationSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant issueRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security issueRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function issueRuntimeOwnedDelegationSelectionGrant(
  managementCapability: unknown,
  rawRequest: unknown,
) {
  return delegationSelectionGrantPerformSafely(
    "delegation_selection_issue_failed_closed",
    () =>
      issueSelectionGrant(
        delegationSelectionGrantProductionState,
        managementCapability,
        rawRequest,
      ),
  );
}

/**
 * preflight Runtime 所有 Delegation Execution Slateを決定する。
 *
 * @responsibility preflight Runtime 所有 Delegation Execution Slateの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input managementCapability: unknown、rawExecutorRequest: unknown
 * @returns preflightRuntimeOwnedDelegationExecutionSlateの計算結果を返す。
 * @precondition 「managementCapability: unknown、rawExecutorRequest: unknown」がpreflightRuntimeOwnedDelegationExecutionSlateの入力契約を満たす。
 * @postcondition preflightRuntimeOwnedDelegationExecutionSlateの責務を完了した結果だけを返す。
 * @effect N/A: preflightRuntimeOwnedDelegationExecutionSlateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: preflightRuntimeOwnedDelegationExecutionSlateは独自の失敗分岐を所有しない。
 * @invariant preflightRuntimeOwnedDelegationExecutionSlateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: preflightRuntimeOwnedDelegationExecutionSlateはProcess内の同一Subsystemで完結する。
 * @security preflightRuntimeOwnedDelegationExecutionSlateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: preflightRuntimeOwnedDelegationExecutionSlateは共有非同期状態を持たない同期処理である。
 */
export function preflightRuntimeOwnedDelegationExecutionSlate(
  managementCapability: unknown,
  rawExecutorRequest: unknown,
) {
  return delegationSelectionGrantPerformSafely(
    "delegation_slate_preflight_failed",
    () => {
      const operation =
        delegationSelectionGrantProductionState.verifyOperation(
          managementCapability,
        );
      const request = snapshotPlainRecord(
        rawExecutorRequest,
        new Set(["operationId", "taskExecutionSelections"]),
      );
      const pair = inspectTaskExecutionSelections(
        request?.taskExecutionSelections,
      );
      if (!request || !pair || request.operationId !== operation.operationId)
        return createBlockedResult("delegation_slate_selection_invalid");
      const observation = snapshotPlainArray<unknown>(
        delegationSelectionGrantProductionState.observeProviderEligibility(),
        2,
      );
      if (observation.status !== "ok")
        return createBlockedResult(
          "delegation_slate_provider_observation_unavailable",
        );
      for (const selection of [pair.executor, pair.reviewer]) {
        const providers = observation.value
          .map((item) =>
            snapshotPlainRecord(
              item,
              new Set(["provider", "status", "reason"]),
            ),
          )
          .filter((item) => item?.provider === selection.provider);
        if (
          providers.length !== 1 ||
          providers[0]?.status !== "eligible" ||
          resolveAiModelSelection({
            provider: selection.provider,
            modelIdentifier: selection.modelIdentifier,
            reasoningEffort: selection.reasoningEffort,
            purpose: selection.purpose,
          }).status !== "resolved"
        )
          return createBlockedResult("delegation_slate_provider_unavailable");
      }
      return Object.freeze({
        status: "candidate" as const,
        operationId: operation.operationId,
        executorProvider: pair.executor.provider,
        reviewerProvider: pair.reviewer.provider,
        reviewerIndependence:
          pair.executor.provider === pair.reviewer.provider
            ? ("execution_context_independent" as const)
            : ("provider_independent" as const),
        selectionCapabilityIssued: false,
        providerAuthorityIssued: false,
        providerEffectAllowed: false,
      });
    },
  );
}

/**
 * Runtime 所有 Delegation Selection Grantを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Delegation Selection Grantの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000010
 * @input useCapability: unknown、managementCapability: unknown
 * @returns consumeRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「useCapability: unknown、managementCapability: unknown」がconsumeRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeRuntimeOwnedDelegationSelectionGrantは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security consumeRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedDelegationSelectionGrant(
  useCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return consumeSelectionGrant(
      delegationSelectionGrantProductionState,
      useCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Delegation Selection Grantを失効させる。
 *
 * @responsibility Runtime 所有 Delegation Selection Grantの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000010
 * @input controlCapability: unknown、managementCapability: unknown
 * @returns revokeRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown」がrevokeRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition revokeRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: revokeRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeRuntimeOwnedDelegationSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant revokeRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security revokeRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function revokeRuntimeOwnedDelegationSelectionGrant(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return delegationSelectionGrantPerformSafely(
    "delegation_selection_revoke_failed_closed",
    () =>
      revokeSelectionGrant(
        delegationSelectionGrantProductionState,
        controlCapability,
        managementCapability,
      ),
  );
}

/**
 * supersede Runtime 所有 Delegation Selection Grantを決定する。
 *
 * @responsibility supersede Runtime 所有 Delegation Selection Grantの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown
 * @returns supersedeRuntimeOwnedDelegationSelectionGrantの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown、rawReplacementRequest: unknown」がsupersedeRuntimeOwnedDelegationSelectionGrantの入力契約を満たす。
 * @postcondition supersedeRuntimeOwnedDelegationSelectionGrantの責務を完了した結果だけを返す。
 * @effect N/A: supersedeRuntimeOwnedDelegationSelectionGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: supersedeRuntimeOwnedDelegationSelectionGrantは独自の失敗分岐を所有しない。
 * @invariant supersedeRuntimeOwnedDelegationSelectionGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: supersedeRuntimeOwnedDelegationSelectionGrantはProcess内の同一Subsystemで完結する。
 * @security supersedeRuntimeOwnedDelegationSelectionGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: supersedeRuntimeOwnedDelegationSelectionGrantは共有非同期状態を持たない同期処理である。
 */
export function supersedeRuntimeOwnedDelegationSelectionGrant(
  controlCapability: unknown,
  managementCapability: unknown,
  rawReplacementRequest: unknown,
) {
  return delegationSelectionGrantPerformSafely(
    "delegation_selection_supersede_failed_closed",
    () =>
      supersedeSelectionGrant(
        delegationSelectionGrantProductionState,
        controlCapability,
        managementCapability,
        rawReplacementRequest,
      ),
  );
}

/**
 * Isolated Delegation Selection Grant Runtime 候補を構築する。
 *
 * @responsibility Isolated Delegation Selection Grant Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000010
 * @input dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >
 * @returns createIsolatedDelegationSelectionGrantRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: Omit< RuntimeState, "records" | "controlCapabilities" | "useCapabilities" >」がcreateIsolatedDelegationSelectionGrantRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedDelegationSelectionGrantRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDelegationSelectionGrantRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedDelegationSelectionGrantRuntimeCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedDelegationSelectionGrantRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDelegationSelectionGrantRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDelegationSelectionGrantRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDelegationSelectionGrantRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDelegationSelectionGrantRuntimeCandidate(
  dependencies: Omit<
    delegationSelectionGrantRuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
) {
  const state = delegationSelectionGrantCreateRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    issue: (managementCapability: unknown, rawRequest: unknown) =>
      delegationSelectionGrantPerformSafely(
        "delegation_selection_issue_failed_closed",
        () => issueSelectionGrant(state, managementCapability, rawRequest),
      ),
    consume: (useCapability: unknown, managementCapability: unknown) => {
      try {
        return consumeSelectionGrant(
          state,
          useCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      delegationSelectionGrantPerformSafely(
        "delegation_selection_revoke_failed_closed",
        () =>
          revokeSelectionGrant(state, controlCapability, managementCapability),
      ),
    supersede: (
      controlCapability: unknown,
      managementCapability: unknown,
      rawReplacementRequest: unknown,
    ) =>
      delegationSelectionGrantPerformSafely(
        "delegation_selection_supersede_failed_closed",
        () =>
          supersedeSelectionGrant(
            state,
            controlCapability,
            managementCapability,
            rawReplacementRequest,
          ),
      ),
  });
}

/**
 * Delegation Selection Grant Runtime 契約の公開契約を記述する。
 *
 * @responsibility Delegation Selection Grant Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDelegationSelectionGrantRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDelegationSelectionGrantRuntimeContractの入力契約を満たす。
 * @postcondition describeDelegationSelectionGrantRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDelegationSelectionGrantRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDelegationSelectionGrantRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeDelegationSelectionGrantRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDelegationSelectionGrantRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeDelegationSelectionGrantRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDelegationSelectionGrantRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeDelegationSelectionGrantRuntimeContract() {
  return Object.freeze({
    contract: DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT,
    contractRevision: DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT_REVISION,
    selectionLifetimeMs: SELECTION_LIFETIME_MS,
    clocks: Object.freeze(["runtime_wall", "runtime_monotonic"]),
    aliases: Object.freeze(["control", "use"]),
    maximumUses: 1,
    operationBinding: "runtime_owned_management_capability",
    providerEligibility:
      "runtime_owned_preselection_candidate_with_home_distribution_policy_auth_preflight_deferred",
    exactModelId: "intake_fixed_execution_selection_technically_validated",
    billingMode: "subscription_oauth_only",
    speedMode: "normal_only",
    selectionNotice: "issued_before_provider_effect",
    executionSlatePreflight:
      "fixed_executor_and_reviewer_from_one_runtime_owned_eligibility_observation_before_selection_grants",
    executionSlateCapabilityIssued: false,
    providerFallback:
      "forbidden_after_provider_request_or_when_effect_state_is_uncertain",
    reselection: "same_fixed_selection_and_attempt_only",
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}

export const LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT =
  "crdd-coordinator/local-personal-authority-runtime";

export const LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT_REVISION = 3;

const SOURCE_LIFETIME_MS = 30_000;

const GRANT_LIFETIME_MS = 300_000;

/**
 * local-personal-authority-runtimeで使用するBindingの値契約を定義する。
 *
 * @responsibility BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape Bindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Bindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: Bindingの宣言は外部境界を開かない。
 * @security BindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Bindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Binding = Readonly<{
  operationId: string;
  provider: string;
}>;

/**
 * local-personal-authority-runtimeで使用するSourceの値契約を定義する。
 *
 * @responsibility SourceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape Sourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sourceの宣言は外部境界を開かない。
 * @security SourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Sourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Source = Readonly<{
  profile: unknown;
  bundle: unknown;
  scopeId: string;
}>;

/**
 * local-personal-authority-runtimeで使用するSource 記録の値契約を定義する。
 *
 * @responsibility Source 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape SourceRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SourceRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: SourceRecordの宣言は外部境界を開かない。
 * @security SourceRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SourceRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SourceRecord = Readonly<{
  source: Source;
  expiresAtMs: number;
}>;

/**
 * local-personal-authority-runtimeで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  wallNow: () => number;
  verifyOperation: (binding: Binding, managementCapability: unknown) => boolean;
}>;

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
function localAuthorityCanonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(localAuthorityCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${localAuthorityCanonicalJson(record[key])}`,
      )
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("local_personal_authority_json_invalid");
  return serialized;
}

/**
 * Sourceを構築する。
 *
 * @responsibility Sourceの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000014
 * @input binding: Binding、now: number
 * @returns Source | nullを返す。
 * @precondition 「binding: Binding、now: number」がcreateSourceの入力契約を満たす。
 * @postcondition createSourceの責務を完了した結果だけを返す。
 * @effect N/A: createSourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSourceは独自の失敗分岐を所有しない。
 * @invariant createSourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSourceはProcess内の同一Subsystemで完結する。
 * @security createSourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSourceは共有非同期状態を持たない同期処理である。
 */
function createSource(binding: Binding, now: number): Source | null {
  if (
    (binding.provider !== "codex" && binding.provider !== "claude") ||
    !/^OP-[0-9]{6,}$/u.test(binding.operationId)
  )
    return null;
  const authentication = describeProviderAuthentication(binding.provider);
  const specification = Object.freeze({
    provider: authentication.provider,
    origin: authentication.authorityOrigin,
    suffix: binding.provider === "codex" ? "100001" : "200001",
  });
  const registryId = `AUTHREG-${specification.suffix}`;
  const grantRef = `AUTH-${specification.suffix}`;
  const scopeId = `SCOPE-${specification.suffix}`;
  const mountRequirement = Object.freeze({
    provider: specification.provider,
    operationId: binding.operationId,
    issuer: "runtime_owned" as const,
    requiredState: "active" as const,
    verification: "runtime_capability_required" as const,
  });
  const profile = Object.freeze({
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: PROVIDER_ISOLATION_CONTRACT_REVISION,
    provider: specification.provider,
    operationId: binding.operationId,
    authMethod: "subscription_oauth",
    authority: Object.freeze({ registryId, grantRef }),
    providerHomeMountGrant: mountRequirement,
    egress: Object.freeze({ origins: Object.freeze([specification.origin]) }),
  });
  const validatedProfile = validateProviderIsolationProfile(profile);
  if (validatedProfile.status !== "candidate") return null;
  const registryCandidate = validateAuthorityRegistryCandidate({
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: AUTHORITY_REGISTRY_CONTRACT_REVISION,
    registryId,
    registryRevision: 1,
    observedAt: new Date(now).toISOString(),
    grants: [
      {
        grantRef,
        grantRevision: 1,
        status: "active",
        validFrom: new Date(now - 60_000).toISOString(),
        expiresAt: new Date(now + GRANT_LIFETIME_MS).toISOString(),
        provider: specification.provider,
        origins: [specification.origin],
        providerHomeMountGrant: mountRequirement,
        operationId: binding.operationId,
        scopeId,
        profileHash: validatedProfile.profileHash,
      },
    ],
  });
  if (registryCandidate.status !== "candidate") return null;
  const registryBytes = Buffer.from(
    localAuthorityCanonicalJson(registryCandidate.registry),
    "utf8",
  );
  const trustPolicy = Object.freeze({
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: 1,
    policyId: `AUTHPOL-${specification.suffix}`,
    policyRevision: 1,
    status: "active",
    registryId,
    registryRevision: 1,
    registryHash: registryCandidate.registryHash,
  });
  const trustPolicyBytes = Buffer.from(
    localAuthorityCanonicalJson(trustPolicy),
    "utf8",
  );
  const decodedPolicy =
    decodeCanonicalAuthorityTrustPolicyBytes(trustPolicyBytes);
  if (decodedPolicy.status !== "candidate") return null;
  const manifest = Object.freeze({
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: 1,
    bundleId: `AUTHBUNDLE-${specification.suffix}`,
    bundleRevision: 1,
    status: "active",
    previousBundleHash: null,
    trustPolicyHash: decodedPolicy.trustPolicyHash,
    registryHash: registryCandidate.registryHash,
  });
  const bundle = Object.freeze({
    manifestBytes: Buffer.from(localAuthorityCanonicalJson(manifest), "utf8"),
    trustPolicyBytes,
    registryBytes,
  });
  if (loadAuthorityFileBundleCandidate(bundle).status !== "candidate")
    return null;
  return Object.freeze({ profile, bundle, scopeId });
}

/**
 * Runtimeを構築する。
 *
 * @responsibility Runtimeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000014
 * @input dependencies: RuntimeDependencies
 * @returns createRuntimeの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateRuntimeの入力契約を満たす。
 * @postcondition createRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeはProcess内の同一Subsystemで完結する。
 * @security createRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeは共有非同期状態を持たない同期処理である。
 */
function createRuntime(dependencies: RuntimeDependencies) {
  const sources = new Map<string, SourceRecord>();
  return Object.freeze({
    /**
     * local-personal-authority-runtimeを読み込む。
     *
     * @responsibility local-personal-authority-runtimeの読取り元、Schema検証、読取不能時の拒否境界を所有する。
     * @trace ARCH-000014
     * @input binding: Binding、managementCapability: unknown
     * @returns loadの計算結果を返す。
     * @precondition 「binding: Binding、managementCapability: unknown」がloadの入力契約を満たす。
     * @postcondition loadの責務を完了した結果だけを返す。
     * @effect N/A: loadは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure loadは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant loadは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: loadはProcess内の同一Subsystemで完結する。
     * @security loadはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: loadは共有非同期状態を持たない同期処理である。
     */
    load(binding: Binding, managementCapability: unknown) {
      try {
        const value = snapshotPlainRecord(
          binding,
          new Set(["operationId", "provider"]),
        );
        if (
          !value ||
          Object.keys(value).length !== 2 ||
          typeof value.operationId !== "string" ||
          typeof value.provider !== "string"
        )
          return null;
        const fixedBinding = Object.freeze({
          operationId: value.operationId,
          provider: value.provider,
        });
        const now = dependencies.wallNow();
        if (!Number.isFinite(now) || now < 0) return null;
        if (
          dependencies.verifyOperation(fixedBinding, managementCapability) !==
          true
        )
          return null;
        const key = `${fixedBinding.operationId}\0${fixedBinding.provider}`;
        const current = sources.get(key);
        if (current && now < current.expiresAtMs) return current.source;
        const source = createSource(fixedBinding, now);
        if (!source) return null;
        sources.set(
          key,
          Object.freeze({ source, expiresAtMs: now + SOURCE_LIFETIME_MS }),
        );
        return source;
      } catch {
        return null;
      }
    },
  });
}

const productionRuntime = createRuntime(
  Object.freeze({
    wallNow: Date.now,
    verifyOperation: (binding, managementCapability) => {
      const operation =
        verifyOwnedOperationManagementCapability(managementCapability);
      if (operation.operationId !== binding.operationId) return false;
      const context =
        inspectRuntimeOwnedDevelopmentOperationContext(managementCapability);
      return context === null || context.checkNewWork() === true;
    },
  }),
);

/**
 * Runtime 所有 Local Personal Authorityを読み込む。
 *
 * @responsibility Runtime 所有 Local Personal Authorityの読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000014
 * @input binding: Binding、managementCapability: unknown
 * @returns loadRuntimeOwnedLocalPersonalAuthorityの計算結果を返す。
 * @precondition 呼出し側は現在Operationの管理参照と同じOperation／ProviderのBindingを渡す。
 * @postcondition loadRuntimeOwnedLocalPersonalAuthorityの責務を完了した結果だけを返す。
 * @effect 既存Ownerが管理参照の現在実体を読取り確認し、Process内cacheだけを更新し得る。
 * @failure N/A: loadRuntimeOwnedLocalPersonalAuthorityは独自の失敗分岐を所有しない。
 * @invariant loadRuntimeOwnedLocalPersonalAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 現在Operationの管理OwnerとProvider許可元生成の境界。
 * @security loadRuntimeOwnedLocalPersonalAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 同期確認をcache参照前に一回行い、各loadで失効を再確認する。
 */
export function loadRuntimeOwnedLocalPersonalAuthority(
  binding: Binding,
  managementCapability: unknown,
) {
  return productionRuntime.load(binding, managementCapability);
}

/**
 * Isolated Local Personal Authority Runtime 候補を構築する。
 *
 * @responsibility Isolated Local Personal Authority Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000014
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedLocalPersonalAuthorityRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedLocalPersonalAuthorityRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedLocalPersonalAuthorityRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedLocalPersonalAuthorityRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedLocalPersonalAuthorityRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedLocalPersonalAuthorityRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedLocalPersonalAuthorityRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const runtime = createRuntime(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    load: runtime.load,
  });
}

/**
 * Local Personal Authority Runtime 契約の公開契約を記述する。
 *
 * @responsibility Local Personal Authority Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeLocalPersonalAuthorityRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeLocalPersonalAuthorityRuntimeContractの入力契約を満たす。
 * @postcondition describeLocalPersonalAuthorityRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeLocalPersonalAuthorityRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeLocalPersonalAuthorityRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeLocalPersonalAuthorityRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeLocalPersonalAuthorityRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeLocalPersonalAuthorityRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeLocalPersonalAuthorityRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeLocalPersonalAuthorityRuntimeContract() {
  return Object.freeze({
    contract: LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT,
    contractRevision: LOCAL_PERSONAL_AUTHORITY_RUNTIME_CONTRACT_REVISION,
    trustProfile: "local_personal_t1_t2",
    providers: Object.freeze(["codex", "claude"]),
    releaseTrust: "not_required_for_runtime_authority",
    operationBinding: "runtime_owned_exact_operation_provider",
    externalAuthorityRootRequired: false,
    managedAuthorityProfileSupported: false,
    providerEffectAllowed: false,
  });
}

const prelaunchValidationOPERATION_ID = /^OP-[0-9]{6,}$/u;

const prelaunchValidationSCOPE_ID = /^SCOPE-[0-9]{6,}$/u;

const CONTEXT_KEYS = new Set([
  "provider",
  "operationId",
  "scopeId",
  "providerHomeMountGrantRef",
]);

const INTRINSIC_DATE = Date;

const INTRINSIC_DATE_NOW = Date.now;

const INTRINSIC_DATE_TO_ISO = Date.prototype.toISOString;

/**
 * authority-prelaunch-verifierを停止結果として構築する。
 *
 * @responsibility authority-prelaunch-verifierの停止理由、未発行Effect、公開結果境界を所有する。
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
function prelaunchValidationBlocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    verification: null,
    runtimeCapabilityIssued: false,
  });
}

/**
 * runtime Nowを決定する。
 *
 * @responsibility runtime Nowの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Contextを固定Schemaへ正規化する。
 *
 * @responsibility Contextの入力検証、正規化規則、不正値の拒否境界を所有する。
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
    typeof context.operationId !== "string" ||
    context.operationId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !prelaunchValidationOPERATION_ID.test(context.operationId) ||
    typeof context.scopeId !== "string" ||
    context.scopeId.length > PROVIDER_INPUT_LIMITS.identifierLength ||
    !prelaunchValidationSCOPE_ID.test(context.scopeId) ||
    !isProviderHomeMountGrantRef(context.providerHomeMountGrantRef)
  )
    return null;
  return Object.freeze({
    provider: context.provider,
    operationId: context.operationId,
    scopeId: context.scopeId,
    providerHomeMountGrantRef: context.providerHomeMountGrantRef,
  });
}

/**
 * reverify Authority Before Provider Launchを決定する。
 *
 * @responsibility reverify Authority Before Provider Launchの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
    if (!context)
      return prelaunchValidationBlocked("prelaunch_authority_context_invalid");

    const bundle = loadAuthorityFileBundleCandidate(rawBundle);
    if (bundle.status !== "candidate")
      return prelaunchValidationBlocked(
        "prelaunch_authority_file_bundle_invalid",
      );

    const evaluatedAt = runtimeNow();
    if (!evaluatedAt)
      return prelaunchValidationBlocked("prelaunch_runtime_clock_invalid");
    const authority = evaluateAuthorityGrantCandidate(
      rawProfile,
      bundle.registry,
      {
        provider: context.provider,
        operationId: context.operationId,
        scopeId: context.scopeId,
        providerHomeMountGrantRef: context.providerHomeMountGrantRef,
        now: evaluatedAt,
      },
    );
    if (authority.status !== "candidate")
      return prelaunchValidationBlocked(authority.reason);
    if (authority.registryHash !== bundle.registryHash) {
      return prelaunchValidationBlocked(
        "prelaunch_authority_registry_identity_mismatch",
      );
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
    return prelaunchValidationBlocked("prelaunch_authority_input_invalid");
  }
}

/**
 * Authority Prelaunch Verifier 契約の公開契約を記述する。
 *
 * @responsibility Authority Prelaunch Verifier 契約の公開field、非公開境界、互換性を所有する。
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

const rootCapabilities = new WeakMap<
  object,
  Readonly<{
    rootPath: string;
    kind: "runtime_state";
    identityHash: string;
    protectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
  }>
>();

/**
 * runtime-state-windows-adapterを停止結果として構築する。
 *
 * @responsibility runtime-state-windows-adapterの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000015
 * @input reason: string、effects: Readonly<{ processEffectIssued?: boolean; helperExitConfirmed?: boolean; filesystemEffectIssued?: boolean; }>
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、effects: Readonly<{ processEffectIssued?: boolean; helperExitConfirmed?: boolean; filesystemEffectIssued?: boolean; }>」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function protectedRootBlocked(
  reason: string,
  effects: Readonly<{
    processEffectIssued?: boolean;
    helperExitConfirmed?: boolean;
    filesystemEffectIssued?: boolean;
  }> = Object.freeze({}),
) {
  const processEffectIssued = effects.processEffectIssued === true;
  const filesystemEffectIssued = effects.filesystemEffectIssued === true;
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rootCapability: null,
    runtimeStateIdentityHash: null,
    runtimeStateProtectionHash: null,
    localUserBindingHash: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    nativeSourceRevision: null,
    artifactVerifiedBeforeAndAfter: false,
    helperSpawnAttempts: processEffectIssued ? 1 : 0,
    helperExitConfirmed: effects.helperExitConfirmed === true,
    pathReported: false,
    principalReported: false,
    aclReported: false,
    filesystemEffectIssued,
    networkEffectIssued: false,
    processEffectIssued,
    runtimeAuthorityIssued: false,
    manualRecoveryRequired: processEffectIssued || filesystemEffectIssued,
  });
}

/**
 * root Path 候補を決定する。
 *
 * @responsibility root Path 候補の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input 既存Host環境だけを使用する。
 * @returns rootPathCandidateの計算結果を返す。
 * @precondition 「kind: "runtime_state"」がrootPathCandidateの入力契約を満たす。
 * @postcondition rootPathCandidateの責務を完了した結果だけを返す。
 * @effect rootPathCandidateは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: rootPathCandidateは独自の失敗分岐を所有しない。
 * @invariant rootPathCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security rootPathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rootPathCandidateは共有非同期状態を持たない同期処理である。
 */
function rootPathCandidate() {
  const localAppData = process.env.LOCALAPPDATA;
  if (
    !isSupportedWindowsAbsolutePathCandidate(localAppData) ||
    path.win32.normalize(localAppData) !== localAppData
  ) {
    return null;
  }
  const rootPath = path.win32.join(
    localAppData,
    "Qual-Lab",
    "CRDD",
    "RuntimeState",
  );
  return isSupportedWindowsAbsolutePathCandidate(rootPath) ? rootPath : null;
}

/**
 * Runtime 所有 Windows Protected Rootを観測する。
 *
 * @responsibility Runtime 所有 Windows Protected Rootの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000015
 * @input kind: "runtime_state"、initializeIfMissing: unknown、developmentContext: unknown
 * @returns inspectRuntimeOwnedWindowsProtectedRootの計算結果を返す。
 * @precondition 「kind: "runtime_state"、initializeIfMissing: unknown、developmentContext: unknown」がinspectRuntimeOwnedWindowsProtectedRootの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedWindowsProtectedRootの責務を完了した結果だけを返す。
 * @effect inspectRuntimeOwnedWindowsProtectedRootは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: inspectRuntimeOwnedWindowsProtectedRootは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedWindowsProtectedRootは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectRuntimeOwnedWindowsProtectedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedWindowsProtectedRootは共有非同期状態を持たない同期処理である。
 */
function inspectRuntimeOwnedWindowsProtectedRoot(
  kind: "runtime_state",
  initializeIfMissing: unknown,
  developmentContext?: unknown,
) {
  if (process.platform !== "win32")
    return protectedRootBlocked(
      "runtime_state_windows_adapter_platform_unsupported",
    );
  const rootPath = rootPathCandidate();
  if (!rootPath)
    return protectedRootBlocked("runtime_state_windows_adapter_root_invalid");
  const native = observeWindowsRuntimeState(
    rootPath,
    initializeIfMissing,
    developmentContext === undefined
      ? undefined
      : () => {
          const development = borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext as object,
            initializeIfMissing === true,
          );
          return development
            ? Object.freeze({
                distributionRoot: development.distributionRoot,
                expectedArtifact:
                  development.verification.status === "candidate"
                    ? development.verification.platformAccessArtifact
                    : null,
              })
            : null;
        },
  );
  if (native.status !== "candidate")
    return protectedRootBlocked(
      `runtime_state_windows_adapter_${native.reason}`,
      Object.freeze({
        processEffectIssued: native.processEffectIssued,
        helperExitConfirmed: native.helperExitConfirmed,
        filesystemEffectIssued:
          initializeIfMissing === true && native.processEffectIssued,
      }),
    );
  const observation = native;
  const rootCapability = Object.freeze({});
  const identityHash = observation.runtimeStateIdentityHash;
  const protectionHash = observation.runtimeStateProtectionHash;
  rootCapabilities.set(
    rootCapability,
    Object.freeze({
      rootPath,
      kind,
      identityHash,
      protectionHash,
      localUserBindingHash: observation.localUserBindingHash,
      stableLogicalHomeBindingHash: observation.stableLogicalHomeBindingHash,
    }),
  );
  return Object.freeze({
    ...observation,
    reason: "runtime_owned_windows_runtime_state_observed",
    rootCapability,
    nativeSourceRevision: null,
    executionSourceKind: native.executionSourceKind,
    artifactVerifiedBeforeAndAfter: true,
    helperSpawnAttempts: 1,
    helperExitConfirmed: true,
    filesystemEffectIssued: initializeIfMissing === true,
    processEffectIssued: true,
    manualRecoveryRequired: false,
  });
}

/**
 * Runtime 所有 Windows Runtime 状態を観測する。
 *
 * @responsibility Runtime 所有 Windows Runtime 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000015
 * @input initializeIfMissing: unknown、developmentContext: unknown
 * @returns inspectRuntimeOwnedWindowsRuntimeStateの計算結果を返す。
 * @precondition 「initializeIfMissing: unknown、developmentContext: unknown」がinspectRuntimeOwnedWindowsRuntimeStateの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedWindowsRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedWindowsRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedWindowsRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedWindowsRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectRuntimeOwnedWindowsRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedWindowsRuntimeStateは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedWindowsRuntimeState(
  initializeIfMissing: unknown,
  developmentContext?: unknown,
) {
  return inspectRuntimeOwnedWindowsProtectedRoot(
    "runtime_state",
    initializeIfMissing,
    developmentContext,
  );
}

/**
 * Runtime 所有 Runtime 状態 Root Capabilityを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Runtime 状態 Root Capabilityの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input capability: unknown
 * @returns consumeRuntimeOwnedRuntimeStateRootCapabilityの計算結果を返す。
 * @precondition 「capability: unknown」がconsumeRuntimeOwnedRuntimeStateRootCapabilityの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedRuntimeStateRootCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedRuntimeStateRootCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeRuntimeOwnedRuntimeStateRootCapabilityは独自の失敗分岐を所有しない。
 * @invariant consumeRuntimeOwnedRuntimeStateRootCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security consumeRuntimeOwnedRuntimeStateRootCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedRuntimeStateRootCapabilityは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedRuntimeStateRootCapability(
  capability: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const value = rootCapabilities.get(capability);
  rootCapabilities.delete(capability);
  return value?.kind === "runtime_state"
    ? Object.freeze({
        rootPath: value.rootPath,
        runtimeStateIdentityHash: value.identityHash,
        runtimeStateProtectionHash: value.protectionHash,
        localUserBindingHash: value.localUserBindingHash,
        stableLogicalHomeBindingHash: value.stableLogicalHomeBindingHash,
      })
    : null;
}

/**
 * Runtime State Windows Adapter 契約の公開契約を記述する。
 *
 * @responsibility Runtime State Windows Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRuntimeStateWindowsAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRuntimeStateWindowsAdapterContractの入力契約を満たす。
 * @postcondition describeRuntimeStateWindowsAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRuntimeStateWindowsAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRuntimeStateWindowsAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeRuntimeStateWindowsAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeRuntimeStateWindowsAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRuntimeStateWindowsAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeRuntimeStateWindowsAdapterContract() {
  return Object.freeze({
    platform: "windows",
    fixedSegments: Object.freeze(["Qual-Lab", "CRDD", "RuntimeState"]),
    runtimeStateFixedSegments: Object.freeze([
      "Qual-Lab",
      "CRDD",
      "RuntimeState",
    ]),
    nativeRootSource: "windows_known_folder_local_app_data",
    initialization:
      "create_missing_exact_selected_user_and_system_protected_dacl_without_repair",
    observation:
      "stable_fixed_volume_non_reparse_owner_selected_user_exact_protected_dacl",
    artifactVerification: Object.freeze({
      normal: "fixed_bootstrap_hash_and_artifact_identity_before_and_after",
      development:
        "fixed_development_borrowed_native_observation_and_artifact_identity_before_and_after",
    }),
    callerSuppliedPathAccepted: false,
    inheritedEnvironmentTrustedDirectly: false,
    environment: WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
    environmentUnavailable: Object.freeze({
      helperSpawnAttempts: 0,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      rootCapabilityIssued: false,
      runtimeAuthorityIssued: false,
    }),
    rawPathReported: false,
    rawPrincipalReported: false,
    rawAclReported: false,
    networkEffectIssued: false,
  });
}

export const PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-home-mount-grant-runtime";

export const PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT_REVISION = 4;

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
type providerHomeMountAuthorizationRuntimeState = Readonly<{
  mountCompletions: WeakMap<
    object,
    Readonly<{
      managementCapability: unknown;
      activeMountCapability: object;
      operationId: string;
      stableLogicalHomeBindingHash: string;
    }>
  >;
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
function providerHomeMountAuthorizationCreateRuntimeState(
  dependencies: Pick<
    providerHomeMountAuthorizationRuntimeState,
    | "verifyOperation"
    | "consumeObservation"
    | "consumeMountSource"
    | "revokeMountSource"
    | "wallNow"
    | "monotonicNow"
    | "randomBytes"
    | "production"
  >,
): providerHomeMountAuthorizationRuntimeState {
  return Object.freeze({
    mountCompletions: new WeakMap(),
    aliases: new WeakMap(),
    activeGrants: new Map(),
    activeHomeBindings: new Map(),
    ...dependencies,
  });
}

const providerHomeMountAuthorizationProductionState =
  providerHomeMountAuthorizationCreateRuntimeState({
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
function providerHomeMountAuthorizationBlocked(reason: string) {
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
    return providerHomeMountAuthorizationBlocked(reason);
  }
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
function runtimeGrantRef(state: providerHomeMountAuthorizationRuntimeState) {
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
  state: providerHomeMountAuthorizationRuntimeState,
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
  state: providerHomeMountAuthorizationRuntimeState,
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
  state: providerHomeMountAuthorizationRuntimeState,
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
 * @input binding: Readonly<{ operationId: string }>、observation: Observation、grantRef: string、issuedWallClockMs: number
 * @returns Grant | nullを返す。
 * @precondition 「binding: Readonly<{ operationId: string }>、observation: Observation、grantRef: string、issuedWallClockMs: number」がgrantRecordの入力契約を満たす。
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
  observation: Observation,
  grantRef: string,
  issuedWallClockMs: number,
): Grant | null {
  const prepared: Grant = Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    grantRef,
    provider: observation.provider,
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
function currentRuntimeAge(
  state: providerHomeMountAuthorizationRuntimeState,
  runtimeGrant: RuntimeGrant,
) {
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
  state: providerHomeMountAuthorizationRuntimeState,
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
  state: providerHomeMountAuthorizationRuntimeState,
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
function revokeAllAliases(
  state: providerHomeMountAuthorizationRuntimeState,
  runtimeGrant: RuntimeGrant,
) {
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
function revokeMountSource(
  state: providerHomeMountAuthorizationRuntimeState,
  runtimeGrant: RuntimeGrant,
) {
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
 * @input state: RuntimeState、managementCapability: unknown、observationCapability: unknown
 * @returns issueの計算結果を返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown、observationCapability: unknown」がissueの入力契約を満たす。
 * @postcondition issueの責務を完了した結果だけを返す。
 * @effect N/A: issueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueは独自の失敗分岐を所有しない。
 * @invariant issueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueはProcess内の同一Subsystemで完結する。
 * @security issueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueは共有非同期状態を持たない同期処理である。
 */
function issue(
  state: providerHomeMountAuthorizationRuntimeState,
  managementCapability: unknown,
  observationCapability: unknown,
) {
  const binding = operationBinding(state, managementCapability);
  if (
    !binding ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_operation_invalid",
    );
  }
  const observation = state.consumeObservation(observationCapability);
  if (!observation) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_observation_invalid",
    );
  }
  const grantRef = runtimeGrantRef(state);
  if (!grantRef) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_reference_unavailable",
    );
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_clock_invalid",
    );
  }
  const grant = grantRecord(binding, observation, grantRef, issuedWallClockMs);
  if (!grant) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_issuance_invalid",
    );
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
    ...providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_issued",
    ),
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
  state: providerHomeMountAuthorizationRuntimeState,
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_use_invalid",
    );
  }
  const runtimeGrant = use.runtimeGrant;
  if (
    runtimeGrant.grant.state !== "issued" ||
    state.activeGrants.get(runtimeGrant.grant.grantRef) !== runtimeGrant
  ) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_not_usable",
    );
  }
  const observation = state.consumeObservation(currentObservationCapability);
  if (!observation) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_observation_invalid",
    );
  }
  const age = currentRuntimeAge(state, runtimeGrant);
  if (!age) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_expired",
    );
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_observation_mismatch",
    );
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_consumption_invalid",
    );
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
    ...providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_consumed",
    ),
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
  state: providerHomeMountAuthorizationRuntimeState,
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_activation_invalid",
    );
  }
  const runtimeGrant = authorization.runtimeGrant;
  const logicalHomeBinding = runtimeGrant.grant.stableLogicalHomeBindingHash;
  const currentHomeBinding = state.activeHomeBindings.get(logicalHomeBinding);
  if (currentHomeBinding && currentHomeBinding !== runtimeGrant) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_logical_home_already_active",
    );
  }
  const sourcePath = state.consumeMountSource(
    runtimeGrant.mountSourceCapability,
    runtimeGrant.grant.provider,
  );
  runtimeGrant.mountSourceCapability = null;
  if (!sourcePath) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_source_binding_invalid",
    );
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
    ...providerHomeMountAuthorizationBlocked("provider_home_mount_activated"),
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
  state: providerHomeMountAuthorizationRuntimeState,
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
  state: providerHomeMountAuthorizationRuntimeState,
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_active_mount_inspection_invalid",
    );
  }
  const grant = active.runtimeGrant.grant;
  return Object.freeze({
    ...providerHomeMountAuthorizationBlocked(
      "provider_home_active_mount_confirmed",
    ),
    status: "active" as const,
    grant,
    grantRef: grant.grantRef,
    provider: grant.provider,
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
  state: providerHomeMountAuthorizationRuntimeState,
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_completion_invalid",
    );
  }
  const runtimeGrant = active.runtimeGrant;
  const logicalHomeBinding = runtimeGrant.grant.stableLogicalHomeBindingHash;
  if (state.activeHomeBindings.get(logicalHomeBinding) !== runtimeGrant) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_completion_owner_mismatch",
    );
  }
  runtimeGrant.mountActive = false;
  runtimeGrant.activeMountSourcePath = null;
  state.activeHomeBindings.delete(logicalHomeBinding);
  removeAlias(state, runtimeGrant, activeMountCapability);
  const result = Object.freeze({
    ...providerHomeMountAuthorizationBlocked("provider_home_mount_completed"),
    status: "completed" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
    providerHomeMountGrantIssued: true,
  });
  state.mountCompletions.set(
    result,
    Object.freeze({
      managementCapability,
      activeMountCapability,
      operationId: runtimeGrant.grant.operationId,
      stableLogicalHomeBindingHash: logicalHomeBinding,
    }),
  );
  return result;
}

/**
 * 同じMount Ownerが返した完了結果を対象操作へ照合する。
 *
 * @responsibility 元結果の出自とMount・操作・Homeの一致を確認する。
 * @trace ARCH-000010
 * @input state: 結果Owner。result: 元結果。managementCapability、activeMountCapability、operationId、stableLogicalHomeBindingHash: 対象。
 * @returns 元のMount完了を確認できた場合だけtrue。
 * @precondition 完了は同じRuntimeのcompleteMountから返却されている。
 * @postcondition コピー、別Owner、別操作と別Mountを拒否する。
 * @effect N/A: Process内WeakMapの同期読取りだけ。
 * @failure 未登録または相関不一致はfalse。
 * @invariant Mount完了だけからDocker資源不存在や回復全体の完了を推定しない。
 * @boundary Mount所有者から同じ操作の終了処理への非Authority観測。
 * @security 保存値やCaller supplied結果から完了根拠を作らない。
 * @concurrency N/A: 待機と再発行を伴わない同期照合。
 */
function verifyMountCompletion(
  state: providerHomeMountAuthorizationRuntimeState,
  result: unknown,
  managementCapability: unknown,
  activeMountCapability: unknown,
  operationId: unknown,
  stableLogicalHomeBindingHash: unknown,
): boolean {
  const recorded =
    result && typeof result === "object"
      ? state.mountCompletions.get(result)
      : undefined;
  return (
    !!recorded &&
    recorded.managementCapability === managementCapability &&
    recorded.activeMountCapability === activeMountCapability &&
    recorded.operationId === operationId &&
    recorded.stableLogicalHomeBindingHash === stableLogicalHomeBindingHash
  );
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
  state: providerHomeMountAuthorizationRuntimeState,
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_authorization_invalid",
    );
  }
  const grant = authorization.runtimeGrant.grant;
  return Object.freeze({
    ...providerHomeMountAuthorizationBlocked(
      "provider_home_mount_authorization_ready",
    ),
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
  state: providerHomeMountAuthorizationRuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const control = alias(state, controlCapability, "control");
  if (
    !control ||
    !sameManagementCapability(state, control.runtimeGrant, managementCapability)
  ) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_control_invalid",
    );
  }
  const runtimeGrant = control.runtimeGrant;
  if (runtimeGrant.mountActive) {
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_unmount_required",
    );
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
    return providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_revocation_invalid",
    );
  }
  runtimeGrant.grant = transition.grant as Grant;
  revokeMountSource(state, runtimeGrant);
  revokeAllAliases(state, runtimeGrant);
  state.activeGrants.delete(runtimeGrant.grant.grantRef);
  const logicalHomeBinding = runtimeGrant.grant.stableLogicalHomeBindingHash;
  if (state.activeHomeBindings.get(logicalHomeBinding) === runtimeGrant)
    state.activeHomeBindings.delete(logicalHomeBinding);
  return Object.freeze({
    ...providerHomeMountAuthorizationBlocked(
      "provider_home_mount_grant_runtime_revoked",
    ),
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
 * @input managementCapability: unknown、observationCapability: unknown
 * @returns issueRuntimeOwnedProviderHomeMountGrantの計算結果を返す。
 * @precondition 「managementCapability: unknown、observationCapability: unknown」がissueRuntimeOwnedProviderHomeMountGrantの入力契約を満たす。
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
) {
  return failClosed(
    "provider_home_mount_grant_runtime_issuance_failed_closed",
    () =>
      issue(
        providerHomeMountAuthorizationProductionState,
        managementCapability,
        observationCapability,
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
        providerHomeMountAuthorizationProductionState,
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
        providerHomeMountAuthorizationProductionState,
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
    () =>
      revoke(
        providerHomeMountAuthorizationProductionState,
        controlCapability,
        managementCapability,
      ),
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
      providerHomeMountAuthorizationProductionState,
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
      providerHomeMountAuthorizationProductionState,
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
      providerHomeMountAuthorizationProductionState,
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
    completeMount(
      providerHomeMountAuthorizationProductionState,
      activeMountCapability,
      managementCapability,
    ),
  );
}

/**
 * 本番Mount所有者の元完了結果を同じ対象へ照合する。
 *
 * @responsibility 模擬Runtimeの結果と本番結果を分離して終了根拠を搬送する。
 * @trace ARCH-000010
 * @input result: 元結果。managementCapability、activeMountCapability、operationId、stableLogicalHomeBindingHash: 対象。
 * @returns 同じ本番Mountの完了が確認できた場合だけtrue。
 * @precondition 実結果は本番Mount Ownerが返している。
 * @postcondition コピー・別Runtime・別対象を拒否する。
 * @effect N/A: 内部の結果相関の読取りだけ。
 * @failure 未登録または相関不一致はfalse。
 * @invariant Authorityを発行せず、Docker不存在やHome Lease解放へ保証を拡大しない。
 * @boundary 本番Mount Ownerと同じ操作の終了処理。
 * @security Path・秘密値・管理Capabilityを返却しない。
 * @concurrency N/A: 同期照合のみ。
 */
export function verifyRuntimeOwnedProviderHomeMountCompletion(
  result: unknown,
  managementCapability: unknown,
  activeMountCapability: unknown,
  operationId: unknown,
  stableLogicalHomeBindingHash: unknown,
): boolean {
  return verifyMountCompletion(
    providerHomeMountAuthorizationProductionState,
    result,
    managementCapability,
    activeMountCapability,
    operationId,
    stableLogicalHomeBindingHash,
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
    verifyOperation: providerHomeMountAuthorizationRuntimeState["verifyOperation"];
    consumeObservation: providerHomeMountAuthorizationRuntimeState["consumeObservation"];
    consumeMountSource: providerHomeMountAuthorizationRuntimeState["consumeMountSource"];
    revokeMountSource: providerHomeMountAuthorizationRuntimeState["revokeMountSource"];
    wallNow: providerHomeMountAuthorizationRuntimeState["wallNow"];
    monotonicNow: providerHomeMountAuthorizationRuntimeState["monotonicNow"];
    randomBytes: providerHomeMountAuthorizationRuntimeState["randomBytes"];
  }>,
) {
  const state = providerHomeMountAuthorizationCreateRuntimeState({
    ...dependencies,
    production: false,
  });
  return Object.freeze({
    productionAuthority: false as const,
    issue: (managementCapability: unknown, observationCapability: unknown) =>
      failClosed(
        "provider_home_mount_grant_runtime_issuance_failed_closed",
        () => issue(state, managementCapability, observationCapability),
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
    verifyMountCompletion: (
      result: unknown,
      managementCapability: unknown,
      activeMountCapability: unknown,
      operationId: unknown,
      stableLogicalHomeBindingHash: unknown,
    ) =>
      verifyMountCompletion(
        state,
        result,
        managementCapability,
        activeMountCapability,
        operationId,
        stableLogicalHomeBindingHash,
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

export const PROVIDER_HOME_MOUNT_GRANT_CONTRACT =
  "crdd-coordinator/provider-home-mount-grant";

export const PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION = 4;

export const PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS = 300_000;

const PROVIDERS = new Set(["codex", "claude"]);

const STATES = new Set(["prepared", "issued", "consumed", "revoked"]);

const providerHomeMountGrantGRANT_REF = /^PHMGRANT-[0-9]{6,}$/u;

const providerHomeMountGrantOPERATION_ID = /^OP-[0-9]{6,}$/u;

const HEX64 = /^[0-9a-f]{64}$/u;

const RECORD_KEYS = new Set([
  "contract",
  "contractRevision",
  "grantRef",
  "provider",
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
 * provider-home-mount-grantを停止結果として構築する。
 *
 * @responsibility provider-home-mount-grantの停止理由、未発行Effect、公開結果境界を所有する。
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
function providerHomeMountGrantBlocked(reason: string) {
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
 * identifierを決定する。
 *
 * @responsibility identifierの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Provider Home Mount Grant Refかを判定する。
 *
 * @responsibility Provider Home Mount Grant Refの判定条件とtrue／false境界を所有する。
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
  return identifier(value, providerHomeMountGrantGRANT_REF);
}

/**
 * canonical Utcを決定する。
 *
 * @responsibility canonical Utcの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * optional Canonical Utcを決定する。
 *
 * @responsibility optional Canonical Utcの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Internalを機械利用可能な契約へ変換する。
 *
 * @responsibility Internalの入力Schema、決定論的変換、変換不能時の拒否境界を所有する。
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
    !identifier(value.operationId, providerHomeMountGrantOPERATION_ID) ||
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
 * Provider Home Mount Grant 候補を機械利用可能な契約へ変換する。
 *
 * @responsibility Provider Home Mount Grant 候補の入力Schema、決定論的変換、変換不能時の拒否境界を所有する。
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
    if (!grant)
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_record_invalid",
      );
    return Object.freeze({
      ...providerHomeMountGrantBlocked(
        "provider_home_mount_grant_structural_candidate_only",
      ),
      status: "candidate" as const,
      grant,
    });
  } catch {
    return providerHomeMountGrantBlocked(
      "provider_home_mount_grant_record_invalid",
    );
  }
}

/**
 * Bindingが同一かを判定する。
 *
 * @responsibility Bindingの同一性Propertyと一致／不一致境界を所有する。
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
 * Provider Home Mount Grant Transition 候補を評価する。
 *
 * @responsibility Provider Home Mount Grant Transition 候補の評価入力、判定規則、判断不能結果の境界を所有する。
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
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_transition_input_invalid",
      );
    const previous = compileInternal(input.previous);
    const next = compileInternal(input.next);
    if (!previous || !next)
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_transition_record_invalid",
      );
    if (!sameBinding(previous, next))
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_transition_binding_mismatch",
      );
    const isAllowed =
      (previous.state === "prepared" && next.state === "issued") ||
      (previous.state === "issued" &&
        (next.state === "consumed" || next.state === "revoked")) ||
      (previous.state === "consumed" && next.state === "revoked");
    if (!isAllowed)
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_transition_not_allowed",
      );
    if (
      previous.state !== "prepared" &&
      (next.issuedAt !== previous.issuedAt ||
        next.expiresAt !== previous.expiresAt ||
        (previous.state === "consumed" &&
          next.consumedAt !== previous.consumedAt))
    )
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_transition_time_mismatch",
      );
    return Object.freeze({
      ...providerHomeMountGrantBlocked(
        "provider_home_mount_grant_transition_runtime_store_and_effect_required",
      ),
      status: "candidate" as const,
      grant: next,
    });
  } catch {
    return providerHomeMountGrantBlocked(
      "provider_home_mount_grant_transition_input_invalid",
    );
  }
}

/**
 * Provider Home Mount Grant Use 候補を評価する。
 *
 * @responsibility Provider Home Mount Grant Use 候補の評価入力、判定規則、判断不能結果の境界を所有する。
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
    if (!input)
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_use_input_invalid",
      );
    const grant = compileInternal(input.grant);
    if (!grant)
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_use_record_invalid",
      );
    if (
      input.provider !== grant.provider ||
      input.operationId !== grant.operationId ||
      !isProviderHomeMountGrantRef(input.providerHomeMountGrantRef) ||
      input.providerHomeMountGrantRef !== grant.grantRef
    )
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_use_binding_mismatch",
      );
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
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_use_observation_invalid",
      );
    if (
      input.observedProviderHomeIdentityHash !==
        grant.providerHomeIdentityHash ||
      input.observedProviderHomeProtectionHash !==
        grant.providerHomeProtectionHash ||
      input.observedLocalUserBindingHash !== grant.localUserBindingHash ||
      input.observedStableLogicalHomeBindingHash !==
        grant.stableLogicalHomeBindingHash
    )
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_use_observation_mismatch",
      );
    if (!canonicalUtc(input.observedAt))
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_observed_at_invalid",
      );
    if (grant.state !== "issued")
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_not_usable",
      );
    const observedAt = Date.parse(input.observedAt);
    if (
      observedAt < Date.parse(grant.issuedAt as string) ||
      observedAt >= Date.parse(grant.expiresAt as string)
    )
      return providerHomeMountGrantBlocked(
        "provider_home_mount_grant_expired_or_not_yet_valid",
      );
    return Object.freeze({
      ...providerHomeMountGrantBlocked(
        "provider_home_mount_grant_runtime_clock_store_and_mount_adapter_required",
      ),
      status: "candidate" as const,
      grant,
    });
  } catch {
    return providerHomeMountGrantBlocked(
      "provider_home_mount_grant_use_input_invalid",
    );
  }
}

/**
 * Provider Home Mount Grant 契約の公開契約を記述する。
 *
 * @responsibility Provider Home Mount Grant 契約の公開field、非公開境界、互換性を所有する。
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
    providerOperationBindingRequired: true,
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

export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT =
  "crdd-coordinator/provider-home-windows-adapter";

export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION = 7;

const HELPER_TIMEOUT_MS = 5_000;

const OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS = 10_000;

const observationCapabilities = new WeakMap<
  object,
  Readonly<{
    provider: ProviderHomeObservationProvider;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    observedWallClockMs: number;
    observedMonotonicMs: number;
    providerHomeMountSourceCapability: object;
  }>
>();

const mountSourceCapabilities = new WeakMap<
  object,
  Readonly<{
    provider: ProviderHomeObservationProvider;
    sourcePath: string;
  }>
>();

/**
 * runtime 所有 Provider Home Mount Source 候補を決定する。
 *
 * @responsibility runtime 所有 Provider Home Mount Source 候補の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input provider: unknown
 * @returns runtimeOwnedProviderHomeMountSourceCandidateの計算結果を返す。
 * @precondition 「provider: unknown」がruntimeOwnedProviderHomeMountSourceCandidateの入力契約を満たす。
 * @postcondition runtimeOwnedProviderHomeMountSourceCandidateの責務を完了した結果だけを返す。
 * @effect runtimeOwnedProviderHomeMountSourceCandidateは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: runtimeOwnedProviderHomeMountSourceCandidateは独自の失敗分岐を所有しない。
 * @invariant runtimeOwnedProviderHomeMountSourceCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runtimeOwnedProviderHomeMountSourceCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runtimeOwnedProviderHomeMountSourceCandidateは共有非同期状態を持たない同期処理である。
 */
function runtimeOwnedProviderHomeMountSourceCandidate(provider: unknown) {
  if (provider !== "codex" && provider !== "claude") return null;
  const localAppData = process.env.LOCALAPPDATA;
  if (
    !isSupportedWindowsAbsolutePathCandidate(localAppData) ||
    path.win32.normalize(localAppData) !== localAppData
  ) {
    return null;
  }
  const sourcePath = path.win32.join(
    localAppData,
    "Qual-Lab",
    "CRDD",
    "ProviderHomes",
    provider,
  );
  return isSupportedWindowsAbsolutePathCandidate(sourcePath) &&
    !sourcePath.includes(",")
    ? sourcePath
    : null;
}

/**
 * provider-home-windows-adapterを停止結果として構築する。
 *
 * @responsibility provider-home-windows-adapterの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000010
 * @input reason: 停止理由。effects: Process発行・補助子起動・正常終了の観測。
 * @returns blockedの計算結果を返す。
 * @precondition effectsは呼出し側が観測した事実だけを含む。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function providerHomeWindowsAdapterBlocked(
  reason: string,
  effects: Readonly<{
    processEffectIssued?: boolean;
    helperSpawned?: boolean;
    helperExitConfirmed?: boolean;
  }> = Object.freeze({}),
) {
  const processEffectIssued = effects.processEffectIssued === true;
  const helperSpawned = effects.helperSpawned === true;
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    providerHomeIdentityHash: null,
    providerHomeProtectionHash: null,
    localUserBindingHash: null,
    stableLogicalHomeBindingHash: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    nativeSourceRevision: null,
    artifactVerifiedBeforeAndAfter: false,
    helperSpawnAttempts: helperSpawned ? 1 : 0,
    helperSpawned,
    helperExitConfirmed: helperSpawned && effects.helperExitConfirmed === true,
    processTreeTerminationConfirmed: false,
    pathReported: false,
    principalReported: false,
    aclReported: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    observationCapability: null,
    runtimeOwnedObservationCapabilityIssued: false,
    mountGrantIssued: false,
    manualRecoveryRequired: processEffectIssued,
  });
}

/**
 * Runtime 所有 Windows Provider Home 候補を観測する。
 *
 * @responsibility Runtime 所有 Windows Provider Home 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input provider: unknown、developmentContext: unknown
 * @returns inspectRuntimeOwnedWindowsProviderHomeCandidateの計算結果を返す。
 * @precondition 「provider: unknown、developmentContext: unknown」がinspectRuntimeOwnedWindowsProviderHomeCandidateの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedWindowsProviderHomeCandidateの責務を完了した結果だけを返す。
 * @effect inspectRuntimeOwnedWindowsProviderHomeCandidateは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: inspectRuntimeOwnedWindowsProviderHomeCandidateは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedWindowsProviderHomeCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectRuntimeOwnedWindowsProviderHomeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedWindowsProviderHomeCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedWindowsProviderHomeCandidate(
  provider: unknown,
  developmentContext?: unknown,
) {
  if (process.platform !== "win32") {
    return providerHomeWindowsAdapterBlocked(
      "provider_home_windows_adapter_platform_unsupported",
    );
  }
  const mountSourcePath =
    runtimeOwnedProviderHomeMountSourceCandidate(provider);
  const native = observeWindowsProviderHome(
    provider,
    mountSourcePath,
    developmentContext === undefined
      ? undefined
      : () => {
          const development = borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext as object,
            false,
          );
          return development
            ? Object.freeze({
                distributionRoot: development.distributionRoot,
                expectedArtifact:
                  development.verification.status === "candidate"
                    ? development.verification.platformAccessArtifact
                    : null,
              })
            : null;
        },
  );
  if (native.status !== "candidate")
    return providerHomeWindowsAdapterBlocked(
      `provider_home_windows_adapter_${native.reason}`,
      {
        processEffectIssued: native.processEffectIssued,
        helperSpawned: native.processEffectIssued,
        helperExitConfirmed: native.helperExitConfirmed,
      },
    );
  const observation = native;
  const observedWallClockMs = Date.now();
  const observedMonotonicMs = performance.now();
  const observationCapability = Object.freeze({});
  const providerHomeMountSourceCapability = Object.freeze({});
  mountSourceCapabilities.set(
    providerHomeMountSourceCapability,
    Object.freeze({
      provider: observation.provider,
      sourcePath: mountSourcePath as string,
    }),
  );
  observationCapabilities.set(
    observationCapability,
    Object.freeze({
      provider: observation.provider,
      providerHomeIdentityHash: observation.providerHomeIdentityHash,
      providerHomeProtectionHash: observation.providerHomeProtectionHash,
      localUserBindingHash: observation.localUserBindingHash,
      stableLogicalHomeBindingHash: observation.stableLogicalHomeBindingHash,
      observedWallClockMs,
      observedMonotonicMs,
      providerHomeMountSourceCapability,
    }),
  );
  return Object.freeze({
    ...observation,
    reason: "runtime_owned_windows_provider_home_observed_candidate",
    provider: observation.provider as ProviderHomeObservationProvider,
    nativeSourceRevision: null,
    executionSourceKind: native.executionSourceKind,
    artifactVerifiedBeforeAndAfter: true,
    helperSpawnAttempts: 1,
    helperSpawned: true,
    helperExitConfirmed: true,
    processTreeTerminationConfirmed: false,
    processEffectIssued: true,
    manualRecoveryRequired: false,
    observationCapability: observationCapability as object,
    runtimeOwnedObservationCapabilityIssued: true,
  });
}

/**
 * Runtime 所有 Provider Home Observation Capabilityを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Provider Home Observation Capabilityの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000010
 * @input capability: unknown
 * @returns consumeRuntimeOwnedProviderHomeObservationCapabilityの計算結果を返す。
 * @precondition 「capability: unknown」がconsumeRuntimeOwnedProviderHomeObservationCapabilityの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedProviderHomeObservationCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedProviderHomeObservationCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeRuntimeOwnedProviderHomeObservationCapabilityは独自の失敗分岐を所有しない。
 * @invariant consumeRuntimeOwnedProviderHomeObservationCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security consumeRuntimeOwnedProviderHomeObservationCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedProviderHomeObservationCapabilityは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedProviderHomeObservationCapability(
  capability: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const observation = observationCapabilities.get(capability);
  observationCapabilities.delete(capability);
  if (!observation) return null;
  const wallAge = Date.now() - observation.observedWallClockMs;
  const monotonicAge = performance.now() - observation.observedMonotonicMs;
  if (
    !Number.isFinite(wallAge) ||
    !Number.isFinite(monotonicAge) ||
    wallAge < 0 ||
    monotonicAge < 0 ||
    wallAge > OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS ||
    monotonicAge > OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS
  ) {
    mountSourceCapabilities.delete(
      observation.providerHomeMountSourceCapability,
    );
    return null;
  }
  return observation;
}

/**
 * Runtime 所有 Provider Home Mount Source Capabilityを一回限りで消費する。
 *
 * @responsibility Runtime 所有 Provider Home Mount Source Capabilityの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000010
 * @input capability: unknown、expectedProvider: unknown
 * @returns consumeRuntimeOwnedProviderHomeMountSourceCapabilityの計算結果を返す。
 * @precondition 「capability: unknown、expectedProvider: unknown」がconsumeRuntimeOwnedProviderHomeMountSourceCapabilityの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedProviderHomeMountSourceCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedProviderHomeMountSourceCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeRuntimeOwnedProviderHomeMountSourceCapabilityは独自の失敗分岐を所有しない。
 * @invariant consumeRuntimeOwnedProviderHomeMountSourceCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security consumeRuntimeOwnedProviderHomeMountSourceCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedProviderHomeMountSourceCapabilityは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedProviderHomeMountSourceCapability(
  capability: unknown,
  expectedProvider: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const source = mountSourceCapabilities.get(capability);
  mountSourceCapabilities.delete(capability);
  return source && source.provider === expectedProvider
    ? source.sourcePath
    : null;
}

/**
 * Runtime 所有 Provider Home Mount Source Capabilityを失効させる。
 *
 * @responsibility Runtime 所有 Provider Home Mount Source Capabilityの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000010
 * @input capability: unknown
 * @returns revokeRuntimeOwnedProviderHomeMountSourceCapabilityの計算結果を返す。
 * @precondition 「capability: unknown」がrevokeRuntimeOwnedProviderHomeMountSourceCapabilityの入力契約を満たす。
 * @postcondition revokeRuntimeOwnedProviderHomeMountSourceCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: revokeRuntimeOwnedProviderHomeMountSourceCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeRuntimeOwnedProviderHomeMountSourceCapabilityは独自の失敗分岐を所有しない。
 * @invariant revokeRuntimeOwnedProviderHomeMountSourceCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security revokeRuntimeOwnedProviderHomeMountSourceCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeRuntimeOwnedProviderHomeMountSourceCapabilityは共有非同期状態を持たない同期処理である。
 */
export function revokeRuntimeOwnedProviderHomeMountSourceCapability(
  capability: unknown,
) {
  return (
    !!capability &&
    typeof capability === "object" &&
    mountSourceCapabilities.delete(capability)
  );
}

/**
 * Provider Home Windows Adapter 契約の公開契約を記述する。
 *
 * @responsibility Provider Home Windows Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderHomeWindowsAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderHomeWindowsAdapterContractの入力契約を満たす。
 * @postcondition describeProviderHomeWindowsAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderHomeWindowsAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderHomeWindowsAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderHomeWindowsAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeProviderHomeWindowsAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderHomeWindowsAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderHomeWindowsAdapterContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT,
    contractRevision: PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION,
    platform: "windows",
    distributionRoot: "module_relative_fixed_distribution_root",
    artifactVerification: Object.freeze({
      normal: "fixed_bootstrap_hash_and_artifact_identity_before_and_after",
      development:
        "fixed_development_borrowed_native_observation_and_artifact_identity_before_and_after",
    }),
    executablePath: "fixed_distribution_relative_absolute_path",
    providers: Object.freeze(["codex", "claude"]),
    shellInvocation: false,
    pathLookup: false,
    callerSuppliedPathAccepted: false,
    inheritedEnvironmentPathTrustedDirectly: false,
    mountSourceBinding:
      "runtime_candidate_hash_exactly_matched_by_native_known_folder_derivation",
    environment: WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
    environmentUnavailable: Object.freeze({
      helperSpawnAttempts: 0,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      observationCapabilityIssued: false,
      runtimeAuthorityIssued: false,
    }),
    timeoutMs: HELPER_TIMEOUT_MS,
    maximumStdoutBytes: describeProviderHomeObservationContract().responseBytes,
    maximumStderrBytes: 0,
    helperSpawnAttempts: 1,
    helperChildProcessImplementation: false,
    helperExitRequired: true,
    processTreeTerminationConfirmation:
      "not_implemented_step_4_runtime_process_controller_required",
    rawPathReported: false,
    rawPathAvailableOnlyToTrustedMountEffectAdapter: true,
    rawPrincipalReported: false,
    rawAclReported: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    observationCapability: "runtime_owned_opaque_single_use_maximum_10_seconds",
    observationCapabilityMaximumAgeMs: OBSERVATION_CAPABILITY_MAXIMUM_AGE_MS,
    mountGrantIssued: false,
  });
}

export const ROOT_PROTECTION_POLICY_CONTRACT =
  "crdd-coordinator/root-protection-policy";

export const ROOT_PROTECTION_POLICY_CONTRACT_REVISION = 1;

const rootProtectionPolicyINPUT_KEYS = new Set([
  "rootRole",
  "platformFamily",
  "filesystemClass",
  "observations",
]);

const rootProtectionPolicyOBSERVATION_KEYS = new Set([
  "rootExists",
  "stableIdentityObserved",
  "linkOrReparseObserved",
  "runtimeReadAllowed",
  "runtimeWriteAllowed",
  "writeAuthority",
  "untrustedWriteAllowed",
]);

const rootProtectionPolicyROOT_ROLES = new Set(["runtime", "authority"]);

const PLATFORM_FAMILIES = new Set(["windows", "posix"]);

const FILESYSTEM_CLASSES = new Set(["local", "persistent_volume"]);

const WRITE_AUTHORITIES = new Set([
  "runtime_principal_only",
  "provisioner_principal_only",
]);

const INPUT_TOKEN_LENGTH = 32;

/**
 * responseを決定する。
 *
 * @responsibility responseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input status: S、reason: string、policy: T | null
 * @returns responseの計算結果を返す。
 * @precondition 「status: S、reason: string、policy: T | null」がresponseの入力契約を満たす。
 * @postcondition responseの責務を完了した結果だけを返す。
 * @effect N/A: responseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: responseは独自の失敗分岐を所有しない。
 * @invariant responseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: responseはProcess内の同一Subsystemで完結する。
 * @security responseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: responseは共有非同期状態を持たない同期処理である。
 */
function response<const S extends string, T>(
  status: S,
  reason: string,
  policy: T | null = null,
) {
  return Object.freeze({
    status,
    reason,
    policy,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * Observationsを固定Schemaへ正規化する。
 *
 * @responsibility Observationsの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000014
 * @input rawObservations: unknown
 * @returns normalizeObservationsの計算結果を返す。
 * @precondition 「rawObservations: unknown」がnormalizeObservationsの入力契約を満たす。
 * @postcondition normalizeObservationsの責務を完了した結果だけを返す。
 * @effect N/A: normalizeObservationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeObservationsは独自の失敗分岐を所有しない。
 * @invariant normalizeObservationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeObservationsはProcess内の同一Subsystemで完結する。
 * @security normalizeObservationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeObservationsは共有非同期状態を持たない同期処理である。
 */
function normalizeObservations(rawObservations: unknown) {
  const observations = snapshotPlainRecord(
    rawObservations,
    rootProtectionPolicyOBSERVATION_KEYS,
  );
  if (
    !observations ||
    [...rootProtectionPolicyOBSERVATION_KEYS]
      .filter((key) => key !== "writeAuthority")
      .some((key) => typeof observations[key] !== "boolean") ||
    typeof observations.writeAuthority !== "string" ||
    observations.writeAuthority.length === 0 ||
    observations.writeAuthority.length > INPUT_TOKEN_LENGTH ||
    !WRITE_AUTHORITIES.has(observations.writeAuthority)
  ) {
    return null;
  }
  return Object.freeze({
    rootExists: observations.rootExists as boolean,
    stableIdentityObserved: observations.stableIdentityObserved as boolean,
    linkOrReparseObserved: observations.linkOrReparseObserved as boolean,
    runtimeReadAllowed: observations.runtimeReadAllowed as boolean,
    runtimeWriteAllowed: observations.runtimeWriteAllowed as boolean,
    writeAuthority: observations.writeAuthority,
    untrustedWriteAllowed: observations.untrustedWriteAllowed as boolean,
  });
}

/**
 * policy Summaryを決定する。
 *
 * @responsibility policy Summaryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input rootRole: string、platformFamily: string、filesystemClass: string、requiredWriteAuthority: string
 * @returns policySummaryの計算結果を返す。
 * @precondition 「rootRole: string、platformFamily: string、filesystemClass: string、requiredWriteAuthority: string」がpolicySummaryの入力契約を満たす。
 * @postcondition policySummaryの責務を完了した結果だけを返す。
 * @effect N/A: policySummaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: policySummaryは独自の失敗分岐を所有しない。
 * @invariant policySummaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: policySummaryはProcess内の同一Subsystemで完結する。
 * @security policySummaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: policySummaryは共有非同期状態を持たない同期処理である。
 */
function policySummary(
  rootRole: string,
  platformFamily: string,
  filesystemClass: string,
  requiredWriteAuthority: string,
) {
  return Object.freeze({
    rootRole,
    platformFamily,
    filesystemClass,
    runtimeAccess: rootRole === "runtime" ? "read_write" : "read_only",
    requiredWriteAuthority,
    untrustedWriteAllowed: false,
    absolutePathReported: false,
  });
}

/**
 * Root Protection Policy 候補を評価する。
 *
 * @responsibility Root Protection Policy 候補の評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns evaluateRootProtectionPolicyCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がevaluateRootProtectionPolicyCandidateの入力契約を満たす。
 * @postcondition evaluateRootProtectionPolicyCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateRootProtectionPolicyCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateRootProtectionPolicyCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateRootProtectionPolicyCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateRootProtectionPolicyCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateRootProtectionPolicyCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateRootProtectionPolicyCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateRootProtectionPolicyCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, rootProtectionPolicyINPUT_KEYS);
    if (!input) return response("blocked", "root_protection_input_invalid");
    const rootRole = input.rootRole;
    const platformFamily = input.platformFamily;
    const filesystemClass = input.filesystemClass;
    if (
      typeof rootRole !== "string" ||
      rootRole.length === 0 ||
      rootRole.length > INPUT_TOKEN_LENGTH ||
      typeof platformFamily !== "string" ||
      platformFamily.length === 0 ||
      platformFamily.length > INPUT_TOKEN_LENGTH ||
      typeof filesystemClass !== "string" ||
      filesystemClass.length === 0 ||
      filesystemClass.length > INPUT_TOKEN_LENGTH
    ) {
      return response("blocked", "root_protection_input_invalid");
    }
    if (!rootProtectionPolicyROOT_ROLES.has(rootRole)) {
      return response("blocked", "root_protection_role_invalid");
    }
    if (!PLATFORM_FAMILIES.has(platformFamily)) {
      return response("blocked", "root_protection_platform_unsupported");
    }
    if (!FILESYSTEM_CLASSES.has(filesystemClass)) {
      return response("blocked", "root_protection_filesystem_unsupported");
    }
    const observations = normalizeObservations(input.observations);
    if (!observations)
      return response("blocked", "root_protection_observations_invalid");
    if (!observations.rootExists)
      return response("blocked", "root_protection_root_missing");
    if (!observations.stableIdentityObserved) {
      return response("blocked", "root_protection_stable_identity_required");
    }
    if (observations.linkOrReparseObserved) {
      return response("blocked", "root_protection_link_or_reparse_rejected");
    }
    if (observations.untrustedWriteAllowed) {
      return response("blocked", "root_protection_untrusted_write_rejected");
    }
    if (
      rootRole === "runtime" &&
      (!observations.runtimeReadAllowed ||
        !observations.runtimeWriteAllowed ||
        observations.writeAuthority !== "runtime_principal_only")
    ) {
      return response("blocked", "runtime_root_access_policy_not_satisfied");
    }
    if (
      rootRole === "authority" &&
      (!observations.runtimeReadAllowed ||
        observations.runtimeWriteAllowed ||
        observations.writeAuthority !== "provisioner_principal_only")
    ) {
      return response("blocked", "authority_root_access_policy_not_satisfied");
    }
    return response(
      "candidate",
      "root_protection_platform_adapter_verification_required",
      policySummary(
        rootRole,
        platformFamily,
        filesystemClass,
        observations.writeAuthority,
      ),
    );
  } catch {
    return response("blocked", "root_protection_input_invalid");
  }
}

/**
 * Root Protection Policy 契約の公開契約を記述する。
 *
 * @responsibility Root Protection Policy 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRootProtectionPolicyContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRootProtectionPolicyContractの入力契約を満たす。
 * @postcondition describeRootProtectionPolicyContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRootProtectionPolicyContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRootProtectionPolicyContractは独自の失敗分岐を所有しない。
 * @invariant describeRootProtectionPolicyContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRootProtectionPolicyContractはProcess内の同一Subsystemで完結する。
 * @security describeRootProtectionPolicyContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRootProtectionPolicyContractは共有非同期状態を持たない同期処理である。
 */
export function describeRootProtectionPolicyContract() {
  const rootObservation = describeRootObservationContract();
  return Object.freeze({
    contract: ROOT_PROTECTION_POLICY_CONTRACT,
    contractRevision: ROOT_PROTECTION_POLICY_CONTRACT_REVISION,
    supportedRootRoles: Object.freeze(["runtime", "authority"]),
    inputTokenLength: INPUT_TOKEN_LENGTH,
    supportedPlatformFamilies: Object.freeze(["windows", "posix"]),
    supportedFilesystemClasses: Object.freeze(["local", "persistent_volume"]),
    writeAuthorityValues: Object.freeze([
      "runtime_principal_only",
      "provisioner_principal_only",
    ]),
    runtimePrincipalMeaning: "selected_user_or_service_runtime_principal",
    provisionerPrincipalMeaning:
      "approved_admin_or_installer_provisioning_authority_set",
    unsupportedFilesystemClasses: Object.freeze([
      "network",
      "removable",
      "special",
      "unknown",
    ]),
    runtimeRootProtection:
      "runtime_principal_only_read_write_and_no_other_writer",
    authorityRootProtection:
      "provisioner_principal_only_write_runtime_read_only_and_no_other_writer",
    writerExclusivityScope:
      "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
    trustedPlatformAdministratorBoundary: Object.freeze([
      "windows_system_and_machine_administrators",
      "posix_root",
    ]),
    administratorOriginatedChangeDetection:
      "runtime_owned_revalidation_detects_observable_identity_protection_signature_trust_or_activation_change_and_fails_closed",
    administratorOriginatedObservableChangeResponse:
      "blocked_reverification_then_reprovision_only_after_trust_base_confirmed",
    confirmedOrSuspectedPlatformAdministratorCompromiseResponse:
      "blocked_platform_recovery_and_trust_base_reestablishment_required_before_reprovision",
    ambiguousAdministratorChangeClassification:
      "fail_closed_as_suspected_compromise",
    platformRecoveryImplementation: "not_implemented",
    completeOsOrVerifierCompromiseProtection: "not_guaranteed",
    protectionEffectOwner: "official_signed_platform_provisioner_only_target",
    runtimePermissionMutation: "prohibited",
    windowsProtectionTarget: Object.freeze({
      runtimeRoot: "runtime_sid_read_write_target",
      authorityRoot:
        "provisioner_or_approved_admin_write_runtime_sid_read_only_target",
      inheritance: "disabled_target",
      untrustedBroadWriteAces: "rejected_target",
    }),
    posixProtectionTarget: Object.freeze({
      runtimeRoot: "runtime_uid_owner_mode_0700_target",
      authorityRoot:
        "provisioner_or_root_owner_runtime_read_traverse_explicit_acl_target",
      unapprovedGroupOrOtherWrite: "rejected_target",
    }),
    persistentVolumeEligibility:
      "local_equivalent_stable_identity_durable_atomic_replace_and_equivalent_acl_required_target",
    unsupportedVolumeBehavior:
      "network_removable_special_or_unknown_blocked_target",
    rootProvisioning: "external_preprovision_required",
    callerObservationsAreAuthority: false,
    protectionPolicyCore: "implemented_candidate_claim_only",
    windowsDaclAdapter: rootObservation.windowsAdapter,
    posixRuntimeRootPrecheckEntry: "implemented_fail_closed",
    posixRuntimeRootModeObservation: "not_implemented",
    posixOwnerModeAdapter: "not_implemented",
    posixAclVerification: "not_implemented",
    runtimePrincipalBinding: "not_implemented_effective_access_required",
    persistentVolumeAdapter: "not_implemented",
    filesystemClassVerification: "not_implemented",
    pathBinding: "not_implemented_root_observation_adapter_required",
    activationIntegration: "not_implemented",
    rootObservation,
    rootCreationIssued: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeCapabilityIssued: false,
  });
}

export const PROVIDER_HOME_CONTRACT = "crdd-coordinator/provider-home";

export const PROVIDER_HOME_CONTRACT_REVISION = 5;

export const PROVIDER_HOME_ROOT_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "ProviderHomes",
]);

const providerHomePROVIDERS = Object.freeze(["codex", "claude"] as const);

const providerDirectoryNames = Object.freeze({
  codex: describeProviderAuthentication("codex").homeDirectoryName,
  claude: describeProviderAuthentication("claude").homeDirectoryName,
});

const INPUT_KEYS = new Set(["provider", "localAppDataRoot"]);

/**
 * provider-homeを停止結果として構築する。
 *
 * @responsibility provider-homeの停止理由、未発行Effect、公開結果境界を所有する。
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
function providerHomeBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    homeLayoutCandidate: false,
    protectionVerified: false,
    authSessionVerified: false,
    providerHomeMountGrantIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
  });
}

/**
 * providerを決定する。
 *
 * @responsibility providerの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns (typeof PROVIDERS)[number] | nullを返す。
 * @precondition 「value: unknown」がproviderの入力契約を満たす。
 * @postcondition providerの責務を完了した結果だけを返す。
 * @effect N/A: providerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerは独自の失敗分岐を所有しない。
 * @invariant providerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: providerはProcess内の同一Subsystemで完結する。
 * @security providerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: providerは共有非同期状態を持たない同期処理である。
 */
function provider(
  value: unknown,
): (typeof providerHomePROVIDERS)[number] | null {
  return typeof value === "string" &&
    providerHomePROVIDERS.some((candidate) => candidate === value)
    ? (value as (typeof providerHomePROVIDERS)[number])
    : null;
}

/**
 * Layout For Validationを一意に解決する。
 *
 * @responsibility Layout For Validationの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000010
 * @input localAppDataRoot: string、selectedProvider: (typeof PROVIDERS)[number]
 * @returns resolveLayoutForValidationの計算結果を返す。
 * @precondition 「localAppDataRoot: string、selectedProvider: (typeof PROVIDERS)[number]」がresolveLayoutForValidationの入力契約を満たす。
 * @postcondition resolveLayoutForValidationの責務を完了した結果だけを返す。
 * @effect N/A: resolveLayoutForValidationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveLayoutForValidationは独自の失敗分岐を所有しない。
 * @invariant resolveLayoutForValidationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveLayoutForValidationはProcess内の同一Subsystemで完結する。
 * @security resolveLayoutForValidationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveLayoutForValidationは共有非同期状態を持たない同期処理である。
 */
function resolveLayoutForValidation(
  localAppDataRoot: string,
  selectedProvider: (typeof providerHomePROVIDERS)[number],
) {
  const root = path.win32.join(
    localAppDataRoot,
    ...PROVIDER_HOME_ROOT_SEGMENTS,
  );
  return Object.freeze({
    root,
    providerHome: path.win32.join(
      root,
      providerDirectoryNames[selectedProvider],
    ),
  });
}

/**
 * Windows Provider Home Layout 候補を評価する。
 *
 * @responsibility Windows Provider Home Layout 候補の評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input raw: unknown
 * @returns evaluateWindowsProviderHomeLayoutCandidateの計算結果を返す。
 * @precondition 「raw: unknown」がevaluateWindowsProviderHomeLayoutCandidateの入力契約を満たす。
 * @postcondition evaluateWindowsProviderHomeLayoutCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateWindowsProviderHomeLayoutCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateWindowsProviderHomeLayoutCandidateは独自の失敗分岐を所有しない。
 * @invariant evaluateWindowsProviderHomeLayoutCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateWindowsProviderHomeLayoutCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateWindowsProviderHomeLayoutCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateWindowsProviderHomeLayoutCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateWindowsProviderHomeLayoutCandidate(raw: unknown) {
  const input = snapshotPlainRecord(raw, INPUT_KEYS);
  if (!input) return providerHomeBlocked("provider_home_layout_input_invalid");
  const selectedProvider = provider(input.provider);
  if (!selectedProvider)
    return providerHomeBlocked("provider_home_provider_not_supported");
  if (!isSupportedWindowsAbsolutePathCandidate(input.localAppDataRoot)) {
    return providerHomeBlocked("provider_home_local_app_data_root_invalid");
  }
  const layout = resolveLayoutForValidation(
    input.localAppDataRoot,
    selectedProvider,
  );
  if (
    !isSupportedWindowsAbsolutePathCandidate(layout.root) ||
    !isSupportedWindowsAbsolutePathCandidate(layout.providerHome)
  ) {
    return providerHomeBlocked("provider_home_layout_invalid");
  }
  return Object.freeze({
    status: "candidate" as const,
    reason: "provider_home_protection_effect_and_observation_required",
    provider: selectedProvider,
    scope: "local_os_user_and_provider" as const,
    rootInputSource: "caller_supplied_windows_absolute_path_candidate" as const,
    requiredEffectRootSource:
      "windows_known_folder_local_app_data_at_explicit_bootstrap_time" as const,
    homeLayoutCandidate: true,
    persistentAcrossOperations: true,
    sharedAcrossRepositoriesForSameOsUser: true,
    hostDefaultHomeImportAllowed: false,
    otherProviderHomeSharingAllowed: false,
    operationCleanupOwned: false,
    protectionVerified: false,
    authSessionVerified: false,
    providerHomeMountGrantIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
  });
}

/**
 * Provider Home 契約の公開契約を記述する。
 *
 * @responsibility Provider Home 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderHomeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderHomeContractの入力契約を満たす。
 * @postcondition describeProviderHomeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderHomeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderHomeContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderHomeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderHomeContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderHomeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderHomeContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderHomeContract() {
  const observation = describeProviderHomeObservationContract();
  const windowsAdapter = describeProviderHomeWindowsAdapterContract();
  return Object.freeze({
    contract: PROVIDER_HOME_CONTRACT,
    contractRevision: PROVIDER_HOME_CONTRACT_REVISION,
    platform: "windows_local_user_target_only",
    providers: providerHomePROVIDERS,
    layoutCandidateInputSource:
      "caller_supplied_windows_absolute_path_candidate_non_authority",
    requiredEffectRootSource:
      "windows_known_folder_local_app_data_at_explicit_bootstrap_time",
    rootSegments: PROVIDER_HOME_ROOT_SEGMENTS,
    providerDirectoryNames: providerDirectoryNames,
    scope: "local_os_user_and_provider",
    persistentAcrossOperations: true,
    sharedAcrossRepositoriesForSameOsUser: true,
    hostDefaultHomeImportAllowed: false,
    hostCredentialImportAllowed: false,
    operationTemporaryHomeImportAllowed: false,
    otherProviderHomeSharingAllowed: false,
    operationCleanupOwned: false,
    symlinkJunctionOrReparseAllowed: false,
    stableRootIdentityRequired: true,
    selectedLocalUserBindingRequired: true,
    ownerAndDaclVerificationRequired: true,
    untrustedWriterAllowed: false,
    providerRefreshWriteTarget: "provider_specific_home_only",
    tokenSessionOrPathReported: false,
    bootstrapEntry: "explicit_login_only_target",
    protectionEffect: "not_implemented",
    protectionObservation:
      "implemented_runtime_owned_read_only_native_observation_candidate",
    selectedLocalUserBinder:
      "implemented_runtime_owned_current_local_interactive_token_candidate",
    runtimeOwnedObservation: observation,
    windowsAdapter,
    authSessionProbe: "not_implemented",
    logoutRevocationAndDeletion: "not_implemented_separate_bootstrap_lifecycle",
    mountGrant: describeProviderHomeMountGrantContract(),
    mountGrantRuntime: describeProviderHomeMountGrantRuntimeContract(),
    callerPathConfersAuthority: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
  });
}

export const ROOT_IDENTITY_OBSERVATION_CONTRACT =
  "crdd-coordinator/root-identity-observation";

export const ROOT_PROTECTION_OBSERVATION_CONTRACT =
  "crdd-coordinator/root-protection-observation";

export const ROOT_OBSERVATION_CONTRACT_REVISION = 1;

export const ROOT_IDENTITY_OBSERVATION_DOMAIN =
  "CRDD\0ROOT-IDENTITY-OBSERVATION\0V1\0";

export const ROOT_PROTECTION_OBSERVATION_DOMAIN =
  "CRDD\0ROOT-PROTECTION-OBSERVATION\0V1\0";

const rootIdentityDomain = Buffer.from(
  ROOT_IDENTITY_OBSERVATION_DOMAIN,
  "ascii",
);

const rootProtectionDomain = Buffer.from(
  ROOT_PROTECTION_OBSERVATION_DOMAIN,
  "ascii",
);

const ROOT_ROLES = new Set(["runtime", "authority"]);

const OBSERVATION_KEYS = new Set([
  "allOwnersTrusted",
  "entityCount",
  "filesystemClass",
  "objectBirthtimeNanoseconds",
  "objectDeviceId",
  "objectFileId",
  "otherWriteAceCount",
  "reparsePointCount",
  "rootDaclProtected",
  "rootRole",
  "runtimeDenyAceCount",
  "runtimePrincipalIdentityHash",
  "runtimePrincipalBinding",
  "runtimeReadExecuteEntityCount",
  "runtimeRootInheritanceRuleCount",
  "runtimeWriteEntityCount",
]);

const MAXIMUM_ENTITIES = 2_049;

const rootObservationHEX64 = /^[0-9a-f]{64}$/u;

const DECIMAL_IDENTITY = /^[1-9][0-9]{0,39}$/u;

/**
 * root-observationを停止結果として構築する。
 *
 * @responsibility root-observationの停止理由、未発行Effect、公開結果境界を所有する。
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
function rootObservationBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rootIdentityHash: null,
    rootProtectionHash: null,
    identityObserved: false,
    protectionObserved: false,
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
    absolutePathReported: false,
    principalReported: false,
    aclReported: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * Platform Access Adapter 契約の公開契約を記述する。
 *
 * @responsibility Platform Access Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformAccessAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformAccessAdapterContractの入力契約を満たす。
 * @postcondition describePlatformAccessAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformAccessAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformAccessAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformAccessAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describePlatformAccessAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformAccessAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformAccessAdapterContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-access-adapter",
    contractRevision: 3,
    implementationLanguage: "rust",
    rustCrate: "crdd-platform-access",
    rustToolchain: "1.94.1",
    target: "x86_64-pc-windows-msvc",
    wireProtocol: "fixed_bounded_binary_revision_3",
    runtimePrincipalPolicy: "local_interactive_selected_user_only",
    observedPrincipalSource: "native_supervisor_current_process_token_user",
    principalObservation:
      "implemented_signed_supervisor_token_classification_fail_closed_candidate",
    selectedUserBinding:
      "implemented_native_current_process_primary_token_and_login_session_observation",
    runtimePrincipalIdentity:
      "native_current_token_user_sid_domain_separated_sha256",
    serviceAccountMode: "not_implemented_blocked",
    windowsCurrentProcessAccessCore: "implemented_candidate_component_only",
    binaryReleaseIdentityBinding: "implemented_candidate_signed_manifest",
    productionInvocation:
      "signed_exact_artifact_spawn_with_minimal_environment_and_bounded_io",
    maximumWorkerSpawnAttemptsPerInvocation: 1,
    atomicJobAssignment: "implemented_candidate",
    exactRequestResponseBinding: "implemented_candidate",
    shellInvocation: false,
    pathEnvironmentLookup: false,
    cargoRuntimeInvocation: false,
    windowsPermissionMutation: "not_implemented",
    posixAdapter: "not_implemented",
    absolutePathReported: false,
    principalReported: false,
    principalIdentityHashReported: false,
    aclReported: false,
    rawErrorReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * uint64 Big Endianを決定する。
 *
 * @responsibility uint64 Big Endianの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: number
 * @returns uint64BigEndianの計算結果を返す。
 * @precondition 「value: number」がuint64BigEndianの入力契約を満たす。
 * @postcondition uint64BigEndianの責務を完了した結果だけを返す。
 * @effect N/A: uint64BigEndianは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: uint64BigEndianは独自の失敗分岐を所有しない。
 * @invariant uint64BigEndianは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: uint64BigEndianはProcess内の同一Subsystemで完結する。
 * @security uint64BigEndianはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: uint64BigEndianは共有非同期状態を持たない同期処理である。
 */
function uint64BigEndian(value: number) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
}

/**
 * artifact Hashを決定する。
 *
 * @responsibility artifact Hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input domain: Buffer、value: Readonly<Record<string, unknown>>
 * @returns artifactHashの計算結果を返す。
 * @precondition 「domain: Buffer、value: Readonly<Record<string, unknown>>」がartifactHashの入力契約を満たす。
 * @postcondition artifactHashの責務を完了した結果だけを返す。
 * @effect N/A: artifactHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: artifactHashは独自の失敗分岐を所有しない。
 * @invariant artifactHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: artifactHashはProcess内の同一Subsystemで完結する。
 * @security artifactHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: artifactHashは共有非同期状態を持たない同期処理である。
 */
function artifactHash(
  domain: Buffer,
  value: Readonly<Record<string, unknown>>,
) {
  const canonicalBytes = Buffer.from(JSON.stringify(value), "utf8");
  return createHash("sha256")
    .update(domain)
    .update(uint64BigEndian(canonicalBytes.byteLength))
    .update(canonicalBytes)
    .digest("hex");
}

/**
 * integerを決定する。
 *
 * @responsibility integerの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns integerの計算結果を返す。
 * @precondition 「value: unknown」がintegerの入力契約を満たす。
 * @postcondition integerの責務を完了した結果だけを返す。
 * @effect N/A: integerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: integerは独自の失敗分岐を所有しない。
 * @invariant integerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: integerはProcess内の同一Subsystemで完結する。
 * @security integerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: integerは共有非同期状態を持たない同期処理である。
 */
function integer(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAXIMUM_ENTITIES
  );
}

/**
 * Windows Root Observation 候補を機械利用可能な契約へ変換する。
 *
 * @responsibility Windows Root Observation 候補の入力Schema、決定論的変換、変換不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawInput: unknown
 * @returns compileWindowsRootObservationCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がcompileWindowsRootObservationCandidateの入力契約を満たす。
 * @postcondition compileWindowsRootObservationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: compileWindowsRootObservationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure compileWindowsRootObservationCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant compileWindowsRootObservationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileWindowsRootObservationCandidateはProcess内の同一Subsystemで完結する。
 * @security compileWindowsRootObservationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileWindowsRootObservationCandidateは共有非同期状態を持たない同期処理である。
 */
export function compileWindowsRootObservationCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, OBSERVATION_KEYS);
    if (
      !input ||
      !ROOT_ROLES.has(input.rootRole as string) ||
      input.filesystemClass !== "local" ||
      typeof input.allOwnersTrusted !== "boolean" ||
      typeof input.rootDaclProtected !== "boolean" ||
      !integer(input.entityCount) ||
      input.entityCount === 0 ||
      !integer(input.otherWriteAceCount) ||
      !integer(input.reparsePointCount) ||
      !integer(input.runtimeDenyAceCount) ||
      !integer(input.runtimeReadExecuteEntityCount) ||
      !integer(input.runtimeRootInheritanceRuleCount) ||
      !integer(input.runtimeWriteEntityCount) ||
      typeof input.runtimePrincipalIdentityHash !== "string" ||
      !rootObservationHEX64.test(input.runtimePrincipalIdentityHash) ||
      input.runtimePrincipalBinding !==
        "selected_local_user_binding_caller_claim" ||
      typeof input.objectDeviceId !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectDeviceId) ||
      typeof input.objectFileId !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectFileId) ||
      typeof input.objectBirthtimeNanoseconds !== "string" ||
      !DECIMAL_IDENTITY.test(input.objectBirthtimeNanoseconds)
    ) {
      return rootObservationBlocked("windows_root_observation_invalid");
    }
    const entityCount = input.entityCount as number;
    const isRuntimeRoot = input.rootRole === "runtime";
    if (
      !input.rootDaclProtected ||
      !input.allOwnersTrusted ||
      input.otherWriteAceCount !== 0 ||
      input.reparsePointCount !== 0 ||
      input.runtimeDenyAceCount !== 0 ||
      input.runtimeReadExecuteEntityCount !== entityCount ||
      input.runtimeRootInheritanceRuleCount !== 1 ||
      (isRuntimeRoot
        ? input.runtimeWriteEntityCount !== entityCount
        : input.runtimeWriteEntityCount !== 0)
    ) {
      return rootObservationBlocked("windows_root_protection_not_satisfied");
    }
    const identityArtifact = Object.freeze({
      contract: ROOT_IDENTITY_OBSERVATION_CONTRACT,
      contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
      filesystemClass: "local",
      objectBirthtimeNanoseconds: input.objectBirthtimeNanoseconds,
      objectDeviceId: input.objectDeviceId,
      objectFileId: input.objectFileId,
      platformFamily: "windows",
    });
    const protectionArtifact = Object.freeze({
      contract: ROOT_PROTECTION_OBSERVATION_CONTRACT,
      contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
      filesystemClass: "local",
      platformFamily: "windows",
      rootRole: input.rootRole,
      runtimeAccess: isRuntimeRoot ? "read_write" : "read_only",
      runtimePrincipalIdentityHash: input.runtimePrincipalIdentityHash,
      runtimePrincipalBinding: input.runtimePrincipalBinding,
      untrustedWriteAllowed: false,
      writeAuthority: isRuntimeRoot
        ? "runtime_principal_only"
        : "provisioner_principal_only",
      writerExclusivity:
        "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
    });
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_root_identity_and_protection_observed_candidate",
      rootIdentityHash: artifactHash(rootIdentityDomain, identityArtifact),
      rootProtectionHash: artifactHash(
        rootProtectionDomain,
        protectionArtifact,
      ),
      identityObserved: true,
      protectionObserved: true,
      selectedUserBindingVerified: false,
      runtimePrincipalBound: false,
      absolutePathReported: false,
      principalReported: false,
      aclReported: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return rootObservationBlocked("windows_root_observation_invalid");
  }
}

/**
 * Windows Root Observation 候補を観測する。
 *
 * @responsibility Windows Root Observation 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input rootPath: unknown、rootRole: unknown
 * @returns inspectWindowsRootObservationCandidateの計算結果を返す。
 * @precondition 「rootPath: unknown、rootRole: unknown」がinspectWindowsRootObservationCandidateの入力契約を満たす。
 * @postcondition inspectWindowsRootObservationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectWindowsRootObservationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectWindowsRootObservationCandidateは独自の失敗分岐を所有しない。
 * @invariant inspectWindowsRootObservationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectWindowsRootObservationCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectWindowsRootObservationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectWindowsRootObservationCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectWindowsRootObservationCandidate(
  rootPath: unknown,
  rootRole: unknown,
) {
  void rootPath;
  void rootRole;
  return rootObservationBlocked(
    "windows_root_effective_access_adapter_not_implemented",
  );
}

/**
 * Root Observation 契約の公開契約を記述する。
 *
 * @responsibility Root Observation 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRootObservationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRootObservationContractの入力契約を満たす。
 * @postcondition describeRootObservationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRootObservationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRootObservationContractは独自の失敗分岐を所有しない。
 * @invariant describeRootObservationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRootObservationContractはProcess内の同一Subsystemで完結する。
 * @security describeRootObservationContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRootObservationContractは共有非同期状態を持たない同期処理である。
 */
export function describeRootObservationContract() {
  const platformAccess = describePlatformAccessAdapterContract();
  return Object.freeze({
    identityContract: ROOT_IDENTITY_OBSERVATION_CONTRACT,
    protectionContract: ROOT_PROTECTION_OBSERVATION_CONTRACT,
    contractRevision: ROOT_OBSERVATION_CONTRACT_REVISION,
    identityDomain: ROOT_IDENTITY_OBSERVATION_DOMAIN,
    protectionDomain: ROOT_PROTECTION_OBSERVATION_DOMAIN,
    domainFraming:
      "implemented_candidate_artifact_specific_prefix_uint64be_length_canonical_payload",
    identityInputs:
      "windows_device_file_and_birthtime_identity_without_path_disclosure",
    protectionInputs:
      "windows_fixed_drive_dacl_role_runtime_principal_and_writer_exclusivity",
    windowsObservationCore: platformAccess.windowsCurrentProcessAccessCore,
    windowsBinaryReleaseIdentityBinding:
      platformAccess.binaryReleaseIdentityBinding,
    windowsProcessInvocation: platformAccess.productionInvocation,
    windowsAdapter: "not_implemented_observation_mapping_required",
    runtimePrincipalBindingInput:
      "selected_local_user_binding_caller_claim_non_authority",
    selectedUserBinding: "not_implemented_blocked",
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
    posixAdapter: "not_implemented",
    rawIdentityReported: false,
    rawProtectionReported: false,
    absolutePathReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

export const AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES = 4_096;

const WINDOWS_RESERVED_BASENAME =
  /^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])$/u;

const RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS = Object.freeze([
  Object.freeze(["ß", "SS"] as const),
  Object.freeze(["ı", "I"] as const),
  Object.freeze(["ſ", "S"] as const),
  Object.freeze(["K", "K"] as const),
  Object.freeze(["ﬀ", "FF"] as const),
  Object.freeze(["ﬁ", "FI"] as const),
  Object.freeze(["ﬂ", "FL"] as const),
  Object.freeze(["ﬃ", "FFI"] as const),
  Object.freeze(["ﬄ", "FFL"] as const),
  Object.freeze(["ﬅ", "ST"] as const),
  Object.freeze(["ﬆ", "ST"] as const),
]);

const reservedNameSpecialUppercaseMapping = new Map<string, string>(
  RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS,
);

/**
 * reserved Name Limited Uppercaseを決定する。
 *
 * @responsibility reserved Name Limited Uppercaseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns reservedNameLimitedUppercaseの計算結果を返す。
 * @precondition 「value: string」がreservedNameLimitedUppercaseの入力契約を満たす。
 * @postcondition reservedNameLimitedUppercaseの責務を完了した結果だけを返す。
 * @effect N/A: reservedNameLimitedUppercaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reservedNameLimitedUppercaseは独自の失敗分岐を所有しない。
 * @invariant reservedNameLimitedUppercaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reservedNameLimitedUppercaseはProcess内の同一Subsystemで完結する。
 * @security reservedNameLimitedUppercaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reservedNameLimitedUppercaseは共有非同期状態を持たない同期処理である。
 */
function reservedNameLimitedUppercase(value: string) {
  let normalized = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && codePoint >= 0x61 && codePoint <= 0x7a) {
      normalized += String.fromCodePoint(codePoint - 0x20);
      continue;
    }
    normalized +=
      reservedNameSpecialUppercaseMapping.get(character) ?? character;
  }
  return normalized;
}

/**
 * Supported Common Path Bytesが存在するかを判定する。
 *
 * @responsibility Supported Common Path Bytesの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がhasSupportedCommonPathBytesの入力契約を満たす。
 * @postcondition hasSupportedCommonPathBytesの責務を完了した結果だけを返す。
 * @effect N/A: hasSupportedCommonPathBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasSupportedCommonPathBytesは独自の失敗分岐を所有しない。
 * @invariant hasSupportedCommonPathBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasSupportedCommonPathBytesはProcess内の同一Subsystemで完結する。
 * @security hasSupportedCommonPathBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasSupportedCommonPathBytesは共有非同期状態を持たない同期処理である。
 */
function hasSupportedCommonPathBytes(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\uD800-\uDFFF]/u.test(value) &&
    Buffer.byteLength(value, "utf8") <=
      AUTHORITY_ROOT_ABSOLUTE_PATH_MAX_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

/**
 * Supported Windows Absolute Path 候補かを判定する。
 *
 * @responsibility Supported Windows Absolute Path 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedWindowsAbsolutePathCandidateの入力契約を満たす。
 * @postcondition isSupportedWindowsAbsolutePathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedWindowsAbsolutePathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedWindowsAbsolutePathCandidateは独自の失敗分岐を所有しない。
 * @invariant isSupportedWindowsAbsolutePathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedWindowsAbsolutePathCandidateはProcess内の同一Subsystemで完結する。
 * @security isSupportedWindowsAbsolutePathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedWindowsAbsolutePathCandidateは共有非同期状態を持たない同期処理である。
 */
export function isSupportedWindowsAbsolutePathCandidate(
  value: unknown,
): value is string {
  if (
    !hasSupportedCommonPathBytes(value) ||
    !/^[A-Z]:\\/u.test(value) ||
    value.includes("/") ||
    path.win32.normalize(value) !== value
  )
    return false;
  const root = path.win32.parse(value).root;
  if (value === root) return true;
  if (value.endsWith("\\")) return false;
  const segments = value.slice(root.length).split("\\");
  return segments.every((segment) => {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      /[<>:"|?*]/u.test(segment) ||
      /[. ]$/u.test(segment)
    )
      return false;
    const basenameCandidate = segment.split(".", 1)[0];
    if (basenameCandidate === undefined) return false;
    const basename = reservedNameLimitedUppercase(
      basenameCandidate.replace(/[. ]+$/u, ""),
    );
    return !WINDOWS_RESERVED_BASENAME.test(basename);
  });
}

/**
 * Authority Root Path Lexical 契約の公開契約を記述する。
 *
 * @responsibility Authority Root Path Lexical 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeAuthorityRootPathLexicalContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeAuthorityRootPathLexicalContractの入力契約を満たす。
 * @postcondition describeAuthorityRootPathLexicalContractの責務を完了した結果だけを返す。
 * @effect N/A: describeAuthorityRootPathLexicalContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeAuthorityRootPathLexicalContractは独自の失敗分岐を所有しない。
 * @invariant describeAuthorityRootPathLexicalContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeAuthorityRootPathLexicalContractはProcess内の同一Subsystemで完結する。
 * @security describeAuthorityRootPathLexicalContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeAuthorityRootPathLexicalContractは共有非同期状態を持たない同期処理である。
 */
export function describeAuthorityRootPathLexicalContract() {
  return Object.freeze({
    windowsReservedNameComparison: "repository_owned_limited_uppercase_mapping",
    asciiLowercaseMappings: Object.freeze(
      Array.from({ length: 26 }, (unusedValue, index) => {
        void unusedValue;
        return Object.freeze([
          String.fromCodePoint(0x61 + index),
          String.fromCodePoint(0x41 + index),
        ] as const);
      }),
    ),
    specialMappings: RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS,
    unicodeNormalizationApplied: false,
    illFormedUtf16Accepted: false,
  });
}

/**
 * Supported Posix Absolute Path 候補かを判定する。
 *
 * @responsibility Supported Posix Absolute Path 候補の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedPosixAbsolutePathCandidateの入力契約を満たす。
 * @postcondition isSupportedPosixAbsolutePathCandidateの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedPosixAbsolutePathCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedPosixAbsolutePathCandidateは独自の失敗分岐を所有しない。
 * @invariant isSupportedPosixAbsolutePathCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedPosixAbsolutePathCandidateはProcess内の同一Subsystemで完結する。
 * @security isSupportedPosixAbsolutePathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedPosixAbsolutePathCandidateは共有非同期状態を持たない同期処理である。
 */
export function isSupportedPosixAbsolutePathCandidate(
  value: unknown,
): value is string {
  return (
    hasSupportedCommonPathBytes(value) &&
    path.posix.isAbsolute(value) &&
    path.posix.normalize(value) === value &&
    (value === "/" || !value.endsWith("/"))
  );
}

/**
 * Supported Authority Root Absolute Pathかを判定する。
 *
 * @responsibility Supported Authority Root Absolute Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisSupportedAuthorityRootAbsolutePathの入力契約を満たす。
 * @postcondition isSupportedAuthorityRootAbsolutePathの責務を完了した結果だけを返す。
 * @effect isSupportedAuthorityRootAbsolutePathは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: isSupportedAuthorityRootAbsolutePathは独自の失敗分岐を所有しない。
 * @invariant isSupportedAuthorityRootAbsolutePathは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isSupportedAuthorityRootAbsolutePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSupportedAuthorityRootAbsolutePathは共有非同期状態を持たない同期処理である。
 */
export function isSupportedAuthorityRootAbsolutePath(
  value: unknown,
): value is string {
  return process.platform === "win32"
    ? isSupportedWindowsAbsolutePathCandidate(value)
    : isSupportedPosixAbsolutePathCandidate(value);
}

export const PROVIDER_AUTHENTICATION_CONTRACT =
  "crdd-coordinator/provider-authentication";

export const PROVIDER_AUTHENTICATION_CONTRACT_REVISION = 1;

export const PROVIDER_AUTHENTICATION_INPUT_NOTICE =
  "PowerShellにコード貼付けを求められた場合、貼付けた文字は画面に表示されません。一度だけ貼り付けてEnterを押し、結果が出るまで再入力しないでください。";

const executionAbortedGetter = Object.getOwnPropertyDescriptor(
  AbortSignal.prototype,
  "aborted",
)?.get;

/**
 * 実行・認証操作の取消値を組込みgetterだけで読む。
 * @responsibility APIと直接呼出しの双方で偽Signal・accessor実行を拒否する。
 * @trace ARCH-000010
 * @input signal: 任意の取消入力又は省略。
 * @returns 取消boolean、不正時null。省略はfalse。
 * @precondition N/A: 利用者定義Propertyを評価する前に呼ぶ。
 * @postcondition 入力のProxy／getterを実行しない。
 * @effect N/A: 局所値の検査だけ。
 * @failure brand・prototype・descriptor不正はnull。
 * @invariant 不正値を未取消へ丸めない。
 * @boundary 公開入力と実行Lifecycleの取消観測。
 * @security 偽のprototypeだけではAbortSignalとして受理しない。
 * @concurrency 待機後も同じ組込みgetterで現在値を読む。
 */
export function readExecutionCancellation(signal: unknown): boolean | null {
  if (signal === undefined) return false;
  if (
    !signal ||
    typeof signal !== "object" ||
    utilTypes.isProxy(signal) ||
    Object.getPrototypeOf(signal) !== AbortSignal.prototype ||
    Object.getOwnPropertyDescriptor(signal, "aborted") !== undefined ||
    !executionAbortedGetter
  )
    return null;
  try {
    return executionAbortedGetter.call(signal) as boolean;
  } catch {
    return null;
  }
}

/**
 * Provider認証で許可する一つのDocker Commandを表す。
 *
 * @responsibility 固定用途、引数および対話性の値境界を所有する。
 * @trace ARCH-000010
 * @shape purpose、argv、interactiveからなる読取り専用値である。
 * @invariant 任意Shell文字列や暗黙の環境依存を含まない。
 * @boundary 認証PlanからDocker CLI AdapterへのCommand境界。
 * @security 秘密値を結果または診断へ公開しない。
 * @compatibility 利用側は宣言済みPropertyだけへ依存する。
 */
type Command = Readonly<{
  purpose: string;
  argv: readonly string[];
  interactive: boolean;
}>;

/**
 * Provider認証の固定Docker Planを表す。
 *
 * @responsibility Image、資源名、所有LabelおよびCommand列の値境界を所有する。
 * @trace ARCH-000010
 * @shape Provider情報、Docker資源Identityおよび用途別Command列からなる読取り専用値である。
 * @invariant RepositoryやWorkspaceのmountを含めない。
 * @boundary Host Runtimeから隔離Docker認証環境へのPlan境界。
 * @security 専用Provider Home以外のHost資源を接続しない。
 * @compatibility 利用側は宣言済みPropertyと固定Command順だけへ依存する。
 */
export type ProviderAuthenticationPlan<
  A extends "status" | "login" = "status" | "login",
> = Readonly<{
  provider: "codex" | "claude";
  action: A;
  providerHomeSourcePath: string;
  providerImageDigest: string;
  ownershipLabel: string;
  probeContainerName: string;
  commands: readonly Command[];
  ownershipCommands: readonly Command[];
  cleanupCommands: readonly Command[];
  absenceCommands: readonly Command[];
}> &
  (A extends "login"
    ? Readonly<{
        proxyImageDigest: string;
        internalNetworkName: string;
        egressNetworkName: string;
        proxyContainerName: string;
        loginContainerName: string;
      }>
    : Readonly<Record<never, never>>);

/**
 * 一つのDocker Command実行観測を表す。
 *
 * @responsibility 終了状態、出力および起動失敗の観測値境界を所有する。
 * @trace ARCH-000010
 * @shape status、signal、stdout、stderrおよび任意errorからなる読取り専用値である。
 * @invariant 要求発行と完了観測を同一視しない。
 * @boundary 子Processから再認証Lifecycleへの結果搬送境界。
 * @security 生出力を公開結果へ直接搬送しない。
 * @compatibility 利用側は宣言済み観測Propertyだけへ依存する。
 */
type Execution = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
  processCompletionConfirmed?: boolean;
  resourceCreationConfirmed?: boolean;
  resourceReceipt?: Readonly<{ name: string; dockerId: string }>;
}>;

const authenticationTechnicalPlans = new WeakMap<
  object,
  DockerAuthenticationPlan
>();

/**
 * Provider認証Lifecycleが利用する外部境界を表す。
 *
 * @responsibility Random、Process、Kernel LockおよびRecovery StoreのPort集合を所有する。
 * @trace ARCH-000010
 * @shape 再認証Lifecycleに必要な関数Portだけからなる読取り専用値である。
 * @invariant Repositoryや任意Filesystem Adapterを注入可能にしない。
 * @boundary Domain LifecycleとOS／Docker／Recovery実装の境界。
 * @security Test差替えを本番Authorityへ昇格させない。
 * @compatibility 利用側は宣言済みPort signatureだけへ依存する。
 */
type Dependencies = Readonly<{
  randomHex: (bytes: number) => string;
  run: (
    command: Command,
    authorityLive: () => boolean,
    plan: ProviderAuthenticationPlan,
  ) => Promise<Execution>;
  isProcessCompletionConfirmed?: () => boolean;
  acquireProviderHomeLock: (
    identityHash: string,
  ) => Readonly<{ assertLive: () => boolean; release: () => boolean }> | null;
  beginRecovery: (
    record: AuthenticationRecoveryRecord,
  ) =>
    | "created"
    | "existing_idle"
    | "existing_in_flight"
    | "unknown"
    | Readonly<{ status: "prior_action_active"; recoveryId: string }>;
  setRecoveryCommandState: (
    record: AuthenticationRecoveryRecord,
    state: "idle" | "in_flight",
    purpose: string | null,
  ) => boolean;
  completeRecovery: (record: AuthenticationRecoveryRecord) => boolean;
  recordCreatedResource: (
    record: AuthenticationRecoveryRecord,
    result: Execution,
  ) => boolean;
  recoveryCommands: (
    record: AuthenticationRecoveryRecord,
    plan: ProviderAuthenticationPlan,
    index: number,
  ) => Readonly<{
    ownershipCommand: Command;
    cleanupCommand: Command | null;
    absenceCommand: Command;
    identityAbsenceCommand?: Command;
  }> | null;
}>;

/**
 * Provider認証の耐久回復記録を表す。
 *
 * @responsibility exact Recovery Identity、資源集合およびCommand状態の値境界を所有する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape revision 1の固定識別子、状態、操作別資源の実IDおよび記録Pathからなる読取り専用値である。
 * @invariant 秘密値、CredentialおよびProvider生出力を含まない。
 * @boundary 再認証LifecycleとOS管理Recovery Storeの境界。
 * @security 回復に必要な最小Identityだけを耐久化する。
 * @compatibility 旧revisionは自動清掃せず停止する。移行はフロントAIの確認手順で扱う。
 */
export type AuthenticationRecoveryRecord = Readonly<{
  contract: "crdd-coordinator/provider-authentication-recovery";
  contractRevision: 1;
  provider: "codex" | "claude";
  action: "status" | "login";
  recoveryId: string;
  stableLogicalHomeBindingHash: string;
  suffix: string;
  resourceNames: readonly string[];
  resources: readonly Readonly<{
    kind: "container" | "network";
    name: string;
    dockerId: string | null;
  }>[];
  ownershipLabel: string;
  state: "active" | "settled";
  commandState: "idle" | "in_flight";
  commandPurpose: string | null;
  recordPath: string;
}>;

/**
 * Provider認証の耐久回復記録を構築する。
 *
 * @responsibility 検証済みProvider Home Identityと固定Docker Planを、秘密値を含まないexact Recovery Identityへ結合する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input providerHomeSourcePath: 選択Userの専用Provider Home、stableLogicalHomeBindingHash: 安定Identity、plan: 固定Docker Plan
 * @returns 妥当な入力ではactive回復記録、不正入力ではnullを返す。
 * @precondition Provider HomeはOS管理Runtime Root直下のProviderHomes/<provider>である。
 * @postcondition 記録はRecovery ID、所有Labelおよび操作別資源名を含み、PathまたはCredentialを永続Payloadへ含めない。
 * @effect N/A: 回復記録の値を構築するだけでFilesystemへ書き込まない。
 * @failure IdentityまたはProvider Home境界が不正な場合はnullへ閉じる。
 * @invariant 同じLogical Provider Home IdentityとPlanから同じRecovery IDと資源集合を導く。
 * @boundary OS管理Runtime Root内のProvider認証回復Storeとの値境界。
 * @security Path、Credential、SecretまたはProvider生出力を耐久Payloadへ含めない。
 * @concurrency N/A: 共有状態を変更しない同期値構築である。
 */
export function createProviderAuthenticationRecoveryRecord(
  providerHomeSourcePath: string,
  stableLogicalHomeBindingHash: string,
  plan: ProviderAuthenticationPlan,
): AuthenticationRecoveryRecord | null {
  if (
    !authenticationTechnicalPlans.has(plan) ||
    !/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash) ||
    path.win32.basename(providerHomeSourcePath).toLowerCase() !==
      plan.provider ||
    path.win32.basename(path.win32.dirname(providerHomeSourcePath)) !==
      "ProviderHomes"
  )
    return null;
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  const resources = authenticationResources(plan.provider, plan.action, suffix);
  if (
    plan.ownershipLabel !== `crdd.coordinator.authentication=${suffix}` ||
    plan.absenceCommands.map((command) => command.argv.at(-1)).join("\0") !==
      resources.map((resource) => resource.name).join("\0")
  )
    return null;
  const runtimeRoot = path.win32.dirname(
    path.win32.dirname(providerHomeSourcePath),
  );
  const recordPath = path.win32.join(
    runtimeRoot,
    "Recovery",
    "provider-authentication",
    `${plan.provider}.${stableLogicalHomeBindingHash}.json`,
  );
  return Object.freeze({
    contract: "crdd-coordinator/provider-authentication-recovery",
    contractRevision: 1,
    provider: plan.provider,
    action: plan.action,
    recoveryId: `provider-auth.${plan.provider}.${plan.action}.${stableLogicalHomeBindingHash}`,
    stableLogicalHomeBindingHash,
    suffix: plan.ownershipLabel.slice(plan.ownershipLabel.indexOf("=") + 1),
    ownershipLabel: plan.ownershipLabel,
    state: "active",
    commandState: "idle",
    commandPurpose: null,
    resourceNames: Object.freeze(resources.map((resource) => resource.name)),
    resources,
    recordPath,
  });
}

/**
 * 保存済み回復記録が期待するIdentityと同じか判定する。
 *
 * @responsibility 未信頼JSONをrevision 1のexact Recovery Recordへ照合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input value: 未信頼の保存値、expected: 現在の期待回復記録
 * @returns Identity、資源集合および状態語彙が一致する場合だけtrueを返す。
 * @precondition expectedは現在のProvider Homeと固定Planから構築済みである。
 * @postcondition trueの場合だけ既存記録を同じ回復Lifecycleへ利用できる。
 * @effect N/A: 入力値だけを読み取る。
 * @failure 不正形状、余分な状態またはIdentity不一致はfalseへ閉じる。
 * @invariant Pathや秘密値の類似から同一性を推定しない。
 * @boundary 未信頼Filesystem JSONからRecovery Domain値への検証境界。
 * @security accessorや任意Prototypeを実行せず、固定Propertyだけを照合する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function sameRecoveryRecord(
  value: unknown,
  expected: AuthenticationRecoveryRecord,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !==
    "action,commandPurpose,commandState,contract,contractRevision,ownershipLabel,provider,recoveryId,resourceNames,resources,stableLogicalHomeBindingHash,state,suffix"
  )
    return false;
  const isCommandStateValid =
    (record.commandState === "idle" && record.commandPurpose === null) ||
    (record.commandState === "in_flight" &&
      typeof record.commandPurpose === "string" &&
      /^[a-z][a-z0-9_]{1,63}$/u.test(record.commandPurpose));
  return (
    record.contract === expected.contract &&
    record.contractRevision === expected.contractRevision &&
    record.provider === expected.provider &&
    record.action === expected.action &&
    record.recoveryId === expected.recoveryId &&
    record.stableLogicalHomeBindingHash ===
      expected.stableLogicalHomeBindingHash &&
    record.suffix === expected.suffix &&
    record.ownershipLabel === expected.ownershipLabel &&
    (record.state === "active" || record.state === "settled") &&
    isCommandStateValid &&
    Array.isArray(record.resources) &&
    record.resources.length === expected.resources.length &&
    record.resources.every((resource: unknown, index: number) => {
      if (!resource || typeof resource !== "object" || Array.isArray(resource))
        return false;
      const value = resource as Record<string, unknown>;
      const target = expected.resources[index];
      return (
        target !== undefined &&
        Object.keys(value).sort().join(",") === "dockerId,kind,name" &&
        value.kind === target.kind &&
        value.name === target.name &&
        (value.dockerId === null ||
          (typeof value.dockerId === "string" &&
            /^[a-f0-9]{64}$/u.test(value.dockerId)))
      );
    }) &&
    Array.isArray(record.resourceNames) &&
    record.resourceNames.length === expected.resourceNames.length &&
    record.resourceNames.every(
      (name, index) => name === expected.resourceNames[index],
    )
  );
}

/**
 * Provider認証の耐久回復Lifecycleを開始または再入場する。
 *
 * @responsibility active IntentをDocker Effect前に排他的に公開し、既存activeとsettled再利用を区別する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: exact Recovery Identityへ結合した回復記録
 * @returns 新規開始created、既存activeのexisting、観測不能または不一致のunknownを返す。
 * @precondition 呼出し側が同じLogical Provider HomeのKernel Lockを保持する。
 * @postcondition createdではfinal Pathにexact active記録が存在し、existingでは既存active記録を変更しない。
 * @effect OS管理Runtime Rootの回復Storeへpending write、flush、renameまたはsettledからactiveへの更新を行う。
 * @failure 不一致、競合、読書きまたはrename失敗をunknownへ閉じる。
 * @invariant 回復Identityまたは資源集合が異なる既存記録を上書きしない。
 * @boundary Filesystem耐久記録の作成・再入場境界。
 * @security 秘密値を記録せず、検証済み記録Path以外へ書き込まない。
 * @concurrency Kernel Lockを保持する単一Writerだけが状態を遷移させる。
 */
export function beginProviderAuthenticationRecovery(
  record: AuthenticationRecoveryRecord,
): ReturnType<Dependencies["beginRecovery"]> {
  try {
    const temporary = `${record.recordPath}.pending`;
    const previous = fs.existsSync(record.recordPath)
      ? fs.readFileSync(record.recordPath, "utf8")
      : null;
    if (previous !== null) {
      const existing = JSON.parse(previous) as Record<string, unknown>;
      const action = existing.action;
      if (action !== "status" && action !== "login") return "unknown";
      const resources = authenticationResources(
        record.provider,
        action,
        record.suffix,
      );
      const expected: AuthenticationRecoveryRecord = {
        ...record,
        action,
        recoveryId: `provider-auth.${record.provider}.${action}.${record.stableLogicalHomeBindingHash}`,
        resources,
        resourceNames: resources.map((resource) => resource.name),
      };
      if (!sameRecoveryRecord(existing, expected)) return "unknown";
      if (existing.state === "active") {
        if (action !== record.action)
          return Object.freeze({
            status: "prior_action_active",
            recoveryId: expected.recoveryId,
          });
        return existing.commandState === "in_flight"
          ? "existing_in_flight"
          : "existing_idle";
      }
      if (existing.commandState !== "idle") return "unknown";
    }
    fs.mkdirSync(path.win32.dirname(record.recordPath), { recursive: true });
    const payload = `${JSON.stringify({
      ...record,
      recordPath: undefined,
      state: "active",
      commandState: "idle",
      commandPurpose: null,
    })}\n`;
    let recoveredPending = false;
    if (fs.existsSync(temporary)) {
      const pending = fs.readFileSync(temporary, "utf8");
      // Pendingは未発行Intentだけ。Receiptやin-flightを新規実行へ読み替えない。
      if (pending !== payload) return "unknown";
      recoveredPending = true;
    } else {
      fs.writeFileSync(temporary, payload, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
    }
    const current = fs.existsSync(record.recordPath)
      ? fs.readFileSync(record.recordPath, "utf8")
      : null;
    if (current !== previous) return "unknown";
    fs.renameSync(temporary, record.recordPath);
    if (fs.readFileSync(record.recordPath, "utf8") !== payload)
      return "unknown";
    // 正本不在から回復したpendingは、過去のEffect不存在を推定しない。
    return recoveredPending && previous === null ? "existing_idle" : "created";
  } catch {
    return "unknown";
  }
}
/**
 * Provider認証Commandの耐久実行状態を更新する。
 *
 * @responsibility Docker Effect前のin-flight Intentと子Process close後のidle settlementを同じRecovery IDへ耐久化する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: exact回復記録、state: idleまたはin_flight、purpose: 固定Command用途またはnull
 * @returns exact active記録の更新と再読取りが成立した場合だけtrueを返す。
 * @precondition 呼出し側がLogical Provider Home Kernel Lockを保持し、in_flightはEffect前、idleは子Process close後である。
 * @postcondition in_flightはCommand用途を保持し、idleは用途をnullへ戻す。
 * @effect OS管理Runtime Rootのexact回復記録を同期更新する。
 * @failure 記録不一致、状態組合せ不正または読書き失敗をfalseへ閉じる。
 * @invariant in_flightが残る世代へfresh OwnerはDocker cleanupまたは新規認証Effectを発行しない。
 * @boundary Filesystem耐久記録とDocker Command Processの世代Barrier。
 * @security 固定Command用途だけを記録し、argv、Path、CredentialまたはProvider出力を記録しない。
 * @concurrency Kernel Lockを保持する単一WriterだけがCommand状態を更新する。
 */
export function setProviderAuthenticationRecoveryCommandState(
  record: AuthenticationRecoveryRecord,
  state: "idle" | "in_flight",
  purpose: string | null,
) {
  if (
    (state === "idle" && purpose !== null) ||
    (state === "in_flight" &&
      (typeof purpose !== "string" || !/^[a-z][a-z0-9_]{1,63}$/u.test(purpose)))
  )
    return false;
  try {
    const existing = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as unknown;
    if (!sameRecoveryRecord(existing, record)) return false;
    const current = existing as Record<string, unknown>;
    if (
      current.state !== "active" ||
      (state === "in_flight" &&
        (current.commandState !== "idle" || current.commandPurpose !== null)) ||
      (state === "idle" && current.commandState !== "in_flight")
    )
      return false;
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({
        ...current,
        recordPath: undefined,
        state: "active",
        commandState: state,
        commandPurpose: purpose,
      })}\n`,
      { encoding: "utf8", flush: true },
    );
    const updated = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as Record<string, unknown>;
    return (
      sameRecoveryRecord(updated, record) &&
      updated.state === "active" &&
      updated.commandState === state &&
      updated.commandPurpose === purpose
    );
  } catch {
    return false;
  }
}

/**
 * 作成中の元資源実IDを同じ回復記録へ保存し読戻す。
 * @responsibility 作成完了と実IDの保存確定をidle遷移前に結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: 元回復相関。name、dockerId: 下位の構成確認済み作成Receipt。
 * @returns 保存・読戻し一致時だけtrue。
 * @precondition 下位が元create結果と即時inspectのID・構成を確認済み。
 * @postcondition 別名・別用途・別IDへReceiptを付け替えない。
 * @effect 既存回復記録だけを同期更新する。
 * @failure 未終了Intent、不正ID、記録差、保存・読戻し不明はfalse。
 * @invariant 新Storeや回復Identityを追加しない。
 * @boundary 下位作成Receiptと既存耐久記録。
 * @security 秘密値・生出力・Host Pathを保存しない。
 * @concurrency 同じHome Lockを保持する単一Writerで処置する。
 */
export function recordProviderAuthenticationResource(
  record: AuthenticationRecoveryRecord,
  name: string,
  dockerId: string,
) {
  if (!/^[a-f0-9]{64}$/u.test(dockerId)) return false;
  try {
    const current = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as AuthenticationRecoveryRecord;
    if (
      !sameRecoveryRecord(current, record) ||
      current.state !== "active" ||
      current.commandState !== "in_flight"
    )
      return false;
    const index = record.resourceNames.indexOf(name);
    const purposes = [
      "create_probe",
      "create_login",
      "create_proxy",
      "create_internal_network",
      "create_egress_network",
    ];
    if (index < 0 || current.commandPurpose !== purposes[index]) return false;
    const resource = current.resources[index];
    if (
      !resource ||
      (resource.dockerId !== null && resource.dockerId !== dockerId)
    )
      return false;
    const resources = current.resources.map((value, position) =>
      position === index ? { ...value, dockerId } : value,
    );
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({ ...current, recordPath: undefined, resources })}\n`,
      { encoding: "utf8", flush: true },
    );
    const updated = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as unknown;
    return (
      sameRecoveryRecord(updated, record) &&
      JSON.stringify((updated as AuthenticationRecoveryRecord).resources) ===
        JSON.stringify(resources) &&
      (updated as AuthenticationRecoveryRecord).commandState === "in_flight" &&
      (updated as AuthenticationRecoveryRecord).commandPurpose ===
        current.commandPurpose
    );
  } catch {
    return false;
  }
}

/**
 * 同じexact回復記録の資源Receiptを現在読取りする。
 * @responsibility 旧形式・欠測を空Receiptへ補完しない。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: 元回復相関。
 * @returns 操作に対応する資源Receipt、または観測不能null。
 * @precondition 認可・Home Lockは上位が確認する。
 * @postcondition 永続記録を変更しない。
 * @effect 既存記録を同期読取る。
 * @failure 旧版、不正Identity、読取り不明はnull。
 * @invariant nullを未作成・不存在にしない。
 * @boundary 現在耐久記録と上位回復。
 * @security PathやCredentialを結果へ含めない。
 * @concurrency 同じHome Lock生存中に再観測する。
 */
export function readProviderAuthenticationResources(
  record: AuthenticationRecoveryRecord,
) {
  try {
    const current = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as AuthenticationRecoveryRecord;
    if (!sameRecoveryRecord(current, record) || current.state !== "active")
      return null;
    return Object.freeze(
      current.resources.map((resource) => Object.freeze({ ...resource })),
    );
  } catch {
    return null;
  }
}

/**
 * Provider認証の耐久回復Lifecycleをsettledへ閉じる。
 *
 * @responsibility exact記録を削除せずsettledへ遷移させ、Lock解放不明でもRecovery Identityを保持する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input record: 現在Lifecycleのexact回復記録
 * @returns settled状態の再読取りまで成立した場合だけtrueを返す。
 * @precondition 所有Docker資源の不存在が確認され、呼出し側がKernel Lockを保持する。
 * @postcondition 成功時は同じfinal Pathにexact settled記録が存在する。
 * @effect OS管理Runtime Rootの回復記録をsettled状態へ更新し再読取りする。
 * @failure 記録不一致、欠落または読書き失敗ではfalseを返し、成功を公開しない。
 * @invariant Recovery ID、所有Labelおよび資源集合を変更しない。
 * @boundary Filesystem耐久記録の終端状態確定境界。
 * @security 秘密値を追加せず、既存exact記録以外を変更しない。
 * @concurrency Kernel Lockを保持する単一Writerだけが状態を遷移させる。
 */
export function settleProviderAuthenticationRecovery(
  record: AuthenticationRecoveryRecord,
) {
  try {
    const existing = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as unknown;
    if (
      !sameRecoveryRecord(existing, record) ||
      (existing as Record<string, unknown>).commandState !== "idle" ||
      (existing as Record<string, unknown>).commandPurpose !== null
    )
      return false;
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({ ...(existing as AuthenticationRecoveryRecord), recordPath: undefined, state: "settled" })}\n`,
      { encoding: "utf8", flush: true },
    );
    const settled = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as Record<string, unknown>;
    return sameRecoveryRecord(settled, record) && settled.state === "settled";
  } catch {
    return false;
  }
}

/**
 * 本番Provider認証Lifecycleの外部境界を構成する。
 *
 * @responsibility 下位の固定認証Runtime、Kernel LockおよびRecovery Storeを結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input N/A: 固定Runtime構成と現在環境を観測する。
 * @returns 本番境界へ閉じたDependenciesを返す。
 * @precondition 下位の固定認証Runtime Factoryを構成できる。
 * @postcondition 各Command実行前にDocker CLI Identityを再検証する構成だけを返す。
 * @effect 下位Factoryの技術観測を呼び、上位の保存・排他を接続する。
 * @failure 境界を構成できない場合は例外でFail Closedする。
 * @invariant 任意RunnerまたはRepository Pathを注入しない。
 * @boundary Coordinator DomainとHost Docker／Recovery Runtimeの構成境界。
 * @security 固定Environmentと検証済み実行ファイルだけを使用する。
 * @concurrency 同じLogical Provider HomeはKernel Lockで直列化する。
 */
export function createProviderAuthenticationDependencies(): Dependencies {
  const createRuntime = createDockerAuthenticationRuntimeFactory();
  let processUnsettled = false;
  const runtimes = new WeakMap<
    ProviderAuthenticationPlan,
    ReturnType<typeof createRuntime>
  >();
  return Object.freeze({
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
    beginRecovery: beginProviderAuthenticationRecovery,
    setRecoveryCommandState: setProviderAuthenticationRecoveryCommandState,
    completeRecovery: settleProviderAuthenticationRecovery,
    recordCreatedResource: (record, result) =>
      result.resourceCreationConfirmed === true &&
      result.resourceReceipt !== undefined &&
      recordProviderAuthenticationResource(
        record,
        result.resourceReceipt.name,
        result.resourceReceipt.dockerId,
      ),
    isProcessCompletionConfirmed: () => !processUnsettled,
    recoveryCommands: (record, plan, index) => {
      const technicalPlan = authenticationTechnicalPlans.get(plan);
      const receipts = readProviderAuthenticationResources(record);
      const receipt = receipts?.[index];
      const absenceCommand = plan.absenceCommands[index];
      if (!technicalPlan || !receipt || !absenceCommand) return null;
      if (receipt.dockerId === null)
        return Object.freeze({
          ownershipCommand: absenceCommand,
          cleanupCommand: null,
          absenceCommand,
        });
      return planDockerAuthenticationResourceRecovery(
        technicalPlan,
        receipt.name,
        receipt.dockerId,
      );
    },
    run: async (command, authorityLive, plan) => {
      if (processUnsettled)
        throw new Error("docker_authentication_process_completion_unconfirmed");
      const technicalPlan = authenticationTechnicalPlans.get(plan);
      if (!technicalPlan) throw new Error("docker_authentication_plan_unbound");
      const runtime = runtimes.get(plan) ?? createRuntime(technicalPlan);
      runtimes.set(plan, runtime);
      const result = await runtime.execute(command, authorityLive);
      if (!result.processCompletionConfirmed) processUnsettled = true;
      if (
        command.purpose.startsWith("observe_") &&
        result.resourceConfigurationConfirmed === true
      )
        return Object.freeze({
          ...result,
          stdout: plan.ownershipLabel.split("=")[1] ?? "",
        });
      return result.error?.message === "docker_execution_permit_lost"
        ? Object.freeze({
            ...result,
            error: new Error("provider_home_lock_lost"),
          })
        : result;
    },
  });
}

/**
 * Provider認証の固定Docker Planを構築する。
 *
 * @responsibility 認証Effectを固定Image、限定Egressおよび専用Provider Homeだけへ制限する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Homeの絶対Path、suffix: Logical Provider Home Identity由来hex
 * @returns 検証済み入力では固定Plan、不正入力ではnullを返す。
 * @precondition providerHomeSourcePathはPlatform Accessが選択Userから導いたPathである。
 * @postcondition PlanにRepository mount、host network、API keyまたは任意Commandを含めない。
 * @effect N/A: Plan生成だけを行う。
 * @failure 不正Path、suffixまたは固定配布契約の不一致をnullへ閉じる。
 * @invariant 選択Providerの公式CLI認証とnetwork-noneの事後Probeだけを許可する。
 * @boundary Host Docker CLIへ渡す引数の生成境界。
 * @security Provider Home Pathを結果以外へ公開せず、秘密値を読まない。
 * @concurrency 同じLogical Provider Homeは安定suffixとKernel Lockで単一Lifecycleへ直列化する。
 */
export function createProviderAuthenticationPlan<A extends "status" | "login">(
  provider: Provider,
  action: A,
  providerHomeSourcePath: string,
  suffix: string,
  proxyToken: A extends "login" ? string : null,
): ProviderAuthenticationPlan<A> | null {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (action !== "status" && action !== "login") ||
    !/^[a-f0-9]{16}$/u.test(suffix) ||
    typeof providerHomeSourcePath !== "string" ||
    providerHomeSourcePath.length === 0 ||
    /[\0\r\n,]/u.test(providerHomeSourcePath) ||
    (action === "login"
      ? typeof proxyToken !== "string" || !/^[a-f0-9]{64}$/u.test(proxyToken)
      : proxyToken !== null)
  )
    return null;
  const cli = describeProviderAuthentication(provider);
  const locations = describeDockerProviderExecutionLocations(provider, "probe");
  const environment = Object.freeze({
    ...("environment" in cli ? cli.environment : {}),
    ...("homeEnvironmentVariable" in cli
      ? { [cli.homeEnvironmentVariable]: locations.providerHomeDirectory }
      : {}),
  });
  const providerImageDigest =
    describeDockerProviderAssets(provider).fixedImageDigest;
  const probeContainerName = `crdd-auth-${suffix}`;
  const ownershipLabel = `crdd.coordinator.authentication=${suffix}`;
  const common = {
    provider,
    action,
    providerHomeSourcePath,
    providerImageDigest,
    ownershipLabel,
    probeContainerName,
  };
  if (!/^sha256:[a-f0-9]{64}$/u.test(providerImageDigest)) return null;
  if (action === "status") {
    const technicalPlan = planDockerAuthenticationCommands({
      action: "status",
      providerHomeSourcePath,
      providerImageDigest,
      ownershipLabel,
      probeContainerName,
      authenticationCli: { statusArgv: cli.statusArgv, environment },
    });
    const plan = Object.freeze({
      ...common,
      commands: technicalPlan.commands,
      ownershipCommands: technicalPlan.ownershipCommands,
      cleanupCommands: technicalPlan.cleanupCommands,
      absenceCommands: technicalPlan.absenceCommands,
    }) as ProviderAuthenticationPlan<A>;
    authenticationTechnicalPlans.set(plan, technicalPlan);
    return plan;
  }
  const egress = describeDockerProxyTopology(provider);
  const proxyImageDigest = egress.imageDigest;
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(proxyImageDigest) ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    typeof proxyToken !== "string"
  )
    return null;
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const loginContainerName = `crdd-${provider}-${suffix}`;
  const technicalPlan = planDockerAuthenticationCommands({
    action: "login",
    providerHomeSourcePath,
    providerImageDigest,
    proxyImageDigest,
    ownershipLabel,
    probeContainerName,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    proxyToken,
    proxyPort: egress.containerPort,
    proxyProfile: provider,
    authenticationCli: {
      loginArgv: cli.loginArgv,
      statusArgv: cli.statusArgv,
      environment,
    },
  });
  const plan = Object.freeze({
    ...common,
    proxyImageDigest,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    commands: technicalPlan.commands,
    ownershipCommands: technicalPlan.ownershipCommands,
    cleanupCommands: technicalPlan.cleanupCommands,
    absenceCommands: technicalPlan.absenceCommands,
  }) as ProviderAuthenticationPlan<A>;
  authenticationTechnicalPlans.set(plan, technicalPlan);
  return plan;
}

/**
 * Docker資源名を正規表現literalへ変換する。
 *
 * @responsibility 固定資源名をstderr exact照合で安全に使用できる形へ変換する。
 * @trace ARCH-000010
 * @input value: 固定Planから得たDocker資源名
 * @returns 正規表現meta文字をescapeした文字列を返す。
 * @precondition valueはCommand末尾から取得した文字列である。
 * @postcondition 返却値を正規表現へ埋めても元文字列のliteral一致になる。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure N/A: 任意文字列を決定論的にescapeする。
 * @invariant 文字を削除または意味変換しない。
 * @boundary Docker資源Identityとstderr parserの表現境界。
 * @security 正規表現注入を防ぐ。
 * @concurrency N/A: 共有状態を変更しない同期変換である。
 */
function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Docker結果が対象資源の明示不存在を示すか判定する。
 *
 * @responsibility exit、stdout、stderrおよびexact資源名の積で不存在を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: 不存在確認Command、result: その実行観測
 * @returns 明示不存在をすべて確認した場合だけtrueを返す。
 * @precondition commandは固定PlanのabsenceCommands要素である。
 * @postcondition 観測不能、任意stdoutまたは別資源の結果を不存在へ畳まない。
 * @effect N/A: 入力値だけを読み取る。
 * @failure 不正結果や未知形式はfalseへ閉じる。
 * @invariant status 1と固定stderrの両方を必要とする。
 * @boundary Docker CLI観測から資源不存在Domain判定への境界。
 * @security stderr全体を公開せず固定形式だけを判定する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function explicitDockerAbsence(command: Command, result: Execution) {
  const normalizedStdout = result.stdout.trim();
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 1 ||
    (normalizedStdout.length !== 0 && normalizedStdout !== "[]")
  )
    return false;
  const resourceName = command.argv.at(-1);
  if (!resourceName) return false;
  const exactName = escapeRegularExpression(resourceName);
  const normalized = result.stderr.trim();
  if (command.purpose.includes("network"))
    return new RegExp(
      `^(?:Error response from daemon: )?(?:network ${exactName} not found|No such network: ${exactName})$`,
      "u",
    ).test(normalized);
  return new RegExp(
    `^(?:(?:Error response from daemon|Error): )?No such (?:object|container): ${exactName}$`,
    "u",
  ).test(normalized);
}

/**
 * Provider認証が所有するDocker資源を確認付きで清掃する。
 *
 * @responsibility 所有権確認、対象限定削除、最終不存在観測およびAuthority生存確認を順序付ける。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input plan: 固定認証Plan、dependencies: 実行境界、authorityLive: Kernel Lock生存観測
 * @returns 全対象の不存在とAuthority生存を確認した場合だけtrueを返す。
 * @precondition planのcleanup、ownership、absence Commandが同じ順序で対応する。
 * @postcondition 非所有資源を削除せず、観測不能をcleanup成功へ畳まない。
 * @effect Docker inspect、removeおよびnetwork removeを対象限定で発行する。
 * @failure Command失敗、所有不一致、Authority喪失または不存在未確認をfalseへ閉じる。
 * @invariant Plan外の資源名へ削除Effectを発行しない。
 * @boundary Coordinator cleanup LifecycleとDocker Engineの外部境界。
 * @security 所有Label一致前に削除せず、生出力を公開しない。
 * @concurrency Kernel Lockが生存する単一Lifecycleだけが清掃する。
 */
async function cleanAuthenticationResources(
  plan: ProviderAuthenticationPlan,
  dependencies: Dependencies,
  authorityLive: () => boolean,
  recovery: AuthenticationRecoveryRecord,
) {
  let cleanupConfirmed = true;
  let processCompletionConfirmed = true;
  let recordingConfirmed = true;
  /**
   * 同じ認証回復IDで清掃操作のIntentと終了を記録する。
   * @responsibility 観測・削除・不存在確認も開始前in_flight、終了確認後idleへ接続する。
   * @trace ARCH-000010
   * @trace ARCH-000015
   * @input command: 元計画の固定清掃操作。
   * @returns 元Process結果。
   * @precondition 同じHome許可とexact回復記録を使用する。
   * @postcondition 終了不明や保存不明では後続Effectを発行しない。
   * @effect 既存記録更新と固定Docker操作を発行する。
   * @failure 記録・許可・終了未確認は停止する。
   * @invariant 新StateやRecoveryを追加しない。
   * @boundary 清掃Lifecycleと既存回復記録。
   * @security 元計画以外の操作は選択しない。
   * @concurrency 同じHome Lock生存中だけ逐次実行する。
   */
  async function execute(command: Command) {
    if (!authorityLive() || !recordingConfirmed || !processCompletionConfirmed)
      throw new Error("provider_authentication_cleanup_stopped");
    if (
      !dependencies.setRecoveryCommandState(
        recovery,
        "in_flight",
        command.purpose,
      )
    ) {
      recordingConfirmed = false;
      throw new Error("provider_authentication_cleanup_intent_unconfirmed");
    }
    let result: Execution;
    try {
      result = await dependencies.run(command, authorityLive, plan);
    } catch {
      processCompletionConfirmed = false;
      throw new Error("provider_authentication_process_completion_unconfirmed");
    }
    if (result.processCompletionConfirmed === false) {
      processCompletionConfirmed = false;
      throw new Error("provider_authentication_process_completion_unconfirmed");
    }
    if (!authorityLive()) {
      recordingConfirmed = false;
      throw new Error("provider_authentication_cleanup_permit_lost");
    }
    if (!dependencies.setRecoveryCommandState(recovery, "idle", null)) {
      recordingConfirmed = false;
      throw new Error("provider_authentication_cleanup_settlement_unconfirmed");
    }
    return result;
  }
  for (let index = 0; index < plan.cleanupCommands.length; index += 1) {
    if (!authorityLive() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    const selected = dependencies.recoveryCommands(recovery, plan, index);
    if (!selected) {
      cleanupConfirmed = false;
      break;
    }
    const {
      ownershipCommand,
      cleanupCommand,
      absenceCommand,
      identityAbsenceCommand,
    } = selected;
    try {
      const ownership = await execute(ownershipCommand);
      const alreadyAbsent = explicitDockerAbsence(ownershipCommand, ownership);
      if (alreadyAbsent && !identityAbsenceCommand) continue;
      if (
        !alreadyAbsent &&
        (ownership.error ||
          ownership.signal !== null ||
          ownership.status !== 0 ||
          ownership.stderr.trim().length !== 0 ||
          ownership.stdout.trim() !== plan.ownershipLabel.split("=")[1])
      ) {
        cleanupConfirmed = false;
        continue;
      }
      if (!alreadyAbsent) {
        if (!cleanupCommand) {
          cleanupConfirmed = false;
          continue;
        }
        const removed = await execute(cleanupCommand);
        if (removed.error || removed.signal !== null || removed.status !== 0)
          cleanupConfirmed = false;
      }
    } catch {
      cleanupConfirmed = false;
    }
    if (!authorityLive() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    try {
      if (identityAbsenceCommand) {
        const identityResult = await execute(identityAbsenceCommand);
        if (!explicitDockerAbsence(identityAbsenceCommand, identityResult))
          cleanupConfirmed = false;
      }
      const result = await execute(absenceCommand);
      if (!explicitDockerAbsence(absenceCommand, result))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  return Object.freeze({
    confirmed:
      cleanupConfirmed &&
      recordingConfirmed &&
      processCompletionConfirmed &&
      authorityLive() &&
      (dependencies.isProcessCompletionConfirmed?.() ?? true),
    processCompletionConfirmed:
      processCompletionConfirmed &&
      (dependencies.isProcessCompletionConfirmed?.() ?? true),
  });
}

/**
 * 専用Provider Homeで状態確認または公式対話認証を実行する。
 *
 * @responsibility Planの順序実行、対話境界、事後認証確認およびexact cleanupを所有する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Home、stableLogicalHomeBindingHash: Provider Homeの安定Identity、dependencies: Test差替え可能なProcess境界
 * @returns 秘密値や生Provider出力を含まない固定結果を返す。
 * @precondition 選択実行物の同一性を確認し、loginでは呼出し元が対話端末を確保する。
 * @postcondition 認証観測と操作別資源cleanupを別の事実として返し、観測不能を未認証へ丸めない。
 * @effect statusは通信なし・Home読取り専用のDocker確認、loginだけがNetworkと専用HomeのOAuth credentialを変更する。
 * @failure 故障を自動再試行せずcleanup結果付きでblockedへ閉じる。statusの正規未ログインは確認完了と区別する。
 * @invariant Repository、Workspace、host credentialおよびAPI keyを接続しない。
 * @boundary 人間端末、Docker Engine、限定Proxy、選択Provider認証Endpointの外部境界。
 * @security OAuth対話はTTYへ直接接続し、生出力、token、URLまたはPathを結果へ保存しない。
 * @concurrency Docker資源をOperation固有suffixで分離し、終了時にexact nameだけを清掃する。
 */
export async function authenticateProvider(
  provider: Provider,
  action: "status" | "login",
  providerHomeSourcePath: string,
  stableLogicalHomeBindingHash: string,
  dependencies?: Dependencies,
  signal?: AbortSignal,
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (action !== "status" && action !== "login")
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_input_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const cancellation = readExecutionCancellation(signal);
  if (cancellation === null)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_signal_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  if (cancellation)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_cancelled",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  let activeDependencies: Dependencies;
  try {
    activeDependencies =
      dependencies ?? createProviderAuthenticationDependencies();
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_docker_boundary_unavailable",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  }
  if (!/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash))
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_provider_home_identity_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const providerHomeLock = activeDependencies.acquireProviderHomeLock(
    stableLogicalHomeBindingHash,
  );
  if (!providerHomeLock)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_provider_home_active_or_unknown",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  let plan: ProviderAuthenticationPlan | null = null;
  let recovery: AuthenticationRecoveryRecord | null = null;
  try {
    const proxyToken =
      action === "login" ? activeDependencies.randomHex(32) : null;
    plan = createProviderAuthenticationPlan(
      provider,
      action,
      providerHomeSourcePath,
      suffix,
      proxyToken,
    );
    recovery = plan
      ? createProviderAuthenticationRecoveryRecord(
          providerHomeSourcePath,
          stableLogicalHomeBindingHash,
          plan,
        )
      : null;
    if (!plan || !recovery) throw Error("provider_authentication_plan_invalid");
  } catch {
    let lockReleased = false;
    try {
      lockReleased = providerHomeLock.release();
    } catch {
      /* 解放不明を成功へ変換しない。 */
    }
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_plan_invalid",
      cleanupConfirmed: lockReleased,
      providerEffectIssued: false,
      manualRecoveryRequired: !lockReleased,
      processRestartRequired: !lockReleased,
    });
  }
  let recoveryState = providerHomeLock.assertLive()
    ? activeDependencies.beginRecovery(recovery)
    : ("unknown" as const);
  if (typeof recoveryState === "object") {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_prior_action_active",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recoveryState.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  if (recoveryState === "unknown") {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_recovery_inventory_unknown",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  if (recoveryState === "existing_in_flight") {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_prior_command_in_flight",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  if (recoveryState === "existing_idle") {
    const recoveryCleanupConfirmed = await cleanAuthenticationResources(
      plan,
      activeDependencies,
      providerHomeLock.assertLive,
      recovery,
    );
    if (
      !recoveryCleanupConfirmed.confirmed ||
      !activeDependencies.completeRecovery(recovery)
    ) {
      if (recoveryCleanupConfirmed.processCompletionConfirmed)
        providerHomeLock.release();
      return Object.freeze({
        status: "blocked",
        reason: "provider_authentication_recovery_unconfirmed",
        cleanupConfirmed: false,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: true,
      });
    }
    recoveryState = activeDependencies.beginRecovery(recovery);
    if (recoveryState !== "created") {
      providerHomeLock.release();
      return Object.freeze({
        status: "blocked",
        reason: "provider_authentication_recovery_reentry_failed",
        cleanupConfirmed: false,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: false,
      });
    }
  }
  let reason = "provider_authentication_completed";
  let authenticationStatus: "confirmed" | "unconfirmed" | "unknown" = "unknown";
  let authenticationConfirmed = false;
  let providerEffectIssued = false;
  let processCompletionUnknown = false;
  try {
    for (const command of plan.commands) {
      if (readExecutionCancellation(signal) !== false) {
        reason = "provider_authentication_cancelled";
        break;
      }
      if (!providerHomeLock.assertLive()) {
        reason = "provider_authentication_provider_home_lock_lost";
        break;
      }
      if (
        !activeDependencies.setRecoveryCommandState(
          recovery,
          "in_flight",
          command.purpose,
        )
      ) {
        reason = "provider_authentication_command_intent_unconfirmed";
        break;
      }
      providerEffectIssued = true;
      let result: Execution;
      try {
        result = await activeDependencies.run(
          command,
          () =>
            readExecutionCancellation(signal) === false &&
            providerHomeLock.assertLive(),
          plan,
        );
      } catch {
        processCompletionUnknown = true;
        reason = "provider_authentication_process_completion_unconfirmed";
        break;
      }
      if (result.processCompletionConfirmed === false) {
        processCompletionUnknown = true;
        reason = "provider_authentication_process_completion_unconfirmed";
        break;
      }
      if (!providerHomeLock.assertLive()) {
        reason = "provider_authentication_provider_home_lock_lost";
        break;
      }
      if (
        command.purpose.startsWith("create_") &&
        !activeDependencies.recordCreatedResource(recovery, result)
      ) {
        reason = "provider_authentication_resource_receipt_unconfirmed";
        break;
      }
      if (!activeDependencies.setRecoveryCommandState(recovery, "idle", null)) {
        reason = "provider_authentication_command_settlement_unconfirmed";
        break;
      }
      const statusObservation =
        action === "status" &&
        command.purpose === "start_probe_attached" &&
        !result.error &&
        result.signal === null &&
        (result.status === 0 || result.status === 1)
          ? evaluateProviderAuthentication(
              provider,
              describeProviderAuthentication(provider).offering,
              result.stdout,
              result.stderr,
              "execution",
            )
          : null;
      const observedNotLoggedIn =
        result.status === 1 &&
        result.stderr === "" &&
        statusObservation?.status === "unconfirmed";
      if (
        result.error ||
        result.signal !== null ||
        (result.status !== 0 && !observedNotLoggedIn)
      ) {
        reason =
          result.error?.message === "provider_home_lock_lost"
            ? "provider_authentication_provider_home_lock_lost"
            : `provider_authentication_${command.purpose}_failed`;
        break;
      }
      if (command.purpose === "start_probe_attached") {
        const observed =
          statusObservation ??
          evaluateProviderAuthentication(
            provider,
            describeProviderAuthentication(provider).offering,
            result.stdout,
            result.stderr,
            action === "login" ? "login" : "execution",
          );
        authenticationStatus = observed.status;
        if (
          observed.status !== "confirmed" &&
          !(action === "status" && observed.status === "unconfirmed")
        ) {
          reason = "provider_authentication_not_confirmed";
          break;
        }
        authenticationConfirmed = observed.status === "confirmed";
      }
    }
  } catch {
    reason = "provider_authentication_failed_closed";
  }
  const cleanup = processCompletionUnknown
    ? { confirmed: false, processCompletionConfirmed: false }
    : await cleanAuthenticationResources(
        plan,
        activeDependencies,
        providerHomeLock.assertLive,
        recovery,
      );
  processCompletionUnknown ||= !cleanup.processCompletionConfirmed;
  let cleanupConfirmed = cleanup.confirmed;
  const isLockLiveAfterCleanup = providerHomeLock.assertLive();
  if (!isLockLiveAfterCleanup)
    reason = "provider_authentication_provider_home_lock_lost";
  if (cleanupConfirmed && isLockLiveAfterCleanup)
    cleanupConfirmed = activeDependencies.completeRecovery(recovery);
  else cleanupConfirmed = false;
  const lockReleased =
    !processCompletionUnknown &&
    (activeDependencies.isProcessCompletionConfirmed?.() ?? true) &&
    providerHomeLock.release();
  cleanupConfirmed = cleanupConfirmed && lockReleased;
  if (
    readExecutionCancellation(signal) !== false &&
    reason === "provider_authentication_completed"
  )
    reason = "provider_authentication_cancelled";
  const completed =
    readExecutionCancellation(signal) === false &&
    cleanupConfirmed &&
    (authenticationConfirmed ||
      (action === "status" && authenticationStatus === "unconfirmed"));
  return Object.freeze({
    contract: PROVIDER_AUTHENTICATION_CONTRACT,
    contractRevision: PROVIDER_AUTHENTICATION_CONTRACT_REVISION,
    status: completed ? "completed" : "blocked",
    reason: completed
      ? authenticationConfirmed
        ? "provider_authentication_confirmed"
        : "provider_authentication_unconfirmed"
      : reason,
    provider,
    action,
    offering: describeProviderAuthentication(provider).offering,
    humanInteractive: action === "login",
    repositoryMounted: false,
    workspaceMounted: false,
    providerEffectIssued,
    authenticationConfirmed,
    authenticationStatus: cleanupConfirmed ? authenticationStatus : "unknown",
    cleanupConfirmed,
    recoveryId: cleanupConfirmed ? null : recovery.recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    effectStateUnknown: !cleanupConfirmed,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}
/**
 * 認証操作が所有する固定資源集合を導く。
 * @responsibility status一資源とlogin五資源の相関を同じOwnerへ閉じる。
 * @trace ARCH-000010
 * @input action: 固定操作、suffix: 検査済みHome由来hex。
 * @returns Receipt未発行の不変資源列。
 * @precondition actionとsuffixは閉形式検査済み。
 * @postcondition statusにProxy・Network・loginを含めない。
 * @effect N/A: 局所値だけ。
 * @failure N/A: 固定集合から構築する。
 * @invariant 同名・経過時間だけから所有を推定しない。
 * @boundary 認証計画と耐久Identity。
 * @security 実IDは実create結果が得られるまでnull。
 * @concurrency 同期構築。
 */
function authenticationResources(
  provider: Provider,
  action: "status" | "login",
  suffix: string,
) {
  const entries: ["container" | "network", string][] =
    action === "status"
      ? [["container", `crdd-auth-${suffix}`]]
      : [
          ["container", `crdd-auth-${suffix}`],
          ["container", `crdd-${provider}-${suffix}`],
          ["container", `crdd-proxy-${suffix}`],
          ["network", `crdd-internal-${suffix}`],
          ["network", `crdd-egress-${suffix}`],
        ];
  return Object.freeze(
    entries.map(([kind, name]) =>
      Object.freeze({ kind, name, dockerId: null }),
    ),
  );
}

/**
 * 認証対象だけを指定する公開要求。
 * @responsibility Provider固有引数と秘密Pathを利用側へ要求しない。
 * @trace ARCH-000004
 * @shape 対応Provider一項目。
 * @invariant Repository・追加通信先・CLI引数を含めない。
 * @boundary 公開認証操作。
 * @security 認証値を搬送しない。
 * @compatibility 新形式だけを受理する。
 */
export type ProviderAuthenticationRequest = Readonly<{
  provider: "codex" | "claude";
}>;

/**
 * 認証要求を検査し、現在Userの専用Homeへ接続する。
 * @responsibility 公開要求から内部のHome観測と認証Lifecycleを一度だけ接続する。
 * @trace ARCH-000004
 * @input action: 固定操作、request: Providerだけの要求、signal: 呼出し元の取消。
 * @returns 秘密値を含まない操作結果。
 * @precondition 実認証前に旧記録の移行確認をフロントAIが完了する。
 * @postcondition 不正要求・取消ではHome観測・Docker操作を発行しない。
 * @effect 検査後だけ既存Home観測と認証操作を呼ぶ。
 * @failure Home不明は停止し、別Provider・Host認証へfallbackしない。
 * @invariant 設定・State・Lock・Retryを新設しない。
 * @boundary 公開要求と現在Userの保護Home。
 * @security Proxy／accessorを実行しない。Host Pathを結果へ複製しない。
 * @concurrency 実行中の排他・取消・終了待機は既存Ownerが所有する。
 */
export async function runProviderAuthenticationRequest(
  action: "status" | "login",
  request: ProviderAuthenticationRequest,
  signal?: AbortSignal,
) {
  const descriptors =
    request &&
    typeof request === "object" &&
    !utilTypes.isProxy(request) &&
    Object.getPrototypeOf(request) === Object.prototype
      ? Object.getOwnPropertyDescriptors(request)
      : null;
  const property = descriptors?.provider;
  const provider = property && "value" in property ? property.value : null;
  if (
    !descriptors ||
    Reflect.ownKeys(descriptors).length !== 1 ||
    !property?.enumerable ||
    (provider !== "codex" && provider !== "claude")
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_input_invalid",
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  const cancellation = readExecutionCancellation(signal);
  if (cancellation === null)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_signal_invalid",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  if (cancellation)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_cancelled",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  const observed = inspectRuntimeOwnedWindowsProviderHomeCandidate(provider);
  if (observed.status !== "candidate")
    return Object.freeze({
      status: "blocked",
      reason: observed.reason,
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: observed.helperExitConfirmed === true,
      manualRecoveryRequired: observed.helperExitConfirmed !== true,
      providerEffectIssued: false,
    });
  const consumed = consumeRuntimeOwnedProviderHomeObservationCapability(
    observed.observationCapability,
  );
  const source = consumed
    ? consumeRuntimeOwnedProviderHomeMountSourceCapability(
        consumed.providerHomeMountSourceCapability,
        provider,
      )
    : null;
  if (!consumed || !source)
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_provider_home_unavailable",
      provider,
      action,
      authenticationStatus: "unknown",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      providerEffectIssued: false,
    });
  return authenticateProvider(
    provider,
    action,
    source,
    consumed.stableLogicalHomeBindingHash,
    undefined,
    signal,
  );
}
