/**
 * 実OIDCクライアントに合成Google応答を返し、本人確認の境界を反証する。
 * @trace ARCH-000013
 * @level UT
 * @scope 実Google接続、CRDD認可および管理セッション発行は対象外。
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { createLogin } from "../../src/transport/login.ts";
import { loginProviderProfiles } from "../../src/transport/login-providers.ts";

test("外部本人確認は同じブラウザーだけ、一度だけ完了し、署名を検証する", async (t) => {
  const issuer = "https://accounts.google.com";
  const alternateIssuer = "https://login.example.test";
  const callback = new URL(
    "http://127.0.0.1:9999/api/session/login/google/callback",
  );
  const clientId = "synthetic-client";
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  let nonce: string | null = null;
  let audience = clientId;
  let corruptSignature = false;
  let verifiedEmail: boolean | undefined;
  let exchanges = 0;
  let jwksReads = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      const endpoint = new URL(url);
      const origin = endpoint.origin;
      assert.ok(origin === issuer || origin === alternateIssuer);
      switch (url) {
        case `${origin}/.well-known/openid-configuration`:
          return Response.json({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            jwks_uri: `${origin}/jwks`,
            code_challenge_methods_supported: ["S256"],
            id_token_signing_alg_values_supported: ["RS256"],
          });
        case `${origin}/token`: {
          exchanges += 1;
          assert.equal(init?.method, "POST");
          assert.ok(init.body instanceof URLSearchParams);
          assert.equal(init.body.get("redirect_uri"), callback.href);
          assert.ok(init.body.get("code_verifier"));
          const now = Math.floor(Date.now() / 1000);
          const encode = (value: object) =>
            Buffer.from(JSON.stringify(value)).toString("base64url");
          const payload = `${encode({ alg: "RS256", kid: "synthetic" })}.${encode(
            {
              iss: origin,
              sub: "google-subject",
              aud: audience,
              iat: now,
              exp: now + 120,
              nonce,
              ...(verifiedEmail === undefined
                ? {}
                : {
                    email: "developer@example.test",
                    email_verified: verifiedEmail,
                  }),
            },
          )}`;
          const signature = sign("sha256", Buffer.from(payload), privateKey);
          if (corruptSignature) signature[0] = (signature[0] ?? 0) ^ 1;
          return Response.json({
            access_token: "synthetic-access-token",
            token_type: "Bearer",
            id_token: `${payload}.${signature.toString("base64url")}`,
          });
        }
        case `${origin}/jwks`:
          jwksReads += 1;
          return Response.json({
            keys: [
              { ...publicKey.export({ format: "jwk" }), kid: "synthetic" },
            ],
          });
        default:
          throw new Error("unexpected synthetic request");
      }
    },
  );
  const login = await createLogin(loginProviderProfiles.google, {
    callback,
    clientId,
    clientSecret: "synthetic-client-secret",
  });
  const signal = new AbortController().signal;
  const start = async (invitationDigest?: string) => {
    const { location, browserBinding } = await login.start(
      "/",
      invitationDigest,
    );
    nonce = location.searchParams.get("nonce");
    const state = location.searchParams.get("state");
    assert.ok(state && nonce);
    assert.equal(
      location.searchParams.get("scope"),
      invitationDigest ? "openid email" : "openid",
    );
    if (invitationDigest)
      assert.equal(location.href.includes(invitationDigest), false);
    assert.equal(location.searchParams.get("code_challenge_method"), "S256");
    assert.equal(location.searchParams.has("client_secret"), false);
    assert.equal(location.searchParams.has("access_type"), false);
    return {
      browserBinding,
      reply: new URLSearchParams({ state, code: "synthetic-code" }),
    };
  };
  const first = await start();
  assert.equal(await login.complete(first.reply, undefined, signal), null);
  assert.equal(
    await login.complete(first.reply, "other-browser", signal),
    null,
  );
  const sameLengthWrongBinding =
    (first.browserBinding.startsWith("a") ? "b" : "a") +
    first.browserBinding.slice(1);
  assert.equal(
    await login.complete(first.reply, sameLengthWrongBinding, signal),
    null,
  );
  const duplicate = new URLSearchParams(first.reply);
  duplicate.append("state", "other-state");
  assert.equal(
    await login.complete(duplicate, first.browserBinding, signal),
    null,
  );
  assert.equal(exchanges, 0);

  const accepted = login.complete(first.reply, first.browserBinding, signal);
  assert.equal(
    await login.complete(first.reply, first.browserBinding, signal),
    null,
  );
  assert.deepEqual(await accepted, {
    identity: { issuer, subject: "google-subject" },
    returnTo: "/",
  });
  assert.equal(exchanges, 1);
  assert.equal(jwksReads, 1);

  const tampered = await start();
  corruptSignature = true;
  assert.equal(
    await login.complete(tampered.reply, tampered.browserBinding, signal),
    null,
  );
  assert.equal(exchanges, 2);

  corruptSignature = false;
  const wrongAudience = await start();
  audience = "other-client";
  assert.equal(
    await login.complete(
      wrongAudience.reply,
      wrongAudience.browserBinding,
      signal,
    ),
    null,
  );
  assert.equal(exchanges, 3);

  audience = clientId;
  const wrongNonce = await start();
  nonce = "unrelated-nonce";
  assert.equal(
    await login.complete(wrongNonce.reply, wrongNonce.browserBinding, signal),
    null,
  );
  assert.equal(exchanges, 4);

  const digest = "a".repeat(64);
  verifiedEmail = false;
  const unverified = await start(digest);
  assert.equal(
    await login.complete(unverified.reply, unverified.browserBinding, signal),
    null,
  );
  verifiedEmail = true;
  const invited = await start(digest);
  assert.deepEqual(
    await login.complete(invited.reply, invited.browserBinding, signal),
    {
      identity: { issuer, subject: "google-subject" },
      returnTo: "/",
      invitation: {
        digest,
        email: "developer@example.test",
        emailVerified: true,
      },
    },
  );

  const expired = await start();
  const cancelled = new AbortController();
  cancelled.abort();
  assert.equal(
    await login.complete(
      expired.reply,
      expired.browserBinding,
      cancelled.signal,
    ),
    null,
  );
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 5 * 60_000 + 1);
  assert.equal(
    await login.complete(expired.reply, expired.browserBinding, signal),
    null,
  );
  assert.equal(exchanges, 6);
  const oldest = await start();
  for (let index = 0; index < 127; index++) await login.start();
  const newest = await start();
  assert.equal(
    await login.complete(oldest.reply, oldest.browserBinding, signal),
    null,
  );
  assert.equal(exchanges, 6);
  assert.deepEqual(
    await login.complete(newest.reply, newest.browserBinding, signal),
    {
      identity: { issuer, subject: "google-subject" },
      returnTo: "/",
    },
  );
  assert.equal(exchanges, 7);

  // 別のプロファイルを同じOIDC往復に接続し、提供元固有の判定が適用されることだけを検証する。
  let acceptsIssuer = false;
  let acceptsTenant = false;
  const alternate = await createLogin(
    {
      ...loginProviderProfiles.google,
      id: "fixture-provider",
      displayName: "Fixture provider",
      discoveryUrl: alternateIssuer,
      acceptsIssuer: (value) => acceptsIssuer && value === alternateIssuer,
      acceptsTenant: () => acceptsTenant,
      invitationScope: "openid email profile",
      accountSelectionPrompt: "login",
      readVerifiedEmail: () => "linked@example.test",
    },
    {
      callback,
      clientId,
      clientSecret: "synthetic-client-secret",
      chooseAccount: true,
    },
  );
  const completeAlternate = async () => {
    const { location, browserBinding } = await alternate.start("/", digest);
    nonce = location.searchParams.get("nonce");
    const state = location.searchParams.get("state");
    assert.ok(nonce && state);
    assert.equal(location.searchParams.get("prompt"), "login");
    assert.equal(location.searchParams.get("scope"), "openid email profile");
    return alternate.complete(
      new URLSearchParams({ state, code: "synthetic-code" }),
      browserBinding,
      signal,
    );
  };
  assert.equal(await completeAlternate(), null);
  acceptsIssuer = true;
  assert.equal(await completeAlternate(), null);
  acceptsTenant = true;
  assert.deepEqual(await completeAlternate(), {
    identity: { issuer: alternateIssuer, subject: "google-subject" },
    returnTo: "/",
    invitation: { digest, email: "linked@example.test", emailVerified: true },
  });
});
