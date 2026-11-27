/**
 * ユーザーのRoleを現在認可に従い割り当てる。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { FilesystemStoreRoot } from "../initialization/root.ts";
import {
  evaluateManagementPermission,
  projectManagementOperationResult,
} from "../authorization/management.ts";
import {
  acceptsAccessPrincipal,
  resolveAccessPrincipal,
} from "../authorization/principal.ts";
import type { AccountAccessPrincipal } from "../authorization/types.ts";
import type { ManagementOperationOutcome } from "../permission/types.ts";
import { isAccessRole } from "../permission/validation.ts";
import { locked } from "../storage/lock.ts";
import { parseAccessManagementState } from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  ordinaryChange,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import type {
  PreparedUserRoleChange,
  UserRoleChange,
  UserRoleManagementResult,
} from "../user/types.ts";

/**
 * 既存ユーザーの現在Roleを明示した次Roleへ変更する。
 * @responsibility 変更前Roleと固定管理許可を確認して一件のRoleだけを保存する。
 * @trace ARCH-000013
 * @input Root、確認済みアカウント主体、期待改訂、受付UUID、既存User ID、変更前後Role。
 * @returns 対象User IDと保存観測、または非秘密拒否。
 * @precondition 完了初期化のStoreを使用する。
 * @postcondition 名前・ID・資格結合を保持し次要求が新Roleを評価する。
 * @effect 既存状態保存。資格発行・失効なし。
 * @failure 前Role差・非認可・不正値・競合・保存／清掃不明で未完了。
 * @invariant administratorが関わる変更はadministratorだけ。最終管理者guardを追加しない。
 * @boundary 通常Role管理と保存Owner。
 * @security 変更後Roleを変更前の実行許可へ使わない。
 * @concurrency 同じLock内の変更前認可を使用する。
 */
export function saveUserRole(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  userId: string,
  currentRole: unknown,
  nextRole: unknown,
): UserRoleManagementResult {
  return executeRoleAssignment(root, principal, expectedRevision, operationId, {
    operation: "updateUserRole",
    userId,
    currentRole,
    nextRole,
  });
}

type RoleAssignmentChange = Extract<
  UserRoleChange,
  { operation: "updateUserRole" }
>;

/**
 * 同じ現在状態で管理認可と対象を確認し変更候補を作る。
 * @responsibility 変更前認可を使い、意図したUser／Role fieldだけを変える。
 * @trace ARCH-000013
 * @input 主体、完全検査済み現在状態、Role変更入力、期待改訂、受付UUID。
 * @returns 所有済み候補または非開示拒否のnull。
 * @precondition 保存Ownerが同じLock内で読み取ったSnapshotだけを渡す。
 * @postcondition 入力状態・資格・初回・未解決交換・Repository登録・Exposureを変更しない。
 * @effect N/A: 認証計算とメモリ候補だけ。乱数・保存なし。
 * @failure 未認証・固定分担拒否・途中初回・対象差・不正入力はnull。
 * @invariant managerによるadministratorの付与・解除を拒否する。
 * @boundary 操作固有判断と物理保存の境界。
 * @security 返却Snapshotは保存Owner限定。古い認証DTOをAuthorityにしない。
 * @concurrency 同期Lock区間内で現在認可を再評価する。
 */
export function prepareRoleAssignment(
  principal: AccountAccessPrincipal,
  current: AccessManagementState,
  change: RoleAssignmentChange,
  expectedRevision: number,
  operationId: string,
): PreparedUserRoleChange | null {
  const actor = resolveAccessPrincipal(principal, current);
  if (!actor || current.initialization.stage !== "completed") return null;
  if (
    current.revision !== expectedRevision ||
    current.operationId === operationId
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  if (typeof change.userId !== "string") return null;
  const target = next.users.find((item) => item.userId === change.userId);
  if (
    !target ||
    !isAccessRole(change.nextRole) ||
    change.currentRole !== target.role ||
    evaluateManagementPermission(actor.role, {
      operation: "updateUserRole",
      currentRole: target.role,
      nextRole: change.nextRole,
    }) !== "allowed"
  )
    return null;
  target.role = change.nextRole;
  return { next, registersUser: false, userId: target.userId };
}

/**
 * Role変更の現在認可・変更・保存を直列化する。
 * @responsibility 非開示拒否と今回出版事実を既存保存部品へ接続する。
 * @trace ARCH-000013
 * @input 検証済みRoot、主体、期待改訂、受付UUID、Role変更入力。
 * @returns 非秘密の管理結果。
 * @precondition 用途限定Rootを使う内部Consumerだけが呼ぶ。入力は本関数も検査する。
 * @postcondition 今回の出版・読戻し・材料とLock清掃確認時だけcompleted。
 * @effect 既存Lock、既存pending／replace／current出版。
 * @failure 認可前は固定拒否。認可後は最初の失敗と今回出版事実を保持する。
 * @invariant 先行pendingの出版を今回操作へ帰属せず、鍵・初回・Repository登録・Exposureを変更しない。
 * @boundary 通常User／Role管理と私有Filesystem保存。
 * @security 未認証・未許可に状態情報を返さず、資格材料と回復参照は常に非公開。
 * @concurrency 同じ既存Lock内で現在認証・期待改訂・容量・保存を評価する。
 */
export function executeRoleAssignment(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  change: RoleAssignmentChange,
): UserRoleManagementResult {
  if (
    !acceptsAccessPrincipal(principal) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId)
  )
    return { status: "unavailable", reason: "management_operation_rejected" };
  let admitted = false;
  let targetUserId: string | null = null;
  let currentPublication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  const result = locked(root, () => {
    let revision: number | null = null;
    let stage = "read";
    let materialsConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      stage = "authorization";
      if (
        revision < expectedRevision ||
        current.state.operationId === operationId
      )
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      const prepared = prepareRoleAssignment(
        principal,
        current.state,
        change,
        current.state.revision,
        operationId,
      );
      if (!prepared)
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      if (revision !== expectedRevision)
        return {
          status: "unavailable" as const,
          reason: "state_store_revision_conflict",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      targetUserId = prepared.userId;
      stage = "pending";
      const settled = settlePending(root, current, () => {});
      materialsConfirmed = true;
      if (settled !== "none")
        return {
          status: "unavailable" as const,
          reason: "state_store_previous_pending_settled",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };

      stage = "candidate";
      const parsed = parseAccessManagementState(serialize(prepared.next));
      if (
        parsed.status !== "parsed" ||
        !ordinaryChange(current.state, parsed.state)
      )
        throw new Error("user_role_candidate_invalid");
      const published = publishState(root, current, parsed.state, "management");
      currentPublication = published.publication;
      return published;
    } catch {
      return {
        status: "unavailable" as const,
        reason: `state_store_${stage}_failed`,
        publication: currentPublication,
        revision,
        cleanupConfirmed: materialsConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "management_operation_rejected" };
  if (result.status === "completed")
    return {
      status: "completed",
      operationId,
      expectedRevision,
      revision: result.value.revision,
      userId: targetUserId,
      publication: "confirmed",
      cleanupConfirmed: true,
    };
  return {
    status: "unavailable",
    reason: "management_operation_unavailable",
    primaryFailure: result.reason,
    operationId,
    expectedRevision,
    observedRevision: result.revision,
    publication: currentPublication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 既存ユーザーの現在Roleを明示した次Roleへ変更する。
 * @responsibility 変更前Roleと固定管理許可を確認して一件のRoleだけを保存する。
 * @trace ARCH-000013
 * @input Root、確認済みアカウント主体、期待改訂、受付UUID、既存User ID、変更前後Role。
 * @returns 対象User IDと保存観測、または非秘密拒否。
 * @precondition 完了初期化のStoreを使用する。
 * @postcondition 名前・ID・資格結合を保持し次要求が新Roleを評価する。
 * @effect 既存状態保存。資格発行・失効なし。
 * @failure 前Role差・非認可・不正値・競合・保存／清掃不明で未完了。
 * @invariant administratorが関わる変更はadministratorだけ。最終管理者guardを追加しない。
 * @boundary 通常Role管理と保存Owner。
 * @security 変更後Roleを変更前の実行許可へ使わない。
 * @concurrency 同じLock内の変更前認可を使用する。
 */
export function updateUserRole(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  userId: string,
  currentRole: unknown,
  nextRole: unknown,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveUserRole(
      root,
      principal,
      expectedRevision,
      operationId,
      userId,
      currentRole,
      nextRole,
    ),
  );
}
