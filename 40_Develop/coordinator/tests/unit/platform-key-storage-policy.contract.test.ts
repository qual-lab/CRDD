/**
 * coordinator:unit:platform-key-storage-policyの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:platform-key-storage-policyが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope platform、key、storage、policy
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import {
  describePlatformKeyStoragePolicyContract,
  evaluatePlatformKeyStoragePolicyCandidate,
} from "../../src/security/platform-key-storage-policy.ts";

/**
 * p256SpkiのTest準備責務を実行する。
 *
 * @responsibility p256SpkiがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus p256Spkiを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function p256Spki() {
  return generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  }).publicKey.export({ format: "der", type: "spki" });
}

/**
 * preferred backend and explicit fallback remain policy candidates onlyを検証する。
 *
 * @responsibility preferred backend and explicit fallback remain policy candidates onlyの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus preferred backend and explicit fallback remain policy candidates onlyの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("preferred backend and explicit fallback remain policy candidates only", () => {
  const publicKeySpkiDer = p256Spki();
  for (const input of [
    {
      platformFamily: "windows",
      backend: "cng_ksp_tpm_p256",
      explicitFallbackApproved: false,
      publicKeySpkiDer,
    },
    {
      platformFamily: "windows",
      backend: "cng_ksp_software_p256",
      explicitFallbackApproved: true,
      publicKeySpkiDer,
    },
    {
      platformFamily: "macos",
      backend: "secure_enclave_p256",
      explicitFallbackApproved: false,
      publicKeySpkiDer,
    },
    {
      platformFamily: "linux",
      backend: "tpm2_p256",
      explicitFallbackApproved: false,
      publicKeySpkiDer,
    },
  ]) {
    const result = evaluatePlatformKeyStoragePolicyCandidate(input);
    assert.equal(result.status, "candidate");
    assert.equal(result.nativeAdapterVerificationRequired, true);
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal("publicKeySpkiDer" in result, false);
    assert.equal("keyId" in result, false);
  }
});

/**
 * silent fallback, unknown backend, wrong curve and dynamic input fail closedを検証する。
 *
 * @responsibility silent fallback, unknown backend, wrong curve and dynamic input fail closedの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus silent fallback, unknown backend, wrong curve and dynamic input fail closedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("silent fallback, unknown backend, wrong curve and dynamic input fail closed", () => {
  const publicKeySpkiDer = p256Spki();
  const base = {
    platformFamily: "windows",
    backend: "cng_ksp_software_p256",
    explicitFallbackApproved: true,
    publicKeySpkiDer,
  };
  assert.equal(
    evaluatePlatformKeyStoragePolicyCandidate({
      ...base,
      explicitFallbackApproved: false,
    }).reason,
    "platform_key_storage_fallback_approval_invalid",
  );
  assert.equal(
    evaluatePlatformKeyStoragePolicyCandidate({
      ...base,
      backend: "rsa_hardware",
    }).reason,
    "platform_key_storage_backend_unsupported",
  );
  assert.equal(
    evaluatePlatformKeyStoragePolicyCandidate({
      ...base,
      publicKeySpkiDer: generateKeyPairSync("ed25519").publicKey.export({
        format: "der",
        type: "spki",
      }),
    }).reason,
    "platform_key_storage_public_key_invalid",
  );
  let getterCalls = 0;
  const accessor = { ...base };
  Object.defineProperty(accessor, "backend", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return base.backend;
    },
  });
  assert.equal(
    evaluatePlatformKeyStoragePolicyCandidate(accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const proxy = new Proxy(base, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(base);
    },
  });
  assert.equal(
    evaluatePlatformKeyStoragePolicyCandidate(proxy).status,
    "blocked",
  );
  assert.equal(proxyCalls, 0);
});

/**
 * contract fixes P-256 backends while native verification and effects remain closedを検証する。
 *
 * @responsibility contract fixes P-256 backends while native verification and effects remain closedの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus contract fixes P-256 backends while native verification and effects remain closedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("contract fixes P-256 backends while native verification and effects remain closed", () => {
  const contract = describePlatformKeyStoragePolicyContract();
  assert.deepEqual(contract.backendPolicies, {
    windows: {
      preferred: "cng_ksp_tpm_p256",
      explicitFallback: "cng_ksp_software_p256",
    },
    macos: {
      preferred: "secure_enclave_p256",
      explicitFallback: "keychain_software_p256",
    },
    linux: {
      preferred: "tpm2_p256",
      explicitFallback: "root_owned_software_p256",
    },
  });
  assert.equal(contract.keyAlgorithm, "ECDSA-P256-SHA256");
  assert.equal(contract.nativeWindowsCngAdapter, "not_implemented");
  assert.equal(contract.nativeMacosSecureEnclaveAdapter, "not_implemented");
  assert.equal(contract.nativeLinuxTpm2Adapter, "not_implemented");
  assert.equal(contract.runtimeAuthorityConferred, false);
});
