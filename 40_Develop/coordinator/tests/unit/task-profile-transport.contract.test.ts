/**
 * 既定Task入力のProfileと通信Hashを閉じたConsumer契約で検査する。
 *
 * @packageDocumentation
 * @responsibility 合成の期待入力をConsumerが正規化し、Profile・Provider・通信Hashを保持することを確認する。
 * @trace PRL-UT-014
 * @level UT
 * @scope Objective SnapshotからCoordinator Task Requestまで。
 * @boundary N/A: Provider、公開CLIと永続Runtimeを起動しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectCoordinatorObjectiveRequest } from "../../src/index.ts";
import { snapshotCoordinatorTaskRequest } from "../../src/execution/task-request.ts";

const objective = Object.freeze({
  requestId: "request-1",
  projectId: "project-1",
  milestoneId: "milestone-1",
  repositoryRevision: "a".repeat(40),
  objective: "合成fixtureの搬送だけを確認する",
  acceptanceCriteria: Object.freeze(["外部処理を起動しない"]),
  allowedPaths: Object.freeze(["fixture.txt"]),
  readPaths: Object.freeze(["fixture.txt"]),
  maximumConcurrency: 1,
  maximumReplans: 0,
  originLane: "interactive" as const,
  adoptResult: false,
  intakeEpoch: "fixture-epoch",
});

/**
 * 明示Profileの全入力組合せをTaskの閉じた検査へ接続する。
 *
 * @responsibility 合成Task要求を実Consumerが正規化しProfile・Provider・Front・通信Hashを保持することを検証する。
 * @trace PRL-UT-014
 * @precondition 正常Objectiveと三つの任意項目、二つのFront Providerを使用する。
 * @stimulus 全八組合せと二種類のFrontを持つ合成Task要求を実Task入力検査へ渡す。
 * @observation Profile、Provider、Front Provider、複製配列と固定分類を確認する。
 * @oracle 明示IDはexact、省略はnullとして既存自動選択へ接続し、権限を追加しない。
 * @cleanup N/A: メモリ内の純粋関数だけを実行する。
 * @boundary N/A: 実Task、ProviderとHost資源を起動しない。
 */
test("Objective Profileは全八組合せで既存Task契約へexactに搬送する", () => {
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
  for (const frontProvider of ["codex", "claude"] as const) {
    for (let mask = 0; mask < 8; mask += 1) {
      const request = inspectCoordinatorObjectiveRequest(
        Object.assign(
          { ...objective },
          ...optionalFieldNames.filter(
            (_entry, index) => (mask & (1 << index)) !== 0,
          ),
        ),
      );
      assert.ok(request);
      const task = {
        frontProvider,
        requestedExecutorProvider: mask & 2 ? "codex" : "auto",
        ...(mask & 4 ? { requestedProfileId: "PROFILE-100001" } : {}),
        objective: request.objective,
        acceptanceCriteria: [...request.acceptanceCriteria],
        allowedPaths: [...request.allowedPaths],
        readPaths: [...request.readPaths],
        workClass: "bounded_implementation",
        planState: "complete",
        risk: "low",
        difficulty: "low",
        decisionImpact: "limited",
        isLocalCandidateOnly: true,
        hasUnresolvedDirection: false,
        requiresCrossContextAlignment: false,
      };
      const inspected = snapshotCoordinatorTaskRequest(task);
      const networkHash = "c".repeat(64);
      const withNetwork = snapshotCoordinatorTaskRequest({
        ...task,
        expectedNetworkPolicyHash: networkHash,
      });
      assert.equal(withNetwork?.status, "accepted");
      if (withNetwork?.status !== "accepted") assert.fail("network_rejected");
      assert.equal(withNetwork.request.expectedNetworkPolicyHash, networkHash);
      assert.equal(
        snapshotCoordinatorTaskRequest({
          ...task,
          expectedNetworkPolicyHash: "invalid",
        }),
        null,
      );
      assert.equal(inspected?.status, "accepted");
      assert.ok(inspected?.status === "accepted");
      const snapshot = inspected.request;
      assert.equal(
        snapshot.requestedProfileId,
        mask & 4 ? "PROFILE-100001" : null,
      );
      assert.equal(
        snapshot.requestedExecutorProvider,
        mask & 2 ? "codex" : "auto",
      );
      assert.equal(snapshot.frontProvider, frontProvider);
      assert.equal(Object.hasOwn(task, "requestedProfileId"), (mask & 4) !== 0);
      assert.notEqual(task.acceptanceCriteria, request.acceptanceCriteria);
      assert.deepEqual(task.allowedPaths, request.allowedPaths);
      assert.ok(Object.isFrozen(snapshot));
      assert.equal(Object.hasOwn(task, "selectionGrant"), false);
      assert.equal(Object.hasOwn(task, "decisionCapabilityReplacement"), false);
    }
  }
});
