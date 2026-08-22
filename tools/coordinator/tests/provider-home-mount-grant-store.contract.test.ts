import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import test from "node:test";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationDirectories,
} from "../src/security/execution-environment.ts";
import {
  consumeProviderHomeMountGrantForEffect,
  describeProviderHomeMountGrantStoreContract,
  issueProviderHomeMountGrantForEffect,
  revokeProviderHomeMountGrantForEffect,
} from "../src/security/provider-home-mount-grant-store.ts";

const hashes = Object.freeze({
  providerHomeIdentityHash: "a".repeat(64),
  providerHomeProtectionHash: "b".repeat(64),
  localUserBindingHash: "c".repeat(64),
});

function input(overrides: Record<string, unknown> = {}) {
  return {
    provider: "claude",
    profileId: "PROFILE-000001",
    operationId: "OP-000001",
    ...hashes,
    lifetimeMs: 60_000,
    ...overrides,
  };
}

function observations(overrides: Record<string, unknown> = {}) {
  return {
    observedProviderHomeIdentityHash: hashes.providerHomeIdentityHash,
    observedProviderHomeProtectionHash: hashes.providerHomeProtectionHash,
    observedLocalUserBindingHash: hashes.localUserBindingHash,
    ...overrides,
  };
}

function ownedFixture() {
  const parent = fs.mkdtempSync(`${os.tmpdir()}\\crdd-grant-store-test-`);
  const owned = createOwnedOperationDirectories(parent);
  const mount = createOwnedMountCapability(owned);
  return {
    owned,
    mount,
    cleanup() {
      cleanupOwnedOperationDirectories(owned);
      fs.rmSync(parent, { recursive: true });
    },
  };
}

test("Runtime所有storeでGrantを発行・一回消費・失効する", () => {
  const fixture = ownedFixture();
  try {
    const issued = issueProviderHomeMountGrantForEffect(fixture.mount, input());
    assert.equal(issued.status, "issued");
    assert.equal(issued.providerHomeMountGrantIssued, true);
    assert.equal(issued.filesystemEffectIssued, true);
    assert.equal(issued.runtimeAuthorityIssued, true);
    assert.equal(issued.pathReported, false);
    assert.ok(issued.grantCapability);

    const consumed = consumeProviderHomeMountGrantForEffect(
      issued.grantCapability,
      observations(),
    );
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.mountAuthorizationIssued, true);
    assert.equal(consumed.operationCapabilityIssued, true);
    assert.ok(consumed.mountAuthorizationCapability);

    const reused = consumeProviderHomeMountGrantForEffect(
      issued.grantCapability,
      observations(),
    );
    assert.equal(reused.status, "blocked");
    assert.equal(reused.reason, "provider_home_mount_grant_not_usable");

    const revoked = revokeProviderHomeMountGrantForEffect(
      consumed.mountAuthorizationCapability,
    );
    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.filesystemEffectIssued, true);
    assert.equal(revoked.pathReported, false);
  } finally {
    fixture.cleanup();
  }
});

test("不正入力、観測差、重複storeおよび無効Capabilityをfail closedにする", () => {
  const fixture = ownedFixture();
  try {
    for (const changed of [
      { provider: "other" },
      { profileId: "PROFILE-x" },
      { operationId: "OP-x" },
      { providerHomeIdentityHash: "x" },
      { providerHomeProtectionHash: "x" },
      { localUserBindingHash: "x" },
      { lifetimeMs: 0 },
      { lifetimeMs: 300_001 },
      { lifetimeMs: 1.5 },
    ]) {
      assert.equal(
        issueProviderHomeMountGrantForEffect(fixture.mount, input(changed))
          .status,
        "blocked",
      );
    }
    assert.equal(
      issueProviderHomeMountGrantForEffect(fixture.mount, {
        ...input(),
        extra: true,
      }).reason,
      "provider_home_mount_grant_issue_input_invalid",
    );
    assert.equal(
      issueProviderHomeMountGrantForEffect({}, input()).reason,
      "provider_home_mount_grant_issue_failed",
    );

    const issued = issueProviderHomeMountGrantForEffect(fixture.mount, input());
    assert.equal(issued.status, "issued");
    assert.equal(
      issueProviderHomeMountGrantForEffect(fixture.mount, input()).reason,
      "provider_home_mount_grant_store_already_exists",
    );
    assert.equal(
      consumeProviderHomeMountGrantForEffect(
        issued.grantCapability,
        observations({ observedProviderHomeIdentityHash: "d".repeat(64) }),
      ).reason,
      "provider_home_mount_grant_use_observation_mismatch",
    );
    assert.equal(
      consumeProviderHomeMountGrantForEffect(issued.grantCapability, {
        ...observations(),
        extra: true,
      }).reason,
      "provider_home_mount_grant_use_observation_invalid",
    );
    assert.equal(
      consumeProviderHomeMountGrantForEffect({}, observations()).reason,
      "provider_home_mount_grant_use_failed",
    );
    assert.equal(
      revokeProviderHomeMountGrantForEffect({}).reason,
      "provider_home_mount_grant_revoke_failed",
    );
    const revoked = revokeProviderHomeMountGrantForEffect(
      issued.grantCapability,
    );
    assert.equal(revoked.status, "revoked");
    assert.equal(
      revokeProviderHomeMountGrantForEffect(issued.grantCapability).reason,
      "provider_home_mount_grant_revoke_failed",
    );
  } finally {
    fixture.cleanup();
  }
});

test("Grant store契約は残るmount統合境界を明示する", () => {
  const contract = describeProviderHomeMountGrantStoreContract();
  assert.equal(contract.runtimeOwnedClock, "implemented");
  assert.equal(contract.runtimeOwnedIssuer, "implemented");
  assert.equal(
    contract.runtimeOwnedAtomicStore,
    "implemented_operation_management_scope",
  );
  assert.equal(contract.oneTimeConsumption, "implemented");
  assert.equal(contract.explicitRevocation, "implemented");
  assert.equal(contract.operationEndRevocation, "integration_pending");
  assert.equal(contract.mountAdapter, "not_implemented");
  assert.equal(contract.storePathReported, false);
  assert.equal(contract.grantRecordReported, false);
  assert.equal(contract.credentialReported, false);
});
