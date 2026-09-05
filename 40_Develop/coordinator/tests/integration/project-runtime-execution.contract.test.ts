import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createRuntimeProcessRecoveryIdentity } from "../../src/core/runtime-process-safety-state.ts";

import {
  enqueueProjectOperation,
  readProjectOperationQueueState,
  readProjectRuntimeState,
  reconcileProjectRuntimeLeaseOwnerLoss,
  writeProjectRuntimeState,
} from "../../src/security/project-runtime-durable-foundation.ts";
import {
  describeProjectRuntimeExecutionContract,
  runProjectRuntimeOperation,
} from "../../src/security/project-runtime-execution.ts";
import type { ProjectRuntimeSingleTaskResult } from "../../src/security/project-runtime-single-task-adapter.ts";
import { runProjectRuntimeSingleTaskAttempt } from "../../src/security/project-runtime-single-task-adapter.ts";
import {
  createProjectRuntimeState,
  type ProjectTaskDefinition,
} from "../../src/security/project-runtime-state.ts";

const revision = "a".repeat(40);

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function task(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return {
    id,
    objectiveId: "objective-a",
    dependencies,
    allowedPaths,
    conflictKeys,
  };
}

function fixture(
  t: test.TestContext,
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-execution-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const created = createProjectRuntimeState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks,
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture_failed");
  assert.equal(
    writeProjectRuntimeState(root, "binding-a", created.state, 0).status,
    "completed",
  );
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("request"),
      originLane: "interactive",
      repositoryRevision: revision,
      scopeHash: hash("scope"),
    }).status,
    "completed",
  );
  const input = {
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    taskExecutions: tasks.map((entry) => ({
      taskId: entry.id,
      authorityBindingId: `authority-${entry.id}`,
      taskRequest: { taskId: entry.id },
      taskAuthorityCapability: {},
      repositoryRoot: root,
    })),
    cancellationSignal: new AbortController().signal,
  };
  return { root, input };
}

async function completed(
  input: Parameters<
    Parameters<typeof runProjectRuntimeOperation>[0]["runSingleTaskAttempt"]
  >[0],
): Promise<ProjectRuntimeSingleTaskResult> {
  assert.equal(await input.observeStarted?.(), true);
  return completedAfterStart(input);
}

function completedAfterStart(
  input: Parameters<
    Parameters<typeof runProjectRuntimeOperation>[0]["runSingleTaskAttempt"]
  >[0],
): ProjectRuntimeSingleTaskResult {
  return {
    contract: "crdd-coordinator/project-runtime-single-task-adapter",
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

test("PR-N-01 connects one durable Project task to the Single Task boundary", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  let effects = 0;
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed", JSON.stringify(outcome));
  assert.equal(
    outcome.reason,
    "project_runtime_tasks_completed_integration_pending",
  );
  assert.equal(effects, 1);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "completed",
  );
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "integration_pending",
  );
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );

  const replay = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(
    replay.reason,
    "project_runtime_tasks_already_integration_pending",
  );
  assert.equal(effects, 1);
});

test("interactive Queue wins a fresh binding-wide selection before a scheduled caller can claim", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-scheduled",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("scheduled-request"),
      originLane: "scheduled",
      repositoryRevision: revision,
      scopeHash: hash("scheduled-scope"),
    }).status,
    "completed",
  );
  let effects = 0;
  const dependencies = {
    runSingleTaskAttempt: async (attempt: Parameters<typeof completed>[0]) => {
      effects += 1;
      return completed(attempt);
    },
  };
  const scheduled = await runProjectRuntimeOperation(dependencies, {
    ...input,
    queueId: "queue-scheduled",
  });
  assert.equal(scheduled.status, "blocked");
  assert.equal(
    scheduled.reason,
    "project_runtime_queue_claim_priority_changed",
  );
  assert.equal(scheduled.effectState, "no_effect");
  assert.equal(effects, 0);
  const interactive = await runProjectRuntimeOperation(dependencies, input);
  assert.equal(interactive.status, "completed");
  assert.equal(effects, 1);
});

test("PR-N-01 uses the existing Single Task adapter without widening its authority", async (t) => {
  const { input } = fixture(t, [task("task-a")], 1);
  let starts = 0;
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: (attempt) =>
        runProjectRuntimeSingleTaskAttempt(
          {
            startTask: () => {
              starts += 1;
              return {
                status: "started",
                controlCapability: {},
                completion: Promise.resolve({
                  status: "completed",
                  reason: "coordinator_task_completed",
                  cleanupConfirmed: true,
                  manualRecoveryRequired: false,
                  processRestartRequired: false,
                  candidateId: null,
                  hostRecoveryId: null,
                  dockerRecoveryIds: [],
                  candidateRecoveryId: null,
                  candidateStoreRecoveryId: null,
                }),
              };
            },
            cancelTask: () => undefined,
          },
          attempt,
        ),
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.equal(starts, 1);
});

test("PR-N-02 runs at most five independent tasks and then drains the remainder", async (t) => {
  const tasks = Array.from({ length: 7 }, (_unused, index) =>
    task(`task-${index + 1}`),
  );
  const { root, input } = fixture(t, tasks, 5);
  let active = 0;
  let maximumActive = 0;
  let preparedAtFirstEffect: number | null = null;
  let authoritiesIssued = 0;
  const observedAuthorities = new Set<object>();
  const outcome = await runProjectRuntimeOperation(
    {
      issueTaskAuthority: () => {
        authoritiesIssued += 1;
        return Object.freeze({ sequence: authoritiesIssued });
      },
      runSingleTaskAttempt: async (attempt) => {
        observedAuthorities.add(attempt.taskAuthorityCapability);
        if (preparedAtFirstEffect === null) {
          const observed = readProjectRuntimeState(
            root,
            "binding-a",
            "project-a",
          );
          assert.equal(observed.status, "completed");
          assert.ok(observed.value);
          preparedAtFirstEffect =
            observed.value?.tasks.filter(
              (entry) =>
                entry.state === "starting" &&
                entry.startPhase === "handoff_prepared",
            ).length ?? null;
        }
        assert.equal(await attempt.observeStarted?.(), true);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return completedAfterStart(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.equal(preparedAtFirstEffect, 5);
  assert.equal(maximumActive, 5);
  assert.equal(outcome.completedTaskIds.length, 7);
  assert.equal(authoritiesIssued, 7);
  assert.equal(observedAuthorities.size, 7);
});

test("PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across waves", async (t) => {
  const tasks = [
    task("task-a", [], ["shared"]),
    task("task-b", ["task-a"]),
    task("task-c", [], ["shared/file.txt"]),
    task("task-d", [], ["other.txt"]),
  ];
  const { input } = fixture(t, tasks, 5);
  const startedItems: string[] = [];
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        const taskId = (attempt.taskRequest as { taskId: string }).taskId;
        startedItems.push(taskId);
        await new Promise((resolve) => setTimeout(resolve, 2));
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.deepEqual(startedItems.slice(0, 2), ["task-a", "task-d"]);
  assert.ok(
    outcome.completedTaskIds.indexOf("task-a") <
      outcome.completedTaskIds.indexOf("task-b"),
  );
  assert.ok(
    outcome.completedTaskIds.indexOf("task-a") <
      outcome.completedTaskIds.indexOf("task-c"),
  );
  assert.equal(new Set(outcome.completedTaskIds).size, 4);
});

test("PR-A-03 rejects a result from another attempt without projecting success", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => ({
        ...(await completed(attempt)),
        attemptId: "another-attempt",
      }),
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "project_runtime_task_recovery_required");
  assert.equal(outcome.manualRecoveryRequired, true);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "recovery_required",
  );
});

test("PR-A-03 rejects malformed and differently bound Single Task results", async (t) => {
  const cases = [
    ["contract", { contract: "wrong-contract" }],
    ["operation", { operationId: "other-operation" }],
    ["authority", { authorityBindingId: "other-authority" }],
    ["missing-recovery", { recoveryIds: undefined }],
    ["extra-field", { extra: true }],
  ] as const;
  for (const [name, override] of cases) {
    await t.test(name, async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runProjectRuntimeOperation(
        {
          runSingleTaskAttempt: async (attempt) =>
            ({
              ...(await completed(attempt)),
              ...override,
            }) as ProjectRuntimeSingleTaskResult,
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.reason, "project_runtime_task_recovery_required");
      const state = readProjectRuntimeState(root, "binding-a", "project-a");
      assert.equal(state.status, "completed");
      assert.ok(state.value);
      assert.ok(state.value);
      assert.equal(
        state.status === "completed" && state.value?.tasks[0]?.state,
        "recovery_required",
      );
    });
  }
});

test("PR-A-03 rejects recovery identifiers that durable Project State cannot store", async (t) => {
  for (const recoveryId of [
    "recovery/a",
    "recovery id",
    "recovery\u0001id",
    `r${"x".repeat(512)}`,
  ]) {
    await t.test(JSON.stringify(recoveryId).slice(0, 40), async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runProjectRuntimeOperation(
        {
          runSingleTaskAttempt: async (attempt) => ({
            ...(await completed(attempt)),
            status: "blocked",
            reason: "external_recovery_required",
            effectState: "unknown",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            recoveryIds: [recoveryId],
          }),
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.reason, "project_runtime_task_recovery_required");
      const state = readProjectRuntimeState(root, "binding-a", "project-a");
      assert.equal(state.status, "completed");
      assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
      assert.equal(
        state.value?.tasks[0]?.recoveryObligations[0]?.kind,
        "runtime_process",
      );
    });
  }
});

test("下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const forged = `runtime-process.11111111-1111-4111-8111-111111111111.restart-${"a".repeat(40)}`;
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) =>
        ({
          ...(await completed(attempt)),
          status: "blocked",
          reason: "forged_process_recovery",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          candidateId: null,
          recoveryIds: [forged],
          recoveryObligations: [
            { kind: "runtime_process" as const, recoveryId: forged },
          ],
        }) as unknown as ProjectRuntimeSingleTaskResult,
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(outcome.processRestartRequired, true);
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  assert.equal(
    state.value?.tasks[0]?.recoveryObligations[0]?.kind,
    "runtime_process",
  );
});

test("開始後の候補回収IDだけでは外部Effectの不明状態を解消しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const candidateRecoveryId = "candidate.recovery-a";
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => ({
        ...(await completed(attempt)),
        status: "blocked",
        reason: "candidate_cleanup_unknown",
        effectState: "unknown",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        candidateId: null,
        recoveryIds: [candidateRecoveryId],
        recoveryObligations: [
          { kind: "candidate" as const, recoveryId: candidateRecoveryId },
        ],
      }),
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  assert.deepEqual(
    state.value?.tasks[0]?.recoveryObligations.map((entry) => entry.kind),
    ["candidate", "runtime_process"],
  );
});

test("PR-A-03 enforces result correlations and propagates process restart", async (t) => {
  const cases = [
    {
      name: "completed-no-effect",
      override: { effectState: "no_effect" as const },
      restart: true,
    },
    {
      name: "completed-restart",
      override: { processRestartRequired: true },
      restart: true,
    },
    {
      name: "unknown-with-cleanup",
      override: {
        status: "blocked" as const,
        effectState: "unknown" as const,
        cleanupConfirmed: true,
        manualRecoveryRequired: true,
      },
      restart: true,
    },
    {
      name: "blocked-restart",
      override: {
        status: "blocked" as const,
        reason: "restart_required",
        effectState: "no_effect" as const,
        processRestartRequired: true,
      },
      restart: true,
    },
    {
      name: "cancelled-no-effect-after-start",
      override: {
        status: "cancelled" as const,
        reason: "cancelled_after_effect_start",
        effectState: "no_effect" as const,
      },
      restart: true,
    },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runProjectRuntimeOperation(
        {
          runSingleTaskAttempt: async (attempt) => ({
            ...(await completed(attempt)),
            ...scenario.override,
          }),
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.manualRecoveryRequired, true);
      assert.equal(outcome.processRestartRequired, scenario.restart);
      const state = readProjectRuntimeState(root, "binding-a", "project-a");
      assert.ok(state.value);
      assert.equal(
        state.status === "completed" && state.value.tasks[0]?.state,
        "recovery_required",
      );
      if (scenario.restart && state.status === "completed") {
        assert.equal(state.value.tasks[0]?.recoveryUnresolved, true);
        assert.equal(
          state.value.tasks[0]?.recoveryObligations[0]?.kind,
          "runtime_process",
        );
        assert.match(
          state.value.tasks[0]?.recoveryObligations[0]?.recoveryId ?? "",
          /^runtime-process\.[0-9a-f-]{36}\.restart-[0-9a-f]{40}$/u,
        );
      }
    });
  }
});

test("PR-A-03 stops later waves when a Task requires process restart", async (t) => {
  const { input } = fixture(t, [task("task-a"), task("task-b")], 1);
  const startedItems: string[] = [];
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        startedItems.push((attempt.taskRequest as { taskId: string }).taskId);
        return {
          ...(await completed(attempt)),
          status: "blocked",
          reason: "restart_required",
          effectState: "no_effect",
          processRestartRequired: true,
        };
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  assert.deepEqual(startedItems, ["task-a"]);
});

test("runtime_process義務は同じTask attemptとoperationにだけ結合する", async (t) => {
  const { root, input } = fixture(t, [task("task-a"), task("task-b")], 2);
  let firstRecoveryId = "";
  const outcome = await runProjectRuntimeOperation(
    {
      poisonProcessAfterAuthorityRevocationUnknown: () => undefined,
      runSingleTaskAttempt: async (attempt) => {
        await attempt.observeStarted?.();
        if ((attempt.taskRequest as { taskId: string }).taskId === "task-a") {
          firstRecoveryId = createRuntimeProcessRecoveryIdentity(
            attempt.attemptId,
            attempt.operationId,
          );
          return {
            ...completedAfterStart(attempt),
            status: "blocked",
            reason: "restart_required",
            effectState: "unknown",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            processRestartRequired: true,
          };
        }
        return {
          ...completedAfterStart(attempt),
          status: "blocked",
          reason: "cross_task_recovery_replay",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          recoveryIds: [firstRecoveryId],
          recoveryObligations: [
            { kind: "runtime_process" as const, recoveryId: firstRecoveryId },
          ],
        } as unknown as ProjectRuntimeSingleTaskResult;
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  const first = state.value?.tasks.find(
    (entry) => entry.definition.id === "task-a",
  );
  const second = state.value?.tasks.find(
    (entry) => entry.definition.id === "task-b",
  );
  assert.equal(first?.recoveryObligations[0]?.recoveryId, firstRecoveryId);
  assert.notEqual(second?.recoveryObligations[0]?.recoveryId, firstRecoveryId);
  assert.equal(second?.recoveryObligations[0]?.kind, "runtime_process");
});

test("下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しない", async (t) => {
  await t.test("after-start", async (subtest) => {
    const { root, input } = fixture(subtest, [task("task-a")], 1);
    let poisoned = 0;
    const outcome = await runProjectRuntimeOperation(
      {
        poisonProcessAfterAuthorityRevocationUnknown: () => {
          poisoned += 1;
        },
        runSingleTaskAttempt: async (attempt) => {
          assert.equal(await attempt.observeStarted?.(), true);
          throw new Error("runner_failed_after_effect_start");
        },
      },
      input,
    );
    assert.equal(outcome.processRestartRequired, true);
    assert.equal(poisoned, 1);
    const state = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(
      state.value?.tasks[0]?.recoveryObligations[0]?.kind,
      "runtime_process",
    );
  });
  await t.test("before-start-observation", async (subtest) => {
    const { root, input } = fixture(subtest, [task("task-a")], 1);
    let poisoned = 0;
    const outcome = await runProjectRuntimeOperation(
      {
        poisonProcessAfterAuthorityRevocationUnknown: () => {
          poisoned += 1;
        },
        runSingleTaskAttempt: async () => {
          throw new Error("runner_failed_before_effect_start");
        },
      },
      input,
    );
    assert.equal(outcome.processRestartRequired, true);
    assert.equal(poisoned, 1);
    assert.equal(outcome.effectState, "unknown");
    const state = readProjectRuntimeState(root, "binding-a", "project-a");
    assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  });
});

test("PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservable", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const queueDirectory = path.join(
    root,
    ".crdd",
    "project-runtime",
    "queue",
    "queue-a",
  );
  const residue = path.join(queueDirectory, "unexpected-record.json");
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        fs.writeFileSync(residue, "{}\n", "utf8");
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.manualRecoveryRequired, true);
  const locks = path.join(root, ".crdd", "project-runtime", "locks");
  assert.deepEqual(
    fs
      .readdirSync(locks)
      .filter((name) => name.startsWith("project-operation-project-a-queue-a")),
    [],
  );
  fs.rmSync(residue);
  const before = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(before.status, "completed");
  assert.notEqual(
    before.status === "completed" && before.value.ownerGeneration,
    null,
  );
  const reconciled = reconcileProjectRuntimeLeaseOwnerLoss(
    root,
    "binding-a",
    "project-a",
    "queue-a",
    () => {
      throw new Error("released evidence must avoid owner observation");
    },
  );
  assert.equal(reconciled.status, "completed");
  assert.equal(
    reconciled.status === "completed" && reconciled.value.ownerGeneration,
    null,
  );
});

test("PR-A-03 treats a synchronous failure after delegation as an unknown handoff", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: () => {
        throw new Error("synchronous runner failure");
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "project_runtime_task_recovery_required");
  assert.equal(outcome.cleanupConfirmed, false);
  assert.equal(outcome.manualRecoveryRequired, true);
  assert.equal(outcome.effectState, "unknown");
  assert.equal(outcome.processRestartRequired, true);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value?.tasks[0]?.state,
    "recovery_required",
  );
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
});

test("PR-A-05 keeps capacity and conflict reserved when cleanup is unknown", async (t) => {
  const { root, input } = fixture(
    t,
    [task("task-a", [], ["shared"]), task("task-b", [], ["shared/file.txt"])],
    1,
  );
  const startedItems: string[] = [];
  const outcome = await runProjectRuntimeOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        startedItems.push((attempt.taskRequest as { taskId: string }).taskId);
        return {
          ...(await completed(attempt)),
          status: "blocked",
          reason: "cleanup_unknown",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        };
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.manualRecoveryRequired, true);
  assert.deepEqual(startedItems, ["task-a"]);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "recovery_required",
  );
  assert.equal(
    state.status === "completed" && state.value.tasks[1]?.state,
    "ready",
  );
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "recovery_required",
  );
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
});

test("PR-Q-04 cancels before Task effect and releases durable ownership", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  controller.abort();
  let effects = 0;
  let authoritiesIssued = 0;
  const outcome = await runProjectRuntimeOperation(
    {
      issueTaskAuthority: () => {
        authoritiesIssued += 1;
        return {};
      },
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(outcome.status, "cancelled", JSON.stringify(outcome));
  assert.equal(effects, 0);
  assert.equal(authoritiesIssued, 0);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "cancelled");
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
});

test("PR-Q-04 revokes a freshly issued unused Authority when cancellation arrives at the issue boundary", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  const authority = {};
  let effects = 0;
  let revocations = 0;
  const outcome = await runProjectRuntimeOperation(
    {
      issueTaskAuthority: () => {
        controller.abort();
        return authority;
      },
      revokeTaskAuthority: (candidate) => {
        assert.equal(candidate, authority);
        revocations += 1;
        return true;
      },
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(outcome.status, "cancelled", JSON.stringify(outcome));
  assert.equal(outcome.cleanupConfirmed, true);
  assert.equal(outcome.manualRecoveryRequired, false);
  assert.equal(effects, 0);
  assert.equal(revocations, 1);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "cancelled");
});

test("Authority発行失敗はEffect 0でreplanへ閉じる", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  let effects = 0;
  const outcome = await runProjectRuntimeOperation(
    {
      issueTaskAuthority: () => null,
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "project_runtime_replan_required");
  assert.equal(outcome.effectState, "no_effect");
  assert.equal(outcome.processRestartRequired, false);
  assert.equal(effects, 0);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.value?.tasks[0]?.state, "failed");
});

test("未使用Authorityの取消結果が不明なら同一Processをpoisonして再起動を要求する", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  let poisoned = 0;
  let effects = 0;
  const outcome = await runProjectRuntimeOperation(
    {
      issueTaskAuthority: () => {
        controller.abort();
        return {};
      },
      revokeTaskAuthority: () => false,
      poisonProcessAfterAuthorityRevocationUnknown: () => {
        poisoned += 1;
      },
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "project_runtime_task_recovery_required");
  assert.equal(outcome.cleanupConfirmed, false);
  assert.equal(outcome.effectState, "unknown");
  assert.equal(outcome.processRestartRequired, true);
  assert.equal(poisoned, 1);
  assert.equal(effects, 0);
  const state = readProjectRuntimeState(root, "binding-a", "project-a");
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, false);
  assert.equal(
    state.value?.tasks[0]?.recoveryObligations[0]?.kind,
    "runtime_process",
  );
});

test("contract remains a partial Project Runtime capability", () => {
  assert.deepEqual(describeProjectRuntimeExecutionContract(), {
    contract: "crdd-coordinator/project-runtime-execution/v1",
    maximumConcurrency: 5,
    externalWaitWhileMutationLockHeld: false,
    cleanupUnknownDisposition: "durable_recovery_and_reservation_retained",
    staleOrOwnedQueueDisposition: "effect_zero_manual_reconciliation",
    upperProjectRuntimeCapabilityComplete: false,
  });
});
