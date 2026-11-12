/**
 * Domainへ移管した実行計画の値境界を検証する。
 * @packageDocumentation
 * @responsibility 閉形式、Path範囲、不変Snapshotと実行依存の非要求を確認する。
 * @trace PPR-UT-006
 * @level UT
 * @scope Domainの実行依頼定義。外部Process・保存・AI・Dockerは使用しない。
 * @boundary Process内の不変値だけを扱う。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectCoordinatorObjectiveRequest,
  inspectCoordinatorProjection,
  inspectExecutionPlan,
  normalizeRepositoryRelativePath,
} from "../../../src/index.ts";
import {
  inspectExecutionPlanDefinition,
  inspectRuntimePlanDefinition,
  inspectRuntimeProjectDefinition,
} from "../../../src/objective/validation.ts";
import {
  repositoryPathWithin,
  snapshotRuntimeStateRecord,
} from "../../../src/state/validation.ts";

/**
 * 共通Record取得の一正本化で受理集合と無実行境界を変えない。
 * @responsibility 普通／null prototype、閉Key集合、getter／Proxyを独立に対照する。
 * @trace PPR-UT-006
 * @precondition 合成値と明示したKey集合だけを渡す。
 * @stimulus 正規・空・未知／欠測・非列挙・symbol・accessor・ProxyとKey集合不正を与える。
 * @observation 返却値、凍結null prototype、getter／trap回数と入れ子参照。
 * @oracle 正規の浅い値だけを保持し、不正値をnullとする。入れ子の取得や再解釈はしない。
 * @cleanup N/A: 値だけ。
 * @boundary 共通値取得だけ。Schema・認可・物理保存の成立は確認しない。
 */
test("Record Snapshotは旧二実装の受理集合と無実行境界を維持する", () => {
  let effects = 0;
  const nested: unknown[] = [];
  const getter = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      effects++;
      return 1;
    },
  });
  const proxy = new Proxy(
    { value: 1 },
    {
      ownKeys() {
        effects++;
        return ["value"];
      },
      get() {
        effects++;
        return 1;
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const nullPrototype = Object.assign(Object.create(null), { value: 2 });
  const cases: readonly [
    unknown,
    Readonly<Record<string, unknown>> | null,
    Readonly<Record<string, unknown>> | null,
  ][] = [
    [{ value: 1 }, { value: 1 }, null],
    [nullPrototype, { value: 2 }, null],
    [{ value: nested }, { value: nested }, null],
    [{}, null, {}],
    [null, null, null],
    [undefined, null, null],
    [0, null, null],
    ["value", null, null],
    [[], null, null],
    [getter, null, null],
    [proxy, null, null],
    [revoked.proxy, null, null],
    [Object.assign(Object.create({ custom: true }), { value: 1 }), null, null],
    [{ value: 1, extra: 2 }, null, null],
    [
      Object.defineProperty({}, "value", { value: 1, enumerable: false }),
      null,
      null,
    ],
    [{ value: 1, [Symbol("extra")]: 2 }, null, null],
  ];
  const keySets: readonly [unknown, "exact" | "empty" | "invalid"][] = [
    [new Set(["value"]), "exact"],
    [new Set(), "empty"],
    [null, "invalid"],
    [undefined, "invalid"],
    [0, "invalid"],
    [{}, "invalid"],
    [
      {
        size: 1,
        has: () => true,
        *[Symbol.iterator]() {
          yield "value";
        },
      },
      "exact",
    ],
    [new Proxy(new Set(["value"]), {}), "invalid"],
  ];
  for (const [value, exact, empty] of cases) {
    for (const [keys, kind] of keySets) {
      const actual = Reflect.apply(snapshotRuntimeStateRecord, null, [
        value,
        keys,
      ]);
      const expected =
        kind === "exact" ? exact : kind === "empty" ? empty : null;
      assert.deepEqual(
        actual,
        expected === null ? null : Object.assign(Object.create(null), expected),
      );
      if (actual !== null) {
        assert.equal(Object.getPrototypeOf(actual), null);
        assert.equal(Object.isFrozen(actual), true);
        if (exact?.value === nested && kind === "exact")
          assert.equal(actual.value, nested);
      }
    }
  }
  assert.equal(effects, 0);
  assert.equal(Object.isFrozen(nested), false);
});

/**
 * planでDomainへ移管した実行計画の値境界を検証する。。
 * @responsibility planでDomainへ移管した実行計画の値境界を検証する。
 * @trace PPR-UT-006
 * @precondition Domainの実行依頼定義。外部Process・保存・AI・Dockerは使用しない。
 * @stimulus planでDomainへ移管した実行計画の値境界を検証する。。
 * @observation 構築した候補、有限応答または検出した例外。
 * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
 * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
 * @boundary Process内の不変値だけを扱う。
 */
function plan() {
  return {
    milestoneAcceptanceCriteria: ["全体の確認"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["集約の確認"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["src/code.ts"],
        conflictKeys: ["source"],
      },
    ],
  };
}

/**
 * 旧容量を超える計画を入力・保存定義・公開投影へ接続する。
 * @responsibility 件数と本文量による拒否だけを撤去し、相関と形式の拒否を維持する。
 * @trace PPR-UT-006
 * @precondition 129 Objectiveと1025 Taskの一意な合成計画を用意する。
 * @stimulus 長い本文・129 Path・受入条件と対応する公開投影を検査する。
 * @observation 返却配列長、全文、相関不正と安全整数境界の拒否。
 * @oracle 旧上限超過は受理し、欠測・重複・参照不正・制御文字・範囲逸脱は拒否する。
 * @cleanup N/A: メモリ内の値のみ。
 * @boundary Domainの公開純粋入力・投影。
 */
test("計画と公開投影は旧件数と本文容量を超えても相関を検査する", () => {
  const paths = Array.from({ length: 129 }, (_, index) => `src/path-${index}`);
  const longPath = `src/${"part/".repeat(110)}file.ts`;
  paths.push(longPath);
  const criteria = Array.from(
    { length: 129 },
    (_, index) => `${index}:${"確認".repeat(2049)}`,
  );
  const largePlan = {
    milestoneAcceptanceCriteria: criteria,
    objectives: Array.from({ length: 129 }, (_, index) => ({
      id: `objective-${index}`,
      acceptanceCriteria: criteria,
    })),
    tasks: Array.from({ length: 1025 }, (_, index) => ({
      id: `task-${index}`,
      objectiveId: `objective-${index % 129}`,
      dependencies: [],
      allowedPaths: index === 0 ? paths : ["src/path-0"],
      conflictKeys: [],
    })),
  };
  const validated = inspectExecutionPlan(largePlan, { allowedPaths: paths });
  assert.equal(validated?.objectives.length, 129);
  assert.equal(validated?.tasks.length, 1025);
  assert.equal(normalizeRepositoryRelativePath(longPath), longPath);
  const request = {
    intakeEpoch: "epoch-a",
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    objective: "説明".repeat(16385),
    plan: largePlan,
    taskInputs: largePlan.tasks.map((task) => ({
      taskId: task.id,
      objective: "作業".repeat(16385),
      acceptanceCriteria: ["完了条件"],
      readPaths: ["src/path-0"],
    })),
    acceptanceCriteria: criteria,
    allowedPaths: paths,
    readPaths: paths,
    maximumConcurrency: 5,
    maximumReplans: 32,
    originLane: "interactive",
    adoptResult: false,
  };
  const accepted = inspectCoordinatorObjectiveRequest(request);
  assert.equal(accepted?.objective, request.objective);
  assert.equal(accepted?.taskInputs.length, 1025);
  assert.equal(
    accepted?.taskInputs[1024]?.objective,
    request.taskInputs[1024]?.objective,
  );
  for (const invalid of [
    { ...request, objective: "" },
    { ...request, objective: "invalid\0text" },
    { ...request, allowedPaths: [...paths, paths[0]] },
    { ...request, readPaths: ["../outside"] },
    { ...request, taskInputs: request.taskInputs.slice(1) },
    { ...request, maximumConcurrency: 6 },
    { ...request, maximumReplans: 33 },
  ])
    assert.equal(inspectCoordinatorObjectiveRequest(invalid), null);
  const objectiveCounts = {
    planned: 129,
    executing: 0,
    integration_pending: 0,
    accepted: 0,
    returned: 0,
    blocked: 0,
    cancelled: 0,
  };
  const taskCounts = {
    planned: 0,
    waiting_dependency: 0,
    ready: 1025,
    starting: 0,
    running: 0,
    cleanup_pending: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    recovery_required: 0,
    superseded: 0,
  };
  const projection = {
    projectId: "project-a",
    milestoneId: "milestone-a",
    generation: 1,
    milestoneState: "planned",
    objectiveCounts,
    taskCounts,
    objectiveTaskSummaries: largePlan.objectives.map((objective) => ({
      objectiveId: objective.id,
      objectiveState: "planned",
      taskCounts: {
        ...taskCounts,
        ready: largePlan.tasks.filter(
          (task) => task.objectiveId === objective.id,
        ).length,
      },
    })),
    workProgress: "not_started",
    qualityState: "not_evaluated",
    humanDecisionRequired: false,
    recoveryRequired: false,
    nextAction: "schedule_task",
  };
  assert.equal(
    inspectCoordinatorProjection(projection)?.taskCounts.ready,
    1025,
  );
  for (const ready of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      inspectCoordinatorProjection({
        ...projection,
        taskCounts: { ...taskCounts, ready },
      }),
      null,
    );
  assert.equal(
    inspectCoordinatorProjection({
      ...projection,
      taskCounts: { ...taskCounts, ready: Number.MAX_SAFE_INTEGER, running: 1 },
    }),
    null,
  );
  assert.equal(
    inspectCoordinatorProjection({
      ...projection,
      objectiveTaskSummaries: projection.objectiveTaskSummaries.slice(1),
    }),
    null,
  );
});

/**
 * 一般CRUDの中間定義と実行受付を混同しない。
 * @trace PPR-UT-006
 * @precondition 実行設定や外部資源を持たない値だけを使う。
 * @stimulus 空計画、Task作成前、未割当Objective、完成計画を検査する。
 * @observation Core検査と実行受付の返却値。
 * @oracle 作成途中はCoreだけが受理し、完全定義だけが実行受付を通る。
 * @cleanup 局所値のみ。
 * @boundary 保存や実行開始は行わない。
 * @responsibility Coreの作成途中の計画は実行開始可能な計画ではない
 */
test("Coreの作成途中の計画は実行開始可能な計画ではない", () => {
  const complete = plan();
  const drafts = [
    { ...complete, objectives: [], tasks: [] },
    { ...complete, tasks: [] },
    {
      ...complete,
      objectives: [
        ...complete.objectives,
        { id: "objective-b", acceptanceCriteria: ["未割当"] },
      ],
    },
  ];
  for (const draft of drafts) {
    const core = inspectRuntimePlanDefinition(draft);
    assert.ok(core);
    assert.ok(Object.isFrozen(core));
    assert.equal(inspectExecutionPlanDefinition(draft), null);
    assert.equal(inspectExecutionPlan(draft, { allowedPaths: ["src"] }), null);
  }
  assert.ok(inspectRuntimePlanDefinition(complete));
  assert.ok(inspectExecutionPlanDefinition(complete));
  assert.ok(inspectExecutionPlan(complete, { allowedPaths: ["src"] }));
});

/**
 * Coreの中間保存でも既存の構造検査を維持する。
 * @trace PPR-UT-006
 * @precondition 不正参照・重複・循環の値を作る。
 * @stimulus Core検査と実行受付へ同じ反例を渡す。
 * @observation 両方のnull結果。
 * @oracle 未完成を許しても不正な定義は受理しない。
 * @cleanup 局所値のみ。
 * @boundary 純粋な値検査。
 * @responsibility Coreと実行受付は不正参照・重複・循環を共に拒否する
 */
test("Coreと実行受付は不正参照・重複・循環を共に拒否する", () => {
  const complete = plan();
  const task = complete.tasks[0];
  assert.ok(task);
  const invalid = [
    { ...complete, objectives: [] },
    {
      ...complete,
      objectives: [...complete.objectives, ...complete.objectives],
    },
    { ...complete, tasks: [task, task] },
    { ...complete, tasks: [{ ...task, dependencies: ["absent"] }] },
    { ...complete, tasks: [{ ...task, dependencies: [task.id] }] },
    { ...complete, tasks: [{ ...task, allowedPaths: ["../outside"] }] },
    { ...complete, tasks: Array.from({ length: 1025 }, () => task) },
  ];
  for (const value of invalid) {
    assert.equal(inspectRuntimePlanDefinition(value), null);
    assert.equal(inspectExecutionPlanDefinition(value), null);
    assert.equal(inspectExecutionPlan(value, { allowedPaths: ["src"] }), null);
  }
});

/**
 * 新Project形式の保存値は実行設定を要求しない。
 * @trace PPR-UT-006
 * @precondition 空のCore定義と既存形式の判断値だけを用意する。
 * @stimulus 定義を検査し、未知技術field・不正ID・改訂・Getterを渡す。
 * @observation 不変のCore値、拒否結果と副作用件数。
 * @oracle 実行Ownerを補完せず、不正値を実行しない。
 * @cleanup 局所値のみ。
 * @boundary 型・値境界だけ。保存先や本番Schemaの切替を証明しない。
 * @responsibility Core Projectの新形式は実行資格なしで固定し未知値を拒否する
 */
test("Core Projectの新形式は実行資格なしで固定し未知値を拒否する", () => {
  const input = {
    contract: "crdd-domain/project-state/v1",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "a".repeat(40),
    generation: 1,
    decisionApplicationId: null,
    milestone: {
      id: "milestone-a",
      acceptanceCriteria: ["完了条件"],
      state: "planned",
      criterionEvidenceIds: [],
    },
    objectives: [],
    tasks: [],
  };
  const result = inspectRuntimeProjectDefinition(input);
  assert.ok(result);
  assert.ok(Object.isFrozen(result.milestone));
  assert.equal(Object.hasOwn(result, "ownerGeneration"), false);
  assert.equal(Object.hasOwn(result, "taskExecutionSelections"), false);
  input.milestone.acceptanceCriteria[0] = "変更";
  assert.deepEqual(result.milestone.acceptanceCriteria, ["完了条件"]);
  for (const invalid of [
    { ...input, ownerGeneration: "owner" },
    { ...input, projectId: "../bad" },
    { ...input, generation: 0 },
    { ...input, repositoryRevision: "bad" },
    { ...input, milestone: { ...input.milestone, id: "other" } },
    { ...input, contract: "crdd-coordinator/project-state/v2" },
  ])
    assert.equal(inspectRuntimeProjectDefinition(invalid), null);
  let effects = 0;
  assert.equal(
    inspectRuntimeProjectDefinition({
      ...input,
      milestone: {
        ...input.milestone,
        state: {
          toString() {
            effects++;
            return "planned";
          },
        },
      },
    }),
    null,
  );
  const accessor = Object.defineProperty({ ...input }, "tasks", {
    enumerable: true,
    get() {
      effects++;
      return [];
    },
  });
  assert.equal(inspectRuntimeProjectDefinition(accessor), null);
  assert.equal(
    inspectRuntimeProjectDefinition(
      new Proxy(input, {
        ownKeys() {
          effects++;
          return [];
        },
      }),
    ),
    null,
  );
  assert.equal(effects, 0);
});

/**
 * 設定・Provider・実行状態なしで定義を固定する。
 * @trace PPR-UT-006
 * @precondition 通常のデータだけを構築する。
 * @stimulus 計画を検査後、元入力を変更する。
 * @observation 計画の値と各配列の凍結状態。
 * @oracle 三層の条件は混同されず、元入力の変更を含まない。
 * @cleanup 局所値だけ。資源を作らない。
 * @boundary 純粋な値検査。
 * @responsibility Domainは実行設定なしで計画を不変Snapshotへ固定する
 */
test("Domainは実行設定なしで計画を不変Snapshotへ固定する", () => {
  const input = plan();
  const result = inspectExecutionPlan(input, { allowedPaths: ["src"] });
  assert.ok(result);
  const inputTask = input.tasks[0];
  const inputObjective = input.objectives[0];
  const task = result.tasks[0];
  const objective = result.objectives[0];
  assert.ok(inputTask && inputObjective && task && objective);
  inputTask.allowedPaths[0] = "changed";
  inputObjective.acceptanceCriteria[0] = "changed";
  assert.deepEqual(task.allowedPaths, ["src/code.ts"]);
  assert.deepEqual(objective.acceptanceCriteria, ["集約の確認"]);
  assert.deepEqual(result.milestoneAcceptanceCriteria, ["全体の確認"]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.tasks));
  assert.ok(Object.isFrozen(task));
  assert.ok(Object.isFrozen(task.allowedPaths));
});

/**
 * 未信頼値を実行せず、境界外・未知属性を拒否する。
 * @trace PPR-UT-006
 * @precondition GetterとProxyを持つ負例を構築する。
 * @stimulus 計画とScopeの検査を実行する。
 * @observation nullと副作用カウンタ。
 * @oracle Getter／Proxyは呼ばれず、許可範囲を拡大しない。
 * @cleanup 局所値のみ。
 * @boundary 入力Objectの境界。
 * @responsibility Domainの計画検査はAccessor・Proxy・未知field・範囲外を拒否する
 */
test("Domainの計画検査はAccessor・Proxy・未知field・範囲外を拒否する", () => {
  let effects = 0;
  const scope = {
    get allowedPaths() {
      effects++;
      return ["src"];
    },
  };
  assert.equal(inspectExecutionPlan(plan(), scope), null);
  const proxy = new Proxy(plan(), {
    ownKeys() {
      effects++;
      return [];
    },
  });
  assert.equal(inspectExecutionPlan(proxy, { allowedPaths: ["src"] }), null);
  assert.equal(inspectRuntimePlanDefinition(proxy), null);
  const accessor = Object.defineProperty(plan(), "tasks", {
    enumerable: true,
    get() {
      effects++;
      return [];
    },
  });
  assert.equal(inspectRuntimePlanDefinition(accessor), null);
  assert.equal(inspectRuntimePlanDefinition({ ...plan(), extra: true }), null);
  assert.equal(
    inspectExecutionPlan({ ...plan(), extra: true }, { allowedPaths: ["src"] }),
    null,
  );
  const input = plan();
  const task = input.tasks[0];
  assert.ok(task);
  task.allowedPaths = ["src-other/code.ts"];
  assert.equal(inspectExecutionPlan(input, { allowedPaths: ["src"] }), null);
  task.allowedPaths = ["src/../secret"];
  assert.equal(inspectExecutionPlan(input, { allowedPaths: ["src"] }), null);
  assert.equal(effects, 0);
});

/**
 * 移管前の文字列比較規則を確認する。
 * @trace PPR-UT-006
 * @precondition Filesystemを参照しない。
 * @stimulus 相対Pathの正常・境界・不正値を渡す。
 * @observation 正規化文字列と包含判定。
 * @oracle Segment境界と既存の大小文字規則を維持する。
 * @cleanup 局所値のみ。
 * @boundary Path文字列だけ。Symlink保護の証明ではない。
 * @responsibility Repository Pathは文字列のSegment境界と従来規則を保つ
 */
test("Repository Pathは文字列のSegment境界と従来規則を保つ", () => {
  assert.equal(normalizeRepositoryRelativePath("src\\code.ts"), "src/code.ts");
  for (const value of ["", "../src", "/src", "C:/src", "src/./x", "src//x"]) {
    assert.equal(normalizeRepositoryRelativePath(value), null);
  }
  assert.equal(repositoryPathWithin("SRC/code.ts", ["src"]), true);
  assert.equal(repositoryPathWithin("src-other/code.ts", ["src"]), false);
});
