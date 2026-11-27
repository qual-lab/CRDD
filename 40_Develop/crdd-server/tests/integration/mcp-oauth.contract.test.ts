/**
 * 組込み発行側と、標準の照会を使うMCP検証側を実HTTPで結合する。
 * @trace ARCH-000012
 * @level IT
 * @scope GoogleおよびWorkbenchの本人確認画面は合成。発行・交換・照会・失効は実ライブラリ。
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { request as requestHttp } from "node:http";
import test from "node:test";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import * as oidc from "openid-client";
import { createGitHostLinks } from "../../src/service/git-host.ts";
import { createApiServer } from "../../src/transport/api-http.ts";
import {
  clientLoginPaths,
  clientSessionPaths,
  createClientSessionHandler,
} from "../../src/transport/api-session.ts";
import { createMcpHttpRequestHandler } from "../../src/transport/mcp-http.ts";
import {
  createMcpOAuthEndpoint,
  createMcpOAuthInteraction,
  createMcpOAuthProvider,
  createMcpOAuthStore,
  createMcpResourceMetadata,
  createMcpIntrospection,
  createMcpTokenObserver,
  isMcpBrowserReturnPath,
  mcpScope,
  verifyMcpBearer,
} from "../../src/transport/mcp-oauth.ts";
import { createMcpServerFactory } from "../../src/transport/mcp-server.ts";
import { MCP_COORDINATOR_PROTOCOL_VERSION } from "../../src/transport/mcp-protocol.ts";
import { readMcpAccountSubject } from "../../src/transport/mcp-types.ts";

test("SDKのBearer受付は拒否を分類し、認証済み主体だけをToolへ渡す", async (t) => {
  const transport = createApiServer();
  const { server } = transport;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => transport.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const resource = new URL(`http://127.0.0.1:${address.port}/mcp`);
  const { metadata } = createMcpResourceMetadata(
    resource,
    new URL(resource.origin),
  );
  let inspected = 0;
  const observed: unknown[] = [];
  const handler = createMcpHttpRequestHandler(
    {
      admit: () => true,
      factory: {
        async createServer(_request, _signal, _observe, auth) {
          assert.ok(auth);
          const sdk = new McpServer({ name: "fixture", version: "1.0.0" });
          sdk.registerTool(
            "fixture.subject",
            {
              inputSchema: fromJsonSchema({
                type: "object",
                additionalProperties: false,
              }),
            },
            (_input, context) => {
              observed.push(context.http?.authInfo?.extra?.subject);
              return { content: [{ type: "text" as const, text: "accepted" }] };
            },
          );
          return sdk.server;
        },
      },
      authenticate: (header, signal) =>
        verifyMcpBearer(
          header,
          resource,
          async (token) => {
            inspected++;
            return {
              token,
              clientId: "fixture",
              resource:
                token === "wrong-target"
                  ? new URL("/mcp/other", resource)
                  : resource,
              scopes: token === "wrong-scope" ? [] : [mcpScope],
              expiresAt:
                Math.floor(Date.now() / 1000) + (token === "expired" ? -1 : 60),
              extra: { subject: token },
            };
          },
          signal,
          metadata.href,
        ),
    },
    { resourceMetadataUrl: metadata, requiredScopes: [mcpScope] },
  );
  server.on("request", transport.handleRequest(handler.handle));
  const headers = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
    "mcp-method": "tools/call",
    "mcp-name": "fixture.subject",
  };
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "fixture.subject",
      arguments: {},
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  });
  const call = (authorization?: string) =>
    fetch(resource, {
      method: "POST",
      headers: { ...headers, ...(authorization && { authorization }) },
      body,
    });
  for (const [authorization, status, error] of [
    [undefined, 401, "invalid_token"],
    ["Bearer bad extra", 401, "invalid_token"],
    ["Bearer expired", 401, "invalid_token"],
    ["Bearer wrong-target", 401, "invalid_token"],
    ["Bearer wrong-scope", 403, "insufficient_scope"],
  ] as const) {
    const rejected = await call(authorization);
    assert.equal(rejected.status, status);
    const challenge = rejected.headers.get("www-authenticate") ?? "";
    assert.ok(challenge.includes(`error="${error}"`));
    assert.ok(challenge.includes(`resource_metadata="${metadata.href}"`));
    assert.equal((await rejected.json()).error, error);
  }
  const duplicate = await new Promise<{
    status: number | undefined;
    challenge: string | undefined;
  }>((resolve, reject) => {
    const request = requestHttp(
      resource,
      {
        method: "POST",
        headers: [
          ...Object.entries(headers).flat(),
          "Host",
          resource.host,
          "Authorization",
          "Bearer first",
          "Authorization",
          "Bearer second",
        ],
      },
      (response) => {
        response.resume();
        response.once("end", () =>
          resolve({
            status: response.statusCode,
            challenge: response.headers["www-authenticate"],
          }),
        );
      },
    );
    request.once("error", reject);
    request.end(body);
  });
  assert.equal(duplicate.status, 401);
  assert.ok(duplicate.challenge);
  assert.ok(duplicate.challenge.includes('error="invalid_token"'));
  assert.ok(
    duplicate.challenge.includes(`resource_metadata="${metadata.href}"`),
  );
  assert.equal(inspected, 3);
  assert.deepEqual(observed, []);
  const replies = await Promise.all([
    call("Bearer subject-a"),
    call("Bearer subject-b"),
  ]);
  for (const reply of replies) {
    assert.equal(reply.status, 200);
    assert.deepEqual((await reply.json()).result.content, [
      { type: "text", text: "accepted" },
    ]);
  }
  assert.deepEqual(observed.sort(), ["subject-a", "subject-b"]);
  assert.equal(inspected, 5);
  for (const [method, expectedStatus, expectedAllow, authorized] of [
    ["PUT", 405, "POST", true],
    ["TRACE", 405, "POST", true],
    ["POST", 401, undefined, false],
    ["POST", 415, undefined, true],
  ] as const) {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = requestHttp(
        resource,
        {
          method,
          headers: {
            ...headers,
            ...(authorized && { authorization: "Bearer subject-a" }),
            "content-type": "text/plain",
            "content-length": "32",
          },
        },
        (response) => {
          try {
            assert.equal(response.headers.allow, expectedAllow);
            response.resume();
            response.once("end", () => {
              resolve(response.statusCode);
              request.destroy();
            });
          } catch (error) {
            request.destroy();
            reject(error);
          }
        },
      );
      request.once("error", reject);
      request.setTimeout(2_000, () =>
        request.destroy(new Error("SDK waited for an unusable body")),
      );
      request.flushHeaders();
    });
    assert.equal(status, expectedStatus);
  }
  assert.deepEqual(observed.sort(), ["subject-a", "subject-b"]);
  assert.equal(inspected, 6);
});

test("OAuth状態はプロセスをまたがず、再利用と期限切れを拒否する", async (t) => {
  const state = createMcpOAuthStore();
  const code = state("AuthorizationCode");
  const token = state("AccessToken");
  await code.upsert("same-id", { grantId: "grant" }, 90);
  await token.upsert("same-id", { grantId: "grant" }, 300);
  assert.equal(
    await createMcpOAuthStore()("AuthorizationCode").find("same-id"),
    undefined,
  );
  await code.consume("same-id");
  await assert.rejects(code.consume("same-id"), /already_consumed/u);
  await code.upsert("same-id", { grantId: "grant" }, 90);
  await assert.rejects(code.consume("same-id"), /already_consumed/u);
  await token.revokeByGrantId("grant");
  assert.equal(await token.find("same-id"), undefined);
  assert.ok(await code.find("same-id"));
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 91_000);
  assert.equal(await code.find("same-id"), undefined);
  await assert.rejects(code.upsert("too-long", {}, 1801), /lifetime_invalid/u);
});

test("MCP発行側は重複を拒否し、容量上限で既存の認可状態を追い出さない", async () => {
  const state = createMcpOAuthStore();
  const replay = state("ReplayDetection");
  await replay.upsert("same-id", {}, 90);
  await assert.rejects(replay.upsert("same-id", {}, 90), /mcp_oauth_replay/u);
  const code = state("AuthorizationCode");
  await assert.rejects(
    code.upsert("too-large", { uid: "u".repeat(32 * 1024) }, 90),
    /mcp_oauth_state_record_limit/u,
  );
  for (let index = 0; index < 2047; index++)
    await code.upsert(String(index), {}, 90);
  await assert.rejects(
    code.upsert("overflow", {}, 90),
    /mcp_oauth_state_capacity/u,
  );
  assert.deepEqual(await replay.find("same-id"), {});
  assert.deepEqual(await code.find("0"), {});
});

test("認可途中の枠を使い切っても、発行済み状態と次の正規受付を保つ", async () => {
  const state = createMcpOAuthStore();
  const pending = state("Interaction");
  const session = state("Session");
  const code = state("AuthorizationCode");
  const token = state("AccessToken");
  const accountId =
    "00000000-0000-4000-8000-000000000011:00000000-0000-4000-8000-000000000013";
  await session.upsert("anonymous-first", {}, 60);
  await session.upsert("pre-consent", { accountId }, 60);
  await state("Grant").upsert(
    "approved",
    { accountId, clientId: "client" },
    60,
  );
  const approvedSession = {
    accountId,
    authorizations: { client: { grantId: "approved" } },
  };
  await session.upsert("retained", approvedSession, 60);
  await token.upsert("issued", { accountId }, 60);
  for (let index = 0; index < 256; index++)
    await pending.upsert(String(index), { uid: String(index) }, 60);
  assert.equal(await session.find("anonymous-first"), undefined);
  assert.equal(await session.find("pre-consent"), undefined);
  assert.ok(await pending.find("255"));
  await state.runRequest(async () => {
    assert.ok(await pending.find("0"));
    // 別要求で更新枠が回り、先に取得していた操作を再作成できないことを確認する。
    await state.runRequest(() => pending.upsert("next", { uid: "next" }, 60));
    await assert.rejects(
      pending.upsert("0", { uid: "0" }, 60),
      /interaction_unavailable/u,
    );
  });
  assert.equal(await pending.find("0"), undefined);
  assert.ok(await pending.findByUid("next"));
  await session.upsert("accepted", approvedSession, 60);
  await code.upsert("accepted", { accountId }, 60);
  assert.ok(await session.find("retained"));
  assert.ok(await token.find("issued"));
  assert.ok(await code.find("accepted"));
  await pending.upsert("identified", { session: { accountId } }, 60);
  state.invalidateUser(accountId.split(":")[0] ?? "");
  assert.equal(await session.find("retained"), undefined);
  assert.equal(await pending.find("identified"), undefined);
});

test("発行記録は同じ利用者だけで上限を適用し、別の利用者と同意を保持する", async () => {
  const state = createMcpOAuthStore();
  const first = "00000000-0000-4000-8000-000000000011";
  const other = "00000000-0000-4000-8000-000000000012";
  const binding = "00000000-0000-4000-8000-000000000013";
  const subject = `${first}:${binding}`;
  const secondSubject = `${other}:${binding}`;
  const grant = state("Grant");
  const code = state("AuthorizationCode");
  const token = state("AccessToken");
  await grant.upsert("first", { accountId: subject }, 60);
  await grant.upsert("other", { accountId: secondSubject }, 60);
  await token.upsert(
    "other-token",
    { grantId: "other", accountId: secondSubject },
    60,
  );
  await code.upsert("old-code", { grantId: "first" }, 60);
  await code.consume("old-code");
  await token.upsert("old-token", { grantId: "first", accountId: subject }, 60);
  for (let index = 0; index < 100; index++)
    await token.upsert(
      `token-${index}`,
      { grantId: "first", accountId: subject },
      60,
    );
  assert.equal(await code.find("old-code"), undefined);
  await assert.rejects(code.consume("old-code"), /already_consumed/u);
  assert.equal(state.hasCurrentToken("old-token", subject), false);
  assert.equal(state.hasCurrentToken("token-99", subject), true);
  assert.equal(state.hasCurrentToken("other-token", secondSubject), true);
  assert.ok(await grant.find("first"));
  await assert.rejects(
    token.upsert("other-token", { grantId: "other", accountId: subject }, 60),
    /state_owner_invalid/u,
  );
  for (let index = 0; index < 31; index++)
    await grant.upsert(`grant-${index}`, { accountId: subject }, 60);
  await assert.rejects(
    grant.upsert("too-many", { accountId: subject }, 60),
    /state_owner_capacity/u,
  );
  await code.upsert(
    "other-code",
    { grantId: "other", accountId: secondSubject },
    60,
  );
  assert.ok(await code.find("other-code"));
});

test("入替済み・期限切れの途中セッションは同じ要求から保存し直せない", async (t) => {
  const state = createMcpOAuthStore();
  const session = state("Session");
  const interaction = state("Interaction");
  await state.runRequest(async () => {
    const observed = { uid: "held-uid" };
    await session.upsert("held", observed, 60);
    await state.runRequest(async () => {
      for (let index = 0; index < 256; index++)
        await interaction.upsert(String(index), {}, 60);
    });
    await assert.rejects(
      session.upsert("held", observed, 60),
      /interaction_unavailable/u,
    );
    await session.destroy("held");
    await assert.rejects(
      session.upsert("other-id", observed, 60),
      /interaction_unavailable/u,
    );
  });
  await state.runRequest(async () => {
    const current = { uid: "fresh-uid" };
    await session.upsert("before-rotation", current, 60);
    await session.destroy("before-rotation");
    await session.upsert("after-rotation", current, 60);
    assert.ok(await session.findByUid(current.uid));
  });
  await state.runRequest(async () => {
    const current = { uid: "expiring-uid" };
    await session.upsert("expiring", current, 1);
    const now = Date.now();
    const clock = t.mock.method(Date, "now", () => now + 2_000);
    try {
      await assert.rejects(
        session.upsert("new-id-after-expiry", current, 60),
        /interaction_unavailable/u,
      );
    } finally {
      clock.mock.restore();
    }
  });
});

test("ログアウトは本人の認可状態と処理中の古い書込みだけを無効にする", async () => {
  const state = createMcpOAuthStore();
  const first = "00000000-0000-4000-8000-000000000011";
  const other = "00000000-0000-4000-8000-000000000012";
  const binding = "00000000-0000-4000-8000-000000000013";
  const subject = `${first}:${binding}`;
  const otherSubject = `${other}:${binding}`;
  const grant = state("Grant");
  const token = state("AccessToken");
  const session = state("Session");
  const interaction = state("Interaction");
  await grant.upsert("first", { accountId: subject }, 60);
  await grant.upsert("other", { accountId: otherSubject }, 60);
  await token.upsert("first", { grantId: "first" }, 60);
  await token.upsert("other", { grantId: "other" }, 60);
  await session.upsert("first", { accountId: subject }, 60);
  await session.upsert("other", { accountId: otherSubject }, 60);
  await interaction.upsert("first", { session: { accountId: subject } }, 60);
  await interaction.upsert(
    "other",
    { session: { accountId: otherSubject } },
    60,
  );
  let readGrant!: () => void;
  let releaseWrites!: () => void;
  const waiting = new Promise<void>((resolve) => {
    readGrant = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseWrites = resolve;
  });
  const pending = state.runRequest(async () => {
    assert.ok(await grant.find("first"));
    readGrant();
    await release;
    await assert.rejects(
      token.upsert("late", { grantId: "first" }, 60),
      /mcp_oauth_account_logged_out/u,
    );
    await assert.rejects(
      session.upsert("late", { accountId: subject }, 60),
      /mcp_oauth_account_logged_out/u,
    );
    assert.ok(await grant.find("other"));
  });
  await Promise.race([waiting, pending]);
  try {
    state.invalidateUser(first);
    for (const records of [grant, token, session, interaction]) {
      assert.equal(await records.find("first"), undefined);
      assert.ok(await records.find("other"));
    }
  } finally {
    releaseWrites();
    await pending;
  }
  assert.equal(await token.find("late"), undefined);
  assert.equal(await session.find("late"), undefined);
  await state.runRequest(async () => {
    assert.equal(state.observeSubject(subject), true);
    await grant.upsert("new-consent", { accountId: subject }, 60);
  });
  assert.ok(await grant.find("new-consent"));
});

test("入口の照合は有効なトークンと同意を要求する", async (t) => {
  const state = createMcpOAuthStore();
  const user = "00000000-0000-4000-8000-000000000011";
  const binding = "00000000-0000-4000-8000-000000000013";
  const subject = `${user}:${binding}`;
  const now = Date.now();
  await state("Grant").upsert("consent", { accountId: subject }, 60);
  await state("Grant").upsert("other-consent", { accountId: subject }, 60);
  const references = new Map([["github.com", "first-reference"]]);
  assert.equal(state.bindGrantHosts("consent", subject, references), true);
  references.set("github.com", "second-reference");
  assert.equal(state.bindGrantHosts("consent", subject, references), false);
  assert.equal(
    state.bindGrantHosts("other-consent", subject, references),
    true,
  );
  assert.deepEqual(await state("Grant").find("consent"), {
    accountId: subject,
  });
  await state("AccessToken").upsert(
    "other-token",
    { accountId: subject, grantId: "other-consent" },
    60,
  );
  await state("AccessToken").upsert(
    "token",
    { accountId: subject, grantId: "consent" },
    1,
  );
  assert.equal(state.hasCurrentToken("token", `${binding}:${user}`), false);
  assert.equal(state.hasCurrentToken("token", subject), true);
  assert.equal(
    state.readGrantHostReference("token", subject, "github.com"),
    "first-reference",
  );
  assert.equal(
    state.readGrantHostReference("other-token", subject, "github.com"),
    "second-reference",
  );
  t.mock.method(Date, "now", () => now + 2_000);
  assert.equal(await state("AccessToken").find("token"), undefined);
  assert.equal(state.hasCurrentToken("token", subject), false);
  assert.equal(
    state.readGrantHostReference("token", subject, "github.com"),
    null,
  );
  assert.equal(
    state.readGrantHostReference("other-token", subject, "github.com"),
    "second-reference",
  );
  state.invalidateUser(user);
  assert.equal(
    state.readGrantHostReference("other-token", subject, "github.com"),
    null,
  );
});

test("MCP同意は同じGitアカウントの更新を引き継ぎ、別アカウントへは移らない", async (t) => {
  const state = createMcpOAuthStore();
  const host = "github.com";
  const links = createGitHostLinks(() =>
    state.collectGrantHostReferences(host),
  );
  t.after(links.close);
  const owner = {
    userId: "00000000-0000-4000-8000-000000000011",
    bindingId: "00000000-0000-4000-8000-000000000013",
  };
  const subject = `${owner.userId}:${owner.bindingId}`;
  const now = Date.now();
  const link = {
    accountId: "29",
    accessToken: "first",
    expiresAt: now + 60_000,
  };
  const first = links.save(owner, link);
  assert.ok(first);
  await state("Grant").upsert("consent", { accountId: subject }, 60);
  assert.ok(state.bindGrantHosts("consent", subject, new Map([[host, first]])));
  await state("AccessToken").upsert(
    "mcp-token",
    { accountId: subject, grantId: "consent" },
    30,
  );
  assert.deepEqual(state.collectGrantHostReferences(host), new Set([first]));
  assert.deepEqual(
    state.collectGrantHostReferences("other.example"),
    new Set(),
  );
  const running = links.open(first, owner);
  assert.ok(running);
  t.after(running.close);
  assert.equal(links.save(owner, { ...link, accessToken: "updated" }), first);
  const other = links.save(owner, {
    ...link,
    accountId: "30",
    accessToken: "other",
  });
  assert.ok(other);
  assert.notEqual(other, first);
  const bound = state.readGrantHostReference("mcp-token", subject, host);
  assert.equal(bound, first);
  assert.equal(links.read(bound, owner), "updated");
  links.disconnect(first, owner);
  assert.equal(links.read(bound, owner), null);
  assert.equal(running.revocationSignal.aborted, true);
  assert.notEqual(links.save(owner, { ...link, accessToken: "new" }), bound);
  t.mock.method(Date, "now", () => now + 60_001);
  assert.deepEqual(state.collectGrantHostReferences(host), new Set());
});

test("MCP専用のOAuthコードを交換し、失効とWorkbenchのログアウトで再利用できなくなる", async (t) => {
  const transport = createApiServer();
  const { server } = transport;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => transport.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const issuer = new URL(`http://127.0.0.1:${address.port}`);
  const resource = new URL("/mcp", issuer);
  const callback = new URL("http://127.0.0.1:17071/callback");
  const verifierAccount = {
    id: "synthetic-introspector",
    secret: "fixture-verifier-secret".repeat(3),
  };
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const metadata = createMcpResourceMetadata(resource, issuer);
  assert.equal(
    metadata.metadata.pathname,
    "/.well-known/oauth-protected-resource/mcp",
  );
  assert.deepEqual(metadata.document, {
    resource: resource.href,
    authorization_servers: [issuer.href],
    scopes_supported: [mcpScope],
    bearer_methods_supported: ["header"],
  });
  const shared = new URL("https://mcp.example.test/mcp");
  const sharedIssuer = new URL("https://login.example.test/");
  const publicMetadata = createMcpResourceMetadata(shared, sharedIssuer);
  assert.equal(
    publicMetadata.metadata.href,
    "https://mcp.example.test/.well-known/oauth-protected-resource/mcp",
  );
  assert.deepEqual(publicMetadata.document, {
    ...metadata.document,
    resource: shared.href,
    authorization_servers: [sharedIssuer.href],
  });
  for (const invalid of [
    new URL("http://mcp.example.test/mcp"),
    new URL("http://localhost/mcp"),
    new URL("https://mcp.example.test/not-mcp"),
    new URL("https://mcp.example.test/mcp#invalid"),
  ]) {
    assert.throws(
      () => createMcpResourceMetadata(invalid, sharedIssuer),
      /mcp_oauth_configuration_invalid/u,
    );
  }
  const providerOptions = {
    issuer,
    resource,
    clients: [{ id: "mcp-fixture", redirects: [callback.href] }],
    verifier: verifierAccount,
    jwks: {
      keys: [
        { ...privateKey.export({ format: "jwk" }), alg: "RS256", use: "sig" },
      ],
    },
    cookieKeys: ["fixture-only-cookie-signing-secret".repeat(2)],
  };
  const oauthState = createMcpOAuthStore();
  const provider = createMcpOAuthProvider(providerOptions, oauthState);
  const account = {
    userId: "00000000-0000-4000-8000-000000000021",
    bindingId: "00000000-0000-4000-8000-000000000022",
    username: "<合成ユーザー>",
    role: "developer" as const,
  };
  let starts = 0;
  let confirmed = false;
  let resume = "/";
  const cookieBinding = "b".repeat(43);
  const googlePaths = clientLoginPaths("google");
  const browser = createClientSessionHandler(
    issuer,
    {
      google: {
        async start(returnTo) {
          starts++;
          resume = returnTo;
          const location = new URL(googlePaths.callback, issuer);
          location.searchParams.set("code", "synthetic");
          return { location, browserBinding: cookieBinding };
        },
        async complete(search, binding) {
          if (
            binding !== cookieBinding ||
            search.get("code") !== "synthetic" ||
            confirmed
          )
            return null;
          confirmed = true;
          return {
            identity: {
              issuer: "https://accounts.google.com",
              subject: "synthetic-user",
            },
            returnTo: resume,
          };
        },
      },
    },
    () => ({ status: "completed", account }),
    undefined,
    undefined,
    oauthState.invalidateUser,
    undefined,
    undefined,
    isMcpBrowserReturnPath,
  );
  const gitHostReference = "00000000-0000-4000-8000-000000000023";
  const otherHostReference = "00000000-0000-4000-8000-000000000024";
  const linkedHosts = new Map([
    ["github.com", gitHostReference],
    ["git.example.test", otherHostReference],
  ]);
  const endpoint = createMcpOAuthEndpoint(
    provider,
    resource,
    createMcpOAuthInteraction(
      provider,
      resource,
      browser,
      [{ id: "google", displayName: "Google" }],
      () => new Map(linkedHosts),
      oauthState,
    ),
    oauthState,
  );
  let introspect:
    | Awaited<ReturnType<typeof createMcpIntrospection>>
    | undefined;
  const mcp = createMcpHttpRequestHandler(
    {
      admit: (auth) => {
        const subject = auth.extra?.subject;
        return (
          typeof subject === "string" &&
          readMcpAccountSubject(subject)?.userId === account.userId
        );
      },
      factory: createMcpServerFactory({}),
      authenticate: (header, signal) =>
        verifyMcpBearer(
          header,
          resource,
          (token, current) => {
            assert.ok(introspect);
            return introspect(token, current);
          },
          signal,
          endpoint.metadata.href,
        ),
    },
    { resourceMetadataUrl: endpoint.metadata, requiredScopes: [mcpScope] },
  );
  const handleOAuth = transport.handleRequest(endpoint.handle);
  let activeOAuth = handleOAuth;
  const handleMcp = transport.handleRequest(mcp.handle);
  const handleBrowser = transport.handleRequest(browser.handle);
  server.on("request", (request, response) => {
    if (request.url === mcp.endpoint) return handleMcp(request, response);
    if (endpoint.matches(request.url)) return activeOAuth(request, response);
    if (
      request.url?.split("?", 1)[0] === googlePaths.callback ||
      request.url === googlePaths.login ||
      request.url === clientSessionPaths.session
    )
      return handleBrowser(request, response);
    response.statusCode = 404;
    response.end();
  });
  const callMcp = (token?: string, browserCookie?: string) =>
    fetch(resource, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-method": "tools/list",
        "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(browserCookie ? { cookie: browserCookie } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion":
              MCP_COORDINATOR_PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    });
  const challenge = await callMcp();
  assert.equal(challenge.status, 401);
  assert.ok(
    challenge.headers
      .get("www-authenticate")
      ?.includes(`resource_metadata="${endpoint.metadata.href}"`),
  );
  const advertised = await fetch(endpoint.metadata);
  assert.equal(advertised.status, 200);
  assert.deepEqual(await advertised.json(), metadata.document);
  assert.equal(
    (
      await fetch(endpoint.metadata, {
        headers: { origin: "https://other.example" },
      })
    ).status,
    421,
  );
  assert.equal(
    (await fetch(endpoint.metadata, { method: "POST" })).status,
    405,
  );
  assert.equal((await fetch(new URL("/oauth/unknown", issuer))).status, 404);
  const configuration = await oidc.discovery(
    issuer,
    "mcp-fixture",
    undefined,
    oidc.None(),
    { execute: [oidc.allowInsecureRequests] },
  );
  introspect = await createMcpIntrospection({
    issuer,
    resource,
    clientId: verifierAccount.id,
    clientSecret: verifierAccount.secret,
  });
  const verifier = createMcpTokenObserver(resource, introspect);
  const unissuedToken = "unissued-oauth-token-fixture";
  const unauthorized = await callMcp(unissuedToken);
  assert.equal(unauthorized.status, 401);
  const rejected = await unauthorized.text();
  assert.equal(rejected.includes(unissuedToken), false);
  assert.equal(Object.hasOwn(JSON.parse(rejected), "result"), false);
  const signal = new AbortController().signal;
  const pkce = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(pkce);
  const parameters = {
    response_type: "code",
    redirect_uri: callback.href,
    scope: mcpScope,
    resource: resource.href,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  };
  const wrong = await fetch(
    oidc.buildAuthorizationUrl(configuration, {
      ...parameters,
      resource: new URL("/different", issuer).href,
    }),
    { redirect: "manual" },
  );
  const wrongLocation = wrong.headers.get("location");
  assert.ok(wrongLocation);
  assert.equal(
    new URL(wrongLocation).searchParams.get("error"),
    "invalid_target",
  );
  assert.equal(starts, 0);
  const cookies = new Map<string, string>();
  const storeCookies = (response: Response) => {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";", 1)[0];
      if (!pair) continue;
      const name = pair.split("=")[0] ?? "";
      if (/(?:^|;\s*)max-age=0(?:;|$)/iu.test(header)) cookies.delete(name);
      else cookies.set(name, pair);
    }
  };
  let consent = 0;
  let challengedChangedLinks = false;
  const visit = async (start: URL, decision: "allow" | "deny") => {
    const visited: string[] = [];
    let next = start;
    for (let hop = 0; hop < 15 && next.origin === issuer.origin; hop++) {
      visited.push(next.pathname);
      const headers = { cookie: [...cookies.values()].join("; ") };
      let response = await fetch(next, {
        redirect: "manual",
        headers,
      });
      if (response.status === 200) {
        const page = await response.text();
        const action = page.includes("Googleでログイン")
          ? "login:google"
          : decision;
        const body = new URLSearchParams({ action });
        if (action === "login:google") {
          const before = starts;
          const unlisted = await fetch(next, {
            method: "POST",
            redirect: "manual",
            headers: { ...headers, origin: issuer.origin },
            body: new URLSearchParams({ action: "login:unconfigured" }),
          });
          assert.equal(unlisted.status, 400);
          assert.equal(starts, before);
        } else {
          const sent = /name="confirmation" value="([A-Za-z0-9_-]{43})"/u.exec(
            page,
          )?.[1];
          assert.ok(sent);
          body.set("confirmation", sent);
          consent++;
          assert.match(page, /&lt;合成ユーザー&gt;/u);
          assert.match(page, /mcp-fixture/u);
          assert.match(page, /内容の閲覧・変更や実行の操作/u);
          assert.match(
            page,
            /管理情報は権限がある場合に閲覧できますが、MCPから変更はできません/u,
          );
          assert.match(page, /閲覧・変更にGitホスト側の権限も必要/u);
          assert.ok(!page.includes(gitHostReference));
          assert.ok(!page.includes(otherHostReference));
          const crossOrigin = await fetch(next, {
            method: "POST",
            redirect: "manual",
            headers: { ...headers, origin: "https://other.example" },
            body,
          });
          assert.equal(crossOrigin.status, 421);
          if (decision === "allow" && !challengedChangedLinks) {
            challengedChangedLinks = true;
            linkedHosts.delete("git.example.test");
            const changed = await fetch(next, {
              method: "POST",
              redirect: "manual",
              headers: { ...headers, origin: issuer.origin },
              body,
            });
            assert.equal(changed.status, 403);
            assert.equal(changed.headers.has("location"), false);
            linkedHosts.set("git.example.test", otherHostReference);
            const reloaded = await fetch(next, { redirect: "manual", headers });
            assert.equal(reloaded.status, 200);
            const current =
              /name="confirmation" value="([A-Za-z0-9_-]{43})"/u.exec(
                await reloaded.text(),
              )?.[1];
            assert.ok(current && current !== sent);
            const stale = await fetch(next, {
              method: "POST",
              redirect: "manual",
              headers: { ...headers, origin: issuer.origin },
              body,
            });
            assert.equal(stale.status, 403);
            assert.equal(stale.headers.has("location"), false);
            body.set("confirmation", current);
          }
        }
        response = await fetch(next, {
          method: "POST",
          redirect: "manual",
          headers: { ...headers, origin: issuer.origin },
          body,
        });
      }
      storeCookies(response);
      const location = response.headers.get("location");
      assert.ok(location, `expected redirect, got ${response.status}`);
      next = new URL(location, issuer);
    }
    assert.equal(next.origin, callback.origin, visited.join(" → "));
    return next;
  };
  const next = await visit(
    oidc.buildAuthorizationUrl(configuration, parameters),
    "allow",
  );
  assert.equal(next.searchParams.get("error"), null);
  assert.equal(starts, 1);
  assert.equal(consent, 1);
  const tokens = await oidc.authorizationCodeGrant(
    configuration,
    next,
    { expectedState: state, pkceCodeVerifier: pkce },
    { resource: resource.href },
  );
  assert.ok(tokens.access_token);
  assert.equal(tokens.refresh_token, undefined);
  const accepted = await verifier(tokens.access_token, signal);
  assert.equal(
    accepted.status === "completed" && accepted.subject,
    `${account.userId}:${account.bindingId}`,
  );
  assert.deepEqual(await verifier("unknown-token", signal), {
    status: "rejected",
  });
  const browserOnly = await callMcp(
    undefined,
    [...cookies.values()].join("; "),
  );
  assert.equal(
    browserOnly.status,
    401,
    "ブラウザーのCookieはMCPの接続資格ではない",
  );
  const discovered = await callMcp(tokens.access_token);
  assert.equal(discovered.status, 200);
  assert.ok(Array.isArray((await discovered.json()).result.tools));
  const sdk = new Client(
    { name: "crdd-oauth-fixture", version: "1" },
    { versionNegotiation: { mode: { pin: MCP_COORDINATOR_PROTOCOL_VERSION } } },
  );
  try {
    await sdk.connect(
      new StreamableHTTPClientTransport(resource, {
        authProvider: { token: async () => tokens.access_token },
      }),
    );
    assert.deepEqual((await sdk.listTools()).tools, []);
  } finally {
    await sdk.close();
  }
  const liveClaims = {
    active: true,
    iss: issuer.href,
    aud: resource.href,
    token_type: "Bearer",
    scope: mcpScope,
    exp: Math.floor(Date.now() / 1_000) + 60,
    sub: `${account.userId}:${account.bindingId}`,
    client_id: "mcp-fixture",
  };
  for (const [claims, expectedStatus] of [
    [{ ...liveClaims, iss: "https://wrong.example.test/" }, 401],
    [{ ...liveClaims, aud: [resource.href, resource.href] }, 401],
    [{ ...liveClaims, aud: `${resource.href}/` }, 401],
    [{ ...liveClaims, aud: `${resource.href}/other` }, 401],
    [{ ...liveClaims, scope: "other:access" }, 403],
  ] as const) {
    activeOAuth = (request, response) => {
      if (request.url !== "/oauth/introspect") {
        handleOAuth(request, response);
        return;
      }
      request.resume();
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(claims));
    };
    try {
      const refused = await callMcp(tokens.access_token);
      assert.equal(refused.status, expectedStatus);
      assert.ok(
        refused.headers
          .get("www-authenticate")
          ?.includes(`resource_metadata="${endpoint.metadata.href}"`),
      );
      assert.equal(
        (await refused.json()).error,
        expectedStatus === 403 ? "insufficient_scope" : "invalid_token",
      );
    } finally {
      activeOAuth = handleOAuth;
    }
  }
  const freshProvider = createMcpOAuthProvider(providerOptions);
  activeOAuth = transport.handleRequest(
    createMcpOAuthEndpoint(
      freshProvider,
      resource,
      createMcpOAuthInteraction(freshProvider, resource, browser, [
        { id: "google", displayName: "Google" },
      ]),
    ).handle,
  );
  try {
    assert.deepEqual(await verifier(tokens.access_token, signal), {
      status: "rejected",
    });
  } finally {
    activeOAuth = handleOAuth;
  }
  assert.equal(
    (await verifier(tokens.access_token, signal)).status,
    "completed",
  );
  const subject = `${account.userId}:${account.bindingId}`;
  assert.equal(oauthState.hasCurrentToken(tokens.access_token, subject), true);
  assert.equal(readMcpAccountSubject(`${subject}:${gitHostReference}`), null);
  assert.equal(
    oauthState.readGrantHostReference(
      tokens.access_token,
      subject,
      "github.com",
    ),
    gitHostReference,
  );
  assert.equal(
    oauthState.readGrantHostReference(
      tokens.access_token,
      subject,
      "git.example.test",
    ),
    otherHostReference,
  );
  assert.equal(
    oauthState.readGrantHostReference(
      tokens.access_token,
      subject,
      "unlinked.example.test",
    ),
    null,
  );
  assert.equal(
    oauthState.readGrantHostReference(
      tokens.access_token,
      `${account.bindingId}:${account.userId}`,
      "github.com",
    ),
    null,
  );
  await oidc.tokenRevocation(configuration, tokens.access_token);
  assert.deepEqual(await verifier(tokens.access_token, signal), {
    status: "rejected",
  });
  const revoked = await callMcp(tokens.access_token);
  assert.equal(oauthState.hasCurrentToken(tokens.access_token, subject), false);
  assert.equal(
    oauthState.readGrantHostReference(
      tokens.access_token,
      subject,
      "github.com",
    ),
    null,
  );
  assert.equal(revoked.status, 401);
  const revokedChallenge = revoked.headers.get("www-authenticate") ?? "";
  assert.match(revokedChallenge, /error="invalid_token"/u);
  assert.ok(
    revokedChallenge.includes(`resource_metadata="${endpoint.metadata.href}"`),
  );
  const denied = await visit(
    oidc.buildAuthorizationUrl(configuration, {
      ...parameters,
      code_challenge: await oidc.calculatePKCECodeChallenge(
        oidc.randomPKCECodeVerifier(),
      ),
      state: oidc.randomState(),
    }),
    "deny",
  );
  assert.equal(starts, 1, "同じブラウザーの既存ログインを使う");
  assert.equal(consent, 2, "本人確認済みでもMCPへの許可は必要");
  assert.equal(denied.searchParams.get("error"), "access_denied");
  assert.equal(denied.searchParams.has("code"), false);

  const reauthorize = oidc.buildAuthorizationUrl(configuration, {
    ...parameters,
    prompt: "consent",
  });
  const approved = await visit(reauthorize, "allow");
  const beforeLogout = await oidc.authorizationCodeGrant(
    configuration,
    approved,
    { expectedState: state, pkceCodeVerifier: pkce },
    { resource: resource.href },
  );
  assert.equal((await callMcp(beforeLogout.access_token)).status, 200);
  const pendingCode = await visit(reauthorize, "allow");
  assert.ok(pendingCode.searchParams.get("code"));
  const browserCookie = [...cookies.values()].join("; ");
  const logout = await fetch(new URL(clientSessionPaths.session, issuer), {
    method: "DELETE",
    headers: { cookie: browserCookie, origin: issuer.origin },
  });
  assert.equal(logout.status, 204);
  assert.equal((await callMcp(beforeLogout.access_token)).status, 401);
  await assert.rejects(
    oidc.authorizationCodeGrant(
      configuration,
      pendingCode,
      { expectedState: state, pkceCodeVerifier: pkce },
      { resource: resource.href },
    ),
  );
  // 古い認可サーバーCookieも残して、接続先にコードが戻らないことを確認する。
  const afterLogout = await fetch(
    oidc.buildAuthorizationUrl(configuration, parameters),
    {
      headers: { cookie: browserCookie },
      redirect: "manual",
    },
  );
  const interaction = afterLogout.headers.get("location");
  assert.ok(interaction);
  const interactionUrl = new URL(interaction, issuer);
  assert.equal(interactionUrl.origin, issuer.origin);
  assert.match(interactionUrl.pathname, /^\/api\/session\/mcp\//u);
  storeCookies(afterLogout);
  const loginPage = await fetch(interactionUrl, {
    redirect: "manual",
    headers: { cookie: [...cookies.values()].join("; ") },
  });
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Googleでログイン/u);
});
