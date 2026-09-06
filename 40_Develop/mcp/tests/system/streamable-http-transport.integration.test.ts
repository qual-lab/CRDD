import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  startMcpProjectRuntimeStreamableHttp,
  type McpProjectRuntimeDependencies,
} from "../../src/index.ts";

const token = "local-development-token-0123456789abcdef";
const revision = "a".repeat(40);
const meta = Object.freeze({
  "io.modelcontextprotocol/protocolVersion":
    MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
});

function dependencies(
  overrides: Partial<McpProjectRuntimeDependencies> = {},
): McpProjectRuntimeDependencies {
  return {
    authenticateClient: () => ({
      status: "verified",
      principalId: "principal-a",
    }),
    runObjective: async () => assert.fail("objective not expected"),
    submitDecision: async () => assert.fail("decision not expected"),
    getProjectState: async (request) => ({
      contract: "crdd-coordinator/project-runtime-state-query/v1",
      status: "completed",
      reason: "project_runtime_state_absent",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "absent",
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    }),
    ...overrides,
  };
}

function headers(method: string, name?: string) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
    "mcp-method": method,
    ...(name ? { "mcp-name": name } : {}),
  };
}

function sendRaw(
  url: URL,
  requestHeaders: Record<string, string>,
  body: Buffer,
) {
  return new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      url,
      { method: "POST", headers: requestHeaders },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode ?? 0));
      },
    );
    request.once("error", reject);
    request.end(body);
  });
}

function waitForListeningPort(child: ReturnType<typeof spawn>) {
  return new Promise<number>((resolve, reject) => {
    let stderr = "";
    const stderrStream = child.stderr;
    if (!stderrStream) {
      reject(new Error("crdd_mcp_http_stderr_unavailable"));
      return;
    }
    const timeout = setTimeout(
      () => reject(new Error(`crdd_mcp_http_start_timeout: ${stderr}`)),
      10_000,
    );
    stderrStream.on("data", (chunk) => {
      stderr += String(chunk);
      const match = stderr.match(
        /CRDD MCP is listening on http:\/\/127\.0\.0\.1:(\d+)\/mcp/u,
      );
      if (!match?.[1]) return;
      clearTimeout(timeout);
      resolve(Number(match[1]));
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(
        new Error(`crdd_mcp_http_exited_before_listen: ${code}: ${stderr}`),
      );
    });
  });
}

test("template toolsの公開入口はlocalhost HTTP discoveryへ到達する", async () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp.ts", import.meta.url),
  );
  const child = spawn(process.execPath, [entry, "--http", "--port", "0"], {
    cwd: path.dirname(entry),
    env: { ...process.env, CRDD_MCP_HTTP_BEARER_TOKEN: token },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  try {
    const port = await waitForListeningPort(child);
    const body = {
      jsonrpc: "2.0",
      id: "discover-http-process",
      method: "server/discover",
      params: { _meta: meta },
    };
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: headers(body.method),
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      id: string;
      result: { resultType: string };
    };
    assert.equal(result.id, "discover-http-process");
    assert.equal(result.result.resultType, "complete");
  } finally {
    if (child.exitCode === null) child.kill();
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
  }
});

test("localhost HTTPは認証済み状態参照を同じ公開契約へ搬送する", async () => {
  const server = await startMcpProjectRuntimeStreamableHttp(dependencies(), {
    port: 0,
    bearerToken: token,
  });
  try {
    const body = {
      jsonrpc: "2.0",
      id: "state-a",
      method: "tools/call",
      params: {
        _meta: meta,
        name: "crdd.get_project_state",
        arguments: {
          requestId: "query-a",
          projectId: "project-a",
          repositoryRevision: revision,
        },
      },
    };
    const response = await fetch(
      `http://${server.host}:${server.port}${server.endpoint}`,
      {
        method: "POST",
        headers: headers(body.method, body.params.name),
        body: JSON.stringify(body),
      },
    );
    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      result: {
        structuredContent: { observationState: string; effectState: string };
      };
    };
    assert.equal(result.result.structuredContent.observationState, "absent");
    assert.equal(result.result.structuredContent.effectState, "no_effect");
  } finally {
    assert.deepEqual(await server.close(), {
      status: "completed",
      cleanupConfirmed: true,
    });
  }
});

test("HTTPは認証・Origin・mirror header不一致をApplication前で拒否する", async () => {
  let effects = 0;
  const server = await startMcpProjectRuntimeStreamableHttp(
    dependencies({
      getProjectState: async () => {
        effects += 1;
      },
    }),
    { port: 0, bearerToken: token },
  );
  const url = `http://${server.host}:${server.port}${server.endpoint}`;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      _meta: meta,
      name: "crdd.get_project_state",
      arguments: {
        requestId: "query-a",
        projectId: "project-a",
        repositoryRevision: revision,
      },
    },
  };
  try {
    const unauthorized = await fetch(url, {
      method: "POST",
      headers: {
        ...headers(body.method, body.params.name),
        authorization: "Bearer invalid-invalid-invalid-invalid-invalid",
      },
      body: JSON.stringify(body),
    });
    assert.equal(unauthorized.status, 401);
    const origin = await fetch(url, {
      method: "POST",
      headers: {
        ...headers(body.method, body.params.name),
        origin: "https://example.invalid",
      },
      body: JSON.stringify(body),
    });
    assert.equal(origin.status, 403);
    const mismatch = await fetch(url, {
      method: "POST",
      headers: { ...headers(body.method, "crdd.run_objective") },
      body: JSON.stringify(body),
    });
    assert.equal(mismatch.status, 400);
    const get = await fetch(url, { method: "GET" });
    assert.equal(get.status, 405);
    assert.equal(effects, 0);
  } finally {
    await server.close();
  }
});

test("HTTPは不正UTF-8・重複key・容量超過を意味処理前に拒否する", async () => {
  let effects = 0;
  const server = await startMcpProjectRuntimeStreamableHttp(
    dependencies({
      getProjectState: async () => {
        effects += 1;
      },
    }),
    { port: 0, bearerToken: token },
  );
  const url = new URL(`http://${server.host}:${server.port}${server.endpoint}`);
  const requestHeaders = headers("tools/call", "crdd.get_project_state");
  try {
    assert.equal(
      await sendRaw(url, requestHeaders, Buffer.from([0xc3, 0x28])),
      400,
    );
    const duplicate = Buffer.from(
      `{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/call","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"${MCP_PROJECT_RUNTIME_PROTOCOL_VERSION}","io.modelcontextprotocol/clientCapabilities":{}},"name":"crdd.get_project_state","arguments":{}}}`,
      "utf8",
    );
    assert.equal(await sendRaw(url, requestHeaders, duplicate), 400);
    assert.equal(
      await sendRaw(url, requestHeaders, Buffer.alloc(128 * 1024 + 1, 0x20)),
      400,
    );
    assert.equal(effects, 0);
  } finally {
    await server.close();
  }
});

test("HTTP response切断は進行中Objectiveへ取消を伝播して終了時にjoinする", async () => {
  let cancellationObserved = false;
  let markStarted: (() => void) | null = null;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const server = await startMcpProjectRuntimeStreamableHttp(
    dependencies({
      runObjective: async (_request, signal) =>
        new Promise((resolve) => {
          markStarted?.();
          const cancel = () => {
            cancellationObserved = true;
            resolve({
              contract: "crdd-coordinator/project-runtime-objective-intake/v1",
              status: "cancelled",
              reason: "project_runtime_transport_disconnected",
              requestId: "objective-a",
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
    }),
    { port: 0, bearerToken: token },
  );
  const controller = new AbortController();
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      _meta: meta,
      name: "crdd.run_objective",
      arguments: {
        requestId: "objective-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: revision,
        objective: "Wait for disconnect.",
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
  const pending = fetch(
    `http://${server.host}:${server.port}${server.endpoint}`,
    {
      method: "POST",
      headers: headers(body.method, body.params.name),
      body: JSON.stringify(body),
      signal: controller.signal,
    },
  );
  await started;
  controller.abort();
  await assert.rejects(pending);
  await server.close();
  assert.equal(cancellationObserved, true);
});
