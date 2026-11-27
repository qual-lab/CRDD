/**
 * 管理操作の現在認可と対象別の非秘密結果を提供する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { AccessActor, AccountAccessPrincipal } from "./types.ts";
import type { FilesystemStoreRoot } from "../initialization/root.ts";
import type {
  ManagementOperationOutcome,
  ManagementReadKind,
  ManagementReadOutcome,
  ManagementStateResult,
  ManagementStateSnapshot,
} from "../permission/types.ts";
import { evaluateManagementPermission } from "../permission/validation.ts";
import type { RepositoryManagementResult } from "../repository/types.ts";
import { locked } from "../storage/lock.ts";
import { readCurrent, settlePending } from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import type { UserRoleManagementResult } from "../user/types.ts";
import { acceptsAccessPrincipal, resolveAccessPrincipal } from "./principal.ts";

export { evaluateManagementPermission } from "../permission/validation.ts";

/**
 * 管理対象のprimitive識別子を検査する。
 * @responsibility 未知値・Proxy・暗黙変換を状態観測前に拒否する。
 * @trace ARCH-000013
 * @input 信頼しない対象種類値。
 * @returns 固定四literalだけtrue。
 * @precondition N/A: 任意値を検査する。
 * @postcondition getter・変換関数を実行せず入力を変更しない。
 * @effect N/A: primitive等値比較だけ。
 * @failure 不正値はfalse。外部故障を所有しない。
 * @invariant 対象種類を既定値で補完しない。
 * @boundary 管理読取りの入力検査。
 * @security trueは認証・参照許可ではない。
 * @concurrency N/A: 同期局所検査だけ。
 */
export function isManagementReadKind(
  value: unknown,
): value is ManagementReadKind {
  return value === "users" || value === "registeredRepositories";
}

/**
 * 同一改訂の現在管理認可を対象別の所有DTOへ投影する。
 * @responsibility 固定対象Role判定を適用し管理範囲だけを返す。
 * @trace ARCH-000013
 * @input 完全検査済み状態、そこから認証した本人、検査済みkind。
 * @returns 許可対象の凍結済みDTO、または非開示拒否のnull。
 * @precondition 保存Ownerが同じLock下でSchema・本人改訂を検査済み。
 * @postcondition 内部User・配列・資格を共有せず、初回途中・developerへ情報を返さない。
 * @effect N/A: 所有メモリ値の計算だけでFilesystemを観測しない。
 * @failure 改訂不一致・未完了初回・現在参照不許可はnull。
 * @invariant 管理参照から内容実アクセスを許可しない。
 * @boundary AM管理認可・投影と保存Owner。
 * @security Root・秘密材料・種類外情報を返さない。
 * @concurrency 同じLock区間で取得した改訂だけ。後続操作は再認可する。
 */
export function projectManagementState(
  state: AccessManagementState,
  actor: AccessActor,
  kind: ManagementReadKind,
): ManagementStateSnapshot | null {
  if (
    actor.revision !== state.revision ||
    state.initialization.stage !== "completed" ||
    actor.role === "developer"
  )
    return null;
  switch (kind) {
    case "users":
      return Object.freeze({
        revision: state.revision,
        kind,
        users: Object.freeze(
          state.users
            .filter(
              (user) =>
                evaluateManagementPermission(actor.role, {
                  operation: "updateUserName",
                  targetRole: user.role,
                }) === "allowed",
            )
            .map((user) =>
              Object.freeze({
                userId: user.userId,
                username: user.username,
                role: user.role,
              }),
            ),
        ),
      });
    case "registeredRepositories":
      if (
        evaluateManagementPermission(actor.role, {
          operation: "registerRepository",
        }) !== "allowed"
      )
        return null;
      return Object.freeze({
        revision: state.revision,
        kind,
        repositories: Object.freeze(
          state.registeredRepositories.map((repository) =>
            Object.freeze({
              repositoryId: repository.repositoryId,
              bindingId: repository.bindingId,
            }),
          ),
        ),
      });
  }
}

/**
 * 通常保存結果を固定した非秘密Unionへ写す。
 * @responsibility 最初の失敗分類と既知出版・清掃の事実を保持する。
 * @trace ARCH-000013
 * @input AMの通常管理Result。
 * @returns Workbench／MCPで共通利用する非秘密の閉管理結果。
 * @precondition AM公開入口が生成した値だけを受ける。
 * @postcondition 内部理由・Path・secondaryを転記しない。
 * @effect N/A: 値の投影のみ。
 * @failure 未列挙理由はstorage_unavailableへ閉じる。
 * @invariant 既知publicationをrollbackや成功へ変えない。
 * @boundary AM内部結果とTransport非依存の公開投影。
 * @security 自由文字列理由・秘密・回復参照を含めない。
 * @concurrency N/A: 同期の結果を一回投影する。
 */
export function projectManagementOperationResult(
  result: UserRoleManagementResult | RepositoryManagementResult,
): ManagementOperationOutcome {
  if (result.status === "completed") {
    return {
      status: "completed" as const,
      operationId: result.operationId,
      expectedRevision: result.expectedRevision,
      revision: result.revision,
      ...("userId" in result
        ? { userId: result.userId }
        : { repositoryId: result.repositoryId }),
      publication: result.publication,
      cleanupConfirmed: result.cleanupConfirmed,
    };
  }
  if (result.reason === "management_operation_rejected")
    return {
      status: "rejected" as const,
      reason: "management_request_rejected" as const,
    };
  if (
    result.primaryFailure === "state_store_revision_conflict" &&
    result.publication === "not_attempted" &&
    result.cleanupConfirmed
  )
    return {
      status: "rejected" as const,
      reason: "management_revision_conflict" as const,
    };
  const reasons: Readonly<Record<string, string>> = {
    state_store_previous_pending_settled: "previous_materials_settled",
    state_store_pending_failed: "previous_materials_unavailable",
    state_store_identity_failed: "identity_generation_failed",
    state_store_candidate_failed: "candidate_invalid",
    state_store_repository_binding_failed: "repository_validation_failed",
    state_store_prepare_failed: "prepare_failed",
    state_store_publish_failed: "publication_failed",
    state_store_read_back_failed: "readback_failed",
    state_store_cleanup_failed: "cleanup_failed",
    state_store_lock_unknown: "release_unknown",
    filesystem_store_lock_operation_completed_cleanup_unknown:
      "release_unknown",
  };
  return {
    status: "unavailable" as const,
    reason: "management_operation_unavailable" as const,
    primaryFailure: Object.hasOwn(reasons, result.primaryFailure)
      ? (reasons[result.primaryFailure] ?? "storage_unavailable")
      : "storage_unavailable",
    operationId: result.operationId,
    expectedRevision: result.expectedRevision,
    observedRevision: result.observedRevision,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 管理対象別の投影を非秘密の閉結果へ変換する。
 * @responsibility 既存filterとnull／空を保持し、Bindingを結果から除く。
 * @trace ARCH-000013
 * @input AMの管理対象別read結果。
 * @returns 同改訂の対象専用結果または固定未取得。
 * @precondition AM公開Readerが生成した内部値だけを受ける。
 * @postcondition 別readの改訂を混合しない。
 * @effect N/A: 所有値の局所投影のみ。
 * @failure 拒否と観測不明を固定した別理由へ写す。
 * @invariant 未取得を空成功・設定なしにしない。
 * @boundary AM管理ReaderとTransport非依存表示。
 * @security 資格・Path・Binding・回復参照を含めない。
 * @concurrency 当該read改訂だけ。認可を後続要求へ保持しない。
 */
export function projectManagementReadResult(
  result: ManagementStateResult,
): ManagementReadOutcome {
  if (result.status === "unavailable")
    return {
      status: "unavailable" as const,
      reason:
        result.reason === "management_state_read_rejected" ||
        result.reason === "management_state_authentication_rejected"
          ? ("management_read_rejected" as const)
          : ("management_read_unavailable" as const),
    };
  const snapshot = result.snapshot;
  return {
    status: "completed" as const,
    revision: snapshot.revision,
    ...(snapshot.kind === "users"
      ? {
          users: snapshot.users.map(({ userId, username, role }) => ({
            userId,
            username,
            role,
          })),
        }
      : {
          repositories: snapshot.repositories.map(({ repositoryId }) => ({
            repositoryId,
          })),
        }),
  };
}

/**
 * 現在許可された管理対象を同じ改訂から読み取り返す。
 * @responsibility 対象別認可前に保存材料を清掃せず、終了確認後だけDTOを公開する。
 * @trace ARCH-000013
 * @input 検証済みRoot、外部認証を経た本人の紐付け・期限、管理対象kind。
 * @returns 対象別投影、または情報を含まない固定拒否・未取得理由。
 * @precondition Rootは既存内部Ownerが検証済み。Transport入力境界はConsumerが担当する。
 * @postcondition 完全状態・認証・対象別管理許可・清掃・解放確認時だけcompleted。
 * @effect 既存Lock、現在状態の読取り、許可後の保存途中材料の清掃。
 * @failure 不正kind・developer・初回途中は同じ参照拒否。清掃・解放不明はDTOなし。
 * @invariant 管理参照を内容閲覧・更新・鍵処置のAuthorityへ転用しない。
 * @boundary AM保存Ownerと通常管理の表示Consumer。
 * @security 生鍵・資格材料・内部Path・Lock回復ID・種類外情報を返さない。
 * @concurrency 同じLock内の現在認証・改訂。後続処置は別要求で再認可する。
 */
export function readManagementStateSnapshot(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  kind: unknown,
): ManagementStateResult {
  if (!isManagementReadKind(kind))
    return { status: "unavailable", reason: "management_state_read_rejected" };
  if (!acceptsAccessPrincipal(principal))
    return {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    };
  const result = locked<ManagementStateSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveAccessPrincipal(principal, current.state);
      if (!actor)
        return {
          status: "unavailable",
          reason: "management_state_authentication_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      const snapshot = projectManagementState(current.state, actor, kind);
      if (!snapshot)
        return {
          status: "unavailable",
          reason: "management_state_read_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "management_state_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
      return {
        status: "completed",
        value: snapshot,
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "management_state_observation_unknown",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  if (result.status === "completed")
    return { status: "completed", snapshot: result.value };
  if (
    result.secondaryReason ||
    result.reason ===
      "filesystem_store_lock_operation_completed_cleanup_unknown" ||
    result.reason === "state_store_lock_unknown"
  )
    return {
      status: "unavailable",
      reason: "management_state_release_unknown",
    };
  if (result.reason === "management_state_authentication_rejected")
    return {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    };
  if (result.reason === "management_state_read_rejected")
    return { status: "unavailable", reason: "management_state_read_rejected" };
  if (result.reason === "management_state_cleanup_pending")
    return {
      status: "unavailable",
      reason: "management_state_cleanup_pending",
    };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "management_state_lock_unavailable"
      : "management_state_observation_unknown",
  };
}

/**
 * 現在許可された管理対象を同じ改訂から読み取り返す。
 * @responsibility 対象別認可前に保存材料を清掃せず、終了確認後だけDTOを公開する。
 * @trace ARCH-000013
 * @input 検証済みRoot、確認済みアカウント主体、管理対象kind。
 * @returns 対象別投影、または情報を含まない固定拒否・未取得理由。
 * @precondition Rootは既存内部Ownerが検証済み。Transport入力境界はConsumerが担当する。
 * @postcondition 完全状態・認証・対象別管理許可・清掃・解放確認時だけcompleted。
 * @effect 既存Lock、current読取り、許可後の短命材料清掃。
 * @failure 不正kind・developer・初回途中は同じ参照拒否。清掃・解放不明はDTOなし。
 * @invariant 管理参照を内容閲覧・更新・鍵処置のAuthorityへ転用しない。
 * @boundary AM保存Ownerと通常管理の表示Consumer。
 * @security 生鍵・資格材料・内部Path・Lock回復ID・種類外情報を返さない。
 * @concurrency 同じLock内の現在認証・改訂。後続処置は別要求で再認可する。
 */
export function readManagementState(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  kind: unknown,
): ManagementReadOutcome {
  return projectManagementReadResult(
    readManagementStateSnapshot(root, principal, kind),
  );
}
