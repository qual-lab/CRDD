/**
 * coordinator:unit:authority-file-bundleの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:authority-file-bundleが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope authority、file、bundle
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_FILE_BUNDLE_CONTRACT,
  AUTHORITY_FILE_BUNDLE_FILES,
  AUTHORITY_FILE_BUNDLE_INPUT_LIMITS,
  describeAuthorityFileBundleContract,
  loadAuthorityFileBundleCandidate,
} from "../../src/security/authority-file-bundle.ts";
import {
  AUTHORITY_REGISTRY_CONTRACT,
  validateAuthorityRegistryCandidate,
} from "../../src/security/authority-grant-verifier.ts";
import {
  AUTHORITY_TRUST_POLICY_CONTRACT,
  AUTHORITY_TRUST_POLICY_INPUT_LIMITS,
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
function fixture(manifestOverrides = {}, policyOverrides = {}) {
  const rawProfile = profile();
  const registry = {
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
        profileHash: validateProviderIsolationProfile(rawProfile).profileHash,
      },
    ],
  };
  const validatedRegistry = validateAuthorityRegistryCandidate(registry);
  assert.equal(validatedRegistry.status, "candidate");
  const registryBytes = Buffer.from(
    canonicalJson(validatedRegistry.registry),
    "utf8",
  );
  const trustPolicy = {
    contract: AUTHORITY_TRUST_POLICY_CONTRACT,
    contractRevision: 1,
    policyId: "AUTHPOL-000001",
    policyRevision: 1,
    status: "active",
    registryId: validatedRegistry.registry.registryId,
    registryRevision: validatedRegistry.registry.registryRevision,
    registryHash: validatedRegistry.registryHash,
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
    registryHash: validatedRegistry.registryHash,
    ...manifestOverrides,
  };
  const manifestBytes = Buffer.from(canonicalJson(manifest), "utf8");
  return { manifestBytes, trustPolicyBytes, registryBytes };
}

/**
 * 固定3ファイルのcanonical byteとHashをBundle候補へ結合するを検証する。
 *
 * @responsibility 固定3ファイルのcanonical byteとHashをBundle候補へ結合するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定3ファイルのcanonical byteとHashをBundle候補へ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("固定3ファイルのcanonical byteとHashをBundle候補へ結合する", () => {
  const input = fixture();
  const result = loadAuthorityFileBundleCandidate(input);
  assert.equal(result.status, "candidate");
  assert.equal(
    result.reason,
    "runtime_file_bundle_path_acl_and_activation_required",
  );
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.manifest.bundleId, "AUTHBUNDLE-000001");
  assert.match(result.bundleHash, /^[a-f0-9]{64}$/u);
  assert.equal(result.manifest.registryHash, result.registryHash);
  assert.equal(result.manifest.trustPolicyHash, result.trustPolicyHash);
  assert.equal("manifestBytes" in result, false);
  assert.equal("registryBytes" in result, false);
  assert.equal("trustPolicyBytes" in result, false);
});

/**
 * Manifestの非canonical表現、BOM、余分fieldおよび上限超過を拒否するを検証する。
 *
 * @responsibility Manifestの非canonical表現、BOM、余分fieldおよび上限超過を拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Manifestの非canonical表現、BOM、余分fieldおよび上限超過を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Manifestの非canonical表現、BOM、余分fieldおよび上限超過を拒否する", () => {
  const input = fixture();
  const manifestText = input.manifestBytes.toString("utf8");
  for (const manifestBytes of [
    Buffer.concat([input.manifestBytes, Buffer.from("\n")]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), input.manifestBytes]),
    Buffer.from(manifestText.replace("{", '{"extra":true,'), "utf8"),
    Buffer.alloc(AUTHORITY_FILE_BUNDLE_INPUT_LIMITS.manifestBytes + 1, 0x20),
  ]) {
    assert.equal(
      loadAuthorityFileBundleCandidate({ ...input, manifestBytes }).reason,
      "authority_file_bundle_manifest_invalid",
    );
  }
});

/**
 * Trust Policy byte列もcanonical形式と独立上限を要求するを検証する。
 *
 * @responsibility Trust Policy byte列もcanonical形式と独立上限を要求するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Trust Policy byte列もcanonical形式と独立上限を要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Trust Policy byte列もcanonical形式と独立上限を要求する", () => {
  const input = fixture();
  for (const trustPolicyBytes of [
    Buffer.concat([input.trustPolicyBytes, Buffer.from(" ")]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), input.trustPolicyBytes]),
    Buffer.alloc(AUTHORITY_TRUST_POLICY_INPUT_LIMITS.rawBytes + 1, 0x20),
  ]) {
    assert.equal(
      loadAuthorityFileBundleCandidate({ ...input, trustPolicyBytes }).reason,
      "authority_file_bundle_trust_policy_invalid",
    );
  }
});

/**
 * File Bundle経路も旧Authority Registry revision 1をalias変換せず拒否するを検証する。
 *
 * @responsibility File Bundle経路も旧Authority Registry revision 1をalias変換せず拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus File Bundle経路も旧Authority Registry revision 1をalias変換せず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("File Bundle経路も旧Authority Registry revision 1をalias変換せず拒否する", () => {
  const input = fixture();
  const legacyRegistry = JSON.parse(input.registryBytes.toString("utf8"));
  legacyRegistry.contractRevision = 1;
  const result = loadAuthorityFileBundleCandidate({
    ...input,
    registryBytes: Buffer.from(canonicalJson(legacyRegistry), "utf8"),
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "authority_file_bundle_registry_invalid");
});

/**
 * Manifest、Policy、RegistryのHash差とinactive状態を拒否するを検証する。
 *
 * @responsibility Manifest、Policy、RegistryのHash差とinactive状態を拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Manifest、Policy、RegistryのHash差とinactive状態を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Manifest、Policy、RegistryのHash差とinactive状態を拒否する", () => {
  assert.equal(
    loadAuthorityFileBundleCandidate(fixture({ registryHash: "a".repeat(64) }))
      .reason,
    "authority_file_bundle_hash_mismatch",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({ trustPolicyHash: "a".repeat(64) }),
    ).reason,
    "authority_file_bundle_hash_mismatch",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(fixture({ status: "revoked" })).reason,
    "authority_file_bundle_inactive",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(fixture({}, { status: "revoked" })).reason,
    "authority_file_bundle_trust_policy_inactive",
  );
});

/**
 * Bundle revisionは初版nullと後続Hash chainを区別するを検証する。
 *
 * @responsibility Bundle revisionは初版nullと後続Hash chainを区別するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Bundle revisionは初版nullと後続Hash chainを区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Bundle revisionは初版nullと後続Hash chainを区別する", () => {
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({ previousBundleHash: "a".repeat(64) }),
    ).reason,
    "authority_file_bundle_manifest_invalid",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({
        bundleRevision: 2,
        previousBundleHash: null,
      }),
    ).reason,
    "authority_file_bundle_manifest_invalid",
  );
  assert.equal(
    loadAuthorityFileBundleCandidate(
      fixture({
        bundleRevision: 2,
        previousBundleHash: createHash("sha256")
          .update("previous")
          .digest("hex"),
      }),
    ).status,
    "candidate",
  );
});

/**
 * Bundle入力のaccessorとProxyを実行せずblockedへ閉じるを検証する。
 *
 * @responsibility Bundle入力のaccessorとProxyを実行せずblockedへ閉じるの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Bundle入力のaccessorとProxyを実行せずblockedへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Bundle入力のaccessorとProxyを実行せずblockedへ閉じる", () => {
  const input = fixture();
  let getterCalls = 0;
  const accessor = { ...input };
  Object.defineProperty(accessor, "manifestBytes", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return input.manifestBytes;
    },
  });
  assert.equal(loadAuthorityFileBundleCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxied = new Proxy(input, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(input);
    },
  });
  assert.equal(loadAuthorityFileBundleCandidate(proxied).status, "blocked");
  assert.equal(proxyCalls, 0);
});

/**
 * File Bundle CoreはPath／ACL／activationまたはCapabilityを成立させないを検証する。
 *
 * @responsibility File Bundle CoreはPath／ACL／activationまたはCapabilityを成立させないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus File Bundle CoreはPath／ACL／activationまたはCapabilityを成立させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("File Bundle CoreはPath／ACL／activationまたはCapabilityを成立させない", () => {
  const contract = describeAuthorityFileBundleContract();
  assert.equal(contract.canonicalBundleCore, "implemented_candidate");
  assert.deepEqual(contract.fixedFiles, AUTHORITY_FILE_BUNDLE_FILES);
  assert.equal(
    contract.rootProtectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(contract.runtimeManagedPath, "not_implemented");
  assert.equal(contract.ownerAclVerification, "not_implemented");
  assert.equal(contract.atomicReplacement, "not_implemented");
  assert.equal(contract.monotonicActivation, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.ipcOrNetworkTransportSupported, false);
});
