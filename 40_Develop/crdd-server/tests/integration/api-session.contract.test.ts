/**
 * Express上のクライアントセッションをHTTPで検証する。
 * @trace ARCH-000012
 * @level IT
 * @scope loopbackとHTTP Cookies。Google応答とAM照合は代役で、実Googleは使わない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createGitHostLinks } from "../../src/service/git-host.ts";
import { createApiServer } from "../../src/transport/api-http.ts";
import {
  createApiApplication,
  createManagementSessionLifecycleHandler,
} from "../../src/transport/api-server.ts";
import {
  clientLoginPaths,
  clientSessionPaths,
  createClientSessionHandler,
  gitConnectionsRoute,
  gitHostConnectionPaths,
} from "../../src/transport/api-session.ts";

const googlePaths = clientLoginPaths("google");
const gitConnectionPaths = gitHostConnectionPaths("github");

test("同じ本人のブラウザーセッションだけを上限で整理する", async (t) => {
  const transport = createApiServer();
  const { server } = transport;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => transport.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = new URL(`http://127.0.0.1:${address.port}`);
  const invalidated: string[] = [];
  const browser = createClientSessionHandler(
    origin,
    {
      google: {
        async start() {
          throw new Error("not_used");
        },
        async complete(search) {
          const subject = search.get("code");
          if (subject !== "A" && subject !== "B") return null;
          return {
            identity: { issuer: "https://fixture.example", subject },
            returnTo: "/",
          };
        },
      },
    },
    (identity) => ({
      status: "completed",
      account: {
        userId: identity.subject,
        bindingId: `${identity.subject}-binding`,
        username: identity.subject,
        role: "developer",
      },
    }),
    undefined,
    undefined,
    (userId) => invalidated.push(userId),
  );
  server.on("request", transport.handleRequest(browser.handle));
  server.once("close", browser.close);
  const signIn = async (subject: string) => {
    const response = await fetch(
      new URL(`${googlePaths.callback}?code=${subject}`, origin),
      { redirect: "manual" },
    );
    assert.equal(response.status, 303);
    const cookie = response.headers
      .getSetCookie()
      .find((header) => header.startsWith("crdd-client-session="))
      ?.split(";")[0];
    assert.ok(cookie);
    return cookie;
  };
  const session = (cookie: string) =>
    fetch(new URL(clientSessionPaths.session, origin), { headers: { cookie } });
  const other = await signIn("B");
  const sessions = [];
  for (let index = 0; index < 5; index++) sessions.push(await signIn("A"));
  for (const [index, cookie] of sessions.entries()) {
    const response = await session(cookie);
    assert.equal(response.status, index === 0 ? 401 : 200);
    await response.arrayBuffer();
  }
  const existing = await session(other);
  assert.deepEqual(await existing.json(), { username: "B", role: "developer" });
  const next = await session(await signIn("B"));
  assert.deepEqual(await next.json(), { username: "B", role: "developer" });
  assert.deepEqual(invalidated, []);
});

test("外部ログインのセッションは現在の紐付けを読み、Bearerと共用しない", async (t) => {
  const transport = createApiServer();
  const { server } = transport;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = new URL(`http://127.0.0.1:${address.port}`);
    const identity = {
      issuer: "https://fixture.example",
      subject: "fixture",
    };
    const binding = "a".repeat(43);
    const account = {
      revision: 1,
      userId: "fixture-user",
      bindingId: "fixture-link",
      username: "利用者",
      role: "administrator" as "administrator" | "manager" | "developer",
    };
    let consumed = false;
    let registered = false;
    let accountUnavailable = false;
    const invalidatedAccounts: string[] = [];
    let starts = 0;
    let resume = "/";
    let invitationDigest: string | undefined;
    let acceptedInvitations = 0;
    const alternate = clientLoginPaths("fixture");
    const alternateBinding = "z".repeat(43);
    let alternatePending = false;
    let alternateStarts = 0;
    let linkedSession: string | undefined;
    let githubLifetimeMs = 60_000;
    const links = createGitHostLinks();
    const otherHostLinks = createGitHostLinks();
    const otherPaths = gitHostConnectionPaths("fixture-host");
    let otherPending: string | undefined;
    let linkReference: ReturnType<typeof links.save> = null;
    const browser = createClientSessionHandler(
      origin,
      {
        google: {
          async start(returnTo, digest) {
            starts++;
            resume = returnTo;
            consumed = false;
            invitationDigest = digest;
            return {
              location: new URL("https://accounts.google.com/"),
              browserBinding: binding,
            };
          },
          async complete(search, cookie) {
            if (
              consumed ||
              cookie !== binding ||
              search.get("code") !== "synthetic"
            )
              return null;
            consumed = true;
            return {
              identity,
              returnTo: resume,
              ...(invitationDigest
                ? {
                    invitation: {
                      digest: invitationDigest,
                      email: "invite@example.test",
                      emailVerified: true as const,
                    },
                  }
                : {}),
            };
          },
        },
        fixture: {
          async start() {
            alternateStarts++;
            alternatePending = true;
            return {
              location: new URL("https://fixture.example/"),
              browserBinding: alternateBinding,
            };
          },
          async complete(search, cookie) {
            if (
              !alternatePending ||
              cookie !== alternateBinding ||
              search.get("code") !== "fixture"
            )
              return null;
            alternatePending = false;
            return { identity, returnTo: "/" };
          },
        },
      },
      (subject, session) => {
        assert.deepEqual(subject, identity);
        if (session)
          assert.deepEqual(session, {
            userId: account.userId,
            bindingId: account.bindingId,
          });
        if (accountUnavailable) return { status: "unavailable" };
        return registered
          ? { status: "completed", account }
          : { status: "rejected" };
      },
      [
        {
          id: "github",
          host: "github.com",
          displayName: "GitHub",
          links: {
            ...links,
            save(...input) {
              linkReference = links.save(...input);
              return linkReference;
            },
          },
          connection: {
            begin(id) {
              linkedSession = id;
              return new URL(
                "https://github.com/login/oauth/authorize?state=synthetic",
              );
            },
            async complete(search, id, isCurrent) {
              if (
                search.get("state") !== "synthetic" ||
                id !== linkedSession ||
                !isCurrent()
              )
                return null;
              linkedSession = undefined;
              return {
                accountId: "29",
                accessToken: "never_public",
                expiresAt: Date.now() + githubLifetimeMs,
              };
            },
            cancel(id) {
              if (linkedSession === id) linkedSession = undefined;
            },
          },
        },
        {
          id: "fixture-host",
          host: "git.example.test",
          displayName: "Fixture Host",
          links: otherHostLinks,
          connection: {
            begin(id) {
              otherPending = id;
              return new URL("https://git.example.test/authorize");
            },
            async complete(search, id, isCurrent) {
              if (
                search.get("state") !== "other" ||
                otherPending !== id ||
                !isCurrent()
              )
                return null;
              otherPending = undefined;
              return {
                accountId: "29",
                accessToken: "other-synthetic-token",
                expiresAt: Date.now() + 120_000,
              };
            },
            cancel(id) {
              if (otherPending === id) otherPending = undefined;
            },
          },
        },
      ],
      (subject, proof) => {
        assert.deepEqual(subject, identity);
        assert.equal(
          proof.digest,
          createHash("sha256").update("x".repeat(43)).digest("hex"),
        );
        assert.equal(proof.email, "invite@example.test");
        acceptedInvitations++;
        return { status: "completed", account };
      },
      (userId) => invalidatedAccounts.push(userId),
    );
    server.once("close", browser.close);
    const clientSession = transport.handleRequest(browser.handle);
    const fallback: Parameters<typeof createApiApplication>[0]["fallback"] = (
      _request,
      response,
    ) => {
      response.statusCode = 404;
      response.end();
    };
    const handlers = {
      clientSession,
      changeManagementSession: transport.handleRequest(
        createManagementSessionLifecycleHandler(
          origin,
          browser.changeManagement,
        ),
      ),
      fallback,
      view: fallback,
      projectContext: fallback,
      workspace: fallback,
      repository: fallback,
      record: fallback,
      aiSelection: fallback,
      aiRequestObservation: fallback,
      aiRequestWrite: fallback,
      execution: fallback,
      executionActivity: fallback,
    };
    const withoutGit = createApiApplication(handlers, null);
    server.on("request", withoutGit);
    const request = (path: string, init: RequestInit = {}) =>
      fetch(new URL(path, origin), { ...init, redirect: "manual" });
    assert.equal((await request(gitConnectionsRoute)).status, 404);
    for (const method of ["GET", "POST", "DELETE"]) {
      assert.equal(
        (await request(gitConnectionPaths.connection, { method })).status,
        404,
      );
    }
    assert.equal(
      (await request(`${gitConnectionPaths.callback}?state=synthetic`)).status,
      404,
    );
    server.off("request", withoutGit);
    server.on(
      "request",
      createApiApplication(
        {
          ...handlers,
          gitConnection: transport.handleRequest(browser.handleGitConnection),
        },
        null,
      ),
    );
    const sessionPath = "/api/session";
    const loginPath = googlePaths.login;
    const callback = `${loginPath}/callback?code=synthetic`;
    assert.equal(
      (
        await request(loginPath, {
          method: "POST",
          headers: { origin: "https://other.example" },
        })
      ).status,
      403,
    );
    assert.equal(starts, 0);
    for (const path of [
      clientLoginPaths("unconfigured").login,
      "/api/session/google",
    ])
      assert.equal(
        (
          await request(path, {
            method: "POST",
            headers: { origin: origin.origin },
          })
        ).status,
        404,
      );
    assert.equal(starts, 0);
    assert.equal(alternateStarts, 0);
    for (const path of [
      clientLoginPaths("unconfigured").callback,
      "/api/session/google/callback",
    ])
      assert.equal((await request(`${path}?code=synthetic`)).status, 404);

    const begin = () =>
      request(loginPath, {
        method: "POST",
        headers: { origin: origin.origin },
      });
    const started = await begin();
    assert.equal(started.status, 303);
    const cookie = started.headers.getSetCookie()[0];
    assert.match(cookie ?? "", /HttpOnly; SameSite=Lax/u);
    const callbackHeaders = { cookie: `crdd-client-login=${binding}` };
    assert.equal((await request(callback)).status, 403);
    assert.equal(
      (await request(callback, { headers: callbackHeaders })).status,
      403,
    );
    registered = true;
    await begin();
    const alternateStart = await request(alternate.login, {
      method: "POST",
      headers: { origin: origin.origin },
    });
    assert.equal(alternateStart.status, 303);
    assert.equal(
      alternateStart.headers.get("location"),
      "https://fixture.example/",
    );
    assert.ok(
      alternateStart.headers
        .getSetCookie()[0]
        ?.includes(`Path=${alternate.callback};`),
    );
    assert.equal(
      (
        await request(`${alternate.callback}?code=fixture`, {
          headers: callbackHeaders,
        })
      ).status,
      403,
    );
    const alternateHeaders = {
      cookie: `crdd-client-login=${alternateBinding}`,
    };
    assert.equal(
      (await request(callback, { headers: alternateHeaders })).status,
      403,
    );
    assert.equal(
      (
        await request(`${alternate.callback}?code=fixture`, {
          headers: alternateHeaders,
        })
      ).status,
      303,
    );
    const confirmed = await request(callback, { headers: callbackHeaders });
    assert.equal(confirmed.status, 303);
    assert.equal(confirmed.headers.get("location"), "/");
    const stored = confirmed.headers
      .getSetCookie()
      .find((value) => value.startsWith("crdd-client-session="));
    assert.ok(stored);
    assert.match(stored, /HttpOnly; SameSite=Lax/u);
    const requestCookie = stored.split(";")[0];
    assert.ok(requestCookie);
    assert.equal(
      (
        await request(sessionPath, {
          headers: { authorization: `Bearer ${requestCookie.split("=")[1]}` },
        })
      ).status,
      401,
    );
    const user = await request(sessionPath, {
      headers: { cookie: requestCookie },
    });
    assert.deepEqual(await user.json(), {
      username: "利用者",
      role: "administrator",
    });
    const { connection, callback: gitCallback } = gitConnectionPaths;
    const sameSite = { origin: origin.origin, cookie: requestCookie };
    const anonymousHosts = await request(gitConnectionsRoute);
    assert.equal(anonymousHosts.status, 401);
    assert.equal(
      (await anonymousHosts.text()).includes("git.example.test"),
      false,
    );
    assert.equal((await request(connection)).status, 401);
    assert.equal(
      (
        await request(connection, {
          method: "POST",
          headers: { cookie: requestCookie },
        })
      ).status,
      403,
    );
    const gitStart = await request(connection, {
      method: "POST",
      headers: sameSite,
    });
    assert.equal(gitStart.status, 303);
    assert.equal(
      gitStart.headers.get("location"),
      "https://github.com/login/oauth/authorize?state=synthetic",
    );
    assert.equal((await request(`${gitCallback}?state=synthetic`)).status, 401);
    const gitComplete = await request(`${gitCallback}?state=synthetic`, {
      headers: { cookie: requestCookie },
    });
    assert.equal(gitComplete.status, 303);
    assert.equal(gitComplete.headers.get("location"), "/");
    assert.deepEqual(gitComplete.headers.getSetCookie(), []);
    assert.deepEqual(
      await (
        await request(connection, { headers: { cookie: requestCookie } })
      ).json(),
      { connected: true },
    );
    const otherStart = await request(otherPaths.connection, {
      method: "POST",
      headers: sameSite,
    });
    assert.equal(otherStart.status, 303);
    assert.equal(
      otherStart.headers.get("location"),
      "https://git.example.test/authorize",
    );
    assert.equal(
      (
        await request(`${otherPaths.callback}?state=synthetic`, {
          headers: sameSite,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(`${otherPaths.callback}?state=other`, {
          headers: sameSite,
        })
      ).status,
      303,
    );
    assert.deepEqual(
      await (await request(gitConnectionsRoute, { headers: sameSite })).json(),
      {
        hosts: [
          {
            id: "github",
            host: "github.com",
            displayName: "GitHub",
            connected: true,
          },
          {
            id: "fixture-host",
            host: "git.example.test",
            displayName: "Fixture Host",
            connected: true,
          },
        ],
      },
    );
    assert.deepEqual(
      await (
        await request(otherPaths.connection, { headers: sameSite })
      ).json(),
      { connected: true },
    );
    assert.equal(
      (
        await request(otherPaths.connection, {
          method: "DELETE",
          headers: sameSite,
        })
      ).status,
      204,
    );
    assert.deepEqual(
      await (
        await request(otherPaths.connection, { headers: sameSite })
      ).json(),
      { connected: false },
    );
    assert.deepEqual(
      await (await request(connection, { headers: sameSite })).json(),
      { connected: true },
    );
    const updatedHosts = await request(gitConnectionsRoute, {
      headers: sameSite,
    });
    assert.equal(updatedHosts.headers.get("cache-control"), "no-store");
    assert.deepEqual(await updatedHosts.json(), {
      hosts: [
        {
          id: "github",
          host: "github.com",
          displayName: "GitHub",
          connected: true,
        },
        {
          id: "fixture-host",
          host: "git.example.test",
          displayName: "Fixture Host",
          connected: false,
        },
      ],
    });
    await begin();
    const second = await request(callback, { headers: callbackHeaders });
    const secondCookie = second.headers
      .getSetCookie()
      .find((value) => value.startsWith("crdd-client-session="))
      ?.split(";")[0];
    assert.ok(secondCookie && secondCookie !== requestCookie);
    assert.deepEqual(
      await (
        await request(connection, { headers: { cookie: secondCookie } })
      ).json(),
      { connected: false },
    );
    assert.equal(
      (
        await request(connection, {
          method: "DELETE",
          headers: { ...sameSite, cookie: secondCookie },
        })
      ).status,
      204,
    );
    assert.deepEqual(
      await (
        await request(connection, { headers: { cookie: requestCookie } })
      ).json(),
      { connected: true },
    );
    assert.ok(linkReference);
    const monitored = links.open(linkReference, account);
    assert.ok(monitored);
    t.after(monitored.close);
    const observingClock = Date.now();
    const advanceGitHost = t.mock.method(
      Date,
      "now",
      () => observingClock + 61_000,
    );
    try {
      assert.deepEqual(
        await (
          await request(connection, { headers: { cookie: requestCookie } })
        ).json(),
        { connected: false },
      );
      assert.equal(monitored.revocationSignal.aborted, false);
    } finally {
      advanceGitHost.mock.restore();
    }
    assert.equal(
      (await request(connection, { method: "DELETE", headers: sameSite }))
        .status,
      204,
    );
    assert.equal(monitored.revocationSignal.aborted, true);
    monitored.close();
    githubLifetimeMs = 60 * 60_000;
    assert.ok(linkReference);
    assert.equal(links.read(linkReference, account), null);
    assert.deepEqual(
      await (
        await request(connection, { headers: { cookie: requestCookie } })
      ).json(),
      { connected: false },
    );
    const managementPath = clientSessionPaths.management;
    assert.equal(
      (
        await request(`${managementPath}?unexpected=1`, {
          method: "POST",
          headers: sameSite,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(managementPath, {
          method: "POST",
          headers: { ...sameSite, origin: "https://other.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(managementPath, {
          method: "POST",
          headers: { origin: origin.origin },
        })
      ).status,
      401,
    );
    let managementCookie = "";
    for (const role of ["administrator", "manager"] as const) {
      account.role = role;
      const issued = await request(clientSessionPaths.management, {
        method: "POST",
        headers: sameSite,
      });
      assert.equal(issued.status, 204);
      const cookie = issued.headers.get("set-cookie") ?? "";
      assert.match(cookie, /^crdd-management-session=/u);
      managementCookie = cookie.split(";", 1)[0] ?? "";
    }
    const managementHeaders = {
      ...sameSite,
      cookie: `${requestCookie}; ${managementCookie}`,
    };
    let readPriorManagement:
      | (() => ReturnType<typeof browser.readManagement>)
      | undefined;
    server.prependOnceListener("request", (incoming) => {
      readPriorManagement = () => browser.readManagement(incoming);
    });
    accountUnavailable = true;
    const unavailableManagement = await request(managementPath, {
      method: "POST",
      headers: managementHeaders,
    });
    assert.equal(unavailableManagement.status, 503);
    assert.equal(unavailableManagement.headers.get("set-cookie"), null);
    assert.ok(readPriorManagement?.());
    accountUnavailable = false;
    const endedManagement = await request(managementPath, {
      method: "DELETE",
      headers: managementHeaders,
    });
    assert.equal(endedManagement.status, 204);
    assert.match(
      endedManagement.headers.get("set-cookie") ?? "",
      /^crdd-management-session=; Path=\/api; Max-Age=0; HttpOnly; SameSite=Lax/u,
    );
    assert.equal(readPriorManagement?.(), null);
    account.role = "developer";
    const denied = await request(clientSessionPaths.management, {
      method: "POST",
      headers: sameSite,
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("set-cookie"), null);
    assert.deepEqual(
      await (
        await request(sessionPath, { headers: { cookie: requestCookie } })
      ).json(),
      { username: "利用者", role: "developer" },
    );
    assert.equal(
      (
        await request(sessionPath, {
          method: "DELETE",
          headers: { origin: "https://other.example", cookie: requestCookie },
        })
      ).status,
      403,
    );
    const secondHeaders = { ...sameSite, cookie: secondCookie };
    assert.equal(
      (await request(connection, { method: "POST", headers: secondHeaders }))
        .status,
      303,
    );
    assert.equal(
      (
        await request(`${gitCallback}?state=synthetic`, {
          headers: secondHeaders,
        })
      ).status,
      303,
    );
    assert.ok(linkReference);
    const retainedReference = linkReference;
    const now = Date.now();
    const clock = t.mock.method(Date, "now", () => now + 31 * 60_000);
    try {
      assert.equal(
        (
          await request(sessionPath, {
            method: "DELETE",
            headers: { origin: origin.origin, cookie: secondCookie },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request(sessionPath, {
            method: "DELETE",
            headers: { origin: origin.origin },
          })
        ).status,
        401,
      );
      assert.deepEqual(invalidatedAccounts, []);
      assert.equal(links.read(retainedReference, account), "never_public");
      assert.equal(
        links.read(retainedReference, { ...account, bindingId: "other" }),
        null,
      );
    } finally {
      clock.mock.restore();
    }
    assert.deepEqual(invalidatedAccounts, []);
    const logout = () =>
      request(sessionPath, {
        method: "DELETE",
        headers: { origin: origin.origin, cookie: requestCookie },
      });
    assert.equal(
      (await request(connection, { method: "POST", headers: sameSite })).status,
      303,
    );
    assert.equal(
      (await request(`${gitCallback}?state=synthetic`, { headers: sameSite }))
        .status,
      303,
    );
    assert.ok(linkReference);
    const logoutReference = linkReference;
    const running = links.open(logoutReference, account);
    assert.ok(running);
    t.after(running.close);
    assert.notEqual(logoutReference, retainedReference);
    await begin();
    const otherBrowser = await request(callback, { headers: callbackHeaders });
    const pendingCookie = otherBrowser.headers
      .getSetCookie()
      .find((value) => value.startsWith("crdd-client-session="))
      ?.split(";")[0];
    assert.ok(pendingCookie);
    assert.equal(
      (
        await request(connection, {
          method: "POST",
          headers: { cookie: pendingCookie, origin: origin.origin },
        })
      ).status,
      303,
    );
    accountUnavailable = true;
    assert.equal((await logout()).status, 503);
    assert.deepEqual(invalidatedAccounts, []);
    assert.equal(links.read(logoutReference, account), "never_public");
    accountUnavailable = false;
    assert.equal((await logout()).status, 204);
    assert.deepEqual(invalidatedAccounts, [account.userId]);
    assert.equal(links.read(logoutReference, account), null);
    assert.equal(links.read(retainedReference, account), null);
    assert.equal(running.accountId, "29");
    assert.equal(running.revocationSignal.aborted, false);
    assert.equal(
      (
        await request(`${gitCallback}?state=synthetic`, {
          headers: { cookie: pendingCookie },
        })
      ).status,
      403,
    );
    assert.equal((await logout()).status, 401);
    assert.deepEqual(invalidatedAccounts, [account.userId]);
    assert.equal(
      (await request(sessionPath, { headers: { cookie: requestCookie } }))
        .status,
      401,
    );
    const invite = googlePaths.invitation;
    const invitation = "x".repeat(43);
    assert.equal(
      (
        await request(invite, {
          method: "POST",
          headers: { origin: "https://other.example" },
          body: new URLSearchParams({ invitation }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(invite, {
          method: "POST",
          headers: { origin: origin.origin },
          body: new URLSearchParams({ invitation }),
        })
      ).status,
      303,
    );
    assert.equal(acceptedInvitations, 0);
    assert.equal(
      (await request(callback, { headers: callbackHeaders })).status,
      303,
    );
    assert.equal(acceptedInvitations, 1);
    assert.equal(
      (await request(callback, { headers: callbackHeaders })).status,
      403,
    );
    assert.equal(acceptedInvitations, 1);
  } finally {
    if (server.listening) await transport.close();
  }
});
