/**
 * 別ProcessでAM結果搬送の固定境界を反証する。
 * @responsibility AM公開Producerだけを差替え、MCP公開Resolverと結果投影を実行する。
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @level IT
 * @scope 合成保存結果の搬送。実AM保存・実HTTP成立の代替ではない。
 * @boundary 子Process内のModule差替えと公開Package API。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mock } from "node:test";
import * as actualAccess from "../../../access-management/src/index.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import type { McpResponse } from "../../src/index.ts";

const testBase = fileURLToPath(
  new URL("../../../../.crdd/tests/", import.meta.url),
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
let readResult: unknown;
let mutationResult: unknown;
const authentication = mock.fn(() => ({
  status: "completed",
  snapshot: { role: "manager" },
}));
const connection = mock.fn(() => ({ status: "normal" }));
const read = mock.fn(() => readResult);
const update = mock.fn(() => mutationResult);
const replacement = mock.module(
  new URL("../../../access-management/src/index.ts", import.meta.url).href,
  {
    namedExports: {
      ...actualAccess,
      resolveConnectionAuthentication: connection,
      authenticateNormalConnection: authentication,
      readManagementState: read,
      updateUserName: update,
    },
  },
);
try {
  // MCPをmock登録前にimportしてはいけない。未適用は呼出し数で必ず失敗する。
  const { createAccessMcpResolver, MCP_ORCHESTRATOR_PROTOCOL_VERSION } =
    await import("../../src/index.ts");
  const handler = await createAccessMcpResolver(root)("fixture-non-secret");
  assert.ok(handler);
  assert.equal(connection.mock.callCount(), 1);
  const operationId = "00000000-0000-4000-8000-000000000001";
  const userId = "00000000-0000-4000-8000-000000000002";
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "crdd.update_user_name",
      arguments: { operationId, expectedRevision: 7, userId, username: "test" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const mappings = [
    ["state_store_previous_pending_settled", "previous_materials_settled"],
    ["state_store_pending_failed", "previous_materials_unavailable"],
    ["state_store_capacity_exceeded", "capacity_exceeded"],
    ["state_store_identity_failed", "identity_generation_failed"],
    ["state_store_candidate_failed", "candidate_invalid"],
    ["state_store_repository_binding_failed", "repository_validation_failed"],
    ["state_store_prepare_failed", "prepare_failed"],
    ["state_store_publish_failed", "publication_failed"],
    ["state_store_read_back_failed", "readback_failed"],
    ["state_store_cleanup_failed", "cleanup_failed"],
    ["state_store_lock_unknown", "release_unknown"],
    [
      "filesystem_store_lock_operation_completed_cleanup_unknown",
      "release_unknown",
    ],
    ["fixture-private-reason", "storage_unavailable"],
    ["toString", "storage_unavailable"],
  ];
  for (const [primaryFailure, expected] of mappings) {
    mutationResult = {
      status: "unavailable",
      reason: "management_operation_unavailable",
      operationId,
      expectedRevision: 7,
      observedRevision: 8,
      publication: "confirmed",
      cleanupConfirmed: false,
      primaryFailure,
      secondaryFailure: "fixture-private-secondary",
      path: ownedRoot,
    };
    const response: McpResponse = await handler(
      request,
      new AbortController().signal,
    );
    assert.deepEqual(
      (response.result as { structuredContent: unknown }).structuredContent,
      {
        status: "unavailable",
        reason: "management_operation_unavailable",
        operationId,
        expectedRevision: 7,
        observedRevision: 8,
        publication: "confirmed",
        cleanupConfirmed: false,
        primaryFailure: expected,
      },
    );
    assert.equal((response.result as { isError: boolean }).isError, true);
  }
  assert.equal(update.mock.callCount(), mappings.length);
  mutationResult = {
    status: "unavailable",
    reason: "management_operation_rejected",
  };
  const rejected = await handler(request, new AbortController().signal);
  assert.deepEqual(
    (rejected.result as { structuredContent: unknown }).structuredContent,
    {
      status: "rejected",
      reason: "management_request_rejected",
    },
  );
  const readRequest = {
    ...request,
    params: {
      ...request.params,
      name: "crdd.list_access_users",
      arguments: {},
    },
  };
  for (const reason of [
    "management_state_read_rejected",
    "management_state_authentication_rejected",
    "fixture-private-read",
  ]) {
    readResult = { status: "unavailable", reason };
    const response = await handler(readRequest, new AbortController().signal);
    assert.deepEqual(
      (response.result as { structuredContent: unknown }).structuredContent,
      {
        status: "unavailable",
        reason:
          reason === "fixture-private-read"
            ? "management_read_unavailable"
            : "management_read_rejected",
      },
    );
  }
  assert.equal(read.mock.callCount(), 3);
  const cancelled = new AbortController();
  cancelled.abort();
  const beforeRead = read.mock.callCount();
  const beforeAuthentication = authentication.mock.callCount();
  assert.equal(
    (await handler(readRequest, cancelled.signal)).error?.code,
    -32800,
  );
  assert.equal(read.mock.callCount(), beforeRead);
  assert.equal(authentication.mock.callCount(), beforeAuthentication);

  // 合成Owner結果で最終JSON-RPCのUTF-8境界を検査する。AM容量成立の主張ではない。
  const users: { userId: string; username: string; role: string }[] = [];
  readResult = {
    status: "completed",
    snapshot: { kind: "users", revision: 8, users },
  };
  const empty = await handler(readRequest, new AbortController().signal);
  const limit = 16_777_216;
  const baseBytes = Buffer.byteLength(JSON.stringify(empty), "utf8");
  const example = { userId, username: "あ", role: "developer" };
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
  const exact = await handler(readRequest, new AbortController().signal);
  assert.equal(Buffer.byteLength(JSON.stringify(exact), "utf8"), limit);
  assert.equal((exact.result as { isError: boolean }).isError, false);
  last.username += "x";
  const over = await handler(readRequest, new AbortController().signal);
  assert.deepEqual(
    (over.result as { structuredContent: unknown }).structuredContent,
    {
      status: "unavailable",
      reason: "management_response_too_large",
    },
  );
  assert.equal((over.result as { isError: boolean }).isError, true);
  assert.ok(Buffer.byteLength(JSON.stringify(over), "utf8") < 1024);
  assert.equal(update.mock.callCount(), mappings.length + 1);
} finally {
  replacement.restore();
}
process.stdout.write("management-result-boundaries: verified\n");
