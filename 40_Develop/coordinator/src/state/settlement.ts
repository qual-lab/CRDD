/**
 * state/settlement.tsの値契約と判定を所有する。
 * @responsibility 移管元と同じ状態値・相関を扱い、保存・実行Effectを発行しない。
 * @trace ARCH-000004、ARCH-000008
 */
import {
  type CoordinatorTaskSettlementFact,
  type CoordinatorStoredTask,
  type CoordinatorUnifiedSnapshot,
  type decodeCoordinatorUnifiedSnapshot,
  hasRuntimeStateRecordKeys as exactRecordKeys,
  validCoordinatorState,
  type CoordinatorState,
  decodeProjectResultAcceptance,
  type CoordinatorSnapshot,
  isSha256Hex,
  validId,
} from "../../../domain-model/src/index.ts";
import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";

/**
 * 発行時の受付結合を現在の保存値へ照合する。
 * @responsibility 新規受付と退役前の同内容再入場を区別する。
 * @trace ARCH-000004
 * @input current: 保存値、intake: 発行時世代と依頼結合。
 * @returns 受付可能ならtrue。
 * @precondition currentは検証済み。
 * @postcondition 退役済み世代を現在世代へ付け替えない。
 * @effect N/A: 値比較のみ。
 * @failure 異内容、異結合、退役済み世代の再入場はfalse。
 * @invariant 同じProject名だけで再入場を許可しない。
 * @boundary Requestと保存契約。
 * @security 受付世代は実行Authorityではない。
 * @concurrency 同Ownerで保存直前にも使用する。
 */
export function coordinatorSnapshotIntakeMatches(
  current: CoordinatorSnapshot,
  intake: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): boolean {
  if (
    !validId(intake.epoch) ||
    !validId(intake.queueId) ||
    !isSha256Hex(intake.requestHash) ||
    !validId(intake.projectId) ||
    !validId(intake.milestoneId)
  )
    return false;
  const queue = current.queueEntries.find(
    (item) => item.queueId === intake.queueId,
  );
  if (!queue) return current.intakeEpoch === intake.epoch;
  return (
    current.intakeBindings.some(
      (item) => item.queueId === intake.queueId && item.epoch === intake.epoch,
    ) &&
    queue.requestHash === intake.requestHash &&
    queue.projectId === intake.projectId &&
    queue.milestoneId === intake.milestoneId
  );
}

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
export function associateCoordinatorTaskOperations(
  snapshot: CoordinatorUnifiedSnapshot,
  operations: CoordinatorUnifiedSnapshot["operations"],
): CoordinatorUnifiedSnapshot["projects"] {
  return snapshot.projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) => {
      const recoveryIds = operations
        .filter((operation) => {
          if (operation.kind !== "docker_task" || task.operationId === null)
            return false;
          const identity = JSON.parse(operation.identityJson);
          return (
            identity.consumer === "orchestrator" &&
            (identity.recoveryCorrelationId ?? identity.operationId) ===
              task.operationId
          );
        })
        .map((operation) => operation.recoveryId);
      if (recoveryIds.length === 0) return task;
      return {
        ...task,
        settlement: {
          kind: "operations" as const,
          recoveryIds,
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

export function normalizeCoordinatorTaskProjects(
  current: NonNullable<ReturnType<typeof decodeCoordinatorUnifiedSnapshot>>,
  states: readonly CoordinatorState[],
  facts: unknown,
) {
  if (
    !states.every(validCoordinatorState) ||
    !Array.isArray(facts) ||
    !facts.every(
      (f, i) =>
        exactRecordKeys(f, [
          "projectId",
          "taskId",
          "attemptId",
          "operationId",
          "recoveryUnresolved",
        ]) &&
        typeof f.recoveryUnresolved === "boolean" &&
        !facts
          .slice(0, i)
          .some((p) => p.projectId === f.projectId && p.taskId === f.taskId) &&
        states.some(
          (p) =>
            p.projectId === f.projectId &&
            p.tasks.some(
              (t) =>
                t.definition.id === f.taskId &&
                t.attemptId !== null &&
                t.attemptId === f.attemptId &&
                t.operationId !== null &&
                t.operationId === f.operationId,
            ),
        ),
    )
  )
    return null;
  const receipts = new Map(
    current.snapshot.resultReceipts.map((r) => [r.recoveryId, r]),
  );
  const newlyAccepted = new Set<string>();
  for (const state of states)
    for (const task of state.tasks) {
      for (const value of [
        ...task.resultAcceptances,
        ...task.recoveryObligations.flatMap((o) =>
          o.acknowledgement ? [o.acknowledgement] : [],
        ),
      ]) {
        const receipt = decodeProjectResultAcceptance(value);
        if (!receipt) return null;
        const previous = receipts.get(receipt.recoveryId);
        if (
          previous &&
          encodeRuntimeStateValue(previous) !== encodeRuntimeStateValue(value)
        )
          return null;
        if (!previous) {
          receipts.set(receipt.recoveryId, value);
          newlyAccepted.add(receipt.recoveryId);
        }
      }
    }
  const operations = current.snapshot.operations.filter(
    (o) => !newlyAccepted.has(o.recoveryId),
  );
  const projects: CoordinatorUnifiedSnapshot["projects"][number][] = [];
  for (const state of states) {
    const tasks: CoordinatorStoredTask[] = [];
    for (const task of state.tasks) {
      const previous = current.snapshot.projects
        .find((p) => p.projectId === state.projectId)
        ?.tasks.find(
          (t) =>
            t.definition.id === task.definition.id &&
            t.attemptId === task.attemptId &&
            t.operationId === task.operationId,
        )?.settlement;
      const explicit = facts.find(
        (f) =>
          f.projectId === state.projectId && f.taskId === task.definition.id,
      );
      const resultUnresolved =
        explicit?.recoveryUnresolved ??
        (previous?.kind === "operations"
          ? previous.resultUnresolved
          : previous?.kind === "executor_result"
            ? previous.recoveryUnresolved
            : false);
      const matching = operations
        .filter((o) => {
          if (o.kind !== "docker_task" || task.operationId === null)
            return false;
          const identity = JSON.parse(o.identityJson);
          return (
            identity.consumer === "orchestrator" &&
            (identity.recoveryCorrelationId ?? identity.operationId) ===
              task.operationId
          );
        })
        .map((o) => o.recoveryId);
      const settlement: CoordinatorTaskSettlementFact = matching.length
        ? { kind: "operations", recoveryIds: matching, resultUnresolved }
        : task.startPhase === "none" &&
            !task.cleanupConfirmed &&
            !task.recoveryUnresolved
          ? { kind: "pending" }
          : {
              kind: "executor_result",
              cleanupConfirmed: task.cleanupConfirmed,
              recoveryUnresolved: resultUnresolved,
            };
      const {
        cleanupConfirmed: _cleanup,
        recoveryUnresolved: _unresolved,
        resultAcceptances: _receipts,
        recoveryObligations: _obligations,
        ...record
      } = task;
      const recoveryObligations: CoordinatorStoredTask["recoveryObligations"][number][] =
        [];
      for (const o of task.recoveryObligations) {
        if (o.kind === "docker")
          recoveryObligations.push({
            kind: "docker",
            recoveryId: o.recoveryId,
          });
        else {
          if (o.phase === "acknowledged") return null;
          recoveryObligations.push({
            kind: o.kind,
            recoveryId: o.recoveryId,
            phase: o.phase,
          });
        }
      }
      tasks.push({
        ...record,
        settlement,
        recoveryObligations,
        resultAcceptanceIds: task.resultAcceptances.map((r) => r.recoveryId),
      });
    }
    projects.push({ ...state, tasks });
  }
  return {
    projects,
    operations,
    resultReceipts: [...receipts.values()].filter((r) =>
      states.some((p) => p.projectId === r.projectId),
    ),
    pendingDeliveries: current.snapshot.pendingDeliveries.filter(
      (d) => !newlyAccepted.has(d.recoveryId),
    ),
    unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
      (r) =>
        !newlyAccepted.has(r.recoveryId) ||
        r.obligations.some((o) => o !== "result_delivery"),
    ),
  };
}
