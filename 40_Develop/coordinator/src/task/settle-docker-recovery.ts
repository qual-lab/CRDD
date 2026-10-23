/**
 * 上位Taskの耐久状態とDocker回復の終了確定を照合する。
 *
 * @responsibility Coordinatorのexact世代・Task・回復義務を確認し、資源処置をCoordinatorへ委譲する。
 * @trace ARCH-000008
 */

import { readRuntimeOwnedCoordinatorRecoveryResult } from "../storage/settlement-store.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { readCurrentCoordinatorState as readCoordinatorState } from "../storage/current-state.ts";

/**
 * docker-project-recovery-settlementで使用するProject Settled Docker 回復の値契約を定義する。
 *
 * @responsibility Project Settled Docker 回復のProperty、Identity、状態制約を型境界として所有する。
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
 * @responsibility Project Settled Docker 回復 With Runtime Boundaryの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
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
  const observed = readCoordinatorState(
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

/**
 * 本番組立ての固定Repositoryと上位入力の結合を再確認する。
 * @responsibility 入力Pathから別Rootを選ばず、固定Rootの真正な読取り結合を取得する。
 * @trace ARCH-000008
 * @input settlement: 上位入力、fixedRepository: 本番組立てが固定した三項目。
 * @returns 検証済みRootの結合、またはnull。
 * @precondition 固定結合は本番組立てが所有し、公開Requestから受け取らない。
 * @postcondition 別Repository・別Path・別結合では下位処置へ進まない。
 * @effect 固定RepositoryのFilesystem・Git配置を読み取る。
 * @failure 不正形式、固定値不一致、Rootの観測不能はnull。
 * @invariant 入力のworkingDirectoryをRoot選択の根拠にしない。
 * @boundary Coordinator本番組立てとRepository結合。
 * @security 秘密値・処置Authorityを返さない。
 * @concurrency Root実体の再確認後も下位ReaderとWriterが保存時に再確認する。
 */
function verifyRecoverySettlementRepository(
  settlement: { workingDirectory?: unknown; repositoryBindingId?: unknown },
  fixedRepository: Readonly<{
    workingDirectory: string;
    repositoryBindingId: string;
    repositoryRoot: string;
  }> | null,
) {
  if (
    !fixedRepository ||
    settlement.workingDirectory !== fixedRepository.workingDirectory ||
    settlement.repositoryBindingId !== fixedRepository.repositoryBindingId
  )
    return null;
  try {
    if (
      resolveVerifiedRepositoryRootFromWorkingDirectory(
        fixedRepository.workingDirectory,
      ) !== fixedRepository.repositoryRoot
    )
      return null;
    const verified = verifyRepositoryRoot(fixedRepository.repositoryRoot);
    return verified.status === "completed" ? verified.capability : null;
  } catch {
    return null;
  }
}

/**
 * 保存済み上位回復義務に対応する下位結果参照だけを取得する。
 * @responsibility exact世代・Task・Attempt・settled義務と五項目結果参照を照合する。
 * @trace ARCH-000008
 * @input rawSettlement: 上位保存結合、fixedRepository: 本番組立ての固定Repository。
 * @returns 閉じたstatus・reason・成功時acknowledgement。
 * @precondition 資源回収は別の責務で完了し、上位義務がsettledとして保存済みである。
 * @postcondition 読取りと排他解放を確認した結果だけをTask原子受領保存へ渡す。
 * @effect 上位現在状態と下位現在状態を既存短期排他で読み取る。
 * @failure Root・上位世代・結果相関・読取り・排他解放不明はblocked。
 * @invariant 読取りから受理・清掃・Provider実行の成功を合成しない。
 * @boundary Coordinator現在状態とCoordinator結果投影。
 * @security 旧AppData領収書や入力Pathを保存先選択へ使わない。
 * @concurrency 上位読取りの排他解放後に下位を読み取る。
 */
export function consumeDockerRecoveryReceiptAfterProjectSettlement(
  rawSettlement: ProjectSettledDockerRecovery,
  fixedRepository: Readonly<{
    workingDirectory: string;
    repositoryBindingId: string;
    repositoryRoot: string;
  }> | null = null,
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
  ) as ProjectSettledDockerRecovery | null;
  if (!settlement)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_settlement_authority_invalid",
    });
  const root = verifyRecoverySettlementRepository(settlement, fixedRepository);
  if (!root)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_repository_not_verified",
    });
  return consumeProjectSettledDockerRecoveryWithRuntimeBoundary(
    settlement,
    (recoveryId) => {
      const observed = readRuntimeOwnedCoordinatorRecoveryResult(
        root,
        recoveryId,
      );
      const value = snapshotPlainRecord(
        observed.value,
        new Set([
          "repositoryBinding",
          "operationId",
          "recoveryId",
          "resultId",
          "consumer",
        ]),
      );
      if (
        observed.status !== "completed" ||
        !observed.lockReleased ||
        !value ||
        typeof value.repositoryBinding !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.repositoryBinding) ||
        typeof value.resultId !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.resultId) ||
        value.operationId !== settlement.operationId ||
        value.recoveryId !== recoveryId ||
        value.consumer !== "orchestrator"
      )
        return Object.freeze({
          status: "blocked" as const,
          reason: "docker_task_recovery_result_not_verified",
        });
      return Object.freeze({
        status: "completed" as const,
        reason: "docker_task_recovery_result_observed",
        acknowledgement: Object.freeze({
          repositoryBinding: value.repositoryBinding,
          operationId: value.operationId,
          recoveryId,
          resultId: value.resultId,
          consumer: "orchestrator" as const,
        }),
      });
    },
  );
}
