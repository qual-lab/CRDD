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
  inspectExecutionPlan,
  normalizeRepositoryRelativePath,
} from "../../../src/index.ts";
import { repositoryPathWithin } from "../../../src/repository/path.ts";
import {
  inspectExecutionPlanDefinition,
  inspectRuntimePlanDefinition,
  inspectRuntimeProjectDefinition,
} from "../../../src/objective/validation.ts";

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
 * 一般CRUDの中間定義と実行受付を混同しない。
 * @trace PPR-UT-006
 * @precondition 実行設定や外部資源を持たない値だけを使う。
 * @stimulus 空計画、Task作成前、未割当Objective、完成計画を検査する。
 * @observation Core検査と実行受付の返却値。
 * @oracle 作成途中はCoreだけが受理し、完全定義だけが実行受付を通る。
 * @cleanup 局所値のみ。
 * @boundary 保存や実行開始は行わない。
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
 * @precondition 不正参照・重複・循環・上限超過の値を作る。
 * @stimulus Core検査と実行受付へ同じ反例を渡す。
 * @observation 両方のnull結果。
 * @oracle 未完成を許しても不正な定義は受理しない。
 * @cleanup 局所値のみ。
 * @boundary 純粋な値検査。
 */
test("Coreと実行受付は不正参照・重複・循環・上限超過を共に拒否する", () => {
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
 */
test("Repository Pathは文字列のSegment境界と従来規則を保つ", () => {
  assert.equal(normalizeRepositoryRelativePath("src\\code.ts"), "src/code.ts");
  for (const value of ["", "../src", "/src", "C:/src", "src/./x", "src//x"]) {
    assert.equal(normalizeRepositoryRelativePath(value), null);
  }
  assert.equal(repositoryPathWithin("SRC/code.ts", ["src"]), true);
  assert.equal(repositoryPathWithin("src-other/code.ts", ["src"]), false);
});
