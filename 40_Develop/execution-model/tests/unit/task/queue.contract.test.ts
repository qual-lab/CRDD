/**
 * Queue受付・追加・照会の固定候補を検証する。
 * @packageDocumentation
 * @responsibility 同Identity、Hash差、初回State捕捉とWorkspace結合を反証する。
 * @trace PRL-UT-007
 * @level UT
 * @scope 固定値操作と保存受付の値捕捉。実行選択・実資源観測・物理保存は対象外。
 * @boundary メモリの局所入力。全体codec・実Ownerの証明ではない。
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { compileFunction } from "node:vm";
import { sourceDeclaration } from "../../support/source-declaration.ts";
import type {
  ProjectExecutionState,
  QueueEnqueueInput,
  WorkspaceRecord,
} from "../../../src/index.ts";
import type { Snapshot } from "../../../src/state/types.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "../../../src/state/types.ts";
import {
  projectCurrentState,
  snapshotRequestMatches,
} from "../../../src/state/validation.ts";
import {
  encodeStateValue,
  snapshotStateArray,
  snapshotStateRecord,
} from "../../../src/state/operations.ts";
import {
  prepareQueueEntryCreation,
  projectQueueEntry,
} from "../../../src/task/crud.ts";

/**
 * 新しい初回Stateの捕捉は既存の閉じた値符号化を使用する。
 * @responsibility 保存入口でGetter／Proxyを評価せず、後続の元参照変更を候補へ混ぜない。
 * @trace PRL-UT-007
 * @precondition 実createQueue宣言と既存の値捕捉器を使い、物理保存だけ有限代役とする。
 * @stimulus Plain値、Getter、Proxyと捕捉後の元参照変更を与える。
 * @observation 捕捉値、呼出し回数とGetter／Proxy呼出し数。
 * @oracle 捕捉値は独立し、不正値は保存処置の前に拒否する。
 * @cleanup N/A: メモリと既存Source解析のみ。
 * @boundary 公開保存受付の局所値捕捉。実Writer・全State妥当性は結合試験で確認する。
 */
test("初回Stateの捕捉はGetterとProxyを拒否し元参照を共有しない", () => {
  const source = fs.readFileSync(
    new URL("../../../src/task/crud.ts", import.meta.url),
    "utf8",
  );
  const raw = { projectId: "project-a", nested: { values: [1] } };
  let calls = 0;
  let captured: unknown = null;
  const create = compileFunction(
    `return (${sourceDeclaration(source, "createQueue")});`,
    [
      "snapshotStateRecord",
      "snapshotStateArray",
      "encodeStateValue",
      "blocked",
      "withSnapshotOperation",
      "prepareQueueEntryCreation",
    ],
  )(
    snapshotStateRecord,
    snapshotStateArray,
    encodeStateValue,
    (reason: string) => ({ status: "blocked", reason }),
    (
      _root: unknown,
      _binding: string,
      operation: (current: object) => unknown,
    ) => {
      calls++;
      raw.projectId = "changed";
      raw.nested.values.push(2);
      return operation({});
    },
    (_current: unknown, _input: unknown, initial: unknown) => {
      captured = initial;
      return { status: "completed" };
    },
  );
  assert.equal(
    create({}, "binding", { kind: "scheduled", input: [{}, raw] }).status,
    "completed",
  );
  assert.deepEqual(captured, {
    projectId: "project-a",
    nested: { values: [1] },
  });
  let hooks = 0;
  for (const initial of [
    {
      get projectId() {
        hooks++;
        return "project-a";
      },
    },
    new Proxy(raw, {
      ownKeys() {
        hooks++;
        return Reflect.ownKeys(raw);
      },
    }),
  ])
    assert.equal(
      create({}, "binding", { kind: "scheduled", input: [{}, initial] }).status,
      "blocked",
    );
  assert.equal(hooks, 0);
  assert.equal(calls, 1);
});

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
  const project = { projectId: "project-a" } as ProjectExecutionState;
  const current: Snapshot = {
    schema: PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 9,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    projects: [project],
    queueEntries: [],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
  const input: QueueEnqueueInput = {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: "b".repeat(64),
    originLane: "interactive",
    repositoryRevision: "a".repeat(40),
    scopeHash: "c".repeat(64),
  };
  const intake = {
    operation: "start" as const,
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

test("受付固定照合は実行ID・要求内容と明示再開を照合する", () => {
  const { current, input, intake } = fixture();
  const before = encodeStateValue(current);
  assert.equal(snapshotRequestMatches(current, intake), true);
  for (const change of [
    { queueId: "queue-missing", operation: "resume" as const },
    { queueId: "../escape" },
    { requestHash: "invalid" },
    { projectId: "../escape" },
    { milestoneId: "../escape" },
  ])
    assert.equal(
      snapshotRequestMatches(current, { ...intake, ...change }),
      false,
    );
  const created = prepareQueueEntryCreation(current, input);
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const rotated = { ...created.value.next };
  assert.equal(snapshotRequestMatches(rotated, intake), true);
  for (const change of [
    { queueId: "queue-missing", operation: "resume" as const },
    { requestHash: "d".repeat(64) },
    { projectId: "project-b" },
    { milestoneId: "milestone-b" },
  ])
    assert.equal(
      snapshotRequestMatches(rotated, { ...intake, ...change }),
      false,
    );
  assert.equal(
    snapshotRequestMatches(
      { ...rotated, queueEntries: [] },
      { ...intake, operation: "resume" },
    ),
    false,
  );
  assert.equal(encodeStateValue(current), before);
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
  const before = encodeStateValue(current);
  const created = prepareQueueEntryCreation(current, input);
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const next = created.value.next;
  assert.equal(next.queueEntries.length, 1);
  assert.equal(Object.hasOwn(next, "intakeBindings"), false);
  assert.strictEqual(next.results, current.results);
  assert.strictEqual(next.projects, current.projects);
  assert.equal(Object.isFrozen(created), true);
  assert.equal(Object.isFrozen(created.value), false);
  assert.deepEqual(created.value.value, {
    ...input,
    historySettled: false,
    workspaceId: null,
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
  });
  const reused = prepareQueueEntryCreation(next, input);
  assert.equal(reused.status, "completed");
  if (reused.status === "completed") {
    assert.equal(reused.value.next, null);
    assert.strictEqual(reused.value.value, next.queueEntries[0]);
  }
  // 既存受付の相関はHash/Project/Milestone/epochに限定される。ここで追加拒否条件を作らない。
  assert.equal(
    prepareQueueEntryCreation(
      { ...next },
      {
        ...input,
        repositoryRevision: "d".repeat(40),
      },
    ).reason,
    "orchestrator_queue_request_reused",
  );
  for (const change of [
    { requestHash: "d".repeat(64) },
    { projectId: "project-b" },
    { milestoneId: "milestone-b" },
  ])
    assert.equal(
      prepareQueueEntryCreation(next, {
        ...input,
        ...change,
      }).reason,
      "orchestrator_queue_identity_conflict",
    );
  assert.equal(
    prepareQueueEntryCreation(next, { ...input, requestHash: "d".repeat(64) })
      .reason,
    "orchestrator_queue_identity_conflict",
  );
  assert.equal(
    prepareQueueEntryCreation({ ...current, projects: [] }, input).reason,
    "orchestrator_queue_input_invalid",
  );
  for (const change of [
    { queueId: "../escape" },
    { requestHash: "invalid" },
    { milestoneId: null },
    { singleTask: {} },
  ])
    assert.equal(
      prepareQueueEntryCreation(current, {
        ...input,
        ...change,
      } as unknown as QueueEnqueueInput).reason,
      "orchestrator_queue_input_invalid",
    );
  assert.equal(encodeStateValue(current), before);
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
  const workspace: WorkspaceRecord = {
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
  const created = prepareQueueEntryCreation(current, input);
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
    prepareQueueEntryCreation(connected, following).status,
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
      prepareQueueEntryCreation(modified, following).reason,
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
  const before = encodeStateValue(current);
  const observed = projectCurrentState(current, "project-a");
  assert.equal(observed.status, "completed");
  if (observed.status === "completed") {
    assert.strictEqual(observed.value.value, project);
    assert.equal(observed.value.next, null);
  }
  assert.deepEqual(projectCurrentState(current, "project-b"), {
    status: "completed",
    reason: "orchestrator_state_observed",
    value: { next: null, value: null },
  });
  assert.equal(
    projectCurrentState(current, "../escape").reason,
    "orchestrator_state_identity_invalid",
  );
  assert.equal(
    projectQueueEntry(current, "../escape").reason,
    "orchestrator_queue_input_invalid",
  );
  assert.equal(
    projectQueueEntry(current, "queue-a").reason,
    "orchestrator_queue_observation_unknown",
  );
  const created = prepareQueueEntryCreation(current, input);
  assert.equal(created.status, "completed");
  if (created.status !== "completed" || !created.value.next)
    throw Error("fixture");
  const queue = projectQueueEntry(created.value.next, "queue-a");
  assert.equal(queue.status, "completed");
  if (queue.status === "completed") {
    assert.strictEqual(queue.value.value, created.value.value);
    assert.equal(queue.value.next, null);
  }
  assert.equal(encodeStateValue(current), before);
});
