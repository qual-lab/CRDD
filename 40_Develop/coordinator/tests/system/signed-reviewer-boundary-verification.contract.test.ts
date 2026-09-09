import assert from "node:assert/strict";
import test from "node:test";

import {
  describeSignedReviewerBoundaryVerificationContract,
  runSignedReviewerBoundaryVerification,
} from "../../scripts/verify-signed-reviewer-boundary.ts";

function completed(route: "forward" | "reverse") {
  return Object.freeze({
    contract: "crdd-coordinator/signed-general-task-verification",
    contractRevision: 23,
    status: "completed",
    reason: "signed_general_task_verification_completed",
    requestedRouteProfile: route,
    exactCandidateContentVerified: true,
    candidateDiscarded: true,
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
  });
}

test("実Codex／Claude Reviewer境界を4経路E2E前の二経路結合として固定する", async () => {
  const observed: string[] = [];
  const result = await runSignedReviewerBoundaryVerification(
    process.cwd(),
    (async (_root: string, _dependencies: unknown, route: unknown) => {
      assert.ok(route === "forward" || route === "reverse");
      observed.push(route);
      return completed(route);
    }) as never,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "signed_reviewer_boundary_integration_completed");
  assert.deepEqual(observed, ["forward", "reverse"]);
  assert.equal(result.completedRouteCount, 2);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
});

test("Reviewer拒否は次経路へ進まず安全な診断を子結果に保持する", async () => {
  const rejected = Object.freeze({
    ...completed("reverse"),
    status: "blocked",
    reason: "coordinator_task_independent_review_not_approved",
    exactCandidateContentVerified: false,
    candidateDiscarded: false,
    reviewerDecision: "changes_requested",
    reviewerFindingCount: 1,
    reviewerProjectedTargetExact: true,
    remediationPerformed: true,
  });
  const result = await runSignedReviewerBoundaryVerification(
    process.cwd(),
    (async (_root: string, _dependencies: unknown, route: unknown) =>
      route === "forward" ? completed("forward") : rejected) as never,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.failedRouteProfile, "reverse");
  assert.equal(result.completedRouteCount, 1);
  assert.equal(result.results[1]?.reviewerProjectedTargetExact, true);
  assert.equal(result.results[1]?.reviewerDecision, "changes_requested");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
});

test("通常回帰は実Providerを起動せず明示実行だけが境界Effectを持つ", () => {
  const contract = describeSignedReviewerBoundaryVerificationContract();
  assert.equal(contract.standardRegressionExternalProviderEffect, false);
  assert.equal(contract.explicitRunExternalProviderEffect, true);
  assert.deepEqual(contract.routes, ["forward", "reverse"]);
});
