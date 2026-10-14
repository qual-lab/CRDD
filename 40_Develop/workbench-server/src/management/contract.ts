/**
 * 非鍵管理の表示・要求境界をAMの共通結果へ接続する。
 * @responsibility 不信JSONとFormの閉構造を検査し、AMの認可・意味変換を再実装しない。
 * @trace ARCH-000013
 * @boundary BrowserとWorkbenchの同Origin搬送。
 * @security 資格・Binding・内部Path・自由文字列理由を表示へ透過しない。
 */
import type {
  CurrentAccessOutcome,
  ManagementReadOutcome,
  ManagementOperationOutcome,
} from "../../../access-management/src/index.ts";

/**
 * 管理readの対象を固定する。
 * @responsibility 本人と他ユーザー管理の種類を混同しない。
 * @trace ARCH-000013
 * @shape current／users／roles／repositories／exposure。
 * @invariant 鍵と初回状態を含めない。
 * @boundary 表示GETと管理Reader。
 * @security 任意Pathを対象指定にしない。
 * @compatibility 現行本人と四管理readだけ。
 */
export type ManagementView =
  | "current"
  | "users"
  | "roles"
  | "repositories"
  | "exposure";
/**
 * AM共通結果とTransportだけの未取得を表示へ渡す。
 * @responsibility 意味Ownerの型を再利用し、Transport非提供を成功にしない。
 * @trace ARCH-000013
 * @shape AM三結果Unionと容量超過・未構成。
 * @invariant Transport理由をAM保存結果へ戻さない。
 * @boundary 非秘密の管理表示。
 * @security 新しい秘密・回復参照なし。
 * @compatibility AM共通結果の現行版だけ。
 */
export type WorkbenchManagementResult =
  | CurrentAccessOutcome
  | ManagementReadOutcome
  | ManagementOperationOutcome
  | Readonly<{
      status: "unavailable";
      reason: "management_response_too_large" | "management_not_configured";
    }>;

/**
 * JSON由来の平坦Objectを実行可能なPropertyから分離する。
 * @responsibility accessor・未知Prototypeを値として受理しない。
 * @trace ARCH-000013
 * @input 任意値。
 * @returns 平坦なown data Objectまたはnull。
 * @precondition N/A: 不信値を受ける。
 * @postcondition getterを評価しない。
 * @effect N/A: 局所検査だけ。
 * @failure 観測不能はnull。
 * @invariant ArrayをObjectへ補完しない。
 * @boundary 不信値と表示値。
 * @security 任意Methodを呼ばない。
 * @concurrency N/A: 同期検査だけ。
 */
function record(value: unknown): Record<string, unknown> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).some(
        (key) =>
          typeof key !== "string" ||
          !Object.hasOwn(descriptors[key] ?? {}, "value"),
      )
    )
      return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * AM共通結果の閉shapeを搬送先で検査する。
 * @responsibility AM共通結果の不信値を部分成功や未知field付き表示へ受理しない。
 * @trace ARCH-000013
 * @input 不信結果と要求したread種別またはmutation。
 * @returns 検査済みAM共通結果。
 * @precondition JSON構文・容量はTransportが確認する。
 * @postcondition 改訂・null／明示空・既知出版・清掃を変換しない。
 * @effect N/A: 値の検査だけ。
 * @failure 不正結果は固定例外。
 * @invariant Roleの実行許可を判定しない。
 * @boundary AM共通結果とBrowser Consumer。
 * @security Path・秘密・自由文字列理由を受理しない。
 * @concurrency 当該結果だけ。別改訂を合成しない。
 */
export function inspectManagementResult(
  value: unknown,
  view: ManagementView | "mutation",
): WorkbenchManagementResult {
  const result = record(value);
  if (!result) throw new Error("workbench_management_result_invalid");
  const keys = Object.keys(result).sort().join(",");
  /**
   * 改訂の表示値を検査する。
   * @responsibility safeな正整数だけを受理する。
   * @trace ARCH-000013
   * @input 不信な改訂値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementRevision = (v: unknown) =>
    Number.isSafeInteger(v) && Number(v) > 0;
  /**
   * UUIDの表示値を検査する。
   * @responsibility 小文字UUIDv4だけを受理する。
   * @trace ARCH-000013
   * @input 不信なUUID値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementUserId = (v: unknown) =>
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      v,
    );
  /**
   * ロールの表示値を検査する。
   * @responsibility 採用済み三ロールだけを受理する。
   * @trace ARCH-000013
   * @input 不信なロール値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementRole = (v: unknown) =>
    v === "developer" || v === "manager" || v === "administrator";
  /**
   * 表示名の表示値を検査する。
   * @responsibility 正規化不要な既存表示名だけを受理する。
   * @trace ARCH-000013
   * @input 不信な表示名値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementUserName = (v: unknown) =>
    typeof v === "string" &&
    v === v.trim() &&
    v.length <= 256 &&
    [...v].length > 0 &&
    [...v].length <= 128 &&
    !/[\p{Cc}\p{Cs}]/u.test(v);
  /**
   * Repository IDの表示値を検査する。
   * @responsibility 既存128文字以内のIDだけを受理する。
   * @trace ARCH-000013
   * @input 不信なRepository ID値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementRepositoryId = (v: unknown) =>
    typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(v);
  /**
   * 内容範囲の表示値を検査する。
   * @responsibility 重複なしの二範囲集合だけを受理する。
   * @trace ARCH-000013
   * @input 不信な内容範囲値。
   * @returns 妥当性のboolean。
   * @precondition JSON境界の値を受ける。
   * @postcondition 値を補完・正規化しない。
   * @effect N/A: 値の検査だけ。
   * @failure 不一致はfalse。
   * @invariant 実行認可を判定しない。
   * @boundary 管理JSONと表示値。
   * @security Methodを評価しない。
   * @concurrency N/A: 同期検査だけ。
   */
  const isManagementWorkspaceRange = (v: unknown) =>
    Array.isArray(v) &&
    v.length <= 2 &&
    new Set(v).size === v.length &&
    v.every((x) => x === "development" || x === "management");
  let valid = false;
  if (keys === "reason,status" && result.status === "unavailable") {
    const permitted =
      view === "current"
        ? [
            "current_access_authentication_rejected",
            "current_access_lock_unavailable",
            "current_access_cleanup_pending",
            "current_access_observation_unknown",
            "current_access_release_unknown",
          ]
        : view === "mutation"
          ? []
          : ["management_read_rejected", "management_read_unavailable"];
    valid = [
      ...permitted,
      "management_response_too_large",
      "management_not_configured",
    ].includes(result.reason as string);
  } else if (view === "mutation") {
    if (result.status === "rejected")
      valid =
        keys === "reason,status" &&
        result.reason === "management_request_rejected";
    else if (result.status === "completed")
      valid =
        ((keys ===
          "cleanupConfirmed,expectedRevision,operationId,publication,revision,status,userId" &&
          (result.userId === null || isManagementUserId(result.userId))) ||
          (keys ===
            "cleanupConfirmed,expectedRevision,operationId,publication,repositoryId,revision,status" &&
            isManagementRepositoryId(result.repositoryId))) &&
        isManagementUserId(result.operationId) &&
        isManagementRevision(result.expectedRevision) &&
        isManagementRevision(result.revision) &&
        result.revision === Number(result.expectedRevision) + 1 &&
        result.publication === "confirmed" &&
        result.cleanupConfirmed === true;
    else if (result.status === "unavailable")
      valid =
        keys ===
          "cleanupConfirmed,expectedRevision,observedRevision,operationId,primaryFailure,publication,reason,status" &&
        result.reason === "management_operation_unavailable" &&
        isManagementUserId(result.operationId) &&
        isManagementRevision(result.expectedRevision) &&
        (result.observedRevision === null ||
          isManagementRevision(result.observedRevision)) &&
        ["not_attempted", "unconfirmed", "confirmed"].includes(
          result.publication as string,
        ) &&
        typeof result.cleanupConfirmed === "boolean" &&
        [
          "previous_materials_settled",
          "previous_materials_unavailable",
          "capacity_exceeded",
          "identity_generation_failed",
          "candidate_invalid",
          "repository_validation_failed",
          "prepare_failed",
          "publication_failed",
          "readback_failed",
          "cleanup_failed",
          "release_unknown",
          "storage_unavailable",
        ].includes(result.primaryFailure as string);
  } else if (
    result.status === "completed" &&
    isManagementRevision(result.revision)
  ) {
    if (view === "current") {
      const user = record(result.user),
        access = record(result.contentAccess);
      valid =
        keys === "contentAccess,permittedRepositories,revision,status,user" &&
        user !== null &&
        access !== null &&
        Object.keys(user).sort().join(",") === "role,userId,username" &&
        isManagementUserId(user.userId) &&
        isManagementUserName(user.username) &&
        isManagementRole(user.role) &&
        Object.keys(access).join(",") === "workspaceIds" &&
        isManagementWorkspaceRange(access.workspaceIds) &&
        Array.isArray(result.permittedRepositories) &&
        result.permittedRepositories.every((entry) => {
          const item = record(entry);
          return (
            item !== null &&
            Object.keys(item).sort().join(",") ===
              "repositoryId,workspaceIds" &&
            isManagementRepositoryId(item.repositoryId) &&
            isManagementWorkspaceRange(item.workspaceIds)
          );
        }) &&
        new Set(
          result.permittedRepositories.map(
            (entry) => record(entry)?.repositoryId,
          ),
        ).size === result.permittedRepositories.length;
    } else {
      const field =
        view === "users"
          ? "users"
          : view === "roles"
            ? "roles"
            : "repositories";
      valid =
        keys === ["status", "revision", field].sort().join(",") &&
        Array.isArray(result[field]) &&
        result[field].every((entry: unknown) => {
          const item = record(entry);
          if (!item) return false;
          const fields = Object.keys(item).sort().join(",");
          return view === "users"
            ? fields === "role,userId,username" &&
                isManagementUserId(item.userId) &&
                isManagementUserName(item.username) &&
                isManagementRole(item.role)
            : view === "roles"
              ? fields === "role,workspaceIds" &&
                isManagementRole(item.role) &&
                isManagementWorkspaceRange(item.workspaceIds)
              : view === "repositories"
                ? fields === "repositoryId" &&
                  isManagementRepositoryId(item.repositoryId)
                : fields === "repositoryId,workspaceIds" &&
                  isManagementRepositoryId(item.repositoryId) &&
                  (item.workspaceIds === null ||
                    isManagementWorkspaceRange(item.workspaceIds));
        }) &&
        new Set(
          result[field].map(
            (entry: unknown) =>
              record(entry)?.[
                view === "users"
                  ? "userId"
                  : view === "roles"
                    ? "role"
                    : "repositoryId"
              ],
          ),
        ).size === result[field].length;
    }
  }
  if (!valid) throw new Error("workbench_management_result_invalid");
  return value as WorkbenchManagementResult;
}
