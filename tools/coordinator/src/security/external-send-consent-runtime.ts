import { createHash } from "node:crypto";
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
  writeCommittedDockerRecoveryJson,
} from "./docker-recovery-journal.ts";
import type { ExternalSendPolicy } from "./external-send-policy-runtime.ts";

export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT =
  "crdd-coordinator/external-send-consent-runtime";
export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT_REVISION = 1;

const HEX64 = /^[a-f0-9]{64}$/u;
const CONSENT_SCHEMA = "crdd-coordinator/external-send-consent/v1";

type VerifiedRoot = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedRuntimeStateRootCapability>
>;

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
        .update("crdd-external-send-consent-boundary-v1\0")
        .update(policy.policyId)
        .update("\0")
        .update(policy.sourceFileHash)
        .digest("hex")
    : null;
}

function consentName(boundaryHash: string) {
  return `external-send-consent-v1-${boundaryHash}.json`;
}

function observeRoot(initializeIfMissing: boolean) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    initializeIfMissing,
    new Date().toISOString(),
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  return observation.status === "candidate" && root ? root : null;
}

function sameRoot(left: VerifiedRoot, right: VerifiedRoot) {
  return (
    left.rootPath === right.rootPath &&
    left.runtimeStateIdentityHash === right.runtimeStateIdentityHash &&
    left.runtimeStateProtectionHash === right.runtimeStateProtectionHash &&
    left.localUserBindingHash === right.localUserBindingHash &&
    left.stableLogicalHomeBindingHash === right.stableLogicalHomeBindingHash
  );
}

function expectedRecord(
  policy: ExternalSendPolicy,
  boundaryHash: string,
  root: VerifiedRoot,
) {
  return Object.freeze({
    schema: CONSENT_SCHEMA,
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

function sameRecord(
  value: unknown,
  expected: ReturnType<typeof expectedRecord>,
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
    ])
  )
    return false;
  return JSON.stringify(value) === JSON.stringify(expected);
}

function withConsentLock<T>(root: VerifiedRoot, operation: () => T) {
  const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
    root.stableLogicalHomeBindingHash,
  );
  if (!lock) return null;
  let result: T | null = null;
  let failed = false;
  try {
    const rebound = observeRoot(false);
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

export function resolveRuntimeOwnedExternalSendConsent(
  policy: ExternalSendPolicy,
) {
  try {
    const boundaryHash = compileExternalSendConsentBoundaryHash(policy);
    const root = observeRoot(false);
    if (!boundaryHash || !root)
      return Object.freeze({ status: "absent" as const, boundaryHash });
    return (
      withConsentLock(root, () => {
        const file = path.join(root.rootPath, consentName(boundaryHash));
        const commit = path.join(
          root.rootPath,
          dockerRecoveryCommitName(consentName(boundaryHash)),
        );
        if (!fs.existsSync(file) && !fs.existsSync(commit))
          return Object.freeze({ status: "absent" as const, boundaryHash });
        if (!fs.existsSync(file) || !fs.existsSync(commit))
          return Object.freeze({
            status: "cleanup_unknown" as const,
            boundaryHash,
          });
        const record = readCommittedDockerRecoveryJson(
          file,
          consentName(boundaryHash),
        );
        return sameRecord(
          record.value,
          expectedRecord(policy, boundaryHash, root),
        )
          ? Object.freeze({ status: "confirmed" as const, boundaryHash })
          : Object.freeze({
              status: "cleanup_unknown" as const,
              boundaryHash,
            });
      }) ?? Object.freeze({ status: "cleanup_unknown" as const, boundaryHash })
    );
  } catch {
    return Object.freeze({
      status: "cleanup_unknown" as const,
      boundaryHash: null,
    });
  }
}

export function persistRuntimeOwnedExternalSendConsent(
  policy: ExternalSendPolicy,
) {
  try {
    const boundaryHash = compileExternalSendConsentBoundaryHash(policy);
    const root = observeRoot(true);
    if (!boundaryHash || !root)
      return Object.freeze({ status: "cleanup_unknown" as const });
    return (
      withConsentLock(root, () => {
        const name = consentName(boundaryHash);
        const file = path.join(root.rootPath, name);
        const commit = path.join(root.rootPath, dockerRecoveryCommitName(name));
        const expected = expectedRecord(policy, boundaryHash, root);
        if (fs.existsSync(file) || fs.existsSync(commit)) {
          if (!fs.existsSync(file) || !fs.existsSync(commit))
            return Object.freeze({ status: "cleanup_unknown" as const });
          const current = readCommittedDockerRecoveryJson(file, name);
          return sameRecord(current.value, expected)
            ? Object.freeze({ status: "confirmed" as const, boundaryHash })
            : Object.freeze({ status: "cleanup_unknown" as const });
        }
        writeCommittedDockerRecoveryJson(root.rootPath, name, name, expected);
        const rebound = observeRoot(false);
        if (!rebound || !sameRoot(root, rebound))
          return Object.freeze({ status: "cleanup_unknown" as const });
        const stored = readCommittedDockerRecoveryJson(file, name);
        return sameRecord(stored.value, expected)
          ? Object.freeze({ status: "confirmed" as const, boundaryHash })
          : Object.freeze({ status: "cleanup_unknown" as const });
      }) ?? Object.freeze({ status: "cleanup_unknown" as const })
    );
  } catch {
    return Object.freeze({ status: "cleanup_unknown" as const });
  }
}

export function describeExternalSendConsentRuntimeContract() {
  return Object.freeze({
    contract: EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT,
    contractRevision: EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT_REVISION,
    lifecycle:
      "first_interactive_confirmation_then_runtime_owned_reuse_for_exact_unchanged_boundary",
    binding: Object.freeze([
      "policy_id",
      "policy_source_file_hash",
      "selected_local_user",
      "protected_runtime_state_identity",
      "provider_boundary",
      "subscription_offering",
      "purpose_operations",
      "information_classification",
      "terms_policy_identity",
    ]),
    reapproval:
      "policy_boundary_change_or_missing_record_or_different_selected_user",
    exactProviderAccountOrTenantIdentityVerified: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
    callerSuppliedPathAccepted: false,
    rawPathReported: false,
  });
}
