import assert from "node:assert/strict";
import test from "node:test";

import {
  RUNTIME_ACTIVATION_CONTRACT,
  RUNTIME_ACTIVATION_INPUT_LIMITS,
  compileRuntimeActivationRecordCandidate,
  decodeRuntimeActivationRecordCandidate,
  describeRuntimeActivationContract
} from "../src/security/runtime-activation-record.mjs";

function record(overrides = {}) {
  return {
    contract: RUNTIME_ACTIVATION_CONTRACT,
    contractRevision: 1,
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
    ...overrides
  };
}

test("Activation recordはRepository、Root、Bundle、Policy、Registry Identityをcanonical byteへ結合する", () => {
  const compiled = compileRuntimeActivationRecordCandidate(record());
  assert.equal(compiled.status, "candidate");
  assert.match(compiled.recordHash, /^[a-f0-9]{64}$/u);
  assert.equal(compiled.runtimeCapabilityIssued, false);
  const decoded = decodeRuntimeActivationRecordCandidate(compiled.canonicalBytes);
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
    { registryHash: "8".repeat(64) }
  ]) assert.notEqual(compileRuntimeActivationRecordCandidate(record(overrides)).recordHash, baseline);
});

test("初版と後続版、activeとdisabledの状態境界を固定する", () => {
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    activationRevision: 2,
    previousActivationHash: "a".repeat(64)
  })).status, "candidate");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    activationRevision: 2,
    previousActivationHash: null
  })).status, "blocked");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    previousActivationHash: "a".repeat(64)
  })).status, "blocked");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    status: "disabled",
    disabledAt: "2026-08-11T01:00:00.000Z"
  })).status, "candidate");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    status: "disabled",
    disabledAt: null
  })).status, "blocked");
  assert.equal(compileRuntimeActivationRecordCandidate(record({
    status: "active",
    disabledAt: "2026-08-11T01:00:00.000Z"
  })).status, "blocked");
});

test("非canonical時刻、余分／欠落field、accessorおよびProxyを拒否する", () => {
  for (const value of [
    record({ activatedAt: "2026-08-11T00:00:00.00Z" }),
    record({ activatedAt: "2026-08-11T00:00:00.0000Z" }),
    record({ activatedAt: "x".repeat(1_000_000) }),
    record({ activatedAt: "2026-08-11T09:00:00+09:00" }),
    record({ activatedAt: "2026-08-11" }),
    record({ activatedAt: "2026-02-30T00:00:00.000Z" }),
    record({ activatedAt: 0 }),
    record({ status: "disabled", disabledAt: "x".repeat(1_000_000) }),
    { ...record(), extra: true },
    (() => { const value = record(); delete value.registryHash; return value; })()
  ]) assert.equal(compileRuntimeActivationRecordCandidate(value).status, "blocked");

  let getterCalls = 0;
  const accessor = record();
  Object.defineProperty(accessor, "bundleId", {
    enumerable: true,
    get() { getterCalls += 1; return "AUTHBUNDLE-000001"; }
  });
  assert.equal(compileRuntimeActivationRecordCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const raw = record();
  const proxied = new Proxy(raw, { ownKeys() { proxyCalls += 1; return Reflect.ownKeys(raw); } });
  assert.equal(compileRuntimeActivationRecordCandidate(proxied).status, "blocked");
  assert.equal(proxyCalls, 0);
});

test("byte decoderはBuffer、上限、strict UTF-8、BOMおよびcanonical完全一致を要求する", () => {
  const bytes = compileRuntimeActivationRecordCandidate(record()).canonicalBytes;
  assert.equal(decodeRuntimeActivationRecordCandidate(new Uint8Array(bytes)).reason,
    "runtime_activation_record_bytes_required");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.alloc(
    RUNTIME_ACTIVATION_INPUT_LIMITS.rawBytes + 1, 0x20
  )).reason, "runtime_activation_record_bytes_exceeded");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]), bytes
  ])).reason, "runtime_activation_record_bytes_invalid");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.concat([bytes, Buffer.from("\n")])).reason,
    "runtime_activation_record_bytes_noncanonical");
  assert.equal(decodeRuntimeActivationRecordCandidate(Buffer.from([0xc3, 0x28])).reason,
    "runtime_activation_record_bytes_invalid");
});

test("Activation contractは永続化、専用command、再activation、disable/delete分離を公開する", () => {
  const contract = describeRuntimeActivationContract();
  assert.equal(contract.persistence, "repository_scoped_persistent");
  assert.equal(contract.activationCommand, "dedicated_activate_required");
  assert.equal(contract.activationCommandGrammar, "implemented_candidate");
  assert.equal(contract.activationEffect, "not_implemented");
  assert.equal(contract.localOnboardingContract, "implemented_candidate_contract_only");
  assert.equal(contract.onboardingPolicyDecision, "human_approved_contract_only");
  assert.equal(contract.runtimeAuthorityConferredByOnboardingPolicy, false);
  assert.equal(contract.platformProvisionerDistributionTarget,
    "official_signed_platform_provisioner_distributed_with_coordinator_target");
  assert.equal(contract.platformProvisioningScope,
    "platform_scope_once_while_verified_provisioning_identity_valid_target");
  assert.deepEqual(contract.runtimePrincipalModes, [
    "local_interactive_selected_user",
    "server_dedicated_service_account"
  ]);
  assert.equal(contract.authorityRootPathReuseTarget,
    "explicit_path_resolved_from_verified_provisioning_record_target");
  assert.equal(contract.provisioningRecordRole,
    "future_verified_platform_setup_record_target");
  assert.equal(contract.provisionReceiptRelationship, "undecided");
  assert.equal(contract.platformProvisionerManifestRelationship, "undecided");
  assert.equal(contract.authorityFileBundleManifestRelationship,
    "separate_existing_artifact");
  assert.equal(contract.authorityRootCurrentSelectionContract,
    "cli_then_environment_explicit_path_until_verified_record_resolver_implemented");
  assert.equal(contract.runRevalidationRequired, true);
  assert.equal(contract.onboardingReadyRule,
    "all_implementation_dependencies_and_current_run_evidence_confirmed");
  assert.deepEqual(contract.onboardingCurrentRunEvidenceRequirements, [
    "verified_current_provisioning_record_and_platform_provisioner_trust_identity",
    "explicit_authority_root_path_resolved_from_verified_provisioning_record",
    "authority_root_identity_and_provisioner_only_writer_runtime_read_only_protection",
    "repository_runtime_root_identity_protection_and_selected_principal_binding",
    "persistent_active_activation_record_identity_and_repository_binding",
    "helper_signature_trust_principal_root_and_protection_metadata_unchanged"
  ]);
  assert.equal(contract.onboardingReadyTransition, "not_implemented");
  assert.equal(contract.onboardingReadinessProjection,
    "implemented_candidate_contract_only");
  assert.deepEqual(contract.requiredProvisioningTargetKinds, [
    "shared_authority_root_platform_scope",
    "repository_scoped_runtime_root_activation_precondition"
  ]);
  assert.equal(contract.onboardingReadiness, "blocked");
  assert.deepEqual(contract.onboardingBlockingDependencies, [
    "platform_provisioner_verification",
    "platform_provisioner_effect",
    "provision_receipt_contract",
    "provision_receipt_verification",
    "authority_root_resolution_from_provisioning_record",
    "root_protection_platform_adapters",
    "runtime_root_provisioning_effect",
    "authority_root_provisioning_effect",
    "activation_effect",
    "activation_path_identity_binding",
    "activation_atomic_persistence",
    "run_scoped_capability"
  ]);
  assert.equal(new Set(contract.onboardingBlockingDependencies).size,
    contract.onboardingBlockingDependencies.length);
  assert.equal(contract.disabledRepositoryExperience, "no_runtime_specific_effect");
  assert.equal(contract.firstPlatformSetup,
    "verify_signed_platform_provisioner_and_provision_shared_authority_root_target");
  assert.equal(contract.authorityProvisioningScope,
    "shared_platform_scope_reusable_across_repositories_target");
  assert.equal(contract.repositoryActivationEntry, "single_coordinator_activate_command_target");
  assert.equal(contract.runtimeRootProvisioningEffectOwner,
    "dedicated_platform_provisioner_target");
  assert.equal(contract.normalRunAdministratorElevation,
    "not_required_after_verified_provision_and_activation_target");
  assert.equal(contract.normalRunPathInput,
    "not_required_after_verified_provision_and_activation_target");
  assert.equal(contract.normalRunManualAclConfiguration,
    "not_required_after_verified_provision_and_activation_target");
  assert.equal(contract.restartPrompt,
    "not_required_when_protection_identity_and_activation_are_valid_target");
  assert.equal(contract.protectionChangeBehavior,
    "fail_closed_reverification_then_reprovision_on_confirmed_condition");
  assert.deepEqual(contract.reverificationTriggers, [
    "platform_provisioner_or_signature_or_trust_change",
    "runtime_or_provisioner_principal_change",
    "root_identity_or_protection_metadata_change"
  ]);
  assert.deepEqual(contract.reprovisionConditions, [
    "required_root_missing_or_replaced",
    "required_writer_or_runtime_read_only_protection_mismatch",
    "verified_provisioning_record_authority_root_identity_mismatch"
  ]);
  assert.equal(contract.platformProvisionerVerification, "not_implemented");
  assert.equal(contract.platformProvisionerEffect, "not_implemented");
  assert.equal(contract.provisionReceiptContract, "not_implemented");
  assert.equal(contract.provisionReceiptVerification, "not_implemented");
  assert.equal(contract.authorityRootResolutionFromProvisioningRecord, "not_implemented");
  assert.equal(contract.authorityRootExplicitPathContractPreserved, true);
  assert.equal(contract.runtimeRootProvisioningEffect, "not_implemented");
  assert.equal(contract.authorityRootProvisioningEffect, "not_implemented");
  assert.equal(contract.disableCommandGrammar, "implemented_candidate");
  assert.equal(contract.disableEffect, "not_implemented");
  assert.equal(contract.doctorEnableIsActivation, false);
  assert.equal(contract.bundleIdentityChangeRequiresReactivation, true);
  assert.equal(contract.crossRecordTransitionCore, "implemented_candidate");
  assert.equal(contract.initialTransitionCore, "initial_null_to_active_candidate");
  assert.equal(contract.disableTransitionCore, "active_to_disabled_candidate");
  assert.equal(contract.reactivationTransitionPolicy, "not_implemented");
  assert.equal(contract.disabledOriginTransitionPolicy, "not_implemented");
  assert.equal(contract.disableSemantics, "stop_new_operations_and_safely_cancel_in_flight");
  assert.equal(contract.deleteIsSeparateOperation, true);
  assert.equal(contract.rootProtectionPolicy.protectionPolicyCore,
    "implemented_candidate_claim_only");
  assert.equal(contract.rootProtectionPolicy.runtimeRootProtection,
    "runtime_principal_only_read_write_and_no_other_writer");
  assert.equal(contract.rootProtectionPolicy.authorityRootProtection,
    "provisioner_principal_only_write_runtime_read_only_and_no_other_writer");
  assert.equal(contract.rootProtectionPolicy.windowsDaclAdapter, "not_implemented");
  assert.equal(contract.rootProtectionPolicy.posixOwnerModeAdapter, "not_implemented");
  assert.equal(contract.rootProtectionPolicy.posixAclVerification, "not_implemented");
  assert.equal(contract.rootProtectionPolicy.runtimePrincipalBinding, "not_implemented");
  assert.equal(contract.rootProtectionPolicy.persistentVolumeAdapter, "not_implemented");
  assert.equal(contract.rootProtectionPolicy.filesystemClassVerification, "not_implemented");
  assert.equal(contract.rootProtectionPolicy.pathBinding, "not_implemented");
  assert.equal(contract.rootProtectionPolicy.activationIntegration, "not_implemented");
  assert.equal(contract.ownerAclVerification, "not_implemented");
  assert.equal(contract.atomicPersistence, "not_implemented");
  assert.equal(contract.canonicalUtcLength, 24);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
