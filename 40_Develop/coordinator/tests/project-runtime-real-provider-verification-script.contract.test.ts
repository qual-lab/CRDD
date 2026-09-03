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
const semantic = (status: "completed" | "cancelled", id: string) => ({
  jsonrpc: "2.0",
  id,
  result: {
    structuredContent: {
      status,
      reason: "project_runtime_milestone_accepted",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
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
    ...overrides,
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
    normal: observation([
      semantic("completed", "objective-1"),
      semantic("completed", "objective-2"),
    ]),
    cancellation: observation([
      semantic("cancelled", "objective-cancellation"),
    ]),
    cancellationRequestedAfterSelection: true,
    normalExpectedIds: ["objective-1", "objective-2"],
    cancellationExpectedId: "objective-cancellation",
    canonicalAdoptionObserved: true,
    cancellationSnapshotBefore: { sha256: "same" },
    cancellationSnapshotAfter: { sha256: "same" },
    dockerRecovery: {
      status: "completed",
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
    },
    ...overrides,
  } as Parameters<typeof buildProjectRuntimeRealProviderReport>[0]);

test("全観測が相関した場合だけ公開Process E2Eをcompletedにする", () => {
  const result = build();
  assert.equal(result.status, "completed");
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
      normal: observation([
        semantic("completed", "wrong"),
        semantic("completed", "objective-2"),
      ]),
    },
    { normal: observation([], { parseFailure: true }) },
    { normal: observation([], { outputWithinLimit: false }) },
    { normal: observation([], { timedOut: true }) },
    { normal: observation([], { joined: false, exit: null }) },
    { normal: observation([], { exit: { code: 7, signal: null } }) },
    { cancellationRequestedAfterSelection: false },
    {
      cancellation: observation(
        [semantic("cancelled", "objective-cancellation")],
        { inputEofIssued: false },
      ),
    },
    { cancellationSnapshotAfter: { sha256: "changed" } },
    { canonicalAdoptionObserved: false },
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
