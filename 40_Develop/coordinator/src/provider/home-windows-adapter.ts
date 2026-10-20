/**
 * Provider Homeの技術観測を鮮度付きの上位Capabilityへ結合する。
 *
 * @responsibility Provider・Home選択、開発観測の借用、Capability発行・消費・失効を所有する。Native搬送とArtifact確認はPlatform Accessへ委譲する。
 * @trace ARCH-000010
 */
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  observeWindowsProviderHome,
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  describeProviderHomeObservationContract,
  type ProviderHomeObservationProvider,
} from "../../../platform-access/src/index.ts";
import { isSupportedWindowsAbsolutePathCandidate } from "../authority/root-path-lexical.ts";
import { borrowRuntimeOwnedDevelopmentNativeObservation } from "../task/development-measurement-session.ts";

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
function blocked(
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
    return blocked("provider_home_windows_adapter_platform_unsupported");
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
    return blocked(`provider_home_windows_adapter_${native.reason}`, {
      processEffectIssued: native.processEffectIssued,
      helperSpawned: native.processEffectIssued,
      helperExitConfirmed: native.helperExitConfirmed,
    });
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
