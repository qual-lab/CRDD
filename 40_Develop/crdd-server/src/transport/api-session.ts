/**
 * 外部ログインとHTTP APIのクライアントセッションを接続する。
 * @trace ARCH-000012
 * @boundary HTTP専用。MCP資格・管理書込みの許可は発行しない。
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { describeManagementPermissions } from "@qual-lab/crdd-access-management";
import type { GitHostLinkedAccessSession } from "../service/access.ts";
import {
  type AccountBinding,
  type AccountObservation,
  clientSessionLifetimeSeconds,
  createBrowserSessions,
  digestInvitation,
  type InvitationProof,
  type ManagementSessionChange,
  type ManagementSessionObservation,
  type SessionGitHost,
  type VerifiedIdentity,
} from "../service/session.ts";
import type { GitHostLinkFlow, ReadGitHost } from "../service/git-host.ts";
import {
  matchesRequestHost,
  matchesRequestOrigin,
  readActionForm,
  readRouteMethod,
  requestFailureStatus,
  sendResponseBody,
  setResponseHeaders,
} from "./api-http.ts";
import type { LoginFlow, LoginStart } from "./login.ts";

/** HTTP側が利用するセッションの読取り・切替・Cookie処置。 */
export interface ClientSessionAccess {
  readonly readGitHostLinkedAccessSession: (
    request: IncomingMessage,
  ) => GitHostLinkedAccessSession | null;
  readonly readManagement: (
    request: IncomingMessage,
  ) => ManagementSessionObservation | null;
  readonly changeManagement: (
    request: IncomingMessage,
    operation: "open" | "close",
    isActive: () => boolean,
  ) => ManagementSessionChange;
  readonly clearInvalidCookies: (
    request: IncomingMessage,
    response: ServerResponse,
    callback?: { path: string; provider: string },
  ) => void;
}

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

function secureCookieName(origin: URL, name: string): string {
  return origin.protocol === "https:" ? `__Host-${name}` : name;
}

function readCookie(request: IncomingMessage, origin: URL, name: string) {
  const expected = secureCookieName(origin, name);
  let value: string | undefined;
  for (const header of request.headersDistinct.cookie ?? []) {
    for (const field of header.split(";")) {
      const parameter = field.trim();
      if (!parameter.startsWith(`${expected}=`)) continue;
      const candidate = parameter.slice(expected.length + 1);
      if (value !== undefined || !opaqueToken.test(candidate)) return null;
      value = candidate;
    }
  }
  return value;
}

/** 固定Originへ外部ログインと短命のサーバー側セッションを登録する。 @trace ARCH-000012 */
export function createClientSessionHandler(
  origin: URL,
  logins: Readonly<Record<string, LoginFlow>>,
  readAccount: (
    identity: VerifiedIdentity,
    session?: AccountBinding,
  ) => AccountObservation,
  gitHostOptions?: readonly (Omit<SessionGitHost, "cancelPending"> & {
    id: string;
    displayName: string;
    linkFlow: GitHostLinkFlow;
  })[],
  acceptInvitation?: (
    identity: VerifiedIdentity,
    proof: InvitationProof,
  ) => AccountObservation,
  invalidateMcpAccount?: (userId: string) => void,
  readGitHost: ReadGitHost = () => undefined,
  repositoryScope: import("../service/repository-scope.ts").RepositoryScope = () =>
    false,
  isAdditionalReturnPath: (path: string) => boolean = () => false,
) {
  const providers = new Map(Object.entries(logins));
  const gitHosts = new Map(gitHostOptions?.map((host) => [host.host, host]));
  const gitHostsById = new Map(gitHostOptions?.map((host) => [host.id, host]));
  if (
    gitHosts.size !== gitHostsById.size ||
    gitHosts.size !== (gitHostOptions?.length ?? 0) ||
    new Set(gitHostOptions?.map(({ links }) => links)).size !== gitHosts.size ||
    new Set(gitHostOptions?.map(({ linkFlow }) => linkFlow)).size !==
      gitHosts.size
  )
    throw new Error("git_host_configuration_invalid");
  const browser = createBrowserSessions({
    readAccount,
    acceptInvitation,
    invalidateMcpAccount,
    readGitHost,
    repositoryScope,
    gitHosts: new Map(
      [...gitHosts].map(([name, { linkFlow, ...host }]) => [
        name,
        {
          host: host.host,
          links: host.links,
          cancelPending: (id: string) => linkFlow.cancel(id),
          ...(host.observePermission && {
            observePermission: host.observePermission,
          }),
        },
      ]),
    ),
  });
  const cookie = (name: string, value: string, path: string, seconds: number) =>
    createSessionCookieHeader(origin, name, value, path, seconds);
  const providerBindingCookie = (provider: string) =>
    origin.protocol === "https:"
      ? `${bindingCookie}-${provider}`
      : bindingCookie;
  const clearInvalidCookies = (
    request: IncomingMessage,
    response: ServerResponse,
    callback?: { path: string; provider: string },
  ) => {
    if (!matchesRequestHost(request, origin.host)) return;
    const invalid = [sessionCookie, managementCookie]
      .filter((name) => readCookie(request, origin, name) === null)
      .map((name) => cookie(name, "", "/api", 0));
    if (callback) {
      const binding = providerBindingCookie(callback.provider);
      if (readCookie(request, origin, binding) === null)
        invalid.push(cookie(binding, "", callback.path, 0));
    }
    if (invalid.length) response.setHeader("Set-Cookie", invalid);
  };
  const reject = (
    response: ServerResponse,
    status: number,
    reason:
      | "session_unavailable"
      | "git_host_revocation_unconfirmed" = "session_unavailable",
  ) =>
    sendResponseBody(
      response,
      "text/plain; charset=utf-8",
      `${reason}\n`,
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
    path === "/" || isAdditionalReturnPath(path);
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
    let started: LoginStart;
    try {
      started = await login.start(returnTo, invitationDigest);
    } catch {
      if (!signal.aborted && !response.destroyed) reject(response, 503);
      return;
    }
    if (signal.aborted || response.destroyed) return;
    response.setHeader(
      "Set-Cookie",
      cookie(
        providerBindingCookie(provider),
        started.browserBinding,
        callback,
        300,
      ),
    );
    redirect(response, started.location.href);
  };
  const sessionToken = (request: IncomingMessage) =>
    matchesRequestHost(request, origin.host)
      ? (readCookie(request, origin, sessionCookie) ?? undefined)
      : undefined;
  const readCurrent = (
    request: IncomingMessage,
    discardRejectedSession = true,
  ) => browser.readCurrent(sessionToken(request), discardRejectedSession);
  const handleGitConnection = async (
    request: IncomingMessage,
    response: ServerResponse,
    signal: AbortSignal,
  ) => {
    const url = new URL(request.url ?? "/", origin);
    const list =
      url.pathname === gitConnectionsRoute &&
      readRouteMethod(request.method) === "GET";
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
    const method =
      paths?.callback === url.pathname
        ? request.method
        : readRouteMethod(request.method);
    if (
      (method === "POST" || method === "DELETE") &&
      !matchesRequestOrigin(request, origin.origin)
    )
      return reject(response, 403);
    clearInvalidCookies(request, response);
    const account = browser.readGitAccount(sessionToken(request));
    if (account.status !== "completed")
      return reject(response, account.status === "unavailable" ? 503 : 401);
    if (signal.aborted) return;
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
              connected: account.connected(host),
            }),
          ),
        }),
      );
    if (!gitHost || !paths) return reject(response, 404);
    if (url.pathname === paths.callback && method === "GET") {
      const approved = await gitHost.linkFlow.complete(
        url.searchParams,
        account.id,
        account.isCurrent,
        signal,
      );
      if (signal.aborted || response.destroyed) return;
      if (!account.save(gitHost.host, approved)) return reject(response, 403);
      return redirect(response, "/");
    }
    if (url.pathname !== paths.connection) return reject(response, 405);
    if (method === "POST") {
      const location = gitHost.linkFlow.begin(account.id);
      if (!location) return reject(response, 503);
      return redirect(response, location.href);
    }
    if (method === "DELETE") {
      const result = await account.disconnect(gitHost.host);
      if (signal.aborted || response.destroyed) return;
      if (result === "unconfirmed")
        return reject(response, 502, "git_host_revocation_unconfirmed");
      if (result === "absent")
        return sendResponseBody(
          response,
          "text/plain; charset=utf-8",
          "git_host_link_absent\n",
        );
      setResponseHeaders(response);
      response.statusCode = 204;
      response.end();
      return;
    }
    if (method !== "GET") return reject(response, 405);
    const connected = account.connected(gitHost.host);
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
    const method =
      url.pathname === sessionPath
        ? readRouteMethod(request.method)
        : request.method;
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
    clearInvalidCookies(
      request,
      response,
      endpoint === "callback" && provider
        ? { path: url.pathname, provider }
        : undefined,
    );

    if (route && !login) return reject(response, 404);
    if (route && endpoint === undefined && method === "POST")
      return begin(provider, request, response, signal, "/");

    if (endpoint === "invitation" && method === "POST" && acceptInvitation) {
      let form: URLSearchParams;
      try {
        form = await readActionForm(request, 256);
      } catch (error) {
        if (!signal.aborted && !response.destroyed)
          reject(response, requestFailureStatus(error, response));
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
        digestInvitation(token),
      );
    }

    const token = sessionToken(request);
    if (endpoint === "callback" && method === "GET" && provider && login) {
      const bindingName = providerBindingCookie(provider);
      const binding = readCookie(request, origin, bindingName) ?? undefined;
      const loggedIn = await login.complete(url.searchParams, binding, signal);
      if (signal.aborted || response.destroyed) return;
      if (!loggedIn || !safeReturn(loggedIn.returnTo))
        return reject(response, 403);
      const { identity, returnTo, invitation } = loggedIn;
      const completed = browser.completeLogin(identity, invitation, token);
      if (completed.status !== "started")
        return reject(response, completed.status === "unavailable" ? 503 : 403);
      response.setHeader("Set-Cookie", [
        cookie(bindingName, "", url.pathname, 0),
        cookie(
          sessionCookie,
          completed.id,
          "/api",
          clientSessionLifetimeSeconds,
        ),
        cookie(managementCookie, "", "/api", 0),
      ]);
      return redirect(response, returnTo);
    }
    if (url.pathname !== sessionPath) return reject(response, 405);
    if (method === "DELETE") {
      const status = await browser.signOut(token);
      if (signal.aborted || response.destroyed) return;
      if (status === "unavailable") return reject(response, 503);
      response.setHeader("Set-Cookie", [
        cookie(sessionCookie, "", "/api", 0),
        cookie(managementCookie, "", "/api", 0),
      ]);
      if (status === "rejected") return reject(response, 401);
      if (status === "revocation_unavailable")
        return reject(response, 502, "git_host_revocation_unconfirmed");
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
        management: describeManagementPermissions(current.account.role),
      }),
    );
  };
  return Object.freeze({
    handle,
    handleGitConnection,
    readCurrent,
    readManagement: (request: IncomingMessage) =>
      browser.readManagement(
        sessionToken(request),
        readCookie(request, origin, managementCookie),
      ),
    changeManagement: (
      request: IncomingMessage,
      operation: "open" | "close",
      isActive: () => boolean,
    ) => browser.changeManagement(sessionToken(request), operation, isActive),
    readGitHostLinkedAccessSession: (request: IncomingMessage) =>
      browser.readGitHostLinkedAccessSession(sessionToken(request)),
    readMcpReferences: (request: IncomingMessage) =>
      browser.readMcpReferences(sessionToken(request)),
    clearInvalidCookies,
    begin,
    close: browser.close,
  });
}

/** 同じCookie属性を通常ログイン・管理セッション・ログアウトで使う。 */
export function createSessionCookieHeader(
  origin: URL,
  name: string,
  value: string,
  path: string,
  seconds: number,
) {
  const secure = origin.protocol === "https:";
  return `${secureCookieName(origin, name)}=${value}; Path=${secure ? "/" : path}; Max-Age=${seconds}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
