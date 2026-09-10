import assert from "node:assert/strict";
import test from "node:test";

import { runSignedReviewerBoundaryVerification } from "../../scripts/verify-signed-reviewer-boundary.ts";

const isExplicitlyEnabled =
  process.env.CRDD_SIGNED_REVIEWER_BOUNDARY_INTEGRATION === "1";

test("署名済み候補で実Codex／Claude Reviewer境界を4経路E2E前に結合確認する", {
  skip: !isExplicitlyEnabled,
}, async () => {
  const result = await runSignedReviewerBoundaryVerification(process.cwd());
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "signed_reviewer_boundary_integration_completed");
  assert.equal(result.completedRouteCount, 2);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
});
