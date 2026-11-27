/**
 * RESTとMCPを既存のアクセス管理へ接続する。
 * @packageDocumentation
 * @responsibility アクセス管理操作と現在許可されたRepositoryの実体を接続する。認可の判断・保存はAccess Managementが所有する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @trace ARCH-000017
 * @boundary 通信受付の当該要求とAccess Management・Version Control。
 */
import { createHash, randomBytes } from "node:crypto";
import { lstatSync } from "node:fs";
import {
  type AccountAccessPrincipal,
  type AccessRole,
  type AuthorizedRepository,
  checkHostedRepositoryRegistration,
  type CurrentAccessOutcome,
  evaluateManagementPermission,
  type FilesystemStoreRoot,
  type HostedAccessCandidate,
  type ManagementOperationOutcome,
  type ManagementReadOutcome,
  observeHostedExecutionBinding,
  readHostedAccessCandidates,
  registerRepository,
  registerUser,
  renewInvitation,
  resolveHostedAccessCollection,
  resolveHostedAccessDirectories,
  unregisterRepository,
  updateUserName,
  updateUserRole,
} from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import type { PortfolioProjection } from "@qual-lab/crdd-document-model";
import type { PublicLoginProvider } from "../transport/login-providers.ts";
import {
  getRepository,
  readOriginHttpsRemote,
  readRepositoryLocation,
} from "@qual-lab/crdd-version-control";
import type { BoundGitHost, ReadGitHost } from "./git-host.ts";
import type { RepositoryScope } from "./repository-scope.ts";

export const managementSessionLifetimeSeconds = 5 * 60;
export const clientSessionLifetimeSeconds = 30 * 60;
const maximumClientSessions = 128;
const maximumClientSessionsPerAccount = 4;

/** 現在の管理権限と元セッションの期限から短命の管理セッションを発行する。 */
export function openManagementSession(
  role: AccessRole,
  sessionExpiresAt: number,
) {
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
  management?: NonNullable<ReturnType<typeof openManagementSession>>;
  gitHostReferences: Map<string, string>;
};

/** 入口のCookieに依存せず、本人ごとの容量・期限と接続の置換を管理する。 */
export function createClientSessions(
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

/** HTTP／MCPの受付が、要求の主体と対象ホストに対応する連携を確定する。 */
export type HostedAccessSession = Readonly<{
  principal: AccountAccessPrincipal;
  repositoryScope: RepositoryScope;
  browserSessionKey?: object;
  readGitHost: ReadGitHost;
  readHostToken: (host: string) => string | null;
  isCurrent?: () => boolean;
  observeClient?: (
    signal: AbortSignal,
  ) => Promise<"current" | "revoked" | "unavailable">;
  openExecution?: (host: string) => HostedExecutionClientAccess | null;
}>;

export type HostedExecutionClientAccess = Readonly<{
  accountId: string;
  observePermission: NonNullable<BoundGitHost["observePermission"]>;
  close?: () => void;
  revocationSignal?: AbortSignal;
}>;

function observeHostedDirectory(
  root: string,
  host: BoundGitHost,
  expectedName: string,
  repositoryScope: RepositoryScope,
) {
  const initial = lstatSync(root, { bigint: true });
  if (!initial.isDirectory() || initial.ino === 0n) return null;
  const sameDirectory = () => {
    const fresh = lstatSync(root, { bigint: true });
    return (
      repositoryScope(root) &&
      fresh.isDirectory() &&
      initial.dev === fresh.dev &&
      initial.ino === fresh.ino &&
      initial.birthtimeNs === fresh.birthtimeNs
    );
  };
  const location = getRepository(root);
  if (location.status !== "completed") return null;
  const readConfiguredOrigin = () => {
    if (!repositoryScope(root)) return null;
    const remote = readOriginHttpsRemote(location.capability);
    return remote && sameDirectory() ? remote : null;
  };
  const readOrigin = () => {
    const remote = readConfiguredOrigin();
    return remote && host.readRepositoryName(remote) === expectedName
      ? remote
      : null;
  };
  return readOrigin()
    ? { sameDirectory, readOrigin, readConfiguredOrigin }
    : null;
}

/** 外部ホスト認可を、同じ要求の実ディレクトリと公開前確認へ結ぶ。 */
export async function resolveHostedRepositories(
  root: FilesystemStoreRoot,
  session: HostedAccessSession,
  signal: AbortSignal,
  repositoryId?: string,
  operation: "read" | "write" = "read",
  options?: Readonly<{ allowUnrelatedRevision: true }>,
) {
  if (signal.aborted) throw new Error("hosted_repository_access_unavailable");
  if (operation !== "read" && repositoryId === undefined)
    throw new Error("hosted_repository_access_unavailable");
  const targetOnly =
    options?.allowUnrelatedRevision === true &&
    repositoryId !== undefined &&
    operation !== "read";
  const observationTimeMs = 10_000;
  const expiresAt = performance.now() + observationTimeMs;
  const deadline = AbortSignal.any([
    signal,
    AbortSignal.timeout(observationTimeMs),
  ]);
  const before = readHostedAccessCandidates(root, session.principal);
  if (before.status === "unavailable" || deadline.aborted)
    throw new Error("hosted_repository_access_unavailable");
  if (before.status === "revoked") return null;
  // 同期GitやAMの確認中はabort通知が遅れるため、経過時刻も確認する。
  const withinDeadline = () =>
    !deadline.aborted && performance.now() < expiresAt;
  const credentials = new Map<string, string>();
  const hostCredentialIsCurrent = (host: string) => {
    const token = credentials.get(host);
    return (
      token !== undefined &&
      session.isCurrent?.() !== false &&
      session.readHostToken(host) === token
    );
  };
  const sessionCurrent = () =>
    withinDeadline() &&
    session.isCurrent?.() !== false &&
    [...credentials.keys()].every(hostCredentialIsCurrent) &&
    withinDeadline();
  const expected = targetOnly
    ? before.candidates.find((entry) => entry.repositoryId === repositoryId)
    : undefined;
  const accessCurrent = () => {
    if (!sessionCurrent()) return false;
    const fresh = readHostedAccessCandidates(root, session.principal);
    return (
      fresh.status === "current" &&
      (targetOnly
        ? JSON.stringify(
            fresh.candidates.find(
              (entry) => entry.repositoryId === repositoryId,
            ),
          ) === JSON.stringify(expected)
        : fresh.managementRevision === before.managementRevision) &&
      sessionCurrent()
    );
  };
  let firstObservation = true;
  const beforeHostRequest = () => {
    if (!firstObservation) return accessCurrent();
    firstObservation = false;
    return sessionCurrent();
  };
  const checked: HostedAccessCandidate[] = [];
  const remoteIdentities = new Map<
    string,
    { host: BoundGitHost; name: string }
  >();
  const writable = new Set<string>();
  for (const candidate of before.candidates) {
    const reference = candidate.hostedRepository;
    if (repositoryId !== undefined && candidate.repositoryId !== repositoryId)
      continue;
    const host = session.readGitHost(reference.host);
    if (!host?.acceptsReference(reference)) continue;
    const recorded = credentials.get(reference.host);
    const token = recorded ?? session.readHostToken(reference.host);
    if (!token) continue;
    if (recorded === undefined) credentials.set(reference.host, token);
    const observed = await host.observeAccess({
      reference,
      userAccessToken: token,
      signal: deadline,
      isCurrent: beforeHostRequest,
    });
    if (observed.status === "unavailable")
      throw new Error("hosted_repository_access_unavailable");
    if (
      observed.status !== "allowed" ||
      (operation === "write" && !observed.write)
    )
      continue;
    if (!observed.name) throw new Error("hosted_repository_access_unavailable");
    checked.push(candidate);
    remoteIdentities.set(candidate.repositoryId, {
      host,
      name: observed.name,
    });
    if (observed.write) writable.add(candidate.repositoryId);
  }
  if (!credentials.size) return null;
  if (!sessionCurrent())
    throw new Error("hosted_repository_access_unavailable");
  if (!checked.length) {
    if (!accessCurrent())
      throw new Error("hosted_repository_access_unavailable");
    return null;
  }
  const verified: Parameters<typeof resolveHostedAccessCollection>[2] = {
    managementRevision: before.managementRevision,
    candidates: checked,
    ...(targetOnly && { allowUnrelatedRevision: true as const }),
  };
  const directories = resolveHostedAccessDirectories(
    root,
    session.principal,
    verified,
  );
  if (!directories) throw new Error("hosted_repository_access_unavailable");
  const local = new Map<
    string,
    NonNullable<ReturnType<typeof observeHostedDirectory>>
  >();
  const excluded = new Set<string>();
  for (const repository of directories) {
    if (!session.repositoryScope(repository.root)) {
      excluded.add(repository.repositoryId);
      writable.delete(repository.repositoryId);
      continue;
    }
    const remote = remoteIdentities.get(repository.repositoryId);
    if (!remote) throw new Error("hosted_repository_access_unavailable");
    const observation = observeHostedDirectory(
      repository.root,
      remote.host,
      remote.name,
      session.repositoryScope,
    );
    if (!observation) throw new Error("hosted_repository_access_unavailable");
    local.set(repository.root, observation);
  }
  const inScope = checked.filter(
    ({ repositoryId }) => !excluded.has(repositoryId),
  );
  if (!inScope.length) return null;
  if (!sessionCurrent())
    throw new Error("hosted_repository_access_unavailable");
  const access = resolveHostedAccessCollection(root, session.principal, {
    ...verified,
    candidates: inScope,
  });
  if (access.status !== "completed" || !sessionCurrent())
    throw new Error("hosted_repository_access_unavailable");
  return {
    repositories: access.repositories,
    hostCredentialIsCurrent,
    signal: deadline,
    canWrite: (repositoryId: string) => writable.has(repositoryId),
    sameDirectory(repository: AuthorizedRepository) {
      return local.get(repository.root)?.sameDirectory() === true;
    },
    readConfiguredOrigin(repository: AuthorizedRepository) {
      return local.get(repository.root)?.readConfiguredOrigin() ?? null;
    },
    readAuthorizedOrigin(repository: AuthorizedRepository) {
      if (!sessionCurrent()) return null;
      const origin = local.get(repository.root)?.readOrigin();
      return origin && accessCurrent() ? origin : null;
    },
    assertDirectory(repository: AuthorizedRepository) {
      if (!sessionCurrent() || !local.get(repository.root)?.sameDirectory())
        throw new Error("hosted_repository_access_unavailable");
    },
    assertCurrent(repositories: readonly AuthorizedRepository[]) {
      // 接続先が変わった内容は、以前の外部認可で公開しない。
      for (const repository of repositories)
        if (!sessionCurrent() || !local.get(repository.root)?.readOrigin())
          throw new Error("hosted_repository_access_unavailable");
      if (!accessCurrent())
        throw new Error("hosted_repository_access_unavailable");
    },
  };
}

/** Workspaceの既存排他へ、外部照会なしで再確認できる要求内の認可を渡す。 */
export async function resolveHostedDevelopmentAccess(
  root: FilesystemStoreRoot,
  session: HostedAccessSession,
  repositoryId: string,
  write: boolean,
  signal: AbortSignal,
) {
  const current = () => !signal.aborted && session.isCurrent?.() !== false;
  if (!current()) return null;
  const hosted = await resolveHostedRepositories(
    root,
    session,
    signal,
    repositoryId,
    write ? "write" : "read",
  );
  if (!current()) return null;
  const selected = hosted?.repositories[0];
  if (!hosted || !selected) return null;
  return {
    ownerRoot: selected.root,
    bindingId: selected.bindingId,
    hostedBinding: JSON.stringify(selected.hostedRepository),
    projectId: selected.manifest.projectId,
    canWrite: hosted.canWrite(repositoryId),
    observeBinding: bindHostedExecutionTarget(
      root,
      session.principal,
      repositoryId,
      selected,
      () => hosted.sameDirectory(selected),
    ),
    authorize: () => {
      try {
        hosted.assertDirectory(selected);
        const manifest = readRepositoryManifest(selected.root);
        if (
          manifest.status !== "ready" ||
          JSON.stringify(manifest.manifest) !==
            JSON.stringify(selected.manifest)
        )
          return false;
        // 同期Manifest観測中の連携失効と照会期限切れも、処置・公開より先に拒否する。
        hosted.assertCurrent([selected]);
        return true;
      } catch {
        return false;
      }
    },
  };
}

type HostedExecutionObservation =
  | "current"
  | "revoked"
  | "target_changed"
  | "unavailable";

/** 受付資格とは別に、元の本人・登録対象・ディレクトリ実体を再照合する。 */
function bindHostedExecutionTarget(
  root: FilesystemStoreRoot,
  principal: HostedAccessSession["principal"],
  repositoryId: string,
  selected: AuthorizedRepository,
  sameDirectory: () => boolean,
): () => HostedExecutionObservation {
  const binding = JSON.stringify(selected.hostedRepository);
  return () => {
    try {
      const eligibility = observeHostedExecutionBinding(root, principal);
      if (eligibility.status !== "current") return eligibility.status;
      const candidate = eligibility.candidates.find(
        (entry) => entry.repositoryId === repositoryId,
      );
      if (!candidate) return "revoked";
      return candidate.bindingId === selected.bindingId &&
        JSON.stringify(candidate.hostedRepository) === binding &&
        sameDirectory()
        ? "current"
        : "target_changed";
    } catch {
      return "unavailable";
    }
  };
}

/** 開始時の対象を固定し、後続の各外部照会を元の連携と実体に結び付ける。 @trace ARCH-000012 */
export async function openHostedExecutionAccess(
  root: FilesystemStoreRoot,
  session: HostedAccessSession,
  repositoryId: string,
  {
    projectId,
    permission,
  }: Readonly<{
    projectId: string | null;
    permission: "read" | "write";
  }>,
  signal: AbortSignal,
) {
  if (
    (permission !== "read" && permission !== "write") ||
    signal.aborted ||
    session.isCurrent?.() === false
  )
    return null;
  const initial = await resolveHostedRepositories(
    root,
    session,
    signal,
    repositoryId,
    permission,
    { allowUnrelatedRevision: true },
  );
  if (!initial) return null;
  const selected = initial.repositories[0];
  if (
    !selected ||
    (projectId !== null && selected.manifest.projectId !== projectId)
  )
    return null;
  const address = initial.readAuthorizedOrigin(selected);
  if (!address) return null;
  const host = selected.hostedRepository;
  if (!host) return null;
  const gitHost = session.readGitHost(host.host);
  if (!gitHost?.acceptsReference(host)) return null;
  const binding = JSON.stringify(host);
  const manifest = JSON.stringify(selected.manifest);
  const authorizedAtAdmission = () =>
    session.isCurrent?.() !== false &&
    session.principal.expiresAt > Date.now() &&
    initial.hostCredentialIsCurrent(host.host);
  if (!authorizedAtAdmission()) return null;
  const client = session.openExecution?.(host.host);
  if (!client) return null;
  const observeBinding = bindHostedExecutionTarget(
    root,
    session.principal,
    repositoryId,
    selected,
    () => initial.sameDirectory(selected),
  );
  const observe = (): HostedExecutionObservation => {
    if (client.revocationSignal?.aborted) return "revoked";
    const current = observeBinding();
    return client.revocationSignal?.aborted ? "revoked" : current;
  };
  const authorizeRequest = () => {
    try {
      if (
        !authorizedAtAdmission() ||
        initial.signal.aborted ||
        observe() !== "current"
      )
        return false;
      const current = readRepositoryManifest(selected.root);
      return (
        current.status === "ready" &&
        JSON.stringify(current.manifest) === manifest &&
        initial.readAuthorizedOrigin(selected) === address
      );
    } catch {
      return false;
    }
  };
  const refresh = async (
    scope: AbortSignal,
  ): Promise<HostedExecutionObservation> => {
    try {
      if (scope.aborted) return "unavailable";
      const before = observe();
      if (before !== "current") return before;
      const observed = await client.observePermission({
        reference: host,
        accountId: client.accountId,
        signal: scope,
      });
      if (scope.aborted) return "unavailable";
      const after = observe();
      if (after !== "current") return after;
      if (observed === "unavailable") return "unavailable";
      if (
        observed.permission !== "write" &&
        !(permission === "read" && observed.permission === "read")
      )
        return "revoked";
      const current = readRepositoryManifest(selected.root);
      if (current.status !== "ready") return "unavailable";
      if (JSON.stringify(current.manifest) !== manifest)
        return "target_changed";
      const origin = initial.readConfiguredOrigin(selected);
      if (!origin) return "unavailable";
      if (
        address !== origin ||
        gitHost.readRepositoryName(origin) !== observed.repositoryName
      )
        return "target_changed";
      return observe();
    } catch {
      return "unavailable";
    }
  };
  return {
    ownerRoot: selected.root,
    projectId: selected.manifest.projectId,
    bindingId: selected.bindingId,
    hostedBinding: binding,
    principalId: session.principal.userId,
    observeBinding,
    authorizedAtAdmission,
    authorizeRequest,
    observe,
    refresh,
    close: client.close,
    revocationSignal: client.revocationSignal,
  };
}

/** 共有Repositoryを、現在の管理主体自身に許可されたホストの対象へ結ぶ。 */
export async function registerHostedRepository(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  request: {
    repositoryId: string;
    directory: string;
    expectedRevision: number;
    operationId: string;
  },
  readGitHost: ReadGitHost,
  readHostToken: (host: string) => string | null,
  isCurrent: () => boolean,
  signal: AbortSignal,
  repositoryScope: RepositoryScope,
): Promise<ManagementOperationOutcome> {
  const rejected = {
    status: "rejected" as const,
    reason: "management_request_rejected" as const,
  };
  if (signal.aborted || !isCurrent()) return rejected;
  const current = checkHostedRepositoryRegistration(root, principal, request);
  if (current === "conflict")
    return !signal.aborted && isCurrent()
      ? { status: "rejected", reason: "management_revision_conflict" }
      : rejected;
  if (current !== "ready" || !repositoryScope(request.directory))
    return rejected;
  const repository = getRepository(request.directory, "placement");
  if (repository.status !== "completed") return rejected;
  const directory = repository.placement.directory;
  if (!repositoryScope(directory)) return rejected;
  const physicalIdentity = () => {
    try {
      const stat = lstatSync(directory, { bigint: true });
      return stat.isDirectory() && !stat.isSymbolicLink() && stat.ino !== 0n
        ? `${stat.dev}:${stat.ino}`
        : null;
    } catch {
      return null;
    }
  };
  const identity = physicalIdentity();
  const remote = identity && readOriginHttpsRemote(repository.capability);
  if (!remote || !isCurrent() || signal.aborted) return rejected;
  const host = URL.parse(remote)?.hostname;
  const gitHost = host ? readGitHost(host) : undefined;
  if (!host || !gitHost?.readRepositoryName(remote)) return rejected;
  const token = readHostToken(host);
  if (!token) return rejected;
  const sameAccount = () =>
    !signal.aborted && isCurrent() && readHostToken(host) === token;
  const hosted = await gitHost.observeBinding({
    remote,
    userAccessToken: token,
    signal,
    isCurrent: sameAccount,
  });
  if (!hosted || !sameAccount()) return rejected;
  return registerRepository(
    root,
    principal,
    request.expectedRevision,
    request.operationId,
    request.repositoryId,
    request.directory,
    (candidate) => {
      if (
        candidate !== request.directory ||
        !repositoryScope(directory) ||
        physicalIdentity() !== identity
      )
        return null;
      return {
        directory,
        hostedRepository: hosted,
        isCurrent: () =>
          sameAccount() &&
          physicalIdentity() === identity &&
          readOriginHttpsRemote(repository.capability) === remote,
      };
    },
  );
}

/** 確認済み管理セッションで利用者を事前登録し、一度だけ招待を渡す。 */
export function issueUserInvitation(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  request: {
    email: string;
    expectedRevision: number;
    operationId: string;
  } & ({ username: string; role: string } | { userId: string }),
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + 24 * 60 * 60_000;
  const material = {
    email: request.email,
    digest: createHash("sha256").update(token).digest("hex"),
    expiresAt,
  };
  const result =
    "userId" in request
      ? renewInvitation(
          root,
          principal,
          request.expectedRevision,
          request.operationId,
          request.userId,
          material,
        )
      : registerUser(
          root,
          principal,
          request.expectedRevision,
          request.operationId,
          request.username,
          request.role,
          material,
        );
  return result.status === "completed"
    ? { result, invitation: { token, expiresAt } }
    : { result };
}

/**
 * 認可済みの登録要求からexact Git Rootを確認する。
 * @responsibility Gitの配置と現在性はServer側で観測し、AMにはディレクトリと照合処理だけを渡す。
 * @trace ARCH-000013
 * @input AMが現在認可・期待改訂と照合した登録Path。
 * @returns 正規ディレクトリと同じ対象の再確認、又はnull。
 * @precondition AMの登録観測から同期的に呼ばれる。
 * @postcondition Git識別値と技術能力をAMの保存値に含めない。
 * @effect Git配置の読取りだけ。対象Repositoryを書き換えない。
 * @failure 不正・不明はnull、再確認不能はfalse。
 * @invariant 親Repositoryを代替にしない。
 * @boundary Serverの登録接続とVC。
 * @security 要求値によって観測方法を変更しない。
 * @concurrency 最後の照合は初回と同じ対象をfresh観測する。
 */
export function observeRegistrationDirectory(directory: string) {
  const location = readRepositoryLocation(directory);
  if (location === null) return null;
  const root = location.directory;
  return {
    directory: root,
    isCurrent: () => readRepositoryLocation(root)?.directory === root,
  };
}

/**
 * 管理readの対象を固定する。
 * @responsibility 本人と他ユーザー管理の種類を混同しない。
 * @trace ARCH-000013
 * @shape current／users／roles／repositories。
 * @invariant 鍵と初回状態を含めない。
 * @boundary 表示GETと管理Reader。
 * @security 任意Pathを対象指定にしない。
 * @compatibility 現行本人と二つの管理一覧だけ。
 */
export type ManagementView = "current" | "users" | "repositories";
/**
 * AM共通結果とTransportだけの未取得を表示へ渡す。
 * @responsibility 意味Ownerの型を再利用し、Transport非提供を成功にしない。
 * @trace ARCH-000013
 * @shape AM三結果Unionと未構成。
 * @invariant Transport理由をAM保存結果へ戻さない。
 * @boundary 非秘密の管理表示。
 * @security 新しい秘密・回復参照なし。
 * @compatibility AM共通結果の現行版だけ。
 */
export type ManagementResult =
  | CurrentAccessOutcome
  | ManagementReadOutcome
  | ManagementOperationOutcome
  | Readonly<{
      status: "unavailable";
      reason: "management_not_configured";
    }>;

export type ManagementWriteOperation =
  | "updateUserName"
  | "updateUserRole"
  | "unregisterRepository";

/**
 * 受付済みの操作をAccess Managementへ一回委譲する。
 * @responsibility 相関ID・期待改訂・操作結果を変更せず、通信固有の認可・取消を増減しない。
 * @trace ARCH-000013
 * @boundary Rootと資格は構成元が確定済み。Repository登録を公開する入口はHTTPだけ。
 */
export function executeManagementOperation(
  {
    root,
    principal,
  }: Readonly<{
    root: FilesystemStoreRoot;
    principal: AccountAccessPrincipal;
  }>,
  operation: ManagementWriteOperation,
  args: Readonly<Record<string, unknown>>,
  expectedRevision: number,
  operationId: string,
): ManagementOperationOutcome {
  switch (operation) {
    case "updateUserName":
      return updateUserName(
        root,
        principal,
        expectedRevision,
        operationId,
        args.userId as string,
        args.username as string,
      );
    case "updateUserRole":
      return updateUserRole(
        root,
        principal,
        expectedRevision,
        operationId,
        args.userId as string,
        args.currentRole,
        args.nextRole,
      );
    case "unregisterRepository":
      return unregisterRepository(
        root,
        principal,
        expectedRevision,
        operationId,
        args.repositoryId,
      );
  }
}

/**
 * 現在の接続と公開可能な表示情報を接続画面へ投影する。
 * @responsibility 観測済みの認証状態と公開可能な表示情報を追加I/Oなしで形にする。
 * @trace ARCH-000012
 * @boundary 渡された接続に限定。資格や認可結果を公開しない。
 */
export function createAccessViewResponse(
  actionToken: string,
  notice: string | null,
  portfolio: PortfolioProjection | null,
  authenticated: boolean,
  loginProviders?: readonly PublicLoginProvider[],
): AccessViewResponse {
  return Object.freeze({
    contract: "crdd/workbench/view/v1",
    view: "access",
    actionToken,
    authenticated,
    ...(loginProviders && { loginProviders }),
    notice,
    portfolio,
  });
}

/**
 * Local CROSの接続と管理だけを表示するModel。
 * @responsibility 未認証や内容未選択を架空のRepository主画面へ変換しない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @shape access判別子、非秘密接続状態とPortfolio。
 * @invariant 未認証時はPortfolioなし。loginProvidersは公開可能な選択肢で、認証済みかはauthenticatedで判定する。
 * @boundary Workbench接続用JSONとCSR画面。
 * @security 入力済み鍵、Host Root、Verifierを保持しない。
 * @compatibility 現行client-model/v1内の追加variant。
 */
export type AccessViewResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "access";
  actionToken: string;
  authenticated: boolean;
  loginProviders?: readonly PublicLoginProvider[];
  notice: string | null;
  portfolio: PortfolioProjection | null;
}>;
