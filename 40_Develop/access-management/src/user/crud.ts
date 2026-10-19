/**
 * ユーザー管理と現在管理情報の取得を既存の認可・保存へ接続する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import crypto from "node:crypto";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  evaluateManagementPermission,
  projectManagementOperationResult,
} from "../authorization/management.ts";
import { resolveCredentialAuthentication } from "../credential/authentication.ts";
import { readCredentialId } from "../credential/token.ts";
import type { ManagementOperationOutcome } from "../permission/types.ts";
import { isAccessRole as isRole } from "../permission/validation.ts";
import { parseAccessManagementState } from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  CURRENT_LIMIT,
  ordinaryChange,
  PENDING_LIMIT,
  preparePublicationBytes,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import { locked } from "../storage/lock.ts";
import type { AccessManagementState } from "../storage/types.ts";
import type {
  PreparedUserRoleChange,
  UserRoleChange,
  UserRoleManagementResult,
} from "./types.ts";

/**
 * 表示名を既存状態Schemaと同じ条件で検査する。
 * @responsibility 空・暗黙正規化・制御文字を受理しない。
 * @trace ARCH-000013
 * @input 信頼しない表示名。
 * @returns 正規化不要な1〜128文字の場合だけtrue。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 値を変更せず、objectを文字列化しない。
 * @effect N/A: primitiveの同期検査だけ。
 * @failure 不正値はfalse。
 * @invariant 同名ユーザーを禁止する新条件を追加しない。
 * @boundary 通常ユーザー管理の入力検査。
 * @security getter・toStringを実行しない。
 * @concurrency N/A: 局所値だけ。
 */
function isUserName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 256 &&
    value === value.trim() &&
    [...value].length >= 1 &&
    [...value].length <= 128 &&
    !/[\p{Cc}\p{Cs}]/u.test(value)
  );
}

/**
 * 同じ現在状態で管理認可と対象を確認し変更候補を作る。
 * @responsibility 変更前認可を使い、意図したUser／Role fieldだけを変える。
 * @trace ARCH-000013
 * @input 鍵、完全検査済み現在状態、対象二操作入力、期待改訂、受付UUID。
 * @returns 所有済み候補または非開示拒否のnull。
 * @precondition 保存Ownerが同じLock内で読み取ったSnapshotだけを渡す。
 * @postcondition 入力状態・資格・初回・未解決交換・Repository登録・Exposureを変更しない。
 * @effect N/A: 認証計算とメモリ候補だけ。乱数・保存なし。
 * @failure 未認証・固定分担拒否・途中初回・対象差・不正入力はnull。
 * @invariant managerによるadministrator名変更は許可し、Role変更は許可しない。
 * @boundary 操作固有判断と物理保存の境界。
 * @security 返却Snapshotは保存Owner限定。古い認証DTOをAuthorityにしない。
 * @concurrency 同期Lock区間内で現在認可を再評価する。
 */
export function prepareUserChange(
  token: string,
  current: AccessManagementState,
  change: Extract<
    UserRoleChange,
    { operation: "registerUser" | "updateUserName" }
  >,
  expectedRevision: number,
  operationId: string,
): PreparedUserRoleChange | null {
  const actor = resolveCredentialAuthentication(token, current);
  if (!actor || current.initialization.stage !== "completed") return null;
  if (
    current.revision !== expectedRevision ||
    current.operationId === operationId
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  let userId: string | null = null;
  if (change.operation === "registerUser") {
    if (!isUserName(change.username) || !isRole(change.plannedRole))
      return null;
    if (
      evaluateManagementPermission(actor.role, {
        operation: "registerUser",
        plannedRole: change.plannedRole,
      }) !== "allowed"
    )
      return null;
    next.users.push({
      userId: "00000000-0000-4000-8000-000000000000",
      username: change.username,
      role: change.plannedRole,
    });
  } else {
    if (typeof change.userId !== "string") return null;
    const target = next.users.find((item) => item.userId === change.userId);
    if (!target) return null;
    userId = target.userId;

    if (
      !isUserName(change.username) ||
      evaluateManagementPermission(actor.role, {
        operation: change.operation,
        targetRole: target.role,
      }) !== "allowed"
    )
      return null;
    target.username = change.username;
  }
  return { next, registersUser: change.operation === "registerUser", userId };
}

/**
 * 対象二操作の現在認可・変更・保存を直列化する。
 * @responsibility 非開示拒否と今回出版事実を既存保存部品へ接続する。
 * @trace ARCH-000013
 * @input 検証済みRoot、鍵、期待改訂、受付UUID、対象二操作入力。
 * @returns 非秘密の管理結果。
 * @precondition 用途限定Rootを使う内部Consumerだけが呼ぶ。入力は本関数も検査する。
 * @postcondition 今回の出版・読戻し・材料とLock清掃確認時だけcompleted。
 * @effect 既存Lock、登録時だけUUID一回、既存pending／replace／current出版。
 * @failure 認可前は固定拒否。認可後は最初の失敗と今回出版事実を保持する。
 * @invariant 先行pendingの出版を今回操作へ帰属せず、鍵・初回・Repository登録・Exposureを変更しない。
 * @boundary 通常User／Role管理と私有Filesystem保存。
 * @security 未認証・未許可に状態情報を返さず、資格材料と回復参照は常に非公開。
 * @concurrency 同じ既存Lock内で現在認証・期待改訂・容量・保存を評価する。
 */
export function executeUserRoleManagementMutation(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  change: Extract<
    UserRoleChange,
    { operation: "registerUser" | "updateUserName" }
  >,
): UserRoleManagementResult {
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
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
        current.state.revision !== expectedRevision ||
        current.state.operationId === operationId
      )
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      const prepared = prepareUserChange(
        token,
        current.state,
        change,
        expectedRevision,
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
      stage = "capacity";
      const reservation = preparePublicationBytes(
        current,
        prepared.next,
        "management",
      );
      if (
        reservation.nextBytes.byteLength > CURRENT_LIMIT ||
        reservation.pendingBytes.byteLength > PENDING_LIMIT
      )
        return {
          status: "unavailable" as const,
          reason: "state_store_capacity_exceeded",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      if (prepared.registersUser) {
        stage = "identity";
        const userId = crypto.randomUUID();
        if (
          !ATTEMPT_UUID.test(userId) ||
          userId === operationId ||
          current.state.users.some((user) => user.userId === userId)
        )
          throw new Error("user_identity_invalid");
        const user = prepared.next.users.at(-1);
        if (!user) throw new Error("user_candidate_invalid");
        user.userId = userId;
        targetUserId = userId;
      }
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
 * 現在管理者が新しい最小ユーザーを登録する。
 * @responsibility 予定Roleの固定管理許可からUser一件だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、表示名、予定Role。
 * @returns 新User IDと保存観測、または非秘密拒否。
 * @precondition 初回設定が完了した用途限定Storeを使用する。
 * @postcondition 資格を発行せずUser一件だけ追加する。
 * @effect 認可・容量確認後のUUID一回と既存保存。
 * @failure 非認可・不正入力・競合・容量・生成・保存・清掃不明で未完了。
 * @invariant managerはadministratorを登録できない。
 * @boundary 通常ユーザー管理と同じLock内の保存。
 * @security 鍵・全内部状態を結果へ返さない。
 * @concurrency 現在資格と予定Roleの許可を保存直前に再評価する。
 */
export function saveUserRegistration(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  username: string,
  plannedRole: unknown,
): UserRoleManagementResult {
  return executeUserRoleManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "registerUser", username, plannedRole },
  );
}

/**
 * 既存ユーザーの管理用表示名だけを変更する。
 * @responsibility exact Userと現在Roleを確認し名前だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存User ID、新表示名。
 * @returns 対象User IDと保存観測、または非秘密拒否。
 * @precondition 完了初期化のStoreを使用する。
 * @postcondition User ID・Role・資格を保持する。
 * @effect 既存状態保存。UUID生成なし。
 * @failure 不正名・対象差・非認可・競合・保存／清掃不明で未完了。
 * @invariant managerはadministratorの表示名を変更できる。
 * @boundary 通常名前管理と保存Owner。
 * @security 他User一覧・資格材料を返さない。
 * @concurrency 同じ現在状態から対象と許可を再評価する。
 */
export function saveUserName(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: string,
  username: string,
): UserRoleManagementResult {
  return executeUserRoleManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "updateUserName", userId, username },
  );
}

/**
 * 現在管理者が新しい最小ユーザーを登録する。
 * @responsibility 予定Roleの固定管理許可からUser一件だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、表示名、予定Role。
 * @returns 新User IDと保存観測、または非秘密拒否。
 * @precondition 初回設定が完了した用途限定Storeを使用する。
 * @postcondition 資格を発行せずUser一件だけ追加する。
 * @effect 認可・容量確認後のUUID一回と既存保存。
 * @failure 非認可・不正入力・競合・容量・生成・保存・清掃不明で未完了。
 * @invariant managerはadministratorを登録できない。
 * @boundary 通常ユーザー管理と同じLock内の保存。
 * @security 鍵・全内部状態を結果へ返さない。
 * @concurrency 現在資格と予定Roleの許可を保存直前に再評価する。
 */
export function registerUser(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  username: string,
  plannedRole: unknown,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveUserRegistration(
      root,
      token,
      expectedRevision,
      operationId,
      username,
      plannedRole,
    ),
  );
}

/**
 * 既存ユーザーの管理用表示名だけを変更する。
 * @responsibility exact Userと現在Roleを確認し名前だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存User ID、新表示名。
 * @returns 対象User IDと保存観測、または非秘密拒否。
 * @precondition 完了初期化のStoreを使用する。
 * @postcondition User ID・Role・資格を保持する。
 * @effect 既存状態保存。UUID生成なし。
 * @failure 不正名・対象差・非認可・競合・保存／清掃不明で未完了。
 * @invariant managerはadministratorの表示名を変更できる。
 * @boundary 通常名前管理と保存Owner。
 * @security 他User一覧・資格材料を返さない。
 * @concurrency 同じ現在状態から対象と許可を再評価する。
 */
export function updateUserName(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: string,
  username: string,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveUserName(root, token, expectedRevision, operationId, userId, username),
  );
}
