import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformAccessAdapterContract,
  evaluatePlatformAccessResponseCandidate,
  inspectWindowsPlatformAccessCandidate,
} from "../src/security/platform-access-adapter.ts";

function response(nonce: Buffer, role = 2, accessMask = 0x101) {
  const bytes = Buffer.alloc(86);
  bytes.write("CRDDPR03", 0, "ascii");
  bytes.writeUInt16LE(3, 8);
  bytes[10] = role;
  bytes[11] = 1;
  nonce.copy(bytes, 12);
  bytes.writeUInt16LE(100, 44);
  bytes.writeUInt32LE(accessMask, 46);
  bytes.fill(0x0a, 50, 82);
  bytes.writeUInt32LE(0x83, 82);
  return bytes;
}

test("Rust platform access responseを安全要約へ限定する", () => {
  const nonce = Buffer.alloc(32, 7);
  const rawResponse = response(nonce);
  const result = evaluatePlatformAccessResponseCandidate(
    rawResponse,
    nonce,
    "authority",
  );
  rawResponse.fill(0);
  nonce.fill(0);
  assert.equal(result.status, "candidate");
  assert.equal(result.accessObservation?.readTraverse, true);
  assert.equal(result.accessObservation?.writeOwner, true);
  assert.equal(result.accessObservation?.addFile, false);
  assert.equal(result.observedPrincipalSource, "current_process_token_user");
  assert.equal(result.runtimePrincipalMode, null);
  assert.equal(result.runtimePrincipalIdentityHash, "0a".repeat(32));
  assert.deepEqual(result.principalObservation, {
    primaryToken: true,
    interactiveGroup: true,
    serviceGroup: false,
    batchGroup: false,
    networkGroup: false,
    restrictedToken: false,
    appContainer: false,
    nonzeroSession: true,
  });
  assert.equal(result.selectedUserBindingVerified, false);
  assert.equal(result.runtimePrincipalBound, false);
  assert.equal(result.helperProcessSpawned, false);
  assert.equal(result.helperResponseValidated, true);
  assert.equal(result.absolutePathReported, false);
  assert.equal(result.principalReported, false);
  assert.equal(result.principalIdentityHashReported, true);
  assert.equal(result.aclReported, false);
  assert.equal(result.rawErrorReported, false);
  assert.equal(result.permissionMutationIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  const serialized = JSON.stringify(result);
  for (const forbidden of ["C:\\\\", "S-1-", "DACL", "stderr"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("protocol nonce role length unknown bitの不一致をfail closedにする", () => {
  const nonce = Buffer.alloc(32, 5);
  const cases: unknown[] = [
    new Uint8Array(response(nonce)),
    response(nonce).subarray(0, 85),
    response(nonce, 1),
    response(Buffer.alloc(32, 6)),
    response(nonce, 2, 0x200),
    (() => {
      const zeroPrincipal = response(nonce);
      zeroPrincipal.fill(0, 50, 82);
      return zeroPrincipal;
    })(),
    (() => {
      const unknownPrincipalFlag = response(nonce);
      unknownPrincipalFlag.writeUInt32LE(0x100, 82);
      return unknownPrincipalFlag;
    })(),
    (() => {
      const noPrimaryToken = response(nonce);
      noPrimaryToken.writeUInt32LE(0x82, 82);
      return noPrimaryToken;
    })(),
  ];
  for (const candidate of cases) {
    const result = evaluatePlatformAccessResponseCandidate(
      candidate,
      nonce,
      "authority",
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.helperProcessSpawned, false);
    assert.equal(result.helperResponseValidated, false);
    assert.equal(result.accessObservation, null);
  }
});

test("全access bitを固定した限定名へ一対一で写像する", () => {
  const nonce = Buffer.alloc(32, 3);
  const names = [
    "readTraverse",
    "addFile",
    "addSubdirectory",
    "writeExtendedAttributes",
    "writeAttributes",
    "deleteChild",
    "deleteOnRootObject",
    "writeDacl",
    "writeOwner",
  ] as const;
  for (const [index, name] of names.entries()) {
    const result = evaluatePlatformAccessResponseCandidate(
      response(nonce, 2, 1 << index),
      nonce,
      "authority",
    );
    assert.equal(result.status, "candidate");
    for (const candidateName of names) {
      assert.equal(
        result.accessObservation?.[candidateName],
        candidateName === name,
      );
    }
  }
});

test("Release binary結合前は入力へ触れずprocess起動前にblockedにする", () => {
  let trapCalls = 0;
  const trap = new Proxy(
    {},
    {
      get() {
        trapCalls += 1;
        throw new Error("must not inspect input");
      },
      ownKeys() {
        trapCalls += 1;
        throw new Error("must not inspect input");
      },
    },
  );
  const result = inspectWindowsPlatformAccessCandidate(trap, trap);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "platform_access_protected_active_generation_binding_not_implemented",
  );
  assert.equal(result.helperProcessSpawned, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(trapCalls, 0);
});

test("Rust componentとproduction停止境界を同時に投影する", () => {
  const contract = describePlatformAccessAdapterContract();
  assert.equal(contract.implementationLanguage, "rust");
  assert.equal(contract.rustCrate, "crdd-platform-access");
  assert.equal(
    contract.windowsCurrentProcessAccessCore,
    "implemented_candidate_component_only",
  );
  assert.equal(
    contract.binaryReleaseIdentityBinding,
    "implemented_candidate_signed_manifest",
  );
  assert.equal(
    contract.productionInvocation,
    "blocked_until_protected_active_generation_and_verified_image_binding",
  );
  assert.equal(contract.shellInvocation, false);
  assert.equal(contract.pathEnvironmentLookup, false);
  assert.equal(contract.cargoRuntimeInvocation, false);
  assert.equal(contract.windowsPermissionMutation, "not_implemented");
  assert.equal(contract.posixAdapter, "not_implemented");
  assert.equal(contract.wireProtocol, "fixed_bounded_binary_revision_3");
  assert.equal(
    contract.principalObservation,
    "implemented_current_process_token_classification_candidate_non_authoritative",
  );
  assert.equal(contract.serviceAccountMode, "not_implemented_blocked");
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
