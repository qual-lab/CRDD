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
import {
  externalSendConsentActiveRecordName,
  EXTERNAL_SEND_CONSENT_LIFETIME_MS,
  EXTERNAL_SEND_CONSENT_SCHEMA,
  EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
  isExternalSendConsentRecordShape,
  parseExternalSendConsentActiveEntryName,
} from "./external-send-consent-record.ts";

export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT =
  "crdd-coordinator/external-send-consent-runtime";
export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT_REVISION = 3;
export {
  EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX,
  EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
} from "./external-send-consent-record.ts";

const HEX64 = /^[a-f0-9]{64}$/u;

type VerifiedRoot = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedRuntimeStateRootCapability>
>;
type Lock = Readonly<{ release: () => boolean }>;
type ConsentDependencies = Readonly<{
  observeRoot: (shouldInitializeIfMissing: boolean) => VerifiedRoot | null;
  acquireLock: (bindingHash: string) => Lock | null;
  now: () => number;
  nonce: () => string;
}>;

export function compileExternalSendConsentBoundaryHash(
  policy: ExternalSendPolicy,
) {
  return HEX64.test(policy.sourceFileHash)
    ? createHash("sha256")
        .update("crdd-external-send-consent-boundary-v2\0")
        .update(policy.policyId)
        .update("\0")
        .update(policy.sourceFileHash)
        .update("\0")
        .update(EXTERNAL_SEND_RUNTIME_SEMANTICS_ID)
        .digest("hex")
    : null;
}

function productionObserveRoot(shouldInitializeIfMissing: boolean) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    shouldInitializeIfMissing,
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
    runtimeExternalSendSemanticsId: EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
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
    schema: EXTERNAL_SEND_CONSENT_SCHEMA,
    ...expectedBoundary(policy, boundaryHash, root),
    generation,
    confirmedAtEpochMs: now,
    expiresAtEpochMs: now + EXTERNAL_SEND_CONSENT_LIFETIME_MS,
  });
}

function validRecord(
  value: unknown,
  expected: ReturnType<typeof expectedBoundary>,
  now: number,
) {
  if (!isExternalSendConsentRecordShape(value)) return false;
  const record = value as Record<string, unknown>;
  const boundary = Object.fromEntries(
    Object.keys(expected).map((key) => [key, record[key]]),
  );
  return (
    JSON.stringify(boundary) === JSON.stringify(expected) &&
    typeof record.confirmedAtEpochMs === "number" &&
    Number.isSafeInteger(record.confirmedAtEpochMs) &&
    typeof record.expiresAtEpochMs === "number" &&
    Number.isSafeInteger(record.expiresAtEpochMs) &&
    record.confirmedAtEpochMs <= now &&
    record.expiresAtEpochMs > now
  );
}

function consentName(boundaryHash: string, generation: string) {
  const name = externalSendConsentActiveRecordName(boundaryHash, generation);
  if (!name) throw new Error("external_send_consent_identity_invalid");
  return name;
}

function consentPaths(root: VerifiedRoot, name: string) {
  const file = path.join(root.rootPath, name);
  return Object.freeze({
    file,
    commit: path.join(root.rootPath, dockerRecoveryCommitName(name)),
  });
}

function exactRegularFileOrMissing(file: string) {
  try {
    const stat = fs.lstatSync(file);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    );
  }
}

function pathMissing(file: string) {
  try {
    fs.lstatSync(file);
    return false;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return true;
    throw error;
  }
}

// Removing this one fixed pair only reduces authority. Commit is removed
// first so a crash cannot leave an old record authoritative.
function activeNames(root: VerifiedRoot) {
  const names = new Set<string>();
  for (const entry of fs.readdirSync(root.rootPath)) {
    const parsed = parseExternalSendConsentActiveEntryName(entry);
    if (parsed) names.add(parsed.recordName);
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
  if (!pathMissing(target.file) && !pathMissing(target.commit)) {
    try {
      removeCommittedDockerRecoveryJson(target.file, name);
      return pathMissing(target.file) && pathMissing(target.commit);
    } catch {
      // Invalid fixed-pair data is not authority. Fall through to bounded
      // authority-reducing deletion after exact file-type checks above.
    }
  }
  if (!pathMissing(target.commit)) fs.rmSync(target.commit);
  if (!pathMissing(target.file)) fs.rmSync(target.file);
  return pathMissing(target.file) && pathMissing(target.commit);
}

function withConsentLock<T>(
  dependencies: ConsentDependencies,
  root: VerifiedRoot,
  operation: () => T,
) {
  const lock = dependencies.acquireLock(root.stableLogicalHomeBindingHash);
  if (!lock) return null;
  let result: T | null = null;
  let hasFailed = false;
  try {
    const rebound = dependencies.observeRoot(false);
    if (!rebound || !sameRoot(root, rebound)) hasFailed = true;
    else result = operation();
  } catch {
    hasFailed = true;
  }
  let released = false;
  try {
    released = lock.release();
  } catch {
    released = false;
  }
  return hasFailed || !released ? null : result;
}

function createRuntime(dependencies: ConsentDependencies) {
  function resolve(policy: ExternalSendPolicy) {
    try {
      const boundaryHash = compileExternalSendConsentBoundaryHash(policy);
      if (!boundaryHash)
        return Object.freeze({
          status: "recovery_required" as const,
          boundaryHash,
        });
      // A verified empty RuntimeState root is distinguishable from an
      // unavailable root. Initializing the fixed protected root here avoids
      // treating observation failure as consent absence.
      const root = dependencies.observeRoot(true);
      if (!root)
        return Object.freeze({
          status: "recovery_required" as const,
          boundaryHash,
        });
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
          const filePresent = !pathMissing(target.file);
          const commitPresent = !pathMissing(target.commit);
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
          const currentIdentity =
            parseExternalSendConsentActiveEntryName(currentName);
          if (currentIdentity?.boundaryHash !== boundaryHash)
            return revokePair(root)
              ? Object.freeze({
                  status: "needs_confirmation" as const,
                  boundaryHash,
                })
              : Object.freeze({
                  status: "recovery_required" as const,
                  boundaryHash,
                });
          const isCurrent =
            currentIdentity?.generation ===
              (record as Record<string, unknown>).generation &&
            validRecord(
              record,
              expectedBoundary(policy, boundaryHash, root),
              dependencies.now(),
            );
          if (isCurrent)
            return Object.freeze({
              status: "confirmed" as const,
              boundaryHash,
            });
          return revokePair(root)
            ? Object.freeze({
                status: "needs_confirmation" as const,
                boundaryHash,
              })
            : Object.freeze({
                status: "recovery_required" as const,
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
      // Explicit revoke may create the fixed protected RuntimeState root, but
      // it never treats an unobservable root as proof of residue zero.
      const root = dependencies.observeRoot(true);
      if (!root) return Object.freeze({ status: "recovery_required" as const });
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
      "runtime_external_send_semantics_id",
      "selected_local_user",
      "protected_runtime_state_identity",
      "all_policy_provider_boundaries",
      "subscription_offering",
      "purpose_operations",
      "information_classification",
      "terms_policy_identity",
    ]),
    runtimeExternalSendSemanticsId: EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
    operationPreviewPersistent: false,
    lifetimeDays: 180,
    reapproval:
      "active_policy_boundary_change_expiry_revocation_missing_record_different_selected_user_or_runtime_state_binding_change",
    invalidation:
      "once_observed_invalid_active_generation_is_revoked_and_never_reused",
    explicitRevokeRootObservation:
      "verified_protected_root_initialization_allowed_unavailable_never_means_revoked",
    corruptionRecovery:
      "exact_fixed_pair_safe_revoke_else_manual_recovery_required",
    exactProviderAccountOrTenantIdentityVerified: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
    callerSuppliedPathAccepted: false,
    rawPathReported: false,
  });
}
