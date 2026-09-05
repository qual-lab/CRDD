import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runMcpProjectRuntimeStdio } from "../src/security/mcp-project-runtime-stdio.ts";

function output() {
  let content = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      content += String(chunk);
      callback();
    },
  });
  return { stream, read: () => content };
}

test("stdio process transports one bounded MCP request and closes on parent EOF", async () => {
  const sink = output();
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const result = await runMcpProjectRuntimeStdio(
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "principal-a",
      }),
      runObjective: async () => assert.fail("objective not expected"),
      submitDecision: async () => assert.fail("decision not expected"),
    },
    Readable.from([`${JSON.stringify(request)}\n`]),
    sink.stream,
  );
  assert.equal(result.status, "completed");
  const response = JSON.parse(sink.read());
  assert.equal(response.id, 1);
  assert.equal(response.result.resultType, "complete");
});

test("stdio process rejects trailing and oversized frames without semantic effects", async () => {
  let effects = 0;
  const dependencies = {
    authenticateClient: () => ({
      status: "verified",
      principalId: "principal-a",
    }),
    runObjective: async () => {
      effects += 1;
    },
    submitDecision: async () => {
      effects += 1;
    },
  };
  const trailing = await runMcpProjectRuntimeStdio(
    dependencies,
    Readable.from(["{}"]),
    output().stream,
  );
  const oversized = await runMcpProjectRuntimeStdio(
    dependencies,
    Readable.from(["x".repeat(128 * 1024 + 1)]),
    output().stream,
  );
  assert.equal(trailing.status, "blocked");
  assert.equal(oversized.status, "blocked");
  assert.equal(effects, 0);
});

test("coordinator binary exposes the bounded MCP stdio process", () => {
  const entry = fileURLToPath(
    new URL("../bin/coordinator.ts", import.meta.url),
  );
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: "discover-1",
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  });
  const result = spawnSync(process.execPath, [entry, "mcp", "--stdio"], {
    cwd: path.dirname(entry),
    input: `${request}\n`,
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.id, "discover-1");
  assert.equal(response.result.resultType, "complete");
});

test("parent EOF aborts and joins an active semantic request before stdio closes", async () => {
  const input = new PassThrough();
  const sink = output();
  let cancellationObserved = false;
  const running = runMcpProjectRuntimeStdio(
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "principal-a",
      }),
      runObjective: async (_request, signal) =>
        new Promise((resolve) => {
          const cancel = () => {
            cancellationObserved = true;
            resolve({
              contract: "crdd-coordinator/project-runtime-objective-intake/v1",
              status: "cancelled",
              reason: "project_runtime_parent_lost",
              requestId: "request-parent-loss",
              projectId: "project-a",
              milestoneId: "milestone-a",
              queueId: null,
              projection: null,
              cleanupConfirmed: true,
              manualRecoveryRequired: false,
              processRestartRequired: false,
              recoveryIds: [],
              recoveryObligations: [],
              effectState: "settled",
            });
          };
          if (signal.aborted) cancel();
          else signal.addEventListener("abort", cancel, { once: true });
        }),
      submitDecision: async () => assert.fail("decision not expected"),
    },
    input,
    sink.stream,
  );
  const objectiveRequest = {
    jsonrpc: "2.0",
    id: "objective-parent-loss",
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      name: "crdd.run_objective",
      arguments: {
        requestId: "request-parent-loss",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: "a".repeat(40),
        objective: "Run until the parent disconnects.",
        acceptanceCriteria: ["Cancellation is observed."],
        allowedPaths: ["result.txt"],
        readPaths: ["README.md"],
        maximumConcurrency: 1,
        maximumReplans: 0,
        originLane: "interactive",
        adoptResult: false,
      },
    },
  };
  input.end(`${JSON.stringify(objectiveRequest)}\n`);
  const result = await running;
  assert.equal(result.status, "completed");
  assert.equal(cancellationObserved, true);
  assert.equal(
    JSON.parse(sink.read()).result.structuredContent.status,
    "cancelled",
  );
});

test("stdio preserves semantic cleanup uncertainty after transport cleanup", async () => {
  const sink = output();
  const objectiveRequest = {
    jsonrpc: "2.0",
    id: "objective-recovery",
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      name: "crdd.run_objective",
      arguments: {
        requestId: "request-recovery",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: "a".repeat(40),
        objective: "Observe cleanup uncertainty.",
        acceptanceCriteria: ["Recovery remains visible."],
        allowedPaths: ["result.txt"],
        readPaths: ["README.md"],
        maximumConcurrency: 1,
        maximumReplans: 0,
        originLane: "interactive",
        adoptResult: false,
      },
    },
  };
  const result = await runMcpProjectRuntimeStdio(
    {
      authenticateClient: () => ({
        status: "verified",
        principalId: "principal-a",
      }),
      runObjective: async () => ({
        contract: "crdd-coordinator/project-runtime-public-runtime/v1",
        status: "blocked",
        reason: "project_runtime_task_recovery_required",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown",
      }),
      submitDecision: async () => assert.fail("decision not expected"),
    },
    Readable.from([`${JSON.stringify(objectiveRequest)}\n`]),
    sink.stream,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.transportCleanupConfirmed, true);
  assert.equal(result.semanticResultObserved, true);
  assert.equal(result.semanticCleanupConfirmed, false);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
});
