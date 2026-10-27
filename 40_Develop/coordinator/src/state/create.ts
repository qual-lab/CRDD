/**
 * Task・Objectiveを相関した初期状態を純粋に構築する。
 * @responsibility Task・Objectiveを相関した初期状態を純粋に構築する。
 * @trace ARCH-000004
 * @boundary Coordinatorの状態値と意味Owner。
 * @security 保存・外部実行・Authorityの発行は行わない。
 */
import {
  inspectTaskExecutionSelections,
  type TaskExecutionSelections,
} from "../../../domain-model/src/index.ts";
import {
  COORDINATOR_MAXIMUM_CONCURRENCY,
  COORDINATOR_MAXIMUM_OBJECTIVES,
  COORDINATOR_MAXIMUM_TASKS,
  validIdentity,
  validRevision,
  uniqueStrings,
} from "./validation.ts";
import type { ProjectObjectiveDefinition } from "../../../domain-model/src/index.ts";
import type { ProjectTaskDefinition } from "../../../domain-model/src/index.ts";
import type { StateResult } from "./types.ts";
import { snapshotDefinition, hasCycle } from "../task/lifecycle.ts";
import { projectState } from "./projection.ts";

/**
 * Objective Definitionを所有Snapshotへ変換する。
 *
 * @responsibility Objective Definitionの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input definition: ProjectObjectiveDefinition
 * @returns ProjectObjectiveDefinition | nullを返す。
 * @precondition 「definition: ProjectObjectiveDefinition」がsnapshotObjectiveDefinitionの入力契約を満たす。
 * @postcondition snapshotObjectiveDefinitionの責務を完了した結果だけを返す。
 * @effect N/A: snapshotObjectiveDefinitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotObjectiveDefinitionは独自の失敗分岐を所有しない。
 * @invariant snapshotObjectiveDefinitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotObjectiveDefinitionはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotObjectiveDefinitionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotObjectiveDefinitionは共有非同期状態を持たない同期処理である。
 */
function snapshotObjectiveDefinition(
  definition: ProjectObjectiveDefinition,
): ProjectObjectiveDefinition | null {
  if (!validIdentity(definition.id)) return null;
  const acceptanceCriteria = uniqueStrings(
    definition.acceptanceCriteria,
    128,
    "human_text",
  );
  if (!acceptanceCriteria || acceptanceCriteria.length === 0) return null;
  return Object.freeze({ id: definition.id, acceptanceCriteria });
}

/**
 * Coordinator 状態を構築する。
 *
 * @responsibility Coordinator 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input input: Project・Milestone・改訂、上限・受入条件・Task定義・Owner世代と固定二役選定。
 * @returns StateResultを返す。
 * @precondition 新規選定は受付Ownerが解決済みで、既定値をこの関数から補完しない。
 * @postcondition createCoordinatorStateの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 選定組・Identity・定義・依存関係の不正をblockedとして返し、Stateを生成しない。
 * @invariant createCoordinatorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createCoordinatorStateはProcess内の同一Subsystemで完結する。
 * @security N/A: createCoordinatorStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createCoordinatorStateは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorState(
  input: Readonly<{
    taskExecutionSelections: TaskExecutionSelections;
    projectId: string;
    milestoneId: string;
    repositoryRevision: string;
    maximumConcurrency: number;
    milestoneAcceptanceCriteria: readonly string[];
    objectives: readonly ProjectObjectiveDefinition[];
    tasks: readonly ProjectTaskDefinition[];
    ownerGeneration: string;
  }>,
): StateResult {
  const selections = inspectTaskExecutionSelections(
    input.taskExecutionSelections,
  );
  if (
    !selections ||
    !validIdentity(input.projectId) ||
    !validIdentity(input.milestoneId) ||
    !validIdentity(input.ownerGeneration) ||
    !validRevision(input.repositoryRevision) ||
    !Number.isSafeInteger(input.maximumConcurrency) ||
    input.maximumConcurrency < 1 ||
    input.maximumConcurrency > COORDINATOR_MAXIMUM_CONCURRENCY ||
    input.tasks.length === 0 ||
    input.tasks.length > COORDINATOR_MAXIMUM_TASKS ||
    input.objectives.length === 0 ||
    input.objectives.length > COORDINATOR_MAXIMUM_OBJECTIVES
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_input_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const definitions = input.tasks.map(snapshotDefinition);
  const objectiveDefinitions = input.objectives.map(
    snapshotObjectiveDefinition,
  );
  const milestoneAcceptanceCriteria = uniqueStrings(
    input.milestoneAcceptanceCriteria,
    128,
    "human_text",
  );
  if (definitions.some((definition) => !definition)) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  if (
    objectiveDefinitions.some((definition) => !definition) ||
    !milestoneAcceptanceCriteria ||
    milestoneAcceptanceCriteria.length === 0
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_acceptance_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const completeDefinitions = definitions as readonly ProjectTaskDefinition[];
  const completeObjectiveDefinitions =
    objectiveDefinitions as readonly ProjectObjectiveDefinition[];
  const ids = new Set(completeDefinitions.map((definition) => definition.id));
  const objectiveIds = new Set(
    completeObjectiveDefinitions.map((definition) => definition.id),
  );
  if (
    ids.size !== completeDefinitions.length ||
    objectiveIds.size !== completeObjectiveDefinitions.length ||
    completeDefinitions.some(
      (definition) => !objectiveIds.has(definition.objectiveId),
    ) ||
    completeObjectiveDefinitions.some(
      (objective) =>
        !completeDefinitions.some(
          (definition) => definition.objectiveId === objective.id,
        ),
    ) ||
    completeDefinitions.some(
      (definition) =>
        definition.dependencies.includes(definition.id) ||
        definition.dependencies.some((dependency) => !ids.has(dependency)),
    ) ||
    hasCycle(completeDefinitions)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_graph_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = completeDefinitions.map((definition) =>
    Object.freeze({
      definition,
      state:
        definition.dependencies.length === 0
          ? ("ready" as const)
          : ("waiting_dependency" as const),
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      resultAcceptances: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    }),
  );
  const state = projectState({
    taskExecutionSelections: selections,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    generation: 1,
    ownerGeneration: input.ownerGeneration,
    decisionApplicationId: null,
    maximumConcurrency: input.maximumConcurrency,
    milestone: Object.freeze({
      id: input.milestoneId,
      acceptanceCriteria: milestoneAcceptanceCriteria,
      state: "planned" as const,
      criterionEvidenceIds: Object.freeze([]),
    }),
    objectives: completeObjectiveDefinitions.map((definition) =>
      Object.freeze({
        definition,
        state: "planned" as const,
        criterionEvidenceIds: Object.freeze([]),
      }),
    ),
    tasks,
  });
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_state_created",
    state,
    taskIds: Object.freeze(tasks.map((task) => task.definition.id)),
  });
}
