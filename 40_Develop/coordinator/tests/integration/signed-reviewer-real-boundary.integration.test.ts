/**
 * coordinator:integration:signed-reviewer-real-boundaryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:signed-reviewer-real-boundaryが所有する検証責務を実行する。
 * @trace AIT-IT-008
 * @level IT
 * @scope signed、reviewer、real-provider、explicit-boundary
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
import assert from "node:assert/strict";
import test from "node:test";

import { runSignedReviewerBoundaryVerification } from "../../scripts/verify-signed-reviewer-boundary.ts";

const isExplicitlyEnabled =
  process.env.CRDD_SIGNED_REVIEWER_BOUNDARY_INTEGRATION === "1";

/**
 * 署名済み候補で実Codex／Claude Reviewer境界を4経路E2E前に結合確認するを検証する。
 *
 * @responsibility 署名済み候補で実Codex／Claude Reviewer境界を4経路E2E前に結合確認するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名済み候補で実Codex／Claude Reviewer境界を4経路E2E前に結合確認するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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
