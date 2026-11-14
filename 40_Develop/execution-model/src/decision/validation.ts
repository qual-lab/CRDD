/**
 * Blockerの提案・回答・適用履歴の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */

import type { ProjectExecutionState } from "../state/types.ts";
import { encodeStateValue, isPrincipalId } from "../state/operations.ts";
import type {
  Blocker,
  Decision,
  DecisionAnswer,
  DecisionApplication,
  DecisionHistoryEvent,
  DecisionRequest,
  DecisionSnapshot,
  DecisionTarget,
} from "./types.ts";

/** 判断対象の現在の表示状態を取得する。不存在は推測して補完しない。 */
function decisionTargetState(
  project: ProjectExecutionState,
  request: DecisionRequest,
) {
  if (request.target.kind === "milestone")
    return request.target.id === project.milestone.id
      ? project.milestone.state
      : null;
  if (request.target.kind === "objective")
    return (
      project.objectives.find(
        (item) => item.definition.id === request.target.id,
      )?.state ?? null
    );
  return (
    project.tasks.find((item) => item.definition.id === request.target.id)
      ?.state ?? null
  );
}

/** 進行対象に関わる既知の問題だけを選ぶ。Task所属不明は無関係と推測しない。 */
function blockerAffectsDecision(
  blocker: Blocker,
  record: Decision,
  project: ProjectExecutionState,
): boolean {
  if (
    blocker.target.projectId !== record.target.projectId ||
    blocker.target.milestoneId !== record.target.milestoneId
  )
    return false;
  if (record.kind === "continuation" || record.target.kind === "milestone")
    return true;
  if (blocker.target.kind === "milestone") return true;
  if (blocker.target.kind === "objective")
    return blocker.target.id === record.target.id;
  const task = project.tasks.find(
    (item) => item.definition.id === blocker.target.id,
  );
  return !task || task.definition.objectiveId === record.target.id;
}

/**
 * 現在のStateへ判断とBlockerを同時に登録する候補を作る。
 * @responsibility 対象世代・所属・Queueを確認し、同一要求の再送は保存不要とする。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input current: 同Ownerのfresh値、request: 認可済み要求。
 * @returns 一回保存する候補、同一要求の既存結果、又は停止。
 * @precondition 現在の操作認可は入口と保存接続側で確認済み。
 * @postcondition 他のProject・Queue・技術資源を変更しない。
 * @effect N/A: 値候補のみ。
 * @failure 不正要求、ID再利用、対象・世代・Queue差は停止。
 * @invariant 新規登録からAI実行を発行しない。
 * @boundary Domainの判断候補と既存Writer。
 * @security 保存値を人間の承認として解釈しない。
 * @concurrency 元値比較・保存は同じ短期Ownerが行う。
 */
export function prepareDecisionCreation<T extends DecisionSnapshot>(
  current: T,
  request: DecisionRequest,
) {
  const prepared = prepareDecisionRequest(request);
  if (!prepared) return storeBlocked("decision_request_invalid");
  const record = prepared.decision;
  const existing = current.decisions.find(
    (item) => item.decisionId === record.decisionId,
  );
  if (existing) {
    const source =
      existing.status === "invalidated"
        ? (({ closedAt: _closedAt, closeReason: _closeReason, ...value }) =>
            value)(existing)
        : existing;
    const { status: _status, result: _result, ...original } = source;
    return encodeStateValue(original) === encodeStateValue(request)
      ? completed("decision_already_requested", { next: null, value: existing })
      : storeBlocked("decision_identity_conflict");
  }
  const project = current.projects.find(
    (item) => item.projectId === record.target.projectId,
  );
  const blocker = current.blockers.find(
    (item) => item.blockerId === record.blockerId,
  );
  if (blocker) {
    const previous =
      blocker.kind === "human_decision"
        ? current.decisions.find(
            (item) => item.decisionId === blocker.currentDecisionId,
          )
        : null;
    const previousAt =
      previous?.status === "invalidated"
        ? previous.closedAt
        : previous?.result?.status === "applied"
          ? previous.result.application.appliedAt
          : previous?.result?.answer.answeredAt;
    if (
      blocker.kind !== "human_decision" ||
      blocker.status !== "active" ||
      !sameDecisionSubject(blocker.target, record.target) ||
      !previous ||
      previous.status === "pending" ||
      previous.kind !== record.kind ||
      previous.respondentPrincipalId !== record.respondentPrincipalId ||
      (previous.kind === "continuation" &&
        (record.kind !== "continuation" ||
          previous.queueId !== record.queueId)) ||
      !previousAt ||
      record.requestedAt < previousAt
    )
      return storeBlocked("decision_blocker_reproposal_invalid");
  }
  if (
    !project ||
    ["accepted", "cancelled"].includes(project.milestone.state) ||
    project.milestoneId !== record.target.milestoneId ||
    project.repositoryRevision !== record.target.repositoryRevision ||
    project.generation !== record.target.generation ||
    decisionTargetState(project, record) === null ||
    ["accepted", "cancelled", "completed", "superseded"].includes(
      decisionTargetState(project, record) ?? "",
    ) ||
    (record.kind === "continuation" &&
      (record.target.kind !== "milestone" ||
        (project.milestone.state !== "human_decision_required" &&
          project.milestone.state !== "executing") ||
        !current.queueEntries.some(
          (queue) =>
            queue.queueId === record.queueId &&
            queue.projectId === project.projectId &&
            queue.milestoneId === project.milestoneId &&
            queue.repositoryRevision === project.repositoryRevision &&
            (queue.state === "human_decision_required" ||
              queue.state === "replan_required") &&
            queue.ownerGeneration === null &&
            !current.leaseIntents.some(
              (intent) => intent.queueId === queue.queueId,
            ),
        )))
  )
    return storeBlocked("decision_target_mismatch");
  return completed("decision_requested", {
    next: {
      ...current,
      decisions: [...current.decisions, record],
      blockers: blocker
        ? current.blockers.map((item) =>
            item === blocker
              ? { ...item, currentDecisionId: record.decisionId }
              : item,
          )
        : [...current.blockers, prepared.blocker],
      queueEntries:
        record.kind === "continuation"
          ? current.queueEntries.map((queue) =>
              queue.queueId === record.queueId &&
              (queue.state === "replan_required" ||
                queue.state === "human_decision_required")
                ? {
                    ...queue,
                    generation: queue.generation + 1,
                    state: "human_decision_required" as const,
                    resumeCondition: "human_decision",
                    resultReference: record.decisionId,
                  }
                : queue,
            )
          : current.queueEntries,
    },
    value: record,
  });
}

/** 用途に応じた判断を現在状態へ適用し、実際の前後状態を返す。 */
function applyDecisionToProject(
  project: ProjectExecutionState,
  record: Decision,
  answer: DecisionAnswer,
) {
  const previousState = decisionTargetState(project, record);
  if (previousState === null) return null;
  if (record.kind === "continuation") {
    if (
      record.target.kind !== "milestone" ||
      (previousState !== "human_decision_required" &&
        previousState !== "executing") ||
      (answer.selectedOption !== "resume" && answer.selectedOption !== "cancel")
    )
      return null;
    const nextState =
      answer.selectedOption === "resume"
        ? ("executing" as const)
        : ("cancelled" as const);
    return {
      project: {
        ...project,
        generation: project.generation + 1,
        decisionApplicationId: record.decisionId,
        milestone: { ...project.milestone, state: nextState },
      },
      previousState,
      nextState,
      blockerResolved: answer.selectedOption === "resume",
    };
  }
  const criteria =
    record.target.kind === "objective"
      ? project.objectives.find(
          (item) => item.definition.id === record.target.id,
        )?.definition.acceptanceCriteria
      : record.target.kind === "milestone"
        ? project.milestone.acceptanceCriteria
        : null;
  if (
    !criteria ||
    (record.target.kind === "objective"
      ? previousState !== "integration_pending"
      : previousState !== "integrating" ||
        !project.objectives.every((item) => item.state === "accepted")) ||
    !["accept", "return", "wait"].includes(answer.selectedOption) ||
    ((answer.selectedOption === "accept" ||
      (record.target.kind === "objective" &&
        answer.selectedOption === "return")) &&
      answer.evidenceIds.length !== criteria.length)
  )
    return null;
  if (answer.selectedOption === "wait")
    return {
      project,
      previousState,
      nextState: previousState,
      blockerResolved: false,
    };
  const nextState =
    answer.selectedOption === "accept"
      ? ("accepted" as const)
      : ("returned" as const);
  if (record.target.kind === "objective") {
    const objectives = project.objectives.map((item) =>
      item.definition.id === record.target.id
        ? {
            ...item,
            state: nextState,
            criterionEvidenceIds: answer.evidenceIds,
          }
        : item,
    );
    return {
      project: {
        ...project,
        generation: project.generation + 1,
        objectives,
        milestone: objectives.every((item) => item.state === "accepted")
          ? { ...project.milestone, state: "integrating" as const }
          : project.milestone,
      },
      previousState,
      nextState,
      blockerResolved: answer.selectedOption === "accept",
    };
  }
  return {
    project: {
      ...project,
      generation: project.generation + 1,
      milestone: {
        ...project.milestone,
        state: nextState,
        criterionEvidenceIds:
          answer.selectedOption === "accept"
            ? answer.evidenceIds
            : project.milestone.criterionEvidenceIds,
      },
    },
    previousState,
    nextState,
    blockerResolved: answer.selectedOption === "accept",
  };
}

/**
 * 回答・適用結果・Project・Queue・Blockerを一つの保存候補へまとめる。
 * @responsibility 同じ回答の再送は再適用せず、適用不能な回答も理由と共に残す。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input current: fresh State、decisionId: 現在の判断、answer: 認可済み回答、observedAt: 同Owner下の現在時刻。
 * @returns 全関連区画を含む一候補又は停止。
 * @precondition 主体と操作の認可は入口・保存接続側が確認する。
 * @postcondition 保存候補内で判断だけ又はQueueだけを先行確定しない。
 * @effect N/A: 同期の値構成だけ。
 * @failure 不正回答、別回答の再送、失効済みは停止。
 * @invariant 保留はBlockerを保持し、適用失敗で回答理由を失わない。
 * @boundary 判断の意味Ownerと唯一のWriter。
 * @security 回答日時を現在の許可にせず、状態変化をProvider実行やCleanup完了へ読み替えない。
 * @concurrency 一回CAS。元版の再検査はWriterが所有する。
 */
export function prepareDecisionSubmission<T extends DecisionSnapshot>(
  current: T,
  decisionId: string,
  answer: DecisionAnswer,
  observedAt: string,
) {
  let reply: DecisionAnswer;
  try {
    reply = JSON.parse(encodeStateValue(answer)) as DecisionAnswer;
  } catch {
    return storeBlocked("decision_answer_invalid");
  }
  const record = current.decisions.find(
    (item) => item.decisionId === decisionId,
  );
  if (!record || projectDecisionHistory(record) === null)
    return storeBlocked("decision_not_observed");
  if (record.status === "applied" || record.status === "answered")
    return encodeStateValue(record.result.answer) === encodeStateValue(reply)
      ? completed("decision_answer_already_recorded", {
          next: null,
          value: record,
        })
      : storeBlocked("decision_answer_conflict");
  if (record.status !== "pending") return storeBlocked("decision_not_pending");
  if (
    !current.blockers.some(
      (item) =>
        item.kind === "human_decision" &&
        item.blockerId === record.blockerId &&
        item.currentDecisionId === decisionId &&
        item.status === "active",
    )
  )
    return storeBlocked("decision_proposal_not_current");
  // 先に回答を検査する。状態適用の導出で不正な配列等へ触れない。
  if (
    !prepareDecisionAnswer(
      record,
      reply,
      null,
      "decision_application_not_evaluated",
    )
  )
    return storeBlocked("decision_answer_invalid");
  const observedEpoch = Date.parse(observedAt);
  if (
    !Number.isFinite(observedEpoch) ||
    new Date(observedEpoch).toISOString() !== observedAt ||
    reply.answeredAt > observedAt
  )
    return storeBlocked("decision_observation_time_invalid");
  const project = current.projects.find(
    (item) => item.projectId === record.target.projectId,
  );
  const queue =
    record.kind === "continuation"
      ? current.queueEntries.find((item) => item.queueId === record.queueId)
      : null;
  const queueValid =
    record.kind !== "continuation" ||
    (queue &&
      queue.projectId === record.target.projectId &&
      queue.milestoneId === record.target.milestoneId &&
      queue.repositoryRevision === record.target.repositoryRevision &&
      queue.state === "human_decision_required" &&
      queue.ownerGeneration === null &&
      !current.leaseIntents.some((item) => item.queueId === queue.queueId));
  const targetValid =
    project &&
    project.generation === record.target.generation &&
    project.milestoneId === record.target.milestoneId &&
    project.repositoryRevision === record.target.repositoryRevision;
  let applied =
    targetValid && queueValid
      ? applyDecisionToProject(project, record, reply)
      : null;
  const approval =
    reply.selectedOption === "accept" || reply.selectedOption === "resume";
  const approvals = new Map<
    string,
    Readonly<{ record: Decision; answer: DecisionAnswer }>
  >([[record.decisionId, { record, answer: reply }]]);
  let approvalPending = false;
  if (approval && applied && project) {
    for (const blocker of current.blockers) {
      if (
        blocker.status !== "active" ||
        !blockerAffectsDecision(blocker, record, project) ||
        blocker.blockerId === record.blockerId
      )
        continue;
      const other =
        blocker.kind === "human_decision"
          ? current.decisions.find(
              (item) => item.decisionId === blocker.currentDecisionId,
            )
          : null;
      const otherApplied = other?.result
        ? applyDecisionToProject(project, other, other.result.answer)
        : null;
      if (
        !other ||
        other.kind !== record.kind ||
        encodeStateValue(other.target) !== encodeStateValue(record.target) ||
        (other.kind === "continuation" &&
          (record.kind !== "continuation" ||
            other.queueId !== record.queueId)) ||
        other.status !== "answered" ||
        other.result.answer.selectedOption !== reply.selectedOption ||
        other.result.answer.answeredAt > observedAt ||
        !otherApplied ||
        encodeStateValue({
          ...otherApplied,
          project: {
            ...otherApplied.project,
            decisionApplicationId:
              record.kind === "continuation"
                ? applied.project.decisionApplicationId
                : otherApplied.project.decisionApplicationId,
          },
        }) !== encodeStateValue(applied)
      ) {
        approvalPending = true;
        break;
      }
      approvals.set(other.decisionId, {
        record: other,
        answer: other.result.answer,
      });
    }
    if (approvalPending) applied = null;
  }
  const application: DecisionApplication | null = applied
    ? {
        applicationId: record.decisionId,
        appliedAt: observedAt,
        beforeGeneration: record.target.generation,
        afterGeneration: applied.project.generation,
        previousState: applied.previousState,
        nextState: applied.nextState,
        blockerResolved: applied.blockerResolved,
      }
    : null;
  const candidate = prepareDecisionAnswer(
    record,
    reply,
    application,
    application
      ? null
      : !targetValid
        ? "decision_target_changed"
        : !queueValid
          ? "decision_queue_changed"
          : approvalPending
            ? "decision_scope_approval_pending"
            : "decision_application_conditions_unmet",
  );
  if (!candidate) return storeBlocked("decision_answer_invalid");
  const updated = new Map<string, Decision>([[decisionId, candidate.decision]]);
  if (application && approval) {
    for (const [id, entry] of approvals) {
      if (id === decisionId) continue;
      const joined = prepareDecisionApplication(entry.record, {
        ...application,
        applicationId: id,
      });
      if (!joined) return storeBlocked("decision_application_invalid");
      updated.set(id, joined.decision);
    }
  }
  const resolvedBlockers = new Set(
    [...updated.values()]
      .filter(
        (item) =>
          item.result?.status === "applied" &&
          item.result.application.blockerResolved,
      )
      .map((item) => item.blockerId),
  );
  const next = {
    ...current,
    decisions: current.decisions.map(
      (item) => updated.get(item.decisionId) ?? item,
    ),
    blockers: current.blockers.map((item) =>
      application &&
      reply.selectedOption === "cancel" &&
      item.status === "active" &&
      item.target.projectId === record.target.projectId &&
      item.target.milestoneId === record.target.milestoneId
        ? {
            ...item,
            status: "cancelled" as const,
            cancelledByDecisionId: decisionId,
          }
        : resolvedBlockers.has(item.blockerId)
          ? { ...item, status: "resolved" as const }
          : item.blockerId === record.blockerId
            ? {
                ...item,
                status: candidate.blockerResolved
                  ? ("resolved" as const)
                  : ("active" as const),
              }
            : item,
    ),
    projects: applied
      ? current.projects.map((item) =>
          item.projectId === applied.project.projectId ? applied.project : item,
        )
      : current.projects,
    queueEntries:
      applied && queue
        ? current.queueEntries.map((item) =>
            item.queueId === queue.queueId
              ? {
                  ...item,
                  generation: item.generation + 1,
                  state:
                    reply.selectedOption === "resume"
                      ? ("replan_required" as const)
                      : ("cancelled" as const),
                  resumeCondition:
                    reply.selectedOption === "resume"
                      ? "human_decision_applied"
                      : null,
                  resultReference: decisionId,
                }
              : item,
          )
        : current.queueEntries,
  };
  return completed(
    application ? "decision_applied" : "decision_answered_unapplied",
    { next, value: candidate.decision },
  );
}

/**
 * 判断更新の片側保存・過去回答の差替え・早過ぎる退役を拒否する。
 * @responsibility 用途固定候補を再導出し、判断・Blocker・Project・Queueの全組を照合する。
 * @trace ARCH-000004、ARCH-000008
 * @input current／next: 検査済みの同一RepositoryのTask View。
 * @returns 更新なし又は一回答・明示適用から再導出できる更新だけtrue。
 * @precondition Schema・参照・元改訂はcodecとWriterが確認する。
 * @postcondition 同じ回答の二度適用、Queueだけの先行変更を許可しない。
 * @effect N/A: 純粋な再導出のみ。
 * @failure 削除・再導出できない共同適用・不正な同時更新はfalse。
 * @invariant 退役は別の構造検査と、同Owner下の履歴確定Gateを必須とする。
 * @boundary State Writerの独立した意味検査。
 * @security 内容Hashだけを適用許可にしない。
 * @concurrency fresh元値とのCASは物理Writerが所有する。
 */
export function validateDecisionSnapshotTransition(
  current: DecisionSnapshot,
  next: DecisionSnapshot,
): boolean {
  try {
    const changes = next.decisions.filter(
      (record) =>
        !current.decisions.some(
          (old) => encodeStateValue(old) === encodeStateValue(record),
        ),
    );
    if (
      current.decisions.some(
        (old) =>
          !next.decisions.some(
            (record) => record.decisionId === old.decisionId,
          ),
      )
    )
      return false;
    if (changes.length === 0)
      return (
        encodeStateValue(
          current.blockers.filter((item) => item.kind === "human_decision"),
        ) ===
        encodeStateValue(
          next.blockers.filter((item) => item.kind === "human_decision"),
        )
      );
    return changes.some((change) => {
      const existing = current.decisions.find(
        (item) => item.decisionId === change.decisionId,
      );
      const candidate = existing
        ? change.status === "invalidated"
          ? prepareDecisionClosing(
              current,
              change.decisionId,
              change.status,
              change.closedAt,
              change.closeReason,
            )
          : existing.status === "answered" && change.status === "applied"
            ? prepareDecisionApplying(
                current,
                change.decisionId,
                change.result.application.appliedAt,
              )
            : change.result
              ? prepareDecisionSubmission(
                  current,
                  change.decisionId,
                  change.result.answer,
                  change.result.status === "applied"
                    ? change.result.application.appliedAt
                    : change.result.answer.answeredAt,
                )
              : null
        : change.status === "pending" ||
            change.status === "answered" ||
            change.status === "applied"
          ? (() => {
              const { status: _status, result: _result, ...request } = change;
              return change.result
                ? prepareDecisionRecording(
                    current,
                    request,
                    change.result.answer,
                    change.result.status === "applied"
                      ? change.result.application.appliedAt
                      : change.result.answer.answeredAt,
                  )
                : prepareDecisionCreation(current, request);
            })()
          : null;
      if (candidate?.status !== "completed" || !candidate.value.next)
        return false;
      return (
        ["decisions", "blockers", "projects", "queueEntries"] as const
      ).every(
        (key) =>
          encodeStateValue(candidate.value.next?.[key]) ===
          encodeStateValue(next[key]),
      );
    });
  } catch {
    return false;
  }
}

/**
 * 保存済み回答を変更せず、現在の対象条件で明示適用する候補を導く。
 * @responsibility freshな世代・Queueを既存回答検査と共有し、一回CASへまとめる。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 同Ownerの元値、decisionId: 判断ID、observedAt: 現在時刻。
 * @returns 適用候補又は同じ適用済み値。適用不能は停止。
 * @precondition 認証・現在認可は信頼入口で確認する。
 * @postcondition 元回答・履歴時刻を上書きせず、全関連区画を同時更新する。
 * @effect N/A: メモリ内の値操作だけ。
 * @failure 世代・Queue・状態の不一致は保存候補を返さない。
 * @invariant 保存済み回答を新たな認可として扱わない。
 * @boundary 回答記録と単一State Writer。
 * @security Provider再実行・Cleanupを行わない。
 * @concurrency 元版とのCASはWriterが確認する。
 */
export function prepareDecisionApplying<T extends DecisionSnapshot>(
  current: T,
  decisionId: string,
  observedAt: string,
) {
  const record = current.decisions.find(
    (item) => item.decisionId === decisionId,
  );
  if (!record || projectDecisionHistory(record) === null)
    return storeBlocked("decision_not_observed");
  if (record.status === "applied")
    return completed("decision_already_applied", { next: null, value: record });
  if (record.status !== "answered")
    return storeBlocked("decision_not_answered");
  if (
    !current.blockers.some(
      (item) =>
        item.kind === "human_decision" &&
        item.blockerId === record.blockerId &&
        item.currentDecisionId === decisionId &&
        item.status === "active",
    )
  )
    return storeBlocked("decision_proposal_not_current");
  const temporary = {
    ...current,
    decisions: current.decisions.map((item) =>
      item === record
        ? { ...record, status: "pending" as const, result: null }
        : item,
    ),
  };
  const evaluated = prepareDecisionSubmission(
    temporary,
    decisionId,
    record.result.answer,
    observedAt,
  );
  if (evaluated.status !== "completed") return evaluated;
  if (
    evaluated.value.value.result?.status !== "applied" ||
    !evaluated.value.next
  )
    return storeBlocked("decision_application_conditions_unmet");
  const applied = prepareDecisionApplication(
    record,
    evaluated.value.value.result.application,
  );
  if (!applied) return storeBlocked("decision_application_invalid");
  return completed("decision_applied", {
    next: {
      ...evaluated.value.next,
      decisions: evaluated.value.next.decisions.map((item) =>
        item.decisionId === decisionId ? applied.decision : item,
      ),
    },
    value: applied.decision,
  });
}

/**
 * 未適用判断を理由と共に明示閉鎖し、回答とBlockerを保持する。
 * @responsibility 明示無効化を記録し、適用済みを巻き戻さない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 現在State、decisionId/status/reason: 認可済み処置、closedAt: 現在時刻。
 * @returns 一回保存候補又は同じ閉鎖の再観測。
 * @precondition 現在認可は信頼入口が確認する。
 * @postcondition 閉鎖だけでQueue・Blockerを解消しない。
 * @effect N/A: 同期値操作のみ。
 * @failure 別の閉鎖・適用済みは拒否する。
 * @invariant 明示無効化しても回答を失わない。
 * @boundary 判断値と同じState Writer。
 * @security 自動回復・新しい操作許可を発行しない。
 * @concurrency 元版とのCASを必須にする。
 */
export function prepareDecisionClosing<T extends DecisionSnapshot>(
  current: T,
  decisionId: string,
  status: "invalidated",
  closedAt: string,
  reason: string,
) {
  const record = current.decisions.find(
    (item) => item.decisionId === decisionId,
  );
  if (!record || projectDecisionHistory(record) === null)
    return storeBlocked("decision_not_observed");
  if (record.status === "invalidated")
    return record.status === status && record.closeReason === reason
      ? completed("decision_already_closed", { next: null, value: record })
      : storeBlocked("decision_closure_conflict");
  if (
    !current.blockers.some(
      (item) =>
        item.kind === "human_decision" &&
        item.blockerId === record.blockerId &&
        item.currentDecisionId === decisionId &&
        item.status === "active",
    )
  )
    return storeBlocked("decision_proposal_not_current");
  const closed = prepareDecisionClosure(record, status, closedAt, reason);
  if (!closed) return storeBlocked("decision_closure_invalid");
  return completed("decision_closed", {
    next: {
      ...current,
      decisions: current.decisions.map((item) =>
        item === record ? closed : item,
      ),
    },
    value: closed,
  });
}

/**
 * 質問と回答を同じ操作で受け取る明示判断を、一回保存の候補へまとめる。
 * @responsibility 個別の要求・回答検査を再利用し、prepared記録の別保存を作らない。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input current: 同Ownerの元値、request: 認可済み質問、answer: 認証主体の回答、observedAt: 現在時刻。
 * @returns 要求・回答・適用を含む候補、同じ回答の再観測、又は停止。
 * @precondition 質問の発生条件と現在認可は入口が確認する。
 * @postcondition 不正回答なら要求だけを残さず、対象外の状態を変えない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 対象・世代・質問・回答の不一致は候補を返さない。
 * @invariant 中間pending状態を物理保存しない。実行再開や認証を代替しない。
 * @boundary 同じState内の判断区画と状態更新。
 * @security 入力のgetter等は要求・回答の既存捕捉へ通す。
 * @concurrency 元版とのCASは物理Writerが確認する。
 */
export function prepareDecisionRecording<T extends DecisionSnapshot>(
  current: T,
  request: DecisionRequest,
  answer: DecisionAnswer,
  observedAt: string,
) {
  const created = prepareDecisionCreation(current, request);
  if (created.status !== "completed") return created;
  return prepareDecisionSubmission(
    created.value.next ?? current,
    created.value.value.decisionId,
    answer,
    observedAt,
  );
}

/** 終了したBlockerに属する全提案が、現在状態・Queue・結果から未参照であることを確認する。 */
function blockerCanRetire(
  blockerId: string,
  current: DecisionSnapshot,
  next = current,
): boolean {
  const blocker = current.blockers.find((item) => item.blockerId === blockerId);
  const records = current.decisions.filter(
    (item) => item.blockerId === blockerId,
  );
  const references = new Set([
    blockerId,
    ...records.map((item) => item.decisionId),
  ]);
  return (
    blocker?.kind === "human_decision" &&
    blocker.status !== "active" &&
    records.length > 0 &&
    !next.projects.some(
      (project) =>
        (project.decisionApplicationId != null &&
          references.has(project.decisionApplicationId)) ||
        project.milestone.criterionEvidenceIds?.some((id) =>
          references.has(id),
        ) ||
        project.objectives.some((item) =>
          item.criterionEvidenceIds?.some((id) => references.has(id)),
        ),
    ) &&
    !next.queueEntries.some(
      (queue) =>
        queue.resultReference !== null && references.has(queue.resultReference),
    ) &&
    !next.results.some((result) => references.has(result.identity))
  );
}

/**
 * 判断と対応Blockerだけを除く退役候補を構成する。
 * @responsibility 履歴の同一本文確認前には現在の判断を削除しない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: fresh値、historySettlement: 同Owner下の固定履歴観測。
 * @returns 退役候補と件数、未確定なら停止。
 * @precondition 他の終端記録の退役はそのOwnerが先に候補化している。
 * @postcondition Open又は参照中の問題は全提案を保持し、中止根拠の参照先を単独で退役しない。
 * @effect 固定の同期観測だけ。保存・履歴追記を行わない。
 * @failure 履歴不在・別本文・観測不能は停止。
 * @invariant 記録IDや経過時間だけで退役しない。
 * @boundary 現在状態の退役と履歴の物理確定観測。
 * @security 観測から実行・回復の認可を生成しない。
 * @concurrency 同じ短期Ownerで観測・候補・保存を行う。
 */
export function prepareDecisionRetirement<T extends DecisionSnapshot>(
  current: T,
  historySettlement: (decision: Decision) => "recorded" | null,
) {
  const retired = new Set<string>();
  const blockers = new Set<string>();
  for (const blocker of current.blockers) {
    if (!blockerCanRetire(blocker.blockerId, current)) continue;
    blockers.add(blocker.blockerId);
  }
  // 残す問題が参照する中止根拠は残す。自己参照と共同退役は妨げない。
  let changed = true;
  while (changed) {
    changed = false;
    for (const blocker of current.blockers) {
      if (blockers.has(blocker.blockerId) || blocker.status !== "cancelled")
        continue;
      const cause = current.decisions.find(
        (item) => item.decisionId === blocker.cancelledByDecisionId,
      );
      if (cause && blockers.delete(cause.blockerId)) changed = true;
    }
  }
  for (const blocker of current.blockers) {
    if (!blockers.has(blocker.blockerId)) continue;
    for (const decision of current.decisions.filter(
      (item) => item.blockerId === blocker.blockerId,
    )) {
      if (historySettlement(decision) !== "recorded")
        return storeBlocked("decision_history_unconfirmed");
      retired.add(decision.decisionId);
    }
  }
  return completed("decision_records_retired", {
    next: retired.size
      ? {
          ...current,
          decisions: current.decisions.filter(
            (record) => !retired.has(record.decisionId),
          ),
          blockers: current.blockers.filter(
            (blocker) => !blockers.has(blocker.blockerId),
          ),
        }
      : null,
    value: retired.size,
  });
}

/**
 * 退役の値差分だけを検査する。履歴の実保存確認は同OwnerのWriterが追加で行う。
 * @responsibility 対応する判断・Blockerの同時除去と、残す判断の不変を検査する。
 * @trace ARCH-000004、ARCH-000008
 * @input current／next: 検査済みの同一保存区画。
 * @returns 退役候補の形状だけが成立する場合true。
 * @precondition この結果単独では退役を許可しない。
 * @postcondition 参照中・未適用・片側削除・残す回答の変更を拒否する。
 * @effect N/A: 値比較のみ。
 * @failure 不正な差分はfalse。
 * @invariant 履歴不存在を推定せず、物理確認を代替しない。
 * @boundary 純粋な共通遷移検査とWriterの履歴Gate。
 * @security 値の成立はAuthorityではない。
 * @concurrency 物理確定観測はWriterの短期Ownerが所有する。
 */
export function validateDecisionRetirement(
  current: DecisionSnapshot,
  next: DecisionSnapshot,
): boolean {
  const removed = current.decisions.filter(
    (record) =>
      !next.decisions.some((item) => item.decisionId === record.decisionId),
  );
  if (
    !removed.length ||
    removed.some((record) => !blockerCanRetire(record.blockerId, current, next))
  )
    return false;
  const ids = new Set(removed.map((record) => record.decisionId));
  const blockerIds = new Set(removed.map((record) => record.blockerId));
  if (
    next.blockers.some(
      (blocker) =>
        blocker.status === "cancelled" &&
        ids.has(blocker.cancelledByDecisionId),
    )
  )
    return false;
  if (next.decisions.some((record) => blockerIds.has(record.blockerId)))
    return false;
  return (
    encodeStateValue(next.decisions) ===
      encodeStateValue(
        current.decisions.filter((record) => !ids.has(record.decisionId)),
      ) &&
    encodeStateValue(next.blockers) ===
      encodeStateValue(
        current.blockers.filter(
          (blocker) => !blockerIds.has(blocker.blockerId),
        ),
      )
  );
}

/**
 * 既存Storeと同じ完了封筒へ候補又は読取り値を収める。
 * @responsibility 値の構築だけを共用し、保存完了を表さない。
 * @trace ARCH-000005、ARCH-000008
 * @input reason: 既存固定理由、value: 固定用途が導出した値。
 * @returns 元の三fieldと外側freezeを持つ候補結果。
 * @precondition 呼出し側が既存の局所検査を完了している。
 * @postcondition valueの追加freeze・cloneを行わない。
 * @effect N/A: 値の構築だけ。
 * @failure N/A: 検査は用途別関数が所有する。
 * @invariant completedはここでは候補生成・観測の完了であり、耐久保存の証明ではない。
 * @boundary Module内の非公開値constructor。
 * @security Authorityを発行しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/**
 * 既存Storeと同じ拒否封筒を構築する。
 * @responsibility 既存の未発行・回復参照なしの拒否形を維持する。
 * @trace ARCH-000005、ARCH-000008
 * @input reason: 用途別の既存固定理由。
 * @returns 元の五fieldと外側freezeを持つ拒否。
 * @precondition この純粋操作はI/Oを発行していない。
 * @postcondition 回復義務や任意Error本文を生成しない。
 * @effect N/A: 値の構築だけ。
 * @failure N/A: この関数自身は検査しない。
 * @invariant 永続化や実行の副作用を否定する一般的証明ではない。
 * @boundary Module内の非公開値constructor。
 * @security 秘密値・Path・Authorityを含めない。
 * @concurrency N/A: 共有状態を持たない。
 */
function storeBlocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/** 通常データだけを捕捉し、呼出し後の入力変更を候補から切り離す。 */
function capture<T>(value: T): T | null {
  try {
    return JSON.parse(encodeStateValue(value)) as T;
  } catch {
    return null;
  }
}

/** 空白だけの表示・理由を拒否する。本文を補完しない。 */
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** 日時の曖昧なローカル解釈を避け、UTCの正規表記だけを受理する。 */
function time(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

/** 回答本文だけの閉形式を検査する。現在認可と要求への適合は別に確認する。 */
function validAnswer(reply: DecisionAnswer): boolean {
  return Boolean(
    reply &&
      Object.keys(reply).sort().join() ===
        "answeredAt,evidenceIds,principalId,reason,selectedOption" &&
      isPrincipalId(reply.principalId) &&
      time(reply.answeredAt) &&
      ["resume", "cancel", "accept", "return", "wait"].includes(
        reply.selectedOption,
      ) &&
      (reply.reason === null || text(reply.reason)) &&
      Array.isArray(reply.evidenceIds) &&
      reply.evidenceIds.every((id) => typeof id === "string" && ID.test(id)) &&
      new Set(reply.evidenceIds).size === reply.evidenceIds.length,
  );
}

/** 適用の前後世代・時刻・保留と阻害解消の相関を検査する。 */
function validApplication(
  applied: DecisionApplication,
  target: DecisionTarget,
  reply: DecisionAnswer,
): boolean {
  const waiting = reply.selectedOption === "wait";
  return Boolean(
    applied &&
      Object.keys(applied).sort().join() ===
        "afterGeneration,applicationId,appliedAt,beforeGeneration,blockerResolved,nextState,previousState" &&
      typeof applied.applicationId === "string" &&
      ID.test(applied.applicationId) &&
      time(applied.appliedAt) &&
      applied.appliedAt >= reply.answeredAt &&
      applied.beforeGeneration === target.generation &&
      Number.isSafeInteger(applied.afterGeneration) &&
      applied.afterGeneration ===
        applied.beforeGeneration + (waiting ? 0 : 1) &&
      text(applied.previousState) &&
      applied.previousState.length <= 128 &&
      text(applied.nextState) &&
      applied.nextState.length <= 128 &&
      typeof applied.blockerResolved === "boolean" &&
      (reply.selectedOption !== "cancel" ||
        applied.nextState === "cancelled") &&
      applied.blockerResolved ===
        (reply.selectedOption === "accept" ||
          reply.selectedOption === "resume") &&
      (!waiting ||
        (!applied.blockerResolved &&
          applied.previousState === applied.nextState)),
  );
}

/** 判断対象の識別子・所属・業務世代を閉形式で確認する。 */
function validTarget(target: DecisionTarget): boolean {
  return Boolean(
    target &&
      Object.keys(target).sort().join() ===
        "generation,id,kind,milestoneId,projectId,repositoryRevision" &&
      [target.projectId, target.milestoneId, target.id].every(
        (id) => typeof id === "string" && ID.test(id),
      ) &&
      ["objective", "task", "milestone"].includes(target.kind) &&
      Number.isSafeInteger(target.generation) &&
      target.generation >= 1 &&
      typeof target.repositoryRevision === "string" &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(target.repositoryRevision) &&
      (target.kind !== "milestone" || target.id === target.milestoneId),
  );
}

/** 新判断要求の閉じた形と、種類・対象・選択肢の相関を検査する。 */
function validRequest(value: DecisionRequest): boolean {
  if (!value || typeof value !== "object") return false;
  const target = value.target;
  if (
    Object.keys(value).sort().join() !==
      (value.kind === "continuation"
        ? "blockerId,decisionId,kind,options,question,queueId,requestedAt,respondentPrincipalId,target"
        : "blockerId,decisionId,kind,options,question,requestedAt,respondentPrincipalId,target") ||
    !isPrincipalId(value.respondentPrincipalId) ||
    (value.kind === "continuation" &&
      (typeof value.queueId !== "string" || !ID.test(value.queueId))) ||
    typeof value.decisionId !== "string" ||
    !ID.test(value.decisionId) ||
    typeof value.blockerId !== "string" ||
    !ID.test(value.blockerId) ||
    !text(value.question) ||
    !time(value.requestedAt) ||
    !validTarget(target) ||
    !Array.isArray(value.options) ||
    value.options.length < 1 ||
    value.options.length > 3
  )
    return false;
  const allowed =
    value.kind === "continuation"
      ? ["resume", "cancel"]
      : value.kind === "acceptance"
        ? ["accept", "return", "wait"]
        : [];
  if (value.kind === "acceptance" && target.kind === "task") return false;
  return (
    new Set(value.options.map((option) => option?.value)).size ===
      value.options.length &&
    value.options.every(
      (option) =>
        option &&
        Object.keys(option).sort().join() === "label,value" &&
        allowed.includes(option.value) &&
        text(option.label),
    )
  );
}

/**
 * 判断要求と人間判断Blockerを同一保存用の候補として作る。
 * @responsibility 質問と選択肢の表示を保持し、所有者をAttemptへ広げない。
 * @trace ARCH-000004、ARCH-000008
 * @input request: 認可された新判断要求。
 * @returns 二つの値候補、又は不正入力ならnull。
 * @precondition 現在Stateの重複・対象存在・認可は保存接続側で検査する。
 * @postcondition 元入力と参照を共有せず、pendingとactiveを共同で返す。
 * @effect N/A: メモリ内の値構成のみ。
 * @failure 通常データ以外、未知field、対象・選択肢不整合はnull。
 * @invariant 保存又は進行可能を主張しない。
 * @boundary 内部の純粋候補とState Writer接続。
 * @security PrincipalやCapabilityを推測・発行しない。
 * @concurrency 現在版のCASはWriterの責務。
 */
export function prepareDecisionRequest(request: DecisionRequest): Readonly<{
  decision: Decision;
  blocker: Blocker;
}> | null {
  const value = capture(request);
  if (!value || !validRequest(value)) return null;
  return {
    decision: { ...value, status: "pending", result: null },
    blocker: {
      blockerId: value.blockerId,
      target: value.target,
      kind: "human_decision",
      currentDecisionId: value.decisionId,
      reason: value.question,
      status: "active",
    },
  };
}

/**
 * 検査済み状態遷移の結果と回答を一つの判断候補へ結合する。
 * @responsibility 回答未適用の理由と、保留を含む適用結果を区別する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input current: pending判断、answer: 回答、application: 実際の遷移候補、unappliedReason: 未適用理由。
 * @returns 新判断とBlocker処置。無効・相関不一致ならnull。
 * @precondition applicationは内部の用途別遷移から導く。外部入力を渡さない。
 * @postcondition 回答と適用を一つのState候補へ載せられる値で返す。
 * @effect N/A: 保存、実行、履歴追記は行わない。
 * @failure 不正形、選択肢差、適用前後不整合を拒否する。
 * @invariant 保留の適用はBlockerを解消しない。再回答を受理しない。
 * @boundary 新Schemaの純粋値候補。保存成否と認可はWriter接続側が所有する。
 * @security 回答者IDの形式を検査するが、認証済みとは扱わない。
 * @concurrency 重複再送の再観測と一回保存は保存接続側が所有する。
 */
export function prepareDecisionAnswer(
  current: Decision,
  answer: DecisionAnswer,
  application: DecisionApplication | null,
  unappliedReason: string | null,
): Readonly<{ decision: Decision; blockerResolved: boolean }> | null {
  const value = capture({ current, answer, application, unappliedReason });
  if (value?.current?.status !== "pending") return null;
  const { status, result, ...request } = value.current;
  if (status !== "pending" || result !== null || !validRequest(request))
    return null;
  const reply = value.answer;
  if (
    !validAnswer(reply) ||
    reply.principalId !== request.respondentPrincipalId ||
    reply.answeredAt < request.requestedAt ||
    !request.options.some((option) => option.value === reply.selectedOption)
  )
    return null;
  const applied = value.application;
  if (applied === null) {
    if (!text(value.unappliedReason)) return null;
    return {
      decision: {
        ...request,
        status: "answered",
        result: {
          answer: reply,
          status: "unapplied",
          reason: value.unappliedReason,
        },
      },
      blockerResolved: false,
    };
  }
  if (
    value.unappliedReason !== null ||
    !validApplication(applied, request.target, reply)
  )
    return null;
  return {
    decision: {
      ...request,
      status: "applied",
      result: { answer: reply, status: "applied", application: applied },
    },
    blockerResolved: applied.blockerResolved,
  };
}

/** 既存の未終端判断を再構成し、元値の矛盾・未知fieldを捨てずに拒否する。 */
function captureOpenDecision(current: Decision): Decision | null {
  const value = capture(current);
  if (value?.status !== "pending" && value?.status !== "answered") return null;
  const { status, result, ...request } = value;
  const prepared = prepareDecisionRequest(request);
  if (!prepared) return null;
  let rebuilt = prepared.decision;
  if (status === "answered") {
    if (result?.status !== "unapplied") return null;
    const answered = prepareDecisionAnswer(
      prepared.decision,
      result.answer,
      null,
      result.reason,
    );
    if (!answered) return null;
    rebuilt = answered.decision;
  }
  return encodeStateValue(rebuilt) === encodeStateValue(value) ? rebuilt : null;
}

/**
 * 回答済み判断を、後から導いた状態遷移結果へ結合する。
 * @responsibility 元の回答を変えず、要求時世代との照合を維持する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 未適用の回答、application: 用途別状態遷移の結果。
 * @returns 適用候補又はnull。
 * @precondition 現在世代と認可はWriter接続側で再検査する。
 * @postcondition 回答者・回答日時・選択・理由を不変にする。
 * @effect N/A: メモリ内の値構成のみ。
 * @failure 回答前、適用済み、失効、不正結果はnull。
 * @invariant 後からの適用を新しい回答として記録しない。
 * @boundary 内部候補。保存成功・実行再開を意味しない。
 * @security 保存済み回答を、現在の実行許可にしない。
 * @concurrency 現在対象とのCASはWriterが所有する。
 */
export function prepareDecisionApplication(
  current: Decision,
  application: DecisionApplication,
) {
  const value = captureOpenDecision(current);
  if (value?.status !== "answered") return null;
  return prepareDecisionAnswer(
    { ...value, status: "pending", result: null },
    value.result.answer,
    application,
    null,
  );
}

/**
 * 未適用判断を明示無効化し、判断要求だけを閉じる。
 * @responsibility 既存回答を保持し、適用済み判断を未適用へ巻き戻さない。
 * @trace ARCH-000004、ARCH-000008
 * @input current: pending又はanswered、status: 閉鎖種別、closedAt: 観測時刻、reason: 理由。
 * @returns 閉じた判断候補又はnull。
 * @precondition 失効の実施許可は呼出し側が確認する。
 * @postcondition 回答を失わず、閉鎖理由・時刻を保持する。
 * @effect N/A: 値構成のみ。
 * @failure 不正時刻・適用済み・二重閉鎖はnull。
 * @invariant 閉鎖だけでBlocker解消やTask再開を意味しない。
 * @boundary 内部候補とState保存。
 * @security 保存済み値を新たな操作許可にしない。
 * @concurrency 現在版比較はWriterが所有する。
 */
export function prepareDecisionClosure(
  current: Decision,
  status: "invalidated",
  closedAt: string,
  reason: string,
): Decision | null {
  const value = captureOpenDecision(current);
  if (
    !value ||
    (value.status !== "pending" && value.status !== "answered") ||
    status !== "invalidated" ||
    !time(closedAt) ||
    closedAt < value.requestedAt ||
    (value.result && closedAt < value.result.answer.answeredAt) ||
    !text(reason)
  )
    return null;
  return { ...value, status, closedAt, closeReason: reason };
}

/**
 * 判断そのものから、要求・回答・適用・失効の履歴を再構成する。
 * @responsibility 安定したEvent IDと本文で再追記照合できる内容を返す。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input current: 新判断契約の保存候補。
 * @returns 出来事順のイベント、又は不整合ならnull。
 * @precondition 本文を保存から読む場合は保存OwnerがSchemaも検査する。
 * @postcondition 元要求、理由、主体、実際の状態変化を履歴だけで読める。
 * @effect N/A: 履歴を読書きしない。
 * @failure 未知field・状態と結果の矛盾をnullで拒否する。
 * @invariant historyPendingや保存済みフラグを作らない。
 * @boundary 値投影と履歴Writer。履歴確定はこの関数から主張しない。
 * @security Capability、認証値、保存Pathを追加しない。
 * @concurrency 同じ記録から同じID・本文を導く。排他はWriterが所有する。
 */
export function projectDecisionHistory(
  current: Decision,
): readonly DecisionHistoryEvent[] | null {
  const value = capture(current);
  if (!value) return null;
  const commonRequest = {
    decisionId: value.decisionId,
    blockerId: value.blockerId,
    respondentPrincipalId: value.respondentPrincipalId,
    target: value.target,
    question: value.question,
    requestedAt: value.requestedAt,
  };
  const request: DecisionRequest =
    value.kind === "continuation"
      ? {
          ...commonRequest,
          kind: value.kind,
          options: value.options,
          queueId: value.queueId,
        }
      : { ...commonRequest, kind: value.kind, options: value.options };
  const prepared = prepareDecisionRequest(request);
  if (!prepared) return null;
  let rebuilt: Decision = prepared.decision;
  if (value.result) {
    const answered = prepareDecisionAnswer(
      prepared.decision,
      value.result.answer,
      value.result.status === "applied" ? value.result.application : null,
      value.result.status === "unapplied" ? value.result.reason : null,
    );
    if (!answered) return null;
    rebuilt = answered.decision;
  }
  if (value.status === "invalidated") {
    const closed = prepareDecisionClosure(
      rebuilt,
      value.status,
      value.closedAt,
      value.closeReason,
    );
    if (!closed) return null;
    rebuilt = closed;
  }
  if (encodeStateValue(rebuilt) !== encodeStateValue(value)) return null;
  const common = {
    decisionId: request.decisionId,
    blockerId: request.blockerId,
    respondentPrincipalId: request.respondentPrincipalId,
    target: request.target,
    question: request.question,
    options: request.options,
  };
  const events: DecisionHistoryEvent[] = [
    {
      ...common,
      eventId: `${request.decisionId}:requested`,
      occurredAt: request.requestedAt,
      kind: "decision_requested",
    },
  ];
  if (value.result) {
    events.push({
      ...common,
      eventId: `${request.decisionId}:answered`,
      occurredAt: value.result.answer.answeredAt,
      kind: "decision_answered",
      answer: value.result.answer,
    });
    if (value.result.status === "applied")
      events.push({
        ...common,
        eventId: `${request.decisionId}:applied`,
        occurredAt: value.result.application.appliedAt,
        kind: "decision_applied",
        answer: value.result.answer,
        application: value.result.application,
      });
  }
  if (value.status === "invalidated")
    events.push({
      ...common,
      eventId: `${request.decisionId}:${value.status}`,
      occurredAt: value.closedAt,
      kind: "decision_invalidated",
      reason: value.closeReason,
    });
  return events;
}

/**
 * 判断モデルを既存の再構成検査で捕捉する。
 * @responsibility 公開表示のOwnerへ保存codecや履歴投影の内部手順を渡さない。
 * @trace ARCH-000008
 * @input value: 未検証の判断値。
 * @returns 独立した正規モデル、又はnull。
 * @effect N/A: 値の捕捉と検査のみ。
 * @failure 不正形、未知field、状態・回答・適用の不整合はnull。
 * @boundary モデル値と外部の結果検査。
 * @security 保存値を認証・認可へ昇格しない。
 */
export function inspectDecision(value: unknown): Decision | null {
  try {
    const captured = JSON.parse(encodeStateValue(value));
    return projectDecisionHistory(captured) === null
      ? null
      : Object.freeze(captured);
  } catch {
    return null;
  }
}

/**
 * 独立した履歴行の判断イベントを閉形式で検査する。
 * @responsibility 退役後も質問・回答・適用を読める正規値だけを受理する。
 * @trace ARCH-000004、ARCH-000005、ARCH-000008
 * @input input: 履歴から復号した未信頼値。
 * @returns 捕捉済みイベント又はnull。
 * @precondition 認証や現在状態の存在を履歴から推定しない。
 * @postcondition 不正なID・本文・相関・未知fieldを補完しない。
 * @effect N/A: 通常データの同期検査のみ。
 * @failure 不正形・時刻・選択肢混同・状態矛盾はnull。
 * @invariant 履歴イベントは現在の実行又は回復Authorityではない。
 * @boundary 長期履歴codecと判断値。
 * @security getter・Proxyを評価せず秘密値を追加しない。
 * @concurrency 同期処理。実体と同一ID本文は履歴Writerが確認する。
 */
export function inspectDecisionHistoryEvent(
  input: unknown,
): DecisionHistoryEvent | null {
  try {
    const value = capture(input) as DecisionHistoryEvent | null;
    if (
      !value ||
      typeof value !== "object" ||
      !ID.test(value.decisionId) ||
      typeof value.decisionId !== "string" ||
      typeof value.blockerId !== "string" ||
      !ID.test(value.blockerId) ||
      !isPrincipalId(value.respondentPrincipalId) ||
      !time(value.occurredAt) ||
      !validTarget(value.target) ||
      !text(value.question) ||
      !Array.isArray(value.options) ||
      value.options.length < 1 ||
      value.options.length > 3
    )
      return null;
    const choices = value.options.map((option) => option?.value);
    const family = choices.some(
      (choice) => choice === "resume" || choice === "cancel",
    )
      ? ["resume", "cancel"]
      : ["accept", "return", "wait"];
    if (
      new Set(choices).size !== choices.length ||
      value.options.some(
        (option) =>
          !option ||
          Object.keys(option).sort().join() !== "label,value" ||
          !family.includes(option.value) ||
          !text(option.label),
      )
    )
      return null;
    const common = [
      "eventId",
      "decisionId",
      "blockerId",
      "respondentPrincipalId",
      "target",
      "question",
      "options",
      "occurredAt",
      "kind",
    ];
    const suffix =
      value.kind === "decision_requested"
        ? "requested"
        : value.kind === "decision_answered"
          ? "answered"
          : value.kind === "decision_applied"
            ? "applied"
            : value.kind === "decision_invalidated"
              ? "invalidated"
              : null;
    if (!suffix || value.eventId !== `${value.decisionId}:${suffix}`)
      return null;
    if (
      value.kind === "decision_answered" ||
      value.kind === "decision_applied"
    ) {
      common.push("answer");
      if (
        !validAnswer(value.answer) ||
        value.answer.principalId !== value.respondentPrincipalId ||
        !choices.includes(value.answer.selectedOption) ||
        value.occurredAt < value.answer.answeredAt
      )
        return null;
      if (value.kind === "decision_applied") {
        common.push("application");
        if (
          !validApplication(value.application, value.target, value.answer) ||
          value.application.appliedAt !== value.occurredAt
        )
          return null;
      } else if (value.answer.answeredAt !== value.occurredAt) return null;
    } else if (value.kind === "decision_invalidated") {
      common.push("reason");
      if (!text(value.reason)) return null;
    }
    return Object.keys(value).sort().join() === common.sort().join()
      ? value
      : null;
  } catch {
    return null;
  }
}

/**
 * 同一State内の判断と阻害条件を閉じた集合として照合する。
 * @responsibility 重複・孤立・別対象への付替え・Blocker解消の片側更新を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input decisions／blockers: 復号した集合、projectIds: 同じStateのProject ID。
 * @returns 全記録と相関が成立する場合だけtrue。
 * @precondition Project自体の定義検査は保存codecが所有する。
 * @postcondition 既定値や旧形式変換で不足を補完しない。
 * @effect N/A: 同期の値検査のみ。
 * @failure 不正形・未知field・参照不一致・過大集合はfalse。
 * @invariant JSONの成立を認可又は実行可能性の根拠にしない。
 * @boundary 新State Schemaの内部codecと判断モデル。
 * @security 外部入力のgetter・Proxyを評価しない。
 * @concurrency 現在版との遷移比較は別のWriter検査が所有する。
 */
export function validateDecisionCollections(
  decisions: unknown,
  blockers: unknown,
  projectIds: readonly string[],
): boolean {
  try {
    const value = capture({ decisions, blockers });
    if (
      !value ||
      !Array.isArray(value.decisions) ||
      !Array.isArray(value.blockers)
    )
      return false;
    const records = value.decisions as Decision[];
    const conditions = value.blockers as Blocker[];
    if (
      new Set(records.map((record) => record?.decisionId)).size !==
        records.length ||
      new Set(conditions.map((condition) => condition?.blockerId)).size !==
        conditions.length ||
      records.some((record) => projectDecisionHistory(record) === null)
    )
      return false;
    for (const condition of conditions) {
      if (
        !condition ||
        Object.keys(condition).sort().join() !==
          (condition.status === "cancelled"
            ? "blockerId,cancelledByDecisionId,currentDecisionId,kind,reason,status,target"
            : "blockerId,currentDecisionId,kind,reason,status,target") ||
        typeof condition.blockerId !== "string" ||
        !ID.test(condition.blockerId) ||
        !text(condition.reason) ||
        !["active", "resolved", "cancelled"].includes(condition.status) ||
        !validTarget(condition.target) ||
        !projectIds.includes(condition.target.projectId)
      )
        return false;
      if (condition.status === "cancelled") {
        const cause = records.find(
          (item) => item.decisionId === condition.cancelledByDecisionId,
        );
        if (
          cause?.kind !== "continuation" ||
          cause.target.kind !== "milestone" ||
          cause.target.projectId !== condition.target.projectId ||
          cause.target.milestoneId !== condition.target.milestoneId ||
          cause.target.generation < condition.target.generation ||
          cause.result?.status !== "applied" ||
          cause.result.answer.selectedOption !== "cancel"
        )
          return false;
      }
      if (condition.kind === "human_decision") {
        const first = records.find(
          (item) => item.blockerId === condition.blockerId,
        );
        const record = records.find(
          (item) => item.decisionId === condition.currentDecisionId,
        );
        if (
          !record ||
          !first ||
          condition.reason !== first.question ||
          encodeStateValue(first.target) !==
            encodeStateValue(condition.target) ||
          record.blockerId !== condition.blockerId ||
          !sameDecisionSubject(record.target, condition.target) ||
          (condition.status === "resolved") !==
            (record.result?.status === "applied" &&
              record.result.application.blockerResolved) ||
          (record.result?.status === "applied" &&
            record.result.answer.selectedOption === "cancel" &&
            (condition.status !== "cancelled" ||
              condition.cancelledByDecisionId !== record.decisionId))
        )
          return false;
      } else if (
        !["dependency", "input", "resource", "recovery"].includes(
          condition.kind,
        ) ||
        condition.currentDecisionId !== null
      )
        return false;
    }
    return records.every((record) =>
      conditions.some(
        (condition) =>
          condition.kind === "human_decision" &&
          condition.blockerId === record.blockerId &&
          sameDecisionSubject(condition.target, record.target) &&
          records.some(
            (current) =>
              current.decisionId === condition.currentDecisionId &&
              current.kind === record.kind &&
              current.respondentPrincipalId === record.respondentPrincipalId &&
              current.requestedAt >= record.requestedAt &&
              (current.kind !== "continuation" ||
                (record.kind === "continuation" &&
                  current.queueId === record.queueId)) &&
              (record.decisionId === current.decisionId ||
                (record.status !== "pending" &&
                  !(
                    record.result?.status === "applied" &&
                    (record.result.application.blockerResolved ||
                      record.result.answer.selectedOption === "cancel")
                  ))),
          ),
      ),
    );
  } catch {
    return false;
  }
}

/**
 * 同じ問題の対象を比較し、提案時点の世代・Revisionは各提案に保持する。
 * @responsibility 問題の所属ID比較だけを共用し、現在世代の実行可否検査を代替しない。
 * @trace ARCH-000004、ARCH-000008
 * @input left/right: 検査済み提案又はBlockerの対象。
 * @returns 同じProject・Milestone・対象種別・対象IDならtrue。
 * @effect N/A: 値比較のみ。
 * @failure 不正な対象の捕捉は呼出し側が行う。
 * @boundary 内部の判断値契約。
 */
export function sameDecisionSubject(
  left: DecisionTarget,
  right: DecisionTarget,
): boolean {
  return (
    left.projectId === right.projectId &&
    left.milestoneId === right.milestoneId &&
    left.kind === right.kind &&
    left.id === right.id
  );
}
