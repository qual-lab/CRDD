/**
 * project-runtime:unit:integration-applicationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility project-runtime:unit:integration-applicationが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope project-runtime、integration、application
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProjectRuntimeIntegrationContract,
  integrateProjectRuntimeOperation,
} from "../../src/index.ts";

/**
 * 統合Applicationは状態またはQueueを観測できない場合に外部Effect前で停止するを検証する。
 *
 * @responsibility 統合Applicationは状態またはQueueを観測できない場合に外部Effect前で停止するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 統合Applicationは状態またはQueueを観測できない場合に外部Effect前で停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
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

/**
 * 統合Applicationの説明は候補生成と採用を別Effectとして公開するを検証する。
 *
 * @responsibility 統合Applicationの説明は候補生成と採用を別Effectとして公開するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 統合Applicationの説明は候補生成と採用を別Effectとして公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("統合Applicationの説明は候補生成と採用を別Effectとして公開する", () => {
  assert.deepEqual(describeProjectRuntimeIntegrationContract(), {
    contract: "crdd-coordinator/project-runtime-integration/v1",
    taskPassImpliesAcceptance: false,
    candidateAndAdoptionEffectsSeparated: true,
    canonicalAdoptionRequiresFreshRevisionAndScope: true,
    immutableIntegrationAndAdoptionRecords: true,
  });
});
