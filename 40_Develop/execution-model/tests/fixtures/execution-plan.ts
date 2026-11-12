/**
 * 試験が明示する一Task計画の合成値を構築する。
 * @packageDocumentation
 * @responsibility 旧fixture本文を新形式で表す。製品の互換受付には使用しない。
 * @trace PPR-UT-006
 * @level UT
 * @scope 試験専用データ。
 * @boundary 保存・外部実行なし。
 */
import type { CoordinatorObjectivePlan } from "../../src/index.ts";

/**
 * 一つの合成依頼へ明示Planを付ける。
 * @trace PPR-UT-006
 * @precondition Callerが試験用の指示・条件・範囲を用意している。
 * @stimulus 合成値を受ける。
 * @observation 既存属性とPlan、Task入力を返す。
 * @oracle 本文を生成せず入力値をそのまま対応付ける。
 * @cleanup 局所値のみ。
 * @boundary テストfixtureの内部。
 */
export function withCallerPlan<
  T extends {
    objective: string;
    acceptanceCriteria: readonly string[];
    allowedPaths: readonly string[];
    readPaths: readonly string[];
  },
>(input: T, supplied?: CoordinatorObjectivePlan) {
  const plan = supplied ?? {
    milestoneAcceptanceCriteria: input.acceptanceCriteria,
    objectives: [
      { id: "objective-a", acceptanceCriteria: input.acceptanceCriteria },
    ],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: input.allowedPaths,
        conflictKeys: input.allowedPaths,
      },
    ],
  };
  return {
    ...input,
    plan,
    taskInputs: plan.tasks.map((task) => ({
      taskId: task.id,
      objective: input.objective,
      acceptanceCriteria: input.acceptanceCriteria,
      readPaths: input.readPaths,
    })),
  };
}
