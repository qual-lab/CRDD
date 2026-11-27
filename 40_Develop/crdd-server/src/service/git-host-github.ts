/**
 * GitHubのアカウント連携、App権限の追加確認と本人の実効権限観測を所有する。
 * @trace ARCH-000012
 * @boundary CRDD内の認可や、HTTPセッションへの資格保管は行わない。
 */
import {
  createHash,
  createPrivateKey,
  type KeyObject,
  randomBytes,
  sign,
} from "node:crypto";
import { matchesSecret } from "./secret.ts";
import type { GitHostLinkedRepository } from "@qual-lab/crdd-access-management";

import type {
  GitHostLinkFlow,
  GitHostPermissionObservation,
  GitHostProvider,
  GitHostRepositoryAccess,
} from "./git-host.ts";

const maximumCachedInstallations = 128;
const maximumCachedAccountNames = 512;
const accountNameLifetimeMs = 5 * 60_000;
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
  privateKey: KeyObject;
}) {
  const tokens = new Map<string, { value: string; expiresAt: number }>();
  const representations = new Map<string, { etag: string; body: unknown }>();
  const observations = new Map<string, Promise<GitHostPermissionObservation>>();
  const accountNames = new Map<number, { login: string; expiresAt: number }>();
  const toBase64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const api = (
    path: string,
    token: string,
    signal: AbortSignal,
    body?: object,
    etag?: string,
  ) =>
    fetch(new URL(path, apiBase), {
      redirect: "error",
      signal,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        Authorization: `Bearer ${token}`,
        ...(etag && { "If-None-Match": etag }),
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
    const jwt = `${data}.${sign("RSA-SHA256", Buffer.from(data), configuration.privateKey).toString("base64url")}`;
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
  const readCurrent = async (
    path: string,
    token: string,
    scope: string,
    signal: AbortSignal,
    onNotFound?: () => void,
  ) => {
    const key = `${scope}:${path}`;
    const prior = representations.get(key);
    const response = await api(path, token, signal, undefined, prior?.etag);
    if (signal.aborted) return undefined;
    if (response.status === 304 && prior) return prior.body;
    if (representations.get(key) === prior) representations.delete(key);
    if (response.status === 404) onNotFound?.();
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    const etag = response.headers.get("etag");
    // 304を同じ表現の証拠にできる単一タグだけを記憶する。
    if (
      etag &&
      etag.length <= 256 &&
      /^(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/u.test(etag) &&
      !signal.aborted
    ) {
      representations.delete(key);
      if (representations.size >= maximumCachedInstallations * 4) {
        const oldest = representations.keys().next().value;
        if (oldest !== undefined) representations.delete(oldest);
      }
      representations.set(key, { etag, body });
    }
    return body;
  };
  const readAccountName = async (
    id: number,
    token: string,
    scope: string,
    signal: AbortSignal,
  ): Promise<string | null> => {
    const cached = accountNames.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.login;
    if (cached) accountNames.delete(id);
    const user = record(await readCurrent(`/user/${id}`, token, scope, signal));
    if (
      signal.aborted ||
      user?.id !== id ||
      typeof user.login !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/u.test(user.login)
    )
      return null;
    if (accountNames.size >= maximumCachedAccountNames) {
      const oldest = accountNames.keys().next().value;
      if (oldest !== undefined) accountNames.delete(oldest);
    }
    accountNames.set(id, {
      login: user.login,
      expiresAt: Date.now() + accountNameLifetimeMs,
    });
    return user.login;
  };
  const observe = async (input: {
    reference: GitHostLinkedRepository;
    accountId: string;
    signal: AbortSignal;
  }): Promise<GitHostPermissionObservation> => {
    const accountId = gitHubId(input.accountId);
    const ids = repositoryIds(input.reference);
    if (!ids || !validId(accountId) || input.signal.aborted)
      return "unavailable";
    const signal = input.signal;
    try {
      const token = await installationToken(
        ids.installationId,
        ids.repositoryId,
        signal,
      );
      if (!token) return "unavailable";
      const scope = `${ids.installationId}:${ids.repositoryId}`;
      const repositoryName = async () => {
        const payload = record(
          await readCurrent(
            "/installation/repositories?per_page=2",
            token,
            scope,
            signal,
          ),
        );
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
      const [name, login] = await Promise.all([
        repositoryName(),
        readAccountName(accountId, token, scope, signal),
      ]);
      if (!name || !login) return "unavailable";
      const forgetName = () => {
        if (accountNames.get(accountId)?.login === login)
          accountNames.delete(accountId);
      };
      const permission = record(
        await readCurrent(
          `/repos/${name}/collaborators/${login}/permission`,
          token,
          `${scope}:${accountId}`,
          signal,
          forgetName,
        ),
      );
      if (!permission) return "unavailable";
      // 304で再利用する表現にも、元の利用者と現在のリポジトリを照合する。
      if (record(permission?.user)?.id !== accountId) {
        forgetName();
        return "unavailable";
      }
      if (name !== (await repositoryName()) || signal.aborted)
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
  return async (
    input: Parameters<typeof observe>[0],
  ): Promise<GitHostPermissionObservation> => {
    const ids = repositoryIds(input.reference);
    const account = gitHubId(input.accountId);
    if (!ids || !validId(account) || input.signal.aborted) return "unavailable";
    const key = `${ids.installationId}:${ids.repositoryId}:${account}`;
    let observation = observations.get(key);
    if (!observation) {
      observation = observe({ ...input, signal: AbortSignal.timeout(5_000) });
      const tracked = observations.size < maximumCachedInstallations;
      if (tracked) {
        observations.set(key, observation);
        void observation.finally(() => observations.delete(key));
      }
    }
    return new Promise((resolve) => {
      const cancel = () => resolve("unavailable");
      input.signal.addEventListener("abort", cancel, { once: true });
      if (input.signal.aborted) cancel();
      void observation.then((result) => {
        input.signal.removeEventListener("abort", cancel);
        resolve(input.signal.aborted ? "unavailable" : result);
      });
    });
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
function createGitHubLinkFlow(input: {
  clientId: string;
  clientSecret: string;
  callback: URL;
}): GitHostLinkFlow {
  const { clientId, clientSecret } = input;
  const callback = new URL(input.callback.href);
  if (
    (callback.protocol !== "https:" &&
      !(callback.protocol === "http:" && callback.hostname === "127.0.0.1")) ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash
  ) {
    throw new Error("git_host_connection_configuration_invalid");
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

type AccessPage = { status: number; data: unknown };
type AccessPages = Map<string, AccessPage>;

async function findAccessibleEntry(
  path: string,
  key: "installations" | "repositories",
  matches: (entry: Record<string, unknown>) => boolean,
  token: string,
  signal: AbortSignal,
  isCurrent?: () => boolean,
  pages?: AccessPages,
): Promise<Record<string, unknown> | null | undefined> {
  let total: number | undefined;
  const seen = new Set<number>();
  for (let page = 1; page <= maxPages; page += 1) {
    if (signal.aborted || (isCurrent && !isCurrent())) return undefined;
    const url = new URL(path, apiBase);
    url.searchParams.set("per_page", String(pageSize));
    url.searchParams.set("page", String(page));
    let observed = pages?.get(url.href);
    if (!observed) {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal,
      });
      observed = {
        status: response.status,
        data: response.status === 200 ? await response.json() : null,
      };
      pages?.set(url.href, observed);
    }
    if (observed.status === 401) return null;
    if (observed.status !== 200) return undefined;
    const body = record(observed.data);
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
async function observeGitHubRepositoryAccess(
  input: {
    reference: GitHostLinkedRepository;
    userAccessToken: string;
    signal?: AbortSignal;
    isCurrent?: () => boolean;
  },
  pages?: AccessPages,
): Promise<GitHostRepositoryAccess> {
  const ids = repositoryIds(input.reference);
  if (!ids) return { status: "unavailable" };
  const observed = await observeGitHubRepository(
    input,
    (entry) => entry.id === ids.installationId,
    (entry) => entry.id === ids.repositoryId,
    pages,
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
  pages?: AccessPages,
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
      pages,
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
      pages,
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

type GitHubConfiguration = Readonly<{
  clientId: string;
  clientSecret: string;
  privateKey?: KeyObject;
}>;
export const gitHubProvider = Object.freeze({
  kind: "github",
  credentialEnvironmentPrefix: "CRDD_GITHUB_",
  defaultHost: "github.com",
  acceptsHost: (value) => value === "github.com",
  displayName: "GitHub",
  acceptsApiBase: (value) => value === apiBase,
  parseConfiguration(value, readValue) {
    const fields = record(value);
    const keys = readValue
      ? ["clientIdEnv", "clientSecretEnv", "privateKeyEnv"]
      : ["clientId", "clientSecret", "privateKey"];
    if (!fields || Object.keys(fields).some((key) => !keys.includes(key)))
      throw new Error("git_hosts_configuration_invalid");
    const rawPrivateKey = readValue ? fields.privateKeyEnv : fields.privateKey;
    const privateKey =
      readValue && rawPrivateKey !== undefined
        ? readValue(rawPrivateKey)
        : rawPrivateKey;
    if (rawPrivateKey !== undefined && privateKey === undefined)
      throw new Error("git_host_monitor_configuration_invalid");
    const clientId = readValue
      ? readValue(fields.clientIdEnv)
      : fields.clientId;
    const clientSecret = readValue
      ? readValue(fields.clientSecretEnv)
      : fields.clientSecret;
    if (typeof clientId !== "string" || typeof clientSecret !== "string")
      throw new Error("git_host_connection_configuration_invalid");
    if (
      !/^[A-Za-z0-9_.-]{1,128}$/u.test(clientId) ||
      !/^[!-~]{1,1024}$/u.test(clientSecret)
    )
      throw new Error("git_host_connection_configuration_invalid");
    if (
      privateKey !== undefined &&
      (typeof privateKey !== "string" ||
        !privateKey ||
        privateKey.length > 16_384)
    )
      throw new Error("git_host_monitor_configuration_invalid");
    let key: KeyObject | undefined;
    if (privateKey !== undefined) {
      try {
        const parsed = createPrivateKey(privateKey);
        if (
          parsed.asymmetricKeyType === "rsa" &&
          (parsed.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048
        )
          key = parsed;
      } catch {
        // 秘密値や暗号ライブラリの詳細を起動診断に出さない。
      }
      if (!key) throw new Error("git_host_monitor_configuration_invalid");
    }
    return {
      clientId,
      clientSecret,
      ...(key && { privateKey: key }),
    };
  },
  bind(_identity, { clientId, clientSecret, privateKey }) {
    return {
      createLinkFlow: (callback: URL) =>
        createGitHubLinkFlow({
          clientId,
          clientSecret,
          callback,
        }),
      async revokeUserToken(accessToken: string) {
        const response = await fetch(
          new URL(
            `/applications/${encodeURIComponent(clientId)}/token`,
            apiBase,
          ),
          {
            method: "DELETE",
            redirect: "error",
            signal: AbortSignal.timeout(5000),
            headers: {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2026-03-10",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ access_token: accessToken }),
          },
        );
        await response.body?.cancel();
        return response.status === 204;
      },
      readRepositoryName: gitHubRepositoryName,
      observeBinding: observeGitHubRepositoryBinding,
      observeAccess: observeGitHubRepositoryAccess,
      createAccessObservation(userAccessToken: string) {
        const pages: AccessPages = new Map();
        return (input: Parameters<typeof observeGitHubRepositoryAccess>[0]) =>
          input.userAccessToken === userAccessToken
            ? observeGitHubRepositoryAccess(input, pages)
            : Promise.resolve({ status: "unavailable" as const });
      },
      ...(privateKey !== undefined && {
        observePermission: createGitHubPermissionObserver({
          clientId,
          privateKey,
        }),
      }),
    };
  },
} satisfies GitHostProvider<GitHubConfiguration>);
