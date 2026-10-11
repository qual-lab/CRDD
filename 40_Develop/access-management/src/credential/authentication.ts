/**
 * 同じ管理改訂から資格の認証主体を解決する。
 * @packageDocumentation
 * @responsibility 鍵照合と現在User・Role投影を所有し、保存・管理許可を引き取らない。
 * @trace ARCH-000013
 */
import type { AccessRole } from "../access/management-permission.ts";
import type { AccessManagementState } from "../state/parse.ts";
import { readCredentialId, verifyCredentialToken } from "./token-material.ts";

/**
 * 一要求で観測した本人とRole内容範囲を表す。
 * @responsibility 内部資格材料を含めず現在改訂の相関だけを搬送する。
 * @trace ARCH-000013
 * @shape revision・credentialId・userId・username・role・workspaceIds。
 * @invariant 内容範囲は許可済みRepository集合・実アクセス・管理実行許可ではない。
 * @boundary AM内部認証から要求Consumerへの短命投影。
 * @security token・salt・Verifier・他User・内部Pathを含めない。
 * @compatibility 最新User結合・現在Role契約だけ。旧Credential Grantを使用しない。
 */
export type AuthenticatedRequest = Readonly<{
  revision: number;
  credentialId: string;
  userId: string;
  username: string;
  role: AccessRole;
  workspaceIds: readonly ("development" | "management")[];
}>;

/**
 * 認証成功と非開示拒否・状態未確認を区別する。
 * @responsibility 未確認cleanupや資格の状態を成功主体へ透過しない。
 * @trace ARCH-000013
 * @shape completedはsnapshot、unavailableは閉じたreasonのみ。
 * @invariant 失敗結果に対象ID・存在・状態・改訂を含めない。
 * @boundary Package認証入口。鍵管理・Transportの結果とは別。
 * @security 内部Lock回復参照・保存Path・資格材料を透過しない。
 * @compatibility 本番Consumer未接続の局所専用結果。
 */
export type CredentialAuthenticationResult =
  | Readonly<{ status: "completed"; snapshot: AuthenticatedRequest }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "credential_authentication_rejected"
        | "credential_authentication_state_unavailable";
    }>;

/**
 * 検査済み同一Snapshotから本人だけを認証・投影する。
 * @responsibility 現在資格・User・Roleを結合して固定DTOへ閉じる。
 * @trace ARCH-000013
 * @input 信頼しない鍵文字列とSchema検査済み所有Snapshot。
 * @returns 所有済み本人投影、または非開示拒否のnull。
 * @precondition 保存Ownerが同じ既存Lock下で完全Schemaを検査済み。
 * @postcondition Snapshotを変更せず、返却配列を共有しない。
 * @effect 同期Verifier照合だけ。I/O・鍵生成・配送なし。
 * @failure 不正形式・未知資格・失効・不一致・参照欠測・暗号故障はnull。
 * @invariant 初回credential_storedの照合を初回完了・通常接続記録へ昇格しない。
 * @boundary AM認証純粋解決。管理許可・Exposure・実Repository権限は別。
 * @security Secret・他User・保存材料を結果へ含めない。
 * @concurrency 呼出側の既存Lock区間内だけ。次要求は現在状態を読み直す。
 */
export function resolveCredentialAuthentication(
  token: string,
  state: AccessManagementState,
): AuthenticatedRequest | null {
  const credentialId = readCredentialId(token);
  if (!credentialId) return null;
  const credential = state.credentials.find(
    (item) => item.credentialId === credentialId,
  );
  if (
    !credential ||
    credential.revoked ||
    !verifyCredentialToken(token, credential)
  )
    return null;
  const user = state.users.find((item) => item.userId === credential.userId);
  if (!user) return null;
  const role = state.roleContentAccess.find((item) => item.role === user.role);
  if (!role) return null;
  return Object.freeze({
    revision: state.revision,
    credentialId,
    userId: user.userId,
    username: user.username,
    role: user.role,
    workspaceIds: Object.freeze([...role.workspaceIds]),
  });
}
