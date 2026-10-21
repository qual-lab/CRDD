/**
 * 人間判断と受入判断の状態遷移を所有する。
 * @responsibility 人間判断と受入判断の状態遷移を所有する。
 * @trace ARCH-000004
 */

import {
  type OrchestratorState,
  type StateResult,
  projectState,
  validIdentity,
  type OrchestratorAcceptanceDecisionInput,
} from "../state/model.ts";

/**
 * Orchestrator Human Decisionを要求する。
 *
 * @responsibility Orchestrator Human Decisionの要求条件、受理結果、Effect未成立との分離境界を所有する。
 * @trace ARCH-000004
 * @input state: OrchestratorState、expectedGeneration: number、objectiveId: string
 * @returns StateResultを返す。
 * @precondition 「state: OrchestratorState、expectedGeneration: number、objectiveId: string」がrequestOrchestratorHumanDecisionの入力契約を満たす。
 * @postcondition requestOrchestratorHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: requestOrchestratorHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: requestOrchestratorHumanDecisionは独自の失敗分岐を所有しない。
 * @invariant requestOrchestratorHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestOrchestratorHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: requestOrchestratorHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requestOrchestratorHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function requestOrchestratorHumanDecision(
  state: OrchestratorState,
  expectedGeneration: number,
  objectiveId: string,
): StateResult {
  const objective = state.objectives.find(
    (candidate) => candidate.definition.id === objectiveId,
  );
  if (
    state.generation !== expectedGeneration ||
    !objective ||
    objective.state !== "blocked" ||
    state.milestone.state === "accepted" ||
    state.milestone.state === "cancelled"
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_human_decision_request_invalid",
      state,
      taskIds: Object.freeze([]),
    });
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_human_decision_required",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      decisionApplicationId: null,
      milestone: Object.freeze({
        ...state.milestone,
        state: "human_decision_required" as const,
      }),
    }),
    taskIds: Object.freeze(
      state.tasks
        .filter((task) => task.definition.objectiveId === objectiveId)
        .map((task) => task.definition.id),
    ),
  });
}

/**
 * Orchestrator Human Decisionを適用する。
 *
 * @responsibility Orchestrator Human Decisionの適用条件、変更結果、拒否境界を所有する。
 * @trace ARCH-000004
 * @input state: OrchestratorState、expectedGeneration: number、action: "resume" | "cancel"、applicationId: string
 * @returns StateResultを返す。
 * @precondition 「state: OrchestratorState、expectedGeneration: number、action: "resume" | "cancel"、applicationId: string」がapplyOrchestratorHumanDecisionの入力契約を満たす。
 * @postcondition applyOrchestratorHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: applyOrchestratorHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: applyOrchestratorHumanDecisionは独自の失敗分岐を所有しない。
 * @invariant applyOrchestratorHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: applyOrchestratorHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: applyOrchestratorHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: applyOrchestratorHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function applyOrchestratorHumanDecision(
  state: OrchestratorState,
  expectedGeneration: number,
  action: "resume" | "cancel",
  applicationId?: string,
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    state.milestone.state !== "human_decision_required" ||
    !validIdentity(applicationId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_human_decision_stale",
      state,
      taskIds: Object.freeze([]),
    });
  return Object.freeze({
    status: "completed",
    reason:
      action === "resume"
        ? "orchestrator_human_decision_applied"
        : "orchestrator_milestone_cancelled_by_human",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      decisionApplicationId: applicationId as string,
      milestone: Object.freeze({
        ...state.milestone,
        state:
          action === "resume" ? ("executing" as const) : ("cancelled" as const),
      }),
    }),
    taskIds: Object.freeze([]),
  });
}

/**
 * Objective受入または差戻しを状態へ適用する。
 *
 * @responsibility 検証済みObjective判断を状態値へ変換する内部遷移を所有する。
 * @trace ARCH-000005
 * @input state: OrchestratorState、expectedGeneration: number、objectiveId: string、input: Readonly<{ accepted: boolean; criterionEvidenceIds: readonly string[]; }>
 * @returns StateResultを返す。
 * @precondition 呼出し元が受入判断対象、Authority、世代および根拠を検証済みである。
 * @postcondition 対象Objectiveだけを受入済みまたは差戻しへ遷移させる。
 * @effect N/A: 入力から新しい状態値を導くだけで外部Effectを発行しない。
 * @failure 状態、世代、対象または受入根拠が一致しない場合は元状態を保持して停止する。
 * @invariant 他Objective、TaskおよびProvider状態を変更しない。
 * @boundary Acceptance Decision状態機械内部のObjective遷移境界。
 * @security Authority値を受理せず、検証済み判断だけを状態へ適用する。
 * @concurrency expectedGenerationが一致するSnapshotだけを処置する。
 */
function applyObjectiveAcceptance(
  state: OrchestratorState,
  expectedGeneration: number,
  objectiveId: string,
  input: Readonly<{
    accepted: boolean;
    criterionEvidenceIds: readonly string[];
  }>,
): StateResult {
  const objective = state.objectives.find(
    (candidate) => candidate.definition.id === objectiveId,
  );
  if (
    state.generation !== expectedGeneration ||
    !objective ||
    objective.state !== "integration_pending" ||
    input.criterionEvidenceIds.length !==
      objective.definition.acceptanceCriteria.length ||
    input.criterionEvidenceIds.some((value) => !validIdentity(value))
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_objective_integration_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  const objectives = state.objectives.map((candidate) =>
    candidate.definition.id === objectiveId
      ? Object.freeze({
          ...candidate,
          state: input.accepted ? ("accepted" as const) : ("returned" as const),
          criterionEvidenceIds: Object.freeze([...input.criterionEvidenceIds]),
        })
      : candidate,
  );
  const isAllAccepted = objectives.every(
    (candidate) => candidate.state === "accepted",
  );
  return Object.freeze({
    status: "completed",
    reason: input.accepted
      ? "orchestrator_objective_accepted"
      : "orchestrator_objective_integration_rejected",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: isAllAccepted ? ("integrating" as const) : state.milestone.state,
      }),
      objectives,
    }),
    taskIds: Object.freeze(
      state.tasks
        .filter((task) => task.definition.objectiveId === objectiveId)
        .map((task) => task.definition.id),
    ),
  });
}

/**
 * Milestone受入を状態へ適用する。
 *
 * @responsibility 検証済みMilestone受入を状態値へ変換する内部遷移を所有する。
 * @trace ARCH-000005
 * @input state: OrchestratorState、expectedGeneration: number、criterionEvidenceIds: readonly string[]
 * @returns StateResultを返す。
 * @precondition 呼出し元が全Objective受入、Authority、世代および根拠を検証済みである。
 * @postcondition 対象Milestoneだけを受入済みへ遷移させる。
 * @effect N/A: 入力から新しい状態値を導くだけで外部Effectを発行しない。
 * @failure 状態、世代、Objectiveまたは受入根拠が一致しない場合は元状態を保持して停止する。
 * @invariant TaskおよびProvider状態を変更せず、全Objective受入前は遷移しない。
 * @boundary Acceptance Decision状態機械内部のMilestone遷移境界。
 * @security Authority値を受理せず、検証済み判断だけを状態へ適用する。
 * @concurrency expectedGenerationが一致するSnapshotだけを処置する。
 */
function applyMilestoneAcceptance(
  state: OrchestratorState,
  expectedGeneration: number,
  criterionEvidenceIds: readonly string[],
): StateResult {
  if (
    state.generation !== expectedGeneration ||
    state.milestone.state !== "integrating" ||
    !state.objectives.every((objective) => objective.state === "accepted") ||
    criterionEvidenceIds.length !== state.milestone.acceptanceCriteria.length ||
    criterionEvidenceIds.some((value) => !validIdentity(value))
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_milestone_integration_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  }
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_milestone_accepted",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "accepted" as const,
        criterionEvidenceIds: Object.freeze([...criterionEvidenceIds]),
      }),
    }),
    taskIds: Object.freeze(state.tasks.map((task) => task.definition.id)),
  });
}

/**
 * Project運営者の明示的なObjective／Milestone受入判断を状態遷移へ適用する。
 *
 * @responsibility 受入・差戻し・判断待ちを対象別に判定し、下位完了から上位受入を推定しない状態機械を所有する。
 * @trace ARCH-000005
 * @input state: OrchestratorState、expectedGeneration: number、input: OrchestratorAcceptanceDecisionInput
 * @returns 許可した遷移または理由付き停止を`StateResult`として返す。
 * @precondition 呼出し側がProject運営者Authorityを別境界で検証し、exactなProject状態と世代を渡す。
 * @postcondition `accept`と`return`は許可した状態だけを更新し、`wait`は状態を変更しない。
 * @effect N/A: 本関数は入力から新しい状態値を導くだけで、Store、TaskまたはProvider Effectを発行しない。
 * @failure 対象、世代、状態、根拠または前提Objectiveが一致しない場合は元状態を保持して停止する。
 * @invariant Task完了だけでObjectiveを受け入れず、全Objective受入前にMilestone判断へ進めない。
 * @boundary Orchestrator Applicationと状態機械の境界。
 * @security Authority値を受理・生成せず、検証済み判断だけを適用する。
 * @concurrency expectedGenerationが一致する一つの状態Snapshotだけを処置する。
 */
export function applyOrchestratorAcceptanceDecision(
  state: OrchestratorState,
  expectedGeneration: number,
  input: OrchestratorAcceptanceDecisionInput,
): StateResult {
  const isEvidenceValid =
    input.criterionEvidenceIds.every((value) => validIdentity(value)) &&
    new Set(input.criterionEvidenceIds).size ===
      input.criterionEvidenceIds.length;
  if (
    state.generation !== expectedGeneration ||
    !validIdentity(input.targetId) ||
    !isEvidenceValid
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_acceptance_decision_mismatch",
      state,
      taskIds: Object.freeze([]),
    });

  if (input.target === "objective") {
    const objective = state.objectives.find(
      (candidate) => candidate.definition.id === input.targetId,
    );
    if (
      objective?.state !== "integration_pending" ||
      (input.decision === "accept" &&
        input.criterionEvidenceIds.length !==
          objective.definition.acceptanceCriteria.length)
    )
      return Object.freeze({
        status: "blocked",
        reason: "orchestrator_acceptance_decision_mismatch",
        state,
        taskIds: Object.freeze([]),
      });
    if (input.decision === "wait")
      return Object.freeze({
        status: "completed",
        reason: "orchestrator_objective_acceptance_waiting",
        state,
        taskIds: Object.freeze([]),
      });
    return applyObjectiveAcceptance(state, expectedGeneration, input.targetId, {
      accepted: input.decision === "accept",
      criterionEvidenceIds: input.criterionEvidenceIds,
    });
  }

  if (
    input.targetId !== state.milestone.id ||
    state.milestone.state !== "integrating" ||
    !state.objectives.every((objective) => objective.state === "accepted") ||
    (input.decision === "accept" &&
      input.criterionEvidenceIds.length !==
        state.milestone.acceptanceCriteria.length)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_acceptance_decision_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  if (input.decision === "accept")
    return applyMilestoneAcceptance(
      state,
      expectedGeneration,
      input.criterionEvidenceIds,
    );
  if (input.decision === "wait")
    return Object.freeze({
      status: "completed",
      reason: "orchestrator_milestone_acceptance_waiting",
      state,
      taskIds: Object.freeze([]),
    });
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_milestone_acceptance_returned",
    state: projectState({
      ...state,
      generation: state.generation + 1,
      milestone: Object.freeze({
        ...state.milestone,
        state: "returned" as const,
      }),
    }),
    taskIds: Object.freeze(state.tasks.map((task) => task.definition.id)),
  });
}
