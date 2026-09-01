import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_ROOT_RESOLUTION_LOCATOR_SOURCE_FIELDS,
  RUNTIME_ACTIVATION_CONTRACT,
  RUNTIME_ACTIVATION_CONTRACT_REVISION,
  RUNTIME_ACTIVATION_INPUT_LIMITS,
  compileRuntimeActivationRecordCandidate,
  decodeRuntimeActivationRecordCandidate,
  describeRuntimeActivationContract,
} from "../src/security/runtime-activation-record.ts";
import { RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS } from "../src/security/runtime-activation-locator-binding-contract.ts";

function record(overrides = {}) {
  return {
    contract: RUNTIME_ACTIVATION_CONTRACT,
    contractRevision: RUNTIME_ACTIVATION_CONTRACT_REVISION,
    activationId: "ACTIVATION-000001",
    activationRevision: 1,
    status: "active",
    previousActivationHash: null,
    repositoryIdentityHash: "1".repeat(64),
    runtimeRootIdentityHash: "2".repeat(64),
    bundleId: "AUTHBUNDLE-000001",
    bundleRevision: 3,
    authorityBundleHash: "3".repeat(64),
    policyId: "AUTHPOL-000001",
    policyRevision: 2,
    trustPolicyHash: "4".repeat(64),
    registryId: "AUTHREG-000001",
    registryRevision: 5,
    registryHash: "5".repeat(64),
    activatedAt: "2026-08-11T00:00:00.000Z",
    disabledAt: null,
    ...overrides,
  };
}

test("Authority Root解決のsource母集団は観測済みRecord結合を含む", () => {
  assert.deepEqual(AUTHORITY_ROOT_RESOLUTION_LOCATOR_SOURCE_FIELDS, [
    "filesystemRead",
    "resolver",
    "provisioningRecordVerification",
    "authorityRootIdentityVerification",
    "observedProvisioningRecordBinding",
    "activeActivationBinding",
  ]);
});

test("Activation recordはRepository、Root、Bundle、Policy、Registry Identityをcanonical byteへ結合する", () => {
  const compiled = compileRuntimeActivationRecordCandidate(record());
  assert.equal(compiled.status, "candidate");
  assert.match(compiled.recordHash, /^[a-f0-9]{64}$/u);
  assert.equal(compiled.runtimeCapabilityIssued, false);
  const decoded = decodeRuntimeActivationRecordCandidate(
    compiled.canonicalBytes,
  );
  assert.equal(decoded.status, "candidate");
  assert.equal(decoded.recordHash, compiled.recordHash);
  assert.deepEqual(decoded.record, compiled.record);
});

test("Bundle、PolicyまたはRegistry Identity変更はrecord Hashを変え再activation対象にする", () => {
  const baseline = compileRuntimeActivationRecordCandidate(record()).recordHash;
  for (const overrides of [
    { bundleRevision: 4 },
    { authorityBundleHash: "6".repeat(64) },
    { policyRevision: 3 },
    { trustPolicyHash: "7".repeat(64) },
    { registryRevision: 6 },
    { registryHash: "8".repeat(64) },
  ])
    assert.notEqual(
      compileRuntimeActivationRecordCandidate(record(overrides)).recordHash,
      baseline,
    );
});

test("初版と後続版、activeとdisabledの状態境界を固定する", () => {
  assert.equal(
    compileRuntimeActivationRecordCandidate(
      record({
        activationRevision: 2,
        previousActivationHash: "a".repeat(64),
      }),
    ).status,
    "candidate",
  );
  assert.equal(
    compileRuntimeActivationRecordCandidate(
      record({
        activationRevision: 2,
        previousActivationHash: null,
      }),
    ).status,
    "blocked",
  );
  assert.equal(
    compileRuntimeActivationRecordCandidate(
      record({
        previousActivationHash: "a".repeat(64),
      }),
    ).status,
    "blocked",
  );
  assert.equal(
    compileRuntimeActivationRecordCandidate(
      record({
        status: "disabled",
        disabledAt: "2026-08-11T01:00:00.000Z",
      }),
    ).status,
    "candidate",
  );
  assert.equal(
    compileRuntimeActivationRecordCandidate(
      record({
        status: "disabled",
        disabledAt: null,
      }),
    ).status,
    "blocked",
  );
  assert.equal(
    compileRuntimeActivationRecordCandidate(
      record({
        status: "active",
        disabledAt: "2026-08-11T01:00:00.000Z",
      }),
    ).status,
    "blocked",
  );
});

test("非canonical時刻、余分／欠落field、accessorおよびProxyを拒否する", () => {
  for (const value of [
    record({ contractRevision: 1 }),
    record({ activatedAt: "2026-08-11T00:00:00.00Z" }),
    record({ activatedAt: "2026-08-11T00:00:00.0000Z" }),
    record({ activatedAt: "x".repeat(1_000_000) }),
    record({ activatedAt: "2026-08-11T09:00:00+09:00" }),
    record({ activatedAt: "2026-08-11" }),
    record({ activatedAt: "2026-02-30T00:00:00.000Z" }),
    record({ activatedAt: 0 }),
    record({ status: "disabled", disabledAt: "x".repeat(1_000_000) }),
    { ...record(), extra: true },
    (() => {
      const value = record();
      Reflect.deleteProperty(value, "registryHash");
      return value;
    })(),
  ])
    assert.equal(
      compileRuntimeActivationRecordCandidate(value).status,
      "blocked",
    );

  let getterCalls = 0;
  const accessor = record();
  Object.defineProperty(accessor, "bundleId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "AUTHBUNDLE-000001";
    },
  });
  assert.equal(
    compileRuntimeActivationRecordCandidate(accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const raw = record();
  const proxied = new Proxy(raw, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(raw);
    },
  });
  assert.equal(
    compileRuntimeActivationRecordCandidate(proxied).status,
    "blocked",
  );
  assert.equal(proxyCalls, 0);
});

test("byte decoderはBuffer、上限、strict UTF-8、BOMおよびcanonical完全一致を要求する", () => {
  const compiled = compileRuntimeActivationRecordCandidate(record());
  if (compiled.status !== "candidate") {
    assert.fail(`fixture activation did not compile: ${compiled.reason}`);
  }
  const bytes = compiled.canonicalBytes;
  assert.equal(
    decodeRuntimeActivationRecordCandidate(new Uint8Array(bytes)).reason,
    "runtime_activation_record_bytes_required",
  );
  assert.equal(
    decodeRuntimeActivationRecordCandidate(
      Buffer.alloc(RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes + 1, 0x20),
    ).reason,
    "runtime_activation_record_bytes_exceeded",
  );
  assert.equal(
    decodeRuntimeActivationRecordCandidate(
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]),
    ).reason,
    "runtime_activation_record_bytes_invalid",
  );
  assert.equal(
    decodeRuntimeActivationRecordCandidate(
      Buffer.concat([bytes, Buffer.from("\n")]),
    ).reason,
    "runtime_activation_record_bytes_noncanonical",
  );
  assert.equal(
    decodeRuntimeActivationRecordCandidate(Buffer.from([0xc3, 0x28])).reason,
    "runtime_activation_record_bytes_invalid",
  );
});

test("Activation contractは永続化、専用command、再activation、disable/delete分離を公開する", () => {
  const contract = describeRuntimeActivationContract();
  assert.equal(contract.contractRevision, 4);
  assert.equal(contract.persistence, "repository_scoped_persistent");
  assert.equal(contract.activationCommand, "dedicated_activate_required");
  assert.equal(contract.activationCommandGrammar, "implemented_candidate");
  assert.equal(
    contract.provisionCommandGrammar,
    "implemented_candidate_explicit_command_only",
  );
  assert.equal(
    contract.provisionCommandCurrentBehavior,
    "signed_distribution_effect_candidate_source_checkout_blocked_before_write",
  );
  assert.equal(contract.activationEffect, "not_implemented");
  assert.equal(
    contract.localOnboardingContract,
    "implemented_candidate_contract_only",
  );
  assert.equal(
    contract.onboardingPolicyDecision,
    "human_approved_contract_only",
  );
  assert.equal(contract.runtimeAuthorityConferredByOnboardingPolicy, false);
  assert.equal(
    contract.platformProvisionerDistributionTarget,
    "official_signed_platform_provisioner_distributed_with_coordinator_target",
  );
  assert.equal(
    contract.platformProvisioningScope,
    "platform_scope_once_while_verified_provisioning_identity_valid_target",
  );
  assert.deepEqual(contract.windowsV1RuntimePrincipalModes, [
    "local_interactive_selected_user",
  ]);
  assert.deepEqual(contract.futureBlockedRuntimePrincipalModes, [
    "server_dedicated_service_account",
  ]);
  assert.equal(contract.runtimePrincipalModeIssued, false);
  assert.equal(contract.selectedUserBinding, "not_implemented_blocked");
  assert.deepEqual(contract.platformProvisionerPreActiveOneShotContract, {
    contract: "crdd-coordinator/pre-active-provisioning-one-shot",
    contractRevision: 5,
    command: "explicit_coordinator_provision_only",
    executionStrategy: "native_top_level_appcontainer_worker_observation",
    maximumObservationAttemptsPerInvocation: 1,
    maximumWorkerSpawnAttemptsPerInvocation: 1,
    initialTrustCeremony:
      "human_authenticated_officially_signed_release_native_top_level_required",
    nodePathLaunchMayEstablishVerifiedImage: false,
    normalRuntimeAdapterInvocation: false,
    doctorInvocation: false,
    activateOrDisableInvocation: false,
    sourceCheckoutInvocation: false,
    pathCargoShellOrInstallerFallback: false,
    automaticRetryOrRestart: false,
    nativeSupervisor:
      "entrypoint_and_selected_user_binding_implemented_formal_evidence_pending",
    releaseOwnedOpaqueExecutionBinding:
      "trusted_os_authenticated_local_user_and_human_verified_release_prerequisite",
    verifiedImageHandleBinding:
      "not_required_by_coordinator_runtime_1_0_minimum_trust_boundary",
    workerBoundedProcess:
      "atomic_single_process_job_assignment_implemented_candidate",
    workerProcessTreeTermination: "required_before_candidate_forwarding",
    runtimeEnvironment:
      "os_known_folder_local_app_data_only_without_parent_environment_inheritance",
    lowBoxConsolePrerequisite:
      "current_user_temporary_one_shot_registry_effect_only_when_not_already_enabled",
    registrySerialization: "fixed_current_user_named_mutex",
    registryRecoveryRecord:
      "durable_before_effect_and_removed_only_after_verified_restore",
    registryRestoration:
      "exact_pre_state_last_write_comparison_and_read_back_before_candidate_forwarding",
    staleOrAmbiguousRegistryRecovery:
      "manual_recovery_required_fail_closed_without_overwrite",
    normalOperationRegistryMutation: false,
    networkEnforcement: "not_implemented_blocked",
    currentProcessEffectIssued: false,
    currentHelperProcessSpawned: false,
    currentProcessTreeTerminationConfirmed: false,
    currentManualRecoveryRequired: false,
    resultAuthority:
      "supervisor_selected_user_and_worker_token_user_match_candidate_formal_evidence_pending",
    selectedUserBindingVerified: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.equal(
    contract.authorityRootPathReuseTarget,
    "explicit_path_resolved_from_verified_provisioning_record_target",
  );
  assert.deepEqual(contract.authorityRootLocator, {
    contract: "crdd-coordinator/authority-root-locator",
    contractRevision: 1,
    fixedRepositoryRelativeFile: ".crdd-runtime/authority-root-locator.json",
    runtimeRootOverrideChangesLocatorLocation: false,
    locatorCore: "implemented_candidate",
    trustLevel: "untrusted_discovery_hint",
    containsAbsolutePath: true,
    containsCredentials: false,
    canonicalBytesExposed: false,
    filesystemRead: "implemented_candidate",
    filesystemWrite: "implemented_candidate_initial_only",
    atomicPersistence: "implemented_candidate_explicit_recovery",
    resolver: "implemented_candidate_root_object_only",
    provisioningRecordVerification:
      "implemented_candidate_persisted_trust_and_binding",
    authorityRootIdentityVerification:
      "not_implemented_windows_effective_access_observation_required",
    observedProvisioningRecordBinding:
      "not_implemented_windows_effective_access_observation_required",
    activationBindingComparisonCore: "implemented_candidate",
    activeActivationBinding: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.deepEqual(contract.activationLocatorBinding, {
    core: "implemented_candidate_initial_only",
    supportedTransition: "initial_null_to_active",
    pairBindingFields: [
      "repositoryIdentityHash",
      "runtimeRootIdentityHash",
      "activationId",
      "activationRevision",
      "activationRecordHash",
    ],
    provisioningRecordVerification: "not_implemented",
    filesystemCurrentRecordRead: "not_implemented",
    activeActivationBinding: "not_implemented",
    atomicUpdatePolicy: "approved_candidate_contract_only",
    atomicPersistence: "not_implemented",
    crashRecovery: "not_implemented",
    disableLocatorHandling: "not_implemented",
    reactivationLocatorHandling: "not_implemented",
    automaticRepair: false,
    mismatchBehavior: "fail_closed_and_reprovision_required",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.equal(
    contract.activationLocatorBinding.pairBindingFields,
    RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS,
  );
  assert.equal(
    contract.onboardingBlockingDependencies.includes(
      "authority_root_resolution_from_provisioning_record",
    ),
    true,
  );
  assert.equal(
    contract.onboardingBlockingDependencies.includes(
      "activation_atomic_persistence",
    ),
    true,
  );
  assert.deepEqual(contract.provisioningRecordTrustAndSelectionPolicy, {
    policy: "human_approved_candidate_contract_only",
    authorityRole:
      "platform_scope_signed_runtime_authority_source_of_truth_target",
    artifactTopology:
      "provisioning_record_central_without_separate_receipt_or_helper_manifest_authority",
    provisionReceiptRelationship:
      "not_separate_runtime_authority_artifact_target",
    platformProvisionerManifestRelationship:
      "not_separate_runtime_authority_artifact_target",
    authorityFileBundleManifestRelationship: "separate_existing_artifact",
    signedContentCoverage:
      "all_security_important_fields_one_canonical_json_signed_target",
    signedIdentityCoverage:
      "provisioner_identity_and_signature_metadata_bound_to_record_target",
    trustAnchorOwnership:
      "qual_lab_public_key_set_bundled_with_coordinator_target",
    trustAnchorLifecycle:
      "multiple_key_ids_overlap_rotation_and_explicit_revocation_required_target",
    storageScope:
      "shared_authority_platform_scope_provisioner_write_runtime_read_only_target",
    repositoryCanonicalRecordStored: false,
    locatorRelationship: "untrusted_provisioning_record_hash_reference_only",
    firstSetupOrReconfigurationSelection: "explicit_cli_target",
    routineRunSelection: "verified_provisioning_record_and_locator_target",
    environmentSelection:
      "explicit_compatibility_or_automation_override_target",
    selectionFailureBehavior:
      "blocked_without_silent_fallback_and_reprovision_required",
    automaticRepair: false,
    signaturePrimitives: {
      contract: "crdd-coordinator/provisioning-signature-primitives",
      contractRevision: 1,
      jcsValueCanonicalization: "implemented_candidate_rfc_8785",
      rawJsonDuplicateKeyDecoder: "not_implemented",
      ed25519SpkiDerInspection: "implemented_candidate_rfc_8410",
      p256SpkiDerInspection: "implemented_candidate_sec1_rfc_5480",
      spkiSha256Digest: "implemented_candidate_not_key_id_encoding",
      ed25519PrimitiveVerification: "implemented_candidate_rfc_8032",
      ed25519SignatureBase64url: "implemented_candidate_rfc_4648_unpadded",
      p256PrimitiveVerification:
        "implemented_candidate_ecdsa_sha256_ieee_p1363",
      p256SignatureBase64url:
        "implemented_candidate_low_s_ieee_p1363_rfc_4648_unpadded",
      keyIdEncoding: "implemented_candidate_in_provisioning_record_pure_core",
      payloadSignatureEnvelopeTopology:
        "payload_and_multiple_signatures_separated_target",
      crddDomainSeparationFraming:
        "implemented_candidate_in_provisioning_record_pure_core",
      provisioningRecordPayloadSchema:
        "implemented_candidate_in_provisioning_record_pure_core",
      multiSignatureEnvelopeSchema:
        "implemented_candidate_in_provisioning_record_pure_core",
      multiSignatureAcceptanceRule:
        "implemented_candidate_in_provisioning_record_pure_core",
      multiSignatureAcceptancePolicy:
        "one_or_more_trusted_non_revoked_valid_and_no_unknown_revoked_duplicate_or_invalid_target",
      offlineBundledTrustEvaluation: "required_target_not_implemented",
      embeddedTrustAnchorSet:
        "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
      revocationManifest:
        "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
      aggregateRecordVerifier:
        "candidate_cryptographic_condition_only_in_provisioning_record_pure_core",
      existingCanonicalContractsMigratedToJcs: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    },
    recordPureCore: {
      contractRevision: 1,
      recordContract: "crdd-coordinator/provisioning-record",
      envelopeContract: "crdd-coordinator/provisioning-record-envelope",
      trustAnchorSetContract: "crdd-coordinator/provisioning-trust-anchor-set",
      revocationManifestContract:
        "crdd-coordinator/provisioning-revocation-manifest",
      domainFraming:
        "implemented_candidate_fixed_prefix_uint64be_length_jcs_payload",
      keyIdEncoding: "implemented_candidate_spki_der_sha256_lowercase_hex_64",
      recordPayloadCodec: "implemented_candidate",
      multiSignatureEnvelopeCodec: "implemented_candidate",
      trustAnchorSetCodec: "implemented_candidate_untrusted_input",
      revocationManifestCodec: "implemented_candidate_untrusted_input",
      aggregateCryptographicCondition:
        "implemented_candidate_fail_closed_all_entries",
      authorityRootBindingVerification: "implemented_candidate",
      recordSignatureAlgorithm: "ECDSA-P256-SHA256",
      recordSignatureEncoding: "low-S-IEEE-P1363-64-byte-unpadded-base64url",
      runtimeOwnedBundledTrustSelection: "not_implemented",
      rollbackResistantTrustFloor: "not_implemented",
      filesystemRead: "not_implemented",
      lifecyclePersistence: "not_implemented",
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    },
    signatureEnvelopeTopology:
      "payload_and_multiple_signatures_separated_target",
    signatureEncoding:
      "implemented_candidate_low_s_ieee_p1363_rfc_4648_unpadded",
    keyIdEncoding: "implemented_candidate_spki_der_sha256_lowercase_hex_64",
    multiSignatureAcceptancePolicy:
      "one_or_more_trusted_non_revoked_valid_and_no_unknown_revoked_duplicate_or_invalid_target",
    offlineBundledTrustEvaluation: "required_target_not_implemented",
    recordSchemaCodec: "implemented_candidate",
    signatureVerifier: "implemented_candidate_fail_closed_all_entries",
    embeddedTrustAnchorSet: "implemented_candidate_runtime_clock_non_authority",
    revocationEvaluator: "implemented_candidate_runtime_clock_non_authority",
    filesystemRead: "implemented_candidate",
    resolver: "implemented_candidate_persisted_trust_and_binding",
    lifecyclePersistence: "not_implemented",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.deepEqual(contract.installationKeyEnrollmentPolicy, {
    policy: "human_approved_candidate_contract_only",
    installationKeyAlgorithmTarget: "ECDSA_P256_SHA256_target",
    installationKeyGenerationTarget:
      "platform_scope_os_managed_key_storage_boundary_target",
    installationKeyBackendCandidates: [
      "os_keystore_candidate",
      "tpm_candidate",
      "secure_enclave_candidate",
    ],
    installationKeyBackendSelection:
      "platform_preferences_and_explicit_fallbacks_human_approved_adapter_verification_not_implemented",
    platformKeyStoragePolicies: {
      windows: {
        preferred: "cng_ksp_tpm_backed_target",
        explicitFallback: "software_ksp_target",
        silentFallback: false,
      },
      macos: {
        preferred: "keychain_secure_enclave_when_supported_target",
        explicitFallback: "keychain_software_backed_target",
        silentFallback: false,
      },
      linux: {
        preferred: "tpm_2_0_target",
        explicitFallback: "root_owned_software_keystore_target",
        silentFallback: false,
      },
    },
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
    initialOnlineEnrollmentPureCore: contract.initialEnrollmentPureCore,
    initialOnlineEnrollmentRuntimeState: contract.initialEnrollmentRuntimeState,
    platformKeyStoragePolicy: contract.platformKeyStoragePolicy,
    provisioningCaPureCore: contract.provisioningCaPureCore,
    offlineEnrollmentBundlePureCore: contract.offlineEnrollmentBundlePureCore,
    provisioningRecordEnrollmentBinding:
      contract.provisioningRecordEnrollmentBinding,
    enrollmentCertificateRenewal: contract.enrollmentCertificateRenewal,
    platformProvisionerTrustCore: contract.platformProvisionerTrustCore,
    platformProvisionerPackageGate: contract.platformProvisionerPackageGate,
    platformProvisionerPackageFilesystem:
      contract.platformProvisionerPackageFilesystem,
    platformProvisionerWindowsDacl: contract.platformProvisionerWindowsDacl,
    platformProvisionerReleaseTrust: contract.platformProvisionerReleaseTrust,
    platformProvisionerManifestLoader:
      contract.platformProvisionerManifestLoader,
    platformProvisionerPolicyIdentity:
      contract.platformProvisionerPolicyIdentity,
    platformProvisionerReleaseIdentity:
      contract.platformProvisionerReleaseIdentity,
    platformProvisionerActivePointer: contract.platformProvisionerActivePointer,
    platformProvisionerActivePointerStore:
      contract.platformProvisionerActivePointerStore,
    platformProvisionerEffectContract:
      contract.platformProvisionerEffectContract,
    platformProvisionerPreActiveOneShotContract:
      contract.platformProvisionerPreActiveOneShotContract,
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
    initialEnrollmentModes: [
      "explicit_online_initial_enrollment_target",
      "administrator_supplied_offline_enrollment_bundle_target",
    ],
    onlineEnrollmentRequiredInputs: [
      "one_time_challenge",
      "nonce",
      "platform_scope",
      "installation_public_key",
      "enrollment_request_binding",
    ],
    onlineChallengeValidityMinutes: 30,
    onlineChallengeBinding:
      "nonce_installation_public_key_platform_scope_and_enrollment_request_binding_target_challenge_payload_and_request_envelope_raw_bytes_implemented_candidate_transport_and_effect_not_implemented",
    onlineChallengeConsumption:
      "consumed_on_first_verification_attempt_whether_success_or_failure_and_never_reusable_target",
    onlineChallengeExpiryBehavior:
      "expired_challenge_blocked_and_fresh_challenge_required_without_offline_fallback_target",
    onlineProofOfPossession:
      "installation_private_key_signature_required_request_envelope_raw_bytes_implemented_candidate_transport_and_effect_not_implemented",
    offlineEnrollmentBundleRequiredContents: [
      "online_enrollment_challenge",
      "signed_enrollment_request",
      "enrollment_request_hash",
      "enrollment_certificate",
      "exact_online_and_offline_issuing_ca_chain",
      "revocation_snapshot",
      "bundle_expiry",
    ],
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
    installationKeyGeneration: "not_implemented",
    installationKeyProtectionVerification: "not_implemented",
    enrollmentCertificateContract: "not_implemented",
    enrollmentCertificateVerification: "not_implemented",
    provisioningCaTrustAndRevocationVerification: "not_implemented",
    initialEnrollmentExchange: "not_implemented",
    recordEnrollmentBindingVerification: "implemented_candidate",
    enrollmentCertificateWireCodec: "not_implemented",
    onlineEnrollmentProtocol: "not_implemented",
    offlineEnrollmentBundleContract: "implemented_candidate",
    offlineEnrollmentBundleImport: "not_implemented",
    platformKeyStorageAdapterVerification: "not_implemented",
    enrollmentReplayProtectionPersistence: "not_implemented",
    automaticEnrollmentRenewalEffect: "not_implemented",
    implementationDependencyRelationships: {
      initialEnrollmentChallengeObjectContractAndDomainFraming:
        "provisioning_record_contract",
      initialEnrollmentRequestObjectContractAndDomainFraming:
        "provisioning_record_contract",
      initialEnrollmentCertificateObjectContractAndDomainFraming:
        "provisioning_record_contract",
      initialEnrollmentChallengeRawPayloadByteDecoder:
        "provisioning_record_contract",
      initialEnrollmentRequestRawPayloadByteDecoder:
        "provisioning_record_contract",
      initialEnrollmentCertificateRawPayloadByteDecoder:
        "provisioning_record_contract",
      initialEnrollmentRequestSignatureEnvelopeObjectContract:
        "provisioning_record_contract",
      initialEnrollmentCertificateSignatureEnvelopeObjectContract:
        "provisioning_record_contract",
      initialEnrollmentRequestRawEnvelopeByteDecoder:
        "provisioning_record_contract",
      initialEnrollmentCertificateRawEnvelopeByteDecoder:
        "provisioning_record_contract",
      initialEnrollmentTransportCodec: "provisioning_record_contract",
      initialEnrollmentRequestProofVerification:
        "provisioning_record_verification",
      initialEnrollmentCertificateSignatureVerification:
        "provisioning_record_verification",
      initialEnrollmentFlowBindingVerification:
        "provisioning_record_verification",
      initialEnrollmentRuntimeClock: "provisioning_record_verification",
      initialEnrollmentAttemptConsumption: "provisioning_record_verification",
      platformKeyStoragePolicy: "provisioning_record_contract",
      provisioningCaPureCoreContract: "provisioning_record_contract",
      provisioningCaPureCoreVerification: "provisioning_record_verification",
      offlineEnrollmentBundlePureCoreContract: "provisioning_record_contract",
      offlineEnrollmentBundlePureCoreVerification:
        "provisioning_record_verification",
      provisioningRecordEnrollmentBindingContract:
        "provisioning_record_contract",
      enrollmentCertificateRenewalContract: "provisioning_record_contract",
      enrollmentCertificateRenewalVerification:
        "provisioning_record_verification",
      platformProvisionerManifestVerification:
        "platform_provisioner_verification",
      platformProvisionerManifestLoader: "platform_provisioner_verification",
      platformProvisionerPolicyIdentity: "platform_provisioner_verification",
      platformProvisionerReleaseIdentity: "platform_provisioner_verification",
      platformProvisionerActivePointerCodec:
        "platform_provisioner_verification",
      platformProvisionerActivePointerRuntimeRead:
        "platform_provisioner_verification",
      platformProvisionerActivePointerPersistence:
        "platform_provisioner_effect",
      platformProvisionerCrddDistributionVerification:
        "platform_provisioner_verification",
      platformProvisionerPackageGateObservation:
        "platform_provisioner_verification",
      platformProvisionerPackageFilesystemVerification:
        "platform_provisioner_verification",
      platformProvisionerWindowsDaclVerification:
        "platform_provisioner_verification",
      installationKeyGeneration: "platform_provisioner_effect",
      initialProvisioningEnrollmentExchange: "platform_provisioner_effect",
      onlineEnrollmentProtocol: "platform_provisioner_effect",
      offlineEnrollmentBundleImport: "platform_provisioner_effect",
      automaticEnrollmentRenewalEffect: "platform_provisioner_effect",
      provisioningEnrollmentCertificateContract: "provisioning_record_contract",
      enrollmentCertificateWireCodec: "provisioning_record_contract",
      offlineEnrollmentBundleContract: "provisioning_record_contract",
      installationKeyProtectionVerification: "provisioning_record_verification",
      provisioningEnrollmentCertificateVerification:
        "provisioning_record_verification",
      provisioningCaTrustAndRevocationVerification:
        "provisioning_record_verification",
      recordEnrollmentBindingVerification: "provisioning_record_verification",
      platformKeyStorageAdapterVerification: "provisioning_record_verification",
      enrollmentReplayProtectionPersistence: "provisioning_record_verification",
    },
    enrollmentReadiness: "blocked",
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.equal(
    Object.isFrozen(contract.provisioningRecordTrustAndSelectionPolicy),
    true,
  );
  assert.equal(Object.isFrozen(contract.installationKeyEnrollmentPolicy), true);
  assert.deepEqual(contract.provisioningStorageAndLifecyclePolicy, {
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
    filesystemRead: "implemented_candidate",
    filesystemWrite: "implemented_candidate",
    authorityRecordCurrentPointerContract:
      "crdd-coordinator/provisioning-record-current-pointer",
    authorityRecordCurrentPointerPersistence: "implemented_candidate",
    trustFloorPersistence: "implemented_candidate",
    trustArtifactPersistence: "implemented_candidate",
    trustArtifactFloorBinding: "implemented_candidate",
    repositoryGenerationPersistence: "not_implemented",
    recoveryJournalPersistence: "not_implemented",
    atomicPersistence: "not_implemented",
    crashRecovery: "not_implemented",
    implementationDependencyRelationships: {
      provisioningRecordFilesystemWrite: "platform_provisioner_effect",
      provisioningRecordCurrentPointerPersistence:
        "platform_provisioner_effect",
      provisioningRecordCurrentPointerContract: "provisioning_record_contract",
      provisioningTrustFloorPersistence: "provisioning_record_verification",
      provisioningTrustArtifactPersistence: "platform_provisioner_effect",
      provisioningTrustArtifactFloorBinding: "provisioning_record_verification",
      repositoryGenerationPersistence: "activation_atomic_persistence",
      recoveryJournalPersistence: "activation_atomic_persistence",
    },
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.equal(
    Object.isFrozen(contract.provisioningStorageAndLifecyclePolicy),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.provisioningStorageAndLifecyclePolicy
        .implementationDependencyRelationships,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.installationKeyEnrollmentPolicy.initialEnrollmentModes,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.installationKeyEnrollmentPolicy.installationKeyBackendCandidates,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.installationKeyEnrollmentPolicy.platformKeyStoragePolicies,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.installationKeyEnrollmentPolicy.platformKeyStoragePolicies
        .windows,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.installationKeyEnrollmentPolicy.onlineEnrollmentRequiredInputs,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.installationKeyEnrollmentPolicy
        .offlineEnrollmentBundleRequiredContents,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      contract.installationKeyEnrollmentPolicy
        .implementationDependencyRelationships,
    ),
    true,
  );
  assert.deepEqual(
    contract.provisioningSignaturePrimitives,
    contract.provisioningRecordTrustAndSelectionPolicy.signaturePrimitives,
  );
  assert.equal(
    contract.provisioningRecordRole,
    "platform_scope_signed_runtime_authority_source_of_truth_target",
  );
  assert.equal(
    contract.provisionReceiptRelationship,
    "not_separate_runtime_authority_artifact_target",
  );
  assert.equal(
    contract.platformProvisionerManifestRelationship,
    "not_separate_runtime_authority_artifact_target",
  );
  assert.equal(
    contract.authorityFileBundleManifestRelationship,
    "separate_existing_artifact",
  );
  assert.equal(
    contract.authorityRootCurrentSelectionContract,
    "cli_then_environment_explicit_path_until_verified_record_resolver_implemented",
  );
  assert.equal(contract.runRevalidationRequired, true);
  assert.equal(
    contract.onboardingReadyRule,
    "all_implementation_dependencies_and_current_run_evidence_confirmed",
  );
  assert.deepEqual(contract.onboardingCurrentRunEvidenceRequirements, [
    "verified_current_provisioning_record_and_platform_provisioner_trust_identity",
    "explicit_authority_root_path_resolved_from_verified_provisioning_record",
    "authority_root_identity_and_provisioner_only_writer_runtime_read_only_protection",
    "repository_runtime_root_identity_protection_and_selected_principal_binding",
    "persistent_active_activation_record_identity_and_repository_binding",
    "platform_provisioner_signature_trust_principal_root_and_protection_metadata_unchanged",
  ]);
  assert.equal(contract.onboardingReadyTransition, "not_implemented");
  assert.equal(
    contract.onboardingReadinessProjection,
    "implemented_candidate_contract_only",
  );
  assert.deepEqual(contract.requiredProvisioningTargetKinds, [
    "shared_authority_root_platform_scope",
    "repository_scoped_runtime_root_activation_precondition",
  ]);
  assert.equal(contract.onboardingReadiness, "blocked");
  assert.deepEqual(contract.onboardingBlockingDependencies, [
    "platform_provisioner_verification",
    "platform_provisioner_effect",
    "provisioning_record_contract",
    "provisioning_record_verification",
    "authority_root_resolution_from_provisioning_record",
    "root_protection_platform_adapters",
    "runtime_root_provisioning_effect",
    "authority_root_provisioning_effect",
    "activation_effect",
    "activation_path_identity_binding",
    "activation_atomic_persistence",
    "run_scoped_capability",
  ]);
  assert.equal(
    new Set(contract.onboardingBlockingDependencies).size,
    contract.onboardingBlockingDependencies.length,
  );
  assert.equal(
    contract.disabledRepositoryExperience,
    "no_runtime_specific_effect",
  );
  assert.equal(
    contract.firstPlatformSetup,
    "verify_signed_platform_provisioner_and_provision_shared_authority_root_target",
  );
  assert.equal(
    contract.authorityProvisioningScope,
    "shared_platform_scope_reusable_across_repositories_target",
  );
  assert.equal(
    contract.repositoryActivationEntry,
    "single_coordinator_activate_command_target",
  );
  assert.equal(
    contract.runtimeRootProvisioningEffectOwner,
    "dedicated_platform_provisioner_target",
  );
  assert.equal(
    contract.normalRunAdministratorElevation,
    "not_required_after_verified_provision_and_activation_target",
  );
  assert.equal(
    contract.normalRunPathInput,
    "not_required_after_verified_provision_and_activation_target",
  );
  assert.equal(
    contract.normalRunManualAclConfiguration,
    "not_required_after_verified_provision_and_activation_target",
  );
  assert.equal(
    contract.restartPrompt,
    "not_required_when_protection_identity_and_activation_are_valid_target",
  );
  assert.equal(
    contract.protectionChangeBehavior,
    "fail_closed_reverification_then_reprovision_on_confirmed_condition",
  );
  assert.deepEqual(contract.reverificationTriggers, [
    "platform_provisioner_or_signature_or_trust_change",
    "runtime_or_provisioner_principal_change",
    "root_identity_or_protection_metadata_change",
  ]);
  assert.deepEqual(contract.reprovisionConditions, [
    "required_root_missing_or_replaced",
    "required_writer_or_runtime_read_only_protection_mismatch",
    "verified_provisioning_record_authority_root_identity_mismatch",
  ]);
  assert.equal(contract.platformProvisionerVerification, "not_implemented");
  assert.equal(
    contract.platformProvisionerTrustCore.manifestCryptographicVerification,
    "implemented_candidate",
  );
  assert.equal(
    contract.platformProvisionerTrustCore.distributionModel,
    "crdd_bundled_private_typescript_package",
  );
  assert.equal(
    contract.platformProvisionerTrustCore.osNativeCodeSignatureDecision,
    "signed_release_manifest_is_required_authenticode_is_optional_fixed_publisher_defense",
  );
  assert.equal(
    contract.platformProvisionerPackageGate.observationContract,
    "implemented_candidate_non_authoritative",
  );
  assert.equal(
    contract.platformProvisionerPackageGate.effectAuthorizationIssued,
    false,
  );
  assert.equal(
    contract.platformProvisionerPackageFilesystem
      .runtimeOwnedPackageFilesystemRead,
    "implemented_candidate_without_permission_authority",
  );
  assert.equal(
    contract.platformProvisionerPackageFilesystem
      .ownerAndPermissionPolicyVerification,
    "posix_implemented_candidate_windows_effective_access_not_implemented",
  );
  assert.equal(
    contract.platformProvisionerWindowsDacl.verification,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.platformProvisionerWindowsDacl.runtimeReadBinding,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.platformProvisionerWindowsDacl.permissionMutation,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.platformProvisionerInstallLayout.sourceOwnership,
    "repository_owned_typescript_and_contract_tests",
  );
  assert.equal(
    contract.platformProvisionerInstallLayout.filesystemEffect,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.platformProvisionerReleaseTrust.publicKeySpkiSha256,
    "6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f",
  );
  assert.equal(
    contract.platformProvisionerReleaseTrust.callerKeyMayReplaceTrustAnchor,
    false,
  );
  assert.equal(
    contract.platformProvisionerEffect,
    "not_implemented_effective_access_required",
  );
  assert.equal(contract.installationKeyGeneration, "not_implemented");
  assert.equal(
    contract.installationKeyProtectionVerification,
    "not_implemented",
  );
  assert.equal(
    contract.provisioningEnrollmentCertificateContract,
    "not_implemented",
  );
  assert.equal(
    contract.provisioningEnrollmentCertificateVerification,
    "not_implemented",
  );
  assert.equal(
    contract.provisioningCaTrustAndRevocationVerification,
    "not_implemented",
  );
  assert.equal(
    contract.initialProvisioningEnrollmentExchange,
    "not_implemented",
  );
  assert.equal(
    contract.recordEnrollmentBindingVerification,
    "implemented_candidate",
  );
  assert.equal(contract.enrollmentCertificateWireCodec, "not_implemented");
  assert.equal(contract.onlineEnrollmentProtocol, "not_implemented");
  assert.equal(
    contract.offlineEnrollmentBundleContract,
    "implemented_candidate",
  );
  assert.equal(contract.offlineEnrollmentBundleImport, "not_implemented");
  assert.equal(
    contract.platformKeyStorageAdapterVerification,
    "not_implemented",
  );
  assert.equal(
    contract.enrollmentReplayProtectionPersistence,
    "not_implemented",
  );
  assert.equal(contract.automaticEnrollmentRenewalEffect, "not_implemented");
  assert.equal(contract.provisioningRecordContract, "not_implemented");
  assert.equal(contract.provisioningRecordVerification, "not_implemented");
  assert.equal(
    contract.provisioningRecordAuthorityRootBindingVerification,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningRecordTrustAnchorSet,
    "implemented_candidate_runtime_clock_non_authority",
  );
  assert.equal(
    contract.provisioningRecordRevocationEvaluation,
    "implemented_candidate_runtime_clock_non_authority",
  );
  assert.equal(
    contract.provisioningRecordFilesystemRead,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningRecordLifecyclePersistence,
    "not_implemented",
  );
  assert.equal(
    contract.provisioningRecordFilesystemWrite,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningRecordCurrentPointerContract,
    "crdd-coordinator/provisioning-record-current-pointer",
  );
  assert.equal(
    contract.provisioningRecordCurrentPointerPersistence,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningRecordStore.recovery,
    "implemented_candidate_explicit_only",
  );
  assert.equal(
    contract.provisioningTrustFloorPersistence,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningTrustFloorTransition,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningTrustArtifactPersistence,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningTrustArtifactFloorBinding,
    "implemented_candidate",
  );
  assert.equal(
    contract.provisioningTrustArtifactStore.repositoryCanonicalTrustStored,
    false,
  );
  assert.equal(
    contract.provisioningTrustFloor.sameEpochPolicy,
    "exact_trust_anchor_set_hash_required",
  );
  assert.equal(
    contract.provisioningTrustFloorStore.recovery,
    "explicit_monotonic_pending_recovery",
  );
  assert.equal(contract.repositoryGenerationPersistence, "not_implemented");
  assert.equal(contract.recoveryJournalPersistence, "not_implemented");
  assert.equal(["provision", "ReceiptContract"].join("") in contract, false);
  assert.equal(
    ["provision", "ReceiptVerification"].join("") in contract,
    false,
  );
  assert.equal(
    contract.provisioningRecordTrustAndSelectionPolicy.recordSchemaCodec,
    contract.provisioningRecordPureCore.recordPayloadCodec,
  );
  assert.equal(
    contract.provisioningRecordTrustAndSelectionPolicy.signatureVerifier,
    contract.provisioningRecordPureCore.aggregateCryptographicCondition,
  );
  assert.equal(
    contract.provisioningRecordTrustAndSelectionPolicy.embeddedTrustAnchorSet,
    contract.provisioningRecordTrustAnchorSet,
  );
  assert.equal(
    contract.provisioningRecordTrustAndSelectionPolicy.revocationEvaluator,
    contract.provisioningRecordRevocationEvaluation,
  );
  assert.equal(
    contract.provisioningRecordTrustAndSelectionPolicy.filesystemRead,
    contract.provisioningRecordFilesystemRead,
  );
  assert.equal(
    contract.provisioningRecordTrustAndSelectionPolicy.lifecyclePersistence,
    contract.provisioningRecordLifecyclePersistence,
  );
  assert.equal(
    contract.authorityRootResolutionFromProvisioningRecord,
    "implemented_candidate_persisted_trust_and_binding",
  );
  assert.equal(contract.authorityRootExplicitPathContractPreserved, true);
  assert.equal(contract.runtimeRootProvisioningEffect, "not_implemented");
  assert.equal(contract.authorityRootProvisioningEffect, "not_implemented");
  assert.equal(contract.disableCommandGrammar, "implemented_candidate");
  assert.equal(
    contract.provisionEffect,
    "not_implemented_effective_access_required",
  );
  assert.equal(contract.disableEffect, "not_implemented");
  assert.equal(contract.doctorEnableIsActivation, false);
  assert.equal(contract.bundleIdentityChangeRequiresReactivation, true);
  assert.equal(contract.crossRecordTransitionCore, "implemented_candidate");
  assert.equal(
    contract.initialTransitionCore,
    "initial_null_to_active_candidate",
  );
  assert.equal(contract.disableTransitionCore, "active_to_disabled_candidate");
  assert.equal(contract.reactivationTransitionPolicy, "not_implemented");
  assert.equal(contract.disabledOriginTransitionPolicy, "not_implemented");
  assert.equal(
    contract.disableSemantics,
    "stop_new_operations_and_safely_cancel_in_flight",
  );
  assert.equal(contract.deleteIsSeparateOperation, true);
  assert.equal(
    contract.rootProtectionPolicy.protectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(
    contract.rootProtectionPolicy.runtimeRootProtection,
    "runtime_principal_only_read_write_and_no_other_writer",
  );
  assert.equal(
    contract.rootProtectionPolicy.authorityRootProtection,
    "provisioner_principal_only_write_runtime_read_only_and_no_other_writer",
  );
  assert.equal(
    contract.rootProtectionPolicy.writerExclusivityScope,
    "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
  );
  assert.deepEqual(
    contract.rootProtectionPolicy.trustedPlatformAdministratorBoundary,
    ["windows_system_and_machine_administrators", "posix_root"],
  );
  assert.equal(
    contract.rootProtectionPolicy.administratorOriginatedChangeDetection,
    "runtime_owned_revalidation_detects_observable_identity_protection_signature_trust_or_activation_change_and_fails_closed",
  );
  assert.equal(
    contract.rootProtectionPolicy
      .administratorOriginatedObservableChangeResponse,
    "blocked_reverification_then_reprovision_only_after_trust_base_confirmed",
  );
  assert.equal(
    contract.rootProtectionPolicy
      .confirmedOrSuspectedPlatformAdministratorCompromiseResponse,
    "blocked_platform_recovery_and_trust_base_reestablishment_required_before_reprovision",
  );
  assert.equal(
    contract.rootProtectionPolicy.ambiguousAdministratorChangeClassification,
    "fail_closed_as_suspected_compromise",
  );
  assert.equal(
    contract.rootProtectionPolicy.platformRecoveryImplementation,
    "not_implemented",
  );
  assert.equal(
    ["administrator", "CompromiseResponse"].join("") in
      contract.rootProtectionPolicy,
    false,
  );
  assert.equal(
    contract.rootProtectionPolicy.completeOsOrVerifierCompromiseProtection,
    "not_guaranteed",
  );
  assert.equal(
    contract.rootProtectionPolicy.protectionEffectOwner,
    "official_signed_platform_provisioner_only_target",
  );
  assert.equal(
    contract.rootProtectionPolicy.runtimePermissionMutation,
    "prohibited",
  );
  assert.deepEqual(contract.rootProtectionPolicy.windowsProtectionTarget, {
    runtimeRoot: "runtime_sid_read_write_target",
    authorityRoot:
      "provisioner_or_approved_admin_write_runtime_sid_read_only_target",
    inheritance: "disabled_target",
    untrustedBroadWriteAces: "rejected_target",
  });
  assert.deepEqual(contract.rootProtectionPolicy.posixProtectionTarget, {
    runtimeRoot: "runtime_uid_owner_mode_0700_target",
    authorityRoot:
      "provisioner_or_root_owner_runtime_read_traverse_explicit_acl_target",
    unapprovedGroupOrOtherWrite: "rejected_target",
  });
  assert.equal(
    contract.rootProtectionPolicy.persistentVolumeEligibility,
    "local_equivalent_stable_identity_durable_atomic_replace_and_equivalent_acl_required_target",
  );
  assert.equal(
    contract.rootProtectionPolicy.unsupportedVolumeBehavior,
    "network_removable_special_or_unknown_blocked_target",
  );
  assert.equal(
    contract.rootProtectionPolicy.windowsDaclAdapter,
    "not_implemented_observation_mapping_required",
  );
  assert.equal(
    contract.rootProtectionPolicy.posixOwnerModeAdapter,
    "not_implemented",
  );
  assert.equal(
    contract.rootProtectionPolicy.posixAclVerification,
    "not_implemented",
  );
  assert.equal(
    contract.rootProtectionPolicy.runtimePrincipalBinding,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.rootProtectionPolicy.persistentVolumeAdapter,
    "not_implemented",
  );
  assert.equal(
    contract.rootProtectionPolicy.filesystemClassVerification,
    "not_implemented",
  );
  assert.equal(
    contract.rootProtectionPolicy.pathBinding,
    "not_implemented_root_observation_adapter_required",
  );
  assert.equal(
    contract.rootProtectionPolicy.activationIntegration,
    "not_implemented",
  );
  assert.equal(
    contract.ownerAclVerification,
    "not_implemented_observation_mapping_required",
  );
  assert.equal(contract.atomicPersistence, "not_implemented");
  assert.equal(contract.canonicalUtcLength, 24);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
