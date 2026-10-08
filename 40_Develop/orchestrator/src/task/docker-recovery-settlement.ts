/**
 * 上位Taskの耐久状態とDocker回復の終了確定を照合する。
 *
 * @responsibility Orchestratorのexact世代・Task・回復義務を確認し、資源処置をCoordinatorへ委譲する。
 * @trace ARCH-000008
 */

import {
  completeRuntimeOwnedCoordinatorRecoveredSettlement,
  observeRuntimeOwnedCoordinatorCompletedDelivery,
  prepareRuntimeOwnedCoordinatorRecoveredSettlement,
  readRuntimeOwnedCoordinatorRecoveryResult,
} from "../../../coordinator/src/state-storage/coordinator-state-runtime.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/plain-data/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";
import { decodeProjectResultAcceptance } from "../core/project-runtime-state.ts";
import { readCurrentProjectRuntimeState as readProjectRuntimeState } from "../storage/index.ts";

/**
 * 同じ上位Attemptの保存済み受理だけを返す読取り閉包を固定する。
 * @responsibility 上位現在状態・Task・回復義務と十一項目の受理本文を相関する。
 * @trace ARCH-000008
 * @input rawBinding: 本番組立てが保持するRepository・Project・Task・Attempt・操作・回復参照。
 * @returns 固定された同期Reader、または不正結合の場合のnull。
 * @precondition 呼出し元は検証済みRepositoryの本番組立てであり、Requestから関数を受け付けない。
 * @postcondition 保存済みACK以外を合成せず、初回の受理世代を維持する。
 * @effect 構築時はN/A。Readerは既存上位現在状態を短期排他で読む。
 * @failure 不正結合、保存・排他解放未確認、別Attempt、ACK欠落・旧形式はnull。
 * @invariant 読取りから処置Authorityや新しい受理を発行しない。
 * @boundary Orchestratorの上位耐久保存とCoordinatorの内部終端Context。
 * @security Pathは本番組立ての固定値だけを使い、返却本文に含めない。
 * @concurrency 上位保存Lock解放後に使用し、ReaderからCoordinatorへ再入場しない。
 */
export function createProjectResultAcceptanceReader(rawBinding: unknown) {
  const binding = snapshotPlainRecord(
    rawBinding,
    new Set([
      "workingDirectory",
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
    ]),
  );
  if (
    !binding ||
    Object.values(binding).some(
      (value) => typeof value !== "string" || value.length === 0,
    )
  )
    return null;
  return () => {
    try {
      const observed = readProjectRuntimeState(
        String(binding.workingDirectory),
        String(binding.repositoryBindingId),
        String(binding.projectId),
      );
      const state = observed.status === "completed" ? observed.value : null;
      const task = state?.tasks.find(
        (entry) => entry.definition.id === binding.taskId,
      );
      const obligation = task?.recoveryObligations.find(
        (entry) =>
          entry.kind === "docker" && entry.recoveryId === binding.recoveryId,
      );
      const normal =
        task?.resultAcceptances.filter(
          (entry) => entry.recoveryId === binding.recoveryId,
        ) ?? [];
      const cleanTerminal =
        task &&
        ["completed", "failed", "cancelled"].includes(task.state) &&
        task.startPhase === "settled" &&
        task.cleanupConfirmed &&
        !task.recoveryUnresolved &&
        task.recoveryObligations.every(
          (entry) =>
            entry.phase ===
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        );
      const acknowledgement = decodeProjectResultAcceptance(
        cleanTerminal && normal.length === 1 && !obligation
          ? normal[0]
          : normal.length === 0 &&
              obligation?.phase === "acknowledged" &&
              (task?.state === "recovery_required" || task?.state === "ready")
            ? obligation.acknowledgement
            : null,
      );
      if (
        !state ||
        state.projectId !== binding.projectId ||
        state.milestoneId !== binding.milestoneId ||
        task?.attemptId !== binding.attemptId ||
        task?.operationId !== binding.operationId ||
        !acknowledgement ||
        (
          [
            "repositoryBindingId",
            "projectId",
            "milestoneId",
            "taskId",
            "attemptId",
            "operationId",
            "recoveryId",
          ] as const
        ).some((key) => acknowledgement[key] !== binding[key]) ||
        acknowledgement.settlementGeneration > state.generation
      )
        return null;
      return acknowledgement;
    } catch {
      return null;
    }
  };
}

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
 * @boundary Orchestrator本番組立てとRepository結合。
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
 * @postcondition 読取りと排他解放を確認した結果だけを上位ACK保存へ渡す。
 * @effect 上位現在状態と下位現在状態を既存短期排他で読み取る。
 * @failure Root・上位世代・結果相関・読取り・排他解放不明はblocked。
 * @invariant 読取りから受理・清掃・Provider実行の成功を合成しない。
 * @boundary Orchestrator現在状態とCoordinator結果投影。
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
        value.consumer !== "project_runtime"
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
          consumer: "project_runtime" as const,
        }),
      });
    },
  );
}

/**
 * 保存済み十一項目の耐久受理から下位の終了限定Writerへ接続する。
 * @responsibility 上位acknowledged義務の全項目一致と下位保存・排他解放を確認する。
 * @trace ARCH-000008
 * @input rawSettlement: 上位結合と受理本文、fixedRepository: 本番組立ての固定Repository。
 * @returns 閉じたstatus・reasonだけ。
 * @precondition 上位ACKは耐久保存され、上位保存Lockは解放済みである。
 * @postcondition 下位ACK保存・終了整理・排他解放が成立した場合だけcompleted。
 * @effect 上位現在状態の読取りとCoordinator現在状態の終了限定更新。
 * @failure 不正・旧形式ACK、世代・Attempt・保存本文不一致、読取り・保存・解放不明はblocked。
 * @invariant 元Taskを再実行せず、過去outcome・一次失敗・exact回復参照を変更しない。
 * @boundary 上位耐久受理と下位pending deliveryの終了。
 * @security 固定Readerは保存済み本文だけを返し、入力ACKから補完しない。
 * @concurrency 保存済み版と固定ReaderをWriterの既存排他内で再照合する。
 */
export function collectDockerRecoveryAcknowledgementAfterProjectRecord(
  rawSettlement: ProjectSettledDockerRecovery &
    Readonly<{ acknowledgement: unknown }>,
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
      "acknowledgement",
    ]),
  );
  const acknowledgement = decodeProjectResultAcceptance(
    settlement?.acknowledgement,
  );
  if (
    settlement?.kind !== "docker" ||
    !Number.isSafeInteger(settlement.stateGeneration) ||
    Number(settlement.stateGeneration) < 1 ||
    !acknowledgement ||
    (
      [
        "workingDirectory",
        "repositoryBindingId",
        "projectId",
        "milestoneId",
        "taskId",
        "attemptId",
        "operationId",
        "recoveryId",
      ] as const
    ).some(
      (key) => typeof settlement[key] !== "string" || settlement[key] === "",
    ) ||
    (
      [
        "repositoryBindingId",
        "projectId",
        "milestoneId",
        "taskId",
        "attemptId",
        "operationId",
        "recoveryId",
      ] as const
    ).some((key) => acknowledgement[key] !== settlement[key])
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_acknowledgement_gc_authority_invalid",
    });
  const root = verifyRecoverySettlementRepository(settlement, fixedRepository);
  if (!root)
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_repository_not_verified",
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
  const obligation = task?.recoveryObligations.find(
    (entry) =>
      entry.kind === "docker" && entry.recoveryId === settlement.recoveryId,
  );
  const saved = decodeProjectResultAcceptance(obligation?.acknowledgement);
  if (
    !state ||
    state.projectId !== settlement.projectId ||
    state.generation !== Number(settlement.stateGeneration) ||
    state.milestoneId !== settlement.milestoneId ||
    task?.attemptId !== settlement.attemptId ||
    task?.operationId !== settlement.operationId ||
    obligation?.phase !== "acknowledged" ||
    !saved ||
    acknowledgement.settlementGeneration > state.generation ||
    (Object.keys(acknowledgement) as (keyof typeof acknowledgement)[]).some(
      (key) => saved[key] !== acknowledgement[key],
    )
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "docker_task_recovery_acknowledgement_gc_not_verified",
    });
  const reader = createProjectResultAcceptanceReader({
    workingDirectory: String(settlement.workingDirectory),
    repositoryBindingId: acknowledgement.repositoryBindingId,
    projectId: acknowledgement.projectId,
    milestoneId: acknowledgement.milestoneId,
    taskId: acknowledgement.taskId,
    attemptId: acknowledgement.attemptId,
    operationId: acknowledgement.operationId,
    recoveryId: acknowledgement.recoveryId,
  });
  const context = reader
    ? prepareRuntimeOwnedCoordinatorRecoveredSettlement(
        root,
        acknowledgement.recoveryId,
        reader,
      )
    : null;
  if (!context) {
    const observed = observeRuntimeOwnedCoordinatorCompletedDelivery(
      root,
      acknowledgement.recoveryId,
      reader,
    );
    return Object.freeze({
      status:
        observed.status === "completed" &&
        observed.deliveryAbsentObserved &&
        observed.lockReleased
          ? ("completed" as const)
          : ("blocked" as const),
      reason: observed.reason,
    });
  }
  const completed = completeRuntimeOwnedCoordinatorRecoveredSettlement(context);
  return Object.freeze({
    status:
      completed.status === "completed" &&
      completed.snapshotConfirmed &&
      completed.lockReleased
        ? ("completed" as const)
        : ("blocked" as const),
    reason: completed.reason,
  });
}
