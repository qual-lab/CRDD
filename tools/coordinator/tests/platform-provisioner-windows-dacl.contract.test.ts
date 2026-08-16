import assert from "node:assert/strict";
import test from "node:test";

import {
  describeWindowsPackageDaclContract,
  evaluateWindowsPackageDaclObservationCandidate,
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

test("Windows package DACL precheck binds write protection and runtime read execute", () => {
  const result = evaluateWindowsPackageDaclObservationCandidate(VALID);
  assert.equal(result.status, "candidate");
  assert.equal(result.writePolicyConfirmed, true);
  assert.equal(result.runtimeReadConfirmed, true);
  assert.equal(result.runtimePrincipalBound, true);
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

test("Windows package DACL contract implements runtime read but keeps effects closed", () => {
  const contract = describeWindowsPackageDaclContract();
  assert.equal(
    contract.verification,
    "implemented_write_and_runtime_read_execute_policy_candidate",
  );
  assert.equal(contract.runtimeReadBinding, "implemented_candidate");
  assert.equal(
    contract.runtimePrincipalSelection,
    "current_windows_identity_by_default_or_explicit_service_sid",
  );
  assert.equal(contract.permissionMutation, "prohibited");
});

test("Windows package DACL result does not disclose paths principals or rules", () => {
  const serialized = JSON.stringify(
    evaluateWindowsPackageDaclObservationCandidate(VALID),
  );
  for (const forbidden of ["path", "sid", "ace", "descriptor", "powershell"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
});
