/**
 * Task更新の保存候補と受領相関を所有する。
 * @packageDocumentation
 * @responsibility 既存の世代・元結果・exact参照を一つの候補へまとめる。
 * @trace ARCH-000004、ARCH-000008
 * @boundary 純粋な値操作。保存・実行・現在Authorityの発行は行わない。
 */
import type {
  CoordinatorState,
  CoordinatorStoredTask,
  CoordinatorTaskSettlementFact,
  CoordinatorUnifiedSnapshot,
} from "../state/types.ts";
import {
  decodeCoordinatorUnifiedSnapshot,
  exactRecordKeys,
} from "../state/validation.ts";
import {
  validCoordinatorState,
  decodeProjectResultAcceptance,
} from "./validation.ts";
import { encodeRuntimeStateValue } from "../state/codec.ts";
import { validateCoordinatorUnifiedTransition } from "../state/transition.ts";

/**
 * Taskの確定済み業務更新を単一保存の一改訂へ組み込む。
 * @responsibility 受領本文を一度保持し、同じ更新で配送待ち・終端操作・参照を整理する。
 * @trace ARCH-000004、ARCH-000008
 * @input currentBytes: 元本文、stateValue: 業務更新済み公開State、expectedGeneration: 元業務世代、repositoryBinding: 物理結合、resultFacts: 同じAttemptで新たに得たTask結果の不明事実。
 * @returns 既存区画を保持した次本文、又はnull。
 * @precondition Task Ownerが受付・Lease・業務遷移を既存境界で検証する。
 * @postcondition 投影した公開Stateが指定更新と完全一致する場合だけ候補を返す。
 * @effect N/A: メモリ内の候補生成だけ。保存・回収・Provider要求なし。
 * @failure 世代競合、受領差替え、不足参照、未確認終端、導出状態不一致はnull。
 * @invariant Root未初期化を暗黙初期化せず、旧受領と他Projectを保持する。
 * @boundary Task更新と単一Writerに渡す正規候補。
 * @security 候補生成は実受領・実回収・保存Authorityではない。
 * @concurrency 元本文と実排他は同じWriter Owner内で再照合する。
 */
export function prepareCoordinatorUnifiedTaskSnapshot(
  currentBytes: unknown,
  stateValue: unknown,
  expectedGeneration: unknown,
  repositoryBinding: unknown,
  resultFacts: unknown = [],
): Buffer | null {
  try {
    const current = decodeCoordinatorUnifiedSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const state: unknown = JSON.parse(encodeRuntimeStateValue(stateValue));
    const facts: unknown = JSON.parse(encodeRuntimeStateValue(resultFacts));
    if (
      !current ||
      current.snapshot.repositoryBindingId === null ||
      !validCoordinatorState(state) ||
      !Number.isSafeInteger(expectedGeneration) ||
      Number(expectedGeneration) < 0 ||
      state.generation !== Number(expectedGeneration) + 1 ||
      (current.snapshot.projects.find((p) => p.projectId === state.projectId)
        ?.generation ?? 0) !== expectedGeneration ||
      !Array.isArray(facts) ||
      !facts.every((f) =>
        exactRecordKeys(f, [
          "taskId",
          "attemptId",
          "operationId",
          "recoveryUnresolved",
        ]),
      )
    )
      return null;
    const states = current.projects.some((p) => p.projectId === state.projectId)
      ? current.projects.map((p) =>
          p.projectId === state.projectId ? state : p,
        )
      : [...current.projects, state];
    const sections = normalizeCoordinatorTaskProjects(
      current,
      states,
      facts.map((f) => ({ ...f, projectId: state.projectId })),
    );
    if (!sections) return null;
    const next = {
      ...current.snapshot,
      ...sections,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    const decoded = decodeCoordinatorUnifiedSnapshot(bytes, repositoryBinding);
    return decoded &&
      validateCoordinatorUnifiedTransition(
        currentBytes,
        bytes,
        repositoryBinding,
      ) &&
      encodeRuntimeStateValue(
        decoded.projects.find((p) => p.projectId === state.projectId),
      ) === encodeRuntimeStateValue(state)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ更新内のTask結果・受領と操作参照を正規化する。
 * @responsibility 元受領の不変性と同じAttemptへの結果結合を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input current: 検査済み元版、states: 更新後Task投影、facts: 同じAttemptの観測。
 * @returns 単一保存の更新区画、又はnull。
 * @precondition 元版と新しいTask値は既存の値契約を満たす。
 * @postcondition 受領本文を一度だけ保持し、他操作の未解決事実を保全する。
 * @effect N/A: メモリ内の候補生成のみ。
 * @failure 相関・固定受領差替え・状態不正はnull。
 * @invariant 結果や回復参照の欠測を成功へ補完しない。
 * @boundary Task Ownerと共通保存の値境界。
 * @security 候補を保存・受領・cleanupのAuthorityにしない。
 * @concurrency 元版のfresh確認はWriterが行う。
 */
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
