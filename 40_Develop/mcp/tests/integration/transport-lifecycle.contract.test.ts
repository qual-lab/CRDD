/**
 * mcp:integration:transport-lifecycleの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility mcp:integration:transport-lifecycleが所有する検証責務を実行する。
 * @trace EST-IT-001
 * @level IT
 * @scope mcp、transport、lifecycle、cancellation、cleanup
 * @boundary Direct Boundary: CLI／MCP Adapter→Application Contract
 */
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

/**
 * dependenciesのTest準備責務を実行する。
 *
 * @responsibility dependenciesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus dependenciesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: CLI／MCP Adapter→Application Contract
 */
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

/**
 * outputのTest準備責務を実行する。
 *
 * @responsibility outputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus outputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: CLI／MCP Adapter→Application Contract
 */
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

/**
 * stdio blockはparent EOFで進行要求を取消してjoin後に終了するを検証する。
 *
 * @responsibility stdio blockはparent EOFで進行要求を取消してjoin後に終了するの合否判定を所有する。
 * @trace EST-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus stdio blockはparent EOFで進行要求を取消してjoin後に終了するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: CLI／MCP Adapter→Application Contract
 */
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
          /**
           * cancelのTest準備責務を実行する。
           *
           * @responsibility cancelがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
           * @trace EST-IT-001
           * @precondition 呼出し元Test Caseが必要な入力を渡す。
           * @stimulus cancelを呼び出す。
           * @observation 返却値、生成fixtureまたは観測値を取得する。
           * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
           * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
           * @boundary Direct Boundary: CLI／MCP Adapter→Application Contract
           */
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

/**
 * HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否するを検証する。
 *
 * @responsibility HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否するの合否判定を所有する。
 * @trace EST-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus HTTP blockはidle接続とlistenerをcloseで回収し、再接続を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: CLI／MCP Adapter→Application Contract
 */
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
