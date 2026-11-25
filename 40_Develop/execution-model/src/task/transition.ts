/** Task・Queueに関する純粋な遷移、関連付けと開始候補を所有する。 @trace ARCH-000008 */
import type { ProjectMilestoneState } from "../objective/types.ts";
import { hasTaskDependencyCycle } from "../objective/validation.ts";
import {
  encodeStateValue,
  normalizeRepositoryRelativePath,
  snapshotStateArray,
  snapshotStateRecord,
  validId,
} from "../composition/validation.ts";
import type {
  ExecutionStateSnapshot,
  ProjectExecutionState,
} from "../composition/types.ts";
import type {
  ProjectTaskDefinition,
  ProjectTaskRecord,
  ProjectTaskRecoveryKind,
  ProjectTaskRecoveryObligation,
  ProjectTaskState,
  TaskExecutionUpdate,
  TaskStartCandidates,
} from "./types.ts";
import { validResultReference } from "./validation.ts";

/**
 * Taskの公開値から保存する元事実・参照だけを組み立てる。
 * @responsibility 全Projectの受領を一度保持し、Operationと配送待ちを同じ候補から除く。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 検証済み元版、states: 業務候補、facts: 発生元が明示した同Attemptの結果不明。
 * @returns 保存区画、又は不正入力のnull。
 * @precondition 呼出し側が業務遷移・現在Ownerを照合する。
 * @postcondition 投影値をTask固有の元事実へ書き戻さない。
 * @effect N/A: 同期の値変換のみ。
 * @failure 孤立・重複・別Scopeの事実と受領差替えは拒否する。
 * @invariant 受領Hash・Docker義務phaseを複製しない。
 * @boundary Task公開値と単一保存値。
 * @security 値の成立は実資源・受領Authorityを証明しない。
 * @concurrency N/A: 保存排他は呼出し側が所有する。
 */
export function associateTaskOperations(
  snapshot: ExecutionStateSnapshot,
  operations: ExecutionStateSnapshot["operations"],
): ExecutionStateSnapshot["managedExecutions"] {
  if (
    !snapshot.managedExecutions.some((project) =>
      project.tasks.some((task) => task.operationId !== null),
    )
  )
    return snapshot.managedExecutions.map((project) => ({
      ...project,
      tasks: [...project.tasks],
    }));
  const recoveryIdsByTask = new Map<string, string[]>();
  for (const operation of operations) {
    if (operation.kind !== "docker_task") continue;
    const identity = JSON.parse(operation.identityJson);
    const taskId = identity.recoveryCorrelationId ?? identity.operationId;
    const ids = recoveryIdsByTask.get(taskId);
    if (ids) ids.push(operation.recoveryId);
    else recoveryIdsByTask.set(taskId, [operation.recoveryId]);
  }
  return snapshot.managedExecutions.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => {
      if (task.operationId === null) return task;
      const recoveryIds = recoveryIdsByTask.get(task.operationId);
      if (!recoveryIds) return task;
      return {
        ...task,
        settlement: {
          kind: "operations" as const,
          recoveryIds: [...recoveryIds],
          resultUnresolved:
            task.settlement.kind === "operations"
              ? task.settlement.resultUnresolved
              : task.settlement.kind === "executor_result" &&
                task.settlement.recoveryUnresolved,
        },
      };
    }),
  }));
}

/**
 * 同じProject状態から並列枠と競合予約を含む開始候補を観測する。
 * @responsibility 定義順・未回収資源・PathとConflict Keyの規則を一正本にする。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 返却値は非永続の観測であり実行Authorityではない。
 */
export function observeTaskStartCandidates(
  state: ProjectExecutionState,
): TaskStartCandidates {
  return Object.freeze({
    projectId: state.projectId,
    ...(state.queueId === undefined ? {} : { queueId: state.queueId }),
    generation: state.generation,
    taskIds: selectSchedulableProjectTasks(state),
  });
}

/** 再計画定義の既存Path・重複条件を独立した値へ捕捉する。 @trace ARCH-000004、ARCH-000008 */
function captureReplanTaskDefinition(
  definition: ProjectTaskDefinition,
): ProjectTaskDefinition | null {
  if (!validId(definition.id) || !validId(definition.objectiveId)) return null;
  const capture = (values: readonly string[], isPath = false) => {
    const items: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      if (typeof value !== "string" || value.length === 0) return null;
      const normalized = isPath
        ? normalizeRepositoryRelativePath(value)
        : value.replaceAll("\\", "/");
      if (normalized === null || seen.has(normalized.toUpperCase()))
        return null;
      seen.add(normalized.toUpperCase());
      items.push(normalized);
    }
    return Object.freeze(items);
  };
  const dependencies = capture(definition.dependencies);
  const allowedPaths = capture(definition.allowedPaths, true);
  const conflictKeys = capture(definition.conflictKeys);
  return !dependencies ||
    !allowedPaths ||
    !conflictKeys ||
    allowedPaths.length === 0
    ? null
    : Object.freeze({
        id: definition.id,
        objectiveId: definition.objectiveId,
        dependencies,
        allowedPaths,
        conflictKeys,
      });
}

/** 部分再計画の範囲・回数・依存を検査し一世代の候補を作る。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskReplan(
  state: ProjectExecutionState,
  expectedGeneration: number,
  input: Readonly<{
    failedTaskId: string;
    replacements: readonly ProjectTaskDefinition[];
    maximumReplans: number;
  }>,
) {
  const failed = state.tasks.find(
    (task) => task.definition.id === input.failedTaskId,
  );
  const completedIds = new Set(
    state.tasks
      .filter((task) => task.state === "completed")
      .map((task) => task.definition.id),
  );
  const replacementDefinitions = input.replacements.map(
    captureReplanTaskDefinition,
  );
  const existingIds = new Set(state.tasks.map((task) => task.definition.id));
  const replacementIds = new Set(
    replacementDefinitions
      .filter((value): value is ProjectTaskDefinition => value !== null)
      .map((definition) => definition.id),
  );
  const availableDependencies = new Set([...completedIds, ...replacementIds]);
  const hasLiveDependent = state.tasks.some(
    (task) =>
      task.definition.id !== input.failedTaskId &&
      !["completed", "cancelled", "failed", "superseded"].includes(
        task.state,
      ) &&
      task.definition.dependencies.includes(input.failedTaskId),
  );
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    failed.supersededBy !== null ||
    !Number.isSafeInteger(input.maximumReplans) ||
    input.maximumReplans < 0 ||
    state.tasks.filter((task) => task.supersededBy !== null).length >=
      input.maximumReplans ||
    hasLiveDependent ||
    replacementDefinitions.length === 0 ||
    replacementDefinitions.some((definition) => definition === null) ||
    replacementIds.size !== replacementDefinitions.length ||
    [...replacementIds].some((id) => existingIds.has(id)) ||
    (replacementDefinitions as readonly ProjectTaskDefinition[]).some(
      (definition) =>
        definition.objectiveId !== failed.definition.objectiveId ||
        definition.dependencies.some(
          (dependency) => !availableDependencies.has(dependency),
        ),
    ) ||
    hasTaskDependencyCycle([
      ...state.tasks
        .filter(
          (task) => task.state !== "failed" && task.state !== "superseded",
        )
        .map((task) => task.definition),
      ...(replacementDefinitions as readonly ProjectTaskDefinition[]),
    ])
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_replan_invalid_or_out_of_scope",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const replacements = (
    replacementDefinitions as readonly ProjectTaskDefinition[]
  ).map((definition) =>
    Object.freeze({
      definition,
      state: definition.dependencies.every((dependency) =>
        completedIds.has(dependency),
      )
        ? ("ready" as const)
        : ("waiting_dependency" as const),
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    }),
  );
  const replacementHead = replacements[0]?.definition.id ?? null;
  const tasks = [
    ...state.tasks.map((task) =>
      task.definition.id === failed.definition.id
        ? Object.freeze({
            ...task,
            state: "superseded" as const,
            supersededBy: replacementHead,
          })
        : task,
    ),
    ...replacements,
  ];
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state: "executing" as const,
          criterionEvidenceIds: Object.freeze([]),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "coordinator_partial_replan_applied",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze(replacements.map((task) => task.definition.id)),
  });
}

/** 同一計画の再試行で元の実行相関を退役し、回数を一つ進める。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskRetry(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  maximumReplans: number,
  previousRetryCount: number,
) {
  const failed = state.tasks.find((task) => task.definition.id === taskId);
  if (
    state.generation !== expectedGeneration ||
    !failed ||
    failed.state !== "failed" ||
    failed.retryCount !== previousRetryCount ||
    !Number.isSafeInteger(maximumReplans) ||
    maximumReplans < 0 ||
    failed.retryCount >= maximumReplans
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_retry_invalid_or_limit_exceeded",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = state.tasks.map((task) =>
    task.definition.id !== taskId
      ? task
      : Object.freeze({
          ...task,
          state: "ready" as const,
          attemptId: null,
          operationId: null,
          authorityBindingId: null,
          startPhase: "none" as const,
          cleanupConfirmed: false,
          recoveryObligations: Object.freeze([]),
          recoveryUnresolved: false,
          candidateId: null,
          retryCount: task.retryCount + 1,
        }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === failed.definition.objectiveId
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "coordinator_plan_maintained_for_retry",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}
/** 実行中Taskの相関・清掃・回復義務と完了依存を一世代の終端候補に結合する。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskSettlement(
  state: ProjectExecutionState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    authorityBindingId: string;
    outcome: "completed" | "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
    candidateId?: string | null;
  }>,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "running" ||
    task.startPhase !== "running" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (input.outcome === "completed" && !input.cleanupConfirmed) ||
    (input.outcome === "cancelled" && !input.cleanupConfirmed) ||
    !Array.isArray(input.recoveryObligations) ||
    new Set(
      input.recoveryObligations.map(
        (entry) => `${entry.kind}\0${entry.recoveryId}`,
      ),
    ).size !== input.recoveryObligations.length ||
    input.recoveryObligations.some(
      (entry) =>
        ![
          "host",
          "docker",
          "candidate",
          "candidate_store",
          "execution_process",
        ].includes(entry.kind) ||
        !validResultReference(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    typeof input.recoveryUnresolved !== "boolean" ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length !== 0 || input.recoveryUnresolved)) ||
    (input.candidateId !== undefined &&
      input.candidateId !== null &&
      !validResultReference(input.candidateId)) ||
    (input.outcome !== "completed" &&
      input.candidateId !== undefined &&
      input.candidateId !== null)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const nextState: ProjectTaskState =
    input.outcome === "failed" && !input.cleanupConfirmed
      ? "cleanup_pending"
      : input.outcome;
  let tasks = state.tasks.map((current) =>
    current.definition.id !== input.taskId
      ? current
      : Object.freeze({
          ...current,
          state: nextState,
          startPhase: "settled" as const,
          cleanupConfirmed: input.cleanupConfirmed,
          recoveryObligations: Object.freeze(
            input.recoveryObligations.map((entry) =>
              Object.freeze({ ...entry }),
            ),
          ),
          recoveryUnresolved: input.recoveryUnresolved,
          candidateId:
            input.outcome === "completed" ? (input.candidateId ?? null) : null,
        }),
  );
  const completed = new Set(
    tasks
      .filter((candidate) => candidate.state === "completed")
      .map((candidate) => candidate.definition.id),
  );
  tasks = tasks.map((candidate) =>
    candidate.state === "waiting_dependency" &&
    candidate.definition.dependencies.every((dependency) =>
      completed.has(dependency),
    )
      ? Object.freeze({ ...candidate, state: "ready" as const })
      : candidate,
  );
  const objectives = state.objectives.map((objective) => {
    if (objective.state === "accepted" || objective.state === "cancelled")
      return objective;
    const objectiveTasks = tasks.filter(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state !== "superseded",
    );
    if (objectiveTasks.every((task) => task.state === "completed")) {
      return Object.freeze({
        ...objective,
        state: "integration_pending" as const,
      });
    }
    if (objectiveTasks.some((task) => task.state === "cancelled")) {
      return Object.freeze({ ...objective, state: "cancelled" as const });
    }
    if (
      objectiveTasks.some((task) =>
        ["failed", "recovery_required"].includes(task.state),
      )
    ) {
      return Object.freeze({ ...objective, state: "blocked" as const });
    }
    return objective;
  });
  const milestoneState: ProjectMilestoneState = tasks.some(
    (task) => task.state === "recovery_required",
  )
    ? "recovery_required"
    : tasks.some((task) => task.state === "cancelled")
      ? "cancelled"
      : state.milestone.state;
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_settled",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({ ...state.milestone, state: milestoneState }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

/** 開始未受理の引渡しを、元の相関と回復義務を保って一世代で終端化する。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskPreEffectSettlement(
  state: ProjectExecutionState,
  expectedGeneration: number,
  input: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    authorityBindingId: string;
    outcome: "failed" | "cancelled" | "recovery_required";
    cleanupConfirmed: boolean;
    recoveryObligations: readonly ProjectTaskRecoveryObligation[];
    recoveryUnresolved: boolean;
  }>,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === input.taskId,
  );
  const obligationKinds = new Set<ProjectTaskRecoveryKind>([
    "host",
    "docker",
    "candidate",
    "candidate_store",
    "execution_process",
  ]);
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== input.attemptId ||
    task.operationId !== input.operationId ||
    task.authorityBindingId !== input.authorityBindingId ||
    (!input.cleanupConfirmed && input.outcome !== "recovery_required") ||
    input.recoveryObligations.some(
      (entry) =>
        !obligationKinds.has(entry.kind) ||
        !validResultReference(entry.recoveryId) ||
        entry.phase !== "required",
    ) ||
    (input.outcome === "recovery_required" &&
      input.recoveryObligations.length === 0 &&
      !input.recoveryUnresolved) ||
    (input.outcome !== "recovery_required" &&
      (input.recoveryObligations.length > 0 || input.recoveryUnresolved))
  )
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_pre_effect_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id !== input.taskId
      ? current
      : Object.freeze({
          ...current,
          state: input.outcome,
          startPhase: "settled" as const,
          cleanupConfirmed: input.cleanupConfirmed,
          recoveryObligations: Object.freeze(
            input.recoveryObligations.map((entry) =>
              Object.freeze({ ...entry }),
            ),
          ),
          recoveryUnresolved: input.recoveryUnresolved,
          candidateId: null,
        }),
  );
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === task.definition.objectiveId
      ? Object.freeze({
          ...objective,
          state:
            input.outcome === "cancelled"
              ? ("cancelled" as const)
              : ("blocked" as const),
        })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "coordinator_pre_effect_task_settled",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          input.outcome === "recovery_required"
            ? ("recovery_required" as const)
            : input.outcome === "cancelled"
              ? ("cancelled" as const)
              : state.milestone.state,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([input.taskId]),
  });
}

/**
 * 対象Taskの回復義務を、同じ回復参照で回復中へ進める。
 *
 * @responsibility 対象Task・世代・kind・回復参照を照合し、requiredからrecoveringへの純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns 元状態又は更新候補と、処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がprepareTaskRecoveryStartの入力契約を満たす。
 * @postcondition prepareTaskRecoveryStartの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskRecoveryStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task状態、未解決状態、対象kind／recoveryId又はrequired phaseが一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskRecoveryStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskRecoveryStartはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskRecoveryStartはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskRecoveryStartは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskRecoveryStart(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "required",
    ) ||
    !validResultReference(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_recovery_start_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id !== taskId
      ? current
      : Object.freeze({
          ...current,
          recoveryObligations: Object.freeze(
            current.recoveryObligations.map((entry) =>
              entry.kind === kind && entry.recoveryId === recoveryId
                ? Object.freeze({ ...entry, phase: "recovering" as const })
                : entry,
            ),
          ),
        }),
  );
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_recovery_started",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 対象Taskの回復義務を、同じ回復参照で処置済みへ進める。
 *
 * @responsibility Project Task 回復 Obligationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string
 * @returns 元状態又は更新候補と、処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、taskId: string、kind: ProjectTaskRecoveryKind、recoveryId: string」がprepareTaskRecoverySettlementの入力契約を満たす。
 * @postcondition prepareTaskRecoverySettlementの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskRecoverySettlementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task状態、未解決状態、対象kind／recoveryId又はrecovering phaseが一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskRecoverySettlementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskRecoverySettlementはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskRecoverySettlementはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskRecoverySettlementは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskRecoverySettlement(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  kind: ProjectTaskRecoveryKind,
  recoveryId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "recovery_required" ||
    task.recoveryUnresolved ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === kind &&
        entry.recoveryId === recoveryId &&
        entry.phase === "recovering",
    ) ||
    !validResultReference(recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_recovery_settlement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id !== taskId
      ? current
      : Object.freeze({
          ...current,
          recoveryObligations: Object.freeze(
            current.recoveryObligations.map((entry) =>
              entry.kind === kind && entry.recoveryId === recoveryId
                ? Object.freeze({ ...entry, phase: "settled" as const })
                : entry,
            ),
          ),
        }),
  );
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_recovery_item_settled",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 全回復義務の終端を確認したTaskだけを再試行可能にする。
 *
 * @responsibility Task集合と各義務の終端を照合し、履歴を保持したままreadyへ戻す純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、taskIds: readonly string[]
 * @returns 元状態又は更新候補と、処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、taskIds: readonly string[]」がprepareTaskRecoveryRetryの入力契約を満たす。
 * @postcondition prepareTaskRecoveryRetryの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskRecoveryRetryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、Task集合、Identity、義務の終端phase又は再試行可能状態が一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskRecoveryRetryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskRecoveryRetryはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskRecoveryRetryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskRecoveryRetryは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskRecoveryRetry(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskIds: readonly string[],
) {
  if (
    state.generation !== expectedGeneration ||
    taskIds.length === 0 ||
    new Set(taskIds).size !== taskIds.length ||
    taskIds.some((taskId) => !validId(taskId))
  )
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_recovery_batch_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  if (
    taskIds.some((taskId) => {
      const task = state.tasks.find(
        (candidate) => candidate.definition.id === taskId,
      );
      return (
        !task?.cleanupConfirmed ||
        task.recoveryUnresolved ||
        task.recoveryObligations.length === 0 ||
        task.recoveryObligations.some((entry) => entry.phase !== "settled") ||
        (task.state !== "recovery_required" && task.state !== "ready")
      );
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_recovery_batch_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    if (!taskIds.includes(task.definition.id) || task.state === "ready")
      return task;
    return Object.freeze({
      ...task,
      state: "ready" as const,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: true,
      candidateId: null,
      retryCount: task.retryCount + 1,
    });
  });
  const recoveredObjectiveIds = new Set(
    tasks
      .filter((task) => taskIds.includes(task.definition.id))
      .map((task) => task.definition.objectiveId),
  );
  const objectives = state.objectives.map((objective) =>
    recoveredObjectiveIds.has(objective.definition.id)
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_recoveries_settled_for_retry",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "executing" as const,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([...taskIds]),
  });
}

/**
 * Owner喪失時の観測を元Operationの回復参照又は不存在へ結合する。
 *
 * @responsibility 開始前の不存在と開始済みの回復義務を区別し、元Taskの相関を保持する純粋遷移を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]
 * @returns 元状態又は更新候補と処置したTask集合を返す。
 * @precondition 「state: ProjectExecutionState、expectedGeneration: number、bindings: readonly Readonly<{ operationId: string; status: "matched" | "verified_absent"; recoveryId: string | null; }>[]」がprepareTaskOwnerLossの入力契約を満たす。
 * @postcondition prepareTaskOwnerLossの責務を完了した結果だけを返す。
 * @effect N/A: prepareTaskOwnerLossは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 世代、活動中Task集合、Operationとの件数・Identity・status・recoveryId相関が一致しない場合は、元状態を保持してblockedを返す。
 * @invariant prepareTaskOwnerLossは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: prepareTaskOwnerLossはProcess内の同一Subsystemで完結する。
 * @security N/A: prepareTaskOwnerLossはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareTaskOwnerLossは共有非同期状態を持たない同期処理である。
 */
export function prepareTaskOwnerLoss(
  state: ProjectExecutionState,
  expectedGeneration: number,
  bindings: readonly Readonly<{
    operationId: string;
    status: "matched" | "verified_absent";
    recoveryId: string | null;
  }>[],
) {
  const activeItems = state.tasks.filter((task) =>
    ["starting", "running"].includes(task.state),
  );
  const preparedItems = activeItems.filter((task) => task.operationId !== null);
  const reservedItems = activeItems.filter((task) => task.operationId === null);
  if (
    state.generation !== expectedGeneration ||
    activeItems.length === 0 ||
    preparedItems.length + reservedItems.length !== activeItems.length ||
    bindings.length !== preparedItems.length ||
    new Set(bindings.map((entry) => entry.operationId)).size !==
      bindings.length ||
    bindings.some(
      (entry) =>
        !validId(entry.operationId) ||
        !["matched", "verified_absent"].includes(entry.status) ||
        (entry.status === "matched" &&
          !validResultReference(entry.recoveryId)) ||
        (entry.status === "verified_absent" && entry.recoveryId !== null),
    )
  )
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_owner_loss_recovery_binding_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  const byOperation = new Map(
    bindings.map((entry) => [entry.operationId, entry]),
  );
  if (
    preparedItems.some(
      (task) => task.operationId === null || !byOperation.has(task.operationId),
    ) ||
    preparedItems.some((task) => {
      const binding = task.operationId
        ? byOperation.get(task.operationId)
        : null;
      return task.state === "running" && binding?.status !== "matched";
    })
  )
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_owner_loss_recovery_binding_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((task) => {
    if (!activeItems.includes(task)) return task;
    const binding =
      task.operationId === null ? undefined : byOperation.get(task.operationId);
    if (reservedItems.includes(task) || binding?.status === "verified_absent")
      return Object.freeze({
        ...task,
        state: "ready" as const,
        attemptId: null,
        operationId: null,
        authorityBindingId: null,
        startPhase: "none" as const,
        cleanupConfirmed: true,
        recoveryObligations: Object.freeze([]),
        recoveryUnresolved: false,
        candidateId: null,
      });
    return binding?.status === "matched" && binding.recoveryId
      ? Object.freeze({
          ...task,
          state: "recovery_required" as const,
          startPhase: "settled" as const,
          cleanupConfirmed: false,
          recoveryObligations: Object.freeze([
            Object.freeze({
              kind: "docker" as const,
              recoveryId: binding.recoveryId,
              phase: "required" as const,
            }),
          ]),
          recoveryUnresolved: false,
          candidateId: null,
        })
      : task;
  });
  const objectives = state.objectives.map((objective) =>
    tasks.some(
      (task) =>
        task.definition.objectiveId === objective.definition.id &&
        task.state === "recovery_required",
    )
      ? Object.freeze({ ...objective, state: "blocked" as const })
      : reservedItems.some(
            (task) => task.definition.objectiveId === objective.definition.id,
          )
        ? Object.freeze({ ...objective, state: "executing" as const })
        : objective,
  );
  return Object.freeze({
    status: "completed",
    reason: "coordinator_owner_loss_recoveries_bound",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: bindings.some((entry) => entry.status === "matched")
          ? ("recovery_required" as const)
          : ("executing" as const),
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze(activeItems.map((task) => task.definition.id)),
  });
}

/** 用途別の有限更新を元世代へ適用し、対応する要求だけ直後再送を同じ規則で確認する。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskExecutionUpdate(
  state: ProjectExecutionState,
  expectedGeneration: number,
  request: TaskExecutionUpdate,
) {
  if (request.kind === "task_recovery_finalize") {
    if (state.generation !== expectedGeneration)
      return Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_state_generation_conflict",
        state,
        taskIds: Object.freeze([]),
      });
    const pairs = new Set<string>();
    if (
      state.projectId !== request.projectId ||
      request.recoveries.length === 0 ||
      request.recoveries.some(({ taskId, recoveryId }) => {
        const pair = `${taskId}\0${recoveryId}`;
        const task = state.tasks.find((item) => item.definition.id === taskId);
        if (
          !validId(taskId) ||
          !validResultReference(recoveryId) ||
          pairs.has(pair) ||
          !task?.attemptId ||
          !task.operationId ||
          task.startPhase !== "settled" ||
          !task.cleanupConfirmed ||
          task.recoveryUnresolved ||
          !task.recoveryObligations.some(
            (item) =>
              item.kind === "docker" &&
              item.recoveryId === recoveryId &&
              item.phase === "settled",
          )
        )
          return true;
        pairs.add(pair);
        return false;
      })
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "coordinator_task_recovery_not_settled",
        state,
        taskIds: Object.freeze([]),
      });
    // Operation・履歴・未解決参照の最終判定と退役は既存の統合Writerが所有する。
    return Object.freeze({
      status: "completed" as const,
      reason: "coordinator_state_durable",
      state: Object.freeze({ ...state, generation: state.generation + 1 }),
      taskIds: Object.freeze([
        ...new Set(request.recoveries.map((item) => item.taskId)),
      ]),
    });
  }
  if (request.kind === "task_owner_loss")
    return prepareTaskOwnerLoss(state, expectedGeneration, request.bindings);
  if (request.kind === "task_recovery_retry") {
    if (
      state.generation === expectedGeneration + 1 &&
      request.taskIds.length > 0 &&
      request.taskIds.every((id) => {
        const task = state.tasks.find((item) => item.definition.id === id);
        return (
          task?.state === "ready" &&
          task.startPhase === "none" &&
          task.attemptId === null &&
          task.operationId === null &&
          task.authorityBindingId === null &&
          task.candidateId === null
        );
      })
    ) {
      const replay = prepareTaskRecoveryRetry(
        { ...state, generation: expectedGeneration },
        expectedGeneration,
        request.taskIds,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "coordinator_state_durable",
          state,
          taskIds: Object.freeze([...request.taskIds]),
        });
    }
    return prepareTaskRecoveryRetry(state, expectedGeneration, request.taskIds);
  }
  if ("recoveryKind" in request) {
    const prepare =
      request.kind === "task_recovery_start"
        ? prepareTaskRecoveryStart
        : prepareTaskRecoverySettlement;
    const from =
      request.kind === "task_recovery_start" ? "required" : "recovering";
    const to =
      request.kind === "task_recovery_start" ? "recovering" : "settled";
    const task = state.tasks.find(
      (item) => item.definition.id === request.taskId,
    );
    if (
      state.generation === expectedGeneration + 1 &&
      task?.recoveryObligations.some(
        (item) =>
          item.kind === request.recoveryKind &&
          item.recoveryId === request.recoveryId &&
          item.phase === to,
      )
    ) {
      const replay = prepare(
        {
          ...state,
          generation: expectedGeneration,
          tasks: state.tasks.map((item) =>
            item !== task
              ? item
              : {
                  ...item,
                  recoveryObligations: item.recoveryObligations.map((entry) =>
                    entry.kind === request.recoveryKind &&
                    entry.recoveryId === request.recoveryId
                      ? { ...entry, phase: from }
                      : entry,
                  ),
                },
          ),
        },
        expectedGeneration,
        request.taskId,
        request.recoveryKind,
        request.recoveryId,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "coordinator_state_durable",
          state,
          taskIds: Object.freeze([request.taskId]),
        });
    }
    return prepare(
      state,
      expectedGeneration,
      request.taskId,
      request.recoveryKind,
      request.recoveryId,
    );
  }
  if (request.kind === "task_settle") {
    const task = state.tasks.find(
      (item) => item.definition.id === request.taskId,
    );
    if (
      state.generation === expectedGeneration + 1 &&
      task?.startPhase === "settled"
    ) {
      const replay = prepareTaskSettlement(
        {
          ...state,
          generation: expectedGeneration,
          tasks: state.tasks.map((item) =>
            item === task
              ? { ...item, state: "running", startPhase: "running" }
              : item,
          ),
        },
        expectedGeneration,
        request,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "coordinator_state_durable",
          state,
          taskIds: Object.freeze([request.taskId]),
        });
    }
    return prepareTaskSettlement(state, expectedGeneration, request);
  }
  if (request.kind === "task_settle_before_effect") {
    const task = state.tasks.find(
      (item) => item.definition.id === request.taskId,
    );
    if (
      state.generation === expectedGeneration + 1 &&
      task?.startPhase === "settled"
    ) {
      // 同じ局所規則で終端候補を再構築し、全文一致時だけ既存Writerの耐久再確認へ渡す。
      const replay = prepareTaskPreEffectSettlement(
        {
          ...state,
          generation: expectedGeneration,
          tasks: state.tasks.map((item) =>
            item === task
              ? { ...item, state: "starting", startPhase: "handoff_prepared" }
              : item,
          ),
        },
        expectedGeneration,
        request,
      );
      if (
        replay.status === "completed" &&
        encodeStateValue(replay.state) === encodeStateValue(state)
      )
        return Object.freeze({
          status: "completed" as const,
          reason: "coordinator_state_durable",
          state,
          taskIds: Object.freeze([request.taskId]),
        });
    }
    return prepareTaskPreEffectSettlement(state, expectedGeneration, request);
  }
  if (request.kind === "task_retry" || request.kind === "task_replan") {
    const taskId =
      request.kind === "task_retry" ? request.taskId : request.failedTaskId;
    const task = state.tasks.find((item) => item.definition.id === taskId);
    const objective = state.objectives.find(
      (item) => item.definition.id === task?.definition.objectiveId,
    );
    let replay =
      Number.isSafeInteger(request.maximumReplans) &&
      request.maximumReplans >= 0 &&
      state.generation === expectedGeneration + 1 &&
      state.milestone.state === "executing" &&
      objective?.state === "executing";
    let taskIds: readonly string[] = [];
    if (request.kind === "task_retry") {
      replay &&=
        Number.isSafeInteger(request.previousRetryCount) &&
        request.previousRetryCount >= 0 &&
        !!task &&
        task.state === "ready" &&
        task.retryCount === request.previousRetryCount + 1 &&
        request.previousRetryCount < request.maximumReplans &&
        task.attemptId === null &&
        task.operationId === null &&
        task.authorityBindingId === null &&
        task.startPhase === "none" &&
        !task.cleanupConfirmed &&
        task.recoveryObligations.length === 0 &&
        !task.recoveryUnresolved &&
        task.candidateId === null;
      taskIds = [request.taskId];
    } else {
      const definitions = request.replacements.map(captureReplanTaskDefinition);
      const replacements = state.tasks.slice(-definitions.length);
      taskIds = definitions.flatMap((item) => (item ? [item.id] : []));
      replay &&=
        !!task &&
        task.state === "superseded" &&
        definitions.length > 0 &&
        definitions.every((item) => item !== null) &&
        task.supersededBy === definitions[0]?.id &&
        objective?.criterionEvidenceIds.length === 0 &&
        state.tasks.filter((item) => item.supersededBy !== null).length <=
          request.maximumReplans &&
        replacements.length === definitions.length &&
        replacements.every(
          (item, index) =>
            encodeStateValue(item.definition) ===
              encodeStateValue(definitions[index]) &&
            item.definition.objectiveId === task.definition.objectiveId &&
            item.state ===
              (item.definition.dependencies.every((id) =>
                state.tasks.some(
                  (other) =>
                    other.definition.id === id && other.state === "completed",
                ),
              )
                ? "ready"
                : "waiting_dependency") &&
            item.attemptId === null &&
            item.operationId === null &&
            item.authorityBindingId === null &&
            item.startPhase === "none" &&
            !item.cleanupConfirmed &&
            item.recoveryObligations.length === 0 &&
            !item.recoveryUnresolved &&
            item.candidateId === null &&
            item.retryCount === 0 &&
            item.supersededBy === null,
        );
    }
    if (replay)
      return Object.freeze({
        status: "completed" as const,
        reason: "coordinator_state_durable",
        state,
        taskIds: Object.freeze(taskIds),
      });
    return request.kind === "task_retry"
      ? prepareTaskRetry(
          state,
          expectedGeneration,
          request.taskId,
          request.maximumReplans,
          request.previousRetryCount,
        )
      : prepareTaskReplan(state, expectedGeneration, request);
  }
  const task = state.tasks.find(
    (item) => item.definition.id === request.taskId,
  );
  if (
    state.generation === expectedGeneration + 1 &&
    validId(request.taskId) &&
    validId(request.attemptId) &&
    task?.attemptId === request.attemptId &&
    (request.kind === "task_start"
      ? validId(request.authorityBindingId) &&
        task.state === "starting" &&
        task.startPhase === "reserved" &&
        task.authorityBindingId === request.authorityBindingId &&
        task.operationId === null
      : task.operationId === request.operationId &&
        (request.kind === "task_handoff"
          ? task.state === "starting" && task.startPhase === "handoff_prepared"
          : task.state === "running" && task.startPhase === "running"))
  )
    return Object.freeze({
      status: "completed" as const,
      reason: "coordinator_state_durable",
      state,
      taskIds: Object.freeze([request.taskId]),
    });
  return request.kind === "task_start"
    ? prepareTaskStart(
        state,
        expectedGeneration,
        request.taskId,
        request.attemptId,
        request.authorityBindingId,
      )
    : (request.kind === "task_handoff"
        ? prepareTaskHandoff
        : prepareTaskStarted)(
        state,
        expectedGeneration,
        request.taskId,
        request.attemptId,
        request.operationId,
      );
}
/**
 * 管理Taskの有限更新要求を独立捕捉する。
 * @responsibility 用途別の正確なfield集合を確認し、Getter・Proxy・未知fieldを実行せず拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 値の捕捉を現在状態との相関・保存・実Task開始と扱わない。
 */
export function captureTaskExecutionUpdate(
  input: unknown,
): TaskExecutionUpdate | null {
  const start = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "taskId", "attemptId", "authorityBindingId"]),
  );
  const phase =
    start ??
    snapshotStateRecord(
      input,
      new Set(["kind", "projectId", "taskId", "attemptId", "operationId"]),
    );
  const retry = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "taskId",
      "maximumReplans",
      "previousRetryCount",
    ]),
  );
  const replan = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "failedTaskId",
      "replacements",
      "maximumReplans",
    ]),
  );
  const settlement = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "taskId",
      "attemptId",
      "operationId",
      "authorityBindingId",
      "outcome",
      "cleanupConfirmed",
      "recoveryObligations",
      "recoveryUnresolved",
    ]),
  );
  const runningSettlementWithCandidate = snapshotStateRecord(
    input,
    new Set([
      "kind",
      "projectId",
      "taskId",
      "attemptId",
      "operationId",
      "authorityBindingId",
      "outcome",
      "cleanupConfirmed",
      "recoveryObligations",
      "recoveryUnresolved",
      "candidateId",
      "resultUnresolved",
    ]),
  );
  const runningSettlement =
    runningSettlementWithCandidate ??
    snapshotStateRecord(
      input,
      new Set([
        "kind",
        "projectId",
        "taskId",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "outcome",
        "cleanupConfirmed",
        "recoveryObligations",
        "recoveryUnresolved",
        "resultUnresolved",
      ]),
    );
  const recovery = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "taskId", "recoveryKind", "recoveryId"]),
  );
  const recoveryRetry = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "taskIds"]),
  );
  const finalization = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "recoveries"]),
  );
  const finalizationItems = snapshotStateArray(
    finalization?.recoveries,
    Number.MAX_SAFE_INTEGER,
  );
  const ownerLoss = snapshotStateRecord(
    input,
    new Set(["kind", "projectId", "bindings"]),
  );
  const ownerBindings = snapshotStateArray(
    ownerLoss?.bindings,
    Number.MAX_SAFE_INTEGER,
  );
  const command =
    phase ??
    retry ??
    replan ??
    settlement ??
    runningSettlement ??
    recovery ??
    recoveryRetry ??
    finalization ??
    ownerLoss;
  if (
    !command ||
    !validId(command.projectId) ||
    !(
      (finalization?.kind === "task_recovery_finalize" &&
        finalizationItems.status === "ok" &&
        finalizationItems.value.length > 0 &&
        finalizationItems.value.every((item) => {
          const value = snapshotStateRecord(
            item,
            new Set(["taskId", "recoveryId"]),
          );
          return (
            value !== null &&
            validId(value.taskId) &&
            validResultReference(value.recoveryId)
          );
        })) ||
      (ownerLoss?.kind === "task_owner_loss" &&
        ownerBindings.status === "ok" &&
        ownerBindings.value.every(
          (entry) =>
            snapshotStateRecord(
              entry,
              new Set(["operationId", "status", "recoveryId"]),
            ) !== null,
        )) ||
      ((recovery?.kind === "task_recovery_start" ||
        recovery?.kind === "task_recovery_settle") &&
        validId(recovery.taskId) &&
        validResultReference(recovery.recoveryId) &&
        [
          "docker",
          "host",
          "candidate",
          "candidate_store",
          "execution_process",
        ].includes(recovery.recoveryKind as string)) ||
      (recoveryRetry?.kind === "task_recovery_retry" &&
        Array.isArray(recoveryRetry.taskIds)) ||
      start?.kind === "task_start" ||
      (start === null &&
        (phase?.kind === "task_handoff" || phase?.kind === "task_started")) ||
      (retry?.kind === "task_retry" &&
        Number.isSafeInteger(retry.previousRetryCount) &&
        (retry.previousRetryCount as number) >= 0) ||
      replan?.kind === "task_replan" ||
      (settlement?.kind === "task_settle_before_effect" &&
        ["failed", "cancelled", "recovery_required"].includes(
          settlement.outcome as string,
        ) &&
        typeof settlement.cleanupConfirmed === "boolean" &&
        typeof settlement.recoveryUnresolved === "boolean" &&
        Array.isArray(settlement.recoveryObligations)) ||
      (runningSettlement?.kind === "task_settle" &&
        typeof runningSettlement.resultUnresolved === "boolean" &&
        typeof runningSettlement.cleanupConfirmed === "boolean" &&
        typeof runningSettlement.recoveryUnresolved === "boolean" &&
        Array.isArray(runningSettlement.recoveryObligations) &&
        ["completed", "failed", "cancelled", "recovery_required"].includes(
          runningSettlement.outcome as string,
        ))
    )
  )
    return null;
  try {
    const normalized =
      runningSettlement?.kind === "task_settle"
        ? {
            ...command,
            candidateId:
              Object.getOwnPropertyDescriptor(runningSettlement, "candidateId")
                ?.value ?? null,
          }
        : command;
    return Object.freeze(
      JSON.parse(encodeStateValue(normalized)),
    ) as TaskExecutionUpdate;
  } catch {
    return null;
  }
}

/** 同じTaskの開始予約規則を元の拒否順で適用する。 @trace ARCH-000004、ARCH-000008 */
export function prepareTaskStart(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  authorityBindingId: string,
) {
  if (
    state.generation !== expectedGeneration ||
    !validId(taskId) ||
    !validId(attemptId) ||
    !validId(authorityBindingId)
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_generation_or_identity_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  if (!observeTaskStartCandidates(state).taskIds.includes(taskId)) {
    return Object.freeze({
      status: "blocked",
      reason: "coordinator_task_not_schedulable",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = state.tasks.map((task) =>
    task.definition.id === taskId
      ? Object.freeze({
          ...task,
          state: "starting" as const,
          attemptId,
          authorityBindingId,
          operationId: null,
          startPhase: "reserved" as const,
          recoveryObligations: Object.freeze([]),
          recoveryUnresolved: false,
        })
      : task,
  );
  const objectiveId = tasks.find((task) => task.definition.id === taskId)
    ?.definition.objectiveId;
  const objectives = state.objectives.map((objective) =>
    objective.definition.id === objectiveId && objective.state === "planned"
      ? Object.freeze({ ...objective, state: "executing" as const })
      : objective,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "coordinator_task_start_reserved",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          state.milestone.state === "planned"
            ? ("executing" as const)
            : state.milestone.state,
      }),
      objectives: Object.freeze(objectives),
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 開始予約を引渡し準備済みへ進める。
 * @responsibility 元の世代・phase・Identityを照合し一世代の候補だけを作る。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 候補を保存又は実Process開始の証明にしない。
 */
export function prepareTaskHandoff(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "reserved" ||
    task.attemptId !== attemptId ||
    !validId(operationId)
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_task_handoff_preparation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = state.tasks.map((current) =>
    current.definition.id === taskId
      ? Object.freeze({
          ...current,
          operationId,
          startPhase: "handoff_prepared" as const,
        })
      : current,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "coordinator_task_handoff_prepared",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * 同じTask・Attempt・Operationの開始観測を状態へ結合する。
 * @responsibility 元の世代・phase・Identityを照合し一世代の候補だけを作る。
 * @trace ARCH-000004、ARCH-000008
 * @invariant 候補を保存又は実Process開始の証明にしない。
 */
export function prepareTaskStarted(
  state: ProjectExecutionState,
  expectedGeneration: number,
  taskId: string,
  attemptId: string,
  operationId: string,
) {
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    !task ||
    task.state !== "starting" ||
    task.startPhase !== "handoff_prepared" ||
    task.attemptId !== attemptId ||
    task.operationId !== operationId
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "coordinator_task_start_observation_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const tasks = state.tasks.map((current) =>
    current.definition.id === taskId
      ? Object.freeze({
          ...current,
          state: "running" as const,
          startPhase: "running" as const,
        })
      : current,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "coordinator_task_started",
    state: Object.freeze({
      ...state,
      generation: state.generation + 1,
      tasks: Object.freeze(tasks),
    }),
    taskIds: Object.freeze([taskId]),
  });
}

function activeForCapacity(task: ProjectTaskRecord) {
  return (
    task.state === "starting" ||
    task.state === "running" ||
    task.state === "cleanup_pending" ||
    (task.state === "recovery_required" && !task.cleanupConfirmed)
  );
}

function reservesConflict(task: ProjectTaskRecord) {
  return (
    activeForCapacity(task) ||
    (task.state === "recovery_required" &&
      (task.recoveryUnresolved || task.recoveryObligations.length > 0))
  );
}

function normalizedConflictPaths(task: ProjectTaskRecord) {
  return task.definition.allowedPaths.map((value) =>
    value.replace(/\/+$/u, "").toUpperCase(),
  );
}

function conflicts(left: ProjectTaskRecord, right: ProjectTaskRecord) {
  const leftKeys = new Set(
    left.definition.conflictKeys.map((value) => value.toUpperCase()),
  );
  if (
    right.definition.conflictKeys.some((value) =>
      leftKeys.has(value.toUpperCase()),
    )
  )
    return true;
  return normalizedConflictPaths(left).some((leftPath) =>
    normalizedConflictPaths(right).some(
      (rightPath) =>
        leftPath === rightPath ||
        leftPath.startsWith(`${rightPath}/`) ||
        rightPath.startsWith(`${leftPath}/`),
    ),
  );
}

function selectSchedulableProjectTasks(
  state: ProjectExecutionState,
): readonly string[] {
  const available = Math.max(
    0,
    state.maximumConcurrency - state.tasks.filter(activeForCapacity).length,
  );
  if (available === 0) return Object.freeze([]);
  const selectedItems: ProjectTaskRecord[] = [];
  const reservedItems = state.tasks.filter(reservesConflict);
  for (const task of state.tasks) {
    if (selectedItems.length >= available) break;
    if (task.state !== "ready") continue;
    if (
      reservedItems.some((active) => conflicts(task, active)) ||
      selectedItems.some((candidate) => conflicts(task, candidate))
    )
      continue;
    selectedItems.push(task);
  }
  return Object.freeze(selectedItems.map((task) => task.definition.id));
}
