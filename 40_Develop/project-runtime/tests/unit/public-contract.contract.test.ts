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

test("Execution Portは既存Single Task結果契約を意味変更せず所有する", () => {
  assert.equal(
    PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT,
    "crdd-coordinator/project-runtime-single-task-adapter",
  );
  assert.equal(PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION, 2);
});

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
});

test("統合結果は成功とRecoveryの矛盾・重複・未知fieldを拒否する", () => {
  const recoveryId = "runtime-process.recovery-1";
  assert.equal(
    inspectProjectRuntimeIntegrationResult({
      ...integrationResult(),
      recoveryIds: [recoveryId],
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
