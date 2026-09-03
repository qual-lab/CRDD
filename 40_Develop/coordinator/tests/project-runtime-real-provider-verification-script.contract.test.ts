import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildProjectRuntimeRealProviderReport,
  observePublicMcpProcess,
  type JsonRecord,
  type PublicProcessObservation,
} from "../scripts/project-runtime-real-provider-contract.ts";

const fixture = fileURLToPath(
  new URL("fixtures/project-runtime-public-process-probe.mjs", import.meta.url),
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
): PublicProcessObservation =>
  Object.freeze({
    exit: { code: 0, signal: null },
    launchError: null,
    responses,
    parseFailure: false,
    outputWithinLimit: true,
    timedOut: false,
    inputEofIssued: true,
    forcedTerminationIssued: false,
    joined: true,
    selectionEventObserved: true,
    selectionEvents: [
      { taskRole: "executor", provider: "codex" },
      { taskRole: "reviewer", provider: "claude" },
    ],
    processStartEventObserved: true,
    processStartEvents: [
      { taskRole: "executor", provider: "codex" },
      { taskRole: "reviewer", provider: "claude" },
    ],
    pidIssued: true,
    streamFailure: false,
    ...overrides,
  });
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
const normalRun = (
  responseId: string,
  executorProvider: "codex" | "claude",
  reviewerProvider: "codex" | "claude",
  adoptResult: boolean,
) => ({
  observation: observation([semantic("completed", responseId)], {
    selectionEvents: [
      { taskRole: "executor", provider: executorProvider },
      { taskRole: "reviewer", provider: reviewerProvider },
    ],
    processStartEvents: [
      { taskRole: "executor", provider: executorProvider },
      { taskRole: "reviewer", provider: reviewerProvider },
    ],
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
});
const build = (overrides: Record<string, unknown> = {}) =>
  buildProjectRuntimeRealProviderReport({
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
        processStartEvents: [{ taskRole: "executor", provider: "claude" }],
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
    dockerRecovery: {
      status: "completed",
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
    },
    ...overrides,
  } as Parameters<typeof buildProjectRuntimeRealProviderReport>[0]);

test("全観測が相関した場合だけ公開Process E2Eをcompletedにする", () => {
  const result = build();
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.deepEqual(result.problems, []);
  assert.equal(result.publicMcpProcess.actualChildProcess, true);
  assert.equal(
    result.dockerRecoveryAfterRun.recoverySettlementExercised,
    false,
  );
  assert.notDeepEqual(result.sourceIdentity, result.distributionIdentity);
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
    maximumOutputBytes: 1024,
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
