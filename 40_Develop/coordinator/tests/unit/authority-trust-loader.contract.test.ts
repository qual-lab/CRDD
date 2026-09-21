/**
 * coordinator:unit:authority-trust-loaderの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:authority-trust-loaderが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope authority、trust、loader
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_REGISTRY_CONTRACT,
  AUTHORITY_REGISTRY_INPUT_LIMITS,
  validateAuthorityRegistryCandidate,
} from "../../src/security/authority-grant-verifier.ts";
import {
  AUTHORITY_TRUST_POLICY_CONTRACT,
  AUTHORITY_TRUST_POLICY_INPUT_LIMITS,
  decodeCanonicalAuthorityTrustPolicyBytes,
  describeAuthorityTrustLoaderContract,
  loadAuthorityRegistryTrustCandidate,
} from "../../src/security/authority-trust-loader.ts";
import {
  PROVIDER_ISOLATION_CONTRACT,
  validateProviderIsolationProfile,
} from "../../src/security/provider-isolation-profile.ts";
import { assertPresent, canonicalJson } from "../support/test-support.ts";

/**
 * profileのTest準備責務を実行する。
 *
 * @responsibility profileがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus profileを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function profile() {
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
  };
}

/**
 * registryのTest準備責務を実行する。
 *
 * @responsibility registryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus registryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function registry() {
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
        profileHash: validateProviderIsolationProfile(profile()).profileHash,
      },
    ],
  };
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function fixture() {
  const validated = validateAuthorityRegistryCandidate(registry());
  assert.equal(validated.status, "candidate");
  assertPresent(validated.registry);
  const bytes = Buffer.from(canonicalJson(validated.registry), "utf8");
  const policy = {
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: 1,
    policyId: "AUTHPOL-000001",
    policyRevision: 1,
    status: "active",
    registryId: validated.registry.registryId,
    registryRevision: validated.registry.registryRevision,
    registryHash: validated.registryHash,
  };
  return { validated, bytes, policy };
}

/**
 * canonical Registry byte列と完全一致Policyから信頼候補を作るを検証する。
 *
 * @responsibility canonical Registry byte列と完全一致Policyから信頼候補を作るの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus canonical Registry byte列と完全一致Policyから信頼候補を作るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("canonical Registry byte列と完全一致Policyから信頼候補を作る", () => {
  const { bytes, policy } = fixture();
  const result = loadAuthorityRegistryTrustCandidate(bytes, policy);
  assert.equal(result.status, "candidate");
  assert.equal(result.reason, "runtime_owned_trust_policy_activation_required");
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.match(result.trustPolicyHash, /^[a-f0-9]{64}$/u);
});

/**
 * 非canonical、BOM、不正UTF-8およびbyte上限超過をfail closedにするを検証する。
 *
 * @responsibility 非canonical、BOM、不正UTF-8およびbyte上限超過をfail closedにするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 非canonical、BOM、不正UTF-8およびbyte上限超過をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("非canonical、BOM、不正UTF-8およびbyte上限超過をfail closedにする", () => {
  const { bytes, policy } = fixture();
  const duplicateKey = Buffer.from(
    bytes
      .toString("utf8")
      .replace('"contract":', '"contract":"ignored-duplicate","contract":'),
    "utf8",
  );
  const cases = [
    Buffer.concat([bytes, Buffer.from("\n")]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]),
    duplicateKey,
    Buffer.from([0xc3, 0x28]),
    Buffer.alloc(AUTHORITY_REGISTRY_INPUT_LIMITS.rawBytes + 1, 0x20),
  ];
  for (const input of cases) {
    const result = loadAuthorityRegistryTrustCandidate(input, policy);
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeCapabilityIssued, false);
  }
  assert.equal(
    loadAuthorityRegistryTrustCandidate(bytes.toString("utf8"), policy).reason,
    "authority_registry_bytes_required",
  );
});

/**
 * Policyの状態、Registry Identity、Hashおよびshape差を拒否するを検証する。
 *
 * @responsibility Policyの状態、Registry Identity、Hashおよびshape差を拒否するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Policyの状態、Registry Identity、Hashおよびshape差を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Policyの状態、Registry Identity、Hashおよびshape差を拒否する", () => {
  const { bytes, policy } = fixture();
  for (const changed of [
    { ...policy, status: "revoked" },
    { ...policy, registryId: "AUTHREG-000002" },
    { ...policy, registryRevision: 4 },
    { ...policy, registryHash: "a".repeat(64) },
    { ...policy, approvedBy: "Qual-Lab" },
  ]) {
    assert.equal(
      loadAuthorityRegistryTrustCandidate(bytes, changed).status,
      "blocked",
    );
  }
});

/**
 * Policy accessorとProxyを実行せずblockedへ閉じるを検証する。
 *
 * @responsibility Policy accessorとProxyを実行せずblockedへ閉じるの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Policy accessorとProxyを実行せずblockedへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Policy accessorとProxyを実行せずblockedへ閉じる", () => {
  const { bytes, policy } = fixture();
  let getterCalls = 0;
  const accessor = { ...policy };
  Object.defineProperty(accessor, "registryHash", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return policy.registryHash;
    },
  });
  assert.equal(
    loadAuthorityRegistryTrustCandidate(bytes, accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxied = new Proxy(policy, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(policy);
    },
  });
  assert.equal(
    loadAuthorityRegistryTrustCandidate(bytes, proxied).status,
    "blocked",
  );
  assert.equal(proxyCalls, 0);
});

/**
 * Registry Bufferの上書きpropertyを参照せずRuntime所有copyを使うを検証する。
 *
 * @responsibility Registry Bufferの上書きpropertyを参照せずRuntime所有copyを使うの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Registry Bufferの上書きpropertyを参照せずRuntime所有copyを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Registry Bufferの上書きpropertyを参照せずRuntime所有copyを使う", () => {
  const { bytes, policy } = fixture();
  let calls = 0;
  Object.defineProperties(bytes, {
    length: { value: AUTHORITY_REGISTRY_INPUT_LIMITS.rawBytes + 1 },
    byteLength: {
      get() {
        calls += 1;
        throw new Error("raw");
      },
    },
    equals: {
      get() {
        calls += 1;
        throw new Error("raw");
      },
    },
  });
  const result = loadAuthorityRegistryTrustCandidate(bytes, policy);
  assert.equal(result.status, "candidate");
  assert.equal(calls, 0);
});

/**
 * Trust Policy byte列も所有copy、canonical形式および独立上限を要求するを検証する。
 *
 * @responsibility Trust Policy byte列も所有copy、canonical形式および独立上限を要求するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Trust Policy byte列も所有copy、canonical形式および独立上限を要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Trust Policy byte列も所有copy、canonical形式および独立上限を要求する", () => {
  const { policy } = fixture();
  const bytes = Buffer.from(canonicalJson(policy), "utf8");
  let calls = 0;
  Object.defineProperties(bytes, {
    length: { value: AUTHORITY_TRUST_POLICY_INPUT_LIMITS.rawBytes + 1 },
    byteLength: {
      get() {
        calls += 1;
        throw new Error("raw");
      },
    },
    equals: {
      get() {
        calls += 1;
        throw new Error("raw");
      },
    },
  });
  assert.equal(
    decodeCanonicalAuthorityTrustPolicyBytes(bytes).status,
    "candidate",
  );
  assert.equal(calls, 0);

  for (const input of [
    Buffer.concat([
      Buffer.from(canonicalJson(policy), "utf8"),
      Buffer.from("\n"),
    ]),
    Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(canonicalJson(policy), "utf8"),
    ]),
    Buffer.alloc(AUTHORITY_TRUST_POLICY_INPUT_LIMITS.rawBytes + 1, 0x20),
  ]) {
    assert.equal(
      decodeCanonicalAuthorityTrustPolicyBytes(input).status,
      "blocked",
    );
  }
});

/**
 * Loader Core候補はcaller PolicyをAuthority Capabilityへ昇格しないを検証する。
 *
 * @responsibility Loader Core候補はcaller PolicyをAuthority Capabilityへ昇格しないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Loader Core候補はcaller PolicyをAuthority Capabilityへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Loader Core候補はcaller PolicyをAuthority Capabilityへ昇格しない", () => {
  const contract = describeAuthorityTrustLoaderContract();
  assert.equal(contract.canonicalRegistryByteLoader, "implemented_candidate");
  assert.equal(
    contract.canonicalTrustPolicyByteLoader,
    "implemented_candidate",
  );
  assert.equal(contract.runtimeTrustPolicyOwnership, "not_implemented");
  assert.equal(contract.runtimeTrustPolicyActivation, "not_implemented");
  assert.equal(contract.prelaunchReverificationCore, "implemented_candidate");
  assert.equal(contract.providerLaunchIntegration, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.callerSuppliedPolicyAcceptedAsAuthority, false);
});
