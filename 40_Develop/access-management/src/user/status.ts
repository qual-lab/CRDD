/**
 * 現在のユーザー有効状態を既存の管理閲覧範囲で取得する。
 * @packageDocumentation
 * @responsibility ユーザー状態の意味と現在の導出方法を利用側から分離する。
 * @trace ARCH-000013
 */
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { projectManagementState } from "../authorization/management.ts";
import { resolveCredentialAuthentication } from "../credential/authentication.ts";
import { readCredentialId } from "../credential/token.ts";
import {
  ATTEMPT_UUID,
  locked,
  readCurrent,
  settlePending,
} from "../storage/store.ts";

/**
 * ユーザーの有効状態と確認不能を区別する。
 * @responsibility 鍵の一覧・件数・判定方法を公開せず、ユーザー状態だけを返す。
 * @trace ARCH-000013
 * @shape completedは同改訂のuserIdとenabled、unavailableは固定理由のみ。
 * @invariant 確認不能・対象不在・非認可をenabled:falseへ変換しない。
 * @boundary 管理用のユーザー状態取得と信頼した利用側。
 * @security Secret・資格ID・Role・保存Root・内部失敗を返さない。
 * @compatibility 将来の判定方法変更でもユーザー有効状態という意味を維持する。
 */
export type UserStatusResult =
  | Readonly<{
      status: "completed";
      revision: number;
      userId: string;
      enabled: boolean;
    }>
  | Readonly<{ status: "unavailable"; reason: "user_status_unavailable" }>;

/**
 * 閲覧できるユーザーの現在の有効状態を返す。
 * @responsibility 同じ管理改訂で認証・可視対象・有効状態を確認する。
 * @trace ARCH-000013
 * @input 既存管理Root、要求専用Bearer、対象userId。
 * @returns ユーザー有効状態と改訂、または非開示の確認不能。
 * @precondition 同Hostの信頼した構成側から使用する。公開Transport入口は追加しない。
 * @postcondition 既存pending処置とLock解放を確認した場合だけcompletedを返す。
 * @effect 既存Lock、現在値読取り、認証KDF、許可後の既存短命材料清掃。
 * @failure 非認可・不在・初期化途中・読取り・清掃・解放不明はunavailable。
 * @invariant 現在は非失効鍵1件以上をenabledとする。提示済み・Role内容権限を追加条件にしない。
 * @boundary 既存ユーザー管理の可視範囲とユーザー状態の公開値。
 * @security 有効状態は認証成功・操作許可・後続要求時の有効性を保証しない。
 * @concurrency 認証から状態導出まで同じLockと改訂を使用する。
 */
export function readUserStatus(
  root: FilesystemStoreRoot,
  token: string,
  userId: unknown,
): UserStatusResult {
  const unavailable = Object.freeze({
    status: "unavailable" as const,
    reason: "user_status_unavailable" as const,
  });
  if (
    typeof userId !== "string" ||
    !ATTEMPT_UUID.test(userId) ||
    !readCredentialId(token)
  )
    return unavailable;
  const result = locked<{ revision: number; userId: string; enabled: boolean }>(
    root,
    () => {
      try {
        const current = readCurrent(root);
        const actor = resolveCredentialAuthentication(token, current.state);
        const visible = actor
          ? projectManagementState(current.state, actor, "users")
          : null;
        if (
          visible?.kind !== "users" ||
          !visible.users.some((user) => user.userId === userId)
        )
          return {
            status: "unavailable",
            reason: "user_status_unavailable",
            publication: "not_attempted",
            revision: null,
            cleanupConfirmed: true,
          };
        const enabled = current.state.credentials.some(
          (credential) => credential.userId === userId && !credential.revoked,
        );
        settlePending(root, current, () => {});
        return {
          status: "completed",
          value: { revision: current.state.revision, userId, enabled },
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      } catch {
        return {
          status: "unavailable",
          reason: "user_status_unavailable",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: false,
        };
      }
    },
  );
  return result.status === "completed"
    ? Object.freeze({ status: "completed", ...result.value })
    : unavailable;
}
