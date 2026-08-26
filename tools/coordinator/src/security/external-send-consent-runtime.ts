import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import {
  dockerRecoveryCommitName,
  readCommittedDockerRecoveryJson,
  removeCommittedDockerRecoveryJson,
  writeCommittedDockerRecoveryJson,
} from "./docker-recovery-journal.ts";
import type { ExternalSendPolicy } from "./external-send-policy-runtime.ts";

export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT =
  "crdd-coordinator/external-send-consent-runtime";
export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT_REVISION = 2;
export const EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX =
  "external-send-consent-active-v2-";

const HEX64 = /^[a-f0-9]{64}$/u;
const CONSENT_SCHEMA = "crdd-coordinator/external-send-consent/v2";
const CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1_000;

type VerifiedRoot = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedRuntimeStateRootCapability>
>;
type Lock = Readonly<{ release: () => boolean }>;
type ConsentDependencies = Readonly<{
  observeRoot: (initializeIfMissing: boolean) => VerifiedRoot | null;
  acquireLock: (bindingHash: string) => Lock | null;
  now: () => number;
  nonce: () => string;
}>;

function exactKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

export function compileExternalSendConsentBoundaryHash(
  policy: ExternalSendPolicy,
) {
  return HEX64.test(policy.sourceFileHash)
    ? createHash("sha256")
        .update("crdd-external-send-consent-boundary-v2\0")
        .update(policy.policyId)
        .update("\0")
        .update(policy.sourceFileHash)
        .digest("hex")
    : null;
}

function productionObserveRoot(initializeIfMissing: boolean) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    initializeIfMissing,
    new Date().toISOString(),
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  return observation.status === "candidate" && root ? root : null;
}

const productionDependencies: ConsentDependencies = Object.freeze({
  observeRoot: productionObserveRoot,
  acquireLock: acquireRuntimeOwnedDockerRuntimeStateKernelLock,
  now: Date.now,
  nonce: () => randomBytes(8).toString("hex"),
});

function sameRoot(left: VerifiedRoot, right: VerifiedRoot) {
  return (
    left.rootPath === right.rootPath &&
    left.runtimeStateIdentityHash === right.runtimeStateIdentityHash &&
    left.runtimeStateProtectionHash === right.runtimeStateProtectionHash &&
    left.localUserBindingHash === right.localUserBindingHash &&
    left.stableLogicalHomeBindingHash === right.stableLogicalHomeBindingHash
  );
}

function expectedBoundary(
  policy: ExternalSendPolicy,
  boundaryHash: string,
  root: VerifiedRoot,
) {
  return Object.freeze({
    consentBoundaryHash: boundaryHash,
    policyId: policy.policyId,
    sourceFileHash: policy.sourceFileHash,
    informationClassification: policy.informationClassification,
    providerBoundaries: Object.freeze(
      policy.destinations.map((destination) =>
        Object.freeze({
          provider: destination.provider,
          accountTenantBoundary: destination.accountTenantBoundary,
          subscriptionOffering: destination.subscriptionOffering,
          purposeOperations: Object.freeze([...destination.purposeOperations]),
          termsPolicyIdentity: destination.termsPolicyIdentity,
        }),
      ),
    ),
    localUserBindingHash: root.localUserBindingHash,
    runtimeStateIdentityHash: root.runtimeStateIdentityHash,
    runtimeStateProtectionHash: root.runtimeStateProtectionHash,
    runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
  });
}

function recordFor(
  policy: ExternalSendPolicy,
  boundaryHash: string,
  root: VerifiedRoot,
  now: number,
  generation: string,
) {
  return Object.freeze({
    schema: CONSENT_SCHEMA,
    ...expectedBoundary(policy, boundaryHash, root),
    generation,
    confirmedAtEpochMs: now,
    expiresAtEpochMs: now + CONSENT_LIFETIME_MS,
  });
}

function validRecord(
  value: unknown,
  expected: ReturnType<typeof expectedBoundary>,
  now: number,
) {
  if (
    !exactKeys(value, [
      "schema",
      "consentBoundaryHash",
      "policyId",
      "sourceFileHash",
      "informationClassification",
      "providerBoundaries",
      "localUserBindingHash",
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "runtimeStateBindingHash",
      "apiKeyFallbackAllowed",
      "additionalPurchaseAllowed",
      "generation",
      "confirmedAtEpochMs",
      "expiresAtEpochMs",
    ])
  )
    return false;
  const record = value as Record<string, unknown>;
  const boundary = Object.fromEntries(
    Object.keys(expected).map((key) => [key, record[key]]),
  );
  return (
    record.schema === CONSENT_SCHEMA &&
    typeof record.generation === "string" &&
    /^[a-f0-9]{16}$/u.test(record.generation) &&
    JSON.stringify(boundary) === JSON.stringify(expected) &&
    typeof record.confirmedAtEpochMs === "number" &&
    Number.isSafeInteger(record.confirmedAtEpochMs) &&
    typeof record.expiresAtEpochMs === "number" &&
    Number.isSafeInteger(record.expiresAtEpochMs) &&
    record.expiresAtEpochMs ===
      record.confirmedAtEpochMs + CONSENT_LIFETIME_MS &&
    record.confirmedAtEpochMs <= now &&
    record.expiresAtEpochMs > now
  );
}

function consentName(boundaryHash: string, generation: string) {
  return `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${boundaryHash}-${generation}.json`;
}

function consentPaths(root: VerifiedRoot, name: string) {
  const file = path.join(root.rootPath, name);
  return Object.freeze({
    file,
    commit: path.join(root.rootPath, dockerRecoveryCommitName(name)),
  });
}

function exactRegularFileOrMissing(file: string) {
  if (!fs.existsSync(file)) return true;
  const stat = fs.lstatSync(file);
  return stat.isFile() && !stat.isSymbolicLink();
}

// Removing this one fixed pair only reduces authority. Commit is removed
// first so a crash cannot leave an old record authoritative.
function activeNames(root: VerifiedRoot) {
  const pattern =
    /^external-send-consent-active-v2-([a-f0-9]{64})-([a-f0-9]{16})\.json(?:\.crdd-commit\.json)?$/u;
  const names = new Set<string>();
  for (const entry of fs.readdirSync(root.rootPath)) {
    const match = pattern.exec(entry);
    if (match?.[1] && match[2]) names.add(consentName(match[1], match[2]));
  }
  return [...names];
}

function revokePair(root: VerifiedRoot) {
  const names = activeNames(root);
  if (names.length > 1) return false;
  const name = names[0];
  if (!name) return true;
  const target = consentPaths(root, name);
  if (
    !exactRegularFileOrMissing(target.file) ||
    !exactRegularFileOrMissing(target.commit)
  )
    return false;
  if (fs.existsSync(target.file) && fs.existsSync(target.commit)) {
    try {
      removeCommittedDockerRecoveryJson(target.file, name);
      return !fs.existsSync(target.file) && !fs.existsSync(target.commit);
    } catch {
      // Invalid fixed-pair data is not authority. Fall through to bounded
      // authority-reducing deletion after exact file-type checks above.
    }
  }
  if (fs.existsSync(target.commit)) fs.rmSync(target.commit);
  if (fs.existsSync(target.file)) fs.rmSync(target.file);
  return !fs.existsSync(target.file) && !fs.existsSync(target.commit);
}

function withConsentLock<T>(
  dependencies: ConsentDependencies,
  root: VerifiedRoot,
  operation: () => T,
) {
  const lock = dependencies.acquireLock(root.stableLogicalHomeBindingHash);
  if (!lock) return null;
  let result: T | null = null;
  let failed = false;
  try {
    const rebound = dependencies.observeRoot(false);
    if (!rebound || !sameRoot(root, rebound)) failed = true;
    else result = operation();
  } catch {
    failed = true;
  }
  let released = false;
  try {
    released = lock.release();
  } catch {
    released = false;
  }
  return failed || !released ? null : result;
}

function createRuntime(dependencies: ConsentDependencies) {
  function resolve(policy: ExternalSendPolicy) {
    try {
      const boundaryHash = compileExternalSendConsentBoundaryHash(policy);
      const root = dependencies.observeRoot(false);
      if (!boundaryHash || !root)
        return Object.freeze({ status: "absent" as const, boundaryHash });
      return (
        withConsentLock(dependencies, root, () => {
          const names = activeNames(root);
          if (names.length > 1)
            return Object.freeze({
              status: "recovery_required" as const,
              boundaryHash,
            });
          const currentName = names[0];
          if (!currentName)
            return Object.freeze({ status: "absent" as const, boundaryHash });
          const target = consentPaths(root, currentName);
          const filePresent = fs.existsSync(target.file);
          const commitPresent = fs.existsSync(target.commit);
          if (!filePresent || !commitPresent) {
            return revokePair(root)
              ? Object.freeze({ status: "absent" as const, boundaryHash })
              : Object.freeze({
                  status: "recovery_required" as const,
                  boundaryHash,
                });
          }
          let record: unknown;
          try {
            record = readCommittedDockerRecoveryJson(
              target.file,
              currentName,
            ).value;
          } catch {
            return revokePair(root)
              ? Object.freeze({ status: "absent" as const, boundaryHash })
              : Object.freeze({
                  status: "recovery_required" as const,
                  boundaryHash,
                });
          }
          const currentMatch =
            /^external-send-consent-active-v2-([a-f0-9]{64})-([a-f0-9]{16})\.json$/u.exec(
              currentName,
            );
          if (currentMatch?.[1] !== boundaryHash)
            return Object.freeze({
              status: "needs_confirmation" as const,
              boundaryHash,
            });
          return currentMatch?.[2] ===
            (record as Record<string, unknown>).generation &&
            validRecord(
              record,
              expectedBoundary(policy, boundaryHash, root),
              dependencies.now(),
            )
            ? Object.freeze({ status: "confirmed" as const, boundaryHash })
            : Object.freeze({
                status: "needs_confirmation" as const,
                boundaryHash,
              });
        }) ??
        Object.freeze({ status: "recovery_required" as const, boundaryHash })
      );
    } catch {
      return Object.freeze({
        status: "recovery_required" as const,
        boundaryHash: null,
      });
    }
  }

  function persist(policy: ExternalSendPolicy) {
    try {
      const boundaryHash = compileExternalSendConsentBoundaryHash(policy);
      const root = dependencies.observeRoot(true);
      if (!boundaryHash || !root)
        return Object.freeze({ status: "recovery_required" as const });
      return (
        withConsentLock(dependencies, root, () => {
          if (!revokePair(root))
            return Object.freeze({ status: "recovery_required" as const });
          const record = recordFor(
            policy,
            boundaryHash,
            root,
            dependencies.now(),
            dependencies.nonce(),
          );
          if (!/^[a-f0-9]{16}$/u.test(record.generation))
            return Object.freeze({ status: "recovery_required" as const });
          const name = consentName(boundaryHash, record.generation);
          writeCommittedDockerRecoveryJson(root.rootPath, name, name, record);
          const rebound = dependencies.observeRoot(false);
          if (!rebound || !sameRoot(root, rebound))
            return Object.freeze({ status: "recovery_required" as const });
          const stored = readCommittedDockerRecoveryJson(
            consentPaths(root, name).file,
            name,
          );
          return validRecord(
            stored.value,
            expectedBoundary(policy, boundaryHash, root),
            dependencies.now(),
          )
            ? Object.freeze({ status: "confirmed" as const, boundaryHash })
            : Object.freeze({ status: "recovery_required" as const });
        }) ?? Object.freeze({ status: "recovery_required" as const })
      );
    } catch {
      return Object.freeze({ status: "recovery_required" as const });
    }
  }

  function revoke() {
    try {
      const root = dependencies.observeRoot(false);
      if (!root) return Object.freeze({ status: "revoked" as const });
      return (
        withConsentLock(dependencies, root, () =>
          revokePair(root)
            ? Object.freeze({ status: "revoked" as const })
            : Object.freeze({ status: "recovery_required" as const }),
        ) ?? Object.freeze({ status: "recovery_required" as const })
      );
    } catch {
      return Object.freeze({ status: "recovery_required" as const });
    }
  }

  return Object.freeze({ resolve, persist, revoke });
}

const productionRuntime = createRuntime(productionDependencies);

export const resolveRuntimeOwnedExternalSendConsent = productionRuntime.resolve;
export const persistRuntimeOwnedExternalSendConsent = productionRuntime.persist;
export const revokeRuntimeOwnedExternalSendConsent = productionRuntime.revoke;

export function createIsolatedExternalSendConsentRuntimeCandidate(
  dependencies: ConsentDependencies,
) {
  return createRuntime(dependencies);
}

export function describeExternalSendConsentRuntimeContract() {
  return Object.freeze({
    contract: EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT,
    contractRevision: EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT_REVISION,
    lifecycle:
      "one_active_initial_consent_boundary_reused_until_replaced_expired_or_revoked",
    binding: Object.freeze([
      "policy_id",
      "policy_source_file_hash",
      "selected_local_user",
      "protected_runtime_state_identity",
      "all_policy_provider_boundaries",
      "subscription_offering",
      "purpose_operations",
      "information_classification",
      "terms_policy_identity",
    ]),
    operationPreviewPersistent: false,
    lifetimeDays: 180,
    reapproval:
      "active_policy_boundary_change_expiry_revocation_missing_record_or_different_selected_user",
    corruptionRecovery:
      "exact_fixed_pair_safe_revoke_else_manual_recovery_required",
    exactProviderAccountOrTenantIdentityVerified: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
    callerSuppliedPathAccepted: false,
    rawPathReported: false,
  });
}
