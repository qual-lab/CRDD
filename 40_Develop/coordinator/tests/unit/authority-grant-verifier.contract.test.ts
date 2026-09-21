/**
 * coordinator:unit:authority-grant-verifierの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:authority-grant-verifierが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope authority、grant、verifier
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_REGISTRY_INPUT_LIMITS,
  AUTHORITY_REGISTRY_CONTRACT,
  describeAuthorityGrantVerifierContract,
  evaluateAuthorityGrantCandidate,
  validateAuthorityRegistryCandidate,
} from "../../src/security/authority-grant-verifier.ts";
import {
  PROVIDER_INPUT_LIMITS,
  PROVIDER_ISOLATION_CONTRACT,
  validateProviderIsolationProfile,
} from "../../src/security/provider-isolation-profile.ts";

/**
 * profileのTest準備責務を実行する。
 *
 * @responsibility profileがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus profileを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function profile(overrides = {}) {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 3,
    profileId: "PROFILE-000001",
    provider: "codex",
    operationId: "OP-000001",
    authMethod: "subscription_oauth",
    authority: { registryId: "AUTHREG-000001", grantRef: "AUTH-000001" },
    providerHomeMountGrant: {
      provider: "codex",
      profileId: "PROFILE-000001",
      operationId: "OP-000001",
      issuer: "runtime_owned",
      requiredState: "active",
      verification: "runtime_capability_required",
    },
    egress: { origins: ["https://api.example.test"] },
    ...overrides,
  };
}

/**
 * registryのTest準備責務を実行する。
 *
 * @responsibility registryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus registryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function registry(
  rawProfile = profile(),
  grantOverrides: Record<string, unknown> = {},
  registryOverrides: Record<string, unknown> = {},
) {
  const profileHash = validateProviderIsolationProfile(rawProfile).profileHash;
  return {
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: 3,
    registryId: "AUTHREG-000001",
    registryRevision: 3,
    observedAt: "2026-08-11T00:00:00.000Z",
    grants: [
      {
        grantRef: "AUTH-000001",
        grantRevision: 2,
        status: "active",
        validFrom: "2026-08-10T00:00:00.000Z",
        expiresAt: "2026-08-12T00:00:00.000Z",
        provider: "codex",
        profileId: "PROFILE-000001",
        origins: ["https://api.example.test"],
        providerHomeMountGrant: {
          provider: "codex",
          profileId: "PROFILE-000001",
          operationId: "OP-000001",
          issuer: "runtime_owned",
          requiredState: "active",
          verification: "runtime_capability_required",
        },
        operationId: "OP-000001",
        scopeId: "SCOPE-000001",
        profileHash,
        ...grantOverrides,
      },
    ],
    ...registryOverrides,
  };
}

const context = {
  provider: "codex",
  profileId: "PROFILE-000001",
  operationId: "OP-000001",
  scopeId: "SCOPE-000001",
  providerHomeMountGrantRef: "PHMGRANT-000001",
  now: "2026-08-11T00:30:00.000Z",
};

/**
 * grantsのTest準備責務を実行する。
 *
 * @responsibility grantsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus grantsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function grants(
  count: number,
  originFactory: (index: number) => string[] = (index) => [
    `https://api-${index}.example.test`,
  ],
) {
  const base = registry().grants[0];
  assert.ok(base);
  return Array.from({ length: count }, (unusedItem, index) => {
    void unusedItem;
    return {
      ...base,
      grantRef: `AUTH-${String(index + 1).padStart(6, "0")}`,
      origins: originFactory(index),
    };
  });
}

/**
 * Registry候補を正規化して固定Hashを生成するを検証する。
 *
 * @responsibility Registry候補を正規化して固定Hashを生成するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Registry候補を正規化して固定Hashを生成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Registry候補を正規化して固定Hashを生成する", () => {
  const result = validateAuthorityRegistryCandidate(registry());
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "authority_registry_trust_anchor_required");
  assert.match(result.registryHash, /^[a-f0-9]{64}$/u);
});

/**
 * Grant照合はOperationとScopeを含む候補根拠を返すを検証する。
 *
 * @responsibility Grant照合はOperationとScopeを含む候補根拠を返すの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Grant照合はOperationとScopeを含む候補根拠を返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Grant照合はOperationとScopeを含む候補根拠を返す", () => {
  const result = evaluateAuthorityGrantCandidate(
    profile(),
    registry(),
    context,
  );
  assert.equal(result.status, "candidate");
  assert.equal(
    result.reason,
    "runtime_trust_policy_activation_and_prelaunch_reverification_required",
  );
  assert.equal(result.verification.operationId, context.operationId);
  assert.equal(result.verification.scopeId, context.scopeId);
  assert.equal(
    result.verification.providerHomeMountGrantRef,
    context.providerHomeMountGrantRef,
  );
  assert.equal(result.verification.providerHomeMountGrantIssued, false);
  assert.equal(
    result.verification.providerHomeMountGrantVerification,
    "runtime_capability_required",
  );
  assert.equal(result.verification.validUntil, "2026-08-12T00:00:00.000Z");
});

/**
 * Core候補はAuthority Capabilityを発行しないを検証する。
 *
 * @responsibility Core候補はAuthority Capabilityを発行しないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Core候補はAuthority Capabilityを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Core候補はAuthority Capabilityを発行しない", () => {
  const contract = describeAuthorityGrantVerifierContract();
  assert.equal(contract.coreValidation, "implemented_candidate");
  assert.equal(contract.canonicalRegistryByteLoader, "implemented_candidate");
  assert.equal(contract.runtimeTrustPolicyActivation, "not_implemented");
  assert.equal(contract.prelaunchReverificationCore, "implemented_candidate");
  assert.equal(contract.providerLaunchIntegration, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});

/**
 * 未来Grant、期限切れ、取消および置換を拒否するを検証する。
 *
 * @responsibility 未来Grant、期限切れ、取消および置換を拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未来Grant、期限切れ、取消および置換を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("未来Grant、期限切れ、取消および置換を拒否する", () => {
  assert.equal(
    evaluateAuthorityGrantCandidate(
      profile(),
      registry(profile(), {
        validFrom: "2026-08-11T01:00:00.000Z",
      }),
      context,
    ).reason,
    "authority_grant_outside_validity",
  );
  assert.equal(
    evaluateAuthorityGrantCandidate(
      profile(),
      registry(profile(), {
        expiresAt: "2026-08-11T00:30:00.000Z",
      }),
      context,
    ).reason,
    "authority_grant_outside_validity",
  );
  assert.equal(
    evaluateAuthorityGrantCandidate(
      profile(),
      registry(profile(), {
        status: "revoked",
      }),
      context,
    ).reason,
    "authority_grant_inactive",
  );
  assert.equal(
    evaluateAuthorityGrantCandidate(
      profile(),
      registry(profile(), {
        status: "replaced",
      }),
      context,
    ).reason,
    "authority_grant_inactive",
  );
});

/**
 * Provider、Origin、Mount Grant、Operation、Scope、Profile Hashの差を拒否するを検証する。
 *
 * @responsibility Provider、Origin、Mount Grant、Operation、Scope、Profile Hashの差を拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider、Origin、Mount Grant、Operation、Scope、Profile Hashの差を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Provider、Origin、Mount Grant、Operation、Scope、Profile Hashの差を拒否する", () => {
  const cases = [
    [
      registry(profile(), {
        provider: "claude",
        providerHomeMountGrant: {
          provider: "claude",
          profileId: "PROFILE-000001",
          operationId: "OP-000001",
          issuer: "runtime_owned",
          requiredState: "active",
          verification: "runtime_capability_required",
        },
      }),
      context,
      "authority_provider_mismatch",
    ],
    [
      registry(profile(), { origins: ["https://other.example.test"] }),
      context,
      "authority_origins_mismatch",
    ],
    [
      registry(profile(), {
        operationId: "OP-000002",
        providerHomeMountGrant: {
          provider: "codex",
          profileId: "PROFILE-000001",
          operationId: "OP-000002",
          issuer: "runtime_owned",
          requiredState: "active",
          verification: "runtime_capability_required",
        },
      }),
      context,
      "authority_provider_profile_operation_mismatch",
    ],
    [
      registry(profile(), { scopeId: "SCOPE-000002" }),
      context,
      "authority_operation_scope_mismatch",
    ],
    [
      registry(profile(), { profileHash: "a".repeat(64) }),
      context,
      "authority_profile_hash_mismatch",
    ],
    [
      registry(),
      { ...context, provider: "claude" },
      "authority_provider_profile_operation_mismatch",
    ],
    [
      registry(),
      { ...context, profileId: "PROFILE-000002" },
      "authority_provider_profile_operation_mismatch",
    ],
  ];
  for (const [rawRegistry, rawContext, reason] of cases) {
    assert.equal(
      evaluateAuthorityGrantCandidate(profile(), rawRegistry, rawContext)
        .reason,
      reason,
    );
  }
});

/**
 * 静的Authority要件を実行時の動的Mount Grant refへ結合するを検証する。
 *
 * @responsibility 静的Authority要件を実行時の動的Mount Grant refへ結合するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 静的Authority要件を実行時の動的Mount Grant refへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("静的Authority要件を実行時の動的Mount Grant refへ結合する", () => {
  const result = evaluateAuthorityGrantCandidate(profile(), registry(), {
    ...context,
    providerHomeMountGrantRef: "PHMGRANT-000002",
  });
  assert.equal(result.status, "candidate");
  assert.equal(
    result.verification.providerHomeMountGrantRef,
    "PHMGRANT-000002",
  );
  assert.equal(result.verification.providerHomeMountGrantIssued, false);
  assert.equal(
    result.verification.providerHomeMountGrantVerification,
    "runtime_capability_required",
  );
});

/**
 * Authority contextはMount Grant参照を必須exact keyとして検査するを検証する。
 *
 * @responsibility Authority contextはMount Grant参照を必須exact keyとして検査するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Authority contextはMount Grant参照を必須exact keyとして検査するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Authority contextはMount Grant参照を必須exact keyとして検査する", () => {
  const { providerHomeMountGrantRef: unusedRef, ...missing } = context;
  void unusedRef;
  for (const changed of [
    missing,
    { ...context, providerHomeMountGrantRef: "AUTH-000001" },
    { ...context, providerHomeMountGrantRef: "CGRANT-000001" },
    {
      ...context,
      providerHomeMountGrantRef: `PHMGRANT-${"1".repeat(
        PROVIDER_INPUT_LIMITS.identifierLength,
      )}`,
    },
    { ...context, extra: true },
  ]) {
    assert.equal(
      evaluateAuthorityGrantCandidate(profile(), registry(), changed).reason,
      "authority_context_invalid",
    );
  }
});

/**
 * Registry参照差、重複Grant、非UTC時刻および不正nowをfail closedにするを検証する。
 *
 * @responsibility Registry参照差、重複Grant、非UTC時刻および不正nowをfail closedにするの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Registry参照差、重複Grant、非UTC時刻および不正nowをfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Registry参照差、重複Grant、非UTC時刻および不正nowをfail closedにする", () => {
  assert.equal(
    evaluateAuthorityGrantCandidate(
      profile(),
      registry(
        profile(),
        {},
        {
          registryId: "AUTHREG-000002",
        },
      ),
      context,
    ).reason,
    "authority_registry_mismatch",
  );
  const duplicate = registry();
  const duplicatedGrant = duplicate.grants[0];
  assert.ok(duplicatedGrant);
  duplicate.grants.push({ ...duplicatedGrant });
  assert.equal(
    validateAuthorityRegistryCandidate(duplicate).reason,
    "authority_registry_grant_duplicate",
  );
  const sharedMountRequirement = registry();
  const sharedBase = sharedMountRequirement.grants[0];
  assert.ok(sharedBase);
  sharedMountRequirement.grants.push({
    ...sharedBase,
    grantRef: "AUTH-000002",
  });
  assert.equal(
    validateAuthorityRegistryCandidate(sharedMountRequirement).status,
    "candidate",
  );
  assert.equal(
    validateAuthorityRegistryCandidate(
      registry(profile(), {}, { contractRevision: 1 }),
    ).reason,
    "authority_registry_contract_mismatch",
  );
  assert.equal(
    validateAuthorityRegistryCandidate(
      registry(profile(), {
        validFrom: "2026-08-10T09:00:00+09:00",
      }),
    ).reason,
    "authority_registry_grant_invalid",
  );
  assert.equal(
    evaluateAuthorityGrantCandidate(profile(), registry(), {
      ...context,
      now: "not-a-time",
    }).reason,
    "authority_now_invalid",
  );
  assert.equal(
    evaluateAuthorityGrantCandidate(
      profile(),
      registry(
        profile(),
        {},
        {
          observedAt: "2026-08-11T01:00:00.000Z",
        },
      ),
      context,
    ).reason,
    "authority_registry_observation_in_future",
  );
});

/**
 * Registry revision、空Grant集合および不正Originを固定reasonへ閉じるを検証する。
 *
 * @responsibility Registry revision、空Grant集合および不正Originを固定reasonへ閉じるの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Registry revision、空Grant集合および不正Originを固定reasonへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Registry revision、空Grant集合および不正Originを固定reasonへ閉じる", () => {
  assert.equal(
    validateAuthorityRegistryCandidate(
      registry(profile(), {}, { registryRevision: 0 }),
    ).reason,
    "authority_registry_revision_invalid",
  );
  assert.equal(
    validateAuthorityRegistryCandidate(registry(profile(), {}, { grants: [] }))
      .reason,
    "authority_registry_grants_required",
  );
  assert.equal(
    validateAuthorityRegistryCandidate(
      registry(profile(), { origins: ["not a URL"] }),
    ).reason,
    "authority_registry_grant_invalid",
  );
});

/**
 * 余分fieldと自己申告の承認者fieldを拒否するを検証する。
 *
 * @responsibility 余分fieldと自己申告の承認者fieldを拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 余分fieldと自己申告の承認者fieldを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("余分fieldと自己申告の承認者fieldを拒否する", () => {
  assert.equal(
    validateAuthorityRegistryCandidate({
      ...registry(),
      approvedBy: "Qual-Lab",
    }).reason,
    "authority_registry_shape_invalid",
  );
  const extraGrant = registry();
  const firstGrant = extraGrant.grants[0];
  assert.ok(firstGrant);
  Reflect.set(firstGrant, "approvedBy", "Qual-Lab");
  assert.equal(
    validateAuthorityRegistryCandidate(extraGrant).reason,
    "authority_registry_grant_invalid",
  );
  assert.equal(
    validateAuthorityRegistryCandidate(
      registry(profile(), {
        origins: ["https://127.0.0.1"],
      }),
    ).reason,
    "authority_registry_grant_invalid",
  );
});

/**
 * Registry入力budgetは最大件数を受理し1超過とcanonical byte超過を拒否するを検証する。
 *
 * @responsibility Registry入力budgetは最大件数を受理し1超過とcanonical byte超過を拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Registry入力budgetは最大件数を受理し1超過とcanonical byte超過を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Registry入力budgetは最大件数を受理し1超過とcanonical byte超過を拒否する", () => {
  const maximum = registry(
    profile(),
    {},
    {
      grants: grants(AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount),
    },
  );
  assert.equal(validateAuthorityRegistryCandidate(maximum).status, "candidate");
  const tooMany = registry(
    profile(),
    {},
    {
      grants: grants(AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount + 1),
    },
  );
  assert.equal(
    validateAuthorityRegistryCandidate(tooMany).reason,
    "authority_registry_grant_count_exceeded",
  );
  const largeCanonical = registry(
    profile(),
    {},
    {
      grants: grants(AUTHORITY_REGISTRY_INPUT_LIMITS.grantCount, (grantIndex) =>
        Array.from(
          { length: PROVIDER_INPUT_LIMITS.originCount },
          (unusedOrigin, originIndex) => {
            void unusedOrigin;
            const suffix = `${grantIndex}-${originIndex}.test`;
            return `https://${"a".repeat(PROVIDER_INPUT_LIMITS.originLength - 8 - suffix.length)}${suffix}`;
          },
        ),
      ),
    },
  );
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(largeCanonical));
  assert.equal(
    validateAuthorityRegistryCandidate(largeCanonical).reason,
    "authority_registry_canonical_bytes_exceeded",
  );
});

/**
 * Registryの巨大IDとOriginを正規化処理前に拒否するを検証する。
 *
 * @responsibility Registryの巨大IDとOriginを正規化処理前に拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Registryの巨大IDとOriginを正規化処理前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Registryの巨大IDとOriginを正規化処理前に拒否する", () => {
  const identifier = registry(
    profile(),
    {},
    {
      registryId: `AUTHREG-${"1".repeat(PROVIDER_INPUT_LIMITS.identifierLength)}`,
    },
  );
  assert.equal(
    validateAuthorityRegistryCandidate(identifier).reason,
    "authority_registry_id_invalid",
  );
  const origin = registry(profile(), {
    origins: [`https://${"a".repeat(PROVIDER_INPUT_LIMITS.originLength)}.test`],
  });
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(origin));
  assert.equal(
    validateAuthorityRegistryCandidate(origin).reason,
    "authority_registry_grant_invalid",
  );
  const cyclic = registry();
  const cyclicGrant = cyclic.grants[0];
  assert.ok(cyclicGrant);
  Reflect.set(cyclicGrant, "providerHomeMountGrant", cyclic);
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(cyclic));
  assert.equal(
    validateAuthorityRegistryCandidate(cyclic).reason,
    "authority_registry_grant_invalid",
  );
  const throwing = registry();
  Object.defineProperty(throwing, "registryId", {
    enumerable: true,
    get() {
      throw new Error("raw");
    },
  });
  assert.doesNotThrow(() => validateAuthorityRegistryCandidate(throwing));
  assert.equal(
    validateAuthorityRegistryCandidate(throwing).reason,
    "authority_registry_shape_invalid",
  );
});

/**
 * 評価時刻は有効なDateまたはcanonical UTC文字列だけを受理するを検証する。
 *
 * @responsibility 評価時刻は有効なDateまたはcanonical UTC文字列だけを受理するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 評価時刻は有効なDateまたはcanonical UTC文字列だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("評価時刻は有効なDateまたはcanonical UTC文字列だけを受理する", () => {
  assert.equal(
    evaluateAuthorityGrantCandidate(profile(), registry(), {
      ...context,
      now: new Date(context.now),
    }).status,
    "candidate",
  );
  for (const now of [
    null,
    0,
    true,
    {},
    "2026-08-11",
    "2026-08-11T09:30:00.000+09:00",
    "2026-08-11T00:30:00Z",
    new Date("invalid"),
  ]) {
    assert.doesNotThrow(() =>
      evaluateAuthorityGrantCandidate(profile(), registry(), {
        ...context,
        now,
      }),
    );
    assert.equal(
      evaluateAuthorityGrantCandidate(profile(), registry(), {
        ...context,
        now,
      }).reason,
      "authority_now_invalid",
    );
  }
});

/**
 * RegistryとContextのaccessorを実行せずblockedへ閉じるを検証する。
 *
 * @responsibility RegistryとContextのaccessorを実行せずblockedへ閉じるの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RegistryとContextのaccessorを実行せずblockedへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("RegistryとContextのaccessorを実行せずblockedへ閉じる", () => {
  for (const location of ["top", "grant", "array", "context"]) {
    let calls = 0;
    const rawRegistry = registry();
    const rawContext = { ...context };
    if (location === "top") {
      Object.defineProperty(rawRegistry, "registryId", {
        enumerable: true,
        get() {
          calls += 1;
          return calls === 1 ? "AUTHREG-000001" : "AUTHREG-999999";
        },
      });
    } else if (location === "grant") {
      Object.defineProperty(rawRegistry.grants[0], "grantRef", {
        enumerable: true,
        get() {
          calls += 1;
          return calls === 1 ? "AUTH-000001" : "AUTH-999999";
        },
      });
    } else if (location === "array") {
      Object.defineProperty(rawRegistry.grants, "0", {
        enumerable: true,
        get() {
          calls += 1;
          return calls === 1
            ? registry().grants[0]
            : { grantRef: "AUTH-999999" };
        },
      });
    } else {
      Object.defineProperty(rawContext, "now", {
        enumerable: true,
        get() {
          calls += 1;
          return calls === 1 ? context.now : "2099-01-01T00:00:00.000Z";
        },
      });
    }
    assert.equal(
      evaluateAuthorityGrantCandidate(profile(), rawRegistry, rawContext)
        .status,
      "blocked",
      location,
    );
    assert.equal(calls, 0, location);
  }
});
