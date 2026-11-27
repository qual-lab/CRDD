/**
 * 退役したMCP初回接続の入口が旧資格で保存・公開しないことを検証する。
 * @packageDocumentation
 * @responsibility 正規形式の要求でも確認保存・Tool公開がないことを実HTTPで確認する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @level IT
 * @scope MCP Resolver・HTTP受付・旧形式の合成保存状態。
 * @boundary loopback HTTPと自己生成Store。公開Launcher／Workbench／Host TTYは未接続。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { createRetiredCredentialFixture } from "../../../access-management/tests/support/retired-credential.ts";
import { createFilesystemStoreRoot } from "../../../access-management/src/initialization/root.ts";
import {
  createOAuthMcpResolver,
  MCP_COORDINATOR_PROTOCOL_VERSION,
} from "../../src/transport/mcp-server.ts";
import { startMcpAuthenticatedStreamableHttp } from "../support/mcp-http-listener.ts";

/**
 * 実Hostと分離した提示確認済み初回資格を作る。
 * @responsibility 廃止済みの発行経路を呼ばず、過去形式の材料と対応する模擬鍵を試験内だけに作る。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 検証済みRepository-localな.crdd/tests。
 * @stimulus 旧User・資格を作り、提示済み状態を試験データとして固定する。
 * @observation 試験Rootと旧形式の保存・HTTP要求後のバイト列を確認する。
 * @oracle 生鍵非保存、Surfaceの実提示成功は主張しない。
 * @cleanup exact自己生成Rootをt.afterで削除し不存在を確認する。
 * @boundary 自己生成の旧状態 → 現行MCPの認証受付。
 */
function fixture(t: TestContext) {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(
    path.join(parent, "mcp-initial-connection-"),
  );
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  const attempt = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const { token, ...credential } = createRetiredCredentialFixture();
  const current = path.join(directory, "access-management.json");
  fs.writeFileSync(
    current,
    JSON.stringify({
      contract: "crdd-access-management/state",
      schemaRevision: 3,
      revision: 3,
      operationId: attempt,
      users: [{ userId, username: "模擬管理者", role: "administrator" }],
      credentials: [
        {
          ...credential,
          userId,
          tokenVersion: 1,
          revoked: false,
          operationId: attempt,
          presentation: "confirmed",
        },
      ],
      registeredRepositories: [],
      unresolvedKeyExchanges: [],
      initialization: {
        stage: "credential_stored",
        attemptId: attempt,
        userId,
        initialCredentialId: credential.credentialId,
        confirmationCredentialId: credential.credentialId,
      },
    }),
  );
  return { root, directory, current, token };
}

/**
 * 完全な非秘密discover入力を作る。
 * @responsibility 通常と初回で同じProtocol Envelopeを使う。
 * @trace RFD-IT-024
 * @precondition N/A: 固定メモリ値だけ。
 * @stimulus 固定ID・method・二つの必須metaを構成する。
 * @observation 呼出し側が応答と保存差分を確認する。
 * @oracle MCP固定Protocol値と閉params。
 * @cleanup N/A: 外部資源なし。
 * @boundary Protocol入力。
 */
function packet() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

/**
 * 現在の模擬鍵とProtocol相関をHTTP Headerへ渡す。
 * @responsibility Secretを本文へ混入させない。
 * @trace RFD-IT-024
 * @precondition 模擬短命鍵。
 * @stimulus 認証・Accept・Content-Type・method・versionを構成する。
 * @observation Transportの受理・拒否を呼出元が確認する。
 * @oracle 鍵はAuthorizationだけ。
 * @cleanup N/A: 要求内メモリだけ。
 * @boundary HTTP Header。
 */
function headers(token: string, method = "server/discover") {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
    "mcp-method": method,
  };
}

test("MCPは提示済みの旧初回資格でも接続確認や一覧の公開を行わない", async (t) => {
  const f = fixture(t);
  const resolver = createOAuthMcpResolver(f.root, async () => ({
    status: "rejected",
  }));
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}/mcp`;
  const before = fs.readFileSync(f.current);
  assert.equal(
    JSON.parse(before.toString()).initialization.stage,
    "credential_stored",
  );
  let publications = 0;
  const rename = fs.renameSync;
  const publication = t.mock.method(
    fs,
    "renameSync",
    (...[from, to]: Parameters<typeof rename>) => {
      if (String(to) === f.current) publications++;
      return rename(from, to);
    },
  );
  try {
    assert.equal(await resolver(f.token, new AbortController().signal), null);
    for (const method of ["server/discover", "tools/list"] as const) {
      const response = await fetch(base, {
        method: "POST",
        headers: headers(f.token, method),
        body: JSON.stringify({ ...packet(), method }),
      });
      assert.equal(response.status, 401);
      const body = await response.text();
      assert.equal(body.includes(f.token), false);
      assert.equal(body.includes(f.directory), false);
      assert.equal(Object.hasOwn(JSON.parse(body), "result"), false);
      assert.deepEqual(fs.readFileSync(f.current), before);
    }
  } finally {
    publication.mock.restore();
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
  assert.equal(publications, 0);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});
