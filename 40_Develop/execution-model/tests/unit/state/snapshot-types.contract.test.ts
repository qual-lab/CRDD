/**
 * 保存正本と二つの投影の型契約を展開前の独立Oracleへ照合する。
 * @packageDocumentation
 * @responsibility 19fieldの対応、nullable・readonly・optionalと投影の差を保持する。
 * @trace PRL-UT-006
 * @level UT
 * @scope TypeScript型適合とメモリ値だけ。型負例の関数は実行しない。
 * @boundary 保存・子Process・AI・Dockerは使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validState } from "../../../src/task/validation.ts";
import {
  captureTaskExecutionUpdate,
  observeTaskStartCandidates,
  prepareTaskExecutionUpdate,
  prepareTaskHandoff,
  prepareTaskOwnerLoss,
  prepareTaskPreEffectSettlement,
  prepareTaskRecoveryRetry,
  prepareTaskRecoverySettlement,
  prepareTaskRecoveryStart,
  prepareTaskReplan,
  prepareTaskRetry,
  prepareTaskSettlement,
  prepareTaskStart,
  prepareTaskStarted,
} from "../../../src/task/transition.ts";
import { projectExecutionFixture } from "../../fixtures/execution-plan.ts";

/**
 * 通常終端の清掃・候補・義務と依存更新を独立した値で反証する。
 * @trace PRL-UT-006
 * @precondition 実モデルの開始済み基底を一度だけ作る。
 * @stimulus 終了区分、清掃未確認、候補、重複義務と相関の差分を与える。
 * @observation 旧拒否理由、cleanup_pending、依存readyとObjectiveの未受入。
 * @oracle 清掃未確認を完了へせず、候補を他結果へ持ち越さない。
 * @cleanup メモリのみ。
 */
test("通常終端は清掃・候補・義務と完了依存の旧規則を維持する", () => {
  const running = runningStateForSettlement(
    schedulingStateFor([
      schedulingTask("task-a"),
      schedulingTask("task-b", ["task-a"]),
    ]),
    "task-a",
  );
  const before = structuredClone(running);
  const base = {
    taskId: "task-a",
    attemptId: "attempt-task-a",
    operationId: "operation-task-a",
    authorityBindingId: "authority-task-a",
    outcome: "completed" as const,
    cleanupConfirmed: true,
    recoveryObligations: [],
    recoveryUnresolved: false,
    candidateId: null,
  };
  const completed = prepareTaskSettlement(running, running.generation, base);
  const command = {
    ...base,
    kind: "task_settle",
    projectId: running.projectId,
    resultUnresolved: false,
  };
  assert.ok(captureTaskExecutionUpdate(command));
  assert.ok(
    captureTaskExecutionUpdate(
      Object.fromEntries(
        Object.entries(command).filter(([key]) => key !== "candidateId"),
      ),
    ),
  );
  assert.ok(captureTaskExecutionUpdate({ ...command, candidateId: undefined }));
  assert.equal(completed.status, "completed");
  assert.equal(completed.state.tasks[1]?.state, "ready");
  for (const outcome of ["completed", "cancelled"] as const)
    assert.equal(
      prepareTaskSettlement(running, running.generation, {
        ...base,
        outcome,
        cleanupConfirmed: false,
      }).reason,
      "coordinator_task_settlement_mismatch",
    );
  assert.equal(
    prepareTaskSettlement(running, running.generation, {
      ...base,
      outcome: "failed",
      cleanupConfirmed: false,
    }).state.tasks[0]?.state,
    "cleanup_pending",
  );
  assert.equal(
    prepareTaskSettlement(running, running.generation, {
      ...base,
      candidateId: "a".repeat(512),
    }).status,
    "completed",
  );
  assert.equal(
    prepareTaskSettlement(running, running.generation, {
      ...base,
      candidateId: "a".repeat(513),
    }).status,
    "blocked",
  );
  assert.equal(
    prepareTaskSettlement(running, running.generation, {
      ...base,
      outcome: "failed",
      candidateId: "candidate-a",
    }).status,
    "blocked",
  );
  const obligation = {
    kind: "candidate" as const,
    recoveryId: "candidate-recovery-a",
    phase: "required" as const,
  };
  assert.equal(
    prepareTaskSettlement(running, running.generation, {
      ...base,
      outcome: "recovery_required",
      recoveryObligations: [obligation, obligation],
    }).status,
    "blocked",
  );
  assert.equal(
    prepareTaskSettlement(running, running.generation, {
      ...base,
      outcome: "recovery_required",
      recoveryObligations: [],
    }).status,
    "blocked",
  );
  assert.equal(
    prepareTaskSettlement(running, running.generation, {
      ...base,
      outcome: "recovery_required",
      recoveryObligations: [],
      recoveryUnresolved: true,
    }).status,
    "completed",
  );
  const only = runningStateForSettlement(
    schedulingStateFor([schedulingTask("task-a")]),
    "task-a",
  );
  const oneCompleted = prepareTaskSettlement(only, only.generation, base);
  assert.equal(oneCompleted.state.objectives[0]?.state, "integration_pending");
  assert.equal(oneCompleted.state.milestone.state, "executing");
  assert.deepEqual(running, before);
});

/** 実モデルの開始3段階を一度ずつ通して終端試験の基底値を作る。 @trace PRL-UT-006 */
function runningStateForSettlement(
  state: ProjectExecutionState,
  taskId: string,
) {
  const reserved = prepareTaskStart(
    state,
    state.generation,
    taskId,
    `attempt-${taskId}`,
    `authority-${taskId}`,
  );
  assert.equal(reserved.status, "completed");
  const handoff = prepareTaskHandoff(
    reserved.state,
    reserved.state.generation,
    taskId,
    `attempt-${taskId}`,
    `operation-${taskId}`,
  );
  assert.equal(handoff.status, "completed");
  const running = prepareTaskStarted(
    handoff.state,
    handoff.state.generation,
    taskId,
    `attempt-${taskId}`,
    `operation-${taskId}`,
  );
  assert.equal(running.status, "completed");
  return running.state;
}

/**
 * Dependency完了後だけ後続Taskをreadyへ進めるを検証する。
 *
 * @responsibility Dependency完了後だけ後続Taskをreadyへ進めるの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Dependency完了後だけ後続Taskをreadyへ進めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→Task終端規則
 */
test("Dependency完了後だけ後続Taskをreadyへ進める", () => {
  let state = schedulingStateFor([
    schedulingTask("task-a"),
    schedulingTask("task-b", ["task-a"]),
  ]);
  state = runningStateForSettlement(state, "task-a");
  const settled = prepareTaskSettlement(state, state.generation, {
    taskId: "task-a",
    attemptId: "attempt-task-a",
    operationId: "operation-task-a",
    authorityBindingId: "authority-task-a",
    outcome: "completed",
    cleanupConfirmed: true,
    recoveryObligations: [],
    recoveryUnresolved: false,
  });
  assert.equal(settled.status, "completed");
  assert.ok(settled.state);
});

/**
 * cleanup不明のTaskを空き枠へ補正しないを検証する。
 *
 * @responsibility cleanup不明のTaskを空き枠へ補正しないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup不明のTaskを空き枠へ補正しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→Task終端規則
 */
test("cleanup不明のTaskを空き枠へ補正しない", () => {
  let state = schedulingStateFor(
    [schedulingTask("task-a"), schedulingTask("task-b")],
    1,
  );
  state = runningStateForSettlement(state, "task-a");
  const settled = prepareTaskSettlement(state, state.generation, {
    taskId: "task-a",
    attemptId: "attempt-task-a",
    operationId: "operation-task-a",
    authorityBindingId: "authority-task-a",
    outcome: "failed",
    cleanupConfirmed: false,
    recoveryObligations: [],
    recoveryUnresolved: false,
  });
  assert.equal(settled.status, "completed");
  assert.ok(settled.state);
});

/**
 * Recovery中はcleanup後も競合予約を維持するを検証する。
 *
 * @responsibility Recovery中はcleanup後も競合予約を維持するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery中はcleanup後も競合予約を維持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→Task終端規則
 */
test("Recovery中はcleanup後も競合予約を維持する", () => {
  let state = schedulingStateFor([
    schedulingTask("task-a", [], ["shared/file.txt"]),
    schedulingTask("task-b", [], ["shared/file.txt"]),
    schedulingTask("task-c"),
  ]);
  state = runningStateForSettlement(state, "task-a");
  const settled = prepareTaskSettlement(state, state.generation, {
    taskId: "task-a",
    attemptId: "attempt-task-a",
    operationId: "operation-task-a",
    authorityBindingId: "authority-task-a",
    outcome: "recovery_required",
    cleanupConfirmed: true,
    recoveryObligations: [
      {
        kind: "docker",
        recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
        phase: "required",
      },
    ],
    recoveryUnresolved: false,
  });
  assert.equal(settled.status, "completed");
  assert.ok(settled.state);
});

/**
 * 古い世代と別attemptの結果を反映しないを検証する。
 *
 * @responsibility 古い世代と別attemptの結果を反映しないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 古い世代と別attemptの結果を反映しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→Task終端規則
 */
test("古い世代と別attemptの結果を反映しない", () => {
  const initial = schedulingStateFor([schedulingTask("task-a")]);
  const state = runningStateForSettlement(initial, "task-a");
  assert.equal(
    prepareTaskSettlement(state, initial.generation, {
      taskId: "task-a",
      attemptId: "wrong-attempt",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    }).reason,
    "coordinator_task_settlement_mismatch",
  );
});

/**
 * 結果受領を追加せず用途結果をTask終端へ反映する。
 * @responsibility 正常・失敗・取消の状態を区別し、元Taskを変更しない。
 * @trace PRL-UT-006
 * @precondition 純粋モデルの開始済みTask。
 * @stimulus 同じ実行相関の終端結果を適用する。
 * @observation Task状態、技術確認値と受領fieldの不存在。
 * @oracle 技術確認を保って結果を適用し、ACK情報を生成しない。
 * @cleanup 外部資源なし。
 * @boundary Taskの純粋状態遷移。
 */
test("Task終端は結果受領を追加しない", () => {
  for (const outcome of ["completed", "failed", "cancelled"] as const) {
    const running = runningStateForSettlement(
      schedulingStateFor([schedulingTask("task-a")]),
      "task-a",
    );
    const settled = prepareTaskSettlement(running, running.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome,
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.equal(settled.status, "completed");
    assert.equal(settled.state?.tasks[0]?.state, outcome);
    assert.equal(settled.state?.tasks[0]?.cleanupConfirmed, true);
    assert.equal(
      Object.hasOwn(settled.state?.tasks[0] ?? {}, "resultAcceptances"),
      false,
    );
    assert.equal(running.tasks[0]?.state, "running");
  }
});

/**
 * 引渡し準備済みの開始前終端を元の相関・義務・同版更新へ結合する。
 * @trace PRL-UT-006
 * @precondition 開始予約と引渡しだけを一度準備し、各差分は独立した値にする。
 * @stimulus 三outcome、世代・実行相関・phase・義務差と再送を与える。
 * @observation Task、Objective、Milestone、世代と元値不変。
 * @oracle 未確認を成功へ補完せず、同内容の直後再送だけを候補へ戻す。
 * @cleanup メモリのみ。
 */
test("開始前終端は三結果の状態・相関と再送時の全文一致を維持する", () => {
  const initial = schedulingStateFor([schedulingTask("task-a")]);
  const reserved = prepareTaskStart(
    initial,
    initial.generation,
    "task-a",
    "attempt-a",
    "authority-a",
  );
  const prepared = prepareTaskHandoff(
    reserved.state,
    reserved.state.generation,
    "task-a",
    "attempt-a",
    "operation-a",
  ).state;
  const before = structuredClone(prepared);
  for (const outcome of ["failed", "cancelled", "recovery_required"] as const) {
    const input = {
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
      authorityBindingId: "authority-a",
      outcome,
      cleanupConfirmed: outcome !== "recovery_required",
      recoveryObligations:
        outcome === "recovery_required"
          ? [
              {
                kind: "candidate" as const,
                recoveryId: "candidate-recovery-a",
                phase: "required" as const,
              },
            ]
          : [],
      recoveryUnresolved: false,
    };
    const settled = prepareTaskPreEffectSettlement(
      prepared,
      prepared.generation,
      input,
    );
    assert.equal(settled.status, "completed");
    assert.equal(settled.state.generation, prepared.generation + 1);
    assert.equal(settled.state.tasks[0]?.state, outcome);
    assert.equal(settled.state.tasks[0]?.startPhase, "settled");
    assert.equal(settled.state.tasks[0]?.candidateId, null);
    assert.equal(
      settled.state.objectives[0]?.state,
      outcome === "cancelled" ? "cancelled" : "blocked",
    );
    assert.equal(
      settled.state.milestone.state,
      outcome === "failed" ? prepared.milestone.state : outcome,
    );
    assert.deepEqual(
      settled.state.tasks[0]?.recoveryObligations,
      input.recoveryObligations,
    );
    const request = {
      ...input,
      kind: "task_settle_before_effect" as const,
      projectId: prepared.projectId,
    };
    assert.ok(captureTaskExecutionUpdate(request));
    assert.equal(
      captureTaskExecutionUpdate({ ...request, candidateId: "extra" }),
      null,
    );
    assert.equal(
      prepareTaskExecutionUpdate(settled.state, prepared.generation, request)
        .status,
      "completed",
    );
    assert.equal(
      prepareTaskExecutionUpdate(settled.state, prepared.generation, {
        ...request,
        recoveryUnresolved: !request.recoveryUnresolved,
      }).status,
      "blocked",
    );
    assert.equal(
      prepareTaskPreEffectSettlement(prepared, prepared.generation + 1, input)
        .reason,
      "coordinator_pre_effect_settlement_mismatch",
    );
    for (const field of [
      "taskId",
      "attemptId",
      "operationId",
      "authorityBindingId",
    ] as const)
      assert.equal(
        prepareTaskPreEffectSettlement(prepared, prepared.generation, {
          ...input,
          [field]: "other",
        }).status,
        "blocked",
      );
    assert.deepEqual(prepared, before);
  }
  assert.equal(
    prepareTaskPreEffectSettlement(prepared, prepared.generation, {
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: "operation-a",
      authorityBindingId: "authority-a",
      outcome: "failed",
      cleanupConfirmed: false,
      recoveryObligations: [],
      recoveryUnresolved: false,
    }).status,
    "blocked",
  );
});

/**
 * 再計画と再試行の規則をモデルOwnerで確認する。
 * @trace PRL-UT-006
 * @precondition 既知の失敗Taskから独立したStateを作る。
 * @stimulus 生存依存・置換範囲・上限・元世代・再送の差分を与える。
 * @observation 元値不変、拒否理由、相関消去、Evidenceと定義順。
 * @oracle 旧Coの生存依存拒否assertを維持し、二つの回数を混同しない。
 * @cleanup メモリのみ。
 */
test("生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えない", () => {
  const initial = schedulingStateFor([
    schedulingTask("task-a"),
    schedulingTask("task-b", ["task-a"]),
  ]);
  const failed: ProjectExecutionState = {
    ...initial,
    generation: 4,
    tasks: initial.tasks.map((item, index) =>
      index === 0
        ? {
            ...item,
            state: "failed",
            startPhase: "settled",
            cleanupConfirmed: true,
          }
        : item,
    ),
  };
  const before = JSON.stringify(failed);
  const rejected = prepareTaskReplan(failed, failed.generation, {
    failedTaskId: "task-a",
    replacements: [schedulingTask("task-c")],
    maximumReplans: 1,
  });
  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.reason, "coordinator_replan_invalid_or_out_of_scope");
  assert.equal(JSON.stringify(rejected.state), before);
  assert.deepEqual(rejected.taskIds, []);
});

test("再試行と部分置換は別の上限・Evidence・直後再送を保持する", () => {
  const initial = schedulingStateFor([schedulingTask("task-a")]);
  const failed: ProjectExecutionState = {
    ...initial,
    generation: 4,
    objectives: initial.objectives.map((item) => ({
      ...item,
      state: "blocked",
      criterionEvidenceIds: ["evidence-a"],
    })),
    tasks: initial.tasks.map((item) => ({
      ...item,
      state: "failed",
      startPhase: "settled",
      cleanupConfirmed: true,
      attemptId: "old-attempt",
      operationId: "old-operation",
      authorityBindingId: "old-authority",
      retryCount: 2,
    })),
  };
  const before = structuredClone(failed);
  for (const [generation, max, count] of [
    [5, 3, 2],
    [4, 2, 2],
    [4, 3, 1],
  ] as const)
    assert.equal(
      prepareTaskRetry(failed, generation, "task-a", max, count).reason,
      "coordinator_retry_invalid_or_limit_exceeded",
    );
  const retry = prepareTaskRetry(failed, 4, "task-a", 3, 2);
  assert.equal(retry.status, "completed");
  assert.equal(retry.state.tasks[0]?.retryCount, 3);
  assert.deepEqual(retry.state.objectives[0]?.criterionEvidenceIds, [
    "evidence-a",
  ]);
  assert.equal(retry.state.tasks[0]?.attemptId, null);
  assert.equal(retry.state.tasks[0]?.operationId, null);
  assert.equal(retry.state.tasks[0]?.authorityBindingId, null);
  const command = {
    kind: "task_retry",
    projectId: failed.projectId,
    taskId: "task-a",
    previousRetryCount: 2,
    maximumReplans: 3,
  } as const;
  assert.equal(
    prepareTaskExecutionUpdate(retry.state, 4, command).status,
    "completed",
  );
  assert.equal(
    prepareTaskExecutionUpdate(
      {
        ...retry.state,
        milestone: { ...retry.state.milestone, state: "planned" },
      },
      4,
      command,
    ).status,
    "blocked",
  );
  const replacements = [
    schedulingTask("task-c"),
    schedulingTask("task-d", ["task-c"]),
  ];
  const partial = prepareTaskReplan(failed, 4, {
    failedTaskId: "task-a",
    replacements,
    maximumReplans: 1,
  });
  assert.equal(partial.status, "completed");
  assert.deepEqual(partial.taskIds, ["task-c", "task-d"]);
  assert.equal(partial.state.tasks[0]?.supersededBy, "task-c");
  assert.deepEqual(partial.state.objectives[0]?.criterionEvidenceIds, []);
  const replan = {
    kind: "task_replan",
    projectId: failed.projectId,
    failedTaskId: "task-a",
    replacements,
    maximumReplans: 1,
  } as const;
  assert.equal(
    prepareTaskExecutionUpdate(partial.state, 4, replan).status,
    "completed",
  );
  assert.equal(
    prepareTaskExecutionUpdate(partial.state, 4, {
      ...replan,
      replacements: [...replacements].reverse(),
    }).status,
    "blocked",
  );
  assert.equal(
    prepareTaskReplan(failed, 4, {
      failedTaskId: "task-a",
      replacements: [schedulingTask("task-c", [], ["../outside"])],
      maximumReplans: 1,
    }).status,
    "blocked",
  );
  assert.deepEqual(failed, before);
});

/**
 * 引渡し・開始観測のモデル規則を状態Ownerで検証する。
 * @trace PRL-UT-006
 * @precondition 既知の初期値から本物の予約候補を一度構築する。
 * @stimulus 世代・Task・Attempt・Operation・phaseの差分と不正な要求形式を渡す。
 * @observation 固定理由、元値不変、世代とTask行。
 * @oracle 正しい順序・相関だけを進め、観測を実Process開始と扱わない。
 * @cleanup メモリのみ。
 */
test("Taskの引渡しと開始観測は元世代・Attempt・Operation・phaseに結合する", () => {
  const initial = schedulingStateFor([schedulingTask("task-a")]);
  const reserved = prepareTaskStart(
    initial,
    initial.generation,
    "task-a",
    "attempt-a",
    "authority-a",
  );
  assert.equal(reserved.status, "completed");
  const before = structuredClone(reserved.state);
  for (const [generation, taskId, attemptId, operationId] of [
    [reserved.state.generation + 1, "task-a", "attempt-a", "operation-a"],
    [reserved.state.generation, "missing", "attempt-a", "operation-a"],
    [reserved.state.generation, "task-a", "other", "operation-a"],
    [reserved.state.generation, "task-a", "attempt-a", "../outside"],
  ] as const) {
    assert.equal(
      prepareTaskHandoff(
        reserved.state,
        generation,
        taskId,
        attemptId,
        operationId,
      ).reason,
      "coordinator_task_handoff_preparation_mismatch",
    );
  }
  const handed = prepareTaskHandoff(
    reserved.state,
    reserved.state.generation,
    "task-a",
    "attempt-a",
    "operation-a",
  );
  assert.equal(handed.status, "completed");
  assert.deepEqual(reserved.state, before);
  assert.equal(handed.state.generation, reserved.state.generation + 1);
  assert.strictEqual(
    handed.state.taskExecutionSelections,
    reserved.state.taskExecutionSelections,
  );
  assert.equal(handed.state.tasks[0]?.startPhase, "handoff_prepared");
  for (const [generation, attemptId, operationId] of [
    [handed.state.generation + 1, "attempt-a", "operation-a"],
    [handed.state.generation, "other", "operation-a"],
    [handed.state.generation, "attempt-a", "other"],
  ] as const) {
    assert.equal(
      prepareTaskStarted(
        handed.state,
        generation,
        "task-a",
        attemptId,
        operationId,
      ).reason,
      "coordinator_task_start_observation_mismatch",
    );
  }
  const started = prepareTaskStarted(
    handed.state,
    handed.state.generation,
    "task-a",
    "attempt-a",
    "operation-a",
  );
  assert.equal(started.status, "completed");
  assert.equal(started.state.tasks[0]?.state, "running");
  assert.equal(started.state.generation, handed.state.generation + 1);
  assert.strictEqual(
    started.state.taskExecutionSelections,
    handed.state.taskExecutionSelections,
  );
  assert.equal(
    prepareTaskStarted(
      started.state,
      started.state.generation,
      "task-a",
      "attempt-a",
      "operation-a",
    ).status,
    "blocked",
  );
  let hooks = 0;
  const command = {
    kind: "task_handoff",
    projectId: initial.projectId,
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
  };
  const accessor = {
    ...command,
    get operationId() {
      hooks++;
      return "operation-a";
    },
  };
  for (const invalid of [
    accessor,
    new Proxy(command, {}),
    { ...command, unknown: true },
    { ...command, authorityBindingId: "authority-a" },
  ])
    assert.equal(captureTaskExecutionUpdate(invalid), null);
  assert.equal(hooks, 0);
});

/** @trace PRL-UT-006 既知のTask定義だけを用意し判定しない。 */
function schedulingTask(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return {
    id,
    objectiveId: "objective-1",
    dependencies,
    allowedPaths,
    conflictKeys,
  };
}

/** @trace PRL-UT-006 可変なStateは各確認ごとに新しく構築する。 */
function schedulingStateFor(
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  return projectExecutionFixture({
    taskExecutionSelections: fixtureTaskExecutionSelections(),
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: "a".repeat(40),
    maximumConcurrency,
    milestoneAcceptanceCriteria: ["全Objectiveの統合結果が整合する"],
    objectives: [
      { id: "objective-1", acceptanceCriteria: ["必要Taskの結果が統合される"] },
    ],
    tasks,
    ownerGeneration: "owner-1",
  }).state;
}

/**
 * 元の開始候補検査を状態Ownerで確認する。
 * @trace PRL-UT-006
 * @precondition 依存・容量・未回収予約の合成状態だけを用意する。
 * @stimulus 同じ状態から候補観測と予約候補を生成する。
 * @observation 定義順、拒否理由、世代及び候補ID。
 * @oracle 依存未完・未回収を空き枠へ補完せず、世代検査を先行する。
 * @cleanup メモリのみ。
 */
test("開始候補は依存充足・Cleanup不明・回復予約を区別する", () => {
  const initial = schedulingStateFor([
    schedulingTask("task-a"),
    schedulingTask("task-b", ["task-a"]),
  ]);
  assert.deepEqual(observeTaskStartCandidates(initial).taskIds, ["task-a"]);
  const dependencyComplete: ProjectExecutionState = {
    ...initial,
    tasks: initial.tasks.map((task, index) => ({
      ...task,
      state: index === 0 ? "completed" : "ready",
    })),
  };
  assert.deepEqual(observeTaskStartCandidates(dependencyComplete).taskIds, [
    "task-b",
  ]);
  const limited = schedulingStateFor(
    [schedulingTask("task-a"), schedulingTask("task-b")],
    1,
  );
  const unknown: ProjectExecutionState = {
    ...limited,
    tasks: limited.tasks.map((task, index) =>
      index === 0
        ? { ...task, state: "recovery_required", cleanupConfirmed: false }
        : task,
    ),
  };
  assert.deepEqual(observeTaskStartCandidates(unknown).taskIds, []);
  const conflict = schedulingStateFor([
    schedulingTask("task-a", [], ["shared"]),
    schedulingTask("task-b", [], ["shared/file"]),
    schedulingTask("task-c"),
  ]);
  const retained: ProjectExecutionState = {
    ...conflict,
    tasks: conflict.tasks.map((task, index) =>
      index === 0
        ? {
            ...task,
            state: "recovery_required",
            cleanupConfirmed: true,
            recoveryUnresolved: true,
          }
        : task,
    ),
  };
  assert.deepEqual(observeTaskStartCandidates(retained).taskIds, ["task-c"]);
  assert.equal(
    prepareTaskStart(
      initial,
      initial.generation + 1,
      "missing",
      "attempt",
      "authority",
    ).reason,
    "coordinator_generation_or_identity_mismatch",
  );
  assert.equal(
    prepareTaskStart(
      initial,
      initial.generation,
      "task-b",
      "attempt",
      "authority",
    ).reason,
    "coordinator_task_not_schedulable",
  );
  const reserved = prepareTaskStart(
    initial,
    initial.generation,
    "task-a",
    "attempt",
    "authority",
  );
  assert.equal(reserved.status, "completed");
  assert.equal(reserved.state.generation, initial.generation + 1);
  assert.equal(reserved.state.tasks[0]?.startPhase, "reserved");
});

import type { OperationRecord } from "../../../src/attempt/types.ts";
import type { Blocker, Decision } from "../../../src/decision/types.ts";
import type { HistoryRow } from "../../../src/history/types.ts";
import type {
  ExecutionOverview,
  ExecutionStateSnapshot,
  ManagedExecution,
  ProjectDefinition,
  ProjectExecutionState,
  Snapshot,
} from "../../../src/composition/types.ts";
import type {
  LeaseEvidenceEnvelope,
  LeaseKind,
} from "../../../src/lease/types.ts";
import type { ProjectQueueEntry } from "../../../src/task/types.ts";
import type {
  ResultRecord,
  WorkspaceRecord,
} from "../../../src/workspace/types.ts";

/**
 * 7件の独立Taskから最大5件だけを選ぶを検証する。
 *
 * @responsibility 7件の独立Taskから最大5件だけを選ぶの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 7件の独立Taskから最大5件だけを選ぶの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: EM Test Source→対象契約
 */
test("7件の独立Taskから最大5件だけを選ぶ", () => {
  const state = schedulingStateFor(
    Array.from({ length: 7 }, (_unused, index) =>
      schedulingTask(`task-${index + 1}`),
    ),
  );
  assert.deepEqual(observeTaskStartCandidates(state).taskIds, [
    "task-1",
    "task-2",
    "task-3",
    "task-4",
    "task-5",
  ]);
});

/**
 * 同じPathまたはConflict keyのTaskを同時に選ばないを検証する。
 *
 * @responsibility 同じPathまたはConflict keyのTaskを同時に選ばないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同じPathまたはConflict keyのTaskを同時に選ばないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: EM Test Source→対象契約
 */
test("同じPathまたはConflict keyのTaskを同時に選ばない", () => {
  const state = schedulingStateFor([
    schedulingTask("task-a", [], ["shared/file.txt"]),
    schedulingTask("task-b", [], ["shared/file.txt"]),
    schedulingTask("task-c", [], ["other.txt"], ["schema-x"]),
    schedulingTask("task-d", [], ["more.txt"], ["schema-x"]),
  ]);
  assert.deepEqual(observeTaskStartCandidates(state).taskIds, [
    "task-a",
    "task-c",
  ]);
});

/**
 * 親Directoryと子Pathを競合として扱うを検証する。
 *
 * @responsibility 親Directoryと子Pathを競合として扱うの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 親Directoryと子Pathを競合として扱うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: EM Test Source→対象契約
 */
test("親Directoryと子Pathを競合として扱う", () => {
  const state = schedulingStateFor([
    schedulingTask("task-a", [], ["src"]),
    schedulingTask("task-b", [], ["src/runtime/file.ts"]),
    schedulingTask("task-c", [], ["docs/file.md"]),
  ]);
  assert.deepEqual(observeTaskStartCandidates(state).taskIds, [
    "task-a",
    "task-c",
  ]);
});

/** @trace PRL-UT-006 基準の展開形を保存移行や互換Readerに使わない型Oracleとして保持する。 */
type ExpectedOverview = Readonly<{
  schema: "crdd-execution-model/state/v9";
  revision: number;
  previous: Readonly<{ revision: number; payloadSha256: string }> | null;
  repositoryBinding: string;
  operations: readonly OperationRecord[];
  unresolvedRecoveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    reason: string;
    obligations: readonly (
      | "docker_resources"
      | "host_cleanup"
      | "lease_release"
    )[];
  }>[];
}>;
type ExpectedProjection = Readonly<{
  workspaces: readonly WorkspaceRecord[];
  repositoryRootHash: string;
  repositoryBindingId: string;
  snapshotRevision: number;
  projects: readonly ProjectExecutionState[];
  queueEntries: readonly ProjectQueueEntry[];
  leaseEvidence: readonly LeaseEvidenceEnvelope[];
  leaseIntents: readonly Readonly<{
    projectId: string;
    queueId: string;
    kind: LeaseKind;
    ownerGeneration: string;
    ownerProcessId: number;
    recoveryId: string;
    phase:
      | "acquisition_pending"
      | "acquisition_reserved"
      | "lock_owned"
      | "release_pending"
      | "recovery_pending";
    physicalIdentity?: string | null;
  }>[];
  results: readonly ResultRecord[];
  historyPending: readonly HistoryRow[];
}> &
  Readonly<{
    schema: "crdd-execution-model/project-snapshot/v9";
    schemaRevision: 9;
    decisions: readonly Decision[];
    blockers: readonly Blocker[];
  }>;
type ExpectedStoredState = Omit<ExpectedOverview, "schema"> &
  Omit<
    ExpectedProjection,
    | "schema"
    | "schemaRevision"
    | "repositoryRootHash"
    | "snapshotRevision"
    | "repositoryBindingId"
    | "projects"
  > &
  Readonly<{
    schema: "crdd-execution-model/state/v9";
    repositoryBindingId: string | null;
    projects: readonly ProjectDefinition[];
    managedExecutions: readonly ManagedExecution[];
  }>;

/** @trace PRL-UT-006 optionalな余分fieldも双方向代入だけで見逃さない。 */
type SameKeys<A, B> = [
  Exclude<keyof A, keyof B>,
  Exclude<keyof B, keyof A>,
] extends [never, never]
  ? true
  : false;

const assignments: readonly [
  ExecutionStateSnapshot extends ExpectedStoredState ? true : false,
  ExpectedStoredState extends ExecutionStateSnapshot ? true : false,
  ExecutionOverview extends ExpectedOverview ? true : false,
  ExpectedOverview extends ExecutionOverview ? true : false,
  Snapshot extends ExpectedProjection ? true : false,
  ExpectedProjection extends Snapshot ? true : false,
  SameKeys<ExecutionStateSnapshot, ExpectedStoredState>,
  SameKeys<ExecutionOverview, ExpectedOverview>,
  SameKeys<Snapshot, ExpectedProjection>,
] = [true, true, true, true, true, true, true, true, true];

/**
 * 型検査でだけ実行する負例をまとめる。
 * @responsibility readonly・nullable・投影Schemaの差を型の強制変換で隠さない。
 * @trace PRL-UT-006
 * @precondition 型検査対象であり呼び出さない。
 * @stimulus 不正更新・保存値から投影への無条件代入を宣言する。
 * @observation tscの期待エラー。未発生なら型検査が失敗する。
 * @oracle 正本のnull許容と投影のnon-null、readonlyを区別する。
 * @cleanup 実行しないので共有状態・保存への変更なし。
 * @boundary コンパイラの型検査だけ。
 */
function rejectInvalidTypes(state: ExecutionStateSnapshot, view: Snapshot) {
  // @ts-expect-error 保存改訂はreadonly。
  state.revision = 1;
  // @ts-expect-error 正本の配列はreadonly。
  state.projects.push(state.projects[0]);
  if (state.previous) {
    // @ts-expect-error 元版の改訂もreadonly。
    state.previous.revision = 1;
  }
  // @ts-expect-error nullableの保存値をnon-null投影へ代入しない。
  const nonNullBinding: string = state.repositoryBindingId;
  // @ts-expect-error 投影Schemaを保存Schemaとして使わない。
  const storedSchema: ExecutionStateSnapshot["schema"] = view.schema;
  // @ts-expect-error 投影Projectは定義のみの保存Projectとは異なる。
  const managed: readonly ProjectExecutionState[] = state.projects;
  return [nonNullBinding, storedSchema, managed];
}

/** @trace PRL-UT-006 型検査の成立は前段のtscで確認し、runtimeは構成したOracleだけを照合する。 */
test("保存正本と二投影は基準の展開形へ双方向適合する", () => {
  assert.deepEqual(assignments, [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  assert.equal(typeof rejectInvalidTypes, "function");
  const intent: ExecutionStateSnapshot["leaseIntents"][number] = {
    projectId: "P",
    queueId: "Q",
    kind: "project-operation",
    ownerGeneration: "G",
    ownerProcessId: 1,
    recoveryId: "R",
    phase: "acquisition_pending",
  };
  assert.equal(Object.hasOwn(intent, "physicalIdentity"), false);
  const withNull: typeof intent = { ...intent, physicalIdentity: null };
  assert.equal(withNull.physicalIdentity, null);
});

import type { ProjectTaskDefinition } from "../../../src/index.ts";
/** 初期生成の拒否・規模・正規化はモデル実装へ直接照合する。 */
import { createProjectExecutionState } from "../../../src/task/crud.ts";
import { fixtureTaskExecutionSelections } from "../../fixtures/execution-plan.ts";

const revision = "a".repeat(40);
function initialTaskDefinition(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return {
    id,
    objectiveId: "objective-1",
    dependencies,
    allowedPaths,
    conflictKeys,
  };
}

/**
 * Hostが有効なowner generationを供給しない場合は状態を作らないを検証する。
 *
 * @responsibility Hostが有効なowner generationを供給しない場合は状態を作らないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Hostが有効なowner generationを供給しない場合は状態を作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→初期値契約
 */
/**
 * Hostが有効なowner generationを供給しない場合は状態を作らないを検証する。
 *
 * @responsibility Hostが有効なowner generationを供給しない場合は状態を作らないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Hostが有効なowner generationを供給しない場合は状態を作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→初期値契約
 */
test("Hostが有効なowner generationを供給しない場合は状態を作らない", () => {
  const state = createProjectExecutionState({
    taskExecutionSelections: fixtureTaskExecutionSelections(),
    projectId: "crdd",
    milestoneId: "v0.20",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["全Taskが完了する"],
    objectives: [
      { id: "objective-1", acceptanceCriteria: ["結果が受理される"] },
    ],
    tasks: [initialTaskDefinition("task-1")],
    ownerGeneration: "",
  });

  assert.equal(state.status, "blocked");
  assert.equal(state.reason, "coordinator_input_invalid");
  assert.equal(state.state, null);
});
/**
 * 受入条件の説明文をPathとして正規化しないを検証する。
 *
 * @responsibility 受入条件の説明文をPathとして正規化しないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 受入条件の説明文をPathとして正規化しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→初期値契約
 */
test("受入条件の説明文をPathとして正規化しない", () => {
  const state = createProjectExecutionState({
    taskExecutionSelections: fixtureTaskExecutionSelections(),
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["末尾は\\nである"],
    objectives: [
      { id: "objective-1", acceptanceCriteria: ["値はC:\\workである"] },
    ],
    tasks: [initialTaskDefinition("task-1", [], ["src\\file.ts"])],
    ownerGeneration: "owner-1",
  });
  assert.equal(state.status, "completed");
  assert.equal(state.state?.milestone.acceptanceCriteria[0], "末尾は\\nである");
  assert.equal(
    state.state?.objectives[0]?.definition.acceptanceCriteria[0],
    "値はC:\\workである",
  );
  assert.equal(
    state.state?.tasks[0]?.definition.allowedPaths[0],
    "src/file.ts",
  );
});
test("Task定義のRepository外Pathを状態へ取り込まない", () => {
  for (const pathValue of ["C:\\outside", "/outside", "../outside"]) {
    const state = createProjectExecutionState({
      taskExecutionSelections: fixtureTaskExecutionSelections(),
      projectId: "crdd",
      milestoneId: "v0.20",
      repositoryRevision: revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["全Taskが完了する"],
      objectives: [
        { id: "objective-1", acceptanceCriteria: ["結果が受理される"] },
      ],
      tasks: [initialTaskDefinition("task-1", [], [pathValue])],
      ownerGeneration: "owner-1",
    });
    assert.equal(state.status, "blocked");
    assert.equal(state.reason, "coordinator_task_definition_invalid");
    assert.equal(state.state, null);
  }
});

/**
 * cycleと欠落DependencyをEffect前に拒否するを検証する。
 *
 * @responsibility cycleと欠落DependencyをEffect前に拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cycleと欠落DependencyをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: execution-model Test Source→初期値契約
 */
test("cycleと欠落DependencyをEffect前に拒否する", () => {
  for (const tasks of [
    [
      initialTaskDefinition("task-a", ["task-b"]),
      initialTaskDefinition("task-b", ["task-a"]),
    ],
    [initialTaskDefinition("task-a", ["missing"])],
  ]) {
    const result = createProjectExecutionState({
      taskExecutionSelections: fixtureTaskExecutionSelections(),
      projectId: "crdd",
      milestoneId: "v0.19",
      repositoryRevision: revision,
      maximumConcurrency: 5,
      milestoneAcceptanceCriteria: ["全体が整合する"],
      objectives: [
        {
          id: "objective-1",
          acceptanceCriteria: ["必要Taskが統合される"],
        },
      ],
      tasks,
      ownerGeneration: "owner-1",
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "coordinator_task_graph_invalid");
    assert.equal(result.state, null);
  }
});

/**
 * 保存量の旧上限を超える初期状態を投影まで接続する。
 * @responsibility 定義件数・受入条件・Path集合を容量だけで拒否しない。
 * @trace PRL-UT-006
 * @precondition 129 Objectiveと1,025 Taskの一意な相関を構築する。
 * @stimulus 旧512文字超の本文・Pathと129件の集合を同じ状態へ渡す。
 * @observation 全量の状態・投影と不正入力の拒否を観測する。
 * @oracle 正常値は全量を保持し、重複IDと同時実行数不正は拒否する。
 * @cleanup N/A: メモリ内の値のみ。
 * @boundary 初期状態作成からDomain公開投影の検査。
 */
test("状態作成は旧Objective・Task・本文・Path集合上限を復活させない", () => {
  const criteria = Array.from(
    { length: 129 },
    (_, index) => `${index}-${"a".repeat(513)}`,
  );
  const longPath = `${"segment/".repeat(75)}source.txt`;
  const objectives = Array.from({ length: 129 }, (_, index) => ({
    id: `objective-${index}`,
    acceptanceCriteria: criteria,
  }));
  const tasks = Array.from({ length: 1025 }, (_, index) => ({
    id: `task-${index}`,
    objectiveId: `objective-${index % objectives.length}`,
    dependencies:
      index === 1024 ? Array.from({ length: 129 }, (_, i) => `task-${i}`) : [],
    allowedPaths: [
      longPath,
      ...Array.from({ length: 128 }, (_, i) => `work/${i}.txt`),
    ],
    conflictKeys: Array.from({ length: 129 }, (_, i) => `key-${i}`),
  }));
  const input = {
    taskExecutionSelections: fixtureTaskExecutionSelections(),
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: revision,
    maximumConcurrency: 5,
    milestoneAcceptanceCriteria: criteria,
    objectives,
    tasks,
    ownerGeneration: "owner-1",
  };
  const result = createProjectExecutionState(input);
  assert.equal(result.status, "completed");
  assert.ok(result.state);
  assert.equal(result.state.objectives.length, 129);
  assert.equal(result.state.tasks.length, 1025);
  assert.equal(result.state.tasks[1024]?.definition.allowedPaths[0], longPath);
  assert.equal(
    createProjectExecutionState({ ...input, maximumConcurrency: 6 }).status,
    "blocked",
  );
  const firstTask = tasks[0];
  assert.ok(firstTask);
  assert.equal(
    createProjectExecutionState({ ...input, tasks: [firstTask, firstTask] })
      .status,
    "blocked",
  );
});

/**
 * 複数種のRecoveryを項目ごとの受領状態で保持するを検証する。
 *
 * @responsibility 複数種のRecoveryを項目ごとの受領状態で保持するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 複数種のRecoveryを項目ごとの受領状態で保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("複数種のRecoveryを項目ごとの受領状態で保持する", () => {
  let state = runningStateForSettlement(
    schedulingStateFor([schedulingTask("task-a")]),
    "task-a",
  );
  const dockerId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const hostId = `host-task.${"d".repeat(64)}`;
  // 回復規則に対して、既知の終端値を独立した入力として用意する。
  const terminalFixture = {
    taskId: "task-a",
    attemptId: "attempt-task-a",
    operationId: "operation-task-a",
    authorityBindingId: "authority-task-a",
    outcome: "recovery_required",
    cleanupConfirmed: false,
    recoveryObligations: [
      { kind: "docker", recoveryId: dockerId, phase: "required" },
      { kind: "host", recoveryId: hostId, phase: "required" },
    ],
    recoveryUnresolved: false,
  } as const;
  const settled = {
    status: "completed" as const,
    state: {
      ...state,
      generation: state.generation + 1,
      milestone: { ...state.milestone, state: "recovery_required" as const },
      objectives: state.objectives.map((objective) => ({
        ...objective,
        state: "blocked" as const,
      })),
      tasks: state.tasks.map((task) =>
        task.definition.id !== terminalFixture.taskId
          ? task
          : {
              ...task,
              state: "recovery_required" as const,
              startPhase: "settled" as const,
              cleanupConfirmed: terminalFixture.cleanupConfirmed,
              recoveryObligations: terminalFixture.recoveryObligations,
              recoveryUnresolved: terminalFixture.recoveryUnresolved,
              candidateId: null,
            },
      ),
    },
  };
  assert.ok(settled.state);
  state = settled.state;
  const recovering = prepareTaskRecoveryStart(
    state,
    state.generation,
    "task-a",
    "docker",
    dockerId,
  );
  assert.ok(recovering.state);
  const itemSettled = prepareTaskRecoverySettlement(
    recovering.state,
    recovering.state.generation,
    "task-a",
    "docker",
    dockerId,
  );
  assert.ok(itemSettled.state);
  assert.deepEqual(itemSettled.state.tasks[0]?.recoveryObligations, [
    { kind: "docker", recoveryId: dockerId, phase: "settled" },
    { kind: "host", recoveryId: hostId, phase: "required" },
  ]);
  assert.equal(
    prepareTaskRecoveryRetry(itemSettled.state, itemSettled.state.generation, [
      "task-a",
    ]).status,
    "blocked",
  );
  const dockerSettled = itemSettled;
  assert.ok(dockerSettled.state);
  const hostRecovering = prepareTaskRecoveryStart(
    dockerSettled.state,
    dockerSettled.state.generation,
    "task-a",
    "host",
    hostId,
  );
  assert.equal(hostRecovering.status, "completed");
  assert.ok(hostRecovering.state);
  const allSettled = prepareTaskRecoverySettlement(
    hostRecovering.state,
    hostRecovering.state.generation,
    "task-a",
    "host",
    hostId,
  );
  assert.equal(allSettled.status, "completed");
  assert.ok(allSettled.state);
  assert.equal(
    prepareTaskRecoveryRetry(allSettled.state, allSettled.state.generation, [
      "task-a",
    ]).status,
    "blocked",
    "義務phaseだけでは技術Cleanupの確認を代替しない",
  );
  const confirmed = {
    ...allSettled.state,
    tasks: allSettled.state.tasks.map((task) => ({
      ...task,
      cleanupConfirmed: true,
    })),
  };
  const retryReady = prepareTaskRecoveryRetry(confirmed, confirmed.generation, [
    "task-a",
  ]);
  assert.equal(retryReady.status, "completed");
  assert.equal(retryReady.state?.tasks[0]?.state, "ready");
  assert.equal(retryReady.state?.tasks[0]?.attemptId, null);
  assert.equal(retryReady.state?.tasks[0]?.operationId, null);
  assert.ok(
    retryReady.state?.tasks[0]?.recoveryObligations.every(
      (item) => item.phase === "settled",
    ),
  );
});

/**
 * Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さないを検証する。
 *
 * @responsibility Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さない", () => {
  let state = runningStateForSettlement(
    schedulingStateFor([schedulingTask("task-a")]),
    "task-a",
  );
  const executionProcessId = `execution-process.11111111-1111-4111-8111-111111111111.restart-${"a".repeat(40)}`;
  // 回復規則に対して、既知の終端値を独立した入力として用意する。
  const terminalFixture = {
    taskId: "task-a",
    attemptId: "attempt-task-a",
    operationId: "operation-task-a",
    authorityBindingId: "authority-task-a",
    outcome: "recovery_required",
    cleanupConfirmed: false,
    recoveryObligations: [
      {
        kind: "execution_process",
        recoveryId: executionProcessId,
        phase: "required",
      },
    ],
    recoveryUnresolved: true,
  } as const;
  const settled = {
    status: "completed" as const,
    state: {
      ...state,
      generation: state.generation + 1,
      milestone: { ...state.milestone, state: "recovery_required" as const },
      objectives: state.objectives.map((objective) => ({
        ...objective,
        state: "blocked" as const,
      })),
      tasks: state.tasks.map((task) =>
        task.definition.id !== terminalFixture.taskId
          ? task
          : {
              ...task,
              state: "recovery_required" as const,
              startPhase: "settled" as const,
              cleanupConfirmed: terminalFixture.cleanupConfirmed,
              recoveryObligations: terminalFixture.recoveryObligations,
              recoveryUnresolved: terminalFixture.recoveryUnresolved,
              candidateId: null,
            },
      ),
    },
  };
  assert.equal(settled.status, "completed");
  assert.ok(settled.state);
  state = settled.state;
  const retry = prepareTaskRecoveryRetry(state, state.generation, ["task-a"]);
  assert.equal(retry.status, "blocked");
  assert.equal(retry.state?.tasks[0]?.state, "recovery_required");
});

/**
 * 回復の有限要求をphase・exact参照・集合単位で反証する。
 * @trace PRL-UT-006
 * @precondition 二Taskの独立値だけを用意し、I/Oは使わない。
 * @stimulus 不正phase／kind／ID、再送、混合ready集合と不適格行を与える。
 * @observation 世代、retryCount、全Task・Objectiveと元値の不変性。
 * @oracle 一義務のphaseだけが変わり、再試行は全件適格時だけ一世代で成立する。
 * @cleanup N/A: Process内の値だけ。
 * @boundary EMの有限要求捕捉と純粋な候補生成。
 */
test("回復更新はexact義務・直後再送・複数Taskの全件適格を維持する", () => {
  const base = schedulingStateFor([
    schedulingTask("task-a"),
    schedulingTask("task-b"),
  ]);
  const state: ProjectExecutionState = {
    ...base,
    generation: 10,
    milestone: { ...base.milestone, state: "recovery_required" },
    objectives: base.objectives.map((item) => ({ ...item, state: "blocked" })),
    tasks: base.tasks.map((item) => ({
      ...item,
      state: "recovery_required",
      attemptId: `attempt-${item.definition.id}`,
      operationId: `operation-${item.definition.id}`,
      authorityBindingId: `authority-${item.definition.id}`,
      startPhase: "settled",
      cleanupConfirmed: true,
      recoveryUnresolved: false,
      recoveryObligations: [
        {
          kind: "execution_process",
          recoveryId: `recovery-${item.definition.id}`,
          phase: "required",
        },
      ],
    })),
  };
  const before = structuredClone(state);
  const command = {
    kind: "task_recovery_start" as const,
    projectId: state.projectId,
    taskId: "task-a",
    recoveryKind: "execution_process" as const,
    recoveryId: "recovery-task-a",
  };
  let hooks = 0;
  for (const input of [
    { ...command, extra: true },
    {
      ...command,
      get recoveryId() {
        hooks++;
        return command.recoveryId;
      },
    },
    new Proxy(command, {
      ownKeys() {
        hooks++;
        return Reflect.ownKeys(command);
      },
    }),
    { ...command, recoveryKind: "other" },
    { ...command, recoveryId: "../other" },
  ])
    assert.equal(captureTaskExecutionUpdate(input), null);
  assert.equal(hooks, 0);
  assert.deepEqual(captureTaskExecutionUpdate(command), command);
  for (const request of [
    { ...command, recoveryId: "different" },
    { ...command, recoveryKind: "host" as const },
    { ...command, taskId: "other" },
    { ...command, kind: "task_recovery_settle" as const },
  ])
    assert.equal(
      prepareTaskExecutionUpdate(state, state.generation, request).status,
      "blocked",
    );
  assert.equal(prepareTaskExecutionUpdate(state, 9, command).status, "blocked");
  const started = prepareTaskExecutionUpdate(state, 10, command);
  assert.equal(started.status, "completed");
  assert.equal(started.state.generation, 11);
  assert.deepEqual(started.state.tasks[1], state.tasks[1]);
  assert.equal(
    started.state.tasks[0]?.recoveryObligations[0]?.phase,
    "recovering",
  );
  assert.deepEqual(
    prepareTaskExecutionUpdate(started.state, 10, command).state,
    started.state,
  );
  assert.equal(
    prepareTaskExecutionUpdate(started.state, 11, command).status,
    "blocked",
  );
  const settlement = { ...command, kind: "task_recovery_settle" as const };
  const settled = prepareTaskExecutionUpdate(started.state, 11, settlement);
  assert.equal(settled.status, "completed");
  assert.deepEqual(
    prepareTaskExecutionUpdate(settled.state, 11, settlement).state,
    settled.state,
  );
  const retry = {
    kind: "task_recovery_retry" as const,
    projectId: state.projectId,
    taskIds: ["task-a", "task-b"],
  };
  assert.equal(
    prepareTaskExecutionUpdate(settled.state, 12, retry).status,
    "blocked",
  );
  for (const ids of [[], ["task-a", "task-a"], ["../other"]])
    assert.equal(
      prepareTaskRecoveryRetry(settled.state, 12, ids).status,
      "blocked",
    );
  const allSettled = {
    ...settled.state,
    tasks: settled.state.tasks.map((item) => ({
      ...item,
      recoveryObligations: item.recoveryObligations.map((entry) => ({
        ...entry,
        phase: "settled" as const,
      })),
    })),
  };
  const batch = prepareTaskExecutionUpdate(allSettled, 12, retry);
  assert.equal(batch.status, "completed");
  assert.equal(batch.state.generation, 13);
  assert.deepEqual(batch.taskIds, ["task-a", "task-b"]);
  assert.ok(
    batch.state.tasks.every(
      (item) =>
        item.state === "ready" &&
        item.retryCount === 1 &&
        item.attemptId === null &&
        item.operationId === null &&
        item.authorityBindingId === null &&
        item.recoveryObligations.every((entry) => entry.phase === "settled"),
    ),
  );
  assert.equal(batch.state.milestone.state, "executing");
  assert.ok(batch.state.objectives.every((item) => item.state === "executing"));
  assert.deepEqual(
    prepareTaskExecutionUpdate(batch.state, 12, retry).state,
    batch.state,
  );
  const readyTask = batch.state.tasks[0];
  const recoveringTask = allSettled.tasks[1];
  assert.ok(readyTask);
  assert.ok(recoveringTask);
  const mixed = {
    ...allSettled,
    tasks: [readyTask, recoveringTask],
  };
  const mixedRetry = prepareTaskExecutionUpdate(mixed, 12, retry);
  assert.equal(mixedRetry.status, "completed");
  assert.deepEqual(mixedRetry.state.tasks[0], mixed.tasks[0]);
  assert.equal(mixedRetry.state.tasks[1]?.retryCount, 1);
  for (const change of [
    { cleanupConfirmed: false },
    { recoveryUnresolved: true },
  ]) {
    const invalid = {
      ...allSettled,
      tasks: allSettled.tasks.map((item, index) =>
        index === 1 ? { ...item, ...change } : item,
      ),
    };
    const refusal = prepareTaskExecutionUpdate(invalid, 12, retry);
    assert.equal(refusal.status, "blocked");
    assert.strictEqual(refusal.state, invalid);
  }
  assert.deepEqual(state, before);
});
/**
 * owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻すを検証する。
 *
 * @responsibility owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻すの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: EM Taskの局所回復規則
 */
test("owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻す", () => {
  const state = schedulingStateFor([schedulingTask("task-a")]);
  const reserved = prepareTaskStart(
    state,
    state.generation,
    "task-a",
    "attempt-task-a",
    "authority-task-a",
  );
  assert.ok(reserved.state);
  const recovered = prepareTaskOwnerLoss(
    reserved.state,
    reserved.state.generation,
    [],
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.state?.tasks[0]?.state, "ready");
  assert.equal(recovered.state?.tasks[0]?.operationId, null);
  assert.deepEqual(recovered.state?.tasks[0]?.recoveryObligations, []);
  assert.equal(recovered.state?.milestone.state, "executing");
});

/**
 * owner lossは開始済みTaskをexact Runtime Recoveryへ結合するを検証する。
 *
 * @responsibility owner lossは開始済みTaskをexact Runtime Recoveryへ結合するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus owner lossは開始済みTaskをexact Runtime Recoveryへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: EM Taskの局所回復規則
 */
test("owner lossは開始済みTaskをexact Runtime Recoveryへ結合する", () => {
  const running = runningStateForSettlement(
    schedulingStateFor([schedulingTask("task-a")]),
    "task-a",
  );
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const recovered = prepareTaskOwnerLoss(running, running.generation, [
    {
      operationId: "operation-task-a",
      status: "matched",
      recoveryId,
    },
  ]);
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.state?.tasks[0]?.state, "recovery_required");
  assert.deepEqual(recovered.state?.tasks[0]?.recoveryObligations, [
    { kind: "docker", recoveryId, phase: "required" },
  ]);
  assert.equal(recovered.state?.milestone.state, "recovery_required");
});

/**
 * handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻すを検証する。
 *
 * @responsibility handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻すの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: EM Taskの局所回復規則
 */
test("handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻す", () => {
  const initial = schedulingStateFor([schedulingTask("task-a")]);
  const reserved = prepareTaskStart(
    initial,
    initial.generation,
    "task-a",
    "attempt-task-a",
    "authority-task-a",
  );
  assert.ok(reserved.state);
  const prepared = prepareTaskHandoff(
    reserved.state,
    reserved.state.generation,
    "task-a",
    "attempt-task-a",
    "operation-task-a",
  );
  assert.ok(prepared.state);
  const recovered = prepareTaskOwnerLoss(
    prepared.state,
    prepared.state.generation,
    [
      {
        operationId: "operation-task-a",
        status: "verified_absent",
        recoveryId: null,
      },
    ],
  );
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.state?.tasks[0]?.state, "ready");
  assert.deepEqual(recovered.state?.tasks[0]?.recoveryObligations, []);
});

/**
 * running Taskを不存在観測だけでreadyへ戻さないを検証する。
 *
 * @responsibility running Taskを不存在観測だけでreadyへ戻さないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus running Taskを不存在観測だけでreadyへ戻さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: EM Taskの局所回復規則
 */
test("running Taskを不存在観測だけでreadyへ戻さない", () => {
  const running = runningStateForSettlement(
    schedulingStateFor([schedulingTask("task-a")]),
    "task-a",
  );
  const recovered = prepareTaskOwnerLoss(running, running.generation, [
    {
      operationId: "operation-task-a",
      status: "verified_absent",
      recoveryId: null,
    },
  ]);
  assert.equal(recovered.status, "blocked");
  assert.equal(recovered.state?.tasks[0]?.state, "running");
});

/**
 * Owner喪失の観測集合と未信頼要求を独立した差分で確認する。
 * @trace PRL-UT-006
 * @precondition reserved・handoff・runningと非対象Taskを一度準備する。
 * @stimulus 集合欠測・余剰・重複、古い世代、未知field、GetterとProxyを渡す。
 * @observation 全Taskの一世代更新、元参照、非対象行と拒否時の元値。
 * @oracle 観測不能を不存在へせず、全活動Operation集合が一致した場合だけ保存候補を返す。
 * @cleanup N/A: 独立したメモリ値のみ。
 * @boundary EMの有限要求受付とTask局所遷移。
 */
test("Owner喪失更新は全活動集合と元参照を一世代に結合する", () => {
  let state = schedulingStateFor(
    ["reserved", "handoff", "running", "other"].map((id) => schedulingTask(id)),
  );
  for (const id of ["reserved", "handoff", "running"]) {
    state = prepareTaskStart(
      state,
      state.generation,
      id,
      `attempt-${id}`,
      `authority-${id}`,
    ).state;
    if (id !== "reserved")
      state = prepareTaskHandoff(
        state,
        state.generation,
        id,
        `attempt-${id}`,
        `operation-${id}`,
      ).state;
    if (id === "running")
      state = prepareTaskStarted(
        state,
        state.generation,
        id,
        `attempt-${id}`,
        `operation-${id}`,
      ).state;
  }
  const before = structuredClone(state);
  const bindings = [
    {
      operationId: "operation-handoff",
      status: "verified_absent" as const,
      recoveryId: null,
    },
    {
      operationId: "operation-running",
      status: "matched" as const,
      recoveryId: "exact-recovery",
    },
  ] as const;
  const request = {
    kind: "task_owner_loss" as const,
    projectId: state.projectId,
    bindings,
  };
  let hooks = 0;
  for (const invalid of [
    { ...request, extra: true },
    { ...request, bindings: [{ ...bindings[0], extra: true }, bindings[1]] },
    { ...request, bindings: [null] },
    {
      ...request,
      bindings: new Proxy(bindings, {
        ownKeys() {
          hooks++;
          return [];
        },
      }),
    },
    {
      ...request,
      bindings: [
        {
          get operationId() {
            hooks++;
            return "other";
          },
          status: "matched",
          recoveryId: "id",
        },
      ],
    },
  ])
    assert.equal(captureTaskExecutionUpdate(invalid), null);
  assert.equal(hooks, 0);
  const captured = captureTaskExecutionUpdate(request);
  assert.ok(captured);
  assert.notStrictEqual(captured, request);
  for (const input of [
    [],
    bindings.slice(0, 1),
    [...bindings, bindings[0]],
    [{ ...bindings[0], operationId: "other" }, bindings[1]],
    [
      bindings[0],
      { ...bindings[1], status: "verified_absent" as const, recoveryId: null },
    ],
    [bindings[0], { ...bindings[1], recoveryId: "../invalid" }],
  ])
    assert.equal(
      prepareTaskOwnerLoss(state, state.generation, input).status,
      "blocked",
    );
  assert.equal(
    prepareTaskExecutionUpdate(state, state.generation - 1, request).status,
    "blocked",
  );
  const next = prepareTaskExecutionUpdate(state, state.generation, captured);
  assert.equal(next.status, "completed");
  assert.equal(next.state.generation, state.generation + 1);
  assert.deepEqual(next.taskIds, ["reserved", "handoff", "running"]);
  for (const task of next.state.tasks.slice(0, 2)) {
    assert.equal(task.state, "ready");
    assert.equal(task.attemptId, null);
    assert.equal(task.operationId, null);
    assert.equal(task.authorityBindingId, null);
    assert.equal(task.startPhase, "none");
    assert.equal(task.cleanupConfirmed, true);
  }
  assert.equal(next.state.tasks[2]?.operationId, "operation-running");
  assert.deepEqual(next.state.tasks[2]?.recoveryObligations, [
    { kind: "docker", recoveryId: "exact-recovery", phase: "required" },
  ]);
  assert.deepEqual(next.state.tasks[3], state.tasks[3]);
  assert.equal(next.state.objectives[0]?.state, "blocked");
  assert.equal(next.state.milestone.state, "recovery_required");
  assert.equal(
    prepareTaskExecutionUpdate(next.state, state.generation, request).status,
    "blocked",
  );
  for (const operationId of ["operation-handoff", "operation-running"]) {
    const retained = {
      ...state,
      tasks: state.tasks.map((task) =>
        task.definition.id !== "other"
          ? task
          : {
              ...task,
              state: "completed" as const,
              startPhase: "settled" as const,
              attemptId: "attempt-other",
              authorityBindingId: "authority-other",
              operationId,
              cleanupConfirmed: true,
            },
      ),
    };
    assert.equal(validState(retained), true);
    const beforeRetained = structuredClone(retained.tasks[3]);
    const updated = prepareTaskOwnerLoss(
      retained,
      retained.generation,
      bindings,
    );
    assert.equal(updated.status, "completed");
    assert.strictEqual(updated.state.tasks[3], retained.tasks[3]);
    assert.deepEqual(updated.state.tasks[3], beforeRetained);
    assert.equal(updated.state.generation, retained.generation + 1);
    assert.equal(updated.state.tasks[1]?.state, "ready");
    assert.equal(updated.state.tasks[2]?.state, "recovery_required");
  }
  assert.deepEqual(state, before);
});
