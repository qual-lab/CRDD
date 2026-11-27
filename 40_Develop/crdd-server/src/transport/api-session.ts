/**
 * 外部ログインとHTTP APIのクライアントセッションを接続する。
 * @trace ARCH-000012
 * @boundary HTTP専用。MCP資格・管理書込みの許可は発行しない。
 */
import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  AccountAccessPrincipal,
  AccessRole,
} from "@qual-lab/crdd-access-management";
import {
  clientSessionLifetimeSeconds,
  createClientSessions,
  openManagementSession,
} from "../service/access.ts";
import type {
  createGitHostLinks,
  GitHostConnection,
  ReadGitHost,
} from "../service/git-host.ts";
import {
  matchesRequestHost,
  matchesRequestOrigin,
  readActionForm,
  sendResponseBody,
  setResponseHeaders,
} from "./api-http.ts";

const sessionPath = "/api/session";
export const clientSessionPaths = Object.freeze({
  management: "/api/session/management",
  session: sessionPath,
});
export const clientLoginRoute = "/api/session/login/:provider";

export function clientLoginPaths(provider: string) {
  const login = `/api/session/login/${encodeURIComponent(provider)}`;
  return {
    login,
    invitation: `${login}/invitation`,
    callback: `${login}/callback`,
  };
}
export const gitConnectionsRoute = "/api/session/git";
export const gitConnectionRoute = `${gitConnectionsRoute}/:hostConnectionId`;
export function gitHostConnectionPaths(id: string) {
  const connection = `${gitConnectionsRoute}/${encodeURIComponent(id)}`;
  return { connection, callback: `${connection}/callback` };
}
const bindingCookie = "crdd-client-login";
const sessionCookie = "crdd-client-session";
export const managementCookie = "crdd-management-session";
const opaqueToken = /^[A-Za-z0-9_-]{43}$/u;

type VerifiedIdentity = Readonly<{ issuer: string; subject: string }>;
type InvitationProof = Readonly<{
  digest: string;
  email: string;
  emailVerified: true;
}>;
type AccountBinding = Readonly<{ userId: string; bindingId: string }>;
type AccountObservation =
  | {
      status: "completed";
      account: AccountBinding & { username: string; role: AccessRole };
    }
  | { status: "rejected" }
  | { status: "unavailable" };

function readCookie(request: IncomingMessage, name: string) {
  let value: string | undefined;
  for (const header of request.headersDistinct.cookie ?? []) {
    for (const field of header.split(";")) {
      const parameter = field.trim();
      if (!parameter.startsWith(`${name}=`)) continue;
      const candidate = parameter.slice(name.length + 1);
      if (value !== undefined || !opaqueToken.test(candidate)) return null;
      value = candidate;
    }
  }
  return value;
}

type BrowserLogin = {
  start(
    returnTo: string,
    invitationDigest?: string,
  ): Promise<{ location: URL; browserBinding: string }>;
  complete(
    search: URLSearchParams,
    browserBinding: string | undefined,
    signal: AbortSignal,
  ): Promise<{
    identity: VerifiedIdentity;
    returnTo: string;
    invitation?: InvitationProof;
  } | null>;
};

/** 固定Originへ外部ログインと短命のサーバー側セッションを登録する。 @trace ARCH-000012 */
export function createClientSessionHandler(
  origin: URL,
  logins: Readonly<Record<string, BrowserLogin>>,
  readAccount: (
    identity: VerifiedIdentity,
    session?: AccountBinding,
  ) => AccountObservation,
  gitHostOptions?: readonly {
    host: string;
    id: string;
    displayName: string;
    connection: GitHostConnection;
    links: ReturnType<typeof createGitHostLinks>;
    observePermission?: import("../service/access.ts").HostedExecutionClientAccess["observePermission"];
  }[],
  acceptInvitation?: (
    identity: VerifiedIdentity,
    proof: InvitationProof,
  ) => AccountObservation,
  invalidateMcpAccount?: (userId: string) => void,
  readGitHost: ReadGitHost = () => undefined,
  repositoryScope: import("../service/repository-scope.ts").RepositoryScope = () =>
    false,
) {
  const providers = new Map(Object.entries(logins));
  const gitHosts = new Map(gitHostOptions?.map((host) => [host.host, host]));
  const gitHostsById = new Map(gitHostOptions?.map((host) => [host.id, host]));
  if (
    gitHosts.size !== gitHostsById.size ||
    gitHosts.size !== (gitHostOptions?.length ?? 0) ||
    new Set(gitHostOptions?.map(({ links }) => links)).size !== gitHosts.size ||
    new Set(gitHostOptions?.map(({ connection }) => connection)).size !==
      gitHosts.size
  )
    throw new Error("git_host_configuration_invalid");
  const {
    sessions,
    read,
    start,
    remove: removeSession,
  } = createClientSessions((id, discarded) => {
    for (const host of gitHosts.values()) {
      host.connection.cancel(id);
      const reference = discarded?.gitHostReferences.get(host.host);
      if (reference) host.links.discard(reference);
    }
  });
  const cookie = (name: string, value: string, path: string, seconds: number) =>
    sessionCookieHeader(origin, name, value, path, seconds);
  const reject = (response: ServerResponse, status: number) =>
    sendResponseBody(
      response,
      "text/plain; charset=utf-8",
      "session_unavailable\n",
      false,
      status,
    );
  const redirect = (response: ServerResponse, location: string) => {
    setResponseHeaders(response);
    response.statusCode = 303;
    response.setHeader("Location", location);
    response.end();
  };

  const safeReturn = (path: string) =>
    path === "/" || /^\/api\/session\/mcp\/[A-Za-z0-9_-]{1,128}$/u.test(path);
  const begin = async (
    provider: string | undefined,
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
    returnTo: string,
    invitationDigest?: string,
  ) => {
    if (signal.aborted) return;
    if (
      !safeReturn(returnTo) ||
      request.method !== "POST" ||
      !matchesRequestHost(request, origin.host) ||
      !matchesRequestOrigin(request, origin.origin)
    )
      return reject(response, 403);
    const login = provider === undefined ? undefined : providers.get(provider);
    if (!login || provider === undefined) return reject(response, 404);
    const { callback } = clientLoginPaths(provider);
    let started: Awaited<ReturnType<BrowserLogin["start"]>>;
    try {
      started = await login.start(returnTo, invitationDigest);
    } catch {
      if (!signal.aborted && !response.destroyed) reject(response, 503);
      return;
    }
    if (signal.aborted || response.destroyed) return;
    response.setHeader(
      "Set-Cookie",
      cookie(bindingCookie, started.browserBinding, callback, 300),
    );
    redirect(response, started.location.href);
  };
  const readSession = (request: IncomingMessage) => {
    if (!matchesRequestHost(request, origin.host)) return null;
    const token = readCookie(request, sessionCookie);
    return token ? read(token) : null;
  };
  const readManagement = (
    request: IncomingMessage,
  ): {
    principal: AccountAccessPrincipal;
    formToken: string;
    readGitHost: ReadGitHost;
    readHostToken: (host: string) => string | null;
  } | null => {
    const entry = readSession(request);
    const management = entry?.session.management;
    if (
      !entry ||
      !management ||
      management.expiresAt <= Date.now() ||
      readCookie(request, managementCookie) !== management.id
    )
      return null;
    const references = new Map(entry.session.gitHostReferences);
    return {
      principal: {
        kind: "account",
        ...entry.session.binding,
        expiresAt: management.expiresAt,
      },
      formToken: management.formToken,
      readGitHost,
      readHostToken: (host) =>
        sessions.get(entry.token) === entry.session &&
        entry.session.management === management &&
        management.expiresAt > Date.now() &&
        references.has(host) &&
        entry.session.gitHostReferences.get(host) === references.get(host)
          ? activeHostToken(entry.session, host)
          : null,
    };
  };
  const changeManagement = (
    request: IncomingMessage,
    operation: "open" | "close",
    isActive: () => boolean,
  ) => {
    const entry = readSession(request);
    if (!entry) return { status: "no_session" } as const;
    if (operation === "close") {
      if (!isActive()) return { status: "cancelled" } as const;
      delete entry.session.management;
      return { status: "closed" } as const;
    }
    const current = readAccount(entry.session.identity, entry.session.binding);
    if (current.status !== "completed") return current;
    if (!isActive()) return { status: "cancelled" } as const;
    const management = openManagementSession(
      current.account.role,
      entry.session.expiresAt,
    );
    if (!management) return { status: "rejected" } as const;
    entry.session.management = management;
    return { status: "opened", id: management.id } as const;
  };
  const readCurrent = (
    request: IncomingMessage,
    discardRejectedSession = true,
  ): AccountObservation => {
    const entry = readSession(request);
    if (!entry) return { status: "rejected" };
    const { token, session } = entry;
    const current = readAccount(session.identity, session.binding);
    if (current.status === "rejected" && discardRejectedSession)
      removeSession(token);
    return current;
  };
  const activeHostToken = (
    session: NonNullable<ReturnType<typeof sessions.get>>,
    host: string,
  ) => {
    const reference = session.gitHostReferences.get(host);
    const gitHost = gitHosts.get(host);
    return session.expiresAt > Date.now() && reference && gitHost
      ? gitHost.links.read(reference, session.binding)
      : null;
  };
  const readHostedAccessSession = (request: IncomingMessage) => {
    const entry = readSession(request);
    if (!entry) return null;
    const references = new Map(entry.session.gitHostReferences);
    const isCurrent = () =>
      sessions.get(entry.token) === entry.session &&
      entry.session.expiresAt > Date.now();
    return {
      principal: {
        kind: "account" as const,
        ...entry.session.binding,
        expiresAt: entry.session.expiresAt,
      },
      browserSessionKey: entry.session,
      isCurrent,
      readGitHost,
      repositoryScope,
      readHostToken: (host: string) =>
        isCurrent() &&
        references.has(host) &&
        entry.session.gitHostReferences.get(host) === references.get(host)
          ? activeHostToken(entry.session, host)
          : null,
      openExecution: (host: string) => {
        const reference = references.get(host);
        const gitHost = gitHosts.get(host);
        if (
          !isCurrent() ||
          !reference ||
          entry.session.gitHostReferences.get(host) !== reference ||
          !gitHost?.observePermission
        )
          return null;
        const link = gitHost.links.open(reference, entry.session.binding);
        return (
          link && { ...link, observePermission: gitHost.observePermission }
        );
      },
    };
  };
  const readMcpReferences = (request: IncomingMessage) => {
    const entry = readSession(request);
    const references = new Map<string, string>();
    if (entry)
      for (const [host, reference] of entry.session.gitHostReferences)
        if (activeHostToken(entry.session, host))
          references.set(host, reference);
    return references;
  };
  const handleGitConnection = async (
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const url = new URL(request.url ?? "/", origin);
    const list =
      url.pathname === gitConnectionsRoute && request.method === "GET";
    const matched = /^\/api\/session\/git\/([a-z0-9.-]+)(?:\/callback)?$/u.exec(
      url.pathname,
    );
    const gitHost = matched?.[1] && gitHostsById.get(matched[1]);
    if (!gitHost && !list) return reject(response, 404);
    const paths = gitHost ? gitHostConnectionPaths(gitHost.id) : null;
    if (
      url.username ||
      url.password ||
      url.hash ||
      (url.pathname !== paths?.callback &&
        ((!list && url.pathname !== paths?.connection) || url.search))
    )
      return reject(response, 400);
    const method = request.method;
    if (
      (method === "POST" || method === "DELETE") &&
      !matchesRequestOrigin(request, origin.origin)
    )
      return reject(response, 403);
    const account = readCurrent(request);
    if (account.status !== "completed")
      return reject(response, account.status === "unavailable" ? 503 : 401);
    if (signal.aborted) return;
    const token = readCookie(request, sessionCookie);
    const session = token && sessions.get(token);
    if (!token || !session) return reject(response, 401);
    if (list)
      return sendResponseBody(
        response,
        "application/json; charset=utf-8",
        JSON.stringify({
          hosts: [...gitHostsById.values()].map(
            ({ id, host, displayName }) => ({
              id,
              host,
              displayName,
              connected: activeHostToken(session, host) !== null,
            }),
          ),
        }),
      );
    if (!gitHost || !paths) return reject(response, 404);
    if (url.pathname === paths.callback && method === "GET") {
      const approved = await gitHost.connection.complete(
        url.searchParams,
        token,
        () =>
          sessions.get(token) === session &&
          readCurrent(request).status === "completed",
        signal,
      );
      if (signal.aborted || response.destroyed) return;
      if (
        !approved ||
        sessions.get(token) !== session ||
        session.expiresAt <= Date.now() ||
        approved.expiresAt <= Date.now()
      )
        return reject(response, 403);
      const reference = gitHost.links.save(session.binding, approved);
      if (!reference) return reject(response, 403);
      const previous = session.gitHostReferences.get(gitHost.host);
      if (previous) gitHost.links.discard(previous);
      session.gitHostReferences.set(gitHost.host, reference);
      return redirect(response, "/");
    }
    if (url.pathname !== paths.connection) return reject(response, 405);
    if (method === "POST") {
      const location = gitHost.connection.begin(token);
      if (!location) return reject(response, 503);
      return redirect(response, location.href);
    }
    if (method === "DELETE") {
      gitHost.connection.cancel(token);
      const reference = session.gitHostReferences.get(gitHost.host);
      if (reference) gitHost.links.disconnect(reference, session.binding);
      session.gitHostReferences.delete(gitHost.host);
      setResponseHeaders(response);
      response.statusCode = 204;
      response.end();
      return;
    }
    if (method !== "GET") return reject(response, 405);
    const connected = activeHostToken(session, gitHost.host) !== null;
    return sendResponseBody(
      response,
      "application/json; charset=utf-8",
      JSON.stringify({
        connected,
      }),
    );
  };
  const handle = async (
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const url = new URL(request.url ?? "/", origin);
    const method = request.method;
    const route =
      /^\/api\/session\/login\/([a-z0-9-]+)(?:\/(invitation|callback))?$/u.exec(
        url.pathname,
      );
    const provider = route?.[1];
    const login = provider === undefined ? undefined : providers.get(provider);
    const endpoint = route?.[2];
    if (
      (!route && url.pathname !== sessionPath) ||
      !matchesRequestHost(request, origin.host) ||
      url.username ||
      url.password ||
      url.hash ||
      (endpoint !== "callback" && url.search)
    )
      return reject(response, 400);
    if (
      (method === "POST" || method === "DELETE") &&
      !matchesRequestOrigin(request, origin.origin)
    )
      return reject(response, 403);

    if (route && !login) return reject(response, 404);
    if (route && endpoint === undefined && method === "POST")
      return begin(provider, request, response, signal, "/");

    if (endpoint === "invitation" && method === "POST" && acceptInvitation) {
      let form: URLSearchParams;
      try {
        form = await readActionForm(request, 256);
      } catch {
        if (!signal.aborted && !response.destroyed) reject(response, 400);
        return;
      }
      if (signal.aborted || response.destroyed) return;
      const token = form.get("invitation");
      if ([...form.keys()].length !== 1 || !token || !opaqueToken.test(token))
        return reject(response, 400);
      return begin(
        provider,
        request,
        response,
        signal,
        "/",
        createHash("sha256").update(token).digest("hex"),
      );
    }

    const token = readCookie(request, sessionCookie);
    if (token === null) return reject(response, 400);
    if (endpoint === "callback" && method === "GET" && login) {
      const binding = readCookie(request, bindingCookie);
      if (binding === null) return reject(response, 400);
      const loggedIn = await login.complete(url.searchParams, binding, signal);
      if (signal.aborted || response.destroyed) return;
      if (!loggedIn || !safeReturn(loggedIn.returnTo))
        return reject(response, 403);
      const { identity, returnTo, invitation } = loggedIn;
      const id = randomBytes(32).toString("base64url");
      if (sessions.has(id)) return reject(response, 503);
      const account = invitation
        ? acceptInvitation?.(identity, invitation)
        : readAccount(identity);
      if (!account) return reject(response, 403);
      if (account.status !== "completed")
        return reject(response, account.status === "unavailable" ? 503 : 403);
      start(id, identity, account.account, token);
      response.setHeader("Set-Cookie", [
        cookie(bindingCookie, "", url.pathname, 0),
        cookie(sessionCookie, id, "/api", clientSessionLifetimeSeconds),
        cookie(managementCookie, "", "/api", 0),
      ]);
      return redirect(response, returnTo);
    }
    if (url.pathname !== sessionPath) return reject(response, 405);
    if (method === "DELETE") {
      const account = readCurrent(request, false);
      if (account.status === "unavailable") return reject(response, 503);
      if (account.status === "completed") {
        invalidateMcpAccount?.(account.account.userId);
        for (const gitHost of gitHosts.values()) {
          for (const [id, session] of sessions)
            if (session.binding.userId === account.account.userId)
              gitHost.connection.cancel(id);
          gitHost.links.signOut(account.account.userId);
        }
      }
      if (token) removeSession(token, "ended");
      response.setHeader("Set-Cookie", [
        cookie(sessionCookie, "", "/api", 0),
        cookie(managementCookie, "", "/api", 0),
      ]);
      if (account.status === "rejected") return reject(response, 401);
      setResponseHeaders(response);
      response.statusCode = 204;
      response.end();
      return;
    }
    if (method !== "GET") return reject(response, 405);
    const current = readCurrent(request);
    if (current.status === "unavailable") return reject(response, 503);
    if (current.status === "rejected") return reject(response, 401);
    return sendResponseBody(
      response,
      "application/json; charset=utf-8",
      JSON.stringify({
        username: current.account.username,
        role: current.account.role,
      }),
    );
  };
  const close = () => {
    for (const id of sessions.keys()) removeSession(id);
    for (const host of gitHosts.values()) host.links.close();
  };
  return Object.freeze({
    handle,
    handleGitConnection,
    readCurrent,
    readManagement,
    changeManagement,
    readHostedAccessSession,
    readMcpReferences,
    begin,
    close,
  });
}

/** 同じCookie属性を通常ログイン・管理セッション・ログアウトで使う。 */
export function sessionCookieHeader(
  origin: URL,
  name: string,
  value: string,
  path: string,
  seconds: number,
) {
  return `${name}=${value}; Path=${path}; Max-Age=${seconds}; HttpOnly; SameSite=Lax${origin.protocol === "https:" ? "; Secure" : ""}`;
}
