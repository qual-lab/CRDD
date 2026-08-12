import { createHash } from "node:crypto";

import { describeAuthorityRootLocatorContract } from "./authority-root-locator.mjs";
import { describeRuntimeActivationLocatorBindingContract } from
  "./runtime-activation-locator-binding-contract.mjs";
import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import { describeRootProtectionPolicyContract } from "./root-protection-policy.mjs";
import {
  RUNTIME_ACTIVATION_ID_MAX_LENGTH,
  isRuntimeActivationIdCandidate
} from "./runtime-activation-identity.mjs";

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
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength"
).get;
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
  "helper_signature_trust_principal_root_and_protection_metadata_unchanged"
]);

function deriveOnboardingReadiness(implementation) {
  const rootProtection = implementation.rootProtectionPolicy;
  const locator = implementation.authorityRootLocator;
  const activationLocatorBinding = implementation.activationLocatorBinding;
  const dependency = (name, sources) => Object.freeze({
    name,
    sources: Object.freeze(sources),
    readinessSufficientValues: null
  });
  const dependencies = [
    dependency("platform_provisioner_verification",
      [implementation.platformProvisionerVerification]),
    dependency("platform_provisioner_effect", [implementation.platformProvisionerEffect]),
    dependency("provision_receipt_contract", [implementation.provisionReceiptContract]),
    dependency("provision_receipt_verification", [implementation.provisionReceiptVerification]),
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
      activationLocatorBinding.crashRecovery
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
      sources.some((value, index) => !readinessSufficientValues[index].includes(value)))
    .map(({ name }) => name);
  return Object.freeze({
    readiness: blockers.length > 0 ? "blocked" : "not_implemented",
    blockers: Object.freeze(blockers)
  });
}

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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalUtc(value) {
  if (typeof value !== "string" || value.length !== RUNTIME_ACTIVATION_INPUT_LIMITS.canonicalUtcLength) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(Date.prototype.getTime.call(parsed)) && parsed.toISOString() === value;
}

function positiveRevision(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

function identifier(value, pattern) {
  return typeof value === "string" && value.length <= RUNTIME_ACTIVATION_INPUT_LIMITS.identifierLength &&
    pattern.test(value);
}

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
  const implementation = Object.freeze({
    activationEffect: "not_implemented",
    platformProvisionerVerification: "not_implemented",
    platformProvisionerEffect: "not_implemented",
    provisionReceiptContract: "not_implemented",
    provisionReceiptVerification: "not_implemented",
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
    activationLocatorBinding
  });
  const onboarding = deriveOnboardingReadiness(implementation);
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
    recordSchemaCodec: implementation.provisionReceiptContract,
    signatureVerifier: implementation.platformProvisionerVerification,
    embeddedTrustAnchorSet: "not_implemented",
    revocationEvaluator: "not_implemented",
    filesystemRead: "not_implemented",
    resolver: implementation.authorityRootResolutionFromProvisioningRecord,
    lifecyclePersistence: "not_implemented",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false
  });
  return Object.freeze({
    contract: RUNTIME_ACTIVATION_CONTRACT,
    contractRevision: RUNTIME_ACTIVATION_CONTRACT_REVISION,
    fixedRuntimeRootFile: RUNTIME_ACTIVATION_FILE,
    persistence: "repository_scoped_persistent",
    activationCommand: "dedicated_activate_required",
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
    provisioningRecordTrustAndSelectionPolicy,
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
    provisionReceiptContract: implementation.provisionReceiptContract,
    provisionReceiptVerification: implementation.provisionReceiptVerification,
    authorityRootResolutionFromProvisioningRecord:
      implementation.authorityRootResolutionFromProvisioningRecord,
    authorityRootExplicitPathContractPreserved: true,
    runtimeRootProvisioningEffect: implementation.runtimeRootProvisioningEffect,
    authorityRootProvisioningEffect: implementation.authorityRootProvisioningEffect,
    disableCommandGrammar: "implemented_candidate",
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
