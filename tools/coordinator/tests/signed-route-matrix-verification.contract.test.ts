import assert from "node:assert/strict";
import test from "node:test";

import {
  describeSignedRouteMatrixVerificationContract,
  isExactSignedRouteResult,
  runSignedRouteMatrixVerification,
} from "../scripts/verify-signed-route-matrix.ts";

const expectations = {
  forward: [
    "front_codex__executor_claude__reviewer_codex",
    "codex",
    "claude",
    "codex",
  ],
  reverse: [
    "front_claude__executor_codex__reviewer_claude",
    "claude",
    "codex",
    "claude",
  ],
  "same-codex": [
    "front_codex__executor_codex__reviewer_claude",
    "codex",
    "codex",
    "claude",
  ],
  "same-claude": [
    "front_claude__executor_claude__reviewer_codex",
    "claude",
    "claude",
    "codex",
  ],
} as const;

function completed(
  profile: keyof typeof expectations,
  authorizationMode = "reused_initial_consent",
) {
  const [route, front, executor, reviewer] = expectations[profile];
  return Object.freeze({
    contract: "crdd-coordinator/signed-general-task-verification",
    contractRevision: 6,
    status: "completed" as const,
    reason: "signed_general_task_verification_completed",
    manifestHash: "a".repeat(64),
    packageContentRootSha256: "b".repeat(64),
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "c".repeat(40),
    crddTree: "d".repeat(40),
    requestedRouteProfile: profile,
    route,
    requestedFrontProvider: front,
    observedFrontProvider: null,
    frontIdentityVerified: false,
    executorProvider: executor,
    reviewerProvider: reviewer,
    reviewerIndependence: "provider_independent",
    externalSendAuthorizationMode: authorizationMode,
    remediationPerformed: false,
    changedPaths: Object.freeze([
      "tools/coordinator/runtime/general-task-verification.txt",
    ]),
    exactCandidateContentVerified: true,
    candidateDiscarded: true,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    hostRecoveryId: null,
    hostRecoveryIds: Object.freeze([]),
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateRecoveryIds: Object.freeze([]),
    candidateStoreRecoveryId: null,
    candidateStoreRecoveryIds: Object.freeze([]),
    recoveryIdentityAmbiguous: false,
    canonicalRepositoryChanged: false,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

test("4経路をcross-provider優先で順番に実測し全cleanup後だけ完了する", async () => {
  const seen: string[] = [];
  const result = await runSignedRouteMatrixVerification(
    process.cwd(),
    (async (_root, _dependencies, route) => {
      assert.ok(route);
      seen.push(route);
      return completed(
        route,
        seen.length === 1
          ? "interactive_initial_consent"
          : "reused_initial_consent",
      );
    }) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    () => Object.freeze({ status: "revoked" as const }),
  );
  assert.equal(result.status, "completed");
  assert.deepEqual(seen, ["forward", "reverse", "same-codex", "same-claude"]);
  assert.equal(result.completedRouteCount, 4);
  assert.equal(result.failedRouteProfile, null);
  assert.equal(result.validationFailure, null);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(result.cleanupConfirmed, true);
});

test("最初の未完了経路で停止し既知cleanup状態を失わない", async () => {
  const seen: string[] = [];
  const result = await runSignedRouteMatrixVerification(
    process.cwd(),
    (async (_root, _dependencies, route) => {
      assert.ok(route);
      seen.push(route);
      return route === "reverse"
        ? Object.freeze({
            status: "blocked" as const,
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            canonicalRepositoryChanged: false,
          })
        : completed(route, "interactive_initial_consent");
    }) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    () => Object.freeze({ status: "revoked" as const }),
  );
  assert.equal(result.status, "blocked");
  assert.deepEqual(seen, ["forward", "reverse"]);
  assert.equal(result.completedRouteCount, 1);
  assert.equal(result.manualRecoveryRequired, true);
});

test("全成功fieldの一つでも危険側・経路不一致なら完了判定しない", () => {
  const base = completed("forward", "interactive_initial_consent");
  const mutations: Array<readonly [string, unknown]> = [
    ["contractRevision", 4],
    ["manifestHash", undefined],
    ["crddCommit", "e".repeat(64)],
    ["changedPaths", []],
    ["changedPaths", ["other.txt"]],
    ["requestedRouteProfile", "reverse"],
    ["executorProvider", "codex"],
    ["reviewerProvider", "claude"],
    ["candidateDiscarded", false],
    ["hostRecoveryIds", ["unexpected"]],
    ["recoveryIdentityAmbiguous", true],
    ["rawProviderOutputReported", true],
    ["hostPathReported", true],
    ["credentialReported", true],
  ];
  assert.equal(
    isExactSignedRouteResult("forward", base, "interactive_initial_consent"),
    true,
  );
  for (const [field, value] of mutations) {
    assert.equal(
      isExactSignedRouteResult(
        "forward",
        Object.freeze({ ...base, [field]: value }),
        "interactive_initial_consent",
      ),
      false,
      field,
    );
  }
});

test("最初は対話、残りはreuseでなければ行列を閉じない", async () => {
  const result = await runSignedRouteMatrixVerification(
    process.cwd(),
    (async (_root, _dependencies, route) =>
      completed(
        route ?? "forward",
        "reused_initial_consent",
      )) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    () => Object.freeze({ status: "revoked" as const }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.completedRouteCount, 0);
  assert.equal(result.validationFailure, "route_nonconforming");
});

test("4経路は同一Release Identityへ固定し別Releaseを集約しない", async () => {
  const mutations: Array<readonly [string, unknown]> = [
    ["manifestHash", "f".repeat(64)],
    ["packageContentRootSha256", "f".repeat(64)],
    ["crddVersion", "v0.18.1"],
    ["releaseSequence", 19],
    ["crddCommit", "e".repeat(40)],
    ["crddTree", "e".repeat(40)],
  ];
  for (const [field, value] of mutations) {
    let count = 0;
    const result = await runSignedRouteMatrixVerification(
      process.cwd(),
      (async (_root, _dependencies, route) => {
        count += 1;
        const result = completed(
          route ?? "forward",
          count === 1
            ? "interactive_initial_consent"
            : "reused_initial_consent",
        );
        return count === 2
          ? Object.freeze({ ...result, [field]: value })
          : result;
      }) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
      () => Object.freeze({ status: "revoked" as const }),
    );
    assert.equal(result.status, "blocked", field);
    assert.equal(result.attemptedRouteCount, 2, field);
    assert.equal(result.completedRouteCount, 1, field);
    assert.equal(result.failedRouteProfile, "reverse", field);
    assert.equal(result.validationFailure, "release_identity_mismatch", field);
  }
});

test("route runner例外は既知結果を保持して未知状態を手動回復へ閉じる", async () => {
  let count = 0;
  const result = await runSignedRouteMatrixVerification(
    process.cwd(),
    (async (_root, _dependencies, route) => {
      count += 1;
      if (count === 2) throw new Error("provider output must not escape");
      return completed(route ?? "forward", "interactive_initial_consent");
    }) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    () => Object.freeze({ status: "revoked" as const }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.attemptedRouteCount, 2);
  assert.equal(result.completedRouteCount, 1);
  assert.equal(result.results.length, 2);
  assert.equal(
    result.results[1]?.reason,
    "signed_route_matrix_route_runner_failed_closed",
  );
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.failedRouteProfile, "reverse");
  assert.equal(result.validationFailure, "runner_exception");
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.canonicalRepositoryChanged, null);
  assert.equal(result.rawProviderOutputReported, null);
  assert.equal(result.hostPathReported, null);
  assert.equal(result.credentialReported, null);
});

test("同意取消の観測不能時は一つのrouteも開始しない", async () => {
  let attempts = 0;
  const result = await runSignedRouteMatrixVerification(
    process.cwd(),
    (async () => {
      attempts += 1;
      return completed("forward", "interactive_initial_consent");
    }) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    () => Object.freeze({ status: "recovery_required" as const }),
  );
  assert.equal(attempts, 0);
  assert.equal(result.status, "blocked");
  assert.equal(result.completedRouteCount, 0);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.validationFailure, "consent_reset_failed");
  assert.equal(result.effectStateUnknown, false);
});

test("公開契約は4経路、初期同意再利用、Candidate破棄と課金禁止を固定する", () => {
  const contract = describeSignedRouteMatrixVerificationContract();
  assert.deepEqual(contract.routes, [
    "forward",
    "reverse",
    "same-codex",
    "same-claude",
  ]);
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
});
