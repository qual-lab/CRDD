import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { verifyPlatformProvisionerManifestCandidate } from "./platform-provisioner-trust-core.ts";

const INPUT_KEYS = new Set([
  "manifestVerificationInput",
  "crddDistributionObservation",
  "expectedCrddVersion",
  "expectedCrddCommit",
  "expectedCrddTree",
]);
const OBSERVATION_KEYS = new Set([
  "packageName",
  "packageVersion",
  "packageContentRootSha256",
  "runtimeExecutionIdentitySha256",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "distributionVerdict",
  "bundledPackageIdentityStable",
  "permissionPolicyMatch",
]);
const MANIFEST_INPUT_KEYS = new Set([
  "manifestEnvelope",
  "releaseSignerSpkiDer",
  "observedPackageContent",
  "evaluationTime",
]);
const HEX64 = /^[0-9a-f]{64}$/u;

/**
 * responseの処理を実行する。
 *
 * @responsibility responseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input status: S、reason: string、fields: T
 * @returns responseの計算結果を返す。
 * @precondition 「status: S、reason: string、fields: T」がresponseの入力契約を満たす。
 * @postcondition responseの責務を完了した結果だけを返す。
 * @effect N/A: responseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: responseは独自の失敗分岐を所有しない。
 * @invariant responseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: responseはProcess内の同一Subsystemで完結する。
 * @security responseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: responseは共有非同期状態を持たない同期処理である。
 */
function response<
  S extends "candidate" | "blocked",
  T extends Record<string, unknown>,
>(status: S, reason: string, fields: T) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    crddDistributionObservationRuntimeOwned: false,
    releaseIdentityRuntimeOwned: false,
    packageFilesystemRuntimeOwned: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

/**
 * normalizeObservationの処理を実行する。
 *
 * @responsibility normalizeObservationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input raw: unknown
 * @returns normalizeObservationの計算結果を返す。
 * @precondition 「raw: unknown」がnormalizeObservationの入力契約を満たす。
 * @postcondition normalizeObservationの責務を完了した結果だけを返す。
 * @effect N/A: normalizeObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeObservationは独自の失敗分岐を所有しない。
 * @invariant normalizeObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeObservationはProcess内の同一Subsystemで完結する。
 * @security normalizeObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeObservationは共有非同期状態を持たない同期処理である。
 */
function normalizeObservation(raw: unknown) {
  const value = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (
    !value ||
    typeof value.packageName !== "string" ||
    typeof value.packageVersion !== "string" ||
    typeof value.packageContentRootSha256 !== "string" ||
    !HEX64.test(value.packageContentRootSha256) ||
    typeof value.runtimeExecutionIdentitySha256 !== "string" ||
    !HEX64.test(value.runtimeExecutionIdentitySha256) ||
    value.distributionVerdict !== "verified_crdd_bundle" ||
    value.bundledPackageIdentityStable !== true ||
    value.permissionPolicyMatch !== true
  )
    return null;
  return value;
}

/**
 * evaluatePlatformProvisionerPackageGateCandidateの処理を実行する。
 *
 * @responsibility evaluatePlatformProvisionerPackageGateCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns evaluatePlatformProvisionerPackageGateCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がevaluatePlatformProvisionerPackageGateCandidateの入力契約を満たす。
 * @postcondition evaluatePlatformProvisionerPackageGateCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluatePlatformProvisionerPackageGateCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluatePlatformProvisionerPackageGateCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluatePlatformProvisionerPackageGateCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluatePlatformProvisionerPackageGateCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluatePlatformProvisionerPackageGateCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluatePlatformProvisionerPackageGateCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluatePlatformProvisionerPackageGateCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) {
      return response(
        "blocked",
        "platform_provisioner_package_gate_input_invalid",
        {},
      );
    }
    const observation = normalizeObservation(input.crddDistributionObservation);
    const manifestInput = snapshotPlainRecord(
      input.manifestVerificationInput,
      MANIFEST_INPUT_KEYS,
    );
    const manifest = manifestInput
      ? verifyPlatformProvisionerManifestCandidate(manifestInput)
      : response("blocked", "platform_provisioner_manifest_input_invalid", {});
    if (!observation || manifest.status !== "candidate") {
      return response(
        "blocked",
        "platform_provisioner_package_gate_verification_failed",
        {},
      );
    }
    if (
      observation.packageName !== manifest.packageName ||
      observation.packageVersion !== manifest.packageVersion ||
      observation.packageContentRootSha256 !==
        manifest.packageContentRootSha256 ||
      observation.runtimeExecutionIdentitySha256 !==
        manifest.runtimeExecutionIdentitySha256
    ) {
      return response(
        "blocked",
        "platform_provisioner_package_gate_binding_mismatch",
        {},
      );
    }
    return response(
      "candidate",
      "runtime_owned_crdd_distribution_package_filesystem_and_effect_controller_required",
      {
        packageName: manifest.packageName,
        packageVersion: manifest.packageVersion,
        manifestHash: manifest.manifestHash,
        packageTrustObservationMatch: true,
      },
    );
  } catch {
    return response(
      "blocked",
      "platform_provisioner_package_gate_input_invalid",
      {},
    );
  }
}

/**
 * describePlatformProvisionerPackageGateContractの処理を実行する。
 *
 * @responsibility describePlatformProvisionerPackageGateContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformProvisionerPackageGateContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformProvisionerPackageGateContractの入力契約を満たす。
 * @postcondition describePlatformProvisionerPackageGateContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformProvisionerPackageGateContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformProvisionerPackageGateContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformProvisionerPackageGateContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describePlatformProvisionerPackageGateContractはProcess内の同一Subsystemで完結する。
 * @security describePlatformProvisionerPackageGateContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformProvisionerPackageGateContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformProvisionerPackageGateContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-gate",
    contractRevision: 1,
    distributionModel: "crdd_bundled_private_typescript_package",
    observationContract: "implemented_candidate_non_authoritative",
    manifestVerificationReuse: "implemented_candidate",
    packageIdentityBinding: "implemented_candidate",
    packageContentRootBinding: "implemented_candidate",
    runtimeExecutionIdentityBinding: "implemented_candidate",
    runtimeOwnedCrddDistributionAdapter: "not_implemented",
    runtimeOwnedPackageFilesystemAdapter: "not_implemented",
    runtimeOwnedReleaseIdentitySelection: "not_implemented",
    effectController: "not_implemented_effective_access_required",
    callerObservationMayAuthorizeEffect: false,
    standalonePackageMayAuthorizeEffect: false,
    unverifiedSourceCheckoutMayAuthorizeEffect: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}
