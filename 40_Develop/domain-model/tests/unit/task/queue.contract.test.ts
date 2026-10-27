/**
 * Queue受付・追加・照会の固定候補を検証する。
 * @packageDocumentation
 * @responsibility 旧epoch、同Identity、Hash差、Workspace結合を反証する。
 * @trace PRL-UT-007
 * @level UT
 * @scope 四つの固定値操作。実行選択・資源観測・保存は対象外。
 * @boundary メモリの局所入力。全体codec・実Ownerの証明ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectCoordinatorQueueIntake,
  prepareCoordinatorQueueEntryCreation,
  projectCoordinatorQueueEntry,
  projectCoordinatorQueueProjectState,
  encodeRuntimeStateValue,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  type CoordinatorSnapshot,
  type CoordinatorState,
  type CoordinatorQueueEnqueueInput,
  type CoordinatorWorkspace,
} from "../../../src/index.ts";
/**
 * 四操作の局所前提値を用意する。
 * @responsibility 受付相関・局所CRUD・対象外保持を検証する。
 * @trace PRL-UT-007
 * @precondition 局所値操作に必要な合成Snapshotを使用する。全体codecや実Authorityのfixtureではない。
 * @stimulus 固定用途へ正常値・不一致値・境界値を渡す。
 * @observation 返却全文、入力本文、候補と対象外参照。
 * @oracle 元の判定順・理由を保ち、拒否・照会・同値再入場は変更候補を作らない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domainの値モデル。保存・Scheduling・回復成立は別の利用側が確認する。
 */

function fixture() {
  // Project存在を読む局所操作用の最小値。全体Project codecの成立は主張しない。
  const project = { projectId: "project-a" } as CoordinatorState;
  const current: CoordinatorSnapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [project],
    queueEntries: [],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  const input: CoordinatorQueueEnqueueInput = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive",
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  const intake = {
    epoch: "epoch-a",
    queueId: input.queueId,
    requestHash: input.requestHash,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
  };
  return { current, input, intake, project };
}
/**
 * 受付の新規・同内容・旧世代と改訂後の同ID継続を確認する。
 * @responsibility 受付相関・局所CRUD・対象外保持を検証する。
 * @trace PRL-UT-007
 * @precondition 局所値操作に必要な合成Snapshotを使用する。全体codecや実Authorityのfixtureではない。
 * @stimulus 固定用途へ正常値・不一致値・境界値を渡す。
 * @observation 返却全文、入力本文、候補と対象外参照。
 * @oracle 元の判定順・理由を保ち、拒否・照会・同値再入場は変更候補を作らない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domainの値モデル。保存・Scheduling・回復成立は別の利用側が確認する。
 */

test("受付固定照合はepoch・ID・Hashを元の順序で保持する", () => {
  const { current, input, intake } = fixture();
  const before = encodeRuntimeStateValue(current);
  assert.deepEqual(inspectCoordinatorQueueIntake(current, intake), {
    status: "completed",
    reason: "orchestrator_intake_verified",
    value: { next: null, value: true },
  });
  for (const change of [
    { epoch: "epoch-b" },
    { queueId: "../escape" },
    { requestHash: "invalid" },
    { projectId: "../escape" },
    { milestoneId: "../escape" },
  ])
    assert.deepEqual(
      inspectCoordinatorQueueIntake(current, { ...intake, ...change }),
      {
        status: "blocked",
        reason: "orchestrator_intake_epoch_retired",
        value: null,
        manualRecoveryRequired: false,
        recoveryId: null,
      },
    );
  const created = prepareCoordinatorQueueEntryCreation(
    current,
    "epoch-a",
    input,
  );
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const rotated = { ...created.value.next, intakeEpoch: "epoch-b" };
  assert.equal(
    inspectCoordinatorQueueIntake(rotated, intake).status,
    "completed",
  );
  for (const change of [
    { epoch: "epoch-b" },
    { requestHash: "d".repeat(64) },
    { projectId: "project-b" },
    { milestoneId: "milestone-b" },
  ])
    assert.equal(
      inspectCoordinatorQueueIntake(rotated, { ...intake, ...change }).status,
      "blocked",
    );
  assert.equal(
    inspectCoordinatorQueueIntake({ ...rotated, intakeBindings: [] }, intake)
      .status,
    "blocked",
  );
  assert.equal(encodeRuntimeStateValue(current), before);
});
/**
 * Queue追加の不変な再入場・衝突・受付退役・不正値を確認する。
 * @responsibility 受付相関・局所CRUD・対象外保持を検証する。
 * @trace PRL-UT-007
 * @precondition 局所値操作に必要な合成Snapshotを使用する。全体codecや実Authorityのfixtureではない。
 * @stimulus 固定用途へ正常値・不一致値・境界値を渡す。
 * @observation 返却全文、入力本文、候補と対象外参照。
 * @oracle 元の判定順・理由を保ち、拒否・照会・同値再入場は変更候補を作らない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domainの値モデル。保存・Scheduling・回復成立は別の利用側が確認する。
 */

test("Queue追加候補は同内容を再保存せず競合の理由を維持する", () => {
  const { current, input } = fixture();
  const before = encodeRuntimeStateValue(current);
  const created = prepareCoordinatorQueueEntryCreation(
    current,
    "epoch-a",
    input,
  );
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const next = created.value.next;
  assert.equal(next.queueEntries.length, 1);
  assert.deepEqual(next.intakeBindings, [
    { queueId: "queue-a", epoch: "epoch-a" },
  ]);
  assert.strictEqual(next.results, current.results);
  assert.strictEqual(next.projects, current.projects);
  assert.equal(Object.isFrozen(created), true);
  assert.equal(Object.isFrozen(created.value), false);
  assert.deepEqual(created.value.value, {
    ...input,
    workspaceId: null,
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
  });
  const reused = prepareCoordinatorQueueEntryCreation(next, "epoch-a", input);
  assert.equal(reused.status, "completed");
  if (reused.status === "completed") {
    assert.equal(reused.value.next, null);
    assert.strictEqual(reused.value.value, next.queueEntries[0]);
  }
  // 既存受付の相関はHash/Project/Milestone/epochに限定される。ここで追加拒否条件を作らない。
  assert.equal(
    prepareCoordinatorQueueEntryCreation(
      { ...next, intakeEpoch: "epoch-b" },
      "epoch-a",
      { ...input, repositoryRevision: "d".repeat(40) },
    ).reason,
    "orchestrator_queue_request_reused",
  );
  for (const change of [
    { requestHash: "d".repeat(64) },
    { projectId: "project-b" },
    { milestoneId: "milestone-b" },
  ])
    assert.equal(
      prepareCoordinatorQueueEntryCreation(next, "epoch-b", {
        ...input,
        ...change,
      }).reason,
      "orchestrator_queue_identity_conflict",
    );
  assert.equal(
    prepareCoordinatorQueueEntryCreation(current, "epoch-b", input).reason,
    "orchestrator_intake_epoch_retired",
  );
  assert.equal(
    prepareCoordinatorQueueEntryCreation(
      { ...current, projects: [] },
      "epoch-a",
      input,
    ).reason,
    "orchestrator_queue_input_invalid",
  );
  for (const change of [
    { queueId: "../escape" },
    { requestHash: "invalid" },
    { milestoneId: null },
    { singleTask: {} },
  ])
    assert.equal(
      prepareCoordinatorQueueEntryCreation(current, "epoch-a", {
        ...input,
        ...change,
      } as unknown as CoordinatorQueueEnqueueInput).reason,
      "orchestrator_queue_input_invalid",
    );
  assert.equal(encodeRuntimeStateValue(current), before);
});
/**
 * Workspaceを再利用するQueue追加は所属・ready・holdを照合する。
 * @responsibility 受付相関・局所CRUD・対象外保持を検証する。
 * @trace PRL-UT-007
 * @precondition 局所値操作に必要な合成Snapshotを使用する。全体codecや実Authorityのfixtureではない。
 * @stimulus 固定用途へ正常値・不一致値・境界値を渡す。
 * @observation 返却全文、入力本文、候補と対象外参照。
 * @oracle 元の判定順・理由を保ち、拒否・照会・同値再入場は変更候補を作らない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domainの値モデル。保存・Scheduling・回復成立は別の利用側が確認する。
 */

test("Queue追加は既存Workspace結合を補完しない", () => {
  const { current, input } = fixture();
  const id = "33333333-3333-3333-3333-333333333333";
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
    lastResult: null,
    primaryFailure: null,
  };
  const created = prepareCoordinatorQueueEntryCreation(
    current,
    "epoch-a",
    input,
  );
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const previous = created.value.value;
  const connected = {
    ...created.value.next,
    workspaces: [workspace],
    queueEntries: [{ ...previous, workspaceId: id }],
  };
  const following = { ...input, queueId: "queue-b", workspaceId: id };
  assert.equal(
    prepareCoordinatorQueueEntryCreation(connected, "epoch-a", following)
      .status,
    "completed",
  );
  for (const modified of [
    { ...connected, workspaces: [] },
    { ...connected, queueEntries: [] },
    {
      ...connected,
      workspaces: [{ ...workspace, phase: "creating" as const }],
    },
    {
      ...connected,
      workspaces: [{ ...workspace, holdUntil: "2026-11-01T00:00:00.000Z" }],
    },
    {
      ...connected,
      queueEntries: [{ ...previous, workspaceId: id, projectId: "project-b" }],
    },
  ])
    assert.equal(
      prepareCoordinatorQueueEntryCreation(modified, "epoch-a", following)
        .reason,
      "orchestrator_workspace_not_ready",
    );
});
/**
 * ProjectとQueueの照会は元の異なる拒否理由と不存在を維持する。
 * @responsibility 受付相関・局所CRUD・対象外保持を検証する。
 * @trace PRL-UT-007
 * @precondition 局所値操作に必要な合成Snapshotを使用する。全体codecや実Authorityのfixtureではない。
 * @stimulus 固定用途へ正常値・不一致値・境界値を渡す。
 * @observation 返却全文、入力本文、候補と対象外参照。
 * @oracle 元の判定順・理由を保ち、拒否・照会・同値再入場は変更候補を作らない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Domainの値モデル。保存・Scheduling・回復成立は別の利用側が確認する。
 */

test("QueueとProjectの投影は入力を保存候補へ変えない", () => {
  const { current, input, project } = fixture();
  const before = encodeRuntimeStateValue(current);
  const observed = projectCoordinatorQueueProjectState(current, "project-a");
  assert.equal(observed.status, "completed");
  if (observed.status === "completed") {
    assert.strictEqual(observed.value.value, project);
    assert.equal(observed.value.next, null);
  }
  assert.deepEqual(projectCoordinatorQueueProjectState(current, "project-b"), {
    status: "completed",
    reason: "orchestrator_state_observed",
    value: { next: null, value: null },
  });
  assert.equal(
    projectCoordinatorQueueProjectState(current, "../escape").reason,
    "orchestrator_state_identity_invalid",
  );
  assert.equal(
    projectCoordinatorQueueEntry(current, "../escape").reason,
    "orchestrator_queue_input_invalid",
  );
  assert.equal(
    projectCoordinatorQueueEntry(current, "queue-a").reason,
    "orchestrator_queue_observation_unknown",
  );
  const created = prepareCoordinatorQueueEntryCreation(
    current,
    "epoch-a",
    input,
  );
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const queue = projectCoordinatorQueueEntry(created.value.next, "queue-a");
  assert.equal(queue.status, "completed");
  if (queue.status === "completed") {
    assert.strictEqual(queue.value.value, created.value.value);
    assert.equal(queue.value.next, null);
  }
  assert.equal(encodeRuntimeStateValue(current), before);
});
