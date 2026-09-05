import assert from "node:assert/strict";
import test from "node:test";

import {
  describePlatformAccessAdapterContract,
  evaluatePlatformAccessResponseCandidate,
  inspectWindowsPlatformAccessCandidate,
} from "../../src/security/platform-access-adapter.ts";

function response(
  nonce: Buffer,
  role = 2,
  accessMask = 0x101,
  principalMask = 0x83,
) {
  const bytes = Buffer.alloc(86);
  bytes.write("CRDDPR03", 0, "ascii");
  bytes.writeUInt16LE(3, 8);
  bytes[10] = role;
  bytes[11] = 1;
  nonce.copy(bytes, 12);
  bytes.writeUInt16LE(100, 44);
  bytes.writeUInt32LE(accessMask, 46);
  bytes.fill(0x0a, 50, 82);
  bytes.writeUInt32LE(principalMask, 82);
  return bytes;
}

function assertFullyBlocked(
  result: ReturnType<typeof evaluatePlatformAccessResponseCandidate>,
) {
  assert.deepEqual(result, {
    status: "blocked",
    reason: "platform_access_helper_response_invalid",
    accessObservation: null,
    observedPrincipalSource: null,
    runtimePrincipalMode: null,
    runtimePrincipalIdentityHash: null,
    principalObservation: null,
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
    workerSpawnAttempts: 0,
    processEffectIssued: false,
    helperProcessSpawned: false,
    helperProcessResumed: false,
    helperExchangeCompleted: false,
    processTreeTerminationConfirmed: false,
    manualRecoveryRequired: false,
    helperResponseValidated: false,
    absolutePathReported: false,
    principalReported: false,
    principalIdentityHashReported: false,
    aclReported: false,
    rawErrorReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
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
  assert.equal(
    result.observedPrincipalSource,
    "native_supervisor_current_process_token_user",
  );
  assert.equal(result.runtimePrincipalMode, "local_interactive_selected_user");
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
  assert.equal(result.selectedUserBindingVerified, true);
  assert.equal(result.runtimePrincipalBound, true);
  assert.equal(result.workerSpawnAttempts, 0);
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.helperProcessSpawned, false);
  assert.equal(result.helperProcessResumed, false);
  assert.equal(result.helperExchangeCompleted, false);
  assert.equal(result.processTreeTerminationConfirmed, false);
  assert.equal(result.manualRecoveryRequired, false);
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
  const legacyRevisionTwo = Buffer.alloc(82);
  response(nonce).copy(legacyRevisionTwo, 0, 0, 82);
  legacyRevisionTwo.write("CRDDPR02", 0, "ascii");
  legacyRevisionTwo.writeUInt16LE(2, 8);
  const magicOnlyMismatch = response(nonce);
  magicOnlyMismatch.write("CRDDPR02", 0, "ascii");
  const revisionOnlyMismatch = response(nonce);
  revisionOnlyMismatch.writeUInt16LE(2, 8);
  const cases: unknown[] = [
    new Uint8Array(response(nonce)),
    response(nonce).subarray(0, 85),
    legacyRevisionTwo,
    magicOnlyMismatch,
    revisionOnlyMismatch,
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
      unknownPrincipalFlag.writeUInt32LE(0x101, 82);
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
    assertFullyBlocked(result);
  }
});

test("local interactive selected user以外のprincipalをfail closedにする", () => {
  const nonce = Buffer.alloc(32, 9);
  for (const principalMask of [
    0x82,
    0x81,
    0x03,
    0x83 | (1 << 2),
    0x83 | (1 << 3),
    0x83 | (1 << 4),
    0x83 | (1 << 5),
    0x83 | (1 << 6),
  ]) {
    const result = evaluatePlatformAccessResponseCandidate(
      response(nonce, 2, 0x101, principalMask),
      nonce,
      "authority",
    );
    assertFullyBlocked(result);
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
    "signed_exact_artifact_spawn_with_minimal_environment_and_bounded_io",
  );
  assert.equal(contract.contractRevision, 3);
  assert.equal(contract.maximumWorkerSpawnAttemptsPerInvocation, 1);
  assert.equal(contract.shellInvocation, false);
  assert.equal(contract.pathEnvironmentLookup, false);
  assert.equal(contract.cargoRuntimeInvocation, false);
  assert.equal(contract.windowsPermissionMutation, "not_implemented");
  assert.equal(contract.posixAdapter, "not_implemented");
  assert.equal(contract.wireProtocol, "fixed_bounded_binary_revision_3");
  assert.equal(
    contract.principalObservation,
    "implemented_signed_supervisor_token_classification_fail_closed_candidate",
  );
  assert.equal(
    contract.selectedUserBinding,
    "implemented_native_current_process_primary_token_and_login_session_observation",
  );
  assert.equal(contract.serviceAccountMode, "not_implemented_blocked");
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
