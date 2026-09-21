/**
 * candidate-store-windows-adapterに属する責務をまとめる。
 *
 * @responsibility Artifactを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWindowsNativeHelperEnvironment,
  WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
} from "../core/windows-child-environment.ts";
import { isSupportedWindowsAbsolutePathCandidate } from "./authority-root-path-lexical.ts";
import { borrowRuntimeOwnedDevelopmentNativeObservation } from "./development-measurement-session.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";
import {
  createCandidateStoreObservationRequest,
  createRuntimeStateObservationRequest,
  evaluateCandidateStoreObservationResponseCandidate,
  evaluateRuntimeStateObservationResponseCandidate,
  PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
} from "./provider-home-observation.ts";

const HELPER_TIMEOUT_MS = 5_000;
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const executablePath = path.join(
  bundledDistributionRoot,
  ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
);
const rootCapabilities = new WeakMap<
  object,
  Readonly<{
    rootPath: string;
    kind: "candidate_store" | "runtime_state";
    identityHash: string;
    protectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
  }>
>();

/**
 * candidate-store-windows-adapterで使用するArtifactの値契約を定義する。
 *
 * @responsibility ArtifactのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape Artifactが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Artifactで宣言した値と責務の対応を維持する。
 * @boundary N/A: Artifactの宣言は外部境界を開かない。
 * @security ArtifactはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Artifactの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Artifact = Readonly<{
  relativePath: string;
  target: string;
  protocolRevision: number;
  rustToolchain: string;
  byteLength: number;
  sha256: string;
}>;

/**
 * Artifactが同一かを判定する。
 *
 * @responsibility Artifactの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000015
 * @input left: unknown、right: unknown
 * @returns sameArtifactの計算結果を返す。
 * @precondition 「left: unknown、right: unknown」がsameArtifactの入力契約を満たす。
 * @postcondition sameArtifactの責務を完了した結果だけを返す。
 * @effect N/A: sameArtifactは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameArtifactは独自の失敗分岐を所有しない。
 * @invariant sameArtifactは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security sameArtifactはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameArtifactは共有非同期状態を持たない同期処理である。
 */
function sameArtifact(left: unknown, right: unknown) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  const first = left as Partial<Artifact>;
  const second = right as Partial<Artifact>;
  return (
    first.relativePath === second.relativePath &&
    first.target === second.target &&
    first.protocolRevision === second.protocolRevision &&
    first.rustToolchain === second.rustToolchain &&
    first.byteLength === second.byteLength &&
    first.sha256 === second.sha256
  );
}

/**
 * candidate-store-windows-adapterを停止結果として構築する。
 *
 * @responsibility candidate-store-windows-adapterの停止理由、未発行Effect、公開結果境界を所有する。
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
    candidateStoreIdentityHash: null,
    candidateStoreProtectionHash: null,
    localUserBindingHash: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    releaseIdentityVerified: false,
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
 * @input kind: "candidate_store" | "runtime_state"
 * @returns rootPathCandidateの計算結果を返す。
 * @precondition 「kind: "candidate_store" | "runtime_state"」がrootPathCandidateの入力契約を満たす。
 * @postcondition rootPathCandidateの責務を完了した結果だけを返す。
 * @effect rootPathCandidateは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: rootPathCandidateは独自の失敗分岐を所有しない。
 * @invariant rootPathCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security rootPathCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rootPathCandidateは共有非同期状態を持たない同期処理である。
 */
function rootPathCandidate(kind: "candidate_store" | "runtime_state") {
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
    kind === "candidate_store" ? "CandidateStore" : "RuntimeState",
  );
  return isSupportedWindowsAbsolutePathCandidate(rootPath) ? rootPath : null;
}

/**
 * Runtime 所有 Windows Protected Rootを観測する。
 *
 * @responsibility Runtime 所有 Windows Protected Rootの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000015
 * @input kind: "candidate_store" | "runtime_state"、initializeIfMissing: unknown、evaluationTime: unknown、developmentContext: unknown
 * @returns inspectRuntimeOwnedWindowsProtectedRootの計算結果を返す。
 * @precondition 「kind: "candidate_store" | "runtime_state"、initializeIfMissing: unknown、evaluationTime: unknown、developmentContext: unknown」がinspectRuntimeOwnedWindowsProtectedRootの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedWindowsProtectedRootの責務を完了した結果だけを返す。
 * @effect inspectRuntimeOwnedWindowsProtectedRootは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: inspectRuntimeOwnedWindowsProtectedRootは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedWindowsProtectedRootは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectRuntimeOwnedWindowsProtectedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedWindowsProtectedRootは共有非同期状態を持たない同期処理である。
 */
function inspectRuntimeOwnedWindowsProtectedRoot(
  kind: "candidate_store" | "runtime_state",
  initializeIfMissing: unknown,
  evaluationTime: unknown,
  developmentContext?: unknown,
) {
  if (process.platform !== "win32")
    return blocked("candidate_store_windows_adapter_platform_unsupported");
  const rootPath = rootPathCandidate(kind);
  const request =
    kind === "candidate_store"
      ? createCandidateStoreObservationRequest(rootPath, initializeIfMissing)
      : createRuntimeStateObservationRequest(rootPath, initializeIfMissing);
  if (!rootPath || !request)
    return blocked("candidate_store_windows_adapter_root_invalid");
  const development =
    developmentContext === undefined
      ? null
      : borrowRuntimeOwnedDevelopmentNativeObservation(
          developmentContext as object,
          initializeIfMissing === true,
        );
  if (developmentContext !== undefined && !development)
    return blocked(
      "candidate_store_windows_adapter_development_context_invalid",
    );
  const distributionRoot =
    development?.distributionRoot ?? bundledDistributionRoot;
  const packageVerification = development
    ? development.verification
    : verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime,
      });
  if (
    packageVerification.status !== "candidate" ||
    (!development &&
      (!("runtimeOwnedReleaseTrustConfirmed" in packageVerification) ||
        packageVerification.runtimeOwnedReleaseTrustConfirmed !== true ||
        !("runtimeExecutionIdentityRuntimeOwned" in packageVerification) ||
        packageVerification.runtimeExecutionIdentityRuntimeOwned !== true ||
        !("crddDistributionConfirmed" in packageVerification) ||
        packageVerification.crddDistributionConfirmed !== true))
  ) {
    return blocked("candidate_store_windows_adapter_release_not_verified");
  }
  const artifactBefore =
    observePlatformAccessReleaseArtifactCandidate(distributionRoot);
  const signingObservation =
    beginPlatformAccessArtifactSigningObservation(distributionRoot);
  if (
    artifactBefore.status !== "candidate" ||
    !signingObservation ||
    !sameArtifact(
      packageVerification.platformAccessArtifact,
      artifactBefore.artifact,
    ) ||
    !sameArtifact(artifactBefore.artifact, signingObservation.artifact)
  ) {
    return blocked("candidate_store_windows_adapter_artifact_not_verified");
  }
  const environment = createWindowsNativeHelperEnvironment();
  if (!environment)
    return blocked("candidate_store_windows_adapter_environment_unavailable");
  const selectedExecutable = development
    ? path.join(
        distributionRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      )
    : executablePath;
  const execution = spawnSync(selectedExecutable, [], {
    input: request.request,
    encoding: "buffer",
    env: environment,
    shell: false,
    windowsHide: true,
    timeout: HELPER_TIMEOUT_MS,
    maxBuffer: PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES + 1,
  });
  const processEffectIssued = execution.pid !== undefined;
  if (
    execution.error ||
    execution.signal !== null ||
    execution.status !== 0 ||
    !Buffer.isBuffer(execution.stdout) ||
    execution.stdout.byteLength !== PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES ||
    !Buffer.isBuffer(execution.stderr) ||
    execution.stderr.byteLength !== 0
  ) {
    return blocked(
      "candidate_store_windows_adapter_helper_failed",
      Object.freeze({
        processEffectIssued,
        filesystemEffectIssued:
          initializeIfMissing === true && processEffectIssued,
      }),
    );
  }
  if (!verifyPlatformAccessArtifactSigningObservation(signingObservation.token))
    return blocked(
      "candidate_store_windows_adapter_artifact_changed",
      Object.freeze({
        processEffectIssued: true,
        helperExitConfirmed: true,
        filesystemEffectIssued: initializeIfMissing === true,
      }),
    );
  const artifactAfter =
    observePlatformAccessReleaseArtifactCandidate(distributionRoot);
  if (
    artifactAfter.status !== "candidate" ||
    !sameArtifact(artifactBefore.artifact, artifactAfter.artifact) ||
    (developmentContext !== undefined &&
      !borrowRuntimeOwnedDevelopmentNativeObservation(
        developmentContext as object,
        initializeIfMissing === true,
      ))
  ) {
    return blocked(
      "candidate_store_windows_adapter_artifact_changed",
      Object.freeze({
        processEffectIssued: true,
        helperExitConfirmed: true,
        filesystemEffectIssued: initializeIfMissing === true,
      }),
    );
  }
  const observation =
    kind === "candidate_store"
      ? evaluateCandidateStoreObservationResponseCandidate(
          execution.stdout,
          request.nonce,
        )
      : evaluateRuntimeStateObservationResponseCandidate(
          execution.stdout,
          request.nonce,
        );
  if (observation.status !== "candidate")
    return blocked(
      "candidate_store_windows_adapter_response_invalid",
      Object.freeze({
        processEffectIssued: true,
        helperExitConfirmed: true,
        filesystemEffectIssued: initializeIfMissing === true,
      }),
    );
  const rootCapability = Object.freeze({});
  const identityHash =
    "candidateStoreIdentityHash" in observation
      ? observation.candidateStoreIdentityHash
      : observation.runtimeStateIdentityHash;
  const protectionHash =
    "candidateStoreProtectionHash" in observation
      ? observation.candidateStoreProtectionHash
      : observation.runtimeStateProtectionHash;
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
    reason: "runtime_owned_windows_candidate_store_observed",
    rootCapability,
    releaseIdentityVerified: development === null,
    nativeReleaseIdentityVerified: true,
    executionSourceKind: development
      ? "fixed_development_candidate"
      : "signed_release",
    artifactVerifiedBeforeAndAfter: true,
    helperSpawnAttempts: 1,
    helperExitConfirmed: true,
    filesystemEffectIssued: initializeIfMissing === true,
    processEffectIssued: true,
    manualRecoveryRequired: false,
  });
}

/**
 * Runtime 所有 Windows 候補 Storeを観測する。
 *
 * @responsibility Runtime 所有 Windows 候補 Storeの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000015
 * @input initializeIfMissing: unknown、evaluationTime: unknown、developmentContext: unknown
 * @returns inspectRuntimeOwnedWindowsCandidateStoreの計算結果を返す。
 * @precondition 「initializeIfMissing: unknown、evaluationTime: unknown、developmentContext: unknown」がinspectRuntimeOwnedWindowsCandidateStoreの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedWindowsCandidateStoreの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedWindowsCandidateStoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedWindowsCandidateStoreは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedWindowsCandidateStoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectRuntimeOwnedWindowsCandidateStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedWindowsCandidateStoreは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedWindowsCandidateStore(
  initializeIfMissing: unknown,
  evaluationTime: unknown,
  developmentContext?: unknown,
) {
  return inspectRuntimeOwnedWindowsProtectedRoot(
    "candidate_store",
    initializeIfMissing,
    evaluationTime,
    developmentContext,
  );
}

/**
 * Runtime 所有 Windows Runtime 状態を観測する。
 *
 * @responsibility Runtime 所有 Windows Runtime 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000015
 * @input initializeIfMissing: unknown、evaluationTime: unknown、developmentContext: unknown
 * @returns inspectRuntimeOwnedWindowsRuntimeStateの計算結果を返す。
 * @precondition 「initializeIfMissing: unknown、evaluationTime: unknown、developmentContext: unknown」がinspectRuntimeOwnedWindowsRuntimeStateの入力契約を満たす。
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
  evaluationTime: unknown,
  developmentContext?: unknown,
) {
  return inspectRuntimeOwnedWindowsProtectedRoot(
    "runtime_state",
    initializeIfMissing,
    evaluationTime,
    developmentContext,
  );
}

/**
 * Runtime 所有 候補 Store Root Capabilityを一回限りで消費する。
 *
 * @responsibility Runtime 所有 候補 Store Root Capabilityの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000015
 * @input capability: unknown
 * @returns consumeRuntimeOwnedCandidateStoreRootCapabilityの計算結果を返す。
 * @precondition 「capability: unknown」がconsumeRuntimeOwnedCandidateStoreRootCapabilityの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedCandidateStoreRootCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedCandidateStoreRootCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeRuntimeOwnedCandidateStoreRootCapabilityは独自の失敗分岐を所有しない。
 * @invariant consumeRuntimeOwnedCandidateStoreRootCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security consumeRuntimeOwnedCandidateStoreRootCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedCandidateStoreRootCapabilityは共有非同期状態を持たない同期処理である。
 */
export function consumeRuntimeOwnedCandidateStoreRootCapability(
  capability: unknown,
) {
  if (!capability || typeof capability !== "object") return null;
  const value = rootCapabilities.get(capability);
  rootCapabilities.delete(capability);
  return value?.kind === "candidate_store"
    ? Object.freeze({
        rootPath: value.rootPath,
        candidateStoreIdentityHash: value.identityHash,
        candidateStoreProtectionHash: value.protectionHash,
        localUserBindingHash: value.localUserBindingHash,
        stableLogicalHomeBindingHash: value.stableLogicalHomeBindingHash,
      })
    : null;
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
 * 候補 Store Windows Adapter 契約の公開契約を記述する。
 *
 * @responsibility 候補 Store Windows Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCandidateStoreWindowsAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCandidateStoreWindowsAdapterContractの入力契約を満たす。
 * @postcondition describeCandidateStoreWindowsAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCandidateStoreWindowsAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCandidateStoreWindowsAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeCandidateStoreWindowsAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeCandidateStoreWindowsAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCandidateStoreWindowsAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeCandidateStoreWindowsAdapterContract() {
  return Object.freeze({
    platform: "windows",
    fixedSegments: Object.freeze(["Qual-Lab", "CRDD", "CandidateStore"]),
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
    releaseVerification:
      "fixed_signed_manifest_release_identity_and_artifact_hash_before_and_after",
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
