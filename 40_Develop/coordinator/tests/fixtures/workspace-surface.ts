/**
 * 公開Workspace試験の自己生成Repositoryに既存Queueを用意する。
 * @responsibility 実Writerと既存排他を使い、架空Storeを使わない。
 * @trace CPR-IT-001
 * @level IT
 * @scope 呼出し側が生成・清掃する試験Rootのみ。
 * @boundary 外部AI・Docker・通信なし。
 */
import { taskExecutionSelections } from "./ai-selection.ts";
import assert from "node:assert/strict";
import { createCoordinatorState } from "../../src/state/create.ts";
import { initializeCoordinatorSnapshot } from "../../src/storage/state.ts";
import { writeCoordinatorSnapshotState } from "../../src/storage/state.ts";
import { createCoordinatorSnapshotPersistencePorts } from "../../src/state/transaction.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/state/validation.ts";

/**
 * 既存Projectと二Queueを実保存する。
 * @responsibility 公開操作の所属・選択の前提を作る。
 * @trace CPR-IT-001
 * @precondition 自己生成Rootと固定Git Commit。
 * @stimulus 初期化、Project保存、二Queue受付。
 * @observation 各Writerの完了。
 * @oracle 保存拒否を前提成立と扱わない。
 * @cleanup 呼出し側がexact Rootを回収する。
 * @boundary 実Snapshot・Native排他。
 */
export function prepareWorkspaceSurface(
  root: string,
  projectId: string,
  base: string,
) {
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const initialized = initializeCoordinatorSnapshot(root, binding);
  assert.equal(initialized.status, "completed");
  if (initialized.status !== "completed")
    throw new Error("fixture_init_failed");
  const created = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId,
    milestoneId: "milestone-a",
    repositoryRevision: base,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["done"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["source.txt"],
        conflictKeys: ["source"],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  assert.equal(
    writeCoordinatorSnapshotState(
      root,
      binding,
      JSON.stringify(created.state),
      0,
    ).status,
    "completed",
  );
  const ports = createCoordinatorSnapshotPersistencePorts(
    root,
    binding,
    initialized.value,
  );
  for (const queueId of ["queue-a", "queue-b"]) {
    const result = ports.state.enqueueOperation({
      queueId,
      projectId,
      milestoneId: "milestone-a",
      requestHash: queueId === "queue-a" ? "a".repeat(64) : "c".repeat(64),
      originLane: "interactive",
      repositoryRevision: base,
      scopeHash: "b".repeat(64),
    });
    assert.equal(result.status, "completed", JSON.stringify(result));
  }
  return binding;
}
