/**
 * project-runtime:unit:human-decision-applicationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility project-runtime:unit:human-decision-applicationが所有する検証責務を実行する。
 * @trace PRL-UT-007
 * @level UT
 * @scope project-runtime、human-decision、application
 * @boundary PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  issueProjectRuntimeHumanDecision,
  type ProjectRuntimePortResult,
} from "../../src/index.ts";

/**
 * unavailableのTest準備責務を実行する。
 *
 * @responsibility unavailableがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-007
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus unavailableを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */
function unavailable<T>(): ProjectRuntimePortResult<T> {
  return Object.freeze({
    status: "blocked",
    reason: "not_used",
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
}

/**
 * 判断Applicationは秘密値をStoreへ保存せず一回限りCapabilityを発行するを検証する。
 *
 * @responsibility 判断Applicationは秘密値をStoreへ保存せず一回限りCapabilityを発行するの合否判定を所有する。
 * @trace PRL-UT-007
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断Applicationは秘密値をStoreへ保存せず一回限りCapabilityを発行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */
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
