/**
 * 判断試験の実Git Repositoryと耐久Stateを構築する。
 * @responsibility 公開判断操作の本番同等保存前提を共有する。
 * @trace PRL-IT-008、PRL-IT-014、PRL-ST-009
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeExecutionStore,
  type ProjectExecutionState,
} from "../../../execution-model/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/configuration/runtime-data.ts";
import { verifyRuntimePersistenceRepository } from "../../src/execution/persistence.ts";
import { createCoordinatorState } from "../../src/state/create.ts";
import { createCurrentCoordinatorPersistencePorts } from "../../src/state/transaction.ts";
import {
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  reserveProjectTaskStart,
  settleProjectTask,
} from "../../src/task/lifecycle.ts";
import { taskExecutionSelections } from "./ai-selection.ts";

/**
 * Git管理された固定Repositoryを構築する。
 *
 * @responsibility System Testが使用する検証可能なRepository RootとRevisionを決定論的に作成する。
 * @trace PRL-ST-009
 * @precondition Git CLIを利用できる。
 * @stimulus 一つの追跡FileをCommitする。
 * @observation Repository RootとHEAD Revisionを返す。
 * @oracle RootがGit RepositoryでRevisionが40桁Hashとなる。
 * @cleanup 呼出し側のTest hookがRootを再帰削除する。
 * @boundary PRL-ST-009=Direct Boundary: coordinator Test Source→対象契約
 */
export function createRepository(t: { after(cleanup: () => void): void }) {
  const temporary = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      fileURLToPath(new URL("../../../../", import.meta.url)),
      "tmp",
    ),
    "fixture_repository_root_invalid",
  ).directory;
  const root = fs.mkdtempSync(path.join(temporary, "crdd-acceptance-st-"));
  t.after(() => {
    assert.equal(path.dirname(root), temporary);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    ["-C", root, "config", "user.email", "test@example.invalid"],
    { windowsHide: true },
  );
  execFileSync("git", ["-C", root, "config", "user.name", "CRDD Test"], {
    windowsHide: true,
  });
  fs.writeFileSync(
    path.join(root, "README.md"),
    "acceptance fixture\n",
    "utf8",
  );
  execFileSync("git", ["-C", root, "add", "README.md"], {
    windowsHide: true,
  });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"], {
    windowsHide: true,
  });
  const revision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  return Object.freeze({ root, revision });
}

/**
 * Task完了後かつObjective受入前の状態を全世代耐久化する。
 *
 * @responsibility 下位Task完了と上位Acceptance Decisionを分離したSystem Test前提状態を作る。
 * @trace PRL-ST-009
 * @precondition RootとBindingが検証済みで、同じProject IDの状態が存在しない。
 * @stimulus State Machineを作成、予約、Handoff、開始、完了へ進め、各世代を書き込む。
 * @observation 最終状態はObjective=`integration_pending`、Milestone=`executing`となる。
 * @oracle Task完了だけでObjective／Milestoneがacceptedにならない。
 * @cleanup Repository Root削除によりRuntime Dataも削除する。
 * @boundary PRL-ST-009=Direct Boundary: coordinator Test Source→対象契約
 */
export function persistAcceptancePendingState(
  root: string,
  repositoryBindingId: string,
  projectId: string,
  revision: string,
  outcome: "completed" | "failed" = "completed",
) {
  const state = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId,
    milestoneId: `milestone-${projectId}`,
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["milestone-criterion"],
    objectives: [
      {
        id: `objective-${projectId}`,
        acceptanceCriteria: ["objective-criterion"],
      },
    ],
    tasks: [
      {
        id: `task-${projectId}`,
        objectiveId: `objective-${projectId}`,
        dependencies: [],
        allowedPaths: ["README.md"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: `owner-${projectId}`,
  });
  assert.ok(state.state);
  assert.equal(
    initializeExecutionStore(
      verifyRuntimePersistenceRepository(root),
      repositoryBindingId,
    ).status,
    "completed",
  );
  const ports = createCurrentCoordinatorPersistencePorts(
    root,
    repositoryBindingId,
  );
  const port = ports.state;
  let current: ProjectExecutionState = state.state;
  assert.equal(port.writeState(current, 0).status, "completed");
  const transitions = [
    () =>
      reserveProjectTaskStart(
        current,
        current.generation,
        `task-${projectId}`,
        `attempt-${projectId}`,
        `authority-${projectId}`,
      ),
    () =>
      prepareProjectTaskHandoff(
        current,
        current.generation,
        `task-${projectId}`,
        `attempt-${projectId}`,
        `operation-${projectId}`,
      ),
    () =>
      observeProjectTaskStarted(
        current,
        current.generation,
        `task-${projectId}`,
        `attempt-${projectId}`,
        `operation-${projectId}`,
      ),
    () =>
      settleProjectTask(current, current.generation, {
        taskId: `task-${projectId}`,
        attemptId: `attempt-${projectId}`,
        operationId: `operation-${projectId}`,
        authorityBindingId: `authority-${projectId}`,
        outcome,
        cleanupConfirmed: true,
        recoveryObligations: [],
        recoveryUnresolved: false,
      }),
  ];
  for (const transition of transitions) {
    const next = transition();
    assert.ok(next.state);
    assert.equal(
      port.writeState(next.state, current.generation).status,
      "completed",
    );
    current = next.state;
  }
  assert.equal(
    current.objectives[0]?.state,
    outcome === "completed" ? "integration_pending" : "blocked",
  );
  assert.equal(current.milestone.state, "executing");
  const queueId = `queue-${projectId}`;
  const queued = port.enqueueOperation({
    queueId,
    projectId,
    milestoneId: current.milestone.id,
    requestHash: createHash("sha256").update(queueId).digest("hex"),
    originLane: "interactive",
    repositoryRevision: revision,
    scopeHash: createHash("sha256").update(projectId).digest("hex"),
  });
  assert.equal(queued.status, "completed", queued.reason);
  const acquired = ports.lease.acquire(projectId, queueId, "project-operation");
  assert.equal(acquired.status, "completed", acquired.reason);
  assert.ok(acquired.value && queued.value);
  let queue = queued.value;
  for (const state of [
    "leased",
    "running",
    outcome === "completed" ? "integration_pending" : "replan_required",
  ] as const) {
    const updated = port.updateQueue(queueId, queue.generation, {
      state,
      lease: acquired.value,
      resumeCondition: null,
      resultReference: null,
    });
    assert.equal(updated.status, "completed", updated.reason);
    assert.ok(updated.value);
    queue = updated.value;
  }
  assert.equal(acquired.value.release().status, "completed");
  assert.ok(queue.ownerGeneration);
  const released = port.settleQueueLeaseRelease(
    queueId,
    queue.generation,
    queue.ownerGeneration,
  );
  assert.equal(released.status, "completed", released.reason);
  assert.equal(released.value?.ownerGeneration, null);
  return current;
}
