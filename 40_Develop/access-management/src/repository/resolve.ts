/**
 * 現在認可・公開範囲・実Rootから利用対象と集合を解決する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import {
  createFilesystemRepositoryObservationPort,
  type FilesystemStoreRoot,
  inspectRepositoryManifest,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "../../../domain-model/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { resolveCredentialAuthentication } from "../credential/authentication.ts";
import { readCredentialId } from "../credential/token.ts";
import type { AuthenticatedRequest } from "../credential/types.ts";
import { locked, readCurrent, settlePending } from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { deriveRepositoryBindingId } from "./binding.ts";
import type {
  AuthorizedRepository,
  RepositoryAccess,
  RepositoryAccessCollectionResult,
  RepositoryAccessResult,
} from "./types.ts";

/**
 * 同じ要求の公開前後で現在認可集合の契約値を比較する。
 * @responsibility 管理改訂・Binding・Workspace・manifestの変化を公開前に拒否する。
 * @trace ARCH-000013
 * @input 初回と再観測のAM集合結果。
 * @returns 両観測がcompletedで契約値が一致する場合だけtrue。
 * @precondition 呼出し側は既存AM APIを要求内で二回呼び、外部JSONを渡さない。
 * @postcondition 不明・改訂差・集合差を一致へ畳まない。
 * @effect N/A: 短命値の同期比較だけ。
 * @failure 観測不成立はfalse。
 * @invariant 比較結果は新Authorityや次要求の認可証明ではない。同一Pathの物理実体不変は保証しない。
 * @boundary AM現在認可集合とWorkbench／MCP公開直前。
 * @security Root・資格を比較文字列や公開結果へ追加しない。
 * @concurrency 呼出し側は再観測・比較後にSignalを再確認し、外部I/Oなしに公開または拒否する。
 */
export function sameAccessCollection(
  first: RepositoryAccessCollectionResult,
  second: RepositoryAccessCollectionResult,
): boolean {
  if (
    first.status !== "completed" ||
    second.status !== "completed" ||
    first.managementRevision !== second.managementRevision
  )
    return false;
  const normalized = [first, second].map((collection) =>
    collection.repositories
      .map((repository) => ({
        repositoryId: repository.repositoryId,
        bindingId: repository.bindingId,
        workspaceIds: [...repository.workspaceIds].sort(),
        manifest: Object.fromEntries(
          Object.entries(repository.manifest).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        ),
      }))
      .sort((a, b) =>
        a.repositoryId < b.repositoryId
          ? -1
          : a.repositoryId > b.repositoryId
            ? 1
            : 0,
      ),
  );
  return JSON.stringify(normalized[0]) === JSON.stringify(normalized[1]);
}

/**
 * 同じ現在改訂から内容範囲と公開対象を選ぶ。
 * @responsibility 管理能力を内容権限へ転用せず、観測前に対象を絞る。
 * @trace ARCH-000013
 * @input 完全状態、同改訂の認証主体、primitive検査済みIDと範囲。
 * @returns 許可された登録tuple、またはnull。
 * @precondition 保存Ownerの同じLock内で評価する。
 * @postcondition 未許可対象へのFilesystem観測0。
 * @effect N/A: メモリ内の現在値だけを参照する。
 * @failure 初回途中・改訂不一致・範囲外・未公開・未登録は同じnull。
 * @invariant administrator固定管理能力から内容許可を補完しない。
 * @boundary 認証主体→現在Role内容範囲→Exposure→登録対象。
 * @security 非許可対象のIdentityや件数を公開しない。
 * @concurrency 要求開始時の改訂だけ。次要求は再評価する。
 */
export function selectRepositoryAccess(
  state: AccessManagementState,
  actor: AuthenticatedRequest,
  repositoryId: string,
  workspaceId: "development" | "management",
): AccessManagementState["registeredRepositories"][number] | null {
  if (
    actor.revision !== state.revision ||
    state.initialization.stage !== "completed" ||
    !actor.workspaceIds.includes(workspaceId) ||
    !state.exposure.some(
      (item) =>
        item.repositoryId === repositoryId &&
        item.workspaceIds.includes(workspaceId),
    )
  )
    return null;
  return (
    state.registeredRepositories.find(
      (item) => item.repositoryId === repositoryId,
    ) ?? null
  );
}

/**
 * 許可済み登録のRoot・Binding・Canonical manifestを再検証する。
 * @responsibility 過去の登録成功を現在の実アクセス保証へ流用しない。
 * @trace ARCH-000013
 * @input 許可済み登録tuple、現在改訂、採用済み内容範囲。
 * @returns 同要求だけの内部相関値、またはnull。
 * @precondition 現在認可と短命材料清掃を確認済みである。
 * @postcondition 固定manifestのID・Root・Bindingが一致する場合だけ能力を返す。
 * @effect 既存VC Root検証とDomain固定manifestの最大1MiB読取り。
 * @failure Root・Binding・manifestの欠測・不正・観測不能はnull。例外は保存Ownerが固定理由へ変換する。
 * @invariant PROJECT_CONTEXTの存在・内容はアクセスAuthorityにしない。
 * @boundary AM実アクセス判定→VC／Domain既存観測。
 * @security 任意Path・本文・下位例外を結果へ透過しない。
 * @concurrency 同期bounded観測。本文の取得はLock解放後のConsumerが所有する。
 */
export function observeRepositoryAccess(
  registration: AccessManagementState["registeredRepositories"][number],
  revision: number,
  workspaceId: "development" | "management",
): RepositoryAccess | null {
  const verified = verifyRepositoryRoot(registration.repositoryRoot);
  if (verified.status !== "completed") return null;
  const root = resolveVerifiedRepositoryRoot(verified.capability);
  if (
    root === null ||
    deriveRepositoryBindingId(registration.repositoryId, root) !==
      registration.bindingId
  )
    return null;
  const observer = createFilesystemRepositoryObservationPort(
    verified.capability,
    1_048_576,
  );
  const file = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
  if (file.status !== "resolved") return null;
  const manifest = inspectRepositoryManifest(JSON.parse(file.source));
  if (
    !manifest ||
    manifest.repositoryId !== registration.repositoryId ||
    resolveVerifiedRepositoryRoot(verified.capability) !== root
  )
    return null;
  return Object.freeze({
    revision,
    repositoryId: registration.repositoryId,
    workspaceId,
    bindingId: registration.bindingId,
    manifest,
    root: verified.capability,
  });
}

/**
 * 今回内容要求の現在認可と実Repositoryを解決する。
 * @responsibility 未許可観測を防ぎ、清掃・解放確認後だけ内部Consumerへ渡す。
 * @trace ARCH-000013
 * @input 検証済み管理Root、Bearer、対象ID、development／management。
 * @returns 今回要求だけの内部RepositoryAccess、または非開示の固定理由。
 * @precondition 同Processの信頼したConsumerだけが利用し、Transportへ値を透過しない。
 * @postcondition 同改訂認可・bounded実体検証・Lock解放が全て成立時だけcompleted。
 * @effect 既存Lock・current認証・許可後pending清掃・固定Repository観測。
 * @failure 未認証・未登録・範囲外は同一拒否。清掃・実体・解放不明は値なし。
 * @invariant 後続変更は開始済み要求の取消を証明しない。別要求は必ずこの入口へ戻る。
 * @boundary AM現在認可とDomain／VC実アクセス。内容本文は解放後にConsumerが取得する。
 * @security token・内部Path・資格・Lock回復参照を返さず、結果を保存・cache・次要求へ再利用しない。
 * @concurrency 同じ管理Lock内の改訂で受理。技術的Root能力に失効機能があるとは主張しない。
 */
export function resolveRepositoryAccess(
  root: FilesystemStoreRoot,
  token: string,
  repositoryId: unknown,
  workspaceId: unknown,
): RepositoryAccessResult {
  if (
    typeof repositoryId !== "string" ||
    repositoryId.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(repositoryId) ||
    (workspaceId !== "development" && workspaceId !== "management") ||
    !readCredentialId(token)
  )
    return { status: "unavailable", reason: "repository_access_rejected" };
  const result = locked<RepositoryAccess>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      const registration = actor
        ? selectRepositoryAccess(
            current.state,
            actor,
            repositoryId,
            workspaceId,
          )
        : null;
      if (!registration)
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
      const access = observeRepositoryAccess(
        registration,
        current.state.revision,
        workspaceId,
      );
      if (!access)
        return {
          status: "unavailable",
          reason: "repository_access_observation_unknown",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      return {
        status: "completed",
        value: access,
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
    return { status: "completed", access: result.value };
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

/**
 * 今回許可された全Repositoryを同じ管理改訂から解決する。
 * @responsibility 現在認可の集合を一度に確定し、確認不成立を部分成功へ変換しない。
 * @trace ARCH-000013
 * @input 検証済み管理Rootと信頼しないBearer。
 * @returns 管理改訂と一意な許可Repository集合、または固定取得不能理由。
 * @precondition 信頼した同ProcessのConsumerが今回要求だけに使用する。
 * @postcondition 完全状態・認証・初期化・清掃・全対象観測・Lock解放成立時だけcompleted。
 * @effect 既存Lockと現在認証、許可後材料清掃、対象ごとの固定manifest観測。
 * @failure 認証・初期化不成立は拒否。対象観測・清掃・解放不明では集合なし。
 * @invariant 内容範囲とExposureの積集合を保持し、管理能力を内容許可にしない。
 * @boundary AM現在認可→VC／Domain技術的観測。本文は解放後のConsumerが取得する。
 * @security Root・資格をTransportへ透過せず、cache・保存・次要求への再利用を禁止する。
 * @concurrency 同じ既存Lock内の改訂。観測量は既存16MiB状態内の登録数に比例する。
 */
export function resolveRepositoryAccessCollection(
  root: FilesystemStoreRoot,
  token: string,
): RepositoryAccessCollectionResult {
  if (!readCredentialId(token))
    return { status: "unavailable", reason: "repository_access_rejected" };
  const result = locked<{
    managementRevision: number;
    repositories: readonly AuthorizedRepository[];
  }>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      if (!actor || current.state.initialization.stage !== "completed")
        return {
          status: "unavailable",
          reason: "repository_access_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      const selected = current.state.registeredRepositories
        .map((registration) => ({
          registration,
          workspaceIds: actor.workspaceIds.filter((workspaceId) =>
            current.state.exposure.some(
              (exposure) =>
                exposure.repositoryId === registration.repositoryId &&
                exposure.workspaceIds.includes(workspaceId),
            ),
          ),
        }))
        .filter((item) => item.workspaceIds.length > 0)
        .sort((a, b) =>
          a.registration.repositoryId < b.registration.repositoryId
            ? -1
            : a.registration.repositoryId > b.registration.repositoryId
              ? 1
              : 0,
        );
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
      for (const { registration, workspaceIds } of selected) {
        const workspaceId = workspaceIds[0];
        const access = workspaceId
          ? observeRepositoryAccess(
              registration,
              current.state.revision,
              workspaceId,
            )
          : null;
        if (!access)
          return {
            status: "unavailable",
            reason: "repository_access_observation_unknown",
            publication: "not_attempted",
            revision: current.state.revision,
            cleanupConfirmed: true,
          };
        repositories.push(
          Object.freeze({
            repositoryId: access.repositoryId,
            workspaceIds: Object.freeze(workspaceIds),
            bindingId: access.bindingId,
            manifest: access.manifest,
            root: access.root,
          }),
        );
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
