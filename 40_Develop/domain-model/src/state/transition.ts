/**
 * 単一保存の改訂・受領・終端相関を所有する。
 * @packageDocumentation
 * @responsibility 既存の世代・元結果・exact参照を一つの候補へまとめる。
 * @trace ARCH-000004、ARCH-000008
 * @boundary 純粋な値操作。保存・実行・現在Authorityの発行は行わない。
 */
import {
  decodeCoordinatorUnifiedSnapshot,
  prepareCoordinatorStateHistoryLine,
  projectCoordinatorTaskSettlement,
} from "./validation.ts";
import { coordinatorRepairCanComplete } from "../attempt/validation.ts";
import { encodeRuntimeStateValue } from "./codec.ts";

/**
 * 単一保存の改訂、受領不変性と操作除去の同更新を検査する。
 * @responsibility 部分ACK、旧受領の付替え、参照だけ残る操作除去を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input currentBytes: 現在本文又は初回null、nextBytes: 次本文、repositoryBinding: 物理結合。
 * @returns 共通保存遷移の必要条件が成立する場合だけtrue。
 * @precondition 操作固有の許可、実資源、Task業務遷移は別途既存Ownerが検証する。
 * @postcondition 初回受領世代と固定本文を維持し、除去と参照置換を一候補で照合する。
 * @effect N/A: メモリ内の比較だけ。
 * @failure 改訂不一致、受領差替え、履歴・終端未確認、部分更新はfalse。
 * @invariant 本検査だけで任意の業務・技術更新を許可しない。
 * @boundary 単一Writerの共通CAS候補。Writerへの本番接続は別処置。
 * @security 保存値から実資源不存在やAuthority失効を推定しない。
 * @concurrency 実排他・fresh読取り・保存確定は既存Writerが所有する。
 */
export function validateCoordinatorUnifiedTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  try {
    const next = decodeCoordinatorUnifiedSnapshot(nextBytes, repositoryBinding);
    if (!next) return false;
    if (currentBytes === null)
      return (
        next.snapshot.revision === 1 &&
        next.snapshot.previous === null &&
        next.snapshot.resultReceipts.length === 0
      );
    const current = decodeCoordinatorUnifiedSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (
      !current ||
      next.snapshot.revision !== current.snapshot.revision + 1 ||
      next.snapshot.previous?.revision !== current.snapshot.revision ||
      next.snapshot.previous.payloadSha256 !== current.payloadSha256 ||
      (current.snapshot.repositoryBindingId !== null &&
        next.snapshot.repositoryBindingId !==
          current.snapshot.repositoryBindingId)
    )
      return false;
    return validateCoordinatorSettlementTransition(
      current,
      next,
      currentBytes,
      repositoryBinding,
    );
  } catch {
    return false;
  }
}

/**
 * 復号済みのTask受領と技術操作の同時遷移を照合する。
 * @responsibility 受領本文・固定選定・終端操作とTask投影の相関を保全する。
 * @trace ARCH-000004、ARCH-000008
 * @input current／next: 検査済み値とTask投影、currentBytes／repositoryBinding: 同じ元本文と保存結合。
 * @returns 既存の区画間遷移条件が全て成立した場合だけtrue。
 * @precondition codec・保存改訂・元HashはStorageが先に照合する。
 * @postcondition 受領を捏造せず、対象外の固定値を保全する。
 * @effect N/A: 復号済み値の同期検査だけ。
 * @failure 不整合・解釈不能ではfalse。
 * @invariant Taskの受領と技術操作の終了を別保存へ分離しない。
 * @boundary 単一Writerの物理CASと区画間の意味判断。
 * @security 既知の値だけで実資源不存在を証明しない。
 * @concurrency 同じfresh元版と候補へ適用する。
 */
function validateCoordinatorSettlementTransition(
  current: NonNullable<ReturnType<typeof decodeCoordinatorUnifiedSnapshot>>,
  next: NonNullable<ReturnType<typeof decodeCoordinatorUnifiedSnapshot>>,
  currentBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  try {
    for (const old of current.snapshot.projects) {
      const replacement = next.snapshot.projects.find(
        (project) => project.projectId === old.projectId,
      );
      if (
        replacement &&
        replacement.milestoneId === old.milestoneId &&
        encodeRuntimeStateValue(replacement.taskExecutionSelections) !==
          encodeRuntimeStateValue(old.taskExecutionSelections)
      )
        return false;
    }
    const receipts = new Map(
      next.snapshot.resultReceipts.map((receipt) => [
        receipt.recoveryId,
        receipt,
      ]),
    );
    const oldReceipts = new Map(
      current.snapshot.resultReceipts.map((receipt) => [
        receipt.recoveryId,
        receipt,
      ]),
    );
    for (const receipt of oldReceipts.values()) {
      const retained = receipts.get(receipt.recoveryId);
      if (
        retained
          ? encodeRuntimeStateValue(receipt) !==
            encodeRuntimeStateValue(retained)
          : next.snapshot.projects.some(
              (project) => project.projectId === receipt.projectId,
            )
      )
        return false;
    }
    for (const receipt of receipts.values()) {
      if (oldReceipts.has(receipt.recoveryId)) continue;
      const operation = current.snapshot.operations.find(
        (entry) => entry.recoveryId === receipt.recoveryId,
      );
      const project = next.projects.find(
        (entry) => entry.projectId === receipt.projectId,
      );
      const task = project?.tasks.find(
        (entry) => entry.definition.id === receipt.taskId,
      );
      const identity = operation ? JSON.parse(operation.identityJson) : null;
      if (
        operation?.kind !== "docker_task" ||
        identity.consumer !== receipt.consumer ||
        (identity.recoveryCorrelationId ?? identity.operationId) !==
          receipt.operationId ||
        operation.history?.confirmed !== true ||
        operation.summarySha256 !== receipt.resultId ||
        !task ||
        task.attemptId !== receipt.attemptId ||
        task.operationId !== receipt.operationId ||
        project?.generation !== receipt.settlementGeneration ||
        !current.snapshot.pendingDeliveries.some(
          (delivery) =>
            delivery.recoveryId === receipt.recoveryId &&
            delivery.resultId === receipt.resultId,
        )
      )
        return false;
    }
    for (const operation of current.snapshot.operations) {
      if (
        next.snapshot.operations.some(
          (entry) => entry.recoveryId === operation.recoveryId,
        )
      )
        continue;
      if (operation.kind === "runtime_repair") {
        if (!coordinatorRepairCanComplete(operation, current.snapshot))
          return false;
        continue;
      }
      if (
        operation.phase === "executing" ||
        operation.history?.confirmed !== true ||
        !prepareCoordinatorStateHistoryLine(
          currentBytes,
          operation.recoveryId,
          repositoryBinding,
        ) ||
        projectCoordinatorTaskSettlement(
          {
            kind: "operations",
            recoveryIds: [operation.recoveryId],
            resultUnresolved: false,
          },
          current.snapshot,
        )?.cleanupConfirmed !== true ||
        current.snapshot.unresolvedRecoveries.some(
          (recovery) =>
            recovery.recoveryId === operation.recoveryId &&
            recovery.obligations.some(
              (obligation) => obligation !== "result_delivery",
            ),
        ) ||
        next.snapshot.unresolvedRecoveries.some(
          (recovery) => recovery.recoveryId === operation.recoveryId,
        ) ||
        next.snapshot.pendingDeliveries.some(
          (delivery) => delivery.recoveryId === operation.recoveryId,
        )
      )
        return false;
      const identity = JSON.parse(operation.identityJson);
      if (
        identity.consumer === "orchestrator" &&
        receipts.get(operation.recoveryId)?.resultId !== operation.summarySha256
      )
        return false;
      for (const project of current.snapshot.projects)
        for (const task of project.tasks) {
          if (
            task.settlement.kind !== "operations" ||
            !task.settlement.recoveryIds.includes(operation.recoveryId)
          )
            continue;
          const replacement = next.snapshot.projects
            .find((entry) => entry.projectId === project.projectId)
            ?.tasks.find((entry) => entry.definition.id === task.definition.id);
          if (
            !replacement ||
            replacement.attemptId !== task.attemptId ||
            replacement.operationId !== task.operationId ||
            (replacement.settlement.kind !== "executor_result" &&
              (task.state !== "recovery_required" ||
                replacement.state !== "recovery_required" ||
                replacement.settlement.kind !== "operations" ||
                replacement.settlement.recoveryIds.includes(
                  operation.recoveryId,
                )))
          )
            return false;
          const before = projectCoordinatorTaskSettlement(task.settlement, {
            ...current.snapshot,
            unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
              (recovery) =>
                !receipts.has(recovery.recoveryId) ||
                recovery.obligations.some(
                  (obligation) => obligation !== "result_delivery",
                ),
            ),
          });
          const after = projectCoordinatorTaskSettlement(
            replacement.settlement,
            next.snapshot,
          );
          if (
            !before ||
            !after ||
            encodeRuntimeStateValue(before) !== encodeRuntimeStateValue(after)
          )
            return false;
        }
    }
    return true;
  } catch {
    return false;
  }
}
