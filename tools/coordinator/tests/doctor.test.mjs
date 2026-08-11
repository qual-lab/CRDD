import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as executionEnvironment from "../src/security/execution-environment.mjs";
import * as hostRecoveryRecord from "../src/security/host-recovery-record.mjs";

import {
  CHECK_STATUS,
  REQUIRED_CHECK_IDS,
  discoverCommand,
  evaluateReadiness,
  runDoctor
} from "../src/core/doctor.mjs";
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
  verifyOwnedMountCapability
} from "../src/security/execution-environment.mjs";
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
  validateContainerInspect
} from "../src/security/docker-isolation.mjs";

function recordedIdentity(target) {
  const metadata = fs.lstatSync(target, { bigint: true });
  return {
    dev: metadata.dev.toString(),
    ino: metadata.ino.toString(),
    birthtimeNs: metadata.birthtimeNs.toString()
  };
}

function confirmedChecks() {
  return REQUIRED_CHECK_IDS.map((id) => ({ id, status: "confirmed", reason: null }));
}

test("Provider環境は通常HomeとCredential環境を継承しない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-env-test-"));
  try {
    const directories = createOperationDirectories(root);
    const environment = createProviderEnvironment({
      PATH: "test-path",
      HOME: "/normal/home",
      USERPROFILE: "C:\\Users\\normal",
      OPENAI_API_KEY: "secret",
      ANTHROPIC_API_KEY: "secret",
      SSH_AUTH_SOCK: "agent"
    }, directories);
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
    management: "/state/OP-1/management"
  };
  const policy = describeFilesystemPolicy(directories);
  assert.deepEqual(policy.coordinatorRuntime.write, [directories.events, directories.projection, directories.management]);
  assert.deepEqual(policy.providerProcess.write, [directories.workspace, directories.providerHome, directories.tmp]);
  assert.deepEqual(policy.providerProcess.deny, [directories.events, directories.projection, directories.management]);
  assert.equal(policy.credentialBroker.exposeCredentialStorePathToProvider, false);
});

test("全必須checkがconfirmedの場合だけpure集約はReadyを返す", () => {
  assert.equal(evaluateReadiness(confirmedChecks()).status, "ready");
  for (const status of CHECK_STATUS.filter((value) => value !== "confirmed")) {
    const checks = confirmedChecks();
    checks[0] = { ...checks[0], status, reason: `fixture_${status}` };
    assert.equal(evaluateReadiness(checks).status, "blocked");
  }
  for (const id of REQUIRED_CHECK_IDS) {
    const checks = confirmedChecks();
    const target = checks.find((item) => item.id === id);
    target.status = "unknown";
    target.reason = "fixture_unknown";
    assert.equal(evaluateReadiness(checks).status, "blocked", id);
  }
});

test("欠落、重複、未知および不正なcheckをfail closedにする", () => {
  const missing = confirmedChecks().slice(1);
  assert.equal(evaluateReadiness(missing).status, "blocked");
  const duplicate = [...confirmedChecks(), confirmedChecks()[0]];
  assert.equal(evaluateReadiness(duplicate).status, "blocked");
  const unknown = [...confirmedChecks(), { id: "unknown", status: "confirmed" }];
  assert.equal(evaluateReadiness(unknown).status, "blocked");
  const invalid = confirmedChecks();
  invalid[0] = { ...invalid[0], status: "pass" };
  assert.equal(evaluateReadiness(invalid).status, "blocked");
});

test("Providerごとの必須checkを片側だけ成立させてもReadyにならない", () => {
  const checks = confirmedChecks();
  const target = checks.find((item) => item.id === "provider.claude.authentication");
  target.status = "unknown";
  target.reason = "authentication_not_evaluated";
  const result = evaluateReadiness(checks);
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some((item) => item.id === target.id), true);
});

test("passive discoveryはPATHをFilesystem APIで調べ絶対Pathを返さない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-discovery-test-"));
  try {
    fs.writeFileSync(path.join(root, "codex.cmd"), "not executed", "utf8");
    const result = discoverCommand("codex", {
      platform: "win32",
      environment: { PATH: root, PATHEXT: ".EXE;.CMD;.BAT" }
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-discovery-many-"));
  try {
    fs.writeFileSync(path.join(root, "claude.exe"), "not executed", "utf8");
    fs.writeFileSync(path.join(root, "claude.bat"), "not executed", "utf8");
    const result = discoverCommand("claude", {
      platform: "win32",
      environment: { PATH: root, PATHEXT: ".EXE;.CMD;.BAT" }
    });
    assert.equal(result.candidateCount, 2);
    assert.deepEqual(result.formats, ["bat", "exe"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("owned childだけを削除しtemporary parentとsiblingを保持する", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-parent-test-"));
  const sibling = path.join(parent, "keep.txt");
  fs.writeFileSync(sibling, "keep", "utf8");
  try {
    const owned = createOwnedOperationDirectories(parent);
    const root = owned.root;
    cleanupOwnedOperationDirectories(owned);
    assert.equal(fs.existsSync(root), false);
    assert.equal(fs.readFileSync(sibling, "utf8"), "keep");
    assert.equal(fs.existsSync(parent), true);
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /identity_required/u);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("所有IdentityがないPathをcleanupしない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-unowned-test-"));
  const content = path.join(parent, "keep.txt");
  fs.writeFileSync(content, "keep", "utf8");
  try {
    assert.throws(() => cleanupOwnedOperationDirectories({ root: parent, parent: path.dirname(parent) }));
    assert.equal(fs.readFileSync(content, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("正しいprefixを持つ既存directoryでも偽owned objectでは削除しない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-fake-owner-"));
  const target = fs.mkdtempSync(path.join(parent, "crdd-coordinator-doctor-"));
  const content = path.join(target, "keep.txt");
  fs.writeFileSync(content, "keep", "utf8");
  try {
    assert.throws(() => cleanupOwnedOperationDirectories({ root: target, parent }), /identity_required/u);
    assert.equal(fs.readFileSync(content, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("owned objectのpublic Pathを書き換えても別directoryを削除しない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-mutated-owner-"));
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
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-replaced-owner-"));
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
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-linked-owner-"));
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-original`;
    const target = path.join(parent, "junction-target");
    fs.renameSync(owned.root, original);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "keep.txt"), "keep", "utf8");
    try {
      fs.symlinkSync(target, owned.root, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`link fixture unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.readFileSync(path.join(target, "keep.txt"), "utf8"), "keep");
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
  assert.equal(report.providers.codex.version, undefined);
  assert.equal(report.providers.codex.path, undefined);
  assert.equal(report.checks.some((item) => item.id === "execution.filesystem" && item.status === "not_implemented"), true);
  assert.equal(report.checks.some((item) => item.id === "execution.credential_isolation" && item.status === "not_implemented"), true);
  assert.equal(report.checks.some((item) => item.id === "execution.egress" && item.status === "not_implemented"), true);
  assert.equal(report.checks.some((item) => item.id.endsWith(".active_probe") && item.status === "not_implemented"), true);
  assert.equal(report.runtimeRoot.defaultRepositoryDirectory, ".crdd-runtime");
  assert.equal(report.runtimeRoot.featureDefault, "disabled");
  assert.equal(report.runtimeRoot.cliOverrideIntegration, "implemented_candidate");
  assert.equal(report.runtimeRoot.environmentOverrideIntegration, "implemented_candidate");
  assert.equal(report.runtimeRoot.diagnosticRequestIntegration, "implemented_candidate");
  assert.equal(report.runtimeRoot.explicitEnableRequired, true);
  assert.equal(report.runtimeRoot.directoryExistenceActivates, false);
  assert.equal(report.runtimeRoot.gitIgnoreIsSecurityBoundary, false);
  assert.equal(report.runtimeRoot.candidateRevisionIncludesRuntimeRoot, false);
  assert.equal(report.runtimeRoot.operationInputIncludesRuntimeRoot, false);
  assert.equal(report.runtimeRoot.providerMountAllowed, false);
  assert.equal(report.runtimeRoot.disableSemantics, "stop_new_operations_and_safely_cancel_in_flight");
  assert.equal(report.runtimeRoot.disableImplementation, "not_implemented");
  assert.equal(report.runtimeRoot.disableDeletesStoredData, false);
  assert.equal(report.runtimeRoot.runtimeDataDeletion, "not_implemented");
  assert.equal(report.runtimeRoot.rootProtectionPolicyCore, "implemented_candidate_claim_only");
  assert.equal(report.runtimeRoot.runtimePathAdapter, "not_implemented");
  assert.equal(report.runtimeRoot.runtimePathObjectIdentityCore, "implemented_candidate");
  assert.equal(report.runtimeRoot.activationRecordCore, "implemented_candidate");
  assert.equal(report.runtimeRoot.activationRecordPersistence, "not_implemented");
  assert.equal(report.runtimeRoot.runtimeCapabilityIssued, false);
  assert.equal(report.runtimeRootPathIdentity.existingRootRequired, true);
  assert.equal(report.runtimeRootPathIdentity.rootCreationIssued, false);
  assert.equal(report.runtimeRootPathIdentity.pathObjectIdentityVerification, "implemented_candidate");
  assert.equal(report.runtimeRootPathIdentity.ownerAclVerification, "not_implemented");
  assert.equal(report.runtimeRootPathIdentity.fullParentChainVerification, "not_implemented");
  assert.equal(report.runtimeRootPathIdentity.localExcludeIntegration,
    "implemented_candidate_initial_snapshot_binding");
  assert.equal(report.runtimeRootPathIdentity.activationIntegration, "not_implemented");
  assert.equal(report.runtimeRootPathIdentity.runtimeCapabilityIssued, false);
  assert.equal(report.runtimeActivation.persistence, "repository_scoped_persistent");
  assert.equal(report.runtimeActivation.activationCommand, "dedicated_activate_required");
  assert.equal(report.runtimeActivation.activationCommandGrammar, "implemented_candidate");
  assert.equal(report.runtimeActivation.activationEffect, "not_implemented");
  assert.equal(report.runtimeActivation.disableCommandGrammar, "implemented_candidate");
  assert.equal(report.runtimeActivation.disableEffect, "not_implemented");
  assert.equal(report.runtimeActivation.doctorEnableIsActivation, false);
  assert.equal(report.runtimeActivation.bundleIdentityChangeRequiresReactivation, true);
  assert.equal(report.runtimeActivation.crossRecordTransitionCore, "implemented_candidate");
  assert.equal(report.runtimeActivation.initialTransitionCore, "initial_null_to_active_candidate");
  assert.equal(report.runtimeActivation.disableTransitionCore, "active_to_disabled_candidate");
  assert.equal(report.runtimeActivation.reactivationTransitionPolicy, "not_implemented");
  assert.equal(report.runtimeActivation.disabledOriginTransitionPolicy, "not_implemented");
  assert.equal(report.runtimeActivation.atomicPersistence, "not_implemented");
  assert.equal(report.runtimeActivation.runtimeCapabilityIssued, false);
  assert.equal(report.rootProtectionPolicy.protectionPolicyCore,
    "implemented_candidate_claim_only");
  assert.equal(report.rootProtectionPolicy.windowsDaclAdapter, "not_implemented");
  assert.equal(report.rootProtectionPolicy.posixOwnerModeAdapter, "not_implemented");
  assert.equal(report.rootProtectionPolicy.persistentVolumeAdapter, "not_implemented");
  assert.equal(report.rootProtectionPolicy.pathBinding, "not_implemented");
  assert.equal(report.rootProtectionPolicy.activationIntegration, "not_implemented");
  assert.equal(report.rootProtectionPolicy.runtimeCapabilityIssued, false);
  assert.equal(report.runtimeRootEvaluation.status, "blocked");
  assert.equal(report.runtimeRootEvaluation.reason, "runtime_feature_not_enabled");
  assert.equal(report.checks.some((item) => item.id === "runtime.root" && item.status === "blocked"), true);
  assert.deepEqual(report.repositoryGitLayout.supportedWorktreeForms, [
    "normal_worktree",
    "linked_worktree",
    "gitfile_worktree_without_core_worktree"
  ]);
  assert.equal(report.repositoryGitLayout.bareRepositorySupported, false);
  assert.equal(report.repositoryGitLayout.referencedSubmodulesModified, false);
  assert.equal(report.repositoryGitLayout.referencedRepositoriesModified, false);
  assert.equal(report.repositoryGitLayout.multiRepositoryWriteOperationSupported, false);
  assert.equal(report.repositoryGitLayout.filesystemResolutionCore, "implemented_candidate");
  assert.equal(report.repositoryGitLayout.supportedRepositoryFormat, "version_0_without_extensions_or_includes");
  assert.equal(report.repositoryGitLayout.gitCliAuthorityRequired, false);
  assert.equal(report.repositoryGitLayout.repositoryIdentityVerification, "not_implemented");
  assert.equal(report.repositoryGitLayout.metadataPlacementLayoutVerification,
    "implemented_narrow_parser_candidate");
  assert.equal(report.repositoryGitLayout.metadataWriteIntegration, "implemented_candidate");
  assert.equal(report.repositoryGitLayout.metadataWriteActivationIntegration, "not_implemented");
  assert.equal(report.repositoryGitLayout.runtimeCapabilityIssued, false);
  assert.equal(report.gitLocalExclude.repositoryContainedRootBackend, ".git/info/exclude");
  assert.equal(report.gitLocalExclude.repositoryExternalRootRequiresExclude, false);
  assert.equal(report.gitLocalExclude.trackedGitignoreModificationAllowed, false);
  assert.equal(report.gitLocalExclude.exactRootRelativeEntryRequired, true);
  assert.equal(report.gitLocalExclude.idempotentWriteRequired, true);
  assert.equal(report.gitLocalExclude.postWriteVerificationRequired, true);
  assert.equal(report.gitLocalExclude.writeFailureBlocksActivation, true);
  assert.equal(report.gitLocalExclude.gitIgnoreIsSecurityBoundary, false);
  assert.equal(report.gitLocalExclude.repositoryGitDirectoryResolution, "implemented_candidate");
  assert.equal(report.gitLocalExclude.linkedWorktreeDefaultRootAllowed, true);
  assert.equal(report.gitLocalExclude.linkedWorktreeRepositoryContainedCustomRootAllowed, false);
  assert.equal(report.gitLocalExclude.linkedWorktreeExternalOverrideAllowed, true);
  assert.equal(report.gitLocalExclude.metadataWriteIntegration, "implemented_candidate");
  assert.equal(report.gitLocalExclude.runtimeRootPathIdentityPrePostVerification,
    "implemented_candidate_initial_snapshot_binding");
  assert.equal(report.gitLocalExclude.runtimeRootIdentityDescriptorTransfer, false);
  assert.equal(report.gitLocalExclude.metadataWriteActivationIntegration, "not_implemented");
  assert.equal(report.gitLocalExclude.maximumExcludeBytes, 131072);
  assert.equal(report.gitLocalExclude.existingGitInfoDirectoryRequired, true);
  assert.equal(report.gitLocalExclude.runtimeCapabilityIssued, false);
  assert.equal(report.egress.isolationProfileContract.validationState, "candidate");
  assert.equal(report.egress.isolationProfileContract.authorityVerification, "not_implemented");
  assert.equal(report.egress.activation, "blocked");
  assert.equal(report.egress.authorityVerifier.coreValidation, "implemented_candidate");
  assert.equal(report.egress.authorityVerifier.runtimeCapabilityIssued, false);
  assert.equal(report.egress.authorityTrustLoader.canonicalRegistryByteLoader, "implemented_candidate");
  assert.equal(report.egress.authorityTrustLoader.runtimeTrustPolicyActivation, "not_implemented");
  assert.equal(report.egress.authorityTrustLoader.runtimeCapabilityIssued, false);
  assert.equal(report.egress.authorityFileBundle.canonicalBundleCore, "implemented_candidate");
  assert.equal(report.egress.authorityFileBundle.rootProtectionPolicyCore,
    "implemented_candidate_claim_only");
  assert.equal(report.egress.authorityFileBundle.runtimeManagedPath, "not_implemented");
  assert.equal(report.egress.authorityFileBundle.ownerAclVerification, "not_implemented");
  assert.equal(report.egress.authorityFileBundle.atomicReplacement, "not_implemented");
  assert.equal(report.egress.authorityFileBundle.monotonicActivation, "not_implemented");
  assert.equal(report.egress.authorityFileBundle.runtimeCapabilityIssued, false);
  assert.equal(report.egress.authorityFileBundle.ipcOrNetworkTransportSupported, false);
  assert.equal(report.egress.authorityRoot.defaultPath, null);
  assert.equal(report.egress.authorityRoot.osImplicitDefaultAllowed, false);
  assert.equal(report.egress.authorityRoot.sharedAcrossRepositories, true);
  assert.equal(report.egress.authorityRoot.runtimeRootMayContainAuthorityBundle, false);
  assert.equal(report.egress.authorityRoot.rootProtectionPolicyCore,
    "implemented_candidate_claim_only");
  assert.equal(report.egress.authorityRoot.runtimePathAdapter, "not_implemented");
  assert.equal(report.egress.authorityRoot.runtimeCapabilityIssued, false);
  assert.equal(report.egress.authorityPrelaunchVerifier.runtimeClockRead, "implemented_candidate");
  assert.equal(report.egress.authorityPrelaunchVerifier.prelaunchReverificationCore, "implemented_candidate");
  assert.equal(report.egress.authorityPrelaunchVerifier.providerLaunchIntegration, "not_implemented");
  assert.equal(report.egress.authorityPrelaunchVerifier.runtimeCapabilityIssued, false);
  assert.equal(
    report.egress.activationReason,
    "runtime_file_bundle_path_acl_activation_provider_launch_integration_proxy_and_credential_broker_not_implemented"
  );
  assert.equal(serialized.includes("OPENAI_API_KEY="), false);
  assert.equal(serialized.includes("ANTHROPIC_API_KEY="), false);
});

test("doctorは明示enable要求だけを既存RootのPath Identity候補へ接続する", (t) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-doctor-root-"));
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  const report = runDoctor({
    cwd: repositoryRoot,
    runtimeRootRequest: {
      cliOverride: null,
      environmentOverride: null,
      activationIntent: "explicit_enable_request"
    }
  });
  assert.equal(report.runtimeRootEvaluation.status, "candidate");
  assert.equal(report.runtimeRootEvaluation.summary.location, "repository_default_location");
  assert.equal(report.runtimeRootEvaluation.runtimeCapabilityIssued, false);
  assert.equal(report.checks.find((item) => item.id === "runtime.root").reason,
    "runtime_root_activation_record_not_implemented");
  assert.equal(report.status, "blocked");
  assert.equal(JSON.stringify(report).includes(repositoryRoot), false);
});

test("doctor optionsのaccessor、Proxyおよび余分fieldを処置前に拒否する", () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "cwd", {
    enumerable: true,
    get() { getterCalls += 1; return process.cwd(); }
  });
  assert.throws(() => runDoctor(accessor), /doctor_options_invalid/u);
  assert.equal(getterCalls, 0);
  const target = { cwd: process.cwd() };
  assert.throws(() => runDoctor(new Proxy(target, {})), /doctor_options_invalid/u);
  assert.throws(() => runDoctor({ cwd: process.cwd(), extra: true }), /doctor_options_invalid/u);

  let nestedGetterCalls = 0;
  const nestedAccessor = {
    environmentOverride: null,
    activationIntent: "explicit_enable_request"
  };
  Object.defineProperty(nestedAccessor, "cliOverride", {
    enumerable: true,
    get() { nestedGetterCalls += 1; return process.cwd(); }
  });
  assert.throws(() => runDoctor({
    cwd: process.cwd(),
    runtimeRootRequest: nestedAccessor
  }), /doctor_options_invalid/u);
  assert.equal(nestedGetterCalls, 0);

  let nestedProxyCalls = 0;
  const nestedTarget = {
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_enable_request"
  };
  const nestedProxy = new Proxy(nestedTarget, {
    ownKeys() { nestedProxyCalls += 1; return Reflect.ownKeys(nestedTarget); }
  });
  assert.throws(() => runDoctor({ cwd: process.cwd(), runtimeRootRequest: nestedProxy }),
    /doctor_options_invalid/u);
  assert.equal(nestedProxyCalls, 0);

  const invalidRequests = [
    { cliOverride: null, environmentOverride: null },
    { cliOverride: null, environmentOverride: null, activationIntent: "explicit_enable_request", extra: true },
    { cliOverride: "relative", environmentOverride: null, activationIntent: "explicit_enable_request" },
    { cliOverride: `${path.parse(process.cwd()).root}invalid\npath`, environmentOverride: null,
      activationIntent: "explicit_enable_request" },
    { cliOverride: `${path.parse(process.cwd()).root}${"x".repeat(4_097)}`, environmentOverride: null,
      activationIntent: "explicit_enable_request" },
    { cliOverride: null, environmentOverride: null, activationIntent: "invalid" },
    Object.assign(Object.create({ inherited: true }), nestedTarget),
    Object.assign({ ...nestedTarget }, { [Symbol("extra")]: true })
  ];
  for (const runtimeRootRequest of invalidRequests) {
    assert.throws(() => runDoctor({ cwd: process.cwd(), runtimeRootRequest }), /doctor_options_invalid/u);
  }
});

test("doctorはnull prototypeおよびfrozenのRoot要求をowned snapshotとして受理する", (t) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-doctor-plain-root-"));
  t.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repositoryRoot, ".crdd-runtime"));
  const nullPrototypeRequest = Object.create(null);
  nullPrototypeRequest.cliOverride = null;
  nullPrototypeRequest.environmentOverride = null;
  nullPrototypeRequest.activationIntent = "explicit_enable_request";
  assert.equal(runDoctor({ cwd: repositoryRoot, runtimeRootRequest: nullPrototypeRequest })
    .runtimeRootEvaluation.status, "candidate");
  const frozenRequest = Object.freeze({
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_enable_request"
  });
  assert.equal(runDoctor({ cwd: repositoryRoot, runtimeRootRequest: frozenRequest })
    .runtimeRootEvaluation.status, "candidate");
});

test("Docker隔離Probeは固定Digestと最小権限を使う", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-docker-args-"));
  try {
    const directories = createOperationDirectories(root);
    const args = dockerCreateArgumentsForFixture(directories, "test-id");
    assert.deepEqual(args.slice(0, 2), ["-H", "npipe:////./pipe/dockerDesktopLinuxEngine"]);
    assert.equal(args.includes("--network=none"), true);
    assert.equal(args.includes("--read-only"), true);
    assert.equal(args.includes("--cap-drop=ALL"), true);
    assert.equal(args.includes("--security-opt=no-new-privileges"), true);
    assert.equal(args.includes("crdd-coordinator-probe-test-id"), true);
    assert.equal(args.includes("crdd.coordinator.probe=test-id"), true);
    assert.equal(args.some((value) => value.startsWith("python@sha256:")), true);
    const mounts = args.flatMap((value, index) => value === "--mount" ? [args[index + 1]] : []);
    assert.equal(mounts.some((value) => value.includes("events")), false);
    assert.equal(mounts.some((value) => value.includes("projection")), false);
    assert.equal(mounts.some((value) => value.includes("management")), false);
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
    tmp_isolated: true
  };
  assert.equal(normalizeDockerIsolationResult({ status: 0, stdout: JSON.stringify(complete) }).status, "confirmed");
  for (const key of ["runtime_paths_absent", "credential_names_absent", "network_blocked", "home_isolated", "tmp_isolated"]) {
    assert.equal(normalizeDockerIsolationResult({ status: 0, stdout: JSON.stringify({ ...complete, [key]: false }) }).status, "blocked", key);
  }
  assert.equal(normalizeDockerIsolationResult({ status: 0, stdout: "not-json" }).status, "blocked");
  assert.equal(normalizeDockerIsolationResult({ status: 1, stdout: JSON.stringify(complete) }).status, "blocked");
});

test("Docker mount capabilityはfactory所有objectだけを受理しchild置換を拒否する", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-mount-capability-"));
  try {
    const owned = createOwnedOperationDirectories(parent);
    assert.throws(() => createOwnedMountCapability({ directories: owned.directories }), /identity_required/u);
    const capability = createOwnedMountCapability(owned);
    const verified = verifyOwnedMountCapability(capability);
    owned.directories.workspace = parent;
    assert.equal(verifyOwnedMountCapability(capability).workspace, verified.workspace);
    const original = `${verified.workspace}-original`;
    fs.renameSync(verified.workspace, original);
    fs.mkdirSync(verified.workspace);
    assert.throws(() => verifyOwnedMountCapability(capability), /replaced/u);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Docker CLI候補は固定root、非link実体、承認Hashの全一致だけを受理する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-docker-cli-"));
  try {
    const executable = path.join(root, "docker.exe");
    fs.writeFileSync(executable, "trusted fixture", "utf8");
    const sha256 = createHash("sha256").update(fs.readFileSync(executable)).digest("hex").toUpperCase();
    assert.equal(evaluateDockerCliCandidateForFixture({ installRoot: root, executableName: "docker.exe", sha256 }), true);
    assert.equal(evaluateDockerCliCandidateForFixture({ installRoot: root, executableName: "docker.exe", sha256: "0".repeat(64) }), false);
    const linked = path.join(root, "linked.exe");
    try { fs.symlinkSync(executable, linked, "file"); }
    catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) return t.skip(`link fixture unavailable: ${error.code}`);
      throw error;
    }
    assert.equal(evaluateDockerCliCandidateForFixture({ installRoot: root, executableName: "linked.exe", sha256 }), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function secureInspectFixture(id, probeId, mounts) {
  const probeSource = dockerCreateArgumentsForFixture(mounts, probeId).at(-1);
  return {
    Id: id,
    Name: `/crdd-coordinator-probe-${probeId}`,
    Config: {
      Labels: { "crdd.coordinator.probe": probeId },
      Image: "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
      User: "65532:65532",
      Entrypoint: ["python"],
      Cmd: ["-c", probeSource]
    },
    HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false, PidsLimit: 64, CapDrop: ["ALL"], CapAdd: null, Devices: [], SecurityOpt: ["no-new-privileges"] },
    Mounts: [
      { Type: "bind", Source: mounts.workspace, Destination: "/operation/workspace", RW: true },
      { Type: "bind", Source: mounts.providerHome, Destination: "/operation/provider-home", RW: true },
      { Type: "bind", Source: mounts.tmp, Destination: "/operation/tmp", RW: true }
    ]
  };
}

test("container inspectはIdentityと全Security属性の一致を要求する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-inspect-"));
  try {
    const directories = createOperationDirectories(root);
    const id = "a".repeat(64);
    const probeId = "00000000-0000-4000-8000-000000000000";
    const inspect = secureInspectFixture(id, probeId, directories);
    assert.equal(validateContainerInspect(inspect, { id, probeId, mounts: directories }), true);
    for (const mutate of [
      (value) => { value.Id = "b".repeat(64); },
      (value) => { value.HostConfig.NetworkMode = "host"; },
      (value) => { value.HostConfig.Privileged = true; },
      (value) => { value.Mounts.push({ Type: "bind", Source: root, Destination: "/extra", RW: true }); }
    ]) {
      const changed = structuredClone(inspect);
      mutate(changed);
      assert.equal(validateContainerInspect(changed, { id, probeId, mounts: directories }), false);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Fake Probe recoveryはcaller指定Pathや不正tokenを受理しない", () => {
  const result = recoverDockerIsolationProbe("C:\\workspace\\not-owned");
  assert.equal(result.status, "blocked");
  assert.equal(JSON.stringify(result).includes("C:\\workspace"), false);
});

test("container createとabsence確認はtimeout、malformed ID、残留をfail closedにする", () => {
  assert.equal(normalizeContainerCreation({ status: 0, stdout: `${"a".repeat(64)}\n` }).status, "confirmed");
  assert.equal(normalizeContainerCreation({ status: 0, stdout: "not-an-id" }).status, "blocked");
  assert.equal(normalizeContainerCreation({ status: null, error: { code: "ETIMEDOUT" }, stdout: "" }).status, "blocked");
  const empty = { status: 0, stdout: "" };
  assert.equal(normalizeContainerAbsence(empty, empty, empty).status, "confirmed");
  for (const index of [0, 1, 2]) {
    const queries = [empty, empty, empty];
    queries[index] = { status: 0, stdout: `${"b".repeat(64)}\n` };
    assert.equal(normalizeContainerAbsence(...queries).status, "blocked");
  }
  assert.equal(normalizeContainerAbsence({ status: 1, stdout: "" }, empty, empty).status, "blocked");
  assert.equal(normalizeContainerAbsence(empty, { status: 0, stdout: "not-an-id" }, empty).status, "blocked");
  assert.equal(normalizeContainerAbsence(empty, empty, { status: 0, stdout: `${"c".repeat(64)}\n${"c".repeat(64)}\n` }).status, "blocked");
});

test("Docker不存在を自己申告する公開APIを持たない", () => {
  assert.equal("setOwnedDockerRecoveryState" in executionEnvironment, false);
  assert.equal("confirmHostRecoveryDockerAbsence" in executionEnvironment, false);
  assert.equal("transitionHostRecoveryState" in hostRecoveryRecord, false);
  const owned = createOwnedOperationDirectories();
  const token = getOwnedHostRecoveryId(owned);
  const recovered = recoverOwnedOperationDirectories(token);
  assert.equal(recovered.status, "recovered");
  assert.equal(fs.existsSync(owned.root), false);
});

test("Docker submission recordとrollbackの二重失敗は手動回復までfail closedにする", () => {
  const result = normalizeDockerProbeFailure(new Error("docker_recovery_record_failed"), "fixture-probe", {
    submissionStarted: true,
    recoveryId: null,
    hostRecoveryId: "host.internal-token-must-not-leak",
    rollbackFailed: true
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_submission_rollback_failed");
  assert.equal(result.retainOperationDirectories, true);
  assert.equal(result.hostCleanupCompleted, false);
  assert.equal(result.recoveryId, null);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(JSON.stringify(result).includes("internal-token"), false);

  const cancelled = normalizeDockerProbeFailure(new Error("docker_recovery_record_failed"), "fixture-probe", {
    submissionStarted: false,
    recoveryId: null,
    hostRecoveryId: "host.fixture-token",
    rollbackFailed: false
  });
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
  assert.deepEqual(recovered, { status: "recovered", reason: "host_root_already_absent" });
  assert.equal(recoverOwnedOperationDirectories(token).status, "blocked");
});

test("Host cleanupはeventsとprojectionを含む6 childを所有確認する", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-all-children-"));
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
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-unknown-child-"));
  try {
    const owned = createOwnedOperationDirectories(parent);
    const unknown = path.join(owned.root, "unknown.txt");
    fs.writeFileSync(unknown, "keep", "utf8");
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /unknown_child/u);
    assert.equal(fs.readFileSync(unknown, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Host cleanupはprojectionのlink置換を拒否する", (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-linked-projection-"));
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-projection-original`;
    const target = path.join(parent, "projection-target");
    fs.renameSync(owned.directories.projection, original);
    fs.mkdirSync(target);
    try {
      fs.symlinkSync(target, owned.directories.projection, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) return t.skip(`link fixture unavailable: ${error.code}`);
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
  const marker = path.join(os.tmpdir(), "crdd-coordinator-recovery-v1", `host-${createHash("sha256").update(nonce).digest("hex")}.json`);
  const original = fs.readFileSync(marker, "utf8");
  const changed = JSON.parse(original);
  changed.state = "docker_absent_confirmed";
  fs.writeFileSync(marker, `${JSON.stringify(changed)}\n`, "utf8");
  assert.throws(() => getOwnedHostRecoveryId(owned), /record_mismatch/u);
  assert.throws(() => cleanupOwnedOperationDirectories(owned), /record_mismatch/u);
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
    management: recordedIdentity(owned.directories.management)
  };
  fs.rmSync(owned.directories.events, { recursive: true, force: false });
  const partial = classifyRecoveryChildren(owned.root, identities);
  assert.equal(partial.present.includes("events"), false);
  assert.equal(partial.present.includes("management"), true);
  const unknown = path.join(owned.root, "unknown.txt");
  fs.writeFileSync(unknown, "keep", "utf8");
  assert.throws(() => classifyRecoveryChildren(owned.root, identities), /unknown_child/u);
  fs.rmSync(unknown);
  assert.equal(recoverOwnedOperationDirectories(token).status, "recovered");
});

test("Docker不存在確定後のHost cleanup失敗は更新後Host tokenを返す", () => {
  const hostToken = `host.crdd-coordinator-doctor-test.${"a".repeat(8)}-${"b".repeat(4)}-${"c".repeat(4)}-${"d".repeat(4)}-${"e".repeat(12)}.${"f".repeat(64)}`;
  const normalized = normalizeHostCleanupResult(
    { status: "blocked", reason: "host_recovery_unknown_child" },
    hostToken,
    { status: "confirmed" },
    "probe"
  );
  assert.equal(normalized.status, "blocked");
  assert.equal(normalized.recoveryId, hostToken);
  assert.equal(normalized.hostCleanupCompleted, false);
});
