/**
 * Taskの状態・回復義務とDescriptor境界を検証する。
 * @packageDocumentation
 * @responsibility 閉じた本文とprototype継承の拒否を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope Taskの検査、plain data。
 * @boundary 値だけ。Coordinator・保存I/O・実行資源を使用しない。
 */
import assert from "node:assert/strict";
import test, { it } from "node:test";
import fs from "node:fs";
import { compileFunction } from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { sourceDeclaration } from "../../support/source-declaration.ts";

import type { ProjectExecutionState } from "../../../src/state/types.ts";

import {
  inspectSingleTaskRecord,
  recoveryObligations,
  validState,
  validResultReference,
} from "../../../src/task/validation.ts";

/**
 * 三つのTask参照が同じ元文法で検査されることを確認する。
 * @responsibility 局所化と統合によるnull・長さ・文字集合の受理域変更を拒否する。
 * @trace PRL-UT-006
 * @precondition 製品の私有nullable検査と実参照検査を使う。
 * @stimulus null、空、境界長、許可文字、空白、区切り、非文字列を与える。
 * @observation nullableと必須参照の真偽。
 * @oracle null以外は既存の非空512文字以内の固定文法に一致する。
 * @cleanup 同期のメモリ値のみ。
 * @boundary 保存・状態遷移・参照先観測は行わない。
 */
test("Taskの候補・回復・結果参照は統合前の同じ文法を維持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/task/validation.ts", import.meta.url),
    "utf8",
  );
  const nullable = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "nullableTaskReference"))});`,
    ["validResultReference"],
  )(validResultReference) as (value: unknown) => boolean;
  for (const value of [
    null,
    "",
    "a",
    "A0._-",
    "a".repeat(512),
    "a".repeat(513),
    "_first",
    "a:b",
    "a/b",
    "a b",
    "a\0b",
    1,
    {},
    [],
  ]) {
    const expected =
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
    assert.equal(validResultReference(value), expected);
    assert.equal(nullable(value), value === null || expected);
  }
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
  const state: ProjectExecutionState = {
    contract: "crdd-execution-model/project-state/v3",
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
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    })),
  } as ProjectExecutionState;
  assert.equal(validState(state), true);
  const longCriteria = Array.from(
    { length: 129 },
    (_, index) => `${index}:${"説明".repeat(2049)}`,
  );
  assert.equal(
    validState({
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
    validState({
      ...state,
      milestone: { ...state.milestone, acceptanceCriteria: [""] },
    }),
    false,
  );
  const task = state.tasks[0];
  assert.ok(task);
  assert.equal(validState({ ...state, tasks: [...state.tasks, task] }), false);
  assert.equal(
    validState({
      ...state,
      tasks: [
        { ...task, definition: { ...task.definition, objectiveId: "missing" } },
      ],
    }),
    false,
  );
  const obligations = Array.from({ length: 129 }, (_, index) => ({
    kind: "docker",
    recoveryId: `recovery-${index}`,
    phase: "required",
  }));
  assert.equal(recoveryObligations(obligations), true);
  assert.equal(recoveryObligations([...obligations, obligations[0]]), false);
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
 * 単発保存の閉じた相関と不正入力の非実行を確認する。
 * @responsibility getter／Proxy、本文混入と未回収成功を拒否する。
 * @trace PRL-UT-006
 * @precondition 合成値だけを使用する。
 * @stimulus 不正shapeと終端相関違反。
 * @observation nullとgetter呼出し0。
 * @oracle 不明・未回収を成功へ変換しない。
 * @cleanup Process内値のみ。
 * @boundary codec。
 */
test("単発記録は本文・getter・未回収成功を受理しない", () => {
  const record = {
    principalId: "user",
    mode: "read_only_advice",
    executionSelection: {
      provider: "codex",
      modelIdentifier: "gpt-5.5",
      identifierKind: "exact",
      reasoningEffort: "medium",
      purpose: "advice",
      catalogIdentity: "a".repeat(64),
      configIdentity: "b".repeat(64),
      role: "advice",
      workType: null,
      source: "role_default",
    },
    taskId: "task",
    attemptId: "attempt",
    operationId: "operation",
    phase: "settled",
    status: "completed",
    reason: null,
    cleanupConfirmed: true,
    recoveryIds: [],
  };
  const accepted = inspectSingleTaskRecord(record);
  assert.ok(accepted);
  assert.deepEqual(accepted.executionSelection, record.executionSelection);
  assert.notEqual(accepted.executionSelection, record.executionSelection);
  assert.equal(Object.isFrozen(accepted.executionSelection), true);
  record.executionSelection.modelIdentifier = "changed-after-acceptance";
  assert.equal(accepted.executionSelection.modelIdentifier, "gpt-5.5");
  assert.equal(
    inspectSingleTaskRecord({
      ...record,
      executionSelection: {
        ...record.executionSelection,
        role: "executor",
        purpose: "task",
      },
    }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({ ...record, prompt: "never persisted" }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({ ...record, cleanupConfirmed: false }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({
      ...record,
      recoveryIds: ["docker-task.pending"],
    }),
    null,
  );
  let hits = 0;
  assert.equal(
    inspectSingleTaskRecord({
      ...record,
      get phase() {
        hits++;
        return "settled";
      },
    }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({
      ...record,
      recoveryIds: new Proxy([], {
        ownKeys() {
          hits++;
          return [];
        },
      }),
    }),
    null,
  );
  assert.equal(hits, 0);
});
