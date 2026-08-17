import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWindowsProvisionerInstallDaclForEffect,
  describeWindowsPackageDaclContract,
  evaluateWindowsPackageDaclObservationCandidate,
  inspectWindowsPackageDaclCandidate,
} from "../src/security/platform-provisioner-windows-dacl.ts";

const VALID = Object.freeze({
  entityCount: 10,
  rootDaclProtected: true,
  allOwnersTrusted: true,
  untrustedWriteAceCount: 0,
  runtimeReadExecuteEntityCount: 10,
  runtimeRootInheritanceRuleCount: 1,
  runtimeWriteAceCount: 0,
  runtimeDenyAceCount: 0,
  reparsePointCount: 0,
});

test("Windows package DACL precheck keeps caller claims non-authoritative", () => {
  const result = evaluateWindowsPackageDaclObservationCandidate(VALID);
  assert.equal(result.status, "candidate");
  assert.equal(result.writePolicyConfirmed, false);
  assert.equal(result.runtimeReadConfirmed, false);
  assert.equal(result.runtimePrincipalBound, false);
  assert.equal(result.permissionMutationIssued, false);
  assert.equal(result.runtimeAuthorityConferred, false);
});

test("Windows package DACL precheck rejects inheritance owner writer and reparse failures", () => {
  for (const [invalid, reason] of [
    [
      { ...VALID, rootDaclProtected: false },
      "windows_package_dacl_inheritance_not_protected",
    ],
    [
      { ...VALID, allOwnersTrusted: false },
      "windows_package_dacl_owner_not_trusted",
    ],
    [
      { ...VALID, untrustedWriteAceCount: 1 },
      "windows_package_dacl_untrusted_write_rejected",
    ],
    [
      { ...VALID, reparsePointCount: 1 },
      "windows_package_dacl_reparse_rejected",
    ],
    [
      { ...VALID, runtimeWriteAceCount: 1 },
      "windows_package_dacl_runtime_write_rejected",
    ],
    [
      { ...VALID, runtimeDenyAceCount: 1 },
      "windows_package_dacl_runtime_deny_rejected",
    ],
    [
      { ...VALID, runtimeRootInheritanceRuleCount: 0 },
      "windows_package_dacl_runtime_root_rule_invalid",
    ],
    [
      { ...VALID, runtimeReadExecuteEntityCount: 9 },
      "windows_package_dacl_runtime_read_execute_incomplete",
    ],
  ] as const) {
    const result = evaluateWindowsPackageDaclObservationCandidate(invalid);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, reason);
  }
});

test("Windows package DACL precheck rejects dynamic and malformed observations", () => {
  assert.equal(
    evaluateWindowsPackageDaclObservationCandidate({ ...VALID, extra: true })
      .status,
    "blocked",
  );
  assert.equal(
    evaluateWindowsPackageDaclObservationCandidate(
      new Proxy(VALID, { ownKeys: () => Reflect.ownKeys(VALID) }),
    ).status,
    "blocked",
  );
});

test("Windows package DACL observer and Effect remain unimplemented", () => {
  let accessCount = 0;
  const unreadInput = new Proxy(
    {},
    {
      get() {
        accessCount++;
        throw new Error("must_not_read");
      },
    },
  );
  for (const result of [
    inspectWindowsPackageDaclCandidate(unreadInput, unreadInput),
    applyWindowsProvisionerInstallDaclForEffect(unreadInput, unreadInput),
  ]) {
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "windows_package_effective_access_adapter_not_implemented",
    );
    assert.equal(result.filesystemEffectIssued, false);
  }
  assert.equal(accessCount, 0);
  const contract = describeWindowsPackageDaclContract();
  assert.equal(
    contract.rustObservationCore,
    "implemented_candidate_component_only",
  );
  assert.equal(
    contract.binaryReleaseIdentityBinding,
    "implemented_candidate_signed_manifest",
  );
  assert.equal(
    contract.processInvocation,
    "blocked_until_protected_active_generation_and_verified_image_binding",
  );
  assert.equal(
    contract.observer,
    "not_implemented_observation_mapping_required",
  );
  assert.equal(
    contract.verification,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.runtimeReadBinding,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.runtimePrincipalSelection,
    "not_implemented_effective_token_required",
  );
  assert.equal(
    contract.permissionMutation,
    "not_implemented_effective_access_required",
  );
});

test("Windows package DACL result does not disclose paths principals or rules", () => {
  const serialized = JSON.stringify(
    evaluateWindowsPackageDaclObservationCandidate(VALID),
  );
  for (const forbidden of ["path", "sid", "ace", "descriptor", "powershell"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
});
