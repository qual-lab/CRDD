/**
 * GitHubのアカウント連携、App権限の追加確認と本人の実効権限観測を所有する。
 * @trace ARCH-000012
 * @boundary CRDD内の認可や、HTTPセッションへの資格保管は行わない。
 */
import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";
import { matchesSecret } from "../secret.ts";
import type { GitHostLinkedRepository } from "@qual-lab/crdd-access-management";

import type {
  GitHostConnection,
  GitHostConfiguration,
  GitHostPermissionObservation,
  GitHostProvider,
  GitHostRepositoryAccess,
} from "./git-host.ts";

const maximumCachedInstallations = 128;
const apiBase = "https://api.github.com";

function gitHubId(value: unknown): number {
  return typeof value === "string" && /^[1-9][0-9]*$/u.test(value)
    ? Number(value)
    : NaN;
}

function repositoryIds(reference: GitHostLinkedRepository) {
  const data = record(reference.providerData);
  if (
    reference.provider !== "github" ||
    reference.host !== "github.com" ||
    !data ||
    Object.keys(data).length !== 1 ||
    !Object.hasOwn(data, "installationId")
  )
    return null;
  const repositoryId = gitHubId(reference.repositoryId);
  const installationId = gitHubId(data.installationId);
  return validId(repositoryId) && validId(installationId)
    ? { repositoryId, installationId }
    : null;
}

/** 実行監視用の照会。利用者の対話資格を読まず、インストール資格を外へ渡さない。 */
function createGitHubPermissionObserver(configuration: {
  clientId: string;
  privateKey: string;
}) {
  const key = (() => {
    try {
      if (!/^[A-Za-z0-9_.-]{1,128}$/u.test(configuration.clientId))
        throw new Error();
      const parsed = createPrivateKey(configuration.privateKey);
      if (
        parsed.asymmetricKeyType !== "rsa" ||
        (parsed.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
      )
        throw new Error();
      return parsed;
    } catch {
      throw new Error("git_host_monitor_configuration_invalid");
    }
  })();
  const tokens = new Map<string, { value: string; expiresAt: number }>();
  const toBase64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const api = (
    path: string,
    token: string,
    signal: AbortSignal,
    body?: object,
  ) =>
    fetch(new URL(path, apiBase), {
      redirect: "error",
      signal,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        Authorization: `Bearer ${token}`,
        ...(body && { "Content-Type": "application/json" }),
      },
      ...(body && { method: "POST", body: JSON.stringify(body) }),
    });
  const installationToken = async (
    installationId: number,
    repositoryId: number,
    signal: AbortSignal,
  ) => {
    const cacheKey = `${installationId}:${repositoryId}`;
    const cached = tokens.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.value;
    if (cached) tokens.delete(cacheKey);
    const now = Math.floor(Date.now() / 1_000);
    const data = `${toBase64({ alg: "RS256", typ: "JWT" })}.${toBase64({
      iss: configuration.clientId,
      iat: now - 60,
      exp: now + 300,
    })}`;
    const jwt = `${data}.${sign("RSA-SHA256", Buffer.from(data), key).toString("base64url")}`;
    const response = await api(
      `/app/installations/${installationId}/access_tokens`,
      jwt,
      signal,
      {
        repository_ids: [repositoryId],
        permissions: { metadata: "read" },
      },
    );
    if (response.status !== 201) return null;
    const credential = record(await response.json());
    const value = credential?.token;
    const permissions = record(credential?.permissions);
    const expiresAt =
      typeof credential?.expires_at === "string"
        ? Date.parse(credential.expires_at)
        : NaN;
    if (
      typeof value !== "string" ||
      !/^ghs_[A-Za-z0-9_.-]{1,4096}$/u.test(value) ||
      !permissions ||
      Object.keys(permissions).length !== 1 ||
      permissions.metadata !== "read" ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      signal.aborted
    )
      return null;
    if (tokens.size >= maximumCachedInstallations) {
      const oldest = tokens.keys().next().value;
      if (oldest !== undefined) tokens.delete(oldest);
    }
    tokens.set(cacheKey, { value, expiresAt });
    return value;
  };
  return async (input: {
    reference: GitHostLinkedRepository;
    accountId: string;
    signal: AbortSignal;
  }): Promise<GitHostPermissionObservation> => {
    const accountId = gitHubId(input.accountId);
    const ids = repositoryIds(input.reference);
    if (!ids || !validId(accountId) || input.signal.aborted)
      return "unavailable";
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(5_000)]);
    try {
      const token = await installationToken(
        ids.installationId,
        ids.repositoryId,
        signal,
      );
      if (!token) return "unavailable";
      const repositoryName = async () => {
        const response = await api(
          "/installation/repositories?per_page=2",
          token,
          signal,
        );
        if (!response.ok) return null;
        const payload = record(await response.json());
        if (
          payload?.total_count !== 1 ||
          !Array.isArray(payload.repositories) ||
          payload.repositories.length !== 1
        )
          return null;
        const repository = record(payload.repositories[0]);
        return repository?.id === ids.repositoryId &&
          typeof repository.full_name === "string"
          ? gitHubRepositoryName(
              `https://github.com/${repository.full_name}.git`,
            )
          : null;
      };
      const [name, identity] = await Promise.all([
        repositoryName(),
        api(`/user/${accountId}`, token, signal),
      ]);
      const user = identity.ok ? record(await identity.json()) : null;
      if (
        !name ||
        user?.id !== accountId ||
        typeof user.login !== "string" ||
        !/^[A-Za-z0-9_-]{1,100}$/u.test(user.login)
      )
        return "unavailable";
      const response = await api(
        `/repos/${name}/collaborators/${user.login}/permission`,
        token,
        signal,
      );
      if (!response.ok) return "unavailable";
      const permission = record(await response.json());
      if (
        record(permission?.user)?.id !== accountId ||
        name !== (await repositoryName()) ||
        signal.aborted
      )
        return "unavailable";
      switch (permission?.permission) {
        case "admin":
        case "write":
          return { permission: "write", repositoryName: name };
        case "read":
          return { permission: "read", repositoryName: name };
        case "none":
          return { permission: "none", repositoryName: name };
        default:
          return "unavailable";
      }
    } catch {
      return "unavailable";
    }
  };
}

const pageSize = 100;
const maxPages = 10;
const linkLifetime = 5 * 60_000;
const maximumPendingLinks = 128;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** セッションIDはHTTP入口の検証済みセッションからのみ渡す。 */
function createGitHubConnection(input: {
  host: string;
  clientId: string;
  clientSecret: string;
  callback: URL;
}): GitHostConnection {
  if (input.host !== "github.com") throw new Error("git_host_unsupported");
  const { clientId, clientSecret } = input;
  const callback = new URL(input.callback.href);
  if (
    (callback.protocol !== "https:" &&
      !(callback.protocol === "http:" && callback.hostname === "127.0.0.1")) ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash ||
    !clientId ||
    !clientSecret
  ) {
    throw new Error("github_connection_configuration_invalid");
  }

  const pending = new Map<
    string,
    { state: string; verifier: string; expiresAt: number; consumed: boolean }
  >();
  return {
    begin(sessionId: string): URL | null {
      if (!sessionId) return null;
      const now = Date.now();
      for (const [id, link] of pending) {
        if (link.expiresAt <= now) pending.delete(id);
      }
      if (!pending.has(sessionId) && pending.size >= maximumPendingLinks)
        return null;
      const state = randomBytes(32).toString("base64url");
      const verifier = randomBytes(32).toString("base64url");
      const location = new URL("https://github.com/login/oauth/authorize");
      location.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callback.href,
        state,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
      }).toString();
      pending.set(sessionId, {
        state,
        verifier,
        expiresAt: now + linkLifetime,
        consumed: false,
      });
      return location;
    },
    cancel(sessionId: string) {
      pending.delete(sessionId);
    },
    async complete(
      search: URLSearchParams,
      sessionId: string,
      isCurrentSession: () => boolean,
      signal: AbortSignal,
    ) {
      const link = pending.get(sessionId);
      if (
        !link ||
        link.consumed ||
        signal.aborted ||
        link.expiresAt <= Date.now() ||
        search.getAll("state").length !== 1 ||
        !matchesSecret(search.get("state"), link.state)
      ) {
        return null;
      }
      link.consumed = true;
      const code = search.get("code");
      const requestSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(5_000),
      ]);
      const current = () =>
        !requestSignal.aborted &&
        link.expiresAt > Date.now() &&
        pending.get(sessionId) === link &&
        isCurrentSession();
      try {
        if (
          !code ||
          code.length > 512 ||
          search.getAll("code").length !== 1 ||
          search.has("error") ||
          !current()
        )
          return null;
        const issuedAfter = Date.now();
        const response = await fetch(
          "https://github.com/login/oauth/access_token",
          {
            method: "POST",
            headers: { Accept: "application/json" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: callback.href,
              code,
              code_verifier: link.verifier,
            }),
            redirect: "error",
            signal: requestSignal,
          },
        );
        if (response.status !== 200) return null;
        const reply = record(await response.json());
        const accessToken = reply?.access_token;
        const seconds = reply?.expires_in;
        if (
          reply?.error !== undefined ||
          reply?.token_type !== "bearer" ||
          typeof accessToken !== "string" ||
          !/^ghu_[A-Za-z0-9_]+$/u.test(accessToken) ||
          !validId(seconds) ||
          seconds > 28_800 ||
          !current()
        )
          return null;

        const identityResponse = await fetch(new URL("/user", apiBase).href, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${accessToken}`,
          },
          redirect: "error",
          signal: requestSignal,
        });
        if (identityResponse.status !== 200) return null;
        const identity = record(await identityResponse.json());
        const id = identity?.id;
        const expiresAt = issuedAfter + seconds * 1_000;
        if (!validId(id) || expiresAt <= Date.now() || !current()) return null;
        // この結果はサーバーのセッション所有者専用。公開応答には投影しない。
        return { accountId: String(id), accessToken, expiresAt };
      } catch {
        return null;
      } finally {
        if (pending.get(sessionId) === link) pending.delete(sessionId);
      }
    },
  };
}

async function findAccessibleEntry(
  path: string,
  key: "installations" | "repositories",
  matches: (entry: Record<string, unknown>) => boolean,
  token: string,
  signal: AbortSignal,
  isCurrent?: () => boolean,
): Promise<Record<string, unknown> | null | undefined> {
  let total: number | undefined;
  const seen = new Set<number>();
  for (let page = 1; page <= maxPages; page += 1) {
    if (signal.aborted || (isCurrent && !isCurrent())) return undefined;
    const url = new URL(path, apiBase);
    url.searchParams.set("per_page", String(pageSize));
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
      redirect: "error",
      signal,
    });
    if (response.status === 401) return null;
    if (response.status !== 200) return undefined;
    const body = record(await response.json());
    const count = body?.total_count;
    const rows = body?.[key];
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      (total !== undefined && count !== total) ||
      !Array.isArray(rows) ||
      rows.length !== Math.min(pageSize, Math.max(0, count - seen.size))
    ) {
      return undefined;
    }
    total = count;
    let found: Record<string, unknown> | undefined;
    for (const row of rows) {
      const entry = record(row);
      if (!entry || !validId(entry.id) || seen.has(entry.id)) return undefined;
      seen.add(entry.id);
      if (matches(entry)) {
        if (found) return undefined;
        found = entry;
      }
    }
    if (found) return found;
    if (seen.size === total) return null;
  }
  return undefined;
}

function gitHubRepositoryName(remote: string): string | null {
  // URLの正規化で別候補を受理しない。SSHや別ホストはこの実装の対象外。
  const match =
    /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/u.exec(remote);
  const owner = match?.[1];
  const name = match?.[2]?.replace(/\.git$/u, "");
  if (!owner || !name || name === "." || name === "..") return null;
  return `${owner}/${name}`.toLowerCase();
}

/** 登録候補の実測HTTPS remoteを、選択したホストの現在の対象IDへ結び付ける。 */
async function observeGitHubRepositoryBinding(input: {
  host: string;
  remote: string;
  userAccessToken: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
}): Promise<GitHostLinkedRepository | null> {
  const fullName =
    input.host === "github.com" ? gitHubRepositoryName(input.remote) : null;
  if (!fullName) return null;
  const owner = fullName.split("/", 1)[0];
  const observed = await observeGitHubRepository(
    input,
    (entry) => {
      const account = record(entry.account);
      return (
        typeof account?.login === "string" &&
        account.login.toLowerCase() === owner
      );
    },
    (entry) =>
      typeof entry.full_name === "string" &&
      entry.full_name.toLowerCase() === fullName,
  );
  return observed.status === "allowed"
    ? {
        provider: "github",
        host: "github.com",
        repositoryId: String(observed.id),
        providerData: { installationId: String(observed.installationId) },
      }
    : null;
}

/** Gitホスト側の権限だけを観測する。現在のCRDD主体との結合は呼出し側が確認する。 */
async function observeGitHubRepositoryAccess(input: {
  reference: GitHostLinkedRepository;
  userAccessToken: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
}): Promise<GitHostRepositoryAccess> {
  const ids = repositoryIds(input.reference);
  if (!ids) return { status: "unavailable" };
  const observed = await observeGitHubRepository(
    input,
    (entry) => entry.id === ids.installationId,
    (entry) => entry.id === ids.repositoryId,
  );
  if (observed.status !== "allowed") return observed;
  return {
    status: "allowed",
    read: observed.read,
    write: observed.write,
    name: observed.name,
  };
}

async function observeGitHubRepository(
  input: {
    userAccessToken: string;
    signal?: AbortSignal;
    isCurrent?: () => boolean;
  },
  matchesInstallation: (entry: Record<string, unknown>) => boolean,
  matches: (entry: Record<string, unknown>) => boolean,
): Promise<
  | (Extract<GitHostRepositoryAccess, { status: "allowed" }> & {
      id: number;
      installationId: number;
    })
  | Exclude<GitHostRepositoryAccess, { status: "allowed" }>
> {
  const { userAccessToken } = input;
  if (!/^[A-Za-z0-9_]+$/.test(userAccessToken)) {
    return { status: "unavailable" };
  }
  const timeout = AbortSignal.timeout(5_000);
  const signal = input.signal
    ? AbortSignal.any([input.signal, timeout])
    : timeout;
  try {
    const installation = await findAccessibleEntry(
      "/user/installations",
      "installations",
      matchesInstallation,
      userAccessToken,
      signal,
      input.isCurrent,
    );
    if (installation === undefined) return { status: "unavailable" };
    if (installation === null) return { status: "denied" };
    const installationId = installation.id;
    if (!validId(installationId)) return { status: "unavailable" };
    const installationPermissions = record(installation.permissions);
    if (!installationPermissions) return { status: "unavailable" };
    // GitHub固有の追加条件。Appが許可されても、本人の権限を補うことはできない。
    const appContents = installationPermissions.contents;
    if (appContents !== "read" && appContents !== "write")
      return { status: "denied" };

    const repository = await findAccessibleEntry(
      `/user/installations/${installationId}/repositories`,
      "repositories",
      matches,
      userAccessToken,
      signal,
      input.isCurrent,
    );
    if (repository === undefined) return { status: "unavailable" };
    if (repository === null) return { status: "denied" };
    const permissions = record(repository.permissions);
    if (
      typeof permissions?.pull !== "boolean" ||
      typeof permissions.push !== "boolean"
    ) {
      return { status: "unavailable" };
    }
    if (!permissions.pull) return { status: "denied" };
    if (!validId(repository.id)) return { status: "unavailable" };
    signal.throwIfAborted();
    return {
      status: "allowed",
      read: true,
      id: repository.id,
      installationId,
      name:
        typeof repository.full_name === "string"
          ? gitHubRepositoryName(
              `https://github.com/${repository.full_name}.git`,
            )
          : null,
      write: permissions.push && appContents === "write",
    };
  } catch {
    return { status: "unavailable" };
  }
}

export const gitHubProvider = Object.freeze({
  kind: "github",
  defaultHost: "github.com",
  acceptsHost: (value) => value === "github.com",
  displayName: "GitHub",
  acceptsApiBase: (value) => value === apiBase,
  readEnvironment(value, readValue) {
    const fields = record(value);
    if (
      !fields ||
      Object.keys(fields).some(
        (key) =>
          !["clientIdEnv", "clientSecretEnv", "privateKeyEnv"].includes(key),
      )
    )
      throw new Error("git_hosts_configuration_invalid");
    const privateKey =
      fields.privateKeyEnv === undefined
        ? undefined
        : readValue(fields.privateKeyEnv);
    if (fields.privateKeyEnv !== undefined && privateKey === undefined)
      throw new Error("git_host_monitor_configuration_invalid");
    const clientId = readValue(fields.clientIdEnv);
    const clientSecret = readValue(fields.clientSecretEnv);
    if (clientId === undefined || clientSecret === undefined)
      throw new Error("git_host_connection_configuration_invalid");
    return {
      clientId,
      clientSecret,
      ...(privateKey !== undefined && { privateKey }),
    };
  },
  bind(configuration: GitHostConfiguration) {
    const fields = record(configuration.providerData);
    if (
      !fields ||
      Object.keys(fields).some(
        (key) => !["clientId", "clientSecret", "privateKey"].includes(key),
      )
    )
      throw new Error("git_host_connection_configuration_invalid");
    const { clientId, clientSecret, privateKey } = fields;
    if (typeof clientId !== "string" || typeof clientSecret !== "string")
      throw new Error("git_host_connection_configuration_invalid");
    if (
      !/^[A-Za-z0-9_.-]{1,128}$/u.test(clientId) ||
      !/^[!-~]{1,1024}$/u.test(clientSecret)
    )
      throw new Error("github_connection_configuration_invalid");
    if (
      privateKey !== undefined &&
      (typeof privateKey !== "string" ||
        !privateKey ||
        privateKey.length > 16_384)
    )
      throw new Error("git_host_monitor_configuration_invalid");
    return {
      connect: (callback: URL) =>
        createGitHubConnection({
          host: configuration.host,
          clientId,
          clientSecret,
          callback,
        }),
      readRepositoryName: gitHubRepositoryName,
      observeBinding: observeGitHubRepositoryBinding,
      observeAccess: observeGitHubRepositoryAccess,
      ...(privateKey !== undefined && {
        observePermission: createGitHubPermissionObserver({
          clientId,
          privateKey,
        }),
      }),
    };
  },
} satisfies GitHostProvider);
