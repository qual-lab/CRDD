import path from "node:path";
import { fileURLToPath } from "node:url";

import { revokeRuntimeOwnedExternalSendConsent } from "../src/security/external-send-consent-runtime.ts";
import {
  runSignedGeneralTaskVerification,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-route-matrix-verification";
export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION = 2;

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
  "same-codex",
  "same-claude",
]);

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
    result.remediationPerformed === false &&
    result.exactCandidateContentVerified === true &&
    result.candidateDiscarded === true &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
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
      completedRouteCount: 0,
      results: Object.freeze([]),
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      canonicalRepositoryChanged: false,
      rawProviderOutputReported: false,
      hostPathReported: false,
      credentialReported: false,
    });
  }
  const results: Array<Readonly<Record<string, unknown>>> = [];
  for (const [index, route] of ROUTES.entries()) {
    const result = await run(repositoryRoot, undefined, route);
    results.push(Object.freeze({ ...result }));
    if (
      !isExactSignedRouteResult(
        route,
        result,
        index === 0 ? "interactive_initial_consent" : "reused_initial_consent",
      )
    )
      break;
  }
  const completed = results.length === ROUTES.length;
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    status: completed ? ("completed" as const) : ("blocked" as const),
    reason: completed
      ? "signed_route_matrix_completed"
      : "signed_route_matrix_incomplete",
    requestedRoutes: ROUTES,
    completedRouteCount: results.filter(
      (result) => result.status === "completed",
    ).length,
    results: Object.freeze(results),
    cleanupConfirmed:
      completed && results.every((result) => result.cleanupConfirmed === true),
    manualRecoveryRequired: results.some(
      (result) => result.manualRecoveryRequired === true,
    ),
    canonicalRepositoryChanged: results.some(
      (result) => result.canonicalRepositoryChanged !== false,
    ),
    rawProviderOutputReported: results.some(
      (result) => result.rawProviderOutputReported !== false,
    ),
    hostPathReported: results.some(
      (result) => result.hostPathReported !== false,
    ),
    credentialReported: results.some(
      (result) => result.credentialReported !== false,
    ),
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
    canonicalRepositoryEffectAllowed: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
  });
}

async function main() {
  if (process.argv.length !== 2)
    throw new Error("signed_route_matrix_arguments_invalid");
  const result = await runSignedRouteMatrixVerification(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stdout.write(
      `${JSON.stringify(
        {
          contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
          contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
          status: "blocked",
          reason: "signed_route_matrix_failed_closed",
          cleanupConfirmed: false,
          manualRecoveryRequired: false,
          canonicalRepositoryChanged: false,
          rawProviderOutputReported: false,
          hostPathReported: false,
          credentialReported: false,
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
  });
}
