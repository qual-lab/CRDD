/** 自己生成Workspaceの子Processで、選定とProvider委譲だけを差し替える。 @trace PRL-IT-012 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  registerHooks,
  stripTypeScriptTypes,
  syncBuiltinESMExports,
} from "node:module";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type {
  CoordinatorSingleTaskAttemptInput,
  CoordinatorSingleTaskResult,
} from "../../../coordinator/src/lifecycle/types.ts";
import { taskExecutionSelections } from "../../../coordinator/tests/fixtures/ai-selection.ts";

const directory = process.env.CRDD_GRAPH_FIXTURE_DIRECTORY;
assert.ok(directory && process.send);
const control = directory;
const stateLock = path.join(
  control,
  "..",
  "lock",
  "execution-model.state.lock",
);
const open = fs.openSync;
let acquisitions = 0;
let firstResult: { acquisitions: number; time: number } | undefined;
fs.openSync = (...args: Parameters<typeof open>) => {
  const fd = open(...args);
  if (
    typeof args[0] === "string" &&
    path.normalize(args[0]) === stateLock &&
    args[1] === "wx+"
  )
    acquisitions++;
  return fd;
};
syncBuiltinESMExports();

// 回復が耐久確定した直後だけ、次の短期Readerを実ファイルの競合に当てる。
const recoveryArm = path.join(control, "cancel-after-recovery.arm");
if (fs.existsSync(recoveryArm)) {
  const queueId = fs.readFileSync(recoveryArm, "utf8");
  const stateFile = path.join(control, "..", "execution-model", "state.json");
  const shortLock = path.join(
    control,
    "..",
    "lock",
    "execution-model.state.lock",
  );
  const remove = fs.rmSync;
  let injected = false;
  fs.rmSync = (...args: Parameters<typeof remove>) => {
    remove(...args);
    if (injected || String(args[0]) !== shortLock) return;
    const stored = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (
      !stored.queueEntries.some(
        (queue: { queueId: string; state: string; ownerGeneration: unknown }) =>
          queue.queueId === queueId &&
          queue.state === "recovery_required" &&
          queue.ownerGeneration === null,
      ) ||
      stored.leaseIntents.some(
        (intent: { queueId: string }) => intent.queueId === queueId,
      )
    )
      return;
    injected = true;
    fs.writeFileSync(shortLock, "", { flag: "wx" });
    process.once("exit", () => remove(shortLock, { force: true }));
    fs.writeFileSync(path.join(control, "cancel-after-recovery.ready"), "", {
      flag: "wx",
    });
    const ack = path.join(control, "cancel-after-recovery.sent");
    const deadline = Date.now() + 2_000;
    const wait = new Int32Array(new SharedArrayBuffer(4));
    while (!fs.existsSync(ack)) {
      assert.ok(
        Date.now() < deadline,
        "fixture_waiting_for_recovery_cancellation",
      );
      Atomics.wait(wait, 0, 0, 5);
    }
  };
}

// OSが指定したPIDの生存判定を返せないケースだけを合成する。別PIDや終了要求には触れない。
const unknownPid = Number(process.env.CRDD_GRAPH_FIXTURE_UNKNOWN_PID);
if (Number.isSafeInteger(unknownPid) && unknownPid > 0) {
  const kill = process.kill;
  process.kill = (pid, signal) => {
    if (pid === unknownPid && signal === 0)
      throw Object.assign(Error("fixture_owner_observation_unavailable"), {
        code: "EPERM",
      });
    return kill(pid, signal);
  };
}

registerHooks({
  load(url, context, next) {
    if (!url.endsWith("/coordinator/src/lifecycle/execution.ts"))
      return next(url, context);
    const source = stripTypeScriptTypes(fs.readFileSync(new URL(url), "utf8"));
    const calls = /(?<!function )\brunCoordinatorSingleTaskAttempt(?=\()/gu;
    const selection = /\bresolveObjectiveTaskSelections(?=\()/gu;
    assert.equal([...source.matchAll(calls)].length, 2);
    assert.equal([...source.matchAll(selection)].length, 1);
    return {
      format: "module",
      shortCircuit: true,
      source:
        `import { taskAttempt as fixtureGraphAttempt, selections as fixtureGraphSelection } from ${JSON.stringify(import.meta.url)};\n` +
        source
          .replace(calls, "fixtureGraphAttempt")
          .replace(selection, "fixtureGraphSelection"),
    };
  },
});

/** CatalogやProviderに接続しない選定値。 @trace PRL-IT-012 */
export function selections() {
  return {
    status: "resolved",
    reason: null,
    value: taskExecutionSelections(),
  } as const;
}

/** 実開始の保存が済むまで待ち、試験の解放通知まで作業結果を返さない。 @trace PRL-IT-012 */
export async function taskAttempt(
  input: CoordinatorSingleTaskAttemptInput,
): Promise<CoordinatorSingleTaskResult> {
  const workspace = input.workspaceTarget;
  assert.ok(workspace?.workspaceId && workspace.executionTree);
  assert.equal(
    path.dirname(path.dirname(control)),
    workspace.ownerRepositoryRoot,
  );
  assert.match(workspace.workspaceId, /^[0-9a-f-]{36}$/u);
  const tree = path.join(
    workspace.ownerRepositoryRoot,
    ".crdd",
    "workspaces",
    workspace.workspaceId,
    "worktree",
  );
  assert.equal(workspace.executionTree, tree);
  assert.equal(fs.realpathSync.native(tree), tree);
  const pauseBeforeStart = fs.existsSync(
    path.join(control, `${workspace.workspaceId}.before-start`),
  );
  const laterTask = input.executionMetadata?.taskId === "task-b";
  if (laterTask) {
    assert.ok(firstResult);
    fs.writeFileSync(
      path.join(
        control,
        `${workspace.workspaceId}.${process.pid}.next-task.json`,
      ),
      JSON.stringify({
        acquisitions: acquisitions - firstResult.acquisitions,
        elapsedMs: performance.now() - firstResult.time,
      }),
      { flag: "wx" },
    );
  }
  if (!pauseBeforeStart) await input.observeStarted?.();
  if (!laterTask)
    fs.writeFileSync(
      path.join(control, `${workspace.workspaceId}.${process.pid}.ready`),
      workspace.executionTree,
      { flag: "wx" },
    );
  for (let i = 0; i < 1200; i++) {
    if (input.cancellationSignal.aborted) {
      return {
        contract: "crdd-coordinator/single-task-adapter",
        attemptId: input.attemptId,
        operationId: input.operationId,
        authorityBindingId: input.authorityBindingId,
        repositoryRevision: input.repositoryRevision,
        status: "cancelled",
        reason: pauseBeforeStart
          ? "fixture_cancelled_before_provider"
          : "fixture_cancelled_after_start",
        effectState: pauseBeforeStart ? "no_effect" : "settled",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        candidateId: null,
        recoveryIds: [],
      };
    }
    if (pauseBeforeStart) {
      await delay(25);
      continue;
    }
    if (
      fs.existsSync(path.join(control, `${workspace.workspaceId}.continue`))
    ) {
      const file = path.join(tree, "source.txt");
      const entry = fs.lstatSync(file);
      assert.ok(entry.isFile() && !entry.isSymbolicLink() && entry.nlink === 1);
      assert.equal(fs.realpathSync.native(file), file);
      fs.writeFileSync(file, `${workspace.workspaceId}\n`);
      if (!laterTask) firstResult = { acquisitions, time: performance.now() };
      return {
        contract: "crdd-coordinator/single-task-adapter",
        attemptId: input.attemptId,
        operationId: input.operationId,
        authorityBindingId: input.authorityBindingId,
        repositoryRevision: input.repositoryRevision,
        status: "completed",
        reason: "task_completed",
        effectState: "settled",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
        candidateId: null,
        recoveryIds: [],
      };
    }
    await delay(25);
  }
  throw Error("fixture_barrier_timed_out");
}
