/**
 * orchestrator:unit:public-contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:public-contractが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope project、runtime、public、contract
 * @boundary PRL-UT-014=N/A: Orchestrator Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectOrchestratorDecisionRequest,
  ORCHESTRATOR_HUMAN_DECISION_CONTRACT,
} from "../../src/decision/request.ts";
import {
  inspectOrchestratorIntegrationResult,
  ORCHESTRATOR_INTEGRATION_CONTRACT,
} from "../../src/candidate/integration-result.ts";
import { inspectOrchestratorObjectiveRequest } from "../../src/objective/request.ts";
import { isOrchestratorDecisionRecord } from "../../src/decision/records.ts";
import { ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT } from "../../src/operation-result-contract.ts";
import {
  ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
} from "../../src/task/executor.ts";

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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Execution Portは既存Single Task結果契約を意味変更せず所有する", () => {
  assert.equal(
    ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT,
    "crdd-coordinator/orchestrator-single-task-adapter",
  );
  assert.equal(ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION, 2);
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
function objectiveRequest() {
  return {
    requestId: "request-1",
    projectId: "project-1",
    milestoneId: "milestone-1",
    repositoryRevision,
    objective: "公開契約を検証する",
    acceptanceCriteria: ["閉じた入力だけを受理する"],
    allowedPaths: ["40_Develop/orchestrator"],
    readPaths: ["06_Architecture/orchestrator"],
    maximumConcurrency: 2,
    maximumReplans: 1,
    originLane: "interactive",
    adoptResult: false,
    intakeEpoch: "fixture-epoch",
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
function integrationResult() {
  return {
    contract: ORCHESTRATOR_INTEGRATION_CONTRACT,
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Objective要求は閉じた公開契約へsnapshotする", () => {
  assert.equal(
    ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
    "crdd-coordinator/orchestrator-public-runtime/v1",
  );
  const source = objectiveRequest();
  const inspected = inspectOrchestratorObjectiveRequest(source);
  assert.ok(inspected);
  assert.notEqual(inspected, source);
  assert.ok(Object.isFrozen(inspected));
  assert.ok(Object.isFrozen(inspected.acceptanceCriteria));
});

/**
 * Objectiveの任意三項目を全組合せで固定する。
 *
 * @responsibility 明示Profileのexact搬送と省略時の非生成を全八組合せで検証する。
 * @trace PRL-UT-014
 * @precondition 正常なObjectiveと三つの任意入力を使用する。
 * @stimulus 三項目の有無を全八組合せで入力検査へ渡す。
 * @observation Snapshot全体、Profile ID、所有Propertyと不変性を確認する。
 * @oracle 同じ入力だけが固定され、省略したProfileを補完しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary N/A: 純粋な入力検査。
 */
test("Objectiveの任意三項目は全八組合せでexactにsnapshotする", () => {
  const optionalFieldNames = [
    {
      decisionCapabilityReplacement: {
        decisionId: "decision-1",
        replacementRequestId: "request-2",
      },
    },
    { requestedExecutorProvider: "codex" },
    { requestedProfileId: "PROFILE-100001" },
  ];
  for (let mask = 0; mask < 8; mask += 1) {
    const source = Object.assign(
      { ...objectiveRequest() },
      ...optionalFieldNames.filter(
        (_entry, index) => (mask & (1 << index)) !== 0,
      ),
    );
    const inspected = inspectOrchestratorObjectiveRequest(source);
    assert.ok(inspected, `mask=${mask}`);
    assert.deepEqual(inspected, source);
    assert.equal(
      Object.hasOwn(inspected, "requestedProfileId"),
      (mask & 4) !== 0,
    );
    assert.ok(Object.isFrozen(inspected));
  }
  const source = {
    ...objectiveRequest(),
    requestedProfileId: "PROFILE-999999",
  };
  const inspected = inspectOrchestratorObjectiveRequest(source);
  assert.ok(inspected); // 形式受理は登録済み・利用可能の証明ではない。
  source.requestedProfileId = "PROFILE-100002";
  assert.equal(inspected.requestedProfileId, "PROFILE-999999");
});

/**
 * 不正Profileと動的入力を評価前に拒否する。
 *
 * @responsibility Profileの型・形式・閉じた形と非実行拒否を検証する。
 * @trace PRL-UT-014
 * @precondition 不正値、getterとProxy trapを持つ合成入力を使用する。
 * @stimulus Objective入力検査へ各入力を渡す。
 * @observation 拒否結果とgetter／trap呼出し件数を確認する。
 * @oracle 全件null、getter／trap呼出し0で、未知fieldも拒否する。
 * @cleanup N/A: メモリ内の入力だけを使用する。
 * @boundary N/A: 純粋な入力検査。
 */
test("ObjectiveのProfileは不正形式・Accessor・Proxyを実行せず拒否する", () => {
  for (const requestedProfileId of [
    undefined,
    null,
    1,
    {},
    "",
    "PROFILE-12345",
    "profile-100001",
    "PROFILE-100001\n",
    "PROFILE-100001/other",
  ]) {
    assert.equal(
      inspectOrchestratorObjectiveRequest({
        ...objectiveRequest(),
        requestedProfileId,
      }),
      null,
    );
  }
  let calls = 0;
  const accessor = Object.defineProperty(
    { ...objectiveRequest() },
    "requestedProfileId",
    {
      enumerable: true,
      get: () => {
        calls += 1;
        return "PROFILE-100001";
      },
    },
  );
  const proxy = new Proxy(
    { ...objectiveRequest(), requestedProfileId: "PROFILE-100001" },
    {
      ownKeys: () => {
        calls += 1;
        throw new Error("trap must not execute");
      },
      getPrototypeOf: () => {
        calls += 1;
        throw new Error("trap must not execute");
      },
    },
  );
  assert.equal(inspectOrchestratorObjectiveRequest(accessor), null);
  assert.equal(inspectOrchestratorObjectiveRequest(proxy), null);
  assert.equal(calls, 0);
  assert.equal(
    inspectOrchestratorObjectiveRequest({
      ...objectiveRequest(),
      requestedProfileId: "PROFILE-100001",
      selectionGrant: "not-authority",
    }),
    null,
  );
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Objective要求は未知field・accessor・ProxyをEffect前に拒否する", () => {
  assert.equal(
    inspectOrchestratorObjectiveRequest({ ...objectiveRequest(), extra: 1 }),
    null,
  );
  assert.equal(
    inspectOrchestratorObjectiveRequest(
      Object.defineProperty({ ...objectiveRequest() }, "objective", {
        get: () => "shape-shifting",
        enumerable: true,
      }),
    ),
    null,
  );
  assert.equal(
    inspectOrchestratorObjectiveRequest(new Proxy(objectiveRequest(), {})),
    null,
  );
  const symbolExtended = { ...objectiveRequest() } as Record<
    PropertyKey,
    unknown
  >;
  symbolExtended[Symbol("hidden")] = true;
  assert.equal(inspectOrchestratorObjectiveRequest(symbolExtended), null);
  const nonEnumerableExtended = Object.defineProperty(
    { ...objectiveRequest() },
    "hidden",
    { value: true },
  );
  assert.equal(
    inspectOrchestratorObjectiveRequest(nonEnumerableExtended),
    null,
  );
  const alteredCriteria = [...objectiveRequest().acceptanceCriteria];
  Object.setPrototypeOf(alteredCriteria, null);
  assert.equal(
    inspectOrchestratorObjectiveRequest({
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
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
      inspectOrchestratorObjectiveRequest({
        ...objectiveRequest(),
        allowedPaths: [pathValue],
      }),
      null,
    );
    assert.equal(
      inspectOrchestratorObjectiveRequest({
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("判断要求はTransportに依存しない閉じた公開契約へsnapshotする", () => {
  assert.equal(
    ORCHESTRATOR_HUMAN_DECISION_CONTRACT,
    "crdd-coordinator/orchestrator-human-decision/v1",
  );
  const source = decisionRequest();
  const inspected = inspectOrchestratorDecisionRequest(source);
  assert.ok(inspected);
  assert.notEqual(inspected, source);
  assert.ok(Object.isFrozen(inspected));
  assert.equal(inspected.selectedOption, "resume");
});

/**
 * 判断Store RecordはOrchestratorの閉じた意味契約で検証するを検証する。
 *
 * @responsibility 判断Store RecordはOrchestratorの閉じた意味契約で検証するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断Store RecordはOrchestratorの閉じた意味契約で検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("判断Store RecordはOrchestratorの閉じた意味契約で検証する", () => {
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
  assert.equal(isOrchestratorDecisionRecord(record), true);
  assert.equal(
    isOrchestratorDecisionRecord({ ...record, provider: "codex" }),
    false,
  );
  assert.equal(
    isOrchestratorDecisionRecord({
      ...record,
      disposition: "completed",
    }),
    false,
  );
  assert.equal(
    isOrchestratorDecisionRecord({
      ...record,
      selectedOption: "resume",
      newGeneration: 1,
    }),
    false,
  );
  assert.equal(
    isOrchestratorDecisionRecord(
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("判断要求は未知field・改行comment・不正世代をEffect前に拒否する", () => {
  assert.equal(
    inspectOrchestratorDecisionRequest({ ...decisionRequest(), extra: 1 }),
    null,
  );
  assert.equal(
    inspectOrchestratorDecisionRequest({
      ...decisionRequest(),
      comment: "line1\nline2",
    }),
    null,
  );
  assert.equal(
    inspectOrchestratorDecisionRequest({
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("統合結果は正常完了とRecovery付き停止を区別する", () => {
  const completed = inspectOrchestratorIntegrationResult(integrationResult());
  assert.ok(completed);
  assert.equal(completed.status, "completed");
  const recoveryId = "runtime-process.recovery-1";
  const blocked = inspectOrchestratorIntegrationResult({
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
  const cleanupBlocked = inspectOrchestratorIntegrationResult({
    ...integrationResult(),
    status: "blocked",
    reason: "orchestrator_candidate_base_cleanup_unconfirmed",
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
  const effectUnknown = inspectOrchestratorIntegrationResult({
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
 * @boundary PRL-UT-014=Direct Boundary: orchestrator Test Source→対象契約
 */
test("統合結果は成功とRecoveryの矛盾・重複・未知fieldを拒否する", () => {
  const recoveryId = "runtime-process.recovery-1";
  assert.equal(
    inspectOrchestratorIntegrationResult({
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
      inspectOrchestratorIntegrationResult({
        ...integrationResult(),
        status: "blocked",
        reason: "integration_boundary_invalid",
        ...invalidBoundary,
      }),
      null,
    );
  assert.equal(
    inspectOrchestratorIntegrationResult({
      ...integrationResult(),
      status: "blocked",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      recoveryIds: [recoveryId, recoveryId],
    }),
    null,
  );
  assert.equal(
    inspectOrchestratorIntegrationResult({
      ...integrationResult(),
      transportMetadata: "must-not-enter-public-contract",
    }),
    null,
  );
});
