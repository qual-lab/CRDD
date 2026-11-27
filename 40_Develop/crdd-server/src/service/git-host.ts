/**
 * Gitホスト提供元の選択と、提供元に依存しない連携資格の寿命を所有する。
 * @trace ARCH-000012
 * @boundary リポジトリのURLから資格の送信先を選ばない。
 */
import { randomUUID } from "node:crypto";
import type { GitHostLinkedRepository } from "@qual-lab/crdd-access-management";
import { gitHubProvider } from "./git-host-github.ts";

/** ブラウザーのセッション所有者が使う、Gitホストへの本人連携。 */
export type ApprovedGitHostLink = Readonly<{
  accountId: string;
  accessToken: string;
  expiresAt: number;
}>;

export type GitHostLinkFlow = Readonly<{
  begin(sessionId: string): URL | null;
  cancel(sessionId: string): void;
  complete(
    search: URLSearchParams,
    sessionId: string,
    isCurrentSession: () => boolean,
    signal: AbortSignal,
  ): Promise<ApprovedGitHostLink | null>;
}>;

/** 提供元に依存しない、接続した本人の対象リポジトリへの実効権限。 */
export type GitHostRepositoryAccess =
  | { status: "allowed"; read: true; write: boolean; name: string | null }
  | { status: "denied" | "unavailable" };

type AccountBinding = Readonly<{ userId: string; bindingId: string }>;
type GitHostDisconnect = "revoked" | "unconfirmed" | "absent";
const maximumLinks = 128;
const maximumLinksPerUser = 8;

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

type GitHostIdentity = Omit<GitHostConfiguration, "providerData">;
type ReadGitHostSecret = (name: unknown) => string | undefined;
type GitHostProfile = Readonly<{
  kind: string;
  displayName: string;
  defaultHost?: string;
  credentialEnvironmentPrefix?: string;
  acceptsHost: (host: string) => boolean;
  acceptsApiBase?: (value: string, host: string) => boolean;
}>;
type GitHostOperations = Readonly<{
  createLinkFlow: (callback: URL) => GitHostLinkFlow;
  revokeUserToken?: (accessToken: string) => Promise<boolean>;
  readRepositoryName: (remote: string) => string | null;
  observeBinding: (
    input: GitHostBindingInput,
  ) => Promise<GitHostLinkedRepository | null>;
  observeAccess: (
    input: GitHostAccessInput,
  ) => Promise<GitHostRepositoryAccess>;
  createAccessObservation?: (
    userAccessToken: string,
  ) => (input: GitHostAccessInput) => Promise<GitHostRepositoryAccess>;
  observePermission?: GitHostMonitor;
}>;
export type GitHostProvider<C> = GitHostProfile &
  Readonly<{
    parseConfiguration: (value: unknown, readSecret?: ReadGitHostSecret) => C;
    bind: (identity: GitHostIdentity, configuration: C) => GitHostOperations;
  }>;
type RegisteredGitHostProvider = GitHostProfile &
  Readonly<{
    configure: (
      identity: GitHostIdentity,
      value: unknown,
      readSecret?: ReadGitHostSecret,
    ) => () => GitHostOperations;
  }>;
export function registerGitHostProvider<C>(
  provider: GitHostProvider<C>,
): RegisteredGitHostProvider {
  const { parseConfiguration, bind, ...profile } = provider;
  return {
    ...profile,
    configure(identity, value, readSecret) {
      const configuration = parseConfiguration(value, readSecret);
      return () => bind(identity, configuration);
    },
  };
}

const providers: ReadonlyMap<string, RegisteredGitHostProvider> = new Map([
  [gitHubProvider.kind, registerGitHostProvider(gitHubProvider)],
]);
type ConfiguredGitHost = Readonly<{
  provider: RegisteredGitHostProvider;
  configuration: GitHostIdentity & Readonly<{ providerData: undefined }>;
  operations: () => GitHostOperations;
}>;
const preparedGitHosts = new WeakMap<object, ConfiguredGitHost>();

/** 設定の資格だけを子プロセス等へ引き継がない。 */
export function isGitHostCredentialEnvironment(name: string) {
  const key = name.toUpperCase();
  if (!/^[A-Z0-9_]+$/u.test(key)) return false;
  if (key.startsWith("CRDD_GIT_HOST_") && key.length > "CRDD_GIT_HOST_".length)
    return true;
  return [...providers.values()].some(
    ({ credentialEnvironmentPrefix }) =>
      credentialEnvironmentPrefix !== undefined &&
      key.startsWith(credentialEnvironmentPrefix) &&
      key.length > credentialEnvironmentPrefix.length,
  );
}

/** 共有の生設定から、静的に登録した提供元に対応する構成だけを取得する。 */
export function configuredGitHosts(
  value: unknown,
  readValue?: (name: unknown) => string | undefined,
  registered = providers,
): ConfiguredGitHost[] {
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
    const identity: GitHostIdentity = {
      host,
      provider: provider.kind,
      ...(apiBase !== undefined && { apiBase }),
    };
    hosts.add(host);
    const prepared = preparedGitHosts.get(entry);
    if (readValue === undefined && prepared?.provider === provider)
      return prepared;
    const configuration = Object.freeze({
      ...identity,
      providerData: undefined,
    });
    const configured = {
      provider,
      configuration,
      operations: provider.configure(identity, providerData, readValue),
    };
    preparedGitHosts.set(configuration, configured);
    return configured;
  });
}

/** 起動時に選んだ提供元・ホストの組だけに操作を結合する。 */
export interface BoundGitHost {
  readonly id: string;
  readonly host: string;
  readonly displayName: string;
  readonly acceptsReference: (reference: GitHostLinkedRepository) => boolean;
  readonly createLinkFlow: GitHostOperations["createLinkFlow"];
  readonly revokeUserToken: GitHostOperations["revokeUserToken"];
  readonly readRepositoryName: GitHostOperations["readRepositoryName"];
  readonly observeBinding: (
    input: Omit<GitHostBindingInput, "host">,
  ) => Promise<GitHostLinkedRepository | null>;
  readonly observeAccess: GitHostOperations["observeAccess"];
  readonly createAccessObservation?: NonNullable<
    GitHostOperations["createAccessObservation"]
  >;
  readonly observePermission?: GitHostMonitor;
}

/** ホストを越えないように提供元の操作へ対象を結合する。 */
export function bindGitHost({
  provider,
  configuration,
  operations: createOperations,
}: ConfiguredGitHost): BoundGitHost {
  const { host } = configuration;
  const operations = createOperations();
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
  const accessObservation = operations.createAccessObservation;
  return Object.freeze({
    id:
      host === provider.defaultHost
        ? provider.kind
        : `${provider.kind}.${host}`,
    host,
    displayName: provider.displayName,
    acceptsReference,
    createLinkFlow: operations.createLinkFlow,
    revokeUserToken: operations.revokeUserToken,
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
    ...(accessObservation && {
      createAccessObservation: (userAccessToken: string) => {
        const read = accessObservation(userAccessToken);
        return (input: GitHostAccessInput): Promise<GitHostRepositoryAccess> =>
          acceptsReference(input.reference) &&
          input.userAccessToken === userAccessToken
            ? read(input)
            : Promise.resolve({ status: "unavailable" });
      },
    }),
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

export type ReadGitHost = (host: string) => BoundGitHost | undefined;

/** 対話資格の読取り、実行監視参照、明示失効を分離する。 */
export interface GitHostLinks {
  readonly save: (
    binding: AccountBinding,
    linked: { accountId: string; accessToken: string; expiresAt: number },
    collectBrowserReferences?: () => ReadonlySet<string>,
  ) => string | null;
  readonly read: (reference: string, binding: AccountBinding) => string | null;
  readonly readAccountId: (
    reference: string,
    binding: AccountBinding,
  ) => string | null;
  readonly open: (
    reference: string,
    binding: AccountBinding,
  ) => {
    accountId: string;
    revocationSignal: AbortSignal;
    close: () => void;
  } | null;
  readonly signOut: (userId: string) => Promise<boolean>;
  readonly disconnect: (
    reference: string,
    binding: AccountBinding,
  ) => Promise<GitHostDisconnect>;
  readonly close: () => void;
}

/** 対話用トークンではなく、元のGitアカウントと提供元の実行監視だけを結ぶ。 */
export function openGitHostExecutionAccess(
  gitHost:
    | Readonly<{
        links: GitHostLinks;
        observePermission?: GitHostMonitor;
      }>
    | undefined,
  reference: string,
  binding: AccountBinding,
) {
  if (!gitHost?.observePermission) return null;
  const link = gitHost.links.open(reference, binding);
  return link && { ...link, observePermission: gitHost.observePermission };
}

/** 同じ本人とGitホストアカウントの参照を保ち、対話用資格だけを更新する。 @trace ARCH-000012 */
export function createGitHostLinks(
  collectGrantReferences: () => ReadonlySet<string> = () => new Set(),
  revokeUserToken?: GitHostOperations["revokeUserToken"],
): GitHostLinks {
  type Link = AccountBinding & {
    accountId: string;
    accessToken: string | null;
    expiresAt: number;
    timer: NodeJS.Timeout | undefined;
    observers: number;
    revocation: AbortController;
  };
  const links = new Map<string, Link>();
  const revocations = new Map<string, Promise<boolean>>();
  const disconnections = new Map<
    string,
    { binding: AccountBinding; result: Promise<GitHostDisconnect> }
  >();
  const signOuts = new Map<string, Promise<boolean>>();
  const sameBinding = (link: Link, binding: AccountBinding) =>
    link.userId === binding.userId && link.bindingId === binding.bindingId;
  const clearCredential = (link: Link) => {
    clearTimeout(link.timer);
    link.timer = undefined;
    link.accessToken = null;
  };
  const remove = (reference: string, link: Link, revoke: boolean) => {
    links.delete(reference);
    clearCredential(link);
    if (revoke) link.revocation.abort();
  };
  const revoke = (token: string | null): Promise<boolean> => {
    if (token === null) return Promise.resolve(true);
    const inFlight = revocations.get(token);
    if (inFlight) return inFlight;
    const attempt = Promise.resolve()
      .then(() => revokeUserToken?.(token))
      .then(
        (confirmed) => confirmed === true,
        () => false,
      )
      .finally(() => revocations.delete(token));
    revocations.set(token, attempt);
    return attempt;
  };
  const lookup = (reference: string, binding: AccountBinding) => {
    const link = links.get(reference);
    if (!link || !sameBinding(link, binding)) return null;
    if (link.expiresAt <= Date.now()) clearCredential(link);
    return link.accessToken === null ? null : link;
  };
  return Object.freeze({
    save(
      binding: AccountBinding,
      linked: { accountId: string; accessToken: string; expiresAt: number },
      collectBrowserReferences: () => ReadonlySet<string> = () => new Set(),
    ) {
      const { accountId, accessToken, expiresAt } = linked;
      const remaining = expiresAt - Date.now();
      if (
        typeof accountId !== "string" ||
        !/^[!-~]{1,255}$/u.test(accountId) ||
        !accessToken ||
        revocations.has(accessToken) ||
        !Number.isFinite(remaining) ||
        remaining <= 0
      )
        return null;
      const existing = [...links].find(
        ([, link]) =>
          sameBinding(link, binding) && link.accountId === accountId,
      );
      const reference = existing?.[0] ?? randomUUID();
      if (!existing && links.has(reference)) return null;
      if (!existing) {
        const userFull =
          [...links.values()].filter((link) => link.userId === binding.userId)
            .length >= maximumLinksPerUser;
        if (userFull || links.size >= maximumLinks) {
          const browserReferences = collectBrowserReferences();
          const grantReferences = collectGrantReferences();
          const victim = [...links].find(
            ([id, link]) =>
              (!userFull || link.userId === binding.userId) &&
              link.observers === 0 &&
              !browserReferences.has(id) &&
              !grantReferences.has(id),
          );
          if (!victim) return null;
          remove(...victim, false);
        }
      }
      const link: Link = existing?.[1] ?? {
        ...binding,
        accountId,
        accessToken: null,
        expiresAt,
        timer: undefined,
        observers: 0,
        revocation: new AbortController(),
      };
      clearCredential(link);
      link.accessToken = accessToken;
      link.expiresAt = expiresAt;
      link.timer = setTimeout(() => clearCredential(link), remaining).unref();
      // 容量を超えたときだけ、更新の古い未参照記録から整理する。
      links.delete(reference);
      links.set(reference, link);
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
      if (!link) return null;
      link.observers++;
      let closed = false;
      return {
        accountId: link.accountId,
        revocationSignal: link.revocation.signal,
        close() {
          if (closed) return;
          closed = true;
          link.observers--;
        },
      };
    },
    async signOut(userId: string) {
      const tokens = new Set<string>();
      for (const [reference, link] of links)
        if (link.userId === userId) {
          if (link.accessToken !== null) tokens.add(link.accessToken);
          if (link.observers > 0) clearCredential(link);
          else remove(reference, link, false);
        }
      const pending = [...disconnections.values()]
        .filter(({ binding }) => binding.userId === userId)
        .map(({ result }) => result.then((value) => value !== "unconfirmed"));
      const prior = signOuts.get(userId);
      if (prior) pending.push(prior);
      pending.push(...[...tokens].map(revoke));
      const result = Promise.all(pending).then((confirmed) =>
        confirmed.every(Boolean),
      );
      signOuts.set(userId, result);
      try {
        return await result;
      } finally {
        if (signOuts.get(userId) === result) signOuts.delete(userId);
      }
    },
    async disconnect(
      reference: string,
      binding: AccountBinding,
    ): Promise<GitHostDisconnect> {
      const closing = disconnections.get(reference);
      if (closing)
        return closing.binding.userId === binding.userId &&
          closing.binding.bindingId === binding.bindingId
          ? closing.result
          : "absent";
      const link = links.get(reference);
      if (!link || !sameBinding(link, binding)) return "absent";
      const token = link.accessToken;
      const result = revoke(token)
        .then(
          (confirmed): GitHostDisconnect =>
            token === null ? "absent" : confirmed ? "revoked" : "unconfirmed",
        )
        .finally(() => disconnections.delete(reference));
      disconnections.set(reference, { binding, result });
      remove(reference, link, true);
      return result;
    },
    close() {
      for (const [reference, link] of links) remove(reference, link, true);
    },
  });
}
