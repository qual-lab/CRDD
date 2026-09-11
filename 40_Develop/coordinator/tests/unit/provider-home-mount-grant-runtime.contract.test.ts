import assert from "node:assert/strict";
import test from "node:test";

import type { OwnedOperationManagementBinding } from "../../src/security/execution-environment.ts";
import {
  consumeRuntimeOwnedProviderHomeMountGrant,
  createIsolatedProviderHomeMountGrantRuntimeCandidate,
  describeProviderHomeMountGrantRuntimeContract,
  inspectRuntimeOwnedActiveProviderHomeMount,
  inspectRuntimeOwnedProviderHomeMountAuthorization,
  issueRuntimeOwnedProviderHomeMountGrant,
  PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT,
  PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT_REVISION,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "../../src/security/provider-home-mount-grant-runtime.ts";
import { PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS } from "../../src/security/provider-home-mount-grant.ts";

const identityHash = "1".repeat(64);
const protectionHash = "2".repeat(64);
const userHash = "3".repeat(64);

type Observation = Readonly<{
  provider: "codex" | "claude";
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  observedWallClockMs: number;
  observedMonotonicMs: number;
  providerHomeMountSourceCapability: object;
}>;

function harness() {
  const managementCapability = Object.freeze({});
  const otherManagementCapability = Object.freeze({});
  const observations = new WeakMap<object, Observation>();
  const mountSources = new WeakMap<object, string>();
  let latestMountSourceCapability: object | null = null;
  let wallClockMs = Date.parse("2026-08-24T00:00:00.000Z");
  let monotonicMs = 10_000;
  let randomValue = 0n;
  let failingDependency: "none" | "clock" | "random" | "observation" = "none";

  function observe(overrides: Partial<Observation> = {}) {
    const capability = Object.freeze({});
    const providerHomeMountSourceCapability = Object.freeze({});
    latestMountSourceCapability = providerHomeMountSourceCapability;
    mountSources.set(
      providerHomeMountSourceCapability,
      "C:\\Users\\selected\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude",
    );
    observations.set(
      capability,
      Object.freeze({
        provider: "claude",
        providerHomeIdentityHash: identityHash,
        providerHomeProtectionHash: protectionHash,
        localUserBindingHash: userHash,
        stableLogicalHomeBindingHash: "5".repeat(64),
        observedWallClockMs: wallClockMs,
        observedMonotonicMs: monotonicMs,
        providerHomeMountSourceCapability,
        ...overrides,
      }),
    );
    return capability;
  }

  const runtime = createIsolatedProviderHomeMountGrantRuntimeCandidate({
    verifyOperation(capability: unknown): OwnedOperationManagementBinding {
      if (capability !== managementCapability) throw new Error("not_owned");
      return Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
        managementScopeBound: true,
      });
    },
    consumeObservation(capability: unknown) {
      if (failingDependency === "observation") throw new Error("observer");
      if (!capability || typeof capability !== "object") return null;
      const observation = observations.get(capability) ?? null;
      observations.delete(capability);
      return observation;
    },
    consumeMountSource(capability, expectedProvider) {
      if (!capability || typeof capability !== "object") return null;
      const source = mountSources.get(capability) ?? null;
      mountSources.delete(capability);
      return expectedProvider === "claude" ? source : null;
    },
    revokeMountSource(capability) {
      return (
        !!capability &&
        typeof capability === "object" &&
        mountSources.delete(capability)
      );
    },
    wallNow() {
      if (failingDependency === "clock") throw new Error("clock");
      return wallClockMs;
    },
    monotonicNow() {
      if (failingDependency === "clock") throw new Error("clock");
      return monotonicMs;
    },
    randomBytes(size: number) {
      if (failingDependency === "random") throw new Error("random");
      assert.equal(size, 8);
      randomValue += 1n;
      const bytes = Buffer.alloc(8);
      bytes.writeBigUInt64BE(randomValue);
      return bytes;
    },
  });

  return {
    runtime,
    managementCapability,
    otherManagementCapability,
    observe,
    setTime(wall: number, monotonic: number) {
      wallClockMs = wall;
      monotonicMs = monotonic;
    },
    advance(milliseconds: number) {
      wallClockMs += milliseconds;
      monotonicMs += milliseconds;
    },
    fail(dependency: typeof failingDependency) {
      failingDependency = dependency;
    },
    removeLatestMountSource() {
      assert.ok(latestMountSourceCapability);
      assert.equal(mountSources.delete(latestMountSourceCapability), true);
    },
  };
}

function issue(h: ReturnType<typeof harness>) {
  const result = h.runtime.issue(
    h.managementCapability,
    h.observe(),
    "PROFILE-123456",
  );
  assert.equal(result.status, "issued");
  assert.ok(result.controlCapability);
  assert.ok(result.useCapability);
  assert.notEqual(result.controlCapability, result.useCapability);
  return result;
}

test("Runtime-owned Mount Grantはopaque Operationと観測を一回限りの別aliasへbindingする", () => {
  const h = harness();
  const result = issue(h);
  assert.equal(h.runtime.productionAuthority, false);
  assert.match(result.grantRef as string, /^PHMGRANT-[0-9]{18}$/u);
  assert.equal(result.grant?.provider, "claude");
  assert.equal(result.grant?.profileId, "PROFILE-123456");
  assert.equal(result.grant?.operationId, "OP-123456");
  assert.equal(result.grant?.usageLimit, 1);
  assert.equal(result.grant?.consumptionCount, 0);
  assert.equal(result.providerHomeMountGrantIssued, true);
  assert.equal(result.mountAuthorizationIssued, false);
  assert.equal(result.providerHomeMounted, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.networkEffectIssued, false);
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.runtimeAuthorityIssued, false);
  assert.equal(result.operationCapabilityIssued, false);
  assert.equal(result.pathReported, false);
  assert.equal(result.credentialReported, false);
  assert.equal(
    Date.parse(result.grant?.expiresAt as string) -
      Date.parse(result.grant?.issuedAt as string),
    PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
  );
});

test("fresh観測でconsumeし、productionから隔離されたMount Authorizationをrevokeする", () => {
  const h = harness();
  const issued = issue(h);
  h.advance(1_000);
  const consumed = h.runtime.consume(
    issued.useCapability,
    h.managementCapability,
    h.observe(),
  );
  assert.equal(consumed.status, "consumed");
  assert.equal(consumed.grant?.state, "consumed");
  assert.equal(consumed.grant?.consumptionCount, 1);
  assert.equal(consumed.mountAuthorizationIssued, true);
  assert.ok(consumed.mountAuthorizationCapability);
  assert.equal(
    h.runtime.consume(issued.useCapability, h.managementCapability, h.observe())
      .reason,
    "provider_home_mount_grant_runtime_use_invalid",
  );
  assert.equal(
    h.runtime.inspectMountAuthorization(
      consumed.mountAuthorizationCapability,
      h.managementCapability,
    ).status,
    "authorized",
  );
  assert.equal(
    inspectRuntimeOwnedProviderHomeMountAuthorization(
      consumed.mountAuthorizationCapability,
      h.managementCapability,
    ).status,
    "blocked",
  );

  const activated = h.runtime.activateMount(
    consumed.mountAuthorizationCapability,
    h.managementCapability,
  );
  assert.equal(activated.status, "activated");
  assert.ok(activated.activeMountCapability);
  assert.equal(
    h.runtime.borrowActiveMountSource(
      activated.activeMountCapability,
      h.managementCapability,
    ),
    "C:\\Users\\selected\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude",
  );
  const inspected = h.runtime.inspectActiveMount(
    activated.activeMountCapability,
    h.managementCapability,
  );
  assert.equal(inspected.status, "active");
  assert.equal(inspected.grantRef, issued.grantRef);
  assert.equal(inspected.provider, "claude");
  assert.equal(inspected.profileId, "PROFILE-123456");
  assert.equal(inspected.operationId, "OP-123456");
  assert.equal(inspected.providerHomeMountGrantIssued, true);
  assert.equal(inspected.providerHomeMounted, true);
  assert.equal(inspected.runtimeAuthorityIssued, false);
  assert.equal(inspected.pathReported, false);
  assert.equal(inspected.credentialReported, false);
  assert.equal(
    inspectRuntimeOwnedActiveProviderHomeMount(
      activated.activeMountCapability,
      h.managementCapability,
    ).status,
    "blocked",
  );
  assert.equal(
    h.runtime.revoke(issued.controlCapability, h.managementCapability).reason,
    "provider_home_mount_grant_runtime_unmount_required",
  );
  assert.equal(
    h.runtime.completeMount(
      activated.activeMountCapability,
      h.managementCapability,
    ).status,
    "completed",
  );
  assert.equal(
    h.runtime.inspectActiveMount(
      activated.activeMountCapability,
      h.managementCapability,
    ).status,
    "blocked",
  );

  h.advance(1_000);
  const revoked = h.runtime.revoke(
    issued.controlCapability,
    h.managementCapability,
  );
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.grant?.state, "revoked");
  assert.equal(
    h.runtime.inspectMountAuthorization(
      consumed.mountAuthorizationCapability,
      h.managementCapability,
    ).status,
    "blocked",
  );
  assert.equal(
    h.runtime.revoke(issued.controlCapability, h.managementCapability).status,
    "blocked",
  );
});

test("issuedのままでもcontrol aliasから全aliasを失効できる", () => {
  const h = harness();
  const issued = issue(h);
  assert.equal(
    h.runtime.revoke(issued.controlCapability, h.managementCapability).status,
    "revoked",
  );
  assert.equal(
    h.runtime.consume(issued.useCapability, h.managementCapability, h.observe())
      .status,
    "blocked",
  );
});

for (const failure of ["expired", "source_removed"] as const) {
  test(`consume後activate前の${failure}はactive Mountを発行せず次のGrantを妨げない`, () => {
    const h = harness();
    const issued = issue(h);
    h.advance(1);
    const consumed = h.runtime.consume(
      issued.useCapability,
      h.managementCapability,
      h.observe(),
    );
    assert.equal(consumed.status, "consumed");
    assert.ok(consumed.mountAuthorizationCapability);
    if (failure === "expired") {
      h.advance(PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS - 1);
    } else {
      h.removeLatestMountSource();
    }
    const activated = h.runtime.activateMount(
      consumed.mountAuthorizationCapability,
      h.managementCapability,
    );
    assert.equal(activated.status, "blocked");
    assert.equal(
      activated.reason,
      failure === "expired"
        ? "provider_home_mount_activation_invalid"
        : "provider_home_mount_source_binding_invalid",
    );
    assert.equal(activated.activeMountCapability, null);
    assert.equal(activated.providerHomeMounted, false);
    assert.equal(activated.runtimeAuthorityIssued, false);
    assert.equal(
      h.runtime.borrowActiveMountSource(
        consumed.mountAuthorizationCapability,
        h.managementCapability,
      ),
      null,
    );
    const next = issue(h);
    h.advance(1);
    const nextConsumed = h.runtime.consume(
      next.useCapability,
      h.managementCapability,
      h.observe(),
    );
    assert.equal(nextConsumed.status, "consumed");
    const nextActivated = h.runtime.activateMount(
      nextConsumed.mountAuthorizationCapability,
      h.managementCapability,
    );
    assert.equal(nextActivated.status, "activated");
    assert.equal(
      h.runtime.inspectActiveMount(
        nextActivated.activeMountCapability,
        h.managementCapability,
      ).status,
      "active",
    );
    assert.equal(
      h.runtime.completeMount(
        nextActivated.activeMountCapability,
        h.managementCapability,
      ).status,
      "completed",
    );
  });
}

test("古いGrantのrevokeは同じlogical Homeの現active ownerを解除しない", () => {
  const h = harness();
  const activate = (issued: ReturnType<typeof issue>) => {
    h.advance(1_000);
    const consumed = h.runtime.consume(
      issued.useCapability,
      h.managementCapability,
      h.observe(),
    );
    assert.equal(consumed.status, "consumed");
    const activated = h.runtime.activateMount(
      consumed.mountAuthorizationCapability,
      h.managementCapability,
    );
    assert.equal(activated.status, "activated");
    return activated;
  };
  const grantA = issue(h);
  const activeA = activate(grantA);
  assert.equal(
    h.runtime.completeMount(
      activeA.activeMountCapability,
      h.managementCapability,
    ).status,
    "completed",
  );
  const grantB = issue(h);
  const activeB = activate(grantB);
  assert.equal(
    h.runtime.revoke(grantA.controlCapability, h.managementCapability).status,
    "revoked",
  );
  const grantC = issue(h);
  h.advance(1_000);
  const consumedC = h.runtime.consume(
    grantC.useCapability,
    h.managementCapability,
    h.observe(),
  );
  assert.equal(consumedC.status, "consumed");
  assert.equal(
    h.runtime.activateMount(
      consumedC.mountAuthorizationCapability,
      h.managementCapability,
    ).reason,
    "provider_home_mount_logical_home_already_active",
  );
  assert.equal(
    h.runtime.completeMount(
      activeB.activeMountCapability,
      h.managementCapability,
    ).status,
    "completed",
  );
});

test("profile、Operation、観測bindingの不一致をEffect前に拒否する", () => {
  const h = harness();
  const reusableObservation = h.observe();
  assert.equal(
    h.runtime.issue(
      h.managementCapability,
      reusableObservation,
      "PROFILE-invalid",
    ).reason,
    "provider_home_mount_grant_runtime_profile_invalid",
  );
  assert.equal(
    h.runtime.issue(
      h.managementCapability,
      reusableObservation,
      "PROFILE-123456",
    ).status,
    "issued",
  );
  assert.equal(
    h.runtime.issue(
      h.managementCapability,
      reusableObservation,
      "PROFILE-123456",
    ).reason,
    "provider_home_mount_grant_runtime_observation_invalid",
  );

  const isolated = harness();
  const issued = issue(isolated);
  assert.equal(
    isolated.runtime.consume(
      issued.useCapability,
      isolated.otherManagementCapability,
      isolated.observe(),
    ).reason,
    "provider_home_mount_grant_runtime_use_invalid",
  );
  assert.equal(
    isolated.runtime.consume(
      issued.useCapability,
      isolated.managementCapability,
      isolated.observe({ providerHomeProtectionHash: "4".repeat(64) }),
    ).reason,
    "provider_home_mount_grant_runtime_observation_mismatch",
  );
  assert.equal(
    isolated.runtime.revoke(
      issued.controlCapability,
      isolated.managementCapability,
    ).status,
    "revoked",
  );
});

test("wall／monotonic期限、rollback、依存例外を固定blockedへ閉じる", () => {
  for (const time of [
    { wall: PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS, mono: 1 },
    { wall: 1, mono: PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS },
    { wall: -1, mono: 1 },
    { wall: 1, mono: -1 },
  ]) {
    const h = harness();
    const issued = issue(h);
    const baseWall = Date.parse("2026-08-24T00:00:00.000Z");
    h.setTime(baseWall + time.wall, 10_000 + time.mono);
    assert.equal(
      h.runtime.consume(
        issued.useCapability,
        h.managementCapability,
        h.observe(),
      ).reason,
      "provider_home_mount_grant_runtime_expired",
    );
  }

  for (const dependency of ["clock", "random", "observation"] as const) {
    const h = harness();
    h.fail(dependency);
    const result = h.runtime.issue(
      h.managementCapability,
      h.observe(),
      "PROFILE-123456",
    );
    assert.equal(result.status, "blocked");
    assert.match(result.reason, /failed_closed$/u);
  }

  for (const time of [
    { wall: Number.NaN, mono: 1 },
    { wall: 1, mono: Number.POSITIVE_INFINITY },
    { wall: -1, mono: 1 },
    { wall: 1, mono: -1 },
  ]) {
    const h = harness();
    h.setTime(time.wall, time.mono);
    assert.equal(
      h.runtime.issue(h.managementCapability, h.observe(), "PROFILE-123456")
        .reason,
      "provider_home_mount_grant_runtime_clock_invalid",
    );
  }
});

test("不正capability、全観測hash差分、参照衝突とproduction入口をfail closedにする", () => {
  const invalid = harness();
  for (const profileId of [null, 1, "PROFILE-x", `PROFILE-${"1".repeat(65)}`]) {
    assert.equal(
      invalid.runtime.issue(
        invalid.managementCapability,
        invalid.observe(),
        profileId,
      ).reason,
      "provider_home_mount_grant_runtime_profile_invalid",
    );
  }
  assert.equal(
    invalid.runtime.issue({}, invalid.observe(), "PROFILE-123456").reason,
    "provider_home_mount_grant_runtime_operation_invalid",
  );
  assert.equal(
    invalid.runtime.issue(invalid.managementCapability, {}, "PROFILE-123456")
      .reason,
    "provider_home_mount_grant_runtime_observation_invalid",
  );
  assert.equal(
    invalid.runtime.consume(null, invalid.managementCapability, {}).status,
    "blocked",
  );
  const issuedForMissingObservation = issue(invalid);
  assert.equal(
    invalid.runtime.consume(
      issuedForMissingObservation.useCapability,
      invalid.managementCapability,
      {},
    ).reason,
    "provider_home_mount_grant_runtime_observation_invalid",
  );
  assert.equal(
    invalid.runtime.inspectMountAuthorization(
      null,
      invalid.managementCapability,
    ).status,
    "blocked",
  );
  assert.equal(
    invalid.runtime.revoke(null, invalid.managementCapability).status,
    "blocked",
  );

  for (const changed of [
    { provider: "codex" as const },
    { providerHomeIdentityHash: "4".repeat(64) },
    { providerHomeProtectionHash: "4".repeat(64) },
    { localUserBindingHash: "4".repeat(64) },
    { stableLogicalHomeBindingHash: "4".repeat(64) },
  ]) {
    const h = harness();
    const issued = issue(h);
    assert.equal(
      h.runtime.consume(
        issued.useCapability,
        h.managementCapability,
        h.observe(changed),
      ).reason,
      "provider_home_mount_grant_runtime_observation_mismatch",
    );
  }

  let isFirstGrantIssued = true;
  const observations = new WeakMap<object, Observation>();
  const management = Object.freeze({});
  const collision = createIsolatedProviderHomeMountGrantRuntimeCandidate({
    verifyOperation(): OwnedOperationManagementBinding {
      return {
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
        managementScopeBound: true,
      };
    },
    consumeObservation(capability) {
      if (!capability || typeof capability !== "object") return null;
      const result = observations.get(capability) ?? null;
      observations.delete(capability);
      return result;
    },
    consumeMountSource: () => null,
    revokeMountSource: () => false,
    wallNow: () => Date.parse("2026-08-24T00:00:00.000Z"),
    monotonicNow: () => 1,
    randomBytes: () => Buffer.alloc(8, 7),
  });
  function collisionObservation() {
    const capability = Object.freeze({});
    observations.set(capability, {
      provider: "claude",
      providerHomeIdentityHash: identityHash,
      providerHomeProtectionHash: protectionHash,
      localUserBindingHash: userHash,
      stableLogicalHomeBindingHash: "5".repeat(64),
      observedWallClockMs: 0,
      observedMonotonicMs: 0,
      providerHomeMountSourceCapability: Object.freeze({}),
    });
    return capability;
  }
  const firstResult = collision.issue(
    management,
    collisionObservation(),
    "PROFILE-123456",
  );
  isFirstGrantIssued = firstResult.status === "issued";
  assert.equal(isFirstGrantIssued, true);
  assert.equal(
    collision.issue(management, collisionObservation(), "PROFILE-123457")
      .reason,
    "provider_home_mount_grant_runtime_reference_unavailable",
  );

  assert.equal(
    issueRuntimeOwnedProviderHomeMountGrant({}, {}, "bad").status,
    "blocked",
  );
  assert.equal(
    consumeRuntimeOwnedProviderHomeMountGrant({}, {}, {}).status,
    "blocked",
  );
  assert.equal(
    inspectRuntimeOwnedProviderHomeMountAuthorization({}, {}).status,
    "blocked",
  );
  assert.equal(
    revokeRuntimeOwnedProviderHomeMountGrant({}, {}).status,
    "blocked",
  );
});

test("Mount Grant Runtime契約はprocess-local storeと非Effect境界を公開する", () => {
  const contract = describeProviderHomeMountGrantRuntimeContract();
  assert.equal(contract.contract, PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT);
  assert.equal(
    contract.contractRevision,
    PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT_REVISION,
  );
  assert.equal(
    contract.store,
    "process_local_atomic_map_plus_durable_runtime_state_lease",
  );
  assert.equal(contract.clock, "runtime_owned_wall_and_monotonic");
  assert.deepEqual(contract.aliases, [
    "control",
    "use",
    "mount_authorization",
    "active_mount",
  ]);
  assert.equal(contract.controlAndUseAliasesSeparated, true);
  assert.equal(contract.allAliasesRevokedTogether, true);
  assert.equal(contract.processRestartBehavior, "all_grants_lost_fail_closed");
  assert.equal(contract.callerSuppliedClockAccepted, false);
  assert.equal(contract.callerSuppliedOperationIdAccepted, false);
  assert.equal(contract.callerSuppliedObservationHashAccepted, false);
  assert.equal(contract.providerHomeMounted, false);
  assert.match(contract.activeMountSourceLease, /implemented/u);
  assert.match(contract.activeMountAuthorityInspection, /implemented/u);
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.runtimeAuthorityIssued, false);
  assert.equal(
    contract.isolatedTestRuntimeCapabilitiesAcceptedByProduction,
    false,
  );
});
