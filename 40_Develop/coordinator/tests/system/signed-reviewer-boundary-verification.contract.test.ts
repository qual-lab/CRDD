/**
 * coordinator:system:signed-reviewer-boundary-verificationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:signed-reviewer-boundary-verificationが所有する検証責務を実行する。
 * @trace AIT-ST-004
 * @level ST
 * @scope signed、reviewer、real-provider、integration-boundary
 * @boundary AIT-ST-004=System/E2E: 配布物観測→Policy評価→Runtime Authority Gate
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeSignedReviewerBoundaryVerificationContract,
  runSignedReviewerBoundaryVerification,
} from "../../scripts/verify-reviewer-boundary.ts";
import { SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION } from "../../scripts/verify-general-task.ts";

/**
 * completedのTest準備責務を実行する。
 *
 * @responsibility completedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-ST-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus completedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-ST-004=Direct Boundary: coordinator Test Source→対象契約
 */
function completed(route: "forward" | "reverse") {
  return Object.freeze({
    contract: "crdd-coordinator/signed-general-task-verification",
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    status: "completed",
    reason: "signed_general_task_verification_completed",
    sourceScope: "crdd-development-source-snapshot/v2",
    sourceSha256: "b".repeat(64),
    crddCommit: "c".repeat(40),
    crddTree: "d".repeat(40),
    sourceObservationStatus: "matched",
    signatureRequired: false,
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

/**
 * 二経路の集約は同じ新版Source tupleだけを受理する。
 * @responsibility Sourceの欠落・不正・差と旧改訂を成功へ集約しない。
 * @trace AIT-ST-004
 * @precondition 新版の安全な成功fixtureを使用する。
 * @stimulus 二経路目の各Source fieldと改訂、検証状態を変更する。
 * @observation 集約status、停止経路、完了数と呼出し数。
 * @oracle 不正形も別Sourceの成功形も二経路完了にならない。
 * @cleanup N/A: 固定値の模擬Runnerだけで実Providerを起動しない。
 * @boundary 一般Taskの新版結果→二経路集約。
 */
test("二経路はSource tupleの欠測・不正・差と旧改訂を拒否する", async () => {
  for (const [field, value] of [
    ["sourceScope", undefined],
    ["sourceScope", "unknown"],
    ["sourceSha256", undefined],
    ["sourceSha256", "invalid"],
    ["sourceSha256", "e".repeat(64)],
    ["crddCommit", undefined],
    ["crddCommit", "invalid"],
    ["crddCommit", "e".repeat(40)],
    ["crddTree", undefined],
    ["crddTree", "invalid"],
    ["crddTree", "e".repeat(40)],
    ["sourceObservationStatus", "changed"],
    ["signatureRequired", true],
    [
      "contractRevision",
      SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION - 1,
    ],
  ] as const) {
    let calls = 0;
    const result = await runSignedReviewerBoundaryVerification(
      process.cwd(),
      (async (
        _root: string,
        _dependencies: unknown,
        route: "forward" | "reverse",
      ) => {
        calls += 1;
        return {
          ...completed(route),
          ...(calls === 2 ? { [field]: value } : {}),
        };
      }) as never,
    );
    assert.equal(result.status, "blocked", field);
    assert.equal(result.failedRouteProfile, "reverse", field);
    assert.equal(result.completedRouteCount, 1, field);
    assert.equal(calls, 2, field);
    assert.equal(result.cleanupConfirmed, true, field);
  }
});

/**
 * 実Codex／Claude Reviewer境界を4経路E2E前の二経路結合として固定するを検証する。
 *
 * @responsibility 実Codex／Claude Reviewer境界を4経路E2E前の二経路結合として固定するの合否判定を所有する。
 * @trace AIT-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Codex／Claude Reviewer境界を4経路E2E前の二経路結合として固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-ST-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("実Codex／Claude Reviewer境界を4経路E2E前の二経路結合として固定する", async () => {
  const observedRoutes: string[] = [];
  const result = await runSignedReviewerBoundaryVerification(
    process.cwd(),
    (async (_root: string, _dependencies: unknown, route: unknown) => {
      assert.ok(route === "forward" || route === "reverse");
      observedRoutes.push(route);
      return completed(route);
    }) as never,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "signed_reviewer_boundary_integration_completed");
  assert.deepEqual(observedRoutes, ["forward", "reverse"]);
  assert.equal(result.completedRouteCount, 2);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
});

/**
 * Reviewer拒否は次経路へ進まず安全な診断を子結果に保持するを検証する。
 *
 * @responsibility Reviewer拒否は次経路へ進まず安全な診断を子結果に保持するの合否判定を所有する。
 * @trace AIT-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewer拒否は次経路へ進まず安全な診断を子結果に保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-ST-004=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 通常回帰は実Providerを起動せず明示実行だけが境界Effectを持つを検証する。
 *
 * @responsibility 通常回帰は実Providerを起動せず明示実行だけが境界Effectを持つの合否判定を所有する。
 * @trace AIT-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常回帰は実Providerを起動せず明示実行だけが境界Effectを持つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-ST-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("通常回帰は実Providerを起動せず明示実行だけが境界Effectを持つ", () => {
  const contract = describeSignedReviewerBoundaryVerificationContract();
  assert.equal(contract.standardRegressionExternalProviderEffect, false);
  assert.equal(contract.explicitRunExternalProviderEffect, true);
  assert.deepEqual(contract.routes, ["forward", "reverse"]);
});
