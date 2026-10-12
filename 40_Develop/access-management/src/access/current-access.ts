/**
 * 同一管理改訂から本人の現在権限を表示用に投影する。
 * @responsibility 管理操作候補・内容範囲・公開Repository集合を分離し、実行許可を発行しない。
 * @trace ARCH-000013
 */
import type { AuthenticatedRequest } from "../credential/authentication.ts";
import type { AccessManagementState } from "../state/parse.ts";
import {
  type AccessRole,
  evaluateManagementPermission,
  type ManagementRequest,
} from "./management-permission.ts";

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
 * 検査・認証済み同一改訂を本人表示用の所有値へ変換する。
 * @responsibility 固定管理分担とRole内容範囲∩Exposureを個別に投影する。
 * @trace ARCH-000013
 * @input 同じLock内の完全検査済み状態と、そこから認証した本人。
 * @returns 入れ子まで凍結した非Authorityの現在投影。
 * @precondition 保存Ownerが完全Schemaと本人の同一改訂を確認済み。
 * @postcondition 内部配列・User・資格への参照を返さない。
 * @effect N/A: 所有メモリ値の生成だけで外部I/Oはない。
 * @failure 改訂不一致は固定例外で保存Ownerへ返す。
 * @invariant 管理者の固定管理権限から内容権限を補完しない。
 * @boundary AM本人投影と保存・認証Owner。
 * @security 他User・内部Path・秘密材料を列挙しない。
 * @concurrency 呼出元の同じLock区間だけ。後続要求には再認証が必要。
 */
export function projectCurrentAccess(
  state: AccessManagementState,
  actor: AuthenticatedRequest,
): CurrentAccessSnapshot {
  if (actor.revision !== state.revision) throw new Error("revision_mismatch");
  const roles: readonly AccessRole[] = [
    "developer",
    "manager",
    "administrator",
  ];
  const candidates: ManagementRequest[] = [];
  for (const role of roles) {
    candidates.push(
      { operation: "registerUser", plannedRole: role },
      { operation: "updateUserName", targetRole: role },
      { operation: "updateRoleContentAccess", targetRole: role },
    );
    for (const nextRole of roles)
      candidates.push({
        operation: "changeUserRole",
        currentRole: role,
        nextRole,
      });
  }
  for (const operation of [
    "registerRepository",
    "unregisterRepository",
    "updateExposure",
    "manageAiProfiles",
    "issueCredential",
    "revokeCredential",
    "exchangeCredentials",
  ] as const)
    candidates.push({ operation });
  return Object.freeze({
    revision: state.revision,
    user: Object.freeze({
      userId: actor.userId,
      username: actor.username,
      role: actor.role,
    }),
    managementOperations: Object.freeze(
      candidates
        .filter(
          (request) =>
            evaluateManagementPermission(actor.role, request) === "allowed",
        )
        .map((request) => Object.freeze(request)),
    ),
    contentAccess: Object.freeze({
      workspaceIds: Object.freeze([...actor.workspaceIds]),
    }),
    permittedRepositories: Object.freeze(
      state.exposure.flatMap((exposure) => {
        const workspaceIds = exposure.workspaceIds.filter((id) =>
          actor.workspaceIds.includes(id),
        );
        return workspaceIds.length === 0
          ? []
          : [
              Object.freeze({
                repositoryId: exposure.repositoryId,
                workspaceIds: Object.freeze(workspaceIds),
              }),
            ];
      }),
    ),
  });
}
