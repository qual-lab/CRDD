/**
 * ブラウザーセッション・管理セッションとGit連携の状態遷移を所有する。
 * @trace ARCH-000012
 * @boundary HTTP、Cookie、OAuthの往復は扱わず、確認済みの本人と操作だけを受ける。
 */
import { createHash, randomBytes } from "node:crypto";
import {
  type AccountAccessPrincipal,
  type AccessRole,
  evaluateManagementPermission,
} from "@qual-lab/crdd-access-management";
import {
  createGitHostLinkedAccessSession,
  type GitHostLinkedExecutionClientAccess,
} from "./access.ts";
import {
  type ApprovedGitHostLink,
  type GitHostLinks,
  type ReadGitHost,
  openGitHostExecutionAccess,
} from "./git-host.ts";
import type { RepositoryScope } from "./repository-scope.ts";
import { matchesSecret } from "./secret.ts";

export type VerifiedIdentity = Readonly<{ issuer: string; subject: string }>;
export type InvitationProof = Readonly<{
  digest: string;
  email: string;
  emailVerified: true;
}>;
export type AccountBinding = Readonly<{ userId: string; bindingId: string }>;
export type AccountObservation =
  | {
      status: "completed";
      account: AccountBinding & { username: string; role: AccessRole };
    }
  | { status: "rejected" }
  | { status: "unavailable" };

export type ManagementSessionObservation = Readonly<{
  principal: AccountAccessPrincipal;
  formToken: string;
  readGitHost: ReadGitHost;
  readHostToken: (host: string) => string | null;
}>;

export type ManagementSessionChange =
  | { status: "opened"; id: string }
  | {
      status:
        | "closed"
        | "no_session"
        | "cancelled"
        | "rejected"
        | "unavailable";
    };

export type SessionGitHost = Readonly<{
  host: string;
  cancelPending: (id: string) => void;
  links: GitHostLinks;
  observePermission?: GitHostLinkedExecutionClientAccess["observePermission"];
}>;

export const digestInvitation = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const managementSessionLifetimeSeconds = 5 * 60;
export const clientSessionLifetimeSeconds = 30 * 60;
const maximumClientSessions = 128;
const maximumClientSessionsPerAccount = 4;

interface ManagementSession {
  readonly id: string;
  readonly formToken: string;
  readonly expiresAt: number;
}

/** 現在の管理権限と元セッションの期限から短命の管理セッションを発行する。 */
function openManagementSession(
  role: AccessRole,
  sessionExpiresAt: number,
): ManagementSession | null {
  if (
    evaluateManagementPermission(role, {
      operation: "openManagementSession",
    }) !== "allowed"
  )
    return null;
  return {
    id: randomBytes(32).toString("base64url"),
    formToken: randomBytes(32).toString("base64url"),
    expiresAt: Math.min(
      sessionExpiresAt,
      Date.now() + managementSessionLifetimeSeconds * 1_000,
    ),
  };
}

type ClientSession = {
  identity: Readonly<{ issuer: string; subject: string }>;
  binding: Readonly<{ userId: string; bindingId: string }>;
  expiresAt: number;
  management?: ManagementSession;
  gitHostReferences: Map<string, string>;
};

/** 入口のCookieに依存せず、本人ごとの容量・期限と接続の置換を管理する。 */
function createClientSessions(
  onRemove: (id: string, discarded?: ClientSession) => void,
) {
  const sessions = new Map<string, ClientSession>();
  const remove = (id: string, reason: "ended" | "removed" = "removed") => {
    onRemove(id, reason === "removed" ? sessions.get(id) : undefined);
    sessions.delete(id);
  };
  const read = (id: string) => {
    const session = sessions.get(id);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      remove(id, "ended");
      return null;
    }
    return { token: id, session };
  };
  const start = (
    id: string,
    identity: ClientSession["identity"],
    { userId, bindingId }: ClientSession["binding"],
    previous?: string,
  ) => {
    const now = Date.now();
    for (const [key, session] of sessions)
      if (session.expiresAt <= now) remove(key, "ended");
    if (previous) remove(previous);
    const owned = [...sessions].filter(
      ([, session]) =>
        session.binding.userId === userId &&
        session.binding.bindingId === bindingId,
    );
    for (const [key] of owned.slice(
      0,
      Math.max(0, owned.length - maximumClientSessionsPerAccount + 1),
    ))
      remove(key, "ended");
    if (sessions.size >= maximumClientSessions) {
      const oldest = sessions.keys().next().value;
      if (oldest !== undefined) remove(oldest, "ended");
    }
    sessions.set(id, {
      identity,
      binding: { userId, bindingId },
      expiresAt: now + clientSessionLifetimeSeconds * 1_000,
      gitHostReferences: new Map(),
    });
  };
  return {
    sessions: sessions as ReadonlyMap<string, ClientSession>,
    read,
    start,
    remove,
  };
}

export function createBrowserSessions({
  readAccount,
  acceptInvitation,
  invalidateMcpAccount,
  readGitHost,
  repositoryScope,
  gitHosts,
}: Readonly<{
  readAccount: (
    identity: VerifiedIdentity,
    session?: AccountBinding,
  ) => AccountObservation;
  acceptInvitation:
    | ((
        identity: VerifiedIdentity,
        proof: InvitationProof,
      ) => AccountObservation)
    | undefined;
  invalidateMcpAccount: ((userId: string) => void) | undefined;
  readGitHost: ReadGitHost;
  repositoryScope: RepositoryScope;
  gitHosts: ReadonlyMap<string, SessionGitHost>;
}>) {
  const {
    sessions,
    read,
    start,
    remove: removeSession,
  } = createClientSessions((id) => {
    for (const host of gitHosts.values()) host.cancelPending(id);
  });

  const readSession = (token: string | undefined) =>
    token ? read(token) : null;
  const readManagement = (
    token: string | undefined,
    managementId: string | null | undefined,
  ): ManagementSessionObservation | null => {
    const entry = readSession(token);
    const management = entry?.session.management;
    if (
      !entry ||
      !management ||
      management.expiresAt <= Date.now() ||
      !matchesSecret(managementId, management.id)
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
    token: string | undefined,
    operation: "open" | "close",
    isActive: () => boolean,
  ): ManagementSessionChange => {
    const entry = readSession(token);
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
    token: string | undefined,
    discardRejectedSession = true,
  ): AccountObservation => {
    const entry = readSession(token);
    if (!entry) return { status: "rejected" };
    const { token: sessionId, session } = entry;
    const current = readAccount(session.identity, session.binding);
    if (current.status === "rejected" && discardRejectedSession)
      removeSession(sessionId);
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
  const readGitHostLinkedAccessSession = (token: string | undefined) => {
    const entry = readSession(token);
    if (!entry) return null;
    const references = new Map(entry.session.gitHostReferences);
    const isCurrent = () =>
      sessions.get(entry.token) === entry.session &&
      entry.session.expiresAt > Date.now();
    return createGitHostLinkedAccessSession({
      principal: {
        kind: "account" as const,
        ...entry.session.binding,
        expiresAt: entry.session.expiresAt,
      },
      browserSessionKey: entry.session,
      isCurrent,
      readGitHost,
      repositoryScope,
      readReference: (host) => {
        const reference = references.get(host);
        return entry.session.gitHostReferences.get(host) === reference
          ? reference
          : null;
      },
      readToken: (host) => activeHostToken(entry.session, host),
      open: (host, reference) =>
        openGitHostExecutionAccess(
          gitHosts.get(host),
          reference,
          entry.session.binding,
        ),
    });
  };
  const readMcpReferences = (token: string | undefined) => {
    const entry = readSession(token);
    const references = new Map<string, string>();
    if (entry)
      for (const [host, reference] of entry.session.gitHostReferences)
        if (activeHostToken(entry.session, host))
          references.set(host, reference);
    return references;
  };

  function completeLogin(
    identity: VerifiedIdentity,
    invitation: InvitationProof | undefined,
    token: string | undefined,
  ) {
    const id = randomBytes(32).toString("base64url");
    if (sessions.has(id)) return { status: "unavailable" } as const;
    const account = invitation
      ? acceptInvitation?.(identity, invitation)
      : readAccount(identity);
    if (!account) return { status: "rejected" } as const;
    if (account.status !== "completed") return account;
    start(id, identity, account.account, token);

    return { status: "started", id } as const;
  }
  async function signOut(token: string | undefined) {
    const account = readCurrent(token, false);
    if (account.status === "unavailable") return account.status;
    const revocations: Promise<boolean>[] = [];
    if (account.status === "completed") {
      invalidateMcpAccount?.(account.account.userId);
      for (const gitHost of gitHosts.values()) {
        for (const [id, session] of sessions)
          if (session.binding.userId === account.account.userId) {
            gitHost.cancelPending(id);
            session.gitHostReferences.delete(gitHost.host);
          }
        revocations.push(gitHost.links.signOut(account.account.userId));
      }
    }
    if (token) removeSession(token, "ended");

    return (await Promise.all(revocations)).every(Boolean)
      ? account.status
      : "revocation_unavailable";
  }
  function readGitAccount(token: string | undefined) {
    const account = readCurrent(token);
    if (account.status !== "completed") return account;
    const session = token && sessions.get(token);
    if (!token || !session) return { status: "rejected" } as const;
    const isLive = () =>
      sessions.get(token) === session && session.expiresAt > Date.now();
    const isCurrent = () =>
      isLive() && readCurrent(token).status === "completed" && isLive();
    return {
      status: "completed" as const,
      id: token,
      connected: (host: string) => activeHostToken(session, host) !== null,
      isCurrent,
      save(host: string, approved: ApprovedGitHostLink | null) {
        const gitHost = gitHosts.get(host);
        if (
          !gitHost ||
          !approved ||
          approved.expiresAt <= Date.now() ||
          !isCurrent() ||
          approved.expiresAt <= Date.now()
        )
          return false;
        const reference = gitHost.links.save(session.binding, approved, () => {
          const active = new Set<string>();
          const now = Date.now();
          for (const [id, other] of sessions) {
            // 更新対象ブラウザーの旧参照は、別連携への切替が成立すれば不要。
            if (id === token || other.expiresAt <= now) continue;
            const reference = other.gitHostReferences.get(gitHost.host);
            if (reference) active.add(reference);
          }
          return active;
        });
        if (!reference) return false;
        session.gitHostReferences.set(gitHost.host, reference);

        return true;
      },
      async disconnect(host: string) {
        const gitHost = gitHosts.get(host);
        if (!gitHost) return "absent" as const;
        gitHost.cancelPending(token);
        const reference = session.gitHostReferences.get(gitHost.host);
        if (!reference) return "absent" as const;
        const confirmed = await gitHost.links.disconnect(
          reference,
          session.binding,
        );
        if (session.gitHostReferences.get(gitHost.host) === reference)
          session.gitHostReferences.delete(gitHost.host);
        return confirmed;
      },
    };
  }
  const close = () => {
    for (const id of sessions.keys()) removeSession(id);
    for (const host of gitHosts.values()) host.links.close();
  };
  return Object.freeze({
    completeLogin,
    signOut,
    readCurrent,
    readManagement,
    changeManagement,
    readGitHostLinkedAccessSession,
    readMcpReferences,
    readGitAccount,
    close,
  });
}
