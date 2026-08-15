// @ts-check

import { performance } from "node:perf_hooks";
import { types as utilTypes } from "node:util";

import {
  compileInitialEnrollmentChallengeCandidate,
  verifyInitialEnrollmentRequestCandidate,
} from "./initial-enrollment-pure-core.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const MAX_TRACKED_CHALLENGES = 4_096;
const REQUEST_VERIFY_KEYS = new Set(["challenge", "requestEnvelope"]);

type RuntimeClockSnapshot = Readonly<{
  wallMilliseconds: number;
  monotonicMilliseconds: number;
}>;

/**
 * @template {"candidate" | "blocked"} S
 * @template {Record<string, unknown>} T
 * @param {S} status
 * @param {string} reason
 * @param {T} fields
 */
function result<
  S extends "candidate" | "blocked",
  T extends Record<string, unknown>,
>(status: S, reason: string, fields: T) {
  return Object.freeze({
    status,
    reason,
    ...fields,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

/** @param {string} reason @param {Record<string, unknown>} [fields] */
function blocked(reason: string, fields: Record<string, unknown> = {}) {
  return result("blocked", reason, fields);
}

/** @template {Record<string, unknown>} T @param {string} reason @param {T} fields */
function candidate<T extends Record<string, unknown>>(
  reason: string,
  fields: T,
) {
  return result("candidate", reason, fields);
}

function runtimeNowSnapshot() {
  const wallMilliseconds = Date.now();
  const monotonicMilliseconds = performance.now();
  if (
    !Number.isSafeInteger(wallMilliseconds) ||
    !Number.isFinite(monotonicMilliseconds)
  ) {
    return null;
  }
  return Object.freeze({ wallMilliseconds, monotonicMilliseconds });
}

function challengeValidityWindow(rawChallenge: unknown) {
  if (
    rawChallenge === null ||
    typeof rawChallenge !== "object" ||
    utilTypes.isProxy(rawChallenge)
  ) {
    return null;
  }
  const issuedAt = Object.getOwnPropertyDescriptor(rawChallenge, "issuedAt");
  const expiresAt = Object.getOwnPropertyDescriptor(rawChallenge, "expiresAt");
  if (
    !issuedAt ||
    !("value" in issuedAt) ||
    issuedAt.get !== undefined ||
    issuedAt.set !== undefined ||
    typeof issuedAt.value !== "string" ||
    !expiresAt ||
    !("value" in expiresAt) ||
    expiresAt.get !== undefined ||
    expiresAt.set !== undefined ||
    typeof expiresAt.value !== "string"
  ) {
    return null;
  }
  return Object.freeze({
    issuedAt: issuedAt.value,
    expiresAt: expiresAt.value,
  });
}

export function createInitialEnrollmentAttemptController() {
  const consumed = new Map<string, number>();
  let lastClock: RuntimeClockSnapshot | null = null;

  function readClock() {
    const current = runtimeNowSnapshot();
    if (
      !current ||
      (lastClock &&
        (current.wallMilliseconds < lastClock.wallMilliseconds ||
          current.monotonicMilliseconds < lastClock.monotonicMilliseconds))
    ) {
      return null;
    }
    lastClock = current;
    return current;
  }

  /** @param {number} now */
  function pruneExpired(now: number) {
    for (const [challengeHash, expiresAt] of consumed) {
      if (expiresAt <= now) consumed.delete(challengeHash);
    }
  }

  /** @param {unknown} rawInput */
  function verifyAndConsume(rawInput: unknown) {
    const input = snapshotPlainRecord(rawInput, REQUEST_VERIFY_KEYS);
    if (!input) return blocked("initial_enrollment_challenge_invalid");
    const challenge = input.challenge;
    const compiled = compileInitialEnrollmentChallengeCandidate(challenge);
    if (
      compiled.status !== "candidate" ||
      typeof compiled.challengeHash !== "string"
    ) {
      return blocked("initial_enrollment_challenge_invalid");
    }
    const validityWindow = challengeValidityWindow(challenge);
    if (!validityWindow) return blocked("initial_enrollment_challenge_invalid");
    const clock = readClock();
    if (!clock)
      return blocked(
        "runtime_enrollment_clock_unavailable_or_rollback_detected",
      );
    pruneExpired(clock.wallMilliseconds);
    if (consumed.has(compiled.challengeHash)) {
      return blocked("initial_enrollment_challenge_already_consumed", {
        attemptConsumed: true,
        freshChallengeRequired: true,
      });
    }
    if (consumed.size >= MAX_TRACKED_CHALLENGES) {
      return blocked("initial_enrollment_consumption_ledger_capacity_exceeded");
    }

    const issuedAt = Date.parse(validityWindow.issuedAt);
    const expiresAt = Date.parse(validityWindow.expiresAt);
    consumed.set(compiled.challengeHash, expiresAt);

    if (clock.wallMilliseconds < issuedAt) {
      return blocked("initial_enrollment_challenge_not_yet_valid", {
        attemptConsumed: true,
        freshChallengeRequired: true,
      });
    }
    if (clock.wallMilliseconds >= expiresAt) {
      return blocked("initial_enrollment_challenge_expired", {
        attemptConsumed: true,
        freshChallengeRequired: true,
      });
    }

    const verification = verifyInitialEnrollmentRequestCandidate(input);
    if (verification.status !== "candidate") {
      return blocked(
        "initial_enrollment_request_attempt_failed_and_challenge_consumed",
        {
          attemptConsumed: true,
          freshChallengeRequired: true,
        },
      );
    }
    return candidate(
      "initial_enrollment_request_verified_and_challenge_consumed_persistence_required",
      {
        attemptConsumed: true,
        freshChallengeRequired: false,
        proofOfPossessionCryptographicMatch: true,
        persistenceConfirmed: false,
      },
    );
  }

  return Object.freeze({ verifyAndConsume });
}

export function describeInitialEnrollmentRuntimeStateContract() {
  return Object.freeze({
    contract: "crdd-coordinator/initial-enrollment-runtime-state",
    contractRevision: 1,
    runtimeClock:
      "implemented_candidate_process_owned_wall_and_monotonic_rollback_guard",
    firstVerificationAttemptConsumption:
      "implemented_candidate_success_or_failure_consumes_in_process",
    expiredChallengeBehavior:
      "blocked_fresh_challenge_required_without_offline_fallback",
    processRestartBehavior: "blocked_persistent_consumption_ledger_required",
    maximumTrackedChallenges: MAX_TRACKED_CHALLENGES,
    persistentConsumptionLedger: "not_implemented",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}
