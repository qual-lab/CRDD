/**
 * orchestrator:unit:stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:stateが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @trace PRL-UT-007
 * @level UT
 * @scope project、runtime、state
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。 / PRL-UT-007=N/A: Objective／Milestone Acceptance Decision状態遷移は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeProjectResultAcceptance,
  recordProjectTaskResultAcceptances,
} from "../../../src/state/transitions.ts";
import {
  acknowledgeProjectDockerRecoveryObligation,
  applyOrchestratorAcceptanceDecision,
  applyOrchestratorPartialReplan,
  createOrchestratorState,
  describeOrchestratorStateContract,
  markProjectTaskRecoveryObligationRecovering,
  observeProjectTaskStarted,
  type OrchestratorState,
  type ProjectTaskDefinition,
  prepareProjectTaskHandoff,
  projectOrchestratorState,
  recordProjectTaskOwnerLossRecoveries,
  reserveProjectTaskStart,
  retrySettledProjectTaskRecoveries,
  selectSchedulableProjectTasks,
  settleProjectTask,
  settleProjectTaskRecoveryObligation,
} from "../../../src/state/transitions.ts";

const revision = "a".repeat(40);

/**
 * 新形式の結果受理本文の閉集合を検証する。
 * @responsibility 十一項目、初回世代、識別子、Hashと旧形式拒否を確認する。
 * @trace PRL-UT-006
 * @precondition 実行資源を持たない固定本文を使用する。
 * @stimulus 正常本文と各項目の欠落・不正値・追加項目を検査する。
 * @observation decoderの返却値と入力の保持を観測する。
 * @oracle 正常値だけ固定値を返し、未評価や旧形式を補完しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Test Source→受理本文decoder。
 */
it("結果受理本文は十一項目を固定し旧領収書を受け付けない", () => {
  const acceptance = {
    repositoryBindingId: "repository-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "logical-operation-a",
    recoveryId: "recovery-a",
    settlementGeneration: 7,
    repositoryBinding: "a".repeat(64),
    resultId: "b".repeat(64),
    consumer: "orchestrator",
  };
  const decoded = decodeProjectResultAcceptance(acceptance);
  assert.ok(decoded);
  assert.deepEqual({ ...decoded }, acceptance);
  assert.equal(Object.getPrototypeOf(decoded), null);
  assert.ok(Object.isFrozen(decoded));
  assert.equal(decoded?.settlementGeneration, 7);
  for (const key of Object.keys(acceptance)) {
    const missing: Record<string, unknown> = { ...acceptance };
    delete missing[key];
    assert.equal(decodeProjectResultAcceptance(missing), null, key);
  }
  for (const key of [
    "repositoryBindingId",
    "projectId",
    "milestoneId",
    "taskId",
    "attemptId",
    "operationId",
    "recoveryId",
  ]) {
    for (const invalid of ["", "x".repeat(1025), null, 1])
      assert.equal(
        decodeProjectResultAcceptance({ ...acceptance, [key]: invalid }),
        null,
      );
  }
  for (const key of ["repositoryBinding", "resultId"]) {
    for (const invalid of ["", "A".repeat(64), "a".repeat(63), null])
      assert.equal(
        decodeProjectResultAcceptance({ ...acceptance, [key]: invalid }),
        null,
      );
  }
  for (const settlementGeneration of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
    "7",
  ])
    assert.equal(
      decodeProjectResultAcceptance({ ...acceptance, settlementGeneration }),
      null,
    );
  for (const consumer of ["workbench", "cli", null])
    assert.equal(
      decodeProjectResultAcceptance({ ...acceptance, consumer }),
      null,
    );
  for (const key of [
    "extra",
    "runtimeStateBinding",
    "receiptContentHash",
    "receiptContentIdentity",
  ])
    assert.equal(
      decodeProjectResultAcceptance({ ...acceptance, [key]: "legacy" }),
      null,
    );
  let isGetterCalled = false;
  const accessor = Object.defineProperty({ ...acceptance }, "resultId", {
    enumerable: true,
    get() {
      isGetterCalled = true;
      return acceptance.resultId;
    },
  });
  assert.equal(decodeProjectResultAcceptance(accessor), null);
  assert.equal(isGetterCalled, false);
  assert.equal(decodeProjectResultAcceptance(new Proxy(acceptance, {})), null);
  assert.equal(acceptance.settlementGeneration, 7);
});

/**
 * taskのTest準備責務を実行する。
 *
 * @responsibility taskがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus taskを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function task(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return Object.freeze({
    id,
    objectiveId: "objective-1",
    dependencies,
    allowedPaths,
    conflictKeys,
  });
}

/**
 * stateForのTest準備責務を実行する。
 *
 * @responsibility stateForがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus stateForを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function stateFor(
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  const result = createOrchestratorState({
    projectId: "crdd",
    milestoneId: "v0.19",
    repositoryRevision: revision,
    maximumConcurrency,
    milestoneAcceptanceCriteria: ["全Objectiveの統合結果が整合する"],
    objectives: [
      {
        id: "objective-1",
        acceptanceCriteria: ["必要Taskの結果が統合される"],
      },
    ],
    tasks,
    ownerGeneration: "owner-1",
  });
  assert.equal(result.status, "completed");
  assert.ok(result.state);
  return result.state;
}

/**
 * startのTest準備責務を実行する。
 *
 * @responsibility startがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus startを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function start(
  state: OrchestratorState,
  taskId: string,
  attemptId = `attempt-${taskId}`,
) {
  const reserved = reserveProjectTaskStart(
    state,
    state.generation,
    taskId,
    attemptId,
    `authority-${taskId}`,
  );
  assert.equal(reserved.status, "completed");
  assert.ok(reserved.state);
  const prepared = prepareProjectTaskHandoff(
    reserved.state,
    reserved.state.generation,
    taskId,
    attemptId,
    `operation-${taskId}`,
  );
  assert.equal(prepared.status, "completed");
  assert.ok(prepared.state);
  const observed = observeProjectTaskStarted(
    prepared.state,
    prepared.state.generation,
    taskId,
    attemptId,
    `operation-${taskId}`,
  );
  assert.equal(observed.status, "completed");
  assert.ok(observed.state);
  return observed.state;
}

/**
 * 通常終端の全結果受領を回復義務へ変換せず固定する。
 * @responsibility 正常・失敗・取消と0／1／2件受領の世代・対象相関を検証する。
 * @trace PRL-UT-006
 * @precondition 純粋モデルの開始済みTaskを使用する。
 * @stimulus 終端候補へ受領集合を記録し、欠落・重複・別Attemptと再入場を与える。
 * @observation Task状態、受領集合、世代、元状態の保持を確認する。
 * @oracle 通常結果を回復待ちへ変更せず、本文変更を拒否し初回世代を維持する。
 * @cleanup N/A: 実資源とFilesystemを作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Test→Taskモデル。耐久保存と実Dockerは対象外。
 */
it("通常結果の受領集合はTask終端と初回受領世代を維持する", () => {
  for (const outcome of ["completed", "failed", "cancelled"] as const) {
    const running = start(stateFor([task("task-a")]), "task-a");
    const settlement = settleProjectTask(running, running.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome,
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(settlement.state);
    const state = settlement.state;
    const acceptance = Object.freeze({
      repositoryBindingId: "repository-a",
      projectId: state.projectId,
      milestoneId: state.milestoneId,
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      recoveryId: "recovery-a",
      settlementGeneration: state.generation,
      repositoryBinding: "a".repeat(64),
      resultId: "b".repeat(64),
      consumer: "orchestrator",
    });
    assert.equal(
      recordProjectTaskResultAcceptances(
        state,
        running.generation,
        "task-a",
        [],
      ).state,
      state,
    );
    for (const count of [1, 2]) {
      const groups =
        count === 1
          ? [acceptance]
          : [
              acceptance,
              {
                ...acceptance,
                recoveryId: "recovery-b",
                resultId: "c".repeat(64),
              },
            ];
      const recorded = recordProjectTaskResultAcceptances(
        state,
        running.generation,
        "task-a",
        groups,
      );
      assert.equal(recorded.status, "completed");
      assert.ok(recorded.state);
      assert.equal(recorded.state.tasks[0]?.state, outcome);
      assert.deepEqual(recorded.state.tasks[0]?.recoveryObligations, []);
      assert.equal(recorded.state.tasks[0]?.resultAcceptances.length, count);
      const advanced = {
        ...recorded.state,
        generation: recorded.state.generation + 3,
      };
      const replay = recordProjectTaskResultAcceptances(
        advanced,
        advanced.generation - 1,
        "task-a",
        [...groups].reverse(),
      );
      assert.equal(replay.status, "completed");
      assert.equal(replay.state, advanced);
      assert.equal(
        replay.state.tasks[0]?.resultAcceptances[0]?.settlementGeneration,
        acceptance.settlementGeneration,
      );
      assert.equal(
        recordProjectTaskResultAcceptances(
          advanced,
          advanced.generation - 1,
          "task-a",
          groups.map((entry) => ({ ...entry, resultId: "d".repeat(64) })),
        ).status,
        "blocked",
      );
      assert.equal(
        recordProjectTaskResultAcceptances(
          advanced,
          advanced.generation - 1,
          "task-a",
          [],
        ).status,
        "blocked",
      );
    }
    for (const key of [
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
    ] as const)
      assert.equal(
        recordProjectTaskResultAcceptances(
          state,
          running.generation,
          "task-a",
          [{ ...acceptance, [key]: "foreign" }],
        ).status,
        "blocked",
        key,
      );
    for (const generation of [state.generation - 1, state.generation + 1])
      assert.equal(
        recordProjectTaskResultAcceptances(
          state,
          running.generation,
          "task-a",
          [{ ...acceptance, settlementGeneration: generation }],
        ).status,
        "blocked",
      );
    assert.equal(
      recordProjectTaskResultAcceptances(state, running.generation, "task-a", [
        acceptance,
        acceptance,
      ]).status,
      "blocked",
    );
    assert.equal(
      recordProjectTaskResultAcceptances(state, running.generation, "task-a", [
        acceptance,
        {
          ...acceptance,
          recoveryId: "recovery-b",
          repositoryBindingId: "other-repository",
        },
      ]).status,
      "blocked",
    );
    assert.equal(
      recordProjectTaskResultAcceptances(
        running,
        running.generation - 1,
        "task-a",
        [acceptance],
      ).status,
      "blocked",
    );
    const unclean = {
      ...state,
      tasks: state.tasks.map((entry) => ({
        ...entry,
        cleanupConfirmed: false,
      })),
    };
    assert.equal(
      recordProjectTaskResultAcceptances(
        unclean,
        unclean.generation - 1,
        "task-a",
        [acceptance],
      ).status,
      "blocked",
    );
    const unresolved = {
      ...state,
      tasks: state.tasks.map((entry) => ({
        ...entry,
        recoveryUnresolved: true,
      })),
    };
    assert.equal(
      recordProjectTaskResultAcceptances(
        unresolved,
        unresolved.generation - 1,
        "task-a",
        [acceptance],
      ).status,
      "blocked",
    );
  }
});

describe("Orchestrator state contract", () => {
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Hostが有効なowner generationを供給しない場合は状態を作らない", () => {
    const state = createOrchestratorState({
      projectId: "crdd",
      milestoneId: "v0.20",
      repositoryRevision: revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["全Taskが完了する"],
      objectives: [
        { id: "objective-1", acceptanceCriteria: ["結果が受理される"] },
      ],
      tasks: [task("task-1")],
      ownerGeneration: "",
    });

    assert.equal(state.status, "blocked");
    assert.equal(state.reason, "orchestrator_input_invalid");
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("受入条件の説明文をPathとして正規化しない", () => {
    const state = createOrchestratorState({
      projectId: "crdd",
      milestoneId: "v0.19",
      repositoryRevision: revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["末尾は\\nである"],
      objectives: [
        { id: "objective-1", acceptanceCriteria: ["値はC:\\workである"] },
      ],
      tasks: [task("task-1", [], ["src\\file.ts"])],
      ownerGeneration: "owner-1",
    });
    assert.equal(state.status, "completed");
    assert.equal(
      state.state?.milestone.acceptanceCriteria[0],
      "末尾は\\nである",
    );
    assert.equal(
      state.state?.objectives[0]?.definition.acceptanceCriteria[0],
      "値はC:\\workである",
    );
    assert.equal(
      state.state?.tasks[0]?.definition.allowedPaths[0],
      "src/file.ts",
    );
  });

  /**
   * Task定義のRepository外Pathを状態へ取り込まないを検証する。
   *
   * @responsibility Task定義のRepository外Pathを状態へ取り込まないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Task定義のRepository外Pathを状態へ取り込まないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Task定義のRepository外Pathを状態へ取り込まない", () => {
    for (const pathValue of ["C:\\outside", "/outside", "../outside"]) {
      const state = createOrchestratorState({
        projectId: "crdd",
        milestoneId: "v0.20",
        repositoryRevision: revision,
        maximumConcurrency: 1,
        milestoneAcceptanceCriteria: ["全Taskが完了する"],
        objectives: [
          { id: "objective-1", acceptanceCriteria: ["結果が受理される"] },
        ],
        tasks: [task("task-1", [], [pathValue])],
        ownerGeneration: "owner-1",
      });
      assert.equal(state.status, "blocked");
      assert.equal(state.reason, "orchestrator_task_definition_invalid");
      assert.equal(state.state, null);
    }
  });

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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("7件の独立Taskから最大5件だけを選ぶ", () => {
    const state = stateFor(
      Array.from({ length: 7 }, (_unused, index) => task(`task-${index + 1}`)),
    );
    assert.deepEqual(selectSchedulableProjectTasks(state), [
      "task-1",
      "task-2",
      "task-3",
      "task-4",
      "task-5",
    ]);
  });

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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Dependency完了後だけ後続Taskをreadyへ進める", () => {
    let state = stateFor([task("task-a"), task("task-b", ["task-a"])]);
    assert.deepEqual(selectSchedulableProjectTasks(state), ["task-a"]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
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
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), ["task-b"]);
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("同じPathまたはConflict keyのTaskを同時に選ばない", () => {
    const state = stateFor([
      task("task-a", [], ["shared/file.txt"]),
      task("task-b", [], ["shared/file.txt"]),
      task("task-c", [], ["other.txt"], ["schema-x"]),
      task("task-d", [], ["more.txt"], ["schema-x"]),
    ]);
    assert.deepEqual(selectSchedulableProjectTasks(state), [
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("親Directoryと子Pathを競合として扱う", () => {
    const state = stateFor([
      task("task-a", [], ["src"]),
      task("task-b", [], ["src/runtime/file.ts"]),
      task("task-c", [], ["docs/file.md"]),
    ]);
    assert.deepEqual(selectSchedulableProjectTasks(state), [
      "task-a",
      "task-c",
    ]);
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("cleanup不明のTaskを空き枠へ補正しない", () => {
    let state = stateFor([task("task-a"), task("task-b")], 1);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
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
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), []);
  });

  /**
   * 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するを検証する。
   *
   * @responsibility 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("取消済みTaskをObjectiveとMilestoneの取消へ同じ世代で投影する", () => {
    let state = stateFor([task("task-a")], 1);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "cancelled",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    const projection = projectOrchestratorState(settled.state);
    assert.equal(projection.milestoneState, "cancelled");
    assert.equal(projection.objectiveCounts.cancelled, 1);
    assert.equal(projection.taskCounts.cancelled, 1);
    assert.equal(projection.nextAction, "wait_for_task");
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Recovery中はcleanup後も競合予約を維持する", () => {
    let state = stateFor([
      task("task-a", [], ["shared/file.txt"]),
      task("task-b", [], ["shared/file.txt"]),
      task("task-c"),
    ]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
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
    assert.deepEqual(selectSchedulableProjectTasks(settled.state), ["task-c"]);
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("古い世代と別attemptの結果を反映しない", () => {
    const initial = stateFor([task("task-a")]);
    const state = start(initial, "task-a");
    assert.equal(
      settleProjectTask(state, initial.generation, {
        taskId: "task-a",
        attemptId: "wrong-attempt",
        operationId: "operation-task-a",
        authorityBindingId: "authority-task-a",
        outcome: "completed",
        cleanupConfirmed: true,
        recoveryObligations: [],
        recoveryUnresolved: false,
      }).reason,
      "orchestrator_task_settlement_mismatch",
    );
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("cycleと欠落DependencyをEffect前に拒否する", () => {
    for (const tasks of [
      [task("task-a", ["task-b"]), task("task-b", ["task-a"])],
      [task("task-a", ["missing"])],
    ]) {
      const result = createOrchestratorState({
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
      assert.equal(result.reason, "orchestrator_task_graph_invalid");
      assert.equal(result.state, null);
    }
  });

  /**
   * Task完了だけではObjectiveまたはMilestoneを受け入れないを検証する。
   *
   * @responsibility Task完了だけではObjectiveまたはMilestoneを受け入れないの合否判定を所有する。
   * @trace PRL-UT-007
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Task完了だけではObjectiveまたはMilestoneを受け入れないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-007=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Task完了だけではObjectiveまたはMilestoneを受け入れない", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
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
    assert.equal(settled.state.objectives[0]?.state, "integration_pending");
    assert.equal(settled.state.milestone.state, "executing");
    assert.deepEqual(projectOrchestratorState(settled.state), {
      projectId: "crdd",
      milestoneId: "v0.19",
      generation: 5,
      milestoneState: "executing",
      objectiveCounts: {
        planned: 0,
        executing: 0,
        integration_pending: 1,
        accepted: 0,
        returned: 0,
        blocked: 0,
        cancelled: 0,
      },
      taskCounts: {
        planned: 0,
        waiting_dependency: 0,
        ready: 0,
        starting: 0,
        running: 0,
        cleanup_pending: 0,
        completed: 1,
        failed: 0,
        cancelled: 0,
        recovery_required: 0,
        superseded: 0,
      },
      objectiveTaskSummaries: [
        {
          objectiveId: "objective-1",
          objectiveState: "integration_pending",
          taskCounts: {
            planned: 0,
            waiting_dependency: 0,
            ready: 0,
            starting: 0,
            running: 0,
            cleanup_pending: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            recovery_required: 0,
            superseded: 0,
          },
        },
      ],
      workProgress: "tasks_complete",
      qualityState: "integration_pending",
      humanDecisionRequired: false,
      recoveryRequired: false,
      nextAction: "verify_objective_integration",
    });
  });

  /**
   * ObjectiveとMilestoneを別々の統合Evidenceで受け入れるを検証する。
   *
   * @responsibility ObjectiveとMilestoneを別々の統合Evidenceで受け入れるの合否判定を所有する。
   * @trace PRL-UT-007
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus ObjectiveとMilestoneを別々の統合Evidenceで受け入れるの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-007=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("ObjectiveとMilestoneを別々の統合Evidenceで受け入れる", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    const waitingObjective = applyOrchestratorAcceptanceDecision(
      settled.state,
      settled.state.generation,
      {
        target: "objective",
        targetId: "objective-1",
        decision: "wait",
        criterionEvidenceIds: [],
      },
    );
    assert.equal(waitingObjective.status, "completed");
    assert.equal(waitingObjective.state, settled.state);
    const returnedObjective = applyOrchestratorAcceptanceDecision(
      settled.state,
      settled.state.generation,
      {
        target: "objective",
        targetId: "objective-1",
        decision: "return",
        criterionEvidenceIds: ["evidence-objective-return"],
      },
    );
    assert.equal(returnedObjective.status, "completed");
    assert.equal(returnedObjective.state.objectives[0]?.state, "returned");
    const objective = applyOrchestratorAcceptanceDecision(
      settled.state,
      settled.state.generation,
      {
        target: "objective",
        targetId: "objective-1",
        decision: "accept",
        criterionEvidenceIds: ["evidence-objective-1"],
      },
    );
    assert.equal(objective.status, "completed");
    assert.ok(objective.state);
    assert.equal(objective.state.objectives[0]?.state, "accepted");
    assert.equal(objective.state.milestone.state, "integrating");
    assert.equal(
      projectOrchestratorState(objective.state).nextAction,
      "verify_milestone_integration",
    );
    const waitingMilestone = applyOrchestratorAcceptanceDecision(
      objective.state,
      objective.state.generation,
      {
        target: "milestone",
        targetId: "v0.19",
        decision: "wait",
        criterionEvidenceIds: [],
      },
    );
    assert.equal(waitingMilestone.status, "completed");
    assert.equal(waitingMilestone.state, objective.state);
    const returnedMilestone = applyOrchestratorAcceptanceDecision(
      objective.state,
      objective.state.generation,
      {
        target: "milestone",
        targetId: "v0.19",
        decision: "return",
        criterionEvidenceIds: ["evidence-milestone-return"],
      },
    );
    assert.equal(returnedMilestone.status, "completed");
    assert.equal(returnedMilestone.state.milestone.state, "returned");
    assert.equal(
      projectOrchestratorState(returnedMilestone.state).nextAction,
      "human_decision",
    );
    const milestone = applyOrchestratorAcceptanceDecision(
      objective.state,
      objective.state.generation,
      {
        target: "milestone",
        targetId: "v0.19",
        decision: "accept",
        criterionEvidenceIds: ["evidence-milestone-1"],
      },
    );
    assert.equal(milestone.status, "completed");
    assert.ok(milestone.state);
    assert.equal(milestone.state.milestone.state, "accepted");
    assert.equal(
      projectOrchestratorState(milestone.state).qualityState,
      "accepted",
    );
  });

  /**
   * Task完了だけではObjective受入またはMilestone判断を許可しないことを検証する。
   *
   * @responsibility 下位完了から上位受入を推定しないAcceptance Decision境界の合否判定を所有する。
   * @trace PRL-UT-007
   * @precondition 完了Taskを持つがObjectiveの明示受入前である状態を使用する。
   * @stimulus Objective受入前のMilestone判断と古い世代のObjective判断を要求する。
   * @observation 理由code、状態同一性およびTask ID列を観測する。
   * @oracle 両入力を理由付きで拒否し、状態とTask集合を変更しない。
   * @cleanup N/A: Process内の不変値だけを使用する。
   * @boundary PRL-UT-007=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Task完了だけではObjective受入またはMilestone判断を許可しない", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    const milestone = applyOrchestratorAcceptanceDecision(
      settled.state,
      settled.state.generation,
      {
        target: "milestone",
        targetId: "v0.19",
        decision: "accept",
        criterionEvidenceIds: ["evidence-milestone-1"],
      },
    );
    assert.equal(milestone.reason, "orchestrator_acceptance_decision_mismatch");
    assert.equal(milestone.state, settled.state);
    const staleObjective = applyOrchestratorAcceptanceDecision(
      settled.state,
      settled.state.generation - 1,
      {
        target: "objective",
        targetId: "objective-1",
        decision: "accept",
        criterionEvidenceIds: ["evidence-objective-1"],
      },
    );
    assert.equal(
      staleObjective.reason,
      "orchestrator_acceptance_decision_mismatch",
    );
    assert.equal(staleObjective.state, settled.state);
    assert.deepEqual(staleObjective.taskIds, []);
  });

  /**
   * 依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達するを検証する。
   *
   * @responsibility 依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("依存されない失敗Taskの部分再計画は旧履歴を保持したまま最終受入へ到達する", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const failed = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "failed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(failed.state);
    const replanned = applyOrchestratorPartialReplan(
      failed.state,
      failed.state.generation,
      {
        failedTaskId: "task-a",
        replacements: [task("task-b")],
        maximumReplans: 1,
      },
    );
    assert.equal(replanned.status, "completed");
    assert.ok(replanned.state);
    state = start(replanned.state, "task-b");
    const completed = settleProjectTask(state, state.generation, {
      taskId: "task-b",
      attemptId: "attempt-task-b",
      operationId: "operation-task-b",
      authorityBindingId: "authority-task-b",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(completed.state);
    assert.deepEqual(
      completed.state.tasks.map((entry) => [entry.definition.id, entry.state]),
      [
        ["task-a", "superseded"],
        ["task-b", "completed"],
      ],
    );
    assert.equal(completed.state.objectives[0]?.state, "integration_pending");
    assert.equal(
      projectOrchestratorState(completed.state).workProgress,
      "tasks_complete",
    );
    const objective = applyOrchestratorAcceptanceDecision(
      completed.state,
      completed.state.generation,
      {
        target: "objective",
        targetId: "objective-1",
        decision: "accept",
        criterionEvidenceIds: ["evidence-objective-replan"],
      },
    );
    assert.ok(objective.state);
    const milestone = applyOrchestratorAcceptanceDecision(
      objective.state,
      objective.state.generation,
      {
        target: "milestone",
        targetId: "v0.19",
        decision: "accept",
        criterionEvidenceIds: ["evidence-milestone-replan"],
      },
    );
    assert.ok(milestone.state);
    const projection = projectOrchestratorState(milestone.state);
    assert.equal(projection.milestoneState, "accepted");
    assert.equal(projection.workProgress, "tasks_complete");
    assert.equal(projection.qualityState, "accepted");
  });

  /**
   * 生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えないを検証する。
   *
   * @responsibility 生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("生存する依存Taskを持つ失敗Taskの部分再計画は暗黙に依存を付け替えない", () => {
    let state = stateFor([task("task-a"), task("task-b", ["task-a"])]);
    state = start(state, "task-a");
    const failed = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "failed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(failed.state);
    const before = JSON.stringify(failed.state);
    const rejected = applyOrchestratorPartialReplan(
      failed.state,
      failed.state.generation,
      {
        failedTaskId: "task-a",
        replacements: [task("task-c")],
        maximumReplans: 1,
      },
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(
      rejected.reason,
      "orchestrator_replan_invalid_or_out_of_scope",
    );
    assert.equal(JSON.stringify(rejected.state), before);
    assert.deepEqual(rejected.taskIds, []);
  });

  /**
   * 古い世代と統合待ち前の受入を拒否するを検証する。
   *
   * @responsibility 古い世代と統合待ち前の受入を拒否するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 古い世代と統合待ち前の受入を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("古い世代と統合待ち前の受入を拒否する", () => {
    const state = stateFor([task("task-a")]);
    assert.equal(
      applyOrchestratorAcceptanceDecision(state, state.generation, {
        target: "objective",
        targetId: "objective-1",
        decision: "accept",
        criterionEvidenceIds: ["evidence-objective-1"],
      }).reason,
      "orchestrator_acceptance_decision_mismatch",
    );
    assert.equal(
      applyOrchestratorAcceptanceDecision(state, state.generation - 1, {
        target: "milestone",
        targetId: "v0.19",
        decision: "accept",
        criterionEvidenceIds: ["evidence-milestone-1"],
      }).reason,
      "orchestrator_acceptance_decision_mismatch",
    );
  });

  /**
   * 受入条件ごとのEvidenceが不足する場合は受入を拒否するを検証する。
   *
   * @responsibility 受入条件ごとのEvidenceが不足する場合は受入を拒否するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 受入条件ごとのEvidenceが不足する場合は受入を拒否するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("受入条件ごとのEvidenceが不足する場合は受入を拒否する", () => {
    const created = createOrchestratorState({
      projectId: "crdd",
      milestoneId: "v0.19",
      repositoryRevision: revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["条件A", "条件B"],
      objectives: [
        {
          id: "objective-1",
          acceptanceCriteria: ["条件1", "条件2"],
        },
      ],
      tasks: [task("task-a")],
      ownerGeneration: "owner-1",
    });
    assert.ok(created.state);
    const state = start(created.state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "completed",
      cleanupConfirmed: true,
      recoveryObligations: [],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    assert.equal(
      applyOrchestratorAcceptanceDecision(
        settled.state,
        settled.state.generation,
        {
          target: "objective",
          targetId: "objective-1",
          decision: "accept",
          criterionEvidenceIds: ["evidence-only-one"],
        },
      ).reason,
      "orchestrator_acceptance_decision_mismatch",
    );
  });

  /**
   * Recoveryを進捗や品質の成功へ補正しないを検証する。
   *
   * @responsibility Recoveryを進捗や品質の成功へ補正しないの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Recoveryを進捗や品質の成功へ補正しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Recoveryを進捗や品質の成功へ補正しない", () => {
    let state = stateFor([task("task-a")]);
    state = start(state, "task-a");
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "recovery_required",
      cleanupConfirmed: false,
      recoveryObligations: [
        {
          kind: "docker",
          recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
          phase: "required",
        },
      ],
      recoveryUnresolved: false,
    });
    assert.ok(settled.state);
    const projection = projectOrchestratorState(settled.state);
    assert.equal(projection.workProgress, "in_progress");
    assert.equal(projection.qualityState, "blocked");
    assert.equal(projection.recoveryRequired, true);
    assert.equal(projection.nextAction, "recover");
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("owner lossはAuthority発行前のstartingをEffect 0でreadyへ戻す", () => {
    const state = stateFor([task("task-a")]);
    const reserved = reserveProjectTaskStart(
      state,
      state.generation,
      "task-a",
      "attempt-task-a",
      "authority-task-a",
    );
    assert.ok(reserved.state);
    const recovered = recordProjectTaskOwnerLossRecoveries(
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("owner lossは開始済みTaskをexact Runtime Recoveryへ結合する", () => {
    const running = start(stateFor([task("task-a")]), "task-a");
    const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
    const recovered = recordProjectTaskOwnerLossRecoveries(
      running,
      running.generation,
      [
        {
          operationId: "operation-task-a",
          status: "matched",
          recoveryId,
        },
      ],
    );
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("handoff準備済みTaskは排他下の不存在確認後だけEffect 0でreadyへ戻す", () => {
    const initial = stateFor([task("task-a")]);
    const reserved = reserveProjectTaskStart(
      initial,
      initial.generation,
      "task-a",
      "attempt-task-a",
      "authority-task-a",
    );
    assert.ok(reserved.state);
    const prepared = prepareProjectTaskHandoff(
      reserved.state,
      reserved.state.generation,
      "task-a",
      "attempt-task-a",
      "operation-task-a",
    );
    assert.ok(prepared.state);
    const recovered = recordProjectTaskOwnerLossRecoveries(
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
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("running Taskを不存在観測だけでreadyへ戻さない", () => {
    const running = start(stateFor([task("task-a")]), "task-a");
    const recovered = recordProjectTaskOwnerLossRecoveries(
      running,
      running.generation,
      [
        {
          operationId: "operation-task-a",
          status: "verified_absent",
          recoveryId: null,
        },
      ],
    );
    assert.equal(recovered.status, "blocked");
    assert.equal(recovered.state?.tasks[0]?.state, "running");
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
  it("複数種のRecoveryを項目ごとの受領状態で保持する", () => {
    let state = start(stateFor([task("task-a")]), "task-a");
    const dockerId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
    const hostId = `host-task.${"d".repeat(64)}`;
    const settled = settleProjectTask(state, state.generation, {
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
    });
    assert.ok(settled.state);
    state = settled.state;
    const recovering = markProjectTaskRecoveryObligationRecovering(
      state,
      state.generation,
      "task-a",
      "docker",
      dockerId,
    );
    assert.ok(recovering.state);
    const itemSettled = settleProjectTaskRecoveryObligation(
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
    const acknowledgement = {
      repositoryBindingId: "binding-a",
      projectId: "crdd",
      milestoneId: "v0.19",
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      recoveryId: dockerId,
      settlementGeneration: itemSettled.state.generation,
      repositoryBinding: "1".repeat(64),
      resultId: "5".repeat(64),
      consumer: "orchestrator" as const,
    };
    for (const replacement of [
      { ...acknowledgement, projectId: "other-project" },
      { ...acknowledgement, milestoneId: "other-milestone" },
      { ...acknowledgement, taskId: "other-task" },
      { ...acknowledgement, attemptId: "other-attempt" },
      { ...acknowledgement, operationId: "other-operation" },
      { ...acknowledgement, recoveryId: hostId },
      {
        ...acknowledgement,
        settlementGeneration: acknowledgement.settlementGeneration + 1,
      },
    ]) {
      const rejected = acknowledgeProjectDockerRecoveryObligation(
        itemSettled.state,
        itemSettled.state.generation,
        replacement,
      );
      assert.equal(rejected.status, "blocked");
      assert.equal(rejected.state, itemSettled.state);
    }
    let accessorCalls = 0;
    const accessor = Object.defineProperty({ ...acknowledgement }, "taskId", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return acknowledgement.taskId;
      },
    });
    let proxyCalls = 0;
    const proxy = new Proxy(acknowledgement, {
      get(target, key) {
        proxyCalls += 1;
        return Reflect.get(target, key);
      },
    });
    for (const hostile of [accessor, proxy]) {
      const rejected = acknowledgeProjectDockerRecoveryObligation(
        itemSettled.state,
        itemSettled.state.generation,
        hostile,
      );
      assert.equal(rejected.status, "blocked");
      assert.equal(rejected.state, itemSettled.state);
    }
    assert.equal(accessorCalls, 0);
    assert.equal(proxyCalls, 0);
    const acknowledged = acknowledgeProjectDockerRecoveryObligation(
      itemSettled.state,
      itemSettled.state.generation,
      acknowledgement,
    );
    assert.equal(acknowledged.status, "completed");
    assert.equal(
      acknowledged.state?.tasks[0]?.recoveryObligations[0]?.phase,
      "acknowledged",
    );
    assert.equal(
      acknowledged.state?.tasks[0]?.recoveryObligations[0]?.acknowledgement
        ?.operationId,
      "operation-task-a",
    );
    assert.equal(
      retrySettledProjectTaskRecoveries(
        acknowledged.state ?? itemSettled.state,
        acknowledged.state?.generation ?? itemSettled.state.generation,
        ["task-a"],
      ).status,
      "blocked",
    );
    assert.ok(acknowledged.state);
    const hostRecovering = markProjectTaskRecoveryObligationRecovering(
      acknowledged.state,
      acknowledged.state.generation,
      "task-a",
      "host",
      hostId,
    );
    assert.equal(hostRecovering.status, "completed");
    assert.ok(hostRecovering.state);
    const allSettled = settleProjectTaskRecoveryObligation(
      hostRecovering.state,
      hostRecovering.state.generation,
      "task-a",
      "host",
      hostId,
    );
    assert.equal(allSettled.status, "completed");
    assert.ok(allSettled.state);
    const retryReady = retrySettledProjectTaskRecoveries(
      allSettled.state,
      allSettled.state.generation,
      ["task-a"],
    );
    assert.equal(retryReady.status, "completed");
    const readyTask = retryReady.state?.tasks[0];
    assert.equal(readyTask?.state, "ready");
    assert.equal(readyTask?.attemptId, null);
    assert.equal(readyTask?.operationId, null);
    assert.deepEqual(
      { ...readyTask?.recoveryObligations[0]?.acknowledgement },
      acknowledgement,
    );
    assert.equal(
      readyTask?.recoveryObligations[0]?.acknowledgement?.settlementGeneration,
      itemSettled.state.generation,
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
  it("Process再起動済みでも外部Effect未解決のTaskをreadyへ戻さない", () => {
    let state = start(stateFor([task("task-a")]), "task-a");
    const runtimeProcessId = `runtime-process.11111111-1111-4111-8111-111111111111.restart-${"a".repeat(40)}`;
    const settled = settleProjectTask(state, state.generation, {
      taskId: "task-a",
      attemptId: "attempt-task-a",
      operationId: "operation-task-a",
      authorityBindingId: "authority-task-a",
      outcome: "recovery_required",
      cleanupConfirmed: false,
      recoveryObligations: [
        {
          kind: "runtime_process",
          recoveryId: runtimeProcessId,
          phase: "required",
        },
      ],
      recoveryUnresolved: true,
    });
    assert.equal(settled.status, "completed");
    assert.ok(settled.state);
    state = settled.state;
    const retry = retrySettledProjectTaskRecoveries(state, state.generation, [
      "task-a",
    ]);
    assert.equal(retry.status, "blocked");
    assert.equal(retry.state?.tasks[0]?.state, "recovery_required");
  });

  /**
   * Lockとstale resultの保持条件を説明するを検証する。
   *
   * @responsibility Lockとstale resultの保持条件を説明するの合否判定を所有する。
   * @trace PRL-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Lockとstale resultの保持条件を説明するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-UT-006=Direct Boundary: orchestrator Test Source→対象契約
   */
  it("Lockとstale resultの保持条件を説明する", () => {
    assert.deepEqual(describeOrchestratorStateContract(), {
      contract: "crdd-coordinator/orchestrator-state/v1",
      maximumConcurrency: 5,
      capacityStates: [
        "starting",
        "running",
        "cleanup_pending",
        "recovery_required_without_cleanup",
      ],
      lockContract:
        "project_operation_then_short_project_state_transaction_never_held_across_single_task_runtime",
      staleResult:
        "generation_attempt_and_operation_identity_mismatch_blocks_without_projection",
      acceptanceContract:
        "task_completion_then_objective_integration_then_milestone_integration",
    });
  });
});
