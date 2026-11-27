/**
 * 共有モードに限り、同じListenerへブラウザー認証とMCP OAuthを接続する。
 * @trace ARCH-000012
 * @boundary 起動Ownerの設定とHTTP／MCPの公開受付。待受と共有保存領域の排他は起動Ownerが所有する。
 */
import type {
  IncomingMessage,
  RequestListener,
  ServerResponse,
} from "node:http";
import {
  acceptInvitation,
  type FilesystemStoreRoot,
  readAccount,
} from "@qual-lab/crdd-access-management";
import type { ObjectiveRuns } from "../service/execution.ts";
import {
  type BoundGitHost,
  createGitHostLinks,
  openGitHostExecutionAccess,
  type ReadGitHost,
} from "../service/git-host.ts";
import type {
  ConfiguredLoginProvider,
  PublicLoginProvider,
} from "../service/login-providers.ts";
import type { RepositoryScope } from "../service/repository-scope.ts";
import type { ApiServer } from "./api-http.ts";
import {
  createManagementSessionHandler,
  createManagementSessionLifecycleHandler,
} from "./api-server.ts";
import {
  clientLoginPaths,
  type ClientSessionAccess,
  createClientSessionHandler,
  gitHostConnectionPaths,
} from "./api-session.ts";
import { createLogin } from "./login.ts";
import {
  createMcpOAuthEndpoint,
  createMcpOAuthInteraction,
  createMcpOAuthProvider,
  createMcpOAuthStore,
  createMcpIntrospection,
  type InspectMcpToken,
  createMcpTokenObserver,
  mcpScope,
  verifyMcpBearer,
  isMcpBrowserReturnPath,
} from "./mcp-oauth.ts";
import type { EmbeddedMcpOAuthOptions } from "./mcp-types.ts";

interface SharedTransport {
  readonly session: ClientSessionAccess;
  readonly routes: Readonly<{
    clientSession: RequestListener;
    changeManagementSession: RequestListener;
    managementSession: RequestListener;
    gitConnection?: RequestListener;
  }>;
  dispatch(request: IncomingMessage, response: ServerResponse): boolean;
}

/** 現行の認可を各入口に渡し、発行・照会は別の契約として接続する。 */
export async function createSharedTransport({
  transport,
  accessRoot,
  origin,
  publicOrigin,
  loginProviders,
  publicLoginProviders,
  gitRuntimes,
  readGitHost,
  repositoryScope,
  mcpOAuth,
  objectiveRuns,
}: Readonly<{
  transport: ApiServer;
  accessRoot: FilesystemStoreRoot;
  origin: URL;
  publicOrigin: URL | null;
  loginProviders: readonly ConfiguredLoginProvider[];
  publicLoginProviders: readonly PublicLoginProvider[];
  gitRuntimes: readonly BoundGitHost[];
  readGitHost: ReadGitHost;
  repositoryScope: RepositoryScope;
  mcpOAuth: EmbeddedMcpOAuthOptions;
  objectiveRuns: ObjectiveRuns;
}>): Promise<SharedTransport> {
  const gitHostingEnabled = gitRuntimes.length > 0;
  const oauthState = createMcpOAuthStore();
  const logins = Object.fromEntries(
    await Promise.all(
      loginProviders.map(
        async (profile) =>
          [
            profile.id,
            await createLogin(profile, {
              callback: new URL(clientLoginPaths(profile.id).callback, origin),
            }),
          ] as const,
      ),
    ),
  );
  const gitHostSessions = gitRuntimes.map(
    ({
      id,
      host,
      displayName,
      createLinkFlow,
      revokeUserToken,
      observePermission,
    }) => ({
      host,
      id,
      displayName,
      linkFlow: createLinkFlow(
        new URL(gitHostConnectionPaths(id).callback, origin),
      ),
      links: createGitHostLinks(
        () => oauthState.collectGrantHostReferences(host),
        revokeUserToken,
      ),
      ...(observePermission && { observePermission }),
    }),
  );
  const gitHostsByName = new Map(
    gitHostSessions.map((host) => [host.host, host]),
  );
  const browser = createClientSessionHandler(
    origin,
    logins,
    (identity, session) => readAccount(accessRoot, identity, session),
    gitHostSessions,
    (identity, { digest, email, emailVerified }) =>
      acceptInvitation(
        accessRoot,
        { ...identity, email, emailVerified },
        digest,
      ),
    oauthState.invalidateUser,
    readGitHost,
    repositoryScope,
    isMcpBrowserReturnPath,
  );
  const routes = {
    clientSession: transport.handleRequest(browser.handle),
    changeManagementSession: transport.handleRequest(
      createManagementSessionLifecycleHandler(origin, browser.changeManagement),
    ),
    managementSession: transport.handleRequest(
      createManagementSessionHandler(
        origin,
        accessRoot,
        browser.readManagement,
        gitHostingEnabled,
        (incoming) =>
          browser.readGitHostLinkedAccessSession(incoming)?.principal ?? null,
        (incoming) => browser.readCurrent(incoming, false),
        repositoryScope,
      ),
    ),
    ...(gitHostingEnabled && {
      gitConnection: transport.handleRequest(browser.handleGitConnection),
    }),
  };
  transport.server.once("close", browser.close);
  const [{ createOAuthMcpAccess }, { createMcpHttpRequestHandler }] =
    await Promise.all([import("./mcp-server.ts"), import("./mcp-http.ts")]);
  const resource = new URL("/mcp", origin);
  const provider = createMcpOAuthProvider(
    {
      ...mcpOAuth,
      issuer: origin,
      resource,
    },
    oauthState,
  );
  const oauthEndpoint = createMcpOAuthEndpoint(
    provider,
    resource,
    createMcpOAuthInteraction(
      provider,
      resource,
      browser,
      publicLoginProviders,
      browser.readMcpReferences,
      oauthState,
    ),
    oauthState,
  );
  // 同じListenerの起動後にDiscoveryする。失敗を旧Bearer認証へは回さない。
  let discovery: Promise<InspectMcpToken> | undefined;
  const inspect = async (token: string, signal: AbortSignal) => {
    discovery ??= createMcpIntrospection({
      issuer: origin,
      resource,
      clientId: mcpOAuth.verifier.id,
      clientSecret: mcpOAuth.verifier.secret,
    });
    const pending = discovery;
    const verifier = await pending.catch((error: unknown) => {
      if (discovery === pending) discovery = undefined;
      throw error;
    });
    return verifier(token, signal);
  };
  const access = createOAuthMcpAccess(
    accessRoot,
    createMcpTokenObserver(resource, inspect),
    oauthState.hasCurrentToken,
    gitHostingEnabled
      ? {
          readGrantHostReference: oauthState.readGrantHostReference,
          readGitHost,
          repositoryScope,
          read: (host, reference, binding) =>
            gitHostsByName.get(host)?.links.read(reference, binding) ?? null,
          open: (host, reference, binding) =>
            openGitHostExecutionAccess(
              gitHostsByName.get(host),
              reference,
              binding,
            ),
        }
      : undefined,
    objectiveRuns,
  );
  const mcp = createMcpHttpRequestHandler(
    {
      ...access,
      authenticate: (header, signal) =>
        verifyMcpBearer(
          header,
          resource,
          inspect,
          signal,
          oauthEndpoint.metadata.href,
        ),
    },
    {
      ...(publicOrigin ? { publicOrigin: publicOrigin.origin } : {}),
      resourceMetadataUrl: oauthEndpoint.metadata,
      requiredScopes: [mcpScope],
    },
  );
  const handleMcp = transport.handleRequest(mcp.handle);
  const handleOAuth = transport.handleRequest(oauthEndpoint.handle);
  return {
    session: browser,
    routes,
    dispatch(incoming, response) {
      if (incoming.url === mcp.endpoint) handleMcp(incoming, response);
      else if (oauthEndpoint.matches(incoming.url))
        handleOAuth(incoming, response);
      else return false;
      return true;
    },
  };
}
