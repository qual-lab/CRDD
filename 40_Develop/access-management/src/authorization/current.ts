/**
 * 現在主体の権限・許可Repositoryを同じ改訂から解決する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { resolveCredentialAuthentication } from "../credential/authentication.ts";
import { readCredentialId } from "../credential/token.ts";
import type { AuthenticatedRequest } from "../credential/types.ts";
import type {
  CurrentAccessOutcome,
  CurrentAccessResult,
  CurrentAccessSnapshot,
  ManagementRequest,
} from "../permission/types.ts";
import type { AccessRole } from "../role/types.ts";
import { locked, readCurrent, settlePending } from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { evaluateManagementPermission } from "./management.ts";

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
        operation: "updateUserRole",
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
 * 同じ保存改訂から本人の現在権限を読み取り、解放確認後に返す。
 * @responsibility 認証前の材料清掃を避け、本人投影と保存Ownerの終了を接続する。
 * @trace ARCH-000013
 * @input 検証済み用途限定Rootと信頼しないBearer文字列。
 * @returns 本人の非秘密投影、または固定の未取得理由。
 * @precondition Root検証は既存内部Owner、公開Transportの入力境界はConsumerが所有する。
 * @postcondition 認証・完全状態・投影・材料清掃・Lock解放を確認した場合だけcompleted。
 * @effect 既存Lock、状態読取り、認証後の短命材料清掃、同期KDF。
 * @failure 不成立資格は同一拒否。取得・観測・回収・解放不明ではSnapshotなし。
 * @invariant 初回途中の本人表示を初回完了・通常接続確認に昇格しない。
 * @boundary AM保存Ownerと本人表示Consumer。実Repositoryアクセスは別。
 * @security 生鍵・資格ID・保存Path・Lock回復参照・他Userを返さない。
 * @concurrency 全Writerと同じLock内の同改訂。次操作は現在認可を再確認する。
 */
export function readCurrentAccessState(
  root: FilesystemStoreRoot,
  token: string,
): CurrentAccessResult {
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "current_access_authentication_rejected",
    };
  const result = locked<CurrentAccessSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      if (!actor)
        return {
          status: "unavailable",
          reason: "current_access_authentication_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "current_access_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
      return {
        status: "completed",
        value: projectCurrentAccess(current.state, actor),
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "current_access_observation_unknown",
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
    return { status: "unavailable", reason: "current_access_release_unknown" };
  if (result.reason === "current_access_authentication_rejected")
    return {
      status: "unavailable",
      reason: "current_access_authentication_rejected",
    };
  if (result.reason === "current_access_cleanup_pending")
    return { status: "unavailable", reason: "current_access_cleanup_pending" };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "current_access_lock_unavailable"
      : "current_access_observation_unknown",
  };
}

/**
 * 同じ保存改訂から本人の現在権限を読み取り、解放確認後に返す。
 * @responsibility 認証前の材料清掃を避け、本人投影と保存Ownerの終了を接続する。
 * @trace ARCH-000013
 * @input 検証済み用途限定Rootと信頼しないBearer文字列。
 * @returns 本人の非秘密投影、または固定の未取得理由。
 * @precondition Root検証は既存内部Owner、公開Transportの入力境界はConsumerが所有する。
 * @postcondition 認証・完全状態・投影・材料清掃・Lock解放を確認した場合だけcompleted。
 * @effect 既存Lock、状態読取り、認証後の短命材料清掃、同期KDF。
 * @failure 不成立資格は同一拒否。取得・観測・回収・解放不明ではSnapshotなし。
 * @invariant 初回途中の本人表示を初回完了・通常接続確認に昇格しない。
 * @boundary AM保存Ownerと本人表示Consumer。実Repositoryアクセスは別。
 * @security 生鍵・資格ID・保存Path・Lock回復参照・他Userを返さない。
 * @concurrency 全Writerと同じLock内の同改訂。次操作は現在認可を再確認する。
 */
export function readCurrentAccess(
  root: FilesystemStoreRoot,
  token: string,
): CurrentAccessOutcome {
  return projectCurrentAccessResult(readCurrentAccessState(root, token));
}
