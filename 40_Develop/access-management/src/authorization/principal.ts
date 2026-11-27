/**
 * 内容・管理読み取りを、現在の利用者とRoleに結び付ける。
 * @trace ARCH-000013
 * @boundary 外部トークンを検証するのは受付側。ここでは保存Lock内で紐付けと期限を照合する。
 */
import type { AccessActor, AccountAccessPrincipal } from "./types.ts";
import { UUID_V4 } from "../storage/parse.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { resolveAccountBinding } from "../user/account-link.ts";

/** 不正入力と期限切れは状態・対象の観測前に除く。 @trace ARCH-000013 */
export function isUnexpiredAccountPrincipal(
  principal: AccountAccessPrincipal,
): boolean {
  return (
    principal !== null &&
    typeof principal === "object" &&
    principal.kind === "account" &&
    typeof principal.userId === "string" &&
    UUID_V4.test(principal.userId) &&
    typeof principal.bindingId === "string" &&
    UUID_V4.test(principal.bindingId) &&
    Number.isSafeInteger(principal.expiresAt) &&
    principal.expiresAt > Date.now()
  );
}

/** 一時的な本人情報を信用せず、同一Snapshotにある現在権限だけを返す。 @trace ARCH-000013 */
export function resolveAccessPrincipal(
  principal: AccountAccessPrincipal,
  state: AccessManagementState,
): AccessActor | null {
  return isUnexpiredAccountPrincipal(principal)
    ? resolveAccountBinding(state, principal)
    : null;
}
