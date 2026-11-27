/**
 * Gitホスト提供元の選択と、提供元に依存しない連携資格の寿命を所有する。
 * @trace ARCH-000012
 * @boundary リポジトリのURLから資格の送信先を選ばない。
 */
import { randomUUID } from "node:crypto";
import type { GitHostLinkedRepository } from "@qual-lab/crdd-access-management";
import { gitHubProvider } from "./git-host-github.ts";

/** ブラウザーのセッション所有者が使う、Gitホストへの本人連携。 */
export type GitHostConnection = Readonly<{
  begin(sessionId: string): URL | null;
  cancel(sessionId: string): void;
  complete(
    search: URLSearchParams,
    sessionId: string,
    isCurrentSession: () => boolean,
    signal: AbortSignal,
  ): Promise<{
    accountId: string;
    accessToken: string;
    expiresAt: number;
  } | null>;
}>;

/** 提供元に依存しない、接続した本人の対象リポジトリへの実効権限。 */
export type GitHostRepositoryAccess =
  | { status: "allowed"; read: true; write: boolean; name: string | null }
  | { status: "denied" | "unavailable" };

type AccountBinding = Readonly<{ userId: string; bindingId: string }>;
const maximumLinks = 128;

export type GitHostPermissionObservation =
  | { permission: "none" | "read" | "write"; repositoryName: string }
  | "unavailable";

export type GitHostConfiguration = Readonly<{
  host: string;
  provider: string;
  apiBase?: string;
  providerData: unknown;
}>;
type GitHostBindingInput = {
  host: string;
  remote: string;
  userAccessToken: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
};
type GitHostAccessInput = {
  reference: GitHostLinkedRepository;
  userAccessToken: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
};
type GitHostMonitor = (input: {
  reference: GitHostLinkedRepository;
  accountId: string;
  signal: AbortSignal;
}) => Promise<GitHostPermissionObservation>;

export type GitHostProvider = Readonly<{
  kind: string;
  displayName: string;
  defaultHost?: string;
  acceptsHost: (host: string) => boolean;
  acceptsApiBase?: (value: string, host: string) => boolean;
  readEnvironment: (
    value: unknown,
    readValue: (name: unknown) => string | undefined,
  ) => unknown;
  bind: (configuration: GitHostConfiguration) => Readonly<{
    connect: (callback: URL) => GitHostConnection;
    readRepositoryName: (remote: string) => string | null;
    observeBinding: (
      input: GitHostBindingInput,
    ) => Promise<GitHostLinkedRepository | null>;
    observeAccess: (
      input: GitHostAccessInput,
    ) => Promise<GitHostRepositoryAccess>;
    observePermission?: GitHostMonitor;
  }>;
}>;

const providers: ReadonlyMap<string, GitHostProvider> = new Map([
  [gitHubProvider.kind, gitHubProvider],
]);

/** 設定の資格だけを子プロセス等へ引き継がない。 */
export function isGitHostCredentialEnvironment(name: string) {
  return /^CRDD_(?:GIT_HOST|GITHUB)_[A-Z0-9_]+$/u.test(name.toUpperCase());
}

/** 共有の生設定から、静的に登録した提供元に対応する構成だけを取得する。 */
export function configuredGitHosts(
  value: unknown,
  readValue?: (name: unknown) => string | undefined,
  registered = providers,
) {
  if (!Array.isArray(value) || value.length > 16)
    throw new Error("git_hosts_configuration_invalid");
  const hosts = new Set<string>();
  return value.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      Object.keys(entry).some(
        (key) => !["host", "provider", "apiBase", "providerData"].includes(key),
      )
    )
      throw new Error("git_hosts_configuration_invalid");
    const {
      host,
      provider: kind,
      apiBase,
      providerData,
    } = entry as Partial<GitHostConfiguration>;
    const provider =
      typeof kind === "string" ? registered.get(kind) : undefined;
    if (
      typeof host !== "string" ||
      host.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(
        host,
      ) ||
      !provider ||
      provider.kind !== kind ||
      !/^[a-z0-9][a-z0-9-]{0,31}$/u.test(kind) ||
      !provider.acceptsHost(host) ||
      hosts.has(host) ||
      (apiBase !== undefined &&
        (typeof apiBase !== "string" ||
          provider.acceptsApiBase?.(apiBase, host) !== true))
    )
      throw new Error("git_hosts_configuration_invalid");
    const configuration: GitHostConfiguration = {
      host,
      provider: provider.kind,
      ...(apiBase !== undefined && { apiBase }),
      providerData: readValue
        ? provider.readEnvironment(providerData, readValue)
        : providerData,
    };
    hosts.add(host);
    return { provider, configuration };
  });
}

/** 起動時に選んだ提供元・ホストの組だけに操作を結合する。 */
export function bindGitHost({
  provider,
  configuration,
}: ReturnType<typeof configuredGitHosts>[number]) {
  const { host } = configuration;
  const operations = provider.bind(configuration);
  const acceptsReference = (reference: GitHostLinkedRepository) =>
    reference.host === host && reference.provider === provider.kind;
  const acceptsRemote = (remote: string) => {
    const url = URL.parse(remote);
    return (
      url?.protocol === "https:" &&
      url.hostname === host &&
      !url.username &&
      !url.password
    );
  };
  const observe = operations.observePermission;
  return Object.freeze({
    id:
      host === provider.defaultHost
        ? provider.kind
        : `${provider.kind}.${host}`,
    host,
    displayName: provider.displayName,
    acceptsReference,
    connect: operations.connect,
    readRepositoryName: (remote: string) =>
      acceptsRemote(remote) ? operations.readRepositoryName(remote) : null,
    async observeBinding(input: Omit<GitHostBindingInput, "host">) {
      if (!acceptsRemote(input.remote)) return null;
      const resolved = await operations.observeBinding({ ...input, host });
      return resolved && acceptsReference(resolved) ? resolved : null;
    },
    async observeAccess(
      input: GitHostAccessInput,
    ): Promise<GitHostRepositoryAccess> {
      return acceptsReference(input.reference)
        ? operations.observeAccess(input)
        : { status: "unavailable" };
    },
    ...(observe && {
      observePermission: (
        input: Parameters<GitHostMonitor>[0],
      ): ReturnType<GitHostMonitor> =>
        acceptsReference(input.reference)
          ? observe(input)
          : Promise.resolve("unavailable"),
    }),
  });
}

export type BoundGitHost = ReturnType<typeof bindGitHost>;
export type ReadGitHost = (host: string) => BoundGitHost | undefined;

/** Gitホスト資格を、通信方式によらず同じ紐付けと期限に限定する。 @trace ARCH-000012 */
export function createGitHostLinks() {
  const links = new Map<
    string,
    AccountBinding & {
      accountId: string;
      accessToken: string | null;
      expiresAt: number;
      timer: NodeJS.Timeout;
      state: "current" | "revoked" | "unavailable";
      observers: number;
      revocation: AbortController;
    }
  >();
  const remove = (
    reference: string,
    state: "revoked" | "unavailable" = "revoked",
  ) => {
    const link = links.get(reference);
    if (link) {
      clearTimeout(link.timer);
      link.accessToken = null;
      link.state = state;
      if (state === "revoked") link.revocation.abort();
      if (state === "unavailable" && link.observers > 0) return;
    }
    links.delete(reference);
  };
  const lookup = (reference: string, binding: AccountBinding) => {
    const link = links.get(reference);
    if (
      !link ||
      link.userId !== binding.userId ||
      link.bindingId !== binding.bindingId
    )
      return null;
    if (link.expiresAt <= Date.now()) {
      remove(reference, "unavailable");
      return null;
    }
    return link;
  };
  return Object.freeze({
    save(
      binding: AccountBinding,
      linked: { accountId: string; accessToken: string; expiresAt: number },
    ) {
      const { accountId, accessToken, expiresAt } = linked;
      const now = Date.now();
      const remaining = expiresAt - now;
      if (
        typeof accountId !== "string" ||
        !/^[!-~]{1,255}$/u.test(accountId) ||
        !Number.isFinite(remaining) ||
        remaining <= 0
      )
        return null;
      if (links.size >= maximumLinks) {
        for (const [reference, link] of links)
          if (link.expiresAt <= now) remove(reference, "unavailable");
        if (links.size >= maximumLinks) return null;
      }
      const reference = randomUUID();
      if (links.has(reference)) return null;
      links.set(reference, {
        ...binding,
        accountId,
        accessToken,
        expiresAt,
        timer: setTimeout(
          () => remove(reference, "unavailable"),
          remaining,
        ).unref(),
        state: "current",
        observers: 0,
        revocation: new AbortController(),
      });
      return reference;
    },
    read(reference: string, binding: AccountBinding) {
      return lookup(reference, binding)?.accessToken ?? null;
    },
    readAccountId(reference: string, binding: AccountBinding) {
      return lookup(reference, binding)?.accountId ?? null;
    },
    open(reference: string, binding: AccountBinding) {
      const link = lookup(reference, binding);
      if (!link?.accessToken) return null;
      link.observers++;
      let closed = false;
      return {
        accountId: link.accountId,
        revocationSignal: link.revocation.signal,
        close() {
          if (closed) return;
          closed = true;
          if (--link.observers === 0 && link.state === "unavailable")
            remove(reference, "unavailable");
        },
      };
    },
    signOut(userId: string) {
      for (const [reference, link] of links)
        if (link.userId === userId) remove(reference, "unavailable");
    },
    discard(reference: string) {
      remove(reference, "unavailable");
    },
    disconnect(reference: string, binding: AccountBinding) {
      const linked = links.get(reference);
      if (
        !linked ||
        linked.userId !== binding.userId ||
        linked.bindingId !== binding.bindingId
      )
        return;
      for (const [key, link] of links)
        if (
          link.userId === binding.userId &&
          link.bindingId === binding.bindingId &&
          link.accountId === linked.accountId
        )
          remove(key);
    },
    remove,
    close() {
      for (const reference of links.keys()) remove(reference);
    },
  });
}
