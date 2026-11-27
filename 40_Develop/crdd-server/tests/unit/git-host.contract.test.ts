/**
 * 合成GitHub応答で、本人の連携と対象Repositoryの権限確認を検証する。
 * @level UT
 * @scope 実GitHubへの通信・Git操作は行わない。
 */
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  type BoundGitHost,
  bindGitHost,
  configuredGitHosts,
  createGitHostLinks,
  type GitHostProvider,
  openGitHostExecutionAccess,
  registerGitHostProvider,
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

test("同じ資格の失効完了を待つ間も、ログアウトは実行を止めず再登録を拒否する", async () => {
  let resolve!: (confirmed: boolean) => void;
  const promise = new Promise<boolean>((complete) => {
    resolve = complete;
  });
  let observed = 0;
  const links = createGitHostLinks(undefined, async () => {
    observed++;
    return promise;
  });
  const owner = { userId: "user", bindingId: "binding" };
  const linked = {
    accountId: "29",
    accessToken: "synthetic",
    expiresAt: Date.now() + 60_000,
  };
  const reference = links.save(owner, linked);
  assert.ok(reference);
  const running = links.open(reference, owner);
  assert.ok(running);
  try {
    const logout = links.signOut(owner.userId);
    assert.equal(links.read(reference, owner), null);
    assert.equal(running.revocationSignal.aborted, false);
    assert.equal(links.save(owner, linked), null);
    const concurrentLogout = links.signOut(owner.userId);
    resolve(false);
    assert.equal(await logout, false);
    assert.equal(await concurrentLogout, false);
    assert.equal(observed, 1);
    assert.equal(running.revocationSignal.aborted, false);
  } finally {
    running.close();
    links.close();
  }
});

test("GitHubの失効要求は設定したAppの個別トークンだけを取り消す", async (t) => {
  const revoke = fixtureHost.revokeUserToken;
  assert.ok(revoke);
  let status = 204;
  const send = t.mock.method(
    globalThis,
    "fetch",
    async (url: URL, options: RequestInit) => {
      assert.equal(
        String(url),
        "https://api.github.com/applications/fixture/token",
      );
      assert.equal(options.method, "DELETE");
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(
        new Headers(options.headers).get("authorization"),
        `Basic ${Buffer.from("fixture:fixture").toString("base64")}`,
      );
      assert.equal(options.body, JSON.stringify({ access_token: "synthetic" }));
      return new Response(null, { status });
    },
  );
  assert.equal(await revoke("synthetic"), true);
  status = 422;
  assert.equal(await revoke("synthetic"), false);
  assert.equal(send.mock.callCount(), 2);
});

test("同じ提供元の二つのホストに独立した設定を結合し、別ホストへ資格を渡さない", async () => {
  const observations: unknown[] = [];
  let parses = 0;
  const profile: GitHostProvider<string> = {
    kind: "fixture",
    displayName: "Fixture",
    acceptsHost: (host) => host.endsWith(".example.test"),
    acceptsApiBase: (base, host) => base === `https://${host}/api`,
    parseConfiguration: (value, read) => {
      parses++;
      const parsed = read?.(value) ?? value;
      if (typeof parsed !== "string")
        throw new Error("fixture_configuration_invalid");
      return parsed;
    },
    bind: (configuration, credential) => ({
      createLinkFlow: () => ({
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
          credential,
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
  const registry = new Map([[profile.kind, registerGitHostProvider(profile)]]);
  const configured = configuredGitHosts(
    ["first.example.test", "second.example.test"].map((host) => ({
      host,
      provider: "fixture",
      apiBase: `https://${host}/api`,
      providerData: host,
    })),
    (name) => (name === "first.example.test" ? "first-value" : "second-value"),
    registry,
  );
  assert.equal(parses, 2);
  const [one, two] = configuredGitHosts(
    configured.map(({ configuration }) => configuration),
    undefined,
    registry,
  ).map(bindGitHost);
  assert.equal(parses, 2);
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
  let accountName = "renamed-user";
  let nameReads = 0;
  let minted = 0;
  let notModified = 0;
  let permissionNotModified = 0;
  let suppliedPermissionTag: string | undefined;
  let sentPermissionTag: string | null = null;
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
      if (url.pathname === "/user/51") nameReads++;
      const tag =
        url.pathname === "/user/51"
          ? `"user-${accountName}"`
          : `"repo-${repoId}"`;
      if (
        (url.pathname === "/installation/repositories" ||
          url.pathname === "/user/51") &&
        new Headers(init.headers).get("If-None-Match") === tag
      ) {
        notModified++;
        return new Response(null, { status: 304 });
      }
      if (url.pathname === "/installation/repositories")
        return Response.json(
          {
            total_count: 1,
            repositories: [{ id: repoId, full_name: "Team/Renamed" }],
          },
          { headers: { ETag: tag } },
        );
      if (url.pathname === "/user/51")
        return Response.json(
          { id: 51, login: accountName },
          { headers: { ETag: tag } },
        );
      assert.match(
        url.pathname,
        /^\/repos\/team\/renamed\/collaborators\/[^/]+\/permission$/u,
      );
      if (
        missingPermission ||
        !url.pathname.endsWith(`/${accountName}/permission`)
      )
        return new Response(null, { status: 404 });
      const permissionTag =
        suppliedPermissionTag ?? `"permission-${accountId}-${permission}"`;
      sentPermissionTag = new Headers(init.headers).get("If-None-Match");
      if (sentPermissionTag === permissionTag) {
        permissionNotModified++;
        return new Response(null, { status: 304 });
      }
      return Response.json(
        { permission, user: { id: accountId } },
        { headers: { ETag: permissionTag } },
      );
    },
  );
  const abortedCaller = new AbortController();
  const links = createGitHostLinks();
  t.after(links.close);
  const binding = { userId: "user.fixture", bindingId: "binding.fixture" };
  const reference = links.save(binding, {
    accountId: target.accountId,
    accessToken: "not-for-execution-monitoring",
    expiresAt: Date.now() + 60_000,
  });
  assert.ok(reference);
  const connection = { links, observePermission: observe };
  const first = openGitHostExecutionAccess(connection, reference, binding);
  const second = openGitHostExecutionAccess(connection, reference, binding);
  assert.ok(first && second && first !== second);
  try {
    const interrupted = first.observePermission({
      ...target,
      accountId: first.accountId,
      signal: abortedCaller.signal,
    });
    const shared = second.observePermission({
      ...target,
      accountId: second.accountId,
    });
    abortedCaller.abort();
    first.close();
    assert.equal(await interrupted, "unavailable");
    assert.deepEqual(await shared, {
      permission: "write",
      repositoryName: "team/renamed",
    });
  } finally {
    first.close();
    second.close();
  }
  assert.equal(fetch.mock.callCount(), 5);
  assert.equal(nameReads, 1, "同じ対象の並行監視は1回の観測を共有する");
  permission = "read";
  assert.deepEqual(await observe(target), {
    permission: "read",
    repositoryName: "team/renamed",
  });
  assert.equal(fetch.mock.callCount(), 8);
  assert.equal(notModified, 3);
  assert.equal(nameReads, 1, "次回の監視は利用者名だけを再利用する");
  const beforeConditional = fetch.mock.callCount();
  const observers = [
    openGitHostExecutionAccess(connection, reference, binding),
    openGitHostExecutionAccess(connection, reference, binding),
  ];
  try {
    const read = () =>
      Promise.all(
        observers.map((observer) => {
          assert.ok(observer);
          return observer.observePermission(target);
        }),
      );
    const permissionResult = (permission: string) => ({
      permission,
      repositoryName: "team/renamed",
    });
    assert.deepEqual(await read(), [
      permissionResult("read"),
      permissionResult("read"),
    ]);
    assert.equal(permissionNotModified, 1);
    assert.equal(fetch.mock.callCount() - beforeConditional, 3);
    permission = "none";
    assert.deepEqual(await read(), [
      permissionResult("none"),
      permissionResult("none"),
    ]);
    assert.equal(permissionNotModified, 1, "権限変更は304へ畳まない");
  } finally {
    for (const observer of observers) observer?.close?.();
  }
  permission = "write";
  suppliedPermissionTag = "*";
  assert.deepEqual(await observe(target), {
    permission: "write",
    repositoryName: "team/renamed",
  });
  permission = "none";
  suppliedPermissionTag = undefined;
  assert.deepEqual(await observe(target), {
    permission: "none",
    repositoryName: "team/renamed",
  });
  assert.equal(sentPermissionTag, null, "無効なタグは次の権限照会へ渡さない");
  permission = "none";
  assert.deepEqual(await observe(target), {
    permission: "none",
    repositoryName: "team/renamed",
  });
  missingPermission = true;
  assert.equal(await observe(target), "unavailable");
  missingPermission = false;
  accountName = "now-renamed";
  assert.deepEqual(await observe(target), {
    permission: "none",
    repositoryName: "team/renamed",
  });
  assert.equal(nameReads, 2, "旧名が使えないなら安定IDから名前を引き直す");
  accountId = 52;
  assert.equal(await observe(target), "unavailable");
  assert.equal(nameReads, 2, "利用者名のキャッシュで別人の権限を受け付けない");
  accountId = 51;
  repoId = 999;
  assert.equal(await observe(target), "unavailable");
  assert.equal(nameReads, 3, "ID不一致後は利用者名を引き直す");
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
  const afterNameExpiry = t.mock.method(
    Date,
    "now",
    () => now + 5 * 60_000 + 1,
  );
  try {
    assert.deepEqual(await observe(target), {
      permission: "none",
      repositoryName: "team/renamed",
    });
    assert.equal(minted, 1);
    assert.equal(nameReads, 4, "5分を超えた利用者名だけを取り直す");
  } finally {
    afterNameExpiry.mock.restore();
  }
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
  }).createLinkFlow(new URL("http://127.0.0.1:1234/api/session/git/callback"));
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

test("GitHubの同じ要求内だけインストールとリポジトリのページを共有する", async (t) => {
  const fetched: string[] = [];
  t.mock.method(globalThis, "fetch", (url: URL) => {
    fetched.push(url.pathname + url.search);
    if (url.pathname === "/user/installations") return installation("write");
    return Response.json({
      total_count: 2,
      repositories: [
        {
          id: 92,
          full_name: "Team/Project",
          permissions: { pull: true, push: true },
        },
        {
          id: 93,
          full_name: "Team/Other",
          permissions: { pull: true, push: false },
        },
      ],
    });
  });
  const observe = fixtureHost.createAccessObservation?.(target.userAccessToken);
  assert.ok(observe);
  assert.deepEqual(await observe(target), {
    status: "allowed",
    read: true,
    write: true,
    name: "team/project",
  });
  assert.deepEqual(
    await observe({
      ...target,
      reference: { ...target.reference, repositoryId: "93" },
    }),
    {
      status: "allowed",
      read: true,
      write: false,
      name: "team/other",
    },
  );
  const paths = [
    "/user/installations?per_page=100&page=1",
    "/user/installations/24/repositories?per_page=100&page=1",
  ];
  assert.deepEqual(fetched, paths);
  assert.deepEqual(await observe({ ...target, isCurrent: () => false }), {
    status: "unavailable",
  });
  assert.deepEqual(await observe({ ...target, userAccessToken: "another" }), {
    status: "unavailable",
  });
  assert.deepEqual(fetched, paths);
  const observeNext = fixtureHost.createAccessObservation?.(
    target.userAccessToken,
  );
  assert.ok(observeNext);
  assert.equal((await observeNext(target)).status, "allowed");
  assert.deepEqual(fetched, [...paths, ...paths]);
});

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
  assert.equal(expiring, reference);
  assert.ok(expiring);
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

test("同じGitホスト連携を200回更新しても別利用者と開始済み実行を妨げない", (t) => {
  const links = createGitHostLinks();
  t.after(links.close);
  const owner = { userId: "user.fixture", bindingId: "binding.fixture" };
  const linked = { accountId: "51", expiresAt: Date.now() + 60_000 };
  const first = links.save(owner, { ...linked, accessToken: "original" });
  assert.ok(first);
  const running = links.open(first, owner);
  assert.ok(running);
  t.after(running.close);
  for (let index = 0; index < 200; index++)
    assert.equal(
      links.save(owner, { ...linked, accessToken: `token-${index}` }),
      first,
    );
  assert.equal(links.read(first, owner), "token-199");
  assert.equal(running.revocationSignal.aborted, false);
  const other = { userId: "other", bindingId: owner.bindingId };
  const next = links.save(other, { ...linked, accessToken: "other" });
  assert.ok(next);
  assert.notEqual(next, first);
  assert.equal(links.read(next, owner), null);
  assert.equal(links.read(next, other), "other");
  links.signOut(owner.userId);
  assert.equal(links.read(first, owner), null);
  assert.equal(running.revocationSignal.aborted, false);
  assert.equal(
    links.save(owner, { ...linked, accessToken: "reconnected" }),
    first,
  );
  links.disconnect(first, owner);
  assert.equal(running.revocationSignal.aborted, true);
  assert.equal(links.read(first, owner), null);
  assert.notEqual(links.save(owner, { ...linked, accessToken: "new" }), first);
  links.close();
  assert.equal(links.read(next, other), null);
});

test("Gitホスト連携の容量整理はブラウザー・同意・実行が参照する記録を保全する", (t) => {
  const grantReferences = new Set<string>();
  const links = createGitHostLinks(() => grantReferences);
  t.after(links.close);
  const expiresAt = Date.now() + 60_000;
  const create = (
    userId: string,
    accountId: string,
    protectedByBrowser?: Set<string>,
  ) =>
    links.save(
      { userId, bindingId: "binding" },
      { accountId, expiresAt, accessToken: accountId },
      () => protectedByBrowser ?? new Set(),
    );
  const browser = create("browser", "1");
  const grant = create("grant", "2");
  const execution = create("execution", "3");
  const victim = create("victim", "4");
  assert.ok(browser && grant && execution && victim);
  grantReferences.add(grant);
  const running = links.open(execution, {
    userId: "execution",
    bindingId: "binding",
  });
  assert.ok(running);
  t.after(running.close);
  const browserReferences = new Set([browser]);
  for (let index = 4; index < 128; index++)
    assert.ok(create(`other-${index}`, "5"));
  assert.ok(create("next", "6", browserReferences));
  const read = (id: string, userId: string) =>
    links.read(id, { userId, bindingId: "binding" });
  assert.equal(read(browser, "browser"), "1");
  assert.equal(read(grant, "grant"), "2");
  assert.equal(read(victim, "victim"), null);
  assert.equal(running.revocationSignal.aborted, false);

  // 自分の上限に達しても、他利用者の空き枠を使ったり他人の連携を追い出したりしない。
  const own = new Set<string>();
  for (let index = 0; index < 8; index++) {
    const reference = create("bounded", `account-${index}`, own);
    assert.ok(reference);
    own.add(reference);
  }
  assert.equal(create("bounded", "ninth", own), null);
  const first = [...own][0];
  assert.ok(first);
  own.delete(first);
  assert.ok(create("bounded", "ninth", own));
  assert.equal(read(first, "bounded"), null);
  assert.equal(read(grant, "grant"), "2");
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
  links.disconnect(reference, owner);
  assert.equal(execution.revocationSignal.aborted, true);
});

test("ログアウト後も元の本人・Gitアカウントを指定した明示解除は実行へ届く", async (t) => {
  const links = createGitHostLinks(undefined, async () => true);
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
  assert.equal(await links.signOut(owner.userId), true);
  assert.equal(links.read(first, owner), null);
  assert.equal(running.revocationSignal.aborted, false);
  const other = links.save(owner, {
    ...linked,
    accountId: "fixture:other",
    accessToken: "other",
  });
  assert.ok(other);
  assert.equal(await links.disconnect(other, owner), "revoked");
  assert.equal(running.revocationSignal.aborted, false);
  const same = links.save(owner, { ...linked, accessToken: "renewed" });
  assert.ok(same);
  assert.equal(await links.disconnect(same, owner), "revoked");
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
