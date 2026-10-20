/**
 * 保護Rootの技術観測をRuntime Stateの上位Capabilityへ結合する。
 *
 * @responsibility Root用途の選択、開発観測の借用、Capability発行・消費を所有する。Native搬送とArtifact確認はPlatform Accessへ委譲する。
 * @trace ARCH-000015
 */
import path from "node:path";
import {
  observeWindowsRuntimeState,
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
} from "../../../platform-access/src/index.ts";
import { isSupportedWindowsAbsolutePathCandidate } from "../authority/root-path-lexical.ts";
import { borrowRuntimeOwnedDevelopmentNativeObservation } from "../task/development-measurement-session.ts";

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
function blocked(
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
    return blocked("runtime_state_windows_adapter_platform_unsupported");
  const rootPath = rootPathCandidate();
  if (!rootPath) return blocked("runtime_state_windows_adapter_root_invalid");
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
    return blocked(
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
