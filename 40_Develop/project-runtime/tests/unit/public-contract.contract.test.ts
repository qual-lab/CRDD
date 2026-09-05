import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectProjectRuntimeIntegrationResult,
  inspectProjectRuntimeObjectiveRequest,
  PROJECT_RUNTIME_INTEGRATION_CONTRACT,
} from "../../src/index.ts";

const repositoryRevision = "a".repeat(40);

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

test("Objective要求は閉じた公開契約へsnapshotする", () => {
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
