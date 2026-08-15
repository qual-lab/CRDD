// @ts-check

import { createHash } from "node:crypto";

import { describeAuthorityRootLocatorContract } from "./authority-root-locator.mjs";
import { describeRuntimeActivationLocatorBindingContract } from
  "./runtime-activation-locator-binding-contract.ts";
import { describeProvisioningSignaturePrimitivesContract } from
  "./provisioning-signature-primitives.mjs";
import { describeProvisioningRecordPureCoreContract } from
  "./provisioning-record-pure-core.mjs";
import { describeInitialEnrollmentPureCoreContract } from
  "./initial-enrollment-pure-core.mjs";
import { describeInitialEnrollmentRuntimeStateContract } from
  "./initial-enrollment-runtime-state.mjs";
import { describePlatformKeyStoragePolicyContract } from
  "./platform-key-storage-policy.ts";
import { describeProvisioningCaPureCoreContract } from "./provisioning-ca-pure-core.mjs";
import { describeOfflineEnrollmentBundlePureCoreContract } from
  "./offline-enrollment-bundle-pure-core.mjs";
import { describeProvisioningRecordEnrollmentBindingContract } from
  "./provisioning-record-enrollment-binding.mjs";
import { describeEnrollmentCertificateRenewalContract } from
  "./enrollment-certificate-renewal.mjs";
import { describePlatformProvisionerTrustCoreContract } from
  "./platform-provisioner-trust-core.mjs";
import { describePlatformProvisionerPackageGateContract } from
  "./platform-provisioner-package-gate.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { describeRootProtectionPolicyContract } from "./root-protection-policy.mjs";
import {
  RUNTIME_ACTIVATION_ID_MAX_LENGTH,
  isRuntimeActivationIdCandidate
} from "./runtime-activation-identity.ts";

export const RUNTIME_ACTIVATION_CONTRACT = "crdd-coordinator/runtime-activation-record";
export const RUNTIME_ACTIVATION_CONTRACT_REVISION = 1;
export const RUNTIME_ACTIVATION_FILE = "activation.json";
export const RUNTIME_ACTIVATION_INPUT_LIMITS = Object.freeze({
  rawBytes: 8_192,
  identifierLength: RUNTIME_ACTIVATION_ID_MAX_LENGTH,
  canonicalUtcLength: 24
});

const HASH = /^[a-f0-9]{64}$/u;
const BUNDLE_ID = /^AUTHBUNDLE-[0-9]{6,}$/u;
const POLICY_ID = /^AUTHPOL-[0-9]{6,}$/u;
const REGISTRY_ID = /^AUTHREG-[0-9]{6,}$/u;
const RECORD_KEYS = new Set([
  "contract",
  "contractRevision",
  "activationId",
  "activationRevision",
  "status",
  "previousActivationHash",
  "repositoryIdentityHash",
  "runtimeRootIdentityHash",
  "bundleId",
  "bundleRevision",
  "authorityBundleHash",
  "policyId",
  "policyRevision",
  "trustPolicyHash",
  "registryId",
  "registryRevision",
  "registryHash",
  "activatedAt",
  "disabledAt"
]);
const TYPED_ARRAY_BYTE_LENGTH = /** @type {() => number} */ (Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
)?.get);
const ONBOARDING_PROVISIONING_TARGET_KINDS = Object.freeze([
  "shared_authority_root_platform_scope",
  "repository_scoped_runtime_root_activation_precondition"
]);
const ONBOARDING_RUNTIME_PRINCIPAL_MODES = Object.freeze([
  "local_interactive_selected_user",
  "server_dedicated_service_account"
]);
const ONBOARDING_CURRENT_RUN_EVIDENCE_REQUIREMENTS = Object.freeze([
  "verified_current_provisioning_record_and_platform_provisioner_trust_identity",
  "explicit_authority_root_path_resolved_from_verified_provisioning_record",
  "authority_root_identity_and_provisioner_only_writer_runtime_read_only_protection",
  "repository_runtime_root_identity_protection_and_selected_principal_binding",
  "persistent_active_activation_record_identity_and_repository_binding",
  "platform_provisioner_signature_trust_principal_root_and_protection_metadata_unchanged"
]);

const INSTALLATION_ENROLLMENT_DEPENDENCY_RELATIONSHIPS = Object.freeze({
  initialEnrollmentChallengeObjectContractAndDomainFraming: "provisioning_record_contract",
  initialEnrollmentRequestObjectContractAndDomainFraming: "provisioning_record_contract",
  initialEnrollmentCertificateObjectContractAndDomainFraming: "provisioning_record_contract",
  initialEnrollmentChallengeRawPayloadByteDecoder: "provisioning_record_contract",
  initialEnrollmentRequestRawPayloadByteDecoder: "provisioning_record_contract",
  initialEnrollmentCertificateRawPayloadByteDecoder: "provisioning_record_contract",
  initialEnrollmentRequestSignatureEnvelopeObjectContract: "provisioning_record_contract",
  initialEnrollmentCertificateSignatureEnvelopeObjectContract: "provisioning_record_contract",
  initialEnrollmentRequestRawEnvelopeByteDecoder: "provisioning_record_contract",
  initialEnrollmentCertificateRawEnvelopeByteDecoder: "provisioning_record_contract",
  initialEnrollmentTransportCodec: "provisioning_record_contract",
  initialEnrollmentRequestProofVerification: "provisioning_record_verification",
  initialEnrollmentCertificateSignatureVerification: "provisioning_record_verification",
  initialEnrollmentFlowBindingVerification: "provisioning_record_verification",
  initialEnrollmentRuntimeClock: "provisioning_record_verification",
  initialEnrollmentAttemptConsumption: "provisioning_record_verification",
  platformKeyStoragePolicy: "provisioning_record_contract",
  provisioningCaPureCoreContract: "provisioning_record_contract",
  provisioningCaPureCoreVerification: "provisioning_record_verification",
  offlineEnrollmentBundlePureCoreContract: "provisioning_record_contract",
  offlineEnrollmentBundlePureCoreVerification: "provisioning_record_verification",
  provisioningRecordEnrollmentBindingContract: "provisioning_record_contract",
  enrollmentCertificateRenewalContract: "provisioning_record_contract",
  enrollmentCertificateRenewalVerification: "provisioning_record_verification",
  platformProvisionerManifestVerification: "platform_provisioner_verification",
  platformProvisionerCrddDistributionVerification: "platform_provisioner_verification",
  platformProvisionerPackageGateObservation: "platform_provisioner_verification",
  platformProvisionerPackageFilesystemVerification: "platform_provisioner_verification",
  installationKeyGeneration: "platform_provisioner_effect",
  initialProvisioningEnrollmentExchange: "platform_provisioner_effect",
  onlineEnrollmentProtocol: "platform_provisioner_effect",
  offlineEnrollmentBundleImport: "platform_provisioner_effect",
  automaticEnrollmentRenewalEffect: "platform_provisioner_effect",
  provisioningEnrollmentCertificateContract: "provisioning_record_contract",
  enrollmentCertificateWireCodec: "provisioning_record_contract",
  offlineEnrollmentBundleContract: "provisioning_record_contract",
  installationKeyProtectionVerification: "provisioning_record_verification",
  provisioningEnrollmentCertificateVerification: "provisioning_record_verification",
  provisioningCaTrustAndRevocationVerification: "provisioning_record_verification",
  recordEnrollmentBindingVerification: "provisioning_record_verification",
  platformKeyStorageAdapterVerification: "provisioning_record_verification",
  enrollmentReplayProtectionPersistence: "provisioning_record_verification"
});
const PROVISIONING_STORAGE_DEPENDENCY_RELATIONSHIPS = Object.freeze({
  provisioningRecordFilesystemWrite: "platform_provisioner_effect",
  provisioningRecordCurrentPointerPersistence: "platform_provisioner_effect",
  provisioningRecordCurrentPointerContract: "provisioning_record_contract",
  provisioningTrustFloorPersistence: "provisioning_record_verification",
  repositoryGenerationPersistence: "activation_atomic_persistence",
  recoveryJournalPersistence: "activation_atomic_persistence"
});

/**
 * @typedef {{
 *   name: string,
 *   sources: readonly unknown[],
 *   readinessSufficientValues: readonly (readonly unknown[])[] | null
 * }} OnboardingDependency
 */

/**
 * @param {Record<string, any>} implementation
 */
function deriveOnboardingReadiness(implementation) {
  const rootProtection = implementation.rootProtectionPolicy;
  const locator = implementation.authorityRootLocator;
  const activationLocatorBinding = implementation.activationLocatorBinding;
  /**
   * @param {string} name
   * @param {unknown[]} sources
   * @returns {Readonly<OnboardingDependency>}
   */
  const dependency = (name, sources) => Object.freeze({
    name,
    sources: Object.freeze(sources),
    readinessSufficientValues: null
  });
  /** @param {string} dependencyName */
  const enrollmentSources = (dependencyName) =>
    Object.entries(INSTALLATION_ENROLLMENT_DEPENDENCY_RELATIONSHIPS)
      .filter(([, owner]) => owner === dependencyName)
      .map(([field]) => implementation[field]);
  /** @param {string} dependencyName */
  const storageSources = (dependencyName) =>
    Object.entries(PROVISIONING_STORAGE_DEPENDENCY_RELATIONSHIPS)
      .filter(([, owner]) => owner === dependencyName)
      .map(([field]) => implementation[field]);
  const dependencies = [
    dependency("platform_provisioner_verification", [
      implementation.platformProvisionerVerification,
      ...enrollmentSources("platform_provisioner_verification")
    ]),
    dependency("platform_provisioner_effect", [
      implementation.platformProvisionerEffect,
      ...enrollmentSources("platform_provisioner_effect"),
      ...storageSources("platform_provisioner_effect")
    ]),
    dependency("provisioning_record_contract", [
      implementation.provisioningRecordContract,
      implementation.provisioningRecordLifecyclePersistence,
      ...enrollmentSources("provisioning_record_contract"),
      ...storageSources("provisioning_record_contract")
    ]),
    dependency("provisioning_record_verification", [
      implementation.provisioningRecordVerification,
      implementation.provisioningRecordTrustAnchorSet,
      implementation.provisioningRecordRevocationEvaluation,
      implementation.provisioningRecordFilesystemRead,
      ...enrollmentSources("provisioning_record_verification"),
      ...storageSources("provisioning_record_verification")
    ]),
    dependency("authority_root_resolution_from_provisioning_record", [
      implementation.authorityRootResolutionFromProvisioningRecord,
      locator.filesystemRead,
      locator.resolver,
      locator.provisioningRecordVerification,
      locator.authorityRootIdentityVerification,
      locator.activeActivationBinding,
      activationLocatorBinding.provisioningRecordVerification,
      activationLocatorBinding.filesystemCurrentRecordRead,
      activationLocatorBinding.activeActivationBinding
    ]),
    dependency("root_protection_platform_adapters", [
      rootProtection.windowsDaclAdapter,
      rootProtection.posixOwnerModeAdapter,
      rootProtection.posixAclVerification,
      rootProtection.runtimePrincipalBinding,
      rootProtection.persistentVolumeAdapter,
      rootProtection.filesystemClassVerification,
      rootProtection.pathBinding,
      rootProtection.activationIntegration,
      implementation.ownerAclVerification
    ]),
    dependency("runtime_root_provisioning_effect",
      [implementation.runtimeRootProvisioningEffect]),
    dependency("authority_root_provisioning_effect",
      [implementation.authorityRootProvisioningEffect]),
    dependency("activation_effect", [implementation.activationEffect]),
    dependency("activation_path_identity_binding", [implementation.pathIdentityBinding]),
    dependency("activation_atomic_persistence", [
      implementation.atomicPersistence,
      locator.filesystemWrite,
      locator.atomicPersistence,
      activationLocatorBinding.atomicPersistence,
      activationLocatorBinding.crashRecovery,
      ...storageSources("activation_atomic_persistence")
    ]),
    dependency("run_scoped_capability", [
      implementation.runScopedCapability,
      implementation.runtimeCapabilityIssued
    ])
  ];

  // No readiness-sufficient value has been approved for any dependency yet.
  // Keeping the source values attached to each dependency makes future removal
  // an explicit contract change instead of treating candidate or unknown values
  // as sufficient by omission.
  const blockers = dependencies
    .filter(({ sources, readinessSufficientValues }) =>
      sources.length === 0 ||
      sources.some((value) => value === undefined) ||
      readinessSufficientValues === null ||
      sources.length !== readinessSufficientValues.length ||
      sources.some((value, index) => !readinessSufficientValues[index]?.includes(value)))
    .map(({ name }) => name);
  return Object.freeze({
    readiness: blockers.length > 0 ? "blocked" : "not_implemented",
    blockers: Object.freeze(blockers)
  });
}

/** @param {string} reason */
function blocked(reason) {
  return Object.freeze({
    status: "blocked",
    reason,
    record: null,
    recordHash: null,
    canonicalBytes: null,
    runtimeCapabilityIssued: false
  });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** @param {unknown} value */
function canonicalUtc(value) {
  if (typeof value !== "string" || value.length !== RUNTIME_ACTIVATION_INPUT_LIMITS.canonicalUtcLength) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(Date.prototype.getTime.call(parsed)) && parsed.toISOString() === value;
}

/** @param {unknown} value */
function positiveRevision(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/**
 * @param {unknown} value
 * @param {RegExp} pattern
 */
function identifier(value, pattern) {
  return typeof value === "string" && value.length <= RUNTIME_ACTIVATION_INPUT_LIMITS.identifierLength &&
    pattern.test(value);
}

/** @param {unknown} rawRecord */
function normalizeRecord(rawRecord) {
  const record = snapshotPlainRecord(rawRecord, RECORD_KEYS);
  if (!record ||
      record.contract !== RUNTIME_ACTIVATION_CONTRACT ||
      record.contractRevision !== RUNTIME_ACTIVATION_CONTRACT_REVISION ||
      !isRuntimeActivationIdCandidate(record.activationId) ||
      !positiveRevision(record.activationRevision) ||
      !["active", "disabled"].includes(record.status) ||
      (record.activationRevision === 1
        ? record.previousActivationHash !== null
        : typeof record.previousActivationHash !== "string" || !HASH.test(record.previousActivationHash)) ||
      typeof record.repositoryIdentityHash !== "string" || !HASH.test(record.repositoryIdentityHash) ||
      typeof record.runtimeRootIdentityHash !== "string" || !HASH.test(record.runtimeRootIdentityHash) ||
      !identifier(record.bundleId, BUNDLE_ID) || !positiveRevision(record.bundleRevision) ||
      typeof record.authorityBundleHash !== "string" || !HASH.test(record.authorityBundleHash) ||
      !identifier(record.policyId, POLICY_ID) || !positiveRevision(record.policyRevision) ||
      typeof record.trustPolicyHash !== "string" || !HASH.test(record.trustPolicyHash) ||
      !identifier(record.registryId, REGISTRY_ID) || !positiveRevision(record.registryRevision) ||
      typeof record.registryHash !== "string" || !HASH.test(record.registryHash) ||
      !canonicalUtc(record.activatedAt) ||
      (record.status === "active"
        ? record.disabledAt !== null
        : !canonicalUtc(record.disabledAt) || record.disabledAt < record.activatedAt)) return null;

  return Object.freeze(Object.fromEntries([...RECORD_KEYS].map((key) => [key, record[key]])));
}

/**
 * @param {Readonly<Record<string, any>>} record
 * @param {string} canonical
 */
function candidate(record, canonical) {
  return Object.freeze({
    status: "candidate",
    reason: "runtime_activation_path_acl_atomic_persistence_required",
    record,
    recordHash: createHash("sha256").update(canonical).digest("hex"),
    canonicalBytes: Buffer.from(canonical, "utf8"),
    runtimeCapabilityIssued: false
  });
}

/** @param {unknown} rawRecord */
export function compileRuntimeActivationRecordCandidate(rawRecord) {
  try {
    const record = normalizeRecord(rawRecord);
    if (!record) return blocked("runtime_activation_record_invalid");
    const canonical = canonicalJson(record);
    if (Buffer.byteLength(canonical, "utf8") > RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes) {
      return blocked("runtime_activation_record_bytes_exceeded");
    }
    return candidate(record, canonical);
  } catch {
    return blocked("runtime_activation_record_invalid");
  }
}

/** @param {unknown} input */
export function decodeRuntimeActivationRecordCandidate(input) {
  try {
    if (!Buffer.isBuffer(input)) return blocked("runtime_activation_record_bytes_required");
    const inputLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, input, []);
    if (inputLength > RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes) {
      return blocked("runtime_activation_record_bytes_exceeded");
    }
    const bytes = Buffer.allocUnsafe(inputLength);
    Uint8Array.prototype.set.call(bytes, input);
    if (inputLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return blocked("runtime_activation_record_bytes_invalid");
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = JSON.parse(source);
    const result = compileRuntimeActivationRecordCandidate(parsed);
    if (result.status !== "candidate") return blocked(result.reason);
    if (!Buffer.prototype.equals.call(bytes, result.canonicalBytes)) {
      return blocked("runtime_activation_record_bytes_noncanonical");
    }
    return result;
  } catch {
    return blocked("runtime_activation_record_bytes_invalid");
  }
}

export function describeRuntimeActivationContract() {
  const rootProtectionPolicy = describeRootProtectionPolicyContract();
  const authorityRootLocator = describeAuthorityRootLocatorContract();
  const activationLocatorBinding = describeRuntimeActivationLocatorBindingContract();
  const provisioningSignaturePrimitives = describeProvisioningSignaturePrimitivesContract();
  const provisioningRecordPureCore = describeProvisioningRecordPureCoreContract();
  const initialEnrollmentPureCore = describeInitialEnrollmentPureCoreContract();
  const initialEnrollmentRuntimeState = describeInitialEnrollmentRuntimeStateContract();
  const platformKeyStoragePolicy = describePlatformKeyStoragePolicyContract();
  const provisioningCaPureCore = describeProvisioningCaPureCoreContract();
  const offlineEnrollmentBundlePureCore = describeOfflineEnrollmentBundlePureCoreContract();
  const provisioningRecordEnrollmentBinding =
    describeProvisioningRecordEnrollmentBindingContract();
  const enrollmentCertificateRenewal = describeEnrollmentCertificateRenewalContract();
  const platformProvisionerTrustCore = describePlatformProvisionerTrustCoreContract();
  const platformProvisionerPackageGate = describePlatformProvisionerPackageGateContract();
  const implementation = Object.freeze({
    activationEffect: "not_implemented",
    platformProvisionerVerification: "not_implemented",
    platformProvisionerEffect: "not_implemented",
    installationKeyGeneration: "not_implemented",
    installationKeyProtectionVerification: "not_implemented",
    provisioningEnrollmentCertificateContract: "not_implemented",
    provisioningEnrollmentCertificateVerification: "not_implemented",
    provisioningCaTrustAndRevocationVerification: "not_implemented",
    initialProvisioningEnrollmentExchange: "not_implemented",
    recordEnrollmentBindingVerification: provisioningRecordEnrollmentBinding.verification,
    enrollmentCertificateWireCodec: "not_implemented",
    onlineEnrollmentProtocol: "not_implemented",
    offlineEnrollmentBundleContract:
      offlineEnrollmentBundlePureCore.objectContractAndCryptographicVerification,
    offlineEnrollmentBundleImport: "not_implemented",
    platformKeyStorageAdapterVerification: "not_implemented",
    provisioningCaPureCoreContract: provisioningCaPureCore.rootTrustSetCodec,
    provisioningCaPureCoreVerification:
      provisioningCaPureCore.issuingCertificateVerification,
    offlineEnrollmentBundlePureCoreContract:
      offlineEnrollmentBundlePureCore.objectContractAndCryptographicVerification,
    offlineEnrollmentBundlePureCoreVerification:
      offlineEnrollmentBundlePureCore.objectContractAndCryptographicVerification,
    provisioningRecordEnrollmentBindingContract:
      provisioningRecordEnrollmentBinding.verification,
    enrollmentCertificateRenewalContract:
      enrollmentCertificateRenewal.transitionVerification,
    enrollmentCertificateRenewalVerification:
      enrollmentCertificateRenewal.transitionVerification,
    platformProvisionerManifestVerification:
      platformProvisionerTrustCore.manifestCryptographicVerification,
    platformProvisionerCrddDistributionVerification:
      platformProvisionerTrustCore.runtimeOwnedCrddDistributionVerification,
    platformProvisionerPackageGateObservation:
      platformProvisionerPackageGate.observationContract,
    platformProvisionerPackageFilesystemVerification:
      platformProvisionerPackageGate.runtimeOwnedPackageFilesystemAdapter,
    enrollmentReplayProtectionPersistence: "not_implemented",
    automaticEnrollmentRenewalEffect: "not_implemented",
    initialEnrollmentChallengeObjectContractAndDomainFraming:
      initialEnrollmentPureCore.challengeObjectContractAndDomainFraming,
    initialEnrollmentRequestObjectContractAndDomainFraming:
      initialEnrollmentPureCore.requestObjectContractAndDomainFraming,
    initialEnrollmentCertificateObjectContractAndDomainFraming:
      initialEnrollmentPureCore.certificateObjectContractAndDomainFraming,
    initialEnrollmentChallengeRawPayloadByteDecoder:
      initialEnrollmentPureCore.challengeRawPayloadByteDecoder,
    initialEnrollmentRequestRawPayloadByteDecoder:
      initialEnrollmentPureCore.requestRawPayloadByteDecoder,
    initialEnrollmentCertificateRawPayloadByteDecoder:
      initialEnrollmentPureCore.certificateRawPayloadByteDecoder,
    initialEnrollmentRequestSignatureEnvelopeObjectContract:
      initialEnrollmentPureCore.requestSignatureEnvelopeObjectContract,
    initialEnrollmentCertificateSignatureEnvelopeObjectContract:
      initialEnrollmentPureCore.certificateSignatureEnvelopeObjectContract,
    initialEnrollmentRequestRawEnvelopeByteDecoder:
      initialEnrollmentPureCore.requestRawEnvelopeByteDecoder,
    initialEnrollmentCertificateRawEnvelopeByteDecoder:
      initialEnrollmentPureCore.certificateRawEnvelopeByteDecoder,
    initialEnrollmentTransportCodec:
      initialEnrollmentPureCore.transportCodec,
    initialEnrollmentRequestProofVerification:
      initialEnrollmentPureCore.requestProofOfPossessionVerification,
    initialEnrollmentCertificateSignatureVerification:
      initialEnrollmentPureCore.certificateSignatureVerification,
    initialEnrollmentFlowBindingVerification:
      initialEnrollmentPureCore.initialFlowBindingVerification,
    initialEnrollmentRuntimeClock:
      initialEnrollmentRuntimeState.runtimeClock,
    initialEnrollmentAttemptConsumption:
      initialEnrollmentRuntimeState.firstVerificationAttemptConsumption,
    provisioningRecordContract: "not_implemented",
    provisioningRecordVerification: "not_implemented",
    provisioningRecordTrustAnchorSet: "not_implemented",
    provisioningRecordRevocationEvaluation: "not_implemented",
    provisioningRecordFilesystemRead: "not_implemented",
    provisioningRecordLifecyclePersistence: "not_implemented",
    provisioningRecordFilesystemWrite: "not_implemented",
    provisioningRecordCurrentPointerContract: "not_implemented",
    provisioningRecordCurrentPointerPersistence: "not_implemented",
    provisioningTrustFloorPersistence: "not_implemented",
    repositoryGenerationPersistence: "not_implemented",
    recoveryJournalPersistence: "not_implemented",
    authorityRootResolutionFromProvisioningRecord: "not_implemented",
    runtimeRootProvisioningEffect: "not_implemented",
    authorityRootProvisioningEffect: "not_implemented",
    atomicPersistence: "not_implemented",
    pathIdentityBinding: "not_implemented",
    ownerAclVerification: "not_implemented",
    runScopedCapability: "not_implemented",
    runtimeCapabilityIssued: false,
    rootProtectionPolicy,
    authorityRootLocator,
    activationLocatorBinding,
    provisioningSignaturePrimitives,
    provisioningRecordPureCore,
    initialEnrollmentPureCore,
    initialEnrollmentRuntimeState,
    platformKeyStoragePolicy,
    provisioningCaPureCore,
    offlineEnrollmentBundlePureCore,
    provisioningRecordEnrollmentBinding,
    enrollmentCertificateRenewal,
    platformProvisionerTrustCore,
    platformProvisionerPackageGate
  });
  const provisioningRecordTrustAndSelectionPolicy = Object.freeze({
    policy: "human_approved_candidate_contract_only",
    authorityRole: "platform_scope_signed_runtime_authority_source_of_truth_target",
    artifactTopology:
      "provisioning_record_central_without_separate_receipt_or_helper_manifest_authority",
    provisionReceiptRelationship: "not_separate_runtime_authority_artifact_target",
    platformProvisionerManifestRelationship:
      "not_separate_runtime_authority_artifact_target",
    authorityFileBundleManifestRelationship: "separate_existing_artifact",
    signedContentCoverage: "all_security_important_fields_one_canonical_json_signed_target",
    signedIdentityCoverage:
      "provisioner_identity_and_signature_metadata_bound_to_record_target",
    trustAnchorOwnership: "qual_lab_public_key_set_bundled_with_coordinator_target",
    trustAnchorLifecycle:
      "multiple_key_ids_overlap_rotation_and_explicit_revocation_required_target",
    storageScope:
      "shared_authority_platform_scope_provisioner_write_runtime_read_only_target",
    repositoryCanonicalRecordStored: false,
    locatorRelationship: "untrusted_provisioning_record_hash_reference_only",
    firstSetupOrReconfigurationSelection: "explicit_cli_target",
    routineRunSelection: "verified_provisioning_record_and_locator_target",
    environmentSelection: "explicit_compatibility_or_automation_override_target",
    selectionFailureBehavior: "blocked_without_silent_fallback_and_reprovision_required",
    automaticRepair: false,
    signaturePrimitives: implementation.provisioningSignaturePrimitives,
    recordPureCore: implementation.provisioningRecordPureCore,
    signatureEnvelopeTopology:
      implementation.provisioningSignaturePrimitives.payloadSignatureEnvelopeTopology,
    signatureEncoding:
      implementation.provisioningSignaturePrimitives.p256SignatureBase64url,
    keyIdEncoding: implementation.provisioningRecordPureCore.keyIdEncoding,
    multiSignatureAcceptancePolicy:
      implementation.provisioningSignaturePrimitives.multiSignatureAcceptancePolicy,
    offlineBundledTrustEvaluation:
      implementation.provisioningSignaturePrimitives.offlineBundledTrustEvaluation,
    recordSchemaCodec: implementation.provisioningRecordPureCore.recordPayloadCodec,
    signatureVerifier:
      implementation.provisioningRecordPureCore.aggregateCryptographicCondition,
    embeddedTrustAnchorSet: implementation.provisioningRecordTrustAnchorSet,
    revocationEvaluator: implementation.provisioningRecordRevocationEvaluation,
    filesystemRead: implementation.provisioningRecordFilesystemRead,
    resolver: implementation.authorityRootResolutionFromProvisioningRecord,
    lifecyclePersistence: implementation.provisioningRecordLifecyclePersistence,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
  const installationKeyEnrollmentPolicy = Object.freeze({
    policy: "human_approved_candidate_contract_only",
    installationKeyAlgorithmTarget: "ECDSA_P256_SHA256_target",
    installationKeyGenerationTarget:
      "platform_scope_os_managed_key_storage_boundary_target",
    installationKeyBackendCandidates: Object.freeze([
      "os_keystore_candidate",
      "tpm_candidate",
      "secure_enclave_candidate"
    ]),
    installationKeyBackendSelection:
      "platform_preferences_and_explicit_fallbacks_human_approved_adapter_verification_not_implemented",
    platformKeyStoragePolicies: Object.freeze({
      windows: Object.freeze({
        preferred: "cng_ksp_tpm_backed_target",
        explicitFallback: "software_ksp_target",
        silentFallback: false
      }),
      macos: Object.freeze({
        preferred: "keychain_secure_enclave_when_supported_target",
        explicitFallback: "keychain_software_backed_target",
        silentFallback: false
      }),
      linux: Object.freeze({
        preferred: "tpm_2_0_target",
        explicitFallback: "root_owned_software_keystore_target",
        silentFallback: false
      })
    }),
    platformKeyStoragePolicy: implementation.platformKeyStoragePolicy,
    provisioningCaPureCore: implementation.provisioningCaPureCore,
    offlineEnrollmentBundlePureCore: implementation.offlineEnrollmentBundlePureCore,
    provisioningRecordEnrollmentBinding:
      implementation.provisioningRecordEnrollmentBinding,
    enrollmentCertificateRenewal: implementation.enrollmentCertificateRenewal,
    platformProvisionerTrustCore: implementation.platformProvisionerTrustCore,
    platformProvisionerPackageGate: implementation.platformProvisionerPackageGate,
    platformKeyStorageSetupDisclosure:
      "selected_backend_and_protection_strength_disclosed_during_initial_setup_target",
    routineRunKeyStorageSelection:
      "no_reselection_or_administrator_action_while_verified_state_valid_target",
    privateKeyMaterialHandling:
      "never_input_output_or_artifact_of_coordinator_runtime_target",
    provisioningCaRole:
      "qual_lab_provisioning_ca_short_lived_public_key_enrollment_target",
    enrollmentCertificateTopology:
      "short_lived_enrollment_certificate_topology_human_approved_target",
    enrollmentCertificateFormatTarget: "custom_jcs_json_target",
    enrollmentCertificateSignatureAlgorithmTarget: "Ed25519_target",
    initialOnlineEnrollmentPureCore: implementation.initialEnrollmentPureCore,
    initialOnlineEnrollmentRuntimeState: implementation.initialEnrollmentRuntimeState,
    enrollmentCertificateDomainSeparation:
      "initial_online_exact_domain_implemented_candidate_renewal_and_other_paths_not_implemented",
    enrollmentCertificateKeyIdEncodingTarget:
      "spki_der_sha256_lowercase_hex_64_target",
    enrollmentCertificateValidityDays: 180,
    enrollmentCertificateRenewalWindowDays: 30,
    enrollmentCertificateOverlapMaximumDays: 30,
    renewalFailureBehavior:
      "blocked_at_expiry_without_automatic_source_fallback_target",
    successfulAutomaticRenewalInteraction:
      "no_user_or_administrator_action_after_verified_success_target",
    enrollmentCertificateExactSpecification:
      "initial_online_object_schema_domain_jcs_signing_and_raw_envelope_bytes_implemented_candidate_transport_renewal_and_lifecycle_not_implemented",
    embeddedQualLabPrivateKey: "prohibited",
    initialEnrollmentModes: Object.freeze([
      "explicit_online_initial_enrollment_target",
      "administrator_supplied_offline_enrollment_bundle_target"
    ]),
    onlineEnrollmentRequiredInputs: Object.freeze([
      "one_time_challenge",
      "nonce",
      "platform_scope",
      "installation_public_key",
      "enrollment_request_binding"
    ]),
    onlineChallengeValidityMinutes: 30,
    onlineChallengeBinding:
      "nonce_installation_public_key_platform_scope_and_enrollment_request_binding_target_challenge_payload_and_request_envelope_raw_bytes_implemented_candidate_transport_and_effect_not_implemented",
    onlineChallengeConsumption:
      "consumed_on_first_verification_attempt_whether_success_or_failure_and_never_reusable_target",
    onlineChallengeExpiryBehavior:
      "expired_challenge_blocked_and_fresh_challenge_required_without_offline_fallback_target",
    onlineProofOfPossession:
      "installation_private_key_signature_required_request_envelope_raw_bytes_implemented_candidate_transport_and_effect_not_implemented",
    offlineEnrollmentBundleRequiredContents: Object.freeze([
      "online_enrollment_challenge",
      "signed_enrollment_request",
      "enrollment_request_hash",
      "enrollment_certificate",
      "exact_online_and_offline_issuing_ca_chain",
      "revocation_snapshot",
      "bundle_expiry"
    ]),
    offlineEnrollmentBundleAuthenticity:
      "offline_issuing_key_signed_exact_one_envelope_and_binding_verification_implemented_candidate_runtime_trust_and_import_not_implemented",
    offlineEnrollmentBundleValidityDays: 7,
    offlineEnrollmentBundleConsumption: "one_time_consumption_target",
    enrollmentReplayBehavior:
      "replay_cross_machine_cross_platform_scope_and_expired_input_blocked_target",
    enrollmentModeFallback: "blocked_without_silent_fallback",
    routineRunNetworkRequirement:
      "not_required_after_verified_enrollment_and_runtime_state_target",
    currentRunEvidenceRelationship:
      "included_in_verified_current_provisioning_record_and_platform_provisioner_trust_identity_target",
    routineRunReverification:
      "installation_key_enrollment_ca_trust_and_platform_scope_revalidated_target",
    verifiedEnrollmentPublicKeyRole:
      "future_provisioning_record_signing_key_candidate_only",
    unknownExpiredRevokedRollbackReplacedOrUnverifiableBehavior:
      "blocked_and_reprovision_required_without_automatic_recovery_or_fallback",
    provisioningCaTopology:
      "offline_root_and_online_issuing_key_role_separation_target",
    provisioningCaIssuingKeyValidityDays: 365,
    provisioningCaIssuingKeyOverlapDays: 30,
    provisioningRevocationFreshnessHours: 24,
    provisioningTrustRollbackFloor:
      "monotonic_epoch_revision_and_same_revision_hash_target_persistence_not_implemented",
    installationKeyGeneration: implementation.installationKeyGeneration,
    installationKeyProtectionVerification:
      implementation.installationKeyProtectionVerification,
    enrollmentCertificateContract:
      implementation.provisioningEnrollmentCertificateContract,
    enrollmentCertificateVerification:
      implementation.provisioningEnrollmentCertificateVerification,
    provisioningCaTrustAndRevocationVerification:
      implementation.provisioningCaTrustAndRevocationVerification,
    initialEnrollmentExchange: implementation.initialProvisioningEnrollmentExchange,
    recordEnrollmentBindingVerification:
      implementation.recordEnrollmentBindingVerification,
    enrollmentCertificateWireCodec: implementation.enrollmentCertificateWireCodec,
    onlineEnrollmentProtocol: implementation.onlineEnrollmentProtocol,
    offlineEnrollmentBundleContract: implementation.offlineEnrollmentBundleContract,
    offlineEnrollmentBundleImport: implementation.offlineEnrollmentBundleImport,
    platformKeyStorageAdapterVerification:
      implementation.platformKeyStorageAdapterVerification,
    enrollmentReplayProtectionPersistence:
      implementation.enrollmentReplayProtectionPersistence,
    automaticEnrollmentRenewalEffect:
      implementation.automaticEnrollmentRenewalEffect,
    implementationDependencyRelationships:
      INSTALLATION_ENROLLMENT_DEPENDENCY_RELATIONSHIPS,
    enrollmentReadiness: "blocked",
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
  const provisioningStorageAndLifecyclePolicy = Object.freeze({
    policy: "human_approved_candidate_contract_only",
    authorityRecordStorage:
      "immutable_content_addressed_records_with_atomic_current_pointer_target",
    repositoryActivationStorage:
      "immutable_activation_locator_generation_with_atomic_current_pointer_target",
    authorityAndRepositoryAtomicity:
      "authority_record_committed_before_repository_generation_without_cross_volume_atomicity_claim",
    durabilityOrdering:
      "immutable_files_fsync_then_generation_directory_fsync_then_pointer_temp_fsync_then_pointer_atomic_replace_then_pointer_parent_directory_fsync_then_reread_identity_verification_target",
    durabilityStageFailureBehavior:
      "retain_created_artifacts_and_verified_existing_journal_for_recovery_only_block_and_require_explicit_recovery_without_guessed_rollback_automatic_retry_old_pointer_fallback_or_success_classification",
    recoveryJournal:
      "private_owned_transaction_expected_previous_and_next_hashes_target",
    ambiguousRecoveryBehavior:
      "ambiguous_or_unclassifiable_state_uses_durability_stage_failure_behavior",
    disableLifecycle:
      "disabled_generation_retains_inactive_locator_and_reactivation_requires_new_activation_id_target",
    setupSelectionPrecedence: "explicit_cli_then_explicit_environment_target",
    routineRunSelection: "verified_record_and_locator_only_target",
    selectedSourceFailureBehavior:
      "blocked_without_lower_priority_fallback_and_reprovision_required",
    filesystemRead: implementation.provisioningRecordFilesystemRead,
    filesystemWrite: implementation.provisioningRecordFilesystemWrite,
    authorityRecordCurrentPointerContract:
      implementation.provisioningRecordCurrentPointerContract,
    authorityRecordCurrentPointerPersistence:
      implementation.provisioningRecordCurrentPointerPersistence,
    trustFloorPersistence: implementation.provisioningTrustFloorPersistence,
    repositoryGenerationPersistence: implementation.repositoryGenerationPersistence,
    recoveryJournalPersistence: implementation.recoveryJournalPersistence,
    atomicPersistence: implementation.atomicPersistence,
    crashRecovery: implementation.activationLocatorBinding.crashRecovery,
    implementationDependencyRelationships:
      PROVISIONING_STORAGE_DEPENDENCY_RELATIONSHIPS,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
  const onboarding = deriveOnboardingReadiness(implementation);
  return Object.freeze({
    contract: RUNTIME_ACTIVATION_CONTRACT,
    contractRevision: RUNTIME_ACTIVATION_CONTRACT_REVISION,
    fixedRuntimeRootFile: RUNTIME_ACTIVATION_FILE,
    persistence: "repository_scoped_persistent",
    activationCommand: "dedicated_activate_required",
    provisionCommandGrammar: "implemented_candidate_explicit_command_only",
    provisionCommandCurrentBehavior:
      "dry_run_blocked_until_os_native_signature_release_trust_and_effect_implemented",
    activationCommandGrammar: "implemented_candidate",
    activationEffect: implementation.activationEffect,
    localOnboardingContract: "implemented_candidate_contract_only",
    onboardingPolicyDecision: "human_approved_contract_only",
    runtimeAuthorityConferredByOnboardingPolicy: false,
    platformProvisionerDistributionTarget:
      "official_signed_platform_provisioner_distributed_with_coordinator_target",
    platformProvisioningScope:
      "platform_scope_once_while_verified_provisioning_identity_valid_target",
    runtimePrincipalModes: ONBOARDING_RUNTIME_PRINCIPAL_MODES,
    authorityRootPathReuseTarget:
      "explicit_path_resolved_from_verified_provisioning_record_target",
    authorityRootLocator: implementation.authorityRootLocator,
    activationLocatorBinding: implementation.activationLocatorBinding,
    provisioningSignaturePrimitives: implementation.provisioningSignaturePrimitives,
    provisioningRecordPureCore: implementation.provisioningRecordPureCore,
    initialEnrollmentPureCore: implementation.initialEnrollmentPureCore,
    initialEnrollmentRuntimeState: implementation.initialEnrollmentRuntimeState,
    platformKeyStoragePolicy: implementation.platformKeyStoragePolicy,
    provisioningCaPureCore: implementation.provisioningCaPureCore,
    offlineEnrollmentBundlePureCore: implementation.offlineEnrollmentBundlePureCore,
    provisioningRecordEnrollmentBinding:
      implementation.provisioningRecordEnrollmentBinding,
    enrollmentCertificateRenewal: implementation.enrollmentCertificateRenewal,
    platformProvisionerTrustCore: implementation.platformProvisionerTrustCore,
    platformProvisionerPackageGate: implementation.platformProvisionerPackageGate,
    provisioningRecordTrustAndSelectionPolicy,
    installationKeyEnrollmentPolicy,
    provisioningStorageAndLifecyclePolicy,
    provisioningRecordRole: provisioningRecordTrustAndSelectionPolicy.authorityRole,
    provisionReceiptRelationship:
      provisioningRecordTrustAndSelectionPolicy.provisionReceiptRelationship,
    platformProvisionerManifestRelationship:
      provisioningRecordTrustAndSelectionPolicy.platformProvisionerManifestRelationship,
    authorityFileBundleManifestRelationship:
      provisioningRecordTrustAndSelectionPolicy.authorityFileBundleManifestRelationship,
    authorityRootCurrentSelectionContract:
      "cli_then_environment_explicit_path_until_verified_record_resolver_implemented",
    runRevalidationRequired: true,
    onboardingReadyRule:
      "all_implementation_dependencies_and_current_run_evidence_confirmed",
    onboardingCurrentRunEvidenceRequirements: ONBOARDING_CURRENT_RUN_EVIDENCE_REQUIREMENTS,
    onboardingReadyTransition: "not_implemented",
    onboardingReadinessProjection: "implemented_candidate_contract_only",
    requiredProvisioningTargetKinds: ONBOARDING_PROVISIONING_TARGET_KINDS,
    onboardingReadiness: onboarding.readiness,
    onboardingBlockingDependencies: onboarding.blockers,
    disabledRepositoryExperience: "no_runtime_specific_effect",
    firstPlatformSetup:
      "verify_signed_platform_provisioner_and_provision_shared_authority_root_target",
    authorityProvisioningScope: "shared_platform_scope_reusable_across_repositories_target",
    repositoryActivationEntry: "single_coordinator_activate_command_target",
    runtimeRootProvisioningEffectOwner: "dedicated_platform_provisioner_target",
    runtimeRootProvisioningScope: "per_repository_during_activation_or_precondition_target",
    normalRunAdministratorElevation:
      "not_required_after_verified_provision_and_activation_target",
    normalRunPathInput: "not_required_after_verified_provision_and_activation_target",
    normalRunManualAclConfiguration:
      "not_required_after_verified_provision_and_activation_target",
    restartPrompt: "not_required_when_protection_identity_and_activation_are_valid_target",
    protectionChangeBehavior:
      "fail_closed_reverification_then_reprovision_on_confirmed_condition",
    reverificationTriggers: Object.freeze([
      "platform_provisioner_or_signature_or_trust_change",
      "runtime_or_provisioner_principal_change",
      "root_identity_or_protection_metadata_change"
    ]),
    reprovisionConditions: Object.freeze([
      "required_root_missing_or_replaced",
      "required_writer_or_runtime_read_only_protection_mismatch",
      "verified_provisioning_record_authority_root_identity_mismatch"
    ]),
    platformProvisionerVerification: implementation.platformProvisionerVerification,
    platformProvisionerEffect: implementation.platformProvisionerEffect,
    installationKeyGeneration: implementation.installationKeyGeneration,
    installationKeyProtectionVerification:
      implementation.installationKeyProtectionVerification,
    provisioningEnrollmentCertificateContract:
      implementation.provisioningEnrollmentCertificateContract,
    provisioningEnrollmentCertificateVerification:
      implementation.provisioningEnrollmentCertificateVerification,
    provisioningCaTrustAndRevocationVerification:
      implementation.provisioningCaTrustAndRevocationVerification,
    initialProvisioningEnrollmentExchange:
      implementation.initialProvisioningEnrollmentExchange,
    recordEnrollmentBindingVerification:
      implementation.recordEnrollmentBindingVerification,
    enrollmentCertificateWireCodec: implementation.enrollmentCertificateWireCodec,
    onlineEnrollmentProtocol: implementation.onlineEnrollmentProtocol,
    offlineEnrollmentBundleContract: implementation.offlineEnrollmentBundleContract,
    offlineEnrollmentBundleImport: implementation.offlineEnrollmentBundleImport,
    platformKeyStorageAdapterVerification:
      implementation.platformKeyStorageAdapterVerification,
    enrollmentReplayProtectionPersistence:
      implementation.enrollmentReplayProtectionPersistence,
    automaticEnrollmentRenewalEffect:
      implementation.automaticEnrollmentRenewalEffect,
    provisioningRecordContract: implementation.provisioningRecordContract,
    provisioningRecordVerification: implementation.provisioningRecordVerification,
    provisioningRecordTrustAnchorSet: implementation.provisioningRecordTrustAnchorSet,
    provisioningRecordRevocationEvaluation:
      implementation.provisioningRecordRevocationEvaluation,
    provisioningRecordFilesystemRead: implementation.provisioningRecordFilesystemRead,
    provisioningRecordLifecyclePersistence:
      implementation.provisioningRecordLifecyclePersistence,
    provisioningRecordFilesystemWrite:
      implementation.provisioningRecordFilesystemWrite,
    provisioningRecordCurrentPointerContract:
      implementation.provisioningRecordCurrentPointerContract,
    provisioningRecordCurrentPointerPersistence:
      implementation.provisioningRecordCurrentPointerPersistence,
    provisioningTrustFloorPersistence:
      implementation.provisioningTrustFloorPersistence,
    repositoryGenerationPersistence:
      implementation.repositoryGenerationPersistence,
    recoveryJournalPersistence:
      implementation.recoveryJournalPersistence,
    authorityRootResolutionFromProvisioningRecord:
      implementation.authorityRootResolutionFromProvisioningRecord,
    authorityRootExplicitPathContractPreserved: true,
    runtimeRootProvisioningEffect: implementation.runtimeRootProvisioningEffect,
    authorityRootProvisioningEffect: implementation.authorityRootProvisioningEffect,
    disableCommandGrammar: "implemented_candidate",
    provisionEffect: "not_implemented",
    disableEffect: "not_implemented",
    doctorEnableIsActivation: false,
    bundleIdentityChangeRequiresReactivation: true,
    disableSemantics: "stop_new_operations_and_safely_cancel_in_flight",
    deleteIsSeparateOperation: true,
    deleteImplementation: "not_implemented",
    canonicalRecordCore: "implemented_candidate",
    crossRecordTransitionCore: "implemented_candidate",
    initialTransitionCore: "initial_null_to_active_candidate",
    disableTransitionCore: "active_to_disabled_candidate",
    reactivationTransitionPolicy: "not_implemented",
    disabledOriginTransitionPolicy: "not_implemented",
    canonicalUtcLength: RUNTIME_ACTIVATION_INPUT_LIMITS.canonicalUtcLength,
    rootProtectionPolicy: implementation.rootProtectionPolicy,
    atomicPersistence: implementation.atomicPersistence,
    pathIdentityBinding: implementation.pathIdentityBinding,
    ownerAclVerification: implementation.ownerAclVerification,
    runScopedCapability: implementation.runScopedCapability,
    runtimeCapabilityIssued: implementation.runtimeCapabilityIssued
  });
}
