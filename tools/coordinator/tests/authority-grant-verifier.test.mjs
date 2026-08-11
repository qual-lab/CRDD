import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_REGISTRY_INPUT_LIMITS,
  AUTHORITY_REGISTRY_CONTRACT,
  describeAuthorityGrantVerifierContract,
  evaluateAuthorityGrantCandidate,
  validateAuthorityRegistryCandidate
} from "../src/security/authority-grant-verifier.mjs";
import {
  PROVIDER_INPUT_LIMITS,
  PROVIDER_ISOLATION_CONTRACT,
  validateProviderIsolationProfile
} from "../src/security/provider-isolation-profile.mjs";

function profile(overrides = {}) {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 1,
    profileId: "PROFILE-000001",
    provider: "codex",
    authority: { registryId: "AUTHREG-000001", grantRef: "AUTH-000001" },
    credentialGrant: { brokerId: "BROKER-000001", grantRef: "CGRANT-000001" },
    egress: { origins: ["https://api.example.test"] },
    ...overrides
  };
}

function registry(rawProfile = profile(), grantOverrides = {}, registryOverrides = {}) {
  const profileHash = validateProviderIsolationProfile(rawProfile).profileHash;
  return {
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: 1,
    registryId: "AUTHREG-000001",
    registryRevision: 3,
    observedAt: "2026-08-11T00:00:00.000Z",
    grants: [{
      grantRef: "AUTH-000001",
      grantRevision: 2,
      status: "active",
      validFrom: "2026-08-10T00:00:00.000Z",
      expiresAt: "2026-08-12T00:00:00.000Z",
      provider: "codex",
      origins: ["https://api.example.test"],
      credentialGrant: { brokerId: "BROKER-000001", grantRef: "CGRANT-000001" },
      operationId: "OP-000001",
      scopeId: "SCOPE-000001",
      profileHash,
      ...grantOverrides
    }],
    ...registryOverrides
  };
}

const context = {
  operationId: "OP-000001",
  scopeId: "SCOPE-000001",
  now: "2026-08-11T00:30:00.000Z"
};

function grants(count, originFactory = (index) => [`https://api-${index}.example.test`]) {
  const base = registry().grants[0];
  return Array.from({ length: count }, (_, index) => ({
    ...base,
    grantRef: `AUTH-${String(index + 1).padStart(6, "0")}`,
    origins: originFactory(index)
  }));
}

test("Registry候補を正規化して固定Hashを生成する", () => {
  const result = validateAuthorityRegistryCandidate(registry());
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "authority_registry_trust_anchor_required");
  assert.match(result.registryHash, /^[a-f0-9]{64}$/u);
});

test("Grant照合はOperationとScopeを含む候補根拠を返す", () => {
  const result = evaluateAuthorityGrantCandidate(profile(), registry(), context);
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "runtime_trust_policy_activation_and_prelaunch_reverification_required");
  assert.equal(result.verification.operationId, context.operationId);
  assert.equal(result.verification.scopeId, context.scopeId);
  assert.equal(result.verification.validUntil, "2026-08-12T00:00:00.000Z");
});

test("Core候補はAuthority Capabilityを発行しない", () => {
  const contract = describeAuthorityGrantVerifierContract();
  assert.equal(contract.coreValidation, "implemented_candidate");
  assert.equal(contract.canonicalRegistryByteLoader, "implemented_candidate");
  assert.equal(contract.runtimeTrustPolicyActivation, "not_implemented");
  assert.equal(contract.prelaunchReverification, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});

test("未来Grant、期限切れ、取消および置換を拒否する", () => {
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(profile(), {
    validFrom: "2026-08-11T01:00:00.000Z"
  }), context).reason, "authority_grant_outside_validity");
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(profile(), {
    expiresAt: "2026-08-11T00:30:00.000Z"
  }), context).reason, "authority_grant_outside_validity");
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(profile(), {
    status: "revoked"
  }), context).reason, "authority_grant_inactive");
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(profile(), {
    status: "replaced"
  }), context).reason, "authority_grant_inactive");
});

test("Provider、Origin、Credential、Operation、Scope、Profile Hashの差を拒否する", () => {
  const cases = [
    [registry(profile(), { provider: "claude" }), context, "authority_provider_mismatch"],
    [registry(profile(), { origins: ["https://other.example.test"] }), context, "authority_origins_mismatch"],
    [registry(profile(), { credentialGrant: { brokerId: "BROKER-000002", grantRef: "CGRANT-000002" } }), context, "authority_credential_grant_mismatch"],
    [registry(profile(), { operationId: "OP-000002" }), context, "authority_operation_scope_mismatch"],
    [registry(profile(), { scopeId: "SCOPE-000002" }), context, "authority_operation_scope_mismatch"],
    [registry(profile(), { profileHash: "a".repeat(64) }), context, "authority_profile_hash_mismatch"]
  ];
  for (const [rawRegistry, rawContext, reason] of cases) {
    assert.equal(evaluateAuthorityGrantCandidate(profile(), rawRegistry, rawContext).reason, reason);
  }
});

test("Registry参照差、重複Grant、非UTC時刻および不正nowをfail closedにする", () => {
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(profile(), {}, {
    registryId: "AUTHREG-000002"
  }), context).reason, "authority_registry_mismatch");
  const duplicate = registry();
  duplicate.grants.push({ ...duplicate.grants[0] });
  assert.equal(validateAuthorityRegistryCandidate(duplicate).reason, "authority_registry_grant_duplicate");
  assert.equal(validateAuthorityRegistryCandidate(registry(profile(), {
    validFrom: "2026-08-10T09:00:00+09:00"
  })).reason, "authority_registry_grant_invalid");
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(), {
    ...context,
    now: "not-a-time"
  }).reason, "authority_now_invalid");
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(profile(), {}, {
    observedAt: "2026-08-11T01:00:00.000Z"
  }), context).reason, "authority_registry_observation_in_future");
});

test("余分fieldと自己申告の承認者fieldを拒否する", () => {
  assert.equal(validateAuthorityRegistryCandidate({ ...registry(), approvedBy: "Qual-Lab" }).reason,
    "authority_registry_shape_invalid");
  const extraGrant = registry();
  extraGrant.grants[0].approvedBy = "Qual-Lab";
  assert.equal(validateAuthorityRegistryCandidate(extraGrant).reason, "authority_registry_grant_invalid");
  assert.equal(validateAuthorityRegistryCandidate(registry(profile(), {
    origins: ["https://127.0.0.1"]
  })).reason, "authority_registry_grant_invalid");
});

test("Registry入力budgetは最大件数を受理し1超過とcanonical byte超過を拒否する", () => {
  const maximum = registry(profile(), {}, {
    grants: grants(AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount)
  });
  assert.equal(validateAuthorityRegistryCandidate(maximum).status, "candidate");
  const tooMany = registry(profile(), {}, {
    grants: grants(AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount + 1)
  });
  assert.equal(validateAuthorityRegistryCandidate(tooMany).reason,
    "authority_registry_grant_count_exceeded");
  const largeCanonical = registry(profile(), {}, {
    grants: grants(AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount, (grantIndex) =>
      Array.from({ length: PROVIDER_INPUT_LIMITS.originCount }, (_, originIndex) => {
        const suffix = `${grantIndex}-${originIndex}.test`;
        return `https://${"a".repeat(PROVIDER_INPUT_LIMITS.originLength - 8 - suffix.length)}${suffix}`;
      }))
  });
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(largeCanonical));
  assert.equal(validateAuthorityRegistryCandidate(largeCanonical).reason,
    "authority_registry_canonical_bytes_exceeded");
});

test("Registryの巨大IDとOriginを正規化処理前に拒否する", () => {
  const identifier = registry(profile(), {}, {
    registryId: `AUTHREG-${"1".repeat(PROVIDER_INPUT_LIMITS.identifierLength)}`
  });
  assert.equal(validateAuthorityRegistryCandidate(identifier).reason, "authority_registry_id_invalid");
  const origin = registry(profile(), {
    origins: [`https://${"a".repeat(PROVIDER_INPUT_LIMITS.originLength)}.test`]
  });
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(origin));
  assert.equal(validateAuthorityRegistryCandidate(origin).reason, "authority_registry_grant_invalid");
  const cyclic = registry();
  cyclic.grants[0].credentialGrant = cyclic;
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(cyclic));
  assert.equal(validateAuthorityRegistryCandidate(cyclic).reason, "authority_registry_grant_invalid");
  const throwing = registry();
  Object.defineProperty(throwing, "registryId", { enumerable: true, get() { throw new Error("raw"); } });
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(throwing));
  assert.equal(validateAuthorityRegistryCandidate(throwing).reason, "authority_registry_shape_invalid");
});

test("評価時刻は有効なDateまたはcanonical UTC文字列だけを受理する", () => {
  assert.equal(evaluateAuthorityGrantCandidate(profile(), registry(), {
    ...context,
    now: new Date(context.now)
  }).status, "candidate");
  for (const now of [
    null,
    0,
    true,
    {},
    "2026-08-11",
    "2026-08-11T09:30:00.000+09:00",
    "2026-08-11T00:30:00Z",
    new Date("invalid")
  ]) {
    assert.doesNotThrow(() => evaluateAuthorityGrantCandidate(profile(), registry(), { ...context, now }));
    assert.equal(
      evaluateAuthorityGrantCandidate(profile(), registry(), { ...context, now }).reason,
      "authority_now_invalid"
    );
  }
});

test("RegistryとContextのaccessorを実行せずblockedへ閉じる", () => {
  for (const location of ["top", "grant", "array", "context"]) {
    let calls = 0;
    const rawRegistry = registry();
    const rawContext = { ...context };
    if (location === "top") {
      Object.defineProperty(rawRegistry, "registryId", {
        enumerable: true,
        get() { calls += 1; return calls === 1 ? "AUTHREG-000001" : "AUTHREG-999999"; }
      });
    } else if (location === "grant") {
      Object.defineProperty(rawRegistry.grants[0], "grantRef", {
        enumerable: true,
        get() { calls += 1; return calls === 1 ? "AUTH-000001" : "AUTH-999999"; }
      });
    } else if (location === "array") {
      Object.defineProperty(rawRegistry.grants, "0", {
        enumerable: true,
        get() { calls += 1; return calls === 1 ? registry().grants[0] : { grantRef: "AUTH-999999" }; }
      });
    } else {
      Object.defineProperty(rawContext, "now", {
        enumerable: true,
        get() { calls += 1; return calls === 1 ? context.now : "2099-01-01T00:00:00.000Z"; }
      });
    }
    assert.equal(evaluateAuthorityGrantCandidate(profile(), rawRegistry, rawContext).status, "blocked", location);
    assert.equal(calls, 0, location);
  }
});
