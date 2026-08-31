import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeRuntimeOwnedProviderAuthority,
  createIsolatedProviderAuthorityRuntimeCandidate,
  describeProviderAuthorityRuntimeContract,
  issueRuntimeOwnedProviderAuthority,
  revokeRuntimeOwnedProviderAuthority,
} from "../src/security/provider-authority-runtime.ts";

function createFixture() {
  const managementCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  let wallClockMs = 1_000;
  let monotonicMs = 2_000;
  let randomValue = 0;
  let bundleRevision = 1;
  let mountIsActive = true;
  let sourceIsAvailable = true;
  let reverifyFault:
    | "blocked"
    | "provider"
    | "profileId"
    | "operationId"
    | "scopeId"
    | "providerHomeMountGrantRef"
    | null = null;
  const runtime = createIsolatedProviderAuthorityRuntimeCandidate({
    verifyOperation: (capability: unknown) => {
      assert.equal(capability, managementCapability);
      return Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
      });
    },
    inspectActiveMount: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return Object.freeze({
        status: mountIsActive ? "active" : "blocked",
        grantRef: "PHMGRANT-123456",
        provider: "claude",
        profileId: "PROFILE-123456",
        operationId: "OP-123456",
        providerHomeMountGrantIssued: mountIsActive,
        providerHomeMounted: mountIsActive,
      });
    },
    loadActivatedAuthority: (binding) => {
      assert.deepEqual(binding, {
        operationId: "OP-123456",
        provider: "claude",
        profileId: "PROFILE-123456",
      });
      return sourceIsAvailable
        ? Object.freeze({
            profile: Object.freeze({}),
            bundle: Object.freeze({ bundleRevision }),
            scopeId: "SCOPE-123456",
          })
        : null;
    },
    reverify: (_profile: unknown, bundle: unknown, context: unknown) => {
      if (reverifyFault === "blocked") {
        return Object.freeze({
          status: "blocked",
          reason: "fixture_reverification_rejected",
          verification: null,
          runtimeCapabilityIssued: false,
        });
      }
      const bundleRecord = bundle as { bundleRevision: number };
      const contextRecord = context as Record<string, string>;
      return Object.freeze({
        status: "candidate" as const,
        reason: "runtime_file_bundle_path_acl_and_activation_required",
        verification: Object.freeze({
          profileHash: "1".repeat(64),
          registryId: "AUTHREG-123456",
          registryRevision: 1,
          registryHash: "2".repeat(64),
          grantRef: "AUTH-123456",
          grantRevision: 1,
          provider: contextRecord.provider as string,
          profileId: contextRecord.profileId as string,
          operationId: contextRecord.operationId as string,
          scopeId: contextRecord.scopeId as string,
          providerHomeMountGrantRef:
            contextRecord.providerHomeMountGrantRef as string,
          providerHomeMountGrantIssued: false,
          providerHomeMountGrantVerification: "runtime_capability_required",
          bundleId: "AUTHBUNDLE-123456",
          bundleRevision: bundleRecord.bundleRevision,
          bundleHash: String(bundleRecord.bundleRevision).repeat(64),
          trustPolicyId: "AUTHPOL-123456",
          trustPolicyRevision: 1,
          trustPolicyHash: "4".repeat(64),
          evaluatedAt: "2026-08-24T00:00:00.000Z",
          validUntil: "2026-08-25T00:00:00.000Z",
          prelaunchCheckedAt: "2026-08-24T00:00:00.000Z",
          ...(reverifyFault === null
            ? {}
            : {
                [reverifyFault]:
                  reverifyFault === "provider"
                    ? "codex"
                    : reverifyFault === "profileId"
                      ? "PROFILE-654321"
                      : reverifyFault === "operationId"
                        ? "OP-654321"
                        : reverifyFault === "scopeId"
                          ? "SCOPE-654321"
                          : "PHMGRANT-654321",
              }),
        }),
        runtimeCapabilityIssued: false,
      });
    },
    wallNow: () => wallClockMs,
    monotonicNow: () => monotonicMs,
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
  });
  return Object.freeze({
    runtime,
    managementCapability,
    activeMountCapability,
    advance: (milliseconds: number) => {
      wallClockMs += milliseconds;
      monotonicMs += milliseconds;
    },
    rollbackWallClock: () => {
      wallClockMs -= 1;
    },
    changeBundle: () => {
      bundleRevision += 1;
    },
    deactivateMount: () => {
      mountIsActive = false;
    },
    removeSource: () => {
      sourceIsAvailable = false;
    },
    setReverifyFault: (fault: typeof reverifyFault) => {
      reverifyFault = fault;
    },
  });
}

test("active MountとAuthority identityを5秒一回限りCapabilityへ結合する", () => {
  const fixture = createFixture();
  const issued = fixture.runtime.issue(
    fixture.managementCapability,
    fixture.activeMountCapability,
  );
  assert.equal(issued.status, "issued");
  assert.match(issued.authorityRecordId ?? "", /^PROVAUTH-[A-F0-9]{24}$/u);
  assert.equal(issued.operationId, "OP-123456");
  assert.equal(issued.provider, "claude");
  assert.equal(issued.profileId, "PROFILE-123456");
  assert.equal(issued.scopeId, "SCOPE-123456");
  assert.equal(issued.providerHomeMountGrantRef, "PHMGRANT-123456");
  assert.equal(issued.runtimeAuthorityIssued, true);
  assert.equal(issued.providerEffectAllowed, false);
  assert.equal(issued.expiresInMs, 5_000);

  const consumed = fixture.runtime.consume(
    issued.useCapability,
    fixture.activeMountCapability,
    fixture.managementCapability,
  );
  assert.ok(consumed);
  assert.equal(consumed.runtimeAuthorityIssued, true);
  assert.equal(consumed.providerEffectAllowed, true);
  assert.equal(
    fixture.runtime.consume(
      issued.useCapability,
      fixture.activeMountCapability,
      fixture.managementCapability,
    ),
    null,
  );
});

for (const fault of [
  "blocked",
  "provider",
  "profileId",
  "operationId",
  "scopeId",
  "providerHomeMountGrantRef",
] as const) {
  test(`発行時のreverify ${fault}をAuthority Capabilityへ昇格しない`, () => {
    const fixture = createFixture();
    fixture.setReverifyFault(fault);
    const result = fixture.runtime.issue(
      fixture.managementCapability,
      fixture.activeMountCapability,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "provider_authority_prelaunch_verification_invalid",
    );
    assert.equal(result.controlCapability, null);
    assert.equal(result.useCapability, null);
    assert.equal(result.authorityRecordId, null);
    assert.equal(result.runtimeAuthorityIssued, false);
    assert.equal(result.providerEffectAllowed, false);
  });

  test(`消費時のreverify ${fault}は元Capabilityを失効して再利用させない`, () => {
    const fixture = createFixture();
    const issued = fixture.runtime.issue(
      fixture.managementCapability,
      fixture.activeMountCapability,
    );
    assert.equal(issued.status, "issued");
    fixture.setReverifyFault(fault);
    assert.equal(
      fixture.runtime.consume(
        issued.useCapability,
        fixture.activeMountCapability,
        fixture.managementCapability,
      ),
      null,
    );
    fixture.setReverifyFault(null);
    assert.equal(
      fixture.runtime.consume(
        issued.useCapability,
        fixture.activeMountCapability,
        fixture.managementCapability,
      ),
      null,
    );
    assert.equal(
      fixture.runtime.revoke(
        issued.controlCapability,
        fixture.managementCapability,
      ).reason,
      "provider_authority_control_invalid",
    );
  });
}

test("consume直前のBundle差とMount失効をAuthorityへ流用しない", () => {
  const changed = createFixture();
  const changedIssued = changed.runtime.issue(
    changed.managementCapability,
    changed.activeMountCapability,
  );
  changed.changeBundle();
  assert.equal(
    changed.runtime.consume(
      changedIssued.useCapability,
      changed.activeMountCapability,
      changed.managementCapability,
    ),
    null,
  );

  const inactive = createFixture();
  const inactiveIssued = inactive.runtime.issue(
    inactive.managementCapability,
    inactive.activeMountCapability,
  );
  inactive.deactivateMount();
  assert.equal(
    inactive.runtime.consume(
      inactiveIssued.useCapability,
      inactive.activeMountCapability,
      inactive.managementCapability,
    ),
    null,
  );
});

test("期限、clock rollback、source欠落と別Mountをfail closedにする", () => {
  const expired = createFixture();
  const expiredIssued = expired.runtime.issue(
    expired.managementCapability,
    expired.activeMountCapability,
  );
  expired.advance(5_000);
  assert.equal(
    expired.runtime.consume(
      expiredIssued.useCapability,
      expired.activeMountCapability,
      expired.managementCapability,
    ),
    null,
  );

  const rollback = createFixture();
  const rollbackIssued = rollback.runtime.issue(
    rollback.managementCapability,
    rollback.activeMountCapability,
  );
  rollback.rollbackWallClock();
  assert.equal(
    rollback.runtime.consume(
      rollbackIssued.useCapability,
      rollback.activeMountCapability,
      rollback.managementCapability,
    ),
    null,
  );

  const missing = createFixture();
  missing.removeSource();
  assert.equal(
    missing.runtime.issue(
      missing.managementCapability,
      missing.activeMountCapability,
    ).status,
    "blocked",
  );

  const wrongMount = createFixture();
  const wrongMountIssued = wrongMount.runtime.issue(
    wrongMount.managementCapability,
    wrongMount.activeMountCapability,
  );
  assert.equal(
    wrongMount.runtime.consume(
      wrongMountIssued.useCapability,
      {},
      wrongMount.managementCapability,
    ),
    null,
  );
});

test("control aliasは未使用Authorityを全aliasごと失効する", () => {
  const fixture = createFixture();
  const issued = fixture.runtime.issue(
    fixture.managementCapability,
    fixture.activeMountCapability,
  );
  assert.equal(
    fixture.runtime.revoke(
      issued.controlCapability,
      fixture.managementCapability,
    ).status,
    "revoked",
  );
  assert.equal(
    fixture.runtime.consume(
      issued.useCapability,
      fixture.activeMountCapability,
      fixture.managementCapability,
    ),
    null,
  );
});

test("偽造production Capabilityと公開契約はProvider Effect前に閉じる", () => {
  assert.equal(issueRuntimeOwnedProviderAuthority({}, {}).status, "blocked");
  assert.equal(consumeRuntimeOwnedProviderAuthority({}, {}, {}), null);
  assert.equal(revokeRuntimeOwnedProviderAuthority({}, {}).status, "blocked");
  const contract = describeProviderAuthorityRuntimeContract();
  assert.equal(contract.authorityLifetimeMs, 5_000);
  assert.deepEqual(contract.aliases, ["control", "use"]);
  assert.equal(contract.maximumUses, 1);
  assert.equal(contract.providerEffectAllowedBeforeConsume, false);
  assert.equal(contract.rawAuthoritySourceReported, false);
  assert.equal(contract.contractRevision, 2);
  assert.equal(
    contract.productionActivatedAuthoritySourceLoader,
    "signed_release_bound_local_personal_connected",
  );
});
