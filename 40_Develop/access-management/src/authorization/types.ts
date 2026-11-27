import type { AccessRole } from "../role/types.ts";

/** 信頼済みの受付で確認した外部アカウントの紐付け。 @trace ARCH-000013 */
export type AccountAccessPrincipal = Readonly<{
  kind: "account";
  userId: string;
  bindingId: string;
  expiresAt: number;
}>;

/** 現在状態から読み取った本人と管理ロール。 @trace ARCH-000013 */
export type AccessActor = Readonly<{
  revision: number;
  userId: string;
  username: string;
  role: AccessRole;
}>;
