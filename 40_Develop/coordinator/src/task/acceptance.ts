/**
 * Taskの結果受領・回復結果の確認を純粋な状態遷移として所有する。
 * @responsibility Taskの結果受領・回復結果の確認を純粋な状態遷移として所有する。
 * @trace ARCH-000004
 */

import { projectState } from "../state/projection.ts";
import type { CoordinatorState, StateResult } from "../state/types.ts";
import {
  isCoordinatorRecoveryIdentity,
  snapshotPlainRecord,
  validIdentity,
} from "../state/validation.ts";
import { replaceTask } from "./lifecycle.ts";
import type {
  ProjectDockerRecoveryAcknowledgement,
  ProjectResultAcceptance,
} from "./types.ts";

/**
 * 清掃済み通常Taskの結果受領集合を同じ現在状態へ固定する。
 * @responsibility 通常終端と結果受領を回復義務から分離し、Attempt別の固定本文を所有する。
 * @trace ARCH-000004
 * @input state: 未保存の終端候補、expectedGeneration: 保存済み元世代、taskId: 対象Task、acceptances: 全結果の受領本文。
 * @returns 全件相関を確認した次候補、または元状態を保持した拒否。
 * @precondition 組立てOwnerは元Taskの全fresh結果を取得済みであり、通常終端候補は元世代の次世代である。
 * @postcondition 初回受領世代を固定し、通常Taskを回復待ちへ変更しない。
 * @effect N/A: 値導出だけ。耐久保存と下位ACKは呼出し側の責務。
 * @failure 未清掃・未終端・未解決義務・別Attempt・重複・本文変更を拒否する。
 * @invariant ACKからcleanup成立を補完せず、同じ集合の再入場で世代を書き換えない。
 * @boundary 通常Taskの状態モデルと上位耐久保存。
 * @security 受領本文からProviderや回復Authorityを発行しない。
 * @concurrency 次世代候補へ全件を固定し、終端とACKで保存世代を二度進めない。
 */
export function recordProjectTaskResultAcceptances(
  state: CoordinatorState,
  expectedGeneration: number,
  taskId: string,
  acceptances: readonly unknown[],
): StateResult {
  const rejected = Object.freeze({
    status: "blocked" as const,
    reason: "orchestrator_task_result_acceptance_mismatch",
    state,
    taskIds: Object.freeze([]),
  });
  const task = state.tasks.find((entry) => entry.definition.id === taskId);
  if (
    state.generation !== expectedGeneration + 1 ||
    !task ||
    !["completed", "failed", "cancelled"].includes(task.state) ||
    task.startPhase !== "settled" ||
    !task.cleanupConfirmed ||
    task.recoveryUnresolved ||
    task.recoveryObligations.some(
      (entry) =>
        entry.phase !== (entry.kind === "docker" ? "acknowledged" : "settled"),
    ) ||
    !Array.isArray(acceptances) ||
    acceptances.length > 128
  )
    return rejected;
  const decodedAcceptances = Array.from(
    acceptances,
    decodeProjectResultAcceptance,
  );
  if (
    decodedAcceptances.some(
      (entry) =>
        !entry ||
        !validIdentity(entry.repositoryBindingId) ||
        !isCoordinatorRecoveryIdentity(entry.recoveryId) ||
        entry.projectId !== state.projectId ||
        entry.milestoneId !== state.milestoneId ||
        entry.taskId !== taskId ||
        entry.attemptId !== task.attemptId ||
        entry.operationId !== task.operationId ||
        task.recoveryObligations.some(
          (obligation) => obligation.recoveryId === entry.recoveryId,
        ),
    ) ||
    new Set(decodedAcceptances.map((entry) => entry?.recoveryId)).size !==
      decodedAcceptances.length ||
    new Set(decodedAcceptances.map((entry) => entry?.repositoryBindingId))
      .size > 1 ||
    new Set(decodedAcceptances.map((entry) => entry?.repositoryBinding)).size >
      1
  )
    return rejected;
  const verifiedAcceptances =
    decodedAcceptances as readonly ProjectResultAcceptance[];
  if (task.resultAcceptances.length > 0) {
    if (
      task.resultAcceptances.length !== verifiedAcceptances.length ||
      task.resultAcceptances.some((stored) => {
        const incoming = verifiedAcceptances.find(
          (entry) => entry.recoveryId === stored.recoveryId,
        );
        return (
          !incoming ||
          (Object.keys(stored) as (keyof ProjectResultAcceptance)[]).some(
            (key) => stored[key] !== incoming[key],
          )
        );
      })
    )
      return rejected;
    return Object.freeze({
      status: "completed",
      reason: "orchestrator_task_results_already_accepted",
      state,
      taskIds: Object.freeze([taskId]),
    });
  }
  if (
    verifiedAcceptances.some(
      (entry) => entry.settlementGeneration !== state.generation,
    )
  )
    return rejected;
  if (verifiedAcceptances.length === 0)
    return Object.freeze({
      status: "completed",
      reason: "orchestrator_task_results_absent",
      state,
      taskIds: Object.freeze([taskId]),
    });
  const tasks = replaceTask(state, taskId, (current) =>
    Object.freeze({
      ...current,
      resultAcceptances: Object.freeze([...verifiedAcceptances]),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_task_results_accepted",
    state: projectState({ ...state, tasks }),
    taskIds: Object.freeze([taskId]),
  });
}

/**
 * Project Docker 回復 Obligationを確認済みとして記録する。
 *
 * @responsibility Project Docker 回復 Obligationの確認入力、状態遷移、重複処理境界を所有する。
 * @trace ARCH-000004
 * @input state: CoordinatorState、expectedGeneration: number、acknowledgement: ProjectDockerRecoveryAcknowledgement
 * @returns StateResultを返す。
 * @precondition 「state: CoordinatorState、expectedGeneration: number、acknowledgement: ProjectDockerRecoveryAcknowledgement」がacknowledgeProjectDockerRecoveryObligationの入力契約を満たす。
 * @postcondition 受領本文は同時に保存する次の業務世代を参照し、保存前の世代と混同しない。
 * @effect N/A: acknowledgeProjectDockerRecoveryObligationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 受領本文、世代、Project／Milestone／Task／Attempt／Operation、Repository Binding又はsettled済みDocker回復参照が一致しない場合は、元状態を保持してblockedを返す。
 * @invariant acknowledgeProjectDockerRecoveryObligationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: acknowledgeProjectDockerRecoveryObligationはProcess内の同一Subsystemで完結する。
 * @security N/A: acknowledgeProjectDockerRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: acknowledgeProjectDockerRecoveryObligationは共有非同期状態を持たない同期処理である。
 */
export function acknowledgeProjectDockerRecoveryObligation(
  state: CoordinatorState,
  expectedGeneration: number,
  acknowledgement: ProjectDockerRecoveryAcknowledgement,
): StateResult {
  const acceptance = decodeProjectResultAcceptance(acknowledgement);
  if (!acceptance)
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_docker_recovery_acknowledgement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const task = state.tasks.find(
    (candidate) => candidate.definition.id === acceptance.taskId,
  );
  if (
    state.generation !== expectedGeneration ||
    acceptance.settlementGeneration !== expectedGeneration + 1 ||
    acceptance.projectId !== state.projectId ||
    acceptance.milestoneId !== state.milestoneId ||
    !validIdentity(acceptance.repositoryBindingId) ||
    !task ||
    task.state !== "recovery_required" ||
    task.attemptId !== acceptance.attemptId ||
    task.operationId !== acceptance.operationId ||
    !task.recoveryObligations.some(
      (entry) =>
        entry.kind === "docker" &&
        entry.recoveryId === acceptance.recoveryId &&
        entry.phase === "settled",
    ) ||
    !isCoordinatorRecoveryIdentity(acceptance.recoveryId)
  )
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_docker_recovery_acknowledgement_mismatch",
      state,
      taskIds: Object.freeze([]),
    });
  const frozen = acceptance;
  const tasks = replaceTask(state, acceptance.taskId, (current) =>
    Object.freeze({
      ...current,
      recoveryObligations: Object.freeze(
        current.recoveryObligations.map((entry) =>
          entry.kind === "docker" && entry.recoveryId === acceptance.recoveryId
            ? Object.freeze({
                ...entry,
                phase: "acknowledged" as const,
                acknowledgement: frozen,
              })
            : entry,
        ),
      ),
    }),
  );
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_docker_recovery_acknowledged",
    state: projectState({ ...state, generation: state.generation + 1, tasks }),
    taskIds: Object.freeze([acceptance.taskId]),
  });
}

/**
 * 新しい結果受理本文の閉じた形式を検査する。
 * @responsibility 欠落・追加項目・旧形式と不正な識別子、Hash、世代を拒否する。
 * @trace ARCH-000004
 * @input value: 未検証の受理本文。
 * @returns 検査済み固定本文、またはnull。
 * @precondition N/A: 任意の入力を拒否可能な境界として扱う。
 * @postcondition 初回受理世代や入力の値を補完・更新しない。
 * @effect N/A: 局所値の検査だけ。
 * @failure 不正本文、getter、Proxy、欠落、旧項目、空値はnull。
 * @invariant 形式成立を保存・受理・cleanup成立へ昇格しない。
 * @boundary 上位の保存本文とその利用側。
 * @security 外部Authorityを発行せず入力の関数を呼ばない。
 * @concurrency N/A: 共有状態を持たない同期処理。
 */
export function decodeProjectResultAcceptance(
  value: unknown,
): ProjectResultAcceptance | null {
  const acceptance = snapshotPlainRecord(
    value,
    new Set([
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "repositoryBinding",
      "resultId",
      "consumer",
    ]),
  );
  if (
    !acceptance ||
    [
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
    ].some(
      (key) =>
        typeof acceptance[key] !== "string" ||
        acceptance[key].length === 0 ||
        acceptance[key].length > 1024,
    ) ||
    !Number.isSafeInteger(acceptance.settlementGeneration) ||
    Number(acceptance.settlementGeneration) < 1 ||
    acceptance.consumer !== "orchestrator" ||
    [acceptance.repositoryBinding, acceptance.resultId].some(
      (item) => typeof item !== "string" || !/^[a-f0-9]{64}$/u.test(item),
    )
  )
    return null;
  return Object.freeze(acceptance) as ProjectResultAcceptance;
}

/**
 * 本番利用側に固定された結果受領方式を返す。
 * @responsibility 一時的な返却と後続再開用の耐久ACKを区別する。
 * @trace ARCH-000008
 * @input consumer: 固定組立てが選択した利用側識別子。
 * @returns transient、durable、または未知利用側のnull。
 * @precondition N/A: 未知値も受け取り拒否する。
 * @postcondition Coordinatorの耐久受領を入力指定で降格しない。
 * @effect N/A: 値の同期判定だけで保存や配送を行わない。
 * @failure 未知識別子・非文字列ではnull。
 * @invariant 受領方式は資源回収やCandidate保全の証明ではない。
 * @boundary 本番組立ての利用側と保存モデルの固定契約。
 * @security Objectの変換・getter・Proxyを評価しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function coordinatorConsumerCompletionPolicy(
  consumer: unknown,
): "transient" | "durable" | null {
  if (consumer === "orchestrator") return "durable";
  if (consumer === "coordinator_cli" || consumer === "workbench")
    return "transient";
  return null;
}

/**
 * Task結果受領集合の遷移が固定本文・初回世代と競合するか判定する。
 * @responsibility 同一Attemptの受領不変と明示再計画の限定的な置換条件を所有する。
 * @trace ARCH-000004、ARCH-000008
 * @input previous: Lock内で読み直した元Project、state: 保存候補。
 * @returns 受領差が保存を拒否すべき場合だけtrue。
 * @precondition 両状態は構造検査済み。Writerが元世代と受付結合を別途照合する。
 * @postcondition 入力を変更せず、受領の欠測を補完しない。
 * @effect N/A: 同期値判定だけ。
 * @failure 初回受領の世代差・固定本文変更は競合。
 * @invariant 判定を実資源回収・保存成功へ読み替えない。
 * @boundary Taskの受領意味と統合保存Writer。
 * @security 保存・実行Authorityを発行しない。
 * @concurrency Writerは同じ短期Lock内のfresh元版に対して呼ぶ。
 */
export function hasProjectTaskResultAcceptanceConflict(
  previous: CoordinatorState | undefined,
  state: CoordinatorState,
): boolean {
  return state.tasks.some((task) => {
    if (!previous) return task.resultAcceptances.length !== 0;
    const prior = previous?.tasks.find(
      (item) => item.definition.id === task.definition.id,
    );
    const isSameAttempt =
      prior?.attemptId === task.attemptId &&
      prior?.operationId === task.operationId;
    if (
      prior?.state === "failed" &&
      prior.supersededBy === null &&
      task.state === "superseded" &&
      task.resultAcceptances.length === 0 &&
      task.supersededBy !== null &&
      !previous.tasks.some(
        (item) => item.definition.id === task.supersededBy,
      ) &&
      state.tasks.some(
        (item) =>
          item.definition.id === task.supersededBy &&
          item.definition.objectiveId === prior.definition.objectiveId &&
          item.attemptId === null &&
          item.operationId === null &&
          item.resultAcceptances.length === 0 &&
          (item.state === "ready" || item.state === "waiting_dependency"),
      )
    )
      return false;
    if (!isSameAttempt || !prior?.resultAcceptances.length)
      return task.resultAcceptances.some(
        (item) => item.settlementGeneration !== state.generation,
      );
    return (
      prior.resultAcceptances.length !== task.resultAcceptances.length ||
      prior.resultAcceptances.some((item) => {
        const next = task.resultAcceptances.find(
          (value) => value.recoveryId === item.recoveryId,
        );
        return (
          !next ||
          Object.entries(item).some(
            ([key, value]) => next[key as keyof typeof next] !== value,
          )
        );
      })
    );
  });
}
