/**
 * Gitホストで認可済みの対象と現在の登録・実ディレクトリを照合する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import {
  isUnexpiredAccountPrincipal,
  resolveAccessPrincipal,
} from "../authorization/principal.ts";
import type {
  AccessActor,
  AccountAccessPrincipal,
} from "../authorization/types.ts";
import type { FilesystemStoreRoot } from "../initialization/root.ts";
import { locked } from "../storage/lock.ts";
import {
  PENDING,
  present,
  readCurrent,
  REPLACE,
  settlePending,
} from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { resolveAccountBinding } from "../user/account-link.ts";
import { deriveRepositoryBindingId } from "./binding.ts";
import type {
  AuthorizedRepository,
  GitHostLinkedRepository,
  GitHostLinkedAccessCandidate,
  RepositoryAccessCollectionResult,
} from "./types.ts";

function copyHostReference(
  reference: GitHostLinkedRepository,
): GitHostLinkedRepository {
  return Object.freeze({
    ...reference,
    providerData: Object.freeze({ ...reference.providerData }),
  });
}

function sameHostReference(
  a: GitHostLinkedRepository,
  b: GitHostLinkedRepository,
) {
  return (
    a.provider === b.provider &&
    a.host === b.host &&
    a.repositoryId === b.repositoryId &&
    Object.keys(a.providerData).length === Object.keys(b.providerData).length &&
    Object.entries(a.providerData).every(
      ([key, value]) =>
        Object.hasOwn(b.providerData, key) && b.providerData[key] === value,
    )
  );
}

/** 確認済みの本人に対し、外部権限を照会する登録の識別子だけを取得する。 */
export function readGitHostLinkedAccessCandidates(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
) {
  if (!isUnexpiredAccountPrincipal(principal))
    return { status: "revoked" } as const;
  return readGitHostLinkedCandidates(root, (state) =>
    resolveAccessPrincipal(principal, state),
  );
}

/** 開始済み実行の元の紐付けと登録を観測する。新規要求の認証・本文公開には使わない。 */
export function observeGitHostLinkedExecutionBinding(
  root: FilesystemStoreRoot,
  binding: Readonly<{ userId: string; bindingId: string }>,
) {
  return readGitHostLinkedCandidates(root, (state) =>
    resolveAccountBinding(state, binding),
  );
}

function readGitHostLinkedCandidates(
  root: FilesystemStoreRoot,
  identify: (state: AccessManagementState) => AccessActor | null,
) {
  const revoked = { status: "revoked" } as const;
  const result = locked<
    | typeof revoked
    | {
        status: "current";
        managementRevision: number;
        candidates: readonly GitHostLinkedAccessCandidate[];
      }
  >(root, () => {
    const { state } = readCurrent(root);
    if (present(root, PENDING) || present(root, REPLACE))
      throw new Error("hosted_repository_access_unavailable");
    const metadata = {
      status: "completed" as const,
      revision: state.revision,
      cleanupConfirmed: true as const,
      publication: "not_attempted" as const,
    };
    const actor = identify(state);
    if (!actor || state.initialization.stage !== "completed")
      return { ...metadata, value: revoked };
    const candidates: GitHostLinkedAccessCandidate[] =
      state.registeredRepositories.map((entry) => ({
        repositoryId: entry.repositoryId,
        bindingId: entry.bindingId,
        hostedRepository: copyHostReference(entry.hostedRepository),
      }));
    return {
      ...metadata,
      value: {
        status: "current" as const,
        managementRevision: state.revision,
        candidates,
      },
    };
  });
  return result.status === "completed"
    ? result.value
    : { status: "unavailable" as const };
}

type CheckedGitHostLinkedAccess = Readonly<{
  managementRevision: number;
  candidates: readonly GitHostLinkedAccessCandidate[];
  allowUnrelatedRevision?: true;
}>;

/** Gitの接続先を先に検査するため、現在許可された登録のパスだけを返す。 */
export function resolveGitHostLinkedAccessDirectories(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  checked: CheckedGitHostLinkedAccess,
) {
  if (!isUnexpiredAccountPrincipal(principal)) return null;
  const result = locked(root, () => {
    const { state } = readCurrent(root);
    const actor = resolveAccessPrincipal(principal, state);
    if (!actor || !isCurrentGitHostLinkedCheck(root, state, checked))
      throw new Error("hosted_repository_access_unavailable");
    const selected = selectGitHostLinkedRegistrations(state, checked);
    if (selected.length !== checked.candidates.length)
      throw new Error("hosted_repository_access_unavailable");
    return {
      status: "completed" as const,
      value: selected.map((registration) => ({
        repositoryId: registration.repositoryId,
        root: registration.repositoryRoot,
      })),
      revision: state.revision,
      cleanupConfirmed: true as const,
      publication: "not_attempted" as const,
    };
  });
  return result.status === "completed" ? result.value : null;
}

/** 外部照会済みの対象だけを、保存ロック内で再照合して本文の利用側へ渡す。 */
export function resolveGitHostLinkedAccessCollection(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  checked: CheckedGitHostLinkedAccess,
): RepositoryAccessCollectionResult {
  return readRepositoryAccessCollection(root, principal, checked);
}

function observeRegisteredRepository(
  registration: AccessManagementState["registeredRepositories"][number],
) {
  const root = registration.repositoryRoot;
  if (
    deriveRepositoryBindingId(registration.repositoryId, root) !==
    registration.bindingId
  )
    return null;
  const manifestRead = readRepositoryManifest(root);
  if (manifestRead.status !== "ready") return null;
  const manifest = manifestRead.manifest;
  if (manifest.repositoryId !== registration.repositoryId) return null;
  return Object.freeze({
    repositoryId: registration.repositoryId,
    bindingId: registration.bindingId,
    manifest,
    root,
    hostedRepository: copyHostReference(registration.hostedRepository),
  });
}

function isCurrentGitHostLinkedCheck(
  root: FilesystemStoreRoot,
  state: AccessManagementState,
  checked: CheckedGitHostLinkedAccess,
) {
  return (
    state.initialization.stage === "completed" &&
    (state.revision === checked.managementRevision ||
      (checked.allowUnrelatedRevision === true &&
        checked.candidates.length === 1)) &&
    !present(root, PENDING) &&
    !present(root, REPLACE)
  );
}

function selectGitHostLinkedRegistrations(
  state: AccessManagementState,
  checked: CheckedGitHostLinkedAccess,
) {
  const confirmed = new Map(
    checked.candidates.map((entry) => [entry.repositoryId, entry]),
  );
  return state.registeredRepositories
    .filter((registration) => {
      const target = confirmed.get(registration.repositoryId);
      return Boolean(
        target &&
          registration.bindingId === target.bindingId &&
          sameHostReference(
            registration.hostedRepository,
            target.hostedRepository,
          ),
      );
    })
    .sort((a, b) =>
      a.repositoryId < b.repositoryId
        ? -1
        : a.repositoryId > b.repositoryId
          ? 1
          : 0,
    );
}

function readRepositoryAccessCollection(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  checked: CheckedGitHostLinkedAccess,
): RepositoryAccessCollectionResult {
  if (!isUnexpiredAccountPrincipal(principal))
    return { status: "unavailable", reason: "repository_access_rejected" };
  const result = locked<{
    managementRevision: number;
    repositories: readonly AuthorizedRepository[];
  }>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveAccessPrincipal(principal, current.state);
      if (
        !actor ||
        current.state.initialization.stage !== "completed" ||
        !isCurrentGitHostLinkedCheck(root, current.state, checked)
      )
        return {
          status: "unavailable",
          reason: "repository_access_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      const selected = selectGitHostLinkedRegistrations(current.state, checked);
      if (selected.length !== checked.candidates.length)
        return {
          status: "unavailable",
          reason: "repository_access_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "repository_access_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
      const repositories: AuthorizedRepository[] = [];
      for (const registration of selected) {
        const access = observeRegisteredRepository(registration);
        if (!access)
          return {
            status: "unavailable",
            reason: "repository_access_observation_unknown",
            publication: "not_attempted",
            revision: current.state.revision,
            cleanupConfirmed: true,
          };
        repositories.push(access);
      }
      return {
        status: "completed",
        value: Object.freeze({
          managementRevision: current.state.revision,
          repositories: Object.freeze(repositories),
        }),
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "repository_access_observation_unknown",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  if (result.status === "completed")
    return Object.freeze({ status: "completed", ...result.value });
  if (
    result.secondaryReason ||
    result.reason ===
      "filesystem_store_lock_operation_completed_cleanup_unknown" ||
    result.reason === "state_store_lock_unknown"
  )
    return {
      status: "unavailable",
      reason: "repository_access_release_unknown",
    };
  if (
    result.reason === "repository_access_rejected" ||
    result.reason === "repository_access_cleanup_pending"
  )
    return { status: "unavailable", reason: result.reason };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "repository_access_lock_unavailable"
      : "repository_access_observation_unknown",
  };
}
