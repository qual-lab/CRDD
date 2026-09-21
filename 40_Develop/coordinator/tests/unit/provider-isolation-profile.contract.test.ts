/**
 * coordinator:unit:provider-isolation-profileの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-isolation-profileが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope provider、isolation、profile
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_INPUT_LIMITS,
  PROVIDER_ISOLATION_CONTRACT,
  describeProviderIsolationContract,
  validateProviderIsolationProfile,
} from "../../src/security/provider-isolation-profile.ts";

type ProfileFixture = Record<string, unknown> & {
  contract: string;
  contractRevision: number;
  profileId: string;
  provider: string;
  operationId: string;
  authMethod: string;
  authority: Record<string, unknown>;
  providerHomeMountGrant: Record<string, unknown>;
  egress: { origins: string[] };
};

/**
 * candidateのTest準備責務を実行する。
 *
 * @responsibility candidateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus candidateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function candidate(overrides: Record<string, unknown> = {}): ProfileFixture {
  return {
    contract: PROVIDER_ISOLATION_CONTRACT,
    contractRevision: 3,
    profileId: "PROFILE-000001",
    provider: "codex",
    operationId: "OP-000001",
    authMethod: "subscription_oauth",
    authority: {
      registryId: "AUTHREG-000001",
      grantRef: "AUTH-000001",
    },
    providerHomeMountGrant: {
      provider: "codex",
      profileId: "PROFILE-000001",
      operationId: "OP-000001",
      issuer: "runtime_owned",
      requiredState: "active",
      verification: "runtime_capability_required",
    },
    egress: {
      origins: ["https://api.example.test"],
    },
    ...overrides,
  };
}

/**
 * 限定参照だけを含むProfileをAuthority確認待ち候補として固定するを検証する。
 *
 * @responsibility 限定参照だけを含むProfileをAuthority確認待ち候補として固定するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 限定参照だけを含むProfileをAuthority確認待ち候補として固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("限定参照だけを含むProfileをAuthority確認待ち候補として固定する", () => {
  const result = validateProviderIsolationProfile(candidate());
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "authority_verification_required");
  assert.equal(
    result.profile.requiredCapabilities.includes(
      "authority_grant_verification",
    ),
    true,
  );
  assert.match(result.profileHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(result.profile.egress.origins, ["https://api.example.test"]);
  assert.equal(JSON.stringify(result).includes("CRDD-v0.18"), false);
  assert.equal(result.profile.providerHomeMountGrant.issuer, "runtime_owned");
  assert.equal(result.profile.providerHomeMountGrant.requiredState, "active");
  assert.equal(
    result.profile.requiredCapabilities.includes(
      "provider_home_mount_grant_verification",
    ),
    true,
  );
});

/**
 * Profile契約はCRDD版ごとに分岐しないを検証する。
 *
 * @responsibility Profile契約はCRDD版ごとに分岐しないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Profile契約はCRDD版ごとに分岐しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Profile契約はCRDD版ごとに分岐しない", () => {
  const contract = describeProviderIsolationContract();
  assert.equal(contract.crddVersionSpecific, false);
  assert.equal(contract.supportedWriteBackend, "docker");
  assert.equal(contract.localFallbackAllowed, false);
  assert.equal(contract.contractRevision, 3);
  assert.equal(contract.authMethod, "subscription_oauth");
  assert.equal(
    contract.subscriptionOauthProviderHomeMountGrant.implementationState,
    "runtime_owned_lifecycle_connected",
  );
  assert.equal(
    contract.subscriptionOauthProviderHomeMountGrant
      .tokenCopyOrInjectionAllowed,
    false,
  );
});

/**
 * 秘密値らしいfieldをProfileへ混入できないを検証する。
 *
 * @responsibility 秘密値らしいfieldをProfileへ混入できないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 秘密値らしいfieldをProfileへ混入できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("秘密値らしいfieldをProfileへ混入できない", () => {
  const result = validateProviderIsolationProfile(
    candidate({ apiKey: "secret" }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "profile_shape_invalid");
  const nested = candidate();
  nested.providerHomeMountGrant.secret = "secret";
  assert.equal(
    validateProviderIsolationProfile(nested).reason,
    "provider_home_mount_grant_shape_invalid",
  );
});

/**
 * Profile入力budgetの境界と超過をfail closedにするを検証する。
 *
 * @responsibility Profile入力budgetの境界と超過をfail closedにするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Profile入力budgetの境界と超過をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Profile入力budgetの境界と超過をfail closedにする", () => {
  const maximum = candidate({
    profileId: `PROFILE-${"1".repeat(PROVIDER_INPUT_LIMITS.identifierLength - "PROFILE-".length)}`,
    egress: {
      origins: Array.from(
        { length: PROVIDER_INPUT_LIMITS.originCount },
        (unusedOrigin, index) => {
          void unusedOrigin;
          return `https://api-${String(index).padStart(2, "0")}.example.test`;
        },
      ),
    },
  });
  maximum.providerHomeMountGrant.profileId = maximum.profileId;
  assert.equal(validateProviderIsolationProfile(maximum).status, "candidate");
  const tooMany = candidate();
  tooMany.egress.origins = Array.from(
    { length: PROVIDER_INPUT_LIMITS.originCount + 1 },
    (unusedOrigin, index) => {
      void unusedOrigin;
      return `https://api-${String(index).padStart(2, "0")}.example.test`;
    },
  );
  assert.equal(
    validateProviderIsolationProfile(tooMany).reason,
    "egress_origin_count_exceeded",
  );
  const tooLongOrigin = candidate();
  tooLongOrigin.egress.origins = [
    `https://${"a".repeat(PROVIDER_INPUT_LIMITS.originLength)}.test`,
  ];
  assert.equal(
    validateProviderIsolationProfile(tooLongOrigin).reason,
    "egress_origin_length_exceeded",
  );
  const tooLongId = candidate({
    profileId: `PROFILE-${"1".repeat(PROVIDER_INPUT_LIMITS.identifierLength)}`,
  });
  assert.equal(
    validateProviderIsolationProfile(tooLongId).reason,
    "profile_id_invalid",
  );
  const cyclic = candidate();
  cyclic.authority = cyclic;
  assert.doesNotThrow(() => validateProviderIsolationProfile(cyclic));
  assert.equal(
    validateProviderIsolationProfile(cyclic).reason,
    "authority_shape_invalid",
  );
  const throwing = candidate();
  Object.defineProperty(throwing, "profileId", {
    enumerable: true,
    get() {
      throw new Error("raw");
    },
  });
  assert.doesNotThrow(() => validateProviderIsolationProfile(throwing));
  assert.equal(
    validateProviderIsolationProfile(throwing).reason,
    "profile_shape_invalid",
  );
});

/**
 * Profile入口はtop、nested、array accessorを実行しないを検証する。
 *
 * @responsibility Profile入口はtop、nested、array accessorを実行しないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Profile入口はtop、nested、array accessorを実行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Profile入口はtop、nested、array accessorを実行しない", () => {
  for (const location of ["top", "nested", "array"]) {
    let calls = 0;
    const value = candidate();
    if (location === "top") {
      Object.defineProperty(value, "authority", {
        enumerable: true,
        get() {
          calls += 1;
          return { registryId: "AUTHREG-000001", grantRef: "AUTH-000001" };
        },
      });
    } else if (location === "nested") {
      Object.defineProperty(value.authority, "grantRef", {
        enumerable: true,
        get() {
          calls += 1;
          return calls === 1 ? "AUTH-000001" : "sk-proj-malicious";
        },
      });
    } else {
      Object.defineProperty(value.egress.origins, "0", {
        enumerable: true,
        get() {
          calls += 1;
          return calls === 1
            ? "https://api.example.test"
            : "https://other.test";
        },
      });
    }
    assert.equal(
      validateProviderIsolationProfile(value).status,
      "blocked",
      location,
    );
    assert.equal(calls, 0, location);
  }
});

/**
 * Provider tokenらしい値をAuthority参照へ偽装できないを検証する。
 *
 * @responsibility Provider tokenらしい値をAuthority参照へ偽装できないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider tokenらしい値をAuthority参照へ偽装できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Provider tokenらしい値をAuthority参照へ偽装できない", () => {
  const values = [
    "sk-proj-example",
    "sk-ant-example",
    "ghp_example",
    "github_pat_example",
  ];
  for (const value of values) {
    const authority = candidate();
    authority.authority.grantRef = value;
    assert.equal(
      validateProviderIsolationProfile(authority).reason,
      "authority_reference_invalid",
      value,
    );
  }
});

/**
 * 自己申告の承認内容と旧時刻fieldをProfileへ保持できないを検証する。
 *
 * @responsibility 自己申告の承認内容と旧時刻fieldをProfileへ保持できないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 自己申告の承認内容と旧時刻fieldをProfileへ保持できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("自己申告の承認内容と旧時刻fieldをProfileへ保持できない", () => {
  const value = candidate();
  value.authority.approvedBy = "Qual-Lab";
  value.authority.approvedAt = "2099-01-01T00:00:00.000Z";
  value.authority.expiresAt = "2100-01-01T00:00:00.000Z";
  assert.equal(
    validateProviderIsolationProfile(value).reason,
    "authority_shape_invalid",
  );
});

/**
 * Authority参照へ動的Mount Grant namespaceを流用できないを検証する。
 *
 * @responsibility Authority参照へ動的Mount Grant namespaceを流用できないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Authority参照へ動的Mount Grant namespaceを流用できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Authority参照へ動的Mount Grant namespaceを流用できない", () => {
  const authority = candidate();
  authority.authority.grantRef = "PHMGRANT-000001";
  assert.equal(
    validateProviderIsolationProfile(authority).reason,
    "authority_reference_invalid",
  );
});

/**
 * 旧revisionとgeneric Credential fieldをOAuth Profileへ混在できないを検証する。
 *
 * @responsibility 旧revisionとgeneric Credential fieldをOAuth Profileへ混在できないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 旧revisionとgeneric Credential fieldをOAuth Profileへ混在できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("旧revisionとgeneric Credential fieldをOAuth Profileへ混在できない", () => {
  assert.equal(
    validateProviderIsolationProfile(candidate({ contractRevision: 1 })).reason,
    "profile_contract_mismatch",
  );
  const legacy = candidate() as Record<string, unknown>;
  delete legacy.providerHomeMountGrant;
  legacy.credentialGrant = {
    brokerId: "BROKER-000001",
    grantRef: "CGRANT-000001",
  };
  assert.equal(
    validateProviderIsolationProfile(legacy).reason,
    "profile_shape_invalid",
  );
});

/**
 * Mount GrantはProvider、ProfileおよびOperationへ完全結合するを検証する。
 *
 * @responsibility Mount GrantはProvider、ProfileおよびOperationへ完全結合するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Mount GrantはProvider、ProfileおよびOperationへ完全結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Mount GrantはProvider、ProfileおよびOperationへ完全結合する", () => {
  for (const [field, value] of [
    ["provider", "claude"],
    ["profileId", "PROFILE-000002"],
    ["operationId", "OP-000002"],
  ] as const) {
    const changed = candidate();
    changed.providerHomeMountGrant[field] = value;
    assert.equal(
      validateProviderIsolationProfile(changed).reason,
      "provider_home_mount_grant_reference_invalid",
      field,
    );
  }
});

/**
 * 署名Profileへ動的Grant refまたは未検証状態を保持できないを検証する。
 *
 * @responsibility 署名Profileへ動的Grant refまたは未検証状態を保持できないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名Profileへ動的Grant refまたは未検証状態を保持できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("署名Profileへ動的Grant refまたは未検証状態を保持できない", () => {
  const dynamicReference = candidate();
  dynamicReference.providerHomeMountGrant.grantRef = "PHMGRANT-000001";
  assert.equal(
    validateProviderIsolationProfile(dynamicReference).reason,
    "provider_home_mount_grant_shape_invalid",
  );
  for (const [field, value] of [
    ["issuer", "caller"],
    ["requiredState", "issued"],
    ["verification", "not_implemented"],
  ] as const) {
    const changed = candidate();
    changed.providerHomeMountGrant[field] = value;
    assert.equal(
      validateProviderIsolationProfile(changed).reason,
      "provider_home_mount_grant_reference_invalid",
      field,
    );
  }
});

/**
 * wildcard、平文HTTP、Path付き送信先を拒否するを検証する。
 *
 * @responsibility wildcard、平文HTTP、Path付き送信先を拒否するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus wildcard、平文HTTP、Path付き送信先を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("wildcard、平文HTTP、Path付き送信先を拒否する", () => {
  for (const origin of [
    "https://*.example.test",
    "http://api.example.test",
    "https://api.example.test/v1",
  ]) {
    const value = candidate();
    value.egress.origins = [origin];
    const result = validateProviderIsolationProfile(value);
    assert.equal(result.status, "blocked", origin);
    assert.equal(result.reason, "egress_origin_invalid", origin);
  }
});

/**
 * 空Origin集合を固定reasonへ閉じるを検証する。
 *
 * @responsibility 空Origin集合を固定reasonへ閉じるの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 空Origin集合を固定reasonへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("空Origin集合を固定reasonへ閉じる", () => {
  const empty = candidate();
  empty.egress.origins = [];
  assert.equal(
    validateProviderIsolationProfile(empty).reason,
    "egress_origins_required",
  );
});

/**
 * 未知Authority Registryと未対応Providerをfail closedにするを検証する。
 *
 * @responsibility 未知Authority Registryと未対応Providerをfail closedにするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未知Authority Registryと未対応Providerをfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("未知Authority Registryと未対応Providerをfail closedにする", () => {
  const unknown = candidate();
  unknown.authority.registryId = "registry-from-agent";
  assert.equal(
    validateProviderIsolationProfile(unknown).reason,
    "authority_reference_invalid",
  );
  assert.equal(
    validateProviderIsolationProfile(candidate({ provider: "other" })).reason,
    "provider_not_supported",
  );
});

/**
 * 同じ意味のProfileはorigin順序に依存しないHashを持つを検証する。
 *
 * @responsibility 同じ意味のProfileはorigin順序に依存しないHashを持つの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同じ意味のProfileはorigin順序に依存しないHashを持つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("同じ意味のProfileはorigin順序に依存しないHashを持つ", () => {
  const left = candidate();
  left.egress.origins = ["https://b.example.test", "https://a.example.test"];
  const right = candidate();
  right.egress.origins = ["https://a.example.test", "https://b.example.test"];
  assert.equal(
    validateProviderIsolationProfile(left).profileHash,
    validateProviderIsolationProfile(right).profileHash,
  );
});
