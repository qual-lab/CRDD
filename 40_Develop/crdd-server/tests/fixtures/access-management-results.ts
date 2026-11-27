/**
 * 別ProcessでAM結果搬送の固定境界を反証する。
 * @responsibility AM公開Producerだけを差替え、MCP読取りとWorkbench管理保存の結果搬送を検証する。
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @level IT
 * @scope 合成保存結果の搬送。実AM保存・実HTTP成立の代替ではない。
 * @boundary 子Process内のModule差替えと公開Package API。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";
import * as actualAccess from "@qual-lab/crdd-access-management";
import { createFilesystemStoreRoot } from "../../../access-management/src/initialization/root.ts";
import type { McpResponse } from "../../src/transport/mcp-server.ts";
import { startManagementHttpFixture } from "../support/management-http.ts";

const testBase = fileURLToPath(
  new URL("../../../../.crdd/tests", import.meta.url),
);
const ownedRoot = process.argv[2];
const mode = process.argv[3];
assert.ok(ownedRoot && path.isAbsolute(ownedRoot));
assert.equal(path.dirname(ownedRoot), path.resolve(testBase));
assert.ok(path.basename(ownedRoot).startsWith("mcp-management-results-"));
assert.equal(fs.realpathSync.native(ownedRoot), ownedRoot);
const root = createFilesystemStoreRoot(ownedRoot);
assert.ok(root);
if (mode === "before-mock-failure")
  throw new Error("fixture_before_mock_failure");
if (mode === "timeout") {
  process.stdout.write("fixture-timeout-ready\n");
  await new Promise<void>(() => {
    setInterval(() => {}, 1000);
  });
}
assert.equal(mode, "normal");
let readResult: actualAccess.ManagementReadOutcome;
let mutationResult: actualAccess.ManagementOperationOutcome;
let currentResult: actualAccess.CurrentAccessOutcome;
const read = mock.fn(() => readResult);
const update = mock.fn(() => mutationResult);
const current = mock.fn(() => currentResult);
const replacement = mock.module(
  new URL(import.meta.resolve("@qual-lab/crdd-access-management")).href,
  {
    namedExports: {
      ...actualAccess,
      readManagementState: read,
      updateUserName: update,
      readCurrentAccess: current,
    },
  },
);
try {
  // MCPをmock登録前にimportしてはいけない。未適用は呼出し数で必ず失敗する。
  const {
    createOAuthMcpResolver,
    MCP_COORDINATOR_PROTOCOL_VERSION,
    MCP_CURRENT_ACCESS_TOOL,
  } = await import("../../src/transport/mcp-server.ts");
  const { invokeMcpSource } = await import("./sdk-request.ts");
  const operationId = "00000000-0000-4000-8000-000000000001";
  const userId = "00000000-0000-4000-8000-000000000002";
  currentResult = {
    status: "completed",
    revision: 7,
    user: { userId, username: "fixture", role: "manager" },
  };
  const handler = await createOAuthMcpResolver(root, async () => ({
    status: "completed",
    subject: `${userId}:${operationId}`,
    expiresAt: Date.now() + 60_000,
  }))("fixture-non-secret", new AbortController().signal);
  assert.ok(handler);
  assert.equal(current.mock.callCount(), 1);
  const http = await startManagementHttpFixture(
    root,
    {
      kind: "account",
      userId,
      bindingId: operationId,
      expiresAt: Date.now() + 60_000,
    },
    () => ({ status: "completed", account: { role: "manager" } }),
  );
  const submit = async (status: number) => {
    const response = await fetch(`${http.baseUrl}/api/users/${userId}`, {
      method: "PATCH",
      headers: {
        origin: http.baseUrl,
        cookie: http.cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        formToken: http.formToken,
        operationId,
        expectedRevision: 7,
        username: "test",
      }),
    });
    assert.equal(response.status, status);
    return response.json();
  };
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "crdd.update_user_name",
      arguments: { operationId, expectedRevision: 7, userId, username: "test" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  // 内部保存理由の投影はAMの責務。本fixtureは公開Producerの結果だけを搬送する。
  const failureReasons = [
    "previous_materials_settled",
    "previous_materials_unavailable",
    "identity_generation_failed",
    "candidate_invalid",
    "repository_validation_failed",
    "prepare_failed",
    "publication_failed",
    "readback_failed",
    "cleanup_failed",
    "release_unknown",
    "storage_unavailable",
  ];
  try {
    for (const primaryFailure of failureReasons) {
      mutationResult = {
        status: "unavailable",
        reason: "management_operation_unavailable",
        operationId,
        expectedRevision: 7,
        observedRevision: 8,
        publication: "confirmed",
        cleanupConfirmed: false,
        primaryFailure,
      };
      assert.deepEqual(await submit(503), {
        status: "unavailable",
        reason: "management_operation_unavailable",
        operationId,
        expectedRevision: 7,
        observedRevision: 8,
        publication: "confirmed",
        cleanupConfirmed: false,
        primaryFailure,
      });
    }
    assert.equal(update.mock.callCount(), failureReasons.length);
    mutationResult = {
      status: "rejected",
      reason: "management_request_rejected",
    };
    assert.deepEqual(await submit(403), mutationResult);
  } finally {
    await http.close();
  }
  const retired = await invokeMcpSource(
    handler,
    request,
    new AbortController().signal,
  );
  assert.equal(retired.error?.code, -32601);
  const readRequest = {
    ...request,
    params: {
      ...request.params,
      name: "crdd.list_access_users",
      arguments: {},
    },
  };
  for (const reason of [
    "management_read_rejected",
    "management_read_unavailable",
  ] as const) {
    readResult = { status: "unavailable", reason };
    const response: McpResponse = await invokeMcpSource(
      handler,
      readRequest,
      new AbortController().signal,
    );
    assert.deepEqual(
      (response.result as { structuredContent: unknown }).structuredContent,
      {
        status: "unavailable",
        reason,
      },
    );
  }
  assert.equal(read.mock.callCount(), 2);
  const cancelled = new AbortController();
  cancelled.abort();
  const beforeRead = read.mock.callCount();
  const beforeAuthentication = current.mock.callCount();
  assert.equal(
    (await invokeMcpSource(handler, readRequest, cancelled.signal)).error?.code,
    -32800,
  );
  assert.equal(read.mock.callCount(), beforeRead);
  assert.equal(current.mock.callCount(), beforeAuthentication);

  const currentRequest = {
    ...request,
    params: { ...request.params, name: MCP_CURRENT_ACCESS_TOOL, arguments: {} },
  };
  for (const role of ["developer", "manager", "administrator"] as const) {
    currentResult = {
      status: "completed",
      revision: 8,
      user: { userId, username: "本人", role },
    };
    const response: McpResponse = await invokeMcpSource(
      handler,
      currentRequest,
      new AbortController().signal,
    );
    assert.deepEqual(
      (response.result as { structuredContent: unknown }).structuredContent,
      {
        status: "completed",
        revision: 8,
        user: { userId, username: "本人", role },
      },
    );
  }
  for (const reason of [
    "current_access_authentication_rejected",
    "current_access_lock_unavailable",
    "current_access_cleanup_pending",
    "current_access_observation_unknown",
    "current_access_release_unknown",
  ] as const) {
    currentResult = { status: "unavailable", reason };
    const response: McpResponse = await invokeMcpSource(
      handler,
      currentRequest,
      new AbortController().signal,
    );
    assert.deepEqual(
      (response.result as { structuredContent: unknown }).structuredContent,
      { status: "unavailable", reason },
    );
  }
  assert.equal(current.mock.callCount(), 9);
  assert.equal(
    (await invokeMcpSource(handler, currentRequest, cancelled.signal)).error
      ?.code,
    -32800,
  );
  assert.equal(
    (
      await invokeMcpSource(
        handler,
        {
          ...currentRequest,
          params: { ...currentRequest.params, arguments: { userId } },
        },
        new AbortController().signal,
      )
    ).error?.code,
    -32602,
  );
  assert.equal(current.mock.callCount(), 9);

  // 合成Owner結果で最終JSON-RPCのUTF-8境界を検査する。AM容量成立の主張ではない。
  const users: { userId: string; username: string; role: "developer" }[] = [];
  readResult = {
    status: "completed",
    revision: 8,
    users,
  };
  const empty = await invokeMcpSource(
    handler,
    readRequest,
    new AbortController().signal,
  );
  const limit = 16_777_216;
  const baseBytes = Buffer.byteLength(JSON.stringify(empty), "utf8");
  const example = { userId, username: "あ", role: "developer" as const };
  const perUserBytes = Buffer.byteLength(JSON.stringify(example), "utf8") + 1;
  const count = Math.floor((limit - baseBytes + 1) / perUserBytes);
  for (let index = 0; index < count; index++) {
    users.push({
      ...example,
      userId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    });
  }
  const last = users.at(-1);
  assert.ok(last);
  last.username += "x".repeat(limit - (baseBytes + count * perUserBytes - 1));
  const exact = await invokeMcpSource(
    handler,
    readRequest,
    new AbortController().signal,
  );
  assert.equal(Buffer.byteLength(JSON.stringify(exact), "utf8"), limit);
  assert.equal((exact.result as { isError: boolean }).isError, false);
  last.username += "x";
  const over = await invokeMcpSource(
    handler,
    readRequest,
    new AbortController().signal,
  );
  assert.deepEqual(
    (over.result as { structuredContent: unknown }).structuredContent,
    readResult,
  );
  assert.equal((over.result as { isError: boolean }).isError, false);
  assert.equal(Buffer.byteLength(JSON.stringify(over), "utf8"), limit + 1);
  assert.equal(update.mock.callCount(), failureReasons.length + 1);
} finally {
  replacement.restore();
}
process.stdout.write("management-result-boundaries: verified\n");
