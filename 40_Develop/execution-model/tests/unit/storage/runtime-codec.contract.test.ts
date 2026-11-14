/**
 * 単一Runtime Schemaと管理投影の純粋契約をDomainで検証する。
 * @packageDocumentation
 * @responsibility Root結合・改訂・区画・三値相関をOwner内で反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope メモリ内の固定合成値。
 * @boundary 実保存・Host・AI・Dockerは使用しない。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  validateOperationIdentity,
  validPrimaryFailure,
} from "../../../src/attempt/validation.ts";
import { decodeHistoryRows } from "../../../src/history/validation.ts";
import type { ProjectExecutionState } from "../../../src/index.ts";
import type {
  ExecutionStateSnapshot,
  ProjectDefinition,
} from "../../../src/state/types.ts";
import {
  decodeStateSnapshot,
  EXECUTION_STATE_SCHEMA,
  hashExecutionProjectDefinition,
  hashExecutionStateContent,
  prepareStateOperationSnapshot,
  projectTaskSettlement,
  validateUnifiedTransition,
  validSnapshot,
} from "../../../src/state/validation.ts";
import { PROJECT_SNAPSHOT_SCHEMA } from "../../../src/state/types.ts";
import { encodeStateValue } from "../../../src/state/operations.ts";
import { prepareUnifiedTaskSnapshot } from "../../../src/task/operations.ts";
import { createResourceOperationFixture } from "../../support/resource-operation.ts";
import { createManagedRuntimeSnapshotFixture } from "../../support/runtime-state.ts";

const binding = "a".repeat(64);

/**
 * 再入場試験へ注入する旧行と別操作行の形式をモデルOwnerで検査する。
 * @responsibility 履歴の形式成立と現在操作への対応成立を区別する。
 * @trace PRL-UT-006
 * @precondition 非秘密の有限履歴値だけを構築する。
 * @stimulus 旧Schema、現行Schema、整合した別IDと不整合な別nonceを渡す。
 * @observation 内部decoderの行・IDと拒否結果。
 * @oracle 旧行と整合した別操作行は有効、不整合な回復IDは拒否する。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 形式検査であり実保存・同じ操作の終了許可の証明ではない。
 */
test("履歴の旧行と別操作行は形式成立と操作対応を分ける", () => {
  const nonce = "f".repeat(64);
  const identitySha256 = "e".repeat(64);
  const legacy = {
    schema: "crdd-coordinator/operation-summary/v2",
    operationId: "OP-999999",
    operationNonce: nonce,
    recoveryId: `docker-task.${binding}.${nonce}.${identitySha256}`,
    identitySha256,
    primaryFailure: null,
    execution: {
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
      ownerEffect: "disabled",
      workspaceReusable: false,
    },
    outcome: {
      status: "cancelled",
      reason: "provider_operation_cancelled",
      cleanupConfirmed: true,
    },
    hostCleanup: "confirmed",
    lease: "released",
  };
  const current = {
    ...legacy,
    schema: "crdd-execution-model/operation-summary/v5",
    recoveryCorrelationId: "upper-current-host",
  };
  const otherNonce = "d".repeat(64);
  const other = {
    ...current,
    operationId: "OP-888888",
    operationNonce: otherNonce,
    recoveryId: `docker-task.${binding}.${otherNonce}.${identitySha256}`,
  };
  for (const summary of [current, other]) {
    const line = `${encodeStateValue({ schema: "crdd-coordinator/history-row/v2", occurredAt: "2026-09-01T00:00:00.000Z", summary })}\n`;
    const rows = decodeHistoryRows(Buffer.from(line));
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0]?.recoveryId, summary.recoveryId);
    assert.equal(rows?.[0]?.line, line);
  }
  assert.notEqual(other.recoveryId, current.recoveryId);
  assert.equal(
    decodeHistoryRows(
      Buffer.from(
        `${encodeStateValue({
          schema: "crdd-coordinator/history-row/v2",
          occurredAt: "2026-09-01T00:00:00.000Z",
          summary: { ...current, operationNonce: otherNonce },
        })}\n`,
      ),
    ),
    null,
  );
});

/**
 * 保存された保護Pathを独自総長で再拒否しない。
 * @trace PRL-UT-006
 * @precondition 正規codecで準備したOperation Identityを使う。
 * @stimulus 4097文字超Pathと禁止区切り・未知fieldを渡す。
 * @observation Identity検査の受理／拒否。
 * @oracle 所在の量だけを外しSchema・nonce・Repository結合は維持する。
 * @cleanup N/A: メモリだけ。実Hostを参照しない。
 */
test("保護Pathの長さだけで正規Identityを拒否しない", () => {
  const fixture = createResourceOperationFixture();
  const identity = {
    ...fixture.identity,
    workspaceProtected: true,
    workspaceProtection: {
      gitSourcePath: "p".repeat(4097),
      internalSourcePath: "i".repeat(4097),
    },
  };
  assert.equal(
    validateOperationIdentity(
      identity,
      identity.operationNonce,
      fixture.binding,
    ),
    true,
  );
  assert.equal(
    validateOperationIdentity(
      {
        ...identity,
        workspaceProtection: {
          ...identity.workspaceProtection,
          gitSourcePath: "invalid\0",
        },
      },
      identity.operationNonce,
      fixture.binding,
    ),
    false,
  );
  assert.equal(
    validateOperationIdentity(
      {
        ...identity,
        workspaceProtection: {
          ...identity.workspaceProtection,
          extra: "unknown",
        },
      },
      identity.operationNonce,
      fixture.binding,
    ),
    false,
  );
});

/**
 * 技術記録の蓄積件数と相関検査を分離する。
 * @responsibility 旧64件を超える正規Operationを受理しHash改変は拒否する。
 * @trace PRL-UT-006
 * @precondition 正規codecで各Operationを個別生成する。
 * @stimulus 独立nonceと回復IDの129件、同じ集合の終端投影、及び末尾Hash改変を渡す。
 * @observation codecの受理・拒否と記録数。
 * @oracle 蓄積量だけで拒否せずIdentity相関を維持する。
 * @cleanup N/A: メモリ内の自己生成値のみ。
 */
test("内部技術記録は旧64件を超えても正規相関を維持する", () => {
  const fixture = createResourceOperationFixture();
  const initial = decodeStateSnapshot(fixture.bytes, fixture.binding);
  assert.ok(initial);
  const operations = Array.from({ length: 129 }, (_, index) => {
    const identity = {
      ...fixture.identity,
      operationNonce: (index + 1).toString(16).padStart(64, "0"),
      operationId: `OP-${String(index + 1).padStart(6, "0")}`,
      recoveryCorrelationId: `task-operation-${index}`,
    };
    const bytes = prepareStateOperationSnapshot(
      null,
      `${JSON.stringify(identity)}\n`,
      fixture.binding,
    );
    assert.ok(bytes);
    const observed = decodeStateSnapshot(bytes, fixture.binding);
    assert.ok(observed);
    const operation = observed.snapshot.operations[0];
    assert.ok(operation);
    return operation;
  });
  const state = { ...initial.snapshot, operations };
  const observed = decodeStateSnapshot(
    Buffer.from(`${encodeStateValue(state)}\n`),
    fixture.binding,
  );
  assert.ok(observed);
  assert.equal(observed.snapshot.operations.length, 129);
  const fact = {
    kind: "operations",
    recoveryIds: operations.map((operation) => operation.recoveryId),
    resultUnresolved: true,
  };
  assert.deepEqual(projectTaskSettlement(fact, state), {
    cleanupConfirmed: false,
    recoveryUnresolved: true,
  });
  assert.equal(
    projectTaskSettlement(
      { ...fact, recoveryIds: [...fact.recoveryIds, "missing"] },
      state,
    ),
    null,
  );
  assert.equal(
    projectTaskSettlement(
      { ...fact, recoveryIds: [...fact.recoveryIds, fact.recoveryIds[0]] },
      state,
    ),
    null,
  );
  const tampered = operations.map((operation, index) =>
    index === 128
      ? { ...operation, identitySha256: "f".repeat(64) }
      : operation,
  );
  assert.equal(
    decodeStateSnapshot(
      Buffer.from(`${encodeStateValue({ ...state, operations: tampered })}\n`),
      fixture.binding,
    ),
    null,
  );
});
const taskExecutionSelections = () => ({
  executor: {
    provider: "codex",
    modelIdentifier: "gpt-5.5",
    identifierKind: "exact",
    reasoningEffort: "medium",
    purpose: "task",
    catalogIdentity:
      "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
    configIdentity:
      "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
    role: "executor",
    workType: null,
    source: "role_default",
  },
  reviewer: {
    provider: "claude",
    modelIdentifier: "opus",
    identifierKind: "alias",
    reasoningEffort: "high",
    purpose: "task",
    catalogIdentity:
      "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
    configIdentity:
      "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
    role: "independent_reviewer",
    workType: null,
    source: "role_default",
  },
});
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
function emptyExecutionStateSnapshot(): ExecutionStateSnapshot {
  return {
    schema: "crdd-execution-model/state/v4",
    revision: 1,
    previous: null,
    repositoryBinding: binding,
    repositoryBindingId: null,
    intakeEpoch: null,
    operations: [],
    unresolvedRecoveries: [],
    projects: [],
    managedExecutions: [],
    queueEntries: [],
    workspaces: [],
    intakeBindings: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
}
const empty = {
  ...emptyExecutionStateSnapshot(),
  schema: EXECUTION_STATE_SCHEMA,
  revision: 1,
  previous: null,
  repositoryBinding: binding,
  operations: [],
  unresolvedRecoveries: [],
};
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
    ...emptyExecutionStateSnapshot(),
    schema: "crdd-execution-model/state/v4",
    repositoryBindingId: "binding-a",
    intakeEpoch: "epoch-a",
    managedExecutions: [],
  };
  const core: ProjectDefinition = {
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
    Buffer.from(`${encodeStateValue(value)}\n`);
  const coreOnly = { ...empty, projects: [core] };
  const read = decodeStateSnapshot(encode(coreOnly), binding);
  assert.ok(read);
  assert.deepEqual(read.snapshot, coreOnly);
  assert.deepEqual(read.projects, []);
  assert.equal(
    decodeStateSnapshot(
      encode({
        ...emptyExecutionStateSnapshot(),
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
      assert.equal(decodeStateSnapshot(encode(missing), binding), null);
    } else assert.equal(decodeStateSnapshot(encode(invalid), binding), null);
  }
  const definition: ProjectDefinition = {
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
    definitionHash: hashExecutionProjectDefinition(definition),
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
    decodeStateSnapshot(
      encode({
        ...complete,
        projects: [unassigned],
        managedExecutions: [
          {
            ...managed,
            definitionHash: hashExecutionProjectDefinition(unassigned),
          },
        ],
      }),
      binding,
    ),
    null,
  );
  const projected = decodeStateSnapshot(encode(complete), binding);
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
    definitionHash: hashExecutionProjectDefinition(twoDefinitions),
    tasks: [firstManaged, { ...firstManaged, taskId: "task-b" }],
  };
  const ordered = {
    ...complete,
    projects: [twoDefinitions],
    managedExecutions: [twoManaged],
  };
  assert.ok(decodeStateSnapshot(encode(ordered), binding));
  assert.equal(
    decodeStateSnapshot(
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
      decodeStateSnapshot(
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
  const snapshot = emptyExecutionStateSnapshot();
  const bytes = Buffer.from(`${encodeStateValue(snapshot)}\n`);
  assert.deepEqual(decodeStateSnapshot(bytes, binding)?.snapshot, snapshot);
  assert.equal(
    decodeStateSnapshot(bytes, binding)?.payloadSha256,
    createHash("sha256").update(bytes).digest("hex"),
  );
  assert.deepEqual(decodeStateSnapshot(bytes, binding)?.snapshot, snapshot);
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
    { ...snapshot, pendingDeliveries: [] },
    { ...snapshot, workspaces: [{}] },
    { ...snapshot, payload: snapshot },
  ])
    assert.equal(
      decodeStateSnapshot(
        Buffer.from(`${encodeStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  assert.equal(decodeStateSnapshot(bytes, "b".repeat(64)), null);
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
    Buffer.from(`${encodeStateValue(value)}\n`);
  assert.equal(validateUnifiedTransition(null, bytes, binding), true);
  assert.equal(validateUnifiedTransition(bytes, encode(next), binding), true);
  assert.equal(
    validateUnifiedTransition(bytes, encode({ ...next, revision: 3 }), binding),
    false,
  );
  assert.equal(
    validateUnifiedTransition(
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
  assert.deepEqual(projectTaskSettlement({ kind: "pending" }, snapshot), {
    cleanupConfirmed: false,
    recoveryUnresolved: false,
  });
  assert.deepEqual(projectTaskSettlement({ kind: "unissued" }, snapshot), {
    cleanupConfirmed: true,
    recoveryUnresolved: false,
  });
  for (const cleanupConfirmed of [false, true]) {
    for (const recoveryUnresolved of [false, true]) {
      assert.deepEqual(
        projectTaskSettlement(
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
    assert.equal(projectTaskSettlement(invalid, snapshot), null);
  assert.equal(reads, 0);
});

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
  const text = `${encodeStateValue(empty)}\n`;
  const result = decodeStateSnapshot(Buffer.from(text), binding);
  assert.ok(result);
  assert.equal(result.payloadSha256, hashExecutionStateContent(empty));
  assert.ok(Object.isFrozen(result.snapshot.operations));
  for (const invalid of [
    { ...empty, repositoryBinding: "b".repeat(64) },
    { ...empty, revision: 0 },
    { ...empty, revision: 2 },
    { ...empty, unknown: true },
    { ...empty, resultReceipts: [] },
  ])
    assert.equal(
      decodeStateSnapshot(
        Buffer.from(`${encodeStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  assert.equal(
    decodeStateSnapshot(Buffer.from(`${JSON.stringify(empty)}\n`), binding),
    null,
  );
  assert.equal(
    decodeStateSnapshot(
      Buffer.from(text.replace('"revision":1', '"revision":1,"revision":1')),
      binding,
    ),
    null,
  );
  assert.equal(decodeStateSnapshot(Buffer.from([0xff]), binding), null);
  assert.equal(decodeStateSnapshot(Buffer.from(text), "wrong"), null);
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
  assert.throws(() => encodeStateValue(hostile));
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        isInvoked = true;
        return [];
      },
    },
  );
  assert.throws(() => encodeStateValue(proxy));
  assert.equal(isInvoked, false);
  const bytes = Buffer.from(`${encodeStateValue(empty)}\n`);
  const proxyBytes = new Proxy(bytes, {
    get() {
      isInvoked = true;
      throw new Error("trap");
    },
  });
  assert.equal(decodeStateSnapshot(proxyBytes, binding), null);
  Object.defineProperty(bytes, "length", {
    get() {
      isInvoked = true;
      throw new Error("getter");
    },
  });
  assert.ok(decodeStateSnapshot(bytes, binding));
  assert.equal(isInvoked, false);
  assert.equal(
    decodeStateSnapshot(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(`${encodeStateValue(empty)}\n`),
      ]),
      binding,
    ),
    null,
  );
  assert.equal(encodeStateValue({ z: [2, 1], a: 0 }), '{"a":0,"z":[2,1]}');
  assert.equal(
    encodeStateValue(Object.assign(Object.create(null), { z: [2, 1], a: 0 })),
    '{"a":0,"z":[2,1]}',
  );
  assert.throws(() =>
    encodeStateValue(Object.assign(Object.create({ inherited: 1 }), { a: 0 })),
  );
  assert.throws(() => encodeStateValue(new Array(2)));
  assert.throws(() => encodeStateValue(Number.NaN));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => encodeStateValue(cycle));
});

/**
 * Task区画の非空回復を物理保存なしで検証する。
 * @responsibility 共通検証への移管で値のキー・相関・孤立参照の拒否を失わないことを反証する。
 * @trace PRL-UT-006
 * @precondition 固定の合成管理Stateと現行Snapshot契約だけを使う。
 * @stimulus 正常回復、誤キー、重複、別Queue、未知Root区画を検査する。
 * @observation codecの真偽と入力全文を比較する。
 * @oracle 正常な非空集合だけを受理し、不正値を補完せず入力も変更しない。
 * @cleanup N/A: Process、Filesystem、Lockを生成しない。
 * @boundary PRL-UT-006=Direct Boundary: メモリ内Task区画と保存codec。
 */
test("Task保存codec: 非空回復の値キーとexact参照を保持する", () => {
  // 保存codecの前提値だけを固定し、Coordinatorの生成処理は呼ばない。
  const created = {
    status: "completed",
    state: {
      contract: "crdd-execution-model/project-state/v3",
      taskExecutionSelections: {
        executor: {
          provider: "codex",
          modelIdentifier: "gpt-5.5",
          identifierKind: "exact",
          reasoningEffort: "medium",
          purpose: "task",
          catalogIdentity:
            "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
          configIdentity:
            "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
          role: "executor",
          workType: null,
          source: "role_default",
        },
        reviewer: {
          provider: "claude",
          modelIdentifier: "opus",
          identifierKind: "alias",
          reasoningEffort: "high",
          purpose: "task",
          catalogIdentity:
            "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
          configIdentity:
            "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
          role: "independent_reviewer",
          workType: null,
          source: "role_default",
        },
      },
      projectId: "project-a",
      milestoneId: "milestone-a",
      repositoryRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      generation: 1,
      ownerGeneration: "owner-a",
      decisionApplicationId: null,
      maximumConcurrency: 2,
      milestone: {
        id: "milestone-a",
        acceptanceCriteria: ["accepted"],
        state: "planned",
        criterionEvidenceIds: [],
      },
      objectives: [
        {
          definition: {
            id: "objective-a",
            acceptanceCriteria: ["done"],
          },
          state: "planned",
          criterionEvidenceIds: [],
        },
      ],
      tasks: [
        {
          definition: {
            id: "task-a",
            objectiveId: "objective-a",
            dependencies: [],
            allowedPaths: ["src/a.ts"],
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
        },
      ],
    } as ProjectExecutionState,
  } as const;
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("state_fixture_invalid");
  const snapshot = {
    schema: PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 7,
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
    decisions: [],
    blockers: [],
  };
  const before = JSON.stringify(snapshot);
  assert.equal(validSnapshot(snapshot, "binding-a", binding), true);
  for (const invalid of [
    {
      ...snapshot,
      decisions: [{}],
    },
    {
      ...snapshot,
      blockers: [{}],
    },
    {
      ...snapshot,
      acceptanceDecisions: [],
    },
    {
      ...snapshot,
      decisionRecoveries: [],
    },
    { ...snapshot, unknown: [] },
  ])
    assert.equal(validSnapshot(invalid, "binding-a", binding), false);
  assert.equal(JSON.stringify(snapshot), before);
  const storedProjects = snapshot.projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => {
      const {
        cleanupConfirmed: _cleanup,
        recoveryUnresolved: _unresolved,
        ...record
      } = task;
      return {
        ...record,
        settlement: { kind: "pending" as const },
      };
    }),
  }));
  const { managedExecutions: _emptyManaged, ...emptyDefinitionFixture } =
    emptyExecutionStateSnapshot();
  const unified = {
    ...emptyDefinitionFixture,
    repositoryBindingId: snapshot.repositoryBindingId,
    intakeEpoch: snapshot.intakeEpoch,
    intakeBindings: snapshot.intakeBindings,
    queueEntries: snapshot.queueEntries,
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
    decodeStateSnapshot(
      Buffer.from(
        `${encodeStateValue(createManagedRuntimeSnapshotFixture(value))}\n`,
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
    `${encodeStateValue(createManagedRuntimeSnapshotFixture(unified))}\n`,
  );
  const stateCandidate = prepareUnifiedTaskSnapshot(
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
    `${encodeStateValue({
      ...canonical,
      projects: [coreBefore, managedDefinition, coreAfter],
    })}\n`,
  );
  const mixed = decodeStateSnapshot(mixedBytes, binding);
  assert.ok(mixed, "Coreのみの定義と管理実行が同じ正本へ共存する");
  assert.equal(mixed.projects.length, 1, "Coreに偽の管理実行を投影しない");
  const mixedCandidate = prepareUnifiedTaskSnapshot(
    mixedBytes,
    stateUpdate,
    1,
    binding,
  );
  assert.ok(mixedCandidate);
  const mixedUpdated = decodeStateSnapshot(mixedCandidate, binding);
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
    prepareUnifiedTaskSnapshot(unifiedBytes, changed, 1, binding),
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
  assert.deepEqual(decodeStateSnapshot(stateCandidate, binding)?.projects, [
    stateUpdate,
  ]);
  assert.equal(
    prepareUnifiedTaskSnapshot(unifiedBytes, stateUpdate, 0, binding),
    null,
  );
  assert.equal(
    prepareUnifiedTaskSnapshot(unifiedBytes, stateUpdate, 2, binding),
    null,
  );
  const storedTask = storedProjects[0]?.tasks[0];
  assert.ok(storedTask);
  for (const patch of [
    { cleanupConfirmed: false },
    { recoveryUnresolved: false },
    { resultAcceptances: [] },
    { resultAcceptanceIds: [] },
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
  const recoveredTask = {
    ...storedTask,
    state: "recovery_required",
    attemptId: "attempt-old",
    operationId: "operation-old",
    authorityBindingId: "authority-old",
    startPhase: "settled",
    settlement: {
      kind: "executor_result",
      cleanupConfirmed: true,
      recoveryUnresolved: false,
    },
    recoveryObligations: [
      {
        kind: "docker",
        recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
        phase: "settled",
      },
    ],
  };
  const recovered = createManagedRuntimeSnapshotFixture({
    ...unified,
    projects: [{ ...storedProjects[0], tasks: [recoveredTask] }],
  });
  const recoveredBytes = Buffer.from(`${encodeStateValue(recovered)}\n`);
  assert.ok(decodeStateSnapshot(recoveredBytes, binding));
  const retryReady = createManagedRuntimeSnapshotFixture({
    ...unified,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: createHash("sha256").update(recoveredBytes).digest("hex"),
    },
    projects: [
      {
        ...storedProjects[0],
        generation: 2,
        tasks: [
          {
            ...recoveredTask,
            state: "ready",
            attemptId: null,
            operationId: null,
            authorityBindingId: null,
            startPhase: "none",
            candidateId: null,
            retryCount: recoveredTask.retryCount + 1,
          },
        ],
      },
    ],
  });
  assert.equal(
    validateUnifiedTransition(
      recoveredBytes,
      Buffer.from(`${encodeStateValue(retryReady)}\n`),
      binding,
    ),
    true,
    "確定済みの回復義務は再試行の実行IDリセット後も保持できる",
  );
  const retryDecoded = decodeStateSnapshot(
    Buffer.from(`${encodeStateValue(retryReady)}\n`),
    binding,
  );
  assert.ok(retryDecoded);
  const forgedRetry = {
    ...retryDecoded.snapshot,
    managedExecutions: retryDecoded.snapshot.managedExecutions.map(
      (project) => ({
        ...project,
        tasks: project.tasks.map((task) => ({
          ...task,
          operationId: "other-operation",
        })),
      }),
    ),
  };
  assert.equal(
    validateUnifiedTransition(
      recoveredBytes,
      Buffer.from(`${encodeStateValue(forgedRetry)}\n`),
      binding,
    ),
    false,
    "実行IDの任意付替えを正規retryとして認めない",
  );
  const withReceipt = { ...unified };
  assert.ok(decodeUnified(withReceipt));
  const receiptBytes = Buffer.from(
    `${encodeStateValue(createManagedRuntimeSnapshotFixture(withReceipt))}\n`,
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
    validateUnifiedTransition(
      receiptBytes,
      Buffer.from(
        `${encodeStateValue(createManagedRuntimeSnapshotFixture(retry))}\n`,
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
              resultAcceptanceIds: [],
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
      validateUnifiedTransition(
        receiptBytes,
        Buffer.from(`${encodeStateValue({ ...retry, resultReceipts })}\n`),
        binding,
      ),
      false,
    );
  }
});

/**
 * 一次診断の追加観測を保存契約の実本文で反証する。
 * @trace PRL-UT-006
 * @precondition 合成値と実Validatorだけを使用する。
 * @stimulus 新旧正常形、欠測・過剰field・不正数値・応答相関違反。
 * @observation 実Validatorの真偽。
 * @oracle 旧形と正常形のみ受理し、不正値をゼロへ丸めない。
 * @cleanup N/A: 外部Effectなし。
 * @responsibility 一次失敗のCommand観測を閉じた数値と応答有無へ相関する。
 * @boundary EMの実モデル検査。ProcessやDocker要求はない。
 */
test("一次失敗のCommand観測は閉じた数値契約と応答相関を検査する", () => {
  const validate = validPrimaryFailure;
  const base = {
    purpose: "start_provider_attached",
    stage: "execution_classification",
    reason: "provider_process_exit_nonzero",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
  };
  const observation = { exitCode: 1, stdoutBytes: 12, stderrBytes: 7 };
  const authentication = {
    ...base,
    purpose: "start_subscription_auth_probe_attached",
    commandObservation: observation,
  };
  const nonce = "a".repeat(64);
  const identity = "b".repeat(64);
  const turnFailure = {
    ...base,
    stage: "provider_result_normalization",
    reason: "workbench_ai_claude_turn_count_invalid",
    commandObservation: { exitCode: 0, stdoutBytes: 20, stderrBytes: 0 },
  };
  const turnDiagnostics = [
    ...["missing", "null", "boolean", "string", "array", "object"].map(
      (valueType) => ({ valueType, numberText: null }),
    ),
    ...["0", "3", "1.5", null].map((numberText) => ({
      valueType: "number",
      numberText,
    })),
  ];
  const primaryFailures = [
    ...["confirmed", "unconfirmed", "unknown"].map((authenticationStatus) => ({
      ...authentication,
      reason: "docker_setup_start_subscription_auth_probe_attached_failed",
      authenticationStatus,
    })),
    ...turnDiagnostics.map((turnCountDiagnostic) => ({
      ...turnFailure,
      turnCountDiagnostic,
    })),
  ];
  for (const primaryFailure of primaryFailures) {
    const summary = {
      schema: "crdd-execution-model/operation-summary/v5",
      recoveryCorrelationId: "request-synthetic",
      operationId: "OP-123456",
      operationNonce: nonce,
      identitySha256: identity,
      recoveryId: `docker-task.${"c".repeat(64)}.${nonce}.${identity}`,
      primaryFailure,
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "disabled",
        workspaceReusable: false,
      },
      outcome: {
        status: "blocked",
        reason: "docker_setup_start_subscription_auth_probe_attached_failed",
        cleanupConfirmed: true,
      },
      hostCleanup: "confirmed",
      lease: "released",
    };
    const line = `${encodeStateValue({ schema: "crdd-coordinator/history-row/v2", occurredAt: "2026-10-25T00:00:00.000Z", summary })}\n`;
    const decoded = decodeHistoryRows(Buffer.from(line));
    assert.ok(decoded);
    assert.deepEqual(
      JSON.parse(decoded[0]?.line ?? "null").summary.primaryFailure,
      primaryFailure,
    );
  }
  for (const turnCountDiagnostic of turnDiagnostics)
    assert.equal(validate({ ...turnFailure, turnCountDiagnostic }), true);
  for (const value of [
    {
      ...turnFailure,
      turnCountDiagnostic: { valueType: "secret", numberText: null },
    },
    ...[1, 2, "1", "2", "03", " 3", "Infinity", Infinity, NaN, "secret"].map(
      (numberText) => ({
        ...turnFailure,
        turnCountDiagnostic: { valueType: "number", numberText },
      }),
    ),
    {
      ...turnFailure,
      turnCountDiagnostic: { valueType: "string", numberText: 3 },
    },
    {
      ...turnFailure,
      turnCountDiagnostic: {
        valueType: "missing",
        numberText: null,
        raw: "secret",
      },
    },
    ...[
      { purpose: "create_provider" },
      { stage: "execution_classification" },
      { reason: "provider_process_exit_nonzero" },
      { responseObserved: false },
      { commandObservation: null },
    ].map((change) => ({
      ...turnFailure,
      ...change,
      turnCountDiagnostic: { valueType: "number", numberText: 3 },
    })),
  ])
    assert.equal(validate(value), false);
  for (const authenticationStatus of ["confirmed", "unconfirmed", "unknown"])
    assert.equal(
      validate(
        JSON.parse(JSON.stringify({ ...authentication, authenticationStatus })),
      ),
      true,
    );
  for (const value of [
    { ...authentication, authenticationStatus: "invalid" },
    { ...authentication, authenticationStatus: undefined },
    {
      ...authentication,
      authenticationStatus: "confirmed",
      responseObserved: false,
    },
    {
      ...authentication,
      authenticationStatus: "confirmed",
      commandObservation: null,
    },
    {
      ...authentication,
      authenticationStatus: "confirmed",
      commandObservation: { ...observation, exitCode: null },
    },
    {
      ...base,
      commandObservation: observation,
      authenticationStatus: "confirmed",
    },
  ])
    assert.equal(validate(value), false);
  for (const value of [
    base,
    { ...base, commandObservation: null },
    { ...base, commandObservation: observation },
    { ...base, commandObservation: { ...observation, exitCode: null } },
  ])
    assert.equal(validate(value), true);
  for (const value of [
    undefined,
    {},
    { ...observation, extra: 1 },
    { stdoutBytes: 12, stderrBytes: 7 },
    ...[-1, 0.5, Infinity, NaN, "1"].flatMap((n) => [
      { ...observation, stdoutBytes: n },
      { ...observation, stderrBytes: n },
      { ...observation, exitCode: n },
    ]),
  ])
    assert.equal(validate({ ...base, commandObservation: value }), false);
  assert.equal(
    validate({
      ...base,
      responseObserved: false,
      commandObservation: observation,
    }),
    false,
  );
});
