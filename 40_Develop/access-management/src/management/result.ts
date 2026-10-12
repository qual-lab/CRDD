/**
 * 管理結果をTransport非依存の非秘密投影へ閉じる。
 * @responsibility 保存Ownerの結果を共通解釈し、HTTPやMCPのEnvelopeを引き取らない。
 * @trace ARCH-000013
 * @boundary AM公開結果とWorkbench／MCPの表示搬送。
 * @security Path・Binding・資格・内部自由文字列を投影へ透過しない。
 */
import type {
  UserRoleManagementResult,
  RepositoryExposureManagementResult,
} from "../state/file-store.ts";
import type { ManagementStateResult } from "./read-state.ts";
import type { CurrentAccessResult } from "../access/current-access.ts";

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
  result: UserRoleManagementResult | RepositoryExposureManagementResult,
) {
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
  const reasons: Readonly<Record<string, string>> = {
    state_store_previous_pending_settled: "previous_materials_settled",
    state_store_pending_failed: "previous_materials_unavailable",
    state_store_capacity_exceeded: "capacity_exceeded",
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
export function projectManagementReadResult(result: ManagementStateResult) {
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
      : snapshot.kind === "roleContentAccess"
        ? {
            roles: snapshot.roles.map(({ role, workspaceIds }) => ({
              role,
              workspaceIds: [...workspaceIds],
            })),
          }
        : snapshot.kind === "registeredRepositories"
          ? {
              repositories: snapshot.repositories.map(({ repositoryId }) => ({
                repositoryId,
              })),
            }
          : {
              repositories: snapshot.repositories.map(
                ({ repositoryId, workspaceIds }) => ({
                  repositoryId,
                  workspaceIds:
                    workspaceIds === null ? null : [...workspaceIds],
                }),
              ),
            }),
  };
}

/**
 * 通常本人の読取りをSurface提供可否と分離して投影する。
 * @responsibility 全Role本人と内容範囲だけを返し、内部管理候補を開示しない。
 * @trace ARCH-000013
 * @input AMの本人read結果。
 * @returns 固定未取得、または同改訂の本人・内容範囲・許可Repository。
 * @precondition 通常接続Readerが生成した内部値だけを受ける。
 * @postcondition 本人名を他User一覧から推定しない。
 * @effect N/A: 非秘密値の局所コピーのみ。
 * @failure 拒否／観測不能の固定理由を保持する。
 * @invariant 管理権限やSurface実装を内容範囲から生成しない。
 * @boundary 本人readとLocal／Remote表示。
 * @security managementOperations・資格・Binding・他User・Pathを含めない。
 * @concurrency 同改訂のread結果だけ。次要求はfreshに取得する。
 */
export function projectCurrentAccessResult(result: CurrentAccessResult) {
  if (result.status !== "completed")
    return { status: "unavailable" as const, reason: result.reason };
  const snapshot = result.snapshot;
  return {
    status: "completed" as const,
    revision: snapshot.revision,
    user: {
      userId: snapshot.user.userId,
      username: snapshot.user.username,
      role: snapshot.user.role,
    },
    contentAccess: { workspaceIds: [...snapshot.contentAccess.workspaceIds] },
    permittedRepositories: snapshot.permittedRepositories.map(
      ({ repositoryId, workspaceIds }) => ({
        repositoryId,
        workspaceIds: [...workspaceIds],
      }),
    ),
  };
}

/**
 * 通常管理保存の非秘密結果型。
 * @responsibility 同じprojectorの実結果型を利用側へ公開する。
 * @trace ARCH-000013
 * @shape completed／rejected／unavailableの判別Union。
 * @invariant HTTPやMCP固有の理由・Envelopeを含めない。
 * @boundary AM公開結果と利用側。
 * @security 生Secret・Path・Bindingなし。
 * @compatibility 現行の通常管理結果だけ。
 */
export type ManagementOperationOutcome = ReturnType<
  typeof projectManagementOperationResult
>;
/**
 * 管理対象別readの非秘密結果型。
 * @responsibility 読取り結果のshapeをprojectorと同一Ownerへ固定する。
 * @trace ARCH-000013
 * @shape 改訂付き対象専用結果または固定未取得。
 * @invariant 各readの改訂を分離する。
 * @boundary AM公開結果と利用側。
 * @security Binding・資格なし。
 * @compatibility 現行四管理readだけ。
 */
export type ManagementReadOutcome = ReturnType<
  typeof projectManagementReadResult
>;
/**
 * 通常本人の最小公開結果型。
 * @responsibility 本人表示と管理候補非公開を型境界へ保持する。
 * @trace ARCH-000013
 * @shape 本人・内容範囲・許可Repositoryまたは固定未取得。
 * @invariant managementOperationsを公開しない。
 * @boundary AM本人Readerと利用側。
 * @security 他User・資格・Pathなし。
 * @compatibility 通常三Roleの表示だけ。
 */
export type CurrentAccessOutcome = ReturnType<
  typeof projectCurrentAccessResult
>;
