import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { createConnection } from "node:net";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";

import {
  runMcpProjectRuntimeStdio,
  startMcpProjectRuntimeStreamableHttp,
  type McpProjectRuntimeDependencies,
} from "../../src/index.ts";

const TOKEN = "integration-boundary-token-0123456789abcdef";

function dependencies(
  overrides: Partial<McpProjectRuntimeDependencies> = {},
): McpProjectRuntimeDependencies {
  return {
    authenticateClient: () => ({
      status: "verified",
      principalId: "integration-principal",
    }),
    runObjective: async () => assert.fail("objective not expected"),
    submitDecision: async () => assert.fail("decision not expected"),
    getProjectState: async () => assert.fail("state query not expected"),
    ...overrides,
  };
}

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

test("stdio blockはparent EOFで進行要求を取消してjoin後に終了する", async () => {
  const input = new PassThrough();
  const sink = output();
  let wasCancelled = false;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const running = runMcpProjectRuntimeStdio(
    dependencies({
      runObjective: async (_request, signal) =>
        new Promise((resolve) => {
          markStarted();
          const cancel = () => {
            wasCancelled = true;
            resolve({
              contract: "crdd-coordinator/project-runtime-objective-intake/v1",
              status: "cancelled",
              reason: "project_runtime_parent_lost",
              requestId: "integration-request",
              projectId: "integration-project",
              milestoneId: "integration-milestone",
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
    }),
    input,
    sink.stream,
  );
  input.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: "integration-objective",
      method: "tools/call",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
        },
        name: "crdd.run_objective",
        arguments: {
          requestId: "integration-request",
          projectId: "integration-project",
          milestoneId: "integration-milestone",
          objective: "observe transport lifecycle",
          repositoryRevision: "a".repeat(40),
          acceptanceCriteria: ["Cancellation is observed."],
          allowedPaths: ["result.txt"],
          readPaths: ["README.md"],
          maximumConcurrency: 1,
          maximumReplans: 0,
          originLane: "interactive",
          adoptResult: false,
        },
      },
    })}\n`,
  );
  await started;
  input.end();
  const result = await running;
  assert.equal(wasCancelled, true);
  assert.equal(result.status, "completed");
  assert.match(sink.read(), /project_runtime_parent_lost/u);
});

test("HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否する", async () => {
  const server = await startMcpProjectRuntimeStreamableHttp(dependencies(), {
    port: 0,
    bearerToken: TOKEN,
  });
  const socket = createConnection({ host: server.host, port: server.port });
  const closed = new Promise<void>((resolve) => socket.once("close", resolve));
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  assert.deepEqual(await server.close(), {
    status: "completed",
    cleanupConfirmed: true,
  });
  await closed;
  assert.deepEqual(await server.close(), {
    status: "completed",
    cleanupConfirmed: true,
  });
  await assert.rejects(
    new Promise<void>((resolve, reject) => {
      const request = httpRequest(
        {
          host: server.host,
          port: server.port,
          path: server.endpoint,
          method: "POST",
        },
        () => resolve(),
      );
      request.once("error", reject);
      request.end();
    }),
  );
});
