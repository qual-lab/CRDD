import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import {
  describePlatformKeyStoragePolicyContract,
  evaluatePlatformKeyStoragePolicyCandidate,
} from "../src/security/platform-key-storage-policy.ts";

function p256Spki() {
  return generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  }).publicKey.export({ format: "der", type: "spki" });
}

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
