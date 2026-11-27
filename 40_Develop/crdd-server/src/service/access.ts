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
  type AuthorizedRepository,
  type CurrentAccessOutcome,
  checkGitHostLinkedRepositoryRegistration,
  type FilesystemStoreRoot,
  type GitHostLinkedAccessCandidate,
  type ManagementOperationOutcome,
  type ManagementReadOutcome,
  observeGitHostLinkedExecutionBinding,
  readGitHostLinkedAccessCandidates,
  registerRepository,
  registerUser,
  renewInvitation,
  resolveGitHostLinkedAccessCollection,
  resolveGitHostLinkedAccessDirectories,
  unregisterRepository,
  updateUserName,
  updateUserRole,
} from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import {
  getRepository,
  readOriginHttpsRemote,
} from "@qual-lab/crdd-version-control";
import type { BoundGitHost, ReadGitHost } from "./git-host.ts";
import type { PublicLoginProvider } from "./login-providers.ts";
import type { RepositoryScope } from "./repository-scope.ts";

/** HTTP／MCPの受付が、要求の主体と対象ホストに対応する連携を確定する。 */
export type GitHostLinkedAccessSession = Readonly<{
  principal: AccountAccessPrincipal;
  repositoryScope: RepositoryScope;
  browserSessionKey?: object;
  readGitHost: ReadGitHost;
  readHostToken: (host: string) => string | null;
  readHostReference?: (host: string) => string | null;
  isCurrent?: () => boolean;
  observeClient?: (
    signal: AbortSignal,
  ) => Promise<"current" | "revoked" | "unavailable">;
  openExecution?: (host: string) => GitHostLinkedExecutionClientAccess | null;
}>;

export type GitHostLinkedExecutionClientAccess = Readonly<{
  accountId: string;
  observePermission: NonNullable<BoundGitHost["observePermission"]>;
  close?: () => void;
  revocationSignal?: AbortSignal;
}>;

type ReadBoundHostValue<Value> = (host: string, reference: string) => Value;

/** 受付ごとの確定済み連携から、共有操作の要求用接続を構成する。 @trace ARCH-000012 */
export function createGitHostLinkedAccessSession(
  context: Pick<
    GitHostLinkedAccessSession,
    | "principal"
    | "repositoryScope"
    | "browserSessionKey"
    | "readGitHost"
    | "observeClient"
  > & {
    isCurrent: () => boolean;
    readReference: (host: string) => string | null | undefined;
    readToken: ReadBoundHostValue<string | null>;
    open?: ReadBoundHostValue<GitHostLinkedExecutionClientAccess | null>;
  },
): GitHostLinkedAccessSession {
  const { readReference, readToken, open, ...session } = context;
  const currentReference = (host: string) =>
    session.isCurrent() ? readReference(host) : null;
  return {
    ...session,
    readHostToken(host) {
      const reference = currentReference(host);
      return reference ? readToken(host, reference) : null;
    },
    ...(session.browserSessionKey !== undefined && {
      readHostReference(host: string) {
        const reference = currentReference(host);
        return reference && readToken(host, reference) !== null
          ? reference
          : null;
      },
    }),
    ...(open && {
      openExecution(host: string) {
        const reference = currentReference(host);
        return reference ? open(host, reference) : null;
      },
    }),
  };
}

/** 受付時のManifestと比較し、差し替えと観測不能を区別する。 */
export function observeAuthorizedManifest(
  target: Pick<AuthorizedRepository, "root" | "manifest">,
  expected = JSON.stringify(target.manifest),
): "current" | "target_changed" | "unavailable" {
  const fresh = readRepositoryManifest(target.root);
  if (fresh.status !== "ready") return "unavailable";
  return JSON.stringify(fresh.manifest) === expected
    ? "current"
    : "target_changed";
}

function observeGitHostLinkedDirectory(
  root: string,
  host: BoundGitHost,
  expectedName: string,
  repositoryScope: RepositoryScope,
  captureOriginConfiguration: boolean,
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
  const captureOrigin = () =>
    captureOriginConfiguration && repositoryScope(root)
      ? readOriginHttpsRemote(location.capability, {
          captureConfiguration: true,
        })
      : null;
  let captured = captureOrigin();
  const matchesOrigin = (address: string) =>
    sameDirectory() && host.readRepositoryName(address) === expectedName;
  const matched = captured
    ? matchesOrigin(captured.address)
    : readOrigin() !== null;
  return matched
    ? {
        sameDirectory,
        readOrigin,
        readConfiguredOrigin,
        recheckOrigin() {
          if (captured?.configurationIsCurrent() === true)
            return sameDirectory();
          const current = captureOrigin();
          if (!current) return readOrigin() !== null;
          if (!matchesOrigin(current.address)) return false;
          captured = current;
          return true;
        },
      }
    : null;
}

/** 同じ要求内で使う、現在のリポジトリ認可と公開前の再照合。 @trace ARCH-000012 */
export interface GitHostLinkedRepositoryAccess {
  readonly repositories: readonly AuthorizedRepository[];
  readonly signal: AbortSignal;
  readonly hostCredentialIsCurrent: (host: string) => boolean;
  readonly canWrite: (repositoryId: string) => boolean;
  readonly sameDirectory: (repository: AuthorizedRepository) => boolean;
  readonly readConfiguredOrigin: (
    repository: AuthorizedRepository,
  ) => string | null;
  readonly readAuthorizedOrigin: (
    repository: AuthorizedRepository,
  ) => string | null;
  readonly assertDirectory: (repository: AuthorizedRepository) => void;
  readonly assertCurrent: (
    repositories: readonly AuthorizedRepository[],
    reuseOriginConfiguration?: boolean,
  ) => void;
}

/** 現在の本人の拒否を登録の空集合と区別する。 */
export class BrowserPrincipalRejected extends Error {}

/** 外部ホスト認可を、同じ要求の実ディレクトリと公開前確認へ結ぶ。 */
export async function resolveGitHostLinkedRepositories(
  root: FilesystemStoreRoot,
  session: GitHostLinkedAccessSession,
  signal: AbortSignal,
  repositoryId?: string,
  operation: "read" | "write" = "read",
  options?: Readonly<{
    allowUnrelatedRevision?: true;
    captureOriginConfiguration?: true;
    rejectRevokedPrincipal?: true;
  }>,
): Promise<GitHostLinkedRepositoryAccess | null> {
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
  const before = readGitHostLinkedAccessCandidates(root, session.principal);
  if (before.status === "unavailable" || deadline.aborted)
    throw new Error("hosted_repository_access_unavailable");
  if (before.status === "revoked") {
    if (options?.rejectRevokedPrincipal) throw new BrowserPrincipalRejected();
    return null;
  }
  // 同期GitやAMの確認中はabort通知が遅れるため、経過時刻も確認する。
  const withinDeadline = () =>
    !deadline.aborted && performance.now() < expiresAt;
  const credentials = new Map<string, string>();
  const observations = new Map<string, BoundGitHost["observeAccess"]>();
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
    principalIsCurrent() &&
    [...credentials.keys()].every(hostCredentialIsCurrent) &&
    withinDeadline();
  function principalIsCurrent() {
    const current = session.isCurrent?.() !== false;
    if (!current && options?.rejectRevokedPrincipal)
      throw new BrowserPrincipalRejected();
    return current;
  }
  const expected = targetOnly
    ? JSON.stringify(
        before.candidates.find((entry) => entry.repositoryId === repositoryId),
      )
    : undefined;
  const accessCurrent = () => {
    if (!sessionCurrent()) return false;
    const fresh = readGitHostLinkedAccessCandidates(root, session.principal);
    if (fresh.status === "revoked" && options?.rejectRevokedPrincipal)
      throw new BrowserPrincipalRejected();
    return (
      fresh.status === "current" &&
      (targetOnly
        ? JSON.stringify(
            fresh.candidates.find(
              (entry) => entry.repositoryId === repositoryId,
            ),
          ) === expected
        : fresh.managementRevision === before.managementRevision) &&
      sessionCurrent()
    );
  };
  let firstObservation = true;
  let principalRejectedDuringHostRead = false;
  const beforeHostRequest = () => {
    try {
      if (!firstObservation) return accessCurrent();
      firstObservation = false;
      return sessionCurrent();
    } catch (error) {
      if (!(error instanceof BrowserPrincipalRejected)) throw error;
      principalRejectedDuringHostRead = true;
      return false;
    }
  };
  const checked: GitHostLinkedAccessCandidate[] = [];
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
    let observe = observations.get(reference.host);
    if (!observe) {
      observe = host.createAccessObservation?.(token) ?? host.observeAccess;
      observations.set(reference.host, observe);
    }
    const observed = await observe({
      reference,
      userAccessToken: token,
      signal: deadline,
      isCurrent: beforeHostRequest,
    });
    if (principalRejectedDuringHostRead) throw new BrowserPrincipalRejected();
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
  const verified: Parameters<typeof resolveGitHostLinkedAccessCollection>[2] = {
    managementRevision: before.managementRevision,
    candidates: checked,
    ...(targetOnly && { allowUnrelatedRevision: true as const }),
  };
  const directories = resolveGitHostLinkedAccessDirectories(
    root,
    session.principal,
    verified,
  );
  if (!directories) throw new Error("hosted_repository_access_unavailable");
  const local = new Map<
    string,
    NonNullable<ReturnType<typeof observeGitHostLinkedDirectory>>
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
    const observation = observeGitHostLinkedDirectory(
      repository.root,
      remote.host,
      remote.name,
      session.repositoryScope,
      options?.captureOriginConfiguration === true,
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
  const access = resolveGitHostLinkedAccessCollection(root, session.principal, {
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
    assertCurrent(
      repositories: readonly AuthorizedRepository[],
      reuseOriginConfiguration = false,
    ) {
      // 接続先が変わった内容は、以前の外部認可で公開しない。
      for (const repository of repositories) {
        const observation = local.get(repository.root);
        if (
          !sessionCurrent() ||
          !observation ||
          !(reuseOriginConfiguration
            ? observation.recheckOrigin()
            : observation.readOrigin())
        )
          throw new Error("hosted_repository_access_unavailable");
      }
      if (!accessCurrent())
        throw new Error("hosted_repository_access_unavailable");
    },
  };
}

/** Workspaceの既存排他へ、外部照会なしで再確認できる要求内の認可を渡す。 */
export async function resolveGitHostLinkedDevelopmentAccess(
  root: FilesystemStoreRoot,
  session: GitHostLinkedAccessSession,
  repositoryId: string,
  write: boolean,
  signal: AbortSignal,
  options?: Readonly<{ reuseOriginConfiguration: true }>,
) {
  const current = () => !signal.aborted && session.isCurrent?.() !== false;
  if (!current()) return null;
  const hosted = await resolveGitHostLinkedRepositories(
    root,
    session,
    signal,
    repositoryId,
    write ? "write" : "read",
    options?.reuseOriginConfiguration
      ? { captureOriginConfiguration: true }
      : undefined,
  );
  if (!current()) return null;
  const selected = hosted?.repositories[0];
  if (!hosted || !selected) return null;
  return {
    ownerRoot: selected.root,
    bindingId: selected.bindingId,
    gitHostLinkedBinding: JSON.stringify(selected.hostedRepository),
    projectId: selected.manifest.projectId,
    canWrite: hosted.canWrite(repositoryId),
    observeBinding: bindGitHostLinkedExecutionTarget(
      root,
      session.principal,
      repositoryId,
      selected,
      () => hosted.sameDirectory(selected),
    ),
    authorize: () => {
      try {
        hosted.assertDirectory(selected);
        if (observeAuthorizedManifest(selected) !== "current") return false;
        // 同期Manifest観測中の連携失効と照会期限切れも、処置・公開より先に拒否する。
        hosted.assertCurrent([selected], options?.reuseOriginConfiguration);
        return true;
      } catch {
        return false;
      }
    },
  };
}

type GitHostLinkedExecutionObservation =
  | "current"
  | "revoked"
  | "target_changed"
  | "unavailable";

/** 受付資格とは別に、元の本人・登録対象・ディレクトリ実体を再照合する。 */
function bindGitHostLinkedExecutionTarget(
  root: FilesystemStoreRoot,
  principal: GitHostLinkedAccessSession["principal"],
  repositoryId: string,
  selected: AuthorizedRepository,
  sameDirectory: () => boolean,
): () => GitHostLinkedExecutionObservation {
  const binding = JSON.stringify(selected.hostedRepository);
  return () => {
    try {
      const eligibility = observeGitHostLinkedExecutionBinding(root, principal);
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
export interface GitHostLinkedExecutionAccess {
  readonly ownerRoot: string;
  readonly projectId: string;
  readonly bindingId: string;
  readonly gitHostLinkedBinding: string;
  readonly principalId: string;
  readonly host: string;
  readonly observeBinding: () => GitHostLinkedExecutionObservation;
  readonly authorizedAtAdmission: () => boolean;
  readonly authorizeRequest: () => boolean;
  readonly observe: () => GitHostLinkedExecutionObservation;
  readonly observeTarget: () => boolean;
  readonly refresh: (
    signal: AbortSignal,
  ) => Promise<GitHostLinkedExecutionObservation>;
  readonly close: (() => void) | undefined;
  readonly revocationSignal: AbortSignal | undefined;
}

/** 開始済みの実行へ、本人の対話資格とは別の監視を渡す。 @trace ARCH-000012 */
export async function openGitHostLinkedExecutionAccess(
  root: FilesystemStoreRoot,
  session: GitHostLinkedAccessSession,
  repositoryId: string,
  {
    projectId,
    permission,
  }: Readonly<{
    projectId: string | null;
    permission: "read" | "write";
  }>,
  signal: AbortSignal,
): Promise<GitHostLinkedExecutionAccess | null> {
  if (
    (permission !== "read" && permission !== "write") ||
    signal.aborted ||
    session.isCurrent?.() === false
  )
    return null;
  const initial = await resolveGitHostLinkedRepositories(
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
  const gitHost = session.readGitHost(host.host);
  if (!gitHost?.acceptsReference(host)) return null;
  const binding = JSON.stringify(host);
  const admittedManifest = JSON.stringify(selected.manifest);
  const authorizedAtAdmission = () =>
    session.isCurrent?.() !== false &&
    session.principal.expiresAt > Date.now() &&
    initial.hostCredentialIsCurrent(host.host);
  if (!authorizedAtAdmission()) return null;
  const client = session.openExecution?.(host.host);
  if (!client) return null;
  const observeBinding = bindGitHostLinkedExecutionTarget(
    root,
    session.principal,
    repositoryId,
    selected,
    () => initial.sameDirectory(selected),
  );
  const observe = (): GitHostLinkedExecutionObservation => {
    if (client.revocationSignal?.aborted) return "revoked";
    const current = observeBinding();
    return client.revocationSignal?.aborted ? "revoked" : current;
  };
  const observeAdmittedOrigin = (
    readOrigin: () => string | null,
  ): GitHostLinkedExecutionObservation => {
    const manifest = observeAuthorizedManifest(selected, admittedManifest);
    if (manifest !== "current") return manifest;
    const origin = readOrigin();
    if (!origin) return "unavailable";
    return origin === address ? "current" : "target_changed";
  };
  const readConfiguredOrigin = () => initial.readConfiguredOrigin(selected);
  const readAuthorizedOrigin = () => initial.readAuthorizedOrigin(selected);
  const authorizeRequest = () => {
    try {
      if (
        !authorizedAtAdmission() ||
        initial.signal.aborted ||
        observe() !== "current"
      )
        return false;
      return observeAdmittedOrigin(readAuthorizedOrigin) === "current";
    } catch {
      return false;
    }
  };
  const refresh = async (
    scope: AbortSignal,
  ): Promise<GitHostLinkedExecutionObservation> => {
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
      const target = observeAdmittedOrigin(readConfiguredOrigin);
      if (target !== "current") return target;
      if (gitHost.readRepositoryName(address) !== observed.repositoryName)
        return "target_changed";
      return observe();
    } catch {
      return "unavailable";
    }
  };
  const observeTarget = () => {
    try {
      if (observe() !== "current") return false;
      return observeAdmittedOrigin(readConfiguredOrigin) === "current";
    } catch {
      return false;
    }
  };
  return {
    ownerRoot: selected.root,
    projectId: selected.manifest.projectId,
    bindingId: selected.bindingId,
    gitHostLinkedBinding: binding,
    principalId: session.principal.userId,
    observeBinding,
    authorizedAtAdmission,
    authorizeRequest,
    observe,
    observeTarget,
    host: host.host,
    refresh,
    close: client.close,
    revocationSignal: client.revocationSignal,
  };
}

/** 共有Repositoryを、現在の管理主体自身に許可されたホストの対象へ結ぶ。 */
export async function registerGitHostLinkedRepository(
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
  const current = checkGitHostLinkedRepositoryRegistration(
    root,
    principal,
    request,
  );
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

type ManagementWriteOperation =
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
  authenticated: boolean,
  loginProviders?: readonly PublicLoginProvider[],
): AccessViewResponse {
  return Object.freeze({
    contract: "crdd/workbench/view/v1",
    view: "access",
    actionToken,
    authenticated,
    ...(loginProviders && { loginProviders }),
  });
}

/**
 * 共有モードの接続と管理だけを表示するModel。
 * @responsibility 未認証や内容未選択を架空のRepository主画面へ変換しない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @shape access判別子、非秘密接続状態と公開ログイン選択肢。
 * @invariant 認証済みかはauthenticatedで判定し、内容認可は一覧APIで別に判定する。
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
}>;
