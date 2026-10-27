/**
 * Coordinator現在状態の固定encodingと相関を検証する。
 * @packageDocumentation
 * @responsibility 保存内容検査を実資源の回収証明と分離して反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope coordinator-state-model
 * @boundary PRL-UT-006=Direct Boundary: メモリ内の保存本文。
 */

import {
  createDockerRestartRequestId,
  decodeDockerRestartCheckpoint,
  coordinatorConsumerCompletionPolicy,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  COORDINATOR_STATE_SCHEMA,
  type CoordinatorStateSnapshot,
  type CoordinatorUnifiedSnapshot,
  type CoordinatorStateTaskOperation,
  coordinatorAuthenticationUnknownCanClose,
  coordinatorTaskResourcesAreSettled,
  projectCoordinatorTaskSettlement,
} from "../../../../domain-model/src/index.ts";
import {
  hashRuntimeStateContent,
  encodeRuntimeStateValue,
  RUNTIME_STATE_MAXIMUM_BYTES,
} from "../../../../domain-model/src/index.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { createCoordinatorState } from "../../../src/state/create.ts";
import { createManagedRuntimeSnapshotFixture } from "../../../../domain-model/tests/support/runtime-state.ts";
import {
  decodeRuntimeDomainSnapshot,
  hashRuntimeProjectDefinition,
  type RuntimeProjectDefinition,
} from "../../../../domain-model/src/index.ts";

import {
  classifyCoordinatorResourcePublication,
  decodeRuntimeDomainSnapshot as decodeCoordinatorStateSnapshot,
  prepareCoordinatorAuthenticationUnknownClosureSnapshot,
  prepareCoordinatorRecoveredHistoryPublication,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateRestartSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  validateCoordinatorStateTransition,
  validCoordinatorSnapshot,
} from "../../../../domain-model/src/index.ts";
import {
  prepareCoordinatorStateHistoryLine,
  prepareCoordinatorUnifiedTaskSnapshot,
  validateCoordinatorUnifiedTransition,
} from "../../../../domain-model/src/index.ts";

import { coordinatorReleasedTaskCanObserveHostAbsence } from "../../../src/execution/validation.ts";
import {
  decodeCoordinatorHistoryRows,
  prepareCoordinatorHistoryRetention,
} from "../../../../domain-model/src/index.ts";

import {
  executionSelection,
  taskExecutionSelections,
} from "../../fixtures/ai-selection.ts";

const binding = "a".repeat(64);

/**
 * 実行だけを使う未初期化Task区画の合成値を返す。
 * @responsibility 新Schemaの純粋試験で物理保存・移行入力を作らない。
 * @trace PRL-UT-006
 * @returns 空の単一保存値。
 * @effect N/A: メモリ内のfixture生成だけ。
 * @precondition 固定Bindingと現行Domain Schemaを使用する。
 * @stimulus Task未初期化の空区画を組み立てる。
 * @observation 実行・回復・配送・Projectの空集合。
 * @oracle 架空の旧Profileや初期化済み状態を補完しない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋codec試験。実保存・実行を開始しない。
 */
function emptyUnifiedSnapshot(): CoordinatorUnifiedSnapshot {
  return {
    schema: "crdd-domain/runtime-state/v1",
    revision: 1,
    previous: null,
    repositoryBinding: binding,
    repositoryBindingId: null,
    intakeEpoch: null,
    operations: [],
    unresolvedRecoveries: [],
    pendingDeliveries: [],
    projects: [],
    managedExecutions: [],
    queueEntries: [],
    workspaces: [],
    intakeBindings: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
    resultReceipts: [],
  };
}

/**
 * 新SchemaでCore定義を管理実行から独立して復号する。
 * @responsibility 架空の実行選定・Ownerの補完と孤立した管理参照を反証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の通常データだけを使う。
 * @stimulus 空Core・完全定義・管理参照と欠測／不一致を復号する。
 * @observation 正本、管理投影、Hashとnull結果。
 * @oracle 定義は一箇所、管理投影は完全な参照時だけ成立する。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary 新codecだけ。本番Writer切替・Core CRUDの完成を示さない。
 */
test("新Domain Schema: Coreのみと管理投影を定義Hashで分離する", () => {
  const empty = {
    ...emptyUnifiedSnapshot(),
    schema: "crdd-domain/runtime-state/v1",
    repositoryBindingId: "binding-a",
    intakeEpoch: "epoch-a",
    managedExecutions: [],
  };
  const core: RuntimeProjectDefinition = {
    contract: "crdd-domain/project-state/v1",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    generation: 1,
    decisionApplicationId: null,
    milestone: {
      id: "milestone-a",
      acceptanceCriteria: ["done"],
      state: "planned",
      criterionEvidenceIds: [],
    },
    objectives: [],
    tasks: [],
  };
  const encode = (value: unknown) =>
    Buffer.from(`${encodeRuntimeStateValue(value)}\n`);
  const coreOnly = { ...empty, projects: [core] };
  const read = decodeRuntimeDomainSnapshot(encode(coreOnly), binding);
  assert.ok(read);
  assert.deepEqual(read.snapshot, coreOnly);
  assert.deepEqual(read.projects, []);
  assert.equal(
    decodeRuntimeDomainSnapshot(
      encode({
        ...emptyUnifiedSnapshot(),
        schema: "crdd-coordinator/current-state/v5",
      }),
      binding,
    ),
    null,
  );
  for (const invalid of [
    { ...coreOnly, managedExecutions: undefined },
    { ...coreOnly, managedExecutions: [{}] },
    { ...coreOnly, projects: [core, core] },
    { ...coreOnly, operations: [{}] },
    { ...coreOnly, repositoryBindingId: null },
  ]) {
    if (invalid.managedExecutions === undefined) {
      const { managedExecutions: _missing, ...missing } = invalid;
      assert.equal(decodeRuntimeDomainSnapshot(encode(missing), binding), null);
    } else
      assert.equal(decodeRuntimeDomainSnapshot(encode(invalid), binding), null);
  }
  const definition: RuntimeProjectDefinition = {
    ...core,
    objectives: [
      {
        definition: { id: "objective-a", acceptanceCriteria: ["done"] },
        state: "planned",
        criterionEvidenceIds: [],
      },
    ],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["src/a.ts"],
        conflictKeys: [],
      },
    ],
  };
  const managed = {
    projectId: core.projectId,
    milestoneId: core.milestoneId,
    definitionHash: hashRuntimeProjectDefinition(definition),
    taskExecutionSelections: taskExecutionSelections(),
    ownerGeneration: "owner-a",
    maximumConcurrency: 1,
    tasks: [
      {
        taskId: "task-a",
        state: "planned",
        attemptId: null,
        operationId: null,
        authorityBindingId: null,
        startPhase: "none",
        settlement: { kind: "pending" },
        recoveryObligations: [],
        resultAcceptanceIds: [],
        candidateId: null,
        retryCount: 0,
        supersededBy: null,
      },
    ],
  };
  const complete = {
    ...empty,
    projects: [definition],
    managedExecutions: [managed],
  };
  const unassigned = {
    ...definition,
    objectives: [
      ...definition.objectives,
      {
        definition: { id: "objective-b", acceptanceCriteria: ["unassigned"] },
        state: "planned" as const,
        criterionEvidenceIds: [],
      },
    ],
  };
  assert.equal(
    decodeRuntimeDomainSnapshot(
      encode({
        ...complete,
        projects: [unassigned],
        managedExecutions: [
          {
            ...managed,
            definitionHash: hashRuntimeProjectDefinition(unassigned),
          },
        ],
      }),
      binding,
    ),
    null,
  );
  const projected = decodeRuntimeDomainSnapshot(encode(complete), binding);
  assert.ok(projected);
  assert.deepEqual(projected.snapshot, complete);
  assert.deepEqual(
    projected.projects[0]?.tasks[0]?.definition,
    definition.tasks[0],
  );
  const firstDefinition = definition.tasks[0];
  const firstManaged = managed.tasks[0];
  assert.ok(firstDefinition && firstManaged);
  const twoDefinitions = {
    ...definition,
    tasks: [firstDefinition, { ...firstDefinition, id: "task-b" }],
  };
  const twoManaged = {
    ...managed,
    definitionHash: hashRuntimeProjectDefinition(twoDefinitions),
    tasks: [firstManaged, { ...firstManaged, taskId: "task-b" }],
  };
  const ordered = {
    ...complete,
    projects: [twoDefinitions],
    managedExecutions: [twoManaged],
  };
  assert.ok(decodeRuntimeDomainSnapshot(encode(ordered), binding));
  assert.equal(
    decodeRuntimeDomainSnapshot(
      encode({
        ...ordered,
        managedExecutions: [
          { ...twoManaged, tasks: [...twoManaged.tasks].reverse() },
        ],
      }),
      binding,
    ),
    null,
  );
  for (const changed of [
    { ...managed, definitionHash: "f".repeat(64) },
    { ...managed, milestoneId: "other" },
    { ...managed, tasks: [] },
    { ...managed, tasks: [managed.tasks[0], managed.tasks[0]] },
    { ...managed, ownerGeneration: null },
    { ...managed, taskExecutionSelections: null },
    {
      ...managed,
      tasks: [{ ...managed.tasks[0], definition: definition.tasks[0] }],
    },
  ])
    assert.equal(
      decodeRuntimeDomainSnapshot(
        encode({ ...complete, managedExecutions: [changed] }),
        binding,
      ),
      null,
    );
});

/**
 * 単一SchemaのRoot結合と未初期化区画を反証する。
 * @responsibility 改訂二重化、旧形式、片側初期化、未知区画を拒否する。
 * @trace PRL-UT-006
 * @precondition 空のメモリ内集合だけを使う。
 * @stimulus 正規値とRoot・改訂・区画の不正値を復号する。
 * @observation 復号結果、本文Hash、旧codecの拒否を確認する。
 * @oracle 正規値だけを受理し、旧形式を補完しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 単一保存の純粋codec。
 */
test("単一保存codec: Rootと改訂を一組にし片側初期化を拒否する", () => {
  const snapshot = emptyUnifiedSnapshot();
  const bytes = Buffer.from(`${encodeRuntimeStateValue(snapshot)}\n`);
  assert.deepEqual(
    decodeRuntimeDomainSnapshot(bytes, binding)?.snapshot,
    snapshot,
  );
  assert.equal(
    decodeRuntimeDomainSnapshot(bytes, binding)?.payloadSha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  assert.deepEqual(
    decodeCoordinatorStateSnapshot(bytes, binding)?.snapshot,
    snapshot,
  );
  for (const invalid of [
    { ...snapshot, schema: "crdd-coordinator/current-state/v4" },
    { ...snapshot, schema: "crdd-coordinator/current-state/v3" },
    { ...snapshot, schema: "crdd-coordinator/current-state/v2" },
    { ...snapshot, repositoryBindingId: "binding-a" },
    { ...snapshot, intakeEpoch: "epoch-a" },
    { ...snapshot, snapshotRevision: 1 },
    { ...snapshot, repositoryRootHash: binding },
    { ...snapshot, revision: 2 },
    { ...snapshot, previous: { revision: 0, payloadSha256: binding } },
    { ...snapshot, resultReceipts: [{}] },
    { ...snapshot, workspaces: [{}] },
    { ...snapshot, payload: snapshot },
  ])
    assert.equal(
      decodeRuntimeDomainSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  assert.equal(decodeRuntimeDomainSnapshot(bytes, "b".repeat(64)), null);
  const next = {
    ...snapshot,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
  /**
   * 遷移反証の値を正規保存bytesへ変換する。
   * @responsibility 同じ現行codecと改行を使いHash相関を保つ。
   * @trace PRL-UT-006
   * @precondition 合成の遷移候補。
   * @stimulus 正規JSONと末尾改行をUTF-8へ変換する。
   * @observation codecへ渡すbytes。
   * @oracle 別Schemaや任意の文字列変換を補完しない。
   * @cleanup N/A: 局所値のみ。
   * @boundary 純粋遷移検査。実保存・実行なし。
   */
  const encode = (value: unknown) =>
    Buffer.from(`${encodeRuntimeStateValue(value)}\n`);
  assert.equal(
    validateCoordinatorUnifiedTransition(null, bytes, binding),
    true,
  );
  assert.equal(
    validateCoordinatorUnifiedTransition(bytes, encode(next), binding),
    true,
  );
  assert.equal(
    validateCoordinatorUnifiedTransition(
      bytes,
      encode({ ...next, revision: 3 }),
      binding,
    ),
    false,
  );
  assert.equal(
    validateCoordinatorUnifiedTransition(
      bytes,
      encode({
        ...next,
        previous: { revision: 1, payloadSha256: "b".repeat(64) },
      }),
      binding,
    ),
    false,
  );
});

/**
 * 技術Operationの不存在をTaskの未発行・回収成功へ読み替えない。
 * @responsibility 元事実の種類、欠落参照、不正値とGetter非評価を反証する。
 * @trace PRL-UT-006
 * @precondition 技術記録のないメモリ内集合を使用する。
 * @stimulus 未終端、明示未発行、差替えExecutor結果、不正参照を投影する。
 * @observation 二つの公開状態、null、Getter呼出し数を確認する。
 * @oracle 明示未発行だけを成功へ投影し、空・欠落Operationを成功へ補完しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Task固有事実から状態投影。
 */
test("Task終端投影: 空の技術集合と明示未発行を区別する", () => {
  const snapshot = { operations: [], unresolvedRecoveries: [] };
  assert.deepEqual(
    projectCoordinatorTaskSettlement({ kind: "pending" }, snapshot),
    {
      cleanupConfirmed: false,
      recoveryUnresolved: false,
    },
  );
  assert.deepEqual(
    projectCoordinatorTaskSettlement({ kind: "unissued" }, snapshot),
    {
      cleanupConfirmed: true,
      recoveryUnresolved: false,
    },
  );
  for (const cleanupConfirmed of [false, true]) {
    for (const recoveryUnresolved of [false, true]) {
      assert.deepEqual(
        projectCoordinatorTaskSettlement(
          {
            kind: "executor_result",
            cleanupConfirmed,
            recoveryUnresolved,
          },
          snapshot,
        ),
        { cleanupConfirmed, recoveryUnresolved },
      );
    }
  }
  let reads = 0;
  const hostile = Object.defineProperty({}, "kind", {
    enumerable: true,
    get() {
      reads += 1;
      return "unissued";
    },
  });
  for (const invalid of [
    null,
    hostile,
    new Proxy({}, {}),
    { kind: "unknown" },
    { kind: "pending", cleanupConfirmed: true },
    { kind: "executor_result", cleanupConfirmed: true },
    {
      kind: "executor_result",
      cleanupConfirmed: "true",
      recoveryUnresolved: false,
    },
    { kind: "operations", recoveryIds: [], resultUnresolved: false },
    { kind: "operations", recoveryIds: ["missing"], resultUnresolved: false },
    {
      kind: "operations",
      recoveryIds: ["missing", "missing"],
      resultUnresolved: false,
    },
    { kind: "operations", recoveryIds: [1], resultUnresolved: false },
    { kind: "operations", recoveryIds: ["missing"], resultUnresolved: "false" },
  ])
    assert.equal(projectCoordinatorTaskSettlement(invalid, snapshot), null);
  assert.equal(reads, 0);
});

/**
 * Task区画の非空回復を物理保存なしで検証する。
 * @responsibility 共通検証への移管で値のキー・相関・孤立参照の拒否を失わないことを反証する。
 * @trace PRL-UT-006
 * @precondition 既存の純粋State生成と現行Snapshot契約だけを使う。
 * @stimulus 正常回復、誤キー、重複、別Queue、未知Root区画を検査する。
 * @observation codecの真偽と入力全文を比較する。
 * @oracle 正常な非空集合だけを受理し、不正値を補完せず入力も変更しない。
 * @cleanup N/A: Process、Filesystem、Lockを生成しない。
 * @boundary PRL-UT-006=Direct Boundary: メモリ内Task区画と保存codec。
 */
test("Task保存codec: 非空回復の値キーとexact参照を保持する", () => {
  const created = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    maximumConcurrency: 2,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["src/a.ts"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("state_fixture_invalid");
  const recovery = {
    recoveryId: "recovery-a",
    recordId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    applicationId: "application-a",
    expectedGeneration: 1,
    newGeneration: 2,
    observedDisposition: "prepared",
    unknownBoundary: "project_readback",
    disposition: "required",
  };
  const snapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: binding,
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [{ queueId: "queue-a", epoch: "epoch-a" }],
    projects: [created.state],
    queueEntries: [
      {
        workspaceId: null,
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
      },
    ],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [{ generation: 1, value: recovery }],
  };
  const before = JSON.stringify(snapshot);
  assert.equal(validCoordinatorSnapshot(snapshot, "binding-a", binding), true);
  for (const invalid of [
    {
      ...snapshot,
      decisionRecoveries: [{ generation: 1, snapshot: recovery }],
    },
    {
      ...snapshot,
      decisionRecoveries: [
        { generation: 1, value: { ...recovery, secret: "forbidden" } },
      ],
    },
    {
      ...snapshot,
      decisionRecoveries: [
        snapshot.decisionRecoveries[0],
        snapshot.decisionRecoveries[0],
      ],
    },
    {
      ...snapshot,
      decisionRecoveries: [
        { generation: 1, value: { ...recovery, queueId: "other-queue" } },
      ],
    },
    { ...snapshot, unknown: [] },
  ])
    assert.equal(
      validCoordinatorSnapshot(invalid, "binding-a", binding),
      false,
    );
  assert.equal(JSON.stringify(snapshot), before);
  const storedProjects = snapshot.projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => {
      const {
        cleanupConfirmed: _cleanup,
        recoveryUnresolved: _unresolved,
        resultAcceptances: _receipts,
        ...record
      } = task;
      return {
        ...record,
        settlement: { kind: "pending" as const },
        resultAcceptanceIds: [],
      };
    }),
  }));
  const { managedExecutions: _emptyManaged, ...emptyDefinitionFixture } =
    emptyUnifiedSnapshot();
  const unified = {
    ...emptyDefinitionFixture,
    repositoryBindingId: snapshot.repositoryBindingId,
    intakeEpoch: snapshot.intakeEpoch,
    intakeBindings: snapshot.intakeBindings,
    queueEntries: snapshot.queueEntries,
    decisionRecoveries: snapshot.decisionRecoveries,
    projects: storedProjects,
  };
  /**
   * 合成した単一状態の値を正規codecへ渡す。
   * @responsibility 現行Schemaの値と実codecを使い、旧形を補完しない。
   * @trace PRL-UT-006
   * @precondition 自己生成の純粋状態値。
   * @stimulus 不正相関又は正常値を正規codecへ渡す。
   * @observation 復号結果とProject区画。
   * @oracle 相関不正・旧形式を成功へ畳まない。
   * @cleanup N/A: 局所値のみ。
   * @boundary 保存モデルの純粋試験。物理保存・実行なし。
   */
  const decodeUnified = (value: unknown) =>
    decodeRuntimeDomainSnapshot(
      Buffer.from(
        `${encodeRuntimeStateValue(createManagedRuntimeSnapshotFixture(value))}\n`,
      ),
      binding,
    );
  assert.deepEqual(decodeUnified(unified)?.projects, snapshot.projects);
  const explicitInvalidManaged = {
    ...unified,
    managedExecutions: [{ definitionHash: "invalid", unexpected: true }],
  };
  assert.equal(
    createManagedRuntimeSnapshotFixture(explicitInvalidManaged),
    explicitInvalidManaged,
    "明示された技術区画をfixtureが正常値で上書きしない",
  );
  assert.equal(decodeUnified(explicitInvalidManaged), null);
  const stateUpdate = { ...created.state, generation: 2 };
  const unifiedBytes = Buffer.from(
    `${encodeRuntimeStateValue(createManagedRuntimeSnapshotFixture(unified))}\n`,
  );
  const stateCandidate = prepareCoordinatorUnifiedTaskSnapshot(
    unifiedBytes,
    stateUpdate,
    1,
    binding,
  );
  assert.ok(stateCandidate);
  const canonical = createManagedRuntimeSnapshotFixture(unified);
  const managedDefinition = canonical.projects[0];
  assert.ok(managedDefinition);
  const coreBefore = { ...managedDefinition, projectId: "core-before" };
  const coreAfter = { ...managedDefinition, projectId: "core-after" };
  const mixedBytes = Buffer.from(
    `${encodeRuntimeStateValue({
      ...canonical,
      projects: [coreBefore, managedDefinition, coreAfter],
    })}\n`,
  );
  const mixed = decodeRuntimeDomainSnapshot(mixedBytes, binding);
  assert.ok(mixed, "Coreのみの定義と管理実行が同じ正本へ共存する");
  assert.equal(mixed.projects.length, 1, "Coreに偽の管理実行を投影しない");
  const mixedCandidate = prepareCoordinatorUnifiedTaskSnapshot(
    mixedBytes,
    stateUpdate,
    1,
    binding,
  );
  assert.ok(mixedCandidate);
  const mixedUpdated = decodeRuntimeDomainSnapshot(mixedCandidate, binding);
  assert.ok(mixedUpdated);
  assert.deepEqual(
    mixedUpdated.snapshot.projects.map((project) => project.projectId),
    ["core-before", "project-a", "core-after"],
    "管理Task更新で他Core定義の順序を変えない",
  );
  assert.deepEqual(mixedUpdated.snapshot.projects[0], coreBefore);
  assert.deepEqual(mixedUpdated.snapshot.projects[2], coreAfter);
  assert.equal(mixedUpdated.snapshot.managedExecutions.length, 1);
  assert.equal(
    Object.hasOwn(mixedUpdated.snapshot.projects[1] ?? {}, "ownerGeneration"),
    false,
    "Owner・SelectionはCore定義へ複製しない",
  );
  const changed = {
    ...stateUpdate,
    taskExecutionSelections: {
      ...stateUpdate.taskExecutionSelections,
      executor: {
        ...stateUpdate.taskExecutionSelections.executor,
        modelIdentifier: "another-model",
      },
    },
  };
  assert.equal(
    prepareCoordinatorUnifiedTaskSnapshot(unifiedBytes, changed, 1, binding),
    null,
  );
  assert.equal(
    decodeUnified({ ...unified, schema: "crdd-coordinator/current-state/v3" }),
    null,
  );
  assert.equal(
    decodeUnified({
      ...unified,
      projects: storedProjects.map(
        ({ taskExecutionSelections: _old, ...rest }) => rest,
      ),
    }),
    null,
  );
  assert.deepEqual(
    decodeRuntimeDomainSnapshot(stateCandidate, binding)?.projects,
    [stateUpdate],
  );
  assert.equal(
    prepareCoordinatorUnifiedTaskSnapshot(
      unifiedBytes,
      stateUpdate,
      0,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorUnifiedTaskSnapshot(
      unifiedBytes,
      stateUpdate,
      2,
      binding,
    ),
    null,
  );
  const storedTask = storedProjects[0]?.tasks[0];
  assert.ok(storedTask);
  for (const patch of [
    { cleanupConfirmed: false },
    { recoveryUnresolved: false },
    { resultAcceptances: [] },
    { resultAcceptanceIds: ["missing"] },
    {
      settlement: {
        kind: "operations",
        recoveryIds: ["missing"],
        resultUnresolved: false,
      },
    },
  ])
    assert.equal(
      decodeUnified({
        ...unified,
        projects: [
          { ...storedProjects[0], tasks: [{ ...storedTask, ...patch }] },
        ],
      }),
      null,
    );
  const oldReceipt = {
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-old",
    operationId: "operation-old",
    recoveryId: "recovery-old",
    settlementGeneration: 1,
    repositoryBinding: binding,
    resultId: "d".repeat(64),
    consumer: "orchestrator",
  };
  const withReceipt = { ...unified, resultReceipts: [oldReceipt] };
  assert.ok(decodeUnified(withReceipt));
  const receiptBytes = Buffer.from(
    `${encodeRuntimeStateValue(createManagedRuntimeSnapshotFixture(withReceipt))}\n`,
  );
  const retry = {
    ...withReceipt,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: createHash("sha256").update(receiptBytes).digest("hex"),
    },
    projects: [
      {
        ...storedProjects[0],
        generation: 2,
        tasks: [
          {
            ...storedTask,
            state: "failed",
            attemptId: "attempt-new",
            operationId: "operation-new",
            authorityBindingId: "authority-new",
            startPhase: "settled",
            retryCount: 1,
            settlement: {
              kind: "executor_result",
              cleanupConfirmed: true,
              recoveryUnresolved: false,
            },
          },
        ],
      },
    ],
  };
  assert.ok(decodeUnified(retry));
  assert.equal(
    validateCoordinatorUnifiedTransition(
      receiptBytes,
      Buffer.from(
        `${encodeRuntimeStateValue(createManagedRuntimeSnapshotFixture(retry))}\n`,
      ),
      binding,
    ),
    true,
  );
  assert.equal(
    decodeUnified({
      ...retry,
      projects: [
        {
          ...retry.projects[0],
          tasks: [
            {
              ...retry.projects[0]?.tasks[0],
              resultAcceptanceIds: [oldReceipt.recoveryId],
            },
          ],
        },
      ],
    }),
    null,
  );
  for (const resultReceipts of [
    [],
    [{ ...oldReceipt, settlementGeneration: 2 }],
    [{ ...oldReceipt, resultId: "e".repeat(64) }],
  ]) {
    assert.equal(
      validateCoordinatorUnifiedTransition(
        receiptBytes,
        Buffer.from(
          `${encodeRuntimeStateValue({ ...retry, resultReceipts })}\n`,
        ),
        binding,
      ),
      false,
    );
  }
});

/**
 * 耐久受領の候補保持を本番wrapper本文で検証する。
 * @responsibility 保存途中の候補を後続Effect 0で失わず、元Bufferとも分離する。
 * @trace PRL-UT-006
 * @precondition WriterとReaderはメモリ代役で、Kernel・実保存は対象外。
 * @stimulus 初回未発行、部分保存、再入場未発行、三確認成功を返す。
 * @observation Reader回数、保持pair全文、Writer受渡しと入力Buffer変異。
 * @oracle 初回Effect 0だけ破棄、部分保存後は三確認成功まで同候補を保持する。
 * @cleanup N/A: VMメモリ以外の資源を作らない。
 * @boundary 保存wrapperの候補lifecycle。実保存・実Consumer ACKを証明しない。
 */
test("結果受領方式: 固定利用側と任意降格の拒否", () => {
  assert.equal(
    coordinatorConsumerCompletionPolicy("coordinator_cli"),
    "transient",
  );
  assert.equal(coordinatorConsumerCompletionPolicy("workbench"), "transient");
  assert.equal(coordinatorConsumerCompletionPolicy("orchestrator"), "durable");
  let evaluations = 0;
  const hostile = Object.defineProperty({}, "consumer", {
    get() {
      evaluations += 1;
      throw new Error("not_evaluated");
    },
  });
  const proxy = new Proxy(
    {},
    {
      get() {
        evaluations += 1;
        throw new Error("not_evaluated");
      },
    },
  );
  for (const invalid of [
    "",
    "unknown_consumer",
    "transient",
    "durable",
    null,
    undefined,
    0,
    { consumer: "orchestrator", completionPolicy: "transient" },
    ["orchestrator"],
    new String("orchestrator"),
    hostile,
    proxy,
  ])
    assert.equal(coordinatorConsumerCompletionPolicy(invalid), null);
  assert.equal(evaluations, 0);
});
const empty = {
  ...emptyUnifiedSnapshot(),
  schema: COORDINATOR_STATE_SCHEMA,
  revision: 1,
  previous: null,
  repositoryBinding: binding,
  operations: [],
  unresolvedRecoveries: [],
  pendingDeliveries: [],
};

/**
 * 正規本文と改訂相関、Repository結合を検証する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: 正規本文、改訂、結合と空集合", () => {
  const text = `${encodeRuntimeStateValue(empty)}\n`;
  const result = decodeCoordinatorStateSnapshot(Buffer.from(text), binding);
  assert.ok(result);
  assert.equal(result.payloadSha256, hashRuntimeStateContent(empty));
  assert.ok(Object.isFrozen(result.snapshot.operations));
  for (const invalid of [
    { ...empty, repositoryBinding: "b".repeat(64) },
    { ...empty, revision: 0 },
    { ...empty, revision: 2 },
    { ...empty, unknown: true },
    { ...empty, pendingDeliveries: [{ operationNonce: binding }] },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(`${JSON.stringify(empty)}\n`),
      binding,
    ),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(text.replace('"revision":1', '"revision":1,"revision":1')),
      binding,
    ),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(Buffer.from([0xff]), binding),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(Buffer.from(text), "wrong"),
    null,
  );
});

/**
 * getterやProxyを実行せず不正JSON値を拒否する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: hostile値と配列順", () => {
  let isInvoked = false;
  const hostile = Object.defineProperty({}, "value", {
    get() {
      isInvoked = true;
      return 1;
    },
  });
  assert.throws(() => encodeRuntimeStateValue(hostile));
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        isInvoked = true;
        return [];
      },
    },
  );
  assert.throws(() => encodeRuntimeStateValue(proxy));
  assert.equal(isInvoked, false);
  const bytes = Buffer.from(`${encodeRuntimeStateValue(empty)}\n`);
  const proxyBytes = new Proxy(bytes, {
    get() {
      isInvoked = true;
      throw new Error("trap");
    },
  });
  assert.equal(decodeCoordinatorStateSnapshot(proxyBytes, binding), null);
  Object.defineProperty(bytes, "length", {
    get() {
      isInvoked = true;
      throw new Error("getter");
    },
  });
  assert.ok(decodeCoordinatorStateSnapshot(bytes, binding));
  assert.equal(isInvoked, false);
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(`${encodeRuntimeStateValue(empty)}\n`),
      ]),
      binding,
    ),
    null,
  );
  assert.equal(
    encodeRuntimeStateValue({ z: [2, 1], a: 0 }),
    '{"a":0,"z":[2,1]}',
  );
  assert.equal(
    encodeRuntimeStateValue(
      Object.assign(Object.create(null), { z: [2, 1], a: 0 }),
    ),
    '{"a":0,"z":[2,1]}',
  );
  assert.throws(() =>
    encodeRuntimeStateValue(
      Object.assign(Object.create({ inherited: 1 }), { a: 0 }),
    ),
  );
  assert.throws(() => encodeRuntimeStateValue(new Array(2)));
  assert.throws(() => encodeRuntimeStateValue(Number.NaN));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => encodeRuntimeStateValue(cycle));
});

/**
 * 操作のexact参照とHost証明本文、unknown観測を保持する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: 固定Identity、資源とHost証明の相関", () => {
  const nonce = "b".repeat(64);
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token =
    "host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc." +
    hostHash;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v2",
    operationNonce: nonce,
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    executionSelection: executionSelection("executor", {
      provider: "claude",
      model: "opus",
      effort: "low",
    }),
    taskAttempt: 0,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: {
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    },
    images: {
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
    },
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const identityJson = `${JSON.stringify(identity)}\n`;
  assert.ok(
    prepareCoordinatorStateOperationSnapshot(null, identityJson, binding),
    "正常な初期Host証明を現行model自身が受理する",
  );
  const technical = decodeCoordinatorStateSnapshot(
    prepareCoordinatorStateOperationSnapshot(null, identityJson, binding),
    binding,
  );
  assert.ok(technical);
  const domainTechnical = {
    ...technical.snapshot,
    schema: "crdd-domain/runtime-state/v1",
    managedExecutions: [],
  };
  const domainRead = decodeRuntimeDomainSnapshot(
    Buffer.from(`${encodeRuntimeStateValue(domainTechnical)}\n`),
    binding,
  );
  assert.ok(domainRead);
  assert.deepEqual(
    domainRead.snapshot.operations,
    technical.snapshot.operations,
  );
  assert.deepEqual(
    domainRead.snapshot.unresolvedRecoveries,
    technical.snapshot.unresolvedRecoveries,
  );
  for (const invalidIdentity of [
    { ...identity, schema: "crdd-coordinator/operation-identity/v1" },
    { ...identity, profileId: "PROFILE-123456" },
    { ...identity, taskAttempt: 2 },
    {
      ...identity,
      executionSelection: { ...identity.executionSelection, provider: "codex" },
    },
  ])
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(
        null,
        `${JSON.stringify(invalidIdentity)}\n`,
        binding,
      ),
      null,
    );
  for (const initialHostRecovery of [
    { ...identity.initialHostRecovery, token: `${token.slice(0, -1)}0` },
    { ...identity.initialHostRecovery, recordHash: "0".repeat(64) },
    {
      ...identity.initialHostRecovery,
      record: {
        ...hostRecord,
        childIdentities: {
          management: {
            ...hostRecord.childIdentities.management,
            unexpected: "not-an-identity-field",
          },
        },
      },
    },
  ]) {
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(
        null,
        `${JSON.stringify({ ...identity, initialHostRecovery })}\n`,
        binding,
      ),
      null,
      "token・Hash相関と子Identityの閉集合を緩めない",
    );
  }
  const identitySha256 = createHash("sha256")
    .update(identityJson)
    .digest("hex");
  const recoveryId =
    "docker-task." +
    identity.stableLogicalHomeBindingHash +
    "." +
    nonce +
    "." +
    identitySha256;
  const successor = { ...hostRecord, state: "docker_submission_started" };
  const expectedToken =
    token.slice(0, -64) +
    createHash("sha256")
      .update(`${JSON.stringify(successor)}\n`)
      .digest("hex");
  const transition = {
    currentToken: token,
    expectedToken,
    rootName: hostRecord.rootName,
    nonce: "12345678-1234-4234-8234-123456789abc",
    currentState: "host_only",
    nextState: "docker_submission_started",
    recordBefore: hostRecord,
  };
  const operation = {
    kind: "docker_task" as const,
    dockerRestart: null,
    identityJson,
    identitySha256,
    recoveryId,
    phase: "settling",
    resources: [
      "create_egress_network",
      "create_internal_network",
      "create_provider",
      "create_proxy",
      "create_subscription_auth_probe",
    ].map((purpose) => ({
      purpose,
      request: purpose === "create_provider" ? "identified" : "not_requested",
      dockerId: purpose === "create_provider" ? "d".repeat(64) : null,
      receiptSource:
        purpose === "create_provider" ? "docker_create_result" : null,
      observation: "unknown",
      absence: null,
    })),
    host: {
      currentToken: token,
      pendingTransitionJson: `${JSON.stringify(transition)}\n`,
      cleanup: "unknown",
    },
    lease: "unknown",
    execution: {
      providerStart: "unknown",
      externalSend: "unknown",
      sharedWrite: "unknown",
      ownerEffect: "unknown",
      workspaceReusable: false,
    },
    primaryFailure: null,
    outcome: null,
    summarySha256: null,
    history: null,
  };
  const snapshot = { ...empty, operations: [operation] };
  const limitedRestartId = createDockerRestartRequestId(
    binding,
    identitySha256,
    recoveryId,
    "f".repeat(64),
  );
  assert.ok(limitedRestartId);
  const limitedState = {
    ...snapshot,
    operations: [
      {
        ...operation,
        host: {
          ...operation.host,
          pendingTransitionJson: null,
          cleanup: "not_requested",
        },
        lease: "held",
        execution: {
          providerStart: "not_started",
          externalSend: "not_issued",
          sharedWrite: "not_issued",
          ownerEffect: "disabled",
          workspaceReusable: false,
        },
        resources: operation.resources.map((resource) => ({
          ...resource,
          request:
            resource.purpose === "create_subscription_auth_probe"
              ? "unknown"
              : "not_requested",
          dockerId: null,
          receiptSource: null,
          observation: "unobserved",
          absence: null,
        })),
        dockerRestart: {
          requestId: limitedRestartId,
          scopeSha256: "f".repeat(64),
          request: "confirmed",
          cleanup: "confirmed",
          result: {
            status: "completed",
            reason: "docker_restart_settled",
            request: "confirmed",
            effectOutcomeUnknown: false,
          },
        },
      },
    ],
  };
  const limitedBytes = Buffer.from(
    `${encodeRuntimeStateValue(limitedState)}\n`,
  );
  const limitedDecoded = decodeCoordinatorStateSnapshot(limitedBytes, binding);
  const limitedOperation = limitedDecoded?.snapshot.operations[0];
  assert.ok(limitedOperation?.kind === "docker_task");
  assert.equal(
    coordinatorAuthenticationUnknownCanClose(limitedOperation),
    true,
  );
  assert.equal(coordinatorTaskResourcesAreSettled(limitedOperation), false);
  const observations = [
    { round: 1, name: "absent", name_label: "absent" },
    { round: 2, name: "absent", name_label: "absent" },
  ];
  const limitedClosed = prepareCoordinatorAuthenticationUnknownClosureSnapshot(
    limitedBytes,
    recoveryId,
    observations,
    binding,
  );
  assert.ok(limitedClosed);
  const closedDecoded = decodeCoordinatorStateSnapshot(limitedClosed, binding);
  assert.ok(closedDecoded);
  const closedOperation = closedDecoded?.snapshot.operations[0];
  assert.ok(closedOperation?.kind === "docker_task");
  assert.equal(coordinatorTaskResourcesAreSettled(closedOperation), true);
  assert.deepEqual(
    { ...closedOperation, resources: limitedOperation.resources },
    limitedOperation,
  );
  const authClosed = closedOperation.resources.find(
    (item) => item.purpose === "create_subscription_auth_probe",
  );
  assert.ok(authClosed?.absence);
  assert.equal(authClosed.request, "unknown");
  assert.equal(authClosed.dockerId, null);
  assert.equal(
    authClosed.absence.evidenceSha256,
    createHash("sha256")
      .update(
        encodeRuntimeStateValue({
          domain: "crdd-coordinator/authentication-unknown-absence/v1",
          identitySha256,
          recoveryId,
          purpose: "create_subscription_auth_probe",
          plannedResourceName: identity.resources.auth,
          ownershipLabel: identity.ownershipLabel,
          dockerId: null,
          restart: limitedOperation.dockerRestart,
          observations,
        }),
      )
      .digest("hex"),
  );
  assert.ok(
    prepareCoordinatorAuthenticationUnknownClosureSnapshot(
      limitedClosed,
      recoveryId,
      observations,
      binding,
    )?.equals(limitedClosed),
  );
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      limitedBytes,
      recoveryId,
      authClosed,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      limitedBytes,
      recoveryId,
      limitedOperation.resources.map((resource) => ({
        purpose: resource.purpose,
        plannedResourceName: {
          create_egress_network: identity.resources.egress,
          create_internal_network: identity.resources.internal,
          create_provider: identity.resources.provider,
          create_proxy: identity.resources.proxy,
          create_subscription_auth_probe: identity.resources.auth,
        }[resource.purpose],
        dockerId: null,
        observation:
          resource.purpose === "create_subscription_auth_probe"
            ? "absent"
            : "not_requested",
      })),
      binding,
    ),
    null,
  );
  for (const invalid of [
    [],
    observations.slice(0, 1),
    [...observations, observations[0]],
    [{ ...observations[0], name: "unknown" }, observations[1]],
    [observations[0], { ...observations[1], name_label: "present" }],
  ])
    assert.equal(
      prepareCoordinatorAuthenticationUnknownClosureSnapshot(
        limitedBytes,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  for (const field of [
    "providerStart",
    "externalSend",
    "sharedWrite",
    "ownerEffect",
  ] as const) {
    const changed: CoordinatorStateTaskOperation = {
      ...closedOperation,
      execution: { ...closedOperation.execution, [field]: "unknown" as const },
    };
    assert.equal(coordinatorAuthenticationUnknownCanClose(changed), false);
    assert.equal(coordinatorTaskResourcesAreSettled(changed), false);
  }
  for (const request of ["not_issued", "unknown", "issued"] as const) {
    assert.ok(closedOperation.dockerRestart);
    const changed: CoordinatorStateTaskOperation = {
      ...closedOperation,
      dockerRestart: { ...closedOperation.dockerRestart, request },
    };
    assert.equal(coordinatorAuthenticationUnknownCanClose(changed), false);
    assert.equal(coordinatorTaskResourcesAreSettled(changed), false);
  }
  const closedAbsence = authClosed.absence;
  const badEvidence = {
    ...closedOperation,
    resources: closedOperation.resources.map((resource) =>
      resource !== authClosed
        ? resource
        : {
            ...resource,
            absence: { ...closedAbsence, evidenceSha256: "0".repeat(64) },
          },
    ),
  };
  assert.equal(coordinatorTaskResourcesAreSettled(badEvidence), false);
  // 実Writer外側の値差分guardだけを分離する。Kernel/FSの成立はHost試験が所有する。
  const storeSource = fs.readFileSync(
    new URL("../../../src/storage/state.ts", import.meta.url),
    "utf8",
  );
  const helperStart = storeSource.indexOf(
    "function authenticationUnknownAbsenceChanged(",
  );
  const helperEnd = storeSource.indexOf("\n/**", helperStart);
  const guardStart = storeSource.indexOf(
    "  if (\n    !currentAuthenticationClosure &&",
  );
  const guardEnd = storeSource.indexOf(
    "  const storageOwner = acquireCoordinatorStorageOwnerForRepository(repository);",
    guardStart,
  );
  assert.ok(
    helperStart > 0 &&
      helperEnd > helperStart &&
      guardStart > 0 &&
      guardEnd > guardStart,
  );
  const differenceBody = stripTypeScriptTypes(
    storeSource.slice(helperStart, helperEnd),
  );
  const outerBody = stripTypeScriptTypes(
    `function extractedGuard(){\n${storeSource.slice(guardStart, guardEnd)}\n}`,
  )
    .replace(/^function extractedGuard\(\)\s*\{/u, "")
    .replace(/\}\s*$/u, "");
  const alternateState = {
    ...closedDecoded.snapshot,
    revision: closedDecoded.snapshot.revision + 1,
    previous: {
      revision: closedDecoded.snapshot.revision,
      payloadSha256: closedDecoded.payloadSha256,
    },
  };
  const alternate = Buffer.from(`${encodeRuntimeStateValue(alternateState)}\n`);
  assert.ok(decodeCoordinatorStateSnapshot(alternate, binding));
  const badAuthBytes = Buffer.from(
    `${encodeRuntimeStateValue({ ...closedDecoded.snapshot, operations: [badEvidence] })}\n`,
  );
  assert.ok(decodeCoordinatorStateSnapshot(badAuthBytes, binding));
  const pairKinds = [
    "currentHistory",
    "currentDelivery",
    "currentCompletion",
    "currentRepair",
    "settlement.completion",
    "hostCleanupPublication",
  ];
  for (const kind of pairKinds) {
    for (const scenario of [
      "normal",
      "before_invalid",
      "candidate_mismatch",
      "auth_changed",
      "multiple",
    ] as const) {
      const targetBytes =
        scenario === "candidate_mismatch"
          ? alternate
          : scenario === "auth_changed"
            ? badAuthBytes
            : limitedClosed;
      const decodedTarget = decodeCoordinatorStateSnapshot(
        targetBytes,
        binding,
      );
      assert.ok(decodedTarget);
      const pair = {
        before:
          scenario === "before_invalid"
            ? Buffer.from("{}\n")
            : Buffer.from(limitedClosed),
        candidate:
          scenario === "candidate_mismatch"
            ? Buffer.from(limitedClosed)
            : Buffer.from(targetBytes),
      };
      const variants = [{ name: "original", body: outerBody }];
      if (scenario === "candidate_mismatch")
        variants.push({
          name: "candidate_guard_removed",
          body: outerBody.replace("fixed?.candidate.equals(bytes)", "true"),
        });
      if (scenario === "multiple")
        variants.push({
          name: "multiple_guard_removed",
          body: outerBody.replace(
            "fixedPairs.length === 1",
            "fixedPairs.length >= 1",
          ),
        });
      if (scenario === "auth_changed")
        variants.push({
          name: "difference_guard_removed",
          body: outerBody.replace(
            /authenticationUnknownAbsenceChanged\(\s*previousSnapshot,\s*candidate.snapshot,?\s*\)/u,
            "false",
          ),
        });
      for (const variant of variants) {
        if (variant.name !== "original")
          assert.notEqual(variant.body, outerBody);
        let requests = 0,
          reads = 0;
        const settlement: Record<string, unknown> = {};
        const environment: Record<string, unknown> = {
          Buffer,
          currentAuthenticationClosure: null,
          currentHistory: null,
          currentDelivery: null,
          currentCompletion: null,
          currentRepair: null,
          hostCleanupPublication: null,
          settlement,
          candidate: decodedTarget,
          bytes: targetBytes,
          repository: { repositoryBinding: binding },
          attempt: {},
          encodeRuntimeStateValue,
          decodeCoordinatorStateSnapshot,
          readCoordinatorStateSnapshot: () => {
            reads++;
            return {
              status: "completed",
              lockReleased: true,
              value: closedDecoded,
            };
          },
          request: () => requests++,
        };
        if (kind.startsWith("settlement."))
          settlement[kind.slice("settlement.".length)] = pair;
        else environment[kind] = pair;
        if (scenario === "multiple") {
          if (kind === "currentHistory") environment.currentDelivery = pair;
          else environment.currentHistory = pair;
        }
        runInNewContext(
          `(function(){${differenceBody}\n${variant.body}\nrequest();})()`,
          environment,
        );
        assert.equal(
          requests,
          scenario === "normal" || variant.name !== "original" ? 1 : 0,
          `${kind}:${scenario}:${variant.name}`,
        );
        assert.equal(
          reads,
          0,
          `${kind}:${scenario}: no fresh Reader qualification`,
        );
        if (scenario !== "normal" && variant.name !== "original")
          assert.throws(() => assert.equal(requests, 0));
      }
    }
  }
  let readerOnlyRequests = 0,
    readerOnlyReads = 0;
  runInNewContext(
    `(function(){${differenceBody}\n${outerBody}\nrequest();})()`,
    {
      Buffer,
      currentAuthenticationClosure: null,
      currentHistory: null,
      currentDelivery: null,
      currentCompletion: null,
      currentRepair: null,
      hostCleanupPublication: null,
      settlement: {},
      candidate: closedDecoded,
      bytes: limitedClosed,
      repository: { repositoryBinding: binding },
      attempt: {},
      encodeRuntimeStateValue,
      decodeCoordinatorStateSnapshot,
      readCoordinatorStateSnapshot: () => {
        readerOnlyReads++;
        return { status: "blocked", value: null, lockReleased: true };
      },
      request: () => readerOnlyRequests++,
    },
  );
  assert.equal(readerOnlyRequests, 0);
  assert.equal(readerOnlyReads, 1);
  // 保存前の限定条件と保存後の相関を、同じ正常入力から一軸ずつ崩す。
  for (const source of [limitedOperation, closedOperation]) {
    const auth = source.resources.find(
      (resource) => resource.purpose === "create_subscription_auth_probe",
    );
    assert.ok(auth);
    assert.ok(source.dockerRestart?.result);
    const restart = source.dockerRestart;
    const restartResult = restart.result;
    assert.ok(restartResult);
    const invalidOperations: CoordinatorStateTaskOperation[] = [
      { ...source, phase: "executing" },
      {
        ...source,
        execution: {
          ...source.execution,
          workspaceReusable: true,
        } as unknown as CoordinatorStateTaskOperation["execution"],
      },
      ...(
        ["not_requested", "not_issued", "intent_saved", "identified"] as const
      ).map((request) => ({
        ...source,
        resources: source.resources.map((resource) =>
          resource !== auth ? resource : { ...resource, request },
        ),
      })),
      ...[
        { ...auth, dockerId: "a".repeat(64) },
        { ...auth, receiptSource: "runtime_reconciliation" as const },
        { ...auth, observation: "present" as const },
      ].map((changedAuth) => ({
        ...source,
        resources: source.resources.map((resource) =>
          resource !== auth ? resource : changedAuth,
        ),
      })),
      ...source.resources
        .filter((resource) => resource !== auth)
        .map((other) => ({
          ...source,
          resources: source.resources.map((resource) =>
            resource !== other
              ? resource
              : { ...resource, request: "unknown" as const },
          ),
        })),
      { ...source, dockerRestart: null },
      ...(["not_required", "pending", "unknown"] as const).map((cleanup) => ({
        ...source,
        dockerRestart: { ...restart, cleanup },
      })),
      { ...source, dockerRestart: { ...restart, result: null } },
      {
        ...source,
        dockerRestart: { ...restart, requestId: "0".repeat(64) },
      },
      {
        ...source,
        dockerRestart: {
          ...restart,
          result: { ...restartResult, effectOutcomeUnknown: true },
        },
      },
      ...(["not_issued", "unknown", "issued"] as const).map((request) => ({
        ...source,
        dockerRestart: {
          ...restart,
          result: { ...restartResult, request },
        },
      })),
      {
        ...source,
        dockerRestart: {
          ...restart,
          result: { ...restartResult, status: "blocked" as const },
        },
      },
    ];
    for (const changed of invalidOperations) {
      assert.equal(coordinatorAuthenticationUnknownCanClose(changed), false);
      const changedAuth = changed.resources.find(
        (resource) => resource.purpose === "create_subscription_auth_probe",
      );
      // 未要求・未発行は既存の通常終端。専用Classだけを拒否する。
      assert.equal(
        coordinatorTaskResourcesAreSettled(changed),
        changedAuth?.request === "not_requested" ||
          changedAuth?.request === "not_issued" ||
          (changedAuth?.request === "identified" &&
            changedAuth.observation === "absent"),
      );
      assert.equal(
        prepareCoordinatorAuthenticationUnknownClosureSnapshot(
          Buffer.from(
            `${encodeRuntimeStateValue({ ...limitedState, operations: [changed] })}\n`,
          ),
          recoveryId,
          observations,
          binding,
        ),
        null,
      );
    }
  }
  for (const changedAbsence of [
    { ...closedAbsence, evidenceSha256: "f".repeat(64) },
    { ...closedAbsence, recoveryId: `${recoveryId}-other` },
    { ...closedAbsence, plannedResourceName: "crdd-auth-fedcba9876543210" },
    { ...closedAbsence, dockerId: "a".repeat(64) },
  ]) {
    const changed: CoordinatorStateTaskOperation = {
      ...closedOperation,
      resources: closedOperation.resources.map((resource) =>
        resource !== authClosed
          ? resource
          : { ...resource, absence: changedAbsence },
      ),
    };
    assert.equal(coordinatorTaskResourcesAreSettled(changed), false);
  }
  assert.ok(
    decodeCoordinatorStateSnapshot(
      Buffer.from(
        `${encodeRuntimeStateValue({ ...limitedState, operations: [badEvidence] })}\n`,
      ),
      binding,
    ),
    "偽Hashの拒否はcodec不正ではなく共同終了判定で行う",
  );
  // 専用不存在から三利用側の履歴・配送・ACK・除去・次受付へ搬送する。
  // ここは値契約であり、Host清掃や上位の耐久保存を実測するものではない。
  for (const consumer of [
    "coordinator_cli",
    "workbench",
    "orchestrator",
  ] as const) {
    const consumerIdentity = { ...identity, consumer };
    const consumerJson = `${JSON.stringify(consumerIdentity)}\n`;
    const consumerHash = createHash("sha256")
      .update(consumerJson)
      .digest("hex");
    const consumerRecoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${nonce}.${consumerHash}`;
    const consumerRestartId = createDockerRestartRequestId(
      binding,
      consumerHash,
      consumerRecoveryId,
      "f".repeat(64),
    );
    assert.ok(consumerRestartId);
    assert.ok(limitedOperation.dockerRestart);
    const consumerOperation: CoordinatorStateTaskOperation = {
      ...limitedOperation,
      identityJson: consumerJson,
      identitySha256: consumerHash,
      recoveryId: consumerRecoveryId,
      dockerRestart: {
        ...limitedOperation.dockerRestart,
        requestId: consumerRestartId,
      },
    };
    const consumerBefore = Buffer.from(
      `${encodeRuntimeStateValue({ ...empty, operations: [consumerOperation] })}\n`,
    );
    const consumerClosed =
      prepareCoordinatorAuthenticationUnknownClosureSnapshot(
        consumerBefore,
        consumerRecoveryId,
        observations,
        binding,
      );
    assert.ok(consumerClosed, consumer);
    const resourceClosed = decodeCoordinatorStateSnapshot(
      consumerClosed,
      binding,
    )?.snapshot.operations[0];
    assert.ok(resourceClosed?.kind === "docker_task");
    const terminalTask: CoordinatorStateTaskOperation = {
      ...resourceClosed,
      host: {
        ...resourceClosed.host,
        pendingTransitionJson: null,
        cleanup: "confirmed",
      },
      lease: "released",
      outcome: {
        status: "blocked",
        reason: "docker_setup_create_subscription_auth_probe_failed",
        cleanupConfirmed: true,
      },
    };
    const terminalBytes = Buffer.from(
      `${encodeRuntimeStateValue({ ...empty, operations: [terminalTask] })}\n`,
    );
    assert.ok(decodeCoordinatorStateSnapshot(terminalBytes, binding), consumer);
    const time = "2026-10-16T00:00:00.000Z";
    const historyPending = prepareCoordinatorStateHistorySnapshot(
      terminalBytes,
      consumerRecoveryId,
      time,
      false,
      binding,
    );
    assert.ok(historyPending, consumer);
    const historyConfirmed = prepareCoordinatorStateHistorySnapshot(
      historyPending,
      consumerRecoveryId,
      time,
      true,
      binding,
    );
    assert.ok(historyConfirmed, consumer);
    const delivered = prepareCoordinatorStateResultDeliverySnapshot(
      historyConfirmed,
      consumerRecoveryId,
      consumer === "orchestrator" ? ["orchestrator"] : [],
      binding,
    );
    assert.ok(delivered, consumer);
    const accepted = delivered;
    if (consumer === "orchestrator") {
      assert.equal(
        prepareCoordinatorStateCompletionSnapshot(
          delivered,
          consumerRecoveryId,
          binding,
        ),
        null,
      );
      continue;
    }
    const completed = prepareCoordinatorStateCompletionSnapshot(
      accepted,
      consumerRecoveryId,
      binding,
    );
    assert.ok(completed, consumer);
    const completedState = decodeCoordinatorStateSnapshot(completed, binding);
    assert.ok(completedState);
    assert.deepEqual(completedState.snapshot.operations, []);
    assert.deepEqual(completedState.snapshot.unresolvedRecoveries, []);
    assert.deepEqual(completedState.snapshot.pendingDeliveries, []);
    const nextIdentityJson = `${JSON.stringify({ ...consumerIdentity, operationNonce: "d".repeat(64), operationId: "OP-654321" })}\n`;
    assert.ok(
      prepareCoordinatorStateOperationSnapshot(
        accepted,
        nextIdentityJson,
        binding,
      ),
      `${consumer}: settled predecessor permits next admission`,
    );
    const acceptedState = decodeCoordinatorStateSnapshot(accepted, binding);
    assert.ok(acceptedState);
    const acceptedTask = acceptedState.snapshot.operations[0];
    assert.ok(acceptedTask?.kind === "docker_task");
    const badTask: CoordinatorStateTaskOperation = {
      ...acceptedTask,
      resources: acceptedTask.resources.map((resource) =>
        resource.purpose !== "create_subscription_auth_probe" ||
        !resource.absence
          ? resource
          : {
              ...resource,
              absence: { ...resource.absence, evidenceSha256: "0".repeat(64) },
            },
      ),
    };
    const rejected = Buffer.from(
      `${encodeRuntimeStateValue({ ...acceptedState.snapshot, operations: [badTask] })}\n`,
    );
    assert.ok(
      decodeCoordinatorStateSnapshot(rejected, binding),
      `${consumer}: forged evidence is codec legal`,
    );
    assert.equal(
      prepareCoordinatorStateHistorySnapshot(
        rejected,
        consumerRecoveryId,
        time,
        true,
        binding,
      ),
      null,
      consumer,
    );
    assert.equal(
      prepareCoordinatorStateResultDeliverySnapshot(
        rejected,
        consumerRecoveryId,
        [],
        binding,
      ),
      null,
      consumer,
    );
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        rejected,
        consumerRecoveryId,
        binding,
      ),
      null,
      consumer,
    );
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(
        rejected,
        nextIdentityJson,
        binding,
      ),
      null,
      consumer,
    );
  }
  const historyState = {
    ...snapshot,
    operations: [
      {
        ...operation,
        outcome: {
          status: "completed",
          reason: "provider_operation_completed",
          cleanupConfirmed: false,
        },
      },
    ],
  };
  const historyBytes = Buffer.from(
    `${encodeRuntimeStateValue(historyState)}\n`,
  );
  const readyHistoryState = {
    ...historyState,
    operations: [
      {
        ...operation,
        resources: operation.resources.map((item) => ({
          ...item,
          request: "not_requested",
          dockerId: null,
          receiptSource: null,
          observation: "unobserved",
          absence: null,
        })),
        host: {
          ...operation.host,
          pendingTransitionJson: null,
          cleanup: "confirmed",
        },
        lease: "released",
        execution: { ...operation.execution, ownerEffect: "disabled" },
        outcome: {
          ...historyState.operations.find((item) => item.kind === "docker_task")
            ?.outcome,
          cleanupConfirmed: true,
        },
      },
    ],
  };
  const readyHistoryBytes = Buffer.from(
    `${encodeRuntimeStateValue(readyHistoryState)}\n`,
  );
  const occurredAt = "2026-10-08T00:00:00.000Z";
  assert.equal(
    prepareCoordinatorStateHistorySnapshot(
      historyBytes,
      recoveryId,
      occurredAt,
      false,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateHistorySnapshot(
      readyHistoryBytes,
      recoveryId,
      occurredAt,
      true,
      binding,
    ),
    null,
  );
  const pendingHistoryBytes = prepareCoordinatorStateHistorySnapshot(
    readyHistoryBytes,
    recoveryId,
    occurredAt,
    false,
    binding,
  );
  assert.ok(pendingHistoryBytes);
  const pendingHistory = decodeCoordinatorStateSnapshot(
    pendingHistoryBytes,
    binding,
  );
  assert.ok(pendingHistory);
  const pendingOperation = pendingHistory.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(pendingOperation?.history);
  assert.equal(pendingOperation.history.occurredAt, occurredAt);
  assert.equal(pendingOperation.history.confirmed, false);
  const confirmedHistoryBytes = prepareCoordinatorStateHistorySnapshot(
    pendingHistoryBytes,
    recoveryId,
    occurredAt,
    true,
    binding,
  );
  assert.ok(confirmedHistoryBytes);
  const confirmedHistory = decodeCoordinatorStateSnapshot(
    confirmedHistoryBytes,
    binding,
  );
  assert.ok(confirmedHistory);
  // 結果IDは履歴確認・改訂から独立し、再登録で既存受理を巻き戻さない。
  const registeredPending = prepareCoordinatorStateResultDeliverySnapshot(
    pendingHistoryBytes,
    recoveryId,
    ["orchestrator"],
    binding,
  );
  const registeredConfirmed = prepareCoordinatorStateResultDeliverySnapshot(
    confirmedHistoryBytes,
    recoveryId,
    ["orchestrator"],
    binding,
  );
  assert.ok(registeredPending);
  assert.ok(registeredConfirmed);
  for (const consumer of ["coordinator_cli", "workbench"]) {
    const transientIdentity = { ...identity, consumer };
    const transientJson = `${JSON.stringify(transientIdentity)}\n`;
    const transientHash = createHash("sha256")
      .update(transientJson)
      .digest("hex");
    const transientRecoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${nonce}.${transientHash}`;
    const transientState = JSON.parse(readyHistoryBytes.toString("utf8"));
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identityJson = transientJson;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identitySha256 = transientHash;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).recoveryId = transientRecoveryId;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).summarySha256 = null;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history = null;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).execution = {
      ...transientState.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      ).execution,
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
    };
    transientState.pendingDeliveries = [];
    transientState.unresolvedRecoveries = [];
    const transientUnfixed = Buffer.from(
      `${encodeRuntimeStateValue(transientState)}\n`,
    );
    const transientFixed = prepareCoordinatorStateHistorySnapshot(
      transientUnfixed,
      transientRecoveryId,
      occurredAt,
      false,
      binding,
    );
    assert.ok(transientFixed);
    assert.deepEqual(
      prepareCoordinatorStateResultDeliverySnapshot(
        transientFixed,
        transientRecoveryId,
        [],
        binding,
      ),
      transientFixed,
    );
    assert.equal(
      prepareCoordinatorStateResultDeliverySnapshot(
        transientFixed,
        transientRecoveryId,
        ["orchestrator"],
        binding,
      ),
      null,
    );
    const transientCompletionReady = prepareCoordinatorStateHistorySnapshot(
      transientFixed,
      transientRecoveryId,
      occurredAt,
      true,
      binding,
    );
    assert.ok(transientCompletionReady);
    // 四つの終端利用側に同じ資源条件を搬送する。unknown/absentも
    // codecでは記録可能だが、通常終端の根拠には引き続き使用しない。
    for (const [request, observation, settled] of [
      ["not_requested", "unobserved", true],
      ["not_issued", "unobserved", true],
      ["identified", "absent", true],
      ["identified", "present", false],
      ["identified", "unknown", false],
      ["identified", "unobserved", false],
      ["unknown", "absent", false],
      ["issued", "absent", false],
      ["intent_saved", "absent", false],
    ] as const) {
      const matrixState = JSON.parse(transientCompletionReady.toString("utf8"));
      const matrixOperation = matrixState.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      );
      const matrixIdentity = JSON.parse(matrixOperation.identityJson);
      const auth = matrixOperation.resources.find(
        (item: { purpose: string }) =>
          item.purpose === "create_subscription_auth_probe",
      );
      assert.ok(auth);
      auth.request = request;
      auth.observation = observation;
      auth.dockerId = request === "identified" ? "d".repeat(64) : null;
      auth.receiptSource =
        request === "identified" ? "runtime_reconciliation" : null;
      auth.absence =
        observation === "absent"
          ? {
              recoveryId: transientRecoveryId,
              purpose: auth.purpose,
              plannedResourceName: matrixIdentity.resources.auth,
              dockerId: auth.dockerId,
              evidenceSha256: "e".repeat(64),
            }
          : null;
      const matrixBytes = Buffer.from(
        `${encodeRuntimeStateValue(matrixState)}\n`,
      );
      assert.ok(decodeCoordinatorStateSnapshot(matrixBytes, binding));
      const label = `${consumer}: ${request}/${observation}`;
      assert.equal(
        prepareCoordinatorStateHistorySnapshot(
          matrixBytes,
          transientRecoveryId,
          occurredAt,
          true,
          binding,
        ) !== null,
        settled,
        `${label}: history`,
      );
      assert.equal(
        prepareCoordinatorStateResultDeliverySnapshot(
          matrixBytes,
          transientRecoveryId,
          [],
          binding,
        ) !== null,
        settled,
        `${label}: delivery`,
      );
      assert.equal(
        prepareCoordinatorStateCompletionSnapshot(
          matrixBytes,
          transientRecoveryId,
          binding,
        ) !== null,
        settled,
        `${label}: removal`,
      );
      assert.equal(
        prepareCoordinatorStateOperationSnapshot(
          matrixBytes,
          `${JSON.stringify({
            ...matrixIdentity,
            operationNonce: "0".repeat(64),
            operationId: "OP-654321",
          })}\n`,
          binding,
        ) !== null,
        settled,
        `${label}: next attempt`,
      );
      if (request !== "identified" && observation === "absent") {
        assert.equal(
          prepareCoordinatorStateCleanupSnapshot(
            matrixBytes,
            transientRecoveryId,
            matrixOperation.resources.map(
              (item: {
                purpose: string;
                dockerId: string | null;
                request: string;
                observation: string;
              }) => ({
                purpose: item.purpose,
                plannedResourceName:
                  item.purpose === "create_subscription_auth_probe"
                    ? matrixIdentity.resources.auth
                    : matrixIdentity.resources[
                        item.purpose
                          .replace("create_", "")
                          .replace("_network", "")
                      ],
                dockerId: item.dockerId,
                observation:
                  item.request === "not_requested" ||
                  item.request === "not_issued"
                    ? "not_requested"
                    : item.observation,
              }),
            ),
            binding,
          ),
          null,
          `${label}: normal cleanup must not accept unidentified absence`,
        );
      }
    }
    const transientCompleted = prepareCoordinatorStateCompletionSnapshot(
      transientCompletionReady,
      transientRecoveryId,
      binding,
    );
    assert.ok(transientCompleted);
    const transientCompletedSnapshot = decodeCoordinatorStateSnapshot(
      transientCompleted,
      binding,
    );
    assert.ok(transientCompletedSnapshot);
    assert.equal(transientCompletedSnapshot.snapshot.operations.length, 0);
    assert.equal(
      transientCompletedSnapshot.snapshot.pendingDeliveries.length,
      0,
    );
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        transientFixed,
        transientRecoveryId,
        binding,
      ),
      null,
    );
    for (const effect of ["providerStart", "externalSend", "sharedWrite"]) {
      const unknownBeforeFixed = JSON.parse(transientUnfixed.toString("utf8"));
      unknownBeforeFixed.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      ).execution[effect] = "unknown";
      const unknownBytes = Buffer.from(
        `${encodeRuntimeStateValue(unknownBeforeFixed)}\n`,
      );
      const unknownFixed = prepareCoordinatorStateHistorySnapshot(
        unknownBytes,
        transientRecoveryId,
        occurredAt,
        false,
        binding,
      );
      assert.ok(unknownFixed);
      const unknownConfirmed = prepareCoordinatorStateHistorySnapshot(
        unknownFixed,
        transientRecoveryId,
        occurredAt,
        true,
        binding,
      );
      assert.ok(unknownConfirmed);
      const unknownLine = prepareCoordinatorStateHistoryLine(
        unknownConfirmed,
        transientRecoveryId,
        binding,
      );
      assert.ok(unknownLine);
      const recorded = JSON.parse(unknownLine.toString("utf8"));
      assert.equal(recorded.summary.execution[effect], "unknown");
      assert.deepEqual(
        recorded.summary.outcome,
        unknownBeforeFixed.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).outcome,
      );
      assert.deepEqual(
        recorded.summary.primaryFailure,
        unknownBeforeFixed.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).primaryFailure,
      );
      assert.ok(decodeCoordinatorHistoryRows(unknownLine));
      assert.ok(
        prepareCoordinatorStateCompletionSnapshot(
          unknownConfirmed,
          transientRecoveryId,
          binding,
        ),
      );
      const oldRow = { ...recorded, schema: "crdd-coordinator/history-row/v1" };
      assert.equal(
        decodeCoordinatorHistoryRows(
          Buffer.from(`${encodeRuntimeStateValue(oldRow)}\n`),
        ),
        null,
      );
      const unknownEffect = JSON.parse(
        transientCompletionReady.toString("utf8"),
      );
      unknownEffect.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      ).execution[effect] = "unknown";
      assert.equal(
        prepareCoordinatorStateCompletionSnapshot(
          Buffer.from(`${encodeRuntimeStateValue(unknownEffect)}\n`),
          transientRecoveryId,
          binding,
        ),
        null,
      );
    }
    const injectedPending = {
      ...JSON.parse(transientFixed.toString("utf8")),
      pendingDeliveries: [
        {
          operationNonce: nonce,
          recoveryId: transientRecoveryId,
          resultId: decodeCoordinatorStateSnapshot(
            transientFixed,
            binding,
          )?.snapshot.operations.find((item) => item.kind === "docker_task")
            ?.summarySha256,
          consumer: "orchestrator",
          acceptanceSha256: null,
        },
      ],
    };
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(injectedPending)}\n`),
        binding,
      ),
      null,
    );
  }
  const pendingResult = decodeCoordinatorStateSnapshot(
    registeredPending,
    binding,
  );
  const confirmedResult = decodeCoordinatorStateSnapshot(
    registeredConfirmed,
    binding,
  );
  assert.ok(pendingResult);
  assert.ok(confirmedResult);
  assert.deepEqual(
    pendingResult.snapshot.pendingDeliveries,
    confirmedResult.snapshot.pendingDeliveries,
  );
  assert.equal(
    confirmedResult.snapshot.pendingDeliveries[0]?.resultId,
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.summarySha256,
  );
  const forgedAcceptedResultBytes = prepareCoordinatorStateReferencesSnapshot(
    registeredConfirmed,
    recoveryId,
    {
      recovery: null,
      deliveries: confirmedResult.snapshot.pendingDeliveries.map(
        (delivery) => ({
          ...delivery,
          acceptanceSha256: "f".repeat(64),
        }),
      ),
    },
    binding,
  );
  assert.equal(
    forgedAcceptedResultBytes,
    null,
    "技術参照更新では受領を代筆できない",
  );
  const acceptedResultBytes = registeredConfirmed;
  assert.deepEqual(
    prepareCoordinatorStateResultDeliverySnapshot(
      acceptedResultBytes,
      recoveryId,
      ["orchestrator"],
      binding,
    ),
    acceptedResultBytes,
  );
  for (const invalidConsumers of [
    [],
    ["orchestrator", "workbench"],
    ["workbench", "workbench"],
    ["unknown"],
    ["coordinator_cli"],
  ])
    assert.equal(
      prepareCoordinatorStateResultDeliverySnapshot(
        acceptedResultBytes,
        recoveryId,
        invalidConsumers,
        binding,
      ),
      null,
    );
  assert.equal(
    prepareCoordinatorStateResultDeliverySnapshot(
      readyHistoryBytes,
      recoveryId,
      ["orchestrator"],
      binding,
    ),
    null,
  );
  const knownBeforeFixed = JSON.parse(readyHistoryBytes.toString("utf8"));
  knownBeforeFixed.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).execution = {
    ...knownBeforeFixed.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).execution,
    providerStart: "not_started",
    externalSend: "not_issued",
    sharedWrite: "not_issued",
  };
  const knownFixed = prepareCoordinatorStateHistorySnapshot(
    Buffer.from(`${encodeRuntimeStateValue(knownBeforeFixed)}\n`),
    recoveryId,
    occurredAt,
    false,
    binding,
  );
  assert.ok(knownFixed);
  const knownConfirmed = prepareCoordinatorStateHistorySnapshot(
    knownFixed,
    recoveryId,
    occurredAt,
    true,
    binding,
  );
  assert.ok(knownConfirmed);
  const knownHistory = decodeCoordinatorStateSnapshot(knownConfirmed, binding);
  assert.ok(knownHistory);
  const acceptedCompletionState = {
    ...knownHistory.snapshot,
    operations: knownHistory.snapshot.operations
      .filter((item) => item.kind === "docker_task")
      .map((value) => ({
        ...value,
        execution: {
          ...value.execution,
          providerStart: "not_started",
          externalSend: "not_issued",
          sharedWrite: "not_issued",
        },
      })),
    unresolvedRecoveries: [
      {
        operationNonce: nonce,
        recoveryId,
        reason: "provider_operation_completed",
        obligations: [
          "docker_resources",
          "host_cleanup",
          "lease_release",
          "result_delivery",
        ],
      },
    ],
    pendingDeliveries: ["orchestrator"].map((consumer) => ({
      operationNonce: nonce,
      recoveryId,
      resultId: knownHistory.snapshot.operations.find(
        (item) => item.kind === "docker_task",
      )?.summarySha256,
      consumer,
    })),
  };
  const acceptedCompletionBytes = Buffer.from(
    `${encodeRuntimeStateValue(acceptedCompletionState)}\n`,
  );
  const sameHomeNextIdentity = `${JSON.stringify({
    ...identity,
    operationNonce: "0".repeat(64),
    operationId: "OP-654321",
  })}\n`;
  // 同一Hostの技術終端と、別Hostに必要な物理清掃を混同しない。
  {
    const normalOld = {
      ...operation,
      phase: "executing",
      lease: "released",
      resources: operation.resources.map((resource) => ({
        ...resource,
        request: "not_requested",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      })),
      host: {
        currentToken: token,
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "disabled",
        workspaceReusable: false,
      },
    };
    const normalBefore = Buffer.from(
      `${encodeRuntimeStateValue({ ...empty, operations: [normalOld] })}\n`,
    );
    assert.ok(decodeCoordinatorStateSnapshot(normalBefore, binding));
    const nextIdentity = {
      ...identity,
      operationNonce: "0".repeat(64),
      initialHostRecovery: {
        ...identity.initialHostRecovery,
        markerIdentity: "1:2:5",
      },
    };
    const nextIdentityJson = `${JSON.stringify(nextIdentity)}\n`;
    const started = prepareCoordinatorStateOperationSnapshot(
      normalBefore,
      nextIdentityJson,
      binding,
    );
    assert.ok(
      started,
      "同一Hostの正常技術終端では物理清掃前に次roundを開始できる",
    );
    const startedValue = JSON.parse(started.toString("utf8"));
    assert.deepEqual(
      startedValue.operations.find(
        (item: { recoveryId: string }) => item.recoveryId === recoveryId,
      ),
      normalOld,
    );
    // 実行要求後のunknownを履歴として保持し、技術終端と次stage許可を混同しない。
    for (let mask = 0; mask < 8; mask += 1) {
      const old = structuredClone(normalOld);
      for (const [index, field] of [
        "providerStart",
        "externalSend",
        "sharedWrite",
      ].entries()) {
        if (mask & (1 << index))
          (old.execution as Record<string, unknown>)[field] = "unknown";
      }
      const before = Buffer.from(
        `${encodeRuntimeStateValue({ ...empty, operations: [old] })}\n`,
      );
      const next = prepareCoordinatorStateOperationSnapshot(
        before,
        nextIdentityJson,
        binding,
      );
      assert.ok(next, `same-owner continuation unknown mask ${mask}`);
      assert.deepEqual(
        JSON.parse(next.toString("utf8")).operations.find(
          (item: { recoveryId: string }) => item.recoveryId === recoveryId,
        ),
        old,
      );
      const foreign = `${JSON.stringify({ ...nextIdentity, operationId: "OP-654321" })}\n`;
      assert.equal(
        prepareCoordinatorStateOperationSnapshot(before, foreign, binding),
        null,
      );
    }
    const failedPrimary = {
      purpose: "create_provider",
      stage: "command_wait",
      reason: "provider_result_invalid",
      exceptionCode: null,
      commandHandleObtained: true,
      responseObserved: true,
      receiptRecorded: false,
    };
    for (const invalidOld of [
      { ...normalOld, phase: "settling" },
      { ...normalOld, lease: "held" },
      {
        ...normalOld,
        execution: { ...normalOld.execution, ownerEffect: "active" },
      },
      { ...normalOld, host: { ...normalOld.host, cleanup: "pending" } },
      { ...normalOld, host: { ...normalOld.host, cleanup: "confirmed" } },
      {
        ...normalOld,
        host: {
          ...normalOld.host,
          pendingTransitionJson: `${JSON.stringify(transition)}\n`,
        },
      },
      {
        ...normalOld,
        host: { ...normalOld.host, currentToken: expectedToken },
      },
      { ...normalOld, primaryFailure: failedPrimary },
      {
        ...normalOld,
        outcome: {
          status: "completed",
          reason: "provider_operation_completed",
          cleanupConfirmed: false,
        },
      },
      {
        ...normalOld,
        dockerRestart: {
          requestId: createDockerRestartRequestId(
            binding,
            identitySha256,
            recoveryId,
            "f".repeat(64),
          ),
          scopeSha256: "f".repeat(64),
          request: "not_issued",
          cleanup: "not_required",
          result: null,
        },
      },
      ...normalOld.resources.map((_, index) => ({
        ...normalOld,
        resources: normalOld.resources.map((resource, selected) =>
          selected === index
            ? { ...resource, request: "intent_saved" }
            : resource,
        ),
      })),
    ]) {
      const before = Buffer.from(
        `${encodeRuntimeStateValue({ ...empty, operations: [invalidOld] })}\n`,
      );
      assert.ok(
        decodeCoordinatorStateSnapshot(before, binding),
        JSON.stringify(invalidOld),
      );
      assert.equal(
        prepareCoordinatorStateOperationSnapshot(
          before,
          nextIdentityJson,
          binding,
        ),
        null,
      );
      const fabricated = {
        ...startedValue,
        previous: {
          revision: empty.revision,
          payloadSha256: createHash("sha256").update(before).digest("hex"),
        },
      };
      assert.equal(
        validateCoordinatorStateTransition(
          before,
          Buffer.from(`${encodeRuntimeStateValue(fabricated)}\n`),
          binding,
        ),
        false,
        "同じ開始版で旧操作を正常形へ変更しない",
      );
    }
    for (const changedIdentity of [
      { ...nextIdentity, operationId: "OP-654321" },
      { ...nextIdentity, recoveryCorrelationId: "other-task-operation" },
      {
        ...nextIdentity,
        hostPaths: { ...identity.hostPaths, root: "other-host-root" },
      },
      {
        ...nextIdentity,
        hostPaths: { ...identity.hostPaths, marker: "other-host-marker" },
      },
      {
        ...nextIdentity,
        initialHostRecovery: {
          ...nextIdentity.initialHostRecovery,
          directoryIdentity: "1:2:5",
        },
      },
    ]) {
      assert.equal(
        prepareCoordinatorStateOperationSnapshot(
          normalBefore,
          `${JSON.stringify(changedIdentity)}\n`,
          binding,
        ),
        null,
      );
    }
    const withObligation = {
      ...empty,
      operations: [normalOld],
      unresolvedRecoveries: [
        {
          operationNonce: nonce,
          recoveryId,
          reason: "provider_result_invalid",
          obligations: ["docker_resources"],
        },
      ],
    };
    const obligationBytes = Buffer.from(
      `${encodeRuntimeStateValue(withObligation)}\n`,
    );
    assert.ok(decodeCoordinatorStateSnapshot(obligationBytes, binding));
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(
        obligationBytes,
        nextIdentityJson,
        binding,
      ),
      null,
    );
    const badCandidate = structuredClone(startedValue);
    badCandidate.operations.find(
      (item: { recoveryId: string }) => item.recoveryId === recoveryId,
    ).execution.providerStart = "started";
    assert.ok(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(badCandidate)}\n`),
        binding,
      ),
    );
    assert.equal(
      validateCoordinatorStateTransition(
        normalBefore,
        Buffer.from(`${encodeRuntimeStateValue(badCandidate)}\n`),
        binding,
      ),
      false,
    );
    const modelSource = fs.readFileSync(
      new URL(
        "../../../../domain-model/src/attempt/validation.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const guardStart = modelSource.indexOf("const sameHostContinuation =");
    const guardEnd = modelSource.indexOf("// 同じ更新内の終端偽装", guardStart);
    assert.ok(guardStart > 0 && guardEnd > guardStart);
    const guard = modelSource.slice(guardStart, guardEnd);
    const guardContext = {
      previousIdentity: identity,
      identity: { ...nextIdentity, operationId: "OP-654321" },
      before: normalOld,
      other: normalOld,
      encodeRuntimeStateValue,
    };
    assert.equal(
      runInNewContext(
        `(() => { ${guard}; return sameHostContinuation; })()`,
        guardContext,
      ),
      false,
    );
    assert.throws(
      () =>
        assert.equal(
          runInNewContext(
            "(() => { const sameHostContinuation = true; return sameHostContinuation; })()",
            guardContext,
          ),
          false,
        ),
      { code: "ERR_ASSERTION" },
    );
    const lifecycleSource = fs.readFileSync(
      new URL("../../../src/execution/recovery.ts", import.meta.url),
      "utf8",
    );
    const completeStart = lifecycleSource.indexOf(
      "function completeProductionRecovery(",
    );
    const checkpointStart = lifecycleSource.indexOf(
      "const saved = checkpointRuntimeOwnedCoordinatorLifecycle(",
      completeStart,
    );
    const checkpointEnd = lifecycleSource.indexOf("\n  if (", checkpointStart);
    assert.ok(
      completeStart > 0 &&
        checkpointStart > completeStart &&
        checkpointEnd > checkpointStart,
    );
    const checkpoint = lifecycleSource.slice(checkpointStart, checkpointEnd);
    const disabled =
      'execution: { ...operation.execution, ownerEffect: "disabled" }';
    assert.equal(checkpoint.split(disabled).length, 2);
    const checkpointContext = {
      managementCapability: {},
      record: { recoveryId },
      operation: {
        ...normalOld,
        execution: { ...normalOld.execution, ownerEffect: "active" },
      },
      checkpointRuntimeOwnedCoordinatorLifecycle: (
        _owner: unknown,
        _id: unknown,
        value: unknown,
      ) => value,
    };
    const checkpointValue = runInNewContext(
      `(() => { ${checkpoint}; return saved; })()`,
      checkpointContext,
    );
    assert.equal(checkpointValue.lease, "released");
    assert.equal(checkpointValue.execution.ownerEffect, "disabled");
    assert.throws(
      () => {
        const changed = checkpoint.replace(
          disabled,
          "execution: operation.execution",
        );
        assert.equal(
          runInNewContext(
            `(() => { ${changed}; return saved; })()`,
            checkpointContext,
          ).execution.ownerEffect,
          "disabled",
        );
      },
      { code: "ERR_ASSERTION" },
    );
  }
  const deliveryOnlyState = {
    ...acceptedCompletionState,
    unresolvedRecoveries: acceptedCompletionState.unresolvedRecoveries.map(
      (value) => ({ ...value, obligations: ["result_delivery"] }),
    ),
    pendingDeliveries: acceptedCompletionState.pendingDeliveries,
  };
  const deliveryOnlyBytes = Buffer.from(
    `${encodeRuntimeStateValue(deliveryOnlyState)}\n`,
  );
  const sameHomeStarted = prepareCoordinatorStateOperationSnapshot(
    deliveryOnlyBytes,
    sameHomeNextIdentity,
    binding,
  );
  assert.ok(
    sameHomeStarted,
    "資源終端後の耐久ACK待ちだけでは同Home開始を妨げない",
  );
  const sameHomeStartedState = JSON.parse(sameHomeStarted.toString("utf8"));
  sameHomeStartedState.unresolvedRecoveries[0].obligations = [
    "docker_resources",
    "result_delivery",
  ];
  assert.equal(
    validateCoordinatorStateTransition(
      deliveryOnlyBytes,
      Buffer.from(`${encodeRuntimeStateValue(sameHomeStartedState)}\n`),
      binding,
    ),
    false,
    "新操作追加と同時に旧操作へ資源義務を戻す候補を拒否する",
  );
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      acceptedCompletionBytes,
      sameHomeNextIdentity,
      binding,
    ),
    null,
    "資源回復義務が残る間は開始しない",
  );
  for (const invalidDeliveries of [
    [],
    acceptedCompletionState.pendingDeliveries.map((delivery) => ({
      ...delivery,
      resultId: "e".repeat(64),
    })),
    acceptedCompletionState.pendingDeliveries.map((delivery) => ({
      ...delivery,
      consumer: "workbench",
    })),
  ]) {
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        Buffer.from(
          `${encodeRuntimeStateValue({ ...acceptedCompletionState, pendingDeliveries: invalidDeliveries })}\n`,
        ),
        recoveryId,
        binding,
      ),
      null,
    );
  }
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(
      acceptedCompletionBytes,
      recoveryId,
      binding,
    ),
    null,
    "Taskを伴わない技術保存だけでは耐久配送を完了しない",
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(
      pendingHistoryBytes,
      recoveryId,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(
      acceptedCompletionBytes,
      "other",
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(
      acceptedCompletionBytes,
      recoveryId,
      "wrong",
    ),
    null,
  );
  for (const change of [
    { phase: "executing" },
    { lease: "unknown" },
    {
      host: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.host,
        cleanup: "unknown",
      },
    },
    {
      execution: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.execution,
        ownerEffect: "active",
      },
    },
    {
      execution: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.execution,
        externalSend: "unknown",
      },
    },
    {
      outcome: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.outcome,
        cleanupConfirmed: false,
      },
    },
  ]) {
    const input = Buffer.from(
      `${encodeRuntimeStateValue({ ...acceptedCompletionState, operations: acceptedCompletionState.operations.map((value) => ({ ...value, ...change })) })}\n`,
    );
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(input, recoveryId, binding),
      null,
    );
  }
  const unaccepted = Buffer.from(
    `${encodeRuntimeStateValue({ ...acceptedCompletionState, pendingDeliveries: acceptedCompletionState.pendingDeliveries.map((value) => ({ ...value, acceptanceSha256: null })) })}\n`,
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(unaccepted, recoveryId, binding),
    null,
  );
  for (const consumer of ["orchestrator"]) {
    const missingAcceptance = Buffer.from(
      `${encodeRuntimeStateValue({ ...acceptedCompletionState, pendingDeliveries: acceptedCompletionState.pendingDeliveries.map((value) => ({ ...value, acceptanceSha256: value.consumer === consumer ? null : "forbidden" })) })}\n`,
    );
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        missingAcceptance,
        recoveryId,
        binding,
      ),
      null,
    );
  }
  assert.equal(
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.history?.lineSha256,
    pendingOperation.history.lineSha256,
  );
  assert.equal(
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.summarySha256,
    pendingOperation.summarySha256,
  );
  assert.equal(
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.history?.confirmed,
    true,
  );
  const historyLine = prepareCoordinatorStateHistoryLine(
    pendingHistoryBytes,
    recoveryId,
    binding,
  );
  assert.ok(historyLine);
  assert.deepEqual(
    projectCoordinatorTaskSettlement(
      {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: false,
      },
      confirmedHistory.snapshot,
    ),
    { cleanupConfirmed: true, recoveryUnresolved: false },
  );
  assert.deepEqual(
    projectCoordinatorTaskSettlement(
      {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: true,
      },
      confirmedHistory.snapshot,
    ),
    { cleanupConfirmed: false, recoveryUnresolved: true },
  );
  const terminalOperation = confirmedHistory.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task",
  );
  assert.ok(terminalOperation);
  assert.ok(terminalOperation.outcome);
  {
    const projectFixture = createCoordinatorState({
      taskExecutionSelections: taskExecutionSelections(),
      projectId: "project-a",
      milestoneId: "milestone-a",
      repositoryRevision: "a".repeat(40),
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["accepted"],
      objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
      tasks: [
        {
          id: "task-a",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["source.txt"],
          conflictKeys: [],
        },
      ],
      ownerGeneration: "owner-a",
    });
    assert.equal(projectFixture.status, "completed");
    if (projectFixture.status !== "completed")
      throw new Error("project_fixture_invalid");
    const initialTask = projectFixture.state.tasks[0];
    assert.ok(initialTask);
    const {
      cleanupConfirmed: _cleanup,
      recoveryUnresolved: _unresolved,
      resultAcceptances: _acceptances,
      ...storedRecord
    } = initialTask;
    const boundTask = {
      ...storedRecord,
      state: "completed",
      attemptId: "attempt-a",
      operationId: identity.recoveryCorrelationId,
      authorityBindingId: "authority-a",
      startPhase: "settled",
      settlement: {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: false,
      },
      resultAcceptanceIds: [],
    };
    const { managedExecutions: _emptyManaged, ...emptyDefinitionFixture } =
      emptyUnifiedSnapshot();
    const unifiedTerminal = {
      ...emptyDefinitionFixture,
      repositoryBindingId: "binding-a",
      intakeEpoch: "epoch-a",
      operations: [terminalOperation],
      projects: [{ ...projectFixture.state, tasks: [boundTask] }],
      pendingDeliveries: [
        {
          operationNonce: nonce,
          recoveryId,
          resultId: terminalOperation.summarySha256,
          consumer: "orchestrator",
        },
      ],
    };
    /**
     * 相関反証の単一状態を正規bytesへ固定する。
     * @responsibility 現行Schemaの値と実codecを使い、旧形を補完しない。
     * @trace PRL-UT-006
     * @precondition 自己生成の純粋状態値。
     * @stimulus 不正相関又は正常値を正規codecへ渡す。
     * @observation 遷移検査へ渡す正規bytes。
     * @oracle 相関不正・旧形式を成功へ畳まない。
     * @cleanup N/A: 局所値のみ。
     * @boundary 保存モデルの純粋試験。物理保存・実行なし。
     */
    const encodeUnified = (value: unknown) =>
      Buffer.from(
        `${encodeRuntimeStateValue(createManagedRuntimeSnapshotFixture(value))}\n`,
      );
    const unifiedBefore = encodeUnified(unifiedTerminal);
    assert.ok(decodeRuntimeDomainSnapshot(unifiedBefore, binding));
    for (const taskUnresolved of [false, true]) {
      const unresolved = {
        ...unifiedTerminal,
        unresolvedRecoveries: [
          {
            operationNonce: nonce,
            recoveryId,
            reason: terminalOperation.outcome.reason,
            obligations: ["result_delivery"],
          },
        ],
        projects: [
          {
            ...projectFixture.state,
            tasks: [
              {
                ...boundTask,
                state: "recovery_required",
                settlement: {
                  ...boundTask.settlement,
                  resultUnresolved: taskUnresolved,
                },
                recoveryObligations: [{ kind: "docker", recoveryId }],
              },
            ],
          },
        ],
      };
      const before = encodeUnified(unresolved);
      const view = decodeRuntimeDomainSnapshot(before, binding)?.projects[0];
      assert.ok(view);
      assert.equal(view.tasks[0]?.recoveryUnresolved, taskUnresolved);
      const candidate = prepareCoordinatorUnifiedTaskSnapshot(
        before,
        { ...view, generation: view.generation + 1 },
        view.generation,
        binding,
      );
      assert.ok(candidate);
      const saved = decodeRuntimeDomainSnapshot(candidate, binding)?.snapshot;
      assert.ok(saved);
      assert.deepEqual(saved.managedExecutions[0]?.tasks[0]?.settlement, {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: taskUnresolved,
      });
      const changedFact = prepareCoordinatorUnifiedTaskSnapshot(
        before,
        {
          ...view,
          generation: view.generation + 1,
          tasks: view.tasks.map((task) => ({
            ...task,
            cleanupConfirmed: taskUnresolved,
            recoveryUnresolved: !taskUnresolved,
          })),
        },
        view.generation,
        binding,
        [
          {
            taskId: "task-a",
            attemptId: "attempt-a",
            operationId: identity.recoveryCorrelationId,
            recoveryUnresolved: !taskUnresolved,
          },
        ],
      );
      assert.ok(changedFact);
      assert.deepEqual(
        decodeRuntimeDomainSnapshot(changedFact, binding)?.snapshot
          .managedExecutions[0]?.tasks[0]?.settlement,
        {
          kind: "operations",
          recoveryIds: [recoveryId],
          resultUnresolved: !taskUnresolved,
        },
      );
      for (const facts of [
        [
          {
            taskId: "other-task",
            attemptId: "attempt-a",
            operationId: identity.recoveryCorrelationId,
            recoveryUnresolved: true,
          },
        ],
        [
          {
            taskId: "task-a",
            attemptId: "other-attempt",
            operationId: identity.recoveryCorrelationId,
            recoveryUnresolved: true,
          },
        ],
        [
          {
            taskId: "task-a",
            attemptId: "attempt-a",
            operationId: "other-operation",
            recoveryUnresolved: true,
          },
        ],
      ])
        assert.equal(
          prepareCoordinatorUnifiedTaskSnapshot(
            before,
            { ...view, generation: view.generation + 1 },
            view.generation,
            binding,
            facts,
          ),
          null,
        );
      const resolved = decodeRuntimeDomainSnapshot(
        encodeUnified({ ...saved, unresolvedRecoveries: [] }),
        binding,
      );
      assert.ok(resolved);
      assert.equal(
        resolved.projects[0]?.tasks[0]?.recoveryUnresolved,
        taskUnresolved,
      );
    }
    const receipt = {
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: identity.recoveryCorrelationId,
      recoveryId,
      settlementGeneration: 2,
      repositoryBinding: binding,
      resultId: terminalOperation.summarySha256,
      consumer: "orchestrator",
    };
    {
      const secondIdentity = {
        ...identity,
        operationNonce: "d".repeat(64),
        operationId: "OP-654321",
        stableLogicalHomeBindingHash: "e".repeat(64),
        ownershipLabel: "crdd.coordinator.runtime=fedcba9876543210",
        resources: Object.fromEntries(
          Object.entries(identity.resources).map(([key, value]) => [
            key,
            value.replace("0123456789abcdef", "fedcba9876543210"),
          ]),
        ),
      };
      const recoveryRoot = {
        ...unifiedTerminal,
        projects: [
          {
            ...projectFixture.state,
            tasks: [
              {
                ...boundTask,
                state: "recovery_required",
                recoveryObligations: [{ kind: "docker", recoveryId }],
              },
            ],
          },
        ],
      };
      const registered = prepareCoordinatorStateOperationSnapshot(
        encodeUnified(recoveryRoot),
        `${JSON.stringify(secondIdentity)}\n`,
        binding,
      );
      assert.ok(registered);
      const physical = JSON.parse(registered.toString());
      const second = physical.operations.find(
        (item: { identityJson: string }) =>
          JSON.parse(item.identityJson).operationId ===
          secondIdentity.operationId,
      );
      assert.ok(second);
      second.phase = "settling";
      second.host.cleanup = "confirmed";
      second.lease = "released";
      second.execution = terminalOperation.execution;
      second.outcome = terminalOperation.outcome;
      physical.managedExecutions[0].tasks[0].recoveryObligations.push({
        kind: "docker",
        recoveryId: second.recoveryId,
      });
      let multi: Buffer = encodeUnified(physical);
      for (const confirmed of [false, true]) {
        const checkpoint = prepareCoordinatorStateHistorySnapshot(
          multi,
          second.recoveryId,
          occurredAt,
          confirmed,
          binding,
        );
        assert.ok(checkpoint);
        multi = checkpoint;
      }
      const delivered = prepareCoordinatorStateResultDeliverySnapshot(
        multi,
        second.recoveryId,
        ["orchestrator"],
        binding,
      );
      assert.ok(delivered);
      multi = delivered;
      for (const id of [recoveryId, second.recoveryId]) {
        const decoded = decodeRuntimeDomainSnapshot(multi, binding);
        const view = decoded?.projects[0];
        assert.ok(decoded && view);
        const operation = decoded.snapshot.operations.find(
          (item) => item.recoveryId === id,
        );
        assert.ok(operation?.kind === "docker_task");
        const acceptance = {
          ...receipt,
          recoveryId: id,
          resultId: operation.summarySha256,
          settlementGeneration: view.generation + 1,
        };
        const proposed = {
          ...view,
          generation: view.generation + 1,
          tasks: view.tasks.map((task) => ({
            ...task,
            recoveryObligations: task.recoveryObligations.map((item) =>
              item.recoveryId === id
                ? {
                    ...item,
                    phase: "acknowledged",
                    acknowledgement: acceptance,
                  }
                : item,
            ),
          })),
        };
        const next = prepareCoordinatorUnifiedTaskSnapshot(
          multi,
          proposed,
          view.generation,
          binding,
        );
        assert.ok(next, "二つの回復を同じTaskで一件ずつ耐久受領できる");
        const saved = JSON.parse(next.toString());
        const stored = saved.managedExecutions[0].tasks[0];
        assert.equal(saved.operations.length, id === recoveryId ? 1 : 0);
        assert.equal(
          stored.settlement.kind,
          id === recoveryId ? "operations" : "executor_result",
        );
        assert.equal(saved.resultReceipts.length, id === recoveryId ? 1 : 2);
        for (const mutate of [
          (value: typeof saved) => {
            value.resultReceipts = [];
          },
          (value: typeof saved) => {
            value.pendingDeliveries = decoded.snapshot.pendingDeliveries;
          },
          (value: typeof saved) => {
            value.managedExecutions[0].tasks[0].attemptId = "other-attempt";
          },
          (value: typeof saved) => {
            const fact = value.managedExecutions[0].tasks[0].settlement;
            if (fact.kind === "operations") fact.resultUnresolved = true;
            else fact.recoveryUnresolved = true;
          },
        ]) {
          const invalid = structuredClone(saved);
          mutate(invalid);
          assert.equal(
            validateCoordinatorUnifiedTransition(
              multi,
              encodeUnified(invalid),
              binding,
            ),
            false,
          );
        }
        if (id === recoveryId) {
          const premature = structuredClone(saved);
          premature.managedExecutions[0].tasks[0].settlement = {
            kind: "executor_result",
            cleanupConfirmed: true,
            recoveryUnresolved: false,
          };
          assert.equal(
            validateCoordinatorUnifiedTransition(
              multi,
              encodeUnified(premature),
              binding,
            ),
            false,
            "未受領のOperationが残る間は技術参照なし終端へ移れない",
          );
          for (const references of [
            [],
            [recoveryId],
            [recoveryId, second.recoveryId],
          ]) {
            const invalid = structuredClone(saved);
            invalid.managedExecutions[0].tasks[0].settlement.recoveryIds =
              references;
            assert.equal(
              validateCoordinatorUnifiedTransition(
                multi,
                encodeUnified(invalid),
                binding,
              ),
              false,
            );
          }
        }
        multi = next;
      }
      const receipts = decodeRuntimeDomainSnapshot(multi, binding)?.snapshot
        .resultReceipts;
      assert.equal(
        receipts?.find((item) => item.recoveryId === recoveryId)
          ?.settlementGeneration,
        2,
      );
    }
    const acceptedUnified = {
      ...unifiedTerminal,
      revision: 2,
      previous: {
        revision: 1,
        payloadSha256: createHash("sha256").update(unifiedBefore).digest("hex"),
      },
      operations: [],
      pendingDeliveries: [],
      resultReceipts: [receipt],
      projects: [
        {
          ...projectFixture.state,
          generation: 2,
          tasks: [
            {
              ...boundTask,
              settlement: {
                kind: "executor_result",
                cleanupConfirmed: true,
                recoveryUnresolved: false,
              },
              resultAcceptanceIds: [recoveryId],
            },
          ],
        },
      ],
    };
    assert.ok(
      decodeRuntimeDomainSnapshot(encodeUnified(acceptedUnified), binding),
    );
    const acceptedState = decodeRuntimeDomainSnapshot(
      encodeUnified(acceptedUnified),
      binding,
    )?.projects[0];
    assert.ok(acceptedState);
    const taskPublication = prepareCoordinatorUnifiedTaskSnapshot(
      unifiedBefore,
      acceptedState,
      1,
      binding,
    );
    assert.ok(taskPublication);
    assert.ok(taskPublication.equals(encodeUnified(acceptedUnified)));
    const requiredLine = prepareCoordinatorStateHistoryLine(
      unifiedBefore,
      recoveryId,
      binding,
    );
    assert.ok(requiredLine);
    const afterRetentionPeriod = "2027-01-01T00:00:00.000Z";
    assert.deepEqual(
      prepareCoordinatorHistoryRetention(
        unifiedBefore,
        requiredLine,
        afterRetentionPeriod,
        30,
        binding,
      ),
      requiredLine,
      "確認済みでも未受領の結果に必要な履歴を期限整理しない",
    );
    assert.equal(
      prepareCoordinatorHistoryRetention(
        unifiedBefore,
        Buffer.alloc(0),
        afterRetentionPeriod,
        30,
        binding,
      ),
      null,
    );
    assert.deepEqual(
      prepareCoordinatorHistoryRetention(
        taskPublication,
        requiredLine,
        afterRetentionPeriod,
        30,
        binding,
      ),
      Buffer.alloc(0),
      "受領・操作除去後は通常の期限整理へ戻す",
    );
    const acceptedDecoded = decodeRuntimeDomainSnapshot(
      taskPublication,
      binding,
    );
    assert.ok(acceptedDecoded);
    const receiptRetained = prepareCoordinatorUnifiedTaskSnapshot(
      taskPublication,
      { ...acceptedState, generation: 3 },
      2,
      binding,
    );
    assert.ok(receiptRetained);
    assert.deepEqual(
      decodeRuntimeDomainSnapshot(receiptRetained, binding)?.snapshot
        .resultReceipts,
      acceptedDecoded.snapshot.resultReceipts,
    );
    assert.equal(
      validateCoordinatorUnifiedTransition(
        unifiedBefore,
        encodeUnified(acceptedUnified),
        binding,
      ),
      true,
    );
    const unbound = {
      ...unifiedTerminal,
      projects: [
        {
          ...projectFixture.state,
          tasks: [
            {
              ...storedRecord,
              settlement: { kind: "pending" },
              resultAcceptanceIds: [],
            },
          ],
        },
      ],
    };
    const unboundBytes = encodeUnified(unbound);
    assert.ok(decodeRuntimeDomainSnapshot(unboundBytes, binding));
    const wrongLogicalReceipt = {
      ...acceptedUnified,
      previous: {
        revision: 1,
        payloadSha256: createHash("sha256").update(unboundBytes).digest("hex"),
      },
      resultReceipts: [
        { ...receipt, operationId: "another-logical-operation" },
      ],
      projects: [
        {
          ...acceptedUnified.projects[0],
          tasks: [
            {
              ...acceptedUnified.projects[0]?.tasks[0],
              operationId: "another-logical-operation",
            },
          ],
        },
      ],
    };
    assert.ok(
      decodeRuntimeDomainSnapshot(encodeUnified(wrongLogicalReceipt), binding),
    );
    assert.equal(
      validateCoordinatorUnifiedTransition(
        unboundBytes,
        encodeUnified(wrongLogicalReceipt),
        binding,
      ),
      false,
    );
    for (const invalid of [
      { ...acceptedUnified, projects: unifiedTerminal.projects },
      { ...acceptedUnified, operations: unifiedTerminal.operations },
      {
        ...acceptedUnified,
        pendingDeliveries: unifiedTerminal.pendingDeliveries,
      },
      { ...acceptedUnified, resultReceipts: [] },
    ])
      assert.equal(
        validateCoordinatorUnifiedTransition(
          unifiedBefore,
          encodeUnified(invalid),
          binding,
        ),
        false,
      );
    const secondIdentityJson = `${JSON.stringify({ ...identity, operationNonce: "f".repeat(64), operationId: "OP-234567" })}\n`;
    const secondBytes = prepareCoordinatorStateOperationSnapshot(
      null,
      secondIdentityJson,
      binding,
    );
    assert.ok(secondBytes);
    const second = decodeCoordinatorStateSnapshot(secondBytes, binding)
      ?.snapshot.operations[0];
    assert.ok(second);
    const withSecond = {
      ...unifiedTerminal,
      operations: [terminalOperation, second],
      projects: [
        {
          ...projectFixture.state,
          tasks: [
            {
              ...boundTask,
              state: "recovery_required",
              settlement: {
                kind: "operations",
                recoveryIds: [recoveryId, second.recoveryId],
                resultUnresolved: true,
              },
              recoveryObligations: [
                { kind: "docker", recoveryId: second.recoveryId },
              ],
            },
          ],
        },
      ],
    };
    assert.equal(
      decodeRuntimeDomainSnapshot(encodeUnified(withSecond), binding)
        ?.projects[0]?.tasks[0]?.recoveryObligations[0]?.phase,
      "required",
    );
    assert.equal(
      decodeRuntimeDomainSnapshot(
        encodeUnified({
          ...withSecond,
          projects: [
            {
              ...withSecond.projects[0],
              tasks: [
                {
                  ...withSecond.projects[0]?.tasks[0],
                  settlement: {
                    kind: "operations",
                    recoveryIds: [recoveryId],
                    resultUnresolved: true,
                  },
                },
              ],
            },
          ],
        }),
        binding,
      ),
      null,
    );
    for (const phase of ["settled", "acknowledged", "required"])
      assert.equal(
        decodeRuntimeDomainSnapshot(
          encodeUnified({
            ...withSecond,
            projects: [
              {
                ...withSecond.projects[0],
                tasks: [
                  {
                    ...withSecond.projects[0]?.tasks[0],
                    recoveryObligations: [
                      { kind: "docker", recoveryId: second.recoveryId, phase },
                    ],
                  },
                ],
              },
            ],
          }),
          binding,
        ),
        null,
      );
  }
  const operationFact = {
    kind: "operations",
    recoveryIds: [recoveryId],
    resultUnresolved: false,
  };
  for (const change of [
    { phase: "executing" },
    { outcome: null },
    { outcome: { ...terminalOperation.outcome, cleanupConfirmed: false } },
    { host: { ...terminalOperation.host, cleanup: "unknown" } },
    {
      host: {
        ...terminalOperation.host,
        pendingTransitionJson: `${JSON.stringify(transition)}\n`,
      },
    },
    { lease: "unknown" },
    { execution: { ...terminalOperation.execution, ownerEffect: "unknown" } },
    {
      dockerRestart: {
        requestId: limitedRestartId,
        scopeSha256: "f".repeat(64),
        request: "issued",
        cleanup: "unknown",
        result: null,
      },
    },
    {
      resources: terminalOperation.resources.map((resource) =>
        resource.purpose === "create_provider"
          ? { ...resource, request: "unknown" }
          : resource,
      ),
    },
  ] satisfies readonly Partial<CoordinatorStateTaskOperation>[]) {
    assert.deepEqual(
      projectCoordinatorTaskSettlement(operationFact, {
        ...confirmedHistory.snapshot,
        operations: [{ ...terminalOperation, ...change }],
      }),
      { cleanupConfirmed: false, recoveryUnresolved: false },
      JSON.stringify(change),
    );
  }
  for (const id of [recoveryId, "unrelated-recovery"] as const) {
    assert.deepEqual(
      projectCoordinatorTaskSettlement(operationFact, {
        ...confirmedHistory.snapshot,
        unresolvedRecoveries: [
          {
            operationNonce: nonce,
            recoveryId: id,
            reason: "provider_operation_completed",
            obligations: ["result_delivery"],
          },
        ],
      }),
      { cleanupConfirmed: true, recoveryUnresolved: false },
    );
  }
  const goldenTaskLine = `{"occurredAt":"2026-10-08T00:00:00.000Z","schema":"crdd-coordinator/history-row/v2","summary":{"execution":{"externalSend":"unknown","ownerEffect":"disabled","providerStart":"unknown","sharedWrite":"unknown","workspaceReusable":false},"hostCleanup":"confirmed","identitySha256":"${identitySha256}","lease":"released","operationId":"OP-123456","operationNonce":"${nonce}","outcome":{"cleanupConfirmed":true,"reason":"provider_operation_completed","status":"completed"},"primaryFailure":null,"recoveryId":"${recoveryId}","schema":"crdd-coordinator/operation-summary/v2"}}\n`;
  assert.equal(historyLine.toString("utf8"), goldenTaskLine);
  assert.equal(
    createHash("sha256").update(historyLine).digest("hex"),
    createHash("sha256").update(goldenTaskLine).digest("hex"),
  );
  const rows = decodeCoordinatorHistoryRows(historyLine);
  assert.ok(rows);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.recoveryId, recoveryId);
  assert.equal(rows[0]?.lineSha256, pendingOperation.history.lineSha256);
  assert.equal(rows[0]?.summarySha256, pendingOperation.summarySha256);
  const restartHistoryCheckpoint = {
    requestId: createDockerRestartRequestId(
      binding,
      identitySha256,
      recoveryId,
      "f".repeat(64),
    ),
    scopeSha256: "f".repeat(64),
    request: "issued",
    cleanup: "confirmed",
    result: {
      status: "blocked",
      reason: "docker_restart_start_unconfirmed",
      request: "issued",
      effectOutcomeUnknown: false,
    },
  };
  const restartHistoryRow = JSON.parse(goldenTaskLine);
  restartHistoryRow.summary.schema = "crdd-coordinator/operation-summary/v3";
  restartHistoryRow.summary.dockerRestart = restartHistoryCheckpoint;
  const restartHistoryLine = Buffer.from(
    `${encodeRuntimeStateValue(restartHistoryRow)}\n`,
  );
  const restartHistoryRows = decodeCoordinatorHistoryRows(restartHistoryLine);
  assert.ok(restartHistoryRows);
  const v4Restart = structuredClone(restartHistoryRow);
  v4Restart.summary.schema = "crdd-coordinator/operation-summary/v4";
  v4Restart.summary.consumer = "workbench";
  v4Restart.summary.recoveryCorrelationId = "operation-a";
  assert.ok(
    decodeCoordinatorHistoryRows(
      Buffer.from(`${encodeRuntimeStateValue(v4Restart)}\n`),
    ),
  );
  for (const checkpoint of [
    null,
    { ...restartHistoryCheckpoint, cleanup: "unknown" },
    { unexpected: true },
  ]) {
    const invalid = structuredClone(v4Restart);
    invalid.summary.dockerRestart = checkpoint;
    assert.equal(
      decodeCoordinatorHistoryRows(
        Buffer.from(`${encodeRuntimeStateValue(invalid)}\n`),
      ),
      null,
    );
  }
  assert.notEqual(restartHistoryRows[0]?.summarySha256, rows[0]?.summarySha256);
  assert.equal(
    prepareCoordinatorRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      restartHistoryLine,
      null,
      30,
      binding,
    ),
    null,
    "固定済みv2結果へv3履歴を再結合しない",
  );
  for (const checkpoint of [
    null,
    { ...restartHistoryCheckpoint, result: null },
    { ...restartHistoryCheckpoint, cleanup: "unknown" },
    { ...restartHistoryCheckpoint, request: "unknown" },
    {
      ...restartHistoryCheckpoint,
      result: {
        ...restartHistoryCheckpoint.result,
        effectOutcomeUnknown: true,
      },
    },
    {
      ...restartHistoryCheckpoint,
      result: { ...restartHistoryCheckpoint.result, status: "completed" },
    },
  ]) {
    const row = structuredClone(restartHistoryRow);
    row.summary.dockerRestart = checkpoint;
    assert.equal(
      decodeCoordinatorHistoryRows(
        Buffer.from(`${encodeRuntimeStateValue(row)}\n`),
      ),
      null,
    );
  }
  for (const mutation of ["missing", "v2", "extra"]) {
    const row = structuredClone(restartHistoryRow);
    if (mutation === "missing") delete row.summary.dockerRestart;
    else if (mutation === "v2")
      row.summary.schema = "crdd-coordinator/operation-summary/v2";
    else row.summary.extra = true;
    assert.equal(
      decodeCoordinatorHistoryRows(
        Buffer.from(`${encodeRuntimeStateValue(row)}\n`),
      ),
      null,
    );
  }
  for (const [canonical, pending, changed] of [
    [Buffer.alloc(0), null, true],
    [Buffer.alloc(0), historyLine, true],
    [historyLine, null, false],
    [historyLine, historyLine, false],
  ] as const) {
    const publication = prepareCoordinatorRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      canonical,
      pending,
      30,
      binding,
    );
    assert.ok(publication);
    assert.deepEqual(publication.historyBytes, historyLine);
    assert.deepEqual(publication.snapshotBytes, confirmedHistoryBytes);
    assert.equal(publication.historyChanged, changed);
    assert.deepEqual(
      prepareCoordinatorRecoveredHistoryPublication(
        pendingHistoryBytes,
        recoveryId,
        canonical,
        pending,
        30,
        binding,
      ),
      publication,
    );
  }
  const currentRow = JSON.parse(historyLine.toString());
  let bufferEvaluations = 0;
  for (const role of ["canonical", "pending"] as const) {
    for (const behavior of ["true", "false", "throw", "getter"] as const) {
      const hostile: Buffer =
        role === "canonical" ? Buffer.alloc(0) : Buffer.from(historyLine);
      const originalView: Uint8Array = new Uint8Array(
        hostile.buffer,
        hostile.byteOffset,
        hostile.byteLength,
      );
      const originalBytes: number[] = Array.from(originalView);
      for (const property of [
        "buffer",
        "byteOffset",
        "byteLength",
        "length",
        Symbol.iterator,
      ])
        Object.defineProperty(hostile, property, {
          configurable: true,
          get() {
            bufferEvaluations++;
            throw new Error("not_evaluated");
          },
        });
      Object.defineProperty(
        hostile,
        "equals",
        behavior === "getter"
          ? {
              configurable: true,
              get() {
                bufferEvaluations++;
                throw new Error("not_evaluated");
              },
            }
          : {
              configurable: true,
              value() {
                bufferEvaluations++;
                if (behavior === "throw") throw new Error("not_evaluated");
                return behavior === "true";
              },
            },
      );
      const descriptors: PropertyDescriptorMap =
        Object.getOwnPropertyDescriptors(hostile);
      const result = prepareCoordinatorRecoveredHistoryPublication(
        pendingHistoryBytes,
        recoveryId,
        role === "canonical" ? hostile : Buffer.alloc(0),
        role === "pending" ? hostile : null,
        30,
        binding,
      );
      assert.ok(result);
      assert.deepEqual(result.historyBytes, historyLine);
      assert.deepEqual(Array.from(originalView), originalBytes);
      assert.deepEqual(Object.getOwnPropertyDescriptors(hostile), descriptors);
    }
  }
  const falsePending = Buffer.from("different\n");
  Object.defineProperty(falsePending, "equals", {
    value() {
      bufferEvaluations++;
      return true;
    },
  });
  assert.equal(
    prepareCoordinatorRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      Buffer.alloc(0),
      falsePending,
      30,
      binding,
    ),
    null,
  );
  const proxyBuffer = new Proxy(Buffer.from(historyLine), {
    get() {
      bufferEvaluations++;
      throw new Error("not_evaluated");
    },
    getPrototypeOf() {
      bufferEvaluations++;
      throw new Error("not_evaluated");
    },
  });
  for (const [canonical, pending] of [
    [proxyBuffer, null],
    [Buffer.alloc(0), proxyBuffer],
    [Buffer.alloc(RUNTIME_STATE_MAXIMUM_BYTES + 1), null],
    [Buffer.alloc(0), Buffer.alloc(RUNTIME_STATE_MAXIMUM_BYTES + 1)],
  ])
    assert.equal(
      prepareCoordinatorRecoveredHistoryPublication(
        pendingHistoryBytes,
        recoveryId,
        canonical,
        pending,
        30,
        binding,
      ),
      null,
    );
  assert.equal(bufferEvaluations, 0);
  const priorNonce = "7".repeat(64);
  const priorRow = {
    ...currentRow,
    occurredAt: new Date(Date.parse(occurredAt) - 31 * 86400000).toISOString(),
    summary: {
      ...currentRow.summary,
      operationNonce: priorNonce,
      recoveryId: `docker-task.${identity.stableLogicalHomeBindingHash}.${priorNonce}.${identitySha256}`,
      operationId: "OP-999999",
    },
  };
  const priorLine = Buffer.from(`${encodeRuntimeStateValue(priorRow)}\n`);
  assert.ok(decodeCoordinatorHistoryRows(priorLine));
  const retainedPublication = prepareCoordinatorRecoveredHistoryPublication(
    pendingHistoryBytes,
    recoveryId,
    priorLine,
    historyLine,
    30,
    binding,
  );
  assert.ok(retainedPublication);
  assert.deepEqual(retainedPublication.historyBytes, historyLine);
  assert.equal(
    prepareCoordinatorRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      priorLine,
      historyLine,
      60,
      binding,
    ),
    null,
  );
  for (const [bytes, id, canonical, pending, days, root] of [
    [historyBytes, recoveryId, Buffer.alloc(0), null, 30, binding],
    [confirmedHistoryBytes, recoveryId, historyLine, null, 30, binding],
    [pendingHistoryBytes, "different", Buffer.alloc(0), null, 30, binding],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), null, 30, "wrong-root"],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), null, 0, binding],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.concat([historyLine, historyLine]),
      null,
      30,
      binding,
    ],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.from("invalid\n"),
      null,
      30,
      binding,
    ],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.alloc(0),
      Buffer.alloc(0),
      30,
      binding,
    ],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.alloc(0),
      Buffer.concat([historyLine, priorLine]),
      30,
      binding,
    ],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), undefined, 30, binding],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), "pending", 30, binding],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.from(
        `${encodeRuntimeStateValue({ ...currentRow, occurredAt: new Date(Date.parse(occurredAt) + 1).toISOString() })}\n`,
      ),
      null,
      30,
      binding,
    ],
  ])
    assert.equal(
      prepareCoordinatorRecoveredHistoryPublication(
        bytes,
        id,
        canonical,
        pending,
        days,
        root,
      ),
      null,
    );
  assert.deepEqual(decodeCoordinatorHistoryRows(Buffer.alloc(0)), []);
  /**
   * 固定Repository結合で履歴保持候補を評価する。
   * @responsibility 期間と未確認相関の反例を同じモデル入口へ渡す。
   * @trace PRL-UT-006
   * @input bytes: Snapshot、history: 履歴、now: 判定時刻、days: 保持日数。
   * @returns 履歴候補またはnull。
   * @precondition Fixtureは各assertionで固定する。
   * @postcondition 入力本文を変更しない。
   * @effect N/A: メモリ内の評価だけ。
   * @failure 不正値はモデルのnullを返す。
   * @invariant 保存I/Oの成功を主張しない。
   * @boundary PRL-UT-006=履歴保持の値契約。
   * @security N/A: 固定非秘密Fixtureだけを利用する。
   * @concurrency N/A: 同期評価だけ。
   */
  const retain = (
    bytes: Buffer,
    history: Buffer,
    now: unknown,
    days: unknown,
  ) => prepareCoordinatorHistoryRetention(bytes, history, now, days, binding);
  const exactCutoff = new Date(
    Date.parse(occurredAt) + 30 * 86400000,
  ).toISOString();
  const afterCutoff = new Date(Date.parse(exactCutoff) + 1).toISOString();
  assert.deepEqual(
    retain(confirmedHistoryBytes, historyLine, exactCutoff, 30),
    historyLine,
  );
  assert.deepEqual(
    retain(confirmedHistoryBytes, historyLine, afterCutoff, 30),
    Buffer.alloc(0),
  );
  assert.deepEqual(
    retain(pendingHistoryBytes, historyLine, afterCutoff, 30),
    historyLine,
  );
  assert.deepEqual(
    retain(confirmedHistoryBytes, Buffer.alloc(0), afterCutoff, 30),
    Buffer.alloc(0),
  );
  assert.equal(
    retain(pendingHistoryBytes, Buffer.alloc(0), afterCutoff, 30),
    null,
  );
  assert.deepEqual(
    retain(confirmedHistoryBytes, historyLine, afterCutoff, 31),
    historyLine,
  );
  for (const days of [0, -1, 1.5, NaN, Infinity, 104249992, "30"])
    assert.equal(
      retain(confirmedHistoryBytes, historyLine, afterCutoff, days),
      null,
    );
  assert.equal(retain(confirmedHistoryBytes, historyLine, "invalid", 30), null);
  const row = JSON.parse(historyLine.toString("utf8"));
  for (const malformed of [
    historyLine.subarray(0, -1),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), historyLine]),
    Buffer.from([0xff, 0x0a]),
    Buffer.concat([historyLine, historyLine]),
    Buffer.from(historyLine.toString("utf8").replace(/\n$/u, "\r\n")),
    Buffer.from(` ${historyLine.toString("utf8")}`),
    Buffer.from(`${encodeRuntimeStateValue({ ...row, extra: true })}\n`),
    Buffer.from(
      `${encodeRuntimeStateValue({ ...row, occurredAt: "invalid" })}\n`,
    ),
    Buffer.from(
      `${encodeRuntimeStateValue({ ...row, summary: { ...row.summary, operationNonce: "0".repeat(64) } })}\n`,
    ),
    Buffer.from(
      `${encodeRuntimeStateValue({ ...row, summary: { ...row.summary, outcome: { ...row.summary.outcome, cleanupConfirmed: false } } })}\n`,
    ),
    Buffer.from(
      `${encodeRuntimeStateValue({ ...row, summary: { ...row.summary, primaryFailure: { stage: "unknown" } } })}\n`,
    ),
  ]) {
    assert.equal(decodeCoordinatorHistoryRows(malformed), null);
    assert.equal(
      retain(confirmedHistoryBytes, malformed, afterCutoff, 30),
      null,
    );
  }
  const differentLine = Buffer.from(
    `${encodeRuntimeStateValue({ ...row, occurredAt: afterCutoff })}\n`,
  );
  assert.ok(decodeCoordinatorHistoryRows(differentLine));
  assert.equal(
    retain(pendingHistoryBytes, differentLine, afterCutoff, 30),
    null,
  );
  assert.equal(
    retain(confirmedHistoryBytes, differentLine, afterCutoff, 30),
    null,
  );
  assert.equal(
    createHash("sha256").update(historyLine).digest("hex"),
    pendingOperation.history.lineSha256,
  );
  assert.deepEqual(
    prepareCoordinatorStateHistoryLine(
      confirmedHistoryBytes,
      recoveryId,
      binding,
    ),
    historyLine,
  );
  for (const [bytes, id, root] of [
    [historyBytes, recoveryId, binding],
    [pendingHistoryBytes, "other-recovery", binding],
    [pendingHistoryBytes, recoveryId, "wrong-root"],
  ]) {
    assert.equal(prepareCoordinatorStateHistoryLine(bytes, id, root), null);
  }
  for (const [date, confirmed] of [
    ["2026-10-09T00:00:00.000Z", true],
    [occurredAt, false],
    ["2026-10-08", true],
    ["invalid", true],
  ] as const)
    assert.equal(
      prepareCoordinatorStateHistorySnapshot(
        confirmedHistoryBytes,
        recoveryId,
        date,
        confirmed,
        binding,
      ),
      null,
    );
  for (const changed of [
    { ...pendingOperation, history: null },
    { ...pendingOperation, summarySha256: null },
    {
      ...pendingOperation,
      history: { ...pendingOperation.history, lineSha256: "f".repeat(64) },
    },
    {
      ...pendingOperation,
      history: { ...pendingOperation.history, confirmed: "true" },
    },
    {
      ...pendingOperation,
      history: { ...pendingOperation.history, extra: true },
    },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(
          `${encodeRuntimeStateValue({ ...pendingHistory.snapshot, operations: [changed] })}\n`,
        ),
        binding,
      ),
      null,
    );
  assert.deepEqual(
    historyBytes,
    Buffer.from(`${encodeRuntimeStateValue(historyState)}\n`),
  );
  const prepared = prepareCoordinatorStateOperationSnapshot(
    null,
    identityJson,
    binding,
  );
  assert.ok(prepared);
  const restartScope = "e".repeat(64);
  const restartRequest = {
    requestId: createDockerRestartRequestId(
      binding,
      identitySha256,
      recoveryId,
      restartScope,
    ),
    scopeSha256: restartScope,
    request: "not_issued",
    cleanup: "not_required",
    result: null,
  };
  const restartInitial = prepareCoordinatorStateRestartSnapshot(
    prepared,
    recoveryId,
    restartRequest,
    binding,
  );
  assert.ok(restartInitial);
  const restartSnapshot = decodeCoordinatorStateSnapshot(
    restartInitial,
    binding,
  );
  assert.ok(restartSnapshot);
  const beforeRestart = decodeCoordinatorStateSnapshot(prepared, binding);
  assert.ok(beforeRestart);
  assert.deepEqual(
    restartSnapshot.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    ),
    {
      ...beforeRestart.snapshot.operations.find(
        (item) => item.kind === "docker_task",
      ),
      dockerRestart: restartRequest,
    },
  );
  assert.deepEqual(restartSnapshot.snapshot.previous, {
    revision: beforeRestart.snapshot.revision,
    payloadSha256: beforeRestart.payloadSha256,
  });
  for (const purpose of beforeRestart.snapshot.operations
    .find((item) => item.kind === "docker_task")
    ?.resources.map((item) => item.purpose) ?? []) {
    for (const [from, to] of [
      ["not_requested", "intent_saved"],
      ["intent_saved", "issued"],
      ["intent_saved", "unknown"],
      ["issued", "unknown"],
      ["unknown", "issued"],
    ] as const) {
      const baseSnapshot: CoordinatorStateSnapshot = {
        ...beforeRestart.snapshot,
        operations: beforeRestart.snapshot.operations
          .filter((item) => item.kind === "docker_task")
          .map((item) => ({
            ...item,
            resources: item.resources.map((resource) =>
              resource.purpose === purpose
                ? { ...resource, request: from }
                : resource,
            ),
          })),
      };
      const baseBytes = Buffer.from(
        `${encodeRuntimeStateValue(baseSnapshot)}\n`,
      );
      assert.ok(decodeCoordinatorStateSnapshot(baseBytes, binding));
      const original = baseSnapshot.operations
        .find((item) => item.kind === "docker_task")
        ?.resources.find((item) => item.purpose === purpose);
      assert.ok(original);
      const progressed = prepareCoordinatorStateResourceSnapshot(
        baseBytes,
        recoveryId,
        { ...original, request: to },
        binding,
      );
      assert.ok(progressed, `${purpose}:${from}:${to}:before_restart`);
      const initialized = prepareCoordinatorStateRestartSnapshot(
        baseBytes,
        recoveryId,
        restartRequest,
        binding,
      );
      assert.ok(initialized);
      assert.equal(
        prepareCoordinatorStateResourceSnapshot(
          initialized,
          recoveryId,
          { ...original, request: to },
          binding,
        ),
        null,
        `${purpose}:${from}:${to}:after_restart`,
      );

      const simultaneous = decodeCoordinatorStateSnapshot(progressed, binding);
      assert.ok(simultaneous);
      const simultaneousBytes = Buffer.from(
        `${encodeRuntimeStateValue({
          ...simultaneous.snapshot,
          operations: simultaneous.snapshot.operations
            .filter((item) => item.kind === "docker_task")
            .map((item) => ({
              ...item,
              dockerRestart: restartRequest,
            })),
        })}\n`,
      );
      assert.ok(decodeCoordinatorStateSnapshot(simultaneousBytes, binding));
      assert.equal(
        validateCoordinatorStateTransition(
          baseBytes,
          simultaneousBytes,
          binding,
        ),
        false,
        `${purpose}:${from}:${to}:simultaneous`,
      );
    }

    const pending = {
      ...beforeRestart.snapshot,
      operations: beforeRestart.snapshot.operations
        .filter((item) => item.kind === "docker_task")
        .map((item) => ({
          ...item,
          resources: item.resources.map((resource) =>
            resource.purpose === purpose
              ? { ...resource, request: "intent_saved" }
              : resource,
          ),
        })),
    };
    const pendingBytes = Buffer.from(`${encodeRuntimeStateValue(pending)}\n`);
    const pendingResource = pending.operations
      .find((item) => item.kind === "docker_task")
      ?.resources.find((item) => item.purpose === purpose);
    assert.ok(pendingResource);
    const normalized = prepareCoordinatorStateResourceSnapshot(
      pendingBytes,
      recoveryId,
      { ...pendingResource, request: "unknown" },
      binding,
    );
    assert.ok(normalized);
    const initialized = prepareCoordinatorStateRestartSnapshot(
      normalized,
      recoveryId,
      restartRequest,
      binding,
    );
    assert.ok(initialized);
    assert.ok(
      prepareCoordinatorStateResourceSnapshot(
        initialized,
        recoveryId,
        { ...pendingResource, request: "unknown" },
        binding,
      ),
      `${purpose}:same_request`,
    );
    const identified = prepareCoordinatorStateResourceSnapshot(
      initialized,
      recoveryId,
      {
        ...pendingResource,
        request: "identified",
        dockerId: "d".repeat(64),
        receiptSource: "runtime_reconciliation",
        observation: "present",
      },
      binding,
    );
    assert.ok(identified, `${purpose}:unknown_to_identified`);
    const identifiedSnapshot = decodeCoordinatorStateSnapshot(
      identified,
      binding,
    );
    assert.ok(identifiedSnapshot);
    const cleanupObservations = identifiedSnapshot.snapshot.operations
      .find((item) => item.kind === "docker_task")
      ?.resources.map((resource) => ({
        purpose: resource.purpose,
        plannedResourceName:
          identity.resources[
            {
              create_egress_network: "egress",
              create_internal_network: "internal",
              create_provider: "provider",
              create_proxy: "proxy",
              create_subscription_auth_probe: "auth",
            }[resource.purpose] as keyof typeof identity.resources
          ],
        dockerId: resource.dockerId,
        observation: resource.purpose === purpose ? "absent" : "not_requested",
      }));
    assert.ok(
      prepareCoordinatorStateCleanupSnapshot(
        identified,
        recoveryId,
        cleanupObservations,
        binding,
      ),
      `${purpose}:identified_cleanup`,
    );
    const beforeObservation: CoordinatorStateSnapshot = {
      ...identifiedSnapshot.snapshot,
      operations: identifiedSnapshot.snapshot.operations
        .filter((item) => item.kind === "docker_task")
        .map((item) => ({
          ...item,
          kind: "docker_task",
          dockerRestart: null,
        })),
    };
    const beforeObservationBytes = Buffer.from(
      `${encodeRuntimeStateValue(beforeObservation)}\n`,
    );
    const identifiedResource = beforeObservation.operations
      .find((item) => item.kind === "docker_task")
      ?.resources.find((item) => item.purpose === purpose);
    assert.ok(identifiedResource);
    const observedOnly = prepareCoordinatorStateResourceSnapshot(
      beforeObservationBytes,
      recoveryId,
      { ...identifiedResource, observation: "unknown" },
      binding,
    );
    assert.ok(observedOnly);
    const observedSnapshot = decodeCoordinatorStateSnapshot(
      observedOnly,
      binding,
    );
    assert.ok(observedSnapshot);
    const simultaneousObservation = Buffer.from(
      `${encodeRuntimeStateValue({
        ...observedSnapshot.snapshot,
        operations: observedSnapshot.snapshot.operations
          .filter((item) => item.kind === "docker_task")
          .map((item) => ({
            ...item,
            dockerRestart: restartRequest,
          })),
      })}\n`,
    );
    assert.ok(decodeCoordinatorStateSnapshot(simultaneousObservation, binding));
    assert.equal(
      validateCoordinatorStateTransition(
        beforeObservationBytes,
        simultaneousObservation,
        binding,
      ),
      false,
      `${purpose}:same_request_observation_change_with_restart`,
    );
  }
  for (const value of [
    { ...restartRequest, requestId: "f".repeat(64) },
    { ...restartRequest, scopeSha256: "f".repeat(64) },
    { ...restartRequest, request: "issued" },
    { ...restartRequest, extra: true },
  ])
    assert.equal(
      prepareCoordinatorStateRestartSnapshot(
        prepared,
        recoveryId,
        value,
        binding,
      ),
      null,
    );
  const restartPending = prepareCoordinatorStateRestartSnapshot(
    restartInitial,
    recoveryId,
    { ...restartRequest, request: "unknown", cleanup: "pending" },
    binding,
  );
  assert.ok(restartPending);
  assert.equal(
    prepareCoordinatorStateRestartSnapshot(
      restartPending,
      recoveryId,
      restartRequest,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateRestartSnapshot(
      restartInitial,
      recoveryId,
      null,
      binding,
    ),
    null,
  );
  for (const invalidIdentity of [
    { ...identity, consumer: undefined },
    { ...identity, consumer: "durable" },
    { ...identity, consumer: { consumer: "orchestrator" } },
    { ...identity, completionPolicy: "transient" },
    { ...identity, schema: "crdd-coordinator-task-docker-recovery/v1" },
    { ...identity, repositoryBinding: "f".repeat(64) },
    { ...identity, runtimeStateBinding: {} },
    { ...identity, repositoryBinding: undefined },
    { ...identity, providerHomeIdentityHash: "invalid" },
    { ...identity, initialHostRecoveryId: "invalid" },
    { ...identity, resources: { ...identity.resources, auth: "invalid" } },
  ]) {
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(
        null,
        `${JSON.stringify(invalidIdentity)}\n`,
        binding,
      ),
      null,
    );
  }
  const preparedState = decodeCoordinatorStateSnapshot(prepared, binding);
  assert.ok(preparedState);
  for (const consumer of ["coordinator_cli", "orchestrator", "workbench"]) {
    const consumerIdentity = `${JSON.stringify({ ...identity, consumer })}\n`;
    const consumerSnapshot = prepareCoordinatorStateOperationSnapshot(
      null,
      consumerIdentity,
      binding,
    );
    assert.ok(consumerSnapshot);
    const consumerState = decodeCoordinatorStateSnapshot(
      consumerSnapshot,
      binding,
    );
    assert.ok(consumerState);
    const consumerOperation = consumerState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    );
    assert.ok(consumerOperation);
    assert.equal(JSON.parse(consumerOperation.identityJson).consumer, consumer);
    if (consumer !== identity.consumer) {
      const replacement = JSON.parse(consumerSnapshot.toString("utf8"));
      replacement.revision = preparedState.snapshot.revision + 1;
      replacement.previous = {
        revision: preparedState.snapshot.revision,
        payloadSha256: preparedState.payloadSha256,
      };
      assert.equal(
        validateCoordinatorStateTransition(
          prepared,
          Buffer.from(`${encodeRuntimeStateValue(replacement)}\n`),
          binding,
        ),
        false,
      );
    }
  }
  const initialOperation = preparedState.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.equal(initialOperation?.recoveryId, recoveryId);
  assert.equal(initialOperation?.phase, "executing");
  assert.equal(initialOperation?.lease, "held");
  assert.equal(initialOperation?.host.pendingTransitionJson, null);
  assert.ok(initialOperation);
  const releasedOperation: CoordinatorStateTaskOperation = {
    ...initialOperation,
    lease: "released",
    execution: {
      ...initialOperation.execution,
      ownerEffect: "disabled",
      workspaceReusable: false,
    },
    resources: initialOperation.resources.map((item) => ({
      ...item,
      request: "identified",
      dockerId: "d".repeat(64),
      receiptSource: "docker_create_result",
      observation: "absent",
    })),
  };
  assert.equal(
    coordinatorReleasedTaskCanObserveHostAbsence(releasedOperation),
    true,
  );
  // 型で禁止される入力も、実行時の拒否条件を個別に反証する。
  assert.equal(
    coordinatorReleasedTaskCanObserveHostAbsence({
      ...releasedOperation,
      execution: { ...releasedOperation.execution, workspaceReusable: true },
    } as unknown as CoordinatorStateTaskOperation),
    false,
  );
  for (const effectOutcomeUnknown of [false, true]) {
    const dockerRestart = {
      requestId: "a".repeat(64),
      scopeSha256: "b".repeat(64),
      request: "confirmed" as const,
      cleanup: "pending" as const,
      result: {
        status: "blocked" as const,
        reason: "docker_restart_unsettled",
        request: "confirmed" as const,
        effectOutcomeUnknown,
      },
    };
    assert.ok(decodeDockerRestartCheckpoint(dockerRestart));
    assert.equal(
      coordinatorReleasedTaskCanObserveHostAbsence({
        ...releasedOperation,
        dockerRestart,
      }),
      false,
    );
  }
  for (const invalid of [
    { ...releasedOperation, lease: "held" as const },
    {
      ...releasedOperation,
      execution: {
        ...releasedOperation.execution,
        ownerEffect: "active" as const,
      },
    },
    {
      ...releasedOperation,
      execution: {
        ...releasedOperation.execution,
        ownerEffect: "unknown" as const,
      },
    },
    {
      ...releasedOperation,
      host: { ...releasedOperation.host, pendingTransitionJson: "pending" },
    },
    { ...releasedOperation, resources: releasedOperation.resources.slice(1) },
    {
      ...releasedOperation,
      resources: releasedOperation.resources.map((item, i) =>
        i === 0 ? { ...item, request: "unknown" as const } : item,
      ),
    },
    {
      ...releasedOperation,
      resources: releasedOperation.resources.map((item, i) =>
        i === 0 ? { ...item, observation: "unknown" as const } : item,
      ),
    },
  ])
    assert.equal(coordinatorReleasedTaskCanObserveHostAbsence(invalid), false);
  const hostIntent = {
    ...initialOperation.host,
    pendingTransitionJson: `${JSON.stringify(transition)}\n`,
  };
  const hostIntentBytes = prepareCoordinatorStateHostSnapshot(
    prepared,
    recoveryId,
    hostIntent,
    binding,
  );
  assert.ok(hostIntentBytes);
  const hostReceipt = {
    ...hostIntent,
    currentToken: expectedToken,
    pendingTransitionJson: null,
  };
  const hostReceiptBytes = prepareCoordinatorStateHostSnapshot(
    hostIntentBytes,
    recoveryId,
    hostReceipt,
    binding,
  );
  assert.ok(hostReceiptBytes);
  assert.equal(
    decodeCoordinatorStateSnapshot(
      hostReceiptBytes,
      binding,
    )?.snapshot.operations.find((item) => item.kind === "docker_task")?.host
      .currentToken,
    expectedToken,
  );
  assert.deepEqual(
    decodeCoordinatorStateSnapshot(
      hostReceiptBytes,
      binding,
    )?.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.resources,
    initialOperation.resources,
  );
  for (const [before, update] of [
    [prepared, hostReceipt],
    [hostIntentBytes, initialOperation.host],
    [hostReceiptBytes, initialOperation.host],
    [prepared, { ...hostIntent, extra: true }],
    [
      prepared,
      {
        ...hostIntent,
        pendingTransitionJson: `${encodeRuntimeStateValue(transition)}\n`,
      },
    ],
  ]) {
    assert.equal(
      prepareCoordinatorStateHostSnapshot(before, recoveryId, update, binding),
      null,
    );
  }
  const resource = initialOperation?.resources.find(
    (item) => item.purpose === "create_provider",
  );
  assert.ok(resource);
  const intent = prepareCoordinatorStateResourceSnapshot(
    prepared,
    recoveryId,
    { ...resource, request: "intent_saved" },
    binding,
  );
  assert.ok(intent);
  const directReceipt = {
    ...resource,
    request: "identified",
    dockerId: "d".repeat(64),
    receiptSource: "docker_create_result",
    observation: "unobserved",
    absence: null,
  };
  const receiptCandidate = prepareCoordinatorStateResourceSnapshot(
    intent,
    recoveryId,
    directReceipt,
    binding,
  );
  assert.ok(receiptCandidate);
  assert.equal(
    classifyCoordinatorResourcePublication(
      intent,
      receiptCandidate,
      recoveryId,
      binding,
    ),
    "publish_pending",
  );
  assert.equal(
    classifyCoordinatorResourcePublication(
      receiptCandidate,
      receiptCandidate,
      recoveryId,
      binding,
    ),
    "remove_pending",
  );
  for (const [before, candidate, token, repository] of [
    [prepared, receiptCandidate, recoveryId, binding],
    [intent, receiptCandidate, "wrong", binding],
    [intent, receiptCandidate, recoveryId, "b".repeat(64)],
    [intent, Buffer.from("invalid"), recoveryId, binding],
    [null, receiptCandidate, recoveryId, binding],
    [
      intent,
      Buffer.from(JSON.stringify(JSON.parse(receiptCandidate.toString()))),
      recoveryId,
      binding,
    ],
  ])
    assert.equal(
      classifyCoordinatorResourcePublication(
        before,
        candidate,
        token,
        repository,
      ),
      null,
    );
  const alteredPublication = JSON.parse(receiptCandidate.toString());
  alteredPublication.operations[0].phase = "settling";
  assert.equal(
    classifyCoordinatorResourcePublication(
      intent,
      Buffer.from(`${encodeRuntimeStateValue(alteredPublication)}\n`),
      recoveryId,
      binding,
    ),
    null,
  );
  assert.ok(
    prepareCoordinatorStateResourceSnapshot(
      intent,
      recoveryId,
      directReceipt,
      binding,
    ),
  );
  for (const [current, value] of [
    [prepared, directReceipt],
    [intent, { ...directReceipt, dockerId: null }],
    [intent, { ...directReceipt, dockerId: "invalid" }],
    [intent, { ...directReceipt, receiptSource: "runtime_reconciliation" }],
    [intent, { ...directReceipt, observation: "present" }],
    [intent, { ...directReceipt, observation: "unknown" }],
    [intent, { ...directReceipt, absence: {} }],
  ] as const) {
    assert.equal(
      prepareCoordinatorStateResourceSnapshot(
        current,
        recoveryId,
        value,
        binding,
      ),
      null,
    );
  }
  const notIssued = prepareCoordinatorStateResourceSnapshot(
    intent,
    recoveryId,
    { ...resource, request: "not_issued" },
    binding,
  );
  assert.ok(notIssued);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      prepared,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  for (const request of [
    "not_requested",
    "intent_saved",
    "issued",
    "unknown",
  ] as const) {
    assert.equal(
      prepareCoordinatorStateResourceSnapshot(
        notIssued,
        recoveryId,
        { ...resource, request },
        binding,
      ),
      null,
    );
  }
  const issued = prepareCoordinatorStateResourceSnapshot(
    intent,
    recoveryId,
    { ...resource, request: "issued" },
    binding,
  );
  assert.ok(issued);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      issued,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  const unknown = prepareCoordinatorStateResourceSnapshot(
    issued,
    recoveryId,
    { ...resource, request: "unknown", observation: "unknown" },
    binding,
  );
  assert.ok(unknown);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      unknown,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  const receipt = {
    ...resource,
    request: "identified",
    dockerId: "d".repeat(64),
    receiptSource: "docker_create_result",
    observation: "present",
  };
  const identified = prepareCoordinatorStateResourceSnapshot(
    unknown,
    recoveryId,
    receipt,
    binding,
  );
  assert.ok(identified);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      identified,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  const identifiedState = decodeCoordinatorStateSnapshot(identified, binding);
  assert.ok(identifiedState);
  const identifiedOperation = identifiedState.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(identifiedOperation && identifiedOperation.kind === "docker_task");
  const cleanupObservations = identifiedOperation.resources.map((item) => ({
    purpose: item.purpose,
    plannedResourceName:
      identity.resources[
        (
          {
            create_egress_network: "egress",
            create_internal_network: "internal",
            create_provider: "provider",
            create_proxy: "proxy",
            create_subscription_auth_probe: "auth",
          } as const
        )[item.purpose]
      ],
    dockerId: item.dockerId,
    observation: item.request === "not_requested" ? "not_requested" : "absent",
  }));
  const cleanupBytes = prepareCoordinatorStateCleanupSnapshot(
    identified,
    recoveryId,
    cleanupObservations,
    binding,
  );
  assert.ok(cleanupBytes);
  const unissuedCleanup = prepareCoordinatorStateCleanupSnapshot(
    notIssued,
    recoveryId,
    cleanupObservations.map((item) => ({
      ...item,
      dockerId: null,
      observation: "not_requested",
    })),
    binding,
  );
  assert.ok(unissuedCleanup);
  assert.equal(
    decodeCoordinatorStateSnapshot(unissuedCleanup, binding)
      ?.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.resources.find((item) => item.purpose === resource.purpose)?.request,
    "not_issued",
  );
  for (const observation of ["absent", "unknown"] as const) {
    assert.equal(
      prepareCoordinatorStateCleanupSnapshot(
        notIssued,
        recoveryId,
        cleanupObservations.map(
          (item): Record<string, unknown> => ({
            ...item,
            dockerId: null,
            observation:
              item.purpose === resource.purpose ? observation : "not_requested",
          }),
        ),
        binding,
      ),
      null,
    );
  }
  const cleanupState = decodeCoordinatorStateSnapshot(cleanupBytes, binding);
  assert.ok(cleanupState);
  assert.equal(
    cleanupState.snapshot.revision,
    identifiedState.snapshot.revision + 1,
  );
  assert.equal(
    cleanupState.snapshot.operations
      .find((item) => item.kind === "docker_task")
      ?.resources.find((item) => item.purpose === "create_provider")
      ?.observation,
    "absent",
  );
  assert.deepEqual(
    cleanupState.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.host,
    identifiedState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.host,
  );
  for (const invalidValues of [
    null,
    [],
    cleanupObservations.slice(1),
    [...cleanupObservations].reverse(),
    cleanupObservations.map(() => cleanupObservations[0]),
    [...cleanupObservations, cleanupObservations[0]],
    cleanupObservations.map((item) => ({ ...item, dockerId: "e".repeat(64) })),
    cleanupObservations.map((item) => ({
      ...item,
      plannedResourceName: "foreign",
    })),
    cleanupObservations.map((item) => ({
      ...item,
      observation: "not_requested",
    })),
  ]) {
    assert.equal(
      prepareCoordinatorStateCleanupSnapshot(
        identified,
        recoveryId,
        invalidValues,
        binding,
      ),
      null,
    );
  }
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      unknown,
      recoveryId,
      cleanupObservations,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      identified,
      `${recoveryId}0`,
      cleanupObservations,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      identified,
      recoveryId,
      cleanupObservations,
      "b".repeat(64),
    ),
    null,
  );
  let isCleanupGetterInvoked = false;
  const hostileCleanup = Object.defineProperty({}, "purpose", {
    enumerable: true,
    get: () => {
      isCleanupGetterInvoked = true;
      return "create_provider";
    },
  });
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      identified,
      recoveryId,
      [hostileCleanup, ...cleanupObservations.slice(1)],
      binding,
    ),
    null,
  );
  assert.equal(isCleanupGetterInvoked, false);
  assert.equal(
    identifiedState.snapshot.revision,
    preparedState.snapshot.revision + 4,
  );
  assert.equal(
    identifiedState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.identityJson,
    identityJson,
  );
  assert.deepEqual(
    identifiedState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.host,
    initialOperation?.host,
  );
  assert.deepEqual(
    identifiedState.snapshot.operations
      .find((item) => item.kind === "docker_task")
      ?.resources.filter((item) => item.purpose !== "create_provider"),
    initialOperation?.resources.filter(
      (item) => item.purpose !== "create_provider",
    ),
  );
  for (const [before, ref, update, owner] of [
    [prepared, recoveryId, { ...resource, request: "issued" }, binding],
    [intent, recoveryId, receipt, binding],
    [unknown, recoveryId, resource, binding],
    [identified, recoveryId, { ...receipt, dockerId: "e".repeat(64) }, binding],
    [
      prepared,
      `${recoveryId}0`,
      { ...resource, request: "intent_saved" },
      binding,
    ],
    [
      prepared,
      recoveryId,
      { ...resource, request: "intent_saved", extra: true },
      binding,
    ],
    [prepared, recoveryId, { ...resource, purpose: "other" }, binding],
    [prepared, recoveryId, resource, "b".repeat(64)],
  ])
    assert.equal(
      prepareCoordinatorStateResourceSnapshot(before, ref, update, owner),
      null,
    );
  let isResourceGetterInvoked = false;
  const hostileResource = Object.defineProperty({}, "purpose", {
    enumerable: true,
    get: () => {
      isResourceGetterInvoked = true;
      return "create_provider";
    },
  });
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      prepared,
      recoveryId,
      hostileResource,
      binding,
    ),
    null,
  );
  assert.equal(isResourceGetterInvoked, false);
  const secondIdentityJson = `${JSON.stringify({
    ...identity,
    operationNonce: "0".repeat(64),
    operationId: "OP-654321",
    stableLogicalHomeBindingHash: "e".repeat(64),
  })}\n`;
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      prepared,
      `${JSON.stringify({ ...identity, operationNonce: "0".repeat(64), operationId: "OP-654321" })}\n`,
      binding,
    ),
    null,
    "未終了の同Home操作を追加しない",
  );
  const twoOperations = prepareCoordinatorStateOperationSnapshot(
    prepared,
    secondIdentityJson,
    binding,
  );
  assert.ok(twoOperations);
  const twoState = decodeCoordinatorStateSnapshot(twoOperations, binding);
  assert.ok(twoState);
  assert.equal(twoState.snapshot.operations.length, 2);
  const twoRestart = prepareCoordinatorStateRestartSnapshot(
    twoOperations,
    recoveryId,
    restartRequest,
    binding,
  );
  assert.ok(twoRestart);
  const updatedRestarts = decodeCoordinatorStateSnapshot(twoRestart, binding);
  assert.ok(updatedRestarts);
  assert.deepEqual(
    updatedRestarts.snapshot.operations,
    twoState.snapshot.operations
      .filter((item) => item.kind === "docker_task")
      .map((item) =>
        item.recoveryId === recoveryId
          ? { ...item, dockerRestart: restartRequest }
          : item,
      ),
    "再起動更新は非対象操作を変えない",
  );
  const otherOperation = twoState.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(otherOperation);
  const otherRestart = {
    ...restartRequest,
    requestId: createDockerRestartRequestId(
      binding,
      otherOperation.identitySha256,
      otherOperation.recoveryId,
      restartScope,
    ),
  };
  assert.equal(
    prepareCoordinatorStateRestartSnapshot(
      twoRestart,
      otherOperation.recoveryId,
      otherRestart,
      binding,
    ),
    null,
    "同じSnapshot内の未解決要求を二件にしない",
  );
  const firstRestartPending = prepareCoordinatorStateRestartSnapshot(
    twoRestart,
    recoveryId,
    { ...restartRequest, request: "unknown", cleanup: "pending" },
    binding,
  );
  assert.ok(firstRestartPending);
  for (const checkpointRequest of ["unknown", "issued"] as const) {
    const requestBeforeResult =
      checkpointRequest === "unknown"
        ? firstRestartPending
        : prepareCoordinatorStateRestartSnapshot(
            firstRestartPending,
            recoveryId,
            { ...restartRequest, request: "issued", cleanup: "pending" },
            binding,
          );
    assert.ok(requestBeforeResult);
    for (const finalRequest of ["not_issued", "unknown", "issued", "confirmed"])
      for (const effectOutcomeUnknown of [false, true]) {
        const settled = prepareCoordinatorStateRestartSnapshot(
          requestBeforeResult,
          recoveryId,
          {
            ...restartRequest,
            request: checkpointRequest,
            cleanup: "confirmed",
            result: {
              status: "blocked",
              reason: "docker_restart_stop_unconfirmed",
              request: finalRequest,
              effectOutcomeUnknown,
            },
          },
          binding,
        );
        if (checkpointRequest === "issued" && finalRequest === "not_issued") {
          assert.equal(settled, null);
          continue;
        }
        assert.ok(settled);
        assert.equal(
          prepareCoordinatorStateRestartSnapshot(
            settled,
            otherOperation.recoveryId,
            otherRestart,
            binding,
          ) !== null,
          !effectOutcomeUnknown &&
            ((checkpointRequest === "unknown" &&
              finalRequest === "not_issued") ||
              (checkpointRequest === "issued" && finalRequest === "issued")),
          `未発行確定と発行済み既知失敗だけを未解決要求数から除外する: ${checkpointRequest}/${finalRequest}/${effectOutcomeUnknown}`,
        );
      }
  }
  assert.equal(
    twoState.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.identityJson,
    secondIdentityJson,
  );
  assert.deepEqual(twoState.snapshot.operations[1], initialOperation);
  assert.deepEqual(twoState.snapshot.previous, {
    revision: 1,
    payloadSha256: preparedState.payloadSha256,
  });
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      prepared,
      secondIdentityJson,
      "f".repeat(64),
    ),
    null,
  );
  assert.ok(
    initialOperation?.resources.every(
      (resource) =>
        resource.request === "not_requested" &&
        resource.observation === "unobserved",
    ),
  );
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(prepared, identityJson, binding),
    null,
  );
  const fromEmpty = prepareCoordinatorStateOperationSnapshot(
    Buffer.from(`${encodeRuntimeStateValue(empty)}\n`),
    identityJson,
    binding,
  );
  assert.ok(fromEmpty);
  assert.deepEqual(
    decodeCoordinatorStateSnapshot(fromEmpty, binding)?.snapshot.previous,
    { revision: 1, payloadSha256: hashRuntimeStateContent(empty) },
  );
  for (const invalid of [
    "invalid",
    JSON.stringify(identity),
    `${JSON.stringify({ ...identity, operationNonce: "invalid" })}\n`,
  ])
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(null, invalid, binding),
      null,
    );
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      Buffer.from("invalid"),
      identityJson,
      binding,
    ),
    null,
  );
  for (const [currentState, nextState] of [
    ["host_only", "docker_active"],
    ["docker_absent_confirmed", "docker_submission_started"],
    ["host_only", "docker_absent_confirmed"],
  ]) {
    const before = { ...hostRecord, state: currentState };
    const after = { ...before, state: nextState };
    const invalidTransition = {
      ...transition,
      currentState,
      nextState,
      recordBefore: before,
      currentToken:
        token.slice(0, -64) +
        createHash("sha256")
          .update(`${JSON.stringify(before)}\n`)
          .digest("hex"),
      expectedToken:
        token.slice(0, -64) +
        createHash("sha256")
          .update(`${JSON.stringify(after)}\n`)
          .digest("hex"),
    };
    const invalid = {
      ...snapshot,
      operations: [
        {
          ...operation,
          host: {
            ...operation.host,
            currentToken: invalidTransition.currentToken,
            pendingTransitionJson: `${JSON.stringify(invalidTransition)}\n`,
          },
        },
      ],
    };
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  }
  const accepted = decodeCoordinatorStateSnapshot(
    Buffer.from(`${encodeRuntimeStateValue(snapshot)}\n`),
    binding,
  );
  assert.ok(accepted);
  assert.equal(
    accepted.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.identityJson,
    identityJson,
  );
  assert.equal(
    accepted.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.resources[2]?.dockerId,
    "d".repeat(64),
  );
  for (const replacement of [
    {
      ...operation,
      recoveryId: `${recoveryId.slice(0, -1)}${recoveryId.endsWith("0") ? "1" : "0"}`,
    },
    {
      ...operation,
      identityJson: `${encodeRuntimeStateValue(identity)}\n`,
    },
    { ...operation, resources: [...operation.resources].reverse() },
    {
      ...operation,
      host: {
        ...operation.host,
        pendingTransitionJson: `${encodeRuntimeStateValue(transition)}\n`,
      },
    },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(
          `${encodeRuntimeStateValue({
            ...snapshot,
            operations: [replacement],
          })}\n`,
        ),
        binding,
      ),
      null,
    );
  const orphan = {
    ...snapshot,
    unresolvedRecoveries: [
      {
        operationNonce: "f".repeat(64),
        recoveryId,
        reason: "provider_result_invalid",
        obligations: ["docker_resources"],
      },
    ],
  };
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(`${encodeRuntimeStateValue(orphan)}\n`),
      binding,
    ),
    null,
  );
  const currentBytes = Buffer.from(`${encodeRuntimeStateValue(snapshot)}\n`);
  const next = {
    ...snapshot,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: hashRuntimeStateContent(snapshot),
    },
  };
  assert.equal(
    validateCoordinatorStateTransition(
      currentBytes,
      Buffer.from(`${encodeRuntimeStateValue(next)}\n`),
      binding,
    ),
    true,
  );
  for (const invalid of [
    { ...next, previous: { ...next.previous, payloadSha256: "f".repeat(64) } },
    { ...next, operations: [] },
    {
      ...next,
      operations: [
        {
          ...operation,
          resources: operation.resources.map((resource) =>
            resource.purpose === "create_provider"
              ? { ...resource, dockerId: "e".repeat(64) }
              : resource,
          ),
        },
      ],
    },
    {
      ...next,
      operations: [
        {
          ...operation,
          resources: operation.resources.map((resource) =>
            resource.purpose === "create_provider"
              ? {
                  ...resource,
                  request: "unknown",
                  dockerId: null,
                  receiptSource: null,
                }
              : resource,
          ),
        },
      ],
    },
    { ...next, operations: [{ ...operation, phase: "executing" }] },
    {
      ...next,
      operations: [
        {
          ...operation,
          host: { ...operation.host, pendingTransitionJson: null },
        },
      ],
    },
  ])
    assert.equal(
      validateCoordinatorStateTransition(
        currentBytes,
        Buffer.from(`${encodeRuntimeStateValue(invalid)}\n`),
        binding,
      ),
      false,
    );
  const failure = {
    purpose: "create_provider",
    stage: "command_wait",
    reason: "provider_result_invalid",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
  };
  const stopped = {
    ...snapshot,
    operations: [
      {
        ...operation,
        primaryFailure: failure,
        outcome: {
          status: "blocked",
          reason: "provider_result_invalid",
          cleanupConfirmed: false,
        },
        summarySha256: null,
      },
    ],
    unresolvedRecoveries: [
      {
        operationNonce: nonce,
        recoveryId,
        reason: "provider_result_invalid",
        obligations: ["docker_resources"],
      },
    ],
    pendingDeliveries: [
      {
        operationNonce: nonce,
        recoveryId,
        resultId: "e".repeat(64),
        consumer: "orchestrator",
      },
    ],
  };
  const stoppedBytes = Buffer.from(`${encodeRuntimeStateValue(stopped)}\n`);
  const lifecycle = {
    phase: operation.phase,
    lease: operation.lease,
    execution: operation.execution,
    primaryFailure: failure,
    outcome: stopped.operations.find((item) => item.kind === "docker_task")
      ?.outcome,
    summarySha256: null,
  };
  const lifecycleBytes = prepareCoordinatorStateLifecycleSnapshot(
    currentBytes,
    recoveryId,
    lifecycle,
    binding,
  );
  assert.ok(lifecycleBytes);
  const lifecycleState = decodeCoordinatorStateSnapshot(
    lifecycleBytes,
    binding,
  );
  assert.ok(lifecycleState);
  assert.deepEqual(
    lifecycleState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.primaryFailure,
    failure,
  );
  assert.deepEqual(
    lifecycleState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
    operation.resources,
  );
  assert.deepEqual(
    lifecycleState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.host,
    operation.host,
  );
  const references = {
    recovery: stopped.unresolvedRecoveries[0],
    deliveries: stopped.pendingDeliveries,
  };
  const referencesBytes = prepareCoordinatorStateReferencesSnapshot(
    lifecycleBytes,
    recoveryId,
    references,
    binding,
  );
  assert.ok(referencesBytes);
  const acceptedReferences = {
    ...references,
    deliveries: stopped.pendingDeliveries,
  };
  const acceptedBytes = prepareCoordinatorStateReferencesSnapshot(
    referencesBytes,
    recoveryId,
    acceptedReferences,
    binding,
  );
  assert.ok(acceptedBytes);
  const acceptedState = decodeCoordinatorStateSnapshot(acceptedBytes, binding);
  assert.deepEqual(
    acceptedState?.snapshot.operations,
    lifecycleState.snapshot.operations,
  );
  assert.equal(
    acceptedState?.snapshot.pendingDeliveries.some((item) =>
      Object.hasOwn(item, "acceptanceSha256"),
    ),
    false,
  );
  for (const invalid of [
    { recovery: null, deliveries: [] },
    {
      ...references,
      deliveries: references.deliveries.map((item) => ({
        ...item,
        acceptanceSha256: null,
      })),
    },
    {
      ...acceptedReferences,
      deliveries: acceptedReferences.deliveries.map((item) => ({
        ...item,
        resultId: "a".repeat(64),
      })),
    },
    {
      ...acceptedReferences,
      recovery: { ...references.recovery, operationNonce: "0".repeat(64) },
    },
    {
      ...acceptedReferences,
      deliveries: [
        ...acceptedReferences.deliveries,
        ...acceptedReferences.deliveries,
      ],
    },
    { ...acceptedReferences, extra: true },
  ]) {
    assert.equal(
      prepareCoordinatorStateReferencesSnapshot(
        acceptedBytes,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  }
  for (const invalid of [
    { ...lifecycle, primaryFailure: null },
    {
      ...lifecycle,
      primaryFailure: { ...failure, reason: "provider_execution_failed" },
    },
    {
      ...lifecycle,
      outcome: {
        status: "completed",
        reason: "provider_operation_completed",
        cleanupConfirmed: true,
      },
    },
    { ...lifecycle, summarySha256: "e".repeat(64) },
    { ...lifecycle, identityJson },
    {
      ...lifecycle,
      execution: { ...operation.execution, externalSend: "not_issued" },
    },
    { phase: lifecycle.phase },
  ]) {
    assert.equal(
      prepareCoordinatorStateLifecycleSnapshot(
        lifecycleBytes,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  }
  const stoppedNext = {
    ...stopped,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: hashRuntimeStateContent(stopped),
    },
  };
  assert.equal(
    validateCoordinatorStateTransition(
      stoppedBytes,
      Buffer.from(
        `${encodeRuntimeStateValue({ ...stoppedNext, operations: [{ ...stopped.operations.find((item) => item.kind === "docker_task"), outcome: { ...stopped.operations.find((item) => item.kind === "docker_task")?.outcome, cleanupConfirmed: true } }] })}\n`,
      ),
      binding,
    ),
    true,
  );
  for (const invalid of [
    ...(
      [
        ["providerStart", "not_started"],
        ["externalSend", "not_issued"],
        ["sharedWrite", "not_issued"],
        ["ownerEffect", "active"],
      ] as const
    ).map(([field, value]) => ({
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          execution: { ...operation.execution, [field]: value },
        },
      ],
    })),
    { ...stoppedNext, unresolvedRecoveries: [] },
    { ...stoppedNext, pendingDeliveries: [] },
    {
      ...stoppedNext,
      pendingDeliveries: [
        { ...stopped.pendingDeliveries[0], resultId: "a".repeat(64) },
      ],
    },
    {
      ...stoppedNext,
      pendingDeliveries: [
        { ...stopped.pendingDeliveries[0], acceptanceSha256: null },
      ],
    },
    {
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          primaryFailure: null,
        },
      ],
    },
    {
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          summarySha256: "e".repeat(64),
        },
      ],
    },
    {
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          outcome: {
            status: "completed",
            reason: "provider_operation_completed",
            cleanupConfirmed: true,
          },
        },
      ],
    },
  ])
    assert.equal(
      validateCoordinatorStateTransition(
        stoppedBytes,
        Buffer.from(`${encodeRuntimeStateValue(invalid)}\n`),
        binding,
      ),
      false,
    );
});
