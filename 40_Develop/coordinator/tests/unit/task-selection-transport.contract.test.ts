/**
 * 既定Task入力の固定選定と通信Hashを閉じたConsumer契約で検査する。
 *
 * @packageDocumentation
 * @responsibility 合成の期待入力をConsumerが正規化し、固定選定・Provider・通信Hashを保持することを確認する。
 * @trace PRL-UT-014
 * @level UT
 * @scope Objective SnapshotからCoordinator Task Requestまで。
 * @boundary N/A: Provider、公開CLIと永続Runtimeを起動しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { selectionConfig } from "../fixtures/ai-selection.ts";
import { resolveTaskExecutionSelections } from "../../src/selection/resolve.ts";
import { buildObjectiveTaskRequest } from "../../src/objective/execute.ts";
import { inspectCoordinatorObjectiveRequest } from "../../src/index.ts";
import { snapshotCoordinatorTaskRequest } from "../../src/execution/request.ts";

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
 * 明示固定選定の全入力組合せをTaskの閉じた検査へ接続する。
 *
 * @responsibility 合成Task要求を実Consumerが正規化し、完全選定・Provider・通信Hashを保持することを検証する。
 * @trace PRL-UT-014
 * @precondition 正常Objectiveと分類・明示choice・判断差替えの三任意項目を使用する。
 * @stimulus 三任意項目の全八組合せを実Task入力検査へ渡す。
 * @observation 完全選定、Provider、通信Hashと複製配列を確認する。
 * @oracle 受付で固定した選定と通信HashがTaskへ無変換で搬送され、権限を追加しない。
 * @cleanup N/A: メモリ内の純粋関数だけを実行する。
 * @boundary N/A: 実Task、ProviderとHost資源を起動しない。
 */
test("Objectiveの固定選定は全八組合せでTask契約へexactに搬送する", () => {
  for (let mask = 0; mask < 8; mask++) {
    const raw = {
      ...objective,
      ...(mask & 2 ? { workType: "coding" } : {}),
      ...(mask & 4
        ? { choice: { provider: "codex", model: "gpt-5.5", effort: "low" } }
        : {}),
      ...(mask & 1
        ? {
            decisionCapabilityReplacement: {
              decisionId: "decision-1",
              replacementRequestId: "request-2",
            },
          }
        : {}),
    };
    const request = inspectCoordinatorObjectiveRequest(raw);
    assert.ok(request);
    const selected = resolveTaskExecutionSelections(selectionConfig(), {
      workType: request.workType ?? null,
      ...(request.choice ? { choice: request.choice } : {}),
    });
    assert.equal(selected.status, "resolved");
    if (selected.status !== "resolved") assert.fail("selection_rejected");
    const task = buildObjectiveTaskRequest(request, selected.value);
    const normalized = snapshotCoordinatorTaskRequest(task);
    assert.equal(normalized?.status, "accepted");
    if (normalized?.status !== "accepted") assert.fail("task_rejected");
    assert.deepEqual(
      normalized.request.taskExecutionSelections,
      selected.value,
    );
    assert.notEqual(task.acceptanceCriteria, request.acceptanceCriteria);
    assert.deepEqual(task.allowedPaths, request.allowedPaths);
    assert.equal(Object.isFrozen(normalized.request), true);
    const networkHash = "c".repeat(64);
    const network = snapshotCoordinatorTaskRequest({
      ...task,
      expectedNetworkPolicyHash: networkHash,
    });
    assert.equal(network?.status, "accepted");
    if (network?.status !== "accepted") assert.fail("network_rejected");
    assert.equal(network.request.expectedNetworkPolicyHash, networkHash);
    assert.equal(
      snapshotCoordinatorTaskRequest({
        ...task,
        expectedNetworkPolicyHash: "invalid",
      }),
      null,
    );
    for (const field of [
      "requestedProfileId",
      "requestedExecutorProvider",
      "frontProvider",
    ])
      assert.equal(
        snapshotCoordinatorTaskRequest({ ...task, [field]: "legacy" }),
        null,
      );
    assert.equal(Object.hasOwn(task, "decisionCapabilityReplacement"), false);
  }
});
