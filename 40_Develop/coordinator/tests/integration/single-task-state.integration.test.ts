/**
 * 単発受付を架空のProject計画なしで既存Snapshotへ保存する。
 * @packageDocumentation
 * @responsibility 反復依頼・識別子・保存前停止・同じLeaseの終端を実Writerで確認する。
 * @trace PRL-IT-013
 * @trace CPR-IT-004
 * @level IT
 * @scope 単発Taskの保存と実排他。Provider／Dockerは使わない。
 * @boundary 実Git、Filesystem、既存Native排他。
 */
import assert from "node:assert/strict";
import {
  executionSelection,
  taskExecutionSelections,
} from "../fixtures/ai-selection.ts";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { devNull } from "node:os";
import {
  initializeCoordinatorSnapshot,
  readCoordinatorSnapshot,
  enqueueCoordinatorSingleTask,
  updateCoordinatorSingleTask,
  acquireCoordinatorSnapshotLease,
  createCoordinatorSnapshotStatePort,
} from "../../src/storage/current-state.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/state/model.ts";
import {
  inspectSingleTaskRecord,
  type SingleTaskRecord,
} from "../../src/state/model.ts";
import type { ProjectQueueEntry } from "../../src/state/model.ts";
import { createCoordinatorTaskRequests } from "../../src/task/requests.ts";

/**
 * 計画なしの新品Rootで二回の実行受付と終端を確認する。
 * @responsibility 同Projectの反復を既存Task再利用へ変換しない。
 * @trace PRL-IT-013
 * @precondition Repository-localのtests親が存在する。
 * @stimulus 新品Root、二Queue、異入力再送、実Leaseと終端保存。
 * @observation 実Snapshot、保存世代、履歴搬送待ち。
 * @oracle Project計画0件、Taskは別ID、本文保存0。
 * @cleanup 自己生成Rootを検証後に除去し不存在確認。
 * @boundary 外部通信なしの実保存。
 */
test("単発Taskは計画を捏造せず反復受付と終端を同じWriterへ保存する", async (t) => {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  assert.equal(fs.realpathSync.native(parent), parent);
  const root = fs.mkdtempSync(path.join(parent, "single-task-state-"));
  assert.equal(path.dirname(root), parent);
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  const empty = process.platform === "win32" ? "NUL" : devNull;
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      `core.hooksPath=${empty}`,
      "init",
      "--template=",
      "--initial-branch=main",
    ],
    { windowsHide: true, stdio: "pipe" },
  );
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n");
  fs.mkdirSync(path.join(root, ".git", "info"));
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "");
  const binding = deriveCoordinatorRepositoryBindingId(root);
  const initialized = initializeCoordinatorSnapshot(root, binding);
  assert.equal(initialized.status, "completed", JSON.stringify(initialized));
  if (initialized.status !== "completed") throw new Error("init_failed");
  const record: SingleTaskRecord = {
    principalId: "local-user",
    mode: "workspace_edit",
    executionSelection: executionSelection(),
    taskId: "task-1",
    attemptId: "attempt-1",
    operationId: "operation-1",
    phase: "accepted",
    status: "pending",
    reason: null,
    cleanupConfirmed: false,
    recoveryIds: [],
  };
  const entry: ProjectQueueEntry = {
    queueId: "request-1",
    projectId: "real-project",
    milestoneId: null,
    requestHash: "a".repeat(64),
    originLane: "interactive",
    repositoryRevision: "b".repeat(40),
    scopeHash: "c".repeat(64),
    state: "queued",
    generation: 1,
    ownerGeneration: null,
    resumeCondition: null,
    resultReference: null,
    workspaceId: null,
    singleTask: record,
  };
  const first = enqueueCoordinatorSingleTask(
    root,
    binding,
    initialized.value,
    entry,
  );
  assert.equal(first.status, "completed", JSON.stringify(first));
  assert.equal(
    enqueueCoordinatorSingleTask(root, binding, initialized.value, entry)
      .status,
    "completed",
  );
  assert.equal(
    enqueueCoordinatorSingleTask(root, binding, initialized.value, {
      ...entry,
      requestHash: "d".repeat(64),
    }).status,
    "blocked",
  );
  assert.equal(
    enqueueCoordinatorSingleTask(root, binding, "retired", {
      ...entry,
      queueId: "request-retired",
    }).status,
    "blocked",
  );
  const acquired = acquireCoordinatorSnapshotLease(
    root,
    binding,
    entry.projectId,
    entry.queueId,
    "project-operation",
  );
  assert.equal(acquired.status, "completed", JSON.stringify(acquired));
  if (acquired.status !== "completed") throw new Error("lease_failed");
  const lease = acquired.value;
  try {
    const invalid = updateCoordinatorSingleTask(
      root,
      binding,
      entry.queueId,
      1,
      lease,
      { ...record, phase: "starting", operationId: "other" },
    );
    assert.equal(invalid.status, "blocked");
    const started = updateCoordinatorSingleTask(
      root,
      binding,
      entry.queueId,
      1,
      lease,
      { ...record, phase: "starting" },
    );
    assert.equal(started.status, "completed", JSON.stringify(started));
    const port = createCoordinatorSnapshotStatePort(
      root,
      binding,
      initialized.value,
    );
    assert.equal(
      port.updateQueue(entry.queueId, 2, {
        state: "cancelled",
        lease,
        resumeCondition: null,
        resultReference: null,
      }).status,
      "blocked",
    );
    const done = updateCoordinatorSingleTask(
      root,
      binding,
      entry.queueId,
      2,
      lease,
      {
        ...record,
        phase: "settled",
        status: "completed",
        cleanupConfirmed: true,
      },
    );
    assert.equal(done.status, "completed", JSON.stringify(done));
    const repeated = updateCoordinatorSingleTask(
      root,
      binding,
      entry.queueId,
      3,
      lease,
      {
        ...record,
        phase: "settled",
        status: "completed",
        cleanupConfirmed: true,
      },
    );
    assert.equal(repeated.status, "completed", JSON.stringify(repeated));
    if (repeated.status === "completed")
      assert.equal(repeated.value.generation, 3);
    assert.equal(
      updateCoordinatorSingleTask(root, binding, entry.queueId, 3, lease, {
        ...record,
        phase: "settled",
        status: "blocked",
        reason: "changed_failure",
        cleanupConfirmed: true,
      }).status,
      "blocked",
    );
    const released = lease.release();
    assert.equal(released.status, "completed", JSON.stringify(released));
    // 物理解放後・Queue解放保存前の中断を残し、次の入口で再入場する。
    const interrupted = readCoordinatorSnapshot(root, binding);
    assert.equal(interrupted.status, "completed");
    if (interrupted.status === "completed")
      assert.equal(
        interrupted.value?.queueEntries[0]?.ownerGeneration,
        lease.ownerGeneration,
      );
  } finally {
    lease.release();
  }
  const second = {
    ...entry,
    queueId: "request-2",
    requestHash: "e".repeat(64),
    singleTask: {
      ...record,
      taskId: "task-2",
      attemptId: "attempt-2",
      operationId: "operation-2",
      mode: "read_only_advice" as const,
      executionSelection: executionSelection("advice"),
    },
  };
  assert.equal(
    enqueueCoordinatorSingleTask(root, binding, initialized.value, second)
      .status,
    "completed",
  );
  const read = readCoordinatorSnapshot(root, binding);
  assert.equal(read.status, "completed");
  if (read.status !== "completed" || !read.value)
    throw new Error("read_failed");
  assert.equal(read.value.projects.length, 0);
  assert.equal(read.value.queueEntries.length, 2);
  assert.equal(read.value.historyPending.length, 1);
  assert.equal(JSON.stringify(read.value).includes("prompt"), false);
  let calls = 0;
  let cancelProbe = false;
  let joined = false;
  let permitted = true;
  let revokeDuringJoin = false;
  let failedExecution = false;
  let sameOwnerRecoveries = 0;
  const owner = createCoordinatorTaskRequests({
    root,
    binding,
    projectId: entry.projectId,
    principalId: record.principalId,
    authorize: () => permitted,
    resolveSelection: (command) => ({
      primary: executionSelection(
        command.mode === "read_only_advice" ? "advice" : "executor",
      ),
      taskExecutionSelections:
        command.mode === "workspace_edit" ? taskExecutionSelections() : null,
    }),
    observeRevision: () => entry.repositoryRevision,
    observeLeaseOwner: () => {
      throw new Error("released_owner_must_not_be_observed");
    },
    recover: async () => {
      sameOwnerRecoveries++;
      return {
        cleanupConfirmed: true,
        recoveryIds: [],
        reason: "fixture_recovered",
      };
    },
    execute: async (command, _execution, signal, started) => {
      calls++;
      assert.equal(await started(), true);
      if (cancelProbe) {
        await new Promise<void>((resolve) =>
          signal.addEventListener(
            "abort",
            () => {
              joined = true;
              if (revokeDuringJoin) permitted = false;
              resolve();
            },
            { once: true },
          ),
        );
      }
      return {
        mode: command.mode,
        status: failedExecution
          ? "unknown"
          : signal.aborted
            ? "cancelled"
            : "completed",
        reason: failedExecution ? "fixture_primary_failure" : null,
        cleanupConfirmed: !failedExecution,
        recoveryIds: failedExecution ? ["host.fixture"] : [],
        advice:
          command.mode === "read_only_advice"
            ? {
                facts: [
                  {
                    text: "synthetic advice",
                    references: ["PROJECT_CONTEXT.md"],
                  },
                ],
                sharedAnalysis: [],
                additionalInferences: [],
                nextOptions: [],
              }
            : null,
        workspaceResult:
          command.mode === "workspace_edit"
            ? {
                workspaceId: null,
                changedPaths: ["source.txt"],
                canonicalRepositoryChanged: true,
                changeAttribution: "unattributed",
                workspaceDeletionIssued: false,
              }
            : null,
      };
    },
  });
  const command = {
    mode: "read_only_advice",
    workType: null,
    prompt: "transient synthetic input",
    contextReferences: ["PROJECT_CONTEXT.md"],
    allowedPaths: [] as string[],
    externalSendConfirmed: true,
    expectedNetworkPolicyHash: "a".repeat(64),
    workspaceId: null,
  };
  const beforeCancellation = new AbortController();
  beforeCancellation.abort();
  assert.equal(
    (await owner.start(command, beforeCancellation.signal)).status,
    "blocked",
  );
  assert.equal(calls, 0);
  for (const mode of [
    "read_only_advice",
    "read_only_advice",
    "workspace_edit",
    "workspace_edit",
    "read_only_advice",
  ] as const) {
    const input = {
      ...command,
      mode,
      allowedPaths: mode === "workspace_edit" ? ["source.txt"] : [],
    };
    const pair: Awaited<ReturnType<typeof owner.start>>[] =
      calls === 0
        ? await Promise.all([owner.start(input), owner.start(input)])
        : [await owner.start(input)];
    assert.equal(pair.filter((item) => item.status === "accepted").length, 1);
    const accepted = pair.find((item) => item.status === "accepted");
    assert.ok(accepted);
    assert.equal(accepted.status, "accepted", JSON.stringify(accepted));
    assert.ok(accepted.requestId);
    let observed = await owner.observe(accepted.requestId);
    for (
      let i = 0;
      i < 10 && ["accepted", "running"].includes(observed.status);
      i++
    ) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      observed = await owner.observe(accepted.requestId);
    }
    assert.equal(observed.status, "completed", JSON.stringify(observed));
    assert.equal(observed.mode, mode);
    assert.equal(observed.candidate, null);
  }
  assert.equal(calls, 5);
  cancelProbe = true;
  const accepted = await owner.start(command);
  assert.ok(accepted.requestId);
  const cancelled = await owner.cancel(accepted.requestId);
  assert.equal(cancelled.status, "cancelled", JSON.stringify(cancelled));
  assert.equal(joined, true);
  permitted = true;
  revokeDuringJoin = true;
  const revocation = await owner.start(command);
  assert.ok(revocation.requestId);
  const duplicate = await owner.start(command);
  assert.equal(duplicate.status, "blocked");
  assert.equal(duplicate.reason, "orchestrator_task_request_active");
  const withheld = await owner.cancel(revocation.requestId);
  assert.equal(withheld.reason, "orchestrator_task_not_available");
  assert.deepEqual(withheld.facts, []);
  assert.equal(withheld.taskId, null);
  const after = readCoordinatorSnapshot(root, binding);
  assert.equal(after.status, "completed");
  if (after.status !== "completed" || !after.value)
    throw new Error("read_failed");
  assert.equal(after.value.projects.length, 0);
  assert.equal(after.value.queueEntries.length, 9);
  assert.equal(JSON.stringify(after.value).includes(command.prompt), false);
  assert.equal(JSON.stringify(after.value).includes("synthetic advice"), false);
  permitted = true;
  revokeDuringJoin = false;
  cancelProbe = false;
  const alreadyCompleted = await owner.start(command);
  assert.ok(alreadyCompleted.requestId);
  assert.equal(
    (await owner.wait(alreadyCompleted.requestId)).status,
    "completed",
  );
  cancelProbe = true;
  joined = false;
  const externalCancellation = new AbortController();
  const externalStarted = await owner.start(
    command,
    externalCancellation.signal,
  );
  assert.ok(externalStarted.requestId);
  externalCancellation.abort();
  const externalResult = await owner.wait(externalStarted.requestId);
  assert.equal(externalResult.status, "cancelled");
  assert.equal(externalResult.cleanupConfirmed, true);
  assert.equal(joined, true);
  cancelProbe = false;
  failedExecution = true;
  const unknown = await owner.start(command);
  assert.ok(unknown.requestId);
  const inProcessRecovery = await owner.cancel(unknown.requestId);
  assert.equal(
    inProcessRecovery.cleanupConfirmed,
    true,
    JSON.stringify(inProcessRecovery),
  );
  assert.equal(inProcessRecovery.primaryFailure, "fixture_primary_failure");
  assert.deepEqual(await owner.observe(unknown.requestId), inProcessRecovery);
  assert.equal(sameOwnerRecoveries, 1);
  await owner.close();
  let recoveries = 0;
  const reentry = createCoordinatorTaskRequests({
    root,
    binding,
    projectId: entry.projectId,
    principalId: record.principalId,
    authorize: () => true,
    resolveSelection: () => {
      throw Error("recovery_must_not_read_configuration");
    },
    observeRevision: () => entry.repositoryRevision,
    observeLeaseOwner: () => {
      throw new Error("released_owner_must_not_be_observed");
    },
    recover: async () => {
      recoveries++;
      return {
        cleanupConfirmed: true,
        recoveryIds: [],
        reason: "fixture_recovered",
      };
    },
    execute: async () => {
      throw new Error("body_must_not_be_replayed");
    },
  });
  const unstarted = await reentry.cancel(second.queueId);
  assert.equal(unstarted.executionStatus, "blocked", JSON.stringify(unstarted));
  assert.equal(unstarted.cleanupConfirmed, true);
  assert.equal(recoveries, 0);
  const clean = await reentry.observe(entry.queueId);
  assert.equal(clean.executionStatus, "completed");
  assert.equal(clean.primaryFailure, null);
  assert.equal(clean.reason, "orchestrator_task_body_unavailable");
  const recoveryEntry: ProjectQueueEntry = {
    ...entry,
    queueId: "request-recovery",
    singleTask: {
      ...record,
      taskId: "task-recovery",
      attemptId: "attempt-recovery",
      operationId: "operation-recovery",
    },
  };
  assert.equal(
    enqueueCoordinatorSingleTask(
      root,
      binding,
      initialized.value,
      recoveryEntry,
    ).status,
    "completed",
  );
  const recoveryLease = acquireCoordinatorSnapshotLease(
    root,
    binding,
    entry.projectId,
    recoveryEntry.queueId,
    "project-operation",
  );
  assert.equal(recoveryLease.status, "completed");
  if (recoveryLease.status !== "completed" || !recoveryEntry.singleTask)
    throw new Error("fixture_lease_required");
  try {
    assert.equal(
      updateCoordinatorSingleTask(
        root,
        binding,
        recoveryEntry.queueId,
        1,
        recoveryLease.value,
        { ...recoveryEntry.singleTask, phase: "starting" },
      ).status,
      "completed",
    );
    assert.equal(
      updateCoordinatorSingleTask(
        root,
        binding,
        recoveryEntry.queueId,
        2,
        recoveryLease.value,
        {
          ...recoveryEntry.singleTask,
          phase: "settled",
          status: "unknown",
          reason: "fixture_primary_failure",
          recoveryIds: ["host.fixture"],
        },
      ).status,
      "completed",
    );
    assert.equal(recoveryLease.value.release().status, "completed");
    assert.equal(
      createCoordinatorSnapshotStatePort(
        root,
        binding,
        initialized.value,
      ).settleQueueLeaseRelease(
        recoveryEntry.queueId,
        3,
        recoveryLease.value.ownerGeneration,
      ).status,
      "completed",
    );
  } finally {
    recoveryLease.value.release();
  }
  const recovered = await reentry.cancel(recoveryEntry.queueId);
  assert.equal(recovered.cleanupConfirmed, true, JSON.stringify(recovered));
  assert.equal(recovered.executionStatus, "unknown");
  assert.equal(recovered.primaryFailure, "fixture_primary_failure");
  assert.equal(recovered.reason, "orchestrator_task_body_unavailable");
  assert.equal(recoveries, 1);
  assert.deepEqual(recovered.recoveryIds, []);
  const repeatedRecovery = await reentry.cancel(recoveryEntry.queueId);
  assert.equal(repeatedRecovery.cleanupConfirmed, true);
  assert.equal(recoveries, 1);
  await reentry.close();
});

/**
 * 単発保存の閉じた相関と不正入力の非実行を確認する。
 * @responsibility getter／Proxy、本文混入と未回収成功を拒否する。
 * @trace CPR-IT-004
 * @precondition 合成値だけを使用する。
 * @stimulus 不正shapeと終端相関違反。
 * @observation nullとgetter呼出し0。
 * @oracle 不明・未回収を成功へ変換しない。
 * @cleanup Process内値のみ。
 * @boundary codec。
 */
test("単発記録は本文・getter・未回収成功を受理しない", () => {
  const record = {
    principalId: "user",
    mode: "read_only_advice",
    executionSelection: executionSelection("advice"),
    taskId: "task",
    attemptId: "attempt",
    operationId: "operation",
    phase: "settled",
    status: "completed",
    reason: null,
    cleanupConfirmed: true,
    recoveryIds: [],
  };
  assert.ok(inspectSingleTaskRecord(record));
  assert.equal(
    inspectSingleTaskRecord({ ...record, prompt: "never persisted" }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({ ...record, cleanupConfirmed: false }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({
      ...record,
      recoveryIds: ["docker-task.pending"],
    }),
    null,
  );
  let hits = 0;
  assert.equal(
    inspectSingleTaskRecord({
      ...record,
      get phase() {
        hits++;
        return "settled";
      },
    }),
    null,
  );
  assert.equal(
    inspectSingleTaskRecord({
      ...record,
      recoveryIds: new Proxy([], {
        ownKeys() {
          hits++;
          return [];
        },
      }),
    }),
    null,
  );
  assert.equal(hits, 0);
});
