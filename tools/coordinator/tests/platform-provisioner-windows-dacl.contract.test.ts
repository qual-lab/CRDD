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
  reparsePointCount: 0,
});

test("Windows package DACL precheck confirms only the write policy", () => {
  const result = evaluateWindowsPackageDaclObservationCandidate(VALID);
  assert.equal(result.status, "candidate");
  assert.equal(result.writePolicyConfirmed, true);
  assert.equal(result.runtimeReadConfirmed, false);
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

test("Windows package DACL contract keeps runtime read and effects closed", () => {
  const contract = describeWindowsPackageDaclContract();
  assert.equal(
    contract.verification,
    "implemented_write_policy_precheck_candidate",
  );
  assert.equal(contract.runtimeReadBinding, "not_implemented");
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
