/**
 * Workspaceの固定候補と現在Project投影を検証する。
 * @packageDocumentation
 * @responsibility 結合・世代・非使用・破棄条件と有限時計を反証する。
 * @trace PRL-UT-007
 * @level UT
 * @scope 合成Snapshotの値操作と有限同期時刻観測。
 * @boundary 実Git・保存・認可・資源不存在を証明しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareCoordinatorIntegrationRecordCreation as resultCandidate,
  prepareCoordinatorWorkspaceRecordUpdate as workspaceCandidate,
  projectCoordinatorCurrentState,
  validCoordinatorWorkspace,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  encodeRuntimeStateValue,
  type CoordinatorSnapshot,
  type CoordinatorWorkspace,
  type CoordinatorState,
} from "../../../src/index.ts";
/**
 * 局所候補の共通値を組み立てる。
 * @responsibility 元の判定順・返却形・対象外保持を反証する。
 * @trace PRL-UT-007
 * @precondition 値操作に必要な合成Snapshotのみ。全体codec・実保存の成立は主張しない。
 * @stimulus 固定用途関数へ成功値と不一致値を渡す。
 * @observation 結果全文、入力本文、時計呼出し数と順序。
 * @oracle 拒否では候補なし、成功では対象区画のみ変更する。
 * @cleanup N/A: メモリ値のみ。
 * @boundary Domain固定候補。実Owner・Authority・保存は別の結合試験。
 */

function fixture() {
  const id = "11111111-1111-1111-1111-111111111111";
  const workspace: CoordinatorWorkspace = {
    workspaceId: id,
    name: null,
    candidate: null,
    generation: 1,
    baseCommit: "a".repeat(40),
    head: "a".repeat(40),
    phase: "ready",
    holdUntil: null,
    pending: null,
    lastResult: {
      status: "completed",
      reason: "worktree_removed",
      workspaceId: id,
      relativePath: null,
      branch: null,
      expectedCommit: null,
      effectIssued: true,
      worktreeRemoved: true,
      branchRemoved: true,
      workspaceDirectoryRetained: false,
      observation: null,
    },
    primaryFailure: null,
  };
  assert.equal(validCoordinatorWorkspace(workspace), true);
  const current: CoordinatorSnapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [],
    queueEntries: [
      {
        queueId: "queue-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        requestHash: "b".repeat(64),
        originLane: "interactive",
        repositoryRevision: "a".repeat(40),
        scopeHash: "c".repeat(64),
        state: "queued",
        generation: 1,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
        workspaceId: id,
      },
    ],
    workspaces: [workspace],
    leaseEvidence: [],
    leaseIntents: [
      {
        projectId: "project-a",
        queueId: "queue-a",
        kind: "project-operation",
        ownerGeneration: "owner-a",
        ownerProcessId: 7,
        recoveryId: "recovery-a",
        phase: "lock_owned",
      },
    ],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  return { id, workspace, current };
}
/**
 * 統合結果の新規候補・無書込み再入場・衝突・結合差を確認する。
 * @responsibility 元の判定順・返却形・対象外保持を反証する。
 * @trace PRL-UT-007
 * @precondition 値操作に必要な合成Snapshotのみ。全体codec・実保存の成立は主張しない。
 * @stimulus 固定用途関数へ成功値と不一致値を渡す。
 * @observation 結果全文、入力本文、時計呼出し数と順序。
 * @oracle 拒否では候補なし、成功では対象区画のみ変更する。
 * @cleanup N/A: メモリ値のみ。
 * @boundary Domain固定候補。実Owner・Authority・保存は別の結合試験。
 */

test("結果候補は元の本文HashとIdentityを保つ", () => {
  const { current } = fixture();
  const before = encodeRuntimeStateValue(current);
  const binding = {
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
  };
  const record = {
    kind: "integration" as const,
    identity: "candidate-a",
    value: { result: "synthetic" },
  };
  const created = resultCandidate(current, binding, record);
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  assert.equal(created.value.next.results.length, 1);
  assert.strictEqual(created.value.next.workspaces, current.workspaces);
  assert.deepEqual(resultCandidate(created.value.next, binding, record), {
    status: "completed",
    reason: "orchestrator_result_durable",
    value: { next: null, value: { written: true } },
  });
  assert.equal(
    resultCandidate(created.value.next, binding, {
      ...record,
      value: { result: "other" },
    }).reason,
    "orchestrator_result_identity_conflict",
  );
  assert.equal(
    resultCandidate(current, { ...binding, projectId: "project-b" }, record)
      .reason,
    "orchestrator_result_binding_invalid",
  );
  assert.equal(
    resultCandidate(current, binding, { ...record, identity: "../escape" })
      .reason,
    "orchestrator_result_invalid",
  );
  assert.equal(Object.isFrozen(created), true);
  assert.equal(Object.isFrozen(created.value), false);
  assert.equal(encodeRuntimeStateValue(current), before);
});
/**
 * Workspace拒否と非削除では時計を呼ばず、削除成立時だけ二回観測する。
 * @responsibility 元の判定順・返却形・対象外保持を反証する。
 * @trace PRL-UT-007
 * @precondition 値操作に必要な合成Snapshotのみ。全体codec・実保存の成立は主張しない。
 * @stimulus 固定用途関数へ成功値と不一致値を渡す。
 * @observation 結果全文、入力本文、時計呼出し数と順序。
 * @oracle 拒否では候補なし、成功では対象区画のみ変更する。
 * @cleanup N/A: メモリ値のみ。
 * @boundary Domain固定候補。実Owner・Authority・保存は別の結合試験。
 */

test("Workspace候補は非使用・元世代・有限時計を維持する", () => {
  const { current, workspace, id } = fixture();
  const before = encodeRuntimeStateValue(current);
  let calls = 0;
  const times = [
    Date.parse("2026-10-27T00:00:00.000Z"),
    Date.parse("2026-10-27T00:00:00.001Z"),
  ];
  const observation = {
    processId: 7,
    now: () => {
      const value = times[calls++];
      assert.equal(typeof value, "number");
      if (value === undefined) throw new Error("clock_calls_exceeded");
      return value;
    },
  };
  const invoke = (
    snapshot = current,
    next: CoordinatorWorkspace | null = null,
    generation = 1,
    pid = 7,
  ) =>
    workspaceCandidate(
      snapshot,
      "project-a",
      "queue-a",
      "owner-a",
      id,
      generation,
      next,
      { ...observation, processId: pid },
    );
  const queue = current.queueEntries[0];
  assert.ok(queue);
  const cases: [
    CoordinatorSnapshot,
    CoordinatorWorkspace | null,
    number,
    number,
    string,
  ][] = [
    [current, null, 1, 8, "lease_mismatch"],
    [{ ...current, queueEntries: [] }, null, 1, 7, "lease_mismatch"],
    [current, null, 0, 7, "generation_conflict"],
    [
      {
        ...current,
        queueEntries: [{ ...queue, workspaceId: "another" }],
      },
      null,
      1,
      7,
      "target_mismatch",
    ],
    [current, { ...workspace, generation: 4 }, 1, 7, "record_invalid"],
    [
      {
        ...current,
        queueEntries: [
          ...current.queueEntries,
          { ...queue, queueId: "queue-b" },
        ],
      },
      null,
      1,
      7,
      "other_queue_pending",
    ],
    [
      {
        ...current,
        workspaces: [{ ...workspace, holdUntil: "2026-11-01T00:00:00.000Z" }],
      },
      {
        ...workspace,
        generation: 2,
        phase: "discarding",
        pending: {
          operationId: id,
          kind: "discard",
          expectedHead: workspace.head,
          discardChanges: false,
        },
      },
      1,
      7,
      "held",
    ],
    [
      {
        ...current,
        projects: [
          {
            projectId: "project-a",
            tasks: [
              {
                state: "running",
                recoveryUnresolved: false,
                recoveryObligations: [],
              },
            ],
          } as unknown as CoordinatorState,
        ],
      },
      null,
      1,
      7,
      "in_use_or_unresolved",
    ],
    [
      { ...current, workspaces: [{ ...workspace, lastResult: null }] },
      null,
      1,
      7,
      "disposal_unconfirmed",
    ],
  ];
  for (const [snapshot, next, generation, pid, reason] of cases) {
    const result = invoke(snapshot, next, generation, pid);
    assert.equal(result.reason, `orchestrator_workspace_${reason}`);
    assert.equal(result.status, "blocked");
    assert.equal(calls, 0);
  }
  const updated = invoke(current, { ...workspace, generation: 2 });
  assert.equal(updated.status, "completed");
  assert.equal(calls, 0);
  const removed = invoke();
  assert.equal(removed.status, "completed");
  assert.equal(calls, 2);
  if (removed.status !== "completed") throw Error("fixture");
  assert.equal(removed.value.next.workspaces.length, 0);
  assert.equal(removed.value.next.queueEntries[0]?.state, "cancelled");
  assert.equal(removed.value.next.queueEntries[0]?.generation, 2);
  assert.deepEqual(removed.value.next.historyPending, [
    {
      id: `workspace-${id}`,
      occurredAt: "2026-10-27T00:00:00.000Z",
      outcome: "cancelled",
      primaryFailure: null,
      cleanup: "confirmed",
    },
  ]);
  assert.strictEqual(removed.value.next.results, current.results);
  assert.equal(encodeRuntimeStateValue(current), before);
  let throwCalls = 0;
  assert.throws(
    () =>
      workspaceCandidate(
        current,
        "project-a",
        "queue-a",
        "owner-a",
        id,
        1,
        null,
        {
          processId: 7,
          now: () => {
            throwCalls++;
            throw Error("clock");
          },
        },
      ),
    /clock/u,
  );
  assert.equal(throwCalls, 1);
  assert.equal(encodeRuntimeStateValue(current), before);
});
/**
 * 現在Project投影の存在・不存在・SchemaとIDの共同拒否を確認する。
 * @responsibility 元の判定順・返却形・対象外保持を反証する。
 * @trace PRL-UT-007
 * @precondition 値操作に必要な合成Snapshotのみ。全体codec・実保存の成立は主張しない。
 * @stimulus 固定用途関数へ成功値と不一致値を渡す。
 * @observation 結果全文、入力本文、時計呼出し数と順序。
 * @oracle 拒否では候補なし、成功では対象区画のみ変更する。
 * @cleanup N/A: メモリ値のみ。
 * @boundary Domain固定候補。実Owner・Authority・保存は別の結合試験。
 */

test("現在Project投影は入力を書き換えず欠測を補完しない", () => {
  const { current } = fixture();
  // この局所投影が読むprojectIdのみを構築する。全体Project検証のfixtureではない。
  const project = { projectId: "project-a" } as CoordinatorState;
  const found = projectCoordinatorCurrentState(
    { ...current, projects: [project] },
    "project-a",
  );
  assert.equal(found.status, "completed");
  if (found.status === "completed") {
    assert.strictEqual(found.value.value, project);
    assert.equal(found.value.next, null);
  }
  assert.deepEqual(projectCoordinatorCurrentState(current, "project-a"), {
    status: "completed",
    reason: "orchestrator_state_observed",
    value: { next: null, value: null },
  });
  assert.equal(
    projectCoordinatorCurrentState(current, "../escape").reason,
    "orchestrator_snapshot_schema_invalid",
  );
  assert.equal(
    projectCoordinatorCurrentState(
      { ...current, schema: "invalid" as never },
      "project-a",
    ).reason,
    "orchestrator_snapshot_schema_invalid",
  );
});
