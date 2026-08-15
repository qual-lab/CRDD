import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  INITIAL_ENROLLMENT_CHALLENGE_CONTRACT,
  INITIAL_ENROLLMENT_DOMAINS,
  INITIAL_ENROLLMENT_REQUEST_CONTRACT,
  INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT,
  compileInitialEnrollmentChallengeCandidate
} from "../src/security/initial-enrollment-pure-core.mjs";
import {
  createInitialEnrollmentAttemptController,
  describeInitialEnrollmentRuntimeStateContract
} from "../src/security/initial-enrollment-runtime-state.ts";
import { canonicalizeProvisioningJsonValueCandidate } from
  "../src/security/provisioning-signature-primitives.ts";

const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");

function lowSP256(signature) {
  const result = Buffer.from(signature);
  const s = BigInt(`0x${result.subarray(32).toString("hex")}`);
  if (s > (P256_ORDER >> 1n)) {
    Buffer.from((P256_ORDER - s).toString(16).padStart(64, "0"), "hex").copy(result, 32);
  }
  return result;
}

function requestFixture(offsetMilliseconds = 0) {
  const key = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = key.publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spki).digest("hex");
  const issued = new Date(Date.now() + offsetMilliseconds);
  const expires = new Date(issued.getTime() + 30 * 60 * 1_000);
  const challenge = {
    contract: INITIAL_ENROLLMENT_CHALLENGE_CONTRACT,
    contractRevision: 1,
    challengeId: "1".repeat(32),
    nonce: Buffer.alloc(32, 9).toString("base64url"),
    platformScopeId: "2".repeat(32),
    provisionerIdentityHash: "3".repeat(64),
    installationKeyId: keyId,
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString()
  };
  const request = {
    contract: INITIAL_ENROLLMENT_REQUEST_CONTRACT,
    contractRevision: 1,
    requestId: "4".repeat(32),
    challengeHash: compileInitialEnrollmentChallengeCandidate(challenge).challengeHash,
    platformScopeId: challenge.platformScopeId,
    provisionerIdentityHash: challenge.provisionerIdentityHash,
    installationKeyId: keyId,
    installationKeySpkiDer: spki.toString("base64url"),
    requestedAt: new Date(issued.getTime() + 1_000).toISOString()
  };
  const canonical = canonicalizeProvisioningJsonValueCandidate(request).canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.length));
  const message = Buffer.concat([
    Buffer.from(INITIAL_ENROLLMENT_DOMAINS.request, "ascii"), length, canonical
  ]);
  const requestEnvelope = {
    contract: INITIAL_ENROLLMENT_REQUEST_ENVELOPE_CONTRACT,
    contractRevision: 1,
    payload: request,
    signatures: [{ keyId, algorithm: "ECDSA-P256-SHA256",
      signature: lowSP256(sign("sha256", message, {
        key: key.privateKey, dsaEncoding: "ieee-p1363"
      })).toString("base64url") }]
  };
  return { challenge, requestEnvelope };
}

test("runtime-owned attempt controller consumes a valid challenge exactly once", () => {
  const controller = createInitialEnrollmentAttemptController();
  const input = requestFixture(-5_000);
  const first = controller.verifyAndConsume(input);
  assert.equal(first.status, "candidate");
  assert.equal(first.attemptConsumed, true);
  assert.equal(first.persistenceConfirmed, false);
  assert.equal(first.runtimeAuthorityConferred, false);
  const second = controller.verifyAndConsume(input);
  assert.equal(second.status, "blocked");
  assert.equal(second.reason, "initial_enrollment_challenge_already_consumed");
  assert.equal(second.freshChallengeRequired, true);
});

test("the first failed verification attempt also consumes the challenge", () => {
  const controller = createInitialEnrollmentAttemptController();
  const input = requestFixture(-5_000);
  input.requestEnvelope.signatures[0] = {
    ...input.requestEnvelope.signatures[0], signature: "A".repeat(86)
  };
  const failed = controller.verifyAndConsume(input);
  assert.equal(failed.status, "blocked");
  assert.equal(failed.attemptConsumed, true);
  assert.equal(controller.verifyAndConsume(input).reason,
    "initial_enrollment_challenge_already_consumed");
});

test("future and expired challenges fail closed and require a fresh challenge", () => {
  const future = createInitialEnrollmentAttemptController().verifyAndConsume(
    requestFixture(60_000));
  assert.equal(future.reason, "initial_enrollment_challenge_not_yet_valid");
  assert.equal(future.freshChallengeRequired, true);
  const expiredInput = requestFixture(-31 * 60 * 1_000);
  const expired = createInitialEnrollmentAttemptController().verifyAndConsume(expiredInput);
  assert.equal(expired.reason, "initial_enrollment_challenge_expired");
  assert.equal(expired.freshChallengeRequired, true);
});

test("runtime state contract keeps persistence authority and effects closed", () => {
  assert.deepEqual(describeInitialEnrollmentRuntimeStateContract(), {
    contract: "crdd-coordinator/initial-enrollment-runtime-state",
    contractRevision: 1,
    runtimeClock: "implemented_candidate_process_owned_wall_and_monotonic_rollback_guard",
    firstVerificationAttemptConsumption:
      "implemented_candidate_success_or_failure_consumes_in_process",
    expiredChallengeBehavior: "blocked_fresh_challenge_required_without_offline_fallback",
    processRestartBehavior: "blocked_persistent_consumption_ledger_required",
    maximumTrackedChallenges: 4096,
    persistentConsumptionLedger: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
});
