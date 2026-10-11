/**
 * 管理対象の種類ごとに現在許可された非秘密情報を投影する。
 * @responsibility User・Role内容設定・登録・公開範囲を別DTOへ閉じ、資格・保存処理を引き取らない。
 * @trace ARCH-000013
 */
import type { AuthenticatedRequest } from "../credential/authentication.ts";
import type { AccessManagementState } from "../state/parse.ts";
import {
  type AccessRole,
  evaluateManagementPermission,
} from "../access/management-permission.ts";

/**
 * 通常管理の参照対象を四種類に限定する。
 * @responsibility 不明対象を汎用内部Snapshot読取りへ転用しない。
 * @trace ARCH-000013
 * @shape users、roleContentAccess、registeredRepositories、exposureのliteral union。
 * @invariant 鍵・初回・交換・内容本文を含めない。
 * @boundary Packageの管理読取り入力。
 * @security 種類の指定だけでは参照Authorityにならない。
 * @compatibility MCP公開Schemaや旧CROS全状態readではない。
 */
export type ManagementReadKind =
  | "users"
  | "roleContentAccess"
  | "registeredRepositories"
  | "exposure";

/**
 * 同一改訂の管理対象別投影を表す。
 * @responsibility 対象以外の管理情報を同じ応答へ混在させない。
 * @trace ARCH-000013
 * @shape revision・kindと対象専用のusers、rolesまたはrepositories。
 * @invariant Exposureのnullは設定レコード不存在、空配列は明示公開範囲0。
 * @boundary 現在管理認可を確認したPackage Consumerだけ。
 * @security 資格・内部Path・Context本文を含めずBindingは非Authority。
 * @compatibility 三Role・二Workspaceの採用済み設定だけ。
 */
export type ManagementStateSnapshot = Readonly<{ revision: number }> &
  (
    | Readonly<{
        kind: "users";
        users: readonly Readonly<{
          userId: string;
          username: string;
          role: AccessRole;
        }>[];
      }>
    | Readonly<{
        kind: "roleContentAccess";
        roles: readonly Readonly<{
          role: AccessRole;
          workspaceIds: readonly ("development" | "management")[];
        }>[];
      }>
    | Readonly<{
        kind: "registeredRepositories";
        repositories: readonly Readonly<{
          repositoryId: string;
          bindingId: string;
        }>[];
      }>
    | Readonly<{
        kind: "exposure";
        repositories: readonly Readonly<{
          repositoryId: string;
          workspaceIds: readonly ("development" | "management")[] | null;
        }>[];
      }>
  );

/**
 * 確定した管理投影と非開示の拒否・未取得理由を分ける。
 * @responsibility 認可・清掃・解放未確認で管理状態を返さない。
 * @trace ARCH-000013
 * @shape completedはsnapshot、unavailableは固定reasonだけ。
 * @invariant 未取得を空一覧や設定なしへ変換しない。
 * @boundary 管理保存Ownerから利用側への返却。
 * @security 拒否時の対象存在・Role・件数・改訂・内部回復参照を公開しない。
 * @compatibility Package内部契約。Transport採用は別Gate。
 */
export type ManagementStateResult =
  | Readonly<{ status: "completed"; snapshot: ManagementStateSnapshot }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "management_state_authentication_rejected"
        | "management_state_read_rejected"
        | "management_state_lock_unavailable"
        | "management_state_cleanup_pending"
        | "management_state_observation_unknown"
        | "management_state_release_unknown";
    }>;

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
  return (
    value === "users" ||
    value === "roleContentAccess" ||
    value === "registeredRepositories" ||
    value === "exposure"
  );
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
  actor: AuthenticatedRequest,
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
    case "roleContentAccess":
      return Object.freeze({
        revision: state.revision,
        kind,
        roles: Object.freeze(
          state.roleContentAccess
            .filter(
              (role) =>
                evaluateManagementPermission(actor.role, {
                  operation: "updateRoleContentAccess",
                  targetRole: role.role,
                }) === "allowed",
            )
            .map((role) =>
              Object.freeze({
                role: role.role,
                workspaceIds: Object.freeze([...role.workspaceIds]),
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
    case "exposure":
      if (
        evaluateManagementPermission(actor.role, {
          operation: "updateExposure",
        }) !== "allowed"
      )
        return null;
      return Object.freeze({
        revision: state.revision,
        kind,
        repositories: Object.freeze(
          state.registeredRepositories.map((repository) => {
            const exposure = state.exposure.find(
              (item) => item.repositoryId === repository.repositoryId,
            );
            return Object.freeze({
              repositoryId: repository.repositoryId,
              workspaceIds: exposure
                ? Object.freeze([...exposure.workspaceIds])
                : null,
            });
          }),
        ),
      });
  }
}
