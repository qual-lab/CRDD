/** 合成サービスを使う公開ログイン・Git連携試験の共通準備。外部へ要求を送らない。 */
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:net";
import type { TestContext } from "node:test";

export const testIssuer = "https://accounts.google.com";

/** 外部ネットワークを使わず、公開ログイン・Git連携から実Cookieを得る。 */
export async function prepareSharedSignIn(
  t: TestContext,
  subjects: readonly string[],
  repositories: readonly Readonly<{ id: number; full_name: string }>[],
) {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  const address = reservation.address();
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  assert.ok(address && typeof address !== "string");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const clientId = "synthetic-shared-ai";
  const nonces = new Map<string, string>();
  const localFetch = globalThis.fetch;
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      if (url.href === `${testIssuer}/.well-known/openid-configuration`)
        return Response.json({
          issuer: testIssuer,
          authorization_endpoint: `${testIssuer}/auth`,
          token_endpoint: `${testIssuer}/token`,
          jwks_uri: `${testIssuer}/jwks`,
          code_challenge_methods_supported: ["S256"],
          id_token_signing_alg_values_supported: ["RS256"],
        });
      if (url.href === `${testIssuer}/jwks`)
        return Response.json({
          keys: [
            {
              ...publicKey.export({ format: "jwk" }),
              alg: "RS256",
              kid: "fixture",
            },
          ],
        });
      if (url.href === `${testIssuer}/token`) {
        const subject =
          new URLSearchParams(String(init?.body)).get("code") ?? "";
        const nonce = nonces.get(subject);
        assert.ok(nonce);
        const iat = Math.floor(Date.now() / 1000);
        const payload = `${encode({ alg: "RS256", kid: "fixture" })}.${encode({ iss: testIssuer, sub: subject, aud: clientId, iat, exp: iat + 120, nonce })}`;
        return Response.json({
          token_type: "Bearer",
          access_token: "synthetic",
          id_token: `${payload}.${sign("sha256", Buffer.from(payload), privateKey).toString("base64url")}`,
        });
      }
      if (url.href === "https://github.com/login/oauth/access_token") {
        const subject =
          new URLSearchParams(String(init?.body)).get("code") ?? "";
        const index = subjects.indexOf(subject);
        assert.ok(index >= 0);
        return Response.json({
          token_type: "bearer",
          access_token: `ghu_fixture_${index}`,
          expires_in: 3600,
        });
      }
      if (url.origin === "https://api.github.com") {
        const auth = new Headers(init?.headers).get("authorization");
        if (url.pathname === "/app/installations/24/access_tokens") {
          const id = JSON.parse(String(init?.body)).repository_ids?.[0];
          assert.ok(repositories.some((item) => item.id === id));
          return Response.json(
            {
              token: `ghs_fixture_${id}`,
              permissions: { metadata: "read" },
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
            },
            { status: 201 },
          );
        }
        const installation = repositories.find(
          ({ id }) => auth === `Bearer ghs_fixture_${id}`,
        );
        if (installation) {
          if (url.pathname === "/installation/repositories")
            return Response.json({
              total_count: 1,
              repositories: [installation],
            });
          const id = Number(
            url.pathname.match(
              /(?:\/user\/|\/collaborators\/fixture-)(\d+)(?:\/permission)?$/u,
            )?.[1],
          );
          assert.ok(id === 73 || id === 74);
          const user = { id, login: `fixture-${id}` };
          return Response.json(
            url.pathname.startsWith("/user/")
              ? user
              : { user, permission: "write" },
          );
        }
        assert.ok(
          auth === "Bearer ghu_fixture_0" || auth === "Bearer ghu_fixture_1",
        );
        if (url.pathname === "/user")
          return Response.json({ id: auth.endsWith("0") ? 73 : 74 });
        if (url.pathname === "/user/installations")
          return Response.json({
            total_count: 1,
            installations: [
              {
                id: 24,
                account: { login: "fixture" },
                permissions: { contents: "write" },
              },
            ],
          });
        assert.equal(url.pathname, "/user/installations/24/repositories");
        return Response.json({
          total_count: repositories.length,
          repositories: repositories.map((entry) => ({
            ...entry,
            permissions: { pull: true, push: true },
          })),
        });
      }
      assert.equal(
        url.hostname,
        "127.0.0.1",
        "synthetic_oauth_external_request",
      );
      return localFetch(input, init);
    },
  );
  return {
    options: {
      port: address.port,
      loginProviders: {
        google: { clientId, clientSecret: "synthetic-secret" },
      },
      gitHosts: [
        {
          provider: "github",
          host: "github.com",
          providerData: {
            clientId,
            clientSecret: "synthetic-git-secret",
            privateKey: privateKey
              .export({ format: "pem", type: "pkcs8" })
              .toString(),
          },
        },
      ],
    },
    async signIn(base: string, subject: string) {
      const begin = async (path: string, cookie?: string) => {
        const response = await fetch(new URL(path, base), {
          method: "POST",
          redirect: "manual",
          headers: { origin: base, ...(cookie && { cookie }) },
        });
        assert.equal(response.status, 303);
        return response;
      };
      const login = await begin("/api/session/login/google");
      const authorization = new URL(login.headers.get("location") ?? "");
      const nonce = authorization.searchParams.get("nonce");
      const state = authorization.searchParams.get("state");
      const proof = login.headers.getSetCookie()[0]?.split(";")[0];
      assert.ok(nonce && state && proof);
      nonces.set(subject, nonce);
      const callback = async (path: string, proof: string, state: string) => {
        const response = await fetch(
          new URL(
            `${path}?${new URLSearchParams({ state, code: subject })}`,
            base,
          ),
          {
            headers: { cookie: proof },
            redirect: "manual",
          },
        );
        assert.equal(response.status, 303);
        return response;
      };
      const signed = await callback(
        "/api/session/login/google/callback",
        proof,
        state,
      );
      const cookie = signed.headers
        .getSetCookie()
        .find((value) => value.startsWith("crdd-client-session="))
        ?.split(";")[0];
      assert.ok(cookie);
      const git = await begin("/api/session/git/github", cookie);
      const gitState = new URL(
        git.headers.get("location") ?? "",
      ).searchParams.get("state");
      assert.ok(gitState);
      await callback("/api/session/git/github/callback", cookie, gitState);
      return cookie;
    },
  };
}
