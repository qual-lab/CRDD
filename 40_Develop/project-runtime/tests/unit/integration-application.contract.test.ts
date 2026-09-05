import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProjectRuntimeIntegrationContract,
  integrateProjectRuntimeOperation,
} from "../../src/index.ts";

test("統合Applicationは状態またはQueueを観測できない場合に外部Effect前で停止する", async () => {
  let candidateCalls = 0;
  const blocked = Object.freeze({
    status: "blocked" as const,
    reason: "state_observation_unknown",
    value: null,
    manualRecoveryRequired: true,
    recoveryId: null,
  });
  const result = await integrateProjectRuntimeOperation(
    {
      candidate: {
        createCandidate: async () => {
          candidateCalls += 1;
          return null;
        },
        observeCanonicalRepository: () => null,
        adoptCandidate: async () => null,
      },
      records: { write: () => blocked },
      persistence: {
        state: {
          readState: () => blocked,
          readQueue: () => blocked,
          writeState: () => blocked,
          enqueueOperation: () => blocked,
          selectNextOperation: () => blocked,
          updateQueue: () => blocked,
          settleQueueRecovery: () => blocked,
          settleQueueLeaseRelease: () => blocked,
        },
        lease: {
          acquire: () => blocked,
          inspectAcquisitionOwner: () => blocked,
          reconcileOperationOwnerLoss: () => blocked,
          reconcileAdoptionOwnerLoss: () => blocked,
        },
      },
    },
    {
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      allowedPaths: ["result.txt"],
      adoptionAuthorized: false,
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "project_runtime_integration_observation_unknown",
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(candidateCalls, 0);
});

test("統合Applicationの説明は候補生成と採用を別Effectとして公開する", () => {
  assert.deepEqual(describeProjectRuntimeIntegrationContract(), {
    contract: "crdd-coordinator/project-runtime-integration/v1",
    taskPassImpliesAcceptance: false,
    candidateAndAdoptionEffectsSeparated: true,
    canonicalAdoptionRequiresFreshRevisionAndScope: true,
    immutableIntegrationAndAdoptionRecords: true,
  });
});
