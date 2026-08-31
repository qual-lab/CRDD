import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  compileRuntimeActivationRecordCandidate,
  decodeRuntimeActivationRecordCandidate,
} from "./runtime-activation-record.ts";

const INPUT_KEYS = new Set(["previousCanonicalBytes", "nextRecord"]);
const RESULT_KEYS = new Set([
  "status",
  "reason",
  "record",
  "recordHash",
  "canonicalBytes",
  "runtimeCapabilityIssued",
]);
const RECORD_KEYS = new Set([
  "contract",
  "contractRevision",
  "activationId",
  "activationRevision",
  "status",
  "previousActivationHash",
  "repositoryIdentityHash",
  "runtimeRootIdentityHash",
  "bundleId",
  "bundleRevision",
  "authorityBundleHash",
  "policyId",
  "policyRevision",
  "trustPolicyHash",
  "registryId",
  "registryRevision",
  "registryHash",
  "activatedAt",
  "disabledAt",
]);
const FIXED_IDENTITY_KEYS = Object.freeze([
  "activationId",
  "repositoryIdentityHash",
  "runtimeRootIdentityHash",
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
  "registryHash",
]);

type ActivationRecord = Readonly<{
  contract: string;
  contractRevision: number;
  activationId: string;
  activationRevision: number;
  status: "active" | "disabled";
  previousActivationHash: string | null;
  repositoryIdentityHash: string;
  runtimeRootIdentityHash: string;
  bundleId: string;
  bundleRevision: number;
  authorityBundleHash: string;
  policyId: string;
  policyRevision: number;
  trustPolicyHash: string;
  registryId: string;
  registryRevision: number;
  registryHash: string;
  activatedAt: string;
  disabledAt: string | null;
}>;
type ActivationCandidate = Readonly<{
  record: ActivationRecord;
  recordHash: string;
  canonicalBytes: Buffer;
}>;

function isActivationStatus(value: unknown): value is "active" | "disabled" {
  return value === "active" || value === "disabled";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function activationCandidate(raw: unknown): ActivationCandidate | null {
  const result = snapshotPlainRecord(raw, RESULT_KEYS);
  const record = result && snapshotPlainRecord(result.record, RECORD_KEYS);
  if (
    result?.status !== "candidate" ||
    typeof result.recordHash !== "string" ||
    !Buffer.isBuffer(result.canonicalBytes) ||
    !record
  ) {
    return null;
  }
  if (
    typeof record.contract !== "string" ||
    typeof record.contractRevision !== "number" ||
    typeof record.activationId !== "string" ||
    typeof record.activationRevision !== "number" ||
    (record.status !== "active" && record.status !== "disabled") ||
    (record.previousActivationHash !== null &&
      typeof record.previousActivationHash !== "string") ||
    typeof record.repositoryIdentityHash !== "string" ||
    typeof record.runtimeRootIdentityHash !== "string" ||
    typeof record.bundleId !== "string" ||
    typeof record.bundleRevision !== "number" ||
    typeof record.authorityBundleHash !== "string" ||
    typeof record.policyId !== "string" ||
    typeof record.policyRevision !== "number" ||
    typeof record.trustPolicyHash !== "string" ||
    typeof record.registryId !== "string" ||
    typeof record.registryRevision !== "number" ||
    typeof record.registryHash !== "string" ||
    typeof record.activatedAt !== "string" ||
    (record.disabledAt !== null && typeof record.disabledAt !== "string")
  ) {
    return null;
  }
  const status = record.status;
  const previousActivationHash = record.previousActivationHash;
  const disabledAt = record.disabledAt;
  if (
    !isActivationStatus(status) ||
    !isNullableString(previousActivationHash) ||
    !isNullableString(disabledAt)
  ) {
    return null;
  }
  return Object.freeze({
    record: Object.freeze({
      contract: record.contract,
      contractRevision: record.contractRevision,
      activationId: record.activationId,
      activationRevision: record.activationRevision,
      status,
      previousActivationHash,
      repositoryIdentityHash: record.repositoryIdentityHash,
      runtimeRootIdentityHash: record.runtimeRootIdentityHash,
      bundleId: record.bundleId,
      bundleRevision: record.bundleRevision,
      authorityBundleHash: record.authorityBundleHash,
      policyId: record.policyId,
      policyRevision: record.policyRevision,
      trustPolicyHash: record.trustPolicyHash,
      registryId: record.registryId,
      registryRevision: record.registryRevision,
      registryHash: record.registryHash,
      activatedAt: record.activatedAt,
      disabledAt,
    }),
    recordHash: result.recordHash,
    canonicalBytes: Buffer.from(result.canonicalBytes),
  });
}

/**
 * @param {string} status
 * @param {string} reason
 * @param {{record: Record<string, unknown>, recordHash: string, canonicalBytes: Buffer} | null} [next]
 * @param {string | null} [transitionKind]
 */
function response(
  status: string,
  reason: string,
  next: ActivationCandidate | null = null,
  transitionKind: string | null = null,
) {
  return Object.freeze({
    status,
    reason,
    transitionKind,
    record: next?.record ?? null,
    recordHash: next?.recordHash ?? null,
    canonicalBytes: next ? Buffer.from(next.canonicalBytes) : null,
    filesystemEffectIssued: false,
    persistenceIssued: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * @param {Record<string, unknown>} previous
 * @param {Record<string, unknown>} next
 * @param {readonly string[]} keys
 */
function sameFields(
  previous: ActivationRecord,
  next: ActivationRecord,
  keys: readonly string[],
) {
  return keys.every(
    (key) =>
      Object.getOwnPropertyDescriptor(previous, key)?.value ===
      Object.getOwnPropertyDescriptor(next, key)?.value,
  );
}

/** @param {unknown} rawInput */
export function evaluateRuntimeActivationTransitionCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
    if (!input)
      return response("blocked", "runtime_activation_transition_input_invalid");

    let previous = null;
    if (input.previousCanonicalBytes !== null) {
      previous = activationCandidate(
        decodeRuntimeActivationRecordCandidate(input.previousCanonicalBytes),
      );
      if (!previous) {
        return response(
          "blocked",
          "runtime_activation_previous_record_invalid",
        );
      }
    }

    const next = activationCandidate(
      compileRuntimeActivationRecordCandidate(input.nextRecord),
    );
    if (!next) {
      return response("blocked", "runtime_activation_next_record_invalid");
    }

    if (previous === null) {
      if (
        next.record.status !== "active" ||
        next.record.activationRevision !== 1 ||
        next.record.previousActivationHash !== null ||
        next.record.disabledAt !== null
      ) {
        return response(
          "blocked",
          "runtime_activation_initial_transition_invalid",
        );
      }
      return response(
        "candidate",
        "runtime_activation_initial_transition_candidate",
        next,
        "initial_null_to_active",
      );
    }

    if (previous.record.status === "disabled") {
      return response(
        "blocked",
        "runtime_disabled_transition_policy_not_implemented",
      );
    }
    if (next.record.status === "active") {
      return response(
        "blocked",
        "runtime_reactivation_transition_policy_not_implemented",
      );
    }
    if (previous.record.activationRevision === Number.MAX_SAFE_INTEGER) {
      return response("blocked", "runtime_activation_revision_exhausted");
    }

    if (
      next.record.activationRevision !==
        previous.record.activationRevision + 1 ||
      next.record.previousActivationHash !== previous.recordHash ||
      !sameFields(previous.record, next.record, FIXED_IDENTITY_KEYS) ||
      !sameFields(previous.record, next.record, AUTHORITY_TUPLE_KEYS) ||
      next.record.activatedAt !== previous.record.activatedAt
    ) {
      return response(
        "blocked",
        "runtime_activation_disable_transition_invalid",
      );
    }

    return response(
      "candidate",
      "runtime_activation_disable_transition_candidate",
      next,
      "active_to_disabled",
    );
  } catch {
    return response("blocked", "runtime_activation_transition_input_invalid");
  }
}
