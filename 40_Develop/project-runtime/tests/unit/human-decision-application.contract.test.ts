import assert from "node:assert/strict";
import test from "node:test";

import {
  issueProjectRuntimeHumanDecision,
  type ProjectRuntimePortResult,
} from "../../src/index.ts";

function unavailable<T>(): ProjectRuntimePortResult<T> {
  return Object.freeze({
    status: "blocked",
    reason: "not_used",
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
}

test("判断Applicationは秘密値をStoreへ保存せず一回限りCapabilityを発行する", () => {
  let storedHash: string | null = null;
  let storedJson = "";
  const result = issueProjectRuntimeHumanDecision(
    {
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      principalId: "principal-a",
      capability: {
        issue: () => ({ secret: "secret-a", hash: "a".repeat(64) }),
        hash: () => "a".repeat(64),
      },
      store: {
        create: (record) => {
          storedHash = record.capabilityHash;
          storedJson = JSON.stringify(record);
          return { status: "completed", value: record };
        },
        read: () => null,
        compareAndSet: () => null,
      },
      persistence: {
        state: {
          writeState: unavailable,
          readState: unavailable,
          enqueueOperation: unavailable,
          readQueue: unavailable,
          selectNextOperation: unavailable,
          updateQueue: unavailable,
          settleQueueRecovery: unavailable,
          settleQueueLeaseRelease: unavailable,
        },
        lease: {
          acquire: unavailable,
          inspectAcquisitionOwner: unavailable,
          reconcileOperationOwnerLoss: unavailable,
          reconcileAdoptionOwnerLoss: unavailable,
        },
      },
    },
    {
      decisionId: "decision-a",
      repositoryRevision: "b".repeat(40),
      expectedGeneration: 1,
      allowedOptions: ["resume"],
      lifetimeMs: 60_000,
      nowEpochMs: 1_000,
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(
    result.status === "completed" && result.continuationCapability,
    "secret-a",
  );
  assert.equal(storedHash, "a".repeat(64));
  assert.equal(storedJson.includes("secret-a"), false);
});
