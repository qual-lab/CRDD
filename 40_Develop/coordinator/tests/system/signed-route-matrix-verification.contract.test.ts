import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import {
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
  SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
} from "../../scripts/verify-signed-general-task.ts";

import {
  createSignedRouteMatrixCliFailureResult,
  describeSignedRouteMatrixVerificationContract,
  isExactSignedRouteResult,
  runSignedRouteMatrixVerification,
} from "../../scripts/verify-signed-route-matrix.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");
const routePoisonProbePath = path.join(
  coordinatorRoot,
  "tests/fixtures/signed-route-poison-probe.ts",
);

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
  remediationPerformed = false,
) {
  const [route, front, executor, reviewer] = expectations[profile];
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    status: "completed" as const,
    reason: "signed_general_task_verification_completed",
    manifestHash: "a".repeat(64),
    packageContentRootSha256: "b".repeat(64),
    runtimeExecutionIdentitySha256: "1".repeat(64),
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "c".repeat(40),
    crddTree: "d".repeat(40),
    executionCommit: "e".repeat(40),
    executionTree: "f".repeat(40),
    requestedRouteProfile: profile,
    route,
    requestedFrontProvider: front,
    observedFrontProvider: null,
    frontIdentityVerified: false,
    executorProvider: executor,
    reviewerProvider: reviewer,
    reviewerIndependence: "provider_independent",
    externalSendAuthorizationMode: authorizationMode,
    remediationPerformed,
    changedPaths: Object.freeze([
      "40_Develop/coordinator/runtime/general-task-verification.txt",
    ]),
    exactCandidateContentVerified: true,
    candidateDiscarded: true,
    candidateDisposition: "discarded",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    effectStateUnknown: false,
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

function safelyRetryable(
  reason:
    | "coordinator_task_independent_review_not_approved"
    | "signed_general_task_candidate_content_mismatch",
  authorizationMode: "interactive_initial_consent" | "reused_initial_consent",
  candidateDisposition: "discarded" | "not_issued" = "discarded",
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    manifestHash: "a".repeat(64),
    packageContentRootSha256: "b".repeat(64),
    runtimeExecutionIdentitySha256: "1".repeat(64),
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "c".repeat(40),
    crddTree: "d".repeat(40),
    executionCommit: "e".repeat(40),
    executionTree: "f".repeat(40),
    externalSendAuthorizationMode: authorizationMode,
    candidateDiscarded: candidateDisposition === "discarded",
    candidateDisposition,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    effectStateUnknown: false,
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
  const seenItems: string[] = [];
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    route,
  ) => {
    assert.ok(route);
    seenItems.push(route);
    return completed(
      route,
      seenItems.length === 1
        ? "interactive_initial_consent"
        : "reused_initial_consent",
    );
  }) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "completed");
  assert.deepEqual(seenItems, [
    "forward",
    "reverse",
    "same-codex",
    "same-claude",
  ]);
  assert.equal(result.completedRouteCount, 4);
  assert.equal(result.failedRouteProfile, null);
  assert.equal(result.validationFailure, null);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(result.cleanupConfirmed, true);
});

test("最初の未完了経路で停止し既知cleanup状態を失わない", async () => {
  const seenItems: string[] = [];
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    route,
  ) => {
    assert.ok(route);
    seenItems.push(route);
    return route === "reverse"
      ? Object.freeze({
          status: "blocked" as const,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: false,
          effectStateUnknown: false,
          hostRecoveryId: null,
          hostRecoveryIds: Object.freeze([]),
          dockerRecoveryId: null,
          dockerRecoveryIds: Object.freeze([]),
          candidateRecoveryId: null,
          candidateRecoveryIds: Object.freeze([]),
          candidateStoreRecoveryId: null,
          candidateStoreRecoveryIds: Object.freeze([]),
          canonicalRepositoryChanged: false,
          rawProviderOutputReported: false,
          hostPathReported: false,
          credentialReported: false,
        })
      : completed(route, "interactive_initial_consent");
  }) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "blocked");
  assert.deepEqual(seenItems, ["forward", "reverse"]);
  assert.equal(result.completedRouteCount, 1);
  assert.equal(result.manualRecoveryRequired, true);
});

test("全成功fieldの一つでも危険側・経路不一致なら完了判定しない", () => {
  const base = completed("forward", "interactive_initial_consent");
  const mutations: Array<readonly [string, unknown]> = [
    ["contractRevision", 4],
    ["manifestHash", undefined],
    ["crddCommit", "e".repeat(64)],
    ["executionCommit", "e".repeat(64)],
    ["changedPaths", []],
    ["changedPaths", ["other.txt"]],
    ["requestedRouteProfile", "reverse"],
    ["executorProvider", "codex"],
    ["reviewerProvider", "claude"],
    ["candidateDiscarded", false],
    ["candidateDisposition", "not_issued"],
    ["candidateDisposition", undefined],
    ["remediationPerformed", null],
    ["remediationPerformed", "true"],
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
  assert.equal(
    isExactSignedRouteResult(
      "forward",
      completed("forward", "interactive_initial_consent", true),
      "interactive_initial_consent",
    ),
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

test("保存済み同意は初回からreuseし残りもreuseで閉じる", async () => {
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    route,
  ) =>
    completed(
      route ?? "forward",
      "reused_initial_consent",
    )) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "completed");
  assert.equal(result.completedRouteCount, 4);
  assert.equal(
    result.initialConsentAuthorizationMode,
    "reused_initial_consent",
  );
});

test("exact破棄と残存0を確認した閉集合理由だけ同じ経路を最大3回まで再試行する", async () => {
  const seenItems: string[] = [];
  let forwardAttempts = 0;
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    route,
  ) => {
    assert.ok(route);
    seenItems.push(route);
    if (route === "forward") {
      forwardAttempts += 1;
      if (forwardAttempts === 1)
        return safelyRetryable(
          "signed_general_task_candidate_content_mismatch",
          "interactive_initial_consent",
        );
    }
    return completed(route, "reused_initial_consent");
  }) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "completed");
  assert.deepEqual(seenItems, [
    "forward",
    "forward",
    "reverse",
    "same-codex",
    "same-claude",
  ]);
  assert.equal(result.attemptedRouteCount, 5);
  assert.equal(result.completedRouteCount, 4);
  assert.equal(result.retryableRouteAttemptCount, 1);
  assert.equal(result.cleanupConfirmed, true);
});

test("安全再試行の全attemptを同じ作業対象Execution Revisionへ固定する", async () => {
  let attempts = 0;
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    route,
  ) => {
    attempts += 1;
    if (attempts === 1)
      return safelyRetryable(
        "signed_general_task_candidate_content_mismatch",
        "interactive_initial_consent",
      );
    return Object.freeze({
      ...completed(route ?? "forward", "reused_initial_consent"),
      executionCommit: "1".repeat(40),
    });
  }) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "blocked");
  assert.equal(result.attemptedRouteCount, 2);
  assert.equal(result.completedRouteCount, 0);
  assert.equal(result.retryableRouteAttemptCount, 1);
  assert.equal(result.failedRouteProfile, "forward");
  assert.equal(result.validationFailure, "execution_identity_mismatch");
});

test("安全な閉集合理由でも3回目は再試行せず全履歴を保持して停止する", async () => {
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    _route,
  ) =>
    safelyRetryable(
      "coordinator_task_independent_review_not_approved",
      "reused_initial_consent",
      "not_issued",
    )) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "blocked");
  assert.equal(result.attemptedRouteCount, 3);
  assert.equal(result.completedRouteCount, 0);
  assert.equal(result.retryableRouteAttemptCount, 2);
  assert.equal(result.failedRouteProfile, "forward");
  assert.equal((result.results as readonly unknown[]).length, 3);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
});

test("Recovery曖昧・候補未破棄・汎用失敗は再試行せず初回で停止する", async () => {
  for (const mutation of [
    { recoveryIdentityAmbiguous: true },
    { candidateDiscarded: false },
    { reason: "provider_process_exit_nonzero" },
  ]) {
    let attempts = 0;
    const result = await runSignedRouteMatrixVerification(
      process.cwd(),
      (async () => {
        attempts += 1;
        return Object.freeze({
          ...safelyRetryable(
            "signed_general_task_candidate_content_mismatch",
            "reused_initial_consent",
          ),
          ...mutation,
        });
      }) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    );
    assert.equal(result.status, "blocked");
    assert.equal(attempts, 1);
    assert.equal(result.attemptedRouteCount, 1);
    assert.equal(result.retryableRouteAttemptCount, 0);
  }
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
      }) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    );
    assert.equal(result.status, "blocked", field);
    assert.equal(result.attemptedRouteCount, 2, field);
    assert.equal(result.completedRouteCount, 1, field);
    assert.equal(result.failedRouteProfile, "reverse", field);
    assert.equal(result.validationFailure, "release_identity_mismatch", field);
  }
});

test("4経路は同一の実行Repository Identityへ固定し別Revisionを集約しない", async () => {
  for (const [field, value] of [
    ["executionCommit", "1".repeat(40)],
    ["executionTree", "2".repeat(40)],
  ] as const) {
    let count = 0;
    const result = await runSignedRouteMatrixVerification(
      process.cwd(),
      (async (_root, _dependencies, route) => {
        count += 1;
        const routeResult = completed(
          route ?? "forward",
          count === 1
            ? "interactive_initial_consent"
            : "reused_initial_consent",
        );
        return count === 2
          ? Object.freeze({ ...routeResult, [field]: value })
          : routeResult;
      }) as typeof import("../../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification,
    );
    assert.equal(result.status, "blocked", field);
    assert.equal(result.attemptedRouteCount, 2, field);
    assert.equal(result.completedRouteCount, 1, field);
    assert.equal(result.failedRouteProfile, "reverse", field);
    assert.equal(
      result.validationFailure,
      "execution_identity_mismatch",
      field,
    );
  }
});

test("route runner例外は実Processをpoisonし全guarded入口をEffect前に閉じる", () => {
  const probe = spawnSync(
    process.execPath,
    [routePoisonProbePath, "runner_exception"],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(probe.status, 0, probe.stderr);
  const observed = JSON.parse(probe.stdout) as Record<string, unknown>;
  const result = observed.result as Record<string, unknown>;
  assert.equal(result.status, "blocked");
  assert.equal(observed.attempts, 2);
  assert.equal(result.completedRouteCount, 1);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.validationFailure, "runner_exception");
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.processRestartRequired, true);
  assert.equal(observed.poisoned, true);
  assert.equal(
    (observed.secondMatrix as Record<string, unknown>).validationFailure,
    "process_restart_required",
  );
  assert.equal(observed.packageReads, 0);
  assert.equal(observed.grantReads, 0);
  assert.equal(
    observed.packageReason,
    "platform_provisioner_process_restart_required",
  );
  assert.equal(
    observed.taskReason,
    "coordinator_task_process_restart_required",
  );
  assert.equal(
    observed.grantReason,
    "external_send_confirmation_cleanup_unknown_process_restart_required",
  );
});

test("非適合routeの観測field欠落またはnullは独立Processでpoisonへ収束する", () => {
  for (const field of [
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
    "effectStateUnknown",
    "canonicalRepositoryChanged",
    "rawProviderOutputReported",
    "hostPathReported",
    "credentialReported",
  ]) {
    for (const mode of ["missing", "null", "string"] as const) {
      const probe = spawnSync(
        process.execPath,
        [routePoisonProbePath, `${mode}:${field}`],
        { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
      );
      assert.equal(probe.status, 0, probe.stderr);
      const observed = JSON.parse(probe.stdout) as Record<string, unknown>;
      const result = observed.result as Record<string, unknown>;
      assert.equal(result.status, "blocked", `${field}:${mode}`);
      assert.equal(
        result.validationFailure,
        "runner_exception",
        `${field}:${mode}`,
      );
      assert.equal(result.effectStateUnknown, true, `${field}:${mode}`);
      assert.equal(result.manualRecoveryRequired, true, `${field}:${mode}`);
      assert.equal(result.processRestartRequired, true, `${field}:${mode}`);
      assert.equal(observed.poisoned, true, `${field}:${mode}`);
      assert.equal(result.canonicalRepositoryChanged, null, `${field}:${mode}`);
      assert.equal(result.rawProviderOutputReported, null, `${field}:${mode}`);
      assert.equal(result.hostPathReported, null, `${field}:${mode}`);
      assert.equal(result.credentialReported, null, `${field}:${mode}`);
    }
  }
});

test("route結果のgetter／Proxy観測不能は実Process poisonへ閉じる", () => {
  for (const scenario of ["result_getter", "result_proxy"]) {
    const probe = spawnSync(
      process.execPath,
      [routePoisonProbePath, scenario],
      { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
    );
    assert.equal(probe.status, 0, probe.stderr);
    const observed = JSON.parse(probe.stdout) as Record<string, unknown>;
    const result = observed.result as Record<string, unknown>;
    assert.equal(result.validationFailure, "runner_exception", scenario);
    assert.equal(result.processRestartRequired, true, scenario);
    assert.equal(result.manualRecoveryRequired, true, scenario);
    assert.equal(observed.poisoned, true, scenario);
    assert.equal(observed.packageReads, 0, scenario);
    assert.equal(observed.grantReads, 0, scenario);
  }
});

test("route安全観測不明でも有効Recovery IDをnested／top-levelへ保持する", () => {
  const probe = spawnSync(
    process.execPath,
    [routePoisonProbePath, "recovery_pair_mismatch"],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(probe.status, 0, probe.stderr);
  const observed = JSON.parse(probe.stdout) as Record<string, unknown>;
  const result = observed.result as Record<string, unknown>;
  const nested = (result.results as Array<Record<string, unknown>>)[0];
  assert.equal(observed.attempts, 1);
  assert.equal(result.validationFailure, "runner_exception");
  const expectedItems = [
    `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`,
    `host.crdd-coordinator-doctor-b.12345678-1234-4234-8234-123456789abc.${"b".repeat(64)}`,
  ];
  assert.deepEqual(nested?.hostRecoveryIds, expectedItems);
  assert.deepEqual(result.hostRecoveryIds, expectedItems);
  assert.equal(result.hostRecoveryId, null);
  assert.equal(result.recoveryIdentityAmbiguous, true);
  assert.equal(result.processRestartRequired, true);
  assert.equal(observed.poisoned, true);
});

test("route salvageは過長IDを公開せず同じfieldのvalid IDだけを保持する", () => {
  const probe = spawnSync(
    process.execPath,
    [routePoisonProbePath, "recovery_overlong_mixed"],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(probe.status, 0, probe.stderr);
  const observed = JSON.parse(probe.stdout) as Record<string, unknown>;
  const result = observed.result as Record<string, unknown>;
  const valid = `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
  assert.deepEqual(result.hostRecoveryIds, [valid]);
  assert.equal(result.hostRecoveryId, valid);
  assert.equal(result.recoveryIdentityAmbiguous, true);
  assert.equal(JSON.stringify(result).includes("x".repeat(1_025)), false);
});

test("CLI最外周は引数不正と実行中未知を別分類し観測事実を捏造しない", () => {
  const unknown = createSignedRouteMatrixCliFailureResult("runner_exception");
  assert.equal(unknown.effectStateUnknown, true);
  assert.equal(unknown.retryableRouteAttemptCount, 0);
  assert.equal(unknown.manualRecoveryRequired, true);
  assert.equal(unknown.canonicalRepositoryChanged, null);
  assert.equal(unknown.rawProviderOutputReported, null);
  assert.equal(unknown.hostPathReported, null);
  assert.equal(unknown.credentialReported, null);
  for (const pair of [
    ["hostRecoveryId", "hostRecoveryIds"],
    ["dockerRecoveryId", "dockerRecoveryIds"],
    ["candidateRecoveryId", "candidateRecoveryIds"],
    ["candidateStoreRecoveryId", "candidateStoreRecoveryIds"],
  ] as const) {
    assert.equal(unknown[pair[0]], null);
    assert.deepEqual(unknown[pair[1]], []);
  }
  assert.equal(unknown.recoveryIdentityAmbiguous, true);

  const cli = spawnSync(
    process.execPath,
    [
      path.join(coordinatorRoot, "scripts/verify-signed-route-matrix.ts"),
      "unexpected",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(cli.status, 64);
  assert.equal(cli.stderr, "");
  assert.equal(cli.stdout.includes("unexpected"), false);
  const result = JSON.parse(cli.stdout) as Record<string, unknown>;
  assert.equal(result.validationFailure, "arguments_invalid");
  assert.equal(result.retryableRouteAttemptCount, 0);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.canonicalRepositoryChanged, false);
  assert.equal(result.rawProviderOutputReported, false);
  assert.equal(result.hostPathReported, false);
  assert.equal(result.credentialReported, false);
  assert.equal(result.recoveryIdentityAmbiguous, false);
  assert.deepEqual(result.hostRecoveryIds, []);
});

test("公開契約は4経路、初期同意再利用、Candidate破棄と課金禁止を固定する", () => {
  const contract = describeSignedRouteMatrixVerificationContract();
  assert.equal(contract.contractRevision, 12);
  assert.equal(
    contract.verificationFixture,
    "same_signed_tracked_base_marker_exact_token_replacement_for_every_route",
  );
  assert.equal(
    contract.boundedRemediation,
    "each_route_accepts_zero_or_one_runtime_owned_remediation_only_after_final_independent_approval",
  );
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
