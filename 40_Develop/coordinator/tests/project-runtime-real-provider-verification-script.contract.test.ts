import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildProjectRuntimeRealProviderReport,
  observePublicMcpProcess,
  type JsonRecord,
  type PublicProcessObservation,
} from "../scripts/project-runtime-real-provider-contract.ts";

const fixture = fileURLToPath(
  new URL("fixtures/project-runtime-public-process-probe.ts", import.meta.url),
);
const projection = (cancelled: boolean) => ({
  projectId: "project-a",
  milestoneId: "milestone-a",
  generation: 1,
  milestoneState: cancelled ? "cancelled" : "accepted",
  objectiveCounts: {
    planned: 0,
    executing: 0,
    integration_pending: 0,
    accepted: cancelled ? 0 : 1,
    blocked: 0,
    cancelled: cancelled ? 1 : 0,
  },
  taskCounts: {
    planned: 0,
    waiting_dependency: 0,
    ready: 0,
    starting: 0,
    running: 0,
    cleanup_pending: 0,
    completed: cancelled ? 0 : 1,
    failed: 0,
    cancelled: cancelled ? 1 : 0,
    recovery_required: 0,
    superseded: 0,
  },
  objectiveTaskSummaries: [
    {
      objectiveId: "objective-a",
      objectiveState: cancelled ? "cancelled" : "accepted",
      taskCounts: {
        planned: 0,
        waiting_dependency: 0,
        ready: 0,
        starting: 0,
        running: 0,
        cleanup_pending: 0,
        completed: cancelled ? 0 : 1,
        failed: 0,
        cancelled: cancelled ? 1 : 0,
        recovery_required: 0,
        superseded: 0,
      },
    },
  ],
  workProgress: cancelled ? "in_progress" : "tasks_complete",
  qualityState: cancelled ? "not_evaluated" : "accepted",
  humanDecisionRequired: false,
  recoveryRequired: false,
  nextAction: cancelled ? "wait_for_task" : "complete",
});
const semantic = (
  status: "completed" | "cancelled",
  id: string,
  overrides: Record<string, unknown> = {},
) => ({
  jsonrpc: "2.0",
  id,
  result: {
    structuredContent: {
      status,
      reason:
        status === "cancelled"
          ? "project_runtime_operation_cancelled"
          : "project_runtime_milestone_accepted",
      contract: "crdd-coordinator/project-runtime-objective-intake/v1",
      requestId: "request-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      queueId: "queue-a",
      projection: projection(status === "cancelled"),
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      recoveryIds: [],
      recoveryObligations: [],
      effectState: "settled",
      ...overrides,
    },
  },
});
const observation = (
  responses: readonly unknown[],
  overrides: Partial<PublicProcessObservation> = {},
): PublicProcessObservation => {
  const selectionEvents: PublicProcessObservation["selectionEvents"] =
    overrides.selectionEvents ?? [
      { taskRole: "executor", provider: "codex" },
      { taskRole: "reviewer", provider: "claude" },
    ];
  const processStartEvents: PublicProcessObservation["processStartEvents"] =
    overrides.processStartEvents ?? [
      {
        taskRole: "executor",
        provider: "codex",
        operationId: "OP-100001",
      },
      {
        taskRole: "reviewer",
        provider: "claude",
        operationId: "OP-100002",
      },
    ];
  const runtimeEvents =
    overrides.runtimeEvents ??
    selectionEvents.flatMap((event, index) => {
      const started = processStartEvents[index];
      return [
        { event: "selection" as const, ...event, operationId: null },
        ...(started ? [{ event: "process_started" as const, ...started }] : []),
      ];
    });
  return Object.freeze({
    exit: { code: 0, signal: null },
    launchError: null,
    responses,
    parseFailure: false,
    outputWithinLimit: true,
    timedOut: false,
    inputEofIssued: true,
    forcedTerminationIssued: false,
    processTreeTerminationAttempted: false,
    processTreeTerminationConfirmed: false,
    processTreeTerminationTriggerEvent: null,
    inputCloseTriggerEvent: null,
    joined: true,
    runtimeEventProtocolViolation: false,
    selectionEventObserved: true,
    selectionEvents,
    processStartEventObserved: true,
    processStartEvents,
    runtimeEvents,
    recoveryEvents: [],
    pidIssued: true,
    streamFailure: false,
    ...overrides,
  });
};
const unchangedSnapshot = {
  sha256: "same",
  headCommit: "a",
  headTree: "b",
  fileHashes: [{ relativePath: "result.txt", sha256: "before" }],
};
const changedSnapshot = {
  sha256: "after",
  headCommit: "a",
  headTree: "b",
  fileHashes: [{ relativePath: "result.txt", sha256: "after" }],
};
const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
const recoveryEvents: PublicProcessObservation["recoveryEvents"] =
  Object.freeze(
    [
      "required",
      "recovering",
      "settled",
      "acknowledged",
      "verification_resources_finalized",
      "queue_settled",
      "retry_ready",
    ].map((phase, index) =>
      Object.freeze({
        phase:
          phase as PublicProcessObservation["recoveryEvents"][number]["phase"],
        projectId: "project-a",
        milestoneId: "milestone-a",
        queueId: "queue-recovery",
        taskId: index < 5 ? "task-recovery" : null,
        operationId: index < 5 ? "OP-400001" : null,
        recoveryId: index < 5 ? recoveryId : null,
        stateGeneration: 10 + index,
      }),
    ),
  );
const normalRun = (
  responseId: string,
  executorProvider: "codex" | "claude",
  reviewerProvider: "codex" | "claude",
  adoptResult: boolean,
) => {
  const operationPrefix = responseId === "objective-1" ? "1" : "2";
  const selectionEvents: PublicProcessObservation["selectionEvents"] = [
    { taskRole: "executor", provider: executorProvider },
    { taskRole: "reviewer", provider: reviewerProvider },
  ];
  const processStartEvents: PublicProcessObservation["processStartEvents"] = [
    {
      taskRole: "executor",
      provider: executorProvider,
      operationId: `OP-${operationPrefix}00001`,
    },
    {
      taskRole: "reviewer",
      provider: reviewerProvider,
      operationId: `OP-${operationPrefix}00002`,
    },
  ];
  return {
    observation: observation([semantic("completed", responseId)], {
      selectionEvents,
      processStartEvents,
    }),
    expected: {
      responseId,
      requestId: "request-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      executorProvider,
      reviewerProvider,
    },
    snapshotBefore: unchangedSnapshot,
    snapshotAfter: adoptResult ? changedSnapshot : unchangedSnapshot,
    expectedChangedPaths: adoptResult ? ["result.txt"] : [],
    expectedCanonicalStateObserved: true,
  };
};
const recoverySettlementFixture = () => ({
  parentLoss: observation([], {
    exit: { code: 1, signal: null },
    inputEofIssued: false,
    forcedTerminationIssued: true,
    processTreeTerminationAttempted: true,
    processTreeTerminationConfirmed: true,
    processTreeTerminationTriggerEvent: {
      event: "process_started",
      taskRole: "executor",
      provider: "claude",
      operationId: "OP-400001",
    },
    selectionEvents: [{ taskRole: "executor", provider: "claude" }],
    processStartEvents: [
      {
        taskRole: "executor",
        provider: "claude",
        operationId: "OP-400001",
      },
    ],
  }),
  parentTerminationRequestedAfterProcessStart: true,
  reentry: observation(
    [
      semantic("completed", "objective-recovery-reentry", {
        queueId: "queue-recovery",
      }),
    ],
    {
      selectionEvents: [
        { taskRole: "executor", provider: "claude" },
        { taskRole: "reviewer", provider: "codex" },
      ],
      processStartEvents: [
        {
          taskRole: "executor",
          provider: "claude",
          operationId: "OP-500001",
        },
        {
          taskRole: "reviewer",
          provider: "codex",
          operationId: "OP-500002",
        },
      ],
      recoveryEvents,
    },
  ),
  expected: {
    responseId: "objective-recovery-reentry",
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    executorProvider: "claude" as const,
    reviewerProvider: "codex" as const,
  },
  snapshotBefore: unchangedSnapshot,
  snapshotAfter: unchangedSnapshot,
  expectedCanonicalStateObserved: true,
});
const buildInput = (overrides: Record<string, unknown> = {}) =>
  ({
    runId: "run",
    sourceIdentity: { commit: "a", tree: "b" },
    distributionIdentity: {
      crddCommit: "c",
      crddTree: "d",
      packageContentRootSha256: "e",
      runtimeExecutionIdentitySha256: "f",
    },
    normalRuns: [
      normalRun("objective-1", "codex", "claude", false),
      normalRun("objective-2", "claude", "codex", true),
    ],
    cancellation: observation(
      [semantic("cancelled", "objective-cancellation")],
      {
        selectionEvents: [{ taskRole: "executor", provider: "claude" }],
        processStartEvents: [
          {
            taskRole: "executor",
            provider: "claude",
            operationId: "OP-300001",
          },
        ],
        inputCloseTriggerEvent: {
          event: "process_started",
          taskRole: "executor",
          provider: "claude",
          operationId: "OP-300001",
        },
      },
    ),
    cancellationRequestedAfterProcessStart: true,
    cancellationExpected: {
      responseId: "objective-cancellation",
      requestId: "request-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      executorProvider: "claude",
    },
    cancellationSnapshotBefore: {
      sha256: "same",
      headCommit: "a",
      headTree: "b",
      fileHashes: [{ relativePath: "result.txt", sha256: "after" }],
    },
    cancellationSnapshotAfter: {
      sha256: "same",
      headCommit: "a",
      headTree: "b",
      fileHashes: [{ relativePath: "result.txt", sha256: "after" }],
    },
    recoverySettlement: recoverySettlementFixture(),
    dockerRecovery: {
      status: "completed",
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
    },
    ...overrides,
  }) as Parameters<typeof buildProjectRuntimeRealProviderReport>[0];
const build = (overrides: Record<string, unknown> = {}) =>
  buildProjectRuntimeRealProviderReport(buildInput(overrides));

test("全観測が相関した場合だけ公開Process E2Eをcompletedにする", () => {
  const result = build();
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.deepEqual(result.problems, []);
  assert.equal(result.publicMcpProcess.actualChildProcess, true);
  assert.equal(result.dockerRecoveryAfterRun.recoverySettlementExercised, true);
  assert.notDeepEqual(result.sourceIdentity, result.distributionIdentity);
});

test("全公開経路はchild未joinを個別にblockedへ閉じる", () => {
  const base = buildInput();
  const unjoined = (value: PublicProcessObservation) => ({
    ...value,
    joined: false,
  });
  const cases = [
    {
      problem: "normal_1_child_not_joined",
      overrides: {
        normalRuns: base.normalRuns.map((run, index) =>
          index === 0
            ? { ...run, observation: unjoined(run.observation) }
            : run,
        ),
      },
    },
    {
      problem: "normal_2_child_not_joined",
      overrides: {
        normalRuns: base.normalRuns.map((run, index) =>
          index === 1
            ? { ...run, observation: unjoined(run.observation) }
            : run,
        ),
      },
    },
    {
      problem: "cancellation_child_not_joined",
      overrides: { cancellation: unjoined(base.cancellation) },
    },
    {
      problem: "recovery_parent_not_joined",
      overrides: {
        recoverySettlement: {
          ...base.recoverySettlement,
          parentLoss: unjoined(base.recoverySettlement.parentLoss),
        },
      },
    },
    {
      problem: "recovery_reentry_child_not_joined",
      overrides: {
        recoverySettlement: {
          ...base.recoverySettlement,
          reentry: unjoined(base.recoverySettlement.reentry),
        },
      },
    },
  ];
  for (const item of cases) {
    const result = build(item.overrides);
    assert.equal(result.status, "blocked", item.problem);
    assert.ok(result.problems.includes(item.problem), item.problem);
  }
});

test("clean観測だけ、欠落・順序違反・Identity不一致を回復実行証明にしない", () => {
  const base = recoverySettlementFixture();
  const cases = [
    {
      recoverySettlement: {
        ...base,
        reentry: observation(
          [semantic("completed", "objective-recovery-reentry")],
          {
            selectionEvents: [
              { taskRole: "executor", provider: "claude" },
              { taskRole: "reviewer", provider: "codex" },
            ],
            processStartEvents: [
              {
                taskRole: "executor",
                provider: "claude",
                operationId: "OP-500001",
              },
              {
                taskRole: "reviewer",
                provider: "codex",
                operationId: "OP-500002",
              },
            ],
            recoveryEvents: [],
          },
        ),
      },
    },
    {
      recoverySettlement: {
        ...base,
        reentry: {
          ...base.reentry,
          recoveryEvents: recoveryEvents.map((event, index, events) =>
            index === 1
              ? (events.at(2) ?? event)
              : index === 2
                ? (events.at(1) ?? event)
                : event,
          ),
        },
      },
    },
    {
      recoverySettlement: {
        ...base,
        reentry: {
          ...base.reentry,
          recoveryEvents: recoveryEvents.map((event, index) =>
            index === 2 ? { ...event, operationId: "OP-999999" } : event,
          ),
        },
      },
    },
    {
      recoverySettlement: {
        ...base,
        reentry: {
          ...base.reentry,
          recoveryEvents: recoveryEvents.map((event, index) =>
            index === 0 ? { ...event, queueId: "queue-other" } : event,
          ),
        },
      },
    },
    {
      recoverySettlement: {
        ...base,
        reentry: {
          ...base.reentry,
          recoveryEvents: recoveryEvents.map((event, index) =>
            index === 3 ? { ...event, taskId: "task-other" } : event,
          ),
        },
      },
    },
    {
      recoverySettlement: {
        ...base,
        parentLoss: {
          ...base.parentLoss,
          processTreeTerminationTriggerEvent: {
            event: "process_started",
            taskRole: "executor",
            provider: "claude",
            operationId: "OP-499999",
          },
        },
      },
    },
    {
      recoverySettlement: {
        ...base,
        parentLoss: {
          ...base.parentLoss,
          forcedTerminationIssued: false,
        },
      },
    },
  ];
  for (const item of cases) {
    const result = build(item);
    assert.equal(result.status, "blocked");
    assert.equal(
      result.dockerRecoveryAfterRun.recoverySettlementExercised,
      false,
    );
  }
});

test("選定と実Process開始の統合順序違反およびrun間Operation再利用を拒否する", () => {
  const first = normalRun("objective-1", "codex", "claude", false);
  const wrongOrder = build({
    normalRuns: [
      {
        ...first,
        observation: observation([semantic("completed", "objective-1")], {
          runtimeEvents: [
            {
              event: "selection",
              taskRole: "executor",
              provider: "codex",
              operationId: null,
            },
            {
              event: "selection",
              taskRole: "reviewer",
              provider: "claude",
              operationId: null,
            },
            {
              event: "process_started",
              taskRole: "executor",
              provider: "codex",
              operationId: "OP-100001",
            },
            {
              event: "process_started",
              taskRole: "reviewer",
              provider: "claude",
              operationId: "OP-100002",
            },
          ],
        }),
      },
    ],
  });
  assert.equal(wrongOrder.status, "blocked");
  assert.ok(
    wrongOrder.problems.includes("normal_1_provider_selection_mismatch"),
  );

  const second = normalRun("objective-2", "claude", "codex", true);
  const reused = build({
    normalRuns: [
      first,
      {
        ...second,
        observation: observation([semantic("completed", "objective-2")], {
          selectionEvents: [
            { taskRole: "executor", provider: "claude" },
            { taskRole: "reviewer", provider: "codex" },
          ],
          processStartEvents: [
            {
              taskRole: "executor",
              provider: "claude",
              operationId: "OP-100001",
            },
            {
              taskRole: "reviewer",
              provider: "codex",
              operationId: "OP-200002",
            },
          ],
        }),
      },
    ],
  });
  assert.equal(reused.status, "blocked");
  assert.ok(reused.problems.includes("provider_operation_identity_reused"));
});

test("正常・準正常・異常の不一致をblocked結果へ閉じる", () => {
  const cases = [
    {
      normalRuns: [
        {
          ...normalRun("objective-1", "codex", "claude", false),
          observation: observation([], { parseFailure: true }),
        },
      ],
    },
    {
      normalRuns: [
        {
          ...normalRun("objective-1", "codex", "claude", false),
          observation: observation([semantic("completed", "objective-1")], {
            selectionEvents: [
              { taskRole: "executor", provider: "codex" },
              { taskRole: "reviewer", provider: "claude" },
              { taskRole: "executor", provider: "claude" },
            ],
          }),
        },
      ],
    },
    {
      normalRuns: [
        {
          ...normalRun("objective-1", "codex", "claude", false),
          observation: observation([semantic("completed", "objective-1")], {
            processStartEvents: [
              {
                taskRole: "executor",
                provider: "codex",
                operationId: "OP-SHARED",
              },
              {
                taskRole: "reviewer",
                provider: "claude",
                operationId: "OP-SHARED",
              },
            ],
          }),
        },
      ],
    },
    {
      cancellation: observation(
        [semantic("cancelled", "objective-cancellation")],
        {
          selectionEvents: [
            { taskRole: "executor", provider: "claude" },
            { taskRole: "reviewer", provider: "codex" },
          ],
          processStartEvents: [
            {
              taskRole: "executor",
              provider: "claude",
              operationId: "OP-CANCELLATION-EXECUTOR",
            },
            {
              taskRole: "reviewer",
              provider: "codex",
              operationId: "OP-CANCELLATION-REVIEWER",
            },
          ],
        },
      ),
    },
    { cancellationRequestedAfterProcessStart: false },
    {
      cancellation: observation(
        [semantic("cancelled", "objective-cancellation")],
        { processStartEventObserved: false, processStartEvents: [] },
      ),
    },
    {
      cancellation: observation(
        [semantic("cancelled", "objective-cancellation")],
        { inputEofIssued: false },
      ),
    },
    {
      cancellation: observation([
        semantic("cancelled", "objective-cancellation", {
          effectState: "no_effect",
        }),
      ]),
    },
    {
      cancellation: observation([
        semantic("cancelled", "objective-cancellation", {
          reason: "project_runtime_milestone_accepted",
        }),
      ]),
    },
    {
      normalRuns: [
        {
          ...normalRun("objective-1", "codex", "claude", false),
          observation: observation([semantic("completed", "objective-1")], {
            selectionEvents: [
              { taskRole: "executor", provider: "codex" },
              { taskRole: "reviewer", provider: "codex" },
            ],
          }),
        },
        {
          ...normalRun("objective-2", "claude", "codex", true),
          observation: observation([semantic("completed", "objective-2")], {
            selectionEvents: [
              { taskRole: "executor", provider: "claude" },
              { taskRole: "reviewer", provider: "claude" },
            ],
          }),
        },
      ],
    },
    {
      normalRuns: [
        {
          ...normalRun("objective-1", "codex", "claude", false),
          snapshotAfter: changedSnapshot,
        },
      ],
    },
    {
      cancellationSnapshotAfter: {
        sha256: "changed",
        headCommit: "a",
        headTree: "b",
        fileHashes: [{ relativePath: "result.txt", sha256: "changed" }],
      },
    },
    {
      dockerRecovery: {
        status: "blocked",
        reason: "unknown",
        manualRecoveryRequired: true,
      } as JsonRecord,
    },
  ];
  for (const item of cases) {
    const result = build(item);
    assert.equal(result.status, "blocked");
    assert.ok(result.problems.length > 0);
  }
});

test("固定子Processを実spawnし応答後EOFとjoinを観測する", async () => {
  const child = spawn(process.execPath, [fixture, "normal"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: 8192,
    timeoutMs: 2_000,
    terminationGraceMs: 100,
    closeInputWhen: ({ stdout }) => stdout.includes("\n"),
  });
  child.stdin.write('{"id":"objective-1"}\n');
  const result = await resultPromise;
  assert.equal(result.joined, true);
  assert.equal(result.inputEofIssued, true);
  assert.equal(result.selectionEventObserved, true);
  assert.equal(result.processStartEventObserved, true);
  assert.deepEqual(result.exit, { code: 0, signal: null });
});

function createSyntheticUnclosedChild(
  exitObserved: boolean,
  options: Readonly<{ emitStreamClose?: boolean }> = {},
) {
  let killCalls = 0;
  class ControlledUnclosedStream extends EventEmitter {
    destroyed = false;
    closed = false;

    end() {
      return this;
    }

    destroy() {
      this.destroyed = true;
      return this;
    }

    write(chunk: Buffer | string) {
      this.emit("data", Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    }
  }
  const createStream = () =>
    options.emitStreamClose === false
      ? new ControlledUnclosedStream()
      : new PassThrough();
  const child = Object.assign(new EventEmitter(), {
    pid: 612345,
    stdin: createStream(),
    stdout: createStream(),
    stderr: createStream(),
    exitCode: exitObserved ? 0 : null,
    signalCode: null,
    kill: () => {
      killCalls += 1;
      return true;
    },
  }) as unknown as ChildProcessWithoutNullStreams;
  return { child, killCalls: () => killCalls };
}

test("exit先着でclose未到達でも有限時間で未joinを返す", async () => {
  const fixture = createSyntheticUnclosedChild(true);
  const startedAt = Date.now();
  const result = await observePublicMcpProcess(fixture.child, {
    maximumOutputBytes: 1024,
    timeoutMs: 10,
    terminationGraceMs: 10,
  });
  assert.ok(Date.now() - startedAt < 500);
  assert.equal(result.joined, false);
  assert.equal(result.exit, null);
  assert.equal(result.processTreeTerminationConfirmed, false);
  assert.equal(fixture.killCalls(), 0);
  fixture.child.emit("error", new Error("late_child_error"));
  fixture.child.emit("close", 0, null);
  assert.equal(fixture.child.listenerCount("error"), 0);
  assert.equal(result.joined, false);
});

test("destroy済みclose未観測streamの遅延通知を実closeまで所有する", async () => {
  const fixture = createSyntheticUnclosedChild(true, {
    emitStreamClose: false,
  });
  const streams = [
    fixture.child.stdin,
    fixture.child.stdout,
    fixture.child.stderr,
  ] as const;
  const existingStreamListeners = streams.map(() => () => {});
  streams.forEach((stream, index) => {
    stream.on("error", existingStreamListeners[index] as () => void);
  });
  const existingChildListener = () => {};
  fixture.child.on("error", existingChildListener);
  const streamBaselines = streams.map((stream) =>
    stream.listenerCount("error"),
  );
  const childBaseline = fixture.child.listenerCount("error");

  const result = await observePublicMcpProcess(fixture.child, {
    maximumOutputBytes: 1024,
    timeoutMs: 10,
    terminationGraceMs: 10,
  });
  const frozenResult = JSON.stringify(result);
  for (const [index, stream] of streams.entries()) {
    assert.equal(stream.destroyed, true);
    assert.equal(stream.closed, false);
    assert.equal(
      stream.listenerCount("error"),
      (streamBaselines[index] ?? 0) + 1,
    );
    stream.emit("error", new Error(`late_stream_error_${index}_1`));
    stream.emit("error", new Error(`late_stream_error_${index}_2`));
    stream.emit("data", Buffer.from('{"late":"ignored"}\n'));
  }
  assert.equal(fixture.child.listenerCount("error"), childBaseline + 1);
  fixture.child.emit("error", new Error("late_child_error_1"));
  fixture.child.emit("error", new Error("late_child_error_2"));
  assert.equal(JSON.stringify(result), frozenResult);
  assert.deepEqual(result.responses, []);
  assert.deepEqual(result.runtimeEvents, []);

  streams.forEach((stream) => {
    stream.emit("close");
  });
  fixture.child.emit("close", 0, null);
  streams.forEach((stream, index) => {
    assert.equal(stream.listenerCount("error"), streamBaselines[index]);
  });
  assert.equal(fixture.child.listenerCount("error"), childBaseline);
});

test("timeout後のfallback killをProcess-tree終了確認へ昇格しない", async () => {
  const fixture = createSyntheticUnclosedChild(false);
  const result = await observePublicMcpProcess(fixture.child, {
    maximumOutputBytes: 1024,
    timeoutMs: 10,
    terminationGraceMs: 10,
  });
  assert.equal(fixture.killCalls(), 1);
  assert.equal(result.forcedTerminationIssued, true);
  assert.equal(result.joined, false);
  assert.equal(result.processTreeTerminationConfirmed, false);
  fixture.child.emit("close", null, "SIGTERM");
});

test("close観測後は保有timerを解除し遅延killや結果変更を起こさない", async () => {
  const fixture = createSyntheticUnclosedChild(false);
  const initialChildErrorListeners = fixture.child.listenerCount("error");
  const resultPromise = observePublicMcpProcess(fixture.child, {
    maximumOutputBytes: 1024,
    timeoutMs: 20,
    terminationGraceMs: 20,
  });
  fixture.child.emit("close", 0, null);
  const result = await resultPromise;
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(result.exit, { code: 0, signal: null });
  assert.equal(result.joined, true);
  assert.equal(result.timedOut, false);
  assert.equal(fixture.killCalls(), 0);
  assert.equal(
    fixture.child.listenerCount("error"),
    initialChildErrorListeners,
  );
});

test("helper永続pendingとchild close欠落が同時でも共通期限で未joinを返す", async () => {
  for (const pendingAt of ["started", "wait"] as const) {
    let resolvePending!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      resolvePending = resolve;
    });
    const fixture = createSyntheticUnclosedChild(false, {
      emitStreamClose: false,
    });
    const startedAt = Date.now();
    const resultPromise = observePublicMcpProcess(fixture.child, {
      maximumOutputBytes: 4096,
      timeoutMs: 20,
      terminationGraceMs: 20,
      onVerifiedRuntimeEvent: (event) =>
        event.event === "process_started"
          ? "terminate_process_tree"
          : "continue",
      startProcessTreeTermination: () =>
        Object.freeze({
          started: async () =>
            pendingAt === "started" ? (pending as Promise<boolean>) : true,
          wait: async () =>
            pendingAt === "wait"
              ? (pending as Promise<null>)
              : Object.freeze({
                  status: 0,
                  signal: null,
                  stdout: "",
                  stderr: "",
                  outputExceeded: false,
                }),
          terminateAndWait: async () => true,
          closed: () => true,
        }),
    });
    (fixture.child.stderr as PassThrough).write(
      `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: "claude", operationId: "OP-700001" })}\n`,
    );
    const result = await resultPromise;
    assert.ok(Date.now() - startedAt < 500, pendingAt);
    assert.equal(fixture.killCalls(), 1, pendingAt);
    assert.equal(result.joined, false, pendingAt);
    assert.equal(result.exit, null, pendingAt);
    assert.equal(result.processTreeTerminationConfirmed, false, pendingAt);
    const frozenResult = JSON.stringify(result);
    if (pendingAt === "started") resolvePending(true);
    else resolvePending(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(JSON.stringify(result), frozenResult, pendingAt);
    fixture.child.emit("close", 0, null);
  }
});

test("実子Process treeを開始通知後に強制終了して親喪失を観測する", async () => {
  const child = spawn(process.execPath, [fixture, "parent-loss"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: 1024,
    timeoutMs: 2_000,
    terminationGraceMs: 500,
    onVerifiedRuntimeEvent: (event) =>
      event.event === "process_started" &&
      event.taskRole === "executor" &&
      event.provider === "claude"
        ? "terminate_process_tree"
        : "continue",
    startProcessTreeTermination: () => {
      queueMicrotask(() => child.kill());
      return Object.freeze({
        started: async () => true,
        wait: async () =>
          Object.freeze({
            status: 0,
            signal: null,
            stdout: "",
            stderr: "",
            outputExceeded: false,
          }),
        terminateAndWait: async () => true,
        closed: () => true,
      });
    },
  });
  child.stdin.write('{"id":"objective-parent-loss"}\n');
  const result = await resultPromise;
  assert.equal(result.processStartEventObserved, true);
  assert.equal(result.forcedTerminationIssued, true);
  assert.equal(result.processTreeTerminationAttempted, true);
  assert.equal(result.inputEofIssued, false, JSON.stringify(result));
  assert.equal(result.joined, true);
  assert.notEqual(result.exit, null);
  assert.equal(result.exit?.code === 0 && result.exit.signal === null, false);
});

test("Process-tree helperの不成立形を終了確認へ昇格しない", async (t) => {
  const cases = [
    { name: "started_false", started: false, result: null, closed: false },
    { name: "wait_timeout", started: true, result: null, closed: false },
    {
      name: "nonzero",
      started: true,
      result: { status: 1, signal: null, outputExceeded: false },
      closed: true,
    },
    {
      name: "signal",
      started: true,
      result: { status: null, signal: "SIGTERM", outputExceeded: false },
      closed: true,
    },
    {
      name: "output_limit",
      started: true,
      result: { status: 0, signal: null, outputExceeded: true },
      closed: true,
    },
    {
      name: "close_unobserved",
      started: true,
      result: { status: 0, signal: null, outputExceeded: false },
      closed: false,
    },
  ] as const;
  for (const item of cases) {
    await t.test(item.name, async () => {
      const child = spawn(process.execPath, [fixture, "parent-loss"], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const resultPromise = observePublicMcpProcess(child, {
        maximumOutputBytes: 4096,
        timeoutMs: 2_000,
        terminationGraceMs: 100,
        onVerifiedRuntimeEvent: (event) =>
          event.event === "process_started" &&
          event.taskRole === "executor" &&
          event.provider === "claude"
            ? "terminate_process_tree"
            : "continue",
        startProcessTreeTermination: () =>
          Object.freeze({
            started: async () => {
              if (!item.started) queueMicrotask(() => child.kill());
              return item.started;
            },
            wait: async () => {
              queueMicrotask(() => child.kill());
              return item.result === null
                ? null
                : Object.freeze({
                    ...item.result,
                    stdout: "",
                    stderr: "",
                  });
            },
            terminateAndWait: async () => {
              queueMicrotask(() => child.kill());
              return true;
            },
            closed: () => item.closed,
          }),
      });
      child.stdin.write('{"id":"objective-parent-loss"}\n');
      const result = await resultPromise;
      assert.equal(result.joined, true);
      assert.equal(result.processTreeTerminationConfirmed, false);
    });
  }
});

test("固定prefix外の埋込みJSONをRuntime Eventへ昇格しない", async () => {
  const child = spawn(process.execPath, [fixture, "embedded-event"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: 4096,
    timeoutMs: 2_000,
    terminationGraceMs: 100,
    closeInputWhen: ({ stdout }) => stdout.includes("\n"),
  });
  child.stdin.write('{"id":"objective-1"}\n');
  const result = await resultPromise;
  assert.equal(result.joined, true);
  assert.equal(result.selectionEvents.length, 2);
  assert.equal(result.processStartEvents.length, 2);
  assert.equal(
    result.processStartEvents.some(
      (event) => event.operationId === "OP-UNTRUSTED",
    ),
    false,
  );
});

test("既知prefixの不正・未完了eventをProtocol違反にして操作を発行しない", async () => {
  for (const mode of [
    "malformed-known-prefix",
    "incomplete-known-prefix",
  ] as const) {
    const child = spawn(process.execPath, [fixture, mode], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let actionCalls = 0;
    const resultPromise = observePublicMcpProcess(child, {
      maximumOutputBytes: 8192,
      timeoutMs: 2_000,
      terminationGraceMs: 100,
      closeInputWhen: ({ stdout }) => stdout.includes("\n"),
      onVerifiedRuntimeEvent: () => {
        actionCalls += 1;
        return "close_input";
      },
    });
    child.stdin.write('{"id":"objective-1"}\n');
    const result = await resultPromise;
    assert.equal(result.runtimeEventProtocolViolation, true, mode);
    assert.equal(actionCalls, 0);
  }
});

test("分割chunkとCRLFから完全なeventだけを一度抽出する", async () => {
  const child = spawn(process.execPath, [fixture, "chunked-crlf"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const observed: string[] = [];
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: 8192,
    timeoutMs: 2_000,
    terminationGraceMs: 100,
    closeInputWhen: ({ stdout }) => stdout.includes("\n"),
    onVerifiedRuntimeEvent: (event) => {
      observed.push(event.event);
      return "continue";
    },
  });
  child.stdin.write('{"id":"objective-1"}\n');
  const result = await resultPromise;
  assert.equal(result.runtimeEventProtocolViolation, false);
  assert.deepEqual(observed, ["selection", "process_started"]);
  assert.equal(result.processStartEvents[0]?.operationId, "OP-600001");
});

test("役割またはProviderが違う開始通知では取消操作を発火しない", async () => {
  const child = spawn(process.execPath, [fixture, "normal"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: 8192,
    timeoutMs: 2_000,
    terminationGraceMs: 100,
    closeInputWhen: ({ stdout }) => stdout.includes("\n"),
    onVerifiedRuntimeEvent: (event) =>
      event.event === "process_started" &&
      event.taskRole === "reviewer" &&
      event.provider === "codex"
        ? "close_input"
        : "continue",
  });
  child.stdin.write('{"id":"objective-1"}\n');
  const result = await resultPromise;
  assert.equal(result.inputCloseTriggerEvent, null);
});

test("公開Processから回復遷移の閉じた順序とIdentityを抽出する", async () => {
  const child = spawn(process.execPath, [fixture, "recovery-events"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: 16 * 1024,
    timeoutMs: 2_000,
    terminationGraceMs: 100,
    closeInputWhen: ({ stdout }) => stdout.includes("\n"),
  });
  child.stdin.write('{"id":"objective-recovery"}\n');
  const result = await resultPromise;
  assert.deepEqual(
    result.recoveryEvents.map((event) => event.phase),
    [
      "required",
      "recovering",
      "settled",
      "acknowledged",
      "verification_resources_finalized",
      "queue_settled",
      "retry_ready",
    ],
  );
  assert.equal(
    new Set(
      result.recoveryEvents
        .map((event) => event.recoveryId)
        .filter((value) => value !== null),
    ).size,
    1,
  );
});

test("出力超過とEOF無視を成功へ変換せずchildをjoinする", async () => {
  for (const mode of ["overflow", "ignore-eof"] as const) {
    const child = spawn(process.execPath, [fixture, mode], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const resultPromise = observePublicMcpProcess(child, {
      maximumOutputBytes: mode === "overflow" ? 128 : 1024,
      timeoutMs: mode === "ignore-eof" ? 100 : 2_000,
      terminationGraceMs: 100,
      closeInputWhen: ({ stdout }) => stdout.includes("\n"),
    });
    child.stdin.write('{"id":"objective-1"}\n');
    const result = await resultPromise;
    assert.equal(result.joined, true);
    assert.equal(result.inputEofIssued, true);
    if (mode === "overflow") assert.equal(result.outputWithinLimit, false);
    else assert.equal(result.timedOut, true);
  }
});

async function runProbe(mode: string, id: string) {
  const child = spawn(process.execPath, [fixture, mode], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: mode === "overflow" ? 128 : 8192,
    timeoutMs: mode === "ignore-eof" ? 100 : 2_000,
    terminationGraceMs: 100,
    closeInputWhen: ({ stdout }) => stdout.includes("\n"),
    ...(mode === "cancelled"
      ? {
          onVerifiedRuntimeEvent: (event) =>
            event.event === "process_started" &&
            event.taskRole === "executor" &&
            event.provider === "claude"
              ? ("close_input" as const)
              : ("continue" as const),
        }
      : {}),
  });
  child.stdin.write(`${JSON.stringify({ id })}\n`);
  return resultPromise;
}

test("固定子Processの実観測を結果契約へ一続きで結合する", async () => {
  const cancellation = await runProbe("cancelled", "objective-cancellation");
  const normal = await runProbe("normal", "objective-1");
  const completed = build({
    normalRuns: [
      {
        ...normalRun("objective-1", "codex", "claude", true),
        observation: normal,
      },
    ],
    cancellation,
  });
  assert.equal(completed.status, "completed", JSON.stringify(completed));

  for (const mode of [
    "wrong-id",
    "malformed",
    "nonzero",
    "overflow",
    "ignore-eof",
  ]) {
    const observed = await runProbe(mode, "objective-1");
    const blocked = build({
      normalRuns: [
        {
          ...normalRun("objective-1", "codex", "claude", true),
          observation: observed,
        },
      ],
      cancellation,
    });
    assert.equal(blocked.status, "blocked", mode);
  }
});

test("stdin非同期失敗も観測結果へ閉じてchild終了を待つ", async () => {
  const child = spawn(process.execPath, [fixture, "normal"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const resultPromise = observePublicMcpProcess(child, {
    maximumOutputBytes: 1024,
    timeoutMs: 200,
    terminationGraceMs: 100,
  });
  child.stdin.destroy(new Error("injected_pipe_failure"));
  const result = await resultPromise;
  assert.equal(result.streamFailure, true);
  assert.equal(result.joined, true);
});
