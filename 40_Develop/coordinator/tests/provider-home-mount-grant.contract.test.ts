import assert from "node:assert/strict";
import test from "node:test";

import {
  compileProviderHomeMountGrantCandidate,
  describeProviderHomeMountGrantContract,
  evaluateProviderHomeMountGrantTransitionCandidate,
  evaluateProviderHomeMountGrantUseCandidate,
  isProviderHomeMountGrantRef,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
  PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
} from "../src/security/provider-home-mount-grant.ts";

const homeIdentityHash = "a".repeat(64);
const homeProtectionHash = "b".repeat(64);
const localUserBindingHash = "c".repeat(64);
const ISSUED_AT = "2026-08-22T00:00:00.000Z";
const EXPIRES_AT = "2026-08-22T00:05:00.000Z";

function record(overrides: Record<string, unknown> = {}) {
  return {
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    grantRef: "PHMGRANT-000001",
    provider: "claude",
    profileId: "PROFILE-000001",
    operationId: "OP-000001",
    providerHomeIdentityHash: homeIdentityHash,
    providerHomeProtectionHash: homeProtectionHash,
    localUserBindingHash,
    stableLogicalHomeBindingHash: "4".repeat(64),
    state: "issued",
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    consumedAt: null,
    revokedAt: null,
    usageLimit: 1,
    consumptionCount: 0,
    ...overrides,
  };
}

function useInput(overrides: Record<string, unknown> = {}) {
  return {
    grant: record(),
    provider: "claude",
    profileId: "PROFILE-000001",
    operationId: "OP-000001",
    providerHomeMountGrantRef: "PHMGRANT-000001",
    observedProviderHomeIdentityHash: homeIdentityHash,
    observedProviderHomeProtectionHash: homeProtectionHash,
    observedLocalUserBindingHash: localUserBindingHash,
    observedStableLogicalHomeBindingHash: "4".repeat(64),
    observedAt: "2026-08-22T00:01:00.000Z",
    ...overrides,
  };
}

function assertNoMountEffects(result: {
  providerHomeMountGrantIssued: boolean;
  mountAuthorizationIssued: boolean;
  providerHomeMounted: boolean;
  filesystemEffectIssued: boolean;
  runtimeAuthorityIssued: boolean;
  operationCapabilityIssued: boolean;
  pathReported: boolean;
  credentialReported: boolean;
}) {
  assert.equal(result.providerHomeMountGrantIssued, false);
  assert.equal(result.mountAuthorizationIssued, false);
  assert.equal(result.providerHomeMounted, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.runtimeAuthorityIssued, false);
  assert.equal(result.operationCapabilityIssued, false);
  assert.equal(result.pathReported, false);
  assert.equal(result.credentialReported, false);
}

test("Mount Grant契約は一回限り・短命・三者bindingと非Effect境界を固定する", () => {
  const contract = describeProviderHomeMountGrantContract();
  assert.equal(contract.contract, PROVIDER_HOME_MOUNT_GRANT_CONTRACT);
  assert.equal(
    contract.contractRevision,
    PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
  );
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.deepEqual(contract.states, [
    "prepared",
    "issued",
    "consumed",
    "revoked",
  ]);
  assert.equal(
    contract.maximumLifetimeMs,
    PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
  );
  assert.equal(contract.usageLimit, 1);
  assert.equal(contract.providerProfileOperationBindingRequired, true);
  assert.equal(contract.providerHomeIdentityAndProtectionBindingRequired, true);
  assert.equal(contract.selectedLocalUserBindingRequired, true);
  assert.equal(
    contract.useTimeInterval,
    "issued_at_inclusive_expires_at_exclusive",
  );
  assert.equal(contract.useCandidateSelectedGrantRefRequired, true);
  assert.equal(contract.useCandidateCurrentObservationHashesRequired, true);
  assert.equal(contract.useCandidateInputsAreNonAuthoritative, true);
  assert.equal(contract.runtimeOwnedClockRequired, true);
  assert.equal(contract.runtimeOwnedAtomicStoreRequired, true);
  assert.equal(contract.runtimeOwnedIssuerRequired, true);
  assert.equal(contract.oneTimeConsumptionRequired, true);
  assert.equal(contract.operationEndRevocationRequired, true);
  assert.equal(contract.tokenCopyOrInjectionAllowed, false);
  assert.equal(contract.pathOrCredentialDisclosureAllowed, false);
  assert.equal(contract.issuanceEffect, "not_implemented");
  assert.equal(contract.mountAdapter, "not_implemented");
  assert.equal(contract.revocationEffect, "not_implemented");
  assert.equal(contract.grantIssued, false);
  assert.equal(contract.operationCapabilityIssued, false);
});

test("prepared、issued、consumed、revokedの整合したrecordだけを候補化する", () => {
  const candidates = [
    record({
      state: "prepared",
      issuedAt: null,
      expiresAt: null,
    }),
    record(),
    record({
      state: "consumed",
      consumedAt: "2026-08-22T00:01:00.000Z",
      consumptionCount: 1,
    }),
    record({
      state: "revoked",
      revokedAt: "2026-08-22T00:02:00.000Z",
    }),
    record({
      state: "revoked",
      consumedAt: "2026-08-22T00:01:00.000Z",
      revokedAt: "2026-08-22T00:02:00.000Z",
      consumptionCount: 1,
    }),
    record({ provider: "codex" }),
    record({
      state: "consumed",
      consumedAt: ISSUED_AT,
      consumptionCount: 1,
    }),
    record({
      state: "consumed",
      consumedAt: "2026-08-22T00:04:59.999Z",
      consumptionCount: 1,
    }),
  ];
  for (const candidate of candidates) {
    const result = compileProviderHomeMountGrantCandidate(candidate);
    assert.equal(result.status, "candidate");
    assertNoMountEffects(result);
  }
  assert.equal(isProviderHomeMountGrantRef("PHMGRANT-000001"), true);
  assert.equal(isProviderHomeMountGrantRef("AUTH-000001"), false);
});

test("recordのshape、Identity、時刻、回数および状態矛盾を拒否する", () => {
  for (const changed of [
    { contract: "other" },
    { contractRevision: 1 },
    { grantRef: "PHMGRANT-x" },
    { provider: "other" },
    { profileId: "PROFILE-x" },
    { operationId: "OP-x" },
    { providerHomeIdentityHash: "x" },
    { providerHomeProtectionHash: "x" },
    { localUserBindingHash: "x" },
    { stableLogicalHomeBindingHash: "x" },
    { state: "expired" },
    { issuedAt: "2026-08-22" },
    { expiresAt: "2026-08-22" },
    { consumedAt: "2026-08-22" },
    { revokedAt: "2026-08-22" },
    { usageLimit: 2 },
    { consumptionCount: 2 },
    { expiresAt: ISSUED_AT },
    { expiresAt: "2026-08-22T00:05:00.001Z" },
    { state: "prepared" },
    { state: "issued", consumedAt: ISSUED_AT },
    { state: "consumed", consumedAt: null, consumptionCount: 1 },
    {
      state: "consumed",
      consumedAt: "2026-08-21T23:59:59.999Z",
      consumptionCount: 1,
    },
    {
      state: "consumed",
      consumedAt: EXPIRES_AT,
      consumptionCount: 1,
    },
    {
      state: "consumed",
      consumedAt: "2026-08-22T00:05:00.001Z",
      consumptionCount: 1,
    },
    { state: "revoked", revokedAt: null },
    {
      state: "revoked",
      revokedAt: "2026-08-21T23:59:59.999Z",
    },
    {
      state: "revoked",
      consumedAt: EXPIRES_AT,
      revokedAt: "2026-08-22T00:05:00.001Z",
      consumptionCount: 1,
    },
    {
      state: "revoked",
      consumedAt: "2026-08-22T00:02:00.000Z",
      revokedAt: "2026-08-22T00:01:00.000Z",
      consumptionCount: 1,
    },
  ]) {
    assert.equal(
      compileProviderHomeMountGrantCandidate(record(changed)).reason,
      "provider_home_mount_grant_record_invalid",
    );
  }
  const schemaFailure = compileProviderHomeMountGrantCandidate({
    ...record(),
    token: "forbidden",
  });
  assert.equal(
    schemaFailure.reason,
    "provider_home_mount_grant_record_invalid",
  );
  assertNoMountEffects(schemaFailure);
});

test("正規遷移だけを同じbindingと時刻で候補化する", () => {
  const prepared = record({
    state: "prepared",
    issuedAt: null,
    expiresAt: null,
  });
  const issued = record();
  const consumed = record({
    state: "consumed",
    consumedAt: "2026-08-22T00:01:00.000Z",
    consumptionCount: 1,
  });
  const consumedAtIssue = record({
    state: "consumed",
    consumedAt: ISSUED_AT,
    consumptionCount: 1,
  });
  const consumedBeforeExpiry = record({
    state: "consumed",
    consumedAt: "2026-08-22T00:04:59.999Z",
    consumptionCount: 1,
  });
  const revokedUnused = record({
    state: "revoked",
    revokedAt: "2026-08-22T00:02:00.000Z",
  });
  const revokedConsumed = record({
    state: "revoked",
    consumedAt: "2026-08-22T00:01:00.000Z",
    revokedAt: "2026-08-22T00:02:00.000Z",
    consumptionCount: 1,
  });
  for (const [previous, next] of [
    [prepared, issued],
    [issued, consumed],
    [issued, consumedAtIssue],
    [issued, consumedBeforeExpiry],
    [issued, revokedUnused],
    [consumed, revokedConsumed],
  ]) {
    const result = evaluateProviderHomeMountGrantTransitionCandidate({
      previous,
      next,
    });
    assert.equal(result.status, "candidate");
    assertNoMountEffects(result);
  }
  assert.equal(
    evaluateProviderHomeMountGrantTransitionCandidate({
      previous: issued,
      next: record({
        operationId: "OP-000002",
        state: "consumed",
        consumedAt: "2026-08-22T00:01:00.000Z",
        consumptionCount: 1,
      }),
    }).reason,
    "provider_home_mount_grant_transition_binding_mismatch",
  );
  assert.equal(
    evaluateProviderHomeMountGrantTransitionCandidate({
      previous: consumed,
      next: issued,
    }).reason,
    "provider_home_mount_grant_transition_not_allowed",
  );
  assert.equal(
    evaluateProviderHomeMountGrantTransitionCandidate({
      previous: issued,
      next: record({
        state: "consumed",
        issuedAt: "2026-08-22T00:00:01.000Z",
        consumedAt: "2026-08-22T00:01:00.000Z",
        consumptionCount: 1,
      }),
    }).reason,
    "provider_home_mount_grant_transition_time_mismatch",
  );
  assert.equal(
    evaluateProviderHomeMountGrantTransitionCandidate({
      previous: issued,
      next: record({
        state: "consumed",
        consumedAt: EXPIRES_AT,
        consumptionCount: 1,
      }),
    }).reason,
    "provider_home_mount_grant_transition_record_invalid",
  );
});

test("use候補はissued状態、三者binding、canonical Runtime時刻と有効期間を要求する", () => {
  const input = useInput();
  const result = evaluateProviderHomeMountGrantUseCandidate(input);
  assert.equal(result.status, "candidate");
  assert.equal(
    result.reason,
    "provider_home_mount_grant_runtime_clock_store_and_mount_adapter_required",
  );
  assertNoMountEffects(result);
  assert.equal(
    evaluateProviderHomeMountGrantUseCandidate(
      useInput({ observedAt: ISSUED_AT }),
    ).status,
    "candidate",
  );
  assert.equal(
    evaluateProviderHomeMountGrantUseCandidate(
      useInput({ observedAt: "2026-08-22T00:04:59.999Z" }),
    ).status,
    "candidate",
  );
  for (const changed of [
    { provider: "codex" },
    { profileId: "PROFILE-000002" },
    { operationId: "OP-000002" },
    { providerHomeMountGrantRef: "PHMGRANT-000002" },
    { providerHomeMountGrantRef: "AUTH-000001" },
  ]) {
    const bindingFailure = evaluateProviderHomeMountGrantUseCandidate({
      ...input,
      ...changed,
    });
    assert.equal(
      bindingFailure.reason,
      "provider_home_mount_grant_use_binding_mismatch",
    );
    assertNoMountEffects(bindingFailure);
  }
  for (const changed of [
    { observedProviderHomeIdentityHash: "x" },
    { observedProviderHomeProtectionHash: "x" },
    { observedLocalUserBindingHash: "x" },
    { observedStableLogicalHomeBindingHash: "x" },
  ]) {
    const observationFailure = evaluateProviderHomeMountGrantUseCandidate({
      ...input,
      ...changed,
    });
    assert.equal(
      observationFailure.reason,
      "provider_home_mount_grant_use_observation_invalid",
    );
    assertNoMountEffects(observationFailure);
  }
  for (const changed of [
    { observedProviderHomeIdentityHash: "d".repeat(64) },
    { observedProviderHomeProtectionHash: "e".repeat(64) },
    { observedLocalUserBindingHash: "f".repeat(64) },
    { observedStableLogicalHomeBindingHash: "5".repeat(64) },
  ]) {
    const observationFailure = evaluateProviderHomeMountGrantUseCandidate({
      ...input,
      ...changed,
    });
    assert.equal(
      observationFailure.reason,
      "provider_home_mount_grant_use_observation_mismatch",
    );
    assertNoMountEffects(observationFailure);
  }
  assert.equal(
    evaluateProviderHomeMountGrantUseCandidate({
      ...input,
      observedAt: "invalid",
    }).reason,
    "provider_home_mount_grant_observed_at_invalid",
  );
  assert.equal(
    evaluateProviderHomeMountGrantUseCandidate({
      ...input,
      observedAt: null,
    }).reason,
    "provider_home_mount_grant_observed_at_invalid",
  );
  const stateFailure = evaluateProviderHomeMountGrantUseCandidate({
    ...input,
    grant: record({
      state: "consumed",
      consumedAt: input.observedAt,
      consumptionCount: 1,
    }),
  });
  assert.equal(stateFailure.reason, "provider_home_mount_grant_not_usable");
  assertNoMountEffects(stateFailure);
  for (const observedAt of [
    "2026-08-21T23:59:59.999Z",
    EXPIRES_AT,
    "2026-08-22T00:05:00.001Z",
  ]) {
    const timeFailure = evaluateProviderHomeMountGrantUseCandidate({
      ...input,
      observedAt,
    });
    assert.equal(
      timeFailure.reason,
      "provider_home_mount_grant_expired_or_not_yet_valid",
    );
    assertNoMountEffects(timeFailure);
  }
});

test("余分field、accessor、Proxyと不正nested recordを例外なく拒否する", () => {
  const transitionSchemaFailure =
    evaluateProviderHomeMountGrantTransitionCandidate({
      previous: record(),
      next: record(),
      extra: true,
    });
  assert.equal(
    transitionSchemaFailure.reason,
    "provider_home_mount_grant_transition_input_invalid",
  );
  assertNoMountEffects(transitionSchemaFailure);
  assert.equal(
    evaluateProviderHomeMountGrantTransitionCandidate({
      previous: record(),
      next: { ...record(), extra: true },
    }).reason,
    "provider_home_mount_grant_transition_record_invalid",
  );
  assert.equal(
    evaluateProviderHomeMountGrantUseCandidate(
      useInput({ grant: { ...record(), extra: true } }),
    ).reason,
    "provider_home_mount_grant_use_record_invalid",
  );
  const useSchemaFailure = evaluateProviderHomeMountGrantUseCandidate(
    useInput({ extra: true }),
  );
  assert.equal(
    useSchemaFailure.reason,
    "provider_home_mount_grant_use_input_invalid",
  );
  assertNoMountEffects(useSchemaFailure);
  const {
    observedProviderHomeIdentityHash: unusedObservedIdentity,
    ...missingObservation
  } = useInput();
  void unusedObservedIdentity;
  assert.equal(
    evaluateProviderHomeMountGrantUseCandidate(missingObservation).reason,
    "provider_home_mount_grant_use_input_invalid",
  );
  const accessor = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessor, "contract", {
    enumerable: true,
    get: () => PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
  });
  assert.equal(
    compileProviderHomeMountGrantCandidate(accessor).status,
    "blocked",
  );
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error("must_not_escape");
      },
    },
  );
  assert.equal(compileProviderHomeMountGrantCandidate(proxy).status, "blocked");
  assert.equal(
    evaluateProviderHomeMountGrantTransitionCandidate(proxy).status,
    "blocked",
  );
  assert.equal(
    evaluateProviderHomeMountGrantUseCandidate(proxy).status,
    "blocked",
  );
});

test("時刻評価基盤の例外は各入口で固定blocked結果へ閉じる", () => {
  const originalParse = Date.parse;
  Date.parse = () => {
    throw new Error("clock_failure");
  };
  try {
    assert.equal(
      compileProviderHomeMountGrantCandidate(record()).reason,
      "provider_home_mount_grant_record_invalid",
    );
    assert.equal(
      evaluateProviderHomeMountGrantTransitionCandidate({
        previous: record(),
        next: record(),
      }).reason,
      "provider_home_mount_grant_transition_input_invalid",
    );
    assert.equal(
      evaluateProviderHomeMountGrantUseCandidate(useInput()).reason,
      "provider_home_mount_grant_use_input_invalid",
    );
  } finally {
    Date.parse = originalParse;
  }
  assert.equal(isProviderHomeMountGrantRef(1), false);
  assert.equal(
    isProviderHomeMountGrantRef(`PHMGRANT-${"1".repeat(65)}`),
    false,
  );
});
