import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import * as executionEnvironment from "../src/security/execution-environment.ts";
import * as hostRecoveryRecord from "../src/security/host-recovery-record.ts";

import {
  CHECK_STATUS,
  REQUIRED_CHECK_IDS,
  discoverCommand,
  evaluateReadiness,
  runDoctor,
} from "../src/core/doctor.ts";
import type { DiagnosticCheck } from "../src/core/doctor.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOperationDirectories,
  createOwnedOperationDirectories,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  verifyOwnedMountCapability,
} from "../src/security/execution-environment.ts";
import {
  classifyRecoveryChildren,
  dockerCreateArgumentsForFixture,
  evaluateDockerCliCandidateForFixture,
  normalizeContainerAbsence,
  normalizeContainerCreation,
  normalizeDockerIsolationResult,
  normalizeDockerProbeFailure,
  normalizeHostCleanupResult,
  recoverDockerIsolationProbe,
  validateContainerInspect,
} from "../src/security/docker-isolation.ts";
import { assertPresent, assertRecord, errorCode } from "./test-support.ts";

function recordedIdentity(target: string) {
  const metadata = fs.lstatSync(target, { bigint: true });
  return {
    dev: metadata.dev.toString(),
    ino: metadata.ino.toString(),
    birthtimeNs: metadata.birthtimeNs.toString(),
  };
}

function confirmedChecks(): DiagnosticCheck[] {
  return REQUIRED_CHECK_IDS.map((id) => ({
    id,
    status: "confirmed",
    reason: null,
    followUp: null,
  }));
}

test("Provider環境は通常HomeとCredential環境を継承しない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-env-test-"));
  try {
    const directories = createOperationDirectories(root);
    const environment = createProviderEnvironment(
      {
        PATH: "test-path",
        HOME: "/normal/home",
        USERPROFILE: "C:\\Users\\normal",
        OPENAI_API_KEY: "secret",
        ANTHROPIC_API_KEY: "secret",
        SSH_AUTH_SOCK: "agent",
      },
      directories,
    );
    assert.equal(environment.HOME, directories.providerHome);
    assert.equal(environment.USERPROFILE, directories.providerHome);
    assert.equal(environment.TEMP, directories.tmp);
    assert.deepEqual(credentialEnvironmentNamesPresent(environment), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ProviderはRuntime管理領域の書込み主体ではない", () => {
  const directories = {
    root: "/state/OP-1",
    providerHome: "/state/OP-1/provider-home",
    workspace: "/state/OP-1/workspace",
    tmp: "/state/OP-1/tmp",
    events: "/state/OP-1/events",
    projection: "/state/OP-1/projection",
    management: "/state/OP-1/management",
  };
  const policy = describeFilesystemPolicy(directories);
  assert.deepEqual(policy.coordinatorRuntime.write, [
    directories.events,
    directories.projection,
    directories.management,
  ]);
  assert.deepEqual(policy.providerProcess.write, [
    directories.workspace,
    directories.providerHome,
    directories.tmp,
  ]);
  assert.deepEqual(policy.providerProcess.deny, [
    directories.events,
    directories.projection,
    directories.management,
  ]);
  assert.equal(
    policy.credentialBroker.exposeCredentialStorePathToProvider,
    false,
  );
});

test("全必須checkがconfirmedの場合だけpure集約はReadyを返す", () => {
  assert.equal(evaluateReadiness(confirmedChecks()).status, "ready");
  for (const status of CHECK_STATUS.filter((value) => value !== "confirmed")) {
    const checks = confirmedChecks();
    const first = checks[0];
    assertPresent(first);
    checks[0] = { ...first, status, reason: `fixture_${status}` };
    assert.equal(evaluateReadiness(checks).status, "blocked");
  }
  for (const id of REQUIRED_CHECK_IDS) {
    const checks = confirmedChecks();
    const target = checks.find((item) => item.id === id);
    assertPresent(target);
    target.status = "unknown";
    target.reason = "fixture_unknown";
    assert.equal(evaluateReadiness(checks).status, "blocked", id);
  }
});

test("欠落、重複、未知および不正なcheckをfail closedにする", () => {
  const missing = confirmedChecks().slice(1);
  assert.equal(evaluateReadiness(missing).status, "blocked");
  const duplicateChecks = [...confirmedChecks(), confirmedChecks()[0]];
  assert.equal(evaluateReadiness(duplicateChecks).status, "blocked");
  const unknownChecks = [
    ...confirmedChecks(),
    { id: "unknown", status: "confirmed" },
  ];
  assert.equal(evaluateReadiness(unknownChecks).status, "blocked");
  const invalidChecks: unknown[] = confirmedChecks();
  invalidChecks[0] = {
    id: REQUIRED_CHECK_IDS[0],
    status: "pass",
    reason: null,
    followUp: null,
  };
  assert.equal(evaluateReadiness(invalidChecks).status, "blocked");
});

test("Providerごとの必須checkを片側だけ成立させてもReadyにならない", () => {
  const checks = confirmedChecks();
  const target = checks.find(
    (item) => item.id === "provider.claude.authentication",
  );
  assertPresent(target);
  target.status = "unknown";
  target.reason = "authentication_not_evaluated";
  const result = evaluateReadiness(checks);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.blockers.some((item) => item.id === target.id),
    true,
  );
});

test("passive discoveryはPATHをFilesystem APIで調べ絶対Pathを返さない", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-discovery-test-"),
  );
  try {
    fs.writeFileSync(path.join(root, "codex.cmd"), "not executed", "utf8");
    const result = discoverCommand("codex", {
      platform: "win32",
      environment: { PATH: root, PATHEXT: ".EXE;.CMD;.BAT" },
    });
    assert.equal(result.located, true);
    assert.equal(result.candidateCount, 1);
    assert.deepEqual(result.formats, ["cmd"]);
    assert.equal(JSON.stringify(result).includes(root), false);
    assert.equal("version" in result, false);
    assert.equal("path" in result, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("複数形式のProvider候補を実行せず集約する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-discovery-many-"),
  );
  try {
    fs.writeFileSync(path.join(root, "claude.exe"), "not executed", "utf8");
    fs.writeFileSync(path.join(root, "claude.bat"), "not executed", "utf8");
    const result = discoverCommand("claude", {
      platform: "win32",
      environment: { PATH: root, PATHEXT: ".EXE;.CMD;.BAT" },
    });
    assert.equal(result.candidateCount, 2);
    assert.deepEqual(result.formats, ["bat", "exe"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("owned childだけを削除しtemporary parentとsiblingを保持する", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-parent-test-"),
  );
  const sibling = path.join(parent, "keep.txt");
  fs.writeFileSync(sibling, "keep", "utf8");
  try {
    const owned = createOwnedOperationDirectories(parent);
    const root = owned.root;
    cleanupOwnedOperationDirectories(owned);
    assert.equal(fs.existsSync(root), false);
    assert.equal(fs.readFileSync(sibling, "utf8"), "keep");
    assert.equal(fs.existsSync(parent), true);
    assert.throws(
      () => cleanupOwnedOperationDirectories(owned),
      /identity_required/u,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("所有IdentityがないPathをcleanupしない", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-unowned-test-"),
  );
  const content = path.join(parent, "keep.txt");
  fs.writeFileSync(content, "keep", "utf8");
  try {
    assert.throws(() =>
      cleanupOwnedOperationDirectories({
        root: parent,
        parent: path.dirname(parent),
      }),
    );
    assert.equal(fs.readFileSync(content, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("正しいprefixを持つ既存directoryでも偽owned objectでは削除しない", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-fake-owner-"),
  );
  const target = fs.mkdtempSync(path.join(parent, "crdd-coordinator-doctor-"));
  const content = path.join(target, "keep.txt");
  fs.writeFileSync(content, "keep", "utf8");
  try {
    assert.throws(
      () => cleanupOwnedOperationDirectories({ root: target, parent }),
      /identity_required/u,
    );
    assert.equal(fs.readFileSync(content, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("owned objectのpublic Pathを書き換えても別directoryを削除しない", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-mutated-owner-"),
  );
  const other = path.join(parent, "other");
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, "keep.txt"), "keep", "utf8");
  try {
    const owned = createOwnedOperationDirectories(parent);
    owned.root = other;
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.readFileSync(path.join(other, "keep.txt"), "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("owned childを同名の別directoryへ置換してもreplacementを削除しない", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-replaced-owner-"),
  );
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-original`;
    fs.renameSync(owned.root, original);
    fs.mkdirSync(owned.root);
    const replacementContent = path.join(owned.root, "replacement.txt");
    const originalContent = path.join(original, "original.txt");
    fs.writeFileSync(replacementContent, "replacement", "utf8");
    fs.writeFileSync(originalContent, "original", "utf8");
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.readFileSync(replacementContent, "utf8"), "replacement");
    assert.equal(fs.readFileSync(originalContent, "utf8"), "original");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("owned childをjunctionへ置換した場合は対象を削除しない", (t) => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-linked-owner-"),
  );
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-original`;
    const target = path.join(parent, "junction-target");
    fs.renameSync(owned.root, original);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "keep.txt"), "keep", "utf8");
    try {
      fs.symlinkSync(
        target,
        owned.root,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = errorCode(error);
      if (code && ["EPERM", "EACCES", "ENOTSUP"].includes(code)) {
        t.skip(`link fixture unavailable: ${code}`);
        return;
      }
      throw error;
    }
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(
      fs.readFileSync(path.join(target, "keep.txt"), "utf8"),
      "keep",
    );
    assert.equal(fs.existsSync(original), true);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("production doctorはpassiveかつ未実装境界をReadyにしない", () => {
  const report = runDoctor();
  const serialized = JSON.stringify(report);
  assert.equal(report.diagnosticMode, "passive_preflight");
  assert.equal(report.status, "blocked");
  assert.equal("version" in report.providers.codex, false);
  assert.equal("path" in report.providers.codex, false);
  assert.equal(
    report.checks.some(
      (item) =>
        item.id === "execution.filesystem" && item.status === "not_implemented",
    ),
    true,
  );
  assert.equal(
    report.checks.some(
      (item) =>
        item.id === "execution.credential_isolation" &&
        item.status === "not_implemented",
    ),
    true,
  );
  assert.equal(
    report.checks.some(
      (item) =>
        item.id === "execution.egress" && item.status === "not_implemented",
    ),
    true,
  );
  assert.equal(
    report.checks.some(
      (item) =>
        item.id.endsWith(".active_probe") && item.status === "not_implemented",
    ),
    true,
  );
  assert.equal(report.runtimeRoot.defaultRepositoryDirectory, ".crdd-runtime");
  assert.equal(report.runtimeRoot.featureDefault, "disabled");
  assert.equal(
    report.runtimeRoot.cliOverrideIntegration,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeRoot.environmentOverrideIntegration,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeRoot.diagnosticRequestIntegration,
    "implemented_candidate",
  );
  assert.equal(report.runtimeRoot.explicitEnableRequired, true);
  assert.equal(report.runtimeRoot.directoryExistenceActivates, false);
  assert.equal(report.runtimeRoot.gitIgnoreIsSecurityBoundary, false);
  assert.equal(report.runtimeRoot.candidateRevisionIncludesRuntimeRoot, false);
  assert.equal(report.runtimeRoot.operationInputIncludesRuntimeRoot, false);
  assert.equal(report.runtimeRoot.providerMountAllowed, false);
  assert.equal(
    report.runtimeRoot.disableSemantics,
    "stop_new_operations_and_safely_cancel_in_flight",
  );
  assert.equal(report.runtimeRoot.disableImplementation, "not_implemented");
  assert.equal(report.runtimeRoot.disableDeletesStoredData, false);
  assert.equal(report.runtimeRoot.runtimeDataDeletion, "not_implemented");
  assert.equal(
    report.runtimeRoot.rootProtectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(report.runtimeRoot.runtimePathAdapter, "not_implemented");
  assert.equal(
    report.runtimeRoot.runtimePathObjectIdentityCore,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeRoot.activationRecordCore,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeRoot.activationRecordPersistence,
    "not_implemented",
  );
  assert.equal(report.runtimeRoot.runtimeCapabilityIssued, false);
  assert.equal(report.runtimeRootPathIdentity.existingRootRequired, true);
  assert.equal(report.runtimeRootPathIdentity.rootCreationIssued, false);
  assert.equal(
    report.runtimeRootPathIdentity.pathObjectIdentityVerification,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeRootPathIdentity.posixRuntimeRootPrecheckEntry,
    "implemented_fail_closed",
  );
  assert.equal(
    report.runtimeRootPathIdentity.posixRuntimeRootModeObservation,
    "not_implemented",
  );
  assert.equal(
    report.runtimeRootPathIdentity.filesystemClassVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeRootPathIdentity.posixAclVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeRootPathIdentity.ownerAclVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeRootPathIdentity.fullParentChainVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeRootPathIdentity.localExcludeIntegration,
    "implemented_candidate_initial_snapshot_binding",
  );
  assert.equal(
    report.runtimeRootPathIdentity.activationIntegration,
    "not_implemented",
  );
  assert.equal(report.runtimeRootPathIdentity.runtimeCapabilityIssued, false);
  assert.equal(
    report.runtimeActivation.persistence,
    "repository_scoped_persistent",
  );
  assert.equal(
    report.runtimeActivation.activationCommand,
    "dedicated_activate_required",
  );
  assert.equal(
    report.runtimeActivation.activationCommandGrammar,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeActivation.provisionCommandGrammar,
    "implemented_candidate_explicit_command_only",
  );
  assert.equal(
    report.runtimeActivation.provisionCommandCurrentBehavior,
    "dry_run_blocked_until_os_native_signature_release_trust_and_effect_implemented",
  );
  assert.equal(report.runtimeActivation.activationEffect, "not_implemented");
  assert.equal(
    report.runtimeActivation.localOnboardingContract,
    "implemented_candidate_contract_only",
  );
  assert.equal(
    report.runtimeActivation.onboardingPolicyDecision,
    "human_approved_contract_only",
  );
  assert.equal(
    report.runtimeActivation.runtimeAuthorityConferredByOnboardingPolicy,
    false,
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerDistributionTarget,
    "official_signed_platform_provisioner_distributed_with_coordinator_target",
  );
  assert.equal(
    report.runtimeActivation.platformProvisioningScope,
    "platform_scope_once_while_verified_provisioning_identity_valid_target",
  );
  assert.deepEqual(report.runtimeActivation.runtimePrincipalModes, [
    "local_interactive_selected_user",
    "server_dedicated_service_account",
  ]);
  assert.equal(
    report.runtimeActivation.authorityRootPathReuseTarget,
    "explicit_path_resolved_from_verified_provisioning_record_target",
  );
  assert.deepEqual(report.runtimeActivation.authorityRootLocator, {
    contract: "crdd-coordinator/authority-root-locator",
    contractRevision: 1,
    fixedRepositoryRelativeFile: ".crdd-runtime/authority-root-locator.json",
    runtimeRootOverrideChangesLocatorLocation: false,
    locatorCore: "implemented_candidate",
    trustLevel: "untrusted_discovery_hint",
    containsAbsolutePath: true,
    containsCredentials: false,
    canonicalBytesExposed: false,
    filesystemRead: "not_implemented",
    filesystemWrite: "not_implemented",
    atomicPersistence: "not_implemented",
    resolver: "not_implemented",
    provisioningRecordVerification: "not_implemented",
    authorityRootIdentityVerification: "not_implemented",
    activationBindingComparisonCore: "implemented_candidate",
    activeActivationBinding: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
  assert.deepEqual(report.runtimeActivation.activationLocatorBinding, {
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
    report.runtimeActivation.onboardingBlockingDependencies.includes(
      "authority_root_resolution_from_provisioning_record",
    ),
    true,
  );
  assert.equal(
    report.runtimeActivation.onboardingBlockingDependencies.includes(
      "activation_atomic_persistence",
    ),
    true,
  );
  assert.deepEqual(
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy,
    {
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
        trustAnchorSetContract:
          "crdd-coordinator/provisioning-trust-anchor-set",
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
      embeddedTrustAnchorSet: "not_implemented",
      revocationEvaluator: "not_implemented",
      filesystemRead: "not_implemented",
      resolver: "not_implemented",
      lifecyclePersistence: "not_implemented",
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    },
  );
  assert.deepEqual(report.runtimeActivation.installationKeyEnrollmentPolicy, {
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
    initialOnlineEnrollmentPureCore:
      report.runtimeActivation.initialEnrollmentPureCore,
    initialOnlineEnrollmentRuntimeState:
      report.runtimeActivation.initialEnrollmentRuntimeState,
    platformKeyStoragePolicy: report.runtimeActivation.platformKeyStoragePolicy,
    provisioningCaPureCore: report.runtimeActivation.provisioningCaPureCore,
    offlineEnrollmentBundlePureCore:
      report.runtimeActivation.offlineEnrollmentBundlePureCore,
    provisioningRecordEnrollmentBinding:
      report.runtimeActivation.provisioningRecordEnrollmentBinding,
    enrollmentCertificateRenewal:
      report.runtimeActivation.enrollmentCertificateRenewal,
    platformProvisionerTrustCore:
      report.runtimeActivation.platformProvisionerTrustCore,
    platformProvisionerPackageGate:
      report.runtimeActivation.platformProvisionerPackageGate,
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
      platformProvisionerCrddDistributionVerification:
        "platform_provisioner_verification",
      platformProvisionerPackageGateObservation:
        "platform_provisioner_verification",
      platformProvisionerPackageFilesystemVerification:
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
    Object.isFrozen(
      report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(report.runtimeActivation.installationKeyEnrollmentPolicy),
    true,
  );
  assert.deepEqual(
    report.runtimeActivation.provisioningStorageAndLifecyclePolicy,
    {
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
      filesystemRead: "not_implemented",
      filesystemWrite: "not_implemented",
      authorityRecordCurrentPointerContract: "not_implemented",
      authorityRecordCurrentPointerPersistence: "not_implemented",
      trustFloorPersistence: "not_implemented",
      repositoryGenerationPersistence: "not_implemented",
      recoveryJournalPersistence: "not_implemented",
      atomicPersistence: "not_implemented",
      crashRecovery: "not_implemented",
      implementationDependencyRelationships: {
        provisioningRecordFilesystemWrite: "platform_provisioner_effect",
        provisioningRecordCurrentPointerPersistence:
          "platform_provisioner_effect",
        provisioningRecordCurrentPointerContract:
          "provisioning_record_contract",
        provisioningTrustFloorPersistence: "provisioning_record_verification",
        repositoryGenerationPersistence: "activation_atomic_persistence",
        recoveryJournalPersistence: "activation_atomic_persistence",
      },
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    },
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.provisioningStorageAndLifecyclePolicy,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.provisioningStorageAndLifecyclePolicy
        .implementationDependencyRelationships,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.installationKeyEnrollmentPolicy
        .initialEnrollmentModes,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.installationKeyEnrollmentPolicy
        .installationKeyBackendCandidates,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.installationKeyEnrollmentPolicy
        .platformKeyStoragePolicies,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.installationKeyEnrollmentPolicy
        .platformKeyStoragePolicies.windows,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.installationKeyEnrollmentPolicy
        .onlineEnrollmentRequiredInputs,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.installationKeyEnrollmentPolicy
        .offlineEnrollmentBundleRequiredContents,
    ),
    true,
  );
  assert.equal(
    Object.isFrozen(
      report.runtimeActivation.installationKeyEnrollmentPolicy
        .implementationDependencyRelationships,
    ),
    true,
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy.writerExclusivityScope,
    "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
  );
  assert.deepEqual(
    report.runtimeActivation.rootProtectionPolicy
      .trustedPlatformAdministratorBoundary,
    ["windows_system_and_machine_administrators", "posix_root"],
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy
      .administratorOriginatedChangeDetection,
    "runtime_owned_revalidation_detects_observable_identity_protection_signature_trust_or_activation_change_and_fails_closed",
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy
      .administratorOriginatedObservableChangeResponse,
    "blocked_reverification_then_reprovision_only_after_trust_base_confirmed",
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy
      .confirmedOrSuspectedPlatformAdministratorCompromiseResponse,
    "blocked_platform_recovery_and_trust_base_reestablishment_required_before_reprovision",
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy
      .ambiguousAdministratorChangeClassification,
    "fail_closed_as_suspected_compromise",
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy
      .platformRecoveryImplementation,
    "not_implemented",
  );
  assert.equal(
    ["administrator", "CompromiseResponse"].join("") in
      report.runtimeActivation.rootProtectionPolicy,
    false,
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy
      .completeOsOrVerifierCompromiseProtection,
    "not_guaranteed",
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy.protectionEffectOwner,
    "official_signed_platform_provisioner_only_target",
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy.runtimePermissionMutation,
    "prohibited",
  );
  assert.deepEqual(
    report.runtimeActivation.rootProtectionPolicy.windowsProtectionTarget,
    {
      runtimeRoot: "runtime_sid_read_write_target",
      authorityRoot:
        "provisioner_or_approved_admin_write_runtime_sid_read_only_target",
      inheritance: "disabled_target",
      untrustedBroadWriteAces: "rejected_target",
    },
  );
  assert.deepEqual(
    report.runtimeActivation.rootProtectionPolicy.posixProtectionTarget,
    {
      runtimeRoot: "runtime_uid_owner_mode_0700_target",
      authorityRoot:
        "provisioner_or_root_owner_runtime_read_traverse_explicit_acl_target",
      unapprovedGroupOrOtherWrite: "rejected_target",
    },
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy.persistentVolumeEligibility,
    "local_equivalent_stable_identity_durable_atomic_replace_and_equivalent_acl_required_target",
  );
  assert.equal(
    report.runtimeActivation.rootProtectionPolicy.unsupportedVolumeBehavior,
    "network_removable_special_or_unknown_blocked_target",
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordRole,
    "platform_scope_signed_runtime_authority_source_of_truth_target",
  );
  assert.equal(
    report.runtimeActivation.provisionReceiptRelationship,
    "not_separate_runtime_authority_artifact_target",
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerManifestRelationship,
    "not_separate_runtime_authority_artifact_target",
  );
  assert.equal(
    report.runtimeActivation.authorityFileBundleManifestRelationship,
    "separate_existing_artifact",
  );
  assert.equal(
    report.runtimeActivation.authorityRootCurrentSelectionContract,
    "cli_then_environment_explicit_path_until_verified_record_resolver_implemented",
  );
  assert.equal(report.runtimeActivation.runRevalidationRequired, true);
  assert.equal(
    report.runtimeActivation.onboardingReadyRule,
    "all_implementation_dependencies_and_current_run_evidence_confirmed",
  );
  assert.deepEqual(
    report.runtimeActivation.onboardingCurrentRunEvidenceRequirements,
    [
      "verified_current_provisioning_record_and_platform_provisioner_trust_identity",
      "explicit_authority_root_path_resolved_from_verified_provisioning_record",
      "authority_root_identity_and_provisioner_only_writer_runtime_read_only_protection",
      "repository_runtime_root_identity_protection_and_selected_principal_binding",
      "persistent_active_activation_record_identity_and_repository_binding",
      "platform_provisioner_signature_trust_principal_root_and_protection_metadata_unchanged",
    ],
  );
  assert.equal(
    report.runtimeActivation.onboardingReadyTransition,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.onboardingReadinessProjection,
    "implemented_candidate_contract_only",
  );
  assert.deepEqual(report.runtimeActivation.requiredProvisioningTargetKinds, [
    "shared_authority_root_platform_scope",
    "repository_scoped_runtime_root_activation_precondition",
  ]);
  assert.equal(report.runtimeActivation.onboardingReadiness, "blocked");
  assert.deepEqual(report.runtimeActivation.onboardingBlockingDependencies, [
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
    report.runtimeActivation.disabledRepositoryExperience,
    "no_runtime_specific_effect",
  );
  assert.equal(
    report.runtimeActivation.firstPlatformSetup,
    "verify_signed_platform_provisioner_and_provision_shared_authority_root_target",
  );
  assert.equal(
    report.runtimeActivation.repositoryActivationEntry,
    "single_coordinator_activate_command_target",
  );
  assert.equal(
    report.runtimeActivation.normalRunAdministratorElevation,
    "not_required_after_verified_provision_and_activation_target",
  );
  assert.equal(
    report.runtimeActivation.normalRunPathInput,
    "not_required_after_verified_provision_and_activation_target",
  );
  assert.equal(
    report.runtimeActivation.normalRunManualAclConfiguration,
    "not_required_after_verified_provision_and_activation_target",
  );
  assert.equal(
    report.runtimeActivation.restartPrompt,
    "not_required_when_protection_identity_and_activation_are_valid_target",
  );
  assert.equal(
    report.runtimeActivation.protectionChangeBehavior,
    "fail_closed_reverification_then_reprovision_on_confirmed_condition",
  );
  assert.deepEqual(report.runtimeActivation.reverificationTriggers, [
    "platform_provisioner_or_signature_or_trust_change",
    "runtime_or_provisioner_principal_change",
    "root_identity_or_protection_metadata_change",
  ]);
  assert.deepEqual(report.runtimeActivation.reprovisionConditions, [
    "required_root_missing_or_replaced",
    "required_writer_or_runtime_read_only_protection_mismatch",
    "verified_provisioning_record_authority_root_identity_mismatch",
  ]);
  assert.equal(
    report.runtimeActivation.platformProvisionerVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerTrustCore
      .manifestCryptographicVerification,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerTrustCore.distributionModel,
    "crdd_bundled_private_mjs_package",
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerTrustCore
      .osNativeCodeSignatureRequiredForV1,
    false,
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerPackageGate
      .runtimeOwnedPackageFilesystemAdapter,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerPackageGate
      .effectAuthorizationIssued,
    false,
  );
  assert.equal(
    report.runtimeActivation.platformProvisionerEffect,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.installationKeyGeneration,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.installationKeyProtectionVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningEnrollmentCertificateContract,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningEnrollmentCertificateVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningCaTrustAndRevocationVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.initialProvisioningEnrollmentExchange,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.recordEnrollmentBindingVerification,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeActivation.enrollmentCertificateWireCodec,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.onlineEnrollmentProtocol,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.offlineEnrollmentBundleContract,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeActivation.offlineEnrollmentBundleImport,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.platformKeyStorageAdapterVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.enrollmentReplayProtectionPersistence,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.automaticEnrollmentRenewalEffect,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordContract,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordVerification,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordTrustAnchorSet,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordRevocationEvaluation,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordFilesystemRead,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordLifecyclePersistence,
    "not_implemented",
  );
  assert.equal(
    ["provision", "ReceiptContract"].join("") in report.runtimeActivation,
    false,
  );
  assert.equal(
    ["provision", "ReceiptVerification"].join("") in report.runtimeActivation,
    false,
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy
      .recordSchemaCodec,
    report.runtimeActivation.provisioningRecordPureCore.recordPayloadCodec,
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy
      .signatureVerifier,
    report.runtimeActivation.provisioningRecordPureCore
      .aggregateCryptographicCondition,
  );
  assert.deepEqual(
    report.runtimeActivation.provisioningSignaturePrimitives,
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy
      .signaturePrimitives,
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy
      .embeddedTrustAnchorSet,
    report.runtimeActivation.provisioningRecordTrustAnchorSet,
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy
      .revocationEvaluator,
    report.runtimeActivation.provisioningRecordRevocationEvaluation,
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy
      .filesystemRead,
    report.runtimeActivation.provisioningRecordFilesystemRead,
  );
  assert.equal(
    report.runtimeActivation.provisioningRecordTrustAndSelectionPolicy
      .lifecyclePersistence,
    report.runtimeActivation.provisioningRecordLifecyclePersistence,
  );
  assert.equal(
    report.runtimeActivation.authorityRootResolutionFromProvisioningRecord,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.authorityRootExplicitPathContractPreserved,
    true,
  );
  assert.equal(
    report.runtimeActivation.disableCommandGrammar,
    "implemented_candidate",
  );
  assert.equal(report.runtimeActivation.provisionEffect, "not_implemented");
  assert.equal(report.runtimeActivation.disableEffect, "not_implemented");
  assert.equal(report.runtimeActivation.doctorEnableIsActivation, false);
  assert.equal(
    report.runtimeActivation.bundleIdentityChangeRequiresReactivation,
    true,
  );
  assert.equal(
    report.runtimeActivation.crossRecordTransitionCore,
    "implemented_candidate",
  );
  assert.equal(
    report.runtimeActivation.initialTransitionCore,
    "initial_null_to_active_candidate",
  );
  assert.equal(
    report.runtimeActivation.disableTransitionCore,
    "active_to_disabled_candidate",
  );
  assert.equal(
    report.runtimeActivation.reactivationTransitionPolicy,
    "not_implemented",
  );
  assert.equal(
    report.runtimeActivation.disabledOriginTransitionPolicy,
    "not_implemented",
  );
  assert.equal(report.runtimeActivation.atomicPersistence, "not_implemented");
  assert.equal(report.runtimeActivation.runtimeCapabilityIssued, false);
  assert.equal(
    report.rootProtectionPolicy.protectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(
    report.rootProtectionPolicy.runtimeRootProtection,
    "runtime_principal_only_read_write_and_no_other_writer",
  );
  assert.equal(
    report.rootProtectionPolicy.authorityRootProtection,
    "provisioner_principal_only_write_runtime_read_only_and_no_other_writer",
  );
  assert.equal(
    report.rootProtectionPolicy.windowsDaclAdapter,
    "not_implemented",
  );
  assert.equal(
    report.rootProtectionPolicy.posixRuntimeRootPrecheckEntry,
    "implemented_fail_closed",
  );
  assert.equal(
    report.rootProtectionPolicy.posixRuntimeRootModeObservation,
    "not_implemented",
  );
  assert.equal(
    report.rootProtectionPolicy.posixOwnerModeAdapter,
    "not_implemented",
  );
  assert.equal(
    report.rootProtectionPolicy.posixAclVerification,
    "not_implemented",
  );
  assert.equal(
    report.rootProtectionPolicy.persistentVolumeAdapter,
    "not_implemented",
  );
  assert.equal(report.rootProtectionPolicy.pathBinding, "not_implemented");
  assert.equal(
    report.rootProtectionPolicy.activationIntegration,
    "not_implemented",
  );
  assert.equal(report.rootProtectionPolicy.runtimeCapabilityIssued, false);
  assert.equal(report.runtimeRootEvaluation.status, "blocked");
  assert.equal(
    report.runtimeRootEvaluation.reason,
    "runtime_feature_not_enabled",
  );
  assert.equal(report.runtimeRootProtectionPrecheck.status, "not_evaluated");
  assert.equal(
    report.checks.some(
      (item) => item.id === "runtime.root" && item.status === "blocked",
    ),
    true,
  );
  assert.deepEqual(report.repositoryGitLayout.supportedWorktreeForms, [
    "normal_worktree",
    "linked_worktree",
    "gitfile_worktree_without_core_worktree",
  ]);
  assert.equal(report.repositoryGitLayout.bareRepositorySupported, false);
  assert.equal(report.repositoryGitLayout.referencedSubmodulesModified, false);
  assert.equal(
    report.repositoryGitLayout.referencedRepositoriesModified,
    false,
  );
  assert.equal(
    report.repositoryGitLayout.multiRepositoryWriteOperationSupported,
    false,
  );
  assert.equal(
    report.repositoryGitLayout.filesystemResolutionCore,
    "implemented_candidate",
  );
  assert.equal(
    report.repositoryGitLayout.supportedRepositoryFormat,
    "version_0_without_extensions_or_includes",
  );
  assert.equal(report.repositoryGitLayout.gitCliAuthorityRequired, false);
  assert.equal(
    report.repositoryGitLayout.repositoryIdentityVerification,
    "not_implemented",
  );
  assert.equal(
    report.repositoryGitLayout.metadataPlacementLayoutVerification,
    "implemented_narrow_parser_candidate",
  );
  assert.equal(
    report.repositoryGitLayout.metadataWriteIntegration,
    "implemented_candidate",
  );
  assert.equal(
    report.repositoryGitLayout.metadataWriteActivationIntegration,
    "not_implemented",
  );
  assert.equal(report.repositoryGitLayout.runtimeCapabilityIssued, false);
  assert.equal(
    report.gitLocalExclude.repositoryContainedRootBackend,
    ".git/info/exclude",
  );
  assert.equal(
    report.gitLocalExclude.repositoryExternalRootRequiresExclude,
    false,
  );
  assert.equal(
    report.gitLocalExclude.trackedGitignoreModificationAllowed,
    false,
  );
  assert.equal(report.gitLocalExclude.exactRootRelativeEntryRequired, true);
  assert.equal(report.gitLocalExclude.idempotentWriteRequired, true);
  assert.equal(report.gitLocalExclude.postWriteVerificationRequired, true);
  assert.equal(report.gitLocalExclude.writeFailureBlocksActivation, true);
  assert.equal(report.gitLocalExclude.gitIgnoreIsSecurityBoundary, false);
  assert.equal(
    report.gitLocalExclude.repositoryGitDirectoryResolution,
    "implemented_candidate",
  );
  assert.equal(report.gitLocalExclude.linkedWorktreeDefaultRootAllowed, true);
  assert.equal(
    report.gitLocalExclude.linkedWorktreeRepositoryContainedCustomRootAllowed,
    false,
  );
  assert.equal(
    report.gitLocalExclude.linkedWorktreeExternalOverrideAllowed,
    true,
  );
  assert.equal(
    report.gitLocalExclude.metadataWriteIntegration,
    "implemented_candidate",
  );
  assert.equal(
    report.gitLocalExclude.runtimeRootPathIdentityPrePostVerification,
    "implemented_candidate_initial_snapshot_binding",
  );
  assert.equal(
    report.gitLocalExclude.runtimeRootIdentityDescriptorTransfer,
    false,
  );
  assert.equal(
    report.gitLocalExclude.metadataWriteActivationIntegration,
    "not_implemented",
  );
  assert.equal(report.gitLocalExclude.maximumExcludeBytes, 131072);
  assert.equal(report.gitLocalExclude.existingGitInfoDirectoryRequired, true);
  assert.equal(report.gitLocalExclude.runtimeCapabilityIssued, false);
  assert.equal(
    report.egress.isolationProfileContract.validationState,
    "candidate",
  );
  assert.equal(
    report.egress.isolationProfileContract.authorityVerification,
    "not_implemented",
  );
  assert.equal(report.egress.activation, "blocked");
  assert.equal(
    report.egress.authorityVerifier.coreValidation,
    "implemented_candidate",
  );
  assert.equal(report.egress.authorityVerifier.runtimeCapabilityIssued, false);
  assert.equal(
    report.egress.authorityTrustLoader.canonicalRegistryByteLoader,
    "implemented_candidate",
  );
  assert.equal(
    report.egress.authorityTrustLoader.runtimeTrustPolicyActivation,
    "not_implemented",
  );
  assert.equal(
    report.egress.authorityTrustLoader.runtimeCapabilityIssued,
    false,
  );
  assert.equal(
    report.egress.authorityFileBundle.canonicalBundleCore,
    "implemented_candidate",
  );
  assert.equal(
    report.egress.authorityFileBundle.rootProtectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(
    report.egress.authorityFileBundle.runtimeManagedPath,
    "not_implemented",
  );
  assert.equal(
    report.egress.authorityFileBundle.ownerAclVerification,
    "not_implemented",
  );
  assert.equal(
    report.egress.authorityFileBundle.atomicReplacement,
    "not_implemented",
  );
  assert.equal(
    report.egress.authorityFileBundle.monotonicActivation,
    "not_implemented",
  );
  assert.equal(
    report.egress.authorityFileBundle.runtimeCapabilityIssued,
    false,
  );
  assert.equal(
    report.egress.authorityFileBundle.ipcOrNetworkTransportSupported,
    false,
  );
  assert.equal(report.egress.authorityRoot.defaultPath, null);
  assert.equal(report.egress.authorityRoot.osImplicitDefaultAllowed, false);
  assert.equal(report.egress.authorityRoot.sharedAcrossRepositories, true);
  assert.equal(
    report.egress.authorityRoot.runtimeRootMayContainAuthorityBundle,
    false,
  );
  assert.equal(
    report.egress.authorityRoot.rootProtectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(
    report.egress.authorityRoot.runtimePathAdapter,
    "not_implemented",
  );
  assert.equal(report.egress.authorityRoot.runtimeCapabilityIssued, false);
  assert.equal(
    report.egress.authorityPrelaunchVerifier.runtimeClockRead,
    "implemented_candidate",
  );
  assert.equal(
    report.egress.authorityPrelaunchVerifier.prelaunchReverificationCore,
    "implemented_candidate",
  );
  assert.equal(
    report.egress.authorityPrelaunchVerifier.providerLaunchIntegration,
    "not_implemented",
  );
  assert.equal(
    report.egress.authorityPrelaunchVerifier.runtimeCapabilityIssued,
    false,
  );
  assert.equal(
    report.egress.activationReason,
    "runtime_file_bundle_path_acl_activation_provider_launch_integration_proxy_and_credential_broker_not_implemented",
  );
  assert.equal(serialized.includes("OPENAI_API_KEY="), false);
  assert.equal(serialized.includes("ANTHROPIC_API_KEY="), false);
});

test("doctorは明示enable要求だけを既存RootのPath Identity候補へ接続する", (t) => {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-doctor-root-"),
  );
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  const report = runDoctor({
    cwd: repositoryRoot,
    runtimeRootRequest: {
      cliOverride: null,
      environmentOverride: null,
      activationIntent: "explicit_enable_request",
    },
  });
  assert.equal(report.runtimeRootEvaluation.status, "candidate");
  if (!("summary" in report.runtimeRootEvaluation))
    assert.fail("runtime root candidate summary is required");
  assertPresent(report.runtimeRootEvaluation.summary);
  assert.equal(
    report.runtimeRootEvaluation.summary.location,
    "repository_default_location",
  );
  assert.equal(report.runtimeRootEvaluation.runtimeCapabilityIssued, false);
  assert.equal(report.runtimeRootProtectionPrecheck.status, "blocked");
  assert.equal(
    report.runtimeRootProtectionPrecheck.runtimeCapabilityIssued,
    false,
  );
  const runtimeRootCheck = report.checks.find(
    (item) => item.id === "runtime.root",
  );
  assertPresent(runtimeRootCheck);
  assert.equal(
    runtimeRootCheck.reason,
    "runtime_root_activation_record_not_implemented",
  );
  assert.equal(report.status, "blocked");
  assert.equal(JSON.stringify(report).includes(repositoryRoot), false);
});

test("doctor optionsのaccessor、Proxyおよび余分fieldを処置前に拒否する", () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "cwd", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return process.cwd();
    },
  });
  assert.throws(() => runDoctor(accessor), /doctor_options_invalid/u);
  assert.equal(getterCalls, 0);
  const target = { cwd: process.cwd() };
  assert.throws(
    () => runDoctor(new Proxy(target, {})),
    /doctor_options_invalid/u,
  );
  assert.throws(
    () => runDoctor({ cwd: process.cwd(), extra: true }),
    /doctor_options_invalid/u,
  );

  let nestedGetterCalls = 0;
  const nestedAccessor = {
    environmentOverride: null,
    activationIntent: "explicit_enable_request",
  };
  Object.defineProperty(nestedAccessor, "cliOverride", {
    enumerable: true,
    get() {
      nestedGetterCalls += 1;
      return process.cwd();
    },
  });
  assert.throws(
    () =>
      runDoctor({
        cwd: process.cwd(),
        runtimeRootRequest: nestedAccessor,
      }),
    /doctor_options_invalid/u,
  );
  assert.equal(nestedGetterCalls, 0);

  let nestedProxyCalls = 0;
  const nestedTarget = {
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_enable_request",
  };
  const nestedProxy = new Proxy(nestedTarget, {
    ownKeys() {
      nestedProxyCalls += 1;
      return Reflect.ownKeys(nestedTarget);
    },
  });
  assert.throws(
    () => runDoctor({ cwd: process.cwd(), runtimeRootRequest: nestedProxy }),
    /doctor_options_invalid/u,
  );
  assert.equal(nestedProxyCalls, 0);

  const invalidRequests = [
    { cliOverride: null, environmentOverride: null },
    {
      cliOverride: null,
      environmentOverride: null,
      activationIntent: "explicit_enable_request",
      extra: true,
    },
    {
      cliOverride: "relative",
      environmentOverride: null,
      activationIntent: "explicit_enable_request",
    },
    {
      cliOverride: `${path.parse(process.cwd()).root}invalid\npath`,
      environmentOverride: null,
      activationIntent: "explicit_enable_request",
    },
    {
      cliOverride: `${path.parse(process.cwd()).root}${"x".repeat(4_097)}`,
      environmentOverride: null,
      activationIntent: "explicit_enable_request",
    },
    {
      cliOverride: null,
      environmentOverride: null,
      activationIntent: "invalid",
    },
    Object.assign(Object.create({ inherited: true }), nestedTarget),
    Object.assign({ ...nestedTarget }, { [Symbol("extra")]: true }),
  ];
  for (const runtimeRootRequest of invalidRequests) {
    assert.throws(
      () => runDoctor({ cwd: process.cwd(), runtimeRootRequest }),
      /doctor_options_invalid/u,
    );
  }
});

test("doctorはnull prototypeおよびfrozenのRoot要求をowned snapshotとして受理する", (t) => {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-doctor-plain-root-"),
  );
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  const nullPrototypeRequest = Object.create(null);
  nullPrototypeRequest.cliOverride = null;
  nullPrototypeRequest.environmentOverride = null;
  nullPrototypeRequest.activationIntent = "explicit_enable_request";
  assert.equal(
    runDoctor({ cwd: repositoryRoot, runtimeRootRequest: nullPrototypeRequest })
      .runtimeRootEvaluation.status,
    "candidate",
  );
  const frozenRequest = Object.freeze({
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_enable_request",
  });
  assert.equal(
    runDoctor({ cwd: repositoryRoot, runtimeRootRequest: frozenRequest })
      .runtimeRootEvaluation.status,
    "candidate",
  );
});

test("Docker隔離Probeは固定Digestと最小権限を使う", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-docker-args-"),
  );
  try {
    const directories = createOperationDirectories(root);
    const args = dockerCreateArgumentsForFixture(directories, "test-id");
    assert.deepEqual(args.slice(0, 2), [
      "-H",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
    ]);
    assert.equal(args.includes("--network=none"), true);
    assert.equal(args.includes("--read-only"), true);
    assert.equal(args.includes("--cap-drop=ALL"), true);
    assert.equal(args.includes("--security-opt=no-new-privileges"), true);
    assert.equal(args.includes("crdd-coordinator-probe-test-id"), true);
    assert.equal(args.includes("crdd.coordinator.probe=test-id"), true);
    assert.equal(
      args.some((value) => value.startsWith("python@sha256:")),
      true,
    );
    const mounts = args.flatMap((value, index) => {
      const mount = args[index + 1];
      return value === "--mount" && mount !== undefined ? [mount] : [];
    });
    assert.equal(
      mounts.some((value) => value.includes("events")),
      false,
    );
    assert.equal(
      mounts.some((value) => value.includes("projection")),
      false,
    );
    assert.equal(
      mounts.some((value) => value.includes("management")),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Docker隔離Probe結果は全境界成立時だけconfirmedになる", () => {
  const complete = {
    marker: "crdd-coordinator-isolation-v1",
    allowed_writes: { workspace: true, "provider-home": true, tmp: true },
    runtime_paths_absent: true,
    credential_names_absent: true,
    network_blocked: true,
    home_isolated: true,
    tmp_isolated: true,
  };
  assert.equal(
    normalizeDockerIsolationResult({
      status: 0,
      stdout: JSON.stringify(complete),
    }).status,
    "confirmed",
  );
  for (const key of [
    "runtime_paths_absent",
    "credential_names_absent",
    "network_blocked",
    "home_isolated",
    "tmp_isolated",
  ]) {
    assert.equal(
      normalizeDockerIsolationResult({
        status: 0,
        stdout: JSON.stringify({ ...complete, [key]: false }),
      }).status,
      "blocked",
      key,
    );
  }
  assert.equal(
    normalizeDockerIsolationResult({ status: 0, stdout: "not-json" }).status,
    "blocked",
  );
  assert.equal(
    normalizeDockerIsolationResult({
      status: 1,
      stdout: JSON.stringify(complete),
    }).status,
    "blocked",
  );
});

test("Docker mount capabilityはfactory所有objectだけを受理しchild置換を拒否する", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-mount-capability-"),
  );
  try {
    const owned = createOwnedOperationDirectories(parent);
    assert.throws(
      () => createOwnedMountCapability({ directories: owned.directories }),
      /identity_required/u,
    );
    const capability = createOwnedMountCapability(owned);
    const verified = verifyOwnedMountCapability(capability);
    Reflect.set(owned.directories, "workspace", parent);
    assert.equal(
      verifyOwnedMountCapability(capability).workspace,
      verified.workspace,
    );
    const original = `${verified.workspace}-original`;
    fs.renameSync(verified.workspace, original);
    fs.mkdirSync(verified.workspace);
    assert.throws(() => verifyOwnedMountCapability(capability), /replaced/u);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Docker CLI候補は固定root、非link実体、承認Hashの全一致だけを受理する", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-docker-cli-"),
  );
  try {
    const executable = path.join(root, "docker.exe");
    fs.writeFileSync(executable, "trusted fixture", "utf8");
    const sha256 = createHash("sha256")
      .update(fs.readFileSync(executable))
      .digest("hex")
      .toUpperCase();
    assert.equal(
      evaluateDockerCliCandidateForFixture({
        installRoot: root,
        executableName: "docker.exe",
        sha256,
      }),
      true,
    );
    assert.equal(
      evaluateDockerCliCandidateForFixture({
        installRoot: root,
        executableName: "docker.exe",
        sha256: "0".repeat(64),
      }),
      false,
    );
    const linked = path.join(root, "linked.exe");
    try {
      fs.symlinkSync(executable, linked, "file");
    } catch (error) {
      const code = errorCode(error);
      if (code && ["EPERM", "EACCES", "ENOTSUP"].includes(code))
        return t.skip(`link fixture unavailable: ${code}`);
      throw error;
    }
    assert.equal(
      evaluateDockerCliCandidateForFixture({
        installRoot: root,
        executableName: "linked.exe",
        sha256,
      }),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function secureInspectFixture(
  id: string,
  probeId: string,
  mounts: ReturnType<typeof createOperationDirectories>,
) {
  const probeSource = dockerCreateArgumentsForFixture(mounts, probeId).at(-1);
  return {
    Id: id,
    Name: `/crdd-coordinator-probe-${probeId}`,
    Config: {
      Labels: { "crdd.coordinator.probe": probeId },
      Image:
        "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
      User: "65532:65532",
      Entrypoint: ["python"],
      Cmd: ["-c", probeSource],
    },
    HostConfig: {
      NetworkMode: "none",
      ReadonlyRootfs: true,
      Privileged: false,
      PidsLimit: 64,
      CapDrop: ["ALL"],
      CapAdd: null,
      Devices: [],
      SecurityOpt: ["no-new-privileges"],
    },
    Mounts: [
      {
        Type: "bind",
        Source: mounts.workspace,
        Destination: "/operation/workspace",
        RW: true,
      },
      {
        Type: "bind",
        Source: mounts.providerHome,
        Destination: "/operation/provider-home",
        RW: true,
      },
      {
        Type: "bind",
        Source: mounts.tmp,
        Destination: "/operation/tmp",
        RW: true,
      },
    ],
  };
}

test("container inspectはIdentityと全Security属性の一致を要求する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-inspect-"));
  try {
    const directories = createOperationDirectories(root);
    const id = "a".repeat(64);
    const probeId = "00000000-0000-4000-8000-000000000000";
    const inspect = secureInspectFixture(id, probeId, directories);
    assert.equal(
      validateContainerInspect(inspect, { id, probeId, mounts: directories }),
      true,
    );
    const mutations: Array<
      (value: ReturnType<typeof secureInspectFixture>) => void
    > = [
      (value) => {
        value.Id = "b".repeat(64);
      },
      (value) => {
        value.HostConfig.NetworkMode = "host";
      },
      (value) => {
        value.HostConfig.Privileged = true;
      },
      (value) => {
        value.Mounts.push({
          Type: "bind",
          Source: root,
          Destination: "/extra",
          RW: true,
        });
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(inspect);
      mutate(changed);
      assert.equal(
        validateContainerInspect(changed, { id, probeId, mounts: directories }),
        false,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Fake Probe recoveryはcaller指定Pathや不正tokenを受理しない", () => {
  const result = recoverDockerIsolationProbe("C:\\workspace\\not-owned");
  assert.equal(result.status, "blocked");
  assert.equal(JSON.stringify(result).includes("C:\\workspace"), false);
});

test("container createとabsence確認はtimeout、malformed ID、残留をfail closedにする", () => {
  assert.equal(
    normalizeContainerCreation({ status: 0, stdout: `${"a".repeat(64)}\n` })
      .status,
    "confirmed",
  );
  assert.equal(
    normalizeContainerCreation({ status: 0, stdout: "not-an-id" }).status,
    "blocked",
  );
  const timeoutError = new Error("fixture timeout");
  Reflect.set(timeoutError, "code", "ETIMEDOUT");
  assert.equal(
    normalizeContainerCreation({
      status: null,
      error: timeoutError,
      stdout: "",
    }).status,
    "blocked",
  );
  const empty = { status: 0, stdout: "" };
  assert.equal(
    normalizeContainerAbsence(empty, empty, empty).status,
    "confirmed",
  );
  for (const index of [0, 1, 2]) {
    const queries: [typeof empty, typeof empty, typeof empty] = [
      empty,
      empty,
      empty,
    ];
    queries[index] = { status: 0, stdout: `${"b".repeat(64)}\n` };
    assert.equal(normalizeContainerAbsence(...queries).status, "blocked");
  }
  assert.equal(
    normalizeContainerAbsence({ status: 1, stdout: "" }, empty, empty).status,
    "blocked",
  );
  assert.equal(
    normalizeContainerAbsence(empty, { status: 0, stdout: "not-an-id" }, empty)
      .status,
    "blocked",
  );
  assert.equal(
    normalizeContainerAbsence(empty, empty, {
      status: 0,
      stdout: `${"c".repeat(64)}\n${"c".repeat(64)}\n`,
    }).status,
    "blocked",
  );
});

test("Docker不存在を自己申告する公開APIを持たない", () => {
  assert.equal("setOwnedDockerRecoveryState" in executionEnvironment, false);
  assert.equal(
    "confirmHostRecoveryDockerAbsence" in executionEnvironment,
    false,
  );
  assert.equal("transitionHostRecoveryState" in hostRecoveryRecord, false);
  const owned = createOwnedOperationDirectories();
  const token = getOwnedHostRecoveryId(owned);
  const recovered = recoverOwnedOperationDirectories(token);
  assert.equal(recovered.status, "recovered");
  assert.equal(fs.existsSync(owned.root), false);
});

test("Docker submission recordとrollbackの二重失敗は手動回復までfail closedにする", () => {
  const result = normalizeDockerProbeFailure(
    new Error("docker_recovery_record_failed"),
    "fixture-probe",
    {
      submissionStarted: true,
      recoveryId: null,
      hostRecoveryId: "host.internal-token-must-not-leak",
      rollbackFailed: true,
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_submission_rollback_failed");
  assert.equal(result.retainOperationDirectories, true);
  assert.equal(result.hostCleanupCompleted, false);
  assert.equal(result.recoveryId, null);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(JSON.stringify(result).includes("internal-token"), false);

  const cancelled = normalizeDockerProbeFailure(
    new Error("docker_recovery_record_failed"),
    "fixture-probe",
    {
      submissionStarted: false,
      recoveryId: null,
      hostRecoveryId: "host.fixture-token",
      rollbackFailed: false,
    },
  );
  assert.equal(cancelled.recoveryId, "host.fixture-token");
  assert.equal(cancelled.manualRecoveryRequired, false);
});

test("Host recoveryは部分削除済みchildを許容し残存rootを回収する", () => {
  const owned = createOwnedOperationDirectories();
  const token = getOwnedHostRecoveryId(owned);
  fs.rmSync(owned.directories.tmp, { recursive: true, force: false });
  const recovered = recoverOwnedOperationDirectories(token);
  assert.equal(recovered.status, "recovered");
  assert.equal(fs.existsSync(owned.root), false);
});

test("Host recoveryはroot削除済みでも外部markerを安全に完了する", () => {
  const owned = createOwnedOperationDirectories();
  const token = getOwnedHostRecoveryId(owned);
  fs.rmSync(owned.root, { recursive: true, force: false });
  const recovered = recoverOwnedOperationDirectories(token);
  assert.deepEqual(recovered, {
    status: "recovered",
    reason: "host_root_already_absent",
  });
  assert.equal(recoverOwnedOperationDirectories(token).status, "blocked");
});

test("Host cleanupはeventsとprojectionを含む6 childを所有確認する", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-all-children-"),
  );
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-events-original`;
    fs.renameSync(owned.directories.events, original);
    fs.mkdirSync(owned.directories.events);
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.existsSync(original), true);
    assert.equal(fs.existsSync(owned.directories.events), true);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Host cleanupはroot直下の未知entryを推測削除しない", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-unknown-child-"),
  );
  try {
    const owned = createOwnedOperationDirectories(parent);
    const unknown = path.join(owned.root, "unknown.txt");
    fs.writeFileSync(unknown, "keep", "utf8");
    assert.throws(
      () => cleanupOwnedOperationDirectories(owned),
      /unknown_child/u,
    );
    assert.equal(fs.readFileSync(unknown, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Host cleanupはprojectionのlink置換を拒否する", (t) => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "coordinator-linked-projection-"),
  );
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-projection-original`;
    const target = path.join(parent, "projection-target");
    fs.renameSync(owned.directories.projection, original);
    fs.mkdirSync(target);
    try {
      fs.symlinkSync(
        target,
        owned.directories.projection,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = errorCode(error);
      if (code && ["EPERM", "EACCES", "ENOTSUP"].includes(code))
        return t.skip(`link fixture unavailable: ${code}`);
      throw error;
    }
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.existsSync(original), true);
    assert.equal(fs.existsSync(target), true);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Host recoveryは既知projectionの部分削除を許容する", () => {
  const owned = createOwnedOperationDirectories();
  const token = getOwnedHostRecoveryId(owned);
  fs.rmSync(owned.directories.projection, { recursive: true, force: false });
  const recovered = recoverOwnedOperationDirectories(token);
  assert.equal(recovered.status, "recovered");
  assert.equal(fs.existsSync(owned.root), false);
});

test("passive cleanupはmarker改変を現在Hashとして再信頼しない", () => {
  const owned = createOwnedOperationDirectories();
  const token = getOwnedHostRecoveryId(owned);
  const nonce = token.split(".")[2];
  assertPresent(nonce);
  const marker = path.join(
    os.tmpdir(),
    "crdd-coordinator-recovery-v1",
    `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
  );
  const original = fs.readFileSync(marker, "utf8");
  const changed = JSON.parse(original);
  changed.state = "docker_absent_confirmed";
  fs.writeFileSync(marker, `${JSON.stringify(changed)}\n`, "utf8");
  assert.throws(() => getOwnedHostRecoveryId(owned), /record_mismatch/u);
  assert.throws(
    () => cleanupOwnedOperationDirectories(owned),
    /record_mismatch/u,
  );
  assert.equal(fs.existsSync(owned.root), true);
  assert.equal(recoverOwnedOperationDirectories(token).status, "blocked");
  fs.writeFileSync(marker, original, "utf8");
  cleanupOwnedOperationDirectories(owned);
});

test("Docker recovery child分類は既知child欠落を許容し未知entryを拒否する", () => {
  const owned = createOwnedOperationDirectories();
  const token = getOwnedHostRecoveryId(owned);
  const identities = {
    workspace: recordedIdentity(owned.directories.workspace),
    "provider-home": recordedIdentity(owned.directories.providerHome),
    tmp: recordedIdentity(owned.directories.tmp),
    events: recordedIdentity(owned.directories.events),
    projection: recordedIdentity(owned.directories.projection),
    management: recordedIdentity(owned.directories.management),
  };
  fs.rmSync(owned.directories.events, { recursive: true, force: false });
  const partial = classifyRecoveryChildren(owned.root, identities);
  assert.equal(partial.present.includes("events"), false);
  assert.equal(partial.present.includes("management"), true);
  const unknown = path.join(owned.root, "unknown.txt");
  fs.writeFileSync(unknown, "keep", "utf8");
  assert.throws(
    () => classifyRecoveryChildren(owned.root, identities),
    /unknown_child/u,
  );
  fs.rmSync(unknown);
  assert.equal(recoverOwnedOperationDirectories(token).status, "recovered");
});

test("Docker不存在確定後のHost cleanup失敗は更新後Host tokenを返す", () => {
  const hostToken = `host.crdd-coordinator-doctor-test.${"a".repeat(8)}-${"b".repeat(4)}-${"c".repeat(4)}-${"d".repeat(4)}-${"e".repeat(12)}.${"f".repeat(64)}`;
  const normalized = normalizeHostCleanupResult(
    { status: "blocked", reason: "host_recovery_unknown_child" },
    hostToken,
    { status: "confirmed" },
    "probe",
  );
  assert.equal(normalized.status, "blocked");
  assert.equal(normalized.recoveryId, hostToken);
  assert.equal(normalized.hostCleanupCompleted, false);
});
