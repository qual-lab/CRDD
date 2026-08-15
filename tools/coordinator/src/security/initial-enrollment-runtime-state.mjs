import { performance } from "node:perf_hooks";

import {
  compileInitialEnrollmentChallengeCandidate,
  verifyInitialEnrollmentRequestCandidate
} from "./initial-enrollment-pure-core.mjs";

const MAX_TRACKED_CHALLENGES = 4_096;

function result(status, reason, fields = {}) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}

function blocked(reason, fields = {}) {
  return result("blocked", reason, fields);
}

function candidate(reason, fields = {}) {
  return result("candidate", reason, fields);
}

function runtimeNowSnapshot() {
  const wallMilliseconds = Date.now();
  const monotonicMilliseconds = performance.now();
  if (!Number.isSafeInteger(wallMilliseconds) || !Number.isFinite(monotonicMilliseconds)) {
    return null;
  }
  return Object.freeze({ wallMilliseconds, monotonicMilliseconds });
}

export function createInitialEnrollmentAttemptController() {
  const consumed = new Map();
  let lastClock = null;

  function readClock() {
    const current = runtimeNowSnapshot();
    if (!current || (lastClock && (
      current.wallMilliseconds < lastClock.wallMilliseconds ||
      current.monotonicMilliseconds < lastClock.monotonicMilliseconds
    ))) {
      return null;
    }
    lastClock = current;
    return current;
  }

  function pruneExpired(now) {
    for (const [challengeHash, expiresAt] of consumed) {
      if (expiresAt <= now) consumed.delete(challengeHash);
    }
  }

  function verifyAndConsume(rawInput) {
    const challenge = rawInput?.challenge;
    const compiled = compileInitialEnrollmentChallengeCandidate(challenge);
    if (compiled.status !== "candidate" || typeof compiled.challengeHash !== "string") {
      return blocked("initial_enrollment_challenge_invalid");
    }
    const clock = readClock();
    if (!clock) return blocked("runtime_enrollment_clock_unavailable_or_rollback_detected");
    pruneExpired(clock.wallMilliseconds);
    if (consumed.has(compiled.challengeHash)) {
      return blocked("initial_enrollment_challenge_already_consumed", {
        attemptConsumed: true,
        freshChallengeRequired: true
      });
    }
    if (consumed.size >= MAX_TRACKED_CHALLENGES) {
      return blocked("initial_enrollment_consumption_ledger_capacity_exceeded");
    }

    const issuedAt = Date.parse(challenge.issuedAt);
    const expiresAt = Date.parse(challenge.expiresAt);
    consumed.set(compiled.challengeHash, expiresAt);

    if (clock.wallMilliseconds < issuedAt) {
      return blocked("initial_enrollment_challenge_not_yet_valid", {
        attemptConsumed: true,
        freshChallengeRequired: true
      });
    }
    if (clock.wallMilliseconds >= expiresAt) {
      return blocked("initial_enrollment_challenge_expired", {
        attemptConsumed: true,
        freshChallengeRequired: true
      });
    }

    const verification = verifyInitialEnrollmentRequestCandidate(rawInput);
    if (verification.status !== "candidate") {
      return blocked("initial_enrollment_request_attempt_failed_and_challenge_consumed", {
        attemptConsumed: true,
        freshChallengeRequired: true
      });
    }
    return candidate("initial_enrollment_request_verified_and_challenge_consumed_persistence_required", {
      attemptConsumed: true,
      freshChallengeRequired: false,
      proofOfPossessionCryptographicMatch: true,
      persistenceConfirmed: false
    });
  }

  return Object.freeze({ verifyAndConsume });
}

export function describeInitialEnrollmentRuntimeStateContract() {
  return Object.freeze({
    contract: "crdd-coordinator/initial-enrollment-runtime-state",
    contractRevision: 1,
    runtimeClock: "implemented_candidate_process_owned_wall_and_monotonic_rollback_guard",
    firstVerificationAttemptConsumption:
      "implemented_candidate_success_or_failure_consumes_in_process",
    expiredChallengeBehavior: "blocked_fresh_challenge_required_without_offline_fallback",
    processRestartBehavior: "blocked_persistent_consumption_ledger_required",
    maximumTrackedChallenges: MAX_TRACKED_CHALLENGES,
    persistentConsumptionLedger: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false
  });
}
