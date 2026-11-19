/**
 * 実行許可とRepository・Provider Homeの保護境界を検査する。
 *
 * @responsibility 現在Operationの適合、Root・Home実体と認証を確認する。
 * @trace ARCH-000008
 */

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, types } from "node:util";
import {
  getAuthenticationDefinition,
  type Provider,
  resolveModelSelection,
} from "../../../ai-adapter/src/index.ts";
import type {
  IsolationCallbacks,
  IsolationExecution,
} from "../../../docker-isolation/src/index.ts";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type ExecutionSelection,
  inspectExecutionSelection,
  type OperationResources,
  validateResourceBook,
} from "../../../execution-model/src/index.ts";
import {
  type AuthenticationOptions,
  cleanupResources,
  createExecutor,
  type Executor,
  type ExecutorCallbacks,
  type ExecutorRequest,
  type RecordProjection,
  type ResourceTarget,
} from "../../../executor/src/index.ts";
import type { LockResult } from "../../../lock/src/index.ts";
import {
  snapshotJsonValue,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../input/snapshot.ts";
import { getIsolationSettings } from "./configuration.ts";
import { acquireProviderHomeLock } from "./kernel-lock.ts";
import { observeRuntimeOwnedProviderEligibility } from "./observation.ts";
import {
  verifyOwnedOperationManagementCapability,
  verifyRuntimeOwnedRepositoryOperation,
} from "./operation.ts";
import { poisonRuntimeProcessAfterCleanupUnknown } from "./process-safety-state.ts";
/**
 * 完全選定の現在適合を確認する。
 * @responsibility Providerの現在観測とAD技術適合を同じ非発行判定へ集約する。
 * @trace ARCH-000010
 * @input selection: 捕捉済み完全選定、availability: 同一断面の現在観測。
 * @returns 成立時null、不成立時は固定理由。
 * @effect 現在の可用性観測だけ。Grantを発行しない。
 * @failure 欠測・重複Provider・未対応Modelは拒否する。
 * @boundary Coordinatorの現在性とAI Adapterの技術適合。
 */
function selectionEligibilityFailure(
  selection: ExecutionSelection,
  availability: ReturnType<typeof snapshotPlainArray<unknown>>,
) {
  if (availability.status !== "ok")
    return "delegation_selection_provider_observation_unavailable";
  const eligible = availability.value
    .map((item) =>
      snapshotPlainRecord(item, new Set(["provider", "status", "reason"])),
    )
    .filter((item) => item?.provider === selection.provider);
  if (eligible.length !== 1 || eligible[0]?.status !== "eligible")
    return "delegation_selection_provider_unavailable";
  const technical = resolveModelSelection({
    provider: selection.provider,
    modelIdentifier: selection.modelIdentifier,
    reasoningEffort: selection.reasoningEffort,
    purpose: selection.purpose,
  });
  return technical.status !== "resolved" ||
    technical.value.identifierKind !== selection.identifierKind ||
    technical.value.modelIdentifier !== selection.modelIdentifier ||
    technical.value.reasoningEffort !== selection.reasoningEffort
    ? "delegation_selection_model_unsupported"
    : null;
}

/**
 * 完全選定と現在Operation・Provider適合を確認する。
 * @responsibility 同じ観測断面の適合を確認し、許可記録や利用tokenを発行しない。
 * @trace ARCH-000010
 * @input 元Operationの管理参照、操作IDと一つ又は二つの完全選定。
 * @returns 捕捉した完全選定を持つ候補又は固定理由の拒否。
 * @effect 現在OperationとProvider可用性の読取りのみ。
 * @failure 操作差、欠測、未対応Model、観測例外を拒否する。
 * @boundary Coordinatorの受付とAI Adapterの技術適合。
 */
export function preflightRuntimeOwnedDelegationSelections(
  managementCapability: unknown,
  rawRequest: unknown,
) {
  try {
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const repository =
      verifyRuntimeOwnedRepositoryOperation(managementCapability);
    const request = snapshotPlainRecord(
      rawRequest,
      new Set(["operationId", "executionSelections"]),
    );
    const values = snapshotPlainArray<unknown>(request?.executionSelections, 2);
    if (
      !repository ||
      repository.operationId !== operation.operationId ||
      !request ||
      Object.keys(request).length !== 2 ||
      request.operationId !== operation.operationId ||
      values.status !== "ok" ||
      values.value.length < 1
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "delegation_slate_selection_invalid",
      });
    const selections: ExecutionSelection[] = [];
    for (const value of values.value) {
      const selection = inspectExecutionSelection(value);
      if (!selection)
        return Object.freeze({
          status: "blocked" as const,
          reason: "delegation_slate_selection_invalid",
        });
      selections.push(selection);
    }
    const availability = snapshotPlainArray<unknown>(
      observeRuntimeOwnedProviderEligibility(),
      2,
    );
    for (const selection of selections) {
      const failure = selectionEligibilityFailure(selection, availability);
      if (failure)
        return Object.freeze({ status: "blocked" as const, reason: failure });
    }
    return Object.freeze({
      status: "candidate" as const,
      operationId: operation.operationId,
      executionSelections: Object.freeze(selections),
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "delegation_slate_preflight_failed",
    });
  }
}

/** 起動元が指定したLocal AppDataから既存の固定Runtime保存先を組み立てる。OSの独立証明ではない。 */
export function runtimeStateDirectoryCandidate() {
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

export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT =
  "crdd-coordinator/provider-home-windows-adapter";

export const PROVIDER_HOME_WINDOWS_ADAPTER_CONTRACT_REVISION = 10;

/** 上位の既存設定から共有Homeの親所在を求める。作成・権限付与はしない。 */
export function providerHomesDirectoryCandidate(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (
    !isSupportedWindowsAbsolutePathCandidate(localAppData) ||
    path.win32.normalize(localAppData) !== localAppData
  )
    return null;
  return path.win32.join(localAppData, ...PROVIDER_HOME_ROOT_SEGMENTS);
}

/** 同じ設定の共有Home候補。実体・保護の確認は既存の観測Ownerが行う。 */
function runtimeOwnedProviderHomeMountSourceCandidate(provider: unknown) {
  if (provider !== "codex" && provider !== "claude") return null;
  const root = providerHomesDirectoryCandidate();
  const source = root ? path.win32.join(root, provider) : null;
  return source && !source.includes(",") ? source : null;
}

/**
 * provider-home-windows-adapterを停止結果として構築する。
 *
 * @responsibility provider-home-windows-adapterの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000010
 * @input reason: Node読取り観測の停止理由。
 * @returns blockedの計算結果を返す。
 * @precondition 子Process・Filesystem変更を行わない観測からだけ呼ぶ。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Node読取り観測の拒否分類と受付結果。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function providerHomeWindowsAdapterBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    providerHomeIdentityHash: null,
    stableLogicalHomeBindingHash: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    pathReported: false,
    principalReported: false,
    aclReported: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    providerHome: null,
    manualRecoveryRequired: false,
  });
}

/**
 * Runtime 所有 Windows Provider Home 候補を観測する。
 *
 * @responsibility Runtime 所有 Windows Provider Home 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input provider: codexまたはclaude。所在は上位設定から選定する。
 * @returns inspectRuntimeOwnedWindowsProviderHomeCandidateの計算結果を返す。
 * @precondition Windowsローカル単一ユーザー運用。Home基点は上位設定済みで新旧方式を並走しない。
 * @postcondition inspectRuntimeOwnedWindowsProviderHomeCandidateの責務を完了した結果だけを返す。
 * @effect NodeのDirectory・実体読取りのみ。許可tokenや子Processは生成しない。
 * @failure 不明実体・Link・Path差・旧Lock・観測例外は候補を発行せず停止する。
 * @invariant inspectRuntimeOwnedWindowsProviderHomeCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary 上位確定HomeとNode Filesystem。SID・Token・厳密DACLの独立検証は行わない。
 * @security inspectRuntimeOwnedWindowsProviderHomeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedWindowsProviderHomeCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedWindowsProviderHomeCandidate(
  provider: unknown,
) {
  if (
    process.platform !== "win32" ||
    (provider !== "codex" && provider !== "claude")
  )
    return providerHomeWindowsAdapterBlocked(
      "provider_home_node_input_invalid",
    );
  const source = runtimeOwnedProviderHomeMountSourceCandidate(provider);
  if (!source)
    return providerHomeWindowsAdapterBlocked(
      "provider_home_location_unavailable",
    );
  try {
    const read = () => {
      const stat = fs.lstatSync(source, { bigint: true });
      const canonical = fs.realpathSync.native(source);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.dev <= 0n ||
        stat.ino <= 0n ||
        stat.birthtimeNs <= 0n ||
        path.win32.normalize(canonical).toLocaleLowerCase("en-US") !==
          source.toLocaleLowerCase("en-US")
      )
        throw new Error("provider_home_identity_unknown");
      return stat;
    };
    const first = read();
    const canonical = fs.realpathSync.native(source);
    const parent = path.win32.dirname(canonical);
    const binding = (kind: string) =>
      createHash("sha256")
        .update("crdd-provider-home-resource-v2\0")
        .update(kind)
        .update("\0")
        .update(path.win32.join(parent, kind).toLocaleLowerCase("en-US"))
        .digest("hex");
    const knownLocks = new Set(
      ["codex", "claude"].map(
        (kind) => `executor.provider-home.${binding(kind)}.lock`,
      ),
    );
    if (
      fs
        .readdirSync(parent)
        .some(
          (name) =>
            name.toLowerCase().startsWith("executor.provider-home.") &&
            !knownLocks.has(name.toLowerCase()),
        )
    )
      return providerHomeWindowsAdapterBlocked(
        "provider_home_prior_lock_unresolved",
      );
    const second = read();
    if (
      first.dev !== second.dev ||
      first.ino !== second.ino ||
      first.birthtimeNs !== second.birthtimeNs
    )
      return providerHomeWindowsAdapterBlocked(
        "provider_home_identity_changed",
      );
    const observation = Object.freeze({
      provider,
      providerHomeIdentityHash: createHash("sha256")
        .update("crdd-provider-home-node-identity-v1\0")
        .update(provider)
        .update("\0")
        .update(String(first.dev))
        .update("\0")
        .update(String(first.ino))
        .update("\0")
        .update(String(first.birthtimeNs))
        .digest("hex"),
      stableLogicalHomeBindingHash: binding(provider),
      stableIdentityObserved: true,
      pathReported: false,
      principalReported: false,
      aclReported: false,
      credentialContentRead: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
    });
    return Object.freeze({
      ...observation,
      status: "candidate" as const,
      reason: "runtime_owned_node_provider_home_observed_candidate",
      executionSourceKind: "node_filesystem",
      processEffectIssued: false,
      manualRecoveryRequired: false,
      providerHome: Object.freeze({
        provider,
        providerHomeSourcePath: canonical,
        providerHomeIdentityHash: observation.providerHomeIdentityHash,
        stableLogicalHomeBindingHash: observation.stableLogicalHomeBindingHash,
      }),
    });
  } catch {
    return providerHomeWindowsAdapterBlocked(
      "provider_home_node_observation_unavailable",
    );
  }
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
    providers: Object.freeze(["codex", "claude"]),
    locationSource: "upper_configuration",
    observation: "node_lstat_realpath_and_physical_identity_twice",
    nativePolicyVerification: false,
    osPrincipalVerification: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
  });
}

export const PROVIDER_HOME_CONTRACT = "crdd-coordinator/provider-home";

export const PROVIDER_HOME_CONTRACT_REVISION = 8;

export const PROVIDER_HOME_ROOT_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "ProviderHomes",
]);

const providerHomePROVIDERS = Object.freeze(["codex", "claude"] as const);

const providerDirectoryNames = Object.freeze({
  codex: getAuthenticationDefinition("codex").homeDirectoryName,
  claude: getAuthenticationDefinition("claude").homeDirectoryName,
});

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
  const windowsAdapter = describeProviderHomeWindowsAdapterContract();
  return Object.freeze({
    contract: PROVIDER_HOME_CONTRACT,
    contractRevision: PROVIDER_HOME_CONTRACT_REVISION,
    platform: "windows_local_user_target_only",
    providers: providerHomePROVIDERS,
    requiredEffectRootSource: "upper_configured_provider_home_parent",
    rootSegments: PROVIDER_HOME_ROOT_SEGMENTS,
    providerDirectoryNames: providerDirectoryNames,
    scope: "canonical_provider_home_resource",
    persistentAcrossOperations: true,
    sharedAcrossRepositoriesForSameHome: true,
    hostDefaultHomeImportAllowed: false,
    hostCredentialImportAllowed: false,
    operationTemporaryHomeImportAllowed: false,
    otherProviderHomeSharingAllowed: false,
    operationCleanupOwned: false,
    symbolicLinkOrNoncanonicalPathAllowed: false,
    stableRootIdentityRequired: true,
    selectedLocalUserBindingRequired: false,
    ownerAndDaclVerificationRequired: false,
    osPermissions: "operator_precondition",
    providerRefreshWriteTarget: "provider_specific_home_only",
    tokenSessionOrPathReported: false,
    bootstrapEntry: "explicit_login_only_target",
    protectionEffect: "not_implemented",
    protectionObservation:
      "node_physical_directory_observation_no_acl_verification",
    selectedLocalUserBinder: "not_performed",
    windowsAdapter,
    authSessionProbe: "not_implemented",
    logoutRevocationAndDeletion: "not_implemented_separate_bootstrap_lifecycle",
    callerPathConfersAuthority: false,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
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
    types.isProxy(signal) ||
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
 * 認証の上位保存・Home排他と技術実行の接続。
 * @responsibility 技術実装を持たず現在記録の照会・保存・確定を所有する。
 * @trace ARCH-000010
 * @shape 準備、Home排他、Recovery受付・資源照会と専用Writer。
 * @invariant 保存結果を下位の通知ACKとして公開しない。
 * @boundary Coordinatorの記録OwnerとExecutor。
 * @security Secret値・任意Docker操作を受け取らない。
 * @compatibility 保存SchemaとLock解放条件を維持する。
 */
type Dependencies = Readonly<{
  randomHex: (bytes: number) => string;
  createAuthentication: (
    request: ExecutorRequest<"authentication">,
    options: AuthenticationOptions,
  ) => Executor<"authentication"> | null;
  createManagementDirectory: (
    record: AuthenticationRecoveryRecord,
  ) => AuthenticationManagementDirectory | null;
  removeManagementDirectory: (
    directory: AuthenticationManagementDirectory,
  ) => boolean;
  cleanupAuthentication: (
    target: ResourceTarget<"snapshot">,
    callbacks: IsolationCallbacks,
  ) => IsolationExecution;
  acquireProviderHomeLock: (
    identityHash: string,
    directory: string,
  ) => LockResult<Readonly<{ assertLive(): boolean; release(): boolean }>>;
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
    resources?: unknown,
    key?: string,
  ) => boolean;
  completeRecovery: (record: AuthenticationRecoveryRecord) => boolean;
  recordResource: (
    record: AuthenticationRecoveryRecord,
    event: unknown,
  ) => boolean;
  readResources: (
    record: AuthenticationRecoveryRecord,
  ) => Readonly<{ resources: OperationResources | null }> | null;
}>;

/** 同じHome Lock下で自作した管理Directoryの短命実体。保存・権限ではない。 */
type AuthenticationManagementDirectory = Readonly<{
  directory: string;
  identity: string;
}>;

/**
 * 既存Recovery親領域の固定子だけをexclusive作成する。
 * @responsibility 記録受付前の書込みと由来不明の既存領域の採用を避ける。
 * @trace ARCH-000010
 * @input record: 同じHomeと完全Hashから構築した元記録。
 * @returns 自作した元実体。既存・Link・観測不能はnull。
 * @effect 上位管理領域の固定子Directoryを一つ作成する。
 * @invariant Provider Home・任意Path・recursive作成・既存削除を使わない。
 */
function createAuthenticationManagementDirectory(
  record: AuthenticationRecoveryRecord,
): AuthenticationManagementDirectory | null {
  try {
    const parent = path.win32.dirname(record.recordPath);
    const directory = record.recordPath.replace(/\.json$/u, ".management");
    if (directory === record.recordPath || fs.realpathSync(parent) !== parent)
      return null;
    const parentMetadata = fs.lstatSync(parent, { bigint: true });
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink())
      return null;
    fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
    const metadata = fs.lstatSync(directory, { bigint: true });
    if (
      fs.realpathSync(directory) !== directory ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.dev <= 0n ||
      metadata.ino <= 0n ||
      metadata.birthtimeNs <= 0n
    )
      return null;
    return Object.freeze({
      directory,
      identity: `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`,
    });
  } catch {
    return null;
  }
}

/**
 * 自作した同じ空の管理実体だけを非recursiveに終了する。
 * @responsibility DI回収成功と上位Directory終了を別に確認する。
 * @trace ARCH-000010
 * @input owned: 同Processで自作を観測した元Directory。
 * @returns 元実体・空・削除後不存在を確認できた場合だけtrue。
 * @effect 元の空Directory一つのrmdir。
 * @failure 不明・残存・差替えはfalse。別領域を削除しない。
 */
function removeAuthenticationManagementDirectory(
  owned: AuthenticationManagementDirectory,
): boolean {
  try {
    if (fs.realpathSync(owned.directory) !== owned.directory) return false;
    const metadata = fs.lstatSync(owned.directory, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}` !==
        owned.identity ||
      fs.readdirSync(owned.directory).length !== 0
    )
      return false;
    fs.rmdirSync(owned.directory);
    try {
      fs.lstatSync(owned.directory);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT";
    }
  } catch {
    return false;
  }
}

const authenticationPreparations = new WeakMap<
  object,
  Readonly<{
    executor: Executor<"authentication">;
    request: ExecutorRequest<"authentication">;
    managementDirectory: string;
  }>
>();

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
  contractRevision: 3;
  provider: "codex" | "claude";
  action: "status" | "login";
  recoveryId: string;
  stableLogicalHomeBindingHash: string;
  suffix: string;
  resources: OperationResources | null;
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
  plan: RecordProjection<"authentication">,
): AuthenticationRecoveryRecord | null {
  if (
    !authenticationPreparations.has(plan) ||
    !/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash) ||
    path.win32.basename(providerHomeSourcePath).toLowerCase() !==
      plan.provider ||
    path.win32.basename(path.win32.dirname(providerHomeSourcePath)) !==
      "ProviderHomes"
  )
    return null;
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  if (plan.ownershipLabel !== `crdd.coordinator.authentication=${suffix}`)
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
    contractRevision: 3,
    provider: plan.provider,
    action: plan.action,
    recoveryId: `provider-auth.${plan.provider}.${plan.action}.${stableLogicalHomeBindingHash}`,
    stableLogicalHomeBindingHash,
    suffix: plan.ownershipLabel.slice(plan.ownershipLabel.indexOf("=") + 1),
    ownershipLabel: plan.ownershipLabel,
    state: "active",
    commandState: "idle",
    commandPurpose: null,
    resources: null,
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
    "action,commandPurpose,commandState,contract,contractRevision,ownershipLabel,provider,recoveryId,resources,stableLogicalHomeBindingHash,state,suffix"
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
    validateResourceBook(record.resources) &&
    (record.resources === null ||
      record.resources.snapshot.resources.every(
        (resource) =>
          resource.identity.ownershipLabel === expected.ownershipLabel,
      ))
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
    const recoveryDirectory = path.win32.dirname(record.recordPath);
    try {
      const metadata = fs.lstatSync(recoveryDirectory);
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        return "unknown";
      const allowed = new Set([
        path.win32.basename(record.recordPath),
        path.win32.basename(temporary),
      ]);
      if (
        fs
          .readdirSync(recoveryDirectory)
          .some(
            (name) =>
              name.toLowerCase().startsWith(`${record.provider}.`) &&
              !allowed.has(name.toLowerCase()),
          )
      )
        return "unknown";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return "unknown";
    }
    const previous = fs.existsSync(record.recordPath)
      ? fs.readFileSync(record.recordPath, "utf8")
      : null;
    if (previous !== null) {
      const existing = JSON.parse(previous) as Record<string, unknown>;
      const action = existing.action;
      if (action !== "status" && action !== "login") return "unknown";
      const expected: AuthenticationRecoveryRecord = {
        ...record,
        action,
        recoveryId: `provider-auth.${record.provider}.${action}.${record.stableLogicalHomeBindingHash}`,
        resources: null,
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
  resourcesValue?: unknown,
  key?: string,
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
    let resources = current.resources as OperationResources | null;
    if (state === "in_flight" && purpose?.startsWith("create_")) {
      const material = snapshotJsonValue(resourcesValue) as Record<
        string,
        unknown
      >;
      resources = applyResourceEvent(resources, {
        ...material,
        event: "submission",
        key,
      });
      if (!resources) return false;
    }
    fs.writeFileSync(
      record.recordPath,
      `${JSON.stringify({
        ...current,
        recordPath: undefined,
        state: "active",
        commandState: state,
        commandPurpose: purpose,
        resources,
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
      updated.commandPurpose === purpose &&
      isDeepStrictEqual(
        snapshotJsonValue(updated.resources),
        snapshotJsonValue(resources),
      )
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
  eventValue: unknown,
) {
  try {
    const raw = fs.readFileSync(record.recordPath, "utf8");
    const current = JSON.parse(raw) as AuthenticationRecoveryRecord;
    const event = snapshotJsonValue(eventValue) as Record<string, unknown>;
    if (!sameRecoveryRecord(current, record) || current.state !== "active")
      return false;
    let resources: OperationResources | null;
    if (event.event === "cleanup") {
      if (!current.resources) return false;
      resources = applyResourceCleanup(
        current.resources,
        event.snapshot,
        event.observations,
        {
          recoveryId: current.recoveryId,
          previousPayloadSha256: createHash("sha256").update(raw).digest("hex"),
        },
      );
    } else {
      if (
        current.commandState !== "in_flight" ||
        current.commandPurpose !==
          (event.event === "identified" ? "remove_" : "create_") + event.key
      )
        return false;
      resources = applyResourceEvent(current.resources, event);
    }
    if (!resources) return false;
    const next = {
      ...current,
      recordPath: undefined,
      resources,
      ...(event.event === "not_issued"
        ? { commandState: "idle", commandPurpose: null }
        : {}),
    };
    fs.writeFileSync(record.recordPath, JSON.stringify(next) + "\n", {
      encoding: "utf8",
      flush: true,
    });
    const updated = JSON.parse(fs.readFileSync(record.recordPath, "utf8"));
    return (
      sameRecoveryRecord(updated, record) &&
      JSON.stringify(updated) === JSON.stringify(next)
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
    if (
      !sameRecoveryRecord(current, record) ||
      current.state !== "active" ||
      current.commandState !== "idle" ||
      current.commandPurpose !== null
    )
      return null;
    return { resources: current.resources };
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
 * 認証の上位保存とHome排他を構成する。
 * @responsibility Docker構成・実行・回収をExecutorへ委譲する。
 * @trace ARCH-000010
 * @input N/A: 既存の固定保存APIへ接続する。
 * @returns 認証受付と保存の依存。
 * @precondition Home選定と操作許可は呼出し元が確定する。
 * @postcondition 構成だけではDocker操作しない。
 * @effect N/A: 関数を結合するだけ。
 * @failure 実際の保存失敗は登録通知で例外へ変換する。
 * @invariant 新Store・Lock・認証Stateを作らない。
 * @boundary 上位記録Ownerと単一認証生涯。
 * @security 生のCLI出力やProxy tokenを通知しない。
 * @concurrency 既存Home排他を維持する。
 */
export function createProviderAuthenticationDependencies(): Dependencies {
  return Object.freeze({
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    createAuthentication: createExecutor,
    createManagementDirectory: createAuthenticationManagementDirectory,
    removeManagementDirectory: removeAuthenticationManagementDirectory,
    cleanupAuthentication: (target, callbacks) =>
      cleanupResources(target, getIsolationSettings(), callbacks),
    acquireProviderHomeLock: acquireProviderHomeLock,
    beginRecovery: beginProviderAuthenticationRecovery,
    setRecoveryCommandState: setProviderAuthenticationRecoveryCommandState,
    completeRecovery: settleProviderAuthenticationRecovery,
    readResources: readProviderAuthenticationResources,
    recordResource: recordProviderAuthenticationResource,
  });
}

/**
 * 選定済み認証の資源投影を同じ上位記録へ結合する。
 * @responsibility 技術計画を構築せず元の認証操作と投影の相関だけを保持する。
 * @trace ARCH-000010
 * @input provider・action・Home・suffix・proxyToken: 固定技術入力、prepare: 有限試験又は既存Executor。
 * @returns 元認証操作の資源投影、又は準備拒否null。
 * @precondition Provider Homeが既存Ownerで選定済み。
 * @postcondition 任意Docker引数を上位で構築しない。
 * @effect 同Processの既存準備Mapへの結合のみ。
 * @failure Executorの準備拒否はnull。
 * @invariant コピー投影を新しいRecovery記録の準備へ昇格しない。
 * @boundary 上位記録構築とExecutor。
 * @security RecordへCommandやProxy tokenを入れない。
 * @concurrency 同じ認証操作の短命結合だけを保持する。
 */
export function prepareProviderAuthentication(
  provider: Provider,
  action: "status" | "login",
  providerHomeSourcePath: string,
  suffix: string,
  proxyToken: string | null,
  prepare: Dependencies["createAuthentication"] = createExecutor,
  managementDirectory: string,
): RecordProjection<"authentication"> | null {
  const request: ExecutorRequest<"authentication"> = {
    kind: "authentication",
    provider,
    action,
    providerHomeSourcePath,
    suffix,
    proxyToken,
  };
  const authentication = prepare(request, {
    managementDirectory,
    settings: getIsolationSettings(),
  });
  if (!authentication) return null;
  const projection = authentication.recordProjection;
  authenticationPreparations.set(projection, {
    executor: authentication,
    request,
    managementDirectory,
  });
  return projection;
}

/**
 * 各認証技術操作の前後で上位保存を完了する通知を登録する。
 * @responsibility 保存拒否を例外へ変換し次Effectを止める。
 * @trace ARCH-000010
 * @input recovery: 元記録、dependencies: 専用Writer、current: 上位が保持したHome Lockの現在性。
 * @returns 同期void通知だけを持つinterface。
 * @precondition 上位がHome Lockを保持し、通知内で必要保存の現在性を確認する。
 * @postcondition Record保存結果を通知の戻り値にしない。
 * @effect 各通知で既存Intent・Receipt・idleを保存する。
 * @failure 保存拒否は例外で下位へ返す。
 * @invariant Receipt保存失敗後にidleへ進まない。
 * @boundary Executor通知と上位耐久保存。
 * @security 通知に生出力・認証値を受け取らない。
 * @concurrency 通知は保存・読戻し完了後だけreturnする。
 */
function authenticationCallbacks(
  recovery: AuthenticationRecoveryRecord,
  dependencies: Dependencies,
  current: () => boolean,
): ExecutorCallbacks<"authentication"> {
  return {
    onCommandSubmitting: (purpose, resources, key) => {
      if (!current())
        throw Error("provider_authentication_provider_home_lock_lost");
      if (
        !dependencies.setRecoveryCommandState(
          recovery,
          "in_flight",
          purpose,
          resources,
          key,
        )
      )
        throw Error("provider_authentication_command_intent_unconfirmed");
    },
    onResourceIdentified: (key, resources) => {
      if (
        !current() ||
        !dependencies.recordResource(recovery, {
          ...resources,
          event: "identified",
          key,
        })
      )
        throw Error("provider_authentication_resource_receipt_unconfirmed");
    },
    onResourceCreated: (receipt, resources) => {
      if (!current())
        throw Error("provider_authentication_provider_home_lock_lost");
      if (
        !dependencies.recordResource(recovery, {
          ...resources,
          event: "receipt",
          key: receipt.key,
        })
      )
        throw Error("provider_authentication_resource_receipt_unconfirmed");
    },
    onCommandNotIssued: (_purpose, _resources, key) => {
      if (
        !current() ||
        !dependencies.recordResource(recovery, { event: "not_issued", key })
      )
        throw Error("provider_authentication_command_settlement_unconfirmed");
    },
    onCommandCompleted: () => {
      if (!current())
        throw Error("provider_authentication_provider_home_lock_lost");
      if (!dependencies.setRecoveryCommandState(recovery, "idle", null))
        throw Error("provider_authentication_command_settlement_unconfirmed");
    },
  };
}

/**
 * 元認証操作の技術回収へ保存通知を接続する。
 * @responsibility 実体確認や削除を組み立てず、上位で読んだ確定Receipt値を渡す。
 * @trace ARCH-000010
 * @input plan: 元投影、dependencies: 上位保存、authorityLive: 現在Home、recovery: 元記録。
 * @returns 技術回収とProcess終了の個別結果。
 * @precondition 同じ認証操作が準備Mapへ登録済み。
 * @postcondition Homeの解放・settled確定は呼出し元に残す。
 * @effect 下位回収通知で各操作のIntentと終了を保存する。
 * @failure 元結合欠測・終了不明は回収未確認。
 * @invariant 保存成功と技術回収成功を混同しない。
 * @boundary 上位記録とExecutor資源回収。
 * @security 任意Pathや削除命令を渡さない。
 * @concurrency 上位Lockを保持し、必要保存通知内で現在性を確認する。
 */
async function cleanAuthenticationResources(
  plan: RecordProjection<"authentication">,
  dependencies: Dependencies,
  authorityLive: () => boolean,
  recovery: AuthenticationRecoveryRecord,
) {
  if (!authorityLive())
    return { confirmed: false, processCompletionConfirmed: false };
  const authentication = authenticationPreparations.get(plan);
  const observed = dependencies.readResources(recovery);
  if (!authentication || !observed)
    return { confirmed: false, processCompletionConfirmed: false };
  const book = observed.resources;
  // 成功したexact idle読取りだけが、初回Intent前の未要求窓を示す。
  if (book === null)
    return { confirmed: true, processCompletionConfirmed: true };
  let material: Readonly<{
    snapshot: OperationResources["snapshot"];
    cleanup: OperationResources["cleanup"];
  }> = {
    snapshot: {
      resources: book.snapshot.resources.map((resource) => ({
        ...resource,
        request:
          book.checkpoints.find((item) => item.key === resource.key)
            ?.submission !== "intent_saved"
            ? ("not_issued" as const)
            : resource.identity.dockerId === null
              ? ("unknown" as const)
              : ("issued" as const),
      })),
    },
    cleanup: book.cleanup,
  };
  const execution = dependencies.cleanupAuthentication(
    {
      ...book.cleanup,
      resources: material.snapshot,
      managementDirectory: authentication.managementDirectory,
      previouslyAbsent: book.checkpoints
        .filter((item) => item.observation === "absent")
        .map((item) => item.key),
    },
    {
      onCleanupSubmitting: (key) => {
        if (
          !authorityLive() ||
          !dependencies.setRecoveryCommandState(
            recovery,
            "in_flight",
            "remove_" + key,
            material,
            key,
          )
        )
          throw Error("provider_authentication_command_intent_unconfirmed");
      },
      onResourceIdentified: (key, snapshot) => {
        material = { ...material, snapshot };
        if (
          !authorityLive() ||
          !dependencies.recordResource(recovery, {
            ...material,
            event: "identified",
            key,
          })
        )
          throw Error("provider_authentication_resource_receipt_unconfirmed");
      },
      onCleanupCompleted: () => {
        if (
          !authorityLive() ||
          !dependencies.setRecoveryCommandState(recovery, "idle", null)
        )
          throw Error("provider_authentication_command_settlement_unconfirmed");
      },
      onResourcesClosed: (snapshot, observations) => {
        if (
          !authorityLive() ||
          !dependencies.recordResource(recovery, {
            event: "cleanup",
            snapshot,
            observations,
          })
        )
          throw Error("provider_authentication_resource_receipt_unconfirmed");
      },
    },
  );
  const result = await execution.completion;
  return {
    confirmed:
      result.cleanup.confirmed &&
      result.notificationDeliveryConfirmed !== false,
    processCompletionConfirmed: result.processTerminationConfirmed,
  };
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
  const acquisition = activeDependencies.acquireProviderHomeLock(
    stableLogicalHomeBindingHash,
    path.dirname(providerHomeSourcePath),
  );
  if (acquisition.status !== "acquired") {
    if (!acquisition.descriptorClosed)
      poisonRuntimeProcessAfterCleanupUnknown();
    const retained =
      acquisition.reference !== null || !acquisition.cleanupConfirmed;
    return Object.freeze({
      status: "blocked",
      reason: !acquisition.descriptorClosed
        ? "provider_authentication_home_lock_descriptor_close_unconfirmed"
        : acquisition.reason === "lock_initialization_failed"
          ? "provider_authentication_home_lock_initialization_failed"
          : "provider_authentication_provider_home_active_or_unknown",
      cleanupConfirmed: acquisition.cleanupConfirmed,
      manualRecoveryRequired: retained,
      processRestartRequired: !acquisition.descriptorClosed,
      providerEffectIssued: false,
    });
  }
  const providerHomeLock = acquisition.lock;
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  let plan: RecordProjection<"authentication"> | null = null;
  let recovery: AuthenticationRecoveryRecord | null = null;
  try {
    const proxyToken =
      action === "login" ? activeDependencies.randomHex(32) : null;
    plan = prepareProviderAuthentication(
      provider,
      action,
      providerHomeSourcePath,
      suffix,
      proxyToken,
      activeDependencies.createAuthentication,
      path.win32.join(
        path.win32.dirname(path.win32.dirname(providerHomeSourcePath)),
        "Recovery",
        "provider-authentication",
        `${provider}.${stableLogicalHomeBindingHash}.management`,
      ),
    );
    recovery = plan
      ? createProviderAuthenticationRecoveryRecord(
          providerHomeSourcePath,
          stableLogicalHomeBindingHash,
          plan,
        )
      : null;
    if (!plan || !recovery) throw Error("provider_authentication_plan_invalid");
  } catch (error) {
    let lockReleased = false;
    try {
      lockReleased = providerHomeLock.release();
    } catch {
      /* 解放不明を成功へ変換しない。 */
    }
    return Object.freeze({
      status: "blocked",
      reason:
        error instanceof Error &&
        error.message === "provider_authentication_docker_boundary_unavailable"
          ? error.message
          : "provider_authentication_plan_invalid",
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
  const management = providerHomeLock.assertLive()
    ? activeDependencies.createManagementDirectory(recovery)
    : null;
  if (!management) {
    providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "provider_authentication_management_directory_unconfirmed",
      cleanupConfirmed: false,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: false,
    });
  }
  const closeManagement = () => {
    try {
      return (
        providerHomeLock.assertLive() &&
        activeDependencies.removeManagementDirectory(management)
      );
    } catch {
      return false;
    }
  };
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
      if (recoveryCleanupConfirmed.processCompletionConfirmed) {
        closeManagement();
        providerHomeLock.release();
      }
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
      closeManagement();
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
  const authentication = authenticationPreparations.get(plan);
  let reason = "provider_authentication_failed_closed";
  let authenticationStatus: "confirmed" | "unconfirmed" | "unknown" = "unknown";
  let authenticationConfirmed = false,
    providerEffectIssued = false;
  let processCompletionUnknown = authentication === undefined;
  let cleanup = { confirmed: false, processCompletionConfirmed: false };
  if (authentication) {
    try {
      const started = authentication.executor.start({
        ...(signal ? { signal } : {}),
        callbacks: authenticationCallbacks(
          recovery,
          activeDependencies,
          providerHomeLock.assertLive,
        ),
      });
      if (started.status !== "started") {
        // 開始拒否はDI Effectより前であり、取得済み管理領域の終了を妨げない。
        reason = started.reason;
        processCompletionUnknown = false;
        cleanup = { confirmed: true, processCompletionConfirmed: true };
      } else {
        const result = await started.completion;
        const resourcesSaved =
          result.resourceSnapshot === null ||
          (providerHomeLock.assertLive() &&
            activeDependencies.recordResource(recovery, {
              event: "cleanup",
              snapshot: result.resourceSnapshot,
              observations: result.resourceObservations,
            }));
        cleanup = {
          confirmed: result.cleanupConfirmed && resourcesSaved,
          processCompletionConfirmed: result.processCompletionConfirmed,
        };
        reason = result.reason;
        authenticationStatus = result.authenticationStatus;
        authenticationConfirmed = result.authenticationConfirmed;
        providerEffectIssued = result.providerEffectIssued;
        processCompletionUnknown = !result.processCompletionConfirmed;
      }
    } catch {
      processCompletionUnknown = true;
      reason = "provider_authentication_process_completion_unconfirmed";
    }
  }
  processCompletionUnknown ||= !cleanup.processCompletionConfirmed;
  let cleanupConfirmed = cleanup.confirmed;
  if (cleanupConfirmed && !processCompletionUnknown) {
    cleanupConfirmed = closeManagement();
    if (!cleanupConfirmed && reason === "provider_authentication_completed")
      reason = "provider_authentication_management_cleanup_unconfirmed";
  }
  const isLockLiveAfterCleanup = providerHomeLock.assertLive();
  if (!isLockLiveAfterCleanup)
    reason = "provider_authentication_provider_home_lock_lost";
  if (cleanupConfirmed && isLockLiveAfterCleanup)
    cleanupConfirmed = activeDependencies.completeRecovery(recovery);
  else cleanupConfirmed = false;
  const lockReleased = !processCompletionUnknown && providerHomeLock.release();
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
    offering: getAuthenticationDefinition(provider).offering,
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
 * 認証対象だけを指定する公開要求。
 * @responsibility Provider固有引数と秘密Pathを利用側へ要求しない。
 * @trace ARCH-000004
 * @shape 対応Provider一項目。
 * @invariant Repository・追加通信先・CLI引数を含めない。
 * @boundary 公開認証操作。
 * @security 認証値を搬送しない。
 * @compatibility 新形式だけを受理する。
 */
export type AuthenticationRequest = Readonly<{
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
  request: AuthenticationRequest,
  signal?: AbortSignal,
) {
  const descriptors =
    request &&
    typeof request === "object" &&
    !types.isProxy(request) &&
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
      cleanupConfirmed:
        observed.processEffectIssued === false &&
        observed.manualRecoveryRequired === false,
      manualRecoveryRequired: observed.manualRecoveryRequired,
      providerEffectIssued: false,
    });
  const home = observed.providerHome;
  return authenticateProvider(
    provider,
    action,
    home.providerHomeSourcePath,
    home.stableLogicalHomeBindingHash,
    undefined,
    signal,
  );
}
