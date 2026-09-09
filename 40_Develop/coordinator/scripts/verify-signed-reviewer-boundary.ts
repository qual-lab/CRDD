import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../src/core/runtime-process-safety-state.ts";
import {
  displayVerificationRecording,
  runRecordedVerification,
} from "../src/core/verification-result-record.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../src/security/repository-root-resolution.ts";
import {
  runSignedGeneralTaskVerification,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-reviewer-boundary-verification";
export const SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION = 1;

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
]);
type RuntimeRecord = Readonly<Record<string, unknown>>;

function emptyStringArray(value: unknown) {
  const items = snapshotPlainArray<unknown>(value, 0);
  return items.status === "ok" && items.value.length === 0;
}

function exactCompletedRoute(result: RuntimeRecord, route: string) {
  return (
    result.contract === SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT &&
    result.contractRevision ===
      SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION &&
    result.status === "completed" &&
    result.reason === "signed_general_task_verification_completed" &&
    result.requestedRouteProfile === route &&
    result.exactCandidateContentVerified === true &&
    result.candidateDiscarded === true &&
    result.cleanupConfirmed === true &&
    result.manualRecoveryRequired === false &&
    result.processRestartRequired === false &&
    result.effectStateUnknown === false &&
    result.canonicalRepositoryChanged === false &&
    result.rawProviderOutputReported === false &&
    result.hostPathReported === false &&
    result.credentialReported === false &&
    result.hostRecoveryId === null &&
    emptyStringArray(result.hostRecoveryIds) &&
    result.dockerRecoveryId === null &&
    emptyStringArray(result.dockerRecoveryIds) &&
    result.candidateRecoveryId === null &&
    emptyStringArray(result.candidateRecoveryIds) &&
    result.candidateStoreRecoveryId === null &&
    emptyStringArray(result.candidateStoreRecoveryIds)
  );
}

function blockedResult(
  results: readonly RuntimeRecord[],
  failedRouteProfile: SignedGeneralTaskRouteProfile | null,
  effectStateUnknown = false,
) {
  const last = results.at(-1);
  const unknown =
    effectStateUnknown ||
    (last !== undefined && last.effectStateUnknown !== false);
  return Object.freeze({
    contract: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason: "signed_reviewer_boundary_integration_incomplete",
    requestedRoutes: ROUTES,
    attemptedRouteCount: results.length,
    completedRouteCount: Math.max(
      0,
      results.length - (failedRouteProfile ? 1 : 0),
    ),
    failedRouteProfile,
    results: Object.freeze([...results]),
    cleanupConfirmed: !unknown && last?.cleanupConfirmed === true,
    manualRecoveryRequired: unknown || last?.manualRecoveryRequired !== false,
    processRestartRequired:
      isRuntimeProcessPoisoned() || last?.processRestartRequired === true,
    effectStateUnknown: unknown,
    canonicalRepositoryChanged: unknown
      ? null
      : last?.canonicalRepositoryChanged === true,
    rawProviderOutputReported: unknown ? null : false,
    hostPathReported: unknown ? null : false,
    credentialReported: unknown ? null : false,
    hostRecoveryId: unknown ? null : (last?.hostRecoveryId ?? null),
    hostRecoveryIds: unknown
      ? Object.freeze([])
      : (last?.hostRecoveryIds ?? Object.freeze([])),
    dockerRecoveryId: unknown ? null : (last?.dockerRecoveryId ?? null),
    dockerRecoveryIds: unknown
      ? Object.freeze([])
      : (last?.dockerRecoveryIds ?? Object.freeze([])),
    candidateRecoveryId: unknown ? null : (last?.candidateRecoveryId ?? null),
    candidateRecoveryIds: unknown
      ? Object.freeze([])
      : (last?.candidateRecoveryIds ?? Object.freeze([])),
    candidateStoreRecoveryId: unknown
      ? null
      : (last?.candidateStoreRecoveryId ?? null),
    candidateStoreRecoveryIds: unknown
      ? Object.freeze([])
      : (last?.candidateStoreRecoveryIds ?? Object.freeze([])),
    recoveryIdentityAmbiguous: unknown,
  });
}

export async function runSignedReviewerBoundaryVerification(
  repositoryRoot: string,
  routeRun: typeof runSignedGeneralTaskVerification = runSignedGeneralTaskVerification,
) {
  if (isRuntimeProcessPoisoned()) return blockedResult([], null, true);
  const results: RuntimeRecord[] = [];
  for (const route of ROUTES) {
    try {
      const result = (await routeRun(
        repositoryRoot,
        undefined,
        route,
      )) as RuntimeRecord;
      results.push(result);
      if (!exactCompletedRoute(result, route))
        return blockedResult(results, route);
    } catch {
      poisonRuntimeProcessAfterCleanupUnknown();
      return blockedResult(results, route, true);
    }
  }
  return Object.freeze({
    contract: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION,
    status: "completed" as const,
    reason: "signed_reviewer_boundary_integration_completed",
    requestedRoutes: ROUTES,
    attemptedRouteCount: ROUTES.length,
    completedRouteCount: ROUTES.length,
    failedRouteProfile: null,
    results: Object.freeze(results),
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    effectStateUnknown: false,
    canonicalRepositoryChanged: false,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
    hostRecoveryId: null,
    hostRecoveryIds: Object.freeze([]),
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateRecoveryIds: Object.freeze([]),
    candidateStoreRecoveryId: null,
    candidateStoreRecoveryIds: Object.freeze([]),
    recoveryIdentityAmbiguous: false,
  });
}

export function describeSignedReviewerBoundaryVerificationContract() {
  return Object.freeze({
    contract: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_REVIEWER_BOUNDARY_VERIFICATION_CONTRACT_REVISION,
    routes: ROUTES,
    purpose:
      "verify_real_codex_and_claude_reviewer_projection_decision_settlement_and_cleanup_before_four_route_system_e2e",
    standardRegressionExternalProviderEffect: false,
    explicitRunExternalProviderEffect: true,
    stop: "first_nonconforming_route",
  });
}

async function main() {
  if (process.argv.length !== 2) {
    process.stdout.write(
      `${JSON.stringify(blockedResult([], null), null, 2)}\n`,
    );
    process.exitCode = 64;
    return;
  }
  const outcome = await runRecordedVerification(
    "reviewer-boundary",
    process.cwd(),
    () =>
      runSignedReviewerBoundaryVerification(
        resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
      ),
    () => {
      poisonRuntimeProcessAfterCleanupUnknown();
      return blockedResult([], null, true);
    },
  );
  displayVerificationRecording(outcome);
  if (outcome.result !== null)
    process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
  process.exitCode = outcome.exitCode;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
