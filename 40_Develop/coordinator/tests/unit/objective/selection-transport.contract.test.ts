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
import test from "node:test";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { compileFunction } from "node:vm";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { isPrincipalId } from "../../../../execution-model/src/index.ts";
import { inspectCoordinatorObjectivePlan } from "../../../src/objective/plan.ts";
import { withCallerPlan } from "../../../../execution-model/tests/fixtures/execution-plan.ts";

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
 * @stimulus 全四組合せを公開検査、選定とbuilderへ渡す。
 * @observation 二役割の完全値、複製配列と旧fieldの不存在を確認する。
 * @oracle 同じ受付の選定だけを搬送し、Front Providerによる再選定や権限を追加しない。
 * @cleanup N/A: メモリ内の純粋関数だけを実行する。
 * @boundary N/A: 実Task、ProviderとHost資源を起動しない。
 */
test("Objective選定は全四組合せでTask契約へexactに搬送する", () => {
  for (const choice of [
    { provider: "codex", model: "gpt-5.5", effort: "high" },
    { provider: "claude", model: "opus", effort: "high" },
  ] as const) {
    const optionalFieldNames = [{ workType: "coding" }, { choice }];
    for (let mask = 0; mask < 4; mask += 1) {
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
      assert.equal(snapshot.taskExecutionSelections, resolved.value);
      assert.equal(
        snapshot.taskExecutionSelections.executor.provider,
        mask & 2 ? choice.provider : "codex",
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

import { inspectCoordinatorObjectiveRequest } from "../../../src/objective/plan.ts";

/**
 * 同じ受付が捕捉した計画と、別参照の依存返却値を区別する。
 * @responsibility exact参照だけを再利用し、別値の検査・例外時停止を維持する。
 * @trace PRL-UT-014
 * @precondition 公開受付の実検査で独立・凍結した要求を使用する。
 * @stimulus exact計画、同値別Object、範囲外、getter、Proxy、null、例外を返す。
 * @observation 計画検査回数、内部実行への搬送値と停止理由。
 * @oracle exactだけ再検査0。別参照は検査1。不正値は実行0、hook0。
 * @cleanup 値のみ。保存・Process・外部実行を発行しない。
 * @boundary 受付済み要求と未信頼の計画依存。
 */
test("受付計画はexact参照だけ再利用し別参照と不正返却を検査する", async () => {
  const request = inspectCoordinatorObjectiveRequest(objective);
  assert.ok(request);
  const source = fs.readFileSync(
    new URL("../../../src/objective/execute.ts", import.meta.url),
    "utf8",
  );
  let inspections = 0;
  let executions = 0;
  let delivered: unknown;
  const run = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "executeAcceptedCoordinatorObjective"))});`,
    [
      "isPrincipalId",
      "blocked",
      "inspectBinding",
      "inspectCoordinatorObjectivePlan",
      "createCoordinatorExecutionHostPorts",
      "createCoordinatorSnapshotPersistencePorts",
      "createCoordinatorTaskRecoveryAdapter",
      "executeCoordinatorObjective",
    ],
  )(
    isPrincipalId,
    (_request: unknown, reason: string) => ({ status: "blocked", reason }),
    () => ({
      repositoryBindingId: "binding",
      repositoryRoot: {},
      workingDirectory: {},
      bindingCapability: {},
    }),
    (raw: unknown, accepted: typeof request) => {
      inspections += 1;
      return inspectCoordinatorObjectivePlan(raw, accepted);
    },
    () => ({
      clockIdentity: {
        createStableId: () => "queue",
        createContentHash: () => "hash",
      },
    }),
    () => ({}),
    () => ({}),
    async (dependencies: { plan: unknown }) => {
      executions += 1;
      delivered = dependencies.plan;
      return { status: "blocked", reason: "finite_execution_reached" };
    },
  ) as (
    dependencies: {
      authenticatedPrincipalId: string;
      verifyProjectBinding: () => object;
      planObjective: () => unknown;
    },
    accepted: typeof request,
    signal: AbortSignal,
  ) => Promise<{ reason: string }>;
  let hooks = 0;
  const copy = JSON.parse(JSON.stringify(request.plan));
  const outside = {
    ...copy,
    tasks: copy.tasks.map((task: object) => ({
      ...task,
      allowedPaths: ["outside.txt"],
    })),
  };
  const accessor = {
    ...copy,
    get tasks() {
      hooks += 1;
      return copy.tasks;
    },
  };
  const proxy = new Proxy(copy, {
    ownKeys() {
      hooks += 1;
      return [];
    },
  });
  for (const [value, valid] of [
    [request.plan, true],
    [copy, true],
    [outside, false],
    [accessor, false],
    [proxy, false],
    [null, false],
    [new Error("planner_failed"), false],
  ] as const) {
    inspections = 0;
    executions = 0;
    delivered = null;
    const result = await run(
      {
        authenticatedPrincipalId: "principal-a",
        verifyProjectBinding: () => ({}),
        planObjective: () => {
          if (value instanceof Error) throw value;
          return value;
        },
      },
      request,
      new AbortController().signal,
    );
    assert.equal(inspections, value === request.plan ? 0 : 1);
    assert.equal(executions, valid ? 1 : 0);
    assert.equal(
      result.reason,
      valid
        ? "finite_execution_reached"
        : "orchestrator_plan_invalid_or_out_of_scope",
    );
    if (valid) assert.deepEqual(delivered, request.plan);
    if (value === request.plan) assert.equal(delivered, request.plan);
  }
  assert.equal(hooks, 0);
});
