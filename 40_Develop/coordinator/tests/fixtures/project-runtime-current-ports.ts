/**
 * 新版のProject Runtime保存Portを既存試験の呼出し形へ接続する。
 * @packageDocumentation
 * @responsibility 試験が旧Reader／Writerへ戻ることを防ぐ。
 * @trace PRL-IT-005
 * @level IT
 * @scope 新版保存の試験接続。
 * @boundary PRL-IT-005=Direct Boundary: 試験から統合保存。
 */
import { createCurrentProjectRuntimePersistencePorts } from "../../src/project-runtime/project-runtime-durable-foundation.ts";
import { createProjectRuntimeState } from "../../../project-runtime/src/index.ts";
/**
 * 新版PortのwriteStateを試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 新版のwriteStateへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function writeProjectRuntimeState(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["state"]["writeState"]
  >
) {
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).state.writeState(...args);
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
export function readProjectRuntimeState(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["state"]["readState"]
  >
) {
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).state.readState(...args);
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
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["state"]["readQueue"]
  >
) {
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).state.readQueue(...args);
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
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["state"]["enqueueOperation"]
  >
) {
  const ports = createCurrentProjectRuntimePersistencePorts(root, binding);
  const input = args[0];
  if (ports.state.readState(input.projectId).value === null) {
    const created = createProjectRuntimeState({
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
    if (
      created.status !== "completed" ||
      ports.state.writeState(created.state, 0).status !== "completed"
    )
      throw new Error("snapshot_fixture_state_failed");
  }
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).state.enqueueOperation(...args);
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
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["state"]["selectNextOperation"]
  >
) {
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).state.selectNextOperation(...args);
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
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["state"]["settleQueueRecovery"]
  >
) {
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).state.settleQueueRecovery(...args);
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
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["state"]["updateQueue"]
  >
) {
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).state.updateQueue(...args);
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
export function acquireProjectRuntimeLease(
  root: string,
  binding: string,
  ...args: Parameters<
    ReturnType<
      typeof createCurrentProjectRuntimePersistencePorts
    >["lease"]["acquire"]
  >
) {
  return createCurrentProjectRuntimePersistencePorts(
    root,
    binding,
  ).lease.acquire(...args);
}
