/**
 * 共有MCP向けのOAuth発行・照会の境界を構成する。
 * @trace ARCH-000012
 * @boundary 発行側は標準の認可サーバー。MCP側は発行側のCookieや保存実体を参照しない。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { matchesSecret } from "../secret.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import Provider, {
  type AdapterFactory,
  type AdapterPayload,
  type ClientMetadata,
  type Configuration,
  errors,
} from "oidc-provider";
import * as oidc from "openid-client";
import {
  readActionForm,
  sendResponseBody,
  setResponseHeaders,
} from "./api-http.ts";
import type { createClientSessionHandler } from "./api-session.ts";
import type { PublicLoginProvider } from "./login-providers.ts";
import { readMcpAccountSubject } from "./mcp-types.ts";

export const mcpScope = "mcp:access";

const maximumActive = 2_048;
const maximumPending = 256;
const maximumLifetimeSeconds = 30 * 60;
const interactionLifetimeSeconds = 300;
const maximumRecordBytes = 32 * 1_024;

/** 認可途中の枠を分け、確定済みの認可は上限でも追い出さない。 @trace ARCH-000012 */
export function createMcpOAuthState() {
  type Record = {
    kind: string;
    payload: AdapterPayload;
    expiresAt: number;
    hostReferences?: ReadonlyMap<string, string>;
  };
  const state = new Map<string, Record>();
  const pending = new Map<string, Record>();
  const stored = (key: string) => state.get(key) ?? pending.get(key);
  const forget = (key: string) => {
    state.delete(key);
    pending.delete(key);
  };
  function* records() {
    yield* state;
    yield* pending;
  }
  const isPending = (kind: string, payload: AdapterPayload) =>
    kind === "Interaction" ||
    kind === "PushedAuthorizationRequest" ||
    (kind === "Session" &&
      !Object.entries(payload.authorizations ?? {}).some(
        ([clientId, authorization]) => {
          if (!payload.accountId || !authorization.grantId) return false;
          const grant = state.get(`Grant:${authorization.grantId}`);
          return (
            grant !== undefined &&
            grant.expiresAt > Date.now() &&
            grant.payload.accountId === payload.accountId &&
            grant.payload.clientId === clientId
          );
        },
      ));
  // ログアウトとの競合だけを追跡し、終了した要求の記録は残さない。
  type RequestSubjects = {
    observed: Set<string>;
    revoked: Set<string>;
    pendingRecords: Set<string>;
    pendingSessionKeys: Map<string, string>;
  };
  const requestSubjects = new AsyncLocalStorage<RequestSubjects>();
  const active = new Set<RequestSubjects>();
  const userIdOf = (subject: unknown) =>
    typeof subject === "string"
      ? readMcpAccountSubject(subject)?.userId
      : undefined;
  const relatedGrants = (payload: AdapterPayload) => [
    payload.grantId,
    payload.result?.consent?.grantId,
    payload.lastSubmission?.consent?.grantId,
  ];
  const directUsers = (payload: AdapterPayload) =>
    [
      payload.accountId,
      payload.session?.accountId,
      payload.result?.login?.accountId,
      payload.lastSubmission?.login?.accountId,
    ].flatMap((subject) => userIdOf(subject) ?? []);
  const observeUser = (userId: string) => {
    const request = requestSubjects.getStore();
    request?.observed.add(userId);
    return request?.revoked.has(userId) !== true;
  };
  const stillAuthorized = (payload: AdapterPayload, writing = false) => {
    if (!directUsers(payload).every(observeUser)) return false;
    for (const grantId of relatedGrants(payload)) {
      if (grantId === undefined) continue;
      const grant = state.get(`Grant:${grantId}`);
      if (
        writing &&
        requestSubjects.getStore() &&
        (!grant || grant.expiresAt <= Date.now())
      )
        return false;
      if (grant && !directUsers(grant.payload).every(observeUser)) return false;
    }
    return true;
  };
  const adapter: AdapterFactory = (kind) => {
    const key = (id: string) => `${kind}:${id}`;
    const remember = (recordKey: string, payload: AdapterPayload) => {
      const request = requestSubjects.getStore();
      request?.pendingRecords.add(recordKey);
      if (kind === "Session" && payload.uid)
        request?.pendingSessionKeys.set(payload.uid, recordKey);
    };
    const lookup = (id: string) => {
      const record = stored(key(id));
      if (!record || record.expiresAt > Date.now()) return record;
      forget(key(id));
      return undefined;
    };
    const findField = (field: "uid" | "userCode", value: string) => {
      const now = Date.now();
      for (const [recordKey, record] of records()) {
        if (
          record.kind === kind &&
          record.expiresAt > now &&
          record.payload[field] === value &&
          stillAuthorized(record.payload)
        ) {
          if (pending.has(recordKey)) remember(recordKey, record.payload);
          return structuredClone(record.payload);
        }
      }
      return undefined;
    };
    return {
      async upsert(id, payload, ttl) {
        if (!stillAuthorized(payload, true))
          throw new Error("mcp_oauth_account_logged_out");
        if (
          typeof ttl !== "number" ||
          !Number.isSafeInteger(ttl) ||
          ttl < 1 ||
          ttl > maximumLifetimeSeconds
        )
          throw new Error("mcp_oauth_state_lifetime_invalid");
        if (Buffer.byteLength(JSON.stringify(payload)) > maximumRecordBytes)
          throw new Error("mcp_oauth_state_record_limit");
        const recordKey = key(id);
        const now = Date.now();
        const previous = lookup(id);
        const request = requestSubjects.getStore();
        const priorSessionKey =
          kind === "Session" && payload.uid
            ? request?.pendingSessionKeys.get(payload.uid)
            : undefined;
        if (
          (request?.pendingRecords.has(recordKey) && !previous) ||
          (priorSessionKey &&
            priorSessionKey !== recordKey &&
            (stored(priorSessionKey)?.expiresAt ?? 0) <= now)
        )
          throw new Error("mcp_oauth_interaction_unavailable");
        const beforeConsent = isPending(kind, payload);
        const bucket = beforeConsent ? pending : state;
        const limit = beforeConsent ? maximumPending : maximumActive;
        if (bucket.size >= limit && !bucket.has(recordKey)) {
          for (const [entry, record] of bucket)
            if (record.expiresAt <= now) bucket.delete(entry);
          if (bucket.size >= limit) {
            if (!beforeConsent) throw new Error("mcp_oauth_state_capacity");
            const oldest = pending.keys().next().value;
            if (oldest !== undefined) pending.delete(oldest);
          }
        }
        // 認可コード等の消費は同一プロセス内で、awaitを挟まずに確定する。
        if (kind === "ReplayDetection" && previous)
          throw new Error("mcp_oauth_replay");
        const owned = structuredClone(payload);
        if (previous?.payload.consumed)
          owned.consumed = previous.payload.consumed;
        (beforeConsent ? state : pending).delete(recordKey);
        bucket.set(recordKey, {
          kind,
          payload: owned,
          expiresAt: now + ttl * 1_000,
          ...(kind === "Grant" &&
          previous?.payload.accountId === owned.accountId &&
          previous?.payload.clientId === owned.clientId &&
          previous?.hostReferences
            ? { hostReferences: previous.hostReferences }
            : {}),
        });
        if (beforeConsent) remember(recordKey, owned);
      },
      async find(id) {
        const record = lookup(id);
        if (record && pending.has(key(id))) remember(key(id), record.payload);
        return record && stillAuthorized(record.payload)
          ? structuredClone(record.payload)
          : undefined;
      },
      async findByUid(uid) {
        return findField("uid", uid);
      },
      async findByUserCode(userCode) {
        return findField("userCode", userCode);
      },
      async consume(id) {
        const record = lookup(id);
        if (
          !record ||
          !stillAuthorized(record.payload) ||
          record.payload.consumed
        )
          throw new Error("mcp_oauth_state_already_consumed");
        record.payload.consumed = Math.floor(Date.now() / 1_000);
      },
      async destroy(id) {
        if (kind === "Session") {
          const known = lookup(id)?.payload.uid;
          const request = requestSubjects.getStore();
          // oidc-providerが存続中の旧IDを明示破棄する場合だけ、同じUIDのID振替を許す。
          if (known && request?.pendingSessionKeys.get(known) === key(id))
            request.pendingSessionKeys.delete(known);
        }
        forget(key(id));
      },
      async revokeByGrantId(grantId) {
        for (const [recordKey, record] of records())
          if (record.kind === kind && record.payload.grantId === grantId)
            forget(recordKey);
      },
    };
  };
  const currentGrant = (token: string, subject: string) => {
    const userId = userIdOf(subject);
    const now = Date.now();
    const access = state.get(`AccessToken:${token}`);
    const grantId = access?.payload.grantId;
    const grant = grantId && state.get(`Grant:${grantId}`);
    if (
      !userId ||
      !access ||
      access.expiresAt <= now ||
      access.payload.accountId !== subject ||
      !grantId ||
      !grant ||
      grant.expiresAt <= now ||
      grant.payload.accountId !== subject
    )
      return undefined;
    return grant;
  };
  return Object.assign(adapter, {
    /** 照会済みのトークンと同意が、受付時点でまだ有効か確認する。 */
    hasCurrentToken(token: string, subject: string) {
      return currentGrant(token, subject) !== undefined;
    },
    bindGrantHosts(
      grantId: string,
      subject: string,
      references: ReadonlyMap<string, string>,
    ) {
      const grant = state.get(`Grant:${grantId}`);
      if (
        !grant ||
        grant.expiresAt <= Date.now() ||
        grant.payload.accountId !== subject ||
        grant.hostReferences ||
        !stillAuthorized(grant.payload)
      )
        return false;
      grant.hostReferences = new Map(references);
      return true;
    },
    readGrantHostReference(token: string, subject: string, host: string) {
      return currentGrant(token, subject)?.hostReferences?.get(host) ?? null;
    },
    observeSubject(subject: string) {
      const userId = userIdOf(subject);
      return userId !== undefined && observeUser(userId);
    },
    async runRequest<T>(handle: () => Promise<T>): Promise<T> {
      const request = {
        observed: new Set<string>(),
        revoked: new Set<string>(),
        pendingRecords: new Set<string>(),
        pendingSessionKeys: new Map<string, string>(),
      };
      active.add(request);
      try {
        return await requestSubjects.run(request, handle);
      } finally {
        active.delete(request);
      }
    },
    invalidateUser(userId: string) {
      for (const request of active)
        if (request.observed.has(userId)) request.revoked.add(userId);
      const grants = new Set<string>();
      for (const [key, record] of records())
        if (
          record.kind === "Grant" &&
          directUsers(record.payload).includes(userId)
        )
          grants.add(key.slice("Grant:".length));
      for (const [key, record] of records())
        if (
          directUsers(record.payload).includes(userId) ||
          relatedGrants(record.payload).some(
            (id) => id !== undefined && grants.has(id),
          )
        )
          forget(key);
    },
  });
}

const accessTokenSeconds = 300;
const bearerPattern = /^[A-Za-z0-9._~+/-]{1,4096}={0,2}$/u;
const interactionPath = /^\/api\/session\/mcp\/([A-Za-z0-9_-]{1,128})$/u;
const issuerRoutes = Object.freeze({
  authorization: "/oauth/authorize",
  token: "/oauth/token",
  introspection: "/oauth/introspect",
  revocation: "/oauth/revoke",
  jwks: "/oauth/jwks",
});

function httpsOrLoopback(url: URL) {
  return (
    (url.protocol === "https:" ||
      (url.protocol === "http:" && url.hostname === "127.0.0.1")) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
}

/** 指定された認可サーバーだけをMCPの発行先として案内する。 @trace ARCH-000012 */
export function createMcpResourceMetadata(resource: URL, issuer: URL) {
  if (
    !httpsOrLoopback(resource) ||
    resource.pathname !== "/mcp" ||
    !httpsOrLoopback(issuer)
  )
    throw new Error("mcp_oauth_configuration_invalid");
  const metadata = new URL(
    `/.well-known/oauth-protected-resource${resource.pathname}`,
    resource,
  );
  return {
    metadata,
    document: {
      resource: resource.href,
      authorization_servers: [issuer.href],
      scopes_supported: [mcpScope],
      bearer_methods_supported: ["header"],
    },
  };
}

/** CRDDに組み込む発行側。Googleログイン・同意画面は構成側の明示接続が必要。 @trace ARCH-000012 */
export function createMcpOAuthProvider(
  input: {
    issuer: URL;
    resource: URL;
    clients: readonly { id: string; redirects: readonly string[] }[];
    verifier: Readonly<{ id: string; secret: string }>;
    jwks: NonNullable<Configuration["jwks"]>;
    cookieKeys: readonly string[];
  },
  state = createMcpOAuthState(),
) {
  createMcpResourceMetadata(input.resource, input.issuer);
  if (
    input.issuer.pathname !== "/" ||
    input.issuer.origin !== input.resource.origin ||
    !input.verifier.id ||
    input.verifier.secret.length < 32 ||
    !input.cookieKeys.length ||
    input.cookieKeys.some((key) => key.length < 32) ||
    !input.clients.length ||
    input.clients.some((client) => client.id === input.verifier.id)
  )
    throw new Error("mcp_oauth_configuration_invalid");
  const verifierId = input.verifier.id;
  const audience = input.resource.href;
  return new Provider(input.issuer.href, {
    adapter: state,
    jwks: input.jwks,
    clients: [
      ...input.clients.map<ClientMetadata>(({ id, redirects }) => ({
        client_id: id,
        redirect_uris: [...redirects],
        application_type: "native" as const,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      })),
      {
        client_id: verifierId,
        client_secret: input.verifier.secret,
        token_endpoint_auth_method: "client_secret_basic",
        grant_types: [],
        response_types: [],
      },
    ],
    cookies: { keys: [...input.cookieKeys] },
    responseTypes: ["code"],
    ttl: {
      Interaction: interactionLifetimeSeconds,
      Session: 1800,
      Grant: 1800,
      AuthorizationCode: 90,
      AccessToken: accessTokenSeconds,
    },
    pkce: { required: () => true },
    // SubjectにはCRDD利用者IDとその外部ログイン結合IDだけを渡す。
    findAccount: (_context, id) => ({
      accountId: id,
      claims: () => ({ sub: id }),
    }),
    routes: issuerRoutes,
    interactions: {
      url: (_context, interaction) => `/api/session/mcp/${interaction.uid}`,
    },
    features: {
      devInteractions: { enabled: false },
      userinfo: { enabled: false },
      rpInitiatedLogout: { enabled: false },
      introspection: {
        enabled: true,
        allowedPolicy: (_context, client) => client.clientId === verifierId,
      },
      revocation: {
        enabled: true,
        allowedPolicy: (_context, client, token) =>
          client.clientId === token.clientId,
      },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => audience,
        useGrantedResource: () => true,
        getResourceServerInfo: (_context, requested) => {
          if (requested !== audience) throw new errors.InvalidTarget();
          return {
            scope: mcpScope,
            audience,
            accessTokenFormat: "opaque",
            accessTokenTTL: accessTokenSeconds,
          };
        },
      },
    },
  });
}

/**
 * メタデータと発行ルートを、既存Listenerに載せる受付を作る。
 * @precondition proxy構成では、既存の信頼済みTLS終端だけが転送Headerを設定する。
 * @security 発行ルートを明示列挙し、WorkbenchやMCP本体にフォールスルーさせない。
 * @concurrency Listener側のHTTP要求Ownerが終了まで待機する。
 * @trace ARCH-000012
 */
export function createMcpOAuthEndpoint(
  provider: Provider,
  resource: URL,
  interact: (
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => Promise<void>,
  state?: ReturnType<typeof createMcpOAuthState>,
) {
  const issuer = new URL(provider.issuer);
  const { metadata, document } = createMcpResourceMetadata(resource, issuer);
  const knownPaths = new Set<string>([
    ...Object.values(issuerRoutes),
    metadata.pathname,
    "/.well-known/oauth-authorization-server",
    "/.well-known/openid-configuration",
  ]);
  const resumePath = /^\/oauth\/authorize\/[A-Za-z0-9_-]{1,128}$/u;
  provider.proxy = issuer.protocol === "https:";
  const receive = provider.callback();
  const pathname = (raw: string | undefined) => raw?.split("?", 1)[0] ?? "";
  return Object.freeze({
    metadata,
    matches(raw: string | undefined) {
      const path = pathname(raw);
      return (
        knownPaths.has(path) ||
        interactionPath.test(path) ||
        resumePath.test(path)
      );
    },
    async handle(
      request: IncomingMessage,
      response: ServerResponse,
      signal: AbortSignal,
    ) {
      const path = pathname(request.url);
      const configuredHeader = (name: string, value: string) => {
        const actual = request.headersDistinct[name];
        return actual?.length === 1 && actual[0] === value;
      };
      const reject = (status: number) =>
        sendResponseBody(
          response,
          "text/plain; charset=utf-8",
          "oauth_request_rejected\n",
          false,
          status,
        );
      if (
        !configuredHeader("host", issuer.host) ||
        (provider.proxy &&
          (!configuredHeader("x-forwarded-proto", "https") ||
            !configuredHeader("x-forwarded-host", issuer.host))) ||
        (request.headersDistinct.origin !== undefined &&
          !configuredHeader("origin", issuer.origin))
      )
        return reject(421);
      if (signal.aborted || response.destroyed) return;
      setResponseHeaders(response);
      if (path === metadata.pathname) {
        if (request.method !== "GET" || request.url !== path)
          return reject(405);
        return sendResponseBody(
          response,
          "application/json; charset=utf-8",
          JSON.stringify(document),
        );
      }
      if (
        !knownPaths.has(path) &&
        !resumePath.test(path) &&
        !interactionPath.test(path)
      )
        return reject(404);
      const handle = async () => {
        if (interactionPath.test(path))
          return interact(request, response, signal);
        await receive(request, response);
      };
      await (state ? state.runRequest(handle) : handle());
    },
  });
}

const escaped = (value: string) =>
  value.replace(
    /[&<>"]/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character] ?? "",
  );

/** 現在のブラウザー本人確認と明示的なMCP利用同意を、発行側へ一度ずつ渡す。 @trace ARCH-000012 */
export function createMcpOAuthInteraction(
  provider: Provider,
  resource: URL,
  browser: Pick<
    ReturnType<typeof createClientSessionHandler>,
    "readCurrent" | "begin"
  >,
  loginProviders: readonly PublicLoginProvider[],
  readMcpReferences?: (request: IncomingMessage) => ReadonlyMap<string, string>,
  state?: ReturnType<typeof createMcpOAuthState>,
) {
  const origin = new URL(provider.issuer).origin;
  const loginActions = new Map<string, PublicLoginProvider>(
    loginProviders.map(
      ({ id, displayName }) => [`login:${id}`, { id, displayName }] as const,
    ),
  );
  const unavailable = (response: ServerResponse, status: number) =>
    sendResponseBody(
      response,
      "text/plain; charset=utf-8",
      "oauth_interaction_unavailable\n",
      false,
      status,
    );
  const active = new Set<string>();
  const displayed = new Map<
    string,
    {
      subject: string;
      confirmation: string;
      references: ReadonlyMap<string, string>;
      expiresAt: number;
    }
  >();
  const sameReferences = (
    a: ReadonlyMap<string, string>,
    b: ReadonlyMap<string, string>,
  ) =>
    a.size === b.size &&
    [...a.entries()].every(([host, ref]) => b.get(host) === ref);
  const handle = async (
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const path = request.url ?? "";
    const matched = interactionPath.exec(path);
    const method = request.method;
    if (!matched || (method !== "GET" && method !== "POST"))
      return unavailable(response, 400);
    if (
      method === "POST" &&
      (request.headersDistinct.origin?.length !== 1 ||
        request.headers.origin !== origin)
    )
      return unavailable(response, 403);
    let action: string | null = null;
    let confirmation: string | null = null;
    let details: Awaited<ReturnType<Provider["interactionDetails"]>>;
    try {
      if (method === "POST") {
        const form = await readActionForm(request, 512);
        action = form.get("action");
        confirmation = form.get("confirmation");
        const decision = action === "allow" || action === "deny";
        if (
          [...form.keys()].length !== (decision ? 2 : 1) ||
          !action ||
          (decision
            ? !confirmation || !/^[A-Za-z0-9_-]{43}$/u.test(confirmation)
            : !loginActions.has(action))
        )
          return unavailable(response, 400);
      }
      if (signal.aborted || response.destroyed) return;
      details = await provider.interactionDetails(request, response);
    } catch {
      if (!signal.aborted && !response.destroyed) unavailable(response, 403);
      return;
    }
    if (signal.aborted || response.destroyed) return;
    if (
      details.uid !== matched[1] ||
      details.result ||
      typeof details.params.client_id !== "string"
    )
      return unavailable(response, 403);

    const account = browser.readCurrent(request);
    if (account.status === "unavailable") return unavailable(response, 503);
    const current = account.status === "completed" ? account.account : null;
    const subject = current && `${current.userId}:${current.bindingId}`;
    if (
      subject &&
      (!readMcpAccountSubject(subject) ||
        state?.observeSubject(subject) === false)
    )
      return unavailable(response, 403);
    const page = (content: string) =>
      sendResponseBody(
        response,
        "text/html; charset=utf-8",
        `<!doctype html><html lang="ja"><meta charset="utf-8"><title>MCP 接続の確認</title><h1>MCP 接続の確認</h1>${content}</html>`,
      );
    const form = (buttons: string) =>
      `<form method="post" action="${escaped(path)}">${buttons}</form>`;
    const button = (value: string, label: string) =>
      `<button name="action" value="${escaped(value)}">${escaped(label)}</button>`;

    if (details.prompt.name === "login") {
      const selected = action && loginActions.get(action);
      if (method === "POST" && !selected) return unavailable(response, 400);
      if (!subject) {
        if (selected)
          return browser.begin(selected.id, request, response, signal, path);
        return page(
          form(
            Array.from(loginActions, ([value, { displayName }]) =>
              button(value, `${displayName}でログイン`),
            ).join(""),
          ),
        );
      }
      await provider.interactionFinished(request, response, {
        login: { accountId: subject, remember: false },
      });
      return;
    }
    if (
      details.prompt.name !== "consent" ||
      !current ||
      !subject ||
      details.session?.accountId !== subject
    )
      return unavailable(response, 403);
    const references =
      readMcpReferences?.(request) ?? new Map<string, string>();
    if (method === "GET") {
      const now = Date.now();
      for (const [uid, pending] of displayed)
        if (pending.expiresAt <= now) displayed.delete(uid);
      if (!displayed.has(details.uid) && displayed.size >= maximumPending) {
        const oldest = displayed.keys().next().value;
        if (oldest !== undefined) displayed.delete(oldest);
      }
      const proof = randomBytes(32).toString("base64url");
      displayed.set(details.uid, {
        subject,
        confirmation: proof,
        references: new Map(references),
        expiresAt: now + interactionLifetimeSeconds * 1_000,
      });
      const consentForm = form(
        `<input type="hidden" name="confirmation" value="${proof}">${button("allow", "許可する")}${button("deny", "許可しない")}`,
      );
      return page(
        `<p>${escaped(current.username)} として、${escaped(details.params.client_id)} にMCP接続を許可しますか？ CRDDの権限に応じて内容の閲覧・変更や実行の操作ができます。管理情報は権限がある場合に閲覧できますが、MCPから変更はできません。</p>${references.size ? "<p>この接続には現在のGitホスト連携も使います。連携が必要なリポジトリでは、閲覧・変更にGitホスト側の権限も必要です。</p>" : ""}${consentForm}`,
      );
    }
    const shown = displayed.get(details.uid);
    if (
      !shown ||
      !confirmation ||
      shown.subject !== subject ||
      shown.expiresAt <= Date.now() ||
      !matchesSecret(confirmation, shown.confirmation)
    )
      return unavailable(response, 403);
    displayed.delete(details.uid);
    if (action === "deny") {
      await provider.interactionFinished(request, response, {
        error: "access_denied",
      });
      return;
    }
    if (action !== "allow") return unavailable(response, 400);
    if (!sameReferences(shown.references, references))
      return unavailable(response, 403);
    const grant = new provider.Grant({
      accountId: subject,
      clientId: details.params.client_id,
    });
    grant.addResourceScope(resource.href, mcpScope);
    const grantId = await grant.save();
    const fresh = browser.readCurrent(request);
    if (
      signal.aborted ||
      response.destroyed ||
      fresh.status !== "completed" ||
      fresh.account.userId !== current.userId ||
      fresh.account.bindingId !== current.bindingId ||
      !sameReferences(readMcpReferences?.(request) ?? new Map(), references) ||
      (state
        ? !state.bindGrantHosts(grantId, subject, references)
        : references.size > 0)
    ) {
      await grant.destroy();
      if (!signal.aborted && !response.destroyed)
        unavailable(response, fresh.status === "unavailable" ? 503 : 403);
      return;
    }
    await provider.interactionFinished(
      request,
      response,
      { consent: { grantId } },
      { mergeWithLastSubmission: true },
    );
  };
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const uid = interactionPath.exec(request.url ?? "")?.[1];
    if (!uid || active.has(uid)) return unavailable(response, uid ? 409 : 400);
    active.add(uid);
    try {
      await handle(request, response, signal);
    } finally {
      active.delete(uid);
    }
  };
}

/** 標準のトークン照会だけを使い、発行側のストアへ依存しない。 @trace ARCH-000012 */
export async function createMcpTokenVerifier(input: {
  issuer: URL;
  resource: URL;
  clientId: string;
  clientSecret: string;
}) {
  createMcpResourceMetadata(input.resource, input.issuer);
  const audience = input.resource.href;
  const expectedIssuer = input.issuer.href;
  let configuration: oidc.Configuration;
  let issuer: string;
  try {
    configuration = await oidc.discovery(
      input.issuer,
      input.clientId,
      undefined,
      oidc.ClientSecretBasic(input.clientSecret),
      {
        timeout: 5,
        ...(input.issuer.protocol === "http:"
          ? { execute: [oidc.allowInsecureRequests] }
          : {}),
      },
    );
    const metadata = configuration.serverMetadata();
    configuration.timeout = 5;
    issuer = metadata.issuer;
    if (
      new URL(issuer).href !== expectedIssuer ||
      !metadata.introspection_endpoint ||
      !httpsOrLoopback(new URL(metadata.introspection_endpoint)) ||
      new URL(metadata.introspection_endpoint).origin !== input.issuer.origin
    )
      throw new Error("mcp_oauth_configuration_invalid");
  } catch {
    throw new Error("mcp_oauth_unavailable");
  }
  return async (token: string, signal: AbortSignal) => {
    if (signal.aborted || !bearerPattern.test(token))
      return { status: "rejected" as const };
    try {
      const result = await oidc.tokenIntrospection(configuration, token, {
        token_type_hint: "access_token",
      });
      const exactAudience =
        result.aud === audience ||
        (Array.isArray(result.aud) &&
          result.aud.length === 1 &&
          result.aud[0] === audience);
      if (
        signal.aborted ||
        !result.active ||
        result.iss !== issuer ||
        !exactAudience ||
        typeof result.token_type !== "string" ||
        result.token_type.toLowerCase() !== "bearer" ||
        typeof result.scope !== "string" ||
        !result.scope.split(" ").includes(mcpScope) ||
        typeof result.exp !== "number" ||
        !Number.isSafeInteger(result.exp) ||
        result.exp <= Math.floor(Date.now() / 1_000) ||
        typeof result.sub !== "string" ||
        !result.sub
      )
        return { status: "rejected" as const };
      return {
        status: "completed" as const,
        subject: result.sub,
        expiresAt: result.exp * 1_000,
      };
    } catch {
      return { status: "unavailable" as const };
    }
  };
}
