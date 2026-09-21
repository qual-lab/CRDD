/**
 * platform-provisioner-package-gateに属する責務をまとめる。
 *
 * @responsibility responseを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { verifyPlatformProvisionerManifestCandidate } from "./platform-provisioner-trust-core.ts";

const INPUT_KEYS = new Set([
  "manifestVerificationInput",
  "crddDistributionObservation",
  "expectedCrddVersion",
  "expectedCrddCommit",
  "expectedCrddTree",
  "runtimeTrustDecision",
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
const TRUST_DECISION_KEYS = new Set([
  "contract",
  "contractRevision",
  "artifactIdentity",
  "observedAt",
  "policyRevision",
  "axes",
  "trust",
  "reason",
  "effectAuthorizationIssued",
  "runtimeAuthorityConferred",
  "runtimeCapabilityIssued",
]);

/**
 * Package GateがRuntime Trust判断を消費できるか評価する。
 *
 * @responsibility Trust Evaluatorの非Authority判断を同じArtifact Identityへ結合し、Policy不一致や拒否をEffect前に遮断する。
 * @trace ARCH-000014
 * @input rawDecision: unknown、artifactIdentity: string
 * @returns accepted、reason、policyRevisionを持つ非Authorityの消費結果を返す。
 * @precondition artifactIdentityはGateが検証したRuntime Execution Identityである。
 * @postcondition trustedかつ同一Artifactに結合された現行Policy判断だけをacceptedにする。
 * @effect N/A: 判断の検証だけを行い、Runtime Authority、Capabilityまたは外部Effectを発行しない。
 * @failure 不正Schema、Identity不一致、unknown、not_trustedまたはAuthority混入を拒否する。
 * @invariant 公式署名、Publisher名または呼出し側booleanだけではacceptedを返さない。
 * @boundary Direct Boundary: Artifact観測→Deployment Policy→Authority Gate。
 * @security Trust判断はArtifact IdentityとPolicy revisionへ結合し、呼出し側の固定許可で置き換えない。
 * @concurrency N/A: 入力snapshotだけを同期評価し、共有状態を持たない。
 */
export function consumeRuntimeTrustDecisionForPackageGate(
  rawDecision: unknown,
  artifactIdentity: string,
) {
  const trustDecision = snapshotPlainRecord(rawDecision, TRUST_DECISION_KEYS);
  const isAccepted =
    trustDecision?.contract === "crdd-coordinator/runtime-trust-decision" &&
    trustDecision.contractRevision === 1 &&
    trustDecision.artifactIdentity === artifactIdentity &&
    typeof trustDecision.policyRevision === "string" &&
    trustDecision.policyRevision.length > 0 &&
    trustDecision.trust === "trusted" &&
    trustDecision.effectAuthorizationIssued === false &&
    trustDecision.runtimeAuthorityConferred === false &&
    trustDecision.runtimeCapabilityIssued === false;
  return Object.freeze({
    accepted: isAccepted,
    reason: isAccepted
      ? "runtime_trust_decision_accepted"
      : "runtime_trust_decision_rejected",
    policyRevision:
      isAccepted && typeof trustDecision?.policyRevision === "string"
        ? trustDecision.policyRevision
        : null,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * responseを決定する。
 *
 * @responsibility responseの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Observationを固定Schemaへ正規化する。
 *
 * @responsibility Observationの入力検証、正規化規則、不正値の拒否境界を所有する。
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
 * Platform Provisioner Package Gate 候補を評価する。
 *
 * @responsibility Platform Provisioner Package Gate 候補の評価入力、判定規則、判断不能結果の境界を所有する。
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
    const trustConsumption = consumeRuntimeTrustDecisionForPackageGate(
      input.runtimeTrustDecision,
      String(observation.runtimeExecutionIdentitySha256),
    );
    if (!trustConsumption.accepted) {
      return response(
        "blocked",
        "platform_provisioner_runtime_trust_not_satisfied",
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
        runtimeTrustPolicyMatch: true,
        trustPolicyRevision: trustConsumption.policyRevision,
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
 * Platform Provisioner Package Gate 契約の公開契約を記述する。
 *
 * @responsibility Platform Provisioner Package Gate 契約の公開field、非公開境界、互換性を所有する。
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
    contractRevision: 2,
    distributionModel: "crdd_bundled_private_typescript_package",
    observationContract: "implemented_candidate_non_authoritative",
    manifestVerificationReuse: "implemented_candidate",
    packageIdentityBinding: "implemented_candidate",
    packageContentRootBinding: "implemented_candidate",
    runtimeExecutionIdentityBinding: "implemented_candidate",
    runtimeOwnedCrddDistributionAdapter: "not_implemented",
    runtimeOwnedPackageFilesystemAdapter: "not_implemented",
    runtimeOwnedReleaseIdentitySelection: "not_implemented",
    runtimeTrustDecisionConsumption:
      "implemented_non_authoritative_policy_bound_candidate",
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
