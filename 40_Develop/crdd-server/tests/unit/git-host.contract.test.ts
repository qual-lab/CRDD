/**
 * 合成GitHub応答で、本人の連携と対象Repositoryの権限確認を検証する。
 * @level UT
 * @scope 実GitHubへの通信・Git操作は行わない。
 */
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  bindGitHost,
  configuredGitHosts,
  createGitHostLinks,
  type BoundGitHost,
  type GitHostProvider,
} from "../../src/service/git-host.ts";

function gitHubHost(
  providerData: unknown = { clientId: "fixture", clientSecret: "fixture" },
) {
  const [configured] = configuredGitHosts([
    { host: "github.com", provider: "github", providerData },
  ]);
  assert.ok(configured);
  return bindGitHost(configured);
}

const fixtureHost = gitHubHost();
const observeGitHostRepositoryAccess = fixtureHost.observeAccess;
const observeGitHostRepositoryBinding = ({
  host,
  ...input
}: Parameters<BoundGitHost["observeBinding"]>[0] & { host: string }) =>
  host === fixtureHost.host
    ? fixtureHost.observeBinding(input)
    : Promise.resolve(null);
const readGitHostRepositoryName = (host: string, remote: string) =>
  host === fixtureHost.host ? fixtureHost.readRepositoryName(remote) : null;

test("同じ提供元の二つのホストに独立した設定を結合し、別ホストへ資格を渡さない", async () => {
  const observations: unknown[] = [];
  const profile: GitHostProvider = {
    kind: "fixture",
    displayName: "Fixture",
    acceptsHost: (host) => host.endsWith(".example.test"),
    acceptsApiBase: (base, host) => base === `https://${host}/api`,
    readEnvironment: (value, read) => read(value),
    bind: (configuration) => ({
      connect: () => ({
        begin: () => null,
        cancel: () => {},
        complete: async () => null,
      }),
      readRepositoryName: (remote) => new URL(remote).pathname,
      observeBinding: async () => null,
      observeAccess: async ({ userAccessToken }) => {
        observations.push([
          configuration.host,
          configuration.apiBase,
          configuration.providerData,
          userAccessToken,
        ]);
        return {
          status: "allowed",
          read: true,
          write: false,
          name: "/groups/team/repository",
        };
      },
    }),
  };
  const [one, two] = configuredGitHosts(
    ["first.example.test", "second.example.test"].map((host) => ({
      host,
      provider: "fixture",
      apiBase: `https://${host}/api`,
      providerData: host,
    })),
    (name) => (name === "first.example.test" ? "first-value" : "second-value"),
    new Map([[profile.kind, profile]]),
  ).map(bindGitHost);
  assert.ok(one && two);
  assert.notEqual(one.id, two.id);
  assert.equal(one.observePermission, undefined);
  const reference = {
    provider: "fixture",
    host: two.host,
    repositoryId: "repository",
    providerData: {},
  };
  assert.equal(
    one.readRepositoryName(`https://${two.host}/groups/team/repository`),
    null,
  );
  assert.deepEqual(
    await one.observeAccess({ reference, userAccessToken: "must-not-send" }),
    { status: "unavailable" },
  );
  assert.deepEqual(
    await two.observeAccess({
      reference: { ...reference, provider: "different" },
      userAccessToken: "must-not-send",
    }),
    { status: "unavailable" },
  );
  assert.deepEqual(observations, []);
  assert.equal(
    (await two.observeAccess({ reference, userAccessToken: "second-user" }))
      .status,
    "allowed",
  );
  assert.deepEqual(observations, [
    [two.host, `https://${two.host}/api`, "second-value", "second-user"],
  ]);
});

const repositoryReference = {
  provider: "github",
  host: "github.com",
  repositoryId: "92",
  providerData: { installationId: "24" },
} as const;

test("インストール資格の監視はリポジトリと利用者の安定IDを照合する", async (t) => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const observe = gitHubHost({
    clientId: "App_fixture.example-1",
    clientSecret: "fixture-only",
    privateKey: privateKey.export({ format: "pem", type: "pkcs1" }).toString(),
  }).observePermission;
  assert.ok(observe);
  const target = {
    reference: repositoryReference,
    accountId: "51",
    signal: new AbortController().signal,
  };
  let permission = "admin";
  let missingPermission = false;
  let repoId = 92;
  let accountId = 51;
  let minted = 0;
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    (url: URL, init: RequestInit) => {
      assert.equal(url.origin, "https://api.github.com");
      assert.equal(init.redirect, "error");
      const authorization = new Headers(init.headers).get("Authorization");
      if (url.pathname === "/app/installations/24/access_tokens") {
        minted++;
        assert.match(authorization ?? "", /^Bearer [^.]+\.[^.]+\.[^.]+$/u);
        assert.equal(init.method, "POST");
        assert.deepEqual(JSON.parse(String(init.body)), {
          repository_ids: [92],
          permissions: { metadata: "read" },
        });
        return Response.json(
          {
            token: "ghs_test_only",
            permissions: { metadata: "read" },
            expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          },
          { status: 201 },
        );
      }
      assert.equal(authorization, "Bearer ghs_test_only");
      if (url.pathname === "/installation/repositories")
        return Response.json({
          total_count: 1,
          repositories: [{ id: repoId, full_name: "Team/Renamed" }],
        });
      if (url.pathname === "/user/51")
        return Response.json({ id: 51, login: "renamed-user" });
      assert.equal(
        url.pathname,
        "/repos/team/renamed/collaborators/renamed-user/permission",
      );
      if (missingPermission) return new Response(null, { status: 404 });
      return Response.json({ permission, user: { id: accountId } });
    },
  );
  assert.deepEqual(await observe(target), {
    permission: "write",
    repositoryName: "team/renamed",
  });
  permission = "read";
  assert.deepEqual(await observe(target), {
    permission: "read",
    repositoryName: "team/renamed",
  });
  permission = "none";
  assert.deepEqual(await observe(target), {
    permission: "none",
    repositoryName: "team/renamed",
  });
  missingPermission = true;
  assert.equal(await observe(target), "unavailable");
  missingPermission = false;
  accountId = 52;
  assert.equal(await observe(target), "unavailable");
  accountId = 51;
  repoId = 999;
  assert.equal(await observe(target), "unavailable");
  const calls = fetch.mock.callCount();
  assert.equal(
    await observe({
      ...target,
      reference: { ...repositoryReference, host: "unsupported.example" },
    }),
    "unavailable",
  );
  for (const malformed of ["051", "51x", "9007199254740992"])
    assert.equal(
      await observe({ ...target, accountId: malformed }),
      "unavailable",
    );
  assert.equal(
    await observe({ ...target, accountId: 51 as unknown as string }),
    "unavailable",
  );
  for (const reference of [
    { ...repositoryReference, provider: "other" },
    { ...repositoryReference, repositoryId: "092" },
    { ...repositoryReference, providerData: { installationId: "0x18" } },
    {
      ...repositoryReference,
      providerData: { installationId: "24", extra: "25" },
    },
  ])
    assert.equal(await observe({ ...target, reference }), "unavailable");
  assert.equal(fetch.mock.callCount(), calls);
  assert.equal(minted, 1, "同じ対象の有効な読取り専用資格を再利用する");
  repoId = 92;
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 61 * 60_000);
  assert.deepEqual(await observe(target), {
    permission: "none",
    repositoryName: "team/renamed",
  });
  assert.equal(minted, 2, "期限切れのインストール資格を再発行する");
});

function connection() {
  return gitHubHost({
    clientId: "client-id",
    clientSecret: "test-only-secret",
  }).connect(new URL("http://127.0.0.1:1234/api/session/git/callback"));
}

function beginLink(github: ReturnType<typeof connection>) {
  const url = github.begin("session-a");
  assert.ok(url);
  return {
    url,
    reply: new URLSearchParams({
      state: url.searchParams.get("state") ?? "",
      code: "code",
    }),
    signal: new AbortController().signal,
  };
}

test("GitHub link uses PKCE, the same CRDD session, and a verified numeric account ID", async (t) => {
  const github = connection();
  const { url, reply, signal } = beginLink(github);
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.has("client_secret"), false);
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    (destination: string, _options: RequestInit) =>
      destination === "https://github.com/login/oauth/access_token"
        ? Response.json({
            access_token: "ghu_test",
            token_type: "bearer",
            expires_in: 3600,
          })
        : Response.json({
            id: 49,
            login: "mutable-name",
            email: "not-an-identity",
          }),
  );
  assert.equal(
    await github.complete(reply, "session-b", () => true, signal),
    null,
  );
  assert.equal(fetch.mock.callCount(), 0);
  const result = await github.complete(reply, "session-a", () => true, signal);
  assert.equal(result?.accountId, "49");
  assert.equal(result?.accessToken, "ghu_test");
  assert.ok(result.expiresAt > Date.now());
  assert.deepEqual(Object.keys(result).sort(), [
    "accessToken",
    "accountId",
    "expiresAt",
  ]);
  assert.equal(
    await github.complete(reply, "session-a", () => true, signal),
    null,
  );
  assert.equal(fetch.mock.callCount(), 2);
  const [exchange, identify] = fetch.mock.calls;
  assert.ok(exchange && identify);
  const [, exchangeOptions] = exchange.arguments;
  const [identityUrl, identityOptions] = identify.arguments;
  assert.ok(exchangeOptions && identityOptions);
  assert.equal(identityUrl, "https://api.github.com/user");
  assert.equal(
    new Headers(identityOptions.headers).get("Authorization"),
    "Bearer ghu_test",
  );
  assert.equal(exchangeOptions.redirect, "error");
  assert.equal(identityOptions.redirect, "error");
  assert.ok(exchangeOptions.body instanceof URLSearchParams);
  const verifier = exchangeOptions.body.get("code_verifier");
  assert.ok(verifier);
  assert.equal(
    createHash("sha256").update(verifier).digest("base64url"),
    url.searchParams.get("code_challenge"),
  );
});

test("logout or replacement while exchanging the code cannot complete the old link", async (t) => {
  for (const event of ["logout", "replaced", "expired session"] as const) {
    await t.test(event, async (t) => {
      const github = connection();
      const { reply, signal } = beginLink(github);
      let current = true;
      const fetch = t.mock.method(globalThis, "fetch", () => {
        if (event === "logout") github.cancel("session-a");
        if (event === "replaced") beginLink(github);
        if (event === "expired session") current = false;
        return Response.json({
          access_token: "ghu_test",
          token_type: "bearer",
          expires_in: 3600,
        });
      });
      assert.equal(
        await github.complete(reply, "session-a", () => current, signal),
        null,
      );
      assert.equal(fetch.mock.callCount(), 1);
    });
  }
});

test("the link rejects duplicate codes and tokens without expiration", async (t) => {
  const github = connection();
  const malformed = beginLink(github);
  malformed.reply.append("code", "other");
  const fetch = t.mock.method(globalThis, "fetch", () =>
    Response.json({ access_token: "ghu_test", token_type: "bearer" }),
  );
  assert.equal(
    await github.complete(
      malformed.reply,
      "session-a",
      () => true,
      malformed.signal,
    ),
    null,
  );
  assert.equal(fetch.mock.callCount(), 0);
  const { reply, signal } = beginLink(github);
  assert.equal(
    await github.complete(reply, "session-a", () => true, signal),
    null,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

const target = {
  reference: repositoryReference,
  userAccessToken: "ghu_test_only",
};

test("Gitホスト資格は別の紐付け・参照・インスタンスでは使えず、解除と期限を反映する", (t) => {
  const links = createGitHostLinks();
  const owner = { userId: "user.fixture", bindingId: "binding.fixture" };
  const now = Date.now();
  const reference = links.save(owner, {
    accountId: "51",
    accessToken: "synthetic_token",
    expiresAt: now + 60_000,
  });
  assert.ok(reference);
  assert.equal(links.read(reference, owner), "synthetic_token");
  assert.equal(links.readAccountId(reference, owner), "51");
  assert.equal(
    links.readAccountId(reference, { ...owner, userId: "other" }),
    null,
  );
  assert.equal(
    links.readAccountId(reference, { ...owner, bindingId: "other" }),
    null,
  );
  assert.equal(links.read(reference, { ...owner, bindingId: "other" }), null);
  assert.equal(links.read(reference, { ...owner, userId: "other" }), null);
  assert.equal(createGitHostLinks().read(reference, owner), null);
  const expiring = links.save(owner, {
    accountId: "51",
    accessToken: "another_token",
    expiresAt: now + 60_000,
  });
  assert.ok(expiring);
  links.remove(reference);
  assert.equal(links.read(reference, owner), null);
  assert.equal(links.read(expiring, owner), "another_token");
  t.mock.method(Date, "now", () => now + 60_001);
  assert.equal(links.read(expiring, owner), null);
  assert.equal(links.readAccountId(expiring, owner), null);
  assert.equal(
    links.save(owner, {
      accountId: "51",
      accessToken: "expired_token",
      expiresAt: now + 60_000,
    }),
    null,
  );
});

test("Gitホスト連携の上限は既存の参照を追い出さず、終了時に全参照を破棄する", (t) => {
  const links = createGitHostLinks();
  t.after(links.close);
  const owner = { userId: "user.fixture", bindingId: "binding.fixture" };
  const now = Date.now();
  const first = links.save(owner, {
    accountId: "51",
    accessToken: "first_token",
    expiresAt: now + 1_000,
  });
  assert.ok(first);
  let accepted = 1;
  for (let index = 0; index < 256; index++) {
    if (
      links.save(owner, {
        accountId: "51",
        accessToken: "other_token",
        expiresAt: now + 60_000,
      }) === null
    )
      break;
    accepted++;
  }
  assert.equal(accepted, 128);
  assert.equal(links.read(first, owner), "first_token");
  const clock = t.mock.method(Date, "now", () => now + 1_001);
  const next = links.save(owner, {
    accountId: "51",
    accessToken: "replacement_token",
    expiresAt: now + 60_000,
  });
  assert.ok(next);
  assert.equal(links.read(first, owner), null);
  clock.mock.restore();
  links.close();
  assert.equal(links.read(next, owner), null);
});

test("実行監視はGitホスト資格の期限切れと明示解除を区別する", (t) => {
  const links = createGitHostLinks();
  t.after(links.close);
  const owner = { userId: "user.fixture", bindingId: "binding.fixture" };
  const now = Date.now();
  const reference = links.save(owner, {
    accountId: "51",
    accessToken: "synthetic_token",
    expiresAt: now + 60_000,
  });
  assert.ok(reference);
  assert.equal(links.open(reference, { ...owner, bindingId: "other" }), null);
  const execution = links.open(reference, owner);
  assert.ok(execution);
  t.after(execution.close);
  assert.equal(execution.accountId, "51");
  t.mock.method(Date, "now", () => now + 61_000);
  assert.equal(links.read(reference, owner), null);
  assert.equal(execution.revocationSignal.aborted, false);
  assert.equal(execution.accountId, "51");
  links.remove(reference);
  assert.equal(execution.revocationSignal.aborted, true);
});

test("ログアウト後も元の本人・Gitアカウントを指定した明示解除は実行へ届く", (t) => {
  const links = createGitHostLinks();
  t.after(links.close);
  const owner = { userId: "user.fixture", bindingId: "binding.fixture" };
  const linked = {
    accountId: "51",
    accessToken: "fixture",
    expiresAt: Date.now() + 60_000,
  };
  const first = links.save(owner, linked);
  assert.ok(first);
  const running = links.open(first, owner);
  assert.ok(running);
  t.after(running.close);
  links.signOut(owner.userId);
  assert.equal(links.read(first, owner), null);
  assert.equal(running.revocationSignal.aborted, false);
  const other = links.save(owner, { ...linked, accountId: "fixture:other" });
  assert.ok(other);
  links.disconnect(other, owner);
  assert.equal(running.revocationSignal.aborted, false);
  const same = links.save(owner, linked);
  assert.ok(same);
  links.disconnect(same, owner);
  assert.equal(running.revocationSignal.aborted, true);
});

test("registration binds the observed GitHub HTTPS remote to a numeric repository ID", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", (url: URL) => {
    if (url.pathname === "/user/installations") return installation("read");
    return Response.json({
      total_count: 1,
      repositories: [
        {
          id: 92,
          full_name: "Team/Project",
          permissions: { pull: true, push: false },
        },
      ],
    });
  });
  const observe = (remote: string) =>
    observeGitHostRepositoryBinding({
      host: repositoryReference.host,
      userAccessToken: target.userAccessToken,
      remote,
    });
  assert.deepEqual(
    await observe("https://github.com/team/project.git"),
    repositoryReference,
  );
  assert.equal(await observe("https://github.com/other/project.git"), null);
  assert.equal(await observe("https://github.com/team/other.git"), null);
  const calls = fetch.mock.callCount();
  for (const remote of [
    "git@github.com:team/project.git",
    "https://github.com.attacker.example/team/project.git",
    "https://user@github.com/team/project.git",
    "https://github.com/team/project.git?rewrite=true",
    "https://github.com/team/../project.git",
  ])
    assert.equal(await observe(remote), null);
  assert.equal(fetch.mock.callCount(), calls);
  const remote = "https://github.com/team/project.git";
  assert.equal(readGitHostRepositoryName("git.example", remote), null);
  assert.equal(
    await observeGitHostRepositoryBinding({
      ...target,
      host: "git.example",
      remote,
    }),
    null,
  );
  assert.deepEqual(
    await observeGitHostRepositoryAccess({
      ...target,
      reference: { ...repositoryReference, host: "git.example" },
    }),
    { status: "unavailable" },
  );
  assert.throws(
    () =>
      configuredGitHosts([
        {
          host: "git.example",
          provider: "github",
          providerData: {
            clientId: "synthetic-client",
            clientSecret: "synthetic-secret",
          },
        },
      ]),
    /git_hosts_configuration_invalid/u,
  );
  assert.equal(fetch.mock.callCount(), calls);
});

function installation(contents: string): Response {
  return Response.json({
    total_count: 1,
    installations: [
      { id: 24, account: { login: "Team" }, permissions: { contents } },
    ],
  });
}

function repositories(pull: boolean, push: boolean): Response {
  return Response.json({
    total_count: 1,
    repositories: [
      { id: 92, full_name: "Fixture/Project", permissions: { pull, push } },
    ],
  });
}

test("effective access follows the user, with GitHub App contents permission as an additional restriction", async (t) => {
  for (const [contents, pull, push, status, write] of [
    ["write", true, true, "allowed", true],
    ["write", true, false, "allowed", false],
    ["read", true, true, "allowed", false],
    ["write", false, false, "denied", undefined],
    ["none", true, true, "denied", undefined],
  ] as const) {
    await t.test(`${contents}/${pull}/${push}`, async (t) => {
      const fetch = t.mock.method(
        globalThis,
        "fetch",
        (url: URL, init: RequestInit) => {
          assert.equal(url.origin, "https://api.github.com");
          assert.equal(init.redirect, "error");
          assert.equal(
            new Headers(init.headers).get("Authorization"),
            "Bearer ghu_test_only",
          );
          if (url.pathname === "/user/installations")
            return installation(contents);
          assert.equal(url.pathname, "/user/installations/24/repositories");
          return repositories(pull, push);
        },
      );
      assert.deepEqual(
        await observeGitHostRepositoryAccess(target),
        status === "allowed"
          ? {
              status,
              read: true,
              write,
              name: "fixture/project",
            }
          : { status },
      );
      assert.equal(fetch.mock.callCount(), contents === "none" ? 1 : 2);
    });
  }
});

test("repository identity is numeric and lookup does not stop at the first page", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", (url: URL) => {
    if (url.pathname === "/user/installations") return installation("write");
    if (url.searchParams.get("page") === "1") {
      return Response.json({
        total_count: 101,
        repositories: Array.from({ length: 100 }, (_, i) => ({ id: 100 + i })),
      });
    }
    assert.equal(url.searchParams.get("page"), "2");
    return Response.json({
      total_count: 101,
      repositories: [{ id: 92, permissions: { pull: true, push: true } }],
    });
  });
  assert.deepEqual(await observeGitHostRepositoryAccess(target), {
    status: "allowed",
    read: true,
    write: true,
    name: null,
  });
  assert.equal(fetch.mock.callCount(), 3);
  assert.deepEqual(
    await observeGitHostRepositoryAccess({
      ...target,
      reference: { ...repositoryReference, repositoryId: "91" },
    }),
    { status: "denied" },
  );
});

test("incomplete observations, cancellation, and unknown permissions do not authorize", async (t) => {
  for (const [label, reply] of [
    ["rate limited", () => new Response(null, { status: 429 })],
    [
      "forbidden without an exact permission result",
      () => new Response(null, { status: 403 }),
    ],
    [
      "missing repository permission",
      () => Response.json({ total_count: 1, repositories: [{ id: 92 }] }),
    ],
    [
      "truncated page",
      () => Response.json({ total_count: 1, repositories: [] }),
    ],
    [
      "transport failure",
      () => {
        throw new TypeError("network failed");
      },
    ],
  ] as const) {
    await t.test(label, async (t) => {
      t.mock.method(globalThis, "fetch", (url: URL) =>
        url.pathname === "/user/installations"
          ? installation("write")
          : reply(),
      );
      assert.deepEqual(await observeGitHostRepositoryAccess(target), {
        status: "unavailable",
      });
    });
  }
  await t.test("cancelled before the first request", async (t) => {
    const fetch = t.mock.method(
      globalThis,
      "fetch",
      (_url: URL, init: RequestInit) => {
        init.signal?.throwIfAborted();
        return installation("write");
      },
    );
    assert.deepEqual(
      await observeGitHostRepositoryAccess({
        ...target,
        signal: AbortSignal.abort(),
      }),
      { status: "unavailable" },
    );
    assert.equal(fetch.mock.callCount(), 0);
  });
});

test("GitHub 401 is an observed credential denial, not transport unavailability", async (t) => {
  t.mock.method(globalThis, "fetch", () => new Response(null, { status: 401 }));
  assert.deepEqual(await observeGitHostRepositoryAccess(target), {
    status: "denied",
  });
});
