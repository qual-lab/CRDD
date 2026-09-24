/**
 * coordinator:unit:authority-prelaunch-verifierの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:authority-prelaunch-verifierが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope authority、prelaunch、verifier
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_REGISTRY_CONTRACT,
  validateAuthorityRegistryCandidate,
} from "../../src/security/authority-grant-verifier.ts";
import { AUTHORITY_FILE_BUNDLE_CONTRACT } from "../../src/security/authority-file-bundle.ts";
import {
  describeAuthorityPrelaunchVerifierContract,
  reverifyAuthorityBeforeProviderLaunch,
} from "../../src/security/authority-prelaunch-verifier.ts";
import {
  AUTHORITY_TRUST_POLICY_CONTRACT,
  decodeCanonicalAuthorityTrustPolicyBytes,
} from "../../src/security/authority-trust-loader.ts";
import {
  PROVIDER_ISOLATION_CONTRACT,
  validateProviderIsolationProfile,
} from "../../src/security/provider-isolation-profile.ts";
import { canonicalJson } from "../support/test-support.ts";

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
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
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
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function fixture(grantOverrides = {}, policyOverrides = {}) {
  const rawProfile = profile();
  const now = Date.now();
  const registry = {
    contract: AUTHORITY_REGISTRY_CONTRACT,
    contractRevision: 3,
    registryId: "AUTHREG-000001",
    registryRevision: 3,
    observedAt: new Date(now - 60_000).toISOString(),
    grants: [
      {
        grantRef: "AUTH-000001",
        grantRevision: 2,
        status: "active",
        validFrom: new Date(now - 86_400_000).toISOString(),
        expiresAt: new Date(now + 86_400_000).toISOString(),
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
        profileHash: validateProviderIsolationProfile(rawProfile).profileHash,
        ...grantOverrides,
      },
    ],
  };
  const validated = validateAuthorityRegistryCandidate(registry);
  assert.equal(validated.status, "candidate");
  const registryBytes = Buffer.from(canonicalJson(validated.registry), "utf8");
  const trustPolicy = {
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: 1,
    policyId: "AUTHPOL-000001",
    policyRevision: 1,
    status: "active",
    registryId: validated.registry.registryId,
    registryRevision: validated.registry.registryRevision,
    registryHash: validated.registryHash,
    ...policyOverrides,
  };
  const trustPolicyBytes = Buffer.from(canonicalJson(trustPolicy), "utf8");
  const decodedPolicy =
    decodeCanonicalAuthorityTrustPolicyBytes(trustPolicyBytes);
  assert.equal(decodedPolicy.status, "candidate");
  const manifest = {
    contract: AUTHORITY_FILE_BUNDLE_CONTRACT,
    contractRevision: 1,
    bundleId: "AUTHBUNDLE-000001",
    bundleRevision: 1,
    status: "active",
    previousBundleHash: null,
    trustPolicyHash: decodedPolicy.trustPolicyHash,
    registryHash: validated.registryHash,
  };
  const bundle = {
    manifestBytes: Buffer.from(canonicalJson(manifest), "utf8"),
    trustPolicyBytes,
    registryBytes,
  };
  return { rawProfile, bundle, trustPolicy };
}

const CONTEXT = Object.freeze({
  provider: "codex",
  profileId: "PROFILE-000001",
  operationId: "OP-000001",
  scopeId: "SCOPE-000001",
  providerHomeMountGrantRef: "PHMGRANT-000001",
});

/**
 * Runtime時計でGrantを起動直前に再確認する候補を作るを検証する。
 *
 * @responsibility Runtime時計でGrantを起動直前に再確認する候補を作るの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime時計でGrantを起動直前に再確認する候補を作るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Runtime時計でGrantを起動直前に再確認する候補を作る", () => {
  const before = Date.now();
  const { rawProfile, bundle, trustPolicy } = fixture();
  const result = reverifyAuthorityBeforeProviderLaunch(
    rawProfile,
    bundle,
    CONTEXT,
  );
  const after = Date.now();
  assert.equal(result.status, "candidate");
  assert.equal(
    result.reason,
    "runtime_file_bundle_path_acl_and_activation_required",
  );
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.verification.operationId, CONTEXT.operationId);
  assert.equal(result.verification.scopeId, CONTEXT.scopeId);
  assert.equal(
    result.verification.providerHomeMountGrantRef,
    CONTEXT.providerHomeMountGrantRef,
  );
  assert.equal(result.verification.providerHomeMountGrantIssued, false);
  assert.equal(
    result.verification.providerHomeMountGrantVerification,
    "runtime_capability_required",
  );
  assert.equal(result.verification.trustPolicyId, trustPolicy.policyId);
  assert.equal(
    result.verification.trustPolicyRevision,
    trustPolicy.policyRevision,
  );
  assert.match(result.verification.trustPolicyHash, /^[a-f0-9]{64}$/u);
  assert.equal(result.verification.bundleId, "AUTHBUNDLE-000001");
  assert.equal(result.verification.bundleRevision, 1);
  assert.match(result.verification.bundleHash, /^[a-f0-9]{64}$/u);
  const checkedAt = Date.parse(result.verification.prelaunchCheckedAt);
  assert.ok(before <= checkedAt && checkedAt <= after);
});

/**
 * 呼出側時刻を受理せず固定Contextだけを使うを検証する。
 *
 * @responsibility 呼出側時刻を受理せず固定Contextだけを使うの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 呼出側時刻を受理せず固定Contextだけを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("呼出側時刻を受理せず固定Contextだけを使う", () => {
  const { rawProfile, bundle } = fixture();
  assert.equal(
    reverifyAuthorityBeforeProviderLaunch(rawProfile, bundle, {
      ...CONTEXT,
      now: "2099-01-01T00:00:00.000Z",
    }).reason,
    "prelaunch_authority_context_invalid",
  );

  let getterCalls = 0;
  const accessor = { ...CONTEXT };
  Object.defineProperty(accessor, "operationId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return CONTEXT.operationId;
    },
  });
  assert.equal(
    reverifyAuthorityBeforeProviderLaunch(rawProfile, bundle, accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
});

/**
 * Prelaunch contextはMount Grant参照の欠落とnamespace差を拒否するを検証する。
 *
 * @responsibility Prelaunch contextはMount Grant参照の欠落とnamespace差を拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Prelaunch contextはMount Grant参照の欠落とnamespace差を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Prelaunch contextはMount Grant参照の欠落とnamespace差を拒否する", () => {
  const { rawProfile, bundle } = fixture();
  const { providerHomeMountGrantRef: unusedRef, ...missing } = CONTEXT;
  void unusedRef;
  for (const changed of [
    missing,
    { ...CONTEXT, providerHomeMountGrantRef: "AUTH-000001" },
    { ...CONTEXT, providerHomeMountGrantRef: "CGRANT-000001" },
    { ...CONTEXT, extra: true },
  ]) {
    const result = reverifyAuthorityBeforeProviderLaunch(
      rawProfile,
      bundle,
      changed,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "prelaunch_authority_context_invalid");
    assert.equal(result.runtimeCapabilityIssued, false);
  }
});

/**
 * Prelaunchは静的要件を現在の動的Mount Grant refへ結合するを検証する。
 *
 * @responsibility Prelaunchは静的要件を現在の動的Mount Grant refへ結合するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Prelaunchは静的要件を現在の動的Mount Grant refへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Prelaunchは静的要件を現在の動的Mount Grant refへ結合する", () => {
  const { rawProfile, bundle } = fixture();
  const result = reverifyAuthorityBeforeProviderLaunch(rawProfile, bundle, {
    ...CONTEXT,
    providerHomeMountGrantRef: "PHMGRANT-000002",
  });
  assert.equal(result.status, "candidate");
  assert.equal(
    result.verification.providerHomeMountGrantRef,
    "PHMGRANT-000002",
  );
  assert.equal(
    result.verification.providerHomeMountGrantVerification,
    "runtime_capability_required",
  );
});

/**
 * 失効GrantとTrust Policy不一致をCapabilityへ昇格させないを検証する。
 *
 * @responsibility 失効GrantとTrust Policy不一致をCapabilityへ昇格させないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 失効GrantとTrust Policy不一致をCapabilityへ昇格させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("失効GrantとTrust Policy不一致をCapabilityへ昇格させない", () => {
  const expired = fixture({
    validFrom: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-01-02T00:00:00.000Z",
  });
  const expiredResult = reverifyAuthorityBeforeProviderLaunch(
    expired.rawProfile,
    expired.bundle,
    CONTEXT,
  );
  assert.equal(expiredResult.status, "blocked");
  assert.equal(expiredResult.reason, "authority_grant_outside_validity");
  assert.equal(expiredResult.runtimeCapabilityIssued, false);

  const mismatch = fixture();
  const mismatchedBundle = {
    ...mismatch.bundle,
    manifestBytes: Buffer.from(
      mismatch.bundle.manifestBytes
        .toString("utf8")
        .replace(
          /"registryHash":"[a-f0-9]{64}"/u,
          `"registryHash":"${"a".repeat(64)}"`,
        ),
      "utf8",
    ),
  };
  const mismatchResult = reverifyAuthorityBeforeProviderLaunch(
    mismatch.rawProfile,
    mismatchedBundle,
    CONTEXT,
  );
  assert.equal(mismatchResult.status, "blocked");
  assert.equal(
    mismatchResult.reason,
    "prelaunch_authority_file_bundle_invalid",
  );
  assert.equal(mismatchResult.runtimeCapabilityIssued, false);
});

/**
 * Core候補はProvider起動やAuthority Capabilityを成立させないを検証する。
 *
 * @responsibility Core候補はProvider起動やAuthority Capabilityを成立させないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Core候補はProvider起動やAuthority Capabilityを成立させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Core候補はProvider起動やAuthority Capabilityを成立させない", () => {
  const contract = describeAuthorityPrelaunchVerifierContract();
  assert.equal(contract.runtimeClockRead, "implemented_candidate");
  assert.equal(contract.prelaunchReverificationCore, "implemented_candidate");
  assert.equal(contract.providerLaunchIntegration, "not_implemented");
  assert.equal(contract.runtimeTrustPolicyActivation, "not_implemented");
  assert.equal(contract.authorityFileBundleCore, "implemented_candidate");
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.callerSuppliedTimeAccepted, false);
  assert.equal(contract.candidateReusableAsCapability, false);
});
