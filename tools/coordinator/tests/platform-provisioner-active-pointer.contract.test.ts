import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformProvisionerActivePointerCandidate,
  decodePlatformProvisionerActivePointerBytesCandidate,
  describePlatformProvisionerActivePointerContract,
  encodePlatformProvisionerActivePointerCandidate,
  evaluatePlatformProvisionerActivePointerTransitionCandidate,
} from "../src/security/platform-provisioner-active-pointer.ts";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
const hashD = "d".repeat(64);
const hashE = "e".repeat(64);
const hashF = "f".repeat(64);

function input() {
  return {
    activeId: "0123456789abcdef0123456789abcdef",
    previousActiveHash: null,
    releaseSequence: 1,
    crddVersion: "v0.18.0",
    crddCommit: "1".repeat(40),
    crddTree: "2".repeat(40),
    manifestHash: hashA,
    packageContentRootSha256: hashB,
    rootIdentityHash: hashC,
    rootProtectionHash: hashD,
    runtimePrincipalMode: "local_interactive_selected_user",
    runtimePrincipalIdentityHash: "9".repeat(64),
    platformAccessArtifactIdentityHash: hashE,
    platformAccessArtifactSha256: hashF,
    platformAccessArtifactByteLength: 1024,
  };
}

test("active pointerはRelease・Protection・local user・Rust image・直前pointerを結合する", () => {
  const created = createPlatformProvisionerActivePointerCandidate(input());
  assert.equal(created.status, "candidate");
  assert.match(created.activeHash ?? "", /^[0-9a-f]{64}$/u);
  assert.equal(created.nextActivePointer?.previousActiveHash, null);
  assert.equal(created.nextActivePointer?.rootIdentityHash, hashC);
  assert.equal(created.nextActivePointer?.rootProtectionHash, hashD);
  assert.equal(
    created.nextActivePointer?.runtimePrincipalMode,
    "local_interactive_selected_user",
  );
  assert.equal(
    created.nextActivePointer?.runtimePrincipalIdentityHash,
    "9".repeat(64),
  );
  assert.equal(
    created.nextActivePointer?.platformAccessArtifactIdentityHash,
    hashE,
  );
  assert.equal(created.runtimeAuthorityConferred, false);
  assert.equal(created.runtimeCapabilityIssued, false);
  assert.equal(created.filesystemEffectIssued, false);
});

test("canonical active pointerをexact byteで往復する", () => {
  const created = createPlatformProvisionerActivePointerCandidate(input());
  assert.equal(created.status, "candidate");
  const encoded = encodePlatformProvisionerActivePointerCandidate(
    created.nextActivePointer,
  );
  assert.equal(encoded.status, "candidate");
  const decoded = decodePlatformProvisionerActivePointerBytesCandidate(
    encoded.canonicalBytes,
  );
  assert.equal(decoded.status, "candidate");
  assert.equal(decoded.activeHash, created.activeHash);
  const changed = Buffer.from(encoded.canonicalBytes ?? Buffer.alloc(0));
  changed[changed.length - 2] = 0x30;
  assert.equal(
    decodePlatformProvisionerActivePointerBytesCandidate(changed).status,
    "blocked",
  );
});

test("旧・余分・不完全なactive stateを拒否する", () => {
  const invalidCandidates = [
    {},
    { ...input(), activeId: "latest" },
    { ...input(), releaseSequence: 0 },
    { ...input(), previousActiveHash: "bad" },
    { ...input(), extra: true },
    { ...input(), platformAccessArtifactByteLength: 0 },
    {
      ...input(),
      runtimePrincipalMode: "server_dedicated_service_account",
    },
    { ...input(), runtimePrincipalIdentityHash: "raw-sid" },
  ];
  for (const value of invalidCandidates) {
    assert.equal(
      createPlatformProvisionerActivePointerCandidate(value).status,
      "blocked",
    );
  }
  assert.equal(
    decodePlatformProvisionerActivePointerBytesCandidate(
      Buffer.from('{"contract":"old-active-release"}', "utf8"),
    ).status,
    "blocked",
  );
});

test("active pointer contractはfallbackと自動rollbackを禁止する", () => {
  const contract = describePlatformProvisionerActivePointerContract();
  assert.equal(
    contract.stateModel,
    "exactly_one_staging_and_one_atomic_active_pointer",
  );
  assert.equal(contract.compatibilityState, "prohibited");
  assert.equal(contract.automaticRollback, "prohibited");
  assert.equal(contract.directoryFallback, "prohibited");
  assert.equal(contract.persistence, "native_durable_store_required");
  assert.equal(contract.serviceAccountMode, "not_implemented_blocked");
});

test("active pointer transitionは初回または直前Hashからの単調な次だけを許す", () => {
  const first = createPlatformProvisionerActivePointerCandidate(input());
  assert.equal(first.status, "candidate");
  assert.equal(
    evaluatePlatformProvisionerActivePointerTransitionCandidate(
      null,
      first.nextActivePointer,
    ).status,
    "candidate",
  );
  const next = createPlatformProvisionerActivePointerCandidate({
    ...input(),
    activeId: "fedcba9876543210fedcba9876543210",
    previousActiveHash: first.activeHash,
    releaseSequence: 2,
  });
  assert.equal(next.status, "candidate");
  assert.equal(
    evaluatePlatformProvisionerActivePointerTransitionCandidate(
      first.nextActivePointer,
      next.nextActivePointer,
    ).status,
    "candidate",
  );
  for (const invalidCandidate of [
    { ...next.nextActivePointer, previousActiveHash: hashA },
    { ...next.nextActivePointer, releaseSequence: 3 },
    { ...next.nextActivePointer, activeId: input().activeId },
  ]) {
    assert.equal(
      evaluatePlatformProvisionerActivePointerTransitionCandidate(
        first.nextActivePointer,
        invalidCandidate,
      ).status,
      "blocked",
    );
  }
});
