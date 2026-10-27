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
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  COORDINATOR_STATE_SCHEMA,
  type CoordinatorState,
  type CoordinatorUnifiedSnapshot,
  coordinatorConsumerCompletionPolicy,
  decodeRuntimeDomainSnapshot as decodeCoordinatorStateSnapshot,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  hashRuntimeProjectDefinition,
  hashRuntimeStateContent,
  prepareCoordinatorUnifiedTaskSnapshot,
  projectCoordinatorTaskSettlement,
  type RuntimeProjectDefinition,
  validateCoordinatorUnifiedTransition,
  validCoordinatorSnapshot,
} from "../../../src/index.ts";
import { createManagedRuntimeSnapshotFixture } from "../../support/runtime-state.ts";

const binding = "a".repeat(64);
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
      contract: "crdd-coordinator/project-state/v2",
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
          resultAcceptances: [],
          recoveryUnresolved: false,
          candidateId: null,
          retryCount: 0,
          supersededBy: null,
        },
      ],
    } as CoordinatorState,
  } as const;
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
