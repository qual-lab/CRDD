import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import {
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../src/core/runtime-process-safety-state.ts";
import {
  displayVerificationRecording,
  runRecordedVerification,
} from "../src/core/verification-result-record.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import {
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/security/release-identity-grammar.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../src/security/repository-root-resolution.ts";
import {
  evaluateSignedRunnerSafetyObservation,
  salvageSignedRunnerRecoveryPair,
} from "../src/security/signed-runner-safety-observation.ts";
import {
  runSignedGeneralTaskVerification,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-route-matrix-verification";
export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION = 12;

const MAX_SAFE_ROUTE_ATTEMPTS = 3;
const SAFE_RETRYABLE_ROUTE_REASONS = new Set([
  "coordinator_task_independent_review_not_approved",
  "signed_general_task_candidate_content_mismatch",
]);

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
  "same-codex",
  "same-claude",
]);
const TARGET_PATH =
  "40_Develop/coordinator/runtime/general-task-verification.txt";
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
  nullableRecoveryFields: Object.freeze([]),
  recoveryPairs: Object.freeze([
    Object.freeze({
      singularField: "hostRecoveryId",
      pluralField: "hostRecoveryIds",
      kind: "host" as const,
    }),
    Object.freeze({
      singularField: "dockerRecoveryId",
      pluralField: "dockerRecoveryIds",
      kind: "docker" as const,
    }),
    Object.freeze({
      singularField: "candidateRecoveryId",
      pluralField: "candidateRecoveryIds",
      kind: "candidate" as const,
    }),
    Object.freeze({
      singularField: "candidateStoreRecoveryId",
      pluralField: "candidateStoreRecoveryIds",
      kind: "candidate_store" as const,
    }),
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
    typeof result.runtimeExecutionIdentitySha256 === "string" &&
    SHA256.test(result.runtimeExecutionIdentitySha256) &&
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
    result.runtimeExecutionIdentitySha256,
    result.crddVersion,
    result.releaseSequence,
    result.crddCommit,
    result.crddTree,
  ]);
}

function validExecutionIdentity(result: Readonly<Record<string, unknown>>) {
  return (
    isSupportedCrddRuntimeGitObjectId(result.executionCommit) &&
    isSupportedCrddRuntimeGitObjectId(result.executionTree)
  );
}

function executionIdentity(result: Readonly<Record<string, unknown>>) {
  return JSON.stringify([result.executionCommit, result.executionTree]);
}

function ensureRuntimeProcessPoisoned() {
  poisonRuntimeProcessAfterCleanupUnknown();
  if (!isRuntimeProcessPoisoned())
    throw new Error("runtime_process_poison_transition_failed");
}

const RECOVERY_PAIRS = Object.freeze([
  Object.freeze({
    singular: "hostRecoveryId",
    plural: "hostRecoveryIds",
    kind: "host" as const,
  }),
  Object.freeze({
    singular: "dockerRecoveryId",
    plural: "dockerRecoveryIds",
    kind: "docker" as const,
  }),
  Object.freeze({
    singular: "candidateRecoveryId",
    plural: "candidateRecoveryIds",
    kind: "candidate" as const,
  }),
  Object.freeze({
    singular: "candidateStoreRecoveryId",
    plural: "candidateStoreRecoveryIds",
    kind: "candidate_store" as const,
  }),
]);

function sanitizedRouteRecovery(
  result: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const projection: Record<string, unknown> = Object.create(null);
  let isAmbiguous = false;
  for (const pair of RECOVERY_PAIRS) {
    const recovered = salvageSignedRunnerRecoveryPair(result, {
      singularField: pair.singular,
      pluralField: pair.plural,
      kind: pair.kind,
    });
    projection[pair.singular] = recovered.singular;
    projection[pair.plural] = recovered.plural;
    if (recovered.ambiguous) isAmbiguous = true;
  }
  return Object.freeze({
    ...projection,
    recoveryIdentityAmbiguous: isAmbiguous,
  });
}

function emptyRouteRecovery(isAmbiguous = false) {
  return Object.freeze({
    hostRecoveryId: null,
    hostRecoveryIds: Object.freeze([]),
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateRecoveryIds: Object.freeze([]),
    candidateStoreRecoveryId: null,
    candidateStoreRecoveryIds: Object.freeze([]),
    recoveryIdentityAmbiguous: isAmbiguous,
  });
}

function failedRouteResult(
  route: SignedGeneralTaskRouteProfile,
  observed: Readonly<Record<string, unknown>> | null = null,
) {
  const recovery = observed
    ? sanitizedRouteRecovery(observed)
    : emptyRouteRecovery(true);
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
    ...recovery,
  });
}

function aggregateRouteRecovery(
  results: readonly Readonly<Record<string, unknown>>[],
) {
  const aggregate: Record<string, unknown> = Object.create(null);
  let isAmbiguous = results.some(
    (result) => result.recoveryIdentityAmbiguous === true,
  );
  for (const pair of RECOVERY_PAIRS) {
    const ids: string[] = [];
    for (const result of results) {
      const recovery = sanitizedRouteRecovery(result);
      const values = recovery[pair.plural];
      if (Array.isArray(values)) ids.push(...(values as readonly string[]));
      if (recovery.recoveryIdentityAmbiguous === true) isAmbiguous = true;
    }
    const allUniqueItems = [...new Set(ids)];
    if (allUniqueItems.length > 128) isAmbiguous = true;
    const uniqueItems = Object.freeze(allUniqueItems.slice(0, 128));
    aggregate[pair.singular] = uniqueItems.length === 1 ? uniqueItems[0] : null;
    aggregate[pair.plural] = uniqueItems;
  }
  return Object.freeze({
    ...aggregate,
    recoveryIdentityAmbiguous: isAmbiguous,
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
    retryableRouteAttemptCount: 0,
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
    ...emptyRouteRecovery(false),
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
    validExecutionIdentity(result) &&
    exactChangedPath(result.changedPaths) &&
    typeof result.remediationPerformed === "boolean" &&
    result.exactCandidateContentVerified === true &&
    result.candidateDiscarded === true &&
    result.candidateDisposition === "discarded" &&
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

function isSafeRetryableRouteResult(result: Readonly<Record<string, unknown>>) {
  return (
    result.status === "blocked" &&
    typeof result.reason === "string" &&
    SAFE_RETRYABLE_ROUTE_REASONS.has(result.reason) &&
    (result.externalSendAuthorizationMode === "interactive_initial_consent" ||
      result.externalSendAuthorizationMode === "reused_initial_consent") &&
    ((result.candidateDisposition === "discarded" &&
      result.candidateDiscarded === true) ||
      (result.candidateDisposition === "not_issued" &&
        result.candidateDiscarded === false)) &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.processRestartRequired === false &&
    result.effectStateUnknown === false &&
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
  routeRun: typeof runSignedGeneralTaskVerification = runSignedGeneralTaskVerification,
) {
  if (isRuntimeProcessPoisoned()) return processRestartRequiredResult();
  const results: Array<Readonly<Record<string, unknown>>> = [];
  let verifiedRouteCount = 0;
  let retryableRouteAttemptCount = 0;
  let baselineReleaseIdentity: string | null = null;
  let baselineExecutionIdentity: string | null = null;
  let initialConsentAuthorizationMode:
    | "interactive_initial_consent"
    | "reused_initial_consent"
    | null = null;
  let failedRouteProfile: SignedGeneralTaskRouteProfile | null = null;
  let validationFailure:
    | "route_nonconforming"
    | "release_identity_mismatch"
    | "execution_identity_mismatch"
    | "runner_exception"
    | null = null;
  routeLoop: for (const [index, route] of ROUTES.entries()) {
    for (let attempt = 1; attempt <= MAX_SAFE_ROUTE_ATTEMPTS; attempt += 1) {
      let routeSnapshot: Readonly<Record<string, unknown>> | null = null;
      try {
        const outcome = await routeRun(repositoryRoot, undefined, route);
        const result = snapshotRouteRecord(outcome);
        if (!result) throw new Error("route_result_snapshot_unknown");
        routeSnapshot = result;
        const safety = evaluateSignedRunnerSafetyObservation(
          result,
          ROUTE_SAFETY_SCHEMA,
        );
        if (safety.status !== "exact")
          throw new Error("route_safety_observation_unknown");
        if (
          result.processRestartRequired === true &&
          !isRuntimeProcessPoisoned()
        )
          ensureRuntimeProcessPoisoned();
        results.push(result);
        const observedAuthorizationMode = result.externalSendAuthorizationMode;
        if (
          index === 0 &&
          initialConsentAuthorizationMode === null &&
          (observedAuthorizationMode === "interactive_initial_consent" ||
            observedAuthorizationMode === "reused_initial_consent")
        )
          initialConsentAuthorizationMode = observedAuthorizationMode;
        const expectedAuthorizationMode =
          index === 0 && attempt === 1 && initialConsentAuthorizationMode
            ? initialConsentAuthorizationMode
            : "reused_initial_consent";
        if (!validReleaseIdentity(result) || !validExecutionIdentity(result)) {
          failedRouteProfile = route;
          validationFailure = "route_nonconforming";
          break routeLoop;
        }
        const currentReleaseIdentity = releaseIdentity(result);
        if (baselineReleaseIdentity === null)
          baselineReleaseIdentity = currentReleaseIdentity;
        else if (currentReleaseIdentity !== baselineReleaseIdentity) {
          failedRouteProfile = route;
          validationFailure = "release_identity_mismatch";
          break routeLoop;
        }
        const currentExecutionIdentity = executionIdentity(result);
        if (baselineExecutionIdentity === null)
          baselineExecutionIdentity = currentExecutionIdentity;
        else if (currentExecutionIdentity !== baselineExecutionIdentity) {
          failedRouteProfile = route;
          validationFailure = "execution_identity_mismatch";
          break routeLoop;
        }
        const isExact = isExactSignedRouteResult(
          route,
          result,
          expectedAuthorizationMode,
        );
        if (!isExact) {
          if (
            attempt < MAX_SAFE_ROUTE_ATTEMPTS &&
            isSafeRetryableRouteResult(result)
          ) {
            retryableRouteAttemptCount += 1;
            continue;
          }
          failedRouteProfile = route;
          validationFailure = "route_nonconforming";
          break routeLoop;
        }
        verifiedRouteCount += 1;
        continue routeLoop;
      } catch {
        ensureRuntimeProcessPoisoned();
        results.push(failedRouteResult(route, routeSnapshot));
        failedRouteProfile = route;
        validationFailure = "runner_exception";
        break routeLoop;
      }
    }
  }
  const isCompleted = verifiedRouteCount === ROUTES.length;
  const isEffectStateUnknown = results.some(
    (result) => result.effectStateUnknown === true,
  );
  const recovery = aggregateRouteRecovery(results);
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: isCompleted ? ("completed" as const) : ("blocked" as const),
    reason: isCompleted
      ? "signed_route_matrix_completed"
      : "signed_route_matrix_incomplete",
    requestedRoutes: ROUTES,
    attemptedRouteCount: results.length,
    completedRouteCount: verifiedRouteCount,
    retryableRouteAttemptCount,
    initialConsentAuthorizationMode,
    failedRouteProfile,
    validationFailure,
    results: Object.freeze(results),
    cleanupConfirmed:
      results.length > 0 &&
      results.every((result) => result.cleanupConfirmed === true),
    manualRecoveryRequired:
      isEffectStateUnknown ||
      results.some((result) => result.manualRecoveryRequired !== false),
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown: isEffectStateUnknown,
    canonicalRepositoryChanged: isEffectStateUnknown
      ? null
      : results.some((result) => result.canonicalRepositoryChanged !== false),
    rawProviderOutputReported: isEffectStateUnknown
      ? null
      : results.some((result) => result.rawProviderOutputReported !== false),
    hostPathReported: isEffectStateUnknown
      ? null
      : results.some((result) => result.hostPathReported !== false),
    credentialReported: isEffectStateUnknown
      ? null
      : results.some((result) => result.credentialReported !== false),
    ...recovery,
  });
}

export function describeSignedRouteMatrixVerificationContract() {
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    routes: ROUTES,
    order: "cross_provider_first_then_same_provider_exceptions",
    stop: "first_nonretryable_nonconforming_route_or_third_safe_nonconforming_attempt",
    safeRetry:
      "maximum_three_attempts_per_route_only_after_exact_candidate_not_issued_or_discarded_and_exact_zero_residual_effect_for_closed_business_nonconformance_reasons",
    initialConsent:
      "preserve_valid_consent_prompt_only_when_absent_then_require_exact_reuse",
    frontIdentityClaim:
      "requested_profile_only_observed_front_identity_not_attested",
    candidateDisposition: "each_route_exact_verify_then_discard",
    verificationFixture:
      "same_signed_tracked_base_marker_exact_token_replacement_for_every_route",
    boundedRemediation:
      "each_route_accepts_zero_or_one_runtime_owned_remediation_only_after_final_independent_approval",
    releaseIdentity:
      "all_attempts_same_manifest_package_version_sequence_commit_and_tree",
    executionIdentity:
      "all_attempts_same_work_repository_execution_commit_and_tree",
    failureClassification: Object.freeze([
      "arguments_invalid",
      "route_nonconforming",
      "release_identity_mismatch",
      "execution_identity_mismatch",
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
  const isEffectStateUnknown = validationFailure === "runner_exception";
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
    retryableRouteAttemptCount: 0,
    failedRouteProfile: null,
    validationFailure,
    results: Object.freeze([]),
    cleanupConfirmed: !isEffectStateUnknown,
    manualRecoveryRequired: isEffectStateUnknown,
    processRestartRequired: isRuntimeProcessPoisoned(),
    effectStateUnknown: isEffectStateUnknown,
    canonicalRepositoryChanged: isEffectStateUnknown ? null : false,
    rawProviderOutputReported: isEffectStateUnknown ? null : false,
    hostPathReported: isEffectStateUnknown ? null : false,
    credentialReported: isEffectStateUnknown ? null : false,
    ...emptyRouteRecovery(isEffectStateUnknown),
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
  const outcome = await runRecordedVerification(
    "routes",
    process.cwd(),
    () =>
      runSignedRouteMatrixVerification(
        resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
      ),
    () => {
      ensureRuntimeProcessPoisoned();
      return createSignedRouteMatrixCliFailureResult("runner_exception");
    },
  );
  displayVerificationRecording(outcome);
  if (outcome.result !== null)
    process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
  process.exitCode = outcome.exitCode;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch {
    ensureRuntimeProcessPoisoned();
    process.stdout.write(
      `${JSON.stringify(createSignedRouteMatrixCliFailureResult("runner_exception"), null, 2)}\n`,
    );
    process.exitCode = 2;
  }
}
