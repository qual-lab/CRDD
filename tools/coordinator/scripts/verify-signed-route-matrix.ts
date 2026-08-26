import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runSignedGeneralTaskVerification,
  type SignedGeneralTaskRouteProfile,
} from "./verify-signed-general-task.ts";

export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-route-matrix-verification";
export const SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION = 1;

const ROUTES: readonly SignedGeneralTaskRouteProfile[] = Object.freeze([
  "forward",
  "reverse",
  "same-codex",
  "same-claude",
]);

export async function runSignedRouteMatrixVerification(
  repositoryRoot: string,
  run: typeof runSignedGeneralTaskVerification = runSignedGeneralTaskVerification,
) {
  const results: Array<Readonly<Record<string, unknown>>> = [];
  for (const route of ROUTES) {
    const result = await run(repositoryRoot, undefined, route);
    results.push(Object.freeze({ routeProfile: route, ...result }));
    if (result.status !== "completed") break;
  }
  const completed =
    results.length === ROUTES.length &&
    results.every(
      (result) =>
        result.status === "completed" &&
        result.cleanupConfirmed === true &&
        result.manualRecoveryRequired === false &&
        result.canonicalRepositoryChanged === false,
    );
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
    cleanupConfirmed: completed,
    manualRecoveryRequired: results.some(
      (result) => result.manualRecoveryRequired === true,
    ),
    canonicalRepositoryChanged: results.some(
      (result) => result.canonicalRepositoryChanged === true,
    ),
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

export function describeSignedRouteMatrixVerificationContract() {
  return Object.freeze({
    contract: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_ROUTE_MATRIX_VERIFICATION_CONTRACT_REVISION,
    routes: ROUTES,
    order: "cross_provider_first_then_same_provider_exceptions",
    stop: "first_noncompleted_route",
    initialConsent:
      "first_boundary_confirmation_only_then_exact_runtime_owned_reuse",
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
