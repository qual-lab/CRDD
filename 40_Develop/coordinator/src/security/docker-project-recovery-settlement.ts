import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import { readProjectRuntimeState } from "./project-runtime-durable-foundation.ts";

/**
 * ProjectSettledDockerRecoveryが扱う値の構造を表す。
 *
 * @responsibility ProjectSettledDockerRecoveryに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape ProjectSettledDockerRecoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectSettledDockerRecoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectSettledDockerRecoveryの宣言は外部境界を開かない。
 * @security ProjectSettledDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectSettledDockerRecoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectSettledDockerRecovery = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  stateGeneration: number;
  taskId: string;
  attemptId: string;
  operationId: string;
  kind: "docker";
  recoveryId: string;
}>;

/**
 * Internal production composition. The public facade supplies the Runtime-owned
 *
 * @responsibility consumeProjectSettledDockerRecoveryWithRuntimeBoundaryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input rawSettlement: ProjectSettledDockerRecovery、acknowledge: (recoveryId: string) => T
 * @returns consumeProjectSettledDockerRecoveryWithRuntimeBoundaryの計算結果を返す。
 * @precondition 「rawSettlement: ProjectSettledDockerRecovery、acknowledge: (recoveryId: string) => T」がconsumeProjectSettledDockerRecoveryWithRuntimeBoundaryの入力契約を満たす。
 * @postcondition consumeProjectSettledDockerRecoveryWithRuntimeBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: consumeProjectSettledDockerRecoveryWithRuntimeBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeProjectSettledDockerRecoveryWithRuntimeBoundaryは独自の失敗分岐を所有しない。
 * @invariant consumeProjectSettledDockerRecoveryWithRuntimeBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeProjectSettledDockerRecoveryWithRuntimeBoundaryはProcess内の同一Subsystemで完結する。
 * @security consumeProjectSettledDockerRecoveryWithRuntimeBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeProjectSettledDockerRecoveryWithRuntimeBoundaryは共有非同期状態を持たない同期処理である。
 */
export function consumeProjectSettledDockerRecoveryWithRuntimeBoundary<T>(
  rawSettlement: ProjectSettledDockerRecovery,
  acknowledge: (recoveryId: string) => T,
) {
  const settlement = snapshotPlainRecord(
    rawSettlement,
    new Set([
      "workingDirectory",
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "stateGeneration",
      "taskId",
      "attemptId",
      "operationId",
      "kind",
      "recoveryId",
    ]),
  );
  if (
    settlement?.kind !== "docker" ||
    !Number.isSafeInteger(settlement.stateGeneration) ||
    Number(settlement.stateGeneration) < 1 ||
    [
      settlement.workingDirectory,
      settlement.repositoryBindingId,
      settlement.projectId,
      settlement.milestoneId,
      settlement.taskId,
      settlement.attemptId,
      settlement.operationId,
      settlement.recoveryId,
    ].some((value) => typeof value !== "string" || value.length === 0)
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_settlement_authority_invalid",
    });
  const observed = readProjectRuntimeState(
    String(settlement.workingDirectory),
    String(settlement.repositoryBindingId),
    String(settlement.projectId),
  );
  const state = observed.status === "completed" ? observed.value : null;
  const task = state?.tasks.find(
    (entry) => entry.definition.id === settlement.taskId,
  );
  if (
    !state ||
    state.generation !== Number(settlement.stateGeneration) ||
    state.milestoneId !== settlement.milestoneId ||
    task?.attemptId !== settlement.attemptId ||
    task?.operationId !== settlement.operationId ||
    !task?.recoveryObligations.some(
      (entry) =>
        entry.kind === "docker" &&
        entry.recoveryId === settlement.recoveryId &&
        entry.phase === "settled",
    )
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_settlement_not_verified",
    });
  return acknowledge(String(settlement.recoveryId));
}
