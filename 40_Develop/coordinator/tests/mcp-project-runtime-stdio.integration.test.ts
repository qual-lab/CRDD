import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Readable, Writable } from "node:stream";
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
