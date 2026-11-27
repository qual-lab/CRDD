/**
 * 起動プロセスの環境から、共有ログインと外部Git接続の設定だけを受け付ける。
 * @trace ARCH-000012
 * @security 秘密は起動プロセスへ渡し、Repository設定・診断へ複製しない。
 */
import { createPrivateKey, randomBytes } from "node:crypto";
import {
  configuredGitHosts,
  type GitHostConfiguration,
  isGitHostCredentialEnvironment,
} from "../service/git-host.ts";
import type { EmbeddedMcpOAuthOptions } from "../transport/mcp-types.ts";
import {
  isLoginProviderId,
  type LoginProviderConfiguration,
  loginProviderProfiles,
} from "../service/login-providers.ts";
import { parseUnambiguousJsonDocument } from "../transport/parse-json.ts";

const oauthEnvironment = [
  "CRDD_LOGIN_PROVIDERS",
  ...Object.values(loginProviderProfiles).flatMap(
    ({ environmentNames }) => environmentNames,
  ),
  "CRDD_GIT_HOSTS",
  "CRDD_SHARED_REPOSITORY_ROOTS",
  "CRDD_MCP_OAUTH_CLIENTS",
  "CRDD_MCP_OAUTH_SIGNING_KEY",
] as const;

function clearOAuthEnvironment(environment: NodeJS.ProcessEnv) {
  for (const key of Object.keys(environment)) {
    if (
      isGitHostCredentialEnvironment(key) ||
      oauthEnvironment.some((name) => name === key.toUpperCase())
    )
      delete environment[key];
  }
}

function validRedirect(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return (
      value === url.href &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && url.hostname === "127.0.0.1"))
    );
  } catch {
    return false;
  }
}

function readClients(raw: string): EmbeddedMcpOAuthOptions["clients"] {
  const parsed = parseUnambiguousJsonDocument(raw);
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 16)
    throw new Error("invalid clients");
  const ids = new Set<string>();
  return parsed.map((record: unknown) => {
    if (
      !record ||
      typeof record !== "object" ||
      Object.keys(record).length !== 2 ||
      !Object.hasOwn(record, "id") ||
      !Object.hasOwn(record, "redirects")
    )
      throw new Error("invalid client");
    const { id, redirects } = record as { id: unknown; redirects: unknown };
    if (
      typeof id !== "string" ||
      !/^[A-Za-z0-9_.-]{1,128}$/u.test(id) ||
      id === "crdd-mcp-verifier" ||
      ids.has(id) ||
      !Array.isArray(redirects) ||
      redirects.length < 1 ||
      redirects.length > 8 ||
      new Set(redirects).size !== redirects.length ||
      !redirects.every(validRedirect)
    )
      throw new Error("invalid client");
    ids.add(id);
    return { id, redirects };
  });
}

function readGitHosts(environment: NodeJS.ProcessEnv) {
  const raw = environment.CRDD_GIT_HOSTS;
  if (raw === undefined) return undefined;
  if (raw.length > 2_048) throw new Error("git_hosts_configuration_invalid");
  let hosts: unknown;
  try {
    hosts = parseUnambiguousJsonDocument(raw);
  } catch {
    throw new Error("git_hosts_configuration_invalid");
  }
  if (!Array.isArray(hosts) || hosts.length > 16)
    throw new Error("git_hosts_configuration_invalid");
  if (hosts.length === 0) return undefined;
  const readVariable = (name: unknown) => {
    if (
      typeof name !== "string" ||
      name !== name.toUpperCase() ||
      !isGitHostCredentialEnvironment(name)
    )
      throw new Error("git_hosts_configuration_invalid");
    return Object.hasOwn(environment, name) ? environment[name] : undefined;
  };
  return configuredGitHosts(hosts, readVariable).map(
    ({ configuration }) => configuration,
  );
}

function readSharedRepositoryRoots(environment: NodeJS.ProcessEnv): string[] {
  try {
    const raw = environment.CRDD_SHARED_REPOSITORY_ROOTS;
    const roots: unknown =
      raw && raw.length <= 32_768 ? parseUnambiguousJsonDocument(raw) : null;
    if (
      Array.isArray(roots) &&
      roots.length > 0 &&
      roots.every((root) => typeof root === "string")
    )
      return roots;
  } catch {
    // 設定値やJSON解析の詳細を起動診断に出さない。
  }
  throw new Error("shared_repository_roots_invalid");
}

/** 共有モードに必要な起動設定だけをCLIへ渡す。 @trace ARCH-000012 */
export interface SharedOAuthConfiguration {
  readonly loginProviders: LoginProviderConfiguration;
  readonly mcpOAuth: EmbeddedMcpOAuthOptions;
  readonly gitHosts: readonly GitHostConfiguration[];
  readonly sharedRepositoryRoots: readonly string[];
}

/** 全設定が揃った場合だけOAuthを選ぶ。一部設定を旧方式へ読み替えない。 @trace ARCH-000012 */
export function readSharedOAuthConfiguration(
  environment: NodeJS.ProcessEnv,
): SharedOAuthConfiguration | undefined {
  const rawProviders = environment.CRDD_LOGIN_PROVIDERS;
  const hasLoginConfiguration = Object.values(loginProviderProfiles).some(
    ({ environmentNames }) =>
      environmentNames.some((name) => environment[name] !== undefined),
  );
  const clientsJson = environment.CRDD_MCP_OAUTH_CLIENTS;
  const signingPem = environment.CRDD_MCP_OAUTH_SIGNING_KEY;
  const gitHosts = readGitHosts(environment);
  if (
    !hasLoginConfiguration &&
    [rawProviders, clientsJson, signingPem, gitHosts].every(
      (value) => value === undefined,
    )
  )
    return undefined;
  let loginProviders: LoginProviderConfiguration;
  let mcpOAuth: EmbeddedMcpOAuthOptions;
  try {
    if (
      !clientsJson ||
      clientsJson.length > 32_768 ||
      !signingPem ||
      signingPem.length > 16_384
    )
      throw new Error("missing OAuth configuration");
    const selected =
      rawProviders !== undefined && rawProviders.length <= 4_096
        ? parseUnambiguousJsonDocument(rawProviders)
        : null;
    if (
      !Array.isArray(selected) ||
      !selected.length ||
      selected.length > Object.keys(loginProviderProfiles).length ||
      !selected.every(isLoginProviderId) ||
      new Set(selected).size !== selected.length
    )
      throw new Error("invalid login providers");
    loginProviders = Object.fromEntries(
      selected.map((id) => [
        id,
        loginProviderProfiles[id].readConfiguration(environment),
      ]),
    );
    const clients = readClients(clientsJson);
    const signingKey = createPrivateKey(signingPem);
    if (
      signingKey.asymmetricKeyType !== "rsa" ||
      (signingKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    )
      throw new Error("invalid signing key");
    mcpOAuth = {
      clients,
      verifier: {
        id: "crdd-mcp-verifier",
        secret: randomBytes(32).toString("base64url"),
      },
      jwks: {
        keys: [
          { ...signingKey.export({ format: "jwk" }), alg: "RS256", use: "sig" },
        ],
      },
      cookieKeys: [randomBytes(32).toString("base64url")],
    };
  } catch {
    throw new Error("mcp_oauth_configuration_invalid");
  }
  if (!gitHosts) throw new Error("git_hosts_configuration_required");
  return {
    loginProviders,
    mcpOAuth,
    gitHosts,
    sharedRepositoryRoots: readSharedRepositoryRoots(environment),
  };
}

/** 親が起動用設定を取り込み、GitやCoordinator子プロセスより先に環境から参照を除く。 @trace ARCH-000012 */
export function consumeOAuthEnvironment(
  environment: NodeJS.ProcessEnv,
  shared: boolean,
): SharedOAuthConfiguration | undefined {
  try {
    return shared ? readSharedOAuthConfiguration(environment) : undefined;
  } finally {
    clearOAuthEnvironment(environment);
  }
}
