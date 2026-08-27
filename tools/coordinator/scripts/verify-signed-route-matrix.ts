import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import {
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../src/core/runtime-process-safety-state.ts";
import { revokeRuntimeOwnedExternalSendConsent } from "../src/security/external-send-consent-runtime.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import {
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/security/release-identity-grammar.ts";
import { evaluateSignedRunnerSafetyObservation } from "../src/security/signed-runner-safety-observation.ts";
import {
  runSignedGeneralTaskVerification,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-route-matrix-verification";
export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION = 4;

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
  "same-codex",
  "same-claude",
]);
const TARGET_PATH = "tools/coordinator/runtime/general-task-verification.txt";
const SHA256 = /^[a-f0-9]{64}$/u;
const ROUTE_SAFETY_SCHEMA = Object.freeze({
  booleanFields: Object.freeze([
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
    "effectStateUnknown",
    "canonicalRepositoryChanged",
    "rawProviderOutputReported",
    "hostPathReported",
    "credentialReported",
  ]),
  nullableRecoveryFields: Object.freeze([
    "hostRecoveryId",
    "dockerRecoveryId",
    "candidateRecoveryId",
    "candidateStoreRecoveryId",
  ]),
  pluralRecoveryFields: Object.freeze([
    "hostRecoveryIds",
    "dockerRecoveryIds",
    "candidateRecoveryIds",
    "candidateStoreRecoveryIds",
  ]),
  effectUnknownField: "effectStateUnknown",
});

const EXPECTED = Object.freeze({
  forward: Object.freeze({
    route: "front_codex__executor_claude__reviewer_codex",
    front: "codex",
    executor: "claude",
    reviewer: "codex",
  }),
  reverse: Object.freeze({
    route: "front_claude__executor_codex__reviewer_claude",
    front: "claude",
    executor: "codex",
    reviewer: "claude",
  }),
  "same-codex": Object.freeze({
    route: "front_codex__executor_codex__reviewer_claude",
    front: "codex",
    executor: "codex",
    reviewer: "claude",
  }),
  "same-claude": Object.freeze({
    route: "front_claude__executor_claude__reviewer_codex",
    front: "claude",
    executor: "claude",
    reviewer: "codex",
  }),
});

function emptyArray(value: unknown) {
  const snapshot = snapshotPlainArray(value, 0);
  return snapshot.status === "ok" && snapshot.value.length === 0;
}

function exactChangedPath(value: unknown) {
  const snapshot = snapshotPlainArray<unknown>(value, 1);
  return (
    snapshot.status === "ok" &&
    snapshot.value.length === 1 &&
    snapshot.value[0] === TARGET_PATH
  );
}

function snapshotRouteRecord(value: unknown) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function validReleaseIdentity(result: Readonly<Record<string, unknown>>) {
  return (
    typeof result.manifestHash === "string" &&
    SHA256.test(result.manifestHash) &&
    typeof result.packageContentRootSha256 === "string" &&
    SHA256.test(result.packageContentRootSha256) &&
    isCanonicalCrddVersion(result.crddVersion) &&
    Number.isSafeInteger(result.releaseSequence) &&
    Number(result.releaseSequence) >= 1 &&
    isSupportedCrddRuntimeGitObjectId(result.crddCommit) &&
    isSupportedCrddRuntimeGitObjectId(result.crddTree)
  );
}

function releaseIdentity(result: Readonly<Record<string, unknown>>) {
  return JSON.stringify([
    result.manifestHash,
    result.packageContentRootSha256,
    result.crddVersion,
    result.releaseSequence,
    result.crddCommit,
    result.crddTree,
  ]);
}

function ensureRuntimeProcessPoisoned() {
  poisonRuntimeProcessAfterCleanupUnknown();
  if (!isRuntimeProcessPoisoned())
    throw new Error("runtime_process_poison_transition_failed");
}

function failedRouteResult(route: SignedGeneralTaskRouteProfile) {
  return Object.freeze({
    status: "blocked" as const,
    reason: "signed_route_matrix_route_runner_failed_closed",
    requestedRouteProfile: route,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown: true,
    canonicalRepositoryChanged: null,
    rawProviderOutputReported: null,
    hostPathReported: null,
    credentialReported: null,
  });
}

function processRestartRequiredResult() {
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason: "signed_route_matrix_process_restart_required",
    requestedRoutes: ROUTES,
    attemptedRouteCount: 0,
    completedRouteCount: 0,
    failedRouteProfile: null,
    validationFailure: "process_restart_required" as const,
    results: Object.freeze([]),
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: true,
    effectStateUnknown: false,
    canonicalRepositoryChanged: false,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

export function isExactSignedRouteResult(
  route: SignedGeneralTaskRouteProfile,
  result: Readonly<Record<string, unknown>>,
  expectedAuthorizationMode:
    | "interactive_initial_consent"
    | "reused_initial_consent",
) {
  const expected = EXPECTED[route];
  return (
    result.contract === SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT &&
    result.contractRevision ===
      SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION &&
    result.status === "completed" &&
    result.reason === "signed_general_task_verification_completed" &&
    result.requestedRouteProfile === route &&
    result.route === expected.route &&
    result.requestedFrontProvider === expected.front &&
    result.observedFrontProvider === null &&
    result.frontIdentityVerified === false &&
    result.executorProvider === expected.executor &&
    result.reviewerProvider === expected.reviewer &&
    result.reviewerIndependence === "provider_independent" &&
    result.externalSendAuthorizationMode === expectedAuthorizationMode &&
    validReleaseIdentity(result) &&
    exactChangedPath(result.changedPaths) &&
    result.remediationPerformed === false &&
    result.exactCandidateContentVerified === true &&
    result.candidateDiscarded === true &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.processRestartRequired === false &&
    result.hostRecoveryId === null &&
    emptyArray(result.hostRecoveryIds) &&
    result.dockerRecoveryId === null &&
    emptyArray(result.dockerRecoveryIds) &&
    result.candidateRecoveryId === null &&
    emptyArray(result.candidateRecoveryIds) &&
    result.candidateStoreRecoveryId === null &&
    emptyArray(result.candidateStoreRecoveryIds) &&
    result.recoveryIdentityAmbiguous === false &&
    result.canonicalRepositoryChanged === false &&
    result.rawProviderOutputReported === false &&
    result.hostPathReported === false &&
    result.credentialReported === false
  );
}

export async function runSignedRouteMatrixVerification(
  repositoryRoot: string,
  run: typeof runSignedGeneralTaskVerification = runSignedGeneralTaskVerification,
  revoke: typeof revokeRuntimeOwnedExternalSendConsent = revokeRuntimeOwnedExternalSendConsent,
) {
  if (isRuntimeProcessPoisoned()) return processRestartRequiredResult();
  let revokeStatus: "revoked" | "recovery_required";
  try {
    const revoked = revoke();
    const descriptor = Object.getOwnPropertyDescriptor(revoked, "status");
    if (
      !descriptor ||
      !("value" in descriptor) ||
      (descriptor.value !== "revoked" &&
        descriptor.value !== "recovery_required")
    )
      throw new Error("consent_reset_result_invalid");
    revokeStatus = descriptor.value;
  } catch {
    ensureRuntimeProcessPoisoned();
    return createSignedRouteMatrixCliFailureResult("runner_exception");
  }
  if (revokeStatus !== "revoked") {
    return Object.freeze({
      contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
      contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
      status: "blocked" as const,
      reason: "signed_route_matrix_consent_reset_failed",
      requestedRoutes: ROUTES,
      attemptedRouteCount: 0,
      completedRouteCount: 0,
      failedRouteProfile: null,
      validationFailure: "consent_reset_failed" as const,
      results: Object.freeze([]),
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: isRuntimeProcessPoisoned(),
      effectStateUnknown: false,
      canonicalRepositoryChanged: false,
      rawProviderOutputReported: false,
      hostPathReported: false,
      credentialReported: false,
    });
  }
  const results: Array<Readonly<Record<string, unknown>>> = [];
  let verifiedRouteCount = 0;
  let baselineReleaseIdentity: string | null = null;
  let failedRouteProfile: SignedGeneralTaskRouteProfile | null = null;
  let validationFailure:
    | "route_nonconforming"
    | "release_identity_mismatch"
    | "runner_exception"
    | null = null;
  for (const [index, route] of ROUTES.entries()) {
    try {
      const outcome = await run(repositoryRoot, undefined, route);
      const result = snapshotRouteRecord(outcome);
      if (!result) throw new Error("route_result_snapshot_unknown");
      const safety = evaluateSignedRunnerSafetyObservation(
        result,
        ROUTE_SAFETY_SCHEMA,
      );
      if (safety.status !== "exact")
        throw new Error("route_safety_observation_unknown");
      if (result.processRestartRequired === true && !isRuntimeProcessPoisoned())
        ensureRuntimeProcessPoisoned();
      results.push(result);
      const exact = isExactSignedRouteResult(
        route,
        result,
        index === 0 ? "interactive_initial_consent" : "reused_initial_consent",
      );
      if (!exact) {
        failedRouteProfile = route;
        validationFailure = "route_nonconforming";
        break;
      }
      const currentReleaseIdentity = releaseIdentity(result);
      if (baselineReleaseIdentity === null)
        baselineReleaseIdentity = currentReleaseIdentity;
      else if (currentReleaseIdentity !== baselineReleaseIdentity) {
        failedRouteProfile = route;
        validationFailure = "release_identity_mismatch";
        break;
      }
      verifiedRouteCount += 1;
    } catch {
      ensureRuntimeProcessPoisoned();
      results.push(failedRouteResult(route));
      failedRouteProfile = route;
      validationFailure = "runner_exception";
      break;
    }
  }
  const completed = verifiedRouteCount === ROUTES.length;
  const effectStateUnknown = results.some(
    (result) => result.effectStateUnknown === true,
  );
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: completed ? ("completed" as const) : ("blocked" as const),
    reason: completed
      ? "signed_route_matrix_completed"
      : "signed_route_matrix_incomplete",
    requestedRoutes: ROUTES,
    attemptedRouteCount: results.length,
    completedRouteCount: verifiedRouteCount,
    failedRouteProfile,
    validationFailure,
    results: Object.freeze(results),
    cleanupConfirmed:
      completed && results.every((result) => result.cleanupConfirmed === true),
    manualRecoveryRequired:
      effectStateUnknown ||
      results.some((result) => result.manualRecoveryRequired !== false),
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown,
    canonicalRepositoryChanged: effectStateUnknown
      ? null
      : results.some((result) => result.canonicalRepositoryChanged !== false),
    rawProviderOutputReported: effectStateUnknown
      ? null
      : results.some((result) => result.rawProviderOutputReported !== false),
    hostPathReported: effectStateUnknown
      ? null
      : results.some((result) => result.hostPathReported !== false),
    credentialReported: effectStateUnknown
      ? null
      : results.some((result) => result.credentialReported !== false),
  });
}

export function describeSignedRouteMatrixVerificationContract() {
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    routes: ROUTES,
    order: "cross_provider_first_then_same_provider_exceptions",
    stop: "first_nonconforming_or_noncompleted_route",
    initialConsent:
      "explicit_revoke_then_first_interactive_confirmation_and_three_exact_reuses",
    frontIdentityClaim:
      "requested_profile_only_observed_front_identity_not_attested",
    candidateDisposition: "each_route_exact_verify_then_discard",
    releaseIdentity:
      "all_routes_same_manifest_package_version_sequence_commit_and_tree",
    failureClassification: Object.freeze([
      "consent_reset_failed",
      "arguments_invalid",
      "route_nonconforming",
      "release_identity_mismatch",
      "runner_exception",
      "process_restart_required",
    ]),
    unknownEffectProjection:
      "route_started_effect_or_restart_observation_unknown_irreversibly_poisons_shared_process_before_true_projection_without_claiming_observed_change_or_disclosure",
    canonicalRepositoryEffectAllowed: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
  });
}

export function createSignedRouteMatrixCliFailureResult(
  validationFailure: "arguments_invalid" | "runner_exception",
) {
  const effectStateUnknown = validationFailure === "runner_exception";
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason:
      validationFailure === "arguments_invalid"
        ? "signed_route_matrix_arguments_invalid"
        : "signed_route_matrix_failed_closed",
    requestedRoutes: ROUTES,
    attemptedRouteCount: 0,
    completedRouteCount: 0,
    failedRouteProfile: null,
    validationFailure,
    results: Object.freeze([]),
    cleanupConfirmed: !effectStateUnknown,
    manualRecoveryRequired: effectStateUnknown,
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown,
    canonicalRepositoryChanged: effectStateUnknown ? null : false,
    rawProviderOutputReported: effectStateUnknown ? null : false,
    hostPathReported: effectStateUnknown ? null : false,
    credentialReported: effectStateUnknown ? null : false,
  });
}

async function main() {
  if (process.argv.length !== 2) {
    process.stdout.write(
      `${JSON.stringify(createSignedRouteMatrixCliFailureResult("arguments_invalid"), null, 2)}\n`,
    );
    process.exitCode = 64;
    return;
  }
  const result = await runSignedRouteMatrixVerification(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    ensureRuntimeProcessPoisoned();
    process.stdout.write(
      `${JSON.stringify(createSignedRouteMatrixCliFailureResult("runner_exception"), null, 2)}\n`,
    );
    process.exitCode = 2;
  });
}
