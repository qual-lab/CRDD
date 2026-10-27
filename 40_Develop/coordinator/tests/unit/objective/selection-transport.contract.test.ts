/**
 * 公開Objectiveから固定選定をTask入力へ搬送する責務を検証する。
 *
 * @packageDocumentation
 * @responsibility 純粋builderが保存選定を保持し、再選定と権限生成を行わないことを確認する。
 * @trace PRL-UT-014
 * @level UT
 * @scope Objectiveの固定選定から単発Task要求の生成まで。
 * @boundary N/A: Provider、公開CLIと永続Runtimeを起動しない。
 */
import assert from "node:assert/strict";
import { withCallerPlan } from "../../../../domain-model/tests/fixtures/execution-plan.ts";
import test from "node:test";
import { inspectCoordinatorObjectiveRequest } from "../../../src/index.ts";
import { buildObjectiveTaskRequest } from "../../../src/objective/execute.ts";
import { resolveTaskExecutionSelections } from "../../../src/selection/resolve.ts";
import { selectionConfig } from "../../fixtures/ai-selection.ts";

const objective = Object.freeze(
  withCallerPlan({
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
  }),
);

/**
 * 分類と明示選択の全入力組合せを固定選定の搬送へ接続する。
 *
 * @responsibility 公開Objectiveの検査後にbuilderが完全選定をTask要求へ保持することを検証する。
 * @trace PRL-UT-014
 * @precondition 正常Objective、三つの任意項目と二Providerの技術対応済み選択を使用する。
 * @stimulus 全八組合せを公開検査、選定とbuilderへ渡す。
 * @observation 二役割の完全値、複製配列と旧fieldの不存在を確認する。
 * @oracle 同じ受付の選定だけを搬送し、Front Providerによる再選定や権限を追加しない。
 * @cleanup N/A: メモリ内の純粋関数だけを実行する。
 * @boundary N/A: 実Task、ProviderとHost資源を起動しない。
 */
test("Objective選定は全八組合せでTask契約へexactに搬送する", () => {
  for (const choice of [
    { provider: "codex", model: "gpt-5.5", effort: "high" },
    { provider: "claude", model: "opus", effort: "high" },
  ] as const) {
    const optionalFieldNames = [
      {
        decisionCapabilityReplacement: {
          decisionId: "decision-1",
          replacementRequestId: "request-2",
        },
      },
      { workType: "coding" },
      { choice },
    ];
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
      const resolved = resolveTaskExecutionSelections(selectionConfig(), {
        workType: request.workType ?? null,
        ...(request.choice ? { choice: request.choice } : {}),
      });
      assert.ok(resolved.value);
      const task = buildObjectiveTaskRequest(request, resolved.value);
      const snapshot = task;
      assert.deepEqual(snapshot.taskExecutionSelections, resolved.value);
      assert.equal(
        snapshot.taskExecutionSelections.executor.provider,
        mask & 4 ? choice.provider : "codex",
      );
      assert.equal(Object.hasOwn(task, "frontProvider"), false);
      assert.equal(Object.hasOwn(task, "requestedProfileId"), false);
      assert.notEqual(task.acceptanceCriteria, request.acceptanceCriteria);
      assert.deepEqual(task.allowedPaths, request.allowedPaths);
      assert.ok(Object.isFrozen(task));
      assert.ok(Object.isFrozen(task.acceptanceCriteria));
      assert.ok(Object.isFrozen(task.allowedPaths));
      assert.equal(Object.hasOwn(task, "selectionGrant"), false);
      assert.equal(Object.hasOwn(task, "decisionCapabilityReplacement"), false);
    }
  }
});
