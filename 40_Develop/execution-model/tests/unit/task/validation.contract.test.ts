/**
 * Domainの結果受理値とDescriptor境界を検証する。
 * @packageDocumentation
 * @responsibility 閉じた本文とprototype継承の拒否を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 結果受理decoder、plain data。
 * @boundary 値だけ。Coordinator・保存I/O・実行資源を使用しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { it } from "node:test";
import { types } from "node:util";
import vm from "node:vm";
import {
  decodeProjectResultAcceptance,
  hashExecutionSelection,
} from "../../../src/index.ts";
import { parseRuntimeActivityObservation } from "../../../src/state/activity.ts";
import type { CoordinatorState } from "../../../src/state/types.ts";

/**
 * 取得済み活動観測を量だけで欠測へ変えない。
 * @trace PRL-UT-006
 * @precondition 10001出所と単発記録、51履歴eventの合成値を使う。
 * @stimulus 完全集合と重複・不明参照・閉Schema違反を渡す。
 * @observation 保持された件数と不正時のnull。
 * @oracle 観測済み内容の量とSchema・Identity相関を区別する。
 * @cleanup N/A: 純粋値だけ。
 */
it("活動結果は10001出所・単発記録と51eventを保持する", () => {
  const sources = Array.from({ length: 10001 }, (_, index) => ({
    repositoryId: `repo-${index.toString().padStart(5, "0")}`,
    revision: "a".repeat(40),
  }));
  const singleTasks = sources.map((source, index) => ({
    repositoryId: source.repositoryId,
    requestId: `request-${index}`,
    mode: "workspace_edit",
    phase: "settled",
    status: "unknown",
    cleanupConfirmed: false,
    recoveryRequired: true,
  }));
  const events = Array.from({ length: 51 }, (_, index) => ({
    repositoryId: sources[0]?.repositoryId,
    eventId: `execution-${(50 - index).toString(16).padStart(64, "0")}`,
    occurredAt: "2026-11-12T00:00:00.000Z",
    objectiveId: "objective-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    status: "unknown",
    reason: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
  }));
  const raw = {
    projectId: "project-a",
    state: "absent",
    reason: "runtime_activity_state_absent",
    projection: null,
    currentSourceRepositoryId: null,
    sources,
    eventState: "observed",
    eventReason: "runtime_activity_events_observed",
    events,
    eventContinuation: null,
    singleTasks,
  };
  const observed = parseRuntimeActivityObservation(raw);
  assert.equal(observed?.sources.length, 10001);
  assert.equal(observed?.singleTasks?.length, 10001);
  assert.equal(observed?.events.length, 51);
  assert.equal(
    parseRuntimeActivityObservation({
      ...raw,
      sources: [...sources, sources[0]],
    }),
    null,
  );
  assert.equal(
    parseRuntimeActivityObservation({ ...raw, events: [...events, events[0]] }),
    null,
  );
  assert.equal(
    parseRuntimeActivityObservation({
      ...raw,
      singleTasks: [{ ...singleTasks[0], repositoryId: "missing" }],
    }),
    null,
  );
});

import {
  inspectSingleTaskRecord,
  recoveryObligations,
  resultAcceptances,
  validCoordinatorState,
} from "../../../src/task/validation.ts";
import { sourceDeclaration } from "../../support/source-declaration.ts";

/**
 * 新形式の結果受理本文の閉集合を検証する。
 * @responsibility 十一項目、初回世代、識別子、Hashと旧形式拒否を確認する。
 * @trace PRL-UT-006
 * @precondition 実行資源を持たない固定本文を使用する。
 * @stimulus 正常本文と各項目の欠落・不正値・追加項目、隔離realm内のDescriptor継承値と旧判定変異を検査する。
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
  const hostValue = Object.getOwnPropertyDescriptor(Object.prototype, "value");
  const helperSource = fs.readFileSync(
    new URL("../../../src/state/validation.ts", import.meta.url),
    "utf8",
  );
  const executable = [
    "isPlainRecord",
    "isDataDescriptor",
    "snapshotRuntimeStateRecord",
    "snapshotRuntimeStateArray",
  ]
    .map((name) => sourceDeclaration(helperSource, name))
    .join("\n");
  const stimulus = `
    const accessor = Object.defineProperty({}, "resultId", { get: undefined, set: undefined, enumerable: true });
    let getterCalls = 0;
    const getterInput = Object.defineProperty({}, "resultId", { get() { getterCalls++; return "valid"; }, enumerable: true });
    const originalValue = Object.getOwnPropertyDescriptor(Object.prototype, "value");
    try {
      Object.defineProperty(Object.prototype, "value", { value: "inherited", configurable: true });
      const keys = new Set(["resultId"]);
      JSON.stringify({
        accessorRejected: snapshotRuntimeStateRecord(accessor, keys) === null,
        getterRejected: snapshotRuntimeStateRecord(getterInput, keys) === null,
        dataAccepted: snapshotRuntimeStateRecord({ resultId: "valid" }, keys)?.resultId === "valid",
        getterCalls,
      });
    } finally {
      delete Object.prototype.value;
      if (originalValue) Object.defineProperty(Object.prototype, "value", originalValue);
    }
  `;
  const observed = JSON.parse(
    vm.runInNewContext(
      `${executable}\n${stimulus}`,
      { types },
      { timeout: 1000 },
    ),
  );
  assert.deepEqual(observed, {
    accessorRejected: true,
    getterRejected: true,
    dataAccepted: true,
    getterCalls: 0,
  });
  const predicate = 'Object.hasOwn(descriptor, "value")';
  assert.equal(executable.split(predicate).length, 2);
  const mutant = executable.replace(predicate, '"value" in descriptor');
  const mutantObserved = JSON.parse(
    vm.runInNewContext(`${mutant}\n${stimulus}`, { types }, { timeout: 1000 }),
  );
  assert.equal(mutantObserved.accessorRejected, false);
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(Object.prototype, "value"),
    hostValue,
  );
});

/**
 * 実行状態・回復義務・受領・回復IDを任意の蓄積件数で拒否しない。
 * @responsibility 旧128/1024/64件を超える値と不正相関を対照する。
 * @trace PRL-UT-006
 * @precondition ID・選定・世代が成立するメモリ内の合成値だけを使用する。
 * @stimulus 一意な大集合と重複・未来世代・非終端の負例を検査する。
 * @observation 検査結果と保持される配列長。
 * @oracle 件数超過だけは通り、形式・参照・状態機械の違反は拒否する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 純粋Domain検査。実行や回復は発行しない。
 */
it("実行状態と回復記録は旧蓄積上限を超えても相関を検査する", () => {
  const selection = {
    provider: "codex",
    modelIdentifier: "gpt-5.5",
    identifierKind: "exact",
    reasoningEffort: "medium",
    purpose: "task",
    catalogIdentity: "a".repeat(64),
    configIdentity: "b".repeat(64),
    role: "executor",
    workType: null,
    source: "role_default",
  };
  const state: CoordinatorState = {
    contract: "crdd-coordinator/project-state/v2",
    taskExecutionSelections: {
      executor: selection,
      reviewer: { ...selection, role: "independent_reviewer" },
    },
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    generation: 1,
    ownerGeneration: "owner-a",
    decisionApplicationId: null,
    maximumConcurrency: 1,
    milestone: {
      id: "milestone-a",
      acceptanceCriteria: ["done"],
      state: "planned",
      criterionEvidenceIds: [],
    },
    objectives: Array.from({ length: 129 }, (_, index) => ({
      definition: { id: `objective-${index}`, acceptanceCriteria: ["done"] },
      state: "planned",
      criterionEvidenceIds: [],
    })),
    tasks: Array.from({ length: 1025 }, (_, index) => ({
      definition: {
        id: `task-${index}`,
        objectiveId: `objective-${index % 129}`,
        dependencies: [],
        allowedPaths: ["src"],
        conflictKeys: [],
      },
      state: "ready",
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none",
      cleanupConfirmed: false,
      recoveryObligations: [],
      resultAcceptances: [],
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    })),
  } as CoordinatorState;
  assert.equal(validCoordinatorState(state), true);
  const longCriteria = Array.from(
    { length: 129 },
    (_, index) => `${index}:${"説明".repeat(2049)}`,
  );
  assert.equal(
    validCoordinatorState({
      ...state,
      milestone: {
        ...state.milestone,
        acceptanceCriteria: longCriteria,
        criterionEvidenceIds: longCriteria,
      },
    }),
    true,
  );
  assert.equal(
    validCoordinatorState({
      ...state,
      milestone: { ...state.milestone, acceptanceCriteria: [""] },
    }),
    false,
  );
  const task = state.tasks[0];
  assert.ok(task);
  assert.equal(
    validCoordinatorState({ ...state, tasks: [...state.tasks, task] }),
    false,
  );
  assert.equal(
    validCoordinatorState({
      ...state,
      tasks: [
        { ...task, definition: { ...task.definition, objectiveId: "missing" } },
      ],
    }),
    false,
  );
  const scope = {
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-0",
    generation: 1,
  };
  const obligations = Array.from({ length: 129 }, (_, index) => ({
    kind: "docker",
    recoveryId: `recovery-${index}`,
    phase: "required",
  }));
  assert.equal(recoveryObligations(obligations, scope), true);
  assert.equal(
    recoveryObligations([...obligations, obligations[0]], scope),
    false,
  );
  const settledTask = {
    ...task,
    state: "completed",
    startPhase: "settled",
    attemptId: "attempt-a",
    operationId: "operation-a",
    cleanupConfirmed: true,
  } as CoordinatorState["tasks"][number];
  const receipts = Array.from({ length: 129 }, (_, index) => ({
    repositoryBindingId: "binding-a",
    projectId: scope.projectId,
    milestoneId: scope.milestoneId,
    taskId: scope.taskId,
    attemptId: "attempt-a",
    operationId: "operation-a",
    recoveryId: `recovery-${index}`,
    settlementGeneration: 1,
    repositoryBinding: "a".repeat(64),
    resultId: index.toString(16).padStart(64, "0"),
    consumer: "orchestrator",
  }));
  const receiptScope = { ...scope, task: settledTask };
  assert.equal(resultAcceptances(receipts, receiptScope), true);
  assert.equal(
    resultAcceptances([...receipts, receipts[0]], receiptScope),
    false,
  );
  assert.equal(resultAcceptances(receipts, { ...receiptScope, task }), false);
  assert.equal(
    resultAcceptances(
      receipts.map((receipt) => ({ ...receipt, settlementGeneration: 2 })),
      receiptScope,
    ),
    false,
  );
  const single = {
    principalId: "local.email.user@example.com",
    mode: "workspace_edit",
    executionSelection: selection,
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    phase: "settled",
    status: "unknown",
    reason: "unknown",
    cleanupConfirmed: false,
    recoveryIds: Array.from({ length: 65 }, (_, index) => `recovery-${index}`),
  };
  assert.equal(inspectSingleTaskRecord(single)?.recoveryIds.length, 65);
  assert.equal(
    inspectSingleTaskRecord({
      ...single,
      recoveryIds: [...single.recoveryIds, single.recoveryIds[0]],
    }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({ ...single, status: "completed" }),
    null,
  );
});

/**
 * 移管前に固定した内容Hashを維持する。
 * @responsibility 型Owner移管によるIdentity変更やAuthority追加を拒否する。
 * @trace RCM-UT-001
 * @precondition 既存試験の十項目と既知Hashを使う。
 * @stimulus 入力Property順と過剰fieldを変える。
 * @observation Hashと拒否結果。
 * @oracle 正規順序に依存せず既存Hash一致、過剰fieldはnull。
 * @cleanup N/A: 値だけ。
 * @boundary 選定内容と非Authority Identity。
 */
it("固定選定のHashは移管前のbyteと一致する", () => {
  const selection = {
    provider: "codex",
    modelIdentifier: "historical-model",
    identifierKind: "exact",
    reasoningEffort: "medium",
    purpose: "task",
    catalogIdentity: "a".repeat(64),
    configIdentity: "b".repeat(64),
    role: "executor",
    workType: null,
    source: "explicit",
  };
  assert.equal(
    hashExecutionSelection(selection),
    "5fa860b97b4251d54285de02ae6b0a4c25ecdf967e1d4958cc3dd91c8b06a70e",
  );
  assert.equal(
    hashExecutionSelection(
      Object.fromEntries(Object.entries(selection).reverse()),
    ),
    hashExecutionSelection(selection),
  );
  assert.equal(hashExecutionSelection({ ...selection, authority: true }), null);
});
