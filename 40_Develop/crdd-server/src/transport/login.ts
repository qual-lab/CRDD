/**
 * 外部ログインから、検証済みの外部主体だけを取得する。
 * @responsibility OIDCの往復と一度限りのブラウザー相関。
 * @trace ARCH-000012
 * @boundary OIDCの検証結果は本人確認だけ。CRDDのロール・管理許可ではない。
 */
import * as oidc from "openid-client";
import { matchesSecret } from "../secret.ts";
import type { LoginProviderProfile } from "./login-providers.ts";

const loginLifetime = 5 * 60_000;
const maximumPendingLogins = 128;

type PendingLogin = Readonly<{
  browserBinding: string;
  verifier: string;
  nonce: string;
  expiresAt: number;
  returnTo: string;
  invitationDigest?: string;
}>;

/**
 * 起動時に選択した提供元とコールバックだけを使う。
 * @input Serverの非公開設定。クライアント本文・Hostヘッダーから組み立てない。
 * @returns ログインを開始し、同じブラウザーから一度だけ完了する操作。
 * @effect 提供元のメタデータ取得と、正しい相関を持つ応答のコード交換。
 * @security コード・外部トークン・秘密を結果やエラーに転記しない。
 */
export async function createLogin(
  profile: LoginProviderProfile,
  input: {
    clientId: string;
    clientSecret: string;
    callback: URL;
    chooseAccount?: true;
  },
) {
  const callback = new URL(input.callback.href);
  const loopback =
    callback.protocol === "http:" && callback.hostname === "127.0.0.1";
  if (
    (!loopback && callback.protocol !== "https:") ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash ||
    !input.clientId ||
    !input.clientSecret
  )
    throw new Error(profile.configurationError);

  let configuration: oidc.Configuration;
  try {
    configuration = await oidc.discovery(
      new URL(profile.discoveryUrl),
      input.clientId,
      input.clientSecret,
      undefined,
      { execute: [oidc.enableNonRepudiationChecks], timeout: 5 },
    );
  } catch {
    throw new Error(profile.unavailableError);
  }
  const pending = new Map<string, PendingLogin>();

  return Object.freeze({
    async start(returnTo = "/", invitationDigest?: string) {
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      const verifier = oidc.randomPKCECodeVerifier();
      const browserBinding = oidc.randomState();
      const location = oidc.buildAuthorizationUrl(configuration, {
        redirect_uri: callback.href,
        scope: invitationDigest ? profile.invitationScope : "openid",
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
        state,
        nonce,
        ...(input.chooseAccount && profile.accountSelectionPrompt
          ? { prompt: profile.accountSelectionPrompt }
          : {}),
      });
      const now = Date.now();
      for (const [key, login] of pending) {
        if (login.expiresAt <= now) pending.delete(key);
      }
      if (pending.size >= maximumPendingLogins) {
        const oldest = pending.keys().next().value;
        if (oldest !== undefined) pending.delete(oldest);
      }
      pending.set(state, {
        browserBinding,
        verifier,
        nonce,
        expiresAt: now + loginLifetime,
        returnTo,
        ...(invitationDigest ? { invitationDigest } : {}),
      });
      return { location, browserBinding };
    },

    async complete(
      search: URLSearchParams,
      browserBinding: string | undefined,
      signal: AbortSignal,
    ) {
      const ownedSearch = new URLSearchParams(search);
      const state = ownedSearch.get("state");
      if (
        signal.aborted ||
        !state ||
        new Set(ownedSearch.keys()).size !== [...ownedSearch.keys()].length
      )
        return null;
      const login = pending.get(state);
      if (!login || !matchesSecret(browserBinding, login.browserBinding))
        return null;
      // awaitより先に消費する。提供元拒否や通信失敗でも元の応答を再送しない。
      pending.delete(state);
      if (login.expiresAt <= Date.now()) return null;

      const received = new URL(callback.href);
      received.search = ownedSearch.toString();
      try {
        const tokens = await oidc.authorizationCodeGrant(
          configuration,
          received,
          {
            expectedState: state,
            expectedNonce: login.nonce,
            pkceCodeVerifier: login.verifier,
            idTokenExpected: true,
          },
        );
        const claims = tokens.claims();
        if (
          signal.aborted ||
          login.expiresAt <= Date.now() ||
          !claims ||
          typeof claims.iss !== "string" ||
          !profile.acceptsIssuer(claims.iss) ||
          profile.acceptsTenant?.(claims) === false ||
          typeof claims.sub !== "string" ||
          !claims.sub ||
          claims.sub.length > 255
        )
          return null;
        const email = login.invitationDigest
          ? profile.readVerifiedEmail(claims)
          : null;
        const invitation = login.invitationDigest
          ? email !== null
            ? {
                digest: login.invitationDigest,
                email,
                emailVerified: true as const,
              }
            : null
          : undefined;
        if (invitation === null) return null;
        return Object.freeze({
          identity: { issuer: claims.iss, subject: claims.sub },
          returnTo: login.returnTo,
          ...(invitation ? { invitation } : {}),
        });
      } catch {
        return null;
      }
    },
  });
}
