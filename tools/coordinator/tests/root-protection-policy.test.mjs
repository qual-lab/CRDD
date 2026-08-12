import assert from "node:assert/strict";
import test from "node:test";

import {
  describeRootProtectionPolicyContract,
  evaluateRootProtectionPolicyCandidate
} from "../src/security/root-protection-policy.mjs";

function observations(overrides = {}) {
  return {
    rootExists: true,
    stableIdentityObserved: true,
    linkOrReparseObserved: false,
    runtimeReadAllowed: true,
    runtimeWriteAllowed: true,
    writeAuthority: "runtime_principal_only",
    untrustedWriteAllowed: false,
    ...overrides
  };
}

function input(overrides = {}) {
  return {
    rootRole: "runtime",
    platformFamily: "windows",
    filesystemClass: "local",
    observations: observations(),
    ...overrides
  };
}

test("WindowsとPOSIXのlocal／persistent volume claimを候補に限定する", () => {
  for (const platformFamily of ["windows", "posix"]) {
    for (const filesystemClass of ["local", "persistent_volume"]) {
      const runtime = evaluateRootProtectionPolicyCandidate(input({ platformFamily, filesystemClass }));
      assert.equal(runtime.status, "candidate");
      assert.equal(runtime.reason, "root_protection_platform_adapter_verification_required");
      assert.equal(runtime.policy.runtimeAccess, "read_write");
      assert.equal(runtime.policy.requiredWriteAuthority, "runtime_principal_only");
      assert.equal(runtime.policy.absolutePathReported, false);
      assert.equal(runtime.filesystemEffectIssued, false);
      assert.equal(runtime.runtimeCapabilityIssued, false);

      const authority = evaluateRootProtectionPolicyCandidate(input({
        rootRole: "authority",
        platformFamily,
        filesystemClass,
        observations: observations({
          runtimeWriteAllowed: false,
          writeAuthority: "provisioner_principal_only"
        })
      }));
      assert.equal(authority.status, "candidate");
      assert.equal(authority.policy.runtimeAccess, "read_only");
      assert.equal(authority.policy.requiredWriteAuthority, "provisioner_principal_only");
      assert.equal(authority.runtimeCapabilityIssued, false);
    }
  }
});

test("unsupported platformとFilesystem classをfail closedにする", () => {
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ platformFamily: "unknown" })).reason,
    "root_protection_platform_unsupported");
  for (const filesystemClass of ["network", "removable", "special", "unknown"]) {
    assert.equal(evaluateRootProtectionPolicyCandidate(input({ filesystemClass })).reason,
      "root_protection_filesystem_unsupported");
  }
});

test("欠落、Identity不明、linkおよび非承認書込みを拒否する", () => {
  const cases = [
    ["root_protection_root_missing", { rootExists: false }],
    ["root_protection_stable_identity_required", { stableIdentityObserved: false }],
    ["root_protection_link_or_reparse_rejected", { linkOrReparseObserved: true }],
    ["root_protection_untrusted_write_rejected", { untrustedWriteAllowed: true }]
  ];
  for (const [reason, override] of cases) {
    assert.equal(evaluateRootProtectionPolicyCandidate(input({
      observations: observations(override)
    })).reason, reason);
  }
});

test("Runtime RootとAuthority Rootの主体別access policyを区別する", () => {
  for (const override of [
    { runtimeReadAllowed: false },
    { runtimeWriteAllowed: false },
    { writeAuthority: "provisioner_principal_only" }
  ]) {
    assert.equal(evaluateRootProtectionPolicyCandidate(input({
      observations: observations(override)
    })).reason, "runtime_root_access_policy_not_satisfied");
  }
  for (const override of [
    { runtimeReadAllowed: false, runtimeWriteAllowed: false,
      writeAuthority: "provisioner_principal_only" },
    { runtimeWriteAllowed: true, writeAuthority: "provisioner_principal_only" },
    { runtimeWriteAllowed: false, writeAuthority: "runtime_principal_only" }
  ]) {
    assert.equal(evaluateRootProtectionPolicyCandidate(input({
      rootRole: "authority",
      observations: observations(override)
    })).reason, "authority_root_access_policy_not_satisfied");
  }
});

test("exact plain-data以外と欠落観測を処置前に拒否する", () => {
  let getterCalls = 0;
  const accessor = input();
  Object.defineProperty(accessor, "observations", {
    enumerable: true,
    get() { getterCalls += 1; return observations(); }
  });
  assert.equal(evaluateRootProtectionPolicyCandidate(accessor).reason, "root_protection_input_invalid");
  assert.equal(getterCalls, 0);

  const nested = observations();
  Object.defineProperty(nested, "runtimeWriteAllowed", {
    enumerable: true,
    get() { getterCalls += 1; return true; }
  });
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ observations: nested })).reason,
    "root_protection_observations_invalid");
  assert.equal(getterCalls, 0);
  const writerAccessor = observations();
  Object.defineProperty(writerAccessor, "writeAuthority", {
    enumerable: true,
    get() { getterCalls += 1; return "runtime_principal_only"; }
  });
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ observations: writerAccessor })).reason,
    "root_protection_observations_invalid");
  assert.equal(getterCalls, 0);

  const extra = input();
  extra.extra = true;
  assert.equal(evaluateRootProtectionPolicyCandidate(extra).reason, "root_protection_input_invalid");
  const symbol = input();
  symbol[Symbol("extra")] = true;
  assert.equal(evaluateRootProtectionPolicyCandidate(symbol).reason, "root_protection_input_invalid");
  assert.equal(evaluateRootProtectionPolicyCandidate(Object.assign(Object.create({}), input())).reason,
    "root_protection_input_invalid");
  const missing = observations();
  delete missing.rootExists;
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ observations: missing })).reason,
    "root_protection_observations_invalid");
  const missingWriter = observations();
  delete missingWriter.writeAuthority;
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ observations: missingWriter })).reason,
    "root_protection_observations_invalid");
  assert.equal(evaluateRootProtectionPolicyCandidate(new Proxy(input(), {})).reason,
    "root_protection_input_invalid");
  assert.equal(evaluateRootProtectionPolicyCandidate(input({
    observations: new Proxy(observations(), {})
  })).reason, "root_protection_observations_invalid");
  assert.equal(evaluateRootProtectionPolicyCandidate(input({
    observations: Object.assign(Object.create({}), observations())
  })).reason, "root_protection_observations_invalid");
  const nestedSymbol = observations();
  nestedSymbol[Symbol("extra")] = true;
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ observations: nestedSymbol })).reason,
    "root_protection_observations_invalid");
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ platformFamily: "x".repeat(33) })).reason,
    "root_protection_input_invalid");
  assert.equal(evaluateRootProtectionPolicyCandidate(input({ rootRole: null })).reason,
    "root_protection_input_invalid");
  assert.equal(evaluateRootProtectionPolicyCandidate(input({
    observations: observations({ writeAuthority: "unknown" })
  })).reason, "root_protection_observations_invalid");
});

test("通常、null-prototypeおよびfreeze済みinputを受理する", () => {
  const nullObservations = Object.assign(Object.create(null), observations());
  const nullInput = Object.assign(Object.create(null), input({ observations: nullObservations }));
  assert.equal(evaluateRootProtectionPolicyCandidate(nullInput).status, "candidate");
  assert.equal(evaluateRootProtectionPolicyCandidate(Object.freeze(input({
    observations: Object.freeze(observations())
  }))).status, "candidate");
});

test("contractはclaim候補と未実装Adapter／Effect／Capabilityを分離する", () => {
  const contract = describeRootProtectionPolicyContract();
  assert.deepEqual(contract.supportedPlatformFamilies, ["windows", "posix"]);
  assert.equal(contract.inputTokenLength, 32);
  assert.deepEqual(contract.supportedFilesystemClasses, ["local", "persistent_volume"]);
  assert.deepEqual(contract.writeAuthorityValues,
    ["runtime_principal_only", "provisioner_principal_only"]);
  assert.equal(contract.runtimeRootProtection,
    "runtime_principal_only_read_write_and_no_other_writer");
  assert.equal(contract.authorityRootProtection,
    "provisioner_principal_only_write_runtime_read_only_and_no_other_writer");
  assert.equal(contract.writerExclusivityScope,
    "ordinary_access_control_entries_excluding_trusted_platform_administrator_override");
  assert.deepEqual(contract.trustedPlatformAdministratorBoundary, [
    "windows_system_and_machine_administrators",
    "posix_root"
  ]);
  assert.equal(Object.isFrozen(contract.trustedPlatformAdministratorBoundary), true);
  assert.equal(contract.administratorOriginatedChangeDetection,
    "runtime_owned_revalidation_detects_observable_identity_protection_or_trust_change_and_fails_closed");
  assert.equal(contract.administratorOriginatedObservableChangeResponse,
    "blocked_reverification_then_reprovision_only_after_trust_base_confirmed_or_platform_recovery");
  assert.equal(contract.confirmedOrSuspectedPlatformAdministratorCompromiseResponse,
    "blocked_platform_recovery_required_before_reprovision");
  assert.equal(contract.ambiguousAdministratorChangeClassification,
    "fail_closed_as_suspected_compromise");
  assert.equal(contract.platformRecoveryImplementation, "not_implemented");
  assert.equal(["administrator", "CompromiseResponse"].join("") in contract, false);
  assert.equal(contract.completeOsOrVerifierCompromiseProtection, "not_guaranteed");
  assert.equal(contract.callerObservationsAreAuthority, false);
  assert.equal(contract.protectionPolicyCore, "implemented_candidate_claim_only");
  assert.equal(contract.posixRuntimeRootPrecheckEntry, "implemented_fail_closed");
  assert.equal(contract.posixRuntimeRootModeObservation, "not_implemented");
  assert.equal(contract.posixOwnerModeAdapter, "not_implemented");
  assert.equal(contract.posixAclVerification, "not_implemented");
  assert.equal(contract.runtimePrincipalBinding, "not_implemented");
  assert.equal(contract.windowsDaclAdapter, "not_implemented");
  assert.equal(contract.posixOwnerModeAdapter, "not_implemented");
  assert.equal(contract.persistentVolumeAdapter, "not_implemented");
  assert.equal(contract.rootCreationIssued, false);
  assert.equal(contract.permissionMutationIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
