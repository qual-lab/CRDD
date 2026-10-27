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
