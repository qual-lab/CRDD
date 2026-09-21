/**
 * project-runtime:unit:public-contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility project-runtime:unit:public-contractが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope project、runtime、public、contract
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectProjectRuntimeDecisionRequest,
  inspectProjectRuntimeIntegrationResult,
  inspectProjectRuntimeObjectiveRequest,
  isProjectRuntimeDecisionRecord,
  PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
  PROJECT_RUNTIME_INTEGRATION_CONTRACT,
  PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
  PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
} from "../../src/index.ts";

const repositoryRevision = "a".repeat(40);

/**
 * Execution Portは既存Single Task結果契約を意味変更せず所有するを検証する。
 *
 * @responsibility Execution Portは既存Single Task結果契約を意味変更せず所有するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Execution Portは既存Single Task結果契約を意味変更せず所有するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Execution Portは既存Single Task結果契約を意味変更せず所有する", () => {
  assert.equal(
    PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    "crdd-coordinator/project-runtime-single-task-adapter",
  );
  assert.equal(PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION, 2);
});

/**
 * objectiveRequestのTest準備責務を実行する。
 *
 * @responsibility objectiveRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus objectiveRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
function objectiveRequest() {
  return {
    requestId: "request-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    repositoryRevision,
    objective: "公開契約を検証する",
    acceptanceCriteria: ["閉じた入力だけを受理する"],
    allowedPaths: ["40_Develop/project-runtime"],
    readPaths: ["06_Architecture/project-runtime"],
    maximumConcurrency: 2,
    maximumReplans: 1,
    originLane: "interactive",
    adoptResult: false,
  } as const;
}

/**
 * integrationResultのTest準備責務を実行する。
 *
 * @responsibility integrationResultがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus integrationResultを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
function integrationResult() {
  return {
    contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
    status: "completed",
    reason: "integration_completed",
    projectId: "project-1",
    milestoneId: "milestone-1",
    queueId: "queue-1",
    stateGeneration: 2,
    candidateId: "candidate-1",
    receiptId: "receipt-1",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    recoveryIds: [],
  } as const;
}

/**
 * decisionRequestのTest準備責務を実行する。
 *
 * @responsibility decisionRequestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus decisionRequestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
function decisionRequest() {
  return {
    decisionId: "decision-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    generation: 2,
    repositoryRevision,
    selectedOption: "resume",
    continuationCapability: "opaque-capability",
    comment: "再開する",
  } as const;
}

/**
 * Objective要求は閉じた公開契約へsnapshotするを検証する。
 *
 * @responsibility Objective要求は閉じた公開契約へsnapshotするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective要求は閉じた公開契約へsnapshotするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Objective要求は閉じた公開契約へsnapshotする", () => {
  assert.equal(
    PROJECT_RUNTIME_PUBLIC_RUNTIME_CONTRACT,
    "crdd-coordinator/project-runtime-public-runtime/v1",
  );
  const source = objectiveRequest();
  const inspected = inspectProjectRuntimeObjectiveRequest(source);
  assert.ok(inspected);
  assert.notEqual(inspected, source);
  assert.ok(Object.isFrozen(inspected));
  assert.ok(Object.isFrozen(inspected.acceptanceCriteria));
});

/**
 * Objective要求は未知field・accessor・ProxyをEffect前に拒否するを検証する。
 *
 * @responsibility Objective要求は未知field・accessor・ProxyをEffect前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective要求は未知field・accessor・ProxyをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Objective要求は未知field・accessor・ProxyをEffect前に拒否する", () => {
  assert.equal(
    inspectProjectRuntimeObjectiveRequest({ ...objectiveRequest(), extra: 1 }),
    null,
  );
  assert.equal(
    inspectProjectRuntimeObjectiveRequest(
      Object.defineProperty({ ...objectiveRequest() }, "objective", {
        get: () => "shape-shifting",
        enumerable: true,
      }),
    ),
    null,
  );
  assert.equal(
    inspectProjectRuntimeObjectiveRequest(new Proxy(objectiveRequest(), {})),
    null,
  );
  const symbolExtended = { ...objectiveRequest() } as Record<
    PropertyKey,
    unknown
  >;
  symbolExtended[Symbol("hidden")] = true;
  assert.equal(inspectProjectRuntimeObjectiveRequest(symbolExtended), null);
  const nonEnumerableExtended = Object.defineProperty(
    { ...objectiveRequest() },
    "hidden",
    { value: true },
  );
  assert.equal(
    inspectProjectRuntimeObjectiveRequest(nonEnumerableExtended),
    null,
  );
  const alteredCriteria = [...objectiveRequest().acceptanceCriteria];
  Object.setPrototypeOf(alteredCriteria, null);
  assert.equal(
    inspectProjectRuntimeObjectiveRequest({
      ...objectiveRequest(),
      acceptanceCriteria: alteredCriteria,
    }),
    null,
  );
});

/**
 * Objective要求はRepository外を指すPath表現をEffect前に拒否するを検証する。
 *
 * @responsibility Objective要求はRepository外を指すPath表現をEffect前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Objective要求はRepository外を指すPath表現をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Objective要求はRepository外を指すPath表現をEffect前に拒否する", () => {
  for (const pathValue of [
    "C:\\project\\outside",
    "/absolute/path",
    "../outside",
    "inside/../outside",
    "inside//file",
  ]) {
    assert.equal(
      inspectProjectRuntimeObjectiveRequest({
        ...objectiveRequest(),
        allowedPaths: [pathValue],
      }),
      null,
    );
    assert.equal(
      inspectProjectRuntimeObjectiveRequest({
        ...objectiveRequest(),
        readPaths: [pathValue],
      }),
      null,
    );
  }
});

/**
 * 判断要求はTransportに依存しない閉じた公開契約へsnapshotするを検証する。
 *
 * @responsibility 判断要求はTransportに依存しない閉じた公開契約へsnapshotするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断要求はTransportに依存しない閉じた公開契約へsnapshotするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("判断要求はTransportに依存しない閉じた公開契約へsnapshotする", () => {
  assert.equal(
    PROJECT_RUNTIME_HUMAN_DECISION_CONTRACT,
    "crdd-coordinator/project-runtime-human-decision/v1",
  );
  const source = decisionRequest();
  const inspected = inspectProjectRuntimeDecisionRequest(source);
  assert.ok(inspected);
  assert.notEqual(inspected, source);
  assert.ok(Object.isFrozen(inspected));
  assert.equal(inspected.selectedOption, "resume");
});

/**
 * 判断Store RecordはProject Runtimeの閉じた意味契約で検証するを検証する。
 *
 * @responsibility 判断Store RecordはProject Runtimeの閉じた意味契約で検証するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断Store RecordはProject Runtimeの閉じた意味契約で検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("判断Store RecordはProject Runtimeの閉じた意味契約で検証する", () => {
  const record = {
    recordId: "decision-record-1",
    decisionId: "decision-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    queueId: "queue-1",
    repositoryRevision,
    expectedGeneration: 1,
    principalId: "principal-1",
    allowedOptions: ["resume", "cancel"],
    capabilityHash: "b".repeat(64),
    expiresAtEpochMs: 1,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
    replacementRequestId: null,
  } as const;
  assert.equal(isProjectRuntimeDecisionRecord(record), true);
  assert.equal(
    isProjectRuntimeDecisionRecord({ ...record, provider: "codex" }),
    false,
  );
  assert.equal(
    isProjectRuntimeDecisionRecord({
      ...record,
      disposition: "completed",
    }),
    false,
  );
  assert.equal(
    isProjectRuntimeDecisionRecord({
      ...record,
      selectedOption: "resume",
      newGeneration: 1,
    }),
    false,
  );
  assert.equal(
    isProjectRuntimeDecisionRecord(
      new Proxy(record, {
        getPrototypeOf: () => {
          throw new Error("untrusted-record");
        },
      }),
    ),
    false,
  );
});

/**
 * 判断要求は未知field・改行comment・不正世代をEffect前に拒否するを検証する。
 *
 * @responsibility 判断要求は未知field・改行comment・不正世代をEffect前に拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断要求は未知field・改行comment・不正世代をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("判断要求は未知field・改行comment・不正世代をEffect前に拒否する", () => {
  assert.equal(
    inspectProjectRuntimeDecisionRequest({ ...decisionRequest(), extra: 1 }),
    null,
  );
  assert.equal(
    inspectProjectRuntimeDecisionRequest({
      ...decisionRequest(),
      comment: "line1\nline2",
    }),
    null,
  );
  assert.equal(
    inspectProjectRuntimeDecisionRequest({
      ...decisionRequest(),
      generation: 0,
    }),
    null,
  );
});

/**
 * 統合結果は正常完了とRecovery付き停止を区別するを検証する。
 *
 * @responsibility 統合結果は正常完了とRecovery付き停止を区別するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 統合結果は正常完了とRecovery付き停止を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("統合結果は正常完了とRecovery付き停止を区別する", () => {
  const completed = inspectProjectRuntimeIntegrationResult(integrationResult());
  assert.ok(completed);
  assert.equal(completed.status, "completed");
  const recoveryId = "runtime-process.recovery-1";
  const blocked = inspectProjectRuntimeIntegrationResult({
    ...integrationResult(),
    status: "blocked",
    reason: "integration_recovery_required",
    candidateId: null,
    receiptId: null,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    recoveryIds: [recoveryId],
  });
  assert.ok(blocked);
  assert.deepEqual(blocked.recoveryIds, [recoveryId]);
  const cleanupBlocked = inspectProjectRuntimeIntegrationResult({
    ...integrationResult(),
    status: "blocked",
    reason: "project_runtime_candidate_base_cleanup_unconfirmed",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    recoveryIds: [],
    effectIssued: false,
    effectStateUnknown: false,
    retryAllowed: false,
  });
  assert.ok(cleanupBlocked);
  assert.equal(cleanupBlocked.recoveryIds.length, 0);
  assert.equal(cleanupBlocked.effectIssued, false);
  const effectUnknown = inspectProjectRuntimeIntegrationResult({
    ...integrationResult(),
    status: "blocked",
    reason: "repository_runtime_data_ignore_registration_blocked",
    cleanupConfirmed: true,
    manualRecoveryRequired: true,
    recoveryIds: [recoveryId],
    effectIssued: true,
    effectStateUnknown: true,
    retryAllowed: false,
  });
  assert.ok(effectUnknown);
  assert.deepEqual(effectUnknown.recoveryIds, [recoveryId]);
  assert.equal(effectUnknown.cleanupConfirmed, true);
  assert.equal(effectUnknown.effectStateUnknown, true);
});

/**
 * 統合結果は成功とRecoveryの矛盾・重複・未知fieldを拒否するを検証する。
 *
 * @responsibility 統合結果は成功とRecoveryの矛盾・重複・未知fieldを拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 統合結果は成功とRecoveryの矛盾・重複・未知fieldを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("統合結果は成功とRecoveryの矛盾・重複・未知fieldを拒否する", () => {
  const recoveryId = "runtime-process.recovery-1";
  assert.equal(
    inspectProjectRuntimeIntegrationResult({
      ...integrationResult(),
      recoveryIds: [recoveryId],
    }),
    null,
  );
  for (const invalidBoundary of [
    {
      effectIssued: false,
      effectStateUnknown: true,
      retryAllowed: false,
      cleanupConfirmed: true,
      manualRecoveryRequired: true,
      recoveryIds: [recoveryId],
    },
    {
      effectIssued: true,
      effectStateUnknown: true,
      retryAllowed: true,
      cleanupConfirmed: true,
      manualRecoveryRequired: true,
      recoveryIds: [recoveryId],
    },
    {
      effectIssued: true,
      effectStateUnknown: true,
      retryAllowed: false,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      recoveryIds: [recoveryId],
    },
  ])
    assert.equal(
      inspectProjectRuntimeIntegrationResult({
        ...integrationResult(),
        status: "blocked",
        reason: "integration_boundary_invalid",
        ...invalidBoundary,
      }),
      null,
    );
  assert.equal(
    inspectProjectRuntimeIntegrationResult({
      ...integrationResult(),
      status: "blocked",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      recoveryIds: [recoveryId, recoveryId],
    }),
    null,
  );
  assert.equal(
    inspectProjectRuntimeIntegrationResult({
      ...integrationResult(),
      transportMetadata: "must-not-enter-public-contract",
    }),
    null,
  );
});
