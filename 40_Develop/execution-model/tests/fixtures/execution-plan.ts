/**
 * 試験が明示する一Task計画の合成値を構築する。
 * @packageDocumentation
 * @responsibility 旧fixture本文を新形式で表す。製品の互換受付には使用しない。
 * @trace PPR-UT-006
 * @level UT
 * @scope 試験専用データ。
 * @boundary 保存・外部実行なし。
 */
import type { ObjectivePlan } from "../../src/index.ts";
import {
  PROJECT_STATE_CONTRACT,
  type ProjectExecutionInitialization,
  type ProjectExecutionState,
  type TaskExecutionSelections,
} from "../../src/index.ts";

/**
 * 他Owner試験の既知の開始予約済み状態を用意する。
 * @responsibility 予約の可否を検査せず指定Taskの合成前提だけを構築する。
 * @trace PRL-UT-006
 * @invariant このfixtureの成功を製品受付・保存・Authorityの成立に数えない。
 */
export function taskStartFixture(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  authorityBindingId: string,
):
  | Readonly<{
      status: "completed";
      reason: string;
      state: ProjectExecutionState;
      taskIds: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      state: ProjectExecutionState | null;
      taskIds: readonly string[];
    }> {
  const captured = structuredClone(state);
  const objectiveId = captured.tasks.find(
    (task) => task.definition.id === taskId,
  )?.definition.objectiveId;
  return {
    status: "completed" as const,
    reason: "fixture_task_start",
    taskIds: [taskId],
    state: {
      ...captured,
      generation: expectedGeneration + 1,
      milestone: {
        ...captured.milestone,
        state:
          captured.milestone.state === "planned"
            ? ("executing" as const)
            : captured.milestone.state,
      },
      objectives: captured.objectives.map((entry) =>
        entry.definition.id === objectiveId && entry.state === "planned"
          ? { ...entry, state: "executing" as const }
          : entry,
      ),
      tasks: captured.tasks.map((task) =>
        task.definition.id === taskId
          ? {
              ...task,
              state: "starting" as const,
              attemptId,
              authorityBindingId,
              operationId: null,
              startPhase: "reserved" as const,
              recoveryObligations: [],
              recoveryUnresolved: false,
            }
          : task,
      ),
    },
  };
}

/**
 * 他Owner試験の既知の引渡し済み状態を用意し、製品の可否判定をしない。
 * @trace PRL-UT-006
 */
export function taskHandoffFixture(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
): ReturnType<typeof taskStartFixture> {
  const captured = structuredClone(state);
  return {
    status: "completed",
    reason: "fixture_task_handoff",
    taskIds: [taskId],
    state: {
      ...captured,
      generation: expectedGeneration + 1,
      tasks: captured.tasks.map((task) =>
        task.definition.id === taskId
          ? {
              ...task,
              attemptId,
              operationId,
              startPhase: "handoff_prepared" as const,
            }
          : structuredClone(task),
      ),
    },
  };
}

/**
 * 他Owner試験の既知の開始観測済み状態を用意し、保存や実開始を証明しない。
 * @trace PRL-UT-006
 */
export function taskStartedFixture(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
): ReturnType<typeof taskStartFixture> {
  const captured = structuredClone(state);
  return {
    status: "completed",
    reason: "fixture_task_started",
    taskIds: [taskId],
    state: {
      ...captured,
      generation: expectedGeneration + 1,
      tasks: captured.tasks.map((task) =>
        task.definition.id === taskId
          ? {
              ...task,
              attemptId,
              operationId,
              state: "running" as const,
              startPhase: "running" as const,
            }
          : structuredClone(task),
      ),
    },
  };
}

/** 既知の合成選定。Catalog解決や製品の検査を行わない。 */
export function fixtureTaskExecutionSelections(): TaskExecutionSelections {
  return {
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
  };
}

/**
 * 既知の有効な定義から実行接続試験用のStateを組み立てる。
 * @responsibility 検査・拒否・循環判定を行わず、製品コンストラクタを呼ばない。
 * @trace PRL-UT-006
 * @precondition 有効な合成定義を明示する。
 * @boundary 試験準備だけ。statusはfixture作成を表しモデルの受理証拠ではない。
 */
export function projectExecutionFixture(input: ProjectExecutionInitialization) {
  const value = structuredClone(input);
  const state = Object.freeze<ProjectExecutionState>({
    contract: PROJECT_STATE_CONTRACT,
    taskExecutionSelections: value.taskExecutionSelections,
    projectId: value.projectId,
    milestoneId: value.milestoneId,
    repositoryRevision: value.repositoryRevision,
    generation: 1,
    ownerGeneration: value.ownerGeneration,
    decisionApplicationId: null,
    maximumConcurrency: value.maximumConcurrency,
    milestone: {
      id: value.milestoneId,
      acceptanceCriteria: value.milestoneAcceptanceCriteria,
      state: "planned",
      criterionEvidenceIds: [],
    },
    objectives: value.objectives.map((definition) => ({
      definition,
      state: "planned",
      criterionEvidenceIds: [],
    })),
    tasks: value.tasks.map((definition) => ({
      definition,
      state:
        definition.dependencies.length === 0 ? "ready" : "waiting_dependency",
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
  });
  return {
    status: "completed" as const,
    reason: "fixture_state_created",
    state,
    taskIds: state.tasks.map((task) => task.definition.id),
  };
}

/** 保存済みfixtureの定義を、新規受付の有限入力として明示する。製品の互換Readerではない。 */
export function initialExecutionInput(
  state: ProjectExecutionState,
): ProjectExecutionInitialization {
  return {
    taskExecutionSelections: state.taskExecutionSelections,
    projectId: state.projectId,
    milestoneId: state.milestoneId,
    repositoryRevision: state.repositoryRevision,
    maximumConcurrency: state.maximumConcurrency,
    milestoneAcceptanceCriteria: state.milestone.acceptanceCriteria,
    objectives: state.objectives.map((item) => item.definition),
    tasks: state.tasks.map((item) => item.definition),
    ownerGeneration: state.ownerGeneration,
  };
}

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
>(input: T, supplied?: ObjectivePlan) {
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
