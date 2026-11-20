/**
 * 新版のCoordinator保存Portを既存試験の呼出し形へ接続する。
 * @packageDocumentation
 * @responsibility 試験が旧Reader／Writerへ戻ることを防ぐ。
 * @trace PRL-IT-005
 * @level IT
 * @scope 新版保存の試験接続。
 * @boundary PRL-IT-005=Direct Boundary: 試験から統合保存。
 */

import {
  projectExecutionFixture,
  initialExecutionInput,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  readState,
  readProjectExecutionState,
  readQueueEntry,
  saveProjectExecutionState,
  updateQueue,
} from "../../../execution-model/src/index.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { createCoordinatorSnapshotPersistencePorts } from "../../src/state/transaction.ts";
import { taskExecutionSelections } from "./ai-selection.ts";
/**
 * 初期化済みの試験Repositoryを既存の本番保存接続へ渡す。
 * @responsibility 試験準備の不存在・読取り不明・排他解放不明を準備失敗として保持する。
 * @trace PRL-IT-005
 * @precondition 呼出し元が同じ試験Rootの初期化と清掃を所有する。
 * @stimulus 既存EM Readerでexecution区画を読む。
 * @observation Readerの状態と解放確認を得る。
 * @oracle 不存在・不明を初期化済みへ補完しない。
 * @cleanup 生成物は作らず、呼出し元hookがRootを回収する。
 * @boundary 試験準備からEM読取りとCoordinator保存接続。
 */
export function createTestPersistence(root: string, binding: string) {
  const observed = readState(
    verifyRuntimePersistenceRepository(root),
    binding,
    "execution",
  );
  if (observed.reason === "orchestrator_snapshot_lock_release_unconfirmed")
    throw new Error("orchestrator_snapshot_lock_release_unconfirmed");
  if (observed.status !== "completed" || observed.value === null)
    throw new Error("orchestrator_snapshot_not_initialized");
  return createCoordinatorSnapshotPersistencePorts(root, binding);
}

/**
 * 新版PortのreadStateを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のreadStateへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function readCoordinatorState(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<typeof createTestPersistence>["state"]["readState"]
  >
) {
  return createTestPersistence(root, binding).state.readState(...args);
}
/**
 * 新版PortのreadQueueを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のreadQueueへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function readProjectOperationQueueState(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<typeof createTestPersistence>["state"]["readQueue"]
  >
) {
  return createTestPersistence(root, binding).state.readQueue(...args);
}
/**
 * 新版PortのenqueueOperationを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のenqueueOperationへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function enqueueProjectOperation(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<typeof createTestPersistence>["state"]["enqueueOperation"]
  >
) {
  const ports = createTestPersistence(root, binding);
  const input = args[0];
  if (ports.state.readState(input.projectId).value === null) {
    const created = projectExecutionFixture({
      taskExecutionSelections: taskExecutionSelections(),
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      repositoryRevision: input.repositoryRevision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["Result exists."],
      objectives: [
        { id: "objective-a", acceptanceCriteria: ["Result exists."] },
      ],
      tasks: [
        {
          id: "task-a",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: ["result.txt"],
        },
      ],
      ownerGeneration: "fixture-owner",
    });
    if (created.status !== "completed")
      throw new Error("snapshot_fixture_state_failed");
    return ports.state.enqueueOperation(
      input,
      args[1] ?? initialExecutionInput(created.state),
    );
  }
  return createTestPersistence(root, binding).state.enqueueOperation(...args);
}
/**
 * 新版PortのselectNextOperationを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のselectNextOperationへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function selectNextProjectOperation(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<typeof createTestPersistence>["state"]["selectNextOperation"]
  >
) {
  return createTestPersistence(root, binding).state.selectNextOperation(
    ...args,
  );
}
/**
 * 新版PortのsettleQueueRecoveryを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のsettleQueueRecoveryへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function settleProjectOperationQueueRecovery(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<typeof createTestPersistence>["state"]["settleQueueRecovery"]
  >
) {
  return createTestPersistence(root, binding).state.settleQueueRecovery(
    ...args,
  );
}
/**
 * 新版PortのupdateQueueを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のupdateQueueへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function updateProjectOperationQueueState(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<typeof createTestPersistence>["state"]["updateQueue"]
  >
) {
  return createTestPersistence(root, binding).state.updateQueue(...args);
}
/**
 * 新版Portのacquireを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のacquireへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function acquireCoordinatorLease(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<typeof createTestPersistence>["lease"]["acquire"]
  >
) {
  return createTestPersistence(root, binding).lease.acquire(...args);
}

/**
 * 明示した再試行・差替え後の試験Queueを次の実行に備える。
 * @responsibility Classifierを作らず実EM規則へ固定刺激を渡す。
 * @trace PRL-IT-005
 * @precondition 呼出し元が失敗Taskと解放済みQueueを準備している。
 * @stimulus task_retry又はtask_replanの明示要求を保存する。
 * @observation 元世代の保存結果とQueue更新を得る。
 * @oracle 保存拒否ならQueueを進めず、EMの不明結果を補完しない。
 * @cleanup 呼出し元hookが生成Repositoryを回収する。
 * @boundary 試験準備とEMの状態・Queue完成操作。
 */
export function updateTestTaskAndQueue(
  input: Readonly<{
    workingDirectory: string;
    repositoryBindingId: string;
    projectId: string;
    milestoneId: string;
    queueId: string;
    maximumReplans: number;
  }>,
  mutation:
    | Omit<
        Extract<
          Parameters<typeof saveProjectExecutionState>[2],
          { kind: "task_retry" }
        >,
        "projectId" | "maximumReplans"
      >
    | Omit<
        Extract<
          Parameters<typeof saveProjectExecutionState>[2],
          { kind: "task_replan" }
        >,
        "projectId" | "maximumReplans"
      >,
) {
  const {
    workingDirectory: root,
    repositoryBindingId: binding,
    queueId,
  } = input;
  const request = {
    ...mutation,
    projectId: input.projectId,
    maximumReplans: input.maximumReplans,
  };
  const repository = verifyRuntimePersistenceRepository(root);
  const project = readProjectExecutionState(
    repository,
    binding,
    request.projectId,
  );
  const queue = readQueueEntry(repository, binding, queueId);
  if (
    project.status !== "completed" ||
    !project.value ||
    queue.status !== "completed"
  )
    throw new Error("fixture_state_unavailable");
  const saved = saveProjectExecutionState(
    repository,
    binding,
    request,
    project.value.generation,
  );
  if (saved.status === "completed") {
    const updated = updateQueue(repository, binding, {
      kind: "operation",
      input: [
        queueId,
        queue.value.generation,
        {
          state: "queued",
          leasePresent: false,
          leaseIsNull: true,
          resumeCondition:
            request.kind === "task_retry"
              ? "same_plan_retry"
              : "partial_replan_applied",
          resultReference:
            request.kind === "task_retry"
              ? request.taskId
              : request.failedTaskId,
        },
        {
          borrowActiveLease: () => undefined,
          isActiveLeaseObserved: () => false,
        },
      ],
    });
    if (updated.status !== "completed") throw new Error(updated.reason);
  }
  return saved;
}
