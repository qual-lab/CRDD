/**
 * 管理操作・現在認可・非秘密公開結果の共通型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { projectCurrentAccessResult } from "../authorization/current.ts";
import type {
  projectManagementOperationResult,
  projectManagementReadResult,
} from "../authorization/management.ts";
import type { AccessRole } from "../role/types.ts";

/**
 * 本人の現在権限を同じ改訂の表示情報に限定する。
 * @responsibility 内部資格・保存Path・他Userを含まない本人投影を所有する。
 * @trace ARCH-000013
 * @shape revision、user、対象制約付きmanagementOperations、contentAccess、permittedRepositories。
 * @invariant 管理候補と内容許可を混ぜず、Repository実アクセスは証明しない。
 * @boundary Package本人読取り。MCP公開Schemaではない。
 * @security token・資格ID・Verifier・salt・他User・内部Pathを含まない。
 * @compatibility 採用済み三RoleとDevelopment／Management範囲だけを扱う。
 */
export type CurrentAccessSnapshot = Readonly<{
  revision: number;
  user: Readonly<{ userId: string; username: string; role: AccessRole }>;
  managementOperations: readonly ManagementRequest[];
  contentAccess: Readonly<{
    workspaceIds: readonly ("development" | "management")[];
  }>;
  permittedRepositories: readonly Readonly<{
    repositoryId: string;
    workspaceIds: readonly ("development" | "management")[];
  }>[];
}>;

/**
 * 本人読取りの確定投影と非開示の未取得理由を分ける。
 * @responsibility 解放・回収未確認でSnapshotを返さない結果契約を保持する。
 * @trace ARCH-000013
 * @shape completedはsnapshotのみ、unavailableは固定reasonのみ。
 * @invariant 観測不能を空配列・不完全成功に畳まない。
 * @boundary AM保存Ownerから本人表示Consumerへの返却。
 * @security 内部Lock回復参照・Root・保存材料は返さない。
 * @compatibility HTTP／MCP入口の採用を意味しないPackage結果。
 */
export type CurrentAccessResult =
  | Readonly<{ status: "completed"; snapshot: CurrentAccessSnapshot }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "current_access_authentication_rejected"
        | "current_access_lock_unavailable"
        | "current_access_cleanup_pending"
        | "current_access_observation_unknown"
        | "current_access_release_unknown";
    }>;

/**
 * 固定管理判定に必要な操作とRole対象だけを表す。
 *
 * @responsibility 9 Role分担表を11認可要求種別へ対応させ、操作別の必須対象を閉じる。
 * @trace ARCH-000013
 * @shape 操作識別子と登録予定Role、変更前後Roleまたは対象Roleのdiscriminated union。
 * @invariant Host交換・初期化・Credential値・可変内容設定を含めない。
 * @boundary 通常管理の現在認可に用いる純粋な入力。
 * @security 対象の実在・userId結合・現在状態は呼出し側が別に確認する。
 * @compatibility 内部Package契約であり、HTTP／MCPの公開Schemaではない。
 */
export type ManagementRequest =
  | Readonly<{ operation: "registerUser"; plannedRole: AccessRole }>
  | Readonly<{ operation: "updateUserName"; targetRole: AccessRole }>
  | Readonly<{
      operation: "updateUserRole";
      currentRole: AccessRole;
      nextRole: AccessRole;
    }>
  | Readonly<{ operation: "updateRoleContentAccess"; targetRole: AccessRole }>
  | Readonly<{
      operation:
        | "registerRepository"
        | "unregisterRepository"
        | "updateExposure"
        | "manageAiProfiles"
        | "issueCredential"
        | "revokeCredential"
        | "exchangeCredentials";
    }>;

/**
 * 固定分担だけの許可、拒否、入力不正を区別する。
 *
 * @responsibility 形式不正を権限不足に畳まず、判定値から実行Authorityを発行しない。
 * @trace ARCH-000013
 * @shape allowed、denied、invalidのliteral union。
 * @invariant allowedは固定管理分担の成立だけを示す。
 * @boundary 通常管理の処置前判定。
 * @security 保存、鍵発行、内容閲覧、Host交換をこの値だけで許可しない。
 * @compatibility Source内部の判定結果で、公開read結果とは別である。
 */
export type ManagementPermission = "allowed" | "denied" | "invalid";

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
