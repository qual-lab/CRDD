/**
 * 組込み発行側と、標準の照会を使うMCP検証側を実HTTPで結合する。
 * @trace ARCH-000012
 * @level IT
 * @scope GoogleおよびWorkbenchの本人確認画面は合成。発行・交換・照会・失効は実ライブラリ。
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import * as oidc from "openid-client";
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
  createMcpOAuthState,
  createMcpResourceMetadata,
  createMcpTokenVerifier,
  mcpScope,
} from "../../src/transport/mcp-oauth.ts";
import {
  createMcpServerFactory,
  MCP_COORDINATOR_PROTOCOL_VERSION,
} from "../../src/transport/mcp-server.ts";
import { readMcpAccountSubject } from "../../src/transport/mcp-types.ts";

test("OAuth状態はプロセスをまたがず、再利用と期限切れを拒否する", async (t) => {
  const state = createMcpOAuthState();
  const code = state("AuthorizationCode");
  const token = state("AccessToken");
  await code.upsert("same-id", { grantId: "grant" }, 90);
  await token.upsert("same-id", { grantId: "grant" }, 300);
  assert.equal(
    await createMcpOAuthState()("AuthorizationCode").find("same-id"),
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
  const state = createMcpOAuthState();
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
  const state = createMcpOAuthState();
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

test("入替済み・期限切れの途中セッションは同じ要求から保存し直せない", async (t) => {
  const state = createMcpOAuthState();
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
  const state = createMcpOAuthState();
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
  const state = createMcpOAuthState();
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
  const oauthState = createMcpOAuthState();
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
  let verifier: Awaited<ReturnType<typeof createMcpTokenVerifier>> | undefined;
  const mcp = createMcpHttpRequestHandler(
    async (token, signal) => {
      if (!signal || !verifier) return null;
      const result = await verifier(token, signal);
      return result.status === "completed" &&
        readMcpAccountSubject(result.subject)?.userId === account.userId
        ? createMcpServerFactory({})
        : null;
    },
    { resourceMetadataUrl: endpoint.metadata },
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
  assert.equal(
    challenge.headers.get("www-authenticate"),
    `Bearer resource_metadata="${endpoint.metadata.href}"`,
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
  verifier = await createMcpTokenVerifier({
    issuer,
    resource,
    clientId: verifierAccount.id,
    clientSecret: verifierAccount.secret,
  });
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
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(";")[0];
        if (pair) cookies.set(pair.split("=")[0] ?? "", pair);
      }
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
  assert.equal(
    revoked.headers.get("www-authenticate"),
    `Bearer resource_metadata="${endpoint.metadata.href}", error="invalid_token"`,
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
  for (const value of afterLogout.headers.getSetCookie()) {
    const pair = value.split(";")[0];
    if (pair) cookies.set(pair.split("=")[0] ?? "", pair);
  }
  const loginPage = await fetch(interactionUrl, {
    redirect: "manual",
    headers: { cookie: [...cookies.values()].join("; ") },
  });
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Googleでログイン/u);
});
