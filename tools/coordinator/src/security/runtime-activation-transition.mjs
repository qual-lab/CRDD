// @ts-check

import { snapshotPlainRecord } from "./plain-data-snapshot.mjs";
import {
  compileRuntimeActivationRecordCandidate,
  decodeRuntimeActivationRecordCandidate
} from "./runtime-activation-record.mjs";

const INPUT_KEYS = new Set(["previousCanonicalBytes", "nextRecord"]);
const FIXED_IDENTITY_KEYS = Object.freeze([
  "activationId",
  "repositoryIdentityHash",
  "runtimeRootIdentityHash"
]);
const AUTHORITY_TUPLE_KEYS = Object.freeze([
  "bundleId",
  "bundleRevision",
  "authorityBundleHash",
  "policyId",
  "policyRevision",
  "trustPolicyHash",
  "registryId",
  "registryRevision",
  "registryHash"
]);

/**
 * @param {string} status
 * @param {string} reason
 * @param {{record: Record<string, any>, recordHash: string, canonicalBytes: Buffer} | null} [next]
 * @param {string | null} [transitionKind]
 */
function response(status, reason, next = null, transitionKind = null) {
  return Object.freeze({
    status,
    reason,
    transitionKind,
    record: next?.record ?? null,
    recordHash: next?.recordHash ?? null,
    canonicalBytes: next ? Buffer.from(next.canonicalBytes) : null,
    filesystemEffectIssued: false,
    persistenceIssued: false,
    runtimeCapabilityIssued: false
  });
}

/**
 * @param {Record<string, any>} previous
 * @param {Record<string, any>} next
 * @param {readonly string[]} keys
 */
function sameFields(previous, next, keys) {
  return keys.every((key) => previous[key] === next[key]);
}

/** @param {unknown} rawInput */
export function evaluateRuntimeActivationTransitionCandidate(rawInput) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input) return response("blocked", "runtime_activation_transition_input_invalid");

    let previous = null;
    if (input.previousCanonicalBytes !== null) {
      previous = decodeRuntimeActivationRecordCandidate(input.previousCanonicalBytes);
      if (previous.status !== "candidate") {
        return response("blocked", "runtime_activation_previous_record_invalid");
      }
    }

    const next = compileRuntimeActivationRecordCandidate(input.nextRecord);
    if (next.status !== "candidate") {
      return response("blocked", "runtime_activation_next_record_invalid");
    }

    if (previous === null) {
      if (next.record.status !== "active" || next.record.activationRevision !== 1 ||
          next.record.previousActivationHash !== null || next.record.disabledAt !== null) {
        return response("blocked", "runtime_activation_initial_transition_invalid");
      }
      return response("candidate", "runtime_activation_initial_transition_candidate", next,
        "initial_null_to_active");
    }

    if (previous.record.status === "disabled") {
      return response("blocked", "runtime_disabled_transition_policy_not_implemented");
    }
    if (next.record.status === "active") {
      return response("blocked", "runtime_reactivation_transition_policy_not_implemented");
    }
    if (previous.record.activationRevision === Number.MAX_SAFE_INTEGER) {
      return response("blocked", "runtime_activation_revision_exhausted");
    }

    if (next.record.activationRevision !== previous.record.activationRevision + 1 ||
        next.record.previousActivationHash !== previous.recordHash ||
        !sameFields(previous.record, next.record, FIXED_IDENTITY_KEYS) ||
        !sameFields(previous.record, next.record, AUTHORITY_TUPLE_KEYS) ||
        next.record.activatedAt !== previous.record.activatedAt) {
      return response("blocked", "runtime_activation_disable_transition_invalid");
    }

    return response("candidate", "runtime_activation_disable_transition_candidate", next,
      "active_to_disabled");
  } catch {
    return response("blocked", "runtime_activation_transition_input_invalid");
  }
}
