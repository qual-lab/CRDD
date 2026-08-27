import path from "node:path";
import { fileURLToPath } from "node:url";

import { revokeRuntimeOwnedExternalSendConsent } from "../src/security/external-send-consent-runtime.ts";
import {
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/security/release-identity-grammar.ts";
import {
  runSignedGeneralTaskVerification,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-route-matrix-verification";
export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION = 3;

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
  "same-codex",
  "same-claude",
]);
const TARGET_PATH = "tools/coordinator/runtime/general-task-verification.txt";
const SHA256 = /^[a-f0-9]{64}$/u;

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
  return Array.isArray(value) && value.length === 0;
}

function exactChangedPath(value: unknown) {
  return Array.isArray(value) && value.length === 1 && value[0] === TARGET_PATH;
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

function failedRouteResult(route: SignedGeneralTaskRouteProfile) {
  return Object.freeze({
    status: "blocked" as const,
    reason: "signed_route_matrix_route_runner_failed_closed",
    requestedRouteProfile: route,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    effectStateUnknown: true,
    canonicalRepositoryChanged: null,
    rawProviderOutputReported: null,
    hostPathReported: null,
    credentialReported: null,
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
  const revoked = revoke();
  if (revoked.status !== "revoked") {
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
      processRestartRequired: false,
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
    let result: Readonly<Record<string, unknown>>;
    let runnerFailed = false;
    try {
      const outcome = await run(repositoryRoot, undefined, route);
      result = Object.freeze({ ...outcome });
    } catch {
      result = failedRouteResult(route);
      runnerFailed = true;
    }
    results.push(result);
    const exact = isExactSignedRouteResult(
      route,
      result,
      index === 0 ? "interactive_initial_consent" : "reused_initial_consent",
    );
    if (!exact) {
      failedRouteProfile = route;
      validationFailure = runnerFailed
        ? "runner_exception"
        : "route_nonconforming";
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
  }
  const completed = verifiedRouteCount === ROUTES.length;
  const effectStateUnknown = results.some(
    (result) =>
      result.effectStateUnknown === true ||
      typeof result.processRestartRequired !== "boolean" ||
      typeof result.canonicalRepositoryChanged !== "boolean" ||
      typeof result.rawProviderOutputReported !== "boolean" ||
      typeof result.hostPathReported !== "boolean" ||
      typeof result.credentialReported !== "boolean",
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
    processRestartRequired:
      effectStateUnknown ||
      results.some((result) => result.processRestartRequired === true),
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
    ]),
    unknownEffectProjection:
      "explicit_effect_state_unknown_without_claiming_observed_change_or_disclosure",
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
    processRestartRequired: effectStateUnknown,
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
    process.stdout.write(
      `${JSON.stringify(createSignedRouteMatrixCliFailureResult("runner_exception"), null, 2)}\n`,
    );
    process.exitCode = 2;
  });
}
